# GCP staging verification — 2026-09-08

## Decision

The Google Cloud staging deployment is healthy for controlled testing. It is
not approved for a mass paid launch or production DNS cutover yet.

## Verified deployment

- Project: `project-0cc7c839-b9c7-4734-ad0`
- Frontend: Cloud Run revision `lekha-frontend-staging-00004-hf5`
- Frontend maximum instances: `20`; concurrency: `80`
- API: Compute Engine VM `lekha-api-staging`
- Worker: Compute Engine VM `lekha-worker-staging`
- Redis: Memorystore instance `lekha-redis-staging`
- Application release: `5b37a0f708b27d6fcdd575026c4a108147b3f72b`
- API/worker image digest: `sha256:698915dac88dd5132119aafa586fb96c9e96b7d0668b21a74eea0bfb45667150`
- Frontend image digest: `sha256:deb0b29f2ca7ed2ea72cf5f1af8ee9cda89912b3432ba27d93a4f529352ccfa8`

The frontend, API, and worker all reported the same application release. API
readiness verified FFmpeg, FFprobe, Node.js, Redis, Firestore, Firebase Storage,
an active matching-release export worker, and sufficient scratch disk.

## Verification evidence

- Synthetic DNS, liveness, readiness, version, and service-status probes passed.
- API and worker run Node.js `v22.23.2`.
- API runs two Uvicorn worker processes with bounded concurrency and backlog.
- RQ reported one matching-release idle worker and no queued or failed jobs.
- Cloud Run served 300/300 lightweight requests at concurrency 30; measured p95
  was 91 ms.
- API health served 200/200 lightweight requests at concurrency 25; measured
  p95 was 181 ms.
- Allowed-origin CORS preflight returned 200; an untrusted origin returned 400
  without an allow-origin header.
- A payment request without Firebase App Check was rejected with 403.
- An invalid Razorpay webhook signature was rejected with 400.
- Backend test suites passed 136 tests.
- Frontend contracts, lint, typecheck, production build, and performance budgets
  passed.
- The dependency security gate found no unreviewed high or critical advisory.
- Frontend and API 60-second uptime checks are enabled, with two-minute outage
  alert policies.

These HTTP load checks exercise lightweight endpoints only. They do not prove
video-upload, transcription, rendering, or payment-provider capacity.

## Launch blockers

1. Razorpay is configured in test mode, so real subscriptions cannot be
   accepted.
2. There is one API VM and one worker VM in one zone. This does not meet the
   approved two-API-replica launch profile and leaves zonal/single-instance
   failure modes.
3. Memorystore is Basic tier with no replica, automatic failover, persistence,
   or transport encryption.
4. Media uploads are proxied through the API VM and the single render worker
   processes one render at a time. Mass media capacity has not been tested.
5. The uptime alert policies have no confirmed notification channel, and Sentry
   is not configured.
6. A fresh authenticated browser upload, transcription, export, and Razorpay
   test transaction must pass as one end-to-end acceptance run.
7. The production domain remains on Netlify/Railway and must not be cut over
   until the preceding gates pass and rollback is rehearsed.

## Required production architecture

- Regional managed instance group with at least two API instances, health-based
  autohealing, autoscaling, and a managed HTTPS load balancer.
- Cloud Armor policy and managed certificate for the production API hostname.
- Standard-tier Redis with cross-zone failover and an explicit persistence and
  restore policy.
- Direct resumable uploads to private object storage with quarantine/scanning,
  instead of routing large media bodies through the API VM.
- Queue-depth and oldest-job-age worker autoscaling, followed by a realistic
  upload/transcription/render capacity test.
- Confirmed on-call notification channel, application error reporting, live
  Razorpay credentials/webhook, and a staged DNS cutover with rollback.
