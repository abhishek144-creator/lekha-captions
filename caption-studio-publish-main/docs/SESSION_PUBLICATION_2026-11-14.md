# Claude and Codex release consolidation — 14 November 2026

The owner requested merging and deploying the hardening fixes together with pending work from both assistants during the preceding month (14 October–14 November). This candidate starts from `57b7b924` and includes hardening commit `1bff72b1`.

## Inventory and preservation

All registered local worktrees and recent local/origin branch tips were inventoried. Most October work and the older alternate-download, landing, marketing-authoring and conversion changes were already consolidated in PRs #91–92. The dated `SESSION_PUBLICATION_2026-11-03.md` records that publication. Those implementations remain in this candidate.

The older mixed-language commit is patch-equivalent to published work. The number/unit implementation and test from the still-open phrase-timing branch are byte-identical to current main; its explanatory note was already included in November. Rewritten-history branches and local backup commits are not merged back into cleaned public ancestry. Their applicable work is represented by newer main, rather than by reviving old commits.

The shared E: checkout contains an additional uncommitted November 14 security checklist batch. Its changes were compared with the candidate before copying; original worktrees were not modified or discarded. The integration adds:

- Production schema/docs disabling and fail-closed missing shared rate-limit state.
- Bounded, owner-scoped management pagination and shared resource-creation limits.
- Explicit text-AI timeout/retry/output bounds.
- Cryptographically random local project IDs and parsed local return-path validation.
- Hidden-page status-poll suspension while preserving job execution and cancellation.
- Improved account-switch browser assertions, security contact information, tests and workspace notes.

The recovery contract harness now supplies the actual visibility helper when executing production recovery functions in an isolated VM.

The older local film lockfile would downgrade the already published Remotion 4.0.540 security update, so the newer published packages/ignore rules remain. The older download-test copy would remove CI's browser sandbox flag, so the published CI-compatible version remains. The hardening report's newer publication note is preserved. Private receipts, credentials, customer media, dependency directories and generated outputs remain excluded.

## Verification and deployment boundaries

The combined candidate passes 644 backend tests and 157 subtests, 366 frontend tests, lint/type checks, the complete local editor/upload journeys and existing export/recovery contracts. Synthetic accounts and API/provider doubles are distinct from production customer acceptance. Release checks and deployment receipts are recorded separately for the final immutable SHA.

Deployment targets are the existing Railway project and the two existing Netlify sites. Keep one shared release SHA/version/build timestamp, production locks, resource limits, spending controls and rollback deployment IDs. No infrastructure apply, new service, budget increase, billing-account change, real payment or paid load test is part of this release. The existing historical Git author-metadata privacy finding remains disclosed; it is not suppressed by publication.
