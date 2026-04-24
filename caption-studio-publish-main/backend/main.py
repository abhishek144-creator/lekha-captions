from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, UploadFile, File, HTTPException, Response
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import shutil
import os
import uuid
import urllib.request
import json
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
from firebase_admin_setup import verify_token, get_db, upload_to_firebase_storage, delete_from_firebase_storage
from firebase_admin import auth as firebase_auth
import math
from google.cloud import firestore
import mimetypes
import logging
import re
import shlex

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
    from rq import Queue
    from rq.job import Job
    from rq import Retry as RQRetry
    RQ_AVAILABLE = True
except ImportError:
    Queue = None
    Job = None
    RQRetry = None
    RQ_AVAILABLE = False

app = FastAPI()

logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"))
_logger = logging.getLogger("caption_studio_backend")


def _json_log(level: str, event: str, **fields):
    record = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
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
        return
    try:
        payload = {"text": text}
        req = urllib.request.Request(
            SLACK_ALERT_WEBHOOK_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        urllib.request.urlopen(req, timeout=5)
    except Exception as e:
        _json_log("warning", "alert_webhook_failed", error=str(e))

@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    rid = _request_id(request)
    requested_version = (request.headers.get("x-api-version") or "").strip()
    if requested_version and requested_version < API_MIN_SUPPORTED_VERSION:
        return JSONResponse(
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
        )
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
    return response

# Initialize Razorpay Client (Keys will be read from environment variables)
RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "")
RAZORPAY_WEBHOOK_SECRET = os.environ.get("RAZORPAY_WEBHOOK_SECRET", "")
rzp_client = None
if RAZORPAY_AVAILABLE and RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET:
    rzp_client = _razorpay_module.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
elif RAZORPAY_AVAILABLE:
    _json_log("warning", "razorpay_credentials_missing")

# --- PLAN PRICING (locked — do not change) ---
PLAN_PRICING = {
    # Monthly plans
    'starter': {
        'inr_paise': 9900, 'usd_cents': 99,
        'credits': 15, 'days': 30,
        'daily_limit': 3, 'max_video_seconds': 120,
        'export_retention_hours': 2, 'tier': 'starter',
    },
    'creator': {
        'inr_paise': 19900, 'usd_cents': 199,
        'credits': 45, 'days': 30,
        'daily_limit': 5, 'max_video_seconds': 180,
        'export_retention_hours': 24, 'tier': 'creator',
    },
    'pro': {
        'inr_paise': 39900, 'usd_cents': 399,
        'credits': 100, 'days': 30,
        'daily_limit': None, 'max_video_seconds': 180,
        'export_retention_hours': 72, 'tier': 'pro',
    },
    # Yearly plans (billed as single charge, 365 days)
    'starter_yearly': {
        'inr_paise': 99900, 'usd_cents': 999,
        'credits': 15, 'days': 365,
        'daily_limit': 3, 'max_video_seconds': 120,
        'export_retention_hours': 2, 'tier': 'starter_yearly',
    },
    'creator_yearly': {
        'inr_paise': 199900, 'usd_cents': 1999,
        'credits': 45, 'days': 365,
        'daily_limit': 5, 'max_video_seconds': 180,
        'export_retention_hours': 24, 'tier': 'creator_yearly',
    },
    'pro_yearly': {
        'inr_paise': 399900, 'usd_cents': 3999,
        'credits': 100, 'days': 365,
        'daily_limit': None, 'max_video_seconds': 180,
        'export_retention_hours': 72, 'tier': 'pro_yearly',
    },
    # Top-up packs (add credits only, no tier/expiry change)
    'topup_starter': {'inr_paise': 4900, 'credits': 10, 'is_topup': True, 'allowed_tier': 'starter'},
    'topup_creator': {'inr_paise': 4900, 'credits': 15, 'is_topup': True, 'allowed_tier': 'creator'},
    'topup_pro':     {'inr_paise': 7900, 'credits': 25, 'is_topup': True, 'allowed_tier': 'pro'},
}

# Semaphore to limit concurrent renders to 2. This creates a queue invisible to the user!
render_semaphore = asyncio.Semaphore(2)
MAX_CONCURRENT_EXPORTS_PER_USER = 1
EXPORT_FAILURE_LIMIT = 5
EXPORT_FAILURE_WINDOW = 15 * 60

# In-memory operational state (swap for Redis in multi-instance deployments)
_export_jobs: Dict[str, Dict[str, Any]] = {}
_export_idempotency: Dict[str, Dict[str, Any]] = {}
_active_exports_by_user: Dict[str, int] = {}
_export_failures: Dict[str, list] = {}

# Global APScheduler reference (None if apscheduler not installed)
scheduler = AsyncIOScheduler() if SCHEDULER_AVAILABLE else None

REDIS_URL = os.environ.get("REDIS_URL", "")
_redis_client = None
EXPORT_QUEUE_NAME = os.environ.get("EXPORT_QUEUE_NAME", "caption_export_jobs")
DURABLE_QUEUE_ENABLED = os.environ.get("ENABLE_DURABLE_QUEUE", "1") == "1"
SLACK_ALERT_WEBHOOK_URL = os.environ.get("SLACK_ALERT_WEBHOOK_URL", "").strip()
PAYMENT_RECONCILE_INTERVAL_MINUTES = int(os.environ.get("PAYMENT_RECONCILE_INTERVAL_MINUTES", "20"))
PAYMENT_RECONCILE_LOOKBACK_HOURS = int(os.environ.get("PAYMENT_RECONCILE_LOOKBACK_HOURS", "48"))
PAYMENT_RECONCILE_BATCH_SIZE = int(os.environ.get("PAYMENT_RECONCILE_BATCH_SIZE", "200"))
PAYMENT_RECONCILE_SECRET = os.environ.get("PAYMENT_RECONCILE_SECRET", "").strip()
API_CURRENT_VERSION = os.environ.get("API_CURRENT_VERSION", "2026-04-21")
API_MIN_SUPPORTED_VERSION = os.environ.get("API_MIN_SUPPORTED_VERSION", "2026-01-01")
DEPRECATION_SUNSET_DATE = os.environ.get("DEPRECATION_SUNSET_DATE", "2026-12-31")
ENFORCE_TENANT_ISOLATION = os.environ.get("ENFORCE_TENANT_ISOLATION", "0") == "1"
ENABLE_PROGRESSIVE_DELIVERY = os.environ.get("ENABLE_PROGRESSIVE_DELIVERY", "1") == "1"
REQUIRE_PAYMENT_IDEMPOTENCY = os.environ.get("REQUIRE_PAYMENT_IDEMPOTENCY", "1") == "1"
DEBUG_MODE_ENABLED = os.environ.get("DEBUG_MODE", "").strip().lower() not in ("", "0", "false", "no", "off")
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

if REDIS_AVAILABLE and REDIS_URL:
    try:
        _redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)
        _redis_client.ping()
        _json_log("info", "redis_connected")
    except Exception as e:
        _redis_client = None
        _json_log("warning", "redis_connection_failed", error=str(e))

_export_queue = None
if DURABLE_QUEUE_ENABLED and _redis_client is not None and RQ_AVAILABLE:
    try:
        _export_queue = Queue(EXPORT_QUEUE_NAME, connection=_redis_client, default_timeout=30 * 60)
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
        if not (f.startswith("_tmp_") and f.endswith(".ass")):
            continue
        filepath = os.path.join(backend_dir, f)
        if not os.path.isfile(filepath):
            continue
        try:
            age = now - os.stat(filepath).st_mtime
            if age > 7200:  # 2 hours
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

    total_deleted = metrics["uploads_deleted"] + metrics["exports_deleted"] + metrics["temp_ass_deleted"] + metrics["cache_deleted"]
    if total_deleted > 0 or metrics["errors"] > 0:
        _json_log(
            "info",
            "janitor_summary",
            uploads_deleted=metrics["uploads_deleted"],
            exports_deleted=metrics["exports_deleted"],
            temp_ass_deleted=metrics["temp_ass_deleted"],
            cache_deleted=metrics["cache_deleted"],
            errors=metrics["errors"],
        )

