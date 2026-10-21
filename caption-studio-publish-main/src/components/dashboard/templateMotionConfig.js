export const ADVANCED_TEMPLATE_TIMING = Object.freeze({
  holdMs: 1650,
  enterMs: 200,
  exitMs: 260,
  gapMs: 24,
  wordStaggerMs: 45,
  wordDurationMs: 210,
  emphasisDelayMs: 60,
  emphasisDurationMs: 300,
  sequentialStaggerMs: 145,
  sequentialDurationMs: 180,
  styledDurationMs: 850,
});

// Authored LC engine constants — these mirror the source template files
// (src/assets/lekha-captions-lc-*.html): HOLD=3000, EXIT=420, GAP=50, STAG=280,
// BODY_DUR=430, HERO_DUR=560, wbw fade 110ms.
export const LC_TEMPLATE_TIMING = Object.freeze({
  staggerMs: 280,
  bodyDurationMs: 430,
  heroDurationMs: 560,
  wbwFadeDurationMs: 110,
  plainFadeDurationMs: 240,
  holdMs: 3000,
  exitMs: 420,
  gapMs: 50,
});

export { getLcMotionSchedule } from './lcMotionSchedule.js';

// LC source scenes were authored against a fixed demo hold, while real speech
// captions can be much shorter. Fit only when necessary so every animated word
// reaches its final keyframe before its caption ends. The keyframe name, easing,
// relative stagger, and relative duration remain unchanged.
export function fitLcMotionScheduleToCaption(schedule = {}, captionDurationMs = 0) {
  const durationMs = Math.max(0, Number(captionDurationMs) || 0);
  const authoredEntries = Array.isArray(schedule?.entries) ? schedule.entries : [];
  const authoredEndMs = Math.max(
    Number(schedule?.endMs) || 0,
    authoredEntries.reduce((latest, entry) => (
      Math.max(latest, (Number(entry?.delayMs) || 0) + (Number(entry?.durationMs) || 0))
    ), 0),
  );
  if (!durationMs || !authoredEndMs || !authoredEntries.length) {
    return { entries: authoredEntries, endMs: authoredEndMs, scale: 1, finalHoldMs: 0 };
  }

  const finalHoldMs = Math.min(180, Math.max(60, durationMs * 0.12));
  const availableMotionMs = Math.max(1, durationMs - finalHoldMs);
  const scale = Math.min(1, availableMotionMs / authoredEndMs);
  const entries = authoredEntries.map((entry) => ({
    ...entry,
    durationMs: Math.max(1, (Number(entry?.durationMs) || 0) * scale),
    delayMs: Math.max(0, (Number(entry?.delayMs) || 0) * scale),
  }));

  return {
    entries,
    endMs: entries.reduce((latest, entry) => Math.max(latest, entry.delayMs + entry.durationMs), 0),
    scale,
    finalHoldMs,
  };
}

export const LEGACY_TEMPLATE_TIMING = Object.freeze({
  wordStaggerMs: 65,
  wordDurationMs: 280,
  positionedWordStaggerMs: 220,
  positionedWordDurationMs: 300,
  holdMs: 2800,
  exitMs: 360,
  gapMs: 40,
});

export const LEGACY_WBW_CLASSES = Object.freeze([
  'wrise', 'wslide', 'wslider', 'wroll', 'wwipe', 'wwipeup', 'wfade',
  'wscale', 'wflip', 'wbounce', 'wdiag', 'wexpand', 'wskew', 'wstencil', 'wlift',
]);

export const LEGACY_IMP_ANIMS = Object.freeze({
  'imp-bold': 'drop',
  'imp-gold': 'wipe',
  'imp-rose': 'diagonal-wipe',
  'imp-cyan': 'skew-snap',
  'imp-green': 'pop',
  'imp-purple': 'roll',
  'imp-italic': 'lift',
  'imp-weight': 'stamp',
  'imp-underline': 'wipe-up',
  'imp-box': 'drift',
  'imp-space': 'stencil',
  'imp-flicker': 'flicker',
  'imp-typewrite': 'typewrite',
  'imp-stamp': 'stamp',
});

