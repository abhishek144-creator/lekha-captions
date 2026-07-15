# Drill Log (Evidence)

Keep one row per completed drill.

| Date (UTC) | Drill Type | Scenario | Result | Evidence Link | Owner |
|---|---|---|---|---|---|
| _No completed drills recorded_ | | | | | |

Do not mark a drill `PASS` without a durable evidence link (logs, dashboard snapshot,
ticket, or incident document) and the name of the operator who verified recovery.

## Required Monthly Drills
- Queue/worker outage and recovery.
- Payment webhook outage and reconciliation recovery.
- Backup restore check in non-production.
- Load smoke run (`python scripts/load_smoke.py --base-url ...`).
- Authenticated staging upload/process/export run (`python scripts/staging_smoke.py ...`).
