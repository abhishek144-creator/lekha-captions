"""Summarize actual export observations from Cloud Logging JSON or JSONL.

Example:
  gcloud logging read 'textPayload:"export_observation"' --format=json --limit=10000 > exports.json
  python scripts/analyze_export_observations.py exports.json

Supply --billing-cost-usd only for a cost total covering the same observation
window and infrastructure. The script never treats a configured cost estimate as
an actual bill.
"""

import argparse
import csv
import datetime as dt
import hashlib
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
        record = dict(payload)
        record.setdefault("timestamp", entry.get("timestamp") or entry.get("receiveTimestamp"))
        return record
    raw = entry.get("textPayload") or ""
    if isinstance(raw, str) and "export_observation" in raw:
        try:
            decoded = json.loads(raw[raw.index("{"):])
            if decoded.get("event") == "export_observation":
                decoded.setdefault("timestamp", entry.get("timestamp") or entry.get("receiveTimestamp"))
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


def _nested(row, *path):
    value = row
    for key in path:
        if not isinstance(value, dict):
            return None
        value = value.get(key)
    return value


def load_billing_rows(path):
    """Load detailed Cloud Billing export rows from CSV, JSON, or JSONL."""
    path = pathlib.Path(path)
    source = path.read_text(encoding="utf-8-sig")
    if path.suffix.lower() == ".csv":
        return list(csv.DictReader(source.splitlines()))
    try:
        rows = json.loads(source)
        return rows if isinstance(rows, list) else [rows]
    except json.JSONDecodeError:
        return [json.loads(line) for line in source.splitlines() if line.strip()]


def _parse_timestamp(value):
    if not value:
        return None
    normalized = str(value).strip().replace("Z", "+00:00")
    parsed = dt.datetime.fromisoformat(normalized)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=dt.timezone.utc)
    return parsed.astimezone(dt.timezone.utc)


def _billing_value(row, dotted_name, *nested_path):
    value = row.get(dotted_name)
    if value not in (None, ""):
        return value
    return _nested(row, *nested_path)


def summarize_billing(rows, window_start, window_end):
    """Return actual net USD cost from detailed Cloud Billing export rows.

    Rows are included when their usage interval overlaps the requested interval.
    Credits are added to cost because Google exports them as negative amounts.
    """
    start = _parse_timestamp(window_start)
    end = _parse_timestamp(window_end)
    if not start or not end or end <= start:
        raise ValueError("A valid billing window with end after start is required")

    included = []
    service_costs = {}
    for row in rows:
        row_start = _parse_timestamp(_billing_value(row, "usage_start_time", "usage_start_time"))
        row_end = _parse_timestamp(_billing_value(row, "usage_end_time", "usage_end_time"))
        if row_start and row_start >= end:
            continue
        if row_end and row_end <= start:
            continue
        currency = str(row.get("currency") or "USD").upper()
        if currency != "USD":
            raise ValueError(f"Billing export currency must be USD, got {currency}")
        cost = float(row.get("cost") or 0)
        credits = row.get("credits") or []
        if isinstance(credits, str):
            try:
                credits = json.loads(credits)
            except json.JSONDecodeError:
                credits = []
        credit_total = sum(float(item.get("amount") or 0) for item in credits if isinstance(item, dict))
        net_cost = cost + credit_total
        service = str(_billing_value(row, "service.description", "service", "description") or "Unknown")
        service_costs[service] = service_costs.get(service, 0.0) + net_cost
        included.append(row)

    canonical = json.dumps(included, sort_keys=True, separators=(",", ":"), default=str)
    return {
        "source": "gcp_detailed_billing_export",
        "currency": "USD",
        "window_start": start.isoformat().replace("+00:00", "Z"),
        "window_end": end.isoformat().replace("+00:00", "Z"),
        "row_count": len(included),
        "net_cost_usd": round(sum(service_costs.values()), 6),
        "service_cost_usd": {
            key: round(value, 6) for key, value in sorted(service_costs.items())
        },
        "source_sha256": hashlib.sha256(canonical.encode("utf-8")).hexdigest(),
    }


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


