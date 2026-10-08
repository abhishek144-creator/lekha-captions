import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Configuration first: it loads .env files and enforces production safety checks.
try:
    from . import settings
except ImportError:  # Direct execution from backend/ remains supported.
    import settings
try:
    from . import app_state
except ImportError:  # Direct execution from backend/ remains supported.
    import app_state

from dotenv import load_dotenv

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
    from . import firebase_admin_setup
except ImportError:  # Direct execution from backend/ remains supported.
    import firebase_admin_setup
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
    from . import observability
    from . import request_security
    from . import operator_controls
    from .request_guards import create_request_guards
    from . import media_records
    from . import entitlements
    from . import export_jobs
    from .maintenance_jobs import create_maintenance_jobs
    from . import api_models
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
    from . import media_commands
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
    import observability
    import request_security
    import operator_controls
    from request_guards import create_request_guards
    import media_records
    import entitlements
    import export_jobs
    from maintenance_jobs import create_maintenance_jobs
    import api_models
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
    import media_commands
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
    clients=lambda: (app_state._redis_client, app_state._rq_redis_client),
)


logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"))


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    rid = observability._request_id(request)
    request.state.request_id = rid
    if request_security._app_check_required(request) and request.headers.get("x-firebase-appcheck"):
        # Firebase may synchronously fetch rotated signing keys. Keep its
        # bounded verification work outside the API event loop; health probes
        # and missing-token rejections never wait for this worker pool.
        app_check_failure = await anyio.to_thread.run_sync(
            request_security._verify_firebase_app_check_request, request, rid,
            limiter=app_state._app_check_verification_limiter,
        )
    else:
        app_check_failure = request_security._verify_firebase_app_check_request(request, rid)
    if app_check_failure is not None:
        return request_security._apply_security_headers(app_check_failure)
    if request.url.path == "/api/upload" and settings._IS_PRODUCTION:
        # Reject before FastAPI parses multipart, so a misconfigured production
        # client cannot stream even a small video through an API instance.
        return request_security._apply_security_headers(JSONResponse(
            status_code=409,
            content={"detail": "Production uploads must use the direct resumable storage flow."},
            headers={"X-Request-Id": rid, "X-Lekha-Upload-Transport": "direct-resumable"},
        ))
    if request.url.path == "/api/upload":
        # FastAPI parses multipart before entering the endpoint. Authenticate
        # here so an unauthenticated request never spools customer-sized media.
        try:
            upload_identity = await asyncio.to_thread(request_security._authenticate_media_request, export_jobs._extract_bearer_token(request))
        except HTTPException as error:
            return request_security._apply_security_headers(JSONResponse(status_code=error.status_code,
                content={"detail": error.detail}, headers={"X-Request-Id": rid}))
    content_type = (request.headers.get("content-type") or "").lower()
    declared_length = request.headers.get("content-length")
    if "application/json" in content_type and declared_length:
        try:
            if int(declared_length) > settings.MAX_JSON_BODY_BYTES:
                return request_security._apply_security_headers(JSONResponse(
                    status_code=413,
                    content={"success": False, "error": "Request body is too large"},
                    headers={"X-Request-Id": rid},
                ))
        except ValueError:
            return request_security._apply_security_headers(JSONResponse(
                status_code=400,
                content={"success": False, "error": "Invalid Content-Length header"},
                headers={"X-Request-Id": rid},
            ))
    if "application/json" in content_type:
        body = bytearray()
        async for chunk in request.stream():
            body.extend(chunk)
            if len(body) > settings.MAX_JSON_BODY_BYTES:
                return request_security._apply_security_headers(JSONResponse(
                    status_code=413,
                    content={"success": False, "error": "Request body is too large"},
                    headers={"X-Request-Id": rid},
                ))
        # Starlette's downstream receive wrapper replays this cached body. This
        # enforces the limit even for chunked requests with no Content-Length.
        request._body = bytes(body)
    requested_version = (request.headers.get("x-api-version") or "").strip()
    if requested_version and requested_version < settings.API_MIN_SUPPORTED_VERSION:
        return request_security._apply_security_headers(JSONResponse(
            status_code=426,
            content={
                "success": False,
                "error": "API version is no longer supported",
                "min_supported_version": settings.API_MIN_SUPPORTED_VERSION,
                "current_version": settings.API_CURRENT_VERSION,
                "sunset_date": settings.DEPRECATION_SUNSET_DATE,
            },
            headers={
                "X-Request-Id": rid,
                "X-API-Version": settings.API_CURRENT_VERSION,
                "X-API-Min-Version": settings.API_MIN_SUPPORTED_VERSION,
                "Sunset": settings.DEPRECATION_SUNSET_DATE,
            },
        ))
    upload_slot_uid = str(upload_identity.get("uid") or "") if request.url.path == "/api/upload" else ""
    if upload_slot_uid and not await asyncio.to_thread(_acquire_process_slot, upload_slot_uid, f"upload:{rid}"):
        return request_security._apply_security_headers(JSONResponse(status_code=429, content={"detail": "Another upload or transcription is active for this account."}, headers={"X-Request-Id": rid}))
    start = time.time()
    try:
        response = await call_next(request)
    except Exception as e:
        elapsed_ms = int((time.time() - start) * 1000)
        observability._json_log(
            "error",
            "http_request",
            request_id=rid,
            method=request.method,
            path=request.url.path,
            status_code=500,
            duration_ms=elapsed_ms,
            replica_region=settings.RAILWAY_REPLICA_REGION,
            replica_id=settings.RAILWAY_REPLICA_ID,
            error=str(e),
        )
        return request_security._apply_security_headers(JSONResponse(status_code=500, content={
            "success": False, "error": {"code": "INTERNAL_ERROR",
            "message": "Something went wrong. Please contact support with this request ID.", "request_id": rid},
        }, headers={"X-Request-Id": rid, "Cache-Control": "no-store"}))
    finally:
        if upload_slot_uid:
            await asyncio.to_thread(_release_process_slot, upload_slot_uid, f"upload:{rid}")
        if not settings.RUN_API_BACKGROUND_TASKS:
            # Cloud Run may suspend CPU as soon as the request finishes. Flush
            # buffered events while this request still has execution time.
            with app_state._telemetry_lock:
                telemetry_pending = bool(app_state._telemetry_buffer)
            if telemetry_pending:
                try:
                    await asyncio.to_thread(observability._flush_telemetry)
                except Exception as error:
                    observability._json_log("warning", "request_telemetry_flush_failed", error=type(error).__name__)
    elapsed_ms = int((time.time() - start) * 1000)
    response.headers["X-Request-Id"] = rid
    observability._json_log(
        "info",
        "http_request",
        request_id=rid,
        method=request.method,
        path=request.url.path,
        status_code=response.status_code,
        duration_ms=elapsed_ms,
        replica_region=settings.RAILWAY_REPLICA_REGION,
        replica_id=settings.RAILWAY_REPLICA_ID,
    )
    try:
        await asyncio.to_thread(observability._track_latency_sample, request.url.path, elapsed_ms)
    except Exception:
        pass
    response.headers["X-API-Version"] = settings.API_CURRENT_VERSION
    response.headers["X-API-Min-Version"] = settings.API_MIN_SUPPORTED_VERSION
    response.headers["Sunset"] = settings.DEPRECATION_SUNSET_DATE
    return request_security._apply_security_headers(response)


