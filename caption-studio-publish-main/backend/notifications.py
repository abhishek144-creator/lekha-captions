"""Durable, account-scoped in-app notifications."""

from __future__ import annotations

import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Callable

from fastapi import APIRouter, HTTPException, Request


COLLECTION = "user_notifications"


def create_notification(
    database: Any,
    uid: str,
    *,
    kind: str,
    title: str,
    message: str,
    action_url: str = "",
    resource_id: str = "",
) -> dict:
    if database is None or not uid:
        return {}
    notification_id = uuid.uuid4().hex
    record = {
        "id": notification_id,
        "uid": uid,
        "kind": kind[:64],
        "title": title[:160],
        "message": message[:500],
        "action_url": action_url[:500],
        "resource_id": resource_id[:160],
        "created_at": time.time(),
        "expire_at": datetime.now(timezone.utc) + timedelta(days=90),
        "read_at": None,
    }
    database.collection(COLLECTION).document(notification_id).set(record)
    return record


def create_notification_router(
    authenticate_request: Callable[[Request], dict],
    get_database: Callable[[], Any],
) -> APIRouter:
    router = APIRouter()

    def require_database():
        database = get_database()
        if database is None:
            raise HTTPException(503, "Notification storage is unavailable")
        return database

    @router.get("/api/notifications")
    def list_notifications(request: Request, limit: int = 30):
        uid = authenticate_request(request)["uid"]
        safe_limit = max(1, min(int(limit), 100))
        query = (
            require_database().collection(COLLECTION)
            .where("uid", "==", uid)
            .order_by("created_at", direction="DESCENDING")
            .limit(safe_limit)
        )
        items = []
        for snapshot in query.stream():
            value = snapshot.to_dict() or {}
            if value.get("uid") == uid:
                items.append(value)
        return {
            "success": True,
            "notifications": items,
            "unread_count": sum(1 for item in items if not item.get("read_at")),
        }

    @router.post("/api/notifications/{notification_id}/read")
    def mark_notification_read(notification_id: str, request: Request):
        uid = authenticate_request(request)["uid"]
        if not notification_id or len(notification_id) > 160:
            raise HTTPException(400, "Invalid notification id")
        reference = require_database().collection(COLLECTION).document(notification_id)
        snapshot = reference.get()
        value = snapshot.to_dict() if snapshot.exists else None
        if not value:
            raise HTTPException(404, "Notification not found")
        if value.get("uid") != uid:
            raise HTTPException(403, "Notification does not belong to this account")
        read_at = time.time()
        reference.update({"read_at": read_at})
        return {"success": True, "id": notification_id, "read_at": read_at}

    return router
