import time
import unittest
from unittest.mock import patch

from backend import firebase_admin_setup as firebase


class VerifiedTokenCacheTests(unittest.TestCase):
    def setUp(self):
        firebase._token_cache.clear()
        self.addCleanup(firebase._token_cache.clear)
        patches = [
            patch.object(firebase, "IS_TEST_ENV", False),
            patch.object(firebase, "TOKEN_CACHE_SECONDS", 60),
        ]
        for item in patches:
            item.start()
            self.addCleanup(item.stop)

    def test_repeat_polls_reuse_one_revocation_check(self):
        decoded = {"uid": "owner", "exp": time.time() + 3600}
        with patch.object(firebase.auth, "verify_id_token", return_value=decoded) as verify:
            self.assertEqual(firebase.verify_token("token-a")["uid"], "owner")
            self.assertEqual(firebase.verify_token("token-a")["uid"], "owner")
        verify.assert_called_once_with("token-a", check_revoked=True)

    def test_rejected_tokens_are_never_cached(self):
        with patch.object(firebase.auth, "verify_id_token", side_effect=ValueError("revoked")) as verify:
            self.assertIsNone(firebase.verify_token("token-b"))
            self.assertIsNone(firebase.verify_token("token-b"))
        self.assertEqual(verify.call_count, 2)

    def test_configuration_cannot_extend_revocation_cache_past_sixty_seconds(self):
        with (patch.object(firebase, "TOKEN_CACHE_SECONDS", 3600),
              patch.object(firebase.time, "monotonic", return_value=100)):
            firebase._remember_token("bounded", {"uid": "owner"})
        with patch.object(firebase.time, "monotonic", return_value=161):
            self.assertIsNone(firebase._cached_token("bounded"))

    def test_cache_never_outlives_token_expiry(self):
        decoded = {"uid": "owner", "exp": time.time() - 1}
        with patch.object(firebase.auth, "verify_id_token", return_value=decoded) as verify:
            firebase.verify_token("token-c")
            firebase.verify_token("token-c")
        self.assertEqual(verify.call_count, 2)

    def test_callers_cannot_mutate_the_cached_claims(self):
        decoded = {"uid": "owner", "exp": time.time() + 3600}
        with patch.object(firebase.auth, "verify_id_token", return_value=decoded):
            firebase.verify_token("token-d")["uid"] = "attacker"
            self.assertEqual(firebase.verify_token("token-d")["uid"], "owner")

    def test_verified_requests_name_the_account_on_error_reports(self):
        decoded = {"uid": "owner", "email": "owner@example.com", "exp": time.time() + 3600}
        with (patch.object(firebase.auth, "verify_id_token", return_value=decoded),
              patch.object(firebase.optional_deps, "sentry_sdk") as sentry):
            firebase.verify_token("token-e")
            firebase.verify_token("token-e")
        self.assertEqual(sentry.set_user.call_count, 2)
        sentry.set_user.assert_called_with({"id": "owner"})

    def test_rejected_tokens_name_no_account(self):
        with (patch.object(firebase.auth, "verify_id_token", side_effect=ValueError("revoked")),
              patch.object(firebase.optional_deps, "sentry_sdk") as sentry):
            firebase.verify_token("token-f")
        sentry.set_user.assert_not_called()


if __name__ == "__main__":
    unittest.main()
