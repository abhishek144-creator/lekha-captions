"""Export job records, credit/usage accounting, request sanitising and the render job core.

Callers use it as a module (`export_jobs.NAME`), so a test patches one
place and every caller sees it.
"""

import asyncio
import json
import math
import os
import re
import shutil
import time
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone
from fastapi import HTTPException, Request
from google.cloud import firestore
from typing import Any, Dict, List, Optional


try:
    from . import settings
    from . import app_state
    from . import firebase_admin_setup
    from . import observability
    from . import request_security
    from . import entitlements
    from . import media_records
    from .job_state import LOCAL_LOCK as JOB_STATE_LOCK, transition as transition_export_job
    from .notifications import create_notification
    from .rendering.cache import render_cache_eligible, render_cache_identity
    from .media_storage import is_configured as s3_storage_configured
    from . import optional_deps
    from . import api_models
except ImportError:  # Direct execution from backend/ remains supported.
    import settings
    import app_state
    import firebase_admin_setup
    import observability
    import request_security
    import entitlements
    import media_records
    from job_state import LOCAL_LOCK as JOB_STATE_LOCK, transition as transition_export_job
    from notifications import create_notification
    from rendering.cache import render_cache_eligible, render_cache_identity
    from media_storage import is_configured as s3_storage_configured
    import optional_deps
    import api_models


def _persist_export_job(job_id: str, payload: Dict[str, Any], *, write_redis: bool = True) -> bool:
    """Persist job state to at least one cross-process store."""
    persisted = not write_redis and app_state._redis_client is not None
    if write_redis and app_state._redis_client is not None:
        try:
            app_state._redis_client.setex(
                f"export_job:{job_id}",
                7 * 24 * 3600,
                json.dumps(payload, default=str),
            )
            persisted = True
        except Exception as e:
            observability._json_log("warning", "export_job_redis_persist_failed", job_id=job_id, error=str(e))

    db = firebase_admin_setup.get_db()
    if db:
        for attempt in range(2):
            try:
                ref = db.collection("export_jobs").document(job_id)
                if app_state._redis_client is not None:
                    @firestore.transactional
                    def mirror(transaction):
                        current = ref.get(transaction=transaction)
                        revision = int((current.to_dict() or {}).get("revision", 0)) if current.exists else 0
                        if revision < int(payload.get("revision", 0)):
                            transaction.set(ref, {**payload, "expire_at": observability._retention_deadline(7)}, merge=True)
                    mirror(db.transaction())
                else:
                    ref.set({**payload, "expire_at": observability._retention_deadline(7)}, merge=True)
                persisted = True
                break
            except Exception as e:
                observability._json_log(
                    "warning",
                    "export_job_firestore_persist_failed",
                    job_id=job_id,
                    attempt=attempt + 1,
                    error=str(e),
                )
                if attempt == 0:
                    time.sleep(0.05)
    return persisted


def _load_export_job(job_id: str) -> Optional[Dict[str, Any]]:
    """Load authoritative shared state, falling back to local state in local mode."""
    if app_state._redis_client is not None:
        try:
            raw = app_state._redis_client.get(f"export_job:{job_id}")
            if raw:
                job = json.loads(raw)
                app_state._export_jobs[job_id] = job
                return job
        except Exception as e:
            observability._json_log("warning", "export_job_redis_load_failed", job_id=job_id, error=str(e))

    db = firebase_admin_setup.get_db()
    if db:
        try:
            snap = db.collection("export_jobs").document(job_id).get()
            if snap.exists:
                job = snap.to_dict() or {}
                app_state._export_jobs[job_id] = job
                return job
        except Exception as e:
            observability._json_log("warning", "export_job_firestore_load_failed", job_id=job_id, error=str(e))
    if (settings._IS_PRODUCTION or app_state._export_queue is not None) and job_id in app_state._export_jobs:
        raise HTTPException(status_code=503, detail="Export job status is temporarily unavailable")
    return app_state._export_jobs.get(job_id)


def _public_export_error(error):
    """Expose only the known, non-sensitive daily-limit policy message."""
    import re
    message = str(error or "")
    if re.fullmatch(r"Limit reached: You can only export [0-9]{1,6} videos per 24 hours\.", message):
        return message
    return "Export failed. Please retry or contact support." if message else None


