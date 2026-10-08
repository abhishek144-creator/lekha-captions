"""Upload ownership/metadata, signed media URLs, media probing and direct-upload slots.

Helpers resolve shared state through ``host`` (the main module) at call
time, so there is one copy of each helper and test patches on ``main``
keep applying.
"""

from types import ModuleType, SimpleNamespace

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


def create_media_records(host: ModuleType) -> SimpleNamespace:
    def _validate_file_id(file_id: str) -> bool:
        """Validate file_id is a UUID4 — prevents path traversal via user-supplied IDs."""
        try:
            host.uuid.UUID(str(file_id))
            return True
        except (ValueError, AttributeError):
            return False


    def _safe_find_upload(file_id: str) -> host.Optional[str]:
        """Return the full path of the uploaded file for *file_id*, or None.
    Validates UUID format and guards against directory traversal."""
        if not host._validate_file_id(file_id):
            return None
        real_dir = host.os.path.realpath(settings.UPLOAD_DIR)
        for f in host.os.listdir(settings.UPLOAD_DIR):
            if f.startswith(file_id):
                candidate = host.os.path.realpath(host.os.path.join(settings.UPLOAD_DIR, f))
                if candidate.startswith(real_dir + host.os.sep):
                    return host.os.path.join(settings.UPLOAD_DIR, f)
        metadata = host._load_upload_metadata(file_id)
        remote_path = str(metadata.get("remote_path") or "")
        extension = str(metadata.get("extension") or host.pathlib.Path(remote_path).suffix.lstrip(".")).lower()
        if not remote_path.startswith("uploads/") or extension not in settings.ALLOWED_EXTENSIONS:
            return None
        target = host.os.path.realpath(host.os.path.join(settings.UPLOAD_DIR, f"{file_id}.{extension}"))
        if not target.startswith(real_dir + host.os.sep):
            return None
        partial = f"{target}.part-{host.uuid.uuid4().hex}"
        try:
            if not firebase_admin_setup.download_from_firebase_storage(remote_path, partial):
                return None
            host.os.replace(partial, target)
            return target
        finally:
            if host.os.path.exists(partial):
                try:
                    host.os.remove(partial)
                except OSError:
                    pass
        return None


    def _load_upload_metadata(file_id: str) -> host.Dict[str, host.Any]:
        if not file_id:
            return {}
        metadata: host.Dict[str, host.Any] = {}
        if app_state._redis_client is not None:
            try:
                raw = app_state._redis_client.get(f"upload_meta:{file_id}")
                if raw:
                    metadata = host.json.loads(raw)
            except Exception:
                metadata = {}
        if metadata:
            return metadata
        db = firebase_admin_setup.get_db()
        if db:
            try:
                snap = db.collection("uploads").document(file_id).get()
                if snap.exists:
                    metadata = snap.to_dict() or {}
            except Exception:
                metadata = {}
        return metadata


    def _remember_source_duration(file_id: str, duration_seconds: float):
        if not host.math.isfinite(duration_seconds) or duration_seconds <= 0:
            return
        if app_state._redis_client is not None:
            try:
                app_state._redis_client.setex(f"upload_duration:{file_id}", 24 * 3600, duration_seconds)
            except Exception as error:
                observability._json_log("warning", "upload_duration_cache_failed", error=type(error).__name__)
        db = firebase_admin_setup.get_db()
        if db:
            try:
                db.collection("uploads").document(file_id).set(
                    {"duration_seconds": duration_seconds}, merge=True,
                )
            except Exception as error:
                observability._json_log("warning", "upload_duration_persist_failed", error=type(error).__name__)


    def _source_duration_hint(file_id: str, uid: str) -> float:
        metadata = host._load_upload_metadata(file_id)
        if str(metadata.get("uid") or "") != str(uid):
            return 0
        if app_state._redis_client is not None:
            try:
                cached = app_state._redis_client.get(f"upload_duration:{file_id}")
                if cached is not None:
                    return float(cached)
            except Exception:
                pass
        try:
            return float(metadata.get("duration_seconds") or 0)
        except (TypeError, ValueError):
            return 0


    def _remember_upload_owner(file_id: str, uid: str, remote_path: str = "", extension: str = "",
                               source_metadata: host.Optional[host.Dict[str, host.Any]] = None):
        if not file_id or not uid:
            return False
        host._assert_account_not_deleting(uid)
        app_state._upload_owners[file_id] = uid
        persisted = False
        metadata = {
            "file_id": file_id,
            "uid": uid,
            "remote_path": remote_path,
            "extension": extension,
            "created_at": observability._utcnow().isoformat() + "Z",
            **(source_metadata or {}),
        }
        if app_state._redis_client is not None:
            try:
                app_state._redis_client.setex(f"upload_owner:{file_id}", 24 * 3600, uid)
                app_state._redis_client.setex(f"upload_meta:{file_id}", 24 * 3600, host.json.dumps(metadata))
                persisted = True
            except Exception:
                pass
        db = firebase_admin_setup.get_db()
        if db:
            try:
                db.collection("uploads").document(file_id).set(metadata, merge=True)
                persisted = True
            except Exception as e:
                observability._json_log("warning", "upload_owner_persist_failed", file_id=file_id, uid=uid, error=str(e))
        return persisted


    def _update_upload_metadata(file_id: str, values: host.Dict[str, host.Any]) -> host.Dict[str, host.Any]:
        metadata = {**host._load_upload_metadata(file_id), **values}
        if app_state._redis_client is not None:
            try:
                app_state._redis_client.setex(f"upload_meta:{file_id}", 24 * 3600, host.json.dumps(metadata))
            except Exception as error:
                observability._json_log("warning", "upload_metadata_cache_failed", file_id=file_id,
                          error_type=type(error).__name__)
        db = firebase_admin_setup.get_db()
        if db:
            db.collection("uploads").document(file_id).set(values, merge=True)
        return metadata


    def _mark_upload_security_state(file_id: str, uid: str, state: str,
                                    *, scanned_at: str = "") -> host.Dict[str, host.Any]:
        values: host.Dict[str, host.Any] = {"upload_state": state}
        if scanned_at:
            values["security_scanned_at"] = scanned_at
        metadata = host._update_upload_metadata(file_id, values)
        remote_path = str(metadata.get("remote_path") or "")
        if remote_path:
            firebase_admin_setup.set_source_upload_state(uid, file_id, remote_path, state)
        return metadata


    def _assert_upload_clean(file_id: str) -> host.Dict[str, host.Any]:
        return host._upload_security_service().assert_clean(file_id)


    def _ensure_upload_clean(file_id: str, uid: str, input_path: str) -> host.Dict[str, host.Any]:
        return host._upload_security_service().ensure_clean(file_id, uid, input_path)


    def _source_media_identity(file_id: str, input_path: str) -> str:
        return host._upload_security_service().source_identity(file_id, input_path)


    def _assert_upload_owner(file_id: str, uid: str):
        if not file_id or not uid:
            raise host.HTTPException(status_code=401, detail="Authentication required")
        owner = app_state._upload_owners.get(file_id)
        if not owner and app_state._redis_client is not None:
            try:
                owner = app_state._redis_client.get(f"upload_owner:{file_id}") or ""
            except Exception:
                owner = ""
        if not owner:
            owner = str(host._load_upload_metadata(file_id).get("uid") or "")
        if not owner:
            # Ownership must be provable. Failing open here lets any authenticated
            # caller reuse a known upload UUID after a restart or metadata outage.
            raise host.HTTPException(status_code=403, detail="Upload ownership could not be verified")
        if owner != uid:
            raise host.HTTPException(status_code=403, detail="You do not have access to this upload")


    def _media_token_signature(payload_b64: str) -> str:
        secret = settings.MEDIA_URL_SIGNING_SECRET.encode("utf-8")
        return host.hmac.new(secret, payload_b64.encode("utf-8"), host.hashlib.sha256).hexdigest()


    def _create_media_token(payload: host.Dict[str, host.Any]) -> str:
        payload_b64 = host.base64.urlsafe_b64encode(
            host.json.dumps(payload, separators=(",", ":"), default=str).encode("utf-8")
        ).decode("ascii").rstrip("=")
        return f"{payload_b64}.{host._media_token_signature(payload_b64)}"


    def _verify_media_token(token: str, expected_kind: str) -> host.Dict[str, host.Any]:
        try:
            payload_b64, supplied_sig = (token or "").split(".", 1)
        except ValueError:
            raise host.HTTPException(status_code=401, detail="Invalid media token")
        expected_sig = host._media_token_signature(payload_b64)
        if not supplied_sig or not host.hmac.compare_digest(expected_sig, supplied_sig):
            raise host.HTTPException(status_code=401, detail="Invalid media token")
        try:
            padded = payload_b64 + ("=" * (-len(payload_b64) % 4))
            payload = host.json.loads(host.base64.urlsafe_b64decode(padded.encode("ascii")).decode("utf-8"))
        except Exception:
            raise host.HTTPException(status_code=401, detail="Invalid media token")
        if payload.get("kind") != expected_kind:
            raise host.HTTPException(status_code=403, detail="Media token is not valid for this resource")
        if int(payload.get("exp", 0) or 0) < int(host.time.time()):
            raise host.HTTPException(status_code=401, detail="Media token expired")
        return payload


    def _signed_upload_url(file_id: str, uid: str, ttl_seconds: int = 6 * 3600) -> str:
        token = host._create_media_token({
            "kind": "upload",
            "uid": uid,
            "file_id": file_id,
            "exp": int(host.time.time() + ttl_seconds),
        })
        return f"/api/media/upload/{file_id}?token={token}"


    def _signed_export_url(filename: str, uid: str, ttl_seconds: int, cache_bust: str = "",
                           download_filename: str = "") -> str:
        token = host._create_media_token({
            "kind": "export",
            "uid": uid,
            "filename": filename,
            **({"download_filename": download_filename[:180]} if download_filename else {}),
            "exp": int(host.time.time() + max(ttl_seconds, 60)),
        })
        suffix = f"&v={cache_bust}" if cache_bust else ""
        return f"/api/media/export/{filename}?token={token}{suffix}"


    def _compute_media_hash(file_path: str) -> str:
        digest = host.hashlib.sha256()
        with open(file_path, "rb") as f:
            while True:
                chunk = f.read(1024 * 1024)
                if not chunk:
                    break
                digest.update(chunk)
        return digest.hexdigest()


    def _upload_security_service() -> host.UploadSecurityService:
        return host.UploadSecurityService(
            load_metadata=host._load_upload_metadata,
            mark_state=host._mark_upload_security_state,
            scan=host._scan_upload_for_threat,
            delete_remote=firebase_admin_setup.delete_from_firebase_storage,
            utc_timestamp=lambda: observability._utcnow().isoformat() + "Z",
            compute_hash=host._compute_media_hash,
            update_metadata=host._update_upload_metadata,
        )


    def _build_process_cache_path(media_hash: str, language: str, min_words: int, max_words: int) -> str:
        key = f"{media_hash}:{language.lower()}:{min_words}:{max_words}"
        key_hash = host.hashlib.sha256(key.encode("utf-8")).hexdigest()
        return host.os.path.join(settings.TRANSCRIPTION_CACHE_DIR, f"{key_hash}.json")


    def _build_parity_signature(captions: host.List[host.Dict[str, host.Any]], style: host.Dict[str, host.Any], word_layouts: host.Dict[str, host.Any]) -> str:
        payload = {
            "captions": captions,
            "style": style,
            "word_layouts": word_layouts,
        }
        canonical = host.json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=True, default=str)
        return host.hashlib.sha256(canonical.encode("utf-8")).hexdigest()


    def _validate_media_signature(file_path: str):
        with open(file_path, "rb") as media:
            header = media.read(32)
        valid = (
            (len(header) >= 12 and header[4:8] in {b"ftyp", b"moov", b"mdat", b"wide", b"free"})
            or header.startswith(b"\x1aE\xdf\xa3")  # Matroska / WebM
            or (header.startswith(b"RIFF") and header[8:12] in {b"WAVE", b"AVI "})
            or header.startswith(b"ID3")
            or (len(header) >= 2 and header[0] == 255 and header[1] & 0xE0 == 0xE0)
        )
        if not valid:
            raise ValueError("Unsupported or malformed media signature.")


    def _probe_media(file_path: str) -> host.Dict[str, host.Any]:
        host._validate_media_signature(file_path)
        cmd = [
            "ffprobe", "-v", "error",
            "-show_entries", "format=duration,format_name",
            "-show_entries", "stream=codec_type,codec_name,width,height,duration",
            "-of", "json", file_path
        ]
        result = host.run_media_command(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            raise ValueError("Unable to inspect media file with ffprobe.")
        try:
            meta = host.json.loads(result.stdout or "{}")
        except Exception:
            raise ValueError("Invalid ffprobe output.")
        streams = meta.get("streams", []) or []
        if not streams:
            raise ValueError("No media streams found.")
        if not any(s.get("codec_type") in ("video", "audio") for s in streams):
            raise ValueError("Unsupported media stream type.")
        try:
            duration = float((meta.get("format") or {}).get("duration") or 0)
        except Exception:
            duration = 0.0
        if not host.math.isfinite(duration) or duration <= 0:
            raise ValueError("Media duration is invalid.")
        for stream in streams:
            if stream.get("codec_type") == "video":
                width, height = int(stream.get("width") or 0), int(stream.get("height") or 0)
                # Accept up to 4K UHD in either orientation; bound decoded pixels.
                if min(width, height) <= 0 or max(width, height) > 4096 or width * height > 3840 * 2160:
                    raise ValueError("Video resolution exceeds the supported 4K pixel limit.")
        return meta

    return SimpleNamespace(
        _validate_file_id=_validate_file_id,
        _safe_find_upload=_safe_find_upload,
        _load_upload_metadata=_load_upload_metadata,
        _remember_source_duration=_remember_source_duration,
        _source_duration_hint=_source_duration_hint,
        _remember_upload_owner=_remember_upload_owner,
        _update_upload_metadata=_update_upload_metadata,
        _mark_upload_security_state=_mark_upload_security_state,
        _assert_upload_clean=_assert_upload_clean,
        _ensure_upload_clean=_ensure_upload_clean,
        _source_media_identity=_source_media_identity,
        _assert_upload_owner=_assert_upload_owner,
        _media_token_signature=_media_token_signature,
        _create_media_token=_create_media_token,
        _verify_media_token=_verify_media_token,
        _signed_upload_url=_signed_upload_url,
        _signed_export_url=_signed_export_url,
        _compute_media_hash=_compute_media_hash,
        _upload_security_service=_upload_security_service,
        _build_process_cache_path=_build_process_cache_path,
        _build_parity_signature=_build_parity_signature,
        _validate_media_signature=_validate_media_signature,
        _probe_media=_probe_media,
    )
