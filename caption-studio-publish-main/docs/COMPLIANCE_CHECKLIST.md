# Compliance Readiness Checklist

Use this checklist for enterprise and privacy readiness.

## Privacy + User Rights
- [x] User can export account data (`/api/account-export`)
- [x] User can delete account data (`/api/account-delete`)
- [ ] Public privacy policy URL is linked in product footer
- [ ] Data Processing Agreement (DPA) workflow for business customers

## Data Inventory
- [ ] Document each datastore, data fields, retention, and legal basis
- [ ] Record third-party processors (OpenAI, Razorpay, Firebase, etc.)

## Consent + Auditability
- [ ] Capture consent timestamp/version for policy and terms changes
- [x] Sensitive actions are audit-logged

## Security
- [x] Secret handling hardened to env-first mode
- [x] Dependency scanning in CI workflow
- [ ] Periodic pentest checklist sign-off

## Incident + DR
- [ ] Incident response contacts and severity matrix
- [ ] GDPR breach notification procedure: assess and notify the supervisory authority within 72 hours when required
- [ ] Breach response roles documented: DPO/privacy owner, incident lead, legal, communications, engineering owner
- [ ] Breach notification templates for supervisory authority and affected users, including nature of breach, data categories, likely impact, mitigation, and contact point
- [ ] Evidence log for breach decisions, timestamps, communications, containment steps, and legal hold status
- [ ] Escalation matrix with contact details for privacy, security, legal, support, and executive approvers
- [ ] Quarterly backup/restore drill evidence