def load_provider_invoice(path):
    """Load one normalized provider invoice and bind it to its source bytes."""
    invoice_path = pathlib.Path(path)
    source = invoice_path.read_bytes()
    value = json.loads(source.decode("utf-8-sig"))
    if not isinstance(value, dict):
        raise ValueError(f"Provider invoice must be a JSON object: {invoice_path}")
    required = {"provider", "invoice_id", "currency", "original_net_cost", "net_cost_usd"}
    missing = sorted(required - set(value))
    if missing:
        raise ValueError(f"Provider invoice is missing {', '.join(missing)}: {invoice_path}")
    provider = str(value["provider"]).lower()
    if provider not in {"openai", "sarvam", "other"}:
        raise ValueError(f"Unsupported provider {provider}: {invoice_path}")
    return {
        "provider": provider,
        "invoice_id": str(value["invoice_id"]),
        "currency": str(value["currency"]).upper(),
        "original_net_cost": float(value["original_net_cost"]),
        "net_cost_usd": float(value["net_cost_usd"]),
        "source_sha256": hashlib.sha256(source).hexdigest(),
    }


def summarize(
    observations,
    billing_cost_usd=None,
    billing=None,
    provider_billing=None,
    usd_to_inr_rate=None,
    business_evidence=None,
):
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
    provider_billing = provider_billing or []
    provider_cost_usd = sum(float(item["net_cost_usd"]) for item in provider_billing)
    result = {
        "completed": len(completed),
        "failed": len(failures),
        "observation_evidence": {
            "terminal_job_count": len(terminal),
            "successful_jobs_sha256": hashlib.sha256(
                "\n".join(sorted(str(row["job_id"]) for row in completed)).encode("utf-8")
            ).hexdigest(),
        },
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
        "billing": billing,
        "provider_billing": provider_billing,
        "usd_to_inr_rate": usd_to_inr_rate,
        "business_evidence": business_evidence,
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
    if billing is not None:
        billing_cost_usd = float(billing["net_cost_usd"]) + provider_cost_usd
        result["billing_cost_usd"] = billing_cost_usd
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
    parser.add_argument("--billing-export", type=pathlib.Path)
    parser.add_argument(
        "--provider-invoice",
        type=pathlib.Path,
        action="append",
        default=[],
        help="Normalized OpenAI/Sarvam invoice JSON; repeat for multiple invoices",
    )
    parser.add_argument("--usd-to-inr-rate", type=float)
    parser.add_argument("--marketing-spend-inr", type=float)
    parser.add_argument("--gross-revenue-inr", type=float)
    parser.add_argument("--activated-accounts", type=int)
    parser.add_argument(
        "--business-evidence",
        type=pathlib.Path,
        help="Source finance export used for marketing spend, revenue, and activations",
    )
    parser.add_argument("--window-start", help="Inclusive ISO-8601 UTC billing window start")
    parser.add_argument("--window-end", help="Exclusive ISO-8601 UTC billing window end")
    parser.add_argument("--output", type=pathlib.Path)
    args = parser.parse_args()
    if args.billing_export and (not args.window_start or not args.window_end):
        parser.error("--billing-export requires --window-start and --window-end")
    billing = (
        summarize_billing(load_billing_rows(args.billing_export), args.window_start, args.window_end)
        if args.billing_export else None
    )
    provider_billing = [load_provider_invoice(path) for path in args.provider_invoice]
    business_values = (args.marketing_spend_inr, args.gross_revenue_inr, args.activated_accounts)
    if any(value is not None for value in business_values) and not args.business_evidence:
        parser.error("business metrics require --business-evidence")
    business_evidence = None
    if args.business_evidence:
        if any(value is None for value in business_values):
            parser.error("--business-evidence requires marketing spend, gross revenue, and activated accounts")
        business_evidence = {
            "marketing_spend_inr": args.marketing_spend_inr,
            "gross_revenue_inr": args.gross_revenue_inr,
            "activated_accounts": args.activated_accounts,
            "source_sha256": hashlib.sha256(args.business_evidence.read_bytes()).hexdigest(),
        }
    report = summarize(
        load_observations(args.input),
        args.billing_cost_usd,
        billing,
        provider_billing,
        args.usd_to_inr_rate,
        business_evidence,
    )
    rendered = json.dumps(report, indent=2)
    if args.output:
        args.output.write_text(rendered + "\n", encoding="utf-8")
    print(rendered)


if __name__ == "__main__":
    main()
