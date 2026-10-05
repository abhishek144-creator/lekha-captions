"""One maintenance pass, run by a Railway cron service, then exit.

The API runs with RUN_API_BACKGROUND_TASKS=0 so it can sleep when idle. This
pass does the API's periodic work in its own short-lived container, so the
schedule never wakes the API or a worker unless there is work for one:

- move RQ retries that are now due back onto their queues;
- re-deliver transcription and malware-scan jobs from the Firestore outboxes;
- wake a worker for any queue that still has jobs (no-op if one is running);
- delete expired uploads/exports and abort stale multipart uploads;
- reconcile payments whose Razorpay webhooks never arrived;
- alert before Redis runs out of memory.

Each step is independent: one failing does not skip the rest, and the process
exits non-zero so Railway marks the run as failed.
"""
import json
import os
import sys
import time

try:
    from . import main as api
    from . import worker_launcher
    from . import render_autoscaling
except ImportError:  # pragma: no cover - run as a script from backend/
    import main as api
    import worker_launcher
    import render_autoscaling

try:
    from rq.registry import StartedJobRegistry
    from rq.scheduler import RQScheduler
except ImportError:  # pragma: no cover - production dependency is pinned
    RQScheduler = None
    StartedJobRegistry = None


def _log(event, **fields):
    print(json.dumps({"event": event, "service": "cron", **fields}, default=str), flush=True)


def promote_due_retries(connection, queue_names):
    """Enqueue scheduled retries that are due; normally a running worker does this."""
    if RQScheduler is None or connection is None or not queue_names:
        return 0
    scheduler = RQScheduler(queue_names, connection=connection)
    # The lock is shared with workers' schedulers: never promote twice.
    if not scheduler.acquire_locks():
        return 0
    try:
        scheduler.enqueue_scheduled_jobs()
    finally:
        scheduler.release_locks()
    return 1


def recover_expired_jobs(connection, queue_names):
    """Use RQ recovery so abandoned jobs retry or fail; live entries stay intact."""
    if StartedJobRegistry is None or connection is None:
        return 0
    for name in queue_names:
        StartedJobRegistry(name=name, connection=connection).cleanup()
    return len(queue_names)


# Redis holds queues, rate limits and idempotency keys and must not evict them,
# so a full Redis fails writes; production rate limiting then fails closed
# (503 on every request). Alert well before that point.
REDIS_MEMORY_ALERT_RATIO = 0.8


def check_redis_memory(connection, *, alert=None):
    """Return Redis memory use; alert when it nears its ceiling."""
    if connection is None:
        return None
    try:
        info = connection.info("memory")
    except Exception as error:
        # Monitoring only: a server without INFO must not fail the maintenance pass.
        return {"unavailable": type(error).__name__}
    used = int(info.get("used_memory") or 0)
    limit = int(info.get("maxmemory") or 0)
    if limit <= 0:
        # No server limit configured: compare with the plan size the operator set.
        limit = int(os.environ.get("REDIS_MEMORY_ALERT_BYTES", str(512 * 1024 * 1024)) or 0)
    ratio = (used / limit) if limit > 0 else 0.0
    if ratio >= REDIS_MEMORY_ALERT_RATIO and alert is not None:
        alert(
            f"Redis memory is at {ratio:.0%} ({used // (1024 * 1024)} MiB of "
            f"{limit // (1024 * 1024)} MiB). Writes fail when it is full; "
            "raise the Redis plan or investigate key growth."
        )
    return {"used_bytes": used, "limit_bytes": limit, "ratio": round(ratio, 3)}


def kick_backlogged_workers(connection, queue_names):
    return sum(1 for name in queue_names if worker_launcher.kick(connection, name, log=print))


def run_once(*, host=api, launch_queues=None):
    launch_queues = list(launch_queues if launch_queues is not None else worker_launcher.job_map())
    staging = os.environ.get("RELEASE_ENVIRONMENT") == "staging"
    steps = [
        ("recover_expired_jobs", lambda: recover_expired_jobs(host._rq_redis_client, launch_queues)),
        ("promote_due_retries", lambda: promote_due_retries(host._rq_redis_client, launch_queues)),
        ("transcription_dispatch",
         lambda: host.TranscriptionJobs(host.get_db()).dispatch(host._transcription_queue)),
        ("media_scan_dispatch", host._dispatch_media_scans_once),
        ("render_scaling", lambda: render_autoscaling.reconcile(host._rq_redis_client, allow_down=True)),
        ("kick_workers", lambda: kick_backlogged_workers(host._rq_redis_client, launch_queues)),
        ("redis_memory", lambda: check_redis_memory(
            host._rq_redis_client, alert=getattr(host, "_send_alert", None))),
    ]
    # Staging shares Firestore with production: never clean customer media or
    # reconcile live payments from it (same rule as the API's own scheduler).
    if not staging:
        steps += [
            ("janitor", lambda: host.asyncio.run(host.scheduled_janitor_job())),
            ("payment_reconciliation",
             lambda: host.asyncio.run(host.scheduled_payment_reconciliation_job())),
        ]
    failures = []
    for name, step in steps:
        started = time.monotonic()
        try:
            result = step()
            _log("cron_step_completed", step=name, result=result,
                 seconds=round(time.monotonic() - started, 2))
        except Exception as error:
            failures.append(name)
            _log("cron_step_failed", step=name, error_type=type(error).__name__, error=str(error)[:500])
    host._flush_telemetry()
    return failures


def main():
    failures = run_once()
    _log("cron_pass_finished", failed_steps=failures)
    sys.stdout.flush()
    sys.stderr.flush()
    sentry = getattr(api, "sentry_sdk", None)
    if sentry is not None:
        try:
            sentry.flush(timeout=5)
        except Exception:
            pass
    # Firestore/gRPC keep non-daemon threads alive; a cron run must end so the
    # next one is not skipped and the container stops billing.
    os._exit(1 if failures else 0)


if __name__ == "__main__":
    main()
