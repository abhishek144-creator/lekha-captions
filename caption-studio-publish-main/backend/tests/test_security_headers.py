import os
import sys
import unittest
from unittest.mock import patch

from fastapi import Response

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import main


class SecurityHeaderTests(unittest.TestCase):
    def test_production_responses_require_https(self):
        # The helper lives in request_security.py; it must read the production
        # flag from settings, not from its own module namespace.
        with patch.object(main.settings, "_IS_PRODUCTION", True):
            response = main.request_security._apply_security_headers(Response())
        self.assertEqual(
            response.headers.get("Strict-Transport-Security"),
            "max-age=31536000; includeSubDomains",
        )

    def test_development_responses_skip_hsts(self):
        with patch.object(main.settings, "_IS_PRODUCTION", False):
            response = main.request_security._apply_security_headers(Response())
        self.assertNotIn("Strict-Transport-Security", response.headers)
        self.assertEqual(response.headers.get("X-Frame-Options"), "DENY")
        self.assertIn("default-src 'self'", response.headers.get("Content-Security-Policy", ""))


if __name__ == "__main__":
    unittest.main()


class ClientDisconnectTests(unittest.TestCase):
    def test_json_body_disconnect_is_a_client_close_not_a_server_error(self):
        """A browser that hangs up mid-body must not surface as an unhandled ASGI exception."""
        import asyncio

        scope = {
            "type": "http", "asgi": {"version": "3.0"}, "http_version": "1.1", "method": "POST",
            "scheme": "https", "path": "/api/analytics/track", "raw_path": b"/api/analytics/track",
            "query_string": b"", "root_path": "", "client": ("203.0.113.9", 1234), "server": ("testserver", 443),
            "headers": [(b"host", b"testserver"), (b"content-type", b"application/json")],
        }
        messages = [{"type": "http.request", "body": b'{"event":', "more_body": True}, {"type": "http.disconnect"}]

        async def receive():
            return messages.pop(0) if messages else {"type": "http.disconnect"}

        sent = []

        async def send(message):
            sent.append(message)

        asyncio.run(main.app(scope, receive, send))
        start = next(m for m in sent if m["type"] == "http.response.start")
        self.assertEqual(start["status"], 499)
