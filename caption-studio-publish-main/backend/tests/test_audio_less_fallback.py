import os
import sys
import unittest
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from processor import VideoProcessor

class AudioLessFallbackTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        # We can pass any dummy directory for fonts_dir
        self.processor = VideoProcessor(fonts_dir="flat_fonts")

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

if __name__ == "__main__":
    unittest.main()
