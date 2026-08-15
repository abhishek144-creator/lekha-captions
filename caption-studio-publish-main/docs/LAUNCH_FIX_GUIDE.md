# Lekha Captions — how to close every remaining launch item

Updated: 2 August 2026

Use this beside `LAUNCH_CHECKLIST_STATUS.md`. After completing an action, save
the evidence named below and change the corresponding ❌ to ✅.

## First: create one release-evidence folder

Create a private folder such as `launch-evidence/2026-08-beta/` outside the public
repository. Store redacted screenshots, logs, payment IDs, test results, invoices,
and approvals there. Put only a safe reference/link in `docs/DRILL_LOG.md`; never
commit secrets, full customer data, card information, or unredacted credentials.

## 1. Immediate launch blockers

### Attach evidence for completed external work

**How to fix:** Save redacted screenshots for the Razorpay payment/refund and
receipt, alert test deliveries, malware-scanner startup/test output, and the
OpenAI/Sarvam policy pages or contract terms you reviewed. Add the evidence link,
date, result, and your name to `docs/DRILL_LOG.md`.

### Make the support domain and email publicly reachable

**How to fix:**

1. In the domain registrar, add the A/CNAME records supplied by your web host.
2. Add the MX, SPF, DKIM, and DMARC records supplied by your email provider.
3. Wait for DNS propagation.
4. Confirm with `Resolve-DnsName lekhacaptions.com` and
   `Resolve-DnsName -Type MX lekhacaptions.com`.
5. Send one message from an unrelated email address to
   `support@lekhacaptions.com`, reply to it, and save both delivered messages.

### Pass the repository launch-evidence gate

**How to fix:** Complete the five drills described below—queue recovery, webhook
reconciliation, backup restore, load smoke, and authenticated staging media flow.
Record each row in `docs/DRILL_LOG.md`, complete the pentest/contact/backup
sign-offs, then run `npm run launch:evidence` until it exits successfully.

### Approve the paid public launch

**How to fix:** Do not approve it manually yet. First close every item in the
“Final launch gate” section of this guide. Then have the founder and launch
operator sign and date the release record.

### Prove payment always produces entitlement

**How to fix:** Make the cheapest live purchase. Record the Razorpay order and
payment IDs, verify the payment is captured, verify the expected plan/credits in
Firestore, refresh twice, and replay the webhook. Confirm the entitlement exists
once—not zero times and not twice. Redact IDs before saving evidence.

### Prove cross-user isolation in production

**How to fix:** Create two staging accounts. Upload with account A. While signed in
as account B, try A's project/file endpoints and expired/signed URLs. Every attempt
must return 401/403/404 and must not expose captions, metadata, or media. Save the
HTTP results and Firebase rule-simulator screenshots.

### Make refund contact usable

**How to fix:** Complete the DNS/MX procedure above, then submit a refund request
through the public Help form and confirm it arrives in the support queue with the
account email and payment ID.

### Inspect deployed Firebase rules

**How to fix:** In Firebase Console, select the production project and compare the
published Firestore/Storage rules with `firestore.rules` and `storage.rules` in
this repository. Run the Rules Playground with two different UIDs, confirm
cross-user access is denied, then save screenshots showing the project ID, rule
version, and test result without exposing secrets.

### Rotate legacy credentials

**How to fix:** Rotate Razorpay secrets, Firebase service-account keys, media URL
signing secret, credit HMAC secret, OpenAI/Sarvam keys, and any previously shared
alert/webhook tokens. Put new values only in the hosting secret manager. Revoke old
keys, redeploy, run health/payment/media smoke tests, and never paste new values
into Git or screenshots.

## 2. Account and product journey

### Complete a real Google sign-in

**How to fix:** Use a new test Google account in the production Firebase project.
Accept the current Terms/Privacy versions, sign in, confirm a single user document
is created with free defaults, and save a screenshot with the email partly redacted.

### Test sign-out and sign-in again

**How to fix:** Sign out, confirm protected pages no longer expose account data,
then sign in again and verify projects, credits, and payment history remain correct.

### Test account deletion

**How to fix:** Create a disposable account, upload a small synthetic video, delete
the account from Account settings, then verify Firebase Auth, Firestore data, source
media, exports, and signed URLs are removed or inaccessible. Record the deletion
job/reference and results.

### Run the required video matrix

Use synthetic or rights-cleared test videos—never private customer media.

