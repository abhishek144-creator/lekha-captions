"""Admin routes; shared state and helpers resolve through the application context.

The factory accepts explicit configuration, adapters and shared state through
ServiceContext. It has no dependency on the HTTP entry point.
"""

from types import SimpleNamespace
from typing import Protocol, Any

from fastapi import APIRouter


from fastapi import HTTPException
from fastapi import Request

class ServiceContext(Protocol):
    _is_admin_token: Any
    transcription_provider_health: Any


def create_provider_admin_router(context: ServiceContext) -> SimpleNamespace:
    router = APIRouter()

    @router.get("/api/admin/provider-health")
    def provider_health(request: Request):
        if not context._is_admin_token(request=request):
            raise HTTPException(403, "Admin access required")
        return {
            "success": True,
            "providers": context.transcription_provider_health.snapshot(),
            "policy": {
                "failure_threshold": context.transcription_provider_health.failure_threshold,
                "cooldown_seconds": context.transcription_provider_health.cooldown_seconds,
                "failover_order": ["sarvam", "openai"],
            },
        }

    return SimpleNamespace(
        router=router,
        provider_health=provider_health,
    )

