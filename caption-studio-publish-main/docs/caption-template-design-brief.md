# Caption template design brief (complete prompt)

Paste everything below the line into an AI tool, or hand it to a motion designer. It is the single source of truth for Lekha caption templates. It collects every requirement, preference, rejection and lesson from the October 2026 template sessions.

---

## 1. ROLE

You are a senior motion designer with 15 years in broadcast, title design and social video: documentary subtitles, brand films, Reels and Shorts packages. You are also a product thinker who designs *systems*, not one-off effects. You design caption templates the way a type director designs a film title package. Every choice has a reason: hierarchy, rhythm, legibility, emotion and restraint. You do not decorate; you choreograph reading.

## 2. THE PRODUCT

Lekha Captions is a web caption editor for **social media creators worldwide**. Users upload a talking-head or vlog clip and get auto-transcribed captions in the language they speak: English, Spanish, Portuguese, French, German, Indonesian, Hindi, Arabic, Japanese, Korean, Chinese, Thai and many more, including code-mixed speech such as Hinglish, Spanglish or Taglish. They pick a template from the Templates tab and export a burned-in MP4. **No template may assume one language, one script, one reading direction or one culture.**

- **Frame.** Two first-class orientations: **9:16 vertical** (1080×1920) and **16:9 landscape** (1920×1080). 1:1 (1080×1080) is secondary. Every template, and every one of its five recipes, must be designed for both 9:16 and 16:9, not just scaled from one to the other.
- **Caption data.**
  - Each caption is one spoken line (usually 3–9 words) with word-level start/end times.
  - It has an important word (`imp_word_index`, optionally several in `imp_word_indices`), picked automatically. The current picker skips English and Hindi stop words, prefers longer words and numbers, and uses the loudest word from the audio waveform. New templates need the same logic for every language (see section 7).
  - The app also computes per-caption loudness (RMS), peak, silence ratio and whether energy rises through the line.
- **Rendering.** Preview runs in the browser (React + CSS). Export renders authored templates frame by frame with a headless-browser DOM/CSS renderer. Plain styles go through ASS/FFmpeg. So:
  - Every animation must be a **pure function of time**: CSS keyframes, transitions, or JS driven by a clock.
  - Any randomness comes from a fixed seed (the caption text).
  - Nothing may depend on hover, scroll, real-time audio or the network.
  - Preview and export must show the same frames.
- **Fonts.** Use only fonts the export backend ships.
  - **Latin:** Anton, Archivo Black, Arimo, Bebas Neue, Bitter, Bodoni Moda, Cardo, Cinzel, Comfortaa, Cormorant Garamond, Crimson Text, Darker Grotesque, DM Serif Display, IBM Plex Mono, Inter, Josefin Sans, Lato, League Spartan, Libre Baskerville, Lora, Marcellus, Merriweather, Montserrat, Mulish, Noto Sans, Nunito, Open Sans, Oswald, Overpass Mono, Playfair Display, Poppins, Questrial, Raleway, Roboto, Rubik, Space Grotesk, Space Mono, Teko, Unbounded, Unna, Work Sans.
  - **Cyrillic, Greek and Vietnamese:** use a Latin font that covers them (Inter, Roboto, Open Sans and Noto Sans do), or check the font's Google Fonts subsets.
  - **Other scripts:** the app detects the script per caption (`scriptFontResolver.js`) and swaps in a matching font the backend ships:
    - **Devanagari:** Mukta, Noto Sans Devanagari, Tiro Devanagari Hindi, Rozha One, Kalam, Hind, Martel, Eczar, Yantramanav, Khand, Rajdhani.
    - **Arabic and Hebrew:** Noto Sans Arabic, Noto Sans Hebrew.
    - **CJK:** Noto Sans / Noto Serif JP, SC and TC; Noto Sans KR.
    - **Southeast Asian:** Noto Sans Thai, Lao, Khmer, Myanmar.
    - **Other Indic:** Noto Sans (and Noto Serif where shipped) Bengali, Tamil, Telugu, Kannada, Malayalam, Gujarati, Gurmukhi, Oriya, Sinhala.
    - **Also:** Georgian, Armenian, Ethiopic, Tibetan, Meetei Mayek, Ol Chiki.
  - Avoid novelty faces (Bangers, Pacifico, Rock Salt, Permanent Marker, Silkscreen, Orbitron, Shrikhand).
