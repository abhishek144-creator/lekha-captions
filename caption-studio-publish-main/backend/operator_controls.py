"""Feature-flag safety, operator kill switches and content-safety checks.

Callers use it as a module (`operator_controls.NAME`), so a test patches one
place and every caller sees it.
"""

import re
import time
from fastapi import HTTPException
from typing import Any, Dict


try:
    from . import settings
    from . import app_state
    from . import firebase_admin_setup
    from . import observability
    from .services.malware import scan_upload_for_threat
except ImportError:  # Direct execution from backend/ remains supported.
    import settings
    import app_state
    import firebase_admin_setup
    import observability
    from services.malware import scan_upload_for_threat


def _validate_feature_flag_safety(flag_name: str):
    if not settings.ENABLE_PROGRESSIVE_DELIVERY:
        raise HTTPException(status_code=403, detail="Feature flags are disabled in this environment")
    if not re.match(r"^[a-zA-Z0-9_.-]{2,64}$", flag_name or ""):
        raise HTTPException(status_code=400, detail="Invalid flag name")


def _default_service_controls() -> Dict[str, Any]:
    controls: Dict[str, Any] = {key: False for key in settings.SERVICE_CONTROL_KEYS}
    controls["notice"] = ""
    controls[settings.MAX_UPLOAD_DURATION_CONTROL_KEY] = settings.GLOBAL_MAX_UPLOAD_DURATION_SECONDS
    return controls


def _read_service_controls(force: bool = False) -> Dict[str, Any]:
    now_ts = time.time()
    cached = app_state._service_control_cache.get("value") or {}
    if (
        not force
        and cached
        and (now_ts - float(app_state._service_control_cache.get("ts") or 0.0)) < settings.SERVICE_CONTROL_CACHE_SECONDS
    ):
        return dict(cached)

    controls = _default_service_controls()
    db = firebase_admin_setup.get_db()
    if db:
        try:
            snap = (
                db.collection(settings.SERVICE_CONTROL_COLLECTION)
                .document(settings.SERVICE_CONTROL_DOCUMENT)
                .get()
            )
            if snap.exists:
                stored = snap.to_dict() or {}
                for key in settings.SERVICE_CONTROL_KEYS:
                    controls[key] = bool(stored.get(key, False))
                controls["notice"] = str(stored.get("notice") or "")[:settings.SERVICE_CONTROL_NOTICE_MAX]
                try:
                    configured_duration = int(stored.get(
                        settings.MAX_UPLOAD_DURATION_CONTROL_KEY,
                        settings.GLOBAL_MAX_UPLOAD_DURATION_SECONDS,
                    ))
                except (TypeError, ValueError):
                    configured_duration = settings.GLOBAL_MAX_UPLOAD_DURATION_SECONDS
                controls[settings.MAX_UPLOAD_DURATION_CONTROL_KEY] = max(
                    15,
                    min(settings.GLOBAL_MAX_UPLOAD_DURATION_SECONDS, configured_duration),
                )
        except Exception as e:
            # Fail open: a controls read failure must not take the product down.
            # The last known state is preferred over an empty default.
            observability._json_log("warning", "service_controls_read_failed", error=str(e))
            if cached:
                return dict(cached)
            return controls

    app_state._service_control_cache["ts"] = now_ts
    app_state._service_control_cache["value"] = dict(controls)
    return controls


def _assert_service_available(control: str) -> None:
    """Reject the request when an operator has paused this part of the product."""
    controls = _read_service_controls()
    for key in ("maintenance_mode", control):
        if not controls.get(key):
            continue
        notice = controls.get("notice") or settings._SERVICE_CONTROL_MESSAGES.get(
            key, "This feature is temporarily paused."
        )
        observability._track_event("service_control_blocked", {"control": key})
        raise HTTPException(status_code=503, detail=notice)


def _scan_upload_for_threat(file_path: str) -> bool:
    return scan_upload_for_threat(file_path, log=observability._json_log)


def _is_content_safety_blocked(*values: str) -> bool:
    if not settings.CONTENT_SAFETY_BLOCKLIST:
        return False
    joined = " ".join((v or "") for v in values).lower()
    return any(token in joined for token in settings.CONTENT_SAFETY_BLOCKLIST)
