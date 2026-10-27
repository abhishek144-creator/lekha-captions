"""Nightly Firestore copy to the private R2 media bucket, and a restore command.

The project has no Google billing, so managed backups/PITR are unavailable and
every document read counts against the free 50,000 reads a day. Exceeding that
quota stops the app's own reads until midnight Pacific, so the backup:
  * skips high-volume operational logs (EXCLUDED_COLLECTIONS) that can be
    regenerated or are not customer state,
  * stops at FIRESTORE_BACKUP_MAX_DOCUMENTS (default 10,000) and alerts.

Each backup is one gzip JSONL file (one {"path", "data"} document per line) plus
a manifest under backups/firestore/<UTC date>/. The R2 lifecycle rules only
expire uploads/, exports/ and render-cache/; BACKUP_RETENTION_DAYS here prunes
old backups.

Restore (dry run lists what would be written; --apply writes with set()):
    python -m backend.firestore_backup list
    python -m backend.firestore_backup restore 2026-10-27 [--only users/UID] [--apply]
"""

import argparse
import base64
import gzip
import json
import os
import sys
import tempfile
from datetime import datetime, timezone

from google.cloud import firestore

try:
    from . import firebase_admin_setup
    from . import media_storage
    from . import observability
except ImportError:  # Direct execution from backend/ remains supported.
    import firebase_admin_setup
    import media_storage
    import observability


BACKUP_PREFIX = "backups/firestore/"
BACKUP_RETENTION_DAYS = 14
EXCLUDED_COLLECTIONS = frozenset({
    "analytics_events",       # ~50k product-analytics rows; summaries are rebuilt from new events
    "payment_reconcile_runs",  # one row per reconciliation pass; payments themselves are kept
    "audit_logs",
    "export_jobs",
    "export_dead_letter",
    "export_expirations",
    "upload_expirations",
    "direct_upload_intents",
    "transcription_cache",
    "operation_locks",
    "ops_staging",
    "_readiness_probe",
})
RESTORE_BATCH = 400


class BackupTooLarge(RuntimeError):
    pass


def _max_documents() -> int:
    return int(os.environ.get("FIRESTORE_BACKUP_MAX_DOCUMENTS", "10000") or 10000)