- **Style fields.** The editor's style object has: `font_family, font_size, font_weight, font_style, text_case, text_color, secondary_color, highlight_color, highlight_gradient, emphasis_color, has_background, background_color, background_opacity, background_padding, has_stroke, stroke_color, stroke_width, has_shadow, shadow_color, shadow_blur, shadow_offset_x/y, letter_spacing, line_spacing, word_spacing, position_y` (default 80%). Map onto these where possible. Mark everything else as authored markup.

## 3. WHO IT IS FOR: SOCIAL MEDIA FIRST

- **Platforms.**
  - **Vertical (9:16):** TikTok, Instagram Reels, YouTube Shorts, Snapchat Spotlight, Facebook Reels, plus regional apps such as Douyin, Kuaishou, Kwai, Moj and Josh.
  - **Landscape (16:9):** long-form YouTube (vlogs, podcasts, tutorials, reviews), Bilibili, LinkedIn and Facebook feed video, course and webinar clips.
- **Global audience.** Creators and viewers are everywhere, and a video is often watched by people who don't speak its language. Captions must read clearly in any script and look native in any market.
- **Mobile and sound-off.** Viewers watch on a 6-inch phone at arm's length, mostly with the sound off. The captions carry the story.
- **Stop the scroll.** The first caption is the hook and must read in under a second and stand out in the first 1–2 seconds, through scale, placement or contrast, never gimmicks.
- **Pacing.** Speech runs 150–190 words a minute, clips are 15–90 seconds, and there are quick cuts. Animations must finish before the next caption arrives.
- **Niches.** Talking-head tips, storytime, finance, fitness, food, travel, beauty and fashion, tech reviews, education, motivation, comedy skits, podcast clips, weddings and events, local business promos.
- **Platform-native.**
  - Look at home next to native Reels/Shorts text.
  - Survive compression: no lines under 2 px at 1080 wide, no very thin weights at small sizes, no low-contrast colours.
  - Stay legible over any footage: built-in shadow, a quiet panel or a scrim, for both bright selfie and dark night footage.

## 4. WHAT THE OWNER WANTS, AND HAS REJECTED

1. **Not generic.** A single style with one coloured active word ("yellow karaoke box") is rejected.
2. **A template is a system of five different line recipes.** Consecutive captions use different recipes, and no two lines in a row look the same. The owner's example: "line 1 creatively placed, line 2 normal, line 3 animated."
3. **Everything differs inside a template.** In each template:
   - Every one of the five lines has a **different animation**.
   - Every one of the five lines has a **different important-word highlight**: a different style *and* a different highlight motion.
   - Nothing repeats inside a template.
4. **Nothing repeats across templates.** No two templates share a signature motion, a type pairing, or the same set of line recipes.
5. **Mature, not fancy.** Rejected as gimmicky: stickers, comic starbursts, neon flicker, bouncing letters, glitch/RGB split, camera shake, slot reels, ransom-note letters. Aim for the restraint of documentary titles, Apple keynotes, editorial magazines and premium brand Reels.
6. **Simple to use.** One click applies the template. The template does the thinking (see section 7). No setup, and it works in every language and script the app supports, left-to-right and right-to-left.
7. **Short preview cards.** In the template gallery and preview page, each card is mostly the phone preview plus a few short lines (see the deliverable).

## 5. THE APP'S EXISTING VOCABULARY (USE IT, DO NOT COPY TEMPLATES)

The existing templates (about 50 advanced, plus basic ones) are built as sequences of typed lines, where the important word has its own animation. Reuse this vocabulary in new combinations.

### Line types

| Type | What it is |
|---|---|
| **CPT (creatively placed text)** | The hero composition. Words are placed and scaled as a designed layout: the important word large, supporting words small, off-centre placement, drop-cap or stacked arrangements. Use it for hooks and payoffs. |
| **A. Plain** | A normal sentence. It appears whole with a short fade (about 240 ms). No emphasis. |
| **B. Plain + key word only** | A normal sentence with no motion. Only the important word is styled (colour, weight, italic, underline, box or spacing). |
| **C. Animated sentence** | Words enter one by one (rise, slide, sequential fade and so on). There is no separate important-word effect. |
| **D. Animated sentence + animated key word** | Words enter one by one, and the important word gets its own, different entrance and emphasis, a little later and held longer. |
| **E. Styled line** | One bespoke effect drives the whole line (split title, ink wipe, blur focus, ticker roll and so on). |
| **F. Karaoke** | The full sentence is visible from the start, and a highlight follows the speech. |

### Animations available

