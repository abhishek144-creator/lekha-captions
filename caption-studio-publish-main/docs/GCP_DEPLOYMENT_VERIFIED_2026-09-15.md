# Google Cloud deployment verified — 15 September 2026

The public website, editor, and API are live on Google Cloud. Final checks on
15 September confirmed both regional managed instance groups are stable and
have reached their intended template, both API backends are healthy, and all
runtime dependencies are ready.

## Public endpoints

- Website: https://lekhacaptions.com
- Editor: https://app.lekhacaptions.com
- API: https://api.lekhacaptions.com

All three domains resolve to the Google Cloud public load balancer at
`8.228.230.108`. Certificate Manager certificates for root, www, editor, and API
were ACTIVE. Older unused Compute SSL certificates are not the certificates
serving the public load balancer.

## Repairs applied

- Replaced stale backend/worker release metadata with the verified production
  release `781ca68db427848da417437735b8a05c1cfe1531`. The existing backend code
  matched the current source; the latest source commit changed the frontend.
- Published consistent release metadata across frontend, API, and workers:
  version `781ca68db427`, build timestamp `2026-09-14T17:49:48Z`, production.
- Enabled tenant isolation and removed conflicting development flags.
  Production authentication and App Check were already enforced before repair.
- Saved runtime settings in `lekha-runtime-env` version 12 and updated both
  managed instance templates for future autoscaled/repaired instances.
- Rotated containers sequentially with graceful stops and retained previous
  containers under names ending in `-rollback-20260914`. Root-only rollback
  configuration is under `/etc/lekha/rollbacks/production-20260914` on each VM.
- Corrected both operator media-smoke scripts to bootstrap disposable accounts
  before upload, matching the real signup flow and initializing free credits.

## Deployed identity

- Frontend revision: `lekha-frontend-staging-00012-b4t`, 100% traffic.
- Frontend digest: `sha256:588dccad18b06e9fa13660f94abcea7d5ca2383a5fb30dbc845d671f319f9047`.
- Backend/worker digest: `sha256:a5aa5592fd3b8bdd323bb28e090c6c0559211c6dad2a9c7e3bbaf60011afc0ec`.
- API template: `lekha-api-production-781ca68-20260914`.
- Worker template: `lekha-worker-production-781ca68-20260914`.
- Existing service/group names still contain `staging`; their public traffic and
  runtime release environment are production.

## Verification

- 12 deployed Chromium public-page checks passed.
- 123 backend production-boundary and API-contract checks passed.
- Public authenticated synthetic video journey passed: upload 2.9 seconds,
  transcription 39.2 seconds, export 7.7 seconds, download 1.0 second;
  total 50.8 seconds, downloaded MP4 143,197 bytes.
- The first smoke attempt omitted account bootstrap and was correctly denied
  export for having no credits. The corrected journey passed.
- Cross-tenant requests and requests without App Check returned HTTP 403.
- Authenticated account-store check passed; disposable account cleanup was
  requested through the public account-deletion endpoint.
- Final dependency checks passed for FFmpeg, FFprobe, Node, Redis, Firestore,
  storage, scratch space, two export consumers, and two transcription consumers.
- ClamAV returned PONG. Both queues had zero pending and zero started jobs.
- Three historical failed export records remain, including the initial
  disposable-account smoke rejection; these are not pending work.

## Remaining limitations

Razorpay is configured with test credentials. Live customer charging and a live
payment transaction have not been verified. The synthetic journey validates one
short video, not sustained concurrent media capacity or every caption template.
The root site currently shares the editor SPA deployment and reports component
`editor`; it is not a separately deployed Next.js marketing service.

The metadata-only managed-group update was limited to REFRESH. A future rollout
requiring VM replacement must explicitly permit the appropriate disruptive
action and preserve worker draining.
