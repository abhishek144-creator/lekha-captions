"""Team workspaces with role-based membership and shared caption projects."""

from __future__ import annotations

import hashlib
import secrets
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Dict

from fastapi import APIRouter, HTTPException, Request
from google.cloud import firestore
from pydantic import BaseModel, Field

try:
    from .drafts import normalize_draft, normalize_project_id
except ImportError:
    from drafts import normalize_draft, normalize_project_id


class WorkspaceCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class WorkspaceInviteRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
    role: str = Field(default="member", pattern=r"^(admin|member)$")


class WorkspaceAcceptRequest(BaseModel):
    token: str = Field(min_length=20, max_length=300)


class WorkspaceTransferRequest(BaseModel):
    member_uid: str = Field(min_length=1, max_length=160)


class WorkspaceProjectSaveRequest(BaseModel):
    project_id: str = Field(default="", max_length=128)
    expected_revision: int = Field(default=0, ge=0)
    draft: Dict[str, Any]


def _token_hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def create_workspace_router(
    *,
    authenticate_request: Callable[[Request], dict],
    get_database: Callable[[], Any],
    assert_upload_owner: Callable[[str, str], None],
    validate_file_id: Callable[[str], bool],
    find_upload: Callable[[str], Any],
    signed_upload_url: Callable[[str, str], str],
) -> APIRouter:
    router = APIRouter()

    def database():
        value = get_database()
        if value is None:
            raise HTTPException(503, "Workspace storage is unavailable")
        return value

    def membership(db, workspace_id: str, uid: str) -> dict:
        snapshot = db.collection("workspaces").document(workspace_id).collection("members").document(uid).get()
        value = snapshot.to_dict() if snapshot.exists else None
        if not value:
            raise HTTPException(403, "Workspace membership required")
        return value

    def require_admin(db, workspace_id: str, uid: str) -> dict:
        member = membership(db, workspace_id, uid)
        if member.get("role") not in {"owner", "admin"}:
            raise HTTPException(403, "Workspace administrator access required")
        return member

    @router.post("/api/workspaces", status_code=201)
    def create_workspace(req: WorkspaceCreateRequest, request: Request):
        principal = authenticate_request(request)
        uid = principal["uid"]
        db = database()
        workspace_id = f"ws_{uuid.uuid4().hex}"
        now = time.time()
        name = req.name.strip()
        batch = db.batch()
        workspace_ref = db.collection("workspaces").document(workspace_id)
        member_ref = workspace_ref.collection("members").document(uid)
        membership_ref = db.collection("users").document(uid).collection("workspace_memberships").document(workspace_id)
        batch.set(workspace_ref, {
            "workspace_id": workspace_id,
            "name": name,
            "owner_uid": uid,
            "created_at": now,
            "updated_at": now,
        })
        batch.set(member_ref, {"uid": uid, "email": principal.get("email", ""), "role": "owner", "joined_at": now})
        batch.set(membership_ref, {"workspace_id": workspace_id, "name": name, "role": "owner", "joined_at": now})
        batch.commit()
        return {"success": True, "workspace": {"workspace_id": workspace_id, "name": name, "role": "owner"}}

    @router.get("/api/workspaces")
    def list_workspaces(request: Request):
        uid = authenticate_request(request)["uid"]
        rows = []
        for snapshot in database().collection("users").document(uid).collection("workspace_memberships").stream():
            rows.append(snapshot.to_dict() or {})
        rows.sort(key=lambda item: float(item.get("joined_at") or 0), reverse=True)
        return {"success": True, "workspaces": rows}

    @router.get("/api/workspaces/{workspace_id}/members")
    def list_members(workspace_id: str, request: Request):
        uid = authenticate_request(request)["uid"]
        db = database()
        membership(db, workspace_id, uid)
        members = [snapshot.to_dict() or {} for snapshot in db.collection("workspaces").document(workspace_id).collection("members").stream()]
        return {"success": True, "members": members}

    @router.post("/api/workspaces/{workspace_id}/invites", status_code=201)
    def invite_member(workspace_id: str, req: WorkspaceInviteRequest, request: Request):
        uid = authenticate_request(request)["uid"]
        db = database()
        require_admin(db, workspace_id, uid)
        raw_token = secrets.token_urlsafe(32)
        token_hash = _token_hash(raw_token)
        invite_id = uuid.uuid4().hex
        record = {
            "invite_id": invite_id,
            "workspace_id": workspace_id,
            "email": str(req.email).strip().lower(),
            "role": req.role,
            "invited_by": uid,
            "created_at": time.time(),
            "expires_at": time.time() + 7 * 24 * 3600,
            "expire_at": datetime.now(timezone.utc) + timedelta(days=7),
            "accepted_at": None,
        }
        db.collection("workspace_invites").document(token_hash).set(record)
        return {"success": True, "invite": record, "invite_token": raw_token}

    @router.post("/api/workspace-invites/accept")
    def accept_invite(req: WorkspaceAcceptRequest, request: Request):
        principal = authenticate_request(request)
        uid = principal["uid"]
        email = str(principal.get("email") or "").strip().lower()
        db = database()
        invite_ref = db.collection("workspace_invites").document(_token_hash(req.token))
        snapshot = invite_ref.get()
        invite = snapshot.to_dict() if snapshot.exists else None
        if not invite or invite.get("accepted_at"):
            raise HTTPException(404, "Workspace invite is invalid or already used")
        if float(invite.get("expires_at") or 0) < time.time():
            raise HTTPException(410, "Workspace invite expired")
        if not email or email != invite.get("email"):
            raise HTTPException(403, "Sign in with the email address that was invited")
        workspace_id = invite["workspace_id"]
        workspace_ref = db.collection("workspaces").document(workspace_id)
        workspace = workspace_ref.get()
        if not workspace.exists:
            raise HTTPException(404, "Workspace no longer exists")
        workspace_data = workspace.to_dict() or {}
        now = time.time()
        batch = db.batch()
        batch.set(workspace_ref.collection("members").document(uid), {
            "uid": uid, "email": email, "role": invite["role"], "joined_at": now,
        })
        batch.set(db.collection("users").document(uid).collection("workspace_memberships").document(workspace_id), {
            "workspace_id": workspace_id,
            "name": workspace_data.get("name", "Workspace"),
            "role": invite["role"],
            "joined_at": now,
        })
        batch.update(invite_ref, {"accepted_at": now, "accepted_by": uid})
        batch.commit()
        return {"success": True, "workspace_id": workspace_id, "role": invite["role"]}

    @router.delete("/api/workspaces/{workspace_id}/members/{member_uid}")
    def remove_member(workspace_id: str, member_uid: str, request: Request):
        uid = authenticate_request(request)["uid"]
        db = database()
        require_admin(db, workspace_id, uid)
        target_ref = db.collection("workspaces").document(workspace_id).collection("members").document(member_uid)
        target = target_ref.get()
        target_data = target.to_dict() if target.exists else None
        if not target_data:
            raise HTTPException(404, "Workspace member not found")
        if target_data.get("role") == "owner":
            raise HTTPException(409, "Transfer workspace ownership before removing the owner")
        batch = db.batch()
        batch.delete(target_ref)
        batch.delete(db.collection("users").document(member_uid).collection("workspace_memberships").document(workspace_id))
        batch.commit()
        return {"success": True, "removed_uid": member_uid}

    @router.post("/api/workspaces/{workspace_id}/transfer-ownership")
    def transfer_ownership(workspace_id: str, req: WorkspaceTransferRequest, request: Request):
        uid = authenticate_request(request)["uid"]
        db = database()
        current = membership(db, workspace_id, uid)
        if current.get("role") != "owner":
            raise HTTPException(403, "Only the workspace owner can transfer ownership")
        if req.member_uid == uid:
            raise HTTPException(409, "This account already owns the workspace")
        workspace_ref = db.collection("workspaces").document(workspace_id)
        target_ref = workspace_ref.collection("members").document(req.member_uid)
        target = target_ref.get()
        if not target.exists:
            raise HTTPException(404, "New owner must already be a workspace member")
        batch = db.batch()
        batch.update(workspace_ref, {"owner_uid": req.member_uid, "updated_at": time.time()})
        batch.update(workspace_ref.collection("members").document(uid), {"role": "admin"})
        batch.update(target_ref, {"role": "owner"})
        batch.update(db.collection("users").document(uid).collection("workspace_memberships").document(workspace_id), {"role": "admin"})
        batch.update(db.collection("users").document(req.member_uid).collection("workspace_memberships").document(workspace_id), {"role": "owner"})
        batch.commit()
        return {"success": True, "workspace_id": workspace_id, "owner_uid": req.member_uid}

    @router.delete("/api/workspaces/{workspace_id}")
    def delete_workspace(workspace_id: str, request: Request):
        uid = authenticate_request(request)["uid"]
        db = database()
        current = membership(db, workspace_id, uid)
        if current.get("role") != "owner":
            raise HTTPException(403, "Only the workspace owner can delete the workspace")
        workspace_ref = db.collection("workspaces").document(workspace_id)
        for project in workspace_ref.collection("projects").stream():
            for revision in project.reference.collection("revisions").stream():
                revision.reference.delete()
            project.reference.delete()
        for member in workspace_ref.collection("members").stream():
            member_data = member.to_dict() or {}
            member_uid = member_data.get("uid") or member.id
            db.collection("users").document(member_uid).collection("workspace_memberships").document(workspace_id).delete()
            member.reference.delete()
        for invite in db.collection("workspace_invites").where("workspace_id", "==", workspace_id).stream():
            invite.reference.delete()
        workspace_ref.delete()
        return {"success": True, "workspace_id": workspace_id}

    @router.get("/api/workspaces/{workspace_id}/projects")
    def list_workspace_projects(workspace_id: str, request: Request):
        uid = authenticate_request(request)["uid"]
        db = database()
        membership(db, workspace_id, uid)
        rows = []
        for snapshot in db.collection("workspaces").document(workspace_id).collection("projects").limit(100).stream():
            value = snapshot.to_dict() or {}
            draft = value.get("draft") or {}
            rows.append({
                "project_id": snapshot.id,
                "name": draft.get("projectName") or "Untitled project",
                "revision": int(value.get("revision") or 0),
                "saved_at": value.get("saved_at"),
                "saved_by": value.get("saved_by"),
            })
        rows.sort(key=lambda item: str(item.get("saved_at") or ""), reverse=True)
        return {"success": True, "projects": rows}

    @router.get("/api/workspaces/{workspace_id}/projects/{project_id}")
    def load_workspace_project(workspace_id: str, project_id: str, request: Request):
        uid = authenticate_request(request)["uid"]
        db = database()
        membership(db, workspace_id, uid)
        project_id = normalize_project_id(project_id)
        snapshot = db.collection("workspaces").document(workspace_id).collection("projects").document(project_id).get()
        if not snapshot.exists:
            raise HTTPException(404, "Workspace project not found")
        value = snapshot.to_dict() or {}
        file_id = str((value.get("draft") or {}).get("fileId") or "")
        source_owner_uid = str(value.get("source_owner_uid") or value.get("saved_by") or "")
        raw_url = ""
        if validate_file_id(file_id) and source_owner_uid and find_upload(file_id):
            raw_url = signed_upload_url(file_id, source_owner_uid)
        return {"success": True, **value, "raw_url": raw_url}

    @router.put("/api/workspaces/{workspace_id}/projects")
    def save_workspace_project(workspace_id: str, req: WorkspaceProjectSaveRequest, request: Request):
        uid = authenticate_request(request)["uid"]
        db = database()
        membership(db, workspace_id, uid)
        draft = normalize_draft(req.draft)
        project_id = normalize_project_id(req.project_id or draft.get("projectId"), create=True)
        draft["projectId"] = project_id
        project_ref = db.collection("workspaces").document(workspace_id).collection("projects").document(project_id)
        current_snapshot = project_ref.get()
        current_value = current_snapshot.to_dict() if current_snapshot.exists else {}
        current_file_id = str((current_value.get("draft") or {}).get("fileId") or "")
        next_file_id = str(draft.get("fileId") or "")
        if next_file_id != current_file_id:
            assert_upload_owner(next_file_id, uid)
            source_owner_uid = uid
        else:
            source_owner_uid = str(current_value.get("source_owner_uid") or current_value.get("saved_by") or uid)

        @firestore.transactional
        def save(transaction):
            snapshot = project_ref.get(transaction=transaction)
            current = snapshot.to_dict() if snapshot.exists else {"revision": 0}
            if int(current.get("revision") or 0) != req.expected_revision:
                raise HTTPException(409, "A newer workspace project revision already exists")
            revision = req.expected_revision + 1
            payload = {
                "project_id": project_id,
                "revision": revision,
                "draft": draft,
                "saved_by": uid,
                "source_owner_uid": source_owner_uid,
                "saved_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            }
            transaction.set(project_ref, payload)
            transaction.set(project_ref.collection("revisions").document(str(revision % 10)), payload)
            return payload

        return {"success": True, **save(db.transaction())}

    @router.delete("/api/workspaces/{workspace_id}/projects/{project_id}")
    def delete_workspace_project(workspace_id: str, project_id: str, request: Request):
        uid = authenticate_request(request)["uid"]
        db = database()
        require_admin(db, workspace_id, uid)
        ref = db.collection("workspaces").document(workspace_id).collection("projects").document(normalize_project_id(project_id))
        if not ref.get().exists:
            raise HTTPException(404, "Workspace project not found")
        for revision in ref.collection("revisions").stream():
            revision.reference.delete()
        ref.delete()
        return {"success": True, "project_id": project_id}

    return router
