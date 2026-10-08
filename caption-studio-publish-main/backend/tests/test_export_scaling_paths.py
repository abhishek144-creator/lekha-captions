import asyncio
import json
from pathlib import Path
import sys
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

import fakeredis

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from backend.application import runtime as backend_context


PAYLOAD = {
    "file_id": "123e4567-e89b-12d3-a456-426614174000",
    "captions": [{"id": "1", "text": "hello", "start_time": 0, "end_time": 1}],
}


class ExportSlotWaitTests(unittest.TestCase):
    def setUp(self):
        self.redis = fakeredis.FakeRedis(decode_responses=True)

    def test_batch_item_waits_for_account_slot_without_spending_failure_retries(self):
        core = AsyncMock()
        with (patch.object(backend_context, "_redis_client", self.redis), patch.object(backend_context, "get_db", return_value=None),
              patch.object(backend_context, "_export_queue", None), patch.object(backend_context, "_process_export_job_core", core),
              patch.object(backend_context, "_write_dead_letter") as dead_letter,
              patch("rq.get_current_job", return_value=SimpleNamespace(id="item-2"))):
            self.redis.set("expactive:a", "item-1")
            backend_context._set_export_job("item-1", "queued", uid="a")
            backend_context._set_export_job("item-2", "queued", uid="a")
            result = backend_context.run_export_job_task("item-2", PAYLOAD, "a")
            self.assertIsInstance(result, backend_context.RQRetry)
            self.assertEqual(result.intervals, [backend_context.EXPORT_SLOT_WAIT_INTERVAL_SECONDS])
            self.assertEqual(backend_context._load_export_job("item-2")["status"], "retrying")
            # The rescheduled attempt starts normally once the slot is free.
            self.redis.delete("expactive:a")
            core.return_value = {"success": True}
            self.assertEqual(backend_context.run_export_job_task("item-2", PAYLOAD, "a"), {"success": True})
        core.assert_awaited_once()
        dead_letter.assert_not_called()

    def test_slot_conflict_outside_rq_still_fails_loudly(self):
        with (patch.object(backend_context, "_redis_client", self.redis), patch.object(backend_context, "get_db", return_value=None),
              patch.object(backend_context, "_export_queue", None), patch.object(backend_context, "_write_dead_letter"),
              patch("rq.get_current_job", return_value=None)):
            self.redis.set("expactive:a", "other")
            backend_context._set_export_job("solo", "queued", uid="a")
            with self.assertRaises(RuntimeError):
                backend_context.run_export_job_task("solo", PAYLOAD, "a")


class DurableSnapshotTests(unittest.TestCase):
    def test_request_snapshot_stays_out_of_redis_when_firestore_holds_it(self):
        redis_client = fakeredis.FakeRedis(decode_responses=True)
        persisted = []
        with (patch.object(backend_context, "_redis_client", redis_client), patch.object(backend_context, "get_db", return_value=object()),
              patch.object(backend_context, "_persist_export_job", side_effect=lambda job_id, payload, **_: persisted.append(payload) or True)):
            backend_context._set_export_job("big", "queued", uid="a", request_snapshot={"captions": ["x" * 1000]})
            backend_context._set_export_job("big", "starting")
        stored = json.loads(redis_client.get("export_job:big"))
        self.assertNotIn("request_snapshot", stored)
        self.assertEqual(stored["status"], "starting")
        self.assertEqual(persisted[0]["request_snapshot"], {"captions": ["x" * 1000]})
        self.assertNotIn("request_snapshot", persisted[1])

    def test_local_job_cache_is_bounded(self):
        cache = backend_context._BoundedJobCache(3)
        for index in range(5):
            cache[str(index)] = {"status": "queued"}
        self.assertEqual(list(cache), ["2", "3", "4"])


class NonBlockingSubmissionTests(unittest.TestCase):
    def test_export_enqueue_wakes_workers_off_the_request_path(self):
        queue = SimpleNamespace(connection=object(), name="caption_export_jobs")
        with (patch.object(backend_context, "_IS_PRODUCTION", True),
              patch.object(backend_context, "enqueue_bounded_across_queues", return_value="delivery"),
              patch.object(backend_context.worker_launcher, "kick") as blocking_kick,
              patch.object(backend_context.worker_launcher, "kick_in_background") as background_kick):
            self.assertEqual(backend_context._enqueue_export_job(queue, job_id="job"), "delivery")
        blocking_kick.assert_not_called()
        background_kick.assert_called_once_with(queue.connection, queue.name)

    def test_export_submission_runs_blocking_helpers_in_threads(self):
        threads = []
        real_to_thread = asyncio.to_thread

        async def tracking_to_thread(function, *args, **kwargs):
            threads.append(getattr(function, "__name__", repr(function)))
            return await real_to_thread(function, *args, **kwargs)

        request = backend_context.ExportRequest(**PAYLOAD)
        from starlette.requests import Request
        with (patch.object(backend_context.asyncio, "to_thread", tracking_to_thread),
              patch.object(backend_context, "_IS_PRODUCTION", True), patch.object(backend_context, "_export_queue", None),
              patch.object(backend_context, "_assert_service_available"), patch.object(backend_context, "_track_event"),
              patch.object(backend_context, "_authenticate_media_request", Mock(return_value={"uid": "owner"}, __name__="auth"))):
            with self.assertRaises(backend_context.HTTPException):
                asyncio.run(backend_context.export_video(request, Request({"type": "http", "headers": []}), backend_context.Response()))
        self.assertIn("auth", threads)


if __name__ == "__main__":
    unittest.main()
