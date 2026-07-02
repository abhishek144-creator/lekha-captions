# Template Application and Export Review

## Purpose

Use this file when a selected caption template:

- does not appear in the editor,
- repeats another template's effect,
- loses animation on later caption lines, or
- appears in preview but disappears or becomes static in export.

The template pipeline has four contracts that must stay aligned:

1. Gallery selection stores the selected template's unique source markup.
2. Caption order selects the authored phase for each caption line.
3. Preview starts that phase's authored entrance animation.
4. Export receives the same template identity, phase index, markup, timing, and font.

## Preview Failure: Repeated or Missing Effects

### Symptoms

- Selecting A1, A2, or another left-side template produced the same effect.
- Some later caption lines appeared without animation.
- Paused captions could leave words hidden or clipped.

### Root causes

- The applied renderer reconstructed animation from video time instead of starting
  the selected source phase like the gallery preview.
- A caption could mount after its entrance window, so the renderer jumped directly
  to a settled state.
- A stalled or unavailable media clock froze the word reveal loop.
- Generic transform mappings made distinct authored effects look alike.

### Durable fix

- Preserve the selected card's unique `template_markup`, `template_20_id`,
  `template_class`, and `template_source`.
- Assign phases by non-text caption order:
  `phaseIndex = captionIndex % authoredPhaseCount`.
- On every active caption mount, reset all source blocks and call the same
  reset-and-enter sequence used by the gallery preview.
- Use a local animation clock for the entrance. Do not require
  `video.currentTime` to advance CSS transitions.
- When paused, cancel pending timers and show the selected phase as a fully settled
  frame with opacity, transform, and clip-path restored.
- Resolve fonts per caption script so Indic text does not fall back to an unrelated
  system font or get clipped.
- For `Startup Hustle` (`t13`), long or non-Latin first-line captions need a compact
  preview/export path. Do not keep `slide-crash` and `ticker` in forced single-line
  mode for those cases.

### Key implementation locations

- `src/pages/Dashboard.jsx`: stores template snapshot and per-caption phase metadata.
- `src/components/dashboard/VideoPlayer.jsx`: source markup injection and live runtime.
- `src/components/dashboard/SidebarTemplateGallery20.jsx`: authored left-side previews.
- `src/components/dashboard/emotionalTemplateUtils.js`: caption-order phase plan.
- `src/components/dashboard/templateMotionConfig.js`: shared timing and effect mappings.
- `scripts/render_template_overlay.mjs`: export runtime CSS and original-template
  block reconstruction.

## Export Failure: Template Missing or Static

### Symptoms

- The editor preview showed the selected template.
- The exported MP4 showed plain text, a settled frame, or no visible entrance effect.

### Root causes

- Export can receive template identity on each caption even when the global style is
  incomplete. The renderer previously decided which CSS/runtime to load mainly from
  the global style.
- Sidebar export animations were rebuilt for each screenshot, then sought using
  absolute video time because the animation target was only searched inside
  `.template-caption-shell`. Left templates live inside
  `.lekha-sidebar-export-template-shell`.
- For captions starting several seconds into a video, absolute time immediately
  completed the animation. The template appeared static and could look unapplied.
- Cached exports can preserve an old renderer defect unless the renderer version is
  changed.

### Durable fix

- Resolve one canonical export style from:
  global style, `template_snapshot`, caption `applied_template_style`, and caption
  template fields.
- Treat either `template_20_id` or a canonical advanced `template_id` as requiring
  DOM/CSS export rendering.
- Preserve `__templateIndex` and `template_phase_index` through the API model.
- Seek every browser animation relative to its owning caption:
  `captionElapsedMs = (frameTime - captionStart) * 1000`.
- Find the owning shell using both selectors:
  `.template-caption-shell, .lekha-sidebar-export-template-shell`.
- Render each sampled frame after animation state has been paused and positioned.
- Increment `EXPORT_RENDERER_VERSION` whenever export timing or source rendering
  changes, invalidating stale cached MP4 files.

