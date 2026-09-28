# Lekha product hardening review — 25 September 2026

## Evidence boundary

This document compares the requested improvements with the implementation at
Git `8288537438ee3592c685207543c61a9ecd73214b` plus the current local working
tree. It distinguishes repository behavior, recorded staging evidence, and the
last verified production release. No production deployment, resource resize,
paid load test, billing change, deletion, or provider call was performed.

Production was last recorded at release
`03f9f544125f73115b5437cf96b89b2dfd32c7a3`. Local changes are not production
evidence. The 24 September isolated staging run completed 100/100 short-media
customer journeys, but reused one 33.2 MB, 16.8 second source and did not test
payments, unique-media provider throughput, near-limit files, or browser UI.

## Decision rule

Keep the present design when it is already safer or better supported by
evidence. Change only a bounded weakness with a clear correctness,
maintainability, reliability, or measurement benefit. This rules out a
framework rewrite, speculative hardware, blind replica reductions, and a
hosting migration without a matched benchmark.

## Current customer journey and architecture

```text
signup/auth -> plan purchase or free allowance -> direct resumable upload
-> media validation -> durable transcription -> editor + local/cloud recovery
-> durable export queue -> ASS or isolated Chromium + FFmpeg
-> private retained output -> signed download -> support/refund/deletion
```

```text
Browser -> static Vite frontend -> regional API MIG (2-4 instances)
Browser -----------------------> private GCS resumable upload
API -> Firebase Auth/Firestore -> Redis HA -> render queue (3-20 workers)
                                      \----> transcription queue/helper
Worker -> ASS/libass or Chromium overlay -> FFmpeg -> private GCS
Browser <- short-lived authorized media URL <- API/GCS signer
```

The repository already has direct large-file uploads, ownership and exact-size
completion checks, media signature and ffprobe validation, upload admission,
durable transcription intent/outbox, idempotent export/payment effects, export
cancellation, bounded retries, tenant checks, account export/deletion,
scale-in protection, separate liveness/readiness, release identity, and staged
journey tooling. These were retained.

## Local improvements in this reviewable change

### Editor and customer clarity

- Source and translated captions are retained as separate bounded language
  tracks. Draft restore, cloud save, project reopen, reset, and export retain
  the selected track; translations no longer overwrite the source transcript.
- Caption text edits now reconcile unchanged timed words and indexed styling,
  flag new or replaced words for review, reject inside-word splits, remap split
  and duplicate metadata, and invalidate measured word timing when a timeline
  resize would move it outside the caption interval. Indic and compact-script
  cases are covered by focused contract tests.
- Same-account browser drafts are no longer erased on normal dashboard entry.
  Customers choose Continue draft, Start New, Download, or Discard; browser
  quota failures are visible. Direct uploads can resume after reload only after
  the same account reselects a file with the exact stored fingerprint. The
  browser receipt excludes the private storage session URI.
- The caption editor adds find/replace, bilingual comparison, editable speaker
  labels and sound cues, and a bounded automated review for transcript
  artifacts, overlaps/gaps, dense reading speed, and unsafe placement.
- Export requires an explicit human review confirmation. It shows the selected
  language, output aspect/crop preview, safe-area guide, and supports WebVTT in
  addition to existing caption downloads. Aspect selection is server-rendered;
  requested quality is not silently reduced for benchmark results.
- Marketing, FAQ, pricing, privacy, and terms language no longer claims a
  universal language count, unmeasured accuracy, or stronger privacy behavior
  than the implementation supports.

### Reliability, security, and operations

- Cloud drafts validate at most 20 language tracks and 500 captions per track,
  require a valid selected track, and continue to discard bearer URLs and
  unknown top-level fields.
- Render cache identity now includes the authenticated account as well as the
  media hash, captions, style/font settings, quality, FPS, aspect, and renderer
  version. Identical requests within one account can be reused without retaining
  or serving a cache artifact across tenants.
- Terraform defines a dedicated read-only media URL signer and grants the
  signer object reads only for the `exports/` prefix and grants the runtime
  identity a custom `signBlob`-only delegation role. CORS is sourced from an
  explicit Terraform origin list containing root, `www`, and editor origins,
  with upload cancellation enabled. The current runtime
  identity retains its existing media access because changing that boundary
  requires a canary and production approval.
- ESLint excludes generated test, preview, and local runtime directories, so a
  stale protected artifact no longer makes a source lint fail before scanning
  application code.

### Measurement

- Each completed export observation now records renderer (`ass` or `dom`),
  source/output dimensions, aspect choice, queue, preparation, render,
  finalization, total time, output bytes, duration, FPS, quality, cache hit, and
  estimated work.
