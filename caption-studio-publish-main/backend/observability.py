"""Structured logs, alerts, telemetry, circuit breaking and SLO metrics for the API.

The factory accepts explicit configuration, adapters and shared state through
ServiceContext. It has no dependency on the HTTP entry point.
"""

from types import SimpleNamespace
from typing import Protocol, Any
from typing import Dict
from typing import List
from typing import Optional
from fastapi import Request
import asyncio
from datetime import datetime
import json
import math
import os
import time
from datetime import timedelta
from datetime import timezone
import urllib.request
import urllib.parse
import uuid

class ServiceContext(Protocol):
    API_CURRENT_VERSION: Any
    ERROR_BUDGET_WINDOW_MIN_EVENTS: Any
    SLACK_ALERT_WEBHOOK_URL: Any
    SLO_EXPORT_P95_MS_TARGET: Any
    SLO_EXPORT_SUCCESS_TARGET: Any
    SLO_PROCESS_P95_MS_TARGET: Any
    SLO_PROCESS_SUCCESS_TARGET: Any
    TELEMETRY_BATCH_SIZE: Any
    TELEMETRY_QUEUE_LIMIT: Any
    _analytics_counters: Any
    _analytics_daily_counters: Any
    _analytics_last_alert_ts: Any
    _enqueue_telemetry: Any
    _flush_telemetry: Any
    _json_log: Any
    _logger: Any
    _operational_metric_samples: Any
    _p95: Any
    _read_operational_metric_samples: Any
    _redis_client: Any
    _retention_deadline: Any
    _route_latency_samples: Any
    _telemetry_buffer: Any
    _telemetry_lock: Any
    _urlopen_https_only: Any
    _utcnow: Any
    get_db: Any


