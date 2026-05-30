import React, { useMemo } from 'react';
import { Check, Sparkles, X } from 'lucide-react';
import legacyTemplateHtml from '../../assets/lekha-captions-20-templates.html?raw';
import newTemplateHtml from '../../assets/lekha-captions-49-templates.html?raw';

function sanitizeTemplateHtml(value = '') {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\s+bis_skin_checked="[^"]*"/gi, '')
    .replace(/<!-- saved from url=.*?-->\s*/gi, '');
}

const sanitizedLegacyTemplateHtml = sanitizeTemplateHtml(legacyTemplateHtml);
const sanitizedNewTemplateHtml = sanitizeTemplateHtml(newTemplateHtml);
const legacyTemplateCss = (() => {
  const matches = [...legacyTemplateHtml.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)];
  return matches.map(m => m[1]).join('\n');
})();
const newTemplateCss = (() => {
  const matches = [...newTemplateHtml.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)];
  return matches.map(m => m[1]).join('\n');
})();

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

const NEW_TEMPLATE_STYLE_FALLBACK = {
  ...VIGIL_BASE_TEMPLATE_STYLE,
};

const DUPLICATE_TEMPLATE_RENAMES = {
  T01: 'The Stand',
  T03: 'The Keepsake',
  T08: 'The Curtain',
  T09: 'The Lightwell',
  T11: 'The Record',
  T13: 'The Frequency',
  T14: 'The Fracture',
  'V3.1': 'The Afterglow',
  'V4.2': 'The Flowstate',
  'V4.8': 'The Sway',
};

