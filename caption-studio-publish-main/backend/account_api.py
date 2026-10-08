"""Account routes: bootstrap, data export, deletion, promo redemption and the synthetic customer-journey probe.

Handlers resolve shared helpers through ``host`` (the main module) at call time,
so there is one copy of each helper and test patches on ``main`` keep applying.
"""

from types import ModuleType, SimpleNamespace

from fastapi import FastAPI, UploadFile, File, HTTPException, Response
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Request
from fastapi import APIRouter

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
try:
    from . import request_security
except ImportError:  # Direct execution from backend/ remains supported.
    import request_security
try:
    from . import entitlements
except ImportError:  # Direct execution from backend/ remains supported.
    import entitlements
try:
    from . import operator_controls
except ImportError:  # Direct execution from backend/ remains supported.
    import operator_controls
try:
    from . import request_guards
except ImportError:  # Direct execution from backend/ remains supported.
    import request_guards


def create_account_router(host: ModuleType) -> SimpleNamespace:
    router = APIRouter()

    class RedeemPromoRequest(host.BaseModel):
        id_token: str = host.Field(min_length=1, max_length=8_192)
        code: str = host.Field(min_length=1, max_length=64)


    @router.post("/api/redeem-promo")
    def redeem_promo(req: RedeemPromoRequest, request: Request, response: Response):
        client_ip = request_guards._client_rate_key(request)
        allowed, retry_after, remaining = request_guards._check_rate(app_state._promo_rate, client_ip, settings.PROMO_RATE_LIMIT)
        request_guards._apply_rate_headers(response, settings.PROMO_RATE_LIMIT, remaining, retry_after)
        if not allowed:
            raise HTTPException(status_code=429, detail="Too many promo code attempts. Please wait before trying again.")
        decoded = firebase_admin_setup.verify_token(req.id_token)
        if not decoded:
            raise HTTPException(status_code=401, detail="Unauthorized")
        uid = decoded.get('uid')

        db = firebase_admin_setup.get_db()
        if not db:
            raise HTTPException(status_code=503, detail="Database unavailable")

        code_upper = req.code.strip().upper()
        code_ref = db.collection("promo_codes").document(code_upper)
        user_ref = db.collection("users").document(uid)
        transaction = db.transaction()

        @host.firestore.transactional
        def redeem_in_transaction(txn):
            if settings._IS_PRODUCTION and db.collection("account_deletions").document(uid).get(transaction=txn).exists:
                raise HTTPException(status_code=409, detail="Account deletion is pending.")
            code_doc = code_ref.get(transaction=txn)
            if not code_doc.exists:
                raise HTTPException(status_code=400, detail="Invalid or already used code")

            promo = code_doc.to_dict() or {}
            if promo.get("is_used"):
                raise HTTPException(status_code=400, detail="Invalid or already used code")
            if promo.get("plan_id") not in settings.PLAN_PRICING:
                raise HTTPException(status_code=400, detail="Promo code references an invalid plan")

            user_doc = user_ref.get(transaction=txn)
            user_email = user_doc.to_dict().get("email", "") if user_doc.exists else ""
            now = observability._utcnow()
            expiry_date = (now + host.relativedelta(months=int(promo["duration_months"]))).date().isoformat()

            txn.update(code_ref, {
                "is_used": True,
                "used_by_email": user_email,
                "used_at": now.isoformat(),
            })

            txn.set(user_ref, {
                "subscription_tier": promo["plan_id"],
                "credits_remaining": int(promo["credits_per_month"]),
                "billing_cycle_start": now.isoformat(),
                "billing_cycle_end": expiry_date,
                "subscription_expiry": expiry_date,
                "is_promo_user": True,
                "promo_code_used": code_upper,
                "promo_plan": promo["plan_id"],
                "promo_expires": expiry_date,
            }, merge=True)
            return promo, expiry_date

        promo, expiry_date = redeem_in_transaction(transaction)

        return {
            "success": True,
            "plan": promo["plan_id"],
            "credits": int(promo["credits_per_month"]),
            "expires": expiry_date,
        }


    class DeleteFileRequest(host.BaseModel):
        file_id: str = host.Field(min_length=36, max_length=36)
        id_token: str = host.Field(min_length=1, max_length=8_192)
        org_id: str = host.Field(default="", max_length=128)


    class AccountDataRequest(host.BaseModel):
        id_token: str = host.Field(min_length=1, max_length=8_192)
        org_id: str = host.Field(default="", max_length=128)
        consent_granted: bool = False
        terms_version: str = host.Field(default="", max_length=40, pattern=r"^[0-9A-Za-z._-]*$")
        privacy_version: str = host.Field(default="", max_length=40, pattern=r"^[0-9A-Za-z._-]*$")


    class SyntheticJourneyRequest(host.BaseModel):
        id_token: str = host.Field(min_length=1, max_length=8_192)


    @router.post("/api/health/customer-journey")
    def authenticated_customer_journey(req: SyntheticJourneyRequest):
        """Exercise Firebase auth and the account store without returning user data.

    This route sits under the health namespace so a server-side monitor can call
    it without a browser-generated App Check token. A valid Firebase user token
    is still mandatory, and the check is read-only and tenant-local.
    """
        decoded_token = firebase_admin_setup.verify_token(req.id_token)
        if not decoded_token:
            raise HTTPException(status_code=401, detail="Auth required")
        uid = str(decoded_token.get("uid") or "").strip()
        if not uid:
            raise HTTPException(status_code=401, detail="Auth required")
        db = firebase_admin_setup.get_db()
        if not db:
            raise HTTPException(status_code=503, detail="Database unavailable")
        user_doc = db.collection("users").document(uid).get()
        if not user_doc.exists:
            raise HTTPException(status_code=503, detail="Synthetic account record unavailable")
        return {"success": True, "authenticated": True, "account_store": True}


    class AccountExportRequest(AccountDataRequest):
        payment_limit: int = host.Field(default=100, ge=1, le=500)
        payment_cursor: str = host.Field(default="", max_length=1_500)


    def _delete_user_document_tree(db, user_ref):
        recursive_delete = getattr(db, "recursive_delete", None)
        if callable(recursive_delete):
            recursive_delete(user_ref)
            return

        for project_doc in user_ref.collection("projects").limit(100).stream():
            project_ref = project_doc.reference
            if hasattr(project_ref, "collection"):
                for revision_doc in project_ref.collection("revisions").limit(10).stream():
                    revision_doc.reference.delete()
            project_ref.delete()
        for preference_doc in user_ref.collection("preferences").limit(20).stream():
            preference_doc.reference.delete()

        for collection_name in (
            "payments", "export_usage", "drafts", "draft_revisions",
            "transcription_jobs", "operation_locks", "workspace_memberships",
            "api_key_index",
        ):
            child_ref = user_ref.collection(collection_name)
            while True:
                child_docs = list(child_ref.limit(400).stream())
                if not child_docs:
                    break
                if hasattr(db, "batch"):
                    batch = db.batch()
                    for child_doc in child_docs:
                        batch.delete(child_doc.reference)
                    batch.commit()
                else:
                    for child_doc in child_docs:
                        child_doc.reference.delete()
                if len(child_docs) < 400:
                    break
        user_ref.delete()


    def _account_workspace_memberships(db, uid: str) -> list:
        try:
            return list(db.collection("users").document(uid).collection("workspace_memberships").stream())
        except Exception:
            return []


    def _assert_no_owned_workspaces(db, uid: str):
        owned = [
            snapshot.id
            for snapshot in host._account_workspace_memberships(db, uid)
            if callable(getattr(snapshot, "to_dict", None))
            and (snapshot.to_dict() or {}).get("role") == "owner"
        ]
        if owned:
            raise HTTPException(
                409,
                detail={
                    "message": "Transfer or delete owned workspaces before deleting this account.",
                    "workspace_ids": owned,
                },
            )


    def _delete_top_level_rows_for_account(db, collection_name: str, uid: str):
        collection = db.collection(collection_name)
        where = getattr(collection, "where", None)
        if not callable(where):
            # Lightweight local/test adapters may expose only account subcollections.
            return
        query = where("uid", "==", uid).limit(500)
        for snapshot in query.stream():
            snapshot.reference.delete()


    def _cleanup_account_extensions(db, uid: str):
        # Remove the member from workspaces they do not own. Owned workspaces were
        # fenced before destructive cleanup so teammates can never be orphaned.
        for snapshot in host._account_workspace_memberships(db, uid):
            if not callable(getattr(snapshot, "to_dict", None)):
                continue
            membership_data = snapshot.to_dict() or {}
            workspace_id = membership_data.get("workspace_id") or snapshot.id
            if membership_data.get("role") != "owner":
                db.collection("workspaces").document(workspace_id).collection("members").document(uid).delete()

        # Delete the lookup hashes as well as the per-user index so an old secret
        # stops authenticating before the Firebase identity is removed.
        for snapshot in db.collection("users").document(uid).collection("api_key_index").stream():
            if not callable(getattr(snapshot, "to_dict", None)):
                continue
            value = snapshot.to_dict() or {}
            if value.get("key_hash"):
                db.collection("api_keys").document(value["key_hash"]).delete()

        for collection_name in ("user_notifications", "export_batches"):
            host._delete_top_level_rows_for_account(db, collection_name, uid)


    def _remove_history_item_transactionally(db, user_ref, file_id: str):
        @host.firestore.transactional
        def _remove(transaction):
            user_doc = user_ref.get(transaction=transaction)
            if not user_doc.exists:
                raise HTTPException(status_code=404, detail="Account not found")
            history = (user_doc.to_dict() or {}).get("history", []) or []
            transaction.update(
                user_ref,
                {"history": [item for item in history if item.get("id") != file_id]},
            )

        _remove(db.transaction())


    def _mark_history_item_deleting_transactionally(db, user_ref, file_id: str):
        @host.firestore.transactional
        def _mark(transaction):
            user_doc = user_ref.get(transaction=transaction)
            if not user_doc.exists:
                raise HTTPException(status_code=404, detail="Account not found")
            history = (user_doc.to_dict() or {}).get("history", []) or []
            found = False
            updated_history = []
            for item in history:
                if isinstance(item, dict) and item.get("id") == file_id:
                    found = True
                    updated_history.append({
                        **item,
                        "deletion_pending": True,
                        "deletion_requested_at": host.datetime.now(host.timezone.utc).isoformat(),
                    })
                else:
                    updated_history.append(item)
            if not found:
                raise HTTPException(status_code=404, detail="File not found in this account")
            transaction.update(user_ref, {"history": updated_history})

        _mark(db.transaction())


    @router.post("/api/account-bootstrap")
    def account_bootstrap(req: AccountDataRequest, request: Request):
        """Create safe account defaults server-side and return the user's record."""
        decoded_token = firebase_admin_setup.verify_token(req.id_token)
        if not decoded_token:
            raise HTTPException(status_code=401, detail="Auth required")
        uid = (decoded_token.get("uid") or "").strip()
        if not uid:
            raise HTTPException(status_code=401, detail="Auth required")
        request_security._assert_tenant_access(uid, decoded_token, req.org_id)
        db = firebase_admin_setup.get_db()
        if not db:
            raise HTTPException(status_code=503, detail="Database unavailable")

        request_security._assert_account_not_deleting(uid)
        user_ref = db.collection("users").document(uid)
        # Existing accounts keep working while sign-ups are paused; only the first
        # bootstrap of a brand-new account is blocked.
        if not user_ref.get().exists:
            operator_controls._assert_service_available("pause_signups")
            client_ip = request_guards._client_rate_key(request)
            for rate_key, rate_limit in (
                (f"signup:network:{client_ip}", settings.SIGNUP_SHARED_NETWORK_RATE_LIMIT),
                (f"signup:user:{uid}", settings.SIGNUP_USER_RATE_LIMIT),
            ):
                allowed, _retry_after, _remaining = request_guards._check_rate(
                    app_state._signup_rate, rate_key, rate_limit
                )
                if not allowed:
                    raise HTTPException(
                        status_code=429,
                        detail="Too many account creation attempts. Please wait before trying again.",
                    )
        safe_profile = {
            "uid": uid,
            "org_id": request_security._tenant_id_from_token(decoded_token),
            "email": str(decoded_token.get("email") or "")[:320],
            "displayName": str(decoded_token.get("name") or "")[:200],
            "photoURL": str(decoded_token.get("picture") or "")[:2_048],
        }
        try:
            request_security._create_account_if_active(db, user_ref, uid, {
                **safe_profile,
                "credits_remaining": settings.FREE_PLAN_CREDITS,
                "subscription_tier": "free",
                "subscription_expiry": None,
                "export_timestamps": [],
                "created_at": host.time.time(),
            })
            observability._audit_action("account_bootstrap_created", uid)
            observability._track_event("account_signup", {"uid": uid})
        except host.AlreadyExists:
            # Only identity-provider profile fields may be refreshed here. Billing
            # and entitlement fields remain server-controlled elsewhere.
            user_ref.set(safe_profile, merge=True)

        # A small number of accounts can predate server-owned entitlements. Repair
        # an absent or out-of-range Free balance in a transaction. Explicit zero is
        # preserved, and a concurrent paid-plan grant can never be overwritten.
        existing_user = user_ref.get()
        existing_data = existing_user.to_dict() or {} if existing_user.exists else {}
        existing_is_free = (
            entitlements._normalize_tier_name(existing_data.get("subscription_tier", "free")) == settings.FREE_PLAN_ID
        )
        existing_has_credits = "credits_remaining" in existing_data
        normalized_existing_credits = entitlements._normalize_free_credit_balance(
            existing_data.get("credits_remaining"),
            default=settings.FREE_PLAN_CREDITS if not existing_has_credits else 0,
        )
        if (
            existing_user.exists
            and existing_is_free
            and (
                not existing_has_credits
                or existing_data.get("credits_remaining") != normalized_existing_credits
            )
        ):
            @host.firestore.transactional
            def _repair_legacy_free_entitlement(transaction):
                snapshot = user_ref.get(transaction=transaction)
                if not snapshot.exists:
                    return False
                data = snapshot.to_dict() or {}
                if entitlements._normalize_tier_name(data.get("subscription_tier", "free")) != settings.FREE_PLAN_ID:
                    return False
                has_credits = "credits_remaining" in data
                repaired_credits = entitlements._normalize_free_credit_balance(
                    data.get("credits_remaining"),
                    default=settings.FREE_PLAN_CREDITS if not has_credits else 0,
                )
                if has_credits and data.get("credits_remaining") == repaired_credits:
                    return False
                update = {
                    "credits_remaining": repaired_credits,
                    "export_timestamps": data.get("export_timestamps", []) or [],
                }
                if not data.get("subscription_tier"):
                    update["subscription_tier"] = settings.FREE_PLAN_ID
                transaction.set(user_ref, update, merge=True)
                return {
                    "previous_credits": data.get("credits_remaining") if has_credits else None,
                    "repaired_credits": repaired_credits,
                }

            repair_result = _repair_legacy_free_entitlement(db.transaction())
            if repair_result:
                observability._audit_action("account_bootstrap_repaired_free_entitlement", uid, repair_result)

        if req.consent_granted:
            if not req.terms_version or not req.privacy_version:
                raise HTTPException(status_code=400, detail="Consent document versions are required")
            consent_key = host.hashlib.sha256(
                f"{uid}:{req.terms_version}:{req.privacy_version}:grant".encode("utf-8")
            ).hexdigest()
            consent_payload = {
                "action": "grant",
                "terms_version": req.terms_version,
                "privacy_version": req.privacy_version,
                "captured_at": host.datetime.now(host.timezone.utc),
                "ip_address": request.client.host if request.client else "unknown",
                "user_agent": (request.headers.get("user-agent") or "")[:500],
                "capture_method": "login_checkbox",
            }
            try:
                user_ref.collection("consents").document(consent_key).create(consent_payload)
            except host.AlreadyExists:
                pass
            user_ref.set({
                "accepted_terms_version": req.terms_version,
                "accepted_privacy_version": req.privacy_version,
                "consent_updated_at": host.datetime.now(host.timezone.utc),
            }, merge=True)
            observability._audit_action("consent_granted", uid, {
                "terms_version": req.terms_version,
                "privacy_version": req.privacy_version,
            })

        user_doc = user_ref.get()
        if not user_doc.exists:
            raise HTTPException(status_code=503, detail="Account initialization unavailable")
        return {"success": True, "user": user_doc.to_dict() or {}}


    @router.post("/api/account-export")
    def account_export(req: AccountExportRequest):
        decoded_token = firebase_admin_setup.verify_token(req.id_token)
        if not decoded_token:
            raise HTTPException(status_code=401, detail="Auth required")
        uid = decoded_token.get("uid")
        request_security._assert_tenant_access(uid, decoded_token, req.org_id)
        db = firebase_admin_setup.get_db()
        if not db:
            raise HTTPException(status_code=503, detail="Database unavailable")
        user_ref = db.collection("users").document(uid)
        user_doc = user_ref.get()
        payments_ref = user_ref.collection("payments")
        payment_query = payments_ref.order_by("timestamp", direction=host.firestore.Query.DESCENDING)
        if req.payment_cursor:
            cursor_doc = payments_ref.document(req.payment_cursor).get()
            if not cursor_doc.exists:
                raise HTTPException(status_code=400, detail="Invalid payment cursor")
            payment_query = payment_query.start_after(cursor_doc)
        page_docs = list(payment_query.limit(req.payment_limit + 1).stream())
        has_more = len(page_docs) > req.payment_limit
        page_docs = page_docs[:req.payment_limit]
        payment_items = [{"id": p.id, **(p.to_dict() or {})} for p in page_docs]
        deletion_record = {}
        if settings._IS_PRODUCTION:
            deletion_doc = db.collection("account_deletions").document(uid).get()
            if deletion_doc.exists:
                deletion_record = deletion_doc.to_dict() or {}
        # Older development database adapters expose only the account/payment
        # collections. Keep exports useful there while including every project and
        # portable editor preference whenever nested document access is available.
        has_nested_account_storage = hasattr(user_ref.collection("projects"), "document")
        project_rows = host.list_projects(db, uid) if has_nested_account_storage else []
        projects = [host.read_draft(db, uid, row["project_id"]) for row in project_rows]
        editor_preferences = host.read_editor_preferences(db, uid) if has_nested_account_storage else {
            "brand_kits": [], "glossary_terms": [], "updated_at": "", "exists": False,
        }
        workspace_memberships = [
            snapshot.to_dict() or {}
            for snapshot in host._account_workspace_memberships(db, uid)
            if callable(getattr(snapshot, "to_dict", None))
        ]
        notifications = []
        try:
            notifications = [
                snapshot.to_dict() or {}
                for snapshot in db.collection("user_notifications").where("uid", "==", uid).limit(100).stream()
            ]
        except Exception:
            pass
        payload = {
            "uid": uid,
            "user": user_doc.to_dict() if user_doc.exists else {},
            "payments": payment_items,
            "deletion_record": deletion_record,
            "projects": projects,
            "cloud_draft": projects[0] if projects else None,
            "editor_preferences": editor_preferences,
            "workspace_memberships": workspace_memberships,
            "notifications": notifications,
            "next_payment_cursor": page_docs[-1].id if page_docs else None,
            "has_more_payments": has_more,
            "exported_at": observability._utcnow().isoformat() + "Z",
        }
        observability._audit_action("account_export", uid, {"payment_count": len(payment_items)})
        return {"success": True, "data": payload}


    @router.post("/api/account-delete")
    def account_delete(req: AccountDataRequest):
        decoded_token = firebase_admin_setup.verify_token(req.id_token)
        if not decoded_token:
            raise HTTPException(status_code=401, detail="Auth required")
        uid = decoded_token.get("uid")
        request_security._assert_tenant_access(uid, decoded_token, req.org_id)
        db = firebase_admin_setup.get_db()
        if not db:
            raise HTTPException(status_code=503, detail="Database unavailable")
        host._assert_no_owned_workspaces(db, uid)
        db.collection("account_deletions").document(uid).set({
            "status": "pending", "requested_at": observability._utcnow().isoformat() + "Z",
        }, merge=True)
        if settings._IS_PRODUCTION:
            host.TranscriptionJobs(db).prepare_deletion(uid)
        if app_state._redis_client is not None:
            try:
                active = app_state._redis_client.get(f"procactive:{uid}") or app_state._redis_client.get(f"expactive:{uid}")
            except Exception as error:
                raise HTTPException(status_code=503, detail="Cannot verify active jobs; retry account deletion.") from error
            if active:
                raise HTTPException(status_code=409, detail="Deletion requested. Wait for active media work to finish, then retry deletion.")
        user_ref = db.collection("users").document(uid)
        user_doc = user_ref.get()
        history = []
        if user_doc.exists:
            if hasattr(user_ref, "set"):
                user_ref.set({
                    "deletion_pending": True,
                    "deletion_requested_at": observability._utcnow().isoformat() + "Z",
                }, merge=True)
            history = user_doc.to_dict().get("history", []) or []
            for item in history:
                filename = host.os.path.basename(str(item.get("filename") or ""))
                if not filename:
                    continue
                candidate = host.os.path.realpath(host.os.path.join(settings.EXPORT_DIR, filename))
                if candidate.startswith(host.os.path.realpath(settings.EXPORT_DIR) + host.os.sep) and host.os.path.isfile(candidate):
                    try:
                        host.os.remove(candidate)
                    except OSError as e:
                        observability._json_log("error", "account_delete_local_cleanup_failed", uid=uid, file=filename, error=str(e))
                        raise HTTPException(status_code=503, detail="Local export cleanup failed; deletion can be retried") from e

        cloud_cleanup = firebase_admin_setup.delete_user_exports(uid)
        source_cleanup = firebase_admin_setup.delete_user_uploads(uid)
        known_cloud_exports = any(item.get("firebase_path") for item in history if isinstance(item, dict))
        if (
            (cloud_cleanup is None and (settings._IS_PRODUCTION or known_cloud_exports))
            or (source_cleanup is None and settings._IS_PRODUCTION)
        ):
            observability._json_log("error", "account_delete_storage_cleanup_failed", uid=uid)
            raise HTTPException(status_code=503, detail="Cloud export cleanup failed; deletion can be retried")
        if user_doc.exists:
            try:
                host._cleanup_account_extensions(db, uid)
                host._delete_user_document_tree(db, user_ref)
            except Exception as e:
                observability._json_log("error", "account_delete_firestore_failed", uid=uid, error=str(e))
                raise HTTPException(status_code=500, detail="Account data cleanup failed; deletion can be retried") from e
        try:
            # Delete the login identity last. Until this succeeds the user can still
            # authenticate and retry an otherwise idempotent cleanup request.
            host.firebase_auth.delete_user(uid)
        except Exception as e:
            observability._json_log("warning", "account_delete_auth_delete_failed", uid=uid, error=str(e))
            raise HTTPException(status_code=500, detail="Account data was removed, but authentication deletion must be retried") from e
        observability._audit_action("account_delete", uid)
        return {"success": True}


    return SimpleNamespace(
        router=router,
        RedeemPromoRequest=RedeemPromoRequest,
        redeem_promo=redeem_promo,
        DeleteFileRequest=DeleteFileRequest,
        AccountDataRequest=AccountDataRequest,
        SyntheticJourneyRequest=SyntheticJourneyRequest,
        authenticated_customer_journey=authenticated_customer_journey,
        AccountExportRequest=AccountExportRequest,
        _delete_user_document_tree=_delete_user_document_tree,
        _account_workspace_memberships=_account_workspace_memberships,
        _assert_no_owned_workspaces=_assert_no_owned_workspaces,
        _delete_top_level_rows_for_account=_delete_top_level_rows_for_account,
        _cleanup_account_extensions=_cleanup_account_extensions,
        _remove_history_item_transactionally=_remove_history_item_transactionally,
        _mark_history_item_deleting_transactionally=_mark_history_item_deleting_transactionally,
        account_bootstrap=account_bootstrap,
        account_export=account_export,
        account_delete=account_delete,
    )
