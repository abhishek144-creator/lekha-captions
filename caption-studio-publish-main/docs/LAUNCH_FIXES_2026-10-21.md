# Local launch fixes — 21 October 2026

The owner's “fix all” follows the complete review in the outer repository's
`.readiness/LAUNCH_REVIEW_2026-10-21.md`. The candidate is on
`codex/launch-fixes-20261021`. The owner has prohibited pushes until separately
authorized. Local integration does not update production or clear live acceptance.

## Fixed in the candidate

| Review finding | Result |
| --- | --- |
| Replacement upload overwrites an existing account project | Integrated PR #65's separate project transition and autosave pause. A real local Dashboard regression holds transcription beyond the autosave debounce and checks both saved projects. Refused and failed replacements also preserve the completed projects; an accepted video remains independently retryable. |
| Ordinary template projects exceed the save byte limit | Integrated shared template markup storage, expansion on restore and local recovery pruning from PR #65. The server's 450,000-byte limit remains enforced. |
| Drafts without IDs hit false revision conflicts | Integrated distinct client project IDs from PR #65. |
| Save rejects projects supported by translation/export | Account draft and track validation now accept up to 1,000 captions. A backend regression saves and restores a 1,000-caption project and track; 1,001 remains rejected. |
| Critical certifi dependency advisory | Hashed backend lock updated to certifi 2026.10.19. The lock audit passes; production images still require rebuilding. |
| Vite dependency gate fails | Updated Vite and its lock to 8.1.6 on the compatible 8.1 patch line. Dependency policy passes without a new exception. |
| Word geometry, undo, text/timeline and template editing | Retained PR #63's geometry and privacy audit fixes while integrating PRs #65 and #66. Stable Dashboard callbacks preserve the history/gesture integration. Resize controls sit outside the text so they do not intercept advanced-template word drags. |
| Word editor covers preview / colour and CPT controls | Integrated PR #66's docked editor, drag/re-drag, resize, Move-button, paint/export and per-gesture undo fixes. |
| International visitor currency | Integrated the existing country lookup, Netlify geo endpoint and shared currency selection branch. Real international purchase/credit acceptance remains separate. |
| Inconsistent artifact identities | Added `npm run release:batch` to prepare one clean-commit SHA, canonical version and UTC batch time for every artifact. The Dockerfile accepts that build-time argument in Python and render images. The deployed verifier remains strict. |
| Transcript retention / maintenance | Retained PR #63's bounded janitor, translation batching, Hindi chunks, template sizing and worker wake-body fixes. Verify maintenance on the released candidate. |
| Scanner refresh | Updated the default signature refresh date and included the date in the release batch. A new build must execute and verify the bounded signature update; this source change does not refresh running containers. |
| Synthetic monitor runner cost | Prepared an hourly workflow schedule in place of every 15 minutes. The remotely disabled workflow stays disabled until the updated schedule is published and intentionally enabled. |

## Verification and receipts

Run frontend commands from the app directory. Backend regression runs from the
same directory with `PYTHONPATH` set to that directory so child-process tests
can import the application.

- `npm run release:check`: release contracts, sanitizer, frontend units/contracts,
  lint, typecheck and guarded production build.
- `npm run test:editor:local`: editor recovery/isolation, delayed/failed/refused
  replacement uploads, word geometry, CPT tools, word editor, styles and timeline.
- `npm run test:templates:all`: motion, visual and exhaustive export scopes.
- `npx playwright test --workers=2`: local public desktop/mobile browser and
  accessibility checks. Credential-dependent tests are skipped without credentials.
- Full backend pytest, hashed-lock `pip_audit`, Bandit Medium/High gate,
  `npm run security:audit`, privacy audit and operations/evidence record checks.

Local run receipts use `.readiness/fixall-20261021-*` in the outer repository.
The final local status report there records exact results and remaining gates.
Neither historical drill records nor local API doubles are fresh production proof.

## Still required for launch

1. Owner authorization to publish the reviewed candidate. No push, remote merge,
   deployment or paid hosted workflow was performed during these fixes.
2. Build and validate the exact Linux API/transcription/render images using the
   shared batch, patched hashed dependencies and fresh scanner signatures. No
   local Docker engine is available in this session; source tests do not replace
   final-image checks.
3. Publish both existing Netlify sites and all existing Railway app services
   with that identity. Verify public metadata/readiness and private worker HTTP
   identity/readiness. The currently deployed metadata mismatch is unresolved
   until this rollout is verified.
4. Fresh final-release upload/scan/transcribe/edit/template/text-layer/save,
   account-only recovery, MP4 download, one debit, repeat-download reuse and
   failure recovery acceptance within the existing approved resource limits.
5. Actual international app purchase and correct credit result. Provider card
   activation was already confirmed; do not request activation again.
6. Physical-phone acceptance, current support delivery and janitor/retention
   verification. Do not silently check these off from local simulations.

Prepare one new batch only after the candidate is committed and clean, then
follow `NETLIFY_DEPLOYMENT.md`. Do not copy a new identity onto old artifacts.
Keep existing billing stops and resource limits; no new paid load run is implied.
