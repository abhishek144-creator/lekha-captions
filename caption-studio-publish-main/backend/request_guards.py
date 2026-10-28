"""Idempotency keys, rate limits, failure throttles and per-account processing slots.

Callers use it as a module (`request_guards.NAME`), so a test patches one
place and every caller sees it.
"""

import hashlib
import ipaddress
import json
import re
import time
import uuid
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException, Request, Response
from google.api_core.exceptions import AlreadyExists
from typing import Any, Dict, Optional


try:
    from . import settings
    from . import app_state
    from . import firebase_admin_setup
    from . import observability
    from . import export_jobs
    from . import export_api
    from .job_state import LOCAL_LOCK as JOB_STATE_LOCK
except ImportError:  # Direct execution from backend/ remains supported.
    import settings
    import app_state
    import firebase_admin_setup
    import observability
    import export_jobs
    import export_api
    from job_state import LOCAL_LOCK as JOB_STATE_LOCK


def _idem_get(key: str):
    if not key:
        return None
    if app_state._redis_client is not None:
        try:
            raw = app_state._redis_client.get(f"idem:{key}")
            return json.loads(raw) if raw else None
        except Exception:
            return None
    return app_state._export_idempotency.get(key)


def _idem_claim(key: str, value: Dict[str, Any]) -> bool:
    if app_state._redis_client is not None:
        try:
            return bool(app_state._redis_client.set(f"idem:{key}", json.dumps(value), nx=True, ex=6 * 3600))
        except Exception as error:
            raise HTTPException(status_code=503, detail="Export safety service is unavailable") from error
    with JOB_STATE_LOCK:
        if key in app_state._export_idempotency:
            return False
        app_state._export_idempotency[key] = value
        return True


def _idem_set(key: str, value: Dict[str, Any], ttl_seconds: int = 6 * 3600):
    if not key:
        return
    if app_state._redis_client is not None:
        try:
            app_state._redis_client.setex(f"idem:{key}", ttl_seconds, json.dumps(value))
            return
        except Exception:
            pass
    app_state._export_idempotency[key] = value


def _idem_delete(key: str):
    if not key:
        return
    if app_state._redis_client is not None:
        try:
            app_state._redis_client.delete(f"idem:{key}")
            return
        except Exception:
            pass
    app_state._export_idempotency.pop(key, None)


def _upload_idem_key(uid: str, upload_reference: str) -> str:
    """Create a non-guessable storage key for an upload retry receipt."""
    return hashlib.sha256(f"{uid}:{upload_reference}".encode("utf-8")).hexdigest()


def _upload_idem_get(uid: str, upload_reference: str):
    if not upload_reference:
        return None
    key = _upload_idem_key(uid, upload_reference)
    if app_state._redis_client is not None:
        try:
            raw = app_state._redis_client.get(f"upload_idem:{key}")
            return json.loads(raw) if raw else None
        except Exception as e:
            observability._json_log("warning", "upload_idempotency_read_failed", error=str(e))
    return app_state._upload_idempotency.get(key)


def _upload_idem_set(uid: str, upload_reference: str, value: Dict[str, Any], ttl_seconds: int = 24 * 3600):
    if not upload_reference:
        return
    key = _upload_idem_key(uid, upload_reference)
    if app_state._redis_client is not None:
        try:
            app_state._redis_client.setex(f"upload_idem:{key}", ttl_seconds, json.dumps(value))
            return
        except Exception as e:
            observability._json_log("warning", "upload_idempotency_write_failed", error=str(e))
    app_state._upload_idempotency[key] = value


def _payment_idem_get(key: str):
    if not key:
        return None
    if app_state._redis_client is not None:
        try:
            raw = app_state._redis_client.get(f"pay_idem:{key}")
            return json.loads(raw) if raw else None
        except Exception as e:
            observability._json_log("error", "payment_idempotency_read_failed", error=str(e))
            raise HTTPException(status_code=503, detail="Payment safety service is temporarily unavailable") from e

    if settings._IS_TEST:
        return app_state._payment_idempotency.get(key)
    db = firebase_admin_setup.get_db()
    if db:
        try:
            doc_id = hashlib.sha256(key.encode("utf-8")).hexdigest()
            snap = db.collection("payment_idempotency").document(doc_id).get()
            return snap.to_dict() if snap.exists else None
        except Exception as e:
            observability._json_log("error", "payment_idempotency_firestore_read_failed", error=str(e))
            raise HTTPException(status_code=503, detail="Payment safety service is temporarily unavailable") from e
    if settings._IS_PRODUCTION:
        raise HTTPException(status_code=503, detail="Payment safety service is unavailable")
    return app_state._payment_idempotency.get(key)


