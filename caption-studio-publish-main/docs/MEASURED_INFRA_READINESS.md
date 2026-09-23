# Measured infrastructure readiness

Code review scores are provisional. A 10/10 claim requires deployed behavior,
representative workload data, and actual billing data. The repository cannot
establish those outcomes by itself.

## What this change adds

- Direct upload initiation reserves per-account capacity atomically in Redis:
  two active uploads, 1 GiB of outstanding declared bytes, and twelve starts per
  rolling hour by default. A shared-network ceiling of 200 starts per hour
  allows a 100-user burst from one network. A Redis outage fails closed in production. These
  defaults are operational controls, not throughput benchmarks.
- Browser failures attempt to cancel the GCS resumable session and mark the
  server intent cancelled. GCS bucket CORS must include `DELETE` for the browser
  cancellation attempt. The six-hour janitor remains a backstop.
- Completion keeps a short-lived receipt so a lost response can be retried
  against the same verified object. Failed ownership persistence leaves the
  private object for a retry and scheduled cleanup.
- Export logs now record queue, preparation, render, finalization, total time,
  output bytes, media duration, template path, and cache hits without user IDs.
- The staging journey tool uses direct upload by default and can synchronize
  export submission across up to 100 disposable identities. The analyzer
  calculates P50/P95/P99 from completed jobs and can compute cost per successful
  export and rendered minute when a matching actual billing total is supplied.
- The render image now starts a warm Chromium process. Each template job gets
  a fresh isolated browser context, and a missing or crashed warm process falls
  back to a private browser. The image includes packaged Inter and Noto core
  fonts; the processor uses an exact installed family match before downloading
  that font. Other catalog fonts can still require a network fetch.
- Processed source duration is persisted and used to attach a bounded render-work
  estimate to each queued job. The queue publisher reports the sum as
  `pending_render_work_seconds`; completed observations include estimate and
  actual render time so the model can be calibrated. This is a shadow metric:
  the production autoscaler still uses queue depth and CPU, and count-based
  admission remains in force until prediction error is measured on real jobs.

## Acceptance evidence for a top rating

| Area | Required evidence |
|---|---|
| Export speed | P50/P95/P99 end-to-end and per-stage timings on representative static, animated, English, and Indic videos; visual parity on any renderer or encoder change. |
| Cost efficiency | Detailed Cloud Billing export for the same measurement window; total CPU, disk, Redis, API, storage, egress, and provider cost divided by successful rendered minutes; idle and burst costs. |
| Upload architecture | Real browser uploads near 500 MiB at 10/25/50/100 concurrent users; interruption at 10/50/90% of bytes, completion replay, cancel, ownership isolation, and cleanup verified. Page-refresh recovery remains open. |
| 100-user burst | 100 authenticated upload → transcription → export → download journeys, with simultaneous export submission, at least 99.5% success, P95 queue wait under 120 seconds, and no accepted job waiting more than 300 seconds. Repeat across typical and worst-case media. |
| Infrastructure maturity | Redis failover, worker loss during rendering, retry and credit idempotency, release rollback, alert delivery, and staged canary outcomes. |

Run `python scripts/media_load_smoke.py --help` for the journey runner. Use
`--synchronize-exports --jobs 100 --workers 100` only with disposable staging
identities and rights-cleared media. Its credentials JSON must remain outside
source control. Run `python scripts/analyze_export_observations.py --help` for
log analysis. A cost ratio is omitted until `--billing-cost-usd` is supplied
from a bill covering the exact observation window.

The production Cloud Billing export dataset was not available during this
review. The existing 100-job synthetic FFmpeg test is not a substitute for the
customer journey test. Keep current worker sizing until these measurements
support a change.

Do not treat the old 4-vCPU worker, absence of Spot/GPU pools, or API/frontend
hosting choices as defects on their own. An 8-vCPU worker doubles per-instance
CPU demand and the last audited 100-vCPU quota would not support 20 of them.
The last audited GPU quota was zero. Spot capacity can disappear during a burst;
the on-demand floor and retry behavior need a controlled preemption test before
it can carry an availability target. Compare each option by successful rendered
minute, P95 queue wait, and failure rate before rollout. Browser reuse and the
packaged-font preference likewise need a staged visual-parity and latency
comparison in the Linux render image before the speed score changes.

References: [Cloud Storage resumable sessions and cancellation](https://docs.cloud.google.com/storage/docs/performing-resumable-uploads),
[Cloud Monitoring autoscaling metrics](https://docs.cloud.google.com/compute/docs/autoscaler/scaling-cloud-monitoring-metrics),
[Spot VM capacity and preemption](https://docs.cloud.google.com/compute/docs/instances/spot),
[Cloud Billing export to BigQuery](https://docs.cloud.google.com/billing/docs/how-to/export-data-bigquery).
