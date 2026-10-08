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