def _payment_idem_set(key: str, value: Dict[str, Any], ttl_seconds: int = 24 * 3600):
    if not key:
        return
    if app_state._redis_client is not None:
        try:
            app_state._redis_client.setex(f"pay_idem:{key}", ttl_seconds, json.dumps(value))
            return
        except Exception as e:
            observability._json_log("error", "payment_idempotency_write_failed", error=str(e))
            raise HTTPException(status_code=503, detail="Payment safety service is temporarily unavailable") from e

    if settings._IS_TEST:
        app_state._payment_idempotency[key] = value
        return
    db = firebase_admin_setup.get_db()
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
            observability._json_log("error", "payment_idempotency_firestore_write_failed", error=str(e))
            raise HTTPException(status_code=503, detail="Payment safety service is temporarily unavailable") from e
    if settings._IS_PRODUCTION:
        raise HTTPException(status_code=503, detail="Payment safety service is unavailable")
    app_state._payment_idempotency[key] = value


def _payment_idem_claim(key: str, ttl_seconds: int = 24 * 3600) -> bool:
    """Atomically claim a payment operation key before calling Razorpay."""
    if not key:
        return True
    value = {"status": "in_progress", "ts": time.time()}
    if app_state._redis_client is not None:
        try:
            return bool(app_state._redis_client.set(
                f"pay_idem:{key}", json.dumps(value), ex=ttl_seconds, nx=True
            ))
        except Exception as e:
            observability._json_log("error", "payment_idempotency_claim_failed", error=str(e))
            raise HTTPException(status_code=503, detail="Payment safety service is temporarily unavailable") from e

    if settings._IS_TEST:
        if key in app_state._payment_idempotency:
            return False
        app_state._payment_idempotency[key] = value
        return True
    db = firebase_admin_setup.get_db()
    if db:
        try:
            doc_id = hashlib.sha256(key.encode("utf-8")).hexdigest()
            db.collection("payment_idempotency").document(doc_id).create({
                **value,
                "key_hash": doc_id,
                "expire_at": datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds),
            })
            return True
        except AlreadyExists:
            return False
        except Exception as e:
            observability._json_log("error", "payment_idempotency_firestore_claim_failed", error=str(e))
            raise HTTPException(status_code=503, detail="Payment safety service is temporarily unavailable") from e
    if settings._IS_PRODUCTION:
        raise HTTPException(status_code=503, detail="Payment safety service is unavailable")
    if key in app_state._payment_idempotency:
        return False
    app_state._payment_idempotency[key] = value
    return True


def _payment_idem_delete(key: str):
    if not key:
        return
    if app_state._redis_client is not None:
        try:
            app_state._redis_client.delete(f"pay_idem:{key}")
            return
        except Exception as e:
            observability._json_log("error", "payment_idempotency_delete_failed", error=str(e))
            raise HTTPException(status_code=503, detail="Payment safety service is temporarily unavailable") from e

    if settings._IS_TEST:
        app_state._payment_idempotency.pop(key, None)
        return
    db = firebase_admin_setup.get_db()
    if db:
        try:
            doc_id = hashlib.sha256(key.encode("utf-8")).hexdigest()
            db.collection("payment_idempotency").document(doc_id).delete()
            return
        except Exception as e:
            observability._json_log("error", "payment_idempotency_firestore_delete_failed", error=str(e))
            raise HTTPException(status_code=503, detail="Payment safety service is temporarily unavailable") from e
    if settings._IS_PRODUCTION:
        raise HTTPException(status_code=503, detail="Payment safety service is unavailable")
    app_state._payment_idempotency.pop(key, None)


