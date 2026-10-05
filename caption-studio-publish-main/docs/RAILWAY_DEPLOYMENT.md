# Railway + Cloudflare R2 deployment (scale-to-zero)

Owner decision, 2026-10-03: run Lekha Captions on **Railway** with media in
**Cloudflare R2**. Firebase Auth and Firestore stay. This replaces the AWS plan
(`AWS_SERVERLESS_MIGRATION_2026-10-02.md`). The Google Cloud setup is archived
in `GCP_ARCHITECTURE_ARCHIVE_2026-10-02.md`.

> **Cost gate (AGENTS.md).** Nothing in this repository creates cloud
> resources. `railway config apply` and the Cloudflare steps below are paid
> actions. Only the owner runs them, after approving the estimate in §3.

## 1. What runs where

```
Browser ──HTTPS──▶ lekha-api (Railway, sleeps when idle)
   │                    │ enqueue (Redis) + POST /wake over the private network
   │                    ▼
   │          lekha-transcription ── malware scan (clamscan), OpenAI/Sarvam
   │          lekha-render ───────── Chromium + FFmpeg export
   │                    │  both sleep when their queues are empty
   │                    ▼
   └──PUT 8 MiB parts──▶ Cloudflare R2 ◀── signed GET for downloads (no egress fee)

lekha-cron (every 15 min, exits in seconds): retries, outbox recovery,
worker re-wake, R2 cleanup, payment reconciliation. It never wakes the API.
redis (Railway database): the only always-on piece (~50 MB RAM).
Firebase Auth + Firestore: unchanged.
```

| Service | Image (`LEKHA_SERVICE_TARGET`) | Sleeps | Cap (vCPU / RAM) | Start |
|---|---|---|---|---|
| `lekha-api` | `api` | yes | 1 / 2 GiB | uvicorn, 1 process |
| `lekha-transcription` | `transcription` | yes | 2 / 2 GiB per replica, 1–3 replicas | `python3 -m backend.worker` (wake server on 8080) |
| `lekha-render` | `render` | yes | 4 / 4 GiB per replica, 1–6 replicas | render browser daemon + worker |
| `lekha-cron` | `api` | n/a (cron) | 1 / 1 GiB | `python3 -m backend.railway_cron`, `*/15 * * * *` |
| `redis` | Railway Redis | no | n/a | n/a |

All of this is declared in `.railway/railway.ts` (Railway Infrastructure as
Code; `railway.json` is deprecated and new services cannot use it).

### How idle works

- Railway sleeps a service 5–10 min after its **last outbound packet**, and wakes
  it on any public or private-network request.
- The API runs with `RUN_API_BACKGROUND_TASKS=0`, so no loop polls Firestore or
  Redis. Telemetry is flushed on the request path.
- After an enqueue, the API POSTs `/wake` (header `X-Worker-Wake-Secret`) to the
  worker's private URL. A Redis lease per worker prevents duplicate wakes.
- A woken worker drains its queues in RQ burst mode and waits for retries due
  within 330 s. It then releases the lease, disconnects from Redis and goes quiet.
- The cron pass covers anything that slipped through:
  - due RQ retries;
  - outbox jobs Redis never received;
  - a worker whose wake request was lost.

  It wakes a worker only when that worker has a backlog.
- Cold start: the first request to a sleeping service can take several seconds
  or return 502. The wake client treats 502/503/504 and timeouts as delivered.

## 2. Code changes made for Railway

- `backend/worker.py`, `backend/worker_launcher.py`: wake-on-HTTP workers that drain and go idle; graceful SIGTERM (RQ finishes the running job and frees the lease).
- `backend/railway_cron.py`: the cron pass. Each step is independent, and a failed step marks the run failed in Railway.
- Direct browser → R2 multipart uploads:
  - `backend/media_storage.py`, `backend/firebase_admin_setup.py`, `backend/direct_upload_api.py` and `src/lib/resilientUpload.js`;
  - fixed 8 MiB parts with signed `Content-Length`, 3 parts in parallel;
  - resume by `ListParts`; size checks before completion; cancel and the janitor abort unfinished uploads.
