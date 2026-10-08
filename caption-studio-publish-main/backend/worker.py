import redis
import os
import signal
import socket
import threading
import uuid
import json
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from rq import Worker

try:
    from . import main as api
    from .maintenance_jobs import cleanup_local_media_artifacts
    from .settings import (
        EXPORT_QUEUE_NAME,
        TRANSCRIPTION_QUEUE_NAME,
        MEDIA_SCAN_QUEUE_NAME,
        REDIS_URL,
    )
    from .release_metadata import release_metadata
    from .gcp_scale_in import ScaleInProtector
    from .gcp_queue_metrics import publish_worker_cold_start
    from .redis_config import connect_redis
    from .idle_connections import disconnect_idle_redis_clients
    from .worker_launcher import WorkerLease
except ImportError:  # Direct execution from backend/ remains supported.
    import main as api
    from maintenance_jobs import cleanup_local_media_artifacts
    from settings import (
        EXPORT_QUEUE_NAME,
        TRANSCRIPTION_QUEUE_NAME,
        MEDIA_SCAN_QUEUE_NAME,
        REDIS_URL,
    )
    from release_metadata import release_metadata
    from gcp_scale_in import ScaleInProtector
    from gcp_queue_metrics import publish_worker_cold_start
    from redis_config import connect_redis
    from idle_connections import disconnect_idle_redis_clients
    from worker_launcher import WorkerLease


WORKER_STATE = {"heartbeat_at": 0.0, "draining": False}
LOCAL_CLEANUP_INTERVAL_SECONDS = 15 * 60


def _local_cleanup_loop(stop_event):
    """Prune this container's scratch volume; API janitors cannot see worker disks."""
    while not stop_event.is_set():
        try:
            metrics = cleanup_local_media_artifacts()
            deleted = sum(value for key, value in metrics.items() if key.endswith("_deleted"))
            if deleted or metrics.get("errors"):
                print(json.dumps({"event": "worker_local_janitor", **metrics}), flush=True)
        except Exception as error:
            print(json.dumps({"event": "worker_local_janitor_failed", "error": str(error)}), flush=True)
        stop_event.wait(LOCAL_CLEANUP_INTERVAL_SECONDS)


class ReleaseWorker(Worker):
    scale_in_protector = ScaleInProtector()
    launch_lease = None

    def handle_job_failure(self, job, queue, started_job_registry=None, exc_string=""):
        # SIGKILL bypasses the task's exception handler. Repair its application
        # state before RQ schedules the retry, including failures in work horses.
        if job.should_retry and self._stopped_job_id != job.id:
            try:
                api.recover_interrupted_export_retry(job.id)
            except Exception as error:
                self.log.warning("Export retry reconciliation failed for %s: %s", job.id, type(error).__name__)
        return super().handle_job_failure(job, queue, started_job_registry, exc_string)

    def heartbeat(self, timeout=None, pipeline=None):
        super().heartbeat(timeout=timeout, pipeline=pipeline)
        metadata = release_metadata("worker")
        (pipeline if pipeline is not None else self.connection).hset(self.key, mapping={
            "app_release": metadata["release"],
            "release_metadata": json.dumps(metadata),
            "draining": "1" if WORKER_STATE["draining"] else "0",
            "worker_group": os.environ.get("WORKER_MIG_NAME", "unknown"),
        })
        WORKER_STATE["heartbeat_at"] = time.monotonic()
        if self.launch_lease is not None:
            self.launch_lease.refresh()

    def request_stop(self, signum, frame):
        WORKER_STATE["draining"] = True
        try:
            self.connection.hset(self.key, "draining", "1")
        except redis.RedisError:
            # Redis may be the reason for shutdown; still let RQ drain locally.
            pass
        return super().request_stop(signum, frame)

    def perform_job(self, job, queue):
        cleanup_local_media_artifacts()
        protected = False
        try:
            protected = self.scale_in_protector.set(True)
        except Exception as error:
            print(json.dumps({"event": "scale_in_protection_failed", "error": str(error)}), flush=True)
        try:
            return super().perform_job(job, queue)
        finally:
            cleanup_local_media_artifacts()
            if protected:
                try:
                    self.scale_in_protector.set(False)
                except Exception as error:
                    print(json.dumps({"event": "scale_in_unprotect_failed", "error": str(error)}), flush=True)


