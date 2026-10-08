import asyncio
from concurrent.futures import ThreadPoolExecutor
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import fakeredis
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from backend.application import runtime as backend_context
from backend.job_state import InvalidJobTransition, transition
from backend.media_commands import run_media_command
from backend.release_metadata import release_metadata
from backend.request_limits import UploadBodyLimitMiddleware
from backend import worker
from backend import firebase_admin_setup
from rq import Queue
from backend.queue_admission import (
    PENDING_WORK_LEDGER_KEY,
    enqueue_bounded,
    enqueue_bounded_across_queues,
    release_pending_work,
)


class ProductionBoundaryTests(unittest.TestCase):
    def setUp(self):
        self.redis = fakeredis.FakeRedis(decode_responses=True)
        backend_context._export_jobs.clear()

    def test_scale_to_zero_api_runs_no_background_tasks_and_flushes_request_events(self):
        with (patch.object(backend_context, "RUN_API_BACKGROUND_TASKS", False),
              patch.object(backend_context.asyncio, "create_task") as create_task):
            asyncio.run(backend_context.startup_event())
        create_task.assert_not_called()

        with backend_context._telemetry_lock:
            backend_context._telemetry_buffer.append(("analytics_events", {"event": "test"}))
        try:
            with (patch.object(backend_context, "RUN_API_BACKGROUND_TASKS", False),
                  patch.object(backend_context, "_flush_telemetry", return_value=1) as flush):
                response = TestClient(backend_context.app).get("/api/version")
            self.assertEqual(response.status_code, 200)
            flush.assert_called_once()
        finally:
            with backend_context._telemetry_lock:
                backend_context._telemetry_buffer.clear()

    def test_atomic_backlog_limit_under_concurrent_submissions(self):
        queue = Queue("bounded-test", connection=self.redis)
        def submit(index):
            try:
                enqueue_bounded(queue, 8, func="operator.add", args=(1, 2), job_id=f"job-{index}")
                return True
            except backend_context.HTTPException as error:
                self.assertIn(error.status_code, (429, 503))
                return False
        with ThreadPoolExecutor(16) as pool:
            accepted = sum(pool.map(submit, range(50)))
        self.assertGreater(accepted, 0)
        self.assertLessEqual(accepted, 8)
        self.assertEqual(queue.count, accepted)
        self.assertEqual(len(list(self.redis.scan_iter("rq:job:*"))), accepted)

    def test_full_export_queue_advises_a_five_minute_retry(self):
        queue = Queue("bounded-retry", connection=self.redis)
        enqueue_bounded(queue, 1, func="operator.add", args=(1, 2), job_id="first")

        with self.assertRaises(backend_context.HTTPException) as error:
            enqueue_bounded(queue, 1, func="operator.add", args=(1, 2), job_id="second")

        self.assertEqual(error.exception.status_code, 429)
        self.assertEqual(error.exception.detail, "Export capacity is temporarily full. Retry after 5 mins.")
        self.assertEqual(error.exception.headers["Retry-After"], "300")

    def test_render_classes_share_one_atomic_backlog_limit(self):
        fast = Queue("fast", connection=self.redis)
        normal = Queue("normal", connection=self.redis)
        heavy = Queue("heavy", connection=self.redis)
        queues = [fast, normal, heavy]
        enqueue_bounded_across_queues(
            fast, queues, 2, func="operator.add", args=(1, 2), job_id="fast-job",
        )
        enqueue_bounded_across_queues(
            heavy, queues, 2, func="operator.add", args=(1, 2), job_id="heavy-job",
        )

        with self.assertRaises(backend_context.HTTPException) as error:
            enqueue_bounded_across_queues(
                normal, queues, 2, func="operator.add", args=(1, 2), job_id="normal-job",
            )

        self.assertEqual(error.exception.status_code, 429)
        self.assertEqual(sum(queue.count for queue in queues), 2)

    def test_predicted_work_admission_is_atomic_across_render_classes(self):
        fast = Queue("work-fast", connection=self.redis)
        heavy = Queue("work-heavy", connection=self.redis)
        queues = [fast, heavy]

        def submit(index):
            target = fast if index % 2 == 0 else heavy
            try:
                enqueue_bounded_across_queues(
                    target,
                    queues,
                    80,
                    max_pending_work_seconds=300,
                    estimated_work_seconds=75,
                    func="operator.add",
                    args=(1, 2),
                    job_id=f"work-job-{index}",
                )
                return True
            except backend_context.HTTPException as error:
                self.assertEqual(error.status_code, 429)
                self.assertIn("Predicted export wait", error.detail)
                return False

        with ThreadPoolExecutor(12) as pool:
            accepted = sum(pool.map(submit, range(20)))

        self.assertEqual(accepted, 4)
        self.assertEqual(sum(queue.count for queue in queues), 4)
        self.assertEqual(
            sum(int(value) for value in self.redis.hvals(PENDING_WORK_LEDGER_KEY)),
            300,
        )
        release_pending_work(self.redis, "work-job-0")
        self.assertIsNone(self.redis.hget(PENDING_WORK_LEDGER_KEY, "work-job-0"))

    def test_job_reconciliation_selects_the_recorded_render_queue(self):
        normal = object()
        heavy = object()
        with (
            patch.object(backend_context, "_export_queue", normal),
            patch.object(backend_context, "_export_queues", {"caption_export_heavy": heavy}),
        ):
            self.assertIs(
                backend_context._queue_for_export_job_record({"queue_name": "caption_export_heavy"}),
                heavy,
            )
            self.assertIs(backend_context._queue_for_export_job_record({}), normal)

    def test_preparation_timeout_cannot_fail_a_job_that_has_started(self):
        transition(self.redis, "race", {}, {"status": "queued"})
        stale = {"status": "queued"}
        transition(self.redis, "race", {}, {"status": "starting"})
        with self.assertRaises(InvalidJobTransition):
            transition(self.redis, "race", stale, {"status": "failed"}, expected_status="queued")
        self.assertEqual(json.loads(self.redis.get("export_job:race"))["status"], "starting")

    def test_worker_can_isolate_transcription_and_keep_legacy_queue_compatible(self):
        with (patch.dict(os.environ, {"WORKER_QUEUES": "transcription"}),
              patch.object(worker, "EXPORT_QUEUE_NAME", "exports")):
            self.assertEqual(worker.worker_queue_names(), ["transcription"])
        with patch.dict(os.environ, {}, clear=True):
            with (patch.object(worker, "EXPORT_QUEUE_NAME", "legacy"),
                  patch.object(worker, "TRANSCRIPTION_QUEUE_NAME", "legacy"),
                  patch.object(worker, "MEDIA_SCAN_QUEUE_NAME", "legacy")):
                self.assertEqual(worker.worker_queue_names(), ["legacy"])
            with (patch.object(worker, "EXPORT_QUEUE_NAME", "exports"),
                  patch.object(worker, "TRANSCRIPTION_QUEUE_NAME", "transcription"),
                  patch.object(worker, "MEDIA_SCAN_QUEUE_NAME", "media-scans")):
                self.assertEqual(
                    worker.worker_queue_names(),
                    ["exports", "media-scans", "transcription"],
                )

    def test_production_missing_queue_never_renders_in_api(self):
        request = backend_context.ExportRequest(file_id="123e4567-e89b-12d3-a456-426614174000",
                                     captions=[{"id": "1", "text": "hello", "start_time": 0, "end_time": 1}])
        from starlette.requests import Request
        with (patch.object(backend_context, "_IS_PRODUCTION", True), patch.object(backend_context, "_export_queue", None),
              patch.object(backend_context, "_assert_service_available"), patch.object(backend_context, "_track_event"),
              patch.object(backend_context, "_authenticate_media_request", return_value={"uid": "owner"}),
              patch.object(backend_context, "_process_export_job_core", new_callable=AsyncMock) as render,
              patch.object(backend_context, "_acquire_export_slot") as claim):
            with self.assertRaises(backend_context.HTTPException) as error:
                asyncio.run(backend_context.export_video(request, Request({"type": "http", "headers": []}), backend_context.Response()))
        self.assertEqual(error.exception.status_code, 503)
        self.assertEqual(error.exception.headers["Retry-After"], "10")
        render.assert_not_called()
        claim.assert_not_called()

    def test_export_timing_includes_backlog_and_preserves_admission_on_retry(self):
        with (patch.object(backend_context, "_redis_client", self.redis), patch.object(backend_context, "get_db", return_value=None),
              patch.object(backend_context, "_export_queue", None)):
            backend_context._set_export_job("timing", "queued", started_at=1000)
            backend_context._set_export_job("timing", "starting")
            with patch("backend.export_jobs.time", SimpleNamespace(time=lambda: 1180)):
                self.assertEqual(backend_context._mark_export_processing("timing"), (1000, 1180))
            self.assertEqual(backend_context._load_export_job("timing")["queue_wait_ms"], 180000)
            backend_context._set_export_job("timing", "retrying")
            backend_context._set_export_job("timing", "starting")
            with patch("backend.export_jobs.time", SimpleNamespace(time=lambda: 1240)):
                self.assertEqual(backend_context._mark_export_processing("timing"), (1000, 1240))
            self.assertEqual(backend_context._load_export_job("timing")["queue_entered_at"], 1000)
            self.assertEqual(backend_context._load_export_job("timing")["queue_wait_ms"], 180000)

    def test_storage_readiness_probes_the_selected_backend(self):
        with (patch.object(firebase_admin_setup, "s3_is_configured", return_value=True),
              patch.object(firebase_admin_setup, "s3_bucket_ready", return_value=True) as s3,
              patch.object(firebase_admin_setup, "get_storage_bucket") as firebase):
            self.assertTrue(firebase_admin_setup.storage_backend_ready())
            s3.assert_called_once()
            firebase.assert_not_called()
        with (patch.object(firebase_admin_setup, "s3_is_configured", return_value=False),
              patch.object(firebase_admin_setup, "get_storage_bucket") as firebase):
            firebase.return_value.exists.return_value = False
            self.assertFalse(firebase_admin_setup.storage_backend_ready())
            firebase.return_value.exists.assert_called_once_with(timeout=5)

    def test_processing_state_rejects_pending_or_rejected_media_for_export(self):
        with patch.object(backend_context, "_load_upload_metadata", return_value={"upload_state": "pending_scan"}):
            with self.assertRaises(backend_context.HTTPException) as pending:
                backend_context._assert_upload_clean("file")
        self.assertEqual(pending.exception.status_code, 409)
        self.assertEqual(pending.exception.headers["Retry-After"], "3")
        with patch.object(backend_context, "_load_upload_metadata", return_value={"upload_state": "rejected"}):
            with self.assertRaises(backend_context.HTTPException) as rejected:
                backend_context._assert_upload_clean("file")
        self.assertEqual(rejected.exception.status_code, 422)
        with patch.object(backend_context, "_load_upload_metadata", return_value={"upload_state": "clean"}):
            self.assertEqual(backend_context._assert_upload_clean("file")["upload_state"], "clean")

    def test_export_reuses_upload_identity_without_rehashing_source(self):
        with (
            patch.object(backend_context, "_load_upload_metadata", return_value={
                "storage_generation": "42", "storage_crc32c": "checksum",
            }),
            patch.object(backend_context, "_compute_media_hash") as compute_hash,
        ):
            identity = backend_context._source_media_identity("file", "source.mp4")
        self.assertEqual(identity, "storage:42:checksum")
        compute_hash.assert_not_called()

    def test_api_readiness_does_not_require_node_with_durable_workers(self):
        class Redis:
            @staticmethod
            def ping(): return True

            @staticmethod
            def hget(_key, field):
                if field == "app_release":
                    return backend_context.APP_RELEASE
                return None

        class Database:
            @staticmethod
            def collection(_name):
                return SimpleNamespace(limit=lambda _limit: SimpleNamespace(stream=lambda: iter([])))

        worker = SimpleNamespace(
            key="worker:ready",
            queue_names=[backend_context.EXPORT_QUEUE_NAME, backend_context.TRANSCRIPTION_QUEUE_NAME],
        )
        real_which = backend_context.shutil.which

        def without_node(binary):
            return None if binary == "node" else real_which(binary) or f"/usr/bin/{binary}"

        backend_context._dependency_snapshot_cache.update({"checked_at": 0.0, "value": None})
        with (patch.object(backend_context, "DURABLE_QUEUE_ENABLED", True),
              patch.object(backend_context, "_redis_client", Redis()),
              patch.object(backend_context, "get_db", return_value=Database()),
              patch.object(backend_context, "storage_backend_ready", return_value=True),
              patch.object(backend_context, "RQWorker", SimpleNamespace(all=lambda connection: [worker])),
              patch.object(backend_context.shutil, "which", side_effect=without_node),
              patch.object(backend_context.shutil, "disk_usage", return_value=SimpleNamespace(free=3 * 1024 ** 3))):
            snapshot = backend_context._runtime_dependency_snapshot()

        self.assertTrue(snapshot["checks"]["node"])
        self.assertTrue(snapshot["ready"])
        self.assertNotIn("export_worker", snapshot["checks"])
        self.assertNotIn("transcription_worker", snapshot["checks"])
        backend_context._dependency_snapshot_cache.update({"checked_at": 0.0, "value": None})

    def test_api_readiness_accepts_healthy_scale_to_zero_worker_state(self):
        database = SimpleNamespace(
            collection=lambda _name: SimpleNamespace(
                limit=lambda _limit: SimpleNamespace(stream=lambda: iter([]))
            )
        )
        redis_client = SimpleNamespace(ping=lambda: True)
        empty_queue = SimpleNamespace(count=0)
        backend_context._dependency_snapshot_cache.update({"checked_at": 0.0, "value": None})
        with (
            patch.object(backend_context, "DURABLE_QUEUE_ENABLED", True),
            patch.object(backend_context, "_redis_client", redis_client),
            patch.object(backend_context, "_export_queue", empty_queue),
            patch.object(backend_context, "_transcription_queue", empty_queue),
            patch.object(backend_context, "get_db", return_value=database),
            patch.object(backend_context, "storage_backend_ready", return_value=True),
            patch.object(backend_context, "RQWorker", SimpleNamespace(all=lambda connection: [])),
            patch.object(backend_context.shutil, "disk_usage", return_value=SimpleNamespace(free=3 * 1024 ** 3)),
        ):
            snapshot = backend_context._runtime_dependency_snapshot()
        self.assertTrue(snapshot["ready"])
        self.assertTrue(all(
            state == "idle_scaled_to_zero"
            for state in snapshot["details"]["capacity_state"].values()
        ))
        backend_context._dependency_snapshot_cache.update({"checked_at": 0.0, "value": None})

    def test_queued_export_cannot_start_after_account_deletion_request(self):
        with (patch.object(backend_context, "_assert_account_not_deleting", side_effect=backend_context.HTTPException(409, "Deletion requested")),
              patch.object(backend_context, "get_db") as database):
            with self.assertRaises(backend_context.HTTPException):
                asyncio.run(backend_context._process_export_job_core(None, "deleted", "request", "job"))
            database.assert_not_called()

    def test_account_export_reads_only_authenticated_users_deletion_record(self):
        class Ref:
            def __init__(self, collection, uid): self.collection_name, self.uid = collection, uid
            def get(self):
                self.assert_owner()
                data = {"status": "pending"} if self.collection_name == "account_deletions" else {"uid": self.uid}
                return SimpleNamespace(exists=True, to_dict=lambda: data)
            def assert_owner(self):
                if self.uid != "owner": raise AssertionError("Cross-user read")
            def collection(self, _): return self
            def order_by(self, *_args, **_kwargs): return self
            def limit(self, _): return self
            def stream(self): return iter([])
        db = SimpleNamespace(collection=lambda name: SimpleNamespace(document=lambda uid: Ref(name, uid)))
        with (patch.object(backend_context, "_IS_PRODUCTION", True), patch.object(backend_context, "get_db", return_value=db),
              patch.object(backend_context, "verify_token", return_value={"uid": "owner"}),
              patch.object(backend_context, "read_draft", return_value={"revision": 0, "draft": None}),
              patch.object(backend_context, "_assert_tenant_access"), patch.object(backend_context, "_audit_action")):
            response = TestClient(backend_context.app).post("/api/account-export", json={"id_token": "owner-token"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["data"]["deletion_record"], {"status": "pending"})

    def test_concurrent_rate_admission_never_exceeds_limit(self):
        barrier = threading.Barrier(32)
        def attempt(_):
            barrier.wait()
            return backend_context._check_rate(backend_context._process_rate, "same-user", 5)[0]
        with patch.object(backend_context, "_redis_client", self.redis), ThreadPoolExecutor(32) as pool:
            results = list(pool.map(attempt, range(32)))
        self.assertEqual(sum(results), 5)
        self.assertEqual(self.redis.zcard("rl:process:same-user"), 5)

    def test_rate_window_expiry_and_endpoint_isolation(self):
        with patch.object(backend_context, "_redis_client", self.redis), patch.object(backend_context.time, "time", return_value=1000):
            self.assertTrue(backend_context._check_rate(backend_context._process_rate, "u", 1, 60)[0])
            self.assertEqual(backend_context._check_rate(backend_context._process_rate, "u", 1, 60), (False, 60, 0))
            self.assertTrue(backend_context._check_rate(backend_context._upload_rate, "u", 1, 60)[0])
        with patch.object(backend_context, "_redis_client", self.redis), patch.object(backend_context.time, "time", return_value=1061):
            self.assertTrue(backend_context._check_rate(backend_context._process_rate, "u", 1, 60)[0])

    def test_cancellation_and_start_have_exactly_one_winner(self):
        for _ in range(25):
            self.redis.flushall()
            transition(self.redis, "job", {}, {"status": "queued", "uid": "a"})
            barrier = threading.Barrier(2)
            def attempt(status):
                barrier.wait()
                try:
                    transition(self.redis, "job", {}, {"status": status})
                    return True
                except InvalidJobTransition:
                    return False
            with ThreadPoolExecutor(2) as pool:
                self.assertEqual(sum(pool.map(attempt, ["starting", "cancelled"])), 1)

    def test_terminal_state_cannot_be_resurrected_from_stale_snapshot(self):
        for terminal in ("cancelled", "failed", "completed"):
            self.redis.set("export_job:job", json.dumps({"status": terminal}))
            with self.assertRaises(InvalidJobTransition):
                transition(self.redis, "job", {"status": "queued"}, {"status": "starting"})

    def test_duplicate_worker_does_not_render_or_release_winners_slot(self):
        entered, finish = threading.Event(), threading.Event()
        async def render(*_args):
            entered.set()
            await asyncio.to_thread(finish.wait, 5)
            backend_context._set_export_job("job", "finalizing")
            backend_context._set_export_job("job", "completed", payload={"success": True})
            return {"success": True}
        with (patch.object(backend_context, "_redis_client", self.redis), patch.object(backend_context, "get_db", return_value=None),
              patch.object(backend_context, "_export_queue", None), patch.object(backend_context, "_process_export_job_core", side_effect=render) as core):
            backend_context._set_export_job("job", "queued", uid="a")
            with ThreadPoolExecutor(2) as pool:
                first = pool.submit(backend_context.run_export_job_task, "job", {"file_id": "123e4567-e89b-12d3-a456-426614174000", "captions": [{"id": "1", "text": "hello", "start_time": 0, "end_time": 1}]}, "a")
                self.assertTrue(entered.wait(5))
                duplicate = backend_context.run_export_job_task("job", {"file_id": "123e4567-e89b-12d3-a456-426614174000", "captions": [{"id": "1", "text": "hello", "start_time": 0, "end_time": 1}]}, "a")
                self.assertEqual(duplicate["status"], "starting")
                self.assertEqual(self.redis.get("expactive:a"), "job")
                finish.set()
                self.assertTrue(first.result(5)["success"])
            self.assertEqual(core.call_count, 1)
            self.assertTrue(backend_context.run_export_job_task("job", {}, "a")["success"])
            self.assertEqual(core.call_count, 1)

    def test_redis_outage_fails_closed_for_rate_admission(self):
        with (patch.object(backend_context, "_redis_client", SimpleNamespace(eval=lambda *_: (_ for _ in ()).throw(ConnectionError()))),
              patch.object(backend_context, "_IS_PRODUCTION", True)):
            with self.assertRaises(backend_context.HTTPException) as error:
                backend_context._check_rate(backend_context._process_rate, "u", 1)
        self.assertEqual(error.exception.status_code, 503)

    def test_concurrent_export_receipts_have_single_owner(self):
        with patch.object(backend_context, "_redis_client", self.redis), ThreadPoolExecutor(16) as pool:
            results = list(pool.map(lambda _: backend_context._idem_claim("same", {"status": "in_progress"}), range(32)))
        self.assertEqual(sum(results), 1)

    def test_worker_crash_becomes_visible_failure(self):
        queue = SimpleNamespace(fetch_job=lambda _: SimpleNamespace(get_status=lambda **_: "failed"))
        with (patch.object(backend_context, "_redis_client", self.redis), patch.object(backend_context, "get_db", return_value=None),
              patch.object(backend_context, "_export_queue", queue)):
            backend_context._set_export_job("job", "queued", uid="a")
            job = backend_context._set_export_job("job", "starting")
            self.assertEqual(backend_context._reconcile_export_job("job", job)["status"], "failed")

    def test_export_wait_expires_after_configured_window_without_charging(self):
        rq_job = SimpleNamespace(cancelled=False)
        rq_job.cancel = lambda: setattr(rq_job, "cancelled", True)
        queue = SimpleNamespace(fetch_job=lambda _: rq_job)
        with (patch.object(backend_context, "_redis_client", self.redis), patch.object(backend_context, "get_db", return_value=None),
              patch.object(backend_context, "_export_queue", queue), patch.object(backend_context, "_track_event")):
            self.assertTrue(backend_context._acquire_export_slot("owner", "slow-job"))
            backend_context._idem_set("owner:slow", {"status": "in_progress"})
            job = backend_context._set_export_job(
                "slow-job",
                "queued",
                uid="owner",
                queue_entered_at=time.time() - backend_context.EXPORT_MAX_QUEUE_WAIT_SECONDS - 1,
                idempotency_key="owner:slow",
            )
            reconciled = backend_context._reconcile_export_job("slow-job", job)

        self.assertEqual(reconciled["status"], "failed")
        self.assertEqual(reconciled["failure_code"], "preparation_timeout")
        self.assertTrue(rq_job.cancelled)
        self.assertIsNone(backend_context._idem_get("owner:slow"))
        self.assertNotIn("owner", backend_context._active_exports_by_user)

    def test_cancelled_job_skips_processing_even_when_queue_removal_failed(self):
        queue = SimpleNamespace(fetch_job=lambda _: (_ for _ in ()).throw(ConnectionError()))
        with (patch.object(backend_context, "_redis_client", self.redis), patch.object(backend_context, "get_db", return_value=None),
              patch.object(backend_context, "_export_queue", queue), patch.object(backend_context, "verify_token", return_value={"uid": "a"}),
              patch.object(backend_context, "_process_export_job_core", new_callable=AsyncMock) as core):
            backend_context._idem_set("a:auto:same", {"status": "in_progress", "job_id": "job", "ts": time.time()})
            backend_context._set_export_job("job", "queued", uid="a", idempotency_key="a:auto:same")
            response = TestClient(backend_context.app).post("/api/export-cancel/job", headers={"Authorization": "Bearer a"})
            self.assertEqual(response.status_code, 200)
            self.assertTrue(response.json()["retry_allowed"])
            self.assertIsNone(backend_context._idem_get("a:auto:same"))
            self.assertEqual(backend_context.run_export_job_task("job", {}, "a")["status"], "cancelled")
            core.assert_not_called()

    def test_cross_user_job_endpoints_deny_access(self):
        with (patch.object(backend_context, "_redis_client", self.redis), patch.object(backend_context, "get_db", return_value=None),
              patch.object(backend_context, "verify_token", return_value={"uid": "b"})):
            backend_context._set_export_job("job", "queued", uid="a")
            client = TestClient(backend_context.app)
            for route in ("export-status", "export-result", "export-cancel"):
                response = client.request("POST" if route == "export-cancel" else "GET", f"/api/{route}/job", headers={"Authorization": "Bearer b"})
                self.assertEqual(response.status_code, 403)

    def test_media_commands_bound_all_inputs_and_keep_injection_literal(self):
        filename = 'quote;$(echo injected) && video.mp4'
        with patch("backend.media_commands.subprocess.run") as run:
            run_media_command(["ffmpeg", "-i", filename, "-i", "frames.txt", "out.mp4"], timeout=9999)
        args, kwargs = run.call_args
        self.assertEqual(args[0].count("-protocol_whitelist"), 2)
        self.assertIn(filename, args[0])
        self.assertEqual(kwargs["timeout"], 900)
        self.assertNotIn("shell", kwargs)
        with self.assertRaises(ValueError):
            run_media_command("ffmpeg anything")

    def test_real_ffprobe_rejects_network_playlist_and_malformed_media(self):
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / "fake.mp4"
            for data in (b"", b"MZ executable", b"#EXTM3U\n#EXTINF:1,\nhttp://127.0.0.1:1/private.ts\n"):
                target.write_bytes(data)
                result = run_media_command(["ffprobe", "-v", "error", str(target)], capture_output=True, text=True)
                self.assertNotEqual(result.returncode, 0)

    def test_probe_rejects_nonfinite_duration_and_excessive_pixels(self):
        for duration, width, height in (("nan", 100, 100), ("inf", 100, 100), (1, 9000, 9000), (1, 0, 0)):
            metadata = {"format": {"duration": duration}, "streams": [{"codec_type": "video", "width": width, "height": height}]}
            with (patch.object(backend_context, "_validate_media_signature"),
                  patch.object(backend_context, "run_media_command", return_value=SimpleNamespace(returncode=0, stdout=json.dumps(metadata)))):
                with self.assertRaises(ValueError):
                    backend_context._probe_media("input.mp4")

    def test_release_identity_is_public_and_validated(self):
        with patch.dict(os.environ, {"APP_RELEASE": "a" * 40, "RELEASE_VERSION": "v1.0.0-rc.1", "APP_BUILD_TIME": "2026-09-05T00:00:00Z"}):
            result = release_metadata("worker")
        self.assertEqual(result["component"], "worker")
        self.assertEqual(result["release"], "a" * 40)
        self.assertEqual(set(result), {"schema_version", "component", "release", "release_version", "built_at", "environment"})
        with patch.dict(os.environ, {"APP_RELEASE": "latest"}):
            with self.assertRaises(ValueError):
                release_metadata()

    def test_worker_readiness_requires_recent_heartbeat_and_not_draining(self):
        connection = SimpleNamespace(ping=lambda: True)
        with patch.dict(worker.WORKER_STATE, {"heartbeat_at": time.monotonic() - 1, "draining": False}):
            self.assertTrue(worker._worker_ready(connection))
            worker.WORKER_STATE["draining"] = True
            self.assertFalse(worker._worker_ready(connection))
            worker.WORKER_STATE.update(draining=False, heartbeat_at=time.monotonic() - 200)
            self.assertFalse(worker._worker_ready(connection))

    def test_liveness_is_independent_of_readiness(self):
        with (patch.object(backend_context, "_IS_PRODUCTION", True),
              patch.object(backend_context, "_runtime_dependency_snapshot", return_value={"ready": False})):
            client = TestClient(backend_context.app)
            self.assertEqual(client.get("/health").status_code, 200)
            self.assertEqual(client.get("/ready").status_code, 503)

    def test_slow_exports_do_not_remove_healthy_api_from_service(self):
        with (patch.object(backend_context, "_IS_PRODUCTION", True),
              patch.object(backend_context, "_runtime_dependency_snapshot", return_value={"ready": True}),
              patch.object(backend_context, "_build_slo_snapshot", return_value={"release_gate_passed": False})):
            self.assertEqual(TestClient(backend_context.app).get("/ready").status_code, 200)

    def test_export_slo_measures_completion_not_fast_enqueue(self):
        with (patch.object(backend_context, "_redis_client", None),
              patch.dict(backend_context._route_latency_samples, {"/api/export": [10]}),
              patch.object(backend_context, "_read_operational_metric_samples", return_value=[360000])):
            snapshot = backend_context._build_slo_snapshot()
        self.assertEqual(snapshot["actuals"]["export_p95_ms"], 360000)
        self.assertFalse(snapshot["release_gate_passed"])

    def test_worker_shutdown_still_drains_when_redis_is_unavailable(self):
        instance = worker.ReleaseWorker(["test"], connection=self.redis, name="shutdown-test")
        instance.connection = SimpleNamespace(
            hset=lambda *_: (_ for _ in ()).throw(worker.redis.ConnectionError()))
        with patch.dict(worker.WORKER_STATE, {"draining": False}), patch.object(worker.Worker, "request_stop") as stop:
            worker.ReleaseWorker.request_stop(instance, 15, None)
            self.assertTrue(worker.WORKER_STATE["draining"])
            stop.assert_called_once_with(15, None)

    def test_chunked_upload_is_limited_before_multipart_spooling(self):
        sent = []
        chunks = iter([{"type": "http.request", "body": b"123", "more_body": True},
                       {"type": "http.request", "body": b"456", "more_body": False}])
        async def receive():
            return next(chunks)
        async def send(message):
            sent.append(message)
        async def parser(scope, receive, send):
            try:
                await receive()
                await receive()
            except Exception:
                pass
            await send({"type": "http.response.start", "status": 400, "headers": []})
            await send({"type": "http.response.body", "body": b"parser failure"})
        scope = {"type": "http", "path": "/api/upload", "headers": []}
        asyncio.run(UploadBodyLimitMiddleware(parser, max_bytes=4)(scope, receive, send))
        self.assertEqual(sent[0]["status"], 413)
        self.assertEqual(len(sent), 2)

    def test_unauthenticated_upload_is_rejected_before_parser(self):
        with patch.object(backend_context, "verify_token", return_value=None):
            response = TestClient(backend_context.app).post("/api/upload", content=b"broken multipart", headers={"Content-Type": "multipart/form-data; boundary=x"})
        self.assertEqual(response.status_code, 401)

    def test_media_signatures_reject_renamed_executable_and_playlists(self):
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / "video.mp4"
            for data in (b"MZ" + bytes(30), b"#EXTM3U", b"", b"ffconcat version 1.0"):
                target.write_bytes(data)
                with self.assertRaises(ValueError):
                    backend_context._validate_media_signature(str(target))
            for data in (b"\x00\x00\x00\x18ftypisom" + bytes(20), b"RIFF" + bytes(4) + b"WAVE", b"ID3" + bytes(29)):
                target.write_bytes(data)
                backend_context._validate_media_signature(str(target))

    def test_older_payment_cannot_replace_newer_plan(self):
        user = SimpleNamespace(get=lambda **_: SimpleNamespace(exists=True, to_dict=lambda: {"last_subscription_order_created_at": 200, "subscription_tier": "pro"}))
        payment = SimpleNamespace(get=lambda **_: SimpleNamespace(exists=False))
        with patch.object(backend_context.firestore, "transactional", new=lambda fn: fn):
            with self.assertRaises(backend_context.HTTPException) as error:
                backend_context._grant_payment_transactionally(SimpleNamespace(transaction=lambda: object()), user, payment,
                    "u", "starter", backend_context.PLAN_PRICING["starter"], "p", "o", 29900, "INR", "test", "", order_created_at=100)
        self.assertEqual(error.exception.status_code, 409)

    def test_refund_before_payment_record_requests_redelivery(self):
        class Ref:
            def collection(self, _): return self
            def document(self, _): return self
            def get(self, **_): return SimpleNamespace(exists=False)
        db = SimpleNamespace(collection=lambda _: Ref(), transaction=lambda: object())
        with patch.object(backend_context.firestore, "transactional", new=lambda fn: fn):
            with self.assertRaises(backend_context.HTTPException) as error:
                backend_context._apply_refund_webhook_event(db, "refund.processed", {"id": "r", "payment_id": "p", "amount": 100}, {"id": "p", "notes": {"uid": "u"}})
        self.assertEqual(error.exception.status_code, 503)

    def test_pending_account_deletion_blocks_export_usage(self):
        self.assertFalse(backend_context._evaluate_export_policy({"deletion_pending": True, "credits_remaining": 100}, time.time())[0])

    def test_duplicate_payment_transaction_is_idempotent(self):
        lock = threading.Lock()
        data = {"user": {"credits_remaining": 3, "subscription_tier": "free"}}
        class Ref:
            def __init__(self, key): self.key = key
            def get(self, **_):
                return SimpleNamespace(exists=self.key in data, to_dict=lambda: dict(data.get(self.key, {})))
        class Tx:
            def create(self, ref, value):
                assert ref.key not in data
                data[ref.key] = value
            def update(self, ref, value): data[ref.key].update(value)
        def transactional(fn):
            def run(tx):
                with lock: return fn(tx)
            return run
        def grant(_):
            return backend_context._grant_payment_transactionally(SimpleNamespace(transaction=Tx), Ref("user"), Ref("payment"),
                "u", "starter", backend_context.PLAN_PRICING["starter"], "p", "o", 29900, "INR", "test", "", order_created_at=200)
        with patch.object(backend_context.firestore, "transactional", new=transactional), ThreadPoolExecutor(16) as pool:
            results = list(pool.map(grant, range(16)))
        self.assertEqual(sum(bool(result.get("duplicate")) for result in results), 15)
        self.assertEqual(data["user"]["credits_remaining"], backend_context.PLAN_PRICING["starter"]["credits"])

    def test_concurrent_usage_cannot_spend_last_credit_twice(self):
        lock = threading.Lock()
        data = {"user": {"credits_remaining": 1, "subscription_tier": "free"}}
        class Ref:
            def __init__(self, key): self.key = key
            def collection(self, _): return self
            def document(self, key): return Ref(key)
            def get(self, **_):
                return SimpleNamespace(exists=self.key in data, to_dict=lambda: dict(data.get(self.key, {})))
        class Tx:
            def create(self, ref, value):
                assert ref.key not in data
                data[ref.key] = value
            def update(self, ref, value): data[ref.key].update(value)
        def transactional(fn):
            def run(tx):
                with lock: return fn(tx)
            return run
        def consume(index):
            try:
                backend_context._record_export_usage(SimpleNamespace(transaction=Tx), Ref("user"), {"id": str(index)}, time.time(), f"job-{index}")
                return True
            except backend_context.HTTPException:
                return False
        with (patch.object(backend_context.firestore, "transactional", new=transactional),
              patch.object(backend_context, "DISABLE_EXPORT_CREDIT_LIMIT", False), ThreadPoolExecutor(2) as pool):
            results = list(pool.map(consume, range(2)))
        self.assertEqual(sum(results), 1)
        self.assertEqual(data["user"]["credits_remaining"], 0)

    def test_deleted_account_signed_media_is_revoked_before_local_read(self):
        class Ref:
            def document(self, _): return self
            def get(self): return SimpleNamespace(exists=True)
        db = SimpleNamespace(collection=lambda _: Ref())
        file_id = "123e4567-e89b-12d3-a456-426614174000"
        token = backend_context._create_media_token({"kind": "upload", "file_id": file_id, "uid": "deleted", "exp": int(time.time()) + 60})
        with (patch.object(backend_context, "_IS_PRODUCTION", True), patch.object(backend_context, "get_db", return_value=db),
              patch.object(backend_context, "_safe_find_upload") as find):
            response = TestClient(backend_context.app).get(f"/api/media/upload/{file_id}?token={token}")
        self.assertEqual(response.status_code, 409)
        find.assert_not_called()

    def test_deletion_waits_for_inflight_work_and_keeps_durable_fence(self):
        writes = []
        class Ref:
            def document(self, _): return self
            def set(self, data, **_): writes.append(data)
        db = SimpleNamespace(collection=lambda _: Ref())
        self.redis.set("procactive:a", "upload-in-progress")
        with (patch.object(backend_context, "_redis_client", self.redis), patch.object(backend_context, "get_db", return_value=db),
              patch.object(backend_context, "verify_token", return_value={"uid": "a"}),
              patch.object(backend_context, "delete_user_exports") as cleanup):
            response = TestClient(backend_context.app).post("/api/account-delete", json={"id_token": "a"})
        self.assertEqual(response.status_code, 409)
        self.assertEqual(writes[0]["status"], "pending")
        cleanup.assert_not_called()

    def test_bootstrap_cannot_recreate_account_behind_deletion_fence(self):
        class Ref:
            def document(self, _): return self
            def get(self, **_): return SimpleNamespace(exists=True)
        db = SimpleNamespace(collection=lambda _: Ref(), transaction=lambda: object())
        with patch.object(backend_context, "_IS_PRODUCTION", True), patch.object(backend_context.firestore, "transactional", new=lambda fn: fn):
            with self.assertRaises(backend_context.HTTPException) as error:
                backend_context._create_account_if_active(db, object(), "deleted", {})
        self.assertEqual(error.exception.status_code, 409)

    def test_system_ai_quota_fails_closed_in_production(self):
        class Ref:
            def document(self, _): return self
            def get(self, **_): raise RuntimeError("firestore down")
        db = SimpleNamespace(collection=lambda _: Ref(), transaction=lambda: object())
        with (patch.object(backend_context, "_IS_PRODUCTION", True), patch.object(backend_context, "AI_SYSTEM_DAILY_LIMIT", 10),
              patch.object(backend_context.firestore, "transactional", new=lambda fn: fn)):
            with self.assertRaises(backend_context.HTTPException) as error:
                backend_context._reserve_system_ai_quota(db, "process")
        self.assertEqual(error.exception.status_code, 503)
        with (patch.object(backend_context, "_IS_PRODUCTION", False), patch.object(backend_context, "AI_SYSTEM_DAILY_LIMIT", 10),
              patch.object(backend_context.firestore, "transactional", new=lambda fn: fn)):
            backend_context._reserve_system_ai_quota(db, "process")

    def test_job_state_preserves_empty_arrays_in_replay_payload(self):
        snapshot = {"waveform_data": [], "captions": [{"words": [], "word_styles": {}}]}
        transition(self.redis, "job", {}, {"status": "queued", "request_snapshot": snapshot})
        result = transition(self.redis, "job", {}, {"status": "starting"})
        self.assertEqual(result["request_snapshot"], snapshot)
        self.assertEqual(json.loads(self.redis.get("export_job:job"))["request_snapshot"], snapshot)

    def test_real_ffmpeg_timeout_terminates_unbounded_input(self):
        started = time.monotonic()
        with self.assertRaises(subprocess.TimeoutExpired):
            run_media_command(["ffmpeg", "-f", "lavfi", "-i", "testsrc=size=16x16:rate=1", "-f", "null", "-"], timeout=0.2, capture_output=True)
        self.assertLess(time.monotonic() - started, 5)
