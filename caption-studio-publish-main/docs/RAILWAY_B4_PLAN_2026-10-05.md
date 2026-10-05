# Railway B4 test plan awaiting approval — 2026-10-05

The owner selected preparation of the $50 launch profile. This is a concrete
proposal for changing the live cap and running B4, not evidence that B4 ran.

Read-only inventory: Railway Hobby project `lekha-captions`
(`073ba0e0-3fb7-4aec-89eb-36d97c2f2074`), Singapore region,
production environment only. Current hard cap $15, email alert $8, usage about
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

## Priced allowance

Current [Railway rates](https://railway.com/pricing) are
$0.00000772/vCPU-second, $0.00000386/GB-second and $0.05/GB egress.
At source limits the API, cron and five replicas of each worker are roughly
$2.3/hour; actual CPU/RAM use can be lower. Two hours of test admission plus a
maximum 30-minute drain gives approximately $5.8 compute, before Redis,
volumes, export egress and tax. Reserve **$8 incremental Railway usage**, plus
**$2 for AI/storage/database usage**: **$10 total test allowance, excluding tax**.

Bound each media fixture to 60 seconds and 50 MiB. Run at most 220 account
journeys (10 then 100, cold/warm) and 24 benchmark exports. Railway export
egress at 50 MiB/output is below approximately $0.65. Standard R2 storage and
operation costs depend on remaining account free allowance; remove test media
after acceptance and verify lifecycle rules. With only Whisper transcription,
220 one-minute calls cost $1.32 at the [official $0.006/minute rate](https://developers.openai.com/api/docs/models/whisper-1).
If the selected live provider, language detection, quota setup or database
operations need more than the $2 allowance, stop and revise this plan before
running. Translation and real payments are outside this test.

These are estimates and a stop criterion, not an automatic per-environment
billing cap. The proposed workspace hard cap becomes **$50**, with alerts at
**$20/$35**; this does not guarantee monthly availability. Reaching the hard
cap [takes all workloads offline](https://docs.railway.com/pricing/cost-control).
AI/storage/database charges are separate. GitHub Actions keeps its existing
budget; no CI budget increase is proposed.

Idle monthly resources remain Redis/volume, storage and any retained provider
state; sleeping workers avoid warm-worker RAM use but do not make total spend
zero. Before public launch, replace the historical idle estimates with measured
Redis size, cron runtime, retained media and actual billed daily usage. At the
full source ceilings, $50 lasts about 22 hours, before the other charges.

## Execution and expiry

1. Approve the live $50 cap/$20-$35 alerts and this $10 finite allowance, then
   inspect the pinned staging plan and approved release SHA before any apply.
2. Prepare 100 disposable staging identities with valid Firebase ID/App Check
   tokens and sufficient quotas, using a private untracked credentials file.
   Use rights-cleared English/Hindi fixtures with fixed hashes and snapshots.
3. Run the documented 4/8-vCPU comparison at one render replica, including the
   separate authored-template fixture. Record actual image, CPU, RAM and raw
   outputs. Run one finite real-job resize/drain/sleep test per worker service
   before allowing the 1→5→1 burst phase.
4. Run 10 users; review errors, queue state and spend before 100. Preserve
   admission rejections and retries in results. Repeat cold/warm only within
   the time, job-count and dollar bounds; incomplete phases stay pending.
5. Stop new staging admissions after two hours, at the $10 allowance, or on
   safety failures. Allow existing jobs at most their 30-minute timeout to
   drain; record remaining failed/retried work rather than hiding it.
6. Remove only test-owned media, identities, services and volumes after saving
   redacted evidence. Verify production queues/resources were untouched and
   no staging workers/resources remain. Check billing again after reporting
   delay; document actual usage instead of claiming the estimate was measured.

Record renderer median/P95 and failures in RENDERER_BENCHMARK.md, stage/queue
and journey percentiles in DRILL_LOG.md, and distinct replica/drain identities,
peak API/worker RAM and verified cleanup. Keep work ratios unchanged until the
measurements justify them.

Unmet prerequisites: approval of the priced live plan, creation of isolated
staging, valid staging ID/App Check credentials, rights-cleared speech fixtures
and reviewed provider/database quota setup. None of these is satisfied by
passing local tests or preparing the source $50 profile.
