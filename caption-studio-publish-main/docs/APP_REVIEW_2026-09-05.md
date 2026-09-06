# Lekha Captions — phase 2 production hardening

**Follow-up:** [The coordinated release record](RELEASE_2026-09-06.md) supersedes the local-only draft and API-bound transcription findings below. This audit is retained as the pre-release baseline; subsequent deployment evidence is separate from independent launch/enterprise sign-offs.

Reviewed 5–6 September 2026. This assessment covers the current working tree, local verification and read-only deployed checks. No deployment, production-data mutation, paid provider call, independent pentest or fresh cloud restore was performed. The original review is preserved below and in [the phase 1 record](APP_REVIEW_PHASE1_2026-09-05.md).

## 1. Executive summary

Upload, concurrency, payment, deletion and release boundaries are materially stronger. The changes are ready for code review and staging validation; they do **not** establish production readiness. The live editor/API versions still differ and all five prior launch sign-offs remain pending.

The largest remaining engineering gaps are API-bound transcription without durable recovery, browser-local caption drafts, and missing current infrastructure evidence for worker/Redis failure, decoder isolation and restore. Direct uploads and Auto-direct have staged designs, without an unnecessary architecture rewrite. No confirmed P0 exploit was established.

## 2. Previous blockers

| Previous item | Status | Evidence / remaining work |
|---|---|---|
| Cancelled work restarting | Completed and retained | AbortError/retry/proxy regression checks pass |
| Late fonts moving dragged words | Completed and retained | Renderer v46, font settlement and delayed-font negative control pass |
| Startup killing unrelated processes | Completed and retained | Startup only manages its own children |
| Release consistency | Partially completed; blocker | Shared manifests and worker identity added; live mismatch remains |
| Independent review | Unresolved; blocker | Internal/AI review is not independent pentest acceptance |
| Canonical marketing | Unresolved; blocker | Local static build passes; deployed canonical approval/manifest pending |
| Monitoring/status | Partially documented; blocker | Hooks/profile exist; independent journey/DNS/status acceptance pending |
| Real-device accessibility | Unresolved; blocker | Browser emulation passes; physical/screen-reader acceptance pending |
| Enterprise governance | Future work | Customer-required SSO/provisioning, contractual SLA and assurance are separate from basic public launch |

Live verification expected editor SHA `5f8923c562a614b6797b9dde8ff540d7c7a5f874` but received API SHA `b2a475a2383c51c075352b14691c1efff01b1099`. Editor/marketing manifests are unavailable; API build time is missing/invalid. Worker verification requires private operator origins. These are observations of existing deployments, not the new code being deployed.

## 3. New issues found

| ID / priority | Root cause and impact | Resolution / remaining limit |
|---|---|---|
| RC-01 P1 | Rate count and insert raced, permitting excess admission | Atomic Redis Lua; 32 concurrent calls admit the configured five |
| RC-02 P1 | Independent job writes allowed stale state, cancellation/start races and duplicate execution | Explicit transitions, compare-and-set revisions, worker claim and immutable terminals; Redis-loss recovery remains separate |
| RC-03 P1 | Export receipts could be overwritten or registered after fast completion | Atomic NX claim and pre-enqueue queued receipt; no cross-store transactional outbox yet |
| RC-04 P1 | Auth/body checks happened after multipart parsing | Pre-parser auth/account lease, declared and streamed caps, magic-byte/probe/duration/dimension checks |
| RC-05 P1 | Inconsistent subprocess timeout/protocol boundaries | Shared argv-only media wrapper, file/pipe inputs, probe/render deadlines and Node timeout; kernel/descendant isolation still unverified |
| RC-06 P1 | Refund before payment receipt could be acknowledged without applying; old order could replace newer plan | Retryable missing-receipt refund and verified order timestamp watermark; legacy ordering requires reconciliation |
| RC-07 P1 | Delayed work could recreate deleted account/media/payment state | Durable UID deletion fence, transactional bootstrap/payment checks, active-work drain and app signed-media denial |
| RC-08 P1 open | Transcription lives in API coroutine/executor without durable intent/reconciliation | Staged durable job/outbox plan; API death can leave an uncertain paid-provider outcome |
| RC-09 P1 open | Save/autosave/restore use browser localStorage, not cloud caption revisions | Limitation disclosed and durable project design recorded; browser/device loss can lose edits |
| RC-10 P2 | Public support pages waited indefinitely for auth | Public-route allowlist and five-browser auth-outage regression |
| RC-11 P2 | Readiness missed worker version/drain state and probed Firebase even when media used S3 | Worker heartbeat identity, draining/heartbeat readiness, liveness separation and selected storage probe |
| RC-12 P2 | Unstructured unexpected errors and customer style logging | Generic correlated 500, readable client message field, release log labels and removed full style dump |
| RC-13 P2 | Load smoke used protected routes and accepted errors | Public probes, non-2xx failure, throughput/p50/p95/p99; still not a media benchmark |
| RC-14 P2 | Independent component identity and CI lanes lacked aggregate gating | Public manifests, worker metadata, aggregate CI gate, deploy verifier and safer container context |
| RC-15 P2 | Login recorded obsolete policy versions | Consent matches displayed terms/privacy; factual draft/deletion disclosure added |
| RC-16 P2 open | Crash cleanup/process-tree containment and dependency outage latency lack real evidence | Direct-process deadlines improved; Linux cgroup/PID/disk and worker janitor drills remain |