@app.on_event("startup")
async def startup_event():
    if scheduler is not None:
        scheduler.add_job(advanced_janitor_job, 'interval', minutes=15)
        scheduler.add_job(payment_reconciliation_job, 'interval', minutes=max(PAYMENT_RECONCILE_INTERVAL_MINUTES, 5))
        scheduler.start()
        print(
            f"[Scheduler] Janitor every 15m + payment reconciliation every "
            f"{max(PAYMENT_RECONCILE_INTERVAL_MINUTES, 5)}m."
        )
    else:
        print("[Janitor] apscheduler not available — running simple asyncio fallback.")
        asyncio.create_task(_simple_janitor_loop())

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
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)

# Simple in-memory rate limiters (ip -> list of timestamps)
_upload_rate: Dict[str, list] = {}
UPLOAD_RATE_LIMIT = 10    # max uploads per hour per IP
UPLOAD_RATE_WINDOW = 3600  # 1 hour

_payment_rate: Dict[str, list] = {}
PAYMENT_RATE_LIMIT = 10   # max payment attempts per hour per IP

_promo_rate: Dict[str, list] = {}
PROMO_RATE_LIMIT = 5      # max promo redemptions per hour per IP

_translate_rate: Dict[str, list] = {}
TRANSLATE_RATE_LIMIT = 20  # max translation attempts per hour per IP

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
_analytics_last_alert_ts: Dict[str, float] = {}
_route_latency_samples: Dict[str, list] = {}
_payment_idempotency: Dict[str, Dict[str, Any]] = {}
_tenant_memberships: Dict[str, set] = {}


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
    if _redis_client is not None:
        try:
            _redis_client.hincrby("analytics:counters", event, 1)
        except Exception:
            pass
    _json_log("info", "analytics_event", name=event, payload=payload or {})
    db = get_db()
    if db:
        try:
            db.collection("analytics_events").add({
                "event": event,
                "payload": payload or {},
                "timestamp": datetime.utcnow().isoformat() + "Z",
            })
        except Exception as e:
            _json_log("warning", "analytics_event_persist_failed", name=event, error=str(e))

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
        except Exception:
            pass

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
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }

def _tenant_id_from_token(decoded_token: Optional[Dict[str, Any]]) -> str:
    if not decoded_token:
        return ""
    return (decoded_token.get("org_id") or decoded_token.get("tenant_id") or "").strip()

def _is_explicit_dev_auth_token(id_token: str) -> bool:
    return DEBUG_MODE_ENABLED and (id_token or "").strip() == "mock-token"

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
        raise HTTPException(status_code=403, detail="Tenant isolation enabled but token has no org_id")
    if requested_org and requested_org != token_org:
        raise HTTPException(status_code=403, detail="Cross-tenant write is not allowed")
    _tenant_memberships.setdefault(token_org, set()).add(uid)
    db = get_db()
    if db and uid:
        try:
            db.collection("tenants").document(token_org).set(
                {"updated_at": datetime.utcnow().isoformat() + "Z"},
                merge=True,
            )
            db.collection("tenants").document(token_org).collection("members").document(uid).set(
                {"uid": uid, "org_id": token_org, "updated_at": datetime.utcnow().isoformat() + "Z"},
                merge=True,
            )
            db.collection("users").document(uid).set(
                {"org_id": token_org, "updated_at": datetime.utcnow().isoformat() + "Z"},
                merge=True,
            )
        except Exception as e:
            _json_log("warning", "tenant_membership_persist_failed", uid=uid, org_id=token_org, error=str(e))

def _validate_feature_flag_safety(flag_name: str):
    if not ENABLE_PROGRESSIVE_DELIVERY:
        raise HTTPException(status_code=403, detail="Feature flags are disabled in this environment")
    if not re.match(r"^[a-zA-Z0-9_.-]{2,64}$", flag_name or ""):
        raise HTTPException(status_code=400, detail="Invalid flag name")


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
            urllib.request.urlopen(req, timeout=5)
        except Exception as e:
            _json_log("warning", "alert_webhook_failed", error=str(e))


def _audit_action(action: str, uid: str = "", metadata: Optional[Dict[str, Any]] = None):
    payload = {
        "action": action,
        "uid": uid or "anonymous",
        "metadata": metadata or {},
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }
    _json_log("info", "audit_action", **payload)
    db = get_db()
    if not db:
        return
    try:
        db.collection("audit_logs").add(payload)
    except Exception as e:
        _json_log("warning", "audit_persist_failed", action=action, error=str(e))


def _scan_upload_for_threat(file_path: str) -> bool:
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
        combined = f"{result.stdout}\n{result.stderr}".lower()
        infected = "infected" in combined and "0 infected" not in combined
        return result.returncode == 0 and not infected
    except Exception as e:
        _json_log("warning", "malware_scan_failed", error=str(e))
        # Fail closed when scanner is configured but unavailable.
        return False

def _is_content_safety_blocked(*values: str) -> bool:
    if not CONTENT_SAFETY_BLOCKLIST:
        return False
    joined = " ".join((v or "") for v in values).lower()
    return any(token in joined for token in CONTENT_SAFETY_BLOCKLIST)

def _persist_export_job(job_id: str, payload: Dict[str, Any]):
    """Persist export job metadata for debugging/analytics. Best-effort."""
    db = get_db()
    if not db:
        return
    try:
        db.collection("export_jobs").document(job_id).set(payload, merge=True)
    except Exception as e:
        _json_log("warning", "export_job_persist_failed", job_id=job_id, error=str(e))

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
        except Exception:
            return None
    return _payment_idempotency.get(key)

def _payment_idem_set(key: str, value: Dict[str, Any], ttl_seconds: int = 24 * 3600):
    if not key:
        return
    if _redis_client is not None:
        try:
            _redis_client.setex(f"pay_idem:{key}", ttl_seconds, json.dumps(value))
            return
        except Exception:
            pass
    _payment_idempotency[key] = value

def _require_payment_idempotency(uid: str, key: str, op: str) -> str:
    if not REQUIRE_PAYMENT_IDEMPOTENCY:
        return ""
    safe = (key or "").strip()
    if not safe:
        raise HTTPException(status_code=400, detail=f"Missing idempotency key for {op}")
    return f"{uid}:{op}:{safe}"

def _check_rate(store: Dict[str, list], key: str, limit: int, window: int = 3600):
    """Returns (allowed, retry_after_seconds, remaining).
    Mutates *store* in-place to record the current timestamp."""
    if _redis_client is not None:
        try:
            now_ts = time.time()
            rkey = f"rl:{key}"
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
        except Exception:
            # On Redis failure, gracefully fall back to in-memory path.
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

def _acquire_export_slot(uid: str) -> bool:
    if _redis_client is not None:
        try:
            k = f"expactive:{uid}"
            count = int(_redis_client.incr(k))
            _redis_client.expire(k, 30 * 60)
            if count > MAX_CONCURRENT_EXPORTS_PER_USER:
                _redis_client.decr(k)
                return False
            return True
        except Exception:
            pass
    active_count = _active_exports_by_user.get(uid, 0)
    if active_count >= MAX_CONCURRENT_EXPORTS_PER_USER:
        return False
    _active_exports_by_user[uid] = active_count + 1
    return True

def _release_export_slot(uid: str):
    if _redis_client is not None:
        try:
            k = f"expactive:{uid}"
            remaining = int(_redis_client.decr(k))
            if remaining <= 0:
                _redis_client.delete(k)
            return
        except Exception:
            pass
    _active_exports_by_user[uid] = max(0, _active_exports_by_user.get(uid, 1) - 1)

def _apply_rate_headers(response: Optional[Response], limit: int, remaining: int, retry_after: int = 0):
    if response is None:
        return
    response.headers["X-RateLimit-Limit"] = str(limit)
    response.headers["X-RateLimit-Remaining"] = str(max(0, remaining))
    if retry_after > 0:
        response.headers["Retry-After"] = str(retry_after)

