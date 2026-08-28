# Lekha Captions launch checklist — current status

Updated: 22 August 2026

For step-by-step instructions beside every remaining ❌ item, use
[`LAUNCH_FIX_GUIDE.md`](./LAUNCH_FIX_GUIDE.md).

## How to read this checklist

- ✅ Fixed, implemented, or verified
- ❌ Not completed, not configured, or still needs a real production test

Items marked **N/A** do not apply to the product as currently offered.

## Owner update recorded today

- ✅ Claude-assisted launch code is committed in `cca5df8`:
  quota restoration, the system-wide AI ceiling, traceable export failures,
  mobile/desktop Beta labels, support/legal surfaces, and automated checks.
- ✅ Owner confirms a live Razorpay purchase and refund were completed today.
- ✅ Owner confirms Razorpay receipt emails were enabled today.
- ✅ Owner confirms a deliberate failed Razorpay checkout displayed the
  production failure state and granted no plan or credits today.
- ✅ Owner confirms the external support-mail send-and-reply test worked today;
  the Spacemail inbox screenshot shows inbound delivery.
- ✅ Owner confirms invoices, GST/tax treatment, accounting records,
  refund/chargeback reserves, and a redacted chargeback drill were completed
  today; see `docs/OWNER_CONFIRMATIONS_2026-08-22.md`.
- ✅ Owner confirms production error, warning, and budget alerts were configured today.
- ✅ Owner confirms the production malware scanner setting was configured today.
- ✅ Owner confirms OpenAI/Sarvam retention and training terms were reviewed today.
- ✅ Attach durable evidence for the completed external actions above.
  - Redacted Razorpay lifecycle evidence and owner-confirmed failed-payment and
    support-mail screenshots are recorded in the release documents. Alert,
    scanner, and provider-policy evidence remain separate outstanding items.
- ✅ Support mailbox end-to-end verification.
  - Root, `www`, `app`, MX, SPF, DKIM, and DMARC resolve publicly and the owner
    confirmed an external send-to/reply-from test. See
    `docs/OWNER_CONFIRMATIONS_2026-08-22.md`.
- ❌ Repository launch-evidence gate.
  - Queue/worker recovery, payment reconciliation, backup restore, frontend
    rollback, account deletion, and the 200-request staging load smoke now have
    durable evidence in `docs/DRILL_LOG.md`.
  - The authenticated production Hindi/portrait flow and the remaining
    owner-confirmed media-matrix cases are recorded in
    `docs/OWNER_CONFIRMATIONS_2026-08-28.md`. The staging-specific flow and
    periodic security/monitored-contact sign-offs remain separate launch gates.
- ✅ Isolated staging is deployed.
  - Marketing: `https://lekha-captions-staging.netlify.app`
  - Editor: `https://lekha-captions-app-staging.netlify.app`
  - API/worker/Redis: Railway project `lekha-captions-staging`

## Current decision

- ❌ **Paid public launch approved**
  - Not yet. Keep payments disabled until the unchecked launch blockers and the
    final minimum checklist are completed.
- ✅ **Small beta approach selected**
  - Start with trusted users and strict quotas, then expand gradually.

## Seven technical must-haves before a paid public beta

1. ✅ Complete the Google sign-out and sign-in-again check in a normal external
   browser against the deployed Firebase project. The signed-out view exposed
   no prior project and the returned Dashboard started empty. *(Owner-confirmed;
   see `docs/OWNER_CONFIRMATIONS_2026-08-28.md`.)*
2. ✅ Run and record the malware-scanner startup and harmless rejection check.
   See `docs/OWNER_CONFIRMATIONS_2026-08-28.md`.
3. ✅ Complete the owner-confirmed real-video matrix: Hindi, English,
   mixed-language, portrait, landscape, poor-audio, near-limit, and
   corrupted-file cases. See `docs/OWNER_CONFIRMATIONS_2026-08-28.md`.
4. ✅ Prove Razorpay webhook delivery/replay and one failed-payment path without
   an incorrect entitlement grant. See the redacted Razorpay evidence and owner
   confirmation record.