def _require_payment_idempotency(uid: str, key: str, op: str) -> str:
    if not settings.REQUIRE_PAYMENT_IDEMPOTENCY:
        return ""
    safe = (key or "").strip()
    if not safe:
        raise HTTPException(status_code=400, detail=f"Missing idempotency key for {op}")
    if len(safe) > 200 or not re.fullmatch(r"[A-Za-z0-9:._-]+", safe):
        raise HTTPException(status_code=400, detail="Invalid payment idempotency key")
    return f"{uid}:{op}:{safe}"


def _rate_limit_namespace(store: Dict[str, list]) -> str:
    for candidate, namespace in app_state._RATE_LIMIT_NAMESPACES:
        if store is candidate:
            return namespace
    return "generic"


def _rate_limit_redis_key(store: Dict[str, list], key: str) -> str:
    return f"rl:{_rate_limit_namespace(store)}:{key}"


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
    if app_state._redis_client is not None:
        try:
            now_ts = time.time()
            admitted, retry_after, remaining = app_state._redis_client.eval(
                settings.RATE_ADMISSION_SCRIPT, 1, _rate_limit_redis_key(store, key),
                now_ts, window, limit, uuid.uuid4().hex,
            )
            return bool(admitted), int(retry_after), int(remaining)
        except Exception as e:
            if settings._IS_PRODUCTION:
                observability._json_log("error", "rate_limit_redis_failed", key=key, error=str(e))
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


def _enforce_draft_save_rate(uid: str):
    allowed, retry_after, _remaining = _check_rate(
        app_state._draft_save_rate, uid, settings.DRAFT_SAVE_USER_RATE_LIMIT, settings.DRAFT_SAVE_RATE_WINDOW,
    )
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail="Saving too often. Your latest changes will be saved shortly.",
            headers={"Retry-After": str(retry_after)},
        )


def _record_export_failure(uid: str):
    key = f"expfail:{uid}"
    now_ts = time.time()
    if app_state._redis_client is not None:
        try:
            pipe = app_state._redis_client.pipeline()
            pipe.zremrangebyscore(key, 0, now_ts - settings.EXPORT_FAILURE_WINDOW)
            pipe.zadd(key, {f"{now_ts}:{uuid.uuid4().hex[:8]}": now_ts})
            pipe.expire(key, settings.EXPORT_FAILURE_WINDOW + 10)
            pipe.execute()
            return
        except Exception:
            pass
    fail_key = f"fail:{uid}"
    arr = [t for t in app_state._export_failures.get(fail_key, []) if t > now_ts - settings.EXPORT_FAILURE_WINDOW]
    arr.append(now_ts)
    app_state._export_failures[fail_key] = arr


def _get_recent_export_failures(uid: str) -> list:
    key = f"expfail:{uid}"
    now_ts = time.time()
    if app_state._redis_client is not None:
        try:
            app_state._redis_client.zremrangebyscore(key, 0, now_ts - settings.EXPORT_FAILURE_WINDOW)
            vals = app_state._redis_client.zrange(key, 0, -1, withscores=True)
            return [float(v[1]) for v in vals]
        except Exception:
            pass
    fail_key = f"fail:{uid}"
    arr = [t for t in app_state._export_failures.get(fail_key, []) if t > now_ts - settings.EXPORT_FAILURE_WINDOW]
    app_state._export_failures[fail_key] = arr
    return arr


