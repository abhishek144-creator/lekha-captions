import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
backend_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.dirname(backend_dir)
runtime_env_file = (os.environ.get("RUNTIME_ENV_FILE") or "").strip()
if runtime_env_file:
    if not os.path.isabs(runtime_env_file) or not os.path.isfile(runtime_env_file):
        raise RuntimeError("RUNTIME_ENV_FILE must be an existing absolute file")
    load_dotenv(dotenv_path=runtime_env_file, override=False)
env_local = os.path.join(root_dir, ".env.local")
env_base = os.path.join(root_dir, ".env")
_bootstrap_env = (os.environ.get("APP_ENV") or os.environ.get("ENV") or "").strip().lower()
_bootstrap_is_test = _bootstrap_env in {"test", "testing"} or "pytest" in sys.modules or "unittest" in sys.modules
if not _bootstrap_is_test or os.environ.get("LOAD_LOCAL_ENV_IN_TESTS") == "1":
    if os.path.exists(env_local):
        load_dotenv(dotenv_path=env_local)
    if os.path.exists(env_base):
        load_dotenv(dotenv_path=env_base)

try:
    from .upload_api import create_upload_router
except ImportError:
    from upload_api import create_upload_router

try:
    from .processing_api import create_processing_router
except ImportError:
    from processing_api import create_processing_router

try:
    from .provider_admin_api import create_provider_admin_router
except ImportError:
    from provider_admin_api import create_provider_admin_router

from fastapi import FastAPI, UploadFile, File, HTTPException, Response
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, model_validator
import shutil
import uuid
import urllib.request
import urllib.parse
import json
import base64
from datetime import datetime, timedelta, date, timezone
from dateutil.relativedelta import relativedelta
from typing import List, Dict, Any, Optional
try:
    from .processor import VideoProcessor
except ImportError:  # Direct execution from backend/ remains supported.
    from processor import VideoProcessor
import asyncio
import anyio
import time
import subprocess
import hmac
import hashlib
from fastapi import Request
try:
    from .firebase_admin_setup import (
        verify_token,
        get_db,
        upload_to_firebase_storage,
        delete_from_firebase_storage,
        delete_user_exports,
        delete_expired_exports,
        upload_source_media,
        download_from_firebase_storage,
        download_export_from_firebase_storage,
        signed_export_download_url,
        delete_expired_uploads,
        delete_user_uploads,
        storage_backend_ready,
        create_resumable_source_upload,
        resume_resumable_source_upload,
        sign_resumable_upload_parts,
        cancel_resumable_source_upload,
        finalize_resumable_source_upload,
        set_source_upload_state,
        download_render_cache,
        upload_render_cache,
        delete_render_cache,
    )
except ImportError:  # Direct execution from backend/ remains supported.
    from firebase_admin_setup import (
        verify_token,
        get_db,
        upload_to_firebase_storage,
        delete_from_firebase_storage,
        delete_user_exports,
        delete_expired_exports,
        upload_source_media,
        download_from_firebase_storage,
        download_export_from_firebase_storage,
        signed_export_download_url,
        delete_expired_uploads,
        delete_user_uploads,
        storage_backend_ready,
        create_resumable_source_upload,
        resume_resumable_source_upload,
        sign_resumable_upload_parts,
        cancel_resumable_source_upload,
        finalize_resumable_source_upload,
        set_source_upload_state,
        download_render_cache,
        upload_render_cache,
        delete_render_cache,
    )
from firebase_admin import app_check as firebase_app_check
from firebase_admin import auth as firebase_auth
import math
from google.cloud import firestore
from google.api_core.exceptions import AlreadyExists
import mimetypes
import logging
import ipaddress
import pathlib
import re
import secrets
import threading
from collections import OrderedDict, deque
from contextlib import asynccontextmanager
try:
    from .transcription_jobs import TranscriptionJobs
    from .queue_admission import PENDING_WORK_LEDGER_KEY, enqueue_bounded_across_queues, release_pending_work
    from . import worker_launcher
    from .drafts import list_projects, read_draft
    from .project_api import create_project_router
    from .editor_preferences import create_editor_preferences_router, read_editor_preferences
    from .cost_reconciliation import create_cost_reconciliation_router
    from .analytics_api import create_analytics_router
    from .notifications import create_notification, create_notification_router
    from .public_api import create_public_api_router
    from .workspace_api import create_workspace_router
    from .payments_api import create_payments_router
    from .redis_config import connect_redis
    from .idle_connections import RailwayIdleConnectionsMiddleware, disconnect_idle_redis_clients
    from .system_api import create_system_router
    from .billing import create_billing_service
    from .observability import create_observability
    from .request_security import create_request_security
    from .operator_controls import create_operator_controls
    from .request_guards import create_request_guards
    from .media_records import create_media_records
    from .entitlements import create_entitlements
    from .export_jobs import create_export_jobs
    from .maintenance_jobs import create_maintenance_jobs
    from .api_models import create_api_models
    from .upload_dispatch import create_upload_dispatch
    from .admin_api import create_admin_router
    from .language_api import create_language_router
    from .account_api import create_account_router
    from .media_api import create_media_router
    from .export_api import create_export_router
    from .provider_health import transcription_provider_health
    from .direct_upload_api import create_direct_upload_router
    from .api.maintenance import create_maintenance_router
    from .upload_admission import reserve_upload, release_upload
    from .request_limits import UploadBodyLimitMiddleware
    from .release_metadata import apply_platform_release_defaults, release_metadata
    from .media_storage import is_configured as s3_storage_configured
    from .runtime_preflight import required_storage_settings
    from .media_commands import run_media_command
    from .job_state import transition as transition_export_job, InvalidJobTransition, LOCAL_LOCK as JOB_STATE_LOCK
    from .gcp_queue_metrics import job_queue_prediction, publish_queue_snapshot, queue_snapshot, render_queue_snapshot
    from .rendering.capacity import (
        FAST_EXPORT_QUEUE_NAME,
        GPU_EXPORT_QUEUE_NAME,
        HEAVY_EXPORT_QUEUE_NAME,
        NORMAL_EXPORT_QUEUE_NAME,
        RENDER_QUEUE_NAMES,
        estimate_render_capacity,
    )
    from .rendering.cache import render_cache_eligible, render_cache_identity
    from .services.media_scan_jobs import MediaScanJobs
    from .services.scheduler_auth import require_scheduler_authorization
    from .services.malware import scan_upload_for_threat
    from .services.upload_security import UploadSecurityService
except ImportError:
    from transcription_jobs import TranscriptionJobs
    from queue_admission import PENDING_WORK_LEDGER_KEY, enqueue_bounded_across_queues, release_pending_work
    import worker_launcher
    from drafts import list_projects, read_draft
    from project_api import create_project_router
    from editor_preferences import create_editor_preferences_router, read_editor_preferences
    from cost_reconciliation import create_cost_reconciliation_router
    from analytics_api import create_analytics_router
    from notifications import create_notification, create_notification_router
    from public_api import create_public_api_router
    from workspace_api import create_workspace_router
    from payments_api import create_payments_router
    from redis_config import connect_redis
    from idle_connections import RailwayIdleConnectionsMiddleware, disconnect_idle_redis_clients
    from system_api import create_system_router
    from billing import create_billing_service
    from observability import create_observability
    from request_security import create_request_security
    from operator_controls import create_operator_controls
    from request_guards import create_request_guards
    from media_records import create_media_records
    from entitlements import create_entitlements
    from export_jobs import create_export_jobs
    from maintenance_jobs import create_maintenance_jobs
    from api_models import create_api_models
    from upload_dispatch import create_upload_dispatch
    from admin_api import create_admin_router
    from language_api import create_language_router
    from account_api import create_account_router
    from media_api import create_media_router
    from export_api import create_export_router
    from provider_health import transcription_provider_health
    from direct_upload_api import create_direct_upload_router
    from api.maintenance import create_maintenance_router
    from upload_admission import reserve_upload, release_upload
    from request_limits import UploadBodyLimitMiddleware
    from release_metadata import apply_platform_release_defaults, release_metadata
    from media_storage import is_configured as s3_storage_configured
    from runtime_preflight import required_storage_settings
    from media_commands import run_media_command
    from job_state import transition as transition_export_job, InvalidJobTransition, LOCAL_LOCK as JOB_STATE_LOCK
    from gcp_queue_metrics import job_queue_prediction, publish_queue_snapshot, queue_snapshot, render_queue_snapshot
    from rendering.capacity import (
        FAST_EXPORT_QUEUE_NAME,
        GPU_EXPORT_QUEUE_NAME,
        HEAVY_EXPORT_QUEUE_NAME,
        NORMAL_EXPORT_QUEUE_NAME,
        RENDER_QUEUE_NAMES,
        estimate_render_capacity,
    )
    from rendering.cache import render_cache_eligible, render_cache_identity
    from services.media_scan_jobs import MediaScanJobs
    from services.scheduler_auth import require_scheduler_authorization
    from services.malware import scan_upload_for_threat
    from services.upload_security import UploadSecurityService

try:
    import razorpay as _razorpay_module
    RAZORPAY_AVAILABLE = True
except ImportError:
    _razorpay_module = None
    RAZORPAY_AVAILABLE = False
    print("[Warning] razorpay package not installed — payment endpoints will be unavailable")

try:
    from apscheduler.schedulers.asyncio import AsyncIOScheduler
    SCHEDULER_AVAILABLE = True
except ImportError:
    AsyncIOScheduler = None
    SCHEDULER_AVAILABLE = False
    print("[Warning] apscheduler not installed — background janitor disabled")

try:
    import redis
    REDIS_AVAILABLE = True
except ImportError:
    redis = None
    REDIS_AVAILABLE = False
    print("[Warning] redis package not installed — durable rate limiting/idempotency disabled")

try:
    from rq import Queue as _RQQueue, Worker as RQWorker
    from rq.job import Job
    from rq import Retry as RQRetry

    class Queue(_RQQueue):
        """RQ queue that starts an on-demand worker once a job is really queued.

        Pipelined enqueues are not visible until the caller executes the
        pipeline, so those callers kick the worker themselves afterwards."""

        def enqueue_job(self, job, pipeline=None, **kwargs):
            queued = super().enqueue_job(job, pipeline=pipeline, **kwargs)
            if pipeline is None:
                worker_launcher.kick_in_background(self.connection, self.name)
            return queued

    RQ_AVAILABLE = True
