import os
import sys
import tempfile
import unittest
from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import main
from analytics_api import create_analytics_router
from processor import VideoProcessor


def _fake_db(user_data):
    db = MagicMock()
    snap = SimpleNamespace(exists=user_data is not None, to_dict=lambda: dict(user_data or {}))
    db.collection.return_value.document.return_value.get.return_value = snap
    return db


def _future_iso():
    return (datetime.now(timezone.utc) + timedelta(days=10)).isoformat()


class UploadPlanPrecheckTests(unittest.TestCase):
    def run_check(self, user_data, duration=0):
        with patch.object(main.firebase_admin_setup, "get_db", return_value=_fake_db(user_data)), \
                patch.object(main.operator_controls, "_read_service_controls", return_value={}), \
                patch.object(main.settings, "_IS_TEST", False):
            main.upload_dispatch._assert_upload_allowed("user-1", duration)

    def test_video_longer_than_plan_is_refused_before_upload(self):
        starter = {"subscription_tier": "starter", "subscription_expiry": _future_iso()}
        # The cap comes from shared/planCatalog.json, so the test follows pricing changes.
        cap = main.settings.PLAN_PRICING["starter"]["max_video_seconds"]
        with self.assertRaises(HTTPException) as refused:
            self.run_check(starter, duration=cap + 20)
        self.assertEqual(refused.exception.status_code, 403)
        self.assertIn(f"{cap}s", refused.exception.detail)
        self.run_check(starter, duration=cap - 10)

    def test_used_free_transcriptions_are_refused_before_upload(self):
        free = {"subscription_tier": "free", "ai_lifetime_usage": {"process": main.settings.FREE_LIFETIME_TRANSCRIPTIONS}}
        with self.assertRaises(HTTPException) as refused:
            self.run_check(free, duration=30)
        self.assertEqual(refused.exception.status_code, 402)
        self.assertIn("FREE_TRANSCRIPTIONS_USED", refused.exception.detail)

    def test_daily_transcription_quota_is_refused_before_upload(self):
        starter = {
            "subscription_tier": "starter",
            "subscription_expiry": _future_iso(),
            "ai_usage_date": date.today().isoformat(),
            "ai_daily_usage": {"process": main.settings.AI_DAILY_LIMITS["starter"]["process"]},
        }
        with self.assertRaises(HTTPException) as refused:
            self.run_check(starter, duration=30)
        self.assertEqual(refused.exception.status_code, 429)

    def test_unknown_duration_and_fresh_account_pass(self):
        self.run_check({"subscription_tier": "free"}, duration=0)
        self.run_check(None, duration=60)


def _write_output(command, **_kwargs):
    with open(command[-1], "wb") as output:
        output.write(b"audio")
    return SimpleNamespace(returncode=0, stdout="", stderr="")


class SpokenLanguageRoutingTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.processor = VideoProcessor(fonts_dir="flat_fonts")
        self.processor.client = MagicMock()
        self.words = [
            {"word": "नमस्ते", "start": 0.0, "end": 0.5},
            {"word": "दोस्तों", "start": 0.5, "end": 1.0},
        ]

    def whisper_calls(self):
        return self.processor.client.audio.transcriptions.create.call_args_list

    @patch.dict(os.environ, {"SARVAM_API_KEY": "test-key"})
    async def test_auto_hindi_speech_is_sent_to_sarvam(self):
        self.processor.client.audio.transcriptions.create.return_value = SimpleNamespace(language="hindi", words=[])
        with patch("processor.run_media_command", side_effect=_write_output), \
                patch("processor.SarvamAI") as sarvam, \
                patch("processor._extract_sarvam_words", return_value=self.words):
            result = await self.processor.generate_captions_only("video.mp4", target_language="auto")
        self.assertTrue(result.get("success"))
        self.assertEqual(result.get("detected_language"), "hindi")
        transcribe = sarvam.return_value.speech_to_text.transcribe
        self.assertEqual(transcribe.call_args.kwargs["language_code"], "hi-IN")
        # Only the 30-second sample went to whisper-1, without word timestamps.
        self.assertEqual(len(self.whisper_calls()), 1)
        self.assertNotIn("timestamp_granularities", self.whisper_calls()[0].kwargs)

    @patch.dict(os.environ, {"SARVAM_API_KEY": "test-key"})
    async def test_auto_english_speech_stays_on_whisper(self):
        self.processor.client.audio.transcriptions.create.side_effect = [
            SimpleNamespace(language="english", words=[]),
            SimpleNamespace(language="english", words=[
                {"word": "hello", "start": 0.0, "end": 0.4},
                {"word": "friends", "start": 0.4, "end": 0.9},
            ]),
        ]
        with patch("processor.run_media_command", side_effect=_write_output), \
                patch("processor.SarvamAI") as sarvam:
            result = await self.processor.generate_captions_only("video.mp4", target_language="auto")
        self.assertTrue(result.get("success"))
        sarvam.assert_not_called()
        self.assertEqual(len(self.whisper_calls()), 2)

    @patch.dict(os.environ, {"SARVAM_API_KEY": ""})
    async def test_no_detection_cost_without_sarvam(self):
        self.processor.client.audio.transcriptions.create.return_value = SimpleNamespace(
            language="english", words=[{"word": "hello", "start": 0.0, "end": 0.4}],
        )
        with patch("processor.run_media_command", side_effect=_write_output):
            result = await self.processor.generate_captions_only("video.mp4", target_language="auto")
        self.assertTrue(result.get("success"))
        self.assertEqual(len(self.whisper_calls()), 1)
        self.assertIn("timestamp_granularities", self.whisper_calls()[0].kwargs)


