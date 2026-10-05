"""Exercise HTTP handlers on one event loop and check blocking helper threads."""

import asyncio
from datetime import datetime
import threading
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
        import main

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
        import main

        with (patch.object(main, "_claim_scheduled_job", self.blocking("claim", "lease")),
              patch.object(main, "_release_scheduled_job", self.blocking("release")),
              patch.object(main, "_advanced_janitor_once", self.blocking("cleanup")),
              patch.object(main, "reconcile_payments_once", self.blocking("payments", {}))):
            await main.scheduled_janitor_job()
            await main.scheduled_payment_reconciliation_job()
        self.assertEqual(self.calls, ["claim", "cleanup", "release", "claim", "payments", "release"])
