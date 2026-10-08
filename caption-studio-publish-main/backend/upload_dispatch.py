"""Direct-upload slots and network limits, media-scan scheduling and transcription dispatch.

The factory accepts explicit configuration, adapters and shared state through
ServiceContext. It has no dependency on the HTTP entry point.
"""

from types import SimpleNamespace
from typing import Protocol, Any


from fastapi import HTTPException
from fastapi import Request
import asyncio
import os

class ServiceContext(Protocol):
    DIRECT_UPLOAD_MAX_ACTIVE: Any
    DIRECT_UPLOAD_MAX_HOURLY: Any
    DIRECT_UPLOAD_MAX_OUTSTANDING_BYTES: Any
    DIRECT_UPLOAD_SHARED_NETWORK_HOURLY: Any
    MediaScanJobs: Any
    PAYMENT_RECONCILE_SECRET: Any
    RQRetry: Any
    SCHEDULER_OIDC_AUDIENCE: Any
    SCHEDULER_SERVICE_ACCOUNT_EMAIL: Any
    TranscriptionJobs: Any
    UPLOAD_RATE_WINDOW: Any
    _IS_PRODUCTION: Any
    _check_rate: Any
    _client_rate_key: Any
    _dispatch_media_scans_once: Any
    _json_log: Any
    _media_scan_queue: Any
    _redis_client: Any
    _transcription_queue: Any
    _upload_rate: Any
    delete_from_firebase_storage: Any
    get_db: Any
    release_upload: Any
    require_scheduler_authorization: Any
    reserve_upload: Any


def create_upload_dispatch(context: ServiceContext) -> SimpleNamespace:
    def _cleanup_incomplete_upload(local_path: str = "", remote_path: str = ""):
        if local_path:
            try:
                if os.path.exists(local_path):
                    os.remove(local_path)
            except OSError as cleanup_error:
                context._json_log("warning", "upload_local_cleanup_failed", error=str(cleanup_error))
        if remote_path:
            try:
                if not context.delete_from_firebase_storage(remote_path):
                    context._json_log("warning", "upload_remote_cleanup_failed", remote_path=remote_path)
            except Exception as cleanup_error:
                context._json_log("warning", "upload_remote_cleanup_failed", error=str(cleanup_error))


    def _reserve_direct_upload_slot(uid: str, file_id: str, size_bytes: int):
        if context._redis_client is None and not context._IS_PRODUCTION:
            return
        context.reserve_upload(
            context._redis_client, uid, file_id, size_bytes,
            max_active=context.DIRECT_UPLOAD_MAX_ACTIVE,
            max_outstanding_bytes=context.DIRECT_UPLOAD_MAX_OUTSTANDING_BYTES,
            max_hourly=context.DIRECT_UPLOAD_MAX_HOURLY,
        )


    def _limit_direct_upload_network(request: Request):
        network = context._client_rate_key(request)
        allowed, retry_after, _remaining = context._check_rate(
            context._upload_rate, f"direct_network:{network}", context.DIRECT_UPLOAD_SHARED_NETWORK_HOURLY,
            context.UPLOAD_RATE_WINDOW,
        )
        if not allowed:
            raise HTTPException(429, "Too many uploads from this network",
                                headers={"Retry-After": str(retry_after)})


    def _release_direct_upload_slot(uid: str, file_id: str, *, undo_hourly: bool = False):
        try:
            context.release_upload(context._redis_client, uid, file_id, undo_hourly=undo_hourly)
        except Exception as exc:
            # The active lease has a bounded TTL; a transient Redis failure should
            # not turn a completed upload into a failed customer response.
            context._json_log("warning", "direct_upload_slot_release_failed", error=str(exc))


    def _schedule_media_scan(uid: str, file_id: str):
        """Persist scan intent before best-effort immediate queue delivery."""
        jobs = context.MediaScanJobs(context.get_db())
        if not jobs.create(uid, file_id):
            return
        try:
            jobs.dispatch(
                context._media_scan_queue,
                retry=context.RQRetry(max=3, interval=[30, 120, 300]) if context.RQRetry else None,
            )
        except Exception as error:
            context._json_log(
                "warning",
                "media_scan_immediate_dispatch_failed",
                file_id=file_id,
                error_type=type(error).__name__,
            )


    async def _transcription_dispatch_loop():
        while True:
            try:
                await asyncio.to_thread(context.TranscriptionJobs(context.get_db()).dispatch, context._transcription_queue)
                await asyncio.to_thread(context._dispatch_media_scans_once)
            except Exception as error:
                context._json_log("warning", "transcription_dispatch_failed", error_type=type(error).__name__)
            await asyncio.sleep(10)


    def _dispatch_media_scans_once():
        return context.MediaScanJobs(context.get_db()).dispatch(
            context._media_scan_queue,
            retry=context.RQRetry(max=3, interval=[30, 120, 300]) if context.RQRetry else None,
        )


    def _require_scheduler_secret(request: Request):
        context.require_scheduler_authorization(
            request,
            shared_secret=context.PAYMENT_RECONCILE_SECRET,
            service_account_email=context.SCHEDULER_SERVICE_ACCOUNT_EMAIL,
            oidc_audience=context.SCHEDULER_OIDC_AUDIENCE,
            rejected_callback=lambda error: context._json_log(
                "warning", "scheduler_oidc_rejected", error_type=type(error).__name__,
            ),
        )

    return SimpleNamespace(
        _cleanup_incomplete_upload=_cleanup_incomplete_upload,
        _reserve_direct_upload_slot=_reserve_direct_upload_slot,
        _limit_direct_upload_network=_limit_direct_upload_network,
        _release_direct_upload_slot=_release_direct_upload_slot,
        _schedule_media_scan=_schedule_media_scan,
        _transcription_dispatch_loop=_transcription_dispatch_loop,
        _dispatch_media_scans_once=_dispatch_media_scans_once,
        _require_scheduler_secret=_require_scheduler_secret,
    )
