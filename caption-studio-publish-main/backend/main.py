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


def _utcnow() -> datetime:
    """Return naive UTC for compatibility with existing persisted timestamp formats."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _json_log(level: str, event: str, **fields):
    record = {
        "timestamp": _utcnow().isoformat() + "Z",
        "level": level.upper(),
        "event": event,
        "service": os.environ.get("SERVICE_ROLE", "api"),
        "environment": os.environ.get("APP_ENV", "unknown"),
        "release": os.environ.get("APP_RELEASE", ""),
        **fields,
    }
    line = json.dumps(record, ensure_ascii=True, default=str)
    if level.lower() in ("error", "warning"):
        _logger.warning(line) if level.lower() == "warning" else _logger.error(line)
    else:
        _logger.info(line)

def _send_alert(text: str):
    _json_log("warning", "ops_alert", text=text)
    if not SLACK_ALERT_WEBHOOK_URL:
        return False
    try:
        payload = {"text": text}
        req = urllib.request.Request(
            SLACK_ALERT_WEBHOOK_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        _urlopen_https_only(req, timeout=5)
        return True
    except Exception as e:
        _json_log("warning", "alert_webhook_failed", error=str(e))
        return False


def _urlopen_https_only(req, timeout: int = 5):
    url = getattr(req, "full_url", str(req))
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != "https":
        raise ValueError("Only https URLs are allowed for outbound requests")
    return urllib.request.urlopen(req, timeout=timeout)  # nosec B310


def _apply_security_headers(response: Response) -> Response:
    response.headers["Content-Security-Policy"] = SECURITY_CSP
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), geolocation=(), microphone=()"
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
    if globals().get("_IS_PRODUCTION", False):
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    rid = _request_id(request)
    request.state.request_id = rid
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
    if upload_slot_uid and not _acquire_process_slot(upload_slot_uid, f"upload:{rid}"):
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
            _release_process_slot(upload_slot_uid, f"upload:{rid}")
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
        _track_latency_sample(request.url.path, elapsed_ms)
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


def _verify_firebase_app_check_request(request: Request, request_id: str = "") -> Optional[JSONResponse]:
    """Require Firebase App Check for browser API traffic in production.

    Webhooks, signed media URLs, health probes, and operator-only endpoints use
    their own authentication and remain callable by non-browser infrastructure.
    """
    if not FIREBASE_APP_CHECK_ENFORCED or request.method.upper() == "OPTIONS":
        return None
    path = request.url.path
    if path in _APP_CHECK_EXEMPT_PATHS or any(path.startswith(prefix) for prefix in _APP_CHECK_EXEMPT_PREFIXES):
        return None
    token = str(request.headers.get("x-firebase-appcheck") or "").strip()
    if not token:
        _json_log("warning", "app_check_missing", path=path, request_id=request_id)
        return JSONResponse(
            status_code=403,
            content={"success": False, "error": "App security verification is required."},
            headers={"X-Request-Id": request_id} if request_id else None,
        )
    try:
        firebase_app_check.verify_token(token)
    except Exception as e:
        _json_log(
            "warning",
            "app_check_rejected",
            path=path,
            request_id=request_id,
            error=type(e).__name__,
        )
        return JSONResponse(
            status_code=403,
            content={"success": False, "error": "App security verification failed."},
            headers={"X-Request-Id": request_id} if request_id else None,
        )
    return None

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

def cleanup_local_media_artifacts(now: float = None) -> Dict[str, int]:
    """Delete expired scratch files for the current API or worker container."""
    now = float(now if now is not None else time.time())
    metrics = {
        "uploads_deleted": 0,
        "exports_deleted": 0,
        "temp_ass_deleted": 0,
        "cache_deleted": 0,
        "errors": 0,
    }

    # Clean upload directory — all files older than 6 hours
    if os.path.exists(UPLOAD_DIR):
        for f in os.listdir(UPLOAD_DIR):
            filepath = os.path.join(UPLOAD_DIR, f)
            if not os.path.isfile(filepath): continue
            try:
                st = os.stat(filepath)
                age = now - max(st.st_mtime, st.st_atime)
                if f.endswith('.srt'):
                    if age > 604800:  # 7 days for SRT
                        os.remove(filepath)
                        metrics["uploads_deleted"] += 1
                elif age > 21600:  # 6 hours for uploads
                    os.remove(filepath)
                    metrics["uploads_deleted"] += 1
            except Exception as e:
                _json_log("warning", "janitor_error", error=str(e), scope="uploads")
                metrics["errors"] += 1

    # Clean stale local exports (should be on Firebase, delete after 30 min)
    if os.path.exists(EXPORT_DIR):
        for f in os.listdir(EXPORT_DIR):
            filepath = os.path.join(EXPORT_DIR, f)
            if not os.path.isfile(filepath): continue
            try:
                age = now - os.stat(filepath).st_mtime
                if age > 1800:  # 30 minutes
                    os.remove(filepath)
                    metrics["exports_deleted"] += 1
            except Exception as e:
                _json_log("warning", "janitor_error", error=str(e), scope="exports")
                metrics["errors"] += 1

    # Cleanup stale temporary ASS artifacts generated during render retries.
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    try:
        from .render_scratch import sweep_render_scratch
    except ImportError:
        from render_scratch import sweep_render_scratch
    metrics["render_scratch_deleted"] = sweep_render_scratch(
        os.path.join(os.path.dirname(backend_dir), ".render_tmp"), now
    )
    for f in os.listdir(backend_dir):
        if not ((f.startswith("_tmp_") and f.endswith(".ass")) or f == "last_export_debug.ass"):
            continue
        filepath = os.path.join(backend_dir, f)
        if not os.path.isfile(filepath):
            continue
        try:
            age = now - os.stat(filepath).st_mtime
            if (f == "last_export_debug.ass" and not DEBUG_MODE_ENABLED) or age > 7200:
                os.remove(filepath)
                metrics["temp_ass_deleted"] += 1
        except Exception as e:
            _json_log("warning", "janitor_error", error=str(e), scope="tmp_ass")
            metrics["errors"] += 1

    # Clean caches/dead letter files older than 7 days.
    for root_dir in [TRANSCRIPTION_CACHE_DIR, RENDER_CACHE_DIR, DEAD_LETTER_DIR]:
        if not os.path.exists(root_dir):
            continue
        for f in os.listdir(root_dir):
            filepath = os.path.join(root_dir, f)
            if not os.path.isfile(filepath):
                continue
            try:
                age = now - os.stat(filepath).st_mtime
                if age > 7 * 86400:
                    os.remove(filepath)
                    metrics["cache_deleted"] += 1
            except Exception as e:
                _json_log("warning", "janitor_error", error=str(e), scope="cache")
                metrics["errors"] += 1

    return metrics


async def advanced_janitor_job():
    await asyncio.to_thread(_advanced_janitor_once)


def _advanced_janitor_once():
    """Clean local scratch files and durable objects based on retention rules."""
    metrics = cleanup_local_media_artifacts()
    metrics.update({
        "cloud_exports_deleted": 0,
        "cloud_uploads_deleted": 0,
    })

    try:
        metrics["cloud_exports_deleted"] = delete_expired_exports()
    except Exception as e:
        _json_log("warning", "janitor_error", error=str(e), scope="cloud_exports")
        metrics["errors"] += 1

    try:
        metrics["cloud_uploads_deleted"] = delete_expired_uploads()
    except Exception as e:
        _json_log("warning", "janitor_error", error=str(e), scope="cloud_uploads")
        metrics["errors"] += 1

    total_deleted = (
        metrics["uploads_deleted"] + metrics["exports_deleted"]
        + metrics["temp_ass_deleted"] + metrics["cache_deleted"]
        + metrics["render_scratch_deleted"]
        + metrics["cloud_exports_deleted"]
        + metrics["cloud_uploads_deleted"]
    )
    if total_deleted > 0 or metrics["errors"] > 0:
        _json_log(
            "info",
            "janitor_summary",
            uploads_deleted=metrics["uploads_deleted"],
            exports_deleted=metrics["exports_deleted"],
            temp_ass_deleted=metrics["temp_ass_deleted"],
            cache_deleted=metrics["cache_deleted"],
            cloud_exports_deleted=metrics["cloud_exports_deleted"],
            cloud_uploads_deleted=metrics["cloud_uploads_deleted"],
            errors=metrics["errors"],
        )


def _claim_scheduled_job(name: str, ttl_seconds: int) -> str:
    token = uuid.uuid4().hex
    if _redis_client is None:
        return token
    try:
        return token if _redis_client.set(f"scheduled:{name}", token, nx=True, ex=ttl_seconds) else ""
    except Exception:
        return "" if _IS_PRODUCTION else token


def _release_scheduled_job(name: str, token: str):
    if not token or _redis_client is None:
        return
    try:
        _redis_client.eval(
            "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
            1,
            f"scheduled:{name}",
            token,
        )
    except Exception:
        pass


async def scheduled_janitor_job():
    token = await asyncio.to_thread(_claim_scheduled_job, "janitor", 14 * 60)
    if not token:
        return
    try:
        await advanced_janitor_job()
    finally:
        await asyncio.to_thread(_release_scheduled_job, "janitor", token)


async def scheduled_payment_reconciliation_job():
    token = await asyncio.to_thread(
        _claim_scheduled_job, "payment_reconciliation", max(PAYMENT_RECONCILE_INTERVAL_MINUTES, 5) * 60 - 5,
    )
    if not token:
        return
    try:
        await payment_reconciliation_job()
    finally:
        await asyncio.to_thread(_release_scheduled_job, "payment_reconciliation", token)


def _publish_queue_metrics_once():
    # Multiple Uvicorn processes and API replicas start this loop. A short
    # Redis lease ensures only one process writes the per-group time series.
    token = _claim_scheduled_job("gcp_queue_metrics", QUEUE_METRICS_INTERVAL_SECONDS - 2)
    if not token or _export_queue is None or Job is None:
        return
    render_queues = list(_export_queues.values()) or [_export_queue]
    active_workers = 1
    workers = []
    if RQWorker is not None:
        try:
            workers = RQWorker.all(connection=_rq_redis_client)
            render_names = set(_export_queues) or {EXPORT_QUEUE_NAME}
            active_workers = sum(
                1 for worker in workers
                if render_names.intersection(set(
                    worker.queue_names() if callable(getattr(worker, "queue_names", None))
                    else getattr(worker, "queue_names", [])
                ))
            ) or 1
        except Exception:
            active_workers = 1
            workers = []
    depth, oldest_age_seconds, pending_work_seconds, predicted_wait_seconds = render_queue_snapshot(
        render_queues, Job, active_workers=active_workers,
    )
    publish_queue_snapshot(
        depth,
        oldest_age_seconds,
        "render_all",
        WORKER_MIG_NAME,
        pending_work_seconds=pending_work_seconds,
        metric_prefix="export",
        predicted_wait_seconds=predicted_wait_seconds,
    )
    if HEAVY_EXPORT_QUEUE_NAME in _export_queues:
        spot_workers = 0
        for worker in workers:
            try:
                group = _rq_redis_client.hget(worker.key, "worker_group") or b""
                if isinstance(group, bytes):
                    group = group.decode("utf-8", "replace")
                if group == SPOT_WORKER_MIG_NAME:
                    spot_workers += 1
            except Exception:
                continue
        heavy_depth, heavy_age, heavy_work, heavy_wait = render_queue_snapshot(
            [_export_queues[HEAVY_EXPORT_QUEUE_NAME]], Job, active_workers=spot_workers or 1,
        )
        publish_queue_snapshot(
            heavy_depth,
            heavy_age,
            "render_heavy",
            SPOT_WORKER_MIG_NAME,
            pending_work_seconds=heavy_work,
            metric_prefix="export",
            predicted_wait_seconds=heavy_wait,
        )
    if GPU_RENDER_ENABLED and GPU_EXPORT_QUEUE_NAME in _export_queues:
        gpu_workers = 0
        for worker in workers:
            try:
                group = _rq_redis_client.hget(worker.key, "worker_group") or b""
                if isinstance(group, bytes):
                    group = group.decode("utf-8", "replace")
                if group == GPU_WORKER_MIG_NAME:
                    gpu_workers += 1
            except Exception:
                continue
        gpu_depth, gpu_age, gpu_work, gpu_wait = render_queue_snapshot(
            [_export_queues[GPU_EXPORT_QUEUE_NAME]], Job, active_workers=gpu_workers or 1,
        )
        publish_queue_snapshot(
            gpu_depth,
            gpu_age,
            "render_gpu",
            GPU_WORKER_MIG_NAME,
            pending_work_seconds=gpu_work,
            metric_prefix="export",
            predicted_wait_seconds=gpu_wait,
        )
    if _transcription_queue is not None and TRANSCRIPTION_QUEUE_NAME != EXPORT_QUEUE_NAME:
        transcription_depth, transcription_oldest = queue_snapshot(
            _transcription_queue, Job,
        )
        if _media_scan_queue is not None and MEDIA_SCAN_QUEUE_NAME != TRANSCRIPTION_QUEUE_NAME:
            scan_depth, scan_oldest = queue_snapshot(_media_scan_queue, Job)
            transcription_depth += scan_depth
            transcription_oldest = max(transcription_oldest, scan_oldest)
        publish_queue_snapshot(
            transcription_depth,
            transcription_oldest,
            TRANSCRIPTION_QUEUE_NAME,
            TRANSCRIPTION_MIG_NAME,
            metric_prefix="transcription",
        )


async def _queue_metrics_loop():
    while True:
        try:
            await asyncio.to_thread(_publish_queue_metrics_once)
        except asyncio.CancelledError:
            raise
        except Exception as error:
            _json_log("warning", "queue_metrics_publish_failed", error=str(error))
        await asyncio.sleep(QUEUE_METRICS_INTERVAL_SECONDS)

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

async def _simple_janitor_loop():
    """Fallback janitor when apscheduler is not installed — runs every 15 min."""
    try:
        while True:
            await asyncio.sleep(900)
            try:
                await advanced_janitor_job()
            except Exception as e:
                _json_log("error", "janitor_job_failed", error=str(e))
    except Exception as e:
        _json_log("error", "janitor_loop_crashed", error=str(e))

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


def _retention_deadline(days: int) -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=max(1, int(days)))


def _enqueue_telemetry(collection_name: str, payload: Dict[str, Any], retention_days: int):
    row = {**payload, "expire_at": _retention_deadline(retention_days)}
    dropped = False
    with _telemetry_lock:
        if len(_telemetry_buffer) >= TELEMETRY_QUEUE_LIMIT:
            _telemetry_buffer.popleft()
            dropped = True
        _telemetry_buffer.append((collection_name, row))
    if dropped:
        _json_log("warning", "telemetry_buffer_overflow", collection=collection_name)


def _flush_telemetry():
    db = get_db()
    if not db:
        return 0
    rows = []
    with _telemetry_lock:
        while _telemetry_buffer and len(rows) < TELEMETRY_BATCH_SIZE:
            rows.append(_telemetry_buffer.popleft())
    if not rows:
        return 0
    try:
        batch = db.batch()
        for collection_name, payload in rows:
            batch.set(db.collection(collection_name).document(), payload)
        batch.commit()
        return len(rows)
    except Exception as e:
        with _telemetry_lock:
            for row in reversed(rows):
                _telemetry_buffer.appendleft(row)
        _json_log("warning", "telemetry_batch_persist_failed", count=len(rows), error=str(e))
        return 0


async def _telemetry_flush_loop():
    while True:
        await asyncio.sleep(5)
        await asyncio.to_thread(_flush_telemetry)


class CircuitBreaker:
    def __init__(self, failure_threshold: int = 5, cooldown_seconds: int = 90):
        self.failure_threshold = failure_threshold
        self.cooldown_seconds = cooldown_seconds
        self._state = "closed"
        self._failure_count = 0
        self._opened_at = 0.0

    def allow(self) -> bool:
        if self._state == "closed":
            return True
        if self._state == "open":
            if (time.time() - self._opened_at) >= self.cooldown_seconds:
                self._state = "half_open"
                return True
            return False
        return True

    def on_success(self):
        self._state = "closed"
        self._failure_count = 0
        self._opened_at = 0.0

    def on_failure(self):
        self._failure_count += 1
        if self._failure_count >= self.failure_threshold:
            self._state = "open"
            self._opened_at = time.time()


_provider_breakers: Dict[str, CircuitBreaker] = {
    "openai_translate": CircuitBreaker(failure_threshold=4, cooldown_seconds=120),
    "openai_detect_language": CircuitBreaker(failure_threshold=4, cooldown_seconds=120),
}

def _request_id(request: Optional[Request]) -> str:
    if request is None:
        return str(uuid.uuid4())[:8]
    state_rid = str(getattr(request.state, "request_id", "") or "").strip()
    if state_rid:
        return state_rid[:64]
    rid = request.headers.get("x-request-id")
    return rid.strip()[:64] if rid else str(uuid.uuid4())[:8]

def _log(rid: str, msg: str):
    _json_log("info", "app_log", request_id=rid, message=msg)


def _track_event(event: str, payload: Optional[Dict[str, Any]] = None):
    _analytics_counters[event] = _analytics_counters.get(event, 0) + 1
    day_key = _utcnow().date().isoformat()
    daily = _analytics_daily_counters.setdefault(day_key, {})
    daily[event] = daily.get(event, 0) + 1
    if _redis_client is not None:
        try:
            _redis_client.hincrby("analytics:counters", event, 1)
            redis_daily_key = f"analytics:daily:{day_key}"
            _redis_client.hincrby(redis_daily_key, event, 1)
            _redis_client.expire(redis_daily_key, 120 * 24 * 3600)
        except Exception:
            pass
    _json_log("info", "analytics_event", name=event, payload=payload or {})
    _enqueue_telemetry("analytics_events", {
        "event": event,
        "payload": payload or {},
        "timestamp": _utcnow().isoformat() + "Z",
    }, retention_days=30)

def _track_latency_sample(path: str, duration_ms: int, max_samples: int = 300):
    if path not in ("/api/process", "/api/export"):
        return
    arr = _route_latency_samples.setdefault(path, [])
    arr.append(int(duration_ms))
    if len(arr) > max_samples:
        del arr[:-max_samples]
    if _redis_client is not None:
        try:
            k = f"latency:{path}"
            _redis_client.rpush(k, int(duration_ms))
            _redis_client.ltrim(k, -max_samples, -1)
            _redis_client.expire(k, 24 * 3600)
            day_key = _utcnow().date().isoformat()
            daily_key = f"latency:{day_key}:{path}"
            _redis_client.rpush(daily_key, int(duration_ms))
            _redis_client.ltrim(daily_key, -max_samples, -1)
            _redis_client.expire(daily_key, 120 * 24 * 3600)
        except Exception:
            pass


def _track_operational_metric_sample(name: str, value: float, max_samples: int = 2_000):
    if not math.isfinite(float(value)):
        return
    day_key = _utcnow().date().isoformat()
    sample_key = f"{day_key}:{name}"
    samples = _operational_metric_samples.setdefault(sample_key, [])
    samples.append(float(value))
    if len(samples) > max_samples:
        del samples[:-max_samples]
    if _redis_client is not None:
        try:
            redis_key = f"opsmetric:{sample_key}"
            _redis_client.rpush(redis_key, float(value))
            _redis_client.ltrim(redis_key, -max_samples, -1)
            _redis_client.expire(redis_key, 120 * 24 * 3600)
        except Exception:
            pass


def _read_operational_metric_samples(day_key: str, name: str) -> List[float]:
    sample_key = f"{day_key}:{name}"
    values = list(_operational_metric_samples.get(sample_key, []))
    if _redis_client is not None:
        try:
            redis_values = [
                float(value)
                for value in (_redis_client.lrange(f"opsmetric:{sample_key}", 0, -1) or [])
            ]
            if redis_values:
                values = redis_values
        except Exception:
            pass
    return values


def _read_daily_analytics_counters(day_key: str) -> Dict[str, int]:
    counters = dict(_analytics_daily_counters.get(day_key, {}))
    if _redis_client is not None:
        try:
            redis_counters = _redis_client.hgetall(f"analytics:daily:{day_key}") or {}
            if redis_counters:
                counters = {key: int(value) for key, value in redis_counters.items()}
        except Exception:
            pass
    return counters


def _read_daily_latency_samples(day_key: str, path: str) -> List[int]:
    if day_key == _utcnow().date().isoformat():
        values = list(_route_latency_samples.get(path, []))
    else:
        values = []
    if _redis_client is not None:
        try:
            redis_values = [
                int(value)
                for value in (_redis_client.lrange(f"latency:{day_key}:{path}", 0, -1) or [])
            ]
            if redis_values:
                values = redis_values
        except Exception:
            pass
    return values

def _p95(values: list) -> int:
    if not values:
        return 0
    ordered = sorted(int(v) for v in values)
    idx = max(0, math.ceil(0.95 * len(ordered)) - 1)
    return ordered[idx]

def _build_slo_snapshot() -> Dict[str, Any]:
    export_success = _analytics_counters.get("export_success", 0)
    export_failed = _analytics_counters.get("export_failed_http", 0) + _analytics_counters.get("export_failed_exception", 0)
    process_success = _analytics_counters.get("process_success", 0)
    process_failed = _analytics_counters.get("process_failed", 0)
    if _redis_client is not None:
        try:
            counters = _redis_client.hgetall("analytics:counters") or {}
            export_success = int(counters.get("export_success", export_success))
            export_failed = int(counters.get("export_failed_http", 0)) + int(counters.get("export_failed_exception", 0))
            process_success = int(counters.get("process_success", process_success))
            process_failed = int(counters.get("process_failed", process_failed))
        except Exception:
            pass
    export_total = export_success + export_failed
    process_total = process_success + process_failed
    export_rate = export_success / max(export_total, 1)
    process_rate = process_success / max(process_total, 1)
    export_samples = _read_operational_metric_samples(_utcnow().date().isoformat(), "export_total_ms")
    process_samples = _route_latency_samples.get("/api/process", [])
    if _redis_client is not None:
        try:
            r_process = [int(x) for x in _redis_client.lrange("latency:/api/process", 0, -1) or []]
            if r_process:
                process_samples = r_process
        except Exception:
            pass
    export_p95 = _p95(export_samples)
    process_p95 = _p95(process_samples)
    release_gate_passed = (
        (export_total < ERROR_BUDGET_WINDOW_MIN_EVENTS or export_rate >= SLO_EXPORT_SUCCESS_TARGET)
        and (process_total < ERROR_BUDGET_WINDOW_MIN_EVENTS or process_rate >= SLO_PROCESS_SUCCESS_TARGET)
        and (export_p95 == 0 or export_p95 <= SLO_EXPORT_P95_MS_TARGET)
        and (process_p95 == 0 or process_p95 <= SLO_PROCESS_P95_MS_TARGET)
    )
    return {
        "success": True,
        "api_version": API_CURRENT_VERSION,
        "release_gate_passed": release_gate_passed,
        "targets": {
            "export_success_rate": SLO_EXPORT_SUCCESS_TARGET,
            "process_success_rate": SLO_PROCESS_SUCCESS_TARGET,
            "export_p95_ms": SLO_EXPORT_P95_MS_TARGET,
            "process_p95_ms": SLO_PROCESS_P95_MS_TARGET,
        },
        "actuals": {
            "export_success_rate": export_rate,
            "process_success_rate": process_rate,
            "export_p95_ms": export_p95,
            "process_p95_ms": process_p95,
        },
        "volumes": {
            "export_total": export_total,
            "process_total": process_total,
        },
        "timestamp": _utcnow().isoformat() + "Z",
    }

def _tenant_id_from_token(decoded_token: Optional[Dict[str, Any]]) -> str:
    if not decoded_token:
        return ""
    uid = (decoded_token.get("uid") or "").strip()
    return (decoded_token.get("org_id") or decoded_token.get("tenant_id") or (f"org_{uid}" if uid else "")).strip()

def _is_explicit_dev_auth_token(id_token: str) -> bool:
    return (DEBUG_MODE_ENABLED or LOCAL_DEV_AUTH_BYPASS_ENABLED) and (id_token or "").strip() == "mock-token"

def _assert_account_not_deleting(uid: str):
    if not _IS_PRODUCTION:
        return
    db = get_db()
    if db is None:
        raise HTTPException(status_code=503, detail="Account status is unavailable")
    try:
        fence = db.collection("account_deletions").document(uid).get()
    except Exception as error:
        raise HTTPException(status_code=503, detail="Account status is unavailable") from error
    if fence.exists:
        raise HTTPException(status_code=409, detail="Account deletion is in progress or complete.")


def _create_account_if_active(db, user_ref, uid: str, data: Dict[str, Any]):
    if not _IS_PRODUCTION:
        return user_ref.create(data)
    @firestore.transactional
    def create(transaction):
        if db.collection("account_deletions").document(uid).get(transaction=transaction).exists:
            raise HTTPException(status_code=409, detail="Account deletion is in progress or complete.")
        if user_ref.get(transaction=transaction).exists:
            raise AlreadyExists("Account already exists")
        transaction.create(user_ref, data)
    return create(db.transaction())


def _authenticate_media_request(id_token: str, org_id: str = "") -> Dict[str, Any]:
    token = (id_token or "").strip()
    if _is_explicit_dev_auth_token(token):
        return {"uid": "dev-local-user", "_dev_mode": True}

    decoded_token = verify_token(token) if token else None
    if not decoded_token:
        raise HTTPException(status_code=401, detail="Authentication required")

    uid = (decoded_token.get("uid") or "").strip()
    _assert_account_not_deleting(uid)
    _assert_tenant_access(uid, decoded_token, org_id)
    return decoded_token


def _authenticate_bearer_request(request: Request) -> Dict[str, Any]:
    authorization = (request.headers.get("authorization") or "").strip()
    token = authorization[7:].strip() if authorization.lower().startswith("bearer ") else ""
    return _authenticate_media_request(token)

def _assert_tenant_access(uid: str, decoded_token: Optional[Dict[str, Any]], org_id: str = ""):
    if not ENFORCE_TENANT_ISOLATION:
        return
    token_org = _tenant_id_from_token(decoded_token)
    requested_org = (org_id or "").strip()
    if not token_org:
        raise HTTPException(status_code=403, detail="Tenant identity is unavailable")
    if requested_org and requested_org != token_org:
        raise HTTPException(status_code=403, detail="Cross-tenant write is not allowed")
    known_members = _tenant_memberships.setdefault(token_org, set())
    if uid in known_members:
        return
    db = get_db()
    if db and uid:
        try:
            tenant_ref = db.collection("tenants").document(token_org)
            member_ref = tenant_ref.collection("members").document(uid)
            if member_ref.get().exists:
                known_members.add(uid)
                return
            now_iso = _utcnow().isoformat() + "Z"
            batch = db.batch()
            batch.set(tenant_ref, {"updated_at": now_iso}, merge=True)
            batch.set(member_ref, {"uid": uid, "org_id": token_org, "updated_at": now_iso}, merge=True)
            batch.commit()
            known_members.add(uid)
        except Exception as e:
            _json_log("warning", "tenant_membership_persist_failed", uid=uid, org_id=token_org, error=str(e))

def _validate_feature_flag_safety(flag_name: str):
    if not ENABLE_PROGRESSIVE_DELIVERY:
        raise HTTPException(status_code=403, detail="Feature flags are disabled in this environment")
    if not re.match(r"^[a-zA-Z0-9_.-]{2,64}$", flag_name or ""):
        raise HTTPException(status_code=400, detail="Invalid flag name")


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


def _default_service_controls() -> Dict[str, Any]:
    controls: Dict[str, Any] = {key: False for key in SERVICE_CONTROL_KEYS}
    controls["notice"] = ""
    controls[MAX_UPLOAD_DURATION_CONTROL_KEY] = GLOBAL_MAX_UPLOAD_DURATION_SECONDS
    return controls


def _read_service_controls(force: bool = False) -> Dict[str, Any]:
    now_ts = time.time()
    cached = _service_control_cache.get("value") or {}
    if (
        not force
        and cached
        and (now_ts - float(_service_control_cache.get("ts") or 0.0)) < SERVICE_CONTROL_CACHE_SECONDS
    ):
        return dict(cached)

    controls = _default_service_controls()
    db = get_db()
    if db:
        try:
            snap = (
                db.collection(SERVICE_CONTROL_COLLECTION)
                .document(SERVICE_CONTROL_DOCUMENT)
                .get()
            )
            if snap.exists:
                stored = snap.to_dict() or {}
                for key in SERVICE_CONTROL_KEYS:
                    controls[key] = bool(stored.get(key, False))
                controls["notice"] = str(stored.get("notice") or "")[:SERVICE_CONTROL_NOTICE_MAX]
                try:
                    configured_duration = int(stored.get(
                        MAX_UPLOAD_DURATION_CONTROL_KEY,
                        GLOBAL_MAX_UPLOAD_DURATION_SECONDS,
                    ))
                except (TypeError, ValueError):
                    configured_duration = GLOBAL_MAX_UPLOAD_DURATION_SECONDS
                controls[MAX_UPLOAD_DURATION_CONTROL_KEY] = max(
                    15,
                    min(GLOBAL_MAX_UPLOAD_DURATION_SECONDS, configured_duration),
                )
        except Exception as e:
            # Fail open: a controls read failure must not take the product down.
            # The last known state is preferred over an empty default.
            _json_log("warning", "service_controls_read_failed", error=str(e))
            if cached:
                return dict(cached)
            return controls

    _service_control_cache["ts"] = now_ts
    _service_control_cache["value"] = dict(controls)
    return controls


def _assert_service_available(control: str) -> None:
    """Reject the request when an operator has paused this part of the product."""
    controls = _read_service_controls()
    for key in ("maintenance_mode", control):
        if not controls.get(key):
            continue
        notice = controls.get("notice") or _SERVICE_CONTROL_MESSAGES.get(
            key, "This feature is temporarily paused."
        )
        _track_event("service_control_blocked", {"control": key})
        raise HTTPException(status_code=503, detail=notice)


def _maybe_alert_failure_ratio(window_key: str, success_count: int, failure_count: int):
    total = success_count + failure_count
    if total < 20:
        return
    ratio = failure_count / max(total, 1)
    if ratio < 0.2:
        return
    now_ts = time.time()
    if now_ts - _analytics_last_alert_ts.get(window_key, 0.0) < 600:
        return
    _analytics_last_alert_ts[window_key] = now_ts
    _json_log(
        "warning",
        "failure_ratio_alert",
        window_key=window_key,
        success_count=success_count,
        failure_count=failure_count,
        ratio=ratio,
    )
    if SLACK_ALERT_WEBHOOK_URL:
        try:
            payload = {
                "text": f"[Caption Studio Alert] {window_key} failure ratio is high: {failure_count}/{total} ({ratio:.1%})"
            }
            req = urllib.request.Request(
                SLACK_ALERT_WEBHOOK_URL,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            _urlopen_https_only(req, timeout=5)
        except Exception as e:
            _json_log("warning", "alert_webhook_failed", error=str(e))


def _audit_action(action: str, uid: str = "", metadata: Optional[Dict[str, Any]] = None):
    payload = {
        "action": action,
        "uid": uid or "anonymous",
        "metadata": metadata or {},
        "timestamp": _utcnow().isoformat() + "Z",
    }
    _json_log("info", "audit_action", **payload)
    _enqueue_telemetry("audit_logs", payload, retention_days=365)


def _scan_upload_for_threat(file_path: str) -> bool:
    return scan_upload_for_threat(file_path, log=_json_log)

def _is_content_safety_blocked(*values: str) -> bool:
    if not CONTENT_SAFETY_BLOCKLIST:
        return False
    joined = " ".join((v or "") for v in values).lower()
    return any(token in joined for token in CONTENT_SAFETY_BLOCKLIST)

def _persist_export_job(job_id: str, payload: Dict[str, Any], *, write_redis: bool = True) -> bool:
    """Persist job state to at least one cross-process store."""
    persisted = not write_redis and _redis_client is not None
    if write_redis and _redis_client is not None:
        try:
            _redis_client.setex(
                f"export_job:{job_id}",
                7 * 24 * 3600,
                json.dumps(payload, default=str),
            )
            persisted = True
        except Exception as e:
            _json_log("warning", "export_job_redis_persist_failed", job_id=job_id, error=str(e))

    db = get_db()
    if db:
        for attempt in range(2):
            try:
                ref = db.collection("export_jobs").document(job_id)
                if _redis_client is not None:
                    @firestore.transactional
                    def mirror(transaction):
                        current = ref.get(transaction=transaction)
                        revision = int((current.to_dict() or {}).get("revision", 0)) if current.exists else 0
                        if revision < int(payload.get("revision", 0)):
                            transaction.set(ref, {**payload, "expire_at": _retention_deadline(7)}, merge=True)
                    mirror(db.transaction())
                else:
                    ref.set({**payload, "expire_at": _retention_deadline(7)}, merge=True)
                persisted = True
                break
            except Exception as e:
                _json_log(
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
    if _redis_client is not None:
        try:
            raw = _redis_client.get(f"export_job:{job_id}")
            if raw:
                job = json.loads(raw)
                _export_jobs[job_id] = job
                return job
        except Exception as e:
            _json_log("warning", "export_job_redis_load_failed", job_id=job_id, error=str(e))

    db = get_db()
    if db:
        try:
            snap = db.collection("export_jobs").document(job_id).get()
            if snap.exists:
                job = snap.to_dict() or {}
                _export_jobs[job_id] = job
                return job
        except Exception as e:
            _json_log("warning", "export_job_firestore_load_failed", job_id=job_id, error=str(e))
    if (_IS_PRODUCTION or _export_queue is not None) and job_id in _export_jobs:
        raise HTTPException(status_code=503, detail="Export job status is temporarily unavailable")
    return _export_jobs.get(job_id)

def _idem_get(key: str):
    if not key:
        return None
    if _redis_client is not None:
        try:
            raw = _redis_client.get(f"idem:{key}")
            return json.loads(raw) if raw else None
        except Exception:
            return None
    return _export_idempotency.get(key)

def _idem_claim(key: str, value: Dict[str, Any]) -> bool:
    if _redis_client is not None:
        try:
            return bool(_redis_client.set(f"idem:{key}", json.dumps(value), nx=True, ex=6 * 3600))
        except Exception as error:
            raise HTTPException(status_code=503, detail="Export safety service is unavailable") from error
    with JOB_STATE_LOCK:
        if key in _export_idempotency:
            return False
        _export_idempotency[key] = value
        return True


def _idem_set(key: str, value: Dict[str, Any], ttl_seconds: int = 6 * 3600):
    if not key:
        return
    if _redis_client is not None:
        try:
            _redis_client.setex(f"idem:{key}", ttl_seconds, json.dumps(value))
            return
        except Exception:
            pass
    _export_idempotency[key] = value

def _idem_delete(key: str):
    if not key:
        return
    if _redis_client is not None:
        try:
            _redis_client.delete(f"idem:{key}")
            return
        except Exception:
            pass
    _export_idempotency.pop(key, None)


def _upload_idem_key(uid: str, upload_reference: str) -> str:
    """Create a non-guessable storage key for an upload retry receipt."""
    return hashlib.sha256(f"{uid}:{upload_reference}".encode("utf-8")).hexdigest()


def _upload_idem_get(uid: str, upload_reference: str):
    if not upload_reference:
        return None
    key = _upload_idem_key(uid, upload_reference)
    if _redis_client is not None:
        try:
            raw = _redis_client.get(f"upload_idem:{key}")
            return json.loads(raw) if raw else None
        except Exception as e:
            _json_log("warning", "upload_idempotency_read_failed", error=str(e))
    return _upload_idempotency.get(key)


def _upload_idem_set(uid: str, upload_reference: str, value: Dict[str, Any], ttl_seconds: int = 24 * 3600):
    if not upload_reference:
        return
    key = _upload_idem_key(uid, upload_reference)
    if _redis_client is not None:
        try:
            _redis_client.setex(f"upload_idem:{key}", ttl_seconds, json.dumps(value))
            return
        except Exception as e:
            _json_log("warning", "upload_idempotency_write_failed", error=str(e))
    _upload_idempotency[key] = value

def _payment_idem_get(key: str):
    if not key:
        return None
    if _redis_client is not None:
        try:
            raw = _redis_client.get(f"pay_idem:{key}")
            return json.loads(raw) if raw else None
        except Exception as e:
            _json_log("error", "payment_idempotency_read_failed", error=str(e))
            raise HTTPException(status_code=503, detail="Payment safety service is temporarily unavailable") from e

    if _IS_TEST:
        return _payment_idempotency.get(key)
    db = get_db()
    if db:
        try:
            doc_id = hashlib.sha256(key.encode("utf-8")).hexdigest()
            snap = db.collection("payment_idempotency").document(doc_id).get()
            return snap.to_dict() if snap.exists else None
        except Exception as e:
            _json_log("error", "payment_idempotency_firestore_read_failed", error=str(e))
            raise HTTPException(status_code=503, detail="Payment safety service is temporarily unavailable") from e
    if _IS_PRODUCTION:
        raise HTTPException(status_code=503, detail="Payment safety service is unavailable")
    return _payment_idempotency.get(key)

def _payment_idem_set(key: str, value: Dict[str, Any], ttl_seconds: int = 24 * 3600):
    if not key:
        return
    if _redis_client is not None:
        try:
            _redis_client.setex(f"pay_idem:{key}", ttl_seconds, json.dumps(value))
            return
        except Exception as e:
            _json_log("error", "payment_idempotency_write_failed", error=str(e))
            raise HTTPException(status_code=503, detail="Payment safety service is temporarily unavailable") from e

    if _IS_TEST:
        _payment_idempotency[key] = value
        return
    db = get_db()
    if db:
        try:
            doc_id = hashlib.sha256(key.encode("utf-8")).hexdigest()
            db.collection("payment_idempotency").document(doc_id).set({
                **value,
                "key_hash": doc_id,
                "expire_at": datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds),
            })
            return
        except Exception as e:
            _json_log("error", "payment_idempotency_firestore_write_failed", error=str(e))
            raise HTTPException(status_code=503, detail="Payment safety service is temporarily unavailable") from e
    if _IS_PRODUCTION:
        raise HTTPException(status_code=503, detail="Payment safety service is unavailable")
    _payment_idempotency[key] = value

def _payment_idem_claim(key: str, ttl_seconds: int = 24 * 3600) -> bool:
    """Atomically claim a payment operation key before calling Razorpay."""
    if not key:
        return True
    value = {"status": "in_progress", "ts": time.time()}
    if _redis_client is not None:
        try:
            return bool(_redis_client.set(
                f"pay_idem:{key}", json.dumps(value), ex=ttl_seconds, nx=True
            ))
        except Exception as e:
            _json_log("error", "payment_idempotency_claim_failed", error=str(e))
            raise HTTPException(status_code=503, detail="Payment safety service is temporarily unavailable") from e

    if _IS_TEST:
        if key in _payment_idempotency:
            return False
        _payment_idempotency[key] = value
        return True
    db = get_db()
    if db:
        try:
            doc_id = hashlib.sha256(key.encode("utf-8")).hexdigest()
            db.collection("payment_idempotency").document(doc_id).create({
                **value,
                "key_hash": doc_id,
                "expire_at": datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds),
            })
            return True
        except AlreadyExists:
            return False
        except Exception as e:
            _json_log("error", "payment_idempotency_firestore_claim_failed", error=str(e))
            raise HTTPException(status_code=503, detail="Payment safety service is temporarily unavailable") from e
    if _IS_PRODUCTION:
        raise HTTPException(status_code=503, detail="Payment safety service is unavailable")
    if key in _payment_idempotency:
        return False
    _payment_idempotency[key] = value
    return True

def _payment_idem_delete(key: str):
    if not key:
        return
    if _redis_client is not None:
        try:
            _redis_client.delete(f"pay_idem:{key}")
            return
        except Exception as e:
            _json_log("error", "payment_idempotency_delete_failed", error=str(e))
            raise HTTPException(status_code=503, detail="Payment safety service is temporarily unavailable") from e

    if _IS_TEST:
        _payment_idempotency.pop(key, None)
        return
    db = get_db()
    if db:
        try:
            doc_id = hashlib.sha256(key.encode("utf-8")).hexdigest()
            db.collection("payment_idempotency").document(doc_id).delete()
            return
        except Exception as e:
            _json_log("error", "payment_idempotency_firestore_delete_failed", error=str(e))
            raise HTTPException(status_code=503, detail="Payment safety service is temporarily unavailable") from e
    if _IS_PRODUCTION:
        raise HTTPException(status_code=503, detail="Payment safety service is unavailable")
    _payment_idempotency.pop(key, None)

def _require_payment_idempotency(uid: str, key: str, op: str) -> str:
    if not REQUIRE_PAYMENT_IDEMPOTENCY:
        return ""
    safe = (key or "").strip()
    if not safe:
        raise HTTPException(status_code=400, detail=f"Missing idempotency key for {op}")
    if len(safe) > 200 or not re.fullmatch(r"[A-Za-z0-9:._-]+", safe):
        raise HTTPException(status_code=400, detail="Invalid payment idempotency key")
    return f"{uid}:{op}:{safe}"

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


def _rate_limit_namespace(store: Dict[str, list]) -> str:
    for candidate, namespace in _RATE_LIMIT_NAMESPACES:
        if store is candidate:
            return namespace
    return "generic"


def _rate_limit_redis_key(store: Dict[str, list], key: str) -> str:
    return f"rl:{_rate_limit_namespace(store)}:{key}"


def _client_rate_key(request: Request) -> str:
    """Return the end-user address when Railway is the immediate peer."""
    peer = (request.client.host if request.client else "").strip()
    try:
        peer_is_public = ipaddress.ip_address(peer).is_global
    except ValueError:
        peer_is_public = False
    if peer_is_public:
        return peer

    # Railway documents X-Real-IP as the original client address. Keep a final
    # X-Forwarded-For fallback for compatible local/reverse-proxy deployments.
    forwarded_candidates = [request.headers.get("x-real-ip", "")]
    forwarded_for = request.headers.get("x-forwarded-for", "")
    forwarded_candidates.extend(reversed(forwarded_for.split(",")))
    for candidate in forwarded_candidates:
        safe_candidate = candidate.strip().strip("[]")
        try:
            ipaddress.ip_address(safe_candidate)
            return safe_candidate
        except ValueError:
            continue
    return peer or "unknown"


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


def _check_rate(store: Dict[str, list], key: str, limit: int, window: int = 3600):
    """Returns (allowed, retry_after_seconds, remaining).
    Mutates *store* in-place to record the current timestamp."""
    if _redis_client is not None:
        try:
            now_ts = time.time()
            admitted, retry_after, remaining = _redis_client.eval(
                RATE_ADMISSION_SCRIPT, 1, _rate_limit_redis_key(store, key),
                now_ts, window, limit, uuid.uuid4().hex,
            )
            return bool(admitted), int(retry_after), int(remaining)
        except Exception as e:
            if _IS_PRODUCTION:
                _json_log("error", "rate_limit_redis_failed", key=key, error=str(e))
                raise HTTPException(status_code=503, detail="Rate-limit service is temporarily unavailable") from e
            # Local and test environments may use the per-process fallback.
            pass

    now_ts = time.time()
    timestamps = [t for t in store.get(key, []) if t > now_ts - window]
    if len(timestamps) >= limit:
        store[key] = timestamps
        retry_after = max(1, int(window - (now_ts - min(timestamps)))) if timestamps else window
        return False, retry_after, 0
    timestamps.append(now_ts)
    store[key] = timestamps
    remaining = max(0, limit - len(timestamps))
    return True, 0, remaining

def _record_export_failure(uid: str):
    key = f"expfail:{uid}"
    now_ts = time.time()
    if _redis_client is not None:
        try:
            pipe = _redis_client.pipeline()
            pipe.zremrangebyscore(key, 0, now_ts - EXPORT_FAILURE_WINDOW)
            pipe.zadd(key, {f"{now_ts}:{uuid.uuid4().hex[:8]}": now_ts})
            pipe.expire(key, EXPORT_FAILURE_WINDOW + 10)
            pipe.execute()
            return
        except Exception:
            pass
    fail_key = f"fail:{uid}"
    arr = [t for t in _export_failures.get(fail_key, []) if t > now_ts - EXPORT_FAILURE_WINDOW]
    arr.append(now_ts)
    _export_failures[fail_key] = arr

def _get_recent_export_failures(uid: str) -> list:
    key = f"expfail:{uid}"
    now_ts = time.time()
    if _redis_client is not None:
        try:
            _redis_client.zremrangebyscore(key, 0, now_ts - EXPORT_FAILURE_WINDOW)
            vals = _redis_client.zrange(key, 0, -1, withscores=True)
            return [float(v[1]) for v in vals]
        except Exception:
            pass
    fail_key = f"fail:{uid}"
    arr = [t for t in _export_failures.get(fail_key, []) if t > now_ts - EXPORT_FAILURE_WINDOW]
    _export_failures[fail_key] = arr
    return arr

def _acquire_export_slot(uid: str, job_id: str) -> bool:
    if not uid or not job_id:
        return False
    if _redis_client is not None:
        try:
            k = f"expactive:{uid}"
            acquired = _redis_client.set(k, job_id, nx=True, ex=EXPORT_SLOT_TTL_SECONDS)
            if acquired:
                return True
            current = _redis_client.get(k)
            if isinstance(current, bytes):
                current = current.decode("utf-8", errors="ignore")
            if current == job_id:
                _redis_client.expire(k, EXPORT_SLOT_TTL_SECONDS)
                return True
            # A worker can fail before entering run_export_job_task (for
            # example, when an old worker cannot deserialize a newer argument
            # contract). In that case its finally block never releases the
            # lease. Reclaim only when the durable job/RQ state proves the
            # previous owner is already terminal; never steal a live render.
            previous_job_id = str(current or "")
            previous_terminal = False
            try:
                previous_job = _load_export_job(previous_job_id) or {}
                previous_status = str(previous_job.get("status") or "").lower()
                previous_terminal = previous_status in {
                    "completed", "failed", "cancelled", "canceled", "stopped",
                }
                if not previous_terminal and _export_queue is not None:
                    previous_queue = _queue_for_export_job_record(previous_job)
                    rq_job = previous_queue.fetch_job(previous_job_id) if previous_queue else None
                    if rq_job is not None:
                        rq_status = rq_job.get_status(refresh=True)
                        rq_status_value = str(getattr(rq_status, "value", rq_status)).lower()
                        previous_terminal = rq_status_value in {
                            "finished", "failed", "stopped", "cancelled", "canceled",
                        }
            except Exception as state_error:
                _json_log(
                    "warning",
                    "export_slot_recovery_check_failed",
                    uid=uid,
                    previous_job_id=previous_job_id,
                    error=type(state_error).__name__,
                )
            if previous_terminal:
                removed = _redis_client.eval(
                    "if redis.call('get', KEYS[1]) == ARGV[1] then "
                    "return redis.call('del', KEYS[1]) else return 0 end",
                    1,
                    k,
                    previous_job_id,
                )
                if removed:
                    acquired = _redis_client.set(k, job_id, nx=True, ex=EXPORT_SLOT_TTL_SECONDS)
                    if acquired:
                        _json_log(
                            "warning",
                            "stale_export_slot_recovered",
                            uid=uid,
                            previous_job_id=previous_job_id,
                            job_id=job_id,
                        )
                        return True
            return False
        except Exception as e:
            _json_log("error", "export_slot_acquire_failed", uid=uid, job_id=job_id, error=str(e))
            if _IS_PRODUCTION or _export_queue is not None:
                return False
    current = _active_exports_by_user.get(uid)
    if current and current != job_id:
        return False
    _active_exports_by_user[uid] = job_id
    return True

def _release_export_slot(uid: str, job_id: str):
    if not uid or not job_id:
        return
    if _redis_client is not None:
        try:
            k = f"expactive:{uid}"
            _redis_client.eval(
                "if redis.call('get', KEYS[1]) == ARGV[1] then "
                "return redis.call('del', KEYS[1]) else return 0 end",
                1,
                k,
                job_id,
            )
            return
        except Exception:
            pass
    if _active_exports_by_user.get(uid) == job_id:
        _active_exports_by_user.pop(uid, None)

def _acquire_process_slot(uid: str, request_id: str) -> bool:
    """Allow one paid transcription call per user across all API instances."""
    if not uid or not request_id:
        return False
    if _redis_client is not None:
        try:
            return bool(
                _redis_client.set(
                    f"procactive:{uid}",
                    request_id,
                    nx=True,
                    ex=PROCESS_SLOT_TTL_SECONDS,
                )
            )
        except Exception as e:
            _json_log("error", "process_slot_acquire_failed", uid=uid, request_id=request_id, error=str(e))
            if _IS_PRODUCTION:
                return False
    if _active_processes_by_user.get(uid):
        return False
    _active_processes_by_user[uid] = request_id
    return True

def _release_process_slot(uid: str, request_id: str):
    if not uid or not request_id:
        return
    if _redis_client is not None:
        try:
            _redis_client.eval(
                "if redis.call('get', KEYS[1]) == ARGV[1] then "
                "return redis.call('del', KEYS[1]) else return 0 end",
                1,
                f"procactive:{uid}",
                request_id,
            )
            return
        except Exception:
            pass
    if _active_processes_by_user.get(uid) == request_id:
        _active_processes_by_user.pop(uid, None)

def _apply_rate_headers(response: Optional[Response], limit: int, remaining: int, retry_after: int = 0):
    if response is None:
        return
    response.headers["X-RateLimit-Limit"] = str(limit)
    response.headers["X-RateLimit-Remaining"] = str(max(0, remaining))
    if retry_after > 0:
        response.headers["Retry-After"] = str(retry_after)

def _evaluate_export_policy(user_data: Dict[str, Any], now_ts: float):
    if user_data.get("deletion_pending"):
        return False, "Account deletion is in progress.", []
    tier = _normalize_tier_name(user_data.get('subscription_tier', 'free'))
    try:
        credits = int(user_data.get('credits_remaining', 0) or 0)
    except (TypeError, ValueError):
        # A malformed legacy value must never become a 500 or an entitlement
        # bypass. Account bootstrap repairs only missing free balances.
        credits = 0
    credits = max(0, credits)
    if tier == FREE_PLAN_ID:
        # Never let a stale/manual legacy value turn the Free plan into an
        # unbounded entitlement. Account bootstrap also persists this repair.
        credits = _normalize_free_credit_balance(credits)
    export_history = user_data.get('export_timestamps', []) or []
    recent_exports = [ts for ts in export_history if ts > (now_ts - 86400)]

    plan_time_expired = _subscription_is_expired(user_data)
    if tier != 'free' and plan_time_expired:
        return False, "PLAN_EXPIRED: Your plan has expired. Please renew to continue exporting.", recent_exports

    if credits <= 0 and not DISABLE_EXPORT_CREDIT_LIMIT:
        return False, "UPGRADE_REQUIRED: You have no credits remaining. Please upgrade your plan to continue exporting.", recent_exports

    # Temporary escape hatch during export debugging: keep credit checks, but do not
    # block local verification on daily export quota until parity issues are closed.
    if not DISABLE_EXPORT_DAILY_LIMIT:
        daily_limit = PLAN_PRICING.get(tier, {}).get('daily_limit', 5)
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
        if not DISABLE_EXPORT_CREDIT_LIMIT:
            current_tier = _normalize_tier_name(current_user.get("subscription_tier", "free"))
            if current_tier == FREE_PLAN_ID:
                # Set an exact bounded value so a corrupt Free balance such as
                # 73 is repaired on the first metered export instead of merely
                # becoming 72 and remaining exploitable.
                bounded_balance = _normalize_free_credit_balance(
                    current_user.get("credits_remaining", 0),
                )
                user_update["credits_remaining"] = max(0, bounded_balance - 1)
            else:
                user_update["credits_remaining"] = firestore.Increment(-1)
        if not DISABLE_EXPORT_DAILY_LIMIT:
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


# Large fields kept only in the durable Firestore record when Firestore exists.
# Redis job records are read on every status poll and rewritten on every state
# transition, and Redis has no eviction headroom: a full editor snapshot per
# export for seven days grew Redis without bound. Replay reads Firestore.
_DURABLE_ONLY_EXPORT_JOB_FIELDS = ("request_snapshot",)

def _load_recorded_export_result(uid: str, export_job_id: str, file_id: str):
    database = get_db()
    if database is None:
        if _IS_PRODUCTION:
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
        keep_out_of_redis = _redis_client is not None and get_db() is not None
        if keep_out_of_redis:
            durable_only = {
                field: kwargs.pop(field)
                for field in _DURABLE_ONLY_EXPORT_JOB_FIELDS
                if field in kwargs
            }
        seed = _load_export_job(job_id) or {}
        if keep_out_of_redis:
            # A Redis-loss recovery seeds from Firestore; do not copy its
            # snapshot back into Redis.
            seed = {key: value for key, value in seed.items() if key not in _DURABLE_ONLY_EXPORT_JOB_FIELDS}
        payload = transition_export_job(_redis_client, job_id, seed, {
            "status": status, "updated_at": time.time(), **kwargs,
        }, expected_status=expected_status)
        persisted = _persist_export_job(
            job_id, {**payload, **durable_only}, write_redis=_redis_client is None,
        )
        if _export_queue is not None and not persisted:
            raise RuntimeError("Export job state could not be persisted to shared storage")
        _export_jobs[job_id] = payload
        return payload

# Allowed upload extensions (module-level constant — not rebuilt per request)
ALLOWED_EXTENSIONS = {'mp4', 'mov', 'avi', 'mkv', 'webm', 'mp3', 'wav', 'm4a', 'aac'}
MAX_UPLOAD_BYTES = 500 * 1024 * 1024  # 500 MiB = 524,288,000 bytes
# A configured GCS deployment must not let browser clients bypass direct upload
# by sending a large multipart body through the control API.
MAX_PROXY_UPLOAD_BYTES = 8 * 1024 * 1024 if os.environ.get("GCS_MEDIA_BUCKET") else MAX_UPLOAD_BYTES
ALLOWED_CONTENT_PREFIXES = ("video/", "audio/")

def _validate_file_id(file_id: str) -> bool:
    """Validate file_id is a UUID4 — prevents path traversal via user-supplied IDs."""
    try:
        uuid.UUID(str(file_id))
        return True
    except (ValueError, AttributeError):
        return False

def _safe_find_upload(file_id: str) -> Optional[str]:
    """Return the full path of the uploaded file for *file_id*, or None.
    Validates UUID format and guards against directory traversal."""
    if not _validate_file_id(file_id):
        return None
    real_dir = os.path.realpath(UPLOAD_DIR)
    for f in os.listdir(UPLOAD_DIR):
        if f.startswith(file_id):
            candidate = os.path.realpath(os.path.join(UPLOAD_DIR, f))
            if candidate.startswith(real_dir + os.sep):
                return os.path.join(UPLOAD_DIR, f)
    metadata = _load_upload_metadata(file_id)
    remote_path = str(metadata.get("remote_path") or "")
    extension = str(metadata.get("extension") or pathlib.Path(remote_path).suffix.lstrip(".")).lower()
    if not remote_path.startswith("uploads/") or extension not in ALLOWED_EXTENSIONS:
        return None
    target = os.path.realpath(os.path.join(UPLOAD_DIR, f"{file_id}.{extension}"))
    if not target.startswith(real_dir + os.sep):
        return None
    partial = f"{target}.part-{uuid.uuid4().hex}"
    try:
        if not download_from_firebase_storage(remote_path, partial):
            return None
        os.replace(partial, target)
        return target
    finally:
        if os.path.exists(partial):
            try:
                os.remove(partial)
            except OSError:
                pass
    return None


def _load_upload_metadata(file_id: str) -> Dict[str, Any]:
    if not file_id:
        return {}
    metadata: Dict[str, Any] = {}
    if _redis_client is not None:
        try:
            raw = _redis_client.get(f"upload_meta:{file_id}")
            if raw:
                metadata = json.loads(raw)
        except Exception:
            metadata = {}
    if metadata:
        return metadata
    db = get_db()
    if db:
        try:
            snap = db.collection("uploads").document(file_id).get()
            if snap.exists:
                metadata = snap.to_dict() or {}
        except Exception:
            metadata = {}
    return metadata


def _remember_source_duration(file_id: str, duration_seconds: float):
    if not math.isfinite(duration_seconds) or duration_seconds <= 0:
        return
    if _redis_client is not None:
        try:
            _redis_client.setex(f"upload_duration:{file_id}", 24 * 3600, duration_seconds)
        except Exception as error:
            _json_log("warning", "upload_duration_cache_failed", error=type(error).__name__)
    db = get_db()
    if db:
        try:
            db.collection("uploads").document(file_id).set(
                {"duration_seconds": duration_seconds}, merge=True,
            )
        except Exception as error:
            _json_log("warning", "upload_duration_persist_failed", error=type(error).__name__)


def _source_duration_hint(file_id: str, uid: str) -> float:
    metadata = _load_upload_metadata(file_id)
    if str(metadata.get("uid") or "") != str(uid):
        return 0
    if _redis_client is not None:
        try:
            cached = _redis_client.get(f"upload_duration:{file_id}")
            if cached is not None:
                return float(cached)
        except Exception:
            pass
    try:
        return float(metadata.get("duration_seconds") or 0)
    except (TypeError, ValueError):
        return 0


def _remember_upload_owner(file_id: str, uid: str, remote_path: str = "", extension: str = "",
                           source_metadata: Optional[Dict[str, Any]] = None):
    if not file_id or not uid:
        return False
    _assert_account_not_deleting(uid)
    _upload_owners[file_id] = uid
    persisted = False
    metadata = {
        "file_id": file_id,
        "uid": uid,
        "remote_path": remote_path,
        "extension": extension,
        "created_at": _utcnow().isoformat() + "Z",
        **(source_metadata or {}),
    }
    if _redis_client is not None:
        try:
            _redis_client.setex(f"upload_owner:{file_id}", 24 * 3600, uid)
            _redis_client.setex(f"upload_meta:{file_id}", 24 * 3600, json.dumps(metadata))
            persisted = True
        except Exception:
            pass
    db = get_db()
    if db:
        try:
            db.collection("uploads").document(file_id).set(metadata, merge=True)
            persisted = True
        except Exception as e:
            _json_log("warning", "upload_owner_persist_failed", file_id=file_id, uid=uid, error=str(e))
    return persisted


def _update_upload_metadata(file_id: str, values: Dict[str, Any]) -> Dict[str, Any]:
    metadata = {**_load_upload_metadata(file_id), **values}
    if _redis_client is not None:
        try:
            _redis_client.setex(f"upload_meta:{file_id}", 24 * 3600, json.dumps(metadata))
        except Exception as error:
            _json_log("warning", "upload_metadata_cache_failed", file_id=file_id,
                      error_type=type(error).__name__)
    db = get_db()
    if db:
        db.collection("uploads").document(file_id).set(values, merge=True)
    return metadata


def _mark_upload_security_state(file_id: str, uid: str, state: str,
                                *, scanned_at: str = "") -> Dict[str, Any]:
    values: Dict[str, Any] = {"upload_state": state}
    if scanned_at:
        values["security_scanned_at"] = scanned_at
    metadata = _update_upload_metadata(file_id, values)
    remote_path = str(metadata.get("remote_path") or "")
    if remote_path:
        set_source_upload_state(uid, file_id, remote_path, state)
    return metadata


def _assert_upload_clean(file_id: str) -> Dict[str, Any]:
    return _upload_security_service().assert_clean(file_id)


def _ensure_upload_clean(file_id: str, uid: str, input_path: str) -> Dict[str, Any]:
    return _upload_security_service().ensure_clean(file_id, uid, input_path)


def _source_media_identity(file_id: str, input_path: str) -> str:
    return _upload_security_service().source_identity(file_id, input_path)


def _assert_upload_owner(file_id: str, uid: str):
    if not file_id or not uid:
        raise HTTPException(status_code=401, detail="Authentication required")
    owner = _upload_owners.get(file_id)
    if not owner and _redis_client is not None:
        try:
            owner = _redis_client.get(f"upload_owner:{file_id}") or ""
        except Exception:
            owner = ""
    if not owner:
        owner = str(_load_upload_metadata(file_id).get("uid") or "")
    if not owner:
        # Ownership must be provable. Failing open here lets any authenticated
        # caller reuse a known upload UUID after a restart or metadata outage.
        raise HTTPException(status_code=403, detail="Upload ownership could not be verified")
    if owner != uid:
        raise HTTPException(status_code=403, detail="You do not have access to this upload")


def _media_token_signature(payload_b64: str) -> str:
    secret = MEDIA_URL_SIGNING_SECRET.encode("utf-8")
    return hmac.new(secret, payload_b64.encode("utf-8"), hashlib.sha256).hexdigest()


def _create_media_token(payload: Dict[str, Any]) -> str:
    payload_b64 = base64.urlsafe_b64encode(
        json.dumps(payload, separators=(",", ":"), default=str).encode("utf-8")
    ).decode("ascii").rstrip("=")
    return f"{payload_b64}.{_media_token_signature(payload_b64)}"


def _verify_media_token(token: str, expected_kind: str) -> Dict[str, Any]:
    try:
        payload_b64, supplied_sig = (token or "").split(".", 1)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid media token")
    expected_sig = _media_token_signature(payload_b64)
    if not supplied_sig or not hmac.compare_digest(expected_sig, supplied_sig):
        raise HTTPException(status_code=401, detail="Invalid media token")
    try:
        padded = payload_b64 + ("=" * (-len(payload_b64) % 4))
        payload = json.loads(base64.urlsafe_b64decode(padded.encode("ascii")).decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid media token")
    if payload.get("kind") != expected_kind:
        raise HTTPException(status_code=403, detail="Media token is not valid for this resource")
    if int(payload.get("exp", 0) or 0) < int(time.time()):
        raise HTTPException(status_code=401, detail="Media token expired")
    return payload


def _signed_upload_url(file_id: str, uid: str, ttl_seconds: int = 6 * 3600) -> str:
    token = _create_media_token({
        "kind": "upload",
        "uid": uid,
        "file_id": file_id,
        "exp": int(time.time() + ttl_seconds),
    })
    return f"/api/media/upload/{file_id}?token={token}"


def _signed_export_url(filename: str, uid: str, ttl_seconds: int, cache_bust: str = "",
                       download_filename: str = "") -> str:
    token = _create_media_token({
        "kind": "export",
        "uid": uid,
        "filename": filename,
        **({"download_filename": download_filename[:180]} if download_filename else {}),
        "exp": int(time.time() + max(ttl_seconds, 60)),
    })
    suffix = f"&v={cache_bust}" if cache_bust else ""
    return f"/api/media/export/{filename}?token={token}{suffix}"


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
    refreshed["video_url"] = _signed_export_url(
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
        direct_url = (signed_export_download_url(f"exports/{uid}/{filename}", recovery_ttl_seconds, desired_filename)
                      if desired_filename else signed_export_download_url(f"exports/{uid}/{filename}", recovery_ttl_seconds))
        if not direct_url:
            raise HTTPException(status_code=503, detail="Export download is temporarily unavailable. Resume to retry.")
        refreshed["download_url"] = direct_url
    refreshed["download_url_expires_at"] = (
        _utcnow() + timedelta(seconds=recovery_ttl_seconds)
    ).isoformat() + "Z"
    return refreshed


def _compute_media_hash(file_path: str) -> str:
    digest = hashlib.sha256()
    with open(file_path, "rb") as f:
        while True:
            chunk = f.read(1024 * 1024)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()


def _upload_security_service() -> UploadSecurityService:
    return UploadSecurityService(
        load_metadata=_load_upload_metadata,
        mark_state=_mark_upload_security_state,
        scan=_scan_upload_for_threat,
        delete_remote=delete_from_firebase_storage,
        utc_timestamp=lambda: _utcnow().isoformat() + "Z",
        compute_hash=_compute_media_hash,
        update_metadata=_update_upload_metadata,
    )


def _build_process_cache_path(media_hash: str, language: str, min_words: int, max_words: int) -> str:
    key = f"{media_hash}:{language.lower()}:{min_words}:{max_words}"
    key_hash = hashlib.sha256(key.encode("utf-8")).hexdigest()
    return os.path.join(TRANSCRIPTION_CACHE_DIR, f"{key_hash}.json")

def _build_parity_signature(captions: List[Dict[str, Any]], style: Dict[str, Any], word_layouts: Dict[str, Any]) -> str:
    payload = {
        "captions": captions,
        "style": style,
        "word_layouts": word_layouts,
    }
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=True, default=str)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _validate_media_signature(file_path: str):
    with open(file_path, "rb") as media:
        header = media.read(32)
    valid = (
        (len(header) >= 12 and header[4:8] in {b"ftyp", b"moov", b"mdat", b"wide", b"free"})
        or header.startswith(b"\x1aE\xdf\xa3")  # Matroska / WebM
        or (header.startswith(b"RIFF") and header[8:12] in {b"WAVE", b"AVI "})
        or header.startswith(b"ID3")
        or (len(header) >= 2 and header[0] == 255 and header[1] & 0xE0 == 0xE0)
    )
    if not valid:
        raise ValueError("Unsupported or malformed media signature.")


def _probe_media(file_path: str) -> Dict[str, Any]:
    _validate_media_signature(file_path)
    cmd = [
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration,format_name",
        "-show_entries", "stream=codec_type,codec_name,width,height,duration",
        "-of", "json", file_path
    ]
    result = run_media_command(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise ValueError("Unable to inspect media file with ffprobe.")
    try:
        meta = json.loads(result.stdout or "{}")
    except Exception:
        raise ValueError("Invalid ffprobe output.")
    streams = meta.get("streams", []) or []
    if not streams:
        raise ValueError("No media streams found.")
    if not any(s.get("codec_type") in ("video", "audio") for s in streams):
        raise ValueError("Unsupported media stream type.")
    try:
        duration = float((meta.get("format") or {}).get("duration") or 0)
    except Exception:
        duration = 0.0
    if not math.isfinite(duration) or duration <= 0:
        raise ValueError("Media duration is invalid.")
    for stream in streams:
        if stream.get("codec_type") == "video":
            width, height = int(stream.get("width") or 0), int(stream.get("height") or 0)
            # Accept up to 4K UHD in either orientation; bound decoded pixels.
            if min(width, height) <= 0 or max(width, height) > 4096 or width * height > 3840 * 2160:
                raise ValueError("Video resolution exceeds the supported 4K pixel limit.")
    return meta


def _normalize_tier_name(tier: str) -> str:
    t = (tier or "free").strip().lower()
    if t in PLAN_EXPORT_PRESETS:
        return t
    if t in ("professional", "business", "pro_plus"):
        return "pro"
    return "free"


def _normalize_free_credit_balance(value: Any, *, default: int = 0) -> int:
    """Keep a Free entitlement inside the catalog-defined 0..N range."""
    try:
        credits = int(value)
    except (TypeError, ValueError):
        credits = int(default)
    return max(0, min(FREE_PLAN_CREDITS, credits))


def _subscription_is_expired(user_data: Optional[Dict[str, Any]], now: Optional[datetime] = None) -> bool:
    data = user_data or {}
    tier = _normalize_tier_name(data.get("subscription_tier", "free"))
    if tier == "free":
        return False
    expiry_value = str(
        data.get("subscription_expiry")
        or data.get("billing_cycle_end")
        or ""
    ).strip()
    if not expiry_value:
        # Paid access without an expiry timestamp cannot be verified safely.
        # Payment and promotion flows are responsible for writing this field.
        return True
    try:
        expiry = datetime.fromisoformat(expiry_value.replace("Z", "+00:00"))
        if expiry.tzinfo is None:
            expiry = expiry.replace(tzinfo=timezone.utc)
        comparison_time = now or datetime.now(timezone.utc)
        if comparison_time.tzinfo is None:
            comparison_time = comparison_time.replace(tzinfo=timezone.utc)
        return expiry <= comparison_time.astimezone(expiry.tzinfo)
    except (TypeError, ValueError):
        # Malformed paid-plan expiry data must not silently grant indefinite
        # entitlements. Repairing the account timestamp restores access.
        return True


def _effective_subscription_tier(user_data: Optional[Dict[str, Any]], now: Optional[datetime] = None) -> str:
    tier = _normalize_tier_name((user_data or {}).get("subscription_tier", "free"))
    return "free" if _subscription_is_expired(user_data, now) else tier


def _lookup_subscription_tier(uid: str) -> str:
    """Best-effort read of the caller's current subscription tier from Firestore.
    Returns 'free' when the DB or user record is unavailable."""
    if not uid:
        return "free"
    db = get_db()
    if not db:
        return "free"
    try:
        snap = db.collection("users").document(uid).get()
        if snap.exists:
            return _effective_subscription_tier(snap.to_dict() or {})
    except Exception:
        pass
    return "free"


def _max_video_seconds_for_tier(tier: str) -> int:
    """Per-plan source-video length cap. Falls back to the global 180s ceiling
    for tiers (including 'free') that don't advertise a tighter limit."""
    return int(PLAN_PRICING.get(tier, {}).get("max_video_seconds", 180) or 180)


