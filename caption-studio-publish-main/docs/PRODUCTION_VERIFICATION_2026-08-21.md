# Production Verification — 22 August 2026

This record distinguishes production checks completed by the launch operator from
customer journeys that still require real end-to-end evidence. It does not approve
the paid public beta by itself.

## Netlify frontend — PASS

- `https://lekhacaptions.com` and `https://www.lekhacaptions.com` serve the
  production marketing site over HTTPS.
- Every production **Upload Video** call-to-action routes to
  `https://app.lekhacaptions.com/Dashboard`.
- `https://app.lekhacaptions.com` is attached to the editor Netlify project and
  serves the production editor over HTTPS.
- The marketing site production deployment containing Firebase Analytics has
  Netlify deploy ID `6a88420c5d4904b542965ef8` and is in the `ready` state.
- The editor site production deployment has Netlify deploy ID
  `6a885764fad17578083c4fda` and is in the `ready` state. This release contains
  Firebase App Check token attachment, the reCAPTCHA Enterprise CSP allowances,
  production editor routing, owner-bound saved-session restoration, and the
  same-origin Firebase auth-helper proxy.
- The latest editor deployment `6a88595ff7618343120002e3` replaces the
  production-blocked `Function(...)` template DSL evaluator with an allow-listed
  parser. The deployed `SidebarTemplateGallery20` chunk contains the parser and
  no runtime `Function(` evaluator, while the production CSP remains free of
  `unsafe-eval`. This fixes the catalog-empty failure affecting both template
  panels; an authenticated visual click-through remains pending because the
  browser session could not complete Google re-login.
- On 22 August 2026, the production frontend was rebuilt with the live
  Razorpay public key and deployed as Netlify release
  `6a89454f53da9a70bbd22d34`. The live PricingModal bundle contains the live
  public key and Razorpay Checkout script. The temporary anonymous Razorpay
  review mode is disabled in production.
- A follow-up Netlify release `6a894d462eadf5c0365687b9` now gives an explicit
  checkout-not-completed message when Razorpay closes without confirming a
  payment, while preserving the existing in-place verified-payment refresh.
- On 22 August 2026, the Starter monthly test price was changed to INR 99
  (`9900` paise) in the shared plan catalog and published in Netlify release
  `6a8948a5e974de8c7b3dd96b`. Starter yearly and every other plan price remain
  unchanged.
- After the owner completed the test purchase, the Starter monthly price was
  restored to INR 299 (`29900` paise) and republished in Netlify release
  `6a89522fc5b97cdf8317c663` and Railway deployment
  `18646214-bc3a-48ea-9c32-40c08c5102a5`. Starter yearly and every other plan
  price remain unchanged.
- The parser regression check successfully reads all four LC asset sets: 15
  templates each (`T166–T180`, `T181–T195`, `T196–T210`, and `T211–T225`).
- Local template parity and visual audits now pass: 30 advanced templates, 20
  right-side basic templates, 20 left-side templates, 70 cards, and 278 rendered
  phases. The parity contract was aligned with the server-authoritative export
  pipeline, and the T166 audit correctly recognizes its authored LC yellow
  accent rather than the legacy gold bucket.
- The exhaustive export audit also passed: 80 left templates, 123 right advanced
  phases, 60 right basic phases, and 20 scaled basic templates.
- Production was published successfully with the Netlify CLI. The repository's
  Git-triggered Netlify build remains a release-process blocker because its stored
  configuration still resolves a stale absolute Windows base path.
- Both current Netlify releases report `commit_ref: null` because they were CLI
  deployments. An exact clean Git commit therefore cannot yet be claimed as the
  production release revision.
- Local release verification passed with the production API base URL and App
  Check site key supplied to the build guard: contract checks, XSS sanitizer,
  lint, typecheck, production build, and performance budgets all passed.

## Railway services and readiness — PASS

