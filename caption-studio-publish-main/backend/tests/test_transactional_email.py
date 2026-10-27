import os
import unittest
from datetime import datetime, timezone
from unittest.mock import patch

from backend import transactional_email as email


SMTP_ENV = {
    "RESEND_API_KEY": "",
    "SMTP_HOST": "smtp.example.com",
    "SMTP_PORT": "587",
    "SMTP_USERNAME": "mailer",
    "SMTP_PASSWORD": "test-password",
    "EMAIL_FROM": "Lekha Captions <hello@example.com>",
    "EMAIL_REPLY_TO": "support@example.com",
}


class FakeSmtp:
    sent = []

    def __init__(self, host, port, timeout=None, context=None):
        self.host, self.port = host, port
        self.calls = []

    def starttls(self, context=None):
        self.calls.append("starttls")

    def login(self, username, password):
        self.calls.append(("login", username))

    def send_message(self, message):
        FakeSmtp.sent.append(message)

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


class FakeRef:
    def __init__(self, data):
        self.data = data

    def update(self, values):
        self.data.update(values)


class FakeSnapshot:
    def __init__(self, data):
        self.reference = FakeRef(data)

    def to_dict(self):
        return dict(self.reference.data)


class FakeQuery:
    def __init__(self, rows):
        self.rows, self.filters = rows, []

    def where(self, field, op, value):
        self.filters.append((field, op, value))
        return self

    def limit(self, _count):
        return self

    def stream(self):
        return iter(self.rows)


class FakeDb:
    def __init__(self, rows):
        self.query = FakeQuery(rows)

    def collection(self, name):
        assert name == "users"
        return self.query


class SendEmailTests(unittest.TestCase):
    def setUp(self):
        FakeSmtp.sent = []
        patcher = patch.object(email.smtplib, "SMTP", FakeSmtp)
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_nothing_is_sent_until_smtp_is_configured(self):
        with patch.dict(os.environ, {"RESEND_API_KEY": "", "SMTP_HOST": "", "EMAIL_FROM": ""}):
            self.assertFalse(email.email_configured())
            self.assertFalse(email.send_email("a@example.com", "Hi", "text", "<p>text</p>"))
        self.assertEqual(FakeSmtp.sent, [])

    def test_configured_send_has_reply_to_and_both_bodies(self):
        with patch.dict(os.environ, SMTP_ENV):
            self.assertTrue(email.send_email("user@example.com", *email.welcome_message("Asha")))
        message = FakeSmtp.sent[0]
        self.assertEqual(message["To"], "user@example.com")
        self.assertEqual(message["Reply-To"], "support@example.com")
        self.assertEqual(message["Subject"], "Welcome to Lekha Captions")
        self.assertIn("Hi Asha,", message.get_body(("plain",)).get_content())
        self.assertIn("/Dashboard", message.get_body(("html",)).get_content())

    def test_recipient_cannot_inject_headers(self):
        with patch.dict(os.environ, SMTP_ENV):
            self.assertFalse(email.send_email("a@example.com\r\nBcc: x@evil.test", "Hi", "t", "<p>t</p>"))
        self.assertEqual(FakeSmtp.sent, [])

    def test_smtp_failure_is_reported_not_raised(self):
        class BrokenSmtp(FakeSmtp):
            def send_message(self, message):
                raise OSError("connection reset")

        with patch.dict(os.environ, SMTP_ENV), patch.object(email.smtplib, "SMTP", BrokenSmtp):
            self.assertFalse(email.send_email("user@example.com", "Hi", "t", "<p>t</p>"))


class FakeResponse:
    def __init__(self, status_code, text=""):
        self.status_code, self.text = status_code, text