5. Rotate legacy credentials and retain production secrets only in the hosting
   providers' secret managers.
6. ✅ Pass an external support-mail send-and-receive/reply test; domain, MX, SPF,
   DKIM, and DMARC resolution now pass. See the owner confirmation record.
7. Deliver a real test alert to the named launch operator and preserve the
   evidence.

Firebase App Check, a separate development Firebase project, broader policy
evidence, public release notes, and a full media/demo library are valuable
hardening or communication work, but they are not substitutes for the seven
customer-safety paths above.

## 1. Launch blockers

- ❌ A customer cannot be charged without receiving the purchased plan or credits.
  - Server verification and idempotent grants are implemented, but a real live
    payment and webhook replay have not been completed.
- ✅ One user cannot access another user's videos, captions, or exports.
  - Application ownership checks, signed URLs, and restrictive Firestore and
    Storage rules are implemented; both rulesets and Firestore indexes were
    compiled and deployed to `captionstudio-9dfde` on 4 August 2026.
- ❌ Users can contact support for refunds through the public domain.
  - The inbox and all public DNS/mail-auth records now exist. A real message and
    reply from an external mailbox are still required.
- ✅ Subscription cancellation is available or clearly not applicable.
  - **N/A:** current plans are fixed-period purchases and do not auto-renew.
- ✅ Processing costs have firm size, duration, usage, concurrency, retry, and
  system-wide limits.
- ✅ Failed provider/system transcription calls return the user's daily allowance.
- ✅ A no-speech transcription remains counted because the provider actually ran.
- ✅ Failed exports do not consume an export credit.
- ✅ Failed jobs have job/request references and structured logs.
- ✅ Production Firebase Storage and Firestore rules were compiled and released
  successfully with Firebase CLI on 4 August 2026.
- ✅ No active server secrets or Firebase Admin credential files are present in
  the tracked frontend/source.
- ✅ Credential-exposure review completed; the owner confirms no active or
  legacy credential was exposed, so rotation is not required for this release.
  See `docs/OWNER_CONFIRMATIONS_2026-08-28.md`.

## 2. Complete customer journey

### Account testing

- ✅ Email sign-up status is clear.
  - **N/A:** email/password authentication is not offered.
- ✅ Complete one real Google sign-in in the production Firebase project.
  - Passed with Terms/Privacy consent and App Check-protected account bootstrap
    on 21 August 2026.
- ✅ Email verification status is clear.
  - **N/A:** Google-only authentication is used.
- ✅ Forgotten-password status is clear.
  - **N/A:** the app does not manage passwords.
- ✅ Test sign-out and Google sign-in again in production.
  - Passed in a normal external browser on 28 August 2026. The signed-out view
    did not expose a prior project, and the returned Dashboard started empty.
- ✅ Complete one real account-deletion test.
  - Passed on staging with an isolated disposable Firebase identity; Auth,
    Firestore, and Storage deletion were verified end-to-end on 5 August 2026.
- ✅ Same-email account linking is not required.
  - **N/A:** only Google sign-in is offered.
- ✅ Public, login, dashboard, upload, support, and legal pages render on mobile
  and desktop without horizontal overflow.

### Product media testing

- ✅ Upload and process a short Hindi video.
  - The supplied 21.97 MB MOV generated six timed Hindi caption segments in the
    production editor on 21 August 2026.
- ❌ Upload and process a short English video.
- ❌ Upload and process a mixed Hindi-English video.
- ✅ Upload and process a vertical Reel video.
  - The supplied source uses rotation metadata and exported correctly at 9:16.
- ❌ Upload and process a separate unrotated landscape video.
- ❌ Upload a file close to the 500 MB maximum.
- ❌ Test an unsupported file.
- ❌ Test a corrupted video.
- ❌ Test a video with poor audio.
- ✅ Upload progress is visible.
- ✅ Processing start and progress phases are visible.
- ✅ Transcription errors use customer-readable wording.
- ✅ Confirm captions remain saved after a real authenticated refresh.
  - All six captions, timing, media, and styling restored after a full reload.
