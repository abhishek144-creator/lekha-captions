"""Idempotency keys, rate limits, failure throttles and per-account processing slots.

The factory accepts explicit configuration, adapters and shared state through
ServiceContext. It has no dependency on the HTTP entry point.
"""

from types import SimpleNamespace
from typing import Protocol, Any
from typing import Dict
from fastapi import HTTPException
from typing import Optional
from fastapi import Request
from fastapi import Response
from datetime import datetime
import hashlib
import ipaddress
import json
import re
import time
from datetime import timedelta
from datetime import timezone
import uuid

class ServiceContext(Protocol):
    AlreadyExists: Any
    EXPORT_FAILURE_WINDOW: Any
    EXPORT_SLOT_TTL_SECONDS: Any
    JOB_STATE_LOCK: Any
    PROCESS_SLOT_TTL_SECONDS: Any
    RATE_ADMISSION_SCRIPT: Any
    REQUIRE_PAYMENT_IDEMPOTENCY: Any
    _IS_PRODUCTION: Any
    _IS_TEST: Any
    _RATE_LIMIT_NAMESPACES: Any
    _active_exports_by_user: Any
    _active_processes_by_user: Any
    _export_failures: Any
    _export_idempotency: Any
    _export_queue: Any
    _json_log: Any
    _load_export_job: Any
    _payment_idempotency: Any
    _queue_for_export_job_record: Any
    _rate_limit_namespace: Any
    _rate_limit_redis_key: Any
    _redis_client: Any
    _upload_idem_key: Any
    _upload_idempotency: Any
    get_db: Any


