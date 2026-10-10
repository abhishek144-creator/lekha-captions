"""Environment configuration and start-up safety checks for the API.

Values are read once, at import, in the order they depend on each other (one
production step fills in release defaults that later values read). Read them
as `settings.NAME` rather than importing names, so a test can patch a value in
one place and every caller sees it.
"""

import json
import os
import secrets
import sys

from dotenv import load_dotenv

try:
    from .media_storage import is_configured as s3_storage_configured
    from .release_metadata import apply_platform_release_defaults, release_metadata
    from .rendering.capacity import NORMAL_EXPORT_QUEUE_NAME
    from .runtime_preflight import required_storage_settings
except ImportError:  # Direct execution from backend/ remains supported.
    from media_storage import is_configured as s3_storage_configured
    from release_metadata import apply_platform_release_defaults, release_metadata
    from rendering.capacity import NORMAL_EXPORT_QUEUE_NAME
    from runtime_preflight import required_storage_settings

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

# --- Error tracking (optional) ------------------------------------------------
# Structured logs and dead-letter records already capture failures, but they are
# per-instance and easy to miss in aggregate. Sentry collects them in one place.
# Entirely inert unless SENTRY_DSN is set, so local and test runs are unchanged.
# send_default_pii stays False: this service handles user media and payments.
SENTRY_DSN = os.environ.get("SENTRY_DSN", "").strip()

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

REDIS_URL = os.environ.get("REDIS_URL", "")

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

if _IS_PRODUCTION and not DURABLE_QUEUE_ENABLED:
    raise RuntimeError("ENABLE_DURABLE_QUEUE must be 1 in production.")

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

# Authenticated users keep a strict per-account limit, while the shared public
# address gets a much wider abuse ceiling. Mobile carriers, universities,
# offices, and public Wi-Fi commonly place many unrelated users behind one IP.
UPLOAD_USER_RATE_LIMIT = 10
UPLOAD_SHARED_NETWORK_RATE_LIMIT = 200
UPLOAD_RATE_WINDOW = 3600  # 1 hour

SIGNUP_SHARED_NETWORK_RATE_LIMIT = 100
SIGNUP_USER_RATE_LIMIT = 3  # protects retries/automation targeting one identity

PAYMENT_RATE_LIMIT = 10   # max payment attempts per hour per IP

PROMO_RATE_LIMIT = 5      # max promo redemptions per hour per IP

TRANSLATE_USER_RATE_LIMIT = 20
TRANSLATE_SHARED_NETWORK_RATE_LIMIT = 300

PROCESS_USER_RATE_LIMIT = 20
PROCESS_SHARED_NETWORK_RATE_LIMIT = 300

DETECT_LANGUAGE_USER_RATE_LIMIT = 10
DETECT_LANGUAGE_SHARED_NETWORK_RATE_LIMIT = 200

ANALYTICS_RATE_LIMIT = 120  # max client analytics events per hour per IP

SUPPORT_RATE_LIMIT = 5  # max public support submissions per hour per IP

# Counters that the release gate (`_build_slo_snapshot`) and failure-ratio
# alerting read as ground truth. The public /api/analytics/track endpoint must
# never let a client write these — otherwise an unauthenticated caller could
# inflate failure counters to trip the readiness gate or fire ops alerts.
RESERVED_SERVER_ANALYTICS_EVENTS = frozenset({
    "upload_rejected_duration",
    "upload_rejected_free_transcriptions_used",
    "upload_rejected_daily_quota",
    "upload_discarded",
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

_SERVICE_CONTROL_MESSAGES = {
    "maintenance_mode": "Lekha Captions is under maintenance. Please try again shortly.",
    "pause_signups": "New sign-ups are paused right now. Please try again shortly.",
    "pause_payments": "Payments are paused right now. You have not been charged — please try again shortly.",
    "pause_uploads": "Uploads are paused right now. Please try again shortly.",
    "pause_transcription": "Transcription is paused right now. Your upload is safe — please try again shortly.",
    "pause_exports": "Exports are paused right now. Your captions are saved — please try again shortly.",
}

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

AI_DAILY_LIMITS = {
    "free": {"process": 3, "translate": 5, "detect_language": 3},
    "starter": {"process": 10, "translate": 20, "detect_language": 10},
    "creator": {"process": 30, "translate": 60, "detect_language": 30},
    "pro": {"process": 100, "translate": 200, "detect_language": 100},
}

# Free accounts get a fixed number of transcriptions for the life of the
# account, not a daily refill: a trial, not a free tier that costs money forever.
FREE_LIFETIME_TRANSCRIPTIONS = int(FREE_PLAN.get("lifetime_transcriptions", 3) or 3)

# Local paths are scratch space only. Resolve them from the project root rather
# than the process cwd so web and worker commands behave consistently.
MEDIA_SCRATCH_ROOT = os.path.abspath(os.environ.get("MEDIA_SCRATCH_DIR", root_dir))
UPLOAD_DIR = os.path.join(MEDIA_SCRATCH_ROOT, "uploads")
EXPORT_DIR = os.path.join(MEDIA_SCRATCH_ROOT, "exports")
FONTS_DIR = os.path.join(MEDIA_SCRATCH_ROOT, "flat_fonts")
CACHE_DIR = os.path.join(MEDIA_SCRATCH_ROOT, "cache")
TRANSCRIPTION_CACHE_DIR = os.path.join(CACHE_DIR, "transcriptions")
# Transcripts are also kept in Firestore under the same content-hash key, so a
# re-upload of identical media is free on any worker, not only the one whose
# disposable scratch disk holds the local copy. Retention is deliberately short.
TRANSCRIPTION_CACHE_COLLECTION = (
    "transcription_cache" if _RELEASE_ENVIRONMENT == "production"
    else f"transcription_cache_{_RELEASE_ENVIRONMENT}"
)
TRANSCRIPTION_CACHE_RETENTION_HOURS = 24
TRANSCRIPTION_CACHE_MAX_BYTES = 900_000
# Browser-measured, so bounded and kept apart from server counters and gates.
CLIENT_TIME_TO_FIRST_CAPTION_MAX_MS = 2 * 3600 * 1000
RENDER_CACHE_DIR = os.path.join(CACHE_DIR, "renders")
DEAD_LETTER_DIR = os.path.join(CACHE_DIR, "dead_letter")
EXPORT_RENDERER_VERSION = "2026-10-10-template-font-zoom-v52"

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

DIRECT_UPLOAD_MAX_ACTIVE = max(1, int(os.environ.get("DIRECT_UPLOAD_MAX_ACTIVE", "2")))
DIRECT_UPLOAD_MAX_HOURLY = max(1, int(os.environ.get("DIRECT_UPLOAD_MAX_HOURLY", "12")))
DIRECT_UPLOAD_SHARED_NETWORK_HOURLY = max(
    100, int(os.environ.get("DIRECT_UPLOAD_SHARED_NETWORK_HOURLY", "200")),
)
DIRECT_UPLOAD_MAX_OUTSTANDING_BYTES = max(
    MAX_UPLOAD_BYTES,
    int(os.environ.get("DIRECT_UPLOAD_MAX_OUTSTANDING_BYTES", str(1024 * 1024 * 1024))),
)

TOPUP_PURCHASE_WINDOW_SECONDS = 30 * 24 * 60 * 60
TOPUP_ORDER_RESERVATION_SECONDS = 2 * 60 * 60
