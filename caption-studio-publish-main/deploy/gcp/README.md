# Google Cloud staging deployment

This deployment keeps the existing production traffic unchanged while a full
Google Cloud staging release is tested. The existing Netlify frontend and
Railway backend remain available until the final DNS cutover is signed off.

Current staging endpoints:

- Frontend/editor: `https://lekha-frontend-staging-602676673096.asia-south1.run.app`
- API: `https://34-93-113-193.sslip.io`

Deployed snapshot (verified 2026-09-08):

- Project: `project-0cc7c839-b9c7-4734-ad0`
- Frontend revision: `lekha-frontend-staging-00002-ljq` (100% traffic)
- Frontend image digest: `sha256:b10778a15f95a4335c872443770d5b29c74471d9d8769f1ec3930e0bc3ac88d7`
- Release: `838b28c8e10ee402fa1c1716418302a991cfee1f`
- Release version: `gcp-staging-838b28c`
- API and worker VMs: `RUNNING`; Redis: `READY`
- Budget: INR 5,000/month with 50%, 90%, and 100% alerts
- Frontend Cloud Run maximum instances: 20 (minimum remains zero)
- Cloud Monitoring: 60-second frontend and API uptime checks, with incidents
  opened after a two-minute outage
- Public ingress: HTTPS/HTTP only; the temporary TCP 8000 rule is disabled

Automated verification passed for frontend contracts, lint, TypeScript,
production build/performance budgets, public DNS, API liveness/readiness/version,
service status, browser rendering, CORS, Redis, and RQ worker startup. A real
authenticated media export and Razorpay transaction remain explicit cutover
gates because they require a disposable Firebase user/App Check session and
test-mode payment credentials. Keep production DNS on Netlify/Railway until
those owner acceptance checks pass.

## Target shape

```text
Cloud Run frontend -> HTTPS/Caddy -> API VM -> Memorystore Redis -> RQ worker VM
                                           |                    |
                                           +-> Firebase Auth / Firestore / Storage
```

The API and worker use the same Docker image. Each Compute Engine VM has an
attached disk for disposable render scratch, plus a local private ClamAV
container. Firebase Storage remains the durable location for uploads and
exports; the VM disk must never be treated as durable media storage.

Cloud Run is intentionally not used for the current deployment because the API
accepts 500 MiB HTTP/1 uploads and the renderer needs substantial FFmpeg and
Chromium scratch space. Cloud Run is used only for the static frontend.

## Prerequisites

- A Google Cloud project with active billing.
- `gcloud auth login` and `gcloud config set project PROJECT_ID` on the deploy
  machine. Do not put user credentials or service-account JSON in this repo.
- A Firebase service-account JSON value stored in Secret Manager for the initial
  migration. A later hardening change can replace it with Application Default
  Credentials.
- A staging Firebase/Auth/App Check configuration and Razorpay test credentials.
- A domain owner available later to add a staging DNS record. Do not alter
  `api.lekhacaptions.com` or Netlify DNS during this phase.

## First-time staging bootstrap

Use an India region unless latency or compliance requirements say otherwise:

```powershell
$project = "PROJECT_ID"
$region = "asia-south1"
$repository = "caption-studio"

gcloud config set project $project
gcloud services enable artifactregistry.googleapis.com cloudbuild.googleapis.com compute.googleapis.com redis.googleapis.com secretmanager.googleapis.com
gcloud artifacts repositories create $repository --repository-format=docker --location=$region
gcloud iam service-accounts create lekha-runtime --display-name="Lekha runtime"
gcloud projects add-iam-policy-binding $project --member="serviceAccount:lekha-runtime@$project.iam.gserviceaccount.com" --role="roles/artifactregistry.reader"
gcloud projects add-iam-policy-binding $project --member="serviceAccount:lekha-runtime@$project.iam.gserviceaccount.com" --role="roles/secretmanager.secretAccessor"
```

Create a staging runtime secret from a local, untracked file based on
`runtime.env.example`:

```powershell
gcloud secrets create lekha-staging-runtime --replication-policy=automatic
gcloud secrets versions add lekha-staging-runtime --data-file=PATH_TO_UNTRACKED_RUNTIME_ENV
```

