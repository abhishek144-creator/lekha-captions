import { Fragment, useCallback, useMemo, useRef, useState } from 'react';
import { useLazyVisible } from './useLazyVisible';
import { Check, History, RotateCcw, Sparkles, Search, Star } from 'lucide-react';
import originalTemplateHtml from '../../assets/lekha-captions-T11-T35.html?raw';
import { findAppliedBasicTemplateMarkup } from './basicTemplateInline.js';
import { BASIC_TEMPLATE_STYLES, getBasicTemplateStyle } from './basicTemplateCatalog.js';
import { DEFAULT_CAPTION_POSITION_Y } from '../../lib/captionDefaults.js';
import {
  LEGACY_TEMPLATE_CARDS,
  STUDIO_TEMPLATE_CARDS,
  TemplatePreviewFrame as LegacyTemplatePreviewFrame,
  buildTemplateStyle as buildLegacyTemplateStyle,
} from './SidebarTemplateGallery20.jsx';
import {
  ADVANCED_IMP_ENTRANCES,
  ADVANCED_TEMPLATE_EMPHASIS_COLORS,
  ADVANCED_TEMPLATE_RUNTIME_CSS,
  ORIGINAL_TEMPLATE_BLOCKS,
  isKeyframeAdvancedTemplateId,
} from './templateMotionConfig';
import {
  isExportableTemplateCandidate,
  templateMatchesQuery,
  useTemplateFavorites,
  useRecentTemplates,
} from './templateBrowserUtils.js';
import {
  ADVANCED_PREVIEW_SCRIPT,
  BASIC_PREVIEW_SCRIPT,
  previewConfigScript,
} from './templatePreviewScripts.js';
import '../../styles/advancedTemplateLibrary.css';

const sanitizedOriginalTemplateHtml = originalTemplateHtml
  .replace(/<script[\s\S]*?<\/script>/gi, '')
  .replace(/\s+bis_skin_checked="[^"]*"/gi, '')
  .replace(/<!-- saved from url=.*?-->\s*/gi, '');

const ADVANCED_TEMPLATE_PREVIEW_TIMING = Object.freeze({
  holdMs: 3300,
  enterMs: 260,
  exitMs: 360,
  gapMs: 70,
  wordStaggerMs: 95,
  wordDurationMs: 360,
  emphasisDelayMs: 80,
  emphasisDurationMs: 460,
  sequentialStaggerMs: 190,
  sequentialDurationMs: 280,
});

const BASIC_TEMPLATE_PREVIEW_TIMING = Object.freeze({
  fixedLineCycleMs: 2600,
  wordCycleMs: 1200,
  wordStaggerMs: 95,
  stickyWaveStaggerMs: 300,
});

// Hidden from the Templates tab; their rendering stays so projects that
// already use them still play and export. T41–T52 (Magnet Poetry to Receipt
// Print, the keyframe pack added 2026-10-04) were removed by the owner on
// 2026-10-22. On 2026-10-23 the owner removed Startup Hustle (t13), Storm
// Surge (t15), Cinematic Chapter (t18), Comedy Punchline (t23), Sci-Fi
// Futuristic (t27), Battle Cry (t29) and Anime Energy (t34).
const REMOVED_ADVANCED_TEMPLATE_IDS = new Set([
  't17',
  't13', 't15', 't18', 't23', 't27', 't29', 't34',
  't41', 't42', 't43', 't44', 't45', 't46',
  't47', 't48', 't49', 't50', 't51', 't52',
]);
// 2026-10-23: the owner removed Light Streak (t-52) and 3D Shadow (t-109).
const REMOVED_BASIC_TEMPLATE_IDS = new Set([
  't-12',
  't-36',
  't-52',
  't-95',
  't-103',
  't-104',
  't-109',
]);
// 2026-10-23: the owner removed The Current (A2), The Dispatch (A4), The Stage
// (B2) and The Verdict (B4) from the moved original templates.
const REMOVED_MOVED_LEGACY_TEMPLATE_IDS = new Set(['A2', 'A4', 'B2', 'B4']);

const FALLBACK_TEMPLATE_PACK = [
  { id: 't11', code: 'T11', name: 'Oracle', formula: '3-Style', stageLabel: 'CLUSTER', mood: 'spiritual' },
  { id: 't12', code: 'T12', name: 'Velvet', formula: '2-Style', stageLabel: 'TYPEWRITER', mood: 'intimate' },
  { id: 't13', code: 'T13', name: 'Signal', formula: '2-Style', stageLabel: 'STAMP IN', mood: 'hustle' },
  { id: 't14', code: 'T14', name: 'Gilded', formula: '3-Style', stageLabel: '3D FLIP', mood: 'literary' },
  { id: 't15', code: 'T15', name: 'Surge', formula: '2-Style', stageLabel: 'SURGE IN', mood: 'storm' },
  { id: 't16', code: 'T16', name: 'Grid', formula: '2-Style', stageLabel: 'STACK RISE', mood: 'countdown' },
  { id: 't18', code: 'T18', name: 'Chapter', formula: '3-Style', stageLabel: 'SPLIT TITLE', mood: 'cinematic' },
  { id: 't19', code: 'T19', name: 'Defiant', formula: '2-Style', stageLabel: 'SLASH WIPE', mood: 'rebellion' },
  { id: 't20', code: 'T20', name: 'Gravity', formula: '2-Style', stageLabel: 'NEON DROP', mood: 'impact' },
  { id: 't21', code: 'T21', name: 'Runway', formula: '2-Style', stageLabel: 'VERT REVEAL', mood: 'luxury' },
  { id: 't22', code: 'T22', name: 'Lyric', formula: '2-Style', stageLabel: 'KARAOKE', mood: 'lyrical' },
  { id: 't23', code: 'T23', name: 'Punch', formula: '3-Style', stageLabel: 'SETUP->POP', mood: 'comedy' },
  { id: 't24', code: 'T24', name: 'Pivot', formula: '3-Style', stageLabel: 'REDACT REVEAL', mood: 'philosophy' },
  { id: 't25', code: 'T25', name: 'Promise', formula: '2-Style', stageLabel: 'HANDWRITE', mood: 'love' },
  { id: 't26', code: 'T26', name: 'Street', formula: '2-Style', stageLabel: 'HARD CUT', mood: 'street' },
  { id: 't27', code: 'T27', name: 'Terminal', formula: '3-Style', stageLabel: 'CENTER EXPAND', mood: 'sci-fi' },
  { id: 't28', code: 'T28', name: 'Memory', formula: '2-Style', stageLabel: 'GRAIN BLUR', mood: 'nostalgia' },
  { id: 't29', code: 'T29', name: 'Battle', formula: '2-Style', stageLabel: 'SLAM', mood: 'battle' },
  { id: 't30', code: 'T30', name: 'Zen', formula: '1-Style', stageLabel: 'BREATHE', mood: 'zen' },
  { id: 't31', code: 'T31', name: 'Press', formula: '3-Style', stageLabel: 'TYPEWRITER', mood: 'editorial' },
  { id: 't32', code: 'T32', name: 'Poem', formula: '3-Style', stageLabel: 'INK WIPE', mood: 'poetry' },
  { id: 't33', code: 'T33', name: 'Archive', formula: '3-Style', stageLabel: 'DOC WIPE', mood: 'documentary' },
  { id: 't34', code: 'T34', name: 'Burst', formula: '2-Style', stageLabel: 'SPEED IN', mood: 'anime' },
  { id: 't35', code: 'T35', name: 'Secret', formula: '1-Style', stageLabel: 'SECRET REVEAL', mood: 'whisper' },
  { id: 't41', code: 'T41', name: 'Magnet Poetry', formula: '2-Style', stageLabel: 'FRIDGE SNAP', mood: 'playful' },
  { id: 't42', code: 'T42', name: 'Label Maker', formula: '1-Style', stageLabel: 'TAPE FEED', mood: 'organized' },
  { id: 't43', code: 'T43', name: 'Split-Flap Board', formula: '1-Style', stageLabel: 'DEPARTURES', mood: 'travel' },
  { id: 't44', code: 'T44', name: 'Chat Thread', formula: '1-Style', stageLabel: 'THEY TYPED', mood: 'storytime' },
  { id: 't45', code: 'T45', name: 'Transit Line', formula: '3-Style', stageLabel: 'ROUTE DRAW', mood: 'journey' },
  { id: 't46', code: 'T46', name: 'Blueprint', formula: '1-Style', stageLabel: 'PLOT SHEET', mood: 'explainer' },
  { id: 't47', code: 'T47', name: 'Sticker Slap', formula: '2-Style', stageLabel: 'SLAP', mood: 'hype' },
  { id: 't48', code: 'T48', name: 'Ransom Cutout', formula: '1-Style', stageLabel: 'CUT AND PASTE', mood: 'mystery' },
  { id: 't49', code: 'T49', name: 'Equalizer Stage', formula: '2-Style', stageLabel: 'SOUNDCHECK', mood: 'music' },
  { id: 't50', code: 'T50', name: 'Rewrite', formula: '1-Style', stageLabel: 'TRACK CHANGES', mood: 'twist' },
  { id: 't51', code: 'T51', name: 'Domino Topple', formula: '2-Style', stageLabel: 'CHAIN REACTION', mood: 'chain reaction' },
  { id: 't52', code: 'T52', name: 'Receipt Print', formula: '3-Style', stageLabel: 'TILL RECEIPT', mood: 'facts' },
];

