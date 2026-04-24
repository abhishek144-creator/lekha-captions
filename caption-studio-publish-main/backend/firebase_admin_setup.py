import os
import json
from datetime import timedelta
import firebase_admin
from firebase_admin import credentials, auth, firestore
try:
    from firebase_admin import storage as fb_storage
except ImportError:
    fb_storage = None

STORAGE_BUCKET = os.environ.get('FIREBASE_STORAGE_BUCKET', '')
ALLOW_FIREBASE_SERVICE_ACCOUNT_PATH = os.environ.get('ALLOW_FIREBASE_SERVICE_ACCOUNT_PATH', '0') == '1'

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

        print("Warning: No Firebase credentials found in env. Set FIREBASE_SERVICE_ACCOUNT_JSON.")

# Initialize on import
init_firebase()

def get_db():
    try:
        return firestore.client()
    except ValueError:
        init_firebase()
        if not firebase_admin._apps:
            return None
        return firestore.client()

def verify_token(token: str):
    """
    Verifies a Firebase ID token.
    Returns the decoded token (a dict containing user info like uid, email) if valid.
    Returns None if verification fails.
    """
    try:
        decoded_token = auth.verify_id_token(token)
        return decoded_token
    except Exception as e:
        print(f"Token verification failed: {e}")
        return None

def get_storage_bucket():
    """Returns the Firebase Storage bucket, or None if not configured."""
    try:
        if not STORAGE_BUCKET or fb_storage is None:
            return None
        return fb_storage.bucket()
    except Exception as e:
        print(f"Firebase Storage not available: {e}")
        return None

def upload_to_firebase_storage(local_path: str, remote_path: str, content_type: str = "video/mp4"):
    """
    Uploads a local file to Firebase Storage.
    Returns a signed download URL valid for the specified hours, or None on failure.
    """
    bucket = get_storage_bucket()
    if not bucket:
        return None
    try:
        blob = bucket.blob(remote_path)
        blob.upload_from_filename(local_path, content_type=content_type)
        url = blob.generate_signed_url(expiration=timedelta(hours=72))
        print(f"[Storage] Uploaded {remote_path} to Firebase Storage")
        return url
    except Exception as e:
        print(f"[Storage] Upload failed: {e}")
        return None

def delete_from_firebase_storage(remote_path: str):
    """Deletes a file from Firebase Storage."""
    bucket = get_storage_bucket()
    if not bucket:
        return False
    try:
        blob = bucket.blob(remote_path)
        blob.delete()
        print(f"[Storage] Deleted {remote_path}")
        return True
    except Exception as e:
        print(f"[Storage] Delete failed: {e}")
        return False