def _evaluate_export_policy(user_data: Dict[str, Any], now_ts: float):
    if user_data.get("deletion_pending"):
        return False, "Account deletion is in progress.", []
    tier = entitlements._normalize_tier_name(user_data.get('subscription_tier', 'free'))
    try:
        credits = int(user_data.get('credits_remaining', 0) or 0)
    except (TypeError, ValueError):
        # A malformed legacy value must never become a 500 or an entitlement
        # bypass. Account bootstrap repairs only missing free balances.
        credits = 0
    credits = max(0, credits)
    if tier == settings.FREE_PLAN_ID:
        # Never let a stale/manual legacy value turn the Free plan into an
        # unbounded entitlement. Account bootstrap also persists this repair.
        credits = entitlements._normalize_free_credit_balance(credits)
    export_history = user_data.get('export_timestamps', []) or []
    recent_exports = [ts for ts in export_history if ts > (now_ts - 86400)]

    plan_time_expired = entitlements._subscription_is_expired(user_data)
    if tier != 'free' and plan_time_expired:
        return False, "PLAN_EXPIRED: Your plan has expired. Please renew to continue exporting.", recent_exports

    if credits <= 0 and not settings.DISABLE_EXPORT_CREDIT_LIMIT:
        return False, "UPGRADE_REQUIRED: You have no credits remaining. Please upgrade your plan to continue exporting.", recent_exports

    # Temporary escape hatch during export debugging: keep credit checks, but do not
    # block local verification on daily export quota until parity issues are closed.
    if not settings.DISABLE_EXPORT_DAILY_LIMIT:
        daily_limit = settings.PLAN_PRICING.get(tier, {}).get('daily_limit', 5)
        if daily_limit is not None and len(recent_exports) >= int(daily_limit):
            return False, f"Limit reached: You can only export {daily_limit} videos per 24 hours.", recent_exports

    return True, "", recent_exports


def _record_export_usage(
    db,
    user_ref,
    history_item: Dict[str, Any],
    now_ts: float,
    export_job_id: str,
    result_payload: Optional[Dict[str, Any]] = None,
):
    usage_ref = user_ref.collection("export_usage").document(export_job_id)

    @firestore.transactional
    def _record(transaction):
        usage_doc = usage_ref.get(transaction=transaction)
        if usage_doc.exists:
            return []

        user_doc = user_ref.get(transaction=transaction)
        if not user_doc.exists:
            raise HTTPException(status_code=409, detail="Account changed while the export was processing")
        current_user = user_doc.to_dict() or {}
        allowed, policy_error, recent_exports = _evaluate_export_policy(current_user, now_ts)
        if not allowed:
            status = 403 if "UPGRADE_REQUIRED" in policy_error or "PLAN_EXPIRED" in policy_error else 429
            raise HTTPException(status_code=status, detail=policy_error)

        history = [history_item, *(current_user.get("history", []) or [])]
        dropped_history = history[5:]
        user_update = {"history": history[:5]}
        if not settings.DISABLE_EXPORT_CREDIT_LIMIT:
            current_tier = entitlements._normalize_tier_name(current_user.get("subscription_tier", "free"))
            if current_tier == settings.FREE_PLAN_ID:
                # Set an exact bounded value so a corrupt Free balance such as
                # 73 is repaired on the first metered export instead of merely
                # becoming 72 and remaining exploitable.
                bounded_balance = entitlements._normalize_free_credit_balance(
                    current_user.get("credits_remaining", 0),
                )
                user_update["credits_remaining"] = max(0, bounded_balance - 1)
            else:
                user_update["credits_remaining"] = firestore.Increment(-1)
        if not settings.DISABLE_EXPORT_DAILY_LIMIT:
            user_update["export_timestamps"] = [*recent_exports, now_ts]
        transaction.create(usage_ref, {
            "export_job_id": export_job_id,
            "file_id": history_item.get("id", ""),
            # The debit and its recoverable output commit together. Job-state
            # storage can fail afterwards without losing this customer's result.
            "result_payload": result_payload or {},
            "recorded_at": datetime.now(timezone.utc),
            "expire_at": datetime.now(timezone.utc) + timedelta(days=400),
        })
        transaction.update(user_ref, user_update)
        return dropped_history

    return _record(db.transaction())