- Railway project `lekha-captions-staging`, production environment, currently
  shows web, worker, Redis, and ClamAV online. Current deployment IDs are web
  `474d14ee-7f15-4219-894a-72c00a6ecfce`, worker
  `4ecdc438-69ca-46fd-9b40-db88f7a43d7b`, Redis
  `3862f7bd-5354-4ed7-b181-4aed77b02129`, and ClamAV
  `c22c3e74-ac8a-4d8e-8428-0e47a030d3bc`.
- `https://api.lekhacaptions.com/api/health/readiness` returned HTTP 200 with
  `success: true`, `ready: true`, `release_gate_passed: true`, queue connected,
  and durable processing enabled at `2026-08-21T12:28:15Z` (request ID
  `ca73e04b`).
- The API was redeployed on 22 August 2026 as Railway deployment
  `912c8ad2-d3bf-4d31-aee4-82b0c117d9d0` so its checkout validation uses the
  same shared catalog as the frontend. Readiness remained HTTP 200 after the
  restart.
- A follow-up Railway deployment `474d14ee-7f15-4219-894a-72c00a6ecfce`
  preserves reconciliation for legitimately captured orders created before a
  later catalog price change, while still binding each payment to its
  server-created order, owner, and plan.
- Production CORS accepts `https://app.lekhacaptions.com` and the intended
  marketing/editor origins, including the `X-Firebase-AppCheck` request header.
- The API and worker use Redis-backed RQ with a binary Redis connection for RQ
  payloads. A stale lease left by an earlier incompatible worker was reclaimed
  only after its durable/RQ state was confirmed terminal.
- This verifies service startup and dependency readiness only. It does not replace
  the authenticated upload, processing, export, scanner-rejection, or alert tests.

### Production variable audit — PASS (22 August 2026)

The Railway web service has non-empty, production-scoped values for Redis,
durable storage, Firebase Admin, OpenAI, Sarvam, Razorpay live credentials,
Razorpay webhook secret, restricted `ALLOWED_ORIGINS`, media signing, and
ClamAV. Sanitized control values are `APP_ENV=production`, `ENV=production`,
`ENABLE_DURABLE_QUEUE=1`, `ALLOW_UNSCANNED_UPLOADS=0`,
`FIREBASE_APP_CHECK_ENFORCED=1`, and `CLAMAV_PORT=3310`. Secret values were not
printed or stored in this record.

The worker log shows RQ registry cleanup for `caption_export_jobs`; the web log
shows scheduled janitor jobs completing successfully and payment reconciliation
running with `success=true` and `errors=0`. Recovery and rollback drills remain
linked from `docs/DRILL_LOG.md`.

## Firebase security — PASS

- Firebase project: `captionstudio-9dfde`.
- The deployed Firestore rules restrict user data to its authenticated owner.
- The deployed Storage rules deny direct browser access; media access is mediated
  by the authenticated backend.
- Google authentication is enabled and the production web domains are authorized.
- Firebase App Check is registered for the production web app and enforcement was
  enabled for both Firestore and Storage on 21 August 2026.
- A two-user cross-account isolation test is still pending and is tracked as a
  separate launch blocker.

## Analytics — PASS

- Google Analytics was enabled for the Firebase project.
- The production Firebase measurement ID is configured in Netlify and the
  Analytics-enabled frontend was deployed in Netlify deploy
  `6a88420c5d4904b542965ef8`.

## Razorpay live configuration — CONFIGURED, LIVE PAYMENT VERIFIED

- The production Railway web service now has the live Razorpay key ID and key
  secret, with the existing webhook secret retained. The service was restarted
  successfully in deployment `0da7f680-6a56-40a7-9a56-06ebcaa76ea8`.
- A read-only authenticated request to Razorpay's Orders API returned HTTP 200.
- A production webhook request with an invalid signature was rejected with HTTP
  400, confirming signature enforcement.
- On 22 August 2026, the Razorpay account had no webhook configured, so an
  active webhook was added for `https://api.lekhacaptions.com/api/razorpay-webhook`
  with payment and refund lifecycle events. Razorpay webhook ID is
  `TSjHD8GveCZZP1`; the endpoint secret matches the Railway runtime secret.
