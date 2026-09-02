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
- [x] Internal security assessment completed with findings (`INTERNAL_SECURITY_ASSESSMENT_2026-08-29.md`)
- [x] External-style AI technical security review and remediation completed (`EXTERNAL_STYLE_SECURITY_REVIEW_2026-09-02.md`)
- [ ] Independent periodic pentest checklist sign-off
- [x] Deploy production Firestore/Storage rules, register App Check, and verify enforcement (`PRODUCTION_VERIFICATION_2026-08-21.md`)
- [x] Record a two-user cross-account isolation test (`OWNER_CONFIRMATIONS_2026-08-28.md`)

## Incident + DR
- [x] Incident response roles and severity matrix documented (`INCIDENT_RESPONSE.md`)
- [x] GDPR 72-hour assessment procedure documented
- [x] Breach response roles documented
- [x] Breach notification template fields documented
- [x] Evidence log requirements documented
- [x] Populate monitored production contact addresses and executive approvers (`PRODUCTION_CONTACTS.md`; private roster owner-confirmed)
- [x] Quarterly backup/restore drill evidence (`STAGING_DRILL_EVIDENCE_2026-08-04.md`)

## Paid Beta Release Evidence
- [x] Verify public A/CNAME, HTTPS, MX, SPF, DKIM, and DMARC records (`PRODUCTION_VERIFICATION_2026-08-21.md`)
- [x] Send to and reply from `support@lekhacaptions.com` using an external mailbox (`OWNER_CONFIRMATIONS_2026-08-22.md`)
- [ ] Record the exact deployed commit and successful production readiness/configuration output
- [x] Record one live Razorpay purchase, captured webhook replay, failed payment, reconciliation, and full/partial refund (`RAZORPAY_EVIDENCE_2026-08-22.md`)
- [x] Record a production malware-scanner startup check and suspicious-file rejection (`OWNER_CONFIRMATIONS_2026-08-28.md`)
- [ ] Record successful Sentry email and provider spending/failure alert deliveries (Sentry event dispatch reverified on 29 August 2026; mailbox receipt still needs saved evidence)
- [x] Complete the authenticated staging upload → process → export → download flow (`OWNER_CONFIRMATIONS_2026-08-28.md`)
- [x] Complete one authenticated production upload → Hindi process → save/refresh → 1080p export → download flow (`PRODUCTION_VERIFICATION_2026-08-21.md`)
- [x] Complete the real-video matrix: Hindi, English, Hinglish, portrait, landscape, poor audio, corrupt/unsupported, and near-limit media (`OWNER_CONFIRMATIONS_2026-08-28.md`)
- [ ] Obtain legal review and CA confirmation for jurisdiction, GST/tax invoices, international sales, refunds, and chargebacks
- [x] AI-assisted India legal/tax product-readiness review completed (`LEGAL_TAX_READINESS_REVIEW_2026-09-02.md`)

## Mass Public Launch Evidence
- [x] Run automated Chromium, Firefox, WebKit, Android, iOS-profile, overflow, and WCAG serious/critical checks (`e2e/public-launch.spec.js`)
- [ ] Record a concurrent staging media capacity run covering upload, transcription, queue saturation, rendering, storage, downloads, provider limits, cost ceilings, autoscaling, and recovery (`scripts/media_load_smoke.py`)
- [ ] Deploy the Next.js marketing site as the canonical public source and verify pricing, terms, privacy, refund, and acceptable-use routes in production
- [ ] Deploy multi-region/multi-resolver DNS and authenticated customer-journey monitoring plus an externally hosted status page
- [ ] Approve and test production RTO/RPO, concurrency, provider quotas, autoscaling thresholds, support SLA, on-call coverage, and rollback ownership
- [ ] Complete real-device keyboard, screen-reader, reduced-motion, iOS, and Android acceptance testing
- [ ] Record the public/private repository decision and complete a full-history personal/operational information review

Launch cannot be signed off while any unchecked item above remains. Verify the
public support address by sending and answering a test message, and attach real
pentest and restore evidence rather than checking an item from configuration alone.
