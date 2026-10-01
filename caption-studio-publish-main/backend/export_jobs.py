"""Export job pipeline: request sanitising, debug capture, access checks and the render job itself (no routes).

Moved from main.py. Helpers resolve through ``host`` (the main module) at call
time, so there is one copy of each and test patches on ``main`` keep applying.
"""

from types import ModuleType, SimpleNamespace


def create_export_jobs(host: ModuleType) -> SimpleNamespace:
    def _normalize_export_captions_for_media(
        captions: host.List[host.Dict[str, host.Any]], media_duration: float
    ) -> host.List[host.Dict[str, host.Any]]:
        if not host.math.isfinite(media_duration) or media_duration <= 0:
            raise host.HTTPException(status_code=422, detail="Source media duration is invalid")

        normalized = []
        for caption in captions:
            item = dict(caption)
            start = float(item.get("start_time", 0))
            end = float(item.get("end_time", 0))
            if start >= media_duration:
                raise host.HTTPException(
                    status_code=422,
                    detail="A caption starts at or after the end of the source media",
                )
            item["end_time"] = min(end, media_duration)
            if item["end_time"] <= start:
                raise host.HTTPException(
                    status_code=422,
                    detail="A caption has no renderable duration within the source media",
                )
            normalized.append(item)
        return normalized


    def _write_dead_letter(job_id: str, reason: str, payload: host.Optional[host.Dict[str, host.Any]] = None):
        data = {
            "job_id": job_id,
            "reason": reason,
            "payload": payload or {},
            "timestamp": host._utcnow().isoformat() + "Z",
        }
        try:
            with open(host.os.path.join(host.DEAD_LETTER_DIR, f"{job_id}.json"), "w", encoding="utf-8") as f:
                host.json.dump(data, f)
        except Exception as e:
            host._json_log("warning", "dead_letter_file_write_failed", job_id=job_id, error=str(e))

        db = host.get_db()
        if db:
            try:
                db.collection("export_dead_letter").document(job_id).set(
                    {**data, "expire_at": host._retention_deadline(30)}, merge=True
                )
            except Exception as e:
                host._json_log("warning", "dead_letter_db_write_failed", job_id=job_id, error=str(e))


    _CLIENT_RENDER_HINT_FIELDS = {
        "word_layouts",
        "preview_width",
        "preview_height",
        "preview_container_width",
        "preview_container_height",
        "preview_template_font_px",
        "preview_template_box_width_px",
        "preview_template_box_height_px",
        "preview_template_line_texts",
    }


    def _strip_client_render_hints(value: host.Any) -> host.Any:
        """Return editor state without browser-derived rendering measurements."""
        if isinstance(value, dict):
            return {
                key: host._strip_client_render_hints(item)
                for key, item in value.items()
                if key not in host._CLIENT_RENDER_HINT_FIELDS
            }
        if isinstance(value, list):
            return [host._strip_client_render_hints(item) for item in value]
        return value


    def _sanitize_export_request_payload(payload: host.Optional[host.Dict[str, host.Any]]) -> host.Dict[str, host.Any]:
        if not isinstance(payload, dict):
            return {}
        sanitized = host._strip_client_render_hints(payload)
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
        style: host.Dict[str, host.Any],
        captions: host.List[host.Dict[str, host.Any]],
        word_layouts: host.Dict[str, host.Any],
    ) -> None:
        """Write the last export request style so template handoff bugs are inspectable."""
        try:
            first_caption = next((c for c in captions if c and not c.get("is_text_element")), {})
            should_use_dom = False
            try:
                should_use_dom = bool(host.processor._should_use_dom_template_renderer(style, captions))
            except Exception:
                should_use_dom = False
            debug_payload = {
                "renderer_version": host.EXPORT_RENDERER_VERSION,
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
                "written_at": host._utcnow().isoformat() + "Z",
            }
            with open(host.os.path.join(host.CACHE_DIR, "last_export_request_debug.json"), "w", encoding="utf-8") as f:
                host.json.dump(debug_payload, f, indent=2, ensure_ascii=False)
        except Exception as e:
            host._json_log("warning", "last_export_request_debug_write_failed", error=str(e))


    def _require_export_job_access(request: host.Request, job: host.Dict[str, host.Any]) -> str:
        owner_uid = (job.get("uid") or "").strip()
        if not owner_uid:
            raise host.HTTPException(status_code=404, detail="Export job owner not found")

        token = host._extract_bearer_token(request)
        if host._is_explicit_dev_auth_token(token) and owner_uid == "dev-local-user":
            return owner_uid

        decoded = host.verify_token(token) if token else None
        if decoded:
            request_uid = (decoded.get("uid") or "").strip()
            if request_uid != owner_uid:
                raise host.HTTPException(status_code=403, detail="You do not have access to this export job")
            return request_uid

        db = host.get_db()
        if db is None and host._is_explicit_dev_auth_token(token) and owner_uid == "dev-local-user":
            return owner_uid
        raise host.HTTPException(status_code=401, detail="Authentication required")


    def _mark_export_processing(export_job_id: str):
        processing_started_at = host.time.time()
        job = host._load_export_job(export_job_id) or {}
        # Preserve admission time across queue waits and retries. Starting the clock
        # in the renderer hid the backlog from the end-to-end export SLO.
        queue_entered_at = float(job.get("queue_entered_at") or job.get("started_at") or processing_started_at)
        queue_wait_ms = job.get("queue_wait_ms")
        if queue_wait_ms is None:
            queue_wait_ms = max(0, int((processing_started_at - queue_entered_at) * 1000))
        host._set_export_job(export_job_id, "processing", queue_entered_at=queue_entered_at,
                        processing_started_at=processing_started_at, queue_wait_ms=queue_wait_ms)
        return queue_entered_at, processing_started_at


    async def _process_export_job_core(req: host.ExportRequest, uid: str, rid: str, export_job_id: str):
        host._assert_account_not_deleting(uid)
        queue_entered_at, processing_started_at = host._mark_export_processing(export_job_id)
        db = host.get_db()
        db_available = db is not None
        now = host.time.time()
        recent_exports = []
        credits = 999
        user_data = {}
        user_ref = None

        if db_available:
            user_ref = db.collection('users').document(uid)
            user_doc = user_ref.get()

            if not user_doc.exists:
                if host._IS_PRODUCTION:
                    raise host.HTTPException(status_code=409, detail="Account no longer exists.")
                host._log(rid, f"User {uid} missing in Firestore; auto-creating defaults")
                default_user = {
                    'credits_remaining': host.FREE_PLAN_CREDITS,
                    'subscription_tier': 'free',
                    'export_timestamps': [],
                    'created_at': host.time.time(),
                    'uid': uid,
                }
                user_ref.set(default_user)
                user_data = default_user
            else:
                user_data = user_doc.to_dict() or {}

            if user_data.get("is_promo_user") and user_data.get("promo_expires"):
                try:
                    promo_exp = host.date.fromisoformat(user_data["promo_expires"])
                    if host.date.today() > promo_exp:
                        user_ref.update({
                            "subscription_tier": "free",
                            "credits_remaining": 0,
                            "is_promo_user": False,
                        })
                        user_data["subscription_tier"] = "free"
                        user_data["credits_remaining"] = 0
                except Exception as e:
                    host._log(rid, f"Promo expiry check failed: {e}")

            allowed, policy_error, recent_exports = host._evaluate_export_policy(user_data, now)
            if not allowed:
                raise host.HTTPException(status_code=403 if "UPGRADE_REQUIRED" in policy_error or "PLAN_EXPIRED" in policy_error else 429, detail=policy_error)
            try:
                credits = max(0, int(user_data.get('credits_remaining', 0) or 0))
            except (TypeError, ValueError):
                credits = 0
        else:
            if not host.ALLOW_EXPORT_WITHOUT_DB:
                # Rendering is a metered operation. Continuing without the source of
                # truth for credits turns a database outage into a billing bypass.
                raise host.HTTPException(status_code=503, detail="Account and credit service is temporarily unavailable")
            host._log(rid, "Firestore unavailable; explicit local export bypass enabled")

        user_tier = host._normalize_tier_name(user_data.get("subscription_tier", "free") if user_data else "free")
        preset = host._resolve_export_preset(user_tier, req.quality, req.fps)
        if preset["downgraded"]:
            host._log(rid, f"Export preset adjusted by tier={user_tier}: requested {req.quality}@{req.fps} -> {preset['quality']}@{preset['fps']}")

        if not host._validate_file_id(req.file_id):
            raise host.HTTPException(status_code=400, detail="Invalid file_id")
        host._assert_upload_owner(req.file_id, uid)
        host._assert_upload_clean(req.file_id)
        input_path = host._safe_find_upload(req.file_id)
        if not input_path:
            raise host.HTTPException(status_code=404, detail="Video not found")

        source_meta = host._probe_media(input_path)
        source_duration = float((source_meta.get("format") or {}).get("duration") or 0)
        source_video_stream = next(
            (stream for stream in (source_meta.get("streams") or [])
             if stream.get("codec_type") == "video"),
            {},
        )
        source_width = int(source_video_stream.get("width") or 0)
        source_height = int(source_video_stream.get("height") or 0)
        captions = host._strip_client_render_hints(host._normalize_export_captions_for_media(
            [c.model_dump(by_alias=True) for c in req.captions],
            source_duration,
        ))
        server_style = req.validated_style()
        server_word_layouts: host.Dict[str, host.Any] = {}
        # Reuse rendered artifact for identical request payload.
        media_hash = host._source_media_identity(req.file_id, input_path)
        request_hash = host.render_cache_identity(
            uid=uid,
            renderer_version=host.EXPORT_RENDERER_VERSION,
            media_hash=media_hash,
            captions=captions,
            style=server_style,
            quality=preset["quality"],
            fps=preset["fps"],
            export_aspect_ratio=req.export_aspect_ratio,
        )
        cached_render_path = host.os.path.join(host.RENDER_CACHE_DIR, f"{request_hash}.mp4")
        template_export_active = bool(
            server_style.get("template_id")
            or server_style.get("template_20_id")
            or any(
                (caption.get("template_id") or caption.get("template_20_id") or caption.get("applied_template_style"))
                for caption in captions
                if caption and not caption.get("is_text_element")
            )
        )
        cache_eligible = host.render_cache_eligible(
            template_export_active=template_export_active,
            template_cache_enabled=host.os.environ.get("ENABLE_TEMPLATE_RENDER_CACHE", "1") == "1",
        )

        output_filename = f"export_{req.file_id}_{request_hash[:12]}.mp4"
        output_path = host.os.path.join(host.EXPORT_DIR, output_filename)
        render_started_at = host.time.time()
        style_with_quality = {
            **server_style,
            'quality': preset["quality"],
            'fps': preset["fps"],
            'export_aspect_ratio': req.export_aspect_ratio if req.export_aspect_ratio in ('9:16', '1:1', '16:9') else '',
        }
        host._write_last_export_request_debug(
            export_job_id=export_job_id,
            file_id=req.file_id,
            quality=preset["quality"],
            fps=preset["fps"],
            style=style_with_quality,
            captions=captions,
            word_layouts=server_word_layouts,
        )

        if cache_eligible and not host.os.path.exists(cached_render_path):
            await host.asyncio.to_thread(
                host.download_render_cache, uid, request_hash, cached_render_path,
            )
        if host.os.path.exists(cached_render_path) and cache_eligible:
            host.shutil.copy2(cached_render_path, output_path)
            render_finished_at = host.time.time()
            render_ms = int((render_finished_at - render_started_at) * 1000)
            cache_hit = True
            host._track_event("render_cache_hit", {"job_id": export_job_id})
        else:
            cache_hit = False
            host._log(rid, f"Starting render now job={export_job_id}")
            async with host.render_semaphore:
                result = await host.processor.burn_only(
                    input_path, output_path, captions, style_with_quality, server_word_layouts
                )
            if not result.get('success'):
                host._json_log("error", "video_render_failed", uid=uid, error=str(result.get('error') or "unknown"))
                raise host.HTTPException(status_code=500, detail="Video render failed")
            render_finished_at = host.time.time()
            render_ms = int((render_finished_at - render_started_at) * 1000)

        try:
            rendered_meta = host._probe_media(output_path)
            rendered_duration = float((rendered_meta.get("format") or {}).get("duration") or 0)
            rendered_video_stream = next(
                (stream for stream in (rendered_meta.get("streams") or [])
                 if stream.get("codec_type") == "video"),
                {},
            )
            rendered_has_video = bool(rendered_video_stream)
            rendered_width = int(rendered_video_stream.get("width") or 0)
            rendered_height = int(rendered_video_stream.get("height") or 0)
            if not host.os.path.isfile(output_path) or host.os.path.getsize(output_path) <= 0 or not rendered_has_video or rendered_duration <= 0:
                raise ValueError("rendered output is empty or has no valid video stream")
        except Exception as e:
            for invalid_path in {output_path, cached_render_path}:
                if host.os.path.isfile(invalid_path):
                    try:
                        host.os.remove(invalid_path)
                    except OSError:
                        pass
            if cache_hit:
                await host.asyncio.to_thread(host.delete_render_cache, uid, request_hash)
            host._json_log("error", "render_output_validation_failed", uid=uid, job_id=export_job_id, error=str(e))
            raise host.HTTPException(status_code=500, detail="Rendered video failed validation") from e

        if not cache_hit and cache_eligible:
            try:
                host.shutil.copy2(output_path, cached_render_path)
                await host.asyncio.to_thread(
                    host.upload_render_cache, uid, request_hash, cached_render_path, 24,
                )
            except Exception as error:
                host._json_log(
                    "warning", "render_cache_persist_failed", job_id=export_job_id,
                    error_type=type(error).__name__,
                )

        host._set_export_job(export_job_id, "finalizing")
        # Serve local exports through signed same-origin media URLs so the browser can
        # fetch them without exposing the exports directory publicly. Firebase remains
        # the durable history/sharing destination when upload succeeds.
        video_url = ""
        firebase_url = None
        retention_hours = 2
        if db_available and user_data:
            current_tier = user_data.get('subscription_tier', 'free')
            if current_tier in host.PLAN_PRICING:
                retention_hours = host.PLAN_PRICING[current_tier].get('export_retention_hours', 2)
        try:
            remote_path = f"exports/{uid}/{output_filename}"
            firebase_url = host.upload_to_firebase_storage(
                output_path, remote_path, "video/mp4", retention_hours
            )
        except Exception as e:
            host._log(rid, f"Firebase upload failed, using local export: {e}")

        if host._IS_PRODUCTION and not firebase_url:
            raise host.HTTPException(status_code=503, detail="Rendered media could not be persisted. Please retry.")
        expires_at = (host._utcnow() + host.timedelta(hours=retention_hours)).isoformat() + "Z"
        video_url = host._signed_export_url(
            output_filename, uid, retention_hours * 3600, export_job_id[:8]
        )

        if db_available and user_ref is not None:
            history_item = {
                "id": req.file_id,
                "export_job_id": export_job_id,
                "filename": output_filename,
                "url": video_url,
                "createdAt": now * 1000,
                "firebase_path": f"exports/{uid}/{output_filename}" if firebase_url else None
            }
            dropped_history = host._record_export_usage(
                db, user_ref, history_item, now, export_job_id
            )
            for dropped in dropped_history:
                dropped_path = dropped.get("firebase_path") if isinstance(dropped, dict) else ""
                if dropped_path:
                    host.delete_from_firebase_storage(dropped_path)

        payload = {
            "success": True,
            "video_url": video_url,
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
        completed_at = host.time.time()
        total_ms = int((completed_at - queue_entered_at) * 1000)
        preparation_ms = int((render_started_at - processing_started_at) * 1000)
        finalization_ms = int((completed_at - render_finished_at) * 1000)
        output_size_bytes = host.os.path.getsize(output_path)
        recorded_job = host._set_export_job(
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
            host.create_notification(
                db,
                uid,
                kind="export_completed",
                title="Your video is ready",
                message="Your background export finished successfully.",
                action_url=video_url,
                resource_id=export_job_id,
            )
        except Exception as error:
            host._json_log(
                "warning", "export_notification_persist_failed",
                job_id=export_job_id, error=type(error).__name__,
            )
        host._json_log(
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
        host._track_event("export_success", {"quality": preset["quality"], "fps": preset["fps"], "tier": preset["tier"]})
        host._track_operational_metric_sample("export_total_ms", total_ms)
        host._track_operational_metric_sample("export_render_ms", render_ms)
        host._track_operational_metric_sample(
            "job_cost_usd",
            (rendered_duration / 60.0) * host.RENDER_COST_ESTIMATE_PER_MEDIA_MINUTE_USD,
        )
        return payload


    def run_export_job_task(
        export_job_id: str,
        req_payload: host.Dict[str, host.Any],
        uid: str,
        idempotency_key: str = "",
        idempotency_request_hash: str = "",
    ):
        rid = f"worker-{export_job_id[:8]}"
        slot_acquired = False
        # RQ has removed the job ID from the pending list before invoking us. Keep
        # the atomic admission ledger aligned with pending work, not active work.
        host._release_export_pending_work(export_job_id)
        existing_job = host._load_export_job(export_job_id) or {}
        if existing_job.get("status") == "completed":
            return existing_job.get("payload") or {}
        try:
            host._set_export_job(export_job_id, "starting", worker_release=host.APP_RELEASE)
        except host.InvalidJobTransition:
            current = host._load_export_job(export_job_id) or {}
            return {"success": False, "status": current.get("status"), "export_job_id": export_job_id}
        try:
            if (existing_job.get("status") or "").lower() == "cancelled":
                host._json_log("info", "cancelled_export_skipped", job_id=export_job_id, uid=uid)
                return {
                    "success": False,
                    "status": "cancelled",
                    "export_job_id": export_job_id,
                }
            slot_acquired = host._acquire_export_slot(uid, export_job_id)
            if not slot_acquired:
                raise RuntimeError("Another export currently owns this account's export slot")
            req = host.ExportRequest(**req_payload)
            payload = host.asyncio.run(host._process_export_job_core(req, uid, rid, export_job_id))
            if idempotency_key:
                host._idem_set(idempotency_key, {
                    "status": "completed",
                    "ts": host.time.time(),
                    "payload": payload,
                    "request_hash": idempotency_request_hash,
                    "job_id": export_job_id,
                })
            return payload
        except Exception as e:
            try:
                from rq import get_current_job
                rq_job = get_current_job()
                retryable = not isinstance(e, host.HTTPException) or e.status_code >= 500
                retry_pending = bool(rq_job and rq_job.retries_left and retryable)
                if rq_job and not retryable:
                    rq_job.retries_left = 0
                    rq_job.save()
                host._set_export_job(export_job_id, "retrying" if retry_pending else "failed",
                                failed_at=host.time.time(), error="Export failed. Please retry or contact support.")
            except Exception as state_error:
                host._json_log(
                    "error",
                    "export_failure_state_persist_failed",
                    job_id=export_job_id,
                    error=str(state_error),
                )
            failed_job = host._load_export_job(export_job_id) or {}
            entered_at = float(failed_job.get("queue_entered_at") or host.time.time())
            host._json_log(
                "warning", "export_observation", job_id=export_job_id,
                status="retrying" if locals().get("retry_pending", False) else "failed",
                queue_wait_ms=failed_job.get("queue_wait_ms"),
                elapsed_ms=max(0, int((host.time.time() - entered_at) * 1000)),
            )
            if idempotency_key and not locals().get("retry_pending", False):
                host._idem_delete(idempotency_key)
            host._write_dead_letter(
                export_job_id,
                str(e),
                {"req_payload": host._sanitize_export_request_payload(req_payload), "uid": uid},
            )
            raise
        finally:
            if slot_acquired:
                host._release_export_slot(uid, export_job_id)

    return SimpleNamespace(
        _normalize_export_captions_for_media=_normalize_export_captions_for_media,
        _write_dead_letter=_write_dead_letter,
        _CLIENT_RENDER_HINT_FIELDS=_CLIENT_RENDER_HINT_FIELDS,
        _strip_client_render_hints=_strip_client_render_hints,
        _sanitize_export_request_payload=_sanitize_export_request_payload,
        _write_last_export_request_debug=_write_last_export_request_debug,
        _require_export_job_access=_require_export_job_access,
        _mark_export_processing=_mark_export_processing,
        _process_export_job_core=_process_export_job_core,
        run_export_job_task=run_export_job_task,
    )
