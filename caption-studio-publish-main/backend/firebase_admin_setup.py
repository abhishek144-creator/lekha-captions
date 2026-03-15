import os
import json
import firebase_admin
from firebase_admin import credentials, auth, firestore

def init_firebase():
    # Only initialize if it hasn't been initialized yet
    if not firebase_admin._apps:
        # Try 1: Load from service-account.json file (recommended for local dev)
        service_account_path = os.path.join(os.path.dirname(__file__), 'service-account.json')
        if os.path.exists(service_account_path):
            try:
                cred = credentials.Certificate(service_account_path)
                firebase_admin.initialize_app(cred)
                print("Firebase Admin initialized from service-account.json file.")
                return
            except Exception as e:
                print(f"Failed to initialize from service-account.json: {e}")

        # Try 2: Load from FIREBASE_SERVICE_ACCOUNT_JSON env var (for production/Replit)
        service_account_str = os.environ.get('FIREBASE_SERVICE_ACCOUNT_JSON')
        if service_account_str:
            try:
                cred_dict = json.loads(service_account_str)
                cred = credentials.Certificate(cred_dict)
                firebase_admin.initialize_app(cred)
                print("Firebase Admin initialized from FIREBASE_SERVICE_ACCOUNT_JSON env var.")
                return
            except Exception as e:
                print(f"Failed to initialize from env var: {e}")

        print("Warning: No Firebase service account found. Authentication will fail.")

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
