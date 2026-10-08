"""Export job routes: submit, batch, status, result, cancel and replay.

The factory accepts explicit configuration, adapters and shared state through
ServiceContext. It has no dependency on the HTTP entry point.
"""

from types import SimpleNamespace
from typing import Protocol
import anyio

from fastapi import HTTPException, Response
from fastapi import Request
from fastapi import APIRouter


# RQ keeps each job's pickled arguments (the full editor snapshot) until these
# expire. Job status and results live in the export job record and the dead
# letter store, so long RQ retention only consumed Redis memory.
EXPORT_RQ_RESULT_TTL_SECONDS = 3600
EXPORT_RQ_FAILURE_TTL_SECONDS = 24 * 3600


from typing import Any
from typing import Dict
from typing import Optional
import asyncio
import hashlib
import json
import math
import threading
import time
import uuid

class ServiceContext(Protocol):
    BatchExportRequest: Any
    EXPORT_FAILURE_LIMIT: Any
    EXPORT_FAILURE_WINDOW: Any
    EXPORT_MAX_PENDING_JOBS: Any
    EXPORT_MAX_PENDING_WORK_SECONDS: Any
    EXPORT_MAX_QUEUE_WAIT_SECONDS: Any
    EXPORT_QUEUE_NAME: Any
    ExportRequest: Any
    InvalidJobTransition: Any
    Job: Any
    PENDING_WORK_LEDGER_KEY: Any
    RQRetry: Any
    RQWorker: Any
    _IS_PRODUCTION: Any
    _acquire_export_slot: Any
    _active_workers_for_queue: Any
    _assert_service_available: Any
    _assert_upload_clean: Any
    _assert_upload_owner: Any
    _audit_action: Any
    _authenticate_bearer_request: Any
    _authenticate_media_request: Any
    _enqueue_export_job: Any
    _export_queue: Any
    _export_queue_prediction: Any
    _export_queues: Any
    _get_recent_export_failures: Any
    _idem_claim: Any
    _idem_delete: Any
    _idem_get: Any
    _idem_set: Any
    _json_log: Any
    _load_export_job: Any
    _load_recorded_export_result: Any
    _log: Any
    _process_export_job_core: Any
    _queue_for_export_job_record: Any
    _reconcile_export_job: Any
    _record_export_failure: Any
    _refresh_completed_export_payload: Any
    _release_export_pending_work: Any
    _release_export_slot: Any
    _render_queue_for: Any
    _request_id: Any
    _require_export_job_access: Any
    _retention_deadline: Any
    _rq_redis_client: Any
    _sanitize_export_request_payload: Any
    _set_export_job: Any
    _source_duration_hint: Any
    _track_event: Any
    _write_dead_letter: Any
    enqueue_bounded_across_queues: Any
    estimate_render_capacity: Any
    get_db: Any
    job_queue_prediction: Any
    release_pending_work: Any
    run_export_job_task: Any
    worker_launcher: Any