export const ADVANCED_IMP_ENTRANCES = Object.freeze({
  'imp-gold': 'opposite-slide',
  'imp-rose': 'wipe',
  'imp-cyan': 'opposite',
  'imp-purple': 'roll',
  'imp-orange': 'opposite-slide',
  'imp-underline': 'wipe-up',
  'imp-italic': 'opposite-slide',
  'imp-bold': 'opposite',
  'imp-green': 'opposite-slide',
  'imp-weight': 'roll',
  'imp-space': 'wipe',
  'imp-flicker': 'opposite',
});

// One canonical default accent per advanced template. This is shared by the
// template library, canvas preview, and export so the customization picker does
// not drift from what the template actually renders.
export const ADVANCED_TEMPLATE_EMPHASIS_COLORS = Object.freeze({
  t11: '#D4AF37',
  t12: '#FF3D71',
  t13: '#FFFFFF',
  t14: '#D4AF37',
  t15: '#FF3D71',
  t16: '#FFFFFF',
  t17: '#FF3D71',
  t18: '#D4AF37',
  t19: '#FF3D71',
  t20: '#39FF14',
  t21: '#FFFFFF',
  t22: '#DDAA03',
  t23: '#D4AF37',
  t24: '#F97316',
  t25: '#FF3D71',
  t26: '#F97316',
  t27: '#FFFFFF',
  t28: '#86DE02',
  t29: '#F97316',
  t30: '#FFFFFF',
  t31: '#D4AF37',
  t32: '#00E5FF',
  t33: '#EE17DC',
  t34: '#15F5F9',
  t35: '#FFFFFF',
  t36: '#DDAA03',
  t37: '#FFFFFF',
  t38: '#D4AF37',
  t39: '#FF3D71',
  t40: '#F2072B',
  t41: '#FFF1D0',
  t42: '#FFE45C',
  t43: '#FFB21A',
  t44: '#FF375F',
  t45: '#FFD23F',
  t46: '#FFFFFF',
  t47: '#FF2E93',
  t48: '#FFF6E5',
  t49: '#3DF2B0',
  t50: '#7EE787',
  t51: '#F4C430',
  t52: '#C1121F',
});

// T41–T52 are keyframe-driven: every phase (styled or word-by-word) animates
// only through CSS @keyframes authored in lekha-captions-T11-T35.html, keyed on
// `.active` and per-word `--lekha-word-step` / `--lekha-word-rest` variables.
// No renderer drives their words with JS frames. Instead every renderer pauses
// the block's CSS animations and seeks them with seekKeyframeTemplateAnimations,
// so the gallery, the editor canvas and the export share one motion source.
export const KEYFRAME_ADVANCED_TEMPLATE_IDS = Object.freeze([
  't41', 't42', 't43', 't44', 't45', 't46',
  't47', 't48', 't49', 't50', 't51', 't52',
]);

export function isKeyframeAdvancedTemplateId(templateId) {
  return KEYFRAME_ADVANCED_TEMPLATE_IDS.includes(String(templateId || '').trim());
}

// Upper bounds of each template's authored schedule (across all its phases):
// first word delay, per-word stagger, longest single-word animation and the
// longest block-level tail (keyword finale, strip feed, decoy rewrite...). Only
// export frame sampling uses these; playback timing is read from the DOM.
// check-template-visual-parity.mjs verifies the DOM never outlasts them.
export const KEYFRAME_TEMPLATE_MOTION = Object.freeze({
  t41: { leadMs: 320, stepMs: 190, wordMs: 620, tailMs: 260, loop: false },
  t42: { leadMs: 120, stepMs: 170, wordMs: 420, tailMs: 1100, loop: false },
  t43: { leadMs: 80, stepMs: 200, wordMs: 760, tailMs: 120, loop: false },
  t44: { leadMs: 420, stepMs: 120, wordMs: 420, tailMs: 900, loop: false },
  t45: { leadMs: 120, stepMs: 210, wordMs: 620, tailMs: 760, loop: false },
  t46: { leadMs: 520, stepMs: 150, wordMs: 480, tailMs: 1100, loop: false },
  t47: { leadMs: 80, stepMs: 160, wordMs: 340, tailMs: 1000, loop: false },
  t48: { leadMs: 80, stepMs: 190, wordMs: 680, tailMs: 420, loop: false },
  t49: { leadMs: 60, stepMs: 130, wordMs: 520, tailMs: 600, loop: true },
  t50: { leadMs: 80, stepMs: 160, wordMs: 300, tailMs: 1500, loop: false },
  t51: { leadMs: 80, stepMs: 170, wordMs: 620, tailMs: 760, loop: false },
  t52: { leadMs: 120, stepMs: 170, wordMs: 300, tailMs: 1100, loop: false },
});

