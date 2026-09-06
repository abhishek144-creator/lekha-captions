# Architecture and staged changes — 6 September 2026

## Verified current system

The editor is React/Vite; marketing is a separate Next static export. Firebase Auth and App Check protect backend calls; Firestore holds accounts, entitlements, payment receipts, export usage and recent export/job metadata. Firebase Storage or the configured S3-compatible adapter holds private media. Client storage rules deny direct access; trusted backend credentials enforce server-side access, so cloud IAM still needs independent verification.

Current upload path: authenticated browser → FastAPI multipart/spooled scratch file → magic-byte/FFprobe/duration/dimension validation and scanner → storage plus owner metadata → signed media access. Uploaded objects are identified by server-generated IDs. Declared request length and actual ASGI chunks are bounded before multipart buffering; authentication and an account lease precede parsing. The media payload cap remains 500 MiB with a 1 MiB multipart allowance. Maximum duration is 180 seconds; new video bounds are 4,096 pixels per axis and 3,840 × 2,160 total pixels. Portrait 2,160 × 3,840 is allowed. These are product limits, not a general media decoder sandbox.

Transcription is an API coroutine/executor operation guarded by a shared per-user Redis lease and request receipts. It is **not a durable RQ transcription job**. Browser retry can recover transient requests but cannot guarantee provider work is not repeated after an API crash. Provider requests have costs and ambiguous timeouts. This is a material recovery gap.

Export: ownership/auth → account policy → atomic request receipt → queued application job and RQ job → atomic `starting` claim → render → storage/finalization → transactionally recorded usage → completed payload. Redis is authoritative for transitions while enabled; Firestore mirrors revisions. Admission and enqueue are not one transaction across Redis/Firestore/RQ. The implementation is not exactly-once execution after Redis data loss.

Allowed states are defined in `backend/job_state.py`. Cancellation succeeds only before execution (`queued` or `retrying`); a started job returns conflict. Completed, failed and cancelled are terminal. Duplicate workers return existing state without rendering or releasing the winner's slot. Authorized polling reconciles missing/dead RQ work to a visible failure. This is not a continuously running outbox reconciler.

Payments use server-fetched order context and Firestore payment/usage transactions. Refund-before-capture ordering now requests redelivery. Older subscription order events cannot overwrite a newer timestamped plan; unresolved/legacy ordering requires reconciliation. Deletion creates a durable UID fence before cleanup, denies new work, waits for active leases and prevents account/payment recreation. The retained fence is intentionally outside the deleted user subtree; document its purpose/retention in the processing inventory before launch.

The Dashboard's restore, autosave and Save actions use `localStorage['captionEditorState']`; saved editing state is not durable cloud project storage. A cleared browser profile, different device or local-storage failure can lose edits. Recent exports in Firestore are not editable caption revisions.

## First three scaling limits

1. Chromium frame capture plus FFmpeg saturate worker CPU, memory and scratch I/O. One RQ process executes one job; configured semaphores do not create a global capacity guarantee. Load-test real 180-second, high-resolution, multilingual templates before increasing workers beyond the approved profile.
2. Proxying up to 500 MiB through FastAPI consumes ingress, connections and scratch disk twice when moving media to object storage. Slow clients compete with transcription API capacity.
3. Transcription/provider latency, synchronous storage/database calls and shared Redis admission/state constrain API concurrency and recovery. A Redis outage intentionally rejects protected work, but connection-level timeouts and real failover latency still need bounded deployment validation.

Do not extrapolate the existing lightweight HTTP smoke into video-processing throughput. `scripts/load_smoke.py` now uses public health/version endpoints, rejects non-2xx and reports throughput and p50/p95/p99; it remains a probe benchmark.

## Direct resumable upload design (staged, not implemented)

This is the recommended next upload architecture. Retain the hardened proxy while developing behind a flag; do not weaken current storage rules as a shortcut.

