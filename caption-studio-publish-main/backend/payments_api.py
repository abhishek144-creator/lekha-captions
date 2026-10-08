"""Razorpay payment routes: order creation, client verification, webhooks, reconciliation.

Handlers resolve shared helpers through ``host`` (the main module) at call time so
entitlement logic stays in one place and test patches on ``main`` keep applying.
"""

import asyncio
import hashlib
import hmac
import json
import secrets
import time
import uuid
from types import ModuleType, SimpleNamespace

from fastapi import APIRouter, HTTPException, Request, Response

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
    from . import api_models
except ImportError:  # Direct execution from backend/ remains supported.
    import api_models


def create_payments_router(host: ModuleType) -> SimpleNamespace:
    router = APIRouter()
    CreateOrderRequest = api_models.CreateOrderRequest
    VerifyPaymentRequest = api_models.VerifyPaymentRequest
    ReconcilePaymentsRequest = api_models.ReconcilePaymentsRequest

    @router.post("/api/create-order")
    def create_order(req: CreateOrderRequest, request: Request, response: Response):
        if req.require_test_mode and not settings.RAZORPAY_KEY_ID.startswith("rzp_test_"):
            raise HTTPException(409, "Payment test refused: test-mode credentials required")
        # Verify User
        decoded_token = firebase_admin_setup.verify_token(req.id_token)
        if not decoded_token:
            raise HTTPException(status_code=401, detail="Invalid Authentication Token")
        uid = decoded_token.get("uid", "")
        request_security._assert_tenant_access(uid, decoded_token, req.org_id)
        # Check the durable operator switch before contacting Razorpay. This makes
        # emergency payment shutdown immediate and guarantees no order is created.
        operator_controls._assert_service_available("pause_payments")
        client_ip = host._client_rate_key(request)
        for rate_key in (f"payment:user:{uid}", f"payment:ip:{client_ip}"):
            allowed, retry_after, remaining = host._check_rate(app_state._payment_rate, rate_key, settings.PAYMENT_RATE_LIMIT)
            host._apply_rate_headers(response, settings.PAYMENT_RATE_LIMIT, remaining, retry_after)
            if not allowed:
                raise HTTPException(status_code=429, detail="Too many payment requests. Please wait before trying again.")
        pay_idem_key = host._require_payment_idempotency(uid, req.idempotency_key or request.headers.get("x-idempotency-key", ""), "create_order")
        cached_payment = host._payment_idem_get(pay_idem_key)
        if cached_payment and cached_payment.get("status") == "completed":
            return {**cached_payment["payload"], "idempotent_replay": True}
        observability._audit_action("create_order_attempt", uid, {"plan_id": req.plan_id, "currency": req.currency})

        plan = settings.PLAN_PRICING.get(req.plan_id)
        if not plan:
            raise HTTPException(status_code=400, detail=f"Unknown plan: {req.plan_id}")
        if plan.get("is_free"):
            raise HTTPException(status_code=400, detail="The free plan is granted at signup and cannot be purchased.")

        topup_db = None
        topup_user_ref = None
        topup_reservation_id = ""
        # Top-up: validate caller's current tier before creating order
        if plan.get('is_topup'):
            topup_db = firebase_admin_setup.get_db()
            if not topup_db:
                raise HTTPException(status_code=503, detail="Account service unavailable; top-up order was not created")
            uid_tmp = decoded_token.get('uid')
            topup_user_ref = topup_db.collection('users').document(uid_tmp)
            ud = topup_user_ref.get()
            user_data_tmp = ud.to_dict() or {} if ud.exists else {}
            user_tier_tmp = entitlements._effective_subscription_tier(user_data_tmp) if ud.exists else 'free'
            # Strip _yearly suffix for comparison
            base_tier = user_tier_tmp.replace('_yearly', '')
            if base_tier not in ['starter', 'creator', 'pro']:
                raise HTTPException(status_code=403, detail="UPGRADE_REQUIRED: Top-ups available for paid plans only.")
            expected = f"topup_{base_tier}"
            if req.plan_id != expected:
                raise HTTPException(status_code=403, detail="This top-up is not available for your current plan.")
            host._assert_topup_purchase_available(user_data_tmp, plan)
        if not host._payment_idem_claim(pay_idem_key):
            concurrent = host._payment_idem_get(pay_idem_key)
            if concurrent and concurrent.get("status") == "completed":
                return {**concurrent["payload"], "idempotent_replay": True}
            raise HTTPException(status_code=409, detail="A payment order with this idempotency key is already in progress.")

        if plan.get('is_topup'):
            try:
                topup_reservation_id = host._reserve_topup_order_slot(
                    topup_db,
                    topup_user_ref,
                    req.plan_id,
                    plan,
                )
            except Exception:
                host._payment_idem_delete(pay_idem_key)
                raise

        currency = req.currency.upper() if req.currency else "INR"
        # Top-ups are INR only; USD only applies to subscription plans
        if plan.get('is_topup') or currency != "USD":
            amount = plan['inr_paise']
            currency = "INR"
        else:
            amount = plan.get('usd_cents', plan['inr_paise'])

        if not host.RAZORPAY_AVAILABLE or app_state.rzp_client is None:
            if topup_db is not None and topup_user_ref is not None:
                host._release_topup_order_slot(topup_db, topup_user_ref, topup_reservation_id)
            host._payment_idem_delete(pay_idem_key)
            detail = "Payment service unavailable"
            if settings._IS_DEVELOPMENT and (not settings.RAZORPAY_KEY_ID or not settings.RAZORPAY_KEY_SECRET):
                detail = "Payment service is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET, then restart the backend."
            raise HTTPException(status_code=503, detail=detail)

        try:
            order_data = {
                "amount": amount,
                "currency": currency,
                "receipt": f"rcpt_{uid[:8]}_{secrets.token_hex(12)}",
                "notes": {
                    "uid": uid,
                    "plan_id": req.plan_id,
                    "org_id": req.org_id or request_security._tenant_id_from_token(decoded_token),
                    "source": "create_order",
                    **({"topup_reservation_id": topup_reservation_id} if topup_reservation_id else {}),
                }
            }
            order = app_state.rzp_client.order.create(data=order_data)
        except Exception as e:
            if topup_db is not None and topup_user_ref is not None:
                try:
                    host._release_topup_order_slot(topup_db, topup_user_ref, topup_reservation_id)
                except Exception as release_error:
                    observability._json_log(
                        "warning",
                        "topup_reservation_release_failed",
                        uid=uid,
                        reservation_id=topup_reservation_id,
                        error=str(release_error),
                    )
            host._payment_idem_delete(pay_idem_key)
            observability._json_log("error", "razorpay_order_create_failed", uid=uid, plan_id=req.plan_id, error=str(e))
            raise HTTPException(status_code=502, detail="Payment order could not be created. Please try again.") from e

        payload = {"success": True, "order": order, "plan_id": req.plan_id, "key_id": settings.RAZORPAY_KEY_ID}
        host._payment_idem_set(pay_idem_key, {"status": "completed", "ts": time.time(), "payload": payload})
        return payload

    @router.post("/api/verify-payment")
    def verify_payment(req: VerifyPaymentRequest, request: Request, response: Response):
        if not host.RAZORPAY_AVAILABLE or app_state.rzp_client is None:
            raise HTTPException(status_code=503, detail="Payment service unavailable")

        # Verify User
        decoded_token = firebase_admin_setup.verify_token(req.id_token)
        if not decoded_token:
            raise HTTPException(status_code=401, detail="Invalid Authentication Token")
        uid = decoded_token.get('uid')
        request_security._assert_tenant_access(uid, decoded_token, req.org_id)
        client_ip = host._client_rate_key(request)
        for rate_key in (f"payment:user:{uid}", f"payment:ip:{client_ip}"):
            allowed, retry_after, remaining = host._check_rate(app_state._payment_rate, rate_key, settings.PAYMENT_RATE_LIMIT)
            host._apply_rate_headers(response, settings.PAYMENT_RATE_LIMIT, remaining, retry_after)
            if not allowed:
                raise HTTPException(status_code=429, detail="Too many payment requests. Please wait before trying again.")
        pay_idem_key = host._require_payment_idempotency(uid, req.idempotency_key or request.headers.get("x-idempotency-key", ""), "verify_payment")
        cached_payment = host._payment_idem_get(pay_idem_key)
        if cached_payment and cached_payment.get("status") == "completed":
            return {**cached_payment["payload"], "idempotent_replay": True}
        observability._audit_action("verify_payment_attempt", uid, {"plan_id": req.plan_id, "order_id": req.razorpay_order_id})

        # Verify Signature
        try:
            params_dict = {
                'razorpay_order_id': req.razorpay_order_id,
                'razorpay_payment_id': req.razorpay_payment_id,
                'razorpay_signature': req.razorpay_signature
            }
            app_state.rzp_client.utility.verify_payment_signature(params_dict)
        except Exception as e:
            raise HTTPException(status_code=400, detail="Payment verification failed")
        # Resolve plan from echoed plan_id, then prove the live Razorpay payment/order
        # actually match that plan before granting credits.
        plan_config = settings.PLAN_PRICING.get(req.plan_id) if req.plan_id else None
        currency_paid = "INR"
        amount_paid_minor = plan_config.get("inr_paise", 0) if plan_config else 0

        try:
            payment_live = app_state.rzp_client.payment.fetch(req.razorpay_payment_id)
            currency_paid = payment_live.get('currency', currency_paid)
            amount_paid_minor = payment_live.get('amount', amount_paid_minor)
        except Exception as e:
            raise HTTPException(status_code=502, detail="Unable to verify payment with Razorpay") from e

        payment_order_id = (payment_live.get("order_id") or "").strip()
        if payment_order_id != req.razorpay_order_id:
            observability._json_log(
                "warning",
                "payment_order_mismatch",
                uid=uid,
                submitted_order_id=req.razorpay_order_id,
                live_order_id=payment_order_id,
                payment_id=req.razorpay_payment_id,
            )
            raise HTTPException(status_code=400, detail="Payment does not match the submitted order.")

        payment_status = (payment_live.get("status") or "").lower()
        if payment_status != "captured":
            observability._json_log(
                "warning",
                "payment_not_captured",
                uid=uid,
                order_id=req.razorpay_order_id,
                payment_id=req.razorpay_payment_id,
                status=payment_status,
            )
            raise HTTPException(status_code=400, detail="Payment is not captured yet.")

        try:
            order_live = app_state.rzp_client.order.fetch(req.razorpay_order_id)
        except Exception as e:
            raise HTTPException(status_code=502, detail="Unable to verify payment order with Razorpay") from e

        order_amount = int(order_live.get("amount", 0) or 0)
        order_currency = (order_live.get("currency") or "").upper()
        if order_amount != int(amount_paid_minor or 0) or order_currency != (currency_paid or "").upper():
            observability._json_log(
                "warning",
                "payment_order_amount_mismatch",
                uid=uid,
                order_id=req.razorpay_order_id,
                payment_id=req.razorpay_payment_id,
                order_amount=order_amount,
                payment_amount=int(amount_paid_minor or 0),
                order_currency=order_currency,
                payment_currency=currency_paid,
            )
            raise HTTPException(status_code=400, detail="Payment order amount does not match the captured payment.")

        order_notes = order_live.get("notes") or {}
        if not isinstance(order_notes, dict):
            order_notes = {}
        order_uid = (order_notes.get("uid") or "").strip()
        order_plan_id = (order_notes.get("plan_id") or "").strip()
        if not order_uid or order_uid != uid:
            raise HTTPException(status_code=403, detail="Payment order belongs to a different user.")
        if not order_plan_id:
            raise HTTPException(status_code=400, detail="Payment order is missing its plan binding.")
        if req.plan_id and order_plan_id != req.plan_id:
            raise HTTPException(status_code=400, detail="Payment order does not match the selected plan.")

        if not req.plan_id and order_plan_id:
            req.plan_id = order_plan_id
            plan_config = settings.PLAN_PRICING.get(req.plan_id)
        if not plan_config:
            req.plan_id = host._resolve_plan_from_amount_currency(int(amount_paid_minor or 0), currency_paid) or ""
            plan_config = settings.PLAN_PRICING.get(req.plan_id)
        if not plan_config:
            raise HTTPException(status_code=400, detail="Unable to resolve purchased plan")

        if not host._payment_idem_claim(pay_idem_key):
            concurrent = host._payment_idem_get(pay_idem_key)
            if concurrent and concurrent.get("status") == "completed":
                return {**concurrent["payload"], "idempotent_replay": True}
            raise HTTPException(status_code=409, detail="Payment verification with this idempotency key is already in progress.")

        payload = host._apply_successful_payment(
            uid=uid,
            plan_id=req.plan_id,
            payment_id=req.razorpay_payment_id,
            order_id=req.razorpay_order_id,
            amount_minor=int(amount_paid_minor or 0),
            currency=currency_paid,
            source="client_verify",
            org_id=req.org_id or request_security._tenant_id_from_token(decoded_token),
            topup_reservation_id=str(order_notes.get("topup_reservation_id") or "").strip(),
            order_amount_validated=True,
            order_created_at=int(order_live.get("created_at") or 0),
        )
        host._payment_idem_set(pay_idem_key, {"status": "completed", "ts": time.time(), "payload": payload})
        return payload

    @router.post("/api/razorpay-webhook")
    async def razorpay_webhook(request: Request):
        if not settings.RAZORPAY_WEBHOOK_SECRET:
            raise HTTPException(status_code=503, detail="Webhook secret not configured")

        declared_length = int(request.headers.get("content-length", "0") or 0)
        if declared_length > 256 * 1024:
            raise HTTPException(status_code=413, detail="Webhook payload too large")
        signature = request.headers.get("x-razorpay-signature", "")
        body_bytes = await request.body()
        if len(body_bytes) > 256 * 1024:
            raise HTTPException(status_code=413, detail="Webhook payload too large")
        # Verification and entitlement updates call Razorpay and Firestore
        # synchronously; keep them off the event loop shared by every request.
        return await asyncio.to_thread(_handle_razorpay_webhook, body_bytes, signature)

    def _handle_razorpay_webhook(body_bytes: bytes, signature: str):
        expected = hmac.new(
            settings.RAZORPAY_WEBHOOK_SECRET.encode("utf-8"),
            body_bytes,
            hashlib.sha256
        ).hexdigest()

        if not signature or not hmac.compare_digest(expected, signature):
            raise HTTPException(status_code=400, detail="Invalid webhook signature")

        try:
            payload = json.loads(body_bytes.decode("utf-8") or "{}")
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid webhook payload")

        event = payload.get("event", "")
        payment_entity = ((payload.get("payload") or {}).get("payment") or {}).get("entity") or {}
        refund_entity = ((payload.get("payload") or {}).get("refund") or {}).get("entity") or {}
        payment_id = payment_entity.get("id", "")
        order_id = payment_entity.get("order_id", "")
        amount_minor = int(payment_entity.get("amount", 0) or 0)
        currency = (payment_entity.get("currency", "INR") or "INR").upper()
        status = payment_entity.get("status", "")
        notes = payment_entity.get("notes") or {}

        db = firebase_admin_setup.get_db()
        webhook_ref = None
        if db:
            try:
                webhook_document_id = refund_entity.get("id") or payment_id or str(uuid.uuid4())
                webhook_ref = db.collection("payment_webhooks").document(webhook_document_id)
                webhook_ref.set({
                    "event": event,
                    "payment_id": payment_id,
                    "refund_id": refund_entity.get("id", ""),
                    "order_id": order_id,
                    "currency": currency,
                    "amount": amount_minor,
                    "status": status,
                    "refund_status": refund_entity.get("status", ""),
                    "notes": notes,
                    "received_at": observability._utcnow().isoformat() + "Z",
                    "reconcile_required": event == "payment.captured" and status == "captured",
                    "expire_at": observability._retention_deadline(90),
                }, merge=True)
            except Exception as e:
                print(f"[Webhook] Failed to persist webhook event: {e}")

        if event in {"refund.created", "refund.processed", "refund.failed"}:
            if not db:
                raise HTTPException(status_code=503, detail="Database unavailable")
            refund_payment_id = str(refund_entity.get("payment_id") or payment_id or "").strip()
            if not refund_payment_id or not host.RAZORPAY_AVAILABLE or app_state.rzp_client is None:
                raise HTTPException(status_code=503, detail="Refund payment verification is unavailable")
            try:
                refund_payment_live = app_state.rzp_client.payment.fetch(refund_payment_id)
            except Exception as e:
                # A non-2xx response asks Razorpay to retry instead of acknowledging a
                # refund whose entitlement owner could not be established safely.
                raise HTTPException(status_code=502, detail="Unable to verify refunded payment with Razorpay") from e
            refund_order_id = str(refund_payment_live.get("order_id") or "").strip()
            refund_amount_paid = int(refund_payment_live.get("amount", 0) or 0)
            refund_currency = str(refund_payment_live.get("currency") or "INR").upper()
            refund_context = host._fetch_bound_order_context(
                refund_order_id,
                refund_amount_paid,
                refund_currency,
            )
            refund_payment_bound = {**refund_payment_live, "notes": refund_context}
            if webhook_ref is not None:
                try:
                    webhook_ref.update({
                        "payment_id": refund_payment_id,
                        "order_id": refund_order_id,
                        "notes": refund_context,
                    })
                except Exception as e:
                    observability._json_log("warning", "refund_webhook_context_persist_failed", payment_id=refund_payment_id, error=str(e))
            return host._apply_refund_webhook_event(db, event, refund_entity, refund_payment_bound)

        if event == "payment.failed":
            observability._track_event("payment_failed", {
                "payment_id": payment_id,
                "order_id": order_id,
                "currency": currency,
                "amount_minor": amount_minor,
            })

        # Acknowledge non-captured events.
        if event != "payment.captured" or status != "captured":
            return {"success": True, "ignored": True, "event": event}

        # Resolve the entitlement from the server-created order. Payment notes are
        # not authoritative and are commonly empty in payment.captured payloads.
        order_context = host._fetch_bound_order_context(order_id, amount_minor, currency)
        uid = order_context["uid"]
        plan_id = order_context["plan_id"]
        org_id = order_context["org_id"]
        topup_reservation_id = order_context["topup_reservation_id"]
        if webhook_ref is not None:
            try:
                webhook_ref.update({"notes": order_context})
            except Exception as e:
                observability._json_log("warning", "payment_webhook_context_persist_failed", payment_id=payment_id, error=str(e))

        result = host._apply_successful_payment(
            uid=uid,
            plan_id=plan_id,
            payment_id=payment_id or f"webhook_{uuid.uuid4().hex[:12]}",
            order_id=order_id or "",
            amount_minor=amount_minor,
            currency=currency,
            source="webhook",
            org_id=org_id,
            topup_reservation_id=topup_reservation_id,
            order_amount_validated=True,
            order_created_at=int(order_context.get("order_created_at") or 0),
        )
        if webhook_ref is not None:
            try:
                webhook_ref.update({
                    "reconcile_required": False,
                    "reconciled_at": observability._utcnow().isoformat() + "Z",
                })
            except Exception as e:
                observability._json_log("warning", "payment_webhook_reconcile_mark_failed", payment_id=payment_id, error=str(e))
        return {"success": True, "applied": True, "result": result}

    @router.post("/api/reconcile-payments")
    def reconcile_payments(req: ReconcilePaymentsRequest, request: Request):
        if not host._can_trigger_reconcile(request, req):
            raise HTTPException(status_code=403, detail="Not authorized to run reconciliation")
        summary = host.reconcile_payments_once(
            reason="manual",
            lookback_hours=req.lookback_hours,
            limit=req.limit,
        )
        if not summary.get("success"):
            raise HTTPException(status_code=500, detail=summary.get("error", "Reconciliation failed"))
        return summary

    return SimpleNamespace(
        router=router,
        create_order=create_order,
        verify_payment=verify_payment,
        razorpay_webhook=razorpay_webhook,
        reconcile_payments=reconcile_payments,
    )