- The owner subsequently completed a live Starter monthly purchase for INR 99
  using UPI. Razorpay reports the order as `paid` with one attempt and the
  payment as `captured`; the production `/api/verify-payment` request returned
  HTTP 200 and the backend recorded `payment_success` for the Starter plan.
- Razorpay also shows a second INR 99 UPI attempt separately marked `refunded`,
  with refund status `processed`; the available balance is therefore INR 99,
  not INR 198. Only the captured payment generated a backend `payment_success`
  event.
- The earlier operator verification itself did not create a live charge or
  refund. Refund lifecycle evidence remains an owner action.

## DNS and mail authentication — PARTIAL

- Public DNS verification on 21 August 2026 returned root A
  `75.2.60.5`, `www` CNAME `lekha-captions.netlify.app`, and `app` CNAME
  `lekha-captions-staging.netlify.app`. All three HTTPS endpoints returned 200.
- MX records resolve publicly to `mx1.spacemail.com` and `mx2.spacemail.com`.
  SPF and DKIM were also present during the operator check.
- DMARC now resolves publicly at `_dmarc.lekhacaptions.com` with monitoring-only
  policy `p=none` and aggregate reports directed to the support inbox.
- The owner completed and confirmed an external send/receive/reply test for
  `support@lekhacaptions.com`; inbound delivery is shown in the Spacemail
  screenshot. See `OWNER_CONFIRMATIONS_2026-08-22.md`.

## Demo media supplied by owner — PASS FOR TESTED HINDI/PORTRAIT PATH

- Local source: `IMG_4695.MOV` (the local filesystem path is intentionally not
  stored in release evidence).
- Size: 21,971,338 bytes.
- Duration: 11.168 seconds.
- Video: H.264, 1920×1080 landscape.
- Audio: AAC stereo, 48 kHz.
- The production Google signup accepted the current Terms/Privacy versions and
  completed the authenticated account bootstrap. The bootstrap request returned
  HTTP 200 with a valid App Check token.
- The 21,971,338-byte MOV uploaded to the production API, passed media validation,
  and processed successfully. Auto-detection selected Hindi and generated six
  timed caption segments.
- After clicking **Save**, a full browser reload restored the video, six captions,
  timeline, and styling. The cache is now bound to the authenticated Firebase UID,
  preventing another account in the same browser from inheriting the session.
- The corrected RQ worker completed 1080p job
  `2d5ec9e7-397f-40a9-857b-71059913ca5f` in 27.6 seconds. The app fetched the
  signed export with HTTP 200 and recorded `funnel.export.success`.
- The browser downloaded `IMG_4695_captioned (37).mp4`: 11,105,005 bytes,
  11.177 seconds, H.264 1080×1920 at 30 fps with AAC 48 kHz stereo.
- A decoded production output frame visibly contains the burned Devanagari
  caption: [production export frame](production-export-frame-2026-08-21.png).
- This proves the tested production upload → process → edit/save → refresh →
  export → download journey. It does not complete the broader media matrix.

## Still required before paid public beta

- Production sign-out/sign-in-again.
- The complete real-video matrix, including Hindi, English, Hinglish, portrait,
  landscape, poor audio, corrupt/unsupported, and near-limit media. The supplied
  source covered Hindi processing and produced a portrait 9:16 export.
- Two-user cross-account isolation.
- Production ClamAV suspicious-file rejection.
- The owner completed a deliberate failed-payment attempt; the production UI
  showed `Payment not completed` and granted no credits. Live capture, signature
  verification, webhook replay/idempotency, reconciliation, refund, and redacted
  payment evidence are recorded in
  [Razorpay redacted evidence](RAZORPAY_EVIDENCE_2026-08-22.md).
- Successful production alert deliveries.
- External support-mail send/reply evidence is owner-confirmed in
  `OWNER_CONFIRMATIONS_2026-08-22.md`.
- Named production contacts, credential-rotation evidence, legal review, CA/tax
  review, and periodic pentest sign-off.
