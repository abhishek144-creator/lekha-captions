import unittest
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from processor import VideoProcessor


class CaptionPostProcessRegressionTests(unittest.TestCase):
    def setUp(self):
        # Avoid __init__ side effects (font downloads, fs setup) for pure logic tests.
        self.processor = VideoProcessor.__new__(VideoProcessor)

    def test_normalize_caption_text_adds_terminal_punctuation(self):
        normalized = self.processor._normalize_caption_text("hello   world")
        self.assertEqual(normalized, "hello world.")

    def test_tiny_caption_merges_into_next(self):
        captions = [
            {"id": 0, "text": "Hi", "start_time": 0.0, "end_time": 0.2},
            {"id": 1, "text": "this is a test", "start_time": 0.2, "end_time": 1.5},
        ]
        out = self.processor._post_process_captions(captions)
        self.assertEqual(len(out), 1)
        self.assertIn("Hi", out[0]["text"])
        self.assertIn("this is a test", out[0]["text"])

    def test_invalid_durations_are_corrected(self):
        captions = [
            {"id": 0, "text": "broken", "start_time": 1.0, "end_time": 1.0},
        ]
        out = self.processor._post_process_captions(captions)
        self.assertGreater(out[0]["end_time"], out[0]["start_time"])


if __name__ == "__main__":
    unittest.main()
