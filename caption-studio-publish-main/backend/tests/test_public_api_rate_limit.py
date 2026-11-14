import os
import pathlib
import sys
import unittest
from unittest.mock import patch

from fastapi import HTTPException

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from public_api import ApiKeyRateLimiter
import public_api


class SharedRedis:
    def __init__(self):
        self.events = {}

    def eval(self, script, key_count, key, now, limit, nonce):
        assert key_count == 1
        assert "ZREMRANGEBYSCORE" in script and "ZADD" in script
        recent = [value for value in self.events.get(key, []) if value > now - 3600]
        self.events[key] = recent
        if len(recent) >= limit:
            return 0
        recent.append(now)
        return 1


class BrokenRedis:
    def eval(self, *args):
        raise ConnectionError("Redis unavailable")


class ApiKeyRateLimitTests(unittest.TestCase):
    def test_instances_share_a_rolling_key_limit(self):
        shared = SharedRedis()
        with patch.object(public_api.settings, "_IS_PRODUCTION", True), patch.dict(os.environ, {"REDIS_URL": ""}):
            first = ApiKeyRateLimiter(2, redis_client=shared)
            second = ApiKeyRateLimiter(2, redis_client=shared)
        with patch("public_api.time.time", return_value=10000):
            first.check("key-a")
            second.check("key-a")
            with self.assertRaises(HTTPException) as rejected:
                first.check("key-a")
            self.assertEqual(rejected.exception.status_code, 429)
            second.check("key-b")
        with patch("public_api.time.time", return_value=13601):
            first.check("key-a")

    def test_production_fails_closed_when_redis_is_unavailable(self):
        with patch.object(public_api.settings, "_IS_PRODUCTION", True), patch.dict(os.environ, {"APP_ENV": "production", "ENV": "", "REDIS_URL": ""}):
            missing = ApiKeyRateLimiter(2)
            broken = ApiKeyRateLimiter(2, redis_client=BrokenRedis())
        for limiter in (missing, broken):
            with self.assertRaises(HTTPException) as rejected:
                limiter.check("key-a")
            self.assertEqual(rejected.exception.status_code, 503)

    def test_runtime_mode_uses_the_canonical_setting_not_a_conflicting_env_alias(self):
        with patch.object(public_api.settings, "_IS_PRODUCTION", False), patch.dict(os.environ, {"APP_ENV": "development", "ENV": "production", "REDIS_URL": ""}):
            limiter = ApiKeyRateLimiter(1, redis_client=BrokenRedis())
        limiter.check("key-a")
        with self.assertRaises(HTTPException) as rejected:
            limiter.check("key-a")
        self.assertEqual(rejected.exception.status_code, 429)


if __name__ == "__main__":
    unittest.main()
