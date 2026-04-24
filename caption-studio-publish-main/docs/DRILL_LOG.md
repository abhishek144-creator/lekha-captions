# Drill Log (Evidence)

Keep one row per completed drill.

| Date (UTC) | Drill Type | Scenario | Result | Evidence Link | Owner |
|---|---|---|---|---|---|
| 2026-04-21 | Queue Failover | Redis unavailable, export fallback path | PASS | add-link-here | ops |

## Required Monthly Drills
- Queue/worker outage and recovery.
- Payment webhook outage and reconciliation recovery.
- Backup restore check in non-production.
- Load smoke run (`python scripts/load_smoke.py --base-url ...`).
