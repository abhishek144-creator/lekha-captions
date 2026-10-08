"""Application lifecycle for an explicit application context."""
from types import SimpleNamespace


def create_lifecycle(context):
    @context.asynccontextmanager
    async def app_lifespan(_app: context.FastAPI):
        await context.startup_event()
        try:
            yield
        finally:
            await context.shutdown_event()


    async def startup_event():
        pass  # shared state is held by context
        if not context.RUN_API_BACKGROUND_TASKS:
            context._json_log("info", "api_background_tasks_disabled")
            if context.os.environ.get("RAILWAY_PROJECT_ID"):
                context.disconnect_idle_redis_clients(context._redis_client, context._rq_redis_client)
            return
        context._telemetry_flush_task = context.asyncio.create_task(context._telemetry_flush_loop())
        if context._IS_PRODUCTION:
            context._transcription_dispatch_task = context.asyncio.create_task(context._transcription_dispatch_loop())
        if context.QUEUE_METRICS_ENABLED:
            context._queue_metrics_task = context.asyncio.create_task(context._queue_metrics_loop())
        if context.os.environ.get("RELEASE_ENVIRONMENT") == "staging":
            # Current staging shares Firestore: it must not reconcile live payments
            # or run global customer-media cleanup with staging credentials.
            return
        if context.scheduler is not None:
            context.scheduler.add_job(context.scheduled_janitor_job, 'interval', minutes=15)
            context.scheduler.add_job(context.scheduled_payment_reconciliation_job, 'interval', minutes=max(context.PAYMENT_RECONCILE_INTERVAL_MINUTES, 5))
            context.scheduler.start()
            context._json_log("info", "scheduler_started", janitor_minutes=15,
                      payment_reconcile_minutes=max(context.PAYMENT_RECONCILE_INTERVAL_MINUTES, 5))
        else:
            context._json_log("warning", "janitor_fallback_loop", reason="apscheduler not installed")
            context._simple_janitor_task = context.asyncio.create_task(context._simple_janitor_loop())


    async def shutdown_event():
        pass  # shared state is held by context
        if context._queue_metrics_task is not None:
            context._queue_metrics_task.cancel()
            context._queue_metrics_task = None
        if context._transcription_dispatch_task is not None:
            context._transcription_dispatch_task.cancel()
            context._transcription_dispatch_task = None
        if context._telemetry_flush_task is not None:
            context._telemetry_flush_task.cancel()
            context._telemetry_flush_task = None
        if context._simple_janitor_task is not None:
            context._simple_janitor_task.cancel()
            context._simple_janitor_task = None
        if context.scheduler is not None and context.scheduler.running:
            context.scheduler.shutdown(wait=False)
        await context.asyncio.to_thread(context._flush_telemetry)


    return SimpleNamespace(
        app_lifespan=app_lifespan,
        startup_event=startup_event,
        shutdown_event=shutdown_event,
    )
