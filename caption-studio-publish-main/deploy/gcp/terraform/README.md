# Lekha Google Cloud Terraform

This directory is the source of truth for the API migration candidate, render
and transcription regional MIGs, autoscaling, Cloud NAT, health checks,
Standard HA Redis, private media bucket, immutable instance templates, and
Cloud Armor policy. Keep secret values outside Terraform; only the numeric
Secret Manager version is supplied.

Existing resources must be imported once before the first plan. Never apply a
plan that proposes replacing Redis or either MIG unexpectedly. Copy
`terraform.tfvars.example` to an ignored `terraform.tfvars`, set immutable image
digests and the release SHA, then run `terraform init`, `terraform import`,
`terraform plan -out=plan.tfplan`, and review the saved plan before apply.

Terraform adopts the dedicated media URL signing service account, grants it
read-only access only to `exports/` objects, and gives the runtime service
account a custom role containing only `iam.serviceAccounts.signBlob` on that
signer. It does not grant project-wide Service Account Token Creator. After
applying the reviewed plan, get
the email with `terraform output -raw gcs_signing_service_account` and set that
value as `GCS_SIGNING_SERVICE_ACCOUNT` in the protected runtime environment
file used to create the next Secret Manager version. Keep that populated file
outside source control and do not put the email or secret contents in
`terraform.tfvars`. Point a canary instance template at the new numeric secret
version, verify signed private downloads and the exact application SHA, then
continue the release only after the canary succeeds.

Render and transcription capacity are intentionally separate. The baseline
render pool uses benchmark-profiled `n2-highcpu-8` workers and scales from zero;
its bounded Spot overflow pool also scales from zero. Transcription, including
the eager media-scan queue, scales independently from zero. The API
readiness probe must remain healthy when both queues and both worker pools are
empty. Before enabling a scale-to-zero policy, verify the API or an
external scheduled publisher continuously emits zero-valued queue metrics;
stale/missing metrics must alert rather than silently strand queued work.

`enable_cloud_run_api=true` creates a parallel Cloud Run API candidate, private
Redis connector, serverless NEG, least-privilege scheduler identity, and five
OIDC-authenticated Cloud Scheduler jobs. The service defaults to zero minimum
instances, mounts the pinned runtime Secret Manager version, and runs with
`RUN_API_BACKGROUND_TASKS=0`. Enabling it
does not attach the NEG to the public load balancer or remove the GCE API MIG;
those are explicit canary/cutover/rollback steps after staging acceptance.

The Spot pool consumes the same idempotent render queue and has minimum zero.
Run the documented early/middle/late preemption drill before raising its maximum
in production. If Spot reliability is unacceptable, set
`spot_render_worker_max_replicas=0`; the baseline pool remains available.

Firebase Hosting configuration is in the repository root. Build `dist/`, select
the intended Firebase project explicitly, preview, then deploy hosting only.
The SPA points at its configured API origin; the wildcard rewrite serves only
frontend routes and does not proxy `/api` traffic.

The current production resources can be adopted without recreation with these
one-time imports (run only after filling `terraform.tfvars`):

```powershell
terraform import google_compute_security_policy.edge projects/project-0cc7c839-b9c7-4734-ad0/global/securityPolicies/lekha-edge-security
terraform import google_redis_instance.queue projects/project-0cc7c839-b9c7-4734-ad0/locations/asia-south1/instances/lekha-redis-ha
terraform import google_storage_bucket.media lekha-media-project-0cc7c839-b9c7-4734-ad0
terraform import google_service_account.media_url_signer projects/project-0cc7c839-b9c7-4734-ad0/serviceAccounts/lekha-media-url-signer@project-0cc7c839-b9c7-4734-ad0.iam.gserviceaccount.com
```

Import the existing custom signer-delegation role and conditional bucket IAM
binding as well if the reviewed plan shows they already exist. Never allow an
apply to replace the signer or broaden its object access. `frontend_origins` is
the authoritative CORS origin list; keep `../gcs-cors.json` only as an
operator-facing mirror for manual inspection and emergency comparison.