No protocol allowlist makes arbitrary media safe. Local-file decoder risk remains. Chromium's platform no-sandbox configuration needs restricted worker/network/filesystem deployment and independent review.

## 4. Code changes made

`backend/job_state.py` defines legal transitions and Redis revision CAS, preserving empty JSON arrays. `main.py` adds atomic rate/receipt admission, cancellation/claim/reconciliation, upload prechecks, payment ordering, deletion fencing and release/error contracts. `media_commands.py`, `request_limits.py` and `processor.py` bound untrusted media execution and request bytes.

`worker.py`, `media_storage.py` and `firebase_admin_setup.py` add real heartbeat/drain readiness, graceful shutdown even if Redis writes fail, correct storage-backend diagnostics and bounded health connections. RQ's blocking dequeue uses a separate connection from short health probes.

The shared release helper, Vite/Next manifests and deploy verifier expose only component/SHA/version/time/environment. CI discovers all backend tests, includes FFmpeg/test-only fakeredis and aggregates six release lanes. Docker context excludes local environment/assistant/test artifacts. Hosted branch protection is still external.

Frontend changes keep public support available, preserve cancellation handling and clarify privacy/consent. No pricing or template design changed. Added [release procedure](RELEASE_CANDIDATE.md), [architecture/direct upload plan](PHASE2_ARCHITECTURE.md), [recovery/restore runbook](PHASE2_RECOVERY_RUNBOOK.md) and [Auto-direct plan](AUTO_DIRECT_PHASE2.md). Existing operational sign-offs were not checked off by this audit.

## 5. Test results

Local logs are retained under `.codex-logs/phase2/` and ignored by Git. Builds use CI placeholders and **must not be published**.

| Check | Result / scope |
|---|---|
| Backend | 138 unit/contract/boundary tests passed: baseline 105 + 33 regressions |
| Public browser/accessibility | 60 passed across Chromium, Firefox, WebKit and two mobile profiles; serious/critical axe, overflow, identity and auth outage |
| Export parity | 330 passed: 47 high-risk phases, 80 left, 123 right phases, 60 basic, 20 scaled |
| Static/playback | Motion/visual checks passed; LC covers 60 templates, 310 lines/phases, 2,170 duration variants |
| Release/frontend | 213 release contracts, XSS, frontend contracts, delayed-font negative control, dragged-word parity, cancellation recovery, ten metadata assertions, lint, typecheck, build and performance budgets passed |
| Marketing | Next static build passed with CI legal settings |
| Real media | FFprobe malformed/network-playlist rejection, real infinite-FFmpeg timeout, actual processor burn to valid 720×1,280 H.264 output passed |
| Security scans | npm gate: zero advisory exceptions/no unreviewed high or critical; locked Python audit: no known vulnerabilities; Bandit: zero medium/high, 41 low, two narrow suppressions |
| Privacy scan | 101 revisions, zero current/historical findings under approved visibility; not universal secret-detection proof |
| Operational profile | Recorded objectives/thresholds/ownership/evidence validation passed; no fresh live drill |
| Launch evidence | FAILED: all five pending sign-offs remain |
| Deployed verification | FAILED: SHA mismatch, missing manifests/time and private worker verification |
| Clean release | NOT SATISFIED: candidate and unrelated prior work remain uncommitted; no release tagged/published |

An implementation iteration corrected a new test's locator: the changelog title is outside `main`. It now checks the page title and visible main content. An earlier run had WebKit retries; a subsequent full 60-check run passed with two workers. The media body cap and JSON-array tests also caught boundary defects during implementation.

