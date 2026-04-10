# Lekha Captions — Development Log

This is the **Work Diary** for the Lekha Captions project.

- **CLAUDE.md** = The Rulebook (stable: build commands, architecture, conventions, known bugs)
- **DEVELOPMENT_LOG.md** = This file — the live session journal

**Workflow:**
1. Start a session → Claude reads this file first to know current TODO and where we left off
2. End a session → Tell Claude "update the log" → Claude appends a new dated entry + updates TODO
3. Run `/clear` → Start fresh, Claude reads here and picks up exactly where we stopped

---

## Current TODO

> Keep this section always up-to-date. It is the first thing read at session start.

- [ ] **Timeline fix** — Speech track background is showing gold stripe. Only the individual caption *blocks* should be gold, not the entire track row background. Fix in `src/components/dashboard/CaptionTimeline.jsx`
- [ ] **Gradient gold buttons** — Replace flat `bg-[#F5A623]` buttons with gradient: `bg-gradient-to-r from-[#FFE566] to-[#F5A623] hover:from-[#F5A623] hover:to-[#D4891A]` across all CTA buttons (14 files)
- [ ] **Text gradient** — Apply `bg-gradient-to-r from-[#F5A623] to-[#FFD700] bg-clip-text text-transparent` to key headings, logo, and accent text
- [ ] **Razorpay demo fallback** — `PricingModal.jsx` `handlePayment`: when backend `create-order` fails (e.g. missing env keys), fall back to opening Razorpay checkout without an `order_id` if `RAZORPAY_KEY_ID.startsWith('rzp_test_')`. Currently checkout never opens on local dev.
- [ ] **Landing footer bottom** — Bottom section / CTA strip color → gold (`src/components/landing/Footer.jsx`)
- [ ] **UserAccount.jsx** — Update `PLAN_LIMITS` constant to new 3-plan structure (starter/creator/pro + yearly variants). Replace all purple/blue gradients with gold. Fix `planKey` lookup.
- [ ] **SidebarNav.jsx** — Update `getPlanDetails()` to map new `starter / creator / pro` tiers with gold color. Remove old purple gradient usage.
- [ ] **Effects / Emphasis button** — Not working in `StyleControls.jsx` and `WordClickPopup.jsx`. Put effects section in a collapsible `+` icon block in both places. Brainstorm: emphasis effect = bold + scale(1.15) + color highlight + optional shadow/glow on word.
- [ ] **Styling tab width** — Increase styling panel width to match caption tab width
- [ ] **Commit + PR** — Commit all uncommitted changes, push branch `claude/stoic-moore`, open PR to `main`
- [ ] **Verify template export fidelity** — User to test all 26+15 templates and confirm exported video matches dashboard preview after Session 5 fixes
- [ ] **Verify Text tab export** — Confirm text boxes added via Text tab (custom color, animation, position) appear correctly in exported video

---

### Session 5 — 2026-04-02

**Theme:** Export pipeline fixes — template fidelity, glow/shadow bugs, text element backgrounds, "Failed to fetch" error

**Completed:**

| Area | What Was Fixed |
|------|---------------|
| **"Export failed: Failed to fetch"** | Vite dev server (port 5000) was not running — no proxy existed for `/api`. Fixed by starting `npm run dev` in worktree. Both services now running: backend port 8000, frontend port 5000. |
| **All shadow/glow templates rendering wrong** | Root cause: `shadow_offset_x \|\| 0`, `shadow_offset_y \|\| 2`, `shadow_blur \|\| 4` in `ExportPanel.jsx` — when a template sets these to `0`, `0 \|\| default` silently overwrote them. Neon templates got y_offset=2 (directional shadow) instead of 0 (glow). Fixed: changed all 4 instances to `??` (nullish coalescing). |
| **Green glow on ALL words** | `global_eff` (glow ASS tags) was unconditionally appended to Layer 0 — all words glowed. Should only apply to active word in Layer 2 karaoke. Fixed in `processor.py`: added `needs_per_word_glow` flag; Layer 0 suppresses glow when per-word glow is active; Layer 2 applies glow only to active word, resets on inactive words. |
| **t-9 Fire / t-12 Horror lost ALL glow** | Over-broad fix suppressed Layer-0 glow whenever `secondary_hex` was present + `is_glow_shadow`. But these templates set `secondary == primary` for uniform global glow. Fixed: `needs_per_word_glow` now also checks `secondary != primary`. |
| **Text element backgrounds not rendering** | ASS `BorderStyle=3` (opaque background box) is a Style-header property — can't be overridden inline. Added second ASS Style `TextBg` with `BorderStyle=3` in header when any text element needs a background. Text element Dialogue lines reference `TextBg` style instead of `Default`. |

