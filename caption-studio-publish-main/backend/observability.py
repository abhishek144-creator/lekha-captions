"""Structured logs, alerts, telemetry, circuit breaking and SLO metrics for the API.

Helpers resolve shared state through ``host`` (the main module) at call
time, so there is one copy of each helper and test patches on ``main``
keep applying.
"""

from types import ModuleType, SimpleNamespace

try:
    from . import settings
except ImportError:  # Direct execution from backend/ remains supported.
    import settings
try:
    from . import app_state
except ImportError:  # Direct execution from backend/ remains supported.
    import app_state


def create_observability(host: ModuleType) -> SimpleNamespace:
    def _utcnow() -> host.datetime:
        """Return naive UTC for compatibility with existing persisted timestamp formats."""
        return host.datetime.now(host.timezone.utc).replace(tzinfo=None)


    def _json_log(level: str, event: str, **fields):
        record = {
            "timestamp": host._utcnow().isoformat() + "Z",
            "level": level.upper(),
            "event": event,
            "service": host.os.environ.get("SERVICE_ROLE", "api"),
            "environment": host.os.environ.get("APP_ENV", "unknown"),
            "release": host.os.environ.get("APP_RELEASE", ""),
            **fields,
        }
        line = host.json.dumps(record, ensure_ascii=True, default=str)
        if level.lower() in ("error", "warning"):
            app_state._logger.warning(line) if level.lower() == "warning" else app_state._logger.error(line)
        else:
            app_state._logger.info(line)


    def _send_alert(text: str):
        host._json_log("warning", "ops_alert", text=text)
        if not settings.SLACK_ALERT_WEBHOOK_URL:
            return False
        try:
            payload = {"text": text}
            req = host.urllib.request.Request(
                settings.SLACK_ALERT_WEBHOOK_URL,
                data=host.json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            host._urlopen_https_only(req, timeout=5)
            return True
        except Exception as e:
            host._json_log("warning", "alert_webhook_failed", error=str(e))
            return False


    def _urlopen_https_only(req, timeout: int = 5):
        url = getattr(req, "full_url", str(req))
        parsed = host.urllib.parse.urlparse(url)
        if parsed.scheme != "https":
            raise ValueError("Only https URLs are allowed for outbound requests")
        return host.urllib.request.urlopen(req, timeout=timeout)  # nosec B310


    def _retention_deadline(days: int) -> host.datetime:
        return host.datetime.now(host.timezone.utc) + host.timedelta(days=max(1, int(days)))


    def _enqueue_telemetry(collection_name: str, payload: host.Dict[str, host.Any], retention_days: int):
        row = {**payload, "expire_at": host._retention_deadline(retention_days)}
        dropped = False
        with app_state._telemetry_lock:
            if len(app_state._telemetry_buffer) >= settings.TELEMETRY_QUEUE_LIMIT:
                app_state._telemetry_buffer.popleft()
                dropped = True
            app_state._telemetry_buffer.append((collection_name, row))
        if dropped:
            host._json_log("warning", "telemetry_buffer_overflow", collection=collection_name)


    def _flush_telemetry():
        db = host.get_db()
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
            with app_state._telemetry_lock:
                for row in reversed(rows):
                    app_state._telemetry_buffer.appendleft(row)
            host._json_log("warning", "telemetry_batch_persist_failed", count=len(rows), error=str(e))
            return 0


    async def _telemetry_flush_loop():
        while True:
            await host.asyncio.sleep(5)
            await host.asyncio.to_thread(host._flush_telemetry)


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
                if (host.time.time() - self._opened_at) >= self.cooldown_seconds:
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
                self._opened_at = host.time.time()


    def _request_id(request: host.Optional[host.Request]) -> str:
        if request is None:
            return str(host.uuid.uuid4())[:8]
        state_rid = str(getattr(request.state, "request_id", "") or "").strip()
        if state_rid:
            return state_rid[:64]
        rid = request.headers.get("x-request-id")
        return rid.strip()[:64] if rid else str(host.uuid.uuid4())[:8]


    def _log(rid: str, msg: str):
        host._json_log("info", "app_log", request_id=rid, message=msg)


    def _track_event(event: str, payload: host.Optional[host.Dict[str, host.Any]] = None):
        app_state._analytics_counters[event] = app_state._analytics_counters.get(event, 0) + 1
        day_key = host._utcnow().date().isoformat()
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
        host._json_log("info", "analytics_event", name=event, payload=payload or {})
        host._enqueue_telemetry("analytics_events", {
            "event": event,
            "payload": payload or {},
            "timestamp": host._utcnow().isoformat() + "Z",
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
                day_key = host._utcnow().date().isoformat()
                daily_key = f"latency:{day_key}:{path}"
                app_state._redis_client.rpush(daily_key, int(duration_ms))
                app_state._redis_client.ltrim(daily_key, -max_samples, -1)
                app_state._redis_client.expire(daily_key, 120 * 24 * 3600)
            except Exception:
                pass


    def _track_operational_metric_sample(name: str, value: float, max_samples: int = 2_000):
        if not host.math.isfinite(float(value)):
            return
        day_key = host._utcnow().date().isoformat()
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


    def _read_operational_metric_samples(day_key: str, name: str) -> host.List[float]:
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


    def _read_daily_analytics_counters(day_key: str) -> host.Dict[str, int]:
        counters = dict(app_state._analytics_daily_counters.get(day_key, {}))
        if app_state._redis_client is not None:
            try:
                redis_counters = app_state._redis_client.hgetall(f"analytics:daily:{day_key}") or {}
                if redis_counters:
                    counters = {key: int(value) for key, value in redis_counters.items()}
            except Exception:
                pass
        return counters


    def _read_daily_latency_samples(day_key: str, path: str) -> host.List[int]:
        if day_key == host._utcnow().date().isoformat():
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
        idx = max(0, host.math.ceil(0.95 * len(ordered)) - 1)
        return ordered[idx]


    def _build_slo_snapshot() -> host.Dict[str, host.Any]:
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
        export_samples = host._read_operational_metric_samples(host._utcnow().date().isoformat(), "export_total_ms")
        process_samples = app_state._route_latency_samples.get("/api/process", [])
        if app_state._redis_client is not None:
            try:
                r_process = [int(x) for x in app_state._redis_client.lrange("latency:/api/process", 0, -1) or []]
                if r_process:
                    process_samples = r_process
            except Exception:
                pass
        export_p95 = host._p95(export_samples)
        process_p95 = host._p95(process_samples)
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
            "timestamp": host._utcnow().isoformat() + "Z",
        }


    def _maybe_alert_failure_ratio(window_key: str, success_count: int, failure_count: int):
        total = success_count + failure_count
        if total < 20:
            return
        ratio = failure_count / max(total, 1)
        if ratio < 0.2:
            return
        now_ts = host.time.time()
        if now_ts - app_state._analytics_last_alert_ts.get(window_key, 0.0) < 600:
            return
        app_state._analytics_last_alert_ts[window_key] = now_ts
        host._json_log(
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
                req = host.urllib.request.Request(
                    settings.SLACK_ALERT_WEBHOOK_URL,
                    data=host.json.dumps(payload).encode("utf-8"),
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )
                host._urlopen_https_only(req, timeout=5)
            except Exception as e:
                host._json_log("warning", "alert_webhook_failed", error=str(e))


    def _audit_action(action: str, uid: str = "", metadata: host.Optional[host.Dict[str, host.Any]] = None):
        payload = {
            "action": action,
            "uid": uid or "anonymous",
            "metadata": metadata or {},
            "timestamp": host._utcnow().isoformat() + "Z",
        }
        host._json_log("info", "audit_action", **payload)
        host._enqueue_telemetry("audit_logs", payload, retention_days=365)

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
