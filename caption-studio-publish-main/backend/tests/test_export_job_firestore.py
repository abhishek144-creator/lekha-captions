import json
import os
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import fakeredis

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import main
from job_state import (
    PACKED_SNAPSHOT_FIELD,
    InvalidJobTransition,
    from_stored,
    snapshot_fits,
    to_stored,
    transition_firestore,
)


class FakeFirestore:
    """Just enough Firestore for one-document transactions."""

    def __init__(self, fail=False):
        self.docs = {}
        self.fail = fail

    def collection(self, _name):
        return self

    def document(self, doc_id):
        db = self

        class Ref:
            id = doc_id

            def get(self, transaction=None):
                if db.fail:
                    raise RuntimeError("firestore down")
                data = db.docs.get(doc_id)
                return SimpleNamespace(exists=data is not None, to_dict=lambda: dict(data or {}))

        return Ref()

    def transaction(self):
        return SimpleNamespace(set=lambda ref, data: self.docs.__setitem__(ref.id, dict(data)))


def no_retry(fn):
    return fn


class TransitionFirestoreTests(unittest.TestCase):
    def setUp(self):
        self.db = FakeFirestore()
        self.ref = self.db.document("job")

    def step(self, update, expected_status=None):
        return transition_firestore(self.ref, no_retry, self.db.transaction(), {}, update,
                                    expected_status=expected_status)

    def test_state_machine_and_revisions(self):
        self.step({"status": "queued", "uid": "a"})
        result = self.step({"status": "starting"})
        self.assertEqual((result["status"], result["revision"], result["uid"]), ("starting", 2, "a"))

    def test_terminal_and_cancelled_jobs_cannot_be_resurrected(self):
        self.step({"status": "queued"})
        self.step({"status": "cancelled"})
        with self.assertRaises(InvalidJobTransition):
            self.step({"status": "starting"})
        self.assertEqual(self.db.docs["job"]["status"], "cancelled")

    def test_conditional_write_loses_to_a_newer_state(self):
        self.step({"status": "queued"})
        self.step({"status": "starting"})
        with self.assertRaises(InvalidJobTransition):
            self.step({"status": "failed"}, expected_status="queued")
        self.assertEqual(self.db.docs["job"]["status"], "starting")

    def test_snapshot_is_stored_compressed_and_round_trips_empty_arrays(self):
        snapshot = {"captions": [{"words": [], "word_styles": {}}], "style": {"x": []}}
        self.step({"status": "queued", "request_snapshot": snapshot})
        stored = self.db.docs["job"]
        self.assertNotIn("request_snapshot", stored)
        self.assertIsInstance(stored[PACKED_SNAPSHOT_FIELD], bytes)
        result = self.step({"status": "starting"})
        self.assertEqual(result["request_snapshot"], snapshot)

    def test_legacy_uncompressed_records_still_load(self):
        record = {"status": "failed", "request_snapshot": {"file_id": "f"}}
        self.assertEqual(from_stored(record), record)
        self.assertEqual(from_stored(to_stored(record)), record)

    def test_oversized_snapshot_is_rejected_up_front(self):
        self.assertTrue(snapshot_fits({"captions": [{"text": "hello " * 50_000}]}))
        self.assertFalse(snapshot_fits({"blob": os.urandom(1_200_000).hex()}))


class SetExportJobTests(unittest.TestCase):
    def test_firestore_is_the_only_record_and_beats_a_stale_redis_copy(self):
        db = FakeFirestore()
        redis = fakeredis.FakeRedis()
        redis.set("export_job:job", json.dumps({"status": "queued", "revision": 1}))
        with (
            patch.object(main, "get_db", return_value=db),
            patch.object(main, "_redis_client", redis),
            patch.object(main.firestore, "transactional", new=no_retry),
            patch.dict(main._export_jobs, {}, clear=True),
        ):
            main._set_export_job("job", "queued", uid="owner")
            main._set_export_job("job", "cancelled")
            main._export_jobs.clear()
            self.assertEqual(main._load_export_job("job")["status"], "cancelled")
        self.assertEqual(json.loads(redis.get("export_job:job"))["status"], "queued", "Redis is no longer written")

    def test_firestore_outage_fails_loudly_instead_of_keeping_a_local_copy(self):
        with (
            patch.object(main, "get_db", return_value=FakeFirestore(fail=True)),
            patch.object(main.firestore, "transactional", new=no_retry),
            patch.dict(main._export_jobs, {}, clear=True),
        ):
            with self.assertRaises(RuntimeError):
                main._set_export_job("job", "queued", uid="owner")
            self.assertNotIn("job", main._export_jobs)


if __name__ == "__main__":
    unittest.main()