def create_request_guards(context: ServiceContext) -> SimpleNamespace:
    def _idem_get(key: str):
        if not key:
            return None
        if context._redis_client is not None:
            try:
                raw = context._redis_client.get(f"idem:{key}")
                return json.loads(raw) if raw else None
            except Exception:
                return None
        return context._export_idempotency.get(key)


    def _idem_claim(key: str, value: Dict[str, Any]) -> bool:
        if context._redis_client is not None:
            try:
                return bool(context._redis_client.set(f"idem:{key}", json.dumps(value), nx=True, ex=6 * 3600))
            except Exception as error:
                raise HTTPException(status_code=503, detail="Export safety service is unavailable") from error
        with context.JOB_STATE_LOCK:
            if key in context._export_idempotency:
                return False
            context._export_idempotency[key] = value
            return True


    def _idem_set(key: str, value: Dict[str, Any], ttl_seconds: int = 6 * 3600):
        if not key:
            return
        if context._redis_client is not None:
            try:
                context._redis_client.setex(f"idem:{key}", ttl_seconds, json.dumps(value))
                return
            except Exception:
                pass
        context._export_idempotency[key] = value


    def _idem_delete(key: str):
        if not key:
            return
        if context._redis_client is not None:
            try:
                context._redis_client.delete(f"idem:{key}")
                return
            except Exception:
                pass
        context._export_idempotency.pop(key, None)


    def _upload_idem_key(uid: str, upload_reference: str) -> str:
        """Create a non-guessable storage key for an upload retry receipt."""
        return hashlib.sha256(f"{uid}:{upload_reference}".encode("utf-8")).hexdigest()


    def _upload_idem_get(uid: str, upload_reference: str):
        if not upload_reference:
            return None
        key = context._upload_idem_key(uid, upload_reference)
        if context._redis_client is not None:
            try:
                raw = context._redis_client.get(f"upload_idem:{key}")
                return json.loads(raw) if raw else None
            except Exception as e:
                context._json_log("warning", "upload_idempotency_read_failed", error=str(e))
        return context._upload_idempotency.get(key)


    def _upload_idem_set(uid: str, upload_reference: str, value: Dict[str, Any], ttl_seconds: int = 24 * 3600):
        if not upload_reference:
            return
        key = context._upload_idem_key(uid, upload_reference)
        if context._redis_client is not None:
            try:
                context._redis_client.setex(f"upload_idem:{key}", ttl_seconds, json.dumps(value))
                return
            except Exception as e:
                context._json_log("warning", "upload_idempotency_write_failed", error=str(e))
        context._upload_idempotency[key] = value


    def _payment_idem_get(key: str):
        if not key:
            return None
        if context._redis_client is not None:
            try:
                raw = context._redis_client.get(f"pay_idem:{key}")
                return json.loads(raw) if raw else None
            except Exception as e:
                context._json_log("error", "payment_idempotency_read_failed", error=str(e))
                raise HTTPException(status_code=503, detail="Payment safety service is temporarily unavailable") from e

        if context._IS_TEST:
            return context._payment_idempotency.get(key)
        db = context.get_db()
        if db:
            try:
                doc_id = hashlib.sha256(key.encode("utf-8")).hexdigest()
                snap = db.collection("payment_idempotency").document(doc_id).get()
                return snap.to_dict() if snap.exists else None
            except Exception as e:
                context._json_log("error", "payment_idempotency_firestore_read_failed", error=str(e))
                raise HTTPException(status_code=503, detail="Payment safety service is temporarily unavailable") from e
        if context._IS_PRODUCTION:
            raise HTTPException(status_code=503, detail="Payment safety service is unavailable")
        return context._payment_idempotency.get(key)


    def _payment_idem_set(key: str, value: Dict[str, Any], ttl_seconds: int = 24 * 3600):
        if not key:
            return
        if context._redis_client is not None:
            try:
                context._redis_client.setex(f"pay_idem:{key}", ttl_seconds, json.dumps(value))
                return
            except Exception as e:
                context._json_log("error", "payment_idempotency_write_failed", error=str(e))
                raise HTTPException(status_code=503, detail="Payment safety service is temporarily unavailable") from e

        if context._IS_TEST:
            context._payment_idempotency[key] = value
            return
        db = context.get_db()
        if db:
            try:
                doc_id = hashlib.sha256(key.encode("utf-8")).hexdigest()
                db.collection("payment_idempotency").document(doc_id).set({
                    **value,
                    "key_hash": doc_id,
                    "expire_at": datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds),
                })
                return
            except Exception as e:
                context._json_log("error", "payment_idempotency_firestore_write_failed", error=str(e))
                raise HTTPException(status_code=503, detail="Payment safety service is temporarily unavailable") from e
        if context._IS_PRODUCTION:
            raise HTTPException(status_code=503, detail="Payment safety service is unavailable")
        context._payment_idempotency[key] = value


    def _payment_idem_claim(key: str, ttl_seconds: int = 24 * 3600) -> bool:
        """Atomically claim a payment operation key before calling Razorpay."""
        if not key:
            return True
        value = {"status": "in_progress", "ts": time.time()}
        if context._redis_client is not None:
            try:
                return bool(context._redis_client.set(
                    f"pay_idem:{key}", json.dumps(value), ex=ttl_seconds, nx=True
                ))
            except Exception as e:
                context._json_log("error", "payment_idempotency_claim_failed", error=str(e))
                raise HTTPException(status_code=503, detail="Payment safety service is temporarily unavailable") from e

        if context._IS_TEST:
            if key in context._payment_idempotency:
                return False
            context._payment_idempotency[key] = value
            return True
        db = context.get_db()
        if db:
            try:
                doc_id = hashlib.sha256(key.encode("utf-8")).hexdigest()
                db.collection("payment_idempotency").document(doc_id).create({
                    **value,
                    "key_hash": doc_id,
                    "expire_at": datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds),
                })
                return True
            except context.AlreadyExists:
                return False
            except Exception as e:
                context._json_log("error", "payment_idempotency_firestore_claim_failed", error=str(e))
                raise HTTPException(status_code=503, detail="Payment safety service is temporarily unavailable") from e
        if context._IS_PRODUCTION:
            raise HTTPException(status_code=503, detail="Payment safety service is unavailable")
        if key in context._payment_idempotency:
            return False
        context._payment_idempotency[key] = value
        return True


    def _payment_idem_delete(key: str):
        if not key:
            return
        if context._redis_client is not None:
            try:
                context._redis_client.delete(f"pay_idem:{key}")
                return
            except Exception as e:
                context._json_log("error", "payment_idempotency_delete_failed", error=str(e))
                raise HTTPException(status_code=503, detail="Payment safety service is temporarily unavailable") from e

        if context._IS_TEST:
            context._payment_idempotency.pop(key, None)
            return
        db = context.get_db()
        if db:
            try:
                doc_id = hashlib.sha256(key.encode("utf-8")).hexdigest()
                db.collection("payment_idempotency").document(doc_id).delete()
                return
            except Exception as e:
                context._json_log("error", "payment_idempotency_firestore_delete_failed", error=str(e))
                raise HTTPException(status_code=503, detail="Payment safety service is temporarily unavailable") from e
        if context._IS_PRODUCTION:
            raise HTTPException(status_code=503, detail="Payment safety service is unavailable")
        context._payment_idempotency.pop(key, None)


    def _require_payment_idempotency(uid: str, key: str, op: str) -> str:
        if not context.REQUIRE_PAYMENT_IDEMPOTENCY:
            return ""
        safe = (key or "").strip()
        if not safe:
            raise HTTPException(status_code=400, detail=f"Missing idempotency key for {op}")
        if len(safe) > 200 or not re.fullmatch(r"[A-Za-z0-9:._-]+", safe):
            raise HTTPException(status_code=400, detail="Invalid payment idempotency key")
        return f"{uid}:{op}:{safe}"


    def _rate_limit_namespace(store: Dict[str, list]) -> str:
        for candidate, namespace in context._RATE_LIMIT_NAMESPACES:
            if store is candidate:
                return namespace
        return "generic"


    def _rate_limit_redis_key(store: Dict[str, list], key: str) -> str:
        return f"rl:{context._rate_limit_namespace(store)}:{key}"


    def _client_rate_key(request: Request) -> str:
        """Return the end-user address when Railway is the immediate peer."""
        peer = (request.client.host if request.client else "").strip()
        try:
            peer_is_public = ipaddress.ip_address(peer).is_global
        except ValueError:
            peer_is_public = False
        if peer_is_public:
            return peer

        # Railway documents X-Real-IP as the original client address. Keep a final
        # X-Forwarded-For fallback for compatible local/reverse-proxy deployments.
        forwarded_candidates = [request.headers.get("x-real-ip", "")]
        forwarded_for = request.headers.get("x-forwarded-for", "")
        forwarded_candidates.extend(reversed(forwarded_for.split(",")))
        for candidate in forwarded_candidates:
            safe_candidate = candidate.strip().strip("[]")
            try:
                ipaddress.ip_address(safe_candidate)
                return safe_candidate
            except ValueError:
                continue
        return peer or "unknown"


    def _check_rate(store: Dict[str, list], key: str, limit: int, window: int = 3600):
        """Returns (allowed, retry_after_seconds, remaining).
    Mutates *store* in-place to record the current timestamp."""
        if context._redis_client is not None:
            try:
                now_ts = time.time()
                admitted, retry_after, remaining = context._redis_client.eval(
                    context.RATE_ADMISSION_SCRIPT, 1, context._rate_limit_redis_key(store, key),
                    now_ts, window, limit, uuid.uuid4().hex,
                )
                return bool(admitted), int(retry_after), int(remaining)
            except Exception as e:
                if context._IS_PRODUCTION:
                    context._json_log("error", "rate_limit_redis_failed", key=key, error=str(e))
                    raise HTTPException(status_code=503, detail="Rate-limit service is temporarily unavailable") from e
                # Local and test environments may use the per-process fallback.
                pass

        now_ts = time.time()
        timestamps = [t for t in store.get(key, []) if t > now_ts - window]
        if len(timestamps) >= limit:
            store[key] = timestamps
            retry_after = max(1, int(window - (now_ts - min(timestamps)))) if timestamps else window
            return False, retry_after, 0
        timestamps.append(now_ts)
        store[key] = timestamps
        remaining = max(0, limit - len(timestamps))
        return True, 0, remaining


    def _record_export_failure(uid: str):
        key = f"expfail:{uid}"
        now_ts = time.time()
        if context._redis_client is not None:
            try:
                pipe = context._redis_client.pipeline()
                pipe.zremrangebyscore(key, 0, now_ts - context.EXPORT_FAILURE_WINDOW)
                pipe.zadd(key, {f"{now_ts}:{uuid.uuid4().hex[:8]}": now_ts})
                pipe.expire(key, context.EXPORT_FAILURE_WINDOW + 10)
                pipe.execute()
                return
            except Exception:
                pass
        fail_key = f"fail:{uid}"
        arr = [t for t in context._export_failures.get(fail_key, []) if t > now_ts - context.EXPORT_FAILURE_WINDOW]
        arr.append(now_ts)
        context._export_failures[fail_key] = arr


    def _get_recent_export_failures(uid: str) -> list:
        key = f"expfail:{uid}"
        now_ts = time.time()
        if context._redis_client is not None:
            try:
                context._redis_client.zremrangebyscore(key, 0, now_ts - context.EXPORT_FAILURE_WINDOW)
                vals = context._redis_client.zrange(key, 0, -1, withscores=True)
                return [float(v[1]) for v in vals]
            except Exception:
                pass
        fail_key = f"fail:{uid}"
        arr = [t for t in context._export_failures.get(fail_key, []) if t > now_ts - context.EXPORT_FAILURE_WINDOW]
        context._export_failures[fail_key] = arr
        return arr


    def _acquire_export_slot(uid: str, job_id: str) -> bool:
        if not uid or not job_id:
            return False
        if context._redis_client is not None:
            try:
                k = f"expactive:{uid}"
                acquired = context._redis_client.set(k, job_id, nx=True, ex=context.EXPORT_SLOT_TTL_SECONDS)
                if acquired:
                    return True
                current = context._redis_client.get(k)
                if isinstance(current, bytes):
                    current = current.decode("utf-8", errors="ignore")
                if current == job_id:
                    context._redis_client.expire(k, context.EXPORT_SLOT_TTL_SECONDS)
                    return True
                # A worker can fail before entering run_export_job_task (for
                # example, when an old worker cannot deserialize a newer argument
                # contract). In that case its finally block never releases the
                # lease. Reclaim only when the durable job/RQ state proves the
                # previous owner is already terminal; never steal a live render.
                previous_job_id = str(current or "")
                previous_terminal = False
                try:
                    previous_job = context._load_export_job(previous_job_id) or {}
                    previous_status = str(previous_job.get("status") or "").lower()
                    previous_terminal = previous_status in {
                        "completed", "failed", "cancelled", "canceled", "stopped",
                    }
                    if not previous_terminal and context._export_queue is not None:
                        previous_queue = context._queue_for_export_job_record(previous_job)
                        rq_job = previous_queue.fetch_job(previous_job_id) if previous_queue else None
                        if rq_job is not None:
                            rq_status = rq_job.get_status(refresh=True)
                            rq_status_value = str(getattr(rq_status, "value", rq_status)).lower()
                            previous_terminal = rq_status_value in {
                                "finished", "failed", "stopped", "cancelled", "canceled",
                            }
                except Exception as state_error:
                    context._json_log(
                        "warning",
                        "export_slot_recovery_check_failed",
                        uid=uid,
                        previous_job_id=previous_job_id,
                        error=type(state_error).__name__,
                    )
                if previous_terminal:
                    removed = context._redis_client.eval(
                        "if redis.call('get', KEYS[1]) == ARGV[1] then "
                    "return redis.call('del', KEYS[1]) else return 0 end",
                        1,
                        k,
                        previous_job_id,
                    )
                    if removed:
                        acquired = context._redis_client.set(k, job_id, nx=True, ex=context.EXPORT_SLOT_TTL_SECONDS)
                        if acquired:
                            context._json_log(
                                "warning",
                                "stale_export_slot_recovered",
                                uid=uid,
                                previous_job_id=previous_job_id,
                                job_id=job_id,
                            )
                            return True
                return False
            except Exception as e:
                context._json_log("error", "export_slot_acquire_failed", uid=uid, job_id=job_id, error=str(e))
                if context._IS_PRODUCTION or context._export_queue is not None:
                    return False
        current = context._active_exports_by_user.get(uid)
        if current and current != job_id:
            return False
        context._active_exports_by_user[uid] = job_id
        return True


    def _release_export_slot(uid: str, job_id: str):
        if not uid or not job_id:
            return
        if context._redis_client is not None:
            try:
                k = f"expactive:{uid}"
                context._redis_client.eval(
                    "if redis.call('get', KEYS[1]) == ARGV[1] then "
                "return redis.call('del', KEYS[1]) else return 0 end",
                    1,
                    k,
                    job_id,
                )
                return
            except Exception:
                pass
        if context._active_exports_by_user.get(uid) == job_id:
            context._active_exports_by_user.pop(uid, None)


    def _acquire_process_slot(uid: str, request_id: str) -> bool:
        """Allow one paid transcription call per user across all API instances."""
        if not uid or not request_id:
            return False
        if context._redis_client is not None:
            try:
                return bool(
                    context._redis_client.set(
                        f"procactive:{uid}",
                        request_id,
                        nx=True,
                        ex=context.PROCESS_SLOT_TTL_SECONDS,
                    )
                )
            except Exception as e:
                context._json_log("error", "process_slot_acquire_failed", uid=uid, request_id=request_id, error=str(e))
                if context._IS_PRODUCTION:
                    return False
        if context._active_processes_by_user.get(uid):
            return False
        context._active_processes_by_user[uid] = request_id
        return True


    def _release_process_slot(uid: str, request_id: str):
        if not uid or not request_id:
            return
        if context._redis_client is not None:
            try:
                context._redis_client.eval(
                    "if redis.call('get', KEYS[1]) == ARGV[1] then "
                "return redis.call('del', KEYS[1]) else return 0 end",
                    1,
                    f"procactive:{uid}",
                    request_id,
                )
                return
            except Exception:
                pass
        if context._active_processes_by_user.get(uid) == request_id:
            context._active_processes_by_user.pop(uid, None)


    def _apply_rate_headers(response: Optional[Response], limit: int, remaining: int, retry_after: int = 0):
        if response is None:
            return
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(max(0, remaining))
        if retry_after > 0:
            response.headers["Retry-After"] = str(retry_after)

    return SimpleNamespace(
        _idem_get=_idem_get,
        _idem_claim=_idem_claim,
        _idem_set=_idem_set,
        _idem_delete=_idem_delete,
        _upload_idem_key=_upload_idem_key,
        _upload_idem_get=_upload_idem_get,
        _upload_idem_set=_upload_idem_set,
        _payment_idem_get=_payment_idem_get,
        _payment_idem_set=_payment_idem_set,
        _payment_idem_claim=_payment_idem_claim,
        _payment_idem_delete=_payment_idem_delete,
        _require_payment_idempotency=_require_payment_idempotency,
        _rate_limit_namespace=_rate_limit_namespace,
        _rate_limit_redis_key=_rate_limit_redis_key,
        _client_rate_key=_client_rate_key,
        _check_rate=_check_rate,
        _record_export_failure=_record_export_failure,
        _get_recent_export_failures=_get_recent_export_failures,
        _acquire_export_slot=_acquire_export_slot,
        _release_export_slot=_release_export_slot,
        _acquire_process_slot=_acquire_process_slot,
        _release_process_slot=_release_process_slot,
        _apply_rate_headers=_apply_rate_headers,
    )