**Key Rule Learned — `||` vs `??` for style numerics:**
Always use `??` for any numeric style property that can legitimately be `0`:
- `shadow_blur`, `shadow_offset_x`, `shadow_offset_y`
- `background_padding`, `background_h_multiplier`, `position_y`, `position_x`
Using `||` silently replaces `0` with the default, breaking all templates that zero out a property.

**ASS Glow Logic Summary:**
- `shadow_offset_x=0` AND `shadow_offset_y=0` → **Neon/glow** effect (use `\bord\3c\blur\shad0`)
- Either offset non-zero → **Drop shadow** (use `\shad` with offsets)
- `secondary_color != primary_color` + glow → **Per-word karaoke glow** (Layer 2 only)
- `secondary_color == primary_color` + glow → **Global uniform glow** (Layer 0)

**Files Modified:**
- `src/components/dashboard/ExportPanel.jsx` — `||` → `??` for shadow_blur, shadow_offset_x, shadow_offset_y (global caption style + text element custom_style)
- `backend/processor.py` — `is_glow_shadow` + `needs_per_word_glow` detection; Layer-0 glow suppression; per-word active/inactive glow in Layer 2; `TextBg` ASS style definition for text element backgrounds

**Added to Known Fixed Bugs in CLAUDE.md:** (pending — should be added)
- `||` vs `??` for shadow numerics in ExportPanel.jsx
- Per-word glow suppression on Layer 0 (`needs_per_word_glow` in processor.py)
- TextBg ASS style for text element backgrounds (processor.py)

---

### Session 4 — 2026-04-01

**Theme:** Style/template propagation fixes, animation keyframes, Caption Display mode (word-by-word vs sentence)

**Completed:**

| Area | What Was Fixed |
|------|---------------|
| `VideoPlayer.jsx` — template path | Fixed word timing: was reading `caption.start/end`, now correctly reads `caption.start_time/end_time` — template word highlighting was broken |
| `VideoPlayer.jsx` — template path | Unfroze hardcoded `fontSize: '24px'` → reads `captionStyle.font_size` |
| `VideoPlayer.jsx` — template path | Added full inline style block: `lineHeight`, `fontWeight`, `fontStyle`, `textAlign`, `letterSpacing`, `wordSpacing`, `textTransform`, `animation` — all were missing |
| `VideoPlayer.jsx` — non-template path | Added `letterSpacing` and `wordSpacing` that were previously hardcoded to `'normal'` |
| `VideoPlayer.jsx` — non-template path | Added word-by-word IIFE wrapper: respects `captionStyle.show_inactive === false` to hide future words |
| `captionTemplates.css` | Added all missing `@keyframes` and `.animate-*` classes for 12 standard + 21 advanced animations — animate tab was silently no-oping |
| `StyleControls.jsx` | Added "Caption Display" toggle in Typography section: **Sentence** / **Word by Word** buttons; writes `show_inactive: true/false` to captionStyle; active state uses gold `#F5A623` |

**Architecture Notes:**
- `show_inactive` field: `false` = word-by-word (hide future words), `true`/`undefined` = sentence (show all at once)
- `wordSpacing` formula: `(word_spacing - 1) * 4` px — default `word_spacing=1` → `0px` extra
- Template rendering applies CSS class (`t-XXX`) + CSS variables + full inline style on wrapper → word spans get `.word`, `.active`, `.current`, `.done` classes
- Non-template rendering: inline style applied per-caption-block; words split from `caption.text`
- Backend (`processor.py`) already handles `show_inactive=False` → per-word ASS Dialogue entries; `letter_spacing` → ASS Style Spacing field — no backend changes needed
- Export payload (`ExportPanel.jsx`) already sends all style fields — no changes needed

**Files Modified:**
- `src/components/dashboard/VideoPlayer.jsx`
- `src/components/dashboard/StyleControls.jsx`
- `src/styles/captionTemplates.css`

---

## Session Log

---

### Session 3 — 2026-03-19

**Theme:** Locked pricing structure, Razorpay payment flow, brand gold rebrand (partial)

**Files Modified:**

