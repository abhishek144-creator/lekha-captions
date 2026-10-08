"""Direct-upload slots and network limits, media-scan scheduling and transcription dispatch.

Helpers resolve shared state through ``host`` (the main module) at call
time, so there is one copy of each helper and test patches on ``main``
keep applying.
"""

from types import ModuleType, SimpleNamespace

try:
    from . import settings
except ImportError:  # Direct execution from backend/ remains supported.
    import settings


def create_upload_dispatch(host: ModuleType) -> SimpleNamespace:
    def _cleanup_incomplete_upload(local_path: str = "", remote_path: str = ""):
        if local_path:
            try:
                if host.os.path.exists(local_path):
                    host.os.remove(local_path)
            except OSError as cleanup_error:
                host._json_log("warning", "upload_local_cleanup_failed", error=str(cleanup_error))
        if remote_path:
            try:
                if not host.delete_from_firebase_storage(remote_path):
                    host._json_log("warning", "upload_remote_cleanup_failed", remote_path=remote_path)
            except Exception as cleanup_error:
                host._json_log("warning", "upload_remote_cleanup_failed", error=str(cleanup_error))


    def _reserve_direct_upload_slot(uid: str, file_id: str, size_bytes: int):
        if host._redis_client is None and not settings._IS_PRODUCTION:
            return
        host.reserve_upload(
            host._redis_client, uid, file_id, size_bytes,
            max_active=settings.DIRECT_UPLOAD_MAX_ACTIVE,
            max_outstanding_bytes=settings.DIRECT_UPLOAD_MAX_OUTSTANDING_BYTES,
            max_hourly=settings.DIRECT_UPLOAD_MAX_HOURLY,
        )


    def _limit_direct_upload_network(request: host.Request):
        network = host._client_rate_key(request)
        allowed, retry_after, _remaining = host._check_rate(
            host._upload_rate, f"direct_network:{network}", settings.DIRECT_UPLOAD_SHARED_NETWORK_HOURLY,
            settings.UPLOAD_RATE_WINDOW,
        )
        if not allowed:
            raise host.HTTPException(429, "Too many uploads from this network",
                                headers={"Retry-After": str(retry_after)})


    def _release_direct_upload_slot(uid: str, file_id: str, *, undo_hourly: bool = False):
        try:
            host.release_upload(host._redis_client, uid, file_id, undo_hourly=undo_hourly)
        except Exception as exc:
            # The active lease has a bounded TTL; a transient Redis failure should
            # not turn a completed upload into a failed customer response.
            host._json_log("warning", "direct_upload_slot_release_failed", error=str(exc))


    def _schedule_media_scan(uid: str, file_id: str):
        """Persist scan intent before best-effort immediate queue delivery."""
        jobs = host.MediaScanJobs(host.get_db())
        if not jobs.create(uid, file_id):
            return
        try:
            jobs.dispatch(
                host._media_scan_queue,
                retry=host.RQRetry(max=3, interval=[30, 120, 300]) if host.RQRetry else None,
            )
        except Exception as error:
            host._json_log(
                "warning",
                "media_scan_immediate_dispatch_failed",
                file_id=file_id,
                error_type=type(error).__name__,
            )


    async def _transcription_dispatch_loop():
        while True:
            try:
                await host.asyncio.to_thread(host.TranscriptionJobs(host.get_db()).dispatch, host._transcription_queue)
                await host.asyncio.to_thread(host._dispatch_media_scans_once)
            except Exception as error:
                host._json_log("warning", "transcription_dispatch_failed", error_type=type(error).__name__)
            await host.asyncio.sleep(10)


    def _dispatch_media_scans_once():
        return host.MediaScanJobs(host.get_db()).dispatch(
            host._media_scan_queue,
            retry=host.RQRetry(max=3, interval=[30, 120, 300]) if host.RQRetry else None,
        )


    def _require_scheduler_secret(request: host.Request):
        host.require_scheduler_authorization(
            request,
            shared_secret=settings.PAYMENT_RECONCILE_SECRET,
            service_account_email=settings.SCHEDULER_SERVICE_ACCOUNT_EMAIL,
            oidc_audience=settings.SCHEDULER_OIDC_AUDIENCE,
            rejected_callback=lambda error: host._json_log(
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
