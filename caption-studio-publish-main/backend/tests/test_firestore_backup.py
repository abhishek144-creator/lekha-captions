import gzip
import json
import os
import shutil
import tempfile
import unittest
from datetime import datetime, timezone
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

    def test_prunes_backups_older_than_retention(self):
        deleted = []
        objects = [{"Key": "backups/firestore/2026-10-01/firestore.jsonl.gz"},
                   {"Key": "backups/firestore/2026-10-20/firestore.jsonl.gz"},
                   {"Key": "backups/firestore/notes.txt"}]
        removed = backup.prune_backups(NOW, list_objects=lambda prefix: objects,
                                       delete=lambda key: deleted.append(key) or True)
        self.assertEqual((removed, deleted), (1, ["backups/firestore/2026-10-01/firestore.jsonl.gz"]))


class EncodingTests(unittest.TestCase):
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
        export = lambda db, now: calls.append(db) or {"documents": 3}
        first = backup.run_nightly(self.redis, "db", now=NOW, export=export)
        second = backup.run_nightly(self.redis, "db", now=NOW, export=export)
        self.assertEqual((first, second, calls), ({"documents": 3}, {"skipped": "already_attempted"}, ["db"]))

    def test_failure_alerts_and_is_not_retried_the_same_night(self):
        alerts = []

        def broken(db, now):
            raise backup.BackupTooLarge("too many")

        with self.assertRaises(backup.BackupTooLarge):
            backup.run_nightly(self.redis, "db", now=NOW, export=broken, alert=alerts.append)
        self.assertEqual(len(alerts), 1)
        self.assertEqual(backup.run_nightly(self.redis, "db", now=NOW, export=broken, alert=alerts.append),
                         {"skipped": "already_attempted"})


class RestoreTests(unittest.TestCase):
    def setUp(self):
        self.uploads = Uploads()
        backup.export_backup(sample_db(), now=NOW, upload=self.uploads,
                             list_objects=lambda prefix: [], delete=lambda key: True)
        source = os.path.join(self.uploads.folder, "backups_firestore_2026-10-27_firestore.jsonl.gz")
        self.download = lambda key, local: shutil.copy(source, local) and True

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
