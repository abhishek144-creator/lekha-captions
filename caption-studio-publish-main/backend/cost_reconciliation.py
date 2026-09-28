"""Persist bill-backed export-cost reports without confusing them with estimates."""

from datetime import date
from typing import Any, Callable, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, model_validator


class BillingEvidence(BaseModel):
    source: str = Field(pattern=r"^gcp_detailed_billing_export$")
    currency: str = Field(pattern=r"^USD$")
    window_start: str = Field(min_length=20, max_length=40)
    window_end: str = Field(min_length=20, max_length=40)
    row_count: int = Field(ge=1)
    net_cost_usd: float = Field(ge=0)
    service_cost_usd: Dict[str, float] = Field(default_factory=dict, max_length=100)
    source_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")


class ObservationEvidence(BaseModel):
    terminal_job_count: int = Field(ge=1)
    successful_jobs_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")


class ProviderBillingEvidence(BaseModel):
    provider: str = Field(pattern=r"^(openai|sarvam|other)$")
    invoice_id: str = Field(min_length=1, max_length=160)
    currency: str = Field(min_length=3, max_length=3)
    original_net_cost: float = Field(ge=0)
    # Provider invoices are normalized to USD using the finance-approved rate
    # recorded with this reconciliation; the untouched original is retained.
    net_cost_usd: float = Field(ge=0)
    source_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")


class BusinessEvidence(BaseModel):
    marketing_spend_inr: float = Field(default=0, ge=0)
    gross_revenue_inr: float = Field(default=0, ge=0)
    activated_accounts: int = Field(default=0, ge=0)
    source_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")


class CostReconciliationRequest(BaseModel):
    completed: int = Field(ge=0)
    failed: int = Field(ge=0)
    rendered_video_minutes: float = Field(ge=0)
    billing: BillingEvidence
    observation_evidence: ObservationEvidence
    provider_billing: List[ProviderBillingEvidence] = Field(default_factory=list, max_length=20)
    usd_to_inr_rate: Optional[float] = Field(default=None, gt=0)
    business_evidence: Optional[BusinessEvidence] = None

    @model_validator(mode="after")
    def require_successful_exports(self):
        if self.completed < 1:
            raise ValueError("At least one successful export is required for a cost metric")
        return self


def build_cost_reconciliation(day_key: str, report: CostReconciliationRequest) -> Dict[str, Any]:
    try:
        parsed_day = date.fromisoformat(day_key)
    except ValueError as exc:
        raise HTTPException(400, "date must use YYYY-MM-DD") from exc
    window_day = report.billing.window_start[:10]
    if window_day != parsed_day.isoformat():
        raise HTTPException(422, "Billing window must start on the report date")
    infrastructure_cost = float(report.billing.net_cost_usd)
    provider_cost = sum(float(item.net_cost_usd) for item in report.provider_billing)
    cost = infrastructure_cost + provider_cost
    rate = float(report.usd_to_inr_rate) if report.usd_to_inr_rate else None
    actual_cost_inr = round(cost * rate, 4) if rate else None
    business = report.business_evidence
    return {
        "date": parsed_day.isoformat(),
        "completed": report.completed,
        "failed": report.failed,
        "rendered_video_minutes": report.rendered_video_minutes,
        "actual_net_cost_usd": round(cost, 6),
        "infrastructure_net_cost_usd": round(infrastructure_cost, 6),
        "provider_net_cost_usd": round(provider_cost, 6),
        "actual_net_cost_inr": actual_cost_inr,
        "cost_per_successful_export_usd": round(cost / report.completed, 6),
        "cost_per_successful_export_inr": (
            round(actual_cost_inr / report.completed, 4) if actual_cost_inr is not None else None
        ),
        "cost_per_rendered_video_minute_usd": (
            round(cost / report.rendered_video_minutes, 6)
            if report.rendered_video_minutes > 0 else None
        ),
        "cost_source": (
            f"{report.billing.source}+provider_invoices"
            if report.provider_billing else report.billing.source
        ),
        "usd_to_inr_rate": rate,
        "billing_evidence": report.billing.model_dump(),
        "provider_billing_evidence": [item.model_dump() for item in report.provider_billing],
        "observation_evidence": report.observation_evidence.model_dump(),
        "business_evidence": business.model_dump() if business else None,
        "customer_acquisition_cost_inr": (
            round(business.marketing_spend_inr / business.activated_accounts, 4)
            if business and business.activated_accounts > 0 else None
        ),
        "gross_revenue_inr": business.gross_revenue_inr if business else None,
    }


def read_cost_reconciliation(database, day_key: str) -> Optional[Dict[str, Any]]:
    if database is None:
        return None
    try:
        snapshot = database.collection("cost_reconciliations").document(day_key).get()
        return (snapshot.to_dict() or {}) if snapshot.exists else None
    except Exception:
        # Analytics stays available if the optional reconciliation record store
        # is temporarily unavailable; actual-cost fields remain explicitly null.
        return None


def create_cost_reconciliation_router(
    is_admin: Callable[..., bool],
    get_database: Callable[[], Any],
) -> APIRouter:
    router = APIRouter()

    def require_admin(request: Request):
        if not is_admin(request=request):
            raise HTTPException(403, "Admin access required")

    @router.put("/api/admin/cost-reconciliations/{day_key}")
    def save_cost_reconciliation(
        day_key: str,
        report: CostReconciliationRequest,
        request: Request,
    ):
        require_admin(request)
        database = get_database()
        if database is None:
            raise HTTPException(503, "Cost reconciliation storage is unavailable")
        record = build_cost_reconciliation(day_key, report)
        database.collection("cost_reconciliations").document(day_key).set(record)
        return {"success": True, "reconciliation": record}

    @router.get("/api/admin/cost-reconciliations/{day_key}")
    def get_cost_reconciliation(day_key: str, request: Request):
        require_admin(request)
        record = read_cost_reconciliation(get_database(), day_key)
        if record is None:
            raise HTTPException(404, "No bill-backed cost reconciliation for this date")
        return {"success": True, "reconciliation": record}

    return router
