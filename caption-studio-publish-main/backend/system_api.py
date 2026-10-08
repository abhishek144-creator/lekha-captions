"""Health, version, readiness, feature-flag, service-status, analytics and support routes.

The factory accepts explicit configuration, adapters and shared state through
ServiceContext. It has no dependency on the HTTP entry point.
"""

from types import SimpleNamespace
from typing import Protocol

from fastapi import HTTPException, Response
from fastapi.responses import JSONResponse
from fastapi import Request
from fastapi import APIRouter


from typing import Any
from typing import Dict
import asyncio
import re
import shutil
import time
import uuid

class ServiceContext(Protocol):
    ANALYTICS_RATE_LIMIT: Any
    API_CURRENT_VERSION: Any
    API_MIN_SUPPORTED_VERSION: Any
    APP_RELEASE: Any
    DEPRECATION_SUNSET_DATE: Any
    DURABLE_QUEUE_ENABLED: Any
    ENABLE_PROGRESSIVE_DELIVERY: Any
    ENFORCE_TENANT_ISOLATION: Any
    EXPORT_QUEUE_NAME: Any
    GLOBAL_MAX_UPLOAD_DURATION_SECONDS: Any
    MAX_UPLOAD_DURATION_CONTROL_KEY: Any
    MEDIA_SCAN_QUEUE_NAME: Any
    MEDIA_SCRATCH_ROOT: Any
    RELEASE_METADATA: Any
    REQUIRE_PAYMENT_IDEMPOTENCY: Any
    RESERVED_SERVER_ANALYTICS_EVENTS: Any
    RQWorker: Any
    SERVICE_CONTROL_COLLECTION: Any
    SERVICE_CONTROL_DOCUMENT: Any
    SERVICE_CONTROL_KEYS: Any
    SERVICE_CONTROL_NOTICE_MAX: Any
    SUPPORT_RATE_LIMIT: Any
    ServiceControlsRequest: Any
    SupportRequest: Any
    TRANSCRIPTION_QUEUE_NAME: Any
    _IS_PRODUCTION: Any
    _analytics_rate: Any
    _apply_rate_headers: Any
    _audit_action: Any
    _build_slo_snapshot: Any
    _check_rate: Any
    _client_rate_key: Any
    _decoded_token_is_admin: Any
    _dependency_snapshot_cache: Any
    _dependency_snapshot_lock: Any
    _export_queue: Any
    _export_queues: Any
    _is_admin_token: Any
    _json_log: Any
    _media_scan_queue: Any
    _read_service_controls: Any
    _redis_client: Any
    _retention_deadline: Any
    _runtime_dependency_snapshot: Any
    _send_alert: Any
    _support_rate: Any
    _track_event: Any
    _transcription_queue: Any
    _utcnow: Any
    _validate_feature_flag_safety: Any
    api_version: Any
    get_db: Any
    storage_backend_ready: Any
    verify_token: Any


