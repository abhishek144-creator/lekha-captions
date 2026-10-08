"""Runtime settings and startup safety checks, independent of the HTTP app."""
import json
import os
import sys
from dataclasses import dataclass
from typing import Any
try:
    from .release_metadata import apply_platform_release_defaults, release_metadata
    from .runtime_preflight import required_storage_settings
    from .media_storage import is_configured as s3_storage_configured
    from .rendering.capacity import NORMAL_EXPORT_QUEUE_NAME
except ImportError:
    from release_metadata import apply_platform_release_defaults, release_metadata
    from runtime_preflight import required_storage_settings
    from media_storage import is_configured as s3_storage_configured
    from rendering.capacity import NORMAL_EXPORT_QUEUE_NAME


@dataclass(frozen=True, repr=False)
class RuntimeSettings:
    CONTENT_SAFETY_BLOCKLIST: list[str]
    ALLOWED_ORIGINS: list[str]
    AI_COST_ESTIMATE_PER_MEDIA_MINUTE_USD: float
    AI_DAILY_LIMITS: dict[str, Any]
    AI_SYSTEM_DAILY_LIMIT: int
    ALLOWED_CONTENT_PREFIXES: tuple
    ALLOWED_EXTENSIONS: set
    ALLOW_EXPORT_WITHOUT_DB: bool
    ALLOW_INMEMORY_STATE: bool
    ALLOW_UNSCANNED_UPLOADS: bool
    ANALYTICS_RATE_LIMIT: int
    API_CURRENT_VERSION: str
    API_MIN_SUPPORTED_VERSION: str
    APP_ENV: Any
    APP_RELEASE: str
    CACHE_DIR: str
    DEAD_LETTER_DIR: str
    DEBUG_MODE_ENABLED: bool
    DEPRECATION_SUNSET_DATE: str
    DETECT_LANGUAGE_SHARED_NETWORK_RATE_LIMIT: int
    DETECT_LANGUAGE_USER_RATE_LIMIT: int
    DIRECT_UPLOAD_MAX_ACTIVE: int
    DIRECT_UPLOAD_MAX_HOURLY: int
    DIRECT_UPLOAD_MAX_OUTSTANDING_BYTES: int
    DIRECT_UPLOAD_SHARED_NETWORK_HOURLY: int
    DISABLE_EXPORT_CREDIT_LIMIT: bool
    DISABLE_EXPORT_DAILY_LIMIT: bool
    DURABLE_QUEUE_ENABLED: bool
    ENABLE_PROGRESSIVE_DELIVERY: bool
    ENFORCE_TENANT_ISOLATION: bool
    ERROR_BUDGET_WINDOW_MIN_EVENTS: int
    EXPORT_DIR: str
    EXPORT_FAILURE_LIMIT: int
    EXPORT_FAILURE_WINDOW: int
    EXPORT_MAX_PENDING_JOBS: int
    EXPORT_MAX_PENDING_WORK_SECONDS: int
    EXPORT_MAX_QUEUE_WAIT_SECONDS: int
    EXPORT_QUEUE_NAME: Any
    EXPORT_RENDERER_VERSION: str
    EXPORT_SLOT_TTL_SECONDS: int
    EXPORT_SLOT_WAIT_INTERVAL_SECONDS: int
    EXPORT_SLOT_WAIT_MAX_ATTEMPTS: int
    FIREBASE_APP_CHECK_ENFORCED: bool
    FONTS_DIR: str
    FREE_LIFETIME_TRANSCRIPTIONS: int
    FREE_PLAN: dict[str, Any]
    FREE_PLAN_CREDITS: int
    FREE_PLAN_ID: str
    GLOBAL_MAX_UPLOAD_DURATION_SECONDS: int
    GPU_RENDER_ENABLED: bool
    GPU_WORKER_MIG_NAME: str
    LOCAL_DEV_AUTH_BYPASS_ENABLED: Any
    MAX_CONCURRENT_EXPORTS_PER_USER: int
    MAX_CONCURRENT_RENDERS: int
    MAX_JSON_BODY_BYTES: int
    MAX_PROXY_UPLOAD_BYTES: int
    MAX_UPLOAD_BYTES: int
    MAX_UPLOAD_DURATION_CONTROL_KEY: str
    MEDIA_SCAN_QUEUE_NAME: str
    MEDIA_SCRATCH_ROOT: str
    MEDIA_URL_SIGNING_SECRET: str
    PAYMENT_RATE_LIMIT: int
    PAYMENT_RECONCILE_BATCH_SIZE: int
    PAYMENT_RECONCILE_INTERVAL_MINUTES: int
    PAYMENT_RECONCILE_LOOKBACK_HOURS: int
    PAYMENT_RECONCILE_SECRET: str
    PLAN_EXPORT_PRESETS: dict[str, Any]
    PLAN_PRICING: dict[str, Any]
    PROCESS_SHARED_NETWORK_RATE_LIMIT: int
    PROCESS_SLOT_TTL_SECONDS: int
    PROCESS_USER_RATE_LIMIT: int
    PROMO_RATE_LIMIT: int
    QUALITY_RANK: dict[str, Any]
    QUEUE_METRICS_ENABLED: bool
    QUEUE_METRICS_INTERVAL_SECONDS: int
    RAILWAY_REPLICA_ID: str
    RAILWAY_REPLICA_REGION: str
    RATE_ADMISSION_SCRIPT: str
    RAZORPAY_KEY_ID: str
    RAZORPAY_KEY_SECRET: str
    RAZORPAY_WEBHOOK_SECRET: str
    RECONCILE_ERROR_ALERT_THRESHOLD: int
    RECONCILE_SKIPPED_ALERT_THRESHOLD: int
    REDIS_URL: str
    RELEASE_METADATA: dict[str, Any]
    RENDER_CACHE_DIR: str
    RENDER_COST_ESTIMATE_PER_MEDIA_MINUTE_USD: float
    REQUIRE_PAYMENT_IDEMPOTENCY: bool
    RESERVED_SERVER_ANALYTICS_EVENTS: frozenset
    RUN_API_BACKGROUND_TASKS: bool
    SCHEDULER_OIDC_AUDIENCE: str
    SCHEDULER_SERVICE_ACCOUNT_EMAIL: str
    SECURITY_CSP: str
    SENTRY_DSN: str
    SERVICE_CONTROL_CACHE_SECONDS: float
    SERVICE_CONTROL_COLLECTION: str
    SERVICE_CONTROL_DOCUMENT: str
    SERVICE_CONTROL_KEYS: tuple
    SERVICE_CONTROL_NOTICE_MAX: int
    SIGNUP_SHARED_NETWORK_RATE_LIMIT: int
    SIGNUP_USER_RATE_LIMIT: int
    SLACK_ALERT_WEBHOOK_URL: str
    SLO_EXPORT_P95_MS_TARGET: int
    SLO_EXPORT_SUCCESS_TARGET: float
    SLO_PROCESS_P95_MS_TARGET: int
    SLO_PROCESS_SUCCESS_TARGET: float
    SPOT_WORKER_MIG_NAME: str
    SUPPORT_RATE_LIMIT: int
    TELEMETRY_BATCH_SIZE: int
    TELEMETRY_QUEUE_LIMIT: int
    TOPUP_ORDER_RESERVATION_SECONDS: int
    TOPUP_PURCHASE_WINDOW_SECONDS: int
    TRANSCRIPTION_CACHE_DIR: str
    TRANSCRIPTION_MIG_NAME: str
    TRANSCRIPTION_QUEUE_NAME: str
    TRANSLATE_SHARED_NETWORK_RATE_LIMIT: int
    TRANSLATE_USER_RATE_LIMIT: int
    TRANSLATION_MODEL: str
    UPLOAD_DIR: str
    UPLOAD_RATE_WINDOW: int
    UPLOAD_SHARED_NETWORK_RATE_LIMIT: int
    UPLOAD_USER_RATE_LIMIT: int
    WORKER_MIG_NAME: str
    _APP_CHECK_EXEMPT_PATHS: frozenset
    _APP_CHECK_EXEMPT_PREFIXES: tuple
    _CLIENT_RENDER_HINT_FIELDS: set
    _DURABLE_ONLY_EXPORT_JOB_FIELDS: tuple
    _ENV_ALIASES: dict[str, Any]
    _ENV_RAW: str
    _IS_DEVELOPMENT: bool
    _IS_PRODUCTION: bool
    _IS_TEST: bool
    _RELEASE_ENVIRONMENT: str
    _SERVICE_CONTROL_MESSAGES: dict[str, Any]
    _origins_env: str


