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
             "queue_wait_ms": 1000, "preparation_ms": 500, "render_ms": 5000,
             "finalization_ms": 1500, "total_ms": 8000,
             "rendered_duration_seconds": 60, "output_size_bytes": 1024,
             "source_duration_seconds": 60, "estimated_render_seconds": 10,
             "renderer": "ass", "quality": "720p", "fps": 30,
             "export_aspect_ratio": "9:16", "source_width": 1920,
             "source_height": 1080, "output_width": 720, "output_height": 1280},
            {"event": "export_observation", "job_id": "b", "status": "failed"},
        ]
        result = summarize(records, billing_cost_usd=0.5)
        self.assertEqual(result["terminal_success_rate"], 0.5)
        self.assertEqual(result["queue_wait_seconds"]["p95"], 1.0)
        self.assertEqual(result["preparation_seconds"]["p95"], 0.5)
        self.assertEqual(result["finalization_seconds"]["p95"], 1.5)
        self.assertEqual(result["cost_per_successful_export_usd"], 0.5)
        self.assertEqual(result["cost_per_rendered_video_minute_usd"], 0.5)
        self.assertEqual(result["render_prediction"]["actual_to_estimate_ratio"]["p95"], 0.5)
        self.assertEqual(result["render_work_calibration"]["ass"]["samples"], 1)
        self.assertEqual(result["render_work_calibration"]["ass"]["empirical_ratio"]["p50"], 0.1)
        self.assertEqual(
            result["render_work_calibration"]["ass"]["runtime_environment_variable"],
            "EXPORT_ASS_WORK_RATIO",
        )
        self.assertEqual(result["render_work_calibration"]["dom"]["samples"], 0)
        self.assertEqual(result["by_workload"]["renderer"]["ass"]["samples"], 1)
        self.assertEqual(result["by_workload"]["duration_bucket"]["short_0_60s"]["samples"], 1)
        self.assertEqual(result["by_workload"]["source_resolution"]["1920x1080"]["samples"], 1)
        profile = "ass|720p|30fps|short_0_60s|720x1280"
        self.assertEqual(result["by_workload"]["profile"][profile]["render_seconds"]["p99"], 5.0)

    def test_unknown_billing_is_not_reported_as_zero(self):
        result = summarize([])
        self.assertIsNone(result["cost_per_rendered_video_minute_usd"])


if __name__ == "__main__":
    unittest.main()
