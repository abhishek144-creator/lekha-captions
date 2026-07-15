# Incident Response

## Severity

- SEV-0: confirmed active compromise, payment corruption, or broad data exposure. Page engineering, security/privacy, and executive owners immediately.
- SEV-1: production outage, stuck export fleet, or suspected limited data exposure. Acknowledge within 15 minutes.
- SEV-2: degraded feature or contained security issue without confirmed exposure. Triage during the same business day.

## Roles

- Incident lead: owns timeline, severity, and coordination.
- Engineering lead: containment, recovery, and evidence preservation.
- Privacy/security owner: impact assessment, notification deadlines, and legal hold.
- Communications owner: customer and status updates.
- Executive approver: material external notifications and business decisions.

Production must configure `ADMIN_EMAILS`, `SECURITY_CONTACT_EMAIL`, and `PRIVACY_CONTACT_EMAIL` with monitored addresses.

## Response sequence

1. Open an incident record with UTC timestamps and preserve logs, job IDs, payment IDs, affected UIDs, and deployment revisions.
2. Contain: disable the affected route or worker, rotate exposed credentials, revoke sessions, and preserve forensic copies.
3. Assess affected people, data categories, regions, duration, and likely harm with legal/privacy owners.
4. Recover from a known-good revision; reconcile queued exports and payments idempotently; verify readiness and customer data isolation.
5. Notify regulators and affected users when required. GDPR supervisory-authority notification is assessed against the 72-hour deadline.
6. Publish a blameless review with corrective owners and due dates.

## Notification template fields

Incident summary; discovery and containment times; affected systems and data; affected-user estimate; likely consequences; actions taken; customer actions; contact point; next update time.

Quarterly drills must cover restore, queue/worker loss, payment webhook loss, and credential compromise, with evidence recorded in `docs/DRILL_LOG.md`.