if settings.SENTRY_DSN and SENTRY_AVAILABLE and not settings._IS_TEST:
    try:
        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            environment=settings.APP_ENV,
            release=os.environ.get("APP_RELEASE") or None,
            traces_sample_rate=float(os.environ.get("SENTRY_TRACES_SAMPLE_RATE", "0.05")),
            send_default_pii=False,
        )
        observability._json_log("info", "sentry_initialized", environment=settings.APP_ENV)
    except Exception as e:
        observability._json_log("warning", "sentry_init_failed", error=str(e))
elif settings.SENTRY_DSN and not SENTRY_AVAILABLE:
    if settings._IS_PRODUCTION:
        raise RuntimeError("SENTRY_DSN is configured but the Sentry SDK is unavailable in production.")
    observability._json_log("warning", "sentry_dsn_set_but_sdk_missing")

observability._json_log(
    "warning" if not settings._IS_PRODUCTION else "info",
    "runtime_mode",
    env=settings.APP_ENV,
    is_production=settings._IS_PRODUCTION,
)

if RAZORPAY_AVAILABLE and settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET:
    app_state.rzp_client = _razorpay_module.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
elif RAZORPAY_AVAILABLE:
    observability._json_log("warning", "razorpay_credentials_missing")


# Global APScheduler reference (None if apscheduler not installed)
app_state.scheduler = AsyncIOScheduler() if SCHEDULER_AVAILABLE else None


