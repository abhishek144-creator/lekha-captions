# Google Cloud deployment (pay-only-when-used)

This is the only supported Google Cloud setup. The old always-on design (API and
render VMs, Memorystore Redis, Cloud NAT, load balancer, every-minute scheduler
calls) caused the September 2026 bill and was removed on 2026-09-29; it survives
only in git history and the dated notes in `../../docs/`. Never rebuild it.

```text
Firebase Hosting (static app)
        |
        v
Cloud Run API (0..2 instances, billed per request) --+--> serverless Redis (TLS, pay per command)
   |  starts jobs only when a queue has work         +--> Firebase Auth / Firestore
   v                                                 +--> private media bucket
Cloud Run Jobs: lekha-render, lekha-transcription (exit after 2 idle minutes)
        ^
Cloud Billing budget -> Pub/Sub -> API /api/maintenance/budget-alert
                                   (pauses uploads, transcription, exports)
```

Idle cost is storage, secrets, a few scheduler calls and logs. Compute costs
money only while an API request or a worker job is running.

## Rules before creating anything

Read `../../DEVELOPMENT_LOG.md` (cost gate, 2026-09-28 billing incident) and
`../../docs/GCP_DEPLOYMENT_PROMPT.md` first. Then show the owner a written
estimate for idle and peak monthly spend and get explicit approval **before**
any paid resource exists. Use a new Google account/project; never reopen the
retired project or billing account.

## Steps

1. **Project, APIs and image registry.** Create the project on the approved
   billing account, enable Artifact Registry and Cloud Build (Terraform enables
   the rest), and create the Docker repository the images are pushed to:
   ```powershell
   gcloud services enable artifactregistry.googleapis.com cloudbuild.googleapis.com
   gcloud artifacts repositories create lekha --repository-format=docker --location=asia-south1
   ```
   Image URIs then look like `asia-south1-docker.pkg.dev/PROJECT_ID/lekha/api`.
   If a build can't push, grant the build's service account Artifact Registry
   Writer on this repository only.
2. **Firebase (sign-in, user database, credits).** These live in a Firebase
   project, separate from this Cloud project. Choose one:
   - **Keep the existing Firebase project** (keeps every account and credit
     balance): its current owner adds the new Google account as Owner in the
     Firebase console, then the service-account JSON and web config below come
     from that project. Check which billing account it is linked to first.
   - **New Firebase project** (users start over): create it on the new account,
     enable Authentication (Google + email), Firestore and App Check, deploy
     `firestore.rules`, `firestore.indexes.json` and `storage.rules`.
   Either way, put the service-account JSON in `FIREBASE_SERVICE_ACCOUNT_JSON`
   and use that project's web config for the `_VITE_FIREBASE_*` values.
3. **Runtime identity.** Create a service account (for example `lekha-runtime`).
   Terraform grants it only what it needs: the media bucket, the runtime secret
   and permission to start the two worker jobs.
4. **Redis.** Create a pay-per-use serverless Redis over TLS and follow
   `../../docs/SERVERLESS_REDIS_SWITCH.md`. Put its `rediss://` URL in `REDIS_URL`.
5. **Runtime secret.** Copy `runtime.env.example` to an untracked file, fill it
   in, then:
   ```powershell
   gcloud secrets create lekha-runtime-env --replication-policy=automatic
   gcloud secrets versions add lekha-runtime-env --data-file=PATH_TO_UNTRACKED_RUNTIME_ENV
   ```
   Note the numeric version; Terraform never uses `latest`.
6. **Images.** Build the three role images from the repository root and pin
   their digests:
   ```powershell
   gcloud builds submit --config=cloudbuild.yaml --substitutions="_RELEASE_SHA=FULL_SHA,_API_IMAGE_URI=...,_TRANSCRIPTION_IMAGE_URI=...,_RENDER_IMAGE_URI=..."
   ```
   The transcription image bakes in ClamAV signatures at build time; rebuild at
   least weekly so they stay current.
7. **Infrastructure.** In `terraform/`, copy `terraform.tfvars.example` to the
   ignored `terraform.tfvars`, fill it in, then `terraform init`,
   `terraform plan -out=plan.tfplan`. Set `frontend_origins` to every HTTPS
   origin the app is served from (for example `https://PROJECT.web.app` until a
   custom domain is connected): browsers upload straight to the bucket, and its
   CORS rule only admits these origins. Review the saved plan: it must contain no
   Compute Engine instances, Memorystore, NAT, load balancer or reserved IP.
   Apply only after the owner approves. See `terraform/README.md`.
8. **URL signer.** Put `terraform output -raw gcs_signing_service_account` into
   `GCS_SIGNING_SERVICE_ACCOUNT`, add a new secret version, set
   `runtime_secret_version` to it and apply again.
9. **Frontend.** Deploy Firebase Hosting with `VITE_API_BASE_URL` set to
   `terraform output -raw api_uri`:
   ```powershell
   gcloud builds submit . --config=deploy/gcp/firebase-hosting/cloudbuild.yaml --substitutions="_VITE_API_BASE_URL=API_URI,..."
   ```
   Provide every `_VITE_*` and `_RELEASE` substitution the build declares. The
   build writes the API origin into the hosting Content-Security-Policy
   (`scripts/set-hosting-api-origin.mjs`): Cloud Run can't map a custom domain in
   asia-south1, so the browser calls the `*.run.app` URL directly, and the
   committed CSP only allows `https://api.lekhacaptions.com`. Add the hosting
   domain to Firebase Authentication's authorized domains, the App Check key's
   allowed domains, `ALLOWED_ORIGINS` and Terraform's `frontend_origins`.
10. **Razorpay.** In the Razorpay dashboard set the webhook URL to
    `API_URI/api/razorpay-webhook` (server to server, so the CSP doesn't apply)
    with the secret from `RAZORPAY_WEBHOOK_SECRET`. Use test-mode keys until the
    checks below pass.

## Verify before real customers

1. `/api/version` on the API reports the deployed release SHA.
2. One real upload -> transcription -> export -> download works. Watch the
   worker job start, finish, and **exit** (Cloud Run -> Jobs -> executions),
   then confirm nothing is running a few minutes later (0 -> 1 -> 0).
3. Test the budget stop without spending money: publish a fake "budget spent"
   message and confirm uploads/exports pause, then resume them in the admin
   panel.
   ```powershell
   $data = '{"costAmount":1000,"budgetAmount":1000,"currencyCode":"INR"}'
   gcloud pubsub topics publish lekha-budget-alerts --message=$data
   ```
4. Razorpay test-mode order, webhook and reconciliation work against the API.
5. After a full day, check the SKU-level bill matches the estimate. Budget
   emails are warnings; the automatic stop only pauses new work, and billing
   data can lag by hours, so the hard caps are what bound the worst case.

## Files here

- `terraform/` - the whole setup (see its README).
- `runtime.env.example` - keys for the runtime secret (no values).
- `firebase-hosting/cloudbuild.yaml` - static frontend build and deploy.
- `gcs-cors.json`, `gcs-lifecycle.json` - mirrors of the bucket policy Terraform sets.
- `sync-frontend-sentry-secret.py` - copies the public Sentry DSN into a build secret.
- `COST_ACCOUNTING.md` - reconciling exports with the actual bill.