Create a Basic-tier Memorystore Redis instance on private networking. Use its
private endpoint as `REDIS_URL`, for example `redis://10.x.x.x:6379/0`. Do not
reuse Railway Redis for staging or production migration.

For the currently provisioned staging project, `finalize-staging.sh` completes
the Redis/secret/VM handoff and verifies the public staging health endpoint. It
is idempotent and keeps the Netlify and Railway production services untouched.

## Build the image

```powershell
$image = "$region-docker.pkg.dev/$project/$repository/lekha-captions"
gcloud builds submit --config=cloudbuild.yaml --substitutions="_IMAGE_URI=$image" .
```

Record the resulting immutable SHA tag. Do not deploy the mutable `staging` tag
to production.

## Create the two staging VMs

Create one API VM and one worker VM, both initially `e2-standard-4` with a
100 GiB balanced persistent disk. The worker is CPU/memory-intensive; keep one
concurrent render per worker until real media tests establish a safe limit.

Pass `deploy/gcp/gce-startup.sh` as startup metadata and set these metadata
values on each VM:

| VM | `SERVICE_ROLE` | Other metadata |
| --- | --- | --- |
| API | `api` | `IMAGE_URI`, `RUNTIME_SECRET=lekha-staging-runtime`, `REGION` |
| Worker | `worker` | `IMAGE_URI`, `RUNTIME_SECRET=lekha-staging-runtime`, `REGION` |

Attach the `lekha-runtime` service account. Give the API an external address
only for the temporary staging endpoint; keep the worker private. Restrict the
API firewall rule to TCP 8000 from the staging load balancer or operator IPs.
Before production, replace this temporary exposure with a managed HTTPS load
balancer, health check at `/api/health/readiness`, and a managed certificate.

The current staging VM instead reserves `34.93.113.193` and runs Caddy beside
the API container. Caddy terminates HTTPS for `34-93-113-193.sslip.io`; only
ports 80/443 are public and the original port-8000 firewall rule is disabled.

## Deploy the staging frontend

Build the Vite app with the HTTPS staging API as `VITE_API_BASE_URL`, the normal
Firebase browser configuration, the App Check site key, legal identity fields,
and the same 40-character release SHA as the backend. Package `dist/` together
with `deploy/gcp/frontend/Dockerfile` and
`deploy/gcp/frontend/nginx.conf`, then build and deploy it:

`deploy/gcp/frontend-release/cloudbuild.yaml` accepts an optional
`_SENTRY_DSN` substitution. Leave it unset to use the first-party sanitized
frontend exception endpoint, or pass the public browser DSN when a Sentry
project is configured.

```bash
gcloud builds submit FRONTEND_PACKAGE_DIR \
  --tag=asia-south1-docker.pkg.dev/PROJECT_ID/caption-studio/frontend:RELEASE
gcloud run deploy lekha-frontend-staging \
  --image=asia-south1-docker.pkg.dev/PROJECT_ID/caption-studio/frontend@IMAGE_DIGEST \
  --region=asia-south1 --allow-unauthenticated --port=8080 \
  --cpu=1 --memory=512Mi --concurrency=80 --min=0 --max=20
```

Add the resulting `run.app` hostnames to both Firebase Authentication's
authorized domains and the reCAPTCHA Enterprise/App Check key's allowed
domains. Append the frontend origins to the backend's `ALLOWED_ORIGINS` secret
before restarting the API VM.

## Required staging verification

1. Confirm API and worker `/api/version` release metadata match the same image.
2. Confirm API readiness sees Firebase, storage, Redis, scanner, scratch space,
   and a matching worker.
3. Run a real authenticated short-video flow using `scripts/staging_smoke.py`.
4. Test upload interruption, worker restart during render, Redis restart, full
   scratch-disk response, and ClamAV unavailability.
5. Test the Razorpay test-mode order, webhook, replay, and refund/reconciliation
   paths with the staging API URL.
6. Set a Google Cloud budget alert before raising traffic beyond this test phase.

## Cutover rule

Do not point `api.lekhacaptions.com` at Google Cloud until the staging checks
pass. At cutover, pause new work, drain Railway workers, start matching Google
Cloud workers, validate the new API, then change DNS. Never allow the Railway
and Google Cloud workers to consume the same Redis queue during the transition.
