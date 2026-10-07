"""Feature-flag safety, operator kill switches and content-safety checks.

Helpers resolve shared state through ``host`` (the main module) at call
time, so there is one copy of each helper and test patches on ``main``
keep applying.
"""

from types import ModuleType, SimpleNamespace


def create_operator_controls(host: ModuleType) -> SimpleNamespace:
    def _validate_feature_flag_safety(flag_name: str):
        if not host.ENABLE_PROGRESSIVE_DELIVERY:
            raise host.HTTPException(status_code=403, detail="Feature flags are disabled in this environment")
        if not host.re.match(r"^[a-zA-Z0-9_.-]{2,64}$", flag_name or ""):
            raise host.HTTPException(status_code=400, detail="Invalid flag name")


    def _default_service_controls() -> host.Dict[str, host.Any]:
        controls: host.Dict[str, host.Any] = {key: False for key in host.SERVICE_CONTROL_KEYS}
        controls["notice"] = ""
        controls[host.MAX_UPLOAD_DURATION_CONTROL_KEY] = host.GLOBAL_MAX_UPLOAD_DURATION_SECONDS
        return controls


    def _read_service_controls(force: bool = False) -> host.Dict[str, host.Any]:
        now_ts = host.time.time()
        cached = host._service_control_cache.get("value") or {}
        if (
            not force
            and cached
            and (now_ts - float(host._service_control_cache.get("ts") or 0.0)) < host.SERVICE_CONTROL_CACHE_SECONDS
        ):
            return dict(cached)

        controls = host._default_service_controls()
        db = host.get_db()
        if db:
            try:
                snap = (
                    db.collection(host.SERVICE_CONTROL_COLLECTION)
                    .document(host.SERVICE_CONTROL_DOCUMENT)
                    .get()
                )
                if snap.exists:
                    stored = snap.to_dict() or {}
                    for key in host.SERVICE_CONTROL_KEYS:
                        controls[key] = bool(stored.get(key, False))
                    controls["notice"] = str(stored.get("notice") or "")[:host.SERVICE_CONTROL_NOTICE_MAX]
                    try:
                        configured_duration = int(stored.get(
                            host.MAX_UPLOAD_DURATION_CONTROL_KEY,
                            host.GLOBAL_MAX_UPLOAD_DURATION_SECONDS,
                        ))
                    except (TypeError, ValueError):
                        configured_duration = host.GLOBAL_MAX_UPLOAD_DURATION_SECONDS
                    controls[host.MAX_UPLOAD_DURATION_CONTROL_KEY] = max(
                        15,
                        min(host.GLOBAL_MAX_UPLOAD_DURATION_SECONDS, configured_duration),
                    )
            except Exception as e:
                # Fail open: a controls read failure must not take the product down.
                # The last known state is preferred over an empty default.
                host._json_log("warning", "service_controls_read_failed", error=str(e))
                if cached:
                    return dict(cached)
                return controls

        host._service_control_cache["ts"] = now_ts
        host._service_control_cache["value"] = dict(controls)
        return controls


    def _assert_service_available(control: str) -> None:
        """Reject the request when an operator has paused this part of the product."""
        controls = host._read_service_controls()
        for key in ("maintenance_mode", control):
            if not controls.get(key):
                continue
            notice = controls.get("notice") or host._SERVICE_CONTROL_MESSAGES.get(
                key, "This feature is temporarily paused."
            )
            host._track_event("service_control_blocked", {"control": key})
            raise host.HTTPException(status_code=503, detail=notice)


    def _scan_upload_for_threat(file_path: str) -> bool:
        return host.scan_upload_for_threat(file_path, log=host._json_log)


    def _is_content_safety_blocked(*values: str) -> bool:
        if not host.CONTENT_SAFETY_BLOCKLIST:
            return False
        joined = " ".join((v or "") for v in values).lower()
        return any(token in joined for token in host.CONTENT_SAFETY_BLOCKLIST)

    return SimpleNamespace(
        _validate_feature_flag_safety=_validate_feature_flag_safety,
        _default_service_controls=_default_service_controls,
        _read_service_controls=_read_service_controls,
        _assert_service_available=_assert_service_available,
        _scan_upload_for_threat=_scan_upload_for_threat,
        _is_content_safety_blocked=_is_content_safety_blocked,
    )
