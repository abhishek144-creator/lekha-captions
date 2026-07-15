import os
import sys
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from processor import VideoProcessor

class AudioLessFallbackTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        # We can pass any dummy directory for fonts_dir
        self.processor = VideoProcessor(fonts_dir="flat_fonts")

    @patch.dict(os.environ, {"ALLOW_MOCK_TRANSCRIPTION": "1"})
    @patch("subprocess.run")
    async def test_audio_less_video_fallback(self, mock_run):
        # Mock subprocess.run for FFmpeg to raise an exception (like it would for a video with no audio)
        mock_run.side_effect = Exception("FFmpeg extraction failed")

        # Call generate_captions_only on a mock/dummy file path
        result = await self.processor.generate_captions_only(
            input_p="dummy_blank_video.mp4",
            target_language="English"
        )

        # Assert that the result indicates success and returns captions
        self.assertTrue(result.get("success"))
        self.assertEqual(result.get("transcription_source"), "mock_fallback")
        self.assertTrue(len(result.get("captions")) > 0)
        # Check that it generated mock captions
        first_caption = result.get("captions")[0]
        self.assertIn("text", first_caption)

    @patch.dict(os.environ, {"ALLOW_MOCK_TRANSCRIPTION": "0"})
    @patch("subprocess.run", side_effect=Exception("FFmpeg extraction failed"))
    async def test_provider_failure_does_not_fabricate_captions(self, _mock_run):
        result = await self.processor.generate_captions_only(
            input_p="dummy_blank_video.mp4",
            target_language="English",
        )

        self.assertFalse(result.get("success"))
        self.assertEqual(result.get("error_code"), "TRANSCRIPTION_PROVIDER_FAILED")
        self.assertNotIn("captions", result)

    async def test_render_success_requires_a_real_output_file(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            ass_path = os.path.join(temp_dir, "captions.ass")
            output_path = os.path.join(temp_dir, "missing.mp4")
            with open(ass_path, "w", encoding="utf-8") as ass_file:
                ass_file.write("[Script Info]\n")

            with (
                patch.object(self.processor, "_ensure_font", return_value={}),
                patch.object(self.processor, "_get_video_dimensions", return_value=(1080, 1920)),
                patch.object(self.processor, "_should_use_dom_template_renderer", return_value=False),
                patch.object(self.processor, "_create_styled_ass", return_value=ass_path),
                patch("processor.subprocess.run", return_value=SimpleNamespace(returncode=0, stderr="", stdout="")),
            ):
                result = await self.processor.burn_only(
                    "input.mp4",
                    output_path,
                    [{"text": "hello", "start_time": 0, "end_time": 1}],
                    {},
                )

            self.assertFalse(result.get("success"))
            self.assertFalse(os.path.exists(output_path))
            self.assertFalse(os.path.exists(ass_path))

if __name__ == "__main__":
    unittest.main()