if REDIS_AVAILABLE and settings.REDIS_URL and not settings._IS_TEST:
    try:
        app_state._redis_client = connect_redis(settings.REDIS_URL, decode_responses=True, socket_timeout=5)
        app_state._redis_client.ping()
        # RQ stores pickled/binary job payloads. Sharing the application's
        # decode_responses=True client makes failed-job inspection attempt UTF-8
        # decoding and can strand per-user export leases.
        # The API never blocks on a queue pop, so a bounded read timeout is safe
        # and turns a stalled Redis into a fast error instead of a hung request.
        app_state._rq_redis_client = connect_redis(settings.REDIS_URL, socket_timeout=15)
        app_state._rq_redis_client.ping()
        observability._json_log("info", "redis_connected")
    except Exception as e:
        app_state._redis_client = None
        app_state._rq_redis_client = None
        observability._json_log("warning", "redis_connection_failed", error=str(e))

if settings._IS_PRODUCTION and app_state._redis_client is None:
    raise RuntimeError(
        "Redis is required in production (ENV=production) for cross-instance rate "
        "limiting and payment idempotency. Set REDIS_URL to a reachable Redis instance."
    )


if settings.DURABLE_QUEUE_ENABLED and app_state._rq_redis_client is not None and RQ_AVAILABLE:
    try:
        configured_render_queues = list(RENDER_QUEUE_NAMES)
        if settings.GPU_RENDER_ENABLED:
            configured_render_queues.append(GPU_EXPORT_QUEUE_NAME)
        app_state._export_queues = {
            queue_name: Queue(queue_name, connection=app_state._rq_redis_client, default_timeout=30 * 60)
            for queue_name in configured_render_queues
        }
        app_state._export_queue = app_state._export_queues[settings.EXPORT_QUEUE_NAME]
        observability._json_log("info", "durable_queue_enabled", queues=list(app_state._export_queues))
    except Exception as e:
        app_state._export_queue = None
        app_state._export_queues = {}
        observability._json_log("warning", "durable_queue_init_failed", error=str(e))

if settings._IS_PRODUCTION and app_state._export_queue is None:
    raise RuntimeError("The durable export queue is required in production; refusing API-local rendering.")

app_state._transcription_queue = app_state._export_queue
if app_state._export_queue is not None and settings.TRANSCRIPTION_QUEUE_NAME != settings.EXPORT_QUEUE_NAME:
    app_state._transcription_queue = Queue(settings.TRANSCRIPTION_QUEUE_NAME, connection=app_state._rq_redis_client, default_timeout=30 * 60)
app_state._media_scan_queue = app_state._transcription_queue
if app_state._export_queue is not None and settings.MEDIA_SCAN_QUEUE_NAME not in {settings.EXPORT_QUEUE_NAME, settings.TRANSCRIPTION_QUEUE_NAME}:
    app_state._media_scan_queue = Queue(settings.MEDIA_SCAN_QUEUE_NAME, connection=app_state._rq_redis_client, default_timeout=20 * 60)


async def startup_event():
    if not settings.RUN_API_BACKGROUND_TASKS:
        observability._json_log("info", "api_background_tasks_disabled")
        if os.environ.get("RAILWAY_PROJECT_ID"):
            disconnect_idle_redis_clients(app_state._redis_client, app_state._rq_redis_client)
        return
    app_state._telemetry_flush_task = asyncio.create_task(observability._telemetry_flush_loop())
    if settings._IS_PRODUCTION:
        app_state._transcription_dispatch_task = asyncio.create_task(_transcription_dispatch_loop())
    if settings.QUEUE_METRICS_ENABLED:
        app_state._queue_metrics_task = asyncio.create_task(_queue_metrics_loop())
    if os.environ.get("RELEASE_ENVIRONMENT") == "staging":
        # Current staging shares Firestore: it must not reconcile live payments
        # or run global customer-media cleanup with staging credentials.
        return
    if app_state.scheduler is not None:
        app_state.scheduler.add_job(scheduled_janitor_job, 'interval', minutes=15)
        app_state.scheduler.add_job(scheduled_payment_reconciliation_job, 'interval', minutes=max(settings.PAYMENT_RECONCILE_INTERVAL_MINUTES, 5))
        app_state.scheduler.start()
        observability._json_log("info", "scheduler_started", janitor_minutes=15,
                  payment_reconcile_minutes=max(settings.PAYMENT_RECONCILE_INTERVAL_MINUTES, 5))
    else:
        observability._json_log("warning", "janitor_fallback_loop", reason="apscheduler not installed")
        app_state._simple_janitor_task = asyncio.create_task(_simple_janitor_loop())


