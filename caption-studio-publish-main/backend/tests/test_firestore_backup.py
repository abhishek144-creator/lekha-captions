import gzip
import json
import os
import shutil
import tempfile
import unittest
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, patch

import fakeredis
from google.cloud import firestore

from backend import firestore_backup as backup


class FakeDocRef:
    def __init__(self, path, children=()):
        self.path = path
        self._children = list(children)

    def collections(self):
        return self._children


class FakeSnapshot:
    def __init__(self, path, data, children=()):
        self.reference = FakeDocRef(path, children)
        self._data = data

    def to_dict(self):
        return self._data


class FakeCollection:
    def __init__(self, name, snapshots):
        self.id = name
        self.snapshots = snapshots

    def stream(self):
        return iter(self.snapshots)


class FakeDb:
    def __init__(self, collections):
        self._collections = {c.id: c for c in collections}

    def collections(self):
        return list(self._collections.values())

    def collection(self, name):
        return self._collections[name]


NOW = datetime(2026, 10, 27, 21, 0, tzinfo=timezone.utc)


def sample_db():
    payments = FakeCollection("payments", [FakeSnapshot("users/u1/payments/p1", {"amount": 900})])
    users = FakeCollection("users", [
        FakeSnapshot("users/u1", {"email": "a@example.com", "created": datetime(2026, 1, 2, tzinfo=timezone.utc)},
                     children=[payments]),
        FakeSnapshot("users/u2", {"email": "b@example.com"}),
    ])
    analytics = FakeCollection("analytics_events", [FakeSnapshot(f"analytics_events/e{i}", {}) for i in range(5)])
    return FakeDb([users, analytics])


class Uploads:
    def __init__(self):
        self.folder = tempfile.mkdtemp()
        self.keys = []

    def __call__(self, local_path, key, content_type):
        self.keys.append(key)
        target = os.path.join(self.folder, key.replace("/", "_"))
        shutil.copy(local_path, target)
        return True

    def rows(self, day="2026-10-27"):
        path = os.path.join(self.folder, f"backups_firestore_{day}_firestore.jsonl.gz")
        with gzip.open(path, "rt", encoding="utf-8") as handle:
            return [json.loads(line) for line in handle]


class ExportTests(unittest.TestCase):
    def test_copies_customer_data_with_subcollections_and_skips_logs(self):
        uploads = Uploads()
        result = backup.export_backup(sample_db(), now=NOW, upload=uploads,
                                      list_objects=lambda prefix: [], delete=lambda key: True)
        self.assertEqual(result["documents"], 3)
        self.assertEqual(uploads.keys, [
            "backups/firestore/2026-10-27/firestore.jsonl.gz",
            "backups/firestore/2026-10-27/manifest.json",
        ])
        rows = uploads.rows()
        self.assertEqual([row["path"] for row in rows], ["users/u1", "users/u1/payments/p1", "users/u2"])
        self.assertEqual(rows[0]["data"]["created"], {"__fs": "timestamp", "value": "2026-01-02T00:00:00+00:00"})

    def test_stops_and_raises_above_the_read_cap(self):
        with patch.dict(os.environ, {"FIRESTORE_BACKUP_MAX_DOCUMENTS": "2"}):
            with self.assertRaises(backup.BackupTooLarge):
                backup.export_backup(sample_db(), now=NOW, upload=Uploads(),
                                     list_objects=lambda prefix: [], delete=lambda key: True)

    def test_unconfigured_storage_is_a_failure(self):
        with self.assertRaises(RuntimeError):
            backup.export_backup(sample_db(), now=NOW, upload=lambda *args: False,
                                 list_objects=lambda prefix: [], delete=lambda key: True)

    def test_manifest_upload_failure_is_not_reported_as_success(self):
        with self.assertRaisesRegex(RuntimeError, "manifest"):
            backup.export_backup(sample_db(), now=NOW,
                                 upload=lambda path, key, kind: not key.endswith("manifest.json"),
                                 list_objects=lambda prefix: [], delete=lambda key: True)

    def test_prunes_backups_older_than_retention(self):
        deleted = []
        objects = [{"Key": "backups/firestore/2026-10-01/firestore.jsonl.gz"},
                   {"Key": "backups/firestore/2026-10-20/firestore.jsonl.gz"},
                   {"Key": "backups/firestore/notes.txt"}]
        removed = backup.prune_backups(NOW, list_objects=lambda prefix: objects,
                                       delete=lambda key: deleted.append(key) or True)
        self.assertEqual((removed, deleted), (1, ["backups/firestore/2026-10-01/firestore.jsonl.gz"]))


