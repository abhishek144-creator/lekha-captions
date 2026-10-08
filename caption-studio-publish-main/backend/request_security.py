"""Response security headers, App Check, token authentication and tenant access checks.

The factory accepts explicit configuration, adapters and shared state through
ServiceContext. It has no dependency on the HTTP entry point.
"""

from types import SimpleNamespace
from typing import Protocol, Any
from typing import Dict
from fastapi import HTTPException
from fastapi.responses import JSONResponse
from typing import Optional
from fastapi import Request
from fastapi import Response

class ServiceContext(Protocol):
    AlreadyExists: Any
    DEBUG_MODE_ENABLED: Any
    ENFORCE_TENANT_ISOLATION: Any
    FIREBASE_APP_CHECK_ENFORCED: Any
    LOCAL_DEV_AUTH_BYPASS_ENABLED: Any
    SECURITY_CSP: Any
    _APP_CHECK_EXEMPT_PATHS: Any
    _APP_CHECK_EXEMPT_PREFIXES: Any
    _IS_PRODUCTION: Any
    _app_check_required: Any
    _assert_account_not_deleting: Any
    _assert_tenant_access: Any
    _authenticate_media_request: Any
    _is_explicit_dev_auth_token: Any
    _json_log: Any
    _tenant_id_from_token: Any
    _tenant_memberships: Any
    _utcnow: Any
    firebase_app_check: Any
    firestore: Any
    get_db: Any
    verify_token: Any


def create_request_security(context: ServiceContext) -> SimpleNamespace:
    def _apply_security_headers(response: Response) -> Response:
        response.headers["Content-Security-Policy"] = context.SECURITY_CSP
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), geolocation=(), microphone=()"
        response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
        if getattr(context, "_IS_PRODUCTION", False):
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response


    def _app_check_required(request: Request) -> bool:
        if not context.FIREBASE_APP_CHECK_ENFORCED or request.method.upper() == "OPTIONS":
            return False
        path = request.url.path
        return path not in context._APP_CHECK_EXEMPT_PATHS and not any(
            path.startswith(prefix) for prefix in context._APP_CHECK_EXEMPT_PREFIXES
        )


    def _verify_firebase_app_check_request(request: Request, request_id: str = "") -> Optional[JSONResponse]:
        """Require Firebase App Check for browser API traffic in production.

    Webhooks, signed media URLs, health probes, and operator-only endpoints use
    their own authentication and remain callable by non-browser infrastructure.
    """
        if not context._app_check_required(request):
            return None
        path = request.url.path
        token = str(request.headers.get("x-firebase-appcheck") or "").strip()
        if not token:
            context._json_log("warning", "app_check_missing", path=path, request_id=request_id)
            return JSONResponse(
                status_code=403,
                content={"success": False, "error": "App security verification is required."},
                headers={"X-Request-Id": request_id} if request_id else None,
            )
        try:
            context.firebase_app_check.verify_token(token)
        except Exception as e:
            context._json_log(
                "warning",
                "app_check_rejected",
                path=path,
                request_id=request_id,
                error=type(e).__name__,
            )
            return JSONResponse(
                status_code=403,
                content={"success": False, "error": "App security verification failed."},
                headers={"X-Request-Id": request_id} if request_id else None,
            )
        return None


    def _tenant_id_from_token(decoded_token: Optional[Dict[str, Any]]) -> str:
        if not decoded_token:
            return ""
        uid = (decoded_token.get("uid") or "").strip()
        return (decoded_token.get("org_id") or decoded_token.get("tenant_id") or (f"org_{uid}" if uid else "")).strip()


    def _is_explicit_dev_auth_token(id_token: str) -> bool:
        return (context.DEBUG_MODE_ENABLED or context.LOCAL_DEV_AUTH_BYPASS_ENABLED) and (id_token or "").strip() == "mock-token"


    def _assert_account_not_deleting(uid: str):
        if not context._IS_PRODUCTION:
            return
        db = context.get_db()
        if db is None:
            raise HTTPException(status_code=503, detail="Account status is unavailable")
        try:
            fence = db.collection("account_deletions").document(uid).get()
        except Exception as error:
            raise HTTPException(status_code=503, detail="Account status is unavailable") from error
        if fence.exists:
            raise HTTPException(status_code=409, detail="Account deletion is in progress or complete.")


    def _create_account_if_active(db, user_ref, uid: str, data: Dict[str, Any]):
        if not context._IS_PRODUCTION:
            return user_ref.create(data)
        @context.firestore.transactional
        def create(transaction):
            if db.collection("account_deletions").document(uid).get(transaction=transaction).exists:
                raise HTTPException(status_code=409, detail="Account deletion is in progress or complete.")
            if user_ref.get(transaction=transaction).exists:
                raise context.AlreadyExists("Account already exists")
            transaction.create(user_ref, data)
        return create(db.transaction())


    def _authenticate_media_request(id_token: str, org_id: str = "") -> Dict[str, Any]:
        token = (id_token or "").strip()
        if context._is_explicit_dev_auth_token(token):
            return {"uid": "dev-local-user", "_dev_mode": True}

        decoded_token = context.verify_token(token) if token else None
        if not decoded_token:
            raise HTTPException(status_code=401, detail="Authentication required")

        uid = (decoded_token.get("uid") or "").strip()
        context._assert_account_not_deleting(uid)
        context._assert_tenant_access(uid, decoded_token, org_id)
        return decoded_token


    def _authenticate_bearer_request(request: Request) -> Dict[str, Any]:
        authorization = (request.headers.get("authorization") or "").strip()
        token = authorization[7:].strip() if authorization.lower().startswith("bearer ") else ""
        return context._authenticate_media_request(token)


    def _assert_tenant_access(uid: str, decoded_token: Optional[Dict[str, Any]], org_id: str = ""):
        if not context.ENFORCE_TENANT_ISOLATION:
            return
        token_org = context._tenant_id_from_token(decoded_token)
        requested_org = (org_id or "").strip()
        if not token_org:
            raise HTTPException(status_code=403, detail="Tenant identity is unavailable")
        if requested_org and requested_org != token_org:
            raise HTTPException(status_code=403, detail="Cross-tenant write is not allowed")
        known_members = context._tenant_memberships.setdefault(token_org, set())
        if uid in known_members:
            return
        db = context.get_db()
        if db and uid:
            try:
                tenant_ref = db.collection("tenants").document(token_org)
                member_ref = tenant_ref.collection("members").document(uid)
                if member_ref.get().exists:
                    known_members.add(uid)
                    return
                now_iso = context._utcnow().isoformat() + "Z"
                batch = db.batch()
                batch.set(tenant_ref, {"updated_at": now_iso}, merge=True)
                batch.set(member_ref, {"uid": uid, "org_id": token_org, "updated_at": now_iso}, merge=True)
                batch.commit()
                known_members.add(uid)
            except Exception as e:
                context._json_log("warning", "tenant_membership_persist_failed", uid=uid, org_id=token_org, error=str(e))

    return SimpleNamespace(
        _apply_security_headers=_apply_security_headers,
        _app_check_required=_app_check_required,
        _verify_firebase_app_check_request=_verify_firebase_app_check_request,
        _tenant_id_from_token=_tenant_id_from_token,
        _is_explicit_dev_auth_token=_is_explicit_dev_auth_token,
        _assert_account_not_deleting=_assert_account_not_deleting,
        _create_account_if_active=_create_account_if_active,
        _authenticate_media_request=_authenticate_media_request,
        _authenticate_bearer_request=_authenticate_bearer_request,
        _assert_tenant_access=_assert_tenant_access,
    )
