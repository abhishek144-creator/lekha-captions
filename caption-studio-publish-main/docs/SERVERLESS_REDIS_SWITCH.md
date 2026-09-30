# Switching to serverless Redis

Goal: stop paying for an always-on Memorystore instance (and the private
network pieces it needs) by pointing the app at a pay-per-use Redis reached over
TLS. The queue, job state, rate limits and locks keep working unchanged: this
is a connection change, not a rewrite.

## What the code already does

- `backend/redis_config.py` opens every Redis connection. It keeps idle
  connections healthy (`health_check_interval=30`, TCP keepalive), because
  serverless Redis closes idle connections.
- In production it refuses a plaintext `redis://` URL to a public host, so
  the Redis password can't cross the internet unencrypted. Use `rediss://`.
- API background loops are off in production (`RUN_API_BACKGROUND_TASKS=0`),
  and on-demand workers exit when idle (`WORKER_IDLE_EXIT_SECONDS`), so nothing
  sends Redis commands around the clock.

## Checklist (operator steps, in order)

1. Create a Redis database with a serverless provider in the region closest to
   the API (Mumbai / `asia-south1` if available). Enable TLS. Copy its
   `rediss://default:<password>@<host>:<port>` URL.
   Check the provider's current pricing and command/bandwidth limits yourself;
   they are not assumed here.
2. Staging first: put the URL in the staging runtime secret as `REDIS_URL`,
   deploy, and run the release checks plus one upload → transcribe → export.
3. On-demand workers need no secret changes: `deploy/gcp/terraform` sets
   `WORKER_LAUNCH_JOBS`, `WORKER_LAUNCH_REGION` and `WORKER_IDLE_EXIT_SECONDS`
   (120) directly on the API and worker jobs.
4. Let staging sit idle for a day and confirm in the provider dashboard that
   the command count stays near zero while nothing is happening.
5. Production: wait until no export or transcription jobs are in flight
   (in-flight RQ jobs live in the old Redis and are not copied), then switch
   `REDIS_URL` and redeploy the API and worker jobs together.
6. The current `deploy/gcp/terraform` has no Memorystore, VPC access or Cloud
   NAT (removed 2026-09-29). If an older deployment still has them, delete them
   after a quiet period.

## Rollback

Put the old `REDIS_URL` back and redeploy. Jobs queued only in the new Redis
during the switch would need to be resubmitted.
