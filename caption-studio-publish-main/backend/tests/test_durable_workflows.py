import copy
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import sys
import threading
import time
from types import SimpleNamespace
import unittest
from unittest.mock import patch, AsyncMock, Mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi import HTTPException
from fastapi.testclient import TestClient
from transcription_jobs import TranscriptionJobs
from drafts import normalize_draft, read_draft, save_draft
import main


class MemoryDatabase:
    """Serial transaction model: behavioral tests, not Firestore contention proof."""
    def __init__(self):
        self.data = {"users/a": {"uid": "a"}, "users/b": {"uid": "b"}}
        self.lock = threading.RLock()
    def collection(self, name): return Ref(self, name)
    def transaction(self): return Tx(self)
    def transactional(self, fn):
        def run(tx):
            with self.lock:
                snapshot = copy.deepcopy(self.data)
                try: return fn(tx)
                except BaseException:
                    self.data = snapshot
                    raise
        return run


class Ref:
    def __init__(self, db, path): self.db, self.path = db, path
    def document(self, name): return Ref(self.db, self.path + "/" + name)
    def collection(self, name): return self.document(name)
    def get(self, **_):
        data = copy.deepcopy(self.db.data.get(self.path))
        return SimpleNamespace(exists=data is not None, to_dict=lambda: data, reference=self)
    def set(self, data): self.db.data[self.path] = copy.deepcopy(data)
    def update(self, data):
        for key, value in data.items():
            if isinstance(value, main.firestore.Increment): value = self.db.data[self.path].get(key, 0) + value.value
            self.db.data[self.path][key] = value
    def delete(self): self.db.data.pop(self.path, None)
    def limit(self, _): return self
    def stream(self):
        return iter([Ref(self.db, key).get() for key in list(self.db.data)
                     if key.startswith(self.path + "/") and key.count("/") == self.path.count("/") + 1])


class Tx:
    def __init__(self, db): self.db = db
    def create(self, ref, data):
        if ref.path in self.db.data: raise RuntimeError("already exists")
        ref.set(data)
    def set(self, ref, data): ref.set(data)
    def update(self, ref, data): ref.update(data)
    def delete(self, ref): ref.delete()


