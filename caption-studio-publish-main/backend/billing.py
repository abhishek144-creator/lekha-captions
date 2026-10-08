"""Billing ledger: top-up reservations, order binding, payment grants, refunds and reconciliation (no routes).

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


def create_billing_service(host: ModuleType) -> SimpleNamespace:
    router = APIRouter()

    def _resolve_plan_from_amount_currency(amount_minor: int, currency: str) -> host.Optional[str]:
        c = (currency or "INR").upper()
        for plan_key, p in settings.PLAN_PRICING.items():
            if p.get("is_free"):
                continue
            if c == "USD" and amount_minor == p.get("usd_cents"):
                return plan_key
            if c == "INR" and amount_minor == p.get("inr_paise"):
                return plan_key
        return None


    def _topup_timestamp_epoch(value: host.Any) -> host.Optional[float]:
        """Normalize Firestore/Python/ISO timestamps used by rolling top-up limits."""
        if value is None or isinstance(value, bool):
            return None
        if isinstance(value, (int, float)):
            return float(value)
        if isinstance(value, host.datetime):
            dt = value if value.tzinfo else value.replace(tzinfo=host.timezone.utc)
            return dt.timestamp()
        if isinstance(value, str):
            raw = value.strip()
            if not raw:
                return None
            try:
                return float(raw)
            except ValueError:
                try:
                    dt = host.datetime.fromisoformat(raw.replace("Z", "+00:00"))
                    if not dt.tzinfo:
                        dt = dt.replace(tzinfo=host.timezone.utc)
                    return dt.timestamp()
                except ValueError:
                    return None
        return None


    def _recent_topup_timestamps(user_data: host.Dict[str, host.Any], now_ts: host.Optional[float] = None) -> host.List[float]:
        now_epoch = float(now_ts if now_ts is not None else host.time.time())
        cutoff = now_epoch - settings.TOPUP_PURCHASE_WINDOW_SECONDS
        recent: host.List[float] = []
        values = user_data.get("topup_timestamps") or []
        if not isinstance(values, list):
            values = []
        for value in values:
            parsed = host._topup_timestamp_epoch(value)
            if parsed is not None and cutoff < parsed <= now_epoch + 300:
                recent.append(parsed)
        return sorted(recent)


    def _active_topup_reservations(user_data: host.Dict[str, host.Any], now_ts: host.Optional[float] = None) -> host.List[host.Dict[str, host.Any]]:
        now_epoch = float(now_ts if now_ts is not None else host.time.time())
        cutoff = now_epoch - settings.TOPUP_ORDER_RESERVATION_SECONDS
        active: host.List[host.Dict[str, host.Any]] = []
        values = user_data.get("topup_order_reservations") or []
        if not isinstance(values, list):
            values = []
        for value in values:
            if not isinstance(value, dict):
                continue
            created_at = host._topup_timestamp_epoch(value.get("created_at"))
            reservation_id = str(value.get("id") or "").strip()
            if reservation_id and created_at is not None and cutoff < created_at <= now_epoch + 300:
                active.append({
                    "id": reservation_id,
                    "plan_id": str(value.get("plan_id") or "").strip(),
                    "created_at": created_at,
                })
        return sorted(active, key=lambda item: item["created_at"])


    def _topup_purchase_limit(plan_config: host.Dict[str, host.Any]) -> int:
        try:
            return max(0, int(plan_config.get("purchase_limit_30d", 0) or 0))
        except (TypeError, ValueError):
            return 0


    def _assert_topup_purchase_available(
        user_data: host.Dict[str, host.Any],
        plan_config: host.Dict[str, host.Any],
        now_ts: host.Optional[float] = None,
    ) -> None:
        limit = host._topup_purchase_limit(plan_config)
        if limit <= 0:
            raise HTTPException(status_code=403, detail="Top-ups are not enabled for this plan.")
        used = len(host._recent_topup_timestamps(user_data, now_ts))
        reserved = len(host._active_topup_reservations(user_data, now_ts))
        if used + reserved >= limit:
            noun = "purchase" if limit == 1 else "purchases"
            raise HTTPException(
                status_code=429,
                detail=f"Top-up limit reached: your plan allows {limit} top-up {noun} per rolling 30 days.",
            )


    def _reserve_topup_order_slot(db, user_ref, plan_id: str, plan_config: host.Dict[str, host.Any]) -> str:
        """Atomically reserve a short-lived slot before creating a chargeable order."""
        reservation_id = host.secrets.token_urlsafe(18)
        now_ts = host.time.time()

        @host.firestore.transactional
        def _reserve(transaction):
            user_doc = user_ref.get(transaction=transaction)
            if not user_doc.exists:
                raise HTTPException(status_code=404, detail="User not found. Purchase a plan first.")
            user_data = user_doc.to_dict() or {}
            base_tier = host._effective_subscription_tier(user_data).replace("_yearly", "")
            if base_tier not in {"starter", "creator", "pro"}:
                raise HTTPException(status_code=403, detail="UPGRADE_REQUIRED: Top-ups available for paid plans only.")
            if plan_id != f"topup_{base_tier}":
                raise HTTPException(status_code=403, detail="This top-up is not available for your current plan.")
            host._assert_topup_purchase_available(user_data, plan_config, now_ts)
            reservations = host._active_topup_reservations(user_data, now_ts)
            reservations.append({"id": reservation_id, "plan_id": plan_id, "created_at": now_ts})
            transaction.update(user_ref, {"topup_order_reservations": reservations})
            return reservation_id

        return _reserve(db.transaction())


    def _release_topup_order_slot(db, user_ref, reservation_id: str) -> None:
        if not reservation_id:
            return

        @host.firestore.transactional
        def _release(transaction):
            user_doc = user_ref.get(transaction=transaction)
            if not user_doc.exists:
                return
            user_data = user_doc.to_dict() or {}
            reservations = [
                item for item in host._active_topup_reservations(user_data)
                if item.get("id") != reservation_id
            ]
            transaction.update(user_ref, {"topup_order_reservations": reservations})

        _release(db.transaction())


    def _fetch_bound_order_context(order_id: str, amount_minor: int, currency: str) -> host.Dict[str, host.Any]:
        """Resolve the server-authored payment owner and plan from a Razorpay order.

    The app writes uid/plan_id to *order* notes when it creates the order. Razorpay
    payment webhook entities can have empty or unrelated payment notes, so neither
    webhook recovery nor reconciliation may use payment notes as the entitlement
    authority.
    """
        order_id = str(order_id or "").strip()
        if not order_id:
            raise HTTPException(status_code=400, detail="Payment is missing its order binding.")
        if not host.RAZORPAY_AVAILABLE or app_state.rzp_client is None:
            raise HTTPException(status_code=503, detail="Payment order verification is unavailable")

        try:
            order = app_state.rzp_client.order.fetch(order_id)
        except Exception as e:
            raise HTTPException(status_code=502, detail="Unable to verify payment order with Razorpay") from e

        order_amount = int(order.get("amount", 0) or 0)
        order_currency = str(order.get("currency") or "").upper()
        if order_amount != int(amount_minor or 0) or order_currency != str(currency or "").upper():
            raise HTTPException(status_code=400, detail="Payment order amount does not match the captured payment.")

        notes = order.get("notes") or {}
        if not isinstance(notes, dict):
            notes = {}
        uid = str(notes.get("uid") or "").strip()
        plan_id = str(notes.get("plan_id") or "").strip()
        org_id = str(notes.get("org_id") or "").strip()
        topup_reservation_id = str(notes.get("topup_reservation_id") or "").strip()
        if not uid:
            raise HTTPException(status_code=400, detail="Payment order is missing its user binding.")
        if not plan_id or plan_id not in settings.PLAN_PRICING:
            raise HTTPException(status_code=400, detail="Payment order is missing a valid plan binding.")

        # The order amount is authoritative for a server-created order. Do not
        # compare it with today's catalog price: legitimate orders can remain
        # payable/reconcilable after a later price change. New orders still use the
        # current catalog price in create_order, while historical captures retain
        # the price they were created with.

        return {
            "uid": uid,
            "plan_id": plan_id,
            "org_id": org_id,
            "topup_reservation_id": topup_reservation_id,
            "order_created_at": int(order.get("created_at") or 0),
        }


    def _can_trigger_reconcile(request: Request, req_body: host.ReconcilePaymentsRequest) -> bool:
        secret_header = (request.headers.get("x-reconcile-secret") or "").strip()
        if settings.PAYMENT_RECONCILE_SECRET and secret_header and host.hmac.compare_digest(secret_header, settings.PAYMENT_RECONCILE_SECRET):
            return True

        if not req_body.id_token:
            return False
        decoded = firebase_admin_setup.verify_token(req_body.id_token)
        if not decoded:
            return False

        return host._decoded_token_is_admin(decoded)


    def reconcile_payments_once(
        reason: str = "manual",
        lookback_hours: int = settings.PAYMENT_RECONCILE_LOOKBACK_HOURS,
        limit: int = settings.PAYMENT_RECONCILE_BATCH_SIZE,
    ) -> host.Dict[str, host.Any]:
        db = firebase_admin_setup.get_db()
        if not db:
            return {"success": False, "error": "Database unavailable"}

        lookback = max(int(lookback_hours or 1), 1)
        query_limit = max(1, min(int(limit or settings.PAYMENT_RECONCILE_BATCH_SIZE), 1000))
        cutoff = observability._utcnow() - host.timedelta(hours=lookback)
        cutoff_iso = cutoff.isoformat() + "Z"
        summary = {
            "success": True,
            "reason": reason,
            "lookback_hours": lookback,
            "limit": query_limit,
            "cutoff_utc": cutoff_iso,
            "scanned": 0,
            "applied": 0,
            "duplicates": 0,
            "skipped": 0,
            "errors": 0,
        }

        try:
            docs = (
                db.collection("payment_webhooks")
                .where(filter=host.firestore.FieldFilter("event", "==", "payment.captured"))
                .where(filter=host.firestore.FieldFilter("status", "==", "captured"))
                .where(filter=host.firestore.FieldFilter("reconcile_required", "==", True))
                .where(filter=host.firestore.FieldFilter("received_at", ">=", cutoff_iso))
                .order_by("received_at", direction=host.firestore.Query.ASCENDING)
                .limit(query_limit)
                .stream()
            )
        except Exception as e:
            observability._json_log("error", "payment_reconcile_query_failed", error=str(e))
            return {"success": False, "error": "Failed to query payment webhooks"}

        for doc in docs:
            row = doc.to_dict() or {}
            summary["scanned"] += 1
            payment_id = (row.get("payment_id") or "").strip()
            order_id = (row.get("order_id") or "").strip()
            amount_minor = int(row.get("amount", 0) or 0)
            currency = (row.get("currency") or "INR").upper()

            try:
                order_context = host._fetch_bound_order_context(order_id, amount_minor, currency)
            except HTTPException as e:
                summary["errors"] += 1
                observability._json_log(
                    "warning",
                    "payment_reconcile_order_resolution_failed",
                    webhook_doc=doc.id,
                    payment_id=payment_id,
                    order_id=order_id,
                    status_code=e.status_code,
                    detail=e.detail,
                )
                continue
            uid = order_context["uid"]
            plan_id = order_context["plan_id"]
            org_id = order_context["org_id"]
            topup_reservation_id = order_context["topup_reservation_id"]
            try:
                doc.reference.update({"notes": order_context})
            except Exception as e:
                observability._json_log("warning", "payment_reconcile_context_persist_failed", webhook_doc=doc.id, error=str(e))
            if not payment_id:
                payment_id = f"reconcile_{doc.id}"

            try:
                result = host._apply_successful_payment(
                    uid=uid,
                    plan_id=plan_id,
                    payment_id=payment_id,
                    order_id=order_id,
                    amount_minor=amount_minor,
                    currency=currency,
                    source=f"reconcile:{reason}",
                    org_id=org_id,
                    topup_reservation_id=topup_reservation_id,
                    order_amount_validated=True,
                    order_created_at=int(order_context.get("order_created_at") or 0),
                )
                if result.get("duplicate"):
                    summary["duplicates"] += 1
                else:
                    summary["applied"] += 1
                doc.reference.update({
                    "reconcile_required": False,
                    "reconciled_at": observability._utcnow().isoformat() + "Z",
                })
            except HTTPException as e:
                summary["errors"] += 1
                observability._json_log(
                    "warning",
                    "payment_reconcile_apply_failed",
                    payment_id=payment_id,
                    uid=uid,
                    status_code=e.status_code,
                    detail=e.detail,
                )
            except Exception as e:
                summary["errors"] += 1
                observability._json_log("error", "payment_reconcile_apply_exception", payment_id=payment_id, uid=uid, error=str(e))

        summary["run_at"] = observability._utcnow().isoformat() + "Z"
        observability._json_log("info", "payment_reconcile_summary", **summary)
        try:
            db.collection("payment_reconcile_runs").add({
                **summary,
                "expire_at": observability._retention_deadline(90),
            })
        except Exception as e:
            observability._json_log("warning", "payment_reconcile_persist_failed", error=str(e))
        if summary["errors"] >= settings.RECONCILE_ERROR_ALERT_THRESHOLD or summary["skipped"] >= settings.RECONCILE_SKIPPED_ALERT_THRESHOLD:
            observability._send_alert(
                f"[Caption Studio Alert] reconcile summary: errors={summary['errors']} skipped={summary['skipped']} "
                f"applied={summary['applied']} reason={reason}"
            )
        return summary


    async def payment_reconciliation_job():
        try:
            await host.asyncio.to_thread(host.reconcile_payments_once, reason="scheduled")
        except Exception as e:
            observability._json_log("error", "payment_reconcile_job_failed", error=str(e))


    def _grant_payment_transactionally(
        db,
        user_ref,
        payment_ref,
        uid: str,
        plan_id: str,
        plan_config: host.Dict[str, host.Any],
        payment_id: str,
        order_id: str,
        amount_minor: int,
        currency: str,
        source: str,
        org_id: str,
        topup_reservation_id: str = "",
        order_created_at: int = 0,
    ):
        now_utc = observability._utcnow()
        cycle_start = now_utc.isoformat() + "Z"
        is_topup = bool(plan_config.get("is_topup", False))
        credits_to_add = int(plan_config["credits"])
        cycle_end = None if is_topup else (
            now_utc + host.timedelta(days=int(plan_config["days"]))
        ).isoformat() + "Z"

        @host.firestore.transactional
        def _grant(transaction):
            if settings._IS_PRODUCTION:
                deletion_ref = db.collection("account_deletions").document(uid)
                if deletion_ref.get(transaction=transaction).exists:
                    raise HTTPException(status_code=409, detail="Deleted account payment requires support reconciliation.")
            payment_doc = payment_ref.get(transaction=transaction)
            if payment_doc.exists:
                existing = payment_doc.to_dict() or {}
                return {"success": True, "duplicate": True, "type": existing.get("type", "unknown")}

            user_doc = user_ref.get(transaction=transaction)
            user_data = user_doc.to_dict() if user_doc.exists else {}
            payment_type = "topup" if is_topup else "subscription"
            if user_data.get("deletion_pending"):
                raise HTTPException(status_code=409, detail="Account deletion is pending; payment needs reconciliation.")
            latest_order = int(user_data.get("last_subscription_order_created_at") or 0)
            if not is_topup and latest_order and (not order_created_at or order_created_at < latest_order):
                # Preserve the newer purchased plan. Keep the capture in the provider
                # and webhook reconciliation ledger for operator resolution/refund.
                raise HTTPException(status_code=409, detail="An older payment requires support reconciliation; the current plan was preserved.")

            if is_topup:
                if not user_doc.exists:
                    raise HTTPException(status_code=404, detail="User not found. Purchase a plan first.")
                base_tier = host._effective_subscription_tier(user_data).replace("_yearly", "")
                if base_tier not in {"starter", "creator", "pro"}:
                    raise HTTPException(status_code=403, detail="UPGRADE_REQUIRED: Top-ups available for paid plans only.")
                if plan_id != f"topup_{base_tier}":
                    raise HTTPException(status_code=403, detail="This top-up is not available for your current plan.")
                recent_topups = host._recent_topup_timestamps(user_data, now_utc.replace(tzinfo=host.timezone.utc).timestamp())
                active_reservations = host._active_topup_reservations(
                    user_data,
                    now_utc.replace(tzinfo=host.timezone.utc).timestamp(),
                )
                matching_reservation = next(
                    (
                        item for item in active_reservations
                        if item.get("id") == topup_reservation_id and item.get("plan_id") == plan_id
                    ),
                    None,
                )
                limit = host._topup_purchase_limit(plan_config)
                if limit <= 0 or len(recent_topups) >= limit:
                    noun = "purchase" if limit == 1 else "purchases"
                    raise HTTPException(
                        status_code=429,
                        detail=f"Top-up limit reached: your plan allows {limit} top-up {noun} per rolling 30 days.",
                    )
                # Orders created after rolling limits were introduced carry a
                # reservation token. Token-less orders are still accepted below the
                # cap so captured orders created during deployment can be recovered.
                if topup_reservation_id and matching_reservation is None:
                    raise HTTPException(status_code=409, detail="This top-up order reservation has expired or is invalid.")

            transaction.create(payment_ref, {
                "payment_id": payment_id,
                "order_id": order_id,
                "amount": amount_minor,
                "currency": (currency or "INR").upper(),
                "status": "captured",
                "plan": plan_id,
                "credits_added": credits_to_add,
                "type": payment_type,
                "timestamp": cycle_start,
                "entitlement_cycle_start": (
                    str(user_data.get("billing_cycle_start") or "") if is_topup else cycle_start
                ),
                "source": source,
                **({"topup_reservation_id": topup_reservation_id} if topup_reservation_id else {}),
                **({"org_id": org_id} if org_id else {}),
            })

            if is_topup:
                topup_timestamp = now_utc.replace(tzinfo=host.timezone.utc).timestamp()
                remaining_reservations = [
                    item for item in active_reservations
                    if item.get("id") != topup_reservation_id
                ]
                transaction.update(user_ref, {
                    "credits_remaining": host.firestore.Increment(credits_to_add),
                    "topup_timestamps": [*recent_topups, topup_timestamp],
                    "topup_order_reservations": remaining_reservations,
                    "topups_this_cycle": len(recent_topups) + 1,
                    **({"org_id": org_id} if org_id else {}),
                })
                return {"success": True, "credits_added": credits_to_add, "type": "topup"}

            user_update = {
                # A plan purchase starts a new fixed entitlement period. Published
                # terms say unused credits do not carry over, so the selected plan's
                # allowance replaces any free/expired/previous-plan balance.
                "credits_remaining": credits_to_add,
                "subscription_tier": plan_id,
                "last_subscription_order_created_at": int(order_created_at or 0),
                "billing_cycle_start": cycle_start,
                "billing_cycle_end": cycle_end,
                "subscription_expiry": cycle_end,
                "topups_this_cycle": 0,
                **({"org_id": org_id} if org_id else {}),
            }
            if user_doc.exists:
                transaction.update(user_ref, user_update)
            else:
                transaction.set(user_ref, {"uid": uid, "created_at": host.time.time(), **user_update})
            return {
                "success": True,
                "credits_added": credits_to_add,
                "billing_cycle_end": cycle_end,
                "type": "subscription",
            }

        return _grant(db.transaction())


    def _apply_successful_payment(
        uid: str,
        plan_id: str,
        payment_id: str,
        order_id: str,
        amount_minor: int,
        currency: str,
        source: str = "client_verify",
        org_id: str = "",
        topup_reservation_id: str = "",
        order_amount_validated: bool = False,
        order_created_at: int = 0,
    ):
        plan_config = settings.PLAN_PRICING.get(plan_id)
        if not plan_config:
            raise HTTPException(status_code=400, detail=f"Unknown plan: {plan_id}")
        if plan_config.get("is_free"):
            raise HTTPException(status_code=400, detail="The free plan cannot be granted through payments.")

        # SECURITY: bind the granted plan to the amount actually paid. Without this a
        # client could pay for a cheap plan, then echo an expensive plan_id at
        # verify-time and receive the higher tier / more credits. The signature check
        # only proves the payment matches its order — it does not bind the plan.
        expected_minor = plan_config.get('usd_cents') if (currency or '').upper() == 'USD' else plan_config.get('inr_paise')
        # For a server-validated Razorpay order, the order amount is authoritative
        # even when the catalog price has since changed. New orders are still priced
        # from the current catalog in create_order; this preserves older captures
        # during delayed verification/reconciliation without weakening the binding
        # between the payment, server-created order, owner, and plan.
        if not order_amount_validated and (expected_minor is None or int(amount_minor or 0) != int(expected_minor)):
            observability._json_log(
                "warning",
                "payment_amount_plan_mismatch",
                uid=uid,
                plan_id=plan_id,
                currency=currency,
                amount_minor=int(amount_minor or 0),
                expected_minor=expected_minor,
                source=source,
            )
            raise HTTPException(status_code=400, detail="Payment amount does not match the selected plan.")

        db = firebase_admin_setup.get_db()
        if not db:
            raise HTTPException(status_code=500, detail="Database not initialized")

        user_ref = db.collection('users').document(uid)
        payment_ref = user_ref.collection('payments').document(payment_id)
        result = host._grant_payment_transactionally(
            db, user_ref, payment_ref, uid, plan_id, plan_config, payment_id,
            order_id, amount_minor, currency, source, org_id, topup_reservation_id, order_created_at,
        )
        if not result.get("duplicate"):
            observability._track_event("payment_success", {
                "plan_id": plan_id,
                "currency": (currency or "INR").upper(),
                "amount_minor": int(amount_minor or 0),
                "payment_id": payment_id,
            })
        return result


    def _apply_refund_webhook_event(
        db,
        event: str,
        refund_entity: host.Dict[str, host.Any],
        payment_entity: host.Dict[str, host.Any],
    ) -> host.Dict[str, host.Any]:
        refund_id = str(refund_entity.get("id") or "").strip()
        payment_id = str(refund_entity.get("payment_id") or payment_entity.get("id") or "").strip()
        if not refund_id or not payment_id:
            return {"success": True, "ignored": True, "reason": "missing_refund_or_payment_id"}

        notes = payment_entity.get("notes") or {}
        if not isinstance(notes, dict):
            notes = {}
        uid = str(notes.get("uid") or "").strip()
        if not uid:
            return {"success": True, "ignored": True, "reason": "missing_uid_note"}

        event_status = event.rsplit(".", 1)[-1].lower()
        reported_status = str(refund_entity.get("status") or event_status or "pending").lower()
        if event == "refund.processed":
            reported_status = "processed"
        elif event == "refund.failed":
            reported_status = "failed"
        elif reported_status not in {"pending", "processed", "failed"}:
            reported_status = "pending"

        amount_minor = max(0, int(refund_entity.get("amount", 0) or 0))
        currency = str(refund_entity.get("currency") or payment_entity.get("currency") or "INR").upper()
        user_ref = db.collection("users").document(uid)
        payment_ref = user_ref.collection("payments").document(payment_id)
        refund_ref = payment_ref.collection("refunds").document(refund_id)

        @host.firestore.transactional
        def _record(transaction):
            payment_doc = payment_ref.get(transaction=transaction)
            if not payment_doc.exists:
                raise HTTPException(status_code=503, detail="Payment record is pending reconciliation; retry the refund event.")

            refund_doc = refund_ref.get(transaction=transaction)
            previous = refund_doc.to_dict() if refund_doc.exists else {}
            previous_status = str((previous or {}).get("status") or "").lower()
            status_rank = {"": 0, "pending": 1, "failed": 2, "processed": 3}
            effective_status = reported_status
            if status_rank.get(previous_status, 0) > status_rank.get(reported_status, 0):
                effective_status = previous_status

            previous_amount = max(0, int((previous or {}).get("amount", amount_minor) or 0))
            effective_amount = amount_minor or previous_amount
            old_counted = previous_amount if previous_status == "processed" else 0
            new_counted = effective_amount if effective_status == "processed" else 0

            payment_data = payment_doc.to_dict() or {}
            current_refunded = max(0, int(payment_data.get("refunded_amount", 0) or 0))
            refunded_amount = max(0, current_refunded - old_counted + new_counted)
            paid_amount = max(0, int(payment_data.get("amount", 0) or 0))
            if refunded_amount > 0:
                aggregate_status = "refunded" if paid_amount and refunded_amount >= paid_amount else "partially_refunded"
            elif effective_status == "failed":
                aggregate_status = "refund_failed"
            else:
                aggregate_status = "refund_pending"

            updated_at = observability._utcnow().isoformat() + "Z"
            credits_added = max(0, int(payment_data.get("credits_added", 0) or 0))
            previous_reversal_target = max(
                0, int(payment_data.get("entitlement_reversal_target", 0) or 0)
            )
            previous_credits_removed = max(
                0, int(payment_data.get("entitlement_credits_removed", 0) or 0)
            )
            reversal_target = previous_reversal_target
            credits_removed_now = 0
            adjustment_required = bool(payment_data.get("entitlement_adjustment_required", False))
            adjustment_reason = str(payment_data.get("entitlement_adjustment_reason") or "")

            if effective_status == "processed" and paid_amount > 0 and credits_added > 0:
                reversal_target = min(
                    credits_added,
                    int(host.math.ceil(credits_added * min(refunded_amount, paid_amount) / paid_amount)),
                )
                additional_target = max(0, reversal_target - previous_reversal_target)
                if additional_target > 0:
                    user_doc = user_ref.get(transaction=transaction)
                    user_data = user_doc.to_dict() if user_doc.exists else {}
                    payment_type = str(payment_data.get("type") or "subscription")
                    payment_plan = str(payment_data.get("plan") or "")
                    payment_cycle = str(
                        payment_data.get("entitlement_cycle_start")
                        or (payment_data.get("timestamp") if payment_type == "subscription" else "")
                        or ""
                    )
                    current_cycle = str((user_data or {}).get("billing_cycle_start") or "")
                    same_cycle = bool(payment_cycle and current_cycle and payment_cycle == current_cycle)
                    same_subscription = str((user_data or {}).get("subscription_tier") or "") == payment_plan
                    current_credits = max(0, int((user_data or {}).get("credits_remaining", 0) or 0))
                    full_refund = refunded_amount >= paid_amount

                    if not user_doc.exists:
                        adjustment_required = True
                        adjustment_reason = "user_record_not_found"
                    elif payment_type == "subscription" and same_cycle and same_subscription and full_refund:
                        # A full refund cancels the active fixed-period purchase. Top-up
                        # credits expire with that plan, so the complete active balance is
                        # removed and the account returns to the free tier.
                        credits_removed_now = current_credits
                        transaction.update(user_ref, {
                            "credits_remaining": 0,
                            "subscription_tier": "free",
                            "subscription_expiry": updated_at,
                            "billing_cycle_end": updated_at,
                            "topups_this_cycle": 0,
                        })
                        adjustment_required = False
                        adjustment_reason = ""
                    elif same_cycle and (payment_type == "topup" or same_subscription):
                        credits_removed_now = min(current_credits, additional_target)
                        if credits_removed_now:
                            transaction.update(user_ref, {
                                "credits_remaining": current_credits - credits_removed_now,
                            })
                        adjustment_required = credits_removed_now < additional_target
                        adjustment_reason = "insufficient_unspent_credits" if adjustment_required else ""
                    else:
                        # Never remove credits from a newer purchase. Flag the old refund
                        # for an operator instead of corrupting the current entitlement.
                        adjustment_required = True
                        adjustment_reason = "payment_is_not_the_active_entitlement_cycle"

            transaction.set(refund_ref, {
                "refund_id": refund_id,
                "payment_id": payment_id,
                "amount": effective_amount,
                "currency": currency,
                "status": effective_status,
                "event": event,
                "updated_at": updated_at,
                "created_at": (previous or {}).get("created_at") or updated_at,
            }, merge=True)
            transaction.update(payment_ref, {
                "refund_status": aggregate_status,
                "refunded_amount": refunded_amount,
                "last_refund_id": refund_id,
                "last_refund_event": event,
                "refund_updated_at": updated_at,
                "entitlement_reversal_target": reversal_target,
                "entitlement_credits_removed": previous_credits_removed + credits_removed_now,
                "entitlement_adjustment_required": adjustment_required,
                "entitlement_adjustment_reason": adjustment_reason,
            })
            return {
                "success": True,
                "applied": True,
                "refund_id": refund_id,
                "payment_id": payment_id,
                "refund_status": aggregate_status,
                "refunded_amount": refunded_amount,
                "entitlement_credits_removed": previous_credits_removed + credits_removed_now,
                "entitlement_adjustment_required": adjustment_required,
                "idempotent_replay": bool(previous) and old_counted == new_counted and previous_status == effective_status,
            }

        result = _record(db.transaction())
        if result.get("applied"):
            observability._track_event("payment_refund_updated", {
                "event": event,
                "refund_status": result.get("refund_status"),
                "payment_id": payment_id,
            })
            observability._audit_action("payment_refund_updated", uid, {
                "event": event,
                "refund_id": refund_id,
                "payment_id": payment_id,
                "refund_status": result.get("refund_status"),
            })
            if result.get("entitlement_adjustment_required"):
                observability._json_log(
                    "error",
                    "refund_entitlement_adjustment_required",
                    uid=uid,
                    payment_id=payment_id,
                    refund_id=refund_id,
                    refund_status=result.get("refund_status"),
                )
                observability._send_alert(
                    "[Caption Studio Alert] Manual refund entitlement adjustment required: "
                    f"uid={uid} payment_id={payment_id} refund_id={refund_id}"
                )
        return result


    return SimpleNamespace(
        router=router,
        _resolve_plan_from_amount_currency=_resolve_plan_from_amount_currency,
        _topup_timestamp_epoch=_topup_timestamp_epoch,
        _recent_topup_timestamps=_recent_topup_timestamps,
        _active_topup_reservations=_active_topup_reservations,
        _topup_purchase_limit=_topup_purchase_limit,
        _assert_topup_purchase_available=_assert_topup_purchase_available,
        _reserve_topup_order_slot=_reserve_topup_order_slot,
        _release_topup_order_slot=_release_topup_order_slot,
        _fetch_bound_order_context=_fetch_bound_order_context,
        _can_trigger_reconcile=_can_trigger_reconcile,
        reconcile_payments_once=reconcile_payments_once,
        payment_reconciliation_job=payment_reconciliation_job,
        _grant_payment_transactionally=_grant_payment_transactionally,
        _apply_successful_payment=_apply_successful_payment,
        _apply_refund_webhook_event=_apply_refund_webhook_event,
    )
