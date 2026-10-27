"""Service emails: welcome, payment confirmation and plan-expiry reminder.

Sent through Resend's HTTPS API when RESEND_API_KEY is set, otherwise over SMTP
(any provider, e.g. Spacemail). Railway's Hobby plan blocks outbound SMTP, so
production uses Resend until the workspace moves to Pro. Nothing is sent until
EMAIL_FROM and one of RESEND_API_KEY / SMTP_HOST are set. A failed send is
logged and never breaks the sign-up, payment or cron pass that triggered it.

Environment: EMAIL_FROM ("Lekha Captions <hello@example.com>"), RESEND_API_KEY,
or SMTP_HOST, SMTP_PORT (587 STARTTLS, 465 TLS), SMTP_USERNAME, SMTP_PASSWORD;
EMAIL_REPLY_TO and APP_PUBLIC_URL are optional.
"""

import html
import os
import smtplib
import ssl
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from email.utils import formataddr, parseaddr

import requests

try:
    from . import observability
except ImportError:  # Direct execution from backend/ remains supported.
    import observability


EXPIRY_REMINDER_DAYS = 3
EXPIRY_REMINDER_BATCH = 200
RESEND_API_URL = "https://api.resend.com/emails"
_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="email")


def _config():
    return {
        "resend_key": os.environ.get("RESEND_API_KEY", "").strip(),
        "host": os.environ.get("SMTP_HOST", "").strip(),
        "port": int(os.environ.get("SMTP_PORT", "587") or 587),
        "username": os.environ.get("SMTP_USERNAME", "").strip(),
        "password": os.environ.get("SMTP_PASSWORD", ""),
        "sender": os.environ.get("EMAIL_FROM", "").strip(),
        "reply_to": os.environ.get("EMAIL_REPLY_TO", "").strip(),
        "site": (os.environ.get("APP_PUBLIC_URL", "").strip() or "https://lekhacaptions.com").rstrip("/"),
    }


def email_configured() -> bool:
    config = _config()
    return bool(config["sender"] and (config["resend_key"] or config["host"]))


def _valid_address(value) -> str:
    address = parseaddr(str(value or ""))[1]
    # Header injection guard: a recipient can never carry its own headers.
    if not address or "@" not in address or any(ch in address for ch in "\r\n,;"):
        return ""
    return address[:320]


def plan_label(plan_id: str) -> str:
    plan_id = str(plan_id or "")
    if plan_id.startswith("topup_"):
        return f"{plan_id[6:].title()} top-up"
    base, _, period = plan_id.partition("_")
    return f"{base.title()} (yearly)" if period == "yearly" else base.title()


def _format_amount(amount_minor, currency) -> str:
    return f"{(currency or 'INR').upper()} {int(amount_minor or 0) / 100:,.2f}"


def _format_date(iso_value) -> str:
    try:
        moment = datetime.fromisoformat(str(iso_value).replace("Z", "+00:00"))
    except ValueError:
        return str(iso_value or "")
    return moment.strftime("%d %B %Y")


def _render(paragraphs, action_label, action_url):
    text = "\n\n".join([*paragraphs, f"{action_label}: {action_url}", "— Lekha Captions"])
    body = "".join(f"<p>{html.escape(item)}</p>" for item in paragraphs)
    page = (
        '<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#111;max-width:560px">'
        f"{body}"
        f'<p><a href="{html.escape(action_url)}" style="display:inline-block;background:#F5A623;color:#111;'
        f'padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">{html.escape(action_label)}</a></p>'
        '<p style="color:#666">— Lekha Captions</p></div>'
    )
    return text, page


def welcome_message(name: str):
    site = _config()["site"]
    greeting = f"Hi {name}," if name else "Hi,"
    return ("Welcome to Lekha Captions", *_render([
        greeting,
        "Thanks for signing up. Upload a video, get accurate captions in your language, and style them with animated templates.",
        "Your free credits are ready to use.",
    ], "Open the editor", f"{site}/Dashboard"))


def payment_message(plan_id, amount_minor, currency, credits, cycle_end, payment_id):
    site = _config()["site"]
    lines = [
        "Thank you, your payment was successful.",
        f"Plan: {plan_label(plan_id)}",
        f"Amount: {_format_amount(amount_minor, currency)}",
        f"Credits added: {int(credits or 0)}",
    ]
    if cycle_end:
        lines.append(f"Valid until: {_format_date(cycle_end)}")
    lines.append(f"Payment reference: {payment_id}")
    return (f"Payment received: {plan_label(plan_id)}", *_render(
        lines, "View your account", f"{site}/UserAccount"))


def expiry_message(plan_id, expiry_iso):
    site = _config()["site"]
    return (f"Your {plan_label(plan_id)} plan ends on {_format_date(expiry_iso)}", *_render([
        f"Your {plan_label(plan_id)} plan ends on {_format_date(expiry_iso)}.",
        "Plans do not renew automatically. Renew before then to keep your plan's credits and export features.",
    ], "Renew your plan", f"{site}/UserAccount"))


