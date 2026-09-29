import os
import unittest
from unittest.mock import patch

from backend.redis_config import connect_redis, redis_client_options, validate_redis_url


class RedisConfigTests(unittest.TestCase):
    def test_production_rejects_plaintext_public_redis(self):
        with self.assertRaises(RuntimeError):
            validate_redis_url("redis://default:redacted-3a50a51e6aeb@example.invalid:6379", production=True)

    def test_production_accepts_tls_and_private_hosts(self):
        for url in (
            "rediss://default:redacted-3a50a51e6aeb@example.invalid:6379",
            "redis://10.20.0.3:6379",
            "redis://127.0.0.1:6379/0",
            "redis://localhost:6379",
            "redis://redis:6379",
            "redis://cache.internal:6379",
        ):
            validate_redis_url(url, production=True)

    def test_development_allows_any_url(self):
        validate_redis_url("redis://public.example.com:6379", production=False)

    def test_options_keep_idle_connections_healthy(self):
        options = redis_client_options(socket_timeout=5)
        self.assertEqual(options["health_check_interval"], 30)
        self.assertTrue(options["socket_keepalive"])
        self.assertEqual(options["socket_timeout"], 5)

    def test_connect_passes_tls_url_and_options(self):
        with patch.dict(os.environ, {"APP_ENV": "production"}), \
                patch("redis.Redis.from_url") as from_url:
            connect_redis("rediss://default:redacted-3a50a51e6aeb@example.invalid:6379", decode_responses=True)
        url, = from_url.call_args.args
        self.assertTrue(url.startswith("rediss://"))
        self.assertTrue(from_url.call_args.kwargs["decode_responses"])
        self.assertEqual(from_url.call_args.kwargs["health_check_interval"], 30)

    def test_connect_refuses_plaintext_public_url_in_production(self):
        with patch.dict(os.environ, {"APP_ENV": "production"}), \
                patch("redis.Redis.from_url") as from_url:
            with self.assertRaises(RuntimeError):
                connect_redis("redis://default:redacted-3a50a51e6aeb@example.invalid:6379")
        from_url.assert_not_called()


if __name__ == "__main__":
    unittest.main()
