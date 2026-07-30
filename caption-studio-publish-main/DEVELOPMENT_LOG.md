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

- [ ] **Deployment architecture reminder** - Host the SEO landing/marketing site separately on Netlify at `lekhacaptions.com`. Keep the dashboard/editor app separate at `app.lekhacaptions.com`. Do not touch the dashboard/editor now; revisit making the app server-side during the deploy phase, not in the current work.
- [ ] **Timeline fix** — Speech track background is showing gold stripe. Only the individual caption *blocks* should be gold, not the entire track row background. Fix in `src/components/dashboard/CaptionTimeline.jsx`
- [ ] **Gradient gold buttons** — Replace flat `bg-[#F5A623]` buttons with gradient: `bg-gradient-to-r from-[#FFE566] to-[#F5A623] hover:from-[#F5A623] hover:to-[#D4891A]` across all CTA buttons (14 files)
- [ ] **Text gradient** — Apply `bg-gradient-to-r from-[#F5A623] to-[#FFD700] bg-clip-text text-transparent` to key headings, logo, and accent text
- [ ] **Razorpay demo fallback** — `PricingModal.jsx` `handlePayment`: hardcoded `rzp_test_*` key removed (security fix). Now `RAZORPAY_KEY_ID = ''` in local dev unless `VITE_RAZORPAY_KEY_ID` is set. Need to implement graceful fallback: use key from backend `create-order` response (`orderData.key_id`) and only throw if that is also empty. Currently checkout never opens on local dev without env var.
- [ ] **Landing footer bottom** — Bottom section / CTA strip color → gold (`src/components/landing/Footer.jsx`)
- [ ] **UserAccount.jsx** — Update `PLAN_LIMITS` constant to new 3-plan structure (starter/creator/pro + yearly variants). Replace all purple/blue gradients with gold. Fix `planKey` lookup.
- [ ] **SidebarNav.jsx** — Update `getPlanDetails()` to map new `starter / creator / pro` tiers with gold color. Remove old purple gradient usage.
- [x] **Effects / Emphasis button** — Verified 2026-07-21: works in `StyleControls.jsx` (collapsible `Effects−/+` block present; selecting Neon applies a live multi-layer `text-shadow` glow to caption words in preview). Not re-checked in `WordClickPopup.jsx`.
- [ ] **Styling tab width** — Increase styling panel width to match caption tab width
- [ ] **Set remaining env vars before deploy** — `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` (backend `.env` stubs already exist); `VITE_RAZORPAY_KEY_ID` (frontend `.env`); `ALLOWED_ORIGINS` (comma-separated prod domains). `DEV_MODE=false` is already set. **`CREDITS_HMAC_SECRET` is now blank — generate a new secret before deploying** (`python -c "import secrets; print(secrets.token_hex(32))"`). App will fail silently on payments/CORS without these.
- [x] **Verify template export fidelity** — Verified 2026-07-21: `npm run test:templates:all` (motion + visual + export parity across all-left, LC, all-right-phases, all-basic, all-basic-scaled scopes — ~130 templates) passed with 0 failures.
- [ ] **Verify Text tab export** — Confirm text boxes added via Text tab (custom color, animation, position) appear correctly in exported video
- [ ] **Verify FPS in export** — Test 24/30/60 fps selector in Export tab produces correct output video frame rates
- [ ] **Verify zoom/transition animations** — Test zoom_in, zoom_out, fade_in, slide_up/down/left/right in Animate tab → Basic category work correctly in preview

---

### Session 13 — 2026-06-09

**Theme:** Template highlight colors → 3 bright colors, editable text box on template captions, upload MIME fix, and a permanent reference for how templates get applied.

---

#### 🔑 REFERENCE — How templates get applied (read this first if "templates not applying")

This is the canonical map of the template pipeline. If a template ever stops
applying, walk these stages in order — the break is almost always one of them.

**1. Two template families, two galleries**
- **LEFT gallery — the 69-set** (`SidebarTemplateGallery20.jsx`): sets
  `template_20_id` + `template_source` + `template_class` + `template_layout` +
  `template_markup` + `secondary_color`. This is the family in the screenshots.
- **RIGHT inspector** (`AdvancedTemplateLibrary.jsx`): sets `template_id` only.

**2. Style extraction (left family)** — `extractTemplateStyleFromPreview()` in
`SidebarTemplateGallery20.jsx` reads the template's CSS rule (font, size, weight,
color, letter-spacing) and `extractAccentColorFromMarkup()` derives the accent
from the markup class (e.g. `ns3-green`, `imp-pink`) via `TEMPLATE_ACCENT_COLOR_MAP`
→ becomes `secondary_color`.

