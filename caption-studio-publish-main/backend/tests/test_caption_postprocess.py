import unittest
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from processor import VideoProcessor


class CaptionPostProcessRegressionTests(unittest.TestCase):
    def setUp(self):
        # Avoid __init__ side effects (font downloads, fs setup) for pure logic tests.
        self.processor = VideoProcessor.__new__(VideoProcessor)

    def test_normalize_caption_text_adds_no_punctuation(self):
        # A caption is often mid-sentence; only transcribed punctuation stays.
        self.assertEqual(self.processor._normalize_caption_text("hello   world"), "hello world")
        self.assertEqual(self.processor._normalize_caption_text("hello world ."), "hello world.")
        self.assertEqual(self.processor._normalize_caption_text("क्लब हाउस है ।"), "क्लब हाउस है।")

    def test_tiny_caption_merges_into_next(self):
        captions = [
            {"id": 0, "text": "Hi", "start_time": 0.0, "end_time": 0.2},
            {"id": 1, "text": "this is a test", "start_time": 0.2, "end_time": 1.5},
        ]
        out = self.processor._post_process_captions(captions)
        self.assertEqual(len(out), 1)
        self.assertIn("Hi", out[0]["text"])
        self.assertIn("this is a test", out[0]["text"])

    def test_tiny_final_caption_joins_the_one_before(self):
        captions = [
            {"id": 0, "text": "अवश्य तुम्हें सम्मान की प्राप्ति", "start_time": 26.56, "end_time": 30.48,
             "words": [{"word": "अवश्य", "start": 26.6, "end": 27.0}]},
            {"id": 1, "text": "होगी।", "start_time": 30.48, "end_time": 30.72,
             "words": [{"word": "होगी।", "start": 30.48, "end": 30.72}]},
        ]
        out = self.processor._post_process_captions(captions)
        self.assertEqual(len(out), 1)
        self.assertTrue(out[0]["text"].endswith("होगी।"))
        self.assertEqual(out[0]["end_time"], 30.72)
        self.assertEqual(len(out[0]["words"]), 2)

    def test_invalid_durations_are_corrected(self):
        captions = [
            {"id": 0, "text": "broken", "start_time": 1.0, "end_time": 1.0},
        ]
        out = self.processor._post_process_captions(captions)
        self.assertGreater(out[0]["end_time"], out[0]["start_time"])


if __name__ == "__main__":
    unittest.main()
