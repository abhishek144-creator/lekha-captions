# Google Cloud production hardening — 17 September 2026

## Deployed release

- Primary website: `https://lekhacaptions.com`
- Public API: `https://api.lekhacaptions.com`
- GitHub `main` and application release: `d8824f5d998ec9daec8de31c7a803408755841de`
- Frontend revision: `lekha-frontend-staging-00014-d4l` (100% traffic)
- Runtime secret version: `26`
- Runtime environment: `production`
- API readiness and the public root both returned HTTP 200 after rollout.

The API, frontend, render workers, and transcription workers publish the same
application release. Render and
transcription workers use separate role-specific images. Instance metadata pins
a numeric Secret Manager version, and new workers boot from a pre-baked runtime
image instead of installing packages or pulling application images at startup.

## Live capacity

| Component | Live configuration |
|---|---|
| API MIG | 2 minimum, 4 maximum, `e2-standard-2` |
| Worker MIG | 3 minimum, 20 maximum, `n2-custom-4-12288` |
| Render allocation | One render per worker, up to 3 vCPU / 8 GiB |
| Transcription allocation | Up to 1 vCPU / 2 GiB |
| Pending export queue | 80 jobs |
| Maximum queue wait | 600 seconds |
| Full-capacity response | HTTP retry guidance of 300 seconds |
| Worker scale-out | Queue depth, one waiting export per desired worker, plus a 45% CPU fallback |
| Worker scale-in | Active-job instance protection and at most five idle removals per 300 seconds |

Google approved the project-wide Compute Engine CPU quota increase from 32 to
100 vCPUs. This covers 20 four-vCPU workers, the two normal API instances, and
rolling headroom. The approved quota preference is
`compute-cpus-all-regions-100`, trace
`0478826b-da97-4cd1-8c32-bb3af824a7d3`.

The worker MIG uses regional `ANY` placement across all three `asia-south1`
zones. This lets queue-backed batch workers use whichever zone has available
capacity instead of failing the whole scale-out when one zone is exhausted.

## 100-export capacity result

A controlled production probe submitted 100 isolated synthetic 720p FFmpeg
jobs, each with approximately ten seconds of processing work.

| Result | Measurement |
|---|---:|
| Requested | 100 |
| Completed | 100 |
| Failed | 0 |
| Workers used | 20 |
| Queue-drain wall time | 131.153 seconds |
| Task P50 | 10.191 seconds |
| Task P95 | 13.202 seconds |
| Observed synthetic throughput | 2,744.89 jobs/hour |

The first three warm workers started immediately. At about 81 seconds the pool
reached 20 concurrent workers, and the final job finished at about 131 seconds.
All queues and started-job registries returned to zero after the run.

This is a scaling and queue-control result, not a promise that every customer
video finishes in 131 seconds. Real exports vary with duration, resolution,
template complexity, frame rate, source codec, and storage transfer time. A
previous 11.168-second animated 720x1280 production workload rendered in 20.942
seconds on this worker type. One hundred jobs of that size would require about
five worker waves after scale-out, or roughly two minutes under similar
conditions.

## Cold start

The pre-baked worker image published 34 cold-start samples during the scale
test. Time from VM startup to ready worker was 20–22 seconds, averaging 20.941
seconds. This replaces the previous boot path that installed packages and
pulled several images before registering the worker.

## Storage and cleanup

- Browser uploads use authenticated resumable Google Cloud Storage sessions.
- Upload completion verifies ownership and object size before transcription.
- Uploaded source objects carry a six-hour application expiry.
- Export objects use the plan-specific 2, 24, or 72-hour retention window.
- Local render scratch is deleted immediately where possible, with a 30-minute
  local-output backstop.
- The janitor runs every 15 minutes.
- The private media bucket has uniform bucket-level access, aborts incomplete
  multipart uploads after one day, and deletes any escaped object after four
  days as a final lifecycle backstop.
- The capacity probe writes output to the null muxer and creates no customer or
  bucket media.

## Reliability and security

- Redis is `STANDARD_HA`, Redis 7.2, one GiB, with primary and replica in
  different `asia-south1` zones and `noeviction` configured.
- Cloud Armor is attached to both the API and frontend backends. Enforced rules
  cover SQL injection, cross-site scripting, local/remote file inclusion, and
  remote code execution before the default allow rule.
- Direct-upload and multi-project routes require authentication; unauthenticated
  production probes returned HTTP 403.
- A user can keep up to 100 cloud projects, select/delete projects, and retain
  five saved revisions per project. Legacy single-draft data migrates on read.
- Frontend exceptions use Sentry when a DSN is configured and otherwise use the
  deployed first-party sanitized analytics endpoint. No third-party Sentry DSN
  is currently stored in the project.
- Terraform now describes the Redis, Cloud Armor, media bucket, IAM, NAT,
  health checks, MIGs, and autoscaling resources. Existing resources must be
  imported before the first stateful apply, as documented in the Terraform
  README.

`backend/main.py` and `Dashboard.jsx` remain orchestration entry points, but the
new project routes, resumable-upload routes, Firebase storage helpers, queue
metrics, safe scale-in logic, and cloud-project React state are extracted into
independently tested modules.
