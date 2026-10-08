"""Upload routes; shared state and helpers resolve through the application context.

The factory accepts explicit configuration, adapters and shared state through
ServiceContext. It has no dependency on the HTTP entry point.
"""

from types import SimpleNamespace
from typing import Protocol, Any

from fastapi import APIRouter


from fastapi import HTTPException
from fastapi import Request
from fastapi import Response
import asyncio
import mimetypes
import os
import pathlib
import re
import time
import uuid

class ServiceContext(Protocol):
    ALLOWED_CONTENT_PREFIXES: Any
    ALLOWED_EXTENSIONS: Any
    File: Any
    GLOBAL_MAX_UPLOAD_DURATION_SECONDS: Any
    MAX_PROXY_UPLOAD_BYTES: Any
    MAX_UPLOAD_DURATION_CONTROL_KEY: Any
    UPLOAD_DIR: Any
    UPLOAD_RATE_WINDOW: Any
    UPLOAD_SHARED_NETWORK_RATE_LIMIT: Any
    UPLOAD_USER_RATE_LIMIT: Any
    UploadFile: Any
    _IS_PRODUCTION: Any
    _apply_rate_headers: Any
    _assert_service_available: Any
    _assert_upload_owner: Any
    _audit_action: Any
    _authenticate_media_request: Any
    _check_rate: Any
    _cleanup_incomplete_upload: Any
    _client_rate_key: Any
    _compute_media_hash: Any
    _extract_bearer_token: Any
    _is_content_safety_blocked: Any
    _json_log: Any
    _log: Any
    _probe_media: Any
    _read_service_controls: Any
    _remember_upload_owner: Any
    _request_id: Any
    _scan_upload_for_threat: Any
    _signed_upload_url: Any
    _track_event: Any
    _upload_idem_get: Any
    _upload_idem_set: Any
    _upload_rate: Any
    _utcnow: Any
    _validate_file_id: Any
    set_source_upload_state: Any
    upload_source_media: Any


