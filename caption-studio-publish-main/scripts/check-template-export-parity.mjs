import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';
import {
  ORIGINAL_TEMPLATE_BLOCKS,
  RECREATED_ADVANCED_TEMPLATE_IDS,
} from '../src/components/dashboard/templateMotionConfig.js';
import {
  findAppliedBasicTemplateMarkup,
  countAppliedBasicTemplatePhasesFromMarkup,
} from '../src/components/dashboard/basicTemplateInline.js';

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rendererPath = path.join(projectRoot, 'scripts', 'render_template_overlay.mjs');
const cliScope = process.argv.find((arg) => arg.startsWith('--scope='))?.split('=')[1] || '';
const legacySidebarHtml = await fs.readFile(
  path.join(projectRoot, 'src', 'assets', 'lekha-captions-20-templates.html'),
  'utf8',
);
const newSidebarHtml = await fs.readFile(
  path.join(projectRoot, 'src', 'assets', 'lekha-captions-49-templates.html'),
  'utf8',
);
const rightTemplateHtml = await fs.readFile(
  path.join(projectRoot, 'src', 'assets', 'lekha-captions-T11-T35.html'),
  'utf8',
);

const TEMPLATE_STYLES = {
  t13: {
    template_name: 'Startup Hustle',
    font_family: 'IBM Plex Mono',
    font_size: 23,
    font_weight: '700',
    text_color: '#F97316',
    secondary_color: '#FFFFFF',
    highlight_color: '#FFFFFF',
    text_case: 'uppercase',
  },
  t14: {
    template_name: 'Literary Weight',
    font_family: 'Libre Baskerville',
    font_size: 23,
    font_weight: '700',
    text_color: '#E8E0D0',
    secondary_color: '#D4AF37',
    highlight_color: '#D4AF37',
  },
  t16: {
    template_name: 'Motivation Stack',
    font_family: 'Unbounded',
    font_size: 22,
    font_weight: '900',
    text_color: '#FFFFFF',
    secondary_color: '#00E5FF',
    highlight_color: '#00E5FF',
    text_case: 'uppercase',
  },
  t18: {
    template_name: 'Cinematic Chapter',
    font_family: 'Cinzel',
    font_size: 23,
    font_weight: '700',
    text_color: '#FFFFFF',
    secondary_color: '#D4AF37',
    highlight_color: '#D4AF37',
  },
};

const DEFAULT_ADVANCED_STYLE = {
  template_name: 'Advanced Template',
  font_family: 'Inter',
  font_size: 23,
  font_weight: '700',
  text_color: '#FFFFFF',
  secondary_color: '#DDAA03',
  highlight_color: '#DDAA03',
};

const ADVANCED_STYLE_OVERRIDES = {
  t11: { template_name: 'Spiritual Awakening', font_family: 'Cormorant Garamond', text_color: '#E8DFC8', secondary_color: '#D4AF37', highlight_color: '#D4AF37' },
  t12: { template_name: 'Intimate Confession', font_family: 'Lora', font_style: 'italic', text_color: '#E0D9F0', secondary_color: '#A78BFA', highlight_color: '#A78BFA' },
  t13: TEMPLATE_STYLES.t13,
  t14: TEMPLATE_STYLES.t14,
  t15: { template_name: 'Storm Surge', font_family: 'Oswald', font_size: 26, text_color: '#FFFFFF', secondary_color: '#FF3D71', highlight_color: '#FF3D71', text_case: 'uppercase' },
  t16: TEMPLATE_STYLES.t16,
  t17: { template_name: 'Horror / Tension', font_family: 'Space Mono', text_color: '#FFFFFF', secondary_color: '#FFFFFF', highlight_color: '#FFFFFF', text_case: 'uppercase' },
  t18: TEMPLATE_STYLES.t18,
  t19: { template_name: 'Defiance', font_family: 'Archivo Black', font_size: 25, font_weight: '900', text_color: '#FFFFFF', secondary_color: '#FF3D71', highlight_color: '#FF3D71', text_case: 'uppercase' },
  t20: { template_name: 'Impact / Gravity', font_family: 'Dela Gothic One', font_size: 24, font_weight: '900', text_color: '#FFFFFF', secondary_color: '#39FF14', highlight_color: '#39FF14', text_case: 'uppercase' },
  t21: { template_name: 'Fashion Editorial', font_family: 'Josefin Sans', font_size: 24, text_color: '#FFFFFF', secondary_color: '#FFFFFF', highlight_color: '#FFFFFF', text_case: 'uppercase' },
  t22: { template_name: 'Music / Lyrical', font_family: 'DM Serif Display', font_size: 24, text_color: '#FFFFFF', secondary_color: '#DDAA03', highlight_color: '#DDAA03' },
  t23: { template_name: 'Comedy Punchline', font_family: 'Rubik', font_size: 24, text_color: '#F0F0E0', secondary_color: '#D4AF37', highlight_color: '#D4AF37' },
  t24: { template_name: 'Philosophical Twist', font_family: 'Spectral', text_color: '#FFFFFF', secondary_color: '#F97316', highlight_color: '#F97316' },
  t25: { template_name: 'Love Letter', font_family: 'Instrument Serif', font_size: 25, font_style: 'italic', text_color: '#FFFFFF', secondary_color: '#FF3D71', highlight_color: '#FF3D71' },
  t26: { template_name: 'Street / Raw', font_family: 'Bungee', font_size: 24, font_weight: '900', text_color: '#FFFFFF', secondary_color: '#F97316', highlight_color: '#F97316', text_case: 'uppercase' },
  t27: { template_name: 'Sci-Fi Futuristic', font_family: 'Exo 2', text_color: '#00E5FF', secondary_color: '#FFFFFF', highlight_color: '#FFFFFF', text_case: 'uppercase' },
  t28: { template_name: 'Nostalgia / Memory', font_family: 'Bitter', text_color: '#D8CBB8', secondary_color: '#86DE02', highlight_color: '#86DE02' },
  t29: { template_name: 'Battle Cry', font_family: 'Teko', font_size: 30, text_color: '#FFFFFF', secondary_color: '#F97316', highlight_color: '#F97316', text_case: 'uppercase' },
  t30: { template_name: 'Meditation / Zen', font_family: 'Cormorant Garamond', font_style: 'italic', text_color: '#B4D2C8', secondary_color: '#FFFFFF', highlight_color: '#FFFFFF' },
  t31: { template_name: 'Newspaper Headline', font_family: 'Playfair Display', font_size: 27, text_color: '#FFFFFF', secondary_color: '#D4AF37', highlight_color: '#D4AF37' },
  t32: { template_name: 'Poetic Verse', font_family: 'Bodoni Moda', font_style: 'italic', text_color: '#D0CEE8', secondary_color: '#A78BFA', highlight_color: '#A78BFA' },
  t33: { template_name: 'Documentary', font_family: 'Noto Sans', text_color: '#FFFFFF', secondary_color: '#EE17DC', highlight_color: '#EE17DC' },
  t34: { template_name: 'Anime Energy', font_family: 'Syne', font_size: 24, font_weight: '800', text_color: '#FFFFFF', secondary_color: '#15F5F9', highlight_color: '#15F5F9', text_case: 'uppercase' },
  t35: { template_name: 'Whispered Secret', font_family: 'Crimson Text', font_style: 'italic', text_color: '#DCD2DC', secondary_color: '#FFFFFF', highlight_color: '#FFFFFF' },
  t36: { template_name: 'Karaoke Fill', font_family: 'Inter', text_color: '#FFFFFF', secondary_color: '#DDAA03', highlight_color: '#DDAA03', karaoke_color_1: '#DDAA03', karaoke_color_2: '#22D3EE', karaoke_color_3: '#FB923C' },
  t37: { template_name: 'Neon Pulse', font_family: 'Rajdhani', font_size: 25, text_color: '#E1DA09', secondary_color: '#FFFFFF', highlight_color: '#FFFFFF', text_case: 'uppercase' },
  t38: { template_name: 'Classic Weight', font_family: 'Libre Baskerville', text_color: '#FFFFFF', secondary_color: '#D4AF37', highlight_color: '#D4AF37' },
  t39: { template_name: 'Evidence Board', font_family: 'IBM Plex Mono', font_size: 22, text_color: '#FFFFFF', secondary_color: '#FF3D71', highlight_color: '#FF3D71', text_case: 'uppercase' },
  t40: { template_name: 'Final Whisper', font_family: 'Crimson Text', text_color: '#FFFFFF', secondary_color: '#F2072B', highlight_color: '#F2072B' },
};

