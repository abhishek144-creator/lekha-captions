"""Public release identity only; no hostnames, secrets, or account identifiers."""
import os
import re
from datetime import datetime


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
