"""Publish Redis/RQ backlog signals for Google Cloud worker autoscaling."""

from __future__ import annotations

from datetime import datetime, timezone
import json
import os
import urllib.parse
import urllib.request


METADATA_ROOT = "http://metadata.google.internal/computeMetadata/v1"
_ALLOWED_ENDPOINTS = {
    ("http", "metadata.google.internal", 80),
    ("https", "monitoring.googleapis.com", 443),
}


def _open_google_request(request: urllib.request.Request, timeout: int):
    parsed = urllib.parse.urlsplit(request.full_url)
    default_port = 443 if parsed.scheme == "https" else 80
    endpoint = (parsed.scheme, parsed.hostname, parsed.port or default_port)
    if parsed.username or parsed.password or endpoint not in _ALLOWED_ENDPOINTS:
        raise ValueError("Refusing a request outside the approved Google endpoints")
    # The scheme, host, and port are constrained by the allowlist above.
    return urllib.request.urlopen(request, timeout=timeout)  # nosec B310


def _metadata(path: str) -> str:
    request = urllib.request.Request(
        f"{METADATA_ROOT}/{path}",
        headers={"Metadata-Flavor": "Google"},
    )
    with _open_google_request(request, timeout=3) as response:
        return response.read().decode("utf-8").strip()


def _project_id() -> str:
    return (
        os.environ.get("GOOGLE_CLOUD_PROJECT", "").strip()
        or os.environ.get("GCP_PROJECT", "").strip()
        or _metadata("project/project-id")
    )


def _access_token() -> str:
    payload = json.loads(_metadata("instance/service-accounts/default/token"))
    return str(payload["access_token"])


def queue_snapshot(queue, job_class) -> tuple[int, int]:
    """Return pending depth and age in seconds of the oldest pending RQ job."""
    depth = int(queue.count)
    if depth <= 0:
        return 0, 0
    job_ids = queue.get_job_ids(offset=0, length=1)
    if not job_ids:
        return depth, 0
    job = job_class.fetch(job_ids[0], connection=queue.connection)
    queued_at = job.enqueued_at or job.created_at
    if not queued_at:
        return depth, 0
    if queued_at.tzinfo is None:
        queued_at = queued_at.replace(tzinfo=timezone.utc)
    age = max(0, int((datetime.now(timezone.utc) - queued_at).total_seconds()))
    return depth, age


def queued_render_work_seconds(queue, job_class, fallback_seconds=120) -> int:
    """Sum shadow work estimates for the bounded pending export queue."""
    depth = int(queue.count)
    if depth <= 0:
        return 0
    job_ids = queue.get_job_ids(offset=0, length=min(depth, 100))
    total = 0
    for job_id in job_ids:
        try:
            job = job_class.fetch(job_id, connection=queue.connection)
            estimate = int((job.meta or {}).get("estimated_render_seconds") or fallback_seconds)
        except Exception:
            estimate = fallback_seconds
        total += min(3600, max(15, estimate))
    return total


def publish_queue_snapshot(
    depth: int,
    oldest_age_seconds: int,
    queue_name: str,
    worker_group: str,
    pending_work_seconds: int | None = None,
) -> None:
    """Write one global time series for each queue signal."""
    project_id = _project_id()
    timestamp = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    labels = {"queue": queue_name, "worker_group": worker_group}
    series = []
    measurements = [
        ("export_queue_depth", depth),
        ("export_oldest_job_age_seconds", oldest_age_seconds),
    ]
    if pending_work_seconds is not None:
        measurements.append(("pending_render_work_seconds", pending_work_seconds))
    for metric_name, value in measurements:
        series.append({
            "metric": {
                "type": f"custom.googleapis.com/lekha/{metric_name}",
                "labels": labels,
            },
            "resource": {"type": "global", "labels": {"project_id": project_id}},
            "points": [{
                "interval": {"endTime": timestamp},
                "value": {"int64Value": str(max(0, int(value)))},
            }],
        })
    body = json.dumps({"timeSeries": series}).encode("utf-8")
    request = urllib.request.Request(
        f"https://monitoring.googleapis.com/v3/projects/{project_id}/timeSeries",
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {_access_token()}",
            "Content-Type": "application/json",
        },
    )
    with _open_google_request(request, timeout=8) as response:
        if response.status not in (200, 201):
            raise RuntimeError(f"Monitoring write returned HTTP {response.status}")


def publish_worker_cold_start(seconds: int, worker_group: str, instance_name: str) -> None:
    project_id = _project_id()
    timestamp = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    body = json.dumps({"timeSeries": [{
        "metric": {
            "type": "custom.googleapis.com/lekha/worker_cold_start_seconds",
            "labels": {"worker_group": worker_group, "instance": instance_name},
        },
        "resource": {"type": "global", "labels": {"project_id": project_id}},
        "points": [{
            "interval": {"endTime": timestamp},
            "value": {"int64Value": str(max(0, int(seconds)))},
        }],
    }]}).encode("utf-8")
    request = urllib.request.Request(
        f"https://monitoring.googleapis.com/v3/projects/{project_id}/timeSeries",
        data=body,
        method="POST",
        headers={"Authorization": f"Bearer {_access_token()}", "Content-Type": "application/json"},
    )
    with _open_google_request(request, timeout=8) as response:
        if response.status not in (200, 201):
            raise RuntimeError(f"Monitoring write returned HTTP {response.status}")