- ✅ Confirm a real export contains the editor captions.
  - A decoded 1080×1920 output frame visibly contains the burned Devanagari
    caption; see `docs/production-export-frame-2026-08-21.png`.
- ❌ Confirm a real export downloads on mobile and desktop.
  - Desktop production download passed; mobile download remains untested.
- ✅ Failed export jobs can be retried.
- ✅ System/provider failures return reserved AI allowance.
- ✅ Failed exports do not charge credits.
- ✅ Concurrent and duplicate process/export submissions are blocked or idempotent.

### Payment testing

- ✅ Razorpay live checkout opens. *(Owner-confirmed 30 July 2026.)*
- ✅ One live payment succeeds. *(Owner-confirmed 30 July 2026.)*
- ✅ Server-side Razorpay signature verification is implemented.
- ✅ Confirm the live Razorpay payment reaches `captured`. *(Owner-confirmed.)*
- ✅ Plan, price, currency, order owner, and credits are validated in code.
- ✅ Confirm the correct entitlement is added after a live payment. *(Owner-confirmed.)*
- ✅ Enable and test a Razorpay receipt or payment-confirmation email. *(Owner-confirmed.)*
- ✅ Refreshing/retrying cannot grant the same payment twice in code.
- ✅ Repeated webhooks are handled idempotently in code.
- ✅ Replay a real payment webhook twice and save redacted evidence. See
  [Razorpay redacted evidence](RAZORPAY_EVIDENCE_2026-08-22.md).
- ✅ Non-captured/failed payments do not activate a plan in code.
- ✅ Test one failed payment and attach the result. *(Owner-confirmed production
  failure UI; see `docs/OWNER_CONFIRMATIONS_2026-08-22.md`.)*
- ✅ Recurring cancellation is not required for current non-renewing plans.
- ✅ Complete one real full or partial refund. *(Owner-confirmed 30 July 2026.)*

## 3. Usage and cost controls

### Limits

- ✅ Maximum video duration is enforced.
- ✅ Maximum upload size is 500 MB and enforced while streaming.
- ✅ Supported extensions, MIME/content, and FFprobe validation are enforced.
- ✅ Maximum video duration/usage is limited by plan.
- ✅ Maximum daily exports are limited by plan.
- ✅ Maximum concurrent transcription/export jobs per user is limited.
- ✅ Worker retry count is bounded.
- ✅ Provider, FFmpeg, queue, and frontend polling timeouts are bounded.
- ✅ Upload and export storage retention periods are bounded.
- ✅ New-account bootstrap is rate-limited.
- ✅ Upload is rate-limited.
- ✅ Transcription/process endpoints are rate-limited.
- ✅ Export abuse/failure retries are rate-limited.
- ✅ Payment, promotion, translation, language detection, and analytics are rate-limited.
- ✅ Platform-wide AI usage is capped at 500 calls per UTC day by default.
- ✅ Lower the first-launch system-wide AI limit to approximately 50.
  - `AI_SYSTEM_DAILY_LIMIT=50` is configured on the Railway web and worker services.
- ✅ Admin kill switches exist for sign-ups, payments, uploads, transcription,
  exports, and maintenance mode.

### Alerts

- ✅ Firebase/Google Cloud spending alert configured. *(Owner-confirmed.)*
- ✅ Transcription-provider spending alert configured. *(Owner-confirmed.)*
- ✅ Storage-usage alert configured. *(Owner-confirmed.)*
- ✅ Redis/worker failure alert configured. *(Owner-confirmed.)*
- ✅ Queue-length alert configured. *(Owner-confirmed.)*
- ✅ Export-failure-rate alert connected to a monitored destination. *(Owner-confirmed.)*
- ✅ Razorpay payment-failure alert configured. *(Owner-confirmed.)*
- ✅ Sentry/error monitoring configured. *(Owner-confirmed.)*
- ✅ Named Slack/email/on-call contacts configured. *(Owner-confirmed.)*
- ✅ Successful controlled notification evidence saved for each configured alert
  channel, including Sentry and Google Cloud budget alerts. *(Owner-confirmed;
  see `docs/OWNER_CONFIRMATIONS_2026-08-28.md`.)*

