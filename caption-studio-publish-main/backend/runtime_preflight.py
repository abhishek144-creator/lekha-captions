"""Offline release checks. Reports setting names only, never credential values."""
import argparse
from datetime import datetime
import os
import re


REQUIRED = (
    "FIREBASE_SERVICE_ACCOUNT_JSON", "FIREBASE_STORAGE_BUCKET", "OPENAI_API_KEY",
    "SARVAM_API_KEY", "RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET",
    "PAYMENT_RECONCILE_SECRET", "MEDIA_URL_SIGNING_SECRET", "REDIS_URL",
    "APP_RELEASE", "APP_BUILD_TIME", "RELEASE_VERSION", "ADMIN_EMAILS",
    "SECURITY_CONTACT_EMAIL", "PRIVACY_CONTACT_EMAIL", "ALLOWED_ORIGINS",
)


def validate_runtime(env, *, image_release=None, secret_version=None):
    errors = [f"Missing {key}" for key in REQUIRED if not str(env.get(key, "")).strip()]
    if secret_version is not None and not re.fullmatch(r"[1-9][0-9]*", str(secret_version)):
        errors.append("Secret Manager version must be a positive numeric version")
    release = str(env.get("APP_RELEASE", ""))
    if not re.fullmatch(r"[0-9a-f]{40}", release):
        errors.append("APP_RELEASE must be an immutable commit SHA")
    if image_release is not None and release != image_release:
        errors.append("Runtime APP_RELEASE does not match the image revision label")
    try:
        if datetime.fromisoformat(env.get("APP_BUILD_TIME", "").replace("Z", "+00:00")).tzinfo is None:
            errors.append("APP_BUILD_TIME must include its timezone")
    except ValueError:
        errors.append("APP_BUILD_TIME must be the artifact build timestamp")
    if env.get("GCS_MEDIA_BUCKET") and not re.fullmatch(r"[^\s@]+@[^\s@]+\.iam\.gserviceaccount\.com", env.get("GCS_SIGNING_SERVICE_ACCOUNT", "")):
        errors.append("GCS_SIGNING_SERVICE_ACCOUNT is required for private GCS downloads")
    origins = [value.strip() for value in env.get("ALLOWED_ORIGINS", "").split(",") if value.strip()]
    if not origins or any(not re.fullmatch(r"https://[^/\s*]+", value) for value in origins):
        errors.append("ALLOWED_ORIGINS must contain explicit HTTPS origins")
    for key in ("DEBUG_MODE", "DEV_MODE", "ALLOW_INMEMORY_STATE", "ALLOW_UNSCANNED_UPLOADS", "PUPPETEER_DISABLE_SANDBOX", "DISABLE_EXPORT_DAILY_LIMIT", "DISABLE_EXPORT_CREDIT_LIMIT"):
        if str(env.get(key, "")).lower() in {"1", "true", "yes"}:
            errors.append(f"Unsafe production setting: {key}")
    if errors:
        raise ValueError("Runtime preflight failed: " + "; ".join(errors))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--image-release", required=True)
    parser.add_argument("--secret-version", required=True)
    args = parser.parse_args()
    try:
        validate_runtime(os.environ, image_release=args.image_release, secret_version=args.secret_version)
    except ValueError as error:
        raise SystemExit(str(error)) from None
    print("Runtime preflight passed; no services changed")