// Fonts (with the exact weights Google serves) authored inside each keyframe
// template. The editor canvas loads them with loadGoogleFont; the gallery imports them in the authored stylesheet and
// export collects every authored font-family automatically.
export const KEYFRAME_TEMPLATE_FONTS = Object.freeze({
  t41: [['Old Standard TT', [400, 700]]],
  t42: [['Barlow Condensed', [600, 700]]],
  t43: [['Martian Mono', [500, 600, 700]]],
  t44: [['Onest', [500, 600, 700]]],
  t45: [['Public Sans', [600, 700, 900]]],
  t46: [['Jura', [500, 600, 700]], ['Azeret Mono', [500]]],
  t47: [['Lilita One', [400]]],
  t48: [['Rozha One', [400]], ['Bowlby One', [400]], ['Courier Prime', [400, 700]]],
  t49: [['Bricolage Grotesque', [600, 700]]],
  t50: [['JetBrains Mono', [500, 700]]],
  t51: [['Big Shoulders Display', [700, 800]]],
  t52: [['Ubuntu Mono', [400, 700]]],
});

export function getKeyframeTemplateMotionWindowMs(templateId, wordCount = 1) {
  const motion = KEYFRAME_TEMPLATE_MOTION[String(templateId || '').trim()];
  if (!motion) return 0;
  if (motion.loop) return Number.POSITIVE_INFINITY;
  const words = Math.max(1, Math.min(16, Number(wordCount) || 1));
  return motion.leadMs + ((words - 1) * motion.stepMs) + motion.wordMs + motion.tailMs;
}

// Same compression contract as getAdvancedPlaybackElapsedMs: a long authored
// schedule is sped up so it finishes within 82% of a short caption, while the
// keyframes, easing and relative stagger stay exactly as authored.
export function getKeyframeTemplatePlaybackMs(naturalEndMs = 0, captionDurationMs = 0, rawElapsedMs = 0) {
  const naturalMs = Math.max(0, Number(naturalEndMs) || 0);
  const elapsedMs = Math.max(0, Number(rawElapsedMs) || 0);
  if (!naturalMs) return elapsedMs;
  const durationMs = Math.max(0, Number(captionDurationMs) || 0);
  const targetMs = durationMs > 0
    ? Math.max(220, Math.min(naturalMs, durationMs * 0.82))
    : naturalMs;
  return Math.min(naturalMs, elapsedMs * (naturalMs / targetMs));
}

// Pause and seek every CSS animation inside a keyframe-template block. Kept
// free of module references other than getKeyframeTemplatePlaybackMs so the
// export page can inline both functions with Function#toString.
// settled=true resolves the fully visible final frame (paused editor state):
// finite animations jump to their end, looping ones rest on their first frame.
export function seekKeyframeTemplateAnimations(block, { elapsedMs = 0, captionDurationMs = 0, settled = false } = {}) {
  if (!block || typeof block.getAnimations !== 'function') return 0;
  let naturalEndMs = 0;
  const entries = block.getAnimations({ subtree: true }).map((animation) => {
    const effect = animation.effect;
    const computed = effect && typeof effect.getComputedTiming === 'function' ? effect.getComputedTiming() : {};
    const timing = effect && typeof effect.getTiming === 'function' ? effect.getTiming() : {};
    const delayMs = Math.max(0, Number(timing.delay) || 0);
    const looping = !Number.isFinite(Number(computed.iterations));
    const endMs = looping
      ? delayMs
      : (Number.isFinite(Number(computed.endTime))
        ? Number(computed.endTime)
        : delayMs + (Number(computed.duration) || 0));
    if (!looping) naturalEndMs = Math.max(naturalEndMs, endMs);
    return { animation, looping, endMs };
  });
  const playbackMs = getKeyframeTemplatePlaybackMs(naturalEndMs, captionDurationMs, elapsedMs);
  const rawElapsedMs = Math.max(0, Number(elapsedMs) || 0);
  entries.forEach(({ animation, looping, endMs }) => {
    try {
      animation.pause();
      // Land 1ms past a finished animation: seeking to exactly endTime can
      // round to just before it, where steps() easing still shows a mid step.
      animation.currentTime = looping
        ? (settled ? endMs : rawElapsedMs)
        : (settled || playbackMs >= endMs ? endMs + 1 : playbackMs);
    } catch {
      // A detached pseudo-element animation can refuse seeking; skip it.
    }
  });
  // Never add the legacy `.in` word class here: renderer rules such as
  // `.active .wbw-seq .w.in` would replace the authored keyframes.
  return naturalEndMs;
}