## 4. Customer support

### Minimum support setup

- ✅ `support@lekhacaptions.com` inbox created. *(Owner-confirmed.)*
- ✅ Domain/MX records resolve and an external send/receive test succeeds.
  - DNS/MX/mail-auth resolution passes; the owner confirmed external
    send/receive/reply and supplied a live Spacemail inbox screenshot.
- ✅ Help/Support navigation is present inside the product.
- ✅ A structured contact form is present.
- ✅ FAQ/help page is published.
- ✅ Failed export messages provide a job reference and support direction.
- ✅ A support ticket-log CSV template exists.
- ✅ Select and begin using the ticket log or a real ticketing system.
  - The public form creates durable `support_requests` Firestore records and
    operator alerts; the operating routine is in `docs/SUPPORT_TICKET_WORKFLOW.md`.

### Support intake

- ✅ Account email field.
- ✅ Job/project ID field.
- ✅ Razorpay payment ID field.
- ✅ Browser/device field.
- ✅ Video format, duration, and size field.
- ✅ Instructions for attaching a screenshot or screen recording.
- ✅ Incident-description field.
- ✅ Warning never to send a password, OTP, full card number, or CVV.

### Support promise and replies

- ✅ One-business-day response promise is published.
- ✅ The wording promises a response, not guaranteed resolution.
- ✅ Reply: payment succeeded but credits were not added.
- ✅ Reply: payment failed but the amount appears deducted.
- ✅ Reply: export stuck in processing.
- ✅ Reply: transcription inaccurate.
- ✅ Reply: unsupported video format.
- ✅ Reply: refund approved.
- ✅ Reply: refund initiated but not received.
- ✅ Reply: subscription cancellation/non-renewing plan explanation.
- ✅ Reply: account deletion.
- ✅ Reply: video/privacy concern.

## 5. Refund and cancellation policy

### Refund eligibility

- ✅ Duplicate charges are eligible.
- ✅ Captured payment without service activation is eligible.
- ✅ Permanent platform-caused failure is covered.
- ✅ Major unresolved technical failure is covered.
- ✅ First-purchase/seven-day and usage conditions are described.
- ✅ Refunds required by applicable law are covered.
- ✅ Consumed credits/completed exports can reduce refund eligibility and this is disclosed.

### Cancellation

- ✅ Current plans are clearly disclosed as non-auto-renewing.
- ✅ Future renewal cancellation is **N/A** for current plans.
- ✅ Paid access duration is disclosed.
- ✅ Previous payments are not automatically refunded.
- ✅ Remaining-credit expiry is disclosed.
- ✅ Account deletion is distinguished from plan cancellation.

### Refund operations

- ✅ Customer can email the support inbox through the public domain.
  - Inbox creation and DNS/MX reachability are verified; the owner confirmed
    the real external send/reply test. See `docs/OWNER_CONFIRMATIONS_2026-08-22.md`.
- ✅ Payment, usage, and reason review steps are documented.
- ✅ Full refund, partial refund, and account-credit decisions are documented.
- ✅ Razorpay Dashboard/API initiation steps are documented.
- ✅ Refund decision log fields are documented.
- ✅ Refund-confirmation email template is prepared.
- ✅ Webhook/status tracking is implemented or documented.
- ✅ Perform one real refund. *(Owner-confirmed.)*
- ✅ Record redacted payment/refund evidence in the release record. See
  [Razorpay redacted evidence](RAZORPAY_EVIDENCE_2026-08-22.md).
- ❌ Have an Indian lawyer review the final Terms, Privacy, and Refund Policy.

## 6. Chargeback records

- ✅ Razorpay receipt delivery tested. *(Owner-confirmed.)*
- ✅ Proper tax invoice created and delivered. *(Owner-confirmed; retain
  redacted invoice evidence.)*
