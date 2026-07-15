import { useCallback, useMemo, useRef, useState } from 'react';
import { useLazyVisible } from './useLazyVisible';
import { Check, RotateCcw, Sparkles, Search, Star } from 'lucide-react';
import originalTemplateHtml from '../../assets/lekha-captions-T11-T35.html?raw';
import { findAppliedBasicTemplateMarkup } from './basicTemplateInline.js';
import { BASIC_TEMPLATE_STYLES, getBasicTemplateStyle } from './basicTemplateCatalog.js';
import {
  ADVANCED_IMP_ENTRANCES,
  ADVANCED_TEMPLATE_EMPHASIS_COLORS,
  ADVANCED_TEMPLATE_RUNTIME_CSS,
  ORIGINAL_TEMPLATE_BLOCKS,
} from './templateMotionConfig';
import {
  isExportableTemplateCandidate,
  templateMatchesQuery,
  useTemplateFavorites,
} from './templateBrowserUtils.js';
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

const REMOVED_ADVANCED_TEMPLATE_IDS = new Set(['t17']);

const ADVANCED_TEMPLATE_CREATIVE_NAMES = {
  t11: 'Oracle Serif',
  t12: 'Velvet Confession',
  t13: 'Founder Signal',
  t14: 'Literary Gold',
  t15: 'Surge Cut',
  t16: 'Motivation Grid',
  t18: 'Chapter One',
  t19: 'Defiant Headline',
  t20: 'Gravity Impact',
  t21: 'Runway Caption',
  t22: 'Lyric Glow',
  t23: 'Punchline Pop',
  t24: "Philosopher's Turn",
  t25: 'Handwritten Promise',
  t26: 'Street Stamp',
  t27: 'Future Terminal',
  t28: 'Memory Grain',
  t29: 'Battle Banner',
  t30: 'Zen Whisper',
  t31: 'Press Headline',
  t32: 'Poetic Frame',
  t33: 'Documentary Note',
  t34: 'Anime Burst',
  t35: 'Secret Serif',
  t36: 'Karaoke Beam',
  t37: 'Neon Broadcast',
  t38: 'Classic Echo',
  t39: 'Evidence Marker',
  t40: 'Final Signal',
};

const BASIC_TEMPLATE_CREATIVE_NAMES = {
  't-115': 'Neon Authority',
  't-109': 'Cinema Depth',
  't-26': 'Editorial Impact',
  't-102': 'Studio Clarity',
  't-36': 'Signal Flash',
  't-105': 'Golden Focus',
  't-9': 'Ember Command',
  't-16': 'Soft Focus',
  't-110': 'Orbit Glow',
  't-119': 'Gradient Marker',
  't-12': 'Noir Pulse',
  't-106': 'Clean Reveal',
  't-52': 'Luminous Streak',
  't-103': 'Midnight Focus',
  't-112': 'Rose Spectrum',
  't-104': 'Electric Pulse',
  't-111': 'Crimson Marker',
  't-T5': 'Golden Caption Bar',
  't-95': 'Velocity Lines',
  't-T1': 'Serif Cascade',
  't-T4': 'Scholar Script',
  't-WS1': 'Motion Slide',
  't-56': 'Precision Underline',
  't-T3': 'Quiet Emphasis',
  't-57': 'Retro Signal',
  't-37': 'Clean Wipe',
};

const FALLBACK_TEMPLATE_PACK = [
  { id: 't11', code: 'T11', name: 'Oracle Serif', formula: '3-Style', stageLabel: 'CLUSTER', mood: 'spiritual' },
  { id: 't12', code: 'T12', name: 'Velvet Confession', formula: '2-Style', stageLabel: 'TYPEWRITER', mood: 'intimate' },
  { id: 't13', code: 'T13', name: 'Founder Signal', formula: '2-Style', stageLabel: 'STAMP IN', mood: 'hustle' },
  { id: 't14', code: 'T14', name: 'Literary Gold', formula: '3-Style', stageLabel: '3D FLIP', mood: 'literary' },
  { id: 't15', code: 'T15', name: 'Surge Cut', formula: '2-Style', stageLabel: 'SURGE IN', mood: 'storm' },
  { id: 't16', code: 'T16', name: 'Motivation Grid', formula: '2-Style', stageLabel: 'STACK RISE', mood: 'countdown' },
  { id: 't18', code: 'T18', name: 'Chapter One', formula: '3-Style', stageLabel: 'SPLIT TITLE', mood: 'cinematic' },
  { id: 't19', code: 'T19', name: 'Defiant Headline', formula: '2-Style', stageLabel: 'SLASH WIPE', mood: 'rebellion' },
  { id: 't20', code: 'T20', name: 'Gravity Impact', formula: '2-Style', stageLabel: 'NEON DROP', mood: 'impact' },
  { id: 't21', code: 'T21', name: 'Runway Caption', formula: '2-Style', stageLabel: 'VERT REVEAL', mood: 'luxury' },
  { id: 't22', code: 'T22', name: 'Lyric Glow', formula: '2-Style', stageLabel: 'KARAOKE', mood: 'lyrical' },
  { id: 't23', code: 'T23', name: 'Punchline Pop', formula: '3-Style', stageLabel: 'SETUP->POP', mood: 'comedy' },
  { id: 't24', code: 'T24', name: "Philosopher's Turn", formula: '3-Style', stageLabel: 'REDACT REVEAL', mood: 'philosophy' },
  { id: 't25', code: 'T25', name: 'Handwritten Promise', formula: '2-Style', stageLabel: 'HANDWRITE', mood: 'love' },
  { id: 't26', code: 'T26', name: 'Street Stamp', formula: '2-Style', stageLabel: 'HARD CUT', mood: 'street' },
  { id: 't27', code: 'T27', name: 'Future Terminal', formula: '3-Style', stageLabel: 'CENTER EXPAND', mood: 'sci-fi' },
  { id: 't28', code: 'T28', name: 'Memory Grain', formula: '2-Style', stageLabel: 'GRAIN BLUR', mood: 'nostalgia' },
  { id: 't29', code: 'T29', name: 'Battle Banner', formula: '2-Style', stageLabel: 'SLAM', mood: 'battle' },
  { id: 't30', code: 'T30', name: 'Zen Whisper', formula: '1-Style', stageLabel: 'BREATHE', mood: 'zen' },
  { id: 't31', code: 'T31', name: 'Press Headline', formula: '3-Style', stageLabel: 'TYPEWRITER', mood: 'editorial' },
  { id: 't32', code: 'T32', name: 'Poetic Frame', formula: '3-Style', stageLabel: 'INK WIPE', mood: 'poetry' },
  { id: 't33', code: 'T33', name: 'Documentary Note', formula: '3-Style', stageLabel: 'DOC WIPE', mood: 'documentary' },
  { id: 't34', code: 'T34', name: 'Anime Burst', formula: '2-Style', stageLabel: 'SPEED IN', mood: 'anime' },
  { id: 't35', code: 'T35', name: 'Secret Serif', formula: '1-Style', stageLabel: 'SECRET REVEAL', mood: 'whisper' },
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
    position_y: 75,
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
    position_y: 75,
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
  t21: [{ id: 't21-b0', type: 'styled', label: 'VERT REVEAL' }, { id: 't21-b1', type: 'styled', label: 'SPACING COLLAPSE' }, { id: 't21-b2', type: 'wbw-rise', label: 'WBW RISE' }, { id: 't21-b3', type: 'wbw-slide', label: 'WBW SLIDE' }],
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
  const name = ADVANCED_TEMPLATE_CREATIVE_NAMES[templateId] || originalName;

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
    const creativeName = BASIC_TEMPLATE_CREATIVE_NAMES[id] || name;

    if (name && id && id !== 't-124') {
      cards.push({
        id,
        code: id.replace(/^t-/, ''),
        name: creativeName,
        originalName: name,
        desc,
        bg,
        cardMarkup: replaceMarkupText(cardMarkup, /(<div class="btcard-name">)([\s\S]*?)(<\/div>)/i, creativeName),
      });
    }

    cardPattern.lastIndex = match.index + Math.max(cardMarkup.length, 1);
  }

  return cards;
}