AI_DAILY_LIMITS = {
    "free": {"process": 3, "translate": 5, "detect_language": 3},
    "starter": {"process": 10, "translate": 20, "detect_language": 10},
    "creator": {"process": 30, "translate": 60, "detect_language": 30},
    "pro": {"process": 100, "translate": 200, "detect_language": 100},
}


# Free accounts get a fixed number of transcriptions for the life of the
# account, not a daily refill: a trial, not a free tier that costs money forever.
FREE_LIFETIME_TRANSCRIPTIONS = int(FREE_PLAN.get("lifetime_transcriptions", 3) or 3)


def _reserve_system_ai_quota(db, operation: str) -> None:
    """Reserve one call against the platform-wide daily AI ceiling.

    Separate document from the per-user counter so the two can't contend. In
    production a counter outage fails closed: this ceiling is the last guard on
    paid-provider spend, so an unreadable counter must not mean unlimited calls.
    """
    if AI_SYSTEM_DAILY_LIMIT <= 0:
        return
    today = date.today().isoformat()
    usage_ref = db.collection(SERVICE_CONTROL_COLLECTION).document(f"ai_usage_{today}")

    @firestore.transactional
    def reserve_system(txn):
        snap = usage_ref.get(transaction=txn)
        data = snap.to_dict() if snap.exists else {}
        total = int((data or {}).get("total", 0) or 0)
        if total >= AI_SYSTEM_DAILY_LIMIT:
            raise HTTPException(
                status_code=503,
                detail="Lekha Captions has hit today's processing capacity. Please try again tomorrow.",
            )
        by_op = dict((data or {}).get("by_operation") or {})
        by_op[operation] = int(by_op.get(operation, 0) or 0) + 1
        txn.set(usage_ref, {
            "date": today,
            "total": total + 1,
            "by_operation": by_op,
            "limit": AI_SYSTEM_DAILY_LIMIT,
            "updated_at": _utcnow().isoformat() + "Z",
            "expire_at": _retention_deadline(30),
        }, merge=True)

    try:
        reserve_system(db.transaction())
    except HTTPException:
        _json_log("error", "ai_system_daily_limit_reached", operation=operation, limit=AI_SYSTEM_DAILY_LIMIT)
        _track_event("ai_system_daily_limit_reached", {"operation": operation})
        raise
    except Exception as e:
        _json_log("warning", "ai_system_quota_reserve_failed", operation=operation, error=str(e))
        if _IS_PRODUCTION:
            raise HTTPException(status_code=503, detail="AI quota service is temporarily unavailable") from e


