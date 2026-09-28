import concurrent.futures
import unittest

import fakeredis
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from backend.direct_upload_api import create_direct_upload_router
from backend.upload_admission import reserve_upload, release_upload


class UploadAdmissionTests(unittest.TestCase):
    def setUp(self):
        self.redis = fakeredis.FakeRedis(decode_responses=True)

    def reserve(self, file_id, *, uid="user-1", size=100, now=1000, active=2,
                bytes_limit=250, hourly=3, ttl=100):
        reserve_upload(self.redis, uid, file_id, size, now=now, max_active=active,
                       max_outstanding_bytes=bytes_limit, max_hourly=hourly,
                       ttl_seconds=ttl)

    def test_concurrent_requests_cannot_exceed_active_limit(self):
        def attempt(index):
            try:
                self.reserve(f"file-{index}", hourly=100)
                return True
            except HTTPException as exc:
                self.assertEqual(exc.status_code, 429)
                return False

        with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
            self.assertEqual(sum(pool.map(attempt, range(40))), 2)

    def test_bytes_hourly_and_expiry_are_enforced(self):
        self.reserve("first", size=200)
        with self.assertRaises(HTTPException) as byte_limit:
            self.reserve("second", size=100)
        self.assertIn("bytes", byte_limit.exception.detail)
        release_upload(self.redis, "user-1", "first")
        self.reserve("second", size=100)
        release_upload(self.redis, "user-1", "second")
        self.reserve("third", size=100)
        release_upload(self.redis, "user-1", "third")
        with self.assertRaises(HTTPException) as hourly_limit:
            self.reserve("fourth", size=100)
        self.assertIn("last hour", hourly_limit.exception.detail)
        self.reserve("fourth", size=100, now=5000)

    def test_failed_session_can_undo_both_reservations(self):
        self.reserve("first", hourly=1)
        release_upload(self.redis, "user-1", "first", undo_hourly=True)
        self.reserve("second", hourly=1)

    def test_redis_outage_fails_closed(self):
        with self.assertRaises(HTTPException) as unavailable:
            reserve_upload(None, "user-1", "file", 100)
        self.assertEqual(unavailable.exception.status_code, 503)


class DirectUploadRouterTests(unittest.TestCase):
    def setUp(self):
        self.reserved = []
        self.released = []
        self.created = []
        self.cancelled = []
        self.resumed = []
        self.scans = []
        self.network_checks = []
        app = FastAPI()
        app.include_router(create_direct_upload_router(
            authenticate=lambda token: {"uid": "user-1"},
            extract_token=lambda request: "valid",
            assert_service_available=lambda feature: None,
            allowed_extensions={"mp4"},
            allowed_content_prefixes=("video/",),
            allowed_origins={"https://app.test"},
            max_upload_bytes=500,
            create_session=lambda *args: self.created.append(args) or {
                "session_url": "https://storage.test/session", "expires_at": "later"},
            finalize_session=lambda uid, file_id: {
                "remote_path": f"uploads/{uid}/{file_id}.mp4", "extension": "mp4", "size_bytes": 100},
            remember_owner=lambda *args, **kwargs: True,
            signed_upload_url=lambda file_id, uid: f"/api/media/upload/{file_id}",
            audit_action=lambda *args: None,
            reserve_slot=lambda *args: self.reserved.append(args),
            release_slot=lambda *args, **kwargs: self.released.append((args, kwargs)),
            cancel_session=lambda *args: self.cancelled.append(args) or True,
            resume_session=lambda *args: self.resumed.append(args) or {
                "session_url": "https://storage.test/session", "expires_at": "later"},
            rate_limit_network=lambda request: self.network_checks.append(request.url.path),
            enqueue_scan=lambda uid, file_id: self.scans.append((uid, file_id)),
        ))
        self.client = TestClient(app)

    def test_complete_releases_active_reservation(self):
        initialized = self.client.post("/api/uploads/init", json={
            "filename": "video.mp4", "content_type": "video/mp4", "size_bytes": 100,
        })
        self.assertEqual(initialized.status_code, 200)
        file_id = initialized.json()["file_id"]
        self.assertEqual(self.reserved, [("user-1", file_id, 100)])
        completed = self.client.post("/api/uploads/complete", json={"file_id": file_id})
        self.assertEqual(completed.status_code, 200)
        self.assertEqual(completed.json()["upload_state"], "pending_scan")
        self.assertEqual(self.scans, [("user-1", file_id)])
        self.assertEqual(self.released, [(("user-1", file_id), {})])

    def test_rejected_origin_cannot_reserve_session(self):
        rejected = self.client.post("/api/uploads/init", headers={"Origin": "https://evil.test"},
                                    json={"filename": "video.mp4", "size_bytes": 100})
        self.assertEqual(rejected.status_code, 403)
        self.assertEqual(self.reserved, [])
        self.assertEqual(self.network_checks, [])

    def test_cancel_releases_active_slot_without_reversing_rate_limit(self):
        initialized = self.client.post("/api/uploads/init", json={
            "filename": "video.mp4", "size_bytes": 100,
        })
        file_id = initialized.json()["file_id"]
        cancelled = self.client.post("/api/uploads/cancel", json={"file_id": file_id})
        self.assertEqual(cancelled.status_code, 200)
        self.assertEqual(self.cancelled, [("user-1", file_id)])
        self.assertEqual(self.released, [(("user-1", file_id), {})])

    def test_resume_requires_allowed_origin_and_passes_exact_fingerprint(self):
        file_id = "123e4567-e89b-12d3-a456-426614174000"
        payload = {
            "file_id": file_id,
            "filename": "video.mp4",
            "content_type": "video/mp4",
            "size_bytes": 100,
            "last_modified": 1234,
        }
        resumed = self.client.post(
            "/api/uploads/resume", headers={"Origin": "https://app.test"}, json=payload,
        )
        self.assertEqual(resumed.status_code, 200)
        self.assertTrue(resumed.json()["resumed"])
        self.assertEqual(
            self.resumed,
            [("user-1", file_id, "video.mp4", "video/mp4", 100, 1234)],
        )
        rejected = self.client.post(
            "/api/uploads/resume", headers={"Origin": "https://evil.test"}, json=payload,
        )
        self.assertEqual(rejected.status_code, 403)


if __name__ == "__main__":
    unittest.main()
