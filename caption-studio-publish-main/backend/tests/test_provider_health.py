import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from provider_health import ProviderCircuitBreaker


class ProviderHealthTests(unittest.TestCase):
    def test_opens_then_allows_one_half_open_probe_and_recovers(self):
        now = [100.0]
        breaker = ProviderCircuitBreaker(failure_threshold=2, cooldown_seconds=10, clock=lambda: now[0])
        breaker._redis = None

        self.assertTrue(breaker.allow_request("sarvam"))
        breaker.record_failure("sarvam")
        self.assertTrue(breaker.allow_request("sarvam"))
        breaker.record_failure("sarvam")
        self.assertFalse(breaker.allow_request("sarvam"))
        self.assertEqual(breaker.snapshot()["sarvam"]["status"], "open")

        now[0] = 111.0
        self.assertTrue(breaker.allow_request("sarvam"))
        self.assertFalse(breaker.allow_request("sarvam"))
        breaker.record_success("sarvam")
        self.assertTrue(breaker.allow_request("sarvam"))
        self.assertEqual(breaker.snapshot()["sarvam"]["status"], "healthy")


if __name__ == "__main__":
    unittest.main()
