import os
import json
import hashlib
import math
import threading
import time
from datetime import datetime, timedelta, timezone
import firebase_admin
from firebase_admin import credentials, auth, firestore
from google.cloud import storage as gcs_storage
from google.auth import default as google_auth_default
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.api_core.exceptions import NotFound
try:
    from .media_storage import (
        bucket_ready as s3_bucket_ready,
        delete_file as delete_s3_file,
        download_file as download_s3_file,
        is_configured as s3_is_configured,
        iter_objects as iter_s3_objects,
        object_exists as s3_object_exists,
        signed_download_url as s3_signed_download_url,
        upload_file as upload_s3_file,
        abort_multipart_upload as abort_s3_multipart_upload,
        complete_multipart_upload as complete_s3_multipart_upload,
        create_multipart_upload as create_s3_multipart_upload,
        list_uploaded_parts as list_s3_uploaded_parts,
        object_metadata as s3_object_metadata,
        object_size as s3_object_size,
        presign_upload_part as presign_s3_upload_part,
    )
except ImportError:  # Direct execution from the backend working directory.
    from media_storage import (
        bucket_ready as s3_bucket_ready,
        delete_file as delete_s3_file,
        download_file as download_s3_file,
        is_configured as s3_is_configured,
        iter_objects as iter_s3_objects,
        object_exists as s3_object_exists,
        signed_download_url as s3_signed_download_url,
        upload_file as upload_s3_file,
        abort_multipart_upload as abort_s3_multipart_upload,
        complete_multipart_upload as complete_s3_multipart_upload,
        create_multipart_upload as create_s3_multipart_upload,
        list_uploaded_parts as list_s3_uploaded_parts,
        object_metadata as s3_object_metadata,
        object_size as s3_object_size,
        presign_upload_part as presign_s3_upload_part,
    )
try:
    from firebase_admin import storage as fb_storage
except ImportError:
    fb_storage = None

STORAGE_BUCKET = os.environ.get('FIREBASE_STORAGE_BUCKET', '')
GCS_MEDIA_BUCKET = os.environ.get('GCS_MEDIA_BUCKET', '').strip()
GCS_SIGNING_SERVICE_ACCOUNT = os.environ.get('GCS_SIGNING_SERVICE_ACCOUNT', '').strip()
ALLOW_FIREBASE_SERVICE_ACCOUNT_PATH = os.environ.get('ALLOW_FIREBASE_SERVICE_ACCOUNT_PATH', '0') == '1'
IS_TEST_ENV = (os.environ.get("APP_ENV") or os.environ.get("ENV") or "").strip().lower() in {"test", "testing"}
# Browser-direct uploads to S3-compatible storage (Cloudflare R2) use multipart
# parts of one fixed size; R2 requires every part except the last to match.
S3_UPLOAD_PROTOCOL = "s3_multipart"
S3_UPLOAD_PART_BYTES = 8 * 1024 * 1024
S3_UPLOAD_PART_URL_SECONDS = 3600
S3_MAX_PARTS_PER_SIGN_REQUEST = 32

def init_firebase():
    # Only initialize if it hasn't been initialized yet
    if not firebase_admin._apps:
        bucket_name = STORAGE_BUCKET or None
        opts = {}
        if bucket_name:
            opts['storageBucket'] = bucket_name

        # Try 1: Load from FIREBASE_SERVICE_ACCOUNT_JSON env var
        service_account_str = os.environ.get('FIREBASE_SERVICE_ACCOUNT_JSON')
        if service_account_str:
            try:
                cred_dict = json.loads(service_account_str)
                cred = credentials.Certificate(cred_dict)
                firebase_admin.initialize_app(cred, opts)
                print(f"Firebase Admin initialized from env var. Bucket: {bucket_name or 'none'}")
                return
            except Exception as e:
                print(f"Failed to initialize from env var: {e}")

        # Try 2 (opt-in): explicit credentials path from env.
        # Disabled by default to avoid local secret-file runtime dependency.
        service_account_path = os.environ.get('FIREBASE_SERVICE_ACCOUNT_PATH', '').strip()
        if service_account_path:
            if not ALLOW_FIREBASE_SERVICE_ACCOUNT_PATH:
                print("Ignored FIREBASE_SERVICE_ACCOUNT_PATH because ALLOW_FIREBASE_SERVICE_ACCOUNT_PATH is not enabled.")
            else:
                try:
                    cred = credentials.Certificate(service_account_path)
                    firebase_admin.initialize_app(cred, opts)
                    print(f"Firebase Admin initialized from FIREBASE_SERVICE_ACCOUNT_PATH. Bucket: {bucket_name or 'none'}")
                    return
                except Exception as e:
                    print(f"Failed to initialize from FIREBASE_SERVICE_ACCOUNT_PATH: {e}")

        if not IS_TEST_ENV:
            print("Warning: No Firebase credentials found in env. Set FIREBASE_SERVICE_ACCOUNT_JSON.")

# Initialize on import
init_firebase()

# check_revoked=True costs a Firebase Auth network call per request. Export
# status is polled every few seconds by every waiting customer, so a verified
# token is reused briefly. A revoked or disabled account is rejected within
# this window, and never after the token's own expiry.
TOKEN_CACHE_SECONDS = max(0, int(os.environ.get("FIREBASE_TOKEN_CACHE_SECONDS", "60") or 0))
TOKEN_CACHE_MAX_ENTRIES = 10_000
_token_cache: dict = {}
_token_cache_lock = threading.Lock()


def _cached_token(cache_key: str):
    now = time.monotonic()
    with _token_cache_lock:
        entry = _token_cache.get(cache_key)
        if entry is None:
            return None
        if entry[0] <= now:
            _token_cache.pop(cache_key, None)
            return None
        return dict(entry[1])