def create_observability(context: ServiceContext) -> SimpleNamespace:
    def _utcnow() -> datetime:
        """Return naive UTC for compatibility with existing persisted timestamp formats."""
        return datetime.now(timezone.utc).replace(tzinfo=None)


    def _json_log(level: str, event: str, **fields):
        record = {
            "timestamp": context._utcnow().isoformat() + "Z",
            "level": level.upper(),
            "event": event,
            "service": os.environ.get("SERVICE_ROLE", "api"),
            "environment": os.environ.get("APP_ENV", "unknown"),
            "release": os.environ.get("APP_RELEASE", ""),
            **fields,
        }
        line = json.dumps(record, ensure_ascii=True, default=str)
        if level.lower() in ("error", "warning"):
            context._logger.warning(line) if level.lower() == "warning" else context._logger.error(line)
        else:
            context._logger.info(line)


    def _send_alert(text: str):
        context._json_log("warning", "ops_alert", text=text)
        if not context.SLACK_ALERT_WEBHOOK_URL:
            return False
        try:
            payload = {"text": text}
            req = urllib.request.Request(
                context.SLACK_ALERT_WEBHOOK_URL,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            context._urlopen_https_only(req, timeout=5)
            return True
        except Exception as e:
            context._json_log("warning", "alert_webhook_failed", error=str(e))
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
        row = {**payload, "expire_at": context._retention_deadline(retention_days)}
        dropped = False
        with context._telemetry_lock:
            if len(context._telemetry_buffer) >= context.TELEMETRY_QUEUE_LIMIT:
                context._telemetry_buffer.popleft()
                dropped = True
            context._telemetry_buffer.append((collection_name, row))
        if dropped:
            context._json_log("warning", "telemetry_buffer_overflow", collection=collection_name)


    def _flush_telemetry():
        db = context.get_db()
        if not db:
            return 0
        rows = []
        with context._telemetry_lock:
            while context._telemetry_buffer and len(rows) < context.TELEMETRY_BATCH_SIZE:
                rows.append(context._telemetry_buffer.popleft())
        if not rows:
            return 0
        try:
            batch = db.batch()
            for collection_name, payload in rows:
                batch.set(db.collection(collection_name).document(), payload)
            batch.commit()
            return len(rows)
        except Exception as e:
            with context._telemetry_lock:
                for row in reversed(rows):
                    context._telemetry_buffer.appendleft(row)
            context._json_log("warning", "telemetry_batch_persist_failed", count=len(rows), error=str(e))
            return 0


    async def _telemetry_flush_loop():
        while True:
            await asyncio.sleep(5)
            await asyncio.to_thread(context._flush_telemetry)


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
        context._json_log("info", "app_log", request_id=rid, message=msg)


    def _track_event(event: str, payload: Optional[Dict[str, Any]] = None):
        context._analytics_counters[event] = context._analytics_counters.get(event, 0) + 1
        day_key = context._utcnow().date().isoformat()
        daily = context._analytics_daily_counters.setdefault(day_key, {})
        daily[event] = daily.get(event, 0) + 1
        if context._redis_client is not None:
            try:
                context._redis_client.hincrby("analytics:counters", event, 1)
                redis_daily_key = f"analytics:daily:{day_key}"
                context._redis_client.hincrby(redis_daily_key, event, 1)
                context._redis_client.expire(redis_daily_key, 120 * 24 * 3600)
            except Exception:
                pass
        context._json_log("info", "analytics_event", name=event, payload=payload or {})
        context._enqueue_telemetry("analytics_events", {
            "event": event,
            "payload": payload or {},
            "timestamp": context._utcnow().isoformat() + "Z",
        }, retention_days=30)


    def _track_latency_sample(path: str, duration_ms: int, max_samples: int = 300):
        if path not in ("/api/process", "/api/export"):
            return
        arr = context._route_latency_samples.setdefault(path, [])
        arr.append(int(duration_ms))
        if len(arr) > max_samples:
            del arr[:-max_samples]
        if context._redis_client is not None:
            try:
                k = f"latency:{path}"
                context._redis_client.rpush(k, int(duration_ms))
                context._redis_client.ltrim(k, -max_samples, -1)
                context._redis_client.expire(k, 24 * 3600)
                day_key = context._utcnow().date().isoformat()
                daily_key = f"latency:{day_key}:{path}"
                context._redis_client.rpush(daily_key, int(duration_ms))
                context._redis_client.ltrim(daily_key, -max_samples, -1)
                context._redis_client.expire(daily_key, 120 * 24 * 3600)
            except Exception:
                pass


    def _track_operational_metric_sample(name: str, value: float, max_samples: int = 2_000):
        if not math.isfinite(float(value)):
            return
        day_key = context._utcnow().date().isoformat()
        sample_key = f"{day_key}:{name}"
        samples = context._operational_metric_samples.setdefault(sample_key, [])
        samples.append(float(value))
        if len(samples) > max_samples:
            del samples[:-max_samples]
        if context._redis_client is not None:
            try:
                redis_key = f"opsmetric:{sample_key}"
                context._redis_client.rpush(redis_key, float(value))
                context._redis_client.ltrim(redis_key, -max_samples, -1)
                context._redis_client.expire(redis_key, 120 * 24 * 3600)
            except Exception:
                pass


    def _read_operational_metric_samples(day_key: str, name: str) -> List[float]:
        sample_key = f"{day_key}:{name}"
        values = list(context._operational_metric_samples.get(sample_key, []))
        if context._redis_client is not None:
            try:
                redis_values = [
                    float(value)
                    for value in (context._redis_client.lrange(f"opsmetric:{sample_key}", 0, -1) or [])
                ]
                if redis_values:
                    values = redis_values
            except Exception:
                pass
        return values


    def _read_daily_analytics_counters(day_key: str) -> Dict[str, int]:
        counters = dict(context._analytics_daily_counters.get(day_key, {}))
        if context._redis_client is not None:
            try:
                redis_counters = context._redis_client.hgetall(f"analytics:daily:{day_key}") or {}
                if redis_counters:
                    counters = {key: int(value) for key, value in redis_counters.items()}
            except Exception:
                pass
        return counters


    def _read_daily_latency_samples(day_key: str, path: str) -> List[int]:
        if day_key == context._utcnow().date().isoformat():
            values = list(context._route_latency_samples.get(path, []))
        else:
            values = []
        if context._redis_client is not None:
            try:
                redis_values = [
                    int(value)
                    for value in (context._redis_client.lrange(f"latency:{day_key}:{path}", 0, -1) or [])
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
        export_success = context._analytics_counters.get("export_success", 0)
        export_failed = context._analytics_counters.get("export_failed_http", 0) + context._analytics_counters.get("export_failed_exception", 0)
        process_success = context._analytics_counters.get("process_success", 0)
        process_failed = context._analytics_counters.get("process_failed", 0)
        if context._redis_client is not None:
            try:
                counters = context._redis_client.hgetall("analytics:counters") or {}
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
        export_samples = context._read_operational_metric_samples(context._utcnow().date().isoformat(), "export_total_ms")
        process_samples = context._route_latency_samples.get("/api/process", [])
        if context._redis_client is not None:
            try:
                r_process = [int(x) for x in context._redis_client.lrange("latency:/api/process", 0, -1) or []]
                if r_process:
                    process_samples = r_process
            except Exception:
                pass
        export_p95 = context._p95(export_samples)
        process_p95 = context._p95(process_samples)
        release_gate_passed = (
            (export_total < context.ERROR_BUDGET_WINDOW_MIN_EVENTS or export_rate >= context.SLO_EXPORT_SUCCESS_TARGET)
            and (process_total < context.ERROR_BUDGET_WINDOW_MIN_EVENTS or process_rate >= context.SLO_PROCESS_SUCCESS_TARGET)
            and (export_p95 == 0 or export_p95 <= context.SLO_EXPORT_P95_MS_TARGET)
            and (process_p95 == 0 or process_p95 <= context.SLO_PROCESS_P95_MS_TARGET)
        )
        return {
            "success": True,
            "api_version": context.API_CURRENT_VERSION,
            "release_gate_passed": release_gate_passed,
            "targets": {
                "export_success_rate": context.SLO_EXPORT_SUCCESS_TARGET,
                "process_success_rate": context.SLO_PROCESS_SUCCESS_TARGET,
                "export_p95_ms": context.SLO_EXPORT_P95_MS_TARGET,
                "process_p95_ms": context.SLO_PROCESS_P95_MS_TARGET,
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
            "timestamp": context._utcnow().isoformat() + "Z",
        }


    def _maybe_alert_failure_ratio(window_key: str, success_count: int, failure_count: int):
        total = success_count + failure_count
        if total < 20:
            return
        ratio = failure_count / max(total, 1)
        if ratio < 0.2:
            return
        now_ts = time.time()
        if now_ts - context._analytics_last_alert_ts.get(window_key, 0.0) < 600:
            return
        context._analytics_last_alert_ts[window_key] = now_ts
        context._json_log(
            "warning",
            "failure_ratio_alert",
            window_key=window_key,
            success_count=success_count,
            failure_count=failure_count,
            ratio=ratio,
        )
        if context.SLACK_ALERT_WEBHOOK_URL:
            try:
                payload = {
                    "text": f"[Caption Studio Alert] {window_key} failure ratio is high: {failure_count}/{total} ({ratio:.1%})"
                }
                req = urllib.request.Request(
                    context.SLACK_ALERT_WEBHOOK_URL,
                    data=json.dumps(payload).encode("utf-8"),
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )
                context._urlopen_https_only(req, timeout=5)
            except Exception as e:
                context._json_log("warning", "alert_webhook_failed", error=str(e))


    def _audit_action(action: str, uid: str = "", metadata: Optional[Dict[str, Any]] = None):
        payload = {
            "action": action,
            "uid": uid or "anonymous",
            "metadata": metadata or {},
            "timestamp": context._utcnow().isoformat() + "Z",
        }
        context._json_log("info", "audit_action", **payload)
        context._enqueue_telemetry("audit_logs", payload, retention_days=365)

    return SimpleNamespace(
        _utcnow=_utcnow,
        _json_log=_json_log,
        _send_alert=_send_alert,
        _urlopen_https_only=_urlopen_https_only,
        _retention_deadline=_retention_deadline,
        _enqueue_telemetry=_enqueue_telemetry,
        _flush_telemetry=_flush_telemetry,
        _telemetry_flush_loop=_telemetry_flush_loop,
        CircuitBreaker=CircuitBreaker,
        _request_id=_request_id,
        _log=_log,
        _track_event=_track_event,
        _track_latency_sample=_track_latency_sample,
        _track_operational_metric_sample=_track_operational_metric_sample,
        _read_operational_metric_samples=_read_operational_metric_samples,
        _read_daily_analytics_counters=_read_daily_analytics_counters,
        _read_daily_latency_samples=_read_daily_latency_samples,
        _p95=_p95,
        _build_slo_snapshot=_build_slo_snapshot,
        _maybe_alert_failure_ratio=_maybe_alert_failure_ratio,
        _audit_action=_audit_action,
    )