const ADVANCED_TEMPLATE_STYLE = {
  t11: { font_family: 'Cormorant Garamond', font_size: 24, font_weight: '700', secondary_color: '#D4AF37', text_color: '#E8DFC8' },
  t12: { font_family: 'Lora', font_size: 24, font_style: 'italic', font_weight: '700', secondary_color: '#FF3D71', highlight_color: '#FF3D71', emphasis_color: '#FF3D71', text_color: '#FFFFFF' },
  t13: { font_family: 'IBM Plex Mono', font_size: 23, font_weight: '700', secondary_color: '#FFFFFF', text_color: '#F97316', text_case: 'uppercase' },
  t14: { font_family: 'Libre Baskerville', font_size: 23, font_weight: '700', secondary_color: '#D4AF37', text_color: '#E8E0D0' },
  t15: { font_family: 'Oswald', font_size: 22, font_weight: '700', secondary_color: '#FF3D71', text_color: '#FFFFFF', text_case: 'uppercase' },
  t16: { font_family: 'Unbounded', font_size: 22, font_weight: '900', secondary_color: '#FFFFFF', highlight_color: '#FFFFFF', emphasis_color: '#FFFFFF', text_color: '#00E5FF', text_case: 'uppercase' },
  t17: { font_family: 'Space Mono', font_size: 23, font_weight: '700', secondary_color: '#FF3D71', highlight_color: '#FF3D71', emphasis_color: '#FF3D71', text_color: '#FFFFFF', text_case: 'uppercase' },
  t18: { font_family: 'Cinzel', font_size: 23, font_weight: '700', secondary_color: '#D4AF37', text_color: '#FFFFFF' },
  t19: { font_family: 'Archivo Black', font_size: 25, font_weight: '900', secondary_color: '#FF3D71', text_color: '#FFFFFF', text_case: 'uppercase' },
  t20: { font_family: 'Dela Gothic One', font_size: 24, font_weight: '900', secondary_color: '#39FF14', text_color: '#FFFFFF', text_case: 'uppercase' },
  t21: { font_family: 'Josefin Sans', font_size: 24, font_weight: '700', secondary_color: '#FFFFFF', text_color: '#FFFFFF', text_case: 'uppercase' },
  t22: { font_family: 'DM Serif Display', font_size: 24, font_weight: '700', secondary_color: '#DDAA03', highlight_color: '#DDAA03', emphasis_color: '#DDAA03', text_color: '#FFFFFF' },
  t23: { font_family: 'Rubik', font_size: 24, font_weight: '700', secondary_color: '#D4AF37', text_color: '#F0F0E0' },
  t24: { font_family: 'Spectral', font_size: 23, font_weight: '600', secondary_color: '#F97316', text_color: '#FFFFFF' },
  t25: { font_family: 'Instrument Serif', font_size: 25, font_style: 'italic', font_weight: '700', secondary_color: '#FF3D71', text_color: '#FFFFFF' },
  t26: { font_family: 'Bungee', font_size: 24, font_weight: '900', secondary_color: '#F97316', text_color: '#FFFFFF', text_case: 'uppercase' },
  t27: { font_family: 'Exo 2', font_size: 20, font_weight: '700', secondary_color: '#FFFFFF', text_color: '#00E5FF', text_case: 'uppercase' },
  t28: { font_family: 'Bitter', font_size: 23, font_weight: '700', secondary_color: '#86DE02', highlight_color: '#86DE02', emphasis_color: '#86DE02', text_color: '#D8CBB8' },
  t29: { font_family: 'Teko', font_size: 24, font_weight: '700', secondary_color: '#F97316', text_color: '#FFFFFF', text_case: 'uppercase' },
  t30: { font_family: 'Cormorant Garamond', font_size: 24, font_style: 'italic', font_weight: '600', secondary_color: '#FFFFFF', text_color: '#B4D2C8' },
  t31: { font_family: 'Playfair Display', font_size: 27, font_weight: '700', secondary_color: '#D4AF37', text_color: '#FFFFFF' },
  t32: { font_family: 'Bodoni Moda', font_size: 23, font_style: 'italic', font_weight: '700', secondary_color: '#00E5FF', highlight_color: '#00E5FF', emphasis_color: '#00E5FF', text_color: '#D0CEE8' },
  t33: { font_family: 'Noto Sans', font_size: 23, font_weight: '700', secondary_color: '#EE17DC', highlight_color: '#EE17DC', emphasis_color: '#EE17DC', text_color: '#FFFFFF' },
  t34: { font_family: 'Syne', font_size: 20, font_weight: '800', secondary_color: '#15F5F9', highlight_color: '#15F5F9', emphasis_color: '#15F5F9', text_color: '#FFFFFF', text_case: 'uppercase' },
  t35: { font_family: 'Crimson Text', font_size: 24, font_style: 'italic', font_weight: '600', secondary_color: '#FFFFFF', text_color: '#DCD2DC' },
  t36: { font_family: 'Inter', font_size: 23, font_weight: '800', secondary_color: '#DDAA03', highlight_color: '#DDAA03', emphasis_color: '#DDAA03', karaoke_color_1: '#DDAA03', karaoke_color_2: '#22D3EE', karaoke_color_3: '#FB923C', text_color: '#FFFFFF' },
  t37: { font_family: 'Rajdhani', font_size: 25, font_weight: '800', secondary_color: '#FFFFFF', highlight_color: '#FFFFFF', emphasis_color: '#FFFFFF', text_color: '#E1DA09', text_case: 'uppercase' },
  t38: { font_family: 'Libre Baskerville', font_size: 23, font_weight: '700', secondary_color: '#D4AF37', text_color: '#FFFFFF' },
  t39: { font_family: 'IBM Plex Mono', font_size: 22, font_weight: '700', secondary_color: '#FF3D71', text_color: '#FFFFFF', text_case: 'uppercase' },
  t40: { font_family: 'Crimson Text', font_size: 24, font_weight: '600', secondary_color: '#F2072B', highlight_color: '#F2072B', emphasis_color: '#F2072B', text_color: '#FFFFFF' },
  t41: { font_family: 'Old Standard TT', font_size: 22, font_weight: '700', secondary_color: '#FFF1D0', highlight_color: '#FFF1D0', emphasis_color: '#FFF1D0', text_color: '#1E1A16' },
  t42: { font_family: 'Barlow Condensed', font_size: 24, font_weight: '700', secondary_color: '#FFE45C', highlight_color: '#FFE45C', emphasis_color: '#FFE45C', text_color: '#FFFFFF', text_case: 'uppercase' },
  t43: { font_family: 'Martian Mono', font_size: 20, font_weight: '600', secondary_color: '#FFB21A', highlight_color: '#FFB21A', emphasis_color: '#FFB21A', text_color: '#F2F2E8', text_case: 'uppercase' },
  t44: { font_family: 'Onest', font_size: 21, font_weight: '600', secondary_color: '#FF375F', highlight_color: '#FF375F', emphasis_color: '#FF375F', text_color: '#FFFFFF' },
  t45: { font_family: 'Public Sans', font_size: 22, font_weight: '700', secondary_color: '#FFD23F', highlight_color: '#FFD23F', emphasis_color: '#FFD23F', text_color: '#FFFFFF' },
  t46: { font_family: 'Jura', font_size: 21, font_weight: '600', secondary_color: '#FFFFFF', highlight_color: '#FFFFFF', emphasis_color: '#FFFFFF', text_color: '#CFEFFF' },
  t47: { font_family: 'Lilita One', font_size: 24, font_weight: '400', secondary_color: '#FF2E93', highlight_color: '#FF2E93', emphasis_color: '#FF2E93', text_color: '#FFFFFF' },
  t48: { font_family: 'Rozha One', font_size: 23, font_weight: '400', secondary_color: '#FFF6E5', highlight_color: '#FFF6E5', emphasis_color: '#FFF6E5', text_color: '#141414' },
  t49: { font_family: 'Bricolage Grotesque', font_size: 23, font_weight: '700', secondary_color: '#3DF2B0', highlight_color: '#3DF2B0', emphasis_color: '#3DF2B0', text_color: '#FFFFFF' },
  t50: { font_family: 'JetBrains Mono', font_size: 20, font_weight: '500', secondary_color: '#7EE787', highlight_color: '#7EE787', emphasis_color: '#7EE787', text_color: '#E6EDF3' },
  t51: { font_family: 'Big Shoulders Display', font_size: 25, font_weight: '800', secondary_color: '#F4C430', highlight_color: '#F4C430', emphasis_color: '#F4C430', text_color: '#16130F' },
  t52: { font_family: 'Ubuntu Mono', font_size: 22, font_weight: '400', secondary_color: '#C1121F', highlight_color: '#C1121F', emphasis_color: '#C1121F', text_color: '#2A2A2A', text_case: 'uppercase' },
};

function resolveAdvancedTemplateEmphasisColor(templateId, emphasisColor = '', blockIndex = -1) {
  const normalizedId = String(templateId || '').trim();
  if (normalizedId === 't23' && Number(blockIndex) === 3) {
    return '#ffffff';
  }
  return emphasisColor || ADVANCED_TEMPLATE_EMPHASIS_COLORS[normalizedId] || '';
}

function normalizeColor(value, fallback = '#FFFFFF') {
  const raw = String(value || '').trim();
  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toUpperCase();
  if (/^#[0-9a-f]{3}$/i.test(raw)) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`.toUpperCase();
  }
  return fallback.toUpperCase();
}

function getTemplatePalette(style = {}, defaults = {}) {
  const templateId = String(style.template_id || defaults.template_id || '').trim();
  const isCustomized = Boolean(style.template_color_customized || defaults.template_color_customized);
  const sourceAccent = !isCustomized ? ADVANCED_TEMPLATE_EMPHASIS_COLORS[templateId] : '';
  const sourceText = templateId === 't36'
    ? '#FFFFFF'
    : (!isCustomized && templateId === 't12' ? '#FFFFFF' : '');
  const accentSourceField = BASIC_TEMPLATE_ACCENT_SOURCE_FIELDS[templateId] || '';
  const configuredAccent = accentSourceField
    ? style[accentSourceField]
      || defaults[accentSourceField]
      || style.emphasis_color
      || defaults.emphasis_color
      || style.secondary_color
      || defaults.secondary_color
      || style.highlight_color
      || defaults.highlight_color
    : style.highlight_color
      || style.emphasis_color
      || style.secondary_color
      || defaults.highlight_color
      || defaults.emphasis_color
      || defaults.secondary_color;
  const text = normalizeColor(sourceText || style.text_color || defaults.text_color, '#FFFFFF');
  const accent = normalizeColor(
    isCustomized ? configuredAccent : (sourceAccent || configuredAccent),
    '#D4AF37',
  );
  const background = normalizeColor(style.background_color || defaults.background_color, '#0E0E12');
  return { text, accent, background };
}

