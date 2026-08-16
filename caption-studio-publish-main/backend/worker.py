import redis
import os
import socket
import uuid
from rq import Worker

try:
    from .main import EXPORT_QUEUE_NAME, REDIS_URL
except ImportError:  # Direct execution from backend/ remains supported.
    from main import EXPORT_QUEUE_NAME, REDIS_URL


def run_worker():
    if not REDIS_URL:
        raise RuntimeError("REDIS_URL is required for worker mode.")
    conn = redis.Redis.from_url(REDIS_URL)
    # Every replica needs a distinct RQ identity; a fixed name makes the second
    # Railway replica fail registration with "active worker already exists".
    host = os.environ.get("HOSTNAME") or socket.gethostname()
    worker_name = f"caption-export-worker-{host}-{uuid.uuid4().hex[:8]}"
    worker = Worker([EXPORT_QUEUE_NAME], connection=conn, name=worker_name)
    worker.work(with_scheduler=True)


if __name__ == "__main__":
    run_worker()
