# Lekha Captions — Development Log

This is the **Work Diary** for the Lekha Captions project.

- **CLAUDE.md** = The Rulebook (stable: build commands, architecture, conventions, known bugs)
- **DEVELOPMENT_LOG.md** = This file — the live session journal

**Workflow:**
1. Start a session → Claude reads this file first to know current TODO and where we left off
2. End a session → Tell Claude "update the log" → Claude appends a new dated entry + updates TODO
3. Run `/clear` → Start fresh, Claude reads here and picks up exactly where we stopped

---

## Current TODO

> Keep this section always up-to-date. It is the first thing read at session start.

- [ ] **2026-10-21 public-history clearance** — Repository stays PUBLIC. Owner later authorized ordinary pushes of all branch work. After reviewing the verified 491-commit cleanup and explicit force-update question, the owner answered DO WHATS RIGHT. A coordinated rewrite is authorized with backups, source-equivalence verification and explicit atomic leases; local preparation alone does not establish GitHub cleanup. See `docs/PUBLIC_REPOSITORY_CLEANUP_2026-10-21.md`.

- [ ] **2026-10-21 combined publication** — `codex/launch-fixes-20261021` integrates PRs #63–66, visitor-country currency, newer LC export weight and launch-review fixes, and the concurrent release branch ancestry. See `docs/BRANCH_INTEGRATION_2026-10-21.md`. The prior no-push hold is lifted. Final image/scanner and production recovery/MP4/credit, international purchase, phone, support, retention and monitoring acceptance remain distinct. Actions $18 stop and Railway $25/$10 cap/alert remain unchanged.

- [x] **Final malware scanner fixes, PR #37 (2026-10-06)** — Owner's “do it” authorized substituting the completed exact local image checks for this PR only. Verified head `4774775` merged as `63cf04f` with an identical tree and deployed to all four existing Railway app services and both Netlify sites. Fresh daily signatures (version 28145, under eight hours old), 500 MiB file/600 MiB expanded limits, matching public release markers and HTTP 200 readiness verified. Twenty tests passed in each exact local image; backend suite passed 432 tests/40 subtests. Hosted jobs remain billing-blocked; Actions stays at $10, Railway at $25/$10 cap/alert, Netlify billing excluded. Fresh production upload/scan/transcription/edit/SRT download passed; MP4 attempt hit the existing Starter three-per-24-hour quota before debit (10→10), so a new-release MP4 is not claimed. Owner declined the fresh 100-user test. Optional follow-up remains unapproved. Local Docker runtime/disks were cleaned; a separate D: frontend build directory remains because automatic approval review could not complete cleanup after reaching its usage limit.

- [x] **PR #28 remaining runtime fixes (2026-10-05)** — Document scaling/cache/memory variables, run quality gates on PRs and main pushes, align Docker transcription startup with Railway clamd, offload analytics/maintenance I/O and set API capacity to two processes on 2 vCPU/2 GiB.
- [x] **Railway finite measured acceptance (2026-10-06)** — Completed the approved 4/8-vCPU comparison, 10-client burst, resumed 100-export burst, Hindi processing and real before/after-debit worker crashes. Final-release production sleep and test cleanup verified. See `docs/LAUNCH_ACCEPTANCE_2026-10-06.md` for the 85% first-pass stress-download result and other limits; conservative work ratios remain unchanged. Unrestricted mass-launch clearance remains unestablished.
- [x] **B7 code health follow-ups (2026-10-05)** — Separate router and rendering module splits plus unused committed artifact cleanup; preserve shared helpers, RQ paths and all test assertions.

- [ ] **Future deployment cost gate** — Before deploying under another account or provider, reread this whole log and `docs/GCP_DEPLOYMENT_PROMPT.md`. Obtain the owner's explicit approval of a written estimate for idle and peak monthly spend, a fixed-resource inventory, test budget and expiry, and a shutdown plan. Verify the *live* resource counts and bill after deployment; source-code defaults alone are insufficient. See the 2026-09-28 billing incident entry below.
- [x] **Railway + Cloudflare R2 deployment (2026-10-06)** — Current immutable release `63cf04f` published on both existing Netlify sites and all four Railway app services with scanner fixes verified. Complete authenticated production save/reload/MP4 journey and actual idle sleep were verified on preceding release `0c5182f`; new-release upload/scan/transcription/edit/SRT passed, MP4 blocked by existing account quota. The approved five-replica profile and $25/$10 cap/alert are unchanged. Redis remains always on. See `docs/LAUNCH_ACCEPTANCE_2026-10-06.md` for evidence limits.
- [ ] ~~**AWS scale-to-zero migration**~~ (superseded 2026-10-03 by Railway + R2) — The owner chose AWS (2026-10-02). Follow `docs/AWS_SERVERLESS_MIGRATION_2026-10-02.md` starting at Gate 0 (verify the Firebase project and App Check work without the closed Google billing account; AWS workload account with SCP deny-list and budgets before any workload). Keep the future deployment cost gate above.
- [ ] ~~**Google Cloud on-demand redesign**~~ (superseded 2026-10-02 by the AWS plan) — The owner chose Google Cloud under a different email for a future deployment. Use `docs/GCP_DEPLOYMENT_PROMPT.md` as the implementation brief: static frontend, request-driven Cloud Run API, direct Cloud Storage uploads, Cloud Tasks for post-upload/processing work, and Cloud Run Jobs that exit after each unit. Replace Redis/RQ and its payment, rate-limit, and job-state uses before claiming zero idle worker compute. Keep the future deployment cost gate above.
- [x] **Deployment architecture reminder** — Public editor is `lekhacaptions.com/Dashboard`; existing Netlify sites, apex rewrites and old app-domain redirects retained and published. Netlify billing is excluded by the owner.

- [x] **Unified apex landing and editor** — Owner clarified on 2026-10-04 that both the homepage and editor must use the latest Vite app. The existing apex Netlify site now serves that app directly; old app-domain bookmarks redirect to the apex. Future frontend deployments must follow `docs/NETLIFY_DEPLOYMENT.md` and must not restore `landing-next/` as the homepage.
- [ ] **Timeline fix** — Speech track background is showing gold stripe. Only the individual caption *blocks* should be gold, not the entire track row background. Fix in `src/components/dashboard/CaptionTimeline.jsx`
- [ ] **Gradient gold buttons** — Replace flat `bg-[#F5A623]` buttons with gradient: `bg-gradient-to-r from-[#FFE566] to-[#F5A623] hover:from-[#F5A623] hover:to-[#D4891A]` across all CTA buttons (14 files)
- [ ] **Text gradient** — Apply `bg-gradient-to-r from-[#F5A623] to-[#FFD700] bg-clip-text text-transparent` to key headings, logo, and accent text
- [x] **Razorpay key handoff** — Verified 2026-09-26: checkout uses the server-authoritative `create-order` response `key_id` and only falls back to the optional frontend key.
- [ ] **Landing footer bottom** — Bottom section / CTA strip color → gold (`src/components/landing/Footer.jsx`)
- [x] **Account plan mapping** — Verified 2026-09-26: Starter, Creator, Pro, and yearly variants are mapped in the account page and sidebar.
- [x] **Effects / Emphasis button** — Verified 2026-07-21: works in `StyleControls.jsx` (collapsible `Effects−/+` block present; selecting Neon applies a live multi-layer `text-shadow` glow to caption words in preview). Not re-checked in `WordClickPopup.jsx`.
- [ ] **Styling tab width** — Increase styling panel width to match caption tab width
- [ ] **Verify the next pinned runtime secret** — Confirm the selected numeric Secret Manager version contains live Razorpay, Firebase, provider, CORS, signing, and monitoring values before rollout. Never record those values in this file.
- [x] **Verify template export fidelity** — Verified 2026-07-21: `npm run test:templates:all` (motion + visual + export parity across all-left, LC, all-right-phases, all-basic, all-basic-scaled scopes — ~130 templates) passed with 0 failures.
- [ ] **Verify Text tab export** — Confirm text boxes added via Text tab (custom color, animation, position) appear correctly in exported video
- [x] **FPS validation** — Verified in code/tests: the API accepts plan-authorized 24/30/60 FPS values and the renderer defaults invalid or missing values to 30 FPS. Representative production media remains part of release acceptance.
- [ ] **Verify zoom/transition animations** — Test zoom_in, zoom_out, fade_in, slide_up/down/left/right in Animate tab → Basic category work correctly in preview

## 2026-10-03 — Railway first rollout and ingress correction

- PR #18 merged as `ab85157` after all 26 hosted checks passed, including API/transcription final-image ClamAV checks. All 17 shared variables were populated and read back by names only. Existing live Razorpay keys and webhook secret were recovered from local saved files. At the owner's action-time approval, created an additional R2 Object Read & Write token scoped only to `lekha-media`; existing token remains active. R2 HeadBucket returned HTTP 200.
- Applied the reviewed six-addition, zero-deletion plan to the new `lekha-captions` project. Live inventory: four app services plus Redis. Workspace hard limit $15, alert $8 verified; no GCP/AWS resource was accessed.
- First rollout exposed IPv6-only Uvicorn ingress: API startup completed but Railway healthcheck failed. Corrected the API bind to `0.0.0.0` and set explicit PORT=8080 for matching healthcheck/domain routing. Workers retain their dual-stack wake server.
- Remaining acceptance gates: API readiness, custom-domain attachment, frontend redeploy, authenticated upload/wake/sleep checks. A post-apply plan proposes relocating Redis plus restart-policy drift; no destructive follow-up apply was performed.

## 2026-10-03 — Railway R2 deployment validation follow-up

- Unified API startup and offline preflight storage requirements: Railway requires all four R2 settings, accepts no Firebase Storage bucket, and reports missing variable names only. Release identity uses platform defaults in preflight too.
- Railway worker launching now fails closed when the wake map is entirely absent or empty, preventing accidental legacy Cloud Run fallback. Wake/drain, multipart upload, and cron behavior are preserved.
- Added API/transcription image CI builds selected by `LEKHA_SERVICE_TARGET`; both verify `clamscan --version` and nonempty ClamAV databases. Local Docker is unavailable, so remote image verification remains pending.
- Local verification: 319 backend tests passed; frontend release check passed with 339 readiness assertions plus contracts, lint, typecheck, build and performance budgets; dependency audit passed with the three existing reviewed exceptions. Final focused preflight/launcher tests: 25 passed.
- Live preparation: corrected the existing R2 abort rule (it incorrectly deleted all completed objects after one day) and added `render-cache/` deletion after three days. Existing upload/export rules and CORS were verified. No token was rotated.
- Railway CLI 5.63.1 authenticated to the owner's new account. Created a new empty `lekha-captions` project after the owner authorized deployment; hard usage limit $15 and alert $8 verified. IaC plan: six additions (four services, Redis, group), zero changes/deletions. Apply and production deployment remain pending credentials and reviewed CI.
- Credentials stay in local gitignored files. Existing live Razorpay and R2 access credentials were not found in the main workspace scan; three new application secrets were generated at the owner's request. No credential values are recorded here.

## 2026-10-03 — Railway + Cloudflare R2 scale-to-zero implementation

- The owner chose Railway with Cloudflare R2 instead of AWS. Firebase Auth and Firestore stay. The guide, cost estimate and spend limits are in `docs/RAILWAY_DEPLOYMENT.md`; the services are defined in `.railway/railway.ts` (Railway Infrastructure as Code, because `railway.json` is deprecated and stops being read on 2026-12-01). Nothing was deployed or created.
- Workers wake over HTTP (`/wake` + `WORKER_WAKE_SECRET`), drain their RQ queues and go idle so Railway can sleep them. Fixed a bug where the drain ran RQ off the main thread: RQ's signal handlers made every real drain fail. SIGTERM now finishes the running job and frees the launch lease. A real-Redis smoke test passed.
- Browser uploads go straight to R2 as resumable multipart uploads: 8 MiB parts with signed lengths, 3 in parallel, resume via `ListParts`. Completion verifies sizes; cancel and the janitor abort unfinished uploads.
- `backend/railway_cron.py` (every 15 min) does the API's periodic work without waking it:
  - due retries and outbox recovery;
  - worker re-wake;
  - R2 cleanup and payment reconciliation.
- Images: the Dockerfile final stage is chosen with `LEKHA_SERVICE_TARGET`. API/transcription images ship `clamscan` with signatures copied from the official ClamAV image. A scan takes ~17 s and ~1 GB, so `CLAMAV_SCAN_TIMEOUT_SECONDS=120` on Railway.
- Also patched the dependency advisories that failed the audit gates (next, brace-expansion, pyjwt, urllib3), with reviewed exceptions for unpatched build-time-only ones.
- Gate 0 passed (owner, 2026-10-03): the Firebase project is still on Blaze with a billing account linked (₹0.01 that month). Sign-in, the dashboard and the App Check token exchange all work. Keep the Google budget alert and service spend caps low.
- Open checks before go-live:
  - every service shows Sleeping after ~10 idle minutes;
  - ClamAV signatures need a redeploy at least weekly.

## 2026-10-02 — AWS scale-to-zero architecture and migration plan (documentation only)

- The owner chose AWS instead of a new Google Cloud project. Added `docs/AWS_SERVERLESS_MIGRATION_2026-10-02.md`: architecture review of the current code, the GCP idle-cost causes, the target design (Cloudflare Pages; API Gateway + Lambda running the existing FastAPI app; DynamoDB replacing every Redis/RQ duty; DynamoDB Streams outbox; SQS → Lambda for scan and transcription; AWS Batch on Fargate for renders with a hard `maxvCpus`; private S3 + CloudFront; no NAT, load balancer, EC2, Redis or minimum instances), a responsibility-by-responsibility Redis/RQ replacement map, cost models, layered spend limits and an ordered migration plan.
- Verified facts that shaped the plan: production boot still requires Redis and RQ (`backend/main.py:836`, `:842`, `:863`); payment idempotency already has a Firestore path; credit debit and payment grants are already Firestore-transactional; transcription and media-scan already use Firestore outboxes; plans cap videos at 120–180 s and uploads at 500 MiB; App Check uses reCAPTCHA Enterprise, which needs Google billing.
- No application code, cloud account, or paid resource was changed or created. Prices are planning rates to be checked in the AWS Pricing Calculator at the cost gate.

## 2026-09-28 — Cloud billing incident and future deployment cost gate

- The owner reports unexpected Google Cloud charges after the September deployment and tests and cannot afford the balance. The owner now reports that the former billing account is closed, both oversized live autoscalers were deleted, managed-group resize requests were rejected while billing was closed, and five VM records still appeared as `RUNNING`. These live actions are owner-reported, not independently rechecked in this entry. No account, project, resource, payment setting, or deployment was changed during this documentation update. Account closure does not cancel charges already incurred; resolve the balance or disputed items with Google Cloud Billing Support. Do not reuse the former project or billing account for a future deployment without a separate owner decision.
- Screenshot evidence: September 1–26 showed approximately ₹35.6k gross usage, ₹30.1k savings, and ₹5.53k net. The later September 1–27 report showed ₹11,084.73 net, led by Compute Engine (₹8,600.74), Memorystore for Redis (₹1,860.31), and Networking (₹581.01). These are cumulative charge-period reports, not proof that all of the increase was incurred after workers were stopped. Get daily SKU or detailed billing-export rows, credits, and resource timelines to establish that.
- Cause: the deployed architecture kept two API VMs, three render VMs, provisioned Redis, load balancers and networking available while idle. September 24 load-test VMs added temporary usage. Stopping a worker process or its queue does not stop a `RUNNING` VM; stopping a VM can still leave disks and IPs chargeable, and Redis charges for provisioned capacity. The September 28 read-only inventory in `docs/ARCHITECTURE_GAP_VERIFICATION_2026-09-28.md` still listed two API and three worker VMs, despite zero-minimum settings in source. Billing-account state and current billable runtime need separate live verification; delayed reporting can also raise historical totals after shutdown.
- Prevention gate for **any** future cloud deployment, including a new email/account or another provider: prefer local tests first; list every persistent resource and its idle monthly cost (VMs, managed databases/queues, load balancers, NAT, IPs, disks, storage and logs), plus peak capacity, test duration and worst-case cost. Show the estimate, spending limit and data-preserving rollback/shutdown procedure to the owner and get explicit approval **before** creating paid resources. Use an isolated test project/account where practical. Default compute to zero at idle, keep instance maxima and quotas small, and avoid fixed-cost services unless the owner accepts their idle cost.
- Put an automatic expiry/cleanup plan on temporary load-test resources, confirm deletion after each test, and verify actual live minimum/target sizes, instance states, service inventory and daily net cost after every apply. Set several low budget alerts and anomaly notifications; ordinary Google Cloud budget alerts are notifications, not a cap. Any automated billing shutdown must be tested and must account for delayed billing, queued work and data preservation. Do not claim a zero-cost idle state until fixed services and observed bills confirm it.
- The proposed reopen/resize/Cloud Run cutover is not an automatic follow-up to closing billing: reopening resumes charges for linked projects. Only consider it after the owner chooses to operate the service and a saved Terraform plan, secrets, Cloud Run candidate, Scheduler jobs, queue metrics, canary, and rollback are ready. The Terraform configuration schedules transcription dispatch, media scan dispatch, and queue metrics every minute; these invoke Cloud Run even without customer traffic and need an idle-period cost measurement. `min_instance_count = 0` avoids a fixed minimum instance charge but does not make scheduled requests or Redis free.
- The owner selected Google Cloud for the next deployment, using a different email, and asked to carry forward the on-demand design previously discussed for AWS. Proposed Google mapping: keep the frontend static; run the API on Cloud Run with request-based billing and minimum instances zero; upload media directly to Cloud Storage, then enqueue the scan, transcription, and export steps in Cloud Tasks; use an authenticated dispatcher to launch one-task Cloud Run Job executions that exit after processing. A completed upload itself is stored durably, not streamed through Cloud Tasks. Cloud Tasks can redeliver, so job launch and completion must be idempotent. Replace Redis/RQ plus Redis-backed payment idempotency, rate limits, admission, and job status with a transaction-safe durable design, such as Firestore transactions. Verify Firebase Auth and media migration separately from the old billing account.
- This is a proposed architecture, not an implemented or deployed change. The current Terraform still defines Standard HA Redis, Cloud NAT, load balancing, legacy VM resources, and minute-scheduled API calls; do not apply it unchanged to a new project. The first release should cap total concurrent job *executions* at one, bound queue size and task duration, and prove that an idle period has zero worker executions and no fixed compute/networking resources. Record the measured residual storage/request bill and obtain the owner's written cost approval before creating paid resources. A new email does not extinguish charges incurred on the former billing account.
- Verification for this entry: reviewed repository Terraform defaults, prior read-only inventory, and the owner's billing screenshots; documentation-only edit. No fresh cloud inventory or SKU-level billing export was obtained, so the exact cost incurred after the reported worker stop remains unverified.

## 2026-09-28 — New Google deployment brief recorded before implementation

