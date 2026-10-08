# GitHub consolidation — 8–9 October 2026

Window: 8 September–8 October 2026. Initial main: `211f4e184ddaa9d09aef242e0b3516e25d8ca015`.
Latest main integrated before publication: `1d39f05bb0ace029e723062c03ece8d2bce6e8f7` (mobile release and beta-marker follow-up).
Requested scope: publish all project work from Codex and Claude, including local
work that had not yet reached GitHub. This branch is a source consolidation;
it does not claim a production rollout or a passing combined regression suite.

## Current application changes consolidated

| Source | Included work |
|---|---|
| Reviewed main / PRs #50 and #54 | Editor recovery, save conflicts, undo/account isolation, backend and rendering refactors, USD pricing, worker entrypoint recovery and the previously published launch assets. |
| Claude PR #49, `dbbc66a`, and published main `1d39f05` | Phone/tablet editor, scaled preview, native panels, live scrubbing and application icons. |
| Claude PR #51, `0785f9b` | ASS/DOM size reference, font metrics, script font selection and non-Latin positioning. |
| Claude PR #52, `b8b94d8` | Plain caption word spacing and correctly escaped HTML style attributes. |
| Claude PR #53, `4a6cfe1` | Variable font weight instances, pinned fontTools and existing regression coverage. |
| Claude PR #48, `91fcbdf` | Saved caption correction, upload resume and test-double checkout journey. |
| Claude draft PR #17, `012f01b` | Upload admission/progress/cancellation, device-local playback, shared transcript cache, Sarvam routing and upload funnel metrics. |
| Claude `sweet-feynman-fcqb80`, `6da5c9e` | T41–T52 keyframe templates and their existing export/visual contracts. |
| Codex PR #14, `bf61bb2` | Shared Redis limits for public API keys and historical roadmap audit. |
| Codex PR #27, `4bebfeb` | Vite apex hosting documentation and earlier carry-forward classification. |

The original source branches are merge ancestors, retaining authorship. Conflict
resolutions preserve the latest modular renderer: export reference/script fixes
are ported to `ass_style.py` / `ass_events.py`, font weight resolution uses the
selected script face, and keyframe runtime changes live in
`render_template_page_runtime.mjs`. The combined renderer cache identity is
`2026-10-08-combined-export-parity-v50`. The durable RQ transcription wrapper is
retained. No historical infrastructure configuration is applied by this work.

## Original history preserved separately

Three local branches contain 21 previously unpublished original commits:
`codex/finish-code-health`, `codex/repository-privacy-cleanup`, and
`codex/authenticated-ci-followup`. Publish their original tips to the same
private GitHub repository. Their current useful changes have been carried
forward or reimplemented in reviewed main; the saved journey was subsequently
ported in Claude PR #48. Original abandoned infrastructure designs remain
historical source, not current deployment instructions.

All other inventoried month-old branch tips are either already reachable on
GitHub or included as consolidation ancestors. The JSON companion records each
local/remote ref, its tip, missing-from-main commits, pre-publication remote
reachability and consolidation ancestry. Those fields describe the inventory
before this publication, not a continuously refreshed GitHub state.

## Local source assets

Preserved all 94 non-ignored local source/assets (20,412,737 bytes): the earlier
classification record, one Noto font, two marketing captures and the unpacked
launch-video source tree. Ninety unpacked files are byte-identical to entries
in the source ZIP already committed to GitHub; they are retained at their
original paths as requested. The JSON records individual sizes and SHA-256.
The outer classification file is an exact historical copy; its statements
about unpushed/unported work were superseded, as explained by this report and
the dated notice on the canonical documentation copy.

Private `.env`/credential files, customer uploads/exports, `.readiness`,
dependency installations, generated build directories and temporary verification
logs retain their existing local/ignored status. They are not application
changes to release. Registered Claude worktrees had no uncommitted tracked
changes at inventory time. The original shared checkout was not switched or
reset and its local assets remain available.

## Verification and release limits

This publication inventories refs/assets and reviews/resolves integration
conflicts. A pre-publication scan of newly introduced text blobs found no
private keys, service-account key fields, OpenAI/GitHub tokens, AWS access-key
patterns or accidentally tracked private environment/state files. This limited
scan is not an accredited audit. No fresh combined application tests were run
for this push request; individual prior results do not establish this combined
tree passes. Existing CI workflows and release gates remain intact.

The draft upload workflow refuses free users after their transcription quota
and can add a short language-detection provider call for unknown speech.
Its Firestore transcript-cache TTL policy needs a separate reviewed deployment.
Real phone drag/swipe acceptance and the newly combined template/export matrix
remain to be checked before production publication. Razorpay international
activation/IEC clarification remains separate from code publication.
GitHub Actions is capped at the owner-approved $12 with automatic stopping;
Railway remains $25/$10 cap/alert. This consolidation does not increase caps,
merge to auto-deploying main, waive CI, or publish a new frontend release.
