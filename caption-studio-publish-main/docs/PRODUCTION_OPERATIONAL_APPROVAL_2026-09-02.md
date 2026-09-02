# Production Operational Approval — 2 September 2026

Status: **Approved for an initial mass-public launch at the limits below.**

This approval converts the existing private owner roster, live provider state,
capacity confirmation, and recovery drills into explicit operating limits. It
does not authorize exceeding those limits without a new capacity run and an
updated approval record. The machine-readable source of truth is
`docs/PRODUCTION_OPERATIONS_PROFILE.json`.

## Verified production baseline

- Railway reports two healthy API instances across `sfo` and `us-west2`, one
  healthy render worker, Redis, ClamAV, and the media bucket online.
- Production is configured for one concurrent render per worker and a durable
  Redis/RQ queue.
- The platform-wide paid-AI ceiling is 50 calls per UTC day. A user may have at
  most one transcription process and one export active at a time.
- Sentry and monitored admin, security, and privacy contacts are configured.
  Controlled alert delivery is recorded in
  `OWNER_CONFIRMATIONS_2026-08-28.md`; private mailbox screenshots remain out of
  the public repository.

## Objectives and support commitment

- Availability objective: **99.5% monthly**.
- Recovery-time objective (RTO): **4 hours**.
- Recovery-point objective (RPO): **24 hours** for critical account,
  entitlement, payment-audit, and configuration data.
- SEV-1 acknowledgement: **15 minutes**.
- Customer-support first response: **within one business day**.

The queue/worker recovery, isolated backup restore, and three-minute frontend
rollback drills in `STAGING_DRILL_EVIDENCE_2026-08-04.md` are accepted against
these objectives. A missed objective is a SEV-1 incident and blocks further
promotion until reviewed.

## Approved launch envelope

- Five concurrent end-to-end media jobs maximum during the initial launch
  envelope.
- One render worker initially; no more than three workers without a new
  capacity and cost test.
- Scale from one to two workers when queue depth is at least 5 for five minutes
  or the oldest job is over five minutes. Treat depth 10 or oldest age 15
  minutes as critical and pause new exports if scaling does not recover it.
- Scale down only after queue depth remains below 2 for 30 minutes.
- Warn at 80% of the private provider budget. At 100%, use the existing service
  controls to pause new paid-provider work; do not allow an unbounded overage.

Railway worker scaling is an operator action for this launch profile. The
primary on-call operator owns the scale decision; the backup takes over after a
missed acknowledgement. The executive launch/rollback approver in the private
roster owns rollback authorization.

## Monitoring and escalation

- The scheduled synthetic checks DNS through Google and Cloudflare and probes
  API liveness, readiness, version, and the customer-facing service contract
  every 15 minutes.
- Sentry email and provider spending/failure routes are required. A failed
  scheduled monitor or a missed expected receipt is an alert-delivery incident,
  not a passing check.
- Queue depth, oldest-job age, failed exports, Redis/worker health, provider
  failures, payments, and support intake follow the private primary/backup
  roster in `PRODUCTION_CONTACTS.md`.

## Rollback rule

Rollback to the last known-good traceable deployment for a failed readiness
gate, sustained critical queue threshold, payment-entitlement corruption,
cross-account exposure, or an error-rate breach. Preserve deployment IDs and
UTC timestamps, verify readiness and one customer journey, then reconcile
payments and queued jobs before reopening traffic.
