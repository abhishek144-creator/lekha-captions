"""Bounded account-scoped editor preferences for portable creator tools."""
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from google.cloud import firestore
from pydantic import BaseModel, Field


MAX_BRAND_KITS = 8
MAX_GLOSSARY_TERMS = 100
BRAND_STYLE_FIELDS = {
    "font_family", "font_size", "font_weight", "font_style", "line_spacing",
    "word_spacing", "letter_spacing", "text_align", "text_case", "text_color",
    "text_gradient", "text_opacity", "highlight_color", "highlight_gradient",
    "secondary_color", "has_background", "background_color", "background_opacity",
    "background_padding", "background_h_multiplier", "has_stroke", "stroke_width",
    "stroke_color", "has_shadow", "shadow_color", "shadow_blur", "shadow_offset_x",
    "shadow_offset_y", "position_x", "position_y",
}


def _plain_value(value):
    return value is None or isinstance(value, (str, int, float, bool))


def normalize_brand_kits(value: Any) -> List[Dict[str, Any]]:
    if not isinstance(value, list) or len(value) > MAX_BRAND_KITS:
        raise HTTPException(422, f"Brand kits must contain at most {MAX_BRAND_KITS} items")
    normalized = []
    seen = set()
    for item in value:
        if not isinstance(item, dict):
            raise HTTPException(422, "Invalid brand kit")
        kit_id = str(item.get("id") or "").strip()[:100]
        if not kit_id or kit_id in seen:
            raise HTTPException(422, "Brand kit identifiers must be unique")
        style = item.get("style")
        if not isinstance(style, dict):
            raise HTTPException(422, "Invalid brand kit style")
        safe_style = {
            key: value for key, value in style.items()
            if key in BRAND_STYLE_FIELDS and _plain_value(value)
        }
        if not safe_style:
            raise HTTPException(422, "Brand kit style is empty")
        seen.add(kit_id)
        normalized.append({
            "id": kit_id,
            "name": (str(item.get("name") or "Brand Kit").strip()[:60] or "Brand Kit"),
            "style": safe_style,
            "updated_at": str(item.get("updated_at") or "")[:40],
        })
    return normalized


def normalize_glossary_terms(value: Any) -> List[Dict[str, Any]]:
    if not isinstance(value, list) or len(value) > MAX_GLOSSARY_TERMS:
        raise HTTPException(422, f"Glossary must contain at most {MAX_GLOSSARY_TERMS} terms")
    normalized = []
    seen = set()
    for item in value:
        if not isinstance(item, dict):
            raise HTTPException(422, "Invalid glossary term")
        source = str(item.get("source") or "").strip()[:120]
        replacement = str(item.get("replacement") or "").strip()[:120]
        identity = source.casefold()
        if not source or not replacement or identity in seen:
            raise HTTPException(422, "Glossary terms require unique source and replacement text")
        seen.add(identity)
        normalized.append({
            "id": str(item.get("id") or identity).strip()[:100] or identity,
            "source": source,
            "replacement": replacement,
            "case_sensitive": bool(item.get("case_sensitive", False)),
            "updated_at": str(item.get("updated_at") or "")[:40],
        })
    return normalized


def read_editor_preferences(db, uid: str) -> Dict[str, Any]:
    snapshot = db.collection("users").document(uid).collection("preferences").document("editor").get()
    if not snapshot.exists:
        return {"brand_kits": [], "glossary_terms": [], "updated_at": "", "exists": False, "revision": 0}
    data = snapshot.to_dict() or {}
    return {
        "brand_kits": normalize_brand_kits(data.get("brand_kits") or []),
        "glossary_terms": normalize_glossary_terms(data.get("glossary_terms") or []),
        "updated_at": str(data.get("updated_at") or ""),
        "exists": True,
        "revision": int(data.get("revision") or 0),
    }


def save_editor_preferences(db, uid: str, patch: Dict[str, Any], expected_revision=0) -> Dict[str, Any]:
    user_ref = db.collection("users").document(uid)
    preference_ref = user_ref.collection("preferences").document("editor")
    deletion_ref = db.collection("account_deletions").document(uid)

    @firestore.transactional
    def save(transaction):
        if deletion_ref.get(transaction=transaction).exists:
            raise HTTPException(409, "Account is unavailable")
        if not user_ref.get(transaction=transaction).exists:
            raise HTTPException(409, "Account is unavailable")
        snapshot = preference_ref.get(transaction=transaction)
        current = snapshot.to_dict() if snapshot.exists else {}
        revision = int(current.get("revision") or 0)
        if revision != expected_revision:
            raise HTTPException(409, "Preferences changed on another device. Export your local kits before reloading the cloud copy.")
        current["revision"] = revision + 1
        if "brand_kits" in patch:
            current["brand_kits"] = normalize_brand_kits(patch["brand_kits"])
        if "glossary_terms" in patch:
            current["glossary_terms"] = normalize_glossary_terms(patch["glossary_terms"])
        current["updated_at"] = datetime.now(timezone.utc).isoformat()
        transaction.set(preference_ref, current)
        return current

    saved = save(db.transaction())
    return {**saved, "exists": True}


class EditorPreferencesRequest(BaseModel):
    id_token: str = Field(default="", max_length=8192)
    expected_revision: int = Field(default=0, ge=0)
    brand_kits: Optional[List[Dict[str, Any]]] = None
    glossary_terms: Optional[List[Dict[str, Any]]] = None


def create_editor_preferences_router(authenticate, get_database):
    router = APIRouter()

    def context(req):
        uid = authenticate(req.id_token)["uid"]
        db = get_database()
        if db is None:
            raise HTTPException(503, "Editor preference storage is unavailable")
        return db, uid

    @router.post("/api/editor-preferences/load")
    def load_preferences(req: EditorPreferencesRequest):
        db, uid = context(req)
        return {"success": True, "preferences": read_editor_preferences(db, uid)}

    @router.post("/api/editor-preferences/save")
    def save_preferences(req: EditorPreferencesRequest):
        db, uid = context(req)
        patch = {}
        if req.brand_kits is not None:
            patch["brand_kits"] = req.brand_kits
        if req.glossary_terms is not None:
            patch["glossary_terms"] = req.glossary_terms
        if not patch:
            raise HTTPException(422, "No editor preferences supplied")
        return {"success": True, "preferences": save_editor_preferences(db, uid, patch, req.expected_revision)}

    return router