- `Dockerfile`:
  - the final stage is chosen per service;
  - API/transcription images include `clamscan` with signatures copied from `clamav/clamav-debian:stable`, so the build does not depend on ClamAV's rate-limited CDN.

## 3. Cost estimate (needs owner approval)

Check current rates at railway.com/pricing and cloudflare.com/plans before
approving. The rates used here: Hobby **$5/month**, including $5 of usage;
RAM $10/GB-month; CPU $20/vCPU-month; Railway egress $0.05/GB. R2 is free up to
10 GB-month storage, 1 M writes and 10 M reads, with no egress fee.

| Situation | Railway usage | R2 | Expected bill |
|---|---|---|---|
| Idle month, no users | Redis ≈ $0.7, cron ≈ $0.3 | $0 | **$5** (the Hobby minimum covers it) |
| 1,000 exports/month | + workers awake ≈ 10 min per burst, ≈ $3–6; export upload egress ≈ $2.5 | $0 (under 10 GB with the lifecycle rules) | **≈ $8–14** |
| Runaway/abuse | capped by service limits and the hard usage limit | capped by 500 MiB uploads and lifecycle | **≤ the hard limit you set** |

Fixed resources: 4 services, 1 Redis, 1 R2 bucket. There are no load balancers,
NAT gateways, VMs or minimum instances. AI provider spend is separate, and
`AI_SYSTEM_DAILY_LIMIT=2000` caps it (at OpenAI Whisper's $0.006/minute, at most
about $36/day for 3-minute uploads; check the Sarvam rate too).

### Spend limits (set all of them before going live)

1. **Railway → Workspace → Usage → Hard limit**: e.g. **$15**. Railway stops services when it is reached.
2. Railway custom email alert at e.g. $8.
3. Per-service CPU/RAM caps (in `.railway/railway.ts`). Lower them if the plan rejects them.
4. **Cloudflare → R2 → bucket → Settings → Object lifecycle rules** (§4.3), plus a billing notification.
5. `AI_SYSTEM_DAILY_LIMIT` and the per-plan quotas (already enforced in code).

## 4. One-time setup (owner)

### 4.1 Gate 0: Firebase and App Check ✅ (verified 2026-10-03)

- The Firebase project is on **Blaze**, with a Google billing account still linked (project cost ₹0.01 for the month at the time of the check).
- The owner confirmed sign-in, the dashboard and the App Check token exchange (HTTP 200).
- Because a card is still attached:
  - keep the Google Cloud budget alert low (≈ ₹200);
  - set ₹10 service spend caps on Cloud Run and Cloud Run Functions, which are no longer used;
  - confirm no old Compute Engine, Memorystore, load balancer or Cloud NAT resources remain.
- Optional: moving App Check to reCAPTCHA v3 would allow downgrading the project to Spark, so Google can't charge anything.

`FIREBASE_APP_CHECK_ENFORCED=1` is required in production.

### 4.2 Cloudflare R2

