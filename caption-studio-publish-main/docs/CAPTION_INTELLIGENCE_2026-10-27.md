# Caption intelligence, timing, CPT hooks and smart positioning — 2026-10-27

Engineering report for the owner's caption-intelligence overhaul request. Local source changes only: nothing is committed, pushed or deployed.

## 1. Root causes found

| Symptom | Root cause | Evidence |
|---|---|---|
| Words out of sync with the voice (Hindi and other Indian languages) | `2b2e3ab1` (2026-10-25) stopped calling Whisper for Sarvam word alignment. Sarvam returns one timestamp per phrase, so since then every Indian-language word time was an estimate spread across its phrase by local loudness. | Before: `61b5ebd1`/`bf5326f5` (2026-10-09) timed each Sarvam word from Whisper's words, matched letter by letter. The matcher (`_match_tokens_to_heard_words`) was still in the code but never called. |
| Paragraph-like caption blocks | PR #72 (`c4426f86`, 2026-10-26) replaced the "Dynamic (Auto)" grouper. The old one made 1–5 words per caption, broke at every 0.3 s pause and sized phrases by speech pace. The new one allowed 14 words, 84 characters and 6 seconds, aiming for 42 characters. Auto is the default upload setting, so most projects got paragraph captions. | `git show c4426f86 -- backend/processor_captions.py` |
| CPT not visible after applying a template | (a) CPT required 2–6 words and ≤34 characters, so paragraph captions were never eligible. (b) The AI emotion reading arrives after the template is applied and re-runs the layout; a "narration" label with low intensity, or an empty keyword list, made a line ineligible and removed the CPT that had just been shown. (c) The hook needed a keyword and a loudness threshold. (d) The CPT budget was one per 10 seconds, plus an 8-second spacing. | `captionLayoutDirector.js` `cptEligible`, `maxCpt`; `Dashboard.jsx` `handleApplyTemplate` re-runs `autoLayoutCaptions` when the AI reading arrives. |
| Random highlights on CPT lines | When no word earned emphasis, `heroIndex` fell back to `ranked[0]` (often the first word), and template CPT phases highlighted `[heroIndex]`. | `planCaptionLayouts`, `applyCaptionLayout` |
| Negation lost ("This is NOT what I expected") | `not`, `no`, `नहीं`, `ना` and `मत` were on the emphasis stop-word list, so they could never be highlighted, and a negated verb could be highlighted alone. | `EMPHASIS_STOP_WORDS` |
| Manual highlights and looks lost when switching templates | A new template cleared all word styles, including the user's own `isEmphasis`. A look the user chose (layoutSource `user`) kept its mode, but its phase index stayed from the old template. | `buildTemplateApplication`; `autoLayoutCaptions` locked branch |
| Templates "look the same" | Mostly a consequence of the above: almost no line reached the template's styled/CPT phase, so captions showed the plain and normal phases. The template registry itself renders distinctly (verified with T211 and T251 below). | Real-editor screenshots |
| Snapping not "smart" enough | Guides only covered word edges, word centres and the frame centre. There were no safe-margin or baseline guides, no hysteresis (snaps flickered between targets), and no overlap feedback. | `cptSmartGuides.js` |

## 2. What changed

### Timing (backend)
- `processor.py`: the Sarvam path requests Whisper word timings again (with a language hint where Whisper supports the language) and passes them to the existing letter-level matcher. Matched words are labelled `timing_source: whisper_aligned`. Words Whisper never heard, and any Whisper failure or transcript disagreement, fall back to the labelled `sarvam_phrase_estimate`. Captions report `word_alignment_status: estimated` honestly.
- If Sarvam fails after alignment ran, the alignment transcript is reused as the Whisper failover. Previously that would be a second, identical paid call.
- `media_records.py`: process cache key `v6` → `v7`, so phrase estimates and paragraph captions are never served from cache.

### Segmentation (backend)
- `processor_captions.py`: Auto mode restores the pre–Oct 26 sizing. That means ≤5 words, ≤32 characters and ≤3.2 s, a pace target of 2/3/4 words for slow/normal/fast speech, and a break at every 0.3 s pause unless the two words are grammatically joined.
- The newer improvements stay: punctuation, Indic postposition joins and clause starters. Additions:
  - breaks before coordinating words;
  - no subject pronoun or conjunction stranded at the end of a phrase;
  - no lone word left before a break.
- Explicit word-count presets are unchanged.
- A tiny-caption merge can no longer grow an Auto phrase past 5 words.
- The source word clock is never changed.

### Caption intelligence (frontend)
- `emotionalTemplateUtils.js`: negation-aware emphasis. A sentence-level negation is evidence on its own, and a candidate inside its scope (3 words) hands the emphasis to the negation. A negation followed by punctuation ("No, …") is treated as an interjection.
- `captionLayoutDirector.js`, separated into stages:
  1. **Content**: tokens and rule-based intent. The AI reading is optional.
  2. **Emphasis**: the AI keywords when present, including an AI decision that no word earns emphasis; otherwise the rules' semantic keywords. No fallback hero: `heroIndex` is `-1` when nothing earned emphasis.
  3. **Hook**: the first caption is the CPT whenever its shape allows (2–6 words, ≤34 characters, ≥0.9 s). Loudness, AI labels and a missing keyword cannot remove it on a template. Questions are allowed as hooks; only filler opens quietly.
  4. **CPT budget**: about one hero line in three, at least three captions apart. Eligibility is structural; emotion and intensity only rank lines.
  5. **Motion and entrance**: the emotion→animation mapping is kept as an optional signal.
