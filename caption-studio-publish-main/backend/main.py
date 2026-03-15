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
import urllib.request
import json
from typing import List, Dict, Any, Optional
from processor import VideoProcessor
import asyncio
import time
import subprocess
import json
import razorpay
import hmac
import hashlib
from fastapi import Request
from firebase_admin_setup import verify_token, get_db
from apscheduler.schedulers.asyncio import AsyncIOScheduler
import math

app = FastAPI()

# Initialize Razorpay Client (Keys will be read from environment variables)
RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "test_key")
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "test_secret")
rzp_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))


# Semaphore to limit concurrent renders to 2. This creates a queue invisible to the user!
render_semaphore = asyncio.Semaphore(2)

# Global APScheduler reference
scheduler = AsyncIOScheduler()

async def advanced_janitor_job():
    """Advanced background task to cleanup files based on specific retention rules."""
    now = time.time()
    
    # Rules
    # 1. exports (.mp4): 90 mins (5400s)
    # 2. Uploads/Active projects (.mp4, .m4a): 3 hours inactivity (10800s)
    # 3. SRT files (.srt): 24 hours (86400s)
    
    deleted_count = 0
    
    for d in [UPLOAD_DIR, EXPORT_DIR]:
        if not os.path.exists(d): continue
        for f in os.listdir(d):
            filepath = os.path.join(d, f)
            if not os.path.isfile(filepath): continue
            
            try:
                stat = os.stat(filepath)
                # Use max of modified or accessed time to track "inactivity"
                last_active = max(stat.st_mtime, stat.st_atime)
                age = now - last_active
                
                deleted = False
                if f.endswith('.srt'):
                    if age > 86400: # 24 hrs
                        os.remove(filepath)
                        deleted = True
                elif d == EXPORT_DIR and f.endswith('.mp4'):
                    if age > 5400: # 90 mins
                        os.remove(filepath)
                        deleted = True
                elif d == UPLOAD_DIR:
                    if age > 10800: # 3 hrs
                        os.remove(filepath)
                        deleted = True
                        
                if deleted:
                    deleted_count += 1
                    print(f"[Janitor] Janitor deleted: {f} (Age: {math.floor(age/60)} mins)")
            except Exception as e:
                print(f"Janitor error processing {f}: {e}")
                
    if deleted_count > 0:
        print(f"[Janitor] Janitor finished: Cleaned up {deleted_count} files.")

@app.on_event("startup")
async def startup_event():
    # Start the advanced APScheduler background cleanup task checking every 15 minutes
    scheduler.add_job(advanced_janitor_job, 'interval', minutes=15)
    scheduler.start()
    print("[Janitor] APScheduler Advanced Janitor started (runs every 15 mins).")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

class ExportRequest(BaseModel):
    file_id: str
    captions: List[CaptionItem]
    # Critical: Accept arbitrary dictionary for styles
    style: Dict[str, Any] = {}
    word_layouts: Dict[str, Any] = {}
    id_token: str # Firebase Auth Token required for deducting credits

class CreateOrderRequest(BaseModel):
    plan_id: str
    id_token: str

class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    id_token: str

class ProcessRequest(BaseModel):
    file_id: str
    language: str = "English"
    min_words: int = 0
    max_words: int = 0

