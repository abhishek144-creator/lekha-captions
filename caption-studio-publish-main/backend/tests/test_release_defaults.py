import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import release_metadata

SHA = "d0beb8f5c55b36df7d674d55965a23b8d54ad69b"


class PlatformReleaseDefaultsTests(unittest.TestCase):
    def apply(self, env, build_time=""):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / ".build-time"
            if build_time:
                path.write_text(build_time + "\n", encoding="utf-8")
            with patch.object(release_metadata, "BUILD_TIME_FILE", path):
                release_metadata.apply_platform_release_defaults(env)
        return env

    def test_railway_commit_and_image_build_time_fill_the_release_identity(self):
        env = self.apply({"RAILWAY_GIT_COMMIT_SHA": SHA}, "2026-10-03T12:00:00Z")
        self.assertEqual(env["APP_RELEASE"], SHA)
        self.assertEqual(env["RELEASE_VERSION"], "git-d0beb8f5c55b")
        self.assertEqual(env["APP_BUILD_TIME"], "2026-10-03T12:00:00Z")
        with patch.dict(os.environ, env, clear=True):
            self.assertEqual(release_metadata.release_metadata()["release"], SHA)

    def test_explicit_values_are_never_overridden(self):
        env = self.apply({"RAILWAY_GIT_COMMIT_SHA": SHA, "APP_RELEASE": "b" * 40,
                          "RELEASE_VERSION": "v1.2.3", "APP_BUILD_TIME": "2026-01-01T00:00:00Z"},
                         "2026-10-03T12:00:00Z")
        self.assertEqual((env["APP_RELEASE"], env["RELEASE_VERSION"], env["APP_BUILD_TIME"]),
                         ("b" * 40, "v1.2.3", "2026-01-01T00:00:00Z"))

    def test_nothing_is_invented_off_platform(self):
        env = self.apply({"RAILWAY_GIT_COMMIT_SHA": "not-a-sha"})
        self.assertNotIn("APP_RELEASE", env)
        self.assertNotIn("APP_BUILD_TIME", env)


if __name__ == "__main__":
    unittest.main()
