# Lekha Captions: cloud cost decision
Research completed 29 September 2026. INR planning estimates, not a purchase quote.

**Recommendation: choose the redesigned Google serverless architecture for low idle cost. Do not redeploy the existing Terraform. Utho is a plausible later choice for sustained throughput and downloads, but is not a verified zero-idle worker platform. Its complete, equally resilient price remains unverified.**

## Evidence and limits
Read AGENTS.md, CLAUDE.md, the complete 1,057-line DEVELOPMENT_LOG.md, docs/GCP_DEPLOYMENT_PROMPT.md, the architecture gap verification, current backend and Terraform. Historical deployment descriptions are not a live inventory. No cloud account was opened, old billing account reopened, application code changed, infrastructure deployed, paid resource created, or load test run. A different Google email does not cancel prior obligations.

Public Utho checkout redirected to authentication. Therefore the requested final checkout price, exact CPU SKU, storage attachment, taxes and contract cannot honestly be certified. No account was created to get a quote. Google's calculator was inspected, but a completed saved Mumbai estimate was not obtained; calculations below reproduce official unit prices and expose inputs instead. These are material verification gaps, not assumed confirmations.

## What the code actually needs
Production currently requires Redis and RQ. Setting minimum API instances to zero or replacing RQ dispatch alone would not eliminate Redis. Current Terraform includes provisioned Redis, NAT and VM groups; it is unsuitable as the starting deployment plan.

| Responsibility | Required replacement for a Redis-free design |
|---|---|
| RQ scan/transcription/export queues | Durable Firestore job/outbox records, Cloud Tasks dispatch, one finite Cloud Run Job per accepted stage |
| Payment/webhook/export idempotency | Transactional Firestore records keyed by stable business/event IDs; signature checks, payload matching, durable response and credit ledger |
| Job state and compare-and-set updates | Firestore transactions with state version and fenced lease; client reads/subscriptions or bounded polling |
| Admission: pending work, active uploads, bytes | Transactional reservations, per-user/global limits and expiry reconciliation; fail closed on datastore error |
| Rate limits and daily paid-call limits | Transactional time-window counters; App Check/auth before expensive work; no process-local substitutes |
| Locks, worker heartbeat, cancellation/retry | Expiring fenced leases, execution IDs, cancellation reconciliation and targeted watchdog tasks |
| Provider circuit breaker/single probe | Shared durable breaker/probe lease; preserve UNKNOWN transcription outcomes without replay |
| Upload ownership/metadata and duration | Durable upload sessions bound to user/object generation; verified finalization and scan status |
| Credit deduction/refunds | Preserve transactional exactly-once successful-export debit; reserve credit before admission and release only after definitive failure |

