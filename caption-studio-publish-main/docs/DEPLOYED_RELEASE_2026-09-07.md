# Verified deployment — 7 September 2026

Application commit: `44215ef5f53e1cba8dfe6a3c013520475d0412b6`.
Release version: `2026.09.07-rc.3`.
Shared build timestamp: `2026-09-06T19:59:13.631803Z`.
Environment: production.

| Component | Deployment | Public identity |
| --- | --- | --- |
| Next.js marketing | Netlify `6a9dc6e6be30ee1cffeffe0a` | https://lekhacaptions.com/release.json |
| React editor | Netlify `6a9dc6e64f3ec472e82c2798` | https://app.lekhacaptions.com/release.json |
| API | Railway `9771cacc-11a7-444f-9fb9-b9d5993ab6a2` | https://api.lekhacaptions.com/api/version |
| Worker | Railway `f28c396c-07d7-41a3-8d85-a8d9fe865786` | Private listener verified from Railway |

`check-deployed-release.mjs` passed from the private Railway network with the explicit application commit above and the private worker origin. All four components matched commit, release version, timestamp and environment. API and worker readiness passed. Processing controls were restored and confirmed unpaused. Temporary deployment SSH credentials were revoked and removed.

Both frontend artifacts were built using the hosting configuration, including the production API/auth/App Check/legal values. The editor uses the API's existing live public payment key and disables anonymous review mode. No secret or private business-estimate file was published. Netlify artifacts are locked against replacement by the older repository connections; those connections need reconciling before automatic publishing resumes.

The canonical Next.js marketing home, pricing, privacy, terms, refund, help, status, FAQ and acceptable-use routes returned HTTP 200. The production-configured editor passed 60 browser cases (58 immediately, two on retry). The final live home/login/public-support checks passed all 15 cases across Chromium, Firefox, WebKit and mobile profiles. The backend baseline passed 155 tests. These are automated profiles, not physical-device or screen-reader acceptance.

Restricted local evidence is retained in `.codex-logs/phase2/`: `final-deployment-evidence.json`, `final-live-release-verification.log`, `final-live-browser.log`, `live-routes.json`, and `runtime-crash-drill.log`. The crash drill used a disposable account and a simulated provider call; it did not charge a real provider.

At the follow-up inspection, final-commit GitHub Actions runs `34056546687` (main) and `34056549108` (release branch) were still in progress. Do not treat this deployment record as an aggregate CI approval or final launch sign-off.

## Remaining acceptance

Preserve earlier owner-confirmed payment, support, tax and capacity evidence. Revalidate affected customer paths for the durable transcription/draft release, especially payment ordering/last-credit contention, saved-draft recovery and deletion during active work. Isolate staging data before destructive restore/failover tests. Record current backup/restore, drain/rollback and failure-recovery evidence.

The compliance checklist still requires independent pentest sign-off, external multi-region/DNS and authenticated-journey monitoring with an independent status page, and physical-device/accessibility acceptance. Higher traffic additionally needs direct resumable uploads, global queue admission/resource limits and measured capacity at the intended traffic level. Enterprise commitments require customer-specific access/privacy controls and independent assurance appropriate to those commitments. This record does not grant those approvals.