def load_runtime_settings(root_dir):
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
    SENTRY_DSN = os.environ.get("SENTRY_DSN", "").strip()
    RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "")
    RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "")
    RAZORPAY_WEBHOOK_SECRET = os.environ.get("RAZORPAY_WEBHOOK_SECRET", "")
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
    with open(os.path.join(root_dir, "shared", "planCatalog.json"), "r", encoding="utf-8") as plan_catalog_file:
        PLAN_PRICING = json.load(plan_catalog_file)
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
    AI_SYSTEM_DAILY_LIMIT = max(0, int(os.environ.get("AI_SYSTEM_DAILY_LIMIT", "500")))
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
    _DURABLE_ONLY_EXPORT_JOB_FIELDS = ("request_snapshot",)
    ALLOWED_EXTENSIONS = {'mp4', 'mov', 'avi', 'mkv', 'webm', 'mp3', 'wav', 'm4a', 'aac'}
    MAX_UPLOAD_BYTES = 500 * 1024 * 1024  # 500 MiB = 524,288,000 bytes
    MAX_PROXY_UPLOAD_BYTES = 8 * 1024 * 1024 if os.environ.get("GCS_MEDIA_BUCKET") else MAX_UPLOAD_BYTES
    ALLOWED_CONTENT_PREFIXES = ("video/", "audio/")
    AI_DAILY_LIMITS = {
        "free": {"process": 3, "translate": 5, "detect_language": 3},
        "starter": {"process": 10, "translate": 20, "detect_language": 10},
        "creator": {"process": 30, "translate": 60, "detect_language": 30},
        "pro": {"process": 100, "translate": 200, "detect_language": 100},
    }
    FREE_LIFETIME_TRANSCRIPTIONS = int(FREE_PLAN.get("lifetime_transcriptions", 3) or 3)
    MEDIA_SCRATCH_ROOT = os.path.abspath(os.environ.get("MEDIA_SCRATCH_DIR", root_dir))
    UPLOAD_DIR = os.path.join(MEDIA_SCRATCH_ROOT, "uploads")
    EXPORT_DIR = os.path.join(MEDIA_SCRATCH_ROOT, "exports")
    FONTS_DIR = os.path.join(MEDIA_SCRATCH_ROOT, "flat_fonts")
    CACHE_DIR = os.path.join(MEDIA_SCRATCH_ROOT, "cache")
    TRANSCRIPTION_CACHE_DIR = os.path.join(CACHE_DIR, "transcriptions")
    RENDER_CACHE_DIR = os.path.join(CACHE_DIR, "renders")
    DEAD_LETTER_DIR = os.path.join(CACHE_DIR, "dead_letter")
    EXPORT_RENDERER_VERSION = "2026-09-27-project-framing-bilingual-v47"
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

    return RuntimeSettings(
        CONTENT_SAFETY_BLOCKLIST=CONTENT_SAFETY_BLOCKLIST,
        ALLOWED_ORIGINS=ALLOWED_ORIGINS,
        AI_COST_ESTIMATE_PER_MEDIA_MINUTE_USD=AI_COST_ESTIMATE_PER_MEDIA_MINUTE_USD,
        AI_DAILY_LIMITS=AI_DAILY_LIMITS,
        AI_SYSTEM_DAILY_LIMIT=AI_SYSTEM_DAILY_LIMIT,
        ALLOWED_CONTENT_PREFIXES=ALLOWED_CONTENT_PREFIXES,
        ALLOWED_EXTENSIONS=ALLOWED_EXTENSIONS,
        ALLOW_EXPORT_WITHOUT_DB=ALLOW_EXPORT_WITHOUT_DB,
        ALLOW_INMEMORY_STATE=ALLOW_INMEMORY_STATE,
        ALLOW_UNSCANNED_UPLOADS=ALLOW_UNSCANNED_UPLOADS,
        ANALYTICS_RATE_LIMIT=ANALYTICS_RATE_LIMIT,
        API_CURRENT_VERSION=API_CURRENT_VERSION,
        API_MIN_SUPPORTED_VERSION=API_MIN_SUPPORTED_VERSION,
        APP_ENV=APP_ENV,
        APP_RELEASE=APP_RELEASE,
        CACHE_DIR=CACHE_DIR,
        DEAD_LETTER_DIR=DEAD_LETTER_DIR,
        DEBUG_MODE_ENABLED=DEBUG_MODE_ENABLED,
        DEPRECATION_SUNSET_DATE=DEPRECATION_SUNSET_DATE,
        DETECT_LANGUAGE_SHARED_NETWORK_RATE_LIMIT=DETECT_LANGUAGE_SHARED_NETWORK_RATE_LIMIT,
        DETECT_LANGUAGE_USER_RATE_LIMIT=DETECT_LANGUAGE_USER_RATE_LIMIT,
        DIRECT_UPLOAD_MAX_ACTIVE=DIRECT_UPLOAD_MAX_ACTIVE,
        DIRECT_UPLOAD_MAX_HOURLY=DIRECT_UPLOAD_MAX_HOURLY,
        DIRECT_UPLOAD_MAX_OUTSTANDING_BYTES=DIRECT_UPLOAD_MAX_OUTSTANDING_BYTES,
        DIRECT_UPLOAD_SHARED_NETWORK_HOURLY=DIRECT_UPLOAD_SHARED_NETWORK_HOURLY,
        DISABLE_EXPORT_CREDIT_LIMIT=DISABLE_EXPORT_CREDIT_LIMIT,
        DISABLE_EXPORT_DAILY_LIMIT=DISABLE_EXPORT_DAILY_LIMIT,
        DURABLE_QUEUE_ENABLED=DURABLE_QUEUE_ENABLED,
        ENABLE_PROGRESSIVE_DELIVERY=ENABLE_PROGRESSIVE_DELIVERY,
        ENFORCE_TENANT_ISOLATION=ENFORCE_TENANT_ISOLATION,
        ERROR_BUDGET_WINDOW_MIN_EVENTS=ERROR_BUDGET_WINDOW_MIN_EVENTS,
        EXPORT_DIR=EXPORT_DIR,
        EXPORT_FAILURE_LIMIT=EXPORT_FAILURE_LIMIT,
        EXPORT_FAILURE_WINDOW=EXPORT_FAILURE_WINDOW,
        EXPORT_MAX_PENDING_JOBS=EXPORT_MAX_PENDING_JOBS,
        EXPORT_MAX_PENDING_WORK_SECONDS=EXPORT_MAX_PENDING_WORK_SECONDS,
        EXPORT_MAX_QUEUE_WAIT_SECONDS=EXPORT_MAX_QUEUE_WAIT_SECONDS,
        EXPORT_QUEUE_NAME=EXPORT_QUEUE_NAME,
        EXPORT_RENDERER_VERSION=EXPORT_RENDERER_VERSION,
        EXPORT_SLOT_TTL_SECONDS=EXPORT_SLOT_TTL_SECONDS,
        EXPORT_SLOT_WAIT_INTERVAL_SECONDS=EXPORT_SLOT_WAIT_INTERVAL_SECONDS,
        EXPORT_SLOT_WAIT_MAX_ATTEMPTS=EXPORT_SLOT_WAIT_MAX_ATTEMPTS,
        FIREBASE_APP_CHECK_ENFORCED=FIREBASE_APP_CHECK_ENFORCED,
        FONTS_DIR=FONTS_DIR,
        FREE_LIFETIME_TRANSCRIPTIONS=FREE_LIFETIME_TRANSCRIPTIONS,
        FREE_PLAN=FREE_PLAN,
        FREE_PLAN_CREDITS=FREE_PLAN_CREDITS,
        FREE_PLAN_ID=FREE_PLAN_ID,
        GLOBAL_MAX_UPLOAD_DURATION_SECONDS=GLOBAL_MAX_UPLOAD_DURATION_SECONDS,
        GPU_RENDER_ENABLED=GPU_RENDER_ENABLED,
        GPU_WORKER_MIG_NAME=GPU_WORKER_MIG_NAME,
        LOCAL_DEV_AUTH_BYPASS_ENABLED=LOCAL_DEV_AUTH_BYPASS_ENABLED,
        MAX_CONCURRENT_EXPORTS_PER_USER=MAX_CONCURRENT_EXPORTS_PER_USER,
        MAX_CONCURRENT_RENDERS=MAX_CONCURRENT_RENDERS,
        MAX_JSON_BODY_BYTES=MAX_JSON_BODY_BYTES,
        MAX_PROXY_UPLOAD_BYTES=MAX_PROXY_UPLOAD_BYTES,
        MAX_UPLOAD_BYTES=MAX_UPLOAD_BYTES,
        MAX_UPLOAD_DURATION_CONTROL_KEY=MAX_UPLOAD_DURATION_CONTROL_KEY,
        MEDIA_SCAN_QUEUE_NAME=MEDIA_SCAN_QUEUE_NAME,
        MEDIA_SCRATCH_ROOT=MEDIA_SCRATCH_ROOT,
        MEDIA_URL_SIGNING_SECRET=MEDIA_URL_SIGNING_SECRET,
        PAYMENT_RATE_LIMIT=PAYMENT_RATE_LIMIT,
        PAYMENT_RECONCILE_BATCH_SIZE=PAYMENT_RECONCILE_BATCH_SIZE,
        PAYMENT_RECONCILE_INTERVAL_MINUTES=PAYMENT_RECONCILE_INTERVAL_MINUTES,
        PAYMENT_RECONCILE_LOOKBACK_HOURS=PAYMENT_RECONCILE_LOOKBACK_HOURS,
        PAYMENT_RECONCILE_SECRET=PAYMENT_RECONCILE_SECRET,
        PLAN_EXPORT_PRESETS=PLAN_EXPORT_PRESETS,
        PLAN_PRICING=PLAN_PRICING,
        PROCESS_SHARED_NETWORK_RATE_LIMIT=PROCESS_SHARED_NETWORK_RATE_LIMIT,
        PROCESS_SLOT_TTL_SECONDS=PROCESS_SLOT_TTL_SECONDS,
        PROCESS_USER_RATE_LIMIT=PROCESS_USER_RATE_LIMIT,
        PROMO_RATE_LIMIT=PROMO_RATE_LIMIT,
        QUALITY_RANK=QUALITY_RANK,
        QUEUE_METRICS_ENABLED=QUEUE_METRICS_ENABLED,
        QUEUE_METRICS_INTERVAL_SECONDS=QUEUE_METRICS_INTERVAL_SECONDS,
        RAILWAY_REPLICA_ID=RAILWAY_REPLICA_ID,
        RAILWAY_REPLICA_REGION=RAILWAY_REPLICA_REGION,
        RATE_ADMISSION_SCRIPT=RATE_ADMISSION_SCRIPT,
        RAZORPAY_KEY_ID=RAZORPAY_KEY_ID,
        RAZORPAY_KEY_SECRET=RAZORPAY_KEY_SECRET,
        RAZORPAY_WEBHOOK_SECRET=RAZORPAY_WEBHOOK_SECRET,
        RECONCILE_ERROR_ALERT_THRESHOLD=RECONCILE_ERROR_ALERT_THRESHOLD,
        RECONCILE_SKIPPED_ALERT_THRESHOLD=RECONCILE_SKIPPED_ALERT_THRESHOLD,
        REDIS_URL=REDIS_URL,
        RELEASE_METADATA=RELEASE_METADATA,
        RENDER_CACHE_DIR=RENDER_CACHE_DIR,
        RENDER_COST_ESTIMATE_PER_MEDIA_MINUTE_USD=RENDER_COST_ESTIMATE_PER_MEDIA_MINUTE_USD,
        REQUIRE_PAYMENT_IDEMPOTENCY=REQUIRE_PAYMENT_IDEMPOTENCY,
        RESERVED_SERVER_ANALYTICS_EVENTS=RESERVED_SERVER_ANALYTICS_EVENTS,
        RUN_API_BACKGROUND_TASKS=RUN_API_BACKGROUND_TASKS,
        SCHEDULER_OIDC_AUDIENCE=SCHEDULER_OIDC_AUDIENCE,
        SCHEDULER_SERVICE_ACCOUNT_EMAIL=SCHEDULER_SERVICE_ACCOUNT_EMAIL,
        SECURITY_CSP=SECURITY_CSP,
        SENTRY_DSN=SENTRY_DSN,
        SERVICE_CONTROL_CACHE_SECONDS=SERVICE_CONTROL_CACHE_SECONDS,
        SERVICE_CONTROL_COLLECTION=SERVICE_CONTROL_COLLECTION,
        SERVICE_CONTROL_DOCUMENT=SERVICE_CONTROL_DOCUMENT,
        SERVICE_CONTROL_KEYS=SERVICE_CONTROL_KEYS,
        SERVICE_CONTROL_NOTICE_MAX=SERVICE_CONTROL_NOTICE_MAX,
        SIGNUP_SHARED_NETWORK_RATE_LIMIT=SIGNUP_SHARED_NETWORK_RATE_LIMIT,
        SIGNUP_USER_RATE_LIMIT=SIGNUP_USER_RATE_LIMIT,
        SLACK_ALERT_WEBHOOK_URL=SLACK_ALERT_WEBHOOK_URL,
        SLO_EXPORT_P95_MS_TARGET=SLO_EXPORT_P95_MS_TARGET,
        SLO_EXPORT_SUCCESS_TARGET=SLO_EXPORT_SUCCESS_TARGET,
        SLO_PROCESS_P95_MS_TARGET=SLO_PROCESS_P95_MS_TARGET,
        SLO_PROCESS_SUCCESS_TARGET=SLO_PROCESS_SUCCESS_TARGET,
        SPOT_WORKER_MIG_NAME=SPOT_WORKER_MIG_NAME,
        SUPPORT_RATE_LIMIT=SUPPORT_RATE_LIMIT,
        TELEMETRY_BATCH_SIZE=TELEMETRY_BATCH_SIZE,
        TELEMETRY_QUEUE_LIMIT=TELEMETRY_QUEUE_LIMIT,
        TOPUP_ORDER_RESERVATION_SECONDS=TOPUP_ORDER_RESERVATION_SECONDS,
        TOPUP_PURCHASE_WINDOW_SECONDS=TOPUP_PURCHASE_WINDOW_SECONDS,
        TRANSCRIPTION_CACHE_DIR=TRANSCRIPTION_CACHE_DIR,
        TRANSCRIPTION_MIG_NAME=TRANSCRIPTION_MIG_NAME,
        TRANSCRIPTION_QUEUE_NAME=TRANSCRIPTION_QUEUE_NAME,
        TRANSLATE_SHARED_NETWORK_RATE_LIMIT=TRANSLATE_SHARED_NETWORK_RATE_LIMIT,
        TRANSLATE_USER_RATE_LIMIT=TRANSLATE_USER_RATE_LIMIT,
        TRANSLATION_MODEL=TRANSLATION_MODEL,
        UPLOAD_DIR=UPLOAD_DIR,
        UPLOAD_RATE_WINDOW=UPLOAD_RATE_WINDOW,
        UPLOAD_SHARED_NETWORK_RATE_LIMIT=UPLOAD_SHARED_NETWORK_RATE_LIMIT,
        UPLOAD_USER_RATE_LIMIT=UPLOAD_USER_RATE_LIMIT,
        WORKER_MIG_NAME=WORKER_MIG_NAME,
        _APP_CHECK_EXEMPT_PATHS=_APP_CHECK_EXEMPT_PATHS,
        _APP_CHECK_EXEMPT_PREFIXES=_APP_CHECK_EXEMPT_PREFIXES,
        _CLIENT_RENDER_HINT_FIELDS=_CLIENT_RENDER_HINT_FIELDS,
        _DURABLE_ONLY_EXPORT_JOB_FIELDS=_DURABLE_ONLY_EXPORT_JOB_FIELDS,
        _ENV_ALIASES=_ENV_ALIASES,
        _ENV_RAW=_ENV_RAW,
        _IS_DEVELOPMENT=_IS_DEVELOPMENT,
        _IS_PRODUCTION=_IS_PRODUCTION,
        _IS_TEST=_IS_TEST,
        _RELEASE_ENVIRONMENT=_RELEASE_ENVIRONMENT,
        _SERVICE_CONTROL_MESSAGES=_SERVICE_CONTROL_MESSAGES,
        _origins_env=_origins_env,
    )
