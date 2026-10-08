"""Direct-upload slots and network limits, media-scan scheduling and transcription dispatch.

Callers use it as a module (`upload_dispatch.NAME`), so a test patches one
place and every caller sees it.
"""

import asyncio
import os
from datetime import date
from fastapi import HTTPException, Request
from typing import Any, Dict


try:
    from . import settings
    from . import app_state
    from . import firebase_admin_setup
    from . import observability
    from . import request_guards
    from . import entitlements
    from . import media_records
    from . import operator_controls
    from .services.media_scan_jobs import MediaScanJobs
    from .transcription_jobs import TranscriptionJobs
    from .upload_admission import release_upload, reserve_upload
    from .services.scheduler_auth import require_scheduler_authorization
    from . import optional_deps
except ImportError:  # Direct execution from backend/ remains supported.
    import settings
    import app_state
    import firebase_admin_setup
    import observability
    import request_guards
    import entitlements
    import media_records
    import operator_controls
    from services.media_scan_jobs import MediaScanJobs
    from transcription_jobs import TranscriptionJobs
    from upload_admission import release_upload, reserve_upload
    from services.scheduler_auth import require_scheduler_authorization
    import optional_deps


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


def _assert_upload_allowed(uid: str, duration_seconds: float = 0) -> None:
    """Refuse an upload that transcription would refuse, before any bytes move.

    Mirrors the plan-length check in `_process_video_inline` and the quota
    checks in `_reserve_ai_quota` without reserving anything. The browser
    supplies the duration, so this is an early courtesy: those later checks
    remain the authority, and unreadable account data fails open.
    """
    db = firebase_admin_setup.get_db()
    data: Dict[str, Any] = {}
    if db:
        try:
            snap = db.collection("users").document(uid).get()
            data = (snap.to_dict() or {}) if snap.exists else {}
        except Exception:
            return
    tier = entitlements._effective_subscription_tier(data)
    controls = operator_controls._read_service_controls()
    max_seconds = min(
        entitlements._max_video_seconds_for_tier(tier),
        int(controls.get(settings.MAX_UPLOAD_DURATION_CONTROL_KEY, settings.GLOBAL_MAX_UPLOAD_DURATION_SECONDS)),
    )
    duration = float(duration_seconds or 0)
    if duration > max_seconds + 0.5:
        observability._track_event("upload_rejected_duration", {"tier": tier, "duration": duration, "max_seconds": max_seconds})
        raise HTTPException(
            status_code=403,
            detail=f"Your plan allows videos up to {max_seconds}s. This video is {duration:.0f}s long.",
        )
    if settings._IS_TEST or not db:
        return
    base_tier = tier.replace("_yearly", "")
    if base_tier == "free":
        lifetime_used = int((dict(data.get("ai_lifetime_usage") or {})).get("process", 0) or 0)
        if lifetime_used >= settings.FREE_LIFETIME_TRANSCRIPTIONS:
            observability._track_event("upload_rejected_free_transcriptions_used")
            raise HTTPException(
                status_code=402,
                detail=(
                    f"FREE_TRANSCRIPTIONS_USED: You've used your {settings.FREE_LIFETIME_TRANSCRIPTIONS} free "
                    "transcriptions. Upgrade to keep captioning."
                ),
            )
    limits = settings.AI_DAILY_LIMITS.get(base_tier, settings.AI_DAILY_LIMITS["free"])
    usage = dict(data.get("ai_daily_usage") or {}) if data.get("ai_usage_date") == date.today().isoformat() else {}
    if int(usage.get("process", 0) or 0) >= int(limits["process"]):
        observability._track_event("upload_rejected_daily_quota")
        raise HTTPException(status_code=429, detail="Daily process quota reached for this plan")


def _discard_unused_upload(uid: str, file_id: str) -> bool:
    """Delete a finished upload the person abandoned before pressing Generate.

    The six-hour source janitor would remove it anyway; this frees storage and
    skips the virus scan straight away.
    """
    media_records._assert_upload_owner(file_id, uid)
    metadata = media_records._load_upload_metadata(file_id)
    if str(metadata.get("upload_state") or "").lower() == "discarded":
        return True
    remote_path = str(metadata.get("remote_path") or "")
    if remote_path and not remote_path.startswith(f"uploads/{uid}/"):
        raise HTTPException(status_code=403, detail="You do not have access to this upload")
    media_records._update_upload_metadata(file_id, {
        "upload_state": "discarded",
        "discarded_at": observability._utcnow().isoformat() + "Z",
    })
    if remote_path and not firebase_admin_setup.delete_from_firebase_storage(remote_path):
        observability._json_log("warning", "upload_discard_remote_delete_failed", file_id=file_id)
    real_dir = os.path.realpath(settings.UPLOAD_DIR)
    for name in os.listdir(settings.UPLOAD_DIR):
        if not name.startswith(file_id):
            continue
        candidate = os.path.realpath(os.path.join(settings.UPLOAD_DIR, name))
        if candidate.startswith(real_dir + os.sep):
            try:
                os.remove(candidate)
            except OSError:
                pass
    db = firebase_admin_setup.get_db()
    if db:
        try:
            MediaScanJobs(db).finish(file_id)
        except Exception as error:
            observability._json_log("warning", "upload_discard_scan_cancel_failed", error_type=type(error).__name__)
    observability._track_event("upload_discarded")
    return True


def _schedule_media_scan(uid: str, file_id: str):
    """Persist scan intent before best-effort immediate queue delivery."""
    jobs = MediaScanJobs(firebase_admin_setup.get_db())
    if not jobs.create(uid, file_id):
        return
    try:
        jobs.dispatch(
            app_state._media_scan_queue,
            retry=optional_deps.RQRetry(max=3, interval=[30, 120, 300]) if optional_deps.RQRetry else None,
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
        retry=optional_deps.RQRetry(max=3, interval=[30, 120, 300]) if optional_deps.RQRetry else None,
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
