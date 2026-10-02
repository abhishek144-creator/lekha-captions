# Lekha Captions: AWS scale-to-zero architecture and migration plan

Written 2 October 2026. This is a design and planning document. No application
code, cloud account, or paid resource was changed or created while writing it.
Prices are planning estimates (see "Price inputs" at the end), not a quote.

---

## The decision in one page

**Move Lekha to AWS, using only services that cost nothing when nobody is using
the app. Do not move the old Google Cloud VM design to AWS.**

| Layer | Choice | Idle cost |
|---|---|---|
| Dashboard frontend | Cloudflare Pages (static Vite build) | ₹0 |
| API | API Gateway HTTP API → one Lambda running the existing FastAPI app | ₹0 |
| Database for jobs, locks, limits, idempotency | DynamoDB on-demand, with a cap on maximum throughput | ₹0 (≤25 GB free) |
| User, credit, payment and project data | Firestore for now. Move to DynamoDB in a later phase. | ₹0 within the free quota |
| Sign-in | Firebase Authentication (kept) | ₹0 |
| Media | Private S3 bucket in Mumbai. Uploads go straight from the browser to S3 (multipart). Downloads use signed CloudFront links. | ≈ ₹15 |
| Upload scan and transcription | SQS → Lambda (short jobs; each call ends when the job ends) | ₹0 |
| Export render (FFmpeg + Chromium) | AWS Batch on Fargate. Tasks start per job and stop afterwards. Hard vCPU cap. | ₹0 |
| Job hand-off | DynamoDB Streams → a small dispatcher Lambda (the outbox) | ₹0 |
| Secrets | SSM Parameter Store SecureString (standard tier) | ₹0 |
| Guard-rails | Separate workload account with a Service Control Policy (SCP) that blocks NAT gateways, load balancers, EC2, RDS, ElastiCache and EKS. Budgets with an automatic action, plus Anomaly Detection. | ₹0 |

**Expected bill with zero users for a whole month: about ₹85–180 including
GST, mostly container-image and media storage.** There are no VMs, Redis, NAT gateway, load
balancer or minimum instances to bill by the hour.

