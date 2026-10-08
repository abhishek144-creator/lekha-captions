"""Operator route: transcription provider health."""

from fastapi import APIRouter, HTTPException, Request


try:
    from . import request_security
    from .provider_health import transcription_provider_health
except ImportError:  # Direct execution from backend/ remains supported.
    import request_security
    from provider_health import transcription_provider_health


router = APIRouter()

@router.get("/api/admin/provider-health")
def provider_health(request: Request):
    if not request_security._is_admin_token(request=request):
        raise HTTPException(403, "Admin access required")
    return {
        "success": True,
        "providers": transcription_provider_health.snapshot(),
        "policy": {
            "failure_threshold": transcription_provider_health.failure_threshold,
            "cooldown_seconds": transcription_provider_health.cooldown_seconds,
            "failover_order": ["sarvam", "openai"],
        },
    }
