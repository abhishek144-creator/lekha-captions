# Marketing assets

## Brand — `brand/`

Wordmark "Subtitle lines": `lekha` on an ink box and `captions` on an amber box, stacked like
burned-in subtitles and framed by big quotation marks.

| File | Use |
|---|---|
| `svg/lekha-wordmark-light.svg` | Primary wordmark, light backgrounds |
| `svg/lekha-wordmark-dark.svg` | Dark backgrounds (first box flips to cream, quotes go amber) |
| `svg/lekha-wordmark-mono.svg` | Single colour (letters cut out of the boxes) |
| `svg/lekha-icon.svg` | App icon / favicon |
| `png/` | Raster exports (2400px wordmarks, 1024/512/192 icons, 32px favicon) |
| `lekha-brand-sheet.png` | Overview of all of the above |

Colours: ink `#0C0B0F` · day cream `#FFFAF3` · amber `#C27A29` (the landing day-theme
`#C9720C`, softened) · stone `#8A8478`.

All SVGs are fully outlined — no fonts needed. To rebuild after a change (fontTools required):

```bash
python brand/build_wordmark.py      # writes svg/ + wordmark-paths.json
node brand/export-png.mjs           # writes png/
node shot.mjs brand/brand-sheet.html brand/lekha-brand-sheet.png 1920 1300
```

Fonts (open licence, in `brand/fonts/`): Bricolage Grotesque, JetBrains Mono, Fraunces.

## Launch film v6 — `launch-video-v3/launch-v6.html` (current)

~44.7 s (≤45 s brief), 1920×1080, 30 fps. **"Say it once."**: the film is narrated by the sample clip's own transcript.
Its four caption lines are the four chapter cards, set on ink exactly as the editor's caption list wraps them (italic
numeral, timecode, duration chip, `morning-walk.mov`). Each card's amber word flies into the thing clicked next and the
real editor irises open around it:

| Card | Amber word lands on | Chapter (take) |
|---|---|---|
| 01 this place taught me **one** thing | Upload Video button | staged upload → generating → captions |
| 02 humility is a **strategy,** not weakness. | the word itself in the preview line (match cut) | drag it out, size up, orange (`floating-v5`) |
| 03 slow mornings build **loud** lives. | Templates rail icon | gallery cards in place, one click on T167 |
| 04 say it **once.** let them read it. | EXPORT | signed-in export mock |

Then languages + end card (unchanged). No text ever sits over footage; camera leans in ≤1.35× only around clicks.
Sound is call-and-response: cards are a held breath (closed pads, a key tick per word, a bell on the amber word), each
flight falls and lands with a thump, and the groove plays only under the footage. No new takes — all reused from v5.

```bash
node events.mjs --film v6 && python soundtrack-v6.py
node render.mjs --film v6             # out/lekha-launch-v6-silent.mp4 (--stills 1.6,10.85 for single frames)
ffmpeg -i out/lekha-launch-v6-silent.mp4 -i out/soundtrack-v6.wav -map 0:v -map 1:a -c:v copy   -af "volume=-2.8dB,alimiter=limit=0.5:attack=1:release=40:level=false" -c:a aac -b:a 256k -shortest   -movflags +faststart out/lekha-launch-v6-1080p.mp4
```

The edit (cards, landing targets, pieces, camera) lives in `segments-v6.js`.

## Launch film v5 — `launch-video-v3/launch-v5.html` (superseded by v6)

~44 s (≤45 s brief), 1920×1080, 30 fps. **"Self-captioned"**: the film narrates itself with a subtitle track, styled like
the wordmark (cream on an ink box, the active word on an amber box) with each line's `.srt` cue above it.
No HUD, no headlines over blurred footage, no logo before the end card.

cold open (the finished T167 clip) → it settles into the editor's preview → rewind through the real takes to
the empty editor → Upload → One word → Templates → Export → languages → end card (the last two unchanged).