**One typical 1-minute 1080p export costs about ₹1.2 in AWS compute. The paid
transcription call adds about ₹0.5.** Download bandwidth is free until about
4,000 exports a month (CloudFront's free 1 TB). After that, bandwidth becomes the
biggest cost line, larger than compute.

**If a bug submits 10,000 exports,** a database transaction rejects everything past
the queue limit. Batch's `maxvCpus` lets only 2–4 renders run at once, so the
renderers can spend at most about ₹40–80 per hour, not "unlimited".

The important corrections to the earlier conversation are:

1. Lekha's own plans cap videos at **120–180 seconds and 500 MiB**
   (`shared/planCatalog.json`, `backend/main.py:2481`). The 5-, 10- and 30-minute
   costs below are hypothetical. Allowing such videos would mean changing plans,
   upload limits and timeouts.
2. **Transcription does not need Batch.** The code sends audio to Sarvam or
   OpenAI. The local CPU work is only FFmpeg audio extraction. Lambda does this
   cheaper, with no cold-start image pull and no VPC.
3. **Start with S3, not R2.** The renderers run inside AWS, so S3 traffic is free
   in the same region. CloudFront gives 1 TB of free downloads a month. R2 only
   becomes cheaper above roughly 1 TB of downloads a month, around 4,000 exports.
4. **Two Google dependencies remain, and both need billing checked first:**
   - Firebase App Check uses **reCAPTCHA Enterprise** (`src/lib/firebase.js:3`),
     which needs a Google Cloud billing account.
   - The existing Firebase project's state is unknown after the old billing
     account was closed.

   See [Gate 0](#11-migration-plan).

---

## 1. Current architecture (verified in code, not taken from old docs)

```text
Browser (React/Vite SPA)  ──Firebase Auth + App Check (reCAPTCHA Enterprise)
   │
   │  HTTPS JSON                     8 MiB chunks, resumable
   ├────────────────────────────►  GCS bucket (private)  ◄── src/lib/resilientUpload.js
   ▼
FastAPI monolith  backend/main.py (~5,000 lines) + routers (export_api, payments_api, …)
   │  boot REQUIRES Redis + RQ in production  (main.py:836, main.py:842, main.py:863)
   ├── Redis  ── RQ queues: caption_export_{fast,jobs,heavy,gpu}, caption_transcription_jobs,
   │             caption_media_scan_jobs
   │          ── export job state (authoritative), idempotency, rate limits, per-user slots,
   │             upload admission, upload owner/meta cache, provider circuit breaker,
   │             analytics counters/latency lists, scheduled-job locks, worker launch leases
   ├── Firestore ── users/credits/history, payments + webhooks (transactional grants),
   │                projects/workspaces/revisions, uploads, transcription outbox,
   │                media-scan outbox, export job mirror, export_usage (exactly-once debit)
   ├── Cloud Scheduler → /api/maintenance/*  every 1 min (dispatch ×2, queue metrics),
   │                     15 min (janitor), 20 min (payment reconciliation)
   ▼
RQ workers (always listening on Redis)
   ├── render image: Node 22 + Chromium + FFmpeg + Python, packaged fonts  (Dockerfile "render")
   └── transcription image: Python + FFmpeg, ClamAV sidecar (clamd)       (Dockerfile "transcription")
        → Sarvam (Indian languages) / OpenAI Whisper; GPT for translation
Payments: Razorpay orders, client verify, signed webhook, reconciliation
Marketing site: landing-next (Next.js), deployed separately (Netlify)
```

What the code does well, and should be kept:

- **Exactly-once credit debit.** `_record_export_usage` (`main.py:2414`) uses a
  Firestore transaction keyed by `export_job_id`.
- **Exactly-once payment grant.** `_grant_payment_transactionally`
  (`billing.py:360`) also uses a Firestore transaction. Webhook HMAC is checked
  with `compare_digest` (`payments_api.py:297`).
- **Transcription outbox** (`transcription_jobs.py`). The job intent is committed
  first, RQ only delivers it, and a duplicate delivery is harmless. It also
  refuses to replay a provider call whose outcome is uncertain (`unknown` state).
- **Media-scan outbox** (`services/media_scan_jobs.py`). Exports, transcription and
  language detection all require a `clean` upload.
- **Strict export state machine** (`job_state.py`). Terminal states cannot be
  overwritten, and a revision number is kept.
- **Fail-closed checks:** the daily AI ceiling (`AI_SYSTEM_DAILY_LIMIT`), the
  Redis rate limiter in production, and payment idempotency.
- **An S3 adapter already exists** (`media_storage.py`, from the Railway era) for
  upload, download, delete, list and presigned GET.
- **Renderer settings that already suit containers:** packaged render fonts
  (`RENDER_FONT_BUNDLE_REQUIRED=1`) and the Chromium flags
  `--disable-dev-shm-usage` and `--disable-gpu`.

What exists in code but **never ran live**:

- On-demand Cloud Run Job workers (`worker_launcher.py`, `WORKER_IDLE_EXIT_SECONDS`).
- Minimum-zero worker groups.
- The serverless-Redis switch (`docs/SERVERLESS_REDIS_SWITCH.md`).

The last live inventory (`docs/ARCHITECTURE_GAP_VERIFICATION_2026-09-28.md`) still
showed two API VMs and three render VMs.

---

## 2. Why the previous GCP setup became expensive

Every one of these billed by the hour, whether or not anyone used the app. The
evidence is `DEVELOPMENT_LOG.md` (2026-09-28 entry) and
`deploy/gcp/terraform/main.tf`.

| Resource | Where defined | Why it billed while idle |
|---|---|---|
| 2 API VMs (managed instance group) | `main.tf:263` | A running VM bills every second, even with no requests |
| 3 render VMs, `n2-custom-4-12288` (4 vCPU / 12 GB) | `main.tf:289`, `variables.tf:119` | The live group stayed at 3, even though the source said min 0 |
| 100 GB pd-ssd per render VM | `variables.tf:124-129` | Disks bill even when the VM is stopped |
| Memorystore Redis **Standard HA** | `main.tf:48-51` | Billed for provisioned capacity, around the clock |
| Cloud NAT + router | `main.tf:154` | Billed per hour, plus per GB processed |
| External HTTPS load balancer, forwarding rules, static IPs, Cloud Armor policy | `main.tf` (NEG, security policy) | Forwarding rules and the policy bill per hour or per month |
| Cloud Scheduler calling the API **every minute** (3 jobs) | `main.tf:734-740` | About 130k API wake-ups a month, with zero users |
| Spot/GPU/transcription groups, 100-vCPU quota, 24 Sep load test | `main.tf:313/421/510` | Large potential capacity, and temporary test VMs |
| RQ workers built to stay connected to Redis | `worker.py:210` | The design assumes a worker is always waiting, so it never reaches zero |

Observed: from 1 to 27 September, the bill was ₹11,085 net (₹35.6k gross by
26 September, before credits). The biggest items were Compute Engine at ₹8,601,
Redis at ₹1,860 and networking at ₹581. The gross rate was roughly **₹40k a
month, with almost no users.**

**Lesson for the new design:** turning off a worker *process* or emptying a
queue does not stop a VM, disk, IP address, Redis instance or NAT gateway from
billing. The rule is: *no resource that bills by the hour is allowed, unless
the owner has approved it in writing together with its idle monthly cost.*

---

## 3. Target AWS architecture

Region: **ap-south-1 (Mumbai)**. The only exception is CloudFront's certificate,
which AWS requires in us-east-1 and which is free.

```text
                        Cloudflare (DNS + Pages, free)
   app.lekhacaptions.com ── static Vite build        lekhacaptions.com ── landing (unchanged)
                │
                │ Firebase Auth ID token (+ App Check token)
                ▼
   api.lekhacaptions.com ── API Gateway HTTP API (route throttles, no fixed fee)
                │
                ▼
   Lambda "api"  (FastAPI via AWS Lambda Web Adapter, NOT in a VPC, reserved concurrency 10)
     │  auth • ownership • plan/credit checks • admission transaction • presigned URLs
     │
     ├──► DynamoDB  lekha-jobs      (job records, state machine, versions)
     │              lekha-control   (locks, rate windows, idempotency, admission counters,
     │                               upload sessions, spend ledger, breaker, kill switches)
     │        │ Streams (INSERT / status→queued)
     │        ▼
     │    Lambda "dispatcher" (reserved 2)  ── the outbox: only path that starts work
     │        ├── scan/transcribe ──► SQS lekha-ingest-{scan,transcribe} (+DLQs)
     │        │                          ▼
     │        │                Lambda "scan"  (3 GB, ffprobe + ClamAV, max concurrency 2–5)
     │        │                Lambda "transcribe" (2 GB, FFmpeg audio → Sarvam/Whisper, max 2–3)
     │        └── export ──► AWS Batch SubmitJob
     │                          job queues: export-paid (prio 100), export-free (prio 10)
     │                          compute env: FARGATE (maxvCpus 8 pilot / 16 launch)
     │                          [later] FARGATE_SPOT for free tier
     │                             ▼
     │                Fargate task "render" (4 vCPU/8 GB; 4K: 8 vCPU/16 GB)
     │                  public subnet, public IP, NO inbound, egress 443 only
     │                  S3 + DynamoDB via free gateway endpoints
     │                  FFmpeg + one Chromium per task → output → exits
     │
     ├──► S3 lekha-media-prod (private, Block Public Access, SSE-S3, lifecycle)
     │     uploads/{uid}/{file_id}.ext   jobs/{job_id}/request.json   transcripts/…
     │     exports/{retention}/{uid}/{job_id}.mp4   render-cache/…
     │        ▲  browser multipart PUT (presigned parts)      │ downloads
     │        └──────────────────────────────────────────────┘ CloudFront (OAC, signed URLs)
     │
     ├──► Firestore (existing project, transitional): users, credits, payments, projects
     └──► Razorpay API / webhook (POST /api/razorpay-webhook → same Lambda)

   EventBridge: Batch "Job State Change" ──► Lambda "reconciler" (fail/cleanup, release counters)
   EventBridge Scheduler: reconciler every 15 min, janitor hourly, ClamAV DB refresh daily
   CloudWatch Logs (7–14 day retention) • SSM Parameter Store • ECR (lifecycle: keep 3 images)
   Budgets (daily + monthly with action) • Cost Anomaly Detection • SCP deny-list
```

Why each piece is shaped this way:

- **API on Lambda, not Fargate or ECS.** It must cost nothing between requests.
  Lambda Web Adapter runs the existing uvicorn/FastAPI app unchanged in a
  container image, so routes need no rewrite.
- **Scan and transcription on Lambda, not Batch.**
  - The work is a download, `ffprobe`, ClamAV, a few seconds of FFmpeg, and
    waiting on a provider's HTTP call.
  - For plan-sized videos (≤180 s) this takes well under 15 minutes.
  - Lambda starts in about a second, needs no VPC, and the free tier covers
    roughly the first 1,500 ingests a month.
- **Rendering on Batch/Fargate, not Lambda.**
  - Chromium plus FFmpeg at 4K needs 12–16 GB of memory and can run past
    15 minutes.
  - Per vCPU-second, Fargate costs about a third of an equivalent Lambda.
  - Batch adds a free queue, priorities, retries, timeouts, and the
    `maxvCpus` hard cap.
- **No direct SQS in front of Batch.** Batch's own job queue does that job.
  SQS is used only where it helps: as a buffer, redrive queue and concurrency
  limit for the Lambda workers.
- **DynamoDB Streams as the outbox.**
  - The API only commits a job record. The dispatcher, triggered by the
    committed change, is the only thing allowed to start compute.
  - This removes the "committed but never enqueued" crash window that the
    Firestore outboxes currently patch over with minute-by-minute polling.
  - Lambda reads from DynamoDB Streams at no charge.

---

## 4. End-to-end flow: which service handles each step

| # | Step | Service | Notes |
|---|---|---|---|
| 1 | Sign in | Firebase Auth (browser) | Unchanged. The API checks the ID token with `firebase_admin`. Lambda needs no VPC and no NAT to reach Google's public keys. |
| 2 | Create project | API Lambda → Firestore (later DynamoDB) | Existing `project_api.py` / `workspace_api.py`. |
| 3 | Request upload | `POST /api/uploads/init` → API Lambda | Checks auth, file extension and MIME allow-list, size ≤ plan cap, and Origin. A **DynamoDB transaction** reserves an upload slot (max 2 active, ≤1 GiB outstanding, ≤12 per hour). It then calls `CreateMultipartUpload` and returns presigned `UploadPart` URLs for the first N parts. Each URL is signed with an exact `Content-Length`, valid for 15 minutes. |
| 4 | Browser uploads | Browser → S3 directly | 8–16 MiB parts, 3 in parallel. The `ETag` of each part is read (needs CORS `ExposeHeaders: ETag`). To resume, `POST /api/uploads/resume` → `ListParts` returns the missing parts plus fresh URLs. |
| 5 | Upload complete | `POST /api/uploads/complete` → API Lambda | `CompleteMultipartUpload`, then `HeadObject`. Size must equal what was declared. In one transaction it writes the upload record (`pending_scan`) and a `scan` job record, and releases the slot. |
| 6 | Validation and security scan | Stream → dispatcher → SQS → **scan Lambda** | `ffprobe`: real video stream, duration ≤ plan, ≤4K, ≤60 fps, allowed codecs. Then ClamAV. If clean: tag the object `scan=clean` and set the state to `clean`. If rejected: delete the object and record the reason. |
| 7 | Transcription starts | `POST /api/process` → API Lambda | Existing intent logic, with job records moved to DynamoDB. Per-user lock, daily AI ledger and circuit breaker are checked. Stream → dispatcher → SQS → **transcribe Lambda**. |
| 8 | Transcription result saved | Transcribe Lambda → S3 `transcripts/` + DynamoDB | The result is stored in S3, because a DynamoDB item is limited to 400 KB. A conditional `running→completed` write. An uncertain provider outcome becomes `unknown`, never a replay. |
| 9 | User edits captions | Browser, plus draft saves through the API | Preview plays from the **local file** in the uploading session, which avoids re-downloading the source. A CloudFront signed URL is used otherwise. |
| 10 | User requests export | `POST /api/export` → API Lambda | Idempotency key, plan preset (quality/fps clamp), credit and daily-limit pre-check. The export spec goes to `s3://…/jobs/{job_id}/request.json`. The **admission transaction** (§10) writes the job record. |
| 11 | Job enters queue | Stream → dispatcher → `batch:SubmitJob` | Job queue chosen by tier. Parameters are only `job_id`, with timeout and retry policy set. |
| 12 | Worker starts | AWS Batch → Fargate | About 60–120 s from submit to running: scheduling, network interface, image pull. The UI shows "Starting renderer…" with an ETA. |
| 13 | Render | Fargate task | Claim (`queued→starting`, fenced with an attempt number), download the clean source, render with ASS/FFmpeg or DOM/Chromium, heartbeat every 30 s, and check for cancellation between stages. |
| 14 | Output uploaded | Fargate → S3 `exports/{1d|3d}/…` | Same-region traffic, free, through the gateway endpoint. |
| 15 | Job marked complete | Task → DynamoDB + Firestore | `finalizing→completed`, **exactly-once credit debit** (existing transaction keyed by `job_id`), counters released. Then the task exits and billing stops. |
| 16 | User downloads | `GET /api/export-result/{id}` → CloudFront signed URL (10 min) | Ownership checked. The link is refused after the plan's retention window, even if the file still exists. |
| 17 | Temporary files expire | Hourly janitor Lambda + S3 lifecycle | The janitor deletes exactly on schedule (2 h / 24 h / 72 h). Lifecycle rules (1 d / 3 d / 7 d, abort incomplete multipart after 1 d) are the backstop. |
| — | Failures | Batch state events → reconciler; SQS → DLQ | Marks the job failed, releases counters, deletes the idempotency key. No credit is charged for a failed export. |

---

## 5. Service mapping: current → new

| Current (GCP / Redis / RQ) | New (AWS / Cloudflare) |
|---|---|
| API MIG VMs / planned Cloud Run API | API Gateway HTTP API + Lambda (same FastAPI code via Lambda Web Adapter) |
| Render MIG + spot + GPU groups | AWS Batch on Fargate (on-demand; Spot later for free tier). GPU dropped. |
| Transcription MIG + RQ transcription/scan queues | SQS → Lambda (scan, transcribe) |
| ClamAV sidecar container | ClamAV inside the scan Lambda image. Definitions refreshed daily to S3. |
| Memorystore Redis | DynamoDB (`lekha-jobs`, `lekha-control`) — details in §13 |
| RQ queues, `with_scheduler`, `Retry` | DynamoDB job records + Streams outbox + Batch queue/retry + SQS redrive |
| `worker_launcher.py` (Cloud Run Job leases) | Removed. Batch starts tasks itself. |
| `gcp_queue_metrics.py`, `gcp_scale_in.py`, capacity probe | Removed. No autoscaler to feed. |
| Cloud Scheduler every minute | EventBridge Scheduler: 15-minute reconciler, hourly janitor, daily ClamAV refresh. Plus event-driven Batch state rules. |
| GCS bucket + resumable sessions | S3 bucket + multipart presigned parts |
| GCS signed URLs (`GCS_SIGNING_SERVICE_ACCOUNT`) | CloudFront signed URLs (key group). S3 presigned URLs for uploads. |
| Secret Manager | SSM Parameter Store SecureString (free standard tier) |
| Artifact Registry | ECR (lifecycle: keep last 3 images per repo) |
| Cloud Logging | CloudWatch Logs, with retention set on every log group |
| External LB + Cloud Armor | Not needed. API Gateway throttling, plus Cloudflare proxy/rate rule (free) if wanted. |
| Cloud NAT | **Not needed** (§3 networking) |
| Firebase Hosting / Netlify (app) | Cloudflare Pages |
| Firebase Auth | **Kept** |
| App Check (reCAPTCHA Enterprise) | App Check with the **reCAPTCHA v3** provider (free, no billing account), or Cloudflare Turnstile on expensive endpoints |
| Firestore | Kept for user/credit/payment/project data in phase 1. Job data moves to DynamoDB now. The rest moves in phase 2. |

### Networking without a NAT gateway

| Caller | Runs in | Reaches | How | Fixed cost |
|---|---|---|---|---|
| API, dispatcher, scan, transcribe, reconciler, janitor Lambdas | **No VPC** (AWS-managed network) | DynamoDB, S3, SQS, Batch, SSM, Firebase/Google, Sarvam, OpenAI, Razorpay | Public AWS endpoints and the internet | ₹0 |
| Batch/Fargate render task | Dedicated VPC, **2 public subnets**, `assignPublicIp=ENABLED`, security group with **no inbound rules** | S3, DynamoDB | **Gateway VPC endpoints (free)** | ₹0 |
| Same task | same | ECR image pull, CloudWatch Logs | Through its public IP (in-region, free) | ≈ ₹0.0004 per task-minute for the IPv4 address |
| Same task | same | Google Fonts (only if a non-packaged font is requested) | Internet | Prefer packaged fonts only |

Not allowed in the network:

- NAT gateways.
- Interface VPC endpoints. These cost about ₹700 each per AZ per month, so they
  are not a free substitute for NAT.
- Elastic IPs.
- Load balancers.

The render task holds no secret except its scoped IAM role. Paid-provider keys
and Razorpay keys never reach it.

---

## 6. Scale-to-zero analysis

| Component | Classification | Idle monthly (₹, before GST) |
|---|---|---|
| Cloudflare Pages + DNS | Usage-based, free plan | 0 |
| API Gateway HTTP API | **Truly zero** | 0 |
| API Lambda | **Truly zero** | 0 |
| Dispatcher / scan / transcribe Lambdas | **Truly zero** (run only for work) | 0 |
| Reconciler (every 15 min) + janitor (hourly) + ClamAV refresh (daily) | Scheduled, tiny | 0 within the free tier (≈ ₹3 if it weren't) |
| SQS queues + DLQs | Usage-based. Lambda's poller sends long-poll requests even when idle. | 0 within the 1M free requests (≤ ₹25 worst case) |
| AWS Batch queues and compute environments (Fargate) | **Truly zero** (no instances) | 0 |
| Fargate render tasks | **Truly zero** | 0 |
| Public IPv4 on tasks | Only while a task runs | 0 |
| VPC, subnets, security group, S3/DynamoDB gateway endpoints | Free | 0 |
| DynamoDB on-demand (2 tables, PITR on) | Usage-based, persistent storage | ≈ 0–5 |
| S3 (media residue + build artifacts ≈ 5 GB) | Persistent storage | ≈ 12 |
| CloudFront | Usage-based | 0 |
| ECR (≈ 6 GB of images after lifecycle) | Persistent storage | ≈ 57 |
| CloudWatch Logs storage, ≤10 alarms | Persistent storage | ≈ 0–10 |
| SSM Parameter Store (standard), AWS-managed KMS keys | Free | 0 |
| Budgets (2), Cost Anomaly Detection, EventBridge | Free | 0 |
| Firebase Auth / Firestore (free quota) | Usage-based | 0 |
| **Anything that bills by the hour** | **None** | **0** |

---

## 7. Idle cost: zero users for a month

| Item | ₹/month |
|---|---|
| ECR images (≈6 GB) | 57 |
| S3 residue (≈5 GB) | 12 |
| Logs, PITR, alarms, odd requests | 0–80 |
| **Total before GST** | **≈ 70–150** |
| **Cash with 18% GST** | **≈ 85–180** |

Separate common costs: the domain, any marketing-site hosting, and Firebase if
it ever leaves the free quota.

**Zero users for a day:** compute cost is ₹0. Storage accrues at about ₹3–5 a
day.

---

## 8. Cost of one export

Assumptions:

- 1080p, 30 fps, phone-quality source (about 100 MB per minute), output about
  60 MB per minute.
- Render task: 4 vCPU / 8 GB. Wall time = 60 s fixed (scheduling, image pull,
  transfers) + 1.5 × video length. This is a **hypothesis to measure** in the
  pilot. The repo's local benchmark is 26 s for a 60 s DOM render on a desktop.
- Scan Lambda: 3 GB. Transcribe Lambda: 2 GB.
- Downloads: the source once plus the output twice.
- Provider: 90% Sarvam (₹0.50 per minute), 10% Whisper.
- Rates in §19.

| Video | Render time | AWS compute | Download volume | Download cost after free tier | Provider | **Total (₹)** | Spot render instead |
|---|---|---|---|---|---|---|---|
| 1 min | ≈150 s | ₹1.15 | 0.21 GB | ₹2.22 (₹0 inside the free 1 TB) | ₹0.51 | **₹1.7 – 3.9** | compute ₹0.66 |
| 5 min* | ≈510 s | ₹3.61 | 1.07 GB | ₹11.12 | ₹2.54 | **₹6.2 – 17.3** | compute ₹1.93 |
| 10 min* | ≈960 s | ₹6.67 | 2.15 GB | ₹22.25 | ₹5.07 | **₹11.7 – 34.0** | compute ₹3.52 |
| 30 min* | ≈2,760 s | ₹18.93 | 6.45 GB | ₹66.74 | ₹15.21 | **₹34 – 101** | compute ₹9.86 |
| 1 min **4K60** | ≈480 s on 8 vCPU / 16 GB | ₹5.81 | 0.80 GB | ₹8.29 | ₹0.51 | **₹6.3 – 14.6** | — |

\* Current plans don't allow this. It would need a higher upload cap (a 5-minute
phone video is about 500–750 MB, already over the 500 MiB limit), a higher
duration cap, and longer job timeouts.

Takeaways:

- **Compute is the cheap part.** Download bandwidth and provider fees dominate.
- The cheapest bandwidth saving is the step 9 change: play the editor preview
  from the local file instead of downloading the source again.
- **4K60 is about 5× the cost of 1080p.** The Pro annual plan earns about ₹4.51
  per credit, so heavy 4K60 use can lose money. Keep 4K behind a plan check and
  measure it before advertising it widely.
- Transcriptions that never lead to an export (free users trying the app) cost
  provider fees with no credit revenue. The daily AI ledger caps this. Keep it
  fail-closed.

---

## 9. 100 users click Export at the same moment

Settings: launch configuration (Batch `maxvCpus` 16, so 4 typical exports run at
once), global queue limit 40, free users 1 active export, paid users 2.

1. **API Gateway** absorbs the burst (route burst 40). Anything over the limit
   gets HTTP 429 and the client retries with jitter.
2. **API Lambda** (reserved concurrency 10) handles each request in about
   100–300 ms, so 100 requests clear within seconds.
3. **Admission transaction** (DynamoDB):
   - The first 40 valid requests are admitted.
   - The other 60 get 429 with `Retry-After`. **No credit is charged and no
     compute starts.**
   - Duplicate clicks resolve to the same job through the idempotency key.
4. **Dispatcher** submits the 40 jobs to Batch. Batch starts **4** Fargate tasks
   (16 ÷ 4 vCPU). The other 36 wait in the Batch queue (status RUNNABLE), at no
   cost. Paid-queue jobs start before free-queue jobs.
5. Each typical render takes about 150 s, so the queue drains in about
   (40 ÷ 4) × 150 s ≈ **25 minutes**. The median wait is about 12 minutes. The
   UI shows the queue position and ETA from `(position ÷ concurrency) × average
   render time`.
6. **Cost:** 40 × ≈₹1.2 ≈ **₹48**. The highest possible spend rate during the
   burst is ₹79 per hour.

Raising concurrency (for example `maxvCpus` 32) **does not raise the cost of
real work.** The same 40 renders cost the same amount, they just finish in about
half the time. The cap only limits how fast a *bug* can spend money. So raise it
when real demand appears, not before.

The same pattern applies to transcription. Scan concurrency 5 and transcription
concurrency 3 clear 100 uploads in about 10–20 minutes, also limited by
Sarvam's rate limits.

---

## 10. Cost safety controls: worst-case containment

Seven independent layers. Any one of them stops a runaway on its own.

| Layer | Control | Value at pilot / launch |
|---|---|---|
| **1. Product limits** | Max duration (plan) | 120 / 180 s (existing) |
| | Max upload | 500 MiB (existing). Every presigned part has a signed `Content-Length`. |
| | Max resolution / fps | Plan preset clamp (existing `_resolve_export_preset`). 4K only on Creator/Pro, 60 fps only on Pro. |
| | Max captions per request | 1,000 (existing) |
| | Credits, daily export limit | Existing Firestore transaction |
| **2. Per user** | Active uploads / hourly uploads | 2 / 12 |
| | Active transcriptions | 1 (existing lock) |
| | Active exports | free 1, paid 2 |
| | API rate windows | Existing `_check_rate` limits, moved to DynamoDB |
| **3. Global admission** (one DynamoDB transaction) | Exports queued + running | 20 / 40 |
| | Predicted pending render seconds | 1,800 / 3,600 (existing concept) |
| | Daily paid AI calls (fail-closed) | 50 / 300 (`AI_SYSTEM_DAILY_LIMIT`) |
| | **Daily compute-spend ledger.** Each job reserves its estimated vCPU-seconds × rate. Refused once over the cap. | ₹150 / ₹600 per day |
| | Kill-switch flags (`pause_uploads`, `pause_transcription`, `pause_exports`) | Existing `_assert_service_available`, read from DynamoDB |
| **4. Platform hard caps** | Batch compute environment `maxvCpus` | **8 / 16** |
| | Batch job timeout (`attemptDurationSeconds`) | 20 min (≤1080p), 45 min (4K) |
| | Batch retry attempts | 2 (application errors not retried) |
| | Lambda reserved concurrency | api 5/10, dispatcher 2, scan 2/5, transcribe 1/3, reconciler 1, janitor 1 |
| | SQS → Lambda `MaximumConcurrency` | Same as above. `maxReceiveCount` 3, then DLQ. |
| | API Gateway throttles | Default 20 rps, burst 40. Upload/export routes 5 rps. |
| | DynamoDB on-demand **maximum throughput** per table | e.g. 200 WRU / 1,000 RRU |
| | Fargate service quota | Request only up to `maxvCpus` |
| | S3 lifecycle | Abort incomplete multipart after 1 day. Expire uploads in 3 days, exports in 1/3/7 days. |
| | CloudWatch log retention | 14 days. INFO level. No per-frame logs. |
| **5. Account guard-rails** | **SCP on the workload account** | Deny: `ec2:CreateNatGateway`, `elasticloadbalancing:*Create*`, `ec2:RunInstances`, `rds:Create*`, `elasticache:Create*`, `eks:Create*`, `ec2:AllocateAddress`, `ec2:CreateVpcEndpoint` for Interface endpoints, `sagemaker:*`. Any region except ap-south-1 (and us-east-1 for global services) denied. |
| | CI check on `terraform plan` | Fails if a forbidden resource type appears, or an `aws_ecs_service` with `desired_count > 0` |
| **6. Billing alarms** | AWS Budgets (2 free) | Daily ₹300; monthly ₹1,500, alerts at 50/80/100% actual and 100% forecast |
| | Budget Action on the monthly budget | At 100%, attach a `DenyNewWork` IAM policy to the dispatcher role (`batch:SubmitJob`, `sqs:SendMessage`). Existing jobs finish. Data is untouched. |
| | Cost Anomaly Detection | Service monitor, ₹200 impact threshold, email |
| | Kill-switch Lambda (via SNS) | Batch CE `maxvCpus` → 0, job queues DISABLED, ingest Lambda reserved concurrency → 0, then a notification |
| **7. People and process** | Root MFA, no root access keys, single admin via IAM Identity Center | The AGENTS.md cost gate stays: a priced plan and owner approval before every apply |

Budgets and anomaly alerts **are not real-time.** AWS billing data can lag up to
about 24 hours. That is why layers 3–5 do the actual limiting and layer 6 is
only the backstop.

**Worst case if layers 1–3 all have a bug at once:**

| Source | Pilot | Launch |
|---|---|---|
| Batch at `maxvCpus` around the clock | ₹947 / day | ₹1,893 / day |
| Ingest Lambdas at full concurrency, non-stop | ≈ ₹1,100 / day | ≈ ₹2,900 / day |
| API at its reserved concurrency | ≈ ₹350 / day | ≈ ₹700 / day |
| Provider calls | Capped by the fail-closed AI ledger (≈ ₹300 / day) | same |

The anomaly alert and Budget Action fire within about a day. **Realistic worst
case before automatic shutdown: about ₹2,700 (pilot) to ₹6,000 (launch).** It
cannot grow without limit.

### Admission transaction (replaces the Redis `enqueue_bounded_across_queues`)

```text
TransactWriteItems (all-or-nothing):
  Put    jobs/{job_id}                     cond: attribute_not_exists(job_id)
  Put    control/IDEM#{uid}#{key}          cond: attribute_not_exists  (TTL 6 h; stores request hash + job_id)
  Update control/LOCK#export#{uid}         cond: active_count < plan_max
  Update control/ADMISSION#export          cond: queued_running < MAX_IN_SYSTEM
                                                 AND pending_work_s + :est <= MAX_PENDING_WORK
  Update control/SPEND#{yyyy-mm-dd}        cond: reserved_paise + :est_paise <= DAILY_CAP   (TTL 40 d)
→ TransactionCanceled with reason → 409 duplicate / 429 busy (Retry-After) / 503 kill switch
```

Releasing a slot is done in one transaction with the job's terminal-state write,
and only if the job was not already terminal, so a counter can never be
decremented twice. The 15-minute reconciler recounts the counters from the job
records and corrects any drift.

---

## 11. Migration plan (ordered)

**Gate 0: decisions and checks before any work (1–2 days, no cost)**

1. Confirm the old GCP project has no VMs, disks, IPs, Redis, NAT, load balancer,
   buckets or scheduler jobs left. The September notes were reported by the
   owner and have not been re-verified. Keep the billing dispute as a separate
   matter. Moving to AWS does not cancel the Google balance.
2. Check whether the **Firebase project** still works without the closed billing
   account:
   - Can users sign in?
   - Do Firestore reads and writes work?
   - Are you inside the Spark free quota?

   Then take a safety copy: `firebase auth:export`, plus a Firestore dump made
   with the Admin SDK. Firestore's managed export needs a billing-enabled
   bucket, so it may not be available.
   - **If Firebase works:** continue with the plan below. Firestore stays for
     now.
   - **If it does not:** phase 6 (Firestore → DynamoDB) becomes mandatory before
     launch. If sign-in itself is gone, replace Firebase Auth with Amazon Cognito
     (10k MAU free) and federated Google sign-in. That adds about one week.
3. Replace App Check's reCAPTCHA Enterprise with the reCAPTCHA v3 provider. Check
   that it issues tokens with no Google billing account. If it doesn't, turn off
   App Check enforcement and use Cloudflare Turnstile on the init, process and
   export calls.
4. Create the AWS setup:
   - A management account for billing only, and a **separate workload account**
     with the SCP from §10.
   - Root MFA, budgets and anomaly detection, all **before** any workload.
   - New accounts can pick AWS's credit-based *Free plan*. It cannot run up
     charges while it lasts, which is a useful hard cap for the pilot. Check
     that Batch/Fargate are allowed on it, and plan the upgrade before the
     6-month expiry.

**Phase 1: make the code Redis-free and cloud-neutral, entirely local (≈2–3 weeks of engineering)**

5. Add `backend/state/`: a small `StateStore` interface with a DynamoDB
   implementation and an in-memory version for tests. Move every Redis
   responsibility onto it (§13).
6. Add `backend/jobs/`:
   - `run_export(job_id)`, `run_scan(file_id)` and `run_transcription(uid, job_id)`
     as plain functions.
   - A `Dispatcher` interface with Batch, SQS and local-inline (for development)
     implementations.
   - Remove RQ.
7. Storage: extend `media_storage.py` with multipart create, sign-part, list,
   complete and abort, plus CloudFront signing. Point `firebase_admin_setup.py`'s
   storage functions at it. Rewrite the browser upload protocol in
   `resilientUpload.js`.
8. Delete the GCP-only modules (§12).
9. Tests to write and pass:
   - Duplicate stream and SQS delivery; dispatcher crash after `SubmitJob`.
   - Worker crash in every state; expired heartbeat.
   - Cancellation while queued and while running.
   - Credit exactly-once on retry; payment webhook replay.
   - Admission-cap races (50 concurrent requests against a limit of 20).
   - Kill switches.

   Tools: `moto` for unit tests, DynamoDB Local plus MinIO for a local
   end-to-end run. The existing suites (`test_api_contracts`,
   `test_durable_workflows`, the template parity checks) must stay green.

**Phase 2: infrastructure as code (≈3–5 days)**

10. Add `deploy/aws/terraform/` covering every resource in §3.
11. Add the CI script that blocks forbidden resources.
12. Produce a saved `terraform plan` plus a priced inventory, and get the
    **owner's written approval** (the AGENTS.md cost gate).

**Phase 3: staging pilot (≈1 week, capped at about ₹1,000)**

13. Apply staging with `maxvCpus` 4 and a daily ledger of ₹100.
14. Run 3 small, 3 typical and 3 large real exports. Record seconds, peak memory
    (set task memory to p99 × 1.3), time to start, and image pull time.
15. Check **0 → 1 → 0**: after the run, confirm no task is running, no Lambda is
    being invoked, and the next 48 hours' bill shows only storage.
16. Test failure paths with the kill switch: disable the queue, budget action,
    Spot interruption (later).

**Phase 4: production cutover (≈1 day plus a watch period)**

17. Deploy the frontend to Cloudflare Pages with `VITE_API_BASE_URL=https://api.lekhacaptions.com`.
18. Update the Razorpay webhook URL and DNS. Run a real ₹1 test payment, then
    refund it.
19. Old GCS media is **not migrated**: exports and uploads expire within days
    anyway. Projects and drafts in Firestore keep working. Tell active users to
    re-upload any source they still need.
20. Check the first daily cost breakdown by service and record live state in
    `DEVELOPMENT_LOG.md`.

**Phase 5: optimise only after measuring**

21. Fargate Spot for the free-tier queue.
22. Graviton/arm64 render image (about 20% cheaper; re-run template parity).
23. Image slimming (chromium-headless-shell) and a seekable-image index (SOCI)
    for faster starts.
24. R2 for export delivery only if CloudFront traffic stays above 1 TB a month.

**Phase 6: remove the remaining Google data dependency (≈1–2 weeks)**

25. Move the 33 Firestore collections to DynamoDB, in this order:
    1. users/credits/export_usage
    2. payments/webhooks/idempotency
    3. projects/workspaces/revisions/drafts
    4. everything else

    Use dual-read during cutover. Firebase Auth stays as the identity provider.
    The browser's direct Firestore read in `AuthContext.jsx:235` becomes an API
    call.

---

## 12. Code changes (files, by importance)

| File | Change |
|---|---|
| `backend/main.py` | Remove Redis/RQ setup and the production Redis requirement (`:699-870`, `:836`, `:842`, `:863`). Rewrite `_check_rate` (`:2174`), export/process slots (`:2236-2370`), idempotency and payment idempotency (`:1898-2077`; the Firestore payment path already exists), `_persist/_load_export_job` (`:1826-1895`), upload owner/meta/duration caches (`:2529-2665`), analytics counters and latency lists (`:1412-1545`, move to DynamoDB daily counters or drop), and scheduled-job claims (`:994`). Remove `_publish_queue_metrics_once`, the APScheduler loops, `_transcription_dispatch_loop`, and the `/api/upload` proxy path. Make `MEDIA_SCRATCH_DIR` default to `/tmp` on Lambda. |
| `backend/job_state.py` | Keep the transition table. Replace the Lua compare-and-set with a DynamoDB conditional `UpdateItem` on `revision`. |
| `backend/queue_admission.py` | Replace with the admission transaction (§10). |
| `backend/upload_admission.py` | Replace the Lua reservation with a DynamoDB transaction (active set + byte sum + hourly window). |
| `backend/provider_health.py` | Move the circuit breaker and half-open probe lease to conditional DynamoDB updates. |
| `backend/transcription_jobs.py`, `backend/services/media_scan_jobs.py` | Same claim/finish semantics, stored in `lekha-jobs`. Drop the `rq_job_id` probing and the scan of the outbox collection. The Streams dispatcher replaces `dispatch()`. |
| `backend/export_api.py` | `_enqueue_export_job` → admission transaction plus S3 request blob. Replace `RQRetry`, `fetch_job`, `RQWorker.all` queue predictions with job-record queries. Batch `TerminateJob` on cancel. |
| `backend/worker.py`, `backend/worker_launcher.py`, `backend/gcp_queue_metrics.py`, `backend/gcp_scale_in.py`, `backend/capacity_probe.py`, `backend/redis_config.py` | Delete. Add `backend/jobs/` entrypoints (`python -m backend.jobs.render --job-id …`) and the Lambda handlers (`dispatcher`, `scan`, `transcribe`, `reconciler`, `janitor`). |
| `backend/firebase_admin_setup.py` | Storage functions (`:107-960`) → S3: resumable create/resume/finalize/cancel → multipart; signed URLs → CloudFront; render cache; expiry deletes keyed by DynamoDB records. Firebase Auth and Firestore client code stays. |
| `backend/media_storage.py` | Make it the main storage driver: multipart, presigned parts, object tagging, CloudFront signer. Use the default AWS credential chain (IAM role, no static keys). |
| `backend/direct_upload_api.py` | New response shape: `upload_id`, `part_size`, `parts[{n,url}]`. A `complete` call that carries the ETags. |
| `backend/language_api.py` | `/api/detect-language` (`:94`) currently downloads the source and runs FFmpeg on the API. Make it run FFmpeg on a CloudFront/S3 range URL (`-t 30`), or make it an async job, so it stays under the 30-second API Gateway limit. Also give `/api/translate` a timeout under 25 s. |
| `backend/api/maintenance.py`, `backend/services/scheduler_auth.py` | Replace HTTP+OIDC maintenance routes with direct Lambda handlers invoked by EventBridge. |
| `backend/system_api.py` | Readiness without Redis or RQ workers. Check DynamoDB, S3 and the kill-switch state. Queue status comes from job records. |
| `backend/requirements.txt` / `requirements.lock` | Remove `redis`, `rq`, `apscheduler`. Keep `boto3`. Add `moto` to the test requirements. |
| `Dockerfile` | Targets: `api` (Python + static ffprobe/ffmpeg + Lambda Web Adapter), `ingest` (`api` base + ClamAV, Lambda handlers), `render` (existing, entrypoint runs one job and exits, no HTTP health server). |
| `src/lib/resilientUpload.js` | GCS `Content-Range` protocol (`:104-130`) → S3 presigned part PUTs, ETag capture, `ListParts`-based resume. |
| `src/pages/Dashboard.jsx`, `src/components/dashboard/UploadModal.jsx` | Preview from the local file blob in the uploading session (`:1060`). Use the remote signed URL only when reopening a project. |
| `src/components/dashboard/ExportPanel.jsx` | Polling backoff (2→5→10 s), a "starting renderer" state, and showing queue position and ETA. |
| `src/lib/firebase.js` | App Check provider → `ReCaptchaV3Provider` (§11 step 3). |
| `deploy/aws/terraform/*` (new), `deploy/gcp/*` | New IaC. Archive the GCP folder with a "do not apply" README. |
| `.env.example`, `deploy/gcp/runtime.env.example` | New key inventory. SSM parameter names, not values. |
| Tests | Rewrite `test_redis_config`, `test_worker_launcher`, `test_gcp_queue_metrics`, `test_upload_admission`, and the Redis mocks in `test_api_contracts` / `test_durable_workflows`. Add tests for the crash windows. |

Lambda limits to design for:

- Request and response bodies ≤ 6 MB. Large export specs go to S3 through a
  presigned PUT.
- API Gateway gives up on a request after 30 seconds, so every endpoint must
  answer in under 25 seconds.
- Cold start for the 5,000-line `main.py` is about 2–6 s. Import heavy SDKs
  (OpenAI, Sarvam, Razorpay) lazily to bring it down.

---

## 13. Redis/RQ replacement, responsibility by responsibility

| Redis/RQ responsibility today | Where it lives (code) | Replacement |
|---|---|---|
| Job queues (6 RQ queues) | `main.py:847-871` | Export: **Batch job queues** (paid/free). Scan and transcribe: **SQS** standard queues feeding Lambda. |
| Getting work onto the queue without loss | Firestore outboxes plus minute polling | **DynamoDB Streams outbox → dispatcher Lambda.** A committed job record always triggers dispatch. The 15-minute reconciler re-dispatches anything stuck in `queued` with no `dispatched_at`. |
| Export job state (authoritative) | Redis `export_job:{id}` + Lua compare-and-set (`job_state.py`) | `lekha-jobs` item. Conditional `UpdateItem` (`revision = :r AND status IN allowed`). Large payloads in S3. TTL 7 days on the item. |
| Transcription and scan job state | Firestore | Same `lekha-jobs` table, `job_type` attribute. Existing semantics (incl. `unknown`) kept. |
| Retries | `RQRetry(max=3, interval=[10,30,60])` | Batch `retryStrategy` (attempts 2; `evaluateOnExit`: retry infrastructure/Spot failures, exit on app error codes). SQS visibility timeout + `maxReceiveCount` 3 → DLQ. **Paid provider calls are never retried automatically** (claim fence). |
| Delayed jobs / `with_scheduler` | RQ scheduler | SQS `DelaySeconds` (≤15 min) for ingest backoff. Batch requeues directly. EventBridge Scheduler one-off schedules if a longer delay is ever needed. |
| Worker concurrency | Number of VMs/workers, `MAX_CONCURRENT_RENDERS` | Batch compute environment `maxvCpus`. Lambda reserved concurrency + ESM `MaximumConcurrency`. |
| Rate limiting (sliding window Lua) | `main.py:2158-2200` | DynamoDB fixed-window counters: `UpdateItem ADD n :1` with `n < :limit`, two adjacent windows for smoothing, TTL. **Fail-closed** in production, as today. Coarse per-route throttles in API Gateway. |
| Admission control (queue count + predicted work) | `queue_admission.py` | `control/ADMISSION#export` counters in the admission transaction (§10). |
| Upload admission (active/bytes/hourly) | `upload_admission.py` | Same limits, in a DynamoDB transaction. Session items with TTL. |
| Daily paid-AI ceiling | Firestore today | Kept. Moves to a `control/AI#{date}` counter (fail-closed). |
| Job locking / per-user export slot | `expactive:{uid}` (`main.py:2236`) | `control/LOCK#export#{uid}`: conditional put with owner `job_id` + TTL. Released conditionally on the owner. The stale-owner recovery logic is kept. |
| Per-user transcription slot | `procactive:{uid}` | Existing Firestore `operation_locks` semantics, moved to `control/LOCK#transcribe#{uid}`. |
| Duplicate-job prevention | `idem:` keys, deterministic transcription ID | `control/IDEM#…` conditional put (stores request hash → 409 on a mismatched reuse). Deterministic transcription `job_id` kept. Worker claim `queued→starting` with an attempt fence makes a duplicate Batch or SQS delivery exit straight away. |
| Payment idempotency | `pay_idem:` in Redis, **Firestore fallback already implemented** | Phase 1: the existing Firestore path (`payment_idempotency` collection, `create()` = atomic claim). Phase 6: DynamoDB conditional put. |
| Export idempotency + exactly-once credit | `idem:` + Firestore `export_usage` | Idempotency in DynamoDB. **Credit debit stays in the existing Firestore transaction** keyed by `job_id`. Phase 6: DynamoDB `TransactWriteItems` (usage item `attribute_not_exists` + `credits >= 1`). |
| Status polling | Redis GET → Firestore fallback | DynamoDB strongly consistent `GetItem` through the API. Queue position from a GSI (`queue#status`, `queued_at`). |
| Failure recovery | Redis-RQ failed registry + `_reconcile_export_job` | EventBridge Batch state-change rule → reconciler Lambda (event-driven). 15-minute sweep for stuck `starting`/`running` with an expired heartbeat. SQS DLQ → mark failed. Dead-letter payloads go to S3 `dead-letter/` (replaces the local `DEAD_LETTER_DIR`). |
| Cancellation | State flag + RQ | `cancel_requested` on the job item. The worker checks it between stages. Batch `TerminateJob` for running tasks. A queued job is cancelled in place. |
| Provider circuit breaker | `provider_health.py` Redis hash + probe lease | `control/BREAKER#{provider}` with conditional updates and a probe-lease attribute. |
| Upload owner / metadata / duration cache | `upload_owner:`, `upload_meta:`, `upload_duration:` | Already authoritative in Firestore `uploads`. Phase 1 drops the Redis cache (Lambda can cache per container). Phase 6 moves it to DynamoDB. |
| Scheduled-job singleton lock | `scheduled:{name}` | EventBridge Scheduler + Lambda **reserved concurrency 1** for the janitor/reconciler. |
| Worker launch leases | `worker_launcher.py` | Not needed: Batch owns task lifecycle. |
| Worker heartbeat/readiness | RQ worker keys | `heartbeat_at` on the job item, written by the task every 30 s. |
| Analytics counters and latency samples | Redis hashes/lists | Daily counter items in DynamoDB (`UpdateItem ADD`), with event logs kept for 14 days. Use API Gateway's free built-in latency metrics instead of the sample lists. No custom CloudWatch metrics, which cost about ₹28 per metric per month. |
| Telemetry queue | `_enqueue_telemetry` | Direct writes after the response (Lambda has CPU until the handler returns), or drop non-essential events. |

---

## 14. R2 vs S3 decision

Per-export flows: browser → storage (upload); storage → scan, transcribe and
render (3 reads); render → storage (1 write); storage → user (source preview +
2 output downloads). Monthly mix: 20% small / 70% typical / 10% 4K-large
(average ≈ 274 MiB downloaded per export).

| Monthly exports | User download volume | **S3 + CloudFront** download cost | **R2** download cost | AWS→R2 transfer (render output leaves AWS) | R2 total extra | Cheaper |
|---|---|---|---|---|---|---|
| 1,000 | 268 GB | ₹0 (inside the free 1 TB) | ₹0 | 73 GB, inside AWS's free 100 GB | ≈ ₹10 | Tie |
| 3,000 | 803 GB | ₹0 | ₹0 | 220 GB → ₹1,280 | ≈ ₹1,300 | **S3** |
| 10,000 | 2.7 TB | ₹17,100 | ₹0 | 732 GB → ₹6,700 | ≈ ₹6,700 | **R2 by about ₹10k** |

Other factors:

- **Latency:** S3 Mumbai is next to Fargate. R2 is served from Cloudflare's APAC
  locations, so every worker read crosses clouds.
- **Simplicity:** one IAM model, no long-lived R2 access keys in workers, S3
  gateway endpoint.
- **Presigned multipart:** both support it.
- **Lifecycle and tags:** both, but IAM tag conditions (`scan=clean`) exist only
  on S3.
- **Egress risk:** R2 has none. S3 has none up to 1 TB through CloudFront.

**Decision: S3 + CloudFront now.** Keep storage behind the `media_storage.py`
interface. Revisit R2 **only for export delivery**, writing finished files to
R2, once CloudFront traffic stays above about 1 TB a month for two months. By
then revenue is roughly ₹50k+ a month, and the switch is a configuration change
on one code path.

---

## 15. AWS Batch vs plain ECS RunTask

| | AWS Batch on Fargate | ECS RunTask |
|---|---|---|
| Queue when capacity is full | **Built in** (RUNNABLE, free) | None. RunTask fails or you build a queue. |
| Hard concurrency cap | **`maxvCpus` per compute environment** | Write your own (count running tasks, race-prone) |
| Priorities | Job queue priority, shared compute environments | Write your own |
| Retries and timeouts | `retryStrategy`, `evaluateOnExit`, `attemptDurationSeconds` | Write your own |
| State-change events | EventBridge | EventBridge |
| Start latency | Scheduling adds about 10–40 s | Faster, about 30–60 s total |
| Service fee | None | None |
| Idle cost | ₹0 | ₹0 |

**Decision: Batch.** The hard `maxvCpus` cap and the free, durable queue are
exactly the protections this project needs. Building them on top of RunTask
would reproduce what RQ and Redis did. The extra 10–40 s of start-up is
acceptable for an export that already takes 1–3 minutes.

Other options considered and rejected:

- **Step Functions:** not needed for two linear steps.
- **Lambda for rendering:** about 3× the cost per vCPU, Chromium is awkward to
  run there, and 4K jobs can pass 15 minutes.
- **ECS services or EC2:** they bill while idle.

---

## 16. Fargate vs Fargate Spot

Spot is billed per second at roughly 60–70% off. AWS can reclaim a task with a
2-minute warning.

| Work | Spot? | Why |
|---|---|---|
| Free-tier ≤1080p exports | **Yes (phase 5)** | Idempotent: deterministic output key, credit taken only at completion, and the claim fence stops double work. Batch retries on interruption. Free users accept extra wait. |
| Paid exports | No, on-demand | A predictable wait is part of what they pay for. Saves only about ₹0.5 per export. |
| 4K / long exports | No | A late interruption throws away up to 15 minutes of work, so the saving disappears after one retry. |
| Scan / transcription | n/a (Lambda) | Paid provider calls must never be replayed automatically. |
| Payments, webhooks, API | n/a (Lambda) | Never on interruptible capacity. |

Setup when enabled:

- Job queue `export-free` → compute environment order `[FARGATE_SPOT (maxvCpus 8), FARGATE (maxvCpus 4)]`.
- `retryStrategy.attempts = 3`.
- The worker handles SIGTERM by marking the job `retrying` and exiting cleanly.
- The reconciler moves free-tier jobs that sit RUNNABLE on Spot for more than
  10 minutes to on-demand.

Check that Fargate Spot is offered in ap-south-1 for the chosen CPU
architecture before turning this on.

---

## 17. Performance design

| Topic | Recommendation |
|---|---|
| Fargate sizes | ≤1080p: **4 vCPU / 8 GB**. 4K: **8 vCPU / 16 GB**. These are valid Fargate pairs. GCP used 4 vCPU / 12 GB. Measure peak RSS in the pilot and size to p99 × 1.3. Ephemeral storage: the free 20 GB, raised to 30 GB only for 4K. |
| FFmpeg | libx264 `veryfast` already in use. Rendering is CPU-bound, so roughly linear in vCPUs up to about 8. 4 vCPU is the best value for ≤1080p. |
| Chromium memory | About 0.5–1.5 GB at 1080p, about 2–4 GB at 4K. One browser per task, reused for the whole job (existing `render_browser_daemon.mjs` / `RENDER_BROWSER_REUSE=1`). Never keep a browser across jobs, because there is no persistent worker. Fargate has no `--shm-size`; the code already passes `--disable-dev-shm-usage`. |
| Chromium sandbox | Fargate cannot grant `SYS_ADMIN`, so expect `--no-sandbox`. Mitigations: tasks hold a single customer's job, templates go through the existing sanitizer, the task role is scoped, and there is no inbound network. Test this explicitly in the pilot. |
| Worker start time | Expect about 60–120 s from submit to running. Reduce it with: a smaller image (`chromium-headless-shell`, no dev deps, only catalog fonts; target < 1.2 GB compressed), a SOCI index for lazy pulls, and same-region ECR. Fargate does not cache images between tasks, and the pull time is billed. |
| Fonts | Keep packaged fonts (`RENDER_FONT_BUNDLE_REQUIRED=1`). Remove the runtime Google Fonts download path in `_ensure_font` from production renders. |
| Transcription parallelism | Lambda concurrency 1 (pilot) → 3 (launch), bounded by Sarvam/OpenAI rate limits and the AI ledger. One active transcription per user (existing). |
| Concurrent exports | 2 (pilot) → 4 (launch) through `maxvCpus`. Raise when queue waits show real demand. |
| Queue priority | Paid queue priority 100, free queue 10, sharing the on-demand compute environment. |
| Retries | Infrastructure or Spot failure: retry (max 2). Bad input or validation (exit code 2): no retry. Timeout: fail, no retry, refund through "no credit charged". |
| Render cache | Keep the deterministic render cache (`rendering/cache.py`) in S3 `render-cache/` with a 3-day lifecycle. A repeat export of an unchanged project skips Fargate entirely. |

---

## 18. Monthly cost scenarios

Same mix and assumptions as §8 and §14. ₹ before GST. On-demand rendering
unless a row says otherwise. One transcription per export.

| Scenario | AWS compute (render + Lambda + API) | Storage + requests + logs + fixed | Downloads | **AWS total** | Providers (Sarvam/OpenAI) | **All-in + 18% GST** | Per export |
|---|---|---|---|---|---|---|---|
| Zero users | ₹0 | ₹70–150 | ₹0 | **₹70–150** | ₹0 | **₹85–180** | — |
| 10 exports | ₹17 | ₹71 | ₹0 | **₹88** | ₹5 | **₹110** | — (idle cost dominates) |
| 100 exports | ₹169 | ₹79 | ₹0 | **₹249** | ₹48 | **₹350** | ₹3.5 |
| 1,000 exports | ₹1,691 | ₹162 | ₹0 (268 GB < 1 TB free) | **₹1,853** | ₹482 | **₹2,755** | ₹2.8 |
| 1,000 (70% Spot) | ₹997 | ₹162 | ₹0 | **₹1,159** | ₹482 | **₹1,937** | ₹1.9 |
| 10,000 exports | ₹18,460 | ₹985 | **₹17,104** (2.7 TB) | **₹36,549** | ₹4,817 | **₹48,810** | ₹4.9 |
| 10,000 (70% Spot) | ₹11,523 | ₹985 | ₹17,104 | **₹29,612** | ₹4,817 | **₹40,625** | ₹4.1 |

For comparison, the old GCP design cost about ₹40k a month gross with almost no
users. On this design, ₹40k a month only happens at about 10,000 exports a
month, which is about ₹1.5–2 lakh of revenue at current plan prices. At
10,000 exports, R2 for export delivery (§14) would save about ₹10k a month.

---

## 19. Final recommended production architecture

**Frontend:**
- Cloudflare Pages for `app.lekhacaptions.com`.
- Marketing site unchanged.

**API:**
- API Gateway HTTP API with route throttles, then a single Lambda (container
  image, FastAPI via Lambda Web Adapter, not in a VPC, reserved concurrency 10).
- Firebase Authentication for identity.
- App Check with reCAPTCHA v3.

**State:**
- DynamoDB on-demand (`lekha-jobs`, `lekha-control`), with maximum throughput
  set, TTL and PITR. This replaces all of Redis.
- Firestore keeps users, credits, payments and projects until phase 6.

**Media:**
- Private S3 bucket in ap-south-1, browser-direct multipart uploads with
  per-part signed sizes.
- Tag-gated access (`scan=clean`), lifecycle expiry, and the hourly janitor for
  plan retention.
- CloudFront signed URLs (OAC) for downloads.

**Work:**
- DynamoDB Streams → dispatcher Lambda (the only component that may start
  compute).
- **Ingest:** SQS → scan Lambda (ffprobe + ClamAV) and transcribe Lambda (FFmpeg
  + Sarvam/Whisper).
- **Export:** AWS Batch (paid and free job queues) → Fargate on-demand
  (4 vCPU / 8 GB; 4K at 8 vCPU / 16 GB), `maxvCpus` 8 → 16. One job per task;
  the task exits when the job finishes.

**Reliability:**
- Conditional state machine with attempt fences and heartbeats.
- Batch retry policy; SQS DLQs.
- EventBridge Batch-state reconciler, plus a 15-minute safety sweep.
- Exactly-once credit and payment transactions.

**Networking:**
- No NAT, no load balancer, no Elastic IPs, no interface endpoints.
- Render tasks in public subnets with no inbound access; S3 and DynamoDB
  gateway endpoints.

**Security:**
- One IAM role per function or task, least privilege.
  - Only the API role can sign upload URLs.
  - Only the transcribe role can read provider keys.
  - Only the API role can read Razorpay keys.
  - The render role can only read `uploads/*` objects tagged `scan=clean` and
    write `exports/*`.
- Secrets in SSM Parameter Store.
- Block Public Access on, TLS-only bucket policy, SSE-S3.

**Cost guard-rails:**
- Workload-account SCP deny-list.
- Terraform forbidden-resource CI check.
- Admission transaction with daily spend ledger.
- Platform concurrency caps.
- Daily and monthly Budgets, with a Budget Action that denies new work.
- Anomaly Detection.
- A tested kill-switch Lambda.

**Rule written at the top of `deploy/aws/README.md`:** *No resource that bills
by the hour may be added without a documented zero-user monthly cost and the
owner's written approval.*

---

## Risks and open items

| Risk | Impact | Mitigation |
|---|---|---|
| Firebase project unusable because the old billing account is closed | Sign-in or user data unavailable | Gate 0 check and export now. Cognito/DynamoDB fallback (§11). |
| reCAPTCHA Enterprise App Check needs billing | All protected calls fail if enforcement is on | Switch to the v3 provider or Turnstile before cutover |
| Lambda payload (6 MB) and API Gateway time limit (30 s) | Large export specs, `detect-language` and `translate` can fail | S3 handoff for large specs. Async or ranged detect-language. |
| Chromium on Fargate needs `--no-sandbox` | Weaker isolation if a template could inject script | Existing sanitizer, single-tenant tasks, scoped role, no inbound. Pilot test. |
| ClamAV default `MaxFileSize`/`MaxScanSize` (25/100 MB) only partly scan large videos | False sense of safety | Set explicit limits. Treat `ffprobe` container and stream validation as the main media gate. Never serve sources with an executable content-type. |
| A new account's Fargate vCPU quota may be below 16 | Fewer concurrent renders | Request exactly what `maxvCpus` needs, no more |
| Cold starts (API 2–6 s, render 60–120 s) | Slower first request after idle | Lazy imports. A "starting" UI state. Accept: this is the price of ₹0 idle cost. |
| Billing data lags | Alerts arrive late | Architectural caps (layers 1–5) do the limiting. Budgets are only the backstop. |
| Migration regressions in a 5,000-line `main.py` | Payment and credit bugs | Keep the Firestore payment/credit transactions unchanged in phase 1. Contract tests plus new crash-window tests. |
| Data location and privacy policy | Compliance | Update the privacy policy's sub-processors (AWS Mumbai, Cloudflare). Data stays in India. |
| The ₹/USD rate and AWS India (AISPL) INR pricing differ from these planning rates | ±10% on estimates | Use the AWS Pricing Calculator for ap-south-1 at Gate 2 |

## Price inputs (planning rates; verify in the AWS Pricing Calculator before approval)

₹95/USD planning rate (same as `docs/CLOUD_COST_DECISION_2026-09-29.md`). GST is
18% on top. AWS India accounts are billed by AISPL in INR.

| Item | Rate used (ap-south-1 unless noted) |
|---|---|
| Fargate x86 on-demand | $0.04256 per vCPU-hour, $0.00467 per GB-hour. Per second, 1-minute minimum. Image pull time is billed. |
| Fargate Spot | Modeled at 40% of on-demand |
| Public IPv4 | $0.005 per hour while attached |
| Lambda (x86) | $0.0000166667 per GB-second, $0.20 per million requests. Always free: 400k GB-seconds and 1M requests a month. |
| API Gateway HTTP API | ≈ $1.00 per million requests |
| SQS | $0.40 per million requests. 1M a month free. |
| DynamoDB on-demand | ≈ $0.71 per million writes, $0.14 per million reads. 25 GB storage free. Stream reads by Lambda free. |
| S3 Standard | $0.025 per GB-month. PUT $0.005 per 1k. GET $0.0004 per 1k. Same-region transfer to Fargate/Lambda free. |
| Internet downloads | CloudFront India ≈ $0.109 per GB after 1 TB a month free. S3 direct ≈ $0.109 per GB after 100 GB a month free. |
| CloudWatch Logs | ≈ $0.67 per GB ingested (5 GB free). Retention 14 days. |
| ECR | $0.10 per GB-month |
| Sarvam STT | ₹30 per audio hour. Whisper $0.006 per minute. |

Cost model script used for every number in §8, §9, §14 and §18: the formulas
are in §8. Rerun them with the pilot's measured seconds before approving
production limits.
