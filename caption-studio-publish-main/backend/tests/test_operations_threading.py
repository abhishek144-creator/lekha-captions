"""Exercise HTTP handlers on one event loop and check blocking helper threads."""

import asyncio
from datetime import datetime
import threading
import time
import unittest
from unittest.mock import patch

from fastapi import FastAPI
import httpx

from backend.analytics_api import create_analytics_router
from backend.api.maintenance import create_maintenance_router


class OperationsThreadingTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.loop_thread = threading.get_ident()
        self.calls = []

    def blocking(self, name, result=None):
        def helper(*_args, **_kwargs):
            self.calls.append(name)
            self.assertNotEqual(threading.get_ident(), self.loop_thread, name)
            return result
        return helper

    async def request(self, app, method, path, **kwargs):
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://test",
        ) as client:
            response = await client.request(method, path, **kwargs)
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    async def test_both_analytics_summary_routes_offload_auth_and_firestore(self):
        app = FastAPI()
        app.include_router(create_analytics_router(
            is_admin=self.blocking("auth", True),
            utcnow=lambda: datetime(2026, 10, 5),
            get_database=self.blocking("database"),
            read_counters=self.blocking("counters", {}),
            read_latency_samples=self.blocking("latency", []),
            read_metric_samples=self.blocking("metrics", []),
            alert_failure_ratio=self.blocking("alerts"),
            percentile_95=lambda _values: 0,
        ))
        for path in ("/api/analytics/summary", "/api/v1/analytics/summary"):
            await self.request(app, "GET", path)
        self.assertEqual(self.calls.count("auth"), 2)
        self.assertEqual(self.calls.count("database"), 2)

    async def test_analytics_track_and_slo_offload_blocking_helpers(self):
        from backend import main

        with (patch.object(main, "_check_rate", self.blocking("rate", (True, 0, 5))),
              patch.object(main, "_track_event", self.blocking("track")),
              patch.object(main, "_is_admin_token", self.blocking("auth", True)),
              patch.object(main, "_build_slo_snapshot", self.blocking("slo", {"success": True}))):
            await self.request(main.app, "POST", "/api/analytics/track", json={"event": "page_view"})
            await self.request(main.app, "GET", "/api/slo/status")
        self.assertTrue({"rate", "track", "auth", "slo"}.issubset(self.calls))

    async def test_all_maintenance_routes_offload_authorization_and_dispatch(self):
        app = FastAPI()

        async def janitor():
            return await asyncio.to_thread(self.blocking("janitor"))

        async def reconcile():
            return await asyncio.to_thread(self.blocking("reconcile"))

        app.include_router(create_maintenance_router(
            authorize=self.blocking("auth"),
            dispatch_transcription=self.blocking("transcription", 2),
            dispatch_media_scans=self.blocking("scan", 3),
            run_janitor=janitor,
            publish_queue_metrics=self.blocking("metrics"),
            reconcile_payments=reconcile,
        ))
        for route in ("transcription-dispatch", "media-scan-dispatch", "janitor",
                      "queue-metrics", "payment-reconciliation"):
            await self.request(app, "POST", f"/api/maintenance/{route}")
        self.assertEqual(self.calls.count("auth"), 5)
        self.assertTrue({"transcription", "scan", "janitor", "metrics", "reconcile"}.issubset(self.calls))

    async def test_real_scheduled_helpers_offload_cleanup_reconciliation_and_leases(self):
        from backend import main

        with (patch.object(main, "_claim_scheduled_job", self.blocking("claim", "lease")),
              patch.object(main, "_release_scheduled_job", self.blocking("release")),
              patch.object(main, "_advanced_janitor_once", self.blocking("cleanup")),
              patch.object(main, "reconcile_payments_once", self.blocking("payments", {}))):
            await main.scheduled_janitor_job()
            await main.scheduled_payment_reconciliation_job()
        self.assertEqual(self.calls, ["claim", "cleanup", "release", "claim", "payments", "release"])


