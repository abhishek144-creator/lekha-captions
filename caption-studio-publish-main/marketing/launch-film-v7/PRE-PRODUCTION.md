# Lekha Captions — Launch Film v7: Pre-production pack

Stage 1 of the master brief, written 29 October 2026, for the founder to review. **Nothing has been
built or rendered yet.** Production starts after you approve a direction and the missing footage
(section 7) exists.

---

## 1. What I actually inspected

| Source | What I looked at | Finding |
|---|---|---|
| Earlier films | Contact sheets of `launch-video-v2/out/lekha-launch-v2d-1080p.mp4` (43.9 s) and `launch-video-v3/out/lekha-launch-v6-1080p.mp4` (44.7 s); `marketing/README.md` for v2–v6 | See section 2 |
| Brand | `brand/lekha-brand-sheet.png`, `brand/svg/*`, `brand/fonts/` | Wordmark = "lekha" on an ink box + "captions" on an amber box, framed by quotes. **Latin type only — there is no Devanagari mark**, so nothing to alter. Palette: ink `#0C0B0F`, cream `#FFFAF3`, amber `#C27A29`, highlight `#B7F27A`, stone `#8A8478`. Fonts: Bricolage Grotesque, JetBrains Mono, Fraunces (open licence) |
| Sample clip | `launch-video-v3/mock/upload/morning-walk.mov` | 11 s, 1080×1920, **video only — no audio track**. Every earlier film's "transcript" was seeded text, not speech |
| Recorded takes | `launch-video-v3/takes/*.mp4` | Real editor recordings from 5–6 Oct (2720×1530). The UI has changed since (e.g. T167 is no longer in the left gallery); upload is staged and export is a mock (`export-mock.html`) |
| Current UI | `launch-video-v2/assets/ui/` (captured 27 Oct) | Still screenshots of today's editor and word panel |
| Product code | `src/lib/captionLanguages.js`, `UploadModal.jsx`, `CaptionEditor.jsx`, `ExportPanel.jsx`, `shared/planCatalog.json`, landing copy | Feature list in section 3 |
| Tooling | `node -v` 24.14, npm 11.9, ffmpeg 8.0.1, Python 3.12; Remotion skill references (create, layout, multi-scene) | Remotion is **not installed** anywhere in the repo. C: drive has **9.6 GB free** |

I did **not** run the app, transcribe anything or test any export in this stage.

---

## 2. The earlier films — what to keep, what to leave

**Worth keeping**
- Real editor footage instead of drawn UI.
- The brand's "subtitle box" typography (ink box, amber word) as the film's graphic language.
- Restraint rules you set: camera leans in only around a click (≤1.35×), no headline over blurred footage.
- Original, code-generated soundtracks — no licensing risk.
- The "same style, any language" cards (Spanish, Hindi, Arabic right-to-left, Japanese).

**Weak points this film should fix**
1. **The core promise is never shown.** The clip is silent, so no film has shown *speech becoming captions*. That is the single most important thing to prove.
2. **Staged and mocked steps.** Upload/generation was staged and export was a recreated panel with compressed progress. The brief rules that out for this film.
3. **No person on screen.** Nobody speaks, so there is no emotional anchor; the films feel like a tour of a UI.
4. **UI too small on a phone.** The full 1813 px editor at 1920 px wide makes panel text unreadable on mobile.
5. **Too many chapters, too fast.** 6–8 numbered steps in 31–45 s reads like a tutorial, not a launch.
6. **Soft end claim.** "Professional captions in every language" can't be backed literally.

---

## 3. Verified product capabilities (from the code, not tested live)

