"""Start workers on demand, so no worker runs while queues are empty.

Enabled only when WORKER_LAUNCH_JOBS maps queue names to worker names,
e.g. {"caption_transcription_jobs": "lekha-transcription", "caption_export_jobs": "lekha-render"}.
Without it every function here is a no-op and the always-on worker keeps working.

A worker is started one of two ways:
- WORKER_WAKE_URLS maps a worker name to its HTTP wake endpoint (Railway: the
  worker service sleeps when idle and wakes on this request). Requests carry
  WORKER_WAKE_SECRET.
- Otherwise the worker name is a Cloud Run Job, run through the Cloud Run API.

A Redis lease per job slot means "a worker for this job is starting or running".
Ordering closes the lost-wakeup race: the API enqueues first and then tries the
lease; a worker releases its lease first and then re-checks its queues. Either
the API sees no lease and launches, or the worker sees the new job and stays.
"""
from __future__ import annotations

import json
import os
import socket
import threading
import urllib.parse
from concurrent.futures import ThreadPoolExecutor
import time
import urllib.error
import urllib.request

try:
    from . import render_autoscaling as autoscaling
except ImportError:  # Direct execution from backend/ remains supported.
    import render_autoscaling as autoscaling

LEASE_PREFIX = "lekha:worker_launch"
# Covers a cold start; a running worker refreshes it on every heartbeat.
LEASE_SECONDS = max(60, int(os.environ.get("WORKER_LAUNCH_LEASE_SECONDS", "300")))
MAX_PARALLEL = max(1, min(int(os.environ.get("WORKER_LAUNCH_MAX_PARALLEL", "1")), 20))
METADATA_ROOT = "http://metadata.google.internal/computeMetadata/v1"
WAKE_TIMEOUT_SECONDS = max(1, int(os.environ.get("WORKER_WAKE_TIMEOUT_SECONDS", "5")))
COLD_START_STATUSES = {502, 503, 504}


def job_map() -> dict[str, str]:
    try:
        raw = json.loads(os.environ.get("WORKER_LAUNCH_JOBS", "") or "{}")
    except ValueError:
        return {}
    return {str(queue): str(job) for queue, job in raw.items() if queue and job} if isinstance(raw, dict) else {}


def wake_url_map() -> dict[str, str]:
    try:
        raw = json.loads(os.environ.get("WORKER_WAKE_URLS", "") or "{}")
    except ValueError:
        return {}
    return {str(job): str(url) for job, url in raw.items() if job and url} if isinstance(raw, dict) else {}


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


def _wake_http_worker(job_name: str, slot: int) -> None:
    """Ask a sleeping worker service to drain its queues.

    A worker coming out of sleep can take longer than this timeout to answer.
    The request has already woken it and it drains on start, so a timeout or a
    gateway error is treated as delivered; the lease expires if the worker never
    comes up, and the cron pass wakes it again.
    """
    url = wake_url_map().get(job_name, "")
    secret = os.environ.get("WORKER_WAKE_SECRET", "")
    if not url.startswith(("http://", "https://")) or not secret:
        raise RuntimeError(f"No wake URL or secret configured for {job_name}")
    # Private DNS exposes service replica addresses. Wake each address so warm,
    # idle replicas are not missed by a request reaching only one busy worker.
    urls = [url]
    target = autoscaling.target_for_job(job_name)
    if target is not None:
        parsed = urllib.parse.urlsplit(url)
        if parsed.scheme != "http" or not (parsed.hostname or "").endswith(".railway.internal"):
            raise RuntimeError("Replica wakes require Railway private HTTP")
        # Each replica may publish an IPv4 and an IPv6 address.
        address_limit = max(6, 2 * target.max_replicas())
        try:
            addresses = list(dict.fromkeys(row[4][0] for row in socket.getaddrinfo(
                parsed.hostname, parsed.port or 80, type=socket.SOCK_STREAM)))[:address_limit]
        except socket.gaierror:
            addresses = []  # Preserve the original hostname wake/retry path.
        urls += [urllib.parse.urlunsplit(("http", (
            f"[{address}]" if ":" in address else address) + f":{parsed.port or 80}",
            parsed.path, parsed.query, "")) for address in addresses]
    if len(urls) == 1:
        _deliver_wake(url, slot, secret)
        return
    # These threads exist only for this wake request; no idle polling loop.
    with ThreadPoolExecutor(max_workers=len(urls)) as pool:
        attempts = [pool.submit(_deliver_wake, target, slot, secret) for target in urls]
        delivered = False
        for attempt in attempts:
            try:
                attempt.result()
                delivered = True
            except (OSError, urllib.error.URLError):
                pass
    if not delivered:
        raise RuntimeError("No render replica accepted its wake request")