def _remember_token(cache_key: str, decoded_token: dict):
    lifetime = TOKEN_CACHE_SECONDS
    expires_at = decoded_token.get("exp")
    if isinstance(expires_at, (int, float)):
        lifetime = min(lifetime, expires_at - time.time())
    if lifetime <= 0:
        return
    now = time.monotonic()
    with _token_cache_lock:
        if len(_token_cache) >= TOKEN_CACHE_MAX_ENTRIES:
            for key in [key for key, entry in _token_cache.items() if entry[0] <= now]:
                _token_cache.pop(key, None)
            while len(_token_cache) >= TOKEN_CACHE_MAX_ENTRIES:
                _token_cache.pop(next(iter(_token_cache)))
        _token_cache[cache_key] = (now + lifetime, dict(decoded_token))


def verify_token(id_token: str):
    if IS_TEST_ENV and not firebase_admin._apps:
        return None
    cache_key = hashlib.sha256(id_token.encode("utf-8")).hexdigest() if id_token and TOKEN_CACHE_SECONDS else ""
    if cache_key:
        cached = _cached_token(cache_key)
        if cached is not None:
            return cached
    try:
        # check_revoked=True prevents a stolen token from remaining usable after
        # the account owner signs out all sessions or an administrator revokes it.
        decoded_token = auth.verify_id_token(id_token, check_revoked=True)
        if cache_key and isinstance(decoded_token, dict):
            _remember_token(cache_key, decoded_token)
        return decoded_token
    except Exception as e:
        print(f"Token verification failed: {e}")
        return None

def get_db():
    if IS_TEST_ENV and not firebase_admin._apps:
        return None
    try:
        return firestore.client()
    except Exception as e:
        print(f"Firestore not available: {e}")
        return None

def storage_backend_ready():
    if s3_is_configured():
        return s3_bucket_ready()
    bucket = get_storage_bucket()
    return bool(bucket and bucket.exists(timeout=5))


def get_storage_bucket():
    if IS_TEST_ENV and not firebase_admin._apps:
        return None
    try:
        if GCS_MEDIA_BUCKET:
            return gcs_storage.Client().bucket(GCS_MEDIA_BUCKET)
        if fb_storage is None:
            return None
        return fb_storage.bucket()
    except Exception as e:
        print(f"Firebase Storage not available: {e}")
        return None


def _signed_gcs_download_url(blob, expiration):
    """Use IAM signBlob on VMs, which have token-only GCE credentials."""
    if not GCS_SIGNING_SERVICE_ACCOUNT:
        return blob.generate_signed_url(expiration=expiration, version="v4")
    credentials, _ = google_auth_default(
        scopes=["https://www.googleapis.com/auth/cloud-platform"]
    )
    credentials.refresh(GoogleAuthRequest())
    return blob.generate_signed_url(
        expiration=expiration,
        version="v4",
        service_account_email=GCS_SIGNING_SERVICE_ACCOUNT,
        access_token=credentials.token,
    )


def create_resumable_source_upload(uid: str, file_id: str, extension: str,
                                   content_type: str, size_bytes: int, origin: str = "",
                                   filename: str = "", last_modified: int = 0):
    """Create a short-lived direct-upload session without proxying media through the API.

    Google Cloud Storage gets a resumable session URI; S3-compatible storage
    (Cloudflare R2) gets a multipart upload whose parts the browser PUTs with
    presigned URLs from sign_resumable_upload_parts().
    """
    safe_uid = str(uid or "").strip()
    safe_file_id = str(file_id or "").strip()
    safe_ext = str(extension or "").strip().lower().lstrip(".")
    if (not safe_uid or not safe_file_id or not safe_ext or not safe_ext.isalnum()
            or "/" in safe_uid or "\\" in safe_uid or "/" in safe_file_id or "\\" in safe_file_id):
        return None
    if s3_is_configured():
        return _create_s3_source_upload(
            safe_uid, safe_file_id, safe_ext, content_type, size_bytes, filename, last_modified,
        )
    bucket = get_storage_bucket()
    db = get_db()
    if not bucket or not db:
        return None
    remote_path = f"uploads/{safe_uid}/{safe_file_id}.{safe_ext}"
    expires_at = datetime.now(timezone.utc) + timedelta(hours=6)
    blob = bucket.blob(remote_path)
    blob.metadata = {
        "owner_uid": safe_uid,
        "file_id": safe_file_id,
        "delete_at_epoch": str(int(expires_at.timestamp())),
        "upload_state": "pending_scan",
    }
    session_url = blob.create_resumable_upload_session(
        content_type=content_type or "application/octet-stream",
        size=max(1, int(size_bytes)),
        origin=origin or None,
        timeout=15,
    )
    db.collection("direct_upload_intents").document(safe_file_id).set({
        "uid": safe_uid,
        "file_id": safe_file_id,
        "remote_path": remote_path,
        "extension": safe_ext,
        "content_type": content_type or "application/octet-stream",
        "size_bytes": int(size_bytes),
        "filename": str(filename or "")[:255],
        "last_modified": max(0, int(last_modified or 0)),
        # This bearer session is service-only state. The browser persists only
        # a non-secret file fingerprint and must authenticate to retrieve it.
        "session_url": session_url,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc),
    })
    return {"session_url": session_url, "remote_path": remote_path, "expires_at": expires_at.isoformat()}


def _s3_part_count(size_bytes: int) -> int:
    return max(1, math.ceil(int(size_bytes) / S3_UPLOAD_PART_BYTES))


def _s3_part_length(size_bytes: int, part_number: int) -> int:
    start = (int(part_number) - 1) * S3_UPLOAD_PART_BYTES
    return max(0, min(S3_UPLOAD_PART_BYTES, int(size_bytes) - start))


