"""Summarize actual export observations from Cloud Logging JSON or JSONL.

Example:
  gcloud logging read 'textPayload:"export_observation"' --format=json --limit=10000 > exports.json
  python scripts/analyze_export_observations.py exports.json

Supply --billing-cost-usd only for a cost total covering the same observation
window and infrastructure. The script never treats a configured cost estimate as
an actual bill.
"""

import argparse
import json
import math
import pathlib


def _record(entry):
    if not isinstance(entry, dict):
        return None
    if entry.get("event") == "export_observation":
        return entry
    payload = entry.get("jsonPayload")
    if isinstance(payload, dict) and payload.get("event") == "export_observation":
        return payload
    raw = entry.get("textPayload") or ""
    if isinstance(raw, str) and "export_observation" in raw:
        try:
            decoded = json.loads(raw[raw.index("{"):])
            if decoded.get("event") == "export_observation":
                return decoded
        except (ValueError, TypeError, AttributeError):
            return None
    return None


def load_observations(path):
    source = pathlib.Path(path).read_text(encoding="utf-8-sig")
    try:
        entries = json.loads(source)
        if isinstance(entries, dict):
            entries = [entries]
    except json.JSONDecodeError:
        entries = [json.loads(line) for line in source.splitlines() if line.strip()]
    return [item for entry in entries if (item := _record(entry)) is not None]


def percentile(values, fraction):
    if not values:
        return None
    ordered = sorted(float(value) for value in values)
    return round(ordered[max(0, math.ceil(len(ordered) * fraction) - 1)], 3)


def _percentiles(values):
    return {label: percentile(values, fraction) for label, fraction in
            (("p50", 0.5), ("p95", 0.95), ("p99", 0.99))}


def _seconds(rows, field):
    return [float(row[field]) / 1000 for row in rows if row.get(field) is not None]


def _workload_summary(rows):
    durations = [max(0.0, float(row.get("rendered_duration_seconds") or 0))
                 for row in rows]
    return {
        "samples": len(rows),
        "rendered_video_minutes": round(sum(durations) / 60, 3),
        "queue_wait_seconds": _percentiles(_seconds(rows, "queue_wait_ms")),
        "preparation_seconds": _percentiles(_seconds(rows, "preparation_ms")),
        "render_seconds": _percentiles(_seconds(rows, "render_ms")),
        "finalization_seconds": _percentiles(_seconds(rows, "finalization_ms")),
        "end_to_end_export_seconds": _percentiles(_seconds(rows, "total_ms")),
        "cache_hit_rate": round(sum(bool(row.get("cache_hit")) for row in rows) / len(rows), 4)
        if rows else None,
    }


def _duration_bucket(row):
    seconds = max(0.0, float(row.get("source_duration_seconds") or 0))
    if seconds <= 60:
        return "short_0_60s"
    if seconds <= 180:
        return "medium_61_180s"
    if seconds <= 600:
        return "long_181_600s"
    return "very_long_over_600s"


def _resolution(row, prefix):
    width = int(row.get(f"{prefix}_width") or 0)
    height = int(row.get(f"{prefix}_height") or 0)
    return f"{width}x{height}" if width > 0 and height > 0 else "unknown"


def _renderer(row):
    value = str(row.get("renderer") or "").strip().lower()
    if value in {"ass", "dom"}:
        return value
    return "dom" if row.get("template_export") else "ass"


def _work_ratio_calibration(rows):
    """Derive shadow-model ratios from measured renders without changing runtime policy."""
    grouped = {"ass": [], "dom": []}
    for row in rows:
        if row.get("cache_hit") or row.get("render_ms") is None:
            continue
        duration = float(
            row.get("source_duration_seconds")
            or row.get("rendered_duration_seconds")
            or 0
        )
        actual_seconds = float(row["render_ms"]) / 1000
        if duration <= 0 or actual_seconds <= 0:
            continue
        quality_factor = 1.5 if str(row.get("quality") or "").lower() == "1080p" else 1
        fps = max(1, int(row.get("fps") or 30))
        fps_factor = min(2, max(0.8, fps / 30))
        # Mirrors estimate_render_work_seconds(). The ten-second fixed term is
        # removed before solving for the empirical media-duration ratio.
        ratio = (actual_seconds - 10) / (duration * quality_factor * fps_factor)
        grouped[_renderer(row)].append(min(20, max(0.1, ratio)))
    return {
        renderer: {
            "samples": len(values),
            "empirical_ratio": _percentiles(values),
            "runtime_environment_variable": (
                "EXPORT_DOM_WORK_RATIO" if renderer == "dom"
                else "EXPORT_ASS_WORK_RATIO"
            ),
        }
        for renderer, values in grouped.items()
    }