| File | What Changed |
|------|-------------|
| `backend/main.py` | Full `PLAN_PRICING` dict (6 subscription + 3 topup plans); `create-order` topup tier validation; `verify-payment` split into topup/subscription branches; `VerifyPaymentRequest.plan_id`; `ALLOWED_EXTENSIONS` module-level; Content-Length pre-check; `_upload_rate` eviction; single `os.stat()` in janitor; APScheduler made optional with `_simple_janitor_loop` asyncio fallback; all `from datetime import` consolidated to top |
| `backend/firebase_admin_setup.py` | `firebase_admin.storage` optional import (try/except → `fb_storage = None`); `from datetime import timedelta` moved to module top; `get_storage_bucket()` checks `fb_storage is None` |
| `backend/requirements.txt` | Added: `python-dotenv`, `firebase-admin`, `requests`, `sarvamai` |
| `src/components/landing/PricingSection.jsx` | Locked prices (monthlyInrPrice / yearlyInrPrice); Monthly/Yearly billing toggle (replaced India/International); `planId` with `_yearly` suffix; `plan_id` passed to verify-payment; yearly note shows `₹X billed yearly · ~17% off` |
| `src/components/dashboard/PricingModal.jsx` | Locked prices; Pro credits = 100; `TOPUP_MAP` + `TOPUP_PAISE` constants; `handleTopup()` function fully implemented; `planId` with `_yearly` suffix; yearly badge → -17%; removed 100ms artificial delay |
| `src/Layout.jsx` | Plus Jakarta Sans font added; brand CSS variables: `--brand-primary #1B4D3E`, `--brand-accent #2ECC9A`, `--brand-warm #F5A623`, `--brand-cta #2ECC9A`, `--brand-cta-text #0A3D2C` |
| `src/components/dashboard/UploadModal.jsx` | All purple → `#2ECC9A` brand colors; 39 new languages added |
| `src/pages/Dashboard.jsx` | Empty state icon + "Start Creating" button → `#2ECC9A`; generating loader icon + dots → `#2ECC9A` |
| `src/components/landing/HeroSection.jsx` | Dark theme (`bg-[#0a0a0a]`); stat updated: "2 Transcription Engines" → "120–180s Shorts & Reels Sweet Spot"; `text-[#2ECC9A]` accents |
| `src/components/landing/FeaturesSection.jsx` | Dark theme (`bg-[#0f0f0f]`); cards `bg-zinc-900 border border-white/10`; "Every Regional Language" feature card added |
| `src/components/landing/Footer.jsx` | Dark theme; "Lekha Captions" branding; "Built for every language, every creator 🌍" |
| 14 files (brand swap) | Green (`#2ECC9A`, `#1B4D3E`, `#0A3D2C`, `#27b889`) → Gold (`#F5A623`, `#0A0A0A`, `#000000`, `#D4891A`) — committed in `6c79368` |

**Key Architecture Decisions:**
- `plan_id` is echoed: returned from `create-order`, sent back in `verify-payment` body — avoids amount-matching ambiguity
- Yearly plan IDs use `_yearly` suffix (`starter_yearly`, `creator_yearly`, `pro_yearly`)
- Top-up validation: `create-order` checks user's `subscription_tier` (strip `_yearly`) must match `allowed_tier` in plan
- `is_topup: True` flag in `PLAN_PRICING` distinguishes top-ups from subscriptions

**Commits on branch `claude/stoic-moore`:**
- `a2b63d8` — brand overhaul, security hardening, 115+ languages
- `6c79368` — locked pricing, Razorpay, monthly/yearly billing, top-ups

**Still broken / not started this session:**
- Razorpay demo fallback (checkout doesn't open locally without real backend creds)
- Effects / Emphasis button
- Styling tab width
- UserAccount + SidebarNav plan tier updates
- Timeline speech track background gold stripe
- Gradient gold buttons (flat gold only, not gradient yet)

---

### Session 2 — (prior to first /compact)

**Theme:** Backend stability, export fixes, NotoSans fonts

**Completed:**
- Firebase auth hardcoded bypass removed from `backend/main.py`
- Razorpay + APScheduler imports made optional (backend starts without them)
- Backend running confirmed on port 8000 via `preview_start("backend")`
- "Failed to process video: Failed to fetch" — root cause: backend not running. Fixed.
- `has_background` in export: changed from `!== false` to `!!` (`ExportPanel.jsx`)
- `template_id` / `secondary_color` now included in export style payload (`ExportPanel.jsx`)
- Auto-center hook: `useEffect` on `captionStyle.font_family` triggers font load (`Dashboard.jsx`)
- `NotoSans` entry added to `GOOGLE_FONTS_MAP` (`processor.py`)
- `NotoSansDevanagari` ass_name changed to `'Noto Sans Devanagari'` to avoid collision (`processor.py`)
- Duplicate `import json` removed from `main.py`

---

### Session 1 — (initial worktree setup)

**Theme:** Core bug fixes on stoic-moore worktree

**Completed:**
- Template hard reset: `handleApplyTemplate` now resets `TEMPLATE_OWNED_RESET` props before merging — Template B never inherits bg/color/font from Template A (`Dashboard.jsx`)
- Indic y-correction: `INDIC_Y_CORRECTIONS` dict in fallback ASS path corrects vertical center for Devanagari/Indic scripts (`processor.py`)
- Font selection gate: `onSelect` in StyleControls calls `updateStyle` immediately, not gated on font load success (`StyleControls.jsx`)
- Background Thickness H display: changed from `1.1x` to `(multiplier-1)*100 px` format; default -1.00px (`StyleControls.jsx`)
- `has_background` in export: `!!` not `!== false` (`ExportPanel.jsx`)
- Noto Sans Latin: added `NotoSans` entry in `GOOGLE_FONTS_MAP`; fixed ass_name collision (`processor.py`)

---
