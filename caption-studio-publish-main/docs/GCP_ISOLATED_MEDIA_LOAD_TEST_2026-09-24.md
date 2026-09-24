# Isolated media journey load test — 2026-09-24

## Scope and result

The staged run completed at 1, 10, 25, 50, and 100 simultaneous authenticated
journeys. The 100-journey stage finished **100/100 successfully**, with a 65.2 s
median and 77.2 s P95 from upload start through private export download. Export
queue wait was 6.1 s median and 11.0 s P95. These are measurements of the
isolated staging configuration below, not a production service-level promise.

| Simultaneous journeys | Successful | End-to-end P50 | End-to-end P95 | Maximum | Export queue wait P95 |
|---:|---:|---:|---:|---:|---:|
| 1 | 1/1 | 58.9 s | 58.9 s | 58.9 s | 1.1 s |
| 10 | 10/10 | 61.4 s | 70.4 s | 71.4 s | 30.8 s |
| 25 | 25/25 | 49.1 s | 56.1 s | 59.2 s | 8.5 s |
| 50 | 50/50 | 66.5 s | 75.8 s | 75.9 s | 12.4 s |
| 100 | 100/100 | 65.2 s | 77.2 s | 82.6 s | 11.0 s |

The final 100-journey stage measured upload P50/P95 of 15.3/21.1 s,
processing 14.8/20.5 s, queue wait 6.1/11.0 s, rendering 23.7/35.4 s,
and download 1.3/3.1 s. Per-stage timers can overlap across journeys;
their percentiles should not be added to derive end-to-end percentiles.

## Method

- Each disposable Firebase identity obtained its own App Check and Auth tokens,
  directly uploaded the same 33.2 MB, 16.8 s, 1080p H.264/AAC MOV sample to a
  private staging bucket, requested transcription, submitted an export at a
  synchronization barrier, and downloaded bytes through a signed private URL.
  The export target was 720p at 30 FPS.
- The final 100-user run used 100 client threads, two isolated `e2-standard-2`
  API replicas (50 journeys per replica), ten disposable
  `n2-custom-4-12288` render workers, a dedicated Basic Redis instance, and
  a dedicated private Cloud Storage bucket. Worker capacity was adjusted
  manually between stages. The application revision was `9d4692a7` plus the
  load runner's two-replica distribution change at `5332a2a`; all application
  changes are in this pull request.
- The 100-user stage reported zero admission retries. The download step
  requested and received bytes from the private export; it did not measure
  streaming a whole output to a browser.

## Issues found and fixed during the run

1. A lost response after GCS upload completion made the runner treat a
   completed upload as a failure. The runner now retries completion using its
   idempotent receipt.
2. Token-only GCE credentials could not locally sign private export URLs.
   The API now uses an IAM signing service account for keyless V4 signed URLs.
   A signed range request returned the expected bytes before the staged runs.
3. A synchronized 10-user attempt triggered transient Firestore `Aborted`
   contention when creating transcription jobs. Bounded idempotent retries in
   the Firestore workflow resolved it; the rerun passed 10/10.
4. A single test API VM's Uvicorn concurrency cap returned 503 at 100 clients.
   The final run used two API replicas, matching the production minimum of two.
5. Repeated aborted attempts consumed staging's shared-network upload and
   processing hourly limits. The final retry used a fresh disposable load
   generator and reset counters only in the verified isolated Redis instance
   after confirming its queues and started-job registries were empty. These
   test-only resets did not alter production limits or Redis.

## Boundaries and follow-up evidence

The same short sample was reused across accounts. Cache warmth from prior
attempts may have reduced transcription work. The test exercises authenticated
API, direct upload, queue, renderer, storage, and signed download behavior under
burst load. It does not establish unique-media transcription throughput,
500 MiB browser upload recovery, payment behavior, a browser UI journey,
cold-start autoscaling, Spot preemption, GPU economics, or visual parity across
templates and languages. Those require separate representative trials.

The test used the existing Firebase project with precisely scoped disposable
UIDs and isolated staging control collections. It did not deploy this revision
to the production API or render workers. A merge to `main` is therefore not
evidence that production is running it.

The authorized ceiling for this test was ₹1,000 across cloud and provider
charges. Temporary capacity was kept short-lived and removed after the run.
An exact charge has **not** been established: billing and transcription
provider data for the test window have not yet been reconciled. Do not assign
a cost-efficiency score or claim the ceiling was met from these timings alone.

## Teardown

The disposable API and load-generator VMs, worker MIG and templates, runtime
images, firewall rules, Redis instance, bucket and its 328 objects, staging
secret, signer service account, and temporary IAM role were deleted. An exact
UID-scoped cleanup removed the 100 disposable Auth identities and associated
Firestore records. A read-only verification found zero remaining scoped Auth
users, user documents, uploads, upload intents, staging transcription outbox
records, expiry records, and export jobs. Local token files were also deleted.
Aggregate measurements are retained in this document; per-journey result files
remain ignored from Git.
