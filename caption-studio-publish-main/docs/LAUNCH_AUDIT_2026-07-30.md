# Lekha Captions launch audit

Reviewed: 30 July 2026 (IST)

## Decision

**✗ No-go for a paid public launch today.**

An invite-only, unpaid staging beta is reasonable after the deployment environment
is corrected. Do not accept real payments until every item in **Paid-launch
blockers** is closed with evidence.

Legend:

- **✓** verified in source, automated tests, or local browser testing
- **⚠** implemented or partially ready, but production/external evidence is still required
- **✗** missing, unsafe, or a launch blocker

## Paid-launch blockers

- **✗ Production configuration:** the current local environment is a development/test
  configuration. `APP_ENV=production`, the real `VITE_API_BASE_URL`, Redis, a media
  signing secret, production CORS origins, production Firebase credentials, and
  the remaining production secrets must be configured in the hosting platform.
- **✗ Live payment evidence:** no real Razorpay payment, captured-state check,
  webhook replay, failed payment, refund, or reconciliation run was performed.
- **✗ Support channel:** `lekhacaptions.com` and `www.lekhacaptions.com` returned
  NXDOMAIN/unresolved during this audit, so `support@lekhacaptions.com` cannot be
  relied upon yet.
- **✗ Firebase production verification:** the repository rules are restrictive,
  but deployment to the intended production Firebase project was not verified.
  App Check was not found in the app.
- **✗ Launch evidence gate:** queue/worker recovery, payment webhook/reconciliation,
  backup restore, load smoke, and authenticated staging media-flow evidence are
  missing. Periodic pentest, monitored production contacts, and quarterly
  backup/restore sign-offs are also pending.
- **✗ Email receipt/invoice:** no transactional email/invoice delivery integration
  was found.

## Fixes completed during this audit

- **✓ Fixed Indic/Hindi transcription integration:** the installed Sarvam SDK
  expects `api_subscription_key`, not `api_key`, and returns word timestamps in a
  nested timestamp payload. The processor now supports the current and legacy
  response formats.
- **✓ Added provider/process timeouts:** transcription calls and FFmpeg audio
  extraction now have bounded timeouts configurable from the environment.
- **✓ Added an emergency payment kill switch:** an administrator can pause new
  payments before a Razorpay order is contacted or created.
- **✓ Added new-account throttling:** brand-new account bootstrap is limited by IP
  and user identity; existing accounts remain unaffected.
- **✓ Added support intake:** the Help page now prepares a structured support email
  with account, job, payment, browser/device, video, and incident details.
- **✓ Added support operations material:** a ticket-log CSV template and canned
  response/refund playbook were added under `docs/`.
- **✓ Normalised supported-video wording:** public upload and support text now
  consistently lists MP4, MOV, WebM, MKV, and AVI.

## 1. Launch blockers

- **⚠ Charge without entitlement:** server-side signature verification,
  captured-state verification, amount/plan binding, and transactional/idempotent
  entitlement grants exist. A live payment and webhook replay are still required.
- **✓ Cross-user access in application code:** authenticated ownership checks,
  per-user database paths, signed media URLs, and tenant checks exist.
- **⚠ Cross-user access in production Firebase:** repository rules are deny-by-default,
  but the deployed production rules have not been inspected.
- **✗ Cancellation/refund contact:** plans currently state that they do not
  auto-renew, so recurring cancellation is not applicable. Refund contact is
  published, but its domain/mailbox is not operational.
- **✓ Unbounded processing cost:** upload size, duration, plan minutes, daily
  exports, concurrent jobs, retries, timeouts, retention, per-endpoint limits,
  system AI quota, and service kill switches exist.
- **✓ Failed jobs consuming export credits:** an export credit is recorded only
  after a valid rendered asset is stored; retries are idempotent.
- **✓ Provider/system failure reservations:** AI quota reservations are released
  on provider or system failure. A completed provider call that returns no speech
  remains counted.
- **✓ Failed job observability:** export jobs have IDs, durable statuses,
  structured logs, failure details, retry controls, and dead-letter recovery.
- **⚠ Firebase public access:** checked-in Firestore and Storage rules are
  restrictive; production deployment is unverified.
- **⚠ Secret exposure:** no current tracked `.env` or service-account file was
  found. The public Git history contains old Razorpay test key IDs (not secret
  keys). Rotate any credentials that were ever used by older public code.

## 2. Complete customer journey

### Account