### Key implementation locations

- `src/components/dashboard/ExportPanel.jsx`: canonical request snapshot and caption metadata.
- `backend/main.py`: request model, debug snapshot, cache version, and export hash.
- `backend/processor.py`: selects DOM/CSS rendering for both template tabs.
- `scripts/render_template_overlay.mjs`: source markup, phase activation, deterministic frame timing.

## Regression Checklist

1. Apply A1, A2, A3, and templates from B-D. Confirm every selected ID and motion
   signature differs.
2. Play or seek through at least five caption lines. Confirm each line uses caption
   order for its source phase and every animated phase starts a fresh run.
3. Pause during a wipe, roll, or word reveal. Confirm every word is fully visible.
4. Export a left-side template with captions starting after two seconds. Inspect
   frames near the start, middle, and end of each caption.
5. Export a right-side advanced template and inspect at least one styled, WBW, and
   karaoke phase.
6. Confirm `cache/last_export_request_debug.json` contains the selected template ID,
   source markup snapshot, phase metadata, and `should_use_dom_template_renderer: true`.
7. Run:

   ```powershell
   npm run test:template-parity
   npm run lint -- --quiet
   npm run build
   python -m unittest backend.tests.test_preview_export_parity
   node --check scripts/render_template_overlay.mjs
   ```

## Evidence From the June 8, 2026 Fix

- All 20 left template cards A1-D5 resolved to unique source IDs and motion signatures.
- Later caption lines selected the correct authored phase.
- Live animation no longer depended on a progressing media clock.
- The latest A5 export request contained the correct template snapshot and used the
  DOM renderer.
- Export frames proved the template markup was present; the remaining animation
  mismatch was caused by seeking sidebar animations with absolute video time.
- Renderer version
  `2026-06-08-caption-relative-template-export-v10` produced a fresh 1080p A5
  verification export with 84 deterministic overlay segments.
- Frames sampled at the start, middle, and settled points of two caption phases
  showed the authored entrance progression: hidden at caption start, partially
  revealed during animation, and complete at the settled frame.
- Verification output:
  `exports/codex_template_export_v10.mp4`.

## Export Failure: Caption Size Too Small

### Root cause

The left-template shell dimensions were scaled from preview width to export width,
but the authored template CSS still contained fixed values such as `19px`. Those
values were designed for the small gallery/preview canvas and remained `19px` on a
1080-pixel-wide export.

### Durable fix

- Scale the active sidebar phase as one visual unit using the same
  `video_width / preview_width` ratio used by the export canvas.
- Keep this scale on the phase container, not individual animated words, so word
  transforms and effect-specific animation remain intact.
- Allow `ExportPanel.jsx` to measure both advanced and sidebar template hosts.
- Increment `EXPORT_RENDERER_VERSION` to invalidate exports created before the
  size-parity correction.

### Verification

- Renderer version: `2026-06-08-template-export-size-parity-v11`.
- A fresh 1080x1920 C1 export rendered all six authored phases at readable scale.
- Settled-frame inspection confirmed hero, standard, and multiline phases remained
  centered and inside the portrait canvas.
- Verification output: `exports/codex_template_export_size_v11.mp4`.

## Export Failure: Thin Text or Stepped Animation

### Root causes

- Preview forces every authored sidebar text class to use the resolved caption
  family. Export previously left the source template's Latin families in place,
  allowing Indic text to fall back to a different and often thinner font.
- Export sampled left-template animation at 12 FPS even when the final video was
  30 or 60 FPS. FFmpeg repeated those held overlay images, producing visible
  stepping.

### Durable fix

- Apply `--sidebar-source-font` to the export shell and force the same source
  classes used by preview to inherit it.
- Load the global and caption-level Google font families with weights 300-900
  before capturing overlay frames.
- Sample advanced and sidebar template animation at the requested output FPS,
  clamped to the supported 24/30/60 range.
- Increment `EXPORT_RENDERER_VERSION` so older thin or low-frame-rate renders
  cannot be returned from cache.