def _evaluate_export_policy(user_data: Dict[str, Any], now_ts: float):
    credits = int(user_data.get('credits_remaining', 0) or 0)
    tier = user_data.get('subscription_tier', 'free') or 'free'
    export_history = user_data.get('export_timestamps', []) or []
    recent_exports = [ts for ts in export_history if ts > (now_ts - 86400)]

    plan_time_expired = False
    expiry_str = user_data.get('subscription_expiry')
    if tier != 'free' and expiry_str:
        try:
            expiry_date = datetime.fromisoformat(expiry_str.replace('Z', '+00:00'))
            if expiry_date < datetime.now(expiry_date.tzinfo):
                plan_time_expired = True
        except Exception:
            pass

    if credits <= 0:
        if tier != 'free' and plan_time_expired:
            return False, "PLAN_EXPIRED: Your plan has expired and you have no credits left. Please renew to continue exporting.", recent_exports
        return False, "UPGRADE_REQUIRED: You have no credits remaining. Please upgrade your plan to continue exporting.", recent_exports

    # Respect tier-based daily limit where configured, with a safe default for free/dev users.
    daily_limit = PLAN_PRICING.get(tier, {}).get('daily_limit', 5)
    if daily_limit is not None and len(recent_exports) >= int(daily_limit):
        return False, f"Limit reached: You can only export {daily_limit} videos per 24 hours.", recent_exports

    return True, "", recent_exports

def _set_export_job(job_id: str, status: str, **kwargs):
    payload = _export_jobs.get(job_id, {})
    payload.update({"status": status, "updated_at": time.time(), **kwargs})
    _export_jobs[job_id] = payload
    _persist_export_job(job_id, payload)

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
    return None


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


def _resolve_export_preset(tier: str, requested_quality: str, requested_fps: int) -> Dict[str, Any]:
    normalized = _normalize_tier_name(tier)
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

# Fix: Remove hardcoded 'backend/' prefix from abspath as we are running the process from inside backend/
UPLOAD_DIR = os.path.abspath("uploads")
EXPORT_DIR = os.path.abspath("exports")
FONTS_DIR = os.path.abspath("flat_fonts")
CACHE_DIR = os.path.abspath("cache")
TRANSCRIPTION_CACHE_DIR = os.path.join(CACHE_DIR, "transcriptions")
RENDER_CACHE_DIR = os.path.join(CACHE_DIR, "renders")
DEAD_LETTER_DIR = os.path.join(CACHE_DIR, "dead_letter")

for d in [UPLOAD_DIR, EXPORT_DIR, FONTS_DIR, CACHE_DIR, TRANSCRIPTION_CACHE_DIR, RENDER_CACHE_DIR, DEAD_LETTER_DIR]:
    os.makedirs(d, exist_ok=True)

# This initializes the processor which will download the font automatically
processor = VideoProcessor(FONTS_DIR)

class CaptionItem(BaseModel):
    id: Any
    text: str
    start_time: float
    end_time: float
    animation: str = "none"
    is_text_element: bool = False
    custom_style: Optional[Dict[str, Any]] = None
    word_styles: Dict[str, Any] = {}
    words: List[Any] = []

class ExportRequest(BaseModel):
    file_id: str
    captions: List[CaptionItem]
    style: Dict[str, Any] = {}
    word_layouts: Dict[str, Any] = {}
    id_token: str = ""  # Firebase Auth Token (optional — bypassed in dev mode)
    idempotency_key: str = ""
    quality: str = "1080p"  # Export quality: "4k", "1080p", "720p"
    fps: int = 30  # Frame rate: 24, 30, 60
    org_id: str = ""

    def validated_style(self) -> Dict[str, Any]:
        """Return a copy of style with all numeric fields clamped to safe ranges."""
        s = dict(self.style)
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
        return s

class CreateOrderRequest(BaseModel):
    plan_id: str
    id_token: str
    currency: str = "INR"
    idempotency_key: str = ""
    org_id: str = ""

class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    id_token: str
    plan_id: str = ""  # echoed back from create-order response
    idempotency_key: str = ""
    org_id: str = ""

class ReconcilePaymentsRequest(BaseModel):
    id_token: str = ""
    lookback_hours: int = PAYMENT_RECONCILE_LOOKBACK_HOURS
    limit: int = PAYMENT_RECONCILE_BATCH_SIZE

class AdminRecoveryRequest(BaseModel):
    id_token: str = ""
    limit: int = 50

class TenantBackfillRequest(BaseModel):
    id_token: str = ""
    limit: int = 500

class ProcessRequest(BaseModel):
    file_id: str
    language: str = "English"
    min_words: int = 0
    max_words: int = 0
    id_token: str = ""  # Firebase Auth Token (optional — bypassed in dev mode)
    org_id: str = ""

class TranslateRequest(BaseModel):
    captions: List[Dict[str, Any]]
    target_language: str
    id_token: str = ""
    org_id: str = ""

class ParitySignatureRequest(BaseModel):
    captions: List[Dict[str, Any]]
    style: Dict[str, Any] = {}
    word_layouts: Dict[str, Any] = {}


def _write_dead_letter(job_id: str, reason: str, payload: Optional[Dict[str, Any]] = None):
    data = {
        "job_id": job_id,
        "reason": reason,
        "payload": payload or {},
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }
    try:
        with open(os.path.join(DEAD_LETTER_DIR, f"{job_id}.json"), "w", encoding="utf-8") as f:
            json.dump(data, f)
    except Exception as e:
        _json_log("warning", "dead_letter_file_write_failed", job_id=job_id, error=str(e))

    db = get_db()
    if db:
        try:
            db.collection("export_dead_letter").document(job_id).set(data, merge=True)
        except Exception as e:
            _json_log("warning", "dead_letter_db_write_failed", job_id=job_id, error=str(e))


def _sanitize_export_request_payload(payload: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not isinstance(payload, dict):
        return {}
    sanitized = dict(payload)
    sanitized.pop("id_token", None)
    sanitized.pop("idempotency_key", None)
    return sanitized


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
                'credits_remaining': 100,
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
        _log(rid, "Firestore unavailable; skipping credit policy checks")

    user_tier = _normalize_tier_name(user_data.get("subscription_tier", "free") if user_data else "free")
    preset = _resolve_export_preset(user_tier, req.quality, req.fps)
    if preset["downgraded"]:
        _log(rid, f"Export preset adjusted by tier={user_tier}: requested {req.quality}@{req.fps} -> {preset['quality']}@{preset['fps']}")

    if not _validate_file_id(req.file_id):
        raise HTTPException(status_code=400, detail="Invalid file_id")
    input_path = _safe_find_upload(req.file_id)
    if not input_path:
        raise HTTPException(status_code=404, detail="Video not found")

    captions = [c.dict() for c in req.captions]
    # Reuse rendered artifact for identical request payload.
    media_hash = _compute_media_hash(input_path)
    request_hash = hashlib.sha256(json.dumps({
        "media_hash": media_hash,
        "captions": captions,
        "style": req.style,
        "word_layouts": req.word_layouts,
        "quality": preset["quality"],
        "fps": preset["fps"],
    }, sort_keys=True).encode("utf-8")).hexdigest()
    cached_render_path = os.path.join(RENDER_CACHE_DIR, f"{request_hash}.mp4")

    output_filename = f"export_{req.file_id}.mp4"
    output_path = os.path.join(EXPORT_DIR, output_filename)
    queue_entered_at = time.time()
    _set_export_job(export_job_id, "queued", queue_entered_at=queue_entered_at)

    if os.path.exists(cached_render_path):
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
        style_with_quality = {**req.validated_style(), 'quality': preset["quality"], 'fps': preset["fps"]}
        result = await processor.burn_only(input_path, output_path, captions, style_with_quality, req.word_layouts)
        if not result.get('success'):
            raise HTTPException(status_code=500, detail=result.get('error') or "Render failed")
        render_finished_at = time.time()
        render_ms = int((render_finished_at - processing_started_at) * 1000)
        try:
            shutil.copy2(output_path, cached_render_path)
        except Exception:
            pass

    _set_export_job(export_job_id, "finalizing")
    video_url = f"/exports/{output_filename}"
    firebase_url = None
    try:
        remote_path = f"exports/{uid}/{output_filename}"
        firebase_url = upload_to_firebase_storage(output_path, remote_path, "video/mp4")
        if firebase_url:
            video_url = firebase_url
            try:
                os.remove(output_path)
            except Exception:
                pass
    except Exception as e:
        _log(rid, f"Firebase upload failed, using local export: {e}")

    if db_available and user_ref is not None:
        recent_exports.append(now)
        history_item = {
            "id": req.file_id,
            "filename": output_filename,
            "url": video_url,
            "createdAt": now * 1000,
            "firebase_path": f"exports/{uid}/{output_filename}" if firebase_url else None
        }
        current_history = user_data.get('history', []) or []
        current_history.insert(0, history_item)
        if len(current_history) > 5:
            current_history = current_history[:5]

        user_ref.update({
            'credits_remaining': max(0, credits - 1),
            'export_timestamps': recent_exports,
            'history': current_history
        })

    retention_hours = 2
    if db_available and user_data:
        current_tier = user_data.get('subscription_tier', 'free')
        if current_tier in PLAN_PRICING:
            retention_hours = PLAN_PRICING[current_tier].get('export_retention_hours', 2)

    expires_at = (datetime.utcnow() + timedelta(hours=retention_hours)).isoformat() + "Z"
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
    return payload


def run_export_job_task(export_job_id: str, req_payload: Dict[str, Any], uid: str):
    rid = f"worker-{export_job_id[:8]}"
    try:
        req = ExportRequest(**req_payload)
        return asyncio.run(_process_export_job_core(req, uid, rid, export_job_id))
    except Exception as e:
        _set_export_job(export_job_id, "failed", failed_at=time.time(), error=str(e))
        _write_dead_letter(
            export_job_id,
            str(e),
            {"req_payload": _sanitize_export_request_payload(req_payload), "uid": uid},
        )
        raise
    finally:
        _release_export_slot(uid)

# Debug endpoint: view the last exported ASS file (only in DEBUG_MODE)
@app.get("/api/debug/last-ass")
async def get_last_ass():
    if not os.environ.get("DEBUG_MODE"):
        raise HTTPException(status_code=404, detail="Not found")
    ass_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "last_export_debug.ass")
    if not os.path.exists(ass_path):
        return {"error": "No debug ASS file found. Export a video first."}
    with open(ass_path, "r", encoding="utf-8") as f:
        content = f.read()
    # Return content only — never expose server filesystem paths
    return {"ass_content": content}