- ✅ Customer payment-confirmation/receipt email delivered. *(Owner-confirmed.)*
- ✅ Terms/privacy acceptance timestamp and document versions are stored.
- ❌ Confirm legally appropriate IP/device evidence and retention with counsel.
- ✅ Credits granted are recorded.
- ✅ AI/transcription usage is recorded.
- ✅ Export history is recorded.
- ✅ Support conversations are being stored operationally.
  - Structured support submissions are stored in Firestore with a ticket ID,
    status, timestamps, and one-year expiry.
- ✅ Export/download delivery information is recorded.
- ✅ Real refund record created. *(Owner-confirmed.)*
- ✅ Redacted refund evidence attached and reviewed. See
  [Razorpay redacted evidence](RAZORPAY_EVIDENCE_2026-08-22.md).
- ✅ Complete one chargeback/dispute evidence drill. *(Owner-confirmed; see
  `docs/OWNER_CONFIRMATIONS_2026-08-22.md`.)*

## 7. Legal pages

### Published pages and links

- ✅ Terms of Service.
- ✅ Privacy Policy.
- ✅ Refund and Cancellation Policy.
- ✅ Acceptable Use Policy.
- ✅ Contact/Support page.
- ✅ Footer links to legal/support pages.
- ✅ Checkout links to the refund policy.
- ✅ Cookie notice is currently **N/A** unless non-essential analytics or
  advertising cookies are enabled.

### Terms coverage

- ✅ What Lekha Captions provides.
- ✅ AI transcription may contain errors.
- ✅ Pricing, credits, and current non-renewing plan model.
- ✅ Unused-credit expiry.
- ✅ Cancellation/refund terms.
- ✅ Account suspension/termination.
- ✅ Limitation of liability.
- ❌ Final registered business identity, address, governing venue, and dispute
  wording reviewed by a lawyer.
- ✅ No guarantee of uninterrupted availability.
- ✅ Users must review captions before publishing.
- ✅ Users must have rights/consent for uploaded content.

### Acceptable Use Policy

- ✅ Copyright-infringing uploads prohibited.
- ✅ Non-consensual private/intimate content prohibited.
- ✅ Child sexual abuse material prohibited.
- ✅ Illegal content prohibited.
- ✅ Malware prohibited.
- ✅ Harassment/impersonation prohibited.
- ✅ Attempts to bypass limits prohibited.
- ✅ Shared-account resale prohibited.
- ✅ Uploads without rights/consent prohibited.
- ✅ Illegal/infringing-content reporting method is published.
- ❌ Confirm the abuse/support email is operational.

## 8. Privacy and video-data handling

- ✅ Information collected is described.
- ✅ Collection/processing purposes are described.
- ✅ Video storage and processing are described.
- ✅ External processor categories are described.
- ✅ Confirm the exact OpenAI and Sarvam account-level retention/training terms.
  *(Owner-confirmed.)*
- ❌ Store the provider-policy/contract evidence and update the Privacy Policy if
  the confirmed settings differ from its current promise.
- ✅ Original-upload retention is described.
- ✅ Export retention is described.
- ✅ Video and account deletion are described and implemented.
- ✅ International processing/transfers are disclosed generally.
- ❌ Working privacy-request contact address.
- ✅ Lekha's own public-model training position is stated.
- ❌ Final controller/business identity and postal address.
- ❌ GDPR legal bases and transfer mechanism completed.
- ❌ DPDP grievance contact/officer details completed where applicable.
- ❌ Processor/data-processing agreements reviewed.

## 9. Firebase and file security

- ✅ Checked-in Storage rules deny direct browser access.
- ✅ Server media access is authenticated and user-bound.
- ✅ Storage/database ownership paths are tied to the authenticated user.
- ✅ Users cannot obtain another user's media by guessing a normal URL.
- ✅ Download links are signed and expire.
- ✅ Checked-in database rules prevent cross-user client access.
- ✅ Firebase Admin credentials remain server-side.
- ✅ Temporary uploads/exports have automatic retention cleanup.
- ✅ File type, content, duration, and size are validated on the server.
- ✅ Production requires a malware scanner or an explicit unsafe override.
- ✅ Configure the production malware scanner. *(Owner-confirmed.)*
- ✅ Scanner startup and harmless suspicious-file rejection evidence recorded.
  *(Owner-confirmed; see `docs/OWNER_CONFIRMATIONS_2026-08-28.md`.)*
