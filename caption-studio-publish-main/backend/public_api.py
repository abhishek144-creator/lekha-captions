"""Versioned public read API and revocable account API keys."""

from __future__ import annotations

import hashlib
import os
import secrets
import threading
import time
import uuid
from collections import defaultdict, deque
from typing import Any, Callable, Dict, Set

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

try:
    import redis
except ImportError:  # Local development without Redis remains supported.
    redis = None


ALLOWED_SCOPES = {"projects:read", "exports:read"}
API_KEY_PREFIX = "lk_live_"


class CreateApiKeyRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    scopes: Set[str] = Field(default_factory=lambda: {"projects:read", "exports:read"}, min_length=1)


class ApiKeyRateLimiter:
    def __init__(self, hourly_limit: int = 1_000, redis_client=None):
        self.hourly_limit = max(1, hourly_limit)
        self._events: Dict[str, deque] = defaultdict(deque)
        self._lock = threading.Lock()
        self._strict = os.environ.get("ENV", "").lower() == "production"
        redis_url = (os.environ.get("REDIS_URL") or "").strip()
        self._redis = redis_client if redis_client is not None else (
            redis.Redis.from_url(
                redis_url, decode_responses=True,
                socket_connect_timeout=1, socket_timeout=1,
            ) if redis is not None and redis_url else None
        )

    def check(self, key_id: str) -> None:
        now = time.time()
        if self._redis is not None:
            try:
                # A sorted set keeps the rolling-hour behavior across every API
                # instance. The script prunes, checks and admits atomically.
                allowed = self._redis.eval("""
                    redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', tonumber(ARGV[1]) - 3600)
                    if redis.call('ZCARD', KEYS[1]) >= tonumber(ARGV[2]) then return 0 end
                    redis.call('ZADD', KEYS[1], ARGV[1], ARGV[3])
                    redis.call('EXPIRE', KEYS[1], 3600)
                    return 1
                """, 1, f"lekha:public-api-rate:{key_id}", now, self.hourly_limit, uuid.uuid4().hex)
                if not allowed:
                    raise HTTPException(429, "API key hourly rate limit exceeded", headers={"Retry-After": "60"})
                return
            except HTTPException:
                raise
            except Exception as exc:
                if self._strict:
                    raise HTTPException(503, "API key rate limiting is unavailable") from exc
        elif self._strict:
            raise HTTPException(503, "API key rate limiting is unavailable")
        with self._lock:
            events = self._events[key_id]
            while events and events[0] <= now - 3600:
                events.popleft()
            if len(events) >= self.hourly_limit:
                raise HTTPException(429, "API key hourly rate limit exceeded", headers={"Retry-After": "60"})
            events.append(now)


def _hash_key(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def create_public_api_router(
    *,
    authenticate_request: Callable[[Request], dict],
    get_database: Callable[[], Any],
    list_account_projects: Callable[[Any, str], list],
    read_account_project: Callable[[Any, str, str], dict],
    load_export_job: Callable[[str], dict],
) -> APIRouter:
    router = APIRouter()
    limiter = ApiKeyRateLimiter(int(os.environ.get("PUBLIC_API_KEY_HOURLY_LIMIT", "1000")))

    def database():
        value = get_database()
        if value is None:
            raise HTTPException(503, "Developer API storage is unavailable")
        return value

    def authenticate_api_key(request: Request, scope: str) -> dict:
        raw = (request.headers.get("x-api-key") or "").strip()
        if not raw.startswith(API_KEY_PREFIX) or len(raw) > 200:
            raise HTTPException(401, "A valid X-API-Key is required")
        key_hash = _hash_key(raw)
        snapshot = database().collection("api_keys").document(key_hash).get()
        record = snapshot.to_dict() if snapshot.exists else None
        if not record or record.get("revoked_at"):
            raise HTTPException(401, "API key is invalid or revoked")
        if scope not in set(record.get("scopes") or []):
            raise HTTPException(403, f"API key requires {scope} scope")
        limiter.check(key_hash)
        return record

    @router.post("/api/developer/api-keys", status_code=201)
    def create_api_key(req: CreateApiKeyRequest, request: Request):
        decoded = authenticate_request(request)
        uid = decoded["uid"]
        scopes = sorted(req.scopes)
        if any(scope not in ALLOWED_SCOPES for scope in scopes):
            raise HTTPException(422, "Unknown API key scope")
        raw = API_KEY_PREFIX + secrets.token_urlsafe(32)
        key_hash = _hash_key(raw)
        key_id = uuid.uuid4().hex
        record = {
            "key_id": key_id,
            "uid": uid,
            "name": req.name.strip(),
            "scopes": scopes,
            "prefix": raw[:16],
            "created_at": time.time(),
            "revoked_at": None,
        }
        database().collection("api_keys").document(key_hash).set(record)
        database().collection("users").document(uid).collection("api_key_index").document(key_id).set({
            **record,
            "key_hash": key_hash,
        })
        return {"success": True, "api_key": raw, "key": {k: v for k, v in record.items() if k != "uid"}}

    @router.get("/api/developer/api-keys")
    def list_api_keys(request: Request):
        uid = authenticate_request(request)["uid"]
        rows = []
        for snapshot in database().collection("users").document(uid).collection("api_key_index").stream():
            value = snapshot.to_dict() or {}
            value.pop("key_hash", None)
            value.pop("uid", None)
            rows.append(value)
        rows.sort(key=lambda item: float(item.get("created_at") or 0), reverse=True)
        return {"success": True, "keys": rows}

    @router.delete("/api/developer/api-keys/{key_id}")
    def revoke_api_key(key_id: str, request: Request):
        uid = authenticate_request(request)["uid"]
        index_ref = database().collection("users").document(uid).collection("api_key_index").document(key_id)
        snapshot = index_ref.get()
        record = snapshot.to_dict() if snapshot.exists else None
        if not record:
            raise HTTPException(404, "API key not found")
        revoked_at = time.time()
        database().collection("api_keys").document(record["key_hash"]).update({"revoked_at": revoked_at})
        index_ref.update({"revoked_at": revoked_at})
        return {"success": True, "key_id": key_id, "revoked_at": revoked_at}

    @router.get("/api/v1/projects")
    def public_list_projects(request: Request):
        principal = authenticate_api_key(request, "projects:read")
        return {"object": "list", "data": list_account_projects(database(), principal["uid"])}

    @router.get("/api/v1/projects/{project_id}")
    def public_get_project(project_id: str, request: Request):
        principal = authenticate_api_key(request, "projects:read")
        project = read_account_project(database(), principal["uid"], project_id)
        if not project.get("draft"):
            raise HTTPException(404, "Project not found")
        return {"object": "project", **project}

    @router.get("/api/v1/exports/{job_id}")
    def public_get_export(job_id: str, request: Request):
        principal = authenticate_api_key(request, "exports:read")
        job = load_export_job(job_id) or {}
        if not job:
            raise HTTPException(404, "Export job not found")
        if job.get("uid") != principal["uid"]:
            raise HTTPException(403, "Export job does not belong to this API key")
        return {
            "object": "export",
            "id": job_id,
            "status": job.get("status", "unknown"),
            "created_at": job.get("queue_entered_at") or job.get("started_at"),
            "completed_at": job.get("completed_at"),
            "result": job.get("payload") if job.get("status") == "completed" else None,
            "error": "Export failed. Retry the request." if job.get("error") else None,
        }

    return router
