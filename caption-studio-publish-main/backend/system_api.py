"""Health, version, readiness, feature-flag, service-status, analytics and support routes.

Handlers resolve shared helpers through ``host`` (the main module) at call time,
so there is one copy of each helper and test patches on ``main`` keep applying.
"""

from types import ModuleType, SimpleNamespace

from fastapi import FastAPI, UploadFile, File, HTTPException, Response
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Request
from fastapi import APIRouter


def create_system_router(host: ModuleType) -> SimpleNamespace:
    router = APIRouter()

    @router.post("/api/analytics/track")
    async def analytics_track(request: Request, response: Response):
        # Unauthenticated telemetry endpoint: rate-limit per IP so it can't be used
        # as an unbounded Firestore write amplifier (cost/DoS), and reject reserved
        # server counter names so it can't poison the release gate / alerting.
        client_ip = host._client_rate_key(request)
        allowed, retry_after, remaining = await host.asyncio.to_thread(
            host._check_rate, host._analytics_rate, client_ip, host.ANALYTICS_RATE_LIMIT,
        )
        host._apply_rate_headers(response, host.ANALYTICS_RATE_LIMIT, remaining, retry_after)
        if not allowed:
            raise HTTPException(status_code=429, detail="Too many analytics events. Please slow down.")
        try:
            body = await request.json()
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid analytics payload")
        event = (body.get("event") or "").strip()
        if not event or len(event) > 80:
            raise HTTPException(status_code=400, detail="Invalid analytics event")
        if event in host.RESERVED_SERVER_ANALYTICS_EVENTS:
            raise HTTPException(status_code=400, detail="Reserved analytics event")
        payload = body.get("payload") or {}
        if not isinstance(payload, dict):
            raise HTTPException(status_code=400, detail="Invalid analytics payload")
        await host.asyncio.to_thread(host._track_event, event, payload)
        return {"success": True}


    @router.post("/api/support-request")
    def create_support_request(req: host.SupportRequest, request: Request, response: Response):
        client_ip = host._client_rate_key(request)
        allowed, retry_after, remaining = host._check_rate(
            host._support_rate,
            f"support:{client_ip}",
            host.SUPPORT_RATE_LIMIT,
        )
        host._apply_rate_headers(response, host.SUPPORT_RATE_LIMIT, remaining, retry_after)
        if not allowed:
            raise HTTPException(status_code=429, detail="Too many support requests. Please wait before trying again.")

        email = req.account_email.strip().lower()
        if not host.re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
            raise HTTPException(status_code=422, detail="Enter a valid account email address.")
        db = host.get_db()
        if not db:
            raise HTTPException(status_code=503, detail="Support intake is temporarily unavailable.")

        ticket_id = f"SUP-{host._utcnow().strftime('%Y%m%d')}-{host.uuid.uuid4().hex[:8].upper()}"
        received_at = host._utcnow().isoformat() + "Z"
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
            "expire_at": host._retention_deadline(365),
        })
        host._track_event("support_request_created", {
            "ticket_id": ticket_id,
            "issue_type": req.issue_type.strip(),
        })
        host._send_alert(f"[Lekha Support] New {req.issue_type.strip()} ticket: {ticket_id}")
        return {"success": True, "ticket_id": ticket_id, "received_at": received_at}


    @router.get("/api/version")
    async def api_version():
        return {
            "success": True,
            "version": host.API_CURRENT_VERSION,
            **host.RELEASE_METADATA,
            "release": host.APP_RELEASE,
            "min_supported_version": host.API_MIN_SUPPORTED_VERSION,
            "sunset_date": host.DEPRECATION_SUNSET_DATE,
            "progressive_delivery_enabled": host.ENABLE_PROGRESSIVE_DELIVERY,
        }


    @router.get("/health")
    @router.get("/api/health")
    async def api_health():
        return {
            "success": True,
            "ready": True,
            "version": host.API_CURRENT_VERSION,
            **host.RELEASE_METADATA,
            "release": host.APP_RELEASE,
        }


    @router.get("/api/v1/version")
    async def api_version_v1():
        return await host.api_version()


    def _runtime_dependency_snapshot() -> host.Dict[str, host.Any]:
        now_ts = host.time.time()
        with host._dependency_snapshot_lock:
            cached = host._dependency_snapshot_cache.get("value")
            if cached and now_ts - float(host._dependency_snapshot_cache.get("checked_at", 0)) < 15:
                return cached

        checks: host.Dict[str, bool] = {
            "ffmpeg": host.shutil.which("ffmpeg") is not None,
            "ffprobe": host.shutil.which("ffprobe") is not None,
            # The API image does not render videos when the durable queue is enabled;
            # Chromium/Node live only in the render-worker image. Requiring Node on
            # the API would permanently fail load-balancer health checks after the
            # production images are split by role. Inline rendering still requires
            # Node when the durable queue is disabled.
            "node": host.DURABLE_QUEUE_ENABLED or host.shutil.which("node") is not None,
            "redis": host._redis_client is not None,
            "firestore": False,
            "storage": False,
            "scratch_disk": False,
        }
        details: host.Dict[str, host.Any] = {}
        if host._redis_client is not None:
            try:
                checks["redis"] = bool(host._redis_client.ping())
            except Exception:
                checks["redis"] = False
        try:
            db = host.get_db()
            if db:
                next(iter(db.collection("_readiness_probe").limit(1).stream()), None)
                checks["firestore"] = True
        except Exception as e:
            details["firestore_error"] = str(e)[:200]
        try:
            checks["storage"] = host.storage_backend_ready()
        except Exception as e:
            details["storage_error"] = str(e)[:200]
        if host.DURABLE_QUEUE_ENABLED and checks["redis"] and host.RQWorker is not None:
            try:
                workers = host.RQWorker.all(connection=host._redis_client)
                render_queue_names = list(host._export_queues) or [host.EXPORT_QUEUE_NAME]
                worker_counts = {
                    queue_name: 0
                    for queue_name in (*render_queue_names, host.TRANSCRIPTION_QUEUE_NAME, host.MEDIA_SCAN_QUEUE_NAME)
                }
                for worker in workers:
                    queue_names = getattr(worker, "queue_names", [])
                    if callable(queue_names):
                        queue_names = queue_names()
                    worker_release = host._redis_client.hget(worker.key, "app_release")
                    draining = host._redis_client.hget(worker.key, "draining")
                    if isinstance(worker_release, bytes):
                        worker_release = worker_release.decode("ascii")
                    if worker_release == host.APP_RELEASE and draining not in ("1", b"1"):
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
                    queue = host._export_queues.get(queue_name)
                    if queue is None and queue_name == host.EXPORT_QUEUE_NAME:
                        queue = host._export_queue
                    render_queue_depths[queue_name] = int(queue.count) if queue is not None else 0
                queue_depths = {
                    **render_queue_depths,
                    host.TRANSCRIPTION_QUEUE_NAME: (
                        int(host._transcription_queue.count)
                        if host._transcription_queue is not None else 0
                    ),
                    host.MEDIA_SCAN_QUEUE_NAME: (
                        int(host._media_scan_queue.count)
                        if host._media_scan_queue is not None else 0
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
            disk = host.shutil.disk_usage(host.MEDIA_SCRATCH_ROOT)
            details["scratch_free_bytes"] = disk.free
            checks["scratch_disk"] = disk.free >= 2 * 1024 * 1024 * 1024
        except Exception as e:
            details["scratch_disk_error"] = str(e)[:200]

        value = {"ready": all(checks.values()), "checks": checks, "details": details}
        with host._dependency_snapshot_lock:
            host._dependency_snapshot_cache.update({"checked_at": now_ts, "value": value})
        return value


    @router.get("/api/slo/status")
    def slo_status(request: Request):
        # Detailed SLO targets/actuals — admin only. Health probes should use
        # /api/health/readiness (boolean) instead.
        if not host._is_admin_token(request=request):
            raise HTTPException(status_code=403, detail="Admin access required")
        return host._build_slo_snapshot()


    @router.get("/ready")
    @router.get("/api/health/readiness")
    async def readiness(request: Request):
        # Public readiness probe: exposes only the boolean gate result. Detailed SLO
        # actuals and queue wiring are admin-gated (see /api/slo/status) so an
        # anonymous caller can't read operational internals.
        dependencies = await host.asyncio.to_thread(host._runtime_dependency_snapshot) if host._IS_PRODUCTION else {
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
        if host._is_admin_token(request=request):
            body["slo"] = host._build_slo_snapshot()
            body["queue"] = {
                "durable_enabled": host.DURABLE_QUEUE_ENABLED,
                "queue_names": list(host._export_queues) or [host.EXPORT_QUEUE_NAME],
                "connected": host._export_queue is not None,
            }
            body["dependencies"] = dependencies
        if not ready:
            return JSONResponse(status_code=503, content=body)
        return body


    @router.get("/api/feature-flags")
    def feature_flags(request: Request):
        host._validate_feature_flag_safety("feature_flags")
        token = request.headers.get("authorization", "").replace("Bearer ", "").strip()
        decoded = host.verify_token(token) if token else None
        if not decoded:
            raise HTTPException(status_code=401, detail="Auth required")
        if not host._decoded_token_is_admin(decoded):
            raise HTTPException(status_code=403, detail="Admin role required")
        return {
            "success": True,
            "flags": {
                "enable_progressive_delivery": host.ENABLE_PROGRESSIVE_DELIVERY,
                "enforce_tenant_isolation": host.ENFORCE_TENANT_ISOLATION,
                "require_payment_idempotency": host.REQUIRE_PAYMENT_IDEMPOTENCY,
                "enable_durable_queue": host.DURABLE_QUEUE_ENABLED,
            },
        }


    @router.get("/api/service-status")
    def service_status():
        """Unauthenticated so the app can show an accurate banner while paused."""
        controls = host._read_service_controls()
        return {
            "success": True,
            "controls": {
                **{key: bool(controls.get(key)) for key in host.SERVICE_CONTROL_KEYS},
                host.MAX_UPLOAD_DURATION_CONTROL_KEY: int(controls.get(
                    host.MAX_UPLOAD_DURATION_CONTROL_KEY,
                    host.GLOBAL_MAX_UPLOAD_DURATION_SECONDS,
                )),
            },
            "notice": controls.get("notice") or "",
        }


    @router.post("/api/admin/service-controls")
    def admin_service_controls(req: host.ServiceControlsRequest, request: Request):
        decoded = host.verify_token(req.id_token) if req.id_token else None
        if not decoded and request is not None:
            header_token = request.headers.get("authorization", "").replace("Bearer ", "").strip()
            decoded = host.verify_token(header_token) if header_token else None
        if not host._decoded_token_is_admin(decoded):
            raise HTTPException(status_code=403, detail="Admin access required")

        updates: host.Dict[str, host.Any] = {}
        for key in host.SERVICE_CONTROL_KEYS:
            value = getattr(req, key, None)
            if value is not None:
                updates[key] = bool(value)
        if req.max_upload_duration_seconds is not None:
            updates[host.MAX_UPLOAD_DURATION_CONTROL_KEY] = max(
                15,
                min(host.GLOBAL_MAX_UPLOAD_DURATION_SECONDS, int(req.max_upload_duration_seconds)),
            )
        if req.notice is not None:
            updates["notice"] = str(req.notice)[:host.SERVICE_CONTROL_NOTICE_MAX]

        if not updates:
            controls = host._read_service_controls(force=True)
            return {"success": True, "changed": False, "controls": controls}

        db = host.get_db()
        if not db:
            raise HTTPException(status_code=503, detail="Database unavailable")
        updates["updated_at"] = host._utcnow().isoformat() + "Z"
        updates["updated_by"] = str((decoded or {}).get("uid") or "")[:128]
        try:
            db.collection(host.SERVICE_CONTROL_COLLECTION).document(host.SERVICE_CONTROL_DOCUMENT).set(
                updates, merge=True
            )
        except Exception as e:
            host._json_log("error", "service_controls_write_failed", error=str(e))
            raise HTTPException(status_code=503, detail="Service controls could not be saved") from e

        controls = host._read_service_controls(force=True)
        host._audit_action(
            "service_controls_updated",
            str((decoded or {}).get("uid") or ""),
            {
                key: updates[key]
                for key in updates
                if key in host.SERVICE_CONTROL_KEYS or key == host.MAX_UPLOAD_DURATION_CONTROL_KEY
            },
        )
        host._json_log("warning", "service_controls_updated", **{
            **{key: bool(controls.get(key)) for key in host.SERVICE_CONTROL_KEYS},
            host.MAX_UPLOAD_DURATION_CONTROL_KEY: int(controls.get(
                host.MAX_UPLOAD_DURATION_CONTROL_KEY,
                host.GLOBAL_MAX_UPLOAD_DURATION_SECONDS,
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