# Google Fonts Cache Map
_cached_google_fonts = None

@app.get("/api/fonts")
async def get_google_fonts():
    global _cached_google_fonts
    if _cached_google_fonts is not None:
        return {"fonts": _cached_google_fonts}

    try:
        req = urllib.request.Request(
            'https://fonts.google.com/metadata/fonts',
            headers={'User-Agent': 'Mozilla/5.0'}
        )
        with urllib.request.urlopen(req) as res:
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
        if request:
            client_ip = request.client.host if request.client else "unknown"
            allowed, retry_after, remaining = _check_rate(_upload_rate, client_ip, UPLOAD_RATE_LIMIT, UPLOAD_RATE_WINDOW)
            _apply_rate_headers(response, UPLOAD_RATE_LIMIT, remaining, retry_after)
            if not allowed:
                _track_event("upload_rejected_rate_limited")
                return {"success": False, "error": "Too many uploads. Please wait before trying again."}

        file_ext = file.filename.split('.')[-1].lower() if '.' in file.filename else ''
        if _is_content_safety_blocked(file.filename or ""):
            _track_event("upload_rejected_content_safety")
            return {"success": False, "error": "Upload blocked by content safety policy."}
        if file_ext not in ALLOWED_EXTENSIONS:
            _track_event("upload_rejected_extension", {"ext": file_ext})
            return {"success": False, "error": f"File type .{file_ext} not supported. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"}

        content_type = (file.content_type or "").lower()
        guessed_type, _ = mimetypes.guess_type(file.filename or "")
        if content_type and not any(content_type.startswith(p) for p in ALLOWED_CONTENT_PREFIXES):
            _track_event("upload_rejected_content_type", {"content_type": content_type})
            return {"success": False, "error": f"Unsupported MIME type: {content_type}"}
        if guessed_type and not any(guessed_type.startswith(p) for p in ALLOWED_CONTENT_PREFIXES):
            _track_event("upload_rejected_guess_type", {"guessed_type": guessed_type})
            return {"success": False, "error": f"Unsupported file type: {guessed_type}"}

        content_length = int(request.headers.get('content-length', 0)) if request else 0
        if content_length > MAX_UPLOAD_BYTES:
            _track_event("upload_rejected_too_large", {"content_length": content_length})
            return {"success": False, "error": "File too large. Maximum 500MB allowed."}

        content = await file.read()
        if len(content) > MAX_UPLOAD_BYTES:
            _track_event("upload_rejected_too_large", {"content_length": len(content)})
            return {"success": False, "error": "File too large. Maximum 500MB allowed."}

        file_id = str(uuid.uuid4())
        file_path = os.path.join(UPLOAD_DIR, f"{file_id}.{file_ext}")
        with open(file_path, "wb") as buffer:
            buffer.write(content)
        _log(rid, f"Upload accepted file_id={file_id} ext={file_ext} bytes={len(content)}")
        if not _scan_upload_for_threat(file_path):
            try:
                os.remove(file_path)
            except Exception:
                pass
            _track_event("upload_rejected_malware_scan")
            return {"success": False, "error": "Upload failed security scan."}

        try:
            metadata = _probe_media(file_path)
            duration = float((metadata.get("format") or {}).get("duration") or 0)
        except Exception as probe_error:
            try:
                os.remove(file_path)
            except Exception:
                pass
            _track_event("upload_rejected_ffprobe", {"error": str(probe_error)})
            return {"success": False, "error": f"Invalid media file: {probe_error}"}

        max_seconds = 180
        if duration > max_seconds:
            os.remove(file_path)
            _track_event("upload_rejected_duration", {"duration": duration})
            return {"success": False, "error": f"Video is {duration:.0f}s. Maximum allowed is {max_seconds // 60} minutes."}

        _track_event("upload_success", {"ext": file_ext})
        _audit_action("upload_success", metadata={"file_id": file_id, "ext": file_ext, "duration": duration})
        return {"success": True, "file_id": file_id, "raw_url": f"/uploads/{file_id}.{file_ext}"}
    except Exception as e:
        _track_event("upload_failed", {"error": str(e)})
        return {"success": False, "error": str(e)}

@app.post("/api/process")
async def process_video(req: ProcessRequest):
    # Auth — same dev-mode bypass as /api/export
    _authenticate_media_request(req.id_token, req.org_id)
    if not _validate_file_id(req.file_id):
        raise HTTPException(status_code=400, detail="Invalid file_id")
    input_path = _safe_find_upload(req.file_id)
    if not input_path:
        _track_event("process_failed_not_found")
        return {"success": False, "error": "File not found"}

    try:
        media_hash = _compute_media_hash(input_path)
        cache_path = _build_process_cache_path(media_hash, req.language, req.min_words, req.max_words)
    except Exception:
        media_hash = ""
        cache_path = ""

    if cache_path and os.path.exists(cache_path):
        try:
            with open(cache_path, "r", encoding="utf-8") as f:
                cached = json.load(f)
            cached["cached"] = True
            _track_event("process_cache_hit", {"language": req.language})
            return cached
        except Exception:
            pass

    result = await processor.generate_captions_only(
        input_path,
        target_language=req.language,
        min_words=req.min_words,
        max_words=req.max_words,
    )

    if result.get("success"):
        _track_event("process_success", {"language": req.language})
        if cache_path:
            try:
                with open(cache_path, "w", encoding="utf-8") as f:
                    json.dump(result, f)
            except Exception as e:
                print(f"[Cache] Failed to write transcription cache: {e}")
    else:
        _track_event("process_failed", {"language": req.language, "error": result.get("error", "unknown")})

    return result

@app.post("/api/export-parity-signature")
async def export_parity_signature(req: ParitySignatureRequest):
    return {
        "success": True,
        "signature": _build_parity_signature(req.captions, req.style, req.word_layouts),
    }

