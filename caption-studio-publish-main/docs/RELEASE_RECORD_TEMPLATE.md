# Production Release Record

Copy this file for each release and replace every placeholder. Store secrets,
personal contact details, and customer data only in the private evidence system.

## Release identity

- Git commit (full 40-character SHA): `<required>`
- GitHub Actions run URL and conclusion: `<required>`
- Release approver and UTC approval time: `<required>`
- Source tree clean at build time: `<yes/no + evidence>`

## Deployments

- Marketing provider deployment ID/URL/UTC time: `<required>`
- Editor provider deployment ID/URL/UTC time: `<required>`
- API Railway deployment ID/URL/UTC time: `<required>`
- Worker Railway deployment ID/UTC time: `<required>`
- `npm run launch:verify-deployed` output: `<evidence link>`
- `/api/health/readiness` output: `<redacted evidence link>`

## Customer-path evidence

- Multi-resolver and independent-network DNS checks: `<evidence link>`
- Authenticated staging media-capacity run: `<evidence link>`
- Payment capture/webhook/refund/reconciliation: `<evidence link>`
- Browser/accessibility report and real-device checks: `<evidence link>`
- Alert-delivery receipts and status-page incident test: `<evidence link>`
- Backup restore and frontend/backend rollback: `<evidence link>`

## Operating envelope

- Approved concurrent media jobs: `<required>`
- Worker count and autoscaling thresholds: `<required>`
- Queue-depth/oldest-job stop threshold: `<required>`
- Provider quotas and cost stop-loss: `<required>`
- RTO/RPO: `<required>`
- Support SLA, on-call primary/backup, rollback owner: `<private roster reference>`

## Independent approvals

- Penetration test and remediation sign-off: `<evidence link>`
- Lawyer approval: `<evidence link>`
- CA/tax approval: `<evidence link>`
- Public/private repository and history-review decision: `<evidence link>`

## Decision

- Decision: `<GO / NO-GO>`
- Open exceptions, owner, and expiry: `<none or required details>`
- Final approver and UTC timestamp: `<required>`