async def shutdown_event():
    if app_state._queue_metrics_task is not None:
        app_state._queue_metrics_task.cancel()
        app_state._queue_metrics_task = None
    if app_state._transcription_dispatch_task is not None:
        app_state._transcription_dispatch_task.cancel()
        app_state._transcription_dispatch_task = None
    if app_state._telemetry_flush_task is not None:
        app_state._telemetry_flush_task.cancel()
        app_state._telemetry_flush_task = None
    if app_state._simple_janitor_task is not None:
        app_state._simple_janitor_task.cancel()
        app_state._simple_janitor_task = None
    if app_state.scheduler is not None and app_state.scheduler.running:
        app_state.scheduler.shutdown(wait=False)
    await asyncio.to_thread(observability._flush_telemetry)

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

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
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

app.add_middleware(UploadBodyLimitMiddleware)


app_state._provider_breakers: Dict[str, observability.CircuitBreaker] = {
    "openai_translate": observability.CircuitBreaker(failure_threshold=4, cooldown_seconds=120),
    "openai_detect_language": observability.CircuitBreaker(failure_threshold=4, cooldown_seconds=120),
}


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


for d in [settings.UPLOAD_DIR, settings.EXPORT_DIR, settings.FONTS_DIR, settings.CACHE_DIR, settings.TRANSCRIPTION_CACHE_DIR, settings.RENDER_CACHE_DIR, settings.DEAD_LETTER_DIR]:
    os.makedirs(d, exist_ok=True)

# This initializes the processor which will download the font automatically
app_state.processor = VideoProcessor(settings.FONTS_DIR)


app.include_router(create_project_router(
    request_security._authenticate_media_request,
    firebase_admin_setup.get_db,
    media_records._validate_file_id,
    media_records._assert_upload_owner,
))


