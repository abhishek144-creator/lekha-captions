# Public API / SDK Readiness

## Current State
- API version metadata endpoint exists (`/api/version`)
- Request/response contract tests for key endpoints exist
- Idempotency controls exist for export and payment writes

## Before Public SDK Launch
1. Stable `v1` namespace for external clients.
2. OAuth/service-account auth scopes (read/write/export/payment).
3. Published OpenAPI schema and changelog.
4. Tenant-level rate limits and quotas.
5. Developer docs + examples + error code catalog.

## Compatibility Promise
- No breaking change without version bump + deprecation period.
- Maintain old version for minimum 90 days after deprecation notice.
