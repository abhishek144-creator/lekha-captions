import sys
import unittest
import tempfile
from unittest.mock import patch
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import release_metadata
from runtime_preflight import REQUIRED, R2_REQUIRED, required_storage_settings, validate_runtime


class RuntimePreflightTests(unittest.TestCase):
    def setUp(self):
        self.env = dict.fromkeys(REQUIRED, "private-fixture-value")
        self.env.update(FIREBASE_STORAGE_BUCKET="legacy-fixture", APP_RELEASE="a" * 40, APP_BUILD_TIME="2026-09-27T10:00:00Z", ALLOWED_ORIGINS="https://app.example.invalid", GCS_MEDIA_BUCKET="private", GCS_SIGNING_SERVICE_ACCOUNT="signer@test.iam.gserviceaccount.com")

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


class R2RuntimePreflightTests(unittest.TestCase):
    def setUp(self):
        self.env = dict.fromkeys(REQUIRED, "private-fixture-value")
        self.env.update(dict.fromkeys(R2_REQUIRED, "private-r2-fixture"))
        self.env.update(APP_RELEASE="a" * 40, APP_BUILD_TIME="2026-10-03T12:00:00Z",
                        ALLOWED_ORIGINS="https://app.example.invalid",
                        RAILWAY_ENVIRONMENT_ID="test-environment")

    def test_r2_production_needs_no_firebase_storage_bucket(self):
        validate_runtime(self.env)
        self.assertEqual(set(required_storage_settings(self.env)), set(R2_REQUIRED))

    def test_each_missing_or_blank_r2_setting_is_named_without_its_value(self):
        for name in R2_REQUIRED:
            for blank in (None, "", "   "):
                with self.subTest(name=name, blank=blank):
                    env = dict(self.env)
                    if blank is None:
                        env.pop(name)
                    else:
                        env[name] = blank
                    with self.assertRaises(ValueError) as error:
                        validate_runtime(env)
                    self.assertIn("Missing " + name, str(error.exception))
                    self.assertNotIn("FIREBASE_STORAGE_BUCKET", str(error.exception))
                    self.assertNotIn("private-r2-fixture", str(error.exception))

    def test_railway_without_any_r2_settings_does_not_accept_firebase_fallback(self):
        env = {key: value for key, value in self.env.items() if key not in R2_REQUIRED}
        env["FIREBASE_STORAGE_BUCKET"] = "legacy-fixture"
        with self.assertRaises(ValueError) as error:
            validate_runtime(env)
        for name in R2_REQUIRED:
            self.assertIn("Missing " + name, str(error.exception))

    def test_partial_r2_config_off_platform_is_rejected(self):
        env = {key: value for key, value in self.env.items()
               if key not in R2_REQUIRED and key != "RAILWAY_ENVIRONMENT_ID"}
        env["MEDIA_S3_ENDPOINT"] = "private-r2-fixture"
        env["FIREBASE_STORAGE_BUCKET"] = "legacy-fixture"
        with self.assertRaises(ValueError) as error:
            validate_runtime(env)
        self.assertIn("MEDIA_S3_BUCKET", str(error.exception))

    def test_stale_gcs_settings_do_not_require_a_signer_for_r2(self):
        validate_runtime({**self.env, "GCS_MEDIA_BUCKET": "old-unused-bucket"})

    def test_firebase_admin_credentials_still_required_with_r2(self):
        env = dict(self.env)
        env.pop("FIREBASE_SERVICE_ACCOUNT_JSON")
        with self.assertRaises(ValueError) as error:
            validate_runtime(env)
        self.assertIn("FIREBASE_SERVICE_ACCOUNT_JSON", str(error.exception))

    def test_preflight_uses_railway_release_defaults_without_mutating_input(self):
        env = dict(self.env)
        for name in ("APP_RELEASE", "APP_BUILD_TIME", "RELEASE_VERSION"):
            env.pop(name)
        env["RAILWAY_GIT_COMMIT_SHA"] = "a" * 40
        with tempfile.TemporaryDirectory() as folder:
            build_file = Path(folder) / ".build-time"
            build_file.write_text("2026-10-03T12:00:00Z", encoding="utf-8")
            with patch.object(release_metadata, "BUILD_TIME_FILE", build_file):
                validate_runtime(env, image_release="a" * 40)
        self.assertNotIn("APP_RELEASE", env)


if __name__ == "__main__":
    unittest.main()
