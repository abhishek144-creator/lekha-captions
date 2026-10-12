# Caption template design brief (prompt)

Paste everything below the line into an AI tool, or hand it to a motion designer. It collects every requirement and lesson from the caption template sessions (October 2026), including what the owner rejected and why.

---

## ROLE

You are a senior motion designer with 15 years in broadcast, title design and social video: documentary subtitles, brand films, Reels and Shorts packages. You design caption systems the way a type director designs a film title package. Every decision has a reason: hierarchy, rhythm, legibility and restraint. You do not decorate; you choreograph reading.

## THE PRODUCT

Lekha Captions is a web caption editor mainly for Indian social media creators (Reels, Shorts and other short vertical video). Users upload a talking-head or vlog video and get auto-transcribed captions in English, Hindi or Hinglish. They then pick a caption template and export a burned-in MP4.

Technical facts the design must respect:

- **Frame.** Mainly 9:16 vertical (1080×1920). Templates must also hold up at 1:1 and 16:9.
- **Caption data.** Each caption is one spoken line (usually 3–9 words) with word-level timings (start/end per word). It also has an **important word** (`imp_word_index`, sometimes several in `imp_word_indices`), which the app picks automatically. Build every template around that word, so it works on auto-generated captions as well as hand-written ones.
- **Rendering.** Preview runs in the browser (React + CSS). Export renders authored templates frame by frame with a headless-browser DOM/CSS renderer. Plain styles go through ASS/FFmpeg. So every animation must be a **pure function of time**:
  - CSS keyframes, transitions or JS driven by a clock.
  - Randomness only from a fixed seed (the caption text), so a re-render is identical.
  - Nothing that depends on hover, scroll, real-time audio or the network.
- **Fonts.** Use only fonts the export backend ships. Latin: Anton, Archivo Black, Arimo, Bebas Neue, Bitter, Bodoni Moda, Cardo, Cinzel, Comfortaa, Cormorant Garamond, Crimson Text, Darker Grotesque, DM Serif Display, IBM Plex Mono, Inter, Josefin Sans, Lato, League Spartan, Libre Baskerville, Lora, Marcellus, Merriweather, Montserrat, Mulish, Noto Sans, Nunito, Open Sans, Oswald, Overpass Mono, Playfair Display, Poppins, Questrial, Raleway, Roboto, Rubik, Space Grotesk, Space Mono, Teko, Unbounded, Unna, Work Sans. Devanagari: Mukta, Noto Sans Devanagari, Tiro Devanagari Hindi, Rozha One, Kalam, Hind, Martel, Eczar, Yantramanav, Khand, Rajdhani. Avoid novelty faces (Bangers, Pacifico, Rock Salt, Permanent Marker, Silkscreen, Orbitron, Shrikhand) unless a niche truly needs them.
- **Style fields.** The editor's style object already has: `font_family, font_size, font_weight, font_style, text_case, text_color, secondary_color, highlight_color, highlight_gradient, emphasis_color, has_background, background_color, background_opacity, background_padding, has_stroke, stroke_color, stroke_width, has_shadow, shadow_color, shadow_blur, shadow_offset_x/y, letter_spacing, line_spacing, word_spacing, position_y` (default 80% of frame height). Map every template onto these fields where possible. List anything extra as authored markup.

## WHAT THE OWNER WANTS (AND HAS REJECTED)