def recover_interrupted_export_retry(export_job_id: str):
    """Called only after RQ confirms a failed or abandoned execution will retry."""
    record = export_jobs._load_export_job(export_job_id) or {}
    status = record.get("status")
    if status not in {"starting", "processing", "finalizing"}:
        return
    if status == "finalizing" and export_jobs._load_recorded_export_result(
        record.get("uid", ""), export_job_id, record.get("file_id", "")
    ):
        # The retry recovers this paid result without rendering or charging again.
        return
    try:
        export_jobs._set_export_job(export_job_id, "retrying", expected_status=status,
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
    existing_job = export_jobs._load_export_job(export_job_id) or {}
    if existing_job.get("status") == "completed":
        return existing_job.get("payload") or {}
    try:
        if existing_job.get("status") == "finalizing":
            request_security._assert_account_not_deleting(uid)
            recorded = export_jobs._load_recorded_export_result(uid, export_job_id, str(req_payload.get("file_id") or ""))
            if recorded:
                export_jobs._set_export_job(export_job_id, "completed", payload=recorded,
                                completed_at=time.time(), recovered_from_usage=True)
                if idempotency_key:
                    _idem_set(idempotency_key, {"status": "completed", "ts": time.time(), "payload": recorded,
                                               "request_hash": idempotency_request_hash, "job_id": export_job_id})
                return recorded
        export_jobs._set_export_job(export_job_id, "starting", worker_release=settings.APP_RELEASE)
    except InvalidJobTransition:
        current = export_jobs._load_export_job(export_job_id) or {}
        return {"success": False, "status": current.get("status"), "export_job_id": export_job_id}
    try:
        if (existing_job.get("status") or "").lower() == "cancelled":
            observability._json_log("info", "cancelled_export_skipped", job_id=export_job_id, uid=uid)
            return {
                "success": False,
                "status": "cancelled",
                "export_job_id": export_job_id,
            }
        slot_acquired = _acquire_export_slot(uid, export_job_id)
        if not slot_acquired:
            wait_retry = export_jobs._export_slot_wait_retry()
            if wait_retry is not None:
                # Batch items for one account share its single export slot. Waiting
                # for a sibling render is not a failure: reschedule without using
                # the job's failure retries (a 10-item batch outlived them) and
                # without dead-lettering every poll.
                export_jobs._set_export_job(export_job_id, "retrying", error=None)
                observability._json_log("info", "export_waiting_for_account_slot", job_id=export_job_id)
                return wait_retry
            raise RuntimeError("Another export currently owns this account's export slot")
        req = api_models.ExportRequest(**req_payload)
        payload = asyncio.run(export_jobs._process_export_job_core(req, uid, rid, export_job_id))
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
            recorded = export_jobs._load_recorded_export_result(uid, export_job_id, str(req_payload.get("file_id") or ""))
        except Exception as recovery_error:
            recorded = None
            usage_recovery_unknown = True
            observability._json_log("warning", "export_usage_recovery_unavailable", job_id=export_job_id,
                      error=type(recovery_error).__name__)
        if recorded:
            try:
                current = export_jobs._load_export_job(export_job_id) or {}
                if current.get("status") == "finalizing":
                    export_jobs._set_export_job(export_job_id, "completed", payload=recorded,
                                    completed_at=time.time(), recovered_from_usage=True)
                if idempotency_key:
                    _idem_set(idempotency_key, {"status": "completed", "ts": time.time(), "payload": recorded,
                                               "request_hash": idempotency_request_hash, "job_id": export_job_id})
            except Exception as recovery_error:
                observability._json_log("warning", "export_completion_recovery_pending", job_id=export_job_id,
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
            export_jobs._set_export_job(export_job_id, "retrying" if retry_pending else "failed",
                            failed_at=time.time(), error="Export failed. Please retry or contact support.")
        except Exception as state_error:
            observability._json_log(
                "error",
                "export_failure_state_persist_failed",
                job_id=export_job_id,
                error=str(state_error),
            )
        failed_job = export_jobs._load_export_job(export_job_id) or {}
        entered_at = float(failed_job.get("queue_entered_at") or time.time())
        observability._json_log(
            "warning", "export_observation", job_id=export_job_id,
            status="retrying" if locals().get("retry_pending", False) else "failed",
            queue_wait_ms=failed_job.get("queue_wait_ms"),
            elapsed_ms=max(0, int((time.time() - entered_at) * 1000)),
        )
        if idempotency_key and not locals().get("retry_pending", False) and not usage_recovery_unknown:
            _idem_delete(idempotency_key)
        export_jobs._write_dead_letter(
            export_job_id,
            str(e),
            {"req_payload": export_jobs._sanitize_export_request_payload(req_payload), "uid": uid},
        )
        raise
    finally:
        if slot_acquired:
            _release_export_slot(uid, export_job_id)


@app.get("/api/fonts")
def get_google_fonts():
    if app_state._cached_google_fonts is not None:
        return {"fonts": app_state._cached_google_fonts}

    try:
        req = urllib.request.Request(
            'https://fonts.google.com/metadata/fonts',
            headers={'User-Agent': 'Mozilla/5.0'}
        )
        with observability._urlopen_https_only(req, timeout=10) as res:
            raw_data = res.read().decode('utf-8')
            # The API often prefixes with )]}' for security
            if raw_data.startswith(")]}'"):
                raw_data = raw_data.split('\n', 1)[1]
            data = json.loads(raw_data)

            fonts = []
            for family in data.get('familyMetadataList', []):
                fonts.append({"family": family.get("family")})

            app_state._cached_google_fonts = fonts
            return {"fonts": fonts}
    except Exception as e:
        observability._json_log("warning", "google_fonts_fetch_failed", error=str(e))
        return {"fonts": []}


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
    authenticate=request_security._authenticate_media_request,
    extract_token=export_jobs._extract_bearer_token,
    assert_service_available=operator_controls._assert_service_available,
    allowed_extensions=settings.ALLOWED_EXTENSIONS,
    allowed_content_prefixes=settings.ALLOWED_CONTENT_PREFIXES,
    allowed_origins=settings.ALLOWED_ORIGINS,
    max_upload_bytes=settings.MAX_UPLOAD_BYTES,
    create_session=firebase_admin_setup.create_resumable_source_upload,
    finalize_session=firebase_admin_setup.finalize_resumable_source_upload,
    remember_owner=media_records._remember_upload_owner,
    signed_upload_url=media_records._signed_upload_url,
    audit_action=observability._audit_action,
    reserve_slot=_reserve_direct_upload_slot,
    release_slot=_release_direct_upload_slot,
    cancel_session=firebase_admin_setup.cancel_resumable_source_upload,
    resume_session=firebase_admin_setup.resume_resumable_source_upload,
    assert_account_active=request_security._assert_account_not_deleting,
    rate_limit_network=_limit_direct_upload_network,
    enqueue_scan=_schedule_media_scan,
    sign_parts=firebase_admin_setup.sign_resumable_upload_parts,
))
app.include_router(create_editor_preferences_router(
    request_security._authenticate_media_request,
    firebase_admin_setup.get_db,
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
    dispatch_transcription=lambda: TranscriptionJobs(firebase_admin_setup.get_db()).dispatch(app_state._transcription_queue),
    dispatch_media_scans=_dispatch_media_scans_once,
    run_janitor=scheduled_janitor_job,
    publish_queue_metrics=_publish_queue_metrics_once,
    reconcile_payments=scheduled_payment_reconciliation_job,
))