function getTemplateCustomizationPatch(field, color, currentStyle = {}) {
  const nextColor = normalizeColor(color);
  if (field === 'text') {
    return { text_color: nextColor, text_gradient: '', template_color_customized: true };
  }
  if (field === 'accent') {
    const templateId = String(currentStyle?.template_id || '').trim();
    const accentSourceField = BASIC_TEMPLATE_ACCENT_SOURCE_FIELDS[templateId] || '';
    if (accentSourceField === 'highlight_color') {
      return {
        highlight_color: nextColor,
        highlight_gradient: '',
        emphasis_color: nextColor,
        template_color_customized: true,
      };
    }
    return {
      secondary_color: nextColor,
      highlight_color: nextColor,
      highlight_gradient: '',
      emphasis_color: nextColor,
      template_color_customized: true,
      ...(currentStyle.has_stroke ? { stroke_color: nextColor } : {}),
      ...(currentStyle.has_shadow ? { shadow_color: nextColor } : {}),
    };
  }
  if (field === 'background') return { background_color: nextColor, has_background: true, template_color_customized: true };
  if (field === 'karaoke1') return {
    karaoke_color_1: nextColor,
    secondary_color: nextColor,
    highlight_color: nextColor,
    emphasis_color: nextColor,
    highlight_gradient: '',
    template_color_customized: true,
  };
  if (field === 'karaoke2') return { karaoke_color_2: nextColor, template_color_customized: true };
  if (field === 'karaoke3') return { karaoke_color_3: nextColor, template_color_customized: true };
  return {};
}

function buildAppliedTemplateStyle(template) {
  const defaultBlockIndex = template.id === 't17' ? 1 : 0;
  const defaultBlock = template.blocks?.[defaultBlockIndex] || template.blocks?.[0];

  return {
    template_id: template.id,
    template_source: 'lekha-advanced',
    template_class: `tcard ${template.id}`,
    template_name: template.name || template.id,
    template_layout: defaultBlock?.type || 'styled',
    template_effect: defaultBlock?.label || '',
    template_phase_index: defaultBlockIndex,
    template_markup: template.cardMarkup || '',
    ...(ADVANCED_TEMPLATE_STYLE[template.id] || {}),
    has_background: false,
    has_shadow: false,
    has_stroke: false,
    show_inactive: true,
    text_opacity: 1,
    position_y: DEFAULT_CAPTION_POSITION_Y,
    line_spacing: 1.25,
    word_spacing: 1,
  };
}

// Basic visual defaults are shared by both galleries and the export handoff.
const BASIC_TEMPLATE_MARKUP_OVERRIDES = {
  't-106': findAppliedBasicTemplateMarkup(originalTemplateHtml, { template_id: 't-106' }),
  't-52': findAppliedBasicTemplateMarkup(originalTemplateHtml, { template_id: 't-52' }),
  't-T4': findAppliedBasicTemplateMarkup(originalTemplateHtml, { template_id: 't-T4' }),
  't-WS1': findAppliedBasicTemplateMarkup(originalTemplateHtml, { template_id: 't-WS1' }),
};

function buildAppliedBasicTemplateStyle(template) {
  const templateMarkup = BASIC_TEMPLATE_MARKUP_OVERRIDES[template.id]
    || findAppliedBasicTemplateMarkup(originalTemplateHtml, { template_id: template.id })
    || template.cardMarkup
    || '';
  return {
    template_id: template.id,
    template_source: 'lekha-basic',
    template_class: `btcard ${template.id}`,
    template_name: template.name || template.id,
    template_layout: 'word-sequence',
    template_effect: template.desc || '',
    template_markup: templateMarkup,
    ...getBasicTemplateStyle(template.id),
    ...(BASIC_TEMPLATE_IMAN_FONT_IDS.has(template.id) ? BASIC_TEMPLATE_IMAN_FONT_STYLE : {}),
    ...(template.id === 't-110' ? { font_family: 'Noto Sans', font_size: 22 } : {}),
    has_background: BASIC_TEMPLATE_STYLES[template.id]?.has_background === true,
    has_shadow: BASIC_TEMPLATE_STYLES[template.id]?.has_shadow === true,
    has_stroke: BASIC_TEMPLATE_STYLES[template.id]?.has_stroke === true,
    show_inactive: true,
    text_opacity: 1,
    position_y: DEFAULT_CAPTION_POSITION_Y,
    line_spacing: 1.25,
    word_spacing: 1,
  };
}

const SOURCE_FALLBACK_TEMPLATE_BLOCKS = {
  t11: [{ id: 't11-b0', type: 'styled', label: 'CLUSTER' }, { id: 't11-b1', type: 'styled', label: 'BLUR FOCUS' }, { id: 't11-b2', type: 'plain', label: 'PLAIN' }, { id: 't11-b3', type: 'wbw-rise', label: 'WBW RISE' }],
  t12: [{ id: 't12-b0', type: 'styled', label: 'TYPEWRITER' }, { id: 't12-b1', type: 'styled', label: 'SLIDE-UP' }, { id: 't12-b2', type: 'wbw-rise', label: 'WBW RISE' }, { id: 't12-b3', type: 'wbw-slide', label: 'WBW SLIDE' }],
  t13: [{ id: 't13-b0', type: 'styled', label: 'STAMP IN' }, { id: 't13-b1', type: 'styled', label: 'TICKER ROLL' }, { id: 't13-b2', type: 'wbw-rise', label: 'WBW RISE' }, { id: 't13-b3', type: 'wbw-seq-fade', label: 'WBW SEQ FADE' }],
  t14: [{ id: 't14-b0', type: 'styled', label: '3D FLIP' }, { id: 't14-b1', type: 'styled', label: 'DROP BOUNCE' }, { id: 't14-b2', type: 'plain', label: 'PLAIN' }, { id: 't14-b3', type: 'wbw-rise', label: 'WBW RISE' }],
  t15: [{ id: 't15-b0', type: 'styled', label: 'SURGE IN' }, { id: 't15-b1', type: 'styled', label: 'CENTER POP' }, { id: 't15-b2', type: 'wbw-rise', label: 'WBW RISE' }, { id: 't15-b3', type: 'wbw-seq-fade', label: 'WBW SEQ FADE' }],
  t16: [{ id: 't16-b0', type: 'styled', label: 'STACK RISE' }, { id: 't16-b1', type: 'styled', label: 'NEON FLICKER' }, { id: 't16-b2', type: 'wbw-rise', label: 'WBW RISE' }, { id: 't16-b3', type: 'wbw-slide', label: 'WBW SLIDE' }],
  t17: [{ id: 't17-b0', type: 'styled', label: 'GLITCH' }, { id: 't17-b1', type: 'styled', label: 'LETTER SNAP' }, { id: 't17-b2', type: 'plain', label: 'PLAIN' }, { id: 't17-b3', type: 'wbw-rise', label: 'WBW RISE' }],
  t18: [{ id: 't18-b0', type: 'styled', label: 'SPLIT TITLE' }, { id: 't18-b1', type: 'styled', label: 'FADE REVEAL' }, { id: 't18-b2', type: 'plain', label: 'PLAIN' }, { id: 't18-b3', type: 'wbw-rise', label: 'WBW RISE' }],
  t19: [{ id: 't19-b0', type: 'styled', label: 'SLASH WIPE' }, { id: 't19-b1', type: 'styled', label: 'RISE UP' }, { id: 't19-b2', type: 'wbw-rise', label: 'WBW RISE' }, { id: 't19-b3', type: 'wbw-slide', label: 'WBW SLIDE' }],
  t20: [{ id: 't20-b0', type: 'styled', label: 'NEON DROP' }, { id: 't20-b1', type: 'styled', label: 'IMPACT SETTLE' }, { id: 't20-b2', type: 'wbw-rise', label: 'WBW RISE' }, { id: 't20-b3', type: 'wbw-slide', label: 'WBW SLIDE' }],
  t21: [{ id: 't21-b0', type: 'styled', label: 'EDITORIAL WORD REVEAL' }, { id: 't21-b1', type: 'styled', label: 'SPACING COLLAPSE' }, { id: 't21-b2', type: 'wbw-rise', label: 'WBW RISE' }, { id: 't21-b3', type: 'wbw-slide', label: 'WBW SLIDE' }],
  t22: [{ id: 't22-b0', type: 'styled', label: 'KARAOKE' }, { id: 't22-b1', type: 'styled', label: 'WAVE IN' }, { id: 't22-b2', type: 'wbw-rise', label: 'WBW RISE' }, { id: 't22-b3', type: 'wbw-slide', label: 'WBW SLIDE' }],
  t23: [{ id: 't23-b0', type: 'styled', label: 'SLIDE-RIGHT' }, { id: 't23-b1', type: 'plain', label: 'PLAIN' }, { id: 't23-b2', type: 'plain', label: 'PLAIN' }, { id: 't23-b3', type: 'styled', label: 'PUNCH POP' }],
  t24: [{ id: 't24-b0', type: 'wbw-rise', label: 'SOFT WIPE' }, { id: 't24-b1', type: 'wbw-rise', label: 'THOUGHT DRIFT' }, { id: 't24-b2', type: 'wbw-slide', label: 'MAP SLIDE' }, { id: 't24-b3', type: 'wbw-rise', label: 'MEMORY STAMP' }, { id: 't24-b4', type: 'wbw-rise', label: 'INNER REVEAL' }],
  t25: [{ id: 't25-b0', type: 'styled', label: 'HANDWRITE' }, { id: 't25-b1', type: 'styled', label: 'SOFT RISE' }, { id: 't25-b2', type: 'wbw-rise', label: 'WBW RISE' }, { id: 't25-b3', type: 'wbw-slide', label: 'WBW SLIDE' }],
  t26: [{ id: 't26-b0', type: 'wbw-rise', label: 'RAW SHUTTER' }, { id: 't26-b1', type: 'wbw-slide', label: 'STREET SNAP' }, { id: 't26-b2', type: 'wbw-rise', label: 'CONCRETE KICK' }, { id: 't26-b3', type: 'wbw-seq-fade', label: 'TAG FADE' }],
  t27: [{ id: 't27-b0', type: 'styled', label: 'CENTER EXPAND' }, { id: 't27-b1', type: 'plain', label: 'PLAIN' }, { id: 't27-b2', type: 'plain', label: 'PLAIN' }, { id: 't27-b3', type: 'wbw-rise', label: 'WBW RISE' }],
  t28: [{ id: 't28-b0', type: 'styled', label: 'GRAIN BLUR' }, { id: 't28-b1', type: 'styled', label: 'SLOW FADE' }, { id: 't28-b2', type: 'wbw-rise', label: 'WBW RISE' }, { id: 't28-b3', type: 'wbw-slide', label: 'WBW SLIDE' }],
  t29: [{ id: 't29-b0', type: 'wbw-rise', label: 'SHUTTER PUNCH' }, { id: 't29-b1', type: 'wbw-rise', label: 'RECOIL LIFT' }, { id: 't29-b2', type: 'wbw-slide', label: 'DIAGONAL CHARGE' }, { id: 't29-b3', type: 'wbw-seq-fade', label: 'CLAMP SNAP' }],
  t30: [{ id: 't30-b0', type: 'styled', label: 'BREATHE' }, { id: 't30-b1', type: 'plain', label: 'PLAIN' }, { id: 't30-b2', type: 'plain', label: 'PLAIN' }, { id: 't30-b3', type: 'plain', label: 'PLAIN' }],
  t31: [{ id: 't31-b0', type: 'styled', label: 'TYPEWRITER' }, { id: 't31-b1', type: 'styled', label: '3D FLIP' }, { id: 't31-b2', type: 'plain', label: 'PLAIN' }, { id: 't31-b3', type: 'wbw-rise', label: 'WBW RISE' }],
  t32: [{ id: 't32-b0', type: 'styled', label: 'INK WIPE' }, { id: 't32-b1', type: 'styled', label: '3D FLIP' }, { id: 't32-b2', type: 'plain', label: 'PLAIN' }, { id: 't32-b3', type: 'wbw-rise', label: 'WBW RISE' }],
  t33: [{ id: 't33-b0', type: 'styled', label: 'DOC WIPE' }, { id: 't33-b1', type: 'wbw-seq-fade', label: 'WBW SEQ FADE' }, { id: 't33-b2', type: 'karaoke', label: 'KARAOKE' }, { id: 't33-b3', type: 'wbw-rise', label: 'WBW RISE' }, { id: 't33-b4', type: 'styled', label: '3D FLIP' }],
  t34: [{ id: 't34-b0', type: 'styled', label: 'SPEED IN' }, { id: 't34-b1', type: 'styled', label: 'POW POP' }, { id: 't34-b2', type: 'wbw-rise', label: 'WBW RISE' }, { id: 't34-b3', type: 'wbw-slide', label: 'WBW SLIDE' }],
  t35: [{ id: 't35-b0', type: 'styled', label: 'SECRET REVEAL' }, { id: 't35-b1', type: 'plain', label: 'PLAIN' }, { id: 't35-b2', type: 'plain', label: 'PLAIN' }, { id: 't35-b3', type: 'plain', label: 'PLAIN' }],
};