def _acquire_export_slot(uid: str, job_id: str) -> bool:
    if not uid or not job_id:
        return False
    if app_state._redis_client is not None:
        try:
            k = f"expactive:{uid}"
            acquired = app_state._redis_client.set(k, job_id, nx=True, ex=settings.EXPORT_SLOT_TTL_SECONDS)
            if acquired:
                return True
            current = app_state._redis_client.get(k)
            if isinstance(current, bytes):
                current = current.decode("utf-8", errors="ignore")
            if current == job_id:
                app_state._redis_client.expire(k, settings.EXPORT_SLOT_TTL_SECONDS)
                return True
            # A worker can fail before entering run_export_job_task (for
            # example, when an old worker cannot deserialize a newer argument
            # contract). In that case its finally block never releases the
            # lease. Reclaim only when the durable job/RQ state proves the
            # previous owner is already terminal; never steal a live render.
            previous_job_id = str(current or "")
            previous_terminal = False
            try:
                previous_job = export_jobs._load_export_job(previous_job_id) or {}
                previous_status = str(previous_job.get("status") or "").lower()
                previous_terminal = previous_status in {
                    "completed", "failed", "cancelled", "canceled", "stopped",
                }
                if not previous_terminal and app_state._export_queue is not None:
                    previous_queue = export_api._queue_for_export_job_record(previous_job)
                    rq_job = previous_queue.fetch_job(previous_job_id) if previous_queue else None
                    if rq_job is not None:
                        rq_status = rq_job.get_status(refresh=True)
                        rq_status_value = str(getattr(rq_status, "value", rq_status)).lower()
                        previous_terminal = rq_status_value in {
                            "finished", "failed", "stopped", "cancelled", "canceled",
                        }
            except Exception as state_error:
                observability._json_log(
                    "warning",
                    "export_slot_recovery_check_failed",
                    uid=uid,
                    previous_job_id=previous_job_id,
                    error=type(state_error).__name__,
                )
            if previous_terminal:
                removed = app_state._redis_client.eval(
                    "if redis.call('get', KEYS[1]) == ARGV[1] then "
                    "return redis.call('del', KEYS[1]) else return 0 end",
                    1,
                    k,
                    previous_job_id,
                )
                if removed:
                    acquired = app_state._redis_client.set(k, job_id, nx=True, ex=settings.EXPORT_SLOT_TTL_SECONDS)
                    if acquired:
                        observability._json_log(
                            "warning",
                            "stale_export_slot_recovered",
                            uid=uid,
                            previous_job_id=previous_job_id,
                            job_id=job_id,
                        )
                        return True
            return False
        except Exception as e:
            observability._json_log("error", "export_slot_acquire_failed", uid=uid, job_id=job_id, error=str(e))
            if settings._IS_PRODUCTION or app_state._export_queue is not None:
                return False
    current = app_state._active_exports_by_user.get(uid)
    if current and current != job_id:
        return False
    app_state._active_exports_by_user[uid] = job_id
    return True


def _release_export_slot(uid: str, job_id: str):
    if not uid or not job_id:
        return
    if app_state._redis_client is not None:
        try:
            k = f"expactive:{uid}"
            app_state._redis_client.eval(
                "if redis.call('get', KEYS[1]) == ARGV[1] then "
                "return redis.call('del', KEYS[1]) else return 0 end",
                1,
                k,
                job_id,
            )
            return
        except Exception:
            pass
    if app_state._active_exports_by_user.get(uid) == job_id:
        app_state._active_exports_by_user.pop(uid, None)


def _acquire_process_slot(uid: str, request_id: str) -> bool:
    """Allow one paid transcription call per user across all API instances."""
    if not uid or not request_id:
        return False
    if app_state._redis_client is not None:
        try:
            return bool(
                app_state._redis_client.set(
                    f"procactive:{uid}",
                    request_id,
                    nx=True,
                    ex=settings.PROCESS_SLOT_TTL_SECONDS,
                )
            )
        except Exception as e:
            observability._json_log("error", "process_slot_acquire_failed", uid=uid, request_id=request_id, error=str(e))
            if settings._IS_PRODUCTION:
                return False
    if app_state._active_processes_by_user.get(uid):
        return False
    app_state._active_processes_by_user[uid] = request_id
    return True


def _release_process_slot(uid: str, request_id: str):
    if not uid or not request_id:
        return
    if app_state._redis_client is not None:
        try:
            app_state._redis_client.eval(
                "if redis.call('get', KEYS[1]) == ARGV[1] then "
                "return redis.call('del', KEYS[1]) else return 0 end",
                1,
                f"procactive:{uid}",
                request_id,
            )
            return
        except Exception:
            pass
    if app_state._active_processes_by_user.get(uid) == request_id:
        app_state._active_processes_by_user.pop(uid, None)


def _apply_rate_headers(response: Optional[Response], limit: int, remaining: int, retry_after: int = 0):
    if response is None:
        return
    response.headers["X-RateLimit-Limit"] = str(limit)
    response.headers["X-RateLimit-Remaining"] = str(max(0, remaining))
    if retry_after > 0:
        response.headers["Retry-After"] = str(retry_after)
