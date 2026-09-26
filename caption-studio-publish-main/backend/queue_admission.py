"""Atomic backlog admission across API replicas using the RQ queue transaction."""
from fastapi import HTTPException
from redis.exceptions import WatchError


def enqueue_bounded(queue, max_pending, **job):
    for _ in range(5):
        with queue.connection.pipeline() as pipeline:
            try:
                pipeline.watch(queue.key)
                if pipeline.llen(queue.key) >= max_pending:
                    raise HTTPException(
                        status_code=429,
                        detail="Export capacity is temporarily full. Retry after 5 mins.",
                        headers={"Retry-After": "300"},
                    )
                pipeline.multi()
                delivery = queue.enqueue_call(pipeline=pipeline, **job)
                pipeline.execute()
                return delivery
            except WatchError:
                continue
    raise HTTPException(503, "Export service is busy. Please retry shortly.", headers={"Retry-After": "2"})


def enqueue_bounded_across_queues(queue, queues, max_pending, **job):
    """Atomically enforce one pending-job ceiling across render classes."""
    unique_queues = list({item.key: item for item in queues}.values())
    keys = [item.key for item in unique_queues]
    for _ in range(5):
        with queue.connection.pipeline() as pipeline:
            try:
                pipeline.watch(*keys)
                if sum(int(pipeline.llen(key)) for key in keys) >= max_pending:
                    raise HTTPException(
                        status_code=429,
                        detail="Export capacity is temporarily full. Retry after 5 mins.",
                        headers={"Retry-After": "300"},
                    )
                pipeline.multi()
                delivery = queue.enqueue_call(pipeline=pipeline, **job)
                pipeline.execute()
                return delivery
            except WatchError:
                continue
    raise HTTPException(503, "Export service is busy. Please retry shortly.", headers={"Retry-After": "2"})