const FALLBACK_TEMPLATE_BLOCKS = Object.fromEntries(
  Object.entries(ORIGINAL_TEMPLATE_BLOCKS).map(([templateId, blocks]) => [
    templateId,
    blocks.map((block, index) => ({
      id: `${templateId}-b${index}`,
      type: block.type,
      label: block.label || SOURCE_FALLBACK_TEMPLATE_BLOCKS[templateId]?.[index]?.label || '',
    })),
  ]),
);

const fallbackTemplateById = Object.fromEntries(FALLBACK_TEMPLATE_PACK.map((template) => [template.id, template]));

function decodeHtmlEntities(value = '') {
  return String(value)
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stripHtml(value = '') {
  return decodeHtmlEntities(String(value).replace(/<[^>]+>/g, '')).trim();
}

function replaceMarkupText(markup = '', pattern, replacementText = '') {
  return String(markup || '').replace(pattern, (...parts) => {
    const match = parts[0];
    const prefix = parts[1] || '';
    const suffix = parts[3] || parts[2] || '';
    return prefix && suffix ? `${prefix}${replacementText}${suffix}` : match;
  });
}

function extractTemplateOrder() {
  const ids = Array.from(
    sanitizedOriginalTemplateHtml.matchAll(/<div class="tcard" id="card-([^"]+)"/gi),
    ([, id]) => id,
  );
  const orderedIds = ids.length ? ids : Object.keys(ADVANCED_TEMPLATE_STYLE);
  return orderedIds.filter((id) => !REMOVED_ADVANCED_TEMPLATE_IDS.has(id));
}

