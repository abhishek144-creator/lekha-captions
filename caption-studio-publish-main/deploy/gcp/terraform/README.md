# Lekha Google Cloud Terraform

This directory is the source of truth for API and worker MIGs, the separate
transcription pool, optional Spot and GPU render pools, work-based autoscaling,
Cloud Run API, Firebase Hosting site, Cloud NAT, Standard HA Redis, the private
media bucket, immutable instance templates, and Cloud Armor policy. Keep secret
values outside Terraform; only the numeric Secret Manager version is supplied.

Production state is stored in the versioned, public-access-blocked GCS bucket
`gs://lekha-terraform-state-602676673096` under the `production/gcp` prefix.
On 24 September 2026, all 17 existing production resources declared here were
imported into that state. The adoption plan completed with zero additions,
changes, or destroys.

Copy `terraform.tfvars.example` to an ignored `terraform.tfvars`, set the live
immutable image digests, exact resource names, numeric secret version, and
release SHA, then use this workflow:

```powershell
terraform init
terraform validate
terraform plan -input=false -out=plan.tfplan
terraform show -no-color plan.tfplan
```

Review every saved plan before applying it. Stop if Terraform proposes an
unexpected replacement of Redis, an instance template, or either managed
instance group. Do not repeat the imports against the existing remote state.

The GPU pool defaults off. Enable it only after comparing its NVENC cost and
quality against CPU exports, and set `gpu_runtime_image` to a tested immutable
Compute Engine image with the NVIDIA driver and Container Toolkit already
installed. The Spot pool scales from zero and receives heavy renders when GPU
routing is disabled. The transcription pool starts at one instance; set
`enable_transcription_pool = false` only when transcription is intentionally
paused.

The Firebase Hosting site is the project default site. Populate Secret Manager
secret `lekha-frontend-build-config` with the frontend-only Vite `.env.production`
settings before running the Hosting build. It contains public Firebase browser
configuration, the App Check site key, Razorpay key ID, and the legal/support
fields required by the production build; never put server secrets in it. The
frontend build reads the separate pinned `lekha-frontend-sentry-dsn` version.
Add the Hosting domains to the Firebase App Check key's allowed domains before
serving customers.

The Cloud Run API uses Direct VPC egress on the configured regional subnet to
reach the private Standard HA Redis instance. The defaults use the existing
`default` VPC and subnet; change `api_vpc_network` and `api_vpc_subnetwork`
together if Redis is attached to another network. Egress is limited to private
IP ranges, so public Google APIs continue to use Cloud Run's normal egress. The
API revision also runs a ClamAV sidecar and waits for its daemon before passing
the production readiness probe, so upload scanning stays fail-closed.

Deploy the reviewed API image and worker image with the same full commit SHA,
apply the reviewed Terraform plan, then deploy Hosting from the same checkout:

```powershell
$release = (git rev-parse HEAD).Trim()
$builtAt = (git show -s --format=%cI $release).Trim()
$version = "gcp-$($release.Substring(0, 12))"
gcloud builds submit --config=deploy/gcp/firebase-hosting/cloudbuild.yaml `
  --substitutions="_APP_RELEASE=$release,_BUILD_TIME=$builtAt,_RELEASE_VERSION=$version" .
```

Firebase Hosting rewrites `/api/**` to the Cloud Run API and pins that site's
release to the API revision used at Hosting deploy time. Requests through the
Hosting rewrite have a 60-second proxy limit, so long exports and
transcriptions must remain asynchronous queue jobs. The Cloud Run API is
publicly invokable at the transport layer and keeps its application auth,
Firebase App Check, and tenant checks enabled.
