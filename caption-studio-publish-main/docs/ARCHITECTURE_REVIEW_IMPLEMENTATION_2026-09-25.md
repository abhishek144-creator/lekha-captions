# Architecture review implementation — 2026-09-25

This records the repository changes made after comparing the public architecture
review with the current, newer codebase. Recommendations were not applied when
the repository already had a stronger implementation or when an immediate
change would weaken production safety.

## Implemented

- Production browser uploads are direct resumable GCS uploads. The multipart
  API path remains available only on local development hosts.
- New transcription intents are dispatched to RQ immediately; the Firestore
  outbox and scheduler hook are recovery mechanisms.
- API readiness depends on API dependencies, not a warm worker count. Empty
  queues with zero workers are reported as `idle_scaled_to_zero`.
- Render and transcription workers have separate images, queue names, instance
  templates, MIGs, and queue-driven autoscalers. Baseline render,
  transcription, and bounded Spot overflow capacity all scale from zero.
- The staging queue name is no longer baked into the transcription image.
- Uploads have explicit `pending_scan`, `clean`, and `rejected` states. Direct
  upload completion commits a durable scan outbox entry and dispatches it to a
  dedicated queue immediately. Export, transcription, and language detection
  refuse media until that scan has persisted a clean verdict.
- GCS generation/checksum identity is captured during direct-upload completion
  and reused by exports instead of rereading large source files to identify
  them. Proxy uploads calculate and persist SHA-256 once.
- Deterministic ASS and animated/template renders use a tenant-scoped GCS-backed
  exact-request cache, so a replacement worker can reuse validated output.
  Cache objects are short-lived and covered by bucket lifecycle cleanup.
- Queue observations now publish independent render and transcription metrics.
- Authenticated maintenance hooks allow an external scheduler to run outbox
  recovery (including media scans), cleanup, and queue-metric publication. API
  background loops are disabled with `RUN_API_BACKGROUND_TASKS=0` when those
  hooks are scheduled.
- Firebase Hosting configuration now serves the built SPA with immutable hashed
  assets and non-cacheable entry/release metadata.
- Terraform enables a parallel Cloud Run API with a private Redis connector,
  pinned secret mount, serverless NEG, and OIDC-authenticated Scheduler jobs.
- Cloud Run and baseline render capacity both default to minimum zero.
- The render image builds and verifies a self-contained template font bundle;
  known template renders do not require a first-job font download.

## Already stronger; retained

- Redis/RQ, Firestore, direct GCS upload, private signed downloads, storage
  lifecycle cleanup, ASS-versus-DOM routing, CPU/NVENC fallback, render timing
  observations, retries, idempotency, and scale-in protection were retained.
- GPU workers remain an evidence-driven later optimization.
- FastAPI remains a modular monolith, but malware scanning, durable media-scan
  delivery, and scheduler authorization now live in focused modules. Further
  extraction remains incremental to avoid a high-risk file-only rewrite.

## Deliberately gated

The repository implementation is complete, but the API has not been switched
from its current GCE deployment to Cloud Run. A safe live rollout still requires:

1. applying and exercising the parallel candidate in staging;
2. proving malware scanning remains reachable for language detection and
   transcription without a VM-local dependency;
3. attaching the emitted serverless NEG through a canary/rollback path; and
4. comparing a saved Terraform plan against existing production resources.

Moving the API before those gates would trade idle-cost savings for missed
recovery work or unavailable scanning, so the present GCE API remains the safer
structure until the migration is exercised in staging.
