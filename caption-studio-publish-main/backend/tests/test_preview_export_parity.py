import os
import sys
import unittest
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from main import ExportRequest, processor, _build_parity_signature, _evaluate_export_policy, _resolve_export_preset


class PreviewExportParityTests(unittest.TestCase):
    def test_parity_signature_deterministic(self):
        payload = {
            "captions": [{"id": "1", "text": "Hello", "start_time": 0, "end_time": 1}],
            "style": {"font_family": "Inter", "position_x": 50, "position_y": 75},
            "word_layouts": {"1-0": {"x": 50, "y": 75, "w": 10, "h": 4}},
        }
        signature_1 = _build_parity_signature(payload["captions"], payload["style"], payload["word_layouts"])
        signature_2 = _build_parity_signature(payload["captions"], payload["style"], payload["word_layouts"])
        self.assertEqual(signature_1, signature_2)

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
        signature_a = _build_parity_signature(payload_a["captions"], payload_a["style"], payload_a["word_layouts"])
        signature_b = _build_parity_signature(payload_b["captions"], payload_b["style"], payload_b["word_layouts"])
        self.assertNotEqual(signature_a, signature_b)

    def test_export_caption_template_sequence_metadata_survives_round_trip(self):
        request = ExportRequest(
            file_id="123e4567-e89b-12d3-a456-426614174000",
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

    def test_ass_override_syntax_is_neutralized(self):
        escaped = processor._escape_ass_text(r"hello{\pos(1,1)}world")
        self.assertNotIn("{", escaped)
        self.assertNotIn("}", escaped)
        self.assertNotIn("\\", escaped)

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