function extractCardMarkup(templateId) {
  const escapedTemplateId = String(templateId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = sanitizedOriginalTemplateHtml.match(
    new RegExp(
      `<div class="tcard" id="card-${escapedTemplateId}"[^>]*>[\\s\\S]*?(?=<div class="tcard" id="card-|</div><!-- /grid -->)`,
      'i',
    ),
  );
  return match?.[0]?.trim() || '';
}

// Production CSP intentionally disallows inline scripts. The template previews
// run inside srcdoc iframes, so they inherit that policy and must still have a
// readable first frame when their animation script cannot execute.
function markPreviewBlockActive(cardMarkup, blockId) {
  if (!cardMarkup || !blockId) return cardMarkup;
  const escapedBlockId = String(blockId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return cardMarkup.replace(
    new RegExp(`(<div class="[^"]*\\bsblock\\b[^"]*)(" id="${escapedBlockId}"[^>]*>)`, 'i'),
    '$1 active$2',
  );
}

function extractTemplateBlocks(cardMarkup, templateId) {
  const matches = cardMarkup.matchAll(
    /<div class="sblock[^"]*" id="([^"]+)"[^>]*data-type="([^"]+)"[^>]*data-label="([^"]+)"/gi,
  );
  const parsedBlocks = Array.from(matches, ([, id, type, label]) => ({ id, type, label }));
  return parsedBlocks.length ? parsedBlocks : (FALLBACK_TEMPLATE_BLOCKS[templateId] || []);
}

function extractTemplateCard(templateId) {
  const fallback = fallbackTemplateById[templateId] || {
    id: templateId,
    code: templateId.toUpperCase(),
    name: templateId.toUpperCase(),
    formula: '',
    stageLabel: '',
    mood: '',
  };
  const cardMarkup = extractCardMarkup(templateId);
  if (!cardMarkup) {
    return {
      ...fallback,
      blocks: FALLBACK_TEMPLATE_BLOCKS[templateId] || [],
      cardMarkup: '',
    };
  }

  const blocks = extractTemplateBlocks(cardMarkup, templateId);
  const stageLabel = cardMarkup.match(/<span class="stage-type-label"[^>]*>([^<]+)<\/span>/i)?.[1]?.trim()
    || blocks[0]?.label
    || fallback.stageLabel;
  const originalName = decodeHtmlEntities(cardMarkup.match(/<span class="tcard-name">([^<]+)<\/span>/i)?.[1]?.trim() || fallback.name);
  // Preserve the labels supplied with the originally uploaded template cards.
  const name = originalName || fallback.name;

  return {
    ...fallback,
    code: decodeHtmlEntities(cardMarkup.match(/<span class="tcard-id">([^<]+)<\/span>/i)?.[1]?.trim() || fallback.code),
    name,
    originalName,
    formula: decodeHtmlEntities(cardMarkup.match(/<span class="formula-badge[^"]*">([^<]+)<\/span>/i)?.[1]?.trim() || fallback.formula),
    mood: decodeHtmlEntities(cardMarkup.match(/<span class="tcard-mood">([^<]+)<\/span>/i)?.[1]?.trim() || fallback.mood),
    stageLabel: decodeHtmlEntities(stageLabel),
    blocks,
    cardMarkup: replaceMarkupText(cardMarkup, /(<span class="tcard-name">)([^<]*)(<\/span>)/i, name),
  };
}

const ADVANCED_TEMPLATE_PACK = extractTemplateOrder().map(extractTemplateCard);
const TEMPLATE_BLOCKS = Object.fromEntries(
  ADVANCED_TEMPLATE_PACK.map((template) => [template.id, template.blocks || FALLBACK_TEMPLATE_BLOCKS[template.id] || []]),
);

function extractCompleteDiv(markup, startIndex) {
  const tagPattern = /<\/?div\b[^>]*>/gi;
  tagPattern.lastIndex = startIndex;
  let depth = 0;
  let match;

  while ((match = tagPattern.exec(markup))) {
    depth += match[0].startsWith('</') ? -1 : 1;
    if (depth === 0) {
      return markup.slice(startIndex, tagPattern.lastIndex);
    }
  }

  return '';
}

function extractBasicTemplateCards() {
  const cards = [];
  const cardPattern = /<div class="btcard[^"]*"/gi;
  let match;

  while ((match = cardPattern.exec(sanitizedOriginalTemplateHtml))) {
    const cardMarkup = extractCompleteDiv(sanitizedOriginalTemplateHtml, match.index);
    const name = stripHtml(cardMarkup.match(/<div class="btcard-name">([\s\S]*?)<\/div>/i)?.[1] || '');
    const desc = stripHtml(cardMarkup.match(/<div class="btcard-desc">([\s\S]*?)<\/div>/i)?.[1] || '');
    const id = cardMarkup.match(/class="[^"]*\b(t-[^"\s]+)/i)?.[1];
    const bg = cardMarkup.match(/<div class="btcard-preview"[^>]*style="[^"]*background\s*:\s*([^;"]+)/i)?.[1]?.trim() || '#111';
    if (name && id && id !== 't-124') {
      cards.push({
        id,
        code: id.replace(/^t-/, ''),
        name,
        originalName: name,
        desc,
        bg,
        cardMarkup,
      });
    }

    cardPattern.lastIndex = match.index + Math.max(cardMarkup.length, 1);
  }

  return cards;
}

const NATIVE_BASIC_TEMPLATE_PACK = extractBasicTemplateCards()
  .filter((template) => !REMOVED_BASIC_TEMPLATE_IDS.has(template.id));
const BASIC_TEMPLATES_BELOW_VELVET_IDS = new Set(
  (() => {
    const revealIndex = NATIVE_BASIC_TEMPLATE_PACK.findIndex((template) => template.id === 't-106');
    const markerIndex = NATIVE_BASIC_TEMPLATE_PACK.findIndex((template) => template.id === 't-119');
    if (revealIndex < 0 || markerIndex < 0) return [];
    return NATIVE_BASIC_TEMPLATE_PACK
      .slice(Math.min(revealIndex, markerIndex), Math.max(revealIndex, markerIndex) + 1)
      .map((template) => template.id);
  })(),
);
// Keep the first ten legacy templates (A1–B5) in the right-side library.
// Their source names carry a mis-encoded separator ("Â· The Vigil").
const MOVED_LEGACY_TEMPLATE_PACK = LEGACY_TEMPLATE_CARDS.slice(0, 10)
  .filter((template) => !REMOVED_MOVED_LEGACY_TEMPLATE_IDS.has(template.id))
  .map((template) => ({
    ...template,
    name: String(template.name || '').replace(/^\s*(?:\u00c2)?\s*\u00b7\s*/, ''),
    desc: [template.mood, template.formula].filter(Boolean).join(' · '),
  }));
// The Studio set (owner's 06_Lekha_Studio_Caption_Set) follows The Voltage
// (B5). Like the moved legacy cards it renders through the left-gallery (LC)
// pipeline, so its preview, canvas and export are unchanged.
const BASIC_TEMPLATE_PACK = [
  ...NATIVE_BASIC_TEMPLATE_PACK,
  ...MOVED_LEGACY_TEMPLATE_PACK,
  ...STUDIO_TEMPLATE_CARDS,
];
const BASIC_TEMPLATE_IMAN_FONT_STYLE = { font_family: 'Noto Sans', font_size: 24 };
const BASIC_TEMPLATE_IMAN_FONT_IDS = new Set(
  (() => {
    const imanIndex = NATIVE_BASIC_TEMPLATE_PACK.findIndex((template) => template.id === 't-106');
    return imanIndex === -1
      ? []
      : NATIVE_BASIC_TEMPLATE_PACK.slice(imanIndex + 1).map((template) => template.id);
  })(),
);
const BASIC_TEMPLATE_ACCENT_ENABLED_IDS = new Set([
  't-106', 't-52', 't-T4', 't-WS1',
  't-115', 't-104', 't-109', 't-95', 't-102', 't-103',
  't-36', 't-105', 't-110', 't-56', 't-119', 't-12',
]);
const BASIC_TEMPLATE_ACCENT_DISABLED_IDS = new Set(
  (() => {
    const imanIndex = NATIVE_BASIC_TEMPLATE_PACK.findIndex((template) => template.id === 't-106');
    return imanIndex === -1
      ? []
      : NATIVE_BASIC_TEMPLATE_PACK
        .slice(imanIndex)
        .map((template) => template.id)
        .filter((templateId) => !BASIC_TEMPLATE_ACCENT_ENABLED_IDS.has(templateId));
  })(),
);
const BASIC_TEMPLATE_ACCENT_SOURCE_FIELDS = {
  't-106': 'highlight_color',
  't-52': 'highlight_color',
  't-T4': 'highlight_color',
  't-WS1': 'highlight_color',
  't-12': 'secondary_color',
  't-56': 'secondary_color',
  't-95': 'secondary_color',
  't-102': 'highlight_color',
  't-103': 'highlight_color',
  't-104': 'secondary_color',
  't-109': 'secondary_color',
  't-110': 'secondary_color',
  't-115': 'secondary_color',
  't-119': 'secondary_color',
};

const TEMPLATE_PREVIEW_DOT_SIZE_PX = 5;
const TEMPLATE_PREVIEW_DOT_GAP_PX = 6;
const TEMPLATE_PREVIEW_DOT_STRIP_HEIGHT_PX = 30;
const TEMPLATE_PREVIEW_DOT_HIT_RADIUS_PX = 10;

function resolvePreviewDotIndex(event, dotCount = 0) {
  if (!dotCount || dotCount < 1) return -1;
  const rect = event.currentTarget?.getBoundingClientRect?.();
  if (!rect || !rect.width || !rect.height) return -1;

  const localY = event.clientY - rect.top;
  if (localY < rect.height - TEMPLATE_PREVIEW_DOT_STRIP_HEIGHT_PX) return -1;

  const localX = event.clientX - rect.left;
  const stripWidth = (dotCount * TEMPLATE_PREVIEW_DOT_SIZE_PX)
    + ((dotCount - 1) * TEMPLATE_PREVIEW_DOT_GAP_PX);
  const stripStart = (rect.width - stripWidth) / 2;

  let bestIndex = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < dotCount; index += 1) {
    const centerX = stripStart
      + (index * (TEMPLATE_PREVIEW_DOT_SIZE_PX + TEMPLATE_PREVIEW_DOT_GAP_PX))
      + (TEMPLATE_PREVIEW_DOT_SIZE_PX / 2);
    const distance = Math.abs(localX - centerX);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }

  return bestDistance <= TEMPLATE_PREVIEW_DOT_HIT_RADIUS_PX ? bestIndex : -1;
}

function postPreviewDotJump(iframeRef, dotIndex) {
  if (dotIndex < 0) return;
  iframeRef.current?.contentWindow?.postMessage(
    { type: 'lekha-template-preview-jump', index: dotIndex },
    '*',
  );
}

function getLegacyPreviewDotCount(template) {
  const markup = String(template?.cardMarkup || '');
  const dotsSection = markup.match(/<div[^>]*class="[^"]*\bdots\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  const dotSource = dotsSection?.[1] || '';
  const dotMatches = dotSource.match(/<(?:i|span)\b[^>]*>/gi);
  const blockMatches = markup.match(/class="[^"]*\b(?:sb|sblock)\b[^"]*"/gi);

  if (Array.isArray(dotMatches) && dotMatches.length > 0) return dotMatches.length;
  if (Array.isArray(blockMatches) && blockMatches.length > 0) return blockMatches.length;
  return 0;
}

function extractOriginalStyle() {
  return sanitizedOriginalTemplateHtml.match(/<style>([\s\S]*?)<\/style>/i)?.[1] || '';
}

function buildTemplateColorPreviewCss(templateId, previewStyle = {}, { basic = false } = {}) {
  const normalizedTemplateId = String(templateId || '').trim();
  const basicFixedHighlightTemplate = ['t-106', 't-52', 't-T4', 't-WS1'].includes(normalizedTemplateId);
  const basicShadowHighlightTemplate = ['t-104', 't-109'].includes(normalizedTemplateId);
  const alwaysSyncSourceColor = normalizedTemplateId === 't22'
    || normalizedTemplateId === 't28'
    || normalizedTemplateId === 't33'
    || normalizedTemplateId === 't34'
    || normalizedTemplateId === 't36'
    || normalizedTemplateId === 't37'
    || normalizedTemplateId === 't38'
    || normalizedTemplateId === 't39'
    || normalizedTemplateId === 't40'
    || normalizedTemplateId === 't-106'
    || normalizedTemplateId === 't-52'
    || normalizedTemplateId === 't-T4'
    || normalizedTemplateId === 't-WS1';
  if (!previewStyle?.template_color_customized && !alwaysSyncSourceColor) return '';
  const palette = getTemplatePalette(previewStyle, ADVANCED_TEMPLATE_STYLE[templateId] || BASIC_TEMPLATE_STYLES[templateId] || {});
  const highlight = normalizeColor(
    previewStyle.highlight_color
      || ADVANCED_TEMPLATE_STYLE[templateId]?.highlight_color
      || BASIC_TEMPLATE_STYLES[templateId]?.highlight_color
      || palette.accent,
    palette.accent,
  );
  const karaokeColor1 = normalizeColor(previewStyle.karaoke_color_1 || ADVANCED_TEMPLATE_STYLE[templateId]?.karaoke_color_1, '#DDAA03');
  const karaokeColor2 = normalizeColor(previewStyle.karaoke_color_2 || ADVANCED_TEMPLATE_STYLE[templateId]?.karaoke_color_2, '#22D3EE');
  const karaokeColor3 = normalizeColor(previewStyle.karaoke_color_3 || ADVANCED_TEMPLATE_STYLE[templateId]?.karaoke_color_3, '#FB923C');
  if (basic) {
    return `
    .btcard {
      --template-primary: ${palette.text};
      --template-secondary: ${palette.accent};
      --template-highlight: ${highlight};
      --template-bg: ${palette.background};
      color: ${palette.text} !important;
    }
    .btcard [class^="t-"],
    .btcard [class*=" t-"] {
      --template-primary: ${palette.text} !important;
      --template-secondary: ${palette.accent} !important;
      --template-highlight: ${highlight} !important;
      --template-bg: ${palette.background} !important;
    }
    .btcard .word:not(.imp):not(.current),
    .btcard .bt-cap-block,
    .btcard .bt-preview-text {
      color: ${palette.text} !important;
      -webkit-text-fill-color: ${palette.text} !important;
    }
    ${basicShadowHighlightTemplate ? '' : `
    .btcard .word.imp,
    .btcard .imp,
    .btcard [data-imp="true"]${basicFixedHighlightTemplate ? '' : `,
    .btcard .word.current`} {
      color: ${highlight} !important;
      -webkit-text-fill-color: ${highlight} !important;
    }`}
    ${previewStyle.has_background ? `.btcard-preview { background: ${palette.background} !important; }` : ''}
  `;
  }

  const selector = `#card-${templateId} .sblock`;
  return `
    #card-${templateId} {
      --template-primary: ${palette.text};
      --template-secondary: ${palette.accent};
      --template-highlight: ${highlight};
      --template-bg: ${palette.background};
      --cyan: ${palette.accent};
      --gold: ${palette.accent};
      --rose: ${palette.accent};
      --green: ${palette.accent};
      --purple: ${palette.accent};
      --template-karaoke-1: ${karaokeColor1};
      --template-karaoke-2: ${karaokeColor2};
      --template-karaoke-3: ${karaokeColor3};
    }
    ${previewStyle.has_background ? `#card-${templateId} .stage { background: ${palette.background} !important; }` : ''}
    ${selector},
    ${selector} .lekha-template-fit,
    ${selector} .w:not([data-imp="true"]),
    ${selector} .kf-base,
    ${selector} .cluster-row-top,
    ${selector} .cluster-row-bot,
    ${selector} .blur-txt {
      color: ${palette.text} !important;
      -webkit-text-fill-color: ${palette.text} !important;
    }
    ${selector} .w[data-imp="true"],
    ${selector} [data-imp="true"],
    ${selector} .is-emphasis,
    ${selector} .imp-bold,
    ${selector} .imp-gold,
    ${selector} .imp-rose,
    ${selector} .imp-cyan,
    ${selector} .imp-green,
    ${selector} .imp-purple,
    ${selector} .imp-orange,
    ${selector} .imp-italic,
    ${selector} .imp-weight,
    ${selector} .imp-space,
    ${selector} .imp-flicker,
    ${selector} .imp-typewrite,
    ${selector} .imp-underline,
    ${selector} .still-frames-highlight,
    ${selector} .kf-fill {
      color: ${palette.accent} !important;
      -webkit-text-fill-color: ${palette.accent} !important;
      ${isKeyframeAdvancedTemplateId(templateId) ? '' : `text-shadow: 0 0 12px ${palette.accent}66 !important;`}
    }
    ${templateId === 't36' ? `
    #card-t36 .kf-base {
      color: #FFFFFF !important;
      -webkit-text-fill-color: #FFFFFF !important;
      opacity: 1 !important;
      text-shadow: none !important;
    }
    #card-t36 #t36-b0 .kf-fill {
      color: var(--template-karaoke-1, #DDAA03) !important;
      -webkit-text-fill-color: var(--template-karaoke-1, #DDAA03) !important;
    }
    #card-t36 #t36-b1 .kf-fill {
      color: var(--template-karaoke-2, #22D3EE) !important;
      -webkit-text-fill-color: var(--template-karaoke-2, #22D3EE) !important;
    }
    #card-t36 #t36-b2 .kf-fill {
      color: var(--template-karaoke-3, #FB923C) !important;
      -webkit-text-fill-color: var(--template-karaoke-3, #FB923C) !important;
    }
    ` : ''}
    ${templateId === 't23' ? `
    ${selector} .t23-b3 .punch-txt .imp-bold,
    ${selector} .t23-b3 .punch-txt .imp-gold,
    ${selector} .t23-b3 .punch-txt .is-emphasis {
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      text-shadow: 0 1px 8px rgba(0,0,0,0.55), 0 0 12px rgba(255,255,255,0.36) !important;
    }
    ` : ''}
    ${templateId === 't25' ? `
    ${selector} .wbw-rise,
    ${selector} .wbw-slide {
      display: inline-flex !important;
      flex-wrap: wrap !important;
      align-items: baseline !important;
      justify-content: center !important;
      column-gap: 0.28em !important;
      row-gap: 0.12em !important;
    }
    ${selector} .w {
      margin-right: 0 !important;
    }
    ${selector} .imp-italic,
    ${selector} .imp-rose,
    ${selector} .w[data-imp="true"],
    ${selector} .is-emphasis {
      color: ${palette.accent} !important;
      -webkit-text-fill-color: ${palette.accent} !important;
    }
    ` : ''}
    ${templateId === 't39' ? `
    #card-t39 .stage {
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      overflow: hidden !important;
    }
    #card-t39 .sblock,
    #card-t39 .t39-block {
      font-size: 0.94rem !important;
      line-height: 1.4 !important;
      max-width: min(100%, 12em) !important;
      text-align: center !important;
      margin: 0 auto !important;
    }
    #card-t39 .wbw-seq-fade {
      display: inline-flex !important;
      flex-wrap: wrap !important;
      align-items: baseline !important;
      justify-content: center !important;
      column-gap: 0.24em !important;
      row-gap: 0.06em !important;
      max-width: min(100%, 12em) !important;
      white-space: normal !important;
      overflow-wrap: normal !important;
      word-break: normal !important;
      text-align: center !important;
      margin: 0 auto !important;
    }
    #card-t39 .w {
      margin-right: 0 !important;
    }
    #card-t39 .imp-gold,
    #card-t39 .imp-rose,
    #card-t39 .imp-italic,
    #card-t39 .imp-weight,
    #card-t39 .w[data-imp="true"],
    #card-t39 .w[data-imp-cls],
    #card-t39 .is-emphasis {
      color: ${palette.accent} !important;
      -webkit-text-fill-color: ${palette.accent} !important;
      text-shadow: 0 0 12px ${palette.accent}66 !important;
    }
    ` : ''}
    ${templateId === 't37' ? `
    ${selector},
    ${selector} * {
      -webkit-text-stroke: 0 transparent !important;
      text-shadow: none !important;
    }
    ` : ''}
    ${selector} .imp-underline::after,
    ${selector} .w[data-imp="true"].imp-underline::after {
      background: ${palette.accent} !important;
    }
  `;
}

const iframeOverrides = (templateId, previewStyle = {}) => `
  <style>
    ${ADVANCED_TEMPLATE_RUNTIME_CSS}

    html, body {
      width: 100%;
      min-height: 0;
      margin: 0;
      padding: 0;
      overflow: hidden;
      background: transparent !important;
    }
    #card-${templateId} {
      display: flex !important;
      width: 100% !important;
      min-width: 0 !important;
      height: 280px !important;
      border-radius: 12px !important;
      background: #0e0e12 !important;
    }
    #card-${templateId} .tcard-meta {
      display: none !important;
    }
    #card-${templateId} .stage {
      height: 258px !important;
      border-radius: 0 !important;
    }
    #card-${templateId} .sblock {
      padding: 18px 20px !important;
      visibility: hidden !important;
      opacity: 0 !important;
      z-index: 0 !important;
      transition: opacity 220ms ease !important;
    }
    #card-${templateId} .sblock.active {
      visibility: visible !important;
      opacity: 1 !important;
      z-index: 2 !important;
    }
    /* The deployed app CSP blocks inline scripts inside srcdoc previews. Keep
       the initial authored caption readable until a script can take over. */
    html:not(.template-preview-script-ready) #card-${templateId} .sblock.active,
    html:not(.template-preview-script-ready) #card-${templateId} .sblock.active * {
      visibility: visible !important;
      opacity: 1 !important;
      animation: none !important;
      transition: none !important;
      transform: none !important;
      clip-path: none !important;
    }
    #card-${templateId} .prog-dots {
      height: 22px !important;
      padding: 5px 0 7px !important;
      background: #0e0e12 !important;
      border-top: 1px solid rgba(255,255,255,0.08) !important;
    }
    #card-${templateId} .prog-dots .dot {
      cursor: pointer !important;
    }
    #card-${templateId} .stage-type-label {
      bottom: 9px !important;
      right: 10px !important;
      color: rgba(255,255,255,0.38) !important;
    }
    #card-t11 .t11-b0 .cluster-wrap {
      gap: 0.14em !important;
    }
    #card-t11 .t11-b0 .cluster-row-top,
    #card-t11 .t11-b0 .cluster-row-bot {
      font-size: 1.16rem !important;
    }
    #card-t11 .t11-b0 .cluster-hl {
      font-size: 2.1rem !important;
      transform: scale(0.9) !important;
      line-height: 0.88 !important;
    }
    #card-t13 .t13-b0 .slide-crash,
    #card-t13 .t13-b1 .ticker-txt {
      display: inline-flex !important;
      flex-wrap: wrap !important;
      justify-content: center !important;
      align-items: center !important;
      max-width: min(100%, 12.2em) !important;
      white-space: normal !important;
      overflow-wrap: anywhere !important;
      word-break: break-word !important;
      text-align: center !important;
      line-height: 1.12 !important;
      margin-left: auto !important;
      margin-right: auto !important;
    }
    #card-t13 .t13-b0 .slide-crash {
      font-size: 1.12rem !important;
      letter-spacing: 0.03em !important;
      text-transform: none !important;
    }
    #card-t13 .t13-b1 .ticker-txt {
      font-size: 0.98rem !important;
      letter-spacing: 0.06em !important;
    }
    ${buildTemplateColorPreviewCss(templateId, previewStyle)}
  </style>
