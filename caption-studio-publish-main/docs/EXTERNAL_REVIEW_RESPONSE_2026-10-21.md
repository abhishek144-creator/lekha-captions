# Verification of the pasted review — 21 October 2026

The pasted 8.3/10 assessment explicitly did not inspect raw source. Its rating
is an opinion, not launch clearance. Some observations were useful, but its
status and architecture descriptions mix the legacy Next.js site with the
current Vite app. This follow-up verifies the claims against source and public
read-only checks. All fixes remain local.

## Findings and action

| Claim | Verified result and local action |
| --- | --- |
| Homepage error boundary | **Confirmed under blocked storage.** A normal fresh guest loaded successfully. Denying local storage or session storage separately reproduced the live error boundary. Local negative controls also failed when storage was full. Fixed optional theme reads/writes in `Home.jsx` and successful lazy-route imports/retry bookkeeping in `lazyWithRefresh.js`. A failed import only refreshes automatically when its durable one-refresh guard can be written. |
| Firebase/SSR initialization is the cause | **Not established.** The reproduced causes are theme and route-loader storage access. This is a client-rendered Vite app. Auth checks were not weakened or bypassed. |
| All three services are degraded | **Not reproduced.** At 13:57:44 UTC / 19:27:44 IST all three API endpoints returned HTTP 200, healthy payloads and the expected apex CORS header. First-check latency was about 9–11 seconds, not 5–9 milliseconds. Current `/status/` returned the SPA shell with HTTP 200 but rendered a **404 page**; the quoted panel is in legacy `landing-next/`. Restored a public Vite `/status` route. Blocked/network/CORS/401/403/429/invalid-response checks are **unverified**, not proof of an outage. Actual server/readiness failures remain limited availability. |
| Separate liveness/readiness | The API already has separate endpoints. The restored UI presents availability, processing readiness and controls separately. No backend readiness check was weakened. |
| FAQ 25+ versus landing 100+ | **Confirmed.** FAQ and Help now both say **100+ caption styles**. |
| Mixed public URL casing | **Confirmed.** Public links, client aliases, canonical metadata and sitemap now use lowercase paths. Client redirects preserve query and hash. Known CamelCase bookmarks receive Netlify 301 rules before the SPA fallback. Editor/account and OAuth helper paths are retained. |
| Concatenated footer links | Links already had accessible names; concatenated crawler text alone does not prove a screen-reader failure. Improved markup to named navigation landmarks and lists, retaining explicit policy links. Support navigation uses a scrollable layout on narrower screens. |
| Normalize word coordinates | Relative percentages already exist (`x_pct`, `y_pct`, `abs_x_pct`, `abs_y_pct`, CPT canvas percentages), with legacy pixel compatibility. Authored templates use the DOM/CSS worker. The preceding candidate passed 442 export cases; these renderer paths are unchanged here. No unsupported coordinate-schema rewrite was added. |
| Refresh download links without another credit | Authenticated completed-job recovery already issues fresh signed URLs without another render/debit. `export_jobs.py` provides a bounded 15-minute recovery token while object retention remains authoritative; `ExportPanel` exposes reconnection/download recovery. Extending Starter object retention to 24 hours is a separate product/cost decision. |
| Audio extraction guarantees 5–10× speedup | **Unmeasured feature proposal.** Codec support, mobile memory, timing alignment and scan/upload/credit state need a separate design and benchmark. Original media is still needed for rendering. No wasm dependency, paid provider call or processing-before-scan path was added. |
| Editable landing sandbox | Feature proposal, not a reproduced defect. Sample-video showcases already exist; a fully editable sample sandbox is outside these bug fixes. |

Netlify matches redirect paths case-sensitively and normalizes trailing slashes
before applying redirect rules. Slash-only redirects can loop. These changes
use case/alias redirects and client canonicalization instead. Official sources:
[redirect syntax](https://docs.netlify.com/manage/routing/redirects/overview/),
[trailing-slash behavior](https://docs.netlify.com/manage/routing/redirects/redirect-options/#trailing-slash).

## Additional public-history gate

GitHub reports **PUBLIC**. The owner explicitly chose **“Keep public; report
cleanup.”** A public-only audit covers 26 advertised heads/tags and 468
revisions: 725 email-content occurrences and 104 author-email occurrences,
**829 total**, with no supported high-confidence secret-pattern matches.
Some identities are test fixtures; this is not a count of people or confirmed
credentials. See `PUBLIC_REPOSITORY_CLEANUP_2026-10-21.md` for masked evidence
and a reviewable plan. The local policy now requires public-history clearance;
privacy intentionally fails until cleanup is verified. No visibility change,
history rewrite or force-push was performed or newly authorized.

The normal release audit reports zero current-tree findings and 848 historical
occurrences because it also includes the unpublished local candidate ancestry.
The 829 figure above is the separately verified **published-only** scope; the
two scopes must not be conflated.

## Verification

- Three new storage negative controls failed on the preceding production build.
  After the fixes, denied local storage, denied session storage and quota errors
  permit homepage loading and the theme toggle across all five browser profiles.
- **142 frontend units and 342 release-source checks passed**, along with
  contracts, sanitizer and lint. The JS route helper needed a declaration for
  the existing TypeScript URL utility; focused typecheck and guarded build pass
  after that declaration was added.
- Browser matrix: **89 passed, one passed after a Firefox navigation retry,
  20 credential-dependent skips**. The Firefox page was already rendered while
  navigation waited on external resources. Test dependencies are now blocked
  consistently; that exact canonical/query/hash test then passed alone in
  Firefox with **zero retries**. No application assertion was removed.
- Status tests mock API responses; the matrix does not poll production.
  Ten new unit cases cover readiness, server failures, blocked checks,
  malformed responses and paused controls. Live probes used isolated browser
  contexts with analytics writes blocked.
- Initial gzip build total is about **306 KB / 390 KB budget**. Backend,
  rendering and dependency files are unchanged by this follow-up, so the prior
  501-test backend and 442-case export results were not needlessly repeated.

Receipts use `external-review-20261021-*` in the outer `.readiness/` directory.
The earlier batch for `1566016b` is superseded by these additional changes and
must not label a new build. After approved history cleanup, prepare a fresh
clean-commit batch and complete the existing final-image, deployed-identity and
real customer acceptance gates. **No push, deployment, paid workflow, payment
or support message was sent.**