- **Result first.** The cold-open clip is the real preview cropped out of the `templates` take (without the
  REC / 9:16 badges); it lands pixel-exactly on the preview, the editor fades in around it, and the rewind
  plays `templates` → `floating-v5` → `upload` backwards (eased, with frame ghosts) onto upload's first frame.
- **Playhead wipes.** Every chapter after Upload is entered by an amber timeline playhead crossing the frame.
- **One word (new take `floating-v5`).** The word is dragged out of the line *first*, then clicked, sized up
  and coloured orange; the popup opens beside the preview. Its close is cut away (see the app issue below).
- **Templates.** The gallery cards play in place at real speed (no lifting); one click on T167 animates it on
  the canvas. Camera leans in ≤1.35× only around clicks.
- The edit (pieces, camera, subtitle lines and per-word timings) lives in `segments-v5.js`.

```bash
node record.mjs floating-v5                                   # the only new take; the others are reused
rm -rf takes/floating-v5 && mkdir -p takes/floating-v5 && ffmpeg -i takes/floating-v5.mp4 -q:v 3 takes/floating-v5/f%05d.jpg
node build-logs.mjs && node events.mjs --film v5 && python soundtrack-v5.py
node render.mjs --film v5             # out/lekha-launch-v5-silent.mp4 (--stills 3.6,19.6 for single frames)
# -14 LUFS: a plain gain (measure the wav with `ffmpeg -i out/soundtrack-v5.wav -af ebur128 -f null -`, gain = -14 - I,
# +0.2 dB for the limiter) and a transient limiter so the AAC's overshoot on the UI clicks stays under -1 dBTP;
# single-pass loudnorm lands ~-13.2 LUFS on this mix
ffmpeg -i out/lekha-launch-v5-silent.mp4 -i out/soundtrack-v5.wav -map 0:v -map 1:a -c:v copy   -af "volume=-3.2dB,alimiter=limit=0.5:attack=1:release=40:level=false" -c:a aac -b:a 256k -shortest   -movflags +faststart out/lekha-launch-v5-1080p.mp4
```

**App issues seen while recording (not fixed here — `src/` untouched):**
1. *Word size overlaps neighbours.* Sizing up an in-line word paints it over the words beside it, because
   the word's slot stays at the caption's base size: `VideoPlayer.jsx:3747` sets `layoutFontSize = baseFontSize`
   for every word (the spacer at `:3910` and the selection ring are sized from it), while the visible text is an
   absolutely-centred span at the word's own size (`:3871`). The comment at `:3909` says the base size was
   meant only for *dragged* words.
2. *A dragged word is drawn offset from its hit box.* In `renderAnimatedDetachedWordContent`
   (`videoPlayerTemplateRendering.jsx:3543`) the visible layer is centred with `transform: translate(-50%, -50%)`,
   but `...animationStyle` is spread after it; when the word isn't selected that style carries `transform: none`,
   so the word is drawn half its size right/down of its clickable box (the layer is `pointer-events:none`).
   Clicking the word's centre misses it, and it visibly jumps when it is selected or deselected.

## Launch film v4 — `launch-video-v3/launch-v4.html` (superseded by v5)

~59 s. The first film's language (camera HUD, captions typed word by word with one boxed keyword,
a "LAND." punch, amber glow on ink) carried into the real editor:
hook → LAND. → iris into the logo → tagline → 01 Upload → 02 Style → 03 One word → 04 Templates →
05 One click → 06 Export → languages → end card (the last two unchanged from v3).

- Each chapter's headline is typed like a caption over the blurred footage, then a focus pull.
- Template cards and the preview are *lifted* out of the real recording (cropped pixels flown to
  centre stage), so the templates read large and play at real speed.
- **Upload is staged** (no login, no source edits): with `stage: 'upload'`, `editor-session.mjs`
  rewrites the code served to the recording browser so the dev-seed session starts on the real empty
  editor, may open the real upload modal and pick `mock/upload/morning-walk.mov`, and "Generate
  Captions" shows the real generating screen without any request; then the sample captions load.