def _reserve_ai_quota(uid: str, operation: str) -> None:
    """Atomically reserve one daily paid-provider call before invoking it."""
    if operation not in {"process", "translate", "detect_language"}:
        raise HTTPException(status_code=400, detail="Unknown AI operation")
    if _IS_TEST:
        return
    db = get_db()
    if not db:
        if _IS_PRODUCTION:
            raise HTTPException(status_code=503, detail="AI quota service is temporarily unavailable")
        return

    user_ref = db.collection("users").document(uid)
    transaction = db.transaction()
    today = date.today().isoformat()

    @firestore.transactional
    def reserve(txn):
        snap = user_ref.get(transaction=txn)
        data = snap.to_dict() if snap.exists else {}
        # Expired paid accounts receive free-tier provider quotas. Export policy
        # already treats them as free; using the raw stored tier here would let an
        # expired Pro account keep Pro transcription/translation capacity.
        tier = _effective_subscription_tier(data or {})
        base_tier = tier.replace("_yearly", "")
        limits = AI_DAILY_LIMITS.get(base_tier, AI_DAILY_LIMITS["free"])
        limit = int(limits[operation])
        usage = dict((data or {}).get("ai_daily_usage") or {}) if (data or {}).get("ai_usage_date") == today else {}
        used = int(usage.get(operation, 0) or 0)
        update = {}
        if base_tier == "free" and operation == "process":
            lifetime = dict((data or {}).get("ai_lifetime_usage") or {})
            lifetime_used = int(lifetime.get("process", 0) or 0)
            if lifetime_used >= FREE_LIFETIME_TRANSCRIPTIONS:
                raise HTTPException(
                    status_code=402,
                    detail=(
                        f"FREE_TRANSCRIPTIONS_USED: You've used your {FREE_LIFETIME_TRANSCRIPTIONS} free "
                        "transcriptions. Upgrade to keep captioning."
                    ),
                )
            lifetime["process"] = lifetime_used + 1
            update["ai_lifetime_usage"] = lifetime
        if used >= limit:
            raise HTTPException(
                status_code=429,
                detail=f"Daily {operation.replace('_', ' ')} quota reached for this plan",
            )
        usage[operation] = used + 1
        txn.set(user_ref, {
            "uid": uid,
            "ai_usage_date": today,
            "ai_daily_usage": usage,
            **update,
            "updated_at": _utcnow().isoformat() + "Z",
        }, merge=True)

    reserve(transaction)

    # Platform ceiling is charged only after the per-user reservation succeeds,
    # so a user who is already over their own quota never consumes shared
    # capacity. If the platform is full, hand the user's reservation back.
    try:
        _reserve_system_ai_quota(db, operation)
    except HTTPException:
        _release_ai_quota(uid, operation, release_system=False)
        raise