@app.post("/api/export")
async def export_video(req: ExportRequest, request: Request, response: Response):
    rid = _request_id(request)
    _log(rid, f"Export requested file_id={req.file_id} quality={req.quality}")
    _track_event("export_requested", {"quality": req.quality, "fps": req.fps})

    # 1. Authenticate user
    decoded_token = _authenticate_media_request(req.id_token, req.org_id)
    uid = (decoded_token.get("uid") or "").strip() or "dev-local-user"
    if decoded_token.get("_dev_mode"):
        _log(rid, "Using explicit debug auth bypass token")

    # Lightweight abuse control for repeated failing exports (failure-only budget).
    now_ts = time.time()
    recent_failures = _get_recent_export_failures(uid)
    if len(recent_failures) >= EXPORT_FAILURE_LIMIT:
        retry_after = max(1, int(EXPORT_FAILURE_WINDOW - (now_ts - min(recent_failures))))
        response.headers["Retry-After"] = str(retry_after)
        raise HTTPException(status_code=429, detail="Too many failed export attempts. Please retry after a short wait.")

    # Idempotency key support to prevent duplicate renders/charges.
    raw_idem = (req.idempotency_key or request.headers.get("x-idempotency-key") or "").strip()
    auto_idem = False
    if not raw_idem:
        # Auto-key to prevent accidental double-click duplicate renders.
        raw_idem = f"auto:{req.file_id}:{req.quality}:{req.fps}"
        auto_idem = True
    idem_key = f"{uid}:{raw_idem}" if raw_idem else ""
    if idem_key:
        cached = _idem_get(idem_key)
        if cached and (time.time() - cached.get("ts", 0) < 6 * 3600):
            if cached.get("status") == "completed" and not auto_idem:
                _log(rid, f"Idempotent replay for key={raw_idem[:16]}")
                return {**cached["payload"], "idempotent_replay": True}
            if cached.get("status") == "in_progress":
                raise HTTPException(status_code=409, detail="Export with this idempotency key is already in progress.")
        _idem_set(idem_key, {"status": "in_progress", "ts": time.time()})

    # Per-user concurrent export guard.
    if not _acquire_export_slot(uid):
        if idem_key:
            _idem_delete(idem_key)
        raise HTTPException(status_code=429, detail="Another export is already running for this account. Please wait.")

    export_job_id = str(uuid.uuid4())
    safe_request_snapshot = _sanitize_export_request_payload(req.model_dump())
    _set_export_job(
        export_job_id,
        "queued",
        uid=uid,
        file_id=req.file_id,
        quality=req.quality,
        started_at=time.time(),
        request_snapshot=safe_request_snapshot,
    )

    release_export_slot_in_request = True
    try:
        if _export_queue is not None:
            _export_queue.enqueue_call(
                func=run_export_job_task,
                args=(export_job_id, safe_request_snapshot, uid),
                job_id=export_job_id,
                retry=RQRetry(max=3, interval=[10, 30, 60]) if RQRetry else None,
                result_ttl=24 * 3600,
                failure_ttl=7 * 24 * 3600,
            )
            _audit_action("export_enqueued", uid, {"job_id": export_job_id, "file_id": req.file_id})
            release_export_slot_in_request = False
            return {
                "success": True,
                "queued": True,
                "export_job_id": export_job_id,
                "status": "queued",
            }

        payload = await _process_export_job_core(req, uid, rid, export_job_id)
        if idem_key:
            if auto_idem:
                _idem_delete(idem_key)
            else:
                _idem_set(idem_key, {"status": "completed", "ts": time.time(), "payload": payload})
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
        raise HTTPException(status_code=500, detail=f"Export failed: {e}")
    finally:
        if release_export_slot_in_request:
            _release_export_slot(uid)

@app.get("/api/export-status/{job_id}")
async def export_status(job_id: str, request: Request):
    job = _export_jobs.get(job_id)
    if not job:
        db = get_db()
        if db:
            try:
                snap = db.collection("export_jobs").document(job_id).get()
                if snap.exists:
                    job = snap.to_dict() or {}
            except Exception:
                pass
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
async def export_result(job_id: str, request: Request):
    job = _export_jobs.get(job_id)
    if not job:
        db = get_db()
        if db:
            try:
                snap = db.collection("export_jobs").document(job_id).get()
                if snap.exists:
                    job = snap.to_dict() or {}
            except Exception:
                pass
    if not job:
        raise HTTPException(status_code=404, detail="Export job not found")
    _require_export_job_access(request, job)
    if job.get("status") != "completed":
        return {"success": False, "status": job.get("status", "unknown"), "error": job.get("error")}
    payload = job.get("payload") or {}
    if not payload:
        return {"success": False, "status": "completed", "error": "Result payload missing"}
    return payload


@app.post("/api/export-replay/{job_id}")
async def export_replay(job_id: str, request: Request):
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
    request_snapshot = job.get("request_snapshot")
    uid = job.get("uid", "")
    if not request_snapshot:
        raise HTTPException(status_code=400, detail="No request snapshot found to replay")
    new_job_id = str(uuid.uuid4())
    _set_export_job(new_job_id, "queued", uid=uid, file_id=request_snapshot.get("file_id"), started_at=time.time(), request_snapshot=request_snapshot)
    _export_queue.enqueue_call(
        func=run_export_job_task,
        args=(new_job_id, request_snapshot, uid),
        job_id=new_job_id,
        retry=RQRetry(max=3, interval=[10, 30, 60]) if RQRetry else None,
        result_ttl=24 * 3600,
        failure_ttl=7 * 24 * 3600,
    )
    _audit_action("export_replay_enqueued", uid, {"source_job_id": job_id, "new_job_id": new_job_id})
    return {"success": True, "export_job_id": new_job_id, "status": "queued"}


@app.get("/api/analytics/summary")
async def analytics_summary():
    export_success = _analytics_counters.get("export_success", 0)
    export_failed = _analytics_counters.get("export_failed_http", 0) + _analytics_counters.get("export_failed_exception", 0)
    process_success = _analytics_counters.get("process_success", 0)
    process_failed = _analytics_counters.get("process_failed", 0)
    _maybe_alert_failure_ratio("export", export_success, export_failed)
    _maybe_alert_failure_ratio("process", process_success, process_failed)

    return {
        "counters": _analytics_counters,
        "health": {
            "export_failure_rate": (export_failed / max(export_success + export_failed, 1)),
            "process_failure_rate": (process_failed / max(process_success + process_failed, 1)),
        },
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }

@app.get("/api/v1/analytics/summary")
async def analytics_summary_v1():
    return await analytics_summary()

@app.post("/api/analytics/track")
async def analytics_track(request: Request):
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid analytics payload")
    event = (body.get("event") or "").strip()
    if not event or len(event) > 80:
        raise HTTPException(status_code=400, detail="Invalid analytics event")
    payload = body.get("payload") or {}
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Invalid analytics payload")
    _track_event(event, payload)
    return {"success": True}

@app.get("/api/version")
async def api_version():
    return {
        "success": True,
        "version": API_CURRENT_VERSION,
        "min_supported_version": API_MIN_SUPPORTED_VERSION,
        "sunset_date": DEPRECATION_SUNSET_DATE,
        "progressive_delivery_enabled": ENABLE_PROGRESSIVE_DELIVERY,
    }

@app.get("/api/v1/version")
async def api_version_v1():
    return await api_version()

@app.get("/api/slo/status")
async def slo_status():
    return _build_slo_snapshot()

@app.get("/api/health/readiness")
async def readiness():
    snapshot = _build_slo_snapshot()
    return {
        "success": True,
        "ready": snapshot.get("release_gate_passed", True),
        "slo": snapshot,
        "queue": {
            "durable_enabled": DURABLE_QUEUE_ENABLED,
            "queue_name": EXPORT_QUEUE_NAME,
            "connected": _export_queue is not None,
        },
    }

@app.get("/api/feature-flags")
async def feature_flags(request: Request):
    _validate_feature_flag_safety("feature_flags")
    token = request.headers.get("authorization", "").replace("Bearer ", "").strip()
    decoded = verify_token(token) if token else None
    if not decoded:
        raise HTTPException(status_code=401, detail="Auth required")
    if decoded.get("admin") is not True and decoded.get("email", "").lower() not in {
        e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()
    }:
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

def _resolve_plan_from_amount_currency(amount_minor: int, currency: str) -> Optional[str]:
    c = (currency or "INR").upper()
    for plan_key, p in PLAN_PRICING.items():
        if c == "USD" and amount_minor == p.get("usd_cents"):
            return plan_key
        if c == "INR" and amount_minor == p.get("inr_paise"):
            return plan_key
    return None

def _parse_ts_maybe(value: Any) -> Optional[datetime]:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        v = value.strip()
        if not v:
            return None
        if v.endswith("Z"):
            v = v[:-1] + "+00:00"
        try:
            dt = datetime.fromisoformat(v)
            if dt.tzinfo is not None:
                dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
            return dt
        except Exception:
            return None
    return None