```bash
node record.mjs upload style floating templates          # + export-bg / export / lang-* if needed
for t in upload style floating templates; do rm -rf takes/$t && mkdir -p takes/$t && ffmpeg -i takes/$t.mp4 -q:v 3 takes/$t/f%05d.jpg; done
node build-logs.mjs && node events.mjs --film v4 && python soundtrack-v4.py
node render.mjs --film v4             # out/lekha-launch-v4-silent.mp4 (--stills 1.4,20 for single frames)
ffmpeg -i out/lekha-launch-v4-silent.mp4 -i out/soundtrack-v4.wav -map 0:v -map 1:a -c:v copy \
  -af loudnorm=I=-14:TP=-1:LRA=11 -c:a aac -b:a 256k -shortest -movflags +faststart out/lekha-launch-v4-1080p.mp4
```

The edit lives in `segments-v4.js`. The v3 takes it replaced are in `takes-v3-old/v3-final/`.

## Launch film v3 — `launch-video-v3/` (superseded by v4)

53 s, 1920×1080, 30 fps. Every editor shot is a real recording of the app (local dev server,
`?devseed=1`) with the landing-page clip loaded as `public/dev-sample.mov` (gitignored) and
English / Spanish / Hindi / Arabic captions swapped into the dev seed in the browser session only.

Sections: Auto-transcribed → Style → Edit a single word → 100+ templates (two cards, real speed)
→ One click (T167) → Export → languages → end card.

**Viewport.** The editor is shown full frame exactly as it looks on the owner's screen: 1360 px wide
with Chrome at 75 % zoom, i.e. a 1813×1020 CSS viewport (16:9) recorded at device scale 1.5, so editor
takes are 2720×1530. The four `lang-*` takes are older 1600×900 @2× recordings (3200×1800); the
language cards crop the preview out of them (`crop` in `segments.js`). Viewports live in
`editor-session.mjs` (`VIEW`, `LANG_VIEW`).

**Speed.** Recording runs the page at 1/6.5 speed while screenshots are taken, so takes play back
at real speed. The rate is applied to *every frame*: the template-gallery cards are sandboxed
`srcdoc` iframes with their own `setTimeout` sequencer, and slowing only the top window made them
run ≈6.5× too fast in the film. `node check-card-speed.mjs 1` and `node check-card-speed.mjs 0.153846`
measure a card's line changes (≈2.9 s per line at real speed) to confirm.

**Export.** The export section is `export-mock.html`, a standalone recreation of the *signed-in*
export sheet (Starter plan, 13 credits, 4K locked, 1080p/720p ready, SRT/VTT) — no login and no app
code changes. It uses the app's own compiled stylesheet (`mock/app.css`, captured with
`node capture-export-dom.mjs`) and the markup/class names of `ExportPanel.jsx`, and plays over
`takes/export-bg.mp4`, a real recording of the editor. Progress is compressed to ~3 s.

The cursor is drawn from each take's logged mouse moves.

```bash
# dev server on :3000 first (npm run dev:frontend), then:
cd launch-video-v3
node record.mjs export-bg intro style floating templates   # export-bg before export
node record.mjs export                                      # the mock, over export-bg
# (lang-en lang-es lang-hi lang-ar only if the language cards need redoing)
for t in intro style floating templates export; do rm -rf takes/$t && mkdir -p takes/$t && ffmpeg -i takes/$t.mp4 -q:v 3 takes/$t/f%05d.jpg; done
node build-logs.mjs && node events.mjs && python soundtrack-v3.py
node render.mjs                     # out/lekha-launch-v3-silent.mp4
ffmpeg -i out/lekha-launch-v3-silent.mp4 -i out/soundtrack-v3.wav -map 0:v -map 1:a -c:v copy \
  -af loudnorm=I=-14:TP=-1:LRA=11 -c:a aac -b:a 256k -shortest -movflags +faststart out/lekha-launch-v3-1080p.mp4
```

The edit (what part of each take, camera moves, titles, callouts) lives in `segments.js`. The camera
stays full frame and only leans in (≤1.42×) around a click or selection, then returns.
`explore-geometry.mjs` re-measures control positions if the editor layout changes.

