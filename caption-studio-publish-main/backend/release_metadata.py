"""Public release identity only; no hostnames, secrets, or account identifiers."""
import os
import re
from datetime import datetime
from pathlib import Path

# Written by the Dockerfile at image build time (see "Release identity" there).
BUILD_TIME_FILE = Path(__file__).resolve().parents[1] / ".build-time"


def apply_platform_release_defaults(env=os.environ):
    """Fill the release identity from the platform when it was not set explicitly.

    Railway provides RAILWAY_GIT_COMMIT_SHA for GitHub deploys, and the image
    records its own build time, so the owner never has to maintain these by hand.
    """
    sha = str(env.get("RAILWAY_GIT_COMMIT_SHA") or "").strip()
    if not str(env.get("APP_RELEASE") or "").strip() and re.fullmatch(r"[a-fA-F0-9]{40}", sha):
        env["APP_RELEASE"] = sha.lower()
    release = str(env.get("APP_RELEASE") or "").strip()
    if not str(env.get("RELEASE_VERSION") or "").strip() and release:
        env["RELEASE_VERSION"] = f"git-{release[:12]}"
    if not str(env.get("APP_BUILD_TIME") or "").strip():
        try:
            built_at = BUILD_TIME_FILE.read_text(encoding="utf-8").strip()
        except OSError:
            built_at = ""
        if built_at:
            env["APP_BUILD_TIME"] = built_at


def release_metadata(component="api"):
    sha = os.environ.get("APP_RELEASE", "").strip()
    version = os.environ.get("RELEASE_VERSION", "").strip() or sha[:12] or "development"
    built_at = os.environ.get("APP_BUILD_TIME", "").strip()
    if sha and not re.fullmatch(r"[a-fA-F0-9]{40}", sha):
        raise ValueError("APP_RELEASE must be a full Git SHA")
    if not re.fullmatch(r"[A-Za-z0-9._-]{1,100}", version):
        raise ValueError("Invalid RELEASE_VERSION")
    if built_at:
        datetime.fromisoformat(built_at.replace("Z", "+00:00"))
    return {"schema_version": 1, "component": component, "release": sha,
            "release_version": version, "built_at": built_at or None,
            "environment": os.environ.get("RELEASE_ENVIRONMENT") or os.environ.get("APP_ENV", "development")}
