# Internal Security Assessment — 29 August 2026

## Status and limitation

This is a rigorous **internal** security assessment performed with owner
authorization. It is not an independent third-party penetration-test
certificate: the assessor worked inside the project, had repository and
deployment context, and therefore is not organizationally independent.

Assessment activity was non-destructive. It did not include denial-of-service
testing, social engineering, intentionally failing a real customer payment, or
attempting to take over a real user account.

## Executive result

- No Critical or High severity exploitable vulnerability was identified in the
  tested scope.
- Authentication, ownership enforcement, App Check, upload protection, media
  token validation, payment validation, malware controls, CORS, production
  headers, and administrative route protection passed the available automated
  and safe live checks.
- Production Sentry telemetry was configured and verified on 29 August 2026.
  The controlled delivery test exposed a separate Medium operational-assurance
  gap: production Slack delivery is not configured.
- Three Low defense-in-depth improvements are recorded below.
- The production API was healthy and ready during the live perimeter review and
  reported the reviewed production commit
  `419c3f1695efd925610a00cc8151ed0da9d1a8b1`.

The tested application can continue toward a controlled paid beta from a
technical-security perspective, subject to fixing or explicitly accepting the
findings below and completing the separately tracked legal review. An external
assessor is still required if a customer, insurer, investor, procurement
process, or certification requires an **independent** sign-off.

## Scope

- Production frontend: `https://app.lekhacaptions.com`
- Production API: `https://api.lekhacaptions.com`
- Frontend and backend source at commit
  `419c3f1695efd925610a00cc8151ed0da9d1a8b1`
- Firebase Firestore and Storage security rules
- Railway production configuration, checked by variable presence and mode only;
  secret values were not copied into this report
- Netlify production public-build configuration, checked by presence and target
- GitHub Actions security and dependency gates

## Verified controls

### Identity, authorization, and isolation

- Protected account, export, deletion, admin, reconciliation, analytics, and
  feature-control endpoints rejected missing or invalid authorization.
- Backend contract tests exercised Firebase authentication, App Check,
  resource ownership, administrative allowlists, and cross-user access denial.
- Firestore rules allow a user to read only their own user document and deny
  client writes to protected entitlement/payment data.
- Storage rules deny direct client access; media access is mediated by the
  backend.
- Media tokens reject tampering, expiry, incorrect owners, and incorrect media
  kinds.

### Payments and credits

- Production web configuration contains the live Razorpay key, secret, and
  webhook secret; the frontend is configured with the matching live public key.
- Invalid webhook signatures are rejected. A safe live invalid-signature probe
  returned HTTP 403.
- Backend tests cover order ownership, amount/currency validation, payment
  signature validation, replay/idempotency, refund handling, and transactional
  entitlement updates.
- The worker contains an unused Test Mode Razorpay key. Because payment APIs are
  served by the web service, this is not a payment-path failure; removing unused
  payment credentials from the worker would improve least privilege.

### Uploads, media, malware, and rendering

- Upload initiation requires valid authentication/App Check and is rate
  limited and idempotent.
- Malware-scanner contract tests passed, including rejection and unavailable
  scanner behavior.
- Path traversal and direct hidden-file probes were rejected by the live API.
- The export renderer uses an HTML tag allowlist and blocks arbitrary network
  requests.
- Chromium sandbox workarounds are scoped to the Railway container environment.
- Subprocess execution reviewed by Bandit uses argument arrays rather than a
  command shell in the relevant media paths.

### Web and API perimeter

- HTTP redirects to HTTPS for the frontend and API.
- Production responses include HSTS, Content-Security-Policy,
  `X-Content-Type-Options`, `X-Frame-Options`, Referrer-Policy, and
  Permissions-Policy.
- An untrusted Origin was not granted CORS access and its preflight was rejected.
  The production frontend Origin was accepted.
- TRACE was rejected and unsupported methods returned the expected error.
- API documentation, OpenAPI, debug, SLO, `.env`, and `.git` probes were not
  publicly accessible.
- Health, readiness, and version endpoints returned HTTP 200.

### Dependencies, static analysis, and release gates

- `npm audit --audit-level=low`: no known vulnerabilities.
- Project security audit gate: passed with no unreviewed High/Critical issue.
- Template XSS/sanitizer security suite: passed.
- Release readiness contracts: 157 passed.
- Full guarded frontend release check: passed when supplied build-only values
  for the two required public production build variables. No deployment was
  performed from that local build.
- Backend test discovery: passed.
- Targeted API and malware suites: 82 tests passed.
- Bandit: 0 High, 1 Medium, and 64 Low reports. Manual review treated the Medium
  `0.0.0.0` worker readiness bind as expected for Railway and the Low subprocess
  reports as non-shell argv execution or general hardening notes.
