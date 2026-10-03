# Archive: the Google Cloud version of Lekha Captions

Written 2 October 2026, when the project decided to move to AWS
(`docs/AWS_SERVERLESS_MIGRATION_2026-10-02.md`). This file records how the app,
its workflows and its Google Cloud infrastructure were built, so the setup can
be understood or rebuilt later.

**Snapshot:** every file named below exists unchanged at commit
`58afb17d0081d5105f21c99f36235195b1c58d30` (`main`, 29 Sep 2026). To bring any
of it back after it is deleted:

```bash
git show 58afb17:caption-studio-publish-main/deploy/gcp/terraform/main.tf
git checkout 58afb17 -- caption-studio-publish-main/deploy/gcp    # restore the whole folder
```

> **Warning:** this design billed while idle: about ₹40k a month gross with
> almost no users (see "Why it was expensive" below). Do not redeploy it as is.
> Reuse the ideas, not the always-on resources.

---

## 1. Repository layout

```text
lekha-captions/
├── caption-studio-publish-main/          ← the application
│   ├── src/                              React 18 + Vite editor and account UI (Tailwind, Radix, React Query)
│   ├── backend/                          FastAPI API, workers, payments, storage, rendering
│   │   ├── main.py                       ~5,000-line app: routes, Redis/RQ setup, jobs, limits
│   │   ├── processor.py                  FFmpeg/ASS rendering, fonts, Sarvam/Whisper transcription
│   │   ├── export_api.py                 /api/export, status, batches, cancel
│   │   ├── payments_api.py, billing.py   Razorpay orders, verify, webhook, reconciliation
│   │   ├── direct_upload_api.py          browser → GCS resumable upload sessions
│   │   ├── firebase_admin_setup.py       Firebase Auth/Firestore/Storage helpers, signed URLs
│   │   ├── worker.py                     RQ worker (always-on VM mode or on-demand Cloud Run Job mode)
│   │   ├── worker_launcher.py            starts Cloud Run Job workers on demand (coded, never live)
│   │   ├── queue_admission.py            atomic queue-count + predicted-work admission (Redis)
│   │   ├── upload_admission.py           per-user upload limits (Redis Lua)
│   │   ├── job_state.py                  export state machine (Redis compare-and-set)
│   │   ├── transcription_jobs.py         Firestore outbox for transcription
│   │   ├── services/media_scan_jobs.py   Firestore outbox for malware scans
│   │   ├── services/malware.py           ClamAV client (clamd socket or CLI)
│   │   ├── provider_health.py            Sarvam/OpenAI circuit breaker (Redis)
│   │   ├── gcp_queue_metrics.py          publishes queue metrics for MIG autoscaling
│   │   ├── gcp_scale_in.py               protects a VM from scale-in while it renders
│   │   ├── api/maintenance.py            Cloud Scheduler routes (dispatch, janitor, metrics, reconcile)
│   │   └── rendering/                    render cache, capacity model, renderer benchmark
│   ├── landing-next/                     Next.js marketing/legal site (static export, Netlify)
│   ├── scripts/                          release checks, template parity, render daemon, smoke/load tests
│   ├── deploy/gcp/                       all Google Cloud deployment material (section 4)
│   ├── Dockerfile                        targets: api, transcription, render (+ app = render)
│   ├── cloudbuild.yaml                   builds the three images in Cloud Build
│   ├── firebase.json / firestore.rules / storage.rules / firestore.indexes.json
│   ├── shared/planCatalog.json           plans, credits, limits, retention
│   └── docs/                             history of releases, audits, costs, runbooks
├── gcp-scale-before-20260912/            read-only export of live VMs/firewalls on 12 Sep 2026
├── lekha-url-map.yaml, lekha-url-map-www.yaml   load-balancer URL-map exports
└── .github/workflows/                    quality-gates (CI), synthetic-monitor
```

## 2. Application architecture on Google Cloud