export const RECREATED_ADVANCED_TEMPLATE_IDS = Object.freeze([
  't11', // Spiritual Awakening
  't13', // Startup Hustle
  't16', // Motivation Stack
  't17', // Horror / Tension
  't18', // Cinematic Chapter
  't24', // Philosophical Twist
  't25', // Love Letter
  't26', // Street / Raw
  't29', // Battle Cry
  't31', // Newspaper Headline
  't33', // Documentary
  't34', // Anime Energy
  't40', // Still Frames
]);

// The authored HTML contains four styled phases whose labels and markup are
// correct but whose CSS selectors are missing or point at an older phase ID.
// Keep the repair shared by gallery previews, the editor, and export.
export const ADVANCED_TEMPLATE_RUNTIME_CSS = `
  .t17-b1 .snap-txt {
    display: inline-block;
    opacity: 0;
    filter: blur(3px);
    letter-spacing: 0.42em;
    transform: scaleX(1.12);
  }
  .t17-b1.active .snap-txt {
    animation: lekhaLetterSnapIn 0.44s cubic-bezier(0.22,1,0.36,1) forwards;
  }
  @keyframes lekhaLetterSnapIn {
    from {
      opacity: 0;
      filter: blur(3px);
      letter-spacing: 0.42em;
      transform: scaleX(1.12);
    }
    to {
      opacity: 1;
      filter: blur(0);
      letter-spacing: 0.04em;
      transform: scaleX(1);
    }
  }

  .t23-b3 .punch-txt {
    font-family: 'Rubik', sans-serif;
    font-weight: 900;
    font-size: 1.3rem;
    color: var(--gold);
    opacity: 0;
    transform: scale(0.5) rotate(-3deg);
  }
  .t23-b3.active .punch-txt {
    animation: punchPop 0.4s cubic-bezier(0.34,1.7,0.64,1) 0.2s forwards;
  }

  .t23-b3 .punch-txt .imp-bold,
  .t23-b3 .punch-txt .imp-gold,
  .t23-b3 .punch-txt .is-emphasis {
    color: #ffffff !important;
    -webkit-text-fill-color: #ffffff !important;
    text-shadow: 0 1px 8px rgba(0,0,0,0.55), 0 0 12px rgba(255,255,255,0.36);
  }

  .t24-stage .wbw-rise,
  .t24-stage .wbw-slide,
  .t24-stage .wbw-seq-fade {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: center;
    column-gap: 0.28em;
    row-gap: 0.12em;
    max-width: min(100%, 9.8em);
    white-space: normal;
    overflow-wrap: normal;
    word-break: normal;
    text-align: center;
  }

  .t25-stage .hand-txt,
  .t25-stage .soft-rise,
  .t25-stage .wbw-rise,
  .t25-stage .wbw-slide {
    max-width: min(100%, 13em);
    white-space: normal;
    overflow-wrap: normal;
    word-break: normal;
    text-align: center;
  }

  .t25-stage .wbw-rise,
  .t25-stage .wbw-slide {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: center;
    column-gap: 0.28em;
    row-gap: 0.12em;
  }

  .t25-stage .w {
    margin-right: 0;
  }

  .t25-stage .imp-italic,
  .t25-stage .imp-rose,
  .t25-stage .w[data-imp='true'],
  .t25-stage .is-emphasis {
    color: var(--template-highlight, var(--template-secondary, var(--rose, #ff3d71))) !important;
    -webkit-text-fill-color: var(--template-highlight, var(--template-secondary, var(--rose, #ff3d71))) !important;
  }

  .t31-b4,
  .t32-b1,
  .t33-b4 {
    perspective: 600px;
  }

  .t29-stage .active .wbw-rise .w.in,
  .t29-stage .active .wbw-slide .w.in {
    animation: lekhaTemplateWbwIn 360ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
    animation-delay: var(--wbw-delay, 0ms);
  }

  .t29-stage .active .wbw-rise .w[data-imp='true'].in,
  .t29-stage .active .wbw-slide .w[data-imp='true'].in {
    animation-duration: 420ms;
  }

  .t31-b4 .flip-line,
  .t32-b1 .flip-line,
  .t33-b4 .flip-line {
    display: block;
    transform: rotateX(-90deg);
    transform-origin: center bottom;
    opacity: 0;
  }
  .t31-b4.active .flip-line,
  .t32-b1.active .flip-line,
  .t33-b4.active .flip-line {
    animation: flipIn 0.5s cubic-bezier(0.34,1.2,0.64,1) forwards;
  }
`;

