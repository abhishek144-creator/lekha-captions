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

### Active Worktree: `claude/stoic-moore`
Path: `C:\Users\ADMIN\Downloads\caption-studio-publish-main\.claude\worktrees\stoic-moore\caption-studio-publish-main\`

### Pending Tasks
- [ ] **GSAP Lab templates — commit & push worktree** — The GSAP system (Kaleidoscope + Montage) was built in the `stoic-moore` worktree but NOT committed yet. Files: `src/lib/gsap-setup.js`, `src/components/dashboard/GsapCaptionRenderer.jsx`, `src/components/dashboard/TemplatesTab3.jsx`, `src/components/dashboard/gsapTemplates/`, `src/styles/captionTemplatesLab.css` + edits to `SidebarNav.jsx`, `Dashboard.jsx`, `VideoPlayer.jsx`
- [ ] **StyleControls.jsx JSX fix** — File was restructured (new section order: Position → Typography → Colors → Background → Effects → Extras) but has JSX syntax issues from the restructure. Needs careful review and fix before committing.
- [ ] **Effects / Emphasis button** — Not working in `StyleControls.jsx` and `WordClickPopup.jsx`. Emphasis effect = bold + scale(1.15) + color highlight + optional shadow/glow on word.
- [ ] **Razorpay demo fallback** — `PricingModal.jsx` `handlePayment`: when backend `create-order` fails, fall back to opening Razorpay checkout without `order_id` if `RAZORPAY_KEY_ID.startsWith('rzp_test_')`.
- [ ] **UserAccount.jsx** — Update `PLAN_LIMITS` to new 3-plan structure (starter/creator/pro + yearly). Fix `planKey` lookup.
- [ ] **SidebarNav.jsx** — Update `getPlanDetails()` to map `starter/creator/pro` tiers correctly.
- [ ] **More GSAP Lab templates** — Quantum (ScrambleText + tile flip), Prismatic (MorphSVG blob), Aurora (venetian blinds + weight wave) — 3 more templates planned for the Lab tab.

### Completed This Week (already on GitHub main)
- ✅ Full UI polish batch (Sessions 4–6): fullscreen overlay button in VideoPlayer, waveform redesign (white spikes), gold removal from templates/animate tab, export panel polish, sidebar/caption tab color balance
- ✅ StyleControls section restructure (Position → Typography → Colors → Background → Effects → Extras)
- ✅ GSAP Lab tab system built (Kaleidoscope + Montage templates, GsapCaptionRenderer, TemplatesTab3, Lab sidebar tab)
- ✅ All changes pushed to GitHub (`origin/main` fully up to date as of 2026-03-23)

---

## Session Log

---

### Session 6 — 2026-03-23

**Theme:** GSAP Lab template system, git sync to GitHub

**Completed:**

| File | What Changed |
|------|-------------|
| `src/lib/gsap-setup.js` | NEW — imports gsap@3.14.1 + registers SplitText, DrawSVGPlugin, ScrambleTextPlugin, TextPlugin, CustomEase |
| `src/components/dashboard/GsapCaptionRenderer.jsx` | NEW — React component managing GSAP template lifecycle (setup/update/clean with useEffect) |
| `src/components/dashboard/gsapTemplates/index.js` | NEW — registry: `labTemplates` array + `getLabTemplate(id)` |
| `src/components/dashboard/gsapTemplates/kaleidoscope.js` | NEW — 3-variant cycling (Rise Reveal / 3-Level Bebas Stack / Split Card), cycles `captionIndex % 3` |
| `src/components/dashboard/gsapTemplates/montage.js` | NEW — documentary editorial: Playfair Display, lines slide from left, gold power word + DrawSVG underline |
| `src/components/dashboard/TemplatesTab3.jsx` | NEW — Lab tab UI with animated mini-previews (rAF loop), template cards, "GSAP" badge |
| `src/styles/captionTemplatesLab.css` | NEW — scoped styles for GSAP containers |
| `src/components/dashboard/SidebarNav.jsx` | Added `FlaskConical` import + `{ id: 'templates3', icon: FlaskConical, label: 'Lab' }` to navItems |
| `src/pages/Dashboard.jsx` | Added `TemplatesTab3` import + `{activeTab === 'templates3' && <TemplatesTab3 .../>}` render |
| `src/components/dashboard/VideoPlayer.jsx` | Added `GsapCaptionRenderer` import + `captionTemplatesLab.css` import + `t-lab-*` branch before CSS template path |

**Key Architecture:**
- `t-lab-*` template IDs trigger GSAP renderer; all other `t-*` IDs use existing CSS path — zero conflict
- Word timing: `computeWordState(caption, currentTime)` in GsapCaptionRenderer uses `caption.words[].start/end` for per-word precision; fallback to even distribution
- Multi-style cycling: `captionIndex % 3` determines variant per caption (0=rise, 1=stack, 2=splitcard)
- Export: lab templates are preview-only; backend uses standard fallback rendering for `t-lab-*`
- Fonts used: `Bebas Neue` (stack variant), `Playfair Display` (montage + splitcard top line), Inter (rise reveal + card text)

**Git:**
- Committed 6 previously-uncommitted files in main repo (`96efefe`)
- Pulled GitHub PR merge commit (`db8ee21` — user's manual PR from GitHub UI)
- Pushed all 12 commits to `origin/main` — GitHub fully up to date
- **GSAP Lab files NOT committed yet** — still unstaged in `stoic-moore` worktree

**Still pending:**
- Commit GSAP Lab files to `stoic-moore` branch and push
- StyleControls.jsx JSX syntax review (restructured sections may have unclosed divs)

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