const BASIC_TEMPLATE_PACK = extractBasicTemplateCards();
const BASIC_TEMPLATE_IMAN_FONT_STYLE = { font_family: 'Noto Sans', font_size: 24 };
const BASIC_TEMPLATE_IMAN_FONT_IDS = new Set(
  (() => {
    const imanIndex = BASIC_TEMPLATE_PACK.findIndex((template) => template.id === 't-106');
    return imanIndex === -1
      ? []
      : BASIC_TEMPLATE_PACK.slice(imanIndex + 1).map((template) => template.id);
  })(),
);
const BASIC_TEMPLATE_ACCENT_ENABLED_IDS = new Set([
  't-106', 't-52', 't-T4', 't-WS1',
  't-115', 't-104', 't-109', 't-95', 't-102', 't-103',
  't-36', 't-105', 't-110', 't-56', 't-119', 't-12',
]);
const BASIC_TEMPLATE_ACCENT_DISABLED_IDS = new Set(
  (() => {
    const imanIndex = BASIC_TEMPLATE_PACK.findIndex((template) => template.id === 't-106');
    return imanIndex === -1
      ? []
      : BASIC_TEMPLATE_PACK
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
      text-shadow: 0 0 12px ${palette.accent}66 !important;
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
      opacity: 1 !important;
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
  const blockConfig = JSON.stringify(blocks);
  const rawPhaseIndex = Number(options.activePhaseIndex);
  const initialBlockIndex = blocks.length && Number.isFinite(rawPhaseIndex)
    ? ((Math.trunc(rawPhaseIndex) % blocks.length) + blocks.length) % blocks.length
    : 0;
  const lockToPhase = Boolean(options.lockToPhase && blocks.length);
  const appliedPreviewCaption = {
    text: String(options.captionText || '').trim(),
    impWordIndex: Number.isFinite(Number(options.impWordIndex)) ? Math.trunc(Number(options.impWordIndex)) : -1,
    emphasisColor: resolveAdvancedTemplateEmphasisColor(templateId, options.emphasisColor || '', initialBlockIndex),
  };
  const appliedPreviewConfig = JSON.stringify(appliedPreviewCaption).replace(/</g, '\\u003c');
  const previewScript = `
    <script>
      (() => {
        const HOLD = ${ADVANCED_TEMPLATE_PREVIEW_TIMING.holdMs};
        const EXIT = ${ADVANCED_TEMPLATE_PREVIEW_TIMING.exitMs};
        const ENTER = ${ADVANCED_TEMPLATE_PREVIEW_TIMING.enterMs};
        const GAP = ${ADVANCED_TEMPLATE_PREVIEW_TIMING.gapMs};
        const INITIAL_BLOCK_INDEX = ${initialBlockIndex};
        const LOCK_TO_PHASE = ${lockToPhase ? 'true' : 'false'};
        const APPLIED_PREVIEW = ${appliedPreviewConfig};
        let runToken = 0;
        let activeBlockIndex = INITIAL_BLOCK_INDEX;
        let pendingTimers = [];
        const IMP_ENTRANCES = ${JSON.stringify(ADVANCED_IMP_ENTRANCES)};
        const IMP_CLASS_PATTERN = /\\b(?:imp-[\\w-]+|ns[23]-[\\w-]+)\\b/g;
        const IMP_CLASS_TEST_PATTERN = /\\b(?:imp-[\\w-]+|ns[23]-[\\w-]+)\\b/;

        function schedule(callback, delay) {
          const timer = setTimeout(() => {
            pendingTimers = pendingTimers.filter((item) => item !== timer);
            callback();
          }, delay);
          pendingTimers.push(timer);
          return timer;
        }

        function clearPendingTimers() {
          pendingTimers.forEach((timer) => clearTimeout(timer));
          pendingTimers = [];
        }

        function hideBlock(block) {
          if (!block) return;
          block.classList.remove('active');
          block.style.transition = 'none';
          block.style.opacity = '0';
          block.style.visibility = 'hidden';
          block.style.zIndex = '0';
          resetWords(block);
        }

        function enforceSingleBlock(blocks, activeIndex) {
          blocks.forEach((block, index) => {
            if (!block) return;
            if (index === activeIndex) {
              block.style.visibility = 'visible';
              block.style.zIndex = '2';
              if (!block.classList.contains('active')) block.classList.add('active');
              if (block.dataset.type === 'plain') block.style.opacity = '1';
              return;
            }
            hideBlock(block);
          });
        }

        function buildWBW(container) {
          const el = container;
          const rawText = el.getAttribute('data-text');
          if (!rawText) return;
          el.innerHTML = '';
          const parts = rawText.split(/(\\{[^}]+\\}|\\s+)/);
          let idx = 0;
          parts.forEach((part) => {
            if (!part) return;
            if (/^(\\s+)$/.test(part)) {
              el.appendChild(document.createTextNode(' '));
              return;
            }
            const impMatch = part.match(/^\\{([^:]+):(.+)\\}$/);
            if (impMatch) {
              const cls = impMatch[1];
              const word = impMatch[2];
              const span = document.createElement('span');
              span.className = 'w ' + cls;
              span.textContent = word;
              span.dataset.i = idx++;
              span.dataset.imp = 'true';
              span.dataset.impCls = cls;
              el.appendChild(span);
              return;
            }
            const words = part.split(' ');
            words.forEach((word, wordIndex) => {
              if (!word) return;
              const span = document.createElement('span');
              span.className = 'w';
              span.textContent = word;
              span.dataset.i = idx++;
              el.appendChild(span);
              if (wordIndex < words.length - 1) {
                el.appendChild(document.createTextNode(' '));
              }
            });
          });
        }

        function cleanClass(value, fallback) {
          const cleaned = String(value || '')
            .split(/\\s+/)
            .filter((className) => className && !['active', 'visible', 'anim', 'on', 'in', 'fx'].includes(className))
            .join(' ');
          return cleaned || fallback;
        }

        function mappedClass(sourceClasses, index, total, fallback) {
          if (!sourceClasses.length) return fallback;
          if (total <= 1) return sourceClasses[0] || fallback;
          const sourceIndex = Math.min(
            sourceClasses.length - 1,
            Math.round((index * (sourceClasses.length - 1)) / Math.max(1, total - 1)),
          );
          return sourceClasses[sourceIndex] || fallback;
        }

        function replacePreviewWbw(container, words) {
          if (!container || !words.length) return;
          const sourceWords = Array.from(container.querySelectorAll('.w'));
          const sourceClasses = sourceWords.map((word) => cleanClass(word.className, 'w'));
          const sourceImpIndex = sourceWords.findIndex((word) => (
            word.dataset.imp === 'true' || IMP_CLASS_TEST_PATTERN.test(word.className || '')
          ));
          const sourceImpClass = sourceImpIndex >= 0
            ? sourceWords[sourceImpIndex].dataset.impCls
              || (sourceClasses[sourceImpIndex].match(IMP_CLASS_TEST_PATTERN) || [])[0]
              || ''
            : '';
          const rawImpWordIndex = Number(APPLIED_PREVIEW.impWordIndex);
          const impWordIndex = Number.isFinite(rawImpWordIndex) && rawImpWordIndex >= 0
            ? rawImpWordIndex
            : (sourceImpIndex >= 0 ? Math.min(words.length - 1, sourceImpIndex) : -1);
          const emphasisColor = APPLIED_PREVIEW.emphasisColor || '';
          const resolvedImpClass = sourceImpClass || ('${templateId}' === 't39' ? 'imp-rose' : '');

          container.textContent = '';
          container.dataset.text = words.join(' ');
          words.forEach((word, index) => {
            if (index > 0) container.appendChild(document.createTextNode(' '));
            const span = document.createElement('span');
            const mapped = mappedClass(sourceClasses, index, words.length, 'w')
              .replace(IMP_CLASS_PATTERN, '')
              .replace(/\\s+/g, ' ')
              .trim();
            const isImp = index === impWordIndex && !!resolvedImpClass;
            span.className = (mapped || 'w') + (isImp ? ' ' + resolvedImpClass + ' is-emphasis' : '');
            span.dataset.i = String(index);
            if (isImp) {
              span.dataset.imp = 'true';
              span.dataset.impCls = resolvedImpClass;
              if (emphasisColor) {
                span.style.setProperty('color', emphasisColor, 'important');
                span.style.setProperty('-webkit-text-fill-color', emphasisColor, 'important');
              }
            }
            span.textContent = word;
            container.appendChild(span);
          });
        }

        function replacePreviewKaraoke(container, words) {
          if (!container || !words.length) return;
          container.textContent = '';
          words.forEach((word, index) => {
            if (index > 0) container.appendChild(document.createTextNode(' '));
            const wrapper = document.createElement('span');
            wrapper.className = 'kf-word';
            const base = document.createElement('span');
            base.className = 'kf-base';
            base.textContent = word;
            const fill = document.createElement('span');
            fill.className = 'kf-fill';
            fill.textContent = word;
            wrapper.append(base, fill);
            container.appendChild(wrapper);
          });
        }

        function collectPreviewTextNodes(root) {
          const textNodes = [];
          const visit = (node) => {
            Array.from(node.childNodes || []).forEach((child) => {
              if (child.nodeType === 3) {
                if (/[\\p{L}\\p{N}]/u.test(child.nodeValue || '')) textNodes.push(child);
                else if (String(child.nodeValue || '').trim()) child.nodeValue = '';
              } else if (child.nodeType === 1) {
                visit(child);
              }
            });
          };
          visit(root);
          return textNodes;
        }

        function assignPreviewWordsToSlots(words, slotCount) {
          const assigned = Array.from({ length: Math.max(0, slotCount) }, () => []);
          if (!words.length || !assigned.length) return assigned;
          words.forEach((word, wordIndex) => {
            const slotIndex = words.length <= 1 || assigned.length <= 1
              ? 0
              : Math.min(
                assigned.length - 1,
                Math.round((wordIndex * (assigned.length - 1)) / Math.max(1, words.length - 1)),
              );
            assigned[slotIndex].push({ word, wordIndex });
          });
          return assigned;
        }

        function findPreviewImpWrapper(slot, block) {
          let element = slot?.parentElement;
          while (element && element !== block) {
            if (IMP_CLASS_TEST_PATTERN.test(String(element.className || ''))) return element;
            element = element.parentElement;
          }
          return null;
        }

        function getPreviewSourceImpClass(block) {
          const className = Array.from(block.querySelectorAll('*'))
            .map((element) => element.className || '')
            .find((value) => IMP_CLASS_TEST_PATTERN.test(String(value)));
          return String(className || '').match(IMP_CLASS_TEST_PATTERN)?.[0] || 'imp-gold';
        }

        function replacePreviewTextSlot(slot, assignedWords, impWordIndex, impClass, emphasisColor, block) {
          const source = String(slot.nodeValue || '');
          const leading = /^\\s/.test(source) ? ' ' : '';
          const trailing = /\\s$/.test(source) ? ' ' : '';
          const replacementTarget = impWordIndex >= 0 ? findPreviewImpWrapper(slot, block) : null;
          const fragment = document.createDocumentFragment();
          if (leading) fragment.appendChild(document.createTextNode(leading));
          assignedWords.forEach(({ word, wordIndex }, localIndex) => {
            if (localIndex > 0) fragment.appendChild(document.createTextNode(' '));
            if (wordIndex === impWordIndex) {
              const span = document.createElement('span');
              span.className = impClass + ' is-emphasis';
              span.dataset.w = String(wordIndex);
              span.dataset.imp = 'true';
              span.dataset.impCls = impClass;
              if (emphasisColor) {
                span.style.setProperty('color', emphasisColor, 'important');
                span.style.setProperty('-webkit-text-fill-color', emphasisColor, 'important');
              }
              span.textContent = word;
              fragment.appendChild(span);
            } else {
              fragment.appendChild(document.createTextNode(word));
            }
          });
          if (trailing) fragment.appendChild(document.createTextNode(trailing));
          if (replacementTarget?.parentNode) {
            replacementTarget.parentNode.replaceChild(fragment, replacementTarget);
          } else {
            slot.parentNode?.replaceChild(fragment, slot);
          }
        }

        function replacePreviewStyledText(block, words) {
          const slots = collectPreviewTextNodes(block);
          if (!slots.length) {
            block.textContent = APPLIED_PREVIEW.text;
            return;
          }
          const targetSlotCount = Math.max(1, Math.min(words.length, slots.length));
          const targetSlots = slots.slice(0, targetSlotCount);
          const assigned = assignPreviewWordsToSlots(words, targetSlots.length);
          const impClass = getPreviewSourceImpClass(block);
          const impWordIndex = Number(APPLIED_PREVIEW.impWordIndex);
          const emphasisColor = APPLIED_PREVIEW.emphasisColor || '';
          targetSlots.forEach((slot, slotIndex) => {
            if (assigned[slotIndex]?.length) {
              replacePreviewTextSlot(slot, assigned[slotIndex], impWordIndex, impClass, emphasisColor, block);
            } else {
              slot.nodeValue = '';
            }
          });
          slots.slice(targetSlotCount).forEach((slot) => {
            slot.nodeValue = '';
          });
          block.querySelectorAll('[data-text]').forEach((element) => {
            element.setAttribute('data-text', APPLIED_PREVIEW.text || '');
          });
        }

        function injectAppliedPreviewCaption(blocks) {
          const captionText = String(APPLIED_PREVIEW.text || '').trim();
          if (!captionText) return;
          const words = captionText.split(/\\s+/).filter(Boolean);
          if (!words.length) return;

          blocks.forEach((block) => {
            if (!block) return;
            const wbwContainers = Array.from(block.querySelectorAll('.wbw-rise, .wbw-slide, .wbw-seq, .wbw-seq-fade, .wbw-seq-flip'));
            if (wbwContainers.length) {
              wbwContainers.forEach((container) => replacePreviewWbw(container, words));
              return;
            }
            const karaokeContainers = Array.from(block.querySelectorAll('.kf-line'));
            if (karaokeContainers.length) {
              karaokeContainers.forEach((container) => replacePreviewKaraoke(container, words));
              return;
            }
            replacePreviewStyledText(block, words);
          });
        }

        function applyStillFramesPreviewHighlight(blocks) {
          if ('${templateId}' !== 't40') return;
          blocks.forEach((block) => {
            if (!block || block.querySelector('.still-frames-highlight')) return;
            const target = block.querySelector('.lekha-template-fit, span') || block;
            const words = String(target.textContent || '').trim().split(/\\s+/).filter(Boolean);
            if (!words.length) return;
            const rawImpWordIndex = Number(APPLIED_PREVIEW.impWordIndex);
            const impWordIndex = Number.isFinite(rawImpWordIndex) && rawImpWordIndex >= 0
              ? Math.min(words.length - 1, rawImpWordIndex)
              : Math.min(1, words.length - 1);
            const emphasisColor = APPLIED_PREVIEW.emphasisColor || '';
            target.textContent = '';
            target.classList.add('lekha-template-fit', 'still-frames-line');
            words.forEach((word, index) => {
              if (index > 0) target.appendChild(document.createTextNode(' '));
              if (index === impWordIndex) {
                const span = document.createElement('span');
                span.className = 'imp-rose still-frames-highlight is-emphasis';
                span.dataset.imp = 'true';
                span.dataset.impCls = 'imp-rose';
                if (emphasisColor) {
                  span.style.setProperty('color', emphasisColor, 'important');
                  span.style.setProperty('-webkit-text-fill-color', emphasisColor, 'important');
                }
                span.textContent = word;
                target.appendChild(span);
              } else {
                target.appendChild(document.createTextNode(word));
              }
            });
          });
        }

        function resetWords(block) {
          block.querySelectorAll('.w').forEach((word) => {
            word.classList.remove('in', 'fx');
            word.style.opacity = '0';
            word.style.transform = '';
            word.style.clipPath = '';
            word.style.transformOrigin = '';
            word.style.transition = '';
          });
          block.querySelectorAll('.imp-underline').forEach((el) => {
            el.classList.remove('in');
          });
          block.querySelectorAll('.kf-fill').forEach((fill) => {
            fill.style.transition = 'none';
            fill.style.clipPath = 'inset(0 100% 0 0)';
          });
        }

        function animateWordsIn(block) {
          const token = runToken;
          const wordLine = block.querySelector('.wbw-rise, .wbw-seq-flip, .wbw-seq-fade, .wbw-seq, .wbw-slide');
          const type = !wordLine
            ? 'slide'
            : wordLine.classList.contains('wbw-rise')
              ? 'rise'
              : wordLine.classList.contains('wbw-seq-flip')
                ? 'seq-flip'
                : wordLine.classList.contains('wbw-seq-fade')
                  ? 'seq-fade'
                  : wordLine.classList.contains('wbw-seq')
                    ? 'seq'
                    : 'slide';
          const isSeq = type === 'seq' || type === 'seq-flip' || type === 'seq-fade';
          const stagger = isSeq
            ? ${ADVANCED_TEMPLATE_PREVIEW_TIMING.sequentialStaggerMs}
            : ${ADVANCED_TEMPLATE_PREVIEW_TIMING.wordStaggerMs};
          const words = block.querySelectorAll('.w');
          words.forEach((word) => {
            word.classList.remove('in', 'fx');
            word.style.opacity = '0';
            word.style.clipPath = '';
            word.style.transformOrigin = '';
            if (type === 'rise') word.style.transform = 'translateY(20px)';
            else if (type === 'slide' && !word.dataset.imp) word.style.transform = 'translateX(-16px)';
            else if (type === 'seq') word.style.transform = 'scale(0.82)';
            else if (type === 'seq-fade') word.style.transform = 'none';
            else if (type === 'seq-flip') {
              word.style.transform = 'perspective(320px) rotateX(-90deg)';
              word.style.transformOrigin = 'center bottom';
            }
          });
          void block.offsetHeight;

          words.forEach((word, fallbackIndex) => {
            const isImp = !!word.dataset.imp;
            const impCls = word.dataset.impCls || '';
            const parsedIndex = parseInt(word.dataset.i, 10);
            const index = Number.isFinite(parsedIndex) ? parsedIndex : fallbackIndex;
            const delay = isSeq
              ? index * stagger
              : (index * stagger) + (isImp ? ${ADVANCED_TEMPLATE_PREVIEW_TIMING.emphasisDelayMs} : 0);
            const dur = isSeq
              ? ${ADVANCED_TEMPLATE_PREVIEW_TIMING.sequentialDurationMs}
              : isImp
                ? ${ADVANCED_TEMPLATE_PREVIEW_TIMING.emphasisDurationMs}
                : ${ADVANCED_TEMPLATE_PREVIEW_TIMING.wordDurationMs};
            const entrance = !isSeq && isImp ? (IMP_ENTRANCES[impCls] || 'opposite') : null;

            schedule(() => {
              if (token !== runToken || !block.classList.contains('active')) return;
              if (isSeq) {
                requestAnimationFrame(() => {
                  requestAnimationFrame(() => {
                    if (token !== runToken || !block.classList.contains('active')) return;
                    if (type === 'seq-fade') {
                      word.style.transition = 'opacity ' + dur + 'ms ease';
                    } else {
                      word.style.transition = 'opacity ' + dur + 'ms ease, transform ' + dur + 'ms cubic-bezier(0.34,1.4,0.64,1)';
                      word.style.transform = type === 'seq-flip'
                        ? 'perspective(320px) rotateX(0)'
                        : 'scale(1)';
                    }
                    word.style.opacity = '1';
                    word.classList.add('in');
                  });
                });
                return;
              }

              if (isImp) {
                let initTransform = '';
                let initClip = '';
                let initOrigin = '';
                const eff = entrance === 'opposite' ? (type === 'rise' ? 'opposite-slide' : 'opposite-rise') : entrance;
                if (eff === 'opposite-slide') initTransform = 'translateX(-28px)';
                else if (eff === 'opposite-rise') initTransform = 'translateY(28px)';
                else if (eff === 'roll') { initTransform = 'rotateX(-90deg)'; initOrigin = 'center bottom'; }
                else if (eff === 'wipe') initClip = 'inset(0 100% 0 0)';
                else if (eff === 'wipe-up') initClip = 'inset(100% 0 0 0)';
                else initTransform = type === 'rise' ? 'translateX(-28px)' : 'translateY(28px)';

                if (initTransform) word.style.transform = initTransform;
                if (initClip) word.style.clipPath = initClip;
                if (initOrigin) word.style.transformOrigin = initOrigin;

                requestAnimationFrame(() => {
                  requestAnimationFrame(() => {
                    if (token !== runToken || !block.classList.contains('active')) return;
                    word.style.transition = 'opacity ' + dur + 'ms ease, transform ' + dur + 'ms cubic-bezier(0.34,1.2,0.64,1), clip-path ' + dur + 'ms ease';
                    word.style.opacity = '1';
                    word.style.transform = 'none';
                    word.style.clipPath = '';
                    word.classList.add('in');

                    if (impCls === 'imp-flicker') {
                      schedule(() => {
                        if (token === runToken && block.classList.contains('active')) word.classList.add('fx');
                      }, dur + 50);
                    }
                    if (impCls === 'imp-underline') {
                      schedule(() => {
                        if (token === runToken && block.classList.contains('active')) word.classList.add('in');
                      }, 50);
                    }
                  });
                });
                return;
              }

              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  if (token !== runToken || !block.classList.contains('active')) return;
                  word.style.transition = 'opacity ' + dur + 'ms ease, transform ' + dur + 'ms cubic-bezier(0.34,1.2,0.64,1)';
                  word.style.opacity = '1';
                  word.style.transform = 'none';
                  word.classList.add('in');
                });
              });
            }, delay);
          });
        }

        function animateKaraoke(block) {
          const token = runToken;
          const words = block.querySelectorAll('.kf-word');
          const perWord = Math.round(HOLD / (words.length + 0.5));
          words.forEach((word) => {
            const fill = word.querySelector('.kf-fill');
            if (!fill) return;
            fill.style.transition = 'none';
            fill.style.clipPath = 'inset(0 100% 0 0)';
          });
          words.forEach((word, index) => {
            schedule(() => {
              if (token !== runToken || !block.classList.contains('active')) return;
              const fill = word.querySelector('.kf-fill');
              if (!fill) return;
              fill.style.transition = 'none';
              fill.style.clipPath = 'inset(0 100% 0 0)';
              void fill.offsetWidth;
              fill.style.transition = 'clip-path ' + perWord + 'ms linear';
              fill.style.clipPath = 'inset(0 0% 0 0)';
            }, index * perWord);
          });
        }

        function enterBlock(blocks, index, label) {
          const block = blocks[index];
          if (!block) return;
          activeBlockIndex = index;
          enforceSingleBlock(blocks, index);
          block.style.transition = 'none';
          block.style.opacity = '0';
          block.style.visibility = 'visible';
          block.style.zIndex = '2';
          resetWords(block);
          void block.offsetHeight;

          const isPlain = block.dataset.type === 'plain';
          const isWBW = block.dataset.type === 'wbw-rise'
            || block.dataset.type === 'wbw-slide'
            || block.dataset.type === 'wbw-seq'
            || block.dataset.type === 'wbw-seq-flip'
            || block.dataset.type === 'wbw-seq-fade';
          const isKaraoke = block.dataset.type === 'karaoke';

          if (isPlain) {
            block.style.transition = 'none';
            block.style.opacity = '1';
            block.classList.add('active');
          } else if (isKaraoke) {
            block.style.transition = 'none';
            block.style.opacity = '1';
            block.classList.add('active');
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                animateKaraoke(block);
              });
            });
          } else if (isWBW) {
            block.style.transition = 'none';
            block.style.opacity = '1';
            block.classList.add('active');
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                animateWordsIn(block);
              });
            });
          } else {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                block.style.transition = 'opacity ' + ENTER + 'ms ease';
                block.style.opacity = '1';
                block.classList.add('active');
              });
            });
          }

          if (label) {
            label.textContent = block.dataset.label || '';
          }
        }

        function exitBlock(block, callback) {
          if (block.dataset.type === 'plain') {
            block.style.transition = 'none';
            block.style.opacity = '0';
            block.classList.remove('active');
            resetWords(block);
            schedule(callback, GAP);
            return;
          }

          block.style.transition = 'opacity ' + EXIT + 'ms ease';
          block.style.opacity = '0';
          schedule(() => {
            block.classList.remove('active');
            block.style.visibility = 'hidden';
            block.style.zIndex = '0';
            resetWords(block);
            schedule(callback, GAP);
          }, EXIT);
        }

        function updateDots(dotsEl, idx) {
          dotsEl.querySelectorAll('.dot').forEach((dot, dotIndex) => {
            dot.classList.toggle('active', dotIndex === idx);
          });
        }

        function jumpTo(index) {
          if (!blocks[index]) return;
          if (LOCK_TO_PHASE) {
            runSequencer(blocks, dotsEl, labelEl, INITIAL_BLOCK_INDEX);
            return;
          }
          runSequencer(blocks, dotsEl, labelEl, index);
        }

        function runSequencer(blocks, dotsEl, labelEl, startIndex = 0) {
          clearPendingTimers();
          runToken += 1;
          let current = Math.max(0, Math.min(blocks.length - 1, startIndex));
          const token = runToken;

          enterBlock(blocks, current, labelEl);
          updateDots(dotsEl, current);
          if (LOCK_TO_PHASE) {
            schedule(() => {
              if (token === runToken) enforceSingleBlock(blocks, activeBlockIndex);
            }, 250);
            return;
          }

          function showNext() {
            if (token !== runToken) return;
            const prev = (current - 1 + blocks.length) % blocks.length;
            exitBlock(blocks[prev], () => {
              if (token !== runToken) return;
              enterBlock(blocks, current, labelEl);
              updateDots(dotsEl, current);
              current = (current + 1) % blocks.length;
              schedule(showNext, HOLD);
            });
          }

          current = (current + 1) % blocks.length;
          schedule(showNext, HOLD);
          schedule(() => {
            if (token === runToken) enforceSingleBlock(blocks, activeBlockIndex);
          }, 250);
        }

        const blocks = ${blockConfig}.map((item) => {
          const el = document.getElementById(item.id);
          if (!el) return null;
          el.dataset.type = item.type;
          el.dataset.label = item.label;
          if ('${templateId}' === 't33' && item.id === 't33-b2' && item.type === 'karaoke' && !el.querySelector('.kf-line')) {
            el.textContent = '';
            const line = document.createElement('div');
            line.className = 'kf-line';
            'This is what we found'.split(/\\s+/).forEach((word, index) => {
              if (index > 0) line.appendChild(document.createTextNode(' '));
              const wrapper = document.createElement('span');
              wrapper.className = 'kf-word';
              const base = document.createElement('span');
              base.className = 'kf-base';
              base.textContent = word;
              const fill = document.createElement('span');
              fill.className = 'kf-fill';
              fill.textContent = word;
              wrapper.append(base, fill);
              line.appendChild(wrapper);
            });
            el.appendChild(line);
          }
          el.classList.remove('active');
          el.style.opacity = '0';
          el.style.visibility = 'hidden';
          el.style.zIndex = '0';
          el.querySelectorAll('.wbw-rise, .wbw-slide, .wbw-seq, .wbw-seq-flip, .wbw-seq-fade').forEach((wbwEl) => buildWBW(wbwEl));
          return el;
        }).filter(Boolean);
        injectAppliedPreviewCaption(blocks);
        const dotsEl = document.getElementById('dots-${templateId}');
        const labelEl = document.getElementById('${templateId}-label');

        if ('${templateId}' === 't17') {
          const t17b1 = document.getElementById('t17-b1');
          if (t17b1) t17b1.dataset.type = 'styled';
        }

        if (blocks.length && dotsEl) {
          applyStillFramesPreviewHighlight(blocks);
          if (!dotsEl.dataset.dotHandlersBound) {
            dotsEl.dataset.dotHandlersBound = 'true';
            dotsEl.querySelectorAll('.dot').forEach((dot, dotIndex) => {
              dot.setAttribute('role', 'button');
              dot.setAttribute('tabindex', '0');
              dot.setAttribute('aria-label', 'Play caption line ' + (dotIndex + 1));
              dot.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                jumpTo(dotIndex);
              });
              dot.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  jumpTo(dotIndex);
                }
              });
            });
          }
          window.addEventListener('message', (event) => {
            const payload = event?.data || {};
            if (payload.type !== 'lekha-template-preview-jump') return;
            const nextIndex = Number(payload.index);
            if (!Number.isFinite(nextIndex)) return;
            jumpTo(nextIndex);
          });
          runSequencer(blocks, dotsEl, labelEl, INITIAL_BLOCK_INDEX);
          setInterval(() => enforceSingleBlock(blocks, activeBlockIndex), 250);
          window.addEventListener('pageshow', () => runSequencer(blocks, dotsEl, labelEl, LOCK_TO_PHASE ? INITIAL_BLOCK_INDEX : activeBlockIndex));
          window.addEventListener('focus', () => runSequencer(blocks, dotsEl, labelEl, LOCK_TO_PHASE ? INITIAL_BLOCK_INDEX : activeBlockIndex));
          document.addEventListener('visibilitychange', () => {
            if (!document.hidden) runSequencer(blocks, dotsEl, labelEl, LOCK_TO_PHASE ? INITIAL_BLOCK_INDEX : activeBlockIndex);
          });
        }

        if ('${templateId}' === 't11') {
          const t11b0 = document.getElementById('t11-b0');
          if (t11b0) {
            const observer = new MutationObserver((mutations) => {
              mutations.forEach((mutation) => {
                if (mutation.type !== 'attributes' || mutation.attributeName !== 'class') return;
                const isActive = t11b0.classList.contains('active');
                const topRow = t11b0.querySelector('.cluster-row-top');
                const hl = t11b0.querySelector('.cluster-hl');
                const botRow = t11b0.querySelector('.cluster-row-bot');
                if (!topRow || !hl || !botRow) return;

                if (!isActive) {
                  topRow.classList.remove('active');
                  hl.classList.remove('active');
                  botRow.classList.remove('active');
                  return;
                }

                topRow.classList.remove('active');
                topRow.style.transition = 'none';
                hl.classList.remove('active');
                hl.style.transition = 'none';
                botRow.classList.remove('active');
                botRow.style.transition = 'none';
                void t11b0.offsetHeight;
                setTimeout(() => {
                  topRow.style.transition = '';
                  topRow.classList.add('active');
                  setTimeout(() => {
                    hl.style.transition = '';
                    hl.classList.add('active');
                    setTimeout(() => {
                      botRow.style.transition = '';
                      botRow.classList.add('active');
                    }, 180);
                  }, 220);
                }, 20);
              });
            });
            observer.observe(t11b0, { attributes: true });
          }
        }
      })();
    </script>
  `;

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <style>${extractOriginalStyle()}</style>
        ${iframeOverrides(templateId, options.previewStyle || {})}
      </head>
      <body>${cardMarkup}${previewScript}</body>
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
  const previewScript = `
    <script>
      (() => {
        const card = document.querySelector('.btcard');
        if (!card) return;

        const fixedHighlightPerLine = ['t-106', 't-52', 't-T4', 't-WS1'].includes('${template.id}');
        const previewWordIndexForBlock = (blockIndex) => Math.min((Math.max(0, blockIndex) * 4) + 2, wordCount - 1);
        let idx = 2;
        let currentBlock = -1;
        const blocks = Array.from(card.querySelectorAll('.bt-cap-block'));
        const dots = Array.from(card.querySelectorAll('.bt-prog-dots .dot'));
        const wordCount = Math.max(1, card.querySelectorAll('.word[data-wi]').length);

        function cls(wi) {
          let className = 'word';
          if (wi <= idx) className += ' active';
          if (wi === idx) className += ' current';
          if (wi === idx && ['t-106', 't-52', 't-T4', 't-WS1'].includes('${template.id}')) className += ' imp';
          return className;
        }

        function activateWholeLine(blockIndex) {
          card.querySelectorAll('.word[data-wi]').forEach((word) => {
            if (word.closest('.cpt-wrap') || word.closest('.t-102') || word.closest('.t-103') || word.closest('.t-124')) return;
            if (Math.floor(Number(word.dataset.wi || 0) / 4) === blockIndex) {
              word.classList.add('active');
            }
          });
        }

        function triggerStickyWave(sblock) {
          const words = Array.from(sblock.querySelectorAll('.sw-w'));
          words.forEach((word) => {
            word.style.opacity = '0.42';
          });
          words.forEach((word, wordIndex) => {
            setTimeout(() => {
              word.style.opacity = '1';
            }, wordIndex * ${BASIC_TEMPLATE_PREVIEW_TIMING.stickyWaveStaggerMs});
          });
        }

        function animateBlock(block) {
          const phaseIndex = Array.from(block.parentElement?.children || []).indexOf(block);
          block.querySelectorAll('.t-52 .word, .t-T4 .word, .t-106 .word, .t-T6 .word').forEach((word) => {
            word.style.opacity = '';
            word.style.transform = '';
            word.style.transition = '';
            word.style.animation = '';
          });

          block.querySelectorAll('.t-52, .t-T4, .t-106, .t-T6, .t-56').forEach((wrapper) => {
            wrapper.querySelectorAll('.word').forEach((word) => {
              word.classList.add('active');
            });
          });

          block.querySelectorAll('.t-52').forEach((wrapper) => {
            if (phaseIndex === 0) {
              wrapper.style.transition = 'none';
              wrapper.style.opacity = '0';
              wrapper.style.transform = 'translateY(44px)';
              setTimeout(() => {
                wrapper.style.transition = 'transform 700ms cubic-bezier(0.22,1,0.36,1), opacity 400ms ease';
                wrapper.style.opacity = '1';
                wrapper.style.transform = 'none';
              }, 30);
              return;
            }
            wrapper.querySelectorAll('.word').forEach((word, wordIndex) => {
              word.style.transition = 'none';
              word.style.opacity = '0';
              word.style.transform = phaseIndex === 1 ? 'translateX(-38px)' : 'translateX(38px)';
              setTimeout(() => {
                word.style.transition = 'opacity 420ms ease, transform 420ms cubic-bezier(0.22,1,0.36,1)';
                word.style.opacity = '1';
                word.style.transform = 'none';
              }, 30 + (wordIndex * ${BASIC_TEMPLATE_PREVIEW_TIMING.wordStaggerMs}));
            });
          });

          block.querySelectorAll('.t-T4').forEach((wrapper) => {
            wrapper.classList.remove('study-line-0', 'study-line-1', 'study-line-2', 'study-word-slide-preview');
            wrapper.style.transition = 'none';
            wrapper.style.animation = 'none';
            wrapper.style.opacity = phaseIndex === 1 ? '1' : '0';
            wrapper.style.transform = phaseIndex === 0
              ? 'translateX(-38px)'
              : phaseIndex === 2
                ? 'translateY(24px)'
                : 'none';
            wrapper.querySelectorAll('.cap-text, .basic-manual-line, .word').forEach((node) => {
              node.style.transition = '';
              node.style.animation = '';
              node.style.opacity = '';
              node.style.transform = '';
            });
            wrapper.querySelectorAll('.word').forEach((word, wordIndex) => {
              if (phaseIndex === 1) {
                word.style.setProperty('--ws-delay', (90 + (wordIndex * 55)) + 'ms');
              } else {
                word.style.removeProperty('--ws-delay');
              }
              word.style.removeProperty('--basic-word-delay');
            });
            void wrapper.offsetWidth;
            wrapper.classList.add('study-line-' + phaseIndex);
            wrapper.classList.toggle('study-word-slide-preview', phaseIndex === 1);
            if (phaseIndex === 0) {
              wrapper.style.animation = 'basicWordSlideFromLeft 0.42s cubic-bezier(0.22,1,0.36,1) both';
            } else if (phaseIndex === 2) {
              wrapper.style.animation = 'wordRiseInFromBottom 0.38s cubic-bezier(0.34,1.2,0.64,1) both';
            } else {
              wrapper.style.animation = 'none';
              wrapper.style.opacity = '1';
              wrapper.style.transform = 'none';
            }
          });

          block.querySelectorAll('.t-106').forEach((wrapper) => {
            wrapper.querySelectorAll('.word').forEach((word, wordIndex) => {
              word.style.transition = 'none';
              word.style.opacity = phaseIndex === 1 ? '1' : '0';
              word.style.transform = phaseIndex === 0
                ? 'translateY(20px)'
                : phaseIndex === 2
                  ? 'translateX(38px)'
                  : 'none';
              if (phaseIndex === 1) {
                word.style.opacity = '1';
                word.style.transform = 'none';
                word.style.animation = 'none';
                return;
              }
              setTimeout(() => {
                word.style.transition = 'opacity 420ms ease, transform 420ms cubic-bezier(0.22,1,0.36,1)';
                word.style.opacity = '1';
                word.style.transform = 'none';
              }, 30 + (wordIndex * ${BASIC_TEMPLATE_PREVIEW_TIMING.wordStaggerMs}));
            });
          });

          block.querySelectorAll('.t-T6 .word').forEach((word, wordIndex) => {
            word.style.transition = 'none';
            word.style.opacity = '0';
            word.style.transform = 'translateY(20px)';
            setTimeout(() => {
              word.style.transition = 'opacity 280ms ease, transform 280ms cubic-bezier(0.34,1.2,0.64,1)';
              word.style.opacity = '1';
              word.style.transform = 'none';
            }, 30 + (wordIndex * ${BASIC_TEMPLATE_PREVIEW_TIMING.wordStaggerMs}));
            setTimeout(() => {
              word.style.opacity = '1';
              word.style.transform = 'none';
            }, 520);
          });

          block.querySelectorAll('.t-WS1').forEach((wrapper) => {
            wrapper.classList.remove('ws-enter', 'ws-done', 'ws-line-0', 'ws-line-1', 'ws-line-2');
            wrapper.querySelectorAll('.word').forEach((word, wordIndex) => {
              word.style.transition = 'none';
              word.style.animation = '';
              word.style.opacity = '';
              word.style.transform = '';
              word.style.filter = 'none';
              word.style.setProperty('--ws-delay', (120 + (wordIndex * ${BASIC_TEMPLATE_PREVIEW_TIMING.wordStaggerMs})) + 'ms');
            });
            void wrapper.offsetWidth;
            wrapper.classList.add('ws-enter', 'ws-line-' + phaseIndex);
          });

          block.querySelectorAll('.sblock[data-type="sticky-wave"]').forEach(triggerStickyWave);
        }

        function setBlock(blockIndex) {
          const blockChanged = blockIndex !== currentBlock;
          currentBlock = blockIndex;
          blocks.forEach((block, index) => {
            const active = index === blockIndex;
            block.style.display = active ? 'flex' : 'none';
            block.classList.toggle('active', active);
            block.classList.toggle('is-active', active);
            if (active && blockChanged) animateBlock(block);
          });
          dots.forEach((dot, index) => {
            dot.className = 'dot' + (index === blockIndex ? ' active' : '');
          });
        }

        function tick() {
          if (fixedHighlightPerLine) {
            const nextBlockIndex = Math.max(0, (currentBlock + 1) % Math.max(1, blocks.length));
            idx = previewWordIndexForBlock(nextBlockIndex);
            card.querySelectorAll('.word[data-wi]').forEach((word) => {
              word.className = cls(Number(word.dataset.wi || 0));
            });
            setBlock(nextBlockIndex);
            activateWholeLine(nextBlockIndex);
            return;
          }
          idx = (idx + 1) % wordCount;
          card.querySelectorAll('.word[data-wi]').forEach((word) => {
            word.className = cls(Number(word.dataset.wi || 0));
          });
          const blockIndex = Math.max(0, Math.min(blocks.length - 1, Math.floor(idx / 4)));
          setBlock(blockIndex);
          activateWholeLine(blockIndex);
        }

        dots.forEach((dot, dotIndex) => {
          dot.addEventListener('click', () => {
            idx = previewWordIndexForBlock(dotIndex);
            card.querySelectorAll('.word[data-wi]').forEach((word) => {
              word.className = cls(Number(word.dataset.wi || 0));
            });
            setBlock(dotIndex);
            activateWholeLine(dotIndex);
          });
        });

        window.addEventListener('message', (event) => {
          const payload = event?.data || {};
          if (payload.type !== 'lekha-template-preview-jump') return;
          const dotIndex = Number(payload.index);
          if (!Number.isFinite(dotIndex) || !dots[dotIndex]) return;
          idx = previewWordIndexForBlock(dotIndex);
          card.querySelectorAll('.word[data-wi]').forEach((word) => {
            word.className = cls(Number(word.dataset.wi || 0));
          });
          setBlock(dotIndex);
          activateWholeLine(dotIndex);
        });

        idx = previewWordIndexForBlock(0);
        card.querySelectorAll('.word[data-wi]').forEach((word) => {
          word.className = cls(Number(word.dataset.wi || 0));
        });
        const cycleMs = fixedHighlightPerLine ? ${BASIC_TEMPLATE_PREVIEW_TIMING.fixedLineCycleMs} : ${BASIC_TEMPLATE_PREVIEW_TIMING.wordCycleMs};
        setBlock(0);
        activateWholeLine(0);
        setInterval(tick, cycleMs);
      })();
    </script>
  `;

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
  const { isFavorite, toggleFavorite } = useTemplateFavorites();
  const visibleAdvancedTemplates = useMemo(
    () => ADVANCED_TEMPLATE_PACK.filter((template) => (
      isExportableTemplateCandidate(template)
      && templateMatchesQuery(template, templateSearchQuery)
      && (!favoritesOnly || isFavorite('advanced-template', template.id))
    )),
    [templateSearchQuery, favoritesOnly, isFavorite],
  );
  const visibleBasicTemplates = useMemo(
    () => BASIC_TEMPLATE_PACK.filter((template) => (
      isExportableTemplateCandidate(template)
      && templateMatchesQuery(template, templateSearchQuery)
      && (!favoritesOnly || isFavorite('basic-template', template.id))
    )),
    [templateSearchQuery, favoritesOnly, isFavorite],
  );

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
            <div
              key={template.id}
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
          );
        })}
        {!visibleAdvancedTemplates.length && (
          <div className="advanced-template-empty-state">No matching advanced templates.</div>
        )}

        <div className="advanced-template-section-label">
          <span>Basic Templates</span>
          <small>{visibleBasicTemplates.length}/{BASIC_TEMPLATE_PACK.length}</small>
        </div>
        {visibleBasicTemplates.map((template) => {
          const isActive = currentStyle?.template_id === template.id;
          const templateIsFavorite = isFavorite('basic-template', template.id);
          const defaultStyle = buildAppliedBasicTemplateStyle(template);
          const previewStyle = isActive ? { ...defaultStyle, ...currentStyle } : defaultStyle;
          const applyBasicTemplate = () => onApplyTemplate?.(defaultStyle);
          const updateBasicTemplate = (patch) => onApplyTemplate?.({ ...defaultStyle, ...currentStyle, ...patch });

          return (
            <div
              key={`basic-${template.id}-${template.name}`}
              className={`advanced-template-card-shell ${isActive ? 'is-active' : ''}`}
            >
              <button
                type="button"
                title={templateIsFavorite ? 'Remove from favorites' : 'Add to favorites'}
                aria-label={templateIsFavorite ? 'Remove from favorites' : 'Add to favorites'}
                onClick={(event) => {
                  event.stopPropagation();
                  toggleFavorite('basic-template', template.id);
                }}
                className={`advanced-template-favorite-button ${templateIsFavorite ? 'is-active' : ''}`}
              >
                <Star className="h-3.5 w-3.5" fill={templateIsFavorite ? 'currentColor' : 'none'} />
              </button>
              <button
                type="button"
                data-template-card-id={template.id}
                data-template-kind="basic"
                aria-pressed={isActive}
                onClick={applyBasicTemplate}
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
        })}
        {!visibleBasicTemplates.length && (
          <div className="advanced-template-empty-state">No matching basic templates.</div>
        )}
      </div>

      {showBackButton && onBack && (
        <button
          type="button"
          onClick={onBack}
          className="mt-4 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white hover:bg-white/[0.08]"
        >
          Back to Captions
        </button>
      )}
    </div>
  );
}
