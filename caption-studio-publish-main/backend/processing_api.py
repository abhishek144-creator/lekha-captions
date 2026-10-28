"""Processing routes: transcription submit, status and the inline processing path."""

import asyncio
import hashlib
import json
import time
import uuid
import threading
from fastapi import APIRouter, HTTPException, Request, Response
from google.cloud import firestore


try:
    from . import settings
    from . import app_state
    from . import firebase_admin_setup
    from . import observability
    from . import request_security
    from . import entitlements
    from . import operator_controls
    from . import media_records
    from . import api_models
    from . import request_guards
    from .transcription_jobs import TranscriptionJobs
except ImportError:  # Direct execution from backend/ remains supported.
    import settings
    import app_state
    import firebase_admin_setup
    import observability
    import request_security
    import entitlements
    import operator_controls
    import media_records
    import api_models
    import request_guards
    from transcription_jobs import TranscriptionJobs


router = APIRouter()
_audio_analysis_slots = threading.BoundedSemaphore(1)


@router.post('/api/audio-analysis')
async def audio_analysis(req: api_models.MediaUrlRequest):
    """Recover older project waveforms without repeating paid transcription."""
    uid = (await asyncio.to_thread(request_security._authenticate_media_request, req.id_token, req.org_id))['uid']
    if not media_records._validate_file_id(req.file_id):
        raise HTTPException(400, 'Invalid file_id')
    await asyncio.to_thread(media_records._assert_upload_owner, req.file_id, uid)
    allowed, _, _ = await asyncio.to_thread(request_guards._check_rate, app_state._process_rate, f'audio:{uid}', 12)
    if not allowed:
        raise HTTPException(429, 'Audio analysis is busy. Please try again later.')
    def recover():
        # One bounded local decode per API process. The slot belongs to this
        # worker thread until FFmpeg exits, even if the HTTP caller disconnects.
        if not _audio_analysis_slots.acquire(blocking=False):
            raise HTTPException(429, 'Audio analysis is busy. Please try again shortly.')
        try:
            source = media_records._safe_find_upload(req.file_id)
            if not source:
                raise HTTPException(404, 'Source video unavailable')
            media_records._ensure_upload_clean(req.file_id, uid, source)
            try:
                from .audio_analysis import analyze_media
            except ImportError:
                from audio_analysis import analyze_media
            metadata = media_records._probe_media(source)
            duration = float((metadata.get('format') or {}).get('duration') or 0)
            if not 0 < duration <= settings.GLOBAL_MAX_UPLOAD_DURATION_SECONDS + 0.5:
                raise HTTPException(422, 'Invalid media duration')
            try:
                analysis = analyze_media(source, duration)
            except Exception as error:
                observability._json_log('warning', 'audio_analysis_failed', error_type=type(error).__name__)
                raise HTTPException(422, 'Could not decode source audio') from error
            return {'success': True, 'audio_analysis': analysis}
        finally:
            _audio_analysis_slots.release()
    return await asyncio.to_thread(recover)


@router.post("/api/process")
async def process_video(req: api_models.ProcessRequest, request: Request, response: Response):
    if not settings._IS_PRODUCTION:
        return await _process_video_inline(req, request, response)
    await asyncio.to_thread(operator_controls._assert_service_available, "pause_transcription")
    uid = (await asyncio.to_thread(request_security._authenticate_media_request, req.id_token, req.org_id))["uid"]
    if not media_records._validate_file_id(req.file_id):
        raise HTTPException(400, "Invalid file_id")
    await asyncio.to_thread(media_records._assert_upload_owner, req.file_id, uid)
    await asyncio.to_thread(media_records._protect_source_for_job, req.file_id, uid)
    job_settings = {"file_id": req.file_id, "language": req.language,
                "min_words": req.min_words, "max_words": req.max_words}
    if req.cleanup_mode != "clean":
        job_settings["cleanup_mode"] = req.cleanup_mode
    if req.speech_focus != "main":
        job_settings["speech_focus"] = req.speech_focus
    jobs = TranscriptionJobs(firebase_admin_setup.get_db())
    job = await asyncio.to_thread(jobs.create, uid, job_settings, operation_reference=req.idempotency_key)
    if job["status"] == "completed":
        return {**job["payload"], "idempotent_replay": True}
    if job["status"] in {"failed", "unknown", "cancelled"}:
        raise HTTPException(409, f"{job.get('error') or 'Transcription is no longer active.'} Reference: {job['job_id']}")
    # Dispatch immediately on the request path. The durable outbox remains the
    # recovery mechanism for a Redis outage or a crash between commit/enqueue;
    # it is no longer the primary delivery path.
    try:
        await asyncio.to_thread(jobs.dispatch, app_state._transcription_queue, job["job_id"])
    except Exception as error:
        observability._json_log(
            "warning",
            "transcription_immediate_dispatch_failed",
            job_id=job["job_id"],
            error_type=type(error).__name__,
        )
    response.status_code = 202
    response.headers["Retry-After"] = "3"
    return {"success": True, "pending": True, "job_id": job["job_id"], "status": job["status"]}