- **Short Hindi:** upload, transcribe, review Devanagari words/timestamps, export.
- **Short English:** upload, transcribe, refresh, edit, export, download.
- **Mixed Hindi-English:** confirm both scripts/words survive editing and export.
- **Vertical Reel:** use 9:16 and confirm preview/export framing and safe area.
- **Landscape:** use 16:9 and confirm captions are not clipped.
- **Near 500 MB:** use staging only; confirm progress and server size enforcement.
- **Unsupported file:** rename is not enough—use a genuinely unsupported type and
  confirm a readable rejection before processing spend.
- **Corrupted video:** truncate a disposable test file and confirm safe rejection.
- **Poor audio:** use noisy rights-cleared audio and confirm accuracy warning/error.

For every file, record format, duration, size, job ID, result, processing time,
credit/allowance before and after, and exported-file playback result.

### Confirm persistence after refresh

**How to fix:** Edit several captions and timings, wait for the saved indicator,
hard-refresh, sign out/in, and reopen the project. Compare text and timestamps to a
before-refresh screenshot.

### Confirm export parity

**How to fix:** Create a project with obvious font, position, highlight, animation,
and timing choices. Export it and compare frames at the beginning, middle, and end
against the editor preview. Record any mismatch as a release-blocking bug.

### Confirm downloads on mobile and desktop

**How to fix:** Download the same completed export in Chrome desktop and one real
Android/iPhone browser. Play the entire file, check audio sync/orientation, and
confirm the signed link expires according to the plan.

### Replay a webhook safely

**How to fix:** In Razorpay webhook/test tooling, resend the same captured-payment
event at least twice. Confirm webhook signature validation succeeds, both requests
return safely, and the payment grants entitlement only once. Save redacted webhook
event IDs and the single database record.

### Test a failed payment

**How to fix:** Use Razorpay test mode to trigger a documented failed/cancelled
payment. Confirm no paid plan/credits are granted, the UI explains the failure,
and the payment-failure alert fires. Do not deliberately fail a real customer card.

## 3. Capacity and alerts

### Lower the first-launch AI ceiling

**How to fix:** In production hosting secrets set `AI_SYSTEM_DAILY_LIMIT=50`,
restart both web and worker processes, and confirm `/api/admin/recovery-summary`
shows a limit of 50. Raise it only after reviewing real cost and success rates.

### Prove every alert channel works

**How to fix:** Trigger one controlled test for Sentry/error reporting, Google Cloud
budget, transcription spend, storage, Redis/worker failure, queue length, export
failure ratio, and Razorpay payment failure. Confirm the named operator receives
each notification and record the timestamp/screenshot. Immediately restore any
service paused for the test.

## 4. Support operations

### Verify external email delivery

**How to fix:** Follow the DNS/MX procedure in section 1. Test inbound and outbound
messages with Gmail or Outlook outside your domain, verify SPF/DKIM pass in message
headers, and confirm replies are not delivered to spam.

### Start using a ticket system

**How to fix:** For the beta, import `docs/SUPPORT_TICKET_LOG.csv` into a private
Google Sheet/Notion/ticket tool. Restrict access, assign an owner, enable a daily
backup/export, and log every beta request with status, last response, and resolution.

### Test the public refund-request route

**How to fix:** Submit the Help form as a customer with a disposable payment ID,
confirm the mail becomes a ticket, reply using the prepared template, and record
the response time.

## 5. Refund, legal, and chargeback operations

### Store redacted payment/refund evidence

**How to fix:** Save the captured payment screenshot, entitlement database record,
refund ID/status, customer confirmation, and webhook result. Mask most of every ID,
email, amount if sensitive, and all personal information not needed for the drill.

### Obtain Indian legal review

**How to fix:** Send the lawyer your Terms, Privacy, Refund/Cancellation, Acceptable
Use Policy, pricing/credit model, retention schedule, processor list, business
identity, and customer countries. Apply the approved governing-law, grievance,
consumer-refund, and DPDP language before scaling paid traffic.

### Deliver a proper tax invoice

**How to fix:** Ask a CA which GST fields and numbering apply to your entity and
domestic/foreign customers. Configure an invoicing tool with legal name, address,
GSTIN if applicable, invoice number/date, customer details, description, taxable
value, tax breakdown, currency, and payment reference. Test one invoice end to end.

### Decide lawful IP/device evidence retention

**How to fix:** With counsel, document why IP/device data is needed, fields stored,
legal basis, access controls, retention/deletion period, and privacy disclosure.
Collect the minimum necessary; do not collect it “just in case.”

### Store support conversations

**How to fix:** Keep every payment/refund conversation in the private ticket
system, link it to the payment/job ID, restrict staff access, and apply the support
retention schedule. Do not store passwords, OTPs, CVVs, or full card numbers.

### Review refund evidence

