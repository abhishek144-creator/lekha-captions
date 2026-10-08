"""Fault injection for export admission, billing recovery and scratch leases."""
import asyncio
import os
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from contextlib import ExitStack
from pathlib import Path
from types import ModuleType, SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

from fastapi import Request, Response, HTTPException
from backend import main, media_storage
from backend.export_api import create_export_router
from backend.render_scratch import RenderScratch, STALE_SECONDS, sweep_render_scratch

FILE_ID = "123e4567-e89b-12d3-a456-426614174000"



def _owner(name):
    """The backend module the API reads `name` from (main until it moves out)."""
    backend_dir = os.path.dirname(main.__file__)
    for value in vars(main).values():
        if (isinstance(value, ModuleType) and name in vars(value)
                and os.path.dirname(getattr(value, "__file__", "") or "") == backend_dir):
            return value
    return main

class MemoryRef:
    def __init__(self, data, path=()):
        self.data, self.path = data, path

    def collection(self, name):
        return MemoryRef(self.data, (*self.path, name))

    def document(self, name):
        return MemoryRef(self.data, (*self.path, name))

    def get(self, **kwargs):
        value = self.data.get(self.path)
        return SimpleNamespace(exists=value is not None, to_dict=lambda: dict(value or {}))

    def transaction(self):
        return SimpleNamespace(
            create=lambda ref, value: self.data.__setitem__(ref.path, dict(value)),
            update=lambda ref, value: self.data[ref.path].update(value),
        )