`;

function buildTemplatePreviewDoc(templateId, options = {}) {
  const cardMarkup = extractCardMarkup(templateId);
  const blocks = TEMPLATE_BLOCKS[templateId] || [];
  const rawPhaseIndex = Number(options.activePhaseIndex);
  const initialBlockIndex = blocks.length && Number.isFinite(rawPhaseIndex)
    ? ((Math.trunc(rawPhaseIndex) % blocks.length) + blocks.length) % blocks.length
    : 0;
  const lockToPhase = Boolean(options.lockToPhase && blocks.length);
  const previewCardMarkup = markPreviewBlockActive(cardMarkup, blocks[initialBlockIndex]?.id);
  const appliedPreviewCaption = {
    text: String(options.captionText || '').trim(),
    impWordIndex: Number.isFinite(Number(options.impWordIndex)) ? Math.trunc(Number(options.impWordIndex)) : -1,
    emphasisColor: resolveAdvancedTemplateEmphasisColor(templateId, options.emphasisColor || '', initialBlockIndex),
  };
  // Keep the exact authored sequencer in production as well. A simplified
  // runtime made the cards render but dropped each template's real motion.
  // It lives in src/assets/template-preview/ so the CSP can allow it by hash.
  const previewScript = previewConfigScript({
    templateId,
    timing: ADVANCED_TEMPLATE_PREVIEW_TIMING,
    initialBlockIndex,
    lockToPhase,
    keyframeTemplate: isKeyframeAdvancedTemplateId(templateId),
    appliedPreview: appliedPreviewCaption,
    impEntrances: ADVANCED_IMP_ENTRANCES,
    blocks,
  }) + ADVANCED_PREVIEW_SCRIPT;

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <style>${extractOriginalStyle()}</style>
        ${iframeOverrides(templateId, options.previewStyle || {})}
      </head>
      <body>${previewCardMarkup}${previewScript}</body>
    </html>
  `;
}

const basicIframeOverrides = `
  <style>
    html, body {
      width: 100%;
      min-height: 0;
      margin: 0;
      padding: 0;
      overflow: hidden;
      background: transparent !important;
    }
    .btcard {
      display: flex !important;
      width: 100% !important;
      min-width: 0 !important;
      height: 280px !important;
      border-radius: 12px !important;
      background: #0e0e12 !important;
      transform: none !important;
      box-shadow: none !important;
    }
    .btcard-info {
      display: none !important;
    }
    .btcard-preview {
      height: 258px !important;
      border-radius: 0 !important;
    }
    .bt-prog-dots {
      height: 22px !important;
      padding: 5px 0 7px !important;
      background: #0e0e12 !important;
      border-top: 1px solid rgba(255,255,255,0.08) !important;
    }
    .bt-prog-dots .dot {
      cursor: pointer !important;
    }
    .btcard-preview .t-104 .word.current,
    .btcard-preview .t-104 .word.imp.current {
      color: var(--template-primary, #fff) !important;
      -webkit-text-fill-color: var(--template-primary, #fff) !important;
      -webkit-text-stroke: 2px var(--template-secondary, #B28DFF) !important;
      text-shadow: 0 0 6px var(--template-secondary, #2563EB),
        0 0 12px var(--template-secondary, #2563EB) !important;
      filter: drop-shadow(1px 1px 2px rgba(0, 0, 0, .75))
        drop-shadow(0 0 8px var(--template-secondary, #2563EB)) !important;
    }
    .btcard-preview .t-109 .word.current,
    .btcard-preview .t-109 .word.imp.current {
      text-shadow: 3px 3px 0 var(--template-secondary, #FF4500) !important;
      filter: none !important;
    }
    .btcard-preview .t-109 .word.current {
      color: var(--template-primary, #fff) !important;
      -webkit-text-fill-color: var(--template-primary, #fff) !important;
    }
    .btcard-preview .t-109 .word.imp.current {
      color: var(--template-primary, #fff) !important;
      -webkit-text-fill-color: var(--template-primary, #fff) !important;
    }
    .btcard-preview .t-110 .cap-text {
      font-size: 22px !important;
    }
  </style>
`;

