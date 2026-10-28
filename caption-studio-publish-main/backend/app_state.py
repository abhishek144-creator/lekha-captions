"""Process-wide runtime state shared by the API modules.

In-memory caches, rate-limit buckets, telemetry buffers and background-task
handles live here. Clients and queues start empty: main.py connects Redis,
creates the queues, scheduler and video processor at start-up and stores them
here. Read them as `app_state.NAME` (never import the names), so the value set
at start-up, or a test patch, is what every module sees.
"""

import asyncio
import logging
import os
import threading
from collections import OrderedDict, deque
from typing import Any, Dict

import anyio

try:
    from . import settings
except ImportError:  # Direct execution from backend/ remains supported.
    import settings

_logger = logging.getLogger("caption_studio_backend")

_app_check_verification_limiter = anyio.CapacityLimiter(16)

# Set by main.py at start-up when Razorpay credentials are configured.
rzp_client = None

render_semaphore = asyncio.Semaphore(settings.MAX_CONCURRENT_RENDERS)


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

# Global APScheduler reference (set by main.py; None if apscheduler is not installed)
scheduler = None

# Connected by main.py at start-up (None when Redis is unavailable or in tests).
_redis_client = None
_rq_redis_client = None

# Durable RQ queues, created by main.py at start-up.
_export_queue = None
_export_queues = {}
_transcription_queue = None
_media_scan_queue = None

# Rate-limit buckets (in-memory fallback when Redis is unavailable).
_upload_rate: Dict[str, list] = {}
_signup_rate: Dict[str, list] = {}
_payment_rate: Dict[str, list] = {}
_promo_rate: Dict[str, list] = {}
_translate_rate: Dict[str, list] = {}
_process_rate: Dict[str, list] = {}
_detect_language_rate: Dict[str, list] = {}
_caption_emotion_rate: Dict[str, list] = {}
_analytics_rate: Dict[str, list] = {}
_support_rate: Dict[str, list] = {}
_draft_save_rate: Dict[str, list] = {}

_analytics_counters: Dict[str, int] = {}
_analytics_daily_counters: Dict[str, Dict[str, int]] = {}
_analytics_last_alert_ts: Dict[str, float] = {}
_ops_alert_sent_at: Dict[str, float] = {}
_route_latency_samples: Dict[str, list] = {}
_operational_metric_samples: Dict[str, list] = {}
_payment_idempotency: Dict[str, Dict[str, Any]] = {}
_tenant_memberships: Dict[str, set] = {}
_telemetry_buffer = deque()
_telemetry_lock = threading.Lock()

# Background task handles, set by main.py's startup_event.
_telemetry_flush_task = None
_simple_janitor_task = None
_transcription_dispatch_task = None
_queue_metrics_task = None

# Provider circuit breakers, created by main.py at start-up.
_provider_breakers: Dict[str, Any] = {}

_service_control_cache: Dict[str, Any] = {"ts": 0.0, "value": {}}

_RATE_LIMIT_NAMESPACES = (
    (_upload_rate, "upload"),
    (_signup_rate, "signup"),
    (_payment_rate, "payment"),
    (_promo_rate, "promo"),
    (_translate_rate, "translate"),
    (_process_rate, "process"),
    (_detect_language_rate, "detect-language"),
    (_caption_emotion_rate, "caption-emotion"),
    (_analytics_rate, "analytics"),
    (_support_rate, "support"),
    (_draft_save_rate, "draft-save"),
)

# The caption renderer, created by main.py once the media directories exist.
processor = None

_cached_google_fonts = None

_dependency_snapshot_cache: Dict[str, Any] = {"checked_at": 0.0, "value": None}
_dependency_snapshot_lock = threading.Lock()
