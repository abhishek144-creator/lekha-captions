import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const ADVANCED_TEMPLATE_VARIANTS = {
  t01: 'wbw-rise', t02: 'plain-s', t03: 'wbw-rise', t04: 'plain-s', t05: 'wbw-rise',
  t06: 'wbw-rise', t07: 'wbw-rise', t08: 'wbw-rise', t09: 'wbw-rise', t10: 'wbw-rise',
  t11: 'wbw-slide', t12: 'plain-s', t13: 'wbw-rise', t14: 'wbw-slide', t15: 'plain-s',
  t16: 'wbw-rise', t17: 'wbw-slide', t18: 'wbw-rise', t19: 'wbw-rise', t20: 'plain-s',
  t21: 'wbw-rise', t22: 'wbw-rise', t23: 'wbw-rise', t24: 'wbw-rise', t25: 'wbw-slide',
  t26: 'wbw-rise', t27: 'plain-s', t28: 'wbw-rise', t29: 'wbw-rise', t30: 'wbw-slide',
  t31: 'wbw-rise', t32: 'plain-s', t33: 'wbw-rise', t34: 'wbw-rise', t35: 'wbw-rise',
};
const ORIGINAL_TEMPLATE_BLOCK_TYPES = {
  t11: ['styled', 'styled', 'plain', 'wbw-rise'],
  t12: ['styled', 'styled', 'wbw-rise', 'wbw-slide'],
  t13: ['styled', 'styled', 'wbw-rise', 'wbw-slide'],
  t14: ['styled', 'styled', 'plain', 'wbw-rise'],
  t15: ['styled', 'styled', 'wbw-rise', 'wbw-slide'],
  t16: ['styled', 'styled', 'wbw-rise', 'wbw-slide'],
  t17: ['styled', 'styled', 'plain', 'wbw-rise'],
  t18: ['styled', 'styled', 'plain', 'wbw-rise'],
  t19: ['styled', 'styled', 'wbw-rise', 'wbw-slide'],
  t20: ['styled', 'styled', 'wbw-rise', 'wbw-slide'],
  t21: ['styled', 'styled', 'wbw-rise', 'wbw-slide'],
  t22: ['styled', 'styled', 'wbw-rise', 'wbw-slide'],
  t23: ['styled', 'plain', 'plain', 'styled'],
  t24: ['styled', 'styled', 'plain', 'wbw-rise'],
  t25: ['styled', 'styled', 'wbw-rise', 'wbw-slide'],
  t26: ['styled', 'styled', 'wbw-rise', 'wbw-slide'],
  t27: ['styled', 'plain', 'plain', 'wbw-rise'],
  t28: ['styled', 'styled', 'wbw-rise', 'wbw-slide'],
  t29: ['styled', 'styled', 'wbw-rise', 'wbw-slide'],
  t30: ['styled', 'plain', 'plain', 'plain'],
  t31: ['styled', 'styled', 'plain', 'wbw-rise'],
  t32: ['styled', 'styled', 'plain', 'wbw-rise'],
  t33: ['styled', 'styled', 'plain', 'wbw-rise'],
  t34: ['styled', 'styled', 'wbw-rise', 'wbw-slide'],
  t35: ['styled', 'plain', 'plain', 'plain'],
};
const TEMPLATE_CANVAS_FONT_SCALE = 0.88;
const ADVANCED_TEMPLATE_STYLED_ANIMATION_SECONDS = 1.35;
const ADVANCED_TEMPLATE_WBW_BASE_SECONDS = 0.52;
const ADVANCED_TEMPLATE_WBW_STAGGER_SECONDS = 0.065;
const ADVANCED_TEMPLATE_WBW_TAIL_SECONDS = 0.42;

function findChromeExecutable() {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter(Boolean);
  return candidates.find((candidate) => {
    try {
      return existsSync(candidate);
    } catch {
      return false;
    }
  });
}

function toForwardSlash(inputPath) {
  return inputPath.replace(/\\/g, '/');
}

function isAdvancedTemplateId(templateId) {
  return /^t\d{2}$/.test(String(templateId || ''));
}

function scaleTemplateFontSize(fontSize) {
  return Math.max(12, Math.round((fontSize || 18) * TEMPLATE_CANVAS_FONT_SCALE));
}

function getTemplateBlockType(templateId, blockIndex = 0) {
  const blockTypes = ORIGINAL_TEMPLATE_BLOCK_TYPES[templateId];
  if (!Array.isArray(blockTypes) || blockTypes.length === 0) return 'styled';
  const normalized = ((Number(blockIndex) % blockTypes.length) + blockTypes.length) % blockTypes.length;
  return blockTypes[normalized] || 'styled';
}

function getAdvancedTemplateAnimationWindow(blockType, captionDuration, wordCount = 1) {
  if (blockType === 'plain') return 0;
  const duration = Math.max(Number(captionDuration) || 0, 0);
  if (blockType.startsWith('wbw')) {
    const wbwWindow = ADVANCED_TEMPLATE_WBW_BASE_SECONDS
      + (Math.max(0, wordCount - 1) * ADVANCED_TEMPLATE_WBW_STAGGER_SECONDS)
      + ADVANCED_TEMPLATE_WBW_TAIL_SECONDS;
    return Math.min(duration, Math.max(1.1, wbwWindow));
  }
  return Math.min(duration, ADVANCED_TEMPLATE_STYLED_ANIMATION_SECONDS);
}

function extractOriginalTemplateRuntimeCss(originalTemplateHtml) {
  const style = originalTemplateHtml.match(/<style>([\s\S]*?)<\/style>/i)?.[1] || '';
  const startToken = '/* ===== SENTENCE BLOCKS ===== */';
  const start = style.indexOf(startToken);
  return start >= 0 ? style.slice(start) : style;
}

function extractHtmlStyle(markup = '') {
  const matches = [...String(markup).matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)];
  return matches.map(m => m[1]).join('\n');
}