## Launch films v2d / v2e / v2f — `launch-video-v2/` (27 October 2026)

Built from v2b + v2c. "CPT" is an internal term and never appears on screen: the feature is
**"Creatively place every word"**, its language heading **"Same layout."**, export cards read `EXPORT · 9:16`.
Every languages heading carries its step number raised above "Same".

- **v2d — merged film** (`launch-v2d.html`, 43.88 s): hook "You speak. / Lekha **creates.**" → v2b up to the
  template (step 03 now clicks "strategy," and picks the panel's warm **gradient** tile — no drag) → the cursor
  clicks the top bar's real **Undo** (template off, gradient word kept, Redo turns on) → v2c's word placement
  (no second gradient pick — the word already has it) → languages ("07" above "Same template.", T167 cards)
  → export → end card. Steps 01–08.
- **v2e — template film** (`launch-v2e.html`, 31.35 s): v2b with the v2d hook and gradient beat; "05" above
  "Same template."
- **v2f — word-placement film** (`launch-v2f.html`, 33.32 s): v2c with the hook "Your words. / **Anywhere.**";
  "05" above "Same layout."; the export chime now lands on "Ready to share."

All three sit on the **current dashboard** (`assets/ui/`, captured by `capture-current-ui.mjs` from the dev seed
at the user's 1360 px / 75 % size — editor px = CSS px × 0.75): the real word panel at its real size, opening on
Font, so the cursor presses **Style** before the gradient tile (v2f inserts 0.5 s after the word click for it →
33.32 s); Undo/Redo, Upload New, EXPORT, gallery cards and timeline bar at their current places. The films' own
preview (clip + captions) is unchanged, scaled ×1.0465 into the dashboard's preview slot. The current gallery no
longer lists T167, so its card is overlaid with the recorded T167 preview and the current naming ("Mountains · LC T167").
Re-capture (dev server on :3000) whenever the dashboard changes, then re-measure from `assets/ui/geometry.json`.

```bash
python soundtrack-v2d.py            # and soundtrack-v2e.py / soundtrack-v2f.py
node render.mjs --film v2d          # out/lekha-launch-v2d-silent.mp4
ffmpeg -i out/lekha-launch-v2d-silent.mp4 -i out/soundtrack-v2d.wav -map 0:v -map 1:a -c:v copy   -af loudnorm=I=-14:TP=-1:LRA=11 -c:a aac -b:a 256k -shortest -movflags +faststart out/lekha-launch-v2d-1080p.mp4
```

## Launch film v2c (CPT) — `launch-video-v2/launch-v2c.html`

32.82 s. A second, separate film built on v2b (the selected film): the same upload, captions-on-upload, export and end
card; its **hook is itself a CPT** — "Put every word / **anywhere.** / on any video." in the reference colours (cream `#F1E5BA` giant + lower
line, white upper line), word-by-word rise, over "CREATIVELY PLACED TEXT" and the sample clip blurred/darkened behind it — instead of v2b's "You say it. Lekha writes it."; the middle shows **CPT — creatively placed text** in the **"Reels Giant"** look (user's reference):
one giant cream word dominates, white satellites tuck into the gap above its right edge, cream satellites into the gap
under its left edge; playback is a word-by-word cream reel rise. Authoring as the editor does it: "strategy," is
dragged out (cyan centre guide), grown to the giant by its corner handle and given the panel's **warm gradient** (yellow→orange→red tile; real word
panel — `assets/popup-cpt-*.png`, header word drawn live); "not" / "weakness." go under its left edge (guides + snap gap)
and "humility is a" above, flush to its right edge — all satellites stay white (only the giant is coloured). The authoring runs 30% slower
than the first cut (9.4–15.8 s). Line slots stay empty, as in the app.
The languages section is **"Same CPT."**: the same giant-word CPT in Spanish, Hindi, Arabic (mirrored) and Japanese,
each fitted to its card, rising word by word. Page logic: `buildCpt()` / `EV` (preview), `LANGS` + `fitCardCpts()` (cards).

