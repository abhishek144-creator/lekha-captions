# API Versioning and Deprecation Policy

## Version Contract
- Clients should send `X-API-Version` with each API request.
- Versions use semantic versioning (`MAJOR.MINOR.PATCH`). The current public line is `1.0.0`; response headers may shorten this to `1.0` while compatibility remains within the `1.x` line.
- If `X-API-Version` is omitted, the server accepts the request as the current API version and returns the active contract in `X-API-Version`.
- Server returns:
  - `X-API-Version` (current)
  - `X-API-Min-Version` (minimum supported)
  - `Sunset` (date for deprecated behavior removal)

## Compatibility Rules
1. Additive changes only within a version line.
2. Breaking behavior requires a new version and migration notice.
3. Requests below minimum supported version may receive HTTP `426`.

## Release Process
1. Publish migration note.
2. Run canary via feature flag for risky endpoint changes.
3. Observe SLO/error budget for at least 24h before broad rollout.

## Endpoints
### `GET /api/version`
- Auth: none.
- Headers: optional `X-API-Version`.
- Query/path params: none.
- `200` response schema:
  ```json
  {
    "current": "1.0",
    "minimum": "1.0",
    "sunset": "2026-12-31"
  }
  ```
- `426`: requested version is below `X-API-Min-Version`.
- `500`: unexpected server error.
- Example:
  ```bash
  curl -H "X-API-Version: 1.0" http://localhost:8000/api/version
  ```

### `GET /api/slo/status`
- Auth: admin/service token required in production deployments.
- Headers: optional `X-API-Version`, `Authorization: Bearer <token>` when auth is enforced.
- Query/path params: none.
- `200` response schema includes SLO metric fields:
  ```json
  {
    "success": true,
    "window_minutes": 60,
    "latency_p95_ms": 850,
    "error_rate": 0.01,
    "export_queue_depth": 3,
    "generated_at": "2026-04-24T08:00:00Z"
  }
  ```
- `401`: missing or invalid admin token.
- `500`: unable to compute SLO status.

### `GET /api/health/readiness`
- Auth: none for platform readiness probes; restrict at the edge if exposed publicly.
- Headers: optional `X-API-Version`.
- Query/path params: none.
- `200` response schema:
  ```json
  {
    "ready": true,
    "checks": {
      "database": "ok",
      "storage": "ok",
      "redis": "ok",
      "worker": "ok"
    },
    "generated_at": "2026-04-24T08:00:00Z"
  }
  ```
- `503`: one or more required dependencies are unavailable.
- `500`: readiness check failed unexpectedly.