| Capability | Evidence | Safe to claim in film |
|---|---|---|
| Upload a video and auto-generate captions | `UploadModal.jsx` (language auto-detect, "Generate Captions") | Yes — if shown with real footage |
| Word-by-word timing | Whisper word alignment (memory: PR #77, live) ; timeline word chips | Yes |
| Edit caption text, split/delete on timeline | `CaptionEditor.jsx`, `CaptionTimeline.jsx` | Yes |
| Translate captions in the editor | `CaptionEditor.jsx` "Translate to…", 115 options in `captionLanguages.js` | "100+ languages" — **needs your confirmation** (some entries are regional variants) |
| Style any single word (font, colour, gradient, animation) | Floating word panel (Font / Style / Animate) | Yes |
| Place words anywhere on the frame | Word drag with smart guides | Yes (never call it "CPT" on screen) |
| One-click templates; key words highlighted | Template galleries + layout director | "100+ caption styles" is on the live landing page — **confirm you're happy to repeat it** |
| Export 720p / 1080p, 4K on Creator and Pro | `ExportPanel.jsx` | Yes — say "HD or 4K", don't imply 4K is free |
| Download SRT / VTT | `ExportPanel.jsx` | Yes |
| Free to try | Free plan = 3 transcriptions, 180 s per video | "Try it free" — yes; avoid "unlimited" |

Not claimed: accuracy percentages, speed ("in seconds"), audience/viewing statistics, customer results.

---

## 4. Three creative concepts

### A. "Said, then subtitled"
Built from the brand's own idea: *every caption starts as something someone said.* A real creator
says one honest line on camera. It appears as a plain caption, and the film follows that single
line as the creator shapes it — fixed, emphasised, styled, translated, exported. The finished line
then folds into the wordmark: its ink box becomes "lekha", its amber word becomes "captions".

- Distinctive: high — the reveal only works for *this* brand.
- Emotional: high — one human, one sentence that matters.
- Product clarity: high — one line, one workflow, start to finish.
- Feasibility: medium — needs a real speaker clip and real screen recordings (section 7).

### B. "Your Words. Your Voice. Your World."
Three titled movements. **Words**: accurate transcript and editing. **Voice**: emphasis, word
styling, templates. **World**: translation and export.

- Distinctive: medium — clear but a familiar three-act ad shape.
- Emotional: medium — the line carries it more than the images.
- Product clarity: very high — each act maps to features.
- Feasibility: high.

### C. "Sound off"
Opens on a creator mid-sentence — then the sound drops out and the message is lost. The same
moment returns with Lekha captions and the message survives.

- Distinctive: medium — the muted-feed idea is widely used in caption marketing.
- Emotional: high for 10 seconds, then it has nowhere to go.
- Product clarity: strong on *why*, weak on *how*.
- Feasibility: high. Risk: tempts unsupported "X% watch muted" statistics.

### Recommendation: A, with B's three words as the backbone and C's sound drop as the hook

A is the only concept that couldn't belong to another caption app — its ending *is* your logo.
B's "Words / Voice / World" gives the middle a clear shape, used as small mono chapter labels, not
slides, and returns as the final spoken line. C's sound drop gives a strong first five seconds
without needing a statistic.

Working title: **"Said, then subtitled."** End line: **"Your words. Your voice. Your world."**

---

## 5. Production script — 70 seconds, 16:9, 1920×1080, 30 fps

VO budget is ~110 words at a calm pace, with deliberate silence. Times are targets; I'll tighten
them against the real footage.

**Recurring rules.** Every VO line is captioned on screen in the brand style (cream on ink box, active
word on amber) — the film is captioned by the product it sells. UI shots are cropped to the part that
matters (about 60–70 % of the editor), so labels stay readable on a phone.

---

**S1 · Hook · 0:00–0:06**
- **Visual:** Black for 8 frames, then the creator (vertical clip, centred, ink surround) speaks one line to camera. A plain white caption follows each word. On the last word the sound cuts out; the clip keeps playing silent, the caption stays.
- **On-screen:** the creator's line (from the real transcript), e.g. *"I almost didn't post this."* Then small mono, lower left: `SOUND OFF`.
- **VO:** (after the sound cut) *"Not everyone will hear you."*
- **Sound:** Room tone and the creator's real voice → hard cut to silence → one low felt-piano note.
- **Transition:** The caption lifts off the clip and becomes plain text in a document (S2).
- **Asset:** F1 (creator clip).
- **Emotion:** Recognition: a real person, a line that matters, suddenly unheard.
- **Claim:** None yet.

**S2 · The problem · 0:06–0:14**
- **Visual:** The line, now raw subtitle text: timecodes, line breaks, a cursor retyping a misheard word. Then the clip with the caption half a second late against the lips, in a flat default font. Clearly a "before", **not** a competitor's UI and not Lekha's UI.
- **On-screen:** `typing` · `timing` · `styling` — appears one word at a time beside the action.
- **VO:** *"Everyone can read you — if the captions are right. That usually means typing, re-timing and styling every line by hand."*
- **Sound:** Dry keyboard ticks, slightly off the beat; a low pulse starts.
- **Transition:** Match cut — the late caption snaps into sync as the editor opens around it.
- **Asset:** Built in Remotion from the F1 transcript (honest dramatisation).
- **Emotion:** Mild frustration, recognisable.
- **Claim:** None (problem statement).

**S3 · Words: upload and transcribe · 0:14–0:24**
- **Visual:** Real screen recording: Upload New → choose the clip → Caption Settings (auto-detect) → Generate → the real progress screen → captions appear in the list and on the preview. Long waits are cut, but cuts are visible (a dip), never faked progress. Camera eases to the caption list as it fills.
- **On-screen:** chapter label `01 — WORDS`.
- **VO:** *"With Lekha Captions, you upload once. It listens, and writes every word — timed to your voice."*
- **Sound:** Soft UI clicks synced to real clicks; the pulse settles into a slow groove.
- **Transition:** Push in to the timeline.
- **Asset:** F2 (real upload + transcription recording).
- **Emotion:** Relief.
- **Claim:** Automatic transcription with word-level timing.

**S4 · Words: edit · 0:24–0:31**
- **Visual:** The timeline is open under the preview, with one block per caption line. A misheard word in line 02 is corrected in the caption list ("knot" → "not"), and the preview and the timeline block update. The camera leans in on the list while the word is fixed.
- **On-screen:** none beyond VO captions.
- **VO:** *"Every line sits on the timeline, so a fix takes seconds."* (Changed from "Every word": the live release's timeline shows whole lines, not single words.)
- **Sound:** One key tick per word.
- **Transition:** The corrected word is clicked — the word panel opens (S5).
- **Asset:** L1, recorded 29 October 2026.
- **Emotion:** Control.
- **Claim:** Word-level timeline and editing.

**S5 · Voice: the word that matters · 0:31–0:39**
- **Visual:** The key word is dragged out of the line (smart guides appear), sized up, and given the warm gradient from the real word panel's Style tab. The rest of the line stays white.
- **On-screen:** chapter label `02 — VOICE`.
- **VO:** *"Then make it sound like you. Lift the one word that matters — and put it anywhere."*
- **Sound:** Groove opens; a soft bell when the gradient lands.
- **Transition:** Whip along the rail to the template gallery.
- **Asset:** L2 (local recording, current UI).
- **Emotion:** Creative pride.
- **Claim:** Per-word styling and free placement.

**S6 · Voice: one-click template · 0:39–0:46**
- **Visual:** Gallery cards play in place for ~2 s; one click; the preview plays the line in the template, key words already highlighted.
- **On-screen:** none.
- **VO:** *"Or choose a complete look in one click — your key words already highlighted."*
- **Sound:** A rising swell into the click; a light thump on apply.
- **Transition:** The preview splits into four cards (S7).
- **Asset:** L3 (local recording).
- **Emotion:** Delight.
- **Claim:** Templates; automatic key-word emphasis. (I'll only keep the second half of the line if the recording shows it.)

**S7 · World: translate · 0:46–0:54**
- **Visual:** Real "Translate to…" → Spanish, then four cards: English, Spanish, Arabic (right to left), Japanese — same template, real translations.
- **On-screen:** chapter label `03 — WORLD`; language names in English under each card.
- **VO:** *"Translate into more than a hundred languages, and your style comes with you."*
- **Sound:** Each card enters on a soft pluck, in a rising chord.
- **Transition:** The English card expands into the export panel.
- **Asset:** F3 (real translation recording).
- **Emotion:** Reach.
- **Claim:** Translation, 100+ languages (subject to your confirmation).

**S8 · Export · 0:54–0:59**
- **Visual:** Real export panel: 1080p chosen (4K visible as a plan option); real progress, time-compressed with a visible cut; the downloaded MP4 playing in a phone frame. SRT/VTT row visible.
- **On-screen:** none.
- **VO:** *"Export in HD or 4K — or take the subtitle file with you."*
- **Sound:** A clean chime on completion; music drops to pad.
- **Transition:** The phone video fills the frame (S9).
- **Asset:** F4 (real export + downloaded file).
- **Emotion:** Done; ready to share.
- **Claim:** HD/4K export, SRT/VTT.

**S9 · Payoff · 0:59–1:05**
- **Visual:** The opening shot again, finished: same creator, same line, now with their styled captions — and the sound **returns**. Hold.
- **On-screen:** the creator's styled line.
- **VO:** *"Your words. Your voice. Your world."* (spoken after the creator's line, not over it)
- **Sound:** The creator's voice back in; music resolves.
- **Transition:** The final caption line separates from the video and slides to centre on ink.
- **Asset:** F1 + the exported file from F4.
- **Emotion:** Resolution: heard *and* read.
- **Claim:** The finished result, made in the product.

**S10 · Brand reveal and CTA · 1:05–1:10**
- **Visual:** The caption's ink box and amber box reshape into the official wordmark ("lekha" / "captions", quotation marks draw in). Uses `brand/svg/lekha-wordmark-dark.svg` unchanged. Below: CTA.
- **On-screen:** `Try it free · lekhacaptions.com`
- **VO:** *"Lekha Captions. Try it free."*
- **Sound:** A warm two-note signature (the same notes as S1's piano note, resolved); clean tail to silence by 1:10.
- **Transition:** Hold 1 s, cut to black.
- **Asset:** Brand SVG.
- **Emotion:** Confidence.
- **Claim:** Free to try.

---

## 6. Visual, sound and voice direction

**Visual system.** Ink background, cream type, amber used only for the "word that matters". Headlines
in Bricolage Grotesque, labels and timecodes in JetBrains Mono, one italic Fraunces accent at most.
Caption boxes match the wordmark's proportions, so the end reveal feels inevitable. No particles,
no neon, no 3D. One move at a time on screen. UI crops are framed with an 80 px safe area.

**Music.** Original score, made in-house with the same code-generated approach as the earlier
soundtracks (felt piano, warm pad, slow pulse that becomes a gentle groove in S5–S7, resolving in
S9). No licensing risk. Alternative: a licensed track you buy from a library such as Artlist or
Epidemic Sound; I'd cut to it.

**Voiceover.** A warm, unhurried, conversational voice — closer to a friend than an announcer;
neutral international English. Pace about 140 words per minute, with pauses. Pronunciation of
"Lekha" needs your call (see section 7). Recommended: a human recording (you, or a hired voice
artist). I will **not** generate a synthetic voice until you've approved the script and
pronunciation.

**Loudness.** −14 LUFS integrated, peaks under −1 dBTP (same target as earlier films); VO sits about
8–10 dB above music.

---

## 7. Footage and facts still needed from you

Nothing below exists yet. F-items need you (they involve a real person, your account or live
services); L-items I can record myself from a local copy of the **live** release (cf642737), not
from the current working tree, which holds unreleased changes.

| ID | What | Spec | Who |
|---|---|---|---|
| **F1** | A creator speaking one honest line to camera, then 10–15 s more speech | Vertical 1080×1920 or larger, good light, clean audio, English. A **second** short clip in another language (Spanish, Arabic, Hindi…) is a bonus | You — plus written consent from the person on screen and confirmation you own the rights |
| **F2** | Screen recording: upload F1 → Generate → captions appear (live app, signed in) | Browser window at your usual 1360 px / 75 % size, 30 fps+, no notifications, hide email/credits if you prefer | You |
| **F3** | Screen recording: Translate to Spanish (and ideally Arabic, Japanese) | Same setup | You |
| **F4** | Screen recording: export at 1080p to completion, plus the downloaded MP4 file itself | Same setup | You |
| L1–L3 | Timeline edit, word styling + drag, template apply | **Recorded 29 Oct** from the live release (cf642737) run locally, signed out, on the sample clip. Re-record with `recorder/record.mjs` once F1 exists | Me |
| Voice | VO recording of the script (after approval) | WAV, 48 kHz, quiet room | You or a hired artist |

**Facts to confirm**
1. **Length:** your earlier rule was ≤45 s; this brief asks 60–75 s. I've written 70 s, with the 30 s cutdown in section 9. Which is the main film?
2. "More than a hundred languages" for translation — OK to say?
3. "100+ caption styles" (already on your landing page) — OK to repeat if needed?
4. Pronunciation of **Lekha**: "LAY-kuh" or "LEH-khaa"?
5. CTA: `lekhacaptions.com` and "Try it free" — correct?
6. Music: original in-house score, or a licensed track you'll buy?

---

## 8. Build plan

**Status 29 October 2026 — direction approved (concept A, 70 s).** The Remotion project is built in
`launch-film-v7/film/` (see its README). A silent half-resolution animatic,
`film/out/lekha-v7-animatic-draft.mp4` (70.0 s), shows the full edit. These parts are finished
motion graphics: the voiceover captions, the S2 subtitle-file dramatisation, chapter labels, and
the S10 logo reveal and CTA. S4–S6 now play the real L1–L3 takes. F1–F4b are still labelled
placeholder slates. Not yet done: the music, the voiceover, and the final render.
Caption change from the script: the S2 line "That usually means typing, re-timing and styling every
line by hand." is shown as two captions, so no caption wraps onto the footage above it.

Original plan:

- **New Remotion project** in `marketing/launch-film-v7/` (its own folder; the app's code is not touched and nothing is deployed). Installing it takes roughly 0.5–1 GB of the 9.6 GB free on C:.
- One component per scene; all timings in one `timeline.ts` file and all colours/fonts in one `theme.ts`, so a re-time is a one-line change.
- Each scene also registered as its own composition so it can be previewed alone in Remotion Studio.
- Real footage is played with Remotion's video component; crops and camera moves are numbers in the timeline file.
- Brand fonts loaded from `brand/fonts/`; the wordmark from the official SVG.
- Order: a low-resolution preview render first → review together → final 1080p H.264 MP4 (yuv420p, AAC 256 kbps, faststart) → frame-by-frame QA (section 10) → fixes → final render.

---

## 9. Cutdowns

**30-second cutdown (16:9 and 9:16)**
| Time | Scene |
|---|---|
| 0:00–0:05 | S1 hook (sound drop) |
| 0:05–0:11 | S3 upload → captions appear (fastest real cut) |
| 0:11–0:17 | S5 key word styled and placed |
| 0:17–0:21 | S6 template applied |
| 0:21–0:24 | S7 four language cards |
| 0:24–0:27 | S9 payoff with sound back |
| 0:27–0:30 | S10 wordmark + "Try it free" |
VO: *"Not everyone will hear you. Lekha Captions writes every word — then lets you make it yours. In any of 100+ languages. Your words. Your voice. Your world. Try it free."*

**9:16 adaptation plan (1080×1920)**
- The creator clip is already vertical: it plays full-bleed instead of centred on ink.
- UI shots: crop to a single panel per shot (caption list, word panel, gallery card) rather than the whole editor; scale up so labels are ≥ 28 px tall.
- Captions sit in the middle third, clear of platform UI (top 220 px and bottom 380 px kept free for Reels/Shorts/TikTok buttons).
- Chapter labels move to the top; the wordmark stacks vertically on the end card.
- Same timeline file, a second composition with portrait layouts — not a separate project.

---

## 10. QA checklist I'll run on the rendered file

Spelling (especially "Lekha Captions"); logo matches the official SVG; text readable at phone size
(checked by viewing frames scaled to 390 px wide); caption sync against VO within 2 frames; no black
or missing frames (ffmpeg black-frame scan); loudness and true-peak measured; no email addresses,
credit balances, tokens or notifications visible in any UI frame; every claim maps to a real
recording; first 3 seconds work with sound off; end card holds ≥ 2 s. The QA report will list what
I checked and what I couldn't.

### Local takes L1–L3 — 29 October 2026

Recorded with `recorder/record.mjs` from a clean copy of the live release (cf642737), run locally
on port 3170. The session was signed out, the analytics cookies were declined, and the quick guide
was closed. The app's own code was not changed: the only thing swapped in, in that browser session,
was the sample clip's transcript. The temporary copy was deleted afterwards.

| Take | Length | Shows | Used in |
|---|---|---|---|
| L1 | 9.9 s | Timeline open; line 02 selected → Edit caption → "knot" double-clicked and retyped as "not"; the line plays | S4, from 1.0 s |
| L2 | 11.6 s | "strategy," dragged out of the line → word panel opens beside the preview → size up → Style → warm gradient (yellow → red) → the line plays | S5, from 0.2 s |
| L3 | 13.0 s | Left Templates gallery (52 templates), cards playing → "Doubt" (LC T211) applied ~0.45 s before line 02 → "not" and "loud" highlighted automatically | S6, from 1.6 s |

What the takes show honestly, and what they don't:
- The transcript is the seeded sample text, not a live transcription. L1's "knot" was seeded to show a real fix.
- The Font Size was set to 30 px through the real slider before L1 and L2, so the captions read at film size.
- Signed out, the layout director uses its rules only, so L3's look is plainer than the gallery card (no large hero line). A signed-in recording would show the AI-read layout.
- After the drag, the app switches line 02 to word placement (CPT), so the line then plays word by word. That is the release's real behaviour.
- The camera leans in up to 1.6–1.7× (above the old 1.35× rule) only where small UI text or the caption must be readable on a phone.
