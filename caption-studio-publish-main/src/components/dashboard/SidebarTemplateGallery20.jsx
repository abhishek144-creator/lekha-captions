import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, History, Sparkles, X, Search, Star, RotateCcw } from 'lucide-react';
import { useLazyVisible } from './useLazyVisible';
import {
  isExportableTemplateCandidate,
  templateMatchesQuery,
  useTemplateFavorites,
  useRecentTemplates,
} from './templateBrowserUtils.js';
import { readCssDeclaration } from './templateStyleUtils.js';
import { getLcMotionSchedule } from './templateMotionConfig.js';
import '../../styles/advancedTemplateLibrary.css';
import legacyTemplateHtml from '../../assets/lekha-captions-20-templates.html?raw';
import lcTemplateHtml2 from '../../assets/lekha-captions-lc-2.html?raw';
import lcTemplateHtml3 from '../../assets/lekha-captions-lc-3.html?raw';
import lcTemplateHtml4 from '../../assets/lekha-captions-lc-4.html?raw';
import lcTemplateHtml5 from '../../assets/lekha-captions-lc-5.html?raw';

function sanitizeTemplateHtml(value = '') {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\s+bis_skin_checked="[^"]*"/gi, '')
    .replace(/<!-- saved from url=.*?-->\s*/gi, '');
}

const sanitizedLegacyTemplateHtml = sanitizeTemplateHtml(legacyTemplateHtml);
const lcTemplateHtmlSets = [lcTemplateHtml2, lcTemplateHtml3, lcTemplateHtml4, lcTemplateHtml5];
const sanitizedLcTemplateHtml = lcTemplateHtmlSets.map(sanitizeTemplateHtml);
const LC_FONT_LINKS = `
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Archivo:ital,wght@0,500;0,600;0,700;0,800;0,900;1,600&family=Fraunces:ital,opsz,wght@1,9..144,500;1,9..144,700&family=Great+Vibes&display=swap" rel="stylesheet">
`;
const legacyTemplateCss = (() => {
  const matches = [...legacyTemplateHtml.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)];
  return matches.map(m => m[1]).join('\n');
})();
const lcTemplateCss = lcTemplateHtmlSets.map(extractOriginalStyle).join('\n');

const VIGIL_BASE_TEMPLATE_STYLE = {
  font_family: 'Raleway',
  font_size: 22,
  font_weight: '300',
  text_color: '#FFFFFF',
};

const TEMPLATE_STYLE_MAP = {
  A1: { ...VIGIL_BASE_TEMPLATE_STYLE },
  A2: { font_family: 'Anton', font_size: 26, font_weight: '400', text_color: '#FFFFFF', text_case: 'uppercase' },
  A3: { font_family: 'Gloock', font_size: 24, font_style: 'italic', text_color: '#FFFFFF' },
  A4: { font_family: 'Bitter', font_size: 22, font_weight: '700', text_color: '#FFFFFF' },
  A5: { font_family: 'Gloock', font_size: 24, font_style: 'italic', text_color: '#FFFFFF' },
  B1: { font_family: 'Bodoni Moda', font_size: 25, font_style: 'italic', text_color: '#FFFFFF' },
  B2: { font_family: 'Cormorant Garamond', font_size: 24, font_style: 'italic', text_color: '#FFFFFF' },
  B3: { font_family: 'Oxanium', font_size: 22, text_color: '#39FF14', secondary_color: '#39FF14', text_case: 'uppercase' },
  B4: { font_family: 'Spectral', font_size: 23, text_color: '#FFFFFF' },
  B5: { font_family: 'Bebas Neue', font_size: 26, text_color: '#FFFFFF', text_case: 'uppercase' },
  C1: { font_family: 'Oswald', font_size: 24, text_color: '#FFFFFF', text_case: 'uppercase' },
  C2: { font_family: 'Cinzel', font_size: 22, text_color: '#FFFFFF' },
  C3: { font_family: 'Libre Baskerville', font_size: 23, font_style: 'italic', text_color: '#FFFFFF' },
  C4: { font_family: 'DM Serif Display', font_size: 23, text_color: '#FFFFFF' },
  C5: { font_family: 'Cormorant Garamond', font_size: 24, font_style: 'italic', text_color: '#FFFFFF' },
  D1: { font_family: 'Archivo Black', font_size: 26, text_color: '#FFFFFF', text_case: 'uppercase' },
  D2: { font_family: 'Playfair Display', font_size: 23, text_color: '#FFFFFF' },
  D3: { font_family: 'Oxanium', font_size: 23, text_color: '#00E5FF', secondary_color: '#39FF14', text_case: 'uppercase' },
  D4: { font_family: 'Cinzel', font_size: 22, text_color: '#FFFFFF' },
  D5: { font_family: 'DM Serif Display', font_size: 23, text_color: '#FFFFFF' },
};

const TEMPLATE_STYLE_FALLBACK = {
  ...VIGIL_BASE_TEMPLATE_STYLE,
};

function replaceMarkupText(markup = '', pattern, replacementText = '') {
  return String(markup || '').replace(pattern, (...parts) => {
    const match = parts[0];
    const prefix = parts[1] || '';
    const suffix = parts[3] || parts[2] || '';
    return prefix && suffix ? `${prefix}${replacementText}${suffix}` : match;
  });
}

function replaceTemplateNameInMarkup(markup = '', displayName = '') {
  // Do not reintroduce the malformed separator shown before legacy names.
  return replaceMarkupText(markup, /(<span class="cnm">)([\s\S]*?)(<\/span>)/i, ` ${displayName}`);
}

function preserveUploadedTemplateName(template = {}) {
  const displayName = template.originalName || template.name || '';
  return {
    ...template,
    originalName: displayName,
    displayName,
    cardMarkup: replaceTemplateNameInMarkup(template.cardMarkup, displayName),
  };
}

const LEFT_TEMPLATE_ONE_WORD_NAMES = {
  T166: 'Messy', T167: 'Mountains', T168: 'Freedom', T169: 'Mornings', T170: 'Wealth',
  T171: 'Purpose', T172: 'Breakthrough', T173: 'Truth', T174: 'Rival', T175: 'Calculated',
  T176: 'Reason', T177: 'Launch', T178: 'Stillness', T179: 'Clarity', T180: 'Legacy',
  T181: 'Simple', T182: 'Focus', T183: 'Compound', T184: 'Frugal', T185: 'Peace',
  T186: 'Magnetic', T187: 'Grind', T188: 'Honesty', T189: 'Momentum', T190: 'Measured',
  T191: 'Cinematic', T192: 'Builder', T193: 'Breath', T194: 'Craft', T195: 'Heritage',
  T196: 'Boring', T197: 'Time', T198: 'Results', T199: 'Savings', T200: 'Guard',
  T201: 'Space', T202: 'Scroll', T203: 'Standard', T204: 'Timing', T205: 'Intent',
  T206: 'Attention', T207: 'Ship', T208: 'Depth', T209: 'Carve', T210: 'Stacked',
  T211: 'Doubt', T212: 'Start', T213: 'Future', T214: 'Patience', T215: 'Ownership',
  T216: 'Begin', T217: 'Step', T218: 'Kindness', T219: 'Chapter', T220: 'Leap',
  T221: 'Hook', T222: 'Beta', T223: 'Silence', T224: 'Revision', T225: 'Greatness',
};

function getOneWordTemplateName(template = {}) {
  const assignedName = LEFT_TEMPLATE_ONE_WORD_NAMES[String(template.id || '').trim()];
  if (assignedName) return assignedName;
  const sourceName = String(template.originalName || template.name || template.id || '').trim();
  const words = sourceName
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const meaningfulWord = words.find((word) => !/^(a|an|the)$/i.test(word));
  return meaningfulWord || words[0] || String(template.id || 'Template');
}

function applyOneWordTemplateName(template = {}) {
  const originalName = template.originalName || template.name || '';
  const displayName = getOneWordTemplateName({ ...template, originalName });
  return {
    ...template,
    originalName,
    displayName,
    cardMarkup: replaceTemplateNameInMarkup(template.cardMarkup, displayName),
  };
}

// Preserve the authored template accent families so the template thumbnail,
// canvas preview, and exported overlay do not drift from one another.
const BRIGHT_YELLOW = '#DDAA03';
const BRIGHT_GREEN = '#22FF66';
const BRIGHT_RED = '#FF2E2E';
const BRIGHT_CYAN = '#00E5FF';
const BRIGHT_BLUE = '#0066FF';
const BRIGHT_ORANGE = '#F97316';
const BRIGHT_ROSE = '#FF3D71';
const BRIGHT_PURPLE = '#A78BFA';
const TEMPLATE_ACCENT_COLOR_MAP = {
  gold: BRIGHT_YELLOW,
  yellow: BRIGHT_YELLOW,
  orange: BRIGHT_ORANGE,
  green: BRIGHT_GREEN,
  cyan: BRIGHT_CYAN,
  blue: BRIGHT_BLUE,
  red: BRIGHT_RED,
  rose: BRIGHT_ROSE,
  pink: BRIGHT_ROSE,
  purple: BRIGHT_PURPLE,
};

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

function extractCompleteDiv(markup, startIndex) {
  const tagPattern = /<\/?div\b[^>]*>/gi;
  tagPattern.lastIndex = startIndex;
  let depth = 0;
  let match;

  while ((match = tagPattern.exec(markup))) {
    depth += match[0].startsWith('</') ? -1 : 1;
    if (depth === 0) return markup.slice(startIndex, tagPattern.lastIndex);
  }

  return '';
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
    .replace(/\sclass="\s+/gi, ' class="')
    .replace(/\s+data-ti="[^"]*"/gi, '')
    .replace(/\s+data-si="[^"]*"/gi, '');
}

function extractOriginalStyle(markup) {
  const matches = [...String(markup).matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)];
  return matches.map(m => m[1]).join('\n');
}

