# Google Cloud deployment — 11 September 2026

**Update:** the API and worker single-instance risks documented below were fixed on 12 September. See [Google Cloud scaling deployment — 12 September 2026](GCP_SCALING_DEPLOYMENT_2026-09-12.md) for the current managed-instance-group, autoscaling, load-balancer, quota, and verification state.

## Result

Critical backend fixes are deployed and healthy on **Google Cloud staging**. Public traffic remains on Netlify/Railway. This is **not yet approved for a mass-user public launch**, and a universal five-minute export completion time has not been demonstrated.

This report supersedes the access/deployment status in the 9 September initial audit. Authenticated inspection and infrastructure changes became possible after that audit.

## Verified target and release

| Item | Observed value |
|---|---|
| Account | abhisheknaidu369@gmail.com |
| Project / number | project-0cc7c839-b9c7-4734-ad0 / 602676673096 |
| Region / VM zone | asia-south1 / asia-south1-a |
| GCP API | https://34-93-113-193.sslip.io |
| GCP frontend | https://lekha-frontend-staging-602676673096.asia-south1.run.app |
| Backend and both workers | 6d5f530d9acf4a2432f82a16574a5d58a306a3ac |
| Immutable image | asia-south1-docker.pkg.dev/project-0cc7c839-b9c7-4734-ad0/caption-studio/app@sha256:cbf0f976b317e4754a0b8b5c1d1354e43cee02e472809426f45cb629acee216d |
| Cloud Build | db393c11-e4b7-46b7-841d-ffe5d671c89f — SUCCESS |
| Frontend revision | lekha-frontend-staging-00005-z5x — retained; this rollout changes backend code |
| Public API release | 838b28c8e10ee402fa1c1716418302a991cfee1f — unchanged |
| Runtime secret version | lekha-runtime-env version 9; version 8 retained |

## Deployed critical changes

- Atomic Redis queue admission prevents concurrent submissions exceeding the configured pending limit of 16. Overload is rejected with retry guidance; this is a capacity guard, not a throughput guarantee.
- A dedicated transcription worker prevents long exports from monopolizing transcription capacity. Both workers use the existing worker VM: export has 3 CPU / 10 GiB limits; transcription has 1 CPU / 2 GiB limits. One process consumes each queue.
- Staging transcription uses a separate queue and environment-scoped durable outbox, avoiding consumption of production transcription work in the shared Firebase project.
- Queue timeout transitions use conditional state updates, avoiding a race that could fail/cancel work that had already started. Readiness requires matching-release workers for both queues.
- Previous containers were stopped gracefully and retained for rollback. New image and startup script are persisted in VM metadata, with updated runtime settings in Secret Manager. Startup configuration includes the dedicated transcription container.
- Redis now uses `noeviction` and hourly RDB snapshots; instance state is READY. It remains Basic tier with no failover. Snapshots are not a zero-loss guarantee, and restore has not been tested.
- Global SSH and RDP firewall rules are disabled. SSH through IAP was tested successfully. Backend port 8000 remains blocked from public access.
- Existing API/frontend uptime alerts were connected to the owner's email channel. Alert delivery is not yet tested.

## Verification

- 167 affected backend tests passed before release, including a concurrent queue-admission test that admits at most eight of 50 simultaneous submissions, queue compatibility/isolation and timeout-race cases.
- Cloud Build succeeded from a clean committed source archive; the backend layer compiled and Chromium smoke check passed. Existing application dependencies were retained from the preceding immutable image.
- API and both workers passed readiness after replacement. HTTPS `/api/version` returned the exact new SHA and `environment=staging`; HTTPS `/api/health/readiness` returned `ready=true` when checked from the API VM with normal certificate validation.
- Export and transcription queues each had one idle worker and zero pending/started jobs after deployment.
- A synthetic 10-second 720×1280 caption render inside the deployed export container completed successfully in **4.29 seconds**, with approximately **315 MiB child peak RSS**. A second ASS render completed in 3.60 seconds. This is renderer-only evidence: it does not exercise authenticated upload, transcription providers, storage/download, complex DOM effects or concurrent user bursts.
- Local Windows Python HTTPS verification reported an expired certificate for both existing public and staging hosts. The VM's independent HTTPS checks passed with certificate validation enabled. No TLS verification was disabled; the local discrepancy remains undiagnosed.
- Deployment Python scripts compile and the startup shell script passes `bash -n`. VM reboot recovery is configured but has not been exercised.

## Scaling and remaining launch gates

| Segment | Current state | Critical remaining gate |
|---|---|---|
| Frontend | Cloud Run autoscaling already ON, maximum 20 instances, concurrency 80 | Full production-configured frontend acceptance |
| API | Single e2-standard-4 VM; autoscaling OFF | Redundancy and bounded scaling before mass-user launch |
| Exports | One consumer on existing e2-standard-4 worker VM; autoscaling OFF | Queue-age/workload autoscaler, graceful scale-in and representative capacity tests |
| Transcription | Dedicated consumer sharing worker VM | Provider quota, retry/recovery and concurrent throughput validation |
| Queue | Basic 1 GiB Memorystore; noeviction, hourly snapshots | Failover and restore verification; capacity sizing |
| Payments | GCP uses test-mode credentials | Configure and verify intended live payments before public cutover |
| User journey | Component readiness and synthetic render passed | Disposable authenticated upload → transcription → edit → export → download and payment acceptance |
| Public routing | Netlify/Railway retained | Cut over only after the above acceptance gates |

The request restricts expensive fleets and material ongoing cost increases. No larger fleet or Redis tier migration was created without a spending ceiling. The unanswered monthly GCP budget is required to choose concrete bounds; budget alerts alone do not cap charges. The five-minute objective also needs a supported video duration/resolution/effects envelope and measured simultaneous-user load. Existing queue timeout handling is not evidence of successful completion within that objective.

## Rollback

Root-only snapshots and prepared environment files are on each VM under `/etc/lekha/rollbacks/6d5f530d9acf4a2432f82a16574a5d58a306a3ac/`. Do not print or commit these files: they contain runtime credentials. Previous containers are named `lekha-api-rollback-6d5f530d` and `lekha-worker-rollback-6d5f530d`.

Use IAP SSH with explicit project and zone. On the API VM, run `sudo python3 rollout-existing.py rollback api --image <new immutable image above> --release 6d5f530d9acf4a2432f82a16574a5d58a306a3ac`, then the equivalent `rollback worker` on the worker VM. The script drains/removes replacement containers and restores the retained containers. Verify queue state first and preserve new staging transcription work; do not discard or migrate queued records blindly.

For a persistent rollback, also restore the previous VM metadata/startup script and publish the content of secret version 8 as a new latest version through a credential-safe process. Previous backend image digest is `sha256:ce92354ba5dd475be4d9191d6436aac72e4cbfa663ed3a5ed69764d311824257`. Restoring only containers does not revert startup metadata. Previous resource metadata snapshots are in the workspace output directory `gcp-live-before-20260909`.

Operational scripts: `deploy/gcp/rollout-existing.py`, `deploy/gcp/persist-runtime-release.py`, `deploy/gcp/gce-startup.sh`. The reusable full launch prompt is `docs/GCP_DEPLOYMENT_PROMPT.md`.