- ✅ Firebase App Check is registered and enforced for Firestore and Storage.
  - Verified in production on 21 August 2026; see
    `docs/PRODUCTION_VERIFICATION_2026-08-21.md`.
- ❌ Confirm production and development Firebase projects are separate.
- ✅ Deploy and inspect the production Firestore/Storage rules.
  - Both rulesets and Firestore indexes were deployed on 4 August 2026.
- ✅ Enable Firebase/Google Cloud budget alerts. *(Owner-confirmed.)*

## 10. Failure handling

### Visible states

- ✅ Uploading.
- ✅ Queued.
- ✅ Transcribing/processing.
- ✅ Preparing captions.
- ✅ Rendering/finalising export.
- ✅ Completed.
- ✅ Failed.
- ✅ Cancelled as a first-class media-job state.
- ✅ Refunded as a first-class payment/job state.

### Failure experience

- ✅ Every transcription and export failure displays a durable job/request ID.
  - The client creates and sends `X-Request-Id` before API calls, preserves it
    across retries, and appends it to customer-visible error messages. Export
    failures also retain the durable export job ID.
- ✅ Customer-readable explanation.
- ✅ Retry is offered where safe.
- ✅ Provider/system-failure quota is returned.
- ✅ Failed exports do not consume credits.
- ✅ Support path is visible.
- ✅ Payment/export idempotency prevents repeated charges/grants.
- ✅ Timed-out/stale jobs can be failed and recovered.
- ✅ Long job IDs and support addresses wrap on narrow screens.

## 11. Monitoring and emergency controls

### Launch metrics

- ✅ Production dashboard: number of sign-ups.
- ✅ Production dashboard: number of users who uploaded.
- ✅ Production dashboard: completed transcriptions.
- ✅ Production dashboard: completed exports.
- ✅ Production dashboard: job failure percentage.
- ✅ Production dashboard: average processing time.
- ✅ Production dashboard: cost per job.
- ✅ Production dashboard: successful payments.
- ✅ Production dashboard: failed payments.
- ✅ Production dashboard: support requests.
- ✅ Backend analytics/SLO counters exist for core processing and payment events.

### Emergency controls

- ✅ Disable new sign-ups.
- ✅ Disable new payments before a Razorpay order is created.
- ✅ Disable new uploads.
- ✅ Pause transcription.
- ✅ Pause exports.
- ✅ Reduce maximum duration without a code/configuration deployment.
- ✅ Maintenance mode.
- ✅ Complete and record a rollback-to-previous-deployment drill.

## 12. Customer communication

- ✅ Pricing page.
- ✅ Feature/plan comparison.
- ✅ Supported languages.
- ✅ Supported file types.
- ✅ Maximum upload size and plan duration.
- ✅ General processing-time expectations.
- ✅ “How it works” guide.
- ✅ Public demonstration video.
  - Two product films are embedded in the landing-page template showcase.
- ✅ FAQ.
- ✅ Dedicated known-limitations page.
- ❌ Working public contact address.
  - Inbox creation and public DNS/MX/mail authentication are confirmed, but an
    external message and reply are not yet recorded.
- ✅ Public changelog/release-notes page.
- ✅ The app does not claim 100% transcription accuracy.
- ✅ Accuracy limitations mention audio quality, accents, noise, language mixing,
  and speaker clarity.

## 13. Business and accounting

- ❌ Dedicated business bank account confirmed.
- ✅ Proper invoice process confirmed. *(Owner-confirmed.)*
- ✅ Payment/refund reconciliation drill completed.
  - The deployed seven-day reconciliation run completed with zero errors and a
    durable Firestore audit record on 5 August 2026.
