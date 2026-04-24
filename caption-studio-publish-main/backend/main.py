from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import shutil
import os
import uuid
import subprocess
import urllib.request
import json
from datetime import datetime, timedelta, date
from dateutil.relativedelta import relativedelta
from typing import List, Dict, Any, Optional
from processor import VideoProcessor
import asyncio
import time
import hmac
import hashlib
from fastapi import Request
from firebase_admin_setup import verify_token, get_db, upload_to_firebase_storage, delete_from_firebase_storage

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

app = FastAPI()

# Initialize Razorpay Client (Keys will be read from environment variables)
RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "")
rzp_client = _razorpay_module.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET)) if RAZORPAY_AVAILABLE else None

# DEV_MODE: when True, an empty or "mock-token" id_token is accepted as dev bypass.
# MUST be False (or unset) in production — set DEV_MODE=true only in local .env.
DEV_MODE: bool = os.environ.get("DEV_MODE", "false").lower() == "true"

# CREDITS_HMAC_SECRET: 32+ random bytes, hex-encoded.  When set, every backend
# write to `credits_remaining` also writes a `credits_sig` HMAC.  On read the
# HMAC is verified — a mismatch means the field was written directly to Firestore
# outside the backend (Vulnerability 2).  Generate with:
#   python -c "import secrets; print(secrets.token_hex(32))"
CREDITS_HMAC_SECRET: str = os.environ.get("CREDITS_HMAC_SECRET", "")

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

# Per-user locks prevent two concurrent export requests from the same user from
# racing past the daily-limit check and both deducting a credit.
_user_export_locks: Dict[str, asyncio.Lock] = {}

def _get_user_export_lock(uid: str) -> asyncio.Lock:
    if uid not in _user_export_locks:
        _user_export_locks[uid] = asyncio.Lock()
    return _user_export_locks[uid]

# Global APScheduler reference (None if apscheduler not installed)
scheduler = AsyncIOScheduler() if SCHEDULER_AVAILABLE else None

async def advanced_janitor_job():
    """Background task to cleanup files based on retention rules."""
    now = time.time()
    deleted_count = 0

    # Clean upload directory — all files older than 6 hours
    # os.scandir returns a lazy iterator (no full directory materialisation) and
    # reuses the stat() result from the dir entry, saving a syscall per file.
    if os.path.exists(UPLOAD_DIR):
        with os.scandir(UPLOAD_DIR) as it:
            for entry in it:
                if not entry.is_file():
                    continue
                try:
                    st = entry.stat()
                    age = now - max(st.st_mtime, st.st_atime)
                    if entry.name.endswith('.srt'):
                        if age > 604800:  # 7 days for SRT
                            os.remove(entry.path)
                            deleted_count += 1
                    elif age > 21600:  # 6 hours for uploads
                        os.remove(entry.path)
                        deleted_count += 1
                except Exception as e:
                    print(f"Janitor error: {e}")

    # Clean stale local exports (should be on Firebase, delete after 30 min)
    if os.path.exists(EXPORT_DIR):
        with os.scandir(EXPORT_DIR) as it:
            for entry in it:
                if not entry.is_file():
                    continue
                try:
                    age = now - entry.stat().st_mtime
                    if age > 1800:  # 30 minutes
                        os.remove(entry.path)
                        deleted_count += 1
                except Exception as e:
                    print(f"Janitor error: {e}")

    if deleted_count > 0:
        print(f"[Janitor] Cleaned {deleted_count} files.")

@app.on_event("startup")
async def startup_event():
    if scheduler is not None:
        scheduler.add_job(advanced_janitor_job, 'interval', minutes=15)
        scheduler.start()
        print("[Janitor] APScheduler Advanced Janitor started (runs every 15 mins).")
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

_rate_call_count = 0  # used to trigger periodic sweep of stale keys

