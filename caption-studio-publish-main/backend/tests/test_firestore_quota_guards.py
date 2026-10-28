"""Guards that keep the app inside Firestore's free daily quota, and source retention."""
import os
import sys
import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import patch

import fakeredis
from fastapi import HTTPException
from fastapi.testclient import TestClient
from google.api_core import exceptions as google_api_exceptions

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import main
import app_state
import firebase_admin_setup as storage
import maintenance_jobs
import media_records
import observability
import railway_cron
import request_guards
import settings

REMOTE = "uploads/user-1/123e4567-e89b-12d3-a456-426614174000.mp4"


class Snapshot:
    def __init__(self, data, reference=None):
        self._data = data
        self.exists = data is not None
        self.reference = reference

    def to_dict(self):
        return dict(self._data or {})


class Doc:
    def __init__(self, store, key):
        self.store, self.key = store, key

    def get(self):
        return Snapshot(self.store.get(self.key), self)

    def set(self, payload, merge=False):
        self.store[self.key] = {**(self.store.get(self.key) or {}), **payload} if merge else dict(payload)

    def update(self, payload):
        self.store[self.key] = {**self.store[self.key], **payload}

    def delete(self):
        self.store.pop(self.key, None)


class Query:
    def __init__(self, store, name):
        self.store, self.name = store, name

    def where(self, *args, **kwargs):
        return self

    order_by = limit = where

    def stream(self):
        return [Snapshot(data, Doc(self.store, key)) for key, data in list(self.store.items()) if key[0] == self.name]


class Collection(Query):
    def document(self, doc_id=None):
        return Doc(self.store, (self.name, doc_id))


class Batch:
    def __init__(self):
        self.ops = []

    def delete(self, ref):
        self.ops.append(ref)

    def commit(self):
        for ref in self.ops:
            ref.delete()


class Db:
    def __init__(self):
        self.store = {}

    def collection(self, name):
        return Collection(self.store, name)

    def batch(self):
        return Batch()


class DraftSaveRateTests(unittest.TestCase):
    def setUp(self):
        app_state._draft_save_rate.clear()
        self.addCleanup(app_state._draft_save_rate.clear)

    def test_a_runaway_client_is_throttled_with_retry_after(self):
        with patch.object(app_state, "_redis_client", None):
            for _ in range(settings.DRAFT_SAVE_USER_RATE_LIMIT):
                request_guards._enforce_draft_save_rate("user-1")
            with self.assertRaises(HTTPException) as limited:
                request_guards._enforce_draft_save_rate("user-1")
            request_guards._enforce_draft_save_rate("user-2")
        self.assertEqual(limited.exception.status_code, 429)
        self.assertGreater(int(limited.exception.headers["Retry-After"]), 0)


class AnalyticsTotalsTests(unittest.TestCase):
    def test_events_are_counted_in_redis_not_written_per_event(self):
        redis = fakeredis.FakeRedis()
        app_state._telemetry_buffer.clear()
        with patch.object(app_state, "_redis_client", redis):
            for _ in range(3):
                observability._track_event("perf.lcp", {"value": 1})
            observability._track_event("export_requested")
            day = observability._utcnow().date().isoformat()
            db = Db()
            self.assertEqual(observability._persist_daily_analytics_totals(db, [day, "2000-01-01"]), 1)
        self.assertEqual([row for row in app_state._telemetry_buffer if row[0] == "analytics_events"], [])
        stored = db.store[("analytics_daily", day)]
        self.assertEqual(stored["counts"], {"perf.lcp": 3, "export_requested": 1})
        self.assertEqual(stored["total"], 4)

    def test_cron_copies_totals_at_most_once_an_hour(self):
        redis = fakeredis.FakeRedis()
        persisted = []
        persist = lambda db, days: persisted.append(days) or len(days)
        now = datetime(2026, 10, 28, 9, tzinfo=timezone.utc)
        first = railway_cron.persist_analytics_totals(redis, "db", persist=persist, now=now)
        second = railway_cron.persist_analytics_totals(redis, "db", persist=persist, now=now)
        self.assertEqual(first, {"days_written": 2})
        self.assertEqual(second, {"skipped": "ran_this_hour"})
        self.assertEqual(persisted, [["2026-10-27", "2026-10-28"]])


