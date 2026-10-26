import array
import asyncio
import math
import os
import shutil
import tempfile
import unittest
import wave
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from backend.speech_focus import focus_pcm, slice_pcm
from backend.processor import VideoProcessor


def write_audio(path, runs, seconds=10):
    pcm = array.array('h')
    for index in range(seconds * 16000):
        time = index / 16000
        level = next((level for start, end, level in runs if start <= time < end), 0)
        pcm.append(round(level * 32767 * math.sin(index * 2 * math.pi * 250 / 16000)))
    with wave.open(str(path), 'wb') as audio:
        audio.setparams((1, 2, 16000, 0, 'NONE', 'not compressed'))
        audio.writeframes(pcm.tobytes())


def read_audio(path):
    with wave.open(str(path), 'rb') as audio:
        return audio.getnframes(), audio.readframes(audio.getnframes())


class SpeechFocusTests(unittest.TestCase):
    def test_excludes_isolated_quiet_edge_without_moving_or_changing_main_speech(self):
        with tempfile.TemporaryDirectory() as folder:
            source, focused = Path(folder) / 'source.wav', Path(folder) / 'focused.wav'
            write_audio(source, [(1, 1.2, .04), (3, 8, .15)])
            before = source.read_bytes()
            result = focus_pcm(str(source), str(focused))
            self.assertEqual(result['suppressed_regions'], [{'start': 1.0, 'end': 1.2}])
            self.assertAlmostEqual(result['window']['start'], 2.84)
            original_frames, original = read_audio(source)
            focused_frames, processed = read_audio(focused)
            self.assertEqual(focused_frames, original_frames)
            self.assertEqual(set(processed[16000 * 2:16000 * 2 + 6400]), {0})
            self.assertEqual(original[3 * 32000:8 * 32000], processed[3 * 32000:8 * 32000])
            self.assertEqual(source.read_bytes(), before)

    def test_all_voices_and_quiet_narration_and_dialogue_are_preserved(self):
        cases = [
            ('all', [(1, 1.2, .04), (3, 8, .15)]),
            ('main', [(1, 8, .012)]),
            ('main', [(0, 1.4, .04), (3, 8, .15)]),
            ('main', [(0, 3, .15), (4, 4.3, .04), (5, 8, .15)]),
            ('main', [(1, 1.2, .15), (3, 8, .15)]),
        ]
        with tempfile.TemporaryDirectory() as folder:
            for mode, runs in cases:
                with self.subTest(mode=mode, runs=runs):
                    source, focused = Path(folder) / 'source.wav', Path(folder) / 'focused.wav'
                    write_audio(source, runs)
                    self.assertEqual(focus_pcm(str(source), str(focused), mode)['suppressed_regions'], [])
                    self.assertFalse(focused.exists())

    def test_sarvam_request_window_restores_source_offset_even_for_request_wide_phrase(self):
        with tempfile.TemporaryDirectory() as folder:
            source, focused = Path(folder) / 'source.wav', Path(folder) / 'focused.wav'
            write_audio(source, [(1, 1.2, .04), (3, 8, .15)])
            report = focus_pcm(str(source), str(focused))
            processor = VideoProcessor.__new__(VideoProcessor)
            client = MagicMock()
            def transcribe(**kwargs):
                with wave.open(kwargs['file'], 'rb') as audio:
                    duration = audio.getnframes() / audio.getframerate()
                self.assertLess(duration, 6)
                return {'timestamps': {'words': ['मेरे पीछे जो आप शिप देख रहे हो'],
                                       'start_time_seconds': [0], 'end_time_seconds': [duration]}}
            client.speech_to_text.transcribe.side_effect = transcribe
            result = processor._transcribe_with_sarvam(client, str(focused), 'hi-IN', audio_window=report['window'])
            self.assertEqual([word['word'] for word in result], 'मेरे पीछे जो आप शिप देख रहे हो'.split())
            self.assertAlmostEqual(result[0]['start'], 3, places=2)
            self.assertAlmostEqual(result[-1]['end'], 8, places=2)
            self.assertTrue(all(word['start'] >= 3 and word['end'] <= 8.01 for word in result))
            client.speech_to_text.transcribe.assert_called_once()

    def test_pcm_slice_uses_exact_frame_offset(self):
        with tempfile.TemporaryDirectory() as folder:
            source, piece = Path(folder) / 'source.wav', Path(folder) / 'piece.wav'
            write_audio(source, [(0, 10, .1)])
            offset = slice_pcm(str(source), str(piece), 2.840031, 8.200031)
            self.assertEqual(offset, round(2.840031 * 16000) / 16000)
            self.assertEqual(read_audio(piece)[0], round(8.200031 * 16000) - round(2.840031 * 16000))

    def test_focus_is_validated_and_separates_cache_entries(self):
        from pydantic import ValidationError
        from backend.api_models import ProcessRequest
        from backend.media_records import _build_process_cache_path
        request = ProcessRequest(file_id='123e4567-e89b-12d3-a456-426614174000')
        self.assertEqual(request.speech_focus, 'main')
        with self.assertRaises(ValidationError):
            ProcessRequest(file_id=request.file_id, speech_focus='guess')
        self.assertNotEqual(_build_process_cache_path('media', 'hindi', 0, 0, 'clean', 'main'),
                            _build_process_cache_path('media', 'hindi', 0, 0, 'clean', 'all'))

    @unittest.skipUnless(shutil.which('ffmpeg'), 'FFmpeg not installed')
    def test_whisper_failover_uses_full_length_focused_audio_and_keeps_measured_times(self):
        with tempfile.TemporaryDirectory() as folder:
            source = Path(folder) / 'source.wav'
            write_audio(source, [(1, 1.2, .04), (3, 8, .15)])
            processor = VideoProcessor.__new__(VideoProcessor)
            processor.client = MagicMock()
            measured = [{'word': 'मेरे', 'start': 3.02, 'end': 3.21}, {'word': 'पीछे', 'start': 3.25, 'end': 3.5}]
            def transcribe(**kwargs):
                with wave.open(kwargs['file'], 'rb') as audio:
                    self.assertEqual(audio.getnframes(), 160000)
                    audio.setpos(16000)
                    self.assertEqual(set(audio.readframes(3200)), {0})
                return SimpleNamespace(language='hindi', words=measured)
            processor.client.audio.transcriptions.create.side_effect = transcribe
            with patch.dict(os.environ, {'SARVAM_API_KEY': ''}), patch('backend.processor.transcription_provider_health') as health:
                health.allow_request.return_value = True
                result = asyncio.run(processor.generate_captions_only(str(source), 'hindi'))
            self.assertTrue(result['success'], result)
            self.assertEqual([word for caption in result['captions'] for word in caption['words']], measured)
            self.assertEqual(result['transcription_source'], 'whisper_failover')
            self.assertTrue(result['audio_focus']['suppressed_regions'])
            # The timeline is the original source, including the quiet sound.
            self.assertGreater(max(result['audio_analysis']['samples'][20:24]), 0)
