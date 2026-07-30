# Lekha Captions launch checklist — current status

Updated: 30 July 2026

## How to read this checklist

- [x] Fixed, implemented, or verified
- [ ] Not completed, not configured, or still needs a real production test

Items marked **N/A** do not apply to the product as currently offered.

## Owner update recorded today

- [x] Claude-assisted launch code is committed in `cca5df8`:
  quota restoration, the system-wide AI ceiling, traceable export failures,
  mobile/desktop Beta labels, support/legal surfaces, and automated checks.
- [x] Owner confirms a live Razorpay purchase and refund were completed today.
- [x] Owner confirms Razorpay receipt emails were enabled today.
- [x] Owner confirms production error, warning, and budget alerts were configured today.
- [x] Owner confirms the production malware scanner setting was configured today.
- [x] Owner confirms OpenAI/Sarvam retention and training terms were reviewed today.
- [ ] Attach durable evidence for the external actions above.
  - Add redacted Razorpay payment/refund IDs, receipt delivery, alert test
    screenshots, scanner startup output, and provider-policy notes to the release record.
- [ ] Support domain verification.
  - `lekhacaptions.com` and `www.lekhacaptions.com` still returned unresolved
    during the latest check. The inbox may have been created, but it is not
    externally reachable until DNS/MX records resolve.
- [ ] Repository launch-evidence gate.
  - `docs/DRILL_LOG.md` still contains no completed drills, so
    `npm run launch:evidence` currently fails.

## Current decision

- [ ] **Paid public launch approved**
  - Not yet. Keep payments disabled until the unchecked launch blockers and the
    final minimum checklist are completed.
- [x] **Small beta approach selected**
  - Start with trusted users and strict quotas, then expand gradually.

## 1. Launch blockers

- [ ] A customer cannot be charged without receiving the purchased plan or credits.
  - Server verification and idempotent grants are implemented, but a real live
    payment and webhook replay have not been completed.
- [ ] One user cannot access another user's videos, captions, or exports.
  - Application ownership checks, signed URLs, and restrictive checked-in rules
    are implemented. The deployed production Firebase rules still need verification.
- [ ] Users can contact support for refunds through the public domain.
  - The owner confirms the inbox was created today. Refund pages and support
    links exist, but the domain still does not resolve externally.
- [x] Subscription cancellation is available or clearly not applicable.
  - **N/A:** current plans are fixed-period purchases and do not auto-renew.
- [x] Processing costs have firm size, duration, usage, concurrency, retry, and
  system-wide limits.
- [x] Failed provider/system transcription calls return the user's daily allowance.
- [x] A no-speech transcription remains counted because the provider actually ran.
- [x] Failed exports do not consume an export credit.
- [x] Failed jobs have job/request references and structured logs.
- [ ] Production Firebase Storage and Firestore rules have been inspected after deployment.
  - The repository rules are restrictive; production deployment remains unverified.
- [x] No active server secrets or Firebase Admin credential files are present in
  the tracked frontend/source.
- [ ] Credentials previously used with older public code have been rotated.

## 2. Complete customer journey

### Account testing

- [x] Email sign-up status is clear.
  - **N/A:** email/password authentication is not offered.
- [ ] Complete one real Google sign-in in the production Firebase project.
- [x] Email verification status is clear.
  - **N/A:** Google-only authentication is used.
- [x] Forgotten-password status is clear.
  - **N/A:** the app does not manage passwords.
- [ ] Test sign-out and Google sign-in again in production.
- [ ] Complete one real account-deletion test.
  - The UI and backend are implemented and covered by code checks.
- [x] Same-email account linking is not required.
  - **N/A:** only Google sign-in is offered.
- [x] Public, login, dashboard, upload, support, and legal pages render on mobile
  and desktop without horizontal overflow.

### Product media testing