def _create_s3_source_upload(uid, file_id, extension, content_type, size_bytes, filename, last_modified):
    db = get_db()
    if not db:
        return None
    remote_path = f"uploads/{uid}/{file_id}.{extension}"
    expires_at = datetime.now(timezone.utc) + timedelta(hours=6)
    upload_id = create_s3_multipart_upload(
        remote_path,
        content_type or "application/octet-stream",
        {"owner_uid": uid, "file_id": file_id, "upload_state": "pending_scan"},
    )
    part_count = _s3_part_count(size_bytes)
    db.collection("direct_upload_intents").document(file_id).set({
        "uid": uid,
        "file_id": file_id,
        "remote_path": remote_path,
        "extension": extension,
        "content_type": content_type or "application/octet-stream",
        "size_bytes": int(size_bytes),
        "filename": str(filename or "")[:255],
        "last_modified": max(0, int(last_modified or 0)),
        "upload_protocol": S3_UPLOAD_PROTOCOL,
        # The multipart upload ID is service-only state; the browser only ever
        # receives presigned part URLs for the parts it asks for.
        "upload_id": upload_id,
        "part_size": S3_UPLOAD_PART_BYTES,
        "part_count": part_count,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc),
    })
    return {
        "upload_protocol": S3_UPLOAD_PROTOCOL,
        "part_size": S3_UPLOAD_PART_BYTES,
        "part_count": part_count,
        "remote_path": remote_path,
        "expires_at": expires_at.isoformat(),
    }


def _active_owned_intent(db, uid, file_id):
    """Return (intent, expires_at) for an unexpired, unfinished intent owned by uid."""
    snapshot = db.collection("direct_upload_intents").document(str(file_id)).get()
    if not snapshot.exists:
        return None, None
    intent = snapshot.to_dict() or {}
    expires_at = intent.get("expires_at")
    if (str(intent.get("uid") or "") != str(uid or "")
            or intent.get("status") in {"cancelled", "completed"}
            or not isinstance(expires_at, datetime)
            or expires_at.replace(tzinfo=expires_at.tzinfo or timezone.utc) <= datetime.now(timezone.utc)
            or not str(intent.get("remote_path") or "").startswith(f"uploads/{uid}/")):
        return None, None
    return intent, expires_at.replace(tzinfo=expires_at.tzinfo or timezone.utc)


def sign_resumable_upload_parts(uid: str, file_id: str, part_numbers):
    """Presign PUT URLs for parts of the owner's active S3 multipart upload."""
    db = get_db()
    if not db or not s3_is_configured():
        return None
    intent, expires_at = _active_owned_intent(db, uid, file_id)
    if not intent or intent.get("upload_protocol") != S3_UPLOAD_PROTOCOL:
        return None
    part_count = int(intent.get("part_count") or 0)
    size_bytes = int(intent.get("size_bytes") or 0)
    try:
        numbers = sorted({int(number) for number in part_numbers})
    except (TypeError, ValueError):
        return None
    if (not numbers or len(numbers) > S3_MAX_PARTS_PER_SIGN_REQUEST
            or numbers[0] < 1 or numbers[-1] > part_count):
        return None
    seconds_left = int((expires_at - datetime.now(timezone.utc)).total_seconds())
    ttl = max(60, min(S3_UPLOAD_PART_URL_SECONDS, seconds_left))
    remote_path = str(intent["remote_path"])
    upload_id = str(intent.get("upload_id") or "")
    return [
        {
            "part_number": number,
            "content_length": _s3_part_length(size_bytes, number),
            "url": presign_s3_upload_part(
                remote_path, upload_id, number, _s3_part_length(size_bytes, number), ttl,
            ),
        }
        for number in numbers
    ]


def _s3_completed_parts(intent) -> dict:
    """Parts storage holds with the exact expected size, keyed by part number."""
    size_bytes = int(intent.get("size_bytes") or 0)
    parts = list_s3_uploaded_parts(str(intent["remote_path"]), str(intent.get("upload_id") or ""))
    return {
        int(part["PartNumber"]): part
        for part in parts
        if int(part.get("Size") or -1) == _s3_part_length(size_bytes, int(part["PartNumber"]))
    }


def resume_resumable_source_upload(uid: str, file_id: str, filename: str,
                                   content_type: str, size_bytes: int,
                                   last_modified: int = 0):
    """Return an active session only to its owner after exact file matching."""
    db = get_db()
    if not db:
        return None
    snapshot = db.collection("direct_upload_intents").document(str(file_id)).get()
    if not snapshot.exists:
        return None
    intent = snapshot.to_dict() or {}
    expires_at = intent.get("expires_at")
    if (str(intent.get("uid") or "") != str(uid or "")
            or intent.get("status") in {"cancelled", "completed"}
            or not isinstance(expires_at, datetime)
            or expires_at.replace(tzinfo=expires_at.tzinfo or timezone.utc) <= datetime.now(timezone.utc)):
        return None
    expected = (
        str(intent.get("filename") or ""),
        str(intent.get("content_type") or "application/octet-stream"),
        int(intent.get("size_bytes") or 0),
        int(intent.get("last_modified") or 0),
    )
    actual = (
        str(filename or "")[:255],
        str(content_type or "application/octet-stream"),
        int(size_bytes or 0),
        max(0, int(last_modified or 0)),
    )
    if expected != actual:
        return None
    if intent.get("upload_protocol") == S3_UPLOAD_PROTOCOL:
        if not s3_is_configured():
            return None
        return {
            "upload_protocol": S3_UPLOAD_PROTOCOL,
            "part_size": int(intent.get("part_size") or S3_UPLOAD_PART_BYTES),
            "part_count": int(intent.get("part_count") or 0),
            "completed_parts": sorted(_s3_completed_parts(intent)),
            "expires_at": expires_at.isoformat(),
        }
    session_url = str(intent.get("session_url") or "")
    if not session_url.startswith("https://"):
        return None
    return {"session_url": session_url, "expires_at": expires_at.isoformat()}