def _deliver_wake(url, slot, secret):
    request = urllib.request.Request(
        url, data=json.dumps({"slot": slot}).encode("utf-8"), method="POST",
        headers={"Content-Type": "application/json", "X-Worker-Wake-Secret": secret},
    )
    try:
        with urllib.request.urlopen(request, timeout=WAKE_TIMEOUT_SECONDS) as response:  # nosec B310 - operator-configured URL
            response.read()
    except TimeoutError:
        return
    except urllib.error.HTTPError as error:
        # Railway can answer the request that wakes a sleeping service with a
        # 502/503 while the container boots; the worker drains on start.
        if error.code in COLD_START_STATUSES:
            return
        raise
    except urllib.error.URLError as error:
        if isinstance(error.reason, TimeoutError):
            return
        raise


def _default_launcher(job_name: str, slot: int) -> None:
    urls = wake_url_map()
    if job_name in urls:
        _wake_http_worker(job_name, slot)
    elif (urls or os.environ.get("WORKER_WAKE_URLS", "").strip()
          or os.environ.get("RAILWAY_ENVIRONMENT_ID", "").strip()):
        # Wake-on-HTTP is configured (Railway); never fall back to Cloud Run.
        raise RuntimeError(f"WORKER_WAKE_URLS is missing or invalid for {job_name}")
    else:
        _run_cloud_run_job(job_name, slot)


def _queue_backlog(connection, queue_names) -> int:
    return sum(int(connection.llen(f"rq:queue:{name}") or 0) for name in queue_names)


def kick(connection, queue_name: str, *, launcher=None, log=print) -> bool:
    """Make sure a worker will serve `queue_name`. Call after the job is enqueued."""
    job_name = job_map().get(queue_name)
    if not job_name or connection is None:
        return False
    launcher = launcher or _default_launcher
    target = autoscaling.target_for_job(job_name)
    if target is not None:
        autoscaling.reconcile(connection, log=log, target=target)
    queues = [name for name, job in job_map().items() if job == job_name]
    try:
        backlog = _queue_backlog(connection, queues)
        if backlog <= 0:
            return False
        active = [slot for slot in range(MAX_PARALLEL) if connection.exists(lease_key(job_name, slot))]
        # One more worker only when the backlog outgrows the ones already running.
        active_count = (sum(1 for _ in connection.scan_iter(match=lease_key(job_name, "*") ))
                        if target is not None else len(active))
        # An autoscaled service is fully awake once every allowed replica holds
        # a lease; otherwise one more worker only when the backlog outgrows them.
        if active_count and ((target is not None and active_count >= max(MAX_PARALLEL, target.max_replicas()))
                             or (target is None and backlog <= active_count)):
            return False
        # With autoscaling on, a service without it keeps a single launch slot.
        slot_limit = (1 if autoscaling.enabled_targets() and target is None else MAX_PARALLEL)
        for slot in range(slot_limit):
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


# A kick can wait on the Railway API (render scaling) and on wake requests to a
# sleeping worker for several seconds. Request paths hand kicks to this small
# pool so one export submission never stalls the API's event loop or threads.
_BACKGROUND_KICKS = ThreadPoolExecutor(max_workers=2, thread_name_prefix="worker-kick")
_PENDING_KICKS: set[str] = set()
_PENDING_KICKS_LOCK = threading.Lock()


