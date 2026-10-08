"""Compose the API from settings, adapters and independently usable services."""
import os
import sys
from dataclasses import asdict
try:
    from .environment import load_environment
    from .backend_context import BackendContext
    from .runtime_settings import load_runtime_settings
    from .application_lifecycle import create_lifecycle
    from .worker_tasks import create_worker_tasks
except ImportError:
    from environment import load_environment
    from backend_context import BackendContext
    from runtime_settings import load_runtime_settings
    from application_lifecycle import create_lifecycle
    from worker_tasks import create_worker_tasks

backend_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.dirname(backend_dir)
load_environment(root_dir)
try:
    from . import application_dependencies as adapters
except ImportError:
    import application_dependencies as adapters

def create_backend():
    """Return an application context with its own mutable state and services."""
    settings = load_runtime_settings(root_dir)
    context = BackendContext(**asdict(settings))
    context.root_dir = root_dir
    context.backend_dir = backend_dir
    context.__dict__.update(adapters.dependencies())

    context.bind(create_lifecycle(context))

    context.app = context.FastAPI(lifespan=context.app_lifespan)

    context.app.add_middleware(
        context.RailwayIdleConnectionsMiddleware,
        clients=lambda: (context._redis_client, context._rq_redis_client),
    )

    context._observability = context.bind(context.create_observability(context))

    context.logging.basicConfig(level=context.os.environ.get("LOG_LEVEL", "INFO"))

    context._logger = context.logging.getLogger("caption_studio_backend")

    @context.app.middleware("http")
    async def request_logging_middleware(request: context.Request, call_next):
        rid = context._request_id(request)
        request.state.request_id = rid
        if context._app_check_required(request) and request.headers.get("x-firebase-appcheck"):
            # Firebase may synchronously fetch rotated signing keys. Keep its
            # bounded verification work outside the API event loop; health probes
            # and missing-token rejections never wait for this worker pool.
            app_check_failure = await context.anyio.to_thread.run_sync(
                context._verify_firebase_app_check_request, request, rid,
                limiter=context._app_check_verification_limiter,
            )
        else:
            app_check_failure = context._verify_firebase_app_check_request(request, rid)
        if app_check_failure is not None:
            return context._apply_security_headers(app_check_failure)
        if request.url.path == "/api/upload" and context._IS_PRODUCTION:
            # Reject before FastAPI parses multipart, so a misconfigured production
            # client cannot stream even a small video through an API instance.
            return context._apply_security_headers(context.JSONResponse(
                status_code=409,
                content={"detail": "Production uploads must use the direct resumable storage flow."},
                headers={"X-Request-Id": rid, "X-Lekha-Upload-Transport": "direct-resumable"},
            ))
        if request.url.path == "/api/upload":
            # FastAPI parses multipart before entering the endpoint. Authenticate
            # here so an unauthenticated request never spools customer-sized media.
            try:
                upload_identity = await context.asyncio.to_thread(context._authenticate_media_request, context._extract_bearer_token(request))
            except context.HTTPException as error:
                return context._apply_security_headers(context.JSONResponse(status_code=error.status_code,
                    content={"detail": error.detail}, headers={"X-Request-Id": rid}))
        content_type = (request.headers.get("content-type") or "").lower()
        declared_length = request.headers.get("content-length")
        if "application/json" in content_type and declared_length:
            try:
                if int(declared_length) > context.MAX_JSON_BODY_BYTES:
                    return context._apply_security_headers(context.JSONResponse(
                        status_code=413,
                        content={"success": False, "error": "Request body is too large"},
                        headers={"X-Request-Id": rid},
                    ))
            except ValueError:
                return context._apply_security_headers(context.JSONResponse(
                    status_code=400,
                    content={"success": False, "error": "Invalid Content-Length header"},
                    headers={"X-Request-Id": rid},
                ))
        if "application/json" in content_type:
            body = bytearray()
            async for chunk in request.stream():
                body.extend(chunk)
                if len(body) > context.MAX_JSON_BODY_BYTES:
                    return context._apply_security_headers(context.JSONResponse(
                        status_code=413,
                        content={"success": False, "error": "Request body is too large"},
                        headers={"X-Request-Id": rid},
                    ))
            # Starlette's downstream receive wrapper replays this cached body. This
            # enforces the limit even for chunked requests with no Content-Length.
            request._body = bytes(body)
        requested_version = (request.headers.get("x-api-version") or "").strip()
        if requested_version and requested_version < context.API_MIN_SUPPORTED_VERSION:
            return context._apply_security_headers(context.JSONResponse(
                status_code=426,
                content={
                    "success": False,
                    "error": "API version is no longer supported",
                    "min_supported_version": context.API_MIN_SUPPORTED_VERSION,
                    "current_version": context.API_CURRENT_VERSION,
                    "sunset_date": context.DEPRECATION_SUNSET_DATE,
                },
                headers={
                    "X-Request-Id": rid,
                    "X-API-Version": context.API_CURRENT_VERSION,
                    "X-API-Min-Version": context.API_MIN_SUPPORTED_VERSION,
                    "Sunset": context.DEPRECATION_SUNSET_DATE,
                },
            ))
        upload_slot_uid = str(upload_identity.get("uid") or "") if request.url.path == "/api/upload" else ""
        if upload_slot_uid and not await context.asyncio.to_thread(context._acquire_process_slot, upload_slot_uid, f"upload:{rid}"):
            return context._apply_security_headers(context.JSONResponse(status_code=429, content={"detail": "Another upload or transcription is active for this account."}, headers={"X-Request-Id": rid}))
        start = context.time.time()
        try:
            response = await call_next(request)
        except Exception as e:
            elapsed_ms = int((context.time.time() - start) * 1000)
            context._json_log(
                "error",
                "http_request",
                request_id=rid,
                method=request.method,
                path=request.url.path,
                status_code=500,
                duration_ms=elapsed_ms,
                replica_region=context.RAILWAY_REPLICA_REGION,
                replica_id=context.RAILWAY_REPLICA_ID,
                error=str(e),
            )
            return context._apply_security_headers(context.JSONResponse(status_code=500, content={
                "success": False, "error": {"code": "INTERNAL_ERROR",
                "message": "Something went wrong. Please contact support with this request ID.", "request_id": rid},
            }, headers={"X-Request-Id": rid, "Cache-Control": "no-store"}))
        finally:
            if upload_slot_uid:
                await context.asyncio.to_thread(context._release_process_slot, upload_slot_uid, f"upload:{rid}")
            if not context.RUN_API_BACKGROUND_TASKS:
                # Cloud Run may suspend CPU as soon as the request finishes. Flush
                # buffered events while this request still has execution time.
                with context._telemetry_lock:
                    telemetry_pending = bool(context._telemetry_buffer)
                if telemetry_pending:
                    try:
                        await context.asyncio.to_thread(context._flush_telemetry)
                    except Exception as error:
                        context._json_log("warning", "request_telemetry_flush_failed", error=type(error).__name__)
        elapsed_ms = int((context.time.time() - start) * 1000)
        response.headers["X-Request-Id"] = rid
        context._json_log(
            "info",
            "http_request",
            request_id=rid,
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            duration_ms=elapsed_ms,
            replica_region=context.RAILWAY_REPLICA_REGION,
            replica_id=context.RAILWAY_REPLICA_ID,
        )
        try:
            await context.asyncio.to_thread(context._track_latency_sample, request.url.path, elapsed_ms)
        except Exception:
            pass
        response.headers["X-API-Version"] = context.API_CURRENT_VERSION
        response.headers["X-API-Min-Version"] = context.API_MIN_SUPPORTED_VERSION
        response.headers["Sunset"] = context.DEPRECATION_SUNSET_DATE
        return context._apply_security_headers(response)
    context.request_logging_middleware = request_logging_middleware

    context._app_check_verification_limiter = context.anyio.CapacityLimiter(16)

    if context.SENTRY_DSN and context.SENTRY_AVAILABLE and not context._IS_TEST:
        try:
            context.sentry_sdk.init(
                dsn=context.SENTRY_DSN,
                environment=context.APP_ENV,
                release=context.os.environ.get("APP_RELEASE") or None,
                traces_sample_rate=float(context.os.environ.get("SENTRY_TRACES_SAMPLE_RATE", "0.05")),
                send_default_pii=False,
            )
            context._json_log("info", "sentry_initialized", environment=context.APP_ENV)
        except Exception as e:
            context._json_log("warning", "sentry_init_failed", error=str(e))
    elif context.SENTRY_DSN and not context.SENTRY_AVAILABLE:
        if context._IS_PRODUCTION:
            raise RuntimeError("SENTRY_DSN is configured but the Sentry SDK is unavailable in production.")
        context._json_log("warning", "sentry_dsn_set_but_sdk_missing")

    context._json_log(
        "warning" if not context._IS_PRODUCTION else "info",
        "runtime_mode",
        env=context.APP_ENV,
        is_production=context._IS_PRODUCTION,
    )

    if not context.MEDIA_URL_SIGNING_SECRET:
        context.MEDIA_URL_SIGNING_SECRET = context.secrets.token_urlsafe(48)

    context.rzp_client = None

    if context.RAZORPAY_AVAILABLE and context.RAZORPAY_KEY_ID and context.RAZORPAY_KEY_SECRET:
        context.rzp_client = context._razorpay_module.Client(auth=(context.RAZORPAY_KEY_ID, context.RAZORPAY_KEY_SECRET))
    elif context.RAZORPAY_AVAILABLE:
        context._json_log("warning", "razorpay_credentials_missing")

    context.render_semaphore = context.asyncio.Semaphore(context.MAX_CONCURRENT_RENDERS)

    class _BoundedJobCache(context.OrderedDict):
        """Process-local job cache that evicts the oldest entries.

        Shared state lives in Redis/Firestore; this cache only answers "was this
        job seen here". Unbounded, it grew by one record per export for the life of
        every API and worker process."""

        def __init__(self, max_entries: int):
            super().__init__()
            self.max_entries = max_entries

        def __setitem__(self, key, value):
            super().__setitem__(key, value)
            self.move_to_end(key)
            while len(self) > self.max_entries:
                self.popitem(last=False)
    context._BoundedJobCache = _BoundedJobCache

    context._export_jobs: context.Dict[str, context.Dict[str, context.Any]] = context._BoundedJobCache(
        max(100, int(context.os.environ.get("EXPORT_JOB_LOCAL_CACHE_MAX", "2000")))
    )

    context._export_idempotency: context.Dict[str, context.Dict[str, context.Any]] = {}

    context._upload_idempotency: context.Dict[str, context.Dict[str, context.Any]] = {}

    context._active_exports_by_user: context.Dict[str, str] = {}

    context._active_processes_by_user: context.Dict[str, str] = {}

    context._export_failures: context.Dict[str, list] = {}

    context._upload_owners: context.Dict[str, str] = {}

    context.scheduler = context.AsyncIOScheduler() if context.SCHEDULER_AVAILABLE else None

    context._redis_client = None

    context._rq_redis_client = None

    if context.REDIS_AVAILABLE and context.REDIS_URL and not context._IS_TEST:
        try:
            context._redis_client = context.connect_redis(context.REDIS_URL, decode_responses=True, socket_timeout=5)
            context._redis_client.ping()
            # RQ stores pickled/binary job payloads. Sharing the application's
            # decode_responses=True client makes failed-job inspection attempt UTF-8
            # decoding and can strand per-user export leases.
            # The API never blocks on a queue pop, so a bounded read timeout is safe
            # and turns a stalled Redis into a fast error instead of a hung request.
            context._rq_redis_client = context.connect_redis(context.REDIS_URL, socket_timeout=15)
            context._rq_redis_client.ping()
            context._json_log("info", "redis_connected")
        except Exception as e:
            context._redis_client = None
            context._rq_redis_client = None
            context._json_log("warning", "redis_connection_failed", error=str(e))

    if context._IS_PRODUCTION and context._redis_client is None:
        raise RuntimeError(
            "Redis is required in production (ENV=production) for cross-instance rate "
            "limiting and payment idempotency. Set REDIS_URL to a reachable Redis instance."
        )

    context._export_queue = None

    context._export_queues = {}

    if context.DURABLE_QUEUE_ENABLED and context._rq_redis_client is not None and context.RQ_AVAILABLE:
        try:
            context.configured_render_queues = list(context.RENDER_QUEUE_NAMES)
            if context.GPU_RENDER_ENABLED:
                context.configured_render_queues.append(context.GPU_EXPORT_QUEUE_NAME)
            context._export_queues = {
                context.queue_name: context.Queue(context.queue_name, connection=context._rq_redis_client, default_timeout=30 * 60)
                for context.queue_name in context.configured_render_queues
            }
            context._export_queue = context._export_queues[context.EXPORT_QUEUE_NAME]
            context._json_log("info", "durable_queue_enabled", queues=list(context._export_queues))
        except Exception as e:
            context._export_queue = None
            context._export_queues = {}
            context._json_log("warning", "durable_queue_init_failed", error=str(e))

    if context._IS_PRODUCTION and context._export_queue is None:
        raise RuntimeError("The durable export queue is required in production; refusing API-local rendering.")

    context._transcription_queue = context._export_queue

    if context._export_queue is not None and context.TRANSCRIPTION_QUEUE_NAME != context.EXPORT_QUEUE_NAME:
        context._transcription_queue = context.Queue(context.TRANSCRIPTION_QUEUE_NAME, connection=context._rq_redis_client, default_timeout=30 * 60)

    context._media_scan_queue = context._transcription_queue

    if context._export_queue is not None and context.MEDIA_SCAN_QUEUE_NAME not in {context.EXPORT_QUEUE_NAME, context.TRANSCRIPTION_QUEUE_NAME}:
        context._media_scan_queue = context.Queue(context.MEDIA_SCAN_QUEUE_NAME, connection=context._rq_redis_client, default_timeout=20 * 60)

    context._maintenance_jobs = context.bind(context.create_maintenance_jobs(context))

    context.app.add_middleware(
        context.CORSMiddleware,
        allow_origins=context.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST"],
        allow_headers=[
            "Content-Type",
            "Authorization",
            "X-Request-Id",
            "X-Firebase-AppCheck",
            "Idempotency-Key",
        ],
    )

    context._upload_rate: context.Dict[str, list] = {}

    context.app.add_middleware(context.UploadBodyLimitMiddleware)

    context._signup_rate: context.Dict[str, list] = {}

    context._payment_rate: context.Dict[str, list] = {}

    context._promo_rate: context.Dict[str, list] = {}

    context._translate_rate: context.Dict[str, list] = {}

    context._process_rate: context.Dict[str, list] = {}

    context._detect_language_rate: context.Dict[str, list] = {}

    context._analytics_rate: context.Dict[str, list] = {}

    context._support_rate: context.Dict[str, list] = {}

    context._analytics_counters: context.Dict[str, int] = {}

    context._analytics_daily_counters: context.Dict[str, context.Dict[str, int]] = {}

    context._analytics_last_alert_ts: context.Dict[str, float] = {}

    context._route_latency_samples: context.Dict[str, list] = {}

    context._operational_metric_samples: context.Dict[str, list] = {}

    context._payment_idempotency: context.Dict[str, context.Dict[str, context.Any]] = {}

    context._tenant_memberships: context.Dict[str, set] = {}

    context._telemetry_buffer = context.deque()

    context._telemetry_lock = context.threading.Lock()

    context._telemetry_flush_task = None

    context._simple_janitor_task = None

    context._transcription_dispatch_task = None

    context._queue_metrics_task = None

    context._provider_breakers: context.Dict[str, context.CircuitBreaker] = {
        "openai_translate": context.CircuitBreaker(failure_threshold=4, cooldown_seconds=120),
        "openai_detect_language": context.CircuitBreaker(failure_threshold=4, cooldown_seconds=120),
    }

    context._request_security = context.bind(context.create_request_security(context))

    context._service_control_cache: context.Dict[str, context.Any] = {"ts": 0.0, "value": {}}

    context._operator_controls = context.bind(context.create_operator_controls(context))

    context._RATE_LIMIT_NAMESPACES = (
        (context._upload_rate, "upload"),
        (context._signup_rate, "signup"),
        (context._payment_rate, "payment"),
        (context._promo_rate, "promo"),
        (context._translate_rate, "translate"),
        (context._process_rate, "process"),
        (context._detect_language_rate, "detect-language"),
        (context._analytics_rate, "analytics"),
        (context._support_rate, "support"),
    )

    context._request_guards = context.bind(context.create_request_guards(context))

    context._media_records = context.bind(context.create_media_records(context))

    context._entitlements = context.bind(context.create_entitlements(context))

    for context.d in [context.UPLOAD_DIR, context.EXPORT_DIR, context.FONTS_DIR, context.CACHE_DIR, context.TRANSCRIPTION_CACHE_DIR, context.RENDER_CACHE_DIR, context.DEAD_LETTER_DIR]:
        context.os.makedirs(context.d, exist_ok=True)

    context.processor = context.VideoProcessor(context.FONTS_DIR)

    context.app.include_router(context.create_project_router(
        context._authenticate_media_request,
        context.get_db,
        context._validate_file_id,
        context._assert_upload_owner,
    ))

    context._api_models = context.bind(context.create_api_models(context))

    context._export_job_core = context.bind(context.create_export_jobs(context))

    context._cached_google_fonts = None

    @context.app.get("/api/fonts")
    def get_google_fonts():
        pass  # shared state is held by context
        if context._cached_google_fonts is not None:
            return {"fonts": context._cached_google_fonts}

        try:
            req = context.urllib.request.Request(
                'https://fonts.google.com/metadata/fonts',
                headers={'User-Agent': 'Mozilla/5.0'}
            )
            with context._urlopen_https_only(req, timeout=10) as res:
                raw_data = res.read().decode('utf-8')
                # The API often prefixes with )]}' for security
                if raw_data.startswith(")]}'"):
                    raw_data = raw_data.split('\n', 1)[1]
                data = context.json.loads(raw_data)

                fonts = []
                for family in data.get('familyMetadataList', []):
                    fonts.append({"family": family.get("family")})

                context._cached_google_fonts = fonts
                return {"fonts": fonts}
        except Exception as e:
            context._json_log("warning", "google_fonts_fetch_failed", error=str(e))
            return {"fonts": []}
    context.get_google_fonts = get_google_fonts

    context._upload_dispatch = context.bind(context.create_upload_dispatch(context))

    context.app.include_router(context.create_direct_upload_router(
        authenticate=context._authenticate_media_request,
        extract_token=context._extract_bearer_token,
        assert_service_available=context._assert_service_available,
        allowed_extensions=context.ALLOWED_EXTENSIONS,
        allowed_content_prefixes=context.ALLOWED_CONTENT_PREFIXES,
        allowed_origins=context.ALLOWED_ORIGINS,
        max_upload_bytes=context.MAX_UPLOAD_BYTES,
        create_session=context.create_resumable_source_upload,
        finalize_session=context.finalize_resumable_source_upload,
        remember_owner=context._remember_upload_owner,
        signed_upload_url=context._signed_upload_url,
        audit_action=context._audit_action,
        reserve_slot=context._reserve_direct_upload_slot,
        release_slot=context._release_direct_upload_slot,
        cancel_session=context.cancel_resumable_source_upload,
        resume_session=context.resume_resumable_source_upload,
        assert_account_active=context._assert_account_not_deleting,
        rate_limit_network=context._limit_direct_upload_network,
        enqueue_scan=context._schedule_media_scan,
        sign_parts=context.sign_resumable_upload_parts,
    ))

    context.app.include_router(context.create_editor_preferences_router(
        context._authenticate_media_request,
        context.get_db,
    ))

    context._upload_api = context.bind(context.create_upload_router(context))

    context.app.include_router(context._upload_api.router)

    context._processing_api = context.bind(context.create_processing_router(context))

    context.app.include_router(context._processing_api.router)

    context.app.include_router(context.create_maintenance_router(
        authorize=context._require_scheduler_secret,
        dispatch_transcription=lambda: context.TranscriptionJobs(context.get_db()).dispatch(context._transcription_queue),
        dispatch_media_scans=context._dispatch_media_scans_once,
        run_janitor=context.scheduled_janitor_job,
        publish_queue_metrics=context._publish_queue_metrics_once,
        reconcile_payments=context.scheduled_payment_reconciliation_job,
    ))

    context.bind(create_worker_tasks(context))

    context._export_api = context.bind(context.create_export_router(context))

    context.app.include_router(context._export_api.router)

    context._system_api = context.bind(context.create_system_router(context))

    context.app.include_router(context._system_api.router)

    context._dependency_snapshot_cache: context.Dict[str, context.Any] = {"checked_at": 0.0, "value": None}

    context._dependency_snapshot_lock = context.threading.Lock()

    context._billing = context.bind(context.create_billing_service(context))

    context.app.include_router(context._billing.router)

    def _decoded_token_is_admin(decoded: context.Optional[context.Dict[str, context.Any]]) -> bool:
        if not decoded:
            return False
        if decoded.get("admin") is True:
            return True
        allowed_admins = {
            e.strip().lower()
            for e in context.os.environ.get("ADMIN_EMAILS", "").split(",")
            if e.strip()
        }
        return bool(
            decoded.get("email_verified") is True
            and allowed_admins
            and decoded.get("email", "").lower() in allowed_admins
        )
    context._decoded_token_is_admin = _decoded_token_is_admin

    def _is_admin_token(id_token: str = "", request: context.Optional[context.Request] = None) -> bool:
        token = (id_token or "").strip()
        if not token and request is not None:
            token = request.headers.get("authorization", "").replace("Bearer ", "").strip()
        if not token:
            return False
        decoded = context.verify_token(token)
        if not decoded:
            return False
        return context._decoded_token_is_admin(decoded)
    context._is_admin_token = _is_admin_token

    context.app.include_router(context.create_cost_reconciliation_router(context._is_admin_token, context.get_db))

    context.app.include_router(context.create_notification_router(context._authenticate_bearer_request, context.get_db))

    context.app.include_router(context.create_public_api_router(
        authenticate_request=context._authenticate_bearer_request,
        get_database=context.get_db,
        list_account_projects=context.list_projects,
        read_account_project=context.read_draft,
        load_export_job=context._load_export_job,
    ))

    context.app.include_router(context.create_workspace_router(
        authenticate_request=context._authenticate_bearer_request,
        get_database=context.get_db,
        assert_upload_owner=context._assert_upload_owner,
        validate_file_id=context._validate_file_id,
        find_upload=context._safe_find_upload,
        signed_upload_url=context._signed_upload_url,
    ))

    context._provider_admin_api = context.bind(context.create_provider_admin_router(context))

    context.app.include_router(context._provider_admin_api.router)

    context.app.include_router(context.create_analytics_router(
        is_admin=context._is_admin_token,
        utcnow=context._utcnow,
        get_database=context.get_db,
        read_counters=context._read_daily_analytics_counters,
        read_latency_samples=context._read_daily_latency_samples,
        read_metric_samples=context._read_operational_metric_samples,
        alert_failure_ratio=context._maybe_alert_failure_ratio,
        percentile_95=context._p95,
    ))

    context._payments = context.bind(context.create_payments_router(context))

    context.app.include_router(context._payments.router)

    context._admin_api = context.bind(context.create_admin_router(context))

    context.app.include_router(context._admin_api.router)

    context._account_api = context.bind(context.create_account_router(context))

    context.app.include_router(context._account_api.router)

    context._language_api = context.bind(context.create_language_router(context))

    context.app.include_router(context._language_api.router)

    context._media_api = context.bind(context.create_media_router(context))

    context.app.include_router(context._media_api.router)

    return context

sys.modules.setdefault("backend.application", sys.modules[__name__])
sys.modules.setdefault("application", sys.modules[__name__])
runtime = create_backend()