function buildRuntimeScript() {
  return `
    const TEMPLATE_CANVAS_FONT_SCALE = ${TEMPLATE_CANVAS_FONT_SCALE};
    const scaleExportPx = (value) =>
      Math.max(1, Math.round((Number(value) || 0) * (window.__exportCanvasScale || 1)));
    const scaleTemplateFontSize = (fontSize) =>
      Math.max(12, scaleExportPx((fontSize || 18) * TEMPLATE_CANVAS_FONT_SCALE));

    const escapeHtml = (value = '') =>
      String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const rgbaFromHex = (hex, alpha = 1) => {
      try {
        const normalized = String(hex || '#000000').replace('#', '');
        const full = normalized.length === 3
          ? normalized.split('').map((part) => part + part).join('')
          : normalized.padEnd(6, '0').slice(0, 6);
        const r = parseInt(full.slice(0, 2), 16);
        const g = parseInt(full.slice(2, 4), 16);
        const b = parseInt(full.slice(4, 6), 16);
        return \`rgba(\${r}, \${g}, \${b}, \${alpha})\`;
      } catch {
        return hex || '#000000';
      }
    };

    const transformText = (text, style) => {
      if (!text) return '';
      if (style?.is_caps || style?.text_case === 'uppercase') return text.toUpperCase();
      if (style?.text_case === 'lowercase') return text.toLowerCase();
      if (style?.text_case === 'capitalize') return text.replace(/\\b\\w/g, (char) => char.toUpperCase());
      return text;
    };

    const getCurrentWordIndex = (caption, time) => {
      const words = Array.isArray(caption.words) ? caption.words.filter((word) => (word?.word || '').trim()) : [];
      if (words.length > 0) {
        let activeIndex = 0;
        for (let index = 0; index < words.length; index += 1) {
          const start = Number(words[index]?.start ?? caption.start_time ?? 0);
          if (time >= start) activeIndex = index;
          else break;
        }
        return activeIndex;
      }

      const splitWords = String(caption.text || '').split(/\\s+/).filter(Boolean);
      if (splitWords.length <= 1) return 0;
      const start = Number(caption.start_time ?? 0);
      const end = Number(caption.end_time ?? start);
      const duration = Math.max(end - start, 0.01);
      const elapsed = Math.min(Math.max(time - start, 0), duration);
      return Math.max(0, Math.min(splitWords.length - 1, Math.floor((elapsed / duration) * splitWords.length)));
    };

    const splitCaptionForTemplate = (text = '') => {
      const words = String(text).trim().split(/\\s+/).filter(Boolean);
      if (!words.length) return { top: '', hero: '', bottom: '', full: '' };
      if (words.length === 1) return { top: '', hero: words[0], bottom: '', full: words[0] };
      const heroIndex = Math.min(1, words.length - 1);
      return {
        top: words.slice(0, heroIndex).join(' '),
        hero: words[heroIndex] || words[0],
        bottom: words.slice(heroIndex + 1).join(' '),
        full: words.join(' '),
      };
    };

    const splitTemplateLines = (text = '', maxLines = 2) => {
      const words = String(text).trim().split(/\\s+/).filter(Boolean);
      if (!words.length) return [''];
      const lineCount = Math.max(1, Math.min(maxLines, words.length));
      const lines = Array.from({ length: lineCount }, () => []);
      words.forEach((word, index) => {
        lines[Math.min(lineCount - 1, Math.floor((index * lineCount) / words.length))].push(word);
      });
      return lines.map((line) => line.join(' ')).filter(Boolean);
    };

    const heroMarkup = (text, className = '') => {
      const { top, hero, bottom, full } = splitCaptionForTemplate(text);
      if (!full) return '';
      if (!className || !hero) return escapeHtml(full);
      return \`\${top ? \`\${escapeHtml(top)} \` : ''}<span class="\${className}">\${escapeHtml(hero)}</span>\${bottom ? \` \${escapeHtml(bottom)}\` : ''}\`;
    };

    const wbwMarkup = (text, variant = 'wbw-rise', impClass = 'imp-bold') => {
      const { hero, full } = splitCaptionForTemplate(text);
      if (!full) return '';
      const tokens = full.split(/\\s+/).filter(Boolean).map((word) => ({ word }));
      const heroIndex = Math.max(0, tokens.findIndex((token) => token.word === hero));
      const words = tokens.map((token, index) => {
        const style = \`--wbw-delay:\${index * 65}ms\`;
        const isImp = index === heroIndex;
        return \`\${index > 0 ? ' ' : ''}<span class="w\${isImp ? \` \${impClass}\` : ''} in" data-i="\${index}"\${isImp ? \` data-imp="true" data-imp-cls="\${impClass}"\` : ''} style="\${style}">\${escapeHtml(token.word)}</span>\`;
      }).join('');
      return \`<span class="\${variant} lekha-template-fit" data-type="\${variant}">\${words}</span>\`;
    };

    const originalTemplateBlockTypes = ${JSON.stringify(ORIGINAL_TEMPLATE_BLOCK_TYPES)};

    const wrapOriginalTemplate = (templateId, blockClass, blockIndex, blockType, children, extraStyle = '') => \`
      <span class="lekha-original-template \${templateId} \${templateId}-stage">
        <span
          class="sblock \${templateId}-block \${blockClass} lekha-applied-advanced-template"
          data-template-block-index="\${blockIndex}"
          data-template-block-type="\${blockType}"
          style="opacity:0;transition:none;\${extraStyle}"
        >\${children}</span>
      </span>
    \`;

    const buildOriginalAdvancedTemplateMarkup = (templateId, text, blockIndex = 0) => {
      const { top, hero, bottom, full } = splitCaptionForTemplate(text);
      const blockTypes = originalTemplateBlockTypes[templateId] || ['styled'];
      const normalized = ((blockIndex % blockTypes.length) + blockTypes.length) % blockTypes.length;
      const blockType = blockTypes[normalized];
      const lines2 = splitTemplateLines(full, 2);
      const lines3 = splitTemplateLines(full, 3);
      const upperFull = full.toUpperCase();
      const lineSpans = (lines, cls, mapper = (line) => escapeHtml(line)) =>
        lines.map((line, index) => \`<span class="\${cls}" style="animation-delay:\${index * 0.1}s">\${mapper(line, index)}</span>\`).join('');
      const wrap = (blockClass, children, extraStyle = '') => wrapOriginalTemplate(templateId, blockClass, normalized, blockType, children, extraStyle);

      switch (templateId) {
        case 't11':
          if (normalized === 1) return wrap('t11-b1', \`<span class="blur-txt lekha-template-fit">\${heroMarkup(full, 'imp-italic')}</span>\`);
          if (normalized === 2) return wrap('t11-b2', \`<span class="lekha-template-fit">\${escapeHtml(full)}</span>\`);
          if (normalized === 3) return wrap('t11-b3', wbwMarkup(full, 'wbw-rise', 'imp-gold'));
          return wrap('t11-b0', \`<span class="cluster-wrap lekha-template-fit"><span class="cluster-row-top" style="text-align:right">\${escapeHtml(top || lines2[0] || '')}</span><span class="cluster-hl imp-gold">\${escapeHtml(hero)}</span><span class="cluster-row-bot" style="text-align:left">\${escapeHtml(bottom || lines2[1] || '')}</span></span>\`);
        case 't12':
          if (normalized === 1) return wrap('t12-b1', \`<span class="rise-unit lekha-template-fit">\${heroMarkup(full, 'imp-purple')}</span>\`);
          if (normalized === 2) return wrap('t12-b2', wbwMarkup(full, 'wbw-rise', 'imp-italic'));
          if (normalized === 3) return wrap('t12-b3', wbwMarkup(full, 'wbw-slide', 'imp-rose'));
          return wrap('t12-b0', \`<span class="type-wrap lekha-template-fit">\${escapeHtml(full)}</span>\`);
        case 't13':
          if (normalized === 1) return wrap('t13-b1', \`<span class="ticker-txt lekha-template-fit">\${escapeHtml(upperFull)}</span>\`);
          if (normalized === 2) return wrap('t13-b2', wbwMarkup(full, 'wbw-rise', 'imp-cyan'));
          if (normalized === 3) return wrap('t13-b3', wbwMarkup(full, 'wbw-slide', 'imp-bold'));
          return wrap('t13-b0', \`<span class="stamp-txt lekha-template-fit">\${escapeHtml(upperFull)}</span>\`);
        case 't14':
          if (normalized === 1) return wrap('t14-b1', \`<span class="drop-txt lekha-template-fit">\${heroMarkup(full, 'imp-gold')}</span>\`);
          if (normalized === 2) return wrap('t14-b2', \`<span class="lekha-template-fit">\${escapeHtml(full)}</span>\`);
          if (normalized === 3) return wrap('t14-b3', wbwMarkup(full, 'wbw-rise', 'imp-weight'));
          return wrap('t14-b0', \`<span style="perspective:600px" class="lekha-template-fit">\${lineSpans(lines2, 'flip-line', (line, index) => index === lines2.length - 1 ? heroMarkup(line, 'imp-underline') : escapeHtml(line))}</span>\`);
        case 't15':
          if (normalized === 1) return wrap('t15-b1', \`<span class="pop-txt lekha-template-fit">\${escapeHtml(upperFull)}</span>\`);
          if (normalized === 2) return wrap('t15-b2', wbwMarkup(full, 'wbw-rise', 'imp-bold'));
          if (normalized === 3) return wrap('t15-b3', wbwMarkup(full, 'wbw-slide', 'imp-rose'));
          return wrap('t15-b0', \`<span class="shake-in lekha-template-fit">\${escapeHtml(lines2[0] || '')}\${lines2[1] ? \`<br>\${heroMarkup(lines2[1], 'imp-rose')}\` : ''}</span>\`);
        case 't16':
          if (normalized === 1) return wrap('t16-b1', \`<span class="neon-line lekha-template-fit">\${escapeHtml(full)}</span>\`);
          if (normalized === 2) return wrap('t16-b2', wbwMarkup(full, 'wbw-rise', 'imp-cyan'));
          if (normalized === 3) return wrap('t16-b3', wbwMarkup(full, 'wbw-slide', 'imp-bold'));
          return wrap('t16-b0', \`<span class="lekha-template-fit">\${lines3.map((line, index) => \`<span class="stack-line" \${index === lines3.length - 1 ? 'style="color:#fff;font-weight:900"' : ''}>\${String(index + 1).padStart(2, '0')}. \${index === lines3.length - 1 ? heroMarkup(line, 'imp-cyan') : escapeHtml(line)}</span>\`).join('')}</span>\`);
        case 't17':
          if (normalized === 1) return wrap('t17-b1', \`<span class="letter-snap-blk lekha-template-fit"><span class="snap-txt" style="font-family:'Space Mono',monospace;font-size:0.9rem;color:rgba(255,61,113,0.8)">\${escapeHtml(full)}</span></span>\`);
          if (normalized === 2) return wrap('t17-b2', \`<span class="lekha-template-fit" style="color:rgba(255,255,255,0.4)">\${escapeHtml(full)}</span>\`);
          if (normalized === 3) return wrap('t17-b3', wbwMarkup(full, 'wbw-rise', 'imp-flicker'));
          return wrap('t17-b0', \`<span class="glitch-wrap lekha-template-fit" data-text="\${escapeHtml(upperFull)}">\${escapeHtml(upperFull)}</span>\`);
        case 't18':
          if (normalized === 1) return wrap('t18-b1', \`<span class="reveal-txt lekha-template-fit">\${heroMarkup(full, 'imp-purple')}</span>\`);
          if (normalized === 2) return wrap('t18-b2', \`<span class="lekha-template-fit">\${escapeHtml(full)}</span>\`);
          if (normalized === 3) return wrap('t18-b3', wbwMarkup(full, 'wbw-rise', 'imp-purple'));
          return wrap('t18-b0', \`<span class="split-title lekha-template-fit"><span class="split-top">\${escapeHtml(top || lines2[0] || '')}</span><span class="split-bot">\${hero ? \`<span class="imp-purple">\${escapeHtml(hero)}</span>\` : escapeHtml(bottom || lines2[1] || '')}</span></span>\`);
        case 't19':
          if (normalized === 1) return wrap('t19-b1', \`<span class="rise-unit lekha-template-fit">\${heroMarkup(upperFull, 'imp-rose')}</span>\`);
          if (normalized === 2) return wrap('t19-b2', wbwMarkup(full, 'wbw-rise', 'imp-bold'));
          if (normalized === 3) return wrap('t19-b3', wbwMarkup(full, 'wbw-slide', 'imp-rose'));
          return wrap('t19-b0', \`<span class="slash-wrap lekha-template-fit">\${escapeHtml(upperFull)}</span>\`);
        case 't20':
          if (normalized === 1) return wrap('t20-b1', \`<span class="impact-txt lekha-template-fit">\${heroMarkup(full, 'imp-green')}</span>\`);
          if (normalized === 2) return wrap('t20-b2', wbwMarkup(full, 'wbw-rise', 'imp-bold'));
          if (normalized === 3) return wrap('t20-b3', wbwMarkup(full, 'wbw-slide', 'imp-green'));
          return wrap('t20-b0', \`<span class="neon-drop lekha-template-fit">\${escapeHtml(upperFull)}</span>\`);
        case 't21':
          if (normalized === 1) return wrap('t21-b1', \`<span class="space-txt lekha-template-fit">\${heroMarkup(full, 'imp-space')}</span>\`);
          if (normalized === 2) return wrap('t21-b2', wbwMarkup(full, 'wbw-rise', 'imp-italic'));
          if (normalized === 3) return wrap('t21-b3', wbwMarkup(full, 'wbw-slide', 'imp-weight'));
          return wrap('t21-b0', \`<span class="vert-line"><span class="vert-line-inner">\${escapeHtml(upperFull)}</span></span>\`);
        case 't22':
          if (normalized === 1) return wrap('t22-b1', \`<span class="wave-txt lekha-template-fit">\${heroMarkup(full, 'imp-gold')}</span>\`);
          if (normalized === 2) return wrap('t22-b2', wbwMarkup(full, 'wbw-rise', 'imp-italic'));
          if (normalized === 3) return wrap('t22-b3', wbwMarkup(full, 'wbw-slide', 'imp-gold'));
          return wrap('t22-b0', \`<span style="position:relative;display:inline-block" class="lekha-template-fit"><span class="karaoke-base">\${escapeHtml(full)}</span><span class="karaoke-fill">\${escapeHtml(full)}</span></span>\`);
        case 't23':
          if (normalized === 3) return wrap('t23-b3', \`<span class="punch-txt lekha-template-fit">\${heroMarkup(full, 'imp-gold')}</span>\`);
          return wrap(\`t23-b\${normalized}\`, \`<span class="\${normalized === 0 ? 'setup-txt ' : ''}lekha-template-fit">\${escapeHtml(full)}</span>\`);
        case 't24':
          if (normalized === 1) return wrap('t24-b1', \`<span class="slow-rise lekha-template-fit">\${heroMarkup(full, 'imp-purple')}</span>\`);
          if (normalized === 2) return wrap('t24-b2', \`<span class="lekha-template-fit">\${escapeHtml(full)}</span>\`);
          if (normalized === 3) return wrap('t24-b3', wbwMarkup(full, 'wbw-rise', 'imp-purple'));
          return wrap('t24-b0', \`<span class="redact-wrap lekha-template-fit">\${top ? \`\${escapeHtml(top)} \` : ''}<span class="redact-block">&nbsp;\${escapeHtml(hero)}&nbsp;</span>\${bottom ? \` \${escapeHtml(bottom)}\` : ''}</span>\`);
        case 't25':
          if (normalized === 1) return wrap('t25-b1', \`<span class="soft-rise lekha-template-fit">\${heroMarkup(full, 'imp-italic')}</span>\`);
          if (normalized === 2) return wrap('t25-b2', wbwMarkup(full, 'wbw-rise', 'imp-rose'));
          if (normalized === 3) return wrap('t25-b3', wbwMarkup(full, 'wbw-slide', 'imp-italic'));
          return wrap('t25-b0', \`<span class="hand-txt lekha-template-fit">\${escapeHtml(lines2[0] || '')}\${lines2[1] ? \`<br>\${heroMarkup(lines2[1], 'imp-rose')}\` : ''}</span>\`);
        case 't26':
          if (normalized === 1) return wrap('t26-b1', \`<span class="fast-slide lekha-template-fit">\${heroMarkup(upperFull, 'imp-rose')}</span>\`);
          if (normalized === 2) return wrap('t26-b2', wbwMarkup(full, 'wbw-rise', 'imp-bold'));
          if (normalized === 3) return wrap('t26-b3', wbwMarkup(full, 'wbw-slide', 'imp-rose'));
          return wrap('t26-b0', \`<span class="hard-txt lekha-template-fit">\${escapeHtml(upperFull)}</span>\`);
        case 't27':
          if (normalized === 1) return wrap('t27-b1', \`<span class="lekha-template-fit" style="font-family:'Exo 2',sans-serif;font-weight:700;color:rgba(0,229,255,0.6)">\${escapeHtml(full)}</span>\`);
          if (normalized === 2) return wrap('t27-b2', \`<span class="lekha-template-fit">\${heroMarkup(full, 'imp-bold')}</span>\`);
          if (normalized === 3) return wrap('t27-b3', wbwMarkup(full, 'wbw-rise', 'imp-cyan'));
          return wrap('t27-b0', \`<span class="center-expand-txt lekha-template-fit">\${escapeHtml(upperFull)}</span>\`);
        case 't28':
          if (normalized === 1) return wrap('t28-b1', \`<span class="slow-fade lekha-template-fit">\${heroMarkup(full, 'imp-italic')}</span>\`);
          if (normalized === 2) return wrap('t28-b2', wbwMarkup(full, 'wbw-rise', 'imp-italic'));
          if (normalized === 3) return wrap('t28-b3', wbwMarkup(full, 'wbw-slide', 'imp-gold'));
          return wrap('t28-b0', \`<span class="grain-txt lekha-template-fit">\${escapeHtml(lines2[0] || '')}\${lines2[1] ? \`<br>\${heroMarkup(lines2[1], 'imp-gold')}\` : ''}</span>\`);
        case 't29':
          if (normalized === 1) return wrap('t29-b1', \`<span class="hard-rise lekha-template-fit">\${heroMarkup(full, 'imp-rose')}</span>\`);
          if (normalized === 2) return wrap('t29-b2', wbwMarkup(full, 'wbw-rise', 'imp-rose'));
          if (normalized === 3) return wrap('t29-b3', wbwMarkup(full, 'wbw-slide', 'imp-bold'));
          return wrap('t29-b0', \`<span class="slam-txt lekha-template-fit">\${escapeHtml(upperFull)}</span>\`);
        case 't30':
          if (normalized > 0) return wrap(\`t30-b\${normalized}\`, \`<span class="lekha-template-fit">\${normalized === 3 ? heroMarkup(full, 'imp-italic') : escapeHtml(full)}</span>\`);
          return wrap('t30-b0', \`<span class="breathe-txt lekha-template-fit">\${escapeHtml(lines2[0] || '')}\${lines2[1] ? \`<br><span class="imp-italic">\${escapeHtml(lines2[1])}</span>\` : ''}</span>\`);
        case 't31':
          if (normalized === 1) return wrap('t31-b1', \`<span style="perspective:500px" class="lekha-template-fit"><span class="flip-line" style="font-family:'Playfair Display',serif">\${heroMarkup(full, 'imp-gold')}</span></span>\`);
          if (normalized === 2) return wrap('t31-b2', \`<span class="lekha-template-fit">\${escapeHtml(full)}</span>\`);
          if (normalized === 3) return wrap('t31-b3', wbwMarkup(full, 'wbw-rise', 'imp-gold'));
          return wrap('t31-b0', \`<span class="stamp-text lekha-template-fit">\${escapeHtml(top || lines2[0] || full)}</span>\`);
        case 't32':
          if (normalized === 1) return wrap('t32-b1', \`<span style="perspective:500px" class="lekha-template-fit"><span class="flip-line" style="font-family:'Bodoni Moda',serif;font-style:italic">\${heroMarkup(full, 'imp-italic')}</span></span>\`);
          if (normalized === 2) return wrap('t32-b2', \`<span class="lekha-template-fit">\${escapeHtml(full)}</span>\`);
          if (normalized === 3) return wrap('t32-b3', wbwMarkup(full, 'wbw-rise', 'imp-purple'));
          return wrap('t32-b0', \`<span style="font-style:italic" class="lekha-template-fit">\${lineSpans(lines2, 'ink-line', (line, index) => index === lines2.length - 1 ? heroMarkup(line, 'imp-purple') : escapeHtml(line))}</span>\`);
        case 't33':
          if (normalized === 1) return wrap('t33-b1', \`<span style="perspective:500px" class="lekha-template-fit"><span class="flip-line" style="font-family:'Noto Sans',sans-serif">\${heroMarkup(full, 'imp-cyan')}</span></span>\`);
          if (normalized === 2) return wrap('t33-b2', \`<span class="lekha-template-fit">\${escapeHtml(full)}</span>\`);
          if (normalized === 3) return wrap('t33-b3', wbwMarkup(full, 'wbw-rise', 'imp-bold'));
          return wrap('t33-b0', \`<span class="doc-line lekha-template-fit">\${heroMarkup(full, 'imp-bold')}</span>\`);
        case 't34':
          if (normalized === 1) return wrap('t34-b1', \`<span class="pow-txt lekha-template-fit">\${heroMarkup(full, 'imp-cyan')}</span>\`);
          if (normalized === 2) return wrap('t34-b2', wbwMarkup(full, 'wbw-rise', 'imp-bold'));
          if (normalized === 3) return wrap('t34-b3', wbwMarkup(full, 'wbw-slide', 'imp-cyan'));
          return wrap('t34-b0', \`<span class="speed-txt lekha-template-fit">\${escapeHtml(upperFull)}</span>\`);
        case 't35':
          if (normalized > 0) return wrap(\`t35-b\${normalized}\`, \`<span class="lekha-template-fit">\${normalized === 3 ? heroMarkup(full, 'imp-italic') : escapeHtml(full)}</span>\`);
          return wrap('t35-b0', \`<span class="secret-txt lekha-template-fit">\${heroMarkup(full, 'imp-italic')}</span>\`);
        default:
          return '';
      }
    };

    const buildWordMeta = (caption) => {
      const splitWords = String(caption.text || '').split(/\\s+/).filter(Boolean);
      const styled = caption.word_styles || {};
      return splitWords.map((word, index) => ({
        text: word,
        key: \`\${caption.id}-\${index}\`,
        style: styled[\`\${caption.id}-\${index}\`] || {},
      }));
    };

    const buildTemplateMarkup = (caption, globalStyle, time) => {
      const templateIndex = Number.isFinite(Number(caption.__templateIndex))
        ? Number(caption.__templateIndex)
        : Number(caption.__template_index || 0);
      const words = buildWordMeta(caption);
      const captionStart = Number(caption.start_time ?? 0);
      const captionEnd = Number(caption.end_time ?? captionStart);
      const captionDuration = Math.max(captionEnd - captionStart, 0.01);
      const elapsed = Math.min(Math.max(time - captionStart, 0), captionDuration);
      const currentIndex = words.length > 1
        ? Math.max(0, Math.min(words.length - 1, Math.floor((elapsed / captionDuration) * words.length)))
        : 0;
      const showInactive = globalStyle?.show_inactive !== false;
      const wordSpacing = \`\${scaleExportPx((globalStyle?.word_spacing ?? 1) * 2)}px\`;
      const advancedTemplateVariants = ${JSON.stringify(ADVANCED_TEMPLATE_VARIANTS)};
      const isAdvancedTemplate = ${isAdvancedTemplateId.toString()}(globalStyle?.template_id);
      const wrapperClassName = isAdvancedTemplate
        ? \`\${advancedTemplateVariants[globalStyle?.template_id] || 'wbw-rise'} \${globalStyle?.template_id || ''}\`
        : 'cap-text';

      const flowedWords = words
        .map((word, index) => {
          if (!showInactive && index > currentIndex) return '';

          const wordStyle = word.style || {};
          const isPast = index < currentIndex;
          const isCurrent = index === currentIndex;
          let className = 'word';
          if (isCurrent) className += ' current active';
          else if (isPast) className += ' active done';
          if (wordStyle.isEmphasis) className += ' imp';
          if (isAdvancedTemplate) {
            className = ['w', isPast || isCurrent ? 'in' : '', wordStyle.isEmphasis ? 'imp-bold' : '']
              .filter(Boolean)
              .join(' ');
          }

          const inline = [];
          if (wordStyle.color) inline.push(\`color:\${wordStyle.color}\`);
          if (wordStyle.fontFamily) inline.push(\`font-family:"\${wordStyle.fontFamily}"\`);
          if (wordStyle.fontSize) inline.push(\`font-size:\${scaleTemplateFontSize(wordStyle.fontSize)}px\`);
          if (wordStyle.fontWeight) inline.push(\`font-weight:\${wordStyle.fontWeight}\`);
          if (wordStyle.fontStyle) inline.push(\`font-style:\${wordStyle.fontStyle}\`);
          if (index < words.length - 1) inline.push(\`margin-right:\${wordSpacing}\`);

          return \`<span data-word-key="\${word.key}" class="\${className}" style="\${inline.join(';')}">\${escapeHtml(transformText(word.text, globalStyle))}</span>\`;
        })
        .filter(Boolean)
        .join('');

      const positionedWords = words
        .filter((word) => word.style?.abs_x_pct !== undefined && word.style?.abs_y_pct !== undefined)
        .map((word) => {
          const inline = [
            'position:absolute',
            \`left:\${word.style.abs_x_pct}%\`,
            \`top:\${word.style.abs_y_pct}%\`,
            'transform:translate(-50%, -50%)',
            'display:inline-block',
            'white-space:pre',
            \`font-family:"\${word.style.fontFamily || globalStyle?.font_family || 'Inter'}"\`,
            \`font-size:\${scaleTemplateFontSize(word.style.fontSize || globalStyle?.font_size || 18)}px\`,
            \`font-weight:\${word.style.fontWeight || globalStyle?.font_weight || '500'}\`,
            \`font-style:\${word.style.fontStyle || globalStyle?.font_style || 'normal'}\`,
            \`color:\${word.style.color || globalStyle?.text_color || '#ffffff'}\`,
          ];
          return \`<span class="export-positioned-word" style="\${inline.join(';')}">\${escapeHtml(transformText(word.text, globalStyle))}</span>\`;
        })
        .join('');

      const hasAppliedTemplate = Boolean(globalStyle?.template_id);
      const styleVars = [
        \`--template-primary:\${globalStyle?.text_color || '#ffffff'}\`,
        \`--template-secondary:\${globalStyle?.secondary_color || '#000000'}\`,
        \`--template-bg:\${hasAppliedTemplate ? 'transparent' : (globalStyle?.background_color || 'transparent')}\`,
        \`--template-highlight:\${globalStyle?.highlight_color || '#FFE600'}\`,
      ];

      if (isAdvancedTemplate) {
        return \`
          <div class="template-caption-shell" style="\${styleVars.join(';')}">
            <div class="\${globalStyle?.template_id || ''}">
              <span class="\${globalStyle?.template_id || ''}" style="
                font-family:'\${globalStyle?.font_family || 'Inter'}';
                font-size:\${scaleTemplateFontSize(globalStyle?.font_size || 18)}px;
                font-weight:\${globalStyle?.font_weight || '500'};
                font-style:\${globalStyle?.font_style || 'normal'};
                text-align:\${globalStyle?.text_align || 'center'};
                letter-spacing:\${scaleExportPx(globalStyle?.letter_spacing || 0)}px;
              ">\${buildOriginalAdvancedTemplateMarkup(globalStyle?.template_id, transformText(caption.text || '', globalStyle), templateIndex)}</span>
            </div>
            \${positionedWords}
          </div>
        \`;
      }

      return \`
        <div class="template-caption-shell" style="\${styleVars.join(';')}">
          <div class="\${globalStyle?.template_id || ''}">
            <span class="\${wrapperClassName}" style="
              font-family:'\${globalStyle?.font_family || 'Inter'}';
              font-size:\${scaleTemplateFontSize(globalStyle?.font_size || 18)}px;
              font-weight:\${globalStyle?.font_weight || '500'};
              font-style:\${globalStyle?.font_style || 'normal'};
              text-align:\${globalStyle?.text_align || 'center'};
              letter-spacing:\${scaleExportPx(globalStyle?.letter_spacing || 0)}px;
            ">\${flowedWords}</span>
          </div>
          \${positionedWords}
        </div>
      \`;
    };

    const sanitizeSidebarInlineStyle = (styleValue = '') => {
      const allowed = String(styleValue)
        .split(';')
        .map((declaration) => declaration.trim())
        .filter(Boolean)
        .filter((declaration) => {
          const parts = declaration.split(':');
          const property = String(parts.shift() || '').trim().toLowerCase();
          const value = parts.join(':').trim();
          return property === 'animation-delay' && /^-?\\d*\\.?\\d+(m?s)$/i.test(value);
        });
      return allowed.length ? ' style="' + allowed.join(';') + '"' : '';
    };

    const sanitizeSidebarTemplateMarkup = (markup = '', preserveInlineStyles = false) => String(markup)
      .replace(/<script[\\s\\S]*?<\\/script>/gi, '')
      .replace(/\\s+bis_skin_checked="[^"]*"/gi, '')
      .replace(/\\sstyle="([^"]*)"/gi, preserveInlineStyles ? (_, styleValue) => sanitizeSidebarInlineStyle(styleValue) : '')
      .replace(/\\sclass="([^"]*)"/gi, (_, classValue) => {
        const cleanedClassValue = String(classValue)
          .split(/\\s+/)
          .filter((className) => className && !['active', 'visible', 'anim', 'on', 'in'].includes(className))
          .join(' ');
        return cleanedClassValue ? ' class="' + cleanedClassValue + '"' : '';
      })
      .replace(/\\s+data-ti="[^"]*"/gi, '')
      .replace(/\\s+data-si="[^"]*"/gi, '');

    const cleanSidebarClassName = (value, fallback) => {
      const cleaned = String(value || '')
        .split(/\\s+/)
        .filter((className) => className && !['active', 'visible', 'anim', 'on', 'in'].includes(className))
        .join(' ');
      return cleaned || fallback;
    };

    const mappedSidebarClassName = (sourceClasses, index, total, fallback) => {
      if (!sourceClasses.length) return fallback;
      if (total <= 1) return sourceClasses[0] || fallback;
      const sourceIndex = Math.min(
        sourceClasses.length - 1,
        Math.round((index * (sourceClasses.length - 1)) / Math.max(1, total - 1)),
      );
      return sourceClasses[sourceIndex] || fallback;
    };

    const splitSidebarWordsForSlots = (words, slotCount) => {
      if (!words.length || !slotCount) return [];
      const slots = Array.from({ length: slotCount }, () => []);
      words.forEach((word, index) => {
        slots[Math.min(slotCount - 1, Math.floor((index * slotCount) / words.length))].push(word);
      });
      return slots.map((slot) => slot.join(' '));
    };

    const replaceSidebarWordByWord = (container, words) => {
      if (!container || !words.length) return false;
      const isNewWbw = container.classList.contains('wbw-line');
      const selector = isNewWbw ? '.wbw-word' : '.w';
      const fallback = isNewWbw ? 'wbw-word normal' : 'w';
      const sourceClasses = Array.from(container.querySelectorAll(selector))
        .map((word) => cleanSidebarClassName(word.className, fallback));
      container.innerHTML = words.map((word, index) => (
        '<span class="' + mappedSidebarClassName(sourceClasses, index, words.length, fallback) + '">' + escapeHtml(word) + '</span>'
      )).join(' ');
      return true;
    };

    const replaceSidebarSticky = (container, words) => {
      const stickyWords = Array.from(container.querySelectorAll('.sw-w'));
      if (!stickyWords.length || !words.length) return false;
      const sourceClasses = stickyWords.map((word) => cleanSidebarClassName(word.className, 'sw-w'));
      container.innerHTML = words.map((word, index) => (
        '<span class="' + mappedSidebarClassName(sourceClasses, index, words.length, 'sw-w') + '">' + escapeHtml(word) + '</span>'
      )).join(' ');
      return true;
    };

    const replaceSidebarPositioned = (block, words) => {
      const spans = Array.from(block.querySelectorAll('.sw'));
      if (!spans.length || !words.length) return false;
      const chunks = splitSidebarWordsForSlots(words, spans.length);
      spans.forEach((span, index) => {
        const text = chunks[index] || '';
        span.textContent = text;
        span.style.display = text ? '' : 'none';
      });
      return true;
    };

    const replaceSidebarPlain = (block, captionText) => {
      const plain = Array.from(block.querySelectorAll('.plain-s'))
        .find((element) => !element.classList.contains('wbw') && !element.classList.contains('wbw-line'));
      if (!plain || !captionText) return false;
      plain.textContent = captionText;
      return true;
    };

    const replaceSidebarTemplateText = (block, captionText) => {
      const words = String(captionText || '').trim().split(/\\s+/).filter(Boolean);
      block.querySelectorAll('.wbw, .wbw-line').forEach((container) => replaceSidebarWordByWord(container, words));
      block.querySelectorAll('.sw-line').forEach((container) => replaceSidebarSticky(container, words));
      replaceSidebarPositioned(block, words);
      replaceSidebarPlain(block, captionText);
    };

    const getSidebarWordMotion = (parent) => {
      const classes = parent ? parent.classList : { contains: () => false };
      if (classes.contains('wslide') || classes.contains('wbw-slide')) return { transform: 'translateX(-26px)', opacity: '0' };
      if (classes.contains('wslider')) return { transform: 'translateX(26px)', opacity: '0' };
      if (classes.contains('wroll')) return { transform: 'translateY(14px) rotate(-6deg)', opacity: '0', origin: 'left bottom' };
      if (classes.contains('wwipe')) return { transform: 'none', opacity: '1', clipPath: 'inset(0 100% 0 0)' };
      if (classes.contains('wwipeup')) return { transform: 'none', opacity: '1', clipPath: 'inset(100% 0 0 0)' };
      if (classes.contains('wfade')) return { transform: 'none', opacity: '0' };
      if (classes.contains('wscale')) return { transform: 'scale(0.5)', opacity: '0' };
      if (classes.contains('wflip')) return { transform: 'rotateX(-80deg)', opacity: '0', origin: 'center bottom' };
      if (classes.contains('wbounce')) return { transform: 'translateY(-22px)', opacity: '0' };
      if (classes.contains('wdiag')) return { transform: 'translate(-16px, 16px)', opacity: '0' };
      if (classes.contains('wexpand')) return { transform: 'scaleX(0.15)', opacity: '0', origin: 'center' };
      if (classes.contains('wskew')) return { transform: 'skewX(-18deg) translateX(-12px)', opacity: '0' };
      if (classes.contains('wstencil')) return { transform: 'none', opacity: '1', clipPath: 'inset(0 50% 0 50%)' };
      if (classes.contains('wlift')) return { transform: 'translateY(-22px)', opacity: '0' };
      return { transform: 'translateY(22px)', opacity: '0' };
    };

    const getSidebarSwMotion = (element) => {
      const key = element.dataset.anim || Array.from(element.classList).find((className) => (
        /^(rise|slide-l|slide-r|slide-slow|fade|wipe|reveal-up|diagonal-wipe|pop|zoom-out|rotate-in|roll|forge|unfold)$/.test(className)
      )) || 'fade';
      if (/slide-l|slide-slow/.test(key)) return { transform: 'translateX(-28px)', opacity: '0' };
      if (/slide-r/.test(key)) return { transform: 'translateX(28px)', opacity: '0' };
      if (/rise/.test(key)) return { transform: 'translateY(20px)', opacity: '0' };
      if (/pop|zoom-out/.test(key)) return { transform: 'scale(0.82)', opacity: '0' };
      if (/rotate|roll/.test(key)) return { transform: 'rotateX(-80deg)', opacity: '0', origin: 'center bottom' };
      if (/wipe|reveal|forge|unfold|diagonal/.test(key)) return { transform: 'none', opacity: '1', clipPath: /diagonal/.test(key) ? 'polygon(0 0, 0 0, 0 100%, 0 100%)' : 'inset(0 100% 0 0)' };
      return { transform: 'none', opacity: '0' };
    };

    const chooseSidebarPhase = (blocks, elapsedMs, fallbackDuration) => {
      if (!blocks.length) return { block: null, index: 0, phaseStartMs: 0 };
      const durations = blocks.map((block) => Math.max(700, Number(block.dataset.dur || fallbackDuration || 2800)));
      const cycleMs = durations.reduce((sum, value) => sum + value, 0) || fallbackDuration || 2800;
      let cursor = ((elapsedMs % cycleMs) + cycleMs) % cycleMs;
      let phaseStartMs = elapsedMs - cursor;
      for (let index = 0; index < blocks.length; index += 1) {
        if (cursor < durations[index]) return { block: blocks[index], index, phaseStartMs };
        cursor -= durations[index];
        phaseStartMs += durations[index];
      }
      return { block: blocks[0], index: 0, phaseStartMs: 0 };
    };

    const parseSidebarAnimationDelayMs = (value = '') => {
      const match = String(value || '').trim().match(/^(-?\\d*\\.?\\d+)(ms|s)$/i);
      if (!match) return 0;
      const amount = Number(match[1]);
      if (!Number.isFinite(amount)) return 0;
      return match[2].toLowerCase() === 's' ? amount * 1000 : amount;
    };

    const activateSidebarTemplateShells = (root, time) => {
      root.querySelectorAll('.lekha-sidebar-export-template-shell').forEach((shell) => {
        const captionText = shell.dataset.captionText || '';
        const captionStart = Number(shell.dataset.captionStart || 0);
        const isNewTemplateSet = shell.dataset.templateSource === 'lekha-49';
        const elapsedMs = Math.max(0, (time - captionStart) * 1000);
        const fallbackDuration = isNewTemplateSet ? 3200 : 2800;
        const wordStagger = isNewTemplateSet ? 160 : 120;
        const blocks = Array.from(shell.querySelectorAll('.sb, .sblock'));
        const dots = Array.from(shell.querySelectorAll('.dots i, .lk-dots i'));

        blocks.forEach((block) => {
          replaceSidebarTemplateText(block, captionText);
          block.classList.remove('active');
          block.style.opacity = '0';
          block.style.visibility = 'hidden';
          block.style.zIndex = '0';
          block.querySelectorAll('.w, .wbw-word').forEach((word) => {
            const motion = getSidebarWordMotion(word.parentElement);
            word.classList.remove('visible', 'anim', 'in');
            word.classList.remove('sidebar-export-word-anim');
            word.style.setProperty('--sidebar-export-initial-transform', motion.transform || 'none');
            word.style.setProperty('--sidebar-export-initial-opacity', motion.opacity || '0');
            word.style.setProperty('--sidebar-export-initial-clip', motion.clipPath || 'inset(0 0 0 0)');
            word.style.transformOrigin = motion.origin || '';
          });
          block.querySelectorAll('.sw').forEach((element) => {
            element.classList.remove('in', 'sidebar-export-sw-anim');
            if (!isNewTemplateSet) {
              const motion = getSidebarSwMotion(element);
              element.style.setProperty('--sidebar-export-initial-transform', motion.transform || 'none');
              element.style.setProperty('--sidebar-export-initial-opacity', motion.opacity || '0');
              element.style.setProperty('--sidebar-export-initial-clip', motion.clipPath || 'inset(0 0 0 0)');
              element.style.transformOrigin = motion.origin || '';
            }
          });
          block.querySelectorAll('.sw-w').forEach((word) => {
            word.style.opacity = '0.14';
          });
        });

        const phase = chooseSidebarPhase(blocks, elapsedMs, fallbackDuration);
        if (!phase.block) return;
        phase.block.style.visibility = 'visible';
        phase.block.style.zIndex = '2';
        phase.block.style.opacity = '1';
        phase.block.classList.add('active');
        dots.forEach((dot, dotIndex) => {
          dot.className = dotIndex === phase.index ? 'on' : '';
        });

        phase.block.querySelectorAll('.w, .wbw-word').forEach((word, index) => {
          const duration = /\\b(imp-|ns[23]-)/.test(word.className) ? 440 : 320;
          word.style.setProperty('--sidebar-export-word-duration', duration + 'ms');
          word.style.setProperty('--sidebar-export-word-delay', (phase.phaseStartMs + index * wordStagger) + 'ms');
          word.classList.add('sidebar-export-word-anim');
        });
        phase.block.querySelectorAll('.sw').forEach((element, index) => {
          if (isNewTemplateSet) {
            const sourceDelayMs = parseSidebarAnimationDelayMs(element.style.animationDelay || '0s');
            element.style.animationDelay = (phase.phaseStartMs + sourceDelayMs) + 'ms';
          } else {
            element.style.setProperty('--sidebar-export-word-duration', '420ms');
            element.style.setProperty('--sidebar-export-word-delay', (phase.phaseStartMs + index * 120) + 'ms');
            element.classList.add('sidebar-export-sw-anim');
          }
        });
        phase.block.querySelectorAll('.sw-w').forEach((word, index) => {
          word.style.setProperty('--sidebar-export-word-delay', (phase.phaseStartMs + index * 190) + 'ms');
          word.classList.add('sidebar-export-sticky-anim');
        });
      });
    };

    const buildSidebarTemplateMarkup = (caption, globalStyle) => {
      const appliedStyle = caption.applied_template_style || {};
      const templateMarkup = sanitizeSidebarTemplateMarkup(
        caption.template_markup || appliedStyle.template_markup || globalStyle?.template_markup || '',
        (caption.template_source || appliedStyle.template_source || globalStyle?.template_source || '') === 'lekha-49',
      );
      if (!templateMarkup) return '';
      return '<div class="lekha-sidebar-export-template-shell"'
        + ' data-caption-id="' + escapeHtml(caption.id || '') + '"'
        + ' data-caption-text="' + escapeHtml(transformText(caption.text || '', globalStyle)) + '"'
        + ' data-caption-start="' + Number(caption.start_time || 0) + '"'
        + ' data-template-source="' + escapeHtml(caption.template_source || appliedStyle.template_source || globalStyle?.template_source || '') + '"'
        + '>' + templateMarkup + '</div>';
    };

    const buildPlainCaptionMarkup = (caption, globalStyle, time) => {
      const words = buildWordMeta(caption);
      const currentIndex = getCurrentWordIndex(caption, time);
      const showInactive = globalStyle?.show_inactive !== false;
      const wordSpacing = \`\${scaleExportPx((globalStyle?.word_spacing ?? 1) * 2)}px\`;

      const wordMarkup = words
        .map((word, index) => {
          if (!showInactive && index > currentIndex) return '';
          const wordStyle = word.style || {};
          const baseColor = wordStyle.color || globalStyle?.text_color || '#ffffff';
          const inline = [
            'display:inline-block',
            'position:relative',
            \`font-family:"\${wordStyle.fontFamily || globalStyle?.font_family || 'Inter'}"\`,
            \`font-size:\${scaleExportPx(wordStyle.fontSize || globalStyle?.font_size || 18)}px\`,
            \`font-weight:\${wordStyle.fontWeight || globalStyle?.font_weight || '500'}\`,
            \`font-style:\${wordStyle.fontStyle || globalStyle?.font_style || 'normal'}\`,
            \`color:\${baseColor}\`,
            index < words.length - 1 ? \`margin-right:\${wordSpacing}\` : '',
          ].filter(Boolean);
          if (globalStyle?.has_stroke) inline.push(\`-webkit-text-stroke:\${globalStyle.stroke_width || 1}px \${globalStyle.stroke_color || '#000000'}\`);
          if (globalStyle?.has_shadow) inline.push(\`text-shadow:\${globalStyle.shadow_offset_x || 0}px \${globalStyle.shadow_offset_y || 2}px \${globalStyle.shadow_blur || 4}px \${globalStyle.shadow_color || '#000000'}\`);
          if (wordStyle.backgroundColor) {
            inline.push(\`background:\${rgbaFromHex(wordStyle.backgroundColor, wordStyle.backgroundOpacity ?? 0.6)}\`);
            inline.push(\`padding:\${scaleExportPx(wordStyle.backgroundPadding || 2)}px \${scaleExportPx((wordStyle.backgroundPadding || 2) * 2)}px\`);
            inline.push('border-radius:4px');
          }
          return \`<span data-word-key="\${word.key}" style="\${inline.join(';')}">\${escapeHtml(transformText(word.text, globalStyle))}</span>\`;
        })
        .filter(Boolean)
        .join('');

      return \`
        <div class="plain-caption-shell">
          <span class="cap-text" style="
            font-family:'\${globalStyle?.font_family || 'Inter'}';
            font-size:\${scaleExportPx(globalStyle?.font_size || 18)}px;
            font-weight:\${globalStyle?.font_weight || '500'};
            font-style:\${globalStyle?.font_style || 'normal'};
            text-align:\${globalStyle?.text_align || 'center'};
            line-height:\${scaleExportPx((globalStyle?.font_size || 18) * (globalStyle?.line_spacing || 1.4))}px;
            \${globalStyle?.has_background && !globalStyle?.template_id ? \`background:\${rgbaFromHex(globalStyle.background_color || '#000000', globalStyle.background_opacity ?? 0.7)};padding:\${scaleExportPx(globalStyle.background_padding || 6)}px \${scaleExportPx((globalStyle.background_padding || 6) * 2)}px;border-radius:\${scaleExportPx(8)}px;\` : ''}
          ">\${wordMarkup}</span>
        </div>
      \`;
    };

    const buildTextElementMarkup = (caption) => {
      const custom = caption.custom_style || {};
      return \`
        <div class="text-element-shell" style="
          position:absolute;
          left:\${custom.position_x ?? 50}%;
          top:\${custom.position_y ?? 50}%;
          transform:translate(-50%, -50%);
          text-align:\${custom.text_align || 'center'};
          pointer-events:none;
        ">
          <span style="
            display:inline-block;
            white-space:pre-wrap;
            font-family:'\${custom.font_family || 'Inter'}';
            font-size:\${scaleExportPx(custom.font_size || 18)}px;
            font-weight:\${custom.font_weight || '500'};
            font-style:\${custom.font_style || 'normal'};
            color:\${custom.text_color || '#ffffff'};
            \${custom.has_background ? \`background:\${rgbaFromHex(custom.background_color || '#000000', custom.background_opacity ?? 0.6)};padding:\${scaleExportPx(custom.padding || 8)}px;border-radius:\${scaleExportPx(8)}px;\` : ''}
            \${custom.has_stroke ? \`-webkit-text-stroke:\${scaleExportPx(custom.stroke_width || 1)}px \${custom.stroke_color || '#000000'};\` : ''}
            \${custom.has_shadow ? \`text-shadow:\${scaleExportPx(custom.shadow_offset_x || 0)}px \${scaleExportPx(custom.shadow_offset_y || 2)}px \${scaleExportPx(custom.shadow_blur || 4)}px \${custom.shadow_color || '#000000'};\` : ''}
          ">\${escapeHtml(String(caption.text || '')).replace(/\\n/g, '<br/>')}</span>
        </div>
      \`;
    };

    const syncAdvancedTemplateExportScale = () => {
      const targetFontPx = Number(window.__exportTemplateFontTargetPx || 0);
      if (!targetFontPx) return;

      document.querySelectorAll('.lekha-original-template').forEach((wrapper) => {
        const block = wrapper.querySelector('.lekha-applied-advanced-template') || wrapper;
        const currentFontPx = parseFloat(getComputedStyle(block).fontSize || '');
        if (!Number.isFinite(currentFontPx) || currentFontPx <= 0) return;
        const scale = Math.max(0.25, Math.min(8, targetFontPx / currentFontPx));
        if (!Number.isFinite(scale) || Math.abs(scale - 1) < 0.01) return;
        wrapper.style.transform = \`scale(\${scale})\`;
        wrapper.style.transformOrigin = 'center center';
      });
    };

    const resetAdvancedTemplateAnimations = () => {
      const blocks = Array.from(document.querySelectorAll('.lekha-applied-advanced-template'));
      blocks.forEach((block) => {
        block.classList.remove('active');
        block.style.transition = 'none';
        block.style.opacity = '0';

        block.querySelectorAll('.cluster-row-top, .cluster-hl, .cluster-row-bot').forEach((element) => {
          element.classList.remove('active');
          element.style.transition = 'none';
        });
      });
      return blocks;
    };

    window.__activateTemplateAnimations = async () => {
      const blocks = resetAdvancedTemplateAnimations();
      if (!blocks.length) return;

      void document.body.offsetHeight;
      await new Promise((resolve) => requestAnimationFrame(resolve));

      blocks.forEach((block) => {
        block.style.transition = 'opacity 280ms ease';
        block.style.opacity = '1';
        block.classList.add('active');

        block.querySelectorAll('.cluster-row-top, .cluster-hl, .cluster-row-bot').forEach((element) => {
          element.style.transition = '';
          element.classList.add('active');
        });
      });

      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    };

    window.__renderPayload = (payload, time) => {
      const root = document.getElementById('overlay-root');
      if (!root) return;
      const style = payload.style || {};
      const activeCaptions = (payload.captions || []).filter((caption) => {
        const start = Number(caption.start_time ?? 0);
        const end = Number(caption.end_time ?? start);
        return time >= start && time <= end;
      });

      root.innerHTML = activeCaptions.map((caption) => {
        if (caption.is_text_element) return buildTextElementMarkup(caption);
        const templateCaptionIndex = Math.max(0, (payload.captions || []).findIndex((item) => item?.id === caption.id && !item?.is_text_element));
        const captionWithTemplateIndex = {
          ...caption,
          __templateIndex: Number.isFinite(Number(caption.__templateIndex))
            ? Number(caption.__templateIndex)
            : templateCaptionIndex,
        };
        const left = style.position_x ?? 50;
        const top = style.position_y ?? 75;
        const isSidebarTemplate = Boolean(style.template_20_id);
        const base = isSidebarTemplate
          ? [
              'position:absolute',
              'left:0',
              \`top:\${top}%\`,
              'transform:translateY(-50%)',
              'pointer-events:none',
              'width:100%',
              'display:flex',
              'justify-content:center',
              \`text-align:\${style.text_align || 'center'}\`,
            ]
          : [
              'position:absolute',
              \`left:\${left}%\`,
              \`top:\${top}%\`,
              'transform:translate(-50%, -50%)',
              'pointer-events:none',
              'width:max-content',
              'max-width:90%',
              \`text-align:\${style.text_align || 'center'}\`,
            ];
        const inner = isSidebarTemplate
          ? buildSidebarTemplateMarkup(captionWithTemplateIndex, style)
          : style.template_id
          ? buildTemplateMarkup(captionWithTemplateIndex, style, time)
          : buildPlainCaptionMarkup(captionWithTemplateIndex, style, time);
        return \`<div class="caption-anchor" style="\${base.join(';')}">\${inner}</div>\`;
      }).join('');
      activateSidebarTemplateShells(root, time);
      syncAdvancedTemplateExportScale();
    };
  `;
}