- `scripts/analyze_export_observations.py` now reports P50/P95/P99 for every
  stage and groups completed observations by renderer, quality, FPS, duration
  bucket, source/output resolution, aspect, and combined workload profile.
- Cost ratios remain empty unless an actual billing total covering the same
  observation window is supplied. A configured estimate is not reported as an
  observed bill.

## Changes deliberately not made

| Proposal | Decision | Reason |
|---|---|---|
| Replace React/FastAPI | Keep | The boundaries are appropriate; migration risk exceeds demonstrated benefit. |
| Split into microservices | Keep one backend | Focused modules already exist for drafts, projects, uploads, job state, transcription, capacity, storage, and workers. Continue extraction only around touched behavior. |
| Reduce API or worker minimums | Keep 2 API / 3 workers | The staging 100-journey run needed two APIs; quiet-traffic utilization and cold-start/SLO tradeoffs are not measured. |
| Increase workers or vCPU | Keep 4-vCPU workers and ceiling 20 | No matched 4-vCPU/8-vCPU cost-per-success benchmark exists. Twenty 8-vCPU workers would exceed the last recorded 100-vCPU quota. |
| Change autoscaling to work estimates | Keep queue depth + CPU for now | Work seconds and oldest age are published as shadow metrics, but prediction error is not calibrated. Switching the control signal now could increase cost or under-scale. |
| GPU/NVENC pool | Do not add | GPU quota was recorded as zero and no end-to-end quality/cost benchmark exists. CPU fallback remains useful. |
| Spot workers | Do not add | No preemption drill proves retry cost and customer wait remain acceptable. |
| Cloud Run API | Retain API MIG | No matched concurrency, cold-start, local dependency, and cost benchmark has shown it to be better. |
| Firebase Hosting migration | Retain current delivery pending comparison | Static hosting may be simpler, but current traffic cost, auth rewrites, cache behavior, rollback, and SEO split have not been compared. |
| Remove Basic Redis | Inspect first | A separate instance was observed, but dependency and environment ownership must be proven before deletion. |
| Short/long priority queues | Do not introduce yet | Per-account single-active-export admission and round-robin queue consumption already provide useful fairness. Workload distributions are needed before extra queue policy. |

## Evidence-based scorecard

Scores are directional engineering judgments, not certifications. Confidence
reflects the quality of current evidence.

| Department | Provisional score | Confidence | Evidence and remaining gap |
|---|---:|---|---|
| Framework and architecture | 8/10 | High | Appropriate stack and worker separation; orchestration files remain large. |
| Editor and frontend | 8/10 | Medium | Draft revisions, track preservation, review UI, cancellation, and recovery contracts exist; real long-project/mobile and multi-tab tests remain. |
| Upload and storage | 8/10 | Medium | Direct resumable path, admission, ownership, size/probe/scanner gates, replay and cleanup exist; near-500 MiB browser refresh recovery remains unproved. |
| Transcription and AI cost | 7/10 | Medium-low | Durable dedupe avoids unsafe repeats and styling edits reuse captions; representative language/provider quality and contracted quota data are missing. |
| Export correctness | 8/10 | Medium-high | Large preview/export contract matrix and renderer routing exist; representative long/4K/60 FPS/VFR/A-V sync matrix still needs recorded results. |
| Export speed | 7/10 | Medium | Staging 100-journey render P50/P95 was 23.7/35.4 s for one short workload; broader profile percentiles are not yet measured. |
| Backend/job reliability | 8/10 | High for code, medium for live recovery | Durable states, cancellation races, bounded retries, scale-in protection, and worker interruption tests exist; live Redis failover/full-disk/deploy-during-render drills remain. |
| Payments and credits | 8/10 | Medium-high | Signature binding, replay/idempotency, atomic credit effects, refund paths, and tests exist; launch-release paid purchase/refund evidence is still required. |
| Security and privacy | 8/10 | Medium | Tenant isolation, signed media, command boundaries, fail-closed production modes, dependency gates, and deletion exist; independent current pentest/IAM review is absent. |
| Burst capacity | 7/10 | Medium | Isolated 100/100 short journeys passed with 10 workers and two APIs; unique media, mixed templates, near-limit uploads, provider throttling, and autoscaling cold start remain. |
| Cost efficiency | 5/10 | Low | Unit-cost analyzer and verified storage SKU math exist; actual billing attribution, idle utilization, provider cost, retries, and egress mix are missing. |
| Operations and maintainability | 7/10 | Medium | Terraform, release gates, readiness, incident and rollback docs exist; live/documented Redis and capacity generations still need reconciliation. |

## Capacity recommendation