except ImportError:
    Queue = None
    RQWorker = None
    Job = None
    RQRetry = None
    RQ_AVAILABLE = False

try:
    import sentry_sdk
    SENTRY_AVAILABLE = True
except ImportError:
    sentry_sdk = None
    SENTRY_AVAILABLE = False

@asynccontextmanager
async def app_lifespan(_app: FastAPI):
    await startup_event()
    try:
        yield
    finally:
        await shutdown_event()


app = FastAPI(lifespan=app_lifespan)
app.add_middleware(
    RailwayIdleConnectionsMiddleware,
    clients=lambda: (_redis_client, _rq_redis_client),
)

_observability = create_observability(sys.modules[__name__])
_utcnow = _observability._utcnow
_json_log = _observability._json_log
_send_alert = _observability._send_alert
_urlopen_https_only = _observability._urlopen_https_only
_retention_deadline = _observability._retention_deadline
_enqueue_telemetry = _observability._enqueue_telemetry
_flush_telemetry = _observability._flush_telemetry
_telemetry_flush_loop = _observability._telemetry_flush_loop
CircuitBreaker = _observability.CircuitBreaker
_request_id = _observability._request_id
_log = _observability._log
_track_event = _observability._track_event
_track_latency_sample = _observability._track_latency_sample
_track_operational_metric_sample = _observability._track_operational_metric_sample
_read_operational_metric_samples = _observability._read_operational_metric_samples
_read_daily_analytics_counters = _observability._read_daily_analytics_counters
_read_daily_latency_samples = _observability._read_daily_latency_samples
_p95 = _observability._p95
_build_slo_snapshot = _observability._build_slo_snapshot
_maybe_alert_failure_ratio = _observability._maybe_alert_failure_ratio
_audit_action = _observability._audit_action

MAX_JSON_BODY_BYTES = 8 * 1024 * 1024
SECURITY_CSP = (
    "default-src 'self'; "
    "base-uri 'self'; object-src 'none'; frame-ancestors 'none'; "
    "script-src 'self' https://checkout.razorpay.com; "
    "frame-src https://*.razorpay.com https://*.firebaseapp.com; "
    "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com "
    "https://*.firebaseapp.com https://*.razorpay.com; "
    "img-src 'self' data: blob: https:; media-src 'self' blob: https:; "
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
    "font-src 'self' data: https://fonts.gstatic.com"
)

logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"))
_logger = logging.getLogger("caption_studio_backend")


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    rid = _request_id(request)
    request.state.request_id = rid
    if _app_check_required(request) and request.headers.get("x-firebase-appcheck"):
        # Firebase may synchronously fetch rotated signing keys. Keep its
        # bounded verification work outside the API event loop; health probes
        # and missing-token rejections never wait for this worker pool.
        app_check_failure = await anyio.to_thread.run_sync(
            _verify_firebase_app_check_request, request, rid,
            limiter=_app_check_verification_limiter,
        )
    else:
        app_check_failure = _verify_firebase_app_check_request(request, rid)
    if app_check_failure is not None:
        return _apply_security_headers(app_check_failure)
    if request.url.path == "/api/upload" and _IS_PRODUCTION:
        # Reject before FastAPI parses multipart, so a misconfigured production
        # client cannot stream even a small video through an API instance.
        return _apply_security_headers(JSONResponse(
            status_code=409,
            content={"detail": "Production uploads must use the direct resumable storage flow."},
            headers={"X-Request-Id": rid, "X-Lekha-Upload-Transport": "direct-resumable"},
        ))
    if request.url.path == "/api/upload":
        # FastAPI parses multipart before entering the endpoint. Authenticate
        # here so an unauthenticated request never spools customer-sized media.
        try:
            upload_identity = await asyncio.to_thread(_authenticate_media_request, _extract_bearer_token(request))
        except HTTPException as error:
            return _apply_security_headers(JSONResponse(status_code=error.status_code,
                content={"detail": error.detail}, headers={"X-Request-Id": rid}))
    content_type = (request.headers.get("content-type") or "").lower()
    declared_length = request.headers.get("content-length")
    if "application/json" in content_type and declared_length:
        try:
            if int(declared_length) > MAX_JSON_BODY_BYTES:
                return _apply_security_headers(JSONResponse(
                    status_code=413,
                    content={"success": False, "error": "Request body is too large"},
                    headers={"X-Request-Id": rid},
                ))
        except ValueError:
            return _apply_security_headers(JSONResponse(
                status_code=400,
                content={"success": False, "error": "Invalid Content-Length header"},
                headers={"X-Request-Id": rid},
            ))
    if "application/json" in content_type:
        body = bytearray()
        async for chunk in request.stream():
            body.extend(chunk)
            if len(body) > MAX_JSON_BODY_BYTES:
                return _apply_security_headers(JSONResponse(
                    status_code=413,
                    content={"success": False, "error": "Request body is too large"},
                    headers={"X-Request-Id": rid},
                ))
        # Starlette's downstream receive wrapper replays this cached body. This
        # enforces the limit even for chunked requests with no Content-Length.
        request._body = bytes(body)
    requested_version = (request.headers.get("x-api-version") or "").strip()
    if requested_version and requested_version < API_MIN_SUPPORTED_VERSION:
        return _apply_security_headers(JSONResponse(
            status_code=426,
            content={
                "success": False,
                "error": "API version is no longer supported",
                "min_supported_version": API_MIN_SUPPORTED_VERSION,
                "current_version": API_CURRENT_VERSION,
                "sunset_date": DEPRECATION_SUNSET_DATE,
            },
            headers={
                "X-Request-Id": rid,
                "X-API-Version": API_CURRENT_VERSION,
                "X-API-Min-Version": API_MIN_SUPPORTED_VERSION,
                "Sunset": DEPRECATION_SUNSET_DATE,
            },
        ))
    upload_slot_uid = str(upload_identity.get("uid") or "") if request.url.path == "/api/upload" else ""
    if upload_slot_uid and not await asyncio.to_thread(_acquire_process_slot, upload_slot_uid, f"upload:{rid}"):
        return _apply_security_headers(JSONResponse(status_code=429, content={"detail": "Another upload or transcription is active for this account."}, headers={"X-Request-Id": rid}))
    start = time.time()
    try:
        response = await call_next(request)
    except Exception as e:
        elapsed_ms = int((time.time() - start) * 1000)
        _json_log(
            "error",
            "http_request",
            request_id=rid,
            method=request.method,
            path=request.url.path,
            status_code=500,
            duration_ms=elapsed_ms,
            replica_region=RAILWAY_REPLICA_REGION,
            replica_id=RAILWAY_REPLICA_ID,
            error=str(e),
        )
        return _apply_security_headers(JSONResponse(status_code=500, content={
            "success": False, "error": {"code": "INTERNAL_ERROR",
            "message": "Something went wrong. Please contact support with this request ID.", "request_id": rid},
        }, headers={"X-Request-Id": rid, "Cache-Control": "no-store"}))
    finally:
        if upload_slot_uid:
            await asyncio.to_thread(_release_process_slot, upload_slot_uid, f"upload:{rid}")
        if not RUN_API_BACKGROUND_TASKS:
            # Cloud Run may suspend CPU as soon as the request finishes. Flush
            # buffered events while this request still has execution time.
            with _telemetry_lock:
                telemetry_pending = bool(_telemetry_buffer)
            if telemetry_pending:
                try:
                    await asyncio.to_thread(_flush_telemetry)
                except Exception as error:
                    _json_log("warning", "request_telemetry_flush_failed", error=type(error).__name__)
    elapsed_ms = int((time.time() - start) * 1000)
    response.headers["X-Request-Id"] = rid
    _json_log(
        "info",
        "http_request",
        request_id=rid,
        method=request.method,
        path=request.url.path,
        status_code=response.status_code,
        duration_ms=elapsed_ms,
        replica_region=RAILWAY_REPLICA_REGION,
        replica_id=RAILWAY_REPLICA_ID,
    )
    try:
        await asyncio.to_thread(_track_latency_sample, request.url.path, elapsed_ms)
    except Exception:
        pass
    response.headers["X-API-Version"] = API_CURRENT_VERSION
    response.headers["X-API-Min-Version"] = API_MIN_SUPPORTED_VERSION
    response.headers["Sunset"] = DEPRECATION_SUNSET_DATE
    return _apply_security_headers(response)

# Runtime mode is security-sensitive. Never infer a permissive development mode
# merely because a deployment forgot to set an environment variable.
_ENV_RAW = (os.environ.get("APP_ENV") or os.environ.get("ENV") or "").strip().lower()
_ENV_ALIASES = {
    "prod": "production", "production": "production",
    "dev": "development", "local": "development", "development": "development",
    "test": "test", "testing": "test",
}
if not _ENV_RAW and ("pytest" in sys.modules or "unittest" in sys.modules):
    _ENV_RAW = "test"
if _ENV_RAW not in _ENV_ALIASES:
    raise RuntimeError(
        "APP_ENV must be explicitly set to development, test, or production. "
        "Refusing to start with an implicit permissive environment."
    )
APP_ENV = _ENV_ALIASES[_ENV_RAW]
_IS_PRODUCTION = APP_ENV == "production"
_IS_DEVELOPMENT = APP_ENV == "development"
_IS_TEST = APP_ENV == "test"
RAILWAY_REPLICA_REGION = os.environ.get("RAILWAY_REPLICA_REGION", "local")
RAILWAY_REPLICA_ID = os.environ.get("RAILWAY_REPLICA_ID", "local")

FIREBASE_APP_CHECK_ENFORCED = os.environ.get(
    "FIREBASE_APP_CHECK_ENFORCED",
    "1" if _IS_PRODUCTION else "0",
).strip().lower() in ("1", "true", "yes", "on")
if _IS_PRODUCTION and not FIREBASE_APP_CHECK_ENFORCED:
    raise RuntimeError(
        "FIREBASE_APP_CHECK_ENFORCED must be enabled in production. "
        "Register the web app in Firebase App Check before deploying."
    )

_APP_CHECK_EXEMPT_PATHS = frozenset({
    "/health",
    "/ready",
    "/api/health",
    "/api/version",
    "/api/service-status",
    "/api/razorpay-webhook",
    "/api/reconcile-payments",
})
_APP_CHECK_EXEMPT_PREFIXES = (
    "/api/health/",
    "/api/media/",
    "/api/admin/",
    "/api/slo/",
)


