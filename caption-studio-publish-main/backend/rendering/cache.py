"""Tenant-scoped render cache identity."""

import hashlib
import json


def render_cache_eligible(*, template_export_active, template_cache_enabled=True):
    """Return whether an exact render may use the durable artifact cache."""
    return bool(template_cache_enabled or not template_export_active)


def render_cache_identity(
    *,
    uid,
    renderer_version,
    media_hash,
    captions,
    style,
    quality,
    fps,
    export_aspect_ratio,
):
    """Return a stable cache key without permitting cross-account reuse."""
    payload = {
        "uid": str(uid),
        "renderer_version": str(renderer_version),
        "media_hash": str(media_hash),
        "captions": captions,
        "style": style,
        "quality": str(quality),
        "fps": int(fps),
        "export_aspect_ratio": str(export_aspect_ratio or ""),
    }
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()