const CASES = [
  {
    id: 'spiritual-awakening-size-lock',
    templateId: 't11',
    text: 'Stillness Opens The Door',
    phaseIndex: 1,
    impWordIndex: 2,
    requiredColors: ['white'],
    minBboxHeight: 18,
  },
  {
    id: 'startup-hustle-stamp',
    templateId: 't13',
    text: 'Build Faster Than Yesterday',
    phaseIndex: 0,
    impWordIndex: 1,
    requiredColors: ['orange', 'white'],
  },
  {
    id: 'startup-hustle-wbw-rise',
    templateId: 't13',
    text: 'Scale The Next Idea',
    phaseIndex: 2,
    impWordIndex: 2,
    requiredColors: ['orange', 'white'],
  },
  {
    id: 'startup-hustle-seq-fade',
    templateId: 't13',
    text: 'Momentum Beats Perfect Plans',
    phaseIndex: 3,
    impWordIndex: 1,
    requiredColors: ['orange', 'white'],
  },
  {
    id: 'literary-weight-flip-underline',
    templateId: 't14',
    text: 'Words Carry Real Weight',
    phaseIndex: 0,
    impWordIndex: -1,
    requiredColors: ['gold', 'white'],
  },
  {
    id: 'literary-weight-drop-gold',
    templateId: 't14',
    text: 'The Last Line Matters',
    phaseIndex: 1,
    impWordIndex: 3,
    requiredColors: ['gold', 'white'],
  },
  {
    id: 'literary-weight-devanagari-final-emphasis',
    templateId: 't14',
    text: '\u0906\u091C \u0907\u0902\u0915\u094D\u0932\u0949\u0938\u093F\u092B.',
    phaseIndex: 1,
    impWordIndex: 1,
    requiredColors: ['gold', 'white'],
    minBboxHeight: 20,
    minGoldXOffset: 42,
    style: {
      preview_template_font_px: 20,
      preview_template_box_width_px: 150,
      preview_template_box_height_px: 50,
    },
  },
  {
    id: 'literary-weight-plain-size-lock',
    templateId: 't14',
    text: '\u0906\u0935\u093E\u091C \u0938\u093E\u092B \u0930\u0939\u0947\u0917\u0940.',
    phaseIndex: 2,
    impWordIndex: -1,
    requiredColors: ['white'],
    minBboxHeight: 18,
    style: {
      preview_template_font_px: 20,
      preview_template_box_width_px: 160,
      preview_template_box_height_px: 48,
    },
  },
  {
    id: 'storm-surge-line-structure',
    templateId: 't15',
    text: 'The Storm Is Coming Now',
    phaseIndex: 0,
    impWordIndex: 1,
    // t15's pinned emphasis accent is #FF3D71 (ADVANCED_TEMPLATE_EMPHASIS_COLORS),
    // which the pixel classifier buckets as red. Preview, canvas and export all
    // resolve this same single per-template color via
    // resolveAdvancedTemplateEmphasisColor — the old rotating palette is gone.
    requiredColors: ['red', 'white'],
    expectedLineCount: 2,
    minBboxHeight: 30,
  },
  {
    id: 'horror-tension-glitch-parity',
    templateId: 't17',
    text: 'Something Waits Behind You',
    phaseIndex: 0,
    impWordIndex: 2,
    requiredColors: ['white'],
    // t17 preview and export both enforce a 20px word floor (see the
    // `.t17-stage ... .w.in { font-size: max(..., 20px) }` rule pair in
    // VideoPlayer.jsx and render_template_overlay.mjs). This all-caps Space Mono
    // line has no descenders, so its pixel bbox is the ~14px cap height of that
    // 20px floor. 13 guards the floor without demanding text taller than the
    // canvas preview renders.
    minBboxHeight: 13,
  },
  {
    id: 'horror-tension-snap-bright',
    templateId: 't17',
    text: 'Do Not Look Back',
    phaseIndex: 1,
    impWordIndex: 2,
    requiredColors: ['red'],
    minBboxHeight: 12,
  },
  {
    id: 'motivation-stack-rise',
    templateId: 't16',
    text: 'Keep Moving Every Day',
    phaseIndex: 0,
    impWordIndex: 1,
    // t16 pins cyan body text + white emphasis in BOTH preview and export
    // (`.t16-stage .wbw-rise .w { color: var(--cyan) }` /
    // `.t16-stage .w[data-imp='true'] { color: #fff }` rule pairs in
    // VideoPlayer.jsx and render_template_overlay.mjs).
    requiredColors: ['cyan', 'white'],
  },
  {
    id: 'motivation-stack-neon',
    templateId: 't16',
    text: 'Your Focus Gets Louder',
    phaseIndex: 1,
    impWordIndex: -1,
    requiredColors: ['cyan'],
  },
  {
    id: 'motivation-stack-slide',
    templateId: 't16',
    text: 'Discipline Wins The Day',
    phaseIndex: 3,
    impWordIndex: 1,
    // Same cyan-body/white-emphasis scheme as phase 0 — see motivation-stack-rise.
    requiredColors: ['cyan', 'white'],
  },
  {
    id: 'motivation-stack-devanagari-preview-box',
    templateId: 't16',
    text: '\u092E\u0947\u0930\u0947 \u092A\u0940\u091B\u0947 \u091C\u094B \u0906\u092A \u0936\u093F\u092A \u0926\u0947\u0916.',
    phaseIndex: 0,
    impWordIndex: 1,
    requiredColors: ['cyan', 'white'],
    previewWidth: 314,
    maxBboxHeight: 75,
    // The canvas renders t16 wbw lines nowrap at the measured preview font with
    // NO box-fit scaling, so the export mirrors it at css_scale (360/314):
    // one ~193px preview line becomes ~221px. 240 guards against runaway
    // growth without demanding a box-shrink the canvas never performs.
    maxBboxWidth: 240,
    style: {
      preview_template_font_px: 15.96,
      preview_template_box_width_px: 119,
      preview_template_box_height_px: 58.8,
    },
  },
  {
    id: 'motivation-stack-devanagari-canvas-lines',
    templateId: 't16',
    text: '\u0930\u0939\u0947 \u0939\u094B \u0924\u094B \u0936\u093F\u092A \u0928\u0939\u0940\u0902 \u092A\u0947.',
    phaseIndex: 0,
    impWordIndex: 3,
    requiredColors: ['cyan', 'white'],
    previewWidth: 314,
    maxBboxHeight: 30,
    maxBboxWidth: 230,
    style: {
      preview_template_font_px: 15.96,
      preview_template_box_width_px: 119,
      preview_template_box_height_px: 58.8,
      preview_template_line_texts: [
        '\u0930\u0939\u0947 \u0939\u094B \u0924\u094B \u0936\u093F\u092A \u0928\u0939\u0940\u0902 \u092A\u0947.',
      ],
    },
  },
  {
    id: 'cinematic-chapter-split',
    templateId: 't18',
    text: 'The Weight Of Silence',
    phaseIndex: 0,
    impWordIndex: 3,
    requiredColors: ['gold', 'white'],
    minBboxHeight: 26,
    minGoldYOffset: 8,
  },
  {
    id: 'cinematic-chapter-reveal',
    templateId: 't18',
    text: 'Some Stories Still Echo',
    phaseIndex: 1,
    impWordIndex: 3,
    requiredColors: ['gold', 'white'],
  },
  {
    id: 'cinematic-chapter-wbw-rise',
    templateId: 't18',
    text: 'The Camera Never Lies',
    phaseIndex: 3,
    impWordIndex: 2,
    requiredColors: ['gold', 'white'],
  },
  {
    id: 'music-lyrical-karaoke-parity',
    templateId: 't22',
    text: 'Music Carries Every Memory',
    phaseIndex: 0,
    impWordIndex: 2,
    requiredColors: ['gold'],
    minBboxHeight: 16,
  },
  {
    id: 'philosophical-twist-size-lock',
    templateId: 't24',
    text: 'Truth Arrives After Doubt',
    phaseIndex: 1,
    impWordIndex: 2,
    requiredColors: ['red', 'white'],
    minBboxHeight: 18,
  },
  {
    id: 'love-letter-size-lock',
    templateId: 't25',
    text: 'Every Letter Still Remembers',
    phaseIndex: 1,
    impWordIndex: 2,
    requiredColors: ['red', 'white'],
    minBboxHeight: 18,
  },
  {
    id: 'street-raw-size-lock',
    templateId: 't26',
    text: 'Street Truth Hits Hard',
    phaseIndex: 1,
    impWordIndex: 2,
    requiredColors: ['orange', 'white'],
    minBboxHeight: 18,
  },
  {
    id: 'sci-fi-futuristic-bright-cyan',
    templateId: 't27',
    text: 'Signal Brightens The Future',
    phaseIndex: 1,
    impWordIndex: -1,
    requiredColors: ['cyan'],
    minBboxHeight: 18,
    minColorPixels: { cyan: 180 },
  },
  {
    id: 'battle-cry-size-lock',
    templateId: 't29',
    text: 'Raise The Banner Again',
    phaseIndex: 1,
    impWordIndex: 2,
    requiredColors: ['orange', 'white'],
    // Teko is a condensed face: at the export font (preview font x scale,
    // ~22px here) this all-caps line paints a ~16px bbox — identical to the
    // canvas. 15 guards size regressions without exceeding canvas truth.
    minBboxHeight: 15,
  },
  {
    id: 'newspaper-headline-size-lock',
    templateId: 't31',
    text: 'Headline Breaks Before Dawn',
    phaseIndex: 4,
    impWordIndex: 1,
    requiredColors: ['gold', 'white'],
    // Playfair at the export font (~19px = preview font x scale) paints ~17px
    // including descenders — same as the canvas. 16 guards the floor.
    minBboxHeight: 16,
  },
  {
    id: 'documentary-size-lock',
    templateId: 't33',
    text: 'Documentary Truth Stays Visible',
    phaseIndex: 0,
    impWordIndex: 1,
    // t33's pinned accent is #EE17DC (ADVANCED_TEMPLATE_EMPHASIS_COLORS /
    // secondary_color), which the classifier buckets as magenta. Preview and
    // export resolve the same color; cyan was the old rotating palette.
    requiredColors: ['magenta', 'white'],
    minBboxHeight: 18,
  },
  {
    id: 'anime-energy-size-lock',
    templateId: 't34',
    text: 'Power Rises Again',
    phaseIndex: 1,
    impWordIndex: 1,
    // t34's pinned accent is #15F5F9 (cyan), and this all-caps Syne line at the
    // export font (~17px = preview font x scale) paints a ~13px cap-height
    // bbox — matching the canvas. Orange was the old rotating palette.
    requiredColors: ['cyan', 'white'],
    minBboxHeight: 12,
  },
  {
    id: 'left-legacy-current-cyan',
    sidebar: true,
    template20Id: 'A2',
    templateSource: 'lekha-20',
    text: 'Current Ideas Move Fast',
    phaseIndex: 0,
    impWordIndex: 2,
    requiredColors: ['cyan', 'white'],
    style: {
      template_name: 'The Current',
      font_family: 'Anton',
      font_size: 26,
      font_weight: '400',
      text_color: '#FFFFFF',
      secondary_color: '#00E5FF',
      text_case: 'uppercase',
    },
  },
  {
    id: 'left-legacy-dispatch-rose',
    sidebar: true,
    template20Id: 'A4',
    templateSource: 'lekha-20',
    text: 'The Price Was Always Silence',
    phaseIndex: 2,
    impWordIndex: -1,
    requiredColors: ['red', 'white'],
    style: {
      template_name: 'The Dispatch',
      font_family: 'Inter',
      font_size: 24,
      font_weight: '800',
      text_color: '#FFFFFF',
      secondary_color: '#FF3D71',
    },
  },
  {
    id: 'left-legacy-oracle-rose',
    sidebar: true,
    template20Id: 'A5',
    templateSource: 'lekha-20',
    text: 'Trust The Long Way Home',
    phaseIndex: 3,
    impWordIndex: -1,
    requiredColors: ['red', 'white'],
    style: {
      template_name: 'The Oracle',
      font_family: 'Inter',
      font_size: 24,
      font_weight: '700',
      text_color: '#FFFFFF',
      secondary_color: '#FF3D71',
    },
  },
  {
    id: 'left-legacy-stage-italic',
    sidebar: true,
    template20Id: 'B2',
    templateSource: 'lekha-20',
    text: 'Every Entrance Rewrites The Scene',
    phaseIndex: 1,
    impWordIndex: -1,
    // The app's BRIGHT_YELLOW accent is #DDAA03 (SidebarTemplateGallery20),
    // which the pixel classifier buckets as gold (its yellow bucket needs
    // g >= 185). Export honors the same secondary_color the canvas uses.
    requiredColors: ['gold', 'white'],
    style: {
      template_name: 'The Stage',
      font_family: 'Inter',
      font_size: 24,
      font_weight: '700',
      text_color: '#FFFFFF',
      secondary_color: '#DDAA03',
    },
  },
  {
    id: 'left-legacy-signal-green',
    sidebar: true,
    template20Id: 'B3',
    templateSource: 'lekha-20',
    text: 'Follow The Signal Now',
    phaseIndex: 0,
    impWordIndex: 2,
    requiredColors: ['green', 'white'],
    style: {
      template_name: 'The Signal',
      font_family: 'Oxanium',
      font_size: 23,
      font_weight: '400',
      text_color: '#39FF14',
      secondary_color: '#22FF66',
      text_case: 'uppercase',
    },
  },
  {
    id: 'left-legacy-verdict-underline',
    sidebar: true,
    template20Id: 'B4',
    templateSource: 'lekha-20',
    text: 'The Verdict Was Written Already',
    phaseIndex: 2,
    impWordIndex: -1,
    // #DDAA03 accent buckets as gold — see left-legacy-stage-italic.
    requiredColors: ['gold', 'white'],
    style: {
      template_name: 'The Verdict',
      font_family: 'Inter',
      font_size: 24,
      font_weight: '800',
      text_color: '#FFFFFF',
      secondary_color: '#DDAA03',
    },
  },
  {
    id: 'left-legacy-uprising-green',
    sidebar: true,
    template20Id: 'C1',
    templateSource: 'lekha-20',
    text: 'Rise With The Moment',
    phaseIndex: 0,
    impWordIndex: 1,
    requiredColors: ['green', 'white'],
    style: {
      template_name: 'The Uprising',
      font_family: 'Oswald',
      font_size: 24,
      font_weight: '700',
      text_color: '#FFFFFF',
      secondary_color: '#22FF66',
      text_case: 'uppercase',
    },
  },
  {
    id: 'left-legacy-ember-gold',
    sidebar: true,
    template20Id: 'C3',
    templateSource: 'lekha-20',
    text: 'The Body Remembers What The Mind Forgets',
    phaseIndex: 1,
    impWordIndex: -1,
    requiredColors: ['gold', 'white'],
    style: {
      template_name: 'The Ember',
      font_family: 'Inter',
      font_size: 24,
      font_weight: '700',
      text_color: '#FFFFFF',
      secondary_color: '#D4AF37',
    },
  },
  {
    id: 'left-new-drop-cyan',
    sidebar: true,
    template20Id: 'T02',
    templateSource: 'lekha-49',
    text: 'Drop The Bright Signal',
    phaseIndex: 0,
    impWordIndex: 3,
    requiredColors: ['cyan', 'white'],
    style: {
      template_name: 'The Drop',
      font_family: 'Inter',
      font_size: 24,
      font_weight: '800',
      text_color: '#FFFFFF',
      secondary_color: '#00E5FF',
    },
  },
  {
    id: 'left-new-furnace-orange',
    sidebar: true,
    template20Id: 'T05',
    templateSource: 'lekha-49',
    text: 'Heat Builds Real Motion',
    phaseIndex: 0,
    impWordIndex: 1,
    requiredColors: ['orange', 'white'],
    style: {
      template_name: 'The Furnace',
      font_family: 'Inter',
      font_size: 24,
      font_weight: '800',
      text_color: '#FFFFFF',
      secondary_color: '#FF6B1A',
    },
  },
  {
    id: 'right-basic-green-neon-pulse',
    basic: true,
    templateId: 't-115',
    text: 'This Is Great Now',
    phaseIndex: 0,
    impWordIndex: 1,
    requiredColors: ['green', 'white'],
    style: {
      template_name: 'Green Neon Pulse',
      font_weight: '900',
      font_style: 'italic',
      text_color: '#FFFFFF',
      secondary_color: '#39FF14',
      highlight_color: '#39FF14',
    },
  },
  {
    id: 'right-basic-study-slide-words',
    basic: true,
    templateId: 't-T4',
    text: 'Study Words Slide Softly',
    phaseIndex: 0,
    impWordIndex: 1,
    requiredColors: ['white'],
    style: {
      template_name: 'Study With Me',
      font_family: 'Playfair Display',
      font_size: 24,
      font_weight: '700',
      font_style: 'italic',
      text_color: '#FFFFFF',
      secondary_color: '#FFFFFF',
      highlight_color: '#DDAA03',
    },
  },
  {
    id: 'right-basic-study-rise-words',
    basic: true,
    templateId: 't-T4',
    text: 'Quiet Notes Rise Slowly',
    phaseIndex: 2,
    impWordIndex: 2,
    requiredColors: ['white'],
    style: {
      template_name: 'Study With Me',
      font_family: 'Playfair Display',
      font_size: 24,
      font_weight: '700',
      font_style: 'italic',
      text_color: '#FFFFFF',
      secondary_color: '#FFFFFF',
      highlight_color: '#DDAA03',
    },
  },
  {
    id: 'right-basic-iman',
    basic: true,
    templateId: 't-106',
    text: 'Words Reveal As Spoken',
    phaseIndex: 0,
    impWordIndex: 2,
    requiredColors: ['white'],
    style: {
      template_name: 'Iman',
      text_color: '#FFFFFF',
      secondary_color: '#39FF14',
      highlight_color: '#39FF14',
    },
  },
  {
    id: 'right-basic-orange-box',
    basic: true,
    templateId: 't-T6',
    text: 'Orange Box Matches Preview',
    phaseIndex: 1,
    impWordIndex: -1,
    requiredColors: ['orange', 'white'],
    style: {
      template_name: 'Orange Box',
      font_family: 'Montserrat',
      font_size: 24,
      font_weight: '800',
      font_style: 'italic',
      text_color: '#FFFFFF',
      secondary_color: '#FFFFFF',
      background_color: '#F97316',
      highlight_color: '#DDAA03',
    },
  },
  {
    id: 'right-basic-orange-box-preview-size-lock',
    basic: true,
    templateId: 't-T6',
    text: 'Preview Size Lock',
    phaseIndex: 1,
    impWordIndex: -1,
    requiredColors: ['orange', 'white'],
    maxWhiteBboxHeight: 22,
    style: {
      template_name: 'Orange Box',
      font_family: 'Montserrat',
      font_size: 24,
      font_weight: '800',
      font_style: 'italic',
      text_color: '#FFFFFF',
      secondary_color: '#FFFFFF',
      background_color: '#F97316',
      highlight_color: '#DDAA03',
      preview_template_font_px: 13,
    },
  },
  {
    id: 'right-basic-caption-style-over-global-style',
    basic: true,
    templateId: 't-106',
    text: 'Caption Template Wins',
    phaseIndex: 0,
    impWordIndex: 1,
    requiredColors: ['white'],
    style: {
      template_name: 'Iman',
      text_color: '#FFFFFF',
      secondary_color: '#FFFFFF',
      highlight_color: '#FFFFFF',
    },
    payloadStyleOverride: {
      template_id: 't-12',
      template_source: 'lekha-basic',
      template_name: 'Horror',
      text_color: '#cc0000',
      secondary_color: '#cc0000',
      highlight_color: '#cc0000',
    },
  },
];

