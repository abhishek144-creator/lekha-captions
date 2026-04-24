# World-Class Operations Baseline

This file captures the implementation and runbook posture for reliability, security, and scale.

## 1) SLOs + Error Budget
- Export success target: `SLO_EXPORT_SUCCESS_TARGET` (default `0.98`)
- Process success target: `SLO_PROCESS_SUCCESS_TARGET` (default `0.98`)
- Export p95 latency target: `SLO_EXPORT_P95_MS_TARGET` (default `180000`)
- Process p95 latency target: `SLO_PROCESS_P95_MS_TARGET` (default `60000`)
- Read endpoint: `GET /api/slo/status`
- Readiness gate: `GET /api/health/readiness`

Release rule:
- If SLO gate is failing, pause risky releases and investigate alerts.

## 2) Progressive Delivery
- Frontend feature flags: `src/lib/featureFlags.js`
- Backend feature flag introspection: `GET /api/feature-flags` (admin)
- Canary client behavior can be toggled with `VITE_FF_CANARY_EXPORT_FLOW=1`

## 3) Payment Hardening
- Required idempotency keys for:
  - `POST /api/create-order`
  - `POST /api/verify-payment`
- Reconciliation:
  - Scheduled auto-run with APScheduler
  - Manual run endpoint: `POST /api/reconcile-payments`
- Recovery dashboard endpoint: `POST /api/admin/recovery-summary` (admin)

## 4) API Versioning + Deprecation
- Current version header: `X-API-Version`
- Minimum supported header: `X-API-Min-Version`
- Sunset header: `Sunset`
- Old clients can be rejected with HTTP `426` when below supported version.
- See `docs/API_VERSIONING.md`.

## 5) Security Maturity
- CI quality gate workflow: `.github/workflows/quality-gates.yml`
- Dependency scans:
  - Frontend: `npm audit`
  - Backend: `pip-audit`
- Upload safety:
  - MIME + ffprobe checks
  - optional malware scanner command (`CLAMAV_SCAN_CMD`)
  - content safety blocklist (`CONTENT_SAFETY_BLOCKLIST`)
- Tenant isolation:
  - `ENFORCE_TENANT_ISOLATION=1`
  - write APIs validate `org_id` against auth token claim.

## 6) Frontend Performance Budget
- Script: `scripts/check-performance-budget.mjs`
- Command: `npm run perf:check`
- Guarded build: `npm run build:guarded`

## 7) Product Analytics Depth
- Frontend events in:
  - upload/process/translate/export flow
- Backend ingestion endpoint:
  - `POST /api/analytics/track`
- Summary endpoint:
  - `GET /api/analytics/summary`

## 8) Disaster Recovery + Multi-region
Minimum runbook:
1. Daily backup check for Firestore/critical collections.
2. Quarterly restore drill to non-prod.
3. Redis queue outage fallback drill:
   - Detect outage from Redis connection errors, rising export queue failures, or readiness check `redis != ok`.
   - Activate graceful degradation: pause new export submissions with a retryable "render queue busy" response while allowing caption editing/download-only workflows to continue.
   - Confirm operators have disabled queue submission through the feature flag or incident runbook switch before announcing degraded export service.
   - After Redis recovery, replay dead-letter jobs from the durable export job store using the recovery script/runbook, then verify each replayed job reaches `completed` or a recorded terminal failure.
4. Provider outage drill:
   - verify circuit breaker + alert behavior.

## 9) Compliance Readiness
- User data export: `POST /api/account-export`
- User data delete: `POST /api/account-delete`
- Keep records:
  - consent log entries for terms/privacy acceptance, checkbox consents, revocations, and third-party processor consents
  - consent log fields: user ID, UTC timestamp, consent identifier, document version, action (`grant`/`revoke`), IP address, user agent, and capture method
  - consent log retention: retain for the account lifetime plus the required legal retention window, unless deletion is required and no legal hold applies
  - data processing inventory
  - retention policy and delete policy

## 10) Chaos + Load Testing
- Load smoke script: `python scripts/load_smoke.py --base-url http://localhost:8000`
- Use as pre-release gate for queue/worker resilience.
- Record every completed drill in `docs/DRILL_LOG.md` with an evidence link.
