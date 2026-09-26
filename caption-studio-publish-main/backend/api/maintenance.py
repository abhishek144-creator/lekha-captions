"""Authenticated routes invoked by Cloud Scheduler."""

import asyncio

from fastapi import APIRouter, Request


def create_maintenance_router(
    *,
    authorize,
    dispatch_transcription,
    dispatch_media_scans,
    run_janitor,
    publish_queue_metrics,
    reconcile_payments,
):
    router = APIRouter(prefix="/api/maintenance")

    @router.post("/transcription-dispatch")
    async def dispatch_transcription_outbox(request: Request):
        authorize(request)
        dispatched = await asyncio.to_thread(dispatch_transcription)
        return {"success": True, "dispatched": dispatched}

    @router.post("/media-scan-dispatch")
    async def dispatch_media_scan_outbox(request: Request):
        authorize(request)
        dispatched = await asyncio.to_thread(dispatch_media_scans)
        return {"success": True, "dispatched": dispatched}

    @router.post("/janitor")
    async def run_maintenance_janitor(request: Request):
        authorize(request)
        await run_janitor()
        return {"success": True}

    @router.post("/queue-metrics")
    async def publish_maintenance_queue_metrics(request: Request):
        authorize(request)
        await asyncio.to_thread(publish_queue_metrics)
        return {"success": True}

    @router.post("/payment-reconciliation")
    async def run_maintenance_payment_reconciliation(request: Request):
        authorize(request)
        await reconcile_payments()
        return {"success": True}

    return router
