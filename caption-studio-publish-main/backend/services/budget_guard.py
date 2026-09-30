"""Pause paid work automatically when the Google Cloud budget is used up.

Cloud Billing publishes the budget's status to Pub/Sub several times a day;
Pub/Sub pushes it to /api/maintenance/budget-alert. Budget alerts alone only
send email, so this is what turns "budget spent" into "stop starting new work".
It never resumes anything: the owner reviews the bill and unpauses by hand.
"""

import base64
import binascii
import json

# Uploads, transcription and exports are what start paid compute and AI calls.
# Sign-ups, payments and the editor stay available.
BUDGET_STOP_CONTROLS = ("pause_uploads", "pause_transcription", "pause_exports")
BUDGET_STOP_NOTICE = (
    "New uploads and exports are paused for a short while. "
    "Your captions and projects are safe. Please try again later."
)


def parse_budget_notification(envelope):
    """Return the budget status from a Pub/Sub push body, or None if it isn't one."""
    message = (envelope or {}).get("message") if isinstance(envelope, dict) else None
    data = (message or {}).get("data") if isinstance(message, dict) else None
    if not data:
        return None
    try:
        payload = json.loads(base64.b64decode(data, validate=True).decode("utf-8"))
    except (binascii.Error, ValueError, UnicodeDecodeError):
        return None
    return payload if isinstance(payload, dict) else None


def budget_exhausted(payload, stop_fraction=1.0):
    """True when actual (not forecast) spend has reached the stop line."""
    try:
        cost = float(payload.get("costAmount"))
        budget = float(payload.get("budgetAmount"))
    except (AttributeError, TypeError, ValueError):
        return False
    return budget > 0 and cost >= budget * stop_fraction