Concurrency tests execute Lua via fakeredis, including 32-way admission, receipt contention, repeated start/cancel races and actual duplicate worker entry. Payment/usage tests use controlled in-memory transaction semantics, **not live Firestore contention**. The local machine has no Docker; the updated CI container lane was not run here. Real multi-process RQ/Redis loss, container SIGKILL/cgroups, scanner failures, cloud IAM, live payment permutations, provider faults, restore/failover and physical devices are **REQUIRES EXTERNAL VERIFICATION**. Optional export scopes beyond the prescribed 330-case matrix were not all rerun.

## 6. Security verdict

Review covered all 40 registered route decorators in `backend/main.py`, including aliases. Sensitive groups derive identity server-side, check resource ownership and enforce account/tenant policies. Billing uses fetched provider order/payment context and signatures. Development bypasses remain explicit and guarded from production.

Regression coverage includes cross-user job status/result/cancel/replay, upload ownership, file deletion, account export, signed-media deletion denial and payment/credit boundaries. No cloud project/caption API exists to test: editor drafts are local and owner-tagged. Signed downloads are bearer capabilities; an issued direct object-store URL is not instantly revoked by an app deletion fence. Underlying deletion/expiry must succeed.

Rules are restrictive in source; actual Firebase/S3 IAM, secrets, App Check, network egress, scanner health, backups and log retention are unverified for this release. Removing full style logs is not proof every historical/provider error is redacted. Independent pentest acceptance remains outstanding.

Deletion fencing retains a UID record without automatic expiry. Both privacy pages and the inventory disclose it; authenticated account export includes it while identity exists. Retention approval, backup resurrection prevention and accounting retention conflicts require owner review. These factual product disclosures are not a legal compliance sign-off.

## 7. Reliability verdict

Start versus cancellation has one winner; terminals cannot resurrect; duplicate workers avoid rendering; dead RQ work becomes a visible failure during authorized polling. Usage/payment receipts and subscription ordering are safer. Redis, Firestore, RQ, storage and provider side effects still do not form one transaction. Poll reconciliation is not a durable outbox or Redis-loss recovery service.

API transcription cannot reliably resume after process death. Drafts remain local. Multi-replica scratch cleanup, cloud deletion and crash recovery require fresh evidence. Railway's 120-second deployment drain is shorter than the 1,800-second RQ timeout; operators must pause/drain or maintain sufficient overlap. The rollback procedure accounts for old code not enforcing new deletion fences.

## 8. Scalability verdict

High-traffic launch is unsupported by current evidence. First bottlenecks: Chromium/FFmpeg CPU-memory-frame-disk pressure; 500 MiB uploads through API connections/scratch; API-bound provider work plus shared Redis/database coordination. Replica counts in a profile are not measured media throughput.

Keep one active render per worker initially, enforce admission budgets and use oldest queue age plus resource metrics. Test realistic long multilingual media before exceeding approved capacity. The corrected lightweight HTTP probe is not a render load test.

## 9. Cloud architecture recommendation

**Choose A for the planned Google Cloud launch: Firebase Hosting + separate Compute Engine API/export workers + private Redis/object storage.** It fits current long jobs and scratch behavior with fewer application changes. VM patching, drain, quotas and monitoring remain operator responsibilities.