async function main() {
  const payloadPath = process.argv[2];
  if (!payloadPath) {
    throw new Error('Missing payload JSON path');
  }

  const payload = JSON.parse((await fs.readFile(payloadPath, 'utf8')).replace(/^\uFEFF/, ''));
  const outputDir = payload.output_dir || path.join(projectRoot, 'tmp-overlay');
  await fs.mkdir(outputDir, { recursive: true });

  const captionCss = await fs.readFile(path.join(projectRoot, 'src', 'styles', 'captionTemplates.css'), 'utf8');
  const advancedCaptionCss = await fs.readFile(path.join(projectRoot, 'src', 'styles', 'captionTemplatesAdvanced.css'), 'utf8');
  const originalTemplateHtml = await fs.readFile(path.join(projectRoot, 'src', 'assets', 'lekha-captions-T11-T35.html'), 'utf8');
  const originalTemplateCss = extractOriginalTemplateRuntimeCss(originalTemplateHtml);
  const hasSidebarTemplate = Boolean(payload.style?.template_20_id);
  const sidebarTemplateHtml = hasSidebarTemplate
    ? await fs.readFile(path.join(projectRoot, 'src', 'assets', payload.style?.template_source === 'lekha-49' ? 'lekha-captions-49-templates.html' : 'lekha-captions-20-templates.html'), 'utf8')
    : '';
  const sidebarTemplateCss = hasSidebarTemplate ? extractHtmlStyle(sidebarTemplateHtml) : '';
  const previewWidth = Number(payload.style?.preview_width || 0);
  const exportCssScale = Math.max(1, Math.min(8, Number(payload.video_width || 360) / (previewWidth || 360)));
  const previewTemplateFontPx = Number(payload.style?.preview_template_font_px || 0);
  const exportTemplateFontTargetPx = previewTemplateFontPx > 0
    ? previewTemplateFontPx * exportCssScale
    : 0;
  const exportRootFontSize = Math.round(16 * exportCssScale);
  const exportTemplateMaxWidth = Math.round(360 * exportCssScale);
  const exportSidebarWidth = Math.round(Math.max(160, Math.min(Number(payload.video_width || 360) * 0.94, 320 * exportCssScale)));
  const exportSidebarHeight = Math.round(Math.max(120, Math.min(Number(payload.video_height || 640) * 0.56, 280 * exportCssScale)));
  console.log(`[Template DOM] sizing preview_width=${previewWidth || 'missing'} preview_template_font_px=${previewTemplateFontPx || 'missing'} video_width=${payload.video_width} css_scale=${exportCssScale.toFixed(4)} target_template_font_px=${exportTemplateFontTargetPx ? exportTemplateFontTargetPx.toFixed(2) : 'auto'}`);
  const runtimeCss = `
    ${sidebarTemplateCss}

    html, body {
      margin: 0;
      width: 100%;
      height: 100%;
      background: transparent !important;
      overflow: hidden;
    }
    body {
      font-family: 'Inter', sans-serif;
      font-size: ${exportRootFontSize}px;
    }
    #overlay-root {
      position: relative;
      width: ${payload.video_width}px;
      height: ${payload.video_height}px;
      background: transparent;
      overflow: hidden;
    }
    .template-caption-shell,
    .plain-caption-shell {
      position: relative;
      display: inline-block;
      max-width: 100%;
    }
    .lekha-sidebar-export-template-shell {
      display: block;
      width: ${exportSidebarWidth}px;
      height: ${exportSidebarHeight}px;
      max-width: 94%;
      overflow: hidden;
      background: transparent !important;
      pointer-events: none;
      color: #fff;
    }
    .lekha-sidebar-export-template-shell .card,
    .lekha-sidebar-export-template-shell .lk-card {
      display: block !important;
      width: 100% !important;
      height: 100% !important;
      min-height: 0 !important;
      aspect-ratio: auto !important;
      border: 0 !important;
      border-radius: 0 !important;
      box-shadow: none !important;
      background: transparent !important;
      overflow: hidden !important;
    }
    .lekha-sidebar-export-template-shell .lk-card {
      display: grid !important;
      grid-template-rows: 1fr !important;
    }
    .lekha-sidebar-export-template-shell .card-top,
    .lekha-sidebar-export-template-shell .dots,
    .lekha-sidebar-export-template-shell .lk-card-top,
    .lekha-sidebar-export-template-shell .lk-dots,
    .lekha-sidebar-export-template-shell .slbl,
    .lekha-sidebar-export-template-shell .lk-lbl,
    .lekha-sidebar-export-template-shell .stage-lbl,
    .lekha-sidebar-export-template-shell .lk-phase-chip {
      display: none !important;
    }
    .lekha-sidebar-export-template-shell .stage,
    .lekha-sidebar-export-template-shell .lk-stage {
      position: relative !important;
      inset: auto !important;
      width: 100% !important;
      height: 100% !important;
      min-height: 0 !important;
      border: 0 !important;
      box-shadow: none !important;
      background: transparent !important;
      overflow: hidden !important;
    }
    .lekha-sidebar-export-template-shell .card[class] .stage,
    .lekha-sidebar-export-template-shell .lk-card[class] .lk-stage {
      background: transparent !important;
      box-shadow: none !important;
    }
    .lekha-sidebar-export-template-shell .sb,
    .lekha-sidebar-export-template-shell .sblock {
      opacity: 0 !important;
      pointer-events: none !important;
      background: transparent !important;
      visibility: hidden;
    }
    .lekha-sidebar-export-template-shell .sb.active,
    .lekha-sidebar-export-template-shell .sblock.active {
      opacity: 1 !important;
      visibility: visible;
    }
    .lekha-sidebar-export-template-shell .w,
    .lekha-sidebar-export-template-shell .wbw-word,
    .lekha-sidebar-export-template-shell .sw,
    .lekha-sidebar-export-template-shell .sw-w {
      display: inline-block;
      backface-visibility: hidden;
      will-change: transform, opacity, clip-path;
    }
    .lekha-sidebar-export-template-shell .sidebar-export-word-anim,
    .lekha-sidebar-export-template-shell .sidebar-export-sw-anim {
      animation-name: lekhaSidebarExportWordIn;
      animation-duration: var(--sidebar-export-word-duration, 320ms);
      animation-delay: var(--sidebar-export-word-delay, 0ms);
      animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
      animation-fill-mode: both;
      animation-play-state: running;
    }
    .lekha-sidebar-export-template-shell .sidebar-export-sticky-anim {
      animation: lekhaSidebarExportStickyIn 240ms ease both;
      animation-delay: var(--sidebar-export-word-delay, 0ms);
    }
    .cap-text,
    .plain-s,
    .wbw-rise,
    .wbw-slide {
      display: inline-flex;
      flex-wrap: wrap;
      justify-content: center;
      align-items: center;
      line-height: 1.2;
    }
    .export-positioned-word {
      pointer-events: none;
      white-space: pre;
    }
    .lekha-original-template {
      --gold: #d4af37;
      --rose: #ff3d71;
      --cyan: #00e5ff;
      --green: #39ff14;
      --purple: #a78bfa;
      --white: #ffffff;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: auto;
      max-width: min(82vw, ${exportTemplateMaxWidth}px);
      color: #fff;
      text-align: center;
      pointer-events: none;
    }
    .lekha-original-template[class*='t'][class*='-stage'] {
      background: transparent !important;
      box-shadow: none !important;
    }
    .lekha-original-template .sblock {
      position: relative !important;
      inset: auto !important;
      display: inline-flex !important;
      width: auto !important;
      min-width: 0 !important;
      min-height: 0 !important;
      opacity: 1;
      padding: 0 !important;
      overflow: visible !important;
      white-space: normal;
    }
    .lekha-original-template .lekha-template-fit {
      display: inline-block;
      max-width: 100%;
    }
    .lekha-original-template .cluster-wrap {
      align-items: stretch;
    }
    .lekha-original-template .t11-b0 .cluster-hl {
      font-size: 0.72em !important;
    }
    .lekha-original-template .wbw-rise .w,
    .lekha-original-template .wbw-slide .w {
      opacity: 0;
      display: inline-block;
      transition: none;
    }
    .lekha-original-template .wbw-rise .w {
      transform: translateY(20px);
    }
    .lekha-original-template .wbw-slide .w {
      transform: translateX(-16px);
    }
    .lekha-original-template .active .wbw-rise .w.in,
    .lekha-original-template .active .wbw-slide .w.in {
      animation: lekhaTemplateWbwIn 320ms cubic-bezier(0.34, 1.2, 0.64, 1) forwards;
      animation-delay: var(--wbw-delay, 0ms);
    }
    .lekha-original-template .active .wbw-rise .w[data-imp='true'].in,
    .lekha-original-template .active .wbw-slide .w[data-imp='true'].in {
      animation-duration: 440ms;
    }
    .lekha-original-template .lekha-applied-advanced-template.t22-block,
    .lekha-original-template .lekha-applied-advanced-template.t28-block,
    .lekha-original-template .lekha-applied-advanced-template.t22-block .wave-txt,
    .lekha-original-template .lekha-applied-advanced-template.t28-block .grain-txt,
    .lekha-original-template .lekha-applied-advanced-template.t28-block .slow-fade,
    .lekha-original-template .lekha-applied-advanced-template.t22-block .w.in:not([data-imp='true']),
    .lekha-original-template .lekha-applied-advanced-template.t28-block .w.in:not([data-imp='true']) {
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
    }
    .lekha-original-template .lekha-applied-advanced-template.active .karaoke-base {
      color: var(--gold) !important;
      -webkit-text-fill-color: var(--gold) !important;
      opacity: 1 !important;
    }
    .lekha-original-template .imp-gold {
      color: var(--gold) !important;
      -webkit-text-fill-color: var(--gold) !important;
    }
    .lekha-original-template .imp-rose {
      color: var(--rose) !important;
      -webkit-text-fill-color: var(--rose) !important;
    }
    .lekha-original-template .imp-cyan {
      color: var(--cyan) !important;
      -webkit-text-fill-color: var(--cyan) !important;
    }
    .lekha-original-template .imp-purple {
      color: var(--purple) !important;
      -webkit-text-fill-color: var(--purple) !important;
    }
    .lekha-original-template .imp-green {
      color: var(--green) !important;
      -webkit-text-fill-color: var(--green) !important;
    }
    .lekha-original-template.t12-stage .imp-purple {
      color: var(--rose) !important;
      -webkit-text-fill-color: var(--rose) !important;
    }
    .lekha-original-template.t18-stage .imp-purple {
      color: var(--gold) !important;
      -webkit-text-fill-color: var(--gold) !important;
    }
    .lekha-original-template.t24-stage .imp-purple {
      color: #f97316 !important;
      -webkit-text-fill-color: #f97316 !important;
    }
    .lekha-original-template.t32-stage .imp-purple {
      color: var(--cyan) !important;
      -webkit-text-fill-color: var(--cyan) !important;
    }
    @keyframes lekhaTemplateWbwIn {
      to {
        opacity: 1;
        transform: none;
        clip-path: inset(0 0 0 0);
      }
    }
    @keyframes lekhaSidebarExportWordIn {
      from {
        opacity: var(--sidebar-export-initial-opacity, 0);
        transform: var(--sidebar-export-initial-transform, translateY(22px));
        clip-path: var(--sidebar-export-initial-clip, inset(0 0 0 0));
      }
      to {
        opacity: 1;
        transform: none;
        clip-path: inset(0 0 0 0);
      }
    }
    @keyframes lekhaSidebarExportStickyIn {
      from { opacity: 0.14; }
      to { opacity: 1; }
    }
  `;

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: findChromeExecutable(),
    args: ['--no-sandbox', '--disable-gpu'],
    defaultViewport: {
      width: payload.video_width,
      height: payload.video_height,
      deviceScaleFactor: 1,
    },
  });

  try {
    const page = await browser.newPage();
    await page.setContent(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Abril+Fatface&family=Archivo+Black&family=Bangers&family=Bebas+Neue&family=Bitter:wght@400;700&family=Bodoni+Moda:opsz,wght@6..96,400;700&family=Bungee&family=Caveat:wght@400;700&family=Cinzel:wght@400;700;900&family=Cormorant+Garamond:ital,wght@0,300;0,600;0,700;1,300;1,600&family=Crimson+Text:ital,wght@0,400;0,600;1,400;1,600&family=Darker+Grotesque:wght@400;700;900&family=Dela+Gothic+One&family=DM+Serif+Display:ital@0;1&family=Exo+2:wght@400;700;900&family=IBM+Plex+Mono:wght@400;700&family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;700;800;900&family=Josefin+Sans:wght@300;400;700&family=Libre+Baskerville:wght@400;700&family=Lora:ital,wght@0,400;0,700;1,400;1,700&family=Montserrat:wght@400;500;700;800;900&family=Noto+Sans:wght@400;600;700;800;900&family=Oswald:wght@300;400;600;700&family=Overpass+Mono:wght@400;700&family=Permanent+Marker&family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&family=Questrial&family=Righteous&family=Rubik:wght@400;700;900&family=Silkscreen:wght@400;700&family=Special+Elite&family=Space+Mono:wght@400;700&family=Spectral:ital,wght@0,400;0,600;1,400;1,600&family=Staatliches&family=Syne:wght@400;600;700;800&family=Teko:wght@400;600;700&family=Unbounded:wght@300;700;900&display=swap" rel="stylesheet">
          <style>${runtimeCss}</style>
        </head>
        <body>
          <div id="overlay-root"></div>
          <script>window.__exportCanvasScale = ${JSON.stringify(exportCssScale)};</script>
          <script>window.__exportTemplateFontTargetPx = ${JSON.stringify(exportTemplateFontTargetPx)};</script>
          <script>${buildRuntimeScript()}</script>
        </body>
      </html>
    `, { waitUntil: 'networkidle0' });

    await page.addStyleTag({ content: captionCss });
    await page.addStyleTag({ content: advancedCaptionCss });
    await page.addStyleTag({ content: originalTemplateCss });
    await page.evaluate(() => document.fonts.ready);

    const segments = [];
    const points = new Set([0, Number(payload.duration || 0)]);
    const templateId = String(payload.style?.template_id || '').trim();
    const sidebarTemplateId = String(payload.style?.template_20_id || '').trim();
    const templateUsesPreviewTiming = isAdvancedTemplateId(templateId);
    const templateUsesSidebarTiming = Boolean(sidebarTemplateId);
    const defaultTemplateSampleFps = Math.min(24, Math.max(12, Number(payload.style?.fps || 30)));
    const nonTextCaptions = (payload.captions || []).filter((caption) => !caption?.is_text_element);
    const animatedCaptions = templateUsesPreviewTiming
      ? nonTextCaptions.map((caption, fallbackIndex) => {
          const start = Number(caption.start_time ?? 0);
          const end = Number(caption.end_time ?? start);
          const captionDuration = Math.max(end - start, 0);
          const templateIndex = Number.isFinite(Number(caption.__templateIndex))
            ? Number(caption.__templateIndex)
            : fallbackIndex;
          const blockType = getTemplateBlockType(templateId, templateIndex);
          const splitWords = String(caption.text || '').split(/\s+/).filter(Boolean);
          const wordCount = Math.max(splitWords.length, 1);
          const animatedWindow = getAdvancedTemplateAnimationWindow(blockType, captionDuration, wordCount);
          return {
            caption,
            start,
            end,
            wordCount,
            blockType,
            animatedWindow,
          };
        })
      : [];
    const totalAnimatedSeconds = animatedCaptions.reduce((sum, item) => sum + item.animatedWindow, 0);
    const adaptiveTemplateSampleFps = templateUsesPreviewTiming
      ? Math.max(
          15,
          Math.min(
            defaultTemplateSampleFps,
            totalAnimatedSeconds > 0 ? Math.floor(1200 / totalAnimatedSeconds) : defaultTemplateSampleFps,
          ),
        )
      : defaultTemplateSampleFps;

    for (const caption of payload.captions || []) {
      const start = Number(caption.start_time ?? 0);
      const end = Number(caption.end_time ?? start);
      points.add(start);
      points.add(end);
      if (templateUsesPreviewTiming) {
        if (caption?.is_text_element) continue;
        const fallbackIndex = nonTextCaptions.findIndex((item) => item?.id === caption?.id);
        const templateIndex = Number.isFinite(Number(caption.__templateIndex))
          ? Number(caption.__templateIndex)
          : Math.max(0, fallbackIndex);
        const blockType = getTemplateBlockType(templateId, templateIndex);
        const splitWords = String(caption.text || '').split(/\s+/).filter(Boolean);
        const wordCount = Math.max(splitWords.length, 1);
        if (blockType.startsWith('wbw')) {
          const segmentDuration = Math.max(end - start, 0) / wordCount;
          for (let index = 1; index < wordCount; index += 1) {
            points.add(start + (segmentDuration * index));
          }
        }
        const animationWindow = getAdvancedTemplateAnimationWindow(blockType, Math.max(end - start, 0), wordCount);
        const animationEnd = Math.min(end, start + animationWindow);
        for (
          let sample = start + (1 / adaptiveTemplateSampleFps);
          sample < animationEnd;
          sample += (1 / adaptiveTemplateSampleFps)
        ) {
            points.add(sample);
        }
      } else if (templateUsesSidebarTiming) {
        if (caption?.is_text_element) continue;
        const sidebarSampleFps = Math.min(12, defaultTemplateSampleFps);
        const markup = String(
          caption?.template_markup
          || caption?.applied_template_style?.template_markup
          || payload.style?.template_markup
          || '',
        );
        const blockDurations = Array.from(markup.matchAll(/data-dur="(\d+)"/gi), (match) => Number(match[1]))
          .filter((value) => Number.isFinite(value) && value > 0);
        const fallbackDurationMs = payload.style?.template_source === 'lekha-49' ? 3200 : 2800;
        const durationsMs = blockDurations.length ? blockDurations : [fallbackDurationMs];
        const wordCount = Math.max(1, String(caption.text || '').trim().split(/\s+/).filter(Boolean).length);
        const wordStaggerSeconds = payload.style?.template_source === 'lekha-49' ? 0.16 : 0.12;
        let phaseStart = start;
        let phaseIndex = 0;
        while (phaseStart < end - 0.001) {
          const phaseDurationSeconds = Math.max(0.7, durationsMs[phaseIndex % durationsMs.length] / 1000);
          const phaseEnd = Math.min(end, phaseStart + phaseDurationSeconds);
          const animationWindowSeconds = Math.min(
            phaseEnd - phaseStart,
            0.55 + (wordCount * wordStaggerSeconds) + 0.55,
          );
          const animationEnd = Math.min(phaseEnd, phaseStart + Math.max(0.7, animationWindowSeconds));
          points.add(phaseStart);
          points.add(phaseEnd);
          for (
            let sample = phaseStart + (1 / sidebarSampleFps);
            sample < animationEnd;
            sample += (1 / sidebarSampleFps)
          ) {
            points.add(sample);
          }
          phaseStart = phaseEnd;
          phaseIndex += 1;
        }
      } else {
        for (const word of caption.words || []) {
          const wordStart = Number(word?.start ?? start);
          const wordEnd = Number(word?.end ?? wordStart);
          if (Number.isFinite(wordStart)) points.add(wordStart);
          if (Number.isFinite(wordEnd)) points.add(wordEnd);
        }
      }
    }

    const sorted = [...points]
      .filter((value) => Number.isFinite(value) && value >= 0)
      .sort((left, right) => left - right);

    for (let index = 0; index < sorted.length - 1; index += 1) {
      const start = sorted[index];
      const end = sorted[index + 1];
      const duration = end - start;
      if (duration <= 0.01) continue;
      segments.push({ start, end, duration });
    }

    if (segments.length === 0) {
      segments.push({ start: 0, end: Math.max(Number(payload.duration || 1), 1), duration: Math.max(Number(payload.duration || 1), 1) });
    }

    console.log(`[Template DOM] segments=${segments.length} template_timing=${templateUsesPreviewTiming} sidebar_timing=${templateUsesSidebarTiming} sample_fps=${adaptiveTemplateSampleFps}`);

    const frameLines = [];
    const frameFiles = [];
    const lastIndex = segments.length - 1;
    const blankFramePath = path.join(outputDir, 'frame-blank.png');

    await page.evaluate(() => {
      const root = document.getElementById('overlay-root');
      if (root) root.innerHTML = '';
    });
    await page.screenshot({
      path: blankFramePath,
      omitBackground: true,
    });

    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index];
      const midpoint = segment.start + (segment.duration / 2);
      const framePath = path.join(outputDir, `frame-${String(index).padStart(5, '0')}.png`);
      const hasActiveCaptions = (payload.captions || []).some((caption) => {
        const start = Number(caption.start_time ?? 0);
        const end = Number(caption.end_time ?? start);
        return midpoint >= start && midpoint <= end;
      });

      let renderedFramePath = blankFramePath;
      if (hasActiveCaptions) {
        await page.evaluate(async (currentPayload, currentTime) => {
          window.__renderPayload(currentPayload, currentTime);
          if (window.__activateTemplateAnimations) {
            await window.__activateTemplateAnimations();
          } else {
            await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          }

          const activeStarts = (currentPayload.captions || [])
            .filter((caption) => {
              const start = Number(caption.start_time ?? 0);
              const end = Number(caption.end_time ?? start);
              return !caption.is_text_element && currentTime >= start && currentTime <= end;
            })
            .map((caption) => Number(caption.start_time ?? currentTime));
          const captionElapsedMs = Math.max(0, (currentTime - Math.min(currentTime, ...activeStarts)) * 1000);
          document.getAnimations({ subtree: true }).forEach((animation) => {
            try {
              const timing = animation.effect?.getTiming?.() || {};
              const delayMs = Number(timing.delay || 0);
              const seekMs = Math.max(0, captionElapsedMs - delayMs);
              animation.pause();
              animation.currentTime = seekMs;
            } catch {
              // Some browser-managed animations cannot be seeked; leave them at their rendered state.
            }
          });
          document.querySelectorAll('.lekha-applied-advanced-template.active').forEach((block) => {
            const wbw = block.querySelector('.wbw-rise, .wbw-slide');
            if (!wbw) return;
            const isRise = wbw.classList.contains('wbw-rise');
            wbw.querySelectorAll('.w').forEach((word) => {
              const index = Number(word.dataset.i || 0);
              const delayMs = index * 65;
              const durationMs = 320;
              const raw = (captionElapsedMs - delayMs) / durationMs;
              const progress = Math.max(0, Math.min(1, raw));
              const eased = 1 - Math.pow(1 - progress, 3);
              word.style.animation = 'none';
              word.style.transition = 'none';
              word.style.opacity = String(eased);
              if (progress >= 1) {
                word.style.transform = 'none';
              } else if (isRise) {
                word.style.transform = `translateY(${20 * (1 - eased)}px)`;
              } else {
                word.style.transform = `translateX(${-16 * (1 - eased)}px)`;
              }
            });
          });
          await new Promise((resolve) => requestAnimationFrame(resolve));
        }, payload, midpoint);

        await page.screenshot({
          path: framePath,
          omitBackground: true,
        });
        renderedFramePath = framePath;
      }

      frameFiles.push(renderedFramePath);
      frameLines.push(`file '${toForwardSlash(renderedFramePath).replace(/'/g, "'\\''")}'`);
      if (index < lastIndex) {
        frameLines.push(`duration ${segment.duration.toFixed(6)}`);
      }
    }

    const lastFramePath = frameFiles[lastIndex] || blankFramePath;
    frameLines.push(`file '${toForwardSlash(lastFramePath).replace(/'/g, "'\\''")}'`);

    await fs.writeFile(path.join(outputDir, 'frames.txt'), `${frameLines.join('\n')}\n`, 'utf8');
    await fs.writeFile(path.join(outputDir, 'segments.json'), JSON.stringify(segments, null, 2), 'utf8');
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