- **Word-by-word entrances:** rise, slide from left, slide from right, roll, wipe, wipe-up, fade, sequential fade, scale, 3D flip, bounce, diagonal, expand, skew, stencil, lift, sticky wave, karaoke.
- **Important-word motions:** drop, wipe, diagonal wipe, skew snap, pop, roll, lift, stamp, wipe-up, drift, stencil, flicker, typewrite. Entrance direction can be *opposite-slide* or *opposite* (the word comes in from the side opposite the other words).
- **Important-word styles:** bold, colour (gold, rose, cyan, green, purple, orange), italic, weight change, underline, box, letter-spacing.
- **Styled line effects:**
  - **Reveals:** fade reveal, slow fade, crossfade, ink wipe, doc wipe, slash wipe, blur focus, grain blur, inner reveal, secret reveal, peel on, center expand, editorial word reveal.
  - **Rise and slide:** rise up, soft rise, slow rise, hard rise, slide, slide-up, slide-right, fast slide, surge in, side slap, slide and stick.
  - **Impact:** slam, slap, punch pop, center pop, pow pop, impact settle, stamp in, drop bounce, knock on, backhand slap, bass spike.
  - **Typing:** typewriter, handwrite, annotate, autocorrect, track changes, live edit, cut and paste, draft lines, final draft, print head, tape feed, chat "typed / sent".
  - **Boards and paper:** ticker roll, split-flap boards (departures, now boarding, gate change, final call), tile by tile, key tile first, letter snap, click by click, ribbon clicks, tally, till receipt, line items, change due, tear off, glue strip, scrap drop, sticker drop, fridge snap.
  - **Kinetic:** 3D flip, wave in, chain reaction, slow topple, slow magnets, breathe, measure, level up, split title, route draw, interchange, express run, reverse run, next stop, last train, last piece, plot sheet, note build.
  - **Light and sound:** neon drop, neon expand, neon flicker, neon pulse, glitch, soundcheck, slow jam.
  - **Basic-template motions:** rise in, fade up, word rise, word slide in (and reverse), wipe in, echo in, flicker on, zen fade, luxury fade, royal reveal, scholar reveal, smoke reveal, sunset rise, type click.
- **Use freely (mature):** fade, slow fade, crossfade, rise / soft rise / slow rise, slide / slide-up / fast slide, wipe / wipe-up / ink wipe / doc wipe, blur focus, letter-spacing settle, typewriter, handwrite, karaoke, split title, center expand, impact settle, lift, drift, weight change, underline, box.
- **Avoid (gimmicky):** all neon, glitch, comic/pow pop, candy or k-pop bounce, ice shatter, matrix drop, pixel drop, spray paint, sticker drop, fridge snap, slam with camera shake.
- **Timing the app already uses:**
  - Fast word-by-word: 45 ms stagger, 210 ms per word, important-word emphasis 60 ms after its word for 300 ms, enter 200 ms, exit 260 ms.
  - Authored hero lines: 280 ms stagger, 430 ms body, 560 ms hero, 420 ms exit, 50 ms gap.
  - On short captions the app squeezes motion to finish within 82% of the caption's duration, so design motion that reads well at half speed.

## 6. DESIGN PRINCIPLES (APPLY ALL)

- **Two orientations, two layouts.** Each recipe has its own 9:16 layout and its own 16:9 layout.
  - **Sizing.** Size type from the frame's shorter side, for example `min(cqw, cqh)`, so text doesn't balloon in landscape.
  - **9:16 vertical:**
    - text stacks into 2–3 short rows
    - hero words can fill the width
    - CPT layouts stack vertically
  - **16:9 landscape:**
    - 1–2 rows of about 32–42 characters each
    - body text about 3.2–4.2% of frame height for readable subtitles
    - captions usually sit as a lower third, or in a side column opposite the speaker (who is often framed left or right of centre by the rule of thirds)
    - CPT and hero layouts use the width: the important word large on one side with supporting words beside it, a split title across the frame, or a side column
    - never a tall narrow stack in the middle
  - The template's signature motion, type pairing, palette and highlight treatments stay the same in both orientations; only composition and scale change.
  - Motion distances scale with the frame. A slide that crosses 30% of a vertical frame should cross a similar visual distance in landscape, not twice as far.

- **One idea per template.** Each template has:
  - one signature motion (unique across all templates)
  - one type pairing (display + body)
  - one muted accent colour (no neon)
  - a name that says the idea
- **Vary composition and pacing between lines.** Lines differ through:
  - line type (CPT, A–F)
  - layout: subtitle, headline, big word, label + line, or quote
  - placement: top, middle or bottom; left, centre or right
  - scale and weight
  - reveal unit: word, letter, line, or all at once

  The signature motion family keeps the five lines feeling like one family.
