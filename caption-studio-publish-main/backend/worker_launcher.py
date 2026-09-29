"""Start Cloud Run Job workers on demand, so no worker runs while queues are empty.

Enabled only when WORKER_LAUNCH_JOBS maps queue names to Cloud Run Job names,
e.g. {"caption_transcription_jobs": "lekha-transcription", "caption_export_jobs": "lekha-render"}.
Without it every function here is a no-op and the always-on worker keeps working.

A Redis lease per job slot means "a worker for this job is starting or running".
Ordering closes the lost-wakeup race: the API enqueues first and then tries the
lease; a worker releases its lease first and then re-checks its queues. Either
the API sees no lease and launches, or the worker sees the new job and stays.
"""
from __future__ import annotations

import json
import os
import time
import urllib.request

LEASE_PREFIX = "lekha:worker_launch"
# Covers a cold start; a running worker refreshes it on every heartbeat.
LEASE_SECONDS = max(60, int(os.environ.get("WORKER_LAUNCH_LEASE_SECONDS", "300")))
MAX_PARALLEL = max(1, min(int(os.environ.get("WORKER_LAUNCH_MAX_PARALLEL", "1")), 20))
METADATA_ROOT = "http://metadata.google.internal/computeMetadata/v1"


def job_map() -> dict[str, str]:
    try:
        raw = json.loads(os.environ.get("WORKER_LAUNCH_JOBS", "") or "{}")
    except ValueError:
        return {}
    return {str(queue): str(job) for queue, job in raw.items() if queue and job} if isinstance(raw, dict) else {}


def enabled() -> bool:
    return bool(job_map())


def lease_key(job_name: str, slot: int) -> str:
    return f"{LEASE_PREFIX}:{job_name}:{slot}"


def _metadata(path: str) -> str:
    request = urllib.request.Request(f"{METADATA_ROOT}/{path}", headers={"Metadata-Flavor": "Google"})
    with urllib.request.urlopen(request, timeout=3) as response:  # nosec B310 - fixed metadata host
        return response.read().decode().strip()


def _run_cloud_run_job(job_name: str, slot: int) -> None:
    project = os.environ.get("GOOGLE_CLOUD_PROJECT") or _metadata("project/project-id")
    region = os.environ.get("WORKER_LAUNCH_REGION", "asia-south1")
    token = json.loads(_metadata("instance/service-accounts/default/token"))["access_token"]
    body = json.dumps({"overrides": {"containerOverrides": [{"env": [
        {"name": "WORKER_LAUNCH_SLOT", "value": str(slot)},
    ]}]}}).encode("utf-8")
    request = urllib.request.Request(
        f"https://run.googleapis.com/v2/projects/{project}/locations/{region}/jobs/{job_name}:run",
        data=body, method="POST",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=10) as response:  # nosec B310 - fixed Google API host
        response.read()


def _queue_backlog(connection, queue_names) -> int:
    return sum(int(connection.llen(f"rq:queue:{name}") or 0) for name in queue_names)


def kick(connection, queue_name: str, *, launcher=_run_cloud_run_job, log=print) -> bool:
    """Make sure a worker will serve `queue_name`. Call after the job is enqueued."""
    job_name = job_map().get(queue_name)
    if not job_name or connection is None:
        return False
    queues = [name for name, job in job_map().items() if job == job_name]
    try:
        backlog = _queue_backlog(connection, queues)
        if backlog <= 0:
            return False
        active = [slot for slot in range(MAX_PARALLEL) if connection.exists(lease_key(job_name, slot))]
        # One more worker only when the backlog outgrows the ones already running.
        if active and backlog <= len(active):
            return False
        for slot in range(MAX_PARALLEL):
            if slot in active:
                continue
            if connection.set(lease_key(job_name, slot), str(time.time()), nx=True, ex=LEASE_SECONDS):
                try:
                    launcher(job_name, slot)
                except Exception as error:
                    # Let the next enqueue or status poll try again.
                    connection.delete(lease_key(job_name, slot))
                    log(json.dumps({"event": "worker_launch_failed", "job": job_name, "error": str(error)}))
                    return False
                log(json.dumps({"event": "worker_launched", "job": job_name, "slot": slot, "backlog": backlog}))
                return True
    except Exception as error:
        log(json.dumps({"event": "worker_kick_failed", "queue": queue_name, "error": str(error)}))
    return False


class WorkerLease:
    """The running worker's side of the lease (Cloud Run sets CLOUD_RUN_JOB)."""

    def __init__(self, connection, queue_names):
        self.connection = connection
        self.queue_names = list(queue_names)
        self.job_name = os.environ.get("CLOUD_RUN_JOB", "")
        self.slot = int(os.environ.get("WORKER_LAUNCH_SLOT", "0") or 0)
        self.key = lease_key(self.job_name, self.slot) if self.job_name else ""

    def refresh(self) -> None:
        if self.key:
            self.connection.set(self.key, str(time.time()), ex=LEASE_SECONDS)

    def release_and_should_continue(self) -> bool:
        """Release the lease, then re-check; keep working if a job slipped in."""
        if not self.key:
            return False
        self.connection.delete(self.key)
        if _queue_backlog(self.connection, self.queue_names) <= 0:
            return False
        # Someone may have launched a fresh worker already; then let it serve.
        return bool(self.connection.set(self.key, str(time.time()), nx=True, ex=LEASE_SECONDS))