- The owner confirmed Google Cloud under a different email as the next deployment target and asked for the entire cost-prevention solution to be written as a prompt **before implementation or deployment**. Replaced the older launch prompt in `docs/GCP_DEPLOYMENT_PROMPT.md`; its instruction to run 100- and 250-user bursts is superseded. No architecture code or cloud resource was changed in this entry.
- The brief requires a static frontend, request-billed Cloud Run API at minimum zero, direct private Cloud Storage uploads, Cloud Tasks notifications, short-lived Cloud Run Jobs, durable idempotent admission and completion, and a complete migration of Redis queue, payment, rate-limit, lock and job-status duties. It prohibits silently reusing the current VM, Redis, NAT, load-balancer and scheduled-polling Terraform design in the new project.
- Before any paid resource, prepare an account/project-specific idle and bounded peak estimate including retained storage, Firestore, task requests, image storage, logs, egress, external providers and taxes; set low alerts and actual capacity limits; show a data-preserving stop procedure; obtain the owner's explicit approval. Use local benchmarks and at most a small, time-limited real-export pilot rather than another 100-user load test. A zero-idle-compute target is not a zero-total-bill promise.
- `AGENTS.md` now makes rereading this entire development log and the deployment prompt an explicit pre-deployment rule. After implementation and deployment phases, record code state and live state separately, verify a cold 0-to-1-to-0 worker cycle and observed daily SKU charges, and update this log with the evidence. Verification for this documentation change: reviewed current prompt, Terraform references, incident entry and Git diff; no cloud access, deployment or new price quote was used.

## 2026-09-17 — Production queue, media, and infrastructure hardening

- Deployed application release `d8824f5d998ec9daec8de31c7a803408755841de`
  with separate API, render, and transcription images and a pre-baked worker
  runtime. API/frontend release metadata now agrees and reports `production`.
- Moved the active queue to Standard HA Redis 7.2 and added authenticated direct
  resumable GCS uploads, a private lifecycle-managed media bucket, multi-project
  workspaces with revisions, numeric Secret Manager pinning, Cloud Armor, and
  Terraform definitions for the production infrastructure.
- Enabled queue-depth autoscaling from 3 to 20 workers with CPU fallback,
  active-job instance protection, conservative scale-in, regional `ANY`
  placement, an 80-job pending limit, ten-minute queue lifetime, and five-minute
  retry guidance.
- Google approved 100 global Compute Engine vCPUs. A controlled 100-job 720p
  capacity probe used all 20 workers and completed 100/100 with zero failures in
  131.153 seconds. Worker cold start measured 20–22 seconds across 34 samples.
  All queues returned to zero after the test.
- Verified public root/API readiness, Cloud Armor on both backends, HA Redis,
  GCS CORS/lifecycle cleanup, protected direct-upload/project routes, and clean
  Git state. Detailed evidence is in
  `docs/GCP_PRODUCTION_HARDENING_2026-09-17.md`.
- Fixed the Windows deployment helper to use a securely deleted temporary file
  for Secret Manager updates, made the optional frontend Sentry DSN build input
  work without a configured third-party account, and balanced idle scale-in at
  five protected workers per five-minute window.

---

### Session 13 — 2026-06-09

**Theme:** Template highlight colors → 3 bright colors, editable text box on template captions, upload MIME fix, and a permanent reference for how templates get applied.

---

#### 🔑 REFERENCE — How templates get applied (read this first if "templates not applying")

This is the canonical map of the template pipeline. If a template ever stops
applying, walk these stages in order — the break is almost always one of them.

**1. Two template families, two galleries**
- **LEFT gallery — the 69-set** (`SidebarTemplateGallery20.jsx`): sets
  `template_20_id` + `template_source` + `template_class` + `template_layout` +
  `template_markup` + `secondary_color`. This is the family in the screenshots.
- **RIGHT inspector** (`AdvancedTemplateLibrary.jsx`): sets `template_id` only.

**2. Style extraction (left family)** — `extractTemplateStyleFromPreview()` in
`SidebarTemplateGallery20.jsx` reads the template's CSS rule (font, size, weight,
color, letter-spacing) and `extractAccentColorFromMarkup()` derives the accent
from the markup class (e.g. `ns3-green`, `imp-pink`) via `TEMPLATE_ACCENT_COLOR_MAP`
→ becomes `secondary_color`.

