# Roadmap gap audit — 28 September 2026

Baseline: GitHub `main` at merge commit `7980118` (PR #13). This audit separates
repository behavior from measured or deployed behavior. The earlier checklist
was based on `7c2ed7d`, before the merge. No production rollout or paid load
test was performed for this audit.

| Requested area | Repository status on merged `main` | What remains to prove or deliver |
|---|---|---|
| 100 unique-media users | `scripts/media_load_smoke.py --require-unique-media` checks SHA-256 uniqueness before launch and records source hashes per journey. | No recorded 100-user run with 100 distinct rights-cleared videos and disposable staging identities. |
| 500 MiB resumable upload | `src/lib/resilientUpload.js` enforces 500 MiB and uses 8 MiB GCS chunks with acknowledged-offset recovery. `scripts/check-direct-upload-resume.mjs` covers the limit sequence. | Real near-limit browser and network-interruption trial. |
| Refresh/restart upload recovery | The browser keeps a non-secret local receipt and reselects the same file; `/api/uploads/resume` returns its authenticated GCS session. The contract script covers a reload. | Real cross-browser refresh/restart trial. Do not persist the private GCS session URL in local storage. |
| Warm Chromium | The render worker keeps a warm browser with isolated job contexts. | Latency and visual-parity measurement in the deployed Linux image. |
| Packaged rendering fonts | The render image bundles Inter/Noto core fonts and the processor prefers installed families. | Check installed families and Indic output in the built worker image. |
| Render-work estimation | Jobs and queue telemetry carry bounded pending render-work seconds. | Calibrate estimates with representative completed renders. |
| Work-based autoscaling | Terraform uses `pending_render_work_seconds` and predicted wait for render autoscaling. | Import existing GCP state, review a saved plan, then measure a 0→N→0 staging cycle. The old production MIG remains active. |
| Actual cost per successful export | Billing/provider reconciliation and admin reporting are implemented in `backend/cost_reconciliation.py` and `scripts/analyze_export_observations.py`. | Detailed Cloud Billing export, matching provider invoices, and a same-window completed-export count. No actual figure exists without them. |
| Cost dashboard | `src/pages/AdminOps.jsx` shows actual USD/INR unit cost when reconciled, with forecast explicitly separate. | Populate invoice-backed evidence and verify it in the deployed admin view. |
| Provider health/failover | `backend/provider_health.py` has circuit-breaker state; transcription can fail over from Sarvam to OpenAI for supported language paths. | Exercise provider failure and recovery in staging; both provider credentials must be configured. |
| Spot burst workers | Terraform contains a bounded optional Spot render MIG. | Enable only after a reviewed plan and preemption/retry test. |
| GPU/L4 workers | Terraform contains an optional GPU pool, disabled by default. | GPU quota, driver-ready image, and matched cost, speed, and output-parity benchmarks before enabling. |
| Project management | Dashboard supports rename, duplicate, search, sort, selection, and delete of cloud projects. | Product acceptance in the deployed UI. |
| Export-finished notification | Completed jobs create durable account-scoped in-app notifications; the export UI can request a browser notification. | Deployed background-export journey; email/push delivery is a separate channel and is not implemented. |
| Business funnel | Admin Ops shows signup→activation→export→payment metrics and acquisition cost when supplied. | Feed real acquisition spend and validate period/cohort interpretation before treating CAC as a measured KPI. |
| Public API/SDK | Revocable scoped keys, a versioned read API, a JavaScript SDK, and a shared Redis key limiter are in `backend/public_api.py` and `sdk/javascript`. | This is a read-only beta. Public write/export scopes, enterprise auth, hosted docs, and deployed cross-instance acceptance remain launch work. |
| Team/workspace accounts | `backend/workspace_api.py` provides creation, invitation, roles, membership, shared projects, ownership transfer, and deletion. | End-to-end multi-account staging acceptance and deployment verification. |
| Batch processing | `POST /api/batch/exports` accepts 1–10 normal exports and exposes per-item status. | This is batch export, not batch upload/transcription. Validate partial admission, replay, and credits in staging; scope broader batch ingestion separately. |

## Operational evidence needed

The read-only infrastructure inventory recorded in
`ARCHITECTURE_GAP_VERIFICATION_2026-09-28.md` still showed the old API and render
VM pools, no Cloud Run API or separate transcription MIG, and no Cloud Billing
BigQuery dataset. A Terraform state/import and saved plan are absent from this
checkout. Source-defined Spot/GPU pools and autoscaling must not be reported as
live capacity.

For the 100-user journey, provide an isolated staging API origin, 100 disposable
credentials, and 100 bytewise-distinct rights-cleared videos. Keep credentials
outside Git. Run the load tool with `--jobs 100 --workers 100
--synchronize-exports --require-unique-media --results-json` and retain the
per-journey result, service telemetry, and exact release SHA. For actual unit
cost, export detailed billing for that same window, add provider invoices, and
reconcile against successful exports. Until those inputs exist, the dashboard's
forecast is an estimate, not a billed cost.