def _worker_ready(conn):
    return bool(not WORKER_STATE["draining"] and
                0 < time.monotonic() - WORKER_STATE["heartbeat_at"] < 180 and conn.ping())


def _start_readiness_server(conn):
    """Expose the same readiness path Railway uses for the web service."""
    class ReadinessHandler(BaseHTTPRequestHandler):
        def do_GET(self):
            if self.path in ("/api/version", "/release.json"):
                payload = json.dumps(release_metadata("worker")).encode("utf-8")
                status = 200
            elif self.path in ("/api/health", "/health"):
                payload, status = b'{"status":"alive","role":"worker"}', 200
            elif self.path in ("/api/health/readiness", "/ready"):
                try:
                    ready = _worker_ready(conn)
                except Exception:
                    ready = False
                payload = json.dumps({"ready": ready, "role": "worker"}).encode("utf-8")
                status = 200 if ready else 503
            else:
                self.send_response(404)
                self.end_headers()
                return
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        def log_message(self, _format, *_args):
            return

    port = int(os.environ.get("PORT", "8000"))
    # Railway's private health proxy must reach this container listener. The
    # worker has no public domain and exposes only readiness state.
    server = ThreadingHTTPServer(("0.0.0.0", port), ReadinessHandler)  # nosec B104
    threading.Thread(target=server.serve_forever, name="worker-readiness", daemon=True).start()
    return server


def worker_queue_names():
    configured = os.environ.get("WORKER_QUEUES")
    names = list(dict.fromkeys(name.strip() for name in (
        configured.split(",")
        if configured is not None
        else [EXPORT_QUEUE_NAME, MEDIA_SCAN_QUEUE_NAME, TRANSCRIPTION_QUEUE_NAME]
    ) if name.strip()))
    if not names:
        raise RuntimeError("WORKER_QUEUES must contain at least one queue")
    return names


# On-demand mode (a Cloud Run Job started by worker_launcher): drain the queues,
# wait this long for stragglers, then exit so nothing is billed while idle.
WORKER_IDLE_EXIT_SECONDS = int(os.environ.get("WORKER_IDLE_EXIT_SECONDS", "0") or 0)


def run_on_demand_worker(conn):
    queues = worker_queue_names()
    lease = WorkerLease(conn, queues)
    host = os.environ.get("CLOUD_RUN_EXECUTION") or socket.gethostname()
    while True:
        lease.refresh()
        worker = ReleaseWorker(queues, connection=conn, worker_ttl=90,
                               name=f"caption-worker-{host}-{uuid.uuid4().hex[:8]}")
        worker.launch_lease = lease
        worker.work(burst=False, max_idle_time=WORKER_IDLE_EXIT_SECONDS,
                    with_scheduler=True, dequeue_strategy="round_robin")
        if not lease.release_and_should_continue():
            break
    cleanup_local_media_artifacts()


# Wake-on-HTTP mode (Railway): the service sleeps while idle. The API's
# worker_launcher POSTs /wake after enqueueing; the worker drains its queues,
# then drops its Redis connections so no traffic keeps the service awake.
WORKER_WAKE_SECRET = os.environ.get("WORKER_WAKE_SECRET", "")
# Retries scheduled further out than this are left for the next wake (or the
# cron safety net) instead of keeping the worker awake for them.
WAKE_SCHEDULED_WAIT_SECONDS = max(0, int(os.environ.get("WORKER_WAKE_SCHEDULED_WAIT_SECONDS", "330")))


def _seconds_until_next_scheduled(conn, queue_names, now=None):
    """Seconds until the earliest scheduled (retry) job, or None when there is none."""
    now = time.time() if now is None else now
    earliest = None
    for name in queue_names:
        rows = conn.zrange(f"rq:scheduled:{name}", 0, 0, withscores=True)
        if rows:
            earliest = rows[0][1] if earliest is None else min(earliest, rows[0][1])
    return None if earliest is None else max(0.0, earliest - now)