def _finalize_s3_source_upload(uid: str, file_id: str):
    db = get_db()
    if not db:
        return None
    intent_ref = db.collection("direct_upload_intents").document(str(file_id))
    snapshot = intent_ref.get()
    if not snapshot.exists:
        return None
    intent = snapshot.to_dict() or {}
    if (str(intent.get("uid") or "") != str(uid or "")
            or intent.get("upload_protocol") != S3_UPLOAD_PROTOCOL
            or intent.get("status") == "cancelled"):
        return None
    remote_path = str(intent.get("remote_path") or "")
    if not remote_path.startswith(f"uploads/{uid}/"):
        return None
    expected_size = int(intent.get("size_bytes") or 0)
    if expected_size <= 0:
        return None
    result = {
        "remote_path": remote_path,
        "extension": str(intent.get("extension") or ""),
        "size_bytes": expected_size,
        "upload_state": "pending_scan",
    }
    if intent.get("status") == "completed":
        # A retried completion after a lost response: the object must still match.
        return result if s3_object_size(remote_path) == expected_size else None
    intent_expiry = intent.get("expires_at")
    if (isinstance(intent_expiry, datetime)
            and intent_expiry.replace(tzinfo=intent_expiry.tzinfo or timezone.utc)
            <= datetime.now(timezone.utc)):
        return None
    completed = _s3_completed_parts(intent)
    part_count = int(intent.get("part_count") or 0)
    if part_count <= 0 or sorted(completed) != list(range(1, part_count + 1)):
        return None
    complete_s3_multipart_upload(remote_path, str(intent.get("upload_id") or ""), completed.values())
    if s3_object_size(remote_path) != expected_size:
        delete_s3_file(remote_path)
        intent_ref.delete()
        return None
    expires_at = datetime.now(timezone.utc) + timedelta(hours=6)
    schedule_id = hashlib.sha256(remote_path.encode("utf-8")).hexdigest()
    db.collection("upload_expirations").document(schedule_id).set({
        "remote_path": remote_path,
        "uid": str(uid),
        "file_id": str(file_id),
        "expire_at": expires_at,
        "created_at": datetime.now(timezone.utc),
    })
    if not _transition_direct_upload_intent(
        db, intent_ref, uid, remote_path, "completed", expires_at=expires_at,
    ):
        return None
    return result


def finalize_resumable_source_upload(uid: str, file_id: str):
    """Verify ownership and size before admitting a directly uploaded object."""
    if s3_is_configured():
        return _finalize_s3_source_upload(uid, file_id)
    bucket = get_storage_bucket()
    db = get_db()
    if not bucket or not db:
        return None
    intent_ref = db.collection("direct_upload_intents").document(str(file_id))
    intent_snapshot = intent_ref.get()
    if not intent_snapshot.exists:
        return None
    intent = intent_snapshot.to_dict() or {}
    if str(intent.get("uid") or "") != str(uid or ""):
        return None
    if intent.get("status") == "cancelled":
        return None
    intent_expiry = intent.get("expires_at")
    if (intent.get("status") != "completed" and isinstance(intent_expiry, datetime)
            and intent_expiry.replace(tzinfo=intent_expiry.tzinfo or timezone.utc)
            <= datetime.now(timezone.utc)):
        return None
    remote_path = str(intent.get("remote_path") or "")
    if not remote_path.startswith(f"uploads/{uid}/"):
        return None
    blob = bucket.blob(remote_path)
    try:
        blob.reload(timeout=15)
    except NotFound:
        return None
    expected_size = int(intent.get("size_bytes") or 0)
    actual_size = int(blob.size or 0)
    if expected_size <= 0 or actual_size != expected_size:
        blob.delete()
        intent_ref.delete()
        return None
    if intent.get("status") == "completed":
        return {
            "remote_path": remote_path,
            "extension": str(intent.get("extension") or ""),
            "size_bytes": actual_size,
            "storage_generation": str(blob.generation or ""),
            "storage_crc32c": str(blob.crc32c or ""),
            "storage_md5_hash": str(blob.md5_hash or ""),
            "upload_state": "pending_scan",
        }
    expires_at = datetime.now(timezone.utc) + timedelta(hours=6)
    blob.metadata = {
        **(blob.metadata or {}),
        "owner_uid": str(uid),
        "file_id": str(file_id),
        "delete_at_epoch": str(int(expires_at.timestamp())),
        "upload_state": "pending_scan",
    }
    blob.patch()
    schedule_id = hashlib.sha256(remote_path.encode("utf-8")).hexdigest()
    db.collection("upload_expirations").document(schedule_id).set({
        "remote_path": remote_path,
        "uid": str(uid),
        "file_id": str(file_id),
        "expire_at": expires_at,
        "created_at": datetime.now(timezone.utc),
    })
    # Keep the receipt until expiry so a lost completion response can be retried
    # without turning a valid, already-uploaded object into a 409.
    if not _transition_direct_upload_intent(
        db, intent_ref, uid, remote_path, "completed", expires_at=expires_at,
    ):
        return None
    return {
        "remote_path": remote_path,
        "extension": str(intent.get("extension") or ""),
        "size_bytes": actual_size,
        "storage_generation": str(blob.generation or ""),
        "storage_crc32c": str(blob.crc32c or ""),
        "storage_md5_hash": str(blob.md5_hash or ""),
        "upload_state": "pending_scan",
    }


