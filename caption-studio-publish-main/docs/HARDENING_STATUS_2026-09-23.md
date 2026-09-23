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
- API and worker managed groups are pinned to runtime secret version **27**.
  The replacement templates preserve the existing immutable application image
  digests, private network, machine sizes, and zero-unavailable update policy.
- The old Railway production `web` service contains a live Razorpay key pair,
  webhook secret, and HTTPS Sentry DSN. The live key pair passed a read-only
  Razorpay orders API check. Credentials are not copied into this repository.
- GCP runtime secret version **27** holds those Railway values and preserves
  the other fields from version 26. Both active managed-group templates pin it;
  a non-sensitive verification confirmed its Razorpay key is live mode and its
  Sentry DSN is present.
- `lekha-frontend-sentry-dsn` version **1** holds the public DSN from runtime
  version 27. Cloud Run revision `lekha-frontend-staging-00015-fbq` serves a
  frontend image built from its immutable digest and has a nonempty public
  Sentry runtime configuration.

## Remaining production gates

1. Confirm the reported Razorpay real transaction, webhook, replay, and
   refund/reconciliation evidence is retained with the release record. The
   runtime is now pinned to the supplied live credentials.
2. Trigger and confirm an intentional sanitized frontend exception in the
   configured Sentry project. The deployed page now receives its DSN.
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
p95, and p99 journey and export times. It deletes test media after each
journey and exits nonzero if any journey fails.
