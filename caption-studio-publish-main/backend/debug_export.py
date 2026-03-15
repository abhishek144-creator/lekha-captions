import asyncio
from processor import VideoProcessor
import os

async def run_test():
    FONTS_DIR = os.path.abspath("flat_fonts")
    vp = VideoProcessor(FONTS_DIR)
    
    # Create dummy video
    if not os.path.exists("dummy.mp4"):
        print("Generating dummy.mp4...")
        os.system("ffmpeg -y -f lavfi -i color=c=blue:s=1080x1920:d=5 -c:v libx264 dummy.mp4")
    
    captions = [
        {
            "id": "c1",
            "text": "Regular Caption",
            "start_time": 0.5,
            "end_time": 4.0,
            "animation": "none"
        },
        {
            "id": "te1",
            "text": "Text Element\nNew Line",
            "start_time": 1.0,
            "end_time": 4.0,
            "is_text_element": True,
            "custom_style": {
                "font_family": "Roboto",
                "font_size": 115,
                "text_color": "#ff0000",
                "text_align": "center",
                "position_x": 50,
                "position_y": 20,
                "has_background": False,
                "has_stroke": True,
                "stroke_color": "#ffffff",
                "stroke_width": 5,
                "effect_type": "neon",
                "effect_intensity": 100
            }
        }
    ]
    style = {
        "font_family": "Montserrat",
        "font_size": 96,
        "text_color": "#ffffff",
        "position_x": 50,
        "position_y": 80,
    }
    
    print("Running burn_only...")
    await vp.burn_only(os.path.abspath("dummy.mp4"), os.path.abspath("dummy_out.mp4"), captions, style, {})
    print("Export complete. Check dummy_out.mp4")

if __name__ == "__main__":
    asyncio.run(run_test())
