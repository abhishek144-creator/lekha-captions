"""Atomic backlog admission across API replicas using the RQ queue transaction."""
import math

from fastapi import HTTPException
from redis.exceptions import WatchError


PENDING_WORK_LEDGER_KEY = "lekha:render:pending_work_seconds"


def _text(value):
    return value.decode("utf-8") if isinstance(value, bytes) else str(value)


def _bounded_work_seconds(value, fallback=120):
    try:
        seconds = int(value)
    except (TypeError, ValueError):
        seconds = fallback
    return min(3600, max(15, seconds))


def release_pending_work(connection, job_id, work_key=PENDING_WORK_LEDGER_KEY):
    """Remove a job from the predicted-work ledger when it leaves a queue."""
    if connection is not None and job_id:
        connection.hdel(work_key, str(job_id))


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


def enqueue_bounded_across_queues(
    queue,
    queues,
    max_pending,
    *,
    max_pending_work_seconds=None,
    estimated_work_seconds=None,
    work_key=PENDING_WORK_LEDGER_KEY,
    fallback_work_seconds=120,
    **job,
):
    """Atomically enforce count and predicted-work ceilings across render classes.

    The work ledger is maintained in the same Redis transaction as the RQ list.
    Stale ledger entries are pruned from the live queue IDs on every admission,
    so a worker crash or expired job cannot permanently consume capacity.
    """
    unique_queues = list({item.key: item for item in queues}.values())
    keys = [item.key for item in unique_queues]
    job_id = str(job.get("job_id") or "")
    requested_work = _bounded_work_seconds(
        estimated_work_seconds,
        fallback=fallback_work_seconds,
    )
    for _ in range(5):
        with queue.connection.pipeline() as pipeline:
            try:
                pipeline.watch(*keys, work_key)
                queued_job_ids = []
                for key in keys:
                    queued_job_ids.extend(_text(item) for item in pipeline.lrange(key, 0, -1))
                if len(queued_job_ids) >= max_pending:
                    raise HTTPException(
                        status_code=429,
                        detail="Export capacity is temporarily full. Retry after 5 mins.",
                        headers={"Retry-After": "300"},
                    )
                ledger = {
                    _text(key): _bounded_work_seconds(value, fallback=fallback_work_seconds)
                    for key, value in pipeline.hgetall(work_key).items()
                }
                pending_work = sum(
                    ledger.get(queued_job_id, fallback_work_seconds)
                    for queued_job_id in queued_job_ids
                )
                if (
                    max_pending_work_seconds is not None
                    and pending_work + requested_work > int(max_pending_work_seconds)
                ):
                    retry_after = min(300, max(30, math.ceil(requested_work)))
                    raise HTTPException(
                        status_code=429,
                        detail="Predicted export wait is temporarily full. Please retry shortly.",
                        headers={"Retry-After": str(retry_after)},
                    )
                pipeline.multi()
                stale_job_ids = set(ledger) - set(queued_job_ids)
                if stale_job_ids:
                    pipeline.hdel(work_key, *sorted(stale_job_ids))
                delivery = queue.enqueue_call(pipeline=pipeline, **job)
                if job_id:
                    pipeline.hset(work_key, job_id, requested_work)
                pipeline.execute()
                return delivery
            except WatchError:
                continue
    raise HTTPException(503, "Export service is busy. Please retry shortly.", headers={"Retry-After": "2"})