def _send_with_resend(config, recipient, subject, text, html_body) -> bool:
    payload = {"from": config["sender"], "to": [recipient], "subject": subject, "text": text, "html": html_body}
    if _valid_address(config["reply_to"]):
        payload["reply_to"] = config["reply_to"]
    try:
        response = requests.post(
            RESEND_API_URL,
            json=payload,
            headers={"Authorization": f"Bearer {config['resend_key']}"},
            timeout=15,
        )
    except Exception as error:
        observability._json_log("warning", "email_send_failed", provider="resend", subject=subject,
                                error=type(error).__name__)
        return False
    if response.status_code >= 300:
        observability._json_log("warning", "email_send_failed", provider="resend", subject=subject,
                                status_code=response.status_code, error=(response.text or "")[:200])
        return False
    observability._json_log("info", "email_sent", provider="resend", subject=subject)
    return True


def send_email(to, subject, text, html_body) -> bool:
    """Sends one email now. Returns False (and logs) instead of raising."""
    config = _config()
    recipient = _valid_address(to)
    if not email_configured():
        observability._json_log("info", "email_skipped_unconfigured", subject=subject)
        return False
    if not recipient:
        observability._json_log("warning", "email_skipped_invalid_recipient", subject=subject)
        return False
    if config["resend_key"]:
        return _send_with_resend(config, recipient, subject, text, html_body)
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = config["sender"]
    message["To"] = formataddr(("", recipient))
    if _valid_address(config["reply_to"]):
        message["Reply-To"] = config["reply_to"]
    message.set_content(text)
    message.add_alternative(html_body, subtype="html")
    try:
        context = ssl.create_default_context()
        if config["port"] == 465:
            client = smtplib.SMTP_SSL(config["host"], config["port"], timeout=15, context=context)
        else:
            client = smtplib.SMTP(config["host"], config["port"], timeout=15)
            client.starttls(context=context)
        with client:
            if config["username"]:
                client.login(config["username"], config["password"])
            client.send_message(message)
        observability._json_log("info", "email_sent", provider="smtp", subject=subject)
        return True
    except Exception as error:
        observability._json_log("warning", "email_send_failed", provider="smtp", subject=subject,
                                error=type(error).__name__)
        return False


def send_in_background(to, message) -> None:
    """Queues a (subject, text, html) message so the caller never waits on SMTP."""
    if email_configured():
        _executor.submit(send_email, to, *message)


def send_welcome(email: str, name: str = "") -> None:
    send_in_background(email, welcome_message(str(name or "").split(" ")[0][:60]))


def send_payment_confirmation(user_ref, plan_id, amount_minor, currency, credits, cycle_end, payment_id) -> None:
    if not email_configured():
        return

    def _send():
        try:
            data = user_ref.get().to_dict() or {}
        except Exception as error:
            observability._json_log("warning", "email_recipient_lookup_failed", error=type(error).__name__)
            return
        if not data.get("deletion_pending"):
            send_email(data.get("email"), *payment_message(
                plan_id, amount_minor, currency, credits, cycle_end, payment_id))

    _executor.submit(_send)


def send_expiry_reminders(db, now=None) -> dict:
    """Emails paid accounts whose plan ends within EXPIRY_REMINDER_DAYS, once per plan period.

    Runs synchronously (from the cron pass) so every email is sent before the
    process exits. The marker is written first and cleared if the send fails,
    so a crash can skip one reminder but never repeat it every pass.
    """
    if not email_configured() or db is None:
        return {"sent": 0, "skipped": "unconfigured" if db is not None else "no_database"}
    now = now or datetime.now(timezone.utc)
    start = now.replace(tzinfo=None).isoformat() + "Z"
    end = (now + timedelta(days=EXPIRY_REMINDER_DAYS)).replace(tzinfo=None).isoformat() + "Z"
    query = (
        db.collection("users")
        .where("subscription_expiry", ">", start)
        .where("subscription_expiry", "<=", end)
        .limit(EXPIRY_REMINDER_BATCH)
    )
    sent = failed = 0
    for snapshot in query.stream():
        data = snapshot.to_dict() or {}
        expiry = data.get("subscription_expiry")
        tier = str(data.get("subscription_tier") or "free")
        if (tier == "free" or data.get("deletion_pending") or not _valid_address(data.get("email"))
                or data.get("expiry_reminder_sent_for") == expiry):
            continue
        snapshot.reference.update({"expiry_reminder_sent_for": expiry})
        if send_email(data.get("email"), *expiry_message(tier, expiry)):
            sent += 1
        else:
            failed += 1
            snapshot.reference.update({"expiry_reminder_sent_for": None})
    return {"sent": sent, "failed": failed}