- [ ] Upload and process a short Hindi video.
- [ ] Upload and process a short English video.
- [ ] Upload and process a mixed Hindi-English video.
- [ ] Upload and process a vertical Reel video.
- [ ] Upload and process a landscape video.
- [ ] Upload a file close to the 500 MB maximum.
- [ ] Test an unsupported file.
- [ ] Test a corrupted video.
- [ ] Test a video with poor audio.
- [x] Upload progress is visible.
- [x] Processing start and progress phases are visible.
- [x] Transcription errors use customer-readable wording.
- [ ] Confirm captions remain saved after a real authenticated refresh.
- [ ] Confirm a real export matches the editor preview.
- [ ] Confirm a real export downloads on mobile and desktop.
- [x] Failed export jobs can be retried.
- [x] System/provider failures return reserved AI allowance.
- [x] Failed exports do not charge credits.
- [x] Concurrent and duplicate process/export submissions are blocked or idempotent.

### Payment testing

- [x] Razorpay live checkout opens. *(Owner-confirmed 30 July 2026.)*
- [x] One live payment succeeds. *(Owner-confirmed 30 July 2026.)*
- [x] Server-side Razorpay signature verification is implemented.
- [x] Confirm the live Razorpay payment reaches `captured`. *(Owner-confirmed.)*
- [x] Plan, price, currency, order owner, and credits are validated in code.
- [x] Confirm the correct entitlement is added after a live payment. *(Owner-confirmed.)*
- [x] Enable and test a Razorpay receipt or payment-confirmation email. *(Owner-confirmed.)*
- [x] Refreshing/retrying cannot grant the same payment twice in code.
- [x] Repeated webhooks are handled idempotently in code.
- [ ] Replay a real/test webhook and save the evidence.
- [x] Non-captured/failed payments do not activate a plan in code.
- [ ] Test one failed payment and attach the result.
- [x] Recurring cancellation is not required for current non-renewing plans.
- [x] Complete one real full or partial refund. *(Owner-confirmed 30 July 2026.)*

## 3. Usage and cost controls

### Limits

- [x] Maximum video duration is enforced.
- [x] Maximum upload size is 500 MB and enforced while streaming.
- [x] Supported extensions, MIME/content, and FFprobe validation are enforced.
- [x] Maximum video duration/usage is limited by plan.
- [x] Maximum daily exports are limited by plan.
- [x] Maximum concurrent transcription/export jobs per user is limited.
- [x] Worker retry count is bounded.
- [x] Provider, FFmpeg, queue, and frontend polling timeouts are bounded.
- [x] Upload and export storage retention periods are bounded.
- [x] New-account bootstrap is rate-limited.
- [x] Upload is rate-limited.
- [x] Transcription/process endpoints are rate-limited.
- [x] Export abuse/failure retries are rate-limited.
- [x] Payment, promotion, translation, language detection, and analytics are rate-limited.
- [x] Platform-wide AI usage is capped at 500 calls per UTC day by default.
- [ ] Lower the first-launch system-wide AI limit to approximately 50.
- [x] Admin kill switches exist for sign-ups, payments, uploads, transcription,
  exports, and maintenance mode.

### Alerts

- [x] Firebase/Google Cloud spending alert configured. *(Owner-confirmed.)*
- [x] Transcription-provider spending alert configured. *(Owner-confirmed.)*
- [x] Storage-usage alert configured. *(Owner-confirmed.)*
- [x] Redis/worker failure alert configured. *(Owner-confirmed.)*
- [x] Queue-length alert configured. *(Owner-confirmed.)*
- [x] Export-failure-rate alert connected to a monitored destination. *(Owner-confirmed.)*
- [x] Razorpay payment-failure alert configured. *(Owner-confirmed.)*
- [x] Sentry/error monitoring configured. *(Owner-confirmed.)*
- [x] Named Slack/email/on-call contacts configured. *(Owner-confirmed.)*
- [ ] Attach one successful test notification from each production alert channel.

## 4. Customer support

### Minimum support setup

- [x] `support@lekhacaptions.com` inbox created. *(Owner-confirmed.)*
- [ ] Domain/MX records resolve and an external send/receive test succeeds.
- [x] Help/Support navigation is present inside the product.
- [x] A structured contact form is present.
- [x] FAQ/help page is published.
- [x] Failed export messages provide a job reference and support direction.
- [x] A support ticket-log CSV template exists.
- [ ] Select and begin using the ticket log or a real ticketing system.

### Support intake