**How to fix:** A second operator—or you using a written checklist—must compare the
payment, entitlement, usage, refund decision, Razorpay status, and customer email.
Sign/date the review in the ticket.

### Run a chargeback drill

**How to fix:** Create a fictional dispute case. Assemble receipt/invoice, accepted
terms version, entitlement, usage/export/delivery logs, support conversation, and
refund status. Confirm you can export one redacted evidence bundle within Razorpay's
response deadline. Do not submit a fake dispute to a bank.

### Finalise business identity and dispute wording

**How to fix:** Replace generic identity/address/venue text with the lawyer-approved
legal entity or proprietor name, registered/contact address, governing law, court
venue or dispute mechanism, and effective date across all legal pages.

### Make the abuse address operational

**How to fix:** Create `abuse@lekhacaptions.com` or route it to the monitored support
queue. Publish it in the Acceptable Use Policy, test inbound/outbound delivery, and
document escalation for illegal or urgent content.

## 6. Privacy completion

### Store provider retention/training evidence

**How to fix:** Save dated copies or screenshots of the exact OpenAI and Sarvam
account/contract settings covering training, retention, abuse logs, subprocessors,
and international processing. If they differ from the Privacy Policy, update the
policy before accepting uploads.

### Make privacy requests reachable

**How to fix:** Publish and test `privacy@lekhacaptions.com` or the working support
address. Add a private request log and procedures for access, correction, deletion,
export, identity verification, response deadlines, and completion evidence.

### Add controller identity and postal address

**How to fix:** Add the lawyer-approved business/controller name, postal address,
privacy email, and effective date to the Privacy Policy and footer/contact page.

### Complete GDPR legal bases and transfers

**How to fix:** For each data purpose, document the lawful basis, processor,
retention, rights, and international-transfer mechanism. Add EEA/UK rights and the
complaint route. Have counsel review before actively marketing to Europe.

### Complete DPDP grievance details

**How to fix:** With Indian counsel, identify the required grievance contact or
officer, publish their contact route and response process, and maintain a grievance
register. Do not invent statutory titles without advice.

### Review processor agreements

**How to fix:** List every processor—hosting, Firebase/Google Cloud, OpenAI, Sarvam,
Razorpay, Sentry, email, analytics, and support tools. Store the applicable DPA/terms,
subprocessor list, retention, security, breach notice, deletion, and transfer terms.

## 7. Firebase and upload security

### Prove malware scanning works

**How to fix:** In isolated staging, upload the scanner vendor's standard harmless
test signature (for example its documented EICAR procedure). Confirm rejection,
customer-safe wording, security log/alert, and no durable storage. Never test with
real malware or customer data.

### Enable Firebase App Check

**How to fix:** Register the web app in Firebase App Check, choose the supported web
attestation provider, add the public site key to frontend deployment configuration,
deploy, monitor metrics, then enable enforcement for Firestore/Storage and other
supported resources. Test legitimate web access and direct scripted rejection.

### Separate development and production Firebase projects

**How to fix:** Create distinct Firebase projects, service accounts, buckets, Auth
providers, App Check apps, and billing alerts. Put each environment's values only in
its deployment secrets. Confirm local development cannot see production users/media.

### Deploy and test production rules

**How to fix:** Select the production Firebase project deliberately, deploy only the
reviewed Firestore/Storage rules using your normal Firebase CLI workflow, then run
the two-account isolation tests and Rules Playground checks. Save the deployment ID
and screenshots.

### Enable cloud budget alerts

**How to fix:** In Google Cloud Billing, create low first-beta budget thresholds
(for example 25%, 50%, 75%, and 100%) and route notifications to the monitored
operator channel. Trigger/test notification routing where supported.

## 8. Failure states

### Add a Cancelled job state

**How to fix:** Add `cancelled` to the backend job-state enum/schema, create an
authenticated owner-only cancel endpoint, stop queued work safely, release reserved
allowance where appropriate, make cancellation idempotent, display it in history,
and add backend/frontend tests. Do not kill an FFmpeg process without cleanup logic.

### Add a Refunded payment state

**How to fix:** Store refund status separately from media-job status. Validate
Razorpay refund webhooks, link refund/payment/user records, handle partial refunds
and repeated/out-of-order events idempotently, display the state in Payments, and
test `created → processed/failed` transitions.

### Show an ID for every transcription failure

**How to fix:** Ensure every process request receives a durable request/job ID before
provider work begins. Include it in all 4xx/5xx customer-safe errors, logs, history,
and support links. Add contract tests for provider exception, timeout, no speech,
invalid media, and quota failure; do not expose stack traces.

## 9. Monitoring dashboard