def _read_system_ai_usage(db) -> Dict[str, Any]:
    """Today's platform-wide AI spend, for the operator dashboard."""
    today = date.today().isoformat()
    snapshot = {
        "date": today,
        "total": 0,
        "by_operation": {},
        "limit": AI_SYSTEM_DAILY_LIMIT,
        "remaining": AI_SYSTEM_DAILY_LIMIT,
    }
    if not db or AI_SYSTEM_DAILY_LIMIT <= 0:
        return snapshot
    try:
        snap = (
            db.collection(SERVICE_CONTROL_COLLECTION)
            .document(f"ai_usage_{today}")
            .get()
        )
        if snap.exists:
            data = snap.to_dict() or {}
            total = int(data.get("total", 0) or 0)
            snapshot["total"] = total
            snapshot["by_operation"] = dict(data.get("by_operation") or {})
            snapshot["remaining"] = max(0, AI_SYSTEM_DAILY_LIMIT - total)
    except Exception as e:
        _json_log("warning", "ai_system_usage_read_failed", error=str(e))
    return snapshot


def _release_system_ai_quota(db, operation: str) -> None:
    """Return one call to the platform-wide daily ceiling. Best-effort."""
    if AI_SYSTEM_DAILY_LIMIT <= 0:
        return
    today = date.today().isoformat()
    usage_ref = db.collection(SERVICE_CONTROL_COLLECTION).document(f"ai_usage_{today}")

    @firestore.transactional
    def release_system(txn):
        snap = usage_ref.get(transaction=txn)
        if not snap.exists:
            return
        data = snap.to_dict() or {}
        # A UTC date rollover means this document is no longer today's counter.
        if data.get("date") != today:
            return
        total = int(data.get("total", 0) or 0)
        if total <= 0:
            return
        by_op = dict(data.get("by_operation") or {})
        by_op[operation] = max(0, int(by_op.get(operation, 0) or 0) - 1)
        txn.set(usage_ref, {
            "total": total - 1,
            "by_operation": by_op,
            "updated_at": _utcnow().isoformat() + "Z",
        }, merge=True)

    try:
        release_system(db.transaction())
    except Exception as e:
        _json_log("warning", "ai_system_quota_release_failed", operation=operation, error=str(e))


