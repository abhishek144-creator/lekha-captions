import asyncio
import json
import os
import sys

from backend.processor import VideoProcessor

async def test_burn():
    vp = VideoProcessor(fonts_dir="fonts")
    
    # Create fake video wrapper
    # we just need it to get dimensions, so let's mock _get_video_dimensions
    vp._get_video_dimensions = lambda p: (1080, 1920)
    vp._ensure_font = lambda f: {"ass_name": "Arial"}
    
    # Actually just overriding the ffmpeg call so we don't need real video
    original_run = __import__('subprocess').run
    def mock_run(cmd, *args, **kwargs):
        print("Mock FFmpeg ran:", cmd)
        class Res:
            returncode = 0
        return Res()
    __import__('subprocess').run = mock_run

    captions = [
        {
            "id": "cap1",
            "start": 0.0,
            "end": 2.0,
            "text": "Hello world",
            "words": [
                {"word": "Hello", "start": 0.0, "end": 1.0},
                {"word": "world", "start": 1.0, "end": 2.0}
            ]
        },
        {
            "id": "cap2_text_element",
            "start_time": 0.5,
            "end_time": 2.5,
            "text": "New Text Box",
            "is_text_element": True,
            "custom_style": {
                "position_x": 50,
                "position_y": 20,
                "font_size": 40,
                "text_color": "#ff0000",
                "effect_type": "shadow"
            }
        }
    ]

    style = {
        "font_family": "Inter",
        "font_size": 30,
        "text_color": "#ffffff"
    }
    
    word_layouts = {
        "cap1-0": {"x": 50, "y": 50, "w": 20, "h": 5},
        "cap1-1": {"x": 50, "y": 60, "w": 20, "h": 5}
    }
    
    res = await vp.burn_only("dummy.mp4", "out.mp4", captions, style, word_layouts)
    print("Burn result:", res)
    
if __name__ == "__main__":
    asyncio.run(test_burn())
