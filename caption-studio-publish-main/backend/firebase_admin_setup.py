import os
import json
import hashlib
import time
from datetime import datetime, timedelta, timezone
import firebase_admin
from firebase_admin import credentials, auth, firestore
from google.cloud import storage as gcs_storage
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
    )
try:
    from firebase_admin import storage as fb_storage
except ImportError:
    fb_storage = None

STORAGE_BUCKET = os.environ.get('FIREBASE_STORAGE_BUCKET', '')
GCS_MEDIA_BUCKET = os.environ.get('GCS_MEDIA_BUCKET', '').strip()
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


def create_resumable_source_upload(uid: str, file_id: str, extension: str,
                                   content_type: str, size_bytes: int, origin: str = ""):
    """Create a short-lived GCS resumable session without proxying media through the API."""
    if s3_is_configured():
        return None
    safe_uid = str(uid or "").strip()
    safe_file_id = str(file_id or "").strip()
    safe_ext = str(extension or "").strip().lower().lstrip(".")
    if (not safe_uid or not safe_file_id or not safe_ext or not safe_ext.isalnum()
            or "/" in safe_uid or "\\" in safe_uid or "/" in safe_file_id or "\\" in safe_file_id):
        return None
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
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc),
    })
    return {"session_url": session_url, "remote_path": remote_path, "expires_at": expires_at.isoformat()}


def finalize_resumable_source_upload(uid: str, file_id: str):
    """Verify ownership and size before admitting a directly uploaded object."""
    if s3_is_configured():
        return None
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
    remote_path = str(intent.get("remote_path") or "")
    if not remote_path.startswith(f"uploads/{uid}/"):
        return None
    blob = bucket.blob(remote_path)
    blob.reload(timeout=15)
    expected_size = int(intent.get("size_bytes") or 0)
    actual_size = int(blob.size or 0)
    if expected_size <= 0 or actual_size != expected_size:
        blob.delete()
        intent_ref.delete()
        return None
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
    intent_ref.delete()
    return {
        "remote_path": remote_path,
        "extension": str(intent.get("extension") or ""),
        "size_bytes": actual_size,
    }

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
