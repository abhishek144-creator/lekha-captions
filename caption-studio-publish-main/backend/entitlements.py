"""Plan tiers, subscription expiry, video-length limits and AI usage quotas.

The factory accepts explicit configuration, adapters and shared state through
ServiceContext. It has no dependency on the HTTP entry point.
"""

from types import SimpleNamespace
from typing import Protocol, Any
from typing import Dict
from fastapi import HTTPException
from typing import Optional
from datetime import date
from datetime import datetime
from datetime import timezone

class ServiceContext(Protocol):
    AI_DAILY_LIMITS: Any
    AI_SYSTEM_DAILY_LIMIT: Any
    DISABLE_EXPORT_CREDIT_LIMIT: Any
    FREE_LIFETIME_TRANSCRIPTIONS: Any
    FREE_PLAN_CREDITS: Any
    PLAN_EXPORT_PRESETS: Any
    PLAN_PRICING: Any
    QUALITY_RANK: Any
    SERVICE_CONTROL_COLLECTION: Any
    _IS_PRODUCTION: Any
    _IS_TEST: Any
    _effective_subscription_tier: Any
    _json_log: Any
    _normalize_tier_name: Any
    _release_ai_quota: Any
    _release_system_ai_quota: Any
    _reserve_system_ai_quota: Any
    _retention_deadline: Any
    _subscription_is_expired: Any
    _track_event: Any
    _utcnow: Any
    firestore: Any
    get_db: Any


