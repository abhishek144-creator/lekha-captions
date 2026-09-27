"""Shared fixtures and statistics for the matched renderer benchmark."""

from __future__ import annotations

import math
import statistics


RENDERERS = ("ass", "dom")


def build_caption_fixture(duration_seconds: float) -> list[dict]:
    """Create one deterministic caption timeline used by both renderers."""
    duration = max(1.5, float(duration_seconds))
    phrases = (
        "Measure every successful export",
        "Keep captions readable and aligned",
        "Compare identical media workloads",
    )
    slot = duration / len(phrases)
    captions = []
    for index, phrase in enumerate(phrases):
        start = index * slot
        end = duration if index == len(phrases) - 1 else (index + 1) * slot
        words = phrase.split()
        word_duration = (end - start) / len(words)
        captions.append({
            "id": f"benchmark-caption-{index + 1}",
            "text": phrase,
            "start_time": round(start, 3),
            "end_time": round(end, 3),
            "words": [
                {
                    "word": word,
                    "start": round(start + word_index * word_duration, 3),
                    "end": round(start + (word_index + 1) * word_duration, 3),
                }
                for word_index, word in enumerate(words)
            ],
        })
    return captions


def build_renderer_style(renderer: str, quality: str, fps: int) -> dict:
    """Return controlled styles that deliberately select one production path."""
    if renderer not in RENDERERS:
        raise ValueError(f"unsupported renderer: {renderer}")
    style = {
        "font_family": "Inter",
        "font_size": 48,
        "font_weight": 700,
        "text_color": "#ffffff",
        "position_x": 50,
        "position_y": 75,
        "quality": quality,
        "fps": fps,
        "export_aspect_ratio": "9:16",
    }
    if renderer == "dom":
        # A bounded text box is a supported rich-layout feature that
        # deterministically routes to the browser DOM/CSS renderer without
        # fabricating the snapshot metadata required by an authored template.
        # Caption media and timing remain the same as the ASS run.
        style.update({
            "box_width": 515,
        })
    return style


def percentile(values: list[float], percent: float) -> float:
    """Return a linearly interpolated percentile for a non-empty sample."""
    if not values:
        raise ValueError("percentile requires at least one value")
    ordered = sorted(float(value) for value in values)
    if len(ordered) == 1:
        return ordered[0]
    rank = (len(ordered) - 1) * min(100.0, max(0.0, percent)) / 100.0
    lower = math.floor(rank)
    upper = math.ceil(rank)
    if lower == upper:
        return ordered[lower]
    return ordered[lower] + (ordered[upper] - ordered[lower]) * (rank - lower)


def summarize_runs(runs: list[dict], duration_seconds: float) -> dict:
    """Aggregate successful and failed measured runs for one renderer."""
    successful = [run for run in runs if run.get("success")]
    elapsed = [float(run["elapsed_seconds"]) for run in successful]
    summary = {
        "attempts": len(runs),
        "successful": len(successful),
        "failed": len(runs) - len(successful),
        "success_rate": round(len(successful) / len(runs), 4) if runs else 0.0,
    }
    if not elapsed:
        return summary
    median_seconds = statistics.median(elapsed)
    summary.update({
        "median_seconds": round(median_seconds, 4),
        "p95_seconds": round(percentile(elapsed, 95), 4),
        "median_realtime_factor": round(median_seconds / float(duration_seconds), 4),
        "median_output_bytes": int(statistics.median(
            int(run.get("output_bytes") or 0) for run in successful
        )),
    })
    return summary


def compare_summaries(summaries: dict) -> dict:
    """Calculate a DOM/ASS duration ratio when both paths succeeded."""
    ass = summaries.get("ass") or {}
    dom = summaries.get("dom") or {}
    ass_median = float(ass.get("median_seconds") or 0)
    dom_median = float(dom.get("median_seconds") or 0)
    if ass_median <= 0 or dom_median <= 0:
        return {"dom_to_ass_median_ratio": None}
    return {"dom_to_ass_median_ratio": round(dom_median / ass_median, 4)}
