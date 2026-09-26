"""Durable post-upload malware-scan outbox and RQ dispatch."""

import os
import time

from fastapi import HTTPException


class MediaScanJobs:
    def __init__(self, db):
        if db is None:
            raise HTTPException(503, "Media scan storage is unavailable")
        environment = os.environ.get("RELEASE_ENVIRONMENT", "production")
        if environment not in {"production", "staging", "development", "test"}:
            raise ValueError("Unsupported media scan environment")
        suffix = "" if environment == "production" else f"_{environment}"
        self.db = db
        self.outbox_collection = f"media_scan_outbox{suffix}"

    def create(self, uid, file_id):
        upload_ref = self.db.collection("uploads").document(file_id)
        outbox_ref = self.db.collection(self.outbox_collection).document(file_id)
        upload = upload_ref.get()
        if not upload.exists:
            raise HTTPException(404, "Upload metadata is unavailable")
        metadata = upload.to_dict() or {}
        if str(metadata.get("uid") or "") != str(uid or ""):
            raise HTTPException(403, "Upload ownership mismatch")
        if metadata.get("upload_state") in {"clean", "rejected"}:
            outbox_ref.delete()
            return False
        outbox_ref.set({
            "uid": str(uid),
            "file_id": str(file_id),
            "created_at": time.time(),
            "last_dispatch": 0,
            "attempts": 0,
        }, merge=True)
        return True

    def finish(self, file_id):
        self.db.collection(self.outbox_collection).document(file_id).delete()

    def dispatch(self, queue, retry=None):
        if queue is None:
            return 0
        dispatched = 0
        for snapshot in self.db.collection(self.outbox_collection).limit(100).stream():
            pointer = snapshot.to_dict() or {}
            uid = str(pointer.get("uid") or "")
            file_id = str(pointer.get("file_id") or snapshot.id)
            upload = self.db.collection("uploads").document(file_id).get()
            if not upload.exists:
                snapshot.reference.delete()
                continue
            metadata = upload.to_dict() or {}
            if metadata.get("upload_state") in {"clean", "rejected"}:
                snapshot.reference.delete()
                continue
            now = time.time()
            if now - float(pointer.get("last_dispatch") or 0) < 30:
                continue
            rq_job_id = f"media-scan-{file_id}"
            delivery = queue.fetch_job(rq_job_id)
            if delivery:
                status = delivery.get_status(refresh=True)
                if status in {"queued", "started", "deferred", "scheduled"}:
                    continue
                delivery.delete()
            snapshot.reference.set({
                "last_dispatch": now,
                "attempts": int(pointer.get("attempts") or 0) + 1,
            }, merge=True)
            queue.enqueue(
                "backend.main.run_media_scan_job_task",
                uid,
                file_id,
                job_id=rq_job_id,
                job_timeout=20 * 60,
                result_ttl=3600,
                failure_ttl=86400,
                retry=retry,
            )
            dispatched += 1
        return dispatched