```bash
python soundtrack-v2c.py
node render.mjs --film v2c          # out/lekha-launch-v2c-silent.mp4
ffmpeg -i out/lekha-launch-v2c-silent.mp4 -i out/soundtrack-v2c.wav -map 0:v -map 1:a -c:v copy   -af loudnorm=I=-14:TP=-1:LRA=11 -c:a aac -b:a 256k -shortest -movflags +faststart out/lekha-launch-v2c-cpt-1080p.mp4
```

## Launch film v2b — `launch-video-v2/launch-v2b.html` (selected)

31.35 s. The v2 film with the changes asked for on 2026-10-06 (everything else as v2; `launch-v2.html` untouched):
1. **No logo intro** — opens straight on "You say it. Lekha writes it." (the logo build + ink wipe are gone).
2. **Captions on screen right after the upload** — they appear with the video (no scan effect); the timeline chips pop in.
3. **Template gallery held ~2.5 s** — the camera pans to the left gallery, cards light up under the cursor, then the
   same T167 click / ring / chip / preview animation as v2. The gallery cards *play* like the app: card 1 (T167) and
   card 2 (T166) are frames recorded from the real gallery (`assets/gallery/`, take `templates` 2.567–10.567 s, which
   loops cleanly because a card clears its line instantly).
4. **Floating word editor** (new step 03 "Style any single word") — "strategy," is dragged out of the line first
   (its slot stays empty, as in the app), then clicked: the app's real word panel (`assets/popup-a.png` /
   `popup-b.png`, cropped from the `floating-v5` take) opens beside the preview and orange is picked. No size change.
   Steps renumbered 01–06.
5. **Languages section**: bigger language-name tags in English (SPANISH, HINDI, ARABIC, JAPANESE), an amber glow and slowly drifting rows of the word for
   "captions" in 18 languages behind the cards.

```bash
python soundtrack-v2b.py
node render.mjs --film v2b          # out/lekha-launch-v2b-silent.mp4 (--stills 7,10.7 for single frames)
ffmpeg -i out/lekha-launch-v2b-silent.mp4 -i out/soundtrack-v2b.wav -map 0:v -map 1:a -c:v copy   -af loudnorm=I=-14:TP=-1:LRA=11 -c:a aac -b:a 256k -shortest -movflags +faststart out/lekha-launch-v2b-1080p.mp4
```

## Launch film v2 — `launch-video-v2/`

32 s, 1920×1080, 30 fps. Built on the real editor screenshot, the real source clip
(`IMG_5419_1.mov`) and the real T167 "1 Style · V2" template timings.

```bash
cd launch-video-v2
python soundtrack-v2.py             # out/soundtrack-v2.wav
node render.mjs                     # out/lekha-launch-v2-silent.mp4
node render.mjs --stills 5,17.4     # single frames for review
ffmpeg -i out/lekha-launch-v2-silent.mp4 -i out/soundtrack-v2.wav -map 0:v -map 1:a -c:v copy \
  -af loudnorm=I=-14:TP=-1:LRA=11 -c:a aac -b:a 256k -shortest -movflags +faststart out/lekha-launch-v2-1080p.mp4
```

If the logo changes, regenerate `assets/logo-data.js` from `brand/wordmark-paths.json`.

`launch-video/` is the first (superseded) film.

## Published launch assets — 7 October 2026

The current finished v6 cut is published at https://lekhacaptions.com/launch-video.mp4.
All eight finished 1080p cuts are retained as downloads in the GitHub release
`launch-2026-10-07`. Editing scripts, timelines, brand assets and bounded v2
frame assets are tracked here. Raw recording takes, generated frame sequences,
silent intermediate renders, WAV mixes and duplicate ZIP archives remain local;
regeneration commands above require the original rights-owned recording inputs.

The marketing recordings include explicitly staged upload/export sequences;
they are demonstrations, not evidence of production timing or AI accuracy.
