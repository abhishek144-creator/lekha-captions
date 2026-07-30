# Lekha Captions Support Playbook

## Service promise

Use this wording:

> We normally respond within one business day. Complex transcription, rendering, or payment issues may require additional investigation.

Promise a response time, not a resolution time. Never ask for a password, OTP,
full card number, or CVV.

Record every request in `SUPPORT_TICKET_LOG.csv` or import that header row into
the team ticket system. Restrict access because the log contains customer and
payment identifiers.

## First response checklist

Capture the account email, job or project ID, Razorpay payment ID when relevant,
browser/device, video format/duration/file size, a screenshot or recording, and
a short description. Confirm the current job and payment state before changing
credits or initiating a refund.

## Canned replies

### Payment captured but credits are missing

We found your payment report and are checking the captured payment against your
Lekha Captions account. Please reply with the Razorpay payment ID and the email
used for Lekha Captions if either was missing from your first message. Do not
send card details or an OTP. We will update you after entitlement
reconciliation.

### Payment failed but the amount appears deducted

The payment did not activate a Lekha Captions plan. Banks sometimes show a
temporary debit for a failed or pending payment. Please send the Razorpay
payment ID and a screenshot that hides sensitive card or bank information. We
will check the gateway status; if Razorpay did not capture it, the bank normally
reverses it automatically.

### Export is stuck

Please send the export job ID shown in the app. A failed export does not consume
a credit. We will check the queue and render logs. Avoid submitting the same
export repeatedly while we investigate.

### Transcription is inaccurate

Accuracy varies with audio quality, accents, background noise, language mixing,
and speaker clarity. Please send the job ID, selected language, and the
approximate timestamp where the problem begins. You can edit every caption
before exporting.

### Unsupported video format

Lekha Captions accepts MP4, MOV, AVI, MKV, and WebM videos up to 500 MB and up
to the duration allowed by your plan. MP4 with H.264 video and AAC audio is the
safest choice. Convert or trim the file and try again.

### Refund approved

Your refund has been approved for the amount shown in this message. We will
return it to the original payment method and send the Razorpay refund ID after
initiation.

### Refund initiated but not received

Your refund was initiated to the original payment method. Bank processing
typically takes 5–7 business days after initiation and can take longer at some
banks. Please quote the refund ID below when contacting your bank.

### Cancellation

Lekha Captions plans are fixed-period, one-time purchases and do not auto-renew.
There is no recurring mandate to cancel. Your paid access continues until the
end of the purchased period, and unused credits expire with that period.

### Account deletion

You can permanently delete your account from the Account page. This is separate
from stopping use of a plan. Download anything you need first; deletion removes
your account and associated media and cannot be undone.

### Video or privacy concern

Please send the account email and project/job ID, describe the privacy concern,
and tell us whether you want the file or the entire account deleted. Do not
attach sensitive media unless support specifically confirms a secure transfer
method.

## Refund operations

1. Confirm the payment is captured and belongs to the account.
2. Review credits, transcription minutes, exports, delivery logs, and prior refunds.
3. Record the full/partial/account-credit decision and reason.
4. Initiate the approved refund from Razorpay Dashboard or the refund API.
5. Record payment ID, refund ID, amount, reason, date, and operator.
6. Send the confirmation reply.
7. Track the final refund state through Razorpay and its webhook history.

## Escalation

- Security, illegal content, child safety, and non-consensual imagery: escalate immediately.
- Captured payment without entitlement: reconcile before asking the customer to pay again.
- Queue or provider incident affecting multiple users: pause the affected service in Admin Ops and publish a notice.
- Suspected cross-account access or credential exposure: stop launch traffic and follow `INCIDENT_RESPONSE.md`.