_app_check_verification_limiter = anyio.CapacityLimiter(16)


# --- Error tracking (optional) ------------------------------------------------
# Structured logs and dead-letter records already capture failures, but they are
# per-instance and easy to miss in aggregate. Sentry collects them in one place.
# Entirely inert unless SENTRY_DSN is set, so local and test runs are unchanged.
# send_default_pii stays False: this service handles user media and payments.
SENTRY_DSN = os.environ.get("SENTRY_DSN", "").strip()
if SENTRY_DSN and SENTRY_AVAILABLE and not _IS_TEST:
    try:
        sentry_sdk.init(
            dsn=SENTRY_DSN,
            environment=APP_ENV,
            release=os.environ.get("APP_RELEASE") or None,
            traces_sample_rate=float(os.environ.get("SENTRY_TRACES_SAMPLE_RATE", "0.05")),
            send_default_pii=False,
        )
        _json_log("info", "sentry_initialized", environment=APP_ENV)
    except Exception as e:
        _json_log("warning", "sentry_init_failed", error=str(e))
elif SENTRY_DSN and not SENTRY_AVAILABLE:
    if _IS_PRODUCTION:
        raise RuntimeError("SENTRY_DSN is configured but the Sentry SDK is unavailable in production.")
    _json_log("warning", "sentry_dsn_set_but_sdk_missing")
RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "")
RAZORPAY_WEBHOOK_SECRET = os.environ.get("RAZORPAY_WEBHOOK_SECRET", "")

# Fail-safe tripwire: the entire production hardening posture (auth-bypass blocks,
# mandatory secrets, Redis requirement, CORS restrictions) is gated on ENV. If a
# real deploy forgets ENV=production, all of that silently relaxes. Live Razorpay
# keys are an unambiguous signal that this is a production environment — refuse to
# boot in permissive mode when they are present, so a misconfigured deploy fails
# loudly instead of running wide open.
if not _IS_PRODUCTION and RAZORPAY_KEY_ID.startswith("rzp_live_"):
    raise RuntimeError(
        "Live Razorpay keys require APP_ENV=production. Refusing to start with "
        "live payment credentials in a non-production environment."
    )
_json_log(
    "warning" if not _IS_PRODUCTION else "info",
    "runtime_mode",
    env=APP_ENV,
    is_production=_IS_PRODUCTION,
)

if _IS_PRODUCTION and not RAZORPAY_WEBHOOK_SECRET:
    raise RuntimeError("RAZORPAY_WEBHOOK_SECRET must be set in production (ENV=production).")
if _IS_PRODUCTION:
    apply_platform_release_defaults()
    required_production_settings = {
        "FIREBASE_SERVICE_ACCOUNT_JSON": os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON", "").strip(),
        "OPENAI_API_KEY": os.environ.get("OPENAI_API_KEY", "").strip(),
        "SARVAM_API_KEY": os.environ.get("SARVAM_API_KEY", "").strip(),
        "RAZORPAY_KEY_ID": RAZORPAY_KEY_ID.strip(),
        "RAZORPAY_KEY_SECRET": RAZORPAY_KEY_SECRET.strip(),
        "PAYMENT_RECONCILE_SECRET": os.environ.get("PAYMENT_RECONCILE_SECRET", "").strip(),
        "APP_RELEASE": os.environ.get("APP_RELEASE", "").strip(),
        "APP_BUILD_TIME": os.environ.get("APP_BUILD_TIME", "").strip(),
        "RELEASE_VERSION": os.environ.get("RELEASE_VERSION", "").strip(),
        "ADMIN_EMAILS": os.environ.get("ADMIN_EMAILS", "").strip(),
        "SECURITY_CONTACT_EMAIL": os.environ.get("SECURITY_CONTACT_EMAIL", "").strip(),
        "PRIVACY_CONTACT_EMAIL": os.environ.get("PRIVACY_CONTACT_EMAIL", "").strip(),
    }
    required_production_settings.update(required_storage_settings(os.environ))
    if not s3_storage_configured() and os.environ.get("GCS_MEDIA_BUCKET", "").strip():
        required_production_settings["GCS_SIGNING_SERVICE_ACCOUNT"] = os.environ.get(
            "GCS_SIGNING_SERVICE_ACCOUNT", ""
        ).strip()
    missing_production_settings = [
        name for name, value in required_production_settings.items() if not value
    ]
    if missing_production_settings:
        raise RuntimeError(
            "Missing required production settings: " + ", ".join(missing_production_settings)
        )
MEDIA_URL_SIGNING_SECRET = os.environ.get("MEDIA_URL_SIGNING_SECRET", "").strip()
if _IS_PRODUCTION and not MEDIA_URL_SIGNING_SECRET:
    raise RuntimeError("MEDIA_URL_SIGNING_SECRET must be set in production (ENV=production).")
if not MEDIA_URL_SIGNING_SECRET:
    MEDIA_URL_SIGNING_SECRET = secrets.token_urlsafe(48)
rzp_client = None
if RAZORPAY_AVAILABLE and RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET:
    rzp_client = _razorpay_module.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
elif RAZORPAY_AVAILABLE:
    _json_log("warning", "razorpay_credentials_missing")

# --- PLAN PRICING (locked — do not change) ---
# Billing values live in shared/planCatalog.json, which the frontend imports too.
# Edit that catalog, not this module: it is the single source of pricing truth.
with open(os.path.join(root_dir, "shared", "planCatalog.json"), "r", encoding="utf-8") as plan_catalog_file:
    PLAN_PRICING = json.load(plan_catalog_file)

# Free credits belong in the same catalog as paid entitlements, preventing the
# account bootstrap, export policy, and frontend from drifting over time.
FREE_PLAN_ID = "free"
FREE_PLAN = PLAN_PRICING.get(FREE_PLAN_ID) or {}
FREE_PLAN_CREDITS = int(FREE_PLAN.get("credits", 0) or 0)
if FREE_PLAN_CREDITS < 1 or not FREE_PLAN.get("is_free"):
    raise RuntimeError("The plan catalog must define a non-purchasable free plan with credits.")

MAX_CONCURRENT_RENDERS = max(1, min(int(os.environ.get("MAX_CONCURRENT_RENDERS", "2")), 8))
render_semaphore = asyncio.Semaphore(MAX_CONCURRENT_RENDERS)
MAX_CONCURRENT_EXPORTS_PER_USER = 1
EXPORT_SLOT_TTL_SECONDS = max(30 * 60, int(os.environ.get("EXPORT_SLOT_TTL_SECONDS", "7200")))
PROCESS_SLOT_TTL_SECONDS = max(5 * 60, int(os.environ.get("PROCESS_SLOT_TTL_SECONDS", "1800")))
EXPORT_FAILURE_LIMIT = 5
EXPORT_FAILURE_WINDOW = 15 * 60
# Daily export quotas are enforced in every environment. Set this explicit
# testing override to 1 only for a deliberate local debugging session; leaving
# dev unthrottled makes it too easy to ship a disabled production safeguard.
DISABLE_EXPORT_DAILY_LIMIT = os.environ.get(
    "DISABLE_EXPORT_DAILY_LIMIT",
    "0",
) == "1"
if _IS_PRODUCTION and DISABLE_EXPORT_DAILY_LIMIT:
    raise RuntimeError(
        "DISABLE_EXPORT_DAILY_LIMIT must not be enabled in production "
        "(ENV=production): it bypasses the per-plan rolling export quota. "
        "Unset it or set it to 0."
    )
# Local/dev exports are not blocked by credits so testing does not burn balance.
# Production defaults to enforcing credits and refuses to start if the override
# is set explicitly — an unnoticed "1" here makes every export free.
DISABLE_EXPORT_CREDIT_LIMIT = os.environ.get(
    "DISABLE_EXPORT_CREDIT_LIMIT",
    "0" if _IS_PRODUCTION else "1",
) == "1"
if _IS_PRODUCTION and DISABLE_EXPORT_CREDIT_LIMIT:
    raise RuntimeError(
        "DISABLE_EXPORT_CREDIT_LIMIT must not be enabled in production "
        "(ENV=production): it bypasses credit deduction so every export is "
        "free. Unset it or set it to 0."
    )

# Platform-wide daily ceiling on billable AI provider calls. Per-user quotas cap
# what any one account can spend; this caps what *everyone together* can spend in
# a day, so a launch-day traffic spike (or a pile of new free accounts) cannot
# run up an unbounded transcription bill overnight. 0 disables the ceiling.
AI_SYSTEM_DAILY_LIMIT = max(0, int(os.environ.get("AI_SYSTEM_DAILY_LIMIT", "500")))
# Caption translation is short, line-numbered text; the mini model handles it at a
# fraction of the full model's price. Override per deployment if quality needs it.
TRANSLATION_MODEL = os.environ.get("TRANSLATION_MODEL", "gpt-4o-mini").strip() or "gpt-4o-mini"
AI_COST_ESTIMATE_PER_MEDIA_MINUTE_USD = max(
    0.0, float(os.environ.get("AI_COST_ESTIMATE_PER_MEDIA_MINUTE_USD", "0"))
)
RENDER_COST_ESTIMATE_PER_MEDIA_MINUTE_USD = max(
    0.0, float(os.environ.get("RENDER_COST_ESTIMATE_PER_MEDIA_MINUTE_USD", "0"))
)

class _BoundedJobCache(OrderedDict):
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


# In-memory operational state (swap for Redis in multi-instance deployments)
_export_jobs: Dict[str, Dict[str, Any]] = _BoundedJobCache(
    max(100, int(os.environ.get("EXPORT_JOB_LOCAL_CACHE_MAX", "2000")))
)
_export_idempotency: Dict[str, Dict[str, Any]] = {}
_upload_idempotency: Dict[str, Dict[str, Any]] = {}
_active_exports_by_user: Dict[str, str] = {}
_active_processes_by_user: Dict[str, str] = {}
_export_failures: Dict[str, list] = {}
_upload_owners: Dict[str, str] = {}

# Global APScheduler reference (None if apscheduler not installed)
scheduler = AsyncIOScheduler() if SCHEDULER_AVAILABLE else None

