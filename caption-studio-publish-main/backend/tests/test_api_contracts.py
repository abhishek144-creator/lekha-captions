import io
import os
import sys
import tempfile
from datetime import datetime, timedelta, timezone
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
        main._export_idempotency.clear()
        main._active_exports_by_user.clear()
        main._active_processes_by_user.clear()
        main._payment_idempotency.clear()
        main._upload_owners.clear()
        main._payment_rate.clear()
        main._signup_rate.clear()
        main._upload_rate.clear()
        main._process_rate.clear()
        main._detect_language_rate.clear()
        main._translate_rate.clear()

    def tearDown(self):
        main._export_jobs.clear()
        main._export_idempotency.clear()
        main._active_exports_by_user.clear()
        main._active_processes_by_user.clear()
        main._payment_idempotency.clear()
        main._upload_owners.clear()
        main._payment_rate.clear()
        main._signup_rate.clear()
        main._upload_rate.clear()
        main._process_rate.clear()
        main._detect_language_rate.clear()
        main._translate_rate.clear()

    def test_export_daily_limit_relaxed_outside_production(self):
        # Local/dev runs stay unthrottled so export debugging is not blocked.
        self.assertTrue(main.DISABLE_EXPORT_DAILY_LIMIT)

    def test_export_daily_limit_is_enforced_when_not_disabled(self):
        user_data = {
            "subscription_tier": "creator",
            "subscription_expiry": (datetime.now(timezone.utc) + timedelta(days=5)).isoformat(),
            "credits_remaining": 40,
            "export_timestamps": [1_700_000_000.0 - 60] * 5,
        }

        with patch.object(main, "DISABLE_EXPORT_DAILY_LIMIT", False):
            allowed, detail, _recent = main._evaluate_export_policy(user_data, 1_700_000_000.0)

        self.assertFalse(allowed)
        self.assertIn("Limit reached", detail)

    def test_service_controls_default_to_open(self):
        main._service_control_cache.update({"ts": 0.0, "value": {}})
        with patch.object(main, "get_db", return_value=None):
            controls = main._read_service_controls(force=True)

        for key in main.SERVICE_CONTROL_KEYS:
            self.assertFalse(controls[key], key)
        main._assert_service_available("pause_exports")

    def test_paused_control_blocks_with_503(self):
        paused = main._default_service_controls()
        paused["pause_exports"] = True

        with patch.object(main, "_read_service_controls", return_value=paused):
            with self.assertRaises(main.HTTPException) as ctx:
                main._assert_service_available("pause_exports")
            self.assertEqual(ctx.exception.status_code, 503)
            # An unrelated switch stays open.
            main._assert_service_available("pause_uploads")

    def test_maintenance_mode_blocks_every_control(self):
        paused = main._default_service_controls()
        paused["maintenance_mode"] = True
        paused["notice"] = "Back at 9pm IST."

        with patch.object(main, "_read_service_controls", return_value=paused):
            for key in ("pause_payments", "pause_uploads", "pause_transcription", "pause_exports", "pause_signups"):
                with self.assertRaises(main.HTTPException) as ctx:
                    main._assert_service_available(key)
                self.assertEqual(ctx.exception.status_code, 503)
                self.assertEqual(ctx.exception.detail, "Back at 9pm IST.")

    def test_service_status_is_public_and_admin_write_requires_admin(self):
        paused = main._default_service_controls()
        paused["pause_signups"] = True

        with patch.object(main, "_read_service_controls", return_value=paused):
            res = self.client.get("/api/service-status")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json()["controls"]["pause_signups"])
        self.assertFalse(res.json()["controls"]["pause_exports"])

        with patch.object(main, "verify_token", return_value=None):
            denied = self.client.post(
                "/api/admin/service-controls",
                json={"id_token": "not-an-admin", "pause_exports": True},
            )
        self.assertEqual(denied.status_code, 403)

    def test_service_controls_read_failure_fails_open(self):
        class ExplodingDb:
            def collection(self, *_args, **_kwargs):
                raise RuntimeError("firestore unavailable")

        main._service_control_cache.update({"ts": 0.0, "value": {}})
        with patch.object(main, "get_db", return_value=ExplodingDb()):
            controls = main._read_service_controls(force=True)

        self.assertFalse(controls["maintenance_mode"])

    def test_expired_paid_plan_is_blocked_even_with_remaining_credits(self):
        expired_at = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
        user_data = {
            "subscription_tier": "pro",
            "subscription_expiry": expired_at,
            "credits_remaining": 20,
            "export_timestamps": [],
        }

        allowed, detail, _recent = main._evaluate_export_policy(user_data, 1_700_000_000.0)

        self.assertFalse(allowed)
        self.assertIn("PLAN_EXPIRED", detail)
        self.assertEqual(main._effective_subscription_tier(user_data), "free")

    def test_active_paid_plan_keeps_entitlements(self):
        active_until = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
        user_data = {
            "subscription_tier": "creator",
            "subscription_expiry": active_until,
            "credits_remaining": 4,
            "export_timestamps": [],
        }

        allowed, detail, _recent = main._evaluate_export_policy(user_data, 1_700_000_000.0)

        self.assertTrue(allowed)
        self.assertEqual(detail, "")
        self.assertEqual(main._effective_subscription_tier(user_data), "creator")

    def test_paid_plan_without_expiry_fails_closed(self):
        user_data = {
            "subscription_tier": "pro",
            "credits_remaining": 20,
            "export_timestamps": [],
        }

        allowed, detail, _recent = main._evaluate_export_policy(user_data, 1_700_000_000.0)

        self.assertFalse(allowed)
        self.assertIn("PLAN_EXPIRED", detail)
        self.assertEqual(main._effective_subscription_tier(user_data), "free")

    @patch("main._authenticate_media_request", return_value={"uid": "rate-limited-user"})
    @patch("main._get_recent_export_failures", return_value=[0.0] * main.EXPORT_FAILURE_LIMIT)
    def test_export_failure_rate_limit_is_always_enforced(self, _recent_failures, _authenticate):
        res = self.client.post(
            "/api/export",
            json={
                "file_id": "123e4567-e89b-12d3-a456-426614174099",
                "captions": [{"id": "1", "text": "Hello", "start_time": 0.0, "end_time": 1.0}],
                "style": {},
                "word_layouts": {},
                "id_token": "token",
                "quality": "1080p",
                "fps": 30,
            },
        )

        self.assertEqual(res.status_code, 429)
        self.assertIn("Too many failed export attempts", res.json()["detail"])

    def test_media_tokens_reject_tampering_expiry_and_wrong_kind(self):
        token = main._create_media_token({
            "kind": "upload",
            "uid": "media-user",
            "file_id": "file-1",
            "exp": 4102444800,
        })

        self.assertEqual(main._verify_media_token(token, "upload")["uid"], "media-user")

        tampered = f"{token[:-1]}{'0' if token[-1] != '0' else '1'}"
        with self.assertRaises(Exception):
            main._verify_media_token(tampered, "upload")

        with self.assertRaises(Exception):
            main._verify_media_token(token, "export")

        expired = main._create_media_token({
            "kind": "upload",
            "uid": "media-user",
            "file_id": "file-1",
            "exp": 1,
        })
        with self.assertRaises(Exception):
            main._verify_media_token(expired, "upload")

    def test_upload_materializes_from_shared_storage_on_another_instance(self):
        file_id = "123e4567-e89b-12d3-a456-426614174055"

        def fake_download(remote_path, local_path):
            self.assertEqual(remote_path, f"uploads/media-user/{file_id}.mp4")
            with open(local_path, "wb") as handle:
                handle.write(b"shared-media")
            return True

        with (
            tempfile.TemporaryDirectory() as scratch,
            patch.object(main, "UPLOAD_DIR", scratch),
            patch.object(main, "_load_upload_metadata", return_value={
                "uid": "media-user",
                "remote_path": f"uploads/media-user/{file_id}.mp4",
                "extension": "mp4",
            }),
            patch.object(main, "download_from_firebase_storage", side_effect=fake_download),
        ):
            path = main._safe_find_upload(file_id)
            self.assertTrue(path and os.path.isfile(path))
            with open(path, "rb") as handle:
                self.assertEqual(handle.read(), b"shared-media")

    @patch("main._scan_upload_for_threat", return_value=True)
    @patch("main._probe_media", return_value={"format": {"duration": 12.3}, "streams": [{"codec_type": "video"}]})
    @patch("main.verify_token", return_value={"uid": "upload-user"})
    def test_upload_contract(self, _verify_token, _probe, _scan):
        files = {"file": ("sample.mp4", io.BytesIO(b"fake-bytes"), "video/mp4")}
        res = self.client.post("/api/upload", files=files, headers={"Authorization": "Bearer token-123"})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("success", data)
        self.assertIn("file_id", data)
        self.assertIn("raw_url", data)
        self.assertTrue(data["raw_url"].startswith("/api/media/upload/"))

        media_res = self.client.get(data["raw_url"])
        self.assertEqual(media_res.status_code, 200)

    def test_upload_requires_auth(self):
        files = {"file": ("sample.mp4", io.BytesIO(b"fake-bytes"), "video/mp4")}
        res = self.client.post("/api/upload", files=files)
        self.assertEqual(res.status_code, 401)

    @patch("main.verify_token", return_value={"uid": "process-user"})
    @patch("main.processor.generate_captions_only", new_callable=AsyncMock)
    @patch("main._safe_find_upload", return_value="C:/tmp/sample.mp4")
    def test_process_contract(self, _safe_find, mock_process, _verify_token):
        mock_process.return_value = {"success": True, "captions": [{"id": 1, "text": "hello", "start_time": 0, "end_time": 1}]}
        main._upload_owners["123e4567-e89b-12d3-a456-426614174000"] = "process-user"
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

    def test_process_slot_allows_only_one_active_request_per_user(self):
        self.assertTrue(main._acquire_process_slot("process-user", "request-1"))
        self.assertFalse(main._acquire_process_slot("process-user", "request-2"))
        main._release_process_slot("process-user", "request-2")
        self.assertFalse(main._acquire_process_slot("process-user", "request-3"))
        main._release_process_slot("process-user", "request-1")
        self.assertTrue(main._acquire_process_slot("process-user", "request-3"))

    @patch("main.verify_token", return_value={"uid": "process-user"})
    @patch("main._safe_find_upload", return_value="C:/tmp/sample.mp4")
    def test_process_rejects_duplicate_in_flight_request(self, _safe_find, _verify_token):
        file_id = "123e4567-e89b-12d3-a456-426614174000"
        main._upload_owners[file_id] = "process-user"
        main._active_processes_by_user["process-user"] = "existing-request"

        res = self.client.post(
            "/api/process",
            json={"file_id": file_id, "language": "english", "id_token": "token-123"},
        )

        self.assertEqual(res.status_code, 409)
        self.assertIn("already running", res.json()["detail"])

    @patch("main.verify_token", return_value={"uid": "process-user"})
    @patch("main.processor.generate_captions_only", new_callable=AsyncMock)
    @patch("main._safe_find_upload", return_value="C:/tmp/sample.mp4")
    def test_process_rejects_successful_empty_transcription(self, _safe_find, mock_process, _verify_token):
        mock_process.return_value = {"success": True, "captions": []}
        file_id = "123e4567-e89b-12d3-a456-426614174000"
        main._upload_owners[file_id] = "process-user"
        res = self.client.post(
            "/api/process",
            json={"file_id": file_id, "language": "english", "id_token": "token-123"},
        )
        self.assertEqual(res.status_code, 422)

    @patch("main.verify_token", return_value={"uid": "process-user"})
    @patch("main._release_ai_quota")
    @patch("main.processor.generate_captions_only", new_callable=AsyncMock)
    @patch("main._safe_find_upload", return_value="C:/tmp/sample.mp4")
    def test_process_returns_ai_quota_when_provider_fails(
        self, _safe_find, mock_process, mock_release, _verify_token
    ):
        """A provider-side transcription failure must not burn the daily quota."""
        mock_process.return_value = {"success": False, "error": "Sarvam request failed"}
        file_id = "123e4567-e89b-12d3-a456-426614174000"
        main._upload_owners[file_id] = "process-user"

        res = self.client.post(
            "/api/process",
            json={"file_id": file_id, "language": "english", "id_token": "token-123"},
        )

        self.assertEqual(res.status_code, 502)
        mock_release.assert_called_once_with("process-user", "process")

    @patch("main.verify_token", return_value={"uid": "process-user"})
    @patch("main._release_ai_quota")
    @patch("main.processor.generate_captions_only", new_callable=AsyncMock)
    @patch("main._safe_find_upload", return_value="C:/tmp/sample.mp4")
    def test_process_raising_provider_returns_ai_quota(
        self, _safe_find, mock_process, mock_release, _verify_token
    ):
        """An exception from the provider is still our fault — release the hold."""
        mock_process.side_effect = RuntimeError("provider exploded")
        file_id = "123e4567-e89b-12d3-a456-426614174000"
        main._upload_owners[file_id] = "process-user"

        with self.assertRaises(RuntimeError):
            self.client.post(
                "/api/process",
                json={"file_id": file_id, "language": "english", "id_token": "token-123"},
            )

        mock_release.assert_called_once_with("process-user", "process")

    @patch("main.verify_token", return_value={"uid": "process-user"})
    @patch("main._release_ai_quota")
    @patch("main.processor.generate_captions_only", new_callable=AsyncMock)
    @patch("main._safe_find_upload", return_value="C:/tmp/sample.mp4")
    def test_process_keeps_ai_quota_when_audio_has_no_speech(
        self, _safe_find, mock_process, mock_release, _verify_token
    ):
        """NO_SPEECH is a real provider run that billed us — the call stays spent."""
        mock_process.return_value = {"success": True, "captions": []}
        file_id = "123e4567-e89b-12d3-a456-426614174000"
        main._upload_owners[file_id] = "process-user"

        res = self.client.post(
            "/api/process",
            json={"file_id": file_id, "language": "english", "id_token": "token-123"},
        )

        self.assertEqual(res.status_code, 422)
        mock_release.assert_not_called()

    def test_request_models_reject_invalid_caption_and_word_range(self):
        export_res = self.client.post(
            "/api/export",
            json={
                "file_id": "123e4567-e89b-12d3-a456-426614174000",
                "captions": [{"id": "1", "text": "   ", "start_time": 1, "end_time": 0}],
            },
        )
        process_res = self.client.post(
            "/api/process",
            json={
                "file_id": "123e4567-e89b-12d3-a456-426614174000",
                "min_words": 5,
                "max_words": 2,
            },
        )
        self.assertEqual(export_res.status_code, 422)
        self.assertEqual(process_res.status_code, 422)

    def test_export_rejects_executable_template_markup_before_auth(self):
        res = self.client.post(
            "/api/export",
            json={
                "file_id": "123e4567-e89b-12d3-a456-426614174000",
                "captions": [{
                    "id": "1",
                    "text": "Hello",
                    "start_time": 0,
                    "end_time": 1,
                    "template_markup": '<img src="http://127.0.0.1/secret" onerror="fetch(\'/\')">',
                }],
            },
        )
        self.assertEqual(res.status_code, 422)
        self.assertIn("unsafe", str(res.json()).lower())

    def test_process_requires_auth(self):
        res = self.client.post(
            "/api/process",
            json={"file_id": "123e4567-e89b-12d3-a456-426614174000", "language": "english", "id_token": ""},
        )
        self.assertEqual(res.status_code, 401)

    @patch("main.LOCAL_DEV_AUTH_BYPASS_ENABLED", True)
    @patch("main.processor.generate_captions_only", new_callable=AsyncMock)
    @patch("main._safe_find_upload", return_value="C:/tmp/sample.mp4")
    def test_process_accepts_explicitly_enabled_local_dev_bypass_token(self, _safe_find, mock_process):
        mock_process.return_value = {"success": True, "captions": [{"id": 1, "text": "hello", "start_time": 0, "end_time": 1}]}
        main._upload_owners["123e4567-e89b-12d3-a456-426614174000"] = "dev-local-user"
        res = self.client.post(
            "/api/process",
            json={
                "file_id": "123e4567-e89b-12d3-a456-426614174000",
                "language": "english",
                "id_token": "mock-token",
            },
        )
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json().get("success"))

    @patch("main.verify_token", return_value={"uid": "process-user"})
    @patch("main._safe_find_upload", return_value="C:/tmp/sample.mp4")
    def test_process_fails_closed_when_upload_owner_is_unknown(self, _safe_find, _verify_token):
        res = self.client.post(
            "/api/process",
            json={
                "file_id": "123e4567-e89b-12d3-a456-426614174000",
                "language": "english",
                "id_token": "token-123",
            },
        )
        self.assertEqual(res.status_code, 403)

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

    def test_export_status_allows_local_dev_mock_token_for_dev_job(self):
        job_id = "job-dev-auth-check"
        main._export_jobs[job_id] = {
            "uid": "dev-local-user",
            "status": "completed",
            "payload": {"success": True, "video_url": "/api/media/export/dev.mp4"},
        }

        with patch.object(main, "LOCAL_DEV_AUTH_BYPASS_ENABLED", True):
            res = self.client.get(
                f"/api/export-status/{job_id}",
                headers={"Authorization": "Bearer mock-token"},
            )

        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json().get("status"), "completed")

    @patch("main.verify_token")
    def test_export_replay_requires_owner_auth(self, mock_verify_token):
        job = {
            "uid": "owner-uid",
            "status": "failed",
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

        with (
            patch.object(main, "_export_queue", FakeQueue()),
            patch.object(main, "get_db", return_value=FakeDb()),
            patch.object(main, "_persist_export_job", return_value=True),
        ):
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

            job["status"] = "completed"
            res_completed = self.client.post(
                "/api/export-replay/job-1",
                headers={"Authorization": "Bearer owner-token"},
            )
            self.assertEqual(res_completed.status_code, 409)

    @patch("main.verify_token", return_value={"uid": "queue-user"})
    def test_queued_export_retains_user_slot_and_sanitizes_snapshot(self, _verify_token):
        captured = {}

        class FakeQueue:
            def enqueue_call(self, **kwargs):
                captured.update(kwargs)
                return {"queued": True}

        with (
            patch.object(main, "_export_queue", FakeQueue()),
            patch.object(main, "_persist_export_job", return_value=True),
        ):
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
        self.assertEqual(
            main._active_exports_by_user.get("queue-user"),
            payload["export_job_id"],
        )

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

    def test_export_slot_can_only_be_released_by_its_owner(self):
        self.assertTrue(main._acquire_export_slot("lease-user", "job-a"))
        self.assertTrue(main._acquire_export_slot("lease-user", "job-a"))
        self.assertFalse(main._acquire_export_slot("lease-user", "job-b"))

        main._release_export_slot("lease-user", "job-b")
        self.assertEqual(main._active_exports_by_user.get("lease-user"), "job-a")

        main._release_export_slot("lease-user", "job-a")
        self.assertNotIn("lease-user", main._active_exports_by_user)

    @patch("main.verify_token", return_value={"uid": "idem-user"})
    def test_queued_export_idempotency_tracks_job_and_request_fingerprint(self, _verify_token):
        class FakeQueue:
            def enqueue_call(self, **kwargs):
                return kwargs

        request_body = {
            "file_id": "123e4567-e89b-12d3-a456-426614174010",
            "captions": [{"id": "1", "text": "Hello", "start_time": 0.0, "end_time": 1.0}],
            "style": {},
            "word_layouts": {},
            "id_token": "secret-token",
            "idempotency_key": "stable-export-key",
            "quality": "1080p",
            "fps": 30,
        }
        with (
            patch.object(main, "_export_queue", FakeQueue()),
            patch.object(main, "_persist_export_job", return_value=True),
        ):
            first = self.client.post("/api/export", json=request_body)
            replay = self.client.post("/api/export", json=request_body)
            changed = self.client.post(
                "/api/export",
                json={
                    **request_body,
                    "captions": [{"id": "1", "text": "Changed", "start_time": 0.0, "end_time": 1.0}],
                },
            )

        self.assertEqual(first.status_code, 200)
        self.assertEqual(replay.status_code, 200)
        self.assertTrue(replay.json().get("idempotent_replay"))
        self.assertEqual(changed.status_code, 409)
        marker = main._export_idempotency["idem-user:stable-export-key"]
        self.assertEqual(marker["status"], "in_progress")
        self.assertEqual(marker["job_id"], first.json()["export_job_id"])

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

    @patch("main.verify_token", return_value={"uid": "payment-user"})
    def test_verify_payment_rejects_uncaptured_payment(self, _verify_token):
        fake_client = SimpleNamespace(
            utility=SimpleNamespace(verify_payment_signature=lambda params: True),
            payment=SimpleNamespace(fetch=lambda payment_id: {
                "id": payment_id,
                "order_id": "order_123",
                "status": "authorized",
                "amount": 29900,
                "currency": "INR",
            }),
            order=SimpleNamespace(fetch=lambda order_id: {
                "id": order_id,
                "amount": 29900,
                "currency": "INR",
                "notes": {"uid": "payment-user", "plan_id": "starter"},
            }),
        )

        with patch.object(main, "rzp_client", fake_client), patch.object(main, "RAZORPAY_AVAILABLE", True):
            res = self.client.post(
                "/api/verify-payment",
                json={
                    "razorpay_order_id": "order_123",
                    "razorpay_payment_id": "pay_123",
                    "razorpay_signature": "sig_123",
                    "id_token": "token_123",
                    "plan_id": "starter",
                    "idempotency_key": "idem_uncaptured",
                },
            )

        self.assertEqual(res.status_code, 400)
        self.assertIn("not captured", res.json()["detail"])

    @patch("main.verify_token", return_value={"uid": "payment-user"})
    def test_verify_payment_rejects_plan_mismatch_with_order_notes(self, _verify_token):
        fake_client = SimpleNamespace(
            utility=SimpleNamespace(verify_payment_signature=lambda params: True),
            payment=SimpleNamespace(fetch=lambda payment_id: {
                "id": payment_id,
                "order_id": "order_123",
                "status": "captured",
                "amount": 29900,
                "currency": "INR",
            }),
            order=SimpleNamespace(fetch=lambda order_id: {
                "id": order_id,
                "amount": 29900,
                "currency": "INR",
                "notes": {"uid": "payment-user", "plan_id": "starter"},
            }),
        )

        with patch.object(main, "rzp_client", fake_client), patch.object(main, "RAZORPAY_AVAILABLE", True):
            res = self.client.post(
                "/api/verify-payment",
                json={
                    "razorpay_order_id": "order_123",
                    "razorpay_payment_id": "pay_123",
                    "razorpay_signature": "sig_123",
                    "id_token": "token_123",
                    "plan_id": "pro",
                    "idempotency_key": "idem_plan_mismatch",
                },
            )

        self.assertEqual(res.status_code, 400)
        self.assertIn("selected plan", res.json()["detail"])

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
            def limit(self, _count):
                return self

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

        with (
            patch.object(main, "get_db", return_value=FakeDb()),
            patch.object(main, "delete_from_firebase_storage", return_value=True),
            patch.object(main, "delete_user_exports", return_value=1),
            patch.object(main, "delete_user_uploads", return_value=1),
        ):
            res = self.client.post("/api/account-delete", json={"id_token": "token-123"})

        self.assertEqual(res.status_code, 200)
        self.assertIn("pay_1", deleted)
        self.assertIn("pay_2", deleted)
        self.assertIn("user_doc", deleted)
        mock_delete_user.assert_called_once_with("delete-user")

    @patch("main.firebase_auth.delete_user")
    @patch("main.verify_token", return_value={"uid": "delete-user"})
    def test_account_delete_keeps_auth_when_firestore_cleanup_fails(self, _verify_token, mock_delete_user):
        class FakeUserDoc:
            exists = True

            def to_dict(self):
                return {"history": []}

        class FakeUserRef:
            def get(self):
                return FakeUserDoc()

            def set(self, *_args, **_kwargs):
                return None

        fake_ref = FakeUserRef()
        fake_db = SimpleNamespace(
            collection=lambda _name: SimpleNamespace(document=lambda _uid: fake_ref),
        )
        with (
            patch.object(main, "get_db", return_value=fake_db),
            patch.object(main, "delete_user_exports", return_value=0),
            patch.object(main, "_delete_user_document_tree", side_effect=RuntimeError("firestore unavailable")),
        ):
            response = self.client.post("/api/account-delete", json={"id_token": "token-123"})

        self.assertEqual(response.status_code, 500)
        mock_delete_user.assert_not_called()

    @patch("main.verify_token", return_value={"uid": "export-user"})
    def test_account_export_paginates_payments(self, _verify_token):
        class FakeDoc:
            exists = True

            def __init__(self, doc_id, data):
                self.id = doc_id
                self._data = data

            def to_dict(self):
                return dict(self._data)

        payment_docs = [
            FakeDoc("pay_3", {"timestamp": "2026-03-03T00:00:00Z"}),
            FakeDoc("pay_2", {"timestamp": "2026-03-02T00:00:00Z"}),
            FakeDoc("pay_1", {"timestamp": "2026-03-01T00:00:00Z"}),
        ]

        class FakePayments:
            def order_by(self, *_args, **_kwargs):
                return self

            def limit(self, count):
                self.count = count
                return self

            def stream(self):
                return payment_docs[:self.count]

        class FakeUserRef:
            def __init__(self):
                self.payments = FakePayments()

            def get(self):
                return FakeDoc("export-user", {"uid": "export-user"})

            def collection(self, _name):
                return self.payments

        user_ref = FakeUserRef()
        fake_db = SimpleNamespace(
            collection=lambda _name: SimpleNamespace(document=lambda _uid: user_ref),
        )
        with patch.object(main, "get_db", return_value=fake_db), patch.object(main, "_audit_action"):
            res = self.client.post(
                "/api/account-export",
                json={"id_token": "token-123", "payment_limit": 2},
            )

        self.assertEqual(res.status_code, 200)
        payload = res.json()["data"]
        self.assertEqual([item["id"] for item in payload["payments"]], ["pay_3", "pay_2"])
        self.assertTrue(payload["has_more_payments"])
        self.assertEqual(payload["next_payment_cursor"], "pay_2")

    def test_payment_grant_writes_claim_and_credits_in_one_transaction(self):
        class FakeSnapshot:
            def __init__(self, exists, data=None):
                self.exists = exists
                self._data = data or {}

            def to_dict(self):
                return dict(self._data)

        class FakeRef:
            def __init__(self, snapshot):
                self.snapshot = snapshot

            def get(self, transaction=None):
                self.transaction = transaction
                return self.snapshot

        class FakeTransaction:
            def __init__(self):
                self.writes = []

            def create(self, ref, data):
                self.writes.append(("create", ref, data))

            def update(self, ref, data):
                self.writes.append(("update", ref, data))

            def set(self, ref, data):
                self.writes.append(("set", ref, data))

        transaction = FakeTransaction()
        db = SimpleNamespace(transaction=lambda: transaction)
        user_ref = FakeRef(FakeSnapshot(True, {"subscription_tier": "free"}))
        payment_ref = FakeRef(FakeSnapshot(False))

        with patch.object(main.firestore, "transactional", new=lambda fn: fn):
            result = main._grant_payment_transactionally(
                db,
                user_ref,
                payment_ref,
                "payment-user",
                "starter",
                main.PLAN_PRICING["starter"],
                "pay_123",
                "order_123",
                main.PLAN_PRICING["starter"]["inr_paise"],
                "INR",
                "test",
                "",
            )

        self.assertTrue(result["success"])
        self.assertEqual([write[0] for write in transaction.writes], ["create", "update"])
        self.assertIs(payment_ref.transaction, transaction)
        self.assertIs(user_ref.transaction, transaction)

    def test_export_usage_is_recorded_once_per_job(self):
        class FakeSnapshot:
            def __init__(self, exists, data=None):
                self.exists = exists
                self._data = data or {}

            def to_dict(self):
                return dict(self._data)

        class FakeRef:
            def __init__(self, snapshot):
                self.snapshot = snapshot

            def get(self, transaction=None):
                return self.snapshot

        ledger_ref = FakeRef(FakeSnapshot(False))

        class FakeCollection:
            def document(self, _doc_id):
                return ledger_ref

        class FakeUserRef(FakeRef):
            def collection(self, _name):
                return FakeCollection()

        class FakeTransaction:
            def __init__(self):
                self.writes = []

            def create(self, ref, data):
                self.writes.append(("create", ref, data))
                ref.snapshot.exists = True

            def update(self, ref, data):
                self.writes.append(("update", ref, data))

        transactions = []

        def make_transaction():
            transaction = FakeTransaction()
            transactions.append(transaction)
            return transaction

        db = SimpleNamespace(transaction=make_transaction)
        user_ref = FakeUserRef(FakeSnapshot(True, {
            "credits_remaining": 2,
            "subscription_tier": "free",
            "history": [],
            "export_timestamps": [],
        }))
        history_item = {"id": "file-1", "export_job_id": "job-1"}

        with patch.object(main.firestore, "transactional", new=lambda fn: fn):
            main._record_export_usage(db, user_ref, history_item, 100.0, "job-1")
            main._record_export_usage(db, user_ref, history_item, 101.0, "job-1")

        self.assertEqual([write[0] for write in transactions[0].writes], ["create", "update"])
        self.assertEqual(transactions[1].writes, [])

    def test_payment_idempotency_fails_closed_when_redis_is_unavailable(self):
        class BrokenRedis:
            def get(self, _key):
                raise ConnectionError("redis unavailable")

        with patch.object(main, "_redis_client", BrokenRedis()):
            with self.assertRaises(main.HTTPException) as raised:
                main._payment_idem_get("payment-key")

        self.assertEqual(raised.exception.status_code, 503)

    def test_durable_queue_rejects_unpersisted_job_state(self):
        with (
            patch.object(main, "_export_queue", object()),
            patch.object(main, "_persist_export_job", return_value=False),
        ):
            with self.assertRaises(RuntimeError):
                main._set_export_job("durable-job", "queued", uid="owner")

    @patch("main.firebase_auth.delete_user")
    @patch("main.verify_token", return_value={"uid": "delete-user"})
    def test_account_delete_stops_when_cloud_cleanup_fails(self, _verify_token, mock_delete_user):
        class FakeUserDoc:
            exists = True

            def to_dict(self):
                return {"history": [{"firebase_path": "exports/delete-user/export.mp4"}]}

        class FakeUserRef:
            def get(self):
                return FakeUserDoc()

            def set(self, *_args, **_kwargs):
                return None

        fake_ref = FakeUserRef()
        fake_db = SimpleNamespace(
            collection=lambda _name: SimpleNamespace(document=lambda _uid: fake_ref),
        )
        with (
            patch.object(main, "get_db", return_value=fake_db),
            patch.object(main, "delete_user_exports", return_value=None),
        ):
            response = self.client.post("/api/account-delete", json={"id_token": "token-123"})

        self.assertEqual(response.status_code, 503)
        mock_delete_user.assert_not_called()

    @patch("main.verify_token", return_value={"uid": "delete-user"})
    def test_delete_file_proves_history_ownership_before_local_cleanup(self, _verify_token):
        class FakeUserDoc:
            exists = True

            def to_dict(self):
                return {"history": []}

        fake_ref = SimpleNamespace(get=lambda: FakeUserDoc())
        fake_db = SimpleNamespace(
            collection=lambda _name: SimpleNamespace(document=lambda _uid: fake_ref),
        )
        with (
            patch.object(main, "get_db", return_value=fake_db),
            patch.object(main, "_audit_action"),
            patch.object(main.os, "remove") as remove_file,
        ):
            response = self.client.post(
                "/api/delete-file",
                json={
                    "id_token": "token-123",
                    "file_id": "123e4567-e89b-12d3-a456-426614174000",
                },
            )

        self.assertEqual(response.status_code, 404)
        remove_file.assert_not_called()

    @patch("main.verify_token", return_value={
        "uid": "new-user",
        "email": "new@example.com",
        "name": "New User",
        "picture": "https://example.com/avatar.png",
    })
    def test_account_bootstrap_creates_server_owned_entitlements(self, _verify_token):
        stored = {}

        class FakeSnapshot:
            exists = True

            def to_dict(self):
                return dict(stored)

        class FakeUserRef:
            def create(self, data):
                stored.update(data)

            def get(self):
                return FakeSnapshot()

        fake_ref = FakeUserRef()
        fake_db = SimpleNamespace(
            collection=lambda _name: SimpleNamespace(document=lambda _uid: fake_ref),
        )
        with patch.object(main, "get_db", return_value=fake_db), patch.object(main, "_audit_action"):
            res = self.client.post("/api/account-bootstrap", json={"id_token": "token-123"})

        self.assertEqual(res.status_code, 200)
        self.assertEqual(stored["credits_remaining"], 3)
        self.assertEqual(stored["subscription_tier"], "free")
        self.assertEqual(stored["uid"], "new-user")

    def test_create_order_requires_auth(self):
        res = self.client.post("/api/create-order", json={"plan_id": "starter", "id_token": "invalid-token", "currency": "INR"})
        self.assertEqual(res.status_code, 401)

    @patch("main.verify_token", return_value={"uid": "payment-user"})
    def test_paused_payments_never_contact_razorpay(self, _verify_token):
        paused = main._default_service_controls()
        paused["pause_payments"] = True
        fake_client = SimpleNamespace()

        with (
            patch.object(main, "_read_service_controls", return_value=paused),
            patch.object(main, "rzp_client", fake_client),
        ):
            response = self.client.post(
                "/api/create-order",
                json={
                    "plan_id": "starter",
                    "id_token": "token-123",
                    "currency": "INR",
                    "idempotency_key": "paused-payment",
                },
            )

        self.assertEqual(response.status_code, 503)
        self.assertIn("Payments are paused", response.json()["detail"])

    @patch("main.verify_token", return_value={
        "uid": "new-rate-limited-user",
        "email": "new@example.com",
    })
    def test_account_bootstrap_rate_limits_new_accounts(self, _verify_token):
        class MissingSnapshot:
            exists = False

        class FakeUserRef:
            def get(self):
                return MissingSnapshot()

            def create(self, _data):
                raise AssertionError("rate-limited account must not be created")

        fake_db = SimpleNamespace(
            collection=lambda _name: SimpleNamespace(document=lambda _uid: FakeUserRef()),
        )
        with (
            patch.object(main, "get_db", return_value=fake_db),
            patch.object(main, "_check_rate", return_value=(False, 60, 0)),
        ):
            response = self.client.post(
                "/api/account-bootstrap",
                json={"id_token": "token-123"},
            )

        self.assertEqual(response.status_code, 429)

    @patch("main.verify_token", return_value={"uid": "ordinary-user", "email": "user@example.com", "email_verified": True})
    def test_admin_endpoints_reject_non_admin_tokens(self, _verify_token):
        res = self.client.post("/api/admin/recovery-summary", json={"id_token": "token-123", "limit": 10})
        self.assertEqual(res.status_code, 403)

    @patch("main.verify_token", return_value={"uid": "attacker", "email": "ops@example.com", "email_verified": False})
    def test_admin_email_allowlist_requires_verified_email(self, _verify_token):
        with patch.dict(os.environ, {"ADMIN_EMAILS": "ops@example.com"}):
            res = self.client.post("/api/admin/tenant-backfill", json={"id_token": "token-123", "limit": 10})
        self.assertEqual(res.status_code, 403)

    @patch("main.verify_token", return_value={"uid": "payment-user"})
    def test_create_order_idempotency_replays_without_duplicate_order(self, _verify_token):
        calls = []

        class FakeOrderApi:
            def create(self, data):
                calls.append(data)
                return {"id": "order_123", **data}

        fake_client = SimpleNamespace(order=FakeOrderApi())

        with patch.object(main, "rzp_client", fake_client), patch.object(main, "RAZORPAY_AVAILABLE", True):
            payload = {
                "plan_id": "starter",
                "id_token": "token-123",
                "currency": "INR",
                "idempotency_key": "same-order-key",
            }
            res_first = self.client.post("/api/create-order", json=payload)
            res_second = self.client.post("/api/create-order", json=payload)

        self.assertEqual(res_first.status_code, 200)
        self.assertEqual(res_second.status_code, 200)
        self.assertEqual(len(calls), 1)
        self.assertTrue(res_second.json().get("idempotent_replay"))
        self.assertEqual(res_first.json()["order"]["id"], res_second.json()["order"]["id"])

    def test_api_version_contract(self):
        res = self.client.get("/api/version")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("version", data)
        self.assertIn("min_supported_version", data)
        self.assertEqual(res.headers.get("x-content-type-options"), "nosniff")
        self.assertEqual(res.headers.get("x-frame-options"), "DENY")
        self.assertIn("default-src 'self'", res.headers.get("content-security-policy", ""))

    def test_chunked_json_body_limit(self):
        res = self.client.post(
            "/api/translate",
            content=b'{' + b'"padding":"' + (b'x' * (main.MAX_JSON_BODY_BYTES + 1)) + b'"}',
            headers={"Content-Type": "application/json"},
        )
        self.assertEqual(res.status_code, 413)

    def test_slo_and_readiness_contract(self):
        slo_res = self.client.get("/api/slo/status")
        self.assertEqual(slo_res.status_code, 403)

        with patch.object(main, "verify_token", return_value={"uid": "admin", "admin": True}):
            admin_slo_res = self.client.get(
                "/api/slo/status",
                headers={"Authorization": "Bearer admin-token"},
            )
        self.assertEqual(admin_slo_res.status_code, 200)
        self.assertIn("release_gate_passed", admin_slo_res.json())

        ready_res = self.client.get("/api/health/readiness")
        self.assertEqual(ready_res.status_code, 200)
        ready_data = ready_res.json()
        self.assertIn("ready", ready_data)
        self.assertNotIn("slo", ready_data)


if __name__ == "__main__":
    unittest.main()
