"""Janitor, scheduled reconciliation, queue metrics and background dispatch loops.

Helpers resolve shared state through ``host`` (the main module) at call
time, so there is one copy of each helper and test patches on ``main``
keep applying.
"""

from types import ModuleType, SimpleNamespace

try:
    from . import settings
except ImportError:  # Direct execution from backend/ remains supported.
    import settings


def create_maintenance_jobs(host: ModuleType) -> SimpleNamespace:
    def cleanup_local_media_artifacts(now: float = None) -> host.Dict[str, int]:
        """Delete expired scratch files for the current API or worker container."""
        now = float(now if now is not None else host.time.time())
        metrics = {
            "uploads_deleted": 0,
            "exports_deleted": 0,
            "temp_ass_deleted": 0,
            "cache_deleted": 0,
            "errors": 0,
        }

        # Clean upload directory — all files older than 6 hours
        if host.os.path.exists(settings.UPLOAD_DIR):
            for f in host.os.listdir(settings.UPLOAD_DIR):
                filepath = host.os.path.join(settings.UPLOAD_DIR, f)
                if not host.os.path.isfile(filepath): continue
                try:
                    st = host.os.stat(filepath)
                    age = now - max(st.st_mtime, st.st_atime)
                    if f.endswith('.srt'):
                        if age > 604800:  # 7 days for SRT
                            host.os.remove(filepath)
                            metrics["uploads_deleted"] += 1
                    elif age > 21600:  # 6 hours for uploads
                        host.os.remove(filepath)
                        metrics["uploads_deleted"] += 1
                except Exception as e:
                    host._json_log("warning", "janitor_error", error=str(e), scope="uploads")
                    metrics["errors"] += 1

        # Clean stale local exports (should be on Firebase, delete after 30 min)
        if host.os.path.exists(settings.EXPORT_DIR):
            for f in host.os.listdir(settings.EXPORT_DIR):
                filepath = host.os.path.join(settings.EXPORT_DIR, f)
                if not host.os.path.isfile(filepath): continue
                try:
                    age = now - host.os.stat(filepath).st_mtime
                    if age > 1800:  # 30 minutes
                        host.os.remove(filepath)
                        metrics["exports_deleted"] += 1
                except Exception as e:
                    host._json_log("warning", "janitor_error", error=str(e), scope="exports")
                    metrics["errors"] += 1

        # Cleanup stale temporary ASS artifacts generated during render retries.
        backend_dir = host.os.path.dirname(host.os.path.abspath(__file__))
        try:
            from .render_scratch import sweep_render_scratch
        except ImportError:
            from render_scratch import sweep_render_scratch
        metrics["render_scratch_deleted"] = sweep_render_scratch(
            host.os.path.join(host.os.path.dirname(backend_dir), ".render_tmp"), now
        )
        for f in host.os.listdir(backend_dir):
            if not ((f.startswith("_tmp_") and f.endswith(".ass")) or f == "last_export_debug.ass"):
                continue
            filepath = host.os.path.join(backend_dir, f)
            if not host.os.path.isfile(filepath):
                continue
            try:
                age = now - host.os.stat(filepath).st_mtime
                if (f == "last_export_debug.ass" and not settings.DEBUG_MODE_ENABLED) or age > 7200:
                    host.os.remove(filepath)
                    metrics["temp_ass_deleted"] += 1
            except Exception as e:
                host._json_log("warning", "janitor_error", error=str(e), scope="tmp_ass")
                metrics["errors"] += 1

        # Clean caches/dead letter files older than 7 days.
        for root_dir in [settings.TRANSCRIPTION_CACHE_DIR, settings.RENDER_CACHE_DIR, settings.DEAD_LETTER_DIR]:
            if not host.os.path.exists(root_dir):
                continue
            for f in host.os.listdir(root_dir):
                filepath = host.os.path.join(root_dir, f)
                if not host.os.path.isfile(filepath):
                    continue
                try:
                    age = now - host.os.stat(filepath).st_mtime
                    if age > 7 * 86400:
                        host.os.remove(filepath)
                        metrics["cache_deleted"] += 1
                except Exception as e:
                    host._json_log("warning", "janitor_error", error=str(e), scope="cache")
                    metrics["errors"] += 1

        return metrics


    async def advanced_janitor_job():
        await host.asyncio.to_thread(host._advanced_janitor_once)


    def _advanced_janitor_once():
        """Clean local scratch files and durable objects based on retention rules."""
        metrics = host.cleanup_local_media_artifacts()
        metrics.update({
            "cloud_exports_deleted": 0,
            "cloud_uploads_deleted": 0,
        })

        try:
            metrics["cloud_exports_deleted"] = host.delete_expired_exports()
        except Exception as e:
            host._json_log("warning", "janitor_error", error=str(e), scope="cloud_exports")
            metrics["errors"] += 1

        try:
            metrics["cloud_uploads_deleted"] = host.delete_expired_uploads()
        except Exception as e:
            host._json_log("warning", "janitor_error", error=str(e), scope="cloud_uploads")
            metrics["errors"] += 1

        total_deleted = (
            metrics["uploads_deleted"] + metrics["exports_deleted"]
            + metrics["temp_ass_deleted"] + metrics["cache_deleted"]
            + metrics["render_scratch_deleted"]
            + metrics["cloud_exports_deleted"]
            + metrics["cloud_uploads_deleted"]
        )
        if total_deleted > 0 or metrics["errors"] > 0:
            host._json_log(
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
        token = host.uuid.uuid4().hex
        if host._redis_client is None:
            return token
        try:
            return token if host._redis_client.set(f"scheduled:{name}", token, nx=True, ex=ttl_seconds) else ""
        except Exception:
            return "" if settings._IS_PRODUCTION else token


    def _release_scheduled_job(name: str, token: str):
        if not token or host._redis_client is None:
            return
        try:
            host._redis_client.eval(
                "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
                1,
                f"scheduled:{name}",
                token,
            )
        except Exception:
            pass


    async def scheduled_janitor_job():
        token = await host.asyncio.to_thread(host._claim_scheduled_job, "janitor", 14 * 60)
        if not token:
            return
        try:
            await host.advanced_janitor_job()
        finally:
            await host.asyncio.to_thread(host._release_scheduled_job, "janitor", token)


    async def scheduled_payment_reconciliation_job():
        token = await host.asyncio.to_thread(
            host._claim_scheduled_job, "payment_reconciliation", max(settings.PAYMENT_RECONCILE_INTERVAL_MINUTES, 5) * 60 - 5,
        )
        if not token:
            return
        try:
            await host.payment_reconciliation_job()
        finally:
            await host.asyncio.to_thread(host._release_scheduled_job, "payment_reconciliation", token)


    def _publish_queue_metrics_once():
        # Multiple Uvicorn processes and API replicas start this loop. A short
        # Redis lease ensures only one process writes the per-group time series.
        token = host._claim_scheduled_job("gcp_queue_metrics", settings.QUEUE_METRICS_INTERVAL_SECONDS - 2)
        if not token or host._export_queue is None or host.Job is None:
            return
        render_queues = list(host._export_queues.values()) or [host._export_queue]
        active_workers = 1
        workers = []
        if host.RQWorker is not None:
            try:
                workers = host.RQWorker.all(connection=host._rq_redis_client)
                render_names = set(host._export_queues) or {settings.EXPORT_QUEUE_NAME}
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
        depth, oldest_age_seconds, pending_work_seconds, predicted_wait_seconds = host.render_queue_snapshot(
            render_queues, host.Job, active_workers=active_workers,
        )
        host.publish_queue_snapshot(
            depth,
            oldest_age_seconds,
            "render_all",
            settings.WORKER_MIG_NAME,
            pending_work_seconds=pending_work_seconds,
            metric_prefix="export",
            predicted_wait_seconds=predicted_wait_seconds,
        )
        if host.HEAVY_EXPORT_QUEUE_NAME in host._export_queues:
            spot_workers = 0
            for worker in workers:
                try:
                    group = host._rq_redis_client.hget(worker.key, "worker_group") or b""
                    if isinstance(group, bytes):
                        group = group.decode("utf-8", "replace")
                    if group == settings.SPOT_WORKER_MIG_NAME:
                        spot_workers += 1
                except Exception:
                    continue
            heavy_depth, heavy_age, heavy_work, heavy_wait = host.render_queue_snapshot(
                [host._export_queues[host.HEAVY_EXPORT_QUEUE_NAME]], host.Job, active_workers=spot_workers or 1,
            )
            host.publish_queue_snapshot(
                heavy_depth,
                heavy_age,
                "render_heavy",
                settings.SPOT_WORKER_MIG_NAME,
                pending_work_seconds=heavy_work,
                metric_prefix="export",
                predicted_wait_seconds=heavy_wait,
            )
        if settings.GPU_RENDER_ENABLED and host.GPU_EXPORT_QUEUE_NAME in host._export_queues:
            gpu_workers = 0
            for worker in workers:
                try:
                    group = host._rq_redis_client.hget(worker.key, "worker_group") or b""
                    if isinstance(group, bytes):
                        group = group.decode("utf-8", "replace")
                    if group == settings.GPU_WORKER_MIG_NAME:
                        gpu_workers += 1
                except Exception:
                    continue
            gpu_depth, gpu_age, gpu_work, gpu_wait = host.render_queue_snapshot(
                [host._export_queues[host.GPU_EXPORT_QUEUE_NAME]], host.Job, active_workers=gpu_workers or 1,
            )
            host.publish_queue_snapshot(
                gpu_depth,
                gpu_age,
                "render_gpu",
                settings.GPU_WORKER_MIG_NAME,
                pending_work_seconds=gpu_work,
                metric_prefix="export",
                predicted_wait_seconds=gpu_wait,
            )
        if host._transcription_queue is not None and settings.TRANSCRIPTION_QUEUE_NAME != settings.EXPORT_QUEUE_NAME:
            transcription_depth, transcription_oldest = host.queue_snapshot(
                host._transcription_queue, host.Job,
            )
            if host._media_scan_queue is not None and settings.MEDIA_SCAN_QUEUE_NAME != settings.TRANSCRIPTION_QUEUE_NAME:
                scan_depth, scan_oldest = host.queue_snapshot(host._media_scan_queue, host.Job)
                transcription_depth += scan_depth
                transcription_oldest = max(transcription_oldest, scan_oldest)
            host.publish_queue_snapshot(
                transcription_depth,
                transcription_oldest,
                settings.TRANSCRIPTION_QUEUE_NAME,
                settings.TRANSCRIPTION_MIG_NAME,
                metric_prefix="transcription",
            )


    async def _queue_metrics_loop():
        while True:
            try:
                await host.asyncio.to_thread(host._publish_queue_metrics_once)
            except host.asyncio.CancelledError:
                raise
            except Exception as error:
                host._json_log("warning", "queue_metrics_publish_failed", error=str(error))
            await host.asyncio.sleep(settings.QUEUE_METRICS_INTERVAL_SECONDS)


    async def _simple_janitor_loop():
        """Fallback janitor when apscheduler is not installed — runs every 15 min."""
        try:
            while True:
                await host.asyncio.sleep(900)
                try:
                    await host.advanced_janitor_job()
                except Exception as e:
                    host._json_log("error", "janitor_job_failed", error=str(e))
        except Exception as e:
            host._json_log("error", "janitor_loop_crashed", error=str(e))

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
