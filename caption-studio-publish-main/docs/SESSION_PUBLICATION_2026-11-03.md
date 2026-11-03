# Session source consolidation — 3 November 2026

The owner requested publication of pending project changes from both Claude and Codex sessions. The consolidation starts from production commit `726769c4eb2e3110f85f706271a6970098c99de0` (PR #91). Existing shared checkouts and their local copies are preserved.

## Included source

- Landing-page video clarity and template keyword colors were already merged in PR #91. This batch retains them and adds the corresponding legacy Next landing-page layout and its existing video/poster assets.
- The local editor recovery work adds an explicit alternate download for completed exports. The authenticated signed route streams the same stored object in bounded chunks, supports a single byte range, and closes storage bodies. The action creates no render or credit debit. Direct delivery remains available.
- Development startup derives a checkout identity and rejects servers from a different release. Historical local setup and export-recovery notes are retained as dated records.
- Pending signup conversion tests cover consent, duplicate suppression, and new-account gating.
- Launch-video v2 variants and the v7 Remotion authoring project are included with controlled sample UI recordings, fonts, capture scripts, and score-generation source. The v7 project remains an unfinished authoring draft; it is not a completed final film or a replacement homepage video. Generated bundles, raw takes, and generated audio remain ignored.
- Claude's number/unit caption phrasing behavior and regression test were already integrated into current main by subsequent work. Only the missing dated explanatory note is added from the older branch; the old branch must not replace newer backend code.

## Audit boundaries

All discovered worktrees and local branch tips were reviewed for pending source. Historical branches already published or superseded by later main changes are preserved in place. Old backup/history refs are not republished: they contain obsolete code and private operational artifacts, and their applicable quota and reliability changes are already in main.

Credentials, ignored environment files, customer uploads, provider responses, billing screenshots, advertising planning evidence, local operational receipts, dependency folders, and generated build outputs remain local. Their exclusion does not discard source work. The repository privacy gate scans the candidate source and public remote history before publication.

## Release checks

The consolidation is submitted through the normal protected-branch PR workflow. Frontend unit/type/lint checks, affected backend tests, synthetic stalled-download recovery, the real editor journey, and the film author's lint/bundle checks are run before submission. Hosted release gates must pass before merge. Deployment uses the existing Netlify sites and Railway services with one shared release identity; no new services or budget increases are part of this work.

PR #91 was independently verified live before this consolidation: both frontend sites, API, render worker, transcription worker, and cron matched the merged release. Fresh HTTP checks and the repository deployment verifier passed. The combined release requires its own verification after merge.


### Completed local validation

- 335 frontend unit tests; application lint and both TypeScript configurations pass.
- 134 affected backend tests, including bounded export streaming, ownership/range contracts, export reliability, and caption phrasing, pass.
- The stalled direct-transfer browser regression completes the alternate transfer without a new render. The full editor journey passes, including alternate download, caption edits, text-box positioning/removal/undo, recovery, revision conflicts, named controls, upload resume, translation limits, and checkout.
- The existing privacy audit was run across 566 reachable public revisions and the candidate tree. Its current-source match is the existing deliberately hostile `evil.test` address in a header-injection test. Historical matches are that same synthetic fixture plus one existing author-email metadata occurrence. These predate this batch. No credentials or real private media were added, and this release does not rewrite public history or weaken the privacy checker.

- Film authoring lint, TypeScript, and the Remotion bundle pass after a clean lockfile install. All Remotion packages are pinned to 4.0.540, removing the high-severity Zod dependency advisory. `npm audit --audit-level=high` passes; 11 moderate findings remain in the development ESLint/minimatch dependency chain with no compatible upstream fix reported. The authoring toolchain is not installed or served by the production app.
