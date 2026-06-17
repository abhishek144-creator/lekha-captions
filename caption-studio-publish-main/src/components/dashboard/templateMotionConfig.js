export const ADVANCED_TEMPLATE_TIMING = Object.freeze({
  holdMs: 2700,
  enterMs: 280,
  exitMs: 360,
  gapMs: 38,
  wordStaggerMs: 65,
  wordDurationMs: 280,
  emphasisDelayMs: 120,
  emphasisDurationMs: 440,
  sequentialStaggerMs: 380,
  sequentialDurationMs: 220,
  styledDurationMs: 1350,
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

  .t31-b4,
  .t32-b1,
  .t33-b4 {
    perspective: 600px;
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
    { type: 'plain', label: 'PLAIN' },
    { type: 'wbw-rise', label: 'WBW RISE' },
  ],
  t12: [
    { type: 'wbw-seq-fade', label: 'WBW SEQ FADE' },
    { type: 'styled', label: 'SLIDE-UP' },
    { type: 'wbw-rise', label: 'WBW RISE' },
    { type: 'wbw-slide', label: 'WBW SLIDE' },
  ],
  t13: [
    { type: 'styled', label: 'STAMP IN' },
    { type: 'styled', label: 'TICKER ROLL' },
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
    { type: 'styled', label: 'SHAKE-IN' },
    { type: 'styled', label: 'CENTER POP' },
    { type: 'wbw-rise', label: 'WBW RISE' },
    { type: 'wbw-seq-fade', label: 'WBW SEQ FADE' },
  ],
  t16: [
    { type: 'wbw-rise', label: 'WBW RISE' },
    { type: 'styled', label: 'NEON FLICKER' },
    { type: 'wbw-rise', label: 'WBW RISE' },
    { type: 'wbw-slide', label: 'WBW SLIDE' },
  ],
  t17: [
    { type: 'styled', label: 'GLITCH' },
    { type: 'styled', label: 'LETTER SNAP' },
    { type: 'plain', label: 'PLAIN' },
    { type: 'wbw-rise', label: 'WBW RISE' },
  ],
  t18: [
    { type: 'styled', label: 'SPLIT TITLE' },
    { type: 'styled', label: 'FADE REVEAL' },
    { type: 'plain', label: 'PLAIN' },
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
    { type: 'wbw-rise', label: 'WBW RISE' },
    { type: 'styled', label: 'SLOW RISE' },
    { type: 'plain', label: 'PLAIN' },
    { type: 'wbw-rise', label: 'WBW RISE' },
    { type: 'karaoke', label: 'KARAOKE' },
  ],
  t25: [
    { type: 'styled', label: 'HANDWRITE' },
    { type: 'styled', label: 'SOFT RISE' },
    { type: 'wbw-rise', label: 'WBW RISE' },
    { type: 'wbw-slide', label: 'WBW SLIDE' },
  ],
  t26: [
    { type: 'styled', label: 'HARD CUT' },
    { type: 'styled', label: 'FAST SLIDE' },
    { type: 'wbw-rise', label: 'WBW RISE' },
    { type: 'wbw-seq-fade', label: 'WBW SEQ FADE' },
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
    { type: 'styled', label: 'SLAM' },
    { type: 'styled', label: 'HARD RISE' },
    { type: 'wbw-rise', label: 'WBW RISE' },
    { type: 'styled', label: 'SLIDE' },
  ],
  t30: [
    { type: 'styled', label: 'BREATHE' },
    { type: 'plain', label: 'PLAIN' },
    { type: 'plain', label: 'PLAIN' },
    { type: 'plain', label: 'PLAIN' },
  ],
  t31: [
    { type: 'styled', label: 'TYPEWRITER' },
    { type: 'wbw-seq-fade', label: 'WBW SEQ FADE' },
    { type: 'plain', label: 'PLAIN' },
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
