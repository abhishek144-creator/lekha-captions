"""Signup email policy: refuse temporary / disposable inboxes for new accounts.

Every new account receives free exports and transcriptions, so throwaway
identities are the cheapest way to farm them. Google sign-in can still carry a
non-Gmail address (a Google account may be registered on any inbox), and any
other Firebase provider enabled later would accept arbitrary addresses, so the
API checks the token's email at first bootstrap rather than trusting the UI.

The bundled list covers the common public temp-mail services. Operators can add
more without a release through DISPOSABLE_EMAIL_DOMAINS_EXTRA (comma-separated).
"""

from typing import Any, Dict, Optional

try:
    from . import settings
except ImportError:  # Direct execution from backend/ remains supported.
    import settings


DISPOSABLE_EMAIL_DOMAINS = frozenset({
    "10minutemail.com", "10minutemail.net", "10minutemail.co.uk", "10minmail.com",
    "20minutemail.com", "33mail.com", "anonaddy.me", "armyspy.com", "binkmail.com",
    "bobmail.info", "burnermail.io", "byom.de", "chacuo.net", "cool.fr.nf",
    "courriel.fr.nf", "crazymailing.com", "cuvox.de", "dayrep.com", "deadaddress.com",
    "discard.email", "discardmail.com", "discardmail.de", "dispostable.com",
    "dodgit.com", "dropmail.me", "dudmail.com", "einrot.com", "emailondeck.com",
    "emailfake.com", "emailtemporanea.com", "emailtemporanea.net", "emltmp.com",
    "fakeinbox.com", "fakemail.net", "fakemailgenerator.com", "fastacura.com",
    "filzmail.com", "fleckens.hu", "getairmail.com", "getnada.com", "gishpuppy.com",
    "guerrillamail.biz", "guerrillamail.com", "guerrillamail.de", "guerrillamail.info",
    "guerrillamail.net", "guerrillamail.org", "guerrillamailblock.com", "gustr.com",
    "harakirimail.com", "hidemail.de", "incognitomail.org", "inboxbear.com",
    "inboxkitten.com", "jetable.fr.nf", "jetable.org", "jourrapide.com",
    "kasmail.com", "kurzepost.de", "linshiyouxiang.net", "mail-temp.com",
    "mail.tm", "mail7.io", "mailcatch.com", "maildrop.cc", "mailforspam.com",
    "mailinator.com", "mailinator.net", "mailinator2.com", "mailnesia.com",
    "mailnull.com", "mailpoof.com", "mailsac.com", "mailtemp.net", "mailtothis.com",
    "meltmail.com", "minuteinbox.com", "moakt.com", "moakt.cc", "mohmal.com",
    "mt2015.com", "mvrht.com", "my10minutemail.com", "mytemp.email", "mytrashmail.com",
    "nada.email", "nomail.xl.cx", "nospam.ze.tc", "notmailinator.com", "nwytg.net",
    "one-time.email", "oneoffemail.com", "pokemail.net", "proxymail.eu",
    "rcpt.at", "rhyta.com", "rootfest.net", "sharklasers.com", "shieldemail.com",
    "smailpro.com", "snapmail.cc", "sofimail.com", "spam4.me", "spamavert.com",
    "spambog.com", "spambox.us", "spamex.com", "spamfree24.org", "spamgourmet.com",
    "spaml.de", "spammotel.com", "superrito.com", "teleworm.us", "temp-mail.io",
    "temp-mail.org", "temp-mail.ru", "tempail.com", "tempemail.co", "tempemail.net",
    "tempinbox.com", "tempmail.com", "tempmail.de", "tempmail.dev", "tempmail.net",
    "tempmail.plus", "tempmailo.com", "tempmailaddress.com", "tempmail.email",
    "tempr.email", "temporarymail.com", "throwam.com", "throwawaymail.com",
    "tmail.ws", "tmailor.com", "tmpbox.net", "tmpmail.net", "tmpmail.org",
    "tmpeml.com", "trash-mail.com", "trashmail.at", "trashmail.com", "trashmail.de",
    "trashmail.io", "trashmail.me", "trashmail.net", "trashmail.ws", "trbvm.com",
    "wegwerfemail.de", "wegwerfmail.de", "wegwerfmail.net", "wegwerfmail.org",
    "yepmail.net", "yopmail.com", "yopmail.fr", "yopmail.net", "zetmail.com",
    "zippymail.info", "zoemail.org", "1secmail.com", "1secmail.net", "1secmail.org",
    "emailnax.com", "vomoto.com", "kzccv.com", "qiott.com", "wuuvo.com",
    "icznn.com", "ezztt.com", "txcct.com", "dpptd.com", "rteet.com", "xojxe.com",
    "laafd.com", "cyclic.email", "inboxes.com", "spamdecoy.net", "mintemail.com",
    "mailbox92.biz", "fexpost.com", "fexbox.org", "mailbox.in.ua", "rambox.ml",
    "tempmail.us.com", "tempmailin.com", "grr.la", "pokemail.com", "spam.la",
    "guerrillamail.ru", "luxusmail.org", "mailpluss.com", "tmails.net",
})

_DISPOSABLE_DOMAINS = DISPOSABLE_EMAIL_DOMAINS | settings.DISPOSABLE_EMAIL_DOMAINS_EXTRA

REJECTION_CODE = "signup_email_rejected"


def email_domain(email: str) -> str:
    address = str(email or "").strip().lower().rstrip(".")
    if address.count("@") != 1:
        return ""
    return address.rsplit("@", 1)[1].strip().rstrip(".")


def is_disposable_email(email: str) -> bool:
    domain = email_domain(email)
    if not domain:
        return False
    # Temp-mail services hand out subdomains too (x.mailinator.com).
    parts = domain.split(".")
    return any(".".join(parts[index:]) in _DISPOSABLE_DOMAINS for index in range(len(parts) - 1))


def signup_rejection(decoded_token: Dict[str, Any]) -> Optional[str]:
    """Why a brand-new account may not be created for this token, or None."""
    provider = str((decoded_token.get("firebase") or {}).get("sign_in_provider") or "")
    if provider == "anonymous":
        if settings.ALLOW_ANONYMOUS_SIGNUP:
            return None
        return "Please sign up with your Google account to continue."
    email = str(decoded_token.get("email") or "").strip()
    if not email_domain(email):
        return "Please sign up with an account that has an email address."
    if decoded_token.get("email_verified") is False:
        return "Please verify your email address before signing up."
    if is_disposable_email(email):
        return (
            "Temporary or disposable email addresses can't be used to sign up. "
            "Please use your regular Google account."
        )
    return None
