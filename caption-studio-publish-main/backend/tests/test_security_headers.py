import os
import sys
import unittest
from unittest.mock import patch
from types import SimpleNamespace

from fastapi import Response

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from backend.request_security import create_request_security

backend_context = SimpleNamespace(_IS_PRODUCTION=False, SECURITY_CSP="default-src 'self'")
backend_context._apply_security_headers = create_request_security(backend_context)._apply_security_headers


class SecurityHeaderTests(unittest.TestCase):
    def test_production_responses_require_https(self):
        # The security service can be constructed with only its own dependencies.
        with patch.object(backend_context, "_IS_PRODUCTION", True):
            response = backend_context._apply_security_headers(Response())
        self.assertEqual(
            response.headers.get("Strict-Transport-Security"),
            "max-age=31536000; includeSubDomains",
        )

    def test_development_responses_skip_hsts(self):
        with patch.object(backend_context, "_IS_PRODUCTION", False):
            response = backend_context._apply_security_headers(Response())
        self.assertNotIn("Strict-Transport-Security", response.headers)
        self.assertEqual(response.headers.get("X-Frame-Options"), "DENY")
        self.assertIn("default-src 'self'", response.headers.get("Content-Security-Policy", ""))


if __name__ == "__main__":
    unittest.main()