B, Cloud Run, should follow direct resumable uploads and durable async work. Its documented 32 MiB HTTP/1 request limit and memory-consuming writable filesystem conflict with treating the current 500 MiB proxy/render scratch as a drop-in move. [Cloud Run quotas](https://docs.cloud.google.com/run/quotas), [container contract](https://docs.cloud.google.com/run/docs/container-contract).

C, retaining Netlify/Railway, minimizes immediate migration but needs the same consistency/recovery gates. A hosting move is not evidence of safety. Detailed staged upload authorization, immutable object validation, quarantine, quota and cleanup design is in [the architecture plan](PHASE2_ARCHITECTURE.md). No cloud resources or price commitments were made.

## 10. Auto-direct verdict

**Prototype after launch blockers.** Use a strict provider-neutral schema over canonical caption/word/template IDs; reject executable content, URLs, CSS/commands, unsupported fields and stale revisions. Bound cost/time/retry; require preview/apply and preserve manual fallback. No provider integration or quality/cost benchmark was performed. See [the plan](AUTO_DIRECT_PHASE2.md).

## 11. Public launch checklist

- [x] Preserve/test previous fixes; harden admission, transitions, upload, payments and deletion.
- [x] Add identity/readiness/CI gates and document release/rollback/recovery/direct upload.
- [ ] Review/commit exact candidate; build real production artifacts; require all CI lanes through hosted branch protection.
- [ ] Stage matching components and verify tokens/App Check/storage/scanner/config plus a test-account upload/transcribe/export/download/payment journey.
- [ ] Pass kill/restart/Redis/provider/scanner/disk-pressure, transaction/deletion races and restore drills on this release.
- [ ] Resolve durable transcription recovery; implement cloud caption revisions or explicitly constrain beta with accepted local-draft limitations. Approve paid-product save guarantees.
- [ ] Complete independent pentest, exact deployed/config record, canonical marketing, independent monitoring/status and physical-device acceptance.
- [ ] Approve deletion-fence/backup/payment retention and record actual media storage provider/location.

Device acceptance must cover real iPhone Safari, Android Chrome and desktop Chrome/Firefox/Safari/Edge; keyboard-only editing, screen-reader focus/names/errors, reduced motion, zoom, interruption, drag alternatives, timeline, checkout and download. Include English, supported Indic and RTL/mixed scripts. Public-page axe checks do not cover the authenticated editor or physical assistive technology.

## 12. Enterprise readiness checklist

Separate from basic public launch: organization membership/roles and adversarial lifecycle testing; customer-required SAML/SCIM; auditable support access and customer logs; approved DPA/subprocessors/residency/retention; independent review cadence; measured SLA/on-call/DR; procurement questionnaires; key lifecycle and incident exercises. SOC 2 is an assurance program, not a code checkbox. None is declared complete here.

## 13. Final scores

Scores reflect evidence for this candidate. Each score below 8 states the limiting factor.

| Area | /10 | Basis / limitation |
|---|---:|---|
| Architecture | 7 | API-bound transcription, local drafts and proxy uploads |
| Backend | 8 | Stronger tested boundaries; large central module remains |
| Frontend | 8 | Browser/export coverage; authenticated device acceptance pending |
| Security | 7 | Independent review, cloud IAM and decoder isolation pending |
| Authorization | 8 | Server ownership/token checks and regressions |
| Payments | 7 | Real provider/legacy ordering and contention evidence pending |
| File security | 7 | Byte/probe/scanner guards; malicious corpus/live scanner drills pending |
| FFmpeg safety | 7 | argv/protocol/time bounds; process-tree/cgroup containment unverified |
| Background jobs | 7 | Atomic exports; transcription/outbox/Redis-loss recovery incomplete |
| Reliability | 6 | Crash recovery, durable drafts and fresh restore unestablished |
| Scalability | 6 | Real long-video capacity evidence insufficient |
| Performance | 7 | Frontend budgets pass; backend media p95/p99 unmeasured |
| Testing | 8 | Broad regressions and real media smoke with explicit limits |
| Observability | 6 | Independent journey/status and current alert delivery pending |
| DevOps | 7 | Identity/gates improved; live mismatch and unrehearsed rollout |
| Disaster recovery | 5 | Written/historical objectives; no fresh restore/failover proof |
| Privacy | 7 | Deletion/ownership improved; retention/backups/IAM approval pending |
| Maintainability | 6 | Large main/processor, split frontend versions |
| Public launch readiness | 5 | Five sign-offs and staged failure-boundary evidence missing |
| Enterprise readiness | 4 | Identity/governance/contracts/assurance future work |

## 14. Final verdict

These verdicts apply to promoting this new working tree, not to revoking any historical private-beta approval.

**Private Beta:** NOT READY

Blockers: reviewed committed candidate, staged smoke/config for new state/payment/deletion behavior, matching component identities and safe drain/rollback proof. A later controlled beta can explicitly accept local-draft/interrupted-transcription limits after those gates.

**Public Beta:** NOT READY

Blockers: private-beta gates; five prior sign-offs; real failure/transaction/deletion/restore evidence; retention approval and explicit save/transcription recovery acceptance.

**Paid Public Launch:** NOT READY

Blockers: public-beta gates; real payment retry/refund/order and Firestore contention evidence; uncertain paid-provider recovery; approved durable-save behavior and backup/payment/deletion reconciliation.

**High-Traffic Launch:** NOT READY

Blockers: paid-launch gates; direct uploads, durable transcription/outbox, realistic capacity, global load shedding, bounded scratch/PID/memory and tested failover/autoscaling.

**Enterprise Sales:** NOT READY

Blockers: paid-launch reliability/security; contractual SLA/DR proof, independent assurance, organization access/audit governance and customer-required identity/privacy/procurement controls.

## 15. Next action

**The single highest-priority engineering task remaining is: move `/api/process` transcription into a durable job intent/outbox/result workflow and prove recovery across provider-call and result-persistence crashes without repeating an uncertain paid operation.**

---

# Historical phase 1 record — 5 September 2026

The record below is retained for provenance; the phase 2 assessment above supersedes its counts and readiness conclusions.

Decision: promising product with substantial engineering safeguards, but not
verified for an unrestricted public launch or a direct Google Cloud migration.
This review covers the current checkout, local tests, and read-only public
release/readiness checks. No deployment or paid API integration was performed.

## Fixes made

- Upload and transcription recovery treated AbortError as a transient network
  failure. A cancelled request could restart and interfere with its replacement.
  Cancellation now escapes without retrying, including the API proxy fallback.
  Behavioral tests also verify terminal failures and stable idempotency receipts.
- Development startup could kill unrelated processes using the expected ports.
  Removed that process-killing code from Vite and the full startup script. Only
  child processes launched by the startup script are stopped during cleanup.
  Spawn failures now produce an explicit error; the configured Python executable
  is honored and background child windows are hidden.
- Export waited for fonts before any caption text existed. A font first loaded
  after layout could shift a dragged word. The renderer now waits for newly used
  fonts with a bounded timeout and rebuilds measured positions before capturing
  the frame. A delayed-font browser regression reproduces the old drift and
  verifies the fix. Renderer version v46 invalidates old render-cache entries.

No pricing, template designs, or product workflow was redesigned.

## Verification and limits

- All 105 backend unit/contract tests passed (test environment; provider and
  infrastructure mocks are not a real authenticated customer journey).
- 213 release contracts, XSS checks, frontend contracts, ESLint, type checking,
  production build, and configured performance budgets passed after the fixes.
- Vite and Next.js builds used the repository's CI placeholder identity settings.
  These local outputs are test artifacts and must not be deployed. A normal
  production build in this session correctly failed for missing API config.
- npm audit gate passed for both apps with no high/critical advisory exceptions.
  The locked Python dependency audit reported no known vulnerabilities.
- Template motion/visual checks and export suites were run; final matrix and
  public-browser results are recorded in the completion note below.
- Operational-profile validation passed. This validates the recorded profile;
  it does not prove that a new Google Cloud deployment implements it.
- The Google Cloud container/runtime, a fresh paid customer journey, and actual
  assistive-technology/mobile-device acceptance were not verified in this review.

Completion: the full export matrix passed 330 cases (47 high-risk, 80 left,
123 right phases, 60 basic, 20 scaled basic). It began before the font fix;
the 47 high-risk cases were repeated successfully against the final renderer,
alongside the delayed-font negative control and actual dragged-word export.
The LC playback check passed 2,170 duration variants. All 55 public-page cases
passed across Chromium, Firefox, WebKit, Pixel, and iPhone emulation. These
automated device profiles do not replace physical-device or screen-reader tests.
The final backend rerun again passed all 105 tests; `git diff --check` passed.

## Launch blockers observed

The deployed-release verifier reached the public app/API and reported a backend
version mismatch. At inspection, the frontend matched checkout commit
`5f8923c562a614b6797b9dde8ff540d7c7a5f874`, but the API reported
`b2a475a2383c51c075352b14691c1efff01b1099`. The readiness check succeeded.
These new fixes are uncommitted local changes and are not included in either
deployed release. Commit and deploy one tested revision to frontend, API, and
worker, then rerun deployment and authenticated media verification.

The current launch-evidence gate reports five pending sign-offs:

1. Independent periodic security-review sign-off.
2. Exact deployed commit and successful production configuration/readiness output.
3. Canonical Next.js marketing deployment and production policy/pricing routes.
4. Multi-region DNS and authenticated journey monitoring, plus external status page.
5. Real-device keyboard, screen-reader, reduced-motion, iOS, and Android acceptance.

Older drill records include payment/refund, isolation, scanner, and restore
evidence. They are useful history, but must not be represented as fresh tests of
the future Google Cloud release. Preserve the existing evidence and repeat the
critical media/payment/recovery paths in the target environment. Start with a
limited beta and measured capacity before expanding paid traffic.

## Google Cloud recommendation

For the least code change, use Firebase Hosting for the editor's `dist/` and the
marketing site's static `landing-next/out/`, and Compute Engine for the API and
separate RQ render-worker containers. Keep Firebase Auth/Firestore/Storage, use
private Redis connectivity (for example Memorystore), and store secrets in
Secret Manager. Keep `api.lekhacaptions.com` to match the existing browser CSP;
configure exact CORS origins, auth redirects, App Check, and HTTPS routing.
Firebase supports static/SPAs ([Hosting documentation](https://firebase.google.com/docs/hosting)).

Cloud Run is a possible later target, but the current app is not a drop-in fit:

- `/api/upload` accepts up to 500 MiB through an HTTP/1 Uvicorn server. Cloud Run
  limits HTTP/1 requests to 32 MiB. For that architecture, introduce resumable
  uploads directly to a private Storage quarantine location, then validate size,
  ownership, media format/duration, and malware before allowing processing.
  Do not bypass scanning by treating a successful direct upload as accepted media.
  ([Cloud Run limits](https://docs.cloud.google.com/run/quotas))
- RQ consumes a queue continuously. Use a Cloud Run worker pool or an explicitly
  provisioned always-running worker; a default request-billed service is not an
  adequate worker deployment. Worker-pool scaling must be configured explicitly.
  ([Worker pools](https://docs.cloud.google.com/run/docs/deploy-worker-pools),
  [billing behavior](https://docs.cloud.google.com/run/docs/configuring/billing-settings))
- Temporary video and PNG frames can consume substantial scratch space. Cloud
  Run's writable container filesystem consumes instance memory. Measure peak
  memory and concurrent rendering capacity before sizing or enabling autoscaling.
  ([Container contract](https://docs.cloud.google.com/run/docs/container-contract))
- The Dockerfile contains a Railway-motivated Chromium sandbox bypass; reassess
  it on Google Cloud. Firebase initialization also currently requires explicit
  service-account JSON, so attaching a Google service identity alone will not
  satisfy startup. Migrate to Application Default Credentials deliberately, or
  supply the existing credential through Secret Manager for the initial move.

No Google Cloud resources, migration, DNS change, or deployment were created.

## Product direction: manual choice plus optional Auto-direct

The strongest product promise is editable motion captions that retain their
appearance in the exported video, especially for Hindi/Hinglish and other scripts.
Template count alone is a weaker differentiator. Prioritize time to first usable
export, transcript accuracy, readable motion, and reliable saving/downloads.
The renderer/editor contain large, overlapping implementations; extract shared
rules gradually when fixing mismatches, rather than doing a broad pre-launch rewrite.

The current `emotionalTemplateUtils.js` uses audio energy, silence, word length,
numbers, and English/Hindi stop words. It preserves a cyclic authored phase order.
This is useful reactive styling, but does not establish semantic understanding
or reliable emotion recognition. Loudness alone cannot distinguish excitement
from anger, nor can a long word reliably identify the sentence's important idea.

Recommended progression:

1. Keep manual template selection and existing editing as the default launch flow.
2. Add optional Auto-direct: transcript and accurate word times, brief and brand
   preferences, audio rhythm, and selected video frames go to a design planner.
3. Return a constrained plan: approved template, narrative role per caption
   (hook/problem/reveal/CTA), meaningful emphasis indices, timing, bounded motion
   intensity, line breaks, and safe-zone placement. Respect negation, context,
   multilingual phrasing, pauses, and moments that need stillness.
4. Validate IDs, timing, readable durations, motion limits, and geometry in code.
   Persist one plan and use it in both preview and export. Do not independently
   regenerate creative choices in the worker or overwrite manual word edits.
5. Offer two or three editable directions with explanations and a manual fallback.
   Treat sadness/excitement/etc. as suggested presentation tone, not a claim about
   a person's internal state. Never rewrite the spoken transcript silently.

Claude is a reasonable planner to prototype, not a required launch dependency.
Its structured outputs can return a schema-constrained plan, but code still has
to validate creative choices and layout ([Claude structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)).
Your renderer should execute the approved plan; arbitrary model-generated
HTML/CSS/JavaScript should not become the production rendering pipeline.

Start with one bounded planning call, cached per project/brief, with timeouts,
quotas, consent for the added provider, and a template fallback. Add an iterative
agent only if a small review-and-revise loop demonstrably improves output. Compare
manual versus assisted completion time, accepted suggestions, correction rate,
export failures, and cost per completed export using consenting beta projects.