def _can_trigger_reconcile(request: Request, req_body: ReconcilePaymentsRequest) -> bool:
    secret_header = (request.headers.get("x-reconcile-secret") or "").strip()
    if PAYMENT_RECONCILE_SECRET and secret_header and hmac.compare_digest(secret_header, PAYMENT_RECONCILE_SECRET):
        return True

    if not req_body.id_token:
        return False
    decoded = verify_token(req_body.id_token)
    if not decoded:
        return False

    if decoded.get("admin") is True:
        return True

    allowed_admins = {
        e.strip().lower()
        for e in os.environ.get("ADMIN_EMAILS", "").split(",")
        if e.strip()
    }
    return bool(allowed_admins and decoded.get("email", "").lower() in allowed_admins)

def _is_admin_token(id_token: str = "", request: Optional[Request] = None) -> bool:
    token = (id_token or "").strip()
    if not token and request is not None:
        token = request.headers.get("authorization", "").replace("Bearer ", "").strip()
    if not token:
        return False
    decoded = verify_token(token)
    if not decoded:
        return False
    if decoded.get("admin") is True:
        return True
    allowed_admins = {
        e.strip().lower()
        for e in os.environ.get("ADMIN_EMAILS", "").split(",")
        if e.strip()
    }
    return bool(allowed_admins and decoded.get("email", "").lower() in allowed_admins)

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
    cutoff = datetime.utcnow() - timedelta(hours=lookback)
    summary = {
        "success": True,
        "reason": reason,
        "lookback_hours": lookback,
        "limit": query_limit,
        "cutoff_utc": cutoff.isoformat() + "Z",
        "scanned": 0,
        "applied": 0,
        "duplicates": 0,
        "skipped": 0,
        "errors": 0,
    }

    try:
        docs = (
            db.collection("payment_webhooks")
            .order_by("received_at", direction=firestore.Query.DESCENDING)
            .limit(query_limit)
            .stream()
        )
    except Exception as e:
        _json_log("error", "payment_reconcile_query_failed", error=str(e))
        return {"success": False, "error": "Failed to query payment webhooks", "details": str(e)}

    for doc in docs:
        row = doc.to_dict() or {}
        received_at = _parse_ts_maybe(row.get("received_at"))
        if received_at and received_at < cutoff:
            continue

        if row.get("event") != "payment.captured" or row.get("status") != "captured":
            continue

        summary["scanned"] += 1
        payment_id = (row.get("payment_id") or "").strip()
        notes = row.get("notes") or {}
        uid = (notes.get("uid") or "").strip()
        plan_id = (notes.get("plan_id") or "").strip()
        org_id = (notes.get("org_id") or "").strip()
        order_id = (row.get("order_id") or "").strip()
        amount_minor = int(row.get("amount", 0) or 0)
        currency = (row.get("currency") or "INR").upper()

        if not uid:
            summary["skipped"] += 1
            _json_log("warning", "payment_reconcile_missing_uid", webhook_doc=doc.id)
            continue
        if not plan_id:
            plan_id = _resolve_plan_from_amount_currency(amount_minor, currency) or ""
        if not plan_id:
            summary["skipped"] += 1
            _json_log(
                "warning",
                "payment_reconcile_unknown_plan",
                webhook_doc=doc.id,
                payment_id=payment_id,
                amount=amount_minor,
                currency=currency,
            )
            continue
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
            )
            if result.get("duplicate"):
                summary["duplicates"] += 1
            else:
                summary["applied"] += 1
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

    summary["run_at"] = datetime.utcnow().isoformat() + "Z"
    _json_log("info", "payment_reconcile_summary", **summary)
    try:
        db.collection("payment_reconcile_runs").add(summary)
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

def _apply_successful_payment(uid: str, plan_id: str, payment_id: str, order_id: str, amount_minor: int, currency: str, source: str = "client_verify", org_id: str = ""):
    plan_config = PLAN_PRICING.get(plan_id)
    if not plan_config:
        raise HTTPException(status_code=400, detail=f"Unknown plan: {plan_id}")

    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database not initialized")

    user_ref = db.collection('users').document(uid)
    user_doc = user_ref.get()
    user_data = user_doc.to_dict() if user_doc.exists else {}

    payment_ref = user_ref.collection('payments').document(payment_id)
    payment_doc = payment_ref.get()
    if payment_doc.exists:
        return {"success": True, "duplicate": True, "type": payment_doc.to_dict().get("type", "unknown")}

    current_credits = user_data.get('credits_remaining', 0)
    current_topups = user_data.get('topups_this_cycle', 0)
    now_utc = datetime.utcnow()
    cycle_start = now_utc.isoformat() + "Z"
    is_topup = plan_config.get('is_topup', False)
    credits_to_add = int(plan_config['credits'])

    if is_topup:
        base_tier = user_data.get('subscription_tier', 'free').replace('_yearly', '')
        if base_tier not in ['starter', 'creator', 'pro']:
            raise HTTPException(status_code=403, detail="UPGRADE_REQUIRED: Top-ups available for paid plans only.")
        expected_topup = f"topup_{base_tier}"
        if plan_id != expected_topup:
            raise HTTPException(status_code=403, detail="This top-up is not available for your current plan.")
        if not user_doc.exists:
            raise HTTPException(status_code=404, detail="User not found. Purchase a plan first.")

        user_ref.update({
            'credits_remaining': current_credits + credits_to_add,
            'topups_this_cycle': current_topups + 1,
            **({'org_id': org_id} if org_id else {}),
        })

        payment_ref.set({
            'payment_id': payment_id,
            'order_id': order_id,
            'amount': amount_minor,
            'currency': (currency or "INR").upper(),
            'status': 'captured',
            'plan': plan_id,
            'credits_added': credits_to_add,
            'type': 'topup',
            'timestamp': cycle_start,
            'source': source,
            **({'org_id': org_id} if org_id else {}),
        })
        return {"success": True, "credits_added": credits_to_add, "type": "topup"}

    tier = plan_id
    days_to_add = int(plan_config['days'])
    cycle_end = (now_utc + timedelta(days=days_to_add)).isoformat() + "Z"

    if user_doc.exists:
        user_ref.update({
            'credits_remaining': current_credits + credits_to_add,
            'subscription_tier': tier,
            'billing_cycle_start': cycle_start,
            'billing_cycle_end': cycle_end,
            'subscription_expiry': cycle_end,
            'topups_this_cycle': 0,
            **({'org_id': org_id} if org_id else {}),
        })
    else:
        user_ref.set({
            'uid': uid,
            'credits_remaining': credits_to_add,
            'subscription_tier': tier,
            'billing_cycle_start': cycle_start,
            'billing_cycle_end': cycle_end,
            'subscription_expiry': cycle_end,
            'topups_this_cycle': 0,
            'created_at': time.time(),
            **({'org_id': org_id} if org_id else {}),
        })

    payment_ref.set({
        'payment_id': payment_id,
        'order_id': order_id,
        'amount': amount_minor,
        'currency': (currency or "INR").upper(),
        'status': 'captured',
        'plan': tier,
        'credits_added': credits_to_add,
        'type': 'subscription',
        'timestamp': cycle_start,
        'source': source,
        **({'org_id': org_id} if org_id else {}),
    })
    return {"success": True, "credits_added": credits_to_add, "billing_cycle_end": cycle_end, "type": "subscription"}

# --- RAZORPAY SUBSCRIPTION ENDPOINTS ---

