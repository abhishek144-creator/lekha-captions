import os
import re
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from processor import VideoProcessor
from processor_fonts import DEFAULT_ASS_CELL_HEIGHT_RATIO, read_font_cell_height_ratio

BUNDLED_FONTS = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "flat_fonts"))


class AssSizeReferenceTests(unittest.TestCase):
    """The ASS path must size font_size like the DOM renderer: CSS px on a
    360px-wide preview, converted from em to libass's cell height."""

    def setUp(self):
        self.processor = VideoProcessor(fonts_dir=BUNDLED_FONTS)

    def _style_fontsize(self, video_w, video_h, font_info, **style):
        captions = [{"id": "c-0", "text": "HEXAGON flux", "start_time": 0, "end_time": 2}]
        ass_path = self.processor._create_styled_ass(
            captions, {"font_size": 17, **style}, font_info, video_w, video_h,
        )
        try:
            with open(ass_path, encoding="utf-8") as handle:
                header = handle.read()
        finally:
            os.remove(ass_path)
        return int(re.search(r"^Style: Default,[^,]*,(\d+),", header, re.M).group(1))

    def test_reads_win_metrics_cell_height(self):
        # Inter: (usWinAscent 2269 + usWinDescent 660) / 2048 upm.
        ratio = read_font_cell_height_ratio(os.path.join(BUNDLED_FONTS, "Inter.ttf"))
        self.assertAlmostEqual(ratio, 2929 / 2048, places=4)

    def test_font_size_uses_360_wide_reference_with_cell_conversion(self):
        inter = {"ass_name": "Inter", "file": "Inter.ttf"}
        # 17 css px * (1080 / 360) * 1.430 = 72.9
        self.assertEqual(self._style_fontsize(1080, 1920, inter), 73)
        # Width-based like the DOM renderer, so 1:1 matches 9:16 at the same width.
        self.assertEqual(self._style_fontsize(1080, 1080, inter), 73)
        # Stale browser hints are stripped server-side and must not matter here.
        self.assertEqual(self._style_fontsize(1080, 1920, inter, preview_height=533), 73)

    def test_unreadable_font_keeps_default_ratio(self):
        missing = {"ass_name": "Inter", "file": "does-not-exist.ttf"}
        expected = round(17 * 3 * DEFAULT_ASS_CELL_HEIGHT_RATIO)
        self.assertEqual(self._style_fontsize(1080, 1920, missing), expected)


if __name__ == "__main__":
    unittest.main()