- **✗ Email sign-up:** not implemented; the login page explicitly offers Google only.
- **⚠ Google sign-in:** UI and Firebase integration are present; a real production
  sign-in was not completed.
- **✗ Email verification:** not applicable to the current Google-only flow and not
  implemented as a separate email-auth journey.
- **✗ Forgotten password:** not applicable to Google-only auth and not implemented.
- **⚠ Sign-out/sign-in:** code paths exist; live identity-provider testing remains.
- **✓ Account deletion:** permanent account deletion is available in the account UI
  and backend.
- **✗ Same email through two sign-in methods:** only one sign-in method is offered.
- **✓ Responsive rendering:** landing, login, dashboard, upload, legal, FAQ, and
  support routes were checked on desktop and a 390px mobile viewport without
  horizontal overflow.

### Product

- **✗ Real media matrix:** Hindi, English, mixed Hindi-English, portrait, landscape,
  maximum-size, corrupt/unsupported, and poor-audio files were not run through an
  authenticated staging environment during this audit.
- **✓ Upload feedback:** progress, validation, maximum size, supported formats, and
  duration expectations are visible.
- **✓ Processing feedback:** users see processing phases and readable errors.
- **⚠ Caption persistence:** saved project/history paths exist; refresh persistence
  still needs an authenticated staging test.
- **⚠ Export correctness/download:** renderer and download code plus parity tests
  exist; real-device media testing is still required.
- **✓ Retry:** failed export jobs can be retried safely.
- **✓ Credit protection:** failed exports do not consume credits.
- **✓ Duplicate protection:** process/export locks and payment/export idempotency
  keys prevent repeated concurrent submissions.

### Payment

- **✗ Live Razorpay checkout:** not tested; local credentials are in test mode.
- **✓ Server-side verification in code:** payment signature is verified on the server.
- **✓ Captured-state check in code:** entitlement requires a captured payment.
- **✓ Correct plan/credits in code:** order amount, currency, plan notes, user, and
  entitlement are bound and validated.
- **✗ Invoice/payment email:** no email delivery integration was found.
- **✓ Refresh/replay safety in code:** payment ID and idempotency records prevent
  duplicate entitlements.
- **✓ Webhook idempotency in code:** webhook HMAC is validated and event/payment
  handling is transactional and replay-safe.
- **✓ Failed-payment protection in code:** non-captured payments do not activate plans.
- **✗ Real cancellation/refund test:** not performed.

## 3. Usage and cost controls

- **✓ Maximum upload size:** 500 MB, enforced while streaming and validated again.
- **✓ Maximum duration:** global maximum is 180 seconds; lower plan limits apply.
- **✓ Supported formats:** file extension, MIME/content, and FFprobe validation exist.
- **✓ Plan transcription allowance:** plan duration/usage controls exist.
- **✓ Daily exports:** plan-based daily export limits exist.
- **✓ Per-user concurrency:** one transcription and one export at a time per user.
- **✓ Retries:** export worker retries are bounded.
- **✓ Timeouts:** upload/probe, transcription, FFmpeg, queue, and browser polling
  have bounded timeouts.
- **✓ Retention:** uploads default to six hours; exports are retained for a bounded
  two-to-seventy-two-hour window.
- **✓ Endpoint rate limits:** upload, process, export-failure, payment, promotion,
  translation, language detection, analytics, and new-account limits exist.
- **✓ System processing quota:** daily system AI work is capped.
- **✓ Pause processing:** durable admin switches cover sign-ups, payments, uploads,
  transcription, exports, and maintenance mode.
- **✗ Spending alerts:** Firebase/Google Cloud, transcription-provider, and storage
  billing alerts were not verified.
- **⚠ Operational alerts:** code supports structured alerting/SLO signals, but the
  production Sentry/contacts/dashboard wiring is not evidenced.
- **✗ Dynamic emergency duration reduction:** duration can be changed in
  configuration/code but there is no no-deploy admin slider.

## 4. Customer support

- **✗ Working support mailbox:** the address is shown throughout the product, but its
  domain does not currently resolve.
- **✓ In-app Help/Support link:** present.
- **✓ Contact form:** present and mobile-tested; it prepares a mailto message.
- **✓ FAQ/help page:** present.
- **✓ Failed-job support path:** failures show a job ID/support reference and point
  users to help.
- **✓ Support log template:** `docs/SUPPORT_TICKET_LOG.csv`.
- **✓ Intake fields:** email, job/project ID, payment ID, device/browser, video
  details, and incident description are captured.
