"""Deterministic render sizing and queue classification."""

from __future__ import annotations

import math
import os
from typing import Any, Dict


FAST_EXPORT_QUEUE_NAME = os.environ.get("FAST_EXPORT_QUEUE_NAME", "caption_export_fast")
NORMAL_EXPORT_QUEUE_NAME = os.environ.get("EXPORT_QUEUE_NAME", "caption_export_jobs")
HEAVY_EXPORT_QUEUE_NAME = os.environ.get("HEAVY_EXPORT_QUEUE_NAME", "caption_export_heavy")
GPU_EXPORT_QUEUE_NAME = os.environ.get("GPU_EXPORT_QUEUE_NAME", "caption_export_gpu")
RENDER_QUEUE_NAMES = tuple(dict.fromkeys((
    FAST_EXPORT_QUEUE_NAME,
    NORMAL_EXPORT_QUEUE_NAME,
    HEAVY_EXPORT_QUEUE_NAME,
)))


def uses_dom_renderer(payload: Dict[str, Any]) -> bool:
    style = payload.get("style") or {}
    if style.get("template_id") or style.get("template_20_id") or style.get("template_markup"):
        return True
    return any(
        caption.get("template_id")
        or caption.get("template_20_id")
        or caption.get("applied_template_style")
        for caption in (payload.get("captions") or [])
        if isinstance(caption, dict) and not caption.get("is_text_element")
    )


def estimate_render_capacity(
    payload: Dict[str, Any],
    duration_seconds: float,
    seconds_per_unit: float | None = None,
) -> Dict[str, Any]:
    """Estimate normalized work before enqueueing; identical requests classify identically."""
    quality = str(payload.get("quality") or "1080p").lower()
    fps = int(payload.get("fps") or 30)
    quality_factor = {"720p": 1.0, "1080p": 2.0, "4k": 6.0}.get(quality, 2.0)
    template_factor = 2.0 if uses_dom_renderer(payload) else 1.0
    duration_factor = max(1.0, float(duration_seconds or 0.0) / 30.0)
    work_units = max(1, int(math.ceil(duration_factor * quality_factor * (fps / 30.0) * template_factor)))
    calibrated_seconds = seconds_per_unit
    if calibrated_seconds is None:
        calibrated_seconds = float(os.environ.get("RENDER_SECONDS_PER_WORK_UNIT", "12"))
    calibrated_seconds = max(1.0, min(float(calibrated_seconds), 180.0))
    estimated_seconds = max(1, int(math.ceil(work_units * calibrated_seconds)))
    if work_units <= 2:
        render_class = "fast"
        queue_name = FAST_EXPORT_QUEUE_NAME
    elif work_units <= 8:
        render_class = "normal"
        queue_name = NORMAL_EXPORT_QUEUE_NAME
    else:
        render_class = "heavy"
        if os.environ.get("GPU_RENDER_ENABLED", "0") == "1":
            queue_name = GPU_EXPORT_QUEUE_NAME
        elif os.environ.get("SPOT_RENDER_ENABLED", "0") == "1":
            queue_name = HEAVY_EXPORT_QUEUE_NAME
        else:
            queue_name = NORMAL_EXPORT_QUEUE_NAME
    return {
        "render_class": render_class,
        "queue_name": queue_name,
        "render_work_units": work_units,
        "estimated_render_seconds": estimated_seconds,
    }