def _release_ai_quota(uid: str, operation: str, release_system: bool = True) -> None:
    """Give back a reserved daily call when the paid provider never delivered.

    Quota is reserved *before* the provider call so a burst of concurrent
    requests can't overshoot the plan limit. When the call then fails for a
    reason that is ours (provider error, circuit trip, extraction failure), the
    reservation must be returned — otherwise a user burns their whole daily
    allowance on our outage. User-caused rejections (no speech in the audio,
    unsupported input) are *not* released: the provider still ran and billed us.

    Best-effort by design: a failed release must never mask the original error,
    and the counter self-heals at the next UTC date rollover.
    """
    if operation not in {"process", "translate", "detect_language"}:
        return
    if _IS_TEST or not uid:
        return
    db = get_db()
    if not db:
        return

    user_ref = db.collection("users").document(uid)
    today = date.today().isoformat()

    @firestore.transactional
    def release(txn):
        snap = user_ref.get(transaction=txn)
        if not snap.exists:
            return
        data = snap.to_dict() or {}
        update = {}
        # A failed free transcription must not use up the account's trial.
        lifetime = dict(data.get("ai_lifetime_usage") or {})
        lifetime_used = int(lifetime.get(operation, 0) or 0)
        if operation == "process" and lifetime_used > 0 and _effective_subscription_tier(data).replace("_yearly", "") == "free":
            lifetime[operation] = lifetime_used - 1
            update["ai_lifetime_usage"] = lifetime
        # A date rollover between reserve and release already zeroed the counter.
        usage = dict(data.get("ai_daily_usage") or {})
        used = int(usage.get(operation, 0) or 0)
        if data.get("ai_usage_date") == today and used > 0:
            usage[operation] = used - 1
            update["ai_daily_usage"] = usage
        if not update:
            return
        txn.set(user_ref, {
            **update,
            "updated_at": _utcnow().isoformat() + "Z",
        }, merge=True)

    try:
        release(db.transaction())
        _json_log("info", "ai_quota_released", uid=uid, operation=operation)
    except Exception as e:
        _json_log("warning", "ai_quota_release_failed", uid=uid, operation=operation, error=str(e))

    if release_system:
        _release_system_ai_quota(db, operation)


