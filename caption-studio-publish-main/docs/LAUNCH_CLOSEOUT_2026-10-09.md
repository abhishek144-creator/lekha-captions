# Launch closeout — 2026-10-09

## Verified production identity

At 13:23 UTC, release `4cd7453c6572faa5f1928afa084513e63ac7fe32` was rebuilt on
the four existing Railway application services and published to the two existing
Netlify sites. Each artifact uses `git-4cd7453c6572` and coordinated build-batch
time `2026-10-09T13:06:45Z`. The strict deployed verifier passed from inside the
private network, including both worker HTTP identities and API readiness.
Temporary verification access was revoked and its local key material removed.

The owner explicitly approved completed local verification for this release
only. GitHub Actions remains unable to start at its $12 hard stop; no hosted
pass is claimed. Railway remains at its $25 hard cap/$10 alert, accepted CPU/RAM,
sleep/drain settings and five-worker ceilings. No resource was added.

## Acceptance findings and recovery fix

A rights-owned 8.192-second fixture completed upload and English original-track
transcription. Captions were corrected, Mountains T167 was applied, a text layer
was added, and explicit cloud Save displayed success. Browser backups preserve
the test drafts and the owner's preceding draft.

Fresh account-only recovery exposed two defects:

- The default backend lookup limited an unordered project query to one record
  before sorting, selecting an older project. The fix sorts the bounded account
  collection before choosing the most recently saved project.
- Account storage correctly removes bearer media URLs, but the restore button
  did not obtain a replacement. The fix requests a fresh URL through the
  existing authenticated ownership-checked media endpoint. Missing/expired
  media retains editable captions and the existing relink flow; changing
  accounts during refresh cancels restoration into the new account.

Verification of the prepared fix: the new lookup regression fails on old code;
476 backend tests and 40 subtests pass after integrating the already merged
client-disconnect fix from PR #58. Frontend validation passes
74 unit tests, contracts, lint, typecheck and guarded build; all 342 release
checks pass. The real local editor journey covers account-only recovery, fresh
authenticated source URL, no new save on read, expired-source relink, revision
conflicts, delayed-response account isolation, text removal/undo, upload resume
and checkout. The media fixture's
stored duration matches the actual source so a metadata correction is not
mistaken for an unwanted recovery write.

The fix still needs an approved immutable rollout and final production
save/account-recovery/MP4 download acceptance. It is not included in `4cd7453`.

## Remaining external gates

- Physical-phone drag/swipe/scrubbing/download: owner acknowledged the request;
  no device/browser outcome has been reported. Local responsive checks do not
  substitute for this result.
- Transcript-cache TTL: both checked-in cache collections currently have no
  deployed TTL. The owner completed an existing administrator gcloud sign-in;
  its field-management permissions are verified. Google rejects TTL creation
  because billing is disabled for `captionstudio-9dfde`. Billing was not
  reenabled. All four checked-in `expire_at`/`payload` index exemptions were
  accepted separately; their operations are still initializing. Application
  reads already reject expired entries; automatic database cleanup is not yet
  established.
- International card activation was submitted and is under provider review.
  A real international checkout with correct plan/credit grant remains pending
  provider enablement and an owner-completed transaction.
- Hosted CI funding/availability remains unresolved. The explicit local-check
  exception is scoped to its approved release and is not a future CI waiver.

Unrestricted mass-launch capacity is still unestablished. The owner-declined
fresh 100-user test was not repeated. Existing finite capacity/recovery evidence
and its limits remain in `LAUNCH_ACCEPTANCE_2026-10-06.md`.

## Concurrent session state

PR #59 contains the recovery fix and PR #58's merged client-disconnect change.
At 14:32 UTC, Railway had automatically advanced its four services to main
`0985810`, while Netlify retained the verified `4cd7453` frontend. This is not
a newly verified coordinated release. Additional uncommitted transcription and
processing-screen edits in the shared checkout belong to ongoing work and were
preserved; they are not represented as pushed or deployed.
