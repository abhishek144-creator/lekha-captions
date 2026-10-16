import os
import sys
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import main
from main import app
import email_policy


class EmailPolicyTests(unittest.TestCase):
    def test_detects_disposable_domains_and_their_subdomains(self):
        self.assertTrue(email_policy.is_disposable_email("someone@mailinator.com"))
        self.assertTrue(email_policy.is_disposable_email("Someone@YOPMAIL.com"))
        self.assertTrue(email_policy.is_disposable_email("x@inbox.guerrillamail.com"))
        self.assertFalse(email_policy.is_disposable_email("person@gmail.com"))
        self.assertFalse(email_policy.is_disposable_email("person@company.co.in"))
        # Only whole labels match: a lookalike domain is not a subdomain.
        self.assertFalse(email_policy.is_disposable_email("a@xmailinator.com"))
        self.assertFalse(email_policy.is_disposable_email("not-an-email"))

    def test_signup_rejection_reasons(self):
        google = {"firebase": {"sign_in_provider": "google.com"}, "email_verified": True}
        self.assertIsNone(email_policy.signup_rejection({**google, "email": "user@gmail.com"}))
        self.assertIn("Temporary", email_policy.signup_rejection({**google, "email": "user@temp-mail.org"}))
        self.assertIn("verify", email_policy.signup_rejection({
            "email": "user@example.com", "email_verified": False,
        }))
        self.assertIn("email address", email_policy.signup_rejection({"firebase": {"sign_in_provider": "phone"}}))
        anonymous = {"firebase": {"sign_in_provider": "anonymous"}}
        self.assertIn("Google", email_policy.signup_rejection(anonymous))
        with patch.object(email_policy.settings, "ALLOW_ANONYMOUS_SIGNUP", True):
            self.assertIsNone(email_policy.signup_rejection(anonymous))


class AccountBootstrapEmailPolicyTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def _post_new_account(self, token_claims):
        class MissingSnapshot:
            exists = False

        class FakeUserRef:
            def get(self):
                return MissingSnapshot()

            def create(self, _data):
                raise AssertionError("a refused signup must not create an account")

        fake_db = SimpleNamespace(
            collection=lambda _name: SimpleNamespace(document=lambda _uid: FakeUserRef()),
        )
        with (
            patch.object(main.firebase_admin_setup, "verify_token", return_value=token_claims),
            patch.object(main.firebase_admin_setup, "get_db", return_value=fake_db),
            patch.object(main.request_guards, "_check_rate", return_value=(True, 0, 1)),
        ):
            return self.client.post("/api/account-bootstrap", json={"id_token": "token-123"})

    def test_disposable_email_cannot_create_an_account(self):
        response = self._post_new_account({
            "uid": "temp-user",
            "email": "farm@yopmail.com",
            "email_verified": True,
            "firebase": {"sign_in_provider": "google.com"},
        })
        self.assertEqual(response.status_code, 403)
        detail = response.json()["detail"]
        self.assertEqual(detail["code"], email_policy.REJECTION_CODE)
        self.assertIn("disposable", detail["message"])

    def test_anonymous_session_cannot_create_an_account_by_default(self):
        response = self._post_new_account({
            "uid": "anon-user",
            "firebase": {"sign_in_provider": "anonymous"},
        })
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["detail"]["code"], email_policy.REJECTION_CODE)


if __name__ == "__main__":
    unittest.main()
