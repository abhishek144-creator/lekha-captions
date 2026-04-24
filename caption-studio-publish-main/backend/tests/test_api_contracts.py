import io
import os
import sys
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import main
from main import app


class ApiContractTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        main._export_jobs.clear()
        main._active_exports_by_user.clear()

    def tearDown(self):
        main._export_jobs.clear()
        main._active_exports_by_user.clear()

    @patch("main._scan_upload_for_threat", return_value=True)
    @patch("main._probe_media", return_value={"format": {"duration": 12.3}, "streams": [{"codec_type": "video"}]})
    def test_upload_contract(self, _probe, _scan):
        files = {"file": ("sample.mp4", io.BytesIO(b"fake-bytes"), "video/mp4")}
        res = self.client.post("/api/upload", files=files)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("success", data)
        self.assertIn("file_id", data)
        self.assertIn("raw_url", data)

    @patch("main.verify_token", return_value={"uid": "process-user"})
    @patch("main.processor.generate_captions_only", new_callable=AsyncMock)
    @patch("main._safe_find_upload", return_value="C:/tmp/sample.mp4")
    def test_process_contract(self, _safe_find, mock_process, _verify_token):
        mock_process.return_value = {"success": True, "captions": [{"id": 1, "text": "hello", "start_time": 0, "end_time": 1}]}
        res = self.client.post(
            "/api/process",
            json={
                "file_id": "123e4567-e89b-12d3-a456-426614174000",
                "language": "english",
                "id_token": "token-123",
            },
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("success", data)
        self.assertIn("captions", data)

    def test_process_requires_auth(self):
        res = self.client.post(
            "/api/process",
            json={"file_id": "123e4567-e89b-12d3-a456-426614174000", "language": "english", "id_token": ""},
        )
        self.assertEqual(res.status_code, 401)

    def test_export_requires_auth(self):
        res = self.client.post(
            "/api/export",
            json={
                "file_id": "123e4567-e89b-12d3-a456-426614174000",
                "captions": [{"id": "1", "text": "Hello", "start_time": 0.0, "end_time": 1.0}],
                "style": {},
                "word_layouts": {},
                "id_token": "",
                "quality": "1080p",
                "fps": 30,
            },
        )
        self.assertEqual(res.status_code, 401)

    def test_export_status_contract_not_found(self):
        res = self.client.get("/api/export-status/missing-job")
        self.assertEqual(res.status_code, 404)
        self.assertIn("detail", res.json())

    @patch("main.verify_token")
    def test_export_status_requires_owner_auth(self, mock_verify_token):
        job_id = "job-auth-check"
        main._export_jobs[job_id] = {
            "uid": "owner-uid",
            "status": "completed",
            "payload": {"success": True, "video_url": "/exports/owner.mp4"},
        }

        res_unauth = self.client.get(f"/api/export-status/{job_id}")
        self.assertEqual(res_unauth.status_code, 401)

        mock_verify_token.return_value = {"uid": "other-user"}
        res_forbidden = self.client.get(
            f"/api/export-status/{job_id}",
            headers={"Authorization": "Bearer other-token"},
        )
        self.assertEqual(res_forbidden.status_code, 403)

        mock_verify_token.return_value = {"uid": "owner-uid"}
        res_ok = self.client.get(
            f"/api/export-status/{job_id}",
            headers={"Authorization": "Bearer owner-token"},
        )
        self.assertEqual(res_ok.status_code, 200)
        self.assertEqual(res_ok.json().get("status"), "completed")

    @patch("main.verify_token")
    def test_export_replay_requires_owner_auth(self, mock_verify_token):
        job = {
            "uid": "owner-uid",
            "request_snapshot": {
                "file_id": "123e4567-e89b-12d3-a456-426614174000",
                "captions": [{"id": "1", "text": "Hello", "start_time": 0.0, "end_time": 1.0}],
                "style": {},
                "word_layouts": {},
                "quality": "1080p",
                "fps": 30,
            },
        }

        class FakeDoc:
            exists = True

            def to_dict(self):
                return job

        class FakeCollection:
            def document(self, _job_id):
                return SimpleNamespace(get=lambda: FakeDoc())

        class FakeDb:
            def collection(self, _name):
                return FakeCollection()

        class FakeQueue:
            def enqueue_call(self, **kwargs):
                return kwargs

        with patch.object(main, "_export_queue", FakeQueue()), patch.object(main, "get_db", return_value=FakeDb()):
            res_unauth = self.client.post("/api/export-replay/job-1")
            self.assertEqual(res_unauth.status_code, 401)

            mock_verify_token.return_value = {"uid": "other-user"}
            res_forbidden = self.client.post(
                "/api/export-replay/job-1",
                headers={"Authorization": "Bearer other-token"},
            )
            self.assertEqual(res_forbidden.status_code, 403)

            mock_verify_token.return_value = {"uid": "owner-uid"}
            res_ok = self.client.post(
                "/api/export-replay/job-1",
                headers={"Authorization": "Bearer owner-token"},
            )
            self.assertEqual(res_ok.status_code, 200)
            self.assertTrue(res_ok.json().get("success"))

    @patch("main.verify_token", return_value={"uid": "queue-user"})
    def test_queued_export_retains_user_slot_and_sanitizes_snapshot(self, _verify_token):
        captured = {}

        class FakeQueue:
            def enqueue_call(self, **kwargs):
                captured.update(kwargs)
                return {"queued": True}

        with patch.object(main, "_export_queue", FakeQueue()):
            res = self.client.post(
                "/api/export",
                json={
                    "file_id": "123e4567-e89b-12d3-a456-426614174000",
                    "captions": [{"id": "1", "text": "Hello", "start_time": 0.0, "end_time": 1.0}],
                    "style": {},
                    "word_layouts": {},
                    "id_token": "secret-token",
                    "quality": "1080p",
                    "fps": 30,
                },
            )

        self.assertEqual(res.status_code, 200)
        payload = res.json()
        self.assertTrue(payload.get("queued"))
        self.assertEqual(main._active_exports_by_user.get("queue-user"), 1)

        job = main._export_jobs[payload["export_job_id"]]
        self.assertNotIn("id_token", job.get("request_snapshot", {}))
        self.assertEqual(captured["args"][1].get("id_token"), None)

        res_second = self.client.post(
            "/api/export",
            json={
                "file_id": "123e4567-e89b-12d3-a456-426614174001",
                "captions": [{"id": "1", "text": "Hello", "start_time": 0.0, "end_time": 1.0}],
                "style": {},
                "word_layouts": {},
                "id_token": "secret-token",
                "quality": "1080p",
                "fps": 30,
            },
        )
        self.assertEqual(res_second.status_code, 429)

    @patch("main.verify_token", return_value={"uid": "payment-user"})
    def test_verify_payment_fails_closed_when_live_fetch_fails(self, _verify_token):
        fake_client = SimpleNamespace(
            utility=SimpleNamespace(verify_payment_signature=lambda params: True),
            payment=SimpleNamespace(fetch=lambda payment_id: (_ for _ in ()).throw(RuntimeError("network down"))),
        )

        with patch.object(main, "rzp_client", fake_client), patch.object(main, "RAZORPAY_AVAILABLE", True):
            res = self.client.post(
                "/api/verify-payment",
                json={
                    "razorpay_order_id": "order_123",
                    "razorpay_payment_id": "pay_123",
                    "razorpay_signature": "sig_123",
                    "id_token": "token_123",
                    "idempotency_key": "idem_123",
                },
            )

        self.assertEqual(res.status_code, 502)
        self.assertIn("detail", res.json())

    @patch("main.verify_token", return_value=None)
    def test_translate_requires_auth(self, _verify_token):
        res = self.client.post(
            "/api/translate",
            json={"captions": [{"id": "1", "text": "Hello"}], "target_language": "Hindi", "id_token": ""},
        )
        self.assertEqual(res.status_code, 401)

    def test_detect_language_requires_auth(self):
        res = self.client.post(
            "/api/detect-language",
            json={"file_id": "123e4567-e89b-12d3-a456-426614174000", "id_token": ""},
        )
        self.assertEqual(res.status_code, 401)

    @patch("main.verify_token", return_value={"uid": "translate-user"})
    def test_translate_contract_with_auth(self, _verify_token):
        fake_choice = SimpleNamespace(message=SimpleNamespace(content="1. Namaste"))
        fake_client = SimpleNamespace(
            chat=SimpleNamespace(
                completions=SimpleNamespace(create=lambda **kwargs: SimpleNamespace(choices=[fake_choice]))
            )
        )
        with patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"}), patch("openai.OpenAI", return_value=fake_client):
            res = self.client.post(
                "/api/translate",
                json={
                    "captions": [{"id": "1", "text": "Hello"}],
                    "target_language": "Hindi",
                    "id_token": "token-123",
                },
            )
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json().get("success"))

    @patch("main.firebase_auth.delete_user")
    @patch("main.verify_token", return_value={"uid": "delete-user"})
    def test_account_delete_clears_payments_and_auth_user(self, _verify_token, mock_delete_user):
        deleted = []

        class FakePaymentDoc:
            def __init__(self, doc_id):
                self.id = doc_id
                self.reference = SimpleNamespace(delete=lambda: deleted.append(doc_id))

        class FakeUserDoc:
            exists = True

            def to_dict(self):
                return {"history": [{"firebase_path": "exports/delete-user/export.mp4"}]}

        class FakePaymentsCollection:
            def stream(self):
                return [FakePaymentDoc("pay_1"), FakePaymentDoc("pay_2")]

        class FakeUserRef:
            def get(self):
                return FakeUserDoc()

            def collection(self, name):
                self.last_collection = name
                return FakePaymentsCollection()

            def delete(self):
                deleted.append("user_doc")

        class FakeUsersCollection:
            def document(self, uid):
                return FakeUserRef()

        class FakeDb:
            def collection(self, name):
                self.last_name = name
                return FakeUsersCollection()

        with patch.object(main, "get_db", return_value=FakeDb()), patch.object(main, "delete_from_firebase_storage", return_value=True):
            res = self.client.post("/api/account-delete", json={"id_token": "token-123"})

        self.assertEqual(res.status_code, 200)
        self.assertIn("pay_1", deleted)
        self.assertIn("pay_2", deleted)
        self.assertIn("user_doc", deleted)
        mock_delete_user.assert_called_once_with("delete-user")

    def test_create_order_requires_auth(self):
        res = self.client.post("/api/create-order", json={"plan_id": "starter", "id_token": "invalid-token", "currency": "INR"})
        self.assertEqual(res.status_code, 401)

    def test_api_version_contract(self):
        res = self.client.get("/api/version")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("version", data)
        self.assertIn("min_supported_version", data)

    def test_slo_and_readiness_contract(self):
        slo_res = self.client.get("/api/slo/status")
        self.assertEqual(slo_res.status_code, 200)
        self.assertIn("release_gate_passed", slo_res.json())

        ready_res = self.client.get("/api/health/readiness")
        self.assertEqual(ready_res.status_code, 200)
        ready_data = ready_res.json()
        self.assertIn("ready", ready_data)
        self.assertIn("slo", ready_data)


if __name__ == "__main__":
    unittest.main()
