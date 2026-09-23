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
    result = {
        "completed": len(completed),
        "failed": len(failures),
        "terminal_success_rate": round(len(completed) / measured, 4) if measured else None,
        "rendered_video_minutes": round(minutes, 3),
        "queue_wait_seconds": _percentiles(queue_waits),
        "render_seconds": _percentiles(render_times),
        "end_to_end_export_seconds": _percentiles(totals),
        "accepted_jobs_over_5_minute_queue_wait": sum(value > 300 for value in queue_waits),
        "output_gib": round(sum(float(row.get("output_size_bytes") or 0)
                                 for row in completed) / (1024 ** 3), 4),
        "cache_hit_rate": round(sum(bool(row.get("cache_hit")) for row in completed)
                                / len(completed), 4) if completed else None,
        "billing_cost_usd": billing_cost_usd,
        "cost_per_successful_export_usd": None,
        "cost_per_rendered_video_minute_usd": None,
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
