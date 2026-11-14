"""Bounded management reads, account-scoped cursors and shared creation limits."""
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
import pathlib
import sys
import unittest

import fakeredis
from fastapi import FastAPI, HTTPException, Request
from fastapi.testclient import TestClient

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import main
from pagination import collection_page


class Collection:
    def __init__(self, rows, trace=None, start=0):
        self.rows = rows
        self.trace = trace if trace is not None else []
        self.start = start
        self.maximum = None

    def order_by(self, field, direction):
        return Collection(sorted(self.rows, key=lambda row: row[1][field], reverse=True), self.trace)

    def document(self, identifier):
        found = next((row for row in self.rows if row[0] == identifier), None)
        return SimpleNamespace(get=lambda: SimpleNamespace(id=identifier, exists=found is not None))

    def start_after(self, snapshot):
        position = next(i for i, row in enumerate(self.rows) if row[0] == snapshot.id)
        return Collection(self.rows, self.trace, position + 1)

    def limit(self, maximum):
        self.maximum = maximum
        return self

    def stream(self):
        if self.maximum is None:
            raise AssertionError("Unbounded collection read")
        self.trace.append(self.maximum)
        return [SimpleNamespace(id=identifier, to_dict=lambda data=data: dict(data))
                for identifier, data in self.rows[self.start:self.start + self.maximum]]


class ResourceBoundaryTests(unittest.TestCase):
    def setUp(self):
        self.collection = Collection([(f"key-{i}", {"created_at": i, "uid": "alice", "key_hash": "private-hash"}) for i in range(5)])

    def test_pages_are_bounded_and_traverse_without_missing_or_repeating_items(self):
        cursor = ""
        identifiers = []
        while True:
            rows, page = collection_page(self.collection, 2, cursor, "created_at")
            identifiers.extend(row.id for row in rows)
            if not page["has_more"]:
                self.assertIsNone(page["next_cursor"])
                break
            cursor = page["next_cursor"]
        self.assertEqual(identifiers, [f"key-{i}" for i in reversed(range(5))])
        self.assertEqual(self.collection.trace, [3, 3, 3])

    def test_invalid_or_other_account_cursor_cannot_escape_the_owned_collection(self):
        for cursor in ("other-account-key", "../key", "x/y", "x\\y"):
            with self.subTest(cursor=cursor), self.assertRaises(HTTPException) as error:
                collection_page(self.collection, 2, cursor, "created_at")
            self.assertEqual(error.exception.status_code, 400)
        self.assertEqual(self.collection.trace, [])

    def test_key_list_http_response_removes_private_fields_and_enforces_page_size(self):
        db = MagicMock()
        db.collection.return_value.document.return_value.collection.return_value = self.collection
        app = FastAPI()
        app.include_router(main.create_public_api_router(
            authenticate_request=lambda request: {"uid": "alice"},
            get_database=lambda: db,
            list_account_projects=lambda database, uid: [],
            read_account_project=lambda database, uid, project: {},
            load_export_job=lambda job: {},
        ))
        client = TestClient(app)
        first = client.get("/api/developer/api-keys?limit=2")
        self.assertEqual(first.status_code, 200, first.text)
        data = first.json()
        self.assertEqual(len(data["keys"]), 2)
        self.assertTrue(data["has_more"])
        self.assertEqual(data["next_cursor"], "key-3")
        self.assertTrue(all("key_hash" not in key and "uid" not in key for key in data["keys"]))
        self.assertEqual(client.get("/api/developer/api-keys?limit=101").status_code, 422)
        self.assertEqual(client.get("/api/developer/api-keys?cursor=bobs-key").status_code, 400)
        db.collection.return_value.document.assert_called_with("alice")

    def test_resource_creation_is_rejected_before_any_database_write(self):
        for path in ("/api/workspaces", "/api/developer/api-keys"):
            with (
                self.subTest(path=path),
                patch.object(main.request_security, "_authenticate_bearer_request", return_value={"uid": "alice"}),
                patch.object(main.request_guards, "_check_rate", return_value=(False, 60, 0)),
                patch.object(main.firebase_admin_setup, "get_db") as database,
            ):
                response = TestClient(main.app).post(path, json={"name": "test"})
                self.assertEqual(response.status_code, 429)
                self.assertEqual(response.headers["retry-after"], "60")
                database.assert_not_called()

    def test_creation_routes_share_one_atomic_account_budget(self):
        shared = fakeredis.FakeRedis(decode_responses=True)
        paths = ["/api/workspaces", "/api/developer/api-keys", "/api/workspaces/ws-a/invites"]
        with (
            patch.object(main.request_security, "_authenticate_bearer_request", return_value={"uid": "alice"}),
            patch.object(main.settings, "_IS_PRODUCTION", True),
            patch.object(main.app_state, "_redis_client", shared),
        ):
            for i in range(60):
                request = Request({"type": "http", "method": "POST", "path": paths[i % 3], "headers": [], "client": ("203.0.113.9", 123)})
                main._authenticate_resource_management_request(request)
            with self.assertRaises(HTTPException) as error:
                main._authenticate_resource_management_request(request)
            self.assertEqual(error.exception.status_code, 429)

    def test_autosave_does_not_consume_the_hourly_resource_creation_budget(self):
        request = Request({"type": "http", "method": "PUT", "path": "/api/workspaces/ws-a/projects", "headers": []})
        with (
            patch.object(main.request_security, "_authenticate_bearer_request", return_value={"uid": "alice"}),
            patch.object(main.request_guards, "_check_rate") as rate,
        ):
            main._authenticate_resource_management_request(request)
        rate.assert_not_called()