def _resolve_export_preset(tier: str, requested_quality: str, requested_fps: int) -> Dict[str, Any]:
    normalized = "pro" if DISABLE_EXPORT_CREDIT_LIMIT else _normalize_tier_name(tier)
    preset = PLAN_EXPORT_PRESETS.get(normalized, PLAN_EXPORT_PRESETS["free"])

    req_quality = (requested_quality or "1080p").lower()
    if req_quality not in QUALITY_RANK:
        req_quality = "1080p"
    max_quality = preset["max_quality"]
    quality = max_quality if QUALITY_RANK[req_quality] > QUALITY_RANK[max_quality] else req_quality

    requested_fps = int(requested_fps or 30)
    fps_options = sorted(list(preset["fps_options"]))
    fps = requested_fps if requested_fps in preset["fps_options"] else min(fps_options, key=lambda x: abs(x - requested_fps))

    return {
        "tier": normalized,
        "quality": quality,
        "fps": fps,
        "downgraded": (quality != req_quality or fps != requested_fps),
    }

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

class CaptionItem(BaseModel):
    model_config = {"populate_by_name": True}

    id: Any
    text: str = Field(max_length=2_000)
    start_time: float
    end_time: float
    animation: str = Field(default="none", max_length=50)
    animation_speed: float = Field(default=1, ge=0.1, le=4)
    is_text_element: bool = False
    custom_style: Optional[Dict[str, Any]] = Field(default=None, max_length=200)
    template_id: str = Field(default="", max_length=100)
    template_20_id: str = Field(default="", max_length=100)
    template_source: str = Field(default="", max_length=100)
    template_class: str = Field(default="", max_length=200)
    template_name: str = Field(default="", max_length=200)
    template_layout: str = Field(default="", max_length=100)
    template_effect: str = Field(default="", max_length=100)
    template_markup: str = Field(default="", max_length=100_000)
    applied_template_style: Optional[Dict[str, Any]] = Field(default=None, max_length=200)
    word_styles: Dict[str, Any] = Field(default_factory=dict, max_length=2_000)
    words: List[Any] = Field(default_factory=list, max_length=2_000)
    template_index: Optional[int] = Field(default=None, alias="__templateIndex")
    template_phase_index: Optional[int] = None
    imp_word_index: int = -1
    imp_word_indices: List[Any] = Field(default_factory=list, max_length=100)
    emphasis_color: str = Field(default="", max_length=50)
    emotional_mode: str = Field(default="", max_length=50)
    audio_emotion_metrics: Optional[Dict[str, Any]] = Field(default=None, max_length=100)
    # Legacy clients may still send preview measurements. They are accepted for
    # a rolling upgrade, then stripped before hashing, queueing, and rendering.
    preview_template_line_texts: List[str] = Field(default_factory=list, max_length=50)
    preview_template_font_px: float = Field(default=0, ge=0, le=1_000)
    preview_template_box_width_px: float = Field(default=0, ge=0, le=10_000)
    preview_template_box_height_px: float = Field(default=0, ge=0, le=10_000)

    @model_validator(mode="after")
    def validate_renderable_caption(self):
        if not self.text.strip():
            raise ValueError("Caption text must not be empty")
        if not math.isfinite(self.start_time) or not math.isfinite(self.end_time):
            raise ValueError("Caption timestamps must be finite")
        if self.start_time < 0:
            raise ValueError("Caption start_time must be non-negative")
        if self.end_time <= self.start_time:
            raise ValueError("Caption end_time must be greater than start_time")
        if self.template_markup and re.search(
            r"<(?:script|iframe|object|embed|img|svg|link|meta|base|form|input|button|video|audio|source)\b|"
            r"\bon[a-z0-9_-]+\s*=|\b(?:src|href|srcdoc)\s*=|(?:url\s*\(|@import)",
            self.template_markup,
            flags=re.IGNORECASE,
        ):
            raise ValueError("Template markup contains unsafe elements or attributes")
        return self