1. **Not generic.** A single style with one coloured active word ("yellow karaoke box") was rejected as generic.
2. **Five different lines per template.** A template is a *system* of five line treatments that rotate through the video: caption 1 uses line 1, caption 2 uses line 2, and so on, wrapping after 5. No two consecutive lines may look the same. The owner's example: "line 1 creatively placed, line 2 normal, line 3 animated."
3. **No repetition between templates.** An earlier set reused one pool of effects across all templates and was rejected for it. **Each template owns its signature motion. No two templates may share a motion, and no two may share a type pairing.**
4. **Mature, not fancy.** These were rejected as gimmicky: stickers, comic starbursts, neon flicker, bouncing letters, glitch/RGB split, camera shake, slot reels, ransom-note letters. Aim for the restraint of documentary titles, Apple keynotes, editorial magazines and premium brand films.
5. **Market-relevant and simple to use.** Indian creator niches, working in English and Hindi. One click to apply, no setup.
6. **Built for social media first.** The main users are social media creators posting short vertical video:
   - **Platforms.** Instagram Reels, YouTube Shorts, Moj, Josh and Snapchat Spotlight. Facebook Reels and LinkedIn video come second.
   - **Mobile-first and sound-off.** Most viewers watch on a phone with the sound off, so the captions carry the story. Design for a 6-inch screen viewed at arm's length while scrolling, not for a desktop monitor.
   - **Stop the scroll.** Line 1 of every template is the hook. It must read in under a second and stand out in the first 1–2 seconds, through scale, placement or contrast, not gimmicks. Mature and attention-grabbing are not opposites: think of how a premium brand's Reel opens.
   - **Fast pacing.** Typical speech is 150–190 words a minute, with clips of 15–90 seconds and quick cuts. Entrances must finish fast enough that the next caption never stacks on top of an unfinished one.
   - **Real niches.** Talking-head tips, storytime, finance, fitness, food, travel, beauty and fashion, tech reviews, education, motivation, comedy skits, podcast clips, weddings and events, local business promos.
   - **Platform-native feel.** It should look at home next to native Reels/Shorts text and survive the platform's own compression. Avoid hairlines under 2 px at 1080 wide, very thin weights at small sizes, and low-contrast colours that get muddied by compression.
   - **Works over any footage.** Creators won't adjust per clip, so every template needs built-in legibility (shadow, a quiet panel or a scrim) on both bright selfie footage and dark night footage.

## WHAT THE APP'S TEMPLATES ALREADY DO (USE AS VOCABULARY, DO NOT COPY)

The existing advanced templates (about 50) are built the same way: a sequence of lines, where each line has a *type* and the important word has its *own* animation. Use this structure and vocabulary. Do not recreate an existing template's exact combination.

### Line types (mix these inside every template)

| Type | What it is |
|---|---|
| **A. Plain** | A normal sentence. It appears as a whole with a short fade (about 240 ms). No word motion, no important-word emphasis. |
| **B. Plain + key word only** | A normal sentence with no motion. Only the important word is styled: colour, weight, italic, underline, a box behind it, or wider spacing. |
| **C. Sentence with animation** | Words enter one by one (rise, slide, sequential fade and so on). There is no separate important-word effect. |
| **D. Sentence + key word + animation** | Words enter one by one, and the important word has its own, different entrance and emphasis on top: it arrives with a different motion, a little later, and holds longer. |
| **E. Styled line** | One bespoke authored effect drives the whole line, such as a split title, ink wipe, blur focus or ticker roll. It may also emphasise the important word. |
| **F. Karaoke** | The full sentence is visible from the start, and a highlight follows the speech word by word. |

Rules:

- A five-line template should use at least four of these types.
- **The important-word animation must change from line to line** inside a template. For example: line 2 drops in, line 4 wipes in, line 5 uses a weight change.
- Plain lines (A) are rests between busier lines. Every template needs at least one.

### Word-by-word entrances already in the app

Rise, slide from left, slide from right, roll, wipe, wipe-up, fade, sequential fade, scale, 3D flip, bounce, diagonal, expand, skew, stencil, lift, plus sticky wave and karaoke.

### Important-word animations already in the app

- **Motion:** drop, wipe, diagonal wipe, skew snap, pop, roll, lift, stamp, wipe-up, drift, stencil, flicker, typewrite.
- **Entrance direction:** *opposite-slide* or *opposite* (the important word comes in from the opposite side to the other words).
- **Styles:** bold, colour (gold, rose, cyan, green, purple, orange), italic, weight change, underline, box, letter-spacing.
- **How it's chosen:** the app picks the important word by skipping English and Hindi stop words (the, and, है, का, में…) and using vocal emphasis from the audio.

### Named line (styled) effects already in the app

- **Reveals and wipes:** fade reveal, slow fade, crossfade, ink wipe, doc wipe, slash wipe, blur focus, grain blur, inner reveal, secret reveal, peel on, center expand, editorial word reveal.
- **Rise and slide:** rise up, soft rise, slow rise, hard rise, slide, slide-up, slide-right, fast slide, surge in, side slap, slide and stick.
- **Impact:** slam, slap, punch pop, center pop, pow pop, impact settle, stamp in, drop bounce, knock on, backhand slap, bass spike.
- **Typing and editing:** typewriter, handwrite, annotate, autocorrect, track changes, live edit, cut and paste, draft lines, final draft, print head, tape feed, "they typed / they sent" (chat).
- **Boards and paper:** ticker roll, departures / now boarding / gate change / final call (split-flap), tile by tile, key tile first, letter snap, click by click, ribbon clicks, tally, till receipt, line items, change due, tear off, glue strip, scrap drop, sticker drop, fridge snap.
- **Kinetic and physics:** 3D flip, wave in, chain reaction, slow topple, slow magnets, breathe, measure, level up, split title, route draw, interchange, express run, reverse run, next stop, last train, last piece, plot sheet, note build.
- **Light and sound:** neon drop, neon expand, neon flicker, neon pulse, glitch, soundcheck, slow jam.
- **Basic-template motions:** rise in, fade up, word rise, word slide in (and reverse), wipe in, echo in, flicker on, zen fade, luxury fade, royal reveal, scholar reveal, smoke reveal, sunset rise, type click.

