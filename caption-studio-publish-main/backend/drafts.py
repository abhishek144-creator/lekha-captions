"""Account-scoped caption projects with optimistic revisions and recovery snapshots."""
import hashlib
import json
import re
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from google.cloud import firestore


PROJECT_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,128}$")
MAX_PROJECTS_PER_ACCOUNT = 100


def normalize_project_id(value, *, create=False):
    project_id = str(value or "").strip()
    if not project_id and create:
        project_id = "current"
    if not PROJECT_ID_RE.fullmatch(project_id):
        raise HTTPException(422, "Invalid project identifier")
    return project_id


def normalize_draft(value):
    allowed = {
        "captions", "captionStyle", "captionTracks", "activeCaptionTrackId",
        "projectId", "projectName", "settings", "duration", "fileId", "originalFileName",
    }
    draft = {key: data for key, data in value.items() if key in allowed}
    if not isinstance(draft.get("settings") or {}, dict):
        raise HTTPException(422, "Invalid draft settings")
    draft["settings"] = {key: data for key, data in (draft.get("settings") or {}).items()
                         if key not in {"preUploadedRawUrl", "id_token", "token"}}
    if not isinstance(draft.get("captions"), list) or len(draft["captions"]) > 500:
        raise HTTPException(422, "Draft must contain at most 500 captions")
    if any(not isinstance(caption, dict) or not isinstance(caption.get("text", ""), str) for caption in draft["captions"]):
        raise HTTPException(422, "Invalid caption data")
    tracks = draft.get("captionTracks", [])
    if not isinstance(tracks, list) or len(tracks) > 20:
        raise HTTPException(422, "Invalid caption tracks")
    normalized_tracks = []
    for track in tracks:
        if not isinstance(track, dict):
            raise HTTPException(422, "Invalid caption track")
        track_id = str(track.get("id") or "").strip()
        captions = track.get("captions")
        if not track_id or len(track_id) > 100 or not isinstance(captions, list) or len(captions) > 500:
            raise HTTPException(422, "Invalid caption track")
        if any(not isinstance(caption, dict) or not isinstance(caption.get("text", ""), str) for caption in captions):
            raise HTTPException(422, "Invalid caption track data")
        normalized_tracks.append({
            **track,
            "id": track_id,
            "language": str(track.get("language") or "")[:80],
            "label": str(track.get("label") or track_id)[:120],
        })
    if "captionTracks" in draft:
        draft["captionTracks"] = normalized_tracks
        active_track_id = str(draft.get("activeCaptionTrackId") or "source").strip()
        if len(active_track_id) > 100:
            raise HTTPException(422, "Invalid active caption track")
        if normalized_tracks and active_track_id not in {track["id"] for track in normalized_tracks}:
            raise HTTPException(422, "Active caption track is missing")
        draft["activeCaptionTrackId"] = active_track_id
    project_name = str(draft.get("projectName") or draft.get("originalFileName") or "Untitled project").strip()
    draft["projectName"] = project_name[:120] or "Untitled project"
    try:
        size = len(json.dumps(draft, ensure_ascii=False, allow_nan=False).encode())
    except ValueError as error:
        raise HTTPException(422, "Invalid draft number") from error
    if size > 450_000:
        raise HTTPException(413, "Draft exceeds the cloud save limit")
    return draft


def _project_ref(db, uid, project_id):
    return db.collection("users").document(uid).collection("projects").document(project_id)


def _legacy_current_ref(db, uid):
    return db.collection("users").document(uid).collection("drafts").document("current")


def list_projects(db, uid, limit=100):
    rows = []
    query = db.collection("users").document(uid).collection("projects").limit(
        max(1, min(int(limit), MAX_PROJECTS_PER_ACCOUNT))
    )
    for snapshot in query.stream():
        data = snapshot.to_dict() or {}
        draft = data.get("draft") or {}
        snapshot_id = getattr(snapshot, "id", "") or str(snapshot.reference.path).rsplit("/", 1)[-1]
        rows.append({
            "project_id": snapshot_id,
            "name": draft.get("projectName") or draft.get("originalFileName") or "Untitled project",
            "revision": int(data.get("revision") or 0),
            "saved_at": data.get("saved_at"),
            "file_id": draft.get("fileId") or "",
        })
    rows.sort(key=lambda row: str(row.get("saved_at") or ""), reverse=True)
    return rows


def read_draft(db, uid, project_id=""):
    if project_id:
        project_id = normalize_project_id(project_id)
        snapshot = _project_ref(db, uid, project_id).get()
        return snapshot.to_dict() if snapshot.exists else {"revision": 0, "draft": None, "project_id": project_id}

    projects = list_projects(db, uid, 1)
    if projects:
        return read_draft(db, uid, projects[0]["project_id"])

    legacy = _legacy_current_ref(db, uid).get()
    if not legacy.exists:
        return {"revision": 0, "draft": None, "project_id": ""}
    payload = legacy.to_dict() or {"revision": 0, "draft": None}
    draft = payload.get("draft") or {}
    migrated_id = normalize_project_id(draft.get("projectId"), create=True)
    draft["projectId"] = migrated_id
    migrated = {**payload, "draft": draft, "project_id": migrated_id}
    _project_ref(db, uid, migrated_id).set(migrated)
    return migrated


def save_draft(db, uid, value, expected_revision, project_id=""):
    draft = normalize_draft(value)
    project_id = normalize_project_id(project_id or draft.get("projectId"), create=True)
    draft["projectId"] = project_id
    digest = hashlib.sha256(json.dumps(draft, sort_keys=True).encode()).hexdigest()
    user = db.collection("users").document(uid)
    current = _project_ref(db, uid, project_id)
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
            raise HTTPException(409, "A newer project revision was saved on another tab or device.")
        if not snapshot.exists and len(list_projects(db, uid, MAX_PROJECTS_PER_ACCOUNT + 1)) >= MAX_PROJECTS_PER_ACCOUNT:
            raise HTTPException(409, "Project limit reached. Delete an old project before creating another.")
        revision = expected_revision + 1
        payload = {
            "project_id": project_id,
            "revision": revision,
            "digest": digest,
            "draft": draft,
            "saved_at": datetime.now(timezone.utc).isoformat(),
        }
        tx.set(current, payload)
        tx.set(current.collection("revisions").document(str(revision % 5)), payload)
        return payload
    return save(db.transaction())


def delete_project(db, uid, project_id):
    project_id = normalize_project_id(project_id)
    ref = _project_ref(db, uid, project_id)
    snapshot = ref.get()
    if not snapshot.exists:
        return False
    for revision in ref.collection("revisions").stream():
        revision.reference.delete()
    ref.delete()
    return True