def drain_queues(conn, queue_names, *, worker_factory=None, sleep=time.sleep, log=print):
    """Run queued and soon-due scheduled jobs to completion, then return."""
    lease = WorkerLease(conn, queue_names)
    try:
        return _drain_with_lease(conn, queue_names, lease, worker_factory=worker_factory, sleep=sleep, log=log)
    finally:
        lease.release()


def _drain_with_lease(conn, queue_names, lease, *, worker_factory, sleep, log):
    host = os.environ.get("RAILWAY_REPLICA_ID") or socket.gethostname()
    make_worker = worker_factory or (lambda: ReleaseWorker(
        queue_names, connection=conn, worker_ttl=90,
        name=f"caption-worker-{host}-{uuid.uuid4().hex[:8]}",
    ))
    while True:
        lease.refresh()
        worker = make_worker()
        worker.launch_lease = lease
        try:
            worker.work(burst=True, with_scheduler=True, dequeue_strategy="round_robin")
        finally:
            # RQ's scheduler owns a separate, lazily-created Redis pool. Its
            # child exits in work() teardown, but the parent's pool stays open.
            # Read _connection so cleanup never opens a new idle connection.
            scheduler = getattr(worker, "scheduler", None)
            disconnect_idle_redis_clients(getattr(scheduler, "_connection", None))
        _install_idle_signal_handlers()
        if getattr(worker, "_shutdown_requested_date", None):
            # SIGTERM (redeploy/sleep): RQ finished the running job first. Free
            # the slot so the next enqueue wakes the replacement immediately.
            lease.release()
            return False
        wait = _seconds_until_next_scheduled(conn, queue_names)
        if wait is not None and wait <= WAKE_SCHEDULED_WAIT_SECONDS:
            log(json.dumps({"event": "worker_waiting_for_retry", "seconds": round(wait)}))
            sleep(wait + 1)
            continue
        if not lease.release_and_should_continue():
            return True


def _exit_on_signal(_signum, _frame):
    raise SystemExit(0)


def _install_idle_signal_handlers():
    """Exit at once on SIGTERM while no job runs; RQ replaces these during work()."""
    if threading.current_thread() is threading.main_thread():
        signal.signal(signal.SIGTERM, _exit_on_signal)
        signal.signal(signal.SIGINT, _exit_on_signal)


class _WakeState:
    def __init__(self):
        self.lock = threading.Lock()
        self.requested = threading.Event()
        self.running = False


def _drain_loop(state, queue_names, *, drain=None):
    """Runs on the main thread: RQ installs its SIGTERM handlers in work()."""
    drain = drain or drain_queues
    keep_serving = True
    while keep_serving:
        state.requested.wait()
        with state.lock:
            state.requested.clear()
            state.running = True
        conn = None
        try:
            conn = connect_redis(REDIS_URL)
            cleanup_local_media_artifacts()
            keep_serving = drain(conn, queue_names) is not False
            cleanup_local_media_artifacts()
        except Exception as error:
            print(json.dumps({"event": "worker_drain_failed", "error": str(error)}), flush=True)
        finally:
            if conn is not None:
                conn.connection_pool.disconnect()
            # Importing the API opens two additional Redis pools. Disconnect
            # those too; Redis's server keepalives otherwise keep idle workers awake.
            disconnect_idle_redis_clients(api.app_state._redis_client, api.app_state._rq_redis_client)
            with state.lock:
                state.running = False
        print(json.dumps({"event": "worker_idle" if keep_serving else "worker_stopped"}), flush=True)


