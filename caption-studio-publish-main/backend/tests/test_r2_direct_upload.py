"""Browser-direct multipart uploads to S3-compatible storage (Cloudflare R2)."""
import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend import firebase_admin_setup as storage
from backend.direct_upload_api import create_direct_upload_router

FILE_ID = "123e4567-e89b-12d3-a456-426614174000"
MIB = 1024 * 1024


class MemoryDocument:
    def __init__(self, store, key):
        self.store, self.key = store, key

    def get(self):
        data = self.store.get(self.key)
        return SimpleNamespace(exists=data is not None, to_dict=lambda: dict(data or {}))

    def set(self, payload, merge=False):
        self.store[self.key] = {**(self.store.get(self.key) or {}), **payload} if merge else dict(payload)

    def delete(self):
        self.store.pop(self.key, None)


class MemoryDb:
    def __init__(self):
        self.store = {}

    def collection(self, name):
        db = self
        return SimpleNamespace(document=lambda doc_id: MemoryDocument(db.store, (name, doc_id)))


class FakeR2:
    """Records multipart calls the way R2 would see them."""

    def __init__(self):
        self.parts = {}
        self.completed = None
        self.aborted = False
        self.objects = {}

    def create(self, remote_path, content_type, metadata):
        self.remote_path = remote_path
        return "upload-1"

    def presign(self, remote_path, upload_id, number, length, ttl):
        return f"https://r2.test/{remote_path}?partNumber={number}&len={length}&ttl={ttl}"

    def receive(self, number, size):
        self.parts[number] = {"PartNumber": number, "ETag": f'"etag-{number}"', "Size": size}

    def list(self, remote_path, upload_id):
        return list(self.parts.values())

    def complete(self, remote_path, upload_id, parts):
        self.completed = [part["PartNumber"] for part in parts]
        self.objects[remote_path] = sum(part["Size"] for part in parts)

    def size(self, remote_path):
        return self.objects.get(remote_path)

    def abort(self, remote_path, upload_id):
        self.aborted = True


class R2UploadTests(unittest.TestCase):
    def setUp(self):
        self.db = MemoryDb()
        self.r2 = FakeR2()

        def transition(db, intent_ref, uid, remote_path, target, expires_at=None):
            intent_ref.set({"status": target, **({"expires_at": expires_at} if expires_at else {})}, merge=True)
            return True

        patches = [
            patch.object(storage, "get_db", return_value=self.db),
            patch.object(storage, "s3_is_configured", return_value=True),
            patch.object(storage, "create_s3_multipart_upload", self.r2.create),
            patch.object(storage, "presign_s3_upload_part", self.r2.presign),
            patch.object(storage, "list_s3_uploaded_parts", self.r2.list),
            patch.object(storage, "complete_s3_multipart_upload", self.r2.complete),
            patch.object(storage, "s3_object_size", self.r2.size),
            patch.object(storage, "abort_s3_multipart_upload", self.r2.abort),
            patch.object(storage, "delete_s3_file", lambda path: self.r2.objects.pop(path, None)),
            patch.object(storage, "_transition_direct_upload_intent", transition),
        ]
        for item in patches:
            item.start()
            self.addCleanup(item.stop)

    def create(self, size=20 * MIB):
        return storage.create_resumable_source_upload(
            "user-1", FILE_ID, "mp4", "video/mp4", size, filename="clip.mp4", last_modified=7,
        )

    def test_create_splits_into_fixed_size_parts_and_keeps_upload_id_private(self):
        session = self.create(20 * MIB)
        self.assertEqual(session["upload_protocol"], "s3_multipart")
        self.assertEqual((session["part_size"], session["part_count"]), (8 * MIB, 3))
        self.assertNotIn("upload_id", session)
        intent = self.db.store[("direct_upload_intents", FILE_ID)]
        self.assertEqual(intent["remote_path"], f"uploads/user-1/{FILE_ID}.mp4")
        self.assertEqual(intent["upload_id"], "upload-1")

    def test_parts_are_signed_with_exact_lengths_and_only_for_the_owner(self):
        self.create(20 * MIB)
        parts = storage.sign_resumable_upload_parts("user-1", FILE_ID, [3, 1])
        self.assertEqual([(p["part_number"], p["content_length"]) for p in parts], [(1, 8 * MIB), (3, 4 * MIB)])
        self.assertIsNone(storage.sign_resumable_upload_parts("someone-else", FILE_ID, [1]))
        self.assertIsNone(storage.sign_resumable_upload_parts("user-1", FILE_ID, [4]))
        self.assertIsNone(storage.sign_resumable_upload_parts("user-1", FILE_ID, list(range(1, 40))))

    def test_resume_reports_parts_already_received(self):
        self.create(20 * MIB)
        self.r2.receive(1, 8 * MIB)
        self.r2.receive(2, 1)  # truncated part must be uploaded again
        resumed = storage.resume_resumable_source_upload("user-1", FILE_ID, "clip.mp4", "video/mp4", 20 * MIB, 7)
        self.assertEqual(resumed["completed_parts"], [1])
        self.assertIsNone(storage.resume_resumable_source_upload("user-1", FILE_ID, "other.mp4", "video/mp4", 20 * MIB, 7))

    def test_complete_requires_every_part_then_is_idempotent(self):
        self.create(20 * MIB)
        self.r2.receive(1, 8 * MIB)
        self.r2.receive(2, 8 * MIB)
        self.assertIsNone(storage.finalize_resumable_source_upload("user-1", FILE_ID))
        self.r2.receive(3, 4 * MIB)
        result = storage.finalize_resumable_source_upload("user-1", FILE_ID)
        self.assertEqual(result["size_bytes"], 20 * MIB)
        self.assertEqual(self.r2.completed, [1, 2, 3])
        self.assertEqual(self.db.store[("direct_upload_intents", FILE_ID)]["status"], "completed")
        # A retried completion after a lost response still succeeds.
        self.assertEqual(storage.finalize_resumable_source_upload("user-1", FILE_ID)["remote_path"], result["remote_path"])
        self.assertIsNone(storage.finalize_resumable_source_upload("someone-else", FILE_ID))

    def test_expired_intent_cannot_sign_or_complete(self):
        self.create(8 * MIB)
        self.r2.receive(1, 8 * MIB)
        key = ("direct_upload_intents", FILE_ID)
        self.db.store[key]["expires_at"] = datetime.now(timezone.utc) - timedelta(seconds=1)
        self.assertIsNone(storage.sign_resumable_upload_parts("user-1", FILE_ID, [1]))
        self.assertIsNone(storage.finalize_resumable_source_upload("user-1", FILE_ID))

    def test_janitor_aborts_a_stale_multipart_upload(self):
        self.create(8 * MIB)
        key = ("direct_upload_intents", FILE_ID)
        self.db.store[key]["expires_at"] = datetime.now(timezone.utc) - timedelta(seconds=1)

        def query(name):
            rows = [
                SimpleNamespace(to_dict=lambda data=data: dict(data), reference=MemoryDocument(self.db.store, k))
                for k, data in list(self.db.store.items()) if k[0] == name
            ]
            chain = SimpleNamespace(stream=lambda: rows)
            chain.where = chain.order_by = chain.limit = lambda *args, **kwargs: chain
            return chain

        self.db.collection = query
        with patch.object(storage, "delete_from_firebase_storage", lambda path: True), \
                patch.object(storage, "_delete_orphaned_firebase_objects", lambda *args, **kwargs: 0):
            storage.delete_expired_uploads()
        self.assertTrue(self.r2.aborted)
        self.assertNotIn(key, self.db.store)

    def test_cancel_aborts_the_multipart_upload(self):
        self.create(8 * MIB)
        self.assertTrue(storage.cancel_resumable_source_upload("user-1", FILE_ID))
        self.assertTrue(self.r2.aborted)
        self.assertIsNone(storage.sign_resumable_upload_parts("user-1", FILE_ID, [1]))


