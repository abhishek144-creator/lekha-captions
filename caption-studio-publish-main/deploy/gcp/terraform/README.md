# Lekha Google Cloud Terraform

This directory is the source of truth for the scale-to-zero Cloud Run API,
render and transcription regional MIGs, autoscaling, Cloud NAT, health checks,
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
render pool uses the verified `n2-custom-4-12288` profile and scales from 0 to
3 from both pending render work-seconds and predicted queue wait. Fast, normal,
and heavy queues share atomic count and predicted-work admission ceilings; the
default accepts no more than 1,800 estimated work-seconds. Export status returns
the selected queue's position and estimated wait/completion for the customer UI.
Transcription and eager media scanning
scale independently from 0 to 2. The Spot overflow pool scales from 0 to 1 by
default and is hard-capped at 2. The optional G2/L4 pool stays
disabled and is hard-capped at 1 until a matched cost and visual-parity
benchmark passes and a driver-enabled `gpu_runtime_image` is supplied.

`enable_cloud_run_api=true` creates the Cloud Run API, Direct VPC egress to
private Redis, a serverless NEG, least-privilege scheduler identity, and five
OIDC-authenticated Cloud Scheduler jobs. Direct VPC egress avoids the fixed
minimum instance cost of a Serverless VPC Access connector. The service scales
from 0 to 4 instances, mounts the pinned runtime Secret Manager version, and
runs with `RUN_API_BACKGROUND_TASKS=0`. The GCE API MIG remains defined at
target size zero only for rollback. Attaching the NEG to the public load
balancer remains an explicit canary/cutover step after staging acceptance.

The enforced production ceilings are: Cloud Run API 0..4 revisions (each
revision requests 2 vCPU and 3 GiB across the API and ClamAV containers),
render 0..3 VMs (4 vCPU and 12 GiB each), transcription 0..2 VMs (2 vCPU and
8 GiB each), Spot 0..1 by default, and GPU 0 by default. Terraform validation
rejects a nonzero idle minimum or a higher ceiling without a reviewed code
change. Scale-to-zero removes VM and Cloud Run instance charges while idle;
Redis, load balancing, NAT, IP addresses, logging, and stored disks/objects can
still have fixed or usage-based charges and must be reviewed separately.

The Spot pool consumes the idempotent heavy-render queue and has minimum zero.
It is enabled by default with one burst worker, uses retry-safe jobs, and never
replaces the baseline pool. Run the documented early/middle/late preemption
drill before raising its maximum to two.

Firebase Hosting configuration is in the repository root. Build `dist/`, select
the intended Firebase project explicitly, preview, then deploy hosting only.
The SPA points at its configured API origin; the wildcard rewrite serves only
frontend routes and does not proxy `/api` traffic.

Bill-backed cost reconciliation is documented in `../COST_ACCOUNTING.md`.

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
