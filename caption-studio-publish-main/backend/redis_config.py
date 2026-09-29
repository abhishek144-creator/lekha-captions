"""One place to open Redis connections.

Works for a private Redis (Memorystore, a local container) and for serverless
Redis reached over the internet (Upstash and similar), which needs TLS and
closes idle connections.
"""

import ipaddress
import os
from urllib.parse import urlparse


def _is_private_host(host: str) -> bool:
    if host in ("", "localhost"):
        return True
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        # Bare service names ("redis") and *.internal resolve inside a private network.
        return "." not in host or host.endswith(".internal")
    return address.is_private or address.is_loopback


def validate_redis_url(url: str, production: bool) -> None:
    """Refuse a plaintext connection to a public Redis host in production."""
    if not production or not url:
        return
    parsed = urlparse(url)
    if parsed.scheme == "rediss" or _is_private_host(parsed.hostname or ""):
        return
    raise RuntimeError(
        "REDIS_URL points at a public host without TLS. Use a rediss:// URL so the "
        "Redis password and job data are encrypted in transit."
    )


def redis_client_options(**overrides) -> dict:
    options = {
        "socket_connect_timeout": 5,
        "socket_keepalive": True,
        # Serverless Redis drops idle connections; ping a connection that has
        # been idle this long before reusing it instead of failing a request.
        "health_check_interval": 30,
    }
    options.update(overrides)
    return options


def connect_redis(url: str, **overrides):
    import redis

    validate_redis_url(url, production=(os.environ.get("APP_ENV") or os.environ.get("ENV") or "").strip().lower() == "production")
    return redis.Redis.from_url(url, **redis_client_options(**overrides))