### How this vocabulary applies to new templates

- **Use freely (mature):** fade, slow fade, crossfade, rise / soft rise / slow rise, slide / slide-up / fast slide, wipe / wipe-up / ink wipe / doc wipe, blur focus, letter-spacing, typewriter, handwrite, karaoke, split title, center expand, impact settle, lift, drift, weight change, underline, box.
- **Avoid, per the owner's maturity rule:** neon (all), glitch, comic or pow pop, candy or k-pop bounce, ice shatter, matrix drop, pixel drop, spray paint, sticker drop, fridge snap, slam with camera shake.

### Timing the app already uses (stay in this range)

- **Fast word-by-word:** 45 ms stagger, 210 ms per word, important-word emphasis 60 ms after its word for 300 ms, enter 200 ms, exit 260 ms.
- **Authored hero lines:** 280 ms stagger, 430 ms body words, 560 ms important (hero) word, exit 420 ms, 50 ms gap between captions.
- **Short captions:** on short captions, the app squeezes the authored motion so it finishes within 82% of the caption's duration, keeping the easing and relative stagger. Design motion that still reads well at about half speed.

## DESIGN PRINCIPLES (APPLY ALL)

- **Vary composition, not effects.** Inside a template, the five lines change through:
  - **Layout:** subtitle, headline, big important word, label + line, or quote.
  - **Placement:** top, middle or bottom; left, centre or right.
  - **Scale and weight.**
  - **Reveal unit:** word by word, letter by letter, line by line, or all at once.

  The template's single signature motion stays constant, so the set feels like one family.
- **One idea per template.** Build it from a signature motion, a type pairing (display + body), at most one muted accent colour (no neon) and an important-word treatment. Name the template after its idea.
- **Hierarchy first.** The important word is the hero; lead-in and tail words support it. The full sentence must always be readable on screen. Never show the important word alone with the rest of the sentence missing.
- **Timing follows speech.**
  - Words appear on their spoken timestamp.
  - Give the important word about 250–380 ms of extra hold before the next word.
  - Hold the finished line about 1.3–1.5 s after the last word.
  - Exit in 250–400 ms.
  - Stagger letters 25–45 ms and words by their speech timing.
  - Never make the viewer wait for an animation to finish before they can read.
- **Motion budget.**
  - Entrances: 250–900 ms.
  - Easing: expo-out `cubic-bezier(.16,1,.3,1)` for settles, `cubic-bezier(.2,.8,.2,1)` for slides, linear only for wipes.
  - At most one moving property family per element (opacity + one transform, or clip, or blur, or letter-spacing).
  - No overshoot unless the template's idea is physical.
  - Infinite loops only where they are the template's idea, and kept subtle.
- **Legibility.**
  - At most 2–3 rows per caption, about 22 characters per row for body text, about 13 for headline rows.
  - Body text at least 5cqw of frame width, and **never below 5.4cqw for Hindi**.
  - Add a soft text shadow or a quiet panel on bright footage.
  - Check contrast on a light scene and a dark scene.
- **Safe areas (Reels/Shorts/TikTok UI).**
  - Keep text out of the bottom 12% and the top 8%.
  - Keep it out of the right-hand 14% between 45% and 90% height (the like and comment buttons).
  - Don't park text on the speaker's face. The face usually sits between 45% and 65% height, centred.
- **Hindi and Devanagari.**
  - Never split a Devanagari word into separate letter boxes; it breaks the headline stroke (shirorekha). Animate whole words.
  - No uppercase or letter-spacing on Hindi.
  - Use line-height of at least 1.3.
  - Pair each Latin font with a Devanagari fallback of the same mood: Mukta for sans-serif, Tiro Devanagari Hindi for serif, Rozha One for display, Kalam for handwritten.
  - Write real Hindi sample lines, not transliterations.