1. Create bucket `lekha-media` (location hint: Asia-Pacific).
2. Create an R2 API token with **Object Read & Write**, limited to that bucket. Note the access key, secret and the S3 endpoint `https://<account-id>.r2.cloudflarestorage.com`.
3. **CORS policy** (bucket → Settings → CORS):
   ```json
   [
     {
       "AllowedOrigins": ["https://app.lekhacaptions.com", "https://lekhacaptions.com", "https://www.lekhacaptions.com"],
       "AllowedMethods": ["PUT", "GET", "HEAD"],
       "AllowedHeaders": ["content-type"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

### 4.3 R2 lifecycle rules (storage never fills up)

The app's own retention is 6 h for source uploads and 2–72 h for exports by
plan. The cron janitor deletes on schedule every 15 min. These rules are the
backstop:

| Rule | Prefix | Action |
|---|---|---|
| expire-uploads | `uploads/` | Delete objects after **2 days** |
| expire-exports | `exports/` | Delete objects after **4 days** (Pro keeps exports 72 h) |
| expire-render-cache | `render-cache/` | Delete objects after **3 days** (cache entries live at most 72 h; expired ones are also deleted when next read) |
| abort-incomplete | (all) | Abort incomplete multipart uploads after **1 day** |

### 4.4 Railway project

> ⚠️ **Use a NEW Railway project.** `railway config apply` makes the linked
> project match `.railway/railway.ts` exactly, and anything not in the file is
> **deleted**. Linked to the old `lekha-captions-staging` project, the plan
> deletes its `worker`, `Redis`, `clamav`, `web` and `lekha-media` resources.
> Never run `plan`/`apply` while linked to that project.

1. Create a **new** project named `lekha-captions`. Choose the **Hobby** plan, then set the **hard usage limit** first (§3).
2. Install the Railway GitHub app for `abhishek144-creator/lekha-captions`, and merge PR #18 into `main` (Railway builds `main`).
3. In the new project's **production** environment, create these **shared variables**. Values never go in git.

   | Purpose | Variables |
   |---|---|
   | Access and contacts | `ALLOWED_ORIGINS` (`https://lekhacaptions.com`, not localhost), `ADMIN_EMAILS`, `SECURITY_CONTACT_EMAIL`, `PRIVACY_CONTACT_EMAIL` |
   | Firebase and AI providers | `FIREBASE_SERVICE_ACCOUNT_JSON`, `OPENAI_API_KEY`, `SARVAM_API_KEY` |
   | Payments (**live** keys, not test) | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `PAYMENT_RECONCILE_SECRET` |
   | Signing secrets | `MEDIA_URL_SIGNING_SECRET`, `WORKER_WAKE_SECRET` (random, ≥ 32 chars) |
   | R2 (from §4.2) | `MEDIA_S3_ENDPOINT`, `MEDIA_S3_BUCKET`, `MEDIA_S3_ACCESS_KEY_ID`, `MEDIA_S3_SECRET_ACCESS_KEY` |

   Not needed:
   - `APP_RELEASE`, `RELEASE_VERSION` and `APP_BUILD_TIME` are filled in automatically from Railway's commit SHA and the image build time.
   - `FIREBASE_STORAGE_BUCKET` is not required when the R2 variables are set.
   - Production startup and offline preflight both require all four R2 variables on Railway; partial configuration fails with missing names instead of falling back to Firebase Storage.
   - Optional, per service in the dashboard: `SENTRY_DSN`, `SLACK_ALERT_WEBHOOK_URL`.
4. Install or upgrade the Railway CLI to **≥ 5.42.1** (`npm install -g @railway/cli@latest`), then from the repository root:
   ```bash
   npm install --prefix .railway   # the railway/iac SDK (pinned)
   railway login
   railway link                    # pick the NEW lekha-captions project / production
   railway config plan             # read-only: expect 4 services + redis + group, 0 to destroy
   railway config apply            # owner approval required: creates billable services
   ```
   If the plan shows anything to **destroy**, stop: you are linked to the wrong project.
5. Attach the custom domain `api.lekhacaptions.com` to `lekha-api` (Settings → Networking), and add the DNS record Railway shows. Workers stay private.
6. In the editor's hosting (Netlify), set `VITE_API_BASE_URL=https://api.lekhacaptions.com` and redeploy the editor.

## 5. Verification checklist

- [ ] `GET https://<api-domain>/api/health/readiness` returns 200 (Redis, Firestore and R2 reachable).
- [ ] Upload a 100 MB video. In R2, parts appear under `uploads/<uid>/`. Interrupt the network mid-upload: it resumes without re-sending the finished parts.
- [ ] A scan, transcription and export complete, and the download link is an R2 signed URL.
- [ ] `lekha-cron` logs show `cron_pass_finished` with `failed_steps: []`.
- [ ] **Sleep:** after ~10 min with no traffic, `lekha-api`, `lekha-transcription` and `lekha-render` show **Sleeping**. If one never sleeps, check its outbound traffic (Sentry, Firestore gRPC keepalives) before going live.
- [ ] **Wake:**
  - the first request after sleep succeeds within the frontend's retries;
  - a queued export completes after the render worker woke from sleep.
