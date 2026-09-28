import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from processor import VideoProcessor


class DeliveryGeometryTests(unittest.TestCase):
    def setUp(self):
        self.processor = VideoProcessor.__new__(VideoProcessor)

    def test_crop_positions_and_fit_padding(self):
        for aspect in ('9:16', '1:1', '16:9'):
            for width, height in ((1920, 1080), (1080, 1920)):
                left = self.processor._build_aspect_crop_filter(width, height, aspect, {'frame_x': 0, 'frame_y': 0})
                right = self.processor._build_aspect_crop_filter(width, height, aspect, {'frame_x': 100, 'frame_y': 100})
                self.assertEqual(left[1:], right[1:])
                if left[0]:
                    self.assertTrue(left[0].endswith(':0:0'))
                padded = self.processor._build_aspect_crop_filter(width, height, aspect, {'frame_fit': 'contain', 'frame_x': 0, 'frame_y': 0})
                self.assertGreaterEqual(padded[1], width)
                self.assertGreaterEqual(padded[2], height)
                if padded[1:] == (width, height):
                    self.assertEqual(padded[0], '', 'matching aspect must not add a two-pixel border')
                else:
                    self.assertIn(':0:0:color=black', padded[0])

    @unittest.skipUnless(shutil.which('ffmpeg') and shutil.which('ffprobe'), 'FFmpeg required')
    def test_final_encoded_frames_preserve_framing_at_all_ratios_and_fps(self):
        # Encode an asymmetric RGB chart: crop left/right must visibly select
        # red/blue, and contain must retain the complete chart plus black bars.
        with tempfile.TemporaryDirectory() as directory:
            for aspect in ('9:16', '1:1', '16:9'):
                for fps in (24, 30, 60):
                    for fit in ('cover', 'contain'):
                        for x in (0, 100):
                            vf, _, _ = self.processor._build_aspect_crop_filter(320, 120, aspect, {'frame_fit': fit, 'frame_x': x, 'frame_y': 50})
                            output = Path(directory) / 'frame.mp4'
                            chart = 'color=green:s=320x120:d=0.1,drawbox=x=0:y=0:w=100:h=120:color=red:t=fill,drawbox=x=220:y=0:w=100:h=120:color=blue:t=fill'
                            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', chart, '-vf', vf, '-r', str(fps), '-frames:v', '2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', str(output)], check=True, capture_output=True)
                            probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_streams', '-of', 'json', str(output)]))['streams'][0]
                            w, h = probe['width'], probe['height']
                            self.assertEqual(probe['r_frame_rate'], f'{fps}/1')
                            self.assertLess(abs(w / h - {'9:16': 9/16, '1:1': 1, '16:9': 16/9}[aspect]), 0.02)
                            pixels = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(output), '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'])
                            def pixel(px, py):
                                offset = (py * w + px) * 3
                                return tuple(pixels[offset:offset+3])
                            if fit == 'contain':
                                self.assertLess(max(pixel(w // 2, 1)), 15)
                            elif x == 0:
                                red = pixel(5, h // 2)
                                self.assertGreater(red[0], red[2] + 100)
                            else:
                                blue = pixel(w - 6, h // 2)
                                self.assertGreater(blue[2], blue[0] + 100)