@app.post("/api/create-order")
async def create_order(req: CreateOrderRequest, request: Request, response: Response):
    client_ip = request.client.host if request.client else "unknown"
    allowed, retry_after, remaining = _check_rate(_payment_rate, client_ip, PAYMENT_RATE_LIMIT)
    _apply_rate_headers(response, PAYMENT_RATE_LIMIT, remaining, retry_after)
    if not allowed:
        raise HTTPException(status_code=429, detail="Too many payment requests. Please wait before trying again.")
    # Verify User
    decoded_token = verify_token(req.id_token)
    if not decoded_token:
        raise HTTPException(status_code=401, detail="Invalid Authentication Token")
    uid = decoded_token.get("uid", "")
    _assert_tenant_access(uid, decoded_token, req.org_id)
    pay_idem_key = _require_payment_idempotency(uid, req.idempotency_key or request.headers.get("x-idempotency-key", ""), "create_order")
    cached_payment = _payment_idem_get(pay_idem_key)
    if cached_payment and cached_payment.get("status") == "completed":
        return {**cached_payment["payload"], "idempotent_replay": True}
    _audit_action("create_order_attempt", uid, {"plan_id": req.plan_id, "currency": req.currency})

    plan = PLAN_PRICING.get(req.plan_id)
    if not plan:
        raise HTTPException(status_code=400, detail=f"Unknown plan: {req.plan_id}")

    # Top-up: validate caller's current tier before creating order
    if plan.get('is_topup'):
        db_tmp = get_db()
        if db_tmp:
            uid_tmp = decoded_token.get('uid')
            ud = db_tmp.collection('users').document(uid_tmp).get()
            user_tier_tmp = (ud.to_dict() or {}).get('subscription_tier', 'free') if ud.exists else 'free'
            # Strip _yearly suffix for comparison
            base_tier = user_tier_tmp.replace('_yearly', '')
            if base_tier not in ['starter', 'creator', 'pro']:
                raise HTTPException(status_code=403, detail="UPGRADE_REQUIRED: Top-ups available for paid plans only.")
            expected = f"topup_{base_tier}"
            if req.plan_id != expected:
                raise HTTPException(status_code=403, detail="This top-up is not available for your current plan.")
    _payment_idem_set(pay_idem_key, {"status": "in_progress", "ts": time.time()})

    currency = req.currency.upper() if req.currency else "INR"
    # Top-ups are INR only; USD only applies to subscription plans
    if plan.get('is_topup') or currency != "USD":
        amount = plan['inr_paise']
        currency = "INR"
    else:
        amount = plan.get('usd_cents', plan['inr_paise'])

    if not RAZORPAY_AVAILABLE or rzp_client is None:
        _payment_idem_set(pay_idem_key, {"status": "failed", "ts": time.time(), "error": "razorpay unavailable"})
        return {"success": False, "error": "Payment service unavailable. Please install razorpay package."}

    try:
        order_data = {
            "amount": amount,
            "currency": currency,
            "receipt": f"rcpt_{uid[:8]}_{int(time.time())}",
            "notes": {
                "uid": uid,
                "plan_id": req.plan_id,
                "org_id": req.org_id or _tenant_id_from_token(decoded_token),
                "source": "create_order"
            }
        }
        order = rzp_client.order.create(data=order_data)
        payload = {"success": True, "order": order, "plan_id": req.plan_id, "key_id": RAZORPAY_KEY_ID}
        _payment_idem_set(pay_idem_key, {"status": "completed", "ts": time.time(), "payload": payload})
        return payload
    except Exception as e:
        _payment_idem_set(pay_idem_key, {"status": "failed", "ts": time.time(), "error": str(e)})
        print(f"Razorpay Order Error: {e}")
        return {"success": False, "error": str(e)}

@app.post("/api/verify-payment")
async def verify_payment(req: VerifyPaymentRequest, request: Request, response: Response):
    client_ip = request.client.host if request.client else "unknown"
    allowed, retry_after, remaining = _check_rate(_payment_rate, client_ip, PAYMENT_RATE_LIMIT)
    _apply_rate_headers(response, PAYMENT_RATE_LIMIT, remaining, retry_after)
    if not allowed:
        raise HTTPException(status_code=429, detail="Too many payment requests. Please wait before trying again.")
    if not RAZORPAY_AVAILABLE or rzp_client is None:
        raise HTTPException(status_code=503, detail="Payment service unavailable")

    # Verify User
    decoded_token = verify_token(req.id_token)
    if not decoded_token:
        raise HTTPException(status_code=401, detail="Invalid Authentication Token")
    uid = decoded_token.get('uid')
    _assert_tenant_access(uid, decoded_token, req.org_id)
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
    _payment_idem_set(pay_idem_key, {"status": "in_progress", "ts": time.time()})

    # Resolve plan from echoed plan_id (most reliable) then fall back to amount matching
    plan_config = PLAN_PRICING.get(req.plan_id) if req.plan_id else None
    currency_paid = "INR"
    amount_paid_minor = plan_config.get("inr_paise", 0) if plan_config else 0

    try:
        payment_live = rzp_client.payment.fetch(req.razorpay_payment_id)
        currency_paid = payment_live.get('currency', currency_paid)
        amount_paid_minor = payment_live.get('amount', amount_paid_minor)
    except Exception as e:
        raise HTTPException(status_code=502, detail="Unable to verify payment with Razorpay") from e

    if not plan_config:
        req.plan_id = _resolve_plan_from_amount_currency(int(amount_paid_minor or 0), currency_paid) or ""
        plan_config = PLAN_PRICING.get(req.plan_id)
    if not plan_config:
        raise HTTPException(status_code=400, detail="Unable to resolve purchased plan")

    payload = _apply_successful_payment(
        uid=uid,
        plan_id=req.plan_id,
        payment_id=req.razorpay_payment_id,
        order_id=req.razorpay_order_id,
        amount_minor=int(amount_paid_minor or 0),
        currency=currency_paid,
        source="client_verify",
        org_id=req.org_id or _tenant_id_from_token(decoded_token),
    )
    _payment_idem_set(pay_idem_key, {"status": "completed", "ts": time.time(), "payload": payload})
    return payload

@app.post("/api/razorpay-webhook")
async def razorpay_webhook(request: Request):
    if not RAZORPAY_WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="Webhook secret not configured")

    signature = request.headers.get("x-razorpay-signature", "")
    body_bytes = await request.body()
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
    payment_id = payment_entity.get("id", "")
    order_id = payment_entity.get("order_id", "")
    amount_minor = int(payment_entity.get("amount", 0) or 0)
    currency = (payment_entity.get("currency", "INR") or "INR").upper()
    status = payment_entity.get("status", "")
    notes = payment_entity.get("notes") or {}

    db = get_db()
    if db:
        try:
            db.collection("payment_webhooks").document(payment_id or str(uuid.uuid4())).set({
                "event": event,
                "payment_id": payment_id,
                "order_id": order_id,
                "currency": currency,
                "amount": amount_minor,
                "status": status,
                "notes": notes,
                "received_at": datetime.utcnow().isoformat() + "Z",
            }, merge=True)
        except Exception as e:
            print(f"[Webhook] Failed to persist webhook event: {e}")

    # Acknowledge non-captured events.
    if event != "payment.captured" or status != "captured":
        return {"success": True, "ignored": True, "event": event}

    uid = notes.get("uid", "")
    plan_id = notes.get("plan_id", "")
    org_id = notes.get("org_id", "")
    if not uid:
        return {"success": True, "ignored": True, "reason": "missing_uid_note"}

    if not plan_id:
        plan_id = _resolve_plan_from_amount_currency(amount_minor, currency) or ""
    if not plan_id:
        return {"success": True, "ignored": True, "reason": "unknown_plan"}

    result = _apply_successful_payment(
        uid=uid,
        plan_id=plan_id,
        payment_id=payment_id or f"webhook_{uuid.uuid4().hex[:12]}",
        order_id=order_id or "",
        amount_minor=amount_minor,
        currency=currency,
        source="webhook",
        org_id=org_id,
    )
    return {"success": True, "applied": True, "result": result}

@app.post("/api/reconcile-payments")
async def reconcile_payments(req: ReconcilePaymentsRequest, request: Request):
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
async def admin_recovery_summary(req: AdminRecoveryRequest):
    if not _is_admin_token(req.id_token):
        raise HTTPException(status_code=403, detail="Admin access required")
    db = get_db()
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")
    lim = max(1, min(int(req.limit or 50), 200))
    dead_letter_rows = []
    reconcile_runs = []
    try:
        for doc in db.collection("export_dead_letter").order_by("timestamp", direction=firestore.Query.DESCENDING).limit(lim).stream():
            dead_letter_rows.append(doc.to_dict())
    except Exception:
        pass
    try:
        for doc in db.collection("payment_reconcile_runs").order_by("run_at", direction=firestore.Query.DESCENDING).limit(lim).stream():
            reconcile_runs.append(doc.to_dict())
    except Exception:
        pass
    return {
        "success": True,
        "dead_letter_recent": dead_letter_rows,
        "payment_reconcile_recent": reconcile_runs,
        "slo": _build_slo_snapshot(),
    }

