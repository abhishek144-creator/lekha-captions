import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from runtime_preflight import REQUIRED, validate_runtime


class RuntimePreflightTests(unittest.TestCase):
    def setUp(self):
        self.env = dict.fromkeys(REQUIRED, "private-fixture-value")
        self.env.update(APP_RELEASE="a" * 40, APP_BUILD_TIME="2026-09-27T10:00:00Z", ALLOWED_ORIGINS="https://app.example.invalid", GCS_MEDIA_BUCKET="private", GCS_SIGNING_SERVICE_ACCOUNT="signer@test.iam.gserviceaccount.com")

    def test_valid_release(self):
        validate_runtime(self.env, image_release="a" * 40, secret_version="28")

    def test_missing_signer_fails_without_printing_values(self):
        del self.env["GCS_SIGNING_SERVICE_ACCOUNT"]
        with self.assertRaises(ValueError) as error:
            validate_runtime(self.env)
        self.assertIn("GCS_SIGNING_SERVICE_ACCOUNT", str(error.exception))
        self.assertNotIn("private-fixture-value", str(error.exception))

    def test_mutable_or_mismatched_release_is_rejected(self):
        with self.assertRaises(ValueError):
            validate_runtime(self.env, secret_version="latest")
        with self.assertRaises(ValueError):
            validate_runtime(self.env, image_release="b" * 40)

    def test_unsafe_origin_and_runtime_are_rejected(self):
        for patch in ({"ALLOWED_ORIGINS": "https://*.example.invalid"}, {"DEV_MODE": "true"}, {"APP_BUILD_TIME": "2026-09-27"}):
            with self.assertRaises(ValueError):
                validate_runtime({**self.env, **patch})