def create_entitlements(context: ServiceContext) -> SimpleNamespace:
    def _normalize_tier_name(tier: str) -> str:
        t = (tier or "free").strip().lower()
        if t in context.PLAN_EXPORT_PRESETS:
            return t
        if t in ("professional", "business", "pro_plus"):
            return "pro"
        return "free"


    def _normalize_free_credit_balance(value: Any, *, default: int = 0) -> int:
        """Keep a Free entitlement inside the catalog-defined 0..N range."""
        try:
            credits = int(value)
        except (TypeError, ValueError):
            credits = int(default)
        return max(0, min(context.FREE_PLAN_CREDITS, credits))


    def _subscription_is_expired(user_data: Optional[Dict[str, Any]], now: Optional[datetime] = None) -> bool:
        data = user_data or {}
        tier = context._normalize_tier_name(data.get("subscription_tier", "free"))
        if tier == "free":
            return False
        expiry_value = str(
            data.get("subscription_expiry")
            or data.get("billing_cycle_end")
            or ""
        ).strip()
        if not expiry_value:
            # Paid access without an expiry timestamp cannot be verified safely.
            # Payment and promotion flows are responsible for writing this field.
            return True
        try:
            expiry = datetime.fromisoformat(expiry_value.replace("Z", "+00:00"))
            if expiry.tzinfo is None:
                expiry = expiry.replace(tzinfo=timezone.utc)
            comparison_time = now or datetime.now(timezone.utc)
            if comparison_time.tzinfo is None:
                comparison_time = comparison_time.replace(tzinfo=timezone.utc)
            return expiry <= comparison_time.astimezone(expiry.tzinfo)
        except (TypeError, ValueError):
            # Malformed paid-plan expiry data must not silently grant indefinite
            # entitlements. Repairing the account timestamp restores access.
            return True


    def _effective_subscription_tier(user_data: Optional[Dict[str, Any]], now: Optional[datetime] = None) -> str:
        tier = context._normalize_tier_name((user_data or {}).get("subscription_tier", "free"))
        return "free" if context._subscription_is_expired(user_data, now) else tier


    def _lookup_subscription_tier(uid: str) -> str:
        """Best-effort read of the caller's current subscription tier from Firestore.
    Returns 'free' when the DB or user record is unavailable."""
        if not uid:
            return "free"
        db = context.get_db()
        if not db:
            return "free"
        try:
            snap = db.collection("users").document(uid).get()
            if snap.exists:
                return context._effective_subscription_tier(snap.to_dict() or {})
        except Exception:
            pass
        return "free"


    def _max_video_seconds_for_tier(tier: str) -> int:
        """Per-plan source-video length cap. Falls back to the global 180s ceiling
    for tiers (including 'free') that don't advertise a tighter limit."""
        return int(context.PLAN_PRICING.get(tier, {}).get("max_video_seconds", 180) or 180)


    def _reserve_system_ai_quota(db, operation: str) -> None:
        """Reserve one call against the platform-wide daily AI ceiling.

    Separate document from the per-user counter so the two can't contend. In
    production a counter outage fails closed: this ceiling is the last guard on
    paid-provider spend, so an unreadable counter must not mean unlimited calls.
    """
        if context.AI_SYSTEM_DAILY_LIMIT <= 0:
            return
        today = date.today().isoformat()
        usage_ref = db.collection(context.SERVICE_CONTROL_COLLECTION).document(f"ai_usage_{today}")

        @context.firestore.transactional
        def reserve_system(txn):
            snap = usage_ref.get(transaction=txn)
            data = snap.to_dict() if snap.exists else {}
            total = int((data or {}).get("total", 0) or 0)
            if total >= context.AI_SYSTEM_DAILY_LIMIT:
                raise HTTPException(
                    status_code=503,
                    detail="Lekha Captions has hit today's processing capacity. Please try again tomorrow.",
                )
            by_op = dict((data or {}).get("by_operation") or {})
            by_op[operation] = int(by_op.get(operation, 0) or 0) + 1
            txn.set(usage_ref, {
                "date": today,
                "total": total + 1,
                "by_operation": by_op,
                "limit": context.AI_SYSTEM_DAILY_LIMIT,
                "updated_at": context._utcnow().isoformat() + "Z",
                "expire_at": context._retention_deadline(30),
            }, merge=True)

        try:
            reserve_system(db.transaction())
        except HTTPException:
            context._json_log("error", "ai_system_daily_limit_reached", operation=operation, limit=context.AI_SYSTEM_DAILY_LIMIT)
            context._track_event("ai_system_daily_limit_reached", {"operation": operation})
            raise
        except Exception as e:
            context._json_log("warning", "ai_system_quota_reserve_failed", operation=operation, error=str(e))
            if context._IS_PRODUCTION:
                raise HTTPException(status_code=503, detail="AI quota service is temporarily unavailable") from e


    def _reserve_ai_quota(uid: str, operation: str) -> None:
        """Atomically reserve one daily paid-provider call before invoking it."""
        if operation not in {"process", "translate", "detect_language"}:
            raise HTTPException(status_code=400, detail="Unknown AI operation")
        if context._IS_TEST:
            return
        db = context.get_db()
        if not db:
            if context._IS_PRODUCTION:
                raise HTTPException(status_code=503, detail="AI quota service is temporarily unavailable")
            return

        user_ref = db.collection("users").document(uid)
        transaction = db.transaction()
        today = date.today().isoformat()

        @context.firestore.transactional
        def reserve(txn):
            snap = user_ref.get(transaction=txn)
            data = snap.to_dict() if snap.exists else {}
            # Expired paid accounts receive free-tier provider quotas. Export policy
            # already treats them as free; using the raw stored tier here would let an
            # expired Pro account keep Pro transcription/translation capacity.
            tier = context._effective_subscription_tier(data or {})
            base_tier = tier.replace("_yearly", "")
            limits = context.AI_DAILY_LIMITS.get(base_tier, context.AI_DAILY_LIMITS["free"])
            limit = int(limits[operation])
            usage = dict((data or {}).get("ai_daily_usage") or {}) if (data or {}).get("ai_usage_date") == today else {}
            used = int(usage.get(operation, 0) or 0)
            update = {}
            if base_tier == "free" and operation == "process":
                lifetime = dict((data or {}).get("ai_lifetime_usage") or {})
                lifetime_used = int(lifetime.get("process", 0) or 0)
                if lifetime_used >= context.FREE_LIFETIME_TRANSCRIPTIONS:
                    raise HTTPException(
                        status_code=402,
                        detail=(
                            f"FREE_TRANSCRIPTIONS_USED: You've used your {context.FREE_LIFETIME_TRANSCRIPTIONS} free "
                        "transcriptions. Upgrade to keep captioning."
                        ),
                    )
                lifetime["process"] = lifetime_used + 1
                update["ai_lifetime_usage"] = lifetime
            if used >= limit:
                raise HTTPException(
                    status_code=429,
                    detail=f"Daily {operation.replace('_', ' ')} quota reached for this plan",
                )
            usage[operation] = used + 1
            txn.set(user_ref, {
                "uid": uid,
                "ai_usage_date": today,
                "ai_daily_usage": usage,
                **update,
                "updated_at": context._utcnow().isoformat() + "Z",
            }, merge=True)

        reserve(transaction)

        # Platform ceiling is charged only after the per-user reservation succeeds,
        # so a user who is already over their own quota never consumes shared
        # capacity. If the platform is full, hand the user's reservation back.
        try:
            context._reserve_system_ai_quota(db, operation)
        except HTTPException:
            context._release_ai_quota(uid, operation, release_system=False)
            raise


    def _read_system_ai_usage(db) -> Dict[str, Any]:
        """Today's platform-wide AI spend, for the operator dashboard."""
        today = date.today().isoformat()
        snapshot = {
            "date": today,
            "total": 0,
            "by_operation": {},
            "limit": context.AI_SYSTEM_DAILY_LIMIT,
            "remaining": context.AI_SYSTEM_DAILY_LIMIT,
        }
        if not db or context.AI_SYSTEM_DAILY_LIMIT <= 0:
            return snapshot
        try:
            snap = (
                db.collection(context.SERVICE_CONTROL_COLLECTION)
                .document(f"ai_usage_{today}")
                .get()
            )
            if snap.exists:
                data = snap.to_dict() or {}
                total = int(data.get("total", 0) or 0)
                snapshot["total"] = total
                snapshot["by_operation"] = dict(data.get("by_operation") or {})
                snapshot["remaining"] = max(0, context.AI_SYSTEM_DAILY_LIMIT - total)
        except Exception as e:
            context._json_log("warning", "ai_system_usage_read_failed", error=str(e))
        return snapshot


    def _release_system_ai_quota(db, operation: str) -> None:
        """Return one call to the platform-wide daily ceiling. Best-effort."""
        if context.AI_SYSTEM_DAILY_LIMIT <= 0:
            return
        today = date.today().isoformat()
        usage_ref = db.collection(context.SERVICE_CONTROL_COLLECTION).document(f"ai_usage_{today}")

        @context.firestore.transactional
        def release_system(txn):
            snap = usage_ref.get(transaction=txn)
            if not snap.exists:
                return
            data = snap.to_dict() or {}
            # A UTC date rollover means this document is no longer today's counter.
            if data.get("date") != today:
                return
            total = int(data.get("total", 0) or 0)
            if total <= 0:
                return
            by_op = dict(data.get("by_operation") or {})
            by_op[operation] = max(0, int(by_op.get(operation, 0) or 0) - 1)
            txn.set(usage_ref, {
                "total": total - 1,
                "by_operation": by_op,
                "updated_at": context._utcnow().isoformat() + "Z",
            }, merge=True)

        try:
            release_system(db.transaction())
        except Exception as e:
            context._json_log("warning", "ai_system_quota_release_failed", operation=operation, error=str(e))


    def _release_ai_quota(uid: str, operation: str, release_system: bool = True) -> None:
        """Give back a reserved daily call when the paid provider never delivered.

    Quota is reserved *before* the provider call so a burst of concurrent
    requests can't overshoot the plan limit. When the call then fails for a
    reason that is ours (provider error, circuit trip, extraction failure), the
    reservation must be returned — otherwise a user burns their whole daily
    allowance on our outage. User-caused rejections (no speech in the audio,
    unsupported input) are *not* released: the provider still ran and billed us.

    Best-effort by design: a failed release must never mask the original error,
    and the counter self-heals at the next UTC date rollover.
    """
        if operation not in {"process", "translate", "detect_language"}:
            return
        if context._IS_TEST or not uid:
            return
        db = context.get_db()
        if not db:
            return

        user_ref = db.collection("users").document(uid)
        today = date.today().isoformat()

        @context.firestore.transactional
        def release(txn):
            snap = user_ref.get(transaction=txn)
            if not snap.exists:
                return
            data = snap.to_dict() or {}
            update = {}
            # A failed free transcription must not use up the account's trial.
            lifetime = dict(data.get("ai_lifetime_usage") or {})
            lifetime_used = int(lifetime.get(operation, 0) or 0)
            if operation == "process" and lifetime_used > 0 and context._effective_subscription_tier(data).replace("_yearly", "") == "free":
                lifetime[operation] = lifetime_used - 1
                update["ai_lifetime_usage"] = lifetime
            # A date rollover between reserve and release already zeroed the counter.
            usage = dict(data.get("ai_daily_usage") or {})
            used = int(usage.get(operation, 0) or 0)
            if data.get("ai_usage_date") == today and used > 0:
                usage[operation] = used - 1
                update["ai_daily_usage"] = usage
            if not update:
                return
            txn.set(user_ref, {
                **update,
                "updated_at": context._utcnow().isoformat() + "Z",
            }, merge=True)

        try:
            release(db.transaction())
            context._json_log("info", "ai_quota_released", uid=uid, operation=operation)
        except Exception as e:
            context._json_log("warning", "ai_quota_release_failed", uid=uid, operation=operation, error=str(e))

        if release_system:
            context._release_system_ai_quota(db, operation)


    def _resolve_export_preset(tier: str, requested_quality: str, requested_fps: int) -> Dict[str, Any]:
        normalized = "pro" if context.DISABLE_EXPORT_CREDIT_LIMIT else context._normalize_tier_name(tier)
        preset = context.PLAN_EXPORT_PRESETS.get(normalized, context.PLAN_EXPORT_PRESETS["free"])

        req_quality = (requested_quality or "1080p").lower()
        if req_quality not in context.QUALITY_RANK:
            req_quality = "1080p"
        max_quality = preset["max_quality"]
        quality = max_quality if context.QUALITY_RANK[req_quality] > context.QUALITY_RANK[max_quality] else req_quality

        requested_fps = int(requested_fps or 30)
        fps_options = sorted(list(preset["fps_options"]))
        fps = requested_fps if requested_fps in preset["fps_options"] else min(fps_options, key=lambda x: abs(x - requested_fps))

        return {
            "tier": normalized,
            "quality": quality,
            "fps": fps,
            "downgraded": (quality != req_quality or fps != requested_fps),
        }

    return SimpleNamespace(
        _normalize_tier_name=_normalize_tier_name,
        _normalize_free_credit_balance=_normalize_free_credit_balance,
        _subscription_is_expired=_subscription_is_expired,
        _effective_subscription_tier=_effective_subscription_tier,
        _lookup_subscription_tier=_lookup_subscription_tier,
        _max_video_seconds_for_tier=_max_video_seconds_for_tier,
        _reserve_system_ai_quota=_reserve_system_ai_quota,
        _reserve_ai_quota=_reserve_ai_quota,
        _read_system_ai_usage=_read_system_ai_usage,
        _release_system_ai_quota=_release_system_ai_quota,
        _release_ai_quota=_release_ai_quota,
        _resolve_export_preset=_resolve_export_preset,
    )