function buildExhaustiveSidebarCases() {
  const cases = [];
  for (const { source, templateSource, cardClass, idClass, nameClass } of [
    {
      source: legacySidebarHtml,
      templateSource: 'lekha-20',
      cardClass: 'card',
      idClass: 'cid',
      nameClass: 'cnm',
    },
    {
      source: newSidebarHtml,
      templateSource: 'lekha-49',
      cardClass: 'lk-card',
      idClass: 'lk-cid',
      nameClass: 'lk-cnm',
    },
  ]) {
    const sanitized = sanitizeHtml(source);
    const cardPattern = /<div\b[^>]*class="([^"]*)"[^>]*>/gi;
    let match;
    while ((match = cardPattern.exec(sanitized))) {
      const classList = String(match[1] || '').split(/\s+/);
      if (!classList.includes(cardClass)) continue;
      const cardMarkup = extractCompleteDiv(sanitized, match.index);
      const id = stripHtml(
        cardMarkup.match(new RegExp(`<span class="${idClass}">([\\s\\S]*?)<\\/span>`, 'i'))?.[1] || '',
      );
      const templateName = stripHtml(
        cardMarkup.match(new RegExp(`<span class="${nameClass}">([\\s\\S]*?)<\\/span>`, 'i'))?.[1] || '',
      ).replace(/^[^A-Za-z]+/, '');
      if (id) {
        cases.push({
          id: `left-all-${templateSource}-${id}`.replace(/[^a-z0-9_-]+/gi, '-').toLowerCase(),
          sidebar: true,
          template20Id: id,
          templateSource,
          text: 'Every Template Must Render',
          phaseIndex: 0,
          impWordIndex: 2,
          requiredColors: [],
          style: {
            template_name: templateName || id,
            font_family: templateSource === 'lekha-49' ? 'Inter' : 'Noto Sans',
            font_size: 24,
            font_weight: '800',
            text_color: '#FFFFFF',
            secondary_color: '#DDAA03',
          },
        });
      }
      cardPattern.lastIndex = match.index + Math.max(cardMarkup.length, 1);
    }
  }
  return cases;
}

