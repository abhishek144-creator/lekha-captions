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

1. **Project and APIs.** Create the project on the approved billing account and
   enable Artifact Registry and Cloud Build. Terraform enables the rest.
2. **Runtime identity.** Create a service account (for example `lekha-runtime`).
   Terraform grants it only what it needs: the media bucket, the runtime secret
   and permission to start the two worker jobs.
3. **Redis.** Create a pay-per-use serverless Redis over TLS and follow
   `../../docs/SERVERLESS_REDIS_SWITCH.md`. Put its `rediss://` URL in `REDIS_URL`.
4. **Runtime secret.** Copy `runtime.env.example` to an untracked file, fill it
   in, then:
   ```powershell
   gcloud secrets create lekha-runtime-env --replication-policy=automatic
   gcloud secrets versions add lekha-runtime-env --data-file=PATH_TO_UNTRACKED_RUNTIME_ENV
   ```
   Note the numeric version; Terraform never uses `latest`.
5. **Images.** Build the three role images from the repository root and pin
   their digests:
   ```powershell
   gcloud builds submit --config=cloudbuild.yaml --substitutions="_RELEASE_SHA=FULL_SHA,_API_IMAGE_URI=...,_TRANSCRIPTION_IMAGE_URI=...,_RENDER_IMAGE_URI=..."
   ```
   The transcription image bakes in ClamAV signatures at build time; rebuild at
   least weekly so they stay current.
6. **Infrastructure.** In `terraform/`, copy `terraform.tfvars.example` to the
   ignored `terraform.tfvars`, fill it in, then `terraform init`,
   `terraform plan -out=plan.tfplan`. Review the saved plan: it must contain no
   Compute Engine instances, Memorystore, NAT, load balancer or reserved IP.
   Apply only after the owner approves. See `terraform/README.md`.
7. **URL signer.** Put `terraform output -raw gcs_signing_service_account` into
   `GCS_SIGNING_SERVICE_ACCOUNT`, add a new secret version, set
   `runtime_secret_version` to it and apply again.
8. **Frontend.** Deploy Firebase Hosting with `VITE_API_BASE_URL` set to
   `terraform output -raw api_uri`:
   ```powershell
   gcloud builds submit . --config=deploy/gcp/firebase-hosting/cloudbuild.yaml --substitutions="_VITE_API_BASE_URL=API_URI,..."
   ```
   Provide every `_VITE_*` and `_RELEASE` substitution the build declares. Add
   the hosting domain to Firebase Authentication's authorized domains, the App
   Check key's allowed domains and `ALLOWED_ORIGINS`.

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
