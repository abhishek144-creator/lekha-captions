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
});

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
    { type: 'styled', label: 'VERT REVEAL' },
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

export function getAdvancedAnimationWindowMs(blockType, wordCount = 1) {
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