class FirestoreQuotaAlertTests(unittest.TestCase):
    def setUp(self):
        app_state._ops_alert_sent_at.clear()
        self.addCleanup(app_state._ops_alert_sent_at.clear)
        self.alerts = []
        patcher = patch.object(observability, "_send_alert", lambda text, key="": self.alerts.append(key))
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_quota_errors_alert_once_per_hour(self):
        with patch.object(app_state, "_redis_client", fakeredis.FakeRedis()):
            self.assertTrue(observability._note_firestore_error(google_api_exceptions.ResourceExhausted("quota"), "a"))
            self.assertTrue(observability._note_firestore_error(google_api_exceptions.ResourceExhausted("quota"), "b"))
            self.assertFalse(observability._note_firestore_error(RuntimeError("other"), "c"))
        self.assertEqual(self.alerts, [observability.FIRESTORE_QUOTA_ALERT_KEY])

    def test_alert_is_shared_across_replicas_through_redis(self):
        redis = fakeredis.FakeRedis()
        with patch.object(app_state, "_redis_client", redis):
            self.assertTrue(observability._send_alert_once("queue_age", "first"))
            app_state._ops_alert_sent_at.clear()  # a second replica has no local memory of it
            self.assertFalse(observability._send_alert_once("queue_age", "second"))
        self.assertEqual(self.alerts, ["queue_age"])

    def test_an_uncaught_quota_error_returns_503_with_retry_after(self):
        path = "/api/__quota-test"

        def exhausted():
            raise google_api_exceptions.ResourceExhausted("Quota exceeded.")

        main.app.add_api_route(path, exhausted, methods=["GET"])
        self.addCleanup(lambda: main.app.router.routes.pop())
        with patch.object(app_state, "_redis_client", None):
            response = TestClient(main.app, raise_server_exceptions=False).get(path)
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.headers["Retry-After"], "900")
        self.assertEqual(response.json()["error"]["code"], "SERVICE_BUSY")
        self.assertEqual(self.alerts, [observability.FIRESTORE_QUOTA_ALERT_KEY])


class SourceProtectionTests(unittest.TestCase):
    def setUp(self):
        self.db = Db()
        self.objects = {REMOTE}
        self.uploaded_at = datetime(2026, 10, 28, 0, tzinfo=timezone.utc)
        self.schedule_key = ("upload_expirations", storage.hashlib.sha256(REMOTE.encode()).hexdigest())
        self.db.store[self.schedule_key] = {
            "remote_path": REMOTE, "uid": "user-1", "file_id": "f",
            "created_at": self.uploaded_at, "expire_at": self.uploaded_at + timedelta(hours=6),
        }
        for item in (
            patch.object(storage, "get_db", return_value=self.db),
            patch.object(storage, "s3_is_configured", return_value=True),
            patch.object(storage, "s3_object_exists", lambda path: path in self.objects),
        ):
            item.start()
            self.addCleanup(item.stop)

    def expiry(self):
        return self.db.store[self.schedule_key]["expire_at"]

    def test_a_job_accepted_near_the_deadline_keeps_the_source_two_hours(self):
        accepted = self.uploaded_at + timedelta(hours=5, minutes=55)
        self.assertTrue(storage.protect_source_for_job(REMOTE, now=accepted))
        self.assertEqual(self.expiry(), accepted + timedelta(hours=2))

    def test_an_early_job_leaves_the_six_hour_schedule_alone(self):
        self.assertTrue(storage.protect_source_for_job(REMOTE, now=self.uploaded_at + timedelta(minutes=5)))
        self.assertEqual(self.expiry(), self.uploaded_at + timedelta(hours=6))

    def test_retention_never_passes_24_hours_after_upload(self):
        self.assertTrue(storage.protect_source_for_job(REMOTE, now=self.uploaded_at + timedelta(hours=23)))
        self.assertEqual(self.expiry(), self.uploaded_at + timedelta(hours=24))

    def test_a_deleted_source_is_reported_missing(self):
        self.objects.clear()
        self.assertFalse(storage.protect_source_for_job(REMOTE))

    def test_jobs_for_an_expired_source_are_refused_with_410(self):
        metadata = {"uid": "user-1", "remote_path": REMOTE}
        with patch.object(media_records, "_load_upload_metadata", return_value=metadata), \
                patch.object(storage, "protect_source_for_job", return_value=False):
            with self.assertRaises(HTTPException) as refused:
                media_records._protect_source_for_job("f", "user-1")
        self.assertEqual(refused.exception.status_code, 410)
        self.assertIn("SOURCE_EXPIRED", refused.exception.detail)

    def test_a_storage_outage_does_not_block_the_job(self):
        metadata = {"uid": "user-1", "remote_path": REMOTE}
        with patch.object(media_records, "_load_upload_metadata", return_value=metadata), \
                patch.object(storage, "protect_source_for_job", side_effect=RuntimeError("r2 down")):
            media_records._protect_source_for_job("f", "user-1")

    def test_janitor_leaves_a_completed_upload_to_its_schedule(self):
        intent_key = ("direct_upload_intents", "f")
        self.db.store[intent_key] = {
            "remote_path": REMOTE, "status": "completed",
            "expires_at": self.uploaded_at + timedelta(hours=6),
        }
        self.db.store[self.schedule_key]["expire_at"] = datetime.now(timezone.utc) + timedelta(hours=1)
        deleted = []
        with patch.object(storage, "delete_from_firebase_storage", lambda path: deleted.append(path) or True), \
                patch.object(storage, "_delete_orphaned_firebase_objects", lambda *args, **kwargs: 0), \
                patch.object(Query, "stream", lambda query: [
                    Snapshot(data, Doc(query.store, key)) for key, data in list(query.store.items())
                    if key[0] == query.name and (query.name != "upload_expirations"
                                                 or data["expire_at"] <= datetime.now(timezone.utc))
                ]):
            storage.delete_expired_uploads()
        self.assertEqual(deleted, [])
        self.assertNotIn(intent_key, self.db.store)
        self.assertIn(self.schedule_key, self.db.store)


