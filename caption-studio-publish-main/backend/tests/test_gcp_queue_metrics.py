from datetime import datetime, timedelta, timezone
import json
import urllib.request

from backend import gcp_queue_metrics


class _Queue:
    count = 7
    connection = object()

    @staticmethod
    def get_job_ids(offset=0, length=1):
        assert (offset, length) == (0, 1)
        return ["job-1"]


class _Job:
    enqueued_at = datetime.now(timezone.utc) - timedelta(seconds=95)
    created_at = None

    @staticmethod
    def fetch(job_id, connection):
        assert job_id == "job-1"
        assert connection is _Queue.connection
        return _Job()


def test_queue_snapshot_reports_depth_and_oldest_age():
    _Job.enqueued_at = datetime.now(timezone.utc) - timedelta(seconds=95)
    depth, age = gcp_queue_metrics.queue_snapshot(_Queue(), _Job)
    assert depth == 7
    assert 94 <= age <= 97


def test_queued_render_work_uses_job_estimates_and_bounded_fallback():
    class Queue:
        count = 2
        connection = object()

        @staticmethod
        def get_job_ids(offset=0, length=100):
            assert (offset, length) == (0, 2)
            return ["job-1", "job-2"]

    class Job:
        @staticmethod
        def fetch(job_id, connection):
            assert connection is Queue.connection
            if job_id == "job-2":
                raise KeyError(job_id)
            return type("QueuedJob", (), {"meta": {"estimated_render_seconds": 75}})()

    assert gcp_queue_metrics.queued_render_work_seconds(Queue(), Job) == 195


def test_google_request_rejects_unapproved_endpoint():
    request = urllib.request.Request("file:///tmp/metadata")
    try:
        gcp_queue_metrics._open_google_request(request, timeout=3)
    except ValueError as error:
        assert "approved Google endpoints" in str(error)
    else:
        raise AssertionError("Unapproved endpoint was accepted")


def test_publish_queue_snapshot_writes_group_metrics(monkeypatch):
    captured = {}

    class _Response:
        status = 200

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

    def _urlopen(request, timeout):
        captured["url"] = request.full_url
        captured["headers"] = dict(request.header_items())
        captured["body"] = json.loads(request.data)
        captured["timeout"] = timeout
        return _Response()

    monkeypatch.setattr(gcp_queue_metrics, "_project_id", lambda: "project-id")
    monkeypatch.setattr(gcp_queue_metrics, "_access_token", lambda: "token")
    monkeypatch.setattr(gcp_queue_metrics.urllib.request, "urlopen", _urlopen)

    gcp_queue_metrics.publish_queue_snapshot(12, 240, "exports", "worker-mig",
                                             pending_work_seconds=420)

    assert captured["url"].endswith("/projects/project-id/timeSeries")
    values = {
        item["metric"]["type"]: item["points"][0]["value"]["int64Value"]
        for item in captured["body"]["timeSeries"]
    }
    assert values["custom.googleapis.com/lekha/export_queue_depth"] == "12"
    assert values["custom.googleapis.com/lekha/export_oldest_job_age_seconds"] == "240"
    assert values["custom.googleapis.com/lekha/pending_render_work_seconds"] == "420"
    for item in captured["body"]["timeSeries"]:
        assert item["metric"]["labels"] == {
            "queue": "exports",
            "worker_group": "worker-mig",
        }
        assert item["resource"] == {
            "type": "global",
            "labels": {"project_id": "project-id"},
        }
