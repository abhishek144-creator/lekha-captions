# Remaining live acceptance — proposed, awaiting owner approval

The earlier B4 staging environment expired and was deleted. Its finite approval
does not authorize recreating it. AGENTS.md requires a written priced plan and
explicit owner approval before creating paid resources. This proposal retains
the Railway $25 workspace hard cap and $10 alert, and Actions $10 hard stop.
Netlify billing is excluded. No resource has been created for this proposal.
The owner explicitly declined the fresh 100-user upload-to-download test.
That phase is removed; this revised proposal supersedes the earlier 120-journey
proposal and its pending approval question. Remaining paid staging is unapproved.

## Prerequisites

- PR #37 is already merged/deployed as `63cf04f`, after the owner accepted
  completed exact local final-image verification for that PR only. Fresh daily
  signatures, real 500 MiB scans and public readiness were verified. Hosted
  Actions remain at the unchanged $10 hard stop; this exception does not waive
  the release gates for future code changes.
- Verify the immutable release and effective operating profile again before
  any separately approved future staging phase.
- Approve this finite phase, inspect its exact staging-only resource diff, and
  establish disposable identity/media manifests and automatic cleanup before
  resource creation. No production SSH key or load traffic is needed.

## Fixed inventory

One isolated temporary environment in the existing Railway project, using the
same reviewed service sizes: API 2 CPU/2 GiB; cron 1 CPU/1 GiB; render baseline
one 8 CPU/8 GiB, ceiling two; transcription baseline one 2 CPU/3 GiB, ceiling
two; isolated Redis bounded at 1 CPU/1 GiB and one temporary volume capped at
1 GB. Shared production services and their volume remain preserved.

Use a new manifest-owned prefix in the existing R2 bucket and at most 20 new
disposable Firebase accounts. Copy no payment keys. Prefer deploy-time runner
tools and signed control requests; registering another account SSH key requires
separate specific action-time approval. No permanent credential, subscription,
region, provider upgrade or automation is included.

## Finite workload

Maximum 20 authenticated journeys plus 12 authored-animation benchmark renders:

1. Twelve individually inspected media cases: varied supported codecs, aspect
   ratios, frame rates, speech and languages; include 180-second and near/exact
   500 MiB cases. Inspect each generated output rather than accepting HTTP alone.
2. Eight reserved diagnostic/recovery journeys; no admissions beyond 20. Reuse
   completed job receipts for sustained download/retry checks without rendering
   or debiting again. At most 200 downloads, with at most 20 concurrent clients.
3. Twelve DOM authored-animation renders: one warmup plus five measurements on
   each of four/eight CPUs, identical fixture and source; record actual quotas,
   timings and peak memory. Preserve conservative workload ratios unless the
   representative results justify a change.

Cap transcription at 60 audio minutes, rendered object uploads at 6 GB, and
retained test media at 15 GB. Rights-cleared English/Hindi source fixtures already
exist; additional cases must have recorded rights and representative content.
Desktop browser mobile emulation is recorded as emulation; actual-device download
acceptance requires the owner to perform that final device-specific step.

## Price and stops

Using [Railway's current rates](https://railway.com/pricing), the full temporary
profile with two worker replicas each is approximately $1.03/hour. Two hours of
admissions plus a 30-minute maximum drain is about $2.6 compute; 6 GB service
egress is up to $0.30. Budget **up to $4 additional Railway usage** for this phase, inside the unchanged $25
workspace cap. This is a finite test allowance, not a monthly guarantee.

[Whisper](https://developers.openai.com/api/docs/models/whisper-1) costs $0.006
per minute: 60 minutes is $0.36. Allow **up to $6 additional AI/storage/database
usage** separately from Railway: $1 transcription and $5 for storage/database
operations. [R2](https://developers.cloudflare.com/r2/pricing/) has free direct
egress but rounds billable operation units; allowance consumption must be checked
before execution. Taxes may be additional. Do not substitute a more expensive
provider or exceed this allowance without approval.

The phase expires two hours after first admission, followed by at most 30 minutes
drain. Record the absolute UTC admission/cleanup deadlines before launch. Stop
early for unsafe behavior, duplicate charges, excessive errors, resource drift,
exhausted workload/provider allowance or insufficient Railway headroom. Reserve
at least $6 of current Railway cap headroom before starting to cover this phase
and production/billing delay; delayed cost readings are estimates.

## Acceptance and cleanup

Record first-pass transport failures separately from recovered outcomes. Compare
download clients and storage timing before attributing the earlier timeouts.
Require valid media for every accepted job, receipt recovery with no extra debit,
bounded queue/replica counts, healthy memory, scale-down and actual idle sleep.
Resolve any reproduced defect and rerun only within the remaining finite ledger.
An incomplete phase remains incomplete; do not refill the ledger automatically.

Save redacted evidence, remove only manifest-owned accounts/media/environment
and its temporary tokens, verify their absence and production preservation, and
reconcile reported usage. Do not overwrite the earlier completed cleanup counts.
Use the measurements to state a supported traffic envelope; no finite test
certifies arbitrary unlimited demand.
