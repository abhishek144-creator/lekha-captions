import array
import asyncio
import os
import shutil
import subprocess
import tempfile
import unittest
import wave
from pathlib import Path
from unittest.mock import MagicMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from backend.audio_analysis import analyze_pcm, analyze_media
from backend.processor import VideoProcessor
from backend import main as host

processing_api = host.processing_api


def write_pcm(path):
    # Known activity at 1–2 and 4–5 seconds; silence is a real source interval.
    samples = array.array('h', (10000 if (16000 <= i < 32000 or 64000 <= i < 80000) else 0 for i in range(96000)))
    with wave.open(str(path), 'wb') as output:
        output.setparams((1, 2, 16000, 0, 'NONE', 'not compressed'))
        output.writeframes(samples.tobytes())


class AudioAnalysisTests(unittest.TestCase):
    @unittest.skipUnless(shutil.which('ffmpeg'), 'FFmpeg not installed')
    def test_generated_captions_and_waveform_use_the_same_extracted_audio(self):
        with tempfile.TemporaryDirectory() as folder:
            source = Path(folder) / 'speech.wav'
            write_pcm(source)
            processor = VideoProcessor.__new__(VideoProcessor)
            processor.client = MagicMock()
            response = {'timestamps': {'words': ['उम्म रॉकेट लॉन्च हुआ।', 'फिर उड़ान शुरू हुई।'], 'start_time_seconds': [1, 4], 'end_time_seconds': [2, 5]}}
            with patch.dict(os.environ, {'SARVAM_API_KEY': 'test-key'}), \
                 patch('backend.processor.SarvamAI') as sarvam, \
                 patch('backend.processor.transcription_provider_health') as health:
                health.allow_request.return_value = True
                sarvam.return_value.speech_to_text.transcribe.return_value = response
                result = asyncio.run(processor.generate_captions_only(str(source), 'hindi'))
            self.assertTrue(result['success'], result)
            self.assertEqual(result['audio_analysis']['samples'], analyze_pcm(str(source))['samples'])
            raw_words = [w for c in result['verbatim_captions'] for w in c['words']]
            cleaned = [w for c in result['captions'] for w in c['words']]
            self.assertEqual(cleaned, [w for w in raw_words if w['word'] != 'उम्म'])
            self.assertEqual(sarvam.return_value.speech_to_text.transcribe.call_args.kwargs['mode'], 'verbatim')
            # One whisper request times Sarvam's words; none transcribes again.
            processor.client.audio.transcriptions.create.assert_called_once()
            self.assertEqual(processor.client.audio.transcriptions.create.call_args.kwargs['language'], 'hi')

    def test_cloud_draft_keeps_only_analysis_for_its_source(self):
        from backend.drafts import normalize_draft
        analysis = {'fileId': 'source-1', 'duration': 6, 'samples': [0, 1, 0], 'untrusted_url': 'do-not-persist'}
        value = {'fileId': 'source-1', 'captions': [], 'audioAnalysis': analysis}
        normalized = normalize_draft(value)
        self.assertEqual(normalized['audioAnalysis'], {'fileId': 'source-1', 'duration': 6, 'samples': [0, 1, 0]})
        self.assertNotIn('audioAnalysis', normalize_draft({**value, 'fileId': 'source-2'}))
        self.assertNotIn('audioAnalysis', normalize_draft({**value, 'audioAnalysis': {**analysis, 'samples': [float('nan')]}}))

    def test_waveform_and_activity_share_pcm_clock(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'audio.wav'
            write_pcm(path)
            result = analyze_pcm(str(path))
            self.assertEqual(result['duration'], 6)
            self.assertEqual(result['samples'][:20], [0] * 20)
            self.assertTrue(all(v == 1 for v in result['samples'][20:40]))
            self.assertEqual(result['samples'][40:80], [0] * 40)
            self.assertEqual(result['activity'], [{'start': 1.0, 'end': 2.0}, {'start': 4.0, 'end': 5.0}])
            processor = VideoProcessor.__new__(VideoProcessor)
            words = processor._time_sarvam_chunks([{'word': 'one two three four', 'start': 0, 'end': 6}], [], str(path))
            self.assertEqual([w['word'] for w in words], ['one', 'two', 'three', 'four'])
            self.assertTrue(all(w['timing_source'] == 'sarvam_phrase_estimate' for w in words))
            self.assertGreaterEqual(words[0]['start'], 1)
            self.assertLessEqual(words[-1]['end'], 5)
            self.assertGreaterEqual(words[2]['start'], 4)
            measured = [{'word': 'one', 'start': 1.1, 'end': 1.35}]
            self.assertEqual(processor._time_sarvam_chunks(measured, [], str(path)), measured)

    @unittest.skipUnless(shutil.which('ffmpeg'), 'FFmpeg not installed')
    def test_actual_ffmpeg_retains_delayed_audio_origin(self):
        with tempfile.TemporaryDirectory() as folder:
            video = Path(folder) / 'delayed.mkv'
            subprocess.run(['ffmpeg', '-y', '-f', 'lavfi', '-i', 'color=black:s=160x90:r=10:d=5',
                            '-itsoffset', '1.25', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=16000:duration=2',
                            '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-c:a', 'pcm_s16le', str(video)],
                           capture_output=True, check=True, timeout=30)
            result = analyze_media(str(video), 5)
            self.assertEqual(result['duration'], 5)
            self.assertLess(max(result['samples'][:24]), 0.01)
            self.assertGreater(max(result['samples'][26:60]), 0.9)
            self.assertLess(max(result['samples'][70:]), 0.01)


class AudioRecoveryRouteTests(unittest.TestCase):
    def setUp(self):
        app = FastAPI()
        app.include_router(processing_api.router)
        self.client = TestClient(app)
        self.file_id = '123e4567-e89b-12d3-a456-426614174000'

    def test_busy_decoder_does_not_open_media_or_release_another_request_slot(self):
        with patch.object(processing_api.request_security, '_authenticate_media_request', return_value={'uid': 'owner'}), \
             patch.object(processing_api.media_records, '_assert_upload_owner'), \
             patch.object(processing_api.request_guards, '_check_rate', return_value=(True, 0, 1)), \
             patch.object(processing_api, '_audio_analysis_slots') as slots, \
             patch.object(processing_api.media_records, '_safe_find_upload') as find:
            slots.acquire.return_value = False
            result = self.client.post('/api/audio-analysis', json={'file_id': self.file_id})
        self.assertEqual(result.status_code, 429)
        find.assert_not_called()
        slots.release.assert_not_called()

    def test_recovery_checks_owner_before_accessing_media(self):
        from fastapi import HTTPException
        with patch.object(processing_api.request_security, '_authenticate_media_request', return_value={'uid': 'owner'}), \
             patch.object(processing_api.media_records, '_assert_upload_owner', side_effect=HTTPException(403, 'Forbidden')), \
             patch.object(processing_api.media_records, '_safe_find_upload') as find:
            result = self.client.post('/api/audio-analysis', json={'file_id': self.file_id})
        self.assertEqual(result.status_code, 403)
        find.assert_not_called()

    def test_recovery_never_calls_transcription_and_returns_same_analysis(self):
        analysis = {'duration': 6, 'samples': [0, 1, 0], 'reference': 'source_media_seconds'}
        with patch.object(processing_api.request_security, '_authenticate_media_request', return_value={'uid': 'owner'}), \
             patch.object(processing_api.media_records, '_assert_upload_owner'), \
             patch.object(processing_api.request_guards, '_check_rate', return_value=(True, 0, 1)), \
             patch.object(processing_api.media_records, '_safe_find_upload', return_value='video.mp4'), \
             patch.object(processing_api.media_records, '_ensure_upload_clean'), \
             patch.object(processing_api.media_records, '_probe_media', return_value={'format': {'duration': 6}}), \
             patch('backend.audio_analysis.analyze_media', return_value=analysis), \
             patch.object(processing_api.app_state.processor, 'generate_captions_only') as transcribe:
            result = self.client.post('/api/audio-analysis', json={'file_id': self.file_id})
        self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual(result.json()['audio_analysis'], analysis)
        transcribe.assert_not_called()
