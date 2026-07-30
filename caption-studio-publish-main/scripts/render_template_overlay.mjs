import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';
import {
  ADVANCED_IMP_ENTRANCES,
  ADVANCED_TEMPLATE_EMPHASIS_COLORS,
  ADVANCED_TEMPLATE_RUNTIME_CSS,
  ADVANCED_TEMPLATE_TIMING,
  LEGACY_TEMPLATE_TIMING,
  ORIGINAL_TEMPLATE_BLOCK_TYPES,
  RECREATED_ADVANCED_TEMPLATE_IDS,
  LC_TEMPLATE_TIMING,
  fitLcMotionScheduleToCaption,
  getAdvancedAnimationWindowMs,
  getLcMotionSchedule,
  getOriginalTemplateBlockType,
} from '../src/components/dashboard/templateMotionConfig.js';
import {
  buildAdvancedTemplateBlockMarkupMap,
} from '../src/components/dashboard/advancedTemplateSourceUtils.js';
import {
  buildEmotionalCaptionPlan,
} from '../src/components/dashboard/emotionalTemplateUtils.js';
import {
  SOURCE_BASIC_TEMPLATE_IDS,
  isSourceBasicTemplateId,
  findAppliedBasicTemplateMarkup,
  APPLIED_BASIC_TEMPLATE_HOST_OVERRIDES,
  APPLIED_BASIC_TEMPLATE_FONT_SCALE,
  normalizeAppliedBasicTemplateFontSize,
} from '../src/components/dashboard/basicTemplateInline.js';
import {
  detectScript,
  resolveScriptFontFamily,
} from '../src/components/dashboard/scriptFontResolver.js';
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
const TEMPLATE_CANVAS_FONT_SCALE = 0.88;
const LINE_ANIMATION_DEFS = {
  rise: ['source-word-rise', 400, 'ease-out', 'both'],
  pan: ['source-word-pan', 500, 'ease-in-out', 'both'],
  fade: ['source-word-fade', 500, 'ease-in', 'both'],
  pop: ['source-word-pop', 300, 'ease-out', 'both'],
  wipe: ['source-word-wipe', 400, 'ease-out', 'both'],
  blur: ['source-word-blur', 500, 'ease-in-out', 'both'],
  succession: ['source-word-succession', 400, 'ease-out', 'both'],
  breathe: ['source-word-breathe', 1500, 'ease-in-out', 'infinite'],
  baseline: ['source-word-baseline', 400, 'ease-out', 'both'],
  drift: ['source-word-drift', 600, 'ease-in-out', 'both'],
  tectonic: ['source-word-tectonic', 500, 'ease-out', 'both'],
  tumble: ['source-word-tumble', 600, 'ease-in-out', 'both'],
  zoom_in: ['caption-zoom-in', 400, 'ease-out', 'both'],
  zoom_out: ['caption-zoom-out', 400, 'ease-out', 'both'],
  fade_in: ['caption-fade-in', 400, 'ease-out', 'both'],
  slide_up: ['caption-slide-up', 400, 'ease-out', 'both'],
  slide_down: ['caption-slide-down', 400, 'ease-out', 'both'],
  slide_left: ['caption-slide-left', 400, 'ease-out', 'both'],
  slide_right: ['caption-slide-right', 400, 'ease-out', 'both'],
  fadeInUp: ['caption-fade-in-up', 500, 'ease-out', 'both'],
  fadeInDown: ['caption-fade-in-down', 500, 'ease-out', 'both'],
  slideInRight: ['caption-slide-in-right', 500, 'ease-out', 'both'],
  flipInX: ['caption-flip-in-x', 600, 'ease-out', 'both'],
  flipInY: ['caption-flip-in-y', 600, 'ease-out', 'both'],
  blurIn: ['caption-blur-in', 500, 'ease-out', 'both'],
  zoomInFade: ['caption-zoom-in-fade', 500, 'ease-out', 'both'],
  bounceInUp: ['caption-bounce-in-up', 600, 'ease-out', 'both'],
  skewLeft: ['caption-skew-left', 400, 'ease-out', 'both'],
  missile: ['caption-missile', 500, 'cubic-bezier(0.22,1,0.36,1)', 'both'],
  shockwave: ['caption-shockwave', 500, 'ease-out', 'both'],
  typewriter: ['caption-typewriter', 600, 'steps(20,end)', 'both'],
  slamDown: ['caption-slam-down', 500, 'cubic-bezier(0.22,1,0.36,1)', 'both'],
  fireCharge: ['caption-fire-charge', 500, 'ease-out', 'both'],
  stampede: ['caption-stampede', 500, 'cubic-bezier(0.22,1,0.36,1)', 'both'],
  recoil: ['caption-recoil', 400, 'ease-out', 'both'],
  irisOpen: ['caption-iris-open', 600, 'ease-out', 'both'],
  parallaxRise: ['caption-parallax-rise', 700, 'ease-out', 'both'],
  goldenRatio: ['caption-golden-ratio', 600, 'ease-out', 'both'],
  curtainSplit: ['caption-curtain-split', 500, 'ease-out', 'both'],
  prestige: ['caption-prestige', 1000, 'ease-out', 'both'],
  fadeThroughBlack: ['caption-fade-through-black', 800, 'ease-in-out', 'both'],
  depthPull: ['caption-depth-pull', 600, 'ease-out', 'both'],
  slowBurn: ['caption-slow-burn', 1500, 'ease-in', 'both'],
  diagonalWipe: ['caption-diagonal-wipe', 500, 'ease-out', 'both'],
  confettiPop: ['caption-confetti-pop', 500, 'ease-out', 'both'],
  stickerSlap: ['caption-sticker-slap', 400, 'cubic-bezier(0.34,1.56,0.64,1)', 'both'],
  wobbleEntry: ['caption-wobble-entry', 600, 'ease-out', 'both'],
  balloonFloat: ['caption-balloon-float', 600, 'ease-out', 'both'],
  colorSplash: ['caption-color-splash', 500, 'ease-out', 'both'],
};
// Match the authored 20-template preview engine exactly.
const SIDEBAR_TEMPLATE_WORD_STAGGER_SECONDS = LEGACY_TEMPLATE_TIMING.wordStaggerMs / 1000;
const SIDEBAR_TEMPLATE_POSITION_STAGGER_SECONDS = LEGACY_TEMPLATE_TIMING.positionedWordStaggerMs / 1000;

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

// Node-side twin of the in-page captionHasCptWords() (see buildRuntimeScript):
// frame segmentation runs out here, so it needs its own copy to know that a
// displaced-word caption changes over time.
function captionHasCptWordStyles(caption) {
  return Object.values(caption?.word_styles || {}).some((wordStyle = {}) => (
    Math.abs(Number(wordStyle?.abs_x_pct) || 0) > 0.01
    || Math.abs(Number(wordStyle?.abs_y_pct) || 0) > 0.01
    || Math.abs(Number(wordStyle?.x_pct) || 0) > 0.01
    || Math.abs(Number(wordStyle?.y_pct) || 0) > 0.01
    || Math.abs(Number(wordStyle?.x) || 0) > 0.01
    || Math.abs(Number(wordStyle?.y) || 0) > 0.01
  ));
}

function isAdvancedTemplateId(templateId) {
  return /^t\d{2}$/.test(String(templateId || ''));
}

function scaleTemplateFontSize(fontSize) {
  return Math.max(12, Math.round((fontSize || 18) * TEMPLATE_CANVAS_FONT_SCALE));
}

