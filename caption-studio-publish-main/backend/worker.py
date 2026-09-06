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
    from .main import EXPORT_QUEUE_NAME, REDIS_URL
    from .release_metadata import release_metadata
except ImportError:  # Direct execution from backend/ remains supported.
    from main import EXPORT_QUEUE_NAME, REDIS_URL
    from release_metadata import release_metadata


WORKER_STATE = {"heartbeat_at": 0.0, "draining": False}


class ReleaseWorker(Worker):
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


def run_worker():
    if not REDIS_URL:
        raise RuntimeError("REDIS_URL is required for worker mode.")
    conn = redis.Redis.from_url(REDIS_URL, socket_connect_timeout=5)
    conn.ping()
    health_conn = redis.Redis.from_url(REDIS_URL, socket_connect_timeout=5, socket_timeout=5)
    server = _start_readiness_server(health_conn)
    # Every replica needs a distinct RQ identity; a fixed name makes the second
    # Railway replica fail registration with "active worker already exists".
    host = os.environ.get("HOSTNAME") or socket.gethostname()
    worker_name = f"caption-export-worker-{host}-{uuid.uuid4().hex[:8]}"
    worker = ReleaseWorker([EXPORT_QUEUE_NAME], connection=conn, name=worker_name, worker_ttl=90)
    try:
        worker.work(with_scheduler=True)
    finally:
        WORKER_STATE["draining"] = True
        server.shutdown()
        server.server_close()
        health_conn.close()
        conn.close()


if __name__ == "__main__":
    run_worker()
