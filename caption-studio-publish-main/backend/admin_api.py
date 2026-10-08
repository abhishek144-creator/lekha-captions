"""Operator routes: recovery summary, alert test, tenant backfill.

The factory accepts explicit configuration, adapters and shared state through
ServiceContext. It has no dependency on the HTTP entry point.
"""

from types import SimpleNamespace
from typing import Protocol, Any

from fastapi import HTTPException
from fastapi import APIRouter


import secrets

class ServiceContext(Protocol):
    AdminAlertTestRequest: Any
    AdminRecoveryRequest: Any
    SENTRY_AVAILABLE: Any
    SENTRY_DSN: Any
    TenantBackfillRequest: Any
    _audit_action: Any
    _build_slo_snapshot: Any
    _is_admin_token: Any
    _json_log: Any
    _read_system_ai_usage: Any
    _utcnow: Any
    firestore: Any
    get_db: Any
    sentry_sdk: Any


def create_admin_router(context: ServiceContext) -> SimpleNamespace:
    router = APIRouter()

    @router.post("/api/admin/recovery-summary")
    def admin_recovery_summary(req: context.AdminRecoveryRequest):
        if not context._is_admin_token(req.id_token):
            raise HTTPException(status_code=403, detail="Admin access required")
        db = context.get_db()
        if not db:
            raise HTTPException(status_code=503, detail="Database unavailable")
        lim = max(1, min(int(req.limit or 50), 200))
        dead_letter_rows = []
        reconcile_runs = []
        failed_queries = []
        try:
            for doc in db.collection("export_dead_letter").order_by("timestamp", direction=context.firestore.Query.DESCENDING).limit(lim).stream():
                dead_letter_rows.append(doc.to_dict())
        except Exception as e:
            failed_queries.append("export_dead_letter")
            context._json_log("error", "recovery_summary_query_failed", collection="export_dead_letter", error=str(e))
        try:
            for doc in db.collection("payment_reconcile_runs").order_by("run_at", direction=context.firestore.Query.DESCENDING).limit(lim).stream():
                reconcile_runs.append(doc.to_dict())
        except Exception as e:
            failed_queries.append("payment_reconcile_runs")
            context._json_log("error", "recovery_summary_query_failed", collection="payment_reconcile_runs", error=str(e))
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
            "slo": context._build_slo_snapshot(),
            "ai_system_usage_today": context._read_system_ai_usage(db),
        }


    @router.post("/api/admin/test-alerts")
    def admin_test_alerts(req: context.AdminAlertTestRequest):
        """Dispatch a controlled Sentry event for launch evidence."""
        if not context._is_admin_token(req.id_token):
            raise HTTPException(status_code=403, detail="Admin access required")
        test_id = f"alert-test-{context._utcnow().strftime('%Y%m%d-%H%M%S')}-{secrets.token_hex(3)}"
        sentry_event_id = ""
        if context.SENTRY_DSN and context.SENTRY_AVAILABLE:
            try:
                sentry_event_id = str(context.sentry_sdk.capture_message(
                    f"Caption Studio production alert delivery test {test_id}",
                    level="warning",
                ) or "")
                context.sentry_sdk.flush(timeout=2.0)
            except Exception as e:
                context._json_log("warning", "sentry_test_alert_failed", test_id=test_id, error=str(e))
        context._audit_action("production_alert_test_dispatched", "admin", {
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
    def admin_tenant_backfill(req: context.TenantBackfillRequest):
        if not context._is_admin_token(req.id_token):
            raise HTTPException(status_code=403, detail="Admin access required")
        db = context.get_db()
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
            now_iso = context._utcnow().isoformat() + "Z"
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