class ExportReliabilityTests(unittest.TestCase):
    def test_interrupted_processing_is_conditionally_reopened_for_rq_retry(self):
        with patch.object(main.export_jobs, "_load_export_job", return_value={"status": "processing"}), patch.object(main.export_jobs, "_set_export_job") as write:
            main.recover_interrupted_export_retry("crashed")
        write.assert_called_once_with("crashed", "retrying", expected_status="processing",
                                      error="Worker interrupted; export will retry")

    def test_interrupted_retry_preserves_paid_and_terminal_results(self):
        for status in ("completed", "cancelled", "failed", "retrying", "queued", "finalizing"):
            with self.subTest(status=status), patch.object(main.export_jobs, "_load_export_job", return_value={"status": status, "uid": "owner", "file_id": FILE_ID}), patch.object(main.export_jobs, "_load_recorded_export_result", return_value={"success": True}), patch.object(main.export_jobs, "_set_export_job") as write:
                main.recover_interrupted_export_retry("crashed")
                write.assert_not_called()

    def test_slow_auth_queue_and_wake_do_not_block_loop_or_exceed_admission_limit(self):
        active = 0
        maximum = 0
        lock = threading.Lock()

        def authenticate(*args):
            nonlocal active, maximum
            with lock:
                active += 1
                maximum = max(maximum, active)
            time.sleep(0.08)
            with lock:
                active -= 1
            return {"uid": f"user-{threading.get_ident()}"}

        req = main.api_models.ExportRequest(file_id=FILE_ID, captions=[{"id": "1", "text": "Hello", "start_time": 0, "end_time": 1}])
        router = create_export_router(main)
        request = Request({"type": "http", "headers": []})
        ticks = []

        async def probe():
            start = time.monotonic()
            submissions = [asyncio.create_task(router.export_video(req, request, Response())) for _ in range(40)]
            while not all(task.done() for task in submissions):
                ticks.append(time.monotonic() - start)
                await asyncio.sleep(0.01)
            return await asyncio.gather(*submissions)

        with (
            patch.object(main.settings, "_IS_PRODUCTION", True),
            patch.object(main.app_state, "_export_queue", SimpleNamespace()),
            patch.object(main.request_security, "_authenticate_media_request", side_effect=authenticate),
            patch.object(main.operator_controls, "_assert_service_available"),
            patch.object(main, "_get_recent_export_failures", return_value=[]),
            patch.object(main, "_idem_get", return_value=None),
            patch.object(main, "_idem_claim", return_value=True),
            patch.object(main, "_idem_set"),
            patch.object(main, "_acquire_export_slot", return_value=True),
            patch.object(main.export_jobs, "_set_export_job"),
            patch.object(main.media_records, "_source_duration_hint", return_value=12),
            patch.object(main, "_render_queue_for", return_value=SimpleNamespace()),
            patch.object(main, "_enqueue_export_job", side_effect=lambda *a, **kw: time.sleep(0.08)),
            patch.object(main.observability, "_audit_action"),
        ):
            results = asyncio.run(probe())
        self.assertTrue(all(result["queued"] for result in results))
        self.assertLessEqual(maximum, 16)
        self.assertGreater(maximum, 1)
        self.assertGreater(len(ticks), 15)
        self.assertLess(max(b - a for a, b in zip(ticks, ticks[1:])), 0.15)

    def test_crash_after_debit_recovers_last_credit_and_expired_plan_without_rerender(self):
        for changed_plan in (False, True):
            with self.subTest(changed_plan=changed_plan), tempfile.TemporaryDirectory() as directory:
                users = {("users", "owner"): {"subscription_tier": "free", "credits_remaining": 1, "history": []}}
                database = MemoryRef(users)
                req = main.api_models.ExportRequest(file_id=FILE_ID, captions=[{"id": "1", "text": "Hello", "start_time": 0, "end_time": 1}])
                calls = []
                fail_completed = [True]

                def set_job(job_id, status, **kwargs):
                    calls.append((status, kwargs))
                    if status == "completed" and fail_completed[0]:
                        fail_completed[0] = False
                        raise RuntimeError("injected Redis outage after debit")
                    return kwargs

                async def burn(input_path, output_path, *args):
                    Path(output_path).write_bytes(b"valid mocked media")
                    return {"success": True}

                render = AsyncMock(side_effect=burn)
                # Python 3.11 limits static block depth. Keep every patch and
                # assertion, entering the contexts dynamically instead.
                with ExitStack() as stack:
                    for patcher in (
                        patch.object(main.firebase_admin_setup, "get_db", return_value=database),
                        patch.object(main.firestore, "transactional", lambda fn: fn),
                        patch.object(main.settings, "DISABLE_EXPORT_CREDIT_LIMIT", False),
                        patch.object(main.request_security, "_assert_account_not_deleting"),
                        patch.object(main.export_jobs, "_mark_export_processing", return_value=(time.time(), time.time())),
                        patch.object(main.export_jobs, "_set_export_job", side_effect=set_job),
                        patch.object(main.media_records, "_assert_upload_owner"), patch.object(main.media_records, "_assert_upload_clean"),
                        patch.object(main.media_records, "_safe_find_upload", return_value="source.mp4"),
                        patch.object(main.media_records, "_probe_media", return_value={"format": {"duration": 12}, "streams": [{"codec_type": "video", "width": 720, "height": 1280}]}),
                        patch.object(main.media_records, "_source_media_identity", return_value="media-identity"),
                        patch.object(main.export_jobs, "render_cache_eligible", return_value=False),
                        patch.object(main.settings, "EXPORT_DIR", directory), patch.object(main.settings, "RENDER_CACHE_DIR", directory),
                        patch.object(main.app_state.processor, "burn_only", render),
                        patch.object(main.firebase_admin_setup, "upload_to_firebase_storage", return_value="https://storage/private"),
                        patch.object(main.export_jobs, "_write_last_export_request_debug"),
                    ):
                        stack.enter_context(patcher)
                    with self.assertRaisesRegex(RuntimeError, "after debit"):
                        asyncio.run(main.export_jobs._process_export_job_core(req, "owner", "test", "charged-job"))
                    self.assertEqual(users[("users", "owner")]["credits_remaining"], 0)
                    ledger = users[("users", "owner", "export_usage", "charged-job")]
                    self.assertTrue(ledger["result_payload"]["success"])
                    self.assertIn("export_filename", ledger["result_payload"])
                    if changed_plan:
                        users[("users", "owner")].update(subscription_tier="creator", subscription_expiry="2020-01-01")
                    with patch.object(main.export_jobs, "_evaluate_export_policy", side_effect=AssertionError("retry must not recheck new-export policy")):
                        recovered = asyncio.run(main.export_jobs._process_export_job_core(req, "owner", "test", "charged-job"))
                    self.assertEqual(recovered, ledger["result_payload"])
                    self.assertEqual(render.await_count, 1)
                    self.assertEqual(len(users[("users", "owner")]["history"]), 1)
                    self.assertIsNone(main.export_jobs._load_recorded_export_result("owner", "new-job", FILE_ID))
                    self.assertIsNone(main.export_jobs._load_recorded_export_result("other-owner", "charged-job", FILE_ID))

    def test_failed_state_with_committed_usage_returns_completed_result(self):
        payload = {"success": True, "export_job_id": "job"}
        with patch.object(main.export_jobs, "_load_recorded_export_result", return_value=payload):
            result = create_export_router(main)._reconcile_export_job("job", {"status": "failed", "uid": "owner", "file_id": FILE_ID})
        self.assertEqual(result["status"], "completed")
        self.assertEqual(result["payload"], payload)

    def test_unknown_billing_outcome_stays_recoverable_during_database_outage(self):
        with patch.object(main.export_jobs, "_load_recorded_export_result", side_effect=RuntimeError("Firestore offline")):
            result = create_export_router(main)._reconcile_export_job("job", {"status": "failed", "uid": "owner", "file_id": FILE_ID})
        self.assertEqual(result["status"], "retrying")
        self.assertIsNone(result["error"])

    def test_missed_wake_job_survives_next_cron_with_browser_closed(self):
        import fakeredis
        from backend import railway_cron, worker_launcher
        connection = fakeredis.FakeRedis()
        connection.rpush("rq:queue:caption_export_jobs", "accepted-job")
        queue = SimpleNamespace(fetch_job=lambda job_id: SimpleNamespace(get_status=lambda: "queued"))
        job = {"status": "queued", "queue_entered_at": time.time() - 16 * 60}
        woken = []
        with (
            patch.object(main.app_state, "_export_queue", queue),
            patch.object(main, "_queue_for_export_job_record", return_value=queue),
            patch.dict(os.environ, {"WORKER_LAUNCH_JOBS": '{"caption_export_jobs":"lekha-render"}'}),
            patch.object(worker_launcher, "_default_launcher", side_effect=lambda name, slot: woken.append(name)),
        ):
            self.assertGreaterEqual(main.settings.EXPORT_MAX_QUEUE_WAIT_SECONDS, 1800)
            self.assertEqual(create_export_router(main)._reconcile_export_job("accepted-job", job)["status"], "queued")
            railway_cron.kick_backlogged_workers(connection, ["caption_export_jobs"])
        self.assertEqual(woken, ["lekha-render"])

    def test_private_download_signs_attachment_and_sanitizes_filename(self):
        client = Mock()
        with patch.object(media_storage, "_client", return_value=client):
            media_storage.signed_download_url("exports/owner/video.mp4", 900, '../hello\r\nworld_captioned.mp4')
        params = client.generate_presigned_url.call_args.kwargs["Params"]
        self.assertEqual(params["Key"], "exports/owner/video.mp4")
        self.assertIn("attachment", params["ResponseContentDisposition"])
        self.assertIn("helloworld_captioned.mp4", params["ResponseContentDisposition"])
        self.assertNotIn("\r", params["ResponseContentDisposition"])
        with patch.object(media_storage, "_client", return_value=client):
            media_storage.upload_file("rendered.mp4", "exports/owner/video.mp4", "video/mp4")
        self.assertIn("attachment", client.upload_file.call_args.kwargs["ExtraArgs"]["ContentDisposition"])

    def test_worker_preserves_paid_result_and_idempotency_after_completion_write_error(self):
        job = {"status": "queued"}
        payload = {"success": True, "export_job_id": "job"}

        def transition(job_id, status, **kwargs):
            job.update(status=status, **kwargs)
            return dict(job)

        async def crash(*args):
            job["status"] = "finalizing"
            raise RuntimeError("completion write failed after charge")

        with (
            patch.object(main.export_jobs, "_load_export_job", side_effect=lambda _: dict(job)),
            patch.object(main.export_jobs, "_set_export_job", side_effect=transition),
            patch.object(main.export_jobs, "_load_recorded_export_result", return_value=payload),
            patch.object(main.export_jobs, "_process_export_job_core", side_effect=crash),
            patch.object(main, "_acquire_export_slot", return_value=True),
            patch.object(main, "_release_export_slot"), patch.object(main, "_release_export_pending_work"),
            patch.object(main, "_idem_set") as store, patch.object(main, "_idem_delete") as delete,
        ):
            result = main.run_export_job_task("job", {"file_id": FILE_ID, "captions": [{"id": "1", "text": "Hello", "start_time": 0, "end_time": 1}]}, "owner", "stable-key", "hash")
        self.assertEqual(result, payload)
        self.assertEqual(job["status"], "completed")
        self.assertEqual(store.call_args.args[1]["payload"], payload)
        delete.assert_not_called()


