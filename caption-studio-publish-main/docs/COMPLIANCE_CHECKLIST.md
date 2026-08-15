# Compliance Readiness Checklist

Use this checklist for enterprise and privacy readiness.

## Privacy + User Rights
- [x] User can export account data (`/api/account-export`)
- [x] User can delete account data (`/api/account-delete`)
- [x] Public privacy policy URL is linked in product footer
- [x] DPA requests are routed through Help & Support for business review

## Data Inventory
- [x] Document each datastore, data fields, retention, and legal basis (`DATA_PROCESSING_INVENTORY.md`)
- [x] Record third-party processors (OpenAI, Razorpay, Firebase, Sarvam)

## Consent + Auditability
- [x] Capture consent timestamp/version for policy and terms changes
- [x] Sensitive actions are audit-logged

## Security
- [x] Secret handling hardened to env-first mode
- [x] Dependency scanning in CI workflow
- [ ] Periodic pentest checklist sign-off

## Incident + DR
- [x] Incident response roles and severity matrix documented (`INCIDENT_RESPONSE.md`)
- [x] GDPR 72-hour assessment procedure documented
- [x] Breach response roles documented
- [x] Breach notification template fields documented
- [x] Evidence log requirements documented
- [ ] Populate monitored production contact addresses and executive approvers
- [x] Quarterly backup/restore drill evidence (`STAGING_DRILL_EVIDENCE_2026-08-04.md`)

Launch cannot be signed off while any unchecked item above remains. Verify the
public support address by sending and answering a test message, and attach real
pentest and restore evidence rather than checking an item from configuration alone.
