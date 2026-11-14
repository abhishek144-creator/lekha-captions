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
import hashlib
import json
import os
import sys
import tempfile
import uuid
from datetime import datetime, timezone

from google.cloud import firestore
from redis.exceptions import WatchError

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
MAX_NIGHTLY_ATTEMPTS = 3
RETRY_DELAY_SECONDS = 15 * 60
LEASE_SECONDS = 30 * 60


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
        encoded = {str(key): encode_value(item) for key, item in value.items()}
        return {"__fs": "map", "value": encoded} if "__fs" in value else encoded
    if isinstance(value, (list, tuple)):
        return [encode_value(item) for item in value]
    return value


def decode_value(value, db):
    if isinstance(value, dict):
        kind = value.get("__fs")
        if kind == "map":
            return {key: decode_value(item, db) for key, item in value["value"].items()}
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


def _walk(collection, write, budget, on_document=None):
    """Streams a collection and every subcollection below it, depth first."""
    for snapshot in collection.stream():
        budget["documents"] += 1
        if budget["documents"] > budget["limit"]:
            raise BackupTooLarge(f"more than {budget['limit']} documents")
        if on_document:
            on_document()
        write({"path": snapshot.reference.path, "data": encode_value(snapshot.to_dict() or {})})
        for child in snapshot.reference.collections():
            _walk(child, write, budget, on_document)


def export_backup(db, *, now=None, upload=None, list_objects=None, delete=None,
                  on_document=None, run_id="", assert_publish=None) -> dict:
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
                _walk(db.collection(name), write, budget, on_document)
        data_key = f"{BACKUP_PREFIX}{day}/{run_id + '/' if run_id else ''}firestore.jsonl.gz"
        with open(data_path, "rb") as handle:
            digest = hashlib.file_digest(handle, "sha256").hexdigest()
        manifest = {
            "version": 2,
            "data_key": data_key,
            "sha256": digest,
            "compressed_bytes": os.path.getsize(data_path),
            "created_at": now.isoformat(),
            "documents": budget["documents"],
            "collections": included,
            "excluded": sorted(set(roots) & EXCLUDED_COLLECTIONS),
            "format": "gzip jsonl: {path, data}; tagged values {__fs: timestamp|ref|geo|bytes}",
        }
        manifest_path = os.path.join(folder, "manifest.json")
        with open(manifest_path, "w", encoding="utf-8") as handle:
            json.dump(manifest, handle, indent=2)
        if not upload(data_path, data_key, "application/gzip"):
            raise RuntimeError("R2 storage is not configured")
        # The manifest goes last: a backup folder without one is incomplete.
        if assert_publish:
            assert_publish()
        if not upload(manifest_path, f"{BACKUP_PREFIX}{day}/manifest.json", "application/json"):
            raise RuntimeError("Backup manifest upload failed")

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


def _nightly_update(connection, key, change):
    """CAS the daily state and lease together; never fall back to local state."""
    lease = key + ":lease"
    for _ in range(20):
        with connection.pipeline() as pipe:
            try:
                pipe.watch(key, lease)
                raw = pipe.get(key)
                state = json.loads(raw) if raw and raw not in (b"1", "1") else {}
                previous_state = state.copy()
                owner = pipe.get(lease)
                if isinstance(owner, bytes):
                    owner = owner.decode()
                result, next_owner = change(state, owner, raw)
                if result is not None and state == previous_state:
                    return result
                pipe.multi()
                pipe.set(key, json.dumps(state), ex=2 * 86400)
                if next_owner:
                    pipe.set(lease, next_owner, ex=LEASE_SECONDS)
                else:
                    pipe.delete(lease)
                pipe.execute()
                return result
            except WatchError:
                continue
    raise RuntimeError("Backup coordination is busy")