def create_export_router(context: ServiceContext) -> SimpleNamespace:
    router = APIRouter()
    admission_limiter = None

    async def _run_admission(callback):
        nonlocal admission_limiter
        if admission_limiter is None:
            admission_limiter = anyio.CapacityLimiter(16)
        # Bound concurrent admissions while retaining PR #28's per-call I/O
        # offloading and background worker wake/resize behavior.
        async with admission_limiter:
            return await callback()

    def _render_queue_for(queue_name):
        queue = context._export_queues.get(queue_name)
        if queue is None and not context._IS_PRODUCTION:
            return context._export_queue
        if queue is None:
            raise HTTPException(503, "The selected render queue is unavailable.", headers={"Retry-After": "10"})
        return queue


    def _queue_for_export_job_record(job: Dict[str, Any]):
        queue_name = str((job or {}).get("queue_name") or context.EXPORT_QUEUE_NAME)
        return context._export_queues.get(queue_name) or context._export_queue


    def _enqueue_export_job(render_queue, **job):
        if context._IS_PRODUCTION:
            estimated_work_seconds = (job.get("meta") or {}).get("estimated_render_seconds")
            delivery = context.enqueue_bounded_across_queues(
                render_queue,
                list(context._export_queues.values()),
                context.EXPORT_MAX_PENDING_JOBS,
                max_pending_work_seconds=context.EXPORT_MAX_PENDING_WORK_SECONDS,
                estimated_work_seconds=estimated_work_seconds,
                **job,
            )
            # Waking or scaling workers can take seconds; never on the request path.
            context.worker_launcher.kick_in_background(render_queue.connection, render_queue.name)
            return delivery
        return render_queue.enqueue_call(**job)


    def _release_export_pending_work(job_id: str):
        if context._rq_redis_client is None:
            return
        try:
            context.release_pending_work(context._rq_redis_client, job_id)
        except Exception as error:
            context._json_log(
                "warning", "export_pending_work_release_failed",
                job_id=job_id, error=type(error).__name__,
            )


    @router.post("/api/export")
    async def export_video(req: context.ExportRequest, request: Request, response: Response):
        # Bound queued admission without creating a second event loop/thread
        # pool for the already offloaded blocking operations.
        if context._export_queue is not None or context._IS_PRODUCTION:
            return await _run_admission(
                lambda: _export_video_impl(req, request, response)
            )
        return await _export_video_impl(req, request, response)

    async def _export_video_impl(req, request, response):
        rid = context._request_id(request)
        # Firestore, Firebase Auth, Redis and worker-launch calls below are
        # blocking I/O. The API runs one event loop per process, so each runs in
        # a worker thread instead of stalling every other request.
        to_thread = asyncio.to_thread
        await to_thread(context._assert_service_available, "pause_exports")
        context._log(rid, f"Export requested file_id={req.file_id} quality={req.quality}")
        context._track_event("export_requested", {"quality": req.quality, "fps": req.fps})

        # 1. Authenticate user
        decoded_token = await to_thread(context._authenticate_media_request, req.id_token, req.org_id)
        uid = (decoded_token.get("uid") or "").strip() or "dev-local-user"
        if context._IS_PRODUCTION and context._export_queue is None:
            raise HTTPException(status_code=503, detail="Export service is temporarily unavailable. Please retry shortly.",
                                headers={"Retry-After": "10"})
        if decoded_token.get("_dev_mode"):
            context._log(rid, "Using explicit debug auth bypass token")

        now_ts = time.time()
        recent_failures = await to_thread(context._get_recent_export_failures, uid)
        if len(recent_failures) >= context.EXPORT_FAILURE_LIMIT:
            retry_after = max(1, int(context.EXPORT_FAILURE_WINDOW - (now_ts - min(recent_failures))))
            response.headers["Retry-After"] = str(retry_after)
            raise HTTPException(status_code=429, detail="Too many failed export attempts. Please retry after a short wait.")

        safe_request_snapshot = context._sanitize_export_request_payload(req.model_dump(by_alias=True))
        idempotency_request_hash = hashlib.sha256(
            json.dumps(safe_request_snapshot, sort_keys=True, default=str).encode("utf-8")
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
            cached = await to_thread(context._idem_get, idem_key)
            if cached and (time.time() - cached.get("ts", 0) < 6 * 3600):
                cached_request_hash = cached.get("request_hash", "")
                if cached_request_hash and cached_request_hash != idempotency_request_hash:
                    raise HTTPException(
                        status_code=409,
                        detail="This idempotency key was already used for a different export request.",
                    )
                if cached.get("status") == "completed" and cached.get("payload"):
                    context._log(rid, f"Idempotent replay for key={raw_idem[:16]}")
                    recovery_payload = await to_thread(
                        context._refresh_completed_export_payload,
                        cached["payload"], uid, str(cached.get("job_id") or ""),
                    )
                    return {**recovery_payload, "idempotent_replay": True}
                if cached.get("status") == "in_progress":
                    if cached.get("payload"):
                        return {**cached["payload"], "idempotent_replay": True}
                    raise HTTPException(status_code=409, detail="Export with this idempotency key is already in progress.")
            if not await to_thread(context._idem_claim, idem_key, {
                "status": "in_progress", "ts": time.time(),
                "request_hash": idempotency_request_hash,
            }):
                raise HTTPException(status_code=409, detail="Export with this idempotency key is already in progress.")

        # Per-user concurrent export guard.
        export_job_id = str(uuid.uuid4())
        if not await to_thread(context._acquire_export_slot, uid, export_job_id):
            if idem_key:
                await to_thread(context._idem_delete, idem_key)
            raise HTTPException(status_code=429, detail="Another export is already running for this account. Please wait.")

        release_export_slot_in_request = True
        try:
            duration_hint = await asyncio.to_thread(context._source_duration_hint, req.file_id, uid)
            capacity = context.estimate_render_capacity(duration_hint, safe_request_snapshot)
            await to_thread(
                context._set_export_job,
                export_job_id,
                "queued",
                uid=uid,
                file_id=req.file_id,
                quality=req.quality,
                started_at=time.time(),
                queue_entered_at=time.time(),
                idempotency_key=idem_key,
                idempotency_request_hash=idempotency_request_hash,
                estimated_render_seconds=capacity["estimated_render_seconds"],
                render_work_units=capacity["render_work_units"],
                render_class=capacity["render_class"],
                queue_name=capacity["queue_name"],
                request_snapshot=safe_request_snapshot,
            )
            if context._export_queue is not None:
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
                    await to_thread(context._idem_set, idem_key, {
                        "status": "in_progress",
                        "ts": time.time(),
                        "payload": queued_payload,
                        "request_hash": idempotency_request_hash,
                        "job_id": export_job_id,
                    })
                await to_thread(
                    context._enqueue_export_job,
                    context._render_queue_for(capacity["queue_name"]),
                    func="backend.main.run_export_job_task",
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
                    retry=context.RQRetry(max=3, interval=[10, 30, 60]) if context.RQRetry else None,
                    ttl=context.EXPORT_MAX_QUEUE_WAIT_SECONDS,
                    result_ttl=EXPORT_RQ_RESULT_TTL_SECONDS,
                    failure_ttl=EXPORT_RQ_FAILURE_TTL_SECONDS,
                )
                context._audit_action("export_enqueued", uid, {"job_id": export_job_id, "file_id": req.file_id})
                release_export_slot_in_request = False
                return queued_payload

            await to_thread(context._set_export_job, export_job_id, "starting")
            payload = await context._process_export_job_core(req, uid, rid, export_job_id)
            if idem_key:
                await to_thread(context._idem_set, idem_key, {
                    "status": "completed",
                    "ts": time.time(),
                    "payload": payload,
                    "request_hash": idempotency_request_hash,
                    "job_id": export_job_id,
                })
            return payload

        except HTTPException as http_ex:
            await to_thread(
                _record_failed_submission, export_job_id, uid, req.file_id, idem_key,
                str(http_ex.detail), safe_request_snapshot, "export_failed_http",
                {"detail": str(http_ex.detail)},
            )
            raise
        except Exception as e:
            await to_thread(
                _record_failed_submission, export_job_id, uid, req.file_id, idem_key,
                str(e), safe_request_snapshot, "export_failed_exception", {"error": str(e)},
            )
            raise HTTPException(status_code=500, detail=f"Export failed. Reference: {rid}")
        finally:
            if release_export_slot_in_request:
                await to_thread(context._release_export_slot, uid, export_job_id)


    def _record_failed_submission(export_job_id, uid, file_id, idem_key, error,
                                  safe_request_snapshot, event, event_payload):
        context._set_export_job(export_job_id, "failed", failed_at=time.time(), error=error)
        context._record_export_failure(uid)
        context._track_event(event, event_payload)
        context._write_dead_letter(
            export_job_id,
            error,
            {"uid": uid, "file_id": file_id, "req_payload": safe_request_snapshot},
        )
        if idem_key:
            context._idem_delete(idem_key)


    def _persist_batch_receipt(payload, uid, created_at):
        database = context.get_db()
        if database is None:
            if context._IS_PRODUCTION:
                raise HTTPException(503, "Batch status storage is temporarily unavailable", headers={"Retry-After": "10"})
            return
        try:
            database.collection("export_batches").document(payload["batch_id"]).set({
                "batch_id": payload["batch_id"],
                "uid": uid,
                "job_ids": [item["job_id"] for item in payload["accepted"]],
                "created_at": created_at,
                "expire_at": context._retention_deadline(30),
                "rejected": payload["rejected"],
            })
        except Exception as error:
            raise HTTPException(503, "Batch status storage is temporarily unavailable", headers={"Retry-After": "10"}) from error


    @router.post("/api/batch/exports", status_code=202)
    async def create_export_batch(req: context.BatchExportRequest, request: Request):
        return await _run_admission(lambda: _create_export_batch(req, request))

    async def _create_export_batch(req, request):
        """Queue up to ten independent exports with one idempotent request.

    Items use the normal tiered render queues and billing path. The worker's
    account slot serializes items for one customer, preventing a batch from
    bypassing the single-account concurrency and credit controls.
    """
        to_thread = asyncio.to_thread
        await to_thread(context._assert_service_available, "pause_exports")
        decoded = await to_thread(context._authenticate_media_request, req.id_token)
        uid = (decoded.get("uid") or "").strip()
        if context._export_queue is None:
            raise HTTPException(503, "Batch export service is temporarily unavailable", headers={"Retry-After": "10"})

        idem_key = f"batch:{uid}:{req.idempotency_key}"
        safe_snapshots = [context._sanitize_export_request_payload(item.model_dump(by_alias=True)) for item in req.exports]
        request_hash = hashlib.sha256(
            json.dumps(safe_snapshots, sort_keys=True, default=str).encode("utf-8")
        ).hexdigest()
        cached = await to_thread(context._idem_get, idem_key)
        if cached:
            if cached.get("request_hash") and cached["request_hash"] != request_hash:
                raise HTTPException(409, "This idempotency key was already used for a different export batch.")
            if cached.get("payload"):
                if not cached.get("batch_persisted"):
                    await to_thread(_persist_batch_receipt, cached["payload"], uid, cached.get("ts", time.time()))
                    await to_thread(context._idem_set, idem_key, {**cached, "batch_persisted": True})
                return {**cached["payload"], "idempotent_replay": True}
            raise HTTPException(409, "Export batch with this idempotency key is already in progress.", headers={"Retry-After": "2"})

        batch_id = str(uuid.uuid4())
        if not await to_thread(context._idem_claim, idem_key, {
            "status": "in_progress", "ts": time.time(),
            "request_hash": request_hash, "batch_id": batch_id,
        }):
            raise HTTPException(409, "Export batch with this idempotency key is already in progress.", headers={"Retry-After": "2"})
        accepted = []
        rejected = []
        for index, item in enumerate(req.exports):
            job_id = str(uuid.uuid4())
            enqueue_attempted = False
            try:
                await to_thread(context._assert_upload_owner, item.file_id, uid)
                await to_thread(context._assert_upload_clean, item.file_id)
                safe_snapshot = safe_snapshots[index]
                duration_hint = await to_thread(context._source_duration_hint, item.file_id, uid)
                capacity = context.estimate_render_capacity(duration_hint, safe_snapshot)
                await to_thread(
                    context._set_export_job,
                    job_id,
                    "queued",
                    uid=uid,
                    batch_id=batch_id,
                    batch_index=index,
                    file_id=item.file_id,
                    quality=item.quality,
                    started_at=time.time(),
                    queue_entered_at=time.time(),
                    estimated_render_seconds=capacity["estimated_render_seconds"],
                    render_work_units=capacity["render_work_units"],
                    render_class=capacity["render_class"],
                    queue_name=capacity["queue_name"],
                    request_snapshot=safe_snapshot,
                )
                enqueue_attempted = True
                await to_thread(
                    context._enqueue_export_job,
                    context._render_queue_for(capacity["queue_name"]),
                    func="backend.main.run_export_job_task",
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
                    retry=context.RQRetry(max=12, interval=[10, 15, 20, 30]) if context.RQRetry else None,
                    ttl=context.EXPORT_MAX_QUEUE_WAIT_SECONDS,
                    result_ttl=EXPORT_RQ_RESULT_TTL_SECONDS,
                    failure_ttl=EXPORT_RQ_FAILURE_TTL_SECONDS,
                )
                accepted.append({"index": index, "job_id": job_id, "file_id": item.file_id})
            except Exception as error:
                if enqueue_attempted and not isinstance(error, HTTPException):
                    # Redis can commit the enqueue and lose its reply. Preserve
                    # the original job/claim so a retry cannot queue and charge
                    # a second export; normal job recovery determines its state.
                    accepted.append({"index": index, "job_id": job_id, "file_id": item.file_id,
                                     "admission_uncertain": True})
                    continue
                try:
                    await to_thread(
                        context._set_export_job, job_id, "failed",
                        failed_at=time.time(), error="Batch item was not admitted",
                    )
                except Exception:
                    pass
                rejected.append({
                    "index": index,
                    "file_id": item.file_id,
                    "reason": error.detail if isinstance(error, HTTPException) else "Capacity unavailable",
                })

        if not accepted:
            await to_thread(context._idem_delete, idem_key)
            raise HTTPException(429, "No batch items could be admitted", headers={"Retry-After": "10"})
        payload = {
            "success": True,
            "batch_id": batch_id,
            "accepted": accepted,
            "rejected": rejected,
            "status_url": f"/api/batch/exports/{batch_id}",
        }
        receipt = {"status": "completed", "ts": time.time(), "payload": payload,
                   "request_hash": request_hash, "batch_id": batch_id, "batch_persisted": False}
        # Keep the original jobs replayable even if the Firestore receipt fails.
        await to_thread(context._idem_set, idem_key, receipt)
        await to_thread(_persist_batch_receipt, payload, uid, receipt["ts"])
        await to_thread(context._idem_set, idem_key, {**receipt, "batch_persisted": True})
        context._audit_action("export_batch_enqueued", uid, {"batch_id": batch_id, "count": len(accepted)})
        return payload


    @router.get("/api/batch/exports/{batch_id}")
    def get_export_batch(batch_id: str, request: Request):
        uid = context._authenticate_bearer_request(request)["uid"]
        database = context.get_db()
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
            job = context._load_export_job(str(job_id)) or {}
            if job:
                job = _reconcile_export_job(str(job_id), job)
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


    def _reconcile_export_job(job_id: str, job: Dict[str, Any]):
        if job.get("status") in {"failed", "retrying", "finalizing"}:
            try:
                recorded = context._load_recorded_export_result(
                    str(job.get("uid") or ""), job_id, str(job.get("file_id") or "")
                )
                if recorded:
                    # The usage transaction is authoritative even if the final
                    # Redis state write failed or all RQ retries were exhausted.
                    return {**job, "status": "completed", "payload": recorded, "error": None}
            except Exception as error:
                context._json_log("warning", "export_usage_recovery_unavailable", job_id=job_id,
                               error=type(error).__name__)
                # Do not present a final failure or permit a fresh debit while
                # the authoritative outcome of the usage transaction is unknown.
                return {**job, "status": "retrying", "error": None}
        if context._export_queue is None or job.get("status") in {"completed", "failed", "cancelled"}:
            return job
        try:
            job_queue = context._queue_for_export_job_record(job)
            status = str(job.get("status") or "").lower()
            queue_age = time.time() - float(
                job.get("queue_entered_at") or job.get("started_at") or time.time()
            )
            if status == "queued" and queue_age >= context.EXPORT_MAX_QUEUE_WAIT_SECONDS:
                job = context._set_export_job(
                    job_id,
                    "failed",
                    expected_status="queued",
                    error=(
                        f"Export could not start within "
                        f"{max(1, math.ceil(context.EXPORT_MAX_QUEUE_WAIT_SECONDS / 60))} minutes. "
                        "Please retry. No credit was charged."
                    ),
                    failure_code="preparation_timeout",
                    failed_at=time.time(),
                )
                if job.get("status") == "failed":
                    context._json_log(
                        "warning", "export_observation", job_id=job_id, status="failed",
                        queue_wait_ms=max(0, int(queue_age * 1000)),
                        failure_code="preparation_timeout",
                    )
                try:
                    stale_rq_job = job_queue.fetch_job(job_id) if job_queue else None
                    if stale_rq_job is not None:
                        stale_rq_job.cancel()
                except Exception as error:
                    context._json_log(
                        "warning",
                        "export_preparation_timeout_cleanup_failed",
                        job_id=job_id,
                        error=type(error).__name__,
                    )
                context._release_export_pending_work(job_id)
                context._release_export_slot(str(job.get("uid") or ""), job_id)
                context._idem_delete(str(job.get("idempotency_key") or ""))
                context._track_event("export_preparation_timeout", {"job_id": job_id})
                return job
            rq_job = job_queue.fetch_job(job_id) if job_queue else None
            state = rq_job.get_status(refresh=True) if rq_job else "missing"
            state = str(getattr(state, "value", state)).lower()
            age = time.time() - float(job.get("updated_at") or time.time())
            if state in {"failed", "stopped", "canceled", "cancelled", "finished"} or (state == "missing" and age > 120):
                job = context._set_export_job(job_id, "failed", error="Export was interrupted. Please retry.", failed_at=time.time())
                if job.get("status") == "failed":
                    context._json_log(
                        "warning", "export_observation", job_id=job_id, status="failed",
                        queue_wait_ms=job.get("queue_wait_ms"), failure_code="worker_interrupted",
                    )
                context._release_export_pending_work(job_id)
                context._release_export_slot(str(job.get("uid") or ""), job_id)
            elif state in {"scheduled", "deferred"} and job.get("status") in {"starting", "processing", "finalizing"}:
                job = context._set_export_job(job_id, "retrying", error="Export interrupted; retry scheduled.")
        except context.InvalidJobTransition:
            return context._load_export_job(job_id) or job
        except Exception as error:
            context._json_log("warning", "export_reconciliation_failed", job_id=job_id, error=type(error).__name__)
        return job


    # RQWorker.all() reads every registered worker. Status polls only need an
    # approximate count for the ETA, so it is shared for a few seconds.
    active_worker_cache = {}
    active_worker_cache_lock = threading.Lock()
    ACTIVE_WORKER_CACHE_SECONDS = 10

    def _active_workers_for_queue(queue_name: str) -> Optional[int]:
        if context.RQWorker is None or context._rq_redis_client is None:
            return None
        now = time.monotonic()
        with active_worker_cache_lock:
            cached = active_worker_cache.get(queue_name)
            if cached is not None and cached[0] > now:
                return cached[1]
        active = _count_active_workers(queue_name)
        if active is not None:
            with active_worker_cache_lock:
                active_worker_cache[queue_name] = (now + ACTIVE_WORKER_CACHE_SECONDS, active)
        return active


    def _count_active_workers(queue_name: str) -> Optional[int]:
        try:
            active = 0
            for worker in context.RQWorker.all(connection=context._rq_redis_client):
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


    def _export_queue_prediction(job_id: str, job: Dict[str, Any]) -> Dict[str, Any]:
        if str(job.get("status") or "").lower() != "queued" or context.Job is None:
            return {}
        queue_name = str(job.get("queue_name") or context.EXPORT_QUEUE_NAME)
        queue = context._export_queues.get(queue_name)
        if queue is None:
            return {}
        try:
            active_workers = context._active_workers_for_queue(queue_name)
            return context.job_queue_prediction(
                queue,
                context.Job,
                job_id,
                active_workers=active_workers,
                work_ledger_key=context.PENDING_WORK_LEDGER_KEY,
            ) or {}
        except Exception as error:
            context._json_log(
                "warning", "export_queue_prediction_failed",
                job_id=job_id, error=type(error).__name__,
            )
            return {}


    @router.get("/api/export-status/{job_id}")
    def export_status(job_id: str, request: Request):
        job = context._load_export_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Export job not found")
        context._require_export_job_access(request, job)
        job = context._reconcile_export_job(job_id, job)
        if job.get("status") == "queued":
            # Safety net for on-demand workers: a queued job whose worker crashed
            # gets a fresh one on a later poll (no-op when launching is disabled).
            # Throttled across replicas and run off the request thread, because
            # every queued customer polls this endpoint.
            record_queue = context._queue_for_export_job_record(job)
            if record_queue is not None:
                context.worker_launcher.kick_throttled(record_queue.connection, record_queue.name)
        queue_prediction = context._export_queue_prediction(job_id, job)
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
        job = context._load_export_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Export job not found")
        context._require_export_job_access(request, job)
        job = context._reconcile_export_job(job_id, job)
        if job.get("status") != "completed":
            return {"success": False, "status": job.get("status", "unknown"), "error": "Export failed. Please retry or contact support." if job.get("error") else None}
        payload = job.get("payload") or {}
        if not payload:
            return {"success": False, "status": "completed", "error": "Result payload missing"}
        if request.query_params.get("download_filename"):
            payload = {**payload, "download_filename": request.query_params["download_filename"]}
        return context._refresh_completed_export_payload(payload, str(job.get("uid") or ""), job_id)


    @router.post("/api/export-cancel/{job_id}")
    def export_cancel(job_id: str, request: Request):
        job = context._load_export_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Export job not found")
        context._require_export_job_access(request, job)

        status = (job.get("status") or "unknown").lower()
        if status == "cancelled":
            idempotency_key = str(job.get("idempotency_key") or "")
            if idempotency_key:
                context._idem_delete(idempotency_key)
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
        if context._export_queue is None:
            raise HTTPException(status_code=503, detail="Durable queue is not configured")

        uid = str(job.get("uid") or "")
        try:
            context._set_export_job(job_id, "cancelled", cancelled_at=time.time(),
                            cancellation_reason="user_requested", error=None)
        except context.InvalidJobTransition as error:
            raise HTTPException(status_code=409, detail="This export has already started.") from error
        # A cancelled queue receipt must not pin the exact same editor state to a
        # terminal job for six hours. Clearing it lets the customer intentionally
        # submit the unchanged export again while the durable job record remains
        # available for audit and status history.
        idempotency_key = str(job.get("idempotency_key") or "")
        if idempotency_key:
            context._idem_delete(idempotency_key)
        context._release_export_pending_work(job_id)
        # Cancellation is durable first. If queue removal fails, a dequeued worker
        # observes CANCELLED and exits before rendering or charging.
        try:
            job_queue = context._queue_for_export_job_record(job)
            rq_job = job_queue.fetch_job(job_id) if job_queue else None
            if rq_job is not None:
                rq_job.cancel()
        except Exception as error:
            context._json_log("warning", "cancel_queue_cleanup_failed", job_id=job_id, error=type(error).__name__)
        context._release_export_slot(uid, job_id)
        context._track_event("export_cancelled", {"job_id": job_id})
        context._audit_action("export_cancelled", uid, {"job_id": job_id})
        return {
            "success": True,
            "status": "cancelled",
            "export_job_id": job_id,
            "credit_released": False,
            "retry_allowed": True,
        }


    @router.post("/api/export-replay/{job_id}")
    def export_replay(job_id: str, request: Request):
        context._assert_service_available("pause_exports")
        if context._export_queue is None:
            raise HTTPException(status_code=503, detail="Durable queue is not configured")
        db = context.get_db()
        if not db:
            raise HTTPException(status_code=503, detail="Database unavailable")
        snap = db.collection("export_jobs").document(job_id).get()
        if not snap.exists:
            raise HTTPException(status_code=404, detail="Export job not found")
        job = snap.to_dict() or {}
        context._require_export_job_access(request, job)
        if (job.get("status") or "").lower() != "failed":
            raise HTTPException(
                status_code=409,
                detail="Only failed export jobs can be replayed.",
            )
        request_snapshot = job.get("request_snapshot")
        uid = job.get("uid", "")
        recorded = context._load_recorded_export_result(uid, job_id, str(job.get("file_id") or ""))
        if recorded:
            return {"success": True, "export_job_id": job_id, "status": "completed", "idempotent_replay": True}
        if not request_snapshot:
            raise HTTPException(status_code=400, detail="No request snapshot found to replay")
        new_job_id = str(uuid.uuid4())
        if not context._acquire_export_slot(uid, new_job_id):
            raise HTTPException(
                status_code=429,
                detail="Another export is already running for this account. Please wait.",
            )
        try:
            duration_hint = context._source_duration_hint(str(request_snapshot.get("file_id") or ""), uid)
            capacity = context.estimate_render_capacity(duration_hint, request_snapshot)
            context._set_export_job(
                new_job_id,
                "queued",
                uid=uid,
                file_id=request_snapshot.get("file_id"),
                started_at=time.time(),
                queue_entered_at=time.time(),
                request_snapshot=request_snapshot,
                replayed_from=job_id,
                estimated_render_seconds=capacity["estimated_render_seconds"],
                render_work_units=capacity["render_work_units"],
                render_class=capacity["render_class"],
                queue_name=capacity["queue_name"],
            )
            context._enqueue_export_job(
                context._render_queue_for(capacity["queue_name"]),
                func="backend.main.run_export_job_task",
                args=(new_job_id, request_snapshot, uid),
                job_id=new_job_id,
                meta={
                    "estimated_render_seconds": capacity["estimated_render_seconds"],
                    "render_work_units": capacity["render_work_units"],
                    "render_class": capacity["render_class"],
                    "renderer": capacity["renderer"],
                },
                retry=context.RQRetry(max=3, interval=[10, 30, 60]) if context.RQRetry else None,
                ttl=context.EXPORT_MAX_QUEUE_WAIT_SECONDS,
                result_ttl=EXPORT_RQ_RESULT_TTL_SECONDS,
                failure_ttl=EXPORT_RQ_FAILURE_TTL_SECONDS,
            )
        except Exception as e:
            try:
                context._set_export_job(new_job_id, "failed", failed_at=time.time(), error=str(e))
            finally:
                context._release_export_slot(uid, new_job_id)
            raise HTTPException(status_code=503, detail="Export replay could not be queued") from e
        context._audit_action("export_replay_enqueued", uid, {"source_job_id": job_id, "new_job_id": new_job_id})
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
