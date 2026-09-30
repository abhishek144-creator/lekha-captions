import os
import sys
import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from fastapi import HTTPException

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import main
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
        with patch.object(main, "get_db", return_value=_fake_db(user_data)), \
                patch.object(main, "_read_service_controls", return_value={}), \
                patch.object(main, "_IS_TEST", False):
            main._assert_upload_allowed("user-1", duration)

    def test_video_longer_than_plan_is_refused_before_upload(self):
        starter = {"subscription_tier": "starter", "subscription_expiry": _future_iso()}
        with self.assertRaises(HTTPException) as refused:
            self.run_check(starter, duration=170)
        self.assertEqual(refused.exception.status_code, 403)
        self.assertIn("120s", refused.exception.detail)
        self.run_check(starter, duration=110)

    def test_used_free_transcriptions_are_refused_before_upload(self):
        free = {"subscription_tier": "free", "ai_lifetime_usage": {"process": main.FREE_LIFETIME_TRANSCRIPTIONS}}
        with self.assertRaises(HTTPException) as refused:
            self.run_check(free, duration=30)
        self.assertEqual(refused.exception.status_code, 402)
        self.assertIn("FREE_TRANSCRIPTIONS_USED", refused.exception.detail)

    def test_daily_transcription_quota_is_refused_before_upload(self):
        starter = {
            "subscription_tier": "starter",
            "subscription_expiry": _future_iso(),
            "ai_usage_date": main.date.today().isoformat(),
            "ai_daily_usage": {"process": main.AI_DAILY_LIMITS["starter"]["process"]},
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


if __name__ == "__main__":
    unittest.main()