```text
                    Users
                      │
   lekhacaptions.com (marketing, Netlify)        app.lekhacaptions.com (editor)
                                                     │
                       Global HTTPS load balancer + Cloud Armor (lekha-edge-security)
                       URL map: frontend backend │ API backend
                                                     │
         ┌───────────────────────────────────────────┼────────────────────────────┐
         ▼                                           ▼                            ▼
 Frontend: Cloud Run (nginx,            API: 2 × VM (MIG lekha-api-staging-mig)   Firebase Hosting
 lekha-frontend-staging)                or Cloud Run API candidate (min 0, max 4)  (static candidate)
                                                     │
            ┌────────────────────┬───────────────────┼──────────────────────┬──────────────────┐
            ▼                    ▼                   ▼                      ▼                  ▼
   Memorystore Redis      Firestore           GCS media bucket       Secret Manager      Razorpay
   STANDARD_HA 1 GB       (users, credits,    (private; uploads,     (runtime.env,       (orders,
   (RQ queues + state)    payments, projects, exports, render       pinned numeric       webhook)
            │             outboxes, jobs)     cache)                 version)
            ▼
   RQ worker VMs (regional managed instance groups, private, egress via Cloud NAT)
   ├── render MIG       n2-custom-4-12288 (4 vCPU/12 GB), 100 GB pd-ssd, 0..3 (live: 3)
   │     queues: caption_export_fast, caption_export_jobs, caption_export_heavy
   ├── spot render MIG  same shape, Spot, 0..1 (cap 2), queue: caption_export_heavy
   ├── GPU render MIG   g2-standard-4 (L4), disabled by default, cap 1
   └── transcription MIG e2-standard-2, 30 GB, 0..2
         queues: caption_media_scan_jobs, caption_transcription_jobs
   Each worker VM also ran a local ClamAV container (clamav/clamav:1.4_base).

   Cloud Scheduler (OIDC) → API /api/maintenance/*:
     transcription-dispatch  every 1 min      media-scan-dispatch  every 1 min
     queue-metrics           every 1 min      janitor              every 15 min
     payment-reconciliation  every 20 min
   Cloud Monitoring custom metrics → MIG autoscalers:
     pending_render_work_seconds, predicted_queue_wait_seconds, transcription_queue_depth
   External AI: Sarvam saaras:v3 (Indian languages), OpenAI Whisper, GPT for translation
```

Region: `asia-south1` (Mumbai), zones a/b/c. Project ID and historical
endpoints are recorded in `deploy/gcp/README.md`.

## 3. Request and job workflows

**Sign-in.** Firebase Auth (Google sign-in) in the browser. Firebase App Check
uses the **reCAPTCHA Enterprise** provider. The API checks ID tokens with
`firebase_admin`. The browser reads `users/{uid}` directly (Firestore rules
allow the owner to read; all writes go through the API).

**Upload.**
1. `POST /api/uploads/init`: checks auth, extension/MIME allow-list, size
   ≤ 500 MiB and Origin. Redis reserves an upload slot (max 2 active, 1 GiB
   outstanding, 12 per hour). The API creates a GCS **resumable session**.
2. The browser PUTs 8 MiB chunks straight to GCS (`src/lib/resilientUpload.js`)
   and resumes with `Content-Range: bytes */total`.
3. `POST /api/uploads/complete`: verifies the object, records ownership in
   Firestore `uploads`, and writes a **media-scan outbox** record.
4. Scan: the outbox is delivered to RQ `caption_media_scan_jobs` (immediately,
   then every minute by Cloud Scheduler). The worker downloads, runs ClamAV and
   marks the upload `clean` or `rejected`. Everything downstream requires
   `clean`.

**Transcription.** `POST /api/process` creates a deterministic job in Firestore
(`users/{uid}/transcription_jobs`) with a per-user lock and an outbox entry.
Dispatch goes to RQ `caption_transcription_jobs`. The worker claims the job in
a transaction, extracts audio with FFmpeg and calls Sarvam or Whisper. An
uncertain provider outcome becomes `unknown` and is never retried
automatically. The browser polls `/api/process` (`src/lib/resilientProcess.js`).

**Export.**
1. `POST /api/export` checks the idempotency key (Redis `idem:`), the plan
   preset (quality/fps clamp), credits and the daily limit.
2. **Atomic admission** (`queue_admission.py`): queue count ≤ 80 and predicted
   work ≤ 1,800 s across the fast/normal/heavy queues, in one Redis
   transaction.
