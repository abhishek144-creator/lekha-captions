import os
import tempfile
import unittest
from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

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

    def generate_signed_url(self, expiration, **kwargs):
        if not isinstance(expiration, timedelta):
            raise AssertionError("signed URL expiration must be a timedelta")
        if kwargs.get("version") != "v4":
            raise AssertionError("signed URL must use V4")
        return "https://storage.test/signed-export"

    def create_resumable_upload_session(self, **kwargs):
        self.resumable_options = kwargs
        return "https://storage.test/resumable-session"

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
    def test_upload_cancellation_requires_intent_owner(self):
        file_id = "123e4567-e89b-12d3-a456-426614174000"
        intent_ref = MagicMock()
        intent_ref.get.return_value = SimpleNamespace(
            exists=True,
            to_dict=lambda: {"uid": "other-user",
                             "remote_path": f"uploads/other-user/{file_id}.mp4"},
        )
        db = MagicMock()
        db.collection.return_value.document.return_value = intent_ref
        with patch.object(storage_helpers, "get_db", return_value=db):
            self.assertFalse(storage_helpers.cancel_resumable_source_upload("user-1", file_id))
        intent_ref.set.assert_not_called()

    def test_cancelled_direct_upload_rejects_completion(self):
        file_id = "123e4567-e89b-12d3-a456-426614174000"
        intent_ref = MagicMock()
        intent_ref.get.return_value = SimpleNamespace(
            exists=True,
            to_dict=lambda: {"uid": "user-1", "status": "cancelled",
                             "remote_path": f"uploads/user-1/{file_id}.mp4"},
        )
        db = MagicMock()
        db.collection.return_value.document.return_value = intent_ref
        with (
            patch.object(storage_helpers, "get_storage_bucket", return_value=MagicMock()),
            patch.object(storage_helpers, "get_db", return_value=db),
            patch.object(storage_helpers, "s3_is_configured", return_value=False),
        ):
            self.assertIsNone(storage_helpers.finalize_resumable_source_upload("user-1", file_id))
        intent_ref.set.assert_not_called()

    def test_direct_upload_completion_is_idempotent_after_response_loss(self):
        file_id = "123e4567-e89b-12d3-a456-426614174000"
        remote_path = f"uploads/user-1/{file_id}.mp4"
        pending = {"uid": "user-1", "remote_path": remote_path,
                   "extension": "mp4", "size_bytes": 100}
        completed = {**pending, "status": "completed"}
        intent_ref = MagicMock()
        intent_ref.get.side_effect = [
            SimpleNamespace(exists=True, to_dict=lambda: pending),
            SimpleNamespace(exists=True, to_dict=lambda: pending),
            SimpleNamespace(exists=True, to_dict=lambda: completed),
        ]
        expiration_ref = MagicMock()
        db = MagicMock()
        def collection(name):
            result = MagicMock()
            result.document.return_value = intent_ref if name == "direct_upload_intents" else expiration_ref
            return result
        db.collection.side_effect = collection
        blob = MagicMock()
        blob.size = 100
        blob.metadata = {}
        bucket = MagicMock()
        bucket.blob.return_value = blob
        with (
            patch.object(storage_helpers, "get_storage_bucket", return_value=bucket),
            patch.object(storage_helpers, "get_db", return_value=db),
            patch.object(storage_helpers, "s3_is_configured", return_value=False),
        ):
            first = storage_helpers.finalize_resumable_source_upload("user-1", file_id)
            second = storage_helpers.finalize_resumable_source_upload("user-1", file_id)
        self.assertEqual(first, second)
        self.assertEqual(first["remote_path"], remote_path)
        blob.patch.assert_called_once()
        expiration_ref.set.assert_called_once()
        db.transaction.return_value.set.assert_called_once()
        intent_ref.delete.assert_not_called()

    def test_completed_intent_cannot_be_cancelled_in_transaction(self):
        file_id = "123e4567-e89b-12d3-a456-426614174000"
        remote_path = f"uploads/user-1/{file_id}.mp4"
        intent_ref = MagicMock()
        intent_ref.get.return_value = SimpleNamespace(
            exists=True,
            to_dict=lambda: {"uid": "user-1", "remote_path": remote_path,
                             "status": "completed"},
        )
        db = MagicMock()
        db.collection.return_value.document.return_value = intent_ref
        with patch.object(storage_helpers, "get_db", return_value=db):
            self.assertFalse(storage_helpers.cancel_resumable_source_upload("user-1", file_id))
        db.transaction.return_value.set.assert_not_called()

    def test_configured_gcs_bucket_uses_google_storage_client(self):
        expected_bucket = object()
        client = MagicMock()
        client.bucket.return_value = expected_bucket
        with (
            patch.object(storage_helpers, "IS_TEST_ENV", False),
            patch.object(storage_helpers, "GCS_MEDIA_BUCKET", "private-media"),
            patch.object(storage_helpers.gcs_storage, "Client", return_value=client),
        ):
            bucket = storage_helpers.get_storage_bucket()
        self.assertIs(bucket, expected_bucket)
        client.bucket.assert_called_once_with("private-media")

    def test_direct_upload_session_is_owner_scoped_and_scheduled(self):
        bucket = FakeBucket()
        db = FakeDb()
        with (
            patch.object(storage_helpers, "get_storage_bucket", return_value=bucket),
            patch.object(storage_helpers, "get_db", return_value=db),
            patch.object(storage_helpers, "s3_is_configured", return_value=False),
        ):
            result = storage_helpers.create_resumable_source_upload(
                "user-1", "123e4567-e89b-12d3-a456-426614174000", "mp4",
                "video/mp4", 4096, "https://lekhacaptions.com",
            )
        self.assertEqual(result["session_url"], "https://storage.test/resumable-session")
        self.assertEqual(bucket.requested_paths, ["uploads/user-1/123e4567-e89b-12d3-a456-426614174000.mp4"])
        self.assertEqual(bucket.fake_blob.resumable_options["size"], 4096)
        self.assertEqual(bucket.fake_blob.metadata["upload_state"], "pending_scan")
        self.assertIn("direct_upload_intents", db.collections)

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

    def test_signed_export_download_is_private_short_lived_and_path_scoped(self):
        bucket = FakeBucket()
        with (
            patch.object(storage_helpers, "get_storage_bucket", return_value=bucket),
            patch.object(storage_helpers, "s3_is_configured", return_value=False),
        ):
            url = storage_helpers.signed_export_download_url("exports/user-1/output.mp4", 600)
            rejected = storage_helpers.signed_export_download_url("uploads/user-1/input.mp4")
        self.assertEqual(url, "https://storage.test/signed-export")
        self.assertIsNone(rejected)
        self.assertEqual(bucket.requested_paths, ["exports/user-1/output.mp4"])

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
