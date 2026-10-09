# Netlify landing page and editor

## Current production routes

| Address | Application |
| --- | --- |
| `https://lekhacaptions.com/` | Current React/Vite `Home` landing page |
| `https://lekhacaptions.com/Dashboard` | Editor from the same Vite build |
| `https://lekhacaptions.com/login` | Current app login page |
| `https://app.lekhacaptions.com/*` | HTTP 301 to the corresponding apex path, retaining the query |
| `https://api.lekhacaptions.com` | Railway API |

The apex site is `lekha-captions`. The existing `lekha-captions-staging` Netlify
site handles old app-domain bookmarks. Keep their VITE_ configuration aligned.
`landing-next/` is a legacy standalone build and must not replace the current
apex homepage. Source files remain available for reference.

## Build and publish

1. Use a reviewed immutable commit from current `main` with the required release
   checks passed. Capture the production frontend environment privately; never
   print environment values or upload backend credentials to the frontend.
2. From the nested application directory, run `npm run build:guarded` with its
   production VITE_ and release metadata. Deploy `dist/` with this directory's
   `netlify.toml`, which supplies the SPA fallback, security headers, asset cache
   policy and old app-domain redirect. Do not use `landing-next/netlify.toml`.
3. Create a draft on the existing apex site, verify the new landing page and
   `/Dashboard`, then publish that exact draft. Preserve the existing production
   lock. Publish the same app release to the old editor site when changing its
   redirect or frontend configuration.
4. Check `release.json`, homepage/editor HTTP 200 responses, JavaScript asset
   MIME types, editor reload, login navigation and old-domain HTTP 301 behavior.
   A hosting-only check does not replace signed-in upload/export acceptance.

The production deployment is manual. On 2026-10-04 the Netlify dashboard showed
no Git repository linked, despite obsolete repository metadata in the API.
Do not assume a GitHub push automatically publishes either frontend site.
Linking a repository requires a separate reviewed configuration change.

## Coordinated release metadata

Capture one full Git SHA, canonical version `git-<first 12 SHA characters>` and
UTC build-batch timestamp before building any artifact. Reuse those exact values
for both Netlify builds and all Railway app-service source rebuilds. Record the
batch once; do not choose a new timestamp independently for each publisher.

Pass the SHA as `APP_RELEASE`/`VITE_APP_RELEASE`, the version as `RELEASE_VERSION`
and the timestamp as `APP_BUILD_TIME` to the frontend build. On Railway retain
its platform Git SHA and canonical version defaults, prepare the common
`APP_BUILD_TIME` with deployments skipped, then rebuild from the approved source.
Updating variables alone does not prove an old running image was rebuilt.
Preserve resource limits, spending controls, source pins and rollback IDs.

Before claiming completion, run `scripts/check-deployed-release.mjs` with the
expected full SHA and both private worker origins from the existing private
network. Public markers alone cannot establish private worker identity. A
hosting-only identity check also requires fresh authenticated customer acceptance.

## Settings

- Netlify `VITE_API_BASE_URL`: `https://api.lekhacaptions.com`
- Netlify `VITE_EDITOR_URL`: `https://lekhacaptions.com`
- Railway `ALLOWED_ORIGINS`: the apex origin; production currently also accepts
  `https://app.lekhacaptions.com` for transition compatibility.
- Firebase Auth must authorize `lekhacaptions.com`; keep Auth, Firestore and
  App Check. Cloudflare R2 CORS must permit the apex upload origin.
- Production media storage is R2. A legacy browser Firebase storage setting
  does not replace the backend MEDIA_S3_ configuration.

## 2026-10-04 acceptance

The current Vite app was published to the existing apex site as deploy
`6ac283e38b3b0905a54a3476`, preserving its production lock. Its release
`51db59053bb59830db9061def8666e4ac50583c8` has the exact source tree of merged
main `5f1345a1776f308bce4949d99ec6f8e9836af05f`. Required reviewed PR workflow
`37213343630` passed. A separate main workflow encountered two template-browser
navigation timeouts; no application source changed during this hosting cutover.

Live checks passed for `/`, `/Home`, `/Dashboard`, `/login`,
`/TermsAndConditions`, `/PrivacyPolicy`, assets, release identity and old-domain
redirect. Browser checks confirmed the current landing page, its editor link,
editor reload and login interface. A fresh authenticated upload/export was not
run for this hosting-only change. No cloud resources or credentials were added.

Netlify showed an overdue team-payment warning. The owner must resolve billing
to prevent an interruption; publishing the app does not resolve the balance.