- [x] Account email field.
- [x] Job/project ID field.
- [x] Razorpay payment ID field.
- [x] Browser/device field.
- [x] Video format, duration, and size field.
- [x] Instructions for attaching a screenshot or screen recording.
- [x] Incident-description field.
- [x] Warning never to send a password, OTP, full card number, or CVV.

### Support promise and replies

- [x] One-business-day response promise is published.
- [x] The wording promises a response, not guaranteed resolution.
- [x] Reply: payment succeeded but credits were not added.
- [x] Reply: payment failed but the amount appears deducted.
- [x] Reply: export stuck in processing.
- [x] Reply: transcription inaccurate.
- [x] Reply: unsupported video format.
- [x] Reply: refund approved.
- [x] Reply: refund initiated but not received.
- [x] Reply: subscription cancellation/non-renewing plan explanation.
- [x] Reply: account deletion.
- [x] Reply: video/privacy concern.

## 5. Refund and cancellation policy

### Refund eligibility

- [x] Duplicate charges are eligible.
- [x] Captured payment without service activation is eligible.
- [x] Permanent platform-caused failure is covered.
- [x] Major unresolved technical failure is covered.
- [x] First-purchase/seven-day and usage conditions are described.
- [x] Refunds required by applicable law are covered.
- [x] Consumed credits/completed exports can reduce refund eligibility and this is disclosed.

### Cancellation

- [x] Current plans are clearly disclosed as non-auto-renewing.
- [x] Future renewal cancellation is **N/A** for current plans.
- [x] Paid access duration is disclosed.
- [x] Previous payments are not automatically refunded.
- [x] Remaining-credit expiry is disclosed.
- [x] Account deletion is distinguished from plan cancellation.

### Refund operations

- [ ] Customer can email the support inbox through the public domain.
  - Inbox creation is owner-confirmed; DNS/MX reachability is not yet verified.
- [x] Payment, usage, and reason review steps are documented.
- [x] Full refund, partial refund, and account-credit decisions are documented.
- [x] Razorpay Dashboard/API initiation steps are documented.
- [x] Refund decision log fields are documented.
- [x] Refund-confirmation email template is prepared.
- [x] Webhook/status tracking is implemented or documented.
- [x] Perform one real refund. *(Owner-confirmed.)*
- [ ] Record redacted payment/refund evidence in the release record.
- [ ] Have an Indian lawyer review the final Terms, Privacy, and Refund Policy.

## 6. Chargeback records

- [x] Razorpay receipt delivery tested. *(Owner-confirmed.)*
- [ ] Proper tax invoice created and delivered.
- [x] Customer payment-confirmation/receipt email delivered. *(Owner-confirmed.)*
- [x] Terms/privacy acceptance timestamp and document versions are stored.
- [ ] Confirm legally appropriate IP/device evidence and retention with counsel.
- [x] Credits granted are recorded.
- [x] AI/transcription usage is recorded.
- [x] Export history is recorded.
- [ ] Support conversations are being stored operationally.
- [x] Export/download delivery information is recorded.
- [x] Real refund record created. *(Owner-confirmed.)*
- [ ] Redacted refund evidence attached and reviewed.
- [ ] Complete one chargeback/dispute evidence drill.

## 7. Legal pages

### Published pages and links

- [x] Terms of Service.
- [x] Privacy Policy.
- [x] Refund and Cancellation Policy.
- [x] Acceptable Use Policy.
- [x] Contact/Support page.
- [x] Footer links to legal/support pages.
- [x] Checkout links to the refund policy.
- [x] Cookie notice is currently **N/A** unless non-essential analytics or
  advertising cookies are enabled.

### Terms coverage

- [x] What Lekha Captions provides.
- [x] AI transcription may contain errors.
- [x] Pricing, credits, and current non-renewing plan model.
- [x] Unused-credit expiry.
- [x] Cancellation/refund terms.
- [x] Account suspension/termination.
- [x] Limitation of liability.
- [ ] Final registered business identity, address, governing venue, and dispute
  wording reviewed by a lawyer.
- [x] No guarantee of uninterrupted availability.
- [x] Users must review captions before publishing.
- [x] Users must have rights/consent for uploaded content.

### Acceptable Use Policy