Cloud Tasks can deliver duplicates. A dispatcher returning success after starting a job does not make queue concurrency a global worker cap. Atomically reserve a global execution slot before launch, record the execution identity, and reconcile uncertain launches before releasing the reservation. A crash between Firestore commit and task creation needs a durable outbox publisher (event-triggered) plus targeted recovery. Do not substitute a permanently polling worker. Paid provider UNKNOWN states must require reconciliation, not automatic second payment. [Cloud Tasks behavior](https://docs.cloud.google.com/tasks/docs/common-pitfalls)

The code's export credits do not cap transcription/translation spending. Processing can occur without a successful export; translation can make a second GPT call. The system provider quota currently has a fail-open path. Fix this before either launch.

## Designs and reliability
**Google:** static Firebase Hosting dashboard; retain existing marketing hosting only after checking its bill. Cloud Run API request billing, min 0, bounded maximum instances; direct private GCS resumable uploads to quarantine; finite scan, transcription and export Jobs; Firestore ledger/state; Cloud Tasks and event-driven outbox. No Redis, VM, GKE, NAT, VPC connector or external load balancer is required for this baseline. Use the managed service URL initially if custom API-domain routing would introduce fixed infrastructure. Malware definitions, fonts and renderer dependencies must be available without a permanent worker. Cold starts and queue delay are accepted.

**Lowest-capital Utho:** one VM running API, Redis/RQ and one worker, private S3 media, retained Firebase Auth/Firestore. This preserves the most code but has one failure domain. A 2-vCPU/4-GB VM is cheap yet not qualified for 4K rendering. A 2-vCPU/16-GB memory VM is a candidate to test; the planning configuration below uses 6-vCPU/16-GB shared CPU so one 4-CPU/12-GB render leaves headroom. No cloud benchmark establishes that shared vCPUs perform like Cloud Run.

**Comparable resilience target:** regional durable media/database, recoverable accepted jobs, tolerance of one compute-node failure, bounded queue delay rather than an instant-render promise. Utho needs two suitable VMs in independent failure domains, an available load balancer, and durable shared state. Use the same Firestore queue/lease rewrite to avoid a single Redis point of failure; retaining Redis instead requires pricing HA Redis. Two VMs alone do not establish equivalent availability. Utho object-store Mumbai availability, durability/replication, failure-domain separation and LB pricing remain unverified. Its cost column is consequently a *conditional lower bound*, not a certified equivalent offer.

A hybrid with Utho compute and Mumbai GCS preserves the same storage properties, but adds GCS internet transfer to workers. At the assumed 124 MiB average source and two full worker reads, that alone adds about ₹2.76 per export, plus GCS download/storage charges. Cheap Utho egress would not remove GCS charges.

No documented Utho managed job service with zero worker compute at idle was found in its official product/API material. Kubernetes pods at zero do not mean VM nodes at zero. A custom controller could create/destroy VMs, but that adds startup, reconciliation and billing uncertainties; it is not an established replacement for Cloud Run Jobs. [Utho API catalogue](https://utho.com/rest-api/)

## Verified public prices and unresolved quote
Utho public selector observations (Mumbai deploy links; not authenticated checkout):

| Item | Observed public amount |
|---|---:|
| Shared 8 vCPU/32 GB, 480 GB NVMe, 1,000 GB transfer | ₹21,585/quarter = ₹7,195/month; ₹9.86/hour alternative |
| Alternate same-size shared listing | ₹26,982/quarter = ₹8,994/month |
| Shared 6 vCPU/16 GB, 320 GB, 1,000 GB transfer | ₹6.04/hour |
| Memory 2 vCPU/16 GB | ₹3.75/hour |
| Dedicated 8 vCPU/32 GB | ₹17.09/hour |
| Entry managed database | ₹2,691/month; HA/backups not established |
| Object capacity 50/100/500 GB | ₹225/₹350/₹1,350 monthly |
| Extra block storage | ₹4/GB-month |

Source: [Utho pricing](https://utho.com/pricing). Quarterly totals imply advance commitment; do not confuse their monthly equivalent with hourly cancellation. Rounded hourly rates need final billing-cycle confirmation. The screenshot's ₹6,690 is not the currently observed quote. Generic AMD EPYC advertising does not establish the exact CPU generation or shared-CPU entitlement. Deploy links used an EBS parameter despite NVMe table labels.

[Utho simple pricing](https://utho.com/simple-pricing) advertises hourly use without minimum commitment and no egress/bandwidth-overage fees. Included-transfer allowances still appear in its tables; enforceable excess-use, fair-use and throttling rules need written confirmation. IPs, cross-zone traffic, LB and backup inclusions are not established. A separate [legacy order page](https://utho.com/salespages/order) quotes weekly backup at 20% of server price; do not assume it applies to these plans. VM backups are unnecessary for disposable workers, but durable database/media recovery is necessary.

[Utho terms](https://utho.com/term-condition) exclude GST from fees, distinguish On/Off from deprovisioning, and make fees payable through deprovisioning even when unused or suspended. **They do not clearly promise that manual power-off stops compute billing. Budget the full provisioned price while off until Utho confirms otherwise in writing.** Deprovisioning releases resources and can delete data/backups. Do not test this on production. Account-specific minimum fees and retained storage also require confirmation.

The Utho-vs-Google marketing price has no verified matching machine family, region, availability, bandwidth or discount assumptions. It is not evidence for this application comparison.

## Google and provider price inputs
USD conversions use **₹95/USD as an explicit planning assumption**, not a verified exchange rate or Google INR SKU quote. Use actual INR billing SKUs before purchase. No trial credits, committed-use discounts or promotional credits are assumed.

| Component | Official price used |
|---|---|
| Cloud Run request API | $0.000024/vCPU-second; $0.0000025/GiB-second; $0.40/million requests |
| Cloud Run Jobs | $0.000018/vCPU-second + $0.000002/GiB-second; minimum 60 seconds per task attempt |
| Mumbai Standard GCS | $0.02/GiB-month |
| GCS downloads to modeled Indian users | $0.12/GiB, first volume tier |
| GCS operations | Standard flat namespace Class A $0.005/1,000; B $0.0004/1,000 |
| Cloud Tasks | First million operations free; then $0.40/million; payload chunks/retries count |
| Artifact Registry | $0.10/GiB-month after 0.5 GiB free |
| Secret Manager | $0.06/active version-month after 6 free; accesses $0.03/10,000 after free allowance |
| Logging | First 50 GiB/project/month ingestion free; then $0.50/GiB |
| Static Firebase Hosting | 10 GB storage and 360 MB/day transfer free; excess transfer $0.15/GB |

Sources: [Run](https://cloud.google.com/run/pricing), [Storage](https://cloud.google.com/storage/pricing), [Tasks](https://cloud.google.com/tasks/pricing), [Registry](https://cloud.google.com/artifact-registry/pricing), [Secrets](https://cloud.google.com/secret-manager/pricing), [Logging](https://cloud.google.com/products/observability/pricing), [Hosting](https://firebase.google.com/pricing).

Run request and Jobs free allowances are shared at billing-account scope within applicable billing categories, not multiplied by job types. The model conservatively charges gross job usage; eligible Jobs allowance can reduce a month by up to about ₹496 before tax at this exchange assumption. Job definitions and min-zero API compute cost zero without execution/requests. Startup is billable.

Firestore provides limited free daily operations and 1 GiB storage; backups, TTL and PITR can be separately billable. Mumbai paid Firestore SKUs were not independently resolved, so the table uses a disclosed allowance rather than claiming an exact DB quote. [Firestore pricing](https://cloud.google.com/firestore/pricing)

Sarvam batch STT ₹30/hour = ₹0.50/minute; Whisper $0.006/minute = ₹0.57; GPT-4o $2.50/million input and $10/million output tokens. These match the code's providers/models, not a new model recommendation. [Sarvam](https://www.sarvam.ai/api-pricing), [Whisper](https://developers.openai.com/api/docs/models/whisper-1), [GPT-4o](https://developers.openai.com/api/docs/models/gpt-4o)

## Actual plans and measurements
Source: shared/planCatalog.json and backend preset/credit checks.

| Plan | Price / credits | Max video | Export retention |
|---|---|---|---|
| Free | 3 lifetime starter credits | 180 s | 2 h |
| Starter | ₹299 / 15 | 180 s | 2 h |
| Creator | ₹499 / 45 | 180 s | 24 h |
| Pro | ₹799 / 120 | 180 s | 72 h |
| Annual Starter / Creator / Pro | ₹2,500/180; ₹4,500/540; ₹6,500/1,440 | tier limits | tier retention |

One successful export consumes one credit. Annual credits must not be modeled as a monthly release without implementation evidence. ₹199 top-ups give 10/15/25 credits with 1/2/4 purchases per 30 days. Starter caps at 1080p; Creator enables 4K/30; Pro 4K/60. Daily export limits are 3/5/unlimited for paid tiers.

Existing local benchmark script exercised production ASS and DOM renderers once each, CPU veryfast, Windows/Python 3.12.10/FFmpeg 8.0.1. Synthetic 720×1280 source, only three caption phrases, no provider calls. No cloud performance, memory ceiling or customer-template p95 is established.

| Representative class | Local ASS / DOM seconds | Output ASS / DOM MB | Budgeted cloud export seconds |
|---|---:|---:|---:|
| Small: 15 s, 720p/30 | 1.96 / 6.25 | 2.82 / 2.44 | 60 |
| Typical: 60 s, 1080p/30 | 13.97 / 25.75 | 29.39 / 26.34 | 120 |
| Large: 120 s, 4K/60 | 185.44 / 285.62 | 317.94 / 289.05 | 900 |

All six measured renders succeeded. Initial sandbox Chromium permission failure was an environment issue; the authorized local retry succeeded. One run is not a statistical p95 despite that field in the benchmark JSON. Full 180-second Pro clips and dense animated captions can cost more.

Artifacts: build/cost-review/small.json, typical.json, large.json.

## Comparable workload assumptions and INR result
30 days/720 hours, Mumbai target, 20% small / 70% typical / 10% large. Same workload and media/download policy for both columns. Modest: 300 successful exports from 17 paid customers (10 Starter, 5 Creator, 2 Pro), 615 available monthly credits and ₹7,083 receipts. Busy: ten times these customers, 3,000 exports, 6,150 credits, ₹70,830 receipts. Remaining credits are liabilities, not assumed to expire unused. These are scenarios, not measured demand.

Per export: one upload, one scan, one transcription; 90% Sarvam/10% Whisper, 30-second Whisper detection, 20% translated at 1,000 input + 1,000 output tokens. Ten percent compute/provider contingency covers some failures/retries; it is not a measured failure rate. No unlimited reprocessing is included.

Render allocation 4 CPU/12 GiB for 60/120/900 seconds. Scan 2 CPU/4 GiB × 60 seconds. Transcription 1 CPU/2 GiB × 60/60/120 seconds, including provider wait. Memory and timing are hypotheses requiring qualification.

Source size 20/100/500 MiB; output size 10/60/310 MiB. One source preview plus two export downloads: average 274 MiB/export. Download volume is 80.27/802.73 GiB in modest/busy months. Media accounting includes 25 GiB baseline, source 11 days and output 10 days as a conservative allowance for lifecycle lag/soft deletion; average retention is 45.64/231.45 GiB. GCS existing lifecycle age 4 and possible default soft delete can outlive the UI's 2/24/72-hour expiry. Explicitly align actual policies before launch.

Utho capacity tiers assume 50/100/500 decimal GB with peak usage fitting each tier, conditional on Mumbai service and matching durability. GCS charges actual GiB. Utho workers cost 2 × 720 × ₹6.04 = ₹8,697.60 even with no jobs. Each can drain the bounded average workload alone, but burst latency remains untested.

| Monthly component, INR before GST | Google idle | Google 300 | Google 3,000 | Utho idle | Utho 300 | Utho 3,000 |
|---|---:|---:|---:|---:|---:|---:|
| API/worker base or Jobs incl. 10% reserve | 0 | 688 | 6,881 | 8,698 | 8,698 | 8,698 |
| Retained media | 48 | 87 | 440 | 225 | 350 | 1,350 |
| Media downloads | 0 | 915 | 9,151 | 0* | 0* | 0* |
| Paid provider calls incl. reserve | 0 | 331 | 3,314 | 0 | 331 | 3,314 |
| 5 GiB images + 10 active secrets | 66 | 66 | 66 | 66 | 66 | 66 |
| API/DB/backup/operations allowance | 100 | 200 | 500 | 100 | 200 | 500 |
| **Subtotal** | **213** | **2,287** | **20,351** | **9,088 + Q** | **9,645 + Q** | **13,927 + Q** |
| **Cash budget with assumed 18% GST** | **251** | **2,698** | **24,014** | **10,724 + 1.18Q** | **11,381 + 1.18Q** | **16,434 + 1.18Q** |
| **Before-tax cost / successful export** | — | **7.62** | **6.78** | — | **32.15 + Q/300** | **4.64 + Q/3,000** |

*Utho zero egress is conditional on advertised no-overage rules being applicable. Q is the missing monthly quote for LB, failure-domain/network/IP extras and any necessary durability/backup uplift. It is not zero. GST is a uniform cash-planning assumption, not a tax invoice determination; input-tax recovery is excluded. Utho hybrid retains Firebase/Firestore and registry; it is not an all-Utho database design.*

The allowance includes request API activity, Firestore, durable-state backup, small event/queue/GCS operations and provider audio egress. It is an assumption, not an itemized verified quote or a spending cap. Logs remain below their free allowance, static hosting below daily allowance, and no SMS/email service is modeled. Domain, existing marketing hosting, support labor and migration labor are unknown additional common costs. Busy frontend traffic may exceed daily free hosting transfer; reserve it within the allowance or reprice from actual asset bytes.

Payment processing adds about ₹167 modest / ₹1,672 busy if the standard 2% fee plus GST applies (2.36% of receipts); same for both providers and separate from infrastructure. Verify actual merchant contract. [Razorpay](https://razorpay.com/solutions/e-commerce/)

The cheapest single 6-CPU VM variant reduces Utho totals by ₹4,349 before tax but sacrifices compute redundancy. A 2-CPU/16-GB candidate is ₹2,700/720 hours before extras, pending performance validation. Neither is zero-idle. Do not present either as the same reliability level.

## Unit economics and sensitivity
The modeled weighted Google variable cost is about ₹6.45/export before baseline storage/operations and tax. Approximate small/typical/large direct variable costs are ₹2.18/₹5.20/₹23.74 respectively (including scan, provider assumptions, downloads and retry reserve, excluding retained storage/fixed costs). Large exports are the risk: Pro monthly realization is only ₹6.66/credit; annual Pro is ₹4.51. Unlimited same-price 4K/60 exports can be uneconomic on this design.

Google's download line dominates compute in the busy scenario. Doubling downloads adds roughly ₹915/₹9,151; 180-second or slower renders require additional headroom. Every extra 10,000 GPT input/output tokens costs about ₹11.88 at the assumed mix of equal input/output counts. Unsuccessful or abandoned transcription sessions have cost without export-credit revenue.

At these assumptions Utho's unknown-Q busy advantage starts with only ₹6,424/month of headroom. Add Q, equivalent durability, operations effort, shared-CPU performance or GCS hybrid egress and it can disappear. Thus Utho is **not verified cheaper for current usage**. It can be cheaper for a server used all month and substantial downloads; Google is clearly preferable for the stated idle/modest-use goal.

## Real controls and safe shutdown
Budgets only warn. Proposed launch controls must be implemented and reviewed; none were deployed here:
- Fail-closed global cost ledger: reserve worst-case compute/provider/storage work before admission, with daily and monthly ceilings and a separate allowance for already-issued downloads. Reject excess work before paid calls.
- At most two active export executions and bounded scan/transcription slots globally; job task count/parallelism 1, zero automatic paid-provider retries, bounded task retries, hard per-stage timeouts and maximum attempts.
- Max API instances 2 initially, low request timeouts and capped payloads. Platform max-instance limits can briefly be exceeded and are not monetary caps. [Google limits](https://docs.cloud.google.com/run/docs/configuring/max-instances)
- Limit file bytes, duration, resolution, fps, pending bytes, upload sessions, scans and paid minutes per user AND globally. Daily provider ceilings must fail closed. Annual/top-up credit bursts must still pass admission.
- Separate 4K work budgets; initially gate 4K/60 until representative 180-second memory/time tests demonstrate margin. Do not silently remove purchased features: resolve pricing/product commitments first.
- Private objects, short-lived scoped upload/download grants, log sampling, bounded retention, restricted deployment IAM, no unreviewed resource creation. Disable unrelated paid APIs and limit regional execution quotas where available.
- Signed URLs can be replayed and range-downloaded until expiry; two downloads is a scenario assumption, not a enforceable cap. Strict byte limits need a metered download gateway or equivalent enforcement, adding cost. Otherwise reserve a conservative exposure and have an access-revocation procedure.

Data-preserving stop procedure: (1) disable paid admissions and new uploads; (2) pause dispatch and provider submission; (3) drain or explicitly cancel known executions and reconcile uncertain provider/payment outcomes; (4) checkpoint/export the credit/payment/job ledger, config, object manifest and keys safely; verify backup restore access; (5) stop compute and revoke new media grants while preserving private data; (6) inventory all regions/projects for VMs, Redis, NAT, IPs, LB, registries, volumes, snapshots, logs and subscriptions; (7) retain a priced minimum data/backup footprint and verify subsequent billing. Do not delete the database, bucket or billing account as an emergency first step.

For Utho, power-off is insufficient as a proven billing stop. After verified external backups and data separation, explicitly deprovision disposable VMs and release chargeable attachments; retain only inventoried data resources. Obtain final billing confirmation. Shutdown cannot reverse charges already incurred.

## Migration and decision gates
Google requires substantial queue/state/idempotency migration, finite job entrypoints, outbox recovery, IAM, signed uploads, malware scan lifecycle, reconciliation and cost enforcement. Existing S3 storage abstraction helps Utho, but browser resumable uploads are GCS-specific: S3 multipart signing/finalization is real work, not an environment-variable switch. A native Utho database would add schema/auth/transaction migration; the ₹2,691 entry DB price is not an HA equivalent.

Prioritize local tests of duplicate webhook/task delivery, crash-after-provider-submission, credit exactly-once effects, expired leases, cancellation, storage expiry and outbox recovery. Then measure dense-caption 180-second 4K examples under the intended CPU/memory limits. No further load test is needed to decide the idle architecture.

No paid pilot is approved or initiated. A future proposal must state a maximum cash cost, duration, precise resources/quotas, provider-call and byte caps, owner approval and cleanup verification before provisioning. Utho additionally needs a written exact checkout quote, manual-poweroff billing answer, deprovision billing boundary, storage region/durability, bandwidth policy and complete HA/network price. Until then, proceed only with the Google architecture design and local qualification—not deployment.

