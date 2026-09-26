"""Upload security-state transitions shared by API and background workers."""

from fastapi import HTTPException


class UploadSecurityService:
    def __init__(
        self,
        *,
        load_metadata,
        mark_state,
        scan,
        delete_remote,
        utc_timestamp,
        compute_hash,
        update_metadata,
    ):
        self.load_metadata = load_metadata
        self.mark_state = mark_state
        self.scan = scan
        self.delete_remote = delete_remote
        self.utc_timestamp = utc_timestamp
        self.compute_hash = compute_hash
        self.update_metadata = update_metadata

    def assert_clean(self, file_id):
        metadata = self.load_metadata(file_id)
        state = str(metadata.get("upload_state") or "").strip().lower()
        if state == "clean" or metadata.get("security_scanned_at"):
            return metadata
        if state == "rejected":
            raise HTTPException(status_code=422, detail="Upload failed security scan.")
        raise HTTPException(
            status_code=409,
            detail="Upload is awaiting its security scan. Please retry shortly.",
            headers={"Retry-After": "3"},
        )

    def ensure_clean(self, file_id, uid, input_path):
        metadata = self.load_metadata(file_id)
        state = str(metadata.get("upload_state") or "").strip().lower()
        if state == "clean" or metadata.get("security_scanned_at"):
            if state != "clean":
                return self.mark_state(
                    file_id,
                    uid,
                    "clean",
                    scanned_at=str(metadata["security_scanned_at"]),
                )
            return metadata
        if state == "rejected":
            raise HTTPException(status_code=422, detail="Upload failed security scan.")
        if not self.scan(input_path):
            rejected = self.mark_state(file_id, uid, "rejected")
            remote_path = str(rejected.get("remote_path") or "")
            if remote_path:
                self.delete_remote(remote_path)
            raise HTTPException(status_code=422, detail="Upload failed security scan.")
        return self.mark_state(
            file_id,
            uid,
            "clean",
            scanned_at=self.utc_timestamp(),
        )

    def source_identity(self, file_id, input_path):
        metadata = self.load_metadata(file_id)
        content_sha256 = str(metadata.get("content_sha256") or "").strip().lower()
        if len(content_sha256) == 64:
            return f"sha256:{content_sha256}"
        generation = str(metadata.get("storage_generation") or "").strip()
        checksum = str(
            metadata.get("storage_crc32c") or metadata.get("storage_md5_hash") or ""
        ).strip()
        if generation and checksum:
            return f"storage:{generation}:{checksum}"
        content_sha256 = self.compute_hash(input_path)
        self.update_metadata(file_id, {"content_sha256": content_sha256})
        return f"sha256:{content_sha256}"