class EncodingTests(unittest.TestCase):
    def test_customer_maps_cannot_collide_with_backup_type_tags(self):
        value = {"__fs": "timestamp", "value": "customer text", "nested": {"__fs": "ref", "value": "not/a/reference"}}
        self.assertEqual(backup.decode_value(backup.encode_value(value), MagicMock()), value)

    def test_round_trip_keeps_firestore_types(self):
        client = MagicMock()
        client.document.side_effect = lambda path: firestore.DocumentReference(*path.split("/"), client=client)
        ref = firestore.DocumentReference("users", "u1", client=client)
        value = {"when": datetime(2026, 1, 2, 3, 4, tzinfo=timezone.utc), "owner": ref, "blob": b"\x00\x01",
                 "where": firestore.GeoPoint(12.9, 77.6), "nested": [{"n": 1}]}
        encoded = json.loads(json.dumps(backup.encode_value(value)))
        decoded = backup.decode_value(encoded, client)
        self.assertEqual(decoded["when"], value["when"])
        self.assertEqual(decoded["owner"].path, "users/u1")
        self.assertEqual(decoded["blob"], b"\x00\x01")
        self.assertEqual((decoded["where"].latitude, decoded["where"].longitude), (12.9, 77.6))
        self.assertEqual(decoded["nested"], [{"n": 1}])


class NightlyTests(unittest.TestCase):
    def setUp(self):
        self.redis = fakeredis.FakeRedis()

    def test_waits_for_the_night_window(self):
        early = datetime(2026, 10, 27, 10, 0, tzinfo=timezone.utc)
        self.assertEqual(backup.run_nightly(self.redis, "db", now=early, export=lambda *a, **k: 1/0),
                         {"skipped": "before_window"})

    def test_one_attempt_per_night(self):
        calls = []
        export = lambda db, **kwargs: calls.append(db) or {"documents": 3}
        first = backup.run_nightly(self.redis, "db", now=NOW, export=export)
        second = backup.run_nightly(self.redis, "db", now=NOW, export=export)
        self.assertEqual((first, second, calls), ({"documents": 3}, {"skipped": "already_attempted"}, ["db"]))

    def test_failure_alerts_and_is_not_retried_the_same_night(self):
        alerts = []

        def broken(db, **kwargs):
            raise backup.BackupTooLarge("too many")

        with self.assertRaises(backup.BackupTooLarge):
            backup.run_nightly(self.redis, "db", now=NOW, export=broken, alert=alerts.append)
        self.assertEqual(len(alerts), 1)
        self.assertEqual(backup.run_nightly(self.redis, "db", now=NOW, export=broken, alert=alerts.append),
                         {"skipped": "already_attempted"})

    def test_transient_failure_retries_after_backoff_and_shares_budget(self):
        attempts = []
        def export(db, on_document, **kwargs):
            attempts.append(1)
            on_document()
            on_document()
            if len(attempts) == 1:
                raise ConnectionError("temporary storage outage")
            return {"documents": 2}
        with patch.dict(os.environ, {"FIRESTORE_BACKUP_MAX_DOCUMENTS": "4"}):
            with self.assertRaises(ConnectionError):
                backup.run_nightly(self.redis, "db", now=NOW, export=export, alert=lambda _: None)
            self.assertEqual(backup.run_nightly(self.redis, "db", now=NOW, export=export), {"skipped": "retry_backoff"})
            result = backup.run_nightly(self.redis, "db", now=NOW + timedelta(minutes=16), export=export)
        self.assertEqual(result["documents"], 2)
        state = json.loads(self.redis.get("lekha:cron:firestore-backup:2026-10-27"))
        self.assertEqual((state["attempts"], state["documents"], state["status"]), (2, 4, "complete"))

    def test_retries_cannot_multiply_daily_document_budget(self):
        def broken(db, on_document, **kwargs):
            for _ in range(3):
                on_document()
            raise ConnectionError("storage outage")
        with patch.dict(os.environ, {"FIRESTORE_BACKUP_MAX_DOCUMENTS": "4"}):
            with self.assertRaises(ConnectionError):
                backup.run_nightly(self.redis, "db", now=NOW, export=broken, alert=lambda _: None)
            with self.assertRaises(backup.BackupTooLarge):
                backup.run_nightly(self.redis, "db", now=NOW + timedelta(minutes=16), export=broken, alert=lambda _: None)
            self.assertEqual(backup.run_nightly(self.redis, "db", now=NOW + timedelta(minutes=32), export=broken),
                             {"skipped": "already_attempted"})

    def test_concurrent_process_skips_and_crashed_process_keeps_its_reservation(self):
        key = "lekha:cron:firestore-backup:2026-10-27"
        self.redis.set(key, json.dumps({"status": "running", "attempts": 1, "reserved": 10000}))
        self.redis.set(key + ":lease", "other-process", ex=100)
        exporter = MagicMock()
        self.assertEqual(backup.run_nightly(self.redis, "db", now=NOW, export=exporter), {"skipped": "in_progress"})
        self.redis.delete(key + ":lease")
        self.assertEqual(backup.run_nightly(self.redis, "db", now=NOW, export=exporter), {"skipped": "budget_exhausted"})
        exporter.assert_not_called()
        state = json.loads(self.redis.get(key))
        self.assertEqual((state["status"], state["documents"], state["reserved"]), ("terminal", 10000, 0))

    def test_transient_attempt_limit_and_legacy_lock_are_respected(self):
        exporter = MagicMock(side_effect=ConnectionError("outage"))
        for minutes in (0, 16, 32):
            with self.assertRaises(ConnectionError):
                backup.run_nightly(self.redis, "db", now=NOW + timedelta(minutes=minutes), export=exporter, alert=lambda _: None)
        self.assertEqual(backup.run_nightly(self.redis, "db", now=NOW + timedelta(minutes=48), export=exporter), {"skipped": "budget_exhausted"})
        self.redis.set("lekha:cron:firestore-backup:2026-10-27", "1")
        self.assertEqual(backup.run_nightly(self.redis, "db", now=NOW, export=exporter), {"skipped": "already_attempted"})