def _check_rate(store: Dict[str, list], key: str, limit: int, window: int = 3600) -> bool:
    """Returns True if the request is allowed, False if rate-limited.
    Mutates *store* in-place to record the current timestamp.

    Safety properties:
    - Per-key list is capped at (limit + 5) entries — prevents unbounded growth for a
      single hammered IP even if the sweep has not run yet.
    - Every 1 000 calls a sweep evicts keys whose newest timestamp is older than the
      window, reclaiming memory for IPs that have gone quiet.
    """
    global _rate_call_count
    now_ts = time.time()
    timestamps = [t for t in store.get(key, []) if t > now_ts - window]
    if len(timestamps) >= limit:
        store[key] = timestamps
        return False
    timestamps.append(now_ts)
    store[key] = timestamps[-(limit + 5):]  # cap per-key list
    # Periodic sweep: evict keys with no activity in the last window
    _rate_call_count += 1
    if _rate_call_count >= 1000:
        _rate_call_count = 0
        cutoff = now_ts - window
        stale = [k for k, v in store.items() if not v or v[-1] <= cutoff]
        for k in stale:
            del store[k]
    return True

# ── Credits integrity helpers ─────────────────────────────────────────────────
def _sign_credits(uid: str, credits: int) -> str:
    """Return an HMAC-SHA256 hex digest over (uid, credits).

    An empty string is returned when CREDITS_HMAC_SECRET is not configured so
    the feature degrades gracefully in dev environments without the secret.
    """
    if not CREDITS_HMAC_SECRET:
        return ""
    msg = f"{uid}:{credits}".encode()
    return hmac.new(CREDITS_HMAC_SECRET.encode(), msg, hashlib.sha256).hexdigest()


def _verify_credits(uid: str, user_data: dict) -> tuple:
    """Return (credits: int, tampered: bool).

    tampered=True means the `credits_remaining` field was written directly to
    Firestore outside of the backend (signature mismatch) or contains a
    non-numeric value.  The caller must treat tampered credits as zero and
    block the operation.

    Absent signature (legacy users who pre-date this feature, or dev mode
    without CREDITS_HMAC_SECRET) is treated as *trusted but unverified* — the
    backend will write a proper signature on its next credit mutation so the
    account self-heals after one operation.
    """
    # --- type-safety: reject non-numeric values outright --------------------
    raw = user_data.get('credits_remaining', 0)
    try:
        credits = int(raw)
        if credits < 0:
            credits = 0
    except (TypeError, ValueError):
        print(f"[Security] uid={uid}: credits_remaining={raw!r} is non-numeric — treating as tampered")
        return 0, True

    # --- signature verification (skipped when secret not configured) --------
    if not CREDITS_HMAC_SECRET:
        return credits, False

    stored_sig = user_data.get('credits_sig', '')
    if not stored_sig:
        # No signature: legacy user or first use — trust the stored value but
        # log it so we can monitor accounts that never get a signature written.
        print(f"[Credits] uid={uid}: no credits_sig (legacy/first-use) — trusting value={credits}")
        return credits, False

    expected = _sign_credits(uid, credits)
    if not hmac.compare_digest(expected, stored_sig):
        print(f"[Security] TAMPER DETECTED uid={uid}: credits_remaining={credits} sig mismatch — blocking")
        return 0, True

    return credits, False


# Allowed upload extensions (module-level constant — not rebuilt per request)
ALLOWED_EXTENSIONS = {'mp4', 'mov', 'avi', 'mkv', 'webm', 'mp3', 'wav', 'm4a', 'aac'}
MAX_UPLOAD_BYTES = 500 * 1024 * 1024  # 500 MB

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

# Fix: Remove hardcoded 'backend/' prefix from abspath as we are running the process from inside backend/
UPLOAD_DIR = os.path.abspath("uploads")
EXPORT_DIR = os.path.abspath("exports")
FONTS_DIR = os.path.abspath("flat_fonts")

for d in [UPLOAD_DIR, EXPORT_DIR, FONTS_DIR]:
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
    quality: str = "1080p"  # Export quality: "4k", "1080p", "720p"
    fps: int = 30  # Frame rate: 24, 30, 60

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
        # Whitelist quality and fps to prevent injection via those fields
        if s.get('quality') not in ('4k', '1080p', '720p', None):
            s.pop('quality', None)
        return s