def run_nightly(connection, db, *, now=None, export=None, alert=None) -> dict:
    """At most three attempts/night, sharing one document budget and lease."""
    now = now or datetime.now(timezone.utc)
    if now.hour < 20:
        return {"skipped": "before_window"}
    key = f"lekha:cron:firestore-backup:{now:%Y-%m-%d}"
    run_id = uuid.uuid4().hex

    def claim(state, owner, raw):
        if raw in (b"1", "1") or state.get("status") in ("complete", "terminal"):
            return "already_attempted", owner
        if owner:
            return "in_progress", owner
        if state.get("status") == "running":
            state["documents"] = state.get("documents", 0) + state.get("reserved", 0)
            state["reserved"] = 0
        if state.get("attempts", 0) >= MAX_NIGHTLY_ATTEMPTS or state.get("documents", 0) >= _max_documents():
            state["status"] = "terminal"
            return "budget_exhausted", None
        if now.timestamp() < state.get("retry_after", 0):
            return "retry_backoff", None
        # Reserve the remaining budget before starting. A process killed before
        # it reports usage cannot turn its unknown reads into a free retry.
        state.update(attempts=state.get("attempts", 0) + 1, status="running",
                     reserved=_max_documents() - state.get("documents", 0))
        return None, run_id

    skipped = _nightly_update(connection, key, claim)
    if skipped:
        return {"skipped": skipped}
    used = 0

    def assert_owner():
        value = connection.get(key + ":lease")
        if value not in (run_id, run_id.encode()):
            raise RuntimeError("Backup lease was lost")
        connection.expire(key + ":lease", LEASE_SECONDS)

    state = json.loads(connection.get(key))
    remaining = state["reserved"]

    def charge_document():
        nonlocal used
        assert_owner()
        if used >= remaining:
            raise BackupTooLarge("Nightly document budget exhausted across retries")
        used += 1

    def finish(status):
        def update(state, owner, raw):
            if owner != run_id:
                raise RuntimeError("Backup lease was lost")
            state.update(status=status, documents=state.get("documents", 0) + used,
                         reserved=0, retry_after=now.timestamp() + RETRY_DELAY_SECONDS)
            return None, None
        _nightly_update(connection, key, update)
    try:
        result = (export or export_backup)(db, now=now, on_document=charge_document,
                                          run_id=run_id, assert_publish=assert_owner)
        finish("complete")
    except Exception as error:
        try:
            finish("terminal" if isinstance(error, BackupTooLarge) else "retry")
        except Exception:
            # Keep the reservation charged after an uncertain/crashed attempt.
            # Losing Redis must never permit a second unbudgeted export.
            observability._json_log("error", "firestore_backup_coordination_failed")
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
    datetime.strptime(day, "%Y-%m-%d")
    with tempfile.TemporaryDirectory(prefix="firestore-restore-") as folder:
        data_path = os.path.join(folder, "firestore.jsonl.gz")
        manifest_path = os.path.join(folder, "manifest.json")
        if not download(f"{BACKUP_PREFIX}{day}/manifest.json", manifest_path):
            raise RuntimeError("Backup is incomplete: no manifest")
        with open(manifest_path, encoding="utf-8") as handle:
            manifest = json.load(handle)
        prefix = f"{BACKUP_PREFIX}{day}/"
        data_key = manifest.get("data_key", prefix + "firestore.jsonl.gz")
        if not isinstance(data_key, str) or not data_key.startswith(prefix) or ".." in data_key.split("/"):
            raise ValueError("Invalid backup data key")
        if not download(data_key, data_path):
            raise RuntimeError(f"No backup found for {day}")
        if manifest.get("version", 1) >= 2:
            with open(data_path, "rb") as handle:
                digest = hashlib.file_digest(handle, "sha256").hexdigest()
            if digest != manifest.get("sha256") or os.path.getsize(data_path) != manifest.get("compressed_bytes"):
                raise ValueError("Backup checksum or size mismatch")
        # Validate the entire snapshot, including decoding tagged values, before
        # any batch is committed. A broken late row must not partially restore.
        total = 0
        paths = set()
        with gzip.open(data_path, "rt", encoding="utf-8") as handle:
            for line in handle:
                row = json.loads(line)
                parts = row["path"].split("/")
                if len(parts) % 2 or any(not part for part in parts) or row["path"] in paths:
                    raise ValueError("Invalid or duplicate document path")
                if not isinstance(row["data"], dict):
                    raise ValueError("Invalid document data")
                decode_value(row["data"], db)
                paths.add(row["path"])
                total += 1
        if total != manifest.get("documents"):
            raise ValueError("Backup document count mismatch")
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