def set_source_upload_state(uid: str, file_id: str, remote_path: str, state: str) -> bool:
    """Mirror the authoritative upload security state onto the GCS object."""
    safe_uid = str(uid or "").strip()
    safe_file_id = str(file_id or "").strip()
    safe_remote = str(remote_path or "").strip()
    safe_state = str(state or "").strip().lower()
    if (
        safe_state not in {"pending_scan", "clean", "rejected"}
        or not safe_uid
        or not safe_file_id
        or not safe_remote.startswith(f"uploads/{safe_uid}/{safe_file_id}.")
    ):
        return False
    if s3_is_configured():
        # Firestore remains authoritative for S3-compatible deployments. The
        # existing S3 adapter does not currently expose a metadata-patch call.
        return True
    bucket = get_storage_bucket()
    if not bucket:
        return False
    try:
        blob = bucket.blob(safe_remote)
        blob.reload(timeout=15)
        blob.metadata = {**(blob.metadata or {}), "upload_state": safe_state}
        blob.patch()
        return True
    except Exception as error:
        print(f"[Storage] Source upload state update failed: {error}")
        return False


@firestore.transactional
def _commit_direct_upload_intent_transition(transaction, intent_ref, uid, remote_path,
                                            target_status, expires_at):
    snapshot = intent_ref.get(transaction=transaction)
    if not snapshot.exists:
        return False
    intent = snapshot.to_dict() or {}
    if (str(intent.get("uid") or "") != str(uid or "")
            or str(intent.get("remote_path") or "") != remote_path):
        return False
    current_status = intent.get("status")
    if current_status == target_status:
        return True
    if current_status in {"cancelled", "completed"}:
        return False
    now = datetime.now(timezone.utc)
    update = {"status": target_status}
    if target_status == "completed":
        update.update({"completed_at": now, "expires_at": expires_at})
    else:
        update["cancelled_at"] = now
    transaction.set(intent_ref, update, merge=True)
    return True


def _transition_direct_upload_intent(db, intent_ref, uid, remote_path, target_status,
                                     expires_at=None):
    return _commit_direct_upload_intent_transition(
        db.transaction(), intent_ref, uid, remote_path, target_status, expires_at,
    )


def cancel_resumable_source_upload(uid: str, file_id: str) -> bool:
    """Revoke an unfinished intent; its session URI should be deleted by the browser."""
    db = get_db()
    if not db:
        return False
    intent_ref = db.collection("direct_upload_intents").document(str(file_id))
    snapshot = intent_ref.get()
    if not snapshot.exists:
        return False
    intent = snapshot.to_dict() or {}
    if str(intent.get("uid") or "") != str(uid or "") or intent.get("status") == "completed":
        return False
    remote_path = str(intent.get("remote_path") or "")
    if not remote_path.startswith(f"uploads/{uid}/"):
        return False
    if not _transition_direct_upload_intent(db, intent_ref, uid, remote_path, "cancelled"):
        return False
    if intent.get("upload_protocol") == S3_UPLOAD_PROTOCOL and s3_is_configured():
        try:
            abort_s3_multipart_upload(remote_path, str(intent.get("upload_id") or ""))
        except Exception as error:
            # The bucket's incomplete-multipart lifecycle rule is the backstop.
            print(f"[Upload] abort multipart failed: {error}")
        return True
    # Keep the intent for the six-hour janitor: a client holding an old bearer
    # session might still finish uploading after this point. Avoid deleting an
    # object here because a concurrent completion may have already accepted it.
    return True

def upload_to_firebase_storage(
    local_path: str,
    remote_path: str,
    content_type: str = "video/mp4",
    expiration_hours: int = 24,
):
    """
    Uploads a local file to Firebase Storage.
    Returns a signed download URL valid for the specified hours, or None on failure.
    """
    safe_remote = str(remote_path or "").strip()
    if (
        not safe_remote.startswith("exports/")
        or not os.path.isfile(local_path)
        or os.path.getsize(local_path) <= 0
    ):
        return None
    if s3_is_configured():
        ttl = max(1, min(int(expiration_hours), 72))
        try:
            upload_s3_file(
                local_path,
                safe_remote,
                content_type,
                {"delete_at_epoch": str(int(time.time() + ttl * 3600))},
            )
            db = get_db()
            if db:
                schedule_id = hashlib.sha256(safe_remote.encode("utf-8")).hexdigest()
                db.collection("export_expirations").document(schedule_id).set({
                    "remote_path": safe_remote,
                    "expire_at": datetime.now(timezone.utc) + timedelta(hours=ttl),
                    "created_at": datetime.now(timezone.utc),
                })
            print(f"[Storage] Uploaded {safe_remote} to S3-compatible durable storage")
            return s3_signed_download_url(safe_remote, ttl * 3600)
        except Exception as e:
            print(f"[Storage] S3 export upload failed: {e}")
            try:
                delete_s3_file(safe_remote)
            except Exception:
                pass
            return None
    bucket = get_storage_bucket()
    if not bucket:
        return None
    try:
        blob = bucket.blob(safe_remote)
        blob.upload_from_filename(local_path, content_type=content_type)
        ttl = max(1, min(int(expiration_hours), 72))
        blob.metadata = {
            **(blob.metadata or {}),
            "delete_at_epoch": str(int(time.time() + ttl * 3600)),
        }
        blob.patch()
        db = get_db()
        if not db:
            blob.delete()
            print("[Storage] Upload rolled back because expiration scheduling is unavailable")
            return None
        schedule_id = hashlib.sha256(safe_remote.encode("utf-8")).hexdigest()
        try:
            db.collection("export_expirations").document(schedule_id).set({
                "remote_path": safe_remote,
                "expire_at": datetime.now(timezone.utc) + timedelta(hours=ttl),
                "created_at": datetime.now(timezone.utc),
            })
        except Exception:
            blob.delete()
            raise
        url = _signed_gcs_download_url(blob, timedelta(hours=ttl))
        print(f"[Storage] Uploaded {safe_remote} to Firebase Storage")
        return url
    except Exception as e:
        print(f"[Storage] Upload failed: {e}")
        return None


