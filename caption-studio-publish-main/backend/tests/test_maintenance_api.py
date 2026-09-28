import unittest

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from backend.api.maintenance import create_maintenance_router


class MaintenanceApiTests(unittest.TestCase):
    def build_client(self, *, reject=False):
        calls = []

        def authorize(request):
            calls.append(("authorize", request.url.path))
            if reject:
                raise HTTPException(403, "forbidden")

        async def janitor():
            calls.append(("janitor", ""))

        async def reconcile():
            calls.append(("reconcile", ""))

        app = FastAPI()
        app.include_router(create_maintenance_router(
            authorize=authorize,
            dispatch_transcription=lambda: calls.append(("transcription", "")) or 2,
            dispatch_media_scans=lambda: calls.append(("media_scan", "")) or 3,
            run_janitor=janitor,
            publish_queue_metrics=lambda: calls.append(("metrics", "")),
            reconcile_payments=reconcile,
        ))
        return TestClient(app), calls

    def test_scheduler_routes_delegate_to_injected_services(self):
        client, calls = self.build_client()
        expected = {
            "/api/maintenance/transcription-dispatch": 2,
            "/api/maintenance/media-scan-dispatch": 3,
            "/api/maintenance/janitor": None,
            "/api/maintenance/queue-metrics": None,
            "/api/maintenance/payment-reconciliation": None,
        }
        for path, dispatched in expected.items():
            response = client.post(path)
            self.assertEqual(response.status_code, 200)
            if dispatched is not None:
                self.assertEqual(response.json()["dispatched"], dispatched)
        self.assertEqual(sum(name == "authorize" for name, _ in calls), len(expected))
        self.assertTrue({"transcription", "media_scan", "janitor", "metrics", "reconcile"}.issubset(
            {name for name, _ in calls}
        ))

    def test_authorization_runs_before_maintenance_work(self):
        client, calls = self.build_client(reject=True)
        response = client.post("/api/maintenance/media-scan-dispatch")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(calls, [("authorize", "/api/maintenance/media-scan-dispatch")])


if __name__ == "__main__":
    unittest.main()
