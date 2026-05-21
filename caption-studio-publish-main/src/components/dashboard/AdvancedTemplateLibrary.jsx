import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Sparkles } from 'lucide-react';
import originalTemplateHtml from '../../assets/lekha-captions-T11-T35.html?raw';
import '../../styles/advancedTemplateLibrary.css';

const sanitizedOriginalTemplateHtml = originalTemplateHtml
  .replace(/<script[\s\S]*?<\/script>/gi, '')
  .replace(/\s+bis_skin_checked="[^"]*"/gi, '')
  .replace(/<!-- saved from url=.*?-->\s*/gi, '');

const FALLBACK_TEMPLATE_PACK = [
  { id: 't11', code: 'T11', name: 'Spiritual Awakening', formula: '3-Style', stageLabel: 'CLUSTER', mood: 'spiritual' },
  { id: 't12', code: 'T12', name: 'Intimate Confession', formula: '2-Style', stageLabel: 'TYPEWRITER', mood: 'intimate' },
  { id: 't13', code: 'T13', name: 'Startup Hustle', formula: '2-Style', stageLabel: 'STAMP IN', mood: 'hustle' },
  { id: 't14', code: 'T14', name: 'Literary Weight', formula: '3-Style', stageLabel: '3D FLIP', mood: 'literary' },
  { id: 't15', code: 'T15', name: 'Storm & Drama', formula: '2-Style', stageLabel: 'SHAKE-IN', mood: 'storm' },
  { id: 't16', code: 'T16', name: 'Motivation Stack', formula: '2-Style', stageLabel: 'STACK RISE', mood: 'countdown' },
  { id: 't17', code: 'T17', name: 'Horror / Tension', formula: '3-Style', stageLabel: 'GLITCH', mood: 'horror' },
  { id: 't18', code: 'T18', name: 'Cinematic Chapter', formula: '3-Style', stageLabel: 'SPLIT TITLE', mood: 'cinematic' },
  { id: 't19', code: 'T19', name: 'Defiance', formula: '2-Style', stageLabel: 'SLASH WIPE', mood: 'rebellion' },
  { id: 't20', code: 'T20', name: 'Impact / Gravity', formula: '2-Style', stageLabel: 'NEON DROP', mood: 'impact' },
  { id: 't21', code: 'T21', name: 'Fashion Editorial', formula: '2-Style', stageLabel: 'VERT REVEAL', mood: 'luxury' },
  { id: 't22', code: 'T22', name: 'Music / Lyrical', formula: '2-Style', stageLabel: 'KARAOKE', mood: 'lyrical' },
  { id: 't23', code: 'T23', name: 'Comedy Punchline', formula: '3-Style', stageLabel: 'SETUP->POP', mood: 'comedy' },
  { id: 't24', code: 'T24', name: 'Philosophical Twist', formula: '3-Style', stageLabel: 'REDACT REVEAL', mood: 'philosophy' },
  { id: 't25', code: 'T25', name: 'Love Letter', formula: '2-Style', stageLabel: 'HANDWRITE', mood: 'love' },
  { id: 't26', code: 'T26', name: 'Street / Raw', formula: '2-Style', stageLabel: 'HARD CUT', mood: 'street' },
  { id: 't27', code: 'T27', name: 'Sci-Fi Futuristic', formula: '3-Style', stageLabel: 'CENTER EXPAND', mood: 'sci-fi' },
  { id: 't28', code: 'T28', name: 'Nostalgia / Memory', formula: '2-Style', stageLabel: 'GRAIN BLUR', mood: 'nostalgia' },
  { id: 't29', code: 'T29', name: 'Battle Cry', formula: '2-Style', stageLabel: 'SLAM', mood: 'battle' },
  { id: 't30', code: 'T30', name: 'Meditation / Zen', formula: '1-Style', stageLabel: 'BREATHE', mood: 'zen' },
  { id: 't31', code: 'T31', name: 'Newspaper Headline', formula: '3-Style', stageLabel: 'TYPEWRITER', mood: 'editorial' },
  { id: 't32', code: 'T32', name: 'Poetic Verse', formula: '3-Style', stageLabel: 'INK WIPE', mood: 'poetry' },
  { id: 't33', code: 'T33', name: 'Documentary', formula: '3-Style', stageLabel: 'DOC WIPE', mood: 'documentary' },
  { id: 't34', code: 'T34', name: 'Anime Energy', formula: '2-Style', stageLabel: 'SPEED IN', mood: 'anime' },
  { id: 't35', code: 'T35', name: 'Whispered Secret', formula: '1-Style', stageLabel: 'SECRET REVEAL', mood: 'whisper' },
];