def run_transcription_job_task(uid: str, job_id: str):
    jobs = TranscriptionJobs(firebase_admin_setup.get_db())
    job = jobs.claim(uid, job_id)
    if job is None:
        return {"duplicate_or_cancelled": True}
    try:
        request_security._assert_account_not_deleting(uid)
        req = api_models.ProcessRequest(**job["settings"])
        request = Request({"type": "http", "headers": [], "client": ("worker", 0)})
        result = asyncio.run(_process_video_inline(req, request, Response(), trusted_uid=uid))
        # A bounded retry persists the already obtained result; it never calls
        # the paid provider again if Firestore momentarily loses connectivity.
        for attempt in range(3):
            try:
                jobs.finish(uid, job_id, "completed", payload=result)
                return {"status": "completed"}
            except Exception:
                if attempt == 2:
                    raise
                time.sleep(attempt + 1)
    except Exception as error:
        # HTTP errors from `_process_video_inline` are confirmed terminal
        # outcomes (including a provider's explicit failure), so the browser
        # may safely retry the durable job without uploading again. A raw
        # exception remains `unknown`: the provider may have completed it just
        # before the worker failed, and replaying blindly could double-charge.
        confirmed_failure = isinstance(error, HTTPException)
        jobs.finish(uid, job_id, "failed" if confirmed_failure else "unknown",
                    error="Transcription could not complete. Contact support with this job reference; it will not be repeated automatically.")
        raise


def _mark_account_activated(uid: str) -> bool:
    """Record the first successful transcription once for the business funnel."""
    database = firebase_admin_setup.get_db()
    if database is None or not uid:
        return False
    user_ref = database.collection("users").document(uid)

    @firestore.transactional
    def activate(transaction):
        snapshot = user_ref.get(transaction=transaction)
        current = snapshot.to_dict() if snapshot.exists else {}
        if current.get("activated_at"):
            return False
        transaction.set(
            user_ref,
            {"activated_at": observability._utcnow().isoformat() + "Z", "activation_event": "first_transcription"},
            merge=True,
        )
        return True

    try:
        return bool(activate(database.transaction()))
    except Exception as error:
        observability._json_log("warning", "account_activation_persist_failed", uid=uid, error=type(error).__name__)
        return False


