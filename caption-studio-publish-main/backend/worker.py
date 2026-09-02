import redis
import os
import socket
import threading
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from rq import Worker

try:
    from .main import EXPORT_QUEUE_NAME, REDIS_URL
except ImportError:  # Direct execution from backend/ remains supported.
    from main import EXPORT_QUEUE_NAME, REDIS_URL


def _start_readiness_server(conn):
    """Expose the same readiness path Railway uses for the web service."""
    class ReadinessHandler(BaseHTTPRequestHandler):
        def do_GET(self):
            if self.path not in ("/api/health/readiness", "/health"):
                self.send_response(404)
                self.end_headers()
                return
            try:
                conn.ping()
                payload = b'{"status":"ready","role":"worker"}'
                self.send_response(200)
            except Exception:
                payload = b'{"status":"unavailable","role":"worker"}'
                self.send_response(503)
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
    conn = redis.Redis.from_url(REDIS_URL)
    conn.ping()
    _start_readiness_server(conn)
    # Every replica needs a distinct RQ identity; a fixed name makes the second
    # Railway replica fail registration with "active worker already exists".
    host = os.environ.get("HOSTNAME") or socket.gethostname()
    worker_name = f"caption-export-worker-{host}-{uuid.uuid4().hex[:8]}"
    worker = Worker([EXPORT_QUEUE_NAME], connection=conn, name=worker_name)
    worker.work(with_scheduler=True)


if __name__ == "__main__":
    run_worker()
