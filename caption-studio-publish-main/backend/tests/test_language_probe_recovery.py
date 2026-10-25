import pathlib
import sys
import tempfile
from types import SimpleNamespace
from unittest.mock import Mock, patch

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from processor import VideoProcessor
from provider_health import ProviderCircuitBreaker


def test_successful_language_probe_reopens_transcription_after_cooldown():
    now = [100.0]
    breaker = ProviderCircuitBreaker(failure_threshold=1, cooldown_seconds=10, clock=lambda: now[0])
    breaker._redis = None
    breaker.record_failure('openai')
    now[0] = 111.0
    processor = VideoProcessor.__new__(VideoProcessor)
    processor.client = Mock()
    processor.client.audio.transcriptions.create.return_value = SimpleNamespace(language='english')
    with tempfile.NamedTemporaryFile() as audio, patch('processor.transcription_provider_health', breaker), patch('processor.run_media_command'):
        assert processor._detect_spoken_language(audio.name) == 'english'
    assert breaker.allow_request('openai')
    assert breaker.snapshot()['openai']['status'] == 'healthy'


def test_failed_language_probe_records_failure_and_releases_probe():
    now = [100.0]
    breaker = ProviderCircuitBreaker(failure_threshold=1, cooldown_seconds=10, clock=lambda: now[0])
    breaker._redis = None
    breaker.record_failure('openai')
    now[0] = 111.0
    processor = VideoProcessor.__new__(VideoProcessor)
    processor.client = Mock()
    processor.client.audio.transcriptions.create.side_effect = RuntimeError('provider unavailable')
    with tempfile.NamedTemporaryFile() as audio, patch('processor.transcription_provider_health', breaker), patch('processor.run_media_command'):
        assert processor._detect_spoken_language(audio.name) == ''
    assert breaker.snapshot()['openai']['consecutive_failures'] == 2
    assert not breaker.allow_request('openai')
