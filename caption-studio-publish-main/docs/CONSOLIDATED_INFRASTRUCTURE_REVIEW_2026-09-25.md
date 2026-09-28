# Consolidated infrastructure review — 25 September 2026

This record reconciles the four supplied reviews with the current checkout at
`8288537438ee3592c685207543c61a9ecd73214b`. That is a source checkout identity,
not proof of the release currently serving production traffic.

## Result

The public-repository reviews describe an older baseline. The working tree
already contains most of their high-value recommendations:

- production browser-to-GCS resumable uploads up to 500 MiB, with localhost-only
  proxy fallback;
- authoritative object-size/ownership checks, explicit scan state, ffprobe and
  malware gates before transcription or export;
- private objects, short-lived signed downloads, cleanup and lifecycle rules;
- Redis/RQ durability, bounded admission, retry/idempotency and one heavy render
  per worker;
- ASS/FFmpeg routing for simple captions and Chromium/FFmpeg for rich templates;
- final-resolution DOM overlays, `veryfast` CPU encoding and safe NVENC fallback;
- a warm Chromium daemon with a fresh isolated context per render;
- independent render and transcription queues and scale-to-zero MIGs;
- tenant-scoped durable render cache and upload-time media identity reuse;
- queue depth, oldest age and shadow pending-work metrics plus render-stage and
  cost-analysis tooling.

## Changes made after comparison

| Change | Reason |
|---|---|
| Install repository TTF files into the render image's system font directory and refresh fontconfig | Chromium can use the same packaged fonts as ASS instead of depending on a first-job download. |
| Build and hash a complete template-font CSS bundle in the render image; inject it before rendering | Known template families no longer depend on a runtime Google Fonts fetch. Arbitrary user-selected families retain a guarded fallback. |
| Add smoothed upload throughput and approximate remaining time to direct-upload progress | Uses actual bytes transferred in the current browser session and does not count bytes from a resumed session. |
| Derive ASS/DOM work-ratio percentiles from completed observations | Operators can calibrate the existing shadow model with real render data instead of promoting arbitrary multipliers. This does not automatically change admission or autoscaling. |
| Extend release contracts for warm-browser and packaged-font behavior | Prevents the low-cost render optimizations from silently regressing. |
| Add Firebase Hosting SPA/cache configuration | Makes static hosting deployable from `dist/` without changing production DNS automatically. |
| Add a parallel Cloud Run API, VPC connector, serverless NEG, secret mount, and OIDC Cloud Scheduler jobs | Completes the migration path while leaving traffic cutover explicit and reversible. |
| Adopt the 8-vCPU/100 GB SSD baseline render profile and bounded scale-from-zero baseline and Spot MIGs | Matches the reviewed profile while allowing zero render capacity at idle. |
| Enable the tenant-scoped exact-request cache for animated/template exports | Repeated deterministic DOM exports now reuse validated durable output; an emergency environment switch remains. |
| Dispatch malware scanning from direct-upload completion through a Firestore outbox and dedicated RQ queue | Large uploads are scanned centrally and eagerly; scanner outages retry instead of being mislabeled as malware. |
| Extract malware scanning, media-scan delivery, and scheduler authorization from `main.py` | Continues the modular split around security and background-work boundaries without a risky broad rewrite. |

## Decisions retained because the current approach is safer

| Proposal | Decision | Evidence required before changing it |
|---|---|---|
| Route production FastAPI traffic to Cloud Run | Candidate and NEG implemented; cutover remains gated | Matched concurrency 20/40/80, cold-start, dependency, failure and cost comparison. |
| Point production DNS at Firebase Hosting | Hosting implementation is ready; DNS/deployment remains gated | Deployment/rollback, authenticated routing, cache and observed cost comparison. |
| Raise worker or Spot ceilings beyond the bounded defaults | Keep ceilings configurable | Preemption drills, matched cost/latency evidence, and regional quota headroom. |
| Add L4/G2 workers | Keep code-level NVENC fallback only | GPU quota plus end-to-end CPU/GPU quality, throughput and cost-per-minute benchmark. |
| Switch autoscaling to work estimates | Keep work estimates as shadow metrics | Representative prediction error and queue-SLO evidence. Queue depth already provides safe scale-out. |
| Split fast/normal/heavy queues | Keep the current fair single export queue | Measured workload distribution and starvation analysis. |
| Show exact queue position or completion time | Keep truthful phase messages | Calibrated throughput and sufficiently stable prediction error. |
| Raise or lower the worker ceiling | Keep it configurable and unchanged by this review | Full authenticated 10/25/50/100-user journeys with mixed workloads and cold autoscaling. |

## Production evidence still required

Repository tests cannot establish production SHA, cloud resource state, current
billing, provider quota or mass-launch capacity. Before unrestricted launch,
record the deployed release and run:

1. interrupted near-500 MiB browser uploads at 10%, 50% and 90%, including page
   reload, completion replay, cancellation and janitor cleanup;
2. representative ASS and DOM renders across durations, resolutions, scripts
   and 30/60 FPS, then calibrate work ratios from the observation analyzer;
3. authenticated 10/25/50/100-user upload-to-download staging journeys with
   cold autoscaling and mixed media;
4. render-worker loss, Redis failover, retry/credit idempotency and rollback
   drills;
5. matched billing exports for idle and burst windows before changing machine,
   Spot, GPU, API or hosting architecture.

Until those gates pass, the code supports a controlled, measured rollout; it
does not by itself prove unrestricted mass-launch readiness.