- **Fit.** Single-line hero words must auto-shrink to fit about 84–88% of the frame width. Measure an inline-block, not a full-width block.
- **No stuck animations.** Use `steps(n, jump-none)` or linear easing for stepped or very short animations. Plain `steps()` or 1 ms animations can stop on their second-to-last frame because of floating-point rounding, which leaves letters invisible or half-clipped.

## DELIVERABLE

Design **15 templates**. For each one, give:

1. **Name** (one or two words) and **best for** (niches).
2. **Signature motion:** what moves, from what to what, duration and easing. It must be unique across all 15.
3. **Type system:**
   - Body font and weight, plus key/display font and weight, all from the allowed list.
   - Devanagari fallback for each.
   - Text case and letter-spacing.
4. **Palette:**
   - `c1` text colour, `c2` muted accent, optional panel colour.
   - Contrast note for light and dark footage.
5. **Important-word treatment** (unique per template), for example:
   - an italic serif swap
   - weight shift
   - a thin traced outline
   - small caps
   - a drawn hairline
   - a slow light sweep
6. **Five line specs.** For each line give:
   - **Line type:** A to F from the list above. Use at least four different types per template, including at least one plain line.
   - **Important-word animation:** its motion and style. It must differ from the other four lines of the same template. A plain line (A) has none.
   - **Composition:** subtitle, headline, big word, label + line (with the label text), or quote.
   - **Placement:** vertical % and alignment.
   - **Reveal unit:** word, letter, line or all at once.
   - **Timing:** any notes.
7. **Sample script.** Five consecutive spoken lines for the niche in English, the same five in natural Hindi, with the important word marked `*like this`.
8. **Export notes:**
   - Which `captionStyle` fields it maps to.
   - What needs authored markup.
   - Confirmation that every frame is deterministic.

Then build a **single self-contained HTML preview page**:

- A grid of 9:16 phones with a simple speaker silhouette over a muted gradient "footage" background.
- Each phone loops its five-line script, with the template's motion driven by real word timings.
- The list of five lines under each phone highlights the line on screen.
- **Keep each template card short.** The phone preview is the card; it should take up about one screen height at most on desktop, and on mobile the whole card should fit without scrolling. Under the phone, show only:
  - the template name and number
  - one line for "best for"
  - one short line for the signature motion
  - the five lines as a compact single-row strip of five small chips (1 to 5), with the chip for the line on screen highlighted
  
  Put full line descriptions in a tooltip or an expandable "Details" toggle that starts closed. No paragraphs, no long recipe lists.
- An English/हिंदी toggle, a 0.5×/1× speed control, pause, and tap-to-restart.
- Load Google Fonts only.
- Test every template on all five lines in both languages before calling it done.

## QUALITY BAR: ONE WORKED EXAMPLE

**Rule:** for weddings, events and invitations.

- **Signature motion:** a 0.35cqw gold rule grows down beside the block in 700 ms (expo-out). Text rows slide out from behind the rule (translateX from ∓102%, clipped by each row, 800 ms expo-out).
- **Type:**
  - Cormorant Garamond 500 for the body, 600 for the key word.
  - Marcellus for labels.
  - Devanagari: Tiro Devanagari Hindi.
- **Palette:** `c1` #FFF8EE, `c2` #D8B98A (old gold). The footage is darkened toward the bottom.
- **Important word:** spaced capitals in gold (uppercase, 0.08em tracking, 0.9em size).
- **Lines:**
  1. Label "12 · 12 · 2026" + line, top left, line by line.
  2. Big word, middle left, line by line.
  3. Subtitle, bottom right (the rule moves to the right side), line by line.
  4. Headline, top right, line by line.
  5. Subtitle, bottom left, word by word.
- **Script:**
  - EN: "Two families one *celebration" / "Join us in *Udaipur" / "Three days of music food and *family" / "Bring your dancing *shoes" / "We cannot wait to *see you"
  - HI: "दो परिवार एक *जश्न" / "हमारे साथ आइए *उदयपुर में" / "तीन दिन संगीत खाना और *परिवार" / "अपने नाचने वाले *जूते लाना" / "आपसे मिलने का *इंतज़ार है"
- **Export:** `font_family` Cormorant Garamond, `text_color` #FFF8EE, `emphasis_color` #D8B98A. The rule and the row clipping need authored markup. Everything is time-driven CSS, so frames are deterministic.

Match this level of specificity and restraint for all 15. Before finishing, check that:

- Every template's motion and type pairing are different from the other 14.
- Every template's five lines are visibly different from each other.
- Nothing on the rejected list appears anywhere.
