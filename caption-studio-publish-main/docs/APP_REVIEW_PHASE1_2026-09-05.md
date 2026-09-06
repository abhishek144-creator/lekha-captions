# App review — 5 September 2026

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
