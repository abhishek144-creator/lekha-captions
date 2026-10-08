"""Response security headers, App Check, token authentication and tenant access checks.

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


def create_request_security(host: ModuleType) -> SimpleNamespace:
    def _apply_security_headers(response: host.Response) -> host.Response:
        response.headers["Content-Security-Policy"] = settings.SECURITY_CSP
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), geolocation=(), microphone=()"
        response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
        if settings._IS_PRODUCTION:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response


    def _app_check_required(request: host.Request) -> bool:
        if not settings.FIREBASE_APP_CHECK_ENFORCED or request.method.upper() == "OPTIONS":
            return False
        path = request.url.path
        return path not in settings._APP_CHECK_EXEMPT_PATHS and not any(
            path.startswith(prefix) for prefix in settings._APP_CHECK_EXEMPT_PREFIXES
        )


    def _verify_firebase_app_check_request(request: host.Request, request_id: str = "") -> host.Optional[host.JSONResponse]:
        """Require Firebase App Check for browser API traffic in production.

    Webhooks, signed media URLs, health probes, and operator-only endpoints use
    their own authentication and remain callable by non-browser infrastructure.
    """
        if not host._app_check_required(request):
            return None
        path = request.url.path
        token = str(request.headers.get("x-firebase-appcheck") or "").strip()
        if not token:
            observability._json_log("warning", "app_check_missing", path=path, request_id=request_id)
            return host.JSONResponse(
                status_code=403,
                content={"success": False, "error": "App security verification is required."},
                headers={"X-Request-Id": request_id} if request_id else None,
            )
        try:
            host.firebase_app_check.verify_token(token)
        except Exception as e:
            observability._json_log(
                "warning",
                "app_check_rejected",
                path=path,
                request_id=request_id,
                error=type(e).__name__,
            )
            return host.JSONResponse(
                status_code=403,
                content={"success": False, "error": "App security verification failed."},
                headers={"X-Request-Id": request_id} if request_id else None,
            )
        return None


    def _tenant_id_from_token(decoded_token: host.Optional[host.Dict[str, host.Any]]) -> str:
        if not decoded_token:
            return ""
        uid = (decoded_token.get("uid") or "").strip()
        return (decoded_token.get("org_id") or decoded_token.get("tenant_id") or (f"org_{uid}" if uid else "")).strip()


    def _is_explicit_dev_auth_token(id_token: str) -> bool:
        return (settings.DEBUG_MODE_ENABLED or settings.LOCAL_DEV_AUTH_BYPASS_ENABLED) and (id_token or "").strip() == "mock-token"


    def _assert_account_not_deleting(uid: str):
        if not settings._IS_PRODUCTION:
            return
        db = firebase_admin_setup.get_db()
        if db is None:
            raise host.HTTPException(status_code=503, detail="Account status is unavailable")
        try:
            fence = db.collection("account_deletions").document(uid).get()
        except Exception as error:
            raise host.HTTPException(status_code=503, detail="Account status is unavailable") from error
        if fence.exists:
            raise host.HTTPException(status_code=409, detail="Account deletion is in progress or complete.")


    def _create_account_if_active(db, user_ref, uid: str, data: host.Dict[str, host.Any]):
        if not settings._IS_PRODUCTION:
            return user_ref.create(data)
        @host.firestore.transactional
        def create(transaction):
            if db.collection("account_deletions").document(uid).get(transaction=transaction).exists:
                raise host.HTTPException(status_code=409, detail="Account deletion is in progress or complete.")
            if user_ref.get(transaction=transaction).exists:
                raise host.AlreadyExists("Account already exists")
            transaction.create(user_ref, data)
        return create(db.transaction())


    def _authenticate_media_request(id_token: str, org_id: str = "") -> host.Dict[str, host.Any]:
        token = (id_token or "").strip()
        if host._is_explicit_dev_auth_token(token):
            return {"uid": "dev-local-user", "_dev_mode": True}

        decoded_token = firebase_admin_setup.verify_token(token) if token else None
        if not decoded_token:
            raise host.HTTPException(status_code=401, detail="Authentication required")

        uid = (decoded_token.get("uid") or "").strip()
        host._assert_account_not_deleting(uid)
        host._assert_tenant_access(uid, decoded_token, org_id)
        return decoded_token


    def _authenticate_bearer_request(request: host.Request) -> host.Dict[str, host.Any]:
        authorization = (request.headers.get("authorization") or "").strip()
        token = authorization[7:].strip() if authorization.lower().startswith("bearer ") else ""
        return host._authenticate_media_request(token)


    def _assert_tenant_access(uid: str, decoded_token: host.Optional[host.Dict[str, host.Any]], org_id: str = ""):
        if not settings.ENFORCE_TENANT_ISOLATION:
            return
        token_org = host._tenant_id_from_token(decoded_token)
        requested_org = (org_id or "").strip()
        if not token_org:
            raise host.HTTPException(status_code=403, detail="Tenant identity is unavailable")
        if requested_org and requested_org != token_org:
            raise host.HTTPException(status_code=403, detail="Cross-tenant write is not allowed")
        known_members = app_state._tenant_memberships.setdefault(token_org, set())
        if uid in known_members:
            return
        db = firebase_admin_setup.get_db()
        if db and uid:
            try:
                tenant_ref = db.collection("tenants").document(token_org)
                member_ref = tenant_ref.collection("members").document(uid)
                if member_ref.get().exists:
                    known_members.add(uid)
                    return
                now_iso = observability._utcnow().isoformat() + "Z"
                batch = db.batch()
                batch.set(tenant_ref, {"updated_at": now_iso}, merge=True)
                batch.set(member_ref, {"uid": uid, "org_id": token_org, "updated_at": now_iso}, merge=True)
                batch.commit()
                known_members.add(uid)
            except Exception as e:
                observability._json_log("warning", "tenant_membership_persist_failed", uid=uid, org_id=token_org, error=str(e))

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
