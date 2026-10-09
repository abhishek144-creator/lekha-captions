import os
from unittest.mock import patch

import pytest

pytest.importorskip("fontTools")
from fontTools.ttLib import TTFont

from backend.processor import VideoProcessor
from backend.processor_fonts import GOOGLE_FONTS_MAP, INDIC_FONTS, css_font_weight


@pytest.fixture
def processor(tmp_path):
    with patch.object(VideoProcessor, "_ensure_fallback_font"):
        return VideoProcessor(str(tmp_path))


@pytest.mark.parametrize(("font_weight", "is_bold", "expected"), [
    ("800", False, 800),
    ("bold", False, 700),
    ("normal", False, 400),
    (None, False, 500),
    ("not-a-weight", False, 500),
    ("500", True, 700),
    ("900", True, 900),
])
def test_css_font_weight_matches_the_dom_renderer(font_weight, is_bold, expected):
    assert css_font_weight(font_weight, is_bold) == expected


def test_variable_font_is_instanced_at_the_requested_weight(processor, tmp_path):
    info = INDIC_FONTS["devanagari"]

    assert processor._weighted_font_family(info, 800) == "Noto Sans Devanagari Lekha W800"
    assert processor._weighted_font_family(info, 400) == "Noto Sans Devanagari Lekha W400"

    heavy = TTFont(tmp_path / "NotoSansDevanagari-lekha-w800.ttf")
    regular = TTFont(tmp_path / "NotoSansDevanagari-lekha-w400.ttf")
    # libass can only draw it at this weight: no variation tables survive.
    assert "fvar" not in heavy and "gvar" not in heavy
    assert heavy["OS/2"].usWeightClass == 800
    assert heavy["name"].getDebugName(1) == "Noto Sans Devanagari Lekha W800"
    assert heavy["name"].getDebugName(16) is None
    # The outlines really moved along wght, not just the metadata.
    assert sum(width for width, _ in heavy["hmtx"].metrics.values()) > \
        sum(width for width, _ in regular["hmtx"].metrics.values())


def test_instances_are_reused_across_exports_and_processes(processor, tmp_path):
    info = INDIC_FONTS["devanagari"]
    processor._weighted_font_family(info, 700)

    with patch("backend.processor_fonts.instantiateVariableFont") as instancer:
        assert processor._weighted_font_family(info, 700) == "Noto Sans Devanagari Lekha W700"
        with patch.object(VideoProcessor, "_ensure_fallback_font"):
            restarted = VideoProcessor(str(tmp_path))
        assert restarted._weighted_font_family(info, 700) == "Noto Sans Devanagari Lekha W700"
    instancer.assert_not_called()


def test_static_fonts_and_missing_fonttools_keep_the_family(processor, tmp_path):
    assert processor._weighted_font_family({"file": "Mukta-Regular.ttf", "ass_name": "Mukta"}, 800) is None
    assert processor._weighted_font_family({"file": "Missing.ttf", "ass_name": "Missing"}, 800) is None
    with patch("backend.processor_fonts.instantiateVariableFont", None):
        assert processor._weighted_font_family(INDIC_FONTS["devanagari"], 800) is None
    assert os.listdir(tmp_path) == []


def test_ass_style_names_the_weighted_instance(processor):
    captions = [{"id": "1-0", "start_time": 0.0, "end_time": 2.0, "text": "Heavy weight"}]
    style = {"font_family": "Roboto", "font_weight": "800", "position_y": 50}
    ass_path = processor._create_styled_ass(captions, style, GOOGLE_FONTS_MAP["Roboto"], 1080, 1920)
    try:
        with open(ass_path, encoding="utf-8") as stream:
            ass = stream.read()
    finally:
        os.remove(ass_path)

    default_style = next(line for line in ass.splitlines() if line.startswith("Style: Default,"))
    fields = default_style[len("Style: "):].split(",")
    assert fields[1] == "Roboto Lekha W800"
    # Bold stays requested; the 800 face is heavier than 700, so libass
    # draws it as-is instead of smearing outlines.
    assert fields[7] == "1"
    assert "\\fnRoboto Lekha W800" in ass
