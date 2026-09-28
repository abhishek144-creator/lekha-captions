# Architecture gap verification — 28 September 2026

This is a source-and-read-only-inventory check of the ten requested changes.
Repository implementation and live deployment are separate states. No GCP
resource, payment setting, DNS route, or customer media was changed.

| # | Repository state | Live or evidence state |
|---|---|---|
| 1 | Production frontend uses direct resumable GCS uploads. Proxy fallback is restricted to local Vite development; `/api/upload` now rejects every production request even if the bucket setting is missing. | A fresh browser upload on the public origin has not been rerun here. |
| 2 | Terraform defines a Cloud Run API with `min_instance_count = 0`, `RUN_API_BACKGROUND_TASKS=0`, a private Redis path, and scheduled maintenance. The legacy API MIG retains its two serving VMs during the canary; its target is reduced only after cutover. | Read-only GCP inventory shows no Cloud Run API; the API MIG still has two VMs. Cloud Scheduler API is disabled. Do not cut over until scheduled recovery jobs exist and pass. |
| 3 | Render MIG autoscaling has minimum zero and bounded maximum three, driven by pending work and predicted wait. | Live worker MIG still has three instances. Source configuration has not been applied to that fleet. |
| 4 | Readiness checks API dependencies and reports `idle_scaled_to_zero` for an empty queue without workers. | Deployed API still uses the prior VM image; verify the exact release after canary. |
| 5 | Transcription and media scanning have their own image, queue names, instance template, regional MIG, and zero-minimum autoscaler. | Live inventory shows no independent transcription MIG; the existing render VMs remain in service. |
| 6 | Startup selects `WORKER_QUEUES` from role metadata, with a production transcription default; no staging queue is hard-coded in the transcription role. | New instance templates have not replaced the live VM templates. |
| 7 | Upload security transitions `pending_scan` to `clean` or `rejected`; exports, transcription, and language detection require clean media. | Deployed-release scan behavior needs an isolated media journey. |
| 8 | Media bucket lifecycle deletes old objects and incomplete uploads. | Terraform is the intended configuration; this check did not reread live bucket lifecycle. |
| 9 | `scripts/benchmark_renderers.py` runs matched production ASS and DOM paths. | A local Windows run on this source used one 6-second, 720p/30 FPS fixture, one warmup and three measured runs per renderer: ASS median 1.0904 s, DOM median 5.1222 s, ratio 4.6975; all six measured renders succeeded. This is not a worker-image or customer-workload benchmark. |
| 10 | `scripts/analyze_export_observations.py`, `backend/cost_reconciliation.py`, and the admin analytics endpoint compute actual cost per successful export only when same-window GCP billing and provider invoices are supplied. Estimates remain separately labelled. | BigQuery listed no datasets in the project, so a detailed billing export could not be reconciled. No actual unit-cost claim is made. |

The read-only inventory returned two API VMs and three render VMs, all in
`asia-south1-b`; only `lekha-frontend-staging` appeared in the regional Cloud Run
service list. `gcloud billing projects describe` reported billing enabled, while
the Redis instance list returned a billing-disabled error. Resolve that API
discrepancy before planning a Redis change. No Redis resource was modified.

Before a live cutover, supply the exact immutable image digests, numeric runtime
secret version, Terraform state/imports, and a saved plan against the current
resources. No populated Terraform variable file or state was present in this
checkout, so no safe live plan was produced. The plan must account for the two
API and three worker VMs and must not replace Redis or the media bucket. It
must also expose worker template and autoscaler changes before they touch live
render jobs; drain those jobs or use an isolated candidate pool. Provision the
Cloud Run API and Scheduler
jobs in parallel; verify authenticated direct upload, clean scan, transcription,
render, signed download, maintenance dispatch, queue metrics, zero-worker
readiness, and a rollback to the retained VMs. Only then switch a canary through
the serverless NEG, drain accepted jobs, and reduce old MIG targets. Compare
actual billing and representative queue latency before accepting a new idle
capacity or cost claim.
