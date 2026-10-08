# Current launch blockers — 8 October 2026

## Decision

The existing evidence supports a controlled launch with the approved limits.
The latest reviewed candidate is **not yet published or accepted in production**.
International paid acquisition remains blocked by account activation and a real
international checkout. The owner excluded new heavy-traffic tests and additional
professional engagements; these remain deferred, not completed.

This inventory reconciles relevant launch/review chats, repository evidence and
fresh provider observations. Historical passes retain their original date/scope.
It does not claim that every historical message or every customer path was rerun.

## Remaining release blockers

| Item | Current evidence | Work completed / next step |
|---|---|---|
| Publish the reviewed fixes | Live frontend/API SHA is `5107440d9a2cdce22db47d1154656d55934be3ab`; candidate is on `codex/launch-reviewed-release`, unpublished. | Integrated the reviewed editor, ASS and currency changes onto current production main. Preserve newer backend modules, save notices, backup contrast and launch assets. Publish after the release gate below is resolved. |
| Hosted release gate unavailable | Fresh GitHub billing view: Actions $10/$10, stop usage Yes. | Local checks completed. Automatic approval review rejected an unapproved CI-skip action. Exact owner approval to substitute these checks is pending; no CI result has been fabricated or workflow disabled. Fresh final container checks have not been completed. |
| Component identity consistency | Live frontend/API SHAs agree and API readiness is true, but versions (`5107440d9a2c` versus `git-5107440d9a2c`) and build timestamps differ. Private worker HTTP verification is still required. | Fixed frontend default version and unified homepage/editor verification. Strict SHA/schema/environment/version/build-time/readiness/private-worker checks remain. Build the next authorized batch with a recorded common identity before creating its artifacts; verify all components afterwards. Never relabel an old artifact as the new release. |
| Current-release customer acceptance | Local editor regression passed; preceding live MP4 acceptance is dated October 6. Earlier browser coverage was 60 passed / 20 credential or media cases skipped. | After publishing, run an authenticated upload → transcription → correction/template → save/reload → MP4 export/download and recovery check within existing quotas. Record actual outcome and debit, not an inferred pass. No fresh paid checkout or quota bypass has been performed. |
| International card activation | Razorpay still offers Request for international cards. P0807 was explicitly confirmed by the owner. IEC is required by this account's form and the owner has no IEC. | Actual merchant support ticket **21307102** created; support quoted 4–8 business hours. Ask whether this SaaS/digital-services account can activate without IEC and what USD/card requirements apply. The first support email only received an unmonitored-mailbox autoreply. Ticket monitoring is active. Await a substantive reply; owner must review required declarations/terms and complete any financial transaction. |
| International checkout acceptance | Historical domestic purchase/webhook/refund evidence does not establish international-card acceptance. | USD/INR pricing and currency/amount validation are implemented and locally tested. After account approval, confirm one successful international card payment and the resulting plan/credits; inspect failures/webhook consistency. |

## Fixed or already closed

| Prior finding | Status and evidence |
|---|---|
| Lost editor draft/recovery prompt, silent conflict/save loss | Production includes draft restore/download/account recovery and revision/conflict guards. Current candidate retains these and passed the local recovery/conflict/undo/account-isolation journey. See `LAUNCH_ACCEPTANCE_2026-10-06.md`. |
| Editor monolith and disconnected smart-guide snapping | Candidate extracts text-element layer, document gestures, text editing, canvas transforms and word gestures, and connects snapping. This improves code structure; it is not a promise of a subjective 10/10 rating. Publication remains above. |
| Large backend orchestration and ASS function | Current main already has the newer standalone settings/services; candidate preserves them and splits ASS style/events from the short orchestrator. 434 backend tests plus 40 subtests passed for the integrated application. |
| INR-only international pricing | Candidate shares the USD/INR preference across home, landing and dashboard. Non-India timezone defaults to USD; user can override. Prices are unchanged and INR top-ups are disclosed. Checkout checks both currency and amount. |
| Launch evidence command fails | Reproduced and fixed the drill-table records. Passed counts/limitations stay in the scenario; Result uses the checker's required PASS. The partial 100-export run is explicitly retained outside the completed-pass table. Strict checker now validates 25 recorded drills. |
| Deployment checker rejects unified home/editor | Both routes currently serve the Vite editor artifact. Target identity now reflects configured deployment topology; a separate marketing deployment must still identify itself as marketing. Metadata and negative-path checks cover both. |
| Netlify $9 overdue invoice | Fresh billing read: No overdue invoices; October 8 $9 receipt paid. 682.3 of 1,000 credits remain; autorecharge disabled. No payment/billing change was made by the agent. This clears the old billing blocker, not a guarantee of unlimited hosting. |
| Worker retries stuck in processing / double charging | October 6 actual SIGKILL before and after debit recovered two jobs with exactly two credits. Retry reconciliation, terminal-state protection and paid-result reuse are in production. Finite failure-injection evidence is preserved. |
| R2 CORS/download redirects and paid result recovery | Direct signed downloads/header isolation and recovery landed in earlier releases; October 6 downloaded a fresh MP4 and repeated receipt download without a second debit. The stress download limitations remain below. |
| Malware database age / 100 MiB engine cap | PR37's database freshness, bounded update, 500 MiB file and 600 MiB expanded allowances passed exact local final images and production checks on October 6. Current API/transcription caps remain 2/3 GiB. New candidate image checks are not claimed. |
| Event-loop blocking / runtime ownership | Earlier PR35 checks, deployment and current modules are recorded in October 6 acceptance. App Check enforcement is enabled on current API; storage, Redis and payment configuration presence were read without exposing values. |
| Public domains, support mailbox, basic alerts and policies | Dated production/owner confirmations cover DNS/TLS/mail, support delivery, alerts, published policies and prior payment/refund flows. Preserve them as dated evidence; do not relabel them as today's new-release tests. |
| Repository privacy/exposure | Fresh repository API reports Private. Prior source/history privacy findings are retained in privacy evidence; no public exposure or history rewrite is authorized by this audit. |
| B4 records still said pending | October 7 corrected records with redacted numeric evidence: `evidence/railway-b4-20261006.json`. No fresh 100-user test was requested. |
| Stale operating profile and launch checklist | Profile now records the already approved October 6 Railway capacity; older August checklists link here. Objectives and historical evidence remain distinct from today's runtime readback. |