3. The job is enqueued in RQ with `Retry(max=3, interval=[10,30,60])`, and its
   state is stored in Redis `export_job:{id}` (mirrored to Firestore
   `export_jobs`).
4. The render worker takes a per-user slot (`expactive:{uid}`) and renders with
   the ASS/FFmpeg path (standard captions) or the DOM/Chromium path (authored
   templates, `scripts/render_browser_daemon.mjs`). Output goes to GCS
   `exports/`.
5. Completion **debits exactly one credit** in a Firestore transaction keyed by
   job ID (`users/{uid}/export_usage`).
6. The browser polls `/api/export-status/{id}` (queue position + ETA), then
   `/api/export-result/{id}` returns a short-lived signed URL. Signing uses a
   dedicated signer service account (`signBlob` only).

**Payments.** Razorpay order → client verify (signature) → webhook
(`/api/razorpay-webhook`, HMAC `compare_digest`) → `_grant_payment_transactionally`
(Firestore, idempotent per payment) → reconciliation job every 20 minutes.
Order/verify idempotency used Redis `pay_idem:`, with a Firestore fallback.

**Retention.** Exports expire after 2 h / 24 h / 72 h by plan (signed URLs
refused after that). The janitor deletes expired objects. The GCS lifecycle
deletes objects after 4 days and aborts incomplete uploads after 1 day
(`deploy/gcp/gcs-lifecycle.json`).

## 4. Infrastructure inventory (`deploy/gcp/terraform/main.tf`)

| Resource | Name / shape | Purpose |
|---|---|---|
| Memorystore Redis | `lekha-redis-ha`, STANDARD_HA, 1 GB | RQ queues, job state, limits, idempotency |
| Cloud Storage | private media bucket + lifecycle + CORS | uploads, exports, render cache |
| Service accounts | runtime, media URL signer, scheduler caller | least-privilege identities |
| Cloud Router + NAT | `lekha-egress-router`, `lekha-egress-nat` | internet egress for private VMs |
| Health checks | API and worker MIG health (`/api/health/readiness`) | autohealing |
| Instance templates | API e2-standard-2 50 GB; render n2-custom-4-12288 100 GB pd-ssd; transcription e2-standard-2 30 GB; spot; GPU g2-standard-4 | VM shapes (pre-baked images) |
| Regional MIGs | `lekha-api-staging-mig`, `lekha-worker-staging-mig`, `lekha-transcription-staging-mig`, `lekha-worker-spot-staging-mig`, `lekha-worker-gpu-staging-mig` | API and worker pools |
| Autoscalers | render, transcription, spot, GPU | scale on custom queue metrics |
| Cloud Run v2 service | `lekha-api-staging` (min 0, max 4, API + ClamAV containers) | serverless API candidate |
| Serverless NEG | for Cloud Run behind the load balancer | canary routing |
| Cloud Scheduler | 5 jobs (section 2) | dispatch, metrics, janitor, reconciliation |
| Cloud Armor | `lekha-edge-security` | edge rules/rate limits |
| Custom IAM roles | signBlob-only signer role, scheduler role | narrow permissions |
| Secret Manager IAM | runtime secret accessor | read pinned `runtime.env` version |

Guard-rails in `variables.tf`: render max 1–3, render min must be 0, spot ≤ 2,
GPU ≤ 1, transcription ≤ 2, Cloud Run API min must be 0 and max ≤ 4.

Outside Terraform (created by scripts or the console): Artifact Registry
(`caption-studio`), the external HTTPS load balancer with URL maps
(`lekha-url-map*.yaml`), managed certificates, static IPs, firewall rules
(`gcp-scale-before-20260912/firewalls.json`), budget alerts (₹5,000 with
50/90/100%), and uptime checks.

### Deployment scripts (`deploy/gcp/`)

