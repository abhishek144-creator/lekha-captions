"""Export job routes: submit, batch, status, result, cancel and replay.

Handlers resolve shared helpers through ``host`` (the main module) at call time,
so there is one copy of each helper and test patches on ``main`` keep applying.
"""

from types import ModuleType, SimpleNamespace

from fastapi import FastAPI, UploadFile, File, HTTPException, Response
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Request
from fastapi import APIRouter


def create_export_router(host: ModuleType) -> SimpleNamespace:
    router = APIRouter()

    def _render_queue_for(queue_name):
        queue = host._export_queues.get(queue_name)
        if queue is None and not host._IS_PRODUCTION:
            return host._export_queue
        if queue is None:
            raise HTTPException(503, "The selected render queue is unavailable.", headers={"Retry-After": "10"})
        return queue


    def _queue_for_export_job_record(job: host.Dict[str, host.Any]):
        queue_name = str((job or {}).get("queue_name") or host.EXPORT_QUEUE_NAME)
        return host._export_queues.get(queue_name) or host._export_queue


    def _enqueue_export_job(render_queue, **job):
        if host._IS_PRODUCTION:
            estimated_work_seconds = (job.get("meta") or {}).get("estimated_render_seconds")
            delivery = host.enqueue_bounded_across_queues(
                render_queue,
                list(host._export_queues.values()),
                host.EXPORT_MAX_PENDING_JOBS,
                max_pending_work_seconds=host.EXPORT_MAX_PENDING_WORK_SECONDS,
                estimated_work_seconds=estimated_work_seconds,
                **job,
            )
            host.worker_launcher.kick(render_queue.connection, render_queue.name)
            return delivery
        return render_queue.enqueue_call(**job)


    def _release_export_pending_work(job_id: str):
        if host._rq_redis_client is None:
            return
        try:
            host.release_pending_work(host._rq_redis_client, job_id)
        except Exception as error:
            host._json_log(
                "warning", "export_pending_work_release_failed",
                job_id=job_id, error=type(error).__name__,
            )


    @router.post("/api/export")
    async def export_video(req: host.ExportRequest, request: Request, response: Response):
        rid = host._request_id(request)
        host._assert_service_available("pause_exports")
        host._log(rid, f"Export requested file_id={req.file_id} quality={req.quality}")
        host._track_event("export_requested", {"quality": req.quality, "fps": req.fps})

        # 1. Authenticate user
        decoded_token = host._authenticate_media_request(req.id_token, req.org_id)
        uid = (decoded_token.get("uid") or "").strip() or "dev-local-user"
        if host._IS_PRODUCTION and host._export_queue is None:
            raise HTTPException(status_code=503, detail="Export service is temporarily unavailable. Please retry shortly.",
                                headers={"Retry-After": "10"})
        if decoded_token.get("_dev_mode"):
            host._log(rid, "Using explicit debug auth bypass token")

        now_ts = host.time.time()
        recent_failures = host._get_recent_export_failures(uid)
        if len(recent_failures) >= host.EXPORT_FAILURE_LIMIT:
            retry_after = max(1, int(host.EXPORT_FAILURE_WINDOW - (now_ts - min(recent_failures))))
            response.headers["Retry-After"] = str(retry_after)
            raise HTTPException(status_code=429, detail="Too many failed export attempts. Please retry after a short wait.")

        safe_request_snapshot = host._sanitize_export_request_payload(req.model_dump(by_alias=True))
        # Rejected before any claim, slot or charge: the job record must fit Firestore.
        if not host.export_snapshot_fits(safe_request_snapshot):
            raise HTTPException(status_code=413, detail="This project is too large to export in one go. Split it into shorter videos.")
        idempotency_request_hash = host.hashlib.sha256(
            host.json.dumps(safe_request_snapshot, sort_keys=True, default=str).encode("utf-8")
        ).hexdigest()

        # Idempotency key support to prevent duplicate renders/charges.
        raw_idem = (req.idempotency_key or request.headers.get("x-idempotency-key") or "").strip()
        if not raw_idem:
            # Auto-key the exact sanitized request.  This means repeat clicks,
            # page refreshes, and browser response loss replay the original render
            # (and its result) instead of consuming another export credit.  A real
            # editor change has a new hash and is therefore a new export.
            raw_idem = f"auto:{req.file_id}:{idempotency_request_hash}"
        idem_key = f"{uid}:{raw_idem}" if raw_idem else ""
        if idem_key:
            cached = host._idem_get(idem_key)
            if cached and (host.time.time() - cached.get("ts", 0) < 6 * 3600):
                cached_request_hash = cached.get("request_hash", "")
                if cached_request_hash and cached_request_hash != idempotency_request_hash:
                    raise HTTPException(
                        status_code=409,
                        detail="This idempotency key was already used for a different export request.",
                    )
                if cached.get("status") == "completed" and cached.get("payload"):
                    host._log(rid, f"Idempotent replay for key={raw_idem[:16]}")
                    recovery_payload = host._refresh_completed_export_payload(
                        cached["payload"], uid, str(cached.get("job_id") or "")
                    )
                    return {**recovery_payload, "idempotent_replay": True}
                if cached.get("status") == "in_progress":
                    if cached.get("payload"):
                        return {**cached["payload"], "idempotent_replay": True}
                    raise HTTPException(status_code=409, detail="Export with this idempotency key is already in progress.")
            if not host._idem_claim(idem_key, {
                "status": "in_progress", "ts": host.time.time(),
                "request_hash": idempotency_request_hash,
            }):
                raise HTTPException(status_code=409, detail="Export with this idempotency key is already in progress.")

        # Per-user concurrent export guard.
        export_job_id = str(host.uuid.uuid4())
        if not host._acquire_export_slot(uid, export_job_id):
            if idem_key:
                host._idem_delete(idem_key)
            raise HTTPException(status_code=429, detail="Another export is already running for this account. Please wait.")

        release_export_slot_in_request = True
        try:
            duration_hint = await host.asyncio.to_thread(host._source_duration_hint, req.file_id, uid)
            capacity = host.estimate_render_capacity(duration_hint, safe_request_snapshot)
            host._set_export_job(
                export_job_id,
                "queued",
                uid=uid,
                file_id=req.file_id,
                quality=req.quality,
                started_at=host.time.time(),
                queue_entered_at=host.time.time(),
                idempotency_key=idem_key,
                idempotency_request_hash=idempotency_request_hash,
                estimated_render_seconds=capacity["estimated_render_seconds"],
                render_work_units=capacity["render_work_units"],
                render_class=capacity["render_class"],
                queue_name=capacity["queue_name"],
                request_snapshot=safe_request_snapshot,
            )
            if host._export_queue is not None:
                queued_payload = {
                    "success": True,
                    "queued": True,
                    "export_job_id": export_job_id,
                    "status": "queued",
                }
                # Every key remains in progress until the worker stores a terminal
                # result. Replays return this queued job while it runs, including
                # automatic keys generated for a double-click-safe browser export.
                if idem_key:
                    host._idem_set(idem_key, {
                        "status": "in_progress",
                        "ts": host.time.time(),
                        "payload": queued_payload,
                        "request_hash": idempotency_request_hash,
                        "job_id": export_job_id,
                    })
                host._enqueue_export_job(
                    host._render_queue_for(capacity["queue_name"]),
                    func=host.run_export_job_task,
                    args=(
                        export_job_id,
                        safe_request_snapshot,
                        uid,
                        idem_key,
                        idempotency_request_hash,
                    ),
                    job_id=export_job_id,
                    meta={
                        "estimated_render_seconds": capacity["estimated_render_seconds"],
                        "render_work_units": capacity["render_work_units"],
                        "render_class": capacity["render_class"],
                        "renderer": capacity["renderer"],
                    },
                    retry=host.RQRetry(max=3, interval=[10, 30, 60]) if host.RQRetry else None,
                    ttl=host.EXPORT_MAX_QUEUE_WAIT_SECONDS,
                    result_ttl=24 * 3600,
                    failure_ttl=7 * 24 * 3600,
                )
                host._audit_action("export_enqueued", uid, {"job_id": export_job_id, "file_id": req.file_id})
                release_export_slot_in_request = False
                return queued_payload

            host._set_export_job(export_job_id, "starting")
            payload = await host._process_export_job_core(req, uid, rid, export_job_id)
            if idem_key:
                host._idem_set(idem_key, {
                    "status": "completed",
                    "ts": host.time.time(),
                    "payload": payload,
                    "request_hash": idempotency_request_hash,
                    "job_id": export_job_id,
                })
            return payload

        except HTTPException as http_ex:
            host._set_export_job(export_job_id, "failed", failed_at=host.time.time(), error=str(http_ex.detail))
            host._record_export_failure(uid)
            host._track_event("export_failed_http", {"detail": str(http_ex.detail)})
            host._write_dead_letter(
                export_job_id,
                str(http_ex.detail),
                {"uid": uid, "file_id": req.file_id, "req_payload": safe_request_snapshot},
            )
            if idem_key:
                host._idem_delete(idem_key)
            raise
        except Exception as e:
            host._set_export_job(export_job_id, "failed", failed_at=host.time.time(), error=str(e))
            host._record_export_failure(uid)
            host._track_event("export_failed_exception", {"error": str(e)})
            host._write_dead_letter(
                export_job_id,
                str(e),
                {"uid": uid, "file_id": req.file_id, "req_payload": safe_request_snapshot},
            )
            if idem_key:
                host._idem_delete(idem_key)
            raise HTTPException(status_code=500, detail=f"Export failed. Reference: {rid}")
        finally:
            if release_export_slot_in_request:
                host._release_export_slot(uid, export_job_id)


    @router.post("/api/batch/exports", status_code=202)
    async def create_export_batch(req: host.BatchExportRequest, request: Request):
        """Queue up to ten independent exports with one idempotent request.

    Items use the normal tiered render queues and billing path. The worker's
    account slot serializes items for one customer, preventing a batch from
    bypassing the single-account concurrency and credit controls.
    """
        host._assert_service_available("pause_exports")
        decoded = host._authenticate_media_request(req.id_token)
        uid = (decoded.get("uid") or "").strip()
        if host._export_queue is None:
            raise HTTPException(503, "Batch export service is temporarily unavailable", headers={"Retry-After": "10"})

        idem_key = f"batch:{uid}:{req.idempotency_key}"
        cached = host._idem_get(idem_key)
        if cached and cached.get("payload"):
            return {**cached["payload"], "idempotent_replay": True}

        batch_id = str(host.uuid.uuid4())
        accepted = []
        rejected = []
        for index, item in enumerate(req.exports):
            job_id = str(host.uuid.uuid4())
            try:
                host._assert_upload_owner(item.file_id, uid)
                host._assert_upload_clean(item.file_id)
                safe_snapshot = host._sanitize_export_request_payload(item.model_dump(by_alias=True))
                if not host.export_snapshot_fits(safe_snapshot):
                    raise HTTPException(status_code=413, detail="This project is too large to export in one go.")
                duration_hint = await host.asyncio.to_thread(host._source_duration_hint, item.file_id, uid)
                capacity = host.estimate_render_capacity(duration_hint, safe_snapshot)
                host._set_export_job(
                    job_id,
                    "queued",
                    uid=uid,
                    batch_id=batch_id,
                    batch_index=index,
                    file_id=item.file_id,
                    quality=item.quality,
                    started_at=host.time.time(),
                    queue_entered_at=host.time.time(),
                    estimated_render_seconds=capacity["estimated_render_seconds"],
                    render_work_units=capacity["render_work_units"],
                    render_class=capacity["render_class"],
                    queue_name=capacity["queue_name"],
                    request_snapshot=safe_snapshot,
                )
                host._enqueue_export_job(
                    host._render_queue_for(capacity["queue_name"]),
                    func=host.run_export_job_task,
                    args=(job_id, safe_snapshot, uid, "", ""),
                    job_id=job_id,
                    meta={
                        "batch_id": batch_id,
                        "batch_index": index,
                        "estimated_render_seconds": capacity["estimated_render_seconds"],
                        "render_work_units": capacity["render_work_units"],
                        "render_class": capacity["render_class"],
                        "renderer": capacity["renderer"],
                    },
                    retry=host.RQRetry(max=12, interval=[10, 15, 20, 30]) if host.RQRetry else None,
                    ttl=host.EXPORT_MAX_QUEUE_WAIT_SECONDS,
                    result_ttl=24 * 3600,
                    failure_ttl=7 * 24 * 3600,
                )
                accepted.append({"index": index, "job_id": job_id, "file_id": item.file_id})
            except Exception as error:
                try:
                    host._set_export_job(job_id, "failed", failed_at=host.time.time(), error="Batch item was not admitted")
                except Exception:
                    pass
                rejected.append({
                    "index": index,
                    "file_id": item.file_id,
                    "reason": error.detail if isinstance(error, HTTPException) else "Capacity unavailable",
                })

        if not accepted:
            raise HTTPException(429, "No batch items could be admitted", headers={"Retry-After": "10"})
        payload = {
            "success": True,
            "batch_id": batch_id,
            "accepted": accepted,
            "rejected": rejected,
            "status_url": f"/api/batch/exports/{batch_id}",
        }
        host._idem_set(idem_key, {"status": "completed", "ts": host.time.time(), "payload": payload})
        database = host.get_db()
        if database is not None:
            database.collection("export_batches").document(batch_id).set({
                "batch_id": batch_id,
                "uid": uid,
                "job_ids": [item["job_id"] for item in accepted],
                "created_at": host.time.time(),
                "expire_at": host._retention_deadline(30),
                "rejected": rejected,
            })
        host._audit_action("export_batch_enqueued", uid, {"batch_id": batch_id, "count": len(accepted)})
        return payload


    @router.get("/api/batch/exports/{batch_id}")
    def get_export_batch(batch_id: str, request: Request):
        uid = host._authenticate_bearer_request(request)["uid"]
        database = host.get_db()
        if database is None:
            raise HTTPException(503, "Batch status storage is unavailable")
        snapshot = database.collection("export_batches").document(batch_id).get()
        batch = snapshot.to_dict() if snapshot.exists else None
        if not batch:
            raise HTTPException(404, "Export batch not found")
        if batch.get("uid") != uid:
            raise HTTPException(403, "Export batch does not belong to this account")
        jobs = []
        for job_id in batch.get("job_ids") or []:
            job = host._load_export_job(str(job_id)) or {}
            jobs.append({
                "job_id": job_id,
                "status": job.get("status", "unknown"),
                "error": "Export failed. Please retry." if job.get("error") else None,
            })
        terminal = sum(1 for job in jobs if job["status"] in {"completed", "failed", "cancelled"})
        return {
            "success": True,
            "batch_id": batch_id,
            "status": "completed" if terminal == len(jobs) else "processing",
            "completed_items": terminal,
            "total_items": len(jobs),
            "jobs": jobs,
            "rejected": batch.get("rejected") or [],
        }


    def _reconcile_export_job(job_id: str, job: host.Dict[str, host.Any]):
        if host._export_queue is None or job.get("status") in {"completed", "failed", "cancelled"}:
            return job
        try:
            job_queue = host._queue_for_export_job_record(job)
            status = str(job.get("status") or "").lower()
            queue_age = host.time.time() - float(
                job.get("queue_entered_at") or job.get("started_at") or host.time.time()
            )
            if status == "queued" and queue_age >= host.EXPORT_MAX_QUEUE_WAIT_SECONDS:
                job = host._set_export_job(
                    job_id,
                    "failed",
                    expected_status="queued",
                    error=(
                        f"Export could not start within "
                        f"{max(1, host.math.ceil(host.EXPORT_MAX_QUEUE_WAIT_SECONDS / 60))} minutes. "
                        "Please retry. No credit was charged."
                    ),
                    failure_code="preparation_timeout",
                    failed_at=host.time.time(),
                )
                if job.get("status") == "failed":
                    host._json_log(
                        "warning", "export_observation", job_id=job_id, status="failed",
                        queue_wait_ms=max(0, int(queue_age * 1000)),
                        failure_code="preparation_timeout",
                    )
                try:
                    stale_rq_job = job_queue.fetch_job(job_id) if job_queue else None
                    if stale_rq_job is not None:
                        stale_rq_job.cancel()
                except Exception as error:
                    host._json_log(
                        "warning",
                        "export_preparation_timeout_cleanup_failed",
                        job_id=job_id,
                        error=type(error).__name__,
                    )
                host._release_export_pending_work(job_id)
                host._release_export_slot(str(job.get("uid") or ""), job_id)
                host._idem_delete(str(job.get("idempotency_key") or ""))
                host._track_event("export_preparation_timeout", {"job_id": job_id})
                return job
            rq_job = job_queue.fetch_job(job_id) if job_queue else None
            state = rq_job.get_status(refresh=True) if rq_job else "missing"
            state = str(getattr(state, "value", state)).lower()
            age = host.time.time() - float(job.get("updated_at") or host.time.time())
            if state in {"failed", "stopped", "canceled", "cancelled", "finished"} or (state == "missing" and age > 120):
                job = host._set_export_job(job_id, "failed", error="Export was interrupted. Please retry.", failed_at=host.time.time())
                if job.get("status") == "failed":
                    host._json_log(
                        "warning", "export_observation", job_id=job_id, status="failed",
                        queue_wait_ms=job.get("queue_wait_ms"), failure_code="worker_interrupted",
                    )
                host._release_export_pending_work(job_id)
                host._release_export_slot(str(job.get("uid") or ""), job_id)
            elif state in {"scheduled", "deferred"} and job.get("status") in {"starting", "processing", "finalizing"}:
                job = host._set_export_job(job_id, "retrying", error="Export interrupted; retry scheduled.")
        except host.InvalidJobTransition:
            return host._load_export_job(job_id) or job
        except Exception as error:
            host._json_log("warning", "export_reconciliation_failed", job_id=job_id, error=type(error).__name__)
        return job


    def _active_workers_for_queue(queue_name: str) -> host.Optional[int]:
        if host.RQWorker is None or host._rq_redis_client is None:
            return None
        try:
            active = 0
            for worker in host.RQWorker.all(connection=host._rq_redis_client):
                names = (
                    worker.queue_names()
                    if callable(getattr(worker, "queue_names", None))
                    else getattr(worker, "queue_names", [])
                )
                normalized = {
                    value.decode("utf-8", "replace") if isinstance(value, bytes) else str(value)
                    for value in names
                }
                if queue_name in normalized:
                    active += 1
            return active
        except Exception:
            return None


    def _export_queue_prediction(job_id: str, job: host.Dict[str, host.Any]) -> host.Dict[str, host.Any]:
        if str(job.get("status") or "").lower() != "queued" or host.Job is None:
            return {}
        queue_name = str(job.get("queue_name") or host.EXPORT_QUEUE_NAME)
        queue = host._export_queues.get(queue_name)
        if queue is None:
            return {}
        try:
            active_workers = host._active_workers_for_queue(queue_name)
            return host.job_queue_prediction(
                queue,
                host.Job,
                job_id,
                active_workers=active_workers,
            ) or {}
        except Exception as error:
            host._json_log(
                "warning", "export_queue_prediction_failed",
                job_id=job_id, error=type(error).__name__,
            )
            return {}


    @router.get("/api/export-status/{job_id}")
    def export_status(job_id: str, request: Request):
        job = host._load_export_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Export job not found")
        host._require_export_job_access(request, job)
        job = host._reconcile_export_job(job_id, job)
        if job.get("status") == "queued":
            # Safety net for on-demand workers: a queued job whose worker crashed
            # gets a fresh one on the next poll (no-op when launching is disabled).
            record_queue = host._queue_for_export_job_record(job)
            if record_queue is not None:
                host.worker_launcher.kick(record_queue.connection, record_queue.name)
        queue_prediction = host._export_queue_prediction(job_id, job)
        # Keep payload concise and avoid leaking internal paths.
        return {
            "job_id": job_id,
            "status": job.get("status", "unknown"),
            "updated_at": job.get("updated_at"),
            "queue_wait_ms": job.get("queue_wait_ms"),
            "estimated_render_seconds": job.get("estimated_render_seconds"),
            "queue_position": queue_prediction.get("queue_position"),
            "jobs_ahead": queue_prediction.get("jobs_ahead"),
            "queue_depth": queue_prediction.get("queue_depth"),
            "active_workers": queue_prediction.get("active_workers"),
            "estimated_queue_wait_seconds": queue_prediction.get("estimated_queue_wait_seconds"),
            "estimated_completion_seconds": queue_prediction.get("estimated_completion_seconds"),
            "preparation_ms": job.get("preparation_ms"),
            "render_ms": job.get("render_ms"),
            "finalization_ms": job.get("finalization_ms"),
            "total_ms": job.get("total_ms"),
            "error": "Export failed. Please retry or contact support." if job.get("error") else None,
        }


    @router.get("/api/export-result/{job_id}")
    def export_result(job_id: str, request: Request):
        job = host._load_export_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Export job not found")
        host._require_export_job_access(request, job)
        job = host._reconcile_export_job(job_id, job)
        if job.get("status") != "completed":
            return {"success": False, "status": job.get("status", "unknown"), "error": "Export failed. Please retry or contact support." if job.get("error") else None}
        payload = job.get("payload") or {}
        if not payload:
            return {"success": False, "status": "completed", "error": "Result payload missing"}
        return host._refresh_completed_export_payload(payload, str(job.get("uid") or ""), job_id)


    @router.post("/api/export-cancel/{job_id}")
    def export_cancel(job_id: str, request: Request):
        job = host._load_export_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Export job not found")
        host._require_export_job_access(request, job)

        status = (job.get("status") or "unknown").lower()
        if status == "cancelled":
            idempotency_key = str(job.get("idempotency_key") or "")
            if idempotency_key:
                host._idem_delete(idempotency_key)
            return {
                "success": True,
                "status": "cancelled",
                "export_job_id": job_id,
                "idempotent_replay": True,
                "credit_released": False,
                "retry_allowed": True,
            }
        if status != "queued":
            raise HTTPException(
                status_code=409,
                detail="Only a queued export can be cancelled safely. A render already in progress will finish normally.",
            )
        if host._export_queue is None:
            raise HTTPException(status_code=503, detail="Durable queue is not configured")

        uid = str(job.get("uid") or "")
        try:
            host._set_export_job(job_id, "cancelled", cancelled_at=host.time.time(),
                            cancellation_reason="user_requested", error=None)
        except host.InvalidJobTransition as error:
            raise HTTPException(status_code=409, detail="This export has already started.") from error
        # A cancelled queue receipt must not pin the exact same editor state to a
        # terminal job for six hours. Clearing it lets the customer intentionally
        # submit the unchanged export again while the durable job record remains
        # available for audit and status history.
        idempotency_key = str(job.get("idempotency_key") or "")
        if idempotency_key:
            host._idem_delete(idempotency_key)
        host._release_export_pending_work(job_id)
        # Cancellation is durable first. If queue removal fails, a dequeued worker
        # observes CANCELLED and exits before rendering or charging.
        try:
            job_queue = host._queue_for_export_job_record(job)
            rq_job = job_queue.fetch_job(job_id) if job_queue else None
            if rq_job is not None:
                rq_job.cancel()
        except Exception as error:
            host._json_log("warning", "cancel_queue_cleanup_failed", job_id=job_id, error=type(error).__name__)
        host._release_export_slot(uid, job_id)
        host._track_event("export_cancelled", {"job_id": job_id})
        host._audit_action("export_cancelled", uid, {"job_id": job_id})
        return {
            "success": True,
            "status": "cancelled",
            "export_job_id": job_id,
            "credit_released": False,
            "retry_allowed": True,
        }


    @router.post("/api/export-replay/{job_id}")
    def export_replay(job_id: str, request: Request):
        host._assert_service_available("pause_exports")
        if host._export_queue is None:
            raise HTTPException(status_code=503, detail="Durable queue is not configured")
        db = host.get_db()
        if not db:
            raise HTTPException(status_code=503, detail="Database unavailable")
        snap = db.collection("export_jobs").document(job_id).get()
        if not snap.exists:
            raise HTTPException(status_code=404, detail="Export job not found")
        job = host.export_job_from_stored(snap.to_dict() or {})
        host._require_export_job_access(request, job)
        if (job.get("status") or "").lower() != "failed":
            raise HTTPException(
                status_code=409,
                detail="Only failed export jobs can be replayed.",
            )
        request_snapshot = job.get("request_snapshot")
        uid = job.get("uid", "")
        if not request_snapshot:
            raise HTTPException(status_code=400, detail="No request snapshot found to replay")
        new_job_id = str(host.uuid.uuid4())
        if not host._acquire_export_slot(uid, new_job_id):
            raise HTTPException(
                status_code=429,
                detail="Another export is already running for this account. Please wait.",
            )
        try:
            duration_hint = host._source_duration_hint(str(request_snapshot.get("file_id") or ""), uid)
            capacity = host.estimate_render_capacity(duration_hint, request_snapshot)
            host._set_export_job(
                new_job_id,
                "queued",
                uid=uid,
                file_id=request_snapshot.get("file_id"),
                started_at=host.time.time(),
                request_snapshot=request_snapshot,
                replayed_from=job_id,
                estimated_render_seconds=capacity["estimated_render_seconds"],
                render_work_units=capacity["render_work_units"],
                render_class=capacity["render_class"],
                queue_name=capacity["queue_name"],
            )
            host._enqueue_export_job(
                host._render_queue_for(capacity["queue_name"]),
                func=host.run_export_job_task,
                args=(new_job_id, request_snapshot, uid),
                job_id=new_job_id,
                meta={
                    "estimated_render_seconds": capacity["estimated_render_seconds"],
                    "render_work_units": capacity["render_work_units"],
                    "render_class": capacity["render_class"],
                    "renderer": capacity["renderer"],
                },
                retry=host.RQRetry(max=3, interval=[10, 30, 60]) if host.RQRetry else None,
                result_ttl=24 * 3600,
                failure_ttl=7 * 24 * 3600,
            )
        except Exception as e:
            try:
                host._set_export_job(new_job_id, "failed", failed_at=host.time.time(), error=str(e))
            finally:
                host._release_export_slot(uid, new_job_id)
            raise HTTPException(status_code=503, detail="Export replay could not be queued") from e
        host._audit_action("export_replay_enqueued", uid, {"source_job_id": job_id, "new_job_id": new_job_id})
        return {"success": True, "export_job_id": new_job_id, "status": "queued"}


    return SimpleNamespace(
        router=router,
        _render_queue_for=_render_queue_for,
        _queue_for_export_job_record=_queue_for_export_job_record,
        _enqueue_export_job=_enqueue_export_job,
        _release_export_pending_work=_release_export_pending_work,
        export_video=export_video,
        create_export_batch=create_export_batch,
        get_export_batch=get_export_batch,
        _reconcile_export_job=_reconcile_export_job,
        _active_workers_for_queue=_active_workers_for_queue,
        _export_queue_prediction=_export_queue_prediction,
        export_status=export_status,
        export_result=export_result,
        export_cancel=export_cancel,
        export_replay=export_replay,
    )
