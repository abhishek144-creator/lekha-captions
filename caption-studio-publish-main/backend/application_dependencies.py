"""External adapters and factories used by application composition."""

import os
import sys
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


def dependencies():
    return {
        "create_upload_router": create_upload_router,
        "AlreadyExists": AlreadyExists,
        "Any": Any,
        "AsyncIOScheduler": AsyncIOScheduler,
        "BaseModel": BaseModel,
        "CORSMiddleware": CORSMiddleware,
        "Dict": Dict,
        "FAST_EXPORT_QUEUE_NAME": FAST_EXPORT_QUEUE_NAME,
        "FastAPI": FastAPI,
        "Field": Field,
        "File": File,
        "FileResponse": FileResponse,
        "GPU_EXPORT_QUEUE_NAME": GPU_EXPORT_QUEUE_NAME,
        "HEAVY_EXPORT_QUEUE_NAME": HEAVY_EXPORT_QUEUE_NAME,
        "HTTPException": HTTPException,
        "InvalidJobTransition": InvalidJobTransition,
        "JOB_STATE_LOCK": JOB_STATE_LOCK,
        "JSONResponse": JSONResponse,
        "Job": Job,
        "List": List,
        "MediaScanJobs": MediaScanJobs,
        "NORMAL_EXPORT_QUEUE_NAME": NORMAL_EXPORT_QUEUE_NAME,
        "Optional": Optional,
        "OrderedDict": OrderedDict,
        "PENDING_WORK_LEDGER_KEY": PENDING_WORK_LEDGER_KEY,
        "Queue": Queue,
        "RAZORPAY_AVAILABLE": RAZORPAY_AVAILABLE,
        "REDIS_AVAILABLE": REDIS_AVAILABLE,
        "RENDER_QUEUE_NAMES": RENDER_QUEUE_NAMES,
        "RQRetry": RQRetry,
        "RQWorker": RQWorker,
        "RQ_AVAILABLE": RQ_AVAILABLE,
        "RailwayIdleConnectionsMiddleware": RailwayIdleConnectionsMiddleware,
        "RedirectResponse": RedirectResponse,
        "Request": Request,
        "Response": Response,
        "SCHEDULER_AVAILABLE": SCHEDULER_AVAILABLE,
        "SENTRY_AVAILABLE": SENTRY_AVAILABLE,
        "TranscriptionJobs": TranscriptionJobs,
        "UploadBodyLimitMiddleware": UploadBodyLimitMiddleware,
        "UploadFile": UploadFile,
        "UploadSecurityService": UploadSecurityService,
        "VideoProcessor": VideoProcessor,
        "_razorpay_module": _razorpay_module,
        "anyio": anyio,
        "apply_platform_release_defaults": apply_platform_release_defaults,
        "asynccontextmanager": asynccontextmanager,
        "asyncio": asyncio,
        "base64": base64,
        "cancel_resumable_source_upload": cancel_resumable_source_upload,
        "connect_redis": connect_redis,
        "create_account_router": create_account_router,
        "create_admin_router": create_admin_router,
        "create_analytics_router": create_analytics_router,
        "create_api_models": create_api_models,
        "create_billing_service": create_billing_service,
        "create_cost_reconciliation_router": create_cost_reconciliation_router,
        "create_direct_upload_router": create_direct_upload_router,
        "create_editor_preferences_router": create_editor_preferences_router,
        "create_entitlements": create_entitlements,
        "create_export_jobs": create_export_jobs,
        "create_export_router": create_export_router,
        "create_language_router": create_language_router,
        "create_maintenance_jobs": create_maintenance_jobs,
        "create_maintenance_router": create_maintenance_router,
        "create_media_records": create_media_records,
        "create_media_router": create_media_router,
        "create_notification": create_notification,
        "create_notification_router": create_notification_router,
        "create_observability": create_observability,
        "create_operator_controls": create_operator_controls,
        "create_payments_router": create_payments_router,
        "create_processing_router": create_processing_router,
        "create_project_router": create_project_router,
        "create_provider_admin_router": create_provider_admin_router,
        "create_public_api_router": create_public_api_router,
        "create_request_guards": create_request_guards,
        "create_request_security": create_request_security,
        "create_resumable_source_upload": create_resumable_source_upload,
        "create_system_router": create_system_router,
        "create_upload_dispatch": create_upload_dispatch,
        "create_workspace_router": create_workspace_router,
        "date": date,
        "datetime": datetime,
        "delete_expired_exports": delete_expired_exports,
        "delete_expired_uploads": delete_expired_uploads,
        "delete_from_firebase_storage": delete_from_firebase_storage,
        "delete_render_cache": delete_render_cache,
        "delete_user_exports": delete_user_exports,
        "delete_user_uploads": delete_user_uploads,
        "deque": deque,
        "disconnect_idle_redis_clients": disconnect_idle_redis_clients,
        "download_export_from_firebase_storage": download_export_from_firebase_storage,
        "download_from_firebase_storage": download_from_firebase_storage,
        "download_render_cache": download_render_cache,
        "enqueue_bounded_across_queues": enqueue_bounded_across_queues,
        "estimate_render_capacity": estimate_render_capacity,
        "finalize_resumable_source_upload": finalize_resumable_source_upload,
        "firebase_app_check": firebase_app_check,
        "firebase_auth": firebase_auth,
        "firestore": firestore,
        "get_db": get_db,
        "hashlib": hashlib,
        "hmac": hmac,
        "ipaddress": ipaddress,
        "job_queue_prediction": job_queue_prediction,
        "json": json,
        "list_projects": list_projects,
        "logging": logging,
        "math": math,
        "mimetypes": mimetypes,
        "model_validator": model_validator,
        "os": os,
        "pathlib": pathlib,
        "publish_queue_snapshot": publish_queue_snapshot,
        "queue_snapshot": queue_snapshot,
        "re": re,
        "read_draft": read_draft,
        "read_editor_preferences": read_editor_preferences,
        "redis": redis,
        "relativedelta": relativedelta,
        "release_metadata": release_metadata,
        "release_pending_work": release_pending_work,
        "release_upload": release_upload,
        "render_cache_eligible": render_cache_eligible,
        "render_cache_identity": render_cache_identity,
        "render_queue_snapshot": render_queue_snapshot,
        "require_scheduler_authorization": require_scheduler_authorization,
        "required_storage_settings": required_storage_settings,
        "reserve_upload": reserve_upload,
        "resume_resumable_source_upload": resume_resumable_source_upload,
        "run_media_command": run_media_command,
        "s3_storage_configured": s3_storage_configured,
        "scan_upload_for_threat": scan_upload_for_threat,
        "secrets": secrets,
        "sentry_sdk": sentry_sdk,
        "set_source_upload_state": set_source_upload_state,
        "shutil": shutil,
        "sign_resumable_upload_parts": sign_resumable_upload_parts,
        "signed_export_download_url": signed_export_download_url,
        "storage_backend_ready": storage_backend_ready,
        "subprocess": subprocess,
        "sys": sys,
        "threading": threading,
        "time": time,
        "timedelta": timedelta,
        "timezone": timezone,
        "transcription_provider_health": transcription_provider_health,
        "transition_export_job": transition_export_job,
        "upload_render_cache": upload_render_cache,
        "upload_source_media": upload_source_media,
        "upload_to_firebase_storage": upload_to_firebase_storage,
        "urllib": urllib,
        "uuid": uuid,
        "verify_token": verify_token,
        "worker_launcher": worker_launcher,
    }
