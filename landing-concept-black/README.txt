LEKHA CAPTIONS — BLACK STUDIO CONCEPT

Open index.html directly in a modern browser. No setup, build, framework,
external fonts, CDN, or network connection is needed to view the concept.
Keep assets/ and lekha-logo.svg alongside index.html. Product and support
links open the existing online Lekha website/app.

The concept uses black as its dominant color, with the existing #F5A623 gold,
#FFE566 yellow, dark neutral surfaces, and warm white typography. The original
SVG logo combines an L with a caption frame and speech lines. Its navigation
placement is top-left, matching the current page.

EXISTING PAGE INSPECTION
The current React Home uses a sticky navigation with the logo at top-left,
FAQ, Help & Support, Terms, a theme toggle, and an editor CTA. Its content
order is cinematic hero, feature index, use cases, workflow, template demos,
pricing, final CTA, and footer. The separate Next.js marketing site supplies
the public marketing/legal links and canonical app domain.

Verified sources inside caption-studio-publish-main/:
- src/pages/Home.jsx
- src/components/landing2/HeroCinematic.jsx and landingContent.js
- src/components/landing2/FeatureIndex.jsx and WorkflowPlayhead.jsx
- src/components/landing/TemplateShowcase.jsx, PricingSection.jsx, Footer.jsx
- shared/planCatalog.json
- landing-next/app/page.js, lib/site.js, lib/faq.js, components/Footer.jsx

Facts retained: 115+ languages; 100+ caption styles; AI caption generation;
text/timing editing; typography, color, highlight, background and placement
controls; SRT, plain text and copy options; plan-specific HD/4K and translation.
The hero's illustrative caption cards and style studies are labeled as such.
Both modal videos and the editor screenshot are copied from public/landing/.
No new product features, testimonials, user counts, or performance guarantees
were added. The inconsistent 120–180-second speed/duration claim in existing
source variants was omitted.

PRICING SNAPSHOT — 8 SEPTEMBER 2026
                    Starter        Creator        Pro
INR monthly          299            499            799
INR yearly           2500           4500           6500
USD monthly          3.99           4.99           5.99
USD yearly           39.99          49.99          59.99
Monthly credits      15             45             120
Yearly credits       180            540            1440
Max video length     2 minutes      3 minutes      3 minutes
Daily limit          3              5              Unlimited
Export quality       1080p          1080p + 4K     1080p + 4K
Translation          —              Included       Included
Download link        2 hours        24 hours       72 hours

All paid plans: no watermark, 100+ styles, 115+ languages. Annual billing is
the default, consistent with the existing project. Currency is explicitly
selectable, defaulting to INR for this preview. Prices are exact catalog
amounts, not exchange-rate conversions. Plans are one-time purchases and do
not auto-renew. Plan buttons lead to the existing editor; this concept does
not process checkout or promise to preselect a purchase.

LINKS
Primary CTAs: https://app.lekhacaptions.com/Dashboard?entry=editor
Marketing support/legal links retain the existing lekhacaptions.com routes:
/pricing/, /faq/, /help/, /terms/, /privacy/, /refund/, /acceptable-use/, /status/.
Known limitations and changelog retain the corresponding existing app routes.
Email: support@lekhacaptions.com.

VALIDATION
- HTML5 parser: no errors; inline JavaScript parses successfully.
- Direct file:// opening tested in Chromium, with no browser errors.
- All 13 internal anchor links resolve; all 29 IDs are unique.
- All 12 currency/billing/plan combinations match catalog prices and credits.
- Three style states, mobile menu/navigation/Escape, FAQ expansion tested.
- Both videos load; modal closes with Escape and releases/pauses playback.
- Responsive overflow checks at 320, 390, 620, 768, 1024, and 1440 pixels.
- Desktop and mobile screenshots visually reviewed.
- Reduced-motion preference supported; native dialog provides focus trapping.

Existing source files and the earlier landing-concept folder were preserved.
See validation.json for the final check results.

The ZIP contains only the complete portable concept, README and validation
report. Browser QA scripts and review screenshots in this folder are developer
review artifacts and are not required to open the page.
