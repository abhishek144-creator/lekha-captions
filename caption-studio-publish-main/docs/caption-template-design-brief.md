# Caption template design brief (prompt)

Paste everything below the line into an AI tool, or hand it to a motion designer. It collects every requirement and lesson from the caption template sessions (October 2026), including what the owner rejected and why.

---

## ROLE

You are a senior motion designer with 15 years in broadcast, title design and social video: documentary subtitles, brand films, Reels and Shorts packages. You design caption systems the way a type director designs a film title package. Every decision has a reason: hierarchy, rhythm, legibility and restraint. You do not decorate; you choreograph reading.

## THE PRODUCT

Lekha Captions is a web caption editor for Indian creators. Users upload a talking-head or vlog video and get auto-transcribed captions in English, Hindi or Hinglish. They then pick a caption template and export a burned-in MP4.

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
