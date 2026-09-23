"""Browser-to-GCS resumable upload API."""
import os
import pathlib
import uuid

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field


class DirectUploadInitRequest(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    content_type: str = Field(default="application/octet-stream", max_length=160)
    size_bytes: int = Field(gt=0)


class DirectUploadCompleteRequest(BaseModel):
    file_id: str = Field(min_length=36, max_length=36)


def create_direct_upload_router(*, authenticate, extract_token, assert_service_available,
                                allowed_extensions, allowed_content_prefixes, allowed_origins,
                                max_upload_bytes, create_session, finalize_session,
                                remember_owner, signed_upload_url, audit_action,
                                reserve_slot=None, release_slot=None, cancel_session=None,
                                assert_account_active=None, rate_limit_network=None):
    router = APIRouter()

    @router.post("/api/uploads/init")
    def initialize_direct_upload(req: DirectUploadInitRequest, request: Request):
        assert_service_available("pause_uploads")
        if req.size_bytes > max_upload_bytes:
            raise HTTPException(413, "File too large")
        uid = authenticate(extract_token(request))["uid"]
        safe_name = os.path.basename(req.filename)
        extension = pathlib.Path(safe_name).suffix.lstrip(".").lower()
        content_type = req.content_type.lower().strip() or "application/octet-stream"
        if extension not in allowed_extensions:
            raise HTTPException(415, f"File type .{extension} is not supported")
        if content_type != "application/octet-stream" and not any(
            content_type.startswith(prefix) for prefix in allowed_content_prefixes
        ):
            raise HTTPException(415, "Unsupported media type")
        origin = str(request.headers.get("origin") or "").strip()
        if origin and origin not in allowed_origins:
            raise HTTPException(403, "Upload origin is not allowed")
        if rate_limit_network:
            rate_limit_network(request)
        file_id = str(uuid.uuid4())
        if reserve_slot:
            reserve_slot(uid, file_id, req.size_bytes)
        try:
            session = create_session(uid, file_id, extension, content_type, req.size_bytes, origin)
        except Exception:
            if release_slot:
                release_slot(uid, file_id, undo_hourly=True)
            raise
        if not session:
            if release_slot:
                release_slot(uid, file_id, undo_hourly=True)
            return {"success": False, "direct_upload_available": False}
        return {
            "success": True,
            "direct_upload_available": True,
            "file_id": file_id,
            "upload_url": session["session_url"],
            "expires_at": session["expires_at"],
        }

    @router.post("/api/uploads/complete")
    def complete_direct_upload(req: DirectUploadCompleteRequest, request: Request):
        uid = authenticate(extract_token(request))["uid"]
        try:
            uuid.UUID(req.file_id)
        except (ValueError, TypeError):
            raise HTTPException(400, "Invalid file identifier")
        result = finalize_session(uid, req.file_id)
        if not result:
            raise HTTPException(409, "Upload is incomplete or could not be verified")
        # Keep the verified private object if persistence fails: the customer can
        # retry completion, and another request may have already saved ownership.
        persisted = remember_owner(req.file_id, uid, result["remote_path"], result["extension"])
        if not persisted:
            raise HTTPException(503, "Upload ownership could not be persisted")
        if release_slot:
            release_slot(uid, req.file_id)
        audit_action("direct_upload_completed", uid, {
            "file_id": req.file_id, "size_bytes": result["size_bytes"],
        })
        return {"success": True, "file_id": req.file_id, "raw_url": signed_upload_url(req.file_id, uid)}

    @router.post("/api/uploads/cancel")
    def cancel_direct_upload(req: DirectUploadCompleteRequest, request: Request):
        uid = authenticate(extract_token(request))["uid"]
        if assert_account_active:
            assert_account_active(uid)
        try:
            uuid.UUID(req.file_id)
        except (ValueError, TypeError):
            raise HTTPException(400, "Invalid file identifier")
        if not cancel_session or not cancel_session(uid, req.file_id):
            raise HTTPException(404, "Active upload not found")
        if release_slot:
            release_slot(uid, req.file_id)
        audit_action("direct_upload_cancelled", uid, {"file_id": req.file_id})
        return {"success": True, "file_id": req.file_id}

    return router