- A user-chosen look moves onto a new template's phase of the same type, keeping the user's highlights (`layoutTemplateKey`).
- `templateApplication.js`: on a new template, the user's own highlights (`isEmphasis`, not Auto layout's) survive. Positions, sizes, colours and motion are still cleared, per the owner's 2026-10-23 decision.

**Precedence:** source transcript and timing > explicit user edits > validated AI reading > rules > template defaults. Missing or invalid AI output only removes a signal; it never removes captions or the hook.

### Smart positioning (frontend)
- `cptSmartGuides.js`:
  - snaps to the frame's title-safe margins (6%, orange guides);
  - aligns text baselines (from the measured ink box);
  - holds a snap until the pointer is 1.75× the threshold away (hysteresis);
  - reports overlaps with the smallest in-frame move that clears them (`resolveOverlapSuggestion`).
- Overlap is never blocked, and touching is not overlap.
- `useWordGestures.js` and `VideoPlayer.jsx`: the snap state carries through the drag. While overlapping, the overlapped word is outlined and a dashed suggested position reads "Shift: avoid overlap". Releasing with Shift accepts it; a normal release keeps free placement; Alt still disables snapping. The commit uses the same resolver as the preview (existing contract), and undo is unchanged (one history entry per drag).

## 3. Tests run (actual results)

| Suite | Result |
|---|---|
| Backend `pytest backend/tests` | 556 passed, 87 subtests (run once after the timing/segmentation changes; no backend code changed after it) |
| Frontend `vitest run` | 278 passed (25 files) |
| `npm run lint`, `npm run typecheck` | clean |
| `npm run test:cpt-editing` (CPT contracts + caption editing invariants) | passed |
| `scripts/check-speech-sync.mjs` (real browser: waveform, native seek, silence, 2× playback, reload, export timestamps) | passed |
| `scripts/check-word-editor.mjs`, `check-word-editing-geometry.mjs` (desktop and phone), `check-editor-journey.mjs` | passed |
| `scripts/check-cpt-canvas-export-parity.mjs` (Hindi, resized and dragged words, two canvas sizes, 360p/720p overlays) | passed |

New and updated regressions:
- **Backend**: Whisper-measured Sarvam times; labelled estimates when alignment fails; alignment reused as failover; short Auto phrases; a paragraph-bound check at three paces (English and Devanagari); 0.3 s pause vs grammatical join; slow vs fast pace.
- **Frontend**: hook CPT without a keyword or loudness; an AI label cannot remove the hook; question vs filler openings; CPT budget and spacing; plain CPT needs a hero; deterministic plans; user look carried across templates; negation (English and Hindi); interjection; empty emphasis; manual highlight kept but Auto's dropped on a template switch.
- **Snapping**: safe margin, baseline, hysteresis hold and release, overlap and suggestion, touching boxes, in-frame suggestions, multi-row variable widths, canvas scale.

Three existing tests encoded the Oct 25–26 contracts ("no Whisper alignment", "7-word clause caption", "fallback hero = first word"). They were changed deliberately; the reasons are in the test comments.

## 4. Before / after (real editor)
`tmp/verify-cpt-hook.mjs` (gitignored, local only) seeds six short English/Hindi captions in the real Dashboard fixture, applies two gallery templates and mocks a late AI reading that labels every line as low-intensity narration with no keywords. That reading is the case that used to remove the CPT.
- **T211**: the hook is a CPT (left-aligned serif stack, oversized second row), and it is still a CPT after the AI reading.
- **T251**: the hook is a CPT (centred, phrase in a gold bracket row). The two templates are visibly different.
- **Dragging** `we` onto `raised`: overlap outline, dashed suggestion, centre and bottom alignment lines. Shift-release leaves no overlap, and the position is saved.

## 5. Known limitations and open items
- **Cost**: every Indian-language transcription makes one extra Whisper request again, as it did before 2026-10-25. That is roughly $0.006 per audio minute, at most about $0.02 for a 3-minute video. The language-detection probe is unchanged.
- **Not tested on real provider audio**: no Sarvam or Whisper calls were made, so alignment quality on real speech is not measured. The tests use mocked providers and synthetic timings.
- **Existing projects**: projects are not re-segmented or re-aligned automatically. A new transcription (cache `v7`) gets the restored behaviour.
- **Not built**:
  - touch drag (the word drag is mouse-only today);
  - a visible accept/reject button for suggestions (Shift is the only accept);
  - ink boxes do not include stroke or shadow extents;
  - whole-caption safe-area clamping (only the CPT composition clamps to 10–90%).
- **Not changed**:
  - the template registry and authored template CSS. Distinctness came from routing captions into the styled phases.
  - the backend emotion prompt. It still defaults an unknown line type to "narration", which no longer blocks anything.
- **Grouping limits**: grouping is rule-based. Mid-clause cuts like "that we do every / day here." can still happen at the 5-word limit.
- **Not verified**: export of the new overlap/snap positions beyond the existing dragged-word parity suite, and a fresh production render.
- **Deployment and migration**: none required beyond a normal release. The cache key bump invalidates old transcription cache entries, which is intended. Nothing was deployed.