class R2UploadRouteTests(unittest.TestCase):
    def client(self, **overrides):
        options = dict(
            authenticate=lambda token: {"uid": "user-1"},
            extract_token=lambda request: "token",
            assert_service_available=lambda flag: None,
            allowed_extensions={"mp4"},
            allowed_content_prefixes=("video/",),
            allowed_origins={"https://app.example.com"},
            max_upload_bytes=500 * MIB,
            create_session=lambda *args: {
                "upload_protocol": "s3_multipart", "part_size": 8 * MIB, "part_count": 2,
                "remote_path": "uploads/user-1/x.mp4", "expires_at": "2026-10-03T12:00:00+00:00",
            },
            finalize_session=lambda uid, file_id: None,
            remember_owner=lambda *args, **kwargs: True,
            signed_upload_url=lambda file_id, uid: "",
            audit_action=lambda *args: None,
            sign_parts=lambda uid, file_id, numbers: [
                {"part_number": n, "content_length": 1, "url": f"https://r2.test/{n}"} for n in numbers
            ],
        )
        options.update(overrides)
        app = FastAPI()
        app.include_router(create_direct_upload_router(**options))
        return TestClient(app)

    def test_init_describes_the_multipart_protocol_without_a_session_url(self):
        response = self.client().post("/api/uploads/init", json={
            "filename": "clip.mp4", "content_type": "video/mp4", "size_bytes": 9 * MIB,
        })
        body = response.json()
        self.assertEqual(response.status_code, 200)
        self.assertEqual((body["upload_protocol"], body["part_count"]), ("s3_multipart", 2))
        self.assertNotIn("upload_url", body)

    def test_parts_route_signs_requested_parts(self):
        response = self.client().post("/api/uploads/parts", json={"file_id": FILE_ID, "part_numbers": [1, 2]})
        self.assertEqual([part["part_number"] for part in response.json()["parts"]], [1, 2])

    def test_parts_route_refuses_when_nothing_can_be_signed(self):
        client = self.client(sign_parts=lambda *args: None)
        response = client.post("/api/uploads/parts", json={"file_id": FILE_ID, "part_numbers": [1]})
        self.assertEqual(response.status_code, 409)


if __name__ == "__main__":
    unittest.main()
