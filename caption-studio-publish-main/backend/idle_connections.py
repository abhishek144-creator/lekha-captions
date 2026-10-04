"""Release unused Redis sockets so server keepalives cannot prevent Railway sleep."""
import logging
import os


def disconnect_idle_redis_clients(*clients):
    seen = set()
    for client in clients:
        pool = getattr(client, "connection_pool", None)
        if pool is None or id(pool) in seen:
            continue
        seen.add(id(pool))
        try:
            # Concurrent requests and worker commands keep their checked-out sockets.
            # Redis reconnects an available socket lazily on its next command.
            pool.disconnect(inuse_connections=False)
        except Exception as error:
            logging.getLogger(__name__).warning(
                "idle_redis_disconnect_failed: %s", type(error).__name__
            )


class RailwayIdleConnectionsMiddleware:
    def __init__(self, app, clients):
        self.app = app
        self.clients = clients

    async def __call__(self, scope, receive, send):
        try:
            await self.app(scope, receive, send)
        finally:
            # Runs after the response body and background tasks, including errors
            # and early authentication rejections. No periodic idle loop is needed.
            if scope["type"] == "http" and os.environ.get("RAILWAY_PROJECT_ID"):
                disconnect_idle_redis_clients(*self.clients())