- [x] Copyright-infringing uploads prohibited.
- [x] Non-consensual private/intimate content prohibited.
- [x] Child sexual abuse material prohibited.
- [x] Illegal content prohibited.
- [x] Malware prohibited.
- [x] Harassment/impersonation prohibited.
- [x] Attempts to bypass limits prohibited.
- [x] Shared-account resale prohibited.
- [x] Uploads without rights/consent prohibited.
- [x] Illegal/infringing-content reporting method is published.
- [ ] Confirm the abuse/support email is operational.

## 8. Privacy and video-data handling

- [x] Information collected is described.
- [x] Collection/processing purposes are described.
- [x] Video storage and processing are described.
- [x] External processor categories are described.
- [x] Confirm the exact OpenAI and Sarvam account-level retention/training terms.
  *(Owner-confirmed.)*
- [ ] Store the provider-policy/contract evidence and update the Privacy Policy if
  the confirmed settings differ from its current promise.
- [x] Original-upload retention is described.
- [x] Export retention is described.
- [x] Video and account deletion are described and implemented.
- [x] International processing/transfers are disclosed generally.
- [ ] Working privacy-request contact address.
- [x] Lekha's own public-model training position is stated.
- [ ] Final controller/business identity and postal address.
- [ ] GDPR legal bases and transfer mechanism completed.
- [ ] DPDP grievance contact/officer details completed where applicable.
- [ ] Processor/data-processing agreements reviewed.

## 9. Firebase and file security

- [x] Checked-in Storage rules deny direct browser access.
- [x] Server media access is authenticated and user-bound.
- [x] Storage/database ownership paths are tied to the authenticated user.
- [x] Users cannot obtain another user's media by guessing a normal URL.
- [x] Download links are signed and expire.
- [x] Checked-in database rules prevent cross-user client access.
- [x] Firebase Admin credentials remain server-side.
- [x] Temporary uploads/exports have automatic retention cleanup.
- [x] File type, content, duration, and size are validated on the server.
- [x] Production requires a malware scanner or an explicit unsafe override.
- [x] Configure the production malware scanner. *(Owner-confirmed.)*
- [ ] Attach a successful production scanner startup/test result.
- [ ] Enable and enforce Firebase App Check.
- [ ] Confirm production and development Firebase projects are separate.
- [ ] Deploy and inspect the production Firestore/Storage rules.
- [ ] Enable Firebase/Google Cloud budget alerts.

## 10. Failure handling

### Visible states

- [x] Uploading.
- [x] Queued.
- [x] Transcribing/processing.
- [x] Preparing captions.
- [x] Rendering/finalising export.
- [x] Completed.
- [x] Failed.
- [ ] Cancelled as a first-class media-job state.
- [ ] Refunded as a first-class payment/job state.

### Failure experience

- [ ] Every transcription and export failure displays a durable job/request ID.
  - Export failures do; confirm all transcription paths on a real screen.
- [x] Customer-readable explanation.
- [x] Retry is offered where safe.
- [x] Provider/system-failure quota is returned.
- [x] Failed exports do not consume credits.
- [x] Support path is visible.
- [x] Payment/export idempotency prevents repeated charges/grants.
- [x] Timed-out/stale jobs can be failed and recovered.
- [x] Long job IDs and support addresses wrap on narrow screens.

## 11. Monitoring and emergency controls

### Launch metrics

- [ ] Production dashboard: number of sign-ups.
- [ ] Production dashboard: number of users who uploaded.
- [ ] Production dashboard: completed transcriptions.
- [ ] Production dashboard: completed exports.
- [ ] Production dashboard: job failure percentage.
- [ ] Production dashboard: average processing time.
- [ ] Production dashboard: cost per job.
- [ ] Production dashboard: successful payments.
- [ ] Production dashboard: failed payments.
- [ ] Production dashboard: support requests.
- [x] Backend analytics/SLO counters exist for core processing and payment events.

### Emergency controls

- [x] Disable new sign-ups.
- [x] Disable new payments before a Razorpay order is created.
- [x] Disable new uploads.
- [x] Pause transcription.
- [x] Pause exports.
- [ ] Reduce maximum duration without a code/configuration deployment.
- [x] Maintenance mode.
- [ ] Complete and record a rollback-to-previous-deployment drill.