Add production Admin Ops cards for each metric below. Use server-owned events only;
never let unauthenticated analytics fabricate operational counters.

- **Sign-ups:** count newly created user documents by UTC day.
- **Uploads:** count accepted uploads, not picker opens.
- **Completed transcriptions:** count successful process jobs once by job ID.
- **Completed exports:** count stored valid exports once by job ID.
- **Failure percentage:** failures divided by terminal jobs over a defined window.
- **Average processing time:** completed-at minus started-at; also show p95.
- **Cost per job:** provider minutes/calls plus render/storage estimate; label estimates.
- **Successful payments:** captured, verified, uniquely granted payments.
- **Failed payments:** Razorpay failure events without entitlement.
- **Support requests:** ticket count by received date/status.

**How to fix:** Extend the existing admin summary/analytics endpoints with these
server-owned aggregates, render them in `src/pages/AdminOps.jsx`, add date/window
labels, tests, and alert thresholds, then compare one day's dashboard with raw logs.

### Reduce maximum duration without redeployment

**How to fix:** Add `max_upload_duration_seconds` to the Firestore service-controls
document and Admin Ops. Clamp it server-side below the plan/global maximum and read
it during upload/process validation. Log changes, cache briefly, and test pause/
restore behavior. Never trust a frontend-only limit.

### Rehearse rollback

**How to fix:** In staging, deploy the current release, deploy a harmless visibly
different test release, then use the host's rollback/promote-previous command.
Confirm frontend/API/worker versions, health, payment webhooks, and queued jobs after
rollback. Record duration, operator, deployment IDs, and evidence in `DRILL_LOG.md`.

## 10. Customer communication

### Publish a demonstration video

**How to fix:** Use owned/synthetic footage to show upload, generation, editing,
styling, export, and download in under two minutes. Blur test emails/IDs, add captions,
host it reliably, and link it from How It Works/FAQ.

### Publish known limitations

**How to fix:** Add a page covering accuracy variation, mixed-language limitations,
audio quality, supported formats/limits, beta availability, processing variability,
browser/device constraints, and what users must review before publishing.

### Publish a working contact address

**How to fix:** Complete DNS/MX and external delivery testing, then show the working
support/privacy/abuse routes consistently in footer, checkout, Help, and legal pages.

### Publish release notes

**How to fix:** Add a simple dated changelog page. For each release list customer-
visible improvements, important fixes, known issues, and migrations without exposing
security details. Link it from the footer or Help page.

## 11. Business and accounting

### Confirm a dedicated business bank account

**How to fix:** Open/assign an account used only for business receipts and expenses,
connect Razorpay settlements, restrict access, and document monthly reconciliation.

### Establish invoicing

**How to fix:** Follow the tax-invoice procedure in section 5, choose an invoicing/
accounting system, define numbering, and reconcile invoices to Razorpay settlements.

### Run payment/refund reconciliation

**How to fix:** For a chosen day, compare Razorpay orders/payments/refunds/fees and
settlements with app payment/entitlement records and bank entries. Resolve every
difference and attach a redacted reconciliation report.

### Obtain GST advice

**How to fix:** Give a CA your entity details, expected Indian/foreign customers,
prices, credit model, gateway flow, and revenue forecast. Get written guidance on
registration, place/time of supply, invoicing, returns, TDS/TCS if applicable, and
record retention.

### Review foreign SaaS/export-of-service treatment

**How to fix:** Ask the CA/lawyer about export-of-service conditions, foreign-currency
receipts, LUT/GST treatment, place of supply, RBI/FEMA records, and country-specific
tax obligations before marketing internationally.

### Activate international payments

**How to fix:** Complete Razorpay's international activation/KYC, configure allowed
currencies and pricing, disclose FX/tax treatment, then run an approved small test
transaction and refund. Confirm fraud controls and settlement records.

### Approve tax wording

**How to fix:** Decide with the CA whether displayed prices include applicable taxes.
Use the same wording on pricing, checkout, receipt, invoice, Terms, and Refund Policy.

### Keep monthly financial records

**How to fix:** Each month reconcile gross sales, taxes, Razorpay fees, refunds,
chargebacks, settlements, bank receipts, AI/render/storage costs, and invoices. Lock
the period and back up the report.

### Keep a reserve

**How to fix:** Set a written reserve rule based on expected refunds, chargebacks,
gateway settlement delays, and at least one infrastructure billing cycle. Keep that
amount untouched in the business account and review monthly with the CA.

## 12. Launch execution

### Close the final checklist

**How to fix:** Work from the final section of `LAUNCH_CHECKLIST_STATUS.md`. Each ✅
must have a code/test result or evidence link—not memory alone.