REDIS_URL = os.environ.get("REDIS_URL", "")
_redis_client = None
_rq_redis_client = None
EXPORT_QUEUE_NAME = NORMAL_EXPORT_QUEUE_NAME
GPU_RENDER_ENABLED = os.environ.get("GPU_RENDER_ENABLED", "0") == "1"
TRANSCRIPTION_QUEUE_NAME = os.environ.get("TRANSCRIPTION_QUEUE_NAME", "caption_transcription_jobs")
MEDIA_SCAN_QUEUE_NAME = os.environ.get("MEDIA_SCAN_QUEUE_NAME", "caption_media_scan_jobs")
# Production accepts an 80-job waiting backlog. Keep this default aligned with
# the deployment scripts so a missing override cannot silently reduce capacity.
EXPORT_MAX_PENDING_JOBS = max(1, int(os.environ.get("EXPORT_MAX_PENDING_JOBS", "80")))
EXPORT_MAX_PENDING_WORK_SECONDS = max(
    60,
    int(os.environ.get("EXPORT_MAX_PENDING_WORK_SECONDS", "1800")),
)
EXPORT_MAX_QUEUE_WAIT_SECONDS = max(
    # Railway's browser-independent recovery runs every 15 minutes. Leave a
    # second interval for wake/startup, without increasing the pending-work cap.
    1800 if os.environ.get("RAILWAY_PROJECT_ID") else 30,
    min(int(os.environ.get("EXPORT_MAX_QUEUE_WAIT_SECONDS", "1800")), 1800),
)
QUEUE_METRICS_ENABLED = os.environ.get("QUEUE_METRICS_ENABLED", "0") == "1"
QUEUE_METRICS_INTERVAL_SECONDS = max(
    15,
    min(int(os.environ.get("QUEUE_METRICS_INTERVAL_SECONDS", "30")), 60),
)
WORKER_MIG_NAME = os.environ.get("WORKER_MIG_NAME", "lekha-worker-staging-mig").strip()
SPOT_WORKER_MIG_NAME = os.environ.get("SPOT_WORKER_MIG_NAME", "lekha-worker-spot-staging-mig").strip()
GPU_WORKER_MIG_NAME = os.environ.get("GPU_WORKER_MIG_NAME", "lekha-worker-gpu-staging-mig").strip()
TRANSCRIPTION_MIG_NAME = os.environ.get(
    "TRANSCRIPTION_MIG_NAME", "lekha-transcription-staging-mig"
).strip()
RUN_API_BACKGROUND_TASKS = os.environ.get("RUN_API_BACKGROUND_TASKS", "1") == "1"
DURABLE_QUEUE_ENABLED = os.environ.get("ENABLE_DURABLE_QUEUE", "1") == "1"
SLACK_ALERT_WEBHOOK_URL = os.environ.get("SLACK_ALERT_WEBHOOK_URL", "").strip()
PAYMENT_RECONCILE_INTERVAL_MINUTES = int(os.environ.get("PAYMENT_RECONCILE_INTERVAL_MINUTES", "20"))
PAYMENT_RECONCILE_LOOKBACK_HOURS = int(os.environ.get("PAYMENT_RECONCILE_LOOKBACK_HOURS", "48"))
PAYMENT_RECONCILE_BATCH_SIZE = int(os.environ.get("PAYMENT_RECONCILE_BATCH_SIZE", "200"))
PAYMENT_RECONCILE_SECRET = os.environ.get("PAYMENT_RECONCILE_SECRET", "").strip()
SCHEDULER_SERVICE_ACCOUNT_EMAIL = os.environ.get("SCHEDULER_SERVICE_ACCOUNT_EMAIL", "").strip()
SCHEDULER_OIDC_AUDIENCE = os.environ.get("SCHEDULER_OIDC_AUDIENCE", "").strip()
TELEMETRY_BATCH_SIZE = max(1, min(int(os.environ.get("TELEMETRY_BATCH_SIZE", "400")), 450))
TELEMETRY_QUEUE_LIMIT = max(TELEMETRY_BATCH_SIZE, int(os.environ.get("TELEMETRY_QUEUE_LIMIT", "5000")))
API_CURRENT_VERSION = os.environ.get("API_CURRENT_VERSION", "2026-04-21")
API_MIN_SUPPORTED_VERSION = os.environ.get("API_MIN_SUPPORTED_VERSION", "2026-01-01")
DEPRECATION_SUNSET_DATE = os.environ.get("DEPRECATION_SUNSET_DATE", "2026-12-31")
APP_RELEASE = os.environ.get("APP_RELEASE", "").strip()
RELEASE_METADATA = release_metadata()
ENFORCE_TENANT_ISOLATION = os.environ.get(
    "ENFORCE_TENANT_ISOLATION", "1" if _IS_PRODUCTION else "0"
) == "1"
ENABLE_PROGRESSIVE_DELIVERY = os.environ.get("ENABLE_PROGRESSIVE_DELIVERY", "1") == "1"
REQUIRE_PAYMENT_IDEMPOTENCY = os.environ.get("REQUIRE_PAYMENT_IDEMPOTENCY", "1") == "1"
# Rate limiting and payment idempotency fall back to per-process in-memory state
# when Redis is absent. That is unsafe across multiple instances (limits become
# per-instance and bypassable), so production requires Redis unless this escape
# hatch is set for a deliberate single-instance deployment.
ALLOW_INMEMORY_STATE = os.environ.get("ALLOW_INMEMORY_STATE", "0") == "1"
if _IS_PRODUCTION and ALLOW_INMEMORY_STATE:
    raise RuntimeError(
        "ALLOW_INMEMORY_STATE is forbidden in production. Configure Redis so "
        "rate limits, job state, and payment idempotency are shared across instances."
    )
DEBUG_MODE_ENABLED = _IS_DEVELOPMENT and os.environ.get("DEBUG_MODE", "").strip().lower() not in ("", "0", "false", "no", "off")
if _IS_PRODUCTION and DEBUG_MODE_ENABLED:
    raise RuntimeError("DEBUG_MODE must not be enabled in production (ENV=production). Set DEBUG_MODE=false or unset it.")
LOCAL_DEV_AUTH_BYPASS_ENABLED = os.environ.get(
    "LOCAL_DEV_AUTH_BYPASS",
    "0",
).strip().lower() not in ("", "0", "false", "no", "off")
LOCAL_DEV_AUTH_BYPASS_ENABLED = _IS_DEVELOPMENT and LOCAL_DEV_AUTH_BYPASS_ENABLED
if _IS_PRODUCTION and LOCAL_DEV_AUTH_BYPASS_ENABLED:
    raise RuntimeError(
        "LOCAL_DEV_AUTH_BYPASS must not be enabled in production (ENV=production): "
        "it accepts the mock-token auth bypass. Unset it or set it to 0."
    )
ALLOW_EXPORT_WITHOUT_DB = (
    not _IS_PRODUCTION
    and os.environ.get("ALLOW_EXPORT_WITHOUT_DB", "0").strip().lower() in ("1", "true", "yes", "on")
)
SLO_EXPORT_SUCCESS_TARGET = float(os.environ.get("SLO_EXPORT_SUCCESS_TARGET", "0.98"))
SLO_PROCESS_SUCCESS_TARGET = float(os.environ.get("SLO_PROCESS_SUCCESS_TARGET", "0.98"))
SLO_EXPORT_P95_MS_TARGET = int(os.environ.get("SLO_EXPORT_P95_MS_TARGET", "180000"))
SLO_PROCESS_P95_MS_TARGET = int(os.environ.get("SLO_PROCESS_P95_MS_TARGET", "60000"))
ERROR_BUDGET_WINDOW_MIN_EVENTS = int(os.environ.get("ERROR_BUDGET_WINDOW_MIN_EVENTS", "30"))
RECONCILE_ERROR_ALERT_THRESHOLD = int(os.environ.get("RECONCILE_ERROR_ALERT_THRESHOLD", "3"))
RECONCILE_SKIPPED_ALERT_THRESHOLD = int(os.environ.get("RECONCILE_SKIPPED_ALERT_THRESHOLD", "20"))
CONTENT_SAFETY_BLOCKLIST = [
    t.strip().lower()
    for t in os.environ.get("CONTENT_SAFETY_BLOCKLIST", "child_abuse,terror_manual").split(",")
    if t.strip()
]
# Malware scanning is skipped entirely when CLAMAV_SCAN_CMD is unset, which is
# silent — a production deploy that never configured a scanner accepts unscanned
# user uploads and looks healthy. Require it in production, with an explicit
# opt-out for deployments that scan at another layer (same pattern as
# ALLOW_INMEMORY_STATE), so the decision is recorded rather than defaulted.
ALLOW_UNSCANNED_UPLOADS = os.environ.get("ALLOW_UNSCANNED_UPLOADS", "0").strip().lower() in ("1", "true", "yes", "on")
if _IS_PRODUCTION and ALLOW_UNSCANNED_UPLOADS:
    raise RuntimeError(
        "ALLOW_UNSCANNED_UPLOADS is forbidden in production. Configure CLAMAV_HOST "
        "or CLAMAV_SCAN_CMD before accepting customer media."
    )
if (
    _IS_PRODUCTION
    and not os.environ.get("CLAMAV_HOST", "").strip()
    and not os.environ.get("CLAMAV_SCAN_CMD", "").strip()
):
    raise RuntimeError(
        "CLAMAV_HOST or CLAMAV_SCAN_CMD must be set in production (ENV=production): without it "
        "user uploads are never scanned for malware. Configure a scanner command."
    )

if REDIS_AVAILABLE and REDIS_URL and not _IS_TEST:
    try:
        _redis_client = connect_redis(REDIS_URL, decode_responses=True, socket_timeout=5)
        _redis_client.ping()
        # RQ stores pickled/binary job payloads. Sharing the application's
        # decode_responses=True client makes failed-job inspection attempt UTF-8
        # decoding and can strand per-user export leases.
        # The API never blocks on a queue pop, so a bounded read timeout is safe
        # and turns a stalled Redis into a fast error instead of a hung request.
        _rq_redis_client = connect_redis(REDIS_URL, socket_timeout=15)
        _rq_redis_client.ping()
        _json_log("info", "redis_connected")
    except Exception as e:
        _redis_client = None
        _rq_redis_client = None
        _json_log("warning", "redis_connection_failed", error=str(e))

if _IS_PRODUCTION and _redis_client is None:
    raise RuntimeError(
        "Redis is required in production (ENV=production) for cross-instance rate "
        "limiting and payment idempotency. Set REDIS_URL to a reachable Redis instance."
    )

