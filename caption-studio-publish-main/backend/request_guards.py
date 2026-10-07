"""Idempotency keys, rate limits, failure throttles and per-account processing slots.

Helpers resolve shared state through ``host`` (the main module) at call
time, so there is one copy of each helper and test patches on ``main``
keep applying.
"""

from types import ModuleType, SimpleNamespace


def create_request_guards(host: ModuleType) -> SimpleNamespace:
    def _idem_get(key: str):
        if not key:
            return None
        if host._redis_client is not None:
            try:
                raw = host._redis_client.get(f"idem:{key}")
                return host.json.loads(raw) if raw else None
            except Exception:
                return None
        return host._export_idempotency.get(key)


    def _idem_claim(key: str, value: host.Dict[str, host.Any]) -> bool:
        if host._redis_client is not None:
            try:
                return bool(host._redis_client.set(f"idem:{key}", host.json.dumps(value), nx=True, ex=6 * 3600))
            except Exception as error:
                raise host.HTTPException(status_code=503, detail="Export safety service is unavailable") from error
        with host.JOB_STATE_LOCK:
            if key in host._export_idempotency:
                return False
            host._export_idempotency[key] = value
            return True


    def _idem_set(key: str, value: host.Dict[str, host.Any], ttl_seconds: int = 6 * 3600):
        if not key:
            return
        if host._redis_client is not None:
            try:
                host._redis_client.setex(f"idem:{key}", ttl_seconds, host.json.dumps(value))
                return
            except Exception:
                pass
        host._export_idempotency[key] = value


    def _idem_delete(key: str):
        if not key:
            return
        if host._redis_client is not None:
            try:
                host._redis_client.delete(f"idem:{key}")
                return
            except Exception:
                pass
        host._export_idempotency.pop(key, None)


    def _upload_idem_key(uid: str, upload_reference: str) -> str:
        """Create a non-guessable storage key for an upload retry receipt."""
        return host.hashlib.sha256(f"{uid}:{upload_reference}".encode("utf-8")).hexdigest()


    def _upload_idem_get(uid: str, upload_reference: str):
        if not upload_reference:
            return None
        key = host._upload_idem_key(uid, upload_reference)
        if host._redis_client is not None:
            try:
                raw = host._redis_client.get(f"upload_idem:{key}")
                return host.json.loads(raw) if raw else None
            except Exception as e:
                host._json_log("warning", "upload_idempotency_read_failed", error=str(e))
        return host._upload_idempotency.get(key)


    def _upload_idem_set(uid: str, upload_reference: str, value: host.Dict[str, host.Any], ttl_seconds: int = 24 * 3600):
        if not upload_reference:
            return
        key = host._upload_idem_key(uid, upload_reference)
        if host._redis_client is not None:
            try:
                host._redis_client.setex(f"upload_idem:{key}", ttl_seconds, host.json.dumps(value))
                return
            except Exception as e:
                host._json_log("warning", "upload_idempotency_write_failed", error=str(e))
        host._upload_idempotency[key] = value


    def _payment_idem_get(key: str):
        if not key:
            return None
        if host._redis_client is not None:
            try:
                raw = host._redis_client.get(f"pay_idem:{key}")
                return host.json.loads(raw) if raw else None
            except Exception as e:
                host._json_log("error", "payment_idempotency_read_failed", error=str(e))
                raise host.HTTPException(status_code=503, detail="Payment safety service is temporarily unavailable") from e

        if host._IS_TEST:
            return host._payment_idempotency.get(key)
        db = host.get_db()
        if db:
            try:
                doc_id = host.hashlib.sha256(key.encode("utf-8")).hexdigest()
                snap = db.collection("payment_idempotency").document(doc_id).get()
                return snap.to_dict() if snap.exists else None
            except Exception as e:
                host._json_log("error", "payment_idempotency_firestore_read_failed", error=str(e))
                raise host.HTTPException(status_code=503, detail="Payment safety service is temporarily unavailable") from e
        if host._IS_PRODUCTION:
            raise host.HTTPException(status_code=503, detail="Payment safety service is unavailable")
        return host._payment_idempotency.get(key)


    def _payment_idem_set(key: str, value: host.Dict[str, host.Any], ttl_seconds: int = 24 * 3600):
        if not key:
            return
        if host._redis_client is not None:
            try:
                host._redis_client.setex(f"pay_idem:{key}", ttl_seconds, host.json.dumps(value))
                return
            except Exception as e:
                host._json_log("error", "payment_idempotency_write_failed", error=str(e))
                raise host.HTTPException(status_code=503, detail="Payment safety service is temporarily unavailable") from e

        if host._IS_TEST:
            host._payment_idempotency[key] = value
            return
        db = host.get_db()
        if db:
            try:
                doc_id = host.hashlib.sha256(key.encode("utf-8")).hexdigest()
                db.collection("payment_idempotency").document(doc_id).set({
                    **value,
                    "key_hash": doc_id,
                    "expire_at": host.datetime.now(host.timezone.utc) + host.timedelta(seconds=ttl_seconds),
                })
                return
            except Exception as e:
                host._json_log("error", "payment_idempotency_firestore_write_failed", error=str(e))
                raise host.HTTPException(status_code=503, detail="Payment safety service is temporarily unavailable") from e
        if host._IS_PRODUCTION:
            raise host.HTTPException(status_code=503, detail="Payment safety service is unavailable")
        host._payment_idempotency[key] = value


    def _payment_idem_claim(key: str, ttl_seconds: int = 24 * 3600) -> bool:
        """Atomically claim a payment operation key before calling Razorpay."""
        if not key:
            return True
        value = {"status": "in_progress", "ts": host.time.time()}
        if host._redis_client is not None:
            try:
                return bool(host._redis_client.set(
                    f"pay_idem:{key}", host.json.dumps(value), ex=ttl_seconds, nx=True
                ))
            except Exception as e:
                host._json_log("error", "payment_idempotency_claim_failed", error=str(e))
                raise host.HTTPException(status_code=503, detail="Payment safety service is temporarily unavailable") from e

        if host._IS_TEST:
            if key in host._payment_idempotency:
                return False
            host._payment_idempotency[key] = value
            return True
        db = host.get_db()
        if db:
            try:
                doc_id = host.hashlib.sha256(key.encode("utf-8")).hexdigest()
                db.collection("payment_idempotency").document(doc_id).create({
                    **value,
                    "key_hash": doc_id,
                    "expire_at": host.datetime.now(host.timezone.utc) + host.timedelta(seconds=ttl_seconds),
                })
                return True
            except host.AlreadyExists:
                return False
            except Exception as e:
                host._json_log("error", "payment_idempotency_firestore_claim_failed", error=str(e))
                raise host.HTTPException(status_code=503, detail="Payment safety service is temporarily unavailable") from e
        if host._IS_PRODUCTION:
            raise host.HTTPException(status_code=503, detail="Payment safety service is unavailable")
        if key in host._payment_idempotency:
            return False
        host._payment_idempotency[key] = value
        return True


    def _payment_idem_delete(key: str):
        if not key:
            return
        if host._redis_client is not None:
            try:
                host._redis_client.delete(f"pay_idem:{key}")
                return
            except Exception as e:
                host._json_log("error", "payment_idempotency_delete_failed", error=str(e))
                raise host.HTTPException(status_code=503, detail="Payment safety service is temporarily unavailable") from e

        if host._IS_TEST:
            host._payment_idempotency.pop(key, None)
            return
        db = host.get_db()
        if db:
            try:
                doc_id = host.hashlib.sha256(key.encode("utf-8")).hexdigest()
                db.collection("payment_idempotency").document(doc_id).delete()
                return
            except Exception as e:
                host._json_log("error", "payment_idempotency_firestore_delete_failed", error=str(e))
                raise host.HTTPException(status_code=503, detail="Payment safety service is temporarily unavailable") from e
        if host._IS_PRODUCTION:
            raise host.HTTPException(status_code=503, detail="Payment safety service is unavailable")
        host._payment_idempotency.pop(key, None)


    def _require_payment_idempotency(uid: str, key: str, op: str) -> str:
        if not host.REQUIRE_PAYMENT_IDEMPOTENCY:
            return ""
        safe = (key or "").strip()
        if not safe:
            raise host.HTTPException(status_code=400, detail=f"Missing idempotency key for {op}")
        if len(safe) > 200 or not host.re.fullmatch(r"[A-Za-z0-9:._-]+", safe):
            raise host.HTTPException(status_code=400, detail="Invalid payment idempotency key")
        return f"{uid}:{op}:{safe}"


    def _rate_limit_namespace(store: host.Dict[str, list]) -> str:
        for candidate, namespace in host._RATE_LIMIT_NAMESPACES:
            if store is candidate:
                return namespace
        return "generic"


    def _rate_limit_redis_key(store: host.Dict[str, list], key: str) -> str:
        return f"rl:{host._rate_limit_namespace(store)}:{key}"


    def _client_rate_key(request: host.Request) -> str:
        """Return the end-user address when Railway is the immediate peer."""
        peer = (request.client.host if request.client else "").strip()
        try:
            peer_is_public = host.ipaddress.ip_address(peer).is_global
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
                host.ipaddress.ip_address(safe_candidate)
                return safe_candidate
            except ValueError:
                continue
        return peer or "unknown"


    def _check_rate(store: host.Dict[str, list], key: str, limit: int, window: int = 3600):
        """Returns (allowed, retry_after_seconds, remaining).
    Mutates *store* in-place to record the current timestamp."""
        if host._redis_client is not None:
            try:
                now_ts = host.time.time()
                admitted, retry_after, remaining = host._redis_client.eval(
                    host.RATE_ADMISSION_SCRIPT, 1, host._rate_limit_redis_key(store, key),
                    now_ts, window, limit, host.uuid.uuid4().hex,
                )
                return bool(admitted), int(retry_after), int(remaining)
            except Exception as e:
                if host._IS_PRODUCTION:
                    host._json_log("error", "rate_limit_redis_failed", key=key, error=str(e))
                    raise host.HTTPException(status_code=503, detail="Rate-limit service is temporarily unavailable") from e
                # Local and test environments may use the per-process fallback.
                pass

        now_ts = host.time.time()
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
        now_ts = host.time.time()
        if host._redis_client is not None:
            try:
                pipe = host._redis_client.pipeline()
                pipe.zremrangebyscore(key, 0, now_ts - host.EXPORT_FAILURE_WINDOW)
                pipe.zadd(key, {f"{now_ts}:{host.uuid.uuid4().hex[:8]}": now_ts})
                pipe.expire(key, host.EXPORT_FAILURE_WINDOW + 10)
                pipe.execute()
                return
            except Exception:
                pass
        fail_key = f"fail:{uid}"
        arr = [t for t in host._export_failures.get(fail_key, []) if t > now_ts - host.EXPORT_FAILURE_WINDOW]
        arr.append(now_ts)
        host._export_failures[fail_key] = arr


    def _get_recent_export_failures(uid: str) -> list:
        key = f"expfail:{uid}"
        now_ts = host.time.time()
        if host._redis_client is not None:
            try:
                host._redis_client.zremrangebyscore(key, 0, now_ts - host.EXPORT_FAILURE_WINDOW)
                vals = host._redis_client.zrange(key, 0, -1, withscores=True)
                return [float(v[1]) for v in vals]
            except Exception:
                pass
        fail_key = f"fail:{uid}"
        arr = [t for t in host._export_failures.get(fail_key, []) if t > now_ts - host.EXPORT_FAILURE_WINDOW]
        host._export_failures[fail_key] = arr
        return arr


    def _acquire_export_slot(uid: str, job_id: str) -> bool:
        if not uid or not job_id:
            return False
        if host._redis_client is not None:
            try:
                k = f"expactive:{uid}"
                acquired = host._redis_client.set(k, job_id, nx=True, ex=host.EXPORT_SLOT_TTL_SECONDS)
                if acquired:
                    return True
                current = host._redis_client.get(k)
                if isinstance(current, bytes):
                    current = current.decode("utf-8", errors="ignore")
                if current == job_id:
                    host._redis_client.expire(k, host.EXPORT_SLOT_TTL_SECONDS)
                    return True
                # A worker can fail before entering run_export_job_task (for
                # example, when an old worker cannot deserialize a newer argument
                # contract). In that case its finally block never releases the
                # lease. Reclaim only when the durable job/RQ state proves the
                # previous owner is already terminal; never steal a live render.
                previous_job_id = str(current or "")
                previous_terminal = False
                try:
                    previous_job = host._load_export_job(previous_job_id) or {}
                    previous_status = str(previous_job.get("status") or "").lower()
                    previous_terminal = previous_status in {
                        "completed", "failed", "cancelled", "canceled", "stopped",
                    }
                    if not previous_terminal and host._export_queue is not None:
                        previous_queue = host._queue_for_export_job_record(previous_job)
                        rq_job = previous_queue.fetch_job(previous_job_id) if previous_queue else None
                        if rq_job is not None:
                            rq_status = rq_job.get_status(refresh=True)
                            rq_status_value = str(getattr(rq_status, "value", rq_status)).lower()
                            previous_terminal = rq_status_value in {
                                "finished", "failed", "stopped", "cancelled", "canceled",
                            }
                except Exception as state_error:
                    host._json_log(
                        "warning",
                        "export_slot_recovery_check_failed",
                        uid=uid,
                        previous_job_id=previous_job_id,
                        error=type(state_error).__name__,
                    )
                if previous_terminal:
                    removed = host._redis_client.eval(
                        "if redis.call('get', KEYS[1]) == ARGV[1] then "
                    "return redis.call('del', KEYS[1]) else return 0 end",
                        1,
                        k,
                        previous_job_id,
                    )
                    if removed:
                        acquired = host._redis_client.set(k, job_id, nx=True, ex=host.EXPORT_SLOT_TTL_SECONDS)
                        if acquired:
                            host._json_log(
                                "warning",
                                "stale_export_slot_recovered",
                                uid=uid,
                                previous_job_id=previous_job_id,
                                job_id=job_id,
                            )
                            return True
                return False
            except Exception as e:
                host._json_log("error", "export_slot_acquire_failed", uid=uid, job_id=job_id, error=str(e))
                if host._IS_PRODUCTION or host._export_queue is not None:
                    return False
        current = host._active_exports_by_user.get(uid)
        if current and current != job_id:
            return False
        host._active_exports_by_user[uid] = job_id
        return True


    def _release_export_slot(uid: str, job_id: str):
        if not uid or not job_id:
            return
        if host._redis_client is not None:
            try:
                k = f"expactive:{uid}"
                host._redis_client.eval(
                    "if redis.call('get', KEYS[1]) == ARGV[1] then "
                "return redis.call('del', KEYS[1]) else return 0 end",
                    1,
                    k,
                    job_id,
                )
                return
            except Exception:
                pass
        if host._active_exports_by_user.get(uid) == job_id:
            host._active_exports_by_user.pop(uid, None)


    def _acquire_process_slot(uid: str, request_id: str) -> bool:
        """Allow one paid transcription call per user across all API instances."""
        if not uid or not request_id:
            return False
        if host._redis_client is not None:
            try:
                return bool(
                    host._redis_client.set(
                        f"procactive:{uid}",
                        request_id,
                        nx=True,
                        ex=host.PROCESS_SLOT_TTL_SECONDS,
                    )
                )
            except Exception as e:
                host._json_log("error", "process_slot_acquire_failed", uid=uid, request_id=request_id, error=str(e))
                if host._IS_PRODUCTION:
                    return False
        if host._active_processes_by_user.get(uid):
            return False
        host._active_processes_by_user[uid] = request_id
        return True


    def _release_process_slot(uid: str, request_id: str):
        if not uid or not request_id:
            return
        if host._redis_client is not None:
            try:
                host._redis_client.eval(
                    "if redis.call('get', KEYS[1]) == ARGV[1] then "
                "return redis.call('del', KEYS[1]) else return 0 end",
                    1,
                    f"procactive:{uid}",
                    request_id,
                )
                return
            except Exception:
                pass
        if host._active_processes_by_user.get(uid) == request_id:
            host._active_processes_by_user.pop(uid, None)


    def _apply_rate_headers(response: host.Optional[host.Response], limit: int, remaining: int, retry_after: int = 0):
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
