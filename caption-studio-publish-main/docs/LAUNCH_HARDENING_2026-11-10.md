# Launch hardening — 10 November 2026

Publication follow-up — 14 November 2026: the owner authorized committing and pushing these fixes on `codex/launch-hardening-20261110`. The local/uncommitted descriptions below record the original 10 November review state. Publishing this branch does not merge or deploy it, resolve the historical privacy finding, or establish fresh production acceptance. The publication result and commit identity are reported separately in the chat.

Status: local fixes implemented and verified; production launch acceptance remains pending.

This work does not justify a 10/10 production rating. The previous review's demonstrated source defects are addressed below, but the new code has not been committed, published or deployed. Real provider output, settlement, physical-device behavior and the final coordinated release still require observed acceptance.

## Release and work preservation

- Branch: `codex/launch-hardening-20261110`.
- Base: deployed `origin/main`, `57b7b92491805998cd31daf36ebff1b463f76cd0`.
- Workspace: `C:/Users/ADMIN/.codex/worktrees/launch-hardening-20261110/caption-studio-publish-main`.
- The older shared checkout and its uncommitted work were preserved. Its incomplete alternate-download integration was not copied over the complete deployed implementation.
- All application commands run from this repository's nested `caption-studio-publish-main` directory.
- Production data, billing, payments, deployment configuration and published Git history were not changed. No paid load tests or real provider jobs were initiated.
- Builds used existing public `VITE_` configuration without copying or printing private credentials. Local build version: `hardening-local-test`. Its base SHA is provenance, not proof that the dirty working tree is the deployed release.

## Changes

| Review finding | Implementation and verification | Status |
| --- | --- | --- |
| F1: Late translation crosses an account boundary | Added account/document epochs and operation cancellation in `src/hooks/useDocumentOperations.js`; guarded Dashboard translation, upload/transcription, relink, media refresh, template reading and save feedback. Real Dashboard tests hold a translation across A→B and A→B→A, release it and check UI/storage isolation. Hook tests cover project/source changes, content edits, reset, replacement and unmount. | Fixed locally |
| Related authentication replay risk | `src/lib/apiClient.js` binds authenticated requests to the initiating Firebase user and JWT subject. A late 401 cannot refresh/replay with the next account or log that account out. Tests cover late 200/401, same-account refresh, mismatched subject and switching during token refresh. | Fixed locally |
| Related cloud-project races | `useCloudProjects.js` rejects stale account/scope results, including A→B→A, and keeps the latest project selection when responses arrive out of order. Draft persistence ignores obsolete save failures/retries and stale account recovery. | Fixed locally |
| F2: GitHub synthetic runner cannot execute | Fresh read-only Sentry API inspection confirmed existing monitor `10770277` is active and checks the API health URL every 60 seconds. This supplies basic uptime coverage. GitHub's deeper DNS/API/authenticated monitor still needs its account lock resolved or an approved runner. No billing settings were changed. | External blocker remains |
| F3: SDK blocked by browser App Check | Exempted only the existing GET `/api/v1/projects`, project-detail and export-detail routes. The actual HTTP middleware integration tests require valid keys, scopes, revocation checks and owner isolation. Browser key management, writes and unknown nested paths still require App Check. | Fixed locally |
| F4: Production limiter uses the wrong environment variable | Public API limiter now uses canonical `settings._IS_PRODUCTION`, retaining shared Redis enforcement and failing closed when unavailable. Tests cover production with APP_ENV only, shared instances and an explicitly nonproduction runtime. | Fixed locally |
| F5: Transient backup failure skips the night | Added a shared Redis lease/state, at most three attempts, 15-minute backoff and one document budget shared across retries. Unknown usage after a crash consumes the remaining reservation. Size/budget exhaustion is terminal. An active lease is not renewed by a second process merely checking its state. | Fixed locally |
| Backup integrity and restore safety | Immutable attempt data objects; manifest published last and upload result checked. New manifests contain SHA-256, compressed size and document count. Restore validates the entire snapshot and tagged values before its first write. Reserved type-tag collisions in customer maps round-trip safely. Legacy manifests still require a valid complete snapshot/count but cannot provide a cryptographic checksum. | Fixed locally; real restore drill pending |
| F6: Nested dependency noise in privacy gate | Excluded untracked generated/dependency directories at every nesting level. Tracked files are always scanned. Historical synthetic header-injection address is exempted only at its exact fixture path/value; unknown fixture values and public history still fail closed. Regressions exercise disposable Git repositories and compare cached/full scans. | Scanner fixed; one genuine history finding remains |
| F7: Timing-sensitive QA | Progress animation test uses deterministic animation frames and checks smooth monotonic progress. Upload test uses a finalized synthetic MP4 instead of streaming WebM with uncertain duration. Editor/upload test servers ignore unrelated generated-file watch events. | Fixed locally |
| Editor performance coverage | Vite manifest enables an editor static-dependency budget and per-chunk limits, supplementing public-entry budgets. A deliberately tiny route limit was confirmed to fail. | Implemented and passed |