// Right-side "Basic" templates render their `.btcard` source markup in both the
// preview and the export — guard a representative sample (and an exhaustive
// `all-basic` scope) so the two never silently diverge again.
const BASIC_TEMPLATE_IDS = [
  't-106', 't-52', 't-T4', 't-WS1', 't-115',
  't-104', 't-109', 't-95', 't-102', 't-T5',
  't-T6', 't-103', 't-QW1', 't-36', 't-105',
  't-124', 't-110', 't-56', 't-119', 't-12',
];

function buildExhaustiveBasicCases() {
  return BASIC_TEMPLATE_IDS.flatMap((templateId) => {
    const rawMarkup = findAppliedBasicTemplateMarkup(rightTemplateHtml, { template_id: templateId });
    const phaseCount = countAppliedBasicTemplatePhasesFromMarkup(rawMarkup);
    return Array.from({ length: phaseCount }, (_, phaseIndex) => ({
      id: `right-basic-${templateId}-p${phaseIndex}`,
      basic: true,
      templateId,
      text: 'Every Template Must Render',
      phaseIndex,
      impWordIndex: 2,
      requiredColors: [],
      style: { secondary_color: '#39FF14', highlight_color: '#39FF14' },
    }));
  });
}

function buildScaledBasicCases() {
  return BASIC_TEMPLATE_IDS.map((templateId) => ({
    id: `right-basic-scaled-${templateId}`,
    basic: true,
    templateId,
    text: 'Every Template Must Render',
    phaseIndex: 0,
    impWordIndex: 2,
    requiredColors: [],
    videoWidth: 1080,
    videoHeight: 1920,
    previewWidth: 360,
    minBboxHeight: 32,
    style: { secondary_color: '#39FF14', highlight_color: '#39FF14' },
  }));
}

