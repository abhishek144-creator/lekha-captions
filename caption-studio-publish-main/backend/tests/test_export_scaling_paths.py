import asyncio
import json
from pathlib import Path
import sys
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

import fakeredis

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import main


PAYLOAD = {
    "file_id": "123e4567-e89b-12d3-a456-426614174000",
    "captions": [{"id": "1", "text": "hello", "start_time": 0, "end_time": 1}],
}


class ExportSlotWaitTests(unittest.TestCase):
    def setUp(self):
        self.redis = fakeredis.FakeRedis(decode_responses=True)

    def test_batch_item_waits_for_account_slot_without_spending_failure_retries(self):
        core = AsyncMock()
        with (patch.object(main.app_state, "_redis_client", self.redis), patch.object(main.firebase_admin_setup, "get_db", return_value=None),
              patch.object(main.app_state, "_export_queue", None), patch.object(main, "_process_export_job_core", core),
              patch.object(main, "_write_dead_letter") as dead_letter,
              patch("rq.get_current_job", return_value=SimpleNamespace(id="item-2"))):
            self.redis.set("expactive:a", "item-1")
            main._set_export_job("item-1", "queued", uid="a")
            main._set_export_job("item-2", "queued", uid="a")
            result = main.run_export_job_task("item-2", PAYLOAD, "a")
            self.assertIsInstance(result, main.RQRetry)
            self.assertEqual(result.intervals, [main.settings.EXPORT_SLOT_WAIT_INTERVAL_SECONDS])
            self.assertEqual(main._load_export_job("item-2")["status"], "retrying")
            # The rescheduled attempt starts normally once the slot is free.
            self.redis.delete("expactive:a")
            core.return_value = {"success": True}
            self.assertEqual(main.run_export_job_task("item-2", PAYLOAD, "a"), {"success": True})
        core.assert_awaited_once()
        dead_letter.assert_not_called()

    def test_slot_conflict_outside_rq_still_fails_loudly(self):
        with (patch.object(main.app_state, "_redis_client", self.redis), patch.object(main.firebase_admin_setup, "get_db", return_value=None),
              patch.object(main.app_state, "_export_queue", None), patch.object(main, "_write_dead_letter"),
              patch("rq.get_current_job", return_value=None)):
            self.redis.set("expactive:a", "other")
            main._set_export_job("solo", "queued", uid="a")
            with self.assertRaises(RuntimeError):
                main.run_export_job_task("solo", PAYLOAD, "a")


class DurableSnapshotTests(unittest.TestCase):
    def test_request_snapshot_stays_out_of_redis_when_firestore_holds_it(self):
        redis_client = fakeredis.FakeRedis(decode_responses=True)
        persisted = []
        with (patch.object(main.app_state, "_redis_client", redis_client), patch.object(main.firebase_admin_setup, "get_db", return_value=object()),
              patch.object(main, "_persist_export_job", side_effect=lambda job_id, payload, **_: persisted.append(payload) or True)):
            main._set_export_job("big", "queued", uid="a", request_snapshot={"captions": ["x" * 1000]})
            main._set_export_job("big", "starting")
        stored = json.loads(redis_client.get("export_job:big"))
        self.assertNotIn("request_snapshot", stored)
        self.assertEqual(stored["status"], "starting")
        self.assertEqual(persisted[0]["request_snapshot"], {"captions": ["x" * 1000]})
        self.assertNotIn("request_snapshot", persisted[1])

    def test_local_job_cache_is_bounded(self):
        cache = main.app_state._BoundedJobCache(3)
        for index in range(5):
            cache[str(index)] = {"status": "queued"}
        self.assertEqual(list(cache), ["2", "3", "4"])


class NonBlockingSubmissionTests(unittest.TestCase):
    def test_export_enqueue_wakes_workers_off_the_request_path(self):
        queue = SimpleNamespace(connection=object(), name="caption_export_jobs")
        with (patch.object(main.settings, "_IS_PRODUCTION", True),
              patch.object(main, "enqueue_bounded_across_queues", return_value="delivery"),
              patch.object(main.worker_launcher, "kick") as blocking_kick,
              patch.object(main.worker_launcher, "kick_in_background") as background_kick):
            self.assertEqual(main._enqueue_export_job(queue, job_id="job"), "delivery")
        blocking_kick.assert_not_called()
        background_kick.assert_called_once_with(queue.connection, queue.name)

    def test_export_submission_runs_blocking_helpers_in_threads(self):
        threads = []
        real_to_thread = asyncio.to_thread

        async def tracking_to_thread(function, *args, **kwargs):
            threads.append(getattr(function, "__name__", repr(function)))
            return await real_to_thread(function, *args, **kwargs)

        request = main.ExportRequest(**PAYLOAD)
        from starlette.requests import Request
        with (patch.object(main.asyncio, "to_thread", tracking_to_thread),
              patch.object(main.settings, "_IS_PRODUCTION", True), patch.object(main.app_state, "_export_queue", None),
              patch.object(main, "_assert_service_available"), patch.object(main.observability, "_track_event"),
              patch.object(main, "_authenticate_media_request", Mock(return_value={"uid": "owner"}, __name__="auth"))):
            with self.assertRaises(main.HTTPException):
                asyncio.run(main.export_video(request, Request({"type": "http", "headers": []}), main.Response()))
        self.assertIn("auth", threads)


if __name__ == "__main__":
    unittest.main()