- ✅ GST advice obtained from a chartered accountant. *(Owner-confirmed.)*
- ✅ Foreign SaaS/export-of-service tax treatment reviewed. *(Owner-confirmed.)*
- ❌ International payments activated and tested in Razorpay.
- ❌ Final tax-inclusive/exclusive price wording approved.
- ✅ Monthly revenue, gateway-fee, tax, and refund records established.
  *(Owner-confirmed.)*
- ✅ Refund/chargeback/infrastructure reserve balance established.
  *(Owner-confirmed.)*

## 14. Launch sequence

### Before inviting users

- ❌ Close every unchecked item in the final minimum checklist below.
- ✅ Name the people monitoring payments, jobs, alerts, and support.
  - The completed primary/backup/escalation roster is retained privately; this
    repository contains only the sanitized confirmation in
    `docs/PRODUCTION_CONTACTS.md`.
- ❌ Invite only 5–10 trusted users.
- ❌ Observe them without guiding them.
- ❌ Record where they become confused.

### After the first successful group

- ❌ Confirm real payment, transcription, export, download, and support journeys.
- ❌ Open to approximately 25–50 users with strict quotas.
- ❌ Raise capacity only after costs and failure rates are understood.
- ❌ Begin broader marketing only after stability is demonstrated.

### First-day operations

- ❌ Founder/developer available throughout the launch window.
- ❌ Check every payment manually.
- ❌ Check every failed export.
- ❌ Reply quickly to early support requests.
- ❌ Avoid multiple high-risk feature changes.
- ❌ Pause promotion if failure rates increase.
- ❌ Request testimonials only after successful customer projects.

## Final minimum checklist before pressing Launch

- ✅ Live payment completed successfully. *(Owner-confirmed.)*
- ✅ Correct plan/credits activated from that live payment. *(Owner-confirmed.)*
- ✅ Payment signature verification implemented server-side.
- ❌ Razorpay webhook delivery and replay tested.
- ✅ Recurring cancellation is **N/A** for current non-renewing plans.
- ✅ One real refund tested. *(Owner-confirmed.)*
- ✅ Production Firebase rules deployed and reviewed (4 August 2026).
- ✅ Current tracked frontend/source does not expose active server secrets.
- ✅ Credential-exposure review completed; no active or legacy credential was
  exposed, so rotation is not required for this release. *(Owner-confirmed; see
  `docs/OWNER_CONFIRMATIONS_2026-08-28.md`.)*
- ✅ Upload limits enabled.
- ✅ Per-user usage and concurrency limits enabled.
- ✅ Failed provider/system calls return AI allowance.
- ✅ Failed exports do not consume credits.
- ✅ Support inbox created. *(Owner-confirmed.)*
- ❌ Support domain/MX resolves and external send/receive succeeds.
  - DNS/MX resolves; external send/reply remains.
- ✅ Terms published.
- ✅ Privacy Policy published.
- ✅ Refund Policy published.
- ✅ Acceptable Use Policy published.
- ✅ Video deletion mechanism implemented.
- ✅ Account deletion mechanism implemented.
- ✅ Production cost alerts enabled. *(Owner-confirmed.)*
- ✅ Production error logging destination and contacts configured. *(Owner-confirmed.)*
- ✅ Alert-delivery evidence saved for configured destinations, including Sentry
  and Google Cloud budget alerts. *(Owner-confirmed; see
  `docs/OWNER_CONFIRMATIONS_2026-08-28.md`.)*
- ✅ Rollback procedure successfully rehearsed.
- ✅ App visibly marked Beta on mobile and desktop.
- ✅ Authenticated Hindi, English, mixed-language, portrait, landscape,
  poor-audio, near-limit, and corrupted-file tests completed.
  *(Owner-confirmed; see `docs/OWNER_CONFIRMATIONS_2026-08-28.md`.)*
- ✅ Queue/worker recovery drill completed.
- ✅ Backup restoration drill completed.
- ✅ Production API URL and production environment configuration verified.

## Launch gate

- ❌ **Ready for paid public beta**

Do not check this final box until all unchecked items in the **Final minimum
checklist** are completed with evidence.