def upload_source_media(
    local_path: str,
    uid: str,
    file_id: str,
    extension: str,
    expiration_hours: int = 6,
):
    """Persist an uploaded source so API and worker instances share the same bytes."""
    db = get_db()
    safe_uid = str(uid or "").strip()
    safe_file_id = str(file_id or "").strip()
    safe_ext = str(extension or "").strip().lower().lstrip(".")
    if (
        not safe_uid or not safe_file_id or not safe_ext
        or "/" in safe_uid or "\\" in safe_uid
        or "/" in safe_file_id or "\\" in safe_file_id
        or not safe_ext.isalnum()
    ):
        return None
    remote_path = f"uploads/{safe_uid}/{safe_file_id}.{safe_ext}"
    ttl = max(1, min(int(expiration_hours), 24))
    expires_at = datetime.now(timezone.utc) + timedelta(hours=ttl)
    if s3_is_configured():
        try:
            upload_s3_file(
                local_path,
                remote_path,
                metadata={
                    "owner_uid": safe_uid,
                    "file_id": safe_file_id,
                    "delete_at_epoch": str(int(expires_at.timestamp())),
                },
            )
            if db:
                schedule_id = hashlib.sha256(remote_path.encode("utf-8")).hexdigest()
                db.collection("upload_expirations").document(schedule_id).set({
                    "remote_path": remote_path,
                    "uid": safe_uid,
                    "file_id": safe_file_id,
                    "expire_at": expires_at,
                    "created_at": datetime.now(timezone.utc),
                })
            print(f"[Storage] Uploaded {remote_path} to S3-compatible durable storage")
            return remote_path
        except Exception as e:
            print(f"[Storage] S3 source upload failed: {e}")
            try:
                delete_s3_file(remote_path)
            except Exception:
                pass
            return None
    bucket = get_storage_bucket()
    if not bucket or not db:
        return None
    blob = bucket.blob(remote_path)
    try:
        blob.upload_from_filename(local_path)
        blob.metadata = {
            **(blob.metadata or {}),
            "owner_uid": safe_uid,
            "file_id": safe_file_id,
            "delete_at_epoch": str(int(expires_at.timestamp())),
        }
        blob.patch()
        schedule_id = hashlib.sha256(remote_path.encode("utf-8")).hexdigest()
        db.collection("upload_expirations").document(schedule_id).set({
            "remote_path": remote_path,
            "uid": safe_uid,
            "file_id": safe_file_id,
            "expire_at": expires_at,
            "created_at": datetime.now(timezone.utc),
        })
        return remote_path
    except Exception as e:
        print(f"[Storage] Source upload failed: {e}")
        try:
            blob.delete()
        except Exception:
            pass
        return None


def download_from_firebase_storage(remote_path: str, local_path: str):
    safe_remote = str(remote_path or "")
    if not safe_remote.startswith("uploads/"):
        return False
    if s3_is_configured():
        try:
            return download_s3_file(safe_remote, local_path)
        except Exception as e:
            print(f"[Storage] S3 source download failed: {e}")
            return False
    bucket = get_storage_bucket()
    if not bucket:
        return False
    try:
        bucket.blob(safe_remote).download_to_filename(local_path)
        return os.path.isfile(local_path) and os.path.getsize(local_path) > 0
    except Exception as e:
        print(f"[Storage] Source download failed: {e}")
        return False


def _render_cache_path(uid: str, cache_key: str) -> str:
    safe_uid = str(uid or "").strip()
    safe_key = str(cache_key or "").strip().lower()
    if (
        not safe_uid
        or "/" in safe_uid
        or "\\" in safe_uid
        or len(safe_key) != 64
        or any(character not in "0123456789abcdef" for character in safe_key)
    ):
        return ""
    return f"render-cache/{safe_uid}/{safe_key}.mp4"


def download_render_cache(uid: str, cache_key: str, local_path: str) -> bool:
    """Restore a short-lived deterministic render cached by another worker."""
    remote_path = _render_cache_path(uid, cache_key)
    if not remote_path:
        return False
    if s3_is_configured():
        try:
            metadata = s3_object_metadata(remote_path)
            if metadata is None:
                return False
            # R2 does not act on this metadata; expire the entry here, and the
            # bucket's render-cache/ lifecycle rule removes anything never read.
            delete_at = int(metadata.get("delete_at_epoch") or 0)
            if delete_at and delete_at <= int(time.time()):
                delete_s3_file(remote_path)
                return False
            return bool(download_s3_file(remote_path, local_path))
        except Exception:
            return False
    bucket = get_storage_bucket()
    if not bucket:
        return False
    try:
        blob = bucket.blob(remote_path)
        blob.reload(timeout=10)
        delete_at = int((blob.metadata or {}).get("delete_at_epoch") or 0)
        if delete_at and delete_at <= int(time.time()):
            blob.delete()
            return False
        blob.download_to_filename(local_path)
        return os.path.isfile(local_path) and os.path.getsize(local_path) > 0
    except NotFound:
        return False
    except Exception as error:
        print(f"[Storage] Render cache download failed: {error}")
        return False


def upload_render_cache(uid: str, cache_key: str, local_path: str,
                        expiration_hours: int = 24) -> bool:
    """Persist a validated render so scale-to-zero workers can share the cache."""
    remote_path = _render_cache_path(uid, cache_key)
    if (
        not remote_path
        or not os.path.isfile(local_path)
        or os.path.getsize(local_path) <= 0
    ):
        return False
    ttl = max(1, min(int(expiration_hours), 72))
    metadata = {"delete_at_epoch": str(int(time.time() + ttl * 3600))}
    if s3_is_configured():
        try:
            upload_s3_file(local_path, remote_path, "video/mp4", metadata)
            return True
        except Exception as error:
            print(f"[Storage] S3 render cache upload failed: {error}")
            return False
    bucket = get_storage_bucket()
    if not bucket:
        return False
    try:
        blob = bucket.blob(remote_path)
        blob.upload_from_filename(local_path, content_type="video/mp4")
        blob.metadata = {**(blob.metadata or {}), **metadata}
        blob.patch()
        return True
    except Exception as error:
        print(f"[Storage] Render cache upload failed: {error}")
        return False


