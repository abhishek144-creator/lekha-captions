# Release candidate procedure — 6 September 2026

Status: repository safeguards implemented; this checkout is **not a signed-off or deployed release candidate**. The local editor and marketing builds used CI placeholder identity settings and must not be published. Historical deployment and drill records do not validate these changes.

## One release identity

Build editor, marketing, API and export worker from the same committed SHA. Set shared `APP_RELEASE` (full 40-character SHA), `RELEASE_VERSION`, `APP_BUILD_TIME` (UTC ISO timestamp captured once by the release job), and `RELEASE_ENVIRONMENT=production`; set `APP_ENV=production` for Python. If `VITE_APP_RELEASE` is also supplied it must match. Record image digests, dependency lock hashes, configuration revision, scanner version/signature age, rules/index revision and deployment IDs privately. Never put credentials in the public manifest.

Editor and marketing expose `/release.json`; API exposes `/api/version`; workers expose `/release.json` on their private health listener. Metadata includes schema version, component, SHA, release version, build timestamp and environment. Development/CI can fall back to Git's commit timestamp, which is source time, **not evidence of the actual build time**. Production Python requires explicit release version and build time. There is no separate transcription worker today: transcription belongs to the API release.

The existing frontend meta tag remains compatible. Worker RQ heartbeats carry release identity and draining state; API readiness counts workers matching its SHA. Identity is diagnostic consistency, not cryptographic artifact provenance. Different uncommitted trees can report the same Git SHA: `release:tree` must pass before publishing. Package locks support repeatability; mutable base images, system package downloads and runtime font acquisition still prevent a claim of bit-for-bit reproducible builds.

## Required gates and rollout

1. Review and commit the intended changes. Preserve unrelated work; stage paths explicitly. Run `npm run release:tree` from the app directory on the intended release checkout.
2. Require the GitHub Actions `release-gate` job through branch protection. It aggregates frontend, static template, export, backend/container, marketing and browser lanes. Hosted branch protection is **REQUIRES EXTERNAL VERIFICATION**. CI placeholder builds are not deployment artifacts.
3. Build fresh artifacts with production API/auth/App Check/legal configuration. Run dependency, privacy, operational and launch-evidence gates. Record results against the exact SHA. Do not waive the five pending launch sign-offs.
4. Deploy to an isolated staging environment with separate Firebase/Redis/storage/payment test resources. Verify restrictive rules, IAM, secrets, object lifecycle, scanner health and network egress. Validate real token revocation, two-account isolation, process/export/download, last-credit contention, payment retry/refund ordering and deletion while work is active.
5. Rehearse SIGTERM and SIGKILL during rendering, Redis disconnect/restart, API crash during transcription, scanner outage, full scratch disk and upload loss. Capture user-visible state, surviving processes, storage artifacts, quota/payment receipts and recovery duration. Run backup restoration there. These drills were not executed for this revision.
6. Pause new media admission with service controls. Verify that the pause is effective; do not rely on a control read during a Firestore outage. Let active API transcription/upload work finish. Drain old workers using RQ warm shutdown and wait for active work to finish. The configured Railway 120-second drain is shorter than the 1,800-second RQ timeout; allow sufficient deployment overlap or an explicit maintenance drain. Do not terminate active workers just because readiness becomes false.
7. Keep the previous release available until its queued jobs drain. For incompatible job payloads, use a release-specific `EXPORT_QUEUE_NAME` consistently in API and worker; old workers drain the old queue. This procedure is operational, not automatic queue migration. Do not purge Redis.
8. Start matching workers, then API; verify private worker readiness and public API readiness. Publish editor and marketing last. With the exact expected SHA configured, run `npm run launch:verify-deployed`; provide `DEPLOY_VERIFY_WORKER_URLS` from the private operator network. Compare version, SHA, timestamp and environment across all components.
9. Run authenticated staging/customer smoke and synthetic monitoring; reopen admission gradually. Watch queue age/depth, failures, render duration, scratch usage, worker memory, provider cost and webhook reconciliation. Confirm support and rollback owners are reachable.

No automatic production deploy or branch protection change was made. Current Netlify auto-builds and independently deployed Railway services can still mix releases if operators bypass this procedure.

## Rollback

Pause admission; retain failure evidence and the current database/object state. Drain work under the code version that accepted it. Restore the prior API/worker image digests and corresponding editor/marketing artifacts together, with their prior configuration. Re-run release verification, health and a test-account journey before reopening traffic. Do not roll back payment ledgers or remove account-deletion fences to make old code start.

This phase adds additive metadata, revisions, deletion fences and an order timestamp watermark. Old code does not enforce the new fences/state rules. A rollback to pre-hardening code therefore requires disabling account creation/media/payment mutations until compatibility is established. Prefer a forward fix for these safety regressions. Backfill legacy subscription order timestamps only from verified provider order history; do not invent a timestamp from webhook delivery order.

## Acceptance record

Use `RELEASE_RECORD_TEMPLATE.md`; attach SHA/config/image digests, all gate logs, staged crash/restart evidence, completed restore evidence, cross-component manifests, canonical marketing checks and named approvals. Keep secrets and signed media URLs out of the record. A passing `/health` proves liveness only; `/ready` and an authenticated journey answer different questions.