function buildBasicTemplatePreviewDoc(template, options = {}) {
  // Basic cards also retain their source timing and word treatment in the
  // production preview rather than falling back to a generic cycle.
  const previewScript = previewConfigScript({
    templateId: template.id,
    timing: BASIC_TEMPLATE_PREVIEW_TIMING,
  }) + BASIC_PREVIEW_SCRIPT;

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <style>${extractOriginalStyle()}</style>
        ${basicIframeOverrides}
        <style>${buildTemplateColorPreviewCss(template.id, options.previewStyle || {}, { basic: true })}</style>
      </head>
      <body>${template.cardMarkup}${previewScript}</body>
    </html>
  `;
}

function TemplatePreviewFrame({ template, previewStyle }) {
  // Lazy-mount the script-running preview iframe once the card scrolls into
  // view — see useLazyVisible.
  const iframeRef = useRef(null);
  const [frameRef, shown] = useLazyVisible();
  const palette = getTemplatePalette(previewStyle, ADVANCED_TEMPLATE_STYLE[template.id] || {});
  const srcDoc = useMemo(
    () => (shown ? buildTemplatePreviewDoc(template.id, { previewStyle }) : ''),
    // Only the colours the preview shows rebuild the iframe; other style
    // fields changing must not reload every card.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      template.id,
      shown,
      previewStyle?.template_color_customized,
      previewStyle?.karaoke_color_1,
      previewStyle?.karaoke_color_2,
      previewStyle?.karaoke_color_3,
      palette.text,
      palette.accent,
      palette.background,
    ],
  );
  const handlePreviewClick = useCallback((event) => {
    const dotIndex = resolvePreviewDotIndex(event, template.blocks?.length || 0);
    if (dotIndex < 0) return;
    event.preventDefault();
    event.stopPropagation();
    postPreviewDotJump(iframeRef, dotIndex);
  }, [template.blocks]);

  return (
    <div ref={frameRef} className="advanced-template-preview-frame" onClick={handlePreviewClick}>
      {shown && (
        <iframe
          ref={iframeRef}
          title={`${template.code} preview`}
          srcDoc={srcDoc}
          sandbox="allow-scripts"
          scrolling="no"
          style={{ pointerEvents: 'none' }}
        />
      )}
    </div>
  );
}

function BasicTemplatePreviewFrame({ template, onSelect, previewStyle }) {
  const iframeRef = useRef(null);
  const [containerRef, shown] = useLazyVisible();
  const palette = getTemplatePalette(previewStyle, BASIC_TEMPLATE_STYLES[template.id] || {});
  const srcDoc = useMemo(
    () => (shown ? buildBasicTemplatePreviewDoc(template, { previewStyle }) : ''),
    // Only the colours the preview shows rebuild the iframe (see above).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [template, shown, previewStyle?.template_color_customized, palette.text, palette.accent, palette.background],
  );
  const dotCount = useMemo(() => {
    const dotMatches = String(template.cardMarkup || '').match(/class="dot(?:\s|")/g);
    return dotMatches?.length || 0;
  }, [template.cardMarkup]);
  const handlePreviewClick = useCallback((event) => {
    const dotIndex = resolvePreviewDotIndex(event, dotCount);
    if (dotIndex < 0) return;
    event.preventDefault();
    event.stopPropagation();
    onSelect?.();
    postPreviewDotJump(iframeRef, dotIndex);
  }, [dotCount, onSelect]);

  return (
    <div ref={containerRef} className="advanced-template-preview-frame" onClick={handlePreviewClick}>
      {shown && (
        <iframe
          ref={iframeRef}
          title={`${template.name} preview`}
          srcDoc={srcDoc}
          sandbox="allow-scripts"
          scrolling="no"
          style={{ pointerEvents: 'none' }}
        />
      )}
    </div>
  );
}

function MovedLegacyBasicTemplateCard({
  template,
  isActive,
  templateIsFavorite,
  currentStyle,
  previewStyle,
  defaultStyle,
  onApplyTemplate,
  onUpdateTemplate,
  onToggleFavorite,
}) {
  const baseDotCount = useMemo(() => getLegacyPreviewDotCount(template), [template]);
  const [jumpRequest, setJumpRequest] = useState({ phase: 0, token: 0 });
  const [previewProgress, setPreviewProgress] = useState({
    activeIndex: 0,
    total: baseDotCount,
  });
  const totalDots = Math.max(baseDotCount, previewProgress?.total || 0);
  const activeDotIndex = Math.min(previewProgress?.activeIndex || 0, Math.max(totalDots - 1, 0));
  const requestPreviewPhase = (index) => {
    // Scene dots now choose the starting point for the applied sequence too.
    onApplyTemplate?.({ template_phase_override: index });
    setJumpRequest((state) => ({ phase: index, token: state.token + 1 }));
    setPreviewProgress({ activeIndex: index, total: totalDots });
  };

  return (
    <div className={`advanced-template-card-shell ${isActive ? 'is-active' : ''}`}>
      <button
        type="button"
        title={templateIsFavorite ? 'Remove from favorites' : 'Add to favorites'}
        aria-label={templateIsFavorite ? 'Remove from favorites' : 'Add to favorites'}
        onClick={(event) => {
          event.stopPropagation();
          onToggleFavorite?.();
        }}
        className={`advanced-template-favorite-button ${templateIsFavorite ? 'is-active' : ''}`}
      >
        <Star className="h-3.5 w-3.5" fill={templateIsFavorite ? 'currentColor' : 'none'} />
      </button>
      <div
        data-template-card-id={template.id}
        data-template-kind="basic-legacy"
        aria-pressed={isActive}
        onClick={() => onApplyTemplate?.()}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          onApplyTemplate?.();
        }}
        className={`advanced-template-card basic-template-card ${isActive ? 'is-active' : ''}`}
        role="button"
        tabIndex={0}
      >
        <LegacyTemplatePreviewFrame
          template={template}
          jumpRequest={jumpRequest}
          onProgressChange={setPreviewProgress}
        />
        {isActive && <Check className="absolute right-11 top-2 z-10 h-3.5 w-3.5 text-[#ffb629]" />}
        <div className="advanced-template-card-body">
          <div className="advanced-template-card-title">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#ffb629]" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate">{template.name}</p>
                {totalDots > 0 && (
                  <div className="flex shrink-0 items-center gap-1.5">
                    {Array.from({ length: totalDots }).map((_, index) => (
                      <button
                        type="button"
                        key={`${template.id}-legacy-dot-${index}`}
                        aria-label={`Use template scene ${index + 1}`}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          requestPreviewPhase(index);
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== 'Enter' && event.key !== ' ') return;
                          event.preventDefault();
                          event.stopPropagation();
                          requestPreviewPhase(index);
                        }}
                        className={`h-[5px] w-[5px] rounded-full border-0 p-0 transition-all cursor-pointer ${
                          index === activeDotIndex ? 'scale-125 bg-white' : 'bg-white/25'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
              {template.desc && <span>{template.desc}</span>}
            </div>
          </div>
        </div>
      </div>
      {isActive && (
        <TemplateCustomizationPanel
          currentStyle={previewStyle}
          defaultStyle={defaultStyle}
          onUpdate={onUpdateTemplate}
        />
      )}
    </div>
  );
}

function BasicTemplateCard({
  template,
  currentStyle,
  isFavorite,
  onToggleFavorite,
  onApplyTemplate,
}) {
  const isMovedLegacyTemplate = template.format === 'legacy' || template.format === 'lc';
  const isActive = isMovedLegacyTemplate
    ? currentStyle?.template_20_id === template.id
    : currentStyle?.template_id === template.id;
  const defaultStyle = isMovedLegacyTemplate
    ? buildLegacyTemplateStyle(template)
    : buildAppliedBasicTemplateStyle(template);
  const previewStyle = isActive ? { ...defaultStyle, ...currentStyle } : defaultStyle;
  const applyBasicTemplate = (patch = {}) => onApplyTemplate?.({ ...defaultStyle, ...patch });
  const updateBasicTemplate = (patch) => onApplyTemplate?.({ ...defaultStyle, ...currentStyle, ...patch });

  if (isMovedLegacyTemplate) {
    return (
      <MovedLegacyBasicTemplateCard
        template={template}
        isActive={isActive}
        templateIsFavorite={isFavorite}
        currentStyle={currentStyle}
        previewStyle={previewStyle}
        defaultStyle={defaultStyle}
        onApplyTemplate={applyBasicTemplate}
        onUpdateTemplate={updateBasicTemplate}
        onToggleFavorite={onToggleFavorite}
      />
    );
  }

  return (
    <div className={`advanced-template-card-shell ${isActive ? 'is-active' : ''}`}>
      <button
        type="button"
        title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        onClick={(event) => {
          event.stopPropagation();
          onToggleFavorite?.();
        }}
        className={`advanced-template-favorite-button ${isFavorite ? 'is-active' : ''}`}
      >
        <Star className="h-3.5 w-3.5" fill={isFavorite ? 'currentColor' : 'none'} />
      </button>
      <button
        type="button"
        data-template-card-id={template.id}
        data-template-kind="basic"
        aria-pressed={isActive}
        onClick={() => applyBasicTemplate()}
        className={`advanced-template-card basic-template-card ${isActive ? 'is-active' : ''}`}
      >
        <BasicTemplatePreviewFrame template={template} onSelect={applyBasicTemplate} previewStyle={previewStyle} />
        {isActive && <Check className="absolute right-11 top-2 z-10 h-3.5 w-3.5 text-[#ffb629]" />}
        <div className="advanced-template-card-body">
          <div className="advanced-template-card-title">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#ffb629]" />
            <div className="min-w-0">
              <p>{template.name}</p>
              {template.desc && <span>{template.desc}</span>}
            </div>
          </div>
        </div>
      </button>
      {isActive && (
        <TemplateCustomizationPanel
          currentStyle={previewStyle}
          defaultStyle={defaultStyle}
          onUpdate={updateBasicTemplate}
          hideAccent={BASIC_TEMPLATE_ACCENT_DISABLED_IDS.has(template.id)}
        />
      )}
    </div>
  );
}