class ResendTests(unittest.TestCase):
    ENV = {**SMTP_ENV, "RESEND_API_KEY": "re_test_key"}

    def setUp(self):
        FakeSmtp.sent = []
        for patcher in (patch.object(email.smtplib, "SMTP", FakeSmtp), patch.dict(os.environ, self.ENV)):
            patcher.start()
            self.addCleanup(patcher.stop)

    def test_resend_key_alone_is_enough(self):
        with patch.dict(os.environ, {"SMTP_HOST": ""}):
            self.assertTrue(email.email_configured())

    def test_resend_is_used_instead_of_smtp(self):
        with patch.object(email.requests, "post", return_value=FakeResponse(200)) as post:
            self.assertTrue(email.send_email("user@example.com", *email.welcome_message("Asha")))
        self.assertEqual(FakeSmtp.sent, [])
        url = post.call_args.args[0]
        payload = post.call_args.kwargs["json"]
        self.assertEqual(url, "https://api.resend.com/emails")
        self.assertEqual(post.call_args.kwargs["headers"], {"Authorization": "Bearer re_test_key"})
        self.assertEqual(payload["from"], "Lekha Captions <hello@example.com>")
        self.assertEqual(payload["to"], ["user@example.com"])
        self.assertEqual(payload["reply_to"], "support@example.com")
        self.assertEqual(payload["subject"], "Welcome to Lekha Captions")
        self.assertIn("Hi Asha,", payload["text"])
        self.assertIn("/Dashboard", payload["html"])

    def test_rejected_or_unreachable_api_is_reported_not_raised(self):
        with patch.object(email.requests, "post", return_value=FakeResponse(422, "invalid from")):
            self.assertFalse(email.send_email("user@example.com", "Hi", "t", "<p>t</p>"))
        with patch.object(email.requests, "post", side_effect=OSError("timeout")):
            self.assertFalse(email.send_email("user@example.com", "Hi", "t", "<p>t</p>"))


class MessageTests(unittest.TestCase):
    def test_payment_message_lists_plan_amount_credits_and_end_date(self):
        subject, text, _html = email.payment_message(
            "creator_yearly", 4999, "usd", 540, "2027-10-27T08:00:00.000000Z", "pay_123")
        self.assertEqual(subject, "Payment received: Creator (yearly)")
        for expected in ("USD 49.99", "Credits added: 540", "27 October 2027", "pay_123"):
            self.assertIn(expected, text)

    def test_topup_has_no_end_date(self):
        _subject, text, _html = email.payment_message("topup_pro", 900, "INR", 25, None, "pay_9")
        self.assertIn("Pro top-up", text)
        self.assertNotIn("Valid until", text)

    def test_names_are_escaped_in_html(self):
        _subject, _text, html_body = email.welcome_message("<script>")
        self.assertNotIn("<script>", html_body)


class ExpiryReminderTests(unittest.TestCase):
    NOW = datetime(2026, 10, 27, 8, 0, tzinfo=timezone.utc)

    def setUp(self):
        FakeSmtp.sent = []
        for patcher in (patch.object(email.smtplib, "SMTP", FakeSmtp), patch.dict(os.environ, SMTP_ENV)):
            patcher.start()
            self.addCleanup(patcher.stop)

    def test_reminds_each_paid_plan_once_per_period(self):
        due = FakeSnapshot({"email": "due@example.com", "subscription_tier": "pro",
                            "subscription_expiry": "2026-10-29T08:00:00Z"})
        already = FakeSnapshot({"email": "done@example.com", "subscription_tier": "pro",
                                "subscription_expiry": "2026-10-29T09:00:00Z",
                                "expiry_reminder_sent_for": "2026-10-29T09:00:00Z"})
        free = FakeSnapshot({"email": "free@example.com", "subscription_tier": "free",
                             "subscription_expiry": "2026-10-29T09:00:00Z"})
        deleting = FakeSnapshot({"email": "gone@example.com", "subscription_tier": "pro",
                                 "subscription_expiry": "2026-10-29T09:00:00Z", "deletion_pending": True})
        db = FakeDb([due, already, free, deleting])
        result = email.send_expiry_reminders(db, now=self.NOW)
        self.assertEqual(result, {"sent": 1, "failed": 0})
        self.assertEqual([m["To"] for m in FakeSmtp.sent], ["due@example.com"])
        self.assertEqual(due.reference.data["expiry_reminder_sent_for"], "2026-10-29T08:00:00Z")
        self.assertEqual(db.query.filters, [
            ("subscription_expiry", ">", "2026-10-27T08:00:00Z"),
            ("subscription_expiry", "<=", "2026-10-30T08:00:00Z"),
        ])

    def test_failed_send_is_retried_on_a_later_pass(self):
        due = FakeSnapshot({"email": "due@example.com", "subscription_tier": "starter",
                            "subscription_expiry": "2026-10-29T08:00:00Z"})
        with patch.object(email, "send_email", return_value=False):
            result = email.send_expiry_reminders(FakeDb([due]), now=self.NOW)
        self.assertEqual(result, {"sent": 0, "failed": 1})
        self.assertIsNone(due.reference.data["expiry_reminder_sent_for"])

    def test_unconfigured_email_reads_nothing(self):
        with patch.dict(os.environ, {"SMTP_HOST": ""}):
            self.assertEqual(email.send_expiry_reminders(None)["sent"], 0)


if __name__ == "__main__":
    unittest.main()
