"""Direct-upload slots and network limits, media-scan scheduling and transcription dispatch.

Callers use it as a module (`upload_dispatch.NAME`), so a test patches one
place and every caller sees it.
"""

import asyncio
import os
from fastapi import HTTPException, Request


try:
    from . import settings
except ImportError:  # Direct execution from backend/ remains supported.
    import settings
try:
    from . import app_state
except ImportError:  # Direct execution from backend/ remains supported.
    import app_state
try:
    from . import firebase_admin_setup
except ImportError:  # Direct execution from backend/ remains supported.
    import firebase_admin_setup
try:
    from . import observability
except ImportError:  # Direct execution from backend/ remains supported.
    import observability
try:
    from . import request_guards
except ImportError:  # Direct execution from backend/ remains supported.
    import request_guards
try:
    from .services.media_scan_jobs import MediaScanJobs
except ImportError:  # Direct execution from backend/ remains supported.
    from services.media_scan_jobs import MediaScanJobs
try:
    from .transcription_jobs import TranscriptionJobs
except ImportError:  # Direct execution from backend/ remains supported.
    from transcription_jobs import TranscriptionJobs
try:
    from .upload_admission import release_upload
except ImportError:  # Direct execution from backend/ remains supported.
    from upload_admission import release_upload
try:
    from .services.scheduler_auth import require_scheduler_authorization
except ImportError:  # Direct execution from backend/ remains supported.
    from services.scheduler_auth import require_scheduler_authorization
try:
    from .upload_admission import reserve_upload
except ImportError:  # Direct execution from backend/ remains supported.
    from upload_admission import reserve_upload
try:
    from rq import Retry as RQRetry
except ImportError:
    RQRetry = None


def _cleanup_incomplete_upload(local_path: str = "", remote_path: str = ""):
    if local_path:
        try:
            if os.path.exists(local_path):
                os.remove(local_path)
        except OSError as cleanup_error:
            observability._json_log("warning", "upload_local_cleanup_failed", error=str(cleanup_error))
    if remote_path:
        try:
            if not firebase_admin_setup.delete_from_firebase_storage(remote_path):
                observability._json_log("warning", "upload_remote_cleanup_failed", remote_path=remote_path)
        except Exception as cleanup_error:
            observability._json_log("warning", "upload_remote_cleanup_failed", error=str(cleanup_error))


def _reserve_direct_upload_slot(uid: str, file_id: str, size_bytes: int):
    if app_state._redis_client is None and not settings._IS_PRODUCTION:
        return
    reserve_upload(
        app_state._redis_client, uid, file_id, size_bytes,
        max_active=settings.DIRECT_UPLOAD_MAX_ACTIVE,
        max_outstanding_bytes=settings.DIRECT_UPLOAD_MAX_OUTSTANDING_BYTES,
        max_hourly=settings.DIRECT_UPLOAD_MAX_HOURLY,
    )


def _limit_direct_upload_network(request: Request):
    network = request_guards._client_rate_key(request)
    allowed, retry_after, _remaining = request_guards._check_rate(
        app_state._upload_rate, f"direct_network:{network}", settings.DIRECT_UPLOAD_SHARED_NETWORK_HOURLY,
        settings.UPLOAD_RATE_WINDOW,
    )
    if not allowed:
        raise HTTPException(429, "Too many uploads from this network",
                            headers={"Retry-After": str(retry_after)})


def _release_direct_upload_slot(uid: str, file_id: str, *, undo_hourly: bool = False):
    try:
        release_upload(app_state._redis_client, uid, file_id, undo_hourly=undo_hourly)
    except Exception as exc:
        # The active lease has a bounded TTL; a transient Redis failure should
        # not turn a completed upload into a failed customer response.
        observability._json_log("warning", "direct_upload_slot_release_failed", error=str(exc))


def _schedule_media_scan(uid: str, file_id: str):
    """Persist scan intent before best-effort immediate queue delivery."""
    jobs = MediaScanJobs(firebase_admin_setup.get_db())
    if not jobs.create(uid, file_id):
        return
    try:
        jobs.dispatch(
            app_state._media_scan_queue,
            retry=RQRetry(max=3, interval=[30, 120, 300]) if RQRetry else None,
        )
    except Exception as error:
        observability._json_log(
            "warning",
            "media_scan_immediate_dispatch_failed",
            file_id=file_id,
            error_type=type(error).__name__,
        )


async def _transcription_dispatch_loop():
    while True:
        try:
            await asyncio.to_thread(TranscriptionJobs(firebase_admin_setup.get_db()).dispatch, app_state._transcription_queue)
            await asyncio.to_thread(_dispatch_media_scans_once)
        except Exception as error:
            observability._json_log("warning", "transcription_dispatch_failed", error_type=type(error).__name__)
        await asyncio.sleep(10)


def _dispatch_media_scans_once():
    return MediaScanJobs(firebase_admin_setup.get_db()).dispatch(
        app_state._media_scan_queue,
        retry=RQRetry(max=3, interval=[30, 120, 300]) if RQRetry else None,
    )


def _require_scheduler_secret(request: Request):
    require_scheduler_authorization(
        request,
        shared_secret=settings.PAYMENT_RECONCILE_SECRET,
        service_account_email=settings.SCHEDULER_SERVICE_ACCOUNT_EMAIL,
        oidc_audience=settings.SCHEDULER_OIDC_AUDIENCE,
        rejected_callback=lambda error: observability._json_log(
            "warning", "scheduler_oidc_rejected", error_type=type(error).__name__,
        ),
    )
