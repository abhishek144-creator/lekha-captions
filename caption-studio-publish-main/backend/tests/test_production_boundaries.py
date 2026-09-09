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

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import main
from job_state import InvalidJobTransition, transition
from media_commands import run_media_command
from release_metadata import release_metadata
from request_limits import UploadBodyLimitMiddleware
import worker
import firebase_admin_setup


class ProductionBoundaryTests(unittest.TestCase):
    def setUp(self):
        self.redis = fakeredis.FakeRedis(decode_responses=True)
        main._export_jobs.clear()

    def test_production_missing_queue_never_renders_in_api(self):
        request = main.ExportRequest(file_id="123e4567-e89b-12d3-a456-426614174000",
                                     captions=[{"id": "1", "text": "hello", "start_time": 0, "end_time": 1}])
        from starlette.requests import Request
        with (patch.object(main, "_IS_PRODUCTION", True), patch.object(main, "_export_queue", None),
              patch.object(main, "_assert_service_available"), patch.object(main, "_track_event"),
              patch.object(main, "_authenticate_media_request", return_value={"uid": "owner"}),
              patch.object(main, "_process_export_job_core", new_callable=AsyncMock) as render,
              patch.object(main, "_acquire_export_slot") as claim):
            with self.assertRaises(main.HTTPException) as error:
                asyncio.run(main.export_video(request, Request({"type": "http", "headers": []}), main.Response()))
        self.assertEqual(error.exception.status_code, 503)
        self.assertEqual(error.exception.headers["Retry-After"], "10")
        render.assert_not_called()
        claim.assert_not_called()

    def test_export_timing_includes_backlog_and_preserves_admission_on_retry(self):
        with (patch.object(main, "_redis_client", self.redis), patch.object(main, "get_db", return_value=None),
              patch.object(main, "_export_queue", None)):
            main._set_export_job("timing", "queued", started_at=1000)
            main._set_export_job("timing", "starting")
            with patch.object(main, "time", SimpleNamespace(time=lambda: 1180)):
                self.assertEqual(main._mark_export_processing("timing"), (1000, 1180))
            self.assertEqual(main._load_export_job("timing")["queue_wait_ms"], 180000)
            main._set_export_job("timing", "retrying")
            main._set_export_job("timing", "starting")
            with patch.object(main, "time", SimpleNamespace(time=lambda: 1240)):
                self.assertEqual(main._mark_export_processing("timing"), (1000, 1240))
            self.assertEqual(main._load_export_job("timing")["queue_entered_at"], 1000)
            self.assertEqual(main._load_export_job("timing")["queue_wait_ms"], 180000)

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

    def test_queued_export_cannot_start_after_account_deletion_request(self):
        with (patch.object(main, "_assert_account_not_deleting", side_effect=main.HTTPException(409, "Deletion requested")),
              patch.object(main, "get_db") as database):
            with self.assertRaises(main.HTTPException):
                asyncio.run(main._process_export_job_core(None, "deleted", "request", "job"))
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
        with (patch.object(main, "_IS_PRODUCTION", True), patch.object(main, "get_db", return_value=db),
              patch.object(main, "verify_token", return_value={"uid": "owner"}),
              patch.object(main, "read_draft", return_value={"revision": 0, "draft": None}),
              patch.object(main, "_assert_tenant_access"), patch.object(main, "_audit_action")):
            response = TestClient(main.app).post("/api/account-export", json={"id_token": "owner-token"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["data"]["deletion_record"], {"status": "pending"})

    def test_concurrent_rate_admission_never_exceeds_limit(self):
        barrier = threading.Barrier(32)
        def attempt(_):
            barrier.wait()
            return main._check_rate(main._process_rate, "same-user", 5)[0]
        with patch.object(main, "_redis_client", self.redis), ThreadPoolExecutor(32) as pool:
            results = list(pool.map(attempt, range(32)))
        self.assertEqual(sum(results), 5)
        self.assertEqual(self.redis.zcard("rl:process:same-user"), 5)

    def test_rate_window_expiry_and_endpoint_isolation(self):
        with patch.object(main, "_redis_client", self.redis), patch.object(main.time, "time", return_value=1000):
            self.assertTrue(main._check_rate(main._process_rate, "u", 1, 60)[0])
            self.assertEqual(main._check_rate(main._process_rate, "u", 1, 60), (False, 60, 0))
            self.assertTrue(main._check_rate(main._upload_rate, "u", 1, 60)[0])
        with patch.object(main, "_redis_client", self.redis), patch.object(main.time, "time", return_value=1061):
            self.assertTrue(main._check_rate(main._process_rate, "u", 1, 60)[0])

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
            main._set_export_job("job", "finalizing")
            main._set_export_job("job", "completed", payload={"success": True})
            return {"success": True}
        with (patch.object(main, "_redis_client", self.redis), patch.object(main, "get_db", return_value=None),
              patch.object(main, "_export_queue", None), patch.object(main, "_process_export_job_core", side_effect=render) as core):
            main._set_export_job("job", "queued", uid="a")
            with ThreadPoolExecutor(2) as pool:
                first = pool.submit(main.run_export_job_task, "job", {"file_id": "123e4567-e89b-12d3-a456-426614174000", "captions": [{"id": "1", "text": "hello", "start_time": 0, "end_time": 1}]}, "a")
                self.assertTrue(entered.wait(5))
                duplicate = main.run_export_job_task("job", {"file_id": "123e4567-e89b-12d3-a456-426614174000", "captions": [{"id": "1", "text": "hello", "start_time": 0, "end_time": 1}]}, "a")
                self.assertEqual(duplicate["status"], "starting")
                self.assertEqual(self.redis.get("expactive:a"), "job")
                finish.set()
                self.assertTrue(first.result(5)["success"])
            self.assertEqual(core.call_count, 1)
            self.assertTrue(main.run_export_job_task("job", {}, "a")["success"])
            self.assertEqual(core.call_count, 1)

    def test_redis_outage_fails_closed_for_rate_admission(self):
        with (patch.object(main, "_redis_client", SimpleNamespace(eval=lambda *_: (_ for _ in ()).throw(ConnectionError()))),
              patch.object(main, "_IS_PRODUCTION", True)):
            with self.assertRaises(main.HTTPException) as error:
                main._check_rate(main._process_rate, "u", 1)
        self.assertEqual(error.exception.status_code, 503)

    def test_concurrent_export_receipts_have_single_owner(self):
        with patch.object(main, "_redis_client", self.redis), ThreadPoolExecutor(16) as pool:
            results = list(pool.map(lambda _: main._idem_claim("same", {"status": "in_progress"}), range(32)))
        self.assertEqual(sum(results), 1)

    def test_worker_crash_becomes_visible_failure(self):
        queue = SimpleNamespace(fetch_job=lambda _: SimpleNamespace(get_status=lambda **_: "failed"))
        with (patch.object(main, "_redis_client", self.redis), patch.object(main, "get_db", return_value=None),
              patch.object(main, "_export_queue", queue)):
            main._set_export_job("job", "queued", uid="a")
            job = main._set_export_job("job", "starting")
            self.assertEqual(main._reconcile_export_job("job", job)["status"], "failed")

    def test_export_wait_is_capped_at_two_minutes_without_charging(self):
        rq_job = SimpleNamespace(cancelled=False)
        rq_job.cancel = lambda: setattr(rq_job, "cancelled", True)
        queue = SimpleNamespace(fetch_job=lambda _: rq_job)
        with (patch.object(main, "_redis_client", self.redis), patch.object(main, "get_db", return_value=None),
              patch.object(main, "_export_queue", queue), patch.object(main, "_track_event")):
            self.assertTrue(main._acquire_export_slot("owner", "slow-job"))
            main._idem_set("owner:slow", {"status": "in_progress"})
            job = main._set_export_job(
                "slow-job",
                "queued",
                uid="owner",
                queue_entered_at=time.time() - main.EXPORT_MAX_QUEUE_WAIT_SECONDS - 1,
                idempotency_key="owner:slow",
            )
            reconciled = main._reconcile_export_job("slow-job", job)

        self.assertEqual(reconciled["status"], "failed")
        self.assertEqual(reconciled["failure_code"], "preparation_timeout")
        self.assertTrue(rq_job.cancelled)
        self.assertIsNone(main._idem_get("owner:slow"))
        self.assertNotIn("owner", main._active_exports_by_user)

    def test_cancelled_job_skips_processing_even_when_queue_removal_failed(self):
        queue = SimpleNamespace(fetch_job=lambda _: (_ for _ in ()).throw(ConnectionError()))
        with (patch.object(main, "_redis_client", self.redis), patch.object(main, "get_db", return_value=None),
              patch.object(main, "_export_queue", queue), patch.object(main, "verify_token", return_value={"uid": "a"}),
              patch.object(main, "_process_export_job_core", new_callable=AsyncMock) as core):
            main._set_export_job("job", "queued", uid="a")
            response = TestClient(main.app).post("/api/export-cancel/job", headers={"Authorization": "Bearer a"})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(main.run_export_job_task("job", {}, "a")["status"], "cancelled")
            core.assert_not_called()

    def test_cross_user_job_endpoints_deny_access(self):
        with (patch.object(main, "_redis_client", self.redis), patch.object(main, "get_db", return_value=None),
              patch.object(main, "verify_token", return_value={"uid": "b"})):
            main._set_export_job("job", "queued", uid="a")
            client = TestClient(main.app)
            for route in ("export-status", "export-result", "export-cancel"):
                response = client.request("POST" if route == "export-cancel" else "GET", f"/api/{route}/job", headers={"Authorization": "Bearer b"})
                self.assertEqual(response.status_code, 403)

    def test_media_commands_bound_all_inputs_and_keep_injection_literal(self):
        filename = 'quote;$(echo injected) && video.mp4'
        with patch("media_commands.subprocess.run") as run:
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
            with (patch.object(main, "_validate_media_signature"),
                  patch.object(main, "run_media_command", return_value=SimpleNamespace(returncode=0, stdout=json.dumps(metadata)))):
                with self.assertRaises(ValueError):
                    main._probe_media("input.mp4")

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
        with (patch.object(main, "_IS_PRODUCTION", True),
              patch.object(main, "_runtime_dependency_snapshot", return_value={"ready": False})):
            client = TestClient(main.app)
            self.assertEqual(client.get("/health").status_code, 200)
            self.assertEqual(client.get("/ready").status_code, 503)

    def test_slow_exports_do_not_remove_healthy_api_from_service(self):
        with (patch.object(main, "_IS_PRODUCTION", True),
              patch.object(main, "_runtime_dependency_snapshot", return_value={"ready": True}),
              patch.object(main, "_build_slo_snapshot", return_value={"release_gate_passed": False})):
            self.assertEqual(TestClient(main.app).get("/ready").status_code, 200)

    def test_export_slo_measures_completion_not_fast_enqueue(self):
        with (patch.object(main, "_redis_client", None),
              patch.dict(main._route_latency_samples, {"/api/export": [10]}),
              patch.object(main, "_read_operational_metric_samples", return_value=[360000])):
            snapshot = main._build_slo_snapshot()
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
        with patch.object(main, "verify_token", return_value=None):
            response = TestClient(main.app).post("/api/upload", content=b"broken multipart", headers={"Content-Type": "multipart/form-data; boundary=x"})
        self.assertEqual(response.status_code, 401)

    def test_media_signatures_reject_renamed_executable_and_playlists(self):
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / "video.mp4"
            for data in (b"MZ" + bytes(30), b"#EXTM3U", b"", b"ffconcat version 1.0"):
                target.write_bytes(data)
                with self.assertRaises(ValueError):
                    main._validate_media_signature(str(target))
            for data in (b"\x00\x00\x00\x18ftypisom" + bytes(20), b"RIFF" + bytes(4) + b"WAVE", b"ID3" + bytes(29)):
                target.write_bytes(data)
                main._validate_media_signature(str(target))

    def test_older_payment_cannot_replace_newer_plan(self):
        user = SimpleNamespace(get=lambda **_: SimpleNamespace(exists=True, to_dict=lambda: {"last_subscription_order_created_at": 200, "subscription_tier": "pro"}))
        payment = SimpleNamespace(get=lambda **_: SimpleNamespace(exists=False))
        with patch.object(main.firestore, "transactional", new=lambda fn: fn):
            with self.assertRaises(main.HTTPException) as error:
                main._grant_payment_transactionally(SimpleNamespace(transaction=lambda: object()), user, payment,
                    "u", "starter", main.PLAN_PRICING["starter"], "p", "o", 29900, "INR", "test", "", order_created_at=100)
        self.assertEqual(error.exception.status_code, 409)

    def test_refund_before_payment_record_requests_redelivery(self):
        class Ref:
            def collection(self, _): return self
            def document(self, _): return self
            def get(self, **_): return SimpleNamespace(exists=False)
        db = SimpleNamespace(collection=lambda _: Ref(), transaction=lambda: object())
        with patch.object(main.firestore, "transactional", new=lambda fn: fn):
            with self.assertRaises(main.HTTPException) as error:
                main._apply_refund_webhook_event(db, "refund.processed", {"id": "r", "payment_id": "p", "amount": 100}, {"id": "p", "notes": {"uid": "u"}})
        self.assertEqual(error.exception.status_code, 503)

    def test_pending_account_deletion_blocks_export_usage(self):
        self.assertFalse(main._evaluate_export_policy({"deletion_pending": True, "credits_remaining": 100}, time.time())[0])

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
            return main._grant_payment_transactionally(SimpleNamespace(transaction=Tx), Ref("user"), Ref("payment"),
                "u", "starter", main.PLAN_PRICING["starter"], "p", "o", 29900, "INR", "test", "", order_created_at=200)
        with patch.object(main.firestore, "transactional", new=transactional), ThreadPoolExecutor(16) as pool:
            results = list(pool.map(grant, range(16)))
        self.assertEqual(sum(bool(result.get("duplicate")) for result in results), 15)
        self.assertEqual(data["user"]["credits_remaining"], main.PLAN_PRICING["starter"]["credits"])

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
                main._record_export_usage(SimpleNamespace(transaction=Tx), Ref("user"), {"id": str(index)}, time.time(), f"job-{index}")
                return True
            except main.HTTPException:
                return False
        with (patch.object(main.firestore, "transactional", new=transactional),
              patch.object(main, "DISABLE_EXPORT_CREDIT_LIMIT", False), ThreadPoolExecutor(2) as pool):
            results = list(pool.map(consume, range(2)))
        self.assertEqual(sum(results), 1)
        self.assertEqual(data["user"]["credits_remaining"], 0)

    def test_deleted_account_signed_media_is_revoked_before_local_read(self):
        class Ref:
            def document(self, _): return self
            def get(self): return SimpleNamespace(exists=True)
        db = SimpleNamespace(collection=lambda _: Ref())
        file_id = "123e4567-e89b-12d3-a456-426614174000"
        token = main._create_media_token({"kind": "upload", "file_id": file_id, "uid": "deleted", "exp": int(time.time()) + 60})
        with (patch.object(main, "_IS_PRODUCTION", True), patch.object(main, "get_db", return_value=db),
              patch.object(main, "_safe_find_upload") as find):
            response = TestClient(main.app).get(f"/api/media/upload/{file_id}?token={token}")
        self.assertEqual(response.status_code, 409)
        find.assert_not_called()

    def test_deletion_waits_for_inflight_work_and_keeps_durable_fence(self):
        writes = []
        class Ref:
            def document(self, _): return self
            def set(self, data, **_): writes.append(data)
        db = SimpleNamespace(collection=lambda _: Ref())
        self.redis.set("procactive:a", "upload-in-progress")
        with (patch.object(main, "_redis_client", self.redis), patch.object(main, "get_db", return_value=db),
              patch.object(main, "verify_token", return_value={"uid": "a"}),
              patch.object(main, "delete_user_exports") as cleanup):
            response = TestClient(main.app).post("/api/account-delete", json={"id_token": "a"})
        self.assertEqual(response.status_code, 409)
        self.assertEqual(writes[0]["status"], "pending")
        cleanup.assert_not_called()

    def test_bootstrap_cannot_recreate_account_behind_deletion_fence(self):
        class Ref:
            def document(self, _): return self
            def get(self, **_): return SimpleNamespace(exists=True)
        db = SimpleNamespace(collection=lambda _: Ref(), transaction=lambda: object())
        with patch.object(main, "_IS_PRODUCTION", True), patch.object(main.firestore, "transactional", new=lambda fn: fn):
            with self.assertRaises(main.HTTPException) as error:
                main._create_account_if_active(db, object(), "deleted", {})
        self.assertEqual(error.exception.status_code, 409)

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