def encode_value(value):
    """Firestore values -> JSON. Tagged dicts keep types a restore must rebuild."""
    if isinstance(value, datetime):
        moment = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
        return {"__fs": "timestamp", "value": moment.isoformat()}
    if isinstance(value, firestore.DocumentReference):
        return {"__fs": "ref", "value": value.path}
    if isinstance(value, firestore.GeoPoint):
        return {"__fs": "geo", "value": [value.latitude, value.longitude]}
    if isinstance(value, bytes):
        return {"__fs": "bytes", "value": base64.b64encode(value).decode("ascii")}
    if isinstance(value, dict):
        return {str(key): encode_value(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [encode_value(item) for item in value]
    return value


def decode_value(value, db):
    if isinstance(value, dict):
        kind = value.get("__fs")
        if kind == "timestamp":
            return datetime.fromisoformat(value["value"])
        if kind == "ref":
            return db.document(value["value"])
        if kind == "geo":
            return firestore.GeoPoint(*value["value"])
        if kind == "bytes":
            return base64.b64decode(value["value"])
        return {key: decode_value(item, db) for key, item in value.items()}
    if isinstance(value, list):
        return [decode_value(item, db) for item in value]
    return value


def _walk(collection, write, budget):
    """Streams a collection and every subcollection below it, depth first."""
    for snapshot in collection.stream():
        budget["documents"] += 1
        if budget["documents"] > budget["limit"]:
            raise BackupTooLarge(f"more than {budget['limit']} documents")
        write({"path": snapshot.reference.path, "data": encode_value(snapshot.to_dict() or {})})
        for child in snapshot.reference.collections():
            _walk(child, write, budget)


def export_backup(db, *, now=None, upload=None, list_objects=None, delete=None) -> dict:
    """Writes one backup to R2 and prunes old ones. Raises on any failure."""
    if db is None:
        raise RuntimeError("Firestore is unavailable")
    upload = upload or media_storage.upload_file
    list_objects = list_objects or media_storage.iter_objects
    delete = delete or media_storage.delete_file
    now = now or datetime.now(timezone.utc)
    day = now.strftime("%Y-%m-%d")
    budget = {"documents": 0, "limit": _max_documents()}
    roots = sorted(c.id for c in db.collections())
    included = [name for name in roots if name not in EXCLUDED_COLLECTIONS]

    with tempfile.TemporaryDirectory(prefix="firestore-backup-") as folder:
        data_path = os.path.join(folder, "firestore.jsonl.gz")
        with gzip.open(data_path, "wt", encoding="utf-8") as handle:
            def write(row):
                handle.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n")

            for name in included:
                _walk(db.collection(name), write, budget)
        manifest = {
            "created_at": now.isoformat(),
            "documents": budget["documents"],
            "collections": included,
            "excluded": sorted(set(roots) & EXCLUDED_COLLECTIONS),
            "format": "gzip jsonl: {path, data}; tagged values {__fs: timestamp|ref|geo|bytes}",
        }
        manifest_path = os.path.join(folder, "manifest.json")
        with open(manifest_path, "w", encoding="utf-8") as handle:
            json.dump(manifest, handle, indent=2)
        if not upload(data_path, f"{BACKUP_PREFIX}{day}/firestore.jsonl.gz", "application/gzip"):
            raise RuntimeError("R2 storage is not configured")
        # The manifest goes last: a backup folder without one is incomplete.
        upload(manifest_path, f"{BACKUP_PREFIX}{day}/manifest.json", "application/json")

    pruned = prune_backups(now, list_objects=list_objects, delete=delete)
    return {"day": day, "documents": budget["documents"], "collections": len(included), "pruned": pruned}


def prune_backups(now, *, list_objects, delete) -> int:
    cutoff = now.timestamp() - BACKUP_RETENTION_DAYS * 86400
    removed = 0
    for item in list_objects(BACKUP_PREFIX):
        key = item.get("Key", "")
        day = key[len(BACKUP_PREFIX):].split("/", 1)[0]
        try:
            stamp = datetime.strptime(day, "%Y-%m-%d").replace(tzinfo=timezone.utc).timestamp()
        except ValueError:
            continue
        if stamp < cutoff and delete(key):
            removed += 1
    return removed


def run_nightly(connection, db, *, now=None, export=None, alert=None) -> dict:
    """Cron step: one attempt per UTC night, from 20:00 UTC (01:30 IST)."""
    now = now or datetime.now(timezone.utc)
    if now.hour < 20:
        return {"skipped": "before_window"}
    if not connection.set(f"lekha:cron:firestore-backup:{now:%Y-%m-%d}", "1", nx=True, ex=2 * 86400):
        return {"skipped": "already_attempted"}
    try:
        result = (export or export_backup)(db, now=now)
    except Exception as error:
        # Error level reaches Sentry, whose project alert emails the owner.
        observability._json_log("error", "firestore_backup_failed", error_type=type(error).__name__,
                                error=str(error)[:300])
        (alert or observability._send_alert)(f"[Lekha] Nightly Firestore backup failed: {type(error).__name__}")
        raise
    observability._json_log("info", "firestore_backup_completed", **result)
    return result


def _list_backups():
    days = {}
    for item in media_storage.iter_objects(BACKUP_PREFIX):
        key = item.get("Key", "")
        day, _, name = key[len(BACKUP_PREFIX):].partition("/")
        days.setdefault(day, set()).add(name)
    for day in sorted(days):
        state = "complete" if "manifest.json" in days[day] else "INCOMPLETE"
        print(f"{day}  {state}")


def restore_backup(db, day, *, only="", apply=False, download=None):
    download = download or media_storage.download_file
    with tempfile.TemporaryDirectory(prefix="firestore-restore-") as folder:
        data_path = os.path.join(folder, "firestore.jsonl.gz")
        if not download(f"{BACKUP_PREFIX}{day}/firestore.jsonl.gz", data_path):
            raise RuntimeError(f"No backup found for {day}")
        counts, batch, written = {}, db.batch(), 0
        with gzip.open(data_path, "rt", encoding="utf-8") as handle:
            for line in handle:
                row = json.loads(line)
                path = row["path"]
                if only and not (path == only or path.startswith(only.rstrip("/") + "/")):
                    continue
                top = path.split("/", 1)[0]
                counts[top] = counts.get(top, 0) + 1
                if apply:
                    batch.set(db.document(path), decode_value(row["data"], db))
                    written += 1
                    if written % RESTORE_BATCH == 0:
                        batch.commit()
                        batch = db.batch()
        if apply and written % RESTORE_BATCH:
            batch.commit()
    return {"documents": sum(counts.values()), "by_collection": counts, "written": written}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("list", help="list backups in R2")
    commands.add_parser("backup", help="take a backup now (counts against the daily read quota)")
    restore = commands.add_parser("restore", help="restore one backup day")
    restore.add_argument("day", help="YYYY-MM-DD")
    restore.add_argument("--only", default="", help="restore only this document path or subtree, e.g. users/UID")
    restore.add_argument("--apply", action="store_true", help="write to Firestore (default is a dry run)")
    args = parser.parse_args(argv)

    if args.command == "list":
        _list_backups()
    elif args.command == "backup":
        print(json.dumps(export_backup(firebase_admin_setup.get_db()), indent=2))
    else:
        result = restore_backup(firebase_admin_setup.get_db(), args.day, only=args.only, apply=args.apply)
        print(json.dumps(result, indent=2))
        if not args.apply:
            print("Dry run: nothing was written. Add --apply to restore (each document is one write).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