- **Hierarchy.** The important word is the hero; the rest support it. The **full sentence is always readable**. Never show the important word alone with the rest of the sentence missing.
- **Timing follows speech.**
  - Words appear on their spoken timestamp.
  - The important word gets 250–380 ms of extra hold.
  - Hold the finished line 1.3–1.5 s.
  - Exit in 250–400 ms.
  - Stagger letters by 25–45 ms.
  - Never make the viewer wait for the animation to finish before reading.
- **Motion budget.**
  - Entrances: 250–900 ms.
  - Easing: expo-out `cubic-bezier(.16,1,.3,1)` for settles, `cubic-bezier(.2,.8,.2,1)` for slides, linear for wipes.
  - At most one moving property family per element.
  - No overshoot unless the idea is physical.
  - Loops only when they are the idea, and kept subtle.
- **Legibility.**
  - At most 2–3 rows, about 22 characters per body row and about 13 per headline row.
  - Body text at least 5cqw of frame width, and **never below 5.4cqw for complex scripts** (Indic, Arabic, Thai, Khmer, Lao, Myanmar, Tibetan).
  - CJK is denser: about 12–16 characters per row.
  - Test contrast on a light scene and a dark scene.
  - Reading speed should not exceed about 17 characters per second for alphabetic scripts, and is lower for CJK (roughly 9–12 characters per second). If the speech is faster, simplify the line rather than speed the motion up.
- **Safe areas: 9:16.**
  - Keep text out of the bottom 12% and the top 8%.
  - Keep it out of the right-hand 14% between 45% and 90% height (Reels buttons).
  - Keep it off the speaker's face (usually 45–65% height, centred).
- **Safe areas: 16:9.**
  - Keep text inside the 90% title-safe area.
  - Keep it out of the bottom 10–12%, where YouTube's progress bar, player controls and native captions sit.
  - Avoid the top-right corner, where YouTube end screens, cards and the channel watermark appear.
  - Keep it off the speaker's face (usually the middle third horizontally, or the left or right third when the speaker is framed off-centre).
- **Every language and script.** A template is one design that works in all of them, not an English design with translations poured in.
  - **Reveal units.**
    - Latin, Cyrillic and Greek may reveal letter by letter.
    - Never split joined or stacked scripts into letter boxes: Arabic (letters join), Devanagari and other Indic scripts, Thai, Khmer, Lao, Myanmar, Tibetan. Animate whole words, or grapheme clusters from `Intl.Segmenter`.
    - Chinese, Japanese, Thai, Lao, Khmer and Myanmar don't put spaces between words. Find word boundaries with `Intl.Segmenter(lang, { granularity: 'word' })`, never by splitting on spaces.
  - **Right-to-left.** Arabic, Hebrew, Persian and Urdu run right to left.
    - Mirror the whole layout: alignment, CPT arrangements, side columns, rules and panels.
    - Mirror motion direction: slides come from the start edge, wipes and karaoke run right to left, and "opposite-slide" flips too.
    - Use logical CSS (`inline-start`, `text-align: start`) and `dir="auto"` per caption. Keep numbers and Latin words inside RTL text in the right bidi order.
  - **Case, spacing and italics.**
    - Uppercase, small caps and letter-spacing only for scripts that have case (Latin, Cyrillic, Greek, Armenian). Set `lang` so locale rules apply (Turkish İ/ı, German ß).
    - Never letter-space Arabic or Indic text, and never fake italics or obliques on scripts that have none (Arabic, CJK, Indic, Thai).
    - So every highlight style needs a **script-safe equivalent**: italic, caps and tracking fall back to weight, colour, size or underline. That fallback must still differ from the template's other four highlights.
  - **Size and line height.** Scripts with marks above and below (Indic, Thai, Arabic, Myanmar, Tibetan, Vietnamese) need line-height of at least 1.3 (1.5 for Myanmar and Tibetan) and room for marks in clipped reveals. Clip masks must never cut off diacritics.
  - **Line breaking.** Follow each language's rules: CJK punctuation (、。」) never starts a row, Thai breaks only at word boundaries, and short function words never sit alone at the end of a row.
  - **Fonts.** Each template states a fallback *category* (sans, serif, display or handwritten) so the app picks the closest shipped face in every script. For example, Devanagari maps sans to Mukta, serif to Tiro Devanagari Hindi, display to Rozha One and handwritten to Kalam, and CJK serif to Noto Serif JP/SC.
  - **Numbers.** Keep the creator's digits and formats: Arabic-Indic (٣٠٠), Devanagari (३००), `1,000` / `1.000` / `1 000`, and any currency ($, €, £, ¥, ₹, R$, ₦, ₩). Never reformat them.
  - **Emoji.** Treat each emoji as one unbreakable unit, keep its native colours, and never highlight an emoji on its own.
  - **Samples.** Write natural native lines in each language, not word-for-word translations.