def create_system_router(context: ServiceContext) -> SimpleNamespace:
    router = APIRouter()

    @router.post("/api/analytics/track")
    async def analytics_track(request: Request, response: Response):
        # Unauthenticated telemetry endpoint: rate-limit per IP so it can't be used
        # as an unbounded Firestore write amplifier (cost/DoS), and reject reserved
        # server counter names so it can't poison the release gate / alerting.
        client_ip = context._client_rate_key(request)
        allowed, retry_after, remaining = await asyncio.to_thread(
            context._check_rate, context._analytics_rate, client_ip, context.ANALYTICS_RATE_LIMIT,
        )
        context._apply_rate_headers(response, context.ANALYTICS_RATE_LIMIT, remaining, retry_after)
        if not allowed:
            raise HTTPException(status_code=429, detail="Too many analytics events. Please slow down.")
        try:
            body = await request.json()
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid analytics payload")
        event = (body.get("event") or "").strip()
        if not event or len(event) > 80:
            raise HTTPException(status_code=400, detail="Invalid analytics event")
        if event in context.RESERVED_SERVER_ANALYTICS_EVENTS:
            raise HTTPException(status_code=400, detail="Reserved analytics event")
        payload = body.get("payload") or {}
        if not isinstance(payload, dict):
            raise HTTPException(status_code=400, detail="Invalid analytics payload")
        await asyncio.to_thread(context._track_event, event, payload)
        return {"success": True}


    @router.post("/api/support-request")
    def create_support_request(req: context.SupportRequest, request: Request, response: Response):
        client_ip = context._client_rate_key(request)
        allowed, retry_after, remaining = context._check_rate(
            context._support_rate,
            f"support:{client_ip}",
            context.SUPPORT_RATE_LIMIT,
        )
        context._apply_rate_headers(response, context.SUPPORT_RATE_LIMIT, remaining, retry_after)
        if not allowed:
            raise HTTPException(status_code=429, detail="Too many support requests. Please wait before trying again.")

        email = req.account_email.strip().lower()
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
            raise HTTPException(status_code=422, detail="Enter a valid account email address.")
        db = context.get_db()
        if not db:
            raise HTTPException(status_code=503, detail="Support intake is temporarily unavailable.")

        ticket_id = f"SUP-{context._utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:8].upper()}"
        received_at = context._utcnow().isoformat() + "Z"
        db.collection("support_requests").document(ticket_id).set({
            "ticket_id": ticket_id,
            "account_email": email,
            "issue_type": req.issue_type.strip(),
            "job_id": req.job_id.strip(),
            "payment_id": req.payment_id.strip(),
            "browser_device": req.browser_device.strip(),
            "media_details": req.media_details.strip(),
            "description": req.description.strip(),
            "status": "open",
            "received_at": received_at,
            "updated_at": received_at,
            "user_agent": (request.headers.get("user-agent") or "")[:500],
            "expire_at": context._retention_deadline(365),
        })
        context._track_event("support_request_created", {
            "ticket_id": ticket_id,
            "issue_type": req.issue_type.strip(),
        })
        context._send_alert(f"[Lekha Support] New {req.issue_type.strip()} ticket: {ticket_id}")
        return {"success": True, "ticket_id": ticket_id, "received_at": received_at}


    @router.get("/api/version")
    async def api_version():
        return {
            "success": True,
            "version": context.API_CURRENT_VERSION,
            **context.RELEASE_METADATA,
            "release": context.APP_RELEASE,
            "min_supported_version": context.API_MIN_SUPPORTED_VERSION,
            "sunset_date": context.DEPRECATION_SUNSET_DATE,
            "progressive_delivery_enabled": context.ENABLE_PROGRESSIVE_DELIVERY,
        }


    @router.get("/health")
    @router.get("/api/health")
    async def api_health():
        return {
            "success": True,
            "ready": True,
            "version": context.API_CURRENT_VERSION,
            **context.RELEASE_METADATA,
            "release": context.APP_RELEASE,
        }


    @router.get("/api/v1/version")
    async def api_version_v1():
        return await context.api_version()


    def _runtime_dependency_snapshot() -> Dict[str, Any]:
        now_ts = time.time()
        with context._dependency_snapshot_lock:
            cached = context._dependency_snapshot_cache.get("value")
            if cached and now_ts - float(context._dependency_snapshot_cache.get("checked_at", 0)) < 15:
                return cached

        checks: Dict[str, bool] = {
            "ffmpeg": shutil.which("ffmpeg") is not None,
            "ffprobe": shutil.which("ffprobe") is not None,
            # The API image does not render videos when the durable queue is enabled;
            # Chromium/Node live only in the render-worker image. Requiring Node on
            # the API would permanently fail load-balancer health checks after the
            # production images are split by role. Inline rendering still requires
            # Node when the durable queue is disabled.
            "node": context.DURABLE_QUEUE_ENABLED or shutil.which("node") is not None,
            "redis": context._redis_client is not None,
            "firestore": False,
            "storage": False,
            "scratch_disk": False,
        }
        details: Dict[str, Any] = {}
        if context._redis_client is not None:
            try:
                checks["redis"] = bool(context._redis_client.ping())
            except Exception:
                checks["redis"] = False
        try:
            db = context.get_db()
            if db:
                next(iter(db.collection("_readiness_probe").limit(1).stream()), None)
                checks["firestore"] = True
        except Exception as e:
            details["firestore_error"] = str(e)[:200]
        try:
            checks["storage"] = context.storage_backend_ready()
        except Exception as e:
            details["storage_error"] = str(e)[:200]
        if context.DURABLE_QUEUE_ENABLED and checks["redis"] and context.RQWorker is not None:
            try:
                workers = context.RQWorker.all(connection=context._redis_client)
                render_queue_names = list(context._export_queues) or [context.EXPORT_QUEUE_NAME]
                worker_counts = {
                    queue_name: 0
                    for queue_name in (*render_queue_names, context.TRANSCRIPTION_QUEUE_NAME, context.MEDIA_SCAN_QUEUE_NAME)
                }
                for worker in workers:
                    queue_names = getattr(worker, "queue_names", [])
                    if callable(queue_names):
                        queue_names = queue_names()
                    worker_release = context._redis_client.hget(worker.key, "app_release")
                    draining = context._redis_client.hget(worker.key, "draining")
                    if isinstance(worker_release, bytes):
                        worker_release = worker_release.decode("ascii")
                    if worker_release == context.APP_RELEASE and draining not in ("1", b"1"):
                        for queue_name in set(queue_names or []):
                            if queue_name in worker_counts:
                                worker_counts[queue_name] += 1
                details["worker_count"] = max(
                    (worker_counts[queue_name] for queue_name in render_queue_names),
                    default=0,
                )
                details["workers_by_queue"] = worker_counts
                render_queue_depths = {}
                for queue_name in render_queue_names:
                    queue = context._export_queues.get(queue_name)
                    if queue is None and queue_name == context.EXPORT_QUEUE_NAME:
                        queue = context._export_queue
                    render_queue_depths[queue_name] = int(queue.count) if queue is not None else 0
                queue_depths = {
                    **render_queue_depths,
                    context.TRANSCRIPTION_QUEUE_NAME: (
                        int(context._transcription_queue.count)
                        if context._transcription_queue is not None else 0
                    ),
                    context.MEDIA_SCAN_QUEUE_NAME: (
                        int(context._media_scan_queue.count)
                        if context._media_scan_queue is not None else 0
                    ),
                }
                details["queue_depths"] = queue_depths
                details["capacity_state"] = {
                    queue_name: (
                        "idle_scaled_to_zero"
                        if queue_depths[queue_name] == 0 and worker_counts[queue_name] == 0
                        else "available"
                        if worker_counts[queue_name] > 0
                        else "awaiting_autoscaler"
                    )
                    for queue_name in worker_counts
                }
            except Exception as e:
                details["worker_error"] = str(e)[:200]
        try:
            disk = shutil.disk_usage(context.MEDIA_SCRATCH_ROOT)
            details["scratch_free_bytes"] = disk.free
            checks["scratch_disk"] = disk.free >= 2 * 1024 * 1024 * 1024
        except Exception as e:
            details["scratch_disk_error"] = str(e)[:200]

        value = {"ready": all(checks.values()), "checks": checks, "details": details}
        with context._dependency_snapshot_lock:
            context._dependency_snapshot_cache.update({"checked_at": now_ts, "value": value})
        return value


    @router.get("/api/slo/status")
    def slo_status(request: Request):
        # Detailed SLO targets/actuals — admin only. Health probes should use
        # /api/health/readiness (boolean) instead.
        if not context._is_admin_token(request=request):
            raise HTTPException(status_code=403, detail="Admin access required")
        return context._build_slo_snapshot()


    @router.get("/ready")
    @router.get("/api/health/readiness")
    async def readiness(request: Request):
        # Public readiness probe: exposes only the boolean gate result. Detailed SLO
        # actuals and queue wiring are admin-gated (see /api/slo/status) so an
        # anonymous caller can't read operational internals.
        dependencies = await asyncio.to_thread(context._runtime_dependency_snapshot) if context._IS_PRODUCTION else {
            "ready": True,
            "checks": {},
            "details": {},
        }
        # Historical slow exports must not remove every healthy API replica from
        # service. SLOs remain release/alert signals; readiness reflects dependencies.
        ready = bool(dependencies.get("ready", False))
        body = {
            "success": True,
            "ready": ready,
        }
        if context._is_admin_token(request=request):
            body["slo"] = context._build_slo_snapshot()
            body["queue"] = {
                "durable_enabled": context.DURABLE_QUEUE_ENABLED,
                "queue_names": list(context._export_queues) or [context.EXPORT_QUEUE_NAME],
                "connected": context._export_queue is not None,
            }
            body["dependencies"] = dependencies
        if not ready:
            return JSONResponse(status_code=503, content=body)
        return body


    @router.get("/api/feature-flags")
    def feature_flags(request: Request):
        context._validate_feature_flag_safety("feature_flags")
        token = request.headers.get("authorization", "").replace("Bearer ", "").strip()
        decoded = context.verify_token(token) if token else None
        if not decoded:
            raise HTTPException(status_code=401, detail="Auth required")
        if not context._decoded_token_is_admin(decoded):
            raise HTTPException(status_code=403, detail="Admin role required")
        return {
            "success": True,
            "flags": {
                "enable_progressive_delivery": context.ENABLE_PROGRESSIVE_DELIVERY,
                "enforce_tenant_isolation": context.ENFORCE_TENANT_ISOLATION,
                "require_payment_idempotency": context.REQUIRE_PAYMENT_IDEMPOTENCY,
                "enable_durable_queue": context.DURABLE_QUEUE_ENABLED,
            },
        }


    @router.get("/api/service-status")
    def service_status():
        """Unauthenticated so the app can show an accurate banner while paused."""
        controls = context._read_service_controls()
        return {
            "success": True,
            "controls": {
                **{key: bool(controls.get(key)) for key in context.SERVICE_CONTROL_KEYS},
                context.MAX_UPLOAD_DURATION_CONTROL_KEY: int(controls.get(
                    context.MAX_UPLOAD_DURATION_CONTROL_KEY,
                    context.GLOBAL_MAX_UPLOAD_DURATION_SECONDS,
                )),
            },
            "notice": controls.get("notice") or "",
        }


    @router.post("/api/admin/service-controls")
    def admin_service_controls(req: context.ServiceControlsRequest, request: Request):
        decoded = context.verify_token(req.id_token) if req.id_token else None
        if not decoded and request is not None:
            header_token = request.headers.get("authorization", "").replace("Bearer ", "").strip()
            decoded = context.verify_token(header_token) if header_token else None
        if not context._decoded_token_is_admin(decoded):
            raise HTTPException(status_code=403, detail="Admin access required")

        updates: Dict[str, Any] = {}
        for key in context.SERVICE_CONTROL_KEYS:
            value = getattr(req, key, None)
            if value is not None:
                updates[key] = bool(value)
        if req.max_upload_duration_seconds is not None:
            updates[context.MAX_UPLOAD_DURATION_CONTROL_KEY] = max(
                15,
                min(context.GLOBAL_MAX_UPLOAD_DURATION_SECONDS, int(req.max_upload_duration_seconds)),
            )
        if req.notice is not None:
            updates["notice"] = str(req.notice)[:context.SERVICE_CONTROL_NOTICE_MAX]

        if not updates:
            controls = context._read_service_controls(force=True)
            return {"success": True, "changed": False, "controls": controls}

        db = context.get_db()
        if not db:
            raise HTTPException(status_code=503, detail="Database unavailable")
        updates["updated_at"] = context._utcnow().isoformat() + "Z"
        updates["updated_by"] = str((decoded or {}).get("uid") or "")[:128]
        try:
            db.collection(context.SERVICE_CONTROL_COLLECTION).document(context.SERVICE_CONTROL_DOCUMENT).set(
                updates, merge=True
            )
        except Exception as e:
            context._json_log("error", "service_controls_write_failed", error=str(e))
            raise HTTPException(status_code=503, detail="Service controls could not be saved") from e

        controls = context._read_service_controls(force=True)
        context._audit_action(
            "service_controls_updated",
            str((decoded or {}).get("uid") or ""),
            {
                key: updates[key]
                for key in updates
                if key in context.SERVICE_CONTROL_KEYS or key == context.MAX_UPLOAD_DURATION_CONTROL_KEY
            },
        )
        context._json_log("warning", "service_controls_updated", **{
            **{key: bool(controls.get(key)) for key in context.SERVICE_CONTROL_KEYS},
            context.MAX_UPLOAD_DURATION_CONTROL_KEY: int(controls.get(
                context.MAX_UPLOAD_DURATION_CONTROL_KEY,
                context.GLOBAL_MAX_UPLOAD_DURATION_SECONDS,
            )),
        })
        return {"success": True, "changed": True, "controls": controls}


    return SimpleNamespace(
        router=router,
        analytics_track=analytics_track,
        create_support_request=create_support_request,
        api_version=api_version,
        api_health=api_health,
        api_version_v1=api_version_v1,
        _runtime_dependency_snapshot=_runtime_dependency_snapshot,
        slo_status=slo_status,
        readiness=readiness,
        feature_flags=feature_flags,
        service_status=service_status,
        admin_service_controls=admin_service_controls,
    )