if _IS_PRODUCTION and not DURABLE_QUEUE_ENABLED:
    raise RuntimeError("ENABLE_DURABLE_QUEUE must be 1 in production.")

_export_queue = None
_export_queues = {}
if DURABLE_QUEUE_ENABLED and _rq_redis_client is not None and RQ_AVAILABLE:
    try:
        configured_render_queues = list(RENDER_QUEUE_NAMES)
        if GPU_RENDER_ENABLED:
            configured_render_queues.append(GPU_EXPORT_QUEUE_NAME)
        _export_queues = {
            queue_name: Queue(queue_name, connection=_rq_redis_client, default_timeout=30 * 60)
            for queue_name in configured_render_queues
        }
        _export_queue = _export_queues[EXPORT_QUEUE_NAME]
        _json_log("info", "durable_queue_enabled", queues=list(_export_queues))
    except Exception as e:
        _export_queue = None
        _export_queues = {}
        _json_log("warning", "durable_queue_init_failed", error=str(e))

if _IS_PRODUCTION and _export_queue is None:
    raise RuntimeError("The durable export queue is required in production; refusing API-local rendering.")

_transcription_queue = _export_queue
if _export_queue is not None and TRANSCRIPTION_QUEUE_NAME != EXPORT_QUEUE_NAME:
    _transcription_queue = Queue(TRANSCRIPTION_QUEUE_NAME, connection=_rq_redis_client, default_timeout=30 * 60)
_media_scan_queue = _transcription_queue
if _export_queue is not None and MEDIA_SCAN_QUEUE_NAME not in {EXPORT_QUEUE_NAME, TRANSCRIPTION_QUEUE_NAME}:
    _media_scan_queue = Queue(MEDIA_SCAN_QUEUE_NAME, connection=_rq_redis_client, default_timeout=20 * 60)


async def startup_event():
    global _telemetry_flush_task, _simple_janitor_task, _transcription_dispatch_task, _queue_metrics_task
    if not RUN_API_BACKGROUND_TASKS:
        _json_log("info", "api_background_tasks_disabled")
        if os.environ.get("RAILWAY_PROJECT_ID"):
            disconnect_idle_redis_clients(_redis_client, _rq_redis_client)
        return
    _telemetry_flush_task = asyncio.create_task(_telemetry_flush_loop())
    if _IS_PRODUCTION:
        _transcription_dispatch_task = asyncio.create_task(_transcription_dispatch_loop())
    if QUEUE_METRICS_ENABLED:
        _queue_metrics_task = asyncio.create_task(_queue_metrics_loop())
    if os.environ.get("RELEASE_ENVIRONMENT") == "staging":
        # Current staging shares Firestore: it must not reconcile live payments
        # or run global customer-media cleanup with staging credentials.
        return
    if scheduler is not None:
        scheduler.add_job(scheduled_janitor_job, 'interval', minutes=15)
        scheduler.add_job(scheduled_payment_reconciliation_job, 'interval', minutes=max(PAYMENT_RECONCILE_INTERVAL_MINUTES, 5))
        scheduler.start()
        _json_log("info", "scheduler_started", janitor_minutes=15,
                  payment_reconcile_minutes=max(PAYMENT_RECONCILE_INTERVAL_MINUTES, 5))
    else:
        _json_log("warning", "janitor_fallback_loop", reason="apscheduler not installed")
        _simple_janitor_task = asyncio.create_task(_simple_janitor_loop())


async def shutdown_event():
    global _telemetry_flush_task, _simple_janitor_task, _transcription_dispatch_task, _queue_metrics_task
    if _queue_metrics_task is not None:
        _queue_metrics_task.cancel()
        _queue_metrics_task = None
    if _transcription_dispatch_task is not None:
        _transcription_dispatch_task.cancel()
        _transcription_dispatch_task = None
    if _telemetry_flush_task is not None:
        _telemetry_flush_task.cancel()
        _telemetry_flush_task = None
    if _simple_janitor_task is not None:
        _simple_janitor_task.cancel()
        _simple_janitor_task = None
    if scheduler is not None and scheduler.running:
        scheduler.shutdown(wait=False)
    await asyncio.to_thread(_flush_telemetry)

_maintenance_jobs = create_maintenance_jobs(sys.modules[__name__])
cleanup_local_media_artifacts = _maintenance_jobs.cleanup_local_media_artifacts
advanced_janitor_job = _maintenance_jobs.advanced_janitor_job
_advanced_janitor_once = _maintenance_jobs._advanced_janitor_once
_claim_scheduled_job = _maintenance_jobs._claim_scheduled_job
_release_scheduled_job = _maintenance_jobs._release_scheduled_job
scheduled_janitor_job = _maintenance_jobs.scheduled_janitor_job
scheduled_payment_reconciliation_job = _maintenance_jobs.scheduled_payment_reconciliation_job
_publish_queue_metrics_once = _maintenance_jobs._publish_queue_metrics_once
_queue_metrics_loop = _maintenance_jobs._queue_metrics_loop
_simple_janitor_loop = _maintenance_jobs._simple_janitor_loop

# CORS — set ALLOWED_ORIGINS env var (comma-separated) in production
# Falls back to localhost only; wildcard is never used
_origins_env = os.environ.get("ALLOWED_ORIGINS", "")
ALLOWED_ORIGINS = [o.strip() for o in _origins_env.split(",") if o.strip()] if _origins_env else [
    "http://localhost:3000",
    "http://localhost:5000",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5000",
]
if _IS_PRODUCTION:
    if not _origins_env:
        raise RuntimeError("ALLOWED_ORIGINS must be set in production (ENV=production).")
    if any(origin == "*" for origin in ALLOWED_ORIGINS):
        raise RuntimeError("Wildcard CORS origins are not allowed in production.")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
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

# Simple in-memory rate limiters (ip -> list of timestamps)
_upload_rate: Dict[str, list] = {}
app.add_middleware(UploadBodyLimitMiddleware)

# Authenticated users keep a strict per-account limit, while the shared public
# address gets a much wider abuse ceiling. Mobile carriers, universities,
# offices, and public Wi-Fi commonly place many unrelated users behind one IP.
UPLOAD_USER_RATE_LIMIT = 10
UPLOAD_SHARED_NETWORK_RATE_LIMIT = 200
UPLOAD_RATE_WINDOW = 3600  # 1 hour

_signup_rate: Dict[str, list] = {}
SIGNUP_SHARED_NETWORK_RATE_LIMIT = 100
SIGNUP_USER_RATE_LIMIT = 3  # protects retries/automation targeting one identity

_payment_rate: Dict[str, list] = {}
PAYMENT_RATE_LIMIT = 10   # max payment attempts per hour per IP

_promo_rate: Dict[str, list] = {}
PROMO_RATE_LIMIT = 5      # max promo redemptions per hour per IP

_translate_rate: Dict[str, list] = {}
TRANSLATE_USER_RATE_LIMIT = 20
TRANSLATE_SHARED_NETWORK_RATE_LIMIT = 300

_process_rate: Dict[str, list] = {}
PROCESS_USER_RATE_LIMIT = 20
PROCESS_SHARED_NETWORK_RATE_LIMIT = 300

_detect_language_rate: Dict[str, list] = {}
DETECT_LANGUAGE_USER_RATE_LIMIT = 10
DETECT_LANGUAGE_SHARED_NETWORK_RATE_LIMIT = 200

_analytics_rate: Dict[str, list] = {}
ANALYTICS_RATE_LIMIT = 120  # max client analytics events per hour per IP

_support_rate: Dict[str, list] = {}
SUPPORT_RATE_LIMIT = 5  # max public support submissions per hour per IP

# Counters that the release gate (`_build_slo_snapshot`) and failure-ratio
# alerting read as ground truth. The public /api/analytics/track endpoint must
# never let a client write these — otherwise an unauthenticated caller could
# inflate failure counters to trip the readiness gate or fire ops alerts.
RESERVED_SERVER_ANALYTICS_EVENTS = frozenset({
    "account_signup",
    "account_activation",
    "upload_success",
    "export_success",
    "export_cancelled",
    "export_failed_http",
    "export_failed_exception",
    "process_success",
    "process_failed",
    "payment_success",
    "payment_failed",
    "support_request_created",
})

PLAN_EXPORT_PRESETS = {
    "free": {"max_quality": "1080p", "fps_options": {24, 30}},
    "starter": {"max_quality": "1080p", "fps_options": {24, 30}},
    "starter_yearly": {"max_quality": "1080p", "fps_options": {24, 30}},
    "creator": {"max_quality": "4k", "fps_options": {24, 30}},
    "creator_yearly": {"max_quality": "4k", "fps_options": {24, 30}},
    "pro": {"max_quality": "4k", "fps_options": {24, 30, 60}},
    "pro_yearly": {"max_quality": "4k", "fps_options": {24, 30, 60}},
}
QUALITY_RANK = {"720p": 1, "1080p": 2, "4k": 3}

_analytics_counters: Dict[str, int] = {}
_analytics_daily_counters: Dict[str, Dict[str, int]] = {}
_analytics_last_alert_ts: Dict[str, float] = {}
_route_latency_samples: Dict[str, list] = {}
_operational_metric_samples: Dict[str, list] = {}
_payment_idempotency: Dict[str, Dict[str, Any]] = {}
_tenant_memberships: Dict[str, set] = {}
_telemetry_buffer = deque()
_telemetry_lock = threading.Lock()
_telemetry_flush_task = None
_simple_janitor_task = None
_transcription_dispatch_task = None
_queue_metrics_task = None


_provider_breakers: Dict[str, CircuitBreaker] = {
    "openai_translate": CircuitBreaker(failure_threshold=4, cooldown_seconds=120),
    "openai_detect_language": CircuitBreaker(failure_threshold=4, cooldown_seconds=120),
}


_request_security = create_request_security(sys.modules[__name__])
_apply_security_headers = _request_security._apply_security_headers
_app_check_required = _request_security._app_check_required
_verify_firebase_app_check_request = _request_security._verify_firebase_app_check_request
_tenant_id_from_token = _request_security._tenant_id_from_token
_is_explicit_dev_auth_token = _request_security._is_explicit_dev_auth_token
_assert_account_not_deleting = _request_security._assert_account_not_deleting
_create_account_if_active = _request_security._create_account_if_active
_authenticate_media_request = _request_security._authenticate_media_request
_authenticate_bearer_request = _request_security._authenticate_bearer_request
_assert_tenant_access = _request_security._assert_tenant_access


