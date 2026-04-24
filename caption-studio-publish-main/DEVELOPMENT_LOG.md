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
- [ ] **Razorpay demo fallback** — `PricingModal.jsx` `handlePayment`: hardcoded `rzp_test_*` key removed (security fix). Now `RAZORPAY_KEY_ID = ''` in local dev unless `VITE_RAZORPAY_KEY_ID` is set. Need to implement graceful fallback: use key from backend `create-order` response (`orderData.key_id`) and only throw if that is also empty. Currently checkout never opens on local dev without env var.
- [ ] **Landing footer bottom** — Bottom section / CTA strip color → gold (`src/components/landing/Footer.jsx`)
- [ ] **UserAccount.jsx** — Update `PLAN_LIMITS` constant to new 3-plan structure (starter/creator/pro + yearly variants). Replace all purple/blue gradients with gold. Fix `planKey` lookup.
- [ ] **SidebarNav.jsx** — Update `getPlanDetails()` to map new `starter / creator / pro` tiers with gold color. Remove old purple gradient usage.
- [ ] **Effects / Emphasis button** — Not working in `StyleControls.jsx` and `WordClickPopup.jsx`. Put effects section in a collapsible `+` icon block in both places. Brainstorm: emphasis effect = bold + scale(1.15) + color highlight + optional shadow/glow on word.
- [ ] **Styling tab width** — Increase styling panel width to match caption tab width
- [ ] **Set remaining env vars before deploy** — `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` (backend `.env` stubs already exist); `VITE_RAZORPAY_KEY_ID` (frontend `.env`); `ALLOWED_ORIGINS` (comma-separated prod domains). `DEV_MODE=false` is already set. **`CREDITS_HMAC_SECRET` is now blank — generate a new secret before deploying** (`python -c "import secrets; print(secrets.token_hex(32))"`).
- [ ] **Verify template export fidelity** — User to test all 26+15 templates and confirm exported video matches dashboard preview after Session 5 fixes
- [ ] **Verify Text tab export** — Confirm text boxes added via Text tab (custom color, animation, position) appear correctly in exported video
- [ ] **Verify FPS in export** — Test 24/30/60 fps selector in Export tab produces correct output video frame rates
- [ ] **Verify zoom/transition animations** — Test zoom_in, zoom_out, fade_in, slide_up/down/left/right in Animate tab → Basic category work correctly in preview

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

