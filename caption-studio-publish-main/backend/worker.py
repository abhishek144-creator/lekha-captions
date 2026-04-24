import os

import redis
from rq import Worker

from main import EXPORT_QUEUE_NAME, REDIS_URL


def run_worker():
    if not REDIS_URL:
        raise RuntimeError("REDIS_URL is required for worker mode.")
    conn = redis.Redis.from_url(REDIS_URL)
    worker = Worker([EXPORT_QUEUE_NAME], connection=conn)
    worker.work(with_scheduler=True)


if __name__ == "__main__":
    run_worker()
