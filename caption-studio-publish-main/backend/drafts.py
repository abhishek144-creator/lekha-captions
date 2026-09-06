"""A bounded account draft with optimistic revisions and five recovery snapshots."""
import hashlib
import json
from datetime import datetime, timezone

from fastapi import HTTPException
from google.cloud import firestore


def normalize_draft(value):
    allowed = {"captions", "captionStyle", "projectId", "settings", "duration", "fileId", "originalFileName"}
    draft = {key: data for key, data in value.items() if key in allowed}
    # Signed media URLs and auth tokens never belong in persistent project data.
    if not isinstance(draft.get("settings") or {}, dict):
        raise HTTPException(422, "Invalid draft settings")
    draft["settings"] = {key: data for key, data in (draft.get("settings") or {}).items()
                         if key not in {"preUploadedRawUrl", "id_token", "token"}}
    if not isinstance(draft.get("captions"), list) or len(draft["captions"]) > 500:
        raise HTTPException(422, "Draft must contain at most 500 captions")
    if any(not isinstance(caption, dict) or not isinstance(caption.get("text", ""), str) for caption in draft["captions"]):
        raise HTTPException(422, "Invalid caption data")
    try:
        size = len(json.dumps(draft, ensure_ascii=False, allow_nan=False).encode())
    except ValueError as error:
        raise HTTPException(422, "Invalid draft number") from error
    if size > 450_000:
        raise HTTPException(413, "Draft exceeds the cloud save limit")
    return draft


def read_draft(db, uid):
    snapshot = db.collection("users").document(uid).collection("drafts").document("current").get()
    return snapshot.to_dict() if snapshot.exists else {"revision": 0, "draft": None}


def save_draft(db, uid, value, expected_revision):
    draft = normalize_draft(value)
    digest = hashlib.sha256(json.dumps(draft, sort_keys=True).encode()).hexdigest()
    user = db.collection("users").document(uid)
    current = user.collection("drafts").document("current")
    fence = db.collection("account_deletions").document(uid)

    @firestore.transactional
    def save(tx):
        deleted = fence.get(transaction=tx).exists
        account = user.get(transaction=tx)
        snapshot = current.get(transaction=tx)
        if deleted or not account.exists:
            raise HTTPException(409, "Account is unavailable for cloud saving")
        previous = snapshot.to_dict() if snapshot.exists else {"revision": 0}
        if previous.get("digest") == digest:
            return previous
        if previous["revision"] != expected_revision:
            raise HTTPException(409, "A newer draft was saved on another tab or device. Download your local draft before restoring the cloud version.")
        revision = expected_revision + 1
        payload = {"revision": revision, "digest": digest, "draft": draft,
                   "saved_at": datetime.now(timezone.utc).isoformat()}
        tx.set(current, payload)
        tx.set(user.collection("draft_revisions").document(str(revision % 5)), payload)
        return payload
    return save(db.transaction())
