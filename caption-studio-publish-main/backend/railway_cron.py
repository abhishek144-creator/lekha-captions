"""One maintenance pass, run by a Railway cron service, then exit.

The API runs with RUN_API_BACKGROUND_TASKS=0 so it can sleep when idle. This
pass does the API's periodic work in its own short-lived container, so the
schedule never wakes the API or a worker unless there is work for one:

- move RQ retries that are now due back onto their queues;
- re-deliver transcription and malware-scan jobs from the Firestore outboxes;
- wake a worker for any queue that still has jobs (no-op if one is running);
- delete expired uploads/exports and abort stale multipart uploads;
- reconcile payments whose Razorpay webhooks never arrived.

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
    from rq.scheduler import RQScheduler
except ImportError:  # pragma: no cover - production dependency is pinned
    RQScheduler = None


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


def kick_backlogged_workers(connection, queue_names):
    return sum(1 for name in queue_names if worker_launcher.kick(connection, name, log=print))


def run_once(*, host=api, launch_queues=None):
    launch_queues = list(launch_queues if launch_queues is not None else worker_launcher.job_map())
    staging = os.environ.get("RELEASE_ENVIRONMENT") == "staging"
    steps = [
        ("promote_due_retries", lambda: promote_due_retries(host._rq_redis_client, launch_queues)),
        ("transcription_dispatch",
         lambda: host.TranscriptionJobs(host.get_db()).dispatch(host._transcription_queue)),
        ("media_scan_dispatch", host._dispatch_media_scans_once),
        ("render_scaling", lambda: render_autoscaling.reconcile(host._rq_redis_client, allow_down=True)),
        ("kick_workers", lambda: kick_backlogged_workers(host._rq_redis_client, launch_queues)),
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