def _load_recorded_export_result(uid: str, export_job_id: str, file_id: str):
    database = firebase_admin_setup.get_db()
    if database is None:
        if settings._IS_PRODUCTION:
            raise HTTPException(503, "Export recovery storage is temporarily unavailable")
        return None
    snapshot = database.collection("users").document(uid).collection("export_usage").document(export_job_id).get()
    record = snapshot.to_dict() if snapshot.exists else {}
    if record.get("file_id") != file_id or record.get("export_job_id") != export_job_id:
        return None
    payload = record.get("result_payload") or {}
    if payload.get("success") and payload.get("export_job_id") == export_job_id:
        return dict(payload)
    return None


def _set_export_job(job_id: str, status: str, *, expected_status=None, **kwargs):
    with JOB_STATE_LOCK:
        durable_only = {}
        keep_out_of_redis = app_state._redis_client is not None and firebase_admin_setup.get_db() is not None
        if keep_out_of_redis:
            durable_only = {
                field: kwargs.pop(field)
                for field in settings._DURABLE_ONLY_EXPORT_JOB_FIELDS
                if field in kwargs
            }
        seed = _load_export_job(job_id) or {}
        if keep_out_of_redis:
            # A Redis-loss recovery seeds from Firestore; do not copy its
            # snapshot back into Redis.
            seed = {key: value for key, value in seed.items() if key not in settings._DURABLE_ONLY_EXPORT_JOB_FIELDS}
        payload = transition_export_job(app_state._redis_client, job_id, seed, {
            "status": status, "updated_at": time.time(), **kwargs,
        }, expected_status=expected_status)
        persisted = _persist_export_job(
            job_id, {**payload, **durable_only}, write_redis=app_state._redis_client is None,
        )
        if app_state._export_queue is not None and not persisted:
            raise RuntimeError("Export job state could not be persisted to shared storage")
        app_state._export_jobs[job_id] = payload
        return payload


def _refresh_completed_export_payload(payload: Dict[str, Any], uid: str, job_id: str) -> Dict[str, Any]:
    """Return an authorized recovery payload with a fresh, short-lived download token."""
    refreshed = dict(payload or {})
    if not refreshed.get("success"):
        return refreshed

    filename = str(refreshed.get("export_filename") or "").strip()
    if not filename:
        raw_url = str(refreshed.get("video_url") or "")
        filename = os.path.basename(urllib.parse.urlsplit(raw_url).path)
    if not re.fullmatch(r"export_[a-f0-9-]{36}_[a-f0-9]{12}\.mp4", filename):
        return refreshed

    # Completed-job receipts live longer than the original media token so a
    # response lost during download can be recovered without another render or
    # credit. Storage retention remains authoritative: this token only grants a
    # brief retry window and the media endpoint still returns 404 after cleanup.
    recovery_ttl_seconds = 15 * 60
    refreshed["video_url"] = media_records._signed_export_url(
        filename,
        uid,
        recovery_ttl_seconds,
        f"{job_id[:8]}-{int(time.time())}",
        str(refreshed.get("download_filename") or ""),
    )
    # Fetching API -> R2 redirects changes the browser Origin to null. Give the
    # authenticated owner a direct R2 URL, with the same brief retry window.
    refreshed.pop("download_url", None)
    if s3_storage_configured():
        desired_filename = refreshed.get("download_filename")
        direct_url = (firebase_admin_setup.signed_export_download_url(f"exports/{uid}/{filename}", recovery_ttl_seconds, desired_filename)
                      if desired_filename else firebase_admin_setup.signed_export_download_url(f"exports/{uid}/{filename}", recovery_ttl_seconds))
        if not direct_url:
            raise HTTPException(status_code=503, detail="Export download is temporarily unavailable. Resume to retry.")
        refreshed["download_url"] = direct_url
    refreshed["download_url_expires_at"] = (
        observability._utcnow() + timedelta(seconds=recovery_ttl_seconds)
    ).isoformat() + "Z"
    return refreshed


def _normalize_export_captions_for_media(
    captions: List[Dict[str, Any]], media_duration: float
) -> List[Dict[str, Any]]:
    if not math.isfinite(media_duration) or media_duration <= 0:
        raise HTTPException(status_code=422, detail="Source media duration is invalid")

    normalized = []
    for caption in captions:
        item = dict(caption)
        start = float(item.get("start_time", 0))
        end = float(item.get("end_time", 0))
        if start >= media_duration:
            raise HTTPException(
                status_code=422,
                detail="A caption starts at or after the end of the source media",
            )
        item["end_time"] = min(end, media_duration)
        if item["end_time"] <= start:
            raise HTTPException(
                status_code=422,
                detail="A caption has no renderable duration within the source media",
            )
        normalized.append(item)
    return normalized


