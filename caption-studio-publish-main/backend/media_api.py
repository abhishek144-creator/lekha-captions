"""Signed media routes: delete a history file, serve or refresh uploads and exports.

Handlers resolve shared helpers through ``host`` (the main module) at call time,
so there is one copy of each helper and test patches on ``main`` keep applying.
"""

from types import ModuleType, SimpleNamespace

from fastapi import FastAPI, UploadFile, File, HTTPException, Response
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Request
from fastapi import APIRouter

try:
    from . import settings
except ImportError:  # Direct execution from backend/ remains supported.
    import settings
try:
    from . import app_state
except ImportError:  # Direct execution from backend/ remains supported.
    import app_state
try:
    from . import firebase_admin_setup
except ImportError:  # Direct execution from backend/ remains supported.
    import firebase_admin_setup
try:
    from . import observability
except ImportError:  # Direct execution from backend/ remains supported.
    import observability


def create_media_router(host: ModuleType) -> SimpleNamespace:
    router = APIRouter()

    @router.post("/api/delete-file")
    def delete_user_file(req: host.DeleteFileRequest):
        decoded_token = firebase_admin_setup.verify_token(req.id_token)
        if not decoded_token:
            raise HTTPException(status_code=401, detail="Auth required")
        uid = decoded_token.get('uid')
        host._assert_tenant_access(uid, decoded_token, req.org_id)
        observability._audit_action("delete_file_attempt", uid, {"file_id": req.file_id})

        if not host._validate_file_id(req.file_id):
            raise HTTPException(status_code=400, detail="Invalid file_id")

        db = firebase_admin_setup.get_db()
        if not db:
            raise HTTPException(status_code=503, detail="Database unavailable; file deletion can be retried")
        user_ref = db.collection('users').document(uid)
        user_doc = user_ref.get()
        if not user_doc.exists:
            raise HTTPException(status_code=404, detail="Account not found")
        history = (user_doc.to_dict() or {}).get('history', []) or []
        matching_items = [
            item for item in history
            if isinstance(item, dict) and item.get('id') == req.file_id
        ]
        if not matching_items:
            raise HTTPException(status_code=404, detail="File not found in this account")

        # Persist ownership and retry metadata before touching either storage system.
        host._mark_history_item_deleting_transactionally(db, user_ref, req.file_id)

        failed_cloud_paths = []
        for item in matching_items:
            remote_path = item.get('firebase_path')
            if remote_path and not firebase_admin_setup.delete_from_firebase_storage(remote_path):
                failed_cloud_paths.append(remote_path)
        if failed_cloud_paths:
            observability._json_log("error", "delete_file_storage_cleanup_failed", uid=uid, file_id=req.file_id, count=len(failed_cloud_paths))
            raise HTTPException(
                status_code=503,
                detail={"message": "Cloud file cleanup was incomplete", "retryable": True},
            )

        # Ownership is now proven. Delete every local render variant for this UUID.
        local_delete_errors = []
        local_deleted = 0
        if host.os.path.exists(settings.EXPORT_DIR):
            real_export_dir = host.os.path.realpath(settings.EXPORT_DIR)
            valid_names = {
                name for name in host.os.listdir(settings.EXPORT_DIR)
                if name == f"export_{req.file_id}.mp4" or name.startswith(f"export_{req.file_id}_")
            }
            for name in valid_names:
                candidate = host.os.path.realpath(host.os.path.join(settings.EXPORT_DIR, name))
                if not candidate.startswith(real_export_dir + host.os.sep) or not host.os.path.isfile(candidate):
                    continue
                try:
                    host.os.remove(candidate)
                    local_deleted += 1
                except OSError as e:
                    local_delete_errors.append(name)
                    observability._json_log("error", "delete_file_local_cleanup_failed", uid=uid, file=name, error=str(e))
        if local_delete_errors:
            raise HTTPException(
                status_code=503,
                detail={"message": "Local file cleanup was incomplete", "files": local_delete_errors, "retryable": True},
            )

        upload_metadata = host._load_upload_metadata(req.file_id)
        if upload_metadata and str(upload_metadata.get("uid") or "") == uid:
            source_remote_path = str(upload_metadata.get("remote_path") or "")
            if source_remote_path and not firebase_admin_setup.delete_from_firebase_storage(source_remote_path):
                raise HTTPException(
                    status_code=503,
                    detail={"message": "Source media cleanup was incomplete", "retryable": True},
                )
            for name in list(host.os.listdir(settings.UPLOAD_DIR)):
                if name.startswith(req.file_id):
                    candidate = host.os.path.realpath(host.os.path.join(settings.UPLOAD_DIR, name))
                    if candidate.startswith(host.os.path.realpath(settings.UPLOAD_DIR) + host.os.sep) and host.os.path.isfile(candidate):
                        try:
                            host.os.remove(candidate)
                        except OSError:
                            pass
            try:
                db.collection("uploads").document(req.file_id).delete()
            except Exception:
                pass
            if app_state._redis_client is not None:
                try:
                    app_state._redis_client.delete(f"upload_owner:{req.file_id}", f"upload_meta:{req.file_id}")
                except Exception:
                    pass
            app_state._upload_owners.pop(req.file_id, None)

        host._remove_history_item_transactionally(db, user_ref, req.file_id)
        observability._audit_action("delete_file_success", uid, {"file_id": req.file_id, "local_files_deleted": local_deleted})
        return {"success": True, "local_files_deleted": local_deleted}


    @router.get("/api/media/upload/{file_id}")
    def serve_uploaded_media(file_id: str, token: str = ""):
        payload = host._verify_media_token(token, "upload")
        host._assert_account_not_deleting(str(payload.get("uid") or ""))
        if payload.get("file_id") != file_id:
            raise HTTPException(status_code=403, detail="Media token does not match this upload")
        path = host._safe_find_upload(file_id)
        if not path or not host.os.path.exists(path):
            raise HTTPException(status_code=404, detail="Upload not found")
        media_type = host.mimetypes.guess_type(path)[0] or "application/octet-stream"
        return FileResponse(path, media_type=media_type)


    @router.post("/api/media/upload-url")
    def refresh_uploaded_media_url(req: host.MediaUrlRequest):
        decoded_token = host._authenticate_media_request(req.id_token, req.org_id)
        uid = (decoded_token.get("uid") or "").strip() or "unknown-user"
        if not host._validate_file_id(req.file_id):
            raise HTTPException(status_code=400, detail="Invalid file_id")
        host._assert_upload_owner(req.file_id, uid)
        path = host._safe_find_upload(req.file_id)
        if not path or not host.os.path.exists(path):
            raise HTTPException(status_code=404, detail="Upload not found")
        return {"success": True, "raw_url": host._signed_upload_url(req.file_id, uid)}


    @router.get("/api/media/export/{filename}")
    def serve_exported_media(filename: str, token: str = ""):
        if not host.re.match(r"^export_[a-f0-9-]{36}_[a-f0-9]{12}\.mp4$", filename or ""):
            raise HTTPException(status_code=400, detail="Invalid export filename")
        payload = host._verify_media_token(token, "export")
        host._assert_account_not_deleting(str(payload.get("uid") or ""))
        if payload.get("filename") != filename:
            raise HTTPException(status_code=403, detail="Media token does not match this export")
        download_filename = str(payload.get("download_filename") or filename)
        direct_url = (firebase_admin_setup.signed_export_download_url(f"exports/{payload['uid']}/{filename}", 600, download_filename)
                      if payload.get("download_filename") else firebase_admin_setup.signed_export_download_url(f"exports/{payload['uid']}/{filename}"))
        if direct_url:
            return RedirectResponse(direct_url, status_code=302, headers={"Cache-Control": "no-store"})
        real_export_dir = host.os.path.realpath(settings.EXPORT_DIR)
        path = host.os.path.realpath(host.os.path.join(settings.EXPORT_DIR, filename))
        if not path.startswith(real_export_dir + host.os.sep):
            raise HTTPException(status_code=400, detail="Invalid export path")
        if not host.os.path.isfile(path):
            uid = str(payload.get("uid") or "")
            if not uid or "/" in uid or "\\" in uid:
                raise HTTPException(status_code=403, detail="Invalid export owner")
            partial = f"{path}.part-{host.uuid.uuid4().hex}"
            try:
                downloaded = firebase_admin_setup.download_export_from_firebase_storage(
                    f"exports/{uid}/{filename}", partial
                )
                if downloaded:
                    host.os.replace(partial, path)
            finally:
                if host.os.path.exists(partial):
                    try:
                        host.os.remove(partial)
                    except OSError:
                        pass
        if not host.os.path.isfile(path):
            raise HTTPException(status_code=404, detail="Export not found")
        return FileResponse(
            path,
            media_type="video/mp4",
            filename=download_filename,
            headers={"Cache-Control": "no-store, max-age=0"},
        )


    return SimpleNamespace(
        router=router,
        delete_user_file=delete_user_file,
        serve_uploaded_media=serve_uploaded_media,
        refresh_uploaded_media_url=refresh_uploaded_media_url,
        serve_exported_media=serve_exported_media,
    )