### Assign launch roles

**How to fix:** Name one primary and backup for payments, jobs/worker, infrastructure
alerts, privacy/security, and support. Write contact details and escalation order in
the private release record.

### Run the 5–10 user beta

**How to fix:** Invite trusted users individually, give strict quotas, observe without
leading them, and log where they stop, misunderstand pricing, or fail to export.

### Record confusion

**How to fix:** Use a sheet with user ID, task, timestamp, observation, severity,
job/payment ID, and proposed fix. Do not record unnecessary personal information.

### Confirm the real end-to-end journey

**How to fix:** For at least one user, record successful sign-in → payment → upload →
transcription → edit → export → download → support request. Verify costs and records.

### Expand to 25–50 users

**How to fix:** Expand only if payment/export success and support load meet your
thresholds. Keep the AI ceiling and per-user quotas low and monitor continuously.

### Raise capacity gradually

**How to fix:** Review daily provider spend, failure percentage, queue p95, support
volume, and cost per successful export. Raise one limit at a time and record why.

### Begin broader marketing

**How to fix:** Require stable metrics for a defined period, no open P0/P1 incidents,
working support, sufficient reserve/capacity, and signed founder approval.

### First-day staffing and behavior

- **Founder/developer available:** block the launch window on calendars and assign backup.
- **Check payments:** reconcile every early captured payment with one entitlement.
- **Check failed exports:** inspect every job ID, cause, credit result, and retry.
- **Reply quickly:** monitor the ticket queue and meet the one-business-day promise.
- **Avoid risky changes:** freeze nonessential features; use only reviewed hotfixes.
- **Pause promotion:** define failure/cost/queue thresholds that trigger kill switches.
- **Testimonials:** ask only after a user completes and downloads a successful project.

## 13. Required recovery drills

### Queue/worker recovery

**How to fix:** In staging, pause/stop one worker, submit a disposable export, verify
the queue/readiness/alert behavior, restart the worker, and confirm the same job
finishes once without double credit use. Record logs and recovery time.

### Webhook/reconciliation recovery

**How to fix:** In test/staging, temporarily make webhook delivery fail, create a test
payment, restore delivery, replay events, and run the reconciliation endpoint/job.
Confirm exactly one entitlement and record event/payment IDs redacted.

### Backup restoration

**How to fix:** Export a small non-production dataset, restore it into an isolated
project/namespace, verify counts and representative records/media links, then delete
the isolated copy according to policy. Never restore over production.

### Load smoke

**How to fix:** Against staging, run the repository load-smoke command with conservative
concurrency. Watch CPU/memory, queue, Redis, provider spend, p95, failures, and alerts.
Stop immediately if limits are approached; record the exact command and results.

### Authenticated staging media flow

**How to fix:** Use a disposable signed-in staging account and rights-cleared media to
run upload, process, edit, export, download, refresh, retry/failure, and deletion.
Record job IDs and allowance/credit changes without committing tokens.

### Production configuration verification

**How to fix:** In the hosting dashboard—not committed files—verify real values exist
for the production API URL, `APP_ENV=production`, Redis, media signing, CORS, Firebase
Admin/bucket, Razorpay, providers, scanner, Sentry, support/abuse/privacy contacts,
retention, and limits. Redeploy, then run health/readiness/version and smoke tests.

## 14. Final launch gate

### Razorpay webhook delivery and replay

**How to fix:** Complete the webhook procedure in section 2 and attach evidence.

### Production Firebase rules

**How to fix:** Complete the deployment and two-account isolation procedures in
sections 1 and 7 and attach the production rule version.

### Legacy secrets and secret manager

**How to fix:** Complete the credential-rotation procedure in section 1, confirm the
old keys are revoked, and run smoke tests with the new host-managed secrets.

### Support domain/MX

**How to fix:** Complete the DNS/MX and external send/receive procedure in section 1.

### Alert evidence

**How to fix:** Complete the controlled alert tests in section 3 and link screenshots.

### Rollback rehearsal

**How to fix:** Complete the staging rollback procedure in section 9 and log it.

### Complete media matrix

**How to fix:** Complete every media test in section 2 and attach the result table.

### Queue recovery and backup restore

**How to fix:** Complete the two drills in section 13 and add `PASS` rows to
`docs/DRILL_LOG.md` with evidence links and owner names.

### Mark “Ready for paid public beta”

**How to fix:** Run `npm run launch:check`. When it passes, review the private release
record, verify there are no open P0/P1 issues, and obtain dated founder/operator
approval. Only then change the final ❌ to ✅ and enable paid promotion gradually.