function buildExhaustiveAdvancedCases({ allPhases = false } = {}) {
  const cases = [];
  for (const [templateId, blocks] of Object.entries(ORIGINAL_TEMPLATE_BLOCKS)) {
    const phaseIndexes = allPhases ? blocks.map((_, index) => index) : [0];
    for (const phaseIndex of phaseIndexes) {
      cases.push({
        id: `right-all-${templateId}-p${phaseIndex}`,
        templateId,
        text: 'Every Template Must Render',
        phaseIndex,
        impWordIndex: 2,
        requiredColors: [],
      });
    }
  }
  return cases;
}

const AFFECTED_ADVANCED_TEMPLATE_IDS = [
  't11', // Spiritual Awakening
  't13', // Startup Hustle
  't14', // Literary Weight
  't15', // Storm Surge
  't16', // Motivation Stack
  't17', // Horror / Tension
  't18', // Cinematic Chapter
  't22', // Music / Lyrical
  't24', // Philosophical Twist
  't25', // Love Letter
  't26', // Street / Raw
  't29', // Battle Cry
  't31', // Newspaper Headline
  't33', // Documentary
  't34', // Anime Energy
];

const GOAL_ADVANCED_TEMPLATE_IDS = [
  ...RECREATED_ADVANCED_TEMPLATE_IDS,
];

function buildAffectedAdvancedPhaseCases() {
  return AFFECTED_ADVANCED_TEMPLATE_IDS.flatMap((templateId) => {
    const blocks = ORIGINAL_TEMPLATE_BLOCKS[templateId] || [];
    return blocks.map((_, phaseIndex) => ({
      id: `affected-${templateId}-p${phaseIndex}`,
      templateId,
      text: 'Every Named Template Renders',
      phaseIndex,
      impWordIndex: 2,
      requiredColors: [],
      minBboxHeight: 10,
    }));
  });
}

function buildGoalAdvancedPhaseCases() {
  return GOAL_ADVANCED_TEMPLATE_IDS.flatMap((templateId) => {
    const blocks = ORIGINAL_TEMPLATE_BLOCKS[templateId] || [];
    return blocks.map((_, phaseIndex) => ({
      id: `goal-${templateId}-p${phaseIndex}`,
      templateId,
      text: 'Every Named Template Renders',
      phaseIndex,
      impWordIndex: 2,
      requiredColors: [],
      minBboxHeight: 10,
      motionCritical: true,
    }));
  });
}

function fail(message) {
  throw new Error(`Template export parity failed: ${message}`);
}

function sanitizeHtml(value = '') {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\s+bis_skin_checked="[^"]*"/gi, '')
    .replace(/<!-- saved from url=.*?-->\s*/gi, '');
}

