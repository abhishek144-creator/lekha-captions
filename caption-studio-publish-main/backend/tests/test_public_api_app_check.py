"""Exercise server SDK routes through the application's actual HTTP middleware."""
import pathlib
import sys
import unittest
from unittest.mock import MagicMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import main
import public_api


class PublicApiAppCheckTests(unittest.TestCase):
    def setUp(self):
        self.key = 'lk_live_' + 'isolated-test-key'
        self.record = {'uid': 'alice', 'scopes': ['projects:read', 'exports:read']}
        database = MagicMock()
        def lookup(key_hash):
            snapshot = MagicMock()
            snapshot.exists = key_hash == public_api._hash_key(self.key)
            snapshot.to_dict.return_value = self.record
            return MagicMock(get=lambda: snapshot)
        database.collection.return_value.document.side_effect = lookup
        self.owners = []
        app = FastAPI()
        app.middleware('http')(main.request_logging_middleware)
        app.include_router(public_api.create_public_api_router(
            authenticate_request=lambda request: {'uid': 'alice'},
            get_database=lambda: database,
            list_account_projects=lambda db, uid: self.owners.append(uid) or [{'project_id': uid + '-project'}],
            read_account_project=lambda db, uid, project_id: {'draft': {'owner': uid}} if project_id == uid + '-project' else {},
            load_export_job=lambda job_id: {'uid': 'bob' if job_id == 'bob-export' else 'alice', 'status': 'completed'},
        ))
        self.client = TestClient(app)
        enforcement = patch.object(main.request_security.settings, 'FIREBASE_APP_CHECK_ENFORCED', True)
        enforcement.start()
        self.addCleanup(enforcement.stop)

    def test_server_sdk_reads_succeed_without_browser_attestation(self):
        for path in ('/api/v1/projects', '/api/v1/projects/alice-project', '/api/v1/exports/alice-export'):
            response = self.client.get(path, headers={'X-API-Key': self.key})
            self.assertEqual(response.status_code, 200, response.text)
            self.assertEqual(response.headers['x-content-type-options'], 'nosniff')
        self.assertEqual(self.owners, ['alice'])

    def test_key_scope_revocation_and_owner_boundaries_remain_required(self):
        for key in ('', 'lk_live_invalid'):
            self.assertEqual(self.client.get('/api/v1/projects', headers={'X-API-Key': key}).status_code, 401)
        self.assertEqual(self.client.get('/api/v1/exports/bob-export', headers={'X-API-Key': self.key}).status_code, 403)
        self.assertEqual(self.client.get('/api/v1/projects/bob-project', headers={'X-API-Key': self.key}).status_code, 404)
        self.record['scopes'] = ['projects:read']
        self.assertEqual(self.client.get('/api/v1/exports/alice-export', headers={'X-API-Key': self.key}).status_code, 403)
        self.record['revoked_at'] = 1
        self.assertEqual(self.client.get('/api/v1/projects', headers={'X-API-Key': self.key}).status_code, 401)

    def test_browser_key_management_and_future_write_routes_still_require_app_check(self):
        for method, path in [('GET', '/api/developer/api-keys'), ('POST', '/api/developer/api-keys'),
                             ('DELETE', '/api/developer/api-keys/key'), ('POST', '/api/v1/projects'),
                             ('GET', '/api/v1/projects/alice-project/private')]:
            response = self.client.request(method, path, headers={'X-API-Key': self.key})
            self.assertEqual(response.status_code, 403, response.text)
            self.assertIn('security verification', response.text)