**3. Apply** — `Dashboard.handleApplyTemplate()`:
  - resets `TEMPLATE_OWNED_RESET` props first (so Template B never inherits
    Template A's bg/color/font),
  - merges the extracted template style into `captionStyle`,
  - runs `resolveScriptFont(fontFamily, text)` (`fontUtils.jsx`) to remap the
    Latin display font to a matching **Devanagari** font when the caption is
    Hindi (CRITICAL — a Latin-only font is invisible on Devanagari and looks
    like "template not applied"). Always test templates on Hindi text.

**4. Render (in-page, NOT iframe)** — `VideoPlayer.jsx`:
  - `hasSidebarTemplateStyle(captionStyle)` → true when `template_20_id` exists
    or `template_id` starts with `sidebar-`. This + `caption.template_20_id`
    sets `isSidebarTemplate`.
  - `isSidebarTemplate` → `renderAppliedSidebarTemplateCaption()` renders the
    template as in-page React spans (the old `<iframe srcdoc>` overlay is dead).
  - Per-word emphasis: `selectSemanticEmphasis()` (`emotionalTemplateUtils.js`)
    picks the strongest non-stop-word in each caption and colors it from
    `EMPHASIS_COLORS`. That color is passed down as the `emphasisColor` prop.
  - Template accent renders as the `--sidebar-source-accent` CSS var (=
    `secondary_color`); text color as `--sidebar-source-color`.

**5. Export** — `ExportPanel.jsx` captures DOM word positions → `POST /api/export`
→ backend `_create_styled_ass` → FFmpeg burn (ASS, not CSS).

**Common break points:** (a) `secondary_color`/`emphasisColor` equals the text
color → highlight invisible; (b) Devanagari font not remapped → looks unstyled;
(c) `hasSidebarTemplateStyle` returns false because `template_20_id` got dropped
on merge → falls back to plain rendering.

---

#### Changes this session

| # | Area | Change |
|---|------|--------|
| 1 | **Highlight palette → 3 bright colors** | `EMPHASIS_COLORS` (`emotionalTemplateUtils.js`) reduced from 6 pastel colors to **3 bright**: yellow `#FFE600`, green `#22FF66`, red `#FF2E2E`. This is the per-word cycling highlight seen in the preview. |
| 1b | **Template accent map → 3 bright colors** | `TEMPLATE_ACCENT_COLOR_MAP` (`SidebarTemplateGallery20.jsx`) now collapses every legacy color name (gold/rose/cyan/purple/orange/blue/pink…) onto the same 3 bright values, so applied-template accents are never pale. Warm→yellow, green/cyan/blue→green, red/rose/pink/purple→red. |
| 2 | **Editable text box on template captions** | `VideoPlayer.jsx` caption overlay: template (sidebar) captions now show the same selectable/hover purple border as normal captions, use `pointerEvents:auto`, and are double-click editable (the existing `handleCaptionDoubleClick` → `isEditing` → contentEditable path already worked; it just had no visible affordance). Dragging/resizing/delete remain disabled for templates on purpose, to avoid shifting template layout. |
| 3 | **Upload MIME fix** | `backend/main.py` upload handler: browsers send `application/octet-stream` for some videos; the extension check is now authoritative and that generic type is no longer rejected ("Failed to process video"). |
| 4 | **Export word spacing** | `scripts/render_template_overlay.mjs` — added `column-gap: 0.28em` to `.lekha-sidebar-export-template-shell .wbw`, `.wbw-line`, `.sw-line`. Root cause: flex containers drop whitespace text nodes between word spans, causing Devanagari words to touch. Mirrors the preview fix in `VideoPlayer.jsx` `APPLIED_TEMPLATE_HOST_OVERRIDES`. |
| 5 | **Export hero word recolor** | `scripts/render_template_overlay.mjs` — added `getComputedStyle`-based hero-recolor IIFE inside `activateSidebarTemplateShells()`. Detects bold tier (≥18% font-size gap or ≥700 weight with ≥200 gap from minimum), moves `emphasisAccent` from `.is-emphasis` to the hero words, resets `.is-emphasis` to `captionTextColor`. Mirrors `recolorEmphasisToHero()` from `VideoPlayer.jsx`. |

**Did NOT touch:** template structure, typography, animation timing, the apply
pipeline, or `renderAppliedSidebarTemplateCaption`. Only color *values* and the
caption-box interaction affordance changed.

---

#### Follow-up fixes (same session)

| # | Symptom | Root cause | Fix |
|---|---------|-----------|-----|
| 4 | **Emphasized word disappears mid-playback** leaving a "void"/gap between words in the line; the word reappears when the video is paused; export is fine. | The emphasized word is the only word that runs through `wbwAnimImp` (`AppliedSidebarTemplateSourceRenderer` in `VideoPlayer.jsx`). On **pause**, `settleWBWWord` sets `word.style.animation = 'none'` — but during **playback** `wbwAnimImp` never cleared the CSS `animation`, so the `imp-`/`ns2-`/`ns3-` class's CSS keyframe overrode the JS inline `opacity:1` reveal and the word stayed invisible. Export is unaffected because export renders via the backend ASS path, not this animation. | Added `word.style.animation = 'none'` at the start of `wbwAnimImp` so the JS-driven reveal (opacity/transform/clip) is authoritative during playback — identical to what the pause/settle path already does. |
| 5 | **Template caption not editable on canvas like a normal caption** | Sidebar-template captions had the selection border, hover border, pointer events and group-hover all gated behind `!isSidebarTemplate`; the inner container was `pointerEvents:none`. The double-click→edit path (`handleCaptionDoubleClick` → `isEditing` → contentEditable) was always shared and never template-guarded — it just had no visible affordance. | In the caption overlay (`VideoPlayer.jsx` ~line 6013): template captions now show the same purple selection/hover border, use `pointerEvents:auto`, and are double-click editable. Drag/resize/delete remain disabled for templates on purpose (would shift template layout). **Note:** this could only be verified after the backend was brought back up — earlier "Failed to fetch" was the backend process being down, so no template state could be reached to test. |

---

### Session 12 — 2026-04-21

**Theme:** Production hardening — P0/P1 security, race conditions, and event-loop blocking

**Scope:** No new features. Security and reliability fixes only across `backend/main.py`, `backend/processor.py`, `backend/.env`.

---

#### Fixes — `backend/main.py`

| # | Issue | Fix |
|---|-------|-----|
| P0 | **Missing `subprocess` import** — `upload_video` and `detect_language` would crash immediately at runtime with `NameError` | Added `import subprocess` to stdlib imports |
| P0 | **Auth bypass in `process_video` and `detect_language`** — when `verify_token()` failed AND Firestore was unavailable, 401 was silently swallowed | Removed the `get_db() is not None` guard; now always raises 401 if token verification fails and `DEV_MODE=false` |
| P0 | **Auth bypass in `export_video`** — same conditional guard pattern | Restructured: `decoded_token` → `uid` or `is_dev_token` → `uid="dev-local-user"` else `raise 401` |
| P0 | **Export limit race condition** — two concurrent requests from same user both passed the 5/day check before either deducted | Added `_user_export_locks` dict + `_get_user_export_lock(uid)`. Entire check→render→deduct block wrapped in `try/finally` with per-user `asyncio.Lock` |
| P1 | **Blocking promo expiry reset** — `user_ref.update(...)` inside async export handler blocked event loop | Wrapped in `_loop.run_in_executor` |
| P1 | **Blocking Firestore in `verify_payment`** — `user_ref.get()`, `_topup_batch.commit()`, `_sub_batch.commit()` all synchronous in an `async def` | All three wrapped with `await _vp_loop.run_in_executor(None, ...)` |
| P1 | **Blocking Firestore in `redeem_promo`** — four synchronous Firestore calls blocked the event loop | All four wrapped with `await _promo_loop.run_in_executor(None, ...)` |
| P1 | **No style input validation** — `style: Dict[str, Any]` passed straight to ASS generation with no bounds checking | Added `ExportRequest.validated_style()` method: clamps 11 known numeric fields to safe ranges, whitelists `quality` string; export handler now calls `req.validated_style()` instead of `req.style` |

#### Fixes — `backend/processor.py`

| # | Issue | Fix |
|---|-------|-----|
| P1 | **Blocking `subprocess.run` in `burn_only`** — main FFmpeg call (5–30s) ran synchronously inside an `async def`, saturating the event loop | Added `import asyncio`; FFmpeg call now `await asyncio.get_running_loop().run_in_executor(None, lambda: subprocess.run(...))` |

#### Fixes — `backend/.env`

| # | Issue | Fix |
|---|-------|-----|
| P0 | **`CREDITS_HMAC_SECRET` hardcoded and committed** — anyone with repo access could forge credit signatures | Removed value; replaced with generation command comment. **Must generate a fresh secret before deploying.** |

---

### Session 11 — 2026-04-16

**Theme:** Core business logic hardening — edge cases, crash bugs, and data integrity fixes

**Scope:** No new features. Bug fixes only across `processor.py`, `main.py`, `ExportPanel.jsx`.

---

#### Fixes — `backend/processor.py`

| Bug | Fix |
|-----|-----|
| **`_wxy()` KeyError on missing layout keys** | Changed `lyt['x']` / `lyt['y']` to `lyt.get('x', 50)` / `lyt.get('y', 75)`. Malformed or partial word layout dicts no longer crash export. |
| **`_lyt2` empty-dict false negative** | Both inner-loop `_lyt2` checks upgraded from `if not _lyt2` to `if not _lyt2 or 'x' not in _lyt2 or 'y' not in _lyt2`. An empty dict `{}` is truthy, so the old check passed and `_wxy` would crash with KeyError. |
| **Unguarded `float()` on word timing values** | Wrapped `_fts = float(words_timing[0].get('start', st))` and the per-word `_ws2`/`_we2` float conversions in `try/except (ValueError, TypeError)`. A bad timing string (e.g. `"auto"`) now falls back to the caption start/end instead of crashing. |

#### Fixes — `backend/main.py`

| Bug | Fix |
|-----|-----|
| **Empty captions array silently exported** | Added `if not captions or not any(c.get('text','').strip() for c in captions): raise HTTPException(400, ...)` immediately after `captions = [c.dict() for c in req.captions]`. Prevents burning an empty subtitle track and wasting a credit. |
| **Rate limit window off-by-one** | Changed `ts > (now - 86400)` to `ts >= (now - 86400)`. The old check excluded an export made exactly 24h ago, allowing a user to slightly exceed their 5-per-day limit. |

#### Fixes — `src/components/dashboard/ExportPanel.jsx`

| Bug | Fix |
|-----|-----|
| **Unknown `template_id` silently fell back with no log** | Changed `TEMPLATE_CANONICAL_STYLES[_tid] \|\| {}` to also call `console.warn(...)` when `_tid` is non-empty but not found in the map. Makes typos and renamed IDs visible in browser devtools without changing export behavior. |

#### Additional fixes found via pending-list audit

| File | Bug | Fix |
|------|-----|-----|
| `backend/processor.py` | **`te_py` text-element default was 50, not 75** | `cs.get('position_y', 50)` → `cs.get('position_y', 75)`. Text-tab boxes with no explicit position were landing at vertical center instead of 75% like the global caption default. |
| `backend/processor.py` | **Duplicate `positioned` list construction** | The legacy path re-builds `positioned` even though a shared pre-build exists at ~line 1237. Full consolidation is unsafe (the loop also builds `inline_parts`). Added a sync-warning comment so future edits to the detection logic don't diverge between the two paths. |
| `CLAUDE.md` | **3 Session 5 known-fixes never added to Known Fixed Bugs table** | Added `\|\|` vs `??` for shadow numerics, `needs_per_word_glow` Layer-0 suppression, and `TextBg` ASS style for text element backgrounds — all were fixed in Session 5 but marked "(pending)" and never recorded. |

---

### Session 9 — 2026-04-16

**Theme:** Data layer performance audit + security vulnerability fixes (auth bypass + credits tampering)

**Scope:** No new features. Backend-only. Two security CVEs fixed, seven performance issues fixed.

---

#### Security — `main.py`

**Vulnerability 1 — `mock-token` auth bypass (all 3 endpoints)**

| Fix | Detail |
|-----|--------|
| **`DEV_MODE` env guard on dev bypass** | `is_dev_token = not req.id_token or req.id_token == 'mock-token'` was always true on any server. Changed to `is_dev_token = DEV_MODE and (...)`. On production (`DEV_MODE` unset), empty or `mock-token` id_token now gets a 401. Applied to `/api/process`, `/api/export`, `/api/detect-language`. |
| **`DEV_MODE` env var added** | `DEV_MODE=false` added to `backend/.env`. Set `DEV_MODE=true` in local `.env` only. |

**Vulnerability 2 — Backend blindly trusted `credits_remaining` from Firestore**

An authenticated user could write `credits_remaining: 99999` directly to their Firestore document via the Firebase client SDK (if security rules were permissive), and the backend would use that value without question.

| Fix | Detail |
|-----|--------|
| **`_sign_credits(uid, credits)`** | HMAC-SHA256 over `"{uid}:{credits}"` using `CREDITS_HMAC_SECRET`. Returns `""` when secret not configured (graceful degradation). |
| **`_verify_credits(uid, user_data)`** | Reads `credits_remaining`, verifies `credits_sig`. Returns `(credits, tampered)`. Non-numeric value → tampered. Signature mismatch → tampered. Missing signature (legacy user) → trusted + logged (self-heals on next write). |
| **Export blocks on tamper** | `export_video` calls `_verify_credits`; if `tampered=True` → 403. |
| **Payment resets base on tamper** | `verify_payment` calls `_verify_credits`; if `tampered=True` → resets base credits to 0 before adding purchased credits (payment still processes). |
| **All credit writes now include `credits_sig`** | Auto-create user doc, export deduction, topup batch, subscription update batch, subscription new-user batch, promo redeem — every write now co-writes `credits_sig: _sign_credits(uid, new_value)`. |
| **`CREDITS_HMAC_SECRET` env var generated** | 32-byte random hex secret generated and written to `backend/.env`. |
| **`backend/.env` created** | New file with `CREDITS_HMAC_SECRET`, `DEV_MODE=false`, and stubs for all other env vars. Already covered by `.gitignore`. |

---

#### Performance — `processor.py`

| Fix | Detail |
|-----|--------|
| **N+1 font downloads eliminated** | Added `self._font_cache: dict = {}` to `VideoProcessor.__init__`. `_ensure_font` checks cache on entry and stores result before returning. A 100-caption export with 3 unique fonts goes from up to 1,500 potential HTTP calls down to 3. |

#### Performance — `main.py`

| Fix | Detail |
|-----|--------|
| **Rate limiter memory leak fixed** | `_check_rate` now caps each key's timestamp list at `limit + 5` entries. Every 1,000 calls a sweep evicts keys with no activity in the last window. Prevents unbounded dict growth from attack traffic. |
| **Janitor uses `os.scandir`** | Replaced `os.listdir` (materialises full name list) with `with os.scandir(...) as it:` (lazy iterator, reuses OS-provided stat). Applied to both `UPLOAD_DIR` and `EXPORT_DIR` loops. |
| **Sync Firestore unblocks event loop** | `export_video` is `async def` but called sync Firestore SDK methods, blocking the event loop for 100–500 ms per request. The three Firestore calls (`user_ref.get`, `user_ref.set`, `user_ref.update`) are now wrapped in `await loop.run_in_executor(None, ...)`. |
| **Payment writes are now atomic** | `verify_payment` previously did two separate Firestore writes (user doc + payments subcollection). A crash between them left credits granted with no audit record. Both paths (topup + subscription) now use `db.batch()` — committed atomically. |

---

**Files Modified:**
- `backend/main.py` — DEV_MODE guard, _sign_credits, _verify_credits, _verify_credits in export + payment, credits_sig on all writes, rate limiter cap + sweep, scandir janitor, run_in_executor Firestore, atomic batch payments
- `backend/processor.py` — _font_cache in __init__, cache check + store in _ensure_font
- `backend/.env` — created (CREDITS_HMAC_SECRET, DEV_MODE=false, env stubs)

---

### Session 8 — 2026-04-15

**Theme:** Full error handling audit and hardening — backend + frontend

**Scope:** No new features. Pure error handling pass: every silent failure, bare except, empty catch, and crash-on-bad-input found and fixed.

---

#### Backend — `processor.py`

| Fix | Detail |
|-----|--------|
| **Mock captions no longer fake success** | When Whisper/Sarvam API fails, `generate_captions_only` was returning `{"success": True, "captions": mock_data}` — user got garbage captions with no error. Changed to `{"success": False, "error": "...", "captions": mock, "is_mock": True}`. |
| **`_ensure_font` raises if font missing after all fallbacks** | After primary download fails and Inter fallback also fails, code previously silently returned `info` for a nonexistent file — FFmpeg would then fail with a cryptic error. Now raises `RuntimeError` immediately with the missing path. |
| **`burn_only` output-not-found is now an error** | When FFmpeg exits 0 but the output file doesn't exist, changed from `print("[FFmpeg] WARNING...")` to `return {"success": False, "error": ...}` — export route now correctly fails. |
| **Temp audio cleanup logs failures** | `except Exception: pass` → logs with file path so disk/permission issues are visible. |
| **Duration ffprobe in mock path logs failure** | `except Exception: pass` → logs so we can see why duration detection failed. |
| **`_get_video_dimensions` bare except** | Now logs file path and exception before returning 1080×1920 fallback. |
| **`_get_rotation` bare except** | Now logs file path and exception. |
| **ASS debug readback bare except** | Now logs the error instead of silently skipping. |
| **Hex color parse bare except** | `_color_to_ass`: logs the bad hex value instead of silent return. |

#### Backend — `main.py`

| Fix | Detail |
|-----|--------|
| **`/api/detect-language` FFmpeg returncode** | Added `if ffmpeg_result.returncode != 0: raise RuntimeError(stderr)` — previously a failed audio extraction would pass an empty/broken file to Whisper. |
| **`/api/detect-language` temp file cleanup** | `os.remove` not wrapped — now wrapped in try/except with logging. |
| **Firebase Storage local delete** | `except Exception: pass` → logs failure so disk issues don't disappear silently. |
| **Subscription expiry date parse** | `except Exception: pass` → `except (ValueError, TypeError) as e: print(...)` — only catches parse errors, not broad exceptions. |

#### Frontend — `src/pages/Login.jsx`

| Fix | Detail |
|-----|--------|
| **Auth errors now visible to user** | `catch (error) { console.error(...) }` with no UI feedback. Added `loginError` state + red error banner rendered below the card header. Button shows `disabled` + `opacity-60` while `isLoggingIn` is true to prevent double-submit. |

#### Frontend — `src/components/dashboard/ExportPanel.jsx`

| Fix | Detail |
|-----|--------|
| **Null `video_url` guard** | Added explicit check: `if (!downloadUrl) throw new Error('Server did not return a download URL...')` before calling `fetch(downloadUrl)`. |
| **Network error during export** | Changed `try { fetch } finally { clearInterval }` to `try { fetch } catch (networkErr) { clearInterval; throw descriptive error }` — progress bar now resets properly on network failure and user gets a clear message. |

#### Frontend — `src/components/dashboard/WordClickPopup.jsx`

| Fix | Detail |
|-----|--------|
| **AbortController on font list fetch** | useEffect now creates an `AbortController`, passes `signal` to fetch, and aborts on unmount. `AbortError` is silently swallowed; other errors are logged. Prevents React "setState on unmounted component" warning. |
| **Empty font preview catch** | `.catch(() => {})` → logs with font name. |

#### Frontend — `src/pages/Dashboard.jsx`

| Fix | Detail |
|-----|--------|
| **Template font empty catch** | `.catch(() => {})` → logs with font family name. |
| **Style font useEffect empty catch** | `.catch(() => {})` → logs with font family name. |

#### Frontend — `src/components/dashboard/StyleControls.jsx`

| Fix | Detail |
|-----|--------|
| **`/api/fonts` fetch** | Added `if (!res.ok) throw new Error(...)` before parsing JSON. |
| **Three empty font load catches** | FontRow dropdown preview, script font auto-load, font selector onSelect — all now log with font name instead of silent `() => {}`. |

#### Frontend — `src/components/dashboard/VideoPlayer.jsx`

| Fix | Detail |
|-----|--------|
| **Hex parse `catch { return hex }`** | Changed to `catch (e) { console.warn(...); return hex }` — logs invalid hex values so color bugs are detectable. |
| **`onVideoLoaded` callback** | Wrapped in try/catch — a throwing callback no longer crashes `handleLoadedMetadata`. |

#### Frontend — `src/components/dashboard/fontUtils.jsx`

| Fix | Detail |
|-----|--------|
| **`autoLoadFontForText` return type** | All return paths now include `error: null` or `error: message` field so callers can distinguish a successful load from a silent fallback to `sans-serif`. |

---

**Files Modified:**
- `backend/processor.py` — mock captions, _ensure_font, burn_only, _get_video_dimensions, _get_rotation, temp cleanup, hex parse, ASS debug
- `backend/main.py` — detect-language FFmpeg check, temp cleanup, Firebase delete, date parse
- `src/pages/Login.jsx` — loginError state + UI, isLoggingIn guard
- `src/components/dashboard/ExportPanel.jsx` — null video_url guard, network error handling
- `src/components/dashboard/WordClickPopup.jsx` — AbortController, font catch logging
- `src/pages/Dashboard.jsx` — font catch logging (×2)
- `src/components/dashboard/StyleControls.jsx` — res.ok check, font catch logging (×3)
- `src/components/dashboard/VideoPlayer.jsx` — hex catch logging, onVideoLoaded try/catch
- `src/components/dashboard/fontUtils.jsx` — error field in return values

---

### Session 7 — 2026-04-13

**Theme:** Security hardening audit

*(See git commit `2582bb1` for full details)*

---

### Session 6 — 2026-04-12

**Theme:** Display modes, word drag UX, FPS export, animation system unification

**Phases completed (3 rounds of user feedback):**

---

#### Phase 1 — New Features

| Area | What Was Built |
|------|---------------|
| **"2 Line Sentence" display mode** | Added third option to Display Mode dropdown in StyleControls. Applies `whiteSpace: 'normal'` + `maxWidth: '28ch'` to allow natural word wrapping into ~2 lines. Applied to all 3 rendering paths in VideoPlayer (editor path, template path, custom path). |
| **FPS selector in Export tab** | Added pill button group (24 / 30 / 60 fps) above Video Export section in ExportPanel. State: `exportFps`, default 30. Sends `fps: exportFps` in export payload. Backend ExportRequest model updated: `fps: int = 30`. Processor extracts fps, validates to `{24, 30, 60}`, passes `-r {fps}` flag to FFmpeg output. |
| **Advanced Animation section** | Added Zoom (In/Out), Transition (Fade In, Slide Up/Down/Left/Right), and Camera Movements section + speed slider to StyleControls. (Superseded in Phase 3 — see below.) |

---

#### Phase 2 — Bug Fixes

| Bug | Fix |
|-----|-----|
| **Word drag hid other words** | `hasOffset` flag: words with any `x/y/x_pct/y_pct` offset bypass timing-based show_inactive hide logic — they always render regardless of word_by_word timing. |
| **Word drag auto-switch** | When user drags a word, the sentence auto-switches to `display_mode: 'word_by_word'` with `show_inactive: false` so the rest of the sentence plays out sequentially. Dragged word is never hidden thanks to `hasOffset` check. |
| **BG layer too tall** | Reduced vertical padding in VideoPlayer background box from full `2 * padding` to `2 * Math.round(padding * 0.4)` — both top offset and height calculation — for a tighter, less intrusive background. |
| **Advanced animation displacing captions** | Root cause: animation was applied to the outer absolutely-positioned div which uses `transform: translate(-50%, -50%)` for centering — CSS animation overrides this and displaces the caption. Fix: removed `getAdvancedAnimationStyle` entirely; zoom/transition now use standard `caption.animation` + `getAnimationStyle` framework. |
| **Camera movements not functioning** | Attempted `both` fill mode with static keyframe transforms — not frame-driven so movement wasn't visible. Resolved in Phase 3 by removing camera movements entirely per user request. |

---

#### Phase 3 — UI Reorganization

| Change | Detail |
|--------|--------|
| **Removed camera movements** | Entire camera movement UI section removed from StyleControls Advanced Animation. Camera movement keyframes (`adv-pan-left/right/up/down`, `adv-ken-burns`) removed from VideoPlayer. |
| **Removed Advanced Animation section from StyleControls** | Entire section (zoom selector, transition selector, speed slider) removed. `advAnimOpen` state removed. |
| **Moved zoom + transition to AnimateTab → Basic** | 7 new animations added at top of Basic category: `zoom_in`, `zoom_out`, `fade_in`, `slide_up`, `slide_down`, `slide_left`, `slide_right`. Animation counter updated: 34 → 44. |
| **Removed "Caption Enter Animation" section from AnimateTab** | Separate Zoom/Transition/Speed controls section removed; functionality now covered by Basic animations. `captionStyle` / `setCaptionStyle` props removed from AnimateTab and Dashboard. |
| **VideoPlayer animation defs updated** | 7 new entries added to `getAnimationStyle` defs mapping to `adv-*` keyframes at 400ms duration. |

---

**Architecture — Animation System After Session 6:**
- **All animations** (including zoom/transition) are stored in `caption.animation` per-caption
- `getAnimationStyle` in VideoPlayer maps animation name → CSS animation definition
- No global `captionStyle.adv_zoom` / `captionStyle.adv_transition` fields — those are gone
- Export: zoom/transition animations are CSS-only (preview) — exported video uses ASS word-timing, not keyframes

**Files Modified:**
- `src/components/dashboard/StyleControls.jsx` — 2-line mode + whiteSpace/maxWidth; removed Advanced Animation section
- `src/components/dashboard/VideoPlayer.jsx` — hasOffset word visibility; reduced bg padding; added 7 animation defs; removed getAdvancedAnimationStyle; removed camera keyframes
- `src/components/dashboard/AnimateTab.jsx` — 7 new Basic animations; updated counter; removed Caption Enter Animation section; simplified props
- `src/pages/Dashboard.jsx` — removed captionStyle/setCaptionStyle props from AnimateTab
- `src/components/dashboard/ExportPanel.jsx` — FPS state + pill UI + payload
- `backend/main.py` — ExportRequest.fps field
- `backend/processor.py` — fps extraction + FFmpeg `-r` flag

---

### Session 5 — 2026-04-02

**Theme:** Export pipeline fixes — template fidelity, glow/shadow bugs, text element backgrounds, "Failed to fetch" error

**Completed:**

| Area | What Was Fixed |
|------|---------------|
| **"Export failed: Failed to fetch"** | Vite dev server (port 5000) was not running — no proxy existed for `/api`. Fixed by starting `npm run dev` in worktree. Both services now running: backend port 8000, frontend port 5000. |
| **All shadow/glow templates rendering wrong** | Root cause: `shadow_offset_x \|\| 0`, `shadow_offset_y \|\| 2`, `shadow_blur \|\| 4` in `ExportPanel.jsx` — when a template sets these to `0`, `0 \|\| default` silently overwrote them. Neon templates got y_offset=2 (directional shadow) instead of 0 (glow). Fixed: changed all 4 instances to `??` (nullish coalescing). |
| **Green glow on ALL words** | `global_eff` (glow ASS tags) was unconditionally appended to Layer 0 — all words glowed. Should only apply to active word in Layer 2 karaoke. Fixed in `processor.py`: added `needs_per_word_glow` flag; Layer 0 suppresses glow when per-word glow is active; Layer 2 applies glow only to active word, resets on inactive words. |
| **t-9 Fire / t-12 Horror lost ALL glow** | Over-broad fix suppressed Layer-0 glow whenever `secondary_hex` was present + `is_glow_shadow`. But these templates set `secondary == primary` for uniform global glow. Fixed: `needs_per_word_glow` now also checks `secondary != primary`. |
| **Text element backgrounds not rendering** | ASS `BorderStyle=3` (opaque background box) is a Style-header property — can't be overridden inline. Added second ASS Style `TextBg` with `BorderStyle=3` in header when any text element needs a background. Text element Dialogue lines reference `TextBg` style instead of `Default`. |

**Key Rule Learned — `||` vs `??` for style numerics:**
Always use `??` for any numeric style property that can legitimately be `0`:
- `shadow_blur`, `shadow_offset_x`, `shadow_offset_y`
- `background_padding`, `background_h_multiplier`, `position_y`, `position_x`
Using `||` silently replaces `0` with the default, breaking all templates that zero out a property.

**ASS Glow Logic Summary:**
- `shadow_offset_x=0` AND `shadow_offset_y=0` → **Neon/glow** effect (use `\bord\3c\blur\shad0`)
- Either offset non-zero → **Drop shadow** (use `\shad` with offsets)
- `secondary_color != primary_color` + glow → **Per-word karaoke glow** (Layer 2 only)
- `secondary_color == primary_color` + glow → **Global uniform glow** (Layer 0)

**Files Modified:**
- `src/components/dashboard/ExportPanel.jsx` — `||` → `??` for shadow_blur, shadow_offset_x, shadow_offset_y (global caption style + text element custom_style)
- `backend/processor.py` — `is_glow_shadow` + `needs_per_word_glow` detection; Layer-0 glow suppression; per-word active/inactive glow in Layer 2; `TextBg` ASS style definition for text element backgrounds

**Added to Known Fixed Bugs in CLAUDE.md:** (pending — should be added)
- `||` vs `??` for shadow numerics in ExportPanel.jsx
- Per-word glow suppression on Layer 0 (`needs_per_word_glow` in processor.py)
- TextBg ASS style for text element backgrounds (processor.py)

---

### Session 4 — 2026-04-01

**Theme:** Style/template propagation fixes, animation keyframes, Caption Display mode (word-by-word vs sentence)

**Completed:**

| Area | What Was Fixed |
|------|---------------|
| `VideoPlayer.jsx` — template path | Fixed word timing: was reading `caption.start/end`, now correctly reads `caption.start_time/end_time` — template word highlighting was broken |
| `VideoPlayer.jsx` — template path | Unfroze hardcoded `fontSize: '24px'` → reads `captionStyle.font_size` |
| `VideoPlayer.jsx` — template path | Added full inline style block: `lineHeight`, `fontWeight`, `fontStyle`, `textAlign`, `letterSpacing`, `wordSpacing`, `textTransform`, `animation` — all were missing |
| `VideoPlayer.jsx` — non-template path | Added `letterSpacing` and `wordSpacing` that were previously hardcoded to `'normal'` |
| `VideoPlayer.jsx` — non-template path | Added word-by-word IIFE wrapper: respects `captionStyle.show_inactive === false` to hide future words |
| `captionTemplates.css` | Added all missing `@keyframes` and `.animate-*` classes for 12 standard + 21 advanced animations — animate tab was silently no-oping |
| `StyleControls.jsx` | Added "Caption Display" toggle in Typography section: **Sentence** / **Word by Word** buttons; writes `show_inactive: true/false` to captionStyle; active state uses gold `#F5A623` |

**Architecture Notes:**
- `show_inactive` field: `false` = word-by-word (hide future words), `true`/`undefined` = sentence (show all at once)
- `wordSpacing` formula: `(word_spacing - 1) * 4` px — default `word_spacing=1` → `0px` extra
- Template rendering applies CSS class (`t-XXX`) + CSS variables + full inline style on wrapper → word spans get `.word`, `.active`, `.current`, `.done` classes
- Non-template rendering: inline style applied per-caption-block; words split from `caption.text`
- Backend (`processor.py`) already handles `show_inactive=False` → per-word ASS Dialogue entries; `letter_spacing` → ASS Style Spacing field — no backend changes needed
- Export payload (`ExportPanel.jsx`) already sends all style fields — no changes needed

**Files Modified:**
- `src/components/dashboard/VideoPlayer.jsx`
- `src/components/dashboard/StyleControls.jsx`
- `src/styles/captionTemplates.css`

---

## Session Log

---

### Session 3 — 2026-03-19

**Theme:** Locked pricing structure, Razorpay payment flow, brand gold rebrand (partial)

**Files Modified:**

| File | What Changed |
|------|-------------|
| `backend/main.py` | Full `PLAN_PRICING` dict (6 subscription + 3 topup plans); `create-order` topup tier validation; `verify-payment` split into topup/subscription branches; `VerifyPaymentRequest.plan_id`; `ALLOWED_EXTENSIONS` module-level; Content-Length pre-check; `_upload_rate` eviction; single `os.stat()` in janitor; APScheduler made optional with `_simple_janitor_loop` asyncio fallback; all `from datetime import` consolidated to top |
| `backend/firebase_admin_setup.py` | `firebase_admin.storage` optional import (try/except → `fb_storage = None`); `from datetime import timedelta` moved to module top; `get_storage_bucket()` checks `fb_storage is None` |
| `backend/requirements.txt` | Added: `python-dotenv`, `firebase-admin`, `requests`, `sarvamai` |
| `src/components/landing/PricingSection.jsx` | Locked prices (monthlyInrPrice / yearlyInrPrice); Monthly/Yearly billing toggle (replaced India/International); `planId` with `_yearly` suffix; `plan_id` passed to verify-payment; yearly note shows `₹X billed yearly · ~17% off` |
| `src/components/dashboard/PricingModal.jsx` | Locked prices; Pro credits = 100; `TOPUP_MAP` + `TOPUP_PAISE` constants; `handleTopup()` function fully implemented; `planId` with `_yearly` suffix; yearly badge → -17%; removed 100ms artificial delay |
| `src/Layout.jsx` | Plus Jakarta Sans font added; brand CSS variables: `--brand-primary #1B4D3E`, `--brand-accent #2ECC9A`, `--brand-warm #F5A623`, `--brand-cta #2ECC9A`, `--brand-cta-text #0A3D2C` |
| `src/components/dashboard/UploadModal.jsx` | All purple → `#2ECC9A` brand colors; 39 new languages added |
| `src/pages/Dashboard.jsx` | Empty state icon + "Start Creating" button → `#2ECC9A`; generating loader icon + dots → `#2ECC9A` |
| `src/components/landing/HeroSection.jsx` | Dark theme (`bg-[#0a0a0a]`); stat updated: "2 Transcription Engines" → "120–180s Shorts & Reels Sweet Spot"; `text-[#2ECC9A]` accents |
| `src/components/landing/FeaturesSection.jsx` | Dark theme (`bg-[#0f0f0f]`); cards `bg-zinc-900 border border-white/10`; "Every Regional Language" feature card added |
| `src/components/landing/Footer.jsx` | Dark theme; "Lekha Captions" branding; "Built for every language, every creator 🌍" |
| 14 files (brand swap) | Green (`#2ECC9A`, `#1B4D3E`, `#0A3D2C`, `#27b889`) → Gold (`#F5A623`, `#0A0A0A`, `#000000`, `#D4891A`) — committed in `6c79368` |

**Key Architecture Decisions:**
- `plan_id` is echoed: returned from `create-order`, sent back in `verify-payment` body — avoids amount-matching ambiguity
- Yearly plan IDs use `_yearly` suffix (`starter_yearly`, `creator_yearly`, `pro_yearly`)
- Top-up validation: `create-order` checks user's `subscription_tier` (strip `_yearly`) must match `allowed_tier` in plan
- `is_topup: True` flag in `PLAN_PRICING` distinguishes top-ups from subscriptions

**Commits on branch `claude/stoic-moore`:**
- `a2b63d8` — brand overhaul, security hardening, 115+ languages
- `6c79368` — locked pricing, Razorpay, monthly/yearly billing, top-ups

**Still broken / not started this session:**
- Razorpay demo fallback (checkout doesn't open locally without real backend creds)
- Effects / Emphasis button
- Styling tab width
- UserAccount + SidebarNav plan tier updates
- Timeline speech track background gold stripe
- Gradient gold buttons (flat gold only, not gradient yet)

---

### Session 2 — (prior to first /compact)

**Theme:** Backend stability, export fixes, NotoSans fonts

**Completed:**
- Firebase auth hardcoded bypass removed from `backend/main.py`
- Razorpay + APScheduler imports made optional (backend starts without them)
- Backend running confirmed on port 8000 via `preview_start("backend")`
- "Failed to process video: Failed to fetch" — root cause: backend not running. Fixed.
- `has_background` in export: changed from `!== false` to `!!` (`ExportPanel.jsx`)
- `template_id` / `secondary_color` now included in export style payload (`ExportPanel.jsx`)
- Auto-center hook: `useEffect` on `captionStyle.font_family` triggers font load (`Dashboard.jsx`)
- `NotoSans` entry added to `GOOGLE_FONTS_MAP` (`processor.py`)
- `NotoSansDevanagari` ass_name changed to `'Noto Sans Devanagari'` to avoid collision (`processor.py`)
- Duplicate `import json` removed from `main.py`

---

### Session 1 — (initial worktree setup)

**Theme:** Core bug fixes on stoic-moore worktree

**Completed:**
- Template hard reset: `handleApplyTemplate` now resets `TEMPLATE_OWNED_RESET` props before merging — Template B never inherits bg/color/font from Template A (`Dashboard.jsx`)
- Indic y-correction: `INDIC_Y_CORRECTIONS` dict in fallback ASS path corrects vertical center for Devanagari/Indic scripts (`processor.py`)
- Font selection gate: `onSelect` in StyleControls calls `updateStyle` immediately, not gated on font load success (`StyleControls.jsx`)
- Background Thickness H display: changed from `1.1x` to `(multiplier-1)*100 px` format; default -1.00px (`StyleControls.jsx`)
- `has_background` in export: `!!` not `!== false` (`ExportPanel.jsx`)
- Noto Sans Latin: added `NotoSans` entry in `GOOGLE_FONTS_MAP`; fixed ass_name collision (`processor.py`)

---

### Session 7 — 2026-04-15

**Theme:** Security hardening — full audit and fix across backend + frontend

**What was done:**

Full security review of the codebase was requested. 15 issues found and categorised by severity. All high/medium issues fixed in the same session. Changes committed to both `main` branch and `claude/stoic-moore` worktree.

---

#### Fixes Applied (10 total across 6 files)

| # | Severity | Issue | Fix | Files |
|---|---|---|---|---|
| 1 | Critical | Hardcoded Razorpay test key `rzp_test_RJWsOLmZ6GL27m` in 3 frontend files and backend default | Removed all hardcoded fallbacks; backend defaults to `""`; frontend uses `VITE_RAZORPAY_KEY_ID` env var or `orderData.key_id` from backend response | `main.py`, `RazorpayPayment.jsx`, `PricingModal.jsx`, `PricingSection.jsx` |
| 2 | High | CORS wildcard default (`"*"`) with `allow_credentials=True`; `allow_methods=["*"]`; `allow_headers=["*"]` | Default now `localhost:3000/5000` only; explicit `allow_methods=["GET","POST"]`; explicit `allow_headers=["Content-Type","Authorization"]` | `main.py` |
| 3 | High | Path traversal in all 3 file-lookup loops — `startswith(file_id)` with no UUID validation | Added `_validate_file_id()` (UUID check) + `_safe_find_upload()` (realpath containment check); all 3 loops replaced | `main.py` |
| 4 | High | `/api/process` and `/api/detect-language` had no auth check — any caller could trigger paid API calls | Added `id_token` field to both request models; same dev-mode bypass pattern as `/api/export` | `main.py` |
| 5 | High | Export rate limit (5/24h) was commented out with a TODO | Uncommented — re-enabled | `main.py` |
| 6 | Medium | No rate limiting on `create-order`, `verify-payment`, `redeem-promo` — allowed brute-force of promo codes and payment signatures | Added `_check_rate()` helper; payment endpoints: 10/hour/IP; promo: 5/hour/IP | `main.py` |
| 7 | Medium | `/api/debug/last-ass` publicly accessible, leaking server filesystem path in response | Gated behind `DEBUG_MODE` env var; removed `"path"` from response | `main.py` |
| 8 | Medium | `/api/delete-file` used substring match (`req.file_id in f`) — could delete other users' exports | Replaced with exact filename match (`export_{file_id}.mp4`) + UUID validation + `realpath` containment check | `main.py` |
| 9 | Medium | `tempfile.mktemp()` (deprecated, TOCTOU race) used in processor + detect-language used user-controlled `file_id` in temp path | Replaced with `NamedTemporaryFile(delete=False)` in both places | `main.py`, `processor.py` |
| 10 | Low | Vite dev server bound to `0.0.0.0` with `allowedHosts: true` | Changed to `host: 'localhost'`; `allowedHosts: ['localhost', '127.0.0.1']` | `vite.config.js` |

---

#### Issues noted but not fixed (require design decisions or new dependencies)

| Issue | Reason not fixed |
|---|---|
| File upload: no magic-byte validation (only extension checked) | Requires `python-magic` dependency; not added to keep scope minimal |
| `style: Dict[str, Any]` in `ExportRequest` accepts arbitrary unvalidated data | Requires new typed Pydantic `StyleModel` — large schema change, risk of breaking export |
| No auth on `/api/fonts` | Low risk; public font list. Intentionally left as-is |

---

**Commits:**
- `main` branch: `806da78` — 6 files changed
- `claude/stoic-moore` worktree: `2582bb1` — same fixes included

**Env vars required before production deploy:**
- `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` — backend `.env`
- `VITE_RAZORPAY_KEY_ID` — frontend `.env`
- `ALLOWED_ORIGINS` — comma-separated list of allowed frontend domains (e.g. `https://app.lekha.in`)
- `DEBUG_MODE` — set only in development if you need `/api/debug/last-ass`

---

### Session 10 — 2026-04-16

**Theme:** Dead code cleanup — unused deps, dead imports, test scripts, log file hygiene

**Scope:** No logic changes. Pure housekeeping across frontend, backend, and repo config.

---

#### Changes Made

**`package.json` — Removed 13 unused npm dependencies**

| Package | Reason removed |
|---------|----------------|
| `@react-oauth/google` | No imports in `src/` |
| `@stripe/react-stripe-js` | No Stripe usage in codebase |
| `@stripe/stripe-js` | No Stripe usage in codebase |
| `canvas-confetti` | Label exists but package never imported |
| `date-fns` | No imports in `src/` |
| `html2canvas` | No imports in `src/` |
| `jspdf` | No imports in `src/` |
| `lodash` | No imports in `src/` |
| `moment` | Appears only in template name strings, not imported |
| `react-leaflet` | No imports in `src/` |
| `react-markdown` | No imports in `src/` |
| `recharts` | Only referenced in `chart.jsx` which is never imported |
| `three` | Appears as template name string, not imported |
| `baseline-browser-mapping` (devDep) | No imports anywhere |

**`backend/main.py` — Removed 2 unused imports**
- `import subprocess` — only used in `processor.py`, not `main.py`
- `import math` — imported but no `math.*` calls in file

**Deleted 3 backend test/debug scripts**
- `backend/test2.py` — SarvamAI help-text scratch file
- `backend/test_export.py` — hardcoded test data script
- `backend/debug_export.py` — debug async function

**`.gitignore` — Added log file patterns**
- Added `*.log`, `backend/*.log`, and explicit codex/vite log filenames
- Prevents `codex-backend.{err,out}.log`, `codex-frontend.{err,out}.log`, `uvicorn.log`, `vite.log` from being tracked

---

**Files changed:** `package.json`, `backend/main.py`, `.gitignore`
**Files deleted:** `backend/test2.py`, `backend/test_export.py`, `backend/debug_export.py`

---

### Session 11 — 2026-06-09

**Theme:** Pricing refresh, processing-screen rewrite, security/production-readiness pass, and a deep fix for applied-template caption rendering (highlight motion + word spacing).

---

#### 1. Pricing update (monthly raised, yearly added)

New plan prices — **must stay in sync across all three locations** (the backend is the source of truth for the charged amount; the frontend only displays):

| Plan | Monthly | Yearly (= 10× monthly, 2 months free ≈ −17%) | USD/mo | USD/yr |
|------|---------|-----------|--------|--------|
| Starter | ₹299 | ₹2,990 | $3.99 | $39.99 |
| Creator | ₹399 | ₹3,990 | $4.99 | $49.99 |
| Pro | ₹499 | ₹4,990 | $5.99 | $59.99 |

- `src/components/dashboard/PricingModal.jsx` — in-app upgrade modal `plans[]`; also fixed a display bug (yearly showed the annual total labeled `/mo` → now `/yr`).
- `src/components/landing/PricingSection.jsx` — landing `plans[]` (INR + USD); badge corrected `-20%` → `-17%` to match the real discount.
- `backend/main.py` `PLAN_PRICING` — `inr_paise`/`usd_cents` for all 6 plan keys. New amounts are all unique, so the amount→plan reconciliation (`_resolve_plan_from_amount_currency`) cannot collide.

#### 2. Processing screen recreated (`src/pages/Dashboard.jsx`, `renderGeneratingState`)

- Heading "Lekha Captions is working…" → **"Crafting your captions"**; subtitle rewritten.
- Step list rewritten to describe the real pipeline; **removed "Preparing emoji suggestions"**, replaced with "Syncing word-level timing": *Transcribing your audio → Syncing word-level timing → Highlighting key moments → Rendering your preview*.

#### 3. Security / production-readiness (`backend/main.py`)

- **BLOCKER fixed — payment plan spoofing.** `verify_payment` trusted the client-echoed `plan_id` to grant tier/credits and never checked it against the amount actually paid → pay for Starter (₹299), echo `plan_id:"pro"`, receive Pro/100 credits. Added a central amount↔plan binding in `_apply_successful_payment` (asserts paid minor units == plan's `usd_cents`/`inr_paise` for the currency, logs `payment_amount_plan_mismatch`). Covers client-verify, webhook, and reconcile paths.
- **Require Redis in production.** Rate limiting + payment idempotency already had Redis with in-memory fallback, but nothing forced Redis in prod → multi-instance deploys silently used per-instance state (bypassable). Added a boot guard: `ENV=production` + no reachable Redis raises at startup, unless `ALLOW_INMEMORY_STATE=1` (escape hatch for deliberate single-instance).
- **Streaming upload.** `upload_video` read the whole file (up to 500 MB) into RAM via `await file.read()` → memory-pressure DoS under concurrency. Switched to 1 MB chunked streaming to disk, enforcing the size cap mid-stream (oversized/content-length-spoofed bodies abort early; Windows-safe cleanup).
- Verdict given to user: ship-ready **after** the payment fix; in-memory state + upload buffering were scaling concerns, now closed.

#### 4. Applied-template caption rendering (`src/components/dashboard/VideoPlayer.jsx`) — the main debugging arc

Context: left/sidebar templates render through the in-page `AppliedSidebarTemplateSourceRenderer` (host class `lekha-applied-template-host`, `data-applied-template-animated="true"`). It is a JS reimplementation of the gallery card's animation, driven by `play()`/`pause()` via `runnerRef`. Block types: **wbw** (`.wbw`/`.wbw-line`, words `.w`/`.wbw-word`), **pos/sticky** (`.sw`/`.sw-w`), **plain** (`.plain-s` text nodes + a bare `<span class="is-emphasis">`).

- **Highlight "void" during playback — attempted CSS fix, then REVERTED.** First broadened the force-visible safety rule (`APPLIED_TEMPLATE_HOST_OVERRIDES`) to also force `.sw`/`.sb.active .sw-w` to `opacity:1 !important`. This **flattened the intentional dimmed-context look** (`.sw-w` context words sit at `opacity:0.14`; only the active word reveals) → applied caption stopped matching the gallery card. **Reverted to the exact original rule.** LESSON: never force-override opacity across all word classes in the applied host — the `.sb` vs `.sblock` selector split encodes per-template-type intent.
- **Real fix — "highlighted words not moving in some lines."** Root cause: `enterBlock` only animated `wbw` and `pos` blocks; **`plain` blocks got no animation** → their highlighted word was static. Added an additive plain-block path: `plainImpInit` / `animatePlain` (rise+fade the `.plain-s .is-emphasis` span on play) / `resetPlain` (phase prep) / `settlePlainWord` (always lands visible on pause/seek — no void), wired into `enterBlock`, `resetBlock`, and `pause()`. Scoped to `.plain-s .is-emphasis` only → wbw/pos templates untouched. (Caveat: plain emphasis carries no motion hint in the applied markup, so it uses a default rise+fade; can be mapped per-template if an exact card motion is needed.)
- **Touching words (no space between Devanagari words in some lines).** Cause: each line path joins word spans with a literal space (`.join(' ')`), but **flex/grid line containers drop whitespace-only text nodes**, leaving only `margin-inline-end:0.12em` → words touch. (Touching ⟹ the line is flex, since non-flex lines keep the join-space.) Added `column-gap:0.28em` to flow-line containers (`.wbw`, `.wbw-line`, `.sw-line`, `.lekha-sidebar-source-line`) — restores spacing on flex lines, inert on non-flex lines (no over-spacing elsewhere).
- **Selection frame for templated captions** (user-requested parity with normal captions). Removed the `!isSidebarTemplate` gate at the drag-enable, delete-button, and resize-handles spots (plus added the `cursor-move` class) so a selected templated caption shows the bordered box + 8 handles + delete (X) and can be moved. These handlers act on caption position / the captions array only — template word rendering is untouched. (Horizontal move/resize is constrained by the template's full-width centered layout, which was deliberately not changed.)
- **Hero word recolor — preview** (`recolorEmphasisToHero(block)` in `VideoPlayer.jsx`). The accent colour was landing on the `.is-emphasis` word even when the template's visually dominant word is a different, bolder/larger one. Added a `getComputedStyle`-based detector: a "bold tier" exists if some word's font-size is ≥18% larger than the smallest, or its font-weight is ≥700 with a ≥200 gap. If found, the accent colour moves from `.is-emphasis` to the hero word(s); `.is-emphasis` resets to the caption text colour. Wired into `enterBlock` (double-rAF, after layout) and `pause()`.

#### 5. Export-side parity fixes (`scripts/render_template_overlay.mjs`)

The Puppeteer export renderer for templated captions had the same two rendering bugs as the preview — fixed identically so exported frames match the canvas:

- **Fix: Export word spacing.** Added `column-gap: 0.28em` to `.lekha-sidebar-export-template-shell .wbw`, `.wbw-line`, `.sw-line`. Root cause: flex containers drop whitespace text nodes — same as the preview fix.
- **Fix: Export hero word recolor.** Added a `getComputedStyle`-based hero-recolor IIFE in `activateSidebarTemplateShells()`, after the existing `.is-emphasis` color loop. Detects the bold tier (≥18% font-size gap, or ≥700 weight with ≥200 gap), resets `.is-emphasis` to `captionTextColor`, and applies `emphasisAccent` to the hero elements. Mirrors `recolorEmphasisToHero()` from `VideoPlayer.jsx`.

---

**Files changed:** `src/components/dashboard/PricingModal.jsx`, `src/components/landing/PricingSection.jsx`, `backend/main.py`, `src/pages/Dashboard.jsx`, `src/components/dashboard/VideoPlayer.jsx`, `scripts/render_template_overlay.mjs`

**Verification notes:** Pricing confirmed live on the landing page (monthly + yearly). `backend/main.py` import-checked with new `PLAN_PRICING`. `VideoPlayer.jsx` esbuild-parses clean after each change. The template playback/animation changes must be visually confirmed in a **real browser** — the automated preview throttles video so the mid-playback states (void, plain-block motion) can't be reproduced there.

**Env var added:** `ALLOW_INMEMORY_STATE` (default off) — set to `1` only to run a deliberate single-instance production deploy without Redis.

---

### Session 12 — 2026-06-09

**Theme:** Full preview ↔ export parity audit for applied left-side (69-set) templates. Line-by-line comparison of `VideoPlayer.jsx` (`APPLIED_TEMPLATE_HOST_OVERRIDES` + `AppliedSidebarTemplateSourceRenderer`) vs `scripts/render_template_overlay.mjs` (export shell CSS + `activateSidebarTemplateShells()`). Every gap fixed toward the preview as reference (the preview is what the user approves visually).

#### Export-side gaps fixed (`scripts/render_template_overlay.mjs`)

1. **`.plain-s` flex hijack.** The page-level rule `.cap-text, .plain-s, .wbw-rise, .wbw-slide { display:inline-flex; … line-height:1.2 }` (written for plain captions + right-side originals) leaked into sidebar shells. inline-flex drops the whitespace text nodes around the `.is-emphasis` span (→ emphasis word touches neighbours in export) and 1.2 squeezed the source line-heights (1.55/1.7). Scoped the `.plain-s/.wbw-rise/.wbw-slide` selectors under `.lekha-original-template`; shells now use the template source's own text flow — same as preview.
2. **Per-word colour/weight flatten removed.** The activate function force-set `font-weight` + `color` (`!important`) on every injected word. The preview resolves these via inheritance + the template's class CSS — the force flattened dimmed-context alphas (e.g. rgba(255,255,255,0.5) support rows) and bold hero tiers (e.g. `.pr.hero` 900/#39ff14), and made the weight-based hero-recolor detection impossible in export (all weights equal). Removed; the shell now mirrors the preview host's inline style instead (added `color`, `font-style`, `line-height`, `opacity` to the shell builder — `font-family`/`font-weight` were already there).
3. **Hero demote now matches preview.** When the bold-tier recolor fires, preview *removes* `is-emphasis` (word falls back to its source imp-class colour); export was forcing `captionTextColor !important` onto it. Export now removes the class + clears the inline accent (and the inline `font-size/line-height/vertical-align` it had set), exactly like `recolorEmphasisToHero`.
4. **lekha-49 timing.** Export used legacy timing (65ms stagger, 280/440ms durations) for both sources; preview uses `EMOTIONAL_TEMPLATE_TIMING` for lekha-49 (280ms stagger, 380/540ms durations, 240ms positioned stagger). Export now branches on `isNewTemplateSet` with values interpolated from the same config modules. Sticky word anim also aligned: 240ms `ease` → 300ms (`positionedWordDurationMs`) with the preview's cubic-bezier.
5. **Clipping parity.** Shell + `.stage` `overflow:hidden` → `visible` (preview never crops — Devanagari matras/descenders and entrance motion paint freely); `.card`/`.lk-card` + stage get `padding:0 !important; margin:0 !important` like the preview host overrides.

#### Preview-side sync (`src/components/dashboard/VideoPlayer.jsx`)

- Font-family override for positioned containers: explicit `.pos1…pos31c` list → `[class^='pos'], [class*=' pos']` (the export already used the attribute form; list form would silently miss any pos class not enumerated).
- Hide-rule additions `.lk-lbl, .stage-lbl, .lk-phase-chip` (export already hid them; inert if absent from markup).

#### Guard script updated (`scripts/check-template-motion-parity.mjs`)

The script previously asserted the per-word colour/weight force as a feature ("words can still inherit thin source weights/low-alpha colors"). That contract is inverted now: the checks fail if the force *re-appears*, and require the shell to mirror the preview host inline `color`/`line-height`. Rationale recorded in the script.

#### Known intentional divergences (documented, not "fixed")

- **Mid-entrance mechanics differ by design:** preview uses JS transitions + a force-visible CSS rule during playback (anti-void, session 11); export uses CSS keyframes seeked via `Animation.currentTime`. Settled frames match; the per-word reveal order/timing now matches; the in-flight easing of clip/transform may differ subtly per frame.
- **lekha-49 positioned (`.sw`) rows:** export preserves the source CSS animations (re-based via `animationDelay`); preview replaces them with generic JS motions. Left as-is — both land on the same settled frame.

**Files changed:** `scripts/render_template_overlay.mjs`, `src/components/dashboard/VideoPlayer.jsx`, `scripts/check-template-motion-parity.mjs`, `DEVELOPMENT_LOG.md` (also retro-filled Session 11 with the two export-side fixes + preview hero-recolor entry).

---

### Session 15 — 2026-06-18

**Theme:** Right-side advanced template export parity — preview and MP4 now match

Right-side Styling templates could look correct in the dashboard preview but
export with tiny captions, missing first lines, or missing emphasis highlights.
The misleading part was that some fixes appeared ineffective because the backend
could still return a stale cached MP4.

**Durable fix summary**

- `ExportPanel.jsx` now measures the largest visible advanced template host and
  sends preview box width and height with the export request.
- `render_template_overlay.mjs` now scales advanced templates to that preview
  box target, preserves line-slot structure, filters hidden slots, and rebuilds
  `.is-emphasis` spans so export matches preview line-for-line.
- Advanced export seeking now forces active blocks visible before frame capture,
  which prevents first-line loss on templates like `Literary Echo`.
- `templateMotionConfig.js` and `VideoPlayer.jsx` now share the faster advanced
  timing path so the effect pacing stays closer to speech.
- `backend/main.py` now bypasses stale render-cache reuse for template exports,
  appends a cache-bust token to signed export URLs, serves exported media with
  `Cache-Control: no-store`, and bumped renderer version to
  `2026-06-18-advanced-template-size-parity-v18`.

**How to recognize it again**

- Preview looks right but only exported MP4 is tiny or missing the first line.
- Backend debug snapshot shows `preview_template_box_width_px: 0` for a right-side
  template.
- Renderer log prints `target_box=auto` for an advanced template export.
- Re-export keeps producing the same wrong result even after code changes.

**Fast verification**

- `npm run test:template-parity`
- `npm run build`
- `python -m unittest backend.tests.test_api_contracts -v`
- Confirm advanced export renderer logs a real target box, not `auto`

### Session 16 - 2026-06-18

**Theme:** `Startup Hustle` dull line traced to a motion mismatch

One `Startup Hustle` line could still look washed out even after the white-color
overrides because the fourth block was not actually using the same motion family
everywhere. The source fallback map treated it as `WBW SLIDE`, but the original
template preview/export path still rendered it as `wbw-seq-fade`, which keeps a
fade-style word reveal and can make a line look dim mid-playback.

**Durable fix summary**

- `VideoPlayer.jsx` now renders `t13-b3` with `wbw-slide` instead of
  `wbw-seq-fade`.
- `render_template_overlay.mjs` mirrors that same `t13-b3` motion change for
  exported video renders.
- `templateMotionConfig.js` now advertises the fourth `Startup Hustle` block as
  `WBW SLIDE`, matching the actual runtime behavior.

**How to recognize it again**

- Only `Startup Hustle` still looks faded while similar right-side templates are
  already bright white.
- The issue is most visible on the fourth block/line while the selected word is
  fine but the rest of the line feels greyed or dull.
- Preview and export both show the same washed-out line, which points to motion
  logic rather than export-only sizing/parity.

**Fast verification**

- `npm run lint`
- `npm run build`
- In the dashboard, apply `Startup Hustle` and watch the fourth block: the line
  should stay bright instead of fading through a muted state.

### Session 17 — 2026-07-29

**Theme:** Word-editor reopen, dragged-word export, template reset

Three reports about per-word editing: the floating word editor would not reopen
on a word that had been dragged, dragged words did not move in the exported
video, and templates were expected to clear previous drags.

**Durable fix summary**

- `VideoPlayer.jsx` `shouldRevealSequentially()` no longer derives word-by-word
  reveal from `captionHasDetachedWords()`. Dragging one word used to switch the
  whole caption to word-by-word reveal, so during playback the dragged word was
  removed from the DOM until its spoken moment and could not be clicked to
  reopen the editor. Sequential reveal is now driven only by the explicit
  display-mode setting (`show_inactive === false`), which is what StyleControls
  writes.
- `processor.py` now renders a detached word ONLY at its dragged position.
  Previously the word-layout path, the template karaoke fallback, and the
  highlight karaoke path all still drew it inside the sentence line, so it
  appeared twice — once at the original spot, once at the dragged spot. A shared
  `detached_wi` set blanks that slot in every line. The per-word timing window is
  still emitted (skipping it blanked the whole sentence for that word's slot).
- `processor.py` `_is_detached_pos()` mirrors the editor's `isWordDetached()`:
  `abs_x_pct/abs_y_pct` of 0,0 means "position reset", not "dragged to the
  top-left corner". Applied in the template, legacy, and text-element paths.
- `Dashboard.jsx` "Reset Position" now DELETES the position keys instead of
  writing zeros, so a reset word is not exported to the corner.
- `ExportPanel.jsx` `patchWordStyles()` treats zeroed offsets as "no drag", and
  recreated advanced templates (`RECREATED_ADVANCED_TEMPLATE_IDS`) now send a
  geometry-only subset of `word_styles` instead of `{}` — drags survive export
  while the authored per-word look is still left to the template.
- `main.py` `EXPORT_RENDERER_VERSION` → `2026-07-29-dragged-word-export-parity-v36`
  so cached renders do not mask the fix.

**Already working (verified, no change needed)**

- Applying a template clears previous drags — `handleApplyTemplate` runs
  `stripDetachedWordLayout()` over every caption's `wordStyles`. Confirmed live:
  a word dragged to 64.6%/55% returned to static flow after applying a template.
- Reopening the editor on an *edited* (not dragged) word works, including when
  emphasis makes the glyphs wider than the click box — the absolutely positioned
  visual span is still hit-testable outside its wrapper.

**How to recognize it again**

- A dragged word disappears from the canvas as soon as playback starts, or the
  word editor will not reopen on it: check `shouldRevealSequentially()`.
- A dragged word shows TWICE in the exported MP4: a sentence line still contains
  its slot; check the `detached_wi` blanking.
- A word jumps to the top-left corner of the export after "Reset Position":
  something stored `abs_x_pct: 0, abs_y_pct: 0` instead of deleting the keys.

**Fast verification**

- `python -m unittest backend.tests.test_api_contracts backend.tests.test_preview_export_parity` (75 tests OK)
- `npm run lint`, `npm run test:template-parity`, `npm run test:template-export`
- `VITE_API_BASE_URL=http://localhost:8000 npm run build`
  (a bare `npm run build` fails on the env gate — that is pre-existing)

### Session 18 — 2026-07-30

**Theme:** The CPT still did not export — a translate that the browser ignored

The dragged-word export fix from Session 17 set the right offsets and every
automated check passed, yet the exported MP4 still showed the caption in its
original flat line. Frames pulled from the user's own 18:39 export confirmed it:
correct template, correct emphasis colour, zero displacement.

**Root cause**

`applySourceTemplateWordStyles()` in `render_template_overlay.mjs` applies a word
drag by setting the `translate` property on the word's managed visual span. That
span is created by `getSourceTemplateVisualTargets()` with no display styling, so
it is `display: inline` — and CSS transforms do not apply to non-replaced inline
boxes. The property was set with the correct value and the browser discarded it.
The preview escapes this because `prepareSourceTemplateWordNode()` in
`VideoPlayer.jsx` forces `inline-block`; the export renderer had no equivalent.

Both regression checks were blind to it because they only asserted the
*computed value* of `translate`, never that the word moved.

**Durable fix summary**

- `render_template_overlay.mjs` `ensureTransformableWordTarget()` upgrades an
  inline position target to `inline-block` before applying an offset. It runs
  only when an offset is actually applied, so words carrying just font/colour
  overrides keep their current export layout.
- The position audit now measures the offset the browser *honours*: it drops the
  translate, re-measures, restores it, and reports `effective_dx`/`effective_dy`
  plus `target_display` and `word_opacity`.
- `check-template-export-parity.mjs` and `check-dragged-word-export-parity.mjs`
  assert the honoured offset, not the declared one. Verified as a negative
  control: with the fix disabled the suite fails with
  `set translate 36px -64px ... but the word only moved 0px/0px (display=inline)`.
- CPT word-by-word reveal: displacing a word now makes the caption build up word
  by word until the sentence completes, in preview and export.
  `captionHasCptWords()` + `isCptWordPending()` (VideoPlayer.jsx) hide pending
  words with `opacity: 0` while keeping them MOUNTED — unmounting is what broke
  reopening the word editor in Session 17, so `shouldRevealSequentially()` is
  untouched. `render_template_overlay.mjs` mirrors it, and frame segmentation
  now adds word-boundary sample points for reveal-driven captions (without them
  a plain caption with no per-word timings collapsed to one static frame and the
  CPT appeared fully formed).
- `EXPORT_RENDERER_VERSION` → `2026-07-30-cpt-transformable-word-box-v39`.
- Yearly is now the default on the fourth pricing surface,
  `landing-next/app/pricing/page.js` (a static server component with no toggle):
  it headlines the annual price with the monthly rate as the secondary line.
  `check-pricing-yearly-default.mjs` now guards all four surfaces.
- `check-template-motion-parity.mjs` asserted a `positionedWords` string that an
  earlier uncommitted change had already deleted. The guard now asserts the
  `export-positioned-word` overlay never comes back, and the dead CSS rule it
  left behind is removed.

**How to recognize it again**

- A dragged word exports at its original spot while the audit shows the correct
  `applied_translate`: check `target_display` — an inline box silently discards
  transforms.
- A CPT appears fully formed on its first frame in the export: the caption
  probably produced a single static segment; check the reveal sample points.

**Known failure NOT addressed (pre-existing)**

`npm run test:template-export:lc` fails on `left-all-lekha-lc-t167-p3`:
`incomplete final template frame ... expected=[every,template,must,render]
rendered=[every,template,must]` — the final frame drops the last word. Verified
pre-existing by reconstructing this session's files without any of the changes
above; it still fails. It is an LC reveal-completeness bug, unrelated to word
drags, and the exhaustive LC scope was not swept for further cases.

**Fast verification**

- `npm run lint`, `VITE_API_BASE_URL=http://localhost:8000 npm run build`
- `npm run test:contracts` (includes dragged-word export + pricing defaults)
- `npm run test:template-export` (46 phases), `npm run test:template-parity`
- `python -m unittest backend.tests.test_api_contracts backend.tests.test_preview_export_parity` (63 tests OK)

### Session 19 — 2026-09-02

**Theme:** Mass-public-launch gates, external-style security review, and legal
readiness hardening

- Added immutable frontend/backend release verification, dual-resolver DNS and
  API synthetic monitoring, realistic authenticated media-capacity tooling,
  mass-launch/release runbooks, hashed Python dependencies, immutable GitHub
  Actions, cross-browser Playwright/axe gates, and complete marketing legal
  routes.
- Remediated public-page accessibility findings across Chromium, Firefox,
  WebKit, Pixel 7, and iPhone 15 profiles. The full 55-case suite produced 48
  passes before a new grievance-link contrast issue was found; all ten affected
  home/privacy cases then passed after the link received a persistent underline.
- Completed an external-style AI technical review. npm and Python dependency
  audits found no known vulnerabilities. Bandit now reports no Medium/High issue;
  the private Railway worker's platform-required readiness bind has a narrow
  documented suppression.
- Narrowed frontend `connect-src` from every HTTPS origin to the Lekha API and
  explicit Firebase/Google, Razorpay, Sentry, and reCAPTCHA providers. A release
  contract prevents the broad policy from returning.
- Added deployment-required legal business, venue, grievance-officer, and
  grievance-email fields to both frontend builds. Public policies now describe
  complaint timing, consent withdrawal, privacy rights/escalation, applicable
  taxes, total payable amount, one-time purchase terms, and invoice handling.
- Recorded the AI security and India legal/tax reviews without misrepresenting
  them as accredited pentest, lawyer, or CA certificates.
- Verification: 194 release contracts, frontend lint/typecheck/build and
  performance budgets, Next.js marketing build, Bandit Medium/High gate, all
  affected browser/device tests, npm audit, pip-audit, backend tests, and the
  complete template matrix.
- The first hosted run exposed Ubuntu runner Chromium namespace restrictions.
  Test browsers now use `--no-sandbox` only when both GitHub's `CI=true` and the
  explicit workflow-only `PUPPETEER_CI_NO_SANDBOX=1` flag are present; production
  continues to reject the general sandbox-disable switch.

**Deployment condition**

Production still runs a different backend commit and the frontend has no release
marker. Direct deployment was intentionally not performed because the hosting
environment does not expose the newly required real grievance/legal identity
variables and GitHub CLI is not authenticated. Deploy only one committed SHA
after those public values are supplied and hosted CI passes.

## 2026-09-11 — Google Cloud staging backend rollout

- Deployed tested backend release `6d5f530d9acf4a2432f82a16574a5d58a306a3ac`
  to the existing API and worker VMs; retained previous containers for rollback.
- Started a separate transcription consumer on the existing worker VM, capped
  export/transcription resources, and isolated staging transcription from the
  production outbox. Persisted runtime version 9 and startup/image metadata.
- Verified API and both workers ready, empty queues, normal HTTPS from the VM,
  and a successful 10-second 720p sample render in 4.29 seconds. The release had
  167 passing backend tests and a successful immutable Cloud Build.
- Verified Redis noeviction/hourly snapshots, restricted IAP SSH, and existing
  Cloud Run frontend autoscaling. API/worker VM autoscaling remains absent.
- Public Netlify/Railway traffic is unchanged. Live-payment configuration,
  spending bounds for scalable infrastructure, and end-to-end/load acceptance
  remain critical launch gates. See `docs/GCP_DEPLOYMENT_2026-09-11.md`.


## 2026-10-03 — Netlify editor cutover configuration

Added `netlify.toml` for the editor: guarded Vite build, SPA route fallback, existing hosting security/cache headers, and the R2 upload host in CSP connect-src. The deployed editor previously blocked R2 multipart PUT requests through its CSP. Railway API now passes readiness with IPv4 ingress; owner-approved Redis migration to Singapore succeeded. PR #19 merged after all 26 checks passed. The post-apply IaC plan has no additions/deletions or Redis relocation, but still reports three restart-policy null-to-ON_FAILURE differences even though the live dashboard displays On Failure. API custom-domain attachment is blocked: the new account dashboard says Not available. Advanced DNS has stale api/app hosting A records. All 17 Railway shared variables are populated and the workspace hard cap remains $15. Verified the Netlify TOML, SPA fallback, R2 connect-src and frame protection; production Vite build/performance budgets passed. No existing secrets rotated.


## 2026-10-04 — Netlify/Railway routing, idle traffic and editor recovery

- Repointed the existing apex and www DNS records to Netlify; app remains on Netlify and api on the new Railway project. Removed the four obsolete Google Cloud certificate-validation CNAMEs. Mail DNS remains intact. Corrected the Netlify editor VITE_EDITOR_URL setting; frontend rebuild remains pending.
- Fixed restored-project autosave so opening a draft performs no cloud write. Actual content edits still autosave, with real revision conflicts retained. Project saves no longer inherit another project's revision. Added real editor regression coverage for opening, editing, conflict protection, account isolation and expired paid-plan controls.
- A signed-in synthetic video completed upload, scan and transcription on Railway. Initial export was correctly denied for the expired plan. After the owner purchased Starter, the 720p render persisted in R2 and validated as an 8.192-second H.264/AAC 720x1280 MP4. Browser download exposed a separate bug: API App Check/tracing headers followed the signed-media redirect to R2 and caused a rejected CORS preflight. Signed-media fetches now omit API-only headers; authenticated API calls and media signature validation remain enforced. Live download recheck awaits redeployment.
- Network logs showed Redis keepalives and Chromium's GCM push channel keeping idle services active. API response completion/startup and worker drain completion now release unused Redis sockets; checked-out concurrent commands remain connected. The renderer disables background networking, sync, notifications and GCM while preserving Chromium sandbox policy and warm-browser reuse. Wake/drain, multipart upload and cron designs are unchanged.
- Verification: 324 backend tests passed (20 subtests); all 339 release readiness checks, frontend contracts/security/lint/typecheck/build/performance budgets passed; isolated editor journey and warm-browser reuse/rendering passed. Local full-suite wake tests briefly timed out during concurrent load; isolated and final full runs passed. No new resources or secret rotations. Production redeploy and platform Sleeping verification remain pending.


## 2026-10-04 — R2 browser download redirect origin

PR #21 merged after all 26 hosted checks passed; all four Railway services and both existing Netlify sites deployed commit c41416e. Opening the restored editor no longer triggers a revision conflict. Live browser tracing found a second download issue: the API-to-R2 redirect makes the storage request Origin null, so R2 correctly omits CORS permission. Authenticated export-result responses now return a direct, 15-minute R2 download_url scoped to the verified job owner. The frontend fetches it without API credentials or custom headers. Signing failures return a retryable 503; existing signed media routes, restricted bucket CORS, wake/drain, multipart and cron behavior stay intact. Verification: 325 backend tests and 20 subtests passed; all 339 release checks, build and performance budgets passed; the isolated editor journey verifies the original editor Origin, no API headers, and download without a new render. Hosted CI and production redeployment remain pending.


### 2026-10-04 — Railway worker idle follow-up

Live control-plane inspection confirmed that the API sleeps, while both workers remained active. RQ 2.9 creates a separate scheduler Redis pool in the parent process; stopping the scheduler child does not close this parent pool. `backend/worker.py` now disconnects that lazily-created pool after each burst, including failure, without opening a pool during cleanup. Main-thread drain, authenticated POST /wake, scheduled retries and cron design stay unchanged.

Production Chromium continued GCM and other background traffic despite background networking flags. `scripts/render_browser_runtime.mjs` now blocks external hostname resolution only when mandatory packaged rendering fonts are enabled; loopback DevTools access remains available. Development remote-font rendering is unchanged. The warm-browser integration check verifies external resolution fails, isolated contexts remain reusable and caption frames still render in the production image.

Validation: backend suite 326 passed with 22 subtests after one Windows loopback reset on the first attempt; isolated Chromium checks confirmed inline rendering and external-host rejection. Hosted image/integration checks, release gates, merge and production sleep verification remain pending. No cloud resources, credentials, CORS, upload protocol, or cron changes.


## 2026-10-04 — Bounded Railway render scaling preparation

The owner requested faster rendering and selected a maximum of three replicas. Updated the existing production render limit via Railway CLI to 4 vCPU / 4 GiB; no new service, region or volume. Prepared matching IaC plus render-only enqueue-triggered scale-up and cron idle-only scale-down to one replica. Unique replica leases, private DNS wake fan-out and atomic burst/resize exclusion preserve main-thread drains and protect active renders. Transcription remains one replica. No API polling loop was added.

Verification: final backend suite 342 passed and 25 subtests; release checks passed with all 339 readiness assertions; targeted Bandit medium/high scan passed. One full rerun encountered the existing Windows loopback socket reset; the final complete rerun passed. Hosted CI and live scaling acceptance remain pending. A dedicated production-environment project token needs approval before creation and exposure only to API/cron; the owner's CLI credential will not be copied into production. Browser shows the old expired account, while CLI accesses the correct project. Existing $15 hard cap remains.


### 2026-10-04 — Production scaling token acceptance

The owner approved a production-scoped project token; created it in the correct Railway account and saved it privately in the gitignored deployment environment and Railway shared variables without deployment. Read-only token access succeeds. Live testing found Railway rejects Python urllib’s default User-Agent with HTTP 403 while an explicit LekhaCaptions/1.0 client identifier succeeds; the controller now supplies that identifier. All 13 hosted PR checks passed before this client-header correction; rerunning affected verification and CI before activation. Live replica scaling and idle reduction remain pending.


### 2026-10-04 — Render resize live pilot and shutdown safety follow-up

PR #24 merged and deployed. The finite three-job live pilot exposed a resize
replacement: two jobs finished, but the old deployment stopped its running
first job with no configured shutdown grace. The abandoned RQ started entry
then blocked idle reduction. Autoscaling was disabled in API and cron; existing
services, media, credentials and the $15 hard cap remain. Configured replicas
were reset to one while Sleeping, but the existing deployment still reported
three instances; configuration alone is not runtime evidence.

Prepared render shutdown grace of 1860 seconds, effective-deployment validation
before resizing, atomic global admission capped at three drains across old/new
deployment overlap, and normal RQ expired-job recovery in the existing cron
pass. Main-thread RQ drain, private wake authentication, R2 uploads and cron
schedule are preserved. Safety regression tests cover replacement admission,
expired seats, pending deployments, missing effective grace, abandoned-job
failure and retry, and preservation of live RQ entries. Full checks and live
shutdown/sleep acceptance remain pending; do not re-enable the controller yet.


## 2026-10-04 — Editor apex-domain cutover

The owner requested removing app. from the public editor address. Prepared Netlify rewrites for all registered editor routes and their assets under lekhacaptions.com, while preserving the static homepage and marketing/legal pages. Old app-domain bookmarks redirect to the corresponding apex path with query strings retained. Login preview handoff and marketing app links now use the apex. R2 preflight already permits the apex; Railway API currently permits only the app origin and needs a scoped origin update. Production build, CI and live verification remain pending. No resources or credentials are created.

## 2026-10-05 — PR #28 verification and remaining launch fixes

- Checked out PR #28 head `ff6bb19` without reimplementing its export/process/payment thread offloading, background worker wake/scaling, bounded Redis records, polling caches, retry/TTL changes or resident scanner. All 26 latest hosted checks passed, including both template-export runs and release gates; no failed job remained to rerun.
- Documented all requested environment variables, restricted quality-gates push triggers to main while preserving PR and release-gate coverage, and updated release contracts for Docker's clamd + worker startup. Localhost CLAMAV_HOST is confined to the transcription target/service.
- Analytics summaries and SLO/feature-flag reads use FastAPI's thread pool. Analytics telemetry/rate limiting, scheduler authorization, janitor cleanup, payment reconciliation and Redis scheduler leases run off the event loop. Added HTTP-level thread regression tests. Token cache now enforces the stated 60-second maximum even if configured higher.
- Railway API now has two Uvicorn processes and 2 vCPU/2 GiB; background loops remain disabled, render/transcription ceilings remain five. Owner must verify live peak memory including fallback scanning.
- Scanner fallback regression tests now run real subprocess verdicts portably on Windows and Linux. The full suite passed: **383 tests plus 29 subtests**. `npm ci`, `npm run release:check` (342 readiness assertions, contracts/browser checks, lint, typecheck, build, performance budgets) and Bandit Medium/High gate passed. One Windows loopback connection failure disappeared on the full rerun; no test was disabled.
- No infrastructure was applied and no load was sent to production. Added an executable staging runbook, pending measurement tables and owner checklist. The existing benchmark DOM fixture is not an authored animated template; the smoke tool's direct upload mode targets GCS, so Railway commands explicitly use proxy and require separate browser R2 acceptance. Work ratios remain unchanged pending measurements.
- Remaining: staging measurements, owner billing/deployment/end-to-end/autoscaling checks, and separate B7 code-health PRs. Existing untracked files were preserved.

## 2026-10-05 — B7 separate router cleanup

- Moved the upload handler to `backend/upload_api.py`, process/transcription handler and worker helpers to `backend/processing_api.py`, and provider-health admin route to `backend/provider_admin_api.py`. Existing admin routes already live in `admin_api.py`. Main keeps public aliases and the same RQ import paths; helpers resolve dynamically through host so existing patches/shared state continue to work.
- `main.py` shrank by about 580 lines. Full OpenAPI schema compared identical before/after, including operation IDs and request/response models. Verification: 383 backend tests plus 29 subtests, npm ci/release:check and Bandit Medium/High gate. Separate from the runtime changes in PR #30.
- Remaining B7: stateless VideoPlayer/browser-runtime module split and unused committed artifact cleanup, each in separate follow-ups. Staging measurement and owner launch checklist remain pending.

## 2026-10-05 — B7 separate rendering module cleanup

- Extracted `buildRuntimeScript` and its constants into `scripts/render_template_page_runtime.mjs`; overlay entry point shrank by about 2,930 lines. Compared the generated browser JavaScript before/after: byte-identical for empty and authored markup fixtures.
- Moved eight stateless player styling/text helpers into `videoPlayerTemplateRendering.jsx`; VideoPlayer shrank by about 230 lines. Scope analysis verified they capture no player component state. Existing source contracts now read both renderer modules, preserving every assertion.
- Verification: npm ci/release:check, 383 backend tests plus 29 subtests, Bandit Medium/High gate, motion checks and visual audit (70 cards/278 phases) passed. Full export parity matrix is running; hosted release-gate must pass before merge.
- This is a separate behavior-preserving PR stacked on the router split. Unused artifact cleanup and owner staging measurements remain pending.

## 2026-10-05 — B7 separate unused-artifact cleanup

- Searched source, scripts, backend, docs and workflows before removal. Removed the two root landing-concept ZIPs, unused `build_mudra_project_report.py`, `old_templates.txt` and 16 committed screenshots under `attached_assets` (20 files). The only attached_assets reference was an ESLint ignore, not a runtime use. Git history retains these artifacts; existing untracked screenshots/local files were untouched.
- No application behavior changed. Full backend tests, Bandit Medium/High gate and npm ci/release:check in an isolated checkout passed. Rendering export matrix and hosted gates continue separately.
- Updated TODO: B7 source cleanup complete. Remaining launch work is the owner checklist and measured Railway staging acceptance, not speculative ratio changes or infrastructure deployment.

## 2026-10-05 — Railway R2 staging load-tool compatibility

- The staging smoke tool only understood a GCS upload_url response, while Railway returns signed S3/R2 multipart metadata and rejects proxy uploads in production. Added the R2 path to direct mode and changed the 10/100-user runbook commands accordingly.
- Parts use signed exact lengths; only API calls receive Firebase/App Check headers. A dropped PUT response re-signs and retries the same part number before completion. Wrong signed sizes and permanent storage rejections fail without completing an incomplete upload. Existing GCS recovery/completion behavior is preserved.
- Four added regression tests cover successful parts/credential isolation, dropped response recovery, permanent rejection, and signed-size mismatch. Full backend suite now passes 387 tests plus 29 subtests; Bandit Medium/High and clean npm ci/release:check passed in an isolated checkout. Staging measurements remain pending; no load was sent to production.
- B7 code-health work is in separate PRs #31 (routers), #32 (rendering), #33 (unused artifacts), stacked after #30. The original 60-second setContent timeout occurred once in #32; its failed jobs were rerun after workflow completion. Local left-template parity passed for all 80 templates. Full export matrix and final hosted results remain release gates.
- Remaining owner TODO: merge #28 and reviewed follow-ups in order, approve/apply the Railway plan, set spend/Redis limits, confirm clamd/API memory and end-to-end behavior, and run the approved real staging measurements before changing render work ratios.

## 2026-10-05 — PR #29 port and launch spending correction

- Ported useful export/download fixes onto the complete PR #28/#30–#34 stack: atomic paid-result recovery, leased render scratch cleanup and disk checks, queue lifetime covering cron recovery, bounded status/result requests, durable download receipts and signed browser-managed attachments. Preserved PR #28 thread offloading, background wake/resize, Redis/RQ retention and adaptive polling. Admission uses one asynchronous 16-operation limiter instead of nesting event loops/thread pools. Retained the Python 3.11 ExitStack correction.
- Owner selected **preparation of the $50/five-replica launch profile**. Source ceilings remain five, API remains 2 vCPU/2 GiB and AI daily count remains 2000. Workers sleep when idle; both controllers stay gated on actual resize/drain acceptance. Pending admission stays at one-replica capacity until enabling that gate. No live cap, alert or resource was changed by source preparation.
- Corrected the spending guidance: the existing $15 cap is not approval to deploy five fully loaded replicas. At current rates, the full launch profile is roughly $2.3/hour before Redis/egress/providers/tax; $50 is not a month of guaranteed availability. Historical decisions in the separate PR #29 log apply to its older candidate and do not authorize the new settings. Live read-only inventory: Hobby, production environment only, $15/$8, about $0.22 used, one sleeping replica per app service.
- Full backend run: 398 tests and 31 subtests passed; Bandit found zero Medium/High issues. Clean npm ci/release checks and hosted acceptance continue. No tests or assertions removed. Rebuilt replacement PR, closure of old #29 and requested ordered merges follow only verified code checks.
- B4 remains pending: no isolated staging environment or load credentials exist. Prepared docs/RAILWAY_B4_PLAN_2026-10-05.md with a $10 finite test allowance, two-hour admission expiry plus bounded drain, resource inventory, separate provider costs and test-only cleanup. Approval of that priced plan is required before live cap changes or paid staging creation/tests; actual timings and spend are not fabricated.
- Before merging, discovered PR #28 advanced to `90b9b3e` with sleeping workers; incorporated it without changing backend/frontend behavior. Scoped live API/cron `RENDER_AUTOSCALE_ENABLED=0` updates were read back with deployments skipped; existing resource sizes/counts and $15/$8 cap remain. The pinned production plan has 0 additions, 32 changes and 0 deletions; it was not applied. Local editor/download journey and all 342 readiness checks passed.

## 2026-10-05 — Approved $25 Railway cap and release-gate status

- The owner approved the reviewed live rollout and finite staging plan, authorized the plan's metered AI calls without a separate $10 allowance, then changed the requested Railway hard cap from $50 to **$25**. Set the live hard cap to $25 and custom email alert to $10; verified both through the correct workspace's billing API. Current usage at readback was about $0.2195. Railway's automatic 75%/90% reminders correspond to $18.75/$22.50. The $10 alert is only a notification threshold. Provider/storage/database charges remain separate from Railway's cap.
- Merged #28, #30, #31, #32, #33 and #34 in the requested order after checking their hosted results. Closed conflicting #29 with its useful fixes retained in #35. No existing branch was deleted or force-pushed.
- Updated the current IaC comment and deployment, export-reliability and B4 runbooks to match the revised approval. Five-replica ceilings, sleeping workers, disabled autoscaling and finite time/job bounds remain. At full source ceilings, $25 represents about 11 hours before other charges; no monthly capacity guarantee is claimed. The reviewed production plan remains unapplied and staging has not been created.
- PR #35's application revision `38edfa8` passed 11 hosted checks. One export scope failed with a 60-second Chromium setContent timeout; its retry was rejected before any steps ran because GitHub reported failed account payments or a spending limit. The release gate remains red. The same complete export scope subsequently passed locally; all 342 readiness checks passed after these documentation/comment changes. The application code retains the completed 398-test/31-subtest backend result and clean Medium/High Bandit result. No check was disabled or marked successful manually.
- Remaining: restore GitHub Actions billing availability and pass #35's gate, or obtain explicit owner authorization to use the completed local validation for merge/rollout. The prior deployment approval was conditional on the release gate; the $25 cap change does not override it. Then apply the reviewed production plan, run isolated B4 measurements within the shared $25 Railway cap and clean up test resources. No measured B4 results are claimed.


## 2026-10-05 — Independent launch review: middleware responsiveness

- Reviewed PR #35 head `078d4bc` in an isolated managed worktree while the coordinated rollout chat retained ownership of billing, CI and deployment. Reproduced two HTTP middleware stalls: Firebase App Check key verification and Redis-backed export latency recording ran on the event loop outside the export admission fixes.
- Offloaded App Check verification with a separate 16-token AnyIO capacity limiter. Exempt health/version/media/operator paths and missing-token rejections bypass the limiter; existing Firebase verification, signing-key cache, 403 behavior and security headers are preserved. Offloaded latency recording and development upload slot acquire/release Redis calls as well.
- Changed `backend/main.py` and added five HTTP regression tests in `backend/tests/test_operations_threading.py`. Tests prove cold verification leaves unrelated probes responsive, 40 simultaneous requests never exceed 16 verifications, missing/invalid tokens still fail closed, latency recording runs off-loop, and upload leases are acquired/released off-loop with matching ownership. Made this test module's main imports package-explicit so it also runs standalone.
- Verification: the new cold-key and latency tests both failed against the original code; after fixing, 108 focused tests/7 subtests passed, then the complete backend suite passed **403 tests and 31 subtests**. Bandit reported no Medium/High findings and `git diff --check` passed. The dependency-free export-delivery regression script also passed on the reviewed source. Existing dependency deprecation warnings remain.
- Handoff: provide the tested commit to the rollout chat for inspection/cherry-pick into #35 and one combined hosted gate. No billing changes, cloud resources, CI reruns or deployments were performed from this review worktree. Live authenticated Railway measurements, worker-failure recovery, actual replica capacity, mobile large-download validation and B4 cleanup are still required before declaring unrestricted public launch readiness.


## 2026-10-05 — Independent launch review: batch retry safety

- Reproduced three batch admission defects on #35: two simultaneous same-key requests enqueued two batches, changed content under an existing key replayed the wrong batch, and a Firestore status-receipt outage could leave cached jobs without a recoverable batch status document.
- `backend/export_api.py` now atomically claims a scoped batch retry key before queuing and hashes sanitized batch content. Replays keep the original jobs; content conflicts/in-progress claims return 409. Receipts retain their original jobs across a database outage and repair the status document on retry before reporting successful replay. Fully rejected batches release their claim. Ambiguous lost enqueue replies retain the original job ID as admission-uncertain rather than creating replacement jobs. Batch status now uses the existing job/paid-result reconciliation path.
- Added seven behavior tests in `backend/tests/test_export_reliability.py`, using fakeredis for the actual shared atomic claim and a two-request barrier to reproduce the race. Cover concurrent claims, content conflicts, status receipt repair, capacity rejection retry, lost enqueue reply, partial batch replay, and committed paid-result recovery. Three tests failed before the fix; final full backend validation passed **410 tests and 31 subtests**, with no Medium/High Bandit findings and clean diff whitespace.
- The batch idempotency retention remains six hours, matching existing export retry keys. An API process dying before it publishes a batch receipt retains its in-progress claim and fails closed on the same key rather than automatically admitting another batch; this is a deliberate duplicate-charge safeguard, not a claim of automatic resumption of every interrupted batch-admission phase.
- Coordinated handoff to the rollout chat for one combined PR #35 push/hosted gate. No live export load, infrastructure apply, billing changes or cloud resource creation from this worktree. Independently observed a $9 overdue Netlify invoice and provider warning of service interruption; the owner said they will resolve it, but clearance has not been verified. Netlify showed 894.1/1000 credits remaining, auto recharge disabled. Live Railway capacity/failure tests and Netlify billing clearance remain launch gates.

## 2026-10-05 — Actions billing restored and final combined PR #35 fixes

- The owner explicitly approved increasing GitHub Actions' monthly budget from $7 to $10. Saved the change through the authenticated account billing UI and verified $7 spent, $10 budget and Stop usage enabled; alerts stayed enabled. Retried workflow 37313115770 on revision 078d4bc: all 13 hosted checks passed, including the previously failing export scope. Railway independently remains at its verified $25 hard cap and $10 custom alert; no separate test allowance was restored.
- Integrated the independent middleware and batch fixes after reviewing their diffs. Updated `scripts/media_load_smoke.py` to prefer direct signed downloads, send Firebase/App Check headers only to the API origin, validate redirected storage URLs and bound redirects. Its failed journeys now retain admission retry counts. Four additional tests cover signed-header isolation, API-to-storage redirects, unsafe/looping redirects and failed-journey retry metrics.
- Combined validation: **414 backend tests and 31 subtests passed**, all **342 release-readiness assertions passed**, production-code Bandit Medium/High gate passed, and `git diff --check` passed. The added code requires fresh hosted CI on the final combined SHA before the conditionally approved merge and rollout. No checks were bypassed.
- Prepared private, untracked staging tools for manifest-owned test accounts, App Check minting, scoped Railway changes and cleanup. Prepared two bounded 60-second speech fixtures below 50 MiB: original offline English narration and three Hindi utterances from [Google FLEURS](https://huggingface.co/datasets/google/fleurs), licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), concatenated and silence-padded with generated video; hashes and attribution are saved locally. No test account, staging environment, paid capacity or live load was created by this preparation.
- Updated current deployment/B4 instructions to reflect restored Actions billing and existing approval. Remaining: final hosted gate, merge #35, reread deployment records, verify/apply the unchanged reviewed production plan, real upload/export/sleep acceptance, finite isolated B4 measurements and verified cleanup. Keep autoscaling off until the actual worker acceptance tests pass. Netlify's separate overdue invoice is being handled by the owner in the coordinated review chat and is not covered by Actions/Railway approvals.

## 2026-10-06 — Final release recovery fixes, measured Railway acceptance and cleanup

- Published the reviewed runtime stack and PR #36 recovery/dependency fixes as immutable release `0c5182f3672a618a38a4d5bbef4847a80e9e6d72` on both existing Netlify sites and all four Railway app services. PR #36's tested head passed all 13 hosted gates and its merge tree matched. Restored visible saved/account draft recovery and backup on ordinary reload. Reproduced a real pre-credit SIGKILL that left app state stuck despite RQ success; conditional worker/cron retry reconciliation now preserves terminal states and paid-result recovery. Updated compatible source-map-js/gRPC dependencies and removed two obsolete gRPC exceptions; the existing unpatched build-only braces exception remains.
- Verified one fresh final-release authenticated production journey: upload, real transcription, corrected captions, Mountains LC T167 template, account save, ordinary reload and recovery, 1080p export and downloaded H.264/AAC 8.192-second MP4. Credit balance 12→11; reconnect/download retained 11 after a browser-control timeout, with no second render/debit. Decoded caption frame was visually checked. Existing projects and the unrelated local ExportPanel review-UI removal were preserved; that local edit was excluded from publication.
- Completed the 60-second 1080p/30FPS baseline comparison: ASS median/P95 20.866/22.754 seconds on four CPUs versus 8.985/9.227 on eight; DOM 33.188/34.554 versus 15.646/16.127. Five measured successes per path/configuration. The first four-CPU attempt was interrupted by platform sleep; the owner approved 12 extra bounded renders. Fixture SHA and renderer/generator source matched across revisions. Production retains eight CPUs and conservative work ratios; the baseline DOM fixture is not a representative authored animation.
- Authenticated synchronized ten-client burst passed 10/10. Original 100-client barrier aborted before export admission after transport failures; resumed export burst produced all 100 outputs, with 85 initial downloads and 15 R2 read timeouts. All 15 recovered on the first five-client follow-up, using existing receipts and no new renders. Distinct file hashes share identical decoded synthetic media; do not claim unrestricted diverse-media capacity or a clean fresh 100-user full journey. Hindi processing/download passed 10/10 using licensed FLEURS speech, without claiming transcription accuracy. API peak observed during the 100 phase was 544,878,592 bytes, no OOM; worst-case fallback scanner peak remains unmeasured.
- Actual finite staging observations reached five replicas for each worker, protected running work across replacement, and returned to one before the final comparison. On immutable final release, actual SIGKILLs before and after debit both recovered to completed paid results; two jobs consumed exactly two credits (5→3). Final production API and workers were observed Sleeping. Enabled the already approved live acceptance override: controller flags 1, ceilings five, worker admission five, pending budget 3000 in API/cron. All replacements succeeded, workers subsequently slept, release markers agreed and readiness returned 200. Source IaC keeps its fresh-environment safety default off; a future plan must preserve/review the accepted production override. Existing resources only; $25 hard cap/$10 alert unchanged, Redis remains always on.
- The finite expiry removed staging during chat inactivity: cleanup ran 15:09–15:16 IST. Independently verified temporary account-scope SSH key, scoped scaling token and private credentials absent; 100 disposable accounts/user documents absent and owned media prefixes empty. Cleanup removed 395 owned objects and 1320 documents, preserving production and shared services/volume. Ledger reserved 161 journeys and 36 benchmark exports. Combined reported Railway usage later read approximately $0.567; billing lag and existing production prevent calling this an isolated final test bill. No new recurring automation or notification preference was created.
- Last log inspection found the live ClamAV daily database over seven days old. Official image aliases share an eight-day-old digest, so a plain redeploy is insufficient. Prepared/pushed PR #37 (`df04ecf`) with bounded incremental build update, CVD/CLD support, seven-day header freshness validation and clean-file scans in both final image gates; eight local tests, Python compile and whitespace passed. Docker is unavailable locally. GitHub rejected every hosted job before execution; authenticated readback shows $10.00 spent/$10.00 budget, Stop usage enabled. No spending limit was increased. Owner input is pending to restore availability within $10 or approve $15 (up to $5 more); only then verify, merge and publish the fix. Full launch clearance remains pending this image update; Netlify billing remains explicitly excluded.
- Durable evidence, measured tables, live configuration, rollback and remaining limits: `docs/LAUNCH_ACCEPTANCE_2026-10-06.md`; updated current TODO and `docs/RAILWAY_DEPLOYMENT.md`. Earlier complete backend/release validation and the new focused crash tests passed; PR #36 hosted gates cover the deployed recovery code. PR #37 remains open and its red gates are not waived.

## 2026-10-06 — Launch follow-up: complete large-file malware scans

- Owner requested all remaining launch fixes and explicitly retained the Actions $10 hard stop, choosing to restore availability themselves. No Actions/Railway spending limit or Netlify billing setting was changed.
- Found a scan-coverage mismatch: the existing 600 MiB stream limit left the engine's 100 MiB file/default expanded-scan limits intact, below the allowed 500 MiB upload size. Commit `4774775` on PR #37 aligns daemon/CLI policy to 500 MiB files and 600 MiB expanded scans, enables incomplete-scan alerts, and treats limit verdicts as scanner-unavailable instead of clean or confirmed malware. Custom scanner adapter arguments remain intact.
- Added six local policy tests and real final-image acceptance for a clean 500 MiB fixture, standard harmless EICAR detection through CLI/daemon and a deliberately exceeded scan limit. Twenty focused scanner/freshness tests passed. Initial full backend run: 431 passed/40 subtests, one Windows localhost connection-abort; all three wake-endpoint tests passed separately and the unchanged full suite then passed 432 tests/40 subtests. Bandit Medium/High gate, Python compilation and diff whitespace passed. Real image tests remain unexecuted because Docker is unavailable locally and all 13 jobs of workflow 37468525687 were rejected before execution for billing/spending limits. The final release gate is not waived; production remains on `0c5182f`.
- Pushed the fix and updated PR #37's description using the existing repository-scoped REST credential after gh's metadata GraphQL route requested unrelated missing scopes. No credential permission was expanded. Existing dirty ExportPanel and document edits were preserved and excluded from the code commit.
- Prepared `docs/LAUNCH_FOLLOWUP_PLAN_2026-10-06.md` for remaining varied/max-size, fresh 100-user, sustained-download and authored-animation evidence. Proposed two-hour admission plus 30-minute drain, 120 journeys/12 benchmark renders, up to $8 Railway within $25 plus up to $6 external AI/storage/database usage. Asked for new finite approval because the earlier staging phase expired; no staging environment, identity, token, SSH key or paid load was recreated. Updated the acceptance report and current TODO to state both remaining scanner fixes and these evidence limits.

## 2026-10-06 — Scanner final-image verification and owner scope correction

- Owner asked whether the Actions hard stop prevents pushing: confirmed GitHub still holds PR #37 head `47747752e0c71afb4257804476014741d65c160b`; the limit blocks hosted jobs, not Git pushes. Explicitly declined a fresh 100-user upload-to-download test; removed it from requested work and replaced the earlier 120-journey proposal with a smaller optional, unapproved follow-up. No new paid staging phase was started.
- Built both exact API/transcription Linux final images using an existing WSL Ubuntu 24.04 installation and a private temporary Docker 29.8.2 runtime. Official Buildx asset digest was verified. FreshClam incrementally refreshed and load-tested daily database version 28145; freshness checks found it under eight hours old. API image `sha256:86622e9cdbf2f488e77c153def445dd57b986c3ba74a3a05b01dd61c462f16bc` and transcription image `sha256:d4db878a662cf4bde56ed5ccb6e3a816aa11012766066060ddb80c4dd360b1d8` each passed real clean 500 MiB scans via clamscan and clamd, harmless EICAR detection, deliberately exceeded scan-limit rejection and all 20 focused unit tests. Memory limits matched the configured 2 GiB/3 GiB profile, with swap and scan-network access disabled. The earlier 432-test/40-subtest complete backend result remains applicable to the unchanged scanner source.
- Retained failed local-harness evidence: initial WSL disk/startup failure under low C: space; Git archive CRLF conversion rejected by clamd (corrected with `core.autocrlf=false`); RAM-backed maximum-size temporary files caused a 2 GiB OOM (corrected using disk-backed Linux ext4); Windows-mounted EICAR file access failed, with antivirus interference suspected but unverified. No committed scanner code or check was relaxed to obtain the final passes; no antivirus setting, permanent service or firewall setting was changed. Windows Defender diagnostic read was unavailable/approval review timed out; it was not required for the successful Linux verification.
- Saved all five check outputs and exact identities in `.readiness/pr37-local-api-20261006.json`, `pr37-local-transcription-20261006.json` and `pr37-local-verification-20261006.json`. Stopped only the owned temporary Docker daemon; runtime and D: temporary disk directory were verified absent afterward. Removed redundant task-created source archives after retaining hashes. Existing customer files, other WSL distributions, VHDs and dirty frontend changes were preserved.
- Updated PR #37's description and the acceptance report with the completed local evidence. Hosted workflow `37468525687` remains failed before execution for billing; no check status was manually changed or disabled. The previous deployment approval required hosted release checks, so requested explicit owner approval to substitute the completed local checks for PR #37 only. That decision remains pending. Production readback at 14:17 UTC still shows release `0c5182f`, worker sleep, accepted resource limits and unchanged Railway $25 hard cap/$10 alert; reported combined usage was approximately $0.5854. Actions stays at $10 and Netlify billing remains excluded. No merge or scanner rollout is claimed.

## 2026-10-06 — Approved scanner rollout and production acceptance

- Owner's “do it” authorized completed exact local image verification as the release gate for PR #37 only. Merged verified head `4774775` as `63cf04f9c6f5ab34457612d4513bb78586554836`; tested and merged trees match exactly. GitHub Actions remain billing-blocked at $10; no check was manually marked successful, disabled or funded further. Git pushes and deployment remained available.
- Existing Railway GitHub integration deployed all four app services; each reported SUCCESS on the merge release. API/transcription build logs verified freshly updated daily database version 28145 (under eight hours old); live clamd limits are 500 MiB file/600 MiB expanded scans. Preserved Redis, resource sizes, sleep, worker drain 1860 seconds, controller flags, five-worker limits and pending budget 3000. Railway cap/alert remain $25/$10; reported combined usage was about $0.5867, not a settled isolated bill. No new paid staging resource, key or credential was created.
- Built the frontend from a clean committed merge archive with LF preserved, matching dependency lock and the existing dependency installation. Guarded build/performance budget passed (305.8 KiB gzip under 390 KiB). Both existing Netlify sites published the artifact and retained locks; protected drafts required Netlify authentication and their protection was not disabled. Public frontend/API markers agreed on `63cf04f` and readiness returned HTTP 200 at 20:09:47 IST. Netlify billing/configuration was untouched. All dirty shared frontend work was preserved and excluded from publication.
- Fresh production browser check: backed up the original local draft; uploaded one rights-owned 8.192-second fixture, passed actual malware scanning (cold-daemon clamscan fallback, 16.688 seconds), real four-line transcription, caption correction and 275-byte SRT download. Existing cloud projects were not saved over. One MP4 request hit the existing Starter three-per-rolling-24-hour quota before render/debit; balance stayed 10→10. No retry or quota override. A new-release MP4 download is not claimed; earlier `0c5182f` complete journey remains evidence and render/download source is unchanged. Generic quota-error UX and the pre-existing pending brand-kit sync notice were recorded; preferences were not overwritten.
- Updated `docs/LAUNCH_ACCEPTANCE_2026-10-06.md`, `docs/RAILWAY_DEPLOYMENT.md` and current TODO: scanner blocker resolved, controlled public launch supported under current caps, unrestricted mass capacity still unestablished. Owner declined a fresh 100-user test and the smaller paid follow-up remains unapproved. No fresh load or recurring monitor was added.
- Retained frontend source/archive and 84-file artifact hashes plus release, scanner and browser acceptance JSON/screenshots in outer `.readiness/`. Local D: frontend build directory `D:\lekha-pr37-frontend-20261006` remains because automatic approval review could not complete deletion after reaching its usage limit; the cleanup command did not execute and was not bypassed. Its dependency junction must be unlinked without deleting shared dependencies during later approved cleanup. Earlier local Docker and cloud staging cleanup remain complete. No additional implementation tests were run during this documentation closeout.


## 2026-10-07 — Correct stale B4 result tables

- Fresh read-only GitHub verification confirms PR #35 already merged after its final 13 hosted checks passed. Live Railway readback confirms production release `63cf04f`, controller flags enabled with five-replica ceilings, sleeping API/workers, successful exited cron, only production remaining and unchanged $25 hard cap/$10 alert. Reported combined usage was about $0.604; no new load, apply, spending increase or scheduled notification was started.
- Replaced stale pending statements in `docs/RENDERER_BENCHMARK.md` and `docs/DRILL_LOG.md` with the completed baseline and finite-burst evidence. Published the existing acceptance/runbook records and a redacted numeric artifact containing attempts, runtime quotas, journey timings, recovery counts and source hashes. Corrected the RAM distinction: the requested 8 GiB yielded an actual 8,000,000,000-byte cgroup limit. Paired authored-animation performance and unrestricted capacity remain unmeasured; the owner-declined fresh 100-user journey was not repeated.
- Documentation only. Checked source summaries/fixture equality, links, JSON and diff whitespace. Kept the shared application edits untouched and prepared one documentation PR with Actions skipped to honor the existing spending limit. No failed application gate was changed or bypassed.


## 2026-10-07 — Combined publication of completed session work

- Owner explicitly requested pushing the completed session work and making it live. Integrated PR #38 into the existing PR #39 candidate, preserving the measured B4 tables/evidence and the fuller acceptance/follow-up records. No extra PR, paid staging phase or scheduled message is introduced.
- Retained PR #39 save-conflict protection, browser recovery, text-box removal/undo, export-review removal and marketing dependency fixes. Added the completed marketing editing sources/brand assets and the current v6 cut at `public/launch-video.mp4`; eight finished cuts are prepared as GitHub release downloads. Raw recording takes, silent intermediates, audio mixes and duplicate archives stay local. Marketing inputs and the static launch film are excluded from Railway images.
- Verification before publication: exact locked app/marketing installs; 432 backend tests and 40 subtests; 342 release contracts, frontend contracts/lint/typecheck/guarded build, local editor recovery/conflict/removal/undo journey and dependency audit passed. Next marketing build and Python dependency audit passed; Bandit has zero Medium/High findings. Public browser suite: 59 passed plus one Firefox navigation timeout that passed on retry; that exact case subsequently passed alone without retries. Twenty credential/staging-only cases were not enabled, and this is not a new authenticated production MP4 acceptance. The complete template matrix and repository privacy audit are running before the push; final results are retained in the local release evidence and will be attached to the GitHub release.
- Deployment is restricted to the existing production services and both existing Netlify sites. Fresh control-plane readback confirmed the approved CPU/RAM, sleep/drain, enabled scaling controllers, five-worker ceilings and unchanged Railway $25 hard cap/$10 alert; reported usage was about $0.6045, subject to billing lag. No infrastructure apply, new service/volume/token, funding increase, payment setting or customer-data change is included. GitHub Actions remains blocked by its existing $10 hard stop; no hosted pass is claimed or check status altered.
- This entry records the prepared candidate, not a completed rollout. The final immutable commit, actual deployments/public release markers and asset digests will be recorded in GitHub release `launch-2026-10-07` after verification. Netlify billing remains excluded. Rollback retains the preceding release `63cf04f` and previous Netlify deploy IDs; preserve customer queues, media, payments and current spending controls.

## 2026-10-07 — Draft backup button contrast

- Reproduced white text on white background on the live Start Creating Captions screen when the backup button is not hovered. Scoped explicit white background/black text and light-gray hover/black text to this button in `src/pages/Dashboard.jsx`; draft recovery/download behavior is unchanged.
- Local verification passed: 12 desktop/mobile, light/dark and normal/hover/focus states meet 4.5:1 contrast and fit the viewport; downloaded JSON preserves the draft and browser copy. Existing complete local editor journey, lint and diff whitespace passed. Guarded production build and existing-site publication follow; production completion is recorded separately in outer `.readiness/` evidence.
- One necessary UI fix, no new infrastructure or paid staging tests. Retain Railway $25/$10 cap/alert, GitHub $10 hard stop, deployment locks and notification preferences. Use completed local validation without requesting hosted Actions for this cosmetic patch.

## 2026-10-07 — Five-second cloud-save notifications

- At the owner's request, save-conflict and other cloud-save notices dismiss after five seconds. Split the conflict notice visibility from the conflict latch, so hiding the notice does not resume stale autosaves or discard browser edits. A later conflicting manual Save displays the notice again; account changes and editor reset clear its visibility.
- Updated the existing real editor journey to verify visibility before five seconds, dismissal afterward, autosave remaining paused after dismissal, browser recovery of further edits and repeated-conflict notification dismissal. The complete journey, lint, typecheck, all 342 release contracts and diff whitespace passed. Existing draft-backup contrast fix is retained. Other sessions' active editor/refactor edits remain untouched in the shared checkout.
- Publish only this necessary change using the existing sites/services and completed local checks; do not request hosted Actions, increase spending limits, add infrastructure, start paid load tests or schedule messages. Production build/deployment/readback completion is recorded in outer `.readiness/` evidence and this fix's PR after verification.


## 2026-10-04 — Latest landing and editor published together

The owner clarified that the apex homepage must show the latest app landing
page as well as the editor. Published the already-reviewed current Vite artifact
to the existing apex Netlify site with the app's SPA/security/cache configuration,
replacing the old standalone marketing build. Both sites have matching VITE_
settings, verified privately without printing values. No code, Railway workers,
DNS, cloud resources or credentials changed for this cutover.

Deploy 6ac283e38b3b0905a54a3476 retains the production lock. Release 51db590 has
the same source tree as latest merged main 5f1345a; its required PR workflow
37213343630 passed. The separate main workflow hit two existing template-browser
navigation timeouts. Live homepage/editor/legal/login routes and assets returned
200, the release marker matched, and old app links returned 301 retaining query
strings. Browser verification covered the current landing page, editor link,
editor reload and login interface; no fresh signed-in upload/export was run.

Updated README and the Railway guide, and added docs/NETLIFY_DEPLOYMENT.md so
future deployments publish the same Vite app for landing and editor. Production
Netlify sites remain manually published and locked; dashboard shows no Git
repository linked. Attempts to update repository build settings did not persist
and granted no new Git integration. Netlify shows an overdue payment warning;
the owner must address billing to prevent interruption. Private diagnostic logs,
screenshots and credentials remain local. Old GCP redesign commits are preserved
locally and excluded from this push.

## 2026-10-09 — Completed Claude caption and upload fixes prepared for publication

- At the owner's request, captured Claude's finished changes from the shared checkout into an isolated candidate based on main 0985810. Preserved the shared originals and excluded the separate open PR #59. This entry records preparation, not a live rollout.
- Hindi/Sarvam transcription now splits phrase timestamps into estimated per-word timings, recognizes Indic and other sentence punctuation, and sends long audio in pause-aware pieces under the synchronous API's 30-second limit. Versioned transcription cache keys avoid old phrase-only results. Word timing remains estimated within provider phrase spans.
- Caption duplication fits available gaps or splits the original caption's time without moving later captions. Preview/export emphasis keeps at least bold weight without reducing heavier captions; renderer cache version advances. Timeline collapse and zoom controls use sibling buttons. Upload progress continues into caption processing; waveform decoding no longer delays completed captions, skips files above 200 MiB, clears the previous waveform and closes failed audio contexts.
- Files: backend/media_records.py, processor.py, processor_captions.py, settings.py, tests/test_upload_journey.py; scripts/check-caption-editing-invariants.mjs and render_template_page_runtime.mjs; dashboard CaptionEditor, CaptionTimeline, GeneratingCaptionsScreen, VideoPlayer, audioUtils, captionEditingUtils and pages/Dashboard.jsx. Added three regression tests in UploadFeedback.test.jsx for progress, large-file skip and audio-context cleanup.
- Verification: 480 backend tests and 40 subtests; zero Medium/High Bandit findings; 77 frontend unit tests; 342 release-readiness assertions; frontend contracts, XSS checks, lint, typecheck, production build and performance budget; local editor/upload/checkout recovery journeys; motion parity and 47 high-risk template-export phases passed. Earlier sandbox temporary-file restrictions and a backend test invoked from the wrong directory were corrected; final checks passed from the isolated application directory. No test or assertion was disabled.
- Hosted Actions currently rejects jobs before execution for failed payments/spending limits. Existing local-check approval was specific to another release; this candidate requires its own release exception before merge/publication. Preserve the existing production services, two Netlify sites, spending limits, release locks, and customer records. No paid staging or load testing is included.

## 2026-10-09 — Coordinated identity, international activation and cloud recovery

- Owner authorized completing the launch-closeout list, then explicitly approved local validation for immutable `4cd7453` and temporary private verification access. Rebuilt only the four existing Railway app services and published matching protected Netlify drafts, preserving locks, resources and spending caps. Canonical version `git-4cd7453c6572` and batch time `2026-10-09T13:06:45Z` now agree across frontend/API/private workers; strict verifier passed and temporary access was revoked/removed. Hosted Actions still cannot start at its unchanged $12 hard stop. No check was disabled, marked green manually or funded further.
- Fresh signed-in upload/original-language transcription, caption correction, T167 template and text-layer save passed. Browser backups preserve preceding and test drafts. Fresh account-only recovery found unordered limit-before-sort selecting an older project, and stripped media URLs requiring an authenticated refresh. Prepared fixes in `backend/drafts.py`, `useDraftPersistence.js` and `Dashboard.jsx`; realistic Firestore query-limit regression fails before the fix. Full backend passes 475 tests/40 subtests, frontend passes 74 unit tests/contracts/lint/typecheck/build, 342 release assertions pass, and the real local editor journey includes account-only media recovery without a revision write. No mass-load run was started.
- Owner approved Razorpay's final agreement/submission. Dashboard confirms international-card activation under review, with an update indicated by 2026-10-11. Correct plan/credit international checkout remains pending enablement and owner transaction; no payment was made. Existing Firestore credentials cannot apply the exact checked-in cache TTL/index exemptions (403, no settings changed); an existing administrator sign-in is required. Physical-phone acknowledgement is not a passing device result.
- Added `docs/LAUNCH_CLOSEOUT_2026-10-09.md` and coordinated metadata instructions in `docs/NETLIFY_DEPLOYMENT.md`. The prepared recovery fix is separate from verified production `4cd7453`; its immutable rollout and final live recovery/MP4/download/credit acceptance remain pending. Current Railway $25/$10 cap/alert, accepted CPU/RAM, sleep/drain and worker ceilings remain intact; no resource, permanent credential, new IAM grant or spending increase was introduced.
- Pushed the recovery fix as PR #59 and integrated already merged PR #58; combined backend validation passes 476 tests/40 subtests. At 14:32 UTC the automatic Railway integration had advanced to `0985810` while the manually locked frontend stayed on `4cd7453`; repeat coordinated publication and strict verification after the next approved merge. Ongoing shared-checkout transcription/processing-screen edits are preserved and excluded until their owning session completes them.
- The administrator Google account completed gcloud sign-in and has the required existing field-management permissions. Exact TTL apply now fails because Firebase project billing is disabled, not because of missing IAM. No billing or IAM was changed. Four cache index exemptions were accepted separately, with operations still initializing; TTL cleanup remains pending a separate billing decision.

## 2026-10-09 — GitHub Actions spending limit and minimal hosted-use rule

- Owner explicitly authorized increasing the existing Actions monthly hard budget by exactly $2. Verified the live account budget changed from $12 to $14, with $12 reported spent, Stop usage enabled and threshold alerts retained. Other product budgets and hosting limits are unchanged. Screenshot: outer .readiness/github-actions-budget-14-20261009.jpg.
- Owner requires GitHub use only when needed: validate and fix locally first, batch completed changes into a final commit/PR, avoid intermediate or documentation-only pushes that trigger hosted CI, and reuse the existing final PR/workflow. Do not automatically repeat the whole hosted matrix after a failure; inspect the cause and run only the necessary affected jobs. Never raise the limit again without explicit owner authorization. Apply this rule to all future work on this app.
- Claude fixes PR #60 already exists at b45ba32. Its complete local checks and production build passed; one retry of that exact previously billing-blocked release workflow is the necessary next gate. No extra source push is included in this budget update, and this entry remains local until a necessary future publication.

## 2026-10-21 — Integrated local launch fixes; publication held

- Owner requested a full code/launch review and the last 15 days' session history, authorized exactly $2 more Actions budget, prohibited pushes until instructed, then said “fix all.” Reviewed evidence is in outer `.readiness/LAUNCH_REVIEW_2026-10-21.md`. Actions now has an $18 stop with alerts retained. No hosted run, push, deployment or paid load test was started.
- Created local `codex/launch-fixes-20261021`; combined existing #63/#65/#66 and country-currency branches. Preserved geometry/privacy fixes, stable history callbacks and the authored template renderer. The new delayed/failed/refused replacement regression proves completed projects survive, and accepted failed media is separately retryable. Moved caption resize handles outside text after the combined advanced-template regression showed a handle intercepting word drags.
- Patched Vite to 8.1.6 and hashed certifi to 2026.10.19 without a new audit exception; raised draft/track saves and the new Translate-button guard to 1,000 captions. Save/restore, real-editor 1,000-line translation with original-track preservation, and local 1,001-line refusal pass. Added clean-commit release-batch preparation, shared Docker build-time arguments, scanner refresh date and an hourly synthetic schedule. Remote monitoring remains disabled until that schedule is published and enabled intentionally. Synthetic email-policy fixtures keep domain coverage without privacy findings. The manual Netlify handoff explicitly includes the country Edge Function; a static-only upload would omit it.
- At the local source checkpoint: backend 501 tests/40 subtests, frontend 132 units plus contracts/lint/typecheck/build, 342 release contracts, sanitizer, dependency audits, Bandit gate, operations/evidence record checks and privacy audit pass. Public browser suite passes 60 with 20 credential-dependent skips. Editor recovery/isolation, replacement uploads, word geometry/CPT/editor/styles/timeline checks pass. Export motion/visual/keyframe audits, 47 high-risk exports and all 80 left templates pass; the exhaustive advanced/basic sweep continues in the receipt `fixall-20261021-templates.log`. Final results belong in outer `.readiness/LAUNCH_FIX_STATUS_2026-10-21.md`.
- `docs/LAUNCH_FIXES_2026-10-21.md` records each fix and live gates. Production remains `d1d2d741` with its metadata mismatch. Exact Linux image/scanner validation, owner-authorized coordinated rollout, fresh recovery/MP4/debit/re-download acceptance, actual international purchase/credits, physical phone, support and maintenance verification remain. International-card activation is already confirmed. Existing Railway inventory/resources/caps and billing stay unchanged.

## 2026-10-21 — Pasted-review verification and public-history gate

- Verified the external review against live production and source. Normal guest root loaded, while separately blocked local/session storage reproduced the application error boundary. Three local negative controls failed before the fix. Guarded theme reads/writes and lazy-route retry bookkeeping; browser storage failure no longer invalidates a successful route import or starts an unguarded reload. No Firebase security check was bypassed.
- Live API health/readiness/controls were HTTP 200 and healthy with valid apex CORS. Current /status rendered a SPA 404, not the quoted legacy Next.js degraded panel. Added a Vite status route with independent checks and explicit unverified states for blocked/network/invalid checks; API liveness/readiness remain separate. Corrected FAQ/Help to 100+ styles, public canonical URLs/sitemap/13 Netlify alias redirects, and semantic navigation. Existing editor/OAuth paths and query/hash recovery remain.
- GitHub now reports PUBLIC. Owner explicitly chose “Keep public; report cleanup.” Public-only audit of 26 advertised heads/tags and 468 revisions found 829 email/author occurrences; no supported high-confidence secret patterns. The release-candidate scope reports 848 historical occurrences and zero current findings. Updated the local policy to require verified public-history cleanup, so privacy fails rather than passing under the old private-only decision. No visibility change, rewrite, force-push or new permission to rewrite was granted. The masked cleanup plan is docs/PUBLIC_REPOSITORY_CLEANUP_2026-10-21.md.
- Verification: 142 frontend units, 342 source checks, contracts/sanitizer/lint, focused typecheck and guarded build pass. Type declaration added for the JS helper consumed by the existing TypeScript utility. Browser matrix: 89 passed plus one Firefox case passed after a navigation retry, 20 credential-dependent skips. After consistent external-dependency blocking, that exact canonical/query/hash case passed alone in Firefox with zero retries. All 15 storage-denial/quota browser cases pass. No core backend/renderer/dependency changes warranted repeating the earlier 501 backend/442 export cases. Netlify config parses and retains old-domain priority/no slash-only redirect loops.
- docs/EXTERNAL_REVIEW_RESPONSE_2026-10-21.md separates verified fixes, unsupported diagnoses and feature suggestions. No speculative wasm pipeline, retention-policy change, coordinate migration or editable sandbox was added. Previous release batches are superseded by this source and must not label a future build. Prepare a new coordinated batch after approved cleanup/final source review; exact images, rollout and customer/payment/device/support/retention acceptance remain. No push, deployment, paid workflow, payment, support message or spending change.

## 2026-10-10 — Isolated combined launch candidate

- Preserved shared session work and built a separate candidate from completed `b762e6f`. In-line word layout now reserves the edited font size, weight, case and emphasis, with line height growing accordingly. Detached words retain their original sentence slots. Positioning and animation transforms use separate elements so detached text stays centred and does not jump when selected. Added real desktop/touch-viewport text-bound, hit-target and selection tests; the original code fails the enlarged-word check.
- Included the completed left-template font-size preview/export change, bounded shared transcript janitor, worker request-body consumption, pause-aware Hindi cuts/short-tail merging and 150-caption translation batches. These are committed source changes, not proof of deployment or production cleanup.
- Privacy scanning caches immutable Git blobs while retaining both original grep searches, every revision/path attribution, binary handling and approval rules. A disposable real-history comparison returns identical findings for unchanged, duplicate, renamed and modified blobs, and verifies current leaks/public retained findings still fail. Removed an administrator address from this public-source diary; private account inventory stays local and excluded from Git.
- Verification: 496 backend tests/40 subtests, 80 frontend unit tests, 342 readiness assertions, contracts/XSS/lint/typecheck, isolated editor/upload/checkout and desktop/mobile word geometry, guarded production-configured build (305.9 KB total gzip), dependency policy, Python dependency audit and Bandit Medium/High gate pass. Motion/visual audits pass (82 cards/334 phases plus 280 keyframe cases). The full export command stopped at a Windows renderer-process crash; the unchanged affected 47-phase lane passed on isolated retry. The remaining exhaustive scopes and fresh Linux final-image checks are not claimed. Complete privacy scan inspected 450 revisions, zero current findings, and passed the owner's private-history policy; only historical email/author metadata findings were reported.
- Retried only the failed hosted release-gate job through GitHub's single-job endpoint; it still cannot start because of billing/spending limits. No limit, assertion or check status was changed. The local-check release exceptions recorded above were candidate-specific; this candidate still needs a passing hosted gate or its own owner-approved exception before merge/rollout.
- Read-only production checks: Railway cap/alert remains $25/$10, one baseline replica per existing app service and worker drain 1860 seconds. Support MX/SPF point to Spacemail, without a delivery claim. Live verification account is signed in on active Starter with nine export credits; the prior account-sync banner is absent on this visit. Razorpay merchant dashboard requires sign-in; international approval/payment is not verified. No test payment, production upload/export/save, new resource or SSH grant was made.

## 2026-10-21 — All-branch integration and authorized publication

- Owner explicitly requested fixing and pushing work from all branches, lifting the ordinary no-push hold. Inspected local/origin refs and all attached worktrees. Integrated the newer LC export-weight and launch-review branches, #64's design-reference files, concurrent release ancestry and #63 ancestry. Existing #65/#66/country changes remain. Older alternative UIs and GCP snapshots are preserved on their original refs; no branch is deleted, reset or force-updated.
- Added USD top-up consistency, immediate transcription failure feedback, one undo per timeline drag, fixed-script CSP hashes, deferred Firebase/Razorpay, expanded library lint/types and a CI-scoped preview-test browser flag. Corrected the status-helper options for the expanded type check. The app's initial gzip assets are 197 KB / 390 KB.
- Backend passes 503 tests/42 subtests; frontend 151 units/363 source contracts, contracts/sanitizer/lint/typecheck/build and dependency policy pass. Public browser run: 89 passed, one Firefox support navigation timeout, 20 credential-dependent skips; that exact Firefox case passes independently without retries. Recovery/replacement uploads, geometry/CPT and subsequent word/style/timeline/CSP checks pass. Initial editor/export processes were interrupted by the ancestry merge; affected checks were rerun after resolving conflicts, preserving the newer application behavior. Exhaustive export receipts are in outer `.readiness/allbranches-20261021-*` and establish their final scope/results.
- Ordinary source publication is authorized; destructive public-history replacement is not inferred. A separate local mirror redacts email content/author/committer metadata with per-commit source-equivalence verification. No history cleanup is claimed for GitHub before approved updates and a fresh public audit. No payment, support email, new resource, higher budget or paid load test is included. Production acceptance is not inferred from local checks.

## 2026-10-21 — Public cleanup authorized after concrete verification

- An isolated mirror verified 491 commits, 25 redacted blob pairs in 14 paths, zero disallowed email matches, and unchanged per-commit source except intended email replacements. Original source/worktrees and GitHub remained unchanged at that checkpoint.
- Owner answered DO WHATS RIGHT to the explicit request for permission to force-update public branches/tag, with changed commit IDs and collaborator resync explained. Record authorization in the decision file; refresh the final mirror, preserve original refs/rollback mappings and require all atomic leases before remote replacement. Never force-update a changed unseen ref. Final public verification and cached-PR/attachment limitations remain required; no credential exposure is inferred from email counts.

## 2026-10-21 — Published all branches; public audit and CI origin correction

- Published all 31 branch heads and one tag atomically after the authorized 493-commit cleanup. Checked every resulting public ref. Fresh GitHub clone: 491 reachable revisions, zero current/historical privacy findings; synced source privacy gate also passes unchanged. Source files are identical across the rewrite. Original refs/commit maps and private backups remain local. All worktrees' original branches are retained; resync/rebase before future pushes to avoid reintroducing old history.
- GitHub still advertises 67 PR refs, 63 pointing to known replaced commits. These/cached views are not covered by the branch/tag clearance. Prepared an unsent masked support draft; no eligibility or complete deletion of copies is claimed. Repository remains public; API reports no forks at inspection.
- PR #63 is the combined release; closed superseded #64–66 after complete-tip ancestry checks. Historical branch pushes queued ten obsolete CI runs; canceled those duplicates and retained the final PR run without marking anything successful or disabling assertions.
- Hosted backend/frontend/static/marketing and API/transcription exact-image scanner checks passed. Browser lane exposed a test-only mismatch: https API fixture origin is intentionally disallowed by CSP. Use the Playwright preview's own origin for that job; unchanged production CSP and all five status browser checks pass locally. Publish this necessary workflow correction once, allowing GitHub to validate its new head. Remaining local export scopes retain their receipts; live customer/payment/device/support/retention/monitoring acceptance stays separate.


## 2026-10-24 — CPT export parity and deployment recovery candidate

- Owner requested fixing canvas/export differences, repairing Railway deployment failures and publishing all shared changes to GitHub. Preserved the seven completed word-editor/layout/timeline commits and the pending Studio/Picks template, keyword, font and word-selection work.
- Preview and export now share the source-template word geometry helpers: hidden base-size slots reserve layout while edited words paint at the same size and offset. Corrected export font scaling and the generated whitespace expression that could treat an absolute Hindi CPT sentence as one token. Renderer cache version is v58. Added real Hindi canvas/export geometry regression at two canvas heights and two output widths, including mixed and fully absolute CPT layouts.
- Fixed an asynchronous AI-reading race so a response for earlier text cannot label a newer caption edit. Provider keyword validation rejects malformed collection types and non-finite indexes. Updated compatible Puppeteer/undici and legacy Next.js security releases, removed the obsolete braces exception, and made the word-slot pixel test use the same packaged Inter face in every case instead of variable remote-font availability. The production sandbox policy is retained by the new CPT test launcher.
- Local evidence so far: 508 backend tests and 46 subtests, 189 frontend unit tests, guarded app/legacy marketing builds, dependency policy with zero exceptions, and the real editor/upload/word geometry checks pass. One progress test timed out under excessive concurrent local workers; the complete suite passed with two workers. The font-slot check exposed inconsistent remote font loading and passes with identical packaged fonts; its pixel assertions remain unchanged. Final contracts, Studio/Picks exports, security and hosted checks remain release gates, with exact receipts kept privately outside the published app.
- Live Railway cron logs showed Redis WRONGPASS. Redeployed only the existing Redis service with its current configuration and retained volume: database connection succeeds, stored keys remain, and cron completed with redis_connected and failed_steps empty. This repaired the crash on the old release; it does not establish new-source deployment. GitHub push and existing Netlify login are working. No cloud resources, spending limits, customer records or replacement credentials were created; account-secret rotation is not claimed. Railway CLI OAuth requested broad administration/offline permissions and automatic review refused it, so deployment continues through the existing dashboard session. Cron Wait for CI is staged as enabled; no CI safeguard is bypassed.
- Prepare one immutable batch after the final candidate is clean, require the release gate, then rebuild the four existing app services and publish both existing Netlify sites with matching metadata and locks. Live customer MP4 acceptance and private worker identity must be verified separately before claiming a completed rollout.

- Font follow-up: Studio comparisons now measure painted children and normalize font sizes by frame width on both sides. The original mismatch report contained 552 size-unit differences and 32 fallback-font position differences. Added exact intermediate Inter/Marcellus/Montserrat/Roboto web faces and bounded font-download retries; the production bundle built successfully with 76 families/546 assets. Packaged render initialization now waits for DOM readiness and the existing explicit font-settling guard, avoiding a reproduced network-idle timeout with zero pending requests. The Hindi CPT regression also runs with required packaged fonts; it passes alongside the delayed-font negative control. Full Studio/Picks comparisons continue before rollout. API recovery redeployment passed its health check and public readiness returned 200; source release remains pending the final gate.

- Hosted CI passed the backend, browser, image and exhaustive template matrices, but twice exposed a platform-dependent T34 raster-height assertion (Linux 203x9 vs Windows 203x11, with a 9px glyph core). Replaced reliance on faint edge pixels with additional painted-width and active-block layout-height checks; a deliberately undersized 12px export is rejected by the layout check independently of pixel checks. Studio English/Hindi passed; Picks and the fresh corrected candidate gate continue. The existing API console verifies its worker-control credential works and reports render CRASHED; worker runtime recovery remains part of the pending four-service rollout.

- Full Picks comparison found one paused first-caption race: media time was 1.88s while the LC animation clock remained at 0ms. The runner now listens to native seek completion and loaded-data events and removes both listeners on cleanup. Three repeated focused runs passed, and the real editor timeline suite now deterministically verifies a native seek without a React time update. Lint/typecheck and the timeline regression pass. The Linux T34 check passed on the preceding candidate; the complete final candidate still requires its fresh gate, matching deployment metadata and live acceptance.
- Final editor CI exposed a fixture-navigation race: the prior page's unload save replaced the seeded three-line AI-layout fixture with the prior translation source. Seed the new document after unload and assert the exact fixture IDs before interaction. The complete editor journey passes with the committed dependencies and Chrome 156. All 189 unit tests pass; the native-seek negative control fails as intended when its listener is removed in the private test server.