class ExportRequest(BaseModel):
    file_id: str = Field(min_length=36, max_length=36)
    captions: List[CaptionItem] = Field(min_length=1, max_length=1000)
    style: Dict[str, Any] = Field(default_factory=dict, max_length=250)
    # Backward-compatible input only. Browser-measured layout is intentionally
    # ignored; the worker derives layout from normalized editor state.
    word_layouts: Dict[str, Any] = Field(default_factory=dict, max_length=5_000)
    waveform_data: List[float] = Field(default_factory=list, max_length=50_000)
    duration: float = Field(default=0, ge=0, le=4 * 60 * 60)
    id_token: str = Field(default="", max_length=8_192)
    idempotency_key: str = Field(default="", max_length=200)
    quality: str = Field(default="1080p", pattern=r"^(4k|1080p|720p)$")
    fps: int = Field(default=30, ge=24, le=60)
    export_aspect_ratio: str = Field(default="", pattern=r"^(|9:16|1:1|16:9)$")
    org_id: str = Field(default="", max_length=128)

    def validated_style(self) -> Dict[str, Any]:
        """Return a copy of style with all numeric fields clamped to safe ranges."""
        s = _strip_client_render_hints(self.style)
        _num_clamps = {
            'frame_x':                 (0,   100),
            'frame_y':                 (0,   100),
            'font_size':               (8,   200),
            'position_x':              (0,   100),
            'position_y':              (0,   100),
            'background_padding':      (0,   100),
            'background_h_multiplier': (0.5, 3.0),
            'shadow_blur':             (0,   50),
            'shadow_offset_x':         (-50, 50),
            'shadow_offset_y':         (-50, 50),
            'letter_spacing':          (-10, 20),
            'word_spacing':            (0,   20),
            'line_spacing':            (0.5, 4.0),
            'text_opacity':            (0,   1),
            'scale':                   (0.1, 5.0),
            'box_width':               (0,   2_000),
            'stroke_width':            (0,   20),
            'line_height':             (0.5, 4.0),
            'outline_width':           (0,   20),
        }
        for field, (lo, hi) in _num_clamps.items():
            if field in s:
                try:
                    s[field] = max(lo, min(hi, float(s[field])))
                except (TypeError, ValueError):
                    del s[field]
        if s.get('frame_fit') not in ('cover', 'contain', None):
            s.pop('frame_fit', None)
        if s.get('quality') not in ('4k', '1080p', '720p', None):
            s.pop('quality', None)
        if s.get('export_aspect_ratio') not in ('9:16', '1:1', '16:9', '', None):
            s.pop('export_aspect_ratio', None)
        return s


class BatchExportRequest(BaseModel):
    id_token: str = Field(default="", max_length=8_192)
    idempotency_key: str = Field(min_length=1, max_length=200)
    exports: List[ExportRequest] = Field(min_length=1, max_length=10)

class CreateOrderRequest(BaseModel):
    require_test_mode: bool = False
    plan_id: str = Field(min_length=1, max_length=50)
    id_token: str = Field(min_length=1, max_length=8_192)
    currency: str = Field(default="INR", pattern=r"^(?i:INR|USD)$")
    idempotency_key: str = Field(default="", max_length=200)
    org_id: str = Field(default="", max_length=128)

class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str = Field(min_length=1, max_length=100)
    razorpay_payment_id: str = Field(min_length=1, max_length=100)
    razorpay_signature: str = Field(min_length=1, max_length=256)
    id_token: str = Field(min_length=1, max_length=8_192)
    plan_id: str = Field(default="", max_length=50)
    idempotency_key: str = Field(default="", max_length=200)
    org_id: str = Field(default="", max_length=128)

class ReconcilePaymentsRequest(BaseModel):
    id_token: str = Field(default="", max_length=8_192)
    lookback_hours: int = Field(default=PAYMENT_RECONCILE_LOOKBACK_HOURS, ge=1, le=24 * 90)
    limit: int = Field(default=PAYMENT_RECONCILE_BATCH_SIZE, ge=1, le=1_000)

class AdminRecoveryRequest(BaseModel):
    id_token: str = Field(default="", max_length=8_192)
    limit: int = Field(default=50, ge=1, le=1_000)

class AdminAlertTestRequest(BaseModel):
    id_token: str = Field(default="", max_length=8_192)

class ServiceControlsRequest(BaseModel):
    """Partial update: omitted switches keep their current value."""
    id_token: str = Field(default="", max_length=8_192)
    maintenance_mode: Optional[bool] = None
    pause_signups: Optional[bool] = None
    pause_payments: Optional[bool] = None
    pause_uploads: Optional[bool] = None
    pause_transcription: Optional[bool] = None
    pause_exports: Optional[bool] = None
    max_upload_duration_seconds: Optional[int] = Field(default=None, ge=15, le=GLOBAL_MAX_UPLOAD_DURATION_SECONDS)
    notice: Optional[str] = Field(default=None, max_length=SERVICE_CONTROL_NOTICE_MAX)

class TenantBackfillRequest(BaseModel):
    id_token: str = Field(default="", max_length=8_192)
    limit: int = Field(default=500, ge=1, le=500)
    cursor: str = Field(default="", max_length=1_500)


class SupportRequest(BaseModel):
    account_email: str = Field(min_length=3, max_length=320)
    issue_type: str = Field(min_length=2, max_length=80)
    job_id: str = Field(default="", max_length=128)
    payment_id: str = Field(default="", max_length=128)
    browser_device: str = Field(min_length=2, max_length=300)
    media_details: str = Field(default="", max_length=500)
    description: str = Field(min_length=10, max_length=5_000)

class ProcessRequest(BaseModel):
    file_id: str = Field(min_length=36, max_length=36)
    language: str = Field(default="English", max_length=50)
    min_words: int = Field(default=0, ge=0, le=20)
    max_words: int = Field(default=0, ge=0, le=20)
    id_token: str = Field(default="", max_length=8_192)
    # A stable key lets a browser safely retry after it loses the response while
    # the transcription is still running.  It is intentionally optional for
    # backwards-compatible API clients.
    idempotency_key: str = Field(default="", max_length=200)
    org_id: str = Field(default="", max_length=128)

    @model_validator(mode="after")
    def validate_word_range(self):
        if self.min_words > 0 and self.max_words > 0 and self.min_words > self.max_words:
            raise ValueError("min_words must be less than or equal to max_words")
        return self

app.include_router(create_project_router(
    _authenticate_media_request,
    get_db,
    _validate_file_id,
    _assert_upload_owner,
))


