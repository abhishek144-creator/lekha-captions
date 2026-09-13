# Google Cloud scaling deployment — 12 September 2026

## Result

The two critical Compute Engine single-instance risks in Google Cloud staging are fixed. The API and media worker now run as regional managed instance groups with health-based repair and bounded autoscaling. The API is served through a global HTTPS load balancer, and the staging frontend uses that load-balanced origin.

Public `app.lekhacaptions.com` and `api.lekhacaptions.com` still route to Netlify and Railway. This change therefore hardens the Google Cloud staging path; it does not perform the final public DNS cutover.

## Deployed topology

| Component | Deployed configuration |
|---|---|
| Frontend | Cloud Run revision `lekha-frontend-staging-00008-bmt`, 100% traffic; existing max 20 and concurrency 80 |
| API | Regional MIG `lekha-api-staging-mig`, two warm `e2-standard-2` replicas distributed across `asia-south1-a/b/c`; autoscaling min 2, max 4, CPU target 60% |
| Worker | Regional MIG `lekha-worker-staging-mig`, two warm `e2-standard-4` replicas distributed across `asia-south1-a/b/c`; scale-out min 2, max 5, CPU target 45% |
| Scale-in safety | API scale-in is limited to one replica per 30 minutes. Worker automatic scale-in is disabled because a CPU metric cannot prove an RQ job has drained. |
| Instance repair | HTTP health service checks `/api/health/readiness`; initial delay 180 seconds |
| API load balancer | Global external managed HTTPS load balancer at `https://8-233-50-208.sslip.io`; HTTP redirects to HTTPS; backend timeout 600 seconds and drain timeout 60 seconds |
| Compute disks | Each current template uses a 50 GB balanced persistent disk |
| Release | Backend and workers `d4f3cb17ef5fcb273c66f702bdd72355c8f6b9e8`; immutable image digest `sha256:abb303e1f1281ef34853453a5edd318a8663079e8fac74aba8f8bcf1bebbb462` |

At the configured maximum, the two groups reserve at most 28 vCPUs and 450 GB of balanced persistent disks. The observed project limits are 32 all-region vCPUs and 500 GB regional SSD storage, so the configured ceiling fits the current quota. Templates use 50 GB disks because the former 100 GB layout exhausted the 500 GB disk quota during a worker scale-out test.

## Verification

- The managed TLS certificate for `8-233-50-208.sslip.io` became ACTIVE. HTTP redirects to HTTPS.
- Both API replicas became healthy behind the load balancer during a rolling replacement, with the endpoint remaining available.
- The frontend release marker reports `gcp-staging-d4f3cb1-api-mig`, and its deployed JavaScript contains the new load-balancer origin with the old single-VM origin absent.
- A browser public-launch smoke suite passed all 12 Chromium checks against the staging frontend.
- CORS preflight from the staging frontend to the load-balanced API returned 200 with the expected origin.
- A 300-request API check at concurrency 30 returned 300 HTTP 200 responses. This is an availability check, not representative media-load evidence.
- A synthetic five-second 720×1280 FFmpeg encode completed inside a managed worker and produced a 4,713,902-byte output before cleanup.
- Both worker queues were empty after deployment, and each worker replica registered the expected export and transcription consumers.

These checks verify failover-capable topology, rollout health, and bounded fleet creation. They do not establish a universal five-minute completion guarantee. That target still requires authenticated concurrent tests using the supported duration, resolution, effects, storage path, and transcription providers.

## Rollback and operations

Pre-migration snapshots are READY:

- `lekha-api-staging-pre-mig-20260912`
- `lekha-worker-staging-pre-mig-20260912`

The former standalone VMs were deleted only after the snapshots were ready and the load-balanced path continued to pass checks. Recreate from the snapshots only for disaster recovery; routine releases should use managed rolling updates.

The provisioning source is `deploy/gcp/provision-scaled-staging.ps1`. Keep the worker autoscaler in scale-out-only mode. Before an operator manually reduces worker count, verify that pending and started registries for both queues are empty.

Redis remains a Basic-tier dependency without a replica or automatic failover. Payments remain in test mode, and public DNS cutover still requires a final authenticated media/payment acceptance run.