def _write_dead_letter(job_id: str, reason: str, payload: Optional[Dict[str, Any]] = None):
    data = {
        "job_id": job_id,
        "reason": reason,
        "payload": payload or {},
        "timestamp": observability._utcnow().isoformat() + "Z",
    }
    try:
        with open(os.path.join(settings.DEAD_LETTER_DIR, f"{job_id}.json"), "w", encoding="utf-8") as f:
            json.dump(data, f)
    except Exception as e:
        observability._json_log("warning", "dead_letter_file_write_failed", job_id=job_id, error=str(e))

    db = firebase_admin_setup.get_db()
    if db:
        try:
            db.collection("export_dead_letter").document(job_id).set(
                {**data, "expire_at": observability._retention_deadline(30)}, merge=True
            )
        except Exception as e:
            observability._json_log("warning", "dead_letter_db_write_failed", job_id=job_id, error=str(e))


def _strip_client_render_hints(value: Any) -> Any:
    """Return editor state without browser-derived rendering measurements."""
    if isinstance(value, dict):
        return {
            key: _strip_client_render_hints(item)
            for key, item in value.items()
            if key not in settings._CLIENT_RENDER_HINT_FIELDS
        }
    if isinstance(value, list):
        return [_strip_client_render_hints(item) for item in value]
    return value