class RestoreTests(unittest.TestCase):
    def setUp(self):
        self.uploads = Uploads()
        backup.export_backup(sample_db(), now=NOW, upload=self.uploads,
                             list_objects=lambda prefix: [], delete=lambda key: True)
        self.download = lambda key, local: shutil.copy(os.path.join(self.uploads.folder, key.replace("/", "_")), local) and True

    def test_corrupt_snapshot_is_rejected_before_any_write(self):
        source = os.path.join(self.uploads.folder, "backups_firestore_2026-10-27_firestore.jsonl.gz")
        with open(source, "ab") as handle:
            handle.write(b"corrupt")
        db = MagicMock()
        with self.assertRaisesRegex(ValueError, "checksum"):
            backup.restore_backup(db, "2026-10-27", apply=True, download=self.download)
        db.batch.assert_not_called()

    def test_document_count_mismatch_prevents_partial_restore(self):
        manifest = os.path.join(self.uploads.folder, "backups_firestore_2026-10-27_manifest.json")
        with open(manifest, encoding="utf-8") as handle:
            data = json.load(handle)
        data["documents"] = 999
        with open(manifest, "w", encoding="utf-8") as handle:
            json.dump(data, handle)
        db = MagicMock()
        with self.assertRaisesRegex(ValueError, "count mismatch"):
            backup.restore_backup(db, "2026-10-27", apply=True, download=self.download)
        db.batch.assert_not_called()

    def test_dry_run_writes_nothing(self):
        db = MagicMock()
        result = backup.restore_backup(db, "2026-10-27", download=self.download)
        self.assertEqual(result, {"documents": 3, "by_collection": {"users": 3}, "written": 0})
        db.batch.return_value.set.assert_not_called()

    def test_apply_restores_only_the_requested_subtree(self):
        db = MagicMock()
        result = backup.restore_backup(db, "2026-10-27", only="users/u1", apply=True, download=self.download)
        self.assertEqual(result["written"], 2)
        written = [call.args[0] for call in db.document.call_args_list]
        self.assertEqual(written, ["users/u1", "users/u1/payments/p1"])
        db.batch.return_value.commit.assert_called_once()


if __name__ == "__main__":
    unittest.main()