1. `POST /api/uploads/init`: verify Auth/App Check, deletion fence, tenant membership and budget. Generate upload ID and private quarantine object key from verified UID/tenant plus random ID. Store a durable intent with owner, allowed format, maximum bytes, expiry, reserved quota, status and idempotency key. Never accept a client object path. Repeating the same key returns the existing intent; a changed payload conflicts.
2. Grant a narrowly scoped, short-lived storage upload authorization. A resumable session URL is a bearer credential: redact it from logs/analytics, bind initialization to the intended origin, and use provider-supported restrictions. Signed initiation expiry does not necessarily terminate an already-created resumable session; the server's intent deadline remains authoritative. Limit per-account active sessions/reserved bytes and system quarantine storage.
3. Browser uploads directly with resumable offsets and retry/backoff. Report bytes sent separately from server validation. Quarantine objects are never readable by customers or processing workers before approval. Client MIME, size and filename are hints only.
4. `POST /api/uploads/{id}/complete`: load intent by ID and verify owner/deadline. Fetch object generation/version and actual size from storage; reject under/oversize and unexpected object identity. Bind checksum/generation to the intent and use conditional writes to prevent overwrite races. Completion is idempotent; concurrent calls cannot release reservations or enqueue twice.
5. Enqueue validation using the exact immutable generation. Restricted worker validates bytes/container, dimensions, duration, tracks and decompression/resource limits; scanner must succeed with current signatures. Deny network protocols and broad filesystem access. Atomically mark validated or rejected. Publish only validated objects to processing; queue notifications alone are not proof of ownership or completion.
6. On rejection, expiry or user deletion, revoke intent and clean quarantine/session artifacts with a durable retryable janitor. Account for failed deletion, multipart parts and provider lifecycle delays. Scheduled reconciliation compares reserved quota with actual objects; rate-limit authorization creation and alert on abandoned-byte growth.
7. Pilot with isolated test accounts, interruptions at every upload phase, forged paths/MIME/size, token expiry, object replacement, duplicate completion, scanner outage and deletion races. Validate CORS, IAM and lifecycle live. Expand gradually; keep proxy fallback until recovery/cost measurements pass. Rollback stops new direct intents but continues cleanup and completion for existing intents.

## Durable projects and transcription plan

Add owned project documents with schema version and caption revisions, optimistic concurrency (`expected_revision`), operation receipts, quota limits and explicit conflict UI. Persist caption text/timing, canonical style/template IDs, validated per-word overrides and object references; never store arbitrary CSS or signed URL credentials. Keep local autosave as an offline cache and show whether a draft has reached cloud storage. Migration imports an existing local draft after authentication and ownership validation; clearing storage before confirmed cloud save must be tested.

Then give transcription a durable job intent, stable provider operation key where supported, bounded retry policy, terminal state, result pointer, cancellation semantics and reconciliation. Use a transactional outbox or equivalent durable dispatcher for intent-to-queue delivery. Resolve unknown provider outcomes before retrying paid calls; never promise exactly-once billing without provider support. Test API/worker crashes before and after each external side effect.

## Cloud choice

**Recommend A for the planned Google Cloud launch:** Firebase Hosting for editor/marketing, separate Compute Engine API and RQ worker services, private managed Redis, private object storage and explicit scratch disk limits. This fits the current long-running FFmpeg/Chromium processing and large proxy uploads with fewer application changes. VM patching, capacity/draining, IAM and monitoring become operator responsibilities; no GCP resources were provisioned or priced here.

**B: Firebase Hosting + Cloud Run** is a later candidate after direct uploads and durable asynchronous work. Cloud Run documents a 32 MiB HTTP/1 request limit; its writable container filesystem consumes instance memory. Those constraints conflict with treating the current 500 MiB proxy and render scratch as a drop-in deployment. HTTP/2 support alone does not solve worker lifetime, request-bound processing or scratch pressure. [Cloud Run quotas](https://docs.cloud.google.com/run/quotas), [container contract](https://docs.cloud.google.com/run/docs/container-contract).

**C: retain Netlify/Railway** minimizes immediate platform migration and has historical deployment evidence, but currently has release mismatch and independent deployments. It still needs the same release, restore, privacy, concurrency and monitoring gates. A platform move is not a fix for application recovery semantics. Firebase Hosting supplies the static hosting side of A/B. [Firebase Hosting](https://firebase.google.com/docs/hosting).
