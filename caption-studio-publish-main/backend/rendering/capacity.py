"""Deterministic render sizing, queue selection, and autoscaling estimates."""

import math
import os


FAST_EXPORT_QUEUE_NAME = os.environ.get("FAST_EXPORT_QUEUE_NAME", "caption_export_fast")
NORMAL_EXPORT_QUEUE_NAME = os.environ.get("EXPORT_QUEUE_NAME", "caption_export_jobs")
HEAVY_EXPORT_QUEUE_NAME = os.environ.get("HEAVY_EXPORT_QUEUE_NAME", "caption_export_heavy")
GPU_EXPORT_QUEUE_NAME = os.environ.get("GPU_EXPORT_QUEUE_NAME", "caption_export_gpu")
RENDER_QUEUE_NAMES = tuple(dict.fromkeys((
    FAST_EXPORT_QUEUE_NAME,
    NORMAL_EXPORT_QUEUE_NAME,
    HEAVY_EXPORT_QUEUE_NAME,
)))


def render_class(request):
    style = request.get("style") or {}
    captions = request.get("captions") or []
    rich = bool(style.get("template_id") or style.get("template_20_id"))
    rich = rich or any(
        isinstance(caption, dict) and not caption.get("is_text_element") and (
            caption.get("template_id") or caption.get("template_20_id")
            or caption.get("applied_template_style")
        ) for caption in captions
    )
    return "dom" if rich else "ass"


def estimate_render_work_seconds(duration_seconds, request):
    """Return a bounded configurable estimate used for queue capacity."""
    try:
        duration = float(duration_seconds)
    except (TypeError, ValueError):
        duration = 0
    if not math.isfinite(duration) or duration <= 0:
        duration = 180
    duration = min(duration, 4 * 60 * 60)
    category = render_class(request)
    ratio_name = "EXPORT_DOM_WORK_RATIO" if category == "dom" else "EXPORT_ASS_WORK_RATIO"
    default_ratio = "3" if category == "dom" else "1"
    try:
        ratio = float(os.environ.get(ratio_name, default_ratio))
    except ValueError:
        ratio = float(default_ratio)
    if not math.isfinite(ratio):
        ratio = float(default_ratio)
    ratio = min(20, max(0.1, ratio))
    quality = str(request.get("quality") or "720p").lower()
    fps = int(request.get("fps") or 30)
    quality_factor = 1.5 if quality == "1080p" else 1
    fps_factor = min(2, max(0.8, fps / 30))
    return min(3600, max(15, math.ceil(10 + duration * ratio * quality_factor * fps_factor)))


def estimate_render_capacity(duration_seconds, request):
    """Return a stable queue class and work estimate for an export request."""
    estimated_seconds = estimate_render_work_seconds(duration_seconds, request)
    if estimated_seconds <= 90:
        queue_class = "fast"
        queue_name = FAST_EXPORT_QUEUE_NAME
    elif estimated_seconds <= 360:
        queue_class = "normal"
        queue_name = NORMAL_EXPORT_QUEUE_NAME
    else:
        queue_class = "heavy"
        queue_name = HEAVY_EXPORT_QUEUE_NAME
        if os.environ.get("GPU_RENDER_ENABLED", "0") == "1" and render_class(request) == "dom":
            queue_name = GPU_EXPORT_QUEUE_NAME
    return {
        "renderer": render_class(request),
        "render_class": queue_class,
        "queue_name": queue_name,
        "estimated_render_seconds": estimated_seconds,
        "render_work_units": max(1, math.ceil(estimated_seconds / 60)),
    }
