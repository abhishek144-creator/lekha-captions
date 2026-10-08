"""Admin routes; shared state and helpers resolve through main's host module."""

from types import ModuleType, SimpleNamespace

from fastapi import APIRouter
try:
    from . import request_security
except ImportError:  # Direct execution from backend/ remains supported.
    import request_security


def create_provider_admin_router(host: ModuleType) -> SimpleNamespace:
    router = APIRouter()

    @router.get("/api/admin/provider-health")
    def provider_health(request: host.Request):
        if not request_security._is_admin_token(request=request):
            raise host.HTTPException(403, "Admin access required")
        return {
            "success": True,
            "providers": host.transcription_provider_health.snapshot(),
            "policy": {
                "failure_threshold": host.transcription_provider_health.failure_threshold,
                "cooldown_seconds": host.transcription_provider_health.cooldown_seconds,
                "failover_order": ["sarvam", "openai"],
            },
        }

    return SimpleNamespace(
        router=router,
        provider_health=provider_health,
    )

