"""Bounded polling for the production API's durable transcription jobs."""
import time
from urllib.parse import urljoin


def await_transcription(session, base_url, settings, headers, initial, *, deadline, interval=3):
    payload = initial
    while payload.get("pending"):
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise RuntimeError("Transcription completion deadline exceeded")
        time.sleep(min(interval, remaining))
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise RuntimeError("Transcription completion deadline exceeded")
        # Identical settings recover the same durable job; this is also how
        # the browser resumes after a network failure, without duplicate billing.
        response = session.post(urljoin(base_url, "api/process"), json=settings,
                                headers=headers, timeout=min(20, remaining))
        response.raise_for_status()
        payload = response.json()
        if payload.get("success") is False or payload.get("status") in {"failed", "unknown", "cancelled"}:
            raise RuntimeError("Transcription did not complete successfully")
    if not payload.get("captions"):
        raise RuntimeError("Transcription completed without captions")
    return payload
