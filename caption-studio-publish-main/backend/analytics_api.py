"""Admin analytics read API assembled from server-owned metric dependencies."""

from datetime import datetime

from fastapi import APIRouter, HTTPException, Request

try:
    from .cost_reconciliation import read_cost_reconciliation
except ImportError:
    from cost_reconciliation import read_cost_reconciliation


def _percentile(values, fraction):
    if not values:
        return None
    ordered = sorted(float(value) for value in values)
    index = min(len(ordered) - 1, max(0, int(round(fraction * (len(ordered) - 1)))))
    return ordered[index]


def create_analytics_router(
    *,
    is_admin,
    utcnow,
    get_database,
    read_counters,
    read_latency_samples,
    read_metric_samples,
    alert_failure_ratio,
    percentile_95,
):
    router = APIRouter()

    @router.get("/api/analytics/summary")
    def analytics_summary(request: Request):
        if not is_admin(request=request):
            raise HTTPException(status_code=403, detail="Admin access required")
        day_key = (request.query_params.get("date") or utcnow().date().isoformat()).strip()
        try:
            datetime.strptime(day_key, "%Y-%m-%d")
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="date must use YYYY-MM-DD") from exc

        counters = read_counters(day_key)
        export_success = counters.get("export_success", 0)
        export_failed = counters.get("export_failed_http", 0) + counters.get("export_failed_exception", 0)
        process_success = counters.get("process_success", 0)
        process_failed = counters.get("process_failed", 0)
        alert_failure_ratio("export", export_success, export_failed)
        alert_failure_ratio("process", process_success, process_failed)

        terminal_success = export_success + process_success
        terminal_failed = export_failed + process_failed
        process_latency = read_latency_samples(day_key, "/api/process")
        export_latency = read_latency_samples(day_key, "/api/export")
        processing_latency = process_latency + export_latency
        average_processing_ms = (
            round(sum(processing_latency) / len(processing_latency))
            if processing_latency else 0
        )
        cost_samples = read_metric_samples(day_key, "job_cost_usd")
        estimated_cost = round(sum(cost_samples) / len(cost_samples), 6) if cost_samples else 0.0
        # Estimated AI spend (including failed attempts) spread over videos that got captions.
        ai_cost_per_captioned_video = (
            round(sum(cost_samples) / process_success, 6) if process_success else None
        )
        first_caption_samples = read_metric_samples(day_key, "time_to_first_caption_ms")
        first_caption_p50 = _percentile(first_caption_samples, 0.5)
        first_caption_p95 = _percentile(first_caption_samples, 0.95)
        reconciliation = read_cost_reconciliation(get_database(), day_key)
        funnel = {
            "signups": counters.get("account_signup", 0),
            "uploads": max(counters.get("upload_success", 0), counters.get("funnel.upload.success", 0)),
            "transcriptions": max(process_success, counters.get("funnel.process.success", 0)),
            "activations": counters.get("account_activation", 0),
            "exports_started": counters.get("funnel.export.started", 0),
            "exports_completed": max(export_success, counters.get("funnel.export.success", 0)),
            "payments": counters.get("payment_success", 0),
            "videos_picked": counters.get("funnel.upload.file_picked", 0),
            "uploads_abandoned": counters.get("funnel.upload.abandoned", 0),
            "uploads_refused": (
                counters.get("upload_rejected_duration", 0)
                + counters.get("upload_rejected_free_transcriptions_used", 0)
                + counters.get("upload_rejected_daily_quota", 0)
                + counters.get("funnel.upload.refused_locally", 0)
            ),
            "captions_ready": counters.get("funnel.captions.ready", 0),
        }
        funnel["picked_to_upload_pct"] = round(
            funnel["uploads"] / max(funnel["videos_picked"], 1) * 100, 2
        )
        funnel["picked_abandoned_pct"] = round(
            funnel["uploads_abandoned"] / max(funnel["videos_picked"], 1) * 100, 2
        )
        funnel["upload_to_transcription_pct"] = round(
            funnel["transcriptions"] / max(funnel["uploads"], 1) * 100, 2
        )
        funnel["signup_to_activation_pct"] = round(
            funnel["activations"] / max(funnel["signups"], 1) * 100, 2
        )
        funnel["transcription_to_export_pct"] = round(
            funnel["exports_completed"] / max(funnel["transcriptions"], 1) * 100, 2
        )
        funnel["export_to_payment_pct"] = round(
            funnel["payments"] / max(funnel["exports_completed"], 1) * 100, 2
        )

        return {
            "window": {"kind": "utc_day", "date": day_key, "timezone": "UTC"},
            "counters": counters,
            "metrics": {
                "signups": counters.get("account_signup", 0),
                "uploads": counters.get("upload_success", 0),
                "completed_transcriptions": process_success,
                "completed_exports": export_success,
                "failure_percentage": round(
                    terminal_failed / max(terminal_success + terminal_failed, 1) * 100, 2
                ),
                "average_processing_time_ms": average_processing_ms,
                "processing_p95_ms": percentile_95(processing_latency),
                "cost_per_successful_export_usd": (
                    reconciliation.get("cost_per_successful_export_usd") if reconciliation else None
                ),
                "cost_per_rendered_video_minute_usd": (
                    reconciliation.get("cost_per_rendered_video_minute_usd") if reconciliation else None
                ),
                "actual_net_cost_usd": (
                    reconciliation.get("actual_net_cost_usd") if reconciliation else None
                ),
                "actual_net_cost_inr": (
                    reconciliation.get("actual_net_cost_inr") if reconciliation else None
                ),
                "provider_net_cost_usd": (
                    reconciliation.get("provider_net_cost_usd") if reconciliation else None
                ),
                "cost_per_successful_export_inr": (
                    reconciliation.get("cost_per_successful_export_inr") if reconciliation else None
                ),
                "customer_acquisition_cost_inr": (
                    reconciliation.get("customer_acquisition_cost_inr") if reconciliation else None
                ),
                "gross_revenue_inr": (
                    reconciliation.get("gross_revenue_inr") if reconciliation else None
                ),
                "cost_source": reconciliation.get("cost_source") if reconciliation else "unreconciled",
                "estimated_cost_per_successful_export_usd": estimated_cost,
                "estimated_ai_cost_per_captioned_video_usd": ai_cost_per_captioned_video,
                "time_to_first_caption_p50_s": (
                    round(first_caption_p50 / 1000, 1) if first_caption_p50 is not None else None
                ),
                "time_to_first_caption_p95_s": (
                    round(first_caption_p95 / 1000, 1) if first_caption_p95 is not None else None
                ),
                "time_to_first_caption_samples": len(first_caption_samples),
                "successful_payments": counters.get("payment_success", 0),
                "failed_payments": counters.get("payment_failed", 0),
                "support_requests": counters.get("support_request_created", 0),
            },
            "health": {
                "export_failure_rate": export_failed / max(export_success + export_failed, 1),
                "process_failure_rate": process_failed / max(process_success + process_failed, 1),
            },
            "funnel": funnel,
            "timestamp": utcnow().isoformat() + "Z",
        }

    @router.get("/api/v1/analytics/summary")
    def analytics_summary_v1(request: Request):
        return analytics_summary(request)

    return router