def kick_in_background(connection, queue_name: str, *, log=print) -> bool:
    """Schedule kick() off the request path; coalesce kicks not yet started."""
    if not job_map().get(queue_name) or connection is None:
        return False
    with _PENDING_KICKS_LOCK:
        if queue_name in _PENDING_KICKS:
            return False
        _PENDING_KICKS.add(queue_name)

    def run():
        # Clear before kicking: a job enqueued while this kick runs schedules
        # another pass instead of being coalesced into a decision already made.
        with _PENDING_KICKS_LOCK:
            _PENDING_KICKS.discard(queue_name)
        try:
            kick(connection, queue_name, log=log)
        except Exception as error:
            log(json.dumps({"event": "worker_kick_failed", "queue": queue_name, "error": str(error)}))

    try:
        _BACKGROUND_KICKS.submit(run)
    except RuntimeError:
        # Interpreter shutdown: the cron safety net launches workers later.
        with _PENDING_KICKS_LOCK:
            _PENDING_KICKS.discard(queue_name)
        return False
    return True


THROTTLE_PREFIX = "lekha:worker_kick_throttle"


def kick_throttled(connection, queue_name: str, *, interval_seconds: int = 30, log=print) -> bool:
    """Background kick at most once per interval per queue across API replicas.

    Status polls use this as a safety net for crashed or never-woken workers;
    every queued customer polls, so an unthrottled kick multiplies wake and
    scaling calls by the number of waiting customers."""
    if not job_map().get(queue_name) or connection is None:
        return False
    try:
        if not connection.set(f"{THROTTLE_PREFIX}:{queue_name}", "1", nx=True, ex=max(1, int(interval_seconds))):
            return False
    except Exception as error:
        log(json.dumps({"event": "worker_kick_throttle_failed", "queue": queue_name, "error": str(error)}))
        return False
    return kick_in_background(connection, queue_name, log=log)


class WorkerLease:
    """The running worker's side of the lease.

    Cloud Run sets CLOUD_RUN_JOB; a wake-on-HTTP worker sets WORKER_LAUNCH_JOB_NAME
    to the same name the API maps its queues to in WORKER_LAUNCH_JOBS.
    """

    def __init__(self, connection, queue_names):
        self.connection = connection
        self.queue_names = list(queue_names)
        self.job_name = os.environ.get("CLOUD_RUN_JOB", "") or os.environ.get("WORKER_LAUNCH_JOB_NAME", "")
        self.slot = int(os.environ.get("WORKER_LAUNCH_SLOT", "0") or 0)
        self.key = lease_key(self.job_name, self.slot) if self.job_name else ""
        self.drain_lease = None
        target = autoscaling.target_for_job(self.job_name)
        if target is not None and os.environ.get("RAILWAY_REPLICA_ID"):
            identity = os.environ["RAILWAY_REPLICA_ID"]
            self.key = lease_key(self.job_name, "replica:" + identity)
            self.drain_lease = autoscaling.DrainLease(connection, identity, target=target)

    def refresh(self) -> None:
        if self.drain_lease is not None:
            starting = not self.drain_lease.registered
            self.drain_lease.refresh()
            if starting:
                self.connection.delete(*(lease_key(self.job_name, slot)
                                         for slot in range(max(3, MAX_PARALLEL))))
        if self.key:
            self.connection.set(self.key, str(time.time()), ex=LEASE_SECONDS)

    def release(self) -> None:
        if self.drain_lease is not None:
            self.drain_lease.release()
        if self.key:
            self.connection.delete(self.key)

    def release_and_should_continue(self) -> bool:
        """Release the lease, then re-check; keep working if a job slipped in."""
        if not self.key:
            return False
        self.connection.delete(self.key)
        if _queue_backlog(self.connection, self.queue_names) <= 0:
            return False
        # Someone may have launched a fresh worker already; then let it serve.
        return bool(self.connection.set(self.key, str(time.time()), nx=True, ex=LEASE_SECONDS))
