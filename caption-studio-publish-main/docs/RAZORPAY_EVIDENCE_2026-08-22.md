# Razorpay redacted evidence — 22 August 2026

This record intentionally omits customer email addresses, API credentials,
webhook secrets, full payment identifiers, and bank account data.

## Live capture

- Product: Starter monthly test purchase.
- Amount/currency: INR 99 (`9900` paise).
- Razorpay order: `order_TSjOaF…xPZS` (redacted).
- Razorpay payment: `pay_TSjP…GSMe` (redacted), UPI, status `captured`.
- Razorpay order status: `paid`, one attempt.
- Production `/api/verify-payment`: HTTP 200.
- Backend analytics: `payment_success` recorded once for the Starter plan.

## Refund

- A second INR 99 UPI payment was marked `refunded`.
- Refund: `rfnd_TSjN…nNTPF` (redacted), status `processed`.
- Razorpay refund reason: the checkout order associated with the QR was closed.
- The owner-provided Razorpay email screenshot confirms the refund notification
  was delivered. The mailbox screenshot is not stored in the repository.

## Webhook and reconciliation

- Production endpoint: `https://api.lekhacaptions.com/api/razorpay-webhook`.
- Active webhook ID: `TSjHD8…CZZP1` (redacted).
- The captured payment webhook was replayed twice with a valid signature:
  both attempts returned HTTP 200 and the payment application returned
  `duplicate=true`; no duplicate entitlement was granted.
- Production reconciliation was run with a 168-hour lookback: `success=true`,
  `scanned=0`, `applied=0`, `errors=0` after the replay was reconciled.
- Invalid webhook signature behavior remains HTTP 400.

## Failed payment

- The owner completed a deliberate failed-checkout attempt in production. The
  app displayed its **Payment not completed** state and did not grant a plan or
  credits. See [owner confirmation](OWNER_CONFIRMATIONS_2026-08-22.md#failed-razorpay-checkout).
- The attached screenshot is UI evidence rather than a redacted Dashboard
  `payment.failed` event record; retain the Dashboard event ID if it is needed
  for an audit package.