- **Fit.** Single-line hero words auto-shrink to 84–88% of the frame width. Measure an inline-block.
- **No stuck frames.** Use `steps(n, jump-none)` or linear easing for stepped or very short animations. Plain `steps()` or 1 ms animations can stop on their second-to-last frame.
- **Accessibility.**
  - Never flash more than 3 times a second.
  - Don't rely on colour alone to mark the important word; pair it with weight, size or motion.
  - Respect reduced-motion by falling back to fades.

## 7. EMOTIONAL INTELLIGENCE: THE TEMPLATE THINKS FOR THE CREATOR

A world-class template does not blindly rotate line 1 → 5. For every caption it **reads the moment** and chooses the right recipe, the right highlight and the right energy, while keeping variety and the template's identity. The creator applies a template and it simply feels right, starting from the first caption in the preview.

### 7.1 Signals to read for every caption

- **Language.**
  - Detect the language and script **per caption**, not per video, because creators switch mid-video.
  - Code-mixing (Hinglish, Spanglish, Taglish, Arabizi, Franglais) is normal. Read each word in its own language.
  - The text signals below need word lists for every language. Start with the app's most-used languages. For a language with no list, rely on the signals that work in any language (timing, audio, numbers, punctuation, position) and go quieter.
- **Text.**
  - Word count and length (character count for CJK).
  - Punctuation in every script: `?` `!` `…` `؟` `？` `！` `¿` `¡`, and quotes such as « » 「 」.
  - Numbers, currency and units in any format (50,000 €, $1.2M, R$ 50, ¥3000, ₹50,000, 10x, 90%, 3 days).
  - Names and places.
  - Negations and reversals: never, not, nunca, jamais, nicht, لا, 不, nahi.
  - Contrast words: but, however, pero, mas, mais, aber, لكن, でも, 但是, lekin.
  - List markers: first, second, step 1, primero, erstens, 第一, pehla.
  - Commands and calls to action: follow, save, comment, link in bio, sígueme, link na bio, 关注, フォロー.
  - Superlatives: best, worst, el mejor, le meilleur, 最, sabse.
  - Time words: today, now, hoy, ahora, 今日, abhi.
  - Emotional words in every language for joy, anger, sadness, fear, surprise, love, pride, urgency and calm.
- **Timing.**
  - Speech rate in words per second.
  - Pauses before and after the caption; a pause before it means a reveal or punchline is coming.
  - Stretched words: a word held much longer than its length suggests is stressed.
  - Caption duration.
- **Audio.**
  - Loudness (RMS) against this video's own average.
  - Peaks, and the loudest word.
  - Silence ratio.
  - Energy rising or falling through the line.
  - Whisper versus shout.
- **Position in the video.**
  - First caption: the hook.
  - Last one or two captions: the payoff or call to action.
  - The middle: development.
  - A caption right after a long pause or a cut: a new beat.
- **Context.**
  - The previous two captions' recipes and highlights, to avoid repetition.
  - Running list items, to keep them consistent.
  - The template's niche and mood.

### 7.2 Classify each caption

Each caption gets an **intent** and an **energy** label.

- **Intent:** hook, statement, explanation, list item, statistic/number, question, contrast/twist, punchline, quote, emotional peak, call to action, transition/filler.
- **Energy:** calm, balanced or high. It comes from the audio against the video's own baseline plus the text cues; never use absolute loudness.

### 7.3 Choose the line recipe

| Moment | Recipe |
|---|---|
| **Hook (first caption)** | The template's CPT or strongest hero recipe. In the gallery preview and on first apply, line 1 must show this, built from the user's real first caption, with no blank frame. |
| **Payoff, punchline, emotional peak, big number** | CPT, D or a styled hero. A punchline that follows a pause waits for the beat. |
| **Statistic or number** | A hero treatment that makes the figure the hero. Keep the number and its unit or currency together. |
| **Question** | A distinct, quieter recipe that leaves room for the answer. The answer line gets the emphasis. |
| **Contrast or twist** | The words after the contrast word ("but", "pero", "mais", "でも", "lekin") get the emphasis, and a reveal-style recipe. |
| **List items** | **Consistency beats variety here.** Items 1, 2, 3 share one recipe and one highlight style. Variety resumes after the list. |
| **Explanation or development** | A or B: plain lines rest the eye. |
| **Long caption (10+ words) or fast speech (over ~3.5 words/s)** | A or F (plain or karaoke) only. No word-by-word motion that can't finish in time. |
| **Very short caption (1–2 words)** | CPT/hero, as long as it isn't filler. |
| **Filler ("so", "okay", "you know", "o sea", "tipo", "genre", "えーと", "matlab")** | A at reduced emphasis, or merged with the next caption. |
| **Call to action at the end** | Clear, calm and high contrast. Usually B with the action word highlighted ("follow", "save", "link in bio"). |
| **Calm or sad moment** | Slower, softer recipes (fade or blur focus), muted accent, no hard impact. |
| **High energy** | The template's punchiest recipe, faster timing within the same motion family. Never switch to a gimmick. |