def _wake_handler(state):
    import hmac

    class WakeHandler(BaseHTTPRequestHandler):
        def _reply(self, status, payload):
            body = json.dumps(payload).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            if self.path in ("/health", "/api/health", "/api/health/readiness", "/ready"):
                self._reply(200, {"status": "alive", "role": "worker", "draining": state.running})
            elif self.path in ("/api/version", "/release.json"):
                self._reply(200, release_metadata("worker"))
            else:
                self._reply(404, {"error": "not found"})

        def do_POST(self):
            if self.path != "/wake":
                self._reply(404, {"error": "not found"})
                return
            supplied = self.headers.get("X-Worker-Wake-Secret", "")
            if not hmac.compare_digest(supplied.encode("utf-8"), WORKER_WAKE_SECRET.encode("utf-8")):
                self._reply(403, {"error": "forbidden"})
                return
            state.requested.set()
            self._reply(202, {"accepted": True})

        def log_message(self, _format, *_args):
            return

    return WakeHandler


def run_wake_server():
    if len(WORKER_WAKE_SECRET) < 16:
        raise RuntimeError("WORKER_WAKE_SECRET must be at least 16 characters.")
    if not os.environ.get("WORKER_LAUNCH_JOB_NAME"):
        raise RuntimeError("WORKER_LAUNCH_JOB_NAME must match this worker's name in the API's WORKER_LAUNCH_JOBS.")
    queues = worker_queue_names()
    state = _WakeState()

    class DualStackServer(ThreadingHTTPServer):
        # Railway private networking is IPv6; "::" also accepts IPv4 here.
        address_family = socket.AF_INET6
        daemon_threads = True

    class IPv4Server(ThreadingHTTPServer):
        daemon_threads = True

    port = int(os.environ.get("PORT", "8080"))
    try:
        server = DualStackServer(("::", port), _wake_handler(state))  # nosec B104 - service-internal wake endpoint
    except OSError:
        # Hosts without IPv6 (local Docker, CI) still get the wake endpoint.
        server = IPv4Server(("0.0.0.0", port), _wake_handler(state))  # nosec B104 - service-internal wake endpoint
    threading.Thread(target=server.serve_forever, name="worker-wake-server", daemon=True).start()
    print(json.dumps({"event": "worker_wake_server_started", "port": port, "queues": queues}), flush=True)
    _install_idle_signal_handlers()
    # A worker starting from sleep was woken for a reason; drain once now.
    state.requested.set()
    _drain_loop(state, queues)


def run_worker():
    if not REDIS_URL:
        raise RuntimeError("REDIS_URL is required for worker mode.")
    if WORKER_WAKE_SECRET:
        run_wake_server()
        return
    conn = connect_redis(REDIS_URL)
    conn.ping()
    if WORKER_IDLE_EXIT_SECONDS > 0:
        try:
            run_on_demand_worker(conn)
        finally:
            conn.close()
        return
    health_conn = connect_redis(REDIS_URL, socket_timeout=5)
    server = _start_readiness_server(health_conn)
    cleanup_stop = threading.Event()
    cleanup_thread = threading.Thread(
        target=_local_cleanup_loop,
        args=(cleanup_stop,),
        name="worker-local-janitor",
        daemon=True,
    )
    cleanup_thread.start()
    # Every replica needs a distinct RQ identity; a fixed name makes the second
    # Railway replica fail registration with "active worker already exists".
    host = os.environ.get("HOSTNAME") or socket.gethostname()
    worker_name = f"caption-export-worker-{host}-{uuid.uuid4().hex[:8]}"
    worker = ReleaseWorker(worker_queue_names(), connection=conn, name=worker_name, worker_ttl=90)
    boot_epoch = int(float(os.environ.get("VM_BOOT_EPOCH", "0") or 0))
    if boot_epoch > 0:
        try:
            publish_worker_cold_start(
                int(time.time()) - boot_epoch,
                os.environ.get("WORKER_MIG_NAME", "unknown"),
                host,
            )
        except Exception as error:
            print(json.dumps({"event": "worker_cold_start_metric_failed", "error": str(error)}), flush=True)
    try:
        worker.work(with_scheduler=True, dequeue_strategy="round_robin")
    finally:
        WORKER_STATE["draining"] = True
        cleanup_stop.set()
        cleanup_thread.join(timeout=5)
        server.shutdown()
        server.server_close()
        health_conn.close()
        conn.close()


if __name__ == "__main__":
    run_worker()
