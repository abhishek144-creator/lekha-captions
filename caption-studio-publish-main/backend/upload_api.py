"""Upload routes: proxied file upload into the media pipeline."""

import asyncio
import mimetypes
import os
import pathlib
import re
import time
import uuid
from fastapi import APIRouter, File, HTTPException, Request, Response, UploadFile


try:
    from . import settings
    from . import app_state
    from . import firebase_admin_setup
    from . import observability
    from . import request_security
    from . import operator_controls
    from . import media_records
    from . import export_jobs
    from . import request_guards
    from . import upload_dispatch
except ImportError:  # Direct execution from backend/ remains supported.
    import settings
    import app_state
    import firebase_admin_setup
    import observability
    import request_security
    import operator_controls
    import media_records
    import export_jobs
    import request_guards
    import upload_dispatch


router = APIRouter()

@router.post("/api/upload")
async def upload_video(file: UploadFile = File(...), request: Request = None, response: Response = None):
    rid = observability._request_id(request)
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
        operator_controls._assert_service_available("pause_uploads")
        token = export_jobs._extract_bearer_token(request) if request else ""
        decoded_token = request_security._authenticate_media_request(token)
        uid = (decoded_token.get("uid") or "").strip() or "unknown-user"

        if settings._IS_PRODUCTION:
            raise HTTPException(
                status_code=409,
                detail="Production uploads must use the direct resumable storage flow.",
                headers={"X-Lekha-Upload-Transport": "direct-resumable"},
            )

        safe_name = os.path.basename(file.filename or "")
        file_ext = pathlib.Path(safe_name).suffix.lstrip(".").lower()
        if operator_controls._is_content_safety_blocked(file.filename or ""):
            observability._track_event("upload_rejected_content_safety")
            raise HTTPException(status_code=422, detail="Upload blocked by content safety policy.")
        if file_ext not in settings.ALLOWED_EXTENSIONS:
            observability._track_event("upload_rejected_extension", {"ext": file_ext})
            raise HTTPException(status_code=415, detail=f"File type .{file_ext} not supported. Allowed: {', '.join(sorted(settings.ALLOWED_EXTENSIONS))}")

        content_type = (file.content_type or "").lower()
        guessed_type, _ = mimetypes.guess_type(file.filename or "")
        # application/octet-stream is a generic browser fallback — treat extension check as authoritative
        if content_type and content_type != "application/octet-stream" and not any(content_type.startswith(p) for p in settings.ALLOWED_CONTENT_PREFIXES):
            observability._track_event("upload_rejected_content_type", {"content_type": content_type})
            raise HTTPException(status_code=415, detail=f"Unsupported MIME type: {content_type}")
        if guessed_type and not any(guessed_type.startswith(p) for p in settings.ALLOWED_CONTENT_PREFIXES):
            observability._track_event("upload_rejected_guess_type", {"guessed_type": guessed_type})
            raise HTTPException(status_code=415, detail=f"Unsupported file type: {guessed_type}")

        # A browser can lose the response after the server has finished saving a
        # video. The recovery client retries with the same key; return that
        # completed upload before consuming another rate-limit slot or creating
        # a duplicate object in storage.
        upload_fingerprint = f"{safe_name}:{content_type}"
        cached_upload = request_guards._upload_idem_get(uid, upload_reference)
        if cached_upload:
            if cached_upload.get("fingerprint") != upload_fingerprint:
                raise HTTPException(
                    status_code=409,
                    detail="This upload retry key was already used for a different file.",
                )
            cached_file_id = str(cached_upload.get("file_id") or "")
            if media_records._validate_file_id(cached_file_id):
                media_records._assert_upload_owner(cached_file_id, uid)
                observability._track_event("upload_idempotent_replay")
                return {
                    "success": True,
                    "file_id": cached_file_id,
                    "raw_url": media_records._signed_upload_url(cached_file_id, uid),
                    "idempotent_replay": True,
                }

        content_length = int(request.headers.get('content-length', 0)) if request else 0
        observability._json_log(
            "info",
            "upload_started",
            request_id=rid,
            upload_reference=upload_reference,
            content_length=content_length,
            content_type=content_type,
        )
        if content_length > settings.MAX_PROXY_UPLOAD_BYTES + 1024 * 1024:
            observability._track_event("upload_rejected_too_large", {"content_length": content_length})
            raise HTTPException(status_code=413, detail="Large files must use direct storage upload.")

        file_id = str(uuid.uuid4())
        file_path = os.path.join(settings.UPLOAD_DIR, f"{file_id}.{file_ext}")
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
                if bytes_written > settings.MAX_PROXY_UPLOAD_BYTES:
                    too_large = True
                    break
                buffer.write(chunk)
        if too_large:
            try:
                os.remove(file_path)
            except Exception:
                pass
            observability._track_event("upload_rejected_too_large", {"content_length": bytes_written})
            raise HTTPException(status_code=413, detail="Large files must use direct storage upload.")

        stage = "body_received"
        observability._json_log(
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
            client_ip = request_guards._client_rate_key(request)
            allowed, retry_after, remaining = request_guards._check_rate(
                app_state._upload_rate,
                f"network:{client_ip}",
                settings.UPLOAD_SHARED_NETWORK_RATE_LIMIT,
                settings.UPLOAD_RATE_WINDOW,
            )
            request_guards._apply_rate_headers(response, settings.UPLOAD_SHARED_NETWORK_RATE_LIMIT, remaining, retry_after)
            if not allowed:
                try:
                    os.remove(file_path)
                except OSError:
                    pass
                observability._track_event("upload_rejected_rate_limited")
                raise HTTPException(status_code=429, detail="Too many uploads. Please wait before trying again.")
            user_allowed, user_retry_after, user_remaining = request_guards._check_rate(
                app_state._upload_rate, f"user:{uid}", settings.UPLOAD_USER_RATE_LIMIT, settings.UPLOAD_RATE_WINDOW
            )
            request_guards._apply_rate_headers(response, settings.UPLOAD_USER_RATE_LIMIT, user_remaining, user_retry_after)
            if not user_allowed:
                try:
                    os.remove(file_path)
                except OSError:
                    pass
                observability._track_event("upload_rejected_rate_limited")
                raise HTTPException(status_code=429, detail="Too many uploads. Please wait before trying again.")
        observability._log(rid, f"Upload accepted file_id={file_id} ext={file_ext} bytes={bytes_written}")
        stage = "security_scan"
        if not await asyncio.to_thread(operator_controls._scan_upload_for_threat, file_path):
            try:
                os.remove(file_path)
            except Exception:
                pass
            observability._track_event("upload_rejected_malware_scan")
            raise HTTPException(status_code=422, detail="Upload failed security scan.")

        stage = "media_probe"
        try:
            metadata = await asyncio.to_thread(media_records._probe_media, file_path)
            duration = float((metadata.get("format") or {}).get("duration") or 0)
            content_sha256 = await asyncio.to_thread(media_records._compute_media_hash, file_path)
        except Exception as probe_error:
            try:
                os.remove(file_path)
            except Exception:
                pass
            observability._track_event("upload_rejected_ffprobe", {"error": str(probe_error)})
            raise HTTPException(status_code=422, detail=f"Invalid media file: {probe_error}")

        controls = operator_controls._read_service_controls()
        max_seconds = int(controls.get(
            settings.MAX_UPLOAD_DURATION_CONTROL_KEY,
            settings.GLOBAL_MAX_UPLOAD_DURATION_SECONDS,
        ))
        if duration > max_seconds:
            os.remove(file_path)
            observability._track_event("upload_rejected_duration", {"duration": duration})
            raise HTTPException(status_code=413, detail=f"Video is {duration:.0f}s. Maximum allowed is {max_seconds // 60} minutes.")

        stage = "durable_storage"
        remote_path = await asyncio.to_thread(
            firebase_admin_setup.upload_source_media, file_path, uid, file_id, file_ext, 6
        )
        if settings._IS_PRODUCTION and not remote_path:
            try:
                os.remove(file_path)
            except OSError:
                pass
            raise HTTPException(status_code=503, detail="Durable media storage is unavailable. Please retry.")

        stage = "owner_persistence"
        scanned_at = observability._utcnow().isoformat() + "Z"
        owner_persisted = media_records._remember_upload_owner(
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
        if settings._IS_PRODUCTION and not owner_persisted:
            raise HTTPException(status_code=503, detail="Upload ownership could not be persisted. Please retry.")
        if remote_path:
            await asyncio.to_thread(
                firebase_admin_setup.set_source_upload_state, uid, file_id, remote_path, "clean",
            )
        request_guards._upload_idem_set(uid, upload_reference, {
            "file_id": file_id,
            "fingerprint": upload_fingerprint,
            "ts": time.time(),
        })
        stage = "completed"
        completed = True
        observability._track_event("upload_success", {
            "ext": file_ext,
            "request_id": rid,
            "upload_reference": upload_reference,
        })
        observability._audit_action("upload_success", uid, {"file_id": file_id, "ext": file_ext, "duration": duration})
        return {"success": True, "file_id": file_id, "raw_url": media_records._signed_upload_url(file_id, uid)}
    except asyncio.CancelledError:
        await asyncio.to_thread(upload_dispatch._cleanup_incomplete_upload, file_path, remote_path)
        observability._track_event("upload_client_disconnected", {
            "stage": stage,
            "bytes_received": bytes_written,
            "request_id": rid,
            "upload_reference": upload_reference,
        })
        observability._json_log(
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
            await asyncio.to_thread(upload_dispatch._cleanup_incomplete_upload, file_path, remote_path)
        observability._json_log(
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
            await asyncio.to_thread(upload_dispatch._cleanup_incomplete_upload, file_path, remote_path)
        disconnected = type(e).__name__ == "ClientDisconnect"
        event = "upload_client_disconnected" if disconnected else "upload_failed"
        observability._track_event(event, {
            "stage": stage,
            "bytes_received": bytes_written,
            "request_id": rid,
            "upload_reference": upload_reference,
            "error_type": type(e).__name__,
        })
        observability._json_log(
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