const TEMPLATE_ACCENT_COLOR_MAP = {
  gold: '#D4AF37',
  rose: '#FF3D71',
  cyan: '#00E5FF',
  green: '#39FF14',
  purple: '#A78BFA',
  orange: '#FB923C',
  blue: '#3B82F6',
  pink: '#FF4FA3',
  red: '#FF5A5A',
  yellow: '#FFE600',
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

function normalizeTemplateName(value = '') {
  return stripHtml(value)
    .replace(/^[^A-Za-z]+/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
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
  const match = String(body).match(new RegExp(`${escapeRegExp(property)}\\s*:\\s*([^;]+)`, 'i'));
  return match?.[1]?.trim() || '';
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
  const match = String(markup).match(/\b(?:ns\d+|imp|neon)-([a-z]+)\b/i);
  return match?.[1] ? (TEMPLATE_ACCENT_COLOR_MAP[match[1].toLowerCase()] || '') : '';
}

function extractTemplateStyleFromPreview(template) {
  const cssText = template.format === 'lk' ? newTemplateCss : legacyTemplateCss;
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

function extractNewCards() {
  const cards = [];
  const cardPattern = /<div class="lk-card [^"]+"/gi;
  let match;

  while ((match = cardPattern.exec(sanitizedNewTemplateHtml))) {
    const cardMarkup = extractCompleteDiv(sanitizedNewTemplateHtml, match.index);
    const id = stripHtml(cardMarkup.match(/<span class="lk-cid">([\s\S]*?)<\/span>/i)?.[1] || '');
    const name = stripHtml(cardMarkup.match(/<span class="lk-cnm">([\s\S]*?)<\/span>/i)?.[1] || '').replace(/^[^A-Za-z]+/, '');
    const badges = Array.from(cardMarkup.matchAll(/<span class="lk-badge [^"]*">([\s\S]*?)<\/span>/gi), (parts) => stripHtml(parts[1]));
    const cardClass = cardMarkup.match(/<div class="lk-card ([^"]+)"/i)?.[1]?.split(/\s+/)?.[0] || '';

    if (id && name) {
      cards.push({
        id,
        name,
        mood: badges[0] || '',
        formula: badges[1] || '',
        cardClass,
        cardMarkup: stripPreviewRuntimeState(cardMarkup, true),
        format: 'lk',
      });
    }

    cardPattern.lastIndex = match.index + Math.max(cardMarkup.length, 1);
  }

  return cards;
}

const LEGACY_TEMPLATE_CARDS = Array.from(
  extractLegacyCards().reduce((uniqueCards, card) => {
    const uniqueKey = card.id || card.name;
    if (!uniqueCards.has(uniqueKey)) {
      uniqueCards.set(uniqueKey, card);
    }
    return uniqueCards;
  }, new Map()).values(),
);

const legacyTemplateNames = new Set(LEGACY_TEMPLATE_CARDS.map((card) => normalizeTemplateName(card.name)));

const NEW_TEMPLATE_CARDS = Array.from(
  extractNewCards().reduce((uniqueCards, card) => {
    const uniqueKey = `${card.id}::${normalizeTemplateName(card.name)}`;
    if (!uniqueKey || uniqueCards.has(uniqueKey)) {
      return uniqueCards;
    }
    const isDuplicateName = legacyTemplateNames.has(normalizeTemplateName(card.name));
    uniqueCards.set(uniqueKey, {
      ...card,
      displayName: isDuplicateName ? (DUPLICATE_TEMPLATE_RENAMES[card.id] || card.name) : card.name,
    });
    return uniqueCards;
  }, new Map()).values(),
);

const TEMPLATE_CARDS = [...LEGACY_TEMPLATE_CARDS, ...NEW_TEMPLATE_CARDS];
const TOTAL_TEMPLATE_COUNT = TEMPLATE_CARDS.length;
const EXTRACTED_TEMPLATE_STYLE_MAP = Object.fromEntries(
  TEMPLATE_CARDS.map((template) => [template.id, extractTemplateStyleFromPreview(template)]),
);

function buildTemplateStyle(template) {
  const extractedStyle = EXTRACTED_TEMPLATE_STYLE_MAP[template.id] || {};
  const baseStyle = TEMPLATE_STYLE_MAP[template.id]
    || (Object.keys(extractedStyle).length ? extractedStyle : NEW_TEMPLATE_STYLE_FALLBACK);

  return {
    template_id: '',
    template_20_id: template.id,
    template_source: template.format === 'lk' ? 'lekha-49' : 'lekha-20',
    template_class: template.cardClass || '',
    template_name: template.displayName || template.name || '',
    template_layout: detectTemplatePreviewLayout(template),
    template_effect: detectTemplatePreviewEffect(template),
    template_markup: template.cardMarkup || '',
    ...baseStyle,
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
  if (template.format === 'lk') {
    const previewScript = `
      <script>
        (() => {
          const card = document.querySelector('.lk-card');
          if (!card) return;
          const sblocks = Array.from(card.querySelectorAll('.sblock'));
          if (!sblocks.length) return;
          const dots = Array.from(card.querySelectorAll('.lk-dots i'));
          const WBW_STAGGER = 160;
          let current = 0;
          let timer = null;

          function triggerStickyWave(sblock) {
            const words = sblock.querySelectorAll('.sw-w');
            words.forEach((word) => { word.style.opacity = '0.14'; });
            words.forEach((word, index) => {
              setTimeout(() => {
                word.style.opacity = '1';
              }, index * 210);
            });
          }

          function triggerSW(sblock) {
            sblock.querySelectorAll('.sw').forEach((element) => {
              const clone = element.cloneNode(true);
              element.parentNode.replaceChild(clone, element);
            });
          }

          function triggerWBW(sblock) {
            const words = sblock.querySelectorAll('.wbw-word');
            words.forEach((word) => {
              word.style.transition = 'none';
              word.classList.remove('visible', 'anim');
            });
            void sblock.offsetWidth;
            words.forEach((word) => { word.style.transition = ''; });
            words.forEach((word, index) => {
              setTimeout(() => {
                word.classList.add('visible');
                if (/\\bns[23]-/.test(word.className)) {
                  word.classList.add('anim');
                  setTimeout(() => word.classList.remove('anim'), 650);
                }
              }, index * WBW_STAGGER);
            });
          }

          function showPhase(index) {
            sblocks.forEach((sblock) => sblock.classList.remove('active'));
            const active = sblocks[index];
            if (!active) return;
            active.classList.add('active');
            triggerSW(active);
            triggerWBW(active);
            triggerStickyWave(active);
            dots.forEach((dot, dotIndex) => {
              dot.className = dotIndex === index ? 'on' : '';
            });
          }

          function scheduleNext(fromIndex) {
            if (timer) window.clearTimeout(timer);
            if (sblocks.length < 2) return;
            const duration = parseInt(sblocks[fromIndex]?.dataset?.dur || '3000', 10);
            timer = window.setTimeout(() => {
              current = (fromIndex + 1) % sblocks.length;
              showPhase(current);
              scheduleNext(current);
            }, duration);
          }

          showPhase(0);
          scheduleNext(0);

          dots.forEach((dot, index) => {
            dot.addEventListener('click', () => {
              current = index;
              showPhase(index);
              scheduleNext(index);
            });
          });

          document.addEventListener('visibilitychange', () => {
            if (document.hidden && timer) {
              window.clearTimeout(timer);
              timer = null;
            } else if (!document.hidden && !timer) {
              showPhase(current);
              scheduleNext(current);
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
          <style>${extractOriginalStyle(sanitizedNewTemplateHtml)}</style>
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
            .lk-card {
              display: grid !important;
              grid-template-rows: 1fr !important;
              width: 100% !important;
              height: 280px !important;
              border-radius: 12px !important;
            }
            .lk-card-top {
              display: none !important;
            }
            .lk-stage {
              aspect-ratio: auto !important;
              height: auto !important;
              min-height: 0 !important;
              overflow: hidden !important;
            }
            .sblock {
              visibility: hidden;
            }
            .sblock.active {
              visibility: visible;
            }
            .lk-stage .sblock:not(.active),
            .lk-stage .sblock:not(.active) * {
              animation: none !important;
              transition: none !important;
            }
            .lk-stage .sblock:not(.active) .wbw-word,
            .lk-stage .sblock:not(.active) .sw-w {
              opacity: 0 !important;
            }
            .lk-stage .sblock:not(.active) .sw {
              opacity: 0;
            }
            .lk-stage .sblock.active .wbw-word:not(.visible) {
              opacity: 0;
            }
            .lk-dots {
              display: none !important;
              align-items: center !important;
              justify-content: center !important;
              gap: 5px !important;
              min-height: 22px !important;
              padding: 5px 0 7px !important;
              background: #0e0e12 !important;
              border-top: 1px solid rgba(255, 255, 255, 0.08) !important;
            }
            .lk-dots i {
              width: 5px !important;
              height: 5px !important;
              background: rgba(255, 255, 255, 0.22) !important;
              cursor: pointer !important;
            }
            .lk-dots i.on {
              background: #fff !important;
              transform: scale(1.45) !important;
            }
            .lk-card .wbw-line {
              font-size: 16px !important;
              line-height: 1.75 !important;
            }
            .lk-card .plain-s {
              font-size: 15px !important;
              line-height: 1.55 !important;
              letter-spacing: 1px !important;
            }
            .lk-card .pos3,
            .lk-card .pos4,
            .lk-card .pos5,
            .lk-card .pos6,
            .lk-card .pos7,
            .lk-card .pos9,
            .lk-card .pos11,
            .lk-card .pos12,
            .lk-card .pos16,
            .lk-card .pos20,
            .lk-card .pos21,
            .lk-card .pos22,
            .lk-card .pos25,
            .lk-card .pos26,
            .lk-card .pos30,
            .lk-card .pos31b,
            .lk-card .pos31d,
            .lk-card .pos-stamp,
            .lk-card .pr {
              font-size: clamp(14px, 2.8vw, 22px) !important;
            }
            .wbw-word,
            .sw,
            .sw-w {
              backface-visibility: hidden;
              will-change: transform, opacity, clip-path;
            }
          </style>
        </head>
        <body>${template.cardMarkup}${previewScript}</body>
      </html>
    `;
  }

  const previewScript = `
    <script>
      (() => {
        const card = document.querySelector('.card');
        if (!card) return;
        const stage = card.querySelector('.stage');
        const isNewTemplate = ${template.format === 'new'};
        const blocks = Array.from(card.querySelectorAll('.sb, .sblock'));
        const dots = Array.from(card.querySelectorAll('.dots i'));
        const label = card.querySelector('.slbl, .stage-lbl');
        const HOLD = 2800;
        const EXIT_MS = 360;
        const GAP = 40;
        const WBW_DELAY = 65;
        const WBW_DUR = 280;
        const POS_STAGGER = 220;
        const POS_DUR = 300;
        const WBW_CLASSES = ['wrise','wslide','wslider','wroll','wwipe','wwipeup','wfade','wscale','wflip','wbounce','wdiag','wexpand','wskew','wstencil','wlift','wbw-rise','wbw-slide'];
        const IMP_ANIMS = isNewTemplate
          ? {
              'imp-bold':'drop-in',
              'imp-gold':'wipe',
              'imp-rose':'diagonal-wipe',
              'imp-cyan':'blur-sharpen',
              'imp-green':'skew-snap',
              'imp-purple':'roll',
              'imp-italic':'rotate-in',
              'imp-weight':'wipe',
              'imp-scale':'roll',
              'imp-size':'blur-sharpen',
              'imp-underline':'wipe-up',
              'imp-box':'elastic',
              'imp-space':'stencil',
              'imp-flicker':'flicker',
              'imp-typewrite':'typewrite',
              'imp-stamp':'stamp'
            }
          : {
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

        function getBlockType(block) {
          if (block.querySelector('.plain-s')) return 'plain';
          if (block.querySelector('.wbw, .wbw-rise, .wbw-slide')) return 'wbw';
          return 'pos';
        }

        function wbwInitWord(word) {
          const parent = word.parentElement;
          word.style.transition = 'none';
          word.style.clipPath = 'inset(0 0 0 0)';
          word.style.transformOrigin = '';
          word.style.filter = '';
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
          setTimeout(() => {
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
          }, delay);
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
          const selector = WBW_CLASSES.map((className) => '.' + className + ' .w').join(',');
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
          const selector = WBW_CLASSES.map((className) => '.' + className + ' .w').join(',');
          block.querySelectorAll(selector).forEach((word) => {
            word.classList.remove('in', 'fx');
            wbwInitWord(word);
          });
        }

        function posInitWord(word) {
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
          setTimeout(() => {
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
          }, delay);
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
          block.classList.remove('active');
          block.style.cssText = 'opacity:0;visibility:hidden;pointer-events:none';
          resetWBW(block);
          resetPosWords(block);
        }

        function enterBlock(block) {
          const type = getBlockType(block);
          resetBlock(block);
          void block.offsetHeight;
          if (type === 'plain') {
            block.style.transition = 'none';
            block.style.visibility = 'visible';
            block.style.pointerEvents = 'auto';
            block.style.opacity = '1';
            block.classList.add('active');
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

        document.addEventListener('visibilitychange', () => {
          if (document.hidden && timer) {
            window.clearTimeout(timer);
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
        <style>${extractOriginalStyle(template.format === 'new' ? sanitizedNewTemplateHtml : sanitizedLegacyTemplateHtml)}</style>
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
          .stage {
            aspect-ratio: auto !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: hidden !important;
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
            align-items: center !important;
            justify-content: center !important;
            gap: 5px !important;
            min-height: 22px !important;
            padding: 5px 0 7px !important;
            background: #0e0e12 !important;
            border-top: 1px solid rgba(255, 255, 255, 0.08) !important;
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

function TemplatePreviewFrame({ template }) {
  const srcDoc = useMemo(() => buildPreviewDoc(template), [template]);

  return (
    <div className="advanced-template-preview-frame sidebar-template-preview-frame">
      <iframe
        title={`${template.id} preview`}
        srcDoc={srcDoc}
        sandbox="allow-scripts"
        scrolling="no"
        style={{ pointerEvents: 'none' }}
      />
    </div>
  );
}

export default function SidebarTemplateGallery20({ currentStyle, onApplyTemplate, onBack }) {
  const activeTemplateId = currentStyle?.template_20_id || '';
  const templateSections = [
    { id: 'original-20', title: '20 Templates', templates: LEGACY_TEMPLATE_CARDS },
    { id: 'new-49', title: '49 Templates', templates: NEW_TEMPLATE_CARDS },
  ];

  return (
    <div className="sidebar-template-gallery h-full flex flex-col text-white">
      <div className="mb-2 rounded-xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] px-3 py-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[9px] uppercase tracking-[0.28em] text-slate-500">Templates</p>
            <h2 className="text-xs font-semibold leading-tight text-white/92">{TOTAL_TEMPLATE_COUNT} Template Set</h2>
            <p className="mt-0.5 text-[10px] leading-tight text-slate-400">20 original + all {NEW_TEMPLATE_CARDS.length} templates from the 49-template file</p>
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

      <div className="flex-1 overflow-y-auto pr-1 space-y-2">
        {templateSections.map((section) => (
          <div key={section.id} className="space-y-2">
            <div className="advanced-template-section-label !mb-2 !px-0">
              <span className="text-[10px] tracking-[0.18em]">{section.title}</span>
              <small>{section.templates.length}</small>
            </div>

            {section.templates.map((template) => {
              const isActive = activeTemplateId === template.id;

              return (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => onApplyTemplate?.(buildTemplateStyle(template))}
                  className={`advanced-template-card ${isActive ? 'is-active' : ''}`}
                >
                  <TemplatePreviewFrame template={template} />
                  {isActive && <Check className="absolute right-2 top-2 z-10 h-3.5 w-3.5 text-[#ffb629]" />}
                  <div className="advanced-template-card-body">
                    <div className="advanced-template-card-title">
                      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#ffb629]" />
                      <div className="min-w-0">
                        <p>{(template.displayName || template.name).replace(/^[^A-Za-z]+/, '')}</p>
                        {template.mood && <span>{template.mood}</span>}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {onBack && (
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