- **✓ Sensitive-data warning:** users are told not to send passwords, OTPs, full
  card numbers, or CVVs.
- **✓ Response promise:** one-business-day response wording is published without
  promising resolution.
- **✓ Canned replies:** payment, export, transcription, format, refund,
  cancellation, deletion, and privacy replies are in the playbook.

## 5. Refund and cancellation

- **✓ Customer-facing policy:** a Refund and Cancellation Policy route exists and
  is linked from the footer and checkout.
- **✓ Eligibility rules:** duplicate payment, failed activation, platform failure,
  and legally required refunds are covered.
- **✓ Consumed allowance rule:** the policy permits reduced/denied refunds after
  significant consumption.
- **✓ Renewal disclosure:** current plans are described as fixed-period,
  non-auto-renewing access.
- **✓ Credit expiry disclosure:** published.
- **✓ Account deletion distinction:** published.
- **✓ Internal process/playbook:** payment lookup, usage review, decision, Razorpay
  action, recordkeeping, customer reply, and status tracking are documented.
- **✗ Real refund:** no captured live payment/refund was performed.
- **⚠ Legal review:** Indian counsel has not been evidenced.

## 6. Chargeback records

- **✓ Payment/entitlement records:** payment, order, plan, credits, timestamps, and
  idempotency data are stored.
- **✓ Usage/export records:** job/export usage and delivery information are stored.
- **✓ Consent records:** terms/privacy versions and consent timestamps are supported.
- **✓ Support/refund log schema:** templates now exist.
- **⚠ Invoice and customer email evidence:** not automated.
- **⚠ IP/device evidence:** captured selectively; confirm necessity, retention, and
  lawful use with counsel.
- **✗ End-to-end dispute drill:** not performed.

## 7. Legal pages

- **✓ Terms of Service:** published and linked.
- **✓ Privacy Policy:** published and linked.
- **✓ Refund and Cancellation Policy:** published and linked.
- **✓ Acceptable Use Policy:** published and linked.
- **✓ Contact/Support:** published and linked.
- **⚠ Cookie notice:** no non-essential advertising cookie system was found. Add a
  consent notice before enabling non-essential analytics/advertising cookies.
- **✓ Core product/legal disclosures:** AI error risk, plan/credit terms,
  availability, review responsibility, content rights, suspension, liability, and
  prohibited uses are substantially covered.
- **⚠ Final legal identity/jurisdiction:** governing law says India, but the final
  registered business identity, address, venue, privacy legal bases, and grievance
  details require completion and lawyer review.

## 8. Privacy and video data

- **✓ Categories/purposes/providers/retention/deletion/transfers:** substantially
  described in the Privacy Policy.
- **✓ Product training statement:** the policy says Lekha Captions does not use
  customer videos to train its own public models.
- **⚠ Processor consistency:** OpenAI API data is not used for training by default.
  Sarvam's published retention/training statements vary by product/plan, so confirm
  the exact account contract and retention setting before making an unconditional
  promise.
- **✓ Data deletion:** file and account deletion mechanisms exist.
- **⚠ GDPR/DPDP completeness:** access/correction/deletion concepts are present,
  but controller identity/address, legal bases, transfer mechanism, grievance
  officer/contact, and processor agreements need final review.

## 9. Firebase and file security

- **✓ Checked-in Storage rules:** deny client reads/writes; server Admin access is used.
- **✓ Checked-in Firestore rules:** users can read only their own user/payment data;
  client writes are denied.
- **✓ Signed media access:** media URLs are short-lived and user-bound.
- **✓ Admin secrets stay server-side in current source.**
- **✓ Automatic retention cleanup:** upload/export janitor paths exist.
- **✓ Server validation:** size, extension, MIME/content, FFprobe, and suspicious
  file scanning policy exist. Production refuses unscanned uploads unless an
  explicit unsafe override is chosen.
- **✗ App Check:** not found.
- **✗ Production deployment proof:** rules/project separation/budget alerts were
  not verified in Firebase Console.

## 10. Failure handling

- **✓ Visible states:** upload, processing phases, export queue/render/finalise,
  completed, failed, and retry experiences exist.
- **⚠ Exact requested state vocabulary:** cancelled and refunded are not general
  media-job states; refund is a payment/support state.
- **✓ Job ID:** displayed for export failures/support.
- **✓ Readable errors:** customer-safe error mapping exists.
- **✓ Retry and idempotency:** present.
- **✓ Credit restoration/protection:** failed export does not consume a credit.
- **✓ Timeouts:** jobs cannot remain processing indefinitely; stale jobs can be
  marked failed/recovered.