function estimateAdvancedPreviewTemplateBox(payload, previewWidth = 0) {
  if (!isAdvancedTemplateId(payload?.style?.template_id)) {
    return { width: 0, height: 0 };
  }

  const fontSize = Math.max(16, Number(payload?.style?.font_size || 23));
  const lineSpacing = Math.max(1, Number(payload?.style?.line_spacing || 1.25));
  const maxPreviewWidth = Math.max(180, Number(previewWidth || 0) || 314);
  const firstCaption = (payload?.captions || []).find((caption) => caption && !caption.is_text_element);
  const words = String(firstCaption?.text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const lineCount = words.length >= 3 ? 2 : 1;
  const midpoint = Math.ceil(words.length / lineCount);
  const lines = lineCount === 1
    ? [words.join(' ')]
    : [words.slice(0, midpoint).join(' '), words.slice(midpoint).join(' ')];
  const maxLineLength = Math.max(
    6,
    ...lines.map((line) => Array.from(line || '').length),
  );

  return {
    width: Math.min(maxPreviewWidth * 0.82, Math.max(fontSize * 4.8, maxLineLength * fontSize * 0.72)),
    height: Math.max(fontSize * lineSpacing, fontSize * lineSpacing * lineCount),
  };
}

function getTemplateBlockType(templateId, blockIndex = 0) {
  return getOriginalTemplateBlockType(templateId, blockIndex);
}

function getAdvancedTemplateAnimationWindow(blockType, captionDuration, wordCount = 1) {
  const duration = Math.max(Number(captionDuration) || 0, 0);
  return Math.min(duration, getAdvancedAnimationWindowMs(blockType, wordCount) / 1000);
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

function buildRuntimeScript(advancedTemplateBlockMarkup = {}) {
  return `
    const TEMPLATE_CANVAS_FONT_SCALE = ${TEMPLATE_CANVAS_FONT_SCALE};
    const scaleExportPx = (value) =>
      Math.max(1, Math.round((Number(value) || 0) * (window.__exportCanvasScale || 1)));
    const scaleTemplateFontSize = (fontSize) =>
      Math.max(12, scaleExportPx((fontSize || 18) * TEMPLATE_CANVAS_FONT_SCALE));
    const APPLIED_BASIC_EXPORT_FONT_SCALE = ${JSON.stringify(APPLIED_BASIC_TEMPLATE_FONT_SCALE)};
    const LINE_ANIMATION_DEFS = ${JSON.stringify(LINE_ANIMATION_DEFS)};

    const getLineAnimationStyle = (animationType, speed = 1) => {
      const def = LINE_ANIMATION_DEFS[String(animationType || '')];
      if (!def) return 'none';
      const [name, durationMs, timing, fill] = def;
      const safeSpeed = Math.max(0.1, Number(speed) || 1);
      const duration = Math.max(1, Math.round(durationMs / safeSpeed));
      return \`\${name} \${duration}ms \${timing} \${fill}\`;
    };

    const normalizeComputedFontFamily = (value = '') => String(value || '')
      .split(',')[0]
      .replace(/["']/g, '')
      .trim();

    const applySourceTemplateScriptFonts = (root, script = 'latin') => {
      if (!root || !script || script === 'latin') return;
      const scriptConfig = window.__exportScriptFontMaps?.[script] || {};
      const familyMap = scriptConfig.families || {};
      const fallbackFamily = scriptConfig.fallback || '';
      if (!fallbackFamily) return;

      [root, ...root.querySelectorAll('*')].forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        const baseFamily = normalizeComputedFontFamily(getComputedStyle(node).fontFamily);
        const resolvedFamily = familyMap[baseFamily] || fallbackFamily;
        if (!resolvedFamily || resolvedFamily === baseFamily) return;
        node.style.setProperty('font-family', \`'\${resolvedFamily}', sans-serif\`, 'important');
        node.dataset.exportScriptFont = resolvedFamily;
      });
    };

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

    const resolveAdvancedTemplatePhaseIndex = (caption, fallbackIndex = 0) => {
      const storedPhaseIndex = Number(caption?.template_phase_index);
      if (Number.isFinite(storedPhaseIndex)) return storedPhaseIndex;
      const templateIndex = Number(caption?.__templateIndex);
      if (Number.isFinite(templateIndex)) return templateIndex;
      const legacyTemplateIndex = Number(caption?.__template_index);
      if (Number.isFinite(legacyTemplateIndex)) return legacyTemplateIndex;
      return Math.max(0, Number(fallbackIndex) || 0);
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

    const resolveTemplatePreviewLines = (text = '', preferredLines = [], maxLines = 2) => {
      const normalizedPreferred = Array.isArray(preferredLines)
        ? preferredLines.map((line) => String(line || '').replace(/\\s+/g, ' ').trim()).filter(Boolean)
        : [];
      if (normalizedPreferred.length > 0) {
        const requestedWords = normalizedPreferred.flatMap((line) => line.split(/\\s+/).filter(Boolean));
        const actualWords = String(text).trim().split(/\\s+/).filter(Boolean);
        const sameWords = requestedWords.length === actualWords.length
          && requestedWords.every((word, index) => word === actualWords[index]);
        if (sameWords) return normalizedPreferred;
      }
      return splitTemplateLines(text, maxLines);
    };

    const splitBattleCryTokens = (tokens = []) => {
      if (!tokens.length) return [];
      if (tokens.length <= 3) return [tokens.map((token, wordIndex) => ({ ...token, wordIndex }))];
      const firstLineCount = Math.max(2, Math.min(tokens.length - 1, Math.ceil(tokens.length * 0.66)));
      return [
        tokens.slice(0, firstLineCount).map((token, wordIndex) => ({ ...token, wordIndex })),
        tokens.slice(firstLineCount).map((token, localIndex) => ({
          ...token,
          wordIndex: firstLineCount + localIndex,
        })),
      ].filter((line) => line.length);
    };

    const splitCompactIndexedLines = (tokens = [], preferredLines = []) => {
      const normalizedPreferred = Array.isArray(preferredLines)
        ? preferredLines.map((line) => String(line || '').replace(/\\s+/g, ' ').trim()).filter(Boolean)
        : [];
      if (normalizedPreferred.length > 1) {
        const preferredWords = normalizedPreferred.flatMap((line) => line.split(/\\s+/).filter(Boolean));
        const tokenWords = tokens.map((token) => token.word);
        const sameWords = preferredWords.length === tokenWords.length
          && preferredWords.every((word, index) => word === tokenWords[index]);
        if (sameWords) {
          let cursor = 0;
          return normalizedPreferred.map((lineText) => {
            const count = lineText.split(/\\s+/).filter(Boolean).length;
            const line = tokens.slice(cursor, cursor + count).map((token, localIndex) => ({
              ...token,
              wordIndex: cursor + localIndex,
            }));
            cursor += count;
            return line;
          }).filter((line) => line.length);
        }
      }

      if (!tokens.length) return [];
      if (tokens.length <= 3) return [tokens.map((token, wordIndex) => ({ ...token, wordIndex }))];
      const firstLineCount = Math.max(2, Math.min(tokens.length - 1, Math.ceil(tokens.length * 0.66)));
      return [
        tokens.slice(0, firstLineCount).map((token, wordIndex) => ({ ...token, wordIndex })),
        tokens.slice(firstLineCount).map((token, localIndex) => ({
          ...token,
          wordIndex: firstLineCount + localIndex,
        })),
      ].filter((line) => line.length);
    };

    const shouldCompactTemplateLine = (text = '') => {
      const value = String(text || '').trim();
      if (!value) return false;
      return value.length > 22
        || usesComplexTemplateScript(value);
    };

    const usesComplexTemplateScript = (text = '') => (
      /[\\p{Script=Arabic}\\p{Script=Bengali}\\p{Script=Devanagari}\\p{Script=Gujarati}\\p{Script=Gurmukhi}\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Kannada}\\p{Script=Katakana}\\p{Script=Malayalam}\\p{Script=Oriya}\\p{Script=Tamil}\\p{Script=Telugu}\\p{Script=Thai}]/u.test(String(text || ''))
    );

    const normalizeImpWordIndices = (impWordIndex = -1, impWordIndices = []) => {
      const values = Array.isArray(impWordIndices) ? impWordIndices : [];
      const normalized = values
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value >= 0);
      const single = Number(impWordIndex);
      if (Number.isFinite(single) && single >= 0) normalized.push(single);
      return [...new Set(normalized.map((value) => Math.trunc(value)))];
    };

    const normalizeTemplateWord = (word = '') => String(word || '')
      .normalize('NFKC')
      .toLocaleLowerCase()
      .replace(/^[^\\p{L}\\p{M}\\p{N}]+|[^\\p{L}\\p{M}\\p{N}]+$/gu, '');

    const getTargetPhraseImpWordIndices = (wordsOrTokens = []) => {
      const normalizedWords = wordsOrTokens.map((item) => normalizeTemplateWord(item?.word ?? item));
      for (let index = 0; index < normalizedWords.length - 1; index += 1) {
        if (normalizedWords[index] === '\\u0926\\u0938' && normalizedWords[index + 1] === '\\u0932\\u0915') {
          return [index, index + 1];
        }
      }
      return [];
    };

    const resolveImpWordIndicesForWords = (wordsOrTokens = [], impWordIndex = -1, impWordIndices = []) => {
      const phraseIndices = getTargetPhraseImpWordIndices(wordsOrTokens);
      if (phraseIndices.length) return phraseIndices;
      return normalizeImpWordIndices(impWordIndex, impWordIndices);
    };

    const heroMarkup = (text, className = '') => {
      const { top, hero, bottom, full } = splitCaptionForTemplate(text);
      if (!full) return '';
      if (!className || !hero) return escapeHtml(full);
      return \`\${top ? \`\${escapeHtml(top)} \` : ''}<span class="\${className}">\${escapeHtml(hero)}</span>\${bottom ? \` \${escapeHtml(bottom)}\` : ''}\`;
    };

    const stillFramesMarkup = (text) =>
      \`<span class="still-frames-line">\${heroMarkup(text, 'imp-rose still-frames-highlight')}</span>\`;

    let activeTemplateImpWordIndices = [];

    const wbwMarkup = (text, variant = 'wbw-rise', impClass = 'imp-bold', options = {}) => {
      const { hero, full } = splitCaptionForTemplate(text);
      if (!full) return '';
      const tokens = full.split(/\\s+/).filter(Boolean).map((word) => ({ word }));
      const heroIndex = Math.max(0, tokens.findIndex((token) => token.word === hero));
      const requestedImpWordIndices = options.impWordIndices?.length
        ? options.impWordIndices
        : activeTemplateImpWordIndices;
      const resolvedImpWordIndices = options.impWordIndices?.length
        ? resolveImpWordIndicesForWords(tokens, -1, requestedImpWordIndices)
        : requestedImpWordIndices.length
          ? resolveImpWordIndicesForWords(tokens, -1, requestedImpWordIndices)
        : resolveImpWordIndicesForWords(tokens);
      const emphasisIndices = new Set(resolvedImpWordIndices.length ? resolvedImpWordIndices : [heroIndex]);
      const lineMotion = String(options.motion || '');
      const lineClassName = String(options.lineClassName || '');
      const lineMotionAttr = lineMotion ? \` data-line-motion="\${escapeHtml(lineMotion)}"\` : '';
      const outerClass = \`\${variant} lekha-template-fit\${lineClassName ? \` \${lineClassName}\` : ''}\`;
      const indexedLines = options.compactLines
        ? splitCompactIndexedLines(tokens, options.lineTexts)
        : [];
      if (indexedLines.length > 1) {
        const markup = indexedLines.map((line) => {
          const lineWords = line.map((token, localIndex) => {
            const style = \`--wbw-delay:\${token.wordIndex * 65}ms\`;
            const isImp = emphasisIndices.has(token.wordIndex);
            return \`\${localIndex > 0 ? ' ' : ''}<span class="w\${isImp ? \` \${impClass}\` : ''} in" data-i="\${token.wordIndex}"\${lineMotionAttr}\${isImp ? \` data-imp="true" data-imp-cls="\${impClass}"\` : ''} style="\${style}">\${escapeHtml(token.word)}</span>\`;
          }).join('');
          return \`<span class="lekha-template-preview-line">\${lineWords}</span>\`;
        }).join('');
        return \`<span class="\${outerClass} lekha-template-preview-lines" data-type="\${variant}"\${lineMotionAttr}>\${markup}</span>\`;
      }
      const words = tokens.map((token, index) => {
        const style = \`--wbw-delay:\${index * 65}ms\`;
        const isImp = emphasisIndices.has(index);
        return \`\${index > 0 ? ' ' : ''}<span class="w\${isImp ? \` \${impClass}\` : ''} in" data-i="\${index}"\${lineMotionAttr}\${isImp ? \` data-imp="true" data-imp-cls="\${impClass}"\` : ''} style="\${style}">\${escapeHtml(token.word)}</span>\`;
      }).join('');
      return \`<span class="\${outerClass}" data-type="\${variant}"\${lineMotionAttr}>\${words}</span>\`;
    };

    const battleCryWbwMarkup = (text, variant = 'wbw-rise', impClass = 'imp-rose') => {
      const { hero, full } = splitCaptionForTemplate(text);
      if (!full) return '';
      const tokens = full.split(/\\s+/).filter(Boolean).map((word) => ({ word }));
      const heroIndex = Math.max(0, tokens.findIndex((token) => token.word === hero));
      const lines = splitBattleCryTokens(tokens);
      const markup = lines.map((line, lineIndex) => {
        const lineMotion = lineIndex % 2 === 0 ? 'wbw-slide' : 'wbw-rise';
        const battleMotion = lineIndex % 2 === 0 ? 'sweep-left' : 'lift-up';
        const lineDelay = lineIndex * 170;
        const lineWords = line.map((token, localIndex) => {
          const isImp = token.wordIndex === heroIndex;
          const style = \`--wbw-delay:\${(localIndex * 58) + lineDelay}ms\`;
          return \`\${localIndex > 0 ? ' ' : ''}<span class="w\${isImp ? \` \${impClass} is-emphasis\` : ''} in" data-i="\${token.wordIndex}" data-line-motion="\${lineMotion}" data-line-delay="\${lineDelay}" data-battle-motion="\${battleMotion}" data-battle-index="\${localIndex}"\${isImp ? \` data-imp="true" data-imp-cls="\${impClass}"\` : ''} style="\${style}">\${escapeHtml(token.word)}</span>\`;
        }).join('');
        return \`<span class="lekha-template-preview-line battle-line-\${lineIndex + 1} \${lineMotion} battle-\${battleMotion}" data-battle-line="\${lineIndex}" data-line-motion="\${lineMotion}" data-battle-motion="\${battleMotion}">\${lineWords}</span>\`;
      }).join('');
      return \`<span class="\${variant} lekha-template-fit lekha-template-preview-lines battle-lines" data-type="\${variant}">\${markup}</span>\`;
    };

    const karaokeMarkup = (text) => {
      const words = String(text || '').trim().split(/\\s+/).filter(Boolean);
      return \`<span class="kf-line lekha-template-fit">\${words.map((word) => \`
        <span class="kf-word">
          <span class="kf-base">\${escapeHtml(word)}</span>
          <span class="kf-fill">\${escapeHtml(word)}</span>
        </span>
      \`).join(' ')}</span>\`;
    };

    const advancedTemplateBlockMarkup = ${JSON.stringify(advancedTemplateBlockMarkup)};

    const cleanAdvancedSourceElement = (element) => {
      if (!element) return;
      [element, ...element.querySelectorAll('*')].forEach((node) => {
        Array.from(node.attributes || []).forEach((attribute) => {
          if (/^bis_/i.test(attribute.name) || /^__processed_/i.test(attribute.name)) {
            node.removeAttribute(attribute.name);
          }
        });
        node.className = String(node.className || '')
          .split(/\\s+/)
          .filter((className) => className && !['active', 'visible', 'anim', 'on', 'in', 'fx'].includes(className))
          .join(' ');
        if (node.style) {
          [
            'animation', 'clip-path', 'filter', 'opacity', 'transform', 'transform-origin',
            'transition', 'visibility', 'z-index',
          ].forEach((property) => node.style.removeProperty(property));
        }
      });
    };

    const mapAdvancedSourceClass = (sourceClasses, index, total, fallback) => {
      if (!sourceClasses.length) return fallback;
      if (total <= 1) return sourceClasses[0] || fallback;
      const sourceIndex = Math.min(
        sourceClasses.length - 1,
        Math.round((index * (sourceClasses.length - 1)) / Math.max(1, total - 1)),
      );
      return sourceClasses[sourceIndex] || fallback;
    };

    const ADVANCED_TEMPLATE_EMPHASIS_COLORS = ${JSON.stringify(ADVANCED_TEMPLATE_EMPHASIS_COLORS)};
    const resolveAdvancedTemplateEmphasisColor = (templateId, emphasisColor = '', blockIndex = -1) => {
      const normalizedId = String(templateId || '').trim();
      if (normalizedId === 't23' && Number(blockIndex) === 3) {
        return '#ffffff';
      }
      if (emphasisColor) {
        return emphasisColor;
      }
      return ADVANCED_TEMPLATE_EMPHASIS_COLORS[normalizedId] || '';
    };

    const replaceAdvancedSourceWbw = (container, words, impWordIndex, emphasisColor, impWordIndices = []) => {
      const doc = container.ownerDocument || document;
      const sourceWords = Array.from(container.querySelectorAll('.w'));
      const sourceClasses = sourceWords.map((word) => String(word.className || 'w'));
      const impPattern = /\\bimp-[\\w-]+\\b/;
      const sourceImpIndex = sourceWords.findIndex((word) => (
        word.dataset.imp === 'true' || impPattern.test(word.className)
      ));
      const impClass = sourceImpIndex >= 0
        ? sourceWords[sourceImpIndex].dataset.impCls
          || sourceClasses[sourceImpIndex].match(impPattern)?.[0]
          || ''
        : '';
      const targetImpIndices = new Set(resolveImpWordIndicesForWords(words, impWordIndex, impWordIndices));
      container.textContent = '';
      container.dataset.text = words.join(' ');
      container.classList.remove('lekha-template-preview-lines');

      const createWordSpan = (word, index, isLastInLine) => {
        const span = doc.createElement('span');
        const mapped = mapAdvancedSourceClass(sourceClasses, index, words.length, 'w')
          .replace(/\\bimp-[\\w-]+\\b/g, '')
          .replace(/\\s+/g, ' ')
          .trim();
        const isImp = targetImpIndices.has(index);
        span.className = (mapped || 'w') + (isImp && impClass ? ' ' + impClass : '') + (isImp ? ' is-emphasis' : '');
        span.dataset.i = String(index);
        if (isImp) {
          span.dataset.imp = 'true';
          span.dataset.impCls = impClass;
          if (emphasisColor) {
            span.style.setProperty('color', emphasisColor, 'important');
            span.style.setProperty('-webkit-text-fill-color', emphasisColor, 'important');
          }
        }
        if (!isLastInLine) {
          span.style.setProperty('margin-right', '0.24em', 'important');
        }
        span.textContent = word;
        return span;
      };

      words.forEach((word, index) => {
        container.appendChild(createWordSpan(word, index, index === words.length - 1));
      });
    };

    const replaceAdvancedSourceKaraoke = (container, words) => {
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
    };

    const collectAdvancedSourceTextNodes = (root) => {
      const textNodes = [];
      const isHiddenTextNode = (node) => {
        let element = node?.parentElement;
        while (element && element !== root.parentElement) {
          const style = String(element.getAttribute?.('style') || '').toLowerCase();
          if (
            element.hidden
            || element.getAttribute?.('aria-hidden') === 'true'
            || /display\\s*:\\s*none/.test(style)
            || /visibility\\s*:\\s*hidden/.test(style)
            || /font-size\\s*:\\s*0(?:\\.0+)?(?:px|rem|em|%)?(?:\\s*(?:;|$))/.test(style)
            || /line-height\\s*:\\s*0(?:\\.0+)?(?:px|rem|em|%)?(?:\\s*(?:;|$))/.test(style)
          ) {
            return true;
          }
          element = element.parentElement;
        }
        return false;
      };
      const visit = (node) => {
        Array.from(node.childNodes || []).forEach((child) => {
          if (child.nodeType === 3) {
            if (/[\\p{L}\\p{N}]/u.test(child.nodeValue || '') && !isHiddenTextNode(child)) textNodes.push(child);
            else if (String(child.nodeValue || '').trim()) child.nodeValue = '';
          } else if (child.nodeType === 1) {
            visit(child);
          }
        });
      };
      visit(root);
      return textNodes;
    };

    const assignAdvancedWordsToSlots = (words, slotCount) => {
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

      assigned.forEach((slot, slotIndex) => {
        if (slot.length) return;
        let donorIndex = -1;
        let donorDistance = Infinity;
        assigned.forEach((candidate, candidateIndex) => {
          if (candidate.length <= 1) return;
          const distance = Math.abs(candidateIndex - slotIndex);
          if (distance < donorDistance) {
            donorDistance = distance;
            donorIndex = candidateIndex;
          }
        });
        if (donorIndex < 0) return;
        const donor = assigned[donorIndex];
        const moved = donorIndex < slotIndex ? donor.pop() : donor.shift();
        if (moved) slot.push(moved);
      });

      return assigned;
    };

    const advancedSourceImpPattern = /\\b(?:imp-[\\w-]+|ns[23]-[\\w-]+)\\b/;

    const getAdvancedSourceImpClass = (block) => {
      const className = Array.from(block.querySelectorAll('*'))
        .map((element) => element.className || '')
        .find((value) => advancedSourceImpPattern.test(String(value)));
      return String(className || '').match(advancedSourceImpPattern)?.[0] || 'imp-gold';
    };

    const findAdvancedSlotImpWrapper = (slot, block) => {
      let element = slot?.parentElement;
      while (element && element !== block) {
        if (advancedSourceImpPattern.test(String(element.className || ''))) return element;
        element = element.parentElement;
      }
      return null;
    };

    const replaceAdvancedTextSlot = (slot, assignedWords, impWordIndex, impClass, emphasisColor, block, impWordIndices = []) => {
      const doc = slot.ownerDocument;
      const source = String(slot.nodeValue || '');
      const leading = /^\\s/.test(source) ? ' ' : '';
      const trailing = /\\s$/.test(source) ? ' ' : '';
      const targetImpIndices = new Set(normalizeImpWordIndices(impWordIndex, impWordIndices));
      const replacementTarget = targetImpIndices.size > 0
        ? findAdvancedSlotImpWrapper(slot, block)
        : null;
      const fragment = doc.createDocumentFragment();
      if (leading) fragment.appendChild(doc.createTextNode(leading));
      assignedWords.forEach(({ word, wordIndex }, localIndex) => {
        if (localIndex > 0) fragment.appendChild(doc.createTextNode(' '));
        if (targetImpIndices.has(wordIndex)) {
          const span = doc.createElement('span');
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
          fragment.appendChild(doc.createTextNode(word));
        }
      });
      if (trailing) fragment.appendChild(doc.createTextNode(trailing));
      if (replacementTarget?.parentNode) {
        replacementTarget.parentNode.replaceChild(fragment, replacementTarget);
      } else {
        slot.parentNode?.replaceChild(fragment, slot);
      }
    };

    const findAdvancedSourceImpSlotIndex = (slots, block) => {
      if (!Array.isArray(slots) || !slots.length || !block) return -1;
      return slots.findIndex((slot) => !!findAdvancedSlotImpWrapper(slot, block));
    };

    const ensureAdvancedSourceImpSlotHasWord = (assigned, impSlotIndex) => {
      if (!Array.isArray(assigned) || impSlotIndex < 0 || impSlotIndex >= assigned.length) return;
      if (assigned[impSlotIndex]?.length) return;

      let donorIndex = -1;
      let donorDistance = Infinity;
      assigned.forEach((slot, slotIndex) => {
        if (!slot.length || slotIndex === impSlotIndex) return;
        const distance = Math.abs(slotIndex - impSlotIndex);
        if (distance < donorDistance) {
          donorIndex = slotIndex;
          donorDistance = distance;
        }
      });
      if (donorIndex < 0) return;

      const donor = assigned[donorIndex];
      const moved = donorIndex < impSlotIndex ? donor.pop() : donor.shift();
      if (moved) assigned[impSlotIndex].push(moved);
    };

    const replaceAdvancedSourceStyledText = (block, words, captionText, impWordIndex = -1, emphasisColor = '', impWordIndices = []) => {
      const slots = collectAdvancedSourceTextNodes(block);
      if (!slots.length) {
        block.textContent = captionText;
        return;
      }
      const targetSlotCount = Math.max(1, Math.min(words.length, slots.length));
      const targetSlots = slots.slice(0, targetSlotCount);
      const assigned = assignAdvancedWordsToSlots(words, targetSlots.length);
      const sourceImpSlotIndex = findAdvancedSourceImpSlotIndex(targetSlots, block);
      ensureAdvancedSourceImpSlotHasWord(assigned, sourceImpSlotIndex);
      const impClass = getAdvancedSourceImpClass(block);
      const resolvedImpWordIndices = resolveImpWordIndicesForWords(words, impWordIndex, impWordIndices);
      targetSlots.forEach((slot, slotIndex) => {
        if (assigned[slotIndex].length) {
          replaceAdvancedTextSlot(slot, assigned[slotIndex], -1, impClass, emphasisColor, block, resolvedImpWordIndices);
        } else {
          slot.nodeValue = '';
        }
      });
      slots.slice(targetSlotCount).forEach((slot) => {
        slot.nodeValue = '';
      });
      block.querySelectorAll('[data-text]').forEach((element) => {
        element.setAttribute('data-text', captionText);
      });
    };

    const shouldSuppressStyledSemanticEmphasis = (templateId, blockType, block) => (
      templateId === 't17' && !!block?.querySelector?.('.snap-txt')
    );

    const normalizeAdvancedSourceStyledBlock = (block, templateId, blockIndex, captionText = '', previewLineTexts = []) => {
      const rebuildSplitText = (container, lines, impClass = '') => {
        if (!container || !Array.isArray(lines) || !lines.length) return;
        const doc = container.ownerDocument || document;
        container.textContent = '';
        container.appendChild(doc.createTextNode(lines[0] || ''));
        if (lines[1]) {
          container.appendChild(doc.createElement('br'));
          if (impClass) {
            const span = doc.createElement('span');
            span.className = impClass + ' is-emphasis';
            span.dataset.imp = 'true';
            span.dataset.impCls = impClass;
            span.textContent = lines[1];
            container.appendChild(span);
          } else {
            container.appendChild(doc.createTextNode(lines[1]));
          }
        }
      };

      if (templateId === 't15' && blockIndex === 0) {
        const line = block.querySelector('.shake-in');
        if (line) {
          rebuildSplitText(line, splitTemplateLines(captionText, 2), getAdvancedSourceImpClass(block));
          line.classList.add('lekha-template-fit');
        }
        return;
      }

      if (templateId === 't17' && blockIndex === 1) {
        const snapText = block.querySelector('.snap-txt');
        if (snapText) {
          snapText.style.setProperty('display', 'inline-block', 'important');
          snapText.style.setProperty('opacity', '1', 'important');
          snapText.style.setProperty('filter', 'none', 'important');
          snapText.style.setProperty('transform', 'none', 'important');
          snapText.style.setProperty('letter-spacing', '0.04em', 'important');
          snapText.style.setProperty('color', '#ff3d71', 'important');
          snapText.style.setProperty('-webkit-text-fill-color', '#ff3d71', 'important');
          snapText.style.setProperty('text-shadow', '0 1px 8px rgba(0,0,0,0.82), 0 0 2px rgba(0,0,0,0.92), 0 0 16px rgba(255,61,113,0.22)', 'important');
          snapText.style.setProperty('animation', 'none', 'important');
          snapText.style.setProperty('transition', 'none', 'important');
          [snapText, ...snapText.querySelectorAll('*')].forEach((node) => {
            node.style.setProperty('color', '#ff3d71', 'important');
            node.style.setProperty('-webkit-text-fill-color', '#ff3d71', 'important');
          });
        }
        return;
      }

      if (templateId === 't18' && blockIndex === 0) {
        const lines = splitTemplateLines(captionText, 2);
        const splitTitle = block.querySelector('.split-title');
        if (splitTitle) {
          const doc = splitTitle.ownerDocument || document;
          splitTitle.textContent = '';
          const top = doc.createElement('span');
          top.className = 'split-top';
          top.textContent = lines[0] || captionText;
          splitTitle.appendChild(top);
          const bottom = doc.createElement('span');
          bottom.className = 'split-bot';
          if (lines[1]) {
            const imp = doc.createElement('span');
            imp.className = 'imp-purple is-emphasis';
            imp.dataset.imp = 'true';
            imp.dataset.impCls = 'imp-purple';
            imp.textContent = lines[1];
            bottom.appendChild(imp);
          }
          splitTitle.appendChild(bottom);
          splitTitle.classList.add('lekha-template-fit');
        }
        return;
      }

      if (templateId === 't38' && blockIndex === 0) {
        const line = block.querySelector('span');
        if (line) {
          const lines = resolveTemplatePreviewLines(captionText, previewLineTexts, 2);
          const doc = line.ownerDocument || document;
          line.textContent = '';
          line.classList.add('lekha-template-fit', 'lekha-template-preview-lines');
          lines.forEach((lineText, index) => {
            if (index > 0) line.appendChild(doc.createElement('br'));
            line.appendChild(doc.createTextNode(lineText));
          });
        }
        return;
      }

      if (templateId !== 't13') return;

      const selector = blockIndex === 0
        ? '.slide-crash'
        : blockIndex === 1
          ? '.ticker-txt'
          : '.wbw-rise, .wbw-slide, .wbw-seq-fade';

      const line = block.querySelector(selector);
      if (!line) return;

      line.classList.add('lekha-template-fit');
      if (shouldCompactTemplateLine(captionText)) {
        line.classList.add('t13-compact-line');
        line.style.setProperty('text-transform', 'none', 'important');
      }
    };

    const originalTemplateBlockTypes = ${JSON.stringify(ORIGINAL_TEMPLATE_BLOCK_TYPES)};
    const recreatedAdvancedTemplateIds = new Set(${JSON.stringify(RECREATED_ADVANCED_TEMPLATE_IDS)});
    const RECREATED_ADVANCED_WBW_PHASES = {
      t11: { 2: 'imp-gold' },
      t18: { 2: 'imp-purple' },
      t24: { 2: 'imp-orange' },
      t31: { 2: 'imp-gold' },
    };
    const getRecreatedAdvancedWbwImpClass = (templateId, blockIndex) =>
      RECREATED_ADVANCED_WBW_PHASES[String(templateId || '')]?.[Number(blockIndex)] || '';
    const shouldRecreateAdvancedWbwPhase = (templateId, blockIndex) =>
      Boolean(getRecreatedAdvancedWbwImpClass(templateId, blockIndex));
    const rebuildAdvancedWbwRiseBlock = (
      block,
      words,
      impWordIndex = -1,
      emphasisColor = '',
      templateId = '',
      blockIndex = 0,
      impWordIndices = [],
    ) => {
      if (!block || !words.length || !shouldRecreateAdvancedWbwPhase(templateId, blockIndex)) return;
      const doc = block.ownerDocument;
      const impClass = getRecreatedAdvancedWbwImpClass(templateId, blockIndex);
      const fallbackImpIndex = Number.isFinite(Number(impWordIndex)) && Number(impWordIndex) >= 0
        ? Math.min(words.length - 1, Number(impWordIndex))
        : Math.min(1, words.length - 1);
      const targetImpIndices = new Set(resolveImpWordIndicesForWords(words, fallbackImpIndex, impWordIndices));
      block.textContent = '';
      const line = doc.createElement('span');
      line.className = 'wbw-rise lekha-template-fit';
      line.dataset.type = 'wbw-rise';
      words.forEach((word, index) => {
        if (index > 0) line.appendChild(doc.createTextNode(' '));
        const span = doc.createElement('span');
        const isImp = targetImpIndices.has(index);
        span.className = 'w' + (isImp ? ' ' + impClass + ' is-emphasis' : '');
        span.dataset.i = String(index);
        if (isImp) {
          span.dataset.imp = 'true';
          span.dataset.impCls = impClass;
          if (emphasisColor) {
            span.style.setProperty('color', emphasisColor, 'important');
            span.style.setProperty('-webkit-text-fill-color', emphasisColor, 'important');
          }
        }
        if (index < words.length - 1) {
          span.style.setProperty('margin-right', '0.24em', 'important');
        }
        span.textContent = word;
        line.appendChild(span);
      });
      block.appendChild(line);
    };

    const buildCanonicalAdvancedTemplateMarkup = (
      templateId,
      text,
      blockIndex = 0,
      impWordIndex = -1,
      emphasisColor = '',
      previewLineTexts = [],
      impWordIndices = [],
    ) => {
      if (recreatedAdvancedTemplateIds.has(String(templateId || '').trim())) return '';

      const blocks = advancedTemplateBlockMarkup[templateId] || [];
      if (!blocks.length) return '';
      const normalized = ((Number(blockIndex || 0) % blocks.length) + blocks.length) % blocks.length;
      const resolvedEmphasisColor = resolveAdvancedTemplateEmphasisColor(templateId, emphasisColor, normalized);
      const sourceMarkup = blocks[normalized] || '';
      if (!sourceMarkup) return '';
      const doc = new DOMParser().parseFromString(sourceMarkup, 'text/html');
      const block = doc.querySelector('.sblock');
      const words = String(text || '').trim().split(/\\s+/).filter(Boolean);
      if (!block || !words.length) return '';

      cleanAdvancedSourceElement(block);
      const blockType = originalTemplateBlockTypes[templateId]?.[normalized] || block.dataset.type || 'styled';
      block.classList.add(templateId + '-block', 'lekha-applied-advanced-template', 'lekha-advanced-source-block');
      block.dataset.templateBlockIndex = String(normalized);
      block.dataset.templateBlockType = blockType;
      block.style.opacity = '0';
      block.style.transition = 'none';
      rebuildAdvancedWbwRiseBlock(block, words, impWordIndex, resolvedEmphasisColor, templateId, normalized, impWordIndices);

      const wbwContainers = Array.from(block.querySelectorAll(
        '.wbw-rise, .wbw-slide, .wbw-seq, .wbw-seq-fade, .wbw-seq-flip',
      ));
      if (wbwContainers.length) {
        wbwContainers.forEach((container) => replaceAdvancedSourceWbw(container, words, impWordIndex, resolvedEmphasisColor, impWordIndices));
      } else {
        const karaokeContainers = Array.from(block.querySelectorAll('.kf-line'));
        if (karaokeContainers.length) {
          karaokeContainers.forEach((container) => replaceAdvancedSourceKaraoke(container, words));
        } else {
          const suppressSemanticEmphasis = shouldSuppressStyledSemanticEmphasis(templateId, blockType, block);
          replaceAdvancedSourceStyledText(
            block,
            words,
            text,
            suppressSemanticEmphasis ? -1 : impWordIndex,
            suppressSemanticEmphasis ? '' : resolvedEmphasisColor,
            suppressSemanticEmphasis ? [] : impWordIndices,
          );
        }
      }

      normalizeAdvancedSourceStyledBlock(block, templateId, normalized, text, previewLineTexts);

      return '<span class="lekha-original-template ' + templateId + ' ' + templateId + '-stage">'
        + block.outerHTML
        + '</span>';
    };

    window.__advancedTemplateTiming = ${JSON.stringify(ADVANCED_TEMPLATE_TIMING)};
    window.__advancedImpEntrances = ${JSON.stringify(ADVANCED_IMP_ENTRANCES)};
    window.__getAdvancedPlaybackElapsedMs = (blockType, wordCount, captionDurationMs, rawElapsedMs) => {
      const timing = window.__advancedTemplateTiming || {};
      const getWindow = () => {
        if (blockType === 'plain') return 0;
        if (blockType === 'karaoke') return Number(timing.holdMs || 1650);
        if (String(blockType || '').startsWith('wbw-')) {
          const sequential = blockType === 'wbw-seq'
            || blockType === 'wbw-seq-fade'
            || blockType === 'wbw-seq-flip';
          const stagger = sequential
            ? Number(timing.sequentialStaggerMs || 145)
            : Number(timing.wordStaggerMs || 45);
          const duration = sequential
            ? Number(timing.sequentialDurationMs || 180)
            : Number(timing.emphasisDurationMs || 300);
          return (Math.max(0, Number(wordCount || 1) - 1) * stagger) + duration;
        }
        return Number(timing.styledDurationMs || 850);
      };
      const naturalWindowMs = getWindow();
      if (!naturalWindowMs) return 0;
      const durationMs = Math.max(0, Number(captionDurationMs) || 0);
      const targetWindowMs = durationMs > 0
        ? Math.max(220, Math.min(naturalWindowMs, durationMs * 0.78))
        : naturalWindowMs;
      const elapsedMs = Math.max(0, Number(rawElapsedMs) || 0);
      return Math.min(naturalWindowMs, elapsedMs * (naturalWindowMs / targetWindowMs));
    };

    const wrapOriginalTemplate = (templateId, blockClass, blockIndex, blockType, children, extraStyle = '') => \`
      <span class="lekha-original-template \${templateId} \${templateId}-stage">
        <span
          id="\${templateId}-b\${blockIndex}"
          class="sblock \${templateId}-block \${blockClass} lekha-applied-advanced-template"
          data-template-block-index="\${blockIndex}"
          data-template-block-type="\${blockType}"
          style="opacity:0;transition:none;\${extraStyle}"
        >\${children}</span>
      </span>
    \`;

    const buildOriginalAdvancedTemplateMarkup = (templateId, text, blockIndex = 0, previewLineTexts = [], impWordIndex = -1, impWordIndices = []) => {
      const { top, hero, bottom, full } = splitCaptionForTemplate(text);
      const blockTypes = originalTemplateBlockTypes[templateId] || ['styled'];
      const normalized = ((blockIndex % blockTypes.length) + blockTypes.length) % blockTypes.length;
      const blockType = blockTypes[normalized];
      const lines2 = splitTemplateLines(full, 2);
      const resolvedPreviewLines = resolveTemplatePreviewLines(full, previewLineTexts, 2);
      const compactLines2 = splitCompactIndexedLines(
        full.split(/\\s+/).filter(Boolean).map((word) => ({ word })),
        previewLineTexts,
      ).map((line) => line.map((token) => token.word).join(' '));
      const upperFull = full.toUpperCase();
      const compactFull = shouldCompactTemplateLine(full);
      const t13LineClass = compactFull ? 'lekha-template-fit t13-compact-line' : 'lekha-template-fit';
      const t13LineText = compactFull ? full : upperFull;
      activeTemplateImpWordIndices = resolveImpWordIndicesForWords(
        full.split(/\\s+/).filter(Boolean),
        impWordIndex,
        impWordIndices,
      );
      const lineSpans = (lines, cls, mapper = (line) => escapeHtml(line)) =>
        lines.map((line, index) => \`<span class="\${cls}" style="animation-delay:\${index * 0.1}s">\${mapper(line, index)}</span>\`).join('');
      const wrap = (blockClass, children, extraStyle = '') => wrapOriginalTemplate(templateId, blockClass, normalized, blockType, children, extraStyle);

      switch (templateId) {
        case 't11':
          if (normalized === 1) return wrap('t11-b1', \`<span class="blur-txt lekha-template-fit">\${heroMarkup(full, 'imp-italic')}</span>\`);
          if (normalized === 2) return wrap('t11-b2', wbwMarkup(full, 'wbw-rise', 'imp-gold'));
          if (normalized === 3) return wrap('t11-b3', wbwMarkup(full, 'wbw-rise', 'imp-gold'));
          return wrap('t11-b0', wbwMarkup(full, 'wbw-seq-fade', 'imp-gold'));
        case 't12':
          if (normalized === 1) return wrap('t12-b1', \`<span class="rise-unit lekha-template-fit">\${heroMarkup(full, 'imp-purple')}</span>\`);
          if (normalized === 2) return wrap('t12-b2', wbwMarkup(full, 'wbw-rise', 'imp-italic'));
          if (normalized === 3) return wrap('t12-b3', wbwMarkup(full, 'wbw-slide', 'imp-rose'));
          return wrap('t12-b0', wbwMarkup(full, 'wbw-seq-fade', 'imp-purple'));
        case 't13':
          if (normalized === 1) return wrap('t13-b1', wbwMarkup(full, 'wbw-slide', 'imp-bold'));
          if (normalized === 2) return wrap('t13-b2', wbwMarkup(full, 'wbw-rise', 'imp-bold'));
          if (normalized === 3) return wrap('t13-b3', wbwMarkup(full, 'wbw-seq-fade', 'imp-bold'));
          return wrap('t13-b0', wbwMarkup(full, 'wbw-rise', 'imp-bold'));
        case 't14':
          if (normalized === 1) return wrap('t14-b1', \`<span class="drop-txt lekha-template-fit">\${heroMarkup(full, 'imp-gold')}</span>\`);
          if (normalized === 2) return wrap('t14-b2', \`<span class="lekha-template-fit">\${escapeHtml(full)}</span>\`);
          if (normalized === 3) return wrap('t14-b3', wbwMarkup(full, 'wbw-rise', 'imp-weight'));
          return wrap('t14-b0', \`<span style="perspective:600px" class="lekha-template-fit">\${lineSpans(lines2, 'flip-line', (line, index) => index === lines2.length - 1 ? heroMarkup(line, 'imp-underline') : escapeHtml(line))}</span>\`);
        case 't15':
          if (normalized === 1) return wrap('t15-b1', \`<span class="pop-txt lekha-template-fit">\${escapeHtml(upperFull)}</span>\`);
          if (normalized === 2) return wrap('t15-b2', wbwMarkup(full, 'wbw-rise', 'imp-bold'));
          if (normalized === 3) return wrap('t15-b3', wbwMarkup(full, 'wbw-seq-fade', 'imp-rose'));
          return wrap('t15-b0', \`<span class="shake-in lekha-template-fit">\${escapeHtml(lines2[0] || '')}\${lines2[1] ? \`<br>\${heroMarkup(lines2[1], 'imp-rose')}\` : ''}</span>\`);
        case 't16':
          if (normalized === 1) return wrap('t16-b1', wbwMarkup(full, 'wbw-rise', 'imp-bold', { motion: 't16-neon', lineClassName: 't16-neon-words' }));
          if (normalized === 2) return wrap('t16-b2', wbwMarkup(full, 'wbw-rise', 'imp-bold', { motion: 't16-diagonal', lineClassName: 't16-diagonal-words' }));
          if (normalized === 3) return wrap('t16-b3', wbwMarkup(full, 'wbw-slide', 'imp-bold', { motion: 't16-impact', lineClassName: 't16-impact-words' }));
          return wrap('t16-b0', wbwMarkup(full, 'wbw-rise', 'imp-bold', { motion: 't16-stack', lineClassName: 't16-stack-words' }));
        case 't17':
          if (normalized === 1) return wrap('t17-b1', wbwMarkup(full, 'wbw-rise', 'imp-rose'));
          if (normalized === 2) return wrap('t17-b2', wbwMarkup(full, 'wbw-slide', 'imp-rose'));
          if (normalized === 3) return wrap('t17-b3', wbwMarkup(full, 'wbw-rise', 'imp-rose'));
          return wrap('t17-b0', wbwMarkup(full, 'wbw-seq-fade', 'imp-rose'));
        case 't18':
          if (normalized === 1) return wrap('t18-b1', \`<span class="reveal-txt lekha-template-fit">\${heroMarkup(full, 'imp-purple')}</span>\`);
          if (normalized === 2) return wrap('t18-b2', wbwMarkup(full, 'wbw-rise', 'imp-purple'));
          if (normalized === 3) return wrap('t18-b3', wbwMarkup(full, 'wbw-rise', 'imp-purple'));
          return wrap('t18-b0', \`<span class="split-title lekha-template-fit"><span class="split-top">\${escapeHtml(resolvedPreviewLines[0] || full)}</span><span class="split-bot">\${resolvedPreviewLines[1] ? heroMarkup(resolvedPreviewLines[1], 'imp-purple') : ''}</span></span>\`);
        case 't19':
          if (normalized === 1) return wrap('t19-b1', \`<span class="rise-unit lekha-template-fit">\${heroMarkup(upperFull, 'imp-rose')}</span>\`);
          if (normalized === 2) return wrap('t19-b2', wbwMarkup(full, 'wbw-rise', 'imp-bold'));
          if (normalized === 3) return wrap('t19-b3', wbwMarkup(full, 'wbw-seq-fade', 'imp-rose'));
          return wrap('t19-b0', \`<span class="slash-wrap lekha-template-fit">\${escapeHtml(upperFull)}</span>\`);
        case 't20':
          if (normalized === 1) return wrap('t20-b1', \`<span class="impact-txt lekha-template-fit">\${heroMarkup(full, 'imp-green')}</span>\`);
          if (normalized === 2) return wrap('t20-b2', wbwMarkup(full, 'wbw-rise', 'imp-bold'));
          if (normalized === 3) return wrap('t20-b3', wbwMarkup(full, 'wbw-seq-fade', 'imp-green'));
          return wrap('t20-b0', \`<span class="impact-slide lekha-template-fit">\${escapeHtml(upperFull)}</span>\`);
        case 't21':
          if (normalized === 1) return wrap('t21-b1', wbwMarkup(full, 'wbw-seq-fade', 'imp-space'));
          if (normalized === 2) return wrap('t21-b2', wbwMarkup(full, 'wbw-rise', 'imp-italic'));
          if (normalized === 3) return wrap('t21-b3', wbwMarkup(full, 'wbw-slide', 'imp-weight'));
          return wrap('t21-b0', wbwMarkup(full, 'editorial-line wbw-rise', ''));
        case 't22':
          if (normalized === 1) return wrap('t22-b1', \`<span class="wave-txt lekha-template-fit">\${heroMarkup(full, 'imp-gold')}</span>\`);
          if (normalized === 2) return wrap('t22-b2', wbwMarkup(full, 'wbw-rise', 'imp-italic'));
          if (normalized === 3) return wrap('t22-b3', wbwMarkup(full, 'wbw-seq-fade', 'imp-gold'));
          return wrap('t22-b0', karaokeMarkup(full));
        case 't23':
          if (normalized === 3) return wrap('t23-b3', \`<span class="punch-txt lekha-template-fit">\${heroMarkup(full, 'imp-bold')}</span>\`);
          return wrap(\`t23-b\${normalized}\`, \`<span class="\${normalized === 0 ? 'setup-txt ' : ''}lekha-template-fit">\${escapeHtml(full)}</span>\`);
        case 't24':
          if (normalized === 1) return wrap('t24-b1', wbwMarkup(full, 'wbw-rise', 'imp-orange', { motion: 't24-drift', lineClassName: 't24-drift-line', compactLines: true, lineTexts: previewLineTexts }));
          if (normalized === 2) return wrap('t24-b2', wbwMarkup(full, 'wbw-slide', 'imp-orange', { motion: 't24-slide', lineClassName: 't24-slide-line', compactLines: true, lineTexts: previewLineTexts }));
          if (normalized === 3) return wrap('t24-b3', wbwMarkup(full, 'wbw-rise', 'imp-purple', { motion: 't24-stamp', lineClassName: 't24-stamp-line', compactLines: true, lineTexts: previewLineTexts }));
          if (normalized === 4) return wrap('t24-b4', wbwMarkup(full, 'wbw-rise', 'imp-orange', { motion: 't24-inner', lineClassName: 't24-inner-line', compactLines: true, lineTexts: previewLineTexts }));
          return wrap('t24-b0', wbwMarkup(full, 'wbw-rise', 'imp-orange', { motion: 't24-wipe', lineClassName: 't24-wipe-line', compactLines: true, lineTexts: previewLineTexts }));
        case 't25':
          if (normalized === 1) return wrap('t25-b1', \`<span class="soft-rise lekha-template-fit lekha-template-preview-lines">\${compactLines2.map((line, index) => \`<span class="lekha-template-preview-line">\${index === compactLines2.length - 1 ? heroMarkup(line, 'imp-italic') : escapeHtml(line)}</span>\`).join('')}</span>\`);
          if (normalized === 2) return wrap('t25-b2', wbwMarkup(full, 'wbw-rise', 'imp-rose', { compactLines: true, lineTexts: previewLineTexts }));
          if (normalized === 3) return wrap('t25-b3', wbwMarkup(full, 'wbw-slide', 'imp-italic', { compactLines: true, lineTexts: previewLineTexts }));
          return wrap('t25-b0', \`<span class="hand-txt lekha-template-fit lekha-template-preview-lines">\${compactLines2.map((line, index) => \`<span class="lekha-template-preview-line">\${index === compactLines2.length - 1 ? heroMarkup(line, 'imp-rose') : escapeHtml(line)}</span>\`).join('')}</span>\`);
        case 't26':
          if (normalized === 1) return wrap('t26-b1', wbwMarkup(upperFull, 'wbw-slide', 'imp-rose', { motion: 't26-snap', lineClassName: 't26-snap-line' }));
          if (normalized === 2) return wrap('t26-b2', wbwMarkup(full, 'wbw-rise', 'imp-bold', { motion: 't26-kick', lineClassName: 't26-kick-line' }));
          if (normalized === 3) return wrap('t26-b3', wbwMarkup(full, 'wbw-seq-fade', 'imp-rose', { motion: 't26-tag', lineClassName: 't26-tag-line' }));
          return wrap('t26-b0', wbwMarkup(upperFull, 'wbw-rise', 'imp-rose', { motion: 't26-shutter', lineClassName: 't26-shutter-line' }));
        case 't27':
          if (normalized === 1) return wrap('t27-b1', \`<span class="lekha-template-fit" style="font-family:'Exo 2',sans-serif;font-weight:700;color:rgba(0,229,255,0.8)">\${escapeHtml(full)}</span>\`);
          if (normalized === 2) return wrap('t27-b2', \`<span class="lekha-template-fit">\${heroMarkup(full, 'imp-bold')}</span>\`);
          if (normalized === 3) return wrap('t27-b3', wbwMarkup(full, 'wbw-rise', 'imp-cyan'));
          return wrap('t27-b0', \`<span class="center-expand-txt lekha-template-fit">\${escapeHtml(upperFull)}</span>\`);
        case 't28':
          if (normalized === 1) return wrap('t28-b1', \`<span class="slow-fade lekha-template-fit">\${heroMarkup(full, 'imp-gold')}</span>\`);
          if (normalized === 2) return wrap('t28-b2', wbwMarkup(full, 'wbw-rise', 'imp-gold'));
          if (normalized === 3) return wrap('t28-b3', wbwMarkup(full, 'wbw-seq-fade', 'imp-gold'));
          return wrap('t28-b0', \`<span class="grain-txt lekha-template-fit">\${escapeHtml(lines2[0] || '')}\${lines2[1] ? \`<br>\${heroMarkup(lines2[1], 'imp-gold')}\` : ''}</span>\`);
        case 't29':
          if (normalized === 1) return wrap('t29-b1', wbwMarkup(full, 'wbw-rise', 'imp-rose', { motion: 't29-recoil', lineClassName: 't29-recoil-line' }));
          if (normalized === 2) return wrap('t29-b2', wbwMarkup(full, 'wbw-slide', 'imp-rose', { motion: 't29-charge', lineClassName: 't29-charge-line' }));
          if (normalized === 3) return wrap('t29-b3', wbwMarkup(full, 'wbw-seq-fade', 'imp-rose', { motion: 't29-clamp', lineClassName: 't29-clamp-line' }));
          return wrap('t29-b0', wbwMarkup(full, 'wbw-rise', 'imp-rose', { motion: 't29-shutter', lineClassName: 't29-shutter-line' }));
        case 't30':
          if (normalized > 0) return wrap(\`t30-b\${normalized}\`, \`<span class="lekha-template-fit">\${normalized === 3 ? heroMarkup(full, 'imp-italic') : escapeHtml(full)}</span>\`);
          return wrap('t30-b0', \`<span class="breathe-txt lekha-template-fit">\${escapeHtml(lines2[0] || '')}\${lines2[1] ? \`<br><span class="imp-italic">\${escapeHtml(lines2[1])}</span>\` : ''}</span>\`);
        case 't31':
          if (normalized === 1) return wrap('t31-b1', wbwMarkup(full, 'wbw-seq-fade', 'imp-gold'));
          if (normalized === 2) return wrap('t31-b2', wbwMarkup(full, 'wbw-rise', 'imp-gold'));
          if (normalized === 3) return wrap('t31-b3', wbwMarkup(full, 'wbw-rise', 'imp-gold'));
          if (normalized === 4) return wrap('t31-b4', \`<span style="perspective:500px" class="lekha-template-fit"><span class="flip-line" style="font-family:'Playfair Display',serif">\${heroMarkup(full, 'imp-gold')}</span></span>\`);
          return wrap('t31-b0', wbwMarkup(full, 'wbw-seq-fade', 'imp-gold'));
        case 't32':
          if (normalized === 1) return wrap('t32-b1', \`<span style="perspective:500px" class="lekha-template-fit"><span class="flip-line" style="font-family:'Bodoni Moda',serif;font-style:italic">\${heroMarkup(full, 'imp-italic')}</span></span>\`);
          if (normalized === 2) return wrap('t32-b2', \`<span class="lekha-template-fit">\${escapeHtml(full)}</span>\`);
          if (normalized === 3) return wrap('t32-b3', wbwMarkup(full, 'wbw-rise', 'imp-purple'));
          if (normalized === 4) return wrap('t32-b4', wbwMarkup(full, 'wbw-seq-fade', 'imp-purple'));
          return wrap('t32-b0', \`<span style="font-style:italic" class="lekha-template-fit">\${lineSpans(lines2, 'ink-line', (line, index) => index === lines2.length - 1 ? heroMarkup(line, 'imp-purple') : escapeHtml(line))}</span>\`);
        case 't33':
          if (normalized === 1) return wrap('t33-b1', wbwMarkup(full, 'wbw-seq-fade', 'imp-cyan', { compactLines: true, lineTexts: previewLineTexts }));
          if (normalized === 2) return wrap('t33-b2', karaokeMarkup(full));
          if (normalized === 3) return wrap('t33-b3', wbwMarkup(full, 'wbw-rise', 'imp-bold', { compactLines: true, lineTexts: previewLineTexts }));
          if (normalized === 4) return wrap('t33-b4', \`<span style="perspective:500px" class="lekha-template-fit"><span class="flip-line" style="font-family:'Noto Sans',sans-serif">\${heroMarkup(full, 'imp-cyan')}</span></span>\`);
          return wrap('t33-b0', \`<span class="doc-line lekha-template-fit">\${lineSpans(resolvedPreviewLines, '', (line) => line.includes(hero) ? heroMarkup(line, 'imp-cyan') : escapeHtml(line))}</span>\`);
        case 't34':
          if (normalized === 1) return wrap('t34-b1', \`<span class="pow-txt lekha-template-fit">\${heroMarkup(full, 'imp-cyan')}</span>\`);
          if (normalized === 2) return wrap('t34-b2', wbwMarkup(full, 'wbw-rise', 'imp-bold'));
          if (normalized === 3) return wrap('t34-b3', wbwMarkup(full, 'wbw-slide', 'imp-cyan'));
          return wrap('t34-b0', wbwMarkup(full, 'wbw-seq-fade', 'imp-bold'));
        case 't35':
          if (normalized > 0) return wrap(\`t35-b\${normalized}\`, \`<span class="lekha-template-fit">\${normalized === 3 ? heroMarkup(full, 'imp-italic') : escapeHtml(full)}</span>\`);
          return wrap('t35-b0', \`<span class="secret-txt lekha-template-fit">\${heroMarkup(full, 'imp-italic')}</span>\`);
        case 't36':
          return wrap(\`t36-b\${normalized}\`, karaokeMarkup(full));
        case 't37':
          if (normalized === 1) return wrap('t37-b1', wbwMarkup(full, 'wbw-rise', 'imp-green'));
          if (normalized === 2) return wrap('t37-b2', \`<span class="neon-expand lekha-template-fit">\${escapeHtml(upperFull)}</span>\`);
          if (normalized === 3) return wrap('t37-b3', wbwMarkup(full, 'wbw-seq', 'imp-green'));
          return wrap('t37-b0', \`<span class="neon-pulse lekha-template-fit">\${escapeHtml(upperFull)}</span>\`);
        case 't38':
          if (normalized === 1) return wrap('t38-b1', wbwMarkup(full, 'wbw-slide', 'imp-italic'));
          if (normalized === 2) return wrap('t38-b2', wbwMarkup(full, 'wbw-rise', 'imp-gold'));
          if (normalized === 3) return wrap('t38-b3', wbwMarkup(full, 'wbw-seq-fade', 'imp-italic'));
          return wrap('t38-b0', \`<span class="lekha-template-fit lekha-template-preview-lines">\${resolvedPreviewLines.map((line) => escapeHtml(line)).join('<br>')}</span>\`);
        case 't39':
          return wrap(\`t39-b\${normalized}\`, wbwMarkup(full, 'wbw-seq-fade', normalized % 2 ? 'imp-rose' : 'imp-gold', { motion: 't39-evidence' }));
        case 't40':
          if (normalized === 2) return wrap('t40-b2', \`<span class="lekha-template-fit">\${stillFramesMarkup(full)}</span>\`);
          return wrap(\`t40-b\${normalized}\`, \`<span class="lekha-template-fit">\${stillFramesMarkup(full)}</span>\`);
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

    // Displacing a word authors a CPT (creatively placed text), which builds up
    // word by word until the sentence is complete. Mirrors captionHasCptWords()
    // in VideoPlayer.jsx — the preview keeps pending words mounted at opacity 0
    // so the line never reflows as words land, and the export must match.
    const captionHasCptWords = (caption) => (
      Object.values(caption?.word_styles || {}).some((wordStyle = {}) => (
        Math.abs(Number(wordStyle?.abs_x_pct) || 0) > 0.01
        || Math.abs(Number(wordStyle?.abs_y_pct) || 0) > 0.01
        || Math.abs(Number(wordStyle?.x_pct) || 0) > 0.01
        || Math.abs(Number(wordStyle?.y_pct) || 0) > 0.01
        || Math.abs(Number(wordStyle?.x) || 0) > 0.01
        || Math.abs(Number(wordStyle?.y) || 0) > 0.01
      ))
    );

    const getWordEffectInlineStyles = (wordStyle = {}) => {
      const type = wordStyle?.effectType || 'none';
      if (type === 'none') return {};
      const color = wordStyle?.effectColor || '#000000';
      const blur = ((wordStyle?.effectBlur ?? 50) / 100) * 24;
      const offset = ((wordStyle?.effectOffset ?? 50) / 100) * 16;
      const dir = wordStyle?.effectDirection ?? -45;
      const transp = wordStyle?.effectTransparency ?? 40;
      const thick = wordStyle?.effectThickness ?? 50;
      const alpha = (100 - transp) / 100;
      const rad = (dir * Math.PI) / 180;
      const ox = +(Math.cos(rad) * offset).toFixed(1);
      const oy = +(Math.sin(rad) * offset).toFixed(1);
      const rc = (a = alpha) => rgbaFromHex(color, a);
      switch (type) {
        case 'shadow': return { 'text-shadow': \`\${ox}px \${oy}px \${blur}px \${rc()}\` };
        case 'lift': return { 'text-shadow': \`0px \${(offset * 0.4).toFixed(1)}px \${(blur * 0.5).toFixed(1)}px \${rc()}, 0px \${offset}px \${blur}px \${rc(alpha * 0.4)}\` };
        case 'hollow': return { '-webkit-text-stroke': \`\${(thick / 40).toFixed(1)}px \${color}\`, color: 'transparent', '-webkit-text-fill-color': 'transparent' };
        case 'splice': return { 'text-shadow': \`\${ox}px \${oy}px 0px \${rc()}\` };
        case 'outline': return { '-webkit-text-stroke': \`\${(thick / 40).toFixed(1)}px \${color}\` };
        case 'echo': return { 'text-shadow': \`\${ox}px \${oy}px 0px \${rc()}, \${ox * 2}px \${oy * 2}px 0px \${rc(alpha * 0.55)}, \${ox * 3}px \${oy * 3}px 0px \${rc(alpha * 0.25)}\` };
        case 'neon': return { 'text-shadow': \`0 0 \${(blur * 0.5).toFixed(1)}px \${color}, 0 0 \${blur}px \${color}, 0 0 \${(blur * 2).toFixed(1)}px \${color}\` };
        default: return {};
      }
    };

    const getCaptionEffectInlineStyles = (style = {}) => getWordEffectInlineStyles({
      effectType: style.effect_type,
      effectColor: style.effect_color,
      effectBlur: style.effect_blur,
      effectOffset: style.effect_offset,
      effectDirection: style.effect_direction,
      effectTransparency: style.effect_transparency,
      effectThickness: style.effect_thickness,
    });

    const inlineStyleObject = (styles = {}) => Object.entries(styles)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([property, value]) => \`\${property}:\${value}\`)
      .join(';');

    const getSourceWordAnimationStyle = (animationType, speed = 1) => {
      const safeSpeed = Math.max(0.25, Number(speed) || 1);
      const duration = (seconds) => \`\${+(seconds / safeSpeed).toFixed(2)}s\`;
      const animations = {
        rise: \`source-word-rise \${duration(0.4)} ease-out both\`,
        pan: \`source-word-pan \${duration(0.5)} ease-in-out both\`,
        fade: \`source-word-fade \${duration(0.5)} ease-in both\`,
        pop: \`source-word-pop \${duration(0.3)} ease-out both\`,
        wipe: \`source-word-wipe \${duration(0.4)} ease-out both\`,
        blur: \`source-word-blur \${duration(0.5)} ease-in-out both\`,
        succession: \`source-word-succession \${duration(0.4)} ease-out both\`,
        breathe: \`source-word-breathe \${duration(1.5)} ease-in-out infinite\`,
        baseline: \`source-word-baseline \${duration(0.4)} ease-out both\`,
        drift: \`source-word-drift \${duration(0.6)} ease-in-out both\`,
        tectonic: \`source-word-tectonic \${duration(0.5)} ease-out both\`,
        tumble: \`source-word-tumble \${duration(0.6)} ease-in-out both\`,
      };
      return animations[animationType] || '';
    };

    const sourceTemplateWordSelector = [
      '.lekha-applied-basic-template-host .word',
      '.lekha-applied-basic-template-host .w',
      '.lekha-applied-basic-template-host .wbw-word',
      '.template-caption-shell .lekha-original-template .w',
      '.template-caption-shell .lekha-original-template .kf-word',
      '.template-caption-shell .lekha-original-template .is-emphasis',
      '.lekha-sidebar-export-template-shell .w',
      '.lekha-sidebar-export-template-shell .wbw-word',
      '.lekha-sidebar-export-template-shell .sw',
      '.lekha-sidebar-export-template-shell .sw-w',
      '.lekha-sidebar-export-template-shell .plain-word',
      '[data-word-key]',
      '[data-w]',
      '[data-i]',
    ].join(',');

    const getEditableSourceTemplateWords = (root) => {
      const blocks = Array.from(root.querySelectorAll('.sb, .sblock, .lekha-applied-advanced-template'));
      const scopes = blocks.length ? blocks : [root];
      const seenNodes = new Set();
      const editableWords = [];
      scopes.forEach((scope) => {
        Array.from(scope.querySelectorAll(sourceTemplateWordSelector)).forEach((node) => {
          if (seenNodes.has(node)) return;
          if (node.closest?.('[data-source-word-spacer="true"]')) return;
          const parentEditable = node.parentElement?.closest?.(sourceTemplateWordSelector);
          if (parentEditable && scope.contains(parentEditable)) return;
          seenNodes.add(node);
          const explicitIndex = Number(node.dataset?.w ?? node.dataset?.i);
          editableWords.push({
            node,
            index: Number.isFinite(explicitIndex) ? explicitIndex : editableWords.length,
          });
        });
      });
      return editableWords
        .filter(({ index }) => Number.isFinite(index) && index >= 0)
        .sort((left, right) => left.index - right.index);
    };

    const sourceTemplateVisualSelector = '[data-source-word-visual="true"], .kf-base, .kf-fill';
    const getSourceTemplateVisualTargets = (node) => {
      if (!node) return [];
      const existingTargets = Array.from(node.querySelectorAll(sourceTemplateVisualSelector));
      if (existingTargets.length) return existingTargets;
      const elementChildren = Array.from(node.children || []);
      if (elementChildren.length) return [node];
      const visual = document.createElement('span');
      visual.dataset.sourceWordVisual = 'true';
      while (node.firstChild) {
        visual.appendChild(node.firstChild);
      }
      node.appendChild(visual);
      return [visual];
    };

    // CSS transforms do not apply to non-replaced inline boxes. The managed
    // visual span this renderer wraps a word in is inline by default, so a
    // dragged word (CPT) received the correct translate value and still never
    // moved in the exported video — the preview escapes this because
    // prepareSourceTemplateWordNode() forces inline-block there. Upgrade the
    // box only when an offset is actually being applied, so words that merely
    // carry font/colour overrides keep their current export layout.
    const ensureTransformableWordTarget = (element) => {
      if (!element?.style) return;
      if (getComputedStyle(element).display !== 'inline') return;
      element.style.setProperty('display', 'inline-block', 'important');
      element.style.setProperty('transform-origin', 'center center', 'important');
      element.style.setProperty('white-space', 'nowrap', 'important');
      element.style.setProperty('overflow', 'visible', 'important');
      element.style.setProperty('vertical-align', 'baseline', 'important');
      element.style.setProperty('line-height', 'inherit', 'important');
    };

    const applySourceTemplateWordStyles = (root, caption, renderTime = 0) => {
      if (!root || !caption) return;
      const nodes = getEditableSourceTemplateWords(root);
      const styles = caption.word_styles || {};
      const isCptCaption = captionHasCptWords(caption);
      const currentCptIndex = getCurrentWordIndex(caption, renderTime);
      const hasRealAbsolutePosition = (wordStyle = {}) => (
        Number.isFinite(Number(wordStyle.abs_x_pct))
        && Number.isFinite(Number(wordStyle.abs_y_pct))
        && (
          Math.abs(Number(wordStyle.abs_x_pct)) > 0.01
          || Math.abs(Number(wordStyle.abs_y_pct)) > 0.01
        )
      );
      const setImportant = (element, property, value) => {
        if (!element?.style || value === undefined || value === null || value === '') return;
        element.style.setProperty(property, String(value), 'important');
      };
      const unlockPositionedWordOverflow = (element) => {
        let current = element;
        while (current && root.contains(current)) {
          setImportant(current, 'overflow', 'visible');
          setImportant(current, 'overflow-x', 'visible');
          setImportant(current, 'overflow-y', 'visible');
          setImportant(current, 'clip-path', 'none');
          setImportant(current, '-webkit-clip-path', 'none');
          setImportant(current, 'mask-image', 'none');
          setImportant(current, '-webkit-mask-image', 'none');
          setImportant(current, 'contain', 'none');
          if (current === root) break;
          current = current.parentElement;
        }
      };
      const applyTextGradient = (target, gradient) => {
        setImportant(target, 'background-color', 'transparent');
        setImportant(target, 'background', gradient);
        setImportant(target, 'background-image', gradient);
        setImportant(target, 'background-size', '100% 100%');
        setImportant(target, 'background-repeat', 'no-repeat');
        setImportant(target, 'background-position', 'center');
        setImportant(target, '-webkit-background-clip', 'text');
        setImportant(target, 'background-clip', 'text');
        setImportant(target, '-webkit-text-fill-color', 'transparent');
        setImportant(target, 'color', 'transparent');
      };
      nodes.forEach(({ node, index }) => {
        const key = \`\${caption.id}-\${index}\`;
        const wordStyle = styles[key] || {};
        node.dataset.wordKey = key;
        if (isCptCaption && index > currentCptIndex) {
          setImportant(node, 'opacity', '0');
        } else if (isCptCaption) {
          setImportant(node, 'opacity', '1');
        }
        if (!Object.keys(wordStyle).length && !isCptCaption) return;
        const targets = getSourceTemplateVisualTargets(node);
        if (isCptCaption) {
          // CPT words reveal cumulatively at their transcription boundaries,
          // but they appear immediately in the exact final canvas state. Kill
          // authored template, caption, and per-word entrance motion on both the
          // editable anchor and its generated visual wrapper.
          [node, ...targets].forEach((target) => {
            setImportant(target, 'animation', 'none');
            setImportant(target, 'animation-delay', '0s');
            setImportant(target, 'animation-play-state', 'paused');
            setImportant(target, 'transition', 'none');
            setImportant(target, 'transform', 'none');
            setImportant(target, 'clip-path', 'none');
            setImportant(target, '-webkit-clip-path', 'none');
            setImportant(target, 'filter', 'none');
            delete target.dataset.cptWordStart;
            delete target.dataset.cptWordMotion;
          });
        }
        const isPlainEditorLayer = Boolean(node.closest('.plain-caption-shell, .text-element-shell'));
        const positionTargets = isPlainEditorLayer ? [node] : targets;
        const hasSourceXPct = wordStyle.x_pct !== null
          && wordStyle.x_pct !== ''
          && Number.isFinite(Number(wordStyle.x_pct));
        const hasSourceYPct = wordStyle.y_pct !== null
          && wordStyle.y_pct !== ''
          && Number.isFinite(Number(wordStyle.y_pct));
        const sourceOffsetX = hasSourceXPct
          ? (Number(wordStyle.x_pct) / 100) * window.innerWidth
          : Number(wordStyle.x || 0) * (window.__exportCanvasScale || 1);
        const sourceOffsetY = hasSourceYPct
          ? (Number(wordStyle.y_pct) / 100) * window.innerHeight
          : Number(wordStyle.y || 0) * (window.__exportCanvasScale || 1);
        let absoluteWordOffset = null;
        if (hasRealAbsolutePosition(wordStyle)) {
          if (node.dataset.exportAbsoluteWordPositioned === 'true') {
            positionTargets.forEach((target) => target.style.removeProperty('translate'));
          }
          const rect = node.getBoundingClientRect();
          absoluteWordOffset = {
            x: ((Number(wordStyle.abs_x_pct) / 100) * window.innerWidth) - (rect.left + rect.width / 2),
            y: ((Number(wordStyle.abs_y_pct) / 100) * window.innerHeight) - (rect.top + rect.height / 2),
          };
          node.dataset.exportAbsoluteWordPositioned = 'true';
        }
        if (absoluteWordOffset) {
          unlockPositionedWordOverflow(node);
          const rotation = Number(wordStyle.rotation || 0) || 0;
          const scaleX = Number(wordStyle.textScaleX || 1) || 1;
          setImportant(node, 'z-index', '80');
          positionTargets.forEach((target) => {
            target.dataset.exportWordPositionTarget = 'true';
            ensureTransformableWordTarget(target);
            setImportant(
              target,
              'translate',
              \`\${Math.round(absoluteWordOffset.x)}px \${Math.round(absoluteWordOffset.y)}px\`,
            );
            if (rotation) setImportant(target, 'rotate', \`\${rotation}deg\`);
            if (Math.abs(scaleX - 1) > 0.001) setImportant(target, 'scale', \`\${scaleX} 1\`);
          });
        } else if (Math.abs(sourceOffsetX) > 0.01 || Math.abs(sourceOffsetY) > 0.01) {
          unlockPositionedWordOverflow(node);
          positionTargets.forEach((target) => {
            target.dataset.exportWordPositionTarget = 'true';
            ensureTransformableWordTarget(target);
            setImportant(
              target,
              'translate',
              \`\${Math.round(sourceOffsetX)}px \${Math.round(sourceOffsetY)}px\`,
            );
          });
        }
        if (isPlainEditorLayer && wordStyle.boxWidth) {
          setImportant(node, 'width', \`\${scaleExportPx(wordStyle.boxWidth)}px\`);
          setImportant(node, 'white-space', 'normal');
          setImportant(node, 'overflow-wrap', 'anywhere');
        }
        const textGradient = typeof wordStyle.textGradient === 'string' ? wordStyle.textGradient.trim() : '';
        if (textGradient) {
          node.dataset.sourceWordGradient = 'true';
          node.style.setProperty('--source-word-text-gradient', textGradient, 'important');
        } else {
          delete node.dataset.sourceWordGradient;
          node.style.removeProperty('--source-word-text-gradient');
        }
        targets.forEach((target) => {
          if (wordStyle.fontFamily) setImportant(target, 'font-family', wordStyle.fontFamily);
          if (wordStyle.fontSize) {
            const scaledFontSize = isPlainEditorLayer
              ? scaleExportPx(wordStyle.fontSize)
              : scaleTemplateFontSize(wordStyle.fontSize);
            setImportant(target, 'font-size', \`\${scaledFontSize}px\`);
          }
          if (wordStyle.fontWeight) setImportant(target, 'font-weight', wordStyle.fontWeight);
          if (wordStyle.fontStyle) setImportant(target, 'font-style', wordStyle.fontStyle);
          if (wordStyle.textDecoration) setImportant(target, 'text-decoration', wordStyle.textDecoration);
          if (wordStyle.textTransform) setImportant(target, 'text-transform', wordStyle.textTransform);
          if (wordStyle.isEmphasis) {
            const emphasisColor = caption.custom_style?.highlight_color
              || caption.custom_style?.text_color
              || caption.applied_template_style?.highlight_color
              || caption.applied_template_style?.emphasis_color
              || caption.applied_template_style?.secondary_color
              || caption.emphasis_color
              || '#DDAA03';
            if (!wordStyle.fontWeight) setImportant(target, 'font-weight', '700');
            if (!wordStyle.fontSize) setImportant(target, 'scale', '1.12');
            if (!wordStyle.color && !textGradient) {
              setImportant(target, 'color', emphasisColor);
              setImportant(target, '-webkit-text-fill-color', emphasisColor);
            }
            setImportant(target, 'text-shadow', \`0 0 18px \${emphasisColor}99, 0 0 6px \${emphasisColor}66\`);
          }
          if (textGradient) {
            applyTextGradient(target, textGradient);
          } else if (wordStyle.color) {
            setImportant(target, 'color', wordStyle.color);
            setImportant(target, '-webkit-text-fill-color', wordStyle.color);
          }
          if (wordStyle.backgroundColor || wordStyle.highlightGradient) {
            setImportant(target, 'background', wordStyle.highlightGradient || rgbaFromHex(wordStyle.backgroundColor, wordStyle.backgroundOpacity ?? 0.6));
            setImportant(target, 'border-radius', '4px');
            setImportant(target, 'padding', \`\${wordStyle.backgroundPadding || 2}px 4px\`);
            setImportant(target, 'box-decoration-break', 'clone');
            setImportant(target, '-webkit-box-decoration-break', 'clone');
            if (textGradient) applyTextGradient(target, textGradient);
          }
          Object.entries(getWordEffectInlineStyles(wordStyle)).forEach(([property, value]) => {
            setImportant(target, property, value);
          });
          const animation = isCptCaption
            ? ''
            : getSourceWordAnimationStyle(wordStyle.animation, wordStyle.animationSpeed || 1);
          if (animation) {
            setImportant(target, 'display', 'inline-block');
            setImportant(target, 'transform-origin', 'center center');
            setImportant(target, 'animation', animation);
          }
        });
      });
    };

    // Right-side "Basic" templates — render the authored .btcard source markup
    // (with the caption's words injected at the active phase) exactly like the
    // canvas preview. The shared builder (window.__basicTpl) and per-template
    // markup (window.__basicTemplateMarkupMap) are injected before this script.
    const buildBasicTemplateCaptionMarkup = (caption, globalStyle, time) => {
      const templateId = String(globalStyle?.template_id || '').trim();
      const rawMarkup = (window.__basicTemplateMarkupMap || {})[templateId] || '';
      const text = String(caption?.text || '').trim();
      if (!rawMarkup || !text || !window.__basicTpl) {
        return buildTemplateMarkup(caption, globalStyle, time);
      }
      const words = text.split(/\\s+/).filter(Boolean);
      const phaseCount = window.__basicTpl.countAppliedBasicTemplatePhasesFromMarkup(rawMarkup);
      const templateCaptionIndex = Number.isFinite(Number(caption.__templateIndex))
        ? Number(caption.__templateIndex)
        : 0;
      const selectedPhase = ((templateCaptionIndex % phaseCount) + phaseCount) % phaseCount;
      const currentIndex = window.__basicTpl.getAppliedBasicCurrentWordIndex
        ? window.__basicTpl.getAppliedBasicCurrentWordIndex(caption, time, words.length)
        : getCurrentWordIndex(caption, time);
      const impWordIndex = Number(
        caption?.imp_word_index
        ?? caption?.template_imp_word_index
        ?? caption?.emphasis_word_index
        ?? -1,
      );
      const impWordIndices = Array.isArray(caption?.imp_word_indices)
        ? caption.imp_word_indices
        : [];
      const html = window.__basicTpl.buildAppliedBasicTemplateInlineFromMarkup(
        rawMarkup,
        templateId,
        text,
        { activePhase: selectedPhase, currentIndex: 0, impWordIndex, impWordIndices },
      );
      if (!html) return buildTemplateMarkup(caption, globalStyle, time);
      const textCase = globalStyle?.text_case && globalStyle.text_case !== 'none'
        ? globalStyle.text_case
        : '';
      const normalizedTemplateFontSize = normalizeAppliedBasicTemplateFontSize(
        templateId,
        globalStyle?.font_size || 22,
      ) || 22;
      const exportScale = Number(window.__exportCanvasScale || 1) || 1;
      const measuredBasicWidth = Number(
        caption?.preview_template_box_width_px
        || caption?.applied_template_style?.preview_template_box_width_px
        || globalStyle?.preview_template_box_width_px
        || 0,
      );
      const measuredBasicFont = Number(
        caption?.preview_template_font_px
        || caption?.applied_template_style?.preview_template_font_px
        || globalStyle?.preview_template_font_px
        || 0,
      );
      const exportBasicWidth = Math.max(
        1,
        Math.round((measuredBasicWidth > 0 ? measuredBasicWidth : 320) * exportScale),
      );
      const exportBasicFontPx = measuredBasicFont > 0
        ? Math.max(1, Math.round(measuredBasicFont * exportScale))
        : Math.max(
            12,
            Math.round(scaleTemplateFontSize(normalizedTemplateFontSize) * APPLIED_BASIC_EXPORT_FONT_SCALE),
          );
      const hostStyle = [
        \`--template-primary:\${globalStyle?.text_color || '#ffffff'}\`,
        \`--template-text-gradient:\${globalStyle?.text_gradient || 'none'}\`,
        \`--template-secondary:\${globalStyle?.secondary_color || '#000000'}\`,
        \`--template-bg:\${globalStyle?.background_color || 'transparent'}\`,
        \`--template-highlight:\${globalStyle?.highlight_color || globalStyle?.emphasis_color || globalStyle?.secondary_color || '#DDAA03'}\`,
        \`--template-highlight-gradient:\${globalStyle?.highlight_gradient || 'none'}\`,
        \`--template-karaoke-1:\${globalStyle?.karaoke_color_1 || globalStyle?.highlight_color || globalStyle?.emphasis_color || globalStyle?.secondary_color || '#DDAA03'}\`,
        \`--template-karaoke-2:\${globalStyle?.karaoke_color_2 || '#22D3EE'}\`,
        \`--template-karaoke-3:\${globalStyle?.karaoke_color_3 || '#FB923C'}\`,
        \`--applied-basic-scale:\${exportScale}\`,
        \`--applied-basic-width:\${exportBasicWidth}px\`,
        \`color:\${globalStyle?.text_color || '#ffffff'}\`,
        \`font-family:'\${globalStyle?.font_family || 'Inter'}'\`,
        \`font-size:\${exportBasicFontPx}px\`,
        \`font-weight:\${globalStyle?.font_weight || '800'}\`,
        \`font-style:\${globalStyle?.font_style || 'normal'}\`,
        \`line-height:\${globalStyle?.line_spacing || 1.25}\`,
        textCase ? \`text-transform:\${textCase}\` : '',
      ].filter(Boolean).join(';');
      return \`<span class="lekha-applied-basic-template-host lekha-basic-template-fit lekha-basic-template-enter-once \${templateId} \${globalStyle?.text_gradient ? 'has-text-gradient' : ''} \${globalStyle?.highlight_gradient ? 'has-highlight-gradient' : ''}" \`
        + \`data-applied-template-id="\${templateId}" data-applied-template-source="lekha-basic" \`
        + \`data-export-measure="basic-template" data-export-caption-id="\${escapeHtml(caption?.id || '')}" \`
        + \`data-caption-start="\${Number(caption?.start_time ?? 0)}" data-caption-end="\${Number(caption?.end_time ?? caption?.start_time ?? 0)}" \`
        + \`data-basic-current-index="\${currentIndex}" data-basic-word-count="\${words.length}" \`
        + \`style="\${hostStyle}">\${html}</span>\`;
    };

    const activateBasicTemplates = (root) => {
      if (!window.__basicTpl || !window.__basicTpl.updateAppliedBasicTemplateWordState) return;
      root.querySelectorAll('.lekha-applied-basic-template-host').forEach((host) => {
        const currentIndex = Number(host.getAttribute('data-basic-current-index')) || 0;
        const wordCount = Number(host.getAttribute('data-basic-word-count')) || 1;
        const templateId = host.getAttribute('data-applied-template-id') || '';
        window.__basicTpl.updateAppliedBasicTemplateWordState(host, currentIndex, wordCount, templateId);
      });
    };

    const buildTemplateMarkup = (caption, globalStyle, time) => {
      const templateIndex = /^t\\d{2}$/.test(String(globalStyle?.template_id || ''))
        ? resolveAdvancedTemplatePhaseIndex(caption, caption.__templateIndex ?? caption.__template_index ?? 0)
        : Number.isFinite(Number(caption.__templateIndex))
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
          if (captionHasCptWords(caption) && index > currentIndex) inline.push('opacity:0');
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

      const hasAppliedTemplate = Boolean(globalStyle?.template_id);
      const templatePrimaryColor = globalStyle?.template_id === 't36'
        ? '#ffffff'
        : (globalStyle?.text_color || '#ffffff');
      const styleVars = [
        \`--template-primary:\${templatePrimaryColor}\`,
        \`--template-text-gradient:\${globalStyle?.text_gradient || 'none'}\`,
        \`--template-secondary:\${globalStyle?.secondary_color || '#000000'}\`,
        \`--template-bg:\${hasAppliedTemplate ? 'transparent' : (globalStyle?.background_color || 'transparent')}\`,
        \`--template-highlight:\${globalStyle?.highlight_color || globalStyle?.emphasis_color || globalStyle?.secondary_color || '#DDAA03'}\`,
        \`--template-highlight-gradient:\${globalStyle?.highlight_gradient || 'none'}\`,
        \`--template-karaoke-1:\${globalStyle?.karaoke_color_1 || globalStyle?.highlight_color || globalStyle?.emphasis_color || globalStyle?.secondary_color || '#DDAA03'}\`,
        \`--template-karaoke-2:\${globalStyle?.karaoke_color_2 || '#22D3EE'}\`,
        \`--template-karaoke-3:\${globalStyle?.karaoke_color_3 || '#FB923C'}\`,
      ];

      if (isAdvancedTemplate) {
        const previewLineTexts = Array.isArray(caption?.preview_template_line_texts)
          && caption.preview_template_line_texts.length > 0
          ? caption.preview_template_line_texts
          : globalStyle?.preview_template_line_texts;
        return \`
          <div
            class="template-caption-shell template-shell-\${globalStyle?.template_id || ''} \${globalStyle?.template_color_customized ? 'is-color-customized' : ''} \${globalStyle?.text_gradient ? 'has-text-gradient' : ''} \${globalStyle?.highlight_gradient ? 'has-highlight-gradient' : ''}"
            data-caption-start="\${captionStart}"
            data-caption-end="\${captionEnd}"
            style="\${styleVars.join(';')}"
          >
            <div class="\${globalStyle?.template_id || ''}">
        <span class="\${globalStyle?.template_id || ''}" style="
                font-family:'\${globalStyle?.font_family || 'Inter'}';
                font-weight:\${globalStyle?.font_weight || '500'};
                font-style:\${globalStyle?.font_style || 'normal'};
                text-align:\${globalStyle?.text_align || 'center'};
              ">\${buildCanonicalAdvancedTemplateMarkup(
                globalStyle?.template_id,
                transformText(caption.text || '', globalStyle),
                templateIndex,
                Number(caption.imp_word_index ?? -1),
                globalStyle?.template_color_customized
                  ? (caption.emphasis_color || globalStyle?.highlight_color || globalStyle?.emphasis_color || globalStyle?.secondary_color || '')
                  : '',
                previewLineTexts,
                caption.imp_word_indices || [],
              ) || buildOriginalAdvancedTemplateMarkup(
                globalStyle?.template_id,
                transformText(caption.text || '', globalStyle),
                templateIndex,
                previewLineTexts,
                Number(caption.imp_word_index ?? -1),
                caption.imp_word_indices || [],
              )}</span>
            </div>
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
          if (property === 'animation-delay') return /^-?\\d*\\.?\\d+(m?s)$/i.test(value);
          if (/^--template-(?:primary|secondary|highlight|bg)$/.test(property)) {
            return /^(?:#[0-9a-f]{3,8}|transparent|rgba?\\([\\d\\s,%.]+\\))$/i.test(value);
          }
          return false;
        });
      return allowed.length ? ' style="' + allowed.join(';') + '"' : '';
    };

    const sanitizeSidebarTemplateMarkup = (markup = '', preserveInlineStyles = false) => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(String(markup), 'text/html');
      const allowedTags = new Set([
        'div', 'span', 'p', 'br', 'strong', 'em', 'b', 'i', 'u', 's',
        'small', 'mark', 'sub', 'sup',
      ]);
      const safeDataName = /^data-(?:anim|dur|type|imp|imp-cls|line-motion|line-delay|battle-motion|battle-index|lc-[a-z0-9-]+)$/i;

      for (const node of Array.from(doc.body.querySelectorAll('*'))) {
        if (!allowedTags.has(node.tagName.toLowerCase())) {
          node.remove();
          continue;
        }
        for (const attribute of Array.from(node.attributes)) {
          const name = attribute.name.toLowerCase();
          const value = String(attribute.value || '');
          if (name === 'class') {
            const cleanedClassValue = value
              .split(/\\s+/)
              .filter((className) => /^[A-Za-z0-9_-]{1,80}$/.test(className))
              .filter((className) => className && !['active', 'visible', 'anim', preserveInlineStyles ? '' : 'on', 'in'].includes(className))
              .join(' ');
            if (cleanedClassValue) node.setAttribute('class', cleanedClassValue);
            else node.removeAttribute(attribute.name);
            continue;
          }
          if (name === 'style') {
            node.removeAttribute(attribute.name);
            if (preserveInlineStyles) {
              const safeStyle = sanitizeSidebarInlineStyle(value).match(/ style="([^"]*)"/)?.[1] || '';
              if (safeStyle) node.setAttribute('style', safeStyle);
            }
            continue;
          }
          if (safeDataName.test(name) && value.length <= 240 && !/[<>]/.test(value)) {
            continue;
          }
          node.removeAttribute(attribute.name);
        }
      }
      return doc.body.innerHTML;
    };

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

    const mappedSidebarNodeValue = (sourceNodes, index, total, attrName, fallback = '') => (
      mappedSidebarClassName(
        sourceNodes.map((node) => node.getAttribute(attrName) || ''),
        index,
        total,
        fallback,
      )
    );

    const renderSidebarLcAttrs = (sourceNodes, index, total) => {
      const attrs = ['data-lc-anim', 'data-lc-duration', 'data-lc-ease', 'data-lc-delay'];
      return attrs.map((attrName) => {
        const value = mappedSidebarNodeValue(sourceNodes, index, total, attrName, '');
        return value ? ' ' + attrName + '="' + escapeHtml(value) + '"' : '';
      }).join('');
    };

    const resolveSidebarTargetImpIndex = (sourceImpIndex, sourceCount, targetCount, requestedIndex) => {
      const requested = Number(requestedIndex);
      if (Number.isFinite(requested) && requested >= 0 && requested < targetCount) {
        return requested;
      }
      if (sourceImpIndex < 0 || sourceCount <= 0 || targetCount <= 0) return -1;
      if (sourceCount === 1 || targetCount === 1) return 0;
      return Math.max(
        0,
        Math.min(
          targetCount - 1,
          Math.round((sourceImpIndex * (targetCount - 1)) / Math.max(1, sourceCount - 1)),
        ),
      );
    };

    const splitSidebarWordsForSlots = (words, slotCount) => {
      if (!words.length || !slotCount) return [];
      const slots = Array.from({ length: slotCount }, () => []);
      words.forEach((word, index) => {
        slots[Math.min(slotCount - 1, Math.floor((index * slotCount) / words.length))].push(word);
      });
      return slots.map((slot) => slot.join(' '));
    };

    const replaceSidebarWordByWord = (container, words, impWordIndex, impWordIndices = []) => {
      if (!container || !words.length) return false;
      const isNewWbw = container.classList.contains('wbw-line');
      const selector = isNewWbw ? '.wbw-word' : '.w';
      const fallback = isNewWbw ? 'wbw-word normal' : 'w';
      const sourceNodes = Array.from(container.querySelectorAll(selector));
      const sourceClasses = sourceNodes
        .map((word) => cleanSidebarClassName(word.className, fallback));
      const impPattern = /\\b(?:imp-[\\w-]+|ns[23]-[\\w-]+)\\b/;
      const sourceImpIndex = sourceClasses.findIndex((className) => impPattern.test(className));
      const impClass = sourceImpIndex >= 0 ? sourceClasses[sourceImpIndex].match(impPattern)?.[0] || '' : '';
      const fallbackImpIndex = resolveSidebarTargetImpIndex(sourceImpIndex, sourceClasses.length, words.length, impWordIndex);
      const targetImpIndices = new Set(resolveImpWordIndicesForWords(words, fallbackImpIndex, impWordIndices));
      container.innerHTML = words.map((word, index) => {
        const mapped = mappedSidebarClassName(sourceClasses, index, words.length, fallback)
          .replace(/\\b(?:imp-[\\w-]+|ns[23]-[\\w-]+)\\b/g, '')
          .replace(/\\s+/g, ' ')
          .trim();
        const isEmphasis = targetImpIndices.has(index);
        const emphasis = isEmphasis && impClass ? ' ' + impClass : '';
        return '<span data-export-caption-text="true" data-w="' + index + '" class="' + (mapped || fallback) + emphasis + (isEmphasis ? ' is-emphasis' : '') + '"' + renderSidebarLcAttrs(sourceNodes, index, words.length) + '>' + escapeHtml(word) + '</span>';
      }).join(' ');
      return true;
    };

    const replaceSidebarSticky = (container, words, impWordIndex, impWordIndices = []) => {
      const stickyWords = Array.from(container.querySelectorAll('.sw-w'));
      if (!stickyWords.length || !words.length) return false;
      const sourceClasses = stickyWords.map((word) => cleanSidebarClassName(word.className, 'sw-w'));
      const impPattern = /\\b(?:imp-[\\w-]+|ns[23]-[\\w-]+)\\b/;
      const sourceImpIndex = sourceClasses.findIndex((className) => impPattern.test(className));
      const fallbackImpIndex = resolveSidebarTargetImpIndex(sourceImpIndex, sourceClasses.length, words.length, impWordIndex);
      const targetImpIndices = new Set(resolveImpWordIndicesForWords(words, fallbackImpIndex, impWordIndices));
      container.innerHTML = words.map((word, index) => (
        '<span data-export-caption-text="true" data-w="' + index + '" class="' + mappedSidebarClassName(sourceClasses, index, words.length, 'sw-w') + (targetImpIndices.has(index) ? ' is-emphasis' : '') + '"' + renderSidebarLcAttrs(stickyWords, index, words.length) + '>' + escapeHtml(word) + '</span>'
      )).join(' ');
      return true;
    };

    const replaceSidebarLcCaptionText = (container, words, impWordIndex, impWordIndices = []) => {
      const sourceSpans = Array.from(container.querySelectorAll('.w'));
      if (!sourceSpans.length || !words.length) return false;
      const rows = Array.from(new Set(sourceSpans.map((span) => span.parentElement).filter(Boolean)));
      const sourceByRow = rows.map((row) => Array.from(row.querySelectorAll(':scope > .w')));
      const targetImpIndices = new Set(resolveImpWordIndicesForWords(words, impWordIndex, impWordIndices));
      const totalSlots = sourceByRow.reduce((sum, rowSpans) => sum + rowSpans.length, 0);
      let wordCursor = 0;

      sourceByRow.forEach((rowSpans, rowIndex) => {
        const row = rows[rowIndex];
        const remainingRows = sourceByRow.length - rowIndex - 1;
        const remainingWords = words.length - wordCursor;
        const proportional = Math.round((rowSpans.length / Math.max(1, totalSlots)) * words.length);
        const rowWordCount = rowIndex === sourceByRow.length - 1
          ? remainingWords
          : Math.max(0, Math.min(remainingWords, Math.max(1, Math.min(remainingWords - remainingRows, proportional))));
        const rowWords = words.slice(wordCursor, wordCursor + rowWordCount);
        const sourceClasses = rowSpans.map((span) => cleanSidebarClassName(span.className, 'w'));
        const sourceVisible = rowSpans.map((span) => span.classList.contains('on') && !span.getAttribute('data-lc-anim'));
        const sourceStyles = rowSpans.map((span) => String(span.getAttribute('style') || '').replace(/\\banimation\\s*:[^;]+;?/gi, '').trim());
        const sourceRowHasUnderline = rowSpans.some((span) => (
          span.matches('.ul, .ns3hero, .imp-underline')
        ));
        const createdRowSpans = [];
        row.textContent = '';
        rowWords.forEach((word, localIndex) => {
          if (localIndex > 0) row.appendChild(document.createTextNode(' '));
          const wordIndex = wordCursor + localIndex;
          const span = document.createElement('span');
          const className = mappedSidebarClassName(sourceClasses, localIndex, rowWords.length, 'w')
            .replace(/\\bis-emphasis\\b/g, '')
            .replace(/\\s+/g, ' ')
            .trim();
          span.dataset.exportCaptionText = 'true';
          span.dataset.w = String(wordIndex);
          span.className = (className || 'w')
            + (targetImpIndices.has(wordIndex) ? ' is-emphasis' : '')
            + (mappedSidebarClassName(sourceVisible, localIndex, rowWords.length, false) ? ' on' : '');
          for (const attrName of ['data-lc-anim', 'data-lc-duration', 'data-lc-ease', 'data-lc-delay']) {
            const value = mappedSidebarNodeValue(rowSpans, localIndex, rowWords.length, attrName, '');
            if (value) span.setAttribute(attrName, value);
          }
          const sourceStyle = mappedSidebarClassName(sourceStyles, localIndex, rowWords.length, '');
          if (sourceStyle) span.setAttribute('style', sourceStyle);
          span.textContent = word;
          row.appendChild(span);
          createdRowSpans.push(span);
        });
        const emphasizedRowSpans = createdRowSpans.filter((span) => span.classList.contains('is-emphasis'));
        if (sourceRowHasUnderline && emphasizedRowSpans.length >= 2) {
          emphasizedRowSpans.forEach((span) => {
            span.dataset.pairedEmphasisUnderline = 'true';
          });
        }
        wordCursor += rowWordCount;
      });
      return true;
    };

    const replaceSidebarPositioned = (block, words, impWordIndex, impWordIndices = [], forceContiguous = false) => {
      const spans = Array.from(block.querySelectorAll('.sw'));
      if (!spans.length || !words.length) return false;
      const rows = Array.from(new Set(spans.map((span) => span.parentElement).filter(Boolean)));
      const sourceByRow = rows.map((row) => Array.from(row.querySelectorAll(':scope > .sw')));
      const targetImpIndices = new Set(resolveImpWordIndicesForWords(words, impWordIndex, impWordIndices));
      if (forceContiguous && sourceByRow.length > 1) {
        const sourceClasses = spans.map((span) => cleanSidebarClassName(span.className, 'sw'));
        const sourceAnims = spans.map((span) => span.getAttribute('data-anim') || 'rise');
        const heroRowIndex = rows.findIndex((row) => /\\b(hero|l3|bold|impact)\\b/.test(row.className || ''));
        const targetRow = rows[heroRowIndex >= 0 ? heroRowIndex : rows.length - 1];
        rows.forEach((row) => { row.textContent = ''; });
        targetRow.style.paddingLeft = '0';
        targetRow.style.textAlign = 'center';
        words.forEach((word, wordIndex) => {
          if (wordIndex > 0) targetRow.appendChild(document.createTextNode(' '));
          const span = document.createElement('span');
          span.dataset.exportCaptionText = 'true';
          span.dataset.w = String(wordIndex);
          span.className = mappedSidebarClassName(sourceClasses, wordIndex, words.length, 'sw')
            + (targetImpIndices.has(wordIndex) ? ' is-emphasis' : '');
          span.dataset.anim = mappedSidebarClassName(sourceAnims, wordIndex, words.length, 'rise');
          span.textContent = word;
          targetRow.appendChild(span);
        });
        return true;
      }
      const totalSlots = sourceByRow.reduce((sum, rowSpans) => sum + rowSpans.length, 0);
      let wordCursor = 0;
      sourceByRow.forEach((rowSpans, rowIndex) => {
        const row = rows[rowIndex];
        const remainingRows = sourceByRow.length - rowIndex - 1;
        const proportional = Math.round((rowSpans.length / Math.max(1, totalSlots)) * words.length);
        const rowWordCount = rowIndex === sourceByRow.length - 1
          ? words.length - wordCursor
          : Math.max(1, Math.min(words.length - wordCursor - remainingRows, proportional));
        const rowWords = words.slice(wordCursor, wordCursor + rowWordCount);
        const sourceClasses = rowSpans.map((span) => cleanSidebarClassName(span.className, 'sw'));
        const sourceAnims = rowSpans.map((span) => span.getAttribute('data-anim') || 'rise');
        row.textContent = '';
        rowWords.forEach((word, localIndex) => {
          if (localIndex > 0) row.appendChild(document.createTextNode(' '));
          const span = document.createElement('span');
          span.dataset.exportCaptionText = 'true';
          const globalWordIndex = wordCursor + localIndex;
          span.dataset.w = String(globalWordIndex);
          span.className = mappedSidebarClassName(sourceClasses, localIndex, rowWords.length, 'sw')
            + (targetImpIndices.has(globalWordIndex) ? ' is-emphasis' : '');
          span.dataset.anim = mappedSidebarClassName(sourceAnims, localIndex, rowWords.length, 'rise');
          for (const attrName of ['data-lc-anim', 'data-lc-duration', 'data-lc-ease', 'data-lc-delay']) {
            const value = mappedSidebarNodeValue(rowSpans, localIndex, rowWords.length, attrName, '');
            if (value) span.setAttribute(attrName, value);
          }
          span.textContent = word;
          row.appendChild(span);
        });
        wordCursor += rowWordCount;
      });
      return true;
    };

    const replaceSidebarPlain = (block, words, impWordIndex, impWordIndices = []) => {
      const plain = Array.from(block.querySelectorAll('.plain-s'))
        .find((element) => !element.classList.contains('wbw') && !element.classList.contains('wbw-line'));
      if (!plain || !words.length) return false;
      plain.dataset.exportCaptionText = 'true';
      plain.textContent = '';
      const targetImpIndices = new Set(resolveImpWordIndicesForWords(words, impWordIndex, impWordIndices));
      words.forEach((word, index) => {
        if (index > 0) plain.appendChild(document.createTextNode(' '));
        const span = document.createElement('span');
        span.className = targetImpIndices.has(index) ? 'is-emphasis' : 'plain-word';
        span.dataset.exportCaptionText = 'true';
        span.dataset.w = String(index);
        span.textContent = word;
        plain.appendChild(span);
      });
      return true;
    };

    const replaceSidebarTemplateText = (block, captionText, impWordIndex, impWordIndices = [], forceContiguousPositioned = false, templateSource = '') => {
      const words = String(captionText || '').trim().split(/\\s+/).filter(Boolean);
      block.querySelectorAll('.wbw, .wbw-line').forEach((container) => replaceSidebarWordByWord(container, words, impWordIndex, impWordIndices));
      block.querySelectorAll('.sw-line').forEach((container) => replaceSidebarSticky(container, words, impWordIndex, impWordIndices));
      if (templateSource === 'lekha-lc') {
        block.querySelectorAll('.cpt, .nline').forEach((container) => replaceSidebarLcCaptionText(container, words, impWordIndex, impWordIndices));
      }
      replaceSidebarPositioned(block, words, impWordIndex, impWordIndices, forceContiguousPositioned);
      replaceSidebarPlain(block, words, impWordIndex, impWordIndices);
    };

    const getSidebarWordMotion = (word) => {
      const wordClasses = word?.classList || { contains: () => false };
      if (wordClasses.contains('imp-gold')) return { transform: 'none', opacity: '1', clipPath: 'inset(0 100% 0 0)' };
      if (wordClasses.contains('imp-underline')) return { transform: 'none', opacity: '1', clipPath: 'inset(100% 0 0 0)' };
      if (wordClasses.contains('imp-rose')) return {
        transform: 'none',
        opacity: '1',
        clipPath: 'polygon(0 0, 0 0, 0 100%, 0 100%)',
        finalClipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)',
      };
      if (wordClasses.contains('imp-space')) return { transform: 'none', opacity: '1', clipPath: 'inset(0 50% 0 50%)' };
      if (wordClasses.contains('imp-cyan')) return { transform: 'skewX(-18deg) translateX(-12px)', opacity: '0' };
      if (wordClasses.contains('imp-purple')) return { transform: 'rotateX(-90deg)', opacity: '0', origin: 'center bottom' };
      if (wordClasses.contains('imp-bold')) return { transform: 'translateY(-30px)', opacity: '0' };
      if (wordClasses.contains('imp-green')) return { transform: 'scale(0.82)', opacity: '0' };
      if (wordClasses.contains('imp-italic')) return { transform: 'translateY(-20px)', opacity: '0' };
      if (wordClasses.contains('imp-box')) return { transform: 'translate(-12px, 8px)', opacity: '0' };
      if (wordClasses.contains('imp-weight') || wordClasses.contains('imp-stamp')) return { transform: 'scale(1.3)', opacity: '0' };
      if (wordClasses.contains('imp-typewrite') || wordClasses.contains('imp-flicker')) return { transform: 'none', opacity: '0' };
      const parent = word?.parentElement;
      const classes = parent ? parent.classList : { contains: () => false };
      if (classes.contains('wrise')) return { transform: 'translateY(22px)', opacity: '0' };
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

    const fitSidebarStagger = (base, count) => {
      if (count <= 1) return 0;
      return base;
    };

    // Shared LC source schedule — serialized verbatim from
    // src/components/dashboard/templateMotionConfig.js so the exported video
    // uses the exact word delays/durations the canvas preview renders. The
    // caption-fit pass is the SAME helper the canvas runs: without it, short
    // speech captions end before the authored reveal finishes in the export.
    const getLcMotionSchedule = ${getLcMotionSchedule.toString()};
    const fitLcMotionScheduleToCaption = ${fitLcMotionScheduleToCaption.toString()};

    const chooseSidebarPhase = (blocks, elapsedMs, fallbackDuration, phaseIndex) => {
      if (!blocks.length) return { block: null, index: 0, phaseStartMs: 0 };
      const normalizedIndex = ((Number(phaseIndex || 0) % blocks.length) + blocks.length) % blocks.length;
      return {
        block: blocks[normalizedIndex],
        index: normalizedIndex,
        phaseStartMs: 0,
        duration: fallbackDuration || 3000,
      };
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
        const captionEnd = Number(shell.dataset.captionEnd || captionStart);
        const captionDurationMs = Math.max(0, (captionEnd - captionStart) * 1000);
        const phaseIndex = Number(shell.dataset.templatePhaseIndex || shell.dataset.captionIndex || 0);
        const impWordIndex = Number(shell.dataset.impWordIndex || -1);
        let impWordIndices = [];
        try {
          const parsed = JSON.parse(shell.dataset.impWordIndices || '[]');
          impWordIndices = Array.isArray(parsed) ? parsed : [];
        } catch {
          impWordIndices = [];
        }
        const templateSource = shell.dataset.templateSource || '';
        const isLcTemplateSet = templateSource === 'lekha-lc';
        const elapsedMs = Math.max(0, (time - captionStart) * 1000);
        const fallbackDuration = 3000;
        // Parity with the live preview's per-source timing. LC nodes retain the
        // authored delay/duration/easing from the original template markup.
        const wordStagger = ${SIDEBAR_TEMPLATE_WORD_STAGGER_SECONDS * 1000};
        const blocks = Array.from(shell.querySelectorAll('.sb, .sblock'));
        const dots = Array.from(shell.querySelectorAll('.dots i, .lk-dots i'));

        blocks.forEach((block) => {
          replaceSidebarTemplateText(block, captionText, impWordIndex, impWordIndices, false, templateSource);
          block.classList.remove('active');
          block.style.opacity = '0';
          block.style.visibility = 'hidden';
          block.style.zIndex = '0';
          block.querySelectorAll('.w, .wbw-word').forEach((word) => {
            const motion = getSidebarWordMotion(word);
            word.classList.remove('visible', 'anim', 'in');
            word.classList.remove('sidebar-export-word-anim', 'sidebar-export-lc-anim');
            word.style.removeProperty('animation');
            word.style.setProperty('--sidebar-export-initial-transform', motion.transform || 'none');
            word.style.setProperty('--sidebar-export-initial-opacity', motion.opacity || '0');
            word.style.setProperty('--sidebar-export-initial-clip', motion.clipPath || 'inset(0 0 0 0)');
            word.style.setProperty('--sidebar-export-final-clip', motion.finalClipPath || 'inset(0 0 0 0)');
            word.style.transformOrigin = motion.origin || '';
          });
          block.querySelectorAll('.sw').forEach((element) => {
            element.classList.remove('in', 'sidebar-export-sw-anim', 'sidebar-export-lc-anim');
            element.style.removeProperty('animation');
            const motion = getSidebarSwMotion(element);
            element.style.setProperty('--sidebar-export-initial-transform', motion.transform || 'none');
            element.style.setProperty('--sidebar-export-initial-opacity', motion.opacity || '0');
            element.style.setProperty('--sidebar-export-initial-clip', motion.clipPath || 'inset(0 0 0 0)');
            element.style.transformOrigin = motion.origin || '';
          });
          block.querySelectorAll('.sw-w').forEach((word) => {
            word.classList.remove('sidebar-export-lc-anim');
            // The 0.14 dimmed-context look belongs to the lekha-20/49 sticky
            // design. LC supporting words are fully visible on the canvas.
            word.style.opacity = isLcTemplateSet ? '' : '0.14';
          });
          block.querySelectorAll('.plainwrap, [data-lc-block-anim]').forEach((wrap) => {
            wrap.classList.remove('sidebar-export-lc-anim');
            wrap.style.removeProperty('animation');
          });
        });

        const phase = chooseSidebarPhase(blocks, elapsedMs, fallbackDuration, phaseIndex);
        if (!phase.block) return;
        phase.block.style.visibility = 'visible';
        phase.block.style.zIndex = '2';
        phase.block.style.opacity = '1';
        phase.block.classList.add('active');
        // Parity with the live preview: word colour/weight come from inheritance
        // (the shell's inline style mirrors the preview host) plus the template's
        // own class CSS. Never force them per word — that flattens the dimmed
        // context alphas (rgba support rows) and the bold hero tiers that give
        // each template its identity, and it breaks the weight-based hero
        // detection below.
        const shellStyles = getComputedStyle(shell);
        const emphasisAccent = shellStyles.getPropertyValue('--template-highlight').trim()
          || shellStyles.getPropertyValue('--sidebar-emphasis-accent').trim()
          || '#DDAA03';
        const getLcEmphasisColor = (word) => (
          isLcTemplateSet && word.closest('.ln.box')
            ? '#101114'
            : emphasisAccent
        );
        phase.block.querySelectorAll('.is-emphasis').forEach((word) => {
          const emphasisColor = getLcEmphasisColor(word);
          word.style.setProperty('font-size', 'inherit', 'important');
          word.style.setProperty('line-height', 'inherit', 'important');
          word.style.setProperty('vertical-align', 'baseline', 'important');
          word.style.setProperty('color', emphasisColor, 'important');
          word.style.setProperty('-webkit-text-fill-color', emphasisColor, 'important');
        });
        const emphasisByLine = new Map();
        phase.block.querySelectorAll('.is-emphasis').forEach((word) => {
          const line = word.parentElement || phase.block;
          const lineWords = emphasisByLine.get(line) || [];
          lineWords.push(word);
          emphasisByLine.set(line, lineWords);
        });
        let hasPairedEmphasis = false;
        emphasisByLine.forEach((lineWords) => {
          if (lineWords.length < 2) return;
          hasPairedEmphasis = true;
          const hasUnderline = lineWords.some((word) => {
            const styles = getComputedStyle(word);
            return word.matches('.ul, .ns3hero, .imp-underline')
              || styles.textDecorationLine.includes('underline')
              || (styles.borderBottomStyle !== 'none' && parseFloat(styles.borderBottomWidth) > 0);
          });
          if (hasUnderline) {
            lineWords.forEach((word) => {
              word.dataset.pairedEmphasisUnderline = 'true';
            });
          }
        });
        // Parity with the live preview (recolorEmphasisToHero in VideoPlayer.jsx):
        // the accent colour belongs on the BOLD / hero word(s) — the largest size,
        // or the heaviest weight when sizes are uniform — not the semantic
        // is-emphasis word. Detect the bold tier and move the colour there.
        (function () {
          if (hasPairedEmphasis) return;
          const heroAtoms = Array.from(phase.block.querySelectorAll('.w, .wbw-word, .sw, .sw-w'));
          if (heroAtoms.length < 2) return;
          const heroMeasure = heroAtoms.map((el) => {
            const cs = getComputedStyle(el);
            return { el: el, fs: parseFloat(cs.fontSize) || 0, fw: parseInt(cs.fontWeight, 10) || 400 };
          });
          const heroSizes = heroMeasure.map((m) => m.fs).filter((v) => v > 0);
          if (heroSizes.length < 2) return;
          const heroMaxFs = Math.max.apply(null, heroSizes);
          const heroMinFs = Math.min.apply(null, heroSizes);
          let heroPick = [];
          if (heroMaxFs >= heroMinFs * 1.18) {
            heroPick = heroMeasure.filter((m) => m.fs >= heroMaxFs - 0.5).map((m) => m.el);
          } else {
            const heroWeights = heroMeasure.map((m) => m.fw);
            const heroMaxFw = Math.max.apply(null, heroWeights);
            const heroMinFw = Math.min.apply(null, heroWeights);
            if (heroMaxFw >= 700 && heroMaxFw - heroMinFw >= 200) {
              heroPick = heroMeasure.filter((m) => m.fw >= heroMaxFw - 50).map((m) => m.el);
            }
          }
          if (!heroPick.length || heroPick.length === heroAtoms.length) return;
          // Demote exactly like the preview: drop the is-emphasis class (and the
          // inline accent set above) so the word falls back to its source-CSS
          // class colour — do NOT force the caption text colour onto it.
          heroAtoms.forEach((el) => {
            if (!el.classList.contains('is-emphasis')) return;
            el.classList.remove('is-emphasis');
            el.style.removeProperty('color');
            el.style.removeProperty('-webkit-text-fill-color');
            el.style.removeProperty('font-size');
            el.style.removeProperty('line-height');
            el.style.removeProperty('vertical-align');
          });
          heroPick.forEach((el) => {
            const emphasisColor = getLcEmphasisColor(el);
            el.style.setProperty('color', emphasisColor, 'important');
            el.style.setProperty('-webkit-text-fill-color', emphasisColor, 'important');
          });
        })();
        dots.forEach((dot, dotIndex) => {
          dot.className = dotIndex === phase.index ? 'on' : '';
        });

        // LC motion nodes use the same authored source schedule as the canvas,
        // fitted to the caption duration with the SAME shared helper the canvas
        // runs (fitLcMotionScheduleToCaption) so every word reaches its final
        // keyframe before the caption ends in the exported video too.
        if (isLcTemplateSet) {
          const lcMotionWords = Array.from(phase.block.querySelectorAll('[data-lc-anim]'));
          const lcSchedule = fitLcMotionScheduleToCaption(getLcMotionSchedule(lcMotionWords.map((word) => ({
            animation: word.dataset.lcAnim,
            duration: word.dataset.lcDuration,
            delay: word.dataset.lcDelay,
            ease: word.dataset.lcEase,
          }))), captionDurationMs);
          lcMotionWords.forEach((word, index) => {
            const entry = lcSchedule.entries[index];
            if (!entry?.animation) return;
            // Mirror the canvas: motion words carry no stale inline state — the
            // authored keyframes own opacity/transform/clip for the whole ride.
            word.style.opacity = '';
            word.style.transform = '';
            word.style.clipPath = '';
            word.style.setProperty('--sidebar-export-lc-animation', entry.animation);
            word.style.setProperty('--sidebar-export-word-duration', entry.durationMs + 'ms');
            word.style.setProperty('--sidebar-export-word-delay', (phase.phaseStartMs + entry.delayMs) + 'ms');
            word.style.setProperty('--sidebar-export-lc-ease', entry.ease);
            word.classList.add('sidebar-export-lc-anim');
          });
          // Plain scenes: the wrap fades in as one unit while its words stay
          // statically visible. Mirrors the canvas stamp in initializeLcTimeline.
          phase.block.querySelectorAll('.plainwrap').forEach((wrap) => {
            const plainEntry = fitLcMotionScheduleToCaption(getLcMotionSchedule([{
              animation: 'fade',
              duration: ${LC_TEMPLATE_TIMING.plainFadeDurationMs},
              delay: 0,
              ease: 'ease',
            }]), captionDurationMs).entries[0];
            wrap.style.setProperty('--sidebar-export-lc-animation', 'fade');
            wrap.style.setProperty('--sidebar-export-word-duration', (plainEntry?.durationMs || ${LC_TEMPLATE_TIMING.plainFadeDurationMs}) + 'ms');
            wrap.style.setProperty('--sidebar-export-word-delay', phase.phaseStartMs + 'ms');
            wrap.style.setProperty('--sidebar-export-lc-ease', 'ease');
            wrap.classList.add('sidebar-export-lc-anim');
          });
          // Whole-line 'block' scenes (LC4/LC5): the wrap carries one authored
          // animation while its words stay statically visible. Mirrors the
          // canvas stamp in VideoPlayer.jsx initializeLcTimeline.
          phase.block.querySelectorAll('[data-lc-block-anim]').forEach((wrap) => {
            const wrapSchedule = fitLcMotionScheduleToCaption(getLcMotionSchedule([{
              animation: wrap.dataset.lcBlockAnim,
              duration: wrap.dataset.lcBlockDuration,
              delay: wrap.dataset.lcBlockDelay,
              ease: wrap.dataset.lcBlockEase,
            }]), captionDurationMs);
            const wrapEntry = wrapSchedule.entries[0];
            if (!wrapEntry?.animation) return;
            wrap.style.setProperty('--sidebar-export-lc-animation', wrapEntry.animation);
            wrap.style.setProperty('--sidebar-export-word-duration', (wrapEntry.durationMs || 560) + 'ms');
            wrap.style.setProperty('--sidebar-export-word-delay', (phase.phaseStartMs + wrapEntry.delayMs) + 'ms');
            wrap.style.setProperty('--sidebar-export-lc-ease', wrapEntry.ease);
            wrap.classList.add('sidebar-export-lc-anim');
          });
        }

        phase.block.querySelectorAll('.w, .wbw-word').forEach((word, index) => {
          const lcAnim = isLcTemplateSet ? String(word.dataset.lcAnim || '').trim() : '';
          const phaseWordStagger = fitSidebarStagger(wordStagger, phase.block.querySelectorAll('.w, .wbw-word').length);
          if (lcAnim) return; // already timed by the LC motion pass above
          if (isLcTemplateSet) {
            // Parity with the canvas: every LC word without authored motion is
            // a static supporting word — visible for the whole caption, never
            // run through the legacy stagger reveal.
            word.style.animation = 'none';
            word.style.opacity = '1';
            word.style.transform = 'none';
            word.style.clipPath = 'inset(0 0 0 0)';
            word.classList.add('in', 'visible');
            return;
          }
          if (word.classList.contains('imp-flicker') || word.classList.contains('imp-typewrite')) {
            word.style.setProperty('--sidebar-export-initial-transform', 'none');
            word.style.setProperty('transform', 'none');
          }
          const duration = /\\b(imp-|ns[23]-)/.test(word.className)
            ? ${LEGACY_TEMPLATE_TIMING.wordDurationMs + 160}
            : ${LEGACY_TEMPLATE_TIMING.wordDurationMs};
          word.style.setProperty('--sidebar-export-word-duration', duration + 'ms');
          word.style.setProperty('--sidebar-export-word-delay', (phase.phaseStartMs + index * phaseWordStagger) + 'ms');
          word.classList.add('sidebar-export-word-anim');
        });
        phase.block.querySelectorAll('.sw').forEach((element, index) => {
          const lcAnim = isLcTemplateSet ? String(element.dataset.lcAnim || '').trim() : '';
          if (lcAnim) return; // already timed by the LC motion pass above
          if (isLcTemplateSet) {
            element.style.animation = 'none';
            element.style.opacity = '1';
            element.style.transform = 'none';
            element.style.clipPath = 'inset(0 0 0 0)';
            element.classList.add('in');
            return;
          }
          const phaseSwStagger = fitSidebarStagger(${SIDEBAR_TEMPLATE_POSITION_STAGGER_SECONDS * 1000}, phase.block.querySelectorAll('.sw').length);
          element.style.setProperty('--sidebar-export-word-duration', '300ms');
          element.style.setProperty('--sidebar-export-word-delay', (phase.phaseStartMs + index * phaseSwStagger) + 'ms');
          element.classList.add('sidebar-export-sw-anim');
        });
        phase.block.querySelectorAll('.sw-w').forEach((word, index) => {
          const lcAnim = isLcTemplateSet ? String(word.dataset.lcAnim || '').trim() : '';
          if (lcAnim) return; // already timed by the LC motion pass above
          if (isLcTemplateSet) {
            word.style.animation = 'none';
            word.style.opacity = '1';
            word.style.transform = 'none';
            word.style.clipPath = 'inset(0 0 0 0)';
            word.classList.add('in');
            return;
          }
          const phaseStickyStagger = fitSidebarStagger(
            ${SIDEBAR_TEMPLATE_POSITION_STAGGER_SECONDS * 1000},
            phase.block.querySelectorAll('.sw-w').length,
          );
          word.style.setProperty('--sidebar-export-word-delay', (phase.phaseStartMs + index * phaseStickyStagger) + 'ms');
          word.classList.add('sidebar-export-sticky-anim');
        });
      });
    };

    const buildSidebarTemplateMarkup = (caption, globalStyle) => {
      const appliedStyle = caption.applied_template_style || {};
      const templateSource = caption.template_source || appliedStyle.template_source || globalStyle?.template_source || '';
      const templateMarkup = sanitizeSidebarTemplateMarkup(
        caption.template_markup || appliedStyle.template_markup || globalStyle?.template_markup || '',
        templateSource === 'lekha-lc',
      );
      if (!templateMarkup) return '';
      const colorCustomizedClass = globalStyle?.template_color_customized || appliedStyle.template_color_customized
        ? ' is-color-customized'
        : '';
      return '<div class="lekha-sidebar-export-template-shell' + colorCustomizedClass + '"'
        + ' data-caption-id="' + escapeHtml(caption.id || '') + '"'
        + ' data-caption-text="' + escapeHtml(transformText(caption.text || '', globalStyle)) + '"'
        + ' data-caption-start="' + Number(caption.start_time || 0) + '"'
        + ' data-caption-end="' + Number(caption.end_time || caption.start_time || 0) + '"'
        + ' data-caption-index="' + Number(caption.__templateIndex || 0) + '"'
        + ' data-template-phase-index="' + Number(caption.__templateIndex ?? caption.template_phase_index ?? 0) + '"'
        + ' data-imp-word-index="' + Number(caption.imp_word_index ?? -1) + '"'
        + ' data-imp-word-indices="' + escapeHtml(JSON.stringify(normalizeImpWordIndices(caption.imp_word_index, caption.imp_word_indices || []))) + '"'
        + ' data-emphasis-color="' + escapeHtml(caption.emphasis_color || '') + '"'
        + ' data-caption-font-weight="' + escapeHtml(globalStyle?.font_weight || appliedStyle.font_weight || '400') + '"'
        + ' data-caption-text-color="' + escapeHtml(globalStyle?.text_color || appliedStyle.text_color || '#FFFFFF') + '"'
        + ' data-template-source="' + escapeHtml(templateSource) + '"'
        + ' data-template-complex-script="' + (usesComplexTemplateScript(caption.text || '') ? 'true' : 'false') + '"'
        + ' style="--sidebar-source-font:\\'' + escapeHtml(globalStyle?.font_family || appliedStyle.font_family || 'Inter') + '\\';'
        + '--sidebar-emphasis-accent:' + escapeHtml((() => {
          const configured = String(caption.emphasis_color || globalStyle?.highlight_color || globalStyle?.emphasis_color || globalStyle?.secondary_color || appliedStyle.highlight_color || appliedStyle.emphasis_color || appliedStyle.secondary_color || '').trim();
          const textColor = String(globalStyle?.text_color || appliedStyle.text_color || '#FFFFFF').trim();
          return configured && configured.toLowerCase() !== textColor.toLowerCase() ? configured : '#DDAA03';
        })()) + ';'
        + '--sidebar-template-highlight:' + escapeHtml(caption.emphasis_color || globalStyle?.highlight_color || globalStyle?.emphasis_color || globalStyle?.secondary_color || appliedStyle.highlight_color || appliedStyle.emphasis_color || appliedStyle.secondary_color || '#DDAA03') + ';'
        + '--template-primary:' + escapeHtml(globalStyle?.text_color || appliedStyle.text_color || '#FFFFFF') + ';'
        + '--template-secondary:' + escapeHtml(globalStyle?.secondary_color || appliedStyle.secondary_color || '#DDAA03') + ';'
        + '--template-highlight:' + escapeHtml(caption.emphasis_color || globalStyle?.highlight_color || globalStyle?.emphasis_color || globalStyle?.secondary_color || appliedStyle.highlight_color || appliedStyle.emphasis_color || appliedStyle.secondary_color || '#DDAA03') + ';'
        + '--template-text-gradient:' + escapeHtml(globalStyle?.text_gradient || appliedStyle.text_gradient || 'none') + ';'
        + '--template-highlight-gradient:' + escapeHtml(globalStyle?.highlight_gradient || appliedStyle.highlight_gradient || 'none') + ';'
        + '--template-karaoke-1:' + escapeHtml(globalStyle?.karaoke_color_1 || globalStyle?.highlight_color || globalStyle?.emphasis_color || globalStyle?.secondary_color || appliedStyle.karaoke_color_1 || appliedStyle.highlight_color || appliedStyle.emphasis_color || appliedStyle.secondary_color || '#DDAA03') + ';'
        + '--template-karaoke-2:' + escapeHtml(globalStyle?.karaoke_color_2 || appliedStyle.karaoke_color_2 || '#22D3EE') + ';'
        + '--template-karaoke-3:' + escapeHtml(globalStyle?.karaoke_color_3 || appliedStyle.karaoke_color_3 || '#FB923C') + ';'
        + 'font-family:\\'' + escapeHtml(globalStyle?.font_family || appliedStyle.font_family || 'Inter') + '\\';'
        + 'font-size:' + scaleExportPx(globalStyle?.font_size || appliedStyle.font_size || 22) + 'px;'
        + 'font-weight:' + escapeHtml(globalStyle?.font_weight || appliedStyle.font_weight || '300') + ';'
        // Mirror the preview host's inline style so inherited text properties
        // resolve identically in both renderers.
        + 'color:' + escapeHtml(appliedStyle.text_color ? (globalStyle?.text_color || appliedStyle.text_color) : (globalStyle?.text_color || '#FFFFFF')) + ';'
        + 'font-style:' + escapeHtml(globalStyle?.font_style || appliedStyle.font_style || 'normal') + ';'
        + 'line-height:' + escapeHtml(String(appliedStyle.line_spacing ? (globalStyle?.line_spacing || appliedStyle.line_spacing) : (globalStyle?.line_spacing || 1.25))) + ';'
        + 'opacity:' + escapeHtml(String(templateSource === 'lekha-lc' ? 1 : (globalStyle?.text_opacity ?? appliedStyle.text_opacity ?? 1))) + ';"'
        + '>' + templateMarkup + '</div>';
    };

    const buildPlainCaptionMarkup = (caption, globalStyle, time) => {
      const words = buildWordMeta(caption);
      const currentIndex = getCurrentWordIndex(caption, time);
      const showInactive = globalStyle?.show_inactive !== false;
      const wordSpacing = \`\${scaleExportPx((globalStyle?.word_spacing ?? 1) * 2)}px\`;

      const isCptCaption = captionHasCptWords(caption);
      const renderPlainWord = (word, index, isLastInLine = false) => {
        if (!showInactive && index > currentIndex) return '';
        const wordStyle = word.style || {};
        const inline = [
          isCptCaption && index > currentIndex ? 'opacity:0' : '',
          'display:inline-block',
          'position:relative',
          \`font-family:"\${wordStyle.fontFamily || globalStyle?.font_family || 'Inter'}"\`,
          \`font-size:\${scaleExportPx((wordStyle.fontSize ?? globalStyle?.font_size ?? 18) * (wordStyle.isEmphasis ? 1.2 : 1))}px\`,
          \`font-weight:\${wordStyle.fontWeight || (wordStyle.isEmphasis ? '700' : (globalStyle?.font_weight || '500'))}\`,
          \`font-style:\${wordStyle.fontStyle || globalStyle?.font_style || 'normal'}\`,
          \`color:\${wordStyle.color || (wordStyle.isEmphasis ? (globalStyle?.highlight_color || globalStyle?.secondary_color) : '') || globalStyle?.text_color || '#ffffff'}\`,
          wordStyle.textDecoration ? \`text-decoration:\${wordStyle.textDecoration}\` : '',
          wordStyle.textTransform ? \`text-transform:\${wordStyle.textTransform}\` : '',
          !isLastInLine ? \`margin-right:\${wordSpacing}\` : '',
        ].filter(Boolean);
        if (globalStyle?.has_stroke) inline.push(\`-webkit-text-stroke:\${globalStyle.stroke_width ?? 1}px \${globalStyle.stroke_color || '#000000'}\`);
        if (globalStyle?.has_shadow) inline.push(\`text-shadow:\${globalStyle.shadow_offset_x ?? 0}px \${globalStyle.shadow_offset_y ?? 2}px \${globalStyle.shadow_blur ?? 4}px \${globalStyle.shadow_color || '#000000'}\`);
        if (wordStyle.isEmphasis && !globalStyle?.has_shadow) {
          const accent = globalStyle?.highlight_color || globalStyle?.secondary_color || '#DDAA03';
          inline.push(\`text-shadow:0 0 18px \${accent}99,0 0 6px \${accent}66\`);
        }
        const wordGradient = wordStyle.textGradient || globalStyle?.text_gradient || '';
        if (wordGradient) {
          inline.push(\`background:\${wordGradient}\`);
          inline.push('background-clip:text;-webkit-background-clip:text;color:transparent;-webkit-text-fill-color:transparent');
        }
        if (wordStyle.backgroundColor || wordStyle.highlightGradient) {
          inline.push(\`background:\${wordStyle.highlightGradient || rgbaFromHex(wordStyle.backgroundColor, wordStyle.backgroundOpacity ?? 0.6)}\`);
          inline.push(\`padding:\${scaleExportPx(wordStyle.backgroundPadding ?? 2)}px \${scaleExportPx((wordStyle.backgroundPadding ?? 2) * 2)}px\`);
          inline.push('border-radius:4px');
        }
        Object.entries(getWordEffectInlineStyles(wordStyle)).forEach(([property, value]) => inline.push(\`\${property}:\${value}\`));
        return \`<span data-word-key="\${word.key}" style="\${inline.join(';')}">\${escapeHtml(transformText(word.text, globalStyle))}</span>\`;
      };

      let wordCursor = 0;
      const sourceLines = String(caption.text || '')
        .replace(/\\r\\n/g, '\\n')
        .split('\\n')
        .map((line) => line.trim().split(/\\s+/).filter(Boolean));
      const wordMarkup = sourceLines.map((lineWords) => {
        if (!lineWords.length) return '<span style="display:block;min-height:1em"></span>';
        const lineMarkup = lineWords.map((_, lineWordIndex) => {
          const word = words[wordCursor];
          wordCursor += 1;
          return word ? renderPlainWord(word, wordCursor - 1, lineWordIndex === lineWords.length - 1) : '';
        }).filter(Boolean).join('');
        return \`<span style="display:block">\${lineMarkup}</span>\`;
      }).join('');

      const lineAnimation = isCptCaption
        ? 'none'
        : getLineAnimationStyle(caption.animation, caption.animation_speed || 1);
      const captionEffect = inlineStyleObject(getCaptionEffectInlineStyles(globalStyle));
      const captionBackground = globalStyle?.has_background
        ? \`background:\${rgbaFromHex(globalStyle.background_color || '#000000', globalStyle.background_opacity ?? 0.7)};padding:\${scaleExportPx(globalStyle.background_padding ?? 6)}px \${scaleExportPx((globalStyle.background_padding ?? 6) * 2)}px;border-radius:\${scaleExportPx(8)}px;\`
        : globalStyle?.highlight_gradient
          ? \`background:\${globalStyle.highlight_gradient};\`
          : globalStyle?.highlight_color
            ? \`background:\${globalStyle.highlight_color};\`
            : '';
      const captionGradient = \`color:\${globalStyle?.text_color || '#ffffff'};\`;
      const captionBoxWidth = Number(globalStyle?.box_width || 0);

      return \`
        <div class="plain-caption-shell caption-line-animation-shell" data-caption-start="\${Number(caption.start_time ?? 0)}" data-caption-end="\${Number(caption.end_time ?? caption.start_time ?? 0)}" style="display:inline-block;\${captionBoxWidth > 0 ? \`width:\${scaleExportPx(captionBoxWidth)}px;\` : ''}animation:\${lineAnimation};transform-origin:center center;">
          <span class="cap-text" style="
            display:inline-block;
            \${captionBoxWidth > 0 ? 'width:100%;' : ''}
            font-family:'\${globalStyle?.font_family || 'Inter'}';
            font-size:\${scaleExportPx(globalStyle?.font_size ?? 18)}px;
            font-weight:\${globalStyle?.font_weight || '500'};
            font-style:\${globalStyle?.font_style || 'normal'};
            text-align:\${globalStyle?.text_align || 'center'};
            line-height:\${scaleExportPx((globalStyle?.font_size ?? 18) * (globalStyle?.line_spacing ?? 1.4))}px;
            letter-spacing:\${scaleExportPx(globalStyle?.letter_spacing ?? 0)}px;
            text-decoration:\${globalStyle?.text_decoration || 'none'};
            text-transform:\${globalStyle?.text_case || 'none'};
            opacity:\${globalStyle?.text_opacity ?? 1};
            transform:scale(\${globalStyle?.scale ?? 1});
            white-space:pre-wrap;
            overflow-wrap:anywhere;
            \${captionBackground}
            \${captionEffect}
          "><span class="cap-text-content" style="\${captionGradient}">\${wordMarkup}</span></span>
        </div>
      \`;
    };

    const buildTextElementMarkup = (caption, renderIndex) => {
      const custom = caption.custom_style || {};
      let wordIndex = 0;
      const wordMarkup = String(caption.text || '').split(/(\\s+)/).map((part) => {
        if (!part) return '';
        if (/^\\s+$/.test(part)) return escapeHtml(part).replace(/\\n/g, '<br/>');
        const key = \`\${caption.id}-\${wordIndex}\`;
        wordIndex += 1;
        const gradientStyle = custom.text_gradient
          ? \`background:\${custom.text_gradient};background-image:\${custom.text_gradient};background-clip:text;-webkit-background-clip:text;color:transparent;-webkit-text-fill-color:transparent;\`
          : '';
        return \`<span data-word-key="\${escapeHtml(key)}" style="\${gradientStyle}">\${escapeHtml(part)}</span>\`;
      }).join('');
      const lineAnimation = getLineAnimationStyle(caption.animation, caption.animation_speed || 1);
      const textGradient = \`color:\${custom.text_color || '#ffffff'};\`;
      const effectStyle = inlineStyleObject(getCaptionEffectInlineStyles(custom));
      return \`
        <div class="text-element-shell" data-caption-render-index="\${renderIndex}" style="
          position:absolute;
          left:\${custom.position_x ?? 50}%;
          top:\${custom.position_y ?? 50}%;
          transform:translate(-50%, -50%) rotate(\${custom.rotation ?? 0}deg);
          text-align:\${custom.text_align || 'center'};
          width:\${scaleExportPx(custom.width ?? 300)}px;
          z-index:\${custom.z_index ?? 50};
          pointer-events:none;
        ">
          <span class="caption-line-animation-shell" data-caption-start="\${Number(caption.start_time ?? 0)}" data-caption-end="\${Number(caption.end_time ?? caption.start_time ?? 0)}" style="
            display:block;
            width:100%;
            animation:\${lineAnimation};
            transform-origin:center center;
          ">
          <span class="text-element-content" style="
            display:block;
            width:100%;
            white-space:pre-wrap;
            font-family:'\${custom.font_family || 'Inter'}';
            font-size:\${scaleExportPx(custom.font_size ?? 18)}px;
            font-weight:\${custom.font_weight || '500'};
            font-style:\${custom.font_style || 'normal'};
            text-decoration:\${custom.text_decoration || 'none'};
            text-transform:\${custom.text_transform || 'none'};
            letter-spacing:\${scaleExportPx(custom.letter_spacing ?? 0)}px;
            word-spacing:\${scaleExportPx(custom.word_spacing ?? 0)}px;
            line-height:\${custom.line_spacing ?? 1.4};
            opacity:\${custom.text_opacity ?? 1};
            transform:scale(\${custom.scale ?? 1});
            transform-origin:center center;
            word-break:break-all;
            \${custom.has_background ? \`background:\${rgbaFromHex(custom.background_color || '#000000', custom.background_opacity ?? 0.6)};padding:\${scaleExportPx(custom.background_padding ?? custom.padding ?? 8)}px;border-radius:\${scaleExportPx(custom.border_radius ?? 6)}px;\` : ''}
            \${custom.has_stroke ? \`-webkit-text-stroke:\${scaleExportPx(custom.stroke_width ?? 1)}px \${custom.stroke_color || '#000000'};\` : ''}
            \${custom.has_shadow ? \`text-shadow:\${scaleExportPx(custom.shadow_offset_x ?? 0)}px \${scaleExportPx(custom.shadow_offset_y ?? 2)}px \${scaleExportPx(custom.shadow_blur ?? 4)}px \${custom.shadow_color || '#000000'};\` : ''}
            \${effectStyle}
          "><span class="text-element-text" style="\${textGradient}">\${wordMarkup}</span></span></span>
        </div>
      \`;
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

    const normalizeLineText = (value) => String(value || '').replace(/\\s+/g, ' ').trim();

    const collectStyledLineTokens = (container) => {
      const tokens = [];
      const impPattern = /\\b(?:imp-[\\w-]+|is-emphasis)\\b/;
      const visit = (node, inheritedClassName = '') => {
        if (node.nodeType === 3) {
          String(node.nodeValue || '').split(/\\s+/).filter(Boolean).forEach((word) => {
            tokens.push({ text: word, className: inheritedClassName });
          });
          return;
        }
        if (node.nodeType !== 1) return;
        const className = String(node.className || '');
        const nextClassName = impPattern.test(className)
          ? className
          : inheritedClassName;
        Array.from(node.childNodes || []).forEach((child) => visit(child, nextClassName));
      };
      visit(container);
      return tokens;
    };

    const applyPreviewTextLineBreaks = (container, lineTexts) => {
      const tokens = collectStyledLineTokens(container);
      if (!tokens.length) return;
      const requestedWords = lineTexts.flatMap((line) => line.split(/\\s+/).filter(Boolean));
      if (requestedWords.length !== tokens.length) return;
      const sameWords = requestedWords.every((word, index) => word === normalizeLineText(tokens[index]?.text));
      if (!sameWords) return;

      const fragment = document.createDocumentFragment();
      let cursor = 0;
      lineTexts.forEach((lineText) => {
        const line = document.createElement('span');
        line.className = 'lekha-template-preview-line';
        const lineWords = lineText.split(/\\s+/).filter(Boolean);
        lineWords.forEach((_, lineWordIndex) => {
          const token = tokens[cursor];
          if (!token) return;
          if (lineWordIndex > 0) line.appendChild(document.createTextNode(' '));
          if (token.className) {
            const span = document.createElement('span');
            span.className = token.className;
            span.textContent = token.text;
            line.appendChild(span);
          } else {
            line.appendChild(document.createTextNode(token.text));
          }
          cursor += 1;
        });
        fragment.appendChild(line);
      });
      container.classList.add('lekha-template-preview-lines');
      container.replaceChildren(fragment);
    };

    const applyPreviewTemplateLineBreaks = (root, style) => {
      const lineTexts = Array.isArray(style?.preview_template_line_texts)
        ? style.preview_template_line_texts.map(normalizeLineText).filter(Boolean)
        : [];
      if (!lineTexts.length) return;
      const textContainers = Array.from(root.querySelectorAll(
        '.lekha-original-template .hand-txt, '
        + '.lekha-original-template .soft-rise, '
        + '.lekha-original-template .slow-rise',
      ));
      textContainers.forEach((container) => applyPreviewTextLineBreaks(container, lineTexts));

      const containers = Array.from(root.querySelectorAll(
        '.lekha-original-template .kf-line, '
        + '.lekha-original-template .wbw-rise, '
        + '.lekha-original-template .wbw-slide, '
        + '.lekha-original-template .wbw-seq, '
        + '.lekha-original-template .wbw-seq-fade, '
        + '.lekha-original-template .wbw-seq-flip',
      ));
      containers.forEach((container) => {
        const words = Array.from(container.querySelectorAll('.w, .kf-word'));
        if (!words.length) return;
        const existingTexts = words.map((word) => normalizeLineText(word.textContent));
        const requestedWords = lineTexts.flatMap((line) => line.split(/\\s+/).filter(Boolean));
        if (requestedWords.length !== words.length) return;
        const sameWords = requestedWords.every((word, index) => word === existingTexts[index]);
        if (!sameWords) return;

        const fragment = document.createDocumentFragment();
        let cursor = 0;
        lineTexts.forEach((lineText) => {
          const line = document.createElement('span');
          line.className = 'lekha-template-preview-line';
          const lineWords = lineText.split(/\\s+/).filter(Boolean);
          lineWords.forEach((_, lineWordIndex) => {
            if (!words[cursor]) return;
            if (lineWordIndex > 0) line.appendChild(document.createTextNode(' '));
            line.appendChild(words[cursor]);
            cursor += 1;
          });
          fragment.appendChild(line);
        });
        container.classList.add('lekha-template-preview-lines');
        container.replaceChildren(fragment);
      });
    };

    const syncTemplateExportScale = () => {};

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
      const resolveCaptionTemplateStyle = (caption) => {
        if (!caption || caption.is_text_element) return style;
        const appliedStyle = caption.applied_template_style || {};
        const captionTemplateId = String(caption.template_id || appliedStyle.template_id || '').trim();
        const globalTemplateId = String(style.template_id || '').trim();
        const globalStyleMatchesTemplate = !captionTemplateId
          || !globalTemplateId
          || captionTemplateId === globalTemplateId;
        const mergedStyle = globalStyleMatchesTemplate
          ? { ...appliedStyle, ...style }
          : { ...style, ...appliedStyle };
        return {
          ...mergedStyle,
          template_id: caption.template_id || mergedStyle.template_id || '',
          template_20_id: caption.template_20_id || mergedStyle.template_20_id || '',
          template_source: caption.template_source || mergedStyle.template_source || '',
          template_class: caption.template_class || mergedStyle.template_class || '',
          template_name: caption.template_name || mergedStyle.template_name || '',
          template_layout: caption.template_layout || mergedStyle.template_layout || '',
          template_effect: caption.template_effect || mergedStyle.template_effect || '',
          template_markup: caption.template_markup || mergedStyle.template_markup || '',
          text_color: caption.text_color || mergedStyle.text_color || '#ffffff',
          text_gradient: caption.text_gradient || mergedStyle.text_gradient || '',
          secondary_color: caption.secondary_color || mergedStyle.secondary_color || '',
          highlight_color: caption.highlight_color || mergedStyle.highlight_color || '',
          highlight_gradient: caption.highlight_gradient || mergedStyle.highlight_gradient || '',
          emphasis_color: caption.emphasis_color || mergedStyle.emphasis_color || '',
          karaoke_color_1: caption.karaoke_color_1 || mergedStyle.karaoke_color_1 || '',
          karaoke_color_2: caption.karaoke_color_2 || mergedStyle.karaoke_color_2 || '',
          karaoke_color_3: caption.karaoke_color_3 || mergedStyle.karaoke_color_3 || '',
          preview_template_font_px: Number(
            caption.preview_template_font_px
            || mergedStyle.preview_template_font_px
            || 0,
          ),
          preview_template_box_width_px: Number(
            caption.preview_template_box_width_px
            || mergedStyle.preview_template_box_width_px
            || 0,
          ),
          preview_template_box_height_px: Number(
            caption.preview_template_box_height_px
            || mergedStyle.preview_template_box_height_px
            || 0,
          ),
          template_color_customized: Boolean(
            caption.template_color_customized
            || mergedStyle.template_color_customized
            || caption.text_gradient
            || mergedStyle.text_gradient
            || caption.highlight_gradient
            || mergedStyle.highlight_gradient
          ),
        };
      };
      const activeCaptions = (payload.captions || []).filter((caption) => {
        const start = Number(caption.start_time ?? 0);
        const end = Number(caption.end_time ?? start);
        return time >= start && time < end;
      });

      root.innerHTML = activeCaptions.map((caption, activeIndex) => {
        if (caption.is_text_element) return buildTextElementMarkup(caption, activeIndex);
        const templateCaptionIndex = Math.max(
          0,
          (payload.captions || [])
            .filter((item) => item && !item.is_text_element)
            .findIndex((item) => item.id === caption.id),
        );
        const captionWithTemplateIndex = {
          ...caption,
          __templateIndex: Number.isFinite(Number(caption.__templateIndex))
            ? Number(caption.__templateIndex)
            : templateCaptionIndex,
        };
        const renderStyle = resolveCaptionTemplateStyle(captionWithTemplateIndex);
        const left = renderStyle.position_x ?? style.position_x ?? 50;
        const top = renderStyle.position_y ?? style.position_y ?? 75;
        const isSidebarTemplate = Boolean(renderStyle.template_20_id);
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
              \`text-align:\${renderStyle.text_align || style.text_align || 'center'}\`,
            ]
          : [
              'position:absolute',
              \`left:\${left}%\`,
              \`top:\${top}%\`,
              'transform:translate(-50%, -50%)',
              'pointer-events:none',
              'width:max-content',
              'max-width:90%',
              \`text-align:\${renderStyle.text_align || style.text_align || 'center'}\`,
            ];
        const isBasicTemplate = Boolean(
          window.__basicTpl
          && window.__basicTpl.isSourceBasicTemplateId
          && window.__basicTpl.isSourceBasicTemplateId(renderStyle.template_id),
        );
        const inner = isSidebarTemplate
          ? buildSidebarTemplateMarkup(captionWithTemplateIndex, renderStyle)
          : isBasicTemplate
          ? buildBasicTemplateCaptionMarkup(captionWithTemplateIndex, renderStyle, time)
          : renderStyle.template_id
          ? buildTemplateMarkup(captionWithTemplateIndex, renderStyle, time)
          : buildPlainCaptionMarkup(captionWithTemplateIndex, renderStyle, time);
        const shouldWrapTemplateAnimation = Boolean(
          renderStyle.template_id
          && !captionHasCptWords(caption)
          && caption.animation
          && caption.animation !== 'none',
        );
        const animatedInner = shouldWrapTemplateAnimation
          ? \`<div class="caption-line-animation-shell" data-caption-start="\${Number(caption.start_time ?? 0)}" data-caption-end="\${Number(caption.end_time ?? caption.start_time ?? 0)}" style="display:inline-block;animation:\${getLineAnimationStyle(caption.animation, caption.animation_speed || 1)};transform-origin:center center;">\${inner}</div>\`
          : inner;
        return \`<div class="caption-anchor" data-caption-render-index="\${activeIndex}" style="\${base.join(';')}">\${animatedInner}</div>\`;
      }).join('');
      activeCaptions.forEach((caption, activeIndex) => {
        const anchor = root.querySelector(\`[data-caption-render-index="\${activeIndex}"]\`);
        if (!anchor) return;
        const templateCaptionIndex = Math.max(
          0,
          (payload.captions || [])
            .filter((item) => item && !item.is_text_element)
            .findIndex((item) => item.id === caption.id),
        );
        const captionWithTemplateIndex = {
          ...caption,
          __templateIndex: Number.isFinite(Number(caption.__templateIndex))
            ? Number(caption.__templateIndex)
            : templateCaptionIndex,
        };
        const renderStyle = resolveCaptionTemplateStyle(captionWithTemplateIndex);
        applySourceTemplateScriptFonts(anchor, captionWithTemplateIndex.__export_script);
        applySourceTemplateWordStyles(anchor, captionWithTemplateIndex, time);
        const captionLineTexts = Array.isArray(caption?.preview_template_line_texts)
          && caption.preview_template_line_texts.length > 0
          ? caption.preview_template_line_texts
          : style.preview_template_line_texts;
        const renderedTemplateId = String(renderStyle?.template_id || '').trim();
        const shouldReplayPreviewLineBreaks =
          !recreatedAdvancedTemplateIds.has(renderedTemplateId)
          || renderedTemplateId === 't24'
          || renderedTemplateId === 't25'
          || renderedTemplateId === 't29';
        if (shouldReplayPreviewLineBreaks) {
          applyPreviewTemplateLineBreaks(anchor, {
            ...style,
            preview_template_line_texts: captionLineTexts,
          });
        }
      });
      activateSidebarTemplateShells(root, time);
      activateBasicTemplates(root);
      activeCaptions.forEach((caption, activeIndex) => {
        const anchor = root.querySelector(\`[data-caption-render-index="\${activeIndex}"]\`);
        if (!anchor || caption?.is_text_element) return;
        applySourceTemplateScriptFonts(anchor, caption.__export_script);
        applySourceTemplateWordStyles(anchor, caption, time);
      });
    };
  `;
}

async function main() {
  const payloadPath = process.argv[2];
  if (!payloadPath) {
    throw new Error('Missing payload JSON path');
  }

  const payload = JSON.parse((await fs.readFile(payloadPath, 'utf8')).replace(/^\uFEFF/, ''));
  const canonicalEmphasisByCaptionId = new Map(
    buildEmotionalCaptionPlan(
      payload.captions || [],
      payload.waveform_data || [],
      payload.duration || 0,
      payload.style?.template_markup || payload.style?.template_snapshot?.template_markup || '',
    ).map((entry) => [String(entry.captionId), entry]),
  );
  (payload.captions || []).forEach((caption) => {
    if (caption) caption.__export_script = detectScript(caption.text || '');
    if (!caption || caption.is_text_element) return;
    const canonical = canonicalEmphasisByCaptionId.get(String(caption.id));
    if (!canonical) return;
    const appliedStyle = caption.applied_template_style || payload.style || {};
    const templateEmphasisColor = appliedStyle.highlight_color
      || appliedStyle.emphasis_color
      || appliedStyle.secondary_color
      || payload.style?.highlight_color
      || payload.style?.emphasis_color
      || payload.style?.secondary_color
      || canonical.emphasisColor
      || '';
    caption.imp_word_index = canonical.impWordIndex;
    caption.imp_word_indices = canonical.impWordIndices || (
      Number.isFinite(Number(canonical.impWordIndex)) && Number(canonical.impWordIndex) >= 0
        ? [Number(canonical.impWordIndex)]
        : []
    );
    caption.emphasis_color = templateEmphasisColor;
  });
  const firstTemplateCaption = (payload.captions || []).find((caption) => (
    !caption?.is_text_element
    && (
      caption?.template_id
      || caption?.template_20_id
      || caption?.applied_template_style?.template_id
      || caption?.applied_template_style?.template_20_id
    )
  ));
  const captionTemplateStyle = firstTemplateCaption
    ? {
        ...(firstTemplateCaption.applied_template_style || {}),
        template_id: firstTemplateCaption.template_id
          || firstTemplateCaption.applied_template_style?.template_id
          || '',
        template_20_id: firstTemplateCaption.template_20_id
          || firstTemplateCaption.applied_template_style?.template_20_id
          || '',
        template_source: firstTemplateCaption.template_source
          || firstTemplateCaption.applied_template_style?.template_source
          || '',
        template_name: firstTemplateCaption.template_name
          || firstTemplateCaption.applied_template_style?.template_name
          || '',
        template_class: firstTemplateCaption.template_class
          || firstTemplateCaption.applied_template_style?.template_class
          || '',
        template_layout: firstTemplateCaption.template_layout
          || firstTemplateCaption.applied_template_style?.template_layout
          || '',
        template_effect: firstTemplateCaption.template_effect
          || firstTemplateCaption.applied_template_style?.template_effect
          || '',
        template_markup: firstTemplateCaption.template_markup
          || firstTemplateCaption.applied_template_style?.template_markup
          || '',
      }
    : {};
  const payloadStyle = payload.style || {};
  const styleSnapshot = payloadStyle.template_snapshot || {};
  const captionTemplateId = String(
    captionTemplateStyle.template_id || captionTemplateStyle.template_20_id || '',
  ).trim();
  const payloadTemplateId = String(
    payloadStyle.template_id || payloadStyle.template_20_id || '',
  ).trim();
  const globalStyleMatchesCaption = !captionTemplateId
    || !payloadTemplateId
    || captionTemplateId === payloadTemplateId;
  const resolvedStyle = globalStyleMatchesCaption
    ? { ...captionTemplateStyle, ...styleSnapshot, ...payloadStyle }
    : { ...payloadStyle, ...styleSnapshot, ...captionTemplateStyle };
  [
    'template_id',
    'template_20_id',
    'template_source',
    'template_name',
    'template_class',
    'template_layout',
    'template_effect',
    'template_markup',
  ].forEach((key) => {
    resolvedStyle[key] = resolvedStyle[key] || '';
  });
  payload.style = resolvedStyle;
  const outputDir = payload.output_dir || path.join(projectRoot, 'tmp-overlay');
  await fs.mkdir(outputDir, { recursive: true });
  const shouldAuditWordPositions = process.env.TEMPLATE_OVERLAY_POSITION_AUDIT === '1';

  const captionCss = await fs.readFile(path.join(projectRoot, 'src', 'styles', 'captionTemplates.css'), 'utf8');
  const advancedCaptionCss = await fs.readFile(path.join(projectRoot, 'src', 'styles', 'captionTemplatesAdvanced.css'), 'utf8');
  const originalTemplateHtml = await fs.readFile(path.join(projectRoot, 'src', 'assets', 'lekha-captions-T11-T35.html'), 'utf8');
  const originalTemplateCss = extractOriginalTemplateRuntimeCss(originalTemplateHtml);
  const advancedTemplateBlockMarkup = buildAdvancedTemplateBlockMarkupMap(
    originalTemplateHtml,
    ORIGINAL_TEMPLATE_BLOCK_TYPES,
  );

  // Right-side "Basic" templates (Iman, Green Neon Pulse, 3D Shadow, …) render
  // in the preview through their authored `.btcard` source markup. Render the
  // SAME markup here so the burned video matches the canvas. The builder is
  // shared (basicTemplateInline.js) and injected into the page so the per-frame
  // word injection runs through the exact preview code path.
  const basicTemplateIdsInUse = new Set(
    [
      payload.style?.template_id,
      ...(payload.captions || []).flatMap((caption) => [
        caption?.template_id,
        caption?.applied_template_style?.template_id,
      ]),
    ]
      .map((id) => String(id || '').trim())
      .filter((id) => isSourceBasicTemplateId(id)),
  );
  const hasBasicTemplate = basicTemplateIdsInUse.size > 0;
  const basicTemplateMarkupMap = {};
  for (const templateId of basicTemplateIdsInUse) {
    basicTemplateMarkupMap[templateId] = findAppliedBasicTemplateMarkup(
      originalTemplateHtml,
      { template_id: templateId },
    );
  }
  const basicTemplateInlineSource = hasBasicTemplate
    ? (await fs.readFile(
        path.join(projectRoot, 'src', 'components', 'dashboard', 'basicTemplateInline.js'),
        'utf8',
      ))
        // Convert the ES module to a classic page script: drop the `export`
        // keyword from every declaration. The trailing `window.__basicTpl`
        // assignment then exposes the builder to the per-frame render loop.
        .replace(/^\s*export\s+/gm, '')
    : '';
  const hasSidebarTemplate = Boolean(payload.style?.template_20_id);
  const sidebarTemplateHtml = hasSidebarTemplate
    ? await fs.readFile(path.join(projectRoot, 'src', 'assets', payload.style?.template_source === 'lekha-lc'
      ? 'lekha-captions-lc-2.html'
      : 'lekha-captions-20-templates.html'), 'utf8')
    : '';
  const sidebarTemplateCss = hasSidebarTemplate
    ? payload.style?.template_source === 'lekha-lc'
      ? [
          await fs.readFile(path.join(projectRoot, 'src', 'assets', 'lekha-captions-lc-2.html'), 'utf8'),
          await fs.readFile(path.join(projectRoot, 'src', 'assets', 'lekha-captions-lc-3.html'), 'utf8'),
          await fs.readFile(path.join(projectRoot, 'src', 'assets', 'lekha-captions-lc-4.html'), 'utf8'),
          await fs.readFile(path.join(projectRoot, 'src', 'assets', 'lekha-captions-lc-5.html'), 'utf8'),
        ].map(extractHtmlStyle).join('\n')
      : extractHtmlStyle(sidebarTemplateHtml)
    : '';
  const previewWidth = Number(payload.style?.preview_width || 0);
  const exportCssScale = Math.max(1, Math.min(8, Number(payload.video_width || 360) / (previewWidth || 360)));
  const hasAdvancedTemplate = isAdvancedTemplateId(payload.style?.template_id);
  const fallbackAdvancedPreviewBox = estimateAdvancedPreviewTemplateBox(payload, previewWidth);
  const measuredPreviewTemplateBoxWidthPx = Number(payload.style?.preview_template_box_width_px || 0);
  const measuredPreviewTemplateBoxHeightPx = Number(payload.style?.preview_template_box_height_px || 0);
  const previewTemplateBoxWidthPx = measuredPreviewTemplateBoxWidthPx
    || fallbackAdvancedPreviewBox.width;
  const previewTemplateBoxHeightPx = measuredPreviewTemplateBoxHeightPx
    || fallbackAdvancedPreviewBox.height;
  const measuredPreviewTemplateFontPx = Number(payload.style?.preview_template_font_px || 0);
  const configuredTemplateFontPx = Number(payload.style?.font_size || 0);
  const previewTemplateFontFloorPx = configuredTemplateFontPx > 0
    ? Math.max(12, Math.round(configuredTemplateFontPx * 0.88))
    : 0;
  const previewTemplateFontPx = measuredPreviewTemplateFontPx > 0
    ? measuredPreviewTemplateFontPx
    : previewTemplateFontFloorPx;
  const fallbackTemplateFontPx = hasAdvancedTemplate
    ? Number(payload.style?.font_size || 0)
    : 0;
  const exportTemplateBoxTargetWidthPx = previewTemplateBoxWidthPx > 0
    ? previewTemplateBoxWidthPx * exportCssScale
    : 0;
  const exportTemplateBoxTargetHeightPx = previewTemplateBoxHeightPx > 0
    ? previewTemplateBoxHeightPx * exportCssScale
    : 0;
  const exportTemplateFontTargetPx = (previewTemplateFontPx > 0 ? previewTemplateFontPx : fallbackTemplateFontPx) > 0
    ? (previewTemplateFontPx > 0 ? previewTemplateFontPx : fallbackTemplateFontPx) * exportCssScale
    : 0;
  const exportAdvancedTemplateFontPx = Math.max(
    12,
    Math.round(exportTemplateFontTargetPx || scaleTemplateFontSize(payload.style?.font_size || 22) * exportCssScale),
  );
  const exportRootFontSize = Math.round(16 * exportCssScale);
  const exportTemplateMaxWidth = Math.round(360 * exportCssScale);
  const exportMeasuredAdvancedTemplateWidthPx = hasAdvancedTemplate && measuredPreviewTemplateBoxWidthPx > 0
    ? Math.max(1, Math.round(measuredPreviewTemplateBoxWidthPx * exportCssScale))
    : 0;
  const exportT24TemplateMaxWidthPx = exportMeasuredAdvancedTemplateWidthPx
    || Math.round(Math.min(exportTemplateMaxWidth, 260 * exportCssScale));
  const exportSidebarWidth = Math.round(Math.max(160, Math.min(Number(payload.video_width || 360) * 0.94, 320 * exportCssScale)));
  const sourceTemplateFontFamilies = new Set();
  const fontFamilyPattern = /font-family\s*:\s*([^;}{]+)/gi;
  const templateFontSources = [
    captionCss,
    advancedCaptionCss,
    originalTemplateCss,
    sidebarTemplateCss,
    ...Object.values(basicTemplateMarkupMap),
  ];
  templateFontSources.forEach((source) => {
    let match;
    fontFamilyPattern.lastIndex = 0;
    while ((match = fontFamilyPattern.exec(String(source || '')))) {
      const family = String(match[1] || '')
        .split(',')[0]
        .replace(/(?:&#39;|&quot;|["'])/gi, '')
        .trim();
      if (
        family
        && !/^(?:inherit|initial|unset|var\(|sans-serif|serif|monospace|cursive)/i.test(family)
      ) {
        sourceTemplateFontFamilies.add(family);
      }
    }
  });
  const scriptSamples = new Map();
  (payload.captions || []).forEach((caption) => {
    const script = caption?.__export_script || 'latin';
    if (script !== 'latin' && !scriptSamples.has(script)) {
      scriptSamples.set(script, String(caption?.text || ''));
    }
  });
  const exportScriptFontMaps = {};
  scriptSamples.forEach((sampleText, script) => {
    const families = {};
    sourceTemplateFontFamilies.forEach((fontFamily) => {
      families[fontFamily] = resolveScriptFontFamily(fontFamily, sampleText);
    });
    exportScriptFontMaps[script] = {
      fallback: resolveScriptFontFamily('', sampleText),
      families,
    };
  });
  const exportFontFamilies = new Set([
    payload.style?.font_family,
    ...(payload.captions || []).flatMap((caption) => [
      caption?.applied_template_style?.font_family,
      caption?.custom_style?.font_family,
    ]),
    ...Object.values(exportScriptFontMaps).flatMap((config) => [
      config.fallback,
      ...Object.values(config.families),
    ]),
  ].filter(Boolean));
  const exportFontQuery = [...exportFontFamilies]
    .map((fontFamily) => `family=${encodeURIComponent(String(fontFamily)).replace(/%20/g, '+')}`)
    .join('&');
  const exportFontLinks = exportFontQuery
    ? `<link href="https://fonts.googleapis.com/css2?${exportFontQuery}&display=swap" rel="stylesheet">`
    : '';
  console.log(`[Template DOM] sizing preview_width=${previewWidth || 'missing'} video_width=${payload.video_width} css_scale=${exportCssScale.toFixed(4)} target_box=${exportTemplateBoxTargetWidthPx ? `${exportTemplateBoxTargetWidthPx.toFixed(2)}x${exportTemplateBoxTargetHeightPx.toFixed(2)}` : 'auto'}`);
  const runtimeCss = `
    ${sidebarTemplateCss}
    ${ADVANCED_TEMPLATE_RUNTIME_CSS}

    html, body {
      margin: 0;
      width: 100%;
      height: 100%;
      background: transparent !important;
      overflow: hidden;
      font-size: ${exportRootFontSize}px;
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
      display: inline-block;
      width: ${exportSidebarWidth}px;
      height: auto;
      max-width: 94%;
      min-height: 0;
      /* Preview never crops the applied template (matras, descenders, entrance
         motion all paint freely) — keep the export shell unclipped to match. */
      overflow: visible;
      background: transparent !important;
      pointer-events: none;
      color: #fff;
    }
    .lekha-sidebar-export-template-shell .card,
    .lekha-sidebar-export-template-shell .lk-card {
      display: block !important;
      width: 100% !important;
      height: auto !important;
      min-height: 0 !important;
      aspect-ratio: auto !important;
      border: 0 !important;
      border-radius: 0 !important;
      box-shadow: none !important;
      background: transparent !important;
      overflow: visible !important;
      padding: 0 !important;
      margin: 0 !important;
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
      height: auto !important;
      min-height: 0 !important;
      aspect-ratio: auto !important;
      border: 0 !important;
      box-shadow: none !important;
      background: transparent !important;
      overflow: visible !important;
      padding: 0 !important;
      margin: 0 !important;
    }
    .lekha-sidebar-export-template-shell .lc-card .stage {
      height: auto !important;
      aspect-ratio: auto !important;
    }
    .lekha-sidebar-export-template-shell[data-template-source="lekha-lc"] {
      height: auto !important;
      min-height: 0 !important;
    }
    .lekha-sidebar-export-template-shell .lc-card .stage::after {
      content: none !important;
      display: none !important;
      box-shadow: none !important;
      background: transparent !important;
    }
    .lekha-sidebar-export-template-shell .lc-card .sb {
      position: relative !important;
      inset: auto !important;
    }
    .lekha-sidebar-export-template-shell.is-color-customized .lc-card .sb {
      --template-highlight: var(--sidebar-template-highlight, var(--sidebar-emphasis-accent, #DDAA03)) !important;
    }
    .lekha-sidebar-export-template-shell .lc-card .sb:not(.active) {
      position: absolute !important;
      visibility: hidden !important;
      opacity: 0 !important;
    }
    .lekha-sidebar-export-template-shell .lc-card .cap {
      position: relative !important;
      left: auto !important;
      top: auto !important;
      transform: none !important;
      width: 100% !important;
      max-width: 100% !important;
      text-align: center !important;
    }
    .lekha-sidebar-export-template-shell .lc-card .scene,
    .lekha-sidebar-export-template-shell .lc-card .cpt,
    .lekha-sidebar-export-template-shell .lc-card .nline,
    .lekha-sidebar-export-template-shell .lc-card .plain-s {
      width: fit-content !important;
      max-width: 100% !important;
      margin-left: auto !important;
      margin-right: auto !important;
    }
    .lekha-sidebar-export-template-shell .card[class] .stage,
    .lekha-sidebar-export-template-shell .lk-card[class] .lk-stage {
      background: transparent !important;
      box-shadow: none !important;
    }
    .lekha-sidebar-export-template-shell .sw,
    .lekha-sidebar-export-template-shell .wbw-word,
    .lekha-sidebar-export-template-shell .sw-w,
    .lekha-sidebar-export-template-shell .w,
    .lekha-sidebar-export-template-shell .plain-s,
    .lekha-sidebar-export-template-shell .wbw,
    .lekha-sidebar-export-template-shell .wbw-line,
    .lekha-sidebar-export-template-shell [class^='pos'],
    .lekha-sidebar-export-template-shell [class*=' pos'] {
      font-family: var(--sidebar-source-font, inherit) !important;
    }
    .lekha-sidebar-export-template-shell .sw,
    .lekha-sidebar-export-template-shell .wbw-word,
    .lekha-sidebar-export-template-shell .sw-w,
    .lekha-sidebar-export-template-shell .w,
    .lekha-sidebar-export-template-shell .plain-s,
    .lekha-sidebar-export-template-shell .wbw,
    .lekha-sidebar-export-template-shell .wbw-line,
    .lekha-sidebar-export-template-shell [class^='pos'],
    .lekha-sidebar-export-template-shell [class*=' pos'] {
      font-size: inherit !important;
      line-height: inherit !important;
    }
    .lekha-sidebar-export-template-shell .sb,
    .lekha-sidebar-export-template-shell .sblock {
      position: relative !important;
      inset: auto !important;
      width: 100% !important;
      height: auto !important;
      min-height: 0 !important;
      padding: 0 !important;
      margin: 0 auto !important;
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
      overflow: visible !important;
      padding-block: 0.18em;
      margin-block: 0;
    }
    .lekha-sidebar-export-template-shell .w:not(:last-child),
    .lekha-sidebar-export-template-shell .wbw-word:not(:last-child),
    .lekha-sidebar-export-template-shell .sw:not(:last-child),
    .lekha-sidebar-export-template-shell .sw-w:not(:last-child) {
      margin-inline-end: 0.12em;
    }
    /* Flow word-lines laid out with flex/grid drop the literal space between word
       spans (whitespace-only text nodes are not flex items), so Devanagari words
       touched. A column gap restores spacing and is inert on non-flex lines.
       Mirrors the preview fix in VideoPlayer.jsx so export matches the canvas. */
    .lekha-sidebar-export-template-shell .wbw,
    .lekha-sidebar-export-template-shell .wbw-line,
    .lekha-sidebar-export-template-shell .sw-line {
      column-gap: 0.28em;
    }
    .lekha-sidebar-export-template-shell .is-emphasis {
      display: inline-block !important;
      font-size: inherit !important;
      line-height: inherit !important;
      vertical-align: baseline !important;
      color: var(--sidebar-emphasis-accent, #DDAA03) !important;
      -webkit-text-fill-color: var(--sidebar-emphasis-accent, #DDAA03) !important;
    }
    .lekha-sidebar-export-template-shell [data-paired-emphasis-underline='true'] {
      border-bottom: 0.055em solid currentColor !important;
      padding-bottom: 0.05em !important;
    }
    .lekha-sidebar-export-template-shell .lc-card .sb .hero,
    .lekha-sidebar-export-template-shell .lc-card .sb .is-emphasis,
    .lekha-sidebar-export-template-shell .lc-card .sb .ns3hero,
    .lekha-sidebar-export-template-shell .lc-card .sb .ns3box,
    .lekha-sidebar-export-template-shell .lc-card .sb .ns3mark,
    .lekha-sidebar-export-template-shell .lc-card .sb .ns3bracket,
    .lekha-sidebar-export-template-shell .lc-card .sb .ns3dot,
    .lekha-sidebar-export-template-shell .lc-card .sb [data-hero-emphasis='true'] {
      color: var(--template-highlight, var(--lc-scene-highlight, var(--sidebar-emphasis-accent, #DDAA03))) !important;
      -webkit-text-fill-color: var(--template-highlight, var(--lc-scene-highlight, var(--sidebar-emphasis-accent, #DDAA03))) !important;
      filter: saturate(1.35) brightness(1.12);
      font-weight: 900;
    }
    .lekha-sidebar-export-template-shell[data-template-complex-script='true'] .lc-card .cpt.dropcap > .ln:first-child {
      position: relative !important;
      top: 0.18em !important;
    }
    .lekha-sidebar-export-template-shell[data-template-complex-script='true'] .lc-card .ns3box {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      line-height: 1.05 !important;
      padding-block: 0.12em 0.04em !important;
      vertical-align: middle !important;
      box-sizing: border-box !important;
    }
    .lekha-sidebar-export-template-shell[data-template-complex-script='true'] .lc-card .cpt .ln.box {
      display: inline-flex !important;
      flex-wrap: wrap !important;
      align-items: center !important;
      justify-content: center !important;
      line-height: 1.16 !important;
      padding-block: 0.14em 0.06em !important;
      vertical-align: middle !important;
      box-sizing: border-box !important;
    }
    .lekha-sidebar-export-template-shell .lc-card .cpt {
      --hc: var(--template-highlight, var(--lc-scene-highlight, var(--sidebar-emphasis-accent, #DDAA03))) !important;
    }
    .lekha-sidebar-export-template-shell .lc-card .sb .box {
      background: var(--template-highlight, var(--lc-scene-highlight, var(--sidebar-emphasis-accent, #DDAA03))) !important;
      color: #101114 !important;
      -webkit-text-fill-color: #101114 !important;
    }
    .lekha-sidebar-export-template-shell .lc-card .sb .box .sw,
    .lekha-sidebar-export-template-shell .lc-card .sb .box .hero {
      color: #101114 !important;
      -webkit-text-fill-color: #101114 !important;
    }
    .lekha-sidebar-export-template-shell .stage .w[class*='imp-'],
    .lekha-sidebar-export-template-shell .stage .w[class*='ns2-'],
    .lekha-sidebar-export-template-shell .stage .w[class*='ns3-'],
    .lekha-sidebar-export-template-shell .stage .wbw-word[class*='imp-'],
    .lekha-sidebar-export-template-shell .stage .wbw-word[class*='ns2-'],
    .lekha-sidebar-export-template-shell .stage .wbw-word[class*='ns3-'] {
      display: inline-block !important;
      font-size: inherit !important;
      line-height: inherit !important;
      overflow: visible !important;
      padding-block: 0.18em !important;
      vertical-align: baseline !important;
    }
    .lekha-sidebar-export-template-shell .sidebar-export-word-anim,
    .lekha-sidebar-export-template-shell .sidebar-export-sw-anim {
      animation-name: lekhaSidebarExportWordIn;
      animation-duration: var(--sidebar-export-word-duration, 280ms);
      animation-delay: var(--sidebar-export-word-delay, 0ms);
      animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
      animation-fill-mode: both;
      animation-play-state: running;
    }
    .lekha-sidebar-export-template-shell .imp-flicker.sidebar-export-word-anim {
      animation-name: lekhaSidebarExportFlicker;
    }
    .lekha-sidebar-export-template-shell .sidebar-export-lc-anim {
      animation-name: var(--sidebar-export-lc-animation, fade);
      animation-duration: var(--sidebar-export-word-duration, 180ms);
      animation-delay: var(--sidebar-export-word-delay, 0ms);
      animation-timing-function: var(--sidebar-export-lc-ease, cubic-bezier(.22,.68,.26,1));
      animation-fill-mode: both;
      animation-play-state: running;
    }
    .lekha-sidebar-export-template-shell .sidebar-export-sticky-anim {
      animation: lekhaSidebarExportStickyIn ${LEGACY_TEMPLATE_TIMING.positionedWordDurationMs}ms cubic-bezier(0.22, 1, 0.36, 1) both;
      animation-delay: var(--sidebar-export-word-delay, 0ms);
    }
    /* Scoped to the contexts this rule was written for (plain captions + the
       right-side original templates). It must NOT leak into the sidebar template
       shells: their source CSS lays .plain-s/.wbw out as plain text flow
       (line-height 1.55–1.7), and inline-flex drops the whitespace text nodes
       around the .is-emphasis span — words touch and lines compress vs preview. */
    .cap-text,
    .lekha-original-template .plain-s,
    .lekha-original-template .wbw-rise,
    .lekha-original-template .wbw-slide {
      display: inline-flex;
      flex-wrap: wrap;
      justify-content: center;
      align-items: center;
      column-gap: 0.24em;
      row-gap: 0.08em;
      line-height: 1.2;
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
      width: ${exportMeasuredAdvancedTemplateWidthPx ? `${exportMeasuredAdvancedTemplateWidthPx}px` : 'auto'};
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
      max-width: 100% !important;
    }
    .lekha-original-template .lekha-applied-advanced-template {
      font-size: ${exportAdvancedTemplateFontPx}px;
    }
    .lekha-original-template .lekha-template-fit {
      display: inline-block;
      max-width: 100%;
    }
    .lekha-original-template:is(
      .t11-stage,
      .t13-stage,
      .t16-stage,
      .t17-stage,
      .t24-stage
    ) .wbw-rise,
    .lekha-original-template:is(
      .t11-stage,
      .t13-stage,
      .t16-stage,
      .t17-stage,
      .t24-stage
    ) .wbw-slide,
    .lekha-original-template:is(
      .t11-stage,
      .t13-stage,
      .t16-stage,
      .t17-stage,
      .t24-stage
    ) .wbw-seq-fade {
      flex-wrap: nowrap !important;
      white-space: nowrap !important;
    }
    .lekha-original-template.t29-stage .lekha-applied-advanced-template,
    .lekha-original-template.t29-stage .lekha-template-fit {
      max-width: min(84vw, 11.5em) !important;
      white-space: normal !important;
      overflow-wrap: anywhere !important;
      word-break: normal !important;
      line-height: 1.12 !important;
      font-size: min(${exportAdvancedTemplateFontPx}px, 26px) !important;
    }
    .lekha-original-template.t29-stage .wbw-rise,
    .lekha-original-template.t29-stage .wbw-slide {
      flex-wrap: wrap !important;
      row-gap: 0.04em !important;
    }
    .lekha-original-template .wbw-rise,
    .lekha-original-template .wbw-slide,
    .lekha-original-template .wbw-seq,
    .lekha-original-template .wbw-seq-fade,
    .lekha-original-template .wbw-seq-flip {
      max-width: 100%;
      white-space: normal;
    }
    .lekha-original-template .lekha-template-preview-lines {
      display: block !important;
      text-align: center !important;
      line-height: 1.2 !important;
    }
    .lekha-original-template .lekha-template-preview-line {
      display: block !important;
      white-space: nowrap !important;
      text-align: center !important;
    }
    .lekha-original-template .cluster-wrap {
      align-items: stretch;
    }
    .lekha-original-template.t11-stage .lekha-applied-advanced-template,
    .lekha-original-template.t11-stage .lekha-template-fit,
    .lekha-original-template.t11-stage .lekha-template-preview-lines,
    .lekha-original-template.t11-stage .lekha-template-preview-line,
    .lekha-original-template.t11-stage .wbw-rise,
    .lekha-original-template.t11-stage .wbw-slide,
    .lekha-original-template.t11-stage .wbw-seq-fade,
    .lekha-original-template.t11-stage .w,
    .lekha-original-template.t11-stage .cluster-row-top,
    .lekha-original-template.t11-stage .cluster-row-bot,
    .lekha-original-template.t11-stage .cluster-hl,
    .lekha-original-template.t11-stage .blur-txt {
      font-size: 1em !important;
      line-height: 1.28 !important;
    }

    .lekha-original-template.t11-stage .t11-b0 .cluster-row-top,
    .lekha-original-template.t11-stage .t11-b0 .cluster-row-bot,
    .lekha-original-template.t11-stage .t11-b1,
    .lekha-original-template.t11-stage .t11-b1 .blur-txt,
    .lekha-original-template.t11-stage .t11-b2,
    .lekha-original-template.t11-stage .t11-b2 .lekha-template-fit,
    .lekha-original-template.t11-stage .t11-b3 .w.in:not([data-imp='true']) {
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      opacity: 1 !important;
    }
    .lekha-original-template.t13-stage .t13-b0 .slide-crash,
    .lekha-original-template.t13-stage .t13-b1 .ticker-txt,
    .lekha-original-template.t13-stage .w.in {
      font-family: 'IBM Plex Mono', monospace !important;
      font-weight: 700 !important;
      color: #f97316 !important;
      -webkit-text-fill-color: #f97316 !important;
      opacity: 1 !important;
    }
    .lekha-original-template.t13-stage .t13-b2 .w.in:not([data-imp='true']),
    .lekha-original-template.t13-stage .t13-b3 .w.in:not([data-imp='true']) {
      color: #f97316 !important;
      -webkit-text-fill-color: #f97316 !important;
      opacity: 1 !important;
    }
    .lekha-original-template.t13-stage .imp-cyan,
    .lekha-original-template.t13-stage .imp-bold,
    .lekha-original-template.t13-stage .w.in[data-imp='true'],
    .lekha-original-template.t13-stage .w[data-hero-emphasis='true'],
    .lekha-original-template.t13-stage .slide-crash .is-emphasis,
    .lekha-original-template.t13-stage .ticker-txt .is-emphasis {
      font-weight: 900 !important;
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      opacity: 1 !important;
      text-shadow: 0 0 12px rgba(255,255,255,0.35) !important;
    }
    .lekha-original-template.t13-stage .lekha-applied-advanced-template,
    .lekha-original-template.t13-stage .lekha-template-fit,
    .lekha-original-template.t13-stage .wbw-rise,
    .lekha-original-template.t13-stage .wbw-slide,
    .lekha-original-template.t13-stage .wbw-seq-fade,
    .lekha-original-template.t13-stage .t13-b0 .slide-crash,
    .lekha-original-template.t13-stage .t13-b1 .ticker-txt {
      display: inline-flex !important;
      flex-wrap: wrap !important;
      justify-content: center !important;
      align-items: center !important;
      max-width: min(100%, 13.5em) !important;
      white-space: normal !important;
      overflow-wrap: normal !important;
      word-break: normal !important;
      line-height: 1.2 !important;
      letter-spacing: 0.02em !important;
      text-align: center !important;
      margin-left: auto !important;
      margin-right: auto !important;
    }
    .lekha-original-template.t13-stage .t13-b0 .slide-crash.t13-compact-line,
    .lekha-original-template.t13-stage .t13-b1 .ticker-txt.t13-compact-line {
      max-width: min(100%, 12em) !important;
      overflow-wrap: anywhere !important;
      word-break: break-word !important;
      text-transform: none !important;
    }
    .lekha-original-template.t13-stage .t13-b0 .slide-crash.t13-compact-line {
      font-size: 1.12rem !important;
    }
    .lekha-original-template.t13-stage .t13-b1 .ticker-txt.t13-compact-line {
      font-size: 0.98rem !important;
    }
    .lekha-original-template.t15-stage .lekha-applied-advanced-template,
    .lekha-original-template.t15-stage .lekha-template-fit,
    .lekha-original-template.t15-stage .shake-in,
    .lekha-original-template.t15-stage .pop-txt,
    .lekha-original-template.t15-stage .wbw-rise,
    .lekha-original-template.t15-stage .wbw-seq-fade,
    .lekha-original-template.t15-stage .w.in {
      font-size: ${Math.max(14, Math.round(exportAdvancedTemplateFontPx * 0.88))}px !important;
      line-height: 1.28 !important;
    }
    .lekha-original-template.t15-stage .shake-in > br {
      display: block !important;
      content: '' !important;
    }
    .lekha-original-template.t35-stage .lekha-applied-advanced-template,
    .lekha-original-template.t35-stage .lekha-template-fit,
    .lekha-original-template.t35-stage .secret-txt {
      display: inline-block !important;
      max-width: min(100%, 12.5em) !important;
      white-space: normal !important;
      overflow-wrap: anywhere !important;
      word-break: normal !important;
      line-height: 1.22 !important;
      text-align: center !important;
    }
    .lekha-original-template.t14-stage .t14-block,
    .lekha-original-template.t14-stage .t14-b0 .flip-line,
    .lekha-original-template.t14-stage .t14-b1 .drop-txt,
    .lekha-original-template.t14-stage .t14-b2,
    .lekha-original-template.t14-stage .t14-b2 span,
    .lekha-original-template.t14-stage .t14-b3 .w.in:not([data-imp='true']) {
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      opacity: 1 !important;
    }
    .lekha-original-template.t14-stage .t14-block,
    .lekha-original-template.t14-stage .t14-b0,
    .lekha-original-template.t14-stage .t14-b1,
    .lekha-original-template.t14-stage .t14-b2,
    .lekha-original-template.t14-stage .t14-b3 {
      font-size: ${exportAdvancedTemplateFontPx}px !important;
      line-height: 1.38 !important;
    }
    .lekha-original-template.t16-stage .t16-block,
    .lekha-original-template.t16-stage .neon-line,
    .lekha-original-template.t16-stage .wbw-rise,
    .lekha-original-template.t16-stage .wbw-slide {
      font-size: ${exportAdvancedTemplateFontPx}px !important;
      line-height: 1.3 !important;
    }
    .lekha-original-template:is(
      .t11-stage,
      .t13-stage,
      .t14-stage,
      .t16-stage,
      .t17-stage,
      .t18-stage,
      .t19-stage,
      .t22-stage,
      .t24-stage,
      .t25-stage,
      .t26-stage,
      .t27-stage,
      .t29-stage,
      .t31-stage,
      .t33-stage,
      .t34-stage
    ) .lekha-template-fit:not(.t13-compact-line),
    .lekha-original-template:is(
      .t11-stage,
      .t13-stage,
      .t14-stage,
      .t16-stage,
      .t17-stage,
      .t18-stage,
      .t19-stage,
      .t22-stage,
      .t24-stage,
      .t25-stage,
      .t26-stage,
      .t27-stage,
      .t29-stage,
      .t31-stage,
      .t33-stage,
      .t34-stage
    ) .w.in,
    .lekha-original-template:is(
      .t22-stage,
      .t24-stage,
      .t33-stage
    ) .kf-line,
    .lekha-original-template.t15-stage .shake-in,
    .lekha-original-template.t22-stage .wave-txt,
    .lekha-original-template.t24-stage .redact-wrap,
    .lekha-original-template.t25-stage .hand-txt,
    .lekha-original-template.t25-stage .soft-rise,
    .lekha-original-template.t26-stage .hard-txt,
    .lekha-original-template.t26-stage .fast-slide,
    .lekha-original-template.t29-stage .battle-slide,
    .lekha-original-template.t29-stage .hard-rise,
    .lekha-original-template.t31-stage .stamp-text,
    .lekha-original-template.t33-stage .doc-line,
    .lekha-original-template.t34-stage .pow-txt {
      font-size: ${exportAdvancedTemplateFontPx}px !important;
      line-height: 1.32 !important;
    }
    .lekha-original-template.t15-stage .lekha-applied-advanced-template,
    .lekha-original-template.t15-stage .lekha-template-fit,
    .lekha-original-template.t15-stage .shake-in,
    .lekha-original-template.t15-stage .pop-txt,
    .lekha-original-template.t15-stage .wbw-rise,
    .lekha-original-template.t15-stage .wbw-seq-fade,
    .lekha-original-template.t15-stage .w.in {
      font-size: ${Math.max(14, Math.round(exportAdvancedTemplateFontPx * 0.88))}px !important;
      line-height: 1.28 !important;
    }
    .lekha-original-template .wbw-rise .w,
    .lekha-original-template .wbw-slide .w,
    .lekha-original-template .wbw-seq .w,
    .lekha-original-template .wbw-seq-fade .w {
      opacity: 0;
      display: inline-block;
      transition: none;
    }
    .lekha-original-template .wbw-rise .w,
    .lekha-original-template .wbw-seq .w,
    .lekha-original-template .wbw-seq-fade .w {
      transform: translateY(20px);
    }
    .lekha-original-template .wbw-slide .w {
      transform: translateX(-16px);
    }
    .lekha-original-template .active .wbw-rise .w.in,
    .lekha-original-template .active .wbw-slide .w.in,
    .lekha-original-template .active .wbw-seq .w.in,
    .lekha-original-template .active .wbw-seq-fade .w.in {
      animation: lekhaTemplateWbwIn 320ms cubic-bezier(0.34, 1.2, 0.64, 1) forwards;
      animation-delay: var(--wbw-delay, 0ms);
    }
    .lekha-original-template .active .wbw-rise .w[data-imp='true'].in,
    .lekha-original-template .active .wbw-slide .w[data-imp='true'].in,
    .lekha-original-template .active .wbw-seq .w[data-imp='true'].in,
    .lekha-original-template .active .wbw-seq-fade .w[data-imp='true'].in {
      animation-duration: 440ms;
    }
    .lekha-original-template.t29-stage .battle-sweep-left .w {
      transform: translateX(-34px);
    }
    .lekha-original-template.t29-stage .battle-lift-up .w {
      transform: translateY(28px);
    }
    .lekha-original-template.t29-stage .active .battle-sweep-left .w.in,
    .lekha-original-template.t29-stage .active .battle-lift-up .w.in {
      animation: lekhaTemplateWbwIn 360ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
      animation-delay: var(--wbw-delay, 0ms);
    }
    .lekha-original-template.t29-stage .active .battle-sweep-left .w[data-imp='true'].in,
    .lekha-original-template.t29-stage .active .battle-lift-up .w[data-imp='true'].in {
      animation-duration: 400ms;
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
    .lekha-original-template .is-emphasis {
      color: var(--template-secondary, var(--gold)) !important;
      -webkit-text-fill-color: currentColor !important;
      font-weight: 900;
      text-shadow: 0 0 14px color-mix(in srgb, currentColor 48%, transparent);
    }
    .lekha-original-template.t14-stage .imp-gold,
    .lekha-original-template.t14-stage .is-emphasis {
      color: #D4AF37 !important;
      -webkit-text-fill-color: #D4AF37 !important;
      opacity: 1 !important;
      text-shadow: 0 1px 8px rgba(0,0,0,0.55), 0 0 14px rgba(212,175,55,0.36) !important;
    }
    .lekha-original-template.t14-stage .imp-underline {
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      position: relative !important;
      opacity: 1 !important;
    }
    .lekha-original-template.t14-stage .imp-underline::after {
      content: '' !important;
      position: absolute !important;
      left: 0 !important;
      bottom: -2px !important;
      width: 100% !important;
      height: max(2px, 0.08em) !important;
      background: #D4AF37 !important;
      display: block !important;
      opacity: 1 !important;
      clip-path: inset(0 0 0 0) !important;
    }
    .lekha-original-template.t38-stage .imp-underline,
    .lekha-original-template.t38-stage .w[data-imp='true'].imp-underline {
      position: relative !important;
      display: inline-block !important;
      font-weight: 900 !important;
      color: var(--template-secondary, var(--gold, #d4af37)) !important;
      -webkit-text-fill-color: currentColor !important;
      text-shadow: 0 0 14px color-mix(in srgb, currentColor 48%, transparent) !important;
      overflow: visible !important;
    }
    .lekha-original-template.t38-stage .imp-underline::after,
    .lekha-original-template.t38-stage .w[data-imp='true'].imp-underline::after {
      content: '' !important;
      position: absolute !important;
      left: 0 !important;
      bottom: -2px !important;
      width: 100% !important;
      height: max(2px, 0.08em) !important;
      background: var(--gold, #d4af37) !important;
      display: block !important;
      opacity: 1 !important;
      clip-path: inset(0 0 0 0) !important;
    }
    .lekha-original-template.t16-stage .t16-block,
    .lekha-original-template.t16-stage .neon-line {
      color: var(--cyan) !important;
      -webkit-text-fill-color: var(--cyan) !important;
      opacity: 1 !important;
    }
    .lekha-original-template.t16-stage .wbw-rise .w,
    .lekha-original-template.t16-stage .wbw-slide .w {
      color: var(--cyan) !important;
      -webkit-text-fill-color: var(--cyan) !important;
    }
    .lekha-original-template.t16-stage .w[data-imp='true'],
    .lekha-original-template.t16-stage .imp-bold,
    .lekha-original-template.t16-stage .is-emphasis {
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
    }
    .lekha-original-template.t16-stage .imp-bold:not(.w),
    .lekha-original-template.t16-stage .is-emphasis:not(.w) {
      opacity: 1 !important;
    }
    .lekha-original-template.t12-stage .imp-purple {
      color: var(--rose) !important;
      -webkit-text-fill-color: var(--rose) !important;
    }
    .lekha-original-template.t15-stage .t15-block,
    .lekha-original-template.t15-stage .shake-in,
    .lekha-original-template.t15-stage .pop-txt,
    .lekha-original-template.t15-stage .w.in:not([data-imp='true']) {
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      opacity: 1 !important;
    }
    .lekha-original-template.t15-stage .imp-rose,
    .lekha-original-template.t15-stage .imp-bold,
    .lekha-original-template.t15-stage .w.in[data-imp='true'],
    .lekha-original-template.t15-stage .w[data-hero-emphasis='true'] {
      color: var(--rose) !important;
      -webkit-text-fill-color: var(--rose) !important;
      opacity: 1 !important;
    }
    .lekha-original-template.t15-stage .shake-in {
      line-height: 1.48 !important;
    }
    .lekha-original-template.t17-stage .t17-block,
    .lekha-original-template.t17-stage .t17-b2 .lekha-template-fit,
    .lekha-original-template.t17-stage .w.in:not([data-imp='true']) {
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      opacity: 1 !important;
    }
    .lekha-original-template.t17-stage .glitch-wrap,
    .lekha-original-template.t17-stage .t17-b0 .lekha-template-fit,
    .lekha-original-template.t17-stage .t17-b2 .lekha-template-fit,
    .lekha-original-template.t17-stage .wbw-rise .w.in,
    .lekha-original-template.t17-stage .wbw-slide .w.in,
    .lekha-original-template.t17-stage .wbw-seq-fade .w.in {
      font-size: max(${exportAdvancedTemplateFontPx}px, 20px) !important;
      line-height: 1.32 !important;
    }
    .lekha-original-template.t17-stage .imp-flicker,
    .lekha-original-template.t17-stage .w.in[data-imp='true'],
    .lekha-original-template.t17-stage .w[data-hero-emphasis='true'] {
      color: #ff3d71 !important;
      -webkit-text-fill-color: #ff3d71 !important;
      opacity: 1 !important;
    }
    .lekha-original-template.t17-stage .letter-snap-blk,
    .lekha-original-template.t17-stage .snap-txt {
      opacity: 1 !important;
      filter: none !important;
    }
    .lekha-original-template.t17-stage .snap-txt,
    .lekha-original-template.t17-stage .snap-txt * {
      color: #ff3d71 !important;
      -webkit-text-fill-color: #ff3d71 !important;
      text-shadow: 0 1px 8px rgba(0,0,0,0.82), 0 0 2px rgba(0,0,0,0.92), 0 0 16px rgba(255,61,113,0.22) !important;
    }
    .lekha-original-template.t18-stage .imp-purple {
      color: var(--gold) !important;
      -webkit-text-fill-color: var(--gold) !important;
    }
    .lekha-original-template.t18-stage .t18-block {
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      opacity: 1 !important;
      text-align: center !important;
      letter-spacing: 0.06em !important;
    }
    .lekha-original-template.t18-stage .split-title {
      display: inline-block !important;
      text-align: center !important;
      font-size: max(1em, 1.65rem) !important;
      line-height: 1.2 !important;
    }
    .lekha-original-template.t18-stage .split-top {
      display: block !important;
      color: rgba(255,255,255,0.92) !important;
      -webkit-text-fill-color: rgba(255,255,255,0.92) !important;
      font-size: 0.5em !important;
      letter-spacing: 0.18em !important;
      text-transform: uppercase !important;
    }
    .lekha-original-template.t18-stage .split-bot {
      display: block !important;
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      font-size: 1em !important;
      font-weight: 700 !important;
      letter-spacing: 0.08em !important;
      text-transform: uppercase !important;
    }
    .lekha-original-template.t18-stage .split-bot .imp-purple,
    .lekha-original-template.t18-stage .reveal-txt .imp-purple,
    .lekha-original-template.t18-stage .w.in[data-imp='true'] {
      color: var(--gold) !important;
      -webkit-text-fill-color: var(--gold) !important;
      opacity: 1 !important;
    }
    .lekha-original-template.t18-stage .reveal-txt,
    .lekha-original-template.t18-stage .t18-b2 .lekha-template-fit,
    .lekha-original-template.t18-stage .w.in:not([data-imp='true']) {
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      filter: none !important;
    }
    .lekha-original-template.t19-stage .t19-block,
    .lekha-original-template.t19-stage .lekha-applied-advanced-template,
    .lekha-original-template.t19-stage .lekha-template-fit,
    .lekha-original-template.t19-stage .wbw-rise,
    .lekha-original-template.t19-stage .wbw-seq-fade,
    .lekha-original-template.t19-stage .rise-unit,
    .lekha-original-template.t19-stage .slash-wrap,
    .lekha-original-template.t19-stage .w,
    .lekha-original-template.t19-stage .w.in:not([data-imp='true']) {
      font-family: 'Archivo Black', sans-serif !important;
      font-size: ${exportAdvancedTemplateFontPx}px !important;
      font-weight: 900 !important;
      line-height: 1.32 !important;
      letter-spacing: 0.02em !important;
      text-transform: uppercase !important;
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      opacity: 1 !important;
    }
    .lekha-original-template.t19-stage .imp-rose,
    .lekha-original-template.t19-stage .imp-bold,
    .lekha-original-template.t19-stage .w.in[data-imp='true'],
    .lekha-original-template.t19-stage .w[data-hero-emphasis='true'] {
      color: var(--rose) !important;
      -webkit-text-fill-color: var(--rose) !important;
      font-size: ${exportAdvancedTemplateFontPx}px !important;
      opacity: 1 !important;
    }
    .lekha-original-template.t19-stage .wbw-rise,
    .lekha-original-template.t19-stage .wbw-seq-fade {
      display: inline-flex !important;
      flex-wrap: wrap !important;
      justify-content: center !important;
      max-width: min(100%, 12em) !important;
      white-space: normal !important;
      overflow-wrap: normal !important;
      word-break: normal !important;
    }
    .lekha-original-template.t22-stage .t22-block,
    .lekha-original-template.t22-stage .wave-txt,
    .lekha-original-template.t22-stage .kf-line,
    .lekha-original-template.t22-stage .w.in:not([data-imp='true']) {
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      -webkit-text-stroke: 0 transparent !important;
      text-shadow: none !important;
      opacity: 1 !important;
    }
    .lekha-original-template.t22-stage .kf-base {
      color: var(--template-highlight, var(--template-secondary, var(--gold))) !important;
      -webkit-text-fill-color: var(--template-highlight, var(--template-secondary, var(--gold))) !important;
      -webkit-text-stroke: 0 transparent !important;
      text-shadow: none !important;
      paint-order: fill !important;
      opacity: 1 !important;
    }
    .lekha-original-template.t22-stage .imp-gold,
    .lekha-original-template.t22-stage .imp-italic,
    .lekha-original-template.t22-stage .kf-fill,
    .lekha-original-template.t22-stage .w.in[data-imp='true'],
    .lekha-original-template.t22-stage .w[data-hero-emphasis='true'] {
      color: var(--template-highlight, var(--template-secondary, var(--gold))) !important;
      -webkit-text-fill-color: var(--template-highlight, var(--template-secondary, var(--gold))) !important;
      -webkit-text-stroke: 0 transparent !important;
      text-shadow: none !important;
      paint-order: fill !important;
      opacity: 1 !important;
    }
    .lekha-original-template .kf-line {
      display: inline-block !important;
      max-width: 100% !important;
      text-align: center !important;
      white-space: normal !important;
    }
    .lekha-original-template .kf-word {
      display: inline-block !important;
      position: relative !important;
      white-space: pre !important;
    }
    .lekha-original-template .kf-base {
      display: block !important;
      color: rgba(255, 255, 255, 0.25) !important;
      -webkit-text-fill-color: rgba(255, 255, 255, 0.25) !important;
    }
    .lekha-original-template .kf-fill {
      position: absolute !important;
      inset: 0 !important;
      display: block !important;
      color: var(--gold) !important;
      -webkit-text-fill-color: var(--gold) !important;
      clip-path: inset(0 100% 0 0);
    }
    .lekha-original-template .active .kf-fill {
      animation: lekhaKaraokeFill var(--kf-duration, 360ms) linear forwards;
      animation-delay: var(--kf-delay, 0ms);
    }
    .lekha-original-template .t24-b4 .kf-fill {
      color: #fb923c !important;
      -webkit-text-fill-color: #fb923c !important;
    }
    .lekha-original-template .t33-b2 .kf-fill {
      color: var(--template-highlight, var(--template-secondary, #ee17dc)) !important;
      -webkit-text-fill-color: var(--template-highlight, var(--template-secondary, #ee17dc)) !important;
    }
    .lekha-original-template .t33-b2 .kf-base {
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      opacity: 1 !important;
      text-shadow: none !important;
    }
    .lekha-original-template.t36-stage .t36-b0 .kf-fill {
      color: var(--template-karaoke-1, var(--template-highlight, #DDAA03)) !important;
      -webkit-text-fill-color: var(--template-karaoke-1, var(--template-highlight, #DDAA03)) !important;
    }
    .lekha-original-template.t36-stage .t36-b1 .kf-fill {
      color: var(--template-karaoke-2, #22D3EE) !important;
      -webkit-text-fill-color: var(--template-karaoke-2, #22D3EE) !important;
    }
    .lekha-original-template.t36-stage .t36-b2 .kf-fill {
      color: var(--template-karaoke-3, #FB923C) !important;
      -webkit-text-fill-color: var(--template-karaoke-3, #FB923C) !important;
    }
    .lekha-original-template.t23-stage .t23-b3 .imp-bold,
    .lekha-original-template.t23-stage .t23-b3 .imp-gold,
    .lekha-original-template.t23-stage .t23-b3 .is-emphasis {
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      text-shadow: 0 1px 8px rgba(0,0,0,0.55), 0 0 12px rgba(255,255,255,0.36) !important;
    }
    .lekha-original-template.t24-stage .imp-purple {
      color: #f97316 !important;
      -webkit-text-fill-color: #f97316 !important;
    }
    .lekha-original-template.t24-stage .t24-block,
    .lekha-original-template.t24-stage .lekha-applied-advanced-template,
    .lekha-original-template.t24-stage .lekha-template-fit {
      font-size: min(${exportAdvancedTemplateFontPx}px, 20px) !important;
      line-height: 1.28 !important;
      max-width: min(100%, ${exportT24TemplateMaxWidthPx}px) !important;
      white-space: normal !important;
      overflow-wrap: normal !important;
      word-break: normal !important;
      text-align: center !important;
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      opacity: 1 !important;
    }

    .lekha-original-template.t24-stage {
      width: auto !important;
      max-width: min(82vw, ${exportT24TemplateMaxWidthPx}px) !important;
    }

    .lekha-original-template.t24-stage .wbw-rise,
    .lekha-original-template.t24-stage .wbw-slide,
    .lekha-original-template.t24-stage .wbw-seq-fade,
    .lekha-original-template.t24-stage .kf-line,
    .lekha-original-template.t24-stage .slow-rise,
    .lekha-original-template.t24-stage .rw {
      display: inline-flex !important;
      flex-wrap: wrap !important;
      align-items: baseline !important;
      justify-content: center !important;
      column-gap: 0.28em !important;
      row-gap: 0.12em !important;
      max-width: min(100%, ${exportT24TemplateMaxWidthPx}px) !important;
      text-align: center !important;
    }

    .lekha-original-template.t24-stage .lekha-template-preview-lines {
      display: block !important;
      line-height: 1.28 !important;
      max-width: min(100%, ${exportT24TemplateMaxWidthPx}px) !important;
      text-align: center !important;
    }

    .lekha-original-template.t24-stage .lekha-template-preview-line {
      display: block !important;
      white-space: nowrap !important;
      line-height: 1.28 !important;
      text-align: center !important;
    }

    .lekha-original-template.t24-stage .w,
    .lekha-original-template.t24-stage .w.in:not([data-imp='true']) {
      display: inline-block !important;
      margin-right: 0 !important;
      font-size: 1em !important;
      line-height: 1.28 !important;
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      opacity: 1 !important;
    }
    .lekha-original-template.t24-stage .redact-block,
    .lekha-original-template.t24-stage .imp-purple,
    .lekha-original-template.t24-stage .imp-orange,
    .lekha-original-template.t24-stage .w.in[data-imp='true'],
    .lekha-original-template.t24-stage .w[data-hero-emphasis='true'] {
      color: #f97316 !important;
      -webkit-text-fill-color: #f97316 !important;
      opacity: 1 !important;
    }
    .lekha-original-template.t24-stage .slow-rise {
      font-size: min(${exportAdvancedTemplateFontPx}px, 20px) !important;
      line-height: 1.28 !important;
    }
    .lekha-original-template.t25-stage .t25-block,
    .lekha-original-template.t25-stage .lekha-applied-advanced-template,
    .lekha-original-template.t25-stage .lekha-template-fit,
    .lekha-original-template.t25-stage .hand-txt,
    .lekha-original-template.t25-stage .soft-rise,
    .lekha-original-template.t25-stage .wbw-rise,
    .lekha-original-template.t25-stage .wbw-slide,
    .lekha-original-template.t25-stage .w.in:not([data-imp='true']) {
      max-width: min(100%, 13em) !important;
      white-space: normal !important;
      overflow-wrap: normal !important;
      word-break: normal !important;
      text-align: center !important;
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      opacity: 1 !important;
    }
    .lekha-original-template.t25-stage .hand-txt,
    .lekha-original-template.t25-stage .soft-rise {
      display: inline-block !important;
      line-height: 1.55 !important;
    }

    .lekha-original-template.t25-stage .lekha-template-preview-lines {
      display: block !important;
      line-height: 1.55 !important;
      max-width: min(100%, 13em) !important;
      text-align: center !important;
    }

    .lekha-original-template.t25-stage .lekha-template-preview-line {
      display: block !important;
      white-space: nowrap !important;
      line-height: 1.55 !important;
      text-align: center !important;
    }

    .lekha-original-template.t25-stage .wbw-rise,
    .lekha-original-template.t25-stage .wbw-slide {
      display: inline-flex !important;
      flex-wrap: wrap !important;
      align-items: baseline !important;
      justify-content: center !important;
      column-gap: 0.28em !important;
      row-gap: 0.12em !important;
    }
    .lekha-original-template.t25-stage .w {
      margin-right: 0 !important;
    }
    .lekha-original-template.t25-stage .imp-italic,
    .lekha-original-template.t25-stage .imp-rose,
    .lekha-original-template.t25-stage .w.in[data-imp='true'],
    .lekha-original-template.t25-stage .w[data-hero-emphasis='true'] {
      color: var(--template-highlight, var(--template-secondary, var(--rose, #ff3d71))) !important;
      -webkit-text-fill-color: var(--template-highlight, var(--template-secondary, var(--rose, #ff3d71))) !important;
      opacity: 1 !important;
    }
    .lekha-original-template.t26-stage .t26-block,
    .lekha-original-template.t26-stage .lekha-applied-advanced-template,
    .lekha-original-template.t26-stage .lekha-template-fit,
    .lekha-original-template.t26-stage .wbw-rise,
    .lekha-original-template.t26-stage .wbw-slide,
    .lekha-original-template.t26-stage .wbw-seq-fade,
    .lekha-original-template.t26-stage .w,
    .lekha-original-template.t26-stage .hard-txt,
    .lekha-original-template.t26-stage .fast-slide,
    .lekha-original-template.t26-stage .w.in:not([data-imp='true']) {
      max-width: min(100%, 11.5em) !important;
      white-space: normal !important;
      text-align: center !important;
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      opacity: 1 !important;
    }
    .lekha-original-template.t26-stage .wbw-rise,
    .lekha-original-template.t26-stage .wbw-slide,
    .lekha-original-template.t26-stage .wbw-seq-fade {
      display: inline-flex !important;
      flex-wrap: wrap !important;
      justify-content: center !important;
    }
    .lekha-original-template.t26-stage .imp-rose,
    .lekha-original-template.t26-stage .imp-bold,
    .lekha-original-template.t26-stage .w.in[data-imp='true'],
    .lekha-original-template.t26-stage .w[data-hero-emphasis='true'] {
      color: var(--template-highlight, var(--template-secondary, #15f5f9)) !important;
      -webkit-text-fill-color: var(--template-highlight, var(--template-secondary, #15f5f9)) !important;
      opacity: 1 !important;
    }
    .lekha-original-template.t27-stage .t27-block,
    .lekha-original-template.t27-stage .center-expand-txt,
    .lekha-original-template.t27-stage .t27-b1 .lekha-template-fit,
    .lekha-original-template.t27-stage .t27-b2 .lekha-template-fit,
    .lekha-original-template.t27-stage .w.in:not([data-imp='true']) {
      color: var(--cyan) !important;
      -webkit-text-fill-color: var(--cyan) !important;
      opacity: 1 !important;
    }
    .lekha-original-template.t27-stage .imp-cyan,
    .lekha-original-template.t27-stage .imp-bold,
    .lekha-original-template.t27-stage .w.in[data-imp='true'],
    .lekha-original-template.t27-stage .w[data-hero-emphasis='true'] {
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      opacity: 1 !important;
    }
    .lekha-original-template.t27-stage #t27-b1,
    .lekha-original-template.t27-stage #t27-b1 span,
    .lekha-original-template.t27-stage .t27-b1 .lekha-template-fit {
      font-size: max(${exportAdvancedTemplateFontPx}px, 20px) !important;
      color: var(--cyan) !important;
      -webkit-text-fill-color: var(--cyan) !important;
      opacity: 1 !important;
    }
    .lekha-original-template.t28-stage .t28-block,
    .lekha-original-template.t28-stage .lekha-applied-advanced-template,
    .lekha-original-template.t28-stage .lekha-template-fit,
    .lekha-original-template.t28-stage .grain-txt,
    .lekha-original-template.t28-stage .slow-fade,
    .lekha-original-template.t28-stage .wbw-rise,
    .lekha-original-template.t28-stage .wbw-seq-fade,
    .lekha-original-template.t28-stage .w {
      font-family: 'Bitter', serif !important;
      font-size: ${exportAdvancedTemplateFontPx}px !important;
      line-height: 1.48 !important;
      color: rgba(255,255,255,0.92) !important;
      -webkit-text-fill-color: rgba(255,255,255,0.92) !important;
      opacity: 1 !important;
      max-width: min(100%, 13em) !important;
      white-space: normal !important;
      text-align: center !important;
    }
    .lekha-original-template.t28-stage .imp-gold,
    .lekha-original-template.t28-stage .imp-italic,
    .lekha-original-template.t28-stage .w.in[data-imp='true'],
    .lekha-original-template.t28-stage .w[data-hero-emphasis='true'] {
      color: var(--template-highlight, var(--template-secondary, #86de02)) !important;
      -webkit-text-fill-color: var(--template-highlight, var(--template-secondary, #86de02)) !important;
      opacity: 1 !important;
    }
    .lekha-original-template.t29-stage .t29-block,
    .lekha-original-template.t29-stage .hard-rise,
    .lekha-original-template.t29-stage .w,
    .lekha-original-template.t29-stage .w.in:not([data-imp='true']),
      .lekha-original-template.t29-stage .lekha-template-fit {
      font-family: 'Teko', sans-serif !important;
      font-size: ${exportAdvancedTemplateFontPx}px !important;
      font-weight: 700 !important;
      line-height: 1.02 !important;
      letter-spacing: 0.035em !important;
      text-transform: uppercase !important;
      max-width: min(100%, 10.5em) !important;
      white-space: normal !important;
      overflow-wrap: normal !important;
      word-break: normal !important;
      text-align: center !important;
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      opacity: 1 !important;
    }
    .lekha-original-template.t29-stage .battle-slide,
    .lekha-original-template.t29-stage .imp-rose,
    .lekha-original-template.t29-stage .w.in[data-imp='true'],
    .lekha-original-template.t29-stage .w[data-hero-emphasis='true'] {
      color: var(--template-highlight, var(--template-secondary, #f97316)) !important;
      -webkit-text-fill-color: var(--template-highlight, var(--template-secondary, #f97316)) !important;
      opacity: 1 !important;
      text-shadow: 0 0 12px rgba(249,115,22,0.28) !important;
    }
    .lekha-original-template.t29-stage .wbw-rise,
    .lekha-original-template.t29-stage .wbw-slide,
    .lekha-original-template.t29-stage .wbw-seq-fade {
      display: inline-flex !important;
      flex-wrap: wrap !important;
      justify-content: center !important;
      column-gap: 0.14em !important;
      row-gap: 0 !important;
    }
    .lekha-original-template.t30-stage .t30-block,
    .lekha-original-template.t30-stage .lekha-applied-advanced-template,
    .lekha-original-template.t30-stage .lekha-template-fit,
    .lekha-original-template.t30-stage .breathe-txt {
      font-family: 'Cormorant Garamond', serif !important;
      font-size: ${exportAdvancedTemplateFontPx}px !important;
      font-style: italic !important;
      font-weight: 600 !important;
      line-height: 1.62 !important;
      max-width: min(100%, 13em) !important;
      white-space: normal !important;
      text-align: center !important;
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      opacity: 1 !important;
    }
    .lekha-original-template.t30-stage .imp-italic {
      color: #b4d2c8 !important;
      -webkit-text-fill-color: #b4d2c8 !important;
    }
    .lekha-original-template.t31-stage .t31-block,
    .lekha-original-template.t31-stage .stamp-text,
    .lekha-original-template.t31-stage .flip-line,
    .lekha-original-template.t31-stage .t31-b2 .lekha-template-fit,
    .lekha-original-template.t31-stage .w.in:not([data-imp='true']) {
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      opacity: 1 !important;
    }
    .lekha-original-template.t31-stage .imp-gold,
    .lekha-original-template.t31-stage .w.in[data-imp='true'],
    .lekha-original-template.t31-stage .w[data-hero-emphasis='true'] {
      color: var(--gold) !important;
      -webkit-text-fill-color: var(--gold) !important;
      opacity: 1 !important;
    }
    .lekha-original-template.t33-stage .t33-block,
    .lekha-original-template.t33-stage .lekha-applied-advanced-template,
    .lekha-original-template.t33-stage .lekha-template-fit,
    .lekha-original-template.t33-stage .doc-line,
    .lekha-original-template.t33-stage .w,
    .lekha-original-template.t33-stage .w.in:not([data-imp='true']) {
      font-family: 'Noto Sans', sans-serif !important;
      font-size: ${exportAdvancedTemplateFontPx}px !important;
      font-weight: 700 !important;
      line-height: 1.32 !important;
      text-align: center !important;
      max-width: min(100%, 18em) !important;
      white-space: normal !important;
      overflow-wrap: normal !important;
      word-break: normal !important;
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      opacity: 1 !important;
    }

    .lekha-original-template.t33-stage .wbw-rise,
    .lekha-original-template.t33-stage .wbw-slide,
    .lekha-original-template.t33-stage .wbw-seq-fade {
      display: inline-flex !important;
      flex-wrap: wrap !important;
      align-items: baseline !important;
      justify-content: center !important;
      column-gap: 0.24em !important;
      row-gap: 0.04em !important;
      max-width: min(100%, 18em) !important;
      white-space: normal !important;
    }
    .lekha-original-template.t33-stage .imp-cyan,
    .lekha-original-template.t33-stage .imp-bold,
    .lekha-original-template.t33-stage .w.in[data-imp='true'],
    .lekha-original-template.t33-stage .w[data-hero-emphasis='true'] {
      color: var(--template-highlight, var(--template-secondary, #00e5ff)) !important;
      -webkit-text-fill-color: var(--template-highlight, var(--template-secondary, #00e5ff)) !important;
      opacity: 1 !important;
    }
    .template-caption-shell.template-shell-t33,
    .template-caption-shell.template-shell-t33 > div,
    .template-caption-shell.template-shell-t33 > div > span {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      width: min(92vw, 18em) !important;
      max-width: min(92vw, 18em) !important;
      max-height: 4.4em !important;
      overflow: hidden !important;
      text-align: center !important;
    }
    .template-caption-shell.template-shell-t33 .lekha-original-template.t33-stage {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      width: 100% !important;
      max-width: 100% !important;
      max-height: 2.9em !important;
      overflow: hidden !important;
      text-align: center !important;
    }
    .template-caption-shell.template-shell-t33 .lekha-original-template.t33-stage .t33-block,
    .template-caption-shell.template-shell-t33 .lekha-original-template.t33-stage .lekha-applied-advanced-template,
    .template-caption-shell.template-shell-t33 .lekha-original-template.t33-stage .lekha-template-fit,
    .template-caption-shell.template-shell-t33 .lekha-original-template.t33-stage .doc-line,
    .template-caption-shell.template-shell-t33 .lekha-original-template.t33-stage .wbw-rise,
    .template-caption-shell.template-shell-t33 .lekha-original-template.t33-stage .wbw-slide,
    .template-caption-shell.template-shell-t33 .lekha-original-template.t33-stage .wbw-seq-fade,
    .template-caption-shell.template-shell-t33 .lekha-original-template.t33-stage .kf-line {
      display: inline-flex !important;
      flex-wrap: wrap !important;
      align-items: center !important;
      justify-content: center !important;
      width: 100% !important;
      max-width: 100% !important;
      max-height: 4.4em !important;
      overflow: hidden !important;
      font-size: ${Math.max(14, Math.round(exportAdvancedTemplateFontPx * 0.9))}px !important;
      line-height: 1.22 !important;
      text-align: center !important;
      white-space: normal !important;
      overflow-wrap: normal !important;
      word-break: normal !important;
      column-gap: 0.22em !important;
      row-gap: 0.08em !important;
      padding: 0 !important;
      margin: 0 auto !important;
      transform: none !important;
    }
    .template-caption-shell.template-shell-t33 .lekha-original-template.t33-stage .lekha-template-preview-lines,
    .template-caption-shell.template-shell-t33 .lekha-original-template.t33-stage .doc-line {
      display: grid !important;
      grid-auto-rows: min-content !important;
      gap: 0.08em !important;
    }
    .template-caption-shell.template-shell-t33 .lekha-original-template.t33-stage .lekha-template-preview-line,
    .template-caption-shell.template-shell-t33 .lekha-original-template.t33-stage .doc-line > span {
      display: block !important;
      width: 100% !important;
      max-width: 100% !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-align: center !important;
      line-height: 1.22 !important;
    }
    .template-caption-shell.template-shell-t33 .lekha-original-template.t33-stage .w {
      margin-right: 0 !important;
      font-size: 1em !important;
      line-height: 1.22 !important;
    }
    .lekha-original-template.t40-stage .still-frames-line,
    .lekha-original-template.t40-stage .still-frames-highlight,
    .lekha-original-template.t40-stage .imp-rose,
    .lekha-original-template.t40-stage .is-emphasis {
      opacity: 1 !important;
    }
    .lekha-original-template.t40-stage .still-frames-highlight,
    .lekha-original-template.t40-stage .imp-rose,
    .lekha-original-template.t40-stage .is-emphasis {
      color: var(--template-highlight, var(--template-secondary, #f2072b)) !important;
      -webkit-text-fill-color: var(--template-highlight, var(--template-secondary, #f2072b)) !important;
      text-shadow: 0 0 12px color-mix(in srgb, var(--template-highlight, var(--template-secondary, #f2072b)) 48%, transparent) !important;
    }
    .lekha-original-template.t34-stage .t34-block,
    .lekha-original-template.t34-stage .pow-txt,
    .lekha-original-template.t34-stage .w.in:not([data-imp='true']) {
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      opacity: 1 !important;
    }
    .lekha-original-template.t34-stage .imp-cyan,
    .lekha-original-template.t34-stage .imp-bold,
    .lekha-original-template.t34-stage .w.in[data-imp='true'],
    .lekha-original-template.t34-stage .w[data-hero-emphasis='true'] {
      color: var(--template-highlight, var(--template-secondary, #f97316)) !important;
      -webkit-text-fill-color: var(--template-highlight, var(--template-secondary, #f97316)) !important;
      opacity: 1 !important;
    }
    .lekha-original-template.t34-stage .pow-txt {
      font-size: max(${Math.max(16, Math.round(exportAdvancedTemplateFontPx * 0.96))}px, 20px) !important;
      line-height: 1.28 !important;
    }
    .lekha-original-template.t32-stage .imp-purple {
      color: var(--cyan) !important;
      -webkit-text-fill-color: var(--cyan) !important;
    }
    .lekha-original-template.t37-stage .t37-block,
    .lekha-original-template.t37-stage .neon-pulse,
    .lekha-original-template.t37-stage .neon-expand,
    .lekha-original-template.t37-stage .w.in:not([data-imp='true']) {
      color: var(--template-primary, #e1da09) !important;
      -webkit-text-fill-color: var(--template-primary, #e1da09) !important;
      -webkit-text-stroke: 0 transparent !important;
      text-shadow: none !important;
      opacity: 1 !important;
    }
    .lekha-original-template.t37-stage .imp-green,
    .lekha-original-template.t37-stage .w.in[data-imp='true'] {
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      -webkit-text-stroke: 0 transparent !important;
      text-shadow: none !important;
    }
    .template-caption-shell.is-color-customized .lekha-original-template {
      --gold: var(--template-secondary, #d4af37);
      --rose: var(--template-secondary, #ff3d71);
      --cyan: var(--template-secondary, #f97316);
      --green: var(--template-secondary, #39ff14);
      --purple: var(--template-secondary, #a78bfa);
      color: var(--template-primary, #ffffff) !important;
    }
    .template-caption-shell.is-color-customized .lekha-original-template .lekha-applied-advanced-template,
    .template-caption-shell.is-color-customized .lekha-original-template .lekha-template-fit,
    .template-caption-shell.is-color-customized .lekha-original-template .w.in:not([data-imp='true']),
    .template-caption-shell.is-color-customized .lekha-original-template .kf-base,
    .template-caption-shell.is-color-customized .lekha-original-template .cluster-row-top,
    .template-caption-shell.is-color-customized .lekha-original-template .cluster-row-bot,
    .template-caption-shell.is-color-customized .lekha-original-template .blur-txt {
      color: var(--template-primary, #ffffff) !important;
      -webkit-text-fill-color: var(--template-primary, #ffffff) !important;
    }
    .template-caption-shell.is-color-customized .lekha-original-template .is-emphasis,
    .template-caption-shell.is-color-customized .lekha-original-template [data-imp='true'],
    .template-caption-shell.is-color-customized .lekha-original-template .w.in[data-imp='true'],
    .template-caption-shell.is-color-customized .lekha-original-template [data-hero-emphasis='true'],
    .template-caption-shell.is-color-customized .lekha-original-template .imp-gold,
    .template-caption-shell.is-color-customized .lekha-original-template .imp-rose,
    .template-caption-shell.is-color-customized .lekha-original-template .imp-cyan,
    .template-caption-shell.is-color-customized .lekha-original-template .imp-purple,
    .template-caption-shell.is-color-customized .lekha-original-template .imp-green,
    .template-caption-shell.is-color-customized .lekha-original-template .imp-orange,
    .template-caption-shell.is-color-customized .lekha-original-template .imp-bold,
    .template-caption-shell.is-color-customized .lekha-original-template .imp-italic,
    .template-caption-shell.is-color-customized .lekha-original-template .imp-weight,
    .template-caption-shell.is-color-customized .lekha-original-template .imp-space,
    .template-caption-shell.is-color-customized .lekha-original-template .imp-flicker,
    .template-caption-shell.is-color-customized .lekha-original-template .imp-underline {
      color: var(--template-highlight, var(--template-secondary, #d4af37)) !important;
      -webkit-text-fill-color: var(--template-highlight, var(--template-secondary, #d4af37)) !important;
    }
    .template-caption-shell.is-color-customized .lekha-original-template.t22-stage .kf-base,
    .template-caption-shell.is-color-customized .lekha-original-template.t22-stage .kf-fill,
    .template-caption-shell.is-color-customized .lekha-original-template.t22-stage .imp-gold,
    .template-caption-shell.is-color-customized .lekha-original-template.t22-stage .w.in[data-imp='true'],
    .template-caption-shell.is-color-customized .lekha-original-template.t22-stage .w[data-hero-emphasis='true'] {
      color: var(--template-highlight, var(--template-secondary, #d4af37)) !important;
      -webkit-text-fill-color: var(--template-highlight, var(--template-secondary, #d4af37)) !important;
      -webkit-text-stroke: 0 transparent !important;
      text-shadow: none !important;
      paint-order: fill !important;
      opacity: 1 !important;
    }
    .template-caption-shell .lekha-original-template.t36-stage .t36-b0 .kf-fill,
    .template-caption-shell.is-color-customized .lekha-original-template.t36-stage .t36-b0 .kf-fill {
      color: var(--template-karaoke-1, var(--template-highlight, #DDAA03)) !important;
      -webkit-text-fill-color: var(--template-karaoke-1, var(--template-highlight, #DDAA03)) !important;
    }
    .template-caption-shell .lekha-original-template.t36-stage .kf-base,
    .template-caption-shell.is-color-customized .lekha-original-template.t36-stage .kf-base {
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      opacity: 1 !important;
      text-shadow: none !important;
    }
    .template-caption-shell .lekha-original-template.t36-stage .t36-b1 .kf-fill,
    .template-caption-shell.is-color-customized .lekha-original-template.t36-stage .t36-b1 .kf-fill {
      color: var(--template-karaoke-2, #22D3EE) !important;
      -webkit-text-fill-color: var(--template-karaoke-2, #22D3EE) !important;
    }
    .template-caption-shell .lekha-original-template.t36-stage .t36-b2 .kf-fill,
    .template-caption-shell.is-color-customized .lekha-original-template.t36-stage .t36-b2 .kf-fill {
      color: var(--template-karaoke-3, #FB923C) !important;
      -webkit-text-fill-color: var(--template-karaoke-3, #FB923C) !important;
    }
    .template-caption-shell.is-color-customized .lekha-original-template .imp-underline::after,
    .template-caption-shell.is-color-customized .lekha-original-template .w[data-imp='true'].imp-underline::after {
      background: var(--template-highlight, var(--template-secondary, #d4af37)) !important;
    }
    .template-caption-shell .lekha-original-template.t37-stage .imp-green,
    .template-caption-shell .lekha-original-template.t37-stage .w.in[data-imp='true'],
    .template-caption-shell.is-color-customized .lekha-original-template.t37-stage .imp-green,
    .template-caption-shell.is-color-customized .lekha-original-template.t37-stage .w.in[data-imp='true'] {
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      -webkit-text-stroke: 0 transparent !important;
      text-shadow: none !important;
    }
    .template-caption-shell .lekha-original-template.t23-stage .t23-b3 .imp-bold,
    .template-caption-shell .lekha-original-template.t23-stage .t23-b3 .imp-gold,
    .template-caption-shell .lekha-original-template.t23-stage .t23-b3 .is-emphasis,
    .template-caption-shell.is-color-customized .lekha-original-template.t23-stage .t23-b3 .imp-bold,
    .template-caption-shell.is-color-customized .lekha-original-template.t23-stage .t23-b3 .imp-gold,
    .template-caption-shell.is-color-customized .lekha-original-template.t23-stage .t23-b3 .is-emphasis {
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      text-shadow: 0 1px 8px rgba(0,0,0,0.55), 0 0 12px rgba(255,255,255,0.36) !important;
    }
    .template-caption-shell.has-text-gradient .lekha-original-template .lekha-applied-advanced-template,
    .template-caption-shell.has-text-gradient .lekha-original-template .lekha-template-fit,
    .template-caption-shell.has-text-gradient .lekha-original-template .w.in:not([data-imp='true']),
    .template-caption-shell.has-text-gradient .lekha-original-template .kf-base,
    .template-caption-shell.has-text-gradient .lekha-original-template .cluster-row-top,
    .template-caption-shell.has-text-gradient .lekha-original-template .cluster-row-bot,
    .template-caption-shell.has-text-gradient .lekha-original-template .blur-txt,
    .lekha-applied-basic-template-host.has-text-gradient .word,
    .lekha-applied-basic-template-host.has-text-gradient .sw-w,
    .lekha-applied-basic-template-host.has-text-gradient .lekha-basic-template-animated {
      background: var(--template-text-gradient) !important;
      background-image: var(--template-text-gradient) !important;
      -webkit-background-clip: text !important;
      background-clip: text !important;
      -webkit-text-fill-color: transparent !important;
      color: transparent !important;
    }
    .template-caption-shell.has-highlight-gradient .lekha-original-template .is-emphasis,
    .template-caption-shell.has-highlight-gradient .lekha-original-template [data-imp='true'],
    .template-caption-shell.has-highlight-gradient .lekha-original-template .w.in[data-imp='true'],
    .template-caption-shell.has-highlight-gradient .lekha-original-template [data-hero-emphasis='true'],
    .template-caption-shell.has-highlight-gradient .lekha-original-template .imp-gold,
    .template-caption-shell.has-highlight-gradient .lekha-original-template .imp-rose,
    .template-caption-shell.has-highlight-gradient .lekha-original-template .imp-cyan,
    .template-caption-shell.has-highlight-gradient .lekha-original-template .imp-purple,
    .template-caption-shell.has-highlight-gradient .lekha-original-template .imp-green,
    .template-caption-shell.has-highlight-gradient .lekha-original-template .imp-orange,
    .template-caption-shell.has-highlight-gradient .lekha-original-template .imp-bold,
    .template-caption-shell.has-highlight-gradient .lekha-original-template .imp-italic,
    .template-caption-shell.has-highlight-gradient .lekha-original-template .imp-weight,
    .template-caption-shell.has-highlight-gradient .lekha-original-template .imp-space,
    .template-caption-shell.has-highlight-gradient .lekha-original-template .imp-flicker,
    .template-caption-shell.has-highlight-gradient .lekha-original-template .imp-underline,
    .lekha-applied-basic-template-host.has-highlight-gradient .word.imp,
    .lekha-applied-basic-template-host.has-highlight-gradient .word.current,
    .lekha-applied-basic-template-host.has-highlight-gradient .sw-w.imp,
    .lekha-applied-basic-template-host.has-highlight-gradient .sw-w.current {
      background: var(--template-highlight-gradient) !important;
      background-image: var(--template-highlight-gradient) !important;
      -webkit-background-clip: text !important;
      background-clip: text !important;
      -webkit-text-fill-color: transparent !important;
      color: transparent !important;
    }
    @keyframes lekhaKaraokeFill {
      from { clip-path: inset(0 100% 0 0); }
      to { clip-path: inset(0 0% 0 0); }
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
        clip-path: var(--sidebar-export-final-clip, inset(0 0 0 0));
      }
    }
    @keyframes lekhaSidebarExportFlicker {
      0%, 18% { opacity: 0; }
      19%, 36% { opacity: 1; }
      37%, 54% { opacity: 0; }
      55%, 72% { opacity: 1; }
      73%, 84% { opacity: 0; }
      85%, 100% { opacity: 1; }
    }
    @keyframes lekhaSidebarExportStickyIn {
      from { opacity: 0.14; }
      to { opacity: 1; }
    }
    @keyframes source-word-rise {
      0% { transform: translateY(20px); opacity: 0; }
      100% { transform: translateY(0); opacity: 1; }
    }
    @keyframes source-word-pan {
      0% { transform: translateX(-30px); opacity: 0; }
      100% { transform: translateX(0); opacity: 1; }
    }
    @keyframes source-word-fade {
      0% { opacity: 0; }
      100% { opacity: 1; }
    }
    @keyframes source-word-pop {
      0% { transform: scale(0.5); opacity: 0; }
      50% { transform: scale(1.1); }
      100% { transform: scale(1); opacity: 1; }
    }
    @keyframes source-word-wipe {
      0% { clip-path: inset(0 100% 0 0); }
      100% { clip-path: inset(0 0 0 0); }
    }
    @keyframes source-word-blur {
      0% { filter: blur(10px); opacity: 0; }
      100% { filter: blur(0); opacity: 1; }
    }
    @keyframes source-word-succession {
      0% { transform: translateY(-10px); opacity: 0; }
      100% { transform: translateY(0); opacity: 1; }
    }
    @keyframes source-word-breathe {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.05); opacity: 0.9; }
    }
    @keyframes source-word-baseline {
      0% { transform: translateY(5px); opacity: 0; }
      100% { transform: translateY(0); opacity: 1; }
    }
    @keyframes source-word-drift {
      0% { transform: translate(-10px, -10px); opacity: 0; }
      100% { transform: translate(0, 0); opacity: 1; }
    }
    @keyframes source-word-tectonic {
      0% { transform: translateX(-20px) rotate(-5deg); opacity: 0; }
      100% { transform: translateX(0) rotate(0); opacity: 1; }
    }
    @keyframes source-word-tumble {
      0% { transform: rotate(-180deg) scale(0.5); opacity: 0; }
      100% { transform: rotate(0) scale(1); opacity: 1; }
    }
    @keyframes caption-zoom-in { from { transform: scale(0.65); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    @keyframes caption-zoom-out { from { transform: scale(1.35); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    @keyframes caption-fade-in { from { opacity: 0; } to { opacity: 1; } }
    @keyframes caption-slide-up { from { transform: translateY(34px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    @keyframes caption-slide-down { from { transform: translateY(-34px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    @keyframes caption-slide-left { from { transform: translateX(44px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes caption-slide-right { from { transform: translateX(-44px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes caption-fade-in-up { from { transform: translateY(22px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    @keyframes caption-fade-in-down { from { transform: translateY(-22px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    @keyframes caption-slide-in-right { from { transform: translateX(40px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes caption-flip-in-x { from { transform: perspective(500px) rotateX(-90deg); opacity: 0; } to { transform: perspective(500px) rotateX(0); opacity: 1; } }
    @keyframes caption-flip-in-y { from { transform: perspective(500px) rotateY(-90deg); opacity: 0; } to { transform: perspective(500px) rotateY(0); opacity: 1; } }
    @keyframes caption-blur-in { from { filter: blur(14px); opacity: 0; } to { filter: blur(0); opacity: 1; } }
    @keyframes caption-zoom-in-fade { from { transform: scale(0.65); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    @keyframes caption-bounce-in-up { 0% { transform: translateY(32px); opacity: 0; } 60% { transform: translateY(-8px); opacity: 1; } 80% { transform: translateY(4px); } 100% { transform: translateY(0); opacity: 1; } }
    @keyframes caption-skew-left { from { transform: translateX(-30px) skewX(20deg); opacity: 0; } to { transform: translateX(0) skewX(0); opacity: 1; } }
    @keyframes caption-missile { 0% { transform: translateX(-60px) scaleX(0.6); opacity: 0; } 65% { transform: translateX(6px) scaleX(1.04); opacity: 1; } 100% { transform: translateX(0) scaleX(1); opacity: 1; } }
    @keyframes caption-shockwave { 0% { transform: scale(1.6); opacity: 0; filter: blur(6px); } 55% { transform: scale(0.94); opacity: 1; filter: blur(0); } 100% { transform: scale(1); opacity: 1; } }
    @keyframes caption-typewriter { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
    @keyframes caption-slam-down { 0% { transform: translateY(-55px) scaleY(1.2); opacity: 0; } 65% { transform: translateY(6px) scaleY(0.94); opacity: 1; } 100% { transform: translateY(0) scaleY(1); opacity: 1; } }
    @keyframes caption-fire-charge { 0% { transform: translateY(18px) scaleX(0.8); opacity: 0; filter: blur(5px); } 70% { transform: translateY(-4px) scaleX(1.02); opacity: 1; filter: blur(0); } 100% { transform: translateY(0) scaleX(1); opacity: 1; } }
    @keyframes caption-stampede { 0% { transform: translateX(-55px) scaleX(1.1); opacity: 0; } 70% { transform: translateX(5px) scaleX(0.98); opacity: 1; } 100% { transform: translateX(0) scaleX(1); opacity: 1; } }
    @keyframes caption-recoil { 0% { transform: translateX(0); } 20% { transform: translateX(-10px); } 60% { transform: translateX(4px); } 100% { transform: translateX(0); } }
    @keyframes caption-iris-open { from { clip-path: circle(0 at 50% 50%); opacity: 0.4; } to { clip-path: circle(150% at 50% 50%); opacity: 1; } }
    @keyframes caption-parallax-rise { from { transform: translateY(14px) scale(0.97); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
    @keyframes caption-golden-ratio { from { transform: scaleX(0.618) translateX(-20px); opacity: 0; } to { transform: scaleX(1) translateX(0); opacity: 1; } }
    @keyframes caption-curtain-split { from { clip-path: inset(0 50%); opacity: 0.5; } to { clip-path: inset(0); opacity: 1; } }
    @keyframes caption-prestige { from { transform: scale(1.1); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    @keyframes caption-fade-through-black { 0% { opacity: 1; } 35%, 65% { opacity: 0; } 100% { opacity: 1; } }
    @keyframes caption-depth-pull { from { transform: scale(0.35); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    @keyframes caption-slow-burn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes caption-diagonal-wipe { from { clip-path: inset(0 100% 100% 0); } to { clip-path: inset(0); } }
    @keyframes caption-confetti-pop { 0% { transform: scale(0.3) rotate(-12deg); opacity: 0; } 55% { transform: scale(1.15) rotate(3deg); opacity: 1; } 75% { transform: scale(0.95) rotate(-1deg); } 100% { transform: scale(1); opacity: 1; } }
    @keyframes caption-sticker-slap { 0% { transform: scale(1.45) rotate(-6deg); opacity: 0; } 45% { transform: scale(0.94) rotate(1deg); opacity: 1; } 75% { transform: scale(1.02); } 100% { transform: scale(1); opacity: 1; } }
    @keyframes caption-wobble-entry { 0% { transform: translateX(-22px) rotate(-4deg); opacity: 0; } 35% { transform: translateX(9px) rotate(2deg); opacity: 1; } 65% { transform: translateX(-4px) rotate(-1deg); } 100% { transform: translateX(0); opacity: 1; } }
    @keyframes caption-balloon-float { 0% { transform: translateY(22px) scale(0.8); opacity: 0; } 65% { transform: translateY(-6px) scale(1.03); opacity: 1; } 100% { transform: translateY(0) scale(1); opacity: 1; } }
    @keyframes caption-color-splash { 0% { transform: scale(0.85); opacity: 0; filter: saturate(3) brightness(1.6); } 50% { transform: scale(1.06); opacity: 1; filter: saturate(2) brightness(1.3); } 100% { transform: scale(1); opacity: 1; filter: saturate(1) brightness(1); } }
  `;

  const runtimeEnv = String(process.env.APP_ENV || process.env.ENV || '').toLowerCase();
  const disableSandbox = process.env.PUPPETEER_DISABLE_SANDBOX === '1';
  if (disableSandbox && runtimeEnv === 'production') {
    throw new Error('PUPPETEER_DISABLE_SANDBOX is forbidden in production');
  }
  const browserArgs = ['--disable-gpu', '--disable-dev-shm-usage'];
  if (disableSandbox) browserArgs.push('--no-sandbox');

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: findChromeExecutable(),
    args: browserArgs,
    defaultViewport: {
      width: payload.video_width,
      height: payload.video_height,
      deviceScaleFactor: 1,
    },
  });

  try {
    const page = await browser.newPage();
    // Font stylesheets can take longer than Puppeteer's 30-second default on
    // cold CI runners. Keep the wait bounded, but leave enough room for the
    // same assets the export subsequently verifies via document.fonts.ready.
    page.setDefaultNavigationTimeout(60_000);
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const rawUrl = request.url();
      if (rawUrl === 'about:blank' || rawUrl.startsWith('data:')) {
        request.continue();
        return;
      }
      try {
        const parsed = new URL(rawUrl);
        if (parsed.protocol === 'https:' && ['fonts.googleapis.com', 'fonts.gstatic.com'].includes(parsed.hostname)) {
          request.continue();
          return;
        }
      } catch {
        // Invalid and non-network URLs are blocked below.
      }
      request.abort('blockedbyclient');
    });
    const pageErrors = [];
    page.on('pageerror', (error) => {
      pageErrors.push(error?.stack || error?.message || String(error));
    });
    page.on('console', (message) => {
      if (message.type() === 'error') {
        pageErrors.push(message.text());
      }
    });
    await page.setContent(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src data: https://fonts.gstatic.com; img-src data:; connect-src 'none'; media-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'" />
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          ${exportFontLinks}
          <link href="https://fonts.googleapis.com/css2?family=Abril+Fatface&family=Archivo+Black&family=Bangers&family=Bebas+Neue&family=Bitter:wght@400;700&family=Bodoni+Moda:opsz,wght@6..96,400;700&family=Bungee&family=Caveat:wght@400;700&family=Cinzel:wght@400;700;900&family=Cormorant+Garamond:ital,wght@0,300;0,600;0,700;1,300;1,600&family=Crimson+Text:ital,wght@0,400;0,600;1,400;1,600&family=Darker+Grotesque:wght@400;700;900&family=Dela+Gothic+One&family=DM+Serif+Display:ital@0;1&family=Exo+2:wght@400;700;900&family=IBM+Plex+Mono:wght@400;700&family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;700;800;900&family=Josefin+Sans:wght@300;400;700&family=Libre+Baskerville:wght@400;700&family=Lora:ital,wght@0,400;0,700;1,400;1,700&family=Montserrat:wght@400;500;700;800;900&family=Noto+Sans:wght@400;600;700;800;900&family=Oswald:wght@300;400;600;700&family=Overpass+Mono:wght@400;700&family=Permanent+Marker&family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&family=Questrial&family=Righteous&family=Rubik:wght@400;700;900&family=Silkscreen:wght@400;700&family=Special+Elite&family=Space+Mono:wght@400;700&family=Spectral:ital,wght@0,400;0,600;1,400;1,600&family=Staatliches&family=Syne:wght@400;600;700;800&family=Teko:wght@400;600;700&family=Unbounded:wght@300;700;900&display=swap" rel="stylesheet">
          <style>${runtimeCss}</style>
        </head>
        <body>
          <div id="overlay-root"></div>
          <script>window.__exportCanvasScale = ${JSON.stringify(exportCssScale)};</script>
          <script>window.__exportScriptFontMaps = ${JSON.stringify(exportScriptFontMaps)};</script>
          <script>window.__basicTemplateMarkupMap = ${JSON.stringify(basicTemplateMarkupMap)};</script>
          ${basicTemplateInlineSource ? `<script>${basicTemplateInlineSource}</script>` : ''}
          <script>${buildRuntimeScript(advancedTemplateBlockMarkup)}</script>
        </body>
      </html>
    `, { waitUntil: 'networkidle0' });

    await page.addStyleTag({ content: captionCss });
    await page.addStyleTag({ content: advancedCaptionCss });
    await page.addStyleTag({ content: originalTemplateCss });
    if (hasBasicTemplate) {
      await page.addStyleTag({ content: APPLIED_BASIC_TEMPLATE_HOST_OVERRIDES });
    }
    const renderPayloadType = await page.evaluate(() => typeof window.__renderPayload);
    if (renderPayloadType !== 'function') {
      throw new Error(`[Template DOM] overlay runtime did not initialize __renderPayload. Page errors: ${pageErrors.join(' | ') || 'none'}`);
    }
    await page.evaluate(() => document.fonts.ready);

    const segments = [];
    const points = new Set([0, Number(payload.duration || 0)]);
    const templateId = String(payload.style?.template_id || '').trim();
    const sidebarTemplateId = String(payload.style?.template_20_id || '').trim();
      const templateUsesPreviewTiming = isAdvancedTemplateId(templateId);
      const templateUsesSidebarTiming = Boolean(sidebarTemplateId);
      const templateUsesBasicTiming = SOURCE_BASIC_TEMPLATE_IDS.includes(templateId);
    const defaultTemplateSampleFps = Math.max(24, Math.min(60, Number(payload.style?.fps || 30)));
    const nonTextCaptions = (payload.captions || []).filter((caption) => !caption?.is_text_element);
    const adaptiveTemplateSampleFps = defaultTemplateSampleFps;

    for (const caption of payload.captions || []) {
      const start = Number(caption.start_time ?? 0);
      const end = Number(caption.end_time ?? start);
      points.add(start);
      points.add(end);
      const lineAnimation = LINE_ANIMATION_DEFS[String(caption.animation || '')];
      const animatedWordStyles = Object.values(caption.word_styles || {})
        .filter((wordStyle) => wordStyle && LINE_ANIMATION_DEFS[String(wordStyle.animation || '')]);
      if (lineAnimation || animatedWordStyles.length) {
        const lineSpeed = Math.max(0.1, Number(caption.animation_speed || 1));
        const lineWindowSeconds = lineAnimation
          ? (lineAnimation[3] === 'infinite'
              ? Math.max(0, end - start)
              : Math.min(Math.max(0, end - start), (lineAnimation[1] / lineSpeed) / 1000))
          : 0;
        const wordWindowSeconds = animatedWordStyles.reduce((maxWindow, wordStyle) => {
          const definition = LINE_ANIMATION_DEFS[String(wordStyle.animation || '')];
          const speed = Math.max(0.1, Number(wordStyle.animationSpeed || 1));
          const windowSeconds = definition[3] === 'infinite'
            ? Math.max(0, end - start)
            : (definition[1] / speed) / 1000;
          return Math.max(maxWindow, windowSeconds);
        }, 0);
        const animationEnd = Math.min(end, start + Math.max(lineWindowSeconds, wordWindowSeconds));
        for (
          let sample = start + (1 / defaultTemplateSampleFps);
          sample < animationEnd;
          sample += (1 / defaultTemplateSampleFps)
        ) {
          points.add(sample);
        }
      }
      if (templateUsesPreviewTiming) {
        if (caption?.is_text_element) continue;
        const fallbackIndex = nonTextCaptions.findIndex((item) => item?.id === caption?.id);
        const storedPhaseIndex = Number(caption.template_phase_index);
        const templateIndex = Number.isFinite(storedPhaseIndex)
          ? storedPhaseIndex
          : Number.isFinite(Number(caption.__templateIndex))
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
        const sidebarSampleFps = defaultTemplateSampleFps;
        const wordCount = Math.max(1, String(caption.text || '').trim().split(/\s+/).filter(Boolean).length);
        const captionTemplateSource = String(caption.template_source || caption.applied_template_style?.template_source || payload.style?.template_source || '').trim();
        const isLcSidebarCaption = captionTemplateSource === 'lekha-lc';
        const durationSeconds = Math.max(0, end - start);
        // Nominal LC schedule from the shared timing constants. Only a fallback
        // for scenes with no authored motion nodes now — see lcAuthoredCeilingMs.
        const lcSchedule = isLcSidebarCaption
          ? getLcMotionSchedule(Array.from({ length: wordCount }, (_, index) => ({
            animation: 'rise',
            duration: LC_TEMPLATE_TIMING.heroDurationMs,
            delay: index * LC_TEMPLATE_TIMING.staggerMs,
          })))
          : null;
        // The frame sampled for a segment is held for that whole segment, so the
        // sampling window must extend past the LAST word reveal — otherwise the
        // frame shown for the caption's tail predates the final word and that
        // word never appears in the exported video.
        //
        // Deriving the window from LC_TEMPLATE_TIMING.staggerMs is a guess, and
        // it is not a conservative one: authored LC scenes use their own stagger
        // (T167 phase 3 staggers 560ms, twice the assumed 280ms), so the window
        // closed 250ms before that scene's last reveal. Use the authored
        // data-lc-* timings instead, bounded by the ceiling that
        // fitLcMotionScheduleToCaption itself enforces — together those give the
        // exact motion end rather than an estimate in either direction.
        const lcAuthoredCeilingMs = (() => {
          if (!isLcSidebarCaption) return 0;
          const markup = String(
            caption.template_markup
            || caption.applied_template_style?.template_markup
            || payload.style?.template_markup
            || '',
          );
          const readMax = (pattern) => {
            let max = 0;
            for (const match of markup.matchAll(pattern)) {
              const value = Number(match[1]);
              if (Number.isFinite(value) && value > max) max = value;
            }
            return max;
          };
          const maxDelayMs = readMax(/data-lc-delay="(\d+(?:\.\d+)?)"/g);
          const maxDurationMs = readMax(/data-lc-duration="(\d+(?:\.\d+)?)"/g);
          // No authored motion nodes (plain/block scenes) — keep the nominal one.
          if (!maxDelayMs && !maxDurationMs) return lcSchedule.endMs;
          // Card-wide maxima, so this can only over-reach a given phase, never
          // fall short of it; the fit ceiling below trims any over-reach.
          return maxDelayMs + (maxDurationMs || LC_TEMPLATE_TIMING.heroDurationMs);
        })();
        // Mirrors fitLcMotionScheduleToCaption: no LC motion can run past this.
        const lcFitCeilingMs = Math.max(
          0,
          (durationSeconds * 1000) - Math.min(180, Math.max(60, durationSeconds * 1000 * 0.12)),
        );
        const animationWindowSeconds = Math.min(
          durationSeconds,
          isLcSidebarCaption
            ? ((Math.min(lcFitCeilingMs, lcAuthoredCeilingMs) + 140) / 1000)
            : 0.54 + (Math.max(0, wordCount - 1) * SIDEBAR_TEMPLATE_WORD_STAGGER_SECONDS) + 0.42,
        );
        const animationEnd = Math.min(end, start + animationWindowSeconds);
        points.add(start);
        points.add(animationEnd);
        points.add(end);
        for (
          let sample = start + (1 / sidebarSampleFps);
          sample < animationEnd;
          sample += (1 / sidebarSampleFps)
        ) {
          points.add(sample);
        }
      } else if (templateUsesBasicTiming) {
        if (caption?.is_text_element) continue;
        const splitWords = String(caption.text || '').split(/\s+/).filter(Boolean);
        const wordCount = Math.max(1, splitWords.length);
        for (const word of caption.words || []) {
          const wordStart = Number(word?.start ?? start);
          const wordEnd = Number(word?.end ?? wordStart);
          if (Number.isFinite(wordStart)) points.add(wordStart);
          if (Number.isFinite(wordEnd)) points.add(wordEnd);
        }
        const delaySeconds = templateId === 't-WS1' || templateId === 't-T4' ? 0.055 : 0.065;
        const durationSeconds = templateId === 't-WS1' || templateId === 't-T4' ? 0.32 : 0.28;
        const animationWindowSeconds = Math.min(
          Math.max(0, end - start),
          0.09 + (Math.max(0, wordCount - 1) * delaySeconds) + durationSeconds,
        );
        const animationEnd = Math.min(end, start + animationWindowSeconds);
        for (
          let sample = start + (1 / defaultTemplateSampleFps);
          sample < animationEnd;
          sample += (1 / defaultTemplateSampleFps)
        ) {
          points.add(sample);
        }
      } else {
        for (const word of caption.words || []) {
          const wordStart = Number(word?.start ?? start);
          const wordEnd = Number(word?.end ?? wordStart);
          if (Number.isFinite(wordStart)) points.add(wordStart);
          if (Number.isFinite(wordEnd)) points.add(wordEnd);
        }
      }
      // A word-by-word reveal changes the overlay at every word boundary. When
      // the caption carries no per-word timings the reveal falls back to an even
      // split of the caption, and without these points the whole caption
      // collapsed into one static frame — the CPT appeared fully formed.
      const revealsWordByWord = (
        captionHasCptWordStyles(caption)
        || payload.style?.show_inactive === false
      );
      if (revealsWordByWord && !caption?.is_text_element) {
        const timedRevealWords = Array.isArray(caption.words)
          ? caption.words.filter((word) => String(word?.word || word?.text || '').trim())
          : [];
        if (timedRevealWords.length) {
          timedRevealWords.forEach((word) => {
            const wordStart = Number(word?.start ?? word?.start_time ?? start);
            const wordEnd = Number(word?.end ?? word?.end_time ?? wordStart);
            if (Number.isFinite(wordStart)) points.add(wordStart);
            if (Number.isFinite(wordEnd)) points.add(wordEnd);
          });
        } else {
          const revealWordCount = Math.max(
            1,
            String(caption.text || '').trim().split(/\s+/).filter(Boolean).length,
          );
          const revealDuration = Math.max(0, end - start);
          for (let index = 0; index < revealWordCount; index += 1) {
            const wordStart = start + ((revealDuration * index) / revealWordCount);
            if (index > 0) points.add(wordStart);
          }
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

    const maxOverlayFrames = Math.max(
      300,
      Math.min(6000, Number(process.env.TEMPLATE_OVERLAY_MAX_FRAMES || 3600)),
    );
    if (segments.length > maxOverlayFrames) {
      const groupSize = Math.ceil(segments.length / maxOverlayFrames);
      const compacted = [];
      for (let index = 0; index < segments.length; index += groupSize) {
        const group = segments.slice(index, index + groupSize);
        const start = group[0].start;
        const end = group[group.length - 1].end;
        compacted.push({ start, end, duration: end - start });
      }
      console.warn(`[Template DOM] frame cap compacted ${segments.length} samples to ${compacted.length}`);
      segments.splice(0, segments.length, ...compacted);
    }

    console.log(`[Template DOM] segments=${segments.length} template_timing=${templateUsesPreviewTiming} sidebar_timing=${templateUsesSidebarTiming} sample_fps=${adaptiveTemplateSampleFps}`);

    const frameLines = [];
    const frameFiles = [];
    const completenessAudits = [];
    const wordPositionAudits = [];
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
      const sampleOffset = Math.min(
        Math.max(0, segment.duration / 2),
        1 / (adaptiveTemplateSampleFps * 2),
      );
      const renderTime = Math.min(segment.end - 0.0005, segment.start + sampleOffset);
      const framePath = path.join(outputDir, `frame-${String(index).padStart(5, '0')}.png`);
      const hasActiveCaptions = (payload.captions || []).some((caption) => {
        const start = Number(caption.start_time ?? 0);
        const end = Number(caption.end_time ?? start);
        return renderTime >= start && renderTime < end;
      });

      let renderedFramePath = blankFramePath;
      if (hasActiveCaptions) {
        await page.evaluate(async (currentPayload, currentTime) => {
          try {
            window.__renderPayload(currentPayload, currentTime);
            if (window.__activateTemplateAnimations) {
              await window.__activateTemplateAnimations();
            } else {
              await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            }
          } catch (error) {
            throw new Error(`[Template DOM] renderPayload failed at ${currentTime.toFixed(3)}s: ${error?.stack || error?.message || error}`);
          }

          let animations = [];
          try {
            animations = document.getAnimations({ subtree: true });
          } catch (error) {
            throw new Error(`[Template DOM] getAnimations failed at ${currentTime.toFixed(3)}s: ${error?.stack || error?.message || error}`);
          }
          animations.forEach((animation) => {
            try {
              const target = animation.effect?.target?.element || animation.effect?.target;
              const shell = target?.closest?.(
                '.caption-line-animation-shell, .template-caption-shell, .lekha-sidebar-export-template-shell, .lekha-applied-basic-template-host',
              );
              const captionStart = Number(shell?.dataset?.captionStart || 0);
              const captionEnd = Number(shell?.dataset?.captionEnd || captionStart);
              const captionElapsedMs = Math.max(0, (currentTime - captionStart) * 1000);
              const block = target?.closest?.('.lekha-applied-advanced-template');
              const blockType = block?.dataset?.templateBlockType || 'styled';
              const wordCount = block
                ? Math.max(
                    1,
                    block.querySelectorAll('.w, .kf-word').length
                      || String(block.textContent || '').trim().split(/\s+/).filter(Boolean).length,
                  )
                : 1;
              const animationElapsedMs = block && window.__getAdvancedPlaybackElapsedMs
                ? window.__getAdvancedPlaybackElapsedMs(
                    blockType,
                    wordCount,
                    Math.max(0, (captionEnd - captionStart) * 1000),
                    captionElapsedMs,
                  )
                : captionElapsedMs;
              animation.pause();
              animation.currentTime = animationElapsedMs;
            } catch {
              // Some browser-managed animations cannot be seeked; leave them at their rendered state.
            }
          });
          // LC accent colors are opaque hex values, but entrance keyframes such
          // as fade/rise/pop interpolate `opacity`. When a frame lands inside
          // that interpolation, the keyword has the right color but is composited
          // at partial alpha and looks washed out compared with the template and
          // canvas previews. Promote only highlights that have actually started
          // appearing; opacity:0 nodes remain hidden until their authored delay.
          // Walk animated wrappers too, because LC4/LC5 can fade a whole line.
          const lcHighlightSelector = [
            '.hero',
            '.is-emphasis',
            '.ns3hero',
            '.ns3box',
            '.ns3mark',
            '.ns3bracket',
            '.ns3dot',
            '[data-hero-emphasis="true"]',
            '.box',
          ].join(', ');
          document.querySelectorAll(
            '.lekha-sidebar-export-template-shell[data-template-source="lekha-lc"] .sb.active',
          ).forEach((block) => {
            block.querySelectorAll(lcHighlightSelector).forEach((highlight) => {
              const visibleOpacity = Number.parseFloat(getComputedStyle(highlight).opacity);
              if (!Number.isFinite(visibleOpacity) || visibleOpacity <= 0.001) return;
              let node = highlight;
              while (node && node !== block) {
                const opacity = Number.parseFloat(getComputedStyle(node).opacity);
                if (Number.isFinite(opacity) && opacity > 0.001 && opacity < 1) {
                  node.style.setProperty('opacity', '1', 'important');
                }
                node = node.parentElement;
              }
            });
          });
          document.querySelectorAll('.lekha-applied-advanced-template.active').forEach((block) => {
            block.style.transition = 'none';
            block.style.opacity = '1';
            block.style.visibility = 'visible';

            const shell = block.closest('.template-caption-shell');
            const captionStart = Number(shell?.dataset?.captionStart || 0);
            const captionEnd = Number(shell?.dataset?.captionEnd || captionStart);
            const captionElapsedMs = Math.max(0, (currentTime - captionStart) * 1000);
            const blockType = block.dataset.templateBlockType || 'styled';
            const timing = window.__advancedTemplateTiming || {};
            const clamp = (value) => Math.max(0, Math.min(1, Number(value) || 0));
            const easeOut = (value) => 1 - Math.pow(1 - clamp(value), 3);
            const setImportant = (element, property, value) => {
              element?.style?.setProperty?.(property, value, 'important');
            };
            const wordCount = Math.max(
              1,
              block.querySelectorAll('.w, .kf-word').length
                || String(block.textContent || '').trim().split(/\s+/).filter(Boolean).length,
            );
            const animationElapsedMs = window.__getAdvancedPlaybackElapsedMs
              ? window.__getAdvancedPlaybackElapsedMs(
                  blockType,
                  wordCount,
                  Math.max(0, (captionEnd - captionStart) * 1000),
                  captionElapsedMs,
                )
              : captionElapsedMs;

            if (blockType === 'karaoke') {
              const words = Array.from(block.querySelectorAll('.kf-word'));
              const perWord = Number(timing.holdMs || 1650) / Math.max(1, words.length + 0.5);
              words.forEach((word, index) => {
                const fill = word.querySelector('.kf-fill');
                if (!fill) return;
                const progress = clamp((animationElapsedMs - (index * perWord)) / perWord);
                fill.style.animation = 'none';
                fill.style.transition = 'none';
                fill.style.clipPath = `inset(0 ${(1 - progress) * 100}% 0 0)`;
              });
              return;
            }

            if (blockType === 'styled') {
              const styledDurationMs = block.classList.contains('t25-b0')
                ? 700
                : block.classList.contains('t25-b1')
                  ? 500
                  : Number(timing.styledDurationMs || 850);
              const progress = clamp(animationElapsedMs / Math.max(1, styledDurationMs));
              const eased = easeOut(progress);
              block.querySelectorAll('.hand-txt').forEach((element) => {
                setImportant(element, 'animation', 'none');
                setImportant(element, 'transition', 'none');
                setImportant(element, 'opacity', String(progress));
                setImportant(element, 'transform', `translateX(${12 * (1 - eased)}px) rotate(${0.5 * (1 - eased)}deg)`);
                setImportant(element, 'filter', `blur(${2 * (1 - eased)}px)`);
              });
              block.querySelectorAll('.soft-rise').forEach((element) => {
                setImportant(element, 'animation', 'none');
                setImportant(element, 'transition', 'none');
                setImportant(element, 'opacity', String(progress));
                setImportant(element, 'transform', `translateY(${8 * (1 - eased)}px)`);
                setImportant(element, 'filter', 'none');
              });
              return;
            }

            if (!blockType.startsWith('wbw-')) return;
            const sequential = blockType === 'wbw-seq'
              || blockType === 'wbw-seq-fade'
              || blockType === 'wbw-seq-flip';
            block.querySelectorAll('.w').forEach((word, fallbackIndex) => {
              const parsedIndex = Number(word.dataset.i);
              const index = Number.isFinite(parsedIndex) ? parsedIndex : fallbackIndex;
              const isImp = word.dataset.imp === 'true';
              const impClass = word.dataset.impCls || '';
              const wordBlockType = word.dataset.lineMotion || blockType;
              const isEvidenceEmphasis = wordBlockType === 't39-evidence' && isImp;
              const lineDelayMs = Number(word.dataset.lineDelay || 0);
              const battleMotion = word.dataset.battleMotion || '';
              const battleIndex = Number.isFinite(Number(word.dataset.battleIndex))
                ? Number(word.dataset.battleIndex)
                : index;
              const delayMs = sequential
                ? index * Number(timing.sequentialStaggerMs || 145)
                : battleMotion
                  ? (battleIndex * 58) + lineDelayMs + (isImp ? 24 : 0)
                  : (index * Number(timing.wordStaggerMs || 45))
                  + (isImp ? Number(timing.emphasisDelayMs || 60) : 0)
                  + lineDelayMs;
              const durationMs = isEvidenceEmphasis
                ? 360
                : sequential
                ? Number(timing.sequentialDurationMs || 180)
                : battleMotion
                  ? (isImp ? 380 : 320)
                  : isImp
                  ? Number(timing.emphasisDurationMs || 300)
                  : Number(timing.wordDurationMs || 210);
              const progress = clamp((animationElapsedMs - delayMs) / durationMs);
              const eased = 1 - Math.pow(1 - progress, 3);
              setImportant(word, 'animation', 'none');
              setImportant(word, 'transition', 'none');
              setImportant(word, 'opacity', String(progress));
              setImportant(word, 'clip-path', 'none');
              setImportant(word, 'transform-origin', 'initial');
              setImportant(word, 'filter', 'none');
              setImportant(word, 'text-shadow', 'none');

              if (battleMotion === 'sweep-left') {
                setImportant(word, 'transform', `translateX(${-34 * (1 - eased)}px)`);
              } else if (battleMotion === 'lift-up') {
                setImportant(word, 'transform', `translateY(${28 * (1 - eased)}px)`);
              } else if (isEvidenceEmphasis) {
                setImportant(word, 'transform', `translateY(${18 * (1 - eased)}px) scale(${0.72 + (0.28 * eased)}) rotate(${-2 * (1 - eased)}deg)`);
                setImportant(word, 'text-shadow', `0 0 ${4 + (10 * eased)}px currentColor`);
              } else if (sequential) {
                if (blockType === 'wbw-seq-fade') {
                  setImportant(word, 'transform', 'none');
                } else if (blockType === 'wbw-seq-flip') {
                  setImportant(word, 'transform', `perspective(320px) rotateX(${-90 * (1 - eased)}deg)`);
                  setImportant(word, 'transform-origin', 'center bottom');
                } else {
                  setImportant(word, 'transform', `scale(${0.82 + (0.18 * eased)})`);
                }
              } else if (wordBlockType === 't16-stack') {
                setImportant(word, 'transform', `translateY(${24 * (1 - eased)}px) scale(${0.92 + (0.08 * eased)})`);
                setImportant(word, 'filter', `blur(${4 * (1 - eased)}px)`);
              } else if (wordBlockType === 't16-neon') {
                setImportant(word, 'transform', `scale(${0.86 + (0.14 * eased)})`);
                setImportant(word, 'filter', `brightness(${0.75 + (0.25 * eased)})`);
                setImportant(word, 'text-shadow', `0 0 ${4 + (12 * eased)}px rgba(0,229,255,${0.25 + (0.35 * eased)})`);
              } else if (wordBlockType === 't16-diagonal') {
                setImportant(word, 'transform', `translate(${28 * (1 - eased)}px, ${-20 * (1 - eased)}px) rotate(${-4 * (1 - eased)}deg)`);
              } else if (wordBlockType === 't16-impact') {
                setImportant(word, 'transform', `translateX(${-36 * (1 - eased)}px) scale(${1 + (0.1 * (1 - eased))})`);
              } else if (wordBlockType === 't24-wipe') {
                setImportant(word, 'opacity', '1');
                setImportant(word, 'transform', `translateY(${10 * (1 - eased)}px)`);
                setImportant(word, 'clip-path', `inset(${(1 - eased) * 100}% 0 0 0)`);
              } else if (wordBlockType === 't24-drift') {
                setImportant(word, 'transform', `translate(${6 * (1 - eased)}px, ${10 * (1 - eased)}px) rotate(${1 * (1 - eased)}deg)`);
                setImportant(word, 'filter', `blur(${2 * (1 - eased)}px)`);
              } else if (wordBlockType === 't24-slide') {
                setImportant(word, 'transform', `translateX(${-14 * (1 - eased)}px)`);
              } else if (wordBlockType === 't24-stamp') {
                setImportant(word, 'transform', `scale(${1.08 - (0.08 * eased)})`);
                setImportant(word, 'text-shadow', `0 0 ${7 * eased}px rgba(249,115,22,${0.2 + (0.18 * eased)})`);
              } else if (wordBlockType === 't24-inner') {
                setImportant(word, 'transform', `translateY(${8 * (1 - eased)}px) scale(${0.94 + (0.06 * eased)})`);
                setImportant(word, 'filter', `blur(${2 * (1 - eased)}px)`);
              } else if (wordBlockType === 't26-shutter') {
                setImportant(word, 'opacity', progress > 0.08 ? '1' : '0');
                setImportant(word, 'transform', `translateY(${18 * (1 - eased)}px) skewX(${-8 * (1 - eased)}deg)`);
                setImportant(word, 'clip-path', `inset(0 0 ${(1 - eased) * 100}% 0)`);
              } else if (wordBlockType === 't26-snap') {
                setImportant(word, 'transform', `translateX(${-32 * (1 - eased)}px) rotate(${-3 * (1 - eased)}deg)`);
              } else if (wordBlockType === 't26-kick') {
                setImportant(word, 'transform', `translate(${18 * (1 - eased)}px, ${-16 * (1 - eased)}px) scale(${1 + (0.08 * (1 - eased))})`);
              } else if (wordBlockType === 't26-tag') {
                setImportant(word, 'transform', `scale(${0.82 + (0.18 * eased)})`);
                setImportant(word, 'filter', `contrast(${0.75 + (0.25 * eased)})`);
              } else if (wordBlockType === 't29-shutter') {
                setImportant(word, 'opacity', progress > 0.12 ? '1' : '0');
                setImportant(word, 'transform', `scaleX(${0.72 + (0.28 * eased)}) translateY(${14 * (1 - eased)}px)`);
                setImportant(word, 'clip-path', `inset(0 ${(1 - eased) * 48}% 0 ${(1 - eased) * 48}%)`);
              } else if (wordBlockType === 't29-recoil') {
                setImportant(word, 'transform', `translateY(${-22 * (1 - eased)}px) scale(${1.14 - (0.14 * eased)})`);
              } else if (wordBlockType === 't29-charge') {
                setImportant(word, 'transform', `translate(${36 * (1 - eased)}px, ${-10 * (1 - eased)}px) skewX(${-10 * (1 - eased)}deg)`);
              } else if (wordBlockType === 't29-clamp') {
                setImportant(word, 'transform', `scaleY(${0.72 + (0.28 * eased)})`);
                setImportant(word, 'clip-path', `inset(${(1 - eased) * 42}% 0 ${(1 - eased) * 42}% 0)`);
              } else if (isImp) {
                const entrance = window.__advancedImpEntrances?.[impClass] || 'opposite';
                const effect = entrance === 'opposite'
                  ? (wordBlockType === 'wbw-rise' ? 'opposite-slide' : 'opposite-rise')
                  : entrance;
                if (effect === 'wipe') {
                  setImportant(word, 'opacity', '1');
                  setImportant(word, 'transform', 'none');
                  setImportant(word, 'clip-path', `inset(0 ${(1 - eased) * 100}% 0 0)`);
                } else if (effect === 'wipe-up') {
                  setImportant(word, 'opacity', '1');
                  setImportant(word, 'transform', 'none');
                  setImportant(word, 'clip-path', impClass === 'imp-underline'
                    ? 'inset(0 0 0 0)'
                    : `inset(${(1 - eased) * 100}% 0 0 0)`);
                } else if (effect === 'roll') {
                  setImportant(word, 'transform', `rotateX(${-90 * (1 - eased)}deg)`);
                  setImportant(word, 'transform-origin', 'center bottom');
                } else if (effect === 'opposite-slide') {
                  setImportant(word, 'transform', `translateX(${-28 * (1 - eased)}px)`);
                } else {
                  setImportant(word, 'transform', `translateY(${28 * (1 - eased)}px)`);
                }
              } else if (wordBlockType === 'wbw-slide') {
                setImportant(word, 'transform', `translateX(${-16 * (1 - eased)}px)`);
              } else {
                setImportant(word, 'transform', `translateY(${20 * (1 - eased)}px)`);
              }
              word.classList.toggle('in', progress > 0);
              word.classList.toggle('fx', progress >= 1 && impClass === 'imp-flicker');
            });
          });
          await new Promise((resolve) => requestAnimationFrame(resolve));
        }, payload, renderTime);

        if (shouldAuditWordPositions) {
          const frameWordPositions = await page.evaluate((currentPayload, currentTime) => {
            const root = document.getElementById('overlay-root');
            const rootRect = root?.getBoundingClientRect();
            if (!rootRect?.width || !rootRect?.height) return [];

            const nodesByKey = new Map();
            root.querySelectorAll('[data-word-key]').forEach((node) => {
              const key = node.getAttribute('data-word-key');
              if (!key) return;
              const isActiveTemplateWord = Boolean(node.closest(
                '.sb.active, .sblock.active, .lekha-applied-advanced-template.active',
              ));
              if (!nodesByKey.has(key) || isActiveTemplateWord) nodesByKey.set(key, node);
            });
            const activeCaptions = (currentPayload.captions || []).filter((caption) => {
              const start = Number(caption.start_time ?? 0);
              const end = Number(caption.end_time ?? start);
              return currentTime >= start && currentTime < end;
            });

            return activeCaptions.flatMap((caption) => Object.entries(caption.word_styles || {})
              .filter(([, wordStyle]) => {
                const hasAbsolutePosition = (
                  Number.isFinite(Number(wordStyle?.abs_x_pct))
                  && Number.isFinite(Number(wordStyle?.abs_y_pct))
                  && (
                    Math.abs(Number(wordStyle.abs_x_pct)) > 0.01
                    || Math.abs(Number(wordStyle.abs_y_pct)) > 0.01
                  )
                );
                const hasRelativeOffset = (
                  Math.abs(Number(wordStyle?.x || 0)) > 0.01
                  || Math.abs(Number(wordStyle?.y || 0)) > 0.01
                );
                return hasAbsolutePosition || hasRelativeOffset;
              })
              .map(([key, wordStyle]) => {
                const node = nodesByKey.get(key);
                if (!node) {
                  return { key, found: false };
                }
                const markedTargets = [
                  ...(node.matches('[data-export-word-position-target="true"]') ? [node] : []),
                  ...node.querySelectorAll('[data-export-word-position-target="true"]'),
                ];
                const rects = (markedTargets.length ? markedTargets : [node])
                  .map((target) => target.getBoundingClientRect())
                  .filter((rect) => rect.width > 0 && rect.height > 0);
                if (!rects.length) {
                  return { key, found: true, visible: false };
                }
                const left = Math.min(...rects.map((rect) => rect.left));
                const top = Math.min(...rects.map((rect) => rect.top));
                const right = Math.max(...rects.map((rect) => rect.right));
                const bottom = Math.max(...rects.map((rect) => rect.bottom));
                const hasAbsolutePosition = (
                  Number.isFinite(Number(wordStyle.abs_x_pct))
                  && Number.isFinite(Number(wordStyle.abs_y_pct))
                  && (
                    Math.abs(Number(wordStyle.abs_x_pct)) > 0.01
                    || Math.abs(Number(wordStyle.abs_y_pct)) > 0.01
                  )
                );
                // A `translate` that is merely *set* proves nothing: CSS
                // transforms are ignored on non-replaced inline boxes, so a
                // dragged word can carry the right value and still never move.
                // Measure the offset the browser actually honours by dropping
                // the translate, re-measuring, and restoring it.
                const positionTarget = markedTargets[0] || node;
                const motionTarget = node.querySelector('[data-cpt-word-motion="true"]') || positionTarget;
                const targetDisplay = getComputedStyle(positionTarget).display;
                const measureCenter = (element) => {
                  const box = element.getBoundingClientRect();
                  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
                };
                const translatedCenter = measureCenter(positionTarget);
                const clippingAncestors = [];
                let clippingNode = positionTarget.parentElement;
                while (clippingNode && clippingNode !== root.parentElement) {
                  const clippingStyle = getComputedStyle(clippingNode);
                  const clipsX = /hidden|clip/.test(clippingStyle.overflowX);
                  const clipsY = /hidden|clip/.test(clippingStyle.overflowY);
                  if (clipsX || clipsY) {
                    const clippingRect = clippingNode.getBoundingClientRect();
                    const positionedRect = positionTarget.getBoundingClientRect();
                    if (
                      (clipsX && (
                        positionedRect.left < clippingRect.left - 0.5
                        || positionedRect.right > clippingRect.right + 0.5
                      ))
                      || (clipsY && (
                        positionedRect.top < clippingRect.top - 0.5
                        || positionedRect.bottom > clippingRect.bottom + 0.5
                      ))
                    ) {
                      clippingAncestors.push(
                        clippingNode.className
                        || clippingNode.id
                        || clippingNode.tagName,
                      );
                    }
                  }
                  if (clippingNode === root) break;
                  clippingNode = clippingNode.parentElement;
                }
                const inlineTranslate = positionTarget.style.getPropertyValue('translate');
                const inlineTranslatePriority = positionTarget.style.getPropertyPriority('translate');
                positionTarget.style.setProperty('translate', 'none', 'important');
                void positionTarget.getBoundingClientRect();
                const untranslatedCenter = measureCenter(positionTarget);
                positionTarget.style.removeProperty('translate');
                if (inlineTranslate) {
                  positionTarget.style.setProperty('translate', inlineTranslate, inlineTranslatePriority);
                }
                void positionTarget.getBoundingClientRect();
                return {
                  key,
                  found: true,
                  visible: true,
                  mode: hasAbsolutePosition ? 'absolute' : 'relative',
                  expected_x_pct: hasAbsolutePosition ? Number(wordStyle.abs_x_pct) : null,
                  expected_y_pct: hasAbsolutePosition ? Number(wordStyle.abs_y_pct) : null,
                  source_x: Number(wordStyle.x || 0),
                  source_y: Number(wordStyle.y || 0),
                  applied_translate: getComputedStyle(positionTarget).translate,
                  target_display: targetDisplay,
                  word_opacity: Number.parseFloat(getComputedStyle(node).opacity || '1'),
                  target_opacity: Number.parseFloat(getComputedStyle(motionTarget).opacity || '1'),
                  target_animation_name: getComputedStyle(motionTarget).animationName,
                  clipped_by_overflow: clippingAncestors.length > 0,
                  clipping_ancestors: clippingAncestors,
                  effective_dx: translatedCenter.x - untranslatedCenter.x,
                  effective_dy: translatedCenter.y - untranslatedCenter.y,
                  actual_x_pct: (((left + right) / 2 - rootRect.left) / rootRect.width) * 100,
                  actual_y_pct: (((top + bottom) / 2 - rootRect.top) / rootRect.height) * 100,
                };
              }));
          }, payload, renderTime);
          wordPositionAudits.push({ time: renderTime, words: frameWordPositions });
        }

        const endingCaptionAudits = await page.evaluate((currentPayload, currentTime, segmentEnd) => {
          const normalizeTokens = (value) => String(value || '')
            .normalize('NFC')
            .trim()
            .toLocaleLowerCase()
            .split(/\s+/)
            .filter(Boolean);
          const isVisibleTextParent = (element, boundary) => {
            if (!(element instanceof HTMLElement)) return false;
            const rect = element.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return false;
            let node = element;
            while (node && node !== boundary.parentElement) {
              const computed = getComputedStyle(node);
              if (
                computed.display === 'none'
                || computed.visibility === 'hidden'
                || Number.parseFloat(computed.opacity || '1') <= 0.001
              ) {
                return false;
              }
              if (node === boundary) break;
              node = node.parentElement;
            }
            return true;
          };
          const containsWordSequence = (renderedTokens, expectedTokens) => {
            let cursor = 0;
            for (const token of renderedTokens) {
              if (token === expectedTokens[cursor]) cursor += 1;
              if (cursor === expectedTokens.length) return true;
            }
            return expectedTokens.length === 0;
          };

          const activeCaptions = (currentPayload.captions || []).filter((caption) => {
            const start = Number(caption.start_time ?? 0);
            const end = Number(caption.end_time ?? start);
            return currentTime >= start && currentTime < end;
          });

          return activeCaptions.map((caption, activeIndex) => {
            const end = Number(caption.end_time ?? caption.start_time ?? 0);
            const isTemplate = Boolean(
              caption.template_id
              || caption.template_20_id
              || caption.applied_template_style?.template_id
              || caption.applied_template_style?.template_20_id
              || currentPayload.style?.template_id
              || currentPayload.style?.template_20_id
            );
            if (!isTemplate || Math.abs(end - segmentEnd) > 0.002) return null;
            const anchor = document.querySelector(`[data-caption-render-index="${activeIndex}"]`);
            if (!anchor) {
              return {
                captionId: String(caption.id || ''),
                complete: false,
                expectedWords: normalizeTokens(caption.text),
                renderedWords: [],
                reason: 'missing caption anchor',
              };
            }

            const walker = document.createTreeWalker(anchor, NodeFilter.SHOW_TEXT);
            const visibleText = [];
            const visualWords = [];
            let textNode = walker.nextNode();
            while (textNode) {
              if (
                String(textNode.nodeValue || '').trim()
                && isVisibleTextParent(textNode.parentElement, anchor)
              ) {
                visibleText.push(textNode.nodeValue);
                for (const match of String(textNode.nodeValue || '').matchAll(/\S+/g)) {
                  const range = document.createRange();
                  range.setStart(textNode, match.index);
                  range.setEnd(textNode, match.index + match[0].length);
                  const rect = Array.from(range.getClientRects())
                    .find((item) => item.width > 0 && item.height > 0);
                  range.detach?.();
                  if (!rect) continue;
                  visualWords.push({
                    text: match[0].normalize('NFC').toLocaleLowerCase(),
                    top: rect.top,
                    left: rect.left,
                  });
                }
              }
              textNode = walker.nextNode();
            }
            const expectedWords = normalizeTokens(caption.text);
            const renderedWords = normalizeTokens(visibleText.join(' '));
            const dedupedVisualWords = visualWords.filter((word, wordIndex) => (
              visualWords.findIndex((candidate) => (
                candidate.text === word.text
                && Math.abs(candidate.top - word.top) < 0.5
                && Math.abs(candidate.left - word.left) < 0.5
              )) === wordIndex
            ));
            const visualLines = new Map();
            dedupedVisualWords.forEach((word, wordIndex) => {
              const lineKey = Math.round(word.top / 4) * 4;
              const lineWords = visualLines.get(lineKey) || [];
              lineWords.push({ ...word, wordIndex });
              visualLines.set(lineKey, lineWords);
            });
            const renderedLineTexts = Array.from(visualLines.entries())
              .sort(([topA], [topB]) => topA - topB)
              .map(([, lineWords]) => lineWords
                .sort((left, right) => left.left - right.left || left.wordIndex - right.wordIndex)
                .map((word) => word.text)
                .join(' ')
                .trim())
              .filter(Boolean);
            const expectedLineTexts = Array.isArray(caption.preview_template_line_texts)
              ? caption.preview_template_line_texts
                .map((line) => normalizeTokens(line).join(' '))
                .filter(Boolean)
              : [];
            const lineComplete = expectedLineTexts.length === 0
              || (
                expectedLineTexts.length === renderedLineTexts.length
                && expectedLineTexts.every((line, lineIndex) => line === renderedLineTexts[lineIndex])
              );
            const emphasisByLine = new Map();
            Array.from(anchor.querySelectorAll('.is-emphasis')).forEach((word) => {
              if (!isVisibleTextParent(word, anchor)) return;
              const line = word.parentElement || anchor;
              const lineWords = emphasisByLine.get(line) || [];
              const styles = getComputedStyle(word);
              lineWords.push({
                text: String(word.textContent || '').trim(),
                color: styles.color,
                underlined: styles.textDecorationLine.includes('underline')
                  || (styles.borderBottomStyle !== 'none' && parseFloat(styles.borderBottomWidth) > 0),
              });
              emphasisByLine.set(line, lineWords);
            });
            const pairedEmphasisLines = Array.from(emphasisByLine.values())
              .filter((lineWords) => lineWords.length >= 2);
            return {
              captionId: String(caption.id || ''),
              complete: containsWordSequence(renderedWords, expectedWords) && lineComplete,
              expectedWords,
              renderedWords,
              expectedLineTexts,
              renderedLineTexts,
              pairedEmphasisLines,
              pairedEmphasisColorsMatch: pairedEmphasisLines.every((lineWords) => (
                new Set(lineWords.map((word) => word.color)).size === 1
              )),
              pairedEmphasisUnderlinesMatch: pairedEmphasisLines.every((lineWords) => (
                !lineWords.some((word) => word.underlined)
                || lineWords.every((word) => word.underlined)
              )),
              script: caption.__export_script || 'latin',
            };
          }).filter(Boolean);
        }, payload, renderTime, segment.end);
        completenessAudits.push(...endingCaptionAudits);
        const incompleteAudit = endingCaptionAudits.find((audit) => !audit.complete);
        if (incompleteAudit) {
          throw new Error(
            `[Template DOM] incomplete final template frame for caption ${incompleteAudit.captionId}: `
            + `expected=${JSON.stringify(incompleteAudit.expectedWords)} `
            + `rendered=${JSON.stringify(incompleteAudit.renderedWords)} `
            + `expected_lines=${JSON.stringify(incompleteAudit.expectedLineTexts)} `
            + `rendered_lines=${JSON.stringify(incompleteAudit.renderedLineTexts)}`
          );
        }

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

    if (process.env.TEMPLATE_OVERLAY_DEBUG === '1') {
      const debugInfo = await page.evaluate(() => {
        const word = document.querySelector('.lekha-original-template .w');
        const container = word ? word.parentElement : null;
        const block = document.querySelector('.lekha-original-template .sblock, .lekha-original-template [class*="-block"]');
        const describe = (el) => el ? {
          tag: el.tagName,
          className: String(el.className),
          fontSize: getComputedStyle(el).fontSize,
          fontFamily: getComputedStyle(el).fontFamily,
          transform: getComputedStyle(el).transform,
        } : null;
        const fontRules = [];
        if (word) {
          for (const sheet of document.styleSheets) {
            let rules = [];
            try { rules = sheet.cssRules || []; } catch { continue; }
            for (const rule of rules) {
              if (!rule.selectorText || !rule.style || !rule.style.fontSize) continue;
              try {
                if (word.matches(rule.selectorText)) {
                  fontRules.push({ selector: rule.selectorText, fontSize: rule.style.fontSize, priority: rule.style.getPropertyPriority('font-size') });
                }
              } catch { /* invalid selector for matches() */ }
            }
          }
        }
        return {
          word: describe(word),
          container: describe(container),
          block: describe(block),
          fontRules,
          shellHtml: (document.querySelector('.template-caption-shell')?.outerHTML || '').slice(0, 600),
        };
      });
      console.log('[Template DOM debug]', JSON.stringify(debugInfo, null, 2));
    }

    const lastFramePath = frameFiles[lastIndex] || blankFramePath;
    frameLines.push(`file '${toForwardSlash(lastFramePath).replace(/'/g, "'\\''")}'`);

    await fs.writeFile(path.join(outputDir, 'frames.txt'), `${frameLines.join('\n')}\n`, 'utf8');
    await fs.writeFile(path.join(outputDir, 'segments.json'), JSON.stringify(segments, null, 2), 'utf8');
    await fs.writeFile(
      path.join(outputDir, 'template-completeness-audit.json'),
      JSON.stringify(completenessAudits, null, 2),
      'utf8',
    );
    if (shouldAuditWordPositions) {
      await fs.writeFile(
        path.join(outputDir, 'word-position-audit.json'),
        JSON.stringify(wordPositionAudits, null, 2),
        'utf8',
      );
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