# --- Service controls (operator kill switches) -------------------------------
# Durable switches that pause parts of the product without a redeploy. Firestore
# is the source of truth so an operator can also flip them straight from the
# Firebase console when the API itself is unhealthy.
SERVICE_CONTROL_KEYS = (
    "pause_signups",
    "pause_payments",
    "pause_uploads",
    "pause_transcription",
    "pause_exports",
    "maintenance_mode",
)
MAX_UPLOAD_DURATION_CONTROL_KEY = "max_upload_duration_seconds"
GLOBAL_MAX_UPLOAD_DURATION_SECONDS = 180
_RELEASE_ENVIRONMENT = os.environ.get("RELEASE_ENVIRONMENT", "production").strip().lower()
SERVICE_CONTROL_COLLECTION = "ops" if _RELEASE_ENVIRONMENT == "production" else f"ops_{_RELEASE_ENVIRONMENT}"
SERVICE_CONTROL_DOCUMENT = "service_controls"
SERVICE_CONTROL_CACHE_SECONDS = max(
    0.0, float(os.environ.get("SERVICE_CONTROL_CACHE_SECONDS", "10"))
)
SERVICE_CONTROL_NOTICE_MAX = 280
_service_control_cache: Dict[str, Any] = {"ts": 0.0, "value": {}}

_SERVICE_CONTROL_MESSAGES = {
    "maintenance_mode": "Lekha Captions is under maintenance. Please try again shortly.",
    "pause_signups": "New sign-ups are paused right now. Please try again shortly.",
    "pause_payments": "Payments are paused right now. You have not been charged — please try again shortly.",
    "pause_uploads": "Uploads are paused right now. Please try again shortly.",
    "pause_transcription": "Transcription is paused right now. Your upload is safe — please try again shortly.",
    "pause_exports": "Exports are paused right now. Your captions are saved — please try again shortly.",
}


_operator_controls = create_operator_controls(sys.modules[__name__])
_validate_feature_flag_safety = _operator_controls._validate_feature_flag_safety
_default_service_controls = _operator_controls._default_service_controls
_read_service_controls = _operator_controls._read_service_controls
_assert_service_available = _operator_controls._assert_service_available
_scan_upload_for_threat = _operator_controls._scan_upload_for_threat
_is_content_safety_blocked = _operator_controls._is_content_safety_blocked


_RATE_LIMIT_NAMESPACES = (
    (_upload_rate, "upload"),
    (_signup_rate, "signup"),
    (_payment_rate, "payment"),
    (_promo_rate, "promo"),
    (_translate_rate, "translate"),
    (_process_rate, "process"),
    (_detect_language_rate, "detect-language"),
    (_analytics_rate, "analytics"),
    (_support_rate, "support"),
)


RATE_ADMISSION_SCRIPT = """
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, now - window)
local count = redis.call('ZCARD', KEYS[1])
if count >= limit then
    local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
    local retry = math.max(1, math.ceil(window - (now - tonumber(oldest[2]))))
    return {0, retry, 0}
end
redis.call('ZADD', KEYS[1], now, ARGV[4])
redis.call('EXPIRE', KEYS[1], window + 5)
return {1, 0, limit - count - 1}
"""


_request_guards = create_request_guards(sys.modules[__name__])
_idem_get = _request_guards._idem_get
_idem_claim = _request_guards._idem_claim
_idem_set = _request_guards._idem_set
_idem_delete = _request_guards._idem_delete
_upload_idem_key = _request_guards._upload_idem_key
_upload_idem_get = _request_guards._upload_idem_get
_upload_idem_set = _request_guards._upload_idem_set
_payment_idem_get = _request_guards._payment_idem_get
_payment_idem_set = _request_guards._payment_idem_set
_payment_idem_claim = _request_guards._payment_idem_claim
_payment_idem_delete = _request_guards._payment_idem_delete
_require_payment_idempotency = _request_guards._require_payment_idempotency
_rate_limit_namespace = _request_guards._rate_limit_namespace
_rate_limit_redis_key = _request_guards._rate_limit_redis_key
_client_rate_key = _request_guards._client_rate_key
_check_rate = _request_guards._check_rate
_record_export_failure = _request_guards._record_export_failure
_get_recent_export_failures = _request_guards._get_recent_export_failures
_acquire_export_slot = _request_guards._acquire_export_slot
_release_export_slot = _request_guards._release_export_slot
_acquire_process_slot = _request_guards._acquire_process_slot
_release_process_slot = _request_guards._release_process_slot
_apply_rate_headers = _request_guards._apply_rate_headers


# Large fields kept only in the durable Firestore record when Firestore exists.
# Redis job records are read on every status poll and rewritten on every state
# transition, and Redis has no eviction headroom: a full editor snapshot per
# export for seven days grew Redis without bound. Replay reads Firestore.
_DURABLE_ONLY_EXPORT_JOB_FIELDS = ("request_snapshot",)


# Allowed upload extensions (module-level constant — not rebuilt per request)
ALLOWED_EXTENSIONS = {'mp4', 'mov', 'avi', 'mkv', 'webm', 'mp3', 'wav', 'm4a', 'aac'}
MAX_UPLOAD_BYTES = 500 * 1024 * 1024  # 500 MiB = 524,288,000 bytes
# A configured GCS deployment must not let browser clients bypass direct upload
# by sending a large multipart body through the control API.
MAX_PROXY_UPLOAD_BYTES = 8 * 1024 * 1024 if os.environ.get("GCS_MEDIA_BUCKET") else MAX_UPLOAD_BYTES
ALLOWED_CONTENT_PREFIXES = ("video/", "audio/")


_media_records = create_media_records(sys.modules[__name__])
_validate_file_id = _media_records._validate_file_id
_safe_find_upload = _media_records._safe_find_upload
_load_upload_metadata = _media_records._load_upload_metadata
_remember_source_duration = _media_records._remember_source_duration
_source_duration_hint = _media_records._source_duration_hint
_remember_upload_owner = _media_records._remember_upload_owner
_update_upload_metadata = _media_records._update_upload_metadata
_mark_upload_security_state = _media_records._mark_upload_security_state
_assert_upload_clean = _media_records._assert_upload_clean
_ensure_upload_clean = _media_records._ensure_upload_clean
_source_media_identity = _media_records._source_media_identity
_assert_upload_owner = _media_records._assert_upload_owner
_media_token_signature = _media_records._media_token_signature
_create_media_token = _media_records._create_media_token
_verify_media_token = _media_records._verify_media_token
_signed_upload_url = _media_records._signed_upload_url
_signed_export_url = _media_records._signed_export_url
_compute_media_hash = _media_records._compute_media_hash
_upload_security_service = _media_records._upload_security_service
_build_process_cache_path = _media_records._build_process_cache_path
_build_parity_signature = _media_records._build_parity_signature
_validate_media_signature = _media_records._validate_media_signature
_probe_media = _media_records._probe_media


AI_DAILY_LIMITS = {
    "free": {"process": 3, "translate": 5, "detect_language": 3},
    "starter": {"process": 10, "translate": 20, "detect_language": 10},
    "creator": {"process": 30, "translate": 60, "detect_language": 30},
    "pro": {"process": 100, "translate": 200, "detect_language": 100},
}


# Free accounts get a fixed number of transcriptions for the life of the
# account, not a daily refill: a trial, not a free tier that costs money forever.
FREE_LIFETIME_TRANSCRIPTIONS = int(FREE_PLAN.get("lifetime_transcriptions", 3) or 3)


_entitlements = create_entitlements(sys.modules[__name__])
_normalize_tier_name = _entitlements._normalize_tier_name
_normalize_free_credit_balance = _entitlements._normalize_free_credit_balance
_subscription_is_expired = _entitlements._subscription_is_expired
_effective_subscription_tier = _entitlements._effective_subscription_tier
_lookup_subscription_tier = _entitlements._lookup_subscription_tier
_max_video_seconds_for_tier = _entitlements._max_video_seconds_for_tier
_reserve_system_ai_quota = _entitlements._reserve_system_ai_quota
_reserve_ai_quota = _entitlements._reserve_ai_quota
_read_system_ai_usage = _entitlements._read_system_ai_usage
_release_system_ai_quota = _entitlements._release_system_ai_quota
_release_ai_quota = _entitlements._release_ai_quota
_resolve_export_preset = _entitlements._resolve_export_preset

# Local paths are scratch space only. Resolve them from the project root rather
# than the process cwd so web and worker commands behave consistently.
MEDIA_SCRATCH_ROOT = os.path.abspath(os.environ.get("MEDIA_SCRATCH_DIR", root_dir))
UPLOAD_DIR = os.path.join(MEDIA_SCRATCH_ROOT, "uploads")
EXPORT_DIR = os.path.join(MEDIA_SCRATCH_ROOT, "exports")
FONTS_DIR = os.path.join(MEDIA_SCRATCH_ROOT, "flat_fonts")
CACHE_DIR = os.path.join(MEDIA_SCRATCH_ROOT, "cache")
TRANSCRIPTION_CACHE_DIR = os.path.join(CACHE_DIR, "transcriptions")
RENDER_CACHE_DIR = os.path.join(CACHE_DIR, "renders")
DEAD_LETTER_DIR = os.path.join(CACHE_DIR, "dead_letter")
EXPORT_RENDERER_VERSION = "2026-09-27-project-framing-bilingual-v47"

for d in [UPLOAD_DIR, EXPORT_DIR, FONTS_DIR, CACHE_DIR, TRANSCRIPTION_CACHE_DIR, RENDER_CACHE_DIR, DEAD_LETTER_DIR]:
    os.makedirs(d, exist_ok=True)

# This initializes the processor which will download the font automatically
processor = VideoProcessor(FONTS_DIR)


app.include_router(create_project_router(
    _authenticate_media_request,
    get_db,
    _validate_file_id,
    _assert_upload_owner,
))


