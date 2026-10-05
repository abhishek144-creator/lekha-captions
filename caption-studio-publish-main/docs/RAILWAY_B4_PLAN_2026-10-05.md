# Railway B4 approved test plan — 2026-10-05

The owner approved the rollout and this finite staging plan, authorized its
metered AI calls without a separate $10 allowance, and then changed the Railway
cap from $50 to **$25**. The live cap is verified at $25 with a $10 custom email
alert. Deployment and staging remain conditional on PR #35's release gate.
GitHub currently blocks the failed-job retry because of account payments or
spending limits. Approval and estimates are not evidence that B4 ran.

Read-only inventory: Railway Hobby project `lekha-captions`
(`073ba0e0-3fb7-4aec-89eb-36d97c2f2074`), Singapore region,
production environment only. Current hard cap $25, email alert $10, usage about
$0.22. API/transcription/render each have one sleeping replica; cron and Redis
remain. Staging must be created and isolated before customer-like traffic.

## Resources and limits

Prepare one temporary staging environment: one API (2 vCPU/2 GiB), one cron
(1 vCPU/1 GiB, production recovery cadence), one bounded Redis/volume, one
render service (one replica for CPU benchmarks; at most five 8 vCPU/8 GiB
replicas for load), one transcription service (at most five 2 vCPU/3 GiB
replicas). Use a separate R2 bucket/prefix and disposable Firebase identities;
never copy live payment keys or send test traffic to production. No domain,
provider-plan upgrade, extra permanent worker or warm idle minimum is needed.
Both worker services sleep. Verify the actual plan contains only these intended
staging additions and no production modification/deletion before applying it.

## Priced estimates and approved limit

Current [Railway rates](https://railway.com/pricing) are
$0.00000772/vCPU-second, $0.00000386/GB-second and $0.05/GB egress.
At source limits the API, cron and five replicas of each worker are roughly
$2.3/hour; actual CPU/RAM use can be lower. Two hours of test admission plus a
maximum 30-minute drain gives approximately $5.8 compute, before Redis,
volumes, export egress and tax. These are estimates; the owner removed the
separate $10 test allowance. Staging shares the $25 Railway workspace cap with
production. Monitor combined usage and stop admissions with enough remaining
headroom for draining and delayed billing updates.

Bound each media fixture to 60 seconds and 50 MiB. Run at most 220 account
journeys (10 then 100, cold/warm) and 24 benchmark exports. Railway export
egress at 50 MiB/output is below approximately $0.65. Standard R2 storage and
operation costs depend on remaining account free allowance; remove test media
after acceptance and verify lifecycle rules. With only Whisper transcription,
220 one-minute calls cost $1.32 at the [official $0.006/minute rate](https://developers.openai.com/api/docs/models/whisper-1).
The owner authorized the plan's metered AI calls. Provider, storage and database
charges are separate from Railway's cap; record them rather than describing
the test as free. Translation and real payments are outside this test.

There is no per-environment billing cap. The workspace hard cap is **$25**,
with a **$10 custom email alert** and Railway's automatic reminders at
**$18.75/$22.50** (75%/90%). This does not guarantee monthly availability. Reaching the hard
cap [takes all workloads offline](https://docs.railway.com/pricing/cost-control).
AI/storage/database charges are separate. GitHub Actions keeps its existing
budget; no CI budget increase is proposed.

Idle monthly resources remain Redis/volume, storage and any retained provider
state; sleeping workers avoid warm-worker RAM use but do not make total spend
zero. Before public launch, replace the historical idle estimates with measured
Redis size, cron runtime, retained media and actual billed daily usage. At the
full source ceilings, $25 lasts about 11 hours, before the other charges.

## Execution and expiry

1. After PR #35's release gate passes, inspect the pinned staging plan and
   approved release SHA before any apply. The owner already approved the live
   rollout and finite test; the revised $25 cap has been set and verified.
2. Prepare 100 disposable staging identities with valid Firebase ID/App Check
   tokens and sufficient quotas, using a private untracked credentials file.
   Use rights-cleared English/Hindi fixtures with fixed hashes and snapshots.
3. Run the documented 4/8-vCPU comparison at one render replica, including the
   separate authored-template fixture. Record actual image, CPU, RAM and raw
   outputs. Run one finite real-job resize/drain/sleep test per worker service
   before allowing the 1→5→1 burst phase.
4. Run 10 users; review errors, queue state and spend before 100. Preserve
   admission rejections and retries in results. Repeat cold/warm only within
   the time, job-count and workspace spending bounds; incomplete phases stay pending.
5. Stop new staging admissions after two hours, when remaining $25-cap
   headroom cannot safely cover draining, or on safety failures. Allow existing
   jobs at most their 30-minute timeout to
   drain; record remaining failed/retried work rather than hiding it.
6. Remove only test-owned media, identities, services and volumes after saving
   redacted evidence. Verify production queues/resources were untouched and
   no staging workers/resources remain. Check billing again after reporting
   delay; document actual usage instead of claiming the estimate was measured.

Record renderer median/P95 and failures in RENDERER_BENCHMARK.md, stage/queue
and journey percentiles in DRILL_LOG.md, and distinct replica/drain identities,
peak API/worker RAM and verified cleanup. Keep work ratios unchanged until the
measurements justify them.

Unmet prerequisites: a green hosted release gate, creation of isolated staging,
valid staging ID/App Check credentials, rights-cleared speech fixtures and
reviewed provider/database quota setup. The priced plan is approved. Passing
local tests does not satisfy the separate hosted and live acceptance gates.
