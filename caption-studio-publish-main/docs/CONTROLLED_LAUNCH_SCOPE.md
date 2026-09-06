# Controlled launch priorities — 7 September 2026

The owner explicitly requested essential fixes only and confirmed that pentest and CA work are optional. This decision supersedes older repository instructions that made professional sign-offs, enterprise readiness or mass-traffic work prerequisites for this launch. Deferring work is not evidence that it has been completed.

## Essential work

- Correct account authentication and ownership, private media access, account export/deletion and secret handling.
- Correct prices, payment verification, duplicate-event handling, credit accounting and refund/reconciliation behavior. Preserve existing owner-confirmed payment and accounting evidence; do not require new professional engagements.
- Reliable upload, transcription, caption editing, cloud save/restore, export and download. Prevent lost drafts, duplicate paid work and jobs stuck without an actionable result.
- Enforced size, duration, concurrency, provider-spend and processing-time limits within the existing approved operating profile.
- Usable mobile/desktop core flows, existing automated accessibility checks, customer-readable failures, working support, basic health/error/budget monitoring and recoverable deployments/backups.

Prioritize a current-release authenticated customer journey and focused failure/recovery tests for changed flows. Fix demonstrated failures before adding features. Retain earlier confirmations and drill evidence with their dates; a checklist or passing automated test does not manufacture a new customer acceptance result.

## Optional and deferred

- Independent pentest engagements, certification and professional security sign-off. Continue ordinary dependency/security checks and fix confirmed vulnerabilities.
- Additional CA/tax or lawyer engagements and new professional sign-offs. Preserve existing public policies, pricing, invoices and owner-confirmed professional records. This is project prioritization, not a conclusion about legal obligations.
- Enterprise SSO/SCIM, custom contractual SLAs, certification and customer-specific procurement controls.
- Direct resumable uploads, larger-scale infrastructure migration, high-traffic autoscaling and multi-region failover beyond the approved initial capacity.
- A separate multi-region monitoring program, an independent status-site project and a formal physical-device/screen-reader certification program. Keep basic monitoring and fix observed accessibility or device failures.

## Gate interpretation

`COMPLIANCE_CHECKLIST.md` contains the required controlled-launch evidence and a separate non-blocking deferred list. `npm run launch:evidence` checks the required evidence only. It does not certify professional assurance, refresh old drills or declare high-traffic/enterprise readiness.

Application deployments continue to require a clean reviewed commit, appropriate tests, production configuration, matching component metadata, healthy API/workers and restoration of any temporary processing pause. Documentation-only scope changes do not require replacing healthy application containers.