function escapeRegExp(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseCssBody(cssText = '', selector = '') {
  if (!cssText || !selector) return '';
  const match = cssText.match(new RegExp(`${escapeRegExp(selector)}\\s*\\{([^}]*)\\}`, 'i'));
  return match?.[1] || '';
}

function pickFirstCssBody(cssText = '', selectors = []) {
  for (const selector of selectors) {
    const body = parseCssBody(cssText, selector);
    if (body) return body;
  }
  return '';
}

function readDeclaration(body = '', property = '') {
  return readCssDeclaration(body, property);
}

function parseClampOrPxSize(value = '') {
  const pxValues = Array.from(String(value).matchAll(/(-?\d+(?:\.\d+)?)px/gi), (parts) => Number(parts[1])).filter(Number.isFinite);
  if (!pxValues.length) return null;
  if (String(value).includes('clamp(') && pxValues.length > 1) {
    return Math.round((pxValues[0] + pxValues[pxValues.length - 1]) / 2);
  }
  return Math.round(pxValues[pxValues.length - 1]);
}

function normalizeColorValue(value = '') {
  const normalized = String(value).trim();
  if (!normalized) return '';
  const rgbaMatch = normalized.match(/^rgba?\(([^)]+)\)$/i);
  if (!rgbaMatch) return normalized;
  const parts = rgbaMatch[1].split(',').map((part) => part.trim());
  const [r = '255', g = '255', b = '255'] = parts;
  const alpha = parts[3] !== undefined ? Number(parts[3]) : 1;
  if ([r, g, b].every((part) => Number(part) >= 245) && alpha < 1) {
    return '#FFFFFF';
  }
  return alpha < 1 && [r, g, b].every((part) => Number.isFinite(Number(part)))
    ? `rgb(${Number(r)}, ${Number(g)}, ${Number(b)})`
    : normalized;
}