**3. Apply** — `Dashboard.handleApplyTemplate()`:
  - resets `TEMPLATE_OWNED_RESET` props first (so Template B never inherits
    Template A's bg/color/font),
  - merges the extracted template style into `captionStyle`,
  - runs `resolveScriptFont(fontFamily, text)` (`fontUtils.jsx`) to remap the
    Latin display font to a matching **Devanagari** font when the caption is
    Hindi (CRITICAL — a Latin-only font is invisible on Devanagari and looks
    like "template not applied"). Always test templates on Hindi text.

**4. Render (in-page, NOT iframe)** — `VideoPlayer.jsx`:
  - `hasSidebarTemplateStyle(captionStyle)` → true when `template_20_id` exists
    or `template_id` starts with `sidebar-`. This + `caption.template_20_id`
    sets `isSidebarTemplate`.
  - `isSidebarTemplate` → `renderAppliedSidebarTemplateCaption()` renders the
    template as in-page React spans (the old `<iframe srcdoc>` overlay is dead).
  - Per-word emphasis: `selectSemanticEmphasis()` (`emotionalTemplateUtils.js`)
    picks the strongest non-stop-word in each caption and colors it from
    `EMPHASIS_COLORS`. That color is passed down as the `emphasisColor` prop.
  - Template accent renders as the `--sidebar-source-accent` CSS var (=
    `secondary_color`); text color as `--sidebar-source-color`.

**5. Export** — `ExportPanel.jsx` captures DOM word positions → `POST /api/export`
→ backend `_create_styled_ass` → FFmpeg burn (ASS, not CSS).

**Common break points:** (a) `secondary_color`/`emphasisColor` equals the text
color → highlight invisible; (b) Devanagari font not remapped → looks unstyled;
(c) `hasSidebarTemplateStyle` returns false because `template_20_id` got dropped
on merge → falls back to plain rendering.

---

#### Changes this session

| # | Area | Change |
|---|------|--------|
| 1 | **Highlight palette → 3 bright colors** | `EMPHASIS_COLORS` (`emotionalTemplateUtils.js`) reduced from 6 pastel colors to **3 bright**: yellow `#FFE600`, green `#22FF66`, red `#FF2E2E`. This is the per-word cycling highlight seen in the preview. |
| 1b | **Template accent map → 3 bright colors** | `TEMPLATE_ACCENT_COLOR_MAP` (`SidebarTemplateGallery20.jsx`) now collapses every legacy color name (gold/rose/cyan/purple/orange/blue/pink…) onto the same 3 bright values, so applied-template accents are never pale. Warm→yellow, green/cyan/blue→green, red/rose/pink/purple→red. |
| 2 | **Editable text box on template captions** | `VideoPlayer.jsx` caption overlay: template (sidebar) captions now show the same selectable/hover purple border as normal captions, use `pointerEvents:auto`, and are double-click editable (the existing `handleCaptionDoubleClick` → `isEditing` → contentEditable path already worked; it just had no visible affordance). Dragging/resizing/delete remain disabled for templates on purpose, to avoid shifting template layout. |
| 3 | **Upload MIME fix** | `backend/main.py` upload handler: browsers send `application/octet-stream` for some videos; the extension check is now authoritative and that generic type is no longer rejected ("Failed to process video"). |
| 4 | **Export word spacing** | `scripts/render_template_overlay.mjs` — added `column-gap: 0.28em` to `.lekha-sidebar-export-template-shell .wbw`, `.wbw-line`, `.sw-line`. Root cause: flex containers drop whitespace text nodes between word spans, causing Devanagari words to touch. Mirrors the preview fix in `VideoPlayer.jsx` `APPLIED_TEMPLATE_HOST_OVERRIDES`. |
| 5 | **Export hero word recolor** | `scripts/render_template_overlay.mjs` — added `getComputedStyle`-based hero-recolor IIFE inside `activateSidebarTemplateShells()`. Detects bold tier (≥18% font-size gap or ≥700 weight with ≥200 gap from minimum), moves `emphasisAccent` from `.is-emphasis` to the hero words, resets `.is-emphasis` to `captionTextColor`. Mirrors `recolorEmphasisToHero()` from `VideoPlayer.jsx`. |

**Did NOT touch:** template structure, typography, animation timing, the apply
pipeline, or `renderAppliedSidebarTemplateCaption`. Only color *values* and the
caption-box interaction affordance changed.

---

#### Follow-up fixes (same session)

| # | Symptom | Root cause | Fix |
|---|---------|-----------|-----|
| 4 | **Emphasized word disappears mid-playback** leaving a "void"/gap between words in the line; the word reappears when the video is paused; export is fine. | The emphasized word is the only word that runs through `wbwAnimImp` (`AppliedSidebarTemplateSourceRenderer` in `VideoPlayer.jsx`). On **pause**, `settleWBWWord` sets `word.style.animation = 'none'` — but during **playback** `wbwAnimImp` never cleared the CSS `animation`, so the `imp-`/`ns2-`/`ns3-` class's CSS keyframe overrode the JS inline `opacity:1` reveal and the word stayed invisible. Export is unaffected because export renders via the backend ASS path, not this animation. | Added `word.style.animation = 'none'` at the start of `wbwAnimImp` so the JS-driven reveal (opacity/transform/clip) is authoritative during playback — identical to what the pause/settle path already does. |
| 5 | **Template caption not editable on canvas like a normal caption** | Sidebar-template captions had the selection border, hover border, pointer events and group-hover all gated behind `!isSidebarTemplate`; the inner container was `pointerEvents:none`. The double-click→edit path (`handleCaptionDoubleClick` → `isEditing` → contentEditable) was always shared and never template-guarded — it just had no visible affordance. | In the caption overlay (`VideoPlayer.jsx` ~line 6013): template captions now show the same purple selection/hover border, use `pointerEvents:auto`, and are double-click editable. Drag/resize/delete remain disabled for templates on purpose (would shift template layout). **Note:** this could only be verified after the backend was brought back up — earlier "Failed to fetch" was the backend process being down, so no template state could be reached to test. |

---

### Session 12 — 2026-04-21

**Theme:** Production hardening — P0/P1 security, race conditions, and event-loop blocking

**Scope:** No new features. Security and reliability fixes only across `backend/main.py`, `backend/processor.py`, `backend/.env`.

---

#### Fixes — `backend/main.py`

| # | Issue | Fix |
|---|-------|-----|
| P0 | **Missing `subprocess` import** — `upload_video` and `detect_language` would crash immediately at runtime with `NameError` | Added `import subprocess` to stdlib imports |
| P0 | **Auth bypass in `process_video` and `detect_language`** — when `verify_token()` failed AND Firestore was unavailable, 401 was silently swallowed | Removed the `get_db() is not None` guard; now always raises 401 if token verification fails and `DEV_MODE=false` |
| P0 | **Auth bypass in `export_video`** — same conditional guard pattern | Restructured: `decoded_token` → `uid` or `is_dev_token` → `uid="dev-local-user"` else `raise 401` |
| P0 | **Export limit race condition** — two concurrent requests from same user both passed the 5/day check before either deducted | Added `_user_export_locks` dict + `_get_user_export_lock(uid)`. Entire check→render→deduct block wrapped in `try/finally` with per-user `asyncio.Lock` |
| P1 | **Blocking promo expiry reset** — `user_ref.update(...)` inside async export handler blocked event loop | Wrapped in `_loop.run_in_executor` |
| P1 | **Blocking Firestore in `verify_payment`** — `user_ref.get()`, `_topup_batch.commit()`, `_sub_batch.commit()` all synchronous in an `async def` | All three wrapped with `await _vp_loop.run_in_executor(None, ...)` |
| P1 | **Blocking Firestore in `redeem_promo`** — four synchronous Firestore calls blocked the event loop | All four wrapped with `await _promo_loop.run_in_executor(None, ...)` |
| P1 | **No style input validation** — `style: Dict[str, Any]` passed straight to ASS generation with no bounds checking | Added `ExportRequest.validated_style()` method: clamps 11 known numeric fields to safe ranges, whitelists `quality` string; export handler now calls `req.validated_style()` instead of `req.style` |

#### Fixes — `backend/processor.py`

| # | Issue | Fix |
|---|-------|-----|
| P1 | **Blocking `subprocess.run` in `burn_only`** — main FFmpeg call (5–30s) ran synchronously inside an `async def`, saturating the event loop | Added `import asyncio`; FFmpeg call now `await asyncio.get_running_loop().run_in_executor(None, lambda: subprocess.run(...))` |

#### Fixes — `backend/.env`

| # | Issue | Fix |
|---|-------|-----|
| P0 | **`CREDITS_HMAC_SECRET` hardcoded and committed** — anyone with repo access could forge credit signatures | Removed value; replaced with generation command comment. **Must generate a fresh secret before deploying.** |

---

### Session 11 — 2026-04-16

**Theme:** Core business logic hardening — edge cases, crash bugs, and data integrity fixes

**Scope:** No new features. Bug fixes only across `processor.py`, `main.py`, `ExportPanel.jsx`.

---

#### Fixes — `backend/processor.py`

| Bug | Fix |
|-----|-----|
| **`_wxy()` KeyError on missing layout keys** | Changed `lyt['x']` / `lyt['y']` to `lyt.get('x', 50)` / `lyt.get('y', 75)`. Malformed or partial word layout dicts no longer crash export. |
| **`_lyt2` empty-dict false negative** | Both inner-loop `_lyt2` checks upgraded from `if not _lyt2` to `if not _lyt2 or 'x' not in _lyt2 or 'y' not in _lyt2`. An empty dict `{}` is truthy, so the old check passed and `_wxy` would crash with KeyError. |
| **Unguarded `float()` on word timing values** | Wrapped `_fts = float(words_timing[0].get('start', st))` and the per-word `_ws2`/`_we2` float conversions in `try/except (ValueError, TypeError)`. A bad timing string (e.g. `"auto"`) now falls back to the caption start/end instead of crashing. |

#### Fixes — `backend/main.py`

| Bug | Fix |
|-----|-----|
| **Empty captions array silently exported** | Added `if not captions or not any(c.get('text','').strip() for c in captions): raise HTTPException(400, ...)` immediately after `captions = [c.dict() for c in req.captions]`. Prevents burning an empty subtitle track and wasting a credit. |
| **Rate limit window off-by-one** | Changed `ts > (now - 86400)` to `ts >= (now - 86400)`. The old check excluded an export made exactly 24h ago, allowing a user to slightly exceed their 5-per-day limit. |

#### Fixes — `src/components/dashboard/ExportPanel.jsx`

| Bug | Fix |
|-----|-----|
| **Unknown `template_id` silently fell back with no log** | Changed `TEMPLATE_CANONICAL_STYLES[_tid] \|\| {}` to also call `console.warn(...)` when `_tid` is non-empty but not found in the map. Makes typos and renamed IDs visible in browser devtools without changing export behavior. |

#### Additional fixes found via pending-list audit

| File | Bug | Fix |
|------|-----|-----|
| `backend/processor.py` | **`te_py` text-element default was 50, not 75** | `cs.get('position_y', 50)` → `cs.get('position_y', 75)`. Text-tab boxes with no explicit position were landing at vertical center instead of 75% like the global caption default. |
| `backend/processor.py` | **Duplicate `positioned` list construction** | The legacy path re-builds `positioned` even though a shared pre-build exists at ~line 1237. Full consolidation is unsafe (the loop also builds `inline_parts`). Added a sync-warning comment so future edits to the detection logic don't diverge between the two paths. |
| `CLAUDE.md` | **3 Session 5 known-fixes never added to Known Fixed Bugs table** | Added `\|\|` vs `??` for shadow numerics, `needs_per_word_glow` Layer-0 suppression, and `TextBg` ASS style for text element backgrounds — all were fixed in Session 5 but marked "(pending)" and never recorded. |

---

### Session 9 — 2026-04-16

**Theme:** Data layer performance audit + security vulnerability fixes (auth bypass + credits tampering)

**Scope:** No new features. Backend-only. Two security CVEs fixed, seven performance issues fixed.

---

#### Security — `main.py`

**Vulnerability 1 — `mock-token` auth bypass (all 3 endpoints)**

| Fix | Detail |
|-----|--------|
| **`DEV_MODE` env guard on dev bypass** | `is_dev_token = not req.id_token or req.id_token == 'mock-token'` was always true on any server. Changed to `is_dev_token = DEV_MODE and (...)`. On production (`DEV_MODE` unset), empty or `mock-token` id_token now gets a 401. Applied to `/api/process`, `/api/export`, `/api/detect-language`. |
| **`DEV_MODE` env var added** | `DEV_MODE=false` added to `backend/.env`. Set `DEV_MODE=true` in local `.env` only. |

**Vulnerability 2 — Backend blindly trusted `credits_remaining` from Firestore**

An authenticated user could write `credits_remaining: 99999` directly to their Firestore document via the Firebase client SDK (if security rules were permissive), and the backend would use that value without question.

| Fix | Detail |
|-----|--------|
| **`_sign_credits(uid, credits)`** | HMAC-SHA256 over `"{uid}:{credits}"` using `CREDITS_HMAC_SECRET`. Returns `""` when secret not configured (graceful degradation). |
| **`_verify_credits(uid, user_data)`** | Reads `credits_remaining`, verifies `credits_sig`. Returns `(credits, tampered)`. Non-numeric value → tampered. Signature mismatch → tampered. Missing signature (legacy user) → trusted + logged (self-heals on next write). |
| **Export blocks on tamper** | `export_video` calls `_verify_credits`; if `tampered=True` → 403. |
| **Payment resets base on tamper** | `verify_payment` calls `_verify_credits`; if `tampered=True` → resets base credits to 0 before adding purchased credits (payment still processes). |
| **All credit writes now include `credits_sig`** | Auto-create user doc, export deduction, topup batch, subscription update batch, subscription new-user batch, promo redeem — every write now co-writes `credits_sig: _sign_credits(uid, new_value)`. |
| **`CREDITS_HMAC_SECRET` env var generated** | 32-byte random hex secret generated and written to `backend/.env`. |
| **`backend/.env` created** | New file with `CREDITS_HMAC_SECRET`, `DEV_MODE=false`, and stubs for all other env vars. Already covered by `.gitignore`. |

---

#### Performance — `processor.py`

| Fix | Detail |
|-----|--------|
| **N+1 font downloads eliminated** | Added `self._font_cache: dict = {}` to `VideoProcessor.__init__`. `_ensure_font` checks cache on entry and stores result before returning. A 100-caption export with 3 unique fonts goes from up to 1,500 potential HTTP calls down to 3. |

#### Performance — `main.py`

| Fix | Detail |
|-----|--------|
| **Rate limiter memory leak fixed** | `_check_rate` now caps each key's timestamp list at `limit + 5` entries. Every 1,000 calls a sweep evicts keys with no activity in the last window. Prevents unbounded dict growth from attack traffic. |
| **Janitor uses `os.scandir`** | Replaced `os.listdir` (materialises full name list) with `with os.scandir(...) as it:` (lazy iterator, reuses OS-provided stat). Applied to both `UPLOAD_DIR` and `EXPORT_DIR` loops. |
| **Sync Firestore unblocks event loop** | `export_video` is `async def` but called sync Firestore SDK methods, blocking the event loop for 100–500 ms per request. The three Firestore calls (`user_ref.get`, `user_ref.set`, `user_ref.update`) are now wrapped in `await loop.run_in_executor(None, ...)`. |
| **Payment writes are now atomic** | `verify_payment` previously did two separate Firestore writes (user doc + payments subcollection). A crash between them left credits granted with no audit record. Both paths (topup + subscription) now use `db.batch()` — committed atomically. |

---

**Files Modified:**
- `backend/main.py` — DEV_MODE guard, _sign_credits, _verify_credits, _verify_credits in export + payment, credits_sig on all writes, rate limiter cap + sweep, scandir janitor, run_in_executor Firestore, atomic batch payments
- `backend/processor.py` — _font_cache in __init__, cache check + store in _ensure_font
- `backend/.env` — created (CREDITS_HMAC_SECRET, DEV_MODE=false, env stubs)

---

### Session 8 — 2026-04-15

**Theme:** Full error handling audit and hardening — backend + frontend

**Scope:** No new features. Pure error handling pass: every silent failure, bare except, empty catch, and crash-on-bad-input found and fixed.

---

#### Backend — `processor.py`

| Fix | Detail |
|-----|--------|
| **Mock captions no longer fake success** | When Whisper/Sarvam API fails, `generate_captions_only` was returning `{"success": True, "captions": mock_data}` — user got garbage captions with no error. Changed to `{"success": False, "error": "...", "captions": mock, "is_mock": True}`. |
| **`_ensure_font` raises if font missing after all fallbacks** | After primary download fails and Inter fallback also fails, code previously silently returned `info` for a nonexistent file — FFmpeg would then fail with a cryptic error. Now raises `RuntimeError` immediately with the missing path. |
| **`burn_only` output-not-found is now an error** | When FFmpeg exits 0 but the output file doesn't exist, changed from `print("[FFmpeg] WARNING...")` to `return {"success": False, "error": ...}` — export route now correctly fails. |
| **Temp audio cleanup logs failures** | `except Exception: pass` → logs with file path so disk/permission issues are visible. |
| **Duration ffprobe in mock path logs failure** | `except Exception: pass` → logs so we can see why duration detection failed. |
| **`_get_video_dimensions` bare except** | Now logs file path and exception before returning 1080×1920 fallback. |
| **`_get_rotation` bare except** | Now logs file path and exception. |
| **ASS debug readback bare except** | Now logs the error instead of silently skipping. |
| **Hex color parse bare except** | `_color_to_ass`: logs the bad hex value instead of silent return. |

#### Backend — `main.py`

| Fix | Detail |
|-----|--------|
| **`/api/detect-language` FFmpeg returncode** | Added `if ffmpeg_result.returncode != 0: raise RuntimeError(stderr)` — previously a failed audio extraction would pass an empty/broken file to Whisper. |
| **`/api/detect-language` temp file cleanup** | `os.remove` not wrapped — now wrapped in try/except with logging. |
| **Firebase Storage local delete** | `except Exception: pass` → logs failure so disk issues don't disappear silently. |
| **Subscription expiry date parse** | `except Exception: pass` → `except (ValueError, TypeError) as e: print(...)` — only catches parse errors, not broad exceptions. |

#### Frontend — `src/pages/Login.jsx`

| Fix | Detail |
|-----|--------|
| **Auth errors now visible to user** | `catch (error) { console.error(...) }` with no UI feedback. Added `loginError` state + red error banner rendered below the card header. Button shows `disabled` + `opacity-60` while `isLoggingIn` is true to prevent double-submit. |

#### Frontend — `src/components/dashboard/ExportPanel.jsx`

| Fix | Detail |
|-----|--------|
| **Null `video_url` guard** | Added explicit check: `if (!downloadUrl) throw new Error('Server did not return a download URL...')` before calling `fetch(downloadUrl)`. |
| **Network error during export** | Changed `try { fetch } finally { clearInterval }` to `try { fetch } catch (networkErr) { clearInterval; throw descriptive error }` — progress bar now resets properly on network failure and user gets a clear message. |

#### Frontend — `src/components/dashboard/WordClickPopup.jsx`

| Fix | Detail |
|-----|--------|
| **AbortController on font list fetch** | useEffect now creates an `AbortController`, passes `signal` to fetch, and aborts on unmount. `AbortError` is silently swallowed; other errors are logged. Prevents React "setState on unmounted component" warning. |
| **Empty font preview catch** | `.catch(() => {})` → logs with font name. |

#### Frontend — `src/pages/Dashboard.jsx`

| Fix | Detail |
|-----|--------|
| **Template font empty catch** | `.catch(() => {})` → logs with font family name. |
| **Style font useEffect empty catch** | `.catch(() => {})` → logs with font family name. |

#### Frontend — `src/components/dashboard/StyleControls.jsx`

| Fix | Detail |
|-----|--------|
| **`/api/fonts` fetch** | Added `if (!res.ok) throw new Error(...)` before parsing JSON. |
| **Three empty font load catches** | FontRow dropdown preview, script font auto-load, font selector onSelect — all now log with font name instead of silent `() => {}`. |

#### Frontend — `src/components/dashboard/VideoPlayer.jsx`

| Fix | Detail |
|-----|--------|
| **Hex parse `catch { return hex }`** | Changed to `catch (e) { console.warn(...); return hex }` — logs invalid hex values so color bugs are detectable. |
| **`onVideoLoaded` callback** | Wrapped in try/catch — a throwing callback no longer crashes `handleLoadedMetadata`. |

#### Frontend — `src/components/dashboard/fontUtils.jsx`

| Fix | Detail |
|-----|--------|
| **`autoLoadFontForText` return type** | All return paths now include `error: null` or `error: message` field so callers can distinguish a successful load from a silent fallback to `sans-serif`. |

---

**Files Modified:**
- `backend/processor.py` — mock captions, _ensure_font, burn_only, _get_video_dimensions, _get_rotation, temp cleanup, hex parse, ASS debug
- `backend/main.py` — detect-language FFmpeg check, temp cleanup, Firebase delete, date parse
- `src/pages/Login.jsx` — loginError state + UI, isLoggingIn guard
- `src/components/dashboard/ExportPanel.jsx` — null video_url guard, network error handling
- `src/components/dashboard/WordClickPopup.jsx` — AbortController, font catch logging
- `src/pages/Dashboard.jsx` — font catch logging (×2)
- `src/components/dashboard/StyleControls.jsx` — res.ok check, font catch logging (×3)
- `src/components/dashboard/VideoPlayer.jsx` — hex catch logging, onVideoLoaded try/catch
- `src/components/dashboard/fontUtils.jsx` — error field in return values

---

### Session 7 — 2026-04-13

**Theme:** Security hardening audit

*(See git commit `2582bb1` for full details)*

---

### Session 6 — 2026-04-12

**Theme:** Display modes, word drag UX, FPS export, animation system unification

**Phases completed (3 rounds of user feedback):**

---

#### Phase 1 — New Features

| Area | What Was Built |
|------|---------------|
| **"2 Line Sentence" display mode** | Added third option to Display Mode dropdown in StyleControls. Applies `whiteSpace: 'normal'` + `maxWidth: '28ch'` to allow natural word wrapping into ~2 lines. Applied to all 3 rendering paths in VideoPlayer (editor path, template path, custom path). |
| **FPS selector in Export tab** | Added pill button group (24 / 30 / 60 fps) above Video Export section in ExportPanel. State: `exportFps`, default 30. Sends `fps: exportFps` in export payload. Backend ExportRequest model updated: `fps: int = 30`. Processor extracts fps, validates to `{24, 30, 60}`, passes `-r {fps}` flag to FFmpeg output. |
| **Advanced Animation section** | Added Zoom (In/Out), Transition (Fade In, Slide Up/Down/Left/Right), and Camera Movements section + speed slider to StyleControls. (Superseded in Phase 3 — see below.) |

---

#### Phase 2 — Bug Fixes

| Bug | Fix |
|-----|-----|
| **Word drag hid other words** | `hasOffset` flag: words with any `x/y/x_pct/y_pct` offset bypass timing-based show_inactive hide logic — they always render regardless of word_by_word timing. |
| **Word drag auto-switch** | When user drags a word, the sentence auto-switches to `display_mode: 'word_by_word'` with `show_inactive: false` so the rest of the sentence plays out sequentially. Dragged word is never hidden thanks to `hasOffset` check. |
| **BG layer too tall** | Reduced vertical padding in VideoPlayer background box from full `2 * padding` to `2 * Math.round(padding * 0.4)` — both top offset and height calculation — for a tighter, less intrusive background. |
| **Advanced animation displacing captions** | Root cause: animation was applied to the outer absolutely-positioned div which uses `transform: translate(-50%, -50%)` for centering — CSS animation overrides this and displaces the caption. Fix: removed `getAdvancedAnimationStyle` entirely; zoom/transition now use standard `caption.animation` + `getAnimationStyle` framework. |
| **Camera movements not functioning** | Attempted `both` fill mode with static keyframe transforms — not frame-driven so movement wasn't visible. Resolved in Phase 3 by removing camera movements entirely per user request. |

---

#### Phase 3 — UI Reorganization

| Change | Detail |
|--------|--------|
| **Removed camera movements** | Entire camera movement UI section removed from StyleControls Advanced Animation. Camera movement keyframes (`adv-pan-left/right/up/down`, `adv-ken-burns`) removed from VideoPlayer. |
| **Removed Advanced Animation section from StyleControls** | Entire section (zoom selector, transition selector, speed slider) removed. `advAnimOpen` state removed. |
| **Moved zoom + transition to AnimateTab → Basic** | 7 new animations added at top of Basic category: `zoom_in`, `zoom_out`, `fade_in`, `slide_up`, `slide_down`, `slide_left`, `slide_right`. Animation counter updated: 34 → 44. |
| **Removed "Caption Enter Animation" section from AnimateTab** | Separate Zoom/Transition/Speed controls section removed; functionality now covered by Basic animations. `captionStyle` / `setCaptionStyle` props removed from AnimateTab and Dashboard. |
| **VideoPlayer animation defs updated** | 7 new entries added to `getAnimationStyle` defs mapping to `adv-*` keyframes at 400ms duration. |

---

**Architecture — Animation System After Session 6:**
- **All animations** (including zoom/transition) are stored in `caption.animation` per-caption
- `getAnimationStyle` in VideoPlayer maps animation name → CSS animation definition
- No global `captionStyle.adv_zoom` / `captionStyle.adv_transition` fields — those are gone
- Export: zoom/transition animations are CSS-only (preview) — exported video uses ASS word-timing, not keyframes

**Files Modified:**
- `src/components/dashboard/StyleControls.jsx` — 2-line mode + whiteSpace/maxWidth; removed Advanced Animation section
- `src/components/dashboard/VideoPlayer.jsx` — hasOffset word visibility; reduced bg padding; added 7 animation defs; removed getAdvancedAnimationStyle; removed camera keyframes
- `src/components/dashboard/AnimateTab.jsx` — 7 new Basic animations; updated counter; removed Caption Enter Animation section; simplified props
- `src/pages/Dashboard.jsx` — removed captionStyle/setCaptionStyle props from AnimateTab
- `src/components/dashboard/ExportPanel.jsx` — FPS state + pill UI + payload
- `backend/main.py` — ExportRequest.fps field
- `backend/processor.py` — fps extraction + FFmpeg `-r` flag

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

### Session 7 — 2026-04-15

**Theme:** Security hardening — full audit and fix across backend + frontend

**What was done:**

Full security review of the codebase was requested. 15 issues found and categorised by severity. All high/medium issues fixed in the same session. Changes committed to both `main` branch and `claude/stoic-moore` worktree.

---

#### Fixes Applied (10 total across 6 files)

| # | Severity | Issue | Fix | Files |
|---|---|---|---|---|
| 1 | Critical | Hardcoded Razorpay test key `rzp_test_RJWsOLmZ6GL27m` in 3 frontend files and backend default | Removed all hardcoded fallbacks; backend defaults to `""`; frontend uses `VITE_RAZORPAY_KEY_ID` env var or `orderData.key_id` from backend response | `main.py`, `RazorpayPayment.jsx`, `PricingModal.jsx`, `PricingSection.jsx` |
| 2 | High | CORS wildcard default (`"*"`) with `allow_credentials=True`; `allow_methods=["*"]`; `allow_headers=["*"]` | Default now `localhost:3000/5000` only; explicit `allow_methods=["GET","POST"]`; explicit `allow_headers=["Content-Type","Authorization"]` | `main.py` |
| 3 | High | Path traversal in all 3 file-lookup loops — `startswith(file_id)` with no UUID validation | Added `_validate_file_id()` (UUID check) + `_safe_find_upload()` (realpath containment check); all 3 loops replaced | `main.py` |
| 4 | High | `/api/process` and `/api/detect-language` had no auth check — any caller could trigger paid API calls | Added `id_token` field to both request models; same dev-mode bypass pattern as `/api/export` | `main.py` |
| 5 | High | Export rate limit (5/24h) was commented out with a TODO | Uncommented — re-enabled | `main.py` |
| 6 | Medium | No rate limiting on `create-order`, `verify-payment`, `redeem-promo` — allowed brute-force of promo codes and payment signatures | Added `_check_rate()` helper; payment endpoints: 10/hour/IP; promo: 5/hour/IP | `main.py` |
| 7 | Medium | `/api/debug/last-ass` publicly accessible, leaking server filesystem path in response | Gated behind `DEBUG_MODE` env var; removed `"path"` from response | `main.py` |
| 8 | Medium | `/api/delete-file` used substring match (`req.file_id in f`) — could delete other users' exports | Replaced with exact filename match (`export_{file_id}.mp4`) + UUID validation + `realpath` containment check | `main.py` |
| 9 | Medium | `tempfile.mktemp()` (deprecated, TOCTOU race) used in processor + detect-language used user-controlled `file_id` in temp path | Replaced with `NamedTemporaryFile(delete=False)` in both places | `main.py`, `processor.py` |
| 10 | Low | Vite dev server bound to `0.0.0.0` with `allowedHosts: true` | Changed to `host: 'localhost'`; `allowedHosts: ['localhost', '127.0.0.1']` | `vite.config.js` |

---

#### Issues noted but not fixed (require design decisions or new dependencies)

| Issue | Reason not fixed |
|---|---|
| File upload: no magic-byte validation (only extension checked) | Requires `python-magic` dependency; not added to keep scope minimal |
| `style: Dict[str, Any]` in `ExportRequest` accepts arbitrary unvalidated data | Requires new typed Pydantic `StyleModel` — large schema change, risk of breaking export |
| No auth on `/api/fonts` | Low risk; public font list. Intentionally left as-is |

---

**Commits:**
- `main` branch: `806da78` — 6 files changed
- `claude/stoic-moore` worktree: `2582bb1` — same fixes included

**Env vars required before production deploy:**
- `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` — backend `.env`
- `VITE_RAZORPAY_KEY_ID` — frontend `.env`
- `ALLOWED_ORIGINS` — comma-separated list of allowed frontend domains (e.g. `https://app.lekha.in`)
- `DEBUG_MODE` — set only in development if you need `/api/debug/last-ass`

---

### Session 10 — 2026-04-16

**Theme:** Dead code cleanup — unused deps, dead imports, test scripts, log file hygiene

**Scope:** No logic changes. Pure housekeeping across frontend, backend, and repo config.

---

#### Changes Made

**`package.json` — Removed 13 unused npm dependencies**

| Package | Reason removed |
|---------|----------------|
| `@react-oauth/google` | No imports in `src/` |
| `@stripe/react-stripe-js` | No Stripe usage in codebase |
| `@stripe/stripe-js` | No Stripe usage in codebase |
| `canvas-confetti` | Label exists but package never imported |
| `date-fns` | No imports in `src/` |
| `html2canvas` | No imports in `src/` |
| `jspdf` | No imports in `src/` |
| `lodash` | No imports in `src/` |
| `moment` | Appears only in template name strings, not imported |
| `react-leaflet` | No imports in `src/` |
| `react-markdown` | No imports in `src/` |
| `recharts` | Only referenced in `chart.jsx` which is never imported |
| `three` | Appears as template name string, not imported |
| `baseline-browser-mapping` (devDep) | No imports anywhere |

**`backend/main.py` — Removed 2 unused imports**
- `import subprocess` — only used in `processor.py`, not `main.py`
- `import math` — imported but no `math.*` calls in file

**Deleted 3 backend test/debug scripts**
- `backend/test2.py` — SarvamAI help-text scratch file
- `backend/test_export.py` — hardcoded test data script
- `backend/debug_export.py` — debug async function

**`.gitignore` — Added log file patterns**
- Added `*.log`, `backend/*.log`, and explicit codex/vite log filenames
- Prevents `codex-backend.{err,out}.log`, `codex-frontend.{err,out}.log`, `uvicorn.log`, `vite.log` from being tracked

---

**Files changed:** `package.json`, `backend/main.py`, `.gitignore`
**Files deleted:** `backend/test2.py`, `backend/test_export.py`, `backend/debug_export.py`

---

### Session 11 — 2026-06-09

**Theme:** Pricing refresh, processing-screen rewrite, security/production-readiness pass, and a deep fix for applied-template caption rendering (highlight motion + word spacing).

---

#### 1. Pricing update (monthly raised, yearly added)

New plan prices — **must stay in sync across all three locations** (the backend is the source of truth for the charged amount; the frontend only displays):

| Plan | Monthly | Yearly (= 10× monthly, 2 months free ≈ −17%) | USD/mo | USD/yr |
|------|---------|-----------|--------|--------|
| Starter | ₹299 | ₹2,990 | $3.99 | $39.99 |
| Creator | ₹399 | ₹3,990 | $4.99 | $49.99 |
| Pro | ₹499 | ₹4,990 | $5.99 | $59.99 |

- `src/components/dashboard/PricingModal.jsx` — in-app upgrade modal `plans[]`; also fixed a display bug (yearly showed the annual total labeled `/mo` → now `/yr`).
- `src/components/landing/PricingSection.jsx` — landing `plans[]` (INR + USD); badge corrected `-20%` → `-17%` to match the real discount.
- `backend/main.py` `PLAN_PRICING` — `inr_paise`/`usd_cents` for all 6 plan keys. New amounts are all unique, so the amount→plan reconciliation (`_resolve_plan_from_amount_currency`) cannot collide.

#### 2. Processing screen recreated (`src/pages/Dashboard.jsx`, `renderGeneratingState`)

- Heading "Lekha Captions is working…" → **"Crafting your captions"**; subtitle rewritten.
- Step list rewritten to describe the real pipeline; **removed "Preparing emoji suggestions"**, replaced with "Syncing word-level timing": *Transcribing your audio → Syncing word-level timing → Highlighting key moments → Rendering your preview*.

#### 3. Security / production-readiness (`backend/main.py`)

- **BLOCKER fixed — payment plan spoofing.** `verify_payment` trusted the client-echoed `plan_id` to grant tier/credits and never checked it against the amount actually paid → pay for Starter (₹299), echo `plan_id:"pro"`, receive Pro/100 credits. Added a central amount↔plan binding in `_apply_successful_payment` (asserts paid minor units == plan's `usd_cents`/`inr_paise` for the currency, logs `payment_amount_plan_mismatch`). Covers client-verify, webhook, and reconcile paths.
- **Require Redis in production.** Rate limiting + payment idempotency already had Redis with in-memory fallback, but nothing forced Redis in prod → multi-instance deploys silently used per-instance state (bypassable). Added a boot guard: `ENV=production` + no reachable Redis raises at startup, unless `ALLOW_INMEMORY_STATE=1` (escape hatch for deliberate single-instance).
- **Streaming upload.** `upload_video` read the whole file (up to 500 MB) into RAM via `await file.read()` → memory-pressure DoS under concurrency. Switched to 1 MB chunked streaming to disk, enforcing the size cap mid-stream (oversized/content-length-spoofed bodies abort early; Windows-safe cleanup).
- Verdict given to user: ship-ready **after** the payment fix; in-memory state + upload buffering were scaling concerns, now closed.

#### 4. Applied-template caption rendering (`src/components/dashboard/VideoPlayer.jsx`) — the main debugging arc

Context: left/sidebar templates render through the in-page `AppliedSidebarTemplateSourceRenderer` (host class `lekha-applied-template-host`, `data-applied-template-animated="true"`). It is a JS reimplementation of the gallery card's animation, driven by `play()`/`pause()` via `runnerRef`. Block types: **wbw** (`.wbw`/`.wbw-line`, words `.w`/`.wbw-word`), **pos/sticky** (`.sw`/`.sw-w`), **plain** (`.plain-s` text nodes + a bare `<span class="is-emphasis">`).

- **Highlight "void" during playback — attempted CSS fix, then REVERTED.** First broadened the force-visible safety rule (`APPLIED_TEMPLATE_HOST_OVERRIDES`) to also force `.sw`/`.sb.active .sw-w` to `opacity:1 !important`. This **flattened the intentional dimmed-context look** (`.sw-w` context words sit at `opacity:0.14`; only the active word reveals) → applied caption stopped matching the gallery card. **Reverted to the exact original rule.** LESSON: never force-override opacity across all word classes in the applied host — the `.sb` vs `.sblock` selector split encodes per-template-type intent.
- **Real fix — "highlighted words not moving in some lines."** Root cause: `enterBlock` only animated `wbw` and `pos` blocks; **`plain` blocks got no animation** → their highlighted word was static. Added an additive plain-block path: `plainImpInit` / `animatePlain` (rise+fade the `.plain-s .is-emphasis` span on play) / `resetPlain` (phase prep) / `settlePlainWord` (always lands visible on pause/seek — no void), wired into `enterBlock`, `resetBlock`, and `pause()`. Scoped to `.plain-s .is-emphasis` only → wbw/pos templates untouched. (Caveat: plain emphasis carries no motion hint in the applied markup, so it uses a default rise+fade; can be mapped per-template if an exact card motion is needed.)
- **Touching words (no space between Devanagari words in some lines).** Cause: each line path joins word spans with a literal space (`.join(' ')`), but **flex/grid line containers drop whitespace-only text nodes**, leaving only `margin-inline-end:0.12em` → words touch. (Touching ⟹ the line is flex, since non-flex lines keep the join-space.) Added `column-gap:0.28em` to flow-line containers (`.wbw`, `.wbw-line`, `.sw-line`, `.lekha-sidebar-source-line`) — restores spacing on flex lines, inert on non-flex lines (no over-spacing elsewhere).
- **Selection frame for templated captions** (user-requested parity with normal captions). Removed the `!isSidebarTemplate` gate at the drag-enable, delete-button, and resize-handles spots (plus added the `cursor-move` class) so a selected templated caption shows the bordered box + 8 handles + delete (X) and can be moved. These handlers act on caption position / the captions array only — template word rendering is untouched. (Horizontal move/resize is constrained by the template's full-width centered layout, which was deliberately not changed.)
- **Hero word recolor — preview** (`recolorEmphasisToHero(block)` in `VideoPlayer.jsx`). The accent colour was landing on the `.is-emphasis` word even when the template's visually dominant word is a different, bolder/larger one. Added a `getComputedStyle`-based detector: a "bold tier" exists if some word's font-size is ≥18% larger than the smallest, or its font-weight is ≥700 with a ≥200 gap. If found, the accent colour moves from `.is-emphasis` to the hero word(s); `.is-emphasis` resets to the caption text colour. Wired into `enterBlock` (double-rAF, after layout) and `pause()`.

#### 5. Export-side parity fixes (`scripts/render_template_overlay.mjs`)

The Puppeteer export renderer for templated captions had the same two rendering bugs as the preview — fixed identically so exported frames match the canvas:

- **Fix: Export word spacing.** Added `column-gap: 0.28em` to `.lekha-sidebar-export-template-shell .wbw`, `.wbw-line`, `.sw-line`. Root cause: flex containers drop whitespace text nodes — same as the preview fix.
- **Fix: Export hero word recolor.** Added a `getComputedStyle`-based hero-recolor IIFE in `activateSidebarTemplateShells()`, after the existing `.is-emphasis` color loop. Detects the bold tier (≥18% font-size gap, or ≥700 weight with ≥200 gap), resets `.is-emphasis` to `captionTextColor`, and applies `emphasisAccent` to the hero elements. Mirrors `recolorEmphasisToHero()` from `VideoPlayer.jsx`.

---

**Files changed:** `src/components/dashboard/PricingModal.jsx`, `src/components/landing/PricingSection.jsx`, `backend/main.py`, `src/pages/Dashboard.jsx`, `src/components/dashboard/VideoPlayer.jsx`, `scripts/render_template_overlay.mjs`

**Verification notes:** Pricing confirmed live on the landing page (monthly + yearly). `backend/main.py` import-checked with new `PLAN_PRICING`. `VideoPlayer.jsx` esbuild-parses clean after each change. The template playback/animation changes must be visually confirmed in a **real browser** — the automated preview throttles video so the mid-playback states (void, plain-block motion) can't be reproduced there.

**Env var added:** `ALLOW_INMEMORY_STATE` (default off) — set to `1` only to run a deliberate single-instance production deploy without Redis.

---

### Session 12 — 2026-06-09

**Theme:** Full preview ↔ export parity audit for applied left-side (69-set) templates. Line-by-line comparison of `VideoPlayer.jsx` (`APPLIED_TEMPLATE_HOST_OVERRIDES` + `AppliedSidebarTemplateSourceRenderer`) vs `scripts/render_template_overlay.mjs` (export shell CSS + `activateSidebarTemplateShells()`). Every gap fixed toward the preview as reference (the preview is what the user approves visually).

#### Export-side gaps fixed (`scripts/render_template_overlay.mjs`)

1. **`.plain-s` flex hijack.** The page-level rule `.cap-text, .plain-s, .wbw-rise, .wbw-slide { display:inline-flex; … line-height:1.2 }` (written for plain captions + right-side originals) leaked into sidebar shells. inline-flex drops the whitespace text nodes around the `.is-emphasis` span (→ emphasis word touches neighbours in export) and 1.2 squeezed the source line-heights (1.55/1.7). Scoped the `.plain-s/.wbw-rise/.wbw-slide` selectors under `.lekha-original-template`; shells now use the template source's own text flow — same as preview.
2. **Per-word colour/weight flatten removed.** The activate function force-set `font-weight` + `color` (`!important`) on every injected word. The preview resolves these via inheritance + the template's class CSS — the force flattened dimmed-context alphas (e.g. rgba(255,255,255,0.5) support rows) and bold hero tiers (e.g. `.pr.hero` 900/#39ff14), and made the weight-based hero-recolor detection impossible in export (all weights equal). Removed; the shell now mirrors the preview host's inline style instead (added `color`, `font-style`, `line-height`, `opacity` to the shell builder — `font-family`/`font-weight` were already there).
3. **Hero demote now matches preview.** When the bold-tier recolor fires, preview *removes* `is-emphasis` (word falls back to its source imp-class colour); export was forcing `captionTextColor !important` onto it. Export now removes the class + clears the inline accent (and the inline `font-size/line-height/vertical-align` it had set), exactly like `recolorEmphasisToHero`.
4. **lekha-49 timing.** Export used legacy timing (65ms stagger, 280/440ms durations) for both sources; preview uses `EMOTIONAL_TEMPLATE_TIMING` for lekha-49 (280ms stagger, 380/540ms durations, 240ms positioned stagger). Export now branches on `isNewTemplateSet` with values interpolated from the same config modules. Sticky word anim also aligned: 240ms `ease` → 300ms (`positionedWordDurationMs`) with the preview's cubic-bezier.
5. **Clipping parity.** Shell + `.stage` `overflow:hidden` → `visible` (preview never crops — Devanagari matras/descenders and entrance motion paint freely); `.card`/`.lk-card` + stage get `padding:0 !important; margin:0 !important` like the preview host overrides.

#### Preview-side sync (`src/components/dashboard/VideoPlayer.jsx`)

- Font-family override for positioned containers: explicit `.pos1…pos31c` list → `[class^='pos'], [class*=' pos']` (the export already used the attribute form; list form would silently miss any pos class not enumerated).
- Hide-rule additions `.lk-lbl, .stage-lbl, .lk-phase-chip` (export already hid them; inert if absent from markup).

#### Guard script updated (`scripts/check-template-motion-parity.mjs`)

The script previously asserted the per-word colour/weight force as a feature ("words can still inherit thin source weights/low-alpha colors"). That contract is inverted now: the checks fail if the force *re-appears*, and require the shell to mirror the preview host inline `color`/`line-height`. Rationale recorded in the script.

#### Known intentional divergences (documented, not "fixed")

- **Mid-entrance mechanics differ by design:** preview uses JS transitions + a force-visible CSS rule during playback (anti-void, session 11); export uses CSS keyframes seeked via `Animation.currentTime`. Settled frames match; the per-word reveal order/timing now matches; the in-flight easing of clip/transform may differ subtly per frame.
- **lekha-49 positioned (`.sw`) rows:** export preserves the source CSS animations (re-based via `animationDelay`); preview replaces them with generic JS motions. Left as-is — both land on the same settled frame.

**Files changed:** `scripts/render_template_overlay.mjs`, `src/components/dashboard/VideoPlayer.jsx`, `scripts/check-template-motion-parity.mjs`, `DEVELOPMENT_LOG.md` (also retro-filled Session 11 with the two export-side fixes + preview hero-recolor entry).

---

### Session 15 — 2026-06-18

**Theme:** Right-side advanced template export parity — preview and MP4 now match

Right-side Styling templates could look correct in the dashboard preview but
export with tiny captions, missing first lines, or missing emphasis highlights.
The misleading part was that some fixes appeared ineffective because the backend
could still return a stale cached MP4.

**Durable fix summary**

- `ExportPanel.jsx` now measures the largest visible advanced template host and
  sends preview box width and height with the export request.
- `render_template_overlay.mjs` now scales advanced templates to that preview
  box target, preserves line-slot structure, filters hidden slots, and rebuilds
  `.is-emphasis` spans so export matches preview line-for-line.
- Advanced export seeking now forces active blocks visible before frame capture,
  which prevents first-line loss on templates like `Literary Echo`.
- `templateMotionConfig.js` and `VideoPlayer.jsx` now share the faster advanced
  timing path so the effect pacing stays closer to speech.
- `backend/main.py` now bypasses stale render-cache reuse for template exports,
  appends a cache-bust token to signed export URLs, serves exported media with
  `Cache-Control: no-store`, and bumped renderer version to
  `2026-06-18-advanced-template-size-parity-v18`.

**How to recognize it again**

- Preview looks right but only exported MP4 is tiny or missing the first line.
- Backend debug snapshot shows `preview_template_box_width_px: 0` for a right-side
  template.
- Renderer log prints `target_box=auto` for an advanced template export.
- Re-export keeps producing the same wrong result even after code changes.

**Fast verification**

- `npm run test:template-parity`
- `npm run build`
- `python -m unittest backend.tests.test_api_contracts -v`
- Confirm advanced export renderer logs a real target box, not `auto`

### Session 16 - 2026-06-18

**Theme:** `Startup Hustle` dull line traced to a motion mismatch

One `Startup Hustle` line could still look washed out even after the white-color
overrides because the fourth block was not actually using the same motion family
everywhere. The source fallback map treated it as `WBW SLIDE`, but the original
template preview/export path still rendered it as `wbw-seq-fade`, which keeps a
fade-style word reveal and can make a line look dim mid-playback.

**Durable fix summary**

- `VideoPlayer.jsx` now renders `t13-b3` with `wbw-slide` instead of
  `wbw-seq-fade`.
- `render_template_overlay.mjs` mirrors that same `t13-b3` motion change for
  exported video renders.
- `templateMotionConfig.js` now advertises the fourth `Startup Hustle` block as
  `WBW SLIDE`, matching the actual runtime behavior.

**How to recognize it again**

- Only `Startup Hustle` still looks faded while similar right-side templates are
  already bright white.
- The issue is most visible on the fourth block/line while the selected word is
  fine but the rest of the line feels greyed or dull.
- Preview and export both show the same washed-out line, which points to motion
  logic rather than export-only sizing/parity.

**Fast verification**

- `npm run lint`
- `npm run build`
- In the dashboard, apply `Startup Hustle` and watch the fourth block: the line
  should stay bright instead of fading through a muted state.

### Session 17 — 2026-07-29

**Theme:** Word-editor reopen, dragged-word export, template reset

Three reports about per-word editing: the floating word editor would not reopen
on a word that had been dragged, dragged words did not move in the exported
video, and templates were expected to clear previous drags.

**Durable fix summary**

- `VideoPlayer.jsx` `shouldRevealSequentially()` no longer derives word-by-word
  reveal from `captionHasDetachedWords()`. Dragging one word used to switch the
  whole caption to word-by-word reveal, so during playback the dragged word was
  removed from the DOM until its spoken moment and could not be clicked to
  reopen the editor. Sequential reveal is now driven only by the explicit
  display-mode setting (`show_inactive === false`), which is what StyleControls
  writes.
- `processor.py` now renders a detached word ONLY at its dragged position.
  Previously the word-layout path, the template karaoke fallback, and the
  highlight karaoke path all still drew it inside the sentence line, so it
  appeared twice — once at the original spot, once at the dragged spot. A shared
  `detached_wi` set blanks that slot in every line. The per-word timing window is
  still emitted (skipping it blanked the whole sentence for that word's slot).
- `processor.py` `_is_detached_pos()` mirrors the editor's `isWordDetached()`:
  `abs_x_pct/abs_y_pct` of 0,0 means "position reset", not "dragged to the
  top-left corner". Applied in the template, legacy, and text-element paths.
- `Dashboard.jsx` "Reset Position" now DELETES the position keys instead of
  writing zeros, so a reset word is not exported to the corner.
- `ExportPanel.jsx` `patchWordStyles()` treats zeroed offsets as "no drag", and
  recreated advanced templates (`RECREATED_ADVANCED_TEMPLATE_IDS`) now send a
  geometry-only subset of `word_styles` instead of `{}` — drags survive export
  while the authored per-word look is still left to the template.
- `main.py` `EXPORT_RENDERER_VERSION` → `2026-07-29-dragged-word-export-parity-v36`
  so cached renders do not mask the fix.

**Already working (verified, no change needed)**

- Applying a template clears previous drags — `handleApplyTemplate` runs
  `stripDetachedWordLayout()` over every caption's `wordStyles`. Confirmed live:
  a word dragged to 64.6%/55% returned to static flow after applying a template.
- Reopening the editor on an *edited* (not dragged) word works, including when
  emphasis makes the glyphs wider than the click box — the absolutely positioned
  visual span is still hit-testable outside its wrapper.

**How to recognize it again**

- A dragged word disappears from the canvas as soon as playback starts, or the
  word editor will not reopen on it: check `shouldRevealSequentially()`.
- A dragged word shows TWICE in the exported MP4: a sentence line still contains
  its slot; check the `detached_wi` blanking.
- A word jumps to the top-left corner of the export after "Reset Position":
  something stored `abs_x_pct: 0, abs_y_pct: 0` instead of deleting the keys.

**Fast verification**

- `python -m unittest backend.tests.test_api_contracts backend.tests.test_preview_export_parity` (75 tests OK)
- `npm run lint`, `npm run test:template-parity`, `npm run test:template-export`
- `VITE_API_BASE_URL=http://localhost:8000 npm run build`
  (a bare `npm run build` fails on the env gate — that is pre-existing)

### Session 18 — 2026-07-30

**Theme:** The CPT still did not export — a translate that the browser ignored

The dragged-word export fix from Session 17 set the right offsets and every
automated check passed, yet the exported MP4 still showed the caption in its
original flat line. Frames pulled from the user's own 18:39 export confirmed it:
correct template, correct emphasis colour, zero displacement.

**Root cause**

`applySourceTemplateWordStyles()` in `render_template_overlay.mjs` applies a word
drag by setting the `translate` property on the word's managed visual span. That
span is created by `getSourceTemplateVisualTargets()` with no display styling, so
it is `display: inline` — and CSS transforms do not apply to non-replaced inline
boxes. The property was set with the correct value and the browser discarded it.
The preview escapes this because `prepareSourceTemplateWordNode()` in
`VideoPlayer.jsx` forces `inline-block`; the export renderer had no equivalent.

Both regression checks were blind to it because they only asserted the
*computed value* of `translate`, never that the word moved.

**Durable fix summary**

- `render_template_overlay.mjs` `ensureTransformableWordTarget()` upgrades an
  inline position target to `inline-block` before applying an offset. It runs
  only when an offset is actually applied, so words carrying just font/colour
  overrides keep their current export layout.
- The position audit now measures the offset the browser *honours*: it drops the
  translate, re-measures, restores it, and reports `effective_dx`/`effective_dy`
  plus `target_display` and `word_opacity`.
- `check-template-export-parity.mjs` and `check-dragged-word-export-parity.mjs`
  assert the honoured offset, not the declared one. Verified as a negative
  control: with the fix disabled the suite fails with
  `set translate 36px -64px ... but the word only moved 0px/0px (display=inline)`.
- CPT word-by-word reveal: displacing a word now makes the caption build up word
  by word until the sentence completes, in preview and export.
  `captionHasCptWords()` + `isCptWordPending()` (VideoPlayer.jsx) hide pending
  words with `opacity: 0` while keeping them MOUNTED — unmounting is what broke
  reopening the word editor in Session 17, so `shouldRevealSequentially()` is
  untouched. `render_template_overlay.mjs` mirrors it, and frame segmentation
  now adds word-boundary sample points for reveal-driven captions (without them
  a plain caption with no per-word timings collapsed to one static frame and the
  CPT appeared fully formed).
- `EXPORT_RENDERER_VERSION` → `2026-07-30-cpt-transformable-word-box-v39`.
- Yearly is now the default on the fourth pricing surface,
  `landing-next/app/pricing/page.js` (a static server component with no toggle):
  it headlines the annual price with the monthly rate as the secondary line.
  `check-pricing-yearly-default.mjs` now guards all four surfaces.
- `check-template-motion-parity.mjs` asserted a `positionedWords` string that an
  earlier uncommitted change had already deleted. The guard now asserts the
  `export-positioned-word` overlay never comes back, and the dead CSS rule it
  left behind is removed.

**How to recognize it again**

- A dragged word exports at its original spot while the audit shows the correct
  `applied_translate`: check `target_display` — an inline box silently discards
  transforms.
- A CPT appears fully formed on its first frame in the export: the caption
  probably produced a single static segment; check the reveal sample points.

**Known failure NOT addressed (pre-existing)**

`npm run test:template-export:lc` fails on `left-all-lekha-lc-t167-p3`:
`incomplete final template frame ... expected=[every,template,must,render]
rendered=[every,template,must]` — the final frame drops the last word. Verified
pre-existing by reconstructing this session's files without any of the changes
above; it still fails. It is an LC reveal-completeness bug, unrelated to word
drags, and the exhaustive LC scope was not swept for further cases.

**Fast verification**

- `npm run lint`, `VITE_API_BASE_URL=http://localhost:8000 npm run build`
- `npm run test:contracts` (includes dragged-word export + pricing defaults)
- `npm run test:template-export` (46 phases), `npm run test:template-parity`
- `python -m unittest backend.tests.test_api_contracts backend.tests.test_preview_export_parity` (63 tests OK)
