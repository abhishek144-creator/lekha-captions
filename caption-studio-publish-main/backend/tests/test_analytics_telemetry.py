import pathlib
import re
import sys
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from google.api_core import exceptions as google_api_exceptions

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import main
import observability
import settings

SOURCE_ROOT = pathlib.Path(__file__).resolve().parents[2] / "src"


class AnalyticsTrackInputTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(main.app)
        self.rate = patch.object(main.request_guards, "_check_rate", return_value=(True, 0, 100))
        self.track = patch.object(main.observability, "_track_event")
        self.rate.start()
        self.tracked = self.track.start()

    def tearDown(self):
        self.track.stop()
        self.rate.stop()

    def post(self, body, **kwargs):
        return self.client.post("/api/analytics/track", json=body, **kwargs)

    def test_known_event_keeps_only_flat_scalar_fields(self):
        response = self.post({"event": "funnel.upload.success", "payload": {
            "stage": "upload",
            "rttMs": 120,
            "downlinkMbps": 1.5,
            "online": True,
            "fileId": None,
            "nested": [[1]],
            "object": {"a": 1},
            "bad key": "x",
            "description": "x" * 5_000,
        }})

        self.assertEqual(response.status_code, 200)
        self.tracked.assert_called_once()
        event, payload = self.tracked.call_args.args
        self.assertEqual(event, "funnel.upload.success")
        self.assertEqual(set(payload), {"stage", "rttMs", "downlinkMbps", "online", "fileId", "description"})
        self.assertEqual(len(payload["description"]), settings.ANALYTICS_MAX_STRING_CHARS)

    def test_field_count_is_capped(self):
        fields = {f"field{index}": index for index in range(100)}
        self.post({"event": "perf.lcp", "payload": fields})
        self.assertEqual(len(self.tracked.call_args.args[1]), settings.ANALYTICS_MAX_PAYLOAD_FIELDS)

    def test_unlisted_event_is_counted_under_one_name_without_its_payload(self):
        response = self.post({"event": "attacker.event.123", "payload": {"a": [[1]]}})

        self.assertEqual(response.status_code, 200)
        self.tracked.assert_called_once_with(settings.UNLISTED_CLIENT_ANALYTICS_EVENT, {"name": "attacker.event.123"})

    def test_reserved_and_malformed_events_are_refused(self):
        self.assertEqual(self.post({"event": "export_success"}).status_code, 400)
        self.assertEqual(self.post({"event": ["perf.lcp"]}).status_code, 400)
        self.assertEqual(self.post({"event": "perf.lcp", "payload": [1]}).status_code, 400)
        self.assertEqual(self.post(["perf.lcp"]).status_code, 400)
        self.tracked.assert_not_called()

    def test_oversized_body_is_refused_before_tracking(self):
        large = {"event": "perf.lcp", "payload": {"stage": "x" * (settings.ANALYTICS_MAX_BODY_BYTES + 1)}}
        self.assertEqual(self.post(large).status_code, 413)

        streamed = self.client.post(
            "/api/analytics/track",
            content=iter([b'{"event":"perf.lcp","payload":{"s":"', b"x" * (settings.ANALYTICS_MAX_BODY_BYTES + 1), b'"}}']),
            headers={"content-type": "application/json"},
        )
        self.assertEqual(streamed.status_code, 413)
        self.tracked.assert_not_called()

    def test_every_browser_event_name_is_listed(self):
        names = set()
        for path in SOURCE_ROOT.rglob("*.js*"):
            if "__tests__" in path.parts:
                continue
            text = path.read_text(encoding="utf-8")
            names.update(re.findall(r"trackAnalytics\(\s*['\"]([^'\"]+)['\"]", text))
            names.update(re.findall(r"event:\s*['\"](frontend\.[a-z_.]+)['\"]", text))
        self.assertIn("frontend.exception", names)
        self.assertEqual(names - settings.CLIENT_ANALYTICS_EVENTS, set())


class _Document:
    def __init__(self, database, collection_name):
        self.database, self.collection_name = database, collection_name

    def set(self, payload):
        self.database.write(self.collection_name, payload)


class _Collection:
    def __init__(self, database, name):
        self.database, self.name = database, name

    def document(self):
        return _Document(self.database, self.name)


class _Batch:
    def __init__(self, database):
        self.database, self.rows = database, []

    def set(self, document, payload):
        self.rows.append((document.collection_name, payload))

    def commit(self):
        for _collection, payload in self.rows:
            self.database.check(payload)
        self.database.stored.extend(self.rows)


class _Database:
    def __init__(self, unavailable=False):
        self.unavailable = unavailable
        self.stored = []

    def collection(self, name):
        return _Collection(self, name)

    def batch(self):
        return _Batch(self)

    def check(self, payload):
        if self.unavailable:
            raise google_api_exceptions.ServiceUnavailable("firestore down")
        if payload.get("poison"):
            raise google_api_exceptions.InvalidArgument("Cannot convert an array value in an array value.")

    def write(self, collection_name, payload):
        self.check(payload)
        self.stored.append((collection_name, payload))


class TelemetryFlushTests(unittest.TestCase):
    def setUp(self):
        with main.app_state._telemetry_lock:
            main.app_state._telemetry_buffer.clear()

    tearDown = setUp

    def queue(self, *rows):
        with main.app_state._telemetry_lock:
            main.app_state._telemetry_buffer.extend(rows)

    def buffered(self):
        with main.app_state._telemetry_lock:
            return list(main.app_state._telemetry_buffer)

    def test_a_rejected_row_is_dropped_and_audit_logs_still_persist(self):
        database = _Database()
        self.queue(
            ("analytics_events", {"event": "perf.lcp", "poison": [[1]]}),
            ("audit_logs", {"action": "verify_payment_attempt"}),
            ("analytics_events", {"event": "perf.cls"}),
        )

        with patch.object(observability.firebase_admin_setup, "get_db", return_value=database):
            written = observability._flush_telemetry()
            self.assertEqual(observability._flush_telemetry(), 0)

        self.assertEqual(written, 2)
        self.assertEqual([row[0] for row in database.stored], ["audit_logs", "analytics_events"])
        self.assertEqual(self.buffered(), [])

    def test_rows_are_kept_in_order_while_firestore_is_unavailable(self):
        rows = [("audit_logs", {"action": "one"}), ("analytics_events", {"event": "two"})]
        self.queue(*rows)

        with patch.object(observability.firebase_admin_setup, "get_db", return_value=_Database(unavailable=True)):
            self.assertEqual(observability._flush_telemetry(), 0)

        self.assertEqual(self.buffered(), rows)

    def test_rows_after_a_transient_failure_wait_for_the_next_flush(self):
        rows = [
            ("analytics_events", {"event": "bad", "poison": True}),
            ("audit_logs", {"action": "kept"}),
        ]
        database = _Database()
        original_write = database.write
        calls = []

        def write(collection_name, payload):
            calls.append(payload)
            if payload.get("action") == "kept" and len(calls) == 2:
                raise google_api_exceptions.DeadlineExceeded("slow")
            original_write(collection_name, payload)

        database.write = write
        self.queue(*rows)

        with patch.object(observability.firebase_admin_setup, "get_db", return_value=database):
            self.assertEqual(observability._flush_telemetry(), 0)
            self.assertEqual(self.buffered(), [rows[1]])
            self.assertEqual(observability._flush_telemetry(), 1)

        self.assertEqual(database.stored, [rows[1]])


if __name__ == "__main__":
    unittest.main()