class MediaUrlRequest(BaseModel):
    file_id: str = Field(min_length=36, max_length=36)
    id_token: str = Field(default="", max_length=8_192)
    org_id: str = Field(default="", max_length=128)

class TranslateRequest(BaseModel):
    captions: List[Dict[str, Any]] = Field(min_length=1, max_length=500)
    target_language: str = Field(min_length=2, max_length=50)
    id_token: str = Field(default="", max_length=8_192)
    org_id: str = Field(default="", max_length=128)


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
        "timestamp": _utcnow().isoformat() + "Z",
    }
    try:
        with open(os.path.join(DEAD_LETTER_DIR, f"{job_id}.json"), "w", encoding="utf-8") as f:
            json.dump(data, f)
    except Exception as e:
        _json_log("warning", "dead_letter_file_write_failed", job_id=job_id, error=str(e))

    db = get_db()
    if db:
        try:
            db.collection("export_dead_letter").document(job_id).set(
                {**data, "expire_at": _retention_deadline(30)}, merge=True
            )
        except Exception as e:
            _json_log("warning", "dead_letter_db_write_failed", job_id=job_id, error=str(e))


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


def _strip_client_render_hints(value: Any) -> Any:
    """Return editor state without browser-derived rendering measurements."""
    if isinstance(value, dict):
        return {
            key: _strip_client_render_hints(item)
            for key, item in value.items()
            if key not in _CLIENT_RENDER_HINT_FIELDS
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
            should_use_dom = bool(processor._should_use_dom_template_renderer(style, captions))
        except Exception:
            should_use_dom = False
        debug_payload = {
            "renderer_version": EXPORT_RENDERER_VERSION,
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
            "written_at": _utcnow().isoformat() + "Z",
        }
        with open(os.path.join(CACHE_DIR, "last_export_request_debug.json"), "w", encoding="utf-8") as f:
            json.dump(debug_payload, f, indent=2, ensure_ascii=False)
    except Exception as e:
        _json_log("warning", "last_export_request_debug_write_failed", error=str(e))


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
    if _is_explicit_dev_auth_token(token) and owner_uid == "dev-local-user":
        return owner_uid

    decoded = verify_token(token) if token else None
    if decoded:
        request_uid = (decoded.get("uid") or "").strip()
        if request_uid != owner_uid:
            raise HTTPException(status_code=403, detail="You do not have access to this export job")
        return request_uid

    db = get_db()
    if db is None and _is_explicit_dev_auth_token(token) and owner_uid == "dev-local-user":
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


async def _process_export_job_core(req: ExportRequest, uid: str, rid: str, export_job_id: str):
    _assert_account_not_deleting(uid)
    queue_entered_at, processing_started_at = _mark_export_processing(export_job_id)
    db = get_db()
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
            if _IS_PRODUCTION:
                raise HTTPException(status_code=409, detail="Account no longer exists.")
            _log(rid, f"User {uid} missing in Firestore; auto-creating defaults")
            default_user = {
                'credits_remaining': FREE_PLAN_CREDITS,
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
                _log(rid, f"Promo expiry check failed: {e}")

        allowed, policy_error, recent_exports = _evaluate_export_policy(user_data, now)
        if not allowed:
            raise HTTPException(status_code=403 if "UPGRADE_REQUIRED" in policy_error or "PLAN_EXPIRED" in policy_error else 429, detail=policy_error)
        try:
            credits = max(0, int(user_data.get('credits_remaining', 0) or 0))
        except (TypeError, ValueError):
            credits = 0
    else:
        if not ALLOW_EXPORT_WITHOUT_DB:
            # Rendering is a metered operation. Continuing without the source of
            # truth for credits turns a database outage into a billing bypass.
            raise HTTPException(status_code=503, detail="Account and credit service is temporarily unavailable")
        _log(rid, "Firestore unavailable; explicit local export bypass enabled")

    user_tier = _normalize_tier_name(user_data.get("subscription_tier", "free") if user_data else "free")
    preset = _resolve_export_preset(user_tier, req.quality, req.fps)
    if preset["downgraded"]:
        _log(rid, f"Export preset adjusted by tier={user_tier}: requested {req.quality}@{req.fps} -> {preset['quality']}@{preset['fps']}")

    if not _validate_file_id(req.file_id):
        raise HTTPException(status_code=400, detail="Invalid file_id")
    _assert_upload_owner(req.file_id, uid)
    _assert_upload_clean(req.file_id)
    input_path = _safe_find_upload(req.file_id)
    if not input_path:
        raise HTTPException(status_code=404, detail="Video not found")

    source_meta = _probe_media(input_path)
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
    media_hash = _source_media_identity(req.file_id, input_path)
    request_hash = render_cache_identity(
        uid=uid,
        renderer_version=EXPORT_RENDERER_VERSION,
        media_hash=media_hash,
        captions=captions,
        style=server_style,
        quality=preset["quality"],
        fps=preset["fps"],
        export_aspect_ratio=req.export_aspect_ratio,
    )
    cached_render_path = os.path.join(RENDER_CACHE_DIR, f"{request_hash}.mp4")
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
    output_path = os.path.join(EXPORT_DIR, output_filename)
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
            download_render_cache, uid, request_hash, cached_render_path,
        )
    if os.path.exists(cached_render_path) and cache_eligible:
        shutil.copy2(cached_render_path, output_path)
        render_finished_at = time.time()
        render_ms = int((render_finished_at - render_started_at) * 1000)
        cache_hit = True
        _track_event("render_cache_hit", {"job_id": export_job_id})
    else:
        cache_hit = False
        _log(rid, f"Starting render now job={export_job_id}")
        async with render_semaphore:
            result = await processor.burn_only(
                input_path, output_path, captions, style_with_quality, server_word_layouts
            )
        if not result.get('success'):
            _json_log("error", "video_render_failed", uid=uid, error=str(result.get('error') or "unknown"))
            raise HTTPException(status_code=500, detail="Video render failed")
        render_finished_at = time.time()
        render_ms = int((render_finished_at - render_started_at) * 1000)

    try:
        rendered_meta = _probe_media(output_path)
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
            await asyncio.to_thread(delete_render_cache, uid, request_hash)
        _json_log("error", "render_output_validation_failed", uid=uid, job_id=export_job_id, error=str(e))
        raise HTTPException(status_code=500, detail="Rendered video failed validation") from e

    if not cache_hit and cache_eligible:
        try:
            shutil.copy2(output_path, cached_render_path)
            await asyncio.to_thread(
                upload_render_cache, uid, request_hash, cached_render_path, 24,
            )
        except Exception as error:
            _json_log(
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
        if current_tier in PLAN_PRICING:
            retention_hours = PLAN_PRICING[current_tier].get('export_retention_hours', 2)
    try:
        remote_path = f"exports/{uid}/{output_filename}"
        firebase_url = upload_to_firebase_storage(
            output_path, remote_path, "video/mp4", retention_hours
        )
    except Exception as e:
        _log(rid, f"Firebase upload failed, using local export: {e}")

    if _IS_PRODUCTION and not firebase_url:
        raise HTTPException(status_code=503, detail="Rendered media could not be persisted. Please retry.")
    expires_at = (_utcnow() + timedelta(hours=retention_hours)).isoformat() + "Z"
    video_url = _signed_export_url(
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
                delete_from_firebase_storage(dropped_path)

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
        _json_log(
            "warning", "export_notification_persist_failed",
            job_id=export_job_id, error=type(error).__name__,
        )
    _json_log(
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
    _track_event("export_success", {"quality": preset["quality"], "fps": preset["fps"], "tier": preset["tier"]})
    _track_operational_metric_sample("export_total_ms", total_ms)
    _track_operational_metric_sample("export_render_ms", render_ms)
    _track_operational_metric_sample(
        "job_cost_usd",
        (rendered_duration / 60.0) * RENDER_COST_ESTIMATE_PER_MEDIA_MINUTE_USD,
    )
    return payload


EXPORT_SLOT_WAIT_INTERVAL_SECONDS = 15
EXPORT_SLOT_WAIT_MAX_ATTEMPTS = max(1, EXPORT_SLOT_TTL_SECONDS // EXPORT_SLOT_WAIT_INTERVAL_SECONDS)


def _export_slot_wait_retry():
    """An RQ Retry result for a job waiting on its account slot, or None outside RQ."""
    if RQRetry is None:
        return None
    try:
        from rq import get_current_job
        if get_current_job() is None:
            return None
    except Exception:
        return None
    return RQRetry(max=EXPORT_SLOT_WAIT_MAX_ATTEMPTS, interval=EXPORT_SLOT_WAIT_INTERVAL_SECONDS)


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


def _cleanup_incomplete_upload(local_path: str = "", remote_path: str = ""):
    if local_path:
        try:
            if os.path.exists(local_path):
                os.remove(local_path)
        except OSError as cleanup_error:
            _json_log("warning", "upload_local_cleanup_failed", error=str(cleanup_error))
    if remote_path:
        try:
            if not delete_from_firebase_storage(remote_path):
                _json_log("warning", "upload_remote_cleanup_failed", remote_path=remote_path)
        except Exception as cleanup_error:
            _json_log("warning", "upload_remote_cleanup_failed", error=str(cleanup_error))


DIRECT_UPLOAD_MAX_ACTIVE = max(1, int(os.environ.get("DIRECT_UPLOAD_MAX_ACTIVE", "2")))
DIRECT_UPLOAD_MAX_HOURLY = max(1, int(os.environ.get("DIRECT_UPLOAD_MAX_HOURLY", "12")))
DIRECT_UPLOAD_SHARED_NETWORK_HOURLY = max(
    100, int(os.environ.get("DIRECT_UPLOAD_SHARED_NETWORK_HOURLY", "200")),
)
DIRECT_UPLOAD_MAX_OUTSTANDING_BYTES = max(
    MAX_UPLOAD_BYTES,
    int(os.environ.get("DIRECT_UPLOAD_MAX_OUTSTANDING_BYTES", str(1024 * 1024 * 1024))),
)


def _reserve_direct_upload_slot(uid: str, file_id: str, size_bytes: int):
    if _redis_client is None and not _IS_PRODUCTION:
        return
    reserve_upload(
        _redis_client, uid, file_id, size_bytes,
        max_active=DIRECT_UPLOAD_MAX_ACTIVE,
        max_outstanding_bytes=DIRECT_UPLOAD_MAX_OUTSTANDING_BYTES,
        max_hourly=DIRECT_UPLOAD_MAX_HOURLY,
    )


def _limit_direct_upload_network(request: Request):
    network = _client_rate_key(request)
    allowed, retry_after, _remaining = _check_rate(
        _upload_rate, f"direct_network:{network}", DIRECT_UPLOAD_SHARED_NETWORK_HOURLY,
        UPLOAD_RATE_WINDOW,
    )
    if not allowed:
        raise HTTPException(429, "Too many uploads from this network",
                            headers={"Retry-After": str(retry_after)})


def _release_direct_upload_slot(uid: str, file_id: str, *, undo_hourly: bool = False):
    try:
        release_upload(_redis_client, uid, file_id, undo_hourly=undo_hourly)
    except Exception as exc:
        # The active lease has a bounded TTL; a transient Redis failure should
        # not turn a completed upload into a failed customer response.
        _json_log("warning", "direct_upload_slot_release_failed", error=str(exc))


def _schedule_media_scan(uid: str, file_id: str):
    """Persist scan intent before best-effort immediate queue delivery."""
    jobs = MediaScanJobs(get_db())
    if not jobs.create(uid, file_id):
        return
    try:
        jobs.dispatch(
            _media_scan_queue,
            retry=RQRetry(max=3, interval=[30, 120, 300]) if RQRetry else None,
        )
    except Exception as error:
        _json_log(
            "warning",
            "media_scan_immediate_dispatch_failed",
            file_id=file_id,
            error_type=type(error).__name__,
        )


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


async def _transcription_dispatch_loop():
    while True:
        try:
            await asyncio.to_thread(TranscriptionJobs(get_db()).dispatch, _transcription_queue)
            await asyncio.to_thread(_dispatch_media_scans_once)
        except Exception as error:
            _json_log("warning", "transcription_dispatch_failed", error_type=type(error).__name__)
        await asyncio.sleep(10)


def _dispatch_media_scans_once():
    return MediaScanJobs(get_db()).dispatch(
        _media_scan_queue,
        retry=RQRetry(max=3, interval=[30, 120, 300]) if RQRetry else None,
    )


def _require_scheduler_secret(request: Request):
    require_scheduler_authorization(
        request,
        shared_secret=PAYMENT_RECONCILE_SECRET,
        service_account_email=SCHEDULER_SERVICE_ACCOUNT_EMAIL,
        oidc_audience=SCHEDULER_OIDC_AUDIENCE,
        rejected_callback=lambda error: _json_log(
            "warning", "scheduler_oidc_rejected", error_type=type(error).__name__,
        ),
    )


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