def delete_render_cache(uid: str, cache_key: str) -> bool:
    """Remove a corrupt or otherwise unusable shared render cache entry."""
    remote_path = _render_cache_path(uid, cache_key)
    if not remote_path:
        return False
    if s3_is_configured():
        try:
            delete_s3_file(remote_path)
            return True
        except Exception as error:
            print(f"[Storage] S3 render cache delete failed: {error}")
            return False
    bucket = get_storage_bucket()
    if not bucket:
        return False
    try:
        bucket.blob(remote_path).delete()
        return True
    except NotFound:
        return True
    except Exception as error:
        print(f"[Storage] Render cache delete failed: {error}")
        return False


def signed_export_download_url(remote_path: str, ttl_seconds: int = 600):
    """Return a short-lived private storage URL; callers must authorize ownership first."""
    safe_remote = str(remote_path or "")
    if not safe_remote.startswith("exports/") or ".." in safe_remote.split("/"):
        return None
    ttl = max(60, min(int(ttl_seconds), 900))
    try:
        if s3_is_configured():
            url = s3_signed_download_url(safe_remote, ttl)
        else:
            bucket = get_storage_bucket()
            if not bucket:
                return None
            url = _signed_gcs_download_url(bucket.blob(safe_remote), timedelta(seconds=ttl))
        return url if isinstance(url, str) and url.startswith("https://") else None
    except Exception:
        # A missing signing permission must preserve the existing download path.
        return None


def download_export_from_firebase_storage(remote_path: str, local_path: str):
    safe_remote = str(remote_path or "")
    if not safe_remote.startswith("exports/"):
        return False
    if s3_is_configured():
        try:
            return download_s3_file(safe_remote, local_path)
        except Exception as e:
            print(f"[Storage] S3 export download failed: {e}")
            return False
    bucket = get_storage_bucket()
    if not bucket:
        return False
    try:
        bucket.blob(safe_remote).download_to_filename(local_path)
        return os.path.isfile(local_path) and os.path.getsize(local_path) > 0
    except Exception as e:
        print(f"[Storage] Export download failed: {e}")
        return False


def _delete_orphaned_firebase_objects(
    prefix: str,
    max_age_hours: int,
    batch_size: int,
    *,
    delete_upload_metadata: bool = False,
):
    """Delete expired Firebase objects even if their Firestore schedule is missing."""
    if s3_is_configured() or batch_size <= 0:
        return 0
    bucket = get_storage_bucket()
    if not bucket:
        return 0
    db = get_db()
    now = datetime.now(timezone.utc)
    now_epoch = int(now.timestamp())
    deleted = 0
    for blob in bucket.list_blobs(prefix=prefix):
        if deleted >= batch_size:
            break
        metadata = blob.metadata or {}
        try:
            deadline = int(metadata.get("delete_at_epoch") or 0)
        except (TypeError, ValueError):
            deadline = 0
        created_at = blob.time_created
        if created_at is not None and created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        expired = deadline > 0 and deadline <= now_epoch
        if not deadline and created_at is not None:
            expired = now - created_at >= timedelta(hours=max_age_hours)
        if not expired:
            continue
        try:
            remote_path = str(blob.name or "")
            blob.delete()
            deleted += 1
            if db and remote_path:
                schedule_collection = "upload_expirations" if prefix == "uploads/" else "export_expirations"
                schedule_id = hashlib.sha256(remote_path.encode("utf-8")).hexdigest()
                db.collection(schedule_collection).document(schedule_id).delete()
                if delete_upload_metadata:
                    file_id = str(metadata.get("file_id") or "")
                    if not file_id:
                        file_id = os.path.basename(remote_path).rsplit(".", 1)[0]
                    if file_id:
                        db.collection("uploads").document(file_id).delete()
        except Exception as e:
            print(f"[Storage] Orphan expiry cleanup failed for {prefix}: {e}")
    return deleted


def delete_expired_uploads(batch_size: int = 400):
    db = get_db()
    if not db:
        return 0
    deleted = 0
    try:
        stale_intents = list(
            db.collection("direct_upload_intents")
            .where("expires_at", "<=", datetime.now(timezone.utc))
            .limit(max(1, min(int(batch_size), 100)))
            .stream()
        )
        for intent_doc in stale_intents:
            intent = intent_doc.to_dict() or {}
            remote_path = str(intent.get("remote_path") or "")
            if remote_path.startswith("uploads/"):
                if intent.get("upload_protocol") == S3_UPLOAD_PROTOCOL and intent.get("upload_id"):
                    # Parts of an unfinished multipart upload are billed until aborted.
                    abort_s3_multipart_upload(remote_path, str(intent["upload_id"]))
                delete_from_firebase_storage(remote_path)
            intent_doc.reference.delete()
        due_docs = list(
            db.collection("upload_expirations")
            .where("expire_at", "<=", datetime.now(timezone.utc))
            .order_by("expire_at")
            .limit(max(1, min(int(batch_size), 400)))
            .stream()
        )
        completed_refs = []
        upload_refs = []
        for doc in due_docs:
            row = doc.to_dict() or {}
            remote_path = str(row.get("remote_path") or "")
            file_id = str(row.get("file_id") or "")
            if not remote_path.startswith("uploads/"):
                completed_refs.append(doc.reference)
                continue
            try:
                if not delete_from_firebase_storage(remote_path):
                    raise RuntimeError("durable object deletion failed")
                deleted += 1
                completed_refs.append(doc.reference)
                if file_id:
                    upload_refs.append(db.collection("uploads").document(file_id))
            except Exception as e:
                if "not found" in str(e).lower() or "404" in str(e):
                    completed_refs.append(doc.reference)
                else:
                    print(f"[Storage] Scheduled source delete failed for {remote_path}: {e}")
        if completed_refs:
            batch = db.batch()
            for ref in completed_refs:
                batch.delete(ref)
            for ref in upload_refs:
                batch.delete(ref)
            batch.commit()
        deleted += _delete_orphaned_firebase_objects(
            "uploads/", 6, max(0, int(batch_size) - deleted), delete_upload_metadata=True
        )
        return deleted
    except Exception as e:
        print(f"[Storage] Expired source cleanup failed: {e}")
        return deleted