def create_upload_router(context: ServiceContext) -> SimpleNamespace:
    router = APIRouter()

    @router.post("/api/upload")
    async def upload_video(file: context.UploadFile = context.File(...), request: Request = None, response: Response = None):
        rid = context._request_id(request)
        upload_reference = re.sub(
            r"[^A-Za-z0-9._:-]",
            "",
            str(request.headers.get("idempotency-key") or "")[:128] if request else "",
        )
        stage = "request"
        uid = "unknown-user"
        file_path = ""
        remote_path = ""
        bytes_written = 0
        completed = False
        try:
            context._assert_service_available("pause_uploads")
            token = context._extract_bearer_token(request) if request else ""
            decoded_token = context._authenticate_media_request(token)
            uid = (decoded_token.get("uid") or "").strip() or "unknown-user"

            if context._IS_PRODUCTION:
                raise HTTPException(
                    status_code=409,
                    detail="Production uploads must use the direct resumable storage flow.",
                    headers={"X-Lekha-Upload-Transport": "direct-resumable"},
                )

            safe_name = os.path.basename(file.filename or "")
            file_ext = pathlib.Path(safe_name).suffix.lstrip(".").lower()
            if context._is_content_safety_blocked(file.filename or ""):
                context._track_event("upload_rejected_content_safety")
                raise HTTPException(status_code=422, detail="Upload blocked by content safety policy.")
            if file_ext not in context.ALLOWED_EXTENSIONS:
                context._track_event("upload_rejected_extension", {"ext": file_ext})
                raise HTTPException(status_code=415, detail=f"File type .{file_ext} not supported. Allowed: {', '.join(sorted(context.ALLOWED_EXTENSIONS))}")

            content_type = (file.content_type or "").lower()
            guessed_type, _ = mimetypes.guess_type(file.filename or "")
            # application/octet-stream is a generic browser fallback — treat extension check as authoritative
            if content_type and content_type != "application/octet-stream" and not any(content_type.startswith(p) for p in context.ALLOWED_CONTENT_PREFIXES):
                context._track_event("upload_rejected_content_type", {"content_type": content_type})
                raise HTTPException(status_code=415, detail=f"Unsupported MIME type: {content_type}")
            if guessed_type and not any(guessed_type.startswith(p) for p in context.ALLOWED_CONTENT_PREFIXES):
                context._track_event("upload_rejected_guess_type", {"guessed_type": guessed_type})
                raise HTTPException(status_code=415, detail=f"Unsupported file type: {guessed_type}")

            # A browser can lose the response after the server has finished saving a
            # video. The recovery client retries with the same key; return that
            # completed upload before consuming another rate-limit slot or creating
            # a duplicate object in storage.
            upload_fingerprint = f"{safe_name}:{content_type}"
            cached_upload = context._upload_idem_get(uid, upload_reference)
            if cached_upload:
                if cached_upload.get("fingerprint") != upload_fingerprint:
                    raise HTTPException(
                        status_code=409,
                        detail="This upload retry key was already used for a different file.",
                    )
                cached_file_id = str(cached_upload.get("file_id") or "")
                if context._validate_file_id(cached_file_id):
                    context._assert_upload_owner(cached_file_id, uid)
                    context._track_event("upload_idempotent_replay")
                    return {
                        "success": True,
                        "file_id": cached_file_id,
                        "raw_url": context._signed_upload_url(cached_file_id, uid),
                        "idempotent_replay": True,
                    }

            content_length = int(request.headers.get('content-length', 0)) if request else 0
            context._json_log(
                "info",
                "upload_started",
                request_id=rid,
                upload_reference=upload_reference,
                content_length=content_length,
                content_type=content_type,
            )
            if content_length > context.MAX_PROXY_UPLOAD_BYTES + 1024 * 1024:
                context._track_event("upload_rejected_too_large", {"content_length": content_length})
                raise HTTPException(status_code=413, detail="Large files must use direct storage upload.")

            file_id = str(uuid.uuid4())
            file_path = os.path.join(context.UPLOAD_DIR, f"{file_id}.{file_ext}")
            # Stream to disk in chunks rather than buffering the whole file in RAM —
            # a 500 MiB read per request is a memory-pressure DoS under concurrency.
            # Enforce the size cap as we write so an oversized (or content-length-spoofed)
            # body is aborted early instead of fully consumed.
            stage = "receiving_body"
            too_large = False
            UPLOAD_CHUNK_SIZE = 1024 * 1024  # 1 MB
            with open(file_path, "wb") as buffer:
                while True:
                    chunk = await file.read(UPLOAD_CHUNK_SIZE)
                    if not chunk:
                        break
                    bytes_written += len(chunk)
                    if bytes_written > context.MAX_PROXY_UPLOAD_BYTES:
                        too_large = True
                        break
                    buffer.write(chunk)
            if too_large:
                try:
                    os.remove(file_path)
                except Exception:
                    pass
                context._track_event("upload_rejected_too_large", {"content_length": bytes_written})
                raise HTTPException(status_code=413, detail="Large files must use direct storage upload.")

            stage = "body_received"
            context._json_log(
                "info",
                "upload_body_received",
                request_id=rid,
                upload_reference=upload_reference,
                bytes_received=bytes_written,
            )

            # Count only fully received uploads. Previously the rate reservation was
            # consumed before reading the request body, so every Wi-Fi interruption
            # counted against both the IP and user limits even though no usable file
            # reached the service. This also lets the browser safely retry a dropped
            # transfer without locking the account out.
            if request:
                client_ip = context._client_rate_key(request)
                allowed, retry_after, remaining = context._check_rate(
                    context._upload_rate,
                    f"network:{client_ip}",
                    context.UPLOAD_SHARED_NETWORK_RATE_LIMIT,
                    context.UPLOAD_RATE_WINDOW,
                )
                context._apply_rate_headers(response, context.UPLOAD_SHARED_NETWORK_RATE_LIMIT, remaining, retry_after)
                if not allowed:
                    try:
                        os.remove(file_path)
                    except OSError:
                        pass
                    context._track_event("upload_rejected_rate_limited")
                    raise HTTPException(status_code=429, detail="Too many uploads. Please wait before trying again.")
                user_allowed, user_retry_after, user_remaining = context._check_rate(
                    context._upload_rate, f"user:{uid}", context.UPLOAD_USER_RATE_LIMIT, context.UPLOAD_RATE_WINDOW
                )
                context._apply_rate_headers(response, context.UPLOAD_USER_RATE_LIMIT, user_remaining, user_retry_after)
                if not user_allowed:
                    try:
                        os.remove(file_path)
                    except OSError:
                        pass
                    context._track_event("upload_rejected_rate_limited")
                    raise HTTPException(status_code=429, detail="Too many uploads. Please wait before trying again.")
            context._log(rid, f"Upload accepted file_id={file_id} ext={file_ext} bytes={bytes_written}")
            stage = "security_scan"
            if not await asyncio.to_thread(context._scan_upload_for_threat, file_path):
                try:
                    os.remove(file_path)
                except Exception:
                    pass
                context._track_event("upload_rejected_malware_scan")
                raise HTTPException(status_code=422, detail="Upload failed security scan.")

            stage = "media_probe"
            try:
                metadata = await asyncio.to_thread(context._probe_media, file_path)
                duration = float((metadata.get("format") or {}).get("duration") or 0)
                content_sha256 = await asyncio.to_thread(context._compute_media_hash, file_path)
            except Exception as probe_error:
                try:
                    os.remove(file_path)
                except Exception:
                    pass
                context._track_event("upload_rejected_ffprobe", {"error": str(probe_error)})
                raise HTTPException(status_code=422, detail=f"Invalid media file: {probe_error}")

            controls = context._read_service_controls()
            max_seconds = int(controls.get(
                context.MAX_UPLOAD_DURATION_CONTROL_KEY,
                context.GLOBAL_MAX_UPLOAD_DURATION_SECONDS,
            ))
            if duration > max_seconds:
                os.remove(file_path)
                context._track_event("upload_rejected_duration", {"duration": duration})
                raise HTTPException(status_code=413, detail=f"Video is {duration:.0f}s. Maximum allowed is {max_seconds // 60} minutes.")

            stage = "durable_storage"
            remote_path = await asyncio.to_thread(
                context.upload_source_media, file_path, uid, file_id, file_ext, 6
            )
            if context._IS_PRODUCTION and not remote_path:
                try:
                    os.remove(file_path)
                except OSError:
                    pass
                raise HTTPException(status_code=503, detail="Durable media storage is unavailable. Please retry.")

            stage = "owner_persistence"
            scanned_at = context._utcnow().isoformat() + "Z"
            owner_persisted = context._remember_upload_owner(
                file_id,
                uid,
                remote_path or "",
                file_ext,
                source_metadata={
                    "upload_state": "clean",
                    "security_scanned_at": scanned_at,
                    "content_sha256": content_sha256,
                    "size_bytes": bytes_written,
                },
            )
            if context._IS_PRODUCTION and not owner_persisted:
                raise HTTPException(status_code=503, detail="Upload ownership could not be persisted. Please retry.")
            if remote_path:
                await asyncio.to_thread(
                    context.set_source_upload_state, uid, file_id, remote_path, "clean",
                )
            context._upload_idem_set(uid, upload_reference, {
                "file_id": file_id,
                "fingerprint": upload_fingerprint,
                "ts": time.time(),
            })
            stage = "completed"
            completed = True
            context._track_event("upload_success", {
                "ext": file_ext,
                "request_id": rid,
                "upload_reference": upload_reference,
            })
            context._audit_action("upload_success", uid, {"file_id": file_id, "ext": file_ext, "duration": duration})
            return {"success": True, "file_id": file_id, "raw_url": context._signed_upload_url(file_id, uid)}
        except asyncio.CancelledError:
            await asyncio.to_thread(context._cleanup_incomplete_upload, file_path, remote_path)
            context._track_event("upload_client_disconnected", {
                "stage": stage,
                "bytes_received": bytes_written,
                "request_id": rid,
                "upload_reference": upload_reference,
            })
            context._json_log(
                "warning",
                "upload_client_disconnected",
                request_id=rid,
                upload_reference=upload_reference,
                stage=stage,
                bytes_received=bytes_written,
            )
            raise
        except HTTPException as http_error:
            if not completed:
                await asyncio.to_thread(context._cleanup_incomplete_upload, file_path, remote_path)
            context._json_log(
                "warning",
                "upload_rejected",
                request_id=rid,
                upload_reference=upload_reference,
                stage=stage,
                status_code=http_error.status_code,
                bytes_received=bytes_written,
            )
            raise
        except Exception as e:
            if not completed:
                await asyncio.to_thread(context._cleanup_incomplete_upload, file_path, remote_path)
            disconnected = type(e).__name__ == "ClientDisconnect"
            event = "upload_client_disconnected" if disconnected else "upload_failed"
            context._track_event(event, {
                "stage": stage,
                "bytes_received": bytes_written,
                "request_id": rid,
                "upload_reference": upload_reference,
                "error_type": type(e).__name__,
            })
            context._json_log(
                "warning" if disconnected else "error",
                event,
                request_id=rid,
                upload_reference=upload_reference,
                stage=stage,
                bytes_received=bytes_written,
                error_type=type(e).__name__,
                error=str(e),
            )
            if disconnected:
                raise HTTPException(status_code=499, detail=f"Upload connection was interrupted. Reference: {rid}") from e
            raise HTTPException(status_code=500, detail=f"Upload failed. Reference: {rid}") from e

    return SimpleNamespace(
        router=router,
        upload_video=upload_video,
    )
