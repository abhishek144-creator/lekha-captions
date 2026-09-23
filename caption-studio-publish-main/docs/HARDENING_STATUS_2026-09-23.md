# Hardening status, 23 September 2026

The earlier queue autoscaling review is no longer a description of `main`.
PRs #3 through #6 merged the CI, dependency, infrastructure, upload, and
customer error handling changes. The GitHub `release-gate` now passes and
`main` is protected. The production API still reports release
`d8824f5d998ec9daec8de31c7a803408755841de`; newer commits have not been
deployed merely because they merged.

## Verified production state

- The worker managed instance group has a 3 to 20 autoscaling range with
  queue depth and CPU signals. Its image is pre-baked, and API, render, and
  transcription images are pinned by digest.
- Redis is Standard HA. Both API and frontend backend services have the
  `lekha-edge-security` Cloud Armor policy attached.
- The live worker template is pinned to runtime secret version **26**. That
  version contains Razorpay test mode and no Sentry DSN.
- The old Railway production `web` service contains a live Razorpay key pair,
  webhook secret, and HTTPS Sentry DSN. The live key pair passed a read-only
  Razorpay orders API check. Credentials are not copied into this repository.
- GCP runtime secret version **27** holds those Railway values and preserves
  the other fields from version 26. It was read back and compared byte for
  byte. It is staged only; no instance template points to it.
- `lekha-frontend-sentry-dsn` version **1** holds the public DSN from runtime
  version 27. No frontend image has been rebuilt with it.

## Remaining production gates

1. Verify the live Razorpay webhook endpoint, event subscriptions, and signing
   secret in the Razorpay account against the GCP API route. Then perform a
   controlled real payment, webhook replay, and refund/reconciliation check
   before pinning runtime version 27. A successful read-only API call does not
   prove the webhook configuration.
2. Build a frontend release with the staged Sentry DSN, deploy it, and verify
   an intentional test exception appears in the correct Sentry project.
   Browser code already supports the DSN, but the running frontend does not
   have it yet.
3. Import existing GCP resources into Terraform state and review a no-replace
   plan. `terraform validate` passes, but definitions alone do not manage
   the existing resources.
4. Run 100 controlled authenticated upload, transcription, export, and download
   journeys with 100 disposable funded test accounts. No such token set is
   available in this workspace, so capacity has not been demonstrated.
5. Build and deploy the marketing site to apply its corrected editor CTA and
   Node 22 build setting. The code change alone does not change its live site.
6. Continue decomposing the remaining large core modules as behavior-specific
   changes are made. Extracting the queue metrics module did not complete the
   wider refactor.

## Repeatable checks

The secret staging scripts are dry-run by default. To inspect their proposed
changes without printing credentials:

```powershell
python deploy/gcp/stage-production-observability-payments.py --project project-0cc7c839-b9c7-4734-ad0 --base-version 26 --expected-release d8824f5d998ec9daec8de31c7a803408755841de
python deploy/gcp/sync-frontend-sentry-secret.py --project project-0cc7c839-b9c7-4734-ad0 --runtime-version 27
```

For the controlled journey test, put one JSON object per line in a file
**outside Git**, each with an `id_token` and optional `app_check_token`.
The tokens must be current and correspond to distinct disposable accounts
with enough test credits. Use a short MP4 with spoken audio:

```powershell
$env:ALLOW_REAL_EXPORT_BURST = '1'
python scripts/run_full_journey_burst.py --base-url https://api.lekhacaptions.com --accounts-jsonl C:\path\outside\git\accounts.jsonl --video C:\path\to\spoken.mp4 --jobs 100 --concurrency 20 --upload-path direct --confirm-controlled-load --results-json C:\path\outside\git\burst-results.json
```

The runner records success counts, individual journey durations, and p50,
p95, and p99 journey and export times. It exits nonzero if any journey fails.