Keep the present production limits until representative observations justify a
change.

| Traffic state | Recommended starting point | Assumptions and promotion rule |
|---|---|---|
| Quiet | 2 API, 3 warm 4-vCPU workers | Preserves API and render redundancy. Trial one warm worker only in isolated staging, then promote only if measured idle savings outweigh cold-start and queue-tail regression. |
| Normal | 2 API, 3-10 4-vCPU workers, one render per worker | Size from arrival rate × measured service time with headroom. Separate transcription workers when measured contention appears. |
| Burst | Autoscale within the current 20-worker ceiling | The 100-user staging result used 10 manually warm workers for one short 720p profile. Prove quota headroom and mixed-workload P95 before changing the ceiling or relying on cold autoscale. |

Idealized capacity is `workers >= arrival_rate_per_second × P95_service_seconds
/ target_utilization`. Queue promises must use observed service-time mixtures,
not registered-user count. An 8-vCPU comparison must report throughput, visual
parity, failures, and cost per successful rendered minute against two current
workers.

## Cost scenarios and known prices

The 23 September review verified Mumbai Standard Storage at
`$0.023/GiB-month` and used `$0.12/GiB` as the published first-tier example for
Asia Internet download. These are list-price examples, not the observed Lekha
bill and omit taxes, discounts, operations, compute, Redis, logging, networking,
builds, and AI providers.

| Example monthly volume | Source storage: 500 MiB, 6 h active + 7 d soft delete | One 500 MiB Internet download each |
|---:|---:|---:|
| 100 files | about $0.27 | about $5.86 |
| 1,000 files | about $2.71 | about $58.59 |
| 10,000 files | about $27.14 | about $585.94 |

Use the export analyzer with a billing total for the identical time window to
calculate actual cost per successful export and per rendered video minute.
Produce quiet, normal, and burst monthly scenarios only after billing export
rows can be attributed to API, render, Redis, storage, egress, logging, builds,
and transcription. Budget alerts do not enforce a cap; current worker maximum,
queue admission, per-account allowances, and provider limits are the actual
bounded controls.

## Validation performed locally

- Frontend ESLint and TypeScript checks passed.
- Vite production build passed.
- Frontend contract suite passed, including upload recovery, direct-upload
  resume, dragged-word export, pricing defaults, auth redirect, release
  metadata, caption review, and WebVTT checks.
- Backend full suite passed 211/211, including language-track validation,
  observation grouping, cache isolation, payment, upload, recovery, and media
  boundary cases.
- The Next.js marketing static build passed with explicit local-only legal
  placeholders. A real release must still supply the required legal identity
  values; the production build correctly fails closed when they are absent.
- Terraform formatting and validation passed.

These checks establish local correctness only. They do not provide before/after
latency or cost because the change was not deployed and no paid test was run.

## Runbooks and operating sources

- Architecture and evidence: `docs/INFRASTRUCTURE_REVIEW_2026-09-23.md`,
  `docs/MEASURED_INFRA_READINESS.md`, and
  `docs/GCP_ISOLATED_MEDIA_LOAD_TEST_2026-09-24.md`.
- Deployment and rollback: `docs/GCP_DEPLOYMENT_2026-09-11.md`,
  `docs/GCP_SCALING_DEPLOYMENT_2026-09-12.md`, and
  `docs/RELEASE_RECORD_TEMPLATE.md`.
- Incident and recovery: `docs/INCIDENT_RESPONSE.md`,
  `docs/PHASE2_RECOVERY_RUNBOOK.md`, and `docs/MASS_LAUNCH_RUNBOOK.md`.
- Current production identity: `docs/GCP_PRODUCTION_RELEASE_2026-09-24.md`.

## Launch verdicts

**Controlled paid launch:** conditionally supportable on the currently deployed
and separately approved capacity, with admission limits, release verification,
journey monitoring, payment reconciliation, and rollback ownership. This local
working tree must pass staging/canary before it changes that verdict.

**Unrestricted mass paid launch:** not yet supported by evidence. Close the
remaining gates with representative unique media, mixed languages/templates,
near-limit uploads, paid/free journeys, current-release purchase/refund tests,
Redis and worker-loss drills, billing reconciliation, and actual workload
P50/P95/P99. Define targets before each test and do not change them after seeing
results.

## Approval-bound next actions

Before any production change, prepare a release SHA, exact Terraform plan,
rollback image/template, canary checks, expected test duration, disposable
identities/media, and explicit cost ceiling. Obtain approval before deploying,
resizing, running paid provider/load tests, deleting either Redis instance or
other resources, changing retention, requesting GPU quota, or creating recurring
spend.