## 12. Customer communication

- [x] Pricing page.
- [x] Feature/plan comparison.
- [x] Supported languages.
- [x] Supported file types.
- [x] Maximum upload size and plan duration.
- [x] General processing-time expectations.
- [x] “How it works” guide.
- [ ] Public demonstration video.
- [x] FAQ.
- [ ] Dedicated known-limitations page.
- [ ] Working public contact address.
  - Inbox creation is confirmed, but public DNS/MX is still unresolved.
- [ ] Public changelog/release-notes page.
- [x] The app does not claim 100% transcription accuracy.
- [x] Accuracy limitations mention audio quality, accents, noise, language mixing,
  and speaker clarity.

## 13. Business and accounting

- [ ] Dedicated business bank account confirmed.
- [ ] Proper invoice process confirmed.
- [ ] Payment/refund reconciliation drill completed.
- [ ] GST advice obtained from a chartered accountant.
- [ ] Foreign SaaS/export-of-service tax treatment reviewed.
- [ ] International payments activated and tested in Razorpay.
- [ ] Final tax-inclusive/exclusive price wording approved.
- [ ] Monthly revenue, gateway-fee, tax, and refund records established.
- [ ] Refund/chargeback/infrastructure reserve balance established.

## 14. Launch sequence

### Before inviting users

- [ ] Close every unchecked item in the final minimum checklist below.
- [ ] Name the person monitoring payments, jobs, alerts, and support.
- [ ] Invite only 5–10 trusted users.
- [ ] Observe them without guiding them.
- [ ] Record where they become confused.

### After the first successful group

- [ ] Confirm real payment, transcription, export, download, and support journeys.
- [ ] Open to approximately 25–50 users with strict quotas.
- [ ] Raise capacity only after costs and failure rates are understood.
- [ ] Begin broader marketing only after stability is demonstrated.

### First-day operations

- [ ] Founder/developer available throughout the launch window.
- [ ] Check every payment manually.
- [ ] Check every failed export.
- [ ] Reply quickly to early support requests.
- [ ] Avoid multiple high-risk feature changes.
- [ ] Pause promotion if failure rates increase.
- [ ] Request testimonials only after successful customer projects.

## Final minimum checklist before pressing Launch

- [x] Live payment completed successfully. *(Owner-confirmed.)*
- [x] Correct plan/credits activated from that live payment. *(Owner-confirmed.)*
- [x] Payment signature verification implemented server-side.
- [ ] Razorpay webhook delivery and replay tested.
- [x] Recurring cancellation is **N/A** for current non-renewing plans.
- [x] One real refund tested. *(Owner-confirmed.)*
- [ ] Production Firebase rules deployed and reviewed.
- [x] Current tracked frontend/source does not expose active server secrets.
- [ ] Legacy credentials rotated and production secrets stored in the hosting secret manager.
- [x] Upload limits enabled.
- [x] Per-user usage and concurrency limits enabled.
- [x] Failed provider/system calls return AI allowance.
- [x] Failed exports do not consume credits.
- [x] Support inbox created. *(Owner-confirmed.)*
- [ ] Support domain/MX resolves and external send/receive succeeds.
- [x] Terms published.
- [x] Privacy Policy published.
- [x] Refund Policy published.
- [x] Acceptable Use Policy published.
- [x] Video deletion mechanism implemented.
- [x] Account deletion mechanism implemented.
- [x] Production cost alerts enabled. *(Owner-confirmed.)*
- [x] Production error logging destination and contacts configured. *(Owner-confirmed.)*
- [ ] Attach successful alert-delivery evidence.
- [ ] Rollback procedure successfully rehearsed.
- [x] App visibly marked Beta on mobile and desktop.
- [ ] Authenticated Hindi, English, mixed-language, portrait, landscape, poor-audio,
  near-limit, and corrupted-file tests completed.
- [ ] Queue/worker recovery drill completed.
- [ ] Backup restoration drill completed.
- [ ] Production API URL and production environment configuration verified.

## Launch gate

- [ ] **Ready for paid public beta**

Do not check this final box until all unchecked items in the **Final minimum
checklist** are completed with evidence.