class JanitorFailureTests(unittest.TestCase):
    def test_delete_failures_are_counted_and_alerted(self):
        def failing_exports(stats=None):
            stats["failed"] = 2
            return 0

        alerts = []
        with patch.object(maintenance_jobs, "cleanup_local_media_artifacts", return_value={
                    "uploads_deleted": 0, "exports_deleted": 0, "temp_ass_deleted": 0,
                    "cache_deleted": 0, "render_scratch_deleted": 0, "errors": 0}), \
                patch.object(storage, "delete_expired_exports", failing_exports), \
                patch.object(storage, "delete_expired_uploads", lambda stats=None: 0), \
                patch.object(media_records, "_delete_expired_transcription_cache", return_value=0), \
                patch.object(observability, "_send_alert_once", lambda key, text, **kw: alerts.append(key)):
            metrics = maintenance_jobs._advanced_janitor_once()
        self.assertEqual(metrics["cloud_delete_failures"], 2)
        self.assertEqual(metrics["errors"], 2)
        self.assertEqual(alerts, ["janitor_delete_failures"])


class QueueAgeTests(unittest.TestCase):
    def test_alerts_only_when_a_job_waits_ten_minutes(self):
        queues = [SimpleNamespace(name="caption_export_jobs"), SimpleNamespace(name="caption_transcription_jobs")]
        ages = {"caption_export_jobs": (3, 700), "caption_transcription_jobs": (1, 30)}
        alerts = []
        result = railway_cron.check_queue_age(
            queues + [None], snapshot=lambda queue, job: ages[queue.name],
            alert=lambda key, text: alerts.append((key, text)),
        )
        self.assertEqual(result["caption_export_jobs"], {"depth": 3, "oldest_seconds": 700})
        self.assertEqual(len(alerts), 1)
        self.assertEqual(alerts[0][0], "queue_age")
        self.assertIn("caption_export_jobs: 3 waiting, oldest 11 min", alerts[0][1])
        self.assertNotIn("caption_transcription_jobs", alerts[0][1])

    def test_quiet_when_queues_move(self):
        alerts = []
        railway_cron.check_queue_age([SimpleNamespace(name="q")], snapshot=lambda queue, job: (0, 0),
                                     alert=lambda key, text: alerts.append(key))
        self.assertEqual(alerts, [])


if __name__ == "__main__":
    unittest.main()