class _MemoryDocument:
    def __init__(self, store, key):
        self.store, self.key = store, key

    def get(self):
        data = self.store.get(self.key)
        return SimpleNamespace(exists=data is not None, to_dict=lambda: dict(data or {}))

    def set(self, values, merge=False):
        self.store[self.key] = {**(self.store.get(self.key) or {}), **values} if merge else dict(values)


class _MemoryDb:
    def __init__(self):
        self.collections = {}

    def collection(self, name):
        store = self.collections.setdefault(name, {})
        return SimpleNamespace(document=lambda key: _MemoryDocument(store, key))


class SharedTranscriptCacheTests(unittest.TestCase):
    def setUp(self):
        self.db = _MemoryDb()
        self.dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.dir.cleanup)
        self.path = os.path.join(self.dir.name, "abc123.json")
        self.result = {"success": True, "captions": [{"text": "hello"}]}

    def test_another_worker_reuses_a_transcript(self):
        with patch.object(main.firebase_admin_setup, "get_db", return_value=self.db):
            main.media_records._write_transcription_cache(self.path, self.result)
            os.remove(self.path)  # a different worker has no local copy
            self.assertEqual(main.media_records._read_transcription_cache(self.path), self.result)
        self.assertTrue(os.path.exists(self.path), "a shared hit is copied to local scratch")
        row = self.db.collections[main.settings.TRANSCRIPTION_CACHE_COLLECTION]["abc123"]
        self.assertIn("expire_at", row)

    def test_expired_shared_transcript_is_ignored(self):
        self.db.collection(main.settings.TRANSCRIPTION_CACHE_COLLECTION).document("abc123").set({
            "payload": '{"success": true, "captions": []}',
            "expire_at": datetime.now(timezone.utc) - timedelta(minutes=1),
        })
        with patch.object(main.firebase_admin_setup, "get_db", return_value=self.db):
            self.assertIsNone(main.media_records._read_transcription_cache(self.path))

    def test_oversized_transcript_stays_local_only(self):
        big = {"success": True, "captions": [{"text": "x" * (main.settings.TRANSCRIPTION_CACHE_MAX_BYTES + 10)}]}
        with patch.object(main.firebase_admin_setup, "get_db", return_value=self.db):
            main.media_records._write_transcription_cache(self.path, big)
        self.assertTrue(os.path.exists(self.path))
        self.assertNotIn(main.settings.TRANSCRIPTION_CACHE_COLLECTION, self.db.collections)


