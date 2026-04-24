import os
import sys
import unittest

from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from main import app


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
        self.assertEqual(r1.json().get("signature"), r2.json().get("signature"))

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
        self.assertNotEqual(ra.json().get("signature"), rb.json().get("signature"))


if __name__ == "__main__":
    unittest.main()