function extractAccentColorFromMarkup(markup = '') {
  const lcColorMatch = String(markup).match(/--(?:lc-scene-highlight|tint|hc)\s*:\s*(#[0-9a-f]{3,8})/i);
  if (lcColorMatch?.[1]) return lcColorMatch[1].toUpperCase();
  const match = String(markup).match(/\b(ns\d+|imp|neon)-([a-z]+)\b/i);
  if (!match?.[2]) return '';
  const family = match[1].toLowerCase();
  const colorName = match[2].toLowerCase();
  if (family.startsWith('ns') && colorName === 'rose') return '#FF6B1A';
  return TEMPLATE_ACCENT_COLOR_MAP[colorName] || '';
}

function extractTemplateStyleFromPreview(template) {
  const cssText = template.format === 'lc'
    ? lcTemplateCss
    : legacyTemplateCss;
  const className = template.cardClass || '';
  const baseRuleBody = pickFirstCssBody(cssText, [
    `.${className} .wbw-line`,
    `.${className} .plain-s`,
    `.${className} .sw-line`,
    `.${className} .cap-text`,
  ]);

  const fontFamily = readDeclaration(baseRuleBody, 'font-family')
    .split(',')[0]
    .replace(/['"]/g, '')
    .trim();
  const fontSize = parseClampOrPxSize(readDeclaration(baseRuleBody, 'font-size'));
  const fontWeight = readDeclaration(baseRuleBody, 'font-weight') || '';
  const fontStyle = readDeclaration(baseRuleBody, 'font-style') || '';
  const textCase = readDeclaration(baseRuleBody, 'text-transform') || '';
  const letterSpacing = readDeclaration(baseRuleBody, 'letter-spacing') || '';
  const lineHeight = readDeclaration(baseRuleBody, 'line-height') || '';
  const textColor = normalizeColorValue(readDeclaration(baseRuleBody, 'color')) || '#FFFFFF';
  const accentColor = extractAccentColorFromMarkup(template.cardMarkup);

  return {
    ...(fontFamily ? { font_family: fontFamily } : {}),
    ...(fontSize ? { font_size: fontSize } : {}),
    ...(fontWeight ? { font_weight: fontWeight } : {}),
    ...(fontStyle && fontStyle !== 'normal' ? { font_style: fontStyle } : {}),
    ...(textCase && textCase !== 'none' ? { text_case: textCase } : {}),
    ...(letterSpacing.endsWith('px') ? { letter_spacing: Number.parseFloat(letterSpacing) || 0 } : {}),
    ...(lineHeight && !lineHeight.endsWith('px') ? { line_spacing: Number.parseFloat(lineHeight) || 1.25 } : {}),
    ...(textColor ? { text_color: textColor } : {}),
    ...(accentColor ? { secondary_color: accentColor } : {}),
  };
}

function detectTemplatePreviewLayout(template) {
  const markup = template?.cardMarkup || '';
  if (/\bwbw-line\b|\bwbw\b/i.test(markup)) return 'word-by-word';
  if (/\bsw-line\b|\bsw-w\b/i.test(markup)) return 'sticky-wave';
  if (/\bpos\d/i.test(markup) || /\bpr\b/i.test(markup)) return 'stack';
  if (/\bplain-s\b/i.test(markup)) return 'plain';
  return 'word-by-word';
}

function detectTemplatePreviewEffect(template) {
  const markup = template?.cardMarkup || '';
  const newWbwMatch = markup.match(/\bwbw-line\s+([^"]+)/i);
  if (newWbwMatch?.[1]) return newWbwMatch[1].split(/\s+/)[0] || '';
  const legacyWbwMatch = markup.match(/\bwbw\s+([^"]+)/i);
  if (legacyWbwMatch?.[1]) return legacyWbwMatch[1].split(/\s+/)[0] || '';
  if (/\bsw-line\b|\bsw-w\b/i.test(markup)) return 'sticky-wave';
  if (/\bplain-s\b/i.test(markup)) return 'plain';
  return '';
}

function extractLegacyCards() {
  const cards = [];
  const cardPattern = /<div class="card [^"]+"/gi;
  let match;

  while ((match = cardPattern.exec(sanitizedLegacyTemplateHtml))) {
    const cardMarkup = extractCompleteDiv(sanitizedLegacyTemplateHtml, match.index);
    const id = stripHtml(cardMarkup.match(/<span class="cid">([\s\S]*?)<\/span>/i)?.[1] || '');
    const name = stripHtml(cardMarkup.match(/<span class="cnm">([\s\S]*?)<\/span>/i)?.[1] || '').replace(/^[.\s·-]+/, '');
    const badges = Array.from(cardMarkup.matchAll(/<span class="bg [^"]*">([\s\S]*?)<\/span>/gi), (parts) => stripHtml(parts[1]));
    const cardClass = cardMarkup.match(/<div class="card ([^"\s]+)"/i)?.[1] || '';

    if (id && name) {
      cards.push({
        id,
        name,
        mood: badges[0] || '',
        formula: badges[1] || '',
        cardClass,
        cardMarkup: stripPreviewRuntimeState(cardMarkup),
        format: 'legacy',
      });
    }

    cardPattern.lastIndex = match.index + Math.max(cardMarkup.length, 1);
  }

  return cards;
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

const LC_MASTER_COLORS = [
  '#FFB000', '#00D4FF', '#FF2E7A', '#76FF03', '#B86BFF', '#FF6A00', '#00F5A0',
  '#FF3030', '#3D7CFF', '#FFE600', '#FF00C8', '#00E5FF', '#A3FF12', '#FF9500',
];

const LC_FIRST_SCENE_ACCENTS = Object.freeze({
  T174: '#FFD166',
  T189: '#6EE7FF',
  T204: '#FF8FA3',
  T219: '#C9A7FF',
});

const LC_MERGE_LAYOUTS = new Set(['splice', 'serifbreak', 'baseline', 'weld']);
const LC_TIMING = {
  staggerMs: 280,
  bodyDurationMs: 430,
  heroDurationMs: 560,
  wbwDurationMs: 110,
};

const LC_ANIMATION_MAP = {
  rise: 'rise',
  drop: 'drop',
  fade: 'fade',
  slidel: 'slide-l',
  slider: 'slide-r',
  wipe: 'wipe',
  wipeup: 'wipe-up',
  pop: 'pop',
  elastic: 'pop',
  press: 'pop',
  punch: 'pop',
  stamp: 'pop',
  swing: 'roll',
  roll: 'roll',
  rolly: 'roll',
  climb: 'rise',
  type: 'wipe',
  slot: 'wipe',
  flick: 'fade',
  whip: 'slide-l',
  track: 'pop',
  skew: 'skew-snap',
  shutter: 'stencil',
  stretch: 'pop',
  unfold: 'wipe-up',
};

function mapLcAnimation(anim = '') {
  return LC_ANIMATION_MAP[String(anim || '').trim()] || 'rise';
}

function getLcAnimationEase(anim = '') {
  const key = String(anim || '').trim();
  if (key === 'type') return 'steps(8,end)';
  if (key === 'flick') return 'linear';
  return 'cubic-bezier(.22,.68,.26,1)';
}

function parseLcTemplateSet(markup = '') {
  const source = String(markup || '');
  const marker = 'const TPLS=[';
  const start = source.indexOf(marker);
  if (start < 0) return [];
  const bodyStart = start + marker.length;
  const bodyEnd = source.indexOf('];', bodyStart);
  if (bodyEnd < 0) return [];
  const body = source.slice(bodyStart, bodyEnd);
  try {
    return Function(`
      const C = (layout, ...lines) => ({ k: 'c', layout, lines });
      const L = (cls, text, anim, o = {}) => Object.assign({ cls, text, anim }, o);
      const N = (text, o = {}) => Object.assign({ k: 'n', text }, o);
      const T = (id, name, style, scenes) => ({ id, name, style, scenes });
      return [${body}];
    `)();
  } catch (error) {
    console.warn('Unable to parse LC templates', error);
    return [];
  }
}

function lcWords(value = '') {
  return String(value || '').trim().split(/\s+/).filter(Boolean);
}

function buildLcWordSpan(word, {
  cls = '',
  hero = false,
  heroCol = '',
  ul = false,
  anim = '',
  delay = 0,
  duration = LC_TIMING.bodyDurationMs,
  on = false,
} = {}) {
  const className = ['w', cls, hero ? 'hero is-emphasis' : '', ul ? 'ul' : '', on ? 'on' : '']
    .filter(Boolean)
    .join(' ');
  const style = [];
  if (hero && heroCol) style.push(`color:${heroCol}`);
  if (anim) {
    style.push(`animation:${anim} ${duration}ms ${getLcAnimationEase(anim)} ${delay}ms forwards`);
  }
  const attrs = [
    `class="${escapeHtml(className)}"`,
    anim ? `data-anim="${escapeHtml(mapLcAnimation(anim))}"` : '',
    anim ? `data-lc-anim="${escapeHtml(anim)}"` : '',
    anim ? `data-lc-duration="${duration}"` : '',
    anim ? `data-lc-ease="${escapeHtml(getLcAnimationEase(anim))}"` : '',
    anim ? `data-lc-delay="${delay}"` : '',
    style.length ? `style="${escapeHtml(style.join(';'))}"` : '',
  ].filter(Boolean).join(' ');
  return `<span ${attrs}>${escapeHtml(word)}</span>`;
}

function renderLcFlow(segs = [], ctx, fuse = false) {
  let first = true;
  let end = 0;
  const html = [];
  segs.forEach((seg) => {
    lcWords(seg.text).forEach((word) => {
      if (!first && !fuse) html.push(' ');
      first = false;
      const duration = seg.hero ? LC_TIMING.heroDurationMs : LC_TIMING.bodyDurationMs;
      const delay = ctx.n * LC_TIMING.staggerMs;
      html.push(buildLcWordSpan(word, {
        cls: seg.spanCls || '',
        hero: !!seg.hero,
        heroCol: ctx.heroCol,
        ul: !!seg.ul,
        anim: seg.anim || '',
        delay,
        duration,
        on: !seg.anim,
      }));
      if (seg.anim) {
        ctx.n += 1;
        end = Math.max(end, delay + duration);
      }
    });
  });
  return { html: html.join(''), end };
}

function findLc3HeroRange(words = [], hero = '') {
  const heroWords = lcWords(hero);
  const strip = (value) => String(value || '').replace(/[^0-9A-Za-z']/g, '').toLowerCase();
  if (!heroWords.length) return [-1, -1];
  for (let index = 0; index <= words.length - heroWords.length; index += 1) {
    const matched = heroWords.every((word, offset) => strip(words[index + offset]) === strip(word));
    if (matched) return [index, index + heroWords.length];
  }
  return [-1, -1];
}

function renderLcNormalScene(scene = {}, ctx, templateId = '') {
  const isFormulaSet = Number(String(templateId).replace(/\D/g, '')) >= 181;
  const mode = scene.mode || (scene.anim ? 'anim' : 'plain');
  const keywordClassMap = {
    underline: 'ns3hero',
    box: 'ns3box',
    mark: 'ns3mark',
    bracket: 'ns3bracket',
    dot: 'ns3dot',
  };
  let end = 0;

  const putWords = (words, heroFlags = []) => {
    const output = [];
    words.forEach((word, index) => {
      if (output.length) output.push(' ');
      const hero = !!heroFlags[index];
      // LC3's engine only knows ns3hero; LC4/LC5 map styledHero through the
      // full keyword set (underline/box/mark/bracket/dot). LC3 data never sets
      // keywordStyle, so the shared lookup stays faithful to both engines.
      const cls = hero
        ? (isFormulaSet
          ? (scene.styledHero ? (keywordClassMap[scene.keywordStyle] || 'ns3hero') : 'hero')
          : (scene.type === 3 ? (keywordClassMap[scene.keywordStyle] || 'ns3hero') : 'hero'))
        : '';
      let anim = '';
      let duration = hero ? LC_TIMING.heroDurationMs : LC_TIMING.bodyDurationMs;
      let delay = ctx.n * LC_TIMING.staggerMs;
      let on = false;
      // 'block' animates the whole wrap once (LC4/LC5 engines); its words are
      // statically visible and the wrap carries the motion (attrs added below).
      if (mode === 'static' || mode === 'plain' || mode === 'block') {
        on = true;
      } else if (mode === 'wbw') {
        anim = 'fade';
        duration = LC_TIMING.wbwDurationMs;
      } else {
        anim = hero ? (scene.heroAnim || 'pop') : (scene.bodyAnim || 'rise');
      }
      output.push(buildLcWordSpan(word, {
        cls,
        hero,
        heroCol: ctx.heroCol,
        anim,
        delay,
        duration,
        on,
      }));
      if (anim) {
        ctx.n += 1;
        end = Math.max(end, delay + duration);
      }
    });
    return output.join('');
  };

  if (isFormulaSet) {
    const words = lcWords(scene.text);
    const [heroStart, heroEnd] = findLc3HeroRange(words, scene.hero);
    const isHero = words.map((_, index) => heroStart >= 0 && index >= heroStart && index < heroEnd);
    let inner = '';
    if (scene.drop && heroStart >= 0) {
      const topWords = words.filter((_, index) => !isHero[index]);
      const bottomWords = words.filter((_, index) => isHero[index]);
      inner = `<div class="ns3top">${putWords(topWords, topWords.map(() => false))}</div><div class="ns3bot">${putWords(bottomWords, bottomWords.map(() => true))}</div>`;
    } else {
      inner = putWords(words, isHero);
    }
    const wrapClass = `nline${mode === 'plain' ? ' plainwrap' : ''}`;
    if (mode === 'plain') end = 240;
    if (mode === 'static') end = 0;
    // Whole-line block animation (source: wrap.style.animation = `${a} ${HERO_DUR}ms …`).
    // Carried as data attributes so the preview runtime, canvas stamp, and
    // export activate can each stamp the same authored wrap animation.
    let wrapAttrs = '';
    if (mode === 'block') {
      const blockAnim = scene.blockAnim || 'rise';
      wrapAttrs = ` data-lc-block-anim="${escapeHtml(blockAnim)}" data-lc-block-duration="${LC_TIMING.heroDurationMs}" data-lc-block-ease="${escapeHtml(getLcAnimationEase(blockAnim))}"`;
      end = LC_TIMING.heroDurationMs;
    }
    return { html: `<div class="${wrapClass}"${wrapAttrs}>${inner}</div>`, end };
  }

  const text = String(scene.text || '').trim();
  const hero = String(scene.hero || '').trim();
  let pre = [];
  let heroWords = [];
  let post = [];
  if (hero && text.includes(hero)) {
    const heroStart = text.indexOf(hero);
    pre = lcWords(text.slice(0, heroStart));
    heroWords = [hero];
    post = lcWords(text.slice(heroStart + hero.length));
  } else {
    pre = lcWords(text);
  }
  let inner = '';
  if (scene.type === 3 && scene.drop && hero) {
    inner = `<div class="ns3top">${putWords([...pre, ...post], [...pre, ...post].map(() => false))}</div><div class="ns3bot">${putWords(heroWords, heroWords.map(() => true))}</div>`;
  } else {
    inner = [
      putWords(pre, pre.map(() => false)),
      heroWords.length ? putWords(heroWords, heroWords.map(() => true)) : '',
      putWords(post, post.map(() => false)),
    ].filter(Boolean).join(' ');
  }
  const wrapClass = `nline${mode === 'plain' ? ' plainwrap' : ''}`;
  if (mode === 'plain') end = 240;
  return { html: `<div class="${wrapClass}">${inner}</div>`, end };
}

function getLcPalette(templateIndex = 0, templateId = '') {
  const palette = [0, 1, 2, 3, 4].map((offset) => (
    LC_MASTER_COLORS[((templateIndex * 3) + (offset * 2)) % LC_MASTER_COLORS.length]
  ));
  if (LC_FIRST_SCENE_ACCENTS[templateId]) palette[0] = LC_FIRST_SCENE_ACCENTS[templateId];
  return palette;
}

function buildLcSceneMarkup(scene = {}, sceneIndex = 0, template = {}) {
  const palette = template.pal || getLcPalette(0);
  const heroCol = palette[sceneIndex % palette.length] || LC_MASTER_COLORS[0];
  const ctx = { n: 0, heroCol };
  if (scene.k === 'n') {
    return renderLcNormalScene(scene, ctx, template.id).html;
  }

  const layout = escapeHtml(scene.layout || 'pyramid');
  if (LC_MERGE_LAYOUTS.has(scene.layout)) {
    const segs = (scene.lines || []).map((line) => ({
      text: line.text,
      anim: line.anim,
      hero: line.hero,
      spanCls: [line.cls, line.font].filter(Boolean).join(' '),
      ul: line.ul,
    }));
    const lineMarkup = renderLcFlow(segs, ctx, scene.layout === 'weld').html;
    return `<div class="cpt ${layout}" style="--hc:${heroCol}"><div class="ln">${lineMarkup}</div></div>`;
  }

  const lines = (scene.lines || []).map((line) => {
    const lineClass = ['ln', line.cls, line.font, line.hero ? 'hero' : '', line.box ? 'box' : '']
      .filter(Boolean)
      .map(escapeHtml)
      .join(' ');
    const lineStyle = [
      line.box ? `background:${heroCol}` : '',
      line.box ? 'color:#101114' : '',
      line.hero && !line.box ? `color:${heroCol}` : '',
    ].filter(Boolean).join(';');
    const savedHeroCol = ctx.heroCol;
    if (line.box) ctx.heroCol = '#101114';
    const lineMarkup = renderLcFlow([{
      text: line.text,
      anim: line.anim,
      spanCls: '',
      ul: line.ul,
      hero: line.hero,
    }], ctx).html;
    ctx.heroCol = savedHeroCol;
    return `<div class="${lineClass}"${lineStyle ? ` style="${escapeHtml(lineStyle)}"` : ''}>${lineMarkup}</div>`;
  }).join('');
  return `<div class="cpt ${layout}" data-lc-scene="${sceneIndex}" style="--hc:${heroCol}">${lines}</div>`;
}

function buildLcCardMarkup(template = {}, templateIndex = 0) {
  const palette = getLcPalette(templateIndex, template.id);
  template.pal = palette;
  const sceneMarkup = (template.scenes || []).map((scene, sceneIndex) => (
    `<div class="sb${sceneIndex === 0 ? ' active' : ''}" data-si="${sceneIndex}" style="--lc-scene-highlight:${palette[sceneIndex % palette.length]}"><div class="cap"><div class="scene">${buildLcSceneMarkup(scene, sceneIndex, template)}</div></div></div>`
  )).join('');
  const dots = (template.scenes || []).map((_, sceneIndex) => `<i class="${sceneIndex === 0 ? 'on' : ''}"></i>`).join('');
  const cardClass = `lc-${String(template.id || '').toLowerCase()}`;
  const tint = palette[0] || LC_MASTER_COLORS[0];
  return `<div class="card lc-card ${cardClass}" data-lc-template="true" style="--tint:${tint}"><div class="card-top"><div><span class="cid">${escapeHtml(template.id)}</span><span class="cnm"> · ${escapeHtml(template.name)}</span></div><div class="badges"><span class="bg m">LC</span><span class="bg s${template.style}">${template.style} STYLE</span></div></div><div class="stage">${sceneMarkup}</div><div class="dots">${dots}</div></div>`;
}

function extractLcCards() {
  return lcTemplateHtmlSets.flatMap((markup) => (
    parseLcTemplateSet(markup).map((template, templateIndex) => {
      const formula = `${template.style} Style`;
      const cardMarkup = buildLcCardMarkup(template, templateIndex);
      return {
        id: template.id,
        name: template.name,
        displayName: template.name,
        mood: `LC ${template.id}`,
        formula,
        cardClass: `lc-${String(template.id || '').toLowerCase()}`,
        cardMarkup,
        format: 'lc',
        styleGroup: Number(template.style) || 1,
      };
    })
  ));
}

export const LEGACY_TEMPLATE_CARDS = Array.from(
  extractLegacyCards().reduce((uniqueCards, card) => {
    const uniqueKey = card.id || card.name;
    if (!uniqueCards.has(uniqueKey)) {
      uniqueCards.set(uniqueKey, preserveUploadedTemplateName(card));
    }
    return uniqueCards;
  }, new Map()).values(),
);

const LC_TEMPLATE_CARDS = Array.from(
  extractLcCards().reduce((uniqueCards, card) => {
    const uniqueKey = card.id || card.name;
    if (!uniqueCards.has(uniqueKey)) {
      uniqueCards.set(uniqueKey, applyOneWordTemplateName(card));
    }
    return uniqueCards;
  }, new Map()).values(),
);

const LC_STYLE_1_TEMPLATE_CARDS = LC_TEMPLATE_CARDS.filter((template) => template.styleGroup === 1);
const LC_STYLE_2_TEMPLATE_CARDS = LC_TEMPLATE_CARDS.filter((template) => template.styleGroup === 2);
const LC_STYLE_3_TEMPLATE_CARDS = LC_TEMPLATE_CARDS.filter((template) => template.styleGroup === 3);

const ALL_TEMPLATE_CARDS = [
  ...LEGACY_TEMPLATE_CARDS,
  ...LC_TEMPLATE_CARDS,
];
const SELECTABLE_TEMPLATE_CARDS = [...LC_TEMPLATE_CARDS];
const TOTAL_TEMPLATE_COUNT = SELECTABLE_TEMPLATE_CARDS.length;
const TEMPLATE_PREVIEW_PROGRESS_EVENT = 'lekha-sidebar-template-preview-progress';
const TEMPLATE_PREVIEW_JUMP_EVENT = 'lekha-sidebar-template-preview-jump';
const getTemplateStyleKey = (template) => `${template?.format || 'legacy'}::${template?.id || ''}`;
const EXTRACTED_TEMPLATE_STYLE_MAP = Object.fromEntries(
  ALL_TEMPLATE_CARDS.map((template) => [getTemplateStyleKey(template), extractTemplateStyleFromPreview(template)]),
);

function getTemplatePreviewDotCount(template) {
  const markup = String(template?.cardMarkup || '');
  const dotsSection = markup.match(/<div[^>]*class="[^"]*\bdots\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  const dotSource = dotsSection?.[1] || '';
  const dotMatches = dotSource.match(/<(?:i|span)\b[^>]*>/gi);
  const blockMatches = markup.match(/class="[^"]*\b(?:sb|sblock)\b[^"]*"/gi);

  if (Array.isArray(dotMatches) && dotMatches.length > 0) {
    return dotMatches.length;
  }
  if (Array.isArray(blockMatches) && blockMatches.length > 0) {
    return blockMatches.length;
  }
  return 0;
}

export function buildTemplateStyle(template) {
  const extractedStyle = EXTRACTED_TEMPLATE_STYLE_MAP[getTemplateStyleKey(template)] || {};
  const baseStyle = TEMPLATE_STYLE_MAP[template.id]
    || (Object.keys(extractedStyle).length ? extractedStyle : TEMPLATE_STYLE_FALLBACK);
  const templateAccent = extractAccentColorFromMarkup(template.cardMarkup);

  return {
    template_id: `sidebar-${template.id}`,
    template_20_id: template.id,
    template_source: template.format === 'lc'
      ? 'lekha-lc'
      : 'lekha-20',
    template_class: template.cardClass || '',
    template_name: template.displayName || template.name || '',
    template_layout: detectTemplatePreviewLayout(template),
    template_effect: detectTemplatePreviewEffect(template),
    template_markup: template.cardMarkup || '',
    ...baseStyle,
    ...(templateAccent ? {
      secondary_color: templateAccent,
      highlight_color: templateAccent,
      emphasis_color: templateAccent,
      karaoke_color_1: templateAccent,
    } : {}),
    has_background: false,
    has_shadow: false,
    has_stroke: false,
    text_opacity: 1,
    position_y: 75,
    line_spacing: baseStyle.line_spacing || 1.25,
    word_spacing: 1,
    show_inactive: true,
  };
}

function buildPreviewDoc(template) {
  const previewTemplateId = JSON.stringify(template.id);
  const sourceStyleHtml = template.format === 'lc'
    ? sanitizedLcTemplateHtml.join('\n')
    : sanitizedLegacyTemplateHtml;
  const previewScript = `
    <script>
      (() => {
        const card = document.querySelector('.card');
        if (!card) return;
        const stage = card.querySelector('.stage');
        const blocks = Array.from(card.querySelectorAll('.sb, .sblock'));
        const dots = Array.from(card.querySelectorAll('.dots i'));
        const label = card.querySelector('.slbl, .stage-lbl');
        const HOLD = 4800;
        const EXIT_MS = 560;
        const GAP = 120;
        const WBW_DELAY = 125;
        const WBW_DUR = 540;
        const POS_STAGGER = 320;
        const POS_DUR = 560;
        const WBW_CLASSES = ['wrise','wslide','wslider','wroll','wwipe','wwipeup','wfade','wscale','wflip','wbounce','wdiag','wexpand','wskew','wstencil','wlift','wbw-rise','wbw-slide'];
        const IMP_ANIMS = {
              'imp-bold':'drop',
              'imp-gold':'wipe',
              'imp-rose':'diagonal-wipe',
              'imp-cyan':'skew-snap',
              'imp-green':'pop',
              'imp-purple':'roll',
              'imp-italic':'lift',
              'imp-weight':'stamp',
              'imp-underline':'wipe-up',
              'imp-box':'drift',
              'imp-space':'stencil',
              'imp-flicker':'flicker',
              'imp-typewrite':'typewrite',
              'imp-stamp':'stamp'
            };
        let currentIndex = 0;
        let timer = null;
        const animationTimers = new Set();
        const setTimeout = (fn, delay) => {
          const id = window.setTimeout(() => {
            animationTimers.delete(id);
            fn();
          }, delay);
          animationTimers.add(id);
          return id;
        };

        function clearAnimationTimers() {
          animationTimers.forEach((id) => window.clearTimeout(id));
          animationTimers.clear();
        }

        const getLcMotionSchedule = ${getLcMotionSchedule.toString()};

        function getLcAnimation(element, fallbackDuration) {
          const anim = element && element.dataset ? (element.dataset.lcAnim || '') : '';
          if (!anim) return null;
          const duration = Number(element.dataset.lcDuration);
          const delay = Number(element.dataset.lcDelay);
          return {
            anim,
            duration: Number.isFinite(duration) && duration > 0 ? duration : fallbackDuration,
            ease: element.dataset.lcEase || 'cubic-bezier(.22,.68,.26,1)',
            delay: Number.isFinite(delay) && delay >= 0 ? delay : null
          };
        }

        function emitProgress(index) {
          try {
            window.parent.postMessage({
              type: '${TEMPLATE_PREVIEW_PROGRESS_EVENT}',
              templateId: ${previewTemplateId},
              activeIndex: index,
              total: Math.max(dots.length, blocks.length),
            }, '*');
          } catch (error) {
            void error;
          }
        }

        function getBlockType(block) {
          if (block.querySelector('[data-lc-anim], [data-lc-block-anim]')) return 'lc';
          const wbwSelector = WBW_CLASSES.map((className) => '.' + className + ' .w').concat('.w[data-lc-anim]').join(',');
          if (block.querySelector(wbwSelector)) return 'wbw';
          if (block.querySelector('.sw, .sw-w')) return 'pos';
          if (block.querySelector('.plain-s')) return 'plain';
          return 'plain';
        }

        function wbwInitWord(word) {
          const parent = word.parentElement;
          word.style.transition = 'none';
          word.style.clipPath = 'inset(0 0 0 0)';
          word.style.transformOrigin = '';
          word.style.filter = '';
          if (getLcAnimation(word, WBW_DUR)) {
            word.style.animation = 'none';
            word.style.transform = 'none';
            word.style.clipPath = '';
            word.style.opacity = '0';
            return;
          }
          if (parent.classList.contains('wrise') || parent.classList.contains('wbw-rise')) { word.style.transform = 'translateY(22px)'; word.style.opacity = '0'; }
          else if (parent.classList.contains('wslide') || parent.classList.contains('wbw-slide')) { word.style.transform = 'translateX(-26px)'; word.style.opacity = '0'; }
          else if (parent.classList.contains('wslider')) { word.style.transform = 'translateX(26px)'; word.style.opacity = '0'; }
          else if (parent.classList.contains('wroll')) { word.style.transform = 'translateY(14px) rotate(-6deg)'; word.style.transformOrigin = 'left bottom'; word.style.opacity = '0'; }
          else if (parent.classList.contains('wwipe')) { word.style.clipPath = 'inset(0 100% 0 0)'; word.style.transform = 'none'; word.style.opacity = '1'; }
          else if (parent.classList.contains('wwipeup')) { word.style.clipPath = 'inset(100% 0 0 0)'; word.style.transform = 'none'; word.style.opacity = '1'; }
          else if (parent.classList.contains('wfade')) { word.style.transform = 'none'; word.style.opacity = '0'; }
          else if (parent.classList.contains('wscale')) { word.style.transform = 'scale(0.5)'; word.style.opacity = '0'; }
          else if (parent.classList.contains('wflip')) { word.style.transform = 'rotateX(-80deg)'; word.style.transformOrigin = 'center bottom'; word.style.opacity = '0'; }
          else if (parent.classList.contains('wbounce')) { word.style.transform = 'translateY(-22px)'; word.style.opacity = '0'; }
          else if (parent.classList.contains('wdiag')) { word.style.transform = 'translate(-16px,16px)'; word.style.opacity = '0'; }
          else if (parent.classList.contains('wexpand')) { word.style.transform = 'scaleX(0.15)'; word.style.transformOrigin = 'center'; word.style.opacity = '0'; }
          else if (parent.classList.contains('wskew')) { word.style.transform = 'skewX(-18deg) translateX(-12px)'; word.style.opacity = '0'; }
          else if (parent.classList.contains('wstencil')) { word.style.clipPath = 'inset(0 50% 0 50%)'; word.style.transform = 'none'; word.style.opacity = '1'; }
          else if (parent.classList.contains('wlift')) { word.style.transform = 'translateY(-22px)'; word.style.opacity = '0'; }
          else { word.style.transform = 'none'; word.style.opacity = '0'; }
        }

        function wbwAnimWord(word, delay) {
          const lcAnimation = getLcAnimation(word, WBW_DUR);
          const playbackDelay = lcAnimation && lcAnimation.delay !== null ? lcAnimation.delay : delay;
          setTimeout(() => {
            if (lcAnimation) {
              word.style.transition = 'none';
              word.style.transform = 'none';
              word.style.clipPath = '';
              word.style.opacity = '';
              word.style.animation = lcAnimation.anim + ' ' + lcAnimation.duration + 'ms ' + lcAnimation.ease + ' 0ms forwards';
              word.classList.add('in');
              return;
            }
            const parent = word.parentElement;
            let transition = 'transform ' + WBW_DUR + 'ms cubic-bezier(0.22, 1, 0.36, 1), opacity ' + (WBW_DUR - 40) + 'ms ease';
            if (parent.classList.contains('wwipe') || parent.classList.contains('wwipeup') || parent.classList.contains('wstencil')) {
              transition = 'clip-path ' + WBW_DUR + 'ms cubic-bezier(0.22, 1, 0.36, 1)';
            }
            word.style.transition = transition;
            word.style.transform = 'none';
            word.style.opacity = '1';
            word.style.clipPath = 'inset(0 0 0 0)';
            word.classList.add('in');
          }, playbackDelay);
        }

        function wbwAnimIMP(word, delay) {
          const impClass = Array.from(word.classList).find((className) => IMP_ANIMS[className]);
          if (!impClass) return false;

          const impType = IMP_ANIMS[impClass];
          const d = delay + 120;
          const dur = WBW_DUR + 160;
          const ease = 'cubic-bezier(0.22,1,0.36,1)';

          word.style.transition = 'none';
          word.style.clipPath = 'inset(0 0 0 0)';

          if (impType === 'wipe') {
            word.style.clipPath = 'inset(0 100% 0 0)';
            word.style.opacity = '1';
            word.style.transform = 'none';
            void word.offsetHeight;
            setTimeout(() => {
              word.style.transition = 'clip-path ' + dur + 'ms ' + ease;
              word.style.clipPath = 'inset(0 0 0 0)';
              word.classList.add('in');
            }, d);
            return true;
          }

          if (impType === 'wipe-up') {
            word.style.clipPath = 'inset(100% 0 0 0)';
            word.style.opacity = '1';
            word.style.transform = 'none';
            void word.offsetHeight;
            setTimeout(() => {
              word.style.transition = 'clip-path ' + dur + 'ms ' + ease;
              word.style.clipPath = 'inset(0 0 0 0)';
              word.classList.add('in');
            }, d);
            return true;
          }

          if (impType === 'diagonal-wipe') {
            word.style.clipPath = 'polygon(0 0,0 0,0 100%,0 100%)';
            word.style.opacity = '1';
            word.style.transform = 'none';
            void word.offsetHeight;
            setTimeout(() => {
              word.style.transition = 'clip-path ' + dur + 'ms ' + ease;
              word.style.clipPath = 'polygon(0 0,100% 0,100% 100%,0 100%)';
              word.classList.add('in');
            }, d);
            return true;
          }

          if (impType === 'blur-sharpen') {
            word.style.transform = 'none';
            word.style.opacity = '0.4';
            word.style.filter = 'blur(6px)';
            void word.offsetHeight;
            setTimeout(() => {
              word.style.transition = 'filter ' + dur + 'ms ease, opacity ' + (dur - 60) + 'ms ease';
              word.style.filter = 'blur(0)';
              word.style.opacity = '1';
              word.classList.add('in');
            }, d);
            return true;
          }

          if (impType === 'stencil') {
            word.style.clipPath = 'inset(0 50% 0 50%)';
            word.style.opacity = '1';
            word.style.transform = 'none';
            void word.offsetHeight;
            setTimeout(() => {
              word.style.transition = 'clip-path ' + dur + 'ms ' + ease;
              word.style.clipPath = 'inset(0 0 0 0)';
              word.classList.add('in');
            }, d);
            return true;
          }

          if (impType === 'skew-snap') {
            word.style.transform = 'skewX(-18deg) translateX(-12px)';
            word.style.opacity = '0';
            void word.offsetHeight;
            setTimeout(() => {
              word.style.transition = 'transform ' + dur + 'ms ' + ease + ', opacity ' + (dur - 60) + 'ms ease';
              word.style.transform = 'skewX(0) translateX(0)';
              word.style.opacity = '1';
              word.classList.add('in');
            }, d);
            return true;
          }

          if (impType === 'roll') {
            word.style.transformOrigin = 'center bottom';
            word.style.transform = 'rotateX(-90deg)';
            word.style.opacity = '0';
            void word.offsetHeight;
            setTimeout(() => {
              word.style.transition = 'transform ' + dur + 'ms ' + ease + ', opacity ' + (dur - 80) + 'ms ease';
              word.style.transform = 'rotateX(0)';
              word.style.opacity = '1';
              word.classList.add('in');
            }, d);
            return true;
          }

          if (impType === 'rotate-in') {
            word.style.transformOrigin = 'left bottom';
            word.style.transform = 'rotate(-8deg) translateY(10px)';
            word.style.opacity = '0';
            void word.offsetHeight;
            setTimeout(() => {
              word.style.transition = 'transform ' + dur + 'ms ' + ease + ', opacity ' + (dur - 60) + 'ms ease';
              word.style.transform = 'rotate(0) translateY(0)';
              word.style.opacity = '1';
              word.classList.add('in');
            }, d);
            return true;
          }

          if (impType === 'drop') {
            word.style.transform = 'translateY(-30px)';
            word.style.opacity = '0';
            void word.offsetHeight;
            setTimeout(() => {
              word.style.transition = 'transform ' + dur + 'ms ' + ease + ', opacity ' + (dur - 60) + 'ms ease';
              word.style.transform = 'translateY(0)';
              word.style.opacity = '1';
              word.classList.add('in');
            }, d);
            return true;
          }

          if (impType === 'drop-in') {
            word.style.transform = 'translateY(-30px)';
            word.style.opacity = '0';
            void word.offsetHeight;
            setTimeout(() => {
              word.style.transition = 'transform ' + dur + 'ms cubic-bezier(0.34,1.56,0.64,1), opacity ' + (dur - 60) + 'ms ease';
              word.style.transform = 'translateY(0)';
              word.style.opacity = '1';
              word.classList.add('in');
            }, d);
            return true;
          }

          if (impType === 'pop') {
            word.style.transform = 'scale(0.82)';
            word.style.opacity = '0';
            void word.offsetHeight;
            setTimeout(() => {
              word.style.transition = 'transform ' + dur + 'ms ' + ease + ', opacity ' + (dur - 60) + 'ms ease';
              word.style.transform = 'scale(1)';
              word.style.opacity = '1';
              word.classList.add('in');
            }, d);
            return true;
          }

          if (impType === 'elastic') {
            word.style.transform = 'translateY(35px)';
            word.style.opacity = '0';
            void word.offsetHeight;
            setTimeout(() => {
              word.style.transition = 'transform ' + (dur + 80) + 'ms cubic-bezier(0.34,1.56,0.64,1), opacity ' + (dur - 60) + 'ms ease';
              word.style.transform = 'translateY(0)';
              word.style.opacity = '1';
              word.classList.add('in');
            }, d);
            return true;
          }

          if (impType === 'lift') {
            word.style.transform = 'translateY(-20px)';
            word.style.opacity = '0';
            void word.offsetHeight;
            setTimeout(() => {
              word.style.transition = 'transform ' + dur + 'ms ' + ease + ', opacity ' + (dur - 60) + 'ms ease';
              word.style.transform = 'translateY(0)';
              word.style.opacity = '1';
              word.classList.add('in');
            }, d);
            return true;
          }

          if (impType === 'drift') {
            word.style.transform = 'translateX(-12px) translateY(8px)';
            word.style.opacity = '0';
            void word.offsetHeight;
            setTimeout(() => {
              word.style.transition = 'transform ' + (dur + 30) + 'ms ' + ease + ', opacity ' + (dur - 60) + 'ms ease';
              word.style.transform = 'translateX(0) translateY(0)';
              word.style.opacity = '1';
              word.classList.add('in');
            }, d);
            return true;
          }

          if (impType === 'stamp') {
            word.style.transform = 'scale(1.3)';
            word.style.opacity = '0';
            void word.offsetHeight;
            setTimeout(() => {
              word.style.transition = 'none';
              word.style.opacity = '1';
              word.style.transform = 'scale(1.3)';
              setTimeout(() => {
                word.style.transition = 'transform 180ms ' + ease;
                word.style.transform = 'scale(1)';
                word.classList.add('in');
              }, 60);
            }, d);
            return true;
          }

          if (impType === 'typewrite') {
            word.style.transform = 'none';
            word.style.opacity = '0';
            void word.offsetHeight;
            setTimeout(() => {
              word.style.transition = 'opacity ' + WBW_DUR + 'ms ease';
              word.style.opacity = '1';
              word.classList.add('in');
              setTimeout(() => word.classList.add('fx'), WBW_DUR + 50);
            }, d);
            return true;
          }

          if (impType === 'flicker') {
            word.style.transform = 'none';
            word.style.opacity = '0';
            void word.offsetHeight;
            setTimeout(() => {
              word.style.transition = 'opacity 40ms';
              word.style.opacity = '1';
              word.classList.add('in');
              setTimeout(() => word.classList.add('fx'), 50);
            }, d);
            return true;
          }

          return false;
        }

        function animateWBW(block) {
          const selector = WBW_CLASSES.map((className) => '.' + className + ' .w').concat('.w[data-lc-anim]').join(',');
          const words = block.querySelectorAll(selector);
          if (!words.length) return;
          words.forEach((word) => wbwInitWord(word));
          void block.offsetHeight;
          words.forEach((word, index) => {
            const handled = wbwAnimIMP(word, index * WBW_DELAY);
            if (!handled) wbwAnimWord(word, index * WBW_DELAY);
          });
        }

        function resetWBW(block) {
          const selector = WBW_CLASSES.map((className) => '.' + className + ' .w').concat('.w[data-lc-anim]').join(',');
          block.querySelectorAll(selector).forEach((word) => {
            word.classList.remove('in', 'fx');
            wbwInitWord(word);
          });
        }

        function posInitWord(word) {
          if (getLcAnimation(word, POS_DUR)) {
            word.style.transition = 'none';
            word.style.animation = 'none';
            word.style.clipPath = '';
            word.style.transformOrigin = '';
            word.style.transform = 'none';
            word.style.opacity = '0';
            return;
          }
          const anim = word.dataset.anim || 'rise';
          word.style.transition = 'none';
          word.style.clipPath = '';
          word.style.transformOrigin = '';
          switch (anim) {
            case 'rise': word.style.transform = 'translateY(20px)'; word.style.opacity = '0'; break;
            case 'drop': word.style.transform = 'translateY(-28px)'; word.style.opacity = '0'; break;
            case 'fade': word.style.transform = 'none'; word.style.opacity = '0'; break;
            case 'slide-l': word.style.transform = 'translateX(-28px)'; word.style.opacity = '0'; break;
            case 'slide-r': word.style.transform = 'translateX(28px)'; word.style.opacity = '0'; break;
            case 'slide-slow': word.style.transform = 'translateX(-32px)'; word.style.opacity = '0'; break;
            case 'pop': word.style.transform = 'scale(0.82)'; word.style.opacity = '0'; break;
            case 'lift': word.style.transform = 'translateY(-16px)'; word.style.opacity = '0'; break;
            case 'drift': word.style.transform = 'translateX(-12px) translateY(8px)'; word.style.opacity = '0'; break;
            case 'bounce': word.style.transform = 'translateY(-20px)'; word.style.opacity = '0'; break;
            case 'wipe': word.style.clipPath = 'inset(0 100% 0 0)'; word.style.opacity = '1'; word.style.transform = 'none'; break;
            case 'wipe-up': word.style.clipPath = 'inset(100% 0 0 0)'; word.style.opacity = '1'; word.style.transform = 'none'; break;
            case 'diagonal': word.style.transform = 'translate(-12px, 12px)'; word.style.opacity = '0'; break;
            case 'diagonal-wipe': word.style.clipPath = 'polygon(0 0, 0 0, 0 100%, 0 100%)'; word.style.opacity = '1'; word.style.transform = 'none'; break;
            case 'roll': word.style.transform = 'translateY(12px) rotate(-6deg)'; word.style.opacity = '0'; word.style.transformOrigin = 'left bottom'; break;
            case 'skew-snap': word.style.transform = 'skewX(-18deg) translateX(-10px)'; word.style.opacity = '0'; break;
            case 'stencil': word.style.clipPath = 'inset(0 50% 0 50%)'; word.style.opacity = '1'; word.style.transform = 'none'; break;
            default: word.style.transform = 'translateY(20px)'; word.style.opacity = '0'; break;
          }
        }

        function posAnimWord(word, delay) {
          const lcAnimation = getLcAnimation(word, POS_DUR);
          const playbackDelay = lcAnimation && lcAnimation.delay !== null ? lcAnimation.delay : delay;
          setTimeout(() => {
            if (lcAnimation) {
              word.style.transition = 'none';
              word.style.transform = 'none';
              word.style.clipPath = '';
              word.style.opacity = '';
              word.style.animation = lcAnimation.anim + ' ' + lcAnimation.duration + 'ms ' + lcAnimation.ease + ' 0ms forwards';
              word.classList.add('in');
              return;
            }
            const anim = word.dataset.anim || 'rise';
            let transition = 'transform ' + POS_DUR + 'ms cubic-bezier(0.22, 1, 0.36, 1), opacity ' + (POS_DUR - 40) + 'ms ease';
            if (anim === 'wipe' || anim === 'wipe-up' || anim === 'diagonal-wipe' || anim === 'stencil') {
              transition = 'clip-path ' + POS_DUR + 'ms cubic-bezier(0.22, 1, 0.36, 1)';
            } else if (anim === 'slide-slow') {
              transition = 'transform 750ms cubic-bezier(0.16,1,0.3,1), opacity 550ms ease';
            }
            word.style.transition = transition;
            word.style.transform = 'none';
            word.style.opacity = '1';
            if (anim === 'diagonal-wipe') {
              word.style.clipPath = 'polygon(0 0, 100% 0, 100% 100%, 0 100%)';
            } else {
              word.style.clipPath = 'inset(0 0 0 0)';
            }
            word.classList.add('in');
          }, playbackDelay);
        }

        function animatePosWords(block) {
          const words = block.querySelectorAll('.sw');
          if (!words.length) return;
          words.forEach((word) => posInitWord(word));
          void block.offsetHeight;
          words.forEach((word, index) => posAnimWord(word, index * POS_STAGGER));
        }

        function resetPosWords(block) {
          block.querySelectorAll('.sw').forEach((word) => {
            word.classList.remove('in');
            posInitWord(word);
          });
        }

        function resetBlock(block) {
          clearAnimationTimers();
          block.classList.remove('active');
          block.style.cssText = 'opacity:0;visibility:hidden;pointer-events:none';
          resetWBW(block);
          resetPosWords(block);
        }

        function stampLcMotion(block) {
          const nodes = Array.from(block.querySelectorAll('[data-lc-anim]'));
          const schedule = getLcMotionSchedule(nodes.map((node) => ({
            animation: node.dataset.lcAnim,
            duration: node.dataset.lcDuration,
            delay: node.dataset.lcDelay,
            ease: node.dataset.lcEase,
          })));

          nodes.forEach((node) => {
            node.style.animation = 'none';
            node.style.transition = 'none';
            node.style.opacity = '';
            node.style.transform = '';
            node.style.clipPath = '';
            node.classList.remove('in', 'visible');
          });
          void block.getBoundingClientRect();
          nodes.forEach((node, index) => {
            const entry = schedule.entries[index];
            if (!entry || !entry.animation) return;
            node.style.animation = entry.animation + ' ' + entry.durationMs + 'ms ' + entry.ease + ' ' + entry.delayMs + 'ms both';
          });

          block.querySelectorAll('[data-lc-block-anim]').forEach((node) => {
            const schedule = getLcMotionSchedule([{
              animation: node.dataset.lcBlockAnim,
              duration: node.dataset.lcBlockDuration,
              delay: node.dataset.lcBlockDelay,
              ease: node.dataset.lcBlockEase,
            }]);
            const entry = schedule.entries[0];
            if (!entry || !entry.animation) return;
            node.style.animation = 'none';
            void node.getBoundingClientRect();
            node.style.animation = entry.animation + ' ' + entry.durationMs + 'ms ' + entry.ease + ' ' + entry.delayMs + 'ms both';
          });

          block.querySelectorAll('.w.on, .sw.on, .sw-w.on').forEach((node) => {
            node.style.animation = 'none';
            node.style.opacity = '1';
            node.style.transform = 'none';
            node.style.clipPath = 'inset(0 0 0 0)';
          });
          block.querySelectorAll('.plainwrap').forEach((node) => {
            node.style.animation = 'none';
            void node.getBoundingClientRect();
            node.style.animation = 'fade 240ms ease 0ms both';
          });
        }

        function enterBlock(block) {
          const type = getBlockType(block);
          resetBlock(block);
          void block.offsetHeight;
          if (type === 'lc') {
            block.style.transition = 'none';
            block.style.visibility = 'visible';
            block.style.pointerEvents = 'auto';
            block.style.opacity = '1';
            block.classList.add('active');
            stampLcMotion(block);
          } else if (type === 'plain') {
            block.style.transition = 'none';
            block.style.visibility = 'visible';
            block.style.pointerEvents = 'auto';
            block.style.opacity = '1';
            block.classList.add('active');
            block.querySelectorAll('.plainwrap').forEach((element) => {
              element.style.animation = 'none';
              element.style.opacity = '0';
              void element.offsetWidth;
              element.style.animation = '';
            });
            block.querySelectorAll('[data-lc-block-anim]').forEach((element) => {
              element.style.animation = 'none';
              void element.offsetWidth;
              element.style.animation = element.dataset.lcBlockAnim + ' '
                + (element.dataset.lcBlockDuration || 560) + 'ms '
                + (element.dataset.lcBlockEase || 'cubic-bezier(.22,.68,.26,1)') + ' 0ms both';
            });
          } else if (type === 'wbw') {
            block.style.transition = 'none';
            block.style.visibility = 'visible';
            block.style.pointerEvents = 'auto';
            block.style.opacity = '1';
            block.classList.add('active');
            requestAnimationFrame(() => requestAnimationFrame(() => animateWBW(block)));
          } else {
            block.style.transition = 'none';
            block.style.visibility = 'visible';
            block.style.pointerEvents = 'auto';
            block.style.opacity = '1';
            block.classList.add('active');
            requestAnimationFrame(() => requestAnimationFrame(() => animatePosWords(block)));
          }
        }

        function exitBlock(block, callback) {
          const type = getBlockType(block);
          if (type === 'plain') {
            block.style.transition = 'none';
            block.style.opacity = '0';
            requestAnimationFrame(() => {
              block.classList.remove('active');
              block.style.cssText = 'opacity:0;visibility:hidden;pointer-events:none';
              setTimeout(callback, GAP);
            });
            return;
          }
          block.style.transition = 'opacity ' + EXIT_MS + 'ms ease';
          block.style.opacity = '0';
          setTimeout(() => {
            block.classList.remove('active');
            block.style.cssText = 'opacity:0;visibility:hidden;pointer-events:none';
            resetWBW(block);
            resetPosWords(block);
            setTimeout(callback, GAP);
          }, EXIT_MS);
        }

        function show(index) {
          const block = blocks[index];
          if (!block) return;
          blocks.forEach((otherBlock, otherIndex) => {
            if (otherIndex !== index) {
              otherBlock.classList.remove('active');
              otherBlock.style.cssText = 'opacity:0;visibility:hidden;pointer-events:none';
            }
          });
          dots.forEach((dot, dotIndex) => dot.classList.toggle('on', dotIndex === index));
          emitProgress(index);
          if (label) {
            const nextLabel = block.dataset.label
              || (block.querySelector('.plain-s') ? 'Plain' : '')
              || (block.querySelector('.wbw, .wbw-rise, .wbw-slide') ? 'Word by Word' : '');
            if (nextLabel) label.textContent = nextLabel;
          }
          enterBlock(block);
        }

        function cycle() {
          exitBlock(blocks[currentIndex], () => {
            currentIndex = (currentIndex + 1) % blocks.length;
            show(currentIndex);
            timer = window.setTimeout(cycle, HOLD);
          });
        }

        function jumpTo(index) {
          if (!blocks[index]) return;
          if (timer) {
            window.clearTimeout(timer);
            timer = null;
          }
          clearAnimationTimers();
          blocks.forEach((block) => resetBlock(block));
          currentIndex = index;
          show(currentIndex);
          if (blocks.length > 1) {
            timer = window.setTimeout(cycle, HOLD);
          }
        }

        blocks.forEach((block) => resetBlock(block));
        currentIndex = 0;
        show(currentIndex);
        if (blocks.length > 1) {
          timer = window.setTimeout(cycle, HOLD);
        }

        dots.forEach((dot, dotIndex) => {
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

        window.addEventListener('message', (event) => {
          const data = event.data || {};
          if (data.type !== '${TEMPLATE_PREVIEW_JUMP_EVENT}' || data.templateId !== ${previewTemplateId}) return;
          const index = Number(data.activeIndex);
          if (!Number.isFinite(index) || !blocks[index]) return;
          jumpTo(index);
        });

        document.addEventListener('visibilitychange', () => {
          if (document.hidden && timer) {
            window.clearTimeout(timer);
            clearAnimationTimers();
            timer = null;
          } else if (!document.hidden && !timer && blocks.length > 1) {
            blocks.forEach((block) => resetBlock(block));
            show(currentIndex);
            timer = window.setTimeout(cycle, HOLD);
          }
        });
      })();
    </script>
  `;

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        ${template.format === 'lc' ? LC_FONT_LINKS : ''}
        <style>${extractOriginalStyle(sourceStyleHtml)}</style>
        <style>
          html, body {
            margin: 0;
            padding: 0;
            width: 100%;
            overflow: hidden;
            background: transparent !important;
          }
          body {
            min-height: 0;
          }
          .card {
            display: grid !important;
            grid-template-rows: 1fr !important;
            width: 100% !important;
            height: 280px !important;
            border-radius: 12px !important;
          }
          .card-top {
            display: none !important;
          }
          .lc-card {
            background: transparent !important;
          }
          .stage {
            aspect-ratio: auto !important;
            height: 280px !important;
            min-height: 0 !important;
            overflow: hidden !important;
          }
          .lc-card .sb {
            position: absolute !important;
            inset: 0 !important;
          }
          .lc-card .cap {
            left: 50% !important;
            top: 52% !important;
            transform: translate(-50%, -50%) !important;
            width: 88% !important;
          }
          .lc-card .cpt {
            margin-left: auto !important;
            margin-right: auto !important;
          }
          .lc-card .ln,
          .lc-card .nline,
          .lc-card .plain-s {
            text-wrap: balance;
          }
          .lc-card .sb .hero,
          .lc-card .sb .is-emphasis,
          .lc-card .sb .ns3hero,
          .lc-card .sb .ns3box,
          .lc-card .sb .ns3mark,
          .lc-card .sb .ns3bracket,
          .lc-card .sb .ns3dot {
            color: var(--template-highlight, var(--lc-scene-highlight, var(--tint))) !important;
            -webkit-text-fill-color: var(--template-highlight, var(--lc-scene-highlight, var(--tint))) !important;
            filter: saturate(1.35) brightness(1.12);
            font-weight: 900;
          }
          .lc-card .cpt {
            --hc: var(--template-highlight, var(--lc-scene-highlight, var(--tint))) !important;
          }
          .lc-card .sb .box {
            background: var(--template-highlight, var(--lc-scene-highlight, var(--tint))) !important;
            color: #101114 !important;
            -webkit-text-fill-color: #101114 !important;
          }
          .lc-card .sb .box .sw,
          .lc-card .sb .box .hero {
            color: #101114 !important;
            -webkit-text-fill-color: #101114 !important;
          }
          .sb,
          .sblock {
            visibility: hidden;
          }
          .sb.active,
          .sblock.active {
            visibility: visible;
          }
          .dots {
            display: none !important;
          }
          .dots i {
            width: 5px !important;
            height: 5px !important;
            background: rgba(255, 255, 255, 0.22) !important;
            cursor: pointer !important;
          }
          .dots i.on {
            background: #fff !important;
            transform: scale(1.45) !important;
          }
          .stage .w[class*="imp-"],
          .stage .plain-s .imp,
          .stage .sw.neon-y,
          .stage .sw.neon-c,
          .stage .sw.neon-g,
          .stage .sw.neon-r,
          .stage .sw.neon-p {
            font-size: inherit !important;
            line-height: inherit !important;
            vertical-align: baseline !important;
          }
          .sw,
          .w {
            backface-visibility: hidden;
            will-change: transform, opacity, clip-path;
          }
        </style>
      </head>
      <body>${template.cardMarkup}${previewScript}</body>
    </html>
  `;
}

export function TemplatePreviewFrame({ template, jumpRequest, onProgressChange }) {
  // Lazy-mount the (script-running) preview iframe only once its card scrolls
  // into view - see useLazyVisible for why this matters.
  const [containerRef, shown] = useLazyVisible();
  const iframeRef = useRef(null);
  const srcDoc = useMemo(() => (shown ? buildPreviewDoc(template) : ''), [template, shown]);

  useEffect(() => {
    if (!shown) return undefined;

    const handleMessage = (event) => {
      const data = event?.data;
      if (!data || data.type !== TEMPLATE_PREVIEW_PROGRESS_EVENT || data.templateId !== template.id) {
        return;
      }
      onProgressChange?.({
        activeIndex: Number.isFinite(data.activeIndex) ? data.activeIndex : 0,
        total: Number.isFinite(data.total) ? data.total : 0,
      });
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [shown, template.id, onProgressChange]);

  useEffect(() => {
    if (!shown || !jumpRequest || jumpRequest.phase === null || jumpRequest.phase === undefined) return;
    iframeRef.current?.contentWindow?.postMessage({
      type: TEMPLATE_PREVIEW_JUMP_EVENT,
      templateId: template.id,
      activeIndex: jumpRequest.phase,
    }, '*');
  }, [jumpRequest, shown, template.id]);

  return (
    <div ref={containerRef} className="advanced-template-preview-frame sidebar-template-preview-frame">
      {shown && (
        <iframe
          ref={iframeRef}
          title={`${template.id} preview`}
          srcDoc={srcDoc}
          sandbox="allow-scripts"
          scrolling="no"
          onLoad={() => {
            if (!jumpRequest || jumpRequest.phase === null || jumpRequest.phase === undefined) return;
            iframeRef.current?.contentWindow?.postMessage({
              type: TEMPLATE_PREVIEW_JUMP_EVENT,
              templateId: template.id,
              activeIndex: jumpRequest.phase,
            }, '*');
          }}
          style={{ pointerEvents: 'none' }}
        />
      )}
    </div>
  );
}

function TemplateCardButton({
  template,
  isActive,
  isFavorite,
  onToggleFavorite,
  onApplyTemplate,
  onUpdateTemplate,
  currentStyle,
}) {
  const baseDotCount = useMemo(() => getTemplatePreviewDotCount(template), [template]);
  const [jumpRequest, setJumpRequest] = useState({ phase: 0, token: 0 });
  const [previewProgress, setPreviewProgress] = useState({
    activeIndex: 0,
    total: baseDotCount,
  });
  const totalDots = Math.max(baseDotCount, previewProgress?.total || 0);
  const activeDotIndex = Math.min(previewProgress?.activeIndex || 0, Math.max(totalDots - 1, 0));
  const requestPreviewPhase = (index) => {
    setJumpRequest((current) => ({ phase: index, token: current.token + 1 }));
    setPreviewProgress({ activeIndex: index, total: totalDots });
  };

  return (
    <div className="advanced-template-card-shell">
      <button
        type="button"
        title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        onClick={(event) => {
          event.stopPropagation();
          onToggleFavorite?.(template);
        }}
        className={`advanced-template-favorite-button ${isFavorite ? 'is-active' : ''}`}
      >
        <Star className="h-3.5 w-3.5" fill={isFavorite ? 'currentColor' : 'none'} />
      </button>
      <div
        data-template-card-id={template.id}
        aria-pressed={isActive}
        onClick={() => onApplyTemplate(template)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          onApplyTemplate(template);
        }}
        className={`advanced-template-card ${isActive ? 'is-active' : ''}`}
        role="button"
        tabIndex={0}
      >
        <TemplatePreviewFrame template={template} jumpRequest={jumpRequest} onProgressChange={setPreviewProgress} />
        {isActive && <Check className="absolute right-11 top-2 z-10 h-3.5 w-3.5 text-[#ffb629]" />}
        <div className="advanced-template-card-body">
          <div className="advanced-template-card-title">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#ffb629]" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate">{(template.displayName || template.name).replace(/^[^A-Za-z]+/, '')}</p>
                {totalDots > 0 && (
                  <div className="flex shrink-0 items-center gap-1.5">
                    {Array.from({ length: totalDots }).map((_, index) => (
                      <button
                        type="button"
                        key={`${template.id}-dot-${index}`}
                        aria-label={`Play template line ${index + 1}`}
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
              {template.mood && <span>{template.mood}</span>}
            </div>
          </div>
        </div>
      </div>
      {isActive && (
        <SidebarTemplateColorControls
          currentStyle={currentStyle}
          activeTemplate={template}
          onApplyTemplate={onUpdateTemplate}
        />
      )}
    </div>
  );
}

function SidebarTemplateColorPicker({ label, value, defaultColor, onChange, onReset }) {
  const displayColor = value || defaultColor || '#FFFFFF';
  return (
    <div className="flex items-center justify-between mb-3">
      <span className="text-xs text-gray-400">{label}</span>
      <div className="flex items-center gap-2">
        <label className="flex items-center bg-[#1F2022] rounded-lg p-1 pr-3 border border-white/5">
          <span className="relative w-6 h-6 rounded overflow-hidden mr-2 border border-white/10">
            <input
              type="color"
              value={displayColor}
              onChange={(event) => onChange(event.target.value)}
              className="absolute -top-2 -left-2 w-10 h-10 cursor-pointer"
            />
          </span>
          <span className="text-xs text-gray-300 font-mono">{displayColor.toUpperCase()}</span>
        </label>
        <button
          type="button"
          title={`Reset ${label.toLowerCase()}`}
          onClick={onReset}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#1F2022] border border-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function SidebarTemplateColorControls({ currentStyle, activeTemplate, onApplyTemplate }) {
  if (!currentStyle?.template_20_id || !activeTemplate) return null;
  const defaultStyle = buildTemplateStyle(activeTemplate);
  const defaultAccent = defaultStyle.highlight_color || defaultStyle.emphasis_color || defaultStyle.secondary_color || '#DDAA03';
  const currentAccent = currentStyle.highlight_color || currentStyle.emphasis_color || currentStyle.secondary_color || defaultAccent;
  const defaultSecondary = defaultStyle.secondary_color || defaultAccent;

  const applyPatch = (patch) => {
    onApplyTemplate?.({
      ...currentStyle,
      ...patch,
      template_color_customized: true,
    });
  };

  return (
    <div className="mx-2 mb-2 mt-3 px-4 py-3 bg-[#111111] rounded-lg border border-white/5">
      <div className="mb-4">
        <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Colors</h4>
        <SidebarTemplateColorPicker
          label="Primary"
          value={currentStyle.text_color}
          defaultColor={defaultStyle.text_color || '#FFFFFF'}
          onChange={(value) => applyPatch({ text_color: value })}
          onReset={() => applyPatch({ text_color: defaultStyle.text_color || '#FFFFFF' })}
        />
        <SidebarTemplateColorPicker
          label="Secondary"
          value={currentStyle.secondary_color}
          defaultColor={defaultSecondary}
          onChange={(value) => applyPatch({ secondary_color: value })}
          onReset={() => applyPatch({ secondary_color: defaultSecondary })}
        />
        <SidebarTemplateColorPicker
          label="Highlight Color"
          value={currentAccent}
          defaultColor={defaultAccent}
          onChange={(value) => applyPatch({
            secondary_color: value,
            highlight_color: value,
            emphasis_color: value,
            karaoke_color_1: value,
          })}
          onReset={() => applyPatch({
            secondary_color: defaultStyle.secondary_color || defaultAccent,
            highlight_color: defaultStyle.highlight_color || defaultAccent,
            emphasis_color: defaultStyle.emphasis_color || defaultAccent,
            karaoke_color_1: defaultStyle.karaoke_color_1 || defaultStyle.highlight_color || defaultAccent,
          })}
        />
      </div>
    </div>
  );
}

export default function SidebarTemplateGallery20({ currentStyle, onApplyTemplate, onBack }) {
  const activeTemplateId = currentStyle?.template_20_id || '';
  const [templateSearchQuery, setTemplateSearchQuery] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [recentsOnly, setRecentsOnly] = useState(false);
  const { isFavorite, toggleFavorite } = useTemplateFavorites();
  const { isRecent } = useRecentTemplates();
  const templateSections = [
    { id: 'lc-style-1', title: 'LC Style 1', templates: LC_STYLE_1_TEMPLATE_CARDS },
    { id: 'lc-style-2', title: 'LC Style 2', templates: LC_STYLE_2_TEMPLATE_CARDS },
    { id: 'lc-style-3', title: 'LC Style 3', templates: LC_STYLE_3_TEMPLATE_CARDS },
  ];
  const visibleTemplateSections = useMemo(
    () => templateSections.map((section) => ({
      ...section,
      templates: section.templates.filter((template) => (
        isExportableTemplateCandidate(template)
        && templateMatchesQuery(template, templateSearchQuery)
        && (!favoritesOnly || isFavorite('sidebar-template', template.id))
        && (!recentsOnly || isRecent('sidebar-template', template.id))
      )),
    })),
    [templateSearchQuery, favoritesOnly, isFavorite, recentsOnly, isRecent],
  );
  const visibleTemplateCount = visibleTemplateSections.reduce((total, section) => total + section.templates.length, 0);
  const applyTemplate = (template) => {
    onApplyTemplate?.(buildTemplateStyle(template));
  };

  return (
    <div className="sidebar-template-gallery h-full flex flex-col text-white">
      <div className="mb-2 rounded-xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] px-3 py-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[9px] uppercase tracking-[0.28em] text-slate-500">Templates</p>
            <h2 className="text-xs font-semibold leading-tight text-white/92">{TOTAL_TEMPLATE_COUNT} Templates</h2>
            <p className="mt-0.5 text-[10px] leading-tight text-slate-400">Lekha template sets</p>
          </div>
          <button
            type="button"
            onClick={() => onApplyTemplate?.({ template_id: '', template_20_id: '', show_inactive: true })}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-semibold transition-colors ${
              !activeTemplateId && !currentStyle?.template_id
                ? 'border-[#ffb629]/50 bg-[#ffb629]/12 text-[#ffd36a]'
                : 'border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'
            }`}
          >
            <X className="h-3 w-3" />
            <span>None</span>
            {!activeTemplateId && !currentStyle?.template_id && <Check className="h-3 w-3" />}
          </button>
        </div>
      </div>

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

      <div className="flex-1 overflow-y-auto pr-1 space-y-2">
        {visibleTemplateSections.map((section) => (
          <div key={section.id} className="space-y-2">
            <div className="advanced-template-section-label !mb-2 !px-0">
              <span className="text-[10px] tracking-[0.18em]">{section.title}</span>
              <small>{section.templates.length}/{templateSections.find((item) => item.id === section.id)?.templates.length || 0}</small>
            </div>

            {section.templates.map((template) => {
              const isActive = activeTemplateId === template.id;
              const templateIsFavorite = isFavorite('sidebar-template', template.id);

              return (
                <TemplateCardButton
                  key={template.id}
                  template={template}
                  isActive={isActive}
                  isFavorite={templateIsFavorite}
                  onToggleFavorite={() => toggleFavorite('sidebar-template', template.id)}
                  onApplyTemplate={applyTemplate}
                  onUpdateTemplate={onApplyTemplate}
                  currentStyle={currentStyle}
                />
              );
            })}
          </div>
        ))}
        {!visibleTemplateCount && (
          <div className="advanced-template-empty-state">No matching templates.</div>
        )}
      </div>

      {onBack && (
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
