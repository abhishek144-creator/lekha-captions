"""Structured logs, alerts, telemetry, circuit breaking and SLO metrics for the API.

Callers use it as a module (`observability.NAME`), so a test patches one
place and every caller sees it.
"""

import asyncio
import json
import math
import os
import time
import urllib.parse
import urllib.request
import uuid
from datetime import datetime, timedelta, timezone
from fastapi import Request
from typing import Any, Dict, List, Optional

try:
    from . import settings
    from . import app_state
    from . import firebase_admin_setup
except ImportError:  # Direct execution from backend/ remains supported.
    import settings
    import app_state
    import firebase_admin_setup

try:
    from google.api_core import exceptions as google_api_exceptions
    # 400-class Firestore answers (e.g. InvalidArgument for nested arrays or an
    # oversized document) mean the row itself can never be stored.
    _REJECTED_TELEMETRY_ROW_ERRORS = (ValueError, TypeError, google_api_exceptions.BadRequest)
except ImportError:
    _REJECTED_TELEMETRY_ROW_ERRORS = (ValueError, TypeError)


def _utcnow() -> datetime:
    """Return naive UTC for compatibility with existing persisted timestamp formats."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _json_log(level: str, event: str, **fields):
    record = {
        "timestamp": _utcnow().isoformat() + "Z",
        "level": level.upper(),
        "event": event,
        "service": os.environ.get("SERVICE_ROLE", "api"),
        "environment": os.environ.get("APP_ENV", "unknown"),
        "release": os.environ.get("APP_RELEASE", ""),
        **fields,
    }
    line = json.dumps(record, ensure_ascii=True, default=str)
    if level.lower() in ("error", "warning"):
        app_state._logger.warning(line) if level.lower() == "warning" else app_state._logger.error(line)
    else:
        app_state._logger.info(line)


def _send_alert(text: str):
    _json_log("warning", "ops_alert", text=text)
    if not settings.SLACK_ALERT_WEBHOOK_URL:
        return False
    try:
        payload = {"text": text}
        req = urllib.request.Request(
            settings.SLACK_ALERT_WEBHOOK_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        _urlopen_https_only(req, timeout=5)
        return True
    except Exception as e:
        _json_log("warning", "alert_webhook_failed", error=str(e))
        return False


def _urlopen_https_only(req, timeout: int = 5):
    url = getattr(req, "full_url", str(req))
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != "https":
        raise ValueError("Only https URLs are allowed for outbound requests")
    return urllib.request.urlopen(req, timeout=timeout)  # nosec B310


def _retention_deadline(days: int) -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=max(1, int(days)))


def _enqueue_telemetry(collection_name: str, payload: Dict[str, Any], retention_days: int):
    row = {**payload, "expire_at": _retention_deadline(retention_days)}
    dropped = False
    with app_state._telemetry_lock:
        if len(app_state._telemetry_buffer) >= settings.TELEMETRY_QUEUE_LIMIT:
            app_state._telemetry_buffer.popleft()
            dropped = True
        app_state._telemetry_buffer.append((collection_name, row))
    if dropped:
        _json_log("warning", "telemetry_buffer_overflow", collection=collection_name)


def _flush_telemetry():
    db = firebase_admin_setup.get_db()
    if not db:
        return 0
    rows = []
    with app_state._telemetry_lock:
        while app_state._telemetry_buffer and len(rows) < settings.TELEMETRY_BATCH_SIZE:
            rows.append(app_state._telemetry_buffer.popleft())
    if not rows:
        return 0
    try:
        batch = db.batch()
        for collection_name, payload in rows:
            batch.set(db.collection(collection_name).document(), payload)
        batch.commit()
        return len(rows)
    except Exception as e:
        _json_log("warning", "telemetry_batch_persist_failed", count=len(rows), error=str(e))
        return _persist_telemetry_rows_individually(db, rows)


def _persist_telemetry_rows_individually(db, rows) -> int:
    # A batch is all-or-nothing, so one row Firestore rejects would fail every
    # retry of the same batch and stall audit logs behind it. Write rows one at
    # a time: drop the rejected ones, and re-queue the rest only when Firestore
    # itself is failing.
    written = 0
    for index, (collection_name, payload) in enumerate(rows):
        try:
            db.collection(collection_name).document().set(payload)
            written += 1
        except _REJECTED_TELEMETRY_ROW_ERRORS as error:
            _json_log("error", "telemetry_row_rejected", collection=collection_name, error=type(error).__name__)
        except Exception as error:
            deferred = rows[index:]
            with app_state._telemetry_lock:
                for row in reversed(deferred):
                    app_state._telemetry_buffer.appendleft(row)
            _json_log("warning", "telemetry_rows_deferred", count=len(deferred), error=str(error))
            break
    return written


async def _telemetry_flush_loop():
    while True:
        await asyncio.sleep(5)
        await asyncio.to_thread(_flush_telemetry)


class CircuitBreaker:
    def __init__(self, failure_threshold: int = 5, cooldown_seconds: int = 90):
        self.failure_threshold = failure_threshold
        self.cooldown_seconds = cooldown_seconds
        self._state = "closed"
        self._failure_count = 0
        self._opened_at = 0.0

    def allow(self) -> bool:
        if self._state == "closed":
            return True
        if self._state == "open":
            if (time.time() - self._opened_at) >= self.cooldown_seconds:
                self._state = "half_open"
                return True
            return False
        return True

    def on_success(self):
        self._state = "closed"
        self._failure_count = 0
        self._opened_at = 0.0

    def on_failure(self):
        self._failure_count += 1
        if self._failure_count >= self.failure_threshold:
            self._state = "open"
            self._opened_at = time.time()


def _request_id(request: Optional[Request]) -> str:
    if request is None:
        return str(uuid.uuid4())[:8]
    state_rid = str(getattr(request.state, "request_id", "") or "").strip()
    if state_rid:
        return state_rid[:64]
    rid = request.headers.get("x-request-id")
    return rid.strip()[:64] if rid else str(uuid.uuid4())[:8]


def _log(rid: str, msg: str):
    _json_log("info", "app_log", request_id=rid, message=msg)


def _track_event(event: str, payload: Optional[Dict[str, Any]] = None):
    app_state._analytics_counters[event] = app_state._analytics_counters.get(event, 0) + 1
    day_key = _utcnow().date().isoformat()
    daily = app_state._analytics_daily_counters.setdefault(day_key, {})
    daily[event] = daily.get(event, 0) + 1
    if app_state._redis_client is not None:
        try:
            app_state._redis_client.hincrby("analytics:counters", event, 1)
            redis_daily_key = f"analytics:daily:{day_key}"
            app_state._redis_client.hincrby(redis_daily_key, event, 1)
            app_state._redis_client.expire(redis_daily_key, 120 * 24 * 3600)
        except Exception:
            pass
    _json_log("info", "analytics_event", name=event, payload=payload or {})
    _enqueue_telemetry("analytics_events", {
        "event": event,
        "payload": payload or {},
        "timestamp": _utcnow().isoformat() + "Z",
    }, retention_days=30)


def _track_latency_sample(path: str, duration_ms: int, max_samples: int = 300):
    if path not in ("/api/process", "/api/export"):
        return
    arr = app_state._route_latency_samples.setdefault(path, [])
    arr.append(int(duration_ms))
    if len(arr) > max_samples:
        del arr[:-max_samples]
    if app_state._redis_client is not None:
        try:
            k = f"latency:{path}"
            app_state._redis_client.rpush(k, int(duration_ms))
            app_state._redis_client.ltrim(k, -max_samples, -1)
            app_state._redis_client.expire(k, 24 * 3600)
            day_key = _utcnow().date().isoformat()
            daily_key = f"latency:{day_key}:{path}"
            app_state._redis_client.rpush(daily_key, int(duration_ms))
            app_state._redis_client.ltrim(daily_key, -max_samples, -1)
            app_state._redis_client.expire(daily_key, 120 * 24 * 3600)
        except Exception:
            pass


def _track_operational_metric_sample(name: str, value: float, max_samples: int = 2_000):
    if not math.isfinite(float(value)):
        return
    day_key = _utcnow().date().isoformat()
    sample_key = f"{day_key}:{name}"
    samples = app_state._operational_metric_samples.setdefault(sample_key, [])
    samples.append(float(value))
    if len(samples) > max_samples:
        del samples[:-max_samples]
    if app_state._redis_client is not None:
        try:
            redis_key = f"opsmetric:{sample_key}"
            app_state._redis_client.rpush(redis_key, float(value))
            app_state._redis_client.ltrim(redis_key, -max_samples, -1)
            app_state._redis_client.expire(redis_key, 120 * 24 * 3600)
        except Exception:
            pass


def _record_client_time_to_first_caption(value: Any) -> None:
    try:
        duration_ms = float(value)
    except (TypeError, ValueError):
        return
    if not math.isfinite(duration_ms) or duration_ms <= 0 or duration_ms > settings.CLIENT_TIME_TO_FIRST_CAPTION_MAX_MS:
        return
    _track_operational_metric_sample("time_to_first_caption_ms", duration_ms)


def _read_operational_metric_samples(day_key: str, name: str) -> List[float]:
    sample_key = f"{day_key}:{name}"
    values = list(app_state._operational_metric_samples.get(sample_key, []))
    if app_state._redis_client is not None:
        try:
            redis_values = [
                float(value)
                for value in (app_state._redis_client.lrange(f"opsmetric:{sample_key}", 0, -1) or [])
            ]
            if redis_values:
                values = redis_values
        except Exception:
            pass
    return values


def _read_daily_analytics_counters(day_key: str) -> Dict[str, int]:
    counters = dict(app_state._analytics_daily_counters.get(day_key, {}))
    if app_state._redis_client is not None:
        try:
            redis_counters = app_state._redis_client.hgetall(f"analytics:daily:{day_key}") or {}
            if redis_counters:
                counters = {key: int(value) for key, value in redis_counters.items()}
        except Exception:
            pass
    return counters


def _read_daily_latency_samples(day_key: str, path: str) -> List[int]:
    if day_key == _utcnow().date().isoformat():
        values = list(app_state._route_latency_samples.get(path, []))
    else:
        values = []
    if app_state._redis_client is not None:
        try:
            redis_values = [
                int(value)
                for value in (app_state._redis_client.lrange(f"latency:{day_key}:{path}", 0, -1) or [])
            ]
            if redis_values:
                values = redis_values
        except Exception:
            pass
    return values


def _p95(values: list) -> int:
    if not values:
        return 0
    ordered = sorted(int(v) for v in values)
    idx = max(0, math.ceil(0.95 * len(ordered)) - 1)
    return ordered[idx]


def _build_slo_snapshot() -> Dict[str, Any]:
    export_success = app_state._analytics_counters.get("export_success", 0)
    export_failed = app_state._analytics_counters.get("export_failed_http", 0) + app_state._analytics_counters.get("export_failed_exception", 0)
    process_success = app_state._analytics_counters.get("process_success", 0)
    process_failed = app_state._analytics_counters.get("process_failed", 0)
    if app_state._redis_client is not None:
        try:
            counters = app_state._redis_client.hgetall("analytics:counters") or {}
            export_success = int(counters.get("export_success", export_success))
            export_failed = int(counters.get("export_failed_http", 0)) + int(counters.get("export_failed_exception", 0))
            process_success = int(counters.get("process_success", process_success))
            process_failed = int(counters.get("process_failed", process_failed))
        except Exception:
            pass
    export_total = export_success + export_failed
    process_total = process_success + process_failed
    export_rate = export_success / max(export_total, 1)
    process_rate = process_success / max(process_total, 1)
    export_samples = _read_operational_metric_samples(_utcnow().date().isoformat(), "export_total_ms")
    process_samples = app_state._route_latency_samples.get("/api/process", [])
    if app_state._redis_client is not None:
        try:
            r_process = [int(x) for x in app_state._redis_client.lrange("latency:/api/process", 0, -1) or []]
            if r_process:
                process_samples = r_process
        except Exception:
            pass
    export_p95 = _p95(export_samples)
    process_p95 = _p95(process_samples)
    release_gate_passed = (
        (export_total < settings.ERROR_BUDGET_WINDOW_MIN_EVENTS or export_rate >= settings.SLO_EXPORT_SUCCESS_TARGET)
        and (process_total < settings.ERROR_BUDGET_WINDOW_MIN_EVENTS or process_rate >= settings.SLO_PROCESS_SUCCESS_TARGET)
        and (export_p95 == 0 or export_p95 <= settings.SLO_EXPORT_P95_MS_TARGET)
        and (process_p95 == 0 or process_p95 <= settings.SLO_PROCESS_P95_MS_TARGET)
    )
    return {
        "success": True,
        "api_version": settings.API_CURRENT_VERSION,
        "release_gate_passed": release_gate_passed,
        "targets": {
            "export_success_rate": settings.SLO_EXPORT_SUCCESS_TARGET,
            "process_success_rate": settings.SLO_PROCESS_SUCCESS_TARGET,
            "export_p95_ms": settings.SLO_EXPORT_P95_MS_TARGET,
            "process_p95_ms": settings.SLO_PROCESS_P95_MS_TARGET,
        },
        "actuals": {
            "export_success_rate": export_rate,
            "process_success_rate": process_rate,
            "export_p95_ms": export_p95,
            "process_p95_ms": process_p95,
        },
        "volumes": {
            "export_total": export_total,
            "process_total": process_total,
        },
        "timestamp": _utcnow().isoformat() + "Z",
    }


def _maybe_alert_failure_ratio(window_key: str, success_count: int, failure_count: int):
    total = success_count + failure_count
    if total < 20:
        return
    ratio = failure_count / max(total, 1)
    if ratio < 0.2:
        return
    now_ts = time.time()
    if now_ts - app_state._analytics_last_alert_ts.get(window_key, 0.0) < 600:
        return
    app_state._analytics_last_alert_ts[window_key] = now_ts
    _json_log(
        "warning",
        "failure_ratio_alert",
        window_key=window_key,
        success_count=success_count,
        failure_count=failure_count,
        ratio=ratio,
    )
    if settings.SLACK_ALERT_WEBHOOK_URL:
        try:
            payload = {
                "text": f"[Caption Studio Alert] {window_key} failure ratio is high: {failure_count}/{total} ({ratio:.1%})"
            }
            req = urllib.request.Request(
                settings.SLACK_ALERT_WEBHOOK_URL,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            _urlopen_https_only(req, timeout=5)
        except Exception as e:
            _json_log("warning", "alert_webhook_failed", error=str(e))


def _audit_action(action: str, uid: str = "", metadata: Optional[Dict[str, Any]] = None):
    payload = {
        "action": action,
        "uid": uid or "anonymous",
        "metadata": metadata or {},
        "timestamp": _utcnow().isoformat() + "Z",
    }
    _json_log("info", "audit_action", **payload)
    _enqueue_telemetry("audit_logs", payload, retention_days=365)