export const ORIGINAL_TEMPLATE_BLOCKS = Object.freeze({
  t11: [
    { type: 'wbw-seq-fade', label: 'WBW SEQ FADE' },
    { type: 'styled', label: 'BLUR FOCUS' },
    { type: 'wbw-rise', label: 'RECREATED RISE' },
    { type: 'wbw-rise', label: 'WBW RISE' },
  ],
  t12: [
    { type: 'wbw-seq-fade', label: 'WBW SEQ FADE' },
    { type: 'styled', label: 'SLIDE-UP' },
    { type: 'wbw-rise', label: 'WBW RISE' },
    { type: 'wbw-slide', label: 'WBW SLIDE' },
  ],
  t13: [
    { type: 'wbw-rise', label: 'RECREATED STARTUP RISE' },
    { type: 'wbw-slide', label: 'RECREATED STARTUP SLIDE' },
    { type: 'wbw-rise', label: 'WBW RISE' },
    { type: 'wbw-seq-fade', label: 'WBW SEQ FADE' },
  ],
  t14: [
    { type: 'styled', label: '3D FLIP' },
    { type: 'styled', label: 'DROP BOUNCE' },
    { type: 'plain', label: 'PLAIN' },
    { type: 'wbw-rise', label: 'WBW RISE' },
  ],
  t15: [
    { type: 'styled', label: 'SURGE IN' },
    { type: 'styled', label: 'CENTER POP' },
    { type: 'wbw-rise', label: 'WBW RISE' },
    { type: 'wbw-seq-fade', label: 'WBW SEQ FADE' },
  ],
  t16: [
    { type: 'wbw-rise', label: 'STACK LIFT' },
    { type: 'wbw-rise', label: 'NEON SNAP' },
    { type: 'wbw-rise', label: 'DIAGONAL LIFT' },
    { type: 'wbw-slide', label: 'SIDE IMPACT' },
  ],
  t17: [
    { type: 'wbw-seq-fade', label: 'RECREATED HORROR FADE' },
    { type: 'wbw-rise', label: 'RECREATED HORROR RISE' },
    { type: 'wbw-slide', label: 'RECREATED HORROR SLIDE' },
    { type: 'wbw-rise', label: 'WBW RISE' },
  ],
  t18: [
    { type: 'styled', label: 'SPLIT TITLE' },
    { type: 'styled', label: 'FADE REVEAL' },
    { type: 'wbw-rise', label: 'RECREATED RISE' },
    { type: 'wbw-rise', label: 'WBW RISE' },
  ],
  t19: [
    { type: 'styled', label: 'SLASH WIPE' },
    { type: 'styled', label: 'RISE UP' },
    { type: 'wbw-rise', label: 'WBW RISE' },
    { type: 'wbw-seq-fade', label: 'WBW SEQ FADE' },
  ],
  t20: [
    { type: 'styled', label: 'NEON DROP' },
    { type: 'styled', label: 'IMPACT SETTLE' },
    { type: 'wbw-rise', label: 'WBW RISE' },
    { type: 'wbw-seq-fade', label: 'WBW SEQ FADE' },
  ],
  t21: [
    { type: 'styled', label: 'EDITORIAL WORD REVEAL' },
    { type: 'wbw-seq-fade', label: 'WBW SEQ FADE' },
    { type: 'wbw-rise', label: 'WBW RISE' },
    { type: 'wbw-slide', label: 'WBW SLIDE' },
  ],
  t22: [
    { type: 'karaoke', label: 'KARAOKE' },
    { type: 'styled', label: 'WAVE IN' },
    { type: 'wbw-rise', label: 'WBW RISE' },
    { type: 'wbw-seq-fade', label: 'WBW SEQ FADE' },
  ],
  t23: [
    { type: 'styled', label: 'SLIDE-RIGHT' },
    { type: 'plain', label: 'PLAIN' },
    { type: 'plain', label: 'PLAIN' },
    { type: 'styled', label: 'PUNCH POP' },
  ],
  t24: [
    { type: 'wbw-rise', label: 'SOFT WIPE' },
    { type: 'wbw-rise', label: 'THOUGHT DRIFT' },
    { type: 'wbw-slide', label: 'MAP SLIDE' },
    { type: 'wbw-rise', label: 'MEMORY STAMP' },
    { type: 'wbw-rise', label: 'INNER REVEAL' },
  ],
  t25: [
    { type: 'styled', label: 'HANDWRITE' },
    { type: 'styled', label: 'SOFT RISE' },
    { type: 'wbw-rise', label: 'WBW RISE' },
    { type: 'wbw-slide', label: 'WBW SLIDE' },
  ],
  t26: [
    { type: 'wbw-rise', label: 'RAW SHUTTER' },
    { type: 'wbw-slide', label: 'STREET SNAP' },
    { type: 'wbw-rise', label: 'CONCRETE KICK' },
    { type: 'wbw-seq-fade', label: 'TAG FADE' },
  ],
  t27: [
    { type: 'styled', label: 'CENTER EXPAND' },
    { type: 'plain', label: 'PLAIN' },
    { type: 'plain', label: 'PLAIN' },
    { type: 'wbw-rise', label: 'WBW RISE' },
  ],
  t28: [
    { type: 'styled', label: 'GRAIN BLUR' },
    { type: 'styled', label: 'SLOW FADE' },
    { type: 'wbw-rise', label: 'WBW RISE' },
    { type: 'wbw-seq-fade', label: 'WBW SEQ FADE' },
  ],
  t29: [
    { type: 'wbw-rise', label: 'SHUTTER PUNCH' },
    { type: 'wbw-rise', label: 'RECOIL LIFT' },
    { type: 'wbw-slide', label: 'DIAGONAL CHARGE' },
    { type: 'wbw-seq-fade', label: 'CLAMP SNAP' },
  ],
  t30: [
    { type: 'styled', label: 'BREATHE' },
    { type: 'plain', label: 'PLAIN' },
    { type: 'plain', label: 'PLAIN' },
    { type: 'plain', label: 'PLAIN' },
  ],
  t31: [
    { type: 'wbw-seq-fade', label: 'RECREATED HEADLINE TYPE' },
    { type: 'wbw-seq-fade', label: 'WBW SEQ FADE' },
    { type: 'wbw-rise', label: 'RECREATED RISE' },
    { type: 'wbw-rise', label: 'WBW RISE' },
    { type: 'styled', label: '3D FLIP' },
  ],
  t32: [
    { type: 'styled', label: 'INK WIPE' },
    { type: 'styled', label: '3D FLIP' },
    { type: 'plain', label: 'PLAIN' },
    { type: 'wbw-rise', label: 'WBW RISE' },
    { type: 'wbw-seq-fade', label: 'WBW SEQ FADE' },
  ],
  t33: [
    { type: 'styled', label: 'DOC WIPE' },
    { type: 'wbw-seq-fade', label: 'WBW SEQ FADE' },
    { type: 'karaoke', label: 'KARAOKE' },
    { type: 'wbw-rise', label: 'WBW RISE' },
    { type: 'styled', label: '3D FLIP' },
  ],
  t34: [
    { type: 'wbw-seq-fade', label: 'WBW SEQ FADE' },
    { type: 'styled', label: 'POW POP' },
    { type: 'wbw-rise', label: 'WBW RISE' },
    { type: 'wbw-slide', label: 'WBW SLIDE' },
  ],
  t35: [
    { type: 'styled', label: 'SECRET REVEAL' },
    { type: 'plain', label: 'PLAIN' },
    { type: 'plain', label: 'PLAIN' },
    { type: 'plain', label: 'PLAIN' },
  ],
  t36: [
    { type: 'karaoke', label: 'KARAOKE' },
    { type: 'karaoke', label: 'KARAOKE' },
    { type: 'karaoke', label: 'KARAOKE' },
  ],
  t37: [
    { type: 'styled', label: 'NEON PULSE' },
    { type: 'wbw-rise', label: 'WBW RISE' },
    { type: 'styled', label: 'NEON EXPAND' },
    { type: 'wbw-seq', label: 'WBW SEQ' },
  ],
  t38: [
    { type: 'plain', label: 'PLAIN' },
    { type: 'wbw-slide', label: 'WBW SLIDE' },
    { type: 'wbw-rise', label: 'WBW RISE' },
    { type: 'wbw-seq-fade', label: 'WBW SEQ FADE' },
  ],
  t39: [
    { type: 'wbw-seq-fade', label: 'WBW SEQ FADE' },
    { type: 'wbw-seq-fade', label: 'WBW SEQ FADE' },
    { type: 'wbw-seq-fade', label: 'WBW SEQ FADE' },
    { type: 'wbw-seq-fade', label: 'WBW SEQ FADE' },
  ],
  t40: [
    { type: 'styled', label: 'STYLED' },
    { type: 'styled', label: 'STYLED' },
    { type: 'plain', label: 'PLAIN' },
    { type: 'styled', label: 'STYLED' },
  ],
  t41: [
    { type: 'styled', label: 'FRIDGE SNAP' },
    { type: 'wbw-rise', label: 'TILE BY TILE' },
    { type: 'styled', label: 'KEY TILE FIRST' },
    { type: 'wbw-seq-fade', label: 'SLOW MAGNETS' },
    { type: 'wbw-slide', label: 'SLIDE AND STICK' },
  ],
  t42: [
    { type: 'styled', label: 'TAPE FEED' },
    { type: 'wbw-slide', label: 'CLICK BY CLICK' },
    { type: 'wbw-rise', label: 'PUNCH ROW' },
    { type: 'wbw-seq-fade', label: 'RIBBON CLICKS' },
  ],
  t43: [
    { type: 'styled', label: 'DEPARTURES' },
    { type: 'wbw-rise', label: 'GATE CHANGE' },
    { type: 'wbw-seq-fade', label: 'FINAL CALL' },
    { type: 'wbw-slide', label: 'NOW BOARDING' },
  ],
  t44: [
    { type: 'styled', label: 'THEY TYPED' },
    { type: 'wbw-rise', label: 'I REPLIED' },
    { type: 'wbw-seq-fade', label: 'THEY SENT' },
    { type: 'wbw-slide', label: 'I REACTED' },
  ],
  t45: [
    { type: 'styled', label: 'ROUTE DRAW' },
    { type: 'wbw-rise', label: 'NEXT STOP' },
    { type: 'styled', label: 'EXPRESS RUN' },
    { type: 'wbw-seq-fade', label: 'LOCAL SERVICE' },
    { type: 'styled', label: 'INTERCHANGE' },
    { type: 'wbw-slide', label: 'LAST TRAIN' },
  ],
  t46: [
    { type: 'styled', label: 'PLOT SHEET' },
    { type: 'wbw-rise', label: 'DRAFT LINES' },
    { type: 'wbw-seq-fade', label: 'MEASURE' },
    { type: 'wbw-slide', label: 'ANNOTATE' },
  ],
  t47: [
    { type: 'styled', label: 'SLAP' },
    { type: 'wbw-rise', label: 'PEEL ON' },
    { type: 'styled', label: 'BACKHAND SLAP' },
    { type: 'wbw-seq-fade', label: 'STICKER DROP' },
    { type: 'wbw-slide', label: 'SIDE SLAP' },
  ],
  t48: [
    { type: 'styled', label: 'CUT AND PASTE' },
    { type: 'wbw-rise', label: 'SCRAP DROP' },
    { type: 'wbw-seq-fade', label: 'NOTE BUILD' },
    { type: 'wbw-slide', label: 'GLUE STRIP' },
  ],
  t49: [
    { type: 'styled', label: 'SOUNDCHECK' },
    { type: 'wbw-rise', label: 'LEVEL UP' },
    { type: 'styled', label: 'BASS SPIKE' },
    { type: 'wbw-seq-fade', label: 'SLOW JAM' },
    { type: 'wbw-slide', label: 'CROSSFADE' },
  ],
  t50: [
    { type: 'styled', label: 'TRACK CHANGES' },
    { type: 'wbw-rise', label: 'LIVE EDIT' },
    { type: 'wbw-seq-fade', label: 'AUTOCORRECT' },
    { type: 'wbw-slide', label: 'FINAL DRAFT' },
  ],
  t51: [
    { type: 'styled', label: 'CHAIN REACTION' },
    { type: 'wbw-rise', label: 'KNOCK ON' },
    { type: 'styled', label: 'REVERSE RUN' },
    { type: 'wbw-seq-fade', label: 'SLOW TOPPLE' },
    { type: 'wbw-slide', label: 'LAST PIECE' },
  ],
  t52: [
    { type: 'styled', label: 'TILL RECEIPT' },
    { type: 'wbw-rise', label: 'LINE ITEMS' },
    { type: 'styled', label: 'PRINT HEAD' },
    { type: 'wbw-seq-fade', label: 'TALLY' },
    { type: 'styled', label: 'TEAR OFF' },
    { type: 'wbw-slide', label: 'CHANGE DUE' },
  ],
});