Cancellation stops client monitoring/retries; it does not claim to cancel a provider job already durably accepted by the backend. Its existing idempotency and recovery rules remain in force.

## Verification

Local evidence is under `test-artifacts/` (ignored by Git). No log contains real customer transcripts or payment credentials.

| Check | Result and limit |
| --- | --- |
| Backend full suite | 632 passed; 143 subtests passed. Existing dependency deprecation warnings remain. A final targeted backup run also verifies persisted crash-budget state. |
| Frontend unit suite | 350 passed across 37 files. Final complete run recorded in `test-artifacts/frontend-hardening.log`; includes account/session, cancellation, editing, billing and recovery tests. |
| Lint and JavaScript type checking | Passed. |
| Production build | Passed locally; source-map uploads disabled. |
| Editor/upload browser journeys | Passed with real Dashboard/components and isolated auth/network doubles, including the originally reproduced account leak. These do not prove production ASR accuracy or actual settlement. |
| Public desktop/mobile browser suite | 36 passed in desktop and mobile Chromium, including serious/critical Axe checks, overflow, public routes, status failures and blocked browser storage. Physical devices, Firefox and WebKit were not rerun in this hardening pass. |
| Existing editing/export/recovery contracts | Passed, including MP4-delivery helpers, font/paint/size/reveal/CPT export checks, translation boundaries, project delivery and release metadata contracts. Network upload recovery was rerun after signal propagation. |
| Release source contracts | 363 passed. |
| Dependency advisory gate | Passed: no unreviewed high/critical advisories and no documented exceptions. |
| Performance gate | Passed; editor static assets about 933 KB raw / 278 KB gzip, against 1100/330 KB. Every JS chunk is bounded at 750 KB raw / 150 KB gzip. This is an asset-size gate, not a throughput or real-mobile-memory benchmark. |
| Privacy scanner regression | Passed. Real audit: 568 revisions, zero current findings, one historical author-email record. Gate correctly remains failed. |
| Operations profile and launch evidence scripts | Passed on existing approved configuration/25 recorded drills. These scripts accepting dated records is not fresh validation of this candidate in production. |
| Existing Sentry uptime configuration | Read-only API returned active, 60-second interval. Actual notification delivery was not triggered. |
| Clean release/deployed gate | Pending: this is an uncommitted candidate; no new release was published. |

## Remaining launch gates and five next actions

1. **Resolve the published-history privacy decision.** The audit identifies commit `8711ef9d9651`, fingerprint `e1f8b01a6c83`; no email is reproduced here. Coordinate an explicitly approved author-metadata cleanup/public-history rewrite or an explicit visibility/retention decision. A mailmap alone does not remove raw history. Re-run the unmodified privacy gate afterward. Effort: small technical change, medium coordination.
2. **Restore the deeper scheduled synthetic check.** Resolve GitHub's runner billing/account lock within the existing spending limits, or approve a bounded existing-runner alternative. Observe a successful scheduled run and safely simulated alert delivery. Keep the confirmed Sentry uptime monitor. Effort: small, external account access required.
3. **Review and publish one coordinated candidate when authorized.** Review this isolated diff, commit it without incorporating unrelated work, run the hosted gate once, and deploy the same SHA/version/build-time to frontend, API, render, transcription and cron. Check private-worker HTTP readiness from the authorized network and prepare rollback to the prior release. Effort: medium. No deployment was performed here.
4. **Complete fresh isolated customer acceptance on that final release.** Google sign-in/onboarding and recovery; short representative English/Hindi/Hinglish uploads; human-reviewed words/timing; styling, detached words and animation; source recovery; MP4 playback/download; exactly one debit, replay and failed-job recovery; one current complete backup restored into an isolated target. Include a physical phone and interrupted network. Effort: medium. Do not substitute build success for this evidence.
5. **Finish payment acceptance within explicit transaction authorization.** Verify sandbox lifecycle/duplicates/refunds and supported currencies, then owner-completed current international acceptance where enabled, correct subscription/credits and support confirmation. No real payment or refund was initiated. Effort: small-medium, provider/account access required.

The original review's broader visual-design preferences and longer-term template/runtime consolidation are not prerequisites for repairing these defects. Existing intentional word-size spacing behavior was preserved. General public-scale throughput, human ASR quality and real payment acceptance remain unverified, so an unrestricted 10/10 launch claim would be unsupported.