def delete_user_uploads(uid: str):
    safe_uid = str(uid or "").strip()
    if not safe_uid or "/" in safe_uid or "\\" in safe_uid:
        return None
    deleted = 0
    if s3_is_configured():
        try:
            for row in iter_s3_objects(prefix=f"uploads/{safe_uid}/"):
                delete_s3_file(str(row.get("Key") or ""))
                deleted += 1
            db = get_db()
            if db:
                refs = []
                for collection_name in ("uploads", "upload_expirations"):
                    for doc in db.collection(collection_name).where("uid", "==", safe_uid).stream():
                        refs.append(doc.reference)
                for start in range(0, len(refs), 400):
                    batch = db.batch()
                    for ref in refs[start:start + 400]:
                        batch.delete(ref)
                    batch.commit()
            return deleted
        except Exception as e:
            print(f"[Storage] S3 user source cleanup failed: {e}")
            return None
    bucket = get_storage_bucket()
    if not bucket:
        return None
    try:
        for blob in bucket.list_blobs(prefix=f"uploads/{safe_uid}/"):
            blob.delete()
            deleted += 1
        db = get_db()
        if db:
            refs = []
            for collection_name in ("uploads", "upload_expirations"):
                for doc in db.collection(collection_name).where("uid", "==", safe_uid).stream():
                    refs.append(doc.reference)
            for start in range(0, len(refs), 400):
                batch = db.batch()
                for ref in refs[start:start + 400]:
                    batch.delete(ref)
                batch.commit()
        return deleted
    except Exception as e:
        print(f"[Storage] User source cleanup failed: {e}")
        return None

def delete_from_firebase_storage(remote_path: str):
    """Deletes a file from Firebase Storage."""
    if s3_is_configured():
        try:
            if not s3_object_exists(remote_path):
                return True
            delete_s3_file(remote_path)
            print(f"[Storage] Deleted {remote_path} from S3-compatible durable storage")
            return True
        except Exception as e:
            print(f"[Storage] S3 delete failed: {e}")
            return False
    bucket = get_storage_bucket()
    if not bucket:
        return False
    try:
        blob = bucket.blob(remote_path)
        if not blob.exists():
            return True
        blob.delete()
        print(f"[Storage] Deleted {remote_path}")
        return True
    except Exception as e:
        print(f"[Storage] Delete failed: {e}")
        return False

def delete_user_exports(uid: str):
    """Delete every export owned by a user, including objects omitted from history."""
    safe_uid = str(uid).strip()
    if not safe_uid or "/" in safe_uid or "\\" in safe_uid:
        return None
    deleted = 0
    if s3_is_configured():
        try:
            for row in iter_s3_objects(prefix=f"exports/{safe_uid}/"):
                delete_s3_file(str(row.get("Key") or ""))
                deleted += 1
            return deleted
        except Exception as e:
            print(f"[Storage] S3 user export cleanup failed: {e}")
            return None
    bucket = get_storage_bucket()
    if not bucket:
        return None
    try:
        blobs = bucket.list_blobs(prefix=f"exports/{safe_uid}/", page_size=100)
        for page in blobs.pages:
            page_blobs = list(page)
            if not page_blobs:
                continue
            batch_factory = getattr(bucket.client, "batch", None)
            if callable(batch_factory):
                with batch_factory():
                    for blob in page_blobs:
                        blob.delete()
            else:
                for blob in page_blobs:
                    blob.delete()
            deleted += len(page_blobs)
        return deleted
    except Exception as e:
        print(f"[Storage] User export cleanup failed: {e}")
        return None

def delete_expired_exports(batch_size: int = 400):
    """Delete a bounded batch of exports whose indexed schedule is due."""
    db = get_db()
    if not db:
        return 0
    deleted = 0
    try:
        due_docs = list(
            db.collection("export_expirations")
            .where("expire_at", "<=", datetime.now(timezone.utc))
            .order_by("expire_at")
            .limit(max(1, min(int(batch_size), 400)))
            .stream()
        )
        completed_refs = []
        for doc in due_docs:
            remote_path = str((doc.to_dict() or {}).get("remote_path") or "")
            if not remote_path.startswith("exports/"):
                completed_refs.append(doc.reference)
                continue
            try:
                if not delete_from_firebase_storage(remote_path):
                    raise RuntimeError("durable object deletion failed")
                deleted += 1
                completed_refs.append(doc.reference)
            except Exception as e:
                # Missing objects are already clean; remove their stale schedule.
                if "not found" in str(e).lower() or "404" in str(e):
                    completed_refs.append(doc.reference)
                else:
                    print(f"[Storage] Scheduled delete failed for {remote_path}: {e}")
        if completed_refs:
            batch = db.batch()
            for ref in completed_refs:
                batch.delete(ref)
            batch.commit()
        deleted += _delete_orphaned_firebase_objects(
            "exports/", 72, max(0, int(batch_size) - deleted)
        )
        return deleted
    except Exception as e:
        print(f"[Storage] Expired export cleanup failed: {e}")
        return deleted
