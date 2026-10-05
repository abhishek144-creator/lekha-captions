# Launch reliability fixes — 5 October 2026

The six export reliability findings are addressed in this release candidate on
`codex/launch-reliability-fixes`, based on production release
`5f1345a1776f308bce4949d99ec6f8e9836af05f`. The original privacy-cleanup checkout
was preserved. These changes have not been deployed.

## Changes

| Review finding | Resulting behavior |
| --- | --- |
| API event-loop blocking | Single and batch export admission use a dedicated AnyIO pool limited to 16 operations. Blocking Firebase, Firestore, Redis and worker-wake calls stay off the API event loop. Other synchronous routes keep their default pool. |
| Debit committed before completion state | The recoverable output payload commits in the same Firestore transaction as the credit debit and history update. Retries recover that exact job before checking eligibility for a new export. Status/result and replay endpoints recover a committed result even if terminal job-state writes failed. An unknown transaction outcome stays recoverable during a database outage. |
| Abandoned overlay frame directories | Render scratch directories hold OS file locks. Worker maintenance sweeps expired, unlocked directories after 40 minutes, preserving active renders and ignoring symlink directories. Cleanup runs when workers wake, before/after jobs and through the existing janitor. Render startup and each overlay screenshot require 256 MiB of disk headroom. |
| Queue expires before recovery cron | Default queue lifetime is 30 minutes. Railway enforces this floor even with a stale shorter environment override. Single, batch and replay submissions all receive the bounded TTL. The existing 15-minute cron and pending-work limits are preserved. |
| Monitoring timeout mistaken for render failure | Individual status/result requests have a 15-second deadline. Monitoring lasts up to an hour, then pauses with a background/resume message. Server failure and monitoring interruption are separate outcomes. Active receipts prevent another submission; completed receipts allow download recovery and intentional new exports. |
| Full output buffered in browser RAM | MP4 downloads use a browser-managed signed attachment URL. The editor no longer fetches the video into a Blob. Signed storage responses carry attachment disposition and a sanitized filename; new R2 exports also store attachment metadata. A completed receipt remains available through the existing 24-hour receipt window, subject to media retention. |

Download initiation is labeled **Download started** because a browser hand-off
cannot prove that every byte arrived. **Download again** refreshes the same
authorized result without another render or debit. Subtitle text downloads keep
their small Blob-based path.

### Correction to the earlier review

The claim that the **production** dependency gate failed was incorrect: the
older development branch had no exceptions. The production branch already has
three documented reachability exceptions for the Node-only Firebase grpc
transport and build-time braces dependency. The exact production-based gate
passes, with review deadlines of 2 November 2026. This does not mean the raw npm
audit has zero advisories. No downgrade or major framework migration was made.

## Local verification

- Backend regression suite: **359 passed**, plus **27 subtests passed**.
- New fault-injection coverage: crash after the last-credit debit, plan change
  after debit, completion-state failure, unknown billing outcome, receipt
  ownership/job isolation, missed wake recovered by cron, OS-terminated scratch
  owner, preservation of active leases and disk-headroom rejection.
- Admission probe: **40 concurrent requests**, with mocked 80 ms authentication
  and 80 ms queue/wake delays; event-loop progress continued and simultaneous
  admissions stayed within 16. This is not a live render-capacity benchmark.
- Frontend `release:check`: contracts, sanitizer checks, lint, typecheck,
  production build and performance budgets passed. Only existing public browser
  and legal configuration was read for the build; server credentials were not
  copied.
- Local browser editor journey passed, including active/completed receipt
  behavior, signed download navigation without API credentials/referrer headers,
  and actual attachment bytes saved with the expected filename. The API and
  storage responses are isolated test doubles.
- Representative overlay export: the left multi-word highlight phase passed.
  This is not an exhaustive template matrix.
- Backend pinned dependency audit: **no known vulnerabilities found**.
- App/marketing dependency gate: **passed with the three existing exceptions**.

## Public launch acceptance still required

No paid resources, production exports, payments, replica counts, hosting limits
or autoscaling settings were changed. The source backlog limits remain 80 jobs
and 1,800 estimated work seconds; the configured render ceiling remains three
replicas. Autoscaling must remain disabled until its existing rollout safety
gate is satisfied. These limits deliberately reject overload and do not promise
unlimited simultaneous exports.

Follow-up: the IaC default previously set `RENDER_AUTOSCALE_ENABLED=1` despite
this safety gate. It now defaults to `0`, with a deployment-default regression
check, so a future config apply cannot silently re-enable the unverified
controller. This is a source change; no live setting was changed.

Before broad launch, deploy the reviewed candidate through the repository's
existing cost gate and verify a small approved live pilot:

1. Unique Hindi/English media, representative ASS and animated/DOM exports,
   720p/1080p/4K where plan-authorized, and low-memory mobile downloads.
2. Lost responses, a missed wake with the browser closed, render-child
   interruption, Redis/Firestore recovery, and a debit followed by completion
   interruption. Confirm exactly one debit and one usable result.
3. Measured API latency, render/queue latency, worker peak memory and temporary
   disk usage under the approved replica limit; verify queue-full rejection.
4. Real alert delivery, retained-backup restoration, worker wake/drain/sleep
   behavior, actual live grace periods and daily costs.

The new durable result applies to newly recorded exports; old usage records
without a result payload are not silently migrated. Media expiration, account
deletion and existing history-retention rules still apply. Local tests cannot
guarantee that a future server or browser will never crash, or qualify the live
Railway deployment for a mass public burst.

Reference for R2 attachment metadata:
[Cloudflare S3 API compatibility](https://developers.cloudflare.com/r2/api/s3/api/).
