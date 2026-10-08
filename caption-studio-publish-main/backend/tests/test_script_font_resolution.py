import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from processor import VideoProcessor
from processor_fonts import (
    DEVANAGARI_FONT_NAMES,
    LATIN_TO_DEVANAGARI_FONT,
    detect_text_script,
    font_covers_codepoint,
    resolve_script_font_family,
)

BACKEND = Path(__file__).resolve().parents[1]
BUNDLED_FONTS = BACKEND / "flat_fonts"
JS_RESOLVER = BACKEND.parent / "src" / "components" / "dashboard" / "scriptFontResolver.js"

FAMILIES = sorted(set(LATIN_TO_DEVANAGARI_FONT) | DEVANAGARI_FONT_NAMES) + [
    "", "Roboto", "Courier New", "Orbitron X", "Anton SC", "Ultra", "Roboto Condensed",
    "Cinzel Decorative", "Abril", "Didot", "DM Serif Text", "Georgia", "Brush Script",
]
TEXTS = [
    "HEXAGON flux", "नमस्ते दुनिया", "Hello नमस्ते दुनिया", "வணக்கம்", "স্বাগতম",
    "ਸਤ ਸ੍ਰੀ ਅਕਾਲ", "こんにちは", "你好世界", "안녕하세요", "مرحبا", "123 !?",
]


class ScriptFontResolverParityTests(unittest.TestCase):
    """The ASS path must pick the face the editor and DOM renderer pick."""

    @unittest.skipUnless(shutil.which("node"), "node is required to run scriptFontResolver.js")
    def test_python_port_matches_script_font_resolver_js(self):
        cases = [[family, text] for family in FAMILIES for text in TEXTS]
        script = (
            f"import {{ resolveScriptFontFamily, detectScript }} from {json.dumps(JS_RESOLVER.as_uri())};"
            "let raw = ''; process.stdin.setEncoding('utf8');"
            "for await (const chunk of process.stdin) raw += chunk;"
            "const cases = JSON.parse(raw);"
            "console.log(JSON.stringify(cases.map(([f, t]) => [resolveScriptFontFamily(f, t), detectScript(t)])));"
        )
        result = subprocess.run(
            ["node", "--input-type=module", "-e", script],
            input=json.dumps(cases), capture_output=True, text=True, encoding="utf-8", timeout=60, check=True,
        )
        expected = json.loads(result.stdout)
        actual = [[resolve_script_font_family(f, t), detect_text_script(t)] for f, t in cases]
        mismatches = [(case, e, a) for case, e, a in zip(cases, expected, actual) if e != a]
        self.assertEqual(mismatches, [])


class AssScriptFontTests(unittest.TestCase):
    def _events(self, processor, text, font_family="Inter", font_info=None):
        ass_path = processor._create_styled_ass(
            [{"id": "c-0", "text": text, "start_time": 0, "end_time": 2}],
            {"font_size": 17, "font_family": font_family},
            font_info or processor._ensure_font(font_family), 1080, 1920,
        )
        try:
            with open(ass_path, encoding="utf-8") as handle:
                return handle.read().split("[Events]")[1]
        finally:
            os.remove(ass_path)

    def test_hindi_uses_resolver_font_at_the_latin_position(self):
        processor = VideoProcessor(fonts_dir=str(BUNDLED_FONTS))
        hindi = self._events(processor, "नमस्ते दुनिया")
        latin = self._events(processor, "HEXAGON flux")
        self.assertIn("\\fnPoppins", hindi)
        # No per-script vertical shift: the editor and DOM renderer have none.
        position = re.compile(r"\\pos\((\d+),(\d+)\)")
        self.assertEqual(position.search(hindi).groups(), position.search(latin).groups())

    def test_latin_only_file_for_resolved_face_falls_back_to_script_face(self):
        with tempfile.TemporaryDirectory() as fonts_dir:
            shutil.copy(BUNDLED_FONTS / "Inter.ttf", fonts_dir)
            shutil.copy(BUNDLED_FONTS / "NotoSansDevanagari.ttf", fonts_dir)
            # A stale Latin-only download standing in for Khand.
            shutil.copy(BUNDLED_FONTS / "Inter.ttf", os.path.join(fonts_dir, "Khand-Regular.ttf"))
            processor = VideoProcessor(fonts_dir=fonts_dir)
            events = self._events(
                processor, "आपका स्वागत है", font_family="Bebas Neue",
                font_info={"ass_name": "Bebas Neue", "file": "BebasNeue-Regular.ttf"},
            )
        self.assertIn("\\fnNoto Sans Devanagari", events)

    def test_cmap_coverage(self):
        self.assertTrue(font_covers_codepoint(str(BUNDLED_FONTS / "Poppins-Regular.ttf"), 0x0928))
        self.assertFalse(font_covers_codepoint(str(BUNDLED_FONTS / "Inter.ttf"), 0x0928))
        self.assertTrue(font_covers_codepoint(str(BUNDLED_FONTS / "Inter.ttf"), ord("A")))


if __name__ == "__main__":
    unittest.main()