class DurableWorkflowTests(unittest.TestCase):
    def setUp(self):
        self.db = MemoryDatabase()
        self.patch = patch.object(main.firestore, "transactional", self.db.transactional)
        self.patch.start()
        self.addCleanup(self.patch.stop)
        self.jobs = TranscriptionJobs(self.db)
        self.settings = {"file_id": "123e4567-e89b-12d3-a456-426614174000", "language": "English", "min_words": 0, "max_words": 0}
        self.draft = {"fileId": self.settings["file_id"], "captions": [{"text": "hello"}], "settings": {}}

    def test_concurrent_creation_has_one_durable_intent_and_outbox(self):
        with ThreadPoolExecutor(16) as pool:
            results = list(pool.map(lambda _: self.jobs.create("a", self.settings), range(32)))
        self.assertEqual(len({r["job_id"] for r in results}), 1)
        self.assertEqual(len([k for k in self.db.data if k.startswith("transcription_outbox/")]), 1)

    def test_changed_settings_cannot_queue_second_operation_for_account(self):
        self.jobs.create("a", self.settings)
        with self.assertRaises(HTTPException): self.jobs.create("a", {**self.settings, "language": "Hindi"})

    def test_duplicate_delivery_claims_once(self):
        job = self.jobs.create("a", self.settings)
        with ThreadPoolExecutor(16) as pool:
            results = list(pool.map(lambda _: self.jobs.claim("a", job["job_id"]), range(32)))
        self.assertEqual(sum(result is not None for result in results), 1)

    def test_queue_outage_leaves_durable_dispatchable_intent(self):
        job = self.jobs.create("a", self.settings)
        failing_queue = SimpleNamespace(enqueue=lambda *_args, **_kwargs: (_ for _ in ()).throw(ConnectionError()))
        with self.assertRaises(ConnectionError): self.jobs.dispatch(failing_queue)
        self.assertEqual(self.jobs.get("a", job["job_id"])["status"], "queued")
        with patch("transcription_jobs.time.time", return_value=time.time() + 31):
            with patch.object(failing_queue, "enqueue", return_value=SimpleNamespace(id="delivery-1")) as enqueue:
                self.jobs.dispatch(failing_queue)
                enqueue.assert_called_once()

    def test_healthy_queue_wait_does_not_duplicate_or_fail_transcription(self):
        job = self.jobs.create("a", self.settings)
        delivery = SimpleNamespace(id="delivery-1", get_status=lambda **_: "queued")
        queue = SimpleNamespace(enqueue=Mock(return_value=delivery), fetch_job=Mock(return_value=delivery))
        started = time.time()
        for cycle in range(21):
            with patch("transcription_jobs.time.time", return_value=started + cycle * 31):
                self.jobs.dispatch(queue)
        self.assertEqual(self.jobs.get("a", job["job_id"])["status"], "queued")
        queue.enqueue.assert_called_once()
        self.assertIsNotNone(self.jobs.claim("a", job["job_id"]))

    def test_lost_queue_delivery_can_be_dispatched_again_before_claim(self):
        job = self.jobs.create("a", self.settings)
        delivery = SimpleNamespace(id="delivery-1", get_status=lambda **_: "queued")
        queue = SimpleNamespace(enqueue=Mock(return_value=delivery), fetch_job=Mock(return_value=None))
        self.jobs.dispatch(queue)
        with patch("transcription_jobs.time.time", return_value=time.time() + 31):
            self.jobs.dispatch(queue)
        self.assertEqual(queue.enqueue.call_count, 2)
        self.assertEqual(self.jobs.get("a", job["job_id"])["status"], "queued")

    def test_queue_probe_failure_keeps_job_and_does_not_enqueue_blindly(self):
        job = self.jobs.create("a", self.settings)
        delivery = SimpleNamespace(id="delivery-1")
        queue = SimpleNamespace(enqueue=Mock(return_value=delivery), fetch_job=Mock(side_effect=ConnectionError()))
        self.jobs.dispatch(queue)
        with patch("transcription_jobs.time.time", return_value=time.time() + 31):
            with self.assertRaises(ConnectionError):
                self.jobs.dispatch(queue)
        queue.enqueue.assert_called_once()
        self.assertEqual(self.jobs.get("a", job["job_id"])["status"], "queued")

    def test_exhausted_dispatch_does_not_fail_a_concurrent_worker_claim(self):
        job = self.jobs.create("a", self.settings)
        pointer = self.jobs.refs("a", job["job_id"])[2]
        pointer.update({"attempts": 10, "rq_job_id": "lost-delivery"})
        def probe(_):
            self.jobs.claim("a", job["job_id"])
            return None
        queue = SimpleNamespace(fetch_job=probe, enqueue=Mock())
        self.jobs.dispatch(queue)
        self.assertEqual(self.jobs.get("a", job["job_id"])["status"], "running")
        queue.enqueue.assert_not_called()

    def test_crash_after_claim_becomes_unknown_without_replaying_provider(self):
        job = self.jobs.create("a", self.settings)
        self.jobs.claim("a", job["job_id"])
        with patch("transcription_jobs.time.time", return_value=time.time() + 2200):
            queue = SimpleNamespace(enqueue=lambda *_a, **_k: self.fail("uncertain call replayed"))
            self.jobs.dispatch(queue)
        self.assertEqual(self.jobs.get("a", job["job_id"])["status"], "unknown")
        self.assertIsNone(self.jobs.claim("a", job["job_id"]))
        self.assertEqual(self.jobs.create("a", self.settings)["status"], "unknown")

    def test_completed_result_survives_new_store_and_duplicate_worker(self):
        job = self.jobs.create("a", self.settings)
        with (patch.object(main, "get_db", return_value=self.db), patch.object(main, "_assert_account_not_deleting"),
              patch.object(main, "_process_video_inline", new_callable=AsyncMock, return_value={"success": True, "captions": [{"text": "result"}]}) as provider):
            main.run_transcription_job_task("a", job["job_id"])
            main.run_transcription_job_task("a", job["job_id"])
            self.assertEqual(provider.call_count, 1)
        recovered = TranscriptionJobs(self.db).create("a", self.settings)
        self.assertEqual(recovered["payload"]["captions"][0]["text"], "result")

    def test_result_persistence_retry_does_not_repeat_provider(self):
        job = self.jobs.create("a", self.settings)
        finish = TranscriptionJobs.finish
        calls = []
        def flaky(instance, *args, **kwargs):
            calls.append(1)
            if len(calls) == 1: raise ConnectionError()
            return finish(instance, *args, **kwargs)
        with (patch.object(main, "get_db", return_value=self.db), patch.object(main, "_assert_account_not_deleting"),
              patch.object(main.time, "sleep"), patch.object(TranscriptionJobs, "finish", new=flaky),
              patch.object(main, "_process_video_inline", new_callable=AsyncMock, return_value={"success": True}) as provider):
            main.run_transcription_job_task("a", job["job_id"])
            self.assertEqual(provider.call_count, 1)
        self.assertEqual(len(calls), 2)

    def test_deleted_account_cannot_claim_or_publish_captions(self):
        job = self.jobs.create("a", self.settings)
        self.db.data["account_deletions/a"] = {"status": "pending"}
        self.assertIsNone(self.jobs.claim("a", job["job_id"]))
        self.assertEqual(self.jobs.get("a", job["job_id"])["status"], "cancelled")

    def test_result_cannot_resurrect_a_deleted_user_subtree(self):
        job = self.jobs.create("a", self.settings)
        self.jobs.claim("a", job["job_id"])
        self.db.data = {"account_deletions/a": {"status": "pending"}}
        self.assertFalse(self.jobs.finish("a", job["job_id"], "completed", {"captions": []}))
        self.assertFalse(any(k.startswith("users/a") for k in self.db.data))

    def test_jobs_are_account_scoped(self):
        job = self.jobs.create("a", self.settings)
        self.assertIsNone(self.jobs.get("b", job["job_id"]))

    def test_production_http_returns_pending_then_replays_durable_result(self):
        with (patch.object(main, "_IS_PRODUCTION", True), patch.object(main, "get_db", return_value=self.db),
              patch.object(main, "_assert_service_available"), patch.object(main, "_assert_upload_owner"),
              patch.object(main, "_authenticate_media_request", return_value={"uid": "a"})):
            client = TestClient(main.app)
            first = client.post("/api/process", json=self.settings)
            self.assertEqual(first.status_code, 202)
            self.assertTrue(first.json()["pending"])
            job_id = first.json()["job_id"]
            self.jobs.claim("a", job_id)
            self.jobs.finish("a", job_id, "completed", {"success": True, "captions": [{"text": "durable"}]})
            second = client.post("/api/process", json=self.settings)
            self.assertEqual(second.status_code, 200)
            self.assertEqual(second.json()["captions"][0]["text"], "durable")

    def test_unknown_http_result_is_terminal_not_retryable_pending(self):
        job = self.jobs.create("a", self.settings)
        self.jobs.claim("a", job["job_id"])
        self.jobs.finish("a", job["job_id"], "unknown")
        with (patch.object(main, "_IS_PRODUCTION", True), patch.object(main, "get_db", return_value=self.db),
              patch.object(main, "_assert_service_available"), patch.object(main, "_assert_upload_owner"),
              patch.object(main, "_authenticate_media_request", return_value={"uid": "a"})):
            response = TestClient(main.app).post("/api/process", json=self.settings)
            self.assertEqual(response.status_code, 409)
            self.assertNotIn("PROCESS_IN_PROGRESS", response.text)

    def test_draft_duplicate_receipt_does_not_increment_revision(self):
        self.assertEqual(save_draft(self.db, "a", self.draft, 0)["revision"], 1)
        self.assertEqual(save_draft(self.db, "a", self.draft, 0)["revision"], 1)

    def test_concurrent_draft_save_rejects_stale_overwrite(self):
        def save(index):
            try:
                save_draft(self.db, "a", {**self.draft, "duration": index}, 0)
                return True
            except HTTPException: return False
        with ThreadPoolExecutor(2) as pool:
            self.assertEqual(sum(pool.map(save, [1, 2])), 1)

    def test_drafts_survive_browser_loss_and_keep_five_recovery_revisions(self):
        for index in range(9): save_draft(self.db, "a", {**self.draft, "duration": index}, index)
        self.assertEqual(read_draft(self.db, "a")["revision"], 9)
        self.assertEqual(len([k for k in self.db.data if k.startswith("users/a/draft_revisions/")]), 5)
        self.assertIsNone(read_draft(self.db, "b")["draft"])

    def test_draft_save_cannot_recreate_deleted_account(self):
        self.db.data["account_deletions/a"] = {"status": "pending"}
        with self.assertRaises(HTTPException): save_draft(self.db, "a", self.draft, 0)
        self.assertIsNone(read_draft(self.db, "a")["draft"])

    def test_draft_drops_bearer_urls_and_rejects_unbounded_or_invalid_data(self):
        draft = normalize_draft({**self.draft, "videoUrl": "secret", "id_token": "secret", "settings": {"preUploadedRawUrl": "secret"}})
        self.assertNotIn("secret", str(draft))
        for invalid in [{**self.draft, "captions": [{}] * 501}, {**self.draft, "duration": float("nan")}, {**self.draft, "settings": "bad"}]:
            with self.assertRaises(HTTPException): normalize_draft(invalid)