export const ORIGINAL_TEMPLATE_BLOCK_TYPES = Object.freeze(
  Object.fromEntries(
    Object.entries(ORIGINAL_TEMPLATE_BLOCKS).map(([templateId, blocks]) => [
      templateId,
      Object.freeze(blocks.map((block) => block.type)),
    ]),
  ),
);

export function normalizeTemplatePhaseIndex(templateId, blockIndex = 0) {
  const blocks = ORIGINAL_TEMPLATE_BLOCK_TYPES[templateId] || ['styled'];
  return ((Number(blockIndex) % blocks.length) + blocks.length) % blocks.length;
}

export function getOriginalTemplateBlockType(templateId, blockIndex = 0) {
  const blocks = ORIGINAL_TEMPLATE_BLOCK_TYPES[templateId] || ['styled'];
  return blocks[normalizeTemplatePhaseIndex(templateId, blockIndex)] || 'styled';
}

export function isAdvancedWbwBlockType(blockType = '') {
  return String(blockType).startsWith('wbw-');
}

export function isAdvancedSequentialBlockType(blockType = '') {
  return ['wbw-seq', 'wbw-seq-fade', 'wbw-seq-flip'].includes(String(blockType));
}

export function getAdvancedAnimationWindowMs(blockType, wordCount = 1, templateId = '') {
  if (isKeyframeAdvancedTemplateId(templateId)) {
    return getKeyframeTemplateMotionWindowMs(templateId, wordCount);
  }
  if (blockType === 'plain') return 0;
  if (blockType === 'karaoke') return ADVANCED_TEMPLATE_TIMING.holdMs;
  if (isAdvancedWbwBlockType(blockType)) {
    const sequential = isAdvancedSequentialBlockType(blockType);
    const stagger = sequential
      ? ADVANCED_TEMPLATE_TIMING.sequentialStaggerMs
      : ADVANCED_TEMPLATE_TIMING.wordStaggerMs;
    const duration = sequential
      ? ADVANCED_TEMPLATE_TIMING.sequentialDurationMs
      : ADVANCED_TEMPLATE_TIMING.emphasisDurationMs;
    return (Math.max(0, Number(wordCount) - 1) * stagger) + duration;
  }
  return ADVANCED_TEMPLATE_TIMING.styledDurationMs;
}

export function getAdvancedPlaybackElapsedMs(
  blockType,
  wordCount = 1,
  captionDurationMs = 0,
  rawElapsedMs = 0,
) {
  const naturalWindowMs = getAdvancedAnimationWindowMs(blockType, wordCount);
  if (!naturalWindowMs) return 0;

  const durationMs = Math.max(0, Number(captionDurationMs) || 0);
  const targetWindowMs = durationMs > 0
    ? Math.max(220, Math.min(naturalWindowMs, durationMs * 0.78))
    : naturalWindowMs;
  const elapsedMs = Math.max(0, Number(rawElapsedMs) || 0);

  return Math.min(naturalWindowMs, elapsedMs * (naturalWindowMs / targetWindowMs));
}