- Direct pinned Python requirements: no known vulnerabilities in the completed
  audit. The repository CI also runs the full Python dependency audit.
- No tracked `.env`, private key, Firebase service-account file, or obvious live
  credential was found in the current source tree. Firebase web initialization
  data is public client configuration, not a server credential.

## Findings

### SEC-01 — Production Sentry telemetry is absent

- Severity: **Medium (operational assurance)**
- Status: **RESOLVED 29 August 2026**
- Evidence: `SENTRY_DSN` was absent from both production Railway web and worker
  services. Staging web has a DSN, confirming the application supports it.
- Impact: production exceptions may not reach centralized Sentry alerting,
  weakening detection and incident response. This is not itself a route to
  unauthorized access.
- Required action: configure the intended production Sentry DSN on both services,
  redeploy/restart them, send a controlled test exception, and save redacted
  delivery evidence. Do not copy a staging DSN unless staging and production are
  intentionally meant to share the same Sentry project.
- Resolution evidence: production web deployment
  `11507a43-30d9-4414-a117-16b24547e9e8` and worker deployment
  `f4b038ec-53bb-49b0-9813-9925ff8ea255` both succeeded and logged
  `sentry_initialized` with environment `production`. Controlled test
  `alert-test-20260829-111435-4b8f14` recorded `sentry_dispatched: true`.

### SEC-05 — Slack is intentionally optional

- Status: **ACCEPTED 29 August 2026**
- Decision: production Slack is not configured and is not a required alert
  channel for the paid beta. The controlled alert-test endpoint verifies the
  required Sentry path only; it no longer reports a false partial failure when
  an optional Slack webhook is absent.
- Operational requirement: retain Sentry email delivery evidence and the
  configured provider email alerts. If a Slack on-call route is introduced in
  the future, configure `SLACK_ALERT_WEBHOOK_URL` on the production web service
  and verify it separately.

### SEC-02 — Frontend CSP has a reusable preview nonce

- Severity: **Low (defense in depth)**
- Evidence: the SPA policy uses a static preview nonce, and frontend
  `connect-src` permits HTTPS destinations broadly.
- Impact: current sanitization, sandboxed preview frames, and XSS tests prevent a
  demonstrated exploit, but a reusable nonce provides less containment if a
  future HTML-injection flaw is introduced.
- Recommended action: move preview runtime code to a versioned same-origin script
  or use a hash/per-response nonce where the hosting model supports it; narrow
  `connect-src` to the explicit API and required providers.

### SEC-03 — Dependency builds are pinned but not fully reproducible

- Severity: **Low (supply-chain hardening)**
- Evidence: Python dependencies use exact versions but not hashes. GitHub Actions
  use major-version tags rather than immutable commit SHAs.
- Impact: a compromised upstream distribution or mutable action tag has more
  opportunity to influence a future build.
- Recommended action: generate and enforce hashed Python lock requirements, pin
  third-party Actions to reviewed commit SHAs, and use an update bot to keep them
  current.

### SEC-04 — One visual export assertion is timing-sensitive

- Severity: **Low (quality assurance; not a security vulnerability)**
- Evidence: one full-suite run measured a dragged word at 80.664% versus an 80%
  expectation with a 0.5% tolerance. The individual check and subsequent full
  guarded run passed.
- Impact: intermittent CI noise can hide a real regression if teams routinely
  rerun failed checks without review.
- Recommended action: stabilize fonts/layout readiness in the test or document a
  justified tolerance, then monitor whether it recurs in CI.

## Accepted observations

- The private Railway worker binds its readiness port to `0.0.0.0`; this is
  required for Railway health checks and the worker has no public application
  domain.
- The public service-status endpoint exposes only operational flags and the
  configured maximum duration, not credentials or customer data.
- `CREDITS_HMAC_SECRET` is absent, but the current application no longer relies
  on that legacy mechanism. Server-owned transactional entitlements and rules
  denying client writes are the current control. Older documentation mentioning
  that variable is stale and is not an active finding.

## Test limitations

- No destructive exploitation, denial-of-service, rate-limit exhaustion, or
  sustained load test was performed against production.
- No social engineering, employee-device review, phishing, or physical security
  test was performed.
- Cloud IAM roles, organization policies, billing-account permissions, DNS
  registrar ownership, and provider support access were not independently
  audited end to end.
- Previously owner-confirmed two-user isolation and media journey evidence was
  reviewed through project records; this assessment did not take over real user
  sessions.
- A separate organization must reproduce the relevant tests to call the result
  independent.

## Sign-off

Internal technical assessment: **COMPLETED WITH FINDINGS**

Independent periodic penetration-test sign-off: **PENDING**

Recommended retest trigger: after material auth,
payment, upload, media-token, or infrastructure changes, and at least annually
for a paid production service.