function extractCompleteDiv(markup = '', startIndex = 0) {
  const tagPattern = /<\/?div\b[^>]*>/gi;
  tagPattern.lastIndex = Math.max(0, Number(startIndex) || 0);
  let depth = 0;
  let match;

  while ((match = tagPattern.exec(markup))) {
    depth += match[0].startsWith('</') ? -1 : 1;
    if (depth === 0) return markup.slice(startIndex, tagPattern.lastIndex);
  }

  return '';
}

function stripHtml(value = '') {
  return String(value).replace(/<[^>]+>/g, '').trim();
}

function stripPreviewRuntimeState(markup = '', preserveInlineStyles = false) {
  return String(markup)
    .replace(/\s+bis_skin_checked="[^"]*"/gi, '')
    .replace(preserveInlineStyles ? /$^/g : /\sstyle="[^"]*"/gi, '')
    .replace(/\sclass="([^"]*)"/gi, (_, classValue) => {
      const cleanedClassValue = String(classValue)
        .split(/\s+/)
        .filter((className) => className && !['active', 'visible', 'anim', 'on'].includes(className))
        .join(' ');
      return cleanedClassValue ? ` class="${cleanedClassValue}"` : '';
    })
    .replace(/\s+data-ti="[^"]*"/gi, '')
    .replace(/\s+data-si="[^"]*"/gi, '');
}

function findSidebarTemplateMarkup(templateSource, templateId) {
  const isNew = templateSource === 'lekha-49';
  const source = sanitizeHtml(isNew ? newSidebarHtml : legacySidebarHtml);
  const cardClass = isNew ? 'lk-card' : 'card';
  const idClass = isNew ? 'lk-cid' : 'cid';
  const cardPattern = /<div\b[^>]*class="([^"]*)"[^>]*>/gi;
  let match;

  while ((match = cardPattern.exec(source))) {
    const classList = String(match[1] || '').split(/\s+/);
    if (!classList.includes(cardClass)) continue;
    const cardMarkup = extractCompleteDiv(source, match.index);
    const id = stripHtml(
      cardMarkup.match(new RegExp(`<span class="${idClass}">([\\s\\S]*?)<\\/span>`, 'i'))?.[1] || '',
    );
    if (id === templateId) {
      return stripPreviewRuntimeState(cardMarkup, isNew);
    }
    cardPattern.lastIndex = match.index + Math.max(cardMarkup.length, 1);
  }

  fail(`left template ${templateSource}:${templateId} was not found`);
}

async function resolveChromeExecutable() {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
    path.join(process.env.PROGRAMFILES || '', 'Google/Chrome/Application/chrome.exe'),
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Try the next installed browser.
    }
  }

  return undefined;
}

function buildPayload(testCase, outputDir) {
  if (testCase.sidebar) {
    const style = testCase.style || {};
    const templateMarkup = findSidebarTemplateMarkup(testCase.templateSource, testCase.template20Id);
    const resolvedStyle = {
      template_id: `sidebar-${testCase.template20Id}`,
      template_20_id: testCase.template20Id,
      template_source: testCase.templateSource,
      template_name: style.template_name || testCase.template20Id,
      template_class: templateMarkup.match(/<div[^>]*class="([^"]+)"/i)?.[1]?.split(/\s+/)?.slice(0, 2)?.join(' ') || '',
      template_phase_index: testCase.phaseIndex,
      template_layout: 'word-by-word',
      template_effect: 'export-audit',
      template_markup: templateMarkup,
      preview_width: 360,
      position_x: 50,
      position_y: 75,
      text_align: 'center',
      show_inactive: true,
      line_spacing: 1.25,
      word_spacing: 1,
      ...style,
    };

    return {
      video_width: testCase.videoWidth || 360,
      video_height: testCase.videoHeight || 640,
      duration: 2,
      output_dir: outputDir,
      style: {
        ...resolvedStyle,
        ...(testCase.payloadStyleOverride || {}),
      },
      captions: [
        {
          id: `${testCase.id}-caption`,
          text: testCase.text,
          start_time: 0,
          end_time: 2,
          template_id: resolvedStyle.template_id,
          template_20_id: testCase.template20Id,
          template_source: testCase.templateSource,
          template_name: resolvedStyle.template_name,
          template_class: resolvedStyle.template_class,
          template_phase_index: testCase.phaseIndex,
          __templateIndex: testCase.phaseIndex,
          template_markup: templateMarkup,
          applied_template_style: resolvedStyle,
          imp_word_index: testCase.impWordIndex,
          emphasis_color: style.secondary_color || '#DDAA03',
          words: [],
        },
      ],
    };
  }

  if (testCase.basic) {
    const style = testCase.style || {};
    const resolvedStyle = {
      template_id: testCase.templateId,
      template_source: 'lekha-basic',
      template_name: style.template_name || testCase.templateId,
      template_phase_index: testCase.phaseIndex,
      preview_width: testCase.previewWidth || 360,
      position_x: 50,
      position_y: 75,
      text_align: 'center',
      show_inactive: true,
      line_spacing: 1.25,
      word_spacing: 1,
      font_family: 'Noto Sans',
      font_size: 26,
      font_weight: '800',
      text_color: '#FFFFFF',
      secondary_color: '#DDAA03',
      highlight_color: '#DDAA03',
      ...style,
    };
    const words = String(testCase.text).trim().split(/\s+/).filter(Boolean);
    const step = 2 / Math.max(1, words.length);
    return {
      video_width: testCase.videoWidth || 360,
      video_height: testCase.videoHeight || 640,
      duration: 2,
      output_dir: outputDir,
      style: {
        ...resolvedStyle,
        ...(testCase.payloadStyleOverride || {}),
      },
      captions: [
        {
          id: `${testCase.id}-caption`,
          text: testCase.text,
          start_time: 0,
          end_time: 2,
          template_id: testCase.templateId,
          template_source: 'lekha-basic',
          template_phase_index: testCase.phaseIndex,
          __templateIndex: testCase.phaseIndex,
          applied_template_style: resolvedStyle,
          imp_word_index: testCase.impWordIndex,
          emphasis_color: resolvedStyle.secondary_color,
          words: words.map((word, index) => ({
            word,
            start: Number((index * step).toFixed(3)),
            end: Number(((index + 1) * step).toFixed(3)),
          })),
        },
      ],
    };
  }

  const style = {
    ...DEFAULT_ADVANCED_STYLE,
    ...(ADVANCED_STYLE_OVERRIDES[testCase.templateId] || {}),
    ...(TEMPLATE_STYLES[testCase.templateId] || {}),
    ...(testCase.style || {}),
  };
  return {
      video_width: testCase.videoWidth || 360,
      video_height: testCase.videoHeight || 640,
      duration: 2,
    output_dir: outputDir,
    style: {
      template_id: testCase.templateId,
      template_source: 'lekha-advanced',
      template_name: style.template_name,
      template_class: `tcard ${testCase.templateId}`,
      template_phase_index: testCase.phaseIndex,
      template_layout: 'styled',
      preview_width: testCase.previewWidth || 360,
      preview_template_font_px: Math.round(style.font_size * 0.72 * 10) / 10,
      position_x: 50,
      position_y: 75,
      text_align: 'center',
      show_inactive: true,
      line_spacing: 1.25,
      word_spacing: 1,
      ...style,
    },
    captions: [
      {
        id: `${testCase.id}-caption`,
        text: testCase.text,
        start_time: 0,
        end_time: 2,
        template_id: testCase.templateId,
        template_source: 'lekha-advanced',
        template_name: style.template_name,
        template_phase_index: testCase.phaseIndex,
        __templateIndex: testCase.phaseIndex,
        imp_word_index: testCase.impWordIndex,
        emphasis_color: style.secondary_color,
        words: [],
      },
    ],
  };
}