class DiscardUnusedUploadTests(unittest.TestCase):
    def test_discard_deletes_storage_scratch_and_scan(self):
        file_id = "123e4567-e89b-12d3-a456-426614174000"
        with tempfile.TemporaryDirectory() as upload_dir:
            local = os.path.join(upload_dir, f"{file_id}.mp4")
            with open(local, "wb") as f:
                f.write(b"video")
            updates = []
            scan_jobs = MagicMock()
            with patch.object(main.settings, "UPLOAD_DIR", upload_dir), \
                    patch.object(main.media_records, "_assert_upload_owner", return_value=None), \
                    patch.object(main.media_records, "_load_upload_metadata", return_value={
                        "remote_path": f"uploads/user-1/{file_id}.mp4", "upload_state": "pending_scan"}), \
                    patch.object(main.media_records, "_update_upload_metadata", side_effect=lambda fid, values: updates.append(values)), \
                    patch.object(main.firebase_admin_setup, "delete_from_firebase_storage", return_value=True) as delete_remote, \
                    patch.object(main.firebase_admin_setup, "get_db", return_value=MagicMock()), \
                    patch.object(main.upload_dispatch, "MediaScanJobs", return_value=scan_jobs):
                self.assertTrue(main.upload_dispatch._discard_unused_upload("user-1", file_id))
            self.assertFalse(os.path.exists(local))
        delete_remote.assert_called_once_with(f"uploads/user-1/{file_id}.mp4")
        self.assertEqual(updates[0]["upload_state"], "discarded")
        scan_jobs.finish.assert_called_once_with(file_id)

    def test_discard_refuses_another_accounts_object(self):
        with patch.object(main.media_records, "_assert_upload_owner", return_value=None), \
                patch.object(main.media_records, "_load_upload_metadata", return_value={"remote_path": "uploads/other/x.mp4"}), \
                patch.object(main.firebase_admin_setup, "delete_from_firebase_storage") as delete_remote:
            with self.assertRaises(HTTPException) as refused:
                main.upload_dispatch._discard_unused_upload("user-1", "123e4567-e89b-12d3-a456-426614174000")
        self.assertEqual(refused.exception.status_code, 403)
        delete_remote.assert_not_called()


class UploadFunnelMetricsTests(unittest.TestCase):
    def summary(self, counters, samples):
        app = FastAPI()
        app.include_router(create_analytics_router(
            is_admin=lambda request: True,
            utcnow=lambda: datetime(2026, 9, 30),
            get_database=lambda: None,
            read_counters=lambda day: counters,
            read_latency_samples=lambda day, path: [],
            read_metric_samples=lambda day, name: samples.get(name, []),
            alert_failure_ratio=lambda *args: None,
            percentile_95=lambda values: 0,
        ))
        return TestClient(app).get("/api/analytics/summary?date=2026-09-30").json()

    def test_summary_reports_drop_off_time_to_caption_and_cost(self):
        data = self.summary({
            "funnel.upload.file_picked": 10,
            "funnel.upload.abandoned": 3,
            "funnel.upload.success": 6,
            "upload_rejected_duration": 1,
            "funnel.upload.refused_locally": 1,
            "process_success": 4,
            "funnel.captions.ready": 4,
        }, {
            "job_cost_usd": [0.02, 0.02, 0.02, 0.02, 0.02],
            "time_to_first_caption_ms": [30_000, 40_000, 50_000, 60_000, 90_000],
        })
        funnel, metrics = data["funnel"], data["metrics"]
        self.assertEqual(funnel["videos_picked"], 10)
        self.assertEqual(funnel["uploads_abandoned"], 3)
        self.assertEqual(funnel["uploads_refused"], 2)
        self.assertEqual(funnel["picked_to_upload_pct"], 60.0)
        self.assertEqual(metrics["estimated_ai_cost_per_captioned_video_usd"], 0.025)
        self.assertEqual(metrics["time_to_first_caption_p50_s"], 50.0)
        self.assertEqual(metrics["time_to_first_caption_p95_s"], 90.0)

    def test_empty_day_has_no_invented_numbers(self):
        metrics = self.summary({}, {})["metrics"]
        self.assertIsNone(metrics["estimated_ai_cost_per_captioned_video_usd"])
        self.assertIsNone(metrics["time_to_first_caption_p50_s"])

    def test_client_time_to_first_caption_is_bounded(self):
        with patch.object(main.observability, "_track_operational_metric_sample") as record:
            for bad in (None, "x", -5, 0, float("nan"), main.settings.CLIENT_TIME_TO_FIRST_CAPTION_MAX_MS + 1):
                main.observability._record_client_time_to_first_caption(bad)
            record.assert_not_called()
            main.observability._record_client_time_to_first_caption(42_000)
        record.assert_called_once_with("time_to_first_caption_ms", 42_000.0)


if __name__ == "__main__":
    unittest.main()
