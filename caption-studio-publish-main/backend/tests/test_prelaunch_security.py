"""Regressions for the PDF checklist's documentation and shared-limit checks."""
import os
import pathlib
import sys
import unittest
from unittest.mock import patch
from collections import OrderedDict
from types import SimpleNamespace

from fastapi import HTTPException
from fastapi.testclient import TestClient

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import main
import language_api


class PrelaunchSecurityTests(unittest.TestCase):
    def test_production_has_no_schema_or_interactive_documentation_routes(self):
        with patch.object(main.settings, "_IS_PRODUCTION", True):
            app = main._create_app()
        client = TestClient(app)
        for path in ("/docs", "/redoc", "/openapi.json"):
            with self.subTest(path=path):
                self.assertEqual(client.get(path).status_code, 404)

    def test_local_documentation_remains_available(self):
        with patch.object(main.settings, "_IS_PRODUCTION", False):
            app = main._create_app()
        client = TestClient(app)
        for path in ("/docs", "/redoc", "/openapi.json"):
            with self.subTest(path=path):
                self.assertEqual(client.get(path).status_code, 200)

    def test_missing_shared_limiter_fails_closed_in_production(self):
        events = {}
        with (
            patch.object(main.settings, "_IS_PRODUCTION", True),
            patch.object(main.app_state, "_redis_client", None),
        ):
            with self.assertRaises(HTTPException) as error:
                main.request_guards._check_rate(events, "account-a", 10)
        self.assertEqual(error.exception.status_code, 503)
        self.assertEqual(events, {})

    def test_local_limiter_remains_bounded_without_redis(self):
        events = {}
        with (
            patch.object(main.settings, "_IS_PRODUCTION", False),
            patch.object(main.app_state, "_redis_client", None),
        ):
            self.assertTrue(main.request_guards._check_rate(events, "account-a", 1)[0])
            self.assertFalse(main.request_guards._check_rate(events, "account-a", 1)[0])

    def test_translation_always_caps_provider_output(self):
        from unittest.mock import MagicMock
        client = MagicMock()
        client.chat.completions.create.return_value = SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content='{"lines":["translated"]}'))]
        )
        self.assertEqual(language_api._translate_lines(client, ["source"], "Hindi", "gpt-4o-mini"), ["translated"])
        self.assertEqual(client.chat.completions.create.call_args.kwargs["max_completion_tokens"], 16_000)

    def test_text_ai_routes_use_bounded_timeouts_and_no_implicit_retries(self):
        fixtures = [
            ("/api/translate", {"captions": [{"id": "1", "text": "source"}], "target_language": "Hindi"}),
            ("/api/caption-emotions", {"lines": [{"id": "1", "text": "source"}]}),
        ]
        for path, payload in fixtures:
            with (
                self.subTest(path=path),
                patch.dict(os.environ, {"OPENAI_API_KEY": "isolated-not-a-secret"}),
                patch.object(language_api.firebase_admin_setup, "verify_token", return_value={"uid": "alice"}),
                patch.object(language_api.request_security, "_authenticate_media_request", return_value={"uid": "alice"}),
                patch.object(language_api.request_security, "_assert_tenant_access"),
                patch.object(language_api.request_guards, "_check_rate", return_value=(True, 0, 9)),
                patch.object(language_api.entitlements, "_reserve_ai_quota"),
                patch.object(language_api.operator_controls, "_is_content_safety_blocked", return_value=False),
                patch.object(language_api, "_caption_emotion_cache", OrderedDict()),
                patch.object(language_api, "_translate_in_batches", return_value=["translated"]),
                patch.object(language_api, "_classify_caption_lines", return_value=[{"type": "narration"}]),
                patch("openai.OpenAI") as factory,
            ):
                response = TestClient(main.app).post(path, json={**payload, "id_token": "isolated-token"})
                self.assertEqual(response.status_code, 200, response.text)
                factory.assert_called_once_with(api_key="isolated-not-a-secret", timeout=45, max_retries=0)


if __name__ == "__main__":
    unittest.main()
