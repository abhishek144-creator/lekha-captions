import pathlib
import sys
import unittest
from datetime import datetime

from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from analytics_api import create_analytics_router


class _Snapshot:
    exists = True

    def to_dict(self):
        return {
            "cost_per_successful_export_usd": 0.25,
            "cost_per_rendered_video_minute_usd": 0.1,
            "actual_net_cost_usd": 1.0,
            "cost_source": "gcp_detailed_billing_export",
        }


class _Document:
    def get(self):
        return _Snapshot()


class _Collection:
    def document(self, _key):
        return _Document()


class _Database:
    def collection(self, _name):
        return _Collection()


class AnalyticsApiTests(unittest.TestCase):
    def test_summary_exposes_bill_backed_cost_separately_from_forecast(self):
        app = FastAPI()
        app.include_router(create_analytics_router(
            is_admin=lambda **_kwargs: True,
            utcnow=lambda: datetime(2026, 9, 27, 12, 0, 0),
            get_database=lambda: _Database(),
            read_counters=lambda _day: {"export_success": 4, "process_success": 5},
            read_latency_samples=lambda _day, _path: [100, 200],
            read_metric_samples=lambda _day, _name: [0.2, 0.4],
            alert_failure_ratio=lambda *_args: None,
            percentile_95=lambda values: max(values),
        ))
        response = TestClient(app).get("/api/analytics/summary?date=2026-09-27")
        self.assertEqual(response.status_code, 200)
        metrics = response.json()["metrics"]
        self.assertEqual(metrics["cost_per_successful_export_usd"], 0.25)
        self.assertEqual(metrics["estimated_cost_per_successful_export_usd"], 0.3)
        self.assertEqual(metrics["cost_source"], "gcp_detailed_billing_export")

    def test_summary_remains_admin_only(self):
        app = FastAPI()
        app.include_router(create_analytics_router(
            is_admin=lambda **_kwargs: False,
            utcnow=datetime.utcnow,
            get_database=lambda: None,
            read_counters=lambda _day: {},
            read_latency_samples=lambda _day, _path: [],
            read_metric_samples=lambda _day, _name: [],
            alert_failure_ratio=lambda *_args: None,
            percentile_95=lambda _values: 0,
        ))
        self.assertEqual(TestClient(app).get("/api/analytics/summary").status_code, 403)


if __name__ == "__main__":
    unittest.main()