| File | What it did |
|---|---|
| `gce-startup.sh` | VM boot: read role/image/secret version from metadata, fetch `runtime.env` from Secret Manager, validate the image, start ClamAV and the role container, drain RQ gracefully |
| `bake-runtime-image.sh/.ps1` | build the pre-baked VM image (Docker + images pulled) |
| `provision-scaled-staging.ps1` | create templates/MIGs/autoscalers for staging |
| `configure-queue-autoscaling.ps1` | attach custom-metric autoscaling |
| `configure-cloud-armor.ps1` | edge security policy |
| `rollout-existing.py`, `persist-runtime-release.py`, `sync-capacity-settings.py` | roll a release onto MIGs, pin secret versions, sync limits |
| `finalize-staging.sh` | Redis/secret/VM hand-off for staging |
| `sync-frontend-sentry-secret.py` | frontend Sentry DSN secret |
| `frontend*/`, `backend-release/`, `firebase-hosting/` | Cloud Build pipelines and nginx frontend image |
| `runtime.env.example` | full key inventory for the runtime secret (no values) |
| `gcs-cors.json`, `gcs-lifecycle.json` | bucket CORS and lifecycle |
| `COST_ACCOUNTING.md` | bill-backed cost reconciliation method |

### Container images (`Dockerfile`)
- **api:** python:3.11-slim + FFmpeg, runs uvicorn (`backend.main:app`).
- **transcription:** same base, runs `python -m backend.worker` on the scan
  and transcription queues.
- **render:** node:22 + Chromium + FFmpeg + Python + packaged fonts
  (`backend/flat_fonts`, `RENDER_FONT_BUNDLE_REQUIRED=1`), runs the render
  browser daemon and the RQ worker.

### Key runtime settings (`deploy/gcp/runtime.env.example`)
`APP_ENV=production`, `REDIS_URL`, `ENABLE_DURABLE_QUEUE=1`, the queue names
above, `EXPORT_MAX_PENDING_JOBS=80`, `EXPORT_MAX_PENDING_WORK_SECONDS=1800`,
`EXPORT_MAX_QUEUE_WAIT_SECONDS=600`, `MAX_CONCURRENT_RENDERS=1`,
`AI_SYSTEM_DAILY_LIMIT`, `RUN_API_BACKGROUND_TASKS=0`, `GCS_MEDIA_BUCKET`,
`GCS_SIGNING_SERVICE_ACCOUNT`, `FIREBASE_APP_CHECK_ENFORCED=1`, Razorpay keys,
provider keys, `WORKER_LAUNCH_JOBS` / `WORKER_IDLE_EXIT_SECONDS` (on-demand
mode, unused live).

## 5. Measured facts worth keeping
- 17 Sep: a 100-job 720p capacity probe on 20 workers finished 100/100 in
  131 s. Worker cold start was 20–22 s on pre-baked images. (Google approved
  a 100 global vCPU quota.)
- Local renderer benchmark: 60 s 1080p30 ASS 14 s / DOM 26 s; 120 s 4K60
  185 s / 286 s (`docs/CLOUD_COST_DECISION_2026-09-29.md`).
- Plans: free/starter/creator/pro, max video 120–180 s, 1 credit per export;
  4K for Creator/Pro, 60 fps for Pro only (`shared/planCatalog.json`).

## 6. Why it was expensive
Always-on: 2 API VMs, 3 render VMs with 100 GB SSDs each, Standard HA Redis,
Cloud NAT, load balancer forwarding rules, static IPs and Cloud Armor. The
scheduler also called the API every minute. 1–27 Sep net bill: ₹11,085 (gross
₹35.6k before credits). Biggest items: Compute ₹8,601, Redis ₹1,860,
networking ₹581. Full analysis: `DEVELOPMENT_LOG.md` (2026-09-28) and §2 of
the AWS migration plan.

## 7. Related history documents
`docs/GCP_DEPLOYMENT_2026-09-11.md`, `GCP_SCALING_DEPLOYMENT_2026-09-12.md`,
`GCP_DEPLOYMENT_VERIFIED_2026-09-15.md`, `GCP_CAPACITY_2026-09-16.md`,
`GCP_PRODUCTION_HARDENING_2026-09-17.md`, `GCP_PRODUCTION_RELEASE_2026-09-24.md`,
`GCP_ISOLATED_MEDIA_LOAD_TEST_2026-09-24.md`,
`ARCHITECTURE_GAP_VERIFICATION_2026-09-28.md`, `GCP_DEPLOYMENT_PROMPT.md`,
`SERVERLESS_REDIS_SWITCH.md`, `CLOUD_COST_DECISION_2026-09-29.md`.
