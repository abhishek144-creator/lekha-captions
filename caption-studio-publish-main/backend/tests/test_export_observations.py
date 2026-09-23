import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "scripts"))
from analyze_export_observations import _record, summarize


class ExportObservationsTests(unittest.TestCase):
    def test_parses_cloud_logging_text_payload(self):
        entry = {"textPayload": 'INFO:api:{"event":"export_observation","job_id":"a","status":"completed"}'}
        self.assertEqual(_record(entry)["job_id"], "a")

    def test_deduplicates_retries_and_computes_actual_cost_ratios(self):
        records = [
            {"event": "export_observation", "job_id": "a", "status": "retrying"},
            {"event": "export_observation", "job_id": "a", "status": "completed",
             "queue_wait_ms": 1000, "render_ms": 5000, "total_ms": 8000,
             "rendered_duration_seconds": 60, "output_size_bytes": 1024,
             "estimated_render_seconds": 10},
            {"event": "export_observation", "job_id": "b", "status": "failed"},
        ]
        result = summarize(records, billing_cost_usd=0.5)
        self.assertEqual(result["terminal_success_rate"], 0.5)
        self.assertEqual(result["queue_wait_seconds"]["p95"], 1.0)
        self.assertEqual(result["cost_per_successful_export_usd"], 0.5)
        self.assertEqual(result["cost_per_rendered_video_minute_usd"], 0.5)
        self.assertEqual(result["render_prediction"]["actual_to_estimate_ratio"]["p95"], 0.5)

    def test_unknown_billing_is_not_reported_as_zero(self):
        result = summarize([])
        self.assertIsNone(result["cost_per_rendered_video_minute_usd"])


if __name__ == "__main__":
    unittest.main()
