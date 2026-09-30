# Lekha Google Cloud Terraform

The complete pay-only-when-used backend. Read `../README.md` for the deployment
order and the approval rules; this file explains what Terraform creates.

## What it creates

| Resource | Idle cost | Notes |
|---|---|---|
| Cloud Run service `lekha-api` + ClamAV sidecar | none | Min instances fixed at 0, max `api_max_instances` (default 2, capped at 4). Request-based billing (`cpu_idle = true`). Public; the app authenticates users. |
| Cloud Run Jobs `lekha-render`, `lekha-transcription` | none | Started by the API only when their queues have work (`WORKER_LAUNCH_JOBS`). Exit after `worker_idle_exit_seconds` (default 120). Hard run limit `worker_task_timeout_seconds` (default 2 h). At most `worker_max_parallel` copies (default 1). |
| Cloud Run Job `lekha-render-gpu` | none | Only when `enable_gpu_render_job = true`. NVIDIA L4; asia-south1 needs an invitation. Keep off until a capped benchmark shows it pays off. |
| Cloud Scheduler (4 jobs) | ~free | Recovery safety nets every 5-30 min (dispatch, payment reconciliation, janitor). Normal work is dispatched on the request path. |
| Billing budget + Pub/Sub topic/subscription | ~free | Emails at 50/80/100% (and forecast 100%). Every budget update is pushed to `/api/maintenance/budget-alert`, which pauses uploads, transcription and exports once spend reaches `budget_stop_fraction`. It never resumes by itself. |
| Media bucket, URL signer identity, IAM | storage only | Private bucket, 4-day lifecycle, signer can read `exports/` only via a signBlob-only role. |

Not created, on purpose: Compute Engine VMs, instance groups, autoscalers,
Memorystore Redis, VPC connectors, Cloud NAT, load balancers, reserved IPs.
`scripts/check-release-readiness.mjs` fails if any of them appear in `main.tf`.

## Worst case per hour

The caps make the maximum spend while busy predictable before anything runs:
2 API instances + 1 render job (4 vCPU / 12 GiB) + 1 transcription job
(2 vCPU / 4 GiB). Raising a cap raises that ceiling; do it only with measured
cost evidence and the owner's approval.

## Secrets and settings

- The runtime secret `lekha-runtime-env` is created by hand (see `../README.md`)
  and mounted as a file; Terraform only grants access and pins a numeric version.
- Settings Terraform puts directly on the containers win over the secret file
  (`WORKER_LAUNCH_*`, `WORKER_IDLE_EXIT_SECONDS`, `WORKER_QUEUES`, scanner
  settings, `GPU_RENDER_ENABLED`, `BUDGET_STOP_FRACTION`, scheduler identity).
- The transcription job has no clamd sidecar (a sidecar's exit behaviour in
  jobs is undocumented and could keep the job billing); it scans with the
  `clamscan` baked into its image (`CLAMAV_SCAN_CMD`). The render job never
  scans; its `CLAMAV_HOST` points at nothing so any scan fails closed.

## Permissions for whoever runs Terraform

Project Owner (or equivalent) on the project, plus Billing Account Costs Manager
on the billing account for the budget. Pub/Sub push uses the scheduler identity's
OIDC token; projects created before 2021-04-08 would also need the Pub/Sub
service agent granted Token Creator on that identity - new projects don't.

## Commands

```powershell
terraform init
terraform plan -out=plan.tfplan
# Review: no VMs, Redis, NAT, load balancer or reserved IP. Owner approves.
terraform apply plan.tfplan
```

Validate offline without any cloud access: `terraform init -backend=false` then
`terraform validate`.