### Verification

- Renderer version: `2026-06-08-template-export-visual-parity-v12`.
- The 30 FPS C1 verification export used 203 overlay segments instead of the
  previous 84-segment, 12 FPS render.
- Consecutive frames 33 ms apart showed continuous opacity and position changes.
- Settled-frame comparison confirmed the export now uses the preview's Rajdhani
  face and authored per-phase weights.
- Verification output: `exports/codex_template_export_visual_v12.mp4`.

## Export Failure: Only Some Middle Lines Are Too Thin

### Root cause

Some flat authored phases, such as C1's `pos3`, explicitly declare a light
`font-weight: 300`. That phase-level source rule overrides the selected caption
weight even though neighboring phases inherit the selected weight correctly.

### Durable fix

- Preserve the selected caption weight on each export shell.
- For flat sentence containers only, compare the computed phase weight with the
  selected caption weight and raise it when it falls below the preview setting.
- Do not apply this minimum to composed hero layouts, so intentionally light
  support rows keep their authored contrast.
- Invalidate old cached renders with renderer version
  `2026-06-08-template-export-phase-weight-v13`.

## Export Failure: Right-Side Advanced Templates Do Not Match Preview

### Symptoms

- Right-side Styling templates such as Karaoke Fill, Witness, Spiritual
  Awakening, and Literary Echo looked correct in preview but exported with much
  smaller text.
- Some advanced exports missed the first rendered line or looked partially
  hidden.
- Fixes appeared to work for one template but not others because exported MP4s
  still showed stale output.

### Root causes

- Advanced export sizing relied on font-size fallback when preview template box
  measurements were missing, which produced tiny output for authored right-side
  layouts.
- The export DOM rebuild did not fully preserve preview line slots, hidden-slot
  filtering, and emphasis span structure for every advanced template.
- Some advanced blocks could remain hidden at capture time because the export
  renderer did not force the settled visible state after seeking animation.
- Successful old renders could be returned again from export cache or browser
  media cache, making fresh renderer fixes appear ineffective.

### Durable fix

- Measure the largest visible applied template host in `ExportPanel.jsx` and
  send `preview_template_box_width_px` and `preview_template_box_height_px` for
  right-side templates.
- In `render_template_overlay.mjs`, scale advanced templates to the preview box
  target instead of relying on `font-size` only.
- Preserve multi-line slot assignment, hidden-slot filtering, and
  `.is-emphasis` span generation in both preview and export advanced renderers
  so every line and highlighted word matches the dashboard preview.
- After animation seeking, force active advanced blocks visible before frame
  capture.
- Use the same advanced timing compression helpers in preview and export so
  spoken lines and effect pacing stay aligned.
- Bypass stale render-cache reuse for template exports, add a cache-busting
  value to signed export URLs, and serve exported media with `Cache-Control:
  no-store`.
- Increment `EXPORT_RENDERER_VERSION` whenever advanced template export sizing
  or timing changes.

### Verification

- Renderer version:
  `2026-06-18-advanced-template-size-parity-v18`.
- Template parity check passed for all advanced templates.
- `Literary Echo` direct renderer verification switched from
  `target_box=auto` to `target_box=512.62x197.77`.
- Frame inspection confirmed a rendered advanced caption bounding box of
  `334x302` on a `1080x1920` export frame, replacing the earlier tiny output.

### Verification

- The affected C1 fourth caption changed from the source's thin `300` weight to
  the selected `800` weight.
- The first phase retained its lightweight support rows around the bold hero.
- The final emphasis phase remained unchanged.
- Verification output: `exports/codex_template_export_phase_weight_v13.mp4`.

## Export Failure: Support Rows and Entire Lines Stay Thin

### Root cause

The source templates also encode visual lightness through parent `color` values
with low alpha, for example `rgba(255,255,255,0.28)`. Fixing only a phase
container's weight did not help generated child words that still inherited those
faint colors and nested source weights.

### Durable fix

