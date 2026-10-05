# PR #29 export reliability port — 2026-10-05

PR #29 was based on main before PR #28 and cannot be merged alongside that
work without resolving overlapping changes. This replacement is based on the
complete #28 → #30 → #31 → #32 → #33 → #34 stack.

The port keeps PR #28's per-call blocking-I/O offloading, background worker
wake/resize, short RQ result/failure retention, durable snapshots and adaptive
status polling. Single and batch admission share an asynchronous 16-operation
limit; it does not create nested event loops or a second thread pool.

Useful fixes retained from PR #29:

- Commit a recoverable export result in the same Firestore transaction as the
  debit. Recover that exact paid job before checking eligibility for a new
  export, including after a last-credit debit or plan expiration. Unknown
  transaction outcomes remain recoverable instead of inviting another charge.
- Keep scratch-directory OS leases, cleanup of expired unlocked directories and
  256 MiB free-space checks; retain active render scratch files.
- Give queued jobs a 30-minute lifetime so the 15-minute Railway recovery cron
  can recover a missed wake. This does not increase pending-work admission.
- Bound individual status/result requests, preserve queued/render polling
  backoff and retain receipts when monitoring pauses or a download is handed
  to the browser.
- Stream signed attachments through the browser download manager, with
  sanitized Content-Disposition filenames. Completed receipts allow a fresh
  link for the same result without another render or credit debit.
- Retain the Python 3.11 ExitStack correction for recovery fault injection.

The owner approved the launch profile and then changed the Railway cap to $25.
The live hard cap is verified at $25, with a $10 custom email alert. There is
no separate $10 staging allowance; the plan's metered AI calls are authorized.
The profile retains
AI_SYSTEM_DAILY_LIMIT=2000 from PR #28, API capacity 2 vCPU/2 GiB and worker
ceilings of five. Workers sleep when idle. Both controllers remain disabled
until live resize/drain acceptance; pending-work capacity stays at the
one-replica baseline until that gate is enabled. The reviewed production plan
has not been applied; deployment still requires PR #35's release gate.

Verification: 398 backend tests and 31 subtests pass, including the existing
scaling paths and new debit/recovery/scratch/download regressions. Clean npm ci,
release checks and the Bandit Medium/High gate are required before push. Hosted
checks and real Railway B4 measurements remain separate acceptance gates.

The 2026-10-05 read-only inventory found only the production environment, with
sleeping one-replica app services and about $0.22 current Railway usage. No
staging resources, authenticated load credentials or live benchmark evidence
were found. The priced, finite staging proposal is in
RAILWAY_B4_PLAN_2026-10-05.md. No paid staging test has run. The ordered
#28/#30–#34 stack is merged and #29 is closed in favor of #35. Eleven hosted
checks passed; one export scope hit a Chromium setup timeout. Its retry was
blocked before execution by GitHub account payments/spending limits, leaving
the release gate red. GitHub billing availability must be restored before the
approved deployment and B4 run can proceed.