def _group(rows, key):
    groups = {}
    for row in rows:
        label = str(key(row) or "unknown")
        groups.setdefault(label, []).append(row)
    return {label: _workload_summary(groups[label]) for label in sorted(groups)}


def summarize(observations, billing_cost_usd=None):
    terminal = {}
    for row in observations:
        if row.get("status") in {"completed", "failed"} and row.get("job_id"):
            terminal[row["job_id"]] = row
    completed = [row for row in terminal.values() if row["status"] == "completed"]
    failures = [row for row in terminal.values() if row["status"] == "failed"]
    durations = [max(0.0, float(row.get("rendered_duration_seconds") or 0))
                 for row in completed]
    minutes = sum(durations) / 60
    queue_waits = [float(row["queue_wait_ms"]) / 1000 for row in completed
                   if row.get("queue_wait_ms") is not None]
    render_times = [float(row["render_ms"]) / 1000 for row in completed
                    if row.get("render_ms") is not None]
    totals = [float(row["total_ms"]) / 1000 for row in completed
              if row.get("total_ms") is not None]
    measured = len(completed) + len(failures)
    prediction_pairs = [
        (float(row["render_ms"]) / 1000, float(row["estimated_render_seconds"]))
        for row in completed
        if not row.get("cache_hit") and row.get("render_ms") is not None
        and row.get("estimated_render_seconds") is not None
        and float(row["estimated_render_seconds"]) > 0
    ]
    result = {
        "completed": len(completed),
        "failed": len(failures),
        "terminal_success_rate": round(len(completed) / measured, 4) if measured else None,
        "rendered_video_minutes": round(minutes, 3),
        "queue_wait_seconds": _percentiles(queue_waits),
        "preparation_seconds": _percentiles(_seconds(completed, "preparation_ms")),
        "render_seconds": _percentiles(render_times),
        "finalization_seconds": _percentiles(_seconds(completed, "finalization_ms")),
        "end_to_end_export_seconds": _percentiles(totals),
        "accepted_jobs_over_5_minute_queue_wait": sum(value > 300 for value in queue_waits),
        "output_gib": round(sum(float(row.get("output_size_bytes") or 0)
                                 for row in completed) / (1024 ** 3), 4),
        "cache_hit_rate": round(sum(bool(row.get("cache_hit")) for row in completed)
                                / len(completed), 4) if completed else None,
        "render_prediction": {
            "samples": len(prediction_pairs),
            "actual_to_estimate_ratio": _percentiles(
                [actual / estimate for actual, estimate in prediction_pairs]
            ),
            "absolute_percentage_error": _percentiles(
                [abs(actual - estimate) / actual for actual, estimate in prediction_pairs
                 if actual > 0]
            ),
        },
        "render_work_calibration": _work_ratio_calibration(completed),
        "billing_cost_usd": billing_cost_usd,
        "cost_per_successful_export_usd": None,
        "cost_per_rendered_video_minute_usd": None,
        "by_workload": {
            "renderer": _group(completed, _renderer),
            "quality": _group(completed, lambda row: row.get("quality") or "unknown"),
            "fps": _group(completed, lambda row: row.get("fps") or "unknown"),
            "duration_bucket": _group(completed, _duration_bucket),
            "source_resolution": _group(completed, lambda row: _resolution(row, "source")),
            "output_resolution": _group(completed, lambda row: _resolution(row, "output")),
            "aspect_ratio": _group(
                completed, lambda row: row.get("export_aspect_ratio") or "source"
            ),
            "profile": _group(
                completed,
                lambda row: "|".join((
                    _renderer(row),
                    str(row.get("quality") or "unknown"),
                    f"{row.get('fps') or 'unknown'}fps",
                    _duration_bucket(row),
                    _resolution(row, "output"),
                )),
            ),
        },
    }
    if billing_cost_usd is not None:
        if billing_cost_usd < 0:
            raise ValueError("Billing cost must be non-negative")
        if completed:
            result["cost_per_successful_export_usd"] = round(billing_cost_usd / len(completed), 6)
        if minutes:
            result["cost_per_rendered_video_minute_usd"] = round(billing_cost_usd / minutes, 6)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=pathlib.Path)
    parser.add_argument("--billing-cost-usd", type=float)
    args = parser.parse_args()
    print(json.dumps(summarize(load_observations(args.input), args.billing_cost_usd), indent=2))


if __name__ == "__main__":
    main()
