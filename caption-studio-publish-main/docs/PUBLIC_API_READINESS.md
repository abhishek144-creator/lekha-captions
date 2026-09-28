# Public API / SDK Readiness

## Current State
- Stable read-only `v1` namespace for projects and export status.
- Revocable API keys stored only as SHA-256 digests, with explicit scopes and
  owner checks on every resource.
- Per-key hourly rate limits and the bundled dependency-free JavaScript client
  in `sdk/javascript`.
- FastAPI publishes the OpenAPI schema at `/openapi.json`.

## Before Public SDK Launch
1. Version write/export scopes after the beta read contract has production use.
2. Add OAuth/service-account exchange for enterprise tenants.
3. Publish hosted reference docs and an expanded error-code catalog.
4. Move per-key rate windows to Redis before horizontal API scale-out.

## Compatibility Promise
- No breaking change without version bump + deprecation period.
- Maintain old version for minimum 90 days after deprecation notice.
