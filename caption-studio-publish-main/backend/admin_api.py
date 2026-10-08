"""Operator routes: recovery summary, alert test, tenant backfill.

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
    from . import firebase_admin_setup
except ImportError:  # Direct execution from backend/ remains supported.
    import firebase_admin_setup
try:
    from . import observability
except ImportError:  # Direct execution from backend/ remains supported.
    import observability


def create_admin_router(host: ModuleType) -> SimpleNamespace:
    router = APIRouter()

    @router.post("/api/admin/recovery-summary")
    def admin_recovery_summary(req: host.AdminRecoveryRequest):
        if not host._is_admin_token(req.id_token):
            raise HTTPException(status_code=403, detail="Admin access required")
        db = firebase_admin_setup.get_db()
        if not db:
            raise HTTPException(status_code=503, detail="Database unavailable")
        lim = max(1, min(int(req.limit or 50), 200))
        dead_letter_rows = []
        reconcile_runs = []
        failed_queries = []
        try:
            for doc in db.collection("export_dead_letter").order_by("timestamp", direction=host.firestore.Query.DESCENDING).limit(lim).stream():
                dead_letter_rows.append(doc.to_dict())
        except Exception as e:
            failed_queries.append("export_dead_letter")
            observability._json_log("error", "recovery_summary_query_failed", collection="export_dead_letter", error=str(e))
        try:
            for doc in db.collection("payment_reconcile_runs").order_by("run_at", direction=host.firestore.Query.DESCENDING).limit(lim).stream():
                reconcile_runs.append(doc.to_dict())
        except Exception as e:
            failed_queries.append("payment_reconcile_runs")
            observability._json_log("error", "recovery_summary_query_failed", collection="payment_reconcile_runs", error=str(e))
        if failed_queries:
            raise HTTPException(
                status_code=503,
                detail={
                    "message": "Recovery summary is incomplete",
                    "failed_queries": failed_queries,
                    "partial": {
                        "dead_letter_recent": dead_letter_rows,
                        "payment_reconcile_recent": reconcile_runs,
                    },
                },
            )
        return {
            "success": True,
            "dead_letter_recent": dead_letter_rows,
            "payment_reconcile_recent": reconcile_runs,
            "slo": observability._build_slo_snapshot(),
            "ai_system_usage_today": host._read_system_ai_usage(db),
        }


    @router.post("/api/admin/test-alerts")
    def admin_test_alerts(req: host.AdminAlertTestRequest):
        """Dispatch a controlled Sentry event for launch evidence."""
        if not host._is_admin_token(req.id_token):
            raise HTTPException(status_code=403, detail="Admin access required")
        test_id = f"alert-test-{observability._utcnow().strftime('%Y%m%d-%H%M%S')}-{host.secrets.token_hex(3)}"
        sentry_event_id = ""
        if settings.SENTRY_DSN and host.SENTRY_AVAILABLE:
            try:
                sentry_event_id = str(host.sentry_sdk.capture_message(
                    f"Caption Studio production alert delivery test {test_id}",
                    level="warning",
                ) or "")
                host.sentry_sdk.flush(timeout=2.0)
            except Exception as e:
                observability._json_log("warning", "sentry_test_alert_failed", test_id=test_id, error=str(e))
        observability._audit_action("production_alert_test_dispatched", "admin", {
            "test_id": test_id,
            "sentry_dispatched": bool(sentry_event_id),
        })
        if not sentry_event_id:
            raise HTTPException(
                status_code=503,
                detail={
                    "message": "Sentry alert could not be dispatched.",
                    "test_id": test_id,
                    "sentry_dispatched": bool(sentry_event_id),
                },
            )
        return {
            "success": True,
            "test_id": test_id,
            "sentry_dispatched": True,
            "sentry_event_id": sentry_event_id,
            "delivery_confirmation_required": True,
        }


    @router.post("/api/admin/tenant-backfill")
    def admin_tenant_backfill(req: host.TenantBackfillRequest):
        if not host._is_admin_token(req.id_token):
            raise HTTPException(status_code=403, detail="Admin access required")
        db = firebase_admin_setup.get_db()
        if not db:
            raise HTTPException(status_code=503, detail="Database unavailable")
        lim = max(1, min(int(req.limit or 500), 500))
        users_ref = db.collection("users")
        query = users_ref.order_by("__name__")
        if req.cursor:
            cursor_doc = users_ref.document(req.cursor).get()
            if not cursor_doc.exists:
                raise HTTPException(status_code=400, detail="Invalid tenant backfill cursor")
            query = query.start_after(cursor_doc)
        docs = list(query.limit(lim + 1).stream())
        has_more = len(docs) > lim
        docs = docs[:lim]

        scanned = 0
        updated = 0
        writes = 0
        batch = db.batch()
        touched_tenants = set()

        def queue_set(ref, data):
            nonlocal batch, writes
            if writes >= 400:
                batch.commit()
                batch = db.batch()
                writes = 0
            batch.set(ref, data, merge=True)
            writes += 1

        for doc in docs:
            scanned += 1
            data = doc.to_dict() or {}
            uid = data.get("uid") or doc.id
            org_id = (data.get("org_id") or "").strip()
            now_iso = observability._utcnow().isoformat() + "Z"
            if not org_id:
                org_id = f"org_{uid}"
                queue_set(doc.reference, {"org_id": org_id, "updated_at": now_iso})
                updated += 1
            tenant_ref = db.collection("tenants").document(org_id)
            if org_id not in touched_tenants:
                queue_set(tenant_ref, {"updated_at": now_iso})
                touched_tenants.add(org_id)
            queue_set(
                tenant_ref.collection("members").document(uid),
                {"uid": uid, "org_id": org_id, "updated_at": now_iso},
            )
        if writes:
            batch.commit()
        return {
            "success": True,
            "scanned": scanned,
            "updated_users": updated,
            "next_cursor": docs[-1].id if docs else None,
            "has_more": has_more,
        }


    return SimpleNamespace(
        router=router,
        admin_recovery_summary=admin_recovery_summary,
        admin_test_alerts=admin_test_alerts,
        admin_tenant_backfill=admin_tenant_backfill,
    )