def run_media_scan_job_task(uid: str, file_id: str):
    """Materialize and scan one upload; duplicate deliveries are harmless."""
    request_security._assert_account_not_deleting(uid)
    media_records._assert_upload_owner(file_id, uid)
    metadata = media_records._load_upload_metadata(file_id)
    if str(metadata.get("upload_state") or "").lower() in {"clean", "rejected"}:
        MediaScanJobs(firebase_admin_setup.get_db()).finish(file_id)
        return {"status": str(metadata.get("upload_state"))}
    input_path = media_records._safe_find_upload(file_id)
    if not input_path:
        raise RuntimeError("Uploaded media could not be materialized for scanning")
    try:
        result = media_records._ensure_upload_clean(file_id, uid, input_path)
        MediaScanJobs(firebase_admin_setup.get_db()).finish(file_id)
        return {"status": str(result.get("upload_state") or "clean")}
    except HTTPException:
        # A malware rejection is terminal and already persisted by
        # _ensure_upload_clean. Scanner/runtime failures stay in the outbox.
        current = media_records._load_upload_metadata(file_id)
        if str(current.get("upload_state") or "").lower() == "rejected":
            MediaScanJobs(firebase_admin_setup.get_db()).finish(file_id)
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


app.include_router(create_cost_reconciliation_router(request_security._is_admin_token, firebase_admin_setup.get_db))
app.include_router(create_notification_router(request_security._authenticate_bearer_request, firebase_admin_setup.get_db))
app.include_router(create_public_api_router(
    authenticate_request=request_security._authenticate_bearer_request,
    get_database=firebase_admin_setup.get_db,
    list_account_projects=list_projects,
    read_account_project=read_draft,
    load_export_job=export_jobs._load_export_job,
))
app.include_router(create_workspace_router(
    authenticate_request=request_security._authenticate_bearer_request,
    get_database=firebase_admin_setup.get_db,
    assert_upload_owner=media_records._assert_upload_owner,
    validate_file_id=media_records._validate_file_id,
    find_upload=media_records._safe_find_upload,
    signed_upload_url=media_records._signed_upload_url,
))


_provider_admin_api = create_provider_admin_router(sys.modules[__name__])
app.include_router(_provider_admin_api.router)
provider_health = _provider_admin_api.provider_health
app.include_router(create_analytics_router(
    is_admin=request_security._is_admin_token,
    utcnow=observability._utcnow,
    get_database=firebase_admin_setup.get_db,
    read_counters=observability._read_daily_analytics_counters,
    read_latency_samples=observability._read_daily_latency_samples,
    read_metric_samples=observability._read_operational_metric_samples,
    alert_failure_ratio=observability._maybe_alert_failure_ratio,
    percentile_95=observability._p95,
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