class TranslateRequest(BaseModel):
    captions: List[Dict[str, Any]]
    target_language: str

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
async def upload_video(file: UploadFile = File(...)):
    try:
        file_id = str(uuid.uuid4())
        file_ext = file.filename.split('.')[-1]
        file_path = os.path.join(UPLOAD_DIR, f"{file_id}.{file_ext}")
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Hard limit check: Get video duration
        cmd = [
            "ffprobe", "-v", "error", "-show_entries",
            "format=duration", "-of",
            "default=noprint_wrappers=1:nokey=1", file_path
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0:
            duration = float(result.stdout.strip() or 0)
            if duration > 90:
                os.remove(file_path) # Delete the file to save space
                return {"success": False, "error": f"Video is too long ({duration:.1f}s). Maximum allowed is 90 seconds."}
                
        return {"success": True, "file_id": file_id, "raw_url": f"/uploads/{file_id}.{file_ext}"}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/api/process")
async def process_video(req: ProcessRequest):
    input_path = None
    for f in os.listdir(UPLOAD_DIR):
        if f.startswith(req.file_id):
            input_path = os.path.join(UPLOAD_DIR, f)
            break
    if not input_path: return {"success": False, "error": "File not found"}
    return await processor.generate_captions_only(input_path, target_language=req.language, min_words=req.min_words, max_words=req.max_words)

@app.post("/api/export")
async def export_video(req: ExportRequest):
    print(f"[Export] EXPORT STYLE RECEIVED: {req.style}")
    
    # Bypass auth for debugging
    uid = "test-debug-user"

    # 2. Check Credits & Limits
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    user_ref = db.collection('users').document(uid)
    user_doc = user_ref.get()
    
    if not user_doc.exists:
        # Auto-create user document with free tier defaults
        print(f"[Export] User {uid} not found in Firestore — auto-creating with free tier defaults.")
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
        user_data = user_doc.to_dict()
        
    credits = user_data.get('credits_remaining', 0)
    tier = user_data.get('subscription_tier', 'free')
    
    # Check if paid plan has expired (time-based)
    plan_time_expired = False
    if tier and tier != 'free':
        expiry_str = user_data.get('subscription_expiry')
        if expiry_str:
            from datetime import datetime
            try:
                expiry_date = datetime.fromisoformat(expiry_str.replace('Z', '+00:00'))
                if expiry_date < datetime.now(expiry_date.tzinfo):
                    plan_time_expired = True
            except Exception:
                pass
    
    # Block export if credits are 0 (regardless of plan type)
    if credits <= 0:
        if tier and tier != 'free' and plan_time_expired:
            raise HTTPException(status_code=403, detail="PLAN_EXPIRED: Your plan has expired and you have no credits left. Please renew to continue exporting.")
        else:
            raise HTTPException(status_code=403, detail="UPGRADE_REQUIRED: You have no credits remaining. Please upgrade your plan to continue exporting.")
        
    # Check 24-hour limit (max 5 exports)
    now = time.time()
    export_history = user_data.get('export_timestamps', [])
    # Filter only timestamps within the last 24 hours
    recent_exports = [ts for ts in export_history if ts > (now - 86400)]
    
    if len(recent_exports) >= 5:
        raise HTTPException(status_code=429, detail="Limit reached: You can only export 5 videos per 24 hours to prevent abuse.")

    # 3. Process Video
    input_path = None
    for f in os.listdir(UPLOAD_DIR):
        if f.startswith(req.file_id):
            input_path = os.path.join(UPLOAD_DIR, f)
            break
    if not input_path: raise HTTPException(status_code=404, detail="Video not found")

    output_filename = f"export_{req.file_id}.mp4"
    output_path = os.path.join(EXPORT_DIR, output_filename)

    captions = [c.dict() for c in req.captions]
    
    # QUEUE SYSTEM: Wait for an available render slot via Semaphore 
    # This prevents the server from crashing if 10 people click export at once.
    print(f"[Queue] Video {req.file_id} waiting in line for render slot...")
    async with render_semaphore:
        print(f"[Render] Video {req.file_id} starting render now!")
        result = await processor.burn_only(input_path, output_path, captions, req.style, req.word_layouts)

    if not result['success']: return {"success": False, "error": result.get('error')}
    
    # 4. Deduct Credit & Log History on Success
    recent_exports.append(now)
    
    # Append to history for the dashboard history tab
    history_item = {
        "id": req.file_id,
        "filename": output_filename,
        "url": f"/exports/{output_filename}",
        "createdAt": now * 1000
    }
    current_history = user_data.get('history', [])
    current_history.insert(0, history_item)
    if len(current_history) > 5:
        current_history = current_history[:5] # Keep last 5

    user_ref.update({
        'credits_remaining': credits - 1,
        'export_timestamps': recent_exports,
        'history': current_history
    })

    return {"success": True, "video_url": f"/exports/{output_filename}"}

# --- RAZORPAY SUBSCRIPTION ENDPOINTS ---

@app.post("/api/create-order")
async def create_order(req: CreateOrderRequest):
    # Verify User
    decoded_token = verify_token(req.id_token)
    if not decoded_token:
        raise HTTPException(status_code=401, detail="Invalid Authentication Token")
        
    amount = 9900 # ₹99 in paise (Plan A defaults)
    plan_name = "weekly"
    
    if req.plan_id == "monthly_pro":
        amount = 19900 # ₹199 in paise (Plan B)
        plan_name = "monthly"
    elif req.plan_id == "yearly_pro":
        amount = 190000 # ₹1900 in paise
        plan_name = "yearly"
    elif req.plan_id == "topup_5":
        amount = 4900
        plan_name = "topup_5"
    elif req.plan_id == "topup_10":
        amount = 7500
        plan_name = "topup_10"
    elif req.plan_id == "topup_25":
        amount = 14900
        plan_name = "topup_25"

    try:
        order_data = {
            "amount": amount,
            "currency": "INR",
            "receipt": f"rcpt_{decoded_token.get('uid', '')[:8]}_{int(time.time())}"
        }
        order = rzp_client.order.create(data=order_data)
        return {"success": True, "order": order, "plan_name": plan_name, "key_id": RAZORPAY_KEY_ID}
    except Exception as e:
        print(f"Razorpay Order Error: {e}")
        return {"success": False, "error": str(e)}

@app.post("/api/verify-payment")
async def verify_payment(req: VerifyPaymentRequest):
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

    # Fetch Payment Details to know the amount (to assign credits)
    try:
        payment = rzp_client.payment.fetch(req.razorpay_payment_id)
        amount_paid = payment.get('amount', 0) / 100 # convert paise to INR
    except:
        amount_paid = 99
        
    credits_to_add = 12
    tier = 'weekly'
    is_topup = False

    if amount_paid == 49:
        credits_to_add = 5
        tier = 'topup_5'
        is_topup = True
    elif amount_paid == 75:
        credits_to_add = 10
        tier = 'topup_10'
        is_topup = True
    elif amount_paid == 149:
        credits_to_add = 25
        tier = 'topup_25'
        is_topup = True
    elif amount_paid >= 1900:
        credits_to_add = 540 # 45 * 12
        tier = 'yearly'
    elif amount_paid >= 199:
        credits_to_add = 45 # Updated to 45
        tier = 'monthly'

    # Update Database
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database not initialized")
        
    user_ref = db.collection('users').document(uid)
    user_doc = user_ref.get()
    
    from datetime import datetime, timedelta
    now_utc = datetime.utcnow()
    cycle_start = now_utc.isoformat() + "Z"
    
    if user_doc.exists:
        user_data = user_doc.to_dict()
        current_credits = user_data.get('credits_remaining', 0)
        current_topups = user_data.get('topups_this_cycle', 0)
        
        if is_topup:
            # ONLY add credits and increment topup count. Do not touch expiry dates.
            cycle_end = user_data.get('billing_cycle_end')
            user_ref.update({
                'credits_remaining': current_credits + credits_to_add,
                'topups_this_cycle': current_topups + 1
            })
        else:
            # Full Subscription: Update timers and rollover credits
            days_to_add = 365 if tier == 'yearly' else (30 if tier == 'monthly' else 7)
            cycle_end = (now_utc + timedelta(days=days_to_add)).isoformat() + "Z"
            
            user_ref.update({
                'credits_remaining': current_credits + credits_to_add,
                'subscription_tier': tier,
                'billing_cycle_start': cycle_start,
                'billing_cycle_end': cycle_end,
                'subscription_expiry': cycle_end, # keeping backward compatibility
                'topups_this_cycle': 0 # Reset top-ups on new cycle
            })
        
        # Save Transaction to payments subcollection
        try:
            payment_ref = user_ref.collection('payments').document(req.razorpay_payment_id)
            payment_ref.set({
                'payment_id': req.razorpay_payment_id,
                'order_id': req.razorpay_order_id,
                'amount': amount_paid,
                'currency': 'INR',
                'status': 'captured',
                'plan': tier,
                'credits_added': credits_to_add,
                'timestamp': cycle_start
            })
        except Exception as e:
            print(f"Failed to record payment history: {e}")
    
    return {"success": True, "credits_added": credits_to_add, "billing_cycle_end": cycle_end}

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

app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")
app.mount("/exports", StaticFiles(directory=EXPORT_DIR), name="exports")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)