# Launch rollout and cost approval — 5 October 2026

Status: candidate prepared in PR #29; not merged or deployed. The owner approved
raising the GitHub Actions monthly budget to $7 to resume hosted validation.
This document is the reviewable next action, not evidence of a completed launch.

Owner initially chose **Keep budgets unchanged**, then explicitly authorized
**make it 7 dollars** in reply to the GitHub Actions blocker. Actions was changed
from $3 to **$7 total per month** (up to $4 additional headroom), with Stop usage
and threshold alerts retained and verified in the UI. Railway remains $15
hard/$8 alert. The earlier $8 Actions proposal below was not applied. No
Railway rollout or pilot has been started; its separate $2 allowance remains
unapproved. This spending setting does not imply public-launch clearance.

## Exact target and verified live state

- GitHub owner: `abhishek144-creator`; private repository `lekha-captions`.
- Railway Hobby workspace: `c1f72079-ccb3-4ff3-8b16-9125a29c4391`.
- Existing project: `lekha-captions`, `073ba0e0-3fb7-4aec-89eb-36d97c2f2074`.
- Production environment: `442a4640-ee00-4518-91f5-0a8a7c42a83a`.
- Only deployment region: Singapore, `asia-southeast1-eqsg3a`.
- Four app services and one Redis service; no new cloud resources proposed.
- App services currently deploy `5f1345a1776f308bce4949d99ec6f8e9836af05f`.
- Live render deployment is **SLEEPING**, with configured and effective count
  **one**, CPU cap **4**, RAM cap **4 GiB**, shutdown grace **1860 seconds**.
- Transcription is SLEEPING; API is SUCCESS at inspection. This snapshot does
  not establish the API's idle behavior over a whole interval.
- API and cron currently have `RENDER_AUTOSCALE_ENABLED=1`. The earlier diary
  describing disabled scaling is stale. Existing local acceptance evidence
  records three finite `time.sleep` RQ probes finishing through replacement,
  three active slots, then cron reduction to one. Those probes did **not**
  render captioned videos, upload to R2 or verify credit accounting.
- Railway API reports current usage about **$0.215**, **$15 hard limit**,
  **$8 alert**, `isOverLimit=false`. These are billing snapshots, not an invoice.
- Computer-use inspection of GitHub Budgets confirmed **$3.00 spent of a
  $3.00 Actions budget**, with **Stop usage: Yes**. All PR workflow jobs were
  refused before executing any steps. No code test failed in those hosted runs.

Read-only inventory artifacts are in the gitignored `build/cost-review/`
directory. Existing drain evidence is in the original checkout's `.readiness/`
folder; it was read, not rerun. No credentials were printed or rotated.

## Local export measurements

Actual `VideoProcessor.burn_only` paths, CPU encoder, generated portrait source,
one attempt per path and no warmups. Outputs were validated and scratch was
removed by the existing benchmark. No cloud jobs, transcription or payments.

| Case | Requested output | ASS seconds | DOM seconds | Result |
| --- | --- | ---: | ---: | --- |
| Small | 6 s, 720p, 30 fps | 1.0411 | 4.8601 | Both succeeded |
| Typical | 30 s, 1080p, 30 fps | 6.1627 | 12.5955 | Both succeeded |
| Large | 120 s, 4K, 60 fps | 171.8513 | 293.7384 | Both succeeded |

Artifacts: `build/benchmarks/launch-small.json`, `launch-typical.json`,
`launch-large.json`. The source is 720x1280 and upscaled for larger output;
captions are a simple English fixture. These measurements are single samples
on this Windows machine, without Railway's 4-vCPU container limit. They are
not p95 estimates, exhaustive animation/Hindi checks, native-4K decode tests,
or proof of peak memory/disk fitting the production container. An observed
FFmpeg working set near 2 GiB is only a sample, not total process-tree peak RAM.

Final local backend validation: **360 passed and 27 subtests passed**. One
previous rerun hit the recorded Windows loopback abort; isolated wake tests
and the final complete rerun passed. Frontend release gates and local browser
download acceptance previously passed; production image checks still need CI.

## Current prices and recurring exposure

USD rates checked on 5 October 2026. Taxes, currency conversion and bank fees
are excluded; account invoices determine those amounts. Resource caps are
ceilings, not reserved performance or measured average consumption.

- [Railway pricing](https://railway.com/pricing): Hobby minimum $5 including
  $5 usage; CPU $0.00000772/vCPU-second, RAM $0.00000386/GB-second,
  volume $0.00000006/GB-second, service egress $0.05/GB.
- [GitHub runner pricing](https://docs.github.com/en/billing/reference/actions-runner-pricing):
  standard Linux x64 $0.006/minute, rounded per job. The full workflow timeout
  sum is 380 runner-minutes, about $2.28 per run before storage. PR and main
  acceptance at their timeouts would total about $4.56. Feature pushes now rely
  on PR validation to avoid duplicate full matrices; main remains validated.
- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/):
  Standard storage $0.015/GB-month, Class A $4.50/million, Class B
  $0.36/million, free egress. Monthly allowance: 10 GB-month, 1 million A and
  10 million B operations. Billable units round up; tiny extra requests can
  cross an operation billing boundary. Remaining allowance is not verified.

| Existing resource | Limit / persistence | Full-limit compute per hour | 30 days continuously at limit |
| --- | --- | ---: | ---: |
| API | 1 vCPU / 2 GiB, one, sleeps | $0.0576 | $41.50 |
| Transcription/scan | 2 vCPU / 2 GiB, one, sleeps | $0.0854 | $61.51 |
| Render | 4 vCPU / 4 GiB, one baseline | $0.1709 | $123.01 |
| Render at ceiling | Three replicas, 12 vCPU / 12 GiB | $0.5126 | $369.04 |
| Cron | 1 vCPU / 1 GiB, every 15 min, exits | $0.0427 while running | $30.75 if incorrectly always running |
| Redis + volume | Always on; no explicit override returned | Actual usage required | Not independently bounded by a source limit |

GiB limits were converted to decimal GB for conservative RAM billing arithmetic.
The three-replica row replaces, rather than adds to, the baseline-render row.
At all four app caps, total is about $0.70/hour excluding Redis and networking.
The existing Railway $15 limit protects its usage budget by taking workloads
offline; it is **not sufficient for continuous mass traffic** and does not cap
Firebase, Cloudflare, Netlify, GitHub or AI charges.

Planning idle example, not a measurement: 50 MB Redis, 1 GB retained volume,
five seconds per cron pass, and genuinely sleeping app services would use
roughly $0.85/month of Railway resources, covered by the $5 Hobby minimum.
Current Redis RAM, volume allocation/backups, image retention and idle network
activity must be measured before promising that bill. Firebase Auth/App Check
and Firestore, the existing Netlify sites, domains and any monitoring services
remain separate accounts. Their quotas, subscriptions and residual bills must
be verified; no plan upgrades or migration of those accounts is authorized.

Illustrative small usage: 1,000 typical renders at the local DOM duration would
use about $0.60 of render compute at its full cap. Separate 10-minute wake tails
at the full RAM cap could add about $9.95; worst-case full CPU+RAM tails could
add $28.48. API/scanning/transcription/storage/egress are additional. This is
why measured burst frequency and sleep behavior are required, and why the
older $8–14 estimate cannot certify mass-launch affordability.

## Proposed approval and bounded execution

Request **up to $7 additional pre-tax usage allowance** for this release:

1. **GitHub Actions: up to $5 additional**, changing only its stop-usage budget
   from $3 to **$8** for the owner account. Keep Stop usage enabled. Run one
   complete PR validation and one main validation after merge. No repeated
   blind reruns; if the budget cannot cover a failure repair, stop. Any payment
   or subscription checkout must be performed separately by the owner.
2. **Railway deployment/pilot: up to $2 incremental**, retaining the existing
   **$15 monthly hard limit and $8 alert**, all service caps and maximum three
   render drains. No resource creation, infrastructure apply or plan upgrade.
3. No new paid AI calls, live payment transactions or customer-credit grants.
   Use existing captions and owner-designated disposable records/media. New
   transcription needs its own bounded provider approval. Verify R2 and
   Netlify remaining included quotas before writes/builds; otherwise stop for
   a revised estimate. This allowance does not promise a $7 total invoice.

The original combined proposal was declined. The later authorization applies
a $7 total Actions budget, not the proposed $8 or the separate $2 Railway
pilot. Hosted validation may now run within the approved $7 Actions limit.
The Railway sequence below remains proposed and unexecuted. Paid deployment
and pilot would require explicit approval of that priced plan under `AGENTS.md`
and the deployment prompt. Inspect remaining headroom before execution.

Sequence after approval and successful CI:

1. Reread the current complete development log and deployment prompt. Confirm
   account/project IDs, $15/$8 limits, quotas, empty render queues/leases and
   a rollback image. Reconcile any active customer work before replacing a
   worker. Preserve the one-replica baseline; disable scaling temporarily in
   API/cron while accepting the new render image, documenting variable changes.
2. Merge only the reviewed candidate, deploy the same immutable main SHA to
   the existing Railway app services and Netlify sites. No bulk IaC apply.
   Verify release metadata, health, effective caps/grace and image identities.
3. Begin at one render, one disposable 720p ASS export, then one 1080p DOM
   export. Verify owner isolation, one debit, usable MP4/attachment filename,
   reconnect/download-again without new charge, and source-to-result fidelity.
   Use new job IDs and captions so render-cache hits do not masquerade as work.
4. Only after those pass, test at most three real exports across the existing
   replica ceiling. Confirm at most three active drains through replacement,
   no missing/duplicate results and no interruption of the original job. Do
   not use the old 100-job capacity probe or GCS-only media-load script.
5. Observe platform peak process-tree/container RAM and ephemeral disk, queue
   age, duration, retry logs and API latency. Keep at least 20% RAM headroom
   for accepted workloads. Failure or insufficient headroom stops admission;
   4K/60 fps remains unqualified until its production measurements pass.
6. Missed wake/browser-closed and loss-of-result response must recover; verify
   no double debit. Production database outages and worker termination drills
   must be isolated to disposable work, with no customer outage. If isolation
   is unavailable, retain those as explicit unmet gates.
7. Confirm cron recovery, empty queue/started/scheduled registries and leases,
   return to one effective replica and SLEEPING. Verify the API sleeps over an
   idle interval. Record actual usage and inspect delayed billing the next day.

Pilot maximum **six new export jobs total**, at most three at once. Stop new
submissions after **60 minutes**, with at most **31 minutes graceful drain**
for accepted jobs. All app services at caps for 91 minutes cost about **$1.06**;
allow up to 1 GB Railway egress ($0.05), existing Redis/volume usage and margin
within $2. This is an estimate plus operator stop loss, not a separate provider
hard cap. Do not start if headroom/quotas or continuous supervision are absent.

## Expiry, rollback and data preservation

- At expiry or failure, stop the pilot and set durable
  `ops/service_controls.pause_exports=true` (and pause uploads/transcription
  if implicated), with a customer-readable notice. Preserve saved captions,
  accepted job state, payment reconciliation and media. Controls have a cache
  interval and can fail open during Firestore outages; verify rejection rather
  than assuming the switch succeeded.
- Disable API/cron render scaling; retain the 1860-second shutdown grace. Let
  accepted work drain; reduce effective render count to one only when queues,
  started/scheduled jobs and active drains are empty and the service is asleep.
  Verify actual deployments, not just saved configuration.
- If emergency admission cannot be stopped through controls, stop public API
  ingress/service temporarily and preserve private workers/data; record that
  payments/webhooks will need reconciliation. Do not delete Redis, its volume,
  R2 objects, Firebase data or close billing accounts as a shutdown shortcut.
- Roll back the app images and frontend to recorded healthy release
  `5f1345a1776f308bce4949d99ec6f8e9836af05f` only after draining work. Preserve
  new billing-result fields. Reconcile billed exports before enabling new work.
- Retain the owner's subsequently authorized $7 GitHub Actions stop-usage
  budget; never raise it or disable stop usage automatically. Keep Railway
  $15/$8 unchanged. The original proposal to temporarily use $8 was superseded.
- Broad promotion remains gated on current-release customer acceptance,
  recovery evidence, basic alert delivery/backup recovery and sustainable
  measured cost. A failed or partial pilot does not authorize a full launch.

