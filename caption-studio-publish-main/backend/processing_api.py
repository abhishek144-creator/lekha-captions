"""Processing routes; shared state and helpers resolve through main's host module."""

from types import ModuleType, SimpleNamespace

from fastapi import APIRouter

try:
    from . import settings
except ImportError:  # Direct execution from backend/ remains supported.
    import settings
try:
    from . import app_state
except ImportError:  # Direct execution from backend/ remains supported.
    import app_state


def create_processing_router(host: ModuleType) -> SimpleNamespace:
    router = APIRouter()

    @router.post("/api/process")
    async def process_video(req: host.ProcessRequest, request: host.Request, response: host.Response):
        if not settings._IS_PRODUCTION:
            return await host._process_video_inline(req, request, response)
        await host.asyncio.to_thread(host._assert_service_available, "pause_transcription")
        uid = (await host.asyncio.to_thread(host._authenticate_media_request, req.id_token, req.org_id))["uid"]
        if not host._validate_file_id(req.file_id):
            raise host.HTTPException(400, "Invalid file_id")
        await host.asyncio.to_thread(host._assert_upload_owner, req.file_id, uid)
        job_settings = {"file_id": req.file_id, "language": req.language,
                    "min_words": req.min_words, "max_words": req.max_words}
        jobs = host.TranscriptionJobs(host.get_db())
        job = await host.asyncio.to_thread(jobs.create, uid, job_settings)
        if job["status"] == "completed":
            return {**job["payload"], "idempotent_replay": True}
        if job["status"] in {"failed", "unknown", "cancelled"}:
            raise host.HTTPException(409, f"{job.get('error') or 'Transcription is no longer active.'} Reference: {job['job_id']}")
        # Dispatch immediately on the request path. The durable outbox remains the
        # recovery mechanism for a Redis outage or a crash between commit/enqueue;
        # it is no longer the primary delivery path.
        try:
            await host.asyncio.to_thread(jobs.dispatch, app_state._transcription_queue, job["job_id"])
        except Exception as error:
            host._json_log(
                "warning",
                "transcription_immediate_dispatch_failed",
                job_id=job["job_id"],
                error_type=type(error).__name__,
            )
        response.status_code = 202
        response.headers["Retry-After"] = "3"
        return {"success": True, "pending": True, "job_id": job["job_id"], "status": job["status"]}


    def run_transcription_job_task(uid: str, job_id: str):
        jobs = host.TranscriptionJobs(host.get_db())
        job = jobs.claim(uid, job_id)
        if job is None:
            return {"duplicate_or_cancelled": True}
        try:
            host._assert_account_not_deleting(uid)
            req = host.ProcessRequest(**job["settings"])
            request = host.Request({"type": "http", "headers": [], "client": ("worker", 0)})
            result = host.asyncio.run(host._process_video_inline(req, request, host.Response(), trusted_uid=uid))
            # A bounded retry persists the already obtained result; it never calls
            # the paid provider again if Firestore momentarily loses connectivity.
            for attempt in range(3):
                try:
                    jobs.finish(uid, job_id, "completed", payload=result)
                    return {"status": "completed"}
                except Exception:
                    if attempt == 2:
                        raise
                    host.time.sleep(attempt + 1)
        except Exception as error:
            # HTTP errors from `_process_video_inline` are confirmed terminal
            # outcomes (including a provider's explicit failure), so the browser
            # may safely retry the durable job without uploading again. A raw
            # exception remains `unknown`: the provider may have completed it just
            # before the worker failed, and replaying blindly could double-charge.
            confirmed_failure = isinstance(error, host.HTTPException)
            jobs.finish(uid, job_id, "failed" if confirmed_failure else "unknown",
                        error="Transcription could not complete. Contact support with this job reference; it will not be repeated automatically.")
            raise


    def _mark_account_activated(uid: str) -> bool:
        """Record the first successful transcription once for the business funnel."""
        database = host.get_db()
        if database is None or not uid:
            return False
        user_ref = database.collection("users").document(uid)

        @host.firestore.transactional
        def activate(transaction):
            snapshot = user_ref.get(transaction=transaction)
            current = snapshot.to_dict() if snapshot.exists else {}
            if current.get("activated_at"):
                return False
            transaction.set(
                user_ref,
                {"activated_at": host._utcnow().isoformat() + "Z", "activation_event": "first_transcription"},
                merge=True,
            )
            return True

        try:
            return bool(activate(database.transaction()))
        except Exception as error:
            host._json_log("warning", "account_activation_persist_failed", uid=uid, error=type(error).__name__)
            return False


    async def _process_video_inline(req: host.ProcessRequest, request: host.Request, response: host.Response, *, trusted_uid=None):
        rid = host._request_id(request)
        host._assert_service_available("pause_transcription")
        # Auth — same dev-mode bypass as /api/export
        decoded_token = {"uid": trusted_uid} if trusted_uid else host._authenticate_media_request(req.id_token, req.org_id)
        uid = (decoded_token.get("uid") or "").strip() or "unknown-user"
        client_ip = host._client_rate_key(request)
        allowed, retry_after, remaining = host._check_rate(
            app_state._process_rate, f"network:{client_ip}", settings.PROCESS_SHARED_NETWORK_RATE_LIMIT
        )
        host._apply_rate_headers(response, settings.PROCESS_SHARED_NETWORK_RATE_LIMIT, remaining, retry_after)
        if not allowed:
            host._track_event("process_rejected_rate_limited")
            raise host.HTTPException(status_code=429, detail="Too many transcription requests. Please wait before trying again.")
        user_allowed, user_retry_after, user_remaining = host._check_rate(
            app_state._process_rate, f"user:{uid}", settings.PROCESS_USER_RATE_LIMIT
        )
        host._apply_rate_headers(response, settings.PROCESS_USER_RATE_LIMIT, user_remaining, user_retry_after)
        if not user_allowed:
            host._track_event("process_rejected_rate_limited")
            raise host.HTTPException(status_code=429, detail="Too many transcription requests. Please wait before trying again.")
        if not host._validate_file_id(req.file_id):
            raise host.HTTPException(status_code=400, detail="Invalid file_id")
        host._assert_upload_owner(req.file_id, uid)
        input_path = host._safe_find_upload(req.file_id)
        if not input_path:
            host._track_event("process_failed_not_found")
            raise host.HTTPException(status_code=404, detail="File not found")
        await host.asyncio.to_thread(host._ensure_upload_clean, req.file_id, uid, input_path)

        # Enforce the per-plan maximum source length. /api/upload only applies a
        # global 180s ceiling; paid plans advertise tighter caps (starter=120s) that
        # can only be enforced here, where the caller's tier is known. Checked before
        # the cache lookup so a result cached by a higher tier can't be replayed to a
        # lower-tier user with a too-long video.
        user_tier = host._normalize_tier_name(await host.asyncio.to_thread(host._lookup_subscription_tier, uid))
        controls = host._read_service_controls()
        operator_max_seconds = int(controls.get(
            settings.MAX_UPLOAD_DURATION_CONTROL_KEY,
            settings.GLOBAL_MAX_UPLOAD_DURATION_SECONDS,
        ))
        max_seconds = min(host._max_video_seconds_for_tier(user_tier), operator_max_seconds)
        try:
            _probe_meta = await host.asyncio.to_thread(host._probe_media, input_path)
            media_duration = float((_probe_meta.get("format") or {}).get("duration") or 0)
        except Exception as probe_error:
            host._track_event("process_rejected_ffprobe", {"file_id": req.file_id, "error": str(probe_error)})
            raise host.HTTPException(status_code=422, detail="Invalid media file") from probe_error
        if media_duration > max_seconds + 0.5:
            host._track_event("process_rejected_duration", {"tier": user_tier, "duration": media_duration, "max_seconds": max_seconds})
            raise host.HTTPException(status_code=403, detail=f"Your plan allows videos up to {max_seconds}s. This video is {media_duration:.0f}s long.")
        await host.asyncio.to_thread(host._remember_source_duration, req.file_id, media_duration)

        try:
            media_hash = await host.asyncio.to_thread(host._compute_media_hash, input_path)
            cache_path = host._build_process_cache_path(media_hash, req.language, req.min_words, req.max_words)
        except Exception:
            media_hash = ""
            cache_path = ""

        if cache_path and host.os.path.exists(cache_path):
            try:
                with open(cache_path, "r", encoding="utf-8") as f:
                    cached = host.json.load(f)
                if cached.get("success") and not (cached.get("captions") or []):
                    raise host.HTTPException(
                        status_code=422,
                        detail="No speech with usable word timestamps was detected.",
                    )
                cached["cached"] = True
                host._track_event("process_cache_hit", {"language": req.language})
                return cached
            except host.HTTPException:
                raise
            except Exception:
                pass

        # A dropped HTTP response must not make the browser start another paid
        # transcription.  Keep the receipt in the shared idempotency store, keyed
        # by both account and the exact transcription settings.
        raw_process_idem = (req.idempotency_key or request.headers.get("x-idempotency-key") or "").strip()
        process_idem_key = f"process:{uid}:{raw_process_idem}" if raw_process_idem else ""
        process_request_hash = host.hashlib.sha256(host.json.dumps({
            "file_id": req.file_id,
            "language": req.language,
            "min_words": req.min_words,
            "max_words": req.max_words,
        }, sort_keys=True).encode("utf-8")).hexdigest()
        if process_idem_key:
            cached_process = host._idem_get(process_idem_key)
            if cached_process:
                if cached_process.get("request_hash") != process_request_hash:
                    raise host.HTTPException(
                        status_code=409,
                        detail="This transcription idempotency key was already used for a different request.",
                    )
                if cached_process.get("status") == "completed" and cached_process.get("payload"):
                    return {**cached_process["payload"], "idempotent_replay": True}
                if cached_process.get("status") == "in_progress":
                    raise host.HTTPException(
                        status_code=409,
                        detail="PROCESS_IN_PROGRESS: Your transcription is still running. Reconnecting automatically.",
                    )

        process_request_id = host.uuid.uuid4().hex
        if not host._acquire_process_slot(uid, process_request_id):
            raise host.HTTPException(
                status_code=409,
                detail="A transcription is already running for this account. Wait for it to finish before retrying.",
            )

        try:
            if process_idem_key:
                host._idem_set(process_idem_key, {
                    "status": "in_progress",
                    "ts": host.time.time(),
                    "request_hash": process_request_hash,
                })
            host._json_log("info", "process_started", request_id=rid, file_id=req.file_id, language=req.language)
            await host.asyncio.to_thread(host._reserve_ai_quota, uid, "process")

            def _generate_captions_in_worker_thread():
                return host.asyncio.run(app_state.processor.generate_captions_only(
                    input_path,
                    target_language=req.language,
                    min_words=req.min_words,
                    max_words=req.max_words,
                ))

            try:
                result = await host.asyncio.to_thread(_generate_captions_in_worker_thread)
            except Exception:
                # A failed transcription must never consume a customer's import
                # allowance. `trusted_uid` only bypasses a second auth check in the
                # worker; it must not change billing or quota treatment.
                await host.asyncio.to_thread(host._release_ai_quota, uid, "process")
                raise

            if result.get("success") and not (result.get("captions") or []):
                result = {
                    "success": False,
                    "error": "No speech with usable word timestamps was detected.",
                    "error_code": "NO_SPEECH_DETECTED",
                }

            if result.get("success"):
                host._track_event("process_success", {"language": req.language, "request_id": rid})
                if await host.asyncio.to_thread(host._mark_account_activated, uid):
                    host._track_event("account_activation", {"source": "first_transcription"})
                host._json_log("info", "process_completed", request_id=rid, caption_count=len(result.get("captions") or []))
                if media_duration > 0:
                    host._track_operational_metric_sample("transcription_media_seconds", media_duration)
                    host._track_operational_metric_sample(
                        "job_cost_usd",
                        (media_duration / 60.0) * settings.AI_COST_ESTIMATE_PER_MEDIA_MINUTE_USD,
                    )
                if cache_path:
                    try:
                        with open(cache_path, "w", encoding="utf-8") as f:
                            host.json.dump(result, f)
                    except Exception as e:
                        host._json_log("warning", "transcription_cache_write_failed", error=str(e))
                if process_idem_key:
                    host._idem_set(process_idem_key, {
                        "status": "completed",
                        "ts": host.time.time(),
                        "request_hash": process_request_hash,
                        "payload": result,
                    })
            else:
                host._track_event("process_failed", {
                    "language": req.language,
                    "error": result.get("error", "unknown"),
                    "request_id": rid,
                })
                host._json_log(
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
                await host.asyncio.to_thread(host._release_ai_quota, uid, "process")
                raise host.HTTPException(
                    status_code=status_code,
                    detail=result.get("error", "Transcription service failed"),
                )

            return result
        except Exception:
            # Failed provider calls release their quota in the branches above and
            # must not leave an in-progress receipt that blocks a real retry.
            if process_idem_key:
                host._idem_delete(process_idem_key)
            raise
        finally:
            host._release_process_slot(uid, process_request_id)

    return SimpleNamespace(
        router=router,
        process_video=process_video,
        run_transcription_job_task=run_transcription_job_task,
        _mark_account_activated=_mark_account_activated,
        _process_video_inline=_process_video_inline,
    )
