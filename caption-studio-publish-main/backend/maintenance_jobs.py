"""Janitor, scheduled reconciliation, queue metrics and background dispatch loops.

The factory accepts explicit configuration, adapters and shared state through
ServiceContext. It has no dependency on the HTTP entry point.
"""

from types import SimpleNamespace
from typing import Protocol, Any


from typing import Dict
import asyncio
import os
import time
import uuid

class ServiceContext(Protocol):
    DEAD_LETTER_DIR: Any
    DEBUG_MODE_ENABLED: Any
    EXPORT_DIR: Any
    EXPORT_QUEUE_NAME: Any
    GPU_EXPORT_QUEUE_NAME: Any
    GPU_RENDER_ENABLED: Any
    GPU_WORKER_MIG_NAME: Any
    HEAVY_EXPORT_QUEUE_NAME: Any
    Job: Any
    MEDIA_SCAN_QUEUE_NAME: Any
    PAYMENT_RECONCILE_INTERVAL_MINUTES: Any
    QUEUE_METRICS_INTERVAL_SECONDS: Any
    RENDER_CACHE_DIR: Any
    RQWorker: Any
    SPOT_WORKER_MIG_NAME: Any
    TRANSCRIPTION_CACHE_DIR: Any
    TRANSCRIPTION_MIG_NAME: Any
    TRANSCRIPTION_QUEUE_NAME: Any
    UPLOAD_DIR: Any
    WORKER_MIG_NAME: Any
    _IS_PRODUCTION: Any
    _advanced_janitor_once: Any
    _claim_scheduled_job: Any
    _export_queue: Any
    _export_queues: Any
    _json_log: Any
    _media_scan_queue: Any
    _publish_queue_metrics_once: Any
    _redis_client: Any
    _release_scheduled_job: Any
    _rq_redis_client: Any
    _transcription_queue: Any
    advanced_janitor_job: Any
    cleanup_local_media_artifacts: Any
    delete_expired_exports: Any
    delete_expired_uploads: Any
    payment_reconciliation_job: Any
    publish_queue_snapshot: Any
    queue_snapshot: Any
    render_queue_snapshot: Any


