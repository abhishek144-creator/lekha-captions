import os
import tempfile
import time
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from backend import firebase_admin_setup as storage_helpers
from backend import main


class MediaCleanupTests(unittest.TestCase):
    def test_local_cleanup_removes_only_expired_scratch_files(self):
        with tempfile.TemporaryDirectory() as scratch:
            paths = {
                "uploads": os.path.join(scratch, "uploads"),
                "exports": os.path.join(scratch, "exports"),
                "transcriptions": os.path.join(scratch, "transcriptions"),
                "renders": os.path.join(scratch, "renders"),
                "dead_letter": os.path.join(scratch, "dead_letter"),
            }
            for path in paths.values():
                os.makedirs(path)
            old_upload = os.path.join(paths["uploads"], "old.mp4")
            fresh_upload = os.path.join(paths["uploads"], "fresh.mp4")
            old_export = os.path.join(paths["exports"], "old.mp4")
            old_cache = os.path.join(paths["renders"], "old.mp4")
            for path in (old_upload, fresh_upload, old_export, old_cache):
                with open(path, "wb") as artifact:
                    artifact.write(b"media")
            now = time.time()
            os.utime(old_upload, (now - 7 * 3600, now - 7 * 3600))
            os.utime(old_export, (now - 3600, now - 3600))
            os.utime(old_cache, (now - 8 * 86400, now - 8 * 86400))

            with (
                patch.object(main, "UPLOAD_DIR", paths["uploads"]),
                patch.object(main, "EXPORT_DIR", paths["exports"]),
                patch.object(main, "TRANSCRIPTION_CACHE_DIR", paths["transcriptions"]),
                patch.object(main, "RENDER_CACHE_DIR", paths["renders"]),
                patch.object(main, "DEAD_LETTER_DIR", paths["dead_letter"]),
            ):
                metrics = main.cleanup_local_media_artifacts(now)

            self.assertFalse(os.path.exists(old_upload))
            self.assertFalse(os.path.exists(old_export))
            self.assertFalse(os.path.exists(old_cache))
            self.assertTrue(os.path.exists(fresh_upload))
            self.assertEqual(metrics["errors"], 0)

    def test_orphan_cleanup_uses_deadline_and_hard_maximum_age(self):
        now = datetime.now(timezone.utc)

        class Blob:
            def __init__(self, name, created_at, deadline=""):
                self.name = name
                self.time_created = created_at
                self.metadata = {"delete_at_epoch": deadline} if deadline else {}
                self.deleted = False

            def delete(self):
                self.deleted = True

        expired_deadline = Blob(
            "exports/u/expired.mp4",
            now - timedelta(hours=1),
            str(int((now - timedelta(minutes=1)).timestamp())),
        )
        expired_legacy = Blob("exports/u/legacy.mp4", now - timedelta(hours=73))
        recent_legacy = Blob("exports/u/recent.mp4", now - timedelta(hours=2))
        bucket = type("Bucket", (), {"list_blobs": lambda self, prefix: [expired_deadline, expired_legacy, recent_legacy]})()

        with (
            patch.object(storage_helpers, "s3_is_configured", return_value=False),
            patch.object(storage_helpers, "get_storage_bucket", return_value=bucket),
            patch.object(storage_helpers, "get_db", return_value=None),
        ):
            deleted = storage_helpers._delete_orphaned_firebase_objects("exports/", 72, 10)

        self.assertEqual(deleted, 2)
        self.assertTrue(expired_deadline.deleted)
        self.assertTrue(expired_legacy.deleted)
        self.assertFalse(recent_legacy.deleted)


if __name__ == "__main__":
    unittest.main()