const ADVANCED_TEMPLATE_STYLE = {
  t11: { font_family: 'Cormorant Garamond', font_size: 24, font_weight: '700', secondary_color: '#D4AF37', text_color: '#E8DFC8' },
  t12: { font_family: 'Lora', font_size: 24, font_style: 'italic', font_weight: '700', secondary_color: '#A78BFA', text_color: '#E0D9F0' },
  t13: { font_family: 'IBM Plex Mono', font_size: 23, font_weight: '700', secondary_color: '#00E5FF', text_color: '#B0F0F0', text_case: 'uppercase' },
  t14: { font_family: 'Libre Baskerville', font_size: 23, font_weight: '700', secondary_color: '#D4AF37', text_color: '#E8E0D0' },
  t15: { font_family: 'Oswald', font_size: 26, font_weight: '700', secondary_color: '#FF3D71', text_color: '#FFFFFF', text_case: 'uppercase' },
  t16: { font_family: 'Unbounded', font_size: 22, font_weight: '900', secondary_color: '#00E5FF', text_color: '#FFFFFF', text_case: 'uppercase' },
  t17: { font_family: 'Space Mono', font_size: 23, font_weight: '700', secondary_color: '#FF3D71', text_color: '#FFFFFF', text_case: 'uppercase' },
  t18: { font_family: 'Cinzel', font_size: 23, font_weight: '700', secondary_color: '#A78BFA', text_color: '#FFFFFF' },
  t19: { font_family: 'Archivo Black', font_size: 25, font_weight: '900', secondary_color: '#FF3D71', text_color: '#FFFFFF', text_case: 'uppercase' },
  t20: { font_family: 'Dela Gothic One', font_size: 24, font_weight: '900', secondary_color: '#39FF14', text_color: '#FFFFFF', text_case: 'uppercase' },
  t21: { font_family: 'Josefin Sans', font_size: 24, font_weight: '700', secondary_color: '#FFFFFF', text_color: '#FFFFFF', text_case: 'uppercase' },
  t22: { font_family: 'DM Serif Display', font_size: 24, font_weight: '700', secondary_color: '#D4AF37', text_color: '#D4C8FF' },
  t23: { font_family: 'Rubik', font_size: 24, font_weight: '700', secondary_color: '#D4AF37', text_color: '#F0F0E0' },
  t24: { font_family: 'Spectral', font_size: 23, font_weight: '600', secondary_color: '#A78BFA', text_color: '#D8D0E8' },
  t25: { font_family: 'Instrument Serif', font_size: 25, font_style: 'italic', font_weight: '700', secondary_color: '#FF3D71', text_color: '#F0D8DC' },
  t26: { font_family: 'Bungee', font_size: 24, font_weight: '900', secondary_color: '#FF3D71', text_color: '#FFFFFF', text_case: 'uppercase' },
  t27: { font_family: 'Exo 2', font_size: 23, font_weight: '700', secondary_color: '#00E5FF', text_color: '#00E5FF', text_case: 'uppercase' },
  t28: { font_family: 'Bitter', font_size: 23, font_weight: '700', secondary_color: '#D4AF37', text_color: '#D8CBB8' },
  t29: { font_family: 'Teko', font_size: 30, font_weight: '700', secondary_color: '#FF3D71', text_color: '#FFFFFF', text_case: 'uppercase' },
  t30: { font_family: 'Cormorant Garamond', font_size: 24, font_style: 'italic', font_weight: '600', secondary_color: '#FFFFFF', text_color: '#B4D2C8' },
  t31: { font_family: 'Playfair Display', font_size: 27, font_weight: '700', secondary_color: '#D4AF37', text_color: '#FFFFFF' },
  t32: { font_family: 'Bodoni Moda', font_size: 23, font_style: 'italic', font_weight: '700', secondary_color: '#A78BFA', text_color: '#D0CEE8' },
  t33: { font_family: 'Noto Sans', font_size: 23, font_weight: '700', secondary_color: '#00E5FF', text_color: '#FFFFFF' },
  t34: { font_family: 'Syne', font_size: 24, font_weight: '800', secondary_color: '#00E5FF', text_color: '#FFFFFF', text_case: 'uppercase' },
  t35: { font_family: 'Crimson Text', font_size: 24, font_style: 'italic', font_weight: '600', secondary_color: '#FFFFFF', text_color: '#DCD2DC' },
  t36: { font_family: 'Inter', font_size: 23, font_weight: '800', secondary_color: '#D4AF37', text_color: '#FFFFFF' },
  t37: { font_family: 'Rajdhani', font_size: 25, font_weight: '800', secondary_color: '#FFFFFF', text_color: '#FFFFFF', text_case: 'uppercase' },
  t38: { font_family: 'Libre Baskerville', font_size: 23, font_weight: '700', secondary_color: '#D4AF37', text_color: '#FFFFFF' },
  t39: { font_family: 'IBM Plex Mono', font_size: 22, font_weight: '700', secondary_color: '#FF3D71', text_color: '#FFFFFF', text_case: 'uppercase' },
  t40: { font_family: 'Crimson Text', font_size: 24, font_weight: '600', secondary_color: '#D4AF37', text_color: '#FFFFFF' },
};