def create_maintenance_jobs(context: ServiceContext) -> SimpleNamespace:
    def cleanup_local_media_artifacts(now: float = None) -> Dict[str, int]:
        """Delete expired scratch files for the current API or worker container."""
        now = float(now if now is not None else time.time())
        metrics = {
            "uploads_deleted": 0,
            "exports_deleted": 0,
            "temp_ass_deleted": 0,
            "cache_deleted": 0,
            "errors": 0,
        }

        # Clean upload directory — all files older than 6 hours
        if os.path.exists(context.UPLOAD_DIR):
            for f in os.listdir(context.UPLOAD_DIR):
                filepath = os.path.join(context.UPLOAD_DIR, f)
                if not os.path.isfile(filepath): continue
                try:
                    st = os.stat(filepath)
                    age = now - max(st.st_mtime, st.st_atime)
                    if f.endswith('.srt'):
                        if age > 604800:  # 7 days for SRT
                            os.remove(filepath)
                            metrics["uploads_deleted"] += 1
                    elif age > 21600:  # 6 hours for uploads
                        os.remove(filepath)
                        metrics["uploads_deleted"] += 1
                except Exception as e:
                    context._json_log("warning", "janitor_error", error=str(e), scope="uploads")
                    metrics["errors"] += 1

        # Clean stale local exports (should be on Firebase, delete after 30 min)
        if os.path.exists(context.EXPORT_DIR):
            for f in os.listdir(context.EXPORT_DIR):
                filepath = os.path.join(context.EXPORT_DIR, f)
                if not os.path.isfile(filepath): continue
                try:
                    age = now - os.stat(filepath).st_mtime
                    if age > 1800:  # 30 minutes
                        os.remove(filepath)
                        metrics["exports_deleted"] += 1
                except Exception as e:
                    context._json_log("warning", "janitor_error", error=str(e), scope="exports")
                    metrics["errors"] += 1

        # Cleanup stale temporary ASS artifacts generated during render retries.
        backend_dir = os.path.dirname(os.path.abspath(__file__))
        try:
            from .render_scratch import sweep_render_scratch
        except ImportError:
            from render_scratch import sweep_render_scratch
        metrics["render_scratch_deleted"] = sweep_render_scratch(
            os.path.join(os.path.dirname(backend_dir), ".render_tmp"), now
        )
        for f in os.listdir(backend_dir):
            if not ((f.startswith("_tmp_") and f.endswith(".ass")) or f == "last_export_debug.ass"):
                continue
            filepath = os.path.join(backend_dir, f)
            if not os.path.isfile(filepath):
                continue
            try:
                age = now - os.stat(filepath).st_mtime
                if (f == "last_export_debug.ass" and not context.DEBUG_MODE_ENABLED) or age > 7200:
                    os.remove(filepath)
                    metrics["temp_ass_deleted"] += 1
            except Exception as e:
                context._json_log("warning", "janitor_error", error=str(e), scope="tmp_ass")
                metrics["errors"] += 1

        # Clean caches/dead letter files older than 7 days.
        for root_dir in [context.TRANSCRIPTION_CACHE_DIR, context.RENDER_CACHE_DIR, context.DEAD_LETTER_DIR]:
            if not os.path.exists(root_dir):
                continue
            for f in os.listdir(root_dir):
                filepath = os.path.join(root_dir, f)
                if not os.path.isfile(filepath):
                    continue
                try:
                    age = now - os.stat(filepath).st_mtime
                    if age > 7 * 86400:
                        os.remove(filepath)
                        metrics["cache_deleted"] += 1
                except Exception as e:
                    context._json_log("warning", "janitor_error", error=str(e), scope="cache")
                    metrics["errors"] += 1

        return metrics


    async def advanced_janitor_job():
        await asyncio.to_thread(context._advanced_janitor_once)


    def _advanced_janitor_once():
        """Clean local scratch files and durable objects based on retention rules."""
        metrics = context.cleanup_local_media_artifacts()
        metrics.update({
            "cloud_exports_deleted": 0,
            "cloud_uploads_deleted": 0,
        })

        try:
            metrics["cloud_exports_deleted"] = context.delete_expired_exports()
        except Exception as e:
            context._json_log("warning", "janitor_error", error=str(e), scope="cloud_exports")
            metrics["errors"] += 1

        try:
            metrics["cloud_uploads_deleted"] = context.delete_expired_uploads()
        except Exception as e:
            context._json_log("warning", "janitor_error", error=str(e), scope="cloud_uploads")
            metrics["errors"] += 1

        total_deleted = (
            metrics["uploads_deleted"] + metrics["exports_deleted"]
            + metrics["temp_ass_deleted"] + metrics["cache_deleted"]
            + metrics["render_scratch_deleted"]
            + metrics["cloud_exports_deleted"]
            + metrics["cloud_uploads_deleted"]
        )
        if total_deleted > 0 or metrics["errors"] > 0:
            context._json_log(
                "info",
                "janitor_summary",
                uploads_deleted=metrics["uploads_deleted"],
                exports_deleted=metrics["exports_deleted"],
                temp_ass_deleted=metrics["temp_ass_deleted"],
                cache_deleted=metrics["cache_deleted"],
                cloud_exports_deleted=metrics["cloud_exports_deleted"],
                cloud_uploads_deleted=metrics["cloud_uploads_deleted"],
                errors=metrics["errors"],
            )


    def _claim_scheduled_job(name: str, ttl_seconds: int) -> str:
        token = uuid.uuid4().hex
        if context._redis_client is None:
            return token
        try:
            return token if context._redis_client.set(f"scheduled:{name}", token, nx=True, ex=ttl_seconds) else ""
        except Exception:
            return "" if context._IS_PRODUCTION else token


    def _release_scheduled_job(name: str, token: str):
        if not token or context._redis_client is None:
            return
        try:
            context._redis_client.eval(
                "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
                1,
                f"scheduled:{name}",
                token,
            )
        except Exception:
            pass


    async def scheduled_janitor_job():
        token = await asyncio.to_thread(context._claim_scheduled_job, "janitor", 14 * 60)
        if not token:
            return
        try:
            await context.advanced_janitor_job()
        finally:
            await asyncio.to_thread(context._release_scheduled_job, "janitor", token)


    async def scheduled_payment_reconciliation_job():
        token = await asyncio.to_thread(
            context._claim_scheduled_job, "payment_reconciliation", max(context.PAYMENT_RECONCILE_INTERVAL_MINUTES, 5) * 60 - 5,
        )
        if not token:
            return
        try:
            await context.payment_reconciliation_job()
        finally:
            await asyncio.to_thread(context._release_scheduled_job, "payment_reconciliation", token)


    def _publish_queue_metrics_once():
        # Multiple Uvicorn processes and API replicas start this loop. A short
        # Redis lease ensures only one process writes the per-group time series.
        token = context._claim_scheduled_job("gcp_queue_metrics", context.QUEUE_METRICS_INTERVAL_SECONDS - 2)
        if not token or context._export_queue is None or context.Job is None:
            return
        render_queues = list(context._export_queues.values()) or [context._export_queue]
        active_workers = 1
        workers = []
        if context.RQWorker is not None:
            try:
                workers = context.RQWorker.all(connection=context._rq_redis_client)
                render_names = set(context._export_queues) or {context.EXPORT_QUEUE_NAME}
                active_workers = sum(
                    1 for worker in workers
                    if render_names.intersection(set(
                        worker.queue_names() if callable(getattr(worker, "queue_names", None))
                        else getattr(worker, "queue_names", [])
                    ))
                ) or 1
            except Exception:
                active_workers = 1
                workers = []
        depth, oldest_age_seconds, pending_work_seconds, predicted_wait_seconds = context.render_queue_snapshot(
            render_queues, context.Job, active_workers=active_workers,
        )
        context.publish_queue_snapshot(
            depth,
            oldest_age_seconds,
            "render_all",
            context.WORKER_MIG_NAME,
            pending_work_seconds=pending_work_seconds,
            metric_prefix="export",
            predicted_wait_seconds=predicted_wait_seconds,
        )
        if context.HEAVY_EXPORT_QUEUE_NAME in context._export_queues:
            spot_workers = 0
            for worker in workers:
                try:
                    group = context._rq_redis_client.hget(worker.key, "worker_group") or b""
                    if isinstance(group, bytes):
                        group = group.decode("utf-8", "replace")
                    if group == context.SPOT_WORKER_MIG_NAME:
                        spot_workers += 1
                except Exception:
                    continue
            heavy_depth, heavy_age, heavy_work, heavy_wait = context.render_queue_snapshot(
                [context._export_queues[context.HEAVY_EXPORT_QUEUE_NAME]], context.Job, active_workers=spot_workers or 1,
            )
            context.publish_queue_snapshot(
                heavy_depth,
                heavy_age,
                "render_heavy",
                context.SPOT_WORKER_MIG_NAME,
                pending_work_seconds=heavy_work,
                metric_prefix="export",
                predicted_wait_seconds=heavy_wait,
            )
        if context.GPU_RENDER_ENABLED and context.GPU_EXPORT_QUEUE_NAME in context._export_queues:
            gpu_workers = 0
            for worker in workers:
                try:
                    group = context._rq_redis_client.hget(worker.key, "worker_group") or b""
                    if isinstance(group, bytes):
                        group = group.decode("utf-8", "replace")
                    if group == context.GPU_WORKER_MIG_NAME:
                        gpu_workers += 1
                except Exception:
                    continue
            gpu_depth, gpu_age, gpu_work, gpu_wait = context.render_queue_snapshot(
                [context._export_queues[context.GPU_EXPORT_QUEUE_NAME]], context.Job, active_workers=gpu_workers or 1,
            )
            context.publish_queue_snapshot(
                gpu_depth,
                gpu_age,
                "render_gpu",
                context.GPU_WORKER_MIG_NAME,
                pending_work_seconds=gpu_work,
                metric_prefix="export",
                predicted_wait_seconds=gpu_wait,
            )
        if context._transcription_queue is not None and context.TRANSCRIPTION_QUEUE_NAME != context.EXPORT_QUEUE_NAME:
            transcription_depth, transcription_oldest = context.queue_snapshot(
                context._transcription_queue, context.Job,
            )
            if context._media_scan_queue is not None and context.MEDIA_SCAN_QUEUE_NAME != context.TRANSCRIPTION_QUEUE_NAME:
                scan_depth, scan_oldest = context.queue_snapshot(context._media_scan_queue, context.Job)
                transcription_depth += scan_depth
                transcription_oldest = max(transcription_oldest, scan_oldest)
            context.publish_queue_snapshot(
                transcription_depth,
                transcription_oldest,
                context.TRANSCRIPTION_QUEUE_NAME,
                context.TRANSCRIPTION_MIG_NAME,
                metric_prefix="transcription",
            )


    async def _queue_metrics_loop():
        while True:
            try:
                await asyncio.to_thread(context._publish_queue_metrics_once)
            except asyncio.CancelledError:
                raise
            except Exception as error:
                context._json_log("warning", "queue_metrics_publish_failed", error=str(error))
            await asyncio.sleep(context.QUEUE_METRICS_INTERVAL_SECONDS)


    async def _simple_janitor_loop():
        """Fallback janitor when apscheduler is not installed — runs every 15 min."""
        try:
            while True:
                await asyncio.sleep(900)
                try:
                    await context.advanced_janitor_job()
                except Exception as e:
                    context._json_log("error", "janitor_job_failed", error=str(e))
        except Exception as e:
            context._json_log("error", "janitor_loop_crashed", error=str(e))

    return SimpleNamespace(
        cleanup_local_media_artifacts=cleanup_local_media_artifacts,
        advanced_janitor_job=advanced_janitor_job,
        _advanced_janitor_once=_advanced_janitor_once,
        _claim_scheduled_job=_claim_scheduled_job,
        _release_scheduled_job=_release_scheduled_job,
        scheduled_janitor_job=scheduled_janitor_job,
        scheduled_payment_reconciliation_job=scheduled_payment_reconciliation_job,
        _publish_queue_metrics_once=_publish_queue_metrics_once,
        _queue_metrics_loop=_queue_metrics_loop,
        _simple_janitor_loop=_simple_janitor_loop,
    )