Rhythm rules:

- Never use the same recipe twice in a row.
- Never put two hero lines (CPT/D/E) back to back unless it's a deliberate list or countdown.
- Follow a hero line with a calmer line.
- Aim for roughly 1 hero line in every 3 captions.
- Over a whole video, every one of the template's five recipes should appear.

### 7.4 Choose the highlight: whether, which words and how strongly

- **Whether.**
  - Plain lines (A, F) have no highlight.
  - Skip the highlight when no word clearly earns it. A low-confidence pick is worse than none: when in doubt, go quieter.
- **Which word(s).**
  - Never stop words in the caption's language (the, and; de, la, que; der, und; の, は, が; 的, 了; في, من; है, का…).
  - Prefer, in this order:
    1. the word the speaker stressed (loudness peak or stretched duration)
    2. numbers with their unit or currency
    3. meaning-flipping negations ("never", "nahi", when they carry the point)
    4. the word after a contrast word
    5. emotional words
    6. nouns and verbs that carry the point
    7. names
  - Keep multi-word phrases together: "main character", "link in bio", "$1,000", "fin de semana", "दस लाख". Allow at most 2 words.
  - In languages without spaces, highlight a whole segmented word (from `Intl.Segmenter`), never a stray single character.
  - In right-to-left text the highlight motion mirrors with the line.
  - Don't highlight the first word unless the caption is the hook.
  - Don't highlight the same word in two consecutive captions.
- **Strength tiers.**
  - **None.**
  - **Subtle:** colour or weight only.
  - **Standard:** style plus a short motion.
  - **Hero:** a CPT layout with the word large.

  Strength follows intent and energy. Hooks and peaks get hero; explanations get subtle or none.
- **Uniqueness.** Each recipe has its own highlight style and motion, so a highlight never looks like the previous line's.

### 7.5 Adapt placement and timing

- **Placement.**
  - Read the orientation first and use that recipe's 9:16 or 16:9 layout.
  - Read the direction next: right-to-left captions use the mirrored layout.
  - In landscape, put side-column and CPT layouts on the side opposite the speaker.
  - Move the caption away from the face when the speaker is close to camera.
  - Alternate zones so consecutive lines don't stack in the same place.
  - Keep list items in the same zone.
- **Timing.**
  - Fast speech: shorter staggers and reveal by line.
  - Slow speech: word by word with breathing room.
  - After a pause: let the caption arrive on the beat.
  - Hold emotional peaks a little longer.

### 7.6 Creator control and trust

- Smart mode is the default and is fully overridable. Per caption, the creator can:
  - pin a recipe
  - change, add or remove the highlight
  - set energy to calm, balanced or bold
- Manual edits are **never overwritten** by re-analysis.
- **Explain the choice** with a small badge in the editor, such as "Hook", "Number", "Punchline", "List 2/3" or "Calm".
- **Deterministic.** The same captions and audio always give the same choices.
  - Compute the decisions once.
  - Store them on the caption, for example `line_recipe`, `intent`, `energy`, `imp_word_indices`, `highlight_strength`, `placement_zone`.
  - Preview and export read the stored decision, so the result never changes between preview and export.
- **Graceful fallback.**
  - No audio: decide from text and timing alone.
  - No word timings: use line-level reveals.
  - Low confidence: use the plainer recipe.
- **Culture and language.**
  - Understand code-mixed speech in any language pair.
  - Treat honorifics (ji, -san, -nim, señor), holiday and festival words, and local number words (lakh, crore, mil, millón, 万, 億) as meaningful.
  - Don't let one culture's defaults leak into others: colour meanings, reading direction and humour differ by market. Keep accents muted and neutral.
  - Never translate or alter the creator's words.

## 8. DELIVERABLE

Design **15 templates**. For each one, give:

1. **Name** and **best for** (niches).
2. **Signature motion:** what moves, from what to what, duration and easing. It must be unique across all 15.
3. **Type system:**
   - body font and weight, plus display font and weight, from the allowed list
   - a fallback category for each (sans, serif, display or handwritten), plus any specific script pairings (for example Tiro Devanagari Hindi, Noto Serif JP)
   - text case and letter-spacing, with what happens in scripts that have no case
4. **Palette:**
   - `c1` text colour, `c2` muted accent, optional panel colour
   - a contrast note for light and dark footage
5. **Five line recipes.** Each recipe gives:
   - **Line type:** CPT or A–F. Use at least four types, including at least one plain line and one CPT/hero.
   - **Line animation:** different for each of the five.
   - **Important-word highlight:** style plus motion, different for each of the five. A plain line has none. Give the script-safe equivalent wherever the style uses italics, caps or tracking.
   - **Composition:** subtitle, headline, big word, label + line, or quote.
   - **Placement:** vertical % and alignment, given **separately for 9:16 and 16:9**, plus the type scale for each. Note how it mirrors for right-to-left.
   - **Reveal unit:** word, letter, line or all at once.
   - **Timing.**
   - **Intended use:** hook, explanation, list, number, question, punchline or CTA.
6. **Smart rules (section 7) for this template:**
   - which recipe it uses for the hook, numbers, questions, lists, calm moments, high energy and the CTA
   - its highlight strength tiers
7. **Sample script.** Eight consecutive spoken lines for the niche, with the important words marked `*like this`. Include a hook, a list of two or three items, a number, a question or twist, a calm line and a call to action. Mark a two-word phrase as `*[like this]`. Give it in English plus at least four more languages from different script groups: one Latin-script (Spanish, Portuguese, French, German or Indonesian), one right-to-left (Arabic or Hebrew), one CJK (Japanese, Chinese or Korean) and one Indic or Southeast Asian (Hindi, Bengali, Tamil or Thai). Vary the languages across templates so the full set covers at least ten.
8. **Export notes:**
   - which `captionStyle` fields it maps to
   - what needs authored markup
   - which per-caption decision fields it stores
   - confirmation that every frame is deterministic

Then build **one self-contained HTML preview page**:

- A grid of preview frames, each with a speaker silhouette over muted gradient "footage".
- An **orientation toggle: 9:16 / 16:9** (and optionally 1:1). In 16:9 the frame switches to landscape with the speaker framed off-centre, and every recipe uses its landscape layout.
- Each phone plays its eight-line script with the smart rules applied, so viewers see the template *choose* recipes. A small badge shows the intent for each line.
- **Short cards.** The preview frame is the card, at most about one screen tall on desktop. On mobile the whole card fits without scrolling. Under the phone show only:
  - name and number
  - one line for "best for"
  - one line for the motion
  - a single row of five small recipe chips (1–5), with the one in use highlighted

  Put full descriptions behind a closed "Details" toggle.
