# India legal and tax readiness review — 2 September 2026

## Reviewer and limitation

OpenAI Codex performed this AI-assisted readiness review at the owner's request.
It is a substantive product-policy and evidence review, not legal advice, a
lawyer-client opinion, a chartered accountant certificate, or a tax filing.
Entity registration, GST registration status, actual invoices, LUT filings,
books, bank records, and customer jurisdictions were not available for
independent inspection.

## Official sources reviewed

- Ministry of Electronics and Information Technology, Digital Personal Data
  Protection Rules, 2025 and commencement schedule:
  https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa
- Department of Consumer Affairs, Consumer Protection Act and E-Commerce Rules:
  https://consumeraffairs.nic.in/acts-and-rules/consumer-protection/consumer-protection
- Central Board of Indirect Taxes and Customs, tax invoice rules:
  https://cbic-gst.gov.in/gst-invoice-rules.html

The DPDP Rules were notified in November 2025 with phased commencement. The
product should implement the later-phase notice and rights controls before their
effective dates rather than waiting for enforcement.

## Result

**Product-policy result: READY AFTER DEPLOYMENT IDENTITY IS POPULATED**

The public policy set now covers seller/controller identity, business address,
governing venue, grievance contact, itemized data categories and purposes,
providers, retention, AI-training position, user rights and consent withdrawal,
international processing, security, children, refunds, cancellation, fixed-term
credits, acceptable use, complaint escalation, and mandatory consumer remedies.

Production builds now fail unless the real legal business name, address,
governing venue, grievance-officer name, and grievance email are supplied. This
prevents generic placeholders from becoming the legal notice.

## Changes made by this review

- Added a deployment-required grievance-officer identity and monitored email to
  both the Vite app and Next.js marketing site.
- Published a 48-hour complaint acknowledgment target and one-month resolution
  target, while preserving faster one-business-day support language.
- Clarified consent, withdrawal, correction, completion, erasure, grievance,
  and Data Protection Board escalation language.
- Clarified that checkout shows currency, applicable taxes, total payable,
  purchase term, and non-renewal before payment authorization.
- Preserved mandatory legal and consumer remedies in the Terms and Refund Policy.
- Added CI placeholders solely for build validation; production must replace
  them with the owner's real registered details.

## Tax/accounting assessment

The owner record dated 22 August 2026 states that a CA/accountant reviewed
HSN/SAC, GST rate, place of supply, export-of-service treatment, credit notes and
refunds; that Razorpay legal/GST invoice settings were configured; and that
successful-payment and refund delivery were tested. Those are owner
confirmations, not a signed CA artifact in this repository.

For a registered supplier, the operating evidence should retain the applicable
invoice fields and timing, the correct domestic GST split or export endorsement,
LUT/IGST basis where relevant, payment reference, sequential invoice number,
credit-note/refund linkage, and monthly reconciliation. The exact rate,
registration duty, place of supply, export qualification, and foreign tax duty
depend on facts not present in source code and must come from the retained CA
workpaper.

## Launch evidence conclusion

The code and public wording are remediated. Before representing professional
sign-off as complete, place the actual lawyer/CA confirmation or engagement
deliverable in the private launch evidence store and link a redacted receipt in
the release record. An AI review cannot honestly create or backdate that
professional credential.