class ScratchRecoveryTests(unittest.TestCase):
    def test_disk_headroom_rejects_before_creating_more_frames(self):
        with tempfile.TemporaryDirectory() as directory, patch("backend.render_scratch.shutil.disk_usage", return_value=SimpleNamespace(free=1)):
            with self.assertRaisesRegex(RuntimeError, "disk space"):
                RenderScratch(directory)
            self.assertEqual(list(Path(directory).iterdir()), [])

    def test_stale_active_lease_is_preserved_then_swept_after_owner_exits(self):
        with tempfile.TemporaryDirectory() as directory:
            scratch = RenderScratch(directory)
            path = Path(scratch.path)
            now = time.time() + STALE_SECONDS + 1
            self.assertEqual(sweep_render_scratch(directory, now), 0)
            self.assertTrue(path.exists())
            scratch._lease.close()  # models the OS releasing a terminated child's lock
            self.assertEqual(sweep_render_scratch(directory, now), 1)
            self.assertFalse(path.exists())

    def test_killed_child_orphan_is_removed_and_next_render_can_start(self):
        with tempfile.TemporaryDirectory() as directory:
            code = 'from backend.render_scratch import RenderScratch; import sys,time; s=RenderScratch(sys.argv[1]); print(s.path,flush=True); time.sleep(60)'
            child = subprocess.Popen([sys.executable, "-c", code, directory], stdout=subprocess.PIPE, text=True)
            try:
                path = Path(child.stdout.readline().strip())
                self.assertTrue(path.is_dir())
                child.kill()
                child.wait(timeout=5)
                self.assertEqual(sweep_render_scratch(directory, time.time() + STALE_SECONDS + 2), 1)
                next_render = RenderScratch(directory)
                next_render.close()
                self.assertEqual(list(Path(directory).iterdir()), [])
            finally:
                if child.poll() is None:
                    child.kill()
                    child.wait(timeout=5)
                child.stdout.close()

    def test_fresh_and_unrelated_directories_are_preserved(self):
        with tempfile.TemporaryDirectory() as directory:
            fresh = Path(directory) / "caption-template-overlay-new"
            fresh.mkdir()
            unrelated = Path(directory) / "customer-data"
            unrelated.mkdir()
            self.assertEqual(sweep_render_scratch(directory), 0)
            self.assertTrue(fresh.exists())
            self.assertTrue(unrelated.exists())