@app.post("/api/admin/tenant-backfill")
async def admin_tenant_backfill(req: TenantBackfillRequest):
    if not _is_admin_token(req.id_token):
        raise HTTPException(status_code=403, detail="Admin access required")
    db = get_db()
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")
    lim = max(1, min(int(req.limit or 500), 5000))
    scanned = 0
    updated = 0
    for doc in db.collection("users").limit(lim).stream():
        scanned += 1
        data = doc.to_dict() or {}
        uid = data.get("uid") or doc.id
        org_id = (data.get("org_id") or "").strip()
        if not org_id:
            org_id = f"org_{uid}"
            try:
                doc.reference.set({"org_id": org_id, "updated_at": datetime.utcnow().isoformat() + "Z"}, merge=True)
                updated += 1
            except Exception as e:
                _json_log("warning", "tenant_backfill_user_failed", uid=uid, error=str(e))
                continue
        try:
            db.collection("tenants").document(org_id).set({"updated_at": datetime.utcnow().isoformat() + "Z"}, merge=True)
            db.collection("tenants").document(org_id).collection("members").document(uid).set(
                {"uid": uid, "org_id": org_id, "updated_at": datetime.utcnow().isoformat() + "Z"},
                merge=True,
            )
        except Exception as e:
            _json_log("warning", "tenant_backfill_member_failed", uid=uid, org_id=org_id, error=str(e))
    return {"success": True, "scanned": scanned, "updated_users": updated}


class RedeemPromoRequest(BaseModel):
    id_token: str
    code: str

@app.post("/api/redeem-promo")
async def redeem_promo(req: RedeemPromoRequest, request: Request, response: Response):
    client_ip = request.client.host if request.client else "unknown"
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

        user_doc = user_ref.get(transaction=txn)
        user_email = user_doc.to_dict().get("email", "") if user_doc.exists else ""
        now = datetime.utcnow()
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
async def translate_captions(req: TranslateRequest, request: Request, response: Response):
    client_ip = request.client.host if request.client else "unknown"
    allowed, retry_after, remaining = _check_rate(_translate_rate, client_ip, TRANSLATE_RATE_LIMIT)
    _apply_rate_headers(response, TRANSLATE_RATE_LIMIT, remaining, retry_after)
    if not allowed:
        raise HTTPException(status_code=429, detail="Too many translation requests. Please wait before trying again.")
    decoded_token = verify_token(req.id_token)
    if not decoded_token:
        raise HTTPException(status_code=401, detail="Authentication required")
    _assert_tenant_access(decoded_token.get("uid", ""), decoded_token, req.org_id)
    if _is_content_safety_blocked(req.target_language, " ".join((c.get("text") or "") for c in req.captions[:30])):
        _track_event("translate_rejected_content_safety")
        return {"success": False, "error": "Request blocked by content safety policy."}
    breaker = _provider_breakers["openai_translate"]
    if not breaker.allow():
        _track_event("translate_circuit_open")
        return {"success": False, "error": "Translation service is temporarily unavailable. Please retry shortly."}

    try:
        from openai import OpenAI
        client = OpenAI(
            api_key=os.environ.get("OPENAI_API_KEY"),
        )

        texts = [cap.get("text", "") for cap in req.captions]
        numbered_text = "\n".join(f"{i+1}. {t}" for i, t in enumerate(texts))

        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": f"You are a professional translator. Translate the following numbered caption lines to {req.target_language}. Keep the numbering. Only return the translated lines, nothing else. Preserve the exact number of lines."},
                {"role": "user", "content": numbered_text}
            ],
            temperature=0.3,
        )

        import re
        translated_text = response.choices[0].message.content.strip()
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
        print(f"Translation error: {e}")
        return {"success": False, "error": str(e)}

class DetectLanguageRequest(BaseModel):
    file_id: str
    id_token: str = ""  # Firebase Auth Token (optional — bypassed in dev mode)
    org_id: str = ""

@app.post("/api/detect-language")
async def detect_language(req: DetectLanguageRequest):
    # Auth — same dev-mode bypass as /api/export
    _authenticate_media_request(req.id_token, req.org_id)
    if not _validate_file_id(req.file_id):
        raise HTTPException(status_code=400, detail="Invalid file_id")
    input_path = _safe_find_upload(req.file_id)
    if not input_path:
        _track_event("detect_language_failed_not_found")
        return {"success": False, "error": "File not found"}
    breaker = _provider_breakers["openai_detect_language"]
    if not breaker.allow():
        _track_event("detect_language_circuit_open")
        return {"success": False, "error": "Language detection is temporarily unavailable. Please retry shortly."}
    temp_path = ""
    try:
        import tempfile
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as _tf:
            temp_path = _tf.name
        subprocess.run([
            "ffmpeg", "-i", input_path, "-t", "30",
            "-vn", "-acodec", "mp3", "-y", temp_path
        ], capture_output=True)
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
        return {"success": False, "error": str(e)}
    finally:
        try:
            if temp_path and os.path.exists(temp_path):
                os.remove(temp_path)
        except Exception:
            pass

class DeleteFileRequest(BaseModel):
    file_id: str
    id_token: str
    org_id: str = ""


class AccountDataRequest(BaseModel):
    id_token: str
    org_id: str = ""


@app.post("/api/account-export")
async def account_export(req: AccountDataRequest):
    decoded_token = verify_token(req.id_token)
    if not decoded_token:
        raise HTTPException(status_code=401, detail="Auth required")
    uid = decoded_token.get("uid")
    _assert_tenant_access(uid, decoded_token, req.org_id)
    db = get_db()
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")
    user_doc = db.collection("users").document(uid).get()
    payments = db.collection("users").document(uid).collection("payments").stream()
    payment_items = [p.to_dict() for p in payments]
    payload = {
        "uid": uid,
        "user": user_doc.to_dict() if user_doc.exists else {},
        "payments": payment_items,
        "exported_at": datetime.utcnow().isoformat() + "Z",
    }
    _audit_action("account_export", uid, {"payment_count": len(payment_items)})
    return {"success": True, "data": payload}


@app.post("/api/account-delete")
async def account_delete(req: AccountDataRequest):
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
    if user_doc.exists:
        history = user_doc.to_dict().get("history", []) or []
        for h in history:
            fp = h.get("firebase_path")
            if fp:
                delete_from_firebase_storage(fp)
        try:
            payment_docs = list(user_ref.collection("payments").stream())
        except Exception:
            payment_docs = []
        for payment_doc in payment_docs:
            try:
                payment_doc.reference.delete()
            except Exception as e:
                _json_log("warning", "account_delete_payment_delete_failed", uid=uid, payment_id=payment_doc.id, error=str(e))
    try:
        firebase_auth.delete_user(uid)
    except Exception as e:
        _json_log("warning", "account_delete_auth_delete_failed", uid=uid, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to delete authentication record") from e
    if user_doc.exists:
        user_ref.delete()
    _audit_action("account_delete", uid)
    return {"success": True}

@app.post("/api/delete-file")
async def delete_user_file(req: DeleteFileRequest):
    decoded_token = verify_token(req.id_token)
    if not decoded_token:
        raise HTTPException(status_code=401, detail="Auth required")
    uid = decoded_token.get('uid')
    _assert_tenant_access(uid, decoded_token, req.org_id)
    _audit_action("delete_file_attempt", uid, {"file_id": req.file_id})

    if not _validate_file_id(req.file_id):
        raise HTTPException(status_code=400, detail="Invalid file_id")

    # Delete local file using exact filename — never substring match
    if os.path.exists(EXPORT_DIR):
        exact_name = f"export_{req.file_id}.mp4"
        candidate = os.path.realpath(os.path.join(EXPORT_DIR, exact_name))
        real_export_dir = os.path.realpath(EXPORT_DIR)
        if candidate.startswith(real_export_dir + os.sep) and os.path.isfile(candidate):
            try:
                os.remove(candidate)
            except Exception:
                pass

    # Remove from Firestore history + delete from Firebase Storage
    db = get_db()
    if db:
        user_ref = db.collection('users').document(uid)
        user_doc = user_ref.get()
        if user_doc.exists:
            history = user_doc.to_dict().get('history', [])
            # Find and delete Firebase Storage file if exists
            for h in history:
                if h.get('id') == req.file_id and h.get('firebase_path'):
                    delete_from_firebase_storage(h['firebase_path'])
            user_ref.update({
                'history': [h for h in history if h.get('id') != req.file_id]
            })
    _audit_action("delete_file_success", uid, {"file_id": req.file_id})
    return {"success": True}

app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")
app.mount("/exports", StaticFiles(directory=EXPORT_DIR), name="exports")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
