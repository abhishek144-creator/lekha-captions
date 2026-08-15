# Staging Drill Evidence — 2026-08-04

Environment: Railway project `lekha-captions-staging`
(`7d3ccb49-4549-4295-9de4-365a4d981ae4`).

## Queue/worker recovery — PASS

- UTC window: 2026-08-04 16:58
- Operator: `officialabhisheknaidu@gmail.com` via Codex CLI session
- Action: restarted worker service `06423f9a-923c-4205-b0b5-9594d3b6fddc`.
- Deployment: `5b377c6f-d3c0-4566-848d-0c813c9feb2d`.
- Observed recovery: warm shutdown completed, Firebase Admin initialized, Redis
  reconnected, durable queue `caption_export_jobs` enabled, RQ worker resumed
  listening, and scheduler reacquired its lock.
- Dashboard evidence:
  https://railway.com/project/7d3ccb49-4549-4295-9de4-365a4d981ae4/service/06423f9a-923c-4205-b0b5-9594d3b6fddc?id=5b377c6f-d3c0-4566-848d-0c813c9feb2d

## Load smoke — PASS

- UTC window: 2026-08-04 16:57–16:58
- Operator: `officialabhisheknaidu@gmail.com` via Codex CLI session
- Command: `python scripts/load_smoke.py --base-url <staging-api> --requests 200 --workers 25`
- Result: 200/200 requests completed, no network failures or 5xx responses;
  p95 was 3082.9 ms during cold/trial staging load.
- Distribution: readiness 50×200, version 50×200, protected analytics 50×403,
  protected SLO status 50×403. The 403 responses are the expected unauthenticated
  contract for operator-only endpoints.
- Runtime evidence:
  https://web-production-96d49.up.railway.app/api/health/readiness

## Backup restoration — PASS

- UTC window: 2026-08-04 17:16
- Operator: `officialabhisheknaidu@gmail.com` via Codex CLI session
- Scope: three synthetic records in isolated Firestore namespaces; no customer
  records or production collections were copied.
- Source namespace: `launch_drill_source_8207c596a8ae`
- Restore namespace: `launch_drill_restore_8207c596a8ae`
- Verification: restored count was 3 and the canonical export/restore SHA-256
  values both equaled
  `39d36c37254664a139d3f165102284cb90282fd20751ad99cee5f41329ef1c34`.
- Cleanup: both isolated namespaces were deleted after verification.
- Project evidence:
  https://console.firebase.google.com/project/captionstudio-9dfde/firestore

## Authenticated staging media flow — BLOCKED

- A temporary Firebase user successfully obtained a signed ID token and reached
  the deployed authenticated upload endpoint.
- A benign generated MP4 was rejected because local `clamscan` was killed with
  exit code `-9` under the Railway trial's memory limit.
- The API failed closed with HTTP 422. The synthetic Firebase user and its data
  were deleted after the test.
- An isolated private clamd integration and regression tests were added, but the
  official ClamAV daemon cannot start within the current ~1 GiB service limit.
  The ClamAV deployment was stopped to avoid unnecessary trial usage.
- Required owner decision: enable a Railway plan/container with at least 3 GiB
  RAM for the private scanner, or provide an approved external malware-scanning
  service.

## Payment reconciliation — PASS

- UTC window: 2026-08-05 17:22
- Operator: `officialabhisheknaidu@gmail.com` via Codex CLI session
- Action: called the deployed `POST /api/reconcile-payments` operator endpoint
  using the Railway-managed reconciliation secret and a seven-day lookback.
- Result: the run completed successfully; scanned 0 pending records, applied 0,
  skipped 0, and reported 0 errors. The empty result is expected because no
  captured test payment was awaiting entitlement repair.
- Durable record: the backend stored the run in the Firestore
  `payment_reconcile_runs` collection at `2026-08-05T17:22:49.302063Z`.
- This proves the reconciliation control can be invoked and completes cleanly.
  A Razorpay-originated webhook delivery still requires dashboard access and a
  test transaction.

## Frontend rollback — PASS

- UTC window: 2026-08-05 18:00–18:03
- Operator: `officialabhisheknaidu@gmail.com` via Codex CLI and Netlify dashboard.
- Previous deployment published: `6a7377b790ab7b455bf487b7`.
- Rollback verification: the production alias served the previous
  `/assets/index-X56tHEJx.js` asset and returned HTTP 200.
- Current deployment restored: `6a737a13cda858585b155875`.
- Restore verification: the production alias served the current
  `/assets/index-HKCxX0qs.js` asset; Railway readiness returned HTTP 200 with
  `{"success":true,"ready":true}`.
- Netlify evidence:
  https://app.netlify.com/projects/lekha-captions-app-staging/deploys/6a737a13cda858585b155875

## Account deletion — PASS

- UTC window: 2026-08-05 18:06–18:07
- Operator: `officialabhisheknaidu@gmail.com` via Codex CLI session.
- Scope: one disposable custom-token Firebase identity; the operator's real
  account was not used or modified.
- Setup: called the deployed account-bootstrap endpoint, then seeded a user
  payment child document, upload and expiration documents, and one synthetic
  object under each of the user's upload and export prefixes.
- Action: called the deployed `POST /api/account-delete` endpoint with the
  disposable user's valid Firebase ID token.
- Result: bootstrap and deletion both returned HTTP 200. Follow-up checks proved
  the Firebase Auth identity, Firestore user tree, upload metadata, expiration
  metadata, source object, and export object were all absent.
- Safety: the drill included idempotent cleanup so a partial endpoint failure
  could not leave the disposable identity or seeded objects behind.

## Support intake workflow — PASS

- UTC window: 2026-08-06 17:13–17:14
- Operator: `officialabhisheknaidu@gmail.com` via Codex CLI session.
- Scope: one synthetic request using `launch-test@example.com`; no customer data,
  payment ID, or media was included.
- Action: submitted the deployed public `/api/support-request` form endpoint,
  received ticket `SUP-20260806-F179BB8D`, assigned an owner, and completed the
  documented lifecycle.
- Result: the Firestore `support_requests` record was verified and closed with
  priority, owner, response timestamp, and resolution fields populated.
- Operating procedure: `SUPPORT_TICKET_WORKFLOW.md`.

## Launch-fix deployment — PASS

- UTC window: 2026-08-06 17:10–17:16
- Operator: `officialabhisheknaidu@gmail.com` via Codex CLI session.
- Netlify editor deploy: `6a74c1efc20aca56dab0c48f` (final deploy,
  including sitemap entries; supersedes `6a74c0201835ce4d05a57eaf`).
- Railway web deploy: `37210240-0245-4653-85c2-99ae846c41ef`.
- Verified public routes: `/KnownLimitations`, `/Changelog`, and
  `/HelpAndSupport` each returned HTTP 200. A rendered browser pass found the
  expected headings and no console errors.
- Verified API: readiness returned HTTP 200 with `ready=true`; CORS preflight
  allowed `X-Request-Id`; an intentional validation failure echoed the supplied
  `launch-ref-test-20260806` reference.
