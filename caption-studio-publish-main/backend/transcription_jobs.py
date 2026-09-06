"""Durable transcription intent/outbox. Never replay an uncertain provider call."""
import hashlib
import json
import os
import time
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from google.cloud import firestore


TERMINAL = {"completed", "failed", "unknown", "cancelled"}
MAX_EXECUTION_SECONDS = 35 * 60


class TranscriptionJobs:
    def __init__(self, db):
        if db is None:
            raise HTTPException(503, "Transcription storage is unavailable")
        self.db = db
        self.environment = os.environ.get("RELEASE_ENVIRONMENT", "production")
        if self.environment not in {"production", "staging", "development", "test"}:
            raise ValueError("Unsupported transcription environment")
        self.outbox_collection = "transcription_outbox" if self.environment == "production" else f"transcription_outbox_{self.environment}"

    def refs(self, uid, job_id):
        user = self.db.collection("users").document(uid)
        return (user.collection("transcription_jobs").document(job_id),
                user.collection("operation_locks").document("transcription"),
                self.db.collection(self.outbox_collection).document(job_id),
                self.db.collection("account_deletions").document(uid))

    def get(self, uid, job_id):
        doc = self.refs(uid, job_id)[0].get()
        return doc.to_dict() if doc.exists else None

    def create(self, uid, settings):
        # Also dedupe a fresh browser request after reload, not only transport retries.
        job_id = hashlib.sha256(json.dumps([self.environment, uid, settings], sort_keys=True).encode()).hexdigest()
        ref, lock, outbox, fence = self.refs(uid, job_id)

        @firestore.transactional
        def create(tx):
            if fence.get(transaction=tx).exists:
                raise HTTPException(409, "Account deletion is in progress")
            existing = ref.get(transaction=tx)
            active = lock.get(transaction=tx)
            if existing.exists:
                return {"job_id": job_id, **existing.to_dict()}
            if active.exists and (active.to_dict() or {}).get("status") not in TERMINAL:
                raise HTTPException(409, "Another transcription is active for this account")
            now = time.time()
            job = {"schema_version": 1, "environment": self.environment, "uid": uid, "settings": settings, "status": "queued",
                   "created_at": now, "updated_at": now, "expire_at": datetime.now(timezone.utc) + timedelta(days=7)}
            tx.create(ref, job)
            tx.set(lock, {"job_id": job_id, "status": "queued"})
            tx.create(outbox, {"uid": uid, "job_id": job_id, "created_at": now, "attempts": 0, "last_dispatch": 0})
            return {"job_id": job_id, **job}
        return create(self.db.transaction())

    def claim(self, uid, job_id):
        ref, lock, outbox, fence = self.refs(uid, job_id)

        @firestore.transactional
        def claim(tx):
            deleted = fence.get(transaction=tx).exists
            snapshot = ref.get(transaction=tx)
            if not snapshot.exists:
                tx.delete(outbox)
                return None
            job = snapshot.to_dict()
            if job.get("environment") != self.environment:
                return None
            if job["status"] != "queued":
                return None
            status = "cancelled" if deleted else "running"
            tx.update(ref, {"status": status, "updated_at": time.time()})
            tx.set(lock, {"job_id": job_id, "status": status})
            # Keep outbox while running so a dead worker is reconciled after deadline.
            if deleted:
                tx.delete(outbox)
                return None
            return job
        return claim(self.db.transaction())

    def finish(self, uid, job_id, status, payload=None, error=None):
        ref, lock, outbox, fence = self.refs(uid, job_id)

        @firestore.transactional
        def finish(tx):
            deleted = fence.get(transaction=tx).exists
            snapshot = ref.get(transaction=tx)
            active = lock.get(transaction=tx)
            if not snapshot.exists or snapshot.to_dict()["status"] in TERMINAL:
                return False
            final_status = "cancelled" if deleted else status
            update = {"status": final_status, "updated_at": time.time()}
            if payload is not None and not deleted:
                update["payload"] = payload
            if error and not deleted:
                update["error"] = error
            tx.update(ref, update)
            if active.exists and active.to_dict().get("job_id") == job_id:
                tx.set(lock, {"job_id": job_id, "status": final_status})
            tx.delete(outbox)
            return True
        return finish(self.db.transaction())

    def dispatch(self, queue):
        if queue is None:
            return
        # The outbox is committed with the intent. API crashes and Redis loss do
        # not lose admission; duplicate queue deliveries must claim in Firestore.
        for snapshot in self.db.collection(self.outbox_collection).limit(100).stream():
            pointer = snapshot.to_dict()
            uid, job_id = pointer["uid"], pointer["job_id"]
            job = self.get(uid, job_id)
            if not job or job["status"] in TERMINAL:
                snapshot.reference.delete()
                continue
            now = time.time()
            if job["status"] == "running":
                if now - job["updated_at"] > MAX_EXECUTION_SECONDS:
                    self.finish(uid, job_id, "unknown", error="Transcription was interrupted. Contact support with this job reference; it will not be repeated automatically.")
                continue
            if now - pointer.get("last_dispatch", 0) < 30:
                continue
            if pointer.get("attempts", 0) >= 10:
                self.finish(uid, job_id, "failed", error="Transcription could not start. Contact support with this job reference.")
                continue
            # Marking dispatch is best effort: crash on either side can cause
            # duplicate delivery, which the durable claim deliberately tolerates.
            snapshot.reference.update({"last_dispatch": now, "attempts": firestore.Increment(1)})
            queue.enqueue("backend.main.run_transcription_job_task", uid, job_id,
                          job_timeout=30 * 60, result_ttl=3600, failure_ttl=86400)

    def prepare_deletion(self, uid):
        user = self.db.collection("users").document(uid)
        active = user.collection("operation_locks").document("transcription").get()
        if not active.exists:
            return
        state = active.to_dict()
        if state.get("status") == "running":
            raise HTTPException(409, "Wait for active transcription to finish before retrying deletion")
        if state.get("status") == "queued":
            self.finish(uid, state["job_id"], "cancelled")
