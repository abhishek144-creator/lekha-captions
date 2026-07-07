import os
import sys
import unittest

from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from main import ExportRequest, app, processor, _evaluate_export_policy, _resolve_export_preset


class PreviewExportParityTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_parity_signature_deterministic(self):
        payload = {
            "captions": [{"id": "1", "text": "Hello", "start_time": 0, "end_time": 1}],
            "style": {"font_family": "Inter", "position_x": 50, "position_y": 75},
            "word_layouts": {"1-0": {"x": 50, "y": 75, "w": 10, "h": 4}},
        }
        r1 = self.client.post("/api/export-parity-signature", json=payload)
        r2 = self.client.post("/api/export-parity-signature", json=payload)
        self.assertEqual(r1.status_code, 200)
        self.assertEqual(r2.status_code, 200)
        self.assertEqual(r1.json()["signature"], r2.json()["signature"])

    def test_parity_signature_detects_change(self):
        payload_a = {
            "captions": [{"id": "1", "text": "Hello", "start_time": 0, "end_time": 1}],
            "style": {"font_family": "Inter"},
            "word_layouts": {},
        }
        payload_b = {
            "captions": [{"id": "1", "text": "Hello!", "start_time": 0, "end_time": 1}],
            "style": {"font_family": "Inter"},
            "word_layouts": {},
        }
        ra = self.client.post("/api/export-parity-signature", json=payload_a)
        rb = self.client.post("/api/export-parity-signature", json=payload_b)
        self.assertEqual(ra.status_code, 200)
        self.assertEqual(rb.status_code, 200)
        self.assertNotEqual(ra.json()["signature"], rb.json()["signature"])

    def test_export_caption_template_sequence_metadata_survives_round_trip(self):
        request = ExportRequest(
            file_id="template-sequence",
            captions=[
                {
                    "id": "caption-2",
                    "text": "Every line is different",
                    "start_time": 2.4,
                    "end_time": 4.7,
                    "__templateIndex": 2,
                    "template_phase_index": 2,
                    "imp_word_index": 1,
                    "emotional_mode": "styled",
                    "audio_emotion_metrics": {"energy": 0.72},
                }
            ],
        )

        payload = request.model_dump(by_alias=True)
        caption = payload["captions"][0]
        self.assertEqual(caption["__templateIndex"], 2)
        self.assertEqual(caption["template_phase_index"], 2)
        self.assertEqual(caption["imp_word_index"], 1)
        self.assertEqual(caption["emotional_mode"], "styled")
        self.assertEqual(caption["audio_emotion_metrics"], {"energy": 0.72})

        replay_payload = ExportRequest(**payload).model_dump(by_alias=True)
        self.assertEqual(replay_payload["captions"][0]["__templateIndex"], 2)

    def test_dom_renderer_accepts_both_template_tabs(self):
        self.assertTrue(processor._should_use_dom_template_renderer({"template_20_id": "A5"}))
        self.assertTrue(processor._should_use_dom_template_renderer({"template_id": "t38"}))
        self.assertTrue(processor._should_use_dom_template_renderer({"template_id": "t-115"}))
        self.assertTrue(processor._should_use_dom_template_renderer({}, [
            {"template_id": "t33", "text": "एक क्लबाउस है और यहाँ पे"}
        ]))

    def test_local_testing_bypasses_credit_and_quality_limits(self):
        allowed, error, _ = _evaluate_export_policy(
            {"credits_remaining": 0, "subscription_tier": "free", "export_timestamps": [9999999999]},
            10000000000,
        )
        self.assertTrue(allowed)
        self.assertEqual(error, "")

        preset = _resolve_export_preset("free", "4k", 60)
        self.assertEqual(preset["tier"], "pro")
        self.assertEqual(preset["quality"], "4k")
        self.assertEqual(preset["fps"], 60)


if __name__ == "__main__":
    unittest.main()
