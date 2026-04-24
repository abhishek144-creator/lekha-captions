import io
import os
import sys
import unittest
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from main import app


class SmokeFlowTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    @patch("main._scan_upload_for_threat", return_value=True)
    @patch("main._probe_media", return_value={"format": {"duration": 14.0}, "streams": [{"codec_type": "video"}]})
    @patch("main.verify_token", return_value={"uid": "smoke-user"})
    @patch("main.processor.generate_captions_only", new_callable=AsyncMock)
    @patch("main._process_export_job_core", new_callable=AsyncMock)
    @patch("main._safe_find_upload")
    def test_upload_process_export_smoke(self, mock_safe_find, mock_export_core, mock_process, _verify_token, _probe, _scan):
        # 1) Upload
        files = {"file": ("sample.mp4", io.BytesIO(b"fake-video"), "video/mp4")}
        upload_res = self.client.post("/api/upload", files=files)
        self.assertEqual(upload_res.status_code, 200)
        upload_data = upload_res.json()
        self.assertTrue(upload_data.get("success"))
        file_id = upload_data["file_id"]

        # 2) Process
        mock_safe_find.return_value = os.path.join(os.path.abspath(os.sep), "tmp", f"{file_id}.mp4")
        mock_process.return_value = {"success": True, "captions": [{"id": 1, "text": "Hello world", "start_time": 0.0, "end_time": 1.5}]}
        process_res = self.client.post(
            "/api/process",
            json={"file_id": file_id, "language": "english", "id_token": "token-123"},
        )
        self.assertEqual(process_res.status_code, 200)
        process_data = process_res.json()
        self.assertTrue(process_data.get("success"))
        self.assertTrue(process_data.get("captions"))

        # 3) Export (sync fallback path mocked)
        mock_export_core.return_value = {
            "success": True,
            "video_url": "/exports/fake.mp4",
            "expires_at": "2099-01-01T00:00:00Z",
            "retention_hours": 24,
            "export_job_id": "job-1",
            "export_profile": {"tier": "starter", "quality": "1080p", "fps": 30, "downgraded": False},
        }
        export_res = self.client.post(
            "/api/export",
            json={
                "file_id": file_id,
                "captions": [{"id": "1", "text": "Hello world", "start_time": 0.0, "end_time": 1.5}],
                "style": {},
                "word_layouts": {},
                "id_token": "token-123",
                "quality": "1080p",
                "fps": 30,
            },
        )
        self.assertEqual(export_res.status_code, 200)
        export_data = export_res.json()
        self.assertTrue(export_data.get("success"))
        self.assertIn("export_job_id", export_data)

    @patch("main.RAZORPAY_WEBHOOK_SECRET", "test-secret")
    def test_payment_webhook_invalid_signature_smoke(self):
        res = self.client.post(
            "/api/razorpay-webhook",
            headers={"x-razorpay-signature": "invalid"},
            json={"event": "payment.captured", "payload": {}},
        )
        self.assertEqual(res.status_code, 400)


if __name__ == "__main__":
    unittest.main()
