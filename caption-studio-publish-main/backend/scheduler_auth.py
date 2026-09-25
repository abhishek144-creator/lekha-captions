"""Authorization for internal Cloud Scheduler maintenance routes."""

import hmac

from fastapi import HTTPException
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2 import id_token as google_id_token


def require_scheduler_authorization(
    request,
    *,
    shared_secret="",
    service_account_email="",
    oidc_audience="",
    rejected_callback=None,
):
    supplied = (request.headers.get("x-reconcile-secret") or "").strip()
    if shared_secret and supplied and hmac.compare_digest(supplied, shared_secret):
        return

    authorization = (request.headers.get("authorization") or "").strip()
    if service_account_email and oidc_audience and authorization.startswith("Bearer "):
        try:
            claims = google_id_token.verify_oauth2_token(
                authorization.removeprefix("Bearer ").strip(),
                GoogleAuthRequest(),
                oidc_audience,
            )
            if claims.get("email") == service_account_email and claims.get("email_verified") is True:
                return
        except Exception as error:
            if rejected_callback:
                rejected_callback(error)
    raise HTTPException(status_code=403, detail="Scheduler authorization required")