class MiddlewareThreadingTests(unittest.IsolatedAsyncioTestCase):
    def middleware_app(self):
        from backend import main

        app = FastAPI()
        app.middleware("http")(main.request_logging_middleware)

        @app.get("/api/export")
        @app.get("/api/version")
        async def probe():
            return {"success": True}

        return app

    async def test_cold_app_check_does_not_block_unrelated_requests(self):
        from backend import main

        loop_thread = threading.get_ident()
        verifier_threads = []
        entered = threading.Event()
        release = threading.Event()

        def cold_key_verification(_token):
            verifier_threads.append(threading.get_ident())
            entered.set()
            release.wait(timeout=0.3)
            return {"app_id": "web-app"}

        with (patch.object(main, "FIREBASE_APP_CHECK_ENFORCED", True),
              patch.object(main.firebase_app_check, "verify_token", side_effect=cold_key_verification),
              patch.object(main, "_track_latency_sample"),
              patch.object(main, "RUN_API_BACKGROUND_TASKS", True)):
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=self.middleware_app()),
                                         base_url="http://test") as client:
                submission = asyncio.create_task(client.get("/api/export", headers={"x-firebase-appcheck": "token"}))
                try:
                    while not entered.is_set():
                        await asyncio.sleep(0.005)
                    response = await client.get("/api/version")
                    self.assertEqual(response.status_code, 200)
                    self.assertNotIn(loop_thread, verifier_threads)
                    self.assertFalse(submission.done())
                finally:
                    release.set()
                    await submission

    async def test_latency_redis_writes_run_off_loop(self):
        from backend import main

        loop_thread = threading.get_ident()
        telemetry_threads = []

        def slow_redis_write(_path, _duration):
            telemetry_threads.append(threading.get_ident())
            time.sleep(0.03)

        with (patch.object(main, "FIREBASE_APP_CHECK_ENFORCED", False),
              patch.object(main, "_track_latency_sample", side_effect=slow_redis_write),
              patch.object(main, "RUN_API_BACKGROUND_TASKS", True)):
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=self.middleware_app()),
                                         base_url="http://test") as client:
                response = await client.get("/api/export")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(telemetry_threads), 1)
        self.assertNotIn(loop_thread, telemetry_threads)

    async def test_app_check_offload_still_rejects_missing_and_invalid_tokens(self):
        from backend import main

        with (patch.object(main, "FIREBASE_APP_CHECK_ENFORCED", True),
              patch.object(main.firebase_app_check, "verify_token", side_effect=ValueError("invalid token")),
              patch.object(main, "RUN_API_BACKGROUND_TASKS", True)):
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=self.middleware_app()),
                                         base_url="http://test") as client:
                for headers in ({}, {"x-firebase-appcheck": "invalid"}):
                    response = await client.get("/api/export", headers=headers)
                    self.assertEqual(response.status_code, 403)
                    self.assertEqual(response.headers["x-content-type-options"], "nosniff")
                response = await client.get("/api/version")
                self.assertEqual(response.status_code, 200)


    async def test_app_check_concurrency_is_bounded_and_exempt_probes_bypass_it(self):
        from backend import main

        lock = threading.Lock()
        release = threading.Event()
        active = 0
        maximum = 0

        def slow_verify(_token):
            nonlocal active, maximum
            with lock:
                active += 1
                maximum = max(maximum, active)
            try:
                release.wait(timeout=1)
                return {"app_id": "web-app"}
            finally:
                with lock:
                    active -= 1

        with (patch.object(main, "FIREBASE_APP_CHECK_ENFORCED", True),
              patch.object(main.firebase_app_check, "verify_token", side_effect=slow_verify),
              patch.object(main, "_track_latency_sample"),
              patch.object(main, "RUN_API_BACKGROUND_TASKS", True)):
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=self.middleware_app()),
                                         base_url="http://test") as client:
                submissions = [asyncio.create_task(client.get("/api/export", headers={"x-firebase-appcheck": "token"}))
                               for _ in range(40)]
                try:
                    deadline = time.monotonic() + 2
                    while maximum < 16 and time.monotonic() < deadline:
                        await asyncio.sleep(0.005)
                    self.assertEqual(maximum, 16)
                    self.assertEqual((await client.get("/api/version")).status_code, 200)
                    self.assertEqual((await client.get("/api/export")).status_code, 403)
                finally:
                    release.set()
                    responses = await asyncio.gather(*submissions)
        self.assertTrue(all(response.status_code == 200 for response in responses))
        self.assertLessEqual(maximum, 16)

    async def test_development_upload_slot_acquire_and_release_run_off_loop(self):
        from backend import main

        loop_thread = threading.get_ident()
        slot_calls = []

        def acquire(uid, job_id):
            slot_calls.append(("acquire", uid, job_id, threading.get_ident()))
            return True

        def release(uid, job_id):
            slot_calls.append(("release", uid, job_id, threading.get_ident()))

        app = self.middleware_app()

        @app.post("/api/upload")
        async def upload():
            return {"success": True}

        with (patch.object(main, "FIREBASE_APP_CHECK_ENFORCED", False),
              patch.object(main, "_IS_PRODUCTION", False),
              patch.object(main, "_authenticate_media_request", return_value={"uid": "owner"}),
              patch.object(main, "_acquire_process_slot", side_effect=acquire),
              patch.object(main, "_release_process_slot", side_effect=release),
              patch.object(main, "RUN_API_BACKGROUND_TASKS", True)):
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
                response = await client.post("/api/upload")
        self.assertEqual(response.status_code, 200)
        self.assertEqual([call[0] for call in slot_calls], ["acquire", "release"])
        self.assertEqual(slot_calls[0][1:3], slot_calls[1][1:3])
        self.assertTrue(all(call[3] != loop_thread for call in slot_calls))