## Current operating limits (read 8 October)

- Existing Railway API: 1 replica, 2 vCPU / 2 GiB, 2 Uvicorn processes.
- Render: 1 baseline replica, 8 vCPU / 8 GiB; transcription: 1 baseline,
  2 vCPU / 3 GiB. Both worker ceilings 5; both controllers enabled.
- API/workers sleep enabled; worker drain 1,860 seconds. Cron 1 vCPU / 1 GiB.
  Redis remains always on. No new infrastructure or resizing was performed.
- API/cron pending-work budget 3,000 seconds; daily AI system limit 2,000;
  per-user process/export concurrency remains 1. These are configured ceilings,
  not an export count guaranteed by $25.
- Railway hard cap $25 / alert $10 unchanged. Latest combined reported usage
  approximately $0.645, subject to reporting delay. Storage, AI/provider,
  database, frontend and tax charges can sit outside this cap.
- API/cron deployments successful, worker deployments sleeping; all provider
  deployment records report SHA `5107440`. Required storage/Redis/payment
  configuration presence verified. No secret values are included here.

## Limits and separate cost follow-up

- The October 6 resumed burst produced 100 exports, with **85 initial downloads**
  and **15 recovered downloads** using existing receipts and zero replacement
  renders. It was not a fresh, naturally diverse 100-user upload-to-download
  pass. Do not erase first-pass transport failures or infer sustained capacity.
- Diverse maximum-size clips, real-device large downloads, sustained traffic,
  worst-case scanner memory and a settled itemized bill remain measurement
  limits. New heavy-traffic testing was excluded by the owner.
- The old Google Cloud project reports **suspended** and denies instance
  inventory. Empty CLI output is not proof of zero resources or zero liability.
  Active application hosting is Railway/R2. Do not reactivate old billing to
  investigate it; a current account statement/resource inventory requires
  owner/provider access.
- PR49's unreviewed phone/tablet redesign and unrelated shared working-tree
  edits are excluded from this release and preserved.
- Additional pentest/CA/legal engagements, enterprise SSO, multi-region projects
  and new large-scale infrastructure are deferred under `CONTROLLED_LAUNCH_SCOPE.md`.

## Verification and retained evidence

- Integrated application: 434 backend tests + 40 subtests passed; 74 frontend
  unit tests passed; local editor journey, contracts, lint, TypeScript, both
  production builds, security policy and bundle budget passed.
- Current release-fix reruns: 342 release checks; 19 metadata assertions and 11 deployed-verifier scenarios; 74 frontend
  tests; frontend contracts, lint, TypeScript, operational and launch-evidence
  gates. The build-only braces audit exception remains documented.
- Full template suites were run earlier, and renderer/template/export-test
  sources were checked byte-identical during integration. These suites and
  final container checks were not rerun for the current release-fix patch.
- Private local evidence resides in the outer workspace's
  `.readiness/deploy-reviewed-20261008/`, plus
  `launch-runtime-current-20261008.json`,
  `netlify-billing-current-20261008.png` and
  `razorpay-support-ticket-21307102.png`. Secrets and signed URLs stay out of Git.

Relevant sessions reconciled include **Run code review**, **Review myapp**,
**Prepare Lekha Captions launch**, **Test and fix launch blockers**,
**Resolve paid beta launch blockers**, **Audit caption platform readiness**,
**Review app launch readiness**, **Fix remaining issues and push to Git**,
**Summarize changes from last sessions**, **Complete unfinished Lekha features**,
**Implement missing review items**, **Deploy and verify Lekha release**,
**Review public repo privacy**, and the infrastructure/GCP review sessions.
The older August/September checklist, October 6 acceptance and October 7
redacted evidence remain source records; this dated report summarizes today's
status without rewriting their historical outcomes.