- Mark every word or sentence inserted from the user's caption with
  `data-export-caption-text="true"`.
- Apply the selected caption weight and text color directly to every marked node
  after the canonical phase is activated.
- Preserve explicit emphasis classes (`imp-*`, `ns2-*`, `ns3-*`, `neon-*`) so
  template accents still differ from normal caption text.
- Invalidate older exports with renderer version
  `2026-06-08-template-export-injected-text-v14`.

### Verification

- C1's first support line changed from faint/light to the selected caption style.
- The plain middle sentence and multiline `pos3` phase both rendered at consistent
  weight and full text color.
- The final emphasis phase retained its authored accent hierarchy.
- Verification output: `exports/codex_template_export_injected_text_v14.mp4`.

## Export Failure: Preview Highlight Colors Become Yellow

### Root cause

The frontend calculated a per-caption semantic highlight color, but export
request parsing discarded waveform and duration metadata. The renderer then
depended on stored caption metadata and could fall back to the template's
default yellow accent.

### Durable fix

- Preserve `waveform_data`, `duration`, `imp_word_index`, and `emphasis_color`
  through the backend export schema.
- Rebuild the canonical semantic emphasis plan inside the DOM export renderer
  before capturing frames.
- Use the same deterministic bright palette in preview and export: cyan, green,
  red, orange, and yellow. Purple is intentionally excluded.
- Increment `EXPORT_RENDERER_VERSION` to
  `2026-06-15-semantic-emphasis-color-parity-v17`.

### Verification

- Production frontend build, renderer syntax check, backend compilation, and
  preview/export parity tests passed.
- Direct DOM export frames rendered different captions in bright red, cyan, and
  neon green rather than collapsing every highlight to yellow.
- Verification frames are under `.render_tmp/color-parity-v17/`.

## Export Failure: Recreated Templates Still Export a Static Line

### Symptoms

- For the recreated-animation templates (Spiritual Awakening, Startup Hustle,
  Motivation Stack, Cinematic Chapter, Philosophical Twist, Love Letter,
  Street / Raw, Battle Cry, Newspaper Headline, Documentary, Anime Energy), one
  phase still appeared static in the exported video even though the editor
  preview animated it.
- The same line looked broken across all of those templates.

### Root cause

- The animation recreation (formerly `plain` phases rebuilt as `wbw-rise` for
  `t11`/`t18`/`t24`/`t31`, plus the styled-phase motion work) landed in
  `templateMotionConfig.js`, `VideoPlayer.jsx`, and `render_template_overlay.mjs`
  but `EXPORT_RENDERER_VERSION` was not incremented.
- `EXPORT_RENDERER_VERSION` is part of the export `request_hash`
  (`backend/main.py`), which keys `cache/renders/<hash>.mp4`. An identical
  template + caption re-export therefore returned the **pre-recreation** cached
  MP4 — the one where that line was still a static `plain` block — making the
  fixed code look ineffective.
- Fresh renders were already correct: direct overlay renders animate every phase
  (verified for English and Devanagari captions, across `wbw`, `styled`,
  `wbw-seq-fade`, and `karaoke` phase types).

### Durable fix

- Increment `EXPORT_RENDERER_VERSION` to
  `2026-06-28-recreated-advanced-template-animation-cache-bust-v20` so stale
  cached exports can no longer be returned, including any local v19 exports
  generated before the backend process reloaded the recreated animation code.
- Extend `GOAL_ADVANCED_TEMPLATE_IDS` in `scripts/check-template-export-parity.mjs`
  to cover all eleven recreated templates so the `goal-right-phases`
  motion-critical guard fails if any of their phases stop animating in export.

### Verification

- `node scripts/check-template-export-parity.mjs --scope=goal-right-phases`
  passed for all 47 phases (11 templates); every phase reported real
  frame-to-frame motion.
- `node scripts/check-template-motion-parity.mjs` passed.
- Note: the backend must reload/restart to pick up the new
  `EXPORT_RENDERER_VERSION`.
