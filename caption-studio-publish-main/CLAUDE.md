# Lekha Captions — CLAUDE.md

Project context for Claude Code. Read this before touching any file.

---

## Session Protocol

**At the start of every new session:** Read `DEVELOPMENT_LOG.md` before touching any file.
It contains the current TODO list and a full log of all previous session work.

**At the end of every session (before /clear):** When the user says "update the log", append a new dated entry to `DEVELOPMENT_LOG.md` with what was done and the updated TODO list. Keep CLAUDE.md clean — no session churn here.

---

## Build Commands

```bash
# Frontend (from caption-studio-publish-main/)
npm run dev          # Vite dev server — port 3000
npm run build        # Production build
npm run lint         # ESLint check
npm run lint:fix     # ESLint auto-fix

# Backend (from caption-studio-publish-main/backend/)
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Both at once (worktree launch.json already configured)
```

---

## Architecture

```
caption-studio-publish-main/
├── src/
│   ├── pages/
│   │   └── Dashboard.jsx          # Main state hub — captions, captionStyle, history
│   └── components/dashboard/
│       ├── VideoPlayer.jsx         # Video + scrubber; FONT_VERTICAL_OFFSET_MAP inside
│       ├── StyleControls.jsx       # Font, color, bg, effects UI
│       ├── TemplatesTab.jsx        # Template list + apply logic
│       ├── CaptionTimeline.jsx     # Timeline scrubber + drag to reorder
│       ├── ExportPanel.jsx         # Export flow: DOM capture → backend → FFmpeg
│       ├── CaptionEditor.jsx       # Per-caption text + word popup editor
│       └── fontUtils.jsx           # loadGoogleFont, detectScript, scriptFontMap
├── backend/
│   ├── main.py                    # FastAPI routes: /upload /process /export /render
│   └── processor.py               # _create_styled_ass, burn_only, _ensure_font, font maps
└── src/styles/captionTemplates.css # CSS templates (preview only — not used in export)
```

---

## Tech Stack

**Frontend:** React 18, Vite, TailwindCSS, Framer Motion, React Query, Radix UI
**Backend:** FastAPI (Python), FFmpeg/FFprobe, OpenAI Whisper, Sarvam AI
**Auth:** Firebase (optional — app works without service-account.json in dev mode)
**Payments:** Razorpay
**Subtitle format:** ASS (Advanced SubStation Alpha) — used for video burning via FFmpeg

---

## Critical Architecture Patterns

### Export Pipeline
1. `ExportPanel` captures DOM word positions (bounding boxes) from the live preview
2. Sends captions + word layouts + style to `POST /api/export`
3. Backend builds an ASS subtitle file (`_create_styled_ass`)
4. FFmpeg burns ASS into video (`burn_only`)
5. Frontend downloads the result

### Caption ID Format
Caption IDs are `${Date.now()}-${idx}` (no spaces). They are used as key prefixes for word layouts: `"${captionId}-${wordIndex}"`. Any spaces in IDs break all word layout lookups.

### Style State
- `captionStyle` — global style object in Dashboard (single source of truth)
- `cap.wordStyles` — per-word style overrides keyed by word index
- Templates are applied via `handleApplyTemplate` which resets `TEMPLATE_OWNED_RESET` props before merging

### ASS Subtitle Paths
- **word_layouts path** (precise): uses DOM-captured bounding boxes
- **fallback path** (position-based): uses `position_y` + text metrics
- Indic scripts need y-correction: `INDIC_Y_CORRECTIONS` dict in fallback path

### Firestore / Firebase
- `get_db()` returns `None` when no `service-account.json` is present
- All Firestore ops must be wrapped in `if db_available:` with `credits = 999` fallback
- This is dev mode — never crash on missing Firebase config

---

## Coding Conventions

- **Never use semicolons** in JSX/JS files (existing code is semicolon-free)
- **Always use TailwindCSS** — never inline styles unless dynamically computed
- **No TypeScript** — this is a plain JS React project with JSX
- **Imports:** use named imports; no default star imports
- **State:** all shared state lives in `Dashboard.jsx`; child components receive props + callbacks
- **No `var`** — use `const`/`let` only
- **Radix UI Slider:** always use `onValueChange` for display, `onValueCommit` for actual seeks/commits (never seek video during drag — causes black frames)
- **Backend models:** always declare all fields in Pydantic models; missing fields silently strip data
- **FFmpeg vf chain order:** `crop → ass → scale` (subtitle before scale so ASS coords match PlayRes)

---

## Known Fixed Bugs (do not re-introduce)

| Bug | Location | Fix |
|-----|----------|-----|
| Caption ID spaces | Dashboard.jsx:252 | `${Date.now()}-${idx}` — no spaces |
| Template hard reset | Dashboard.jsx handleApplyTemplate | `TEMPLATE_OWNED_RESET` clears owned props before merge |
| Indic y-correction (fallback) | processor.py fallback ASS | `INDIC_Y_CORRECTIONS` dict |
| Indic y-correction (word_layouts) | processor.py word_layouts text elements | `_TE_INDIC_Y_CORR` applied at text element position calc |
| Font selection gate | StyleControls.jsx onSelect | Call `updateStyle` immediately, not on font load success |
| Background thickness H | StyleControls.jsx | Display as `(multiplier-1)*100 px` |
| has_background in export | ExportPanel.jsx | Use `!!` not `!== false` |
| Noto Sans collision | processor.py GOOGLE_FONTS_MAP | Separate entries for NotoSans and NotoSansDevanagari |
| Firebase crash | backend/main.py | Graceful skip when `get_db()` returns None |
| id_token required | backend/main.py ExportRequest | `id_token: str = ""` (optional with default) |
| words field dropped | backend/main.py CaptionItem | Added `words: List[Any] = []` |
| word_styles None crash | processor.py _create_styled_ass | `(c.get('word_styles') or {})` + isinstance guard |
| Video blank on drag | VideoPlayer.jsx Slider | No seek on `onValueChange`; seek only on `onValueCommit` |
| seekSignal unused | VideoPlayer.jsx | Added `useEffect([seekSignal])` to consume external seeks |
| Font fallback not downloaded | processor.py _ensure_font | Update `font_path` + download Inter on fallback |
| Font ass_name mismatch | processor.py GOOGLE_FONTS_MAP | Mitigated — Google variable fonts preserve family name in nameID=1 |

---

## Default Style Values

```js
background_h_multiplier: 0.99   // displays as -1.00px
background_padding: 6
position_y: 75
has_background: true            // default for custom; templates use false if no bg
```

---

## Dev Environment

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`
- Backend health check: `GET http://localhost:8000/api/fonts`
- Worktree: `.claude/worktrees/stoic-moore/`
- Main repo: `C:\Users\ADMIN\Downloads\caption-studio-publish-main`