- [ ] After a test day, Railway → Usage shows idle cost in line with §3.

## 6. Cutover and rollback

- Cutover: point `api.lekhacaptions.com` at the Railway custom domain, add it to `lekha-api`, and update `ALLOWED_ORIGINS` and the frontend API URL.
- Rollback: the frontend's `VITE_API_BASE_URL` points back to the previous API. The GCP layout is documented in the archive doc (commit `58afb17`).

## 7. Known limits

- ClamAV signatures are as fresh as the last deploy. The image copies them at build time, so **redeploy at least weekly**, or after a ClamAV advisory.
- `clamscan` uses ~1 GB RAM for 20–40 s per scan. The API may also scan inline (language detection on a not-yet-scanned upload), which is why its cap is 2 GiB.
- Redeploying a worker mid-job: SIGTERM lets RQ finish the running job. Very long jobs may be cut at Railway's drain timeout and are then retried or marked for support by the existing job-state logic.
- Render replicas scale from 1 to `RENDER_AUTOSCALE_MAX_REPLICAS` (6), each with 4 vCPU / 4 GiB and one export. Transcription replicas scale from 1 to `TRANSCRIPTION_AUTOSCALE_MAX_REPLICAS` (3), each with 2 vCPU / 2 GiB and one transcription or malware scan. Code clamps both to at most 10.
- `EXPORT_MAX_PENDING_WORK_SECONDS` is 600 × the render maximum (3600), so admitted exports can start within the 10-minute queue-wait limit when every replica is running. If the plan cannot run six render replicas, lower both values together.
- If Railway rejects a resize (for example a plan's replica or resource limit), the controller logs `render_scaling_failed` or `transcription_scaling_failed`, keeps the current capacity and retries after 30 seconds.
- Scale-up runs on enqueue. The existing 15-minute cron is the recovery and scale-down safety net. Scale-down requires Sleeping, no queued, started or scheduled renders, no active burst leases, and a 15-minute cooldown. An atomic Redis resize guard excludes new bursts during removal.
- `RAILWAY_RENDER_SCALING_TOKEN` is an additional production-environment project token referenced only by API and cron. Workers never receive it. Missing credentials or control-plane failure preserve existing capacity and normal wake/recovery. Never deploy the owner's CLI/account credential.
- IaC declares the one-replica baseline. A plan during a busy period may propose returning dynamically added replicas to one. Wait for idle scale-down before applying that reduction.
- Railway sleeping applies across service replicas. Private DNS wake fan-out and unique replica leases let copies drain the shared queue.
- At the rates in §3, six fully utilized render replicas cost at most about $1.00/hour and three transcription replicas about $0.25/hour, excluding the other services and providers. These are ceilings, not measured costs. **The $15 hard cap is reached after roughly 12 hours of fully loaded workers: raise it (and plan for the Pro plan's limits) before a public launch.**
- Acceptance: for each worker service, verify 1-to-N patches, distinct identities, parallel disposable jobs, Sleeping and the guarded N-to-1. No mass-user load test is required.

### Worker resize shutdown safety

Railway replica changes can replace a worker deployment. Both worker services
set `drainingSeconds: 1860` and `overlapSeconds: 0` before autoscaling: the
longest RQ export and transcription timeouts are 1800 seconds. RQ finishes its current job
after SIGTERM; Railway may terminate it after the configured grace. This is
a maximum wait, not a mandatory 31-minute billable delay.

The controller refuses to resize until the latest deployment metadata confirms
the shutdown grace. New and retiring replicas of a service share an atomic
drain admission limit in Redis equal to its replica maximum, so overlapping
deployments cannot run more jobs than the maximum allows. Heartbeats renew admission; expired admissions are reclaimed. The cron
uses normal RQ started-registry cleanup to retry abandoned jobs or mark them
failed, preserving live entries and customer state.

For acceptance, begin one finite disposable job, enqueue more work while it
is running, and verify every job finishes across the resize. Verify at most
the configured maximum of active drains, then Sleeping and the guarded return
to one replica.
Keep autoscaling disabled in API and cron until this live check passes.
