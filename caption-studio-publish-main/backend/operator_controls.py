"""Feature-flag safety, operator kill switches and content-safety checks.

The factory accepts explicit configuration, adapters and shared state through
ServiceContext. It has no dependency on the HTTP entry point.
"""

from types import SimpleNamespace
from typing import Protocol, Any
from typing import Dict
from fastapi import HTTPException
import re
import time

class ServiceContext(Protocol):
    CONTENT_SAFETY_BLOCKLIST: Any
    ENABLE_PROGRESSIVE_DELIVERY: Any
    GLOBAL_MAX_UPLOAD_DURATION_SECONDS: Any
    MAX_UPLOAD_DURATION_CONTROL_KEY: Any
    SERVICE_CONTROL_CACHE_SECONDS: Any
    SERVICE_CONTROL_COLLECTION: Any
    SERVICE_CONTROL_DOCUMENT: Any
    SERVICE_CONTROL_KEYS: Any
    SERVICE_CONTROL_NOTICE_MAX: Any
    _SERVICE_CONTROL_MESSAGES: Any
    _default_service_controls: Any
    _json_log: Any
    _read_service_controls: Any
    _service_control_cache: Any
    _track_event: Any
    get_db: Any
    scan_upload_for_threat: Any


def create_operator_controls(context: ServiceContext) -> SimpleNamespace:
    def _validate_feature_flag_safety(flag_name: str):
        if not context.ENABLE_PROGRESSIVE_DELIVERY:
            raise HTTPException(status_code=403, detail="Feature flags are disabled in this environment")
        if not re.match(r"^[a-zA-Z0-9_.-]{2,64}$", flag_name or ""):
            raise HTTPException(status_code=400, detail="Invalid flag name")


    def _default_service_controls() -> Dict[str, Any]:
        controls: Dict[str, Any] = {key: False for key in context.SERVICE_CONTROL_KEYS}
        controls["notice"] = ""
        controls[context.MAX_UPLOAD_DURATION_CONTROL_KEY] = context.GLOBAL_MAX_UPLOAD_DURATION_SECONDS
        return controls


    def _read_service_controls(force: bool = False) -> Dict[str, Any]:
        now_ts = time.time()
        cached = context._service_control_cache.get("value") or {}
        if (
            not force
            and cached
            and (now_ts - float(context._service_control_cache.get("ts") or 0.0)) < context.SERVICE_CONTROL_CACHE_SECONDS
        ):
            return dict(cached)

        controls = context._default_service_controls()
        db = context.get_db()
        if db:
            try:
                snap = (
                    db.collection(context.SERVICE_CONTROL_COLLECTION)
                    .document(context.SERVICE_CONTROL_DOCUMENT)
                    .get()
                )
                if snap.exists:
                    stored = snap.to_dict() or {}
                    for key in context.SERVICE_CONTROL_KEYS:
                        controls[key] = bool(stored.get(key, False))
                    controls["notice"] = str(stored.get("notice") or "")[:context.SERVICE_CONTROL_NOTICE_MAX]
                    try:
                        configured_duration = int(stored.get(
                            context.MAX_UPLOAD_DURATION_CONTROL_KEY,
                            context.GLOBAL_MAX_UPLOAD_DURATION_SECONDS,
                        ))
                    except (TypeError, ValueError):
                        configured_duration = context.GLOBAL_MAX_UPLOAD_DURATION_SECONDS
                    controls[context.MAX_UPLOAD_DURATION_CONTROL_KEY] = max(
                        15,
                        min(context.GLOBAL_MAX_UPLOAD_DURATION_SECONDS, configured_duration),
                    )
            except Exception as e:
                # Fail open: a controls read failure must not take the product down.
                # The last known state is preferred over an empty default.
                context._json_log("warning", "service_controls_read_failed", error=str(e))
                if cached:
                    return dict(cached)
                return controls

        context._service_control_cache["ts"] = now_ts
        context._service_control_cache["value"] = dict(controls)
        return controls


    def _assert_service_available(control: str) -> None:
        """Reject the request when an operator has paused this part of the product."""
        controls = context._read_service_controls()
        for key in ("maintenance_mode", control):
            if not controls.get(key):
                continue
            notice = controls.get("notice") or context._SERVICE_CONTROL_MESSAGES.get(
                key, "This feature is temporarily paused."
            )
            context._track_event("service_control_blocked", {"control": key})
            raise HTTPException(status_code=503, detail=notice)


    def _scan_upload_for_threat(file_path: str) -> bool:
        return context.scan_upload_for_threat(file_path, log=context._json_log)


    def _is_content_safety_blocked(*values: str) -> bool:
        if not context.CONTENT_SAFETY_BLOCKLIST:
            return False
        joined = " ".join((v or "") for v in values).lower()
        return any(token in joined for token in context.CONTENT_SAFETY_BLOCKLIST)

    return SimpleNamespace(
        _validate_feature_flag_safety=_validate_feature_flag_safety,
        _default_service_controls=_default_service_controls,
        _read_service_controls=_read_service_controls,
        _assert_service_available=_assert_service_available,
        _scan_upload_for_threat=_scan_upload_for_threat,
        _is_content_safety_blocked=_is_content_safety_blocked,
    )