function TemplateColorInput({ label, value, defaultValue, onChange, onReset }) {
  const color = normalizeColor(value, defaultValue || '#FFFFFF');
  return (
    <div className="template-color-row">
      <span>{label}</span>
      <div className="template-color-control">
        <label className="template-color-swatch" style={{ backgroundColor: color }}>
          <input
            type="color"
            value={color}
            onChange={(event) => onChange(event.target.value)}
            aria-label={`${label} color`}
          />
        </label>
        <span className="template-color-hash">#</span>
        <input
          key={color}
          className="template-color-hex"
          defaultValue={color.replace('#', '')}
          onChange={(event) => {
            const raw = event.target.value.replace(/[^0-9a-f]/gi, '').slice(0, 6);
            if (raw.length === 6) onChange(`#${raw}`);
          }}
          aria-label={`${label} hex`}
        />
        <button type="button" onClick={onReset} aria-label={`Reset ${label}`}>
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function TemplateCustomizationPanel({ currentStyle, defaultStyle, onUpdate, hideAccent = false }) {
  const palette = getTemplatePalette(currentStyle, defaultStyle);
  const defaultPalette = getTemplatePalette(defaultStyle, defaultStyle);
  const updateColor = (field, color) => onUpdate(getTemplateCustomizationPatch(field, color, currentStyle));
  const isKaraokeFill = currentStyle?.template_id === 't36' || defaultStyle?.template_id === 't36';
  const showBackground = Boolean(
    currentStyle?.has_background
      || defaultStyle?.has_background
      || currentStyle?.background_color
      || defaultStyle?.background_color,
  );

  return (
    <div className="template-customization-panel" onClick={(event) => event.stopPropagation()}>
      <div className="template-customization-section">
        <p>Customize</p>
        {!isKaraokeFill && (
          <TemplateColorInput
            label="Text"
            value={palette.text}
            defaultValue={defaultPalette.text}
            onChange={(color) => updateColor('text', color)}
            onReset={() => updateColor('text', defaultPalette.text)}
          />
        )}
        {isKaraokeFill ? (
          <>
            <TemplateColorInput
              label="Fill 1"
              value={currentStyle?.karaoke_color_1 || palette.accent}
              defaultValue={defaultStyle?.karaoke_color_1 || defaultPalette.accent}
              onChange={(color) => updateColor('karaoke1', color)}
              onReset={() => updateColor('karaoke1', defaultStyle?.karaoke_color_1 || defaultPalette.accent)}
            />
            <TemplateColorInput
              label="Fill 2"
              value={currentStyle?.karaoke_color_2 || defaultStyle?.karaoke_color_2 || '#22D3EE'}
              defaultValue={defaultStyle?.karaoke_color_2 || '#22D3EE'}
              onChange={(color) => updateColor('karaoke2', color)}
              onReset={() => updateColor('karaoke2', defaultStyle?.karaoke_color_2 || '#22D3EE')}
            />
            <TemplateColorInput
              label="Fill 3"
              value={currentStyle?.karaoke_color_3 || defaultStyle?.karaoke_color_3 || '#FB923C'}
              defaultValue={defaultStyle?.karaoke_color_3 || '#FB923C'}
              onChange={(color) => updateColor('karaoke3', color)}
              onReset={() => updateColor('karaoke3', defaultStyle?.karaoke_color_3 || '#FB923C')}
            />
          </>
        ) : !hideAccent ? (
          <TemplateColorInput
            label="Accent"
            value={palette.accent}
            defaultValue={defaultPalette.accent}
            onChange={(color) => updateColor('accent', color)}
            onReset={() => updateColor('accent', defaultPalette.accent)}
          />
        ) : null
        }
        {showBackground && (
          <TemplateColorInput
            label="Background"
            value={palette.background}
            defaultValue={defaultPalette.background}
            onChange={(color) => updateColor('background', color)}
            onReset={() => updateColor('background', defaultPalette.background)}
          />
        )}
      </div>
    </div>
  );
}

export default function AdvancedTemplateLibrary({
  currentStyle,
  onApplyTemplate,
  onBack,
  showHeader = true,
  showBackButton = true,
}) {
  const [templateSearchQuery, setTemplateSearchQuery] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [recentsOnly, setRecentsOnly] = useState(false);
  const { isFavorite, toggleFavorite } = useTemplateFavorites();
  const { isRecent } = useRecentTemplates();
  const visibleAdvancedTemplates = useMemo(
    () => ADVANCED_TEMPLATE_PACK.filter((template) => (
      isExportableTemplateCandidate(template)
      && templateMatchesQuery(template, templateSearchQuery)
      && (!favoritesOnly || isFavorite('advanced-template', template.id))
      && (!recentsOnly || isRecent('advanced-template', template.id))
    )),
    [templateSearchQuery, favoritesOnly, isFavorite, recentsOnly, isRecent],
  );
  const visibleBasicTemplates = useMemo(
    () => BASIC_TEMPLATE_PACK.filter((template) => {
      const storageKind = (template.format === 'legacy' || template.format === 'lc') ? 'sidebar-template' : 'basic-template';
      return isExportableTemplateCandidate(template)
        && templateMatchesQuery(template, templateSearchQuery)
        && (!favoritesOnly || isFavorite(storageKind, template.id))
        && (!recentsOnly || isRecent(storageKind, template.id));
    }),
    [templateSearchQuery, favoritesOnly, isFavorite, recentsOnly, isRecent],
  );
  const velvetBasicTemplates = visibleBasicTemplates.filter((template) => (
    BASIC_TEMPLATES_BELOW_VELVET_IDS.has(template.id)
  ));
  const remainingBasicTemplates = visibleBasicTemplates.filter((template) => (
    !BASIC_TEMPLATES_BELOW_VELVET_IDS.has(template.id)
  ));
  const velvetIsVisible = visibleAdvancedTemplates.some((template) => template.id === 't12');
  const renderBasicTemplateCard = (template) => {
    const storageKind = (template.format === 'legacy' || template.format === 'lc') ? 'sidebar-template' : 'basic-template';
    return (
      <BasicTemplateCard
        key={`basic-${template.id}-${template.name}`}
        template={template}
        currentStyle={currentStyle}
        isFavorite={isFavorite(storageKind, template.id)}
        onToggleFavorite={() => toggleFavorite(storageKind, template.id)}
        onApplyTemplate={onApplyTemplate}
      />
    );
  };

  return (
    <div className="h-full flex flex-col text-white">
      {showHeader && (
        <div className="advanced-template-library-header">
          <div>
            <p className="text-[10px] uppercase tracking-[0.32em] text-slate-400">Templates</p>
            <h2>Template Library</h2>
          </div>
          <span>Source HTML</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto pr-1 space-y-3">
        <div className="advanced-template-browser-controls">
          <label className="advanced-template-search">
            <Search className="h-3.5 w-3.5" />
            <input
              value={templateSearchQuery}
              onChange={(event) => setTemplateSearchQuery(event.target.value)}
              placeholder="Search templates"
            />
          </label>
          <button
            type="button"
            aria-pressed={favoritesOnly}
            title="Show favorites"
            onClick={() => setFavoritesOnly((current) => !current)}
            className={`advanced-template-favorites-filter ${favoritesOnly ? 'is-active' : ''}`}
          >
            <Star className="h-3.5 w-3.5" fill={favoritesOnly ? 'currentColor' : 'none'} />
          </button>
          <button
            type="button"
            aria-pressed={recentsOnly}
            title="Show recently used"
            onClick={() => setRecentsOnly((current) => !current)}
            className={`advanced-template-favorites-filter ${recentsOnly ? 'is-active' : ''}`}
          >
            <History className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="advanced-template-section-label">
          <span>Advanced Templates</span>
          <small>{visibleAdvancedTemplates.length}/{ADVANCED_TEMPLATE_PACK.length}</small>
        </div>
        {visibleAdvancedTemplates.map((template) => {
          const isActive = currentStyle?.template_id === template.id;
          const templateIsFavorite = isFavorite('advanced-template', template.id);
          const defaultStyle = buildAppliedTemplateStyle(template);
          const previewStyle = isActive ? { ...defaultStyle, ...currentStyle } : defaultStyle;
          const applyTemplate = () => onApplyTemplate?.(defaultStyle);
          const updateTemplate = (patch) => onApplyTemplate?.({ ...defaultStyle, ...currentStyle, ...patch });

          return (
            <Fragment key={template.id}>
              <div
              className={`advanced-template-card-shell ${isActive ? 'is-active' : ''}`}
            >
              <button
                type="button"
                title={templateIsFavorite ? 'Remove from favorites' : 'Add to favorites'}
                aria-label={templateIsFavorite ? 'Remove from favorites' : 'Add to favorites'}
                onClick={(event) => {
                  event.stopPropagation();
                  toggleFavorite('advanced-template', template.id);
                }}
                className={`advanced-template-favorite-button ${templateIsFavorite ? 'is-active' : ''}`}
              >
                <Star className="h-3.5 w-3.5" fill={templateIsFavorite ? 'currentColor' : 'none'} />
              </button>
              <button
                type="button"
                data-template-card-id={template.id}
                data-template-kind="advanced"
                aria-pressed={isActive}
                onClick={applyTemplate}
                className={`advanced-template-card ${isActive ? 'is-active' : ''}`}
              >
                <TemplatePreviewFrame template={template} previewStyle={previewStyle} />
                {isActive && <Check className="absolute right-11 top-2 z-10 h-3.5 w-3.5 text-[#ffb629]" />}
                <div className="advanced-template-card-body">
                  <div className="advanced-template-card-title">
                    <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#ffb629]" />
                    <div className="min-w-0">
                      <p>{template.name}</p>
                      {template.mood && <span>{template.mood}</span>}
                    </div>
                  </div>
                </div>
              </button>
              {isActive && (
                <TemplateCustomizationPanel
                  currentStyle={previewStyle}
                  defaultStyle={defaultStyle}
                  onUpdate={updateTemplate}
                />
              )}
              </div>
              {template.id === 't12' && velvetBasicTemplates.length > 0 && (
                velvetBasicTemplates.map(renderBasicTemplateCard)
              )}
            </Fragment>
          );
        })}
        {!visibleAdvancedTemplates.length && (
          <div className="advanced-template-empty-state">No matching advanced templates.</div>
        )}

        {!velvetIsVisible && velvetBasicTemplates.length > 0 && (
          velvetBasicTemplates.map(renderBasicTemplateCard)
        )}
        {remainingBasicTemplates.map(renderBasicTemplateCard)}
        {!visibleBasicTemplates.length && (
          <div className="advanced-template-empty-state">No matching basic templates.</div>
        )}
      </div>

      {showBackButton && onBack && (
        <button
          type="button"
          data-caption-editor-nav="true"
          onClick={onBack}
          className="mt-4 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white hover:bg-white/[0.08]"
        >
          Back to Captions
        </button>
      )}
    </div>
  );
}
