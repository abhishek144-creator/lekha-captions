# Drill Log (Evidence)

Keep one row per completed drill.

| Date (UTC) | Drill Type | Scenario | Result | Evidence Link | Owner |
|---|---|---|---|---|---|
| 2026-08-04 | Queue/worker recovery | Restarted the staging worker and verified Redis, RQ queue listening, and scheduler recovery | PASS | [Staging drill evidence](STAGING_DRILL_EVIDENCE_2026-08-04.md#queueworker-recovery--pass) | redacted@users.noreply.github.com |
| 2026-08-04 | Load smoke | 200 concurrent readiness/version/operator endpoint requests with no network or 5xx failures | PASS | [Staging drill evidence](STAGING_DRILL_EVIDENCE_2026-08-04.md#load-smoke--pass) | redacted@users.noreply.github.com |
| 2026-08-04 | Backup restore | Exported three synthetic Firestore records, restored them into an isolated namespace, verified count and SHA-256, then deleted both namespaces | PASS | [Staging drill evidence](STAGING_DRILL_EVIDENCE_2026-08-04.md#backup-restoration--pass) | redacted@users.noreply.github.com |
| 2026-08-05 | Payment reconciliation | Ran the operator-authorized deployed reconciliation endpoint across a seven-day lookback; zero pending records and zero errors | PASS | [Staging drill evidence](STAGING_DRILL_EVIDENCE_2026-08-04.md#payment-reconciliation--pass) | redacted@users.noreply.github.com |
| 2026-08-05 | Frontend rollback | Published the previous staging editor deploy, verified the rolled-back asset and Railway readiness, then restored the current deploy | PASS | [Staging drill evidence](STAGING_DRILL_EVIDENCE_2026-08-04.md#frontend-rollback--pass) | redacted@users.noreply.github.com |
| 2026-08-05 | Account deletion | Created a disposable Firebase user with seeded Firestore and Storage data, deleted it through the deployed endpoint, and verified complete removal | PASS | [Staging drill evidence](STAGING_DRILL_EVIDENCE_2026-08-04.md#account-deletion--pass) | redacted@users.noreply.github.com |
| 2026-08-06 | Support intake | Submitted, assigned, resolved, and closed a synthetic deployed support request with no customer data | PASS | [Staging drill evidence](STAGING_DRILL_EVIDENCE_2026-08-04.md#support-intake-workflow--pass) | redacted@users.noreply.github.com |
| 2026-08-06 | Launch-fix deployment | Published the editor and API updates, verified three public routes, API readiness, CORS, and echoed request references | PASS | [Staging drill evidence](STAGING_DRILL_EVIDENCE_2026-08-04.md#launch-fix-deployment--pass) | redacted@users.noreply.github.com |

Do not mark a drill `PASS` without a durable evidence link (logs, dashboard snapshot,
ticket, or incident document) and the name of the operator who verified recovery.

## Required Monthly Drills
- Queue/worker outage and recovery.
- Payment webhook outage and reconciliation recovery.
- Backup restore check in non-production.
- Load smoke run (`python scripts/load_smoke.py --base-url ...`).
- Authenticated staging upload/process/export run (`python scripts/staging_smoke.py ...`).