## 11. Monitoring and emergency controls

- **✓ Product funnel counters:** analytics/SLO code covers sign-up-related activity,
  uploads, processing, exports, failures, timings, and payment outcomes.
- **⚠ Per-job cost dashboard:** system usage counters exist, but a verified
  production cost-per-job dashboard was not found.
- **✓ Emergency switches:** sign-ups, payments, uploads, transcription, exports,
  and maintenance mode can be paused from Admin Ops.
- **⚠ Rollback:** repository/deployment definitions exist; a successful rollback
  drill is not documented.
- **✗ Production monitoring evidence:** queue recovery, load, backup restore,
  payment reconciliation, and authenticated staging flow evidence are missing.

## 12. Customer communication

- **✓ Pricing and plan comparison:** published.
- **✓ Supported languages/formats/limits:** published in product/help surfaces.
- **✓ How it works and FAQ:** published.
- **✓ Accuracy caveat:** the product does not promise 100% accuracy and explains
  the impact of audio quality, accents, noise, and language mixing.
- **⚠ Processing-time expectations:** described generally, not as an externally
  measured production range.
- **✗ Demonstration video:** no verified public demo video was found.
- **⚠ Known limitations/changelog:** limitations appear across help/legal pages;
  a dedicated public changelog was not verified.
- **✗ Reachable public site:** the intended domain currently does not resolve.

## 13. Business and accounting

- **✗ Business bank account:** external; no evidence reviewed.
- **✗ Proper invoice process:** no automated invoice email; accounting setup not reviewed.
- **✗ Payment/refund reconciliation evidence:** job exists, drill evidence is missing.
- **✗ GST/CA advice:** external; no evidence reviewed.
- **✗ Foreign SaaS/export-of-service advice:** external; no evidence reviewed.
- **✗ Razorpay international payments:** not verified.
- **✓ Price/tax wording:** plan prices are published; confirm the final tax-inclusive
  treatment with a CA.
- **✗ Monthly accounting and reserve policy:** external; no evidence reviewed.

## 14. Tomorrow's launch sequence

- **⚠ 5–10 trusted users:** proceed only on staging/invite-only after production
  configuration, Firebase rules, and support contact are working.
- **✗ Paid 25–50-user beta:** do not start until the paid-launch blockers are closed.
- **✓ Beta positioning:** public surfaces visibly label the service as beta.
- **⚠ Founder monitoring:** Admin Ops and job/payment tooling exist; assign named
  people and production contacts before inviting users.
- **✓ Gradual rollout advice:** keep quotas strict, inspect every failed payment/job,
  pause promotion on rising failure rates, and avoid high-risk launch-day changes.

## Minimum launch checklist

- **✗** Live payment completed successfully.
- **✗** Credits activated from a live captured payment.
- **✓ / ✗ live proof** Server-side signature verification is implemented; live proof missing.
- **✓ / ✗ live proof** Webhook validation/idempotency is implemented; replay evidence missing.
- **N/A for current plans** Recurring cancellation; plans do not auto-renew.
- **✗** One real refund tested.
- **⚠** Firebase rules reviewed in source; production deployment unverified.
- **⚠** Current source does not expose secrets; rotate legacy credentials and configure host secrets.
- **✓** Upload limits.
- **✓** Per-user usage/concurrency limits.
- **✓** Failed exports preserve credits.
- **✗** Working support email/domain.
- **✓** Terms published.
- **✓** Privacy Policy published.
- **✓** Refund Policy published.
- **✓** Acceptable Use Policy published.
- **✓** Video deletion.
- **✓** Account deletion.
- **✗** Cost alerts verified.
- **⚠** Error logging implemented; production sink/contacts unverified.
- **✗** Rollback drill evidence.
- **✓** App marked Beta.

## Verification results

- **✓ Backend:** 82 tests passed.
- **✓ Frontend:** ESLint passed.
- **✓ Type safety:** TypeScript check passed.
- **✓ Release contracts:** 124 checks passed.
- **✓ Production build:** passed with performance budgets when supplied a temporary,
  non-production API URL.
- **✓ Dependency gate:** no unreviewed high/critical advisories; two documented
  exceptions have a 31 October 2026 review date.
- **✓ Browser:** landing, login, dashboard, upload, support, FAQ, and legal routes
  rendered on desktop/mobile without horizontal overflow.
- **✗ Launch evidence:** five required evidence categories and three sign-offs remain.

