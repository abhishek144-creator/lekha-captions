import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
backend_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.dirname(backend_dir)
env_local = os.path.join(root_dir, ".env.local")
env_base = os.path.join(root_dir, ".env")
_bootstrap_env = (os.environ.get("APP_ENV") or os.environ.get("ENV") or "").strip().lower()
_bootstrap_is_test = _bootstrap_env in {"test", "testing"} or "pytest" in sys.modules or "unittest" in sys.modules
if not _bootstrap_is_test or os.environ.get("LOAD_LOCAL_ENV_IN_TESTS") == "1":
    if os.path.exists(env_local):
        load_dotenv(dotenv_path=env_local)
    if os.path.exists(env_base):
        load_dotenv(dotenv_path=env_base)

from fastapi import FastAPI, UploadFile, File, HTTPException, Response
from fastapi.responses import FileResponse, JSONResponse
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
from processor import VideoProcessor
import asyncio
import time
import subprocess
import hmac
import hashlib
from fastapi import Request
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
    delete_expired_uploads,
    delete_user_uploads,
    get_storage_bucket,
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
import shlex
import secrets
import socket
import struct
import threading
from collections import deque
from contextlib import asynccontextmanager

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
    from rq import Queue, Worker as RQWorker
    from rq.job import Job
    from rq import Retry as RQRetry
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
    app_check_failure = _verify_firebase_app_check_request(request, rid)
    if app_check_failure is not None:
        return _apply_security_headers(app_check_failure)
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
            error=str(e),
        )
        raise
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
    required_production_settings = {
        "FIREBASE_SERVICE_ACCOUNT_JSON": os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON", "").strip(),
        "FIREBASE_STORAGE_BUCKET": os.environ.get("FIREBASE_STORAGE_BUCKET", "").strip(),
        "OPENAI_API_KEY": os.environ.get("OPENAI_API_KEY", "").strip(),
        "SARVAM_API_KEY": os.environ.get("SARVAM_API_KEY", "").strip(),
        "RAZORPAY_KEY_ID": RAZORPAY_KEY_ID.strip(),
        "RAZORPAY_KEY_SECRET": RAZORPAY_KEY_SECRET.strip(),
        "PAYMENT_RECONCILE_SECRET": os.environ.get("PAYMENT_RECONCILE_SECRET", "").strip(),
        "APP_RELEASE": os.environ.get("APP_RELEASE", "").strip(),
        "ADMIN_EMAILS": os.environ.get("ADMIN_EMAILS", "").strip(),
        "SECURITY_CONTACT_EMAIL": os.environ.get("SECURITY_CONTACT_EMAIL", "").strip(),
        "PRIVACY_CONTACT_EMAIL": os.environ.get("PRIVACY_CONTACT_EMAIL", "").strip(),
    }
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
AI_COST_ESTIMATE_PER_MEDIA_MINUTE_USD = max(
    0.0, float(os.environ.get("AI_COST_ESTIMATE_PER_MEDIA_MINUTE_USD", "0"))
)
RENDER_COST_ESTIMATE_PER_MEDIA_MINUTE_USD = max(
    0.0, float(os.environ.get("RENDER_COST_ESTIMATE_PER_MEDIA_MINUTE_USD", "0"))
)

# In-memory operational state (swap for Redis in multi-instance deployments)
_export_jobs: Dict[str, Dict[str, Any]] = {}
_export_idempotency: Dict[str, Dict[str, Any]] = {}
_active_exports_by_user: Dict[str, str] = {}
_active_processes_by_user: Dict[str, str] = {}
_export_failures: Dict[str, list] = {}
_upload_owners: Dict[str, str] = {}

# Global APScheduler reference (None if apscheduler not installed)
scheduler = AsyncIOScheduler() if SCHEDULER_AVAILABLE else None

REDIS_URL = os.environ.get("REDIS_URL", "")
_redis_client = None
_rq_redis_client = None
EXPORT_QUEUE_NAME = os.environ.get("EXPORT_QUEUE_NAME", "caption_export_jobs")
DURABLE_QUEUE_ENABLED = os.environ.get("ENABLE_DURABLE_QUEUE", "1") == "1"
SLACK_ALERT_WEBHOOK_URL = os.environ.get("SLACK_ALERT_WEBHOOK_URL", "").strip()
PAYMENT_RECONCILE_INTERVAL_MINUTES = int(os.environ.get("PAYMENT_RECONCILE_INTERVAL_MINUTES", "20"))
PAYMENT_RECONCILE_LOOKBACK_HOURS = int(os.environ.get("PAYMENT_RECONCILE_LOOKBACK_HOURS", "48"))
PAYMENT_RECONCILE_BATCH_SIZE = int(os.environ.get("PAYMENT_RECONCILE_BATCH_SIZE", "200"))
PAYMENT_RECONCILE_SECRET = os.environ.get("PAYMENT_RECONCILE_SECRET", "").strip()
TELEMETRY_BATCH_SIZE = max(1, min(int(os.environ.get("TELEMETRY_BATCH_SIZE", "400")), 450))
TELEMETRY_QUEUE_LIMIT = max(TELEMETRY_BATCH_SIZE, int(os.environ.get("TELEMETRY_QUEUE_LIMIT", "5000")))
API_CURRENT_VERSION = os.environ.get("API_CURRENT_VERSION", "2026-04-21")
API_MIN_SUPPORTED_VERSION = os.environ.get("API_MIN_SUPPORTED_VERSION", "2026-01-01")
DEPRECATION_SUNSET_DATE = os.environ.get("DEPRECATION_SUNSET_DATE", "2026-12-31")
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
        _redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)
        _redis_client.ping()
        # RQ stores pickled/binary job payloads. Sharing the application's
        # decode_responses=True client makes failed-job inspection attempt UTF-8
        # decoding and can strand per-user export leases.
        _rq_redis_client = redis.Redis.from_url(REDIS_URL)
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
if DURABLE_QUEUE_ENABLED and _rq_redis_client is not None and RQ_AVAILABLE:
    try:
        _export_queue = Queue(EXPORT_QUEUE_NAME, connection=_rq_redis_client, default_timeout=30 * 60)
        _json_log("info", "durable_queue_enabled", queue=EXPORT_QUEUE_NAME)
    except Exception as e:
        _export_queue = None
        _json_log("warning", "durable_queue_init_failed", error=str(e))

