import os
import json
import hashlib
import time
from datetime import datetime, timedelta, timezone
import firebase_admin
from firebase_admin import credentials, auth, firestore
try:
    from firebase_admin import storage as fb_storage
except ImportError:
    fb_storage = None

STORAGE_BUCKET = os.environ.get('FIREBASE_STORAGE_BUCKET', '')
ALLOW_FIREBASE_SERVICE_ACCOUNT_PATH = os.environ.get('ALLOW_FIREBASE_SERVICE_ACCOUNT_PATH', '0') == '1'
IS_TEST_ENV = (os.environ.get("APP_ENV") or os.environ.get("ENV") or "").strip().lower() in {"test", "testing"}

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

def verify_token(id_token: str):
    if IS_TEST_ENV and not firebase_admin._apps:
        return None
    try:
        # check_revoked=True prevents a stolen token from remaining usable after
        # the account owner signs out all sessions or an administrator revokes it.
        decoded_token = auth.verify_id_token(id_token, check_revoked=True)
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

def get_storage_bucket():
    if IS_TEST_ENV and not firebase_admin._apps:
        return None
    try:
        if fb_storage is None:
            return None
        return fb_storage.bucket()
    except Exception as e:
        print(f"Firebase Storage not available: {e}")
        return None

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
    bucket = get_storage_bucket()
    safe_remote = str(remote_path or "").strip()
    if (
        not bucket
        or not safe_remote.startswith("exports/")
        or not os.path.isfile(local_path)
        or os.path.getsize(local_path) <= 0
    ):
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
        url = blob.generate_signed_url(expiration=timedelta(hours=ttl))
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
    bucket = get_storage_bucket()
    db = get_db()
    safe_uid = str(uid or "").strip()
    safe_file_id = str(file_id or "").strip()
    safe_ext = str(extension or "").strip().lower().lstrip(".")
    if (
        not bucket or not db or not safe_uid or not safe_file_id or not safe_ext
        or "/" in safe_uid or "\\" in safe_uid
        or "/" in safe_file_id or "\\" in safe_file_id
        or not safe_ext.isalnum()
    ):
        return None
    remote_path = f"uploads/{safe_uid}/{safe_file_id}.{safe_ext}"
    ttl = max(1, min(int(expiration_hours), 24))
    blob = bucket.blob(remote_path)
    try:
        blob.upload_from_filename(local_path)
        expires_at = datetime.now(timezone.utc) + timedelta(hours=ttl)
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
    bucket = get_storage_bucket()
    safe_remote = str(remote_path or "")
    if not bucket or not safe_remote.startswith("uploads/"):
        return False
    try:
        bucket.blob(safe_remote).download_to_filename(local_path)
        return os.path.isfile(local_path) and os.path.getsize(local_path) > 0
    except Exception as e:
        print(f"[Storage] Source download failed: {e}")
        return False


def download_export_from_firebase_storage(remote_path: str, local_path: str):
    bucket = get_storage_bucket()
    safe_remote = str(remote_path or "")
    if not bucket or not safe_remote.startswith("exports/"):
        return False
    try:
        bucket.blob(safe_remote).download_to_filename(local_path)
        return os.path.isfile(local_path) and os.path.getsize(local_path) > 0
    except Exception as e:
        print(f"[Storage] Export download failed: {e}")
        return False


def delete_expired_uploads(batch_size: int = 400):
    bucket = get_storage_bucket()
    db = get_db()
    if not bucket or not db:
        return 0
    deleted = 0
    try:
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
                bucket.blob(remote_path).delete()
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
        return deleted
    except Exception as e:
        print(f"[Storage] Expired source cleanup failed: {e}")
        return deleted


def delete_user_uploads(uid: str):
    bucket = get_storage_bucket()
    safe_uid = str(uid or "").strip()
    if not bucket or not safe_uid or "/" in safe_uid or "\\" in safe_uid:
        return None
    deleted = 0
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
    bucket = get_storage_bucket()
    if not bucket:
        return None
    safe_uid = str(uid).strip()
    if not safe_uid or "/" in safe_uid or "\\" in safe_uid:
        return None
    deleted = 0
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
    bucket = get_storage_bucket()
    db = get_db()
    if not bucket or not db:
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
                bucket.blob(remote_path).delete()
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
        return deleted
    except Exception as e:
        print(f"[Storage] Expired export cleanup failed: {e}")
        return deleted