async function renderCase(testCase, rootOutputDir) {
  const outputDir = path.join(rootOutputDir, testCase.id);
  await fs.mkdir(outputDir, { recursive: true });
  const payloadPath = path.join(outputDir, 'payload.json');
  await fs.writeFile(payloadPath, JSON.stringify(buildPayload(testCase, outputDir), null, 2));
  await execFileAsync(process.execPath, [rendererPath, payloadPath], {
    cwd: projectRoot,
    timeout: 60_000,
    maxBuffer: 1024 * 1024 * 4,
  });

  const entries = await fs.readdir(outputDir);
  const frames = entries
    .filter((name) => /^frame-\d+\.png$/i.test(name))
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
  if (!frames.length) fail(`${testCase.id} did not produce overlay frames`);
  const framePaths = frames.map((frame) => path.join(outputDir, frame));
  return {
    outputDir,
    framePath: framePaths[framePaths.length - 1],
    framePaths,
  };
}

async function measureFrame(page, framePath) {
  const imageBuffer = await fs.readFile(framePath);
  const dataUrl = `data:image/png;base64,${imageBuffer.toString('base64')}`;

  return page.evaluate(async (src) => {
    const image = new Image();
    image.src = src;
    await image.decode();

    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const counts = {
      visible: 0,
      white: 0,
      orange: 0,
      gold: 0,
      yellow: 0,
      green: 0,
      red: 0,
      magenta: 0,
      cyan: 0,
    };
    const rowVisible = new Array(canvas.height).fill(0);
    const makeBox = () => ({
      minX: canvas.width,
      minY: canvas.height,
      maxX: -1,
      maxY: -1,
    });
    const boxes = {
      visible: makeBox(),
      white: makeBox(),
      orange: makeBox(),
      gold: makeBox(),
      yellow: makeBox(),
      green: makeBox(),
      red: makeBox(),
      magenta: makeBox(),
      cyan: makeBox(),
    };
    const addBoxPixel = (name, x, y) => {
      const box = boxes[name];
      if (!box) return;
      box.minX = Math.min(box.minX, x);
      box.minY = Math.min(box.minY, y);
      box.maxX = Math.max(box.maxX, x);
      box.maxY = Math.max(box.maxY, y);
    };
    const toBbox = (name) => {
      const box = boxes[name];
      if (!box || box.maxX < 0 || box.maxY < 0) return null;
      return {
        x: box.minX,
        y: box.minY,
        width: box.maxX - box.minX + 1,
        height: box.maxY - box.minY + 1,
      };
    };

    for (let index = 0; index < pixels.length; index += 4) {
      const pixel = index / 4;
      const x = pixel % canvas.width;
      const y = Math.floor(pixel / canvas.width);
      const r = pixels[index];
      const g = pixels[index + 1];
      const b = pixels[index + 2];
      const a = pixels[index + 3];
      if (a < 32) continue;
      if (r > 18 || g > 18 || b > 18) {
        counts.visible += 1;
        rowVisible[y] += 1;
        addBoxPixel('visible', x, y);
      }
      if (r >= 205 && g >= 205 && b >= 205) {
        counts.white += 1;
        addBoxPixel('white', x, y);
      }
      if (r >= 185 && g >= 70 && g <= 175 && b <= 110) {
        counts.orange += 1;
        addBoxPixel('orange', x, y);
      }
      if (r >= 145 && r >= g && g >= 95 && g <= 190 && b <= 125) {
        counts.gold += 1;
        addBoxPixel('gold', x, y);
      }
      if (r >= 200 && g >= 185 && b <= 90) {
        counts.yellow += 1;
        addBoxPixel('yellow', x, y);
      }
      if (r <= 130 && g >= 170 && b <= 140) {
        counts.green += 1;
        addBoxPixel('green', x, y);
      }
      if (r >= 190 && g <= 110 && b <= 120) {
        counts.red += 1;
        addBoxPixel('red', x, y);
      }
      if (r >= 170 && b >= 150 && g <= 90) {
        counts.magenta += 1;
        addBoxPixel('magenta', x, y);
      }
      if (r <= 120 && g >= 145 && b >= 145) {
        counts.cyan += 1;
        addBoxPixel('cyan', x, y);
      }
    }

    const visibleRows = rowVisible
      .map((count, y) => ({ count, y }))
      .filter(({ count }) => count >= 3);
    const lineClusters = [];
    visibleRows.forEach(({ y }) => {
      const lastCluster = lineClusters[lineClusters.length - 1];
      if (!lastCluster || y - lastCluster.end > 2) {
        lineClusters.push({ start: y, end: y });
      } else {
        lastCluster.end = y;
      }
    });

    return {
      visible: counts.visible,
      white: counts.white,
      orange: counts.orange,
      gold: counts.gold,
      yellow: counts.yellow,
      green: counts.green,
      red: counts.red,
      magenta: counts.magenta,
      cyan: counts.cyan,
      bbox: toBbox('visible'),
      whiteBbox: toBbox('white'),
      orangeBbox: toBbox('orange'),
      goldBbox: toBbox('gold'),
      yellowBbox: toBbox('yellow'),
      greenBbox: toBbox('green'),
      redBbox: toBbox('red'),
      magentaBbox: toBbox('magenta'),
      cyanBbox: toBbox('cyan'),
      lineCount: lineClusters.length,
      lineClusters,
    };
  }, dataUrl);
}

