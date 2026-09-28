"""Small, deterministic circuit breaker for external transcription providers.

The registry is process-local by design: each worker protects itself from
repeated calls to a provider that is failing.  Successful probe traffic closes
the circuit after the cooldown.  The policy is intentionally independent from
SDK exception types so Sarvam and OpenAI follow the same rules.
"""

from __future__ import annotations

import os
import threading
import time
from dataclasses import dataclass
from typing import Callable, Dict

try:
    import redis
except ImportError:  # Local tests do not require Redis.
    redis = None


@dataclass
class _ProviderState:
    consecutive_failures: int = 0
    opened_at: float = 0.0
    last_success_at: float = 0.0
    last_failure_at: float = 0.0


class ProviderCircuitBreaker:
    def __init__(
        self,
        failure_threshold: int = 3,
        cooldown_seconds: float = 60.0,
        clock: Callable[[], float] = time.time,
    ):
        self.failure_threshold = max(1, int(failure_threshold))
        self.cooldown_seconds = max(1.0, float(cooldown_seconds))
        self._clock = clock
        self._states: Dict[str, _ProviderState] = {}
        self._lock = threading.Lock()
        redis_url = (os.environ.get("REDIS_URL") or "").strip()
        self._redis = (
            redis.Redis.from_url(
                redis_url,
                decode_responses=True,
                socket_connect_timeout=1,
                socket_timeout=1,
            )
            if redis is not None and redis_url else None
        )

    def _key(self, provider: str) -> str:
        return f"lekha:transcription-provider-health:{provider}"

    def _redis_allow_request(self, provider: str) -> bool:
        now = self._clock()
        key = self._key(provider)
        script = """
        local opened = tonumber(redis.call('HGET', KEYS[1], 'opened_at') or '0')
        if opened == 0 then return 1 end
        if tonumber(ARGV[1]) - opened < tonumber(ARGV[2]) then return 0 end
        if redis.call('SET', KEYS[2], ARGV[1], 'NX', 'EX', math.ceil(tonumber(ARGV[2]))) then
          return 1
        end
        return 0
        """
        return bool(self._redis.eval(
            script,
            2,
            key,
            f"{key}:half-open-probe",
            now,
            self.cooldown_seconds,
        ))

    def allow_request(self, provider: str) -> bool:
        if self._redis is not None:
            try:
                return self._redis_allow_request(provider)
            except Exception:
                pass
        with self._lock:
            state = self._states.setdefault(provider, _ProviderState())
            if not state.opened_at:
                return True
            # Permit one half-open probe after the cooldown. Moving opened_at
            # forward prevents a thundering herd of probes in the same worker.
            if self._clock() - state.opened_at >= self.cooldown_seconds:
                state.opened_at = self._clock()
                return True
            return False

    def record_success(self, provider: str) -> None:
        if self._redis is not None:
            try:
                key = self._key(provider)
                pipeline = self._redis.pipeline()
                pipeline.hset(key, mapping={
                    "consecutive_failures": 0,
                    "opened_at": 0,
                    "last_success_at": self._clock(),
                })
                pipeline.delete(f"{key}:half-open-probe")
                pipeline.expire(key, 7 * 24 * 3600)
                pipeline.execute()
            except Exception:
                pass
        with self._lock:
            state = self._states.setdefault(provider, _ProviderState())
            state.consecutive_failures = 0
            state.opened_at = 0.0
            state.last_success_at = self._clock()

    def record_failure(self, provider: str) -> None:
        if self._redis is not None:
            try:
                now = self._clock()
                script = """
                local failures = redis.call('HINCRBY', KEYS[1], 'consecutive_failures', 1)
                redis.call('HSET', KEYS[1], 'last_failure_at', ARGV[1])
                if failures >= tonumber(ARGV[2]) then
                  redis.call('HSET', KEYS[1], 'opened_at', ARGV[1])
                end
                redis.call('DEL', KEYS[2])
                redis.call('EXPIRE', KEYS[1], 604800)
                return failures
                """
                self._redis.eval(
                    script,
                    2,
                    self._key(provider),
                    f"{self._key(provider)}:half-open-probe",
                    now,
                    self.failure_threshold,
                )
            except Exception:
                pass
        with self._lock:
            state = self._states.setdefault(provider, _ProviderState())
            state.consecutive_failures += 1
            state.last_failure_at = self._clock()
            if state.consecutive_failures >= self.failure_threshold:
                state.opened_at = state.opened_at or self._clock()

    def snapshot(self) -> Dict[str, dict]:
        if self._redis is not None:
            try:
                result = {}
                for provider in ("sarvam", "openai"):
                    raw = self._redis.hgetall(self._key(provider))
                    failures = int(raw.get("consecutive_failures") or 0)
                    opened_at = float(raw.get("opened_at") or 0)
                    now = self._clock()
                    result[provider] = {
                        "status": "open" if opened_at and now - opened_at < self.cooldown_seconds else "half_open" if opened_at else "healthy",
                        "consecutive_failures": failures,
                        "last_success_at": float(raw.get("last_success_at") or 0) or None,
                        "last_failure_at": float(raw.get("last_failure_at") or 0) or None,
                        "retry_after_seconds": max(0, round(self.cooldown_seconds - (now - opened_at), 1)) if opened_at else 0,
                    }
                return result
            except Exception:
                pass
        now = self._clock()
        with self._lock:
            return {
                provider: {
                    "status": (
                        "open"
                        if state.opened_at and now - state.opened_at < self.cooldown_seconds
                        else "half_open"
                        if state.opened_at
                        else "healthy"
                    ),
                    "consecutive_failures": state.consecutive_failures,
                    "last_success_at": state.last_success_at or None,
                    "last_failure_at": state.last_failure_at or None,
                    "retry_after_seconds": (
                        max(0, round(self.cooldown_seconds - (now - state.opened_at), 1))
                        if state.opened_at else 0
                    ),
                }
                for provider, state in self._states.items()
            }


transcription_provider_health = ProviderCircuitBreaker(
    failure_threshold=int(os.environ.get("TRANSCRIPTION_PROVIDER_FAILURE_THRESHOLD", "3")),
    cooldown_seconds=float(os.environ.get("TRANSCRIPTION_PROVIDER_COOLDOWN_SECONDS", "60")),
)
