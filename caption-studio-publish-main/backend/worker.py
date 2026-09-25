import redis
import os
import socket
import threading
import uuid
import json
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from rq import Worker

try:
    from .main import (
        EXPORT_QUEUE_NAME,
        TRANSCRIPTION_QUEUE_NAME,
        MEDIA_SCAN_QUEUE_NAME,
        REDIS_URL,
        cleanup_local_media_artifacts,
    )
    from .release_metadata import release_metadata
    from .gcp_scale_in import ScaleInProtector
    from .gcp_queue_metrics import publish_worker_cold_start
except ImportError:  # Direct execution from backend/ remains supported.
    from main import (
        EXPORT_QUEUE_NAME,
        TRANSCRIPTION_QUEUE_NAME,
        MEDIA_SCAN_QUEUE_NAME,
        REDIS_URL,
        cleanup_local_media_artifacts,
    )
    from release_metadata import release_metadata
    from gcp_scale_in import ScaleInProtector
    from gcp_queue_metrics import publish_worker_cold_start


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

    def heartbeat(self, timeout=None, pipeline=None):
        super().heartbeat(timeout=timeout, pipeline=pipeline)
        metadata = release_metadata("worker")
        (pipeline if pipeline is not None else self.connection).hset(self.key, mapping={
            "app_release": metadata["release"],
            "release_metadata": json.dumps(metadata),
            "draining": "1" if WORKER_STATE["draining"] else "0",
        })
        WORKER_STATE["heartbeat_at"] = time.monotonic()

    def request_stop(self, signum, frame):
        WORKER_STATE["draining"] = True
        try:
            self.connection.hset(self.key, "draining", "1")
        except redis.RedisError:
            # Redis may be the reason for shutdown; still let RQ drain locally.
            pass
        return super().request_stop(signum, frame)

    def perform_job(self, job, queue):
        protected = False
        try:
            protected = self.scale_in_protector.set(True)
        except Exception as error:
            print(json.dumps({"event": "scale_in_protection_failed", "error": str(error)}), flush=True)
        try:
            return super().perform_job(job, queue)
        finally:
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


def run_worker():
    if not REDIS_URL:
        raise RuntimeError("REDIS_URL is required for worker mode.")
    conn = redis.Redis.from_url(REDIS_URL, socket_connect_timeout=5)
    conn.ping()
    health_conn = redis.Redis.from_url(REDIS_URL, socket_connect_timeout=5, socket_timeout=5)
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
