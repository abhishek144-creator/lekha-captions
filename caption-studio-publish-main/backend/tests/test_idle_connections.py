import asyncio
import os
import unittest
from unittest.mock import Mock, patch

import fakeredis
from backend.idle_connections import disconnect_idle_redis_clients, RailwayIdleConnectionsMiddleware


class IdleConnectionTests(unittest.TestCase):
    def test_disconnect_preserves_checked_out_connections_and_reconnects(self):
        client = fakeredis.FakeRedis(server=fakeredis.FakeServer())
        client.set("value", "retained")
        active = client.connection_pool.get_connection()
        client.get("value")
        available = list(client.connection_pool._available_connections)
        self.assertTrue(active._sock)
        disconnect_idle_redis_clients(client)
        self.assertTrue(active._sock, "a concurrent command must retain its socket")
        self.assertTrue(all(conn._sock is None for conn in available))
        self.assertEqual(client.get("value"), b"retained")
        client.connection_pool.release(active)
        client.close()

    def test_one_broken_pool_does_not_skip_other_pools(self):
        broken, healthy = Mock(), Mock()
        broken.connection_pool.disconnect.side_effect = RuntimeError("closed")
        disconnect_idle_redis_clients(None, broken, healthy, healthy)
        healthy.connection_pool.disconnect.assert_called_once_with(inuse_connections=False)

    def test_http_cleanup_runs_after_response_completion(self):
        order = []
        async def app(scope, receive, send):
            await send({"type": "http.response.start", "status": 200, "headers": []})
            await send({"type": "http.response.body", "body": b"done"})
            order.append("response_complete")
        async def send(message):
            order.append(message["type"])
        client = Mock()
        client.connection_pool.disconnect.side_effect = lambda **kwargs: order.append("disconnect")
        middleware = RailwayIdleConnectionsMiddleware(app, lambda: (client,))
        with patch.dict(os.environ, {"RAILWAY_PROJECT_ID": "test-project"}):
            asyncio.run(middleware({"type": "http"}, None, send))
        self.assertEqual(order[-2:], ["response_complete", "disconnect"])

    def test_cleanup_also_runs_after_an_exception(self):
        async def app(scope, receive, send):
            raise RuntimeError("request failed")
        client = Mock()
        middleware = RailwayIdleConnectionsMiddleware(app, lambda: (client,))
        with patch.dict(os.environ, {"RAILWAY_PROJECT_ID": "test-project"}):
            with self.assertRaises(RuntimeError):
                asyncio.run(middleware({"type": "http"}, None, None))
        client.connection_pool.disconnect.assert_called_once_with(inuse_connections=False)

    def test_other_hosts_and_non_http_scopes_keep_connections(self):
        async def app(scope, receive, send):
            pass
        clients = Mock()
        middleware = RailwayIdleConnectionsMiddleware(app, clients)
        with patch.dict(os.environ, {"RAILWAY_PROJECT_ID": ""}):
            asyncio.run(middleware({"type": "http"}, None, None))
        with patch.dict(os.environ, {"RAILWAY_PROJECT_ID": "test-project"}):
            asyncio.run(middleware({"type": "lifespan"}, None, None))
        clients.assert_not_called()