function buildAppliedTemplateStyle(template) {
  return {
    template_id: template.id,
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

const BASIC_TEMPLATE_STYLE = {
  't-106': { font_family: 'Noto Sans', font_size: 24, font_weight: '800', text_color: '#FFFFFF', has_shadow: true, shadow_color: '#000000', shadow_blur: 3, shadow_offset_x: 1, shadow_offset_y: 2 },
  't-52': { font_family: 'Inter', font_size: 26, font_weight: '900', text_color: '#FFFFFF' },
  't-T4': { font_family: 'Playfair Display', font_size: 24, font_style: 'italic', text_color: '#f9a8d4' },
  't-WS1': { font_family: 'Raleway', font_size: 24, font_weight: '800', text_color: '#FFFFFF', secondary_color: '#FFE600', highlight_color: '#FFE600' },
  't-115': { font_family: 'Noto Sans', font_size: 28, font_weight: '900', font_style: 'italic', text_color: '#FFFFFF', secondary_color: '#39FF14', has_shadow: true, shadow_color: '#39FF14', shadow_blur: 10, shadow_offset_x: 0, shadow_offset_y: 0 },
  't-104': { font_family: 'Noto Sans', font_size: 26, font_weight: '900', text_color: '#FFFFFF', secondary_color: '#B28DFF', has_stroke: true, stroke_color: '#B28DFF', stroke_width: 2 },
  't-109': { font_family: 'Noto Sans', font_size: 26, font_weight: '900', text_color: '#FFFFFF', secondary_color: '#E01A1A', has_shadow: true, shadow_color: '#E01A1A', shadow_offset_x: 3, shadow_offset_y: 3, shadow_blur: 0 },
  't-95': { font_family: 'Montserrat', font_size: 30, text_color: '#FFFFFF', secondary_color: '#0055FF' },
  't-102': { font_family: 'Noto Sans', font_size: 22, font_weight: '800', text_color: '#1F2022', secondary_color: '#1F2022', has_background: true, background_color: '#FFFFFF', background_opacity: 1, background_padding: 10 },
  't-T5': { font_family: 'Montserrat', font_size: 24, font_weight: '800', font_style: 'italic', text_color: '#333333', has_background: true, background_color: '#ECF00F', background_opacity: 1, background_padding: 10 },
  't-T6': { font_family: 'Montserrat', font_size: 24, font_weight: '800', font_style: 'italic', text_color: '#FFFFFF', secondary_color: '#FFFFFF', has_background: true, background_color: '#F97316', background_opacity: 1, background_padding: 8 },
  't-103': { font_family: 'Noto Sans', font_size: 22, font_weight: '800', text_color: '#FFFFFF', has_background: true, background_color: '#1e1e1e', background_opacity: 0.85, background_padding: 10 },
  't-QW1': { font_family: 'Raleway', font_size: 20, font_weight: '500', font_style: 'italic', text_color: '#FFFFFF', secondary_color: '#FFFFFF', highlight_color: '#FFFFFF' },
  't-36': { font_family: 'Noto Sans', font_size: 26, font_weight: '900', text_color: '#FFFFFF', secondary_color: '#00ffb3' },
  't-105': { font_family: 'Noto Sans', font_size: 24, font_weight: '800', text_color: '#FFFFFF', has_stroke: true, stroke_color: '#000000', stroke_width: 1, has_shadow: true, shadow_color: '#000000', shadow_blur: 2, shadow_offset_x: 2, shadow_offset_y: 2 },
  't-124': { font_family: 'Inter', font_size: 26, font_weight: '900', text_color: '#FFFFFF', has_shadow: true, shadow_color: '#ffffff', shadow_offset_x: 4, shadow_offset_y: 4, shadow_blur: 0 },
  't-110': { font_family: 'Noto Sans', font_size: 24, font_weight: '800', text_color: '#FFFFFF', secondary_color: '#0066FF' },
  't-56': { font_family: 'Inter', font_size: 26, font_weight: '900', text_color: '#FFFFFF', secondary_color: '#0066FF' },
  't-119': { font_family: 'Inter', font_size: 24, font_weight: '800', text_color: '#FFFFFF', secondary_color: '#00FFCC' },
  't-12': { font_family: 'Special Elite', font_size: 22, text_color: '#cc0000', secondary_color: '#cc0000', has_shadow: true, shadow_color: '#cc0000', shadow_blur: 10, shadow_offset_x: 0, shadow_offset_y: 0 },
};

function buildAppliedBasicTemplateStyle(template) {
  return {
    template_id: template.id,
    ...(BASIC_TEMPLATE_STYLE[template.id] || {}),
    has_background: BASIC_TEMPLATE_STYLE[template.id]?.has_background || false,
    has_shadow: BASIC_TEMPLATE_STYLE[template.id]?.has_shadow || false,
    has_stroke: BASIC_TEMPLATE_STYLE[template.id]?.has_stroke || false,
    show_inactive: true,
    text_opacity: 1,
    position_y: 75,
    line_spacing: 1.25,
    word_spacing: 1,
  };
}

const FALLBACK_TEMPLATE_BLOCKS = {
  t11: [{ id: 't11-b0', type: 'styled', label: 'CLUSTER' }, { id: 't11-b1', type: 'styled', label: 'BLUR FOCUS' }, { id: 't11-b2', type: 'plain', label: 'PLAIN' }, { id: 't11-b3', type: 'wbw-rise', label: 'WBW RISE' }],
  t12: [{ id: 't12-b0', type: 'styled', label: 'TYPEWRITER' }, { id: 't12-b1', type: 'styled', label: 'SLIDE-UP' }, { id: 't12-b2', type: 'wbw-rise', label: 'WBW RISE' }, { id: 't12-b3', type: 'wbw-slide', label: 'WBW SLIDE' }],
  t13: [{ id: 't13-b0', type: 'styled', label: 'STAMP IN' }, { id: 't13-b1', type: 'styled', label: 'TICKER ROLL' }, { id: 't13-b2', type: 'wbw-rise', label: 'WBW RISE' }, { id: 't13-b3', type: 'wbw-slide', label: 'WBW SLIDE' }],
  t14: [{ id: 't14-b0', type: 'styled', label: '3D FLIP' }, { id: 't14-b1', type: 'styled', label: 'DROP BOUNCE' }, { id: 't14-b2', type: 'plain', label: 'PLAIN' }, { id: 't14-b3', type: 'wbw-rise', label: 'WBW RISE' }],
  t15: [{ id: 't15-b0', type: 'styled', label: 'SHAKE-IN' }, { id: 't15-b1', type: 'styled', label: 'CENTER POP' }, { id: 't15-b2', type: 'wbw-rise', label: 'WBW RISE' }, { id: 't15-b3', type: 'wbw-slide', label: 'WBW SLIDE' }],
  t16: [{ id: 't16-b0', type: 'styled', label: 'STACK RISE' }, { id: 't16-b1', type: 'styled', label: 'NEON FLICKER' }, { id: 't16-b2', type: 'wbw-rise', label: 'WBW RISE' }, { id: 't16-b3', type: 'wbw-slide', label: 'WBW SLIDE' }],
  t17: [{ id: 't17-b0', type: 'styled', label: 'GLITCH' }, { id: 't17-b1', type: 'styled', label: 'LETTER SNAP' }, { id: 't17-b2', type: 'plain', label: 'PLAIN' }, { id: 't17-b3', type: 'wbw-rise', label: 'WBW RISE' }],
  t18: [{ id: 't18-b0', type: 'styled', label: 'SPLIT TITLE' }, { id: 't18-b1', type: 'styled', label: 'FADE REVEAL' }, { id: 't18-b2', type: 'plain', label: 'PLAIN' }, { id: 't18-b3', type: 'wbw-rise', label: 'WBW RISE' }],
  t19: [{ id: 't19-b0', type: 'styled', label: 'SLASH WIPE' }, { id: 't19-b1', type: 'styled', label: 'RISE UP' }, { id: 't19-b2', type: 'wbw-rise', label: 'WBW RISE' }, { id: 't19-b3', type: 'wbw-slide', label: 'WBW SLIDE' }],
  t20: [{ id: 't20-b0', type: 'styled', label: 'NEON DROP' }, { id: 't20-b1', type: 'styled', label: 'IMPACT SETTLE' }, { id: 't20-b2', type: 'wbw-rise', label: 'WBW RISE' }, { id: 't20-b3', type: 'wbw-slide', label: 'WBW SLIDE' }],
  t21: [{ id: 't21-b0', type: 'styled', label: 'VERT REVEAL' }, { id: 't21-b1', type: 'styled', label: 'SPACING COLLAPSE' }, { id: 't21-b2', type: 'wbw-rise', label: 'WBW RISE' }, { id: 't21-b3', type: 'wbw-slide', label: 'WBW SLIDE' }],
  t22: [{ id: 't22-b0', type: 'styled', label: 'KARAOKE' }, { id: 't22-b1', type: 'styled', label: 'WAVE IN' }, { id: 't22-b2', type: 'wbw-rise', label: 'WBW RISE' }, { id: 't22-b3', type: 'wbw-slide', label: 'WBW SLIDE' }],
  t23: [{ id: 't23-b0', type: 'styled', label: 'SLIDE-RIGHT' }, { id: 't23-b1', type: 'plain', label: 'PLAIN' }, { id: 't23-b2', type: 'plain', label: 'PLAIN' }, { id: 't23-b3', type: 'styled', label: 'PUNCH POP' }],
  t24: [{ id: 't24-b0', type: 'styled', label: 'REDACT REVEAL' }, { id: 't24-b1', type: 'styled', label: 'SLOW RISE' }, { id: 't24-b2', type: 'plain', label: 'PLAIN' }, { id: 't24-b3', type: 'wbw-rise', label: 'WBW RISE' }],
  t25: [{ id: 't25-b0', type: 'styled', label: 'HANDWRITE' }, { id: 't25-b1', type: 'styled', label: 'SOFT RISE' }, { id: 't25-b2', type: 'wbw-rise', label: 'WBW RISE' }, { id: 't25-b3', type: 'wbw-slide', label: 'WBW SLIDE' }],
  t26: [{ id: 't26-b0', type: 'styled', label: 'HARD CUT' }, { id: 't26-b1', type: 'styled', label: 'FAST SLIDE' }, { id: 't26-b2', type: 'wbw-rise', label: 'WBW RISE' }, { id: 't26-b3', type: 'wbw-slide', label: 'WBW SLIDE' }],
  t27: [{ id: 't27-b0', type: 'styled', label: 'CENTER EXPAND' }, { id: 't27-b1', type: 'plain', label: 'PLAIN' }, { id: 't27-b2', type: 'plain', label: 'PLAIN' }, { id: 't27-b3', type: 'wbw-rise', label: 'WBW RISE' }],
  t28: [{ id: 't28-b0', type: 'styled', label: 'GRAIN BLUR' }, { id: 't28-b1', type: 'styled', label: 'SLOW FADE' }, { id: 't28-b2', type: 'wbw-rise', label: 'WBW RISE' }, { id: 't28-b3', type: 'wbw-slide', label: 'WBW SLIDE' }],
  t29: [{ id: 't29-b0', type: 'styled', label: 'SLAM' }, { id: 't29-b1', type: 'styled', label: 'HARD RISE' }, { id: 't29-b2', type: 'wbw-rise', label: 'WBW RISE' }, { id: 't29-b3', type: 'wbw-slide', label: 'WBW SLIDE' }],
  t30: [{ id: 't30-b0', type: 'styled', label: 'BREATHE' }, { id: 't30-b1', type: 'plain', label: 'PLAIN' }, { id: 't30-b2', type: 'plain', label: 'PLAIN' }, { id: 't30-b3', type: 'plain', label: 'PLAIN' }],
  t31: [{ id: 't31-b0', type: 'styled', label: 'TYPEWRITER' }, { id: 't31-b1', type: 'styled', label: '3D FLIP' }, { id: 't31-b2', type: 'plain', label: 'PLAIN' }, { id: 't31-b3', type: 'wbw-rise', label: 'WBW RISE' }],
  t32: [{ id: 't32-b0', type: 'styled', label: 'INK WIPE' }, { id: 't32-b1', type: 'styled', label: '3D FLIP' }, { id: 't32-b2', type: 'plain', label: 'PLAIN' }, { id: 't32-b3', type: 'wbw-rise', label: 'WBW RISE' }],
  t33: [{ id: 't33-b0', type: 'styled', label: 'DOC WIPE' }, { id: 't33-b1', type: 'styled', label: '3D FLIP' }, { id: 't33-b2', type: 'plain', label: 'PLAIN' }, { id: 't33-b3', type: 'wbw-rise', label: 'WBW RISE' }],
  t34: [{ id: 't34-b0', type: 'styled', label: 'SPEED IN' }, { id: 't34-b1', type: 'styled', label: 'POW POP' }, { id: 't34-b2', type: 'wbw-rise', label: 'WBW RISE' }, { id: 't34-b3', type: 'wbw-slide', label: 'WBW SLIDE' }],
  t35: [{ id: 't35-b0', type: 'styled', label: 'SECRET REVEAL' }, { id: 't35-b1', type: 'plain', label: 'PLAIN' }, { id: 't35-b2', type: 'plain', label: 'PLAIN' }, { id: 't35-b3', type: 'plain', label: 'PLAIN' }],
};

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

function extractTemplateOrder() {
  const ids = Array.from(
    sanitizedOriginalTemplateHtml.matchAll(/<div class="tcard" id="card-([^"]+)"/gi),
    ([, id]) => id,
  );
  return ids.length ? ids : Object.keys(ADVANCED_TEMPLATE_STYLE);
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

  return {
    ...fallback,
    code: decodeHtmlEntities(cardMarkup.match(/<span class="tcard-id">([^<]+)<\/span>/i)?.[1]?.trim() || fallback.code),
    name: decodeHtmlEntities(cardMarkup.match(/<span class="tcard-name">([^<]+)<\/span>/i)?.[1]?.trim() || fallback.name),
    formula: decodeHtmlEntities(cardMarkup.match(/<span class="formula-badge[^"]*">([^<]+)<\/span>/i)?.[1]?.trim() || fallback.formula),
    mood: decodeHtmlEntities(cardMarkup.match(/<span class="tcard-mood">([^<]+)<\/span>/i)?.[1]?.trim() || fallback.mood),
    stageLabel: decodeHtmlEntities(stageLabel),
    blocks,
    cardMarkup,
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

    if (name && id) {
      cards.push({
        id,
        code: id.replace(/^t-/, ''),
        name,
        desc,
        bg,
        cardMarkup,
      });
    }

    cardPattern.lastIndex = match.index + Math.max(cardMarkup.length, 1);
  }

  return cards;
}

const BASIC_TEMPLATE_PACK = extractBasicTemplateCards();

function extractOriginalStyle() {
  return sanitizedOriginalTemplateHtml.match(/<style>([\s\S]*?)<\/style>/i)?.[1] || '';
}

const iframeOverrides = (templateId) => `
  <style>
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
  </style>
`;

function buildTemplatePreviewDoc(templateId) {
  const cardMarkup = extractCardMarkup(templateId);
  const blockConfig = JSON.stringify(TEMPLATE_BLOCKS[templateId] || []);
  const previewScript = `
    <script>
      (() => {
        const HOLD = 2700;
        const EXIT = 360;
        const ENTER = 280;
        const GAP = 38;
        let runToken = 0;
        let activeBlockIndex = 0;
        let pendingTimers = [];
        const IMP_ENTRANCES = {
          'imp-gold': 'opposite-slide',
          'imp-rose': 'wipe',
          'imp-cyan': 'opposite',
          'imp-purple': 'roll',
          'imp-underline': 'wipe-up',
          'imp-italic': 'opposite-slide',
          'imp-bold': 'opposite',
          'imp-green': 'opposite-slide',
          'imp-weight': 'roll',
          'imp-space': 'wipe',
          'imp-flicker': 'opposite',
        };

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
          const type = block.querySelector('.wbw-rise') ? 'rise' : 'slide';
          const words = block.querySelectorAll('.w');
          words.forEach((word) => {
            word.classList.remove('in', 'fx');
            word.style.opacity = '0';
            if (!word.dataset.imp) {
              word.style.transform = type === 'rise' ? 'translateY(20px)' : 'translateX(-16px)';
            }
          });
          void block.offsetHeight;

          words.forEach((word) => {
            const isImp = !!word.dataset.imp;
            const impCls = word.dataset.impCls || '';
            const delay = isImp ? (parseInt(word.dataset.i, 10) * 65) + 120 : parseInt(word.dataset.i, 10) * 65;
            const dur = isImp ? 440 : 280;
            const entrance = isImp ? (IMP_ENTRANCES[impCls] || 'opposite') : null;

            schedule(() => {
              if (token !== runToken || !block.classList.contains('active')) return;
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
          const isWBW = block.dataset.type === 'wbw-rise' || block.dataset.type === 'wbw-slide' || block.dataset.type === 'wbw-seq' || block.dataset.type === 'wbw-seq-fade';
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

        function runSequencer(blocks, dotsEl, labelEl, startIndex = 0) {
          clearPendingTimers();
          runToken += 1;
          let current = Math.max(0, Math.min(blocks.length - 1, startIndex));
          const token = runToken;
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

          enterBlock(blocks, current, labelEl);
          updateDots(dotsEl, current);
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
          el.classList.remove('active');
          el.style.opacity = '0';
          el.style.visibility = 'hidden';
          el.style.zIndex = '0';
          el.querySelectorAll('.wbw-rise, .wbw-slide, .wbw-seq, .wbw-seq-fade').forEach((wbwEl) => buildWBW(wbwEl));
          return el;
        }).filter(Boolean);
        const dotsEl = document.getElementById('dots-${templateId}');
        const labelEl = document.getElementById('${templateId}-label');

        if ('${templateId}' === 't17') {
          const t17b1 = document.getElementById('t17-b1');
          if (t17b1) t17b1.dataset.type = 'styled';
        }

        if (blocks.length && dotsEl) {
          if (!dotsEl.dataset.dotHandlersBound) {
            dotsEl.dataset.dotHandlersBound = 'true';
            dotsEl.querySelectorAll('.dot').forEach((dot, dotIndex) => {
              dot.setAttribute('role', 'button');
              dot.setAttribute('tabindex', '0');
              dot.setAttribute('aria-label', 'Play caption line ' + (dotIndex + 1));
              dot.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                runSequencer(blocks, dotsEl, labelEl, dotIndex);
              });
              dot.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  runSequencer(blocks, dotsEl, labelEl, dotIndex);
                }
              });
            });
          }
          runSequencer(blocks, dotsEl, labelEl);
          setInterval(() => enforceSingleBlock(blocks, activeBlockIndex), 250);
          window.addEventListener('pageshow', () => runSequencer(blocks, dotsEl, labelEl));
          window.addEventListener('focus', () => runSequencer(blocks, dotsEl, labelEl));
          document.addEventListener('visibilitychange', () => {
            if (!document.hidden) runSequencer(blocks, dotsEl, labelEl);
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
        ${iframeOverrides(templateId)}
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
  </style>
`;

function buildBasicTemplatePreviewDoc(template) {
  const previewScript = `
    <script>
      (() => {
        const card = document.querySelector('.btcard');
        if (!card) return;

        let idx = 2;
        let currentBlock = -1;
        const blocks = Array.from(card.querySelectorAll('.bt-cap-block'));
        const dots = Array.from(card.querySelectorAll('.bt-prog-dots .dot'));
        const wordCount = Math.max(1, card.querySelectorAll('.word[data-wi]').length);

        function cls(wi, imp) {
          let className = 'word' + (imp ? ' imp' : '');
          if (wi <= idx) className += ' active';
          if (wi === idx) className += ' current';
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
            }, wordIndex * 210);
          });
        }

        function animateBlock(block) {
          block.querySelectorAll('.t-52 .word, .t-T4 .word, .t-106 .word, .t-T6 .word').forEach((word) => {
            word.style.opacity = '';
            word.style.transform = '';
            word.style.transition = '';
          });

          block.querySelectorAll('.t-52, .t-T4, .t-106, .t-T6, .t-56').forEach((wrapper) => {
            wrapper.querySelectorAll('.word').forEach((word) => {
              word.classList.add('active');
            });
          });

          block.querySelectorAll('.t-52').forEach((wrapper) => {
            wrapper.style.transition = 'none';
            wrapper.style.opacity = '0';
            wrapper.style.transform = 'translateY(44px)';
            setTimeout(() => {
              wrapper.style.transition = 'transform 700ms cubic-bezier(0.22,1,0.36,1), opacity 400ms ease';
              wrapper.style.opacity = '1';
              wrapper.style.transform = 'none';
            }, 30);
          });

          block.querySelectorAll('.t-106 .word, .t-T6 .word').forEach((word, wordIndex) => {
            word.style.transition = 'none';
            word.style.opacity = '0';
            word.style.transform = 'translateY(20px)';
            setTimeout(() => {
              word.style.transition = 'opacity 280ms ease, transform 280ms cubic-bezier(0.34,1.2,0.64,1)';
              word.style.opacity = '1';
              word.style.transform = 'none';
            }, 30 + (wordIndex * 65));
            setTimeout(() => {
              word.style.opacity = '1';
              word.style.transform = 'none';
            }, 520);
          });

          block.querySelectorAll('.t-WS1').forEach((wrapper) => {
            wrapper.classList.remove('ws-enter', 'ws-done');
            wrapper.querySelectorAll('.word').forEach((word, wordIndex) => {
              word.style.transition = 'none';
              word.style.animation = '';
              word.style.opacity = '';
              word.style.transform = '';
              word.style.filter = 'none';
              word.style.setProperty('--ws-delay', (90 + (wordIndex * 55)) + 'ms');
            });
            void wrapper.offsetWidth;
            wrapper.classList.add('ws-enter');
            setTimeout(() => {
              wrapper.classList.remove('ws-enter');
              wrapper.classList.add('ws-done');
            }, 90 + (wrapper.querySelectorAll('.word').length * 55) + 360);
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
          idx = (idx + 1) % wordCount;
          card.querySelectorAll('.word[data-wi]').forEach((word) => {
            word.className = cls(Number(word.dataset.wi || 0), word.dataset.imp === 'true');
          });
          const blockIndex = Math.max(0, Math.min(blocks.length - 1, Math.floor(idx / 4)));
          setBlock(blockIndex);
          activateWholeLine(blockIndex);
        }

        dots.forEach((dot, dotIndex) => {
          dot.addEventListener('click', () => {
            idx = Math.min((dotIndex * 4) + 2, wordCount - 1);
            card.querySelectorAll('.word[data-wi]').forEach((word) => {
              word.className = cls(Number(word.dataset.wi || 0), word.dataset.imp === 'true');
            });
            setBlock(dotIndex);
            activateWholeLine(dotIndex);
          });
        });

        setBlock(0);
        activateWholeLine(0);
        setInterval(tick, 700);
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
      </head>
      <body>${template.cardMarkup}${previewScript}</body>
    </html>
  `;
}

function TemplatePreviewFrame({ template }) {
  const frameRef = useRef(null);
  const [instanceKey, setInstanceKey] = useState(0);
  const wasVisibleRef = useRef(false);

  useEffect(() => {
    const node = frameRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const isVisible = Boolean(entry?.isIntersecting) && (entry?.intersectionRatio || 0) > 0.35;
        if (isVisible && !wasVisibleRef.current) {
          setInstanceKey((current) => current + 1);
        }
        wasVisibleRef.current = isVisible;
      },
      {
        threshold: [0, 0.35, 0.6],
      }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const srcDoc = useMemo(() => buildTemplatePreviewDoc(template.id), [template.id, instanceKey]);

  return (
    <div ref={frameRef} className="advanced-template-preview-frame">
      <iframe
        key={`${template.id}-${instanceKey}`}
        title={`${template.code} preview`}
        srcDoc={srcDoc}
        sandbox="allow-scripts"
        scrolling="no"
      />
    </div>
  );
}

function BasicTemplatePreviewFrame({ template }) {
  const srcDoc = useMemo(() => buildBasicTemplatePreviewDoc(template), [template]);

  return (
    <div className="advanced-template-preview-frame">
      <iframe
        title={`${template.name} preview`}
        srcDoc={srcDoc}
        sandbox="allow-scripts"
        scrolling="no"
      />
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
        <div className="advanced-template-section-label">
          <span>Advanced Templates</span>
          <small>{ADVANCED_TEMPLATE_PACK.length}</small>
        </div>
        {ADVANCED_TEMPLATE_PACK.map((template) => {
          const isActive = currentStyle?.template_id === template.id;

          return (
            <button
              key={template.id}
              type="button"
              onClick={() => onApplyTemplate?.(buildAppliedTemplateStyle(template))}
              className={`advanced-template-card ${isActive ? 'is-active' : ''}`}
            >
              <TemplatePreviewFrame template={template} />
              {isActive && <Check className="absolute right-2 top-2 z-10 h-3.5 w-3.5 text-[#ffb629]" />}
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
          );
        })}

        <div className="advanced-template-section-label">
          <span>Basic Templates</span>
          <small>{BASIC_TEMPLATE_PACK.length}</small>
        </div>
        {BASIC_TEMPLATE_PACK.map((template) => {
          const isActive = currentStyle?.template_id === template.id;

          return (
            <button
              key={`basic-${template.id}-${template.name}`}
              type="button"
              onClick={() => onApplyTemplate?.(buildAppliedBasicTemplateStyle(template))}
              className={`advanced-template-card basic-template-card ${isActive ? 'is-active' : ''}`}
            >
              <BasicTemplatePreviewFrame template={template} />
              {isActive && <Check className="absolute right-2 top-2 z-10 h-3.5 w-3.5 text-[#ffb629]" />}
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
          );
        })}
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
