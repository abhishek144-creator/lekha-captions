from types import SimpleNamespace
from unittest.mock import patch

from backend.processor import VideoProcessor


def test_packaged_font_match_requires_exact_family(monkeypatch, tmp_path):
    monkeypatch.setenv("PREFER_PACKAGED_RENDER_FONTS", "1")
    with patch("backend.processor.shutil.which", return_value="/usr/bin/fc-match"):
        with patch.object(VideoProcessor, "_ensure_fallback_font"):
            processor = VideoProcessor(str(tmp_path))
        with patch("backend.processor.subprocess.run", return_value=SimpleNamespace(
            stdout="Noto Sans Devanagari, Noto Sans\n",
        )) as match:
            assert processor._packaged_font_available("Noto Sans Devanagari")
            assert processor._packaged_font_available("Noto Sans Devanagari")
            assert not processor._packaged_font_available("Inter")
            assert match.call_count == 2


def test_packaged_indic_font_avoids_network(monkeypatch, tmp_path):
    monkeypatch.setenv("PREFER_PACKAGED_RENDER_FONTS", "1")
    with patch.object(VideoProcessor, "_packaged_font_available", return_value=True):
        with patch("backend.processor.requests.get") as request:
            processor = VideoProcessor(str(tmp_path))
            result = processor._ensure_indic_font("devanagari")
            assert result["ass_name"] == "Noto Sans Devanagari"
            request.assert_not_called()