async def _process_video_inline(req: api_models.ProcessRequest, request: Request, response: Response, *, trusted_uid=None):
    rid = observability._request_id(request)
    operator_controls._assert_service_available("pause_transcription")
    # Auth — same dev-mode bypass as /api/export
    decoded_token = {"uid": trusted_uid} if trusted_uid else request_security._authenticate_media_request(req.id_token, req.org_id)
    uid = (decoded_token.get("uid") or "").strip() or "unknown-user"
    client_ip = request_guards._client_rate_key(request)
    allowed, retry_after, remaining = request_guards._check_rate(
        app_state._process_rate, f"network:{client_ip}", settings.PROCESS_SHARED_NETWORK_RATE_LIMIT
    )
    request_guards._apply_rate_headers(response, settings.PROCESS_SHARED_NETWORK_RATE_LIMIT, remaining, retry_after)
    if not allowed:
        observability._track_event("process_rejected_rate_limited")
        raise HTTPException(status_code=429, detail="Too many transcription requests. Please wait before trying again.")
    user_allowed, user_retry_after, user_remaining = request_guards._check_rate(
        app_state._process_rate, f"user:{uid}", settings.PROCESS_USER_RATE_LIMIT
    )
    request_guards._apply_rate_headers(response, settings.PROCESS_USER_RATE_LIMIT, user_remaining, user_retry_after)
    if not user_allowed:
        observability._track_event("process_rejected_rate_limited")
        raise HTTPException(status_code=429, detail="Too many transcription requests. Please wait before trying again.")
    if not media_records._validate_file_id(req.file_id):
        raise HTTPException(status_code=400, detail="Invalid file_id")
    media_records._assert_upload_owner(req.file_id, uid)
    input_path = media_records._safe_find_upload(req.file_id)
    if not input_path:
        observability._track_event("process_failed_not_found")
        raise HTTPException(status_code=404, detail="File not found")
    await asyncio.to_thread(media_records._ensure_upload_clean, req.file_id, uid, input_path)

    # Enforce the per-plan maximum source length. /api/upload only applies a
    # global 180s ceiling; a plan's own cap (shared/planCatalog.json) can only be
    # enforced here, where the caller's tier is known. Checked before
    # the cache lookup so a result cached by a higher tier can't be replayed to a
    # lower-tier user with a too-long video.
    user_tier = entitlements._normalize_tier_name(await asyncio.to_thread(entitlements._lookup_subscription_tier, uid))
    controls = operator_controls._read_service_controls()
    operator_max_seconds = int(controls.get(
        settings.MAX_UPLOAD_DURATION_CONTROL_KEY,
        settings.GLOBAL_MAX_UPLOAD_DURATION_SECONDS,
    ))
    max_seconds = min(entitlements._max_video_seconds_for_tier(user_tier), operator_max_seconds)
    try:
        _probe_meta = await asyncio.to_thread(media_records._probe_media, input_path)
        media_duration = float((_probe_meta.get("format") or {}).get("duration") or 0)
    except Exception as probe_error:
        observability._track_event("process_rejected_ffprobe", {"file_id": req.file_id, "error": str(probe_error)})
        raise HTTPException(status_code=422, detail="Invalid media file") from probe_error
    if media_duration > max_seconds + 0.5:
        observability._track_event("process_rejected_duration", {"tier": user_tier, "duration": media_duration, "max_seconds": max_seconds})
        raise HTTPException(status_code=403, detail=f"Your plan allows videos up to {max_seconds}s. This video is {media_duration:.0f}s long.")
    await asyncio.to_thread(media_records._remember_source_duration, req.file_id, media_duration)

    try:
        media_hash = await asyncio.to_thread(media_records._compute_media_hash, input_path)
        cache_path = media_records._build_process_cache_path(media_hash, req.language, req.min_words, req.max_words, req.cleanup_mode, req.speech_focus)
    except Exception:
        media_hash = ""
        cache_path = ""

    cached = await asyncio.to_thread(media_records._read_transcription_cache, cache_path) if cache_path else None
    if cached is not None:
        try:
            if cached.get("success") and not (cached.get("captions") or []):
                raise HTTPException(
                    status_code=422,
                    detail="No speech with usable word timestamps was detected.",
                )
            cached["cached"] = True
            observability._track_event("process_cache_hit", {"language": req.language})
            return cached
        except HTTPException:
            raise
        except Exception:
            pass

    # A dropped HTTP response must not make the browser start another paid
    # transcription.  Keep the receipt in the shared idempotency store, keyed
    # by both account and the exact transcription settings.
    raw_process_idem = (req.idempotency_key or request.headers.get("x-idempotency-key") or "").strip()
    process_idem_key = f"process:{uid}:{raw_process_idem}" if raw_process_idem else ""
    process_request_hash = hashlib.sha256(json.dumps({
        "file_id": req.file_id,
        "language": req.language,
        "min_words": req.min_words,
        "max_words": req.max_words,
        **({"cleanup_mode": req.cleanup_mode} if req.cleanup_mode != "clean" else {}),
        **({"speech_focus": req.speech_focus} if req.speech_focus != "main" else {}),
    }, sort_keys=True).encode("utf-8")).hexdigest()
    if process_idem_key:
        cached_process = request_guards._idem_get(process_idem_key)
        if cached_process:
            if cached_process.get("request_hash") != process_request_hash:
                raise HTTPException(
                    status_code=409,
                    detail="This transcription idempotency key was already used for a different request.",
                )
            if cached_process.get("status") == "completed" and cached_process.get("payload"):
                return {**cached_process["payload"], "idempotent_replay": True}
            if cached_process.get("status") == "in_progress":
                raise HTTPException(
                    status_code=409,
                    detail="PROCESS_IN_PROGRESS: Your transcription is still running. Reconnecting automatically.",
                )

    process_request_id = uuid.uuid4().hex
    if not request_guards._acquire_process_slot(uid, process_request_id):
        raise HTTPException(
            status_code=409,
            detail="A transcription is already running for this account. Wait for it to finish before retrying.",
        )

    try:
        if process_idem_key:
            request_guards._idem_set(process_idem_key, {
                "status": "in_progress",
                "ts": time.time(),
                "request_hash": process_request_hash,
            })
        observability._json_log("info", "process_started", request_id=rid, file_id=req.file_id, language=req.language)
        await asyncio.to_thread(entitlements._reserve_ai_quota, uid, "process")

        def _generate_captions_in_worker_thread():
            return asyncio.run(app_state.processor.generate_captions_only(
                input_path,
                target_language=req.language,
                min_words=req.min_words,
                max_words=req.max_words,
                cleanup_mode=req.cleanup_mode,
                speech_focus=req.speech_focus,
            ))

        try:
            result = await asyncio.to_thread(_generate_captions_in_worker_thread)
        except Exception:
            # A failed transcription must never consume a customer's import
            # allowance. `trusted_uid` only bypasses a second auth check in the
            # worker; it must not change billing or quota treatment.
            await asyncio.to_thread(entitlements._release_ai_quota, uid, "process")
            raise

        if result.get("success") and not (result.get("captions") or []):
            result = {
                "success": False,
                "error": "No speech with usable word timestamps was detected.",
                "error_code": "NO_SPEECH_DETECTED",
            }

        if result.get("success"):
            observability._track_event("process_success", {"language": req.language, "request_id": rid})
            if await asyncio.to_thread(_mark_account_activated, uid):
                observability._track_event("account_activation", {"source": "first_transcription"})
            observability._json_log("info", "process_completed", request_id=rid, caption_count=len(result.get("captions") or []))
            if media_duration > 0:
                observability._track_operational_metric_sample("transcription_media_seconds", media_duration)
                observability._track_operational_metric_sample(
                    "job_cost_usd",
                    (media_duration / 60.0) * settings.AI_COST_ESTIMATE_PER_MEDIA_MINUTE_USD,
                )
            if cache_path:
                await asyncio.to_thread(media_records._write_transcription_cache, cache_path, result)
            if process_idem_key:
                request_guards._idem_set(process_idem_key, {
                    "status": "completed",
                    "ts": time.time(),
                    "request_hash": process_request_hash,
                    "payload": result,
                })
        else:
            observability._track_event("process_failed", {
                "language": req.language,
                "error": result.get("error", "unknown"),
                "request_id": rid,
            })
            observability._json_log(
                "warning",
                "process_failed",
                request_id=rid,
                error=result.get("error", "unknown"),
            )
            is_no_speech = result.get("error_code") == "NO_SPEECH_DETECTED"
            status_code = 422 if is_no_speech else 502
            # An unsuccessful caption result, including no detected speech,
            # does not use the customer's import allowance. The provider may
            # still have billed Lekha, but that cost is not passed to a user who
            # received no usable captions.
            await asyncio.to_thread(entitlements._release_ai_quota, uid, "process")
            raise HTTPException(
                status_code=status_code,
                detail=result.get("error", "Transcription service failed"),
            )

        return result
    except Exception:
        # Failed provider calls release their quota in the branches above and
        # must not leave an in-progress receipt that blocks a real retry.
        if process_idem_key:
            request_guards._idem_delete(process_idem_key)
        raise
    finally:
        request_guards._release_process_slot(uid, process_request_id)