async function measureFrameMotion(page, framePaths) {
  const sampledPaths = framePaths.slice(0, Math.min(framePaths.length, 14));
  const dataUrls = await Promise.all(
    sampledPaths.map(async (framePath) => {
      const imageBuffer = await fs.readFile(framePath);
      return `data:image/png;base64,${imageBuffer.toString('base64')}`;
    }),
  );

  return page.evaluate(async (srcs) => {
    const frames = [];

    for (const src of srcs) {
      const image = new Image();
      image.src = src;
      await image.decode();

      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let visible = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        const r = pixels[index];
        const g = pixels[index + 1];
        const b = pixels[index + 2];
        const a = pixels[index + 3];
        if (a >= 32 && (r > 18 || g > 18 || b > 18)) visible += 1;
      }
      frames.push({ pixels, visible, width: canvas.width, height: canvas.height });
    }

    let maxChangedPixels = 0;
    for (let frameIndex = 0; frameIndex < frames.length - 1; frameIndex += 1) {
      const current = frames[frameIndex];
      const next = frames[frameIndex + 1];
      const length = Math.min(current.pixels.length, next.pixels.length);
      let changed = 0;
      for (let index = 0; index < length; index += 4) {
        const currentAlpha = current.pixels[index + 3];
        const nextAlpha = next.pixels[index + 3];
        if (currentAlpha < 12 && nextAlpha < 12) continue;
        const delta =
          Math.abs(current.pixels[index] - next.pixels[index])
          + Math.abs(current.pixels[index + 1] - next.pixels[index + 1])
          + Math.abs(current.pixels[index + 2] - next.pixels[index + 2])
          + Math.abs(currentAlpha - nextAlpha);
        if (delta > 28) changed += 1;
      }
      maxChangedPixels = Math.max(maxChangedPixels, changed);
    }

    const area = frames[0] ? frames[0].width * frames[0].height : 1;
    return {
      frameCount: srcs.length,
      visibleFrames: frames.filter((frame) => frame.visible >= 80).length,
      maxChangedPixels,
      maxChangedRatio: maxChangedPixels / area,
    };
  }, dataUrls);
}

const outputRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lekha-template-export-parity-'));
const selectedCases = (() => {
  const scope = cliScope || process.env.TEMPLATE_EXPORT_SCOPE || '';
  if (scope === 'all-left') return buildExhaustiveSidebarCases();
  if (scope === 'all-right') return buildExhaustiveAdvancedCases();
  if (scope === 'all-right-phases') return buildExhaustiveAdvancedCases({ allPhases: true });
  if (scope === 'affected-right-phases') return buildAffectedAdvancedPhaseCases();
  if (scope === 'goal-right-phases') return buildGoalAdvancedPhaseCases();
  if (scope === 'all-basic') return buildExhaustiveBasicCases();
  if (scope === 'all-basic-scaled') return buildScaledBasicCases();
  return CASES;
})();
const browser = await puppeteer.launch({
  headless: true,
  executablePath: await resolveChromeExecutable(),
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 360, height: 640, deviceScaleFactor: 1 },
});

// TEMPLATE_EXPORT_COLLECT=1 runs every case and reports all failures at the end
// instead of stopping at the first one — useful when auditing many templates.
const collectFailures = process.env.TEMPLATE_EXPORT_COLLECT === '1';
const collectedFailures = [];

try {
  const page = await browser.newPage();
  const results = [];
  for (const testCase of selectedCases) {
    try {
    const { framePath, framePaths } = await renderCase(testCase, outputRoot);
    const counts = await measureFrame(page, framePath);
    const motion = testCase.motionCritical ? await measureFrameMotion(page, framePaths) : null;
    if (counts.visible < 80) {
      fail(`${testCase.id} exported a blank or nearly blank overlay (${counts.visible} visible pixels)`);
    }
    if (testCase.motionCritical) {
      if (!motion || motion.frameCount < 4 || motion.visibleFrames < 2 || motion.maxChangedPixels < 40) {
        fail(`${testCase.id} exported too little frame-to-frame motion: ${JSON.stringify(motion)}`);
      }
    }
    if (testCase.minBboxHeight && (!counts.bbox || counts.bbox.height < testCase.minBboxHeight)) {
      fail(`${testCase.id} exported too small for scaled output: bbox=${JSON.stringify(counts.bbox)}`);
    }
    if (testCase.maxBboxHeight && (!counts.bbox || counts.bbox.height > testCase.maxBboxHeight)) {
      fail(`${testCase.id} exported too large for preview-sized output: bbox=${JSON.stringify(counts.bbox)}`);
    }
    if (testCase.maxBboxWidth && (!counts.bbox || counts.bbox.width > testCase.maxBboxWidth)) {
      fail(`${testCase.id} exported too wide for preview-sized output: bbox=${JSON.stringify(counts.bbox)}`);
    }
    if (testCase.maxWhiteBboxHeight && (!counts.whiteBbox || counts.whiteBbox.height > testCase.maxWhiteBboxHeight)) {
      fail(`${testCase.id} exported text too large for preview-sized output: whiteBbox=${JSON.stringify(counts.whiteBbox)}`);
    }
    if (testCase.minGoldXOffset && (!counts.bbox || !counts.goldBbox || counts.goldBbox.x - counts.bbox.x < testCase.minGoldXOffset)) {
      fail(`${testCase.id} highlighted the wrong word: bbox=${JSON.stringify(counts.bbox)} goldBbox=${JSON.stringify(counts.goldBbox)}`);
    }
    if (testCase.minGoldYOffset && (!counts.whiteBbox || !counts.goldBbox || counts.goldBbox.y - counts.whiteBbox.y < testCase.minGoldYOffset)) {
      fail(`${testCase.id} did not preserve stacked text structure: whiteBbox=${JSON.stringify(counts.whiteBbox)} goldBbox=${JSON.stringify(counts.goldBbox)}`);
    }
    if (testCase.expectedLineCount && counts.lineCount !== testCase.expectedLineCount) {
      fail(`${testCase.id} exported ${counts.lineCount} visual lines instead of ${testCase.expectedLineCount}: ${JSON.stringify(counts.lineClusters)}`);
    }
    for (const colorName of testCase.requiredColors) {
      if (counts[colorName] < 8) {
        fail(`${testCase.id} missing ${colorName} pixels in export frame: ${JSON.stringify(counts)}`);
      }
    }
    if (testCase.minColorPixels) {
      for (const [colorName, minPixels] of Object.entries(testCase.minColorPixels)) {
        if ((counts[colorName] || 0) < minPixels) {
          fail(`${testCase.id} exported too few bright ${colorName} pixels: ${JSON.stringify(counts)}`);
        }
      }
    }
    results.push(`${testCase.id}:${JSON.stringify(motion ? { ...counts, motion } : counts)}`);
    } catch (error) {
      if (!collectFailures) throw error;
      collectedFailures.push(error.message);
    }
  }

  if (collectedFailures.length) {
    throw new Error(`${collectedFailures.length} case(s) failed:\n${collectedFailures.join('\n')}`);
  }

  const scope = cliScope || process.env.TEMPLATE_EXPORT_SCOPE || '';
  const scopeLabel = scope === 'all-left'
    ? 'left templates'
    : scope === 'all-right'
      ? 'right templates'
      : scope === 'all-right-phases'
      ? 'right template phases'
      : scope === 'affected-right-phases'
      ? 'affected right template phases'
      : scope === 'goal-right-phases'
      ? 'goal right template phases'
      : scope === 'all-basic'
        ? 'right basic templates'
        : scope === 'all-basic-scaled'
          ? 'scaled right basic templates'
          : 'high-risk template phases';
  console.log(`Template export parity passed for ${selectedCases.length} ${scopeLabel}.`);
  console.log(results.join('\n'));
} finally {
  await browser.close();
  if (process.env.KEEP_TEMPLATE_EXPORT_AUDIT !== '1') {
    await fs.rm(outputRoot, { recursive: true, force: true });
  } else {
    console.log(`Kept template export audit frames at ${outputRoot}`);
  }
}
