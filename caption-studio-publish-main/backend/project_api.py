"""FastAPI router for account-scoped caption projects."""
from typing import Any, Dict, Optional
import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

try:
    from .drafts import delete_project, list_projects, read_draft, save_draft
except ImportError:
    from drafts import delete_project, list_projects, read_draft, save_draft


class DraftRequest(BaseModel):
    id_token: str = Field(default="", max_length=8192)
    project_id: str = Field(default="", max_length=128)
    expected_revision: int = Field(default=0, ge=0)
    draft: Optional[Dict[str, Any]] = None


class ProjectRequest(BaseModel):
    id_token: str = Field(default="", max_length=8192)
    project_id: str = Field(default="", max_length=128)


class ProjectRenameRequest(ProjectRequest):
    name: str = Field(min_length=1, max_length=120)


class ProjectDuplicateRequest(ProjectRequest):
    name: str = Field(default="", max_length=120)


def create_project_router(authenticate, get_database, validate_file_id, assert_upload_owner):
    router = APIRouter()

    def database():
        db = get_database()
        if db is None:
            raise HTTPException(503, "Cloud project storage is unavailable")
        return db

    @router.post("/api/projects/list")
    def list_account_projects(req: ProjectRequest):
        uid = authenticate(req.id_token)["uid"]
        return {"success": True, "projects": list_projects(database(), uid)}

    @router.post("/api/draft/load")
    def load_account_draft(req: DraftRequest):
        uid = authenticate(req.id_token)["uid"]
        return {"success": True, **read_draft(database(), uid, req.project_id)}

    @router.post("/api/draft/save")
    def save_account_draft(req: DraftRequest):
        uid = authenticate(req.id_token)["uid"]
        db = database()
        if not req.draft or not validate_file_id(str(req.draft.get("fileId") or "")):
            raise HTTPException(422, "Project requires a valid media reference")
        project_id = req.project_id or str(req.draft.get("projectId") or "")
        previous = read_draft(db, uid, project_id) if project_id else {"draft": None}
        if (previous.get("draft") or {}).get("fileId") != req.draft["fileId"]:
            assert_upload_owner(req.draft["fileId"], uid)
        return {"success": True, **save_draft(db, uid, req.draft, req.expected_revision, project_id)}

    @router.post("/api/projects/delete")
    def delete_account_project(req: ProjectRequest):
        uid = authenticate(req.id_token)["uid"]
        return {"success": True, "deleted": delete_project(database(), uid, req.project_id)}

    @router.post("/api/projects/rename")
    def rename_account_project(req: ProjectRenameRequest):
        uid = authenticate(req.id_token)["uid"]
        db = database()
        current = read_draft(db, uid, req.project_id)
        draft = current.get("draft")
        if not draft:
            raise HTTPException(404, "Project not found")
        project_name = req.name.strip()
        if not project_name:
            raise HTTPException(422, "Project name is required")
        draft = {**draft, "projectName": project_name}
        return {
            "success": True,
            **save_draft(db, uid, draft, int(current.get("revision") or 0), req.project_id),
        }

    @router.post("/api/projects/duplicate")
    def duplicate_account_project(req: ProjectDuplicateRequest):
        uid = authenticate(req.id_token)["uid"]
        db = database()
        current = read_draft(db, uid, req.project_id)
        source = current.get("draft")
        if not source:
            raise HTTPException(404, "Project not found")
        duplicate_id = f"project-{uuid.uuid4().hex}"
        source_name = str(source.get("projectName") or source.get("originalFileName") or "Untitled project")
        duplicate = {
            **source,
            "projectId": duplicate_id,
            "projectName": req.name.strip() or f"{source_name} copy",
        }
        return {"success": True, **save_draft(db, uid, duplicate, 0, duplicate_id)}

    return router