_api_models = create_api_models(sys.modules[__name__])
CaptionItem = _api_models.CaptionItem
ExportRequest = _api_models.ExportRequest
BatchExportRequest = _api_models.BatchExportRequest
CreateOrderRequest = _api_models.CreateOrderRequest
VerifyPaymentRequest = _api_models.VerifyPaymentRequest
ReconcilePaymentsRequest = _api_models.ReconcilePaymentsRequest
AdminRecoveryRequest = _api_models.AdminRecoveryRequest
AdminAlertTestRequest = _api_models.AdminAlertTestRequest
ServiceControlsRequest = _api_models.ServiceControlsRequest
TenantBackfillRequest = _api_models.TenantBackfillRequest
SupportRequest = _api_models.SupportRequest
ProcessRequest = _api_models.ProcessRequest
MediaUrlRequest = _api_models.MediaUrlRequest
TranslateRequest = _api_models.TranslateRequest


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


EXPORT_SLOT_WAIT_INTERVAL_SECONDS = 15
EXPORT_SLOT_WAIT_MAX_ATTEMPTS = max(1, EXPORT_SLOT_TTL_SECONDS // EXPORT_SLOT_WAIT_INTERVAL_SECONDS)


_export_job_core = create_export_jobs(sys.modules[__name__])
_persist_export_job = _export_job_core._persist_export_job
_load_export_job = _export_job_core._load_export_job
_evaluate_export_policy = _export_job_core._evaluate_export_policy
_record_export_usage = _export_job_core._record_export_usage
_load_recorded_export_result = _export_job_core._load_recorded_export_result
_set_export_job = _export_job_core._set_export_job
_refresh_completed_export_payload = _export_job_core._refresh_completed_export_payload
_normalize_export_captions_for_media = _export_job_core._normalize_export_captions_for_media
_write_dead_letter = _export_job_core._write_dead_letter
_strip_client_render_hints = _export_job_core._strip_client_render_hints
_sanitize_export_request_payload = _export_job_core._sanitize_export_request_payload
_write_last_export_request_debug = _export_job_core._write_last_export_request_debug
_extract_bearer_token = _export_job_core._extract_bearer_token
_require_export_job_access = _export_job_core._require_export_job_access
_mark_export_processing = _export_job_core._mark_export_processing
_process_export_job_core = _export_job_core._process_export_job_core
_export_slot_wait_retry = _export_job_core._export_slot_wait_retry


def recover_interrupted_export_retry(export_job_id: str):
    """Called only after RQ confirms a failed or abandoned execution will retry."""
    record = _load_export_job(export_job_id) or {}
    status = record.get("status")
    if status not in {"starting", "processing", "finalizing"}:
        return
    if status == "finalizing" and _load_recorded_export_result(
        record.get("uid", ""), export_job_id, record.get("file_id", "")
    ):
        # The retry recovers this paid result without rendering or charging again.
        return
    try:
        _set_export_job(export_job_id, "retrying", expected_status=status,
                        error="Worker interrupted; export will retry")
    except InvalidJobTransition:
        # A concurrent completion/cancellation remains authoritative.
        return


def run_export_job_task(
    export_job_id: str,
    req_payload: Dict[str, Any],
    uid: str,
    idempotency_key: str = "",
    idempotency_request_hash: str = "",
):
    rid = f"worker-{export_job_id[:8]}"
    slot_acquired = False
    # RQ has removed the job ID from the pending list before invoking us. Keep
    # the atomic admission ledger aligned with pending work, not active work.
    _release_export_pending_work(export_job_id)
    existing_job = _load_export_job(export_job_id) or {}
    if existing_job.get("status") == "completed":
        return existing_job.get("payload") or {}
    try:
        if existing_job.get("status") == "finalizing":
            _assert_account_not_deleting(uid)
            recorded = _load_recorded_export_result(uid, export_job_id, str(req_payload.get("file_id") or ""))
            if recorded:
                _set_export_job(export_job_id, "completed", payload=recorded,
                                completed_at=time.time(), recovered_from_usage=True)
                if idempotency_key:
                    _idem_set(idempotency_key, {"status": "completed", "ts": time.time(), "payload": recorded,
                                               "request_hash": idempotency_request_hash, "job_id": export_job_id})
                return recorded
        _set_export_job(export_job_id, "starting", worker_release=APP_RELEASE)
    except InvalidJobTransition:
        current = _load_export_job(export_job_id) or {}
        return {"success": False, "status": current.get("status"), "export_job_id": export_job_id}
    try:
        if (existing_job.get("status") or "").lower() == "cancelled":
            _json_log("info", "cancelled_export_skipped", job_id=export_job_id, uid=uid)
            return {
                "success": False,
                "status": "cancelled",
                "export_job_id": export_job_id,
            }
        slot_acquired = _acquire_export_slot(uid, export_job_id)
        if not slot_acquired:
            wait_retry = _export_slot_wait_retry()
            if wait_retry is not None:
                # Batch items for one account share its single export slot. Waiting
                # for a sibling render is not a failure: reschedule without using
                # the job's failure retries (a 10-item batch outlived them) and
                # without dead-lettering every poll.
                _set_export_job(export_job_id, "retrying", error=None)
                _json_log("info", "export_waiting_for_account_slot", job_id=export_job_id)
                return wait_retry
            raise RuntimeError("Another export currently owns this account's export slot")
        req = ExportRequest(**req_payload)
        payload = asyncio.run(_process_export_job_core(req, uid, rid, export_job_id))
        if idempotency_key:
            _idem_set(idempotency_key, {
                "status": "completed",
                "ts": time.time(),
                "payload": payload,
                "request_hash": idempotency_request_hash,
                "job_id": export_job_id,
            })
        return payload
    except Exception as e:
        # Completion storage/telemetry may fail AFTER the atomic debit. In that
        # case the export succeeded: preserve its idempotency result and do not
        # turn a paid result into a fresh render on the next submission.
        usage_recovery_unknown = False
        try:
            recorded = _load_recorded_export_result(uid, export_job_id, str(req_payload.get("file_id") or ""))
        except Exception as recovery_error:
            recorded = None
            usage_recovery_unknown = True
            _json_log("warning", "export_usage_recovery_unavailable", job_id=export_job_id,
                      error=type(recovery_error).__name__)
        if recorded:
            try:
                current = _load_export_job(export_job_id) or {}
                if current.get("status") == "finalizing":
                    _set_export_job(export_job_id, "completed", payload=recorded,
                                    completed_at=time.time(), recovered_from_usage=True)
                if idempotency_key:
                    _idem_set(idempotency_key, {"status": "completed", "ts": time.time(), "payload": recorded,
                                               "request_hash": idempotency_request_hash, "job_id": export_job_id})
            except Exception as recovery_error:
                _json_log("warning", "export_completion_recovery_pending", job_id=export_job_id,
                          error=type(recovery_error).__name__)
            return recorded
        try:
            from rq import get_current_job
            rq_job = get_current_job()
            retryable = not isinstance(e, HTTPException) or e.status_code >= 500
            retry_pending = bool(rq_job and rq_job.retries_left and retryable)
            if rq_job and not retryable:
                rq_job.retries_left = 0
                rq_job.save()
            _set_export_job(export_job_id, "retrying" if retry_pending else "failed",
                            failed_at=time.time(), error="Export failed. Please retry or contact support.")
        except Exception as state_error:
            _json_log(
                "error",
                "export_failure_state_persist_failed",
                job_id=export_job_id,
                error=str(state_error),
            )
        failed_job = _load_export_job(export_job_id) or {}
        entered_at = float(failed_job.get("queue_entered_at") or time.time())
        _json_log(
            "warning", "export_observation", job_id=export_job_id,
            status="retrying" if locals().get("retry_pending", False) else "failed",
            queue_wait_ms=failed_job.get("queue_wait_ms"),
            elapsed_ms=max(0, int((time.time() - entered_at) * 1000)),
        )
        if idempotency_key and not locals().get("retry_pending", False) and not usage_recovery_unknown:
            _idem_delete(idempotency_key)
        _write_dead_letter(
            export_job_id,
            str(e),
            {"req_payload": _sanitize_export_request_payload(req_payload), "uid": uid},
        )
        raise
    finally:
        if slot_acquired:
            _release_export_slot(uid, export_job_id)

# Google Fonts Cache Map
_cached_google_fonts = None

@app.get("/api/fonts")
def get_google_fonts():
    global _cached_google_fonts
    if _cached_google_fonts is not None:
        return {"fonts": _cached_google_fonts}

    try:
        req = urllib.request.Request(
            'https://fonts.google.com/metadata/fonts',
            headers={'User-Agent': 'Mozilla/5.0'}
        )
        with _urlopen_https_only(req, timeout=10) as res:
            raw_data = res.read().decode('utf-8')
            # The API often prefixes with )]}' for security
            if raw_data.startswith(")]}'"):
                raw_data = raw_data.split('\n', 1)[1]
            data = json.loads(raw_data)

            fonts = []
            for family in data.get('familyMetadataList', []):
                fonts.append({"family": family.get("family")})

            _cached_google_fonts = fonts
            return {"fonts": fonts}
    except Exception as e:
        _json_log("warning", "google_fonts_fetch_failed", error=str(e))
        return {"fonts": []}


DIRECT_UPLOAD_MAX_ACTIVE = max(1, int(os.environ.get("DIRECT_UPLOAD_MAX_ACTIVE", "2")))
DIRECT_UPLOAD_MAX_HOURLY = max(1, int(os.environ.get("DIRECT_UPLOAD_MAX_HOURLY", "12")))
DIRECT_UPLOAD_SHARED_NETWORK_HOURLY = max(
    100, int(os.environ.get("DIRECT_UPLOAD_SHARED_NETWORK_HOURLY", "200")),
)
DIRECT_UPLOAD_MAX_OUTSTANDING_BYTES = max(
    MAX_UPLOAD_BYTES,
    int(os.environ.get("DIRECT_UPLOAD_MAX_OUTSTANDING_BYTES", str(1024 * 1024 * 1024))),
)


_upload_dispatch = create_upload_dispatch(sys.modules[__name__])
_cleanup_incomplete_upload = _upload_dispatch._cleanup_incomplete_upload
_reserve_direct_upload_slot = _upload_dispatch._reserve_direct_upload_slot
_limit_direct_upload_network = _upload_dispatch._limit_direct_upload_network
_release_direct_upload_slot = _upload_dispatch._release_direct_upload_slot
_schedule_media_scan = _upload_dispatch._schedule_media_scan
_transcription_dispatch_loop = _upload_dispatch._transcription_dispatch_loop
_dispatch_media_scans_once = _upload_dispatch._dispatch_media_scans_once
_require_scheduler_secret = _upload_dispatch._require_scheduler_secret

app.include_router(create_direct_upload_router(
    authenticate=_authenticate_media_request,
    extract_token=_extract_bearer_token,
    assert_service_available=_assert_service_available,
    allowed_extensions=ALLOWED_EXTENSIONS,
    allowed_content_prefixes=ALLOWED_CONTENT_PREFIXES,
    allowed_origins=ALLOWED_ORIGINS,
    max_upload_bytes=MAX_UPLOAD_BYTES,
    create_session=create_resumable_source_upload,
    finalize_session=finalize_resumable_source_upload,
    remember_owner=_remember_upload_owner,
    signed_upload_url=_signed_upload_url,
    audit_action=_audit_action,
    reserve_slot=_reserve_direct_upload_slot,
    release_slot=_release_direct_upload_slot,
    cancel_session=cancel_resumable_source_upload,
    resume_session=resume_resumable_source_upload,
    assert_account_active=_assert_account_not_deleting,
    rate_limit_network=_limit_direct_upload_network,
    enqueue_scan=_schedule_media_scan,
    sign_parts=sign_resumable_upload_parts,
))
app.include_router(create_editor_preferences_router(
    _authenticate_media_request,
    get_db,
))


_upload_api = create_upload_router(sys.modules[__name__])
app.include_router(_upload_api.router)
upload_video = _upload_api.upload_video

_processing_api = create_processing_router(sys.modules[__name__])
app.include_router(_processing_api.router)
process_video = _processing_api.process_video
run_transcription_job_task = _processing_api.run_transcription_job_task
_mark_account_activated = _processing_api._mark_account_activated
_process_video_inline = _processing_api._process_video_inline




app.include_router(create_maintenance_router(
    authorize=_require_scheduler_secret,
    dispatch_transcription=lambda: TranscriptionJobs(get_db()).dispatch(_transcription_queue),
    dispatch_media_scans=_dispatch_media_scans_once,
    run_janitor=scheduled_janitor_job,
    publish_queue_metrics=_publish_queue_metrics_once,
    reconcile_payments=scheduled_payment_reconciliation_job,
))


def run_media_scan_job_task(uid: str, file_id: str):
    """Materialize and scan one upload; duplicate deliveries are harmless."""
    _assert_account_not_deleting(uid)
    _assert_upload_owner(file_id, uid)
    metadata = _load_upload_metadata(file_id)
    if str(metadata.get("upload_state") or "").lower() in {"clean", "rejected"}:
        MediaScanJobs(get_db()).finish(file_id)
        return {"status": str(metadata.get("upload_state"))}
    input_path = _safe_find_upload(file_id)
    if not input_path:
        raise RuntimeError("Uploaded media could not be materialized for scanning")
    try:
        result = _ensure_upload_clean(file_id, uid, input_path)
        MediaScanJobs(get_db()).finish(file_id)
        return {"status": str(result.get("upload_state") or "clean")}
    except HTTPException:
        # A malware rejection is terminal and already persisted by
        # _ensure_upload_clean. Scanner/runtime failures stay in the outbox.
        current = _load_upload_metadata(file_id)
        if str(current.get("upload_state") or "").lower() == "rejected":
            MediaScanJobs(get_db()).finish(file_id)
            return {"status": "rejected"}
        raise


_export_api = create_export_router(sys.modules[__name__])
app.include_router(_export_api.router)
_render_queue_for = _export_api._render_queue_for
_queue_for_export_job_record = _export_api._queue_for_export_job_record
_enqueue_export_job = _export_api._enqueue_export_job
_release_export_pending_work = _export_api._release_export_pending_work
export_video = _export_api.export_video
create_export_batch = _export_api.create_export_batch
get_export_batch = _export_api.get_export_batch
_reconcile_export_job = _export_api._reconcile_export_job
_active_workers_for_queue = _export_api._active_workers_for_queue
_export_queue_prediction = _export_api._export_queue_prediction
export_status = _export_api.export_status
export_result = _export_api.export_result
export_cancel = _export_api.export_cancel
export_replay = _export_api.export_replay


_system_api = create_system_router(sys.modules[__name__])
app.include_router(_system_api.router)
analytics_track = _system_api.analytics_track
create_support_request = _system_api.create_support_request
api_version = _system_api.api_version
api_health = _system_api.api_health
api_version_v1 = _system_api.api_version_v1
_runtime_dependency_snapshot = _system_api._runtime_dependency_snapshot
slo_status = _system_api.slo_status
readiness = _system_api.readiness
feature_flags = _system_api.feature_flags
service_status = _system_api.service_status
admin_service_controls = _system_api.admin_service_controls


_dependency_snapshot_cache: Dict[str, Any] = {"checked_at": 0.0, "value": None}
_dependency_snapshot_lock = threading.Lock()


_billing = create_billing_service(sys.modules[__name__])
app.include_router(_billing.router)
_resolve_plan_from_amount_currency = _billing._resolve_plan_from_amount_currency
_topup_timestamp_epoch = _billing._topup_timestamp_epoch
_recent_topup_timestamps = _billing._recent_topup_timestamps
_active_topup_reservations = _billing._active_topup_reservations
_topup_purchase_limit = _billing._topup_purchase_limit
_assert_topup_purchase_available = _billing._assert_topup_purchase_available
_reserve_topup_order_slot = _billing._reserve_topup_order_slot
_release_topup_order_slot = _billing._release_topup_order_slot
_fetch_bound_order_context = _billing._fetch_bound_order_context
_can_trigger_reconcile = _billing._can_trigger_reconcile
reconcile_payments_once = _billing.reconcile_payments_once
payment_reconciliation_job = _billing.payment_reconciliation_job
_grant_payment_transactionally = _billing._grant_payment_transactionally
_apply_successful_payment = _billing._apply_successful_payment
_apply_refund_webhook_event = _billing._apply_refund_webhook_event


TOPUP_PURCHASE_WINDOW_SECONDS = 30 * 24 * 60 * 60
TOPUP_ORDER_RESERVATION_SECONDS = 2 * 60 * 60


def _decoded_token_is_admin(decoded: Optional[Dict[str, Any]]) -> bool:
    if not decoded:
        return False
    if decoded.get("admin") is True:
        return True
    allowed_admins = {
        e.strip().lower()
        for e in os.environ.get("ADMIN_EMAILS", "").split(",")
        if e.strip()
    }
    return bool(
        decoded.get("email_verified") is True
        and allowed_admins
        and decoded.get("email", "").lower() in allowed_admins
    )

def _is_admin_token(id_token: str = "", request: Optional[Request] = None) -> bool:
    token = (id_token or "").strip()
    if not token and request is not None:
        token = request.headers.get("authorization", "").replace("Bearer ", "").strip()
    if not token:
        return False
    decoded = verify_token(token)
    if not decoded:
        return False
    return _decoded_token_is_admin(decoded)


app.include_router(create_cost_reconciliation_router(_is_admin_token, get_db))
app.include_router(create_notification_router(_authenticate_bearer_request, get_db))
app.include_router(create_public_api_router(
    authenticate_request=_authenticate_bearer_request,
    get_database=get_db,
    list_account_projects=list_projects,
    read_account_project=read_draft,
    load_export_job=_load_export_job,
))
app.include_router(create_workspace_router(
    authenticate_request=_authenticate_bearer_request,
    get_database=get_db,
    assert_upload_owner=_assert_upload_owner,
    validate_file_id=_validate_file_id,
    find_upload=_safe_find_upload,
    signed_upload_url=_signed_upload_url,
))


_provider_admin_api = create_provider_admin_router(sys.modules[__name__])
app.include_router(_provider_admin_api.router)
provider_health = _provider_admin_api.provider_health
app.include_router(create_analytics_router(
    is_admin=_is_admin_token,
    utcnow=_utcnow,
    get_database=get_db,
    read_counters=_read_daily_analytics_counters,
    read_latency_samples=_read_daily_latency_samples,
    read_metric_samples=_read_operational_metric_samples,
    alert_failure_ratio=_maybe_alert_failure_ratio,
    percentile_95=_p95,
))


# --- RAZORPAY SUBSCRIPTION ENDPOINTS ---

_payments = create_payments_router(sys.modules[__name__])
app.include_router(_payments.router)
create_order = _payments.create_order
verify_payment = _payments.verify_payment
razorpay_webhook = _payments.razorpay_webhook
reconcile_payments = _payments.reconcile_payments


_admin_api = create_admin_router(sys.modules[__name__])
app.include_router(_admin_api.router)
admin_recovery_summary = _admin_api.admin_recovery_summary
admin_test_alerts = _admin_api.admin_test_alerts
admin_tenant_backfill = _admin_api.admin_tenant_backfill


_account_api = create_account_router(sys.modules[__name__])
app.include_router(_account_api.router)
RedeemPromoRequest = _account_api.RedeemPromoRequest
redeem_promo = _account_api.redeem_promo
DeleteFileRequest = _account_api.DeleteFileRequest
AccountDataRequest = _account_api.AccountDataRequest
SyntheticJourneyRequest = _account_api.SyntheticJourneyRequest
authenticated_customer_journey = _account_api.authenticated_customer_journey
AccountExportRequest = _account_api.AccountExportRequest
_delete_user_document_tree = _account_api._delete_user_document_tree
_account_workspace_memberships = _account_api._account_workspace_memberships
_assert_no_owned_workspaces = _account_api._assert_no_owned_workspaces
_delete_top_level_rows_for_account = _account_api._delete_top_level_rows_for_account
_cleanup_account_extensions = _account_api._cleanup_account_extensions
_remove_history_item_transactionally = _account_api._remove_history_item_transactionally
_mark_history_item_deleting_transactionally = _account_api._mark_history_item_deleting_transactionally
account_bootstrap = _account_api.account_bootstrap
account_export = _account_api.account_export
account_delete = _account_api.account_delete


_language_api = create_language_router(sys.modules[__name__])
app.include_router(_language_api.router)
translate_captions = _language_api.translate_captions
DetectLanguageRequest = _language_api.DetectLanguageRequest
detect_language = _language_api.detect_language


_media_api = create_media_router(sys.modules[__name__])
app.include_router(_media_api.router)
delete_user_file = _media_api.delete_user_file
serve_uploaded_media = _media_api.serve_uploaded_media
refresh_uploaded_media_url = _media_api.refresh_uploaded_media_url
serve_exported_media = _media_api.serve_exported_media


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=os.environ.get("BACKEND_HOST", "127.0.0.1"), port=8000)
