# Drill Log (Evidence)

Keep one row per completed drill.

| Date (UTC) | Drill Type | Scenario | Result | Evidence Link | Owner |
|---|---|---|---|---|---|
| 2026-08-04 | Queue/worker recovery | Restarted the staging worker and verified Redis, RQ queue listening, and scheduler recovery | PASS | [Staging drill evidence](STAGING_DRILL_EVIDENCE_2026-08-04.md#queueworker-recovery--pass) | Launch operator (private roster) |
| 2026-08-04 | Load smoke | 200 concurrent readiness/version/operator endpoint requests with no network or 5xx failures | PASS | [Staging drill evidence](STAGING_DRILL_EVIDENCE_2026-08-04.md#load-smoke--pass) | Launch operator (private roster) |
| 2026-08-04 | Backup restore | Exported three synthetic Firestore records, restored them into an isolated namespace, verified count and SHA-256, then deleted both namespaces | PASS | [Staging drill evidence](STAGING_DRILL_EVIDENCE_2026-08-04.md#backup-restoration--pass) | Launch operator (private roster) |
| 2026-08-05 | Payment reconciliation | Ran the operator-authorized deployed reconciliation endpoint across a seven-day lookback; zero pending records and zero errors | PASS | [Staging drill evidence](STAGING_DRILL_EVIDENCE_2026-08-04.md#payment-reconciliation--pass) | Launch operator (private roster) |
| 2026-08-05 | Frontend rollback | Published the previous staging editor deploy, verified the rolled-back asset and Railway readiness, then restored the current deploy | PASS | [Staging drill evidence](STAGING_DRILL_EVIDENCE_2026-08-04.md#frontend-rollback--pass) | Launch operator (private roster) |
| 2026-08-05 | Account deletion | Created a disposable Firebase user with seeded Firestore and Storage data, deleted it through the deployed endpoint, and verified complete removal | PASS | [Staging drill evidence](STAGING_DRILL_EVIDENCE_2026-08-04.md#account-deletion--pass) | Launch operator (private roster) |
| 2026-08-06 | Support intake | Submitted, assigned, resolved, and closed a synthetic deployed support request with no customer data | PASS | [Staging drill evidence](STAGING_DRILL_EVIDENCE_2026-08-04.md#support-intake-workflow--pass) | Launch operator (private roster) |
| 2026-08-06 | Launch-fix deployment | Published the editor and API updates, verified three public routes, API readiness, CORS, and echoed request references | PASS | [Staging drill evidence](STAGING_DRILL_EVIDENCE_2026-08-04.md#launch-fix-deployment--pass) | Launch operator (private roster) |
| 2026-08-21 | Production deployment readiness | Verified production marketing/editor HTTPS routing, the Netlify editor release, Railway service availability, and API queue readiness | PASS | [Production verification](PRODUCTION_VERIFICATION_2026-08-21.md#netlify-frontend--pass) | Launch operator (private roster) |
| 2026-08-21 | Firebase rules/App Check | Inspected the deployed ownership rules and enabled App Check enforcement for both Firestore and Storage | PASS | [Production verification](PRODUCTION_VERIFICATION_2026-08-21.md#firebase-security--pass) | Launch operator (private roster) |
| 2026-08-21 | Authenticated production media | Google signup, App Check bootstrap, real MOV upload, Hindi transcription, six-caption save/refresh, RQ 1080p render, signed download, and decoded output inspection | PASS | [Production verification](PRODUCTION_VERIFICATION_2026-08-21.md#demo-media-supplied-by-owner--pass-for-tested-hindiportrait-path) | Launch operator (private roster) |
| 2026-08-21 | Template catalog CSP regression | Replaced the browser-blocked runtime template evaluator with an allow-listed parser; production chunk contains no `Function(` evaluator and source template contracts pass | PASS | [Production verification](PRODUCTION_VERIFICATION_2026-08-21.md#netlify-frontend--pass) | Launch operator (private roster) |
| 2026-08-21 | Template parity contract | Updated stale browser-measurement assertions for the server-authoritative export pipeline; motion/visual audits pass and T166 LC yellow-accent export scope passes | PASS | [Production verification](PRODUCTION_VERIFICATION_2026-08-21.md#netlify-frontend--pass) | Launch operator (private roster) |
| 2026-08-22 | Razorpay live lifecycle evidence | Verified live capture and refund records, server verification, receipt/refund email, twice-replayed webhook idempotency, zero-error production reconciliation, and the owner's failed-checkout test | PASS | [Redacted Razorpay evidence](RAZORPAY_EVIDENCE_2026-08-22.md); [Owner confirmations](OWNER_CONFIRMATIONS_2026-08-22.md#failed-razorpay-checkout) | Launch operator (private roster) |
| 2026-08-22 | Support mailbox send/receive/reply | Owner confirmed an external send-and-reply test; Spacemail screenshot shows inbound messages in the live `support@lekhacaptions.com` inbox | PASS | [Owner confirmations](OWNER_CONFIRMATIONS_2026-08-22.md#support-mailbox) | Launch operator (private roster) |
| 2026-08-28 | Authenticated staging media flow | Authenticated upload, processing, export, download, and cleanup were owner-confirmed against the staging journey | PASS | [Owner confirmations](OWNER_CONFIRMATIONS_2026-08-28.md#account-isolation-and-staging-media-drill) | Launch operator (private roster) |
| 2026-08-28 | Two-user cross-account isolation | Two disposable accounts were used to confirm that one account could not access the other account's media | PASS | [Owner confirmations](OWNER_CONFIRMATIONS_2026-08-28.md#account-isolation-and-staging-media-drill) | Launch operator (private roster) |
| 2026-08-28 | Production malware rejection | A scanner rejection was owner-confirmed for a disposable suspicious-file test without retaining customer data | PASS | [Owner confirmations](OWNER_CONFIRMATIONS_2026-08-28.md#malware-scanner-evidence) | Launch operator (private roster) |
| 2026-08-28 | Production alert delivery | Production alert routing was owner-confirmed for the recorded provider test | PASS | [Owner confirmations](OWNER_CONFIRMATIONS_2026-08-28.md#alert-delivery-evidence) | Launch operator (private roster) |
| 2026-08-28 | Real-video language/format matrix | Real Hindi, English, and Hinglish videos in the recorded formats completed the owner-confirmed media matrix | PASS | [Owner confirmations](OWNER_CONFIRMATIONS_2026-08-28.md#real-video-matrix) | Launch operator (private roster) |

Do not mark a drill `PASS` without a durable evidence link (logs, dashboard snapshot,
ticket, or incident document) and the name of the operator who verified recovery.

## Required Monthly Drills
- Queue/worker outage and recovery.
- Payment webhook outage and reconciliation recovery.
- Backup restore check in non-production.
- Load smoke run (`python scripts/load_smoke.py --base-url ...`).
- Authenticated staging upload/process/export run (`python scripts/staging_smoke.py ...`).
