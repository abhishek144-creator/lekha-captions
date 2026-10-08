"""Source media probing and export geometry: duration, dimensions, rotation, fps, crop and quality.

Mixed into processor.VideoProcessor; methods use its instance state.
"""

import json
import math

try:
    from .media_commands import run_media_command
except ImportError:  # Direct execution from backend/ remains supported.
    from media_commands import run_media_command


class MediaProbeMixin:
    def _get_video_duration(self, video_path):
        try:
            result = run_media_command(
                [
                    "ffprobe", "-v", "error", "-show_entries", "format=duration",
                    "-of", "default=nw=1:nk=1", video_path
                ],
                capture_output=True, text=True, check=True
            )
            return max(float((result.stdout or "0").strip() or 0), 0.01)
        except Exception:
            return 1.0

    def _get_quality_settings(self, quality, export_aspect_ratio=""):
        aspect = str(export_aspect_ratio or "").strip()
        base = 2160 if quality == '4k' else 720 if quality == '720p' else 1080
        crf = "18" if quality == '4k' else "26" if quality == '720p' else "22"
        audio_bitrate = "192k" if quality == '4k' else "128k"
        if aspect == "9:16":
            return f"scale={base}:{base * 16 // 9}:flags=lanczos", crf, audio_bitrate
        if aspect == "1:1":
            return f"scale={base}:{base}:flags=lanczos", crf, audio_bitrate
        if aspect == "16:9":
            return f"scale={base * 16 // 9}:{base}:flags=lanczos", crf, audio_bitrate
        if quality == '4k':
            return "scale=2160:-2:flags=lanczos", "18", "192k"
        if quality == '720p':
            return "scale=720:-2:flags=lanczos", "26", "128k"
        return "scale=1080:-2:flags=lanczos", "22", "128k"

    def _get_output_dimensions(self, video_w, video_h, quality, export_aspect_ratio=""):
        """Return the final even-sized canvas used by the video encoder."""
        aspect = str(export_aspect_ratio or "").strip()
        base = 2160 if quality == '4k' else 720 if quality == '720p' else 1080
        if aspect == "9:16":
            return base, base * 16 // 9
        if aspect == "1:1":
            return base, base
        if aspect == "16:9":
            return base * 16 // 9, base
        if video_w <= 0 or video_h <= 0:
            return base, base * 16 // 9
        output_h = max(2, int(round((video_h * base / video_w) / 2) * 2))
        return base, output_h

    def _get_export_fps(self, style):
        try:
            fps = int(style.get('fps', 30) or 30)
        except (TypeError, ValueError):
            fps = 30
        return fps if fps in {24, 30, 60} else 30

    def _get_export_aspect_ratio(self, style):
        value = str(style.get('export_aspect_ratio') or '').strip()
        return value if value in {'9:16', '1:1', '16:9'} else ''

    def _build_aspect_crop_filter(self, video_w, video_h, target_aspect, style=None):
        ratios = {'9:16': 9 / 16, '1:1': 1, '16:9': 16 / 9}
        ratio = ratios.get(target_aspect)
        if not ratio or video_w <= 0 or video_h <= 0:
            return "", video_w, video_h
        style = style or {}

        def fraction(key):
            try:
                number = float(style.get(key, 50))
                return max(0, min(100, number)) / 100 if math.isfinite(number) else 0.5
            except (TypeError, ValueError):
                return 0.5

        x, y = fraction("frame_x"), fraction("frame_y")
        even = lambda value: max(2, int(value) // 2 * 2)
        even_up = lambda value: max(2, math.ceil(value / 2) * 2)
        if style.get("frame_fit") == "contain":
            # Letterbox before captions, so their positions refer to the output
            # canvas exactly as they do in the browser preview.
            width = max(video_w, even_up(video_h * ratio))
            height = max(video_h, even_up(video_w / ratio))
            if width == video_w and height == video_h:
                return "", video_w, video_h
            left, top = int((width - video_w) * x) // 2 * 2, int((height - video_h) * y) // 2 * 2
            left = min(left, width - video_w)
            top = min(top, height - video_h)
            return f"pad={width}:{height}:{left}:{top}:color=black", width, height
        width = min(video_w, even(video_h * ratio))
        height = min(video_h, even(video_w / ratio))
        left = int((video_w - width) * x) // 2 * 2
        top = int((video_h - height) * y) // 2 * 2
        if width == video_w and height == video_h:
            return "", video_w, video_h
        return f"crop={width}:{height}:{left}:{top}", width, height

    def _get_video_dimensions(self, video_path):
        try:
            result = run_media_command(
                ["ffprobe", "-v", "error", "-select_streams", "v:0",
                 "-show_entries", "stream=width,height",
                 "-of", "json", video_path],
                capture_output=True, text=True
            )
            data = json.loads(result.stdout)
            w = data['streams'][0]['width']
            h = data['streams'][0]['height']

            rotation = self._get_rotation(video_path)
            if rotation in (90, -90, 270, -270):
                w, h = h, w
                print(f"Video is rotated {rotation}°, swapping dimensions to {w}x{h}")

            return w, h
        except Exception:
            return 1080, 1920

    def _get_rotation(self, video_path):
        try:
            result = run_media_command(
                ["ffprobe", "-v", "error", "-select_streams", "v:0",
                 "-show_entries", "stream_side_data=rotation",
                 "-of", "json", video_path],
                capture_output=True, text=True
            )
            data = json.loads(result.stdout)
            for stream in data.get('streams', []):
                for sd in stream.get('side_data_list', []):
                    rot = sd.get('rotation')
                    if rot is not None:
                        return int(rot)

            result2 = run_media_command(
                ["ffprobe", "-v", "error", "-select_streams", "v:0",
                 "-show_entries", "stream_tags=rotate",
                 "-of", "default=nw=1:nk=1", video_path],
                capture_output=True, text=True
            )
            rot_str = result2.stdout.strip()
            if rot_str:
                return int(rot_str)
        except Exception:
            pass
        return 0
