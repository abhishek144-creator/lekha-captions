# Launch acceptance — 6 October 2026

## Verdict

**The evidence supports a controlled public launch under the approved Railway profile.** PR #37's virus-database and scan-limit fixes are merged and deployed as `63cf04f9c6f5ab34457612d4513bb78586554836`. The owner authorized the completed exact local image checks as the release verification for this PR only; hosted Actions remain unavailable at the unchanged $10 hard stop. Public release markers agree, readiness returns HTTP 200, and fresh production scanning/transcription/editing/SRT download passed. A new-release MP4 attempt was rejected by the existing Starter three-exports-per-24-hour quota before render/debit; a fresh MP4 download on this release remains unverified. The preceding release's complete MP4 journey passed and PR #37 does not change render/download source. Unrestricted mass-launch clearance is not established by these measurements. The owner explicitly excluded a fresh 100-user test.

Netlify billing was explicitly excluded by the owner. Publication succeeded, but this acceptance does not certify billing clearance or continuous hosting availability.

## Published fixes

PR [#36](https://github.com/abhishek144-creator/lekha-captions/pull/36) merged as `0c5182f3672a618a38a4d5bbef4847a80e9e6d72`. Its tree matches tested head `61c05e5a385ba9948952cf8ae686258572d7683d`; all 13 hosted gates passed, including the five export scopes, both final images and browser quality.

- Restored ordinary-reload access to the saved editor draft, added draft backup download and authenticated account-draft recovery, and retained owner isolation and revision-conflict checks.
- Reproduced and fixed a real worker failure before credit commit: RQ retried successfully while the application remained stuck in `processing`. Worker and cron retry recovery now conditionally reconcile the application state while preserving terminal states and paid-result recovery.
- Updated compatible `source-map-js` and `@grpc/grpc-js` dependency versions, removed the two obsolete gRPC audit exceptions, and passed the reviewed security gate. The existing build-only, unpatched `braces` exception remains; a passing policy gate is not a zero-finding raw audit.
- Published both existing Netlify sites and all four Railway app services at the same release. The public editor is `https://lekhacaptions.com/Dashboard`.

The pre-existing local `ExportPanel.jsx` edit that removes the review UI was preserved and excluded from the release.

## Actual production journey

A fresh authenticated upload on release `0c5182f` completed real transcription, manual caption correction, Mountains LC T167 template application, account save, ordinary reload, saved-draft restoration, 1080p export and local download. This is the preceding release's complete journey, not a new MP4 check on `63cf04f`.

- Export job: `d4f8bb1e-6bde-419f-901b-c0b3ae429360`.
- Valid downloaded MP4: H.264 1080×1920, AAC, 8.192 seconds, 1,563,529 bytes. Corrected captions were visible in the decoded frame.
- Credits: 12 → 11. Reconnecting to the existing receipt and downloading again left 11; no replacement render or second charge was submitted after the browser-control timeout.
- Earlier production acceptance also downloaded an existing paid export after reload without another debit.

Evidence: `production-final-journey-20261006.json`, `public-release-acceptance-20261006.json`, `production-recovery-buttons-20261006.png`, `production-final-export-20261006.png`, and `production-final-export-frame-20261006.png` in the outer workspace's `.readiness/` directory.

## B4 measurements

### CPU comparison

One warmup and five measured renders per path per completed configuration. Identical SHA-256 fixture, 60 seconds, 1080p, 30 FPS, 8 GiB configured RAM, Node 22.23.3, FFmpeg 5.1.9 and the same renderer/benchmark source. The 8-CPU run used release `6d5dccd`; the completed 4-CPU run used `0c5182f`. Git comparison confirmed identical renderer and fixture-generator source between them.

| Path | 4 vCPU median / P95 | 8 vCPU median / P95 | Median speedup |
|---|---:|---:|---:|
| ASS | 20.866 / 22.754 s | 8.985 / 9.227 s | 2.32× |
| DOM | 33.188 / 34.554 s | 15.646 / 16.127 s | 2.12× |

All measured runs in the completed comparison succeeded. The original 4-CPU attempt was interrupted by Railway sleep and is retained as incomplete evidence. The owner approved 12 additional staging renders; the conservative benchmark reservation total was 36.

Production retains the approved 8-vCPU render size. The DOM fixture is a bounded text box, not a representative authored animation. Work ratios remain conservative and unchanged; these timings do not justify reducing admission cost for every template.

### Authenticated bursts and Hindi

| Run | Actual result | End-to-end median / P95 |
|---|---|---:|
| English pilot, 2 clients | 10/10 | 52.117 / 97.812 s |
| Synchronized English, 10 clients | 10/10 | 169.383 / 182.516 s |
| Resumed synchronized export burst, 100 clients | 100 exports produced; 85 downloaded initially; all 15 remaining downloads recovered | 196.109 / 446.656 s for original burst, including failed download waits |
| Hindi, 2 clients | 10/10, real Devanagari transcription and downloads | 70.274 / 115.985 s |

The original 100-client attempt aborted its barrier after upload/signing transport errors and one process-poll timeout, before any export was admitted. The resumed run reused 98 accepted uploads and completed two replacement uploads; it is an export burst, not a fresh 100-client upload-to-download success. Admission retries were 62. Export stage median/P95 was 116.469/246.609 seconds, including render queue wait; queue-wait median/P95 was 64.265/106.876 seconds.

The 15 initial R2 read timeouts recovered on their first follow-up using five download clients and the existing job IDs, with zero new renders. The evidence does not isolate client/network versus storage causes; first-pass download success remains 85% in that stress run.

The 100 files had distinct file hashes and the same decoded synthetic speech/video. This prevents file-hash reuse while bounding the fixture, but does not establish capacity for 100 naturally different clips. Hindi used three licensed Google FLEURS CC BY 4.0 utterances, concatenated and silence-padded to 60 seconds; the test establishes functional processing, not a transcription accuracy score.

Actual resize observations reached five render and five transcription replicas, and at most five normal active render jobs. Both returned to one before the final comparison. Jobs completed across worker deployment replacement. The API's recorded cgroup peak during the 100 phase was 544,878,592 bytes with no OOM events; diagnostic imports add overhead and this is not the worst-case inline fallback-scanner measurement.

Evidence: `b4-4cpu-result.json`, `b4-8cpu-result.json`, `b4-10concurrent-20261006.json`, `b4-100concurrent-20261006.json`, `b4-100resumed-20261006.json`, `b4-download-recovery-20261006.json`, `b4-hindi-acceptance-20261006.json`, `b4-hindi-transcript-proof-20261006.json` and saved control-plane/queue observations.

## Worker recovery and sleep

On immutable release `0c5182f`, staging injected an actual process SIGKILL before credit commit and another immediately after the transactional debit. Both RQ jobs retried once, finished, reconciled to application `completed`, and retained a successful paid result. Two exports consumed exactly two credits (5 → 3). Earlier reproduced failures and the failed test-injection attempts are retained separately and are not counted as successful crash tests.

Final-release production API, render and transcription were observed `SLEEPING` at 12:04 UTC (17:34 IST), with one configured replica each and effective worker drain grace of 1,860 seconds. The final staging sleep observation was not captured before automatic cleanup during chat inactivity. Production's actual final-release idle observation and the earlier finite staging resize/drain observations are the acceptance evidence; no missing observation is invented.

Redis remains always on, and the existing 15-minute cron runs and exits. This is not zero total idle cost.

## Approved operating profile and rollback

Existing project `073ba0e0-3fb7-4aec-89eb-36d97c2f2074`, production environment `442a4640-ee00-4518-91f5-0a8a7c42a83a` only. No new permanent service, region, volume, token or credential.

- Render: 8 vCPU / 8 GiB configured, baseline one, ceiling five.
- Transcription: 2 vCPU / 3 GiB configured, baseline one, ceiling five.
- API: 2 vCPU / 2 GiB, two Uvicorn processes; cron: 1 vCPU / 1 GiB.
- Sleep remains enabled. Worker shutdown grace remains 1,860 seconds.
- Controller flags enabled after actual acceptance; worker admission maximum five; API/cron pending-work budget 3,000 seconds.
- Railway hard cap $25 and alert $10 retained. The previously reviewed peak compute estimate is about $2.3/hour before Redis, egress, AI/provider, database/storage and tax. These other charges are outside the Railway cap. The cap is not a monthly availability guarantee.
- Rollback: disable both controller flags in API/cron, stop scale-up, preserve queued jobs/media/payment records, and reduce to one only after existing jobs and drains finish. Do not delete customer data or close billing as rollback.

The shared IaC safety flag remains off for fresh environments. Production uses the recorded acceptance override. A future IaC plan must review that override so it does not silently reset the controllers, pending capacity or worker admission limit; no unreviewed global apply was performed.

## Cleanup and cost evidence

Automatic staging expiry began cleanup at 09:39 UTC (15:09 IST) and completed at 09:46 UTC (15:16 IST). Independent read-only verification at 12:05 UTC confirmed:

- Temporary account-scope SSH key absent and private key removed.
- Isolated staging environment and its scaling token absent; production preserved.
- All 100 disposable Firebase accounts and user documents absent.
- Owned uploads, exports and render-cache prefixes empty; private test credential files removed.
- Cleanup removed 395 owned media objects and 1,320 owned documents. Shared project services and the existing volume were preserved.

The conservative ledger reserved 161 journeys and 36 benchmark renders. Latest reported combined Railway usage at the independent check was $0.56427. Reporting is delayed and combines existing production and staging; this is not a separately reconciled final test bill. No budget, cap or notification preference was increased. No new monitor or recurring automation was created.

## Remaining limits on the verdict

The approved finite tests resolved the identified functional blockers and establish controlled operation. They do not establish all of the following:

- Unrestricted sustained demand, a fresh 100-user upload burst with clean first-pass downloads, or naturally diverse maximum-length/maximum-size videos and all authored templates.
- A paired representative authored-animation 4/8-CPU benchmark, real mobile maximum-size downloads, or worst-case API inline scanner peak memory.
- A settled daily SKU bill or Netlify billing clearance.

These are concrete limits of the evidence, not claims that the passing journeys failed. Keep the current plan/video-size/rate/queue caps and conservative workload ratios, and expand traffic gradually within the approved spending cap.

## Final operational readback

At 12:15 UTC (17:45 IST), all four replacement production deployments reported `SUCCESS` on `0c5182f`, with one configured replica each. Readback confirmed both controller flags enabled, ceilings five, worker admission maximum five, and API/cron pending-work budget 3,000 seconds. At 12:23 UTC (17:53 IST), both worker deployments reported `SLEEPING`. Public frontend and API release markers agreed and readiness returned HTTP 200 after the profile activation. The $25/$10 cap/alert remained unchanged; reported combined Railway usage was $0.56705.

Final log inspection also found the ClamAV daily database was over seven days old. The official image aliases were both last updated September 28 and had the same digest; an unchanged redeploy cannot refresh that bundle. [ClamAV documents image database staleness and FreshClam updates](https://docs.clamav.net/manual/Installing/Docker.html).

[PR #37](https://github.com/abhishek144-creator/lekha-captions/pull/37), current head `47747752e0c71afb4257804476014741d65c160b`, adds one bounded build-time incremental update, CVD/CLD support, a seven-day freshness gate and actual final-image clean-file scans. It adds no updater daemon or recurring traffic.

Follow-up inspection found that the existing 600 MiB stream limit did not change ClamAV's default 100 MiB engine file limit. Both scan paths now use a 500 MiB file limit and bounded 600 MiB expanded scan allowance. Incomplete limit verdicts raise scanner-unavailable rather than accepting the upload as clean or mislabeling it as confirmed malware. [ClamAV documents these limits and alerts](https://raw.githubusercontent.com/Cisco-Talos/clamav/main/etc/clamd.conf.sample). Both exact PR #37 final Linux images now pass the real clean 500 MiB fixture, harmless EICAR detection through CLI and daemon, and deliberately exceeded limits. These local checks used API 2 GiB/transcription 3 GiB memory limits, swap disabled, network disabled and Linux disk-backed temporary files. Hosted jobs remain billing-blocked.

Twenty focused scanner/freshness tests passed both locally and inside each final Linux image; the full local backend suite passed 432 tests and 40 subtests. Its first run had one Windows localhost connection-abort (431 passed), followed by all three wake-endpoint tests and a complete unchanged-suite pass. Bandit reported zero Medium/High findings; Python compilation and diff whitespace passed. The exact image evidence is saved in `pr37-local-api-20261006.json`, `pr37-local-transcription-20261006.json` and `pr37-local-verification-20261006.json`; these are local results and no hosted check was marked successful manually.

A later local verification attempt found an existing Ubuntu 24.04 WSL installation. The first disk-backed Docker attempt failed with filesystem I/O/startup errors while C: had under 1 GB free; its temporary directory was subsequently confirmed absent. A private Docker 29.8.2 runtime in a task-owned 6 GiB RAM filesystem then built both images from a clean archive of `4774775`. The first archive applied Windows CRLF conversion to the Linux config; re-exporting with `git -c core.autocrlf=false archive` preserved the committed LF bytes and resolved clamd startup. RAM-backed 500 MiB fixture/stream files then produced an artificial 2 GiB OOM; moving temporary data onto Linux ext4 disks resolved it. A direct Windows-mounted EICAR fixture failed access, with antivirus interference suspected but unverified; no antivirus setting was changed. The final exact image checks all passed. FreshClam's incremental update and vendor database-load check passed, and daily database version 28145 was under eight hours old. Stopped the owned daemon and verified the runtime and D: temporary disks/directory absent; redundant task-created source archives were removed after recording their hashes. No customer file, other distribution, VHD, permanent service or firewall setting was reset or deleted.

GitHub's PR #37 annotations rejected every job before execution because of account billing/spending limits. The updated head's workflow `37468525687` has zero executed steps in all 13 jobs and the same billing rejection. Authenticated budget readback confirmed **$10.00 spent / $10.00 budget**, with Stop usage enabled. The owner explicitly chose to retain $10 and restore availability themselves; no increase is authorized. Git pushes remain available. The earlier approval request to substitute completed exact local image verification for PR #37 only was subsequently accepted by the owner's “do it”; the rollout below records that scope. No hosted check was manually marked successful or disabled.

The owner subsequently declined a fresh 100-user upload-to-download test; it is removed from the requested launch work. Its absence remains a limit of the available capacity evidence, not an outstanding requested task. The earlier paid staging phase expired and was cleaned up. A revised optional follow-up plan for varied/max-size media, sustained downloads and an authored-animation benchmark is in `LAUNCH_FOLLOWUP_PLAN_2026-10-06.md`. It proposes a new two-hour admission window plus 30-minute drain, at most 20 journeys and 12 benchmark renders, up to $4 Railway usage within the unchanged $25 cap and up to $6 separately metered AI/storage/database usage. This proposal is not authorization and no new staging resource has been created.

Evidence: `production-launch-activation-20261006.json`, `production-scaling-preflight-20261006.json`, `production-profile-idle-20261006.json`, `production-final-runtime-20261006.json`, `pr37-current-gates-20261006.json`, and `github-actions-budget-exhausted-20261006.png`.

## Approved scanner rollout and new production acceptance — 6 October, 20:20 IST

- PR #37 merged verified head `47747752e0c71afb4257804476014741d65c160b` as `63cf04f9c6f5ab34457612d4513bb78586554836`. Both trees are `ee86ca2c5ceb01291b3d13f8005d97ebf01df05a`. All four existing Railway app deployments reported `SUCCESS`; Redis was preserved. Both existing Netlify sites published the clean committed frontend and retained their deployment locks. Dirty shared frontend edits were excluded.
- Production API/transcription build logs passed FreshClam database loading and the seven-day freshness gate. Daily database version 28145 contained 355,726 signatures and was under eight hours old. The running transcription daemon reported 524,288,000-byte file and 629,145,600-byte global scan limits. No runtime updater or recurring update traffic was added.
- At 20:09:47 IST, both public frontend release markers and `/api/version` returned HTTP 200 with `63cf04f`; `/api/health/readiness` returned HTTP 200 and `ready: true`. Existing CPU/RAM, sleep settings, 1,860-second worker drain, controller flags, five-worker ceilings, API/cron pending-work budget and $25/$10 Railway cap/alert were preserved. Reported combined usage was approximately $0.5867, subject to billing lag. Sleep on the new release was not separately observed after this smoke check.
- One rights-owned 8.192-second production video passed actual media scanning in 16.688 seconds through the verified clamscan fallback during cold clamd startup, and produced four real transcription lines. Corrected the first caption to “This is a Lekha Captions deployment test.” and inspected its preview. Downloaded a 275-byte SRT containing the correction. Existing projects were not overwritten; the original browser draft was backed up to `C:\Users\ADMIN\Downloads\lekha-caption-draft (1).json`.
- One 1080p MP4 request, job `bed9a0e7-a4b7-44a0-a555-60f9650bc8e6`, was rejected by the existing Starter three-per-rolling-24-hour quota (HTTP 429) before rendering/debit. Credits stayed 10→10. No second submission, quota override or fresh 100-user test was made. The UI displayed a generic export error instead of the quota explanation; this remains a known usability limitation. A pre-existing pending brand-kit sync notice was preserved without overwriting preferences. SRT download does not establish MP4 download.
- The scanner deployment blocker is resolved. Controlled launch is supported by this scanner acceptance plus the earlier complete functional/recovery evidence, within the documented operating and capacity limits. The optional varied/max-size and sustained-download plan remains unapproved. Netlify billing remains excluded.
- Artifact hashes for 84 frontend files and the source archive were retained. The separate temporary frontend build at `D:\lekha-pr37-frontend-20261006` remains: automatic approval review could not authorize its deletion after reaching its usage limit. The cleanup command did not execute. Its node_modules junction targets the preserved shared dependencies; remove only the junction before deleting the owned directory when approval review is available. This is local cleanup, not an outstanding cloud resource. The earlier temporary Docker daemon/runtime/disks and staging credentials were already cleaned.

Evidence in the outer `.readiness/` directory: `pr37-rollout-approval-20261006.json`, `pr37-merge-evidence-20261006.json`, `production-pr37-scanner-evidence-20261006.json`, `production-pr37-public-acceptance-20261006.json`, `frontend-pr37-drafts-20261006.json`, `frontend-pr37-artifact-manifest-20261006.json`, `production-pr37-browser-acceptance-20261006.json` and `production-pr37-editor-20261006.png`.
