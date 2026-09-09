"""Atomic backlog admission across API replicas using the RQ queue transaction."""
from fastapi import HTTPException
from redis.exceptions import WatchError


def enqueue_bounded(queue, max_pending, **job):
    for _ in range(5):
        with queue.connection.pipeline() as pipeline:
            try:
                pipeline.watch(queue.key)
                if pipeline.llen(queue.key) >= max_pending:
                    raise HTTPException(429, "Export capacity is temporarily full. Please retry shortly.",
                                        headers={"Retry-After": "10"})
                pipeline.multi()
                delivery = queue.enqueue_call(pipeline=pipeline, **job)
                pipeline.execute()
                return delivery
            except WatchError:
                continue
    raise HTTPException(503, "Export service is busy. Please retry shortly.", headers={"Retry-After": "2"})