- A **language menu** (English plus the template's other sample languages, always including one RTL and one CJK), a 0.5×/1× speed control, pause, and tap-to-restart. Switching to an RTL language mirrors the layout and motion.
- Google Fonts only.
- Test every template on all recipes in every sample language, in both orientations, before calling it done.

## 9. QUALITY BAR: ONE WORKED EXAMPLE

**Rule:** for weddings, events and invitations.

- **Signature motion:** a 0.35cqw gold rule grows beside the text block in 700 ms (expo-out). Rows slide out from behind it (translateX ∓102%, clipped per row, 800 ms expo-out).
- **Type:**
  - Cormorant Garamond 500 for the body, 600 for the hero.
  - Marcellus for labels.
  - Fallback category: serif. Devanagari uses Tiro Devanagari Hindi, Japanese uses Noto Serif JP, and Arabic uses Noto Sans Arabic (the only shipped Arabic face) at weight 500.
- **Palette:** `c1` #FFF8EE, `c2` #D8B98A (old gold). The footage is darkened toward the bottom.
- **Landscape (16:9):**
  - The rule runs vertically beside a left-side column (or a right-side one when the speaker is framed left).
  - Recipe 1's big word spans about 45% of the width on one side.
  - Plain lines sit as a lower third at about 82% height, left-aligned, at most 2 rows of about 38 characters.
- **Right-to-left (Arabic, Hebrew):** the whole layout mirrors. The rule sits on the right of a right-aligned column, and rows slide out toward the left.
- **Recipes (9:16 placement shown):**

| # | Type | Layout and placement | Line animation | Highlight | Use |
|---|---|---|---|---|---|
| 1 | CPT | Label "12 · 12 · 2026" over a big word, top left | Rule grows, rows slide out | Spaced gold capitals that slide out last (scripts without case: gold at 700 weight, no spacing) | Hook |
| 2 | A | Subtitle, bottom right (rule moves right) | Rows slide out together | None | Explanation |
| 3 | B | Subtitle, bottom left | Plain fade, no motion | Gold italic, still (scripts without italics: gold, 8% larger) | Calm detail |
| 4 | D | Headline, top right | Words slide out from the rule one by one | Gold weight shift from 500 to 700 as it is spoken | Peak or number |
| 5 | F | Quote, middle left | Whole line visible; spoken words warm from 50% to full ivory | A thin gold underline draws in | Call to action |

- **Smart rules:**
  - hook → 1
  - list items → 2 (same placement for each item)
  - numbers and peaks → 4
  - calm → 3
  - the last caption → 5
  - never two of 1 or 4 back to back
- **Script:**
  - **EN:** "Two families one *celebration" / "Three days in Lisbon" / "Day one *[welcome dinner]" / "Day two the *ceremony" / "Day three the *party" / "Over *300 guests and counting" / "Do not forget your dancing shoes" / "*RSVP by Friday"
  - **ES:** "Dos familias una *celebración" / "Tres días en Lisboa" / "Día uno la *bienvenida" / "Día dos la *ceremonia" / "Día tres la *fiesta" / "Más de *300 invitados" / "No olvides tus zapatos de baile" / "*Confirma antes del viernes"
  - **AR (RTL):** "عائلتان في *احتفال واحد" / "ثلاثة أيام في لشبونة" / "اليوم الأول *[عشاء الترحيب]" / "اليوم الثاني *[مراسم الزفاف]" / "اليوم الثالث *السهرة" / "أكثر من *300 ضيف" / "لا تنسوا أحذية الرقص" / "*[أكدوا الحضور] قبل الجمعة"
  - **JA (CJK):** "二つの家族、ひとつの*お祝い" / "リスボンで三日間" / "一日目は*ウェルカムディナー" / "二日目は*挙式" / "三日目は*パーティー" / "ゲストは*300人以上" / "ダンスシューズを忘れずに" / "金曜までに*出欠のご返信を"
  - **HI:** "दो परिवार एक *जश्न" / "लिस्बन में तीन दिन" / "पहला दिन *[स्वागत डिनर]" / "दूसरा दिन *समारोह" / "तीसरा दिन *पार्टी" / "*300 से ज़्यादा मेहमान" / "नाचने वाले जूते मत भूलना" / "शुक्रवार तक *RSVP करें"
- **Export:** `font_family` Cormorant Garamond, `text_color` #FFF8EE, `emphasis_color` #D8B98A. The rule and the row clipping need authored markup. Stored per caption: `line_recipe`, `intent`, `energy`, `imp_word_indices`, `highlight_strength`. All CSS is time-driven, so frames are deterministic.

## 10. FINAL CHECK BEFORE DELIVERING

- [ ] All 15 templates have a unique signature motion and a unique type pairing.
- [ ] Inside every template, all five line animations differ, and all five highlights differ in both style and motion.
- [ ] Every template has at least one plain line and one CPT/hero line, and uses at least four line types.
- [ ] Smart rules are defined for the hook, numbers, questions, contrast, lists, calm moments, high energy and the CTA. Line 1 in the preview is chosen by the rules from the real first caption.
- [ ] Highlights skip stop words, keep phrases together, are never forced when confidence is low, and never repeat a word back to back.
- [ ] Nothing from the rejected list appears.
- [ ] Works in every language and script: whole-word or grapheme reveals for joined and stacked scripts, `Intl.Segmenter` for languages without spaces, mirrored layout and motion for right-to-left, script-safe equivalents for italic, caps and tracking, a fallback font category, no diacritics clipped, and nothing below 5.4cqw for complex scripts.
- [ ] Smart rules use per-language word lists, detect language per caption, and go quieter in a language with no list.
- [ ] Every recipe has its own designed layout for both 9:16 and 16:9 (not just scaled), and the preview has an orientation toggle.
- [ ] Captions stay inside the safe areas for each orientation (Reels UI in 9:16; YouTube progress bar, controls and end-screen corner in 16:9), legible on light and dark footage, at 17 characters per second or less.
- [ ] Every frame is deterministic. Decisions are stored per caption, so preview and export match.
- [ ] Cards are short. The page was tested in every sample language (at least one Latin-script, one RTL, one CJK and one Indic or Southeast Asian besides English) in both orientations.