def _sanitize_export_request_payload(payload: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not isinstance(payload, dict):
        return {}
    sanitized = _strip_client_render_hints(payload)
    sanitized.pop("id_token", None)
    sanitized.pop("idempotency_key", None)
    # Retain the compatibility field for worker model validation, but make its
    # authoritative value explicit and independent of the submitting browser.
    sanitized["word_layouts"] = {}
    return sanitized


def _write_last_export_request_debug(
    *,
    export_job_id: str,
    file_id: str,
    quality: str,
    fps: int,
    style: Dict[str, Any],
    captions: List[Dict[str, Any]],
    word_layouts: Dict[str, Any],
) -> None:
    """Write the last export request style so template handoff bugs are inspectable."""
    try:
        first_caption = next((c for c in captions if c and not c.get("is_text_element")), {})
        should_use_dom = False
        try:
            should_use_dom = bool(app_state.processor._should_use_dom_template_renderer(style, captions))
        except Exception:
            should_use_dom = False
        debug_payload = {
            "renderer_version": settings.EXPORT_RENDERER_VERSION,
            "export_job_id": export_job_id,
            "file_id": file_id,
            "quality": quality,
            "fps": fps,
            "style_template_id": style.get("template_id", ""),
            "style_template_20_id": style.get("template_20_id", ""),
            "style_font_family": style.get("font_family", ""),
            "style_font_size": style.get("font_size"),
            "style_font_weight": style.get("font_weight"),
            "style_secondary_color": style.get("secondary_color", ""),
            "style_has_shadow": style.get("has_shadow"),
            "style_shadow_blur": style.get("shadow_blur"),
            "style_shadow_offset_x": style.get("shadow_offset_x"),
            "style_shadow_offset_y": style.get("shadow_offset_y"),
            "style_preview_width": style.get("preview_width"),
            "style_preview_height": style.get("preview_height"),
            "style_preview_container_width": style.get("preview_container_width"),
            "style_preview_container_height": style.get("preview_container_height"),
            "style_preview_template_font_px": style.get("preview_template_font_px"),
            "style_template_snapshot": style.get("template_snapshot"),
            "first_caption_template_id": first_caption.get("template_id", ""),
            "first_caption_template_20_id": first_caption.get("template_20_id", ""),
            "first_caption_applied_template_style": first_caption.get("applied_template_style"),
            "first_caption_imp_word_index": first_caption.get("imp_word_index", -1),
            "first_caption_emphasis_color": first_caption.get("emphasis_color", ""),
            "caption_emphasis_colors": [
                {
                    "id": caption.get("id"),
                    "imp_word_index": caption.get("imp_word_index", -1),
                    "emphasis_color": caption.get("emphasis_color", ""),
                }
                for caption in captions
                if caption and not caption.get("is_text_element")
            ],
            "caption_word_style_summary": [
                {
                    "id": caption.get("id"),
                    "word_style_count": len(caption.get("word_styles") or {}),
                    "positioned_words": [
                        {
                            "key": key,
                            "x": word_style.get("x"),
                            "y": word_style.get("y"),
                            "x_pct": word_style.get("x_pct"),
                            "y_pct": word_style.get("y_pct"),
                            "abs_x_pct": word_style.get("abs_x_pct"),
                            "abs_y_pct": word_style.get("abs_y_pct"),
                            "cpt_canvas_x_pct": word_style.get("cptCanvasXPercent"),
                            "cpt_canvas_y_pct": word_style.get("cptCanvasYPercent"),
                        }
                        for key, word_style in (caption.get("word_styles") or {}).items()
                        if isinstance(word_style, dict)
                        and (
                            abs(float(word_style.get("x") or 0)) > 0.01
                            or abs(float(word_style.get("y") or 0)) > 0.01
                            or abs(float(word_style.get("x_pct") or 0)) > 0.01
                            or abs(float(word_style.get("y_pct") or 0)) > 0.01
                            or word_style.get("abs_x_pct") is not None
                            or word_style.get("abs_y_pct") is not None
                            or word_style.get("cptCanvasXPercent") is not None
                            or word_style.get("cptCanvasYPercent") is not None
                        )
                    ][:100],
                }
                for caption in captions
                if caption and not caption.get("is_text_element")
            ],
            "captions_count": len(captions),
            "word_layout_count": len(word_layouts or {}),
            "should_use_dom_template_renderer": should_use_dom,
            "written_at": observability._utcnow().isoformat() + "Z",
        }
        with open(os.path.join(settings.CACHE_DIR, "last_export_request_debug.json"), "w", encoding="utf-8") as f:
            json.dump(debug_payload, f, indent=2, ensure_ascii=False)
    except Exception as e:
        observability._json_log("warning", "last_export_request_debug_write_failed", error=str(e))


def _extract_bearer_token(request: Request) -> str:
    auth_header = (request.headers.get("authorization") or "").strip()
    if auth_header.lower().startswith("bearer "):
        return auth_header[7:].strip()
    return (request.headers.get("x-id-token") or "").strip()


def _require_export_job_access(request: Request, job: Dict[str, Any]) -> str:
    owner_uid = (job.get("uid") or "").strip()
    if not owner_uid:
        raise HTTPException(status_code=404, detail="Export job owner not found")

    token = _extract_bearer_token(request)
    if request_security._is_explicit_dev_auth_token(token) and owner_uid == "dev-local-user":
        return owner_uid

    decoded = firebase_admin_setup.verify_token(token) if token else None
    if decoded:
        request_uid = (decoded.get("uid") or "").strip()
        if request_uid != owner_uid:
            raise HTTPException(status_code=403, detail="You do not have access to this export job")
        return request_uid

    db = firebase_admin_setup.get_db()
    if db is None and request_security._is_explicit_dev_auth_token(token) and owner_uid == "dev-local-user":
        return owner_uid
    raise HTTPException(status_code=401, detail="Authentication required")


def _mark_export_processing(export_job_id: str):
    processing_started_at = time.time()
    job = _load_export_job(export_job_id) or {}
    # Preserve admission time across queue waits and retries. Starting the clock
    # in the renderer hid the backlog from the end-to-end export SLO.
    queue_entered_at = float(job.get("queue_entered_at") or job.get("started_at") or processing_started_at)
    queue_wait_ms = job.get("queue_wait_ms")
    if queue_wait_ms is None:
        queue_wait_ms = max(0, int((processing_started_at - queue_entered_at) * 1000))
    _set_export_job(export_job_id, "processing", queue_entered_at=queue_entered_at,
                    processing_started_at=processing_started_at, queue_wait_ms=queue_wait_ms)
    return queue_entered_at, processing_started_at


async def _process_export_job_core(req: api_models.ExportRequest, uid: str, rid: str, export_job_id: str):
    request_security._assert_account_not_deleting(uid)
    queue_entered_at, processing_started_at = _mark_export_processing(export_job_id)
    db = firebase_admin_setup.get_db()
    db_available = db is not None
    now = time.time()
    recent_exports = []
    credits = 999
    user_data = {}
    user_ref = None

    if db_available:
        user_ref = db.collection('users').document(uid)
        user_doc = user_ref.get()

        if not user_doc.exists:
            if settings._IS_PRODUCTION:
                raise HTTPException(status_code=409, detail="Account no longer exists.")
            observability._log(rid, f"User {uid} missing in Firestore; auto-creating defaults")
            default_user = {
                'credits_remaining': settings.FREE_PLAN_CREDITS,
                'subscription_tier': 'free',
                'export_timestamps': [],
                'created_at': time.time(),
                'uid': uid,
            }
            user_ref.set(default_user)
            user_data = default_user
        else:
            user_data = user_doc.to_dict() or {}

        recorded_result = _load_recorded_export_result(uid, export_job_id, req.file_id)
        if recorded_result:
            # Recover this exact charged job before checking eligibility for a
            # NEW export, including a last-credit debit or an expired plan.
            _set_export_job(export_job_id, "finalizing")
            _set_export_job(export_job_id, "completed", payload=recorded_result,
                            completed_at=time.time(), recovered_from_usage=True)
            return recorded_result

        if user_data.get("is_promo_user") and user_data.get("promo_expires"):
            try:
                promo_exp = date.fromisoformat(user_data["promo_expires"])
                if date.today() > promo_exp:
                    user_ref.update({
                        "subscription_tier": "free",
                        "credits_remaining": 0,
                        "is_promo_user": False,
                    })
                    user_data["subscription_tier"] = "free"
                    user_data["credits_remaining"] = 0
            except Exception as e:
                observability._log(rid, f"Promo expiry check failed: {e}")

        allowed, policy_error, recent_exports = _evaluate_export_policy(user_data, now)
        if not allowed:
            raise HTTPException(status_code=403 if "UPGRADE_REQUIRED" in policy_error or "PLAN_EXPIRED" in policy_error else 429, detail=policy_error)
        try:
            credits = max(0, int(user_data.get('credits_remaining', 0) or 0))
        except (TypeError, ValueError):
            credits = 0
    else:
        if not settings.ALLOW_EXPORT_WITHOUT_DB:
            # Rendering is a metered operation. Continuing without the source of
            # truth for credits turns a database outage into a billing bypass.
            raise HTTPException(status_code=503, detail="Account and credit service is temporarily unavailable")
        observability._log(rid, "Firestore unavailable; explicit local export bypass enabled")

    user_tier = entitlements._normalize_tier_name(user_data.get("subscription_tier", "free") if user_data else "free")
    preset = entitlements._resolve_export_preset(user_tier, req.quality, req.fps)
    if preset["downgraded"]:
        observability._log(rid, f"Export preset adjusted by tier={user_tier}: requested {req.quality}@{req.fps} -> {preset['quality']}@{preset['fps']}")

    if not media_records._validate_file_id(req.file_id):
        raise HTTPException(status_code=400, detail="Invalid file_id")
    media_records._assert_upload_owner(req.file_id, uid)
    media_records._assert_upload_clean(req.file_id)
    input_path = media_records._safe_find_upload(req.file_id)
    if not input_path:
        raise HTTPException(status_code=404, detail="Video not found")

    source_meta = media_records._probe_media(input_path)
    source_duration = float((source_meta.get("format") or {}).get("duration") or 0)
    source_video_stream = next(
        (stream for stream in (source_meta.get("streams") or [])
         if stream.get("codec_type") == "video"),
        {},
    )
    source_width = int(source_video_stream.get("width") or 0)
    source_height = int(source_video_stream.get("height") or 0)
    captions = _strip_client_render_hints(_normalize_export_captions_for_media(
        [c.model_dump(by_alias=True) for c in req.captions],
        source_duration,
    ))
    server_style = req.validated_style()
    server_word_layouts: Dict[str, Any] = {}
    # Reuse rendered artifact for identical request payload.
    media_hash = media_records._source_media_identity(req.file_id, input_path)
    request_hash = render_cache_identity(
        uid=uid,
        renderer_version=settings.EXPORT_RENDERER_VERSION,
        media_hash=media_hash,
        captions=captions,
        style=server_style,
        quality=preset["quality"],
        fps=preset["fps"],
        export_aspect_ratio=req.export_aspect_ratio,
    )
    cached_render_path = os.path.join(settings.RENDER_CACHE_DIR, f"{request_hash}.mp4")
    template_export_active = bool(
        server_style.get("template_id")
        or server_style.get("template_20_id")
        or any(
            (caption.get("template_id") or caption.get("template_20_id") or caption.get("applied_template_style"))
            for caption in captions
            if caption and not caption.get("is_text_element")
        )
    )
    cache_eligible = render_cache_eligible(
        template_export_active=template_export_active,
        template_cache_enabled=os.environ.get("ENABLE_TEMPLATE_RENDER_CACHE", "1") == "1",
    )

    output_filename = f"export_{req.file_id}_{request_hash[:12]}.mp4"
    output_path = os.path.join(settings.EXPORT_DIR, output_filename)
    render_started_at = time.time()
    style_with_quality = {
        **server_style,
        'quality': preset["quality"],
        'fps': preset["fps"],
        'export_aspect_ratio': req.export_aspect_ratio if req.export_aspect_ratio in ('9:16', '1:1', '16:9') else '',
    }
    _write_last_export_request_debug(
        export_job_id=export_job_id,
        file_id=req.file_id,
        quality=preset["quality"],
        fps=preset["fps"],
        style=style_with_quality,
        captions=captions,
        word_layouts=server_word_layouts,
    )

    if cache_eligible and not os.path.exists(cached_render_path):
        await asyncio.to_thread(
            firebase_admin_setup.download_render_cache, uid, request_hash, cached_render_path,
        )
    if os.path.exists(cached_render_path) and cache_eligible:
        shutil.copy2(cached_render_path, output_path)
        render_finished_at = time.time()
        render_ms = int((render_finished_at - render_started_at) * 1000)
        cache_hit = True
        observability._track_event("render_cache_hit", {"job_id": export_job_id})
    else:
        cache_hit = False
        observability._log(rid, f"Starting render now job={export_job_id}")
        async with app_state.render_semaphore:
            result = await app_state.processor.burn_only(
                input_path, output_path, captions, style_with_quality, server_word_layouts
            )
        if not result.get('success'):
            observability._json_log("error", "video_render_failed", uid=uid, error=str(result.get('error') or "unknown"))
            raise HTTPException(status_code=500, detail="Video render failed")
        render_finished_at = time.time()
        render_ms = int((render_finished_at - render_started_at) * 1000)

    try:
        rendered_meta = media_records._probe_media(output_path)
        rendered_duration = float((rendered_meta.get("format") or {}).get("duration") or 0)
        rendered_video_stream = next(
            (stream for stream in (rendered_meta.get("streams") or [])
             if stream.get("codec_type") == "video"),
            {},
        )
        rendered_has_video = bool(rendered_video_stream)
        rendered_width = int(rendered_video_stream.get("width") or 0)
        rendered_height = int(rendered_video_stream.get("height") or 0)
        if not os.path.isfile(output_path) or os.path.getsize(output_path) <= 0 or not rendered_has_video or rendered_duration <= 0:
            raise ValueError("rendered output is empty or has no valid video stream")
    except Exception as e:
        for invalid_path in {output_path, cached_render_path}:
            if os.path.isfile(invalid_path):
                try:
                    os.remove(invalid_path)
                except OSError:
                    pass
        if cache_hit:
            await asyncio.to_thread(firebase_admin_setup.delete_render_cache, uid, request_hash)
        observability._json_log("error", "render_output_validation_failed", uid=uid, job_id=export_job_id, error=str(e))
        raise HTTPException(status_code=500, detail="Rendered video failed validation") from e

    if not cache_hit and cache_eligible:
        try:
            shutil.copy2(output_path, cached_render_path)
            await asyncio.to_thread(
                firebase_admin_setup.upload_render_cache, uid, request_hash, cached_render_path, 24,
            )
        except Exception as error:
            observability._json_log(
                "warning", "render_cache_persist_failed", job_id=export_job_id,
                error_type=type(error).__name__,
            )

    _set_export_job(export_job_id, "finalizing")
    # Serve local exports through signed same-origin media URLs so the browser can
    # fetch them without exposing the exports directory publicly. Firebase remains
    # the durable history/sharing destination when upload succeeds.
    video_url = ""
    firebase_url = None
    retention_hours = 2
    if db_available and user_data:
        current_tier = user_data.get('subscription_tier', 'free')
        if current_tier in settings.PLAN_PRICING:
            retention_hours = settings.PLAN_PRICING[current_tier].get('export_retention_hours', 2)
    try:
        remote_path = f"exports/{uid}/{output_filename}"
        firebase_url = firebase_admin_setup.upload_to_firebase_storage(
            output_path, remote_path, "video/mp4", retention_hours
        )
    except Exception as e:
        observability._log(rid, f"Firebase upload failed, using local export: {e}")

    if settings._IS_PRODUCTION and not firebase_url:
        raise HTTPException(status_code=503, detail="Rendered media could not be persisted. Please retry.")
    expires_at = (observability._utcnow() + timedelta(hours=retention_hours)).isoformat() + "Z"
    video_url = media_records._signed_export_url(
        output_filename, uid, retention_hours * 3600, export_job_id[:8]
    )

    payload = {
        "success": True,
        "video_url": video_url,
        "export_filename": output_filename,
        "expires_at": expires_at,
        "retention_hours": retention_hours,
        "export_job_id": export_job_id,
        "export_profile": {
            "tier": preset["tier"],
            "quality": preset["quality"],
            "fps": preset["fps"],
            "downgraded": preset["downgraded"],
        },
    }

    if db_available and user_ref is not None:
        history_item = {
            "id": req.file_id,
            "export_job_id": export_job_id,
            "filename": output_filename,
            "url": video_url,
            "createdAt": now * 1000,
            "firebase_path": f"exports/{uid}/{output_filename}" if firebase_url else None
        }
        dropped_history = _record_export_usage(
            db, user_ref, history_item, now, export_job_id, result_payload=payload
        )
        for dropped in dropped_history:
            dropped_path = dropped.get("firebase_path") if isinstance(dropped, dict) else ""
            if dropped_path:
                firebase_admin_setup.delete_from_firebase_storage(dropped_path)

    completed_at = time.time()
    total_ms = int((completed_at - queue_entered_at) * 1000)
    preparation_ms = int((render_started_at - processing_started_at) * 1000)
    finalization_ms = int((completed_at - render_finished_at) * 1000)
    output_size_bytes = os.path.getsize(output_path)
    recorded_job = _set_export_job(
        export_job_id,
        "completed",
        completed_at=completed_at,
        render_ms=render_ms,
        preparation_ms=preparation_ms,
        finalization_ms=finalization_ms,
        total_ms=total_ms,
        payload=payload
    )
    try:
        create_notification(
            db,
            uid,
            kind="export_completed",
            title="Your video is ready",
            message="Your background export finished successfully.",
            action_url=video_url,
            resource_id=export_job_id,
        )
    except Exception as error:
        observability._json_log(
            "warning", "export_notification_persist_failed",
            job_id=export_job_id, error=type(error).__name__,
        )
    observability._json_log(
        "info", "export_observation", job_id=export_job_id,
        status="completed",
        queue_wait_ms=int(recorded_job.get("queue_wait_ms") or 0),
        preparation_ms=preparation_ms, render_ms=render_ms,
        finalization_ms=finalization_ms, total_ms=total_ms,
        source_duration_seconds=round(source_duration, 3),
        rendered_duration_seconds=round(rendered_duration, 3),
        output_size_bytes=output_size_bytes, cache_hit=cache_hit,
        estimated_render_seconds=recorded_job.get("estimated_render_seconds"),
        renderer="dom" if template_export_active else "ass",
        template_export=template_export_active, quality=preset["quality"],
        fps=preset["fps"], export_aspect_ratio=req.export_aspect_ratio or "source",
        source_width=source_width, source_height=source_height,
        output_width=rendered_width, output_height=rendered_height,
    )
    observability._track_event("export_success", {"quality": preset["quality"], "fps": preset["fps"], "tier": preset["tier"]})
    observability._track_operational_metric_sample("export_total_ms", total_ms)
    observability._track_operational_metric_sample("export_render_ms", render_ms)
    observability._track_operational_metric_sample(
        "job_cost_usd",
        (rendered_duration / 60.0) * settings.RENDER_COST_ESTIMATE_PER_MEDIA_MINUTE_USD,
    )
    return payload


def _export_slot_wait_retry():
    """An RQ Retry result for a job waiting on its account slot, or None outside RQ."""
    if optional_deps.RQRetry is None:
        return None
    try:
        from rq import get_current_job
        if get_current_job() is None:
            return None
    except Exception:
        return None
    return optional_deps.RQRetry(max=settings.EXPORT_SLOT_WAIT_MAX_ATTEMPTS, interval=settings.EXPORT_SLOT_WAIT_INTERVAL_SECONDS)