class BatchIdempotencyTests(unittest.TestCase):
    def setUp(self):
        import fakeredis

        self.stack = ExitStack()
        self.addCleanup(self.stack.close)
        self.redis = fakeredis.FakeRedis(decode_responses=True)
        self.database = Mock()
        self.receipt_write = self.database.collection.return_value.document.return_value.set
        self.enqueued = self.stack.enter_context(patch.object(main, "_enqueue_export_job"))
        for name, value in {
            "_redis_client": self.redis,
            "_export_queue": SimpleNamespace(),
        }.items():
            self.stack.enter_context(patch.object(main.app_state, name, value))
        self.stack.enter_context(patch.object(main.settings, "_IS_PRODUCTION", True))
        for name, value in {
            "_authenticate_media_request": {"uid": "batch-owner"},
            "_assert_service_available": None,
            "_assert_upload_owner": None,
            "_assert_upload_clean": None,
            "_source_duration_hint": 12,
            "_set_export_job": None,
            "_render_queue_for": SimpleNamespace(),
        }.items():
            self.stack.enter_context(patch.object(_owner(name), name, return_value=value))
        self.stack.enter_context(patch.object(main.observability, "_audit_action", return_value=None))
        self.stack.enter_context(patch.object(main.firebase_admin_setup, "get_db", return_value=self.database))
        self.router = create_export_router(main)
        self.request = Request({"type": "http", "headers": []})

    def batch(self, text="Hello"):
        return main.api_models.BatchExportRequest(idempotency_key="retry-key", exports=[
            main.api_models.ExportRequest(file_id=FILE_ID, captions=[{"id": "1", "text": text, "start_time": 0, "end_time": 1}])
        ])

    def test_concurrent_same_key_only_enqueues_one_batch(self):
        barrier = threading.Barrier(2)
        original_get = main._idem_get

        def simultaneous_get(key):
            value = original_get(key)
            barrier.wait(timeout=2)
            return value

        async def submit():
            return await asyncio.gather(
                self.router.create_export_batch(self.batch(), self.request),
                self.router.create_export_batch(self.batch(), self.request),
                return_exceptions=True,
            )

        with patch.object(main, "_idem_get", side_effect=simultaneous_get):
            results = asyncio.run(submit())
        self.assertEqual(self.enqueued.call_count, 1)
        self.assertEqual(sum(isinstance(result, dict) for result in results), 1)
        errors = [result for result in results if isinstance(result, HTTPException)]
        self.assertEqual([error.status_code for error in errors], [409])

    def test_same_key_with_different_batch_rejected(self):
        asyncio.run(self.router.create_export_batch(self.batch(), self.request))
        with self.assertRaises(HTTPException) as caught:
            asyncio.run(self.router.create_export_batch(self.batch("Changed"), self.request))
        self.assertEqual(caught.exception.status_code, 409)
        self.assertEqual(self.enqueued.call_count, 1)

    def test_retry_repairs_batch_status_receipt_without_enqueuing_again(self):
        self.receipt_write.side_effect = [RuntimeError("Firestore outage"), None]
        with self.assertRaises(Exception):
            asyncio.run(self.router.create_export_batch(self.batch(), self.request))
        result = asyncio.run(self.router.create_export_batch(self.batch(), self.request))
        self.assertTrue(result["idempotent_replay"])
        self.assertEqual(self.enqueued.call_count, 1)
        self.assertEqual(self.receipt_write.call_count, 2)

    def test_fully_rejected_batch_can_be_retried(self):
        self.enqueued.side_effect = HTTPException(429, "full")
        with self.assertRaises(HTTPException):
            asyncio.run(self.router.create_export_batch(self.batch(), self.request))
        self.enqueued.side_effect = None
        result = asyncio.run(self.router.create_export_batch(self.batch(), self.request))
        self.assertEqual(len(result["accepted"]), 1)


    def test_lost_enqueue_reply_preserves_original_job_and_retry_claim(self):
        self.enqueued.side_effect = RuntimeError("enqueue committed but reply lost")
        result = asyncio.run(self.router.create_export_batch(self.batch(), self.request))
        self.assertTrue(result["accepted"][0]["admission_uncertain"])
        replay = asyncio.run(self.router.create_export_batch(self.batch(), self.request))
        self.assertEqual(replay["batch_id"], result["batch_id"])
        self.assertEqual(replay["accepted"], result["accepted"])
        self.assertEqual(self.enqueued.call_count, 1)
        self.assertFalse(any(call.args[1] == "failed" for call in main.export_jobs._set_export_job.call_args_list))

    def test_partial_batch_replay_keeps_original_accepted_and_rejected_items(self):
        req = main.api_models.BatchExportRequest(idempotency_key="partial-key", exports=[self.batch().exports[0]] * 2)
        self.enqueued.side_effect = [None, HTTPException(429, "full")]
        result = asyncio.run(self.router.create_export_batch(req, self.request))
        replay = asyncio.run(self.router.create_export_batch(req, self.request))
        self.assertEqual(len(result["accepted"]), 1)
        self.assertEqual(len(result["rejected"]), 1)
        self.assertEqual(replay["accepted"], result["accepted"])
        self.assertEqual(replay["rejected"], result["rejected"])
        self.assertEqual(self.enqueued.call_count, 2)


    def test_batch_status_recovers_committed_paid_result(self):
        snapshot = self.database.collection.return_value.document.return_value.get.return_value
        snapshot.exists = True
        snapshot.to_dict.return_value = {"uid": "batch-owner", "job_ids": ["paid-job"], "rejected": []}
        with (patch.object(main.request_security, "_authenticate_bearer_request", return_value={"uid": "batch-owner"}),
              patch.object(main.export_jobs, "_load_export_job", return_value={"status": "failed", "uid": "batch-owner", "file_id": FILE_ID}),
              patch.object(main.export_jobs, "_load_recorded_export_result", return_value={"success": True})):
            result = self.router.get_export_batch("batch-id", self.request)
        self.assertEqual(result["jobs"][0]["status"], "completed")
        self.assertEqual(result["completed_items"], 1)
        self.enqueued.assert_not_called()
