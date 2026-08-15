# Support Ticket Workflow

Use the in-product Help & Support form as the primary intake channel. The API
creates a durable Firestore record in `support_requests`, returns a public ticket
ID such as `SUP-20260806-AB12CD34`, records the support metric, and sends the
configured operator alert. Email remains the attachment fallback.

## Daily operator routine

1. Check the `support_requests` collection at the start and end of each business
   day, plus whenever a support alert arrives.
2. Work `open` tickets oldest-first unless payment, privacy, or account-access
   impact makes the ticket urgent.
3. Set an owner, change the status to `in_progress`, and record the first response
   time. The published promise is a response within one business day, not a
   guaranteed same-day resolution.
4. Copy the ticket ID into every reply and into any related job, payment, refund,
   or incident record.
5. Set the final status to `resolved` or `closed`, record a short resolution, and
   add any refund ID. Never store passwords, OTPs, full card numbers, or CVVs.

## Status and priority values

- Status: `open`, `in_progress`, `waiting_for_customer`, `resolved`, `closed`
- Priority: `urgent` for access/privacy or captured-payment entitlement failures;
  `high` for blocked exports; `normal` for other product issues; `low` for general
  questions.

## CSV fallback

If Firestore intake is unavailable, use `docs/SUPPORT_TICKET_LOG.csv` with the
same ticket ID and fields. Move the record into Firestore after service recovery
and retain the CSV only as incident evidence.

## Weekly review

- Count new, resolved, reopened, and overdue tickets.
- Link repeated failures to their job/request references.
- Review refunds and payment-entitlement tickets against Razorpay records.
- Remove accidental sensitive data and escalate any security/privacy report
  through `docs/INCIDENT_RESPONSE.md`.