class CreateOrderRequest(BaseModel):
    plan_id: str
    id_token: str
    currency: str = "INR"

class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    id_token: str
    plan_id: str = ""  # echoed back from create-order response

class ProcessRequest(BaseModel):
    file_id: str
    language: str = "English"
    min_words: int = 0
    max_words: int = 0
    id_token: str = ""  # Firebase Auth Token (optional — bypassed in dev mode)

class TranslateRequest(BaseModel):
    captions: List[Dict[str, Any]]
    target_language: str

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
async def upload_video(file: UploadFile = File(...), request: Request = None):
    try:
        # Rate limiting by IP
        if request:
            client_ip = request.client.host if request.client else "unknown"
            now_ts = time.time()
            timestamps = [t for t in _upload_rate.get(client_ip, []) if t > now_ts - UPLOAD_RATE_WINDOW]
            if len(timestamps) >= UPLOAD_RATE_LIMIT:
                return {"success": False, "error": "Too many uploads. Please wait before trying again."}
            timestamps.append(now_ts)
            if timestamps:
                _upload_rate[client_ip] = timestamps
            else:
                _upload_rate.pop(client_ip, None)  # evict empty entries

        # File type validation (uses module-level ALLOWED_EXTENSIONS constant)
        file_ext = file.filename.split('.')[-1].lower() if '.' in file.filename else ''
        if file_ext not in ALLOWED_EXTENSIONS:
            return {"success": False, "error": f"File type .{file_ext} not supported. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"}

        # File size: check Content-Length header first to reject early without reading
        content_length = int(request.headers.get('content-length', 0)) if request else 0
        if content_length > MAX_UPLOAD_BYTES:
            return {"success": False, "error": "File too large. Maximum 500MB allowed."}

        content = await file.read()
        if len(content) > MAX_UPLOAD_BYTES:
            return {"success": False, "error": "File too large. Maximum 500MB allowed."}

        file_id = str(uuid.uuid4())
        file_path = os.path.join(UPLOAD_DIR, f"{file_id}.{file_ext}")
        with open(file_path, "wb") as buffer:
            buffer.write(content)

        # Video duration check — per-plan limits
        cmd = [
            "ffprobe", "-v", "error", "-show_entries",
            "format=duration", "-of",
            "default=noprint_wrappers=1:nokey=1", file_path
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0:
            duration = float(result.stdout.strip() or 0)
            # Default max 180s (3 min); free/starter users get 120s
            max_seconds = 180
            if duration > max_seconds:
                os.remove(file_path)
                return {"success": False, "error": f"Video is {duration:.0f}s. Maximum allowed is {max_seconds // 60} minutes."}

        return {"success": True, "file_id": file_id, "raw_url": f"/uploads/{file_id}.{file_ext}"}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/api/process")
async def process_video(req: ProcessRequest):
    # DEV_MODE bypass only — never accept mock-token on production
    is_dev_token = DEV_MODE and (not req.id_token or req.id_token == 'mock-token')
    if not is_dev_token:
        decoded_token = verify_token(req.id_token)
        if not decoded_token:
            raise HTTPException(status_code=401, detail="Authentication required")
    if not _validate_file_id(req.file_id):
        raise HTTPException(status_code=400, detail="Invalid file_id")
    input_path = _safe_find_upload(req.file_id)
    if not input_path: return {"success": False, "error": "File not found"}
    return await processor.generate_captions_only(input_path, target_language=req.language, min_words=req.min_words, max_words=req.max_words)

@app.post("/api/export")
async def export_video(req: ExportRequest):
    print(f"[Export] EXPORT STYLE RECEIVED: {req.style}")

    # 1. Authenticate user
    # DEV_MODE bypass only — never accept mock-token on production (Vulnerability 1 fix)
    is_dev_token = DEV_MODE and (not req.id_token or req.id_token == 'mock-token')
    decoded_token = verify_token(req.id_token) if req.id_token and not is_dev_token else None
    if decoded_token:
        uid = decoded_token.get('uid')
    elif is_dev_token:
        uid = "dev-local-user"
        print("[Export] No real auth token — running in dev mode")
    else:
        raise HTTPException(status_code=401, detail="Authentication required")

    # 2. Check Credits & Limits (skipped gracefully if Firestore is not configured)
    db = get_db()
    db_available = db is not None

    now = time.time()
    recent_exports = []
    credits = 999  # default unlimited if no DB
    user_data = {}
    user_ref = None

    # Per-user lock: prevents two concurrent exports from the same user racing past
    # the daily-limit check and double-spending credits. Lock is held through render
    # and deduct — same user can't start a second export until the first completes.
    _user_lock = _get_user_export_lock(uid)
    await _user_lock.acquire()
    try:
        if db_available:
            _loop = asyncio.get_running_loop()
            user_ref = db.collection('users').document(uid)
            # Firestore SDK is synchronous — offload to thread pool so the event loop
            # is not blocked during the network round-trip.
            user_doc = await _loop.run_in_executor(None, user_ref.get)

            if not user_doc.exists:
                # Auto-create user document with free tier defaults
                print(f"[Export] User {uid} not found in Firestore — auto-creating with free tier defaults.")
                default_user = {
                    'credits_remaining': 100,
                    'credits_sig': _sign_credits(uid, 100),
                    'subscription_tier': 'free',
                    'export_timestamps': [],
                    'created_at': time.time(),
                    'uid': uid,
                }
                await _loop.run_in_executor(None, lambda: user_ref.set(default_user))
                user_data = default_user
            else:
                user_data = user_doc.to_dict()

            # Vulnerability 2 fix: verify HMAC before trusting the stored value.
            # A mismatch means credits_remaining was written directly to Firestore
            # outside the backend (e.g. via Firebase client SDK).
            credits, _tampered = _verify_credits(uid, user_data)
            if _tampered:
                raise HTTPException(
                    status_code=403,
                    detail="Account integrity check failed. Please contact support."
                )
            tier = user_data.get('subscription_tier', 'free')

            # Check if paid plan has expired (time-based)
            plan_time_expired = False
            if tier and tier != 'free':
                expiry_str = user_data.get('subscription_expiry')
                if expiry_str:
                    try:
                        expiry_date = datetime.fromisoformat(expiry_str.replace('Z', '+00:00'))
                        if expiry_date < datetime.now(expiry_date.tzinfo):
                            plan_time_expired = True
                    except (ValueError, TypeError) as e:
                        print(f"[Export] Failed to parse subscription_expiry '{expiry_str}': {e}")

            # Reset expired promo users back to free tier (offloaded — avoids blocking loop)
            if user_data.get("is_promo_user") and user_data.get("promo_expires"):
                try:
                    promo_exp = date.fromisoformat(user_data["promo_expires"])
                    if date.today() > promo_exp:
                        await _loop.run_in_executor(None, lambda: user_ref.update({
                            "subscription_tier": "free",
                            "credits_remaining": 0,
                            "is_promo_user": False,
                        }))
                        credits = 0
                        tier = "free"
                        plan_time_expired = True
                except Exception as e:
                    print(f"[Export] Promo expiry check failed: {e}")

            # Block export if credits are 0 (regardless of plan type)
            if credits <= 0:
                if tier and tier != 'free' and plan_time_expired:
                    raise HTTPException(status_code=403, detail="PLAN_EXPIRED: Your plan has expired and you have no credits left. Please renew to continue exporting.")
                else:
                    raise HTTPException(status_code=403, detail="UPGRADE_REQUIRED: You have no credits remaining. Please upgrade your plan to continue exporting.")

            # Check 24-hour limit — atomic with deduct because the per-user lock is held
            export_history = user_data.get('export_timestamps', [])
            recent_exports = [ts for ts in export_history if ts >= (now - 86400)]

            if len(recent_exports) >= 5:
                raise HTTPException(status_code=429, detail="Limit reached: You can only export 5 videos per 24 hours to prevent abuse.")
        else:
            print("[Export] Firestore not available — skipping credit check (dev mode).")

        # 3. Process Video
        if not _validate_file_id(req.file_id):
            raise HTTPException(status_code=400, detail="Invalid file_id")
        input_path = _safe_find_upload(req.file_id)
        if not input_path: raise HTTPException(status_code=404, detail="Video not found")

        output_filename = f"export_{req.file_id}.mp4"
        output_path = os.path.join(EXPORT_DIR, output_filename)

        captions = [c.dict() for c in req.captions]
        if not captions or not any(c.get('text', '').strip() for c in captions):
            raise HTTPException(status_code=400, detail="No captions provided for export")

        # QUEUE SYSTEM: Wait for an available render slot via Semaphore
        # This prevents the server from crashing if 10 people click export at once.
        print(f"[Queue] Video {req.file_id} waiting in line for render slot...")
        async with render_semaphore:
            print(f"[Render] Video {req.file_id} starting render now (quality={req.quality})!")
            style_with_quality = {**req.validated_style(), 'quality': req.quality, 'fps': req.fps}
            result = await processor.burn_only(input_path, output_path, captions, style_with_quality, req.word_layouts)

        if not result['success']:
            return {"success": False, "error": result.get('error')}

        # 4. Upload to Firebase Storage (if configured)
        video_url = f"/exports/{output_filename}"
        firebase_url = None
        try:
            remote_path = f"exports/{uid}/{output_filename}"
            firebase_url = upload_to_firebase_storage(output_path, remote_path, "video/mp4")
            if firebase_url:
                video_url = firebase_url
                try:
                    os.remove(output_path)
                except Exception as e:
                    print(f"[Export] Failed to delete local export file after Firebase upload: {e}")
        except Exception as e:
            print(f"[Export] Firebase Storage upload failed, falling back to local: {e}")

        # 5. Deduct Credit & Log History on Success (only when Firestore is available)
        if db_available and user_ref is not None:
            recent_exports.append(now)

            history_item = {
                "id": req.file_id,
                "filename": output_filename,
                "url": video_url,
                "createdAt": now * 1000,
                "firebase_path": f"exports/{uid}/{output_filename}" if firebase_url else None
            }
            current_history = user_data.get('history', [])
            current_history.insert(0, history_item)
            if len(current_history) > 5:
                current_history = current_history[:5]

            _new_credits = credits - 1
            _update_payload = {
                'credits_remaining': _new_credits,
                'credits_sig': _sign_credits(uid, _new_credits),
                'export_timestamps': recent_exports,
                'history': current_history,
            }
            await _loop.run_in_executor(None, lambda: user_ref.update(_update_payload))

    finally:
        _user_lock.release()

    # Calculate expiry based on user's plan
    retention_hours = 2  # default for free tier
    if db_available and user_data:
        user_tier = user_data.get('subscription_tier', 'free')
        if user_tier in PLAN_PRICING:
            retention_hours = PLAN_PRICING[user_tier].get('export_retention_hours', 2)

    expires_at = (datetime.utcnow() + timedelta(hours=retention_hours)).isoformat() + "Z"

    return {"success": True, "video_url": video_url, "expires_at": expires_at, "retention_hours": retention_hours}

# --- RAZORPAY SUBSCRIPTION ENDPOINTS ---

@app.post("/api/create-order")
async def create_order(req: CreateOrderRequest, request: Request):
    client_ip = request.client.host if request.client else "unknown"
    if not _check_rate(_payment_rate, client_ip, PAYMENT_RATE_LIMIT):
        raise HTTPException(status_code=429, detail="Too many payment requests. Please wait before trying again.")
    # Verify User
    decoded_token = verify_token(req.id_token)
    if not decoded_token:
        raise HTTPException(status_code=401, detail="Invalid Authentication Token")

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

    currency = req.currency.upper() if req.currency else "INR"
    # Top-ups are INR only; USD only applies to subscription plans
    if plan.get('is_topup') or currency != "USD":
        amount = plan['inr_paise']
        currency = "INR"
    else:
        amount = plan.get('usd_cents', plan['inr_paise'])

    if not RAZORPAY_AVAILABLE or rzp_client is None:
        return {"success": False, "error": "Payment service unavailable. Please install razorpay package."}

    try:
        order_data = {
            "amount": amount,
            "currency": currency,
            "receipt": f"rcpt_{decoded_token.get('uid', '')[:8]}_{int(time.time())}"
        }
        order = rzp_client.order.create(data=order_data)
        return {"success": True, "order": order, "plan_id": req.plan_id, "key_id": RAZORPAY_KEY_ID}
    except Exception as e:
        print(f"Razorpay Order Error: {e}")
        return {"success": False, "error": str(e)}

@app.post("/api/verify-payment")
async def verify_payment(req: VerifyPaymentRequest, request: Request):
    client_ip = request.client.host if request.client else "unknown"
    if not _check_rate(_payment_rate, client_ip, PAYMENT_RATE_LIMIT):
        raise HTTPException(status_code=429, detail="Too many payment requests. Please wait before trying again.")
    if not RAZORPAY_AVAILABLE or rzp_client is None:
        raise HTTPException(status_code=503, detail="Payment service unavailable")

    # Verify User
    decoded_token = verify_token(req.id_token)
    if not decoded_token:
        raise HTTPException(status_code=401, detail="Invalid Authentication Token")
    uid = decoded_token.get('uid')

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

    # Resolve plan from echoed plan_id (most reliable) then fall back to amount matching
    plan_config = PLAN_PRICING.get(req.plan_id) if req.plan_id else None

    if not plan_config:
        # Fallback: fetch payment and match by amount
        try:
            payment = rzp_client.payment.fetch(req.razorpay_payment_id)
            amount_paid_minor = payment.get('amount', 0)
            currency_paid = payment.get('currency', 'INR')
        except Exception:
            amount_paid_minor = 9900
            currency_paid = 'INR'

        for plan_key, p in PLAN_PRICING.items():
            if currency_paid == 'USD' and amount_paid_minor == p.get('usd_cents'):
                plan_config = p; req.plan_id = plan_key; break
            elif currency_paid == 'INR' and amount_paid_minor == p.get('inr_paise'):
                plan_config = p; req.plan_id = plan_key; break

        if not plan_config:
            # Last-resort fallback by INR paise
            amount_inr = amount_paid_minor / 100
            req.plan_id = 'pro' if amount_inr >= 399 else ('creator' if amount_inr >= 199 else 'starter')
            plan_config = PLAN_PRICING[req.plan_id]

    is_topup = plan_config.get('is_topup', False)
    credits_to_add = plan_config['credits']

    # Update Database
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database not initialized")

    _vp_loop = asyncio.get_running_loop()
    user_ref = db.collection('users').document(uid)
    user_doc = await _vp_loop.run_in_executor(None, user_ref.get)
    user_data = user_doc.to_dict() if user_doc.exists else {}
    # Verify before using — if credits were tampered via direct Firestore write,
    # use 0 as the base so the attacker doesn't keep their inflated value.
    # The payment is still processed normally (they paid legitimately).
    current_credits, _credits_tampered = _verify_credits(uid, user_data)
    if _credits_tampered:
        print(f"[Security] verify_payment: tampered credits detected for uid={uid}, resetting base to 0")
        current_credits = 0
    current_topups = user_data.get('topups_this_cycle', 0)

    now_utc = datetime.utcnow()
    cycle_start = now_utc.isoformat() + "Z"

    if is_topup:
        # Top-up: add credits only — do not touch tier or expiry
        base_tier = user_data.get('subscription_tier', 'free').replace('_yearly', '')
        if base_tier not in ['starter', 'creator', 'pro']:
            raise HTTPException(status_code=403, detail="UPGRADE_REQUIRED: Top-ups available for paid plans only.")
        expected_topup = f"topup_{base_tier}"
        if req.plan_id != expected_topup:
            raise HTTPException(status_code=403, detail="This top-up is not available for your current plan.")

        if not user_doc.exists:
            raise HTTPException(status_code=404, detail="User not found. Purchase a plan first.")

        # Use a batch write so both the credit update and the payment record
        # are committed atomically — a crash between the two can't leave the
        # user with extra credits but no audit trail.
        _topup_new_credits = current_credits + credits_to_add
        _topup_batch = db.batch()
        _topup_batch.update(user_ref, {
            'credits_remaining': _topup_new_credits,
            'credits_sig': _sign_credits(uid, _topup_new_credits),
            'topups_this_cycle': current_topups + 1,
        })
        _topup_batch.set(
            user_ref.collection('payments').document(req.razorpay_payment_id),
            {
                'payment_id': req.razorpay_payment_id,
                'order_id': req.razorpay_order_id,
                'amount': plan_config['inr_paise'],
                'currency': 'INR',
                'status': 'captured',
                'plan': req.plan_id,
                'credits_added': credits_to_add,
                'type': 'topup',
                'timestamp': cycle_start,
            }
        )
        await _vp_loop.run_in_executor(None, _topup_batch.commit)

        return {"success": True, "credits_added": credits_to_add, "type": "topup"}

    # Subscription plan: update tier + expiry + credits
    tier = req.plan_id
    days_to_add = plan_config['days']
    cycle_end = (now_utc + timedelta(days=days_to_add)).isoformat() + "Z"

    # Use a batch write so the subscription update and payment record are
    # committed atomically — prevents credits being granted with no audit trail
    # if the process crashes between the two writes.
    _sub_new_credits = current_credits + credits_to_add
    _sub_batch = db.batch()
    if user_doc.exists:
        _sub_batch.update(user_ref, {
            'credits_remaining': _sub_new_credits,
            'credits_sig': _sign_credits(uid, _sub_new_credits),
            'subscription_tier': tier,
            'billing_cycle_start': cycle_start,
            'billing_cycle_end': cycle_end,
            'subscription_expiry': cycle_end,
            'topups_this_cycle': 0,  # reset on new billing cycle
        })
    else:
        _sub_batch.set(user_ref, {
            'uid': uid,
            'credits_remaining': credits_to_add,
            'credits_sig': _sign_credits(uid, credits_to_add),
            'subscription_tier': tier,
            'billing_cycle_start': cycle_start,
            'billing_cycle_end': cycle_end,
            'subscription_expiry': cycle_end,
            'topups_this_cycle': 0,
            'created_at': time.time(),
        })
    _sub_batch.set(
        user_ref.collection('payments').document(req.razorpay_payment_id),
        {
            'payment_id': req.razorpay_payment_id,
            'order_id': req.razorpay_order_id,
            'amount': plan_config.get('inr_paise', 0),
            'currency': 'INR',
            'status': 'captured',
            'plan': tier,
            'credits_added': credits_to_add,
            'type': 'subscription',
            'timestamp': cycle_start,
        }
    )
    await _vp_loop.run_in_executor(None, _sub_batch.commit)

    return {"success": True, "credits_added": credits_to_add, "billing_cycle_end": cycle_end, "type": "subscription"}


class RedeemPromoRequest(BaseModel):
    id_token: str
    code: str

@app.post("/api/redeem-promo")
async def redeem_promo(req: RedeemPromoRequest, request: Request):
    client_ip = request.client.host if request.client else "unknown"
    if not _check_rate(_promo_rate, client_ip, PROMO_RATE_LIMIT):
        raise HTTPException(status_code=429, detail="Too many promo code attempts. Please wait before trying again.")
    decoded = verify_token(req.id_token)
    if not decoded:
        raise HTTPException(status_code=401, detail="Unauthorized")
    uid = decoded.get('uid')

    db = get_db()
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")

    _promo_loop = asyncio.get_running_loop()
    code_upper = req.code.strip().upper()
    code_ref = db.collection("promo_codes").document(code_upper)
    code_doc = await _promo_loop.run_in_executor(None, code_ref.get)

    if not code_doc.exists:
        raise HTTPException(status_code=400, detail="Invalid or already used code")

    promo = code_doc.to_dict()
    if promo.get("is_used"):
        raise HTTPException(status_code=400, detail="Invalid or already used code")

    now = datetime.utcnow()
    expiry_date = (now + relativedelta(months=int(promo["duration_months"]))).date().isoformat()

    user_ref = db.collection("users").document(uid)
    user_doc = await _promo_loop.run_in_executor(None, user_ref.get)
    user_email = user_doc.to_dict().get("email", "") if user_doc.exists else ""

    await _promo_loop.run_in_executor(None, lambda: code_ref.update({
        "is_used": True,
        "used_by_email": user_email,
        "used_at": now.isoformat(),
    }))

    _promo_credits = int(promo["credits_per_month"])
    await _promo_loop.run_in_executor(None, lambda: user_ref.set({
        "subscription_tier": promo["plan_id"],
        "credits_remaining": _promo_credits,
        "credits_sig": _sign_credits(uid, _promo_credits),
        "billing_cycle_start": now.isoformat(),
        "billing_cycle_end": expiry_date,
        "subscription_expiry": expiry_date,
        "is_promo_user": True,
        "promo_code_used": code_upper,
        "promo_plan": promo["plan_id"],
        "promo_expires": expiry_date,
    }, merge=True))

    return {
        "success": True,
        "plan": promo["plan_id"],
        "credits": int(promo["credits_per_month"]),
        "expires": expiry_date,
    }


@app.post("/api/translate")
async def translate_captions(req: TranslateRequest):
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

        return {"success": True, "captions": result_captions}
    except Exception as e:
        print(f"Translation error: {e}")
        return {"success": False, "error": str(e)}

class DetectLanguageRequest(BaseModel):
    file_id: str
    id_token: str = ""  # Firebase Auth Token (optional — bypassed in dev mode)

@app.post("/api/detect-language")
async def detect_language(req: DetectLanguageRequest):
    # DEV_MODE bypass only — never accept mock-token on production
    is_dev_token = DEV_MODE and (not req.id_token or req.id_token == 'mock-token')
    if not is_dev_token:
        decoded_token = verify_token(req.id_token)
        if not decoded_token:
            raise HTTPException(status_code=401, detail="Authentication required")
    if not _validate_file_id(req.file_id):
        raise HTTPException(status_code=400, detail="Invalid file_id")
    input_path = _safe_find_upload(req.file_id)
    if not input_path:
        return {"success": False, "error": "File not found"}
    try:
        import tempfile
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as _tf:
            temp_path = _tf.name
        ffmpeg_result = subprocess.run([
            "ffmpeg", "-i", input_path, "-t", "30",
            "-vn", "-acodec", "mp3", "-y", temp_path
        ], capture_output=True)
        if ffmpeg_result.returncode != 0:
            raise RuntimeError(f"FFmpeg audio extraction failed: {ffmpeg_result.stderr.decode(errors='replace')[-500:]}")
        from openai import OpenAI
        client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
        with open(temp_path, "rb") as af:
            result = client.audio.transcriptions.create(
                model="whisper-1", file=af, response_format="verbose_json"
            )
        detected = getattr(result, 'language', 'english')
        try:
            if os.path.exists(temp_path):
                os.remove(temp_path)
        except Exception as _e:
            print(f"[DetectLang] Failed to delete temp audio file: {_e}")
        return {"success": True, "language": detected}
    except Exception as e:
        return {"success": False, "error": str(e)}

class DeleteFileRequest(BaseModel):
    file_id: str
    id_token: str

@app.post("/api/delete-file")
async def delete_user_file(req: DeleteFileRequest):
    decoded_token = verify_token(req.id_token)
    if not decoded_token:
        raise HTTPException(status_code=401, detail="Auth required")
    uid = decoded_token.get('uid')

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
            except Exception as e:
                print(f"[DeleteFile] Failed to remove local export file {candidate}: {e}")

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
    return {"success": True}

app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")
app.mount("/exports", StaticFiles(directory=EXPORT_DIR), name="exports")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)