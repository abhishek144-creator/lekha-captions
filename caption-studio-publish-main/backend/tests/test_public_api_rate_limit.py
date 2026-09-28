import os
import pathlib
import sys
import unittest
from unittest.mock import patch

from fastapi import HTTPException

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from public_api import ApiKeyRateLimiter


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
        with patch.dict(os.environ, {"ENV": "production", "REDIS_URL": ""}):
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
        with patch.dict(os.environ, {"ENV": "production", "REDIS_URL": ""}):
            missing = ApiKeyRateLimiter(2)
            broken = ApiKeyRateLimiter(2, redis_client=BrokenRedis())
        for limiter in (missing, broken):
            with self.assertRaises(HTTPException) as rejected:
                limiter.check("key-a")
            self.assertEqual(rejected.exception.status_code, 503)


if __name__ == "__main__":
    unittest.main()
