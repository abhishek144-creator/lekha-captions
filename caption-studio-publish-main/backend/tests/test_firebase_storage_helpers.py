import os
import tempfile
import unittest
from datetime import timedelta
from unittest.mock import patch

from backend import firebase_admin_setup as storage_helpers


class FakeBlob:
    def __init__(self, download_bytes=b"source-bytes"):
        self.download_bytes = download_bytes
        self.metadata = {}
        self.uploaded = None
        self.patched = False
        self.deleted = False

    def upload_from_filename(self, local_path, content_type=None):
        self.uploaded = (local_path, content_type)

    def patch(self):
        self.patched = True

    def delete(self):
        self.deleted = True

    def generate_signed_url(self, expiration):
        if not isinstance(expiration, timedelta):
            raise AssertionError("signed URL expiration must be a timedelta")
        return "https://storage.test/signed-export"

    def download_to_filename(self, local_path):
        with open(local_path, "wb") as output:
            output.write(self.download_bytes)


class FakeBucket:
    def __init__(self, blob=None):
        self.fake_blob = blob or FakeBlob()
        self.requested_paths = []

    def blob(self, remote_path):
        self.requested_paths.append(remote_path)
        return self.fake_blob


class FakeDocument:
    def __init__(self, writes):
        self.writes = writes

    def set(self, payload):
        self.writes.append(payload)


class FakeCollection:
    def __init__(self, writes):
        self.writes = writes

    def document(self, document_id):
        self.writes.append({"document_id": document_id})
        return FakeDocument(self.writes)


class FakeDb:
    def __init__(self):
        self.collections = []
        self.writes = []

    def collection(self, name):
        self.collections.append(name)
        return FakeCollection(self.writes)


class FirebaseStorageHelperTests(unittest.TestCase):
    def test_export_upload_persists_object_and_expiration_schedule(self):
        bucket = FakeBucket()
        db = FakeDb()
        with tempfile.TemporaryDirectory() as tmpdir:
            source_path = os.path.join(tmpdir, "export.mp4")
            with open(source_path, "wb") as source:
                source.write(b"rendered-video")

            with (
                patch.object(storage_helpers, "get_storage_bucket", return_value=bucket),
                patch.object(storage_helpers, "get_db", return_value=db),
            ):
                url = storage_helpers.upload_to_firebase_storage(
                    source_path,
                    "exports/user-1/export-1.mp4",
                    expiration_hours=24,
                )

        self.assertEqual(url, "https://storage.test/signed-export")
        self.assertEqual(bucket.requested_paths, ["exports/user-1/export-1.mp4"])
        self.assertEqual(bucket.fake_blob.uploaded, (source_path, "video/mp4"))
        self.assertTrue(bucket.fake_blob.patched)
        self.assertEqual(db.collections, ["export_expirations"])
        self.assertTrue(any(write.get("remote_path") == "exports/user-1/export-1.mp4" for write in db.writes))

    def test_export_upload_rolls_back_when_expiration_schedule_is_unavailable(self):
        bucket = FakeBucket()
        with tempfile.TemporaryDirectory() as tmpdir:
            source_path = os.path.join(tmpdir, "export.mp4")
            with open(source_path, "wb") as source:
                source.write(b"rendered-video")

            with (
                patch.object(storage_helpers, "get_storage_bucket", return_value=bucket),
                patch.object(storage_helpers, "get_db", return_value=None),
            ):
                url = storage_helpers.upload_to_firebase_storage(
                    source_path,
                    "exports/user-1/export-1.mp4",
                )

        self.assertIsNone(url)
        self.assertTrue(bucket.fake_blob.deleted)

    def test_source_download_materializes_shared_upload(self):
        bucket = FakeBucket(FakeBlob(download_bytes=b"uploaded-source"))
        with tempfile.TemporaryDirectory() as tmpdir:
            target_path = os.path.join(tmpdir, "source.mov")
            with patch.object(storage_helpers, "get_storage_bucket", return_value=bucket):
                downloaded = storage_helpers.download_from_firebase_storage(
                    "uploads/user-1/source-1.mov",
                    target_path,
                )
            with open(target_path, "rb") as downloaded_file:
                payload = downloaded_file.read()

        self.assertTrue(downloaded)
        self.assertEqual(payload, b"uploaded-source")
        self.assertEqual(bucket.requested_paths, ["uploads/user-1/source-1.mov"])

    def test_source_download_rejects_export_paths(self):
        bucket = FakeBucket()
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch.object(storage_helpers, "get_storage_bucket", return_value=bucket):
                downloaded = storage_helpers.download_from_firebase_storage(
                    "exports/user-1/export-1.mp4",
                    os.path.join(tmpdir, "source.mp4"),
                )

        self.assertFalse(downloaded)
        self.assertEqual(bucket.requested_paths, [])


if __name__ == "__main__":
    unittest.main()