async def advanced_janitor_job():
    """Background task to cleanup files based on retention rules."""
    now = time.time()
    metrics = {
        "uploads_deleted": 0,
        "exports_deleted": 0,
        "temp_ass_deleted": 0,
        "cache_deleted": 0,
        "cloud_exports_deleted": 0,
        "cloud_uploads_deleted": 0,
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
    token = _claim_scheduled_job("janitor", 14 * 60)
    if not token:
        return
    try:
        await advanced_janitor_job()
    finally:
        _release_scheduled_job("janitor", token)


async def scheduled_payment_reconciliation_job():
    token = _claim_scheduled_job("payment_reconciliation", max(PAYMENT_RECONCILE_INTERVAL_MINUTES, 5) * 60 - 5)
    if not token:
        return
    try:
        await payment_reconciliation_job()
    finally:
        _release_scheduled_job("payment_reconciliation", token)

async def startup_event():
    global _telemetry_flush_task, _simple_janitor_task
    _telemetry_flush_task = asyncio.create_task(_telemetry_flush_loop())
    if scheduler is not None:
        scheduler.add_job(scheduled_janitor_job, 'interval', minutes=15)
        scheduler.add_job(scheduled_payment_reconciliation_job, 'interval', minutes=max(PAYMENT_RECONCILE_INTERVAL_MINUTES, 5))
        scheduler.start()
        print(
            f"[Scheduler] Janitor every 15m + payment reconciliation every "
            f"{max(PAYMENT_RECONCILE_INTERVAL_MINUTES, 5)}m."
        )
    else:
        print("[Janitor] apscheduler not available — running simple asyncio fallback.")
        _simple_janitor_task = asyncio.create_task(_simple_janitor_loop())


async def shutdown_event():
    global _telemetry_flush_task, _simple_janitor_task
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
                print(f"[Janitor] Job error: {e}")
    except Exception as e:
        print(f"[Janitor] FATAL: loop crashed — {e}")

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
UPLOAD_RATE_LIMIT = 10    # max uploads per hour per IP
UPLOAD_RATE_WINDOW = 3600  # 1 hour

_signup_rate: Dict[str, list] = {}
SIGNUP_RATE_LIMIT = 10    # max new account bootstraps per hour per IP
SIGNUP_USER_RATE_LIMIT = 3  # protects retries/automation targeting one identity

_payment_rate: Dict[str, list] = {}
PAYMENT_RATE_LIMIT = 10   # max payment attempts per hour per IP

_promo_rate: Dict[str, list] = {}
PROMO_RATE_LIMIT = 5      # max promo redemptions per hour per IP

_translate_rate: Dict[str, list] = {}
TRANSLATE_RATE_LIMIT = 20  # max translation attempts per hour per IP

_process_rate: Dict[str, list] = {}
PROCESS_RATE_LIMIT = 20   # max transcription attempts per hour per IP

_detect_language_rate: Dict[str, list] = {}
DETECT_LANGUAGE_RATE_LIMIT = 10  # max paid language-detection calls per hour per user/IP

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
    export_samples = _route_latency_samples.get("/api/export", [])
    process_samples = _route_latency_samples.get("/api/process", [])
    if _redis_client is not None:
        try:
            r_export = [int(x) for x in _redis_client.lrange("latency:/api/export", 0, -1) or []]
            r_process = [int(x) for x in _redis_client.lrange("latency:/api/process", 0, -1) or []]
            if r_export:
                export_samples = r_export
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

def _authenticate_media_request(id_token: str, org_id: str = "") -> Dict[str, Any]:
    token = (id_token or "").strip()
    if _is_explicit_dev_auth_token(token):
        return {"uid": "dev-local-user", "_dev_mode": True}

    decoded_token = verify_token(token) if token else None
    if not decoded_token:
        raise HTTPException(status_code=401, detail="Authentication required")

    uid = (decoded_token.get("uid") or "").strip()
    _assert_tenant_access(uid, decoded_token, org_id)
    return decoded_token

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
            batch.set(db.collection("users").document(uid), {"org_id": token_org, "updated_at": now_iso}, merge=True)
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
SERVICE_CONTROL_COLLECTION = "ops"
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
    clamd_host = os.environ.get("CLAMAV_HOST", "").strip()
    if clamd_host:
        clamd_port = int(os.environ.get("CLAMAV_PORT", "3310"))
        try:
            with socket.create_connection((clamd_host, clamd_port), timeout=10) as client:
                client.settimeout(60)
                client.sendall(b"zINSTREAM\0")
                with open(file_path, "rb") as source:
                    while chunk := source.read(1024 * 1024):
                        client.sendall(struct.pack("!I", len(chunk)))
                        client.sendall(chunk)
                client.sendall(struct.pack("!I", 0))

                response = bytearray()
                while len(response) < 4096:
                    part = client.recv(4096 - len(response))
                    if not part:
                        break
                    response.extend(part)
                    if b"\0" in part:
                        break
            scanner_output = response.rstrip(b"\0").decode("utf-8", errors="replace")
            if scanner_output.endswith(" OK"):
                return True
            if scanner_output.endswith(" FOUND"):
                _json_log("warning", "malware_detected", scanner_output=scanner_output)
            else:
                _json_log("warning", "malware_scan_failed", scanner_output=scanner_output or "empty response")
            return False
        except Exception as e:
            _json_log("warning", "malware_scan_failed", error=str(e))
            return False

    scan_cmd = os.environ.get("CLAMAV_SCAN_CMD", "").strip()
    if not scan_cmd:
        return True
    try:
        result = subprocess.run(
            shlex.split(scan_cmd) + ["--no-summary", file_path],
            capture_output=True,
            text=True,
            timeout=20,
        )
        if result.returncode == 0:
            return True

        # ClamAV uses exit code 1 for a detected threat and 2 for scanner/runtime
        # failures. Keep both fail-closed, but distinguish them in operational
        # logs so a scanner outage is not mistaken for a malware detection.
        scan_output = f"{result.stdout}\n{result.stderr}".strip()[-1000:]
        if result.returncode == 1:
            _json_log("warning", "malware_detected", scanner_output=scan_output)
        else:
            _json_log(
                "warning",
                "malware_scan_failed",
                returncode=result.returncode,
                scanner_output=scan_output,
            )
        return False
    except Exception as e:
        _json_log("warning", "malware_scan_failed", error=str(e))
        # Fail closed when scanner is configured but unavailable.
        return False

def _is_content_safety_blocked(*values: str) -> bool:
    if not CONTENT_SAFETY_BLOCKLIST:
        return False
    joined = " ".join((v or "") for v in values).lower()
    return any(token in joined for token in CONTENT_SAFETY_BLOCKLIST)

def _persist_export_job(job_id: str, payload: Dict[str, Any]) -> bool:
    """Persist job state to at least one cross-process store."""
    persisted = False
    if _redis_client is not None:
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
                db.collection("export_jobs").document(job_id).set(
                    {**payload, "expire_at": _retention_deadline(7)}, merge=True
                )
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
    if _export_queue is not None and job_id in _export_jobs:
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


def _check_rate(store: Dict[str, list], key: str, limit: int, window: int = 3600):
    """Returns (allowed, retry_after_seconds, remaining).
    Mutates *store* in-place to record the current timestamp."""
    if _redis_client is not None:
        try:
            now_ts = time.time()
            rkey = _rate_limit_redis_key(store, key)
            pipe = _redis_client.pipeline()
            pipe.zremrangebyscore(rkey, 0, now_ts - window)
            pipe.zcard(rkey)
            _, current_count = pipe.execute()
            if int(current_count or 0) >= limit:
                oldest = _redis_client.zrange(rkey, 0, 0, withscores=True)
                if oldest:
                    retry_after = max(1, int(window - (now_ts - float(oldest[0][1]))))
                else:
                    retry_after = window
                return False, retry_after, 0
            member = f"{now_ts}:{uuid.uuid4().hex[:8]}"
            pipe = _redis_client.pipeline()
            pipe.zadd(rkey, {member: now_ts})
            pipe.expire(rkey, window + 5)
            pipe.zcard(rkey)
            _, _, after_count = pipe.execute()
            remaining = max(0, limit - int(after_count or 0))
            return True, 0, remaining
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
                    rq_job = _export_queue.fetch_job(previous_job_id)
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
    credits = int(user_data.get('credits_remaining', 0) or 0)
    tier = _normalize_tier_name(user_data.get('subscription_tier', 'free'))
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
            user_update["credits_remaining"] = firestore.Increment(-1)
        if not DISABLE_EXPORT_DAILY_LIMIT:
            user_update["export_timestamps"] = [*recent_exports, now_ts]
        transaction.create(usage_ref, {
            "export_job_id": export_job_id,
            "file_id": history_item.get("id", ""),
            "recorded_at": datetime.now(timezone.utc),
            "expire_at": datetime.now(timezone.utc) + timedelta(days=400),
        })
        transaction.update(user_ref, user_update)
        return dropped_history

    return _record(db.transaction())


def _set_export_job(job_id: str, status: str, **kwargs):
    payload = _export_jobs.get(job_id, {})
    payload.update({"status": status, "updated_at": time.time(), **kwargs})
    _export_jobs[job_id] = payload
    persisted = _persist_export_job(job_id, payload)
    if _export_queue is not None and not persisted:
        raise RuntimeError("Export job state could not be persisted to shared storage")

# Allowed upload extensions (module-level constant — not rebuilt per request)
ALLOWED_EXTENSIONS = {'mp4', 'mov', 'avi', 'mkv', 'webm', 'mp3', 'wav', 'm4a', 'aac'}
MAX_UPLOAD_BYTES = 500 * 1024 * 1024  # 500 MB
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


def _remember_upload_owner(file_id: str, uid: str, remote_path: str = "", extension: str = ""):
    if not file_id or not uid:
        return False
    _upload_owners[file_id] = uid
    persisted = False
    metadata = {
        "file_id": file_id,
        "uid": uid,
        "remote_path": remote_path,
        "extension": extension,
        "created_at": _utcnow().isoformat() + "Z",
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


def _signed_export_url(filename: str, uid: str, ttl_seconds: int, cache_bust: str = "") -> str:
    token = _create_media_token({
        "kind": "export",
        "uid": uid,
        "filename": filename,
        "exp": int(time.time() + max(ttl_seconds, 60)),
    })
    suffix = f"&v={cache_bust}" if cache_bust else ""
    return f"/api/media/export/{filename}?token={token}{suffix}"


def _compute_media_hash(file_path: str) -> str:
    digest = hashlib.sha256()
    with open(file_path, "rb") as f:
        while True:
            chunk = f.read(1024 * 1024)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()


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


def _probe_media(file_path: str) -> Dict[str, Any]:
    cmd = [
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration,format_name",
        "-show_entries", "stream=codec_type,codec_name,width,height,duration",
        "-of", "json", file_path
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
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
    if duration <= 0:
        raise ValueError("Media duration is invalid.")
    return meta


def _normalize_tier_name(tier: str) -> str:
    t = (tier or "free").strip().lower()
    if t in PLAN_EXPORT_PRESETS:
        return t
    if t in ("professional", "business", "pro_plus"):
        return "pro"
    return "free"


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


def _reserve_system_ai_quota(db, operation: str) -> None:
    """Reserve one call against the platform-wide daily AI ceiling.

    Separate document from the per-user counter so the two can't contend, and
    fail-open on read/write errors: a counter outage must not take transcription
    down, since per-user quotas and rate limits still bound the damage.
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
        # A date rollover between reserve and release already zeroed the counter.
        if data.get("ai_usage_date") != today:
            return
        usage = dict(data.get("ai_daily_usage") or {})
        used = int(usage.get(operation, 0) or 0)
        if used <= 0:
            return
        usage[operation] = used - 1
        txn.set(user_ref, {
            "ai_daily_usage": usage,
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
EXPORT_RENDERER_VERSION = "2026-08-20-server-authoritative-render-v45"

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
    captions: List[CaptionItem] = Field(min_length=1, max_length=500)
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
        if s.get('quality') not in ('4k', '1080p', '720p', None):
            s.pop('quality', None)
        if s.get('export_aspect_ratio') not in ('9:16', '1:1', '16:9', '', None):
            s.pop('export_aspect_ratio', None)
        return s

class CreateOrderRequest(BaseModel):
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
    org_id: str = Field(default="", max_length=128)

    @model_validator(mode="after")
    def validate_word_range(self):
        if self.min_words > 0 and self.max_words > 0 and self.min_words > self.max_words:
            raise ValueError("min_words must be less than or equal to max_words")
        return self

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
    if db is None and owner_uid == "dev-local-user":
        return owner_uid
    raise HTTPException(status_code=401, detail="Authentication required")


async def _process_export_job_core(req: ExportRequest, uid: str, rid: str, export_job_id: str):
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
            _log(rid, f"User {uid} missing in Firestore; auto-creating defaults")
            default_user = {
                'credits_remaining': 3,
                'subscription_tier': 'free',
                'export_timestamps': [],
                'created_at': time.time(),
                'uid': uid,
            }
            user_ref.set(default_user)
            user_data = default_user
        else:
            user_data = user_doc.to_dict() or {}

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
        credits = int(user_data.get('credits_remaining', 0) or 0)
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
    input_path = _safe_find_upload(req.file_id)
    if not input_path:
        raise HTTPException(status_code=404, detail="Video not found")

    source_meta = _probe_media(input_path)
    source_duration = float((source_meta.get("format") or {}).get("duration") or 0)
    captions = _strip_client_render_hints(_normalize_export_captions_for_media(
        [c.model_dump(by_alias=True) for c in req.captions],
        source_duration,
    ))
    server_style = req.validated_style()
    server_word_layouts: Dict[str, Any] = {}
    # Reuse rendered artifact for identical request payload.
    media_hash = _compute_media_hash(input_path)
    request_hash = hashlib.sha256(json.dumps({
        "renderer_version": EXPORT_RENDERER_VERSION,
        "media_hash": media_hash,
        "captions": captions,
        "style": server_style,
        "quality": preset["quality"],
        "fps": preset["fps"],
        "export_aspect_ratio": req.export_aspect_ratio,
    }, sort_keys=True).encode("utf-8")).hexdigest()
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

    output_filename = f"export_{req.file_id}_{request_hash[:12]}.mp4"
    output_path = os.path.join(EXPORT_DIR, output_filename)
    queue_entered_at = time.time()
    _set_export_job(export_job_id, "queued", queue_entered_at=queue_entered_at)
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

    if os.path.exists(cached_render_path) and not template_export_active:
        shutil.copy2(cached_render_path, output_path)
        render_finished_at = time.time()
        processing_started_at = queue_entered_at
        render_ms = int((render_finished_at - processing_started_at) * 1000)
        _track_event("render_cache_hit", {"job_id": export_job_id})
    else:
        processing_started_at = time.time()
        queue_wait_ms = int((processing_started_at - queue_entered_at) * 1000)
        _set_export_job(export_job_id, "processing", processing_started_at=processing_started_at, queue_wait_ms=queue_wait_ms)
        _log(rid, f"Starting render now job={export_job_id}")
        async with render_semaphore:
            result = await processor.burn_only(
                input_path, output_path, captions, style_with_quality, server_word_layouts
            )
        if not result.get('success'):
            _json_log("error", "video_render_failed", uid=uid, error=str(result.get('error') or "unknown"))
            raise HTTPException(status_code=500, detail="Video render failed")
        render_finished_at = time.time()
        render_ms = int((render_finished_at - processing_started_at) * 1000)
        if not template_export_active:
            try:
                shutil.copy2(output_path, cached_render_path)
            except Exception:
                pass

    try:
        rendered_meta = _probe_media(output_path)
        rendered_duration = float((rendered_meta.get("format") or {}).get("duration") or 0)
        rendered_has_video = any(
            stream.get("codec_type") == "video"
            for stream in (rendered_meta.get("streams") or [])
        )
        if not os.path.isfile(output_path) or os.path.getsize(output_path) <= 0 or not rendered_has_video or rendered_duration <= 0:
            raise ValueError("rendered output is empty or has no valid video stream")
    except Exception as e:
        for invalid_path in {output_path, cached_render_path}:
            if os.path.isfile(invalid_path):
                try:
                    os.remove(invalid_path)
                except OSError:
                    pass
        _json_log("error", "render_output_validation_failed", uid=uid, job_id=export_job_id, error=str(e))
        raise HTTPException(status_code=500, detail="Rendered video failed validation") from e

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
            db, user_ref, history_item, now, export_job_id
        )
        for dropped in dropped_history:
            dropped_path = dropped.get("firebase_path") if isinstance(dropped, dict) else ""
            if dropped_path:
                delete_from_firebase_storage(dropped_path)

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
    completed_at = time.time()
    total_ms = int((completed_at - queue_entered_at) * 1000)
    _set_export_job(
        export_job_id,
        "completed",
        completed_at=completed_at,
        render_ms=render_ms,
        total_ms=total_ms,
        payload=payload
    )
    _track_event("export_success", {"quality": preset["quality"], "fps": preset["fps"], "tier": preset["tier"]})
    _track_operational_metric_sample("export_total_ms", total_ms)
    _track_operational_metric_sample("export_render_ms", render_ms)
    _track_operational_metric_sample(
        "job_cost_usd",
        (rendered_duration / 60.0) * RENDER_COST_ESTIMATE_PER_MEDIA_MINUTE_USD,
    )
    return payload


def run_export_job_task(
    export_job_id: str,
    req_payload: Dict[str, Any],
    uid: str,
    idempotency_key: str = "",
    idempotency_request_hash: str = "",
):
    rid = f"worker-{export_job_id[:8]}"
    slot_acquired = False
    try:
        existing_job = _load_export_job(export_job_id) or {}
        if (existing_job.get("status") or "").lower() == "cancelled":
            _json_log("info", "cancelled_export_skipped", job_id=export_job_id, uid=uid)
            return {
                "success": False,
                "status": "cancelled",
                "export_job_id": export_job_id,
            }
        slot_acquired = _acquire_export_slot(uid, export_job_id)
        if not slot_acquired:
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
        try:
            _set_export_job(export_job_id, "failed", failed_at=time.time(), error=str(e))
        except Exception as state_error:
            _json_log(
                "error",
                "export_failure_state_persist_failed",
                job_id=export_job_id,
                error=str(state_error),
            )
        if idempotency_key:
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
        print(f"Error fetching fonts: {e}")
        return {"fonts": []}

@app.post("/api/upload")
async def upload_video(file: UploadFile = File(...), request: Request = None, response: Response = None):
    try:
        rid = _request_id(request)
        _assert_service_available("pause_uploads")
        token = _extract_bearer_token(request) if request else ""
        decoded_token = _authenticate_media_request(token)
        uid = (decoded_token.get("uid") or "").strip() or "unknown-user"
        if request:
            client_ip = _client_rate_key(request)
            allowed, retry_after, remaining = _check_rate(_upload_rate, client_ip, UPLOAD_RATE_LIMIT, UPLOAD_RATE_WINDOW)
            _apply_rate_headers(response, UPLOAD_RATE_LIMIT, remaining, retry_after)
            if not allowed:
                _track_event("upload_rejected_rate_limited")
                raise HTTPException(status_code=429, detail="Too many uploads. Please wait before trying again.")
            user_allowed, user_retry_after, user_remaining = _check_rate(
                _upload_rate, f"user:{uid}", UPLOAD_RATE_LIMIT, UPLOAD_RATE_WINDOW
            )
            if not user_allowed:
                _apply_rate_headers(response, UPLOAD_RATE_LIMIT, user_remaining, user_retry_after)
                _track_event("upload_rejected_rate_limited")
                raise HTTPException(status_code=429, detail="Too many uploads. Please wait before trying again.")

        safe_name = os.path.basename(file.filename or "")
        file_ext = pathlib.Path(safe_name).suffix.lstrip(".").lower()
        if _is_content_safety_blocked(file.filename or ""):
            _track_event("upload_rejected_content_safety")
            raise HTTPException(status_code=422, detail="Upload blocked by content safety policy.")
        if file_ext not in ALLOWED_EXTENSIONS:
            _track_event("upload_rejected_extension", {"ext": file_ext})
            raise HTTPException(status_code=415, detail=f"File type .{file_ext} not supported. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}")

        content_type = (file.content_type or "").lower()
        guessed_type, _ = mimetypes.guess_type(file.filename or "")
        # application/octet-stream is a generic browser fallback — treat extension check as authoritative
        if content_type and content_type != "application/octet-stream" and not any(content_type.startswith(p) for p in ALLOWED_CONTENT_PREFIXES):
            _track_event("upload_rejected_content_type", {"content_type": content_type})
            raise HTTPException(status_code=415, detail=f"Unsupported MIME type: {content_type}")
        if guessed_type and not any(guessed_type.startswith(p) for p in ALLOWED_CONTENT_PREFIXES):
            _track_event("upload_rejected_guess_type", {"guessed_type": guessed_type})
            raise HTTPException(status_code=415, detail=f"Unsupported file type: {guessed_type}")

        content_length = int(request.headers.get('content-length', 0)) if request else 0
        if content_length > MAX_UPLOAD_BYTES:
            _track_event("upload_rejected_too_large", {"content_length": content_length})
            raise HTTPException(status_code=413, detail="File too large. Maximum 500MB allowed.")

        file_id = str(uuid.uuid4())
        file_path = os.path.join(UPLOAD_DIR, f"{file_id}.{file_ext}")
        # Stream to disk in chunks rather than buffering the whole file in RAM —
        # a 500MB read per request is a memory-pressure DoS under concurrency.
        # Enforce the size cap as we write so an oversized (or content-length-spoofed)
        # body is aborted early instead of fully consumed.
        bytes_written = 0
        too_large = False
        UPLOAD_CHUNK_SIZE = 1024 * 1024  # 1 MB
        with open(file_path, "wb") as buffer:
            while True:
                chunk = await file.read(UPLOAD_CHUNK_SIZE)
                if not chunk:
                    break
                bytes_written += len(chunk)
                if bytes_written > MAX_UPLOAD_BYTES:
                    too_large = True
                    break
                buffer.write(chunk)
        if too_large:
            try:
                os.remove(file_path)
            except Exception:
                pass
            _track_event("upload_rejected_too_large", {"content_length": bytes_written})
            raise HTTPException(status_code=413, detail="File too large. Maximum 500MB allowed.")
        _log(rid, f"Upload accepted file_id={file_id} ext={file_ext} bytes={bytes_written}")
        if not await asyncio.to_thread(_scan_upload_for_threat, file_path):
            try:
                os.remove(file_path)
            except Exception:
                pass
            _track_event("upload_rejected_malware_scan")
            raise HTTPException(status_code=422, detail="Upload failed security scan.")

        try:
            metadata = await asyncio.to_thread(_probe_media, file_path)
            duration = float((metadata.get("format") or {}).get("duration") or 0)
        except Exception as probe_error:
            try:
                os.remove(file_path)
            except Exception:
                pass
            _track_event("upload_rejected_ffprobe", {"error": str(probe_error)})
            raise HTTPException(status_code=422, detail=f"Invalid media file: {probe_error}")

        controls = _read_service_controls()
        max_seconds = int(controls.get(
            MAX_UPLOAD_DURATION_CONTROL_KEY,
            GLOBAL_MAX_UPLOAD_DURATION_SECONDS,
        ))
        if duration > max_seconds:
            os.remove(file_path)
            _track_event("upload_rejected_duration", {"duration": duration})
            raise HTTPException(status_code=413, detail=f"Video is {duration:.0f}s. Maximum allowed is {max_seconds // 60} minutes.")

        remote_path = await asyncio.to_thread(
            upload_source_media, file_path, uid, file_id, file_ext, 6
        )
        if _IS_PRODUCTION and not remote_path:
            try:
                os.remove(file_path)
            except OSError:
                pass
            raise HTTPException(status_code=503, detail="Durable media storage is unavailable. Please retry.")

        _track_event("upload_success", {"ext": file_ext})
        owner_persisted = _remember_upload_owner(file_id, uid, remote_path or "", file_ext)
        if _IS_PRODUCTION and not owner_persisted:
            raise HTTPException(status_code=503, detail="Upload ownership could not be persisted. Please retry.")
        _audit_action("upload_success", uid, {"file_id": file_id, "ext": file_ext, "duration": duration})
        return {"success": True, "file_id": file_id, "raw_url": _signed_upload_url(file_id, uid)}
    except HTTPException:
        raise
    except Exception as e:
        _track_event("upload_failed", {"error": str(e)})
        _json_log("error", "upload_failed", request_id=rid, error=str(e))
        raise HTTPException(status_code=500, detail=f"Upload failed. Reference: {rid}") from e

@app.post("/api/process")
async def process_video(req: ProcessRequest, request: Request, response: Response):
    _assert_service_available("pause_transcription")
    # Auth — same dev-mode bypass as /api/export
    decoded_token = _authenticate_media_request(req.id_token, req.org_id)
    uid = (decoded_token.get("uid") or "").strip() or "unknown-user"
    client_ip = _client_rate_key(request)
    allowed, retry_after, remaining = _check_rate(_process_rate, client_ip, PROCESS_RATE_LIMIT)
    _apply_rate_headers(response, PROCESS_RATE_LIMIT, remaining, retry_after)
    if not allowed:
        _track_event("process_rejected_rate_limited")
        raise HTTPException(status_code=429, detail="Too many transcription requests. Please wait before trying again.")
    user_allowed, user_retry_after, user_remaining = _check_rate(
        _process_rate, f"user:{uid}", PROCESS_RATE_LIMIT
    )
    if not user_allowed:
        _apply_rate_headers(response, PROCESS_RATE_LIMIT, user_remaining, user_retry_after)
        _track_event("process_rejected_rate_limited")
        raise HTTPException(status_code=429, detail="Too many transcription requests. Please wait before trying again.")
    if not _validate_file_id(req.file_id):
        raise HTTPException(status_code=400, detail="Invalid file_id")
    _assert_upload_owner(req.file_id, uid)
    input_path = _safe_find_upload(req.file_id)
    if not input_path:
        _track_event("process_failed_not_found")
        raise HTTPException(status_code=404, detail="File not found")

    # Enforce the per-plan maximum source length. /api/upload only applies a
    # global 180s ceiling; paid plans advertise tighter caps (starter=120s) that
    # can only be enforced here, where the caller's tier is known. Checked before
    # the cache lookup so a result cached by a higher tier can't be replayed to a
    # lower-tier user with a too-long video.
    user_tier = _normalize_tier_name(await asyncio.to_thread(_lookup_subscription_tier, uid))
    controls = _read_service_controls()
    operator_max_seconds = int(controls.get(
        MAX_UPLOAD_DURATION_CONTROL_KEY,
        GLOBAL_MAX_UPLOAD_DURATION_SECONDS,
    ))
    max_seconds = min(_max_video_seconds_for_tier(user_tier), operator_max_seconds)
    try:
        _probe_meta = await asyncio.to_thread(_probe_media, input_path)
        media_duration = float((_probe_meta.get("format") or {}).get("duration") or 0)
    except Exception:
        media_duration = 0.0
    if media_duration > max_seconds + 0.5:
        _track_event("process_rejected_duration", {"tier": user_tier, "duration": media_duration, "max_seconds": max_seconds})
        raise HTTPException(status_code=403, detail=f"Your plan allows videos up to {max_seconds}s. This video is {media_duration:.0f}s long.")

    try:
        media_hash = await asyncio.to_thread(_compute_media_hash, input_path)
        cache_path = _build_process_cache_path(media_hash, req.language, req.min_words, req.max_words)
    except Exception:
        media_hash = ""
        cache_path = ""

    if cache_path and os.path.exists(cache_path):
        try:
            with open(cache_path, "r", encoding="utf-8") as f:
                cached = json.load(f)
            if cached.get("success") and not (cached.get("captions") or []):
                raise HTTPException(
                    status_code=422,
                    detail="No speech with usable word timestamps was detected.",
                )
            cached["cached"] = True
            _track_event("process_cache_hit", {"language": req.language})
            return cached
        except HTTPException:
            raise
        except Exception:
            pass

    process_request_id = uuid.uuid4().hex
    if not _acquire_process_slot(uid, process_request_id):
        raise HTTPException(
            status_code=409,
            detail="A transcription is already running for this account. Wait for it to finish before retrying.",
        )

    try:
        await asyncio.to_thread(_reserve_ai_quota, uid, "process")

        def _generate_captions_in_worker_thread():
            return asyncio.run(processor.generate_captions_only(
                input_path,
                target_language=req.language,
                min_words=req.min_words,
                max_words=req.max_words,
            ))

        try:
            result = await asyncio.to_thread(_generate_captions_in_worker_thread)
        except Exception:
            # The provider never returned a usable result — hand the daily call back.
            await asyncio.to_thread(_release_ai_quota, uid, "process")
            raise

        if result.get("success") and not (result.get("captions") or []):
            result = {
                "success": False,
                "error": "No speech with usable word timestamps was detected.",
                "error_code": "NO_SPEECH_DETECTED",
            }

        if result.get("success"):
            _track_event("process_success", {"language": req.language})
            if media_duration > 0:
                _track_operational_metric_sample("transcription_media_seconds", media_duration)
                _track_operational_metric_sample(
                    "job_cost_usd",
                    (media_duration / 60.0) * AI_COST_ESTIMATE_PER_MEDIA_MINUTE_USD,
                )
            if cache_path:
                try:
                    with open(cache_path, "w", encoding="utf-8") as f:
                        json.dump(result, f)
                except Exception as e:
                    print(f"[Cache] Failed to write transcription cache: {e}")
        else:
            _track_event("process_failed", {"language": req.language, "error": result.get("error", "unknown")})
            is_no_speech = result.get("error_code") == "NO_SPEECH_DETECTED"
            status_code = 422 if is_no_speech else 502
            # NO_SPEECH is a real transcription that found nothing — the provider
            # ran and billed us, so that call stays spent. Anything else is our
            # failure and the reservation is returned.
            if not is_no_speech:
                await asyncio.to_thread(_release_ai_quota, uid, "process")
            raise HTTPException(
                status_code=status_code,
                detail=result.get("error", "Transcription service failed"),
            )

        return result
    finally:
        _release_process_slot(uid, process_request_id)

@app.post("/api/export")
async def export_video(req: ExportRequest, request: Request, response: Response):
    rid = _request_id(request)
    _assert_service_available("pause_exports")
    _log(rid, f"Export requested file_id={req.file_id} quality={req.quality}")
    _track_event("export_requested", {"quality": req.quality, "fps": req.fps})

    # 1. Authenticate user
    decoded_token = _authenticate_media_request(req.id_token, req.org_id)
    uid = (decoded_token.get("uid") or "").strip() or "dev-local-user"
    if decoded_token.get("_dev_mode"):
        _log(rid, "Using explicit debug auth bypass token")

    now_ts = time.time()
    recent_failures = _get_recent_export_failures(uid)
    if len(recent_failures) >= EXPORT_FAILURE_LIMIT:
        retry_after = max(1, int(EXPORT_FAILURE_WINDOW - (now_ts - min(recent_failures))))
        response.headers["Retry-After"] = str(retry_after)
        raise HTTPException(status_code=429, detail="Too many failed export attempts. Please retry after a short wait.")

    safe_request_snapshot = _sanitize_export_request_payload(req.model_dump(by_alias=True))
    idempotency_request_hash = hashlib.sha256(
        json.dumps(safe_request_snapshot, sort_keys=True, default=str).encode("utf-8")
    ).hexdigest()

    # Idempotency key support to prevent duplicate renders/charges.
    raw_idem = (req.idempotency_key or request.headers.get("x-idempotency-key") or "").strip()
    auto_idem = False
    if not raw_idem:
        # Auto-key to prevent accidental double-click duplicate renders.
        raw_idem = f"auto:{req.file_id}:{req.quality}:{req.fps}:{req.export_aspect_ratio or 'source'}"
        auto_idem = True
    idem_key = f"{uid}:{raw_idem}" if raw_idem else ""
    if idem_key:
        cached = _idem_get(idem_key)
        if cached and (time.time() - cached.get("ts", 0) < 6 * 3600):
            cached_request_hash = cached.get("request_hash", "")
            if cached_request_hash and cached_request_hash != idempotency_request_hash:
                raise HTTPException(
                    status_code=409,
                    detail="This idempotency key was already used for a different export request.",
                )
            if cached.get("status") == "completed" and not auto_idem:
                _log(rid, f"Idempotent replay for key={raw_idem[:16]}")
                return {**cached["payload"], "idempotent_replay": True}
            if cached.get("status") == "in_progress":
                if cached.get("payload") and not auto_idem:
                    return {**cached["payload"], "idempotent_replay": True}
                raise HTTPException(status_code=409, detail="Export with this idempotency key is already in progress.")
        _idem_set(idem_key, {
            "status": "in_progress",
            "ts": time.time(),
            "request_hash": idempotency_request_hash,
        })

    # Per-user concurrent export guard.
    export_job_id = str(uuid.uuid4())
    if not _acquire_export_slot(uid, export_job_id):
        if idem_key:
            _idem_delete(idem_key)
        raise HTTPException(status_code=429, detail="Another export is already running for this account. Please wait.")

    release_export_slot_in_request = True
    try:
        _set_export_job(
            export_job_id,
            "queued",
            uid=uid,
            file_id=req.file_id,
            quality=req.quality,
            started_at=time.time(),
            request_snapshot=safe_request_snapshot,
        )
        if _export_queue is not None:
            _export_queue.enqueue_call(
                func=run_export_job_task,
                args=(
                    export_job_id,
                    safe_request_snapshot,
                    uid,
                    idem_key if not auto_idem else "",
                    idempotency_request_hash,
                ),
                job_id=export_job_id,
                retry=RQRetry(max=3, interval=[10, 30, 60]) if RQRetry else None,
                result_ttl=24 * 3600,
                failure_ttl=7 * 24 * 3600,
            )
            _audit_action("export_enqueued", uid, {"job_id": export_job_id, "file_id": req.file_id})
            release_export_slot_in_request = False
            queued_payload = {
                "success": True,
                "queued": True,
                "export_job_id": export_job_id,
                "status": "queued",
            }
            # Explicit keys remain in progress until the worker stores a terminal result.
            # Replays with the same explicit key return this queued job while it runs.
            # Auto keys are cleared because the per-user lease blocks double-clicks.
            if idem_key:
                if auto_idem:
                    _idem_delete(idem_key)
                else:
                    _idem_set(idem_key, {
                        "status": "in_progress",
                        "ts": time.time(),
                        "payload": queued_payload,
                        "request_hash": idempotency_request_hash,
                        "job_id": export_job_id,
                    })
            return queued_payload

        payload = await _process_export_job_core(req, uid, rid, export_job_id)
        if idem_key:
            if auto_idem:
                _idem_delete(idem_key)
            else:
                _idem_set(idem_key, {
                    "status": "completed",
                    "ts": time.time(),
                    "payload": payload,
                    "request_hash": idempotency_request_hash,
                    "job_id": export_job_id,
                })
        return payload

    except HTTPException as http_ex:
        _set_export_job(export_job_id, "failed", failed_at=time.time(), error=str(http_ex.detail))
        _record_export_failure(uid)
        _track_event("export_failed_http", {"detail": str(http_ex.detail)})
        _write_dead_letter(
            export_job_id,
            str(http_ex.detail),
            {"uid": uid, "file_id": req.file_id, "req_payload": safe_request_snapshot},
        )
        if idem_key:
            _idem_delete(idem_key)
        raise
    except Exception as e:
        _set_export_job(export_job_id, "failed", failed_at=time.time(), error=str(e))
        _record_export_failure(uid)
        _track_event("export_failed_exception", {"error": str(e)})
        _write_dead_letter(
            export_job_id,
            str(e),
            {"uid": uid, "file_id": req.file_id, "req_payload": safe_request_snapshot},
        )
        if idem_key:
            _idem_delete(idem_key)
        raise HTTPException(status_code=500, detail=f"Export failed. Reference: {rid}")
    finally:
        if release_export_slot_in_request:
            _release_export_slot(uid, export_job_id)

@app.get("/api/export-status/{job_id}")
def export_status(job_id: str, request: Request):
    job = _load_export_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Export job not found")
    _require_export_job_access(request, job)
    # Keep payload concise and avoid leaking internal paths.
    return {
        "job_id": job_id,
        "status": job.get("status", "unknown"),
        "updated_at": job.get("updated_at"),
        "error": job.get("error"),
    }


@app.get("/api/export-result/{job_id}")
def export_result(job_id: str, request: Request):
    job = _load_export_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Export job not found")
    _require_export_job_access(request, job)
    if job.get("status") != "completed":
        return {"success": False, "status": job.get("status", "unknown"), "error": job.get("error")}
    payload = job.get("payload") or {}
    if not payload:
        return {"success": False, "status": "completed", "error": "Result payload missing"}
    return payload


@app.post("/api/export-cancel/{job_id}")
def export_cancel(job_id: str, request: Request):
    job = _load_export_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Export job not found")
    _require_export_job_access(request, job)

    status = (job.get("status") or "unknown").lower()
    if status == "cancelled":
        return {
            "success": True,
            "status": "cancelled",
            "export_job_id": job_id,
            "idempotent_replay": True,
            "credit_released": False,
        }
    if status != "queued":
        raise HTTPException(
            status_code=409,
            detail="Only a queued export can be cancelled safely. A render already in progress will finish normally.",
        )
    if _export_queue is None:
        raise HTTPException(status_code=503, detail="Durable queue is not configured")

    rq_job = _export_queue.fetch_job(job_id)
    if rq_job is not None:
        rq_status = rq_job.get_status(refresh=True)
        rq_status_value = getattr(rq_status, "value", str(rq_status)).lower()
        if rq_status_value not in {"queued", "deferred", "scheduled", "stopped", "canceled", "cancelled"}:
            raise HTTPException(
                status_code=409,
                detail="This export has already started and cannot be cancelled safely.",
            )
        rq_job.cancel()

    uid = str(job.get("uid") or "")
    _set_export_job(
        job_id,
        "cancelled",
        cancelled_at=time.time(),
        cancellation_reason="user_requested",
        error=None,
    )
    _release_export_slot(uid, job_id)
    _track_event("export_cancelled", {"job_id": job_id})
    _audit_action("export_cancelled", uid, {"job_id": job_id})
    return {
        "success": True,
        "status": "cancelled",
        "export_job_id": job_id,
        "credit_released": False,
    }


@app.post("/api/export-replay/{job_id}")
def export_replay(job_id: str, request: Request):
    _assert_service_available("pause_exports")
    if _export_queue is None:
        raise HTTPException(status_code=503, detail="Durable queue is not configured")
    db = get_db()
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")
    snap = db.collection("export_jobs").document(job_id).get()
    if not snap.exists:
        raise HTTPException(status_code=404, detail="Export job not found")
    job = snap.to_dict() or {}
    _require_export_job_access(request, job)
    if (job.get("status") or "").lower() != "failed":
        raise HTTPException(
            status_code=409,
            detail="Only failed export jobs can be replayed.",
        )
    request_snapshot = job.get("request_snapshot")
    uid = job.get("uid", "")
    if not request_snapshot:
        raise HTTPException(status_code=400, detail="No request snapshot found to replay")
    new_job_id = str(uuid.uuid4())
    if not _acquire_export_slot(uid, new_job_id):
        raise HTTPException(
            status_code=429,
            detail="Another export is already running for this account. Please wait.",
        )
    try:
        _set_export_job(
            new_job_id,
            "queued",
            uid=uid,
            file_id=request_snapshot.get("file_id"),
            started_at=time.time(),
            request_snapshot=request_snapshot,
            replayed_from=job_id,
        )
        _export_queue.enqueue_call(
            func=run_export_job_task,
            args=(new_job_id, request_snapshot, uid),
            job_id=new_job_id,
            retry=RQRetry(max=3, interval=[10, 30, 60]) if RQRetry else None,
            result_ttl=24 * 3600,
            failure_ttl=7 * 24 * 3600,
        )
    except Exception as e:
        try:
            _set_export_job(new_job_id, "failed", failed_at=time.time(), error=str(e))
        finally:
            _release_export_slot(uid, new_job_id)
        raise HTTPException(status_code=503, detail="Export replay could not be queued") from e
    _audit_action("export_replay_enqueued", uid, {"source_job_id": job_id, "new_job_id": new_job_id})
    return {"success": True, "export_job_id": new_job_id, "status": "queued"}


@app.get("/api/analytics/summary")
async def analytics_summary(request: Request):
    # Ops-internal counters and failure rates — admin only. Exposing these
    # unauthenticated hands anyone a live view of business/operational health.
    if not _is_admin_token(request=request):
        raise HTTPException(status_code=403, detail="Admin access required")
    day_key = (request.query_params.get("date") or _utcnow().date().isoformat()).strip()
    try:
        datetime.strptime(day_key, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="date must use YYYY-MM-DD")

    counters = _read_daily_analytics_counters(day_key)
    export_success = counters.get("export_success", 0)
    export_failed = counters.get("export_failed_http", 0) + counters.get("export_failed_exception", 0)
    process_success = counters.get("process_success", 0)
    process_failed = counters.get("process_failed", 0)
    _maybe_alert_failure_ratio("export", export_success, export_failed)
    _maybe_alert_failure_ratio("process", process_success, process_failed)

    terminal_success = export_success + process_success
    terminal_failed = export_failed + process_failed
    terminal_total = terminal_success + terminal_failed
    process_latency = _read_daily_latency_samples(day_key, "/api/process")
    export_latency = _read_daily_latency_samples(day_key, "/api/export")
    processing_latency = process_latency + export_latency
    average_processing_ms = (
        round(sum(processing_latency) / len(processing_latency))
        if processing_latency else 0
    )
    cost_samples = _read_operational_metric_samples(day_key, "job_cost_usd")
    average_cost_usd = (
        round(sum(cost_samples) / len(cost_samples), 6)
        if cost_samples else 0.0
    )

    return {
        "window": {
            "kind": "utc_day",
            "date": day_key,
            "timezone": "UTC",
        },
        "counters": counters,
        "metrics": {
            "signups": counters.get("account_signup", 0),
            "uploads": counters.get("upload_success", 0),
            "completed_transcriptions": process_success,
            "completed_exports": export_success,
            "failure_percentage": round((terminal_failed / max(terminal_total, 1)) * 100, 2),
            "average_processing_time_ms": average_processing_ms,
            "processing_p95_ms": _p95(processing_latency),
            "cost_per_job_usd": average_cost_usd,
            "cost_is_estimate": True,
            "successful_payments": counters.get("payment_success", 0),
            "failed_payments": counters.get("payment_failed", 0),
            "support_requests": counters.get("support_request_created", 0),
        },
        "health": {
            "export_failure_rate": (export_failed / max(export_success + export_failed, 1)),
            "process_failure_rate": (process_failed / max(process_success + process_failed, 1)),
        },
        "timestamp": _utcnow().isoformat() + "Z",
    }

@app.get("/api/v1/analytics/summary")
async def analytics_summary_v1(request: Request):
    return await analytics_summary(request)

@app.post("/api/analytics/track")
async def analytics_track(request: Request, response: Response):
    # Unauthenticated telemetry endpoint: rate-limit per IP so it can't be used
    # as an unbounded Firestore write amplifier (cost/DoS), and reject reserved
    # server counter names so it can't poison the release gate / alerting.
    client_ip = _client_rate_key(request)
    allowed, retry_after, remaining = _check_rate(_analytics_rate, client_ip, ANALYTICS_RATE_LIMIT)
    _apply_rate_headers(response, ANALYTICS_RATE_LIMIT, remaining, retry_after)
    if not allowed:
        raise HTTPException(status_code=429, detail="Too many analytics events. Please slow down.")
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid analytics payload")
    event = (body.get("event") or "").strip()
    if not event or len(event) > 80:
        raise HTTPException(status_code=400, detail="Invalid analytics event")
    if event in RESERVED_SERVER_ANALYTICS_EVENTS:
        raise HTTPException(status_code=400, detail="Reserved analytics event")
    payload = body.get("payload") or {}
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Invalid analytics payload")
    _track_event(event, payload)
    return {"success": True}


@app.post("/api/support-request")
def create_support_request(req: SupportRequest, request: Request, response: Response):
    client_ip = _client_rate_key(request)
    allowed, retry_after, remaining = _check_rate(
        _support_rate,
        f"support:{client_ip}",
        SUPPORT_RATE_LIMIT,
    )
    _apply_rate_headers(response, SUPPORT_RATE_LIMIT, remaining, retry_after)
    if not allowed:
        raise HTTPException(status_code=429, detail="Too many support requests. Please wait before trying again.")

    email = req.account_email.strip().lower()
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        raise HTTPException(status_code=422, detail="Enter a valid account email address.")
    db = get_db()
    if not db:
        raise HTTPException(status_code=503, detail="Support intake is temporarily unavailable.")

    ticket_id = f"SUP-{_utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:8].upper()}"
    received_at = _utcnow().isoformat() + "Z"
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
        "expire_at": _retention_deadline(365),
    })
    _track_event("support_request_created", {
        "ticket_id": ticket_id,
        "issue_type": req.issue_type.strip(),
    })
    _send_alert(f"[Lekha Support] New {req.issue_type.strip()} ticket: {ticket_id}")
    return {"success": True, "ticket_id": ticket_id, "received_at": received_at}

@app.get("/api/version")
async def api_version():
    return {
        "success": True,
        "version": API_CURRENT_VERSION,
        "min_supported_version": API_MIN_SUPPORTED_VERSION,
        "sunset_date": DEPRECATION_SUNSET_DATE,
        "progressive_delivery_enabled": ENABLE_PROGRESSIVE_DELIVERY,
    }

@app.get("/api/health")
async def api_health():
    return {
        "success": True,
        "ready": True,
        "version": API_CURRENT_VERSION,
    }

@app.get("/api/v1/version")
async def api_version_v1():
    return await api_version()


_dependency_snapshot_cache: Dict[str, Any] = {"checked_at": 0.0, "value": None}
_dependency_snapshot_lock = threading.Lock()


def _runtime_dependency_snapshot() -> Dict[str, Any]:
    now_ts = time.time()
    with _dependency_snapshot_lock:
        cached = _dependency_snapshot_cache.get("value")
        if cached and now_ts - float(_dependency_snapshot_cache.get("checked_at", 0)) < 15:
            return cached

    checks: Dict[str, bool] = {
        "ffmpeg": shutil.which("ffmpeg") is not None,
        "ffprobe": shutil.which("ffprobe") is not None,
        "node": shutil.which("node") is not None,
        "redis": _redis_client is not None,
        "firestore": False,
        "storage": False,
        "export_worker": not DURABLE_QUEUE_ENABLED,
        "scratch_disk": False,
    }
    details: Dict[str, Any] = {}
    if _redis_client is not None:
        try:
            checks["redis"] = bool(_redis_client.ping())
        except Exception:
            checks["redis"] = False
    try:
        db = get_db()
        if db:
            next(iter(db.collection("_readiness_probe").limit(1).stream()), None)
            checks["firestore"] = True
    except Exception as e:
        details["firestore_error"] = str(e)[:200]
    try:
        bucket = get_storage_bucket()
        checks["storage"] = bool(bucket and bucket.exists())
    except Exception as e:
        details["storage_error"] = str(e)[:200]
    if DURABLE_QUEUE_ENABLED and checks["redis"] and RQWorker is not None:
        try:
            workers = RQWorker.all(connection=_redis_client)
            worker_count = 0
            for worker in workers:
                queue_names = getattr(worker, "queue_names", [])
                if callable(queue_names):
                    queue_names = queue_names()
                if EXPORT_QUEUE_NAME in set(queue_names or []):
                    worker_count += 1
            details["worker_count"] = worker_count
            checks["export_worker"] = worker_count > 0
        except Exception as e:
            details["worker_error"] = str(e)[:200]
    try:
        disk = shutil.disk_usage(MEDIA_SCRATCH_ROOT)
        details["scratch_free_bytes"] = disk.free
        checks["scratch_disk"] = disk.free >= 2 * 1024 * 1024 * 1024
    except Exception as e:
        details["scratch_disk_error"] = str(e)[:200]

    value = {"ready": all(checks.values()), "checks": checks, "details": details}
    with _dependency_snapshot_lock:
        _dependency_snapshot_cache.update({"checked_at": now_ts, "value": value})
    return value

@app.get("/api/slo/status")
async def slo_status(request: Request):
    # Detailed SLO targets/actuals — admin only. Health probes should use
    # /api/health/readiness (boolean) instead.
    if not _is_admin_token(request=request):
        raise HTTPException(status_code=403, detail="Admin access required")
    return _build_slo_snapshot()

@app.get("/api/health/readiness")
async def readiness(request: Request):
    # Public readiness probe: exposes only the boolean gate result. Detailed SLO
    # actuals and queue wiring are admin-gated (see /api/slo/status) so an
    # anonymous caller can't read operational internals.
    snapshot = _build_slo_snapshot()
    dependencies = await asyncio.to_thread(_runtime_dependency_snapshot) if _IS_PRODUCTION else {
        "ready": True,
        "checks": {},
        "details": {},
    }
    ready = bool(snapshot.get("release_gate_passed", True) and dependencies.get("ready", False))
    body = {
        "success": True,
        "ready": ready,
    }
    if _is_admin_token(request=request):
        body["slo"] = snapshot
        body["queue"] = {
            "durable_enabled": DURABLE_QUEUE_ENABLED,
            "queue_name": EXPORT_QUEUE_NAME,
            "connected": _export_queue is not None,
        }
        body["dependencies"] = dependencies
    if not ready:
        return JSONResponse(status_code=503, content=body)
    return body

@app.get("/api/feature-flags")
async def feature_flags(request: Request):
    _validate_feature_flag_safety("feature_flags")
    token = request.headers.get("authorization", "").replace("Bearer ", "").strip()
    decoded = verify_token(token) if token else None
    if not decoded:
        raise HTTPException(status_code=401, detail="Auth required")
    if not _decoded_token_is_admin(decoded):
        raise HTTPException(status_code=403, detail="Admin role required")
    return {
        "success": True,
        "flags": {
            "enable_progressive_delivery": ENABLE_PROGRESSIVE_DELIVERY,
            "enforce_tenant_isolation": ENFORCE_TENANT_ISOLATION,
            "require_payment_idempotency": REQUIRE_PAYMENT_IDEMPOTENCY,
            "enable_durable_queue": DURABLE_QUEUE_ENABLED,
        },
    }

@app.get("/api/service-status")
def service_status():
    """Unauthenticated so the app can show an accurate banner while paused."""
    controls = _read_service_controls()
    return {
        "success": True,
        "controls": {
            **{key: bool(controls.get(key)) for key in SERVICE_CONTROL_KEYS},
            MAX_UPLOAD_DURATION_CONTROL_KEY: int(controls.get(
                MAX_UPLOAD_DURATION_CONTROL_KEY,
                GLOBAL_MAX_UPLOAD_DURATION_SECONDS,
            )),
        },
        "notice": controls.get("notice") or "",
    }

@app.post("/api/admin/service-controls")
def admin_service_controls(req: ServiceControlsRequest, request: Request):
    decoded = verify_token(req.id_token) if req.id_token else None
    if not decoded and request is not None:
        header_token = request.headers.get("authorization", "").replace("Bearer ", "").strip()
        decoded = verify_token(header_token) if header_token else None
    if not _decoded_token_is_admin(decoded):
        raise HTTPException(status_code=403, detail="Admin access required")

    updates: Dict[str, Any] = {}
    for key in SERVICE_CONTROL_KEYS:
        value = getattr(req, key, None)
        if value is not None:
            updates[key] = bool(value)
    if req.max_upload_duration_seconds is not None:
        updates[MAX_UPLOAD_DURATION_CONTROL_KEY] = max(
            15,
            min(GLOBAL_MAX_UPLOAD_DURATION_SECONDS, int(req.max_upload_duration_seconds)),
        )
    if req.notice is not None:
        updates["notice"] = str(req.notice)[:SERVICE_CONTROL_NOTICE_MAX]

    if not updates:
        controls = _read_service_controls(force=True)
        return {"success": True, "changed": False, "controls": controls}

    db = get_db()
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")
    updates["updated_at"] = _utcnow().isoformat() + "Z"
    updates["updated_by"] = str((decoded or {}).get("uid") or "")[:128]
    try:
        db.collection(SERVICE_CONTROL_COLLECTION).document(SERVICE_CONTROL_DOCUMENT).set(
            updates, merge=True
        )
    except Exception as e:
        _json_log("error", "service_controls_write_failed", error=str(e))
        raise HTTPException(status_code=503, detail="Service controls could not be saved") from e

    controls = _read_service_controls(force=True)
    _audit_action(
        "service_controls_updated",
        str((decoded or {}).get("uid") or ""),
        {
            key: updates[key]
            for key in updates
            if key in SERVICE_CONTROL_KEYS or key == MAX_UPLOAD_DURATION_CONTROL_KEY
        },
    )
    _json_log("warning", "service_controls_updated", **{
        **{key: bool(controls.get(key)) for key in SERVICE_CONTROL_KEYS},
        MAX_UPLOAD_DURATION_CONTROL_KEY: int(controls.get(
            MAX_UPLOAD_DURATION_CONTROL_KEY,
            GLOBAL_MAX_UPLOAD_DURATION_SECONDS,
        )),
    })
    return {"success": True, "changed": True, "controls": controls}

def _resolve_plan_from_amount_currency(amount_minor: int, currency: str) -> Optional[str]:
    c = (currency or "INR").upper()
    for plan_key, p in PLAN_PRICING.items():
        if c == "USD" and amount_minor == p.get("usd_cents"):
            return plan_key
        if c == "INR" and amount_minor == p.get("inr_paise"):
            return plan_key
    return None


TOPUP_PURCHASE_WINDOW_SECONDS = 30 * 24 * 60 * 60
TOPUP_ORDER_RESERVATION_SECONDS = 2 * 60 * 60


def _topup_timestamp_epoch(value: Any) -> Optional[float]:
    """Normalize Firestore/Python/ISO timestamps used by rolling top-up limits."""
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, datetime):
        dt = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
        return dt.timestamp()
    if isinstance(value, str):
        raw = value.strip()
        if not raw:
            return None
        try:
            return float(raw)
        except ValueError:
            try:
                dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
                if not dt.tzinfo:
                    dt = dt.replace(tzinfo=timezone.utc)
                return dt.timestamp()
            except ValueError:
                return None
    return None


def _recent_topup_timestamps(user_data: Dict[str, Any], now_ts: Optional[float] = None) -> List[float]:
    now_epoch = float(now_ts if now_ts is not None else time.time())
    cutoff = now_epoch - TOPUP_PURCHASE_WINDOW_SECONDS
    recent: List[float] = []
    values = user_data.get("topup_timestamps") or []
    if not isinstance(values, list):
        values = []
    for value in values:
        parsed = _topup_timestamp_epoch(value)
        if parsed is not None and cutoff < parsed <= now_epoch + 300:
            recent.append(parsed)
    return sorted(recent)


def _active_topup_reservations(user_data: Dict[str, Any], now_ts: Optional[float] = None) -> List[Dict[str, Any]]:
    now_epoch = float(now_ts if now_ts is not None else time.time())
    cutoff = now_epoch - TOPUP_ORDER_RESERVATION_SECONDS
    active: List[Dict[str, Any]] = []
    values = user_data.get("topup_order_reservations") or []
    if not isinstance(values, list):
        values = []
    for value in values:
        if not isinstance(value, dict):
            continue
        created_at = _topup_timestamp_epoch(value.get("created_at"))
        reservation_id = str(value.get("id") or "").strip()
        if reservation_id and created_at is not None and cutoff < created_at <= now_epoch + 300:
            active.append({
                "id": reservation_id,
                "plan_id": str(value.get("plan_id") or "").strip(),
                "created_at": created_at,
            })
    return sorted(active, key=lambda item: item["created_at"])


def _topup_purchase_limit(plan_config: Dict[str, Any]) -> int:
    try:
        return max(0, int(plan_config.get("purchase_limit_30d", 0) or 0))
    except (TypeError, ValueError):
        return 0


def _assert_topup_purchase_available(
    user_data: Dict[str, Any],
    plan_config: Dict[str, Any],
    now_ts: Optional[float] = None,
) -> None:
    limit = _topup_purchase_limit(plan_config)
    if limit <= 0:
        raise HTTPException(status_code=403, detail="Top-ups are not enabled for this plan.")
    used = len(_recent_topup_timestamps(user_data, now_ts))
    reserved = len(_active_topup_reservations(user_data, now_ts))
    if used + reserved >= limit:
        noun = "purchase" if limit == 1 else "purchases"
        raise HTTPException(
            status_code=429,
            detail=f"Top-up limit reached: your plan allows {limit} top-up {noun} per rolling 30 days.",
        )


def _reserve_topup_order_slot(db, user_ref, plan_id: str, plan_config: Dict[str, Any]) -> str:
    """Atomically reserve a short-lived slot before creating a chargeable order."""
    reservation_id = secrets.token_urlsafe(18)
    now_ts = time.time()

    @firestore.transactional
    def _reserve(transaction):
        user_doc = user_ref.get(transaction=transaction)
        if not user_doc.exists:
            raise HTTPException(status_code=404, detail="User not found. Purchase a plan first.")
        user_data = user_doc.to_dict() or {}
        base_tier = _effective_subscription_tier(user_data).replace("_yearly", "")
        if base_tier not in {"starter", "creator", "pro"}:
            raise HTTPException(status_code=403, detail="UPGRADE_REQUIRED: Top-ups available for paid plans only.")
        if plan_id != f"topup_{base_tier}":
            raise HTTPException(status_code=403, detail="This top-up is not available for your current plan.")
        _assert_topup_purchase_available(user_data, plan_config, now_ts)
        reservations = _active_topup_reservations(user_data, now_ts)
        reservations.append({"id": reservation_id, "plan_id": plan_id, "created_at": now_ts})
        transaction.update(user_ref, {"topup_order_reservations": reservations})
        return reservation_id

    return _reserve(db.transaction())


def _release_topup_order_slot(db, user_ref, reservation_id: str) -> None:
    if not reservation_id:
        return

    @firestore.transactional
    def _release(transaction):
        user_doc = user_ref.get(transaction=transaction)
        if not user_doc.exists:
            return
        user_data = user_doc.to_dict() or {}
        reservations = [
            item for item in _active_topup_reservations(user_data)
            if item.get("id") != reservation_id
        ]
        transaction.update(user_ref, {"topup_order_reservations": reservations})

    _release(db.transaction())


def _fetch_bound_order_context(order_id: str, amount_minor: int, currency: str) -> Dict[str, str]:
    """Resolve the server-authored payment owner and plan from a Razorpay order.

    The app writes uid/plan_id to *order* notes when it creates the order. Razorpay
    payment webhook entities can have empty or unrelated payment notes, so neither
    webhook recovery nor reconciliation may use payment notes as the entitlement
    authority.
    """
    order_id = str(order_id or "").strip()
    if not order_id:
        raise HTTPException(status_code=400, detail="Payment is missing its order binding.")
    if not RAZORPAY_AVAILABLE or rzp_client is None:
        raise HTTPException(status_code=503, detail="Payment order verification is unavailable")

    try:
        order = rzp_client.order.fetch(order_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail="Unable to verify payment order with Razorpay") from e

    order_amount = int(order.get("amount", 0) or 0)
    order_currency = str(order.get("currency") or "").upper()
    if order_amount != int(amount_minor or 0) or order_currency != str(currency or "").upper():
        raise HTTPException(status_code=400, detail="Payment order amount does not match the captured payment.")

    notes = order.get("notes") or {}
    if not isinstance(notes, dict):
        notes = {}
    uid = str(notes.get("uid") or "").strip()
    plan_id = str(notes.get("plan_id") or "").strip()
    org_id = str(notes.get("org_id") or "").strip()
    topup_reservation_id = str(notes.get("topup_reservation_id") or "").strip()
    if not uid:
        raise HTTPException(status_code=400, detail="Payment order is missing its user binding.")
    if not plan_id or plan_id not in PLAN_PRICING:
        raise HTTPException(status_code=400, detail="Payment order is missing a valid plan binding.")

    # The order amount is authoritative for a server-created order. Do not
    # compare it with today's catalog price: legitimate orders can remain
    # payable/reconcilable after a later price change. New orders still use the
    # current catalog price in create_order, while historical captures retain
    # the price they were created with.

    return {
        "uid": uid,
        "plan_id": plan_id,
        "org_id": org_id,
        "topup_reservation_id": topup_reservation_id,
    }

def _can_trigger_reconcile(request: Request, req_body: ReconcilePaymentsRequest) -> bool:
    secret_header = (request.headers.get("x-reconcile-secret") or "").strip()
    if PAYMENT_RECONCILE_SECRET and secret_header and hmac.compare_digest(secret_header, PAYMENT_RECONCILE_SECRET):
        return True

    if not req_body.id_token:
        return False
    decoded = verify_token(req_body.id_token)
    if not decoded:
        return False

    return _decoded_token_is_admin(decoded)

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

def reconcile_payments_once(
    reason: str = "manual",
    lookback_hours: int = PAYMENT_RECONCILE_LOOKBACK_HOURS,
    limit: int = PAYMENT_RECONCILE_BATCH_SIZE,
) -> Dict[str, Any]:
    db = get_db()
    if not db:
        return {"success": False, "error": "Database unavailable"}

    lookback = max(int(lookback_hours or 1), 1)
    query_limit = max(1, min(int(limit or PAYMENT_RECONCILE_BATCH_SIZE), 1000))
    cutoff = _utcnow() - timedelta(hours=lookback)
    cutoff_iso = cutoff.isoformat() + "Z"
    summary = {
        "success": True,
        "reason": reason,
        "lookback_hours": lookback,
        "limit": query_limit,
        "cutoff_utc": cutoff_iso,
        "scanned": 0,
        "applied": 0,
        "duplicates": 0,
        "skipped": 0,
        "errors": 0,
    }

    try:
        docs = (
            db.collection("payment_webhooks")
            .where(filter=firestore.FieldFilter("event", "==", "payment.captured"))
            .where(filter=firestore.FieldFilter("status", "==", "captured"))
            .where(filter=firestore.FieldFilter("reconcile_required", "==", True))
            .where(filter=firestore.FieldFilter("received_at", ">=", cutoff_iso))
            .order_by("received_at", direction=firestore.Query.ASCENDING)
            .limit(query_limit)
            .stream()
        )
    except Exception as e:
        _json_log("error", "payment_reconcile_query_failed", error=str(e))
        return {"success": False, "error": "Failed to query payment webhooks"}

    for doc in docs:
        row = doc.to_dict() or {}
        summary["scanned"] += 1
        payment_id = (row.get("payment_id") or "").strip()
        order_id = (row.get("order_id") or "").strip()
        amount_minor = int(row.get("amount", 0) or 0)
        currency = (row.get("currency") or "INR").upper()

        try:
            order_context = _fetch_bound_order_context(order_id, amount_minor, currency)
        except HTTPException as e:
            summary["errors"] += 1
            _json_log(
                "warning",
                "payment_reconcile_order_resolution_failed",
                webhook_doc=doc.id,
                payment_id=payment_id,
                order_id=order_id,
                status_code=e.status_code,
                detail=e.detail,
            )
            continue
        uid = order_context["uid"]
        plan_id = order_context["plan_id"]
        org_id = order_context["org_id"]
        topup_reservation_id = order_context["topup_reservation_id"]
        try:
            doc.reference.update({"notes": order_context})
        except Exception as e:
            _json_log("warning", "payment_reconcile_context_persist_failed", webhook_doc=doc.id, error=str(e))
        if not payment_id:
            payment_id = f"reconcile_{doc.id}"

        try:
            result = _apply_successful_payment(
                uid=uid,
                plan_id=plan_id,
                payment_id=payment_id,
                order_id=order_id,
                amount_minor=amount_minor,
                currency=currency,
                source=f"reconcile:{reason}",
                org_id=org_id,
                topup_reservation_id=topup_reservation_id,
                order_amount_validated=True,
            )
            if result.get("duplicate"):
                summary["duplicates"] += 1
            else:
                summary["applied"] += 1
            doc.reference.update({
                "reconcile_required": False,
                "reconciled_at": _utcnow().isoformat() + "Z",
            })
        except HTTPException as e:
            summary["errors"] += 1
            _json_log(
                "warning",
                "payment_reconcile_apply_failed",
                payment_id=payment_id,
                uid=uid,
                status_code=e.status_code,
                detail=e.detail,
            )
        except Exception as e:
            summary["errors"] += 1
            _json_log("error", "payment_reconcile_apply_exception", payment_id=payment_id, uid=uid, error=str(e))

    summary["run_at"] = _utcnow().isoformat() + "Z"
    _json_log("info", "payment_reconcile_summary", **summary)
    try:
        db.collection("payment_reconcile_runs").add({
            **summary,
            "expire_at": _retention_deadline(90),
        })
    except Exception as e:
        _json_log("warning", "payment_reconcile_persist_failed", error=str(e))
    if summary["errors"] >= RECONCILE_ERROR_ALERT_THRESHOLD or summary["skipped"] >= RECONCILE_SKIPPED_ALERT_THRESHOLD:
        _send_alert(
            f"[Caption Studio Alert] reconcile summary: errors={summary['errors']} skipped={summary['skipped']} "
            f"applied={summary['applied']} reason={reason}"
        )
    return summary

async def payment_reconciliation_job():
    try:
        reconcile_payments_once(reason="scheduled")
    except Exception as e:
        _json_log("error", "payment_reconcile_job_failed", error=str(e))


def _grant_payment_transactionally(
    db,
    user_ref,
    payment_ref,
    uid: str,
    plan_id: str,
    plan_config: Dict[str, Any],
    payment_id: str,
    order_id: str,
    amount_minor: int,
    currency: str,
    source: str,
    org_id: str,
    topup_reservation_id: str = "",
):
    now_utc = _utcnow()
    cycle_start = now_utc.isoformat() + "Z"
    is_topup = bool(plan_config.get("is_topup", False))
    credits_to_add = int(plan_config["credits"])
    cycle_end = None if is_topup else (
        now_utc + timedelta(days=int(plan_config["days"]))
    ).isoformat() + "Z"

    @firestore.transactional
    def _grant(transaction):
        payment_doc = payment_ref.get(transaction=transaction)
        if payment_doc.exists:
            existing = payment_doc.to_dict() or {}
            return {"success": True, "duplicate": True, "type": existing.get("type", "unknown")}

        user_doc = user_ref.get(transaction=transaction)
        user_data = user_doc.to_dict() if user_doc.exists else {}
        payment_type = "topup" if is_topup else "subscription"

        if is_topup:
            if not user_doc.exists:
                raise HTTPException(status_code=404, detail="User not found. Purchase a plan first.")
            base_tier = _effective_subscription_tier(user_data).replace("_yearly", "")
            if base_tier not in {"starter", "creator", "pro"}:
                raise HTTPException(status_code=403, detail="UPGRADE_REQUIRED: Top-ups available for paid plans only.")
            if plan_id != f"topup_{base_tier}":
                raise HTTPException(status_code=403, detail="This top-up is not available for your current plan.")
            recent_topups = _recent_topup_timestamps(user_data, now_utc.replace(tzinfo=timezone.utc).timestamp())
            active_reservations = _active_topup_reservations(
                user_data,
                now_utc.replace(tzinfo=timezone.utc).timestamp(),
            )
            matching_reservation = next(
                (
                    item for item in active_reservations
                    if item.get("id") == topup_reservation_id and item.get("plan_id") == plan_id
                ),
                None,
            )
            limit = _topup_purchase_limit(plan_config)
            if limit <= 0 or len(recent_topups) >= limit:
                noun = "purchase" if limit == 1 else "purchases"
                raise HTTPException(
                    status_code=429,
                    detail=f"Top-up limit reached: your plan allows {limit} top-up {noun} per rolling 30 days.",
                )
            # Orders created after rolling limits were introduced carry a
            # reservation token. Token-less orders are still accepted below the
            # cap so captured orders created during deployment can be recovered.
            if topup_reservation_id and matching_reservation is None:
                raise HTTPException(status_code=409, detail="This top-up order reservation has expired or is invalid.")

        transaction.create(payment_ref, {
            "payment_id": payment_id,
            "order_id": order_id,
            "amount": amount_minor,
            "currency": (currency or "INR").upper(),
            "status": "captured",
            "plan": plan_id,
            "credits_added": credits_to_add,
            "type": payment_type,
            "timestamp": cycle_start,
            "entitlement_cycle_start": (
                str(user_data.get("billing_cycle_start") or "") if is_topup else cycle_start
            ),
            "source": source,
            **({"topup_reservation_id": topup_reservation_id} if topup_reservation_id else {}),
            **({"org_id": org_id} if org_id else {}),
        })

        if is_topup:
            topup_timestamp = now_utc.replace(tzinfo=timezone.utc).timestamp()
            remaining_reservations = [
                item for item in active_reservations
                if item.get("id") != topup_reservation_id
            ]
            transaction.update(user_ref, {
                "credits_remaining": firestore.Increment(credits_to_add),
                "topup_timestamps": [*recent_topups, topup_timestamp],
                "topup_order_reservations": remaining_reservations,
                "topups_this_cycle": len(recent_topups) + 1,
                **({"org_id": org_id} if org_id else {}),
            })
            return {"success": True, "credits_added": credits_to_add, "type": "topup"}

        user_update = {
            # A plan purchase starts a new fixed entitlement period. Published
            # terms say unused credits do not carry over, so the selected plan's
            # allowance replaces any free/expired/previous-plan balance.
            "credits_remaining": credits_to_add,
            "subscription_tier": plan_id,
            "billing_cycle_start": cycle_start,
            "billing_cycle_end": cycle_end,
            "subscription_expiry": cycle_end,
            "topups_this_cycle": 0,
            **({"org_id": org_id} if org_id else {}),
        }
        if user_doc.exists:
            transaction.update(user_ref, user_update)
        else:
            transaction.set(user_ref, {"uid": uid, "created_at": time.time(), **user_update})
        return {
            "success": True,
            "credits_added": credits_to_add,
            "billing_cycle_end": cycle_end,
            "type": "subscription",
        }

    return _grant(db.transaction())


def _apply_successful_payment(
    uid: str,
    plan_id: str,
    payment_id: str,
    order_id: str,
    amount_minor: int,
    currency: str,
    source: str = "client_verify",
    org_id: str = "",
    topup_reservation_id: str = "",
    order_amount_validated: bool = False,
):
    plan_config = PLAN_PRICING.get(plan_id)
    if not plan_config:
        raise HTTPException(status_code=400, detail=f"Unknown plan: {plan_id}")

    # SECURITY: bind the granted plan to the amount actually paid. Without this a
    # client could pay for a cheap plan, then echo an expensive plan_id at
    # verify-time and receive the higher tier / more credits. The signature check
    # only proves the payment matches its order — it does not bind the plan.
    expected_minor = plan_config.get('usd_cents') if (currency or '').upper() == 'USD' else plan_config.get('inr_paise')
    # For a server-validated Razorpay order, the order amount is authoritative
    # even when the catalog price has since changed. New orders are still priced
    # from the current catalog in create_order; this preserves older captures
    # during delayed verification/reconciliation without weakening the binding
    # between the payment, server-created order, owner, and plan.
    if not order_amount_validated and (expected_minor is None or int(amount_minor or 0) != int(expected_minor)):
        _json_log(
            "warning",
            "payment_amount_plan_mismatch",
            uid=uid,
            plan_id=plan_id,
            currency=currency,
            amount_minor=int(amount_minor or 0),
            expected_minor=expected_minor,
            source=source,
        )
        raise HTTPException(status_code=400, detail="Payment amount does not match the selected plan.")

    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database not initialized")

    user_ref = db.collection('users').document(uid)
    payment_ref = user_ref.collection('payments').document(payment_id)
    result = _grant_payment_transactionally(
        db, user_ref, payment_ref, uid, plan_id, plan_config, payment_id,
        order_id, amount_minor, currency, source, org_id, topup_reservation_id,
    )
    if not result.get("duplicate"):
        _track_event("payment_success", {
            "plan_id": plan_id,
            "currency": (currency or "INR").upper(),
            "amount_minor": int(amount_minor or 0),
            "payment_id": payment_id,
        })
    return result


def _apply_refund_webhook_event(
    db,
    event: str,
    refund_entity: Dict[str, Any],
    payment_entity: Dict[str, Any],
) -> Dict[str, Any]:
    refund_id = str(refund_entity.get("id") or "").strip()
    payment_id = str(refund_entity.get("payment_id") or payment_entity.get("id") or "").strip()
    if not refund_id or not payment_id:
        return {"success": True, "ignored": True, "reason": "missing_refund_or_payment_id"}

    notes = payment_entity.get("notes") or {}
    if not isinstance(notes, dict):
        notes = {}
    uid = str(notes.get("uid") or "").strip()
    if not uid:
        return {"success": True, "ignored": True, "reason": "missing_uid_note"}

    event_status = event.rsplit(".", 1)[-1].lower()
    reported_status = str(refund_entity.get("status") or event_status or "pending").lower()
    if event == "refund.processed":
        reported_status = "processed"
    elif event == "refund.failed":
        reported_status = "failed"
    elif reported_status not in {"pending", "processed", "failed"}:
        reported_status = "pending"

    amount_minor = max(0, int(refund_entity.get("amount", 0) or 0))
    currency = str(refund_entity.get("currency") or payment_entity.get("currency") or "INR").upper()
    user_ref = db.collection("users").document(uid)
    payment_ref = user_ref.collection("payments").document(payment_id)
    refund_ref = payment_ref.collection("refunds").document(refund_id)

    @firestore.transactional
    def _record(transaction):
        payment_doc = payment_ref.get(transaction=transaction)
        if not payment_doc.exists:
            return {"success": True, "ignored": True, "reason": "payment_record_not_found"}

        refund_doc = refund_ref.get(transaction=transaction)
        previous = refund_doc.to_dict() if refund_doc.exists else {}
        previous_status = str((previous or {}).get("status") or "").lower()
        status_rank = {"": 0, "pending": 1, "failed": 2, "processed": 3}
        effective_status = reported_status
        if status_rank.get(previous_status, 0) > status_rank.get(reported_status, 0):
            effective_status = previous_status

        previous_amount = max(0, int((previous or {}).get("amount", amount_minor) or 0))
        effective_amount = amount_minor or previous_amount
        old_counted = previous_amount if previous_status == "processed" else 0
        new_counted = effective_amount if effective_status == "processed" else 0

        payment_data = payment_doc.to_dict() or {}
        current_refunded = max(0, int(payment_data.get("refunded_amount", 0) or 0))
        refunded_amount = max(0, current_refunded - old_counted + new_counted)
        paid_amount = max(0, int(payment_data.get("amount", 0) or 0))
        if refunded_amount > 0:
            aggregate_status = "refunded" if paid_amount and refunded_amount >= paid_amount else "partially_refunded"
        elif effective_status == "failed":
            aggregate_status = "refund_failed"
        else:
            aggregate_status = "refund_pending"

        updated_at = _utcnow().isoformat() + "Z"
        credits_added = max(0, int(payment_data.get("credits_added", 0) or 0))
        previous_reversal_target = max(
            0, int(payment_data.get("entitlement_reversal_target", 0) or 0)
        )
        previous_credits_removed = max(
            0, int(payment_data.get("entitlement_credits_removed", 0) or 0)
        )
        reversal_target = previous_reversal_target
        credits_removed_now = 0
        adjustment_required = bool(payment_data.get("entitlement_adjustment_required", False))
        adjustment_reason = str(payment_data.get("entitlement_adjustment_reason") or "")

        if effective_status == "processed" and paid_amount > 0 and credits_added > 0:
            reversal_target = min(
                credits_added,
                int(math.ceil(credits_added * min(refunded_amount, paid_amount) / paid_amount)),
            )
            additional_target = max(0, reversal_target - previous_reversal_target)
            if additional_target > 0:
                user_doc = user_ref.get(transaction=transaction)
                user_data = user_doc.to_dict() if user_doc.exists else {}
                payment_type = str(payment_data.get("type") or "subscription")
                payment_plan = str(payment_data.get("plan") or "")
                payment_cycle = str(
                    payment_data.get("entitlement_cycle_start")
                    or (payment_data.get("timestamp") if payment_type == "subscription" else "")
                    or ""
                )
                current_cycle = str((user_data or {}).get("billing_cycle_start") or "")
                same_cycle = bool(payment_cycle and current_cycle and payment_cycle == current_cycle)
                same_subscription = str((user_data or {}).get("subscription_tier") or "") == payment_plan
                current_credits = max(0, int((user_data or {}).get("credits_remaining", 0) or 0))
                full_refund = refunded_amount >= paid_amount

                if not user_doc.exists:
                    adjustment_required = True
                    adjustment_reason = "user_record_not_found"
                elif payment_type == "subscription" and same_cycle and same_subscription and full_refund:
                    # A full refund cancels the active fixed-period purchase. Top-up
                    # credits expire with that plan, so the complete active balance is
                    # removed and the account returns to the free tier.
                    credits_removed_now = current_credits
                    transaction.update(user_ref, {
                        "credits_remaining": 0,
                        "subscription_tier": "free",
                        "subscription_expiry": updated_at,
                        "billing_cycle_end": updated_at,
                        "topups_this_cycle": 0,
                    })
                    adjustment_required = False
                    adjustment_reason = ""
                elif same_cycle and (payment_type == "topup" or same_subscription):
                    credits_removed_now = min(current_credits, additional_target)
                    if credits_removed_now:
                        transaction.update(user_ref, {
                            "credits_remaining": current_credits - credits_removed_now,
                        })
                    adjustment_required = credits_removed_now < additional_target
                    adjustment_reason = "insufficient_unspent_credits" if adjustment_required else ""
                else:
                    # Never remove credits from a newer purchase. Flag the old refund
                    # for an operator instead of corrupting the current entitlement.
                    adjustment_required = True
                    adjustment_reason = "payment_is_not_the_active_entitlement_cycle"

        transaction.set(refund_ref, {
            "refund_id": refund_id,
            "payment_id": payment_id,
            "amount": effective_amount,
            "currency": currency,
            "status": effective_status,
            "event": event,
            "updated_at": updated_at,
            "created_at": (previous or {}).get("created_at") or updated_at,
        }, merge=True)
        transaction.update(payment_ref, {
            "refund_status": aggregate_status,
            "refunded_amount": refunded_amount,
            "last_refund_id": refund_id,
            "last_refund_event": event,
            "refund_updated_at": updated_at,
            "entitlement_reversal_target": reversal_target,
            "entitlement_credits_removed": previous_credits_removed + credits_removed_now,
            "entitlement_adjustment_required": adjustment_required,
            "entitlement_adjustment_reason": adjustment_reason,
        })
        return {
            "success": True,
            "applied": True,
            "refund_id": refund_id,
            "payment_id": payment_id,
            "refund_status": aggregate_status,
            "refunded_amount": refunded_amount,
            "entitlement_credits_removed": previous_credits_removed + credits_removed_now,
            "entitlement_adjustment_required": adjustment_required,
            "idempotent_replay": bool(previous) and old_counted == new_counted and previous_status == effective_status,
        }

    result = _record(db.transaction())
    if result.get("applied"):
        _track_event("payment_refund_updated", {
            "event": event,
            "refund_status": result.get("refund_status"),
            "payment_id": payment_id,
        })
        _audit_action("payment_refund_updated", uid, {
            "event": event,
            "refund_id": refund_id,
            "payment_id": payment_id,
            "refund_status": result.get("refund_status"),
        })
        if result.get("entitlement_adjustment_required"):
            _json_log(
                "error",
                "refund_entitlement_adjustment_required",
                uid=uid,
                payment_id=payment_id,
                refund_id=refund_id,
                refund_status=result.get("refund_status"),
            )
            _send_alert(
                "[Caption Studio Alert] Manual refund entitlement adjustment required: "
                f"uid={uid} payment_id={payment_id} refund_id={refund_id}"
            )
    return result

# --- RAZORPAY SUBSCRIPTION ENDPOINTS ---

@app.post("/api/create-order")
def create_order(req: CreateOrderRequest, request: Request, response: Response):
    # Verify User
    decoded_token = verify_token(req.id_token)
    if not decoded_token:
        raise HTTPException(status_code=401, detail="Invalid Authentication Token")
    uid = decoded_token.get("uid", "")
    _assert_tenant_access(uid, decoded_token, req.org_id)
    # Check the durable operator switch before contacting Razorpay. This makes
    # emergency payment shutdown immediate and guarantees no order is created.
    _assert_service_available("pause_payments")
    client_ip = _client_rate_key(request)
    for rate_key in (f"payment:user:{uid}", f"payment:ip:{client_ip}"):
        allowed, retry_after, remaining = _check_rate(_payment_rate, rate_key, PAYMENT_RATE_LIMIT)
        _apply_rate_headers(response, PAYMENT_RATE_LIMIT, remaining, retry_after)
        if not allowed:
            raise HTTPException(status_code=429, detail="Too many payment requests. Please wait before trying again.")
    pay_idem_key = _require_payment_idempotency(uid, req.idempotency_key or request.headers.get("x-idempotency-key", ""), "create_order")
    cached_payment = _payment_idem_get(pay_idem_key)
    if cached_payment and cached_payment.get("status") == "completed":
        return {**cached_payment["payload"], "idempotent_replay": True}
    _audit_action("create_order_attempt", uid, {"plan_id": req.plan_id, "currency": req.currency})

    plan = PLAN_PRICING.get(req.plan_id)
    if not plan:
        raise HTTPException(status_code=400, detail=f"Unknown plan: {req.plan_id}")

    topup_db = None
    topup_user_ref = None
    topup_reservation_id = ""
    # Top-up: validate caller's current tier before creating order
    if plan.get('is_topup'):
        topup_db = get_db()
        if not topup_db:
            raise HTTPException(status_code=503, detail="Account service unavailable; top-up order was not created")
        uid_tmp = decoded_token.get('uid')
        topup_user_ref = topup_db.collection('users').document(uid_tmp)
        ud = topup_user_ref.get()
        user_data_tmp = ud.to_dict() or {} if ud.exists else {}
        user_tier_tmp = _effective_subscription_tier(user_data_tmp) if ud.exists else 'free'
        # Strip _yearly suffix for comparison
        base_tier = user_tier_tmp.replace('_yearly', '')
        if base_tier not in ['starter', 'creator', 'pro']:
            raise HTTPException(status_code=403, detail="UPGRADE_REQUIRED: Top-ups available for paid plans only.")
        expected = f"topup_{base_tier}"
        if req.plan_id != expected:
            raise HTTPException(status_code=403, detail="This top-up is not available for your current plan.")
        _assert_topup_purchase_available(user_data_tmp, plan)
    if not _payment_idem_claim(pay_idem_key):
        concurrent = _payment_idem_get(pay_idem_key)
        if concurrent and concurrent.get("status") == "completed":
            return {**concurrent["payload"], "idempotent_replay": True}
        raise HTTPException(status_code=409, detail="A payment order with this idempotency key is already in progress.")

    if plan.get('is_topup'):
        try:
            topup_reservation_id = _reserve_topup_order_slot(
                topup_db,
                topup_user_ref,
                req.plan_id,
                plan,
            )
        except Exception:
            _payment_idem_delete(pay_idem_key)
            raise

    currency = req.currency.upper() if req.currency else "INR"
    # Top-ups are INR only; USD only applies to subscription plans
    if plan.get('is_topup') or currency != "USD":
        amount = plan['inr_paise']
        currency = "INR"
    else:
        amount = plan.get('usd_cents', plan['inr_paise'])

    if not RAZORPAY_AVAILABLE or rzp_client is None:
        if topup_db is not None and topup_user_ref is not None:
            _release_topup_order_slot(topup_db, topup_user_ref, topup_reservation_id)
        _payment_idem_delete(pay_idem_key)
        detail = "Payment service unavailable"
        if _IS_DEVELOPMENT and (not RAZORPAY_KEY_ID or not RAZORPAY_KEY_SECRET):
            detail = "Payment service is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET, then restart the backend."
        raise HTTPException(status_code=503, detail=detail)

    try:
        order_data = {
            "amount": amount,
            "currency": currency,
            "receipt": f"rcpt_{uid[:8]}_{secrets.token_hex(12)}",
            "notes": {
                "uid": uid,
                "plan_id": req.plan_id,
                "org_id": req.org_id or _tenant_id_from_token(decoded_token),
                "source": "create_order",
                **({"topup_reservation_id": topup_reservation_id} if topup_reservation_id else {}),
            }
        }
        order = rzp_client.order.create(data=order_data)
    except Exception as e:
        if topup_db is not None and topup_user_ref is not None:
            try:
                _release_topup_order_slot(topup_db, topup_user_ref, topup_reservation_id)
            except Exception as release_error:
                _json_log(
                    "warning",
                    "topup_reservation_release_failed",
                    uid=uid,
                    reservation_id=topup_reservation_id,
                    error=str(release_error),
                )
        _payment_idem_delete(pay_idem_key)
        _json_log("error", "razorpay_order_create_failed", uid=uid, plan_id=req.plan_id, error=str(e))
        raise HTTPException(status_code=502, detail="Payment order could not be created. Please try again.") from e

    payload = {"success": True, "order": order, "plan_id": req.plan_id, "key_id": RAZORPAY_KEY_ID}
    _payment_idem_set(pay_idem_key, {"status": "completed", "ts": time.time(), "payload": payload})
    return payload

@app.post("/api/verify-payment")
def verify_payment(req: VerifyPaymentRequest, request: Request, response: Response):
    if not RAZORPAY_AVAILABLE or rzp_client is None:
        raise HTTPException(status_code=503, detail="Payment service unavailable")

    # Verify User
    decoded_token = verify_token(req.id_token)
    if not decoded_token:
        raise HTTPException(status_code=401, detail="Invalid Authentication Token")
    uid = decoded_token.get('uid')
    _assert_tenant_access(uid, decoded_token, req.org_id)
    client_ip = _client_rate_key(request)
    for rate_key in (f"payment:user:{uid}", f"payment:ip:{client_ip}"):
        allowed, retry_after, remaining = _check_rate(_payment_rate, rate_key, PAYMENT_RATE_LIMIT)
        _apply_rate_headers(response, PAYMENT_RATE_LIMIT, remaining, retry_after)
        if not allowed:
            raise HTTPException(status_code=429, detail="Too many payment requests. Please wait before trying again.")
    pay_idem_key = _require_payment_idempotency(uid, req.idempotency_key or request.headers.get("x-idempotency-key", ""), "verify_payment")
    cached_payment = _payment_idem_get(pay_idem_key)
    if cached_payment and cached_payment.get("status") == "completed":
        return {**cached_payment["payload"], "idempotent_replay": True}
    _audit_action("verify_payment_attempt", uid, {"plan_id": req.plan_id, "order_id": req.razorpay_order_id})

    # Verify Signature
    try:
        params_dict = {
            'razorpay_order_id': req.razorpay_order_id,
            'razorpay_payment_id': req.razorpay_payment_id,
            'razorpay_signature': req.razorpay_signature
        }
        rzp_client.utility.verify_payment_signature(params_dict)
    except Exception as e:
        raise HTTPException(status_code=400, detail="Payment verification failed")
    # Resolve plan from echoed plan_id, then prove the live Razorpay payment/order
    # actually match that plan before granting credits.
    plan_config = PLAN_PRICING.get(req.plan_id) if req.plan_id else None
    currency_paid = "INR"
    amount_paid_minor = plan_config.get("inr_paise", 0) if plan_config else 0

    try:
        payment_live = rzp_client.payment.fetch(req.razorpay_payment_id)
        currency_paid = payment_live.get('currency', currency_paid)
        amount_paid_minor = payment_live.get('amount', amount_paid_minor)
    except Exception as e:
        raise HTTPException(status_code=502, detail="Unable to verify payment with Razorpay") from e

    payment_order_id = (payment_live.get("order_id") or "").strip()
    if payment_order_id != req.razorpay_order_id:
        _json_log(
            "warning",
            "payment_order_mismatch",
            uid=uid,
            submitted_order_id=req.razorpay_order_id,
            live_order_id=payment_order_id,
            payment_id=req.razorpay_payment_id,
        )
        raise HTTPException(status_code=400, detail="Payment does not match the submitted order.")

    payment_status = (payment_live.get("status") or "").lower()
    if payment_status != "captured":
        _json_log(
            "warning",
            "payment_not_captured",
            uid=uid,
            order_id=req.razorpay_order_id,
            payment_id=req.razorpay_payment_id,
            status=payment_status,
        )
        raise HTTPException(status_code=400, detail="Payment is not captured yet.")

    try:
        order_live = rzp_client.order.fetch(req.razorpay_order_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail="Unable to verify payment order with Razorpay") from e

    order_amount = int(order_live.get("amount", 0) or 0)
    order_currency = (order_live.get("currency") or "").upper()
    if order_amount != int(amount_paid_minor or 0) or order_currency != (currency_paid or "").upper():
        _json_log(
            "warning",
            "payment_order_amount_mismatch",
            uid=uid,
            order_id=req.razorpay_order_id,
            payment_id=req.razorpay_payment_id,
            order_amount=order_amount,
            payment_amount=int(amount_paid_minor or 0),
            order_currency=order_currency,
            payment_currency=currency_paid,
        )
        raise HTTPException(status_code=400, detail="Payment order amount does not match the captured payment.")

    order_notes = order_live.get("notes") or {}
    if not isinstance(order_notes, dict):
        order_notes = {}
    order_uid = (order_notes.get("uid") or "").strip()
    order_plan_id = (order_notes.get("plan_id") or "").strip()
    if not order_uid or order_uid != uid:
        raise HTTPException(status_code=403, detail="Payment order belongs to a different user.")
    if not order_plan_id:
        raise HTTPException(status_code=400, detail="Payment order is missing its plan binding.")
    if req.plan_id and order_plan_id != req.plan_id:
        raise HTTPException(status_code=400, detail="Payment order does not match the selected plan.")

    if not req.plan_id and order_plan_id:
        req.plan_id = order_plan_id
        plan_config = PLAN_PRICING.get(req.plan_id)
    if not plan_config:
        req.plan_id = _resolve_plan_from_amount_currency(int(amount_paid_minor or 0), currency_paid) or ""
        plan_config = PLAN_PRICING.get(req.plan_id)
    if not plan_config:
        raise HTTPException(status_code=400, detail="Unable to resolve purchased plan")

    if not _payment_idem_claim(pay_idem_key):
        concurrent = _payment_idem_get(pay_idem_key)
        if concurrent and concurrent.get("status") == "completed":
            return {**concurrent["payload"], "idempotent_replay": True}
        raise HTTPException(status_code=409, detail="Payment verification with this idempotency key is already in progress.")

    payload = _apply_successful_payment(
        uid=uid,
        plan_id=req.plan_id,
        payment_id=req.razorpay_payment_id,
        order_id=req.razorpay_order_id,
        amount_minor=int(amount_paid_minor or 0),
        currency=currency_paid,
        source="client_verify",
        org_id=req.org_id or _tenant_id_from_token(decoded_token),
        topup_reservation_id=str(order_notes.get("topup_reservation_id") or "").strip(),
        order_amount_validated=True,
    )
    _payment_idem_set(pay_idem_key, {"status": "completed", "ts": time.time(), "payload": payload})
    return payload

@app.post("/api/razorpay-webhook")
async def razorpay_webhook(request: Request):
    if not RAZORPAY_WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="Webhook secret not configured")

    declared_length = int(request.headers.get("content-length", "0") or 0)
    if declared_length > 256 * 1024:
        raise HTTPException(status_code=413, detail="Webhook payload too large")
    signature = request.headers.get("x-razorpay-signature", "")
    body_bytes = await request.body()
    if len(body_bytes) > 256 * 1024:
        raise HTTPException(status_code=413, detail="Webhook payload too large")
    expected = hmac.new(
        RAZORPAY_WEBHOOK_SECRET.encode("utf-8"),
        body_bytes,
        hashlib.sha256
    ).hexdigest()

    if not signature or not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    try:
        payload = json.loads(body_bytes.decode("utf-8") or "{}")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid webhook payload")

    event = payload.get("event", "")
    payment_entity = ((payload.get("payload") or {}).get("payment") or {}).get("entity") or {}
    refund_entity = ((payload.get("payload") or {}).get("refund") or {}).get("entity") or {}
    payment_id = payment_entity.get("id", "")
    order_id = payment_entity.get("order_id", "")
    amount_minor = int(payment_entity.get("amount", 0) or 0)
    currency = (payment_entity.get("currency", "INR") or "INR").upper()
    status = payment_entity.get("status", "")
    notes = payment_entity.get("notes") or {}

    db = get_db()
    webhook_ref = None
    if db:
        try:
            webhook_document_id = refund_entity.get("id") or payment_id or str(uuid.uuid4())
            webhook_ref = db.collection("payment_webhooks").document(webhook_document_id)
            webhook_ref.set({
                "event": event,
                "payment_id": payment_id,
                "refund_id": refund_entity.get("id", ""),
                "order_id": order_id,
                "currency": currency,
                "amount": amount_minor,
                "status": status,
                "refund_status": refund_entity.get("status", ""),
                "notes": notes,
                "received_at": _utcnow().isoformat() + "Z",
                "reconcile_required": event == "payment.captured" and status == "captured",
                "expire_at": _retention_deadline(90),
            }, merge=True)
        except Exception as e:
            print(f"[Webhook] Failed to persist webhook event: {e}")

    if event in {"refund.created", "refund.processed", "refund.failed"}:
        if not db:
            raise HTTPException(status_code=503, detail="Database unavailable")
        refund_payment_id = str(refund_entity.get("payment_id") or payment_id or "").strip()
        if not refund_payment_id or not RAZORPAY_AVAILABLE or rzp_client is None:
            raise HTTPException(status_code=503, detail="Refund payment verification is unavailable")
        try:
            refund_payment_live = rzp_client.payment.fetch(refund_payment_id)
        except Exception as e:
            # A non-2xx response asks Razorpay to retry instead of acknowledging a
            # refund whose entitlement owner could not be established safely.
            raise HTTPException(status_code=502, detail="Unable to verify refunded payment with Razorpay") from e
        refund_order_id = str(refund_payment_live.get("order_id") or "").strip()
        refund_amount_paid = int(refund_payment_live.get("amount", 0) or 0)
        refund_currency = str(refund_payment_live.get("currency") or "INR").upper()
        refund_context = _fetch_bound_order_context(
            refund_order_id,
            refund_amount_paid,
            refund_currency,
        )
        refund_payment_bound = {**refund_payment_live, "notes": refund_context}
        if webhook_ref is not None:
            try:
                webhook_ref.update({
                    "payment_id": refund_payment_id,
                    "order_id": refund_order_id,
                    "notes": refund_context,
                })
            except Exception as e:
                _json_log("warning", "refund_webhook_context_persist_failed", payment_id=refund_payment_id, error=str(e))
        return _apply_refund_webhook_event(db, event, refund_entity, refund_payment_bound)

    if event == "payment.failed":
        _track_event("payment_failed", {
            "payment_id": payment_id,
            "order_id": order_id,
            "currency": currency,
            "amount_minor": amount_minor,
        })

    # Acknowledge non-captured events.
    if event != "payment.captured" or status != "captured":
        return {"success": True, "ignored": True, "event": event}

    # Resolve the entitlement from the server-created order. Payment notes are
    # not authoritative and are commonly empty in payment.captured payloads.
    order_context = _fetch_bound_order_context(order_id, amount_minor, currency)
    uid = order_context["uid"]
    plan_id = order_context["plan_id"]
    org_id = order_context["org_id"]
    topup_reservation_id = order_context["topup_reservation_id"]
    if webhook_ref is not None:
        try:
            webhook_ref.update({"notes": order_context})
        except Exception as e:
            _json_log("warning", "payment_webhook_context_persist_failed", payment_id=payment_id, error=str(e))

    result = _apply_successful_payment(
        uid=uid,
        plan_id=plan_id,
        payment_id=payment_id or f"webhook_{uuid.uuid4().hex[:12]}",
        order_id=order_id or "",
        amount_minor=amount_minor,
        currency=currency,
        source="webhook",
        org_id=org_id,
        topup_reservation_id=topup_reservation_id,
        order_amount_validated=True,
    )
    if webhook_ref is not None:
        try:
            webhook_ref.update({
                "reconcile_required": False,
                "reconciled_at": _utcnow().isoformat() + "Z",
            })
        except Exception as e:
            _json_log("warning", "payment_webhook_reconcile_mark_failed", payment_id=payment_id, error=str(e))
    return {"success": True, "applied": True, "result": result}

@app.post("/api/reconcile-payments")
def reconcile_payments(req: ReconcilePaymentsRequest, request: Request):
    if not _can_trigger_reconcile(request, req):
        raise HTTPException(status_code=403, detail="Not authorized to run reconciliation")
    summary = reconcile_payments_once(
        reason="manual",
        lookback_hours=req.lookback_hours,
        limit=req.limit,
    )
    if not summary.get("success"):
        raise HTTPException(status_code=500, detail=summary.get("error", "Reconciliation failed"))
    return summary

@app.post("/api/admin/recovery-summary")
def admin_recovery_summary(req: AdminRecoveryRequest):
    if not _is_admin_token(req.id_token):
        raise HTTPException(status_code=403, detail="Admin access required")
    db = get_db()
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")
    lim = max(1, min(int(req.limit or 50), 200))
    dead_letter_rows = []
    reconcile_runs = []
    failed_queries = []
    try:
        for doc in db.collection("export_dead_letter").order_by("timestamp", direction=firestore.Query.DESCENDING).limit(lim).stream():
            dead_letter_rows.append(doc.to_dict())
    except Exception as e:
        failed_queries.append("export_dead_letter")
        _json_log("error", "recovery_summary_query_failed", collection="export_dead_letter", error=str(e))
    try:
        for doc in db.collection("payment_reconcile_runs").order_by("run_at", direction=firestore.Query.DESCENDING).limit(lim).stream():
            reconcile_runs.append(doc.to_dict())
    except Exception as e:
        failed_queries.append("payment_reconcile_runs")
        _json_log("error", "recovery_summary_query_failed", collection="payment_reconcile_runs", error=str(e))
    if failed_queries:
        raise HTTPException(
            status_code=503,
            detail={
                "message": "Recovery summary is incomplete",
                "failed_queries": failed_queries,
                "partial": {
                    "dead_letter_recent": dead_letter_rows,
                    "payment_reconcile_recent": reconcile_runs,
                },
            },
        )
    return {
        "success": True,
        "dead_letter_recent": dead_letter_rows,
        "payment_reconcile_recent": reconcile_runs,
        "slo": _build_slo_snapshot(),
        "ai_system_usage_today": _read_system_ai_usage(db),
    }


@app.post("/api/admin/test-alerts")
def admin_test_alerts(req: AdminAlertTestRequest):
    """Dispatch controlled Slack and Sentry events for launch evidence."""
    if not _is_admin_token(req.id_token):
        raise HTTPException(status_code=403, detail="Admin access required")
    test_id = f"alert-test-{_utcnow().strftime('%Y%m%d-%H%M%S')}-{secrets.token_hex(3)}"
    slack_dispatched = _send_alert(
        f"[Caption Studio Test] Production alert delivery test {test_id}. No action required."
    )
    sentry_event_id = ""
    if SENTRY_DSN and SENTRY_AVAILABLE:
        try:
            sentry_event_id = str(sentry_sdk.capture_message(
                f"Caption Studio production alert delivery test {test_id}",
                level="warning",
            ) or "")
            sentry_sdk.flush(timeout=2.0)
        except Exception as e:
            _json_log("warning", "sentry_test_alert_failed", test_id=test_id, error=str(e))
    _audit_action("production_alert_test_dispatched", "admin", {
        "test_id": test_id,
        "slack_dispatched": bool(slack_dispatched),
        "sentry_dispatched": bool(sentry_event_id),
    })
    if not slack_dispatched or not sentry_event_id:
        raise HTTPException(
            status_code=503,
            detail={
                "message": "One or more alert channels could not be dispatched.",
                "test_id": test_id,
                "slack_dispatched": bool(slack_dispatched),
                "sentry_dispatched": bool(sentry_event_id),
            },
        )
    return {
        "success": True,
        "test_id": test_id,
        "slack_dispatched": True,
        "sentry_dispatched": True,
        "sentry_event_id": sentry_event_id,
        "delivery_confirmation_required": True,
    }

@app.post("/api/admin/tenant-backfill")
def admin_tenant_backfill(req: TenantBackfillRequest):
    if not _is_admin_token(req.id_token):
        raise HTTPException(status_code=403, detail="Admin access required")
    db = get_db()
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")
    lim = max(1, min(int(req.limit or 500), 500))
    users_ref = db.collection("users")
    query = users_ref.order_by("__name__")
    if req.cursor:
        cursor_doc = users_ref.document(req.cursor).get()
        if not cursor_doc.exists:
            raise HTTPException(status_code=400, detail="Invalid tenant backfill cursor")
        query = query.start_after(cursor_doc)
    docs = list(query.limit(lim + 1).stream())
    has_more = len(docs) > lim
    docs = docs[:lim]

    scanned = 0
    updated = 0
    writes = 0
    batch = db.batch()
    touched_tenants = set()

    def queue_set(ref, data):
        nonlocal batch, writes
        if writes >= 400:
            batch.commit()
            batch = db.batch()
            writes = 0
        batch.set(ref, data, merge=True)
        writes += 1

    for doc in docs:
        scanned += 1
        data = doc.to_dict() or {}
        uid = data.get("uid") or doc.id
        org_id = (data.get("org_id") or "").strip()
        now_iso = _utcnow().isoformat() + "Z"
        if not org_id:
            org_id = f"org_{uid}"
            queue_set(doc.reference, {"org_id": org_id, "updated_at": now_iso})
            updated += 1
        tenant_ref = db.collection("tenants").document(org_id)
        if org_id not in touched_tenants:
            queue_set(tenant_ref, {"updated_at": now_iso})
            touched_tenants.add(org_id)
        queue_set(
            tenant_ref.collection("members").document(uid),
            {"uid": uid, "org_id": org_id, "updated_at": now_iso},
        )
    if writes:
        batch.commit()
    return {
        "success": True,
        "scanned": scanned,
        "updated_users": updated,
        "next_cursor": docs[-1].id if docs else None,
        "has_more": has_more,
    }


class RedeemPromoRequest(BaseModel):
    id_token: str = Field(min_length=1, max_length=8_192)
    code: str = Field(min_length=1, max_length=64)

@app.post("/api/redeem-promo")
def redeem_promo(req: RedeemPromoRequest, request: Request, response: Response):
    client_ip = _client_rate_key(request)
    allowed, retry_after, remaining = _check_rate(_promo_rate, client_ip, PROMO_RATE_LIMIT)
    _apply_rate_headers(response, PROMO_RATE_LIMIT, remaining, retry_after)
    if not allowed:
        raise HTTPException(status_code=429, detail="Too many promo code attempts. Please wait before trying again.")
    decoded = verify_token(req.id_token)
    if not decoded:
        raise HTTPException(status_code=401, detail="Unauthorized")
    uid = decoded.get('uid')

    db = get_db()
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")

    code_upper = req.code.strip().upper()
    code_ref = db.collection("promo_codes").document(code_upper)
    user_ref = db.collection("users").document(uid)
    transaction = db.transaction()

    @firestore.transactional
    def redeem_in_transaction(txn):
        code_doc = code_ref.get(transaction=txn)
        if not code_doc.exists:
            raise HTTPException(status_code=400, detail="Invalid or already used code")

        promo = code_doc.to_dict() or {}
        if promo.get("is_used"):
            raise HTTPException(status_code=400, detail="Invalid or already used code")
        if promo.get("plan_id") not in PLAN_PRICING:
            raise HTTPException(status_code=400, detail="Promo code references an invalid plan")

        user_doc = user_ref.get(transaction=txn)
        user_email = user_doc.to_dict().get("email", "") if user_doc.exists else ""
        now = _utcnow()
        expiry_date = (now + relativedelta(months=int(promo["duration_months"]))).date().isoformat()

        txn.update(code_ref, {
            "is_used": True,
            "used_by_email": user_email,
            "used_at": now.isoformat(),
        })

        txn.set(user_ref, {
            "subscription_tier": promo["plan_id"],
            "credits_remaining": int(promo["credits_per_month"]),
            "billing_cycle_start": now.isoformat(),
            "billing_cycle_end": expiry_date,
            "subscription_expiry": expiry_date,
            "is_promo_user": True,
            "promo_code_used": code_upper,
            "promo_plan": promo["plan_id"],
            "promo_expires": expiry_date,
        }, merge=True)
        return promo, expiry_date

    promo, expiry_date = redeem_in_transaction(transaction)

    return {
        "success": True,
        "plan": promo["plan_id"],
        "credits": int(promo["credits_per_month"]),
        "expires": expiry_date,
    }


@app.post("/api/translate")
def translate_captions(req: TranslateRequest, request: Request, response: Response):
    client_ip = _client_rate_key(request)
    allowed, retry_after, remaining = _check_rate(_translate_rate, client_ip, TRANSLATE_RATE_LIMIT)
    _apply_rate_headers(response, TRANSLATE_RATE_LIMIT, remaining, retry_after)
    if not allowed:
        raise HTTPException(status_code=429, detail="Too many translation requests. Please wait before trying again.")
    decoded_token = verify_token(req.id_token)
    if not decoded_token:
        raise HTTPException(status_code=401, detail="Authentication required")
    _assert_tenant_access(decoded_token.get("uid", ""), decoded_token, req.org_id)
    for caption in req.captions:
        if len(caption) > 100:
            raise HTTPException(status_code=400, detail="Caption object is too complex")
        text_value = caption.get("text", "")
        if not isinstance(text_value, str) or len(text_value) > 2_000:
            raise HTTPException(status_code=400, detail="Caption text is invalid")
    if _is_content_safety_blocked(req.target_language, " ".join((c.get("text") or "") for c in req.captions[:30])):
        _track_event("translate_rejected_content_safety")
        raise HTTPException(status_code=422, detail="Request blocked by content safety policy.")
    breaker = _provider_breakers["openai_translate"]
    if not breaker.allow():
        _track_event("translate_circuit_open")
        raise HTTPException(status_code=503, detail="Translation service is temporarily unavailable. Please retry shortly.")

    _reserve_ai_quota(decoded_token.get("uid", ""), "translate")

    try:
        from openai import OpenAI
        client = OpenAI(
            api_key=os.environ.get("OPENAI_API_KEY"),
        )

        texts = [cap.get("text", "") for cap in req.captions]
        numbered_text = "\n".join(f"{i+1}. {t}" for i, t in enumerate(texts))

        # Note: use a distinct local name — `response` is the FastAPI Response
        # param (already used above for rate-limit headers); don't shadow it.
        completion = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": f"You are a professional translator. Translate the following numbered caption lines to {req.target_language}. Keep the numbering. Only return the translated lines, nothing else. Preserve the exact number of lines."},
                {"role": "user", "content": numbered_text}
            ],
            temperature=0.3,
        )

        import re
        translated_text = completion.choices[0].message.content.strip()
        translated_lines = []
        for line in translated_text.split("\n"):
            line = line.strip()
            if not line:
                continue
            cleaned = re.sub(r'^\d+[\.\)]\s*', '', line)
            translated_lines.append(cleaned)

        if len(translated_lines) != len(texts):
            print(f"Translation line count mismatch: expected {len(texts)}, got {len(translated_lines)}. Retrying...")
            retry_response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": f"Translate exactly {len(texts)} numbered caption lines to {req.target_language}. Output exactly {len(texts)} numbered lines. No extra text."},
                    {"role": "user", "content": numbered_text}
                ],
                temperature=0.1,
            )
            retry_text = retry_response.choices[0].message.content.strip()
            translated_lines = []
            for line in retry_text.split("\n"):
                line = line.strip()
                if not line:
                    continue
                cleaned = re.sub(r'^\d+[\.\)]\s*', '', line)
                translated_lines.append(cleaned)

        if len(translated_lines) != len(texts):
            raise RuntimeError("Translation provider returned an incomplete caption set")

        result_captions = []
        for i, cap in enumerate(req.captions):
            new_cap = dict(cap)
            if i < len(translated_lines):
                new_cap["text"] = translated_lines[i]
            result_captions.append(new_cap)
        breaker.on_success()
        _track_event("translate_success", {"target_language": req.target_language, "count": len(req.captions)})
        return {"success": True, "captions": result_captions}
    except Exception as e:
        breaker.on_failure()
        _track_event("translate_failed", {"target_language": req.target_language, "error": str(e)})
        _json_log("error", "translation_provider_failed", uid=decoded_token.get("uid", ""), error=str(e))
        _release_ai_quota(decoded_token.get("uid", ""), "translate")
        raise HTTPException(status_code=502, detail="Translation service failed. Please retry.") from e

class DetectLanguageRequest(BaseModel):
    file_id: str = Field(min_length=36, max_length=36)
    id_token: str = Field(default="", max_length=8_192)
    org_id: str = Field(default="", max_length=128)

@app.post("/api/detect-language")
def detect_language(req: DetectLanguageRequest, request: Request, response: Response):
    # Auth — same dev-mode bypass as /api/export
    decoded_token = _authenticate_media_request(req.id_token, req.org_id)
    uid = (decoded_token.get("uid") or "").strip() or "unknown-user"
    client_ip = _client_rate_key(request)
    allowed, retry_after, remaining = _check_rate(
        _detect_language_rate, f"ip:{client_ip}", DETECT_LANGUAGE_RATE_LIMIT
    )
    _apply_rate_headers(response, DETECT_LANGUAGE_RATE_LIMIT, remaining, retry_after)
    if not allowed:
        raise HTTPException(status_code=429, detail="Too many language detection requests. Please wait before trying again.")
    user_allowed, user_retry_after, user_remaining = _check_rate(
        _detect_language_rate, f"user:{uid}", DETECT_LANGUAGE_RATE_LIMIT
    )
    if not user_allowed:
        _apply_rate_headers(response, DETECT_LANGUAGE_RATE_LIMIT, user_remaining, user_retry_after)
        raise HTTPException(status_code=429, detail="Too many language detection requests. Please wait before trying again.")
    if not _validate_file_id(req.file_id):
        raise HTTPException(status_code=400, detail="Invalid file_id")
    _assert_upload_owner(req.file_id, uid)
    input_path = _safe_find_upload(req.file_id)
    if not input_path:
        _track_event("detect_language_failed_not_found")
        raise HTTPException(status_code=404, detail="File not found")
    breaker = _provider_breakers["openai_detect_language"]
    if not breaker.allow():
        _track_event("detect_language_circuit_open")
        raise HTTPException(status_code=503, detail="Language detection is temporarily unavailable. Please retry shortly.")
    _reserve_ai_quota(uid, "detect_language")
    temp_path = ""
    try:
        import tempfile
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as _tf:
            temp_path = _tf.name
        extract_result = subprocess.run([
            "ffmpeg", "-i", input_path, "-t", "30",
            "-vn", "-acodec", "mp3", "-y", temp_path
        ], capture_output=True)
        if extract_result.returncode != 0 or not os.path.isfile(temp_path) or os.path.getsize(temp_path) <= 0:
            raise RuntimeError("Audio extraction failed")
        from openai import OpenAI
        client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
        with open(temp_path, "rb") as af:
            result = client.audio.transcriptions.create(
                model="whisper-1", file=af, response_format="verbose_json"
            )
        detected = getattr(result, 'language', 'english')
        if os.path.exists(temp_path):
            os.remove(temp_path)
        breaker.on_success()
        _track_event("detect_language_success", {"language": detected})
        return {"success": True, "language": detected}
    except Exception as e:
        breaker.on_failure()
        _track_event("detect_language_failed", {"error": str(e)})
        _json_log("error", "language_detection_provider_failed", uid=uid, error=str(e))
        _release_ai_quota(uid, "detect_language")
        raise HTTPException(status_code=502, detail="Language detection failed. Please retry.") from e
    finally:
        try:
            if temp_path and os.path.exists(temp_path):
                os.remove(temp_path)
        except Exception:
            pass

class DeleteFileRequest(BaseModel):
    file_id: str = Field(min_length=36, max_length=36)
    id_token: str = Field(min_length=1, max_length=8_192)
    org_id: str = Field(default="", max_length=128)


class AccountDataRequest(BaseModel):
    id_token: str = Field(min_length=1, max_length=8_192)
    org_id: str = Field(default="", max_length=128)
    consent_granted: bool = False
    terms_version: str = Field(default="", max_length=40, pattern=r"^[0-9A-Za-z._-]*$")
    privacy_version: str = Field(default="", max_length=40, pattern=r"^[0-9A-Za-z._-]*$")


class AccountExportRequest(AccountDataRequest):
    payment_limit: int = Field(default=100, ge=1, le=500)
    payment_cursor: str = Field(default="", max_length=1_500)


def _delete_user_document_tree(db, user_ref):
    recursive_delete = getattr(db, "recursive_delete", None)
    if callable(recursive_delete):
        recursive_delete(user_ref)
        return

    for collection_name in ("payments", "export_usage"):
        child_ref = user_ref.collection(collection_name)
        while True:
            child_docs = list(child_ref.limit(400).stream())
            if not child_docs:
                break
            if hasattr(db, "batch"):
                batch = db.batch()
                for child_doc in child_docs:
                    batch.delete(child_doc.reference)
                batch.commit()
            else:
                for child_doc in child_docs:
                    child_doc.reference.delete()
            if len(child_docs) < 400:
                break
    user_ref.delete()


def _remove_history_item_transactionally(db, user_ref, file_id: str):
    @firestore.transactional
    def _remove(transaction):
        user_doc = user_ref.get(transaction=transaction)
        if not user_doc.exists:
            raise HTTPException(status_code=404, detail="Account not found")
        history = (user_doc.to_dict() or {}).get("history", []) or []
        transaction.update(
            user_ref,
            {"history": [item for item in history if item.get("id") != file_id]},
        )

    _remove(db.transaction())


def _mark_history_item_deleting_transactionally(db, user_ref, file_id: str):
    @firestore.transactional
    def _mark(transaction):
        user_doc = user_ref.get(transaction=transaction)
        if not user_doc.exists:
            raise HTTPException(status_code=404, detail="Account not found")
        history = (user_doc.to_dict() or {}).get("history", []) or []
        found = False
        updated_history = []
        for item in history:
            if isinstance(item, dict) and item.get("id") == file_id:
                found = True
                updated_history.append({
                    **item,
                    "deletion_pending": True,
                    "deletion_requested_at": datetime.now(timezone.utc).isoformat(),
                })
            else:
                updated_history.append(item)
        if not found:
            raise HTTPException(status_code=404, detail="File not found in this account")
        transaction.update(user_ref, {"history": updated_history})

    _mark(db.transaction())


@app.post("/api/account-bootstrap")
def account_bootstrap(req: AccountDataRequest, request: Request):
    """Create safe account defaults server-side and return the user's record."""
    decoded_token = verify_token(req.id_token)
    if not decoded_token:
        raise HTTPException(status_code=401, detail="Auth required")
    uid = (decoded_token.get("uid") or "").strip()
    if not uid:
        raise HTTPException(status_code=401, detail="Auth required")
    _assert_tenant_access(uid, decoded_token, req.org_id)
    db = get_db()
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")

    user_ref = db.collection("users").document(uid)
    # Existing accounts keep working while sign-ups are paused; only the first
    # bootstrap of a brand-new account is blocked.
    if not user_ref.get().exists:
        _assert_service_available("pause_signups")
        client_ip = _client_rate_key(request)
        for rate_key, rate_limit in (
            (f"signup:ip:{client_ip}", SIGNUP_RATE_LIMIT),
            (f"signup:user:{uid}", SIGNUP_USER_RATE_LIMIT),
        ):
            allowed, _retry_after, _remaining = _check_rate(
                _signup_rate, rate_key, rate_limit
            )
            if not allowed:
                raise HTTPException(
                    status_code=429,
                    detail="Too many account creation attempts. Please wait before trying again.",
                )
    safe_profile = {
        "uid": uid,
        "email": str(decoded_token.get("email") or "")[:320],
        "displayName": str(decoded_token.get("name") or "")[:200],
        "photoURL": str(decoded_token.get("picture") or "")[:2_048],
    }
    try:
        user_ref.create({
            **safe_profile,
            "credits_remaining": 3,
            "subscription_tier": "free",
            "subscription_expiry": None,
            "export_timestamps": [],
            "created_at": time.time(),
        })
        _audit_action("account_bootstrap_created", uid)
        _track_event("account_signup", {"uid": uid})
    except AlreadyExists:
        # Only identity-provider profile fields may be refreshed here. Billing
        # and entitlement fields remain server-controlled elsewhere.
        user_ref.set(safe_profile, merge=True)

    if req.consent_granted:
        if not req.terms_version or not req.privacy_version:
            raise HTTPException(status_code=400, detail="Consent document versions are required")
        consent_key = hashlib.sha256(
            f"{uid}:{req.terms_version}:{req.privacy_version}:grant".encode("utf-8")
        ).hexdigest()
        consent_payload = {
            "action": "grant",
            "terms_version": req.terms_version,
            "privacy_version": req.privacy_version,
            "captured_at": datetime.now(timezone.utc),
            "ip_address": request.client.host if request.client else "unknown",
            "user_agent": (request.headers.get("user-agent") or "")[:500],
            "capture_method": "login_checkbox",
        }
        try:
            user_ref.collection("consents").document(consent_key).create(consent_payload)
        except AlreadyExists:
            pass
        user_ref.set({
            "accepted_terms_version": req.terms_version,
            "accepted_privacy_version": req.privacy_version,
            "consent_updated_at": datetime.now(timezone.utc),
        }, merge=True)
        _audit_action("consent_granted", uid, {
            "terms_version": req.terms_version,
            "privacy_version": req.privacy_version,
        })

    user_doc = user_ref.get()
    if not user_doc.exists:
        raise HTTPException(status_code=503, detail="Account initialization unavailable")
    return {"success": True, "user": user_doc.to_dict() or {}}


@app.post("/api/account-export")
def account_export(req: AccountExportRequest):
    decoded_token = verify_token(req.id_token)
    if not decoded_token:
        raise HTTPException(status_code=401, detail="Auth required")
    uid = decoded_token.get("uid")
    _assert_tenant_access(uid, decoded_token, req.org_id)
    db = get_db()
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")
    user_ref = db.collection("users").document(uid)
    user_doc = user_ref.get()
    payments_ref = user_ref.collection("payments")
    payment_query = payments_ref.order_by("timestamp", direction=firestore.Query.DESCENDING)
    if req.payment_cursor:
        cursor_doc = payments_ref.document(req.payment_cursor).get()
        if not cursor_doc.exists:
            raise HTTPException(status_code=400, detail="Invalid payment cursor")
        payment_query = payment_query.start_after(cursor_doc)
    page_docs = list(payment_query.limit(req.payment_limit + 1).stream())
    has_more = len(page_docs) > req.payment_limit
    page_docs = page_docs[:req.payment_limit]
    payment_items = [{"id": p.id, **(p.to_dict() or {})} for p in page_docs]
    payload = {
        "uid": uid,
        "user": user_doc.to_dict() if user_doc.exists else {},
        "payments": payment_items,
        "next_payment_cursor": page_docs[-1].id if page_docs else None,
        "has_more_payments": has_more,
        "exported_at": _utcnow().isoformat() + "Z",
    }
    _audit_action("account_export", uid, {"payment_count": len(payment_items)})
    return {"success": True, "data": payload}


@app.post("/api/account-delete")
def account_delete(req: AccountDataRequest):
    decoded_token = verify_token(req.id_token)
    if not decoded_token:
        raise HTTPException(status_code=401, detail="Auth required")
    uid = decoded_token.get("uid")
    _assert_tenant_access(uid, decoded_token, req.org_id)
    db = get_db()
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")
    user_ref = db.collection("users").document(uid)
    user_doc = user_ref.get()
    history = []
    if user_doc.exists:
        if hasattr(user_ref, "set"):
            user_ref.set({
                "deletion_pending": True,
                "deletion_requested_at": _utcnow().isoformat() + "Z",
            }, merge=True)
        history = user_doc.to_dict().get("history", []) or []
        for item in history:
            filename = os.path.basename(str(item.get("filename") or ""))
            if not filename:
                continue
            candidate = os.path.realpath(os.path.join(EXPORT_DIR, filename))
            if candidate.startswith(os.path.realpath(EXPORT_DIR) + os.sep) and os.path.isfile(candidate):
                try:
                    os.remove(candidate)
                except OSError as e:
                    _json_log("error", "account_delete_local_cleanup_failed", uid=uid, file=filename, error=str(e))
                    raise HTTPException(status_code=503, detail="Local export cleanup failed; deletion can be retried") from e

    cloud_cleanup = delete_user_exports(uid)
    source_cleanup = delete_user_uploads(uid)
    known_cloud_exports = any(item.get("firebase_path") for item in history if isinstance(item, dict))
    if (
        (cloud_cleanup is None and (_IS_PRODUCTION or known_cloud_exports))
        or (source_cleanup is None and _IS_PRODUCTION)
    ):
        _json_log("error", "account_delete_storage_cleanup_failed", uid=uid)
        raise HTTPException(status_code=503, detail="Cloud export cleanup failed; deletion can be retried")
    if user_doc.exists:
        try:
            _delete_user_document_tree(db, user_ref)
        except Exception as e:
            _json_log("error", "account_delete_firestore_failed", uid=uid, error=str(e))
            raise HTTPException(status_code=500, detail="Account data cleanup failed; deletion can be retried") from e
    try:
        # Delete the login identity last. Until this succeeds the user can still
        # authenticate and retry an otherwise idempotent cleanup request.
        firebase_auth.delete_user(uid)
    except Exception as e:
        _json_log("warning", "account_delete_auth_delete_failed", uid=uid, error=str(e))
        raise HTTPException(status_code=500, detail="Account data was removed, but authentication deletion must be retried") from e
    _audit_action("account_delete", uid)
    return {"success": True}

@app.post("/api/delete-file")
def delete_user_file(req: DeleteFileRequest):
    decoded_token = verify_token(req.id_token)
    if not decoded_token:
        raise HTTPException(status_code=401, detail="Auth required")
    uid = decoded_token.get('uid')
    _assert_tenant_access(uid, decoded_token, req.org_id)
    _audit_action("delete_file_attempt", uid, {"file_id": req.file_id})

    if not _validate_file_id(req.file_id):
        raise HTTPException(status_code=400, detail="Invalid file_id")

    db = get_db()
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable; file deletion can be retried")
    user_ref = db.collection('users').document(uid)
    user_doc = user_ref.get()
    if not user_doc.exists:
        raise HTTPException(status_code=404, detail="Account not found")
    history = (user_doc.to_dict() or {}).get('history', []) or []
    matching_items = [
        item for item in history
        if isinstance(item, dict) and item.get('id') == req.file_id
    ]
    if not matching_items:
        raise HTTPException(status_code=404, detail="File not found in this account")

    # Persist ownership and retry metadata before touching either storage system.
    _mark_history_item_deleting_transactionally(db, user_ref, req.file_id)

    failed_cloud_paths = []
    for item in matching_items:
        remote_path = item.get('firebase_path')
        if remote_path and not delete_from_firebase_storage(remote_path):
            failed_cloud_paths.append(remote_path)
    if failed_cloud_paths:
        _json_log("error", "delete_file_storage_cleanup_failed", uid=uid, file_id=req.file_id, count=len(failed_cloud_paths))
        raise HTTPException(
            status_code=503,
            detail={"message": "Cloud file cleanup was incomplete", "retryable": True},
        )

    # Ownership is now proven. Delete every local render variant for this UUID.
    local_delete_errors = []
    local_deleted = 0
    if os.path.exists(EXPORT_DIR):
        real_export_dir = os.path.realpath(EXPORT_DIR)
        valid_names = {
            name for name in os.listdir(EXPORT_DIR)
            if name == f"export_{req.file_id}.mp4" or name.startswith(f"export_{req.file_id}_")
        }
        for name in valid_names:
            candidate = os.path.realpath(os.path.join(EXPORT_DIR, name))
            if not candidate.startswith(real_export_dir + os.sep) or not os.path.isfile(candidate):
                continue
            try:
                os.remove(candidate)
                local_deleted += 1
            except OSError as e:
                local_delete_errors.append(name)
                _json_log("error", "delete_file_local_cleanup_failed", uid=uid, file=name, error=str(e))
    if local_delete_errors:
        raise HTTPException(
            status_code=503,
            detail={"message": "Local file cleanup was incomplete", "files": local_delete_errors, "retryable": True},
        )

    upload_metadata = _load_upload_metadata(req.file_id)
    if upload_metadata and str(upload_metadata.get("uid") or "") == uid:
        source_remote_path = str(upload_metadata.get("remote_path") or "")
        if source_remote_path and not delete_from_firebase_storage(source_remote_path):
            raise HTTPException(
                status_code=503,
                detail={"message": "Source media cleanup was incomplete", "retryable": True},
            )
        for name in list(os.listdir(UPLOAD_DIR)):
            if name.startswith(req.file_id):
                candidate = os.path.realpath(os.path.join(UPLOAD_DIR, name))
                if candidate.startswith(os.path.realpath(UPLOAD_DIR) + os.sep) and os.path.isfile(candidate):
                    try:
                        os.remove(candidate)
                    except OSError:
                        pass
        try:
            db.collection("uploads").document(req.file_id).delete()
        except Exception:
            pass
        if _redis_client is not None:
            try:
                _redis_client.delete(f"upload_owner:{req.file_id}", f"upload_meta:{req.file_id}")
            except Exception:
                pass
        _upload_owners.pop(req.file_id, None)

    _remove_history_item_transactionally(db, user_ref, req.file_id)
    _audit_action("delete_file_success", uid, {"file_id": req.file_id, "local_files_deleted": local_deleted})
    return {"success": True, "local_files_deleted": local_deleted}

@app.get("/api/media/upload/{file_id}")
def serve_uploaded_media(file_id: str, token: str = ""):
    payload = _verify_media_token(token, "upload")
    if payload.get("file_id") != file_id:
        raise HTTPException(status_code=403, detail="Media token does not match this upload")
    path = _safe_find_upload(file_id)
    if not path or not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Upload not found")
    media_type = mimetypes.guess_type(path)[0] or "application/octet-stream"
    return FileResponse(path, media_type=media_type)


@app.post("/api/media/upload-url")
def refresh_uploaded_media_url(req: MediaUrlRequest):
    decoded_token = _authenticate_media_request(req.id_token, req.org_id)
    uid = (decoded_token.get("uid") or "").strip() or "unknown-user"
    if not _validate_file_id(req.file_id):
        raise HTTPException(status_code=400, detail="Invalid file_id")
    _assert_upload_owner(req.file_id, uid)
    path = _safe_find_upload(req.file_id)
    if not path or not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Upload not found")
    return {"success": True, "raw_url": _signed_upload_url(req.file_id, uid)}


@app.get("/api/media/export/{filename}")
def serve_exported_media(filename: str, token: str = ""):
    if not re.match(r"^export_[a-f0-9-]{36}_[a-f0-9]{12}\.mp4$", filename or ""):
        raise HTTPException(status_code=400, detail="Invalid export filename")
    payload = _verify_media_token(token, "export")
    if payload.get("filename") != filename:
        raise HTTPException(status_code=403, detail="Media token does not match this export")
    real_export_dir = os.path.realpath(EXPORT_DIR)
    path = os.path.realpath(os.path.join(EXPORT_DIR, filename))
    if not path.startswith(real_export_dir + os.sep):
        raise HTTPException(status_code=400, detail="Invalid export path")
    if not os.path.isfile(path):
        uid = str(payload.get("uid") or "")
        if not uid or "/" in uid or "\\" in uid:
            raise HTTPException(status_code=403, detail="Invalid export owner")
        partial = f"{path}.part-{uuid.uuid4().hex}"
        try:
            downloaded = download_export_from_firebase_storage(
                f"exports/{uid}/{filename}", partial
            )
            if downloaded:
                os.replace(partial, path)
        finally:
            if os.path.exists(partial):
                try:
                    os.remove(partial)
                except OSError:
                    pass
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="Export not found")
    return FileResponse(
        path,
        media_type="video/mp4",
        filename=filename,
        headers={"Cache-Control": "no-store, max-age=0"},
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=os.environ.get("BACKEND_HOST", "127.0.0.1"), port=8000)
