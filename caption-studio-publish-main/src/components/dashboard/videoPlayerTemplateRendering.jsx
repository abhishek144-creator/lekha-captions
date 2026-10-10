// Template caption rendering for VideoPlayer: template id/line/emphasis helpers,
// applied sidebar/basic/advanced template builders and their React renderers.
// Extracted verbatim from VideoPlayer.jsx; the player component lives there.
import React, { useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { resolveScriptFont, loadGoogleFont } from './fontUtils';
import {
  ADVANCED_IMP_ENTRANCES,
  ADVANCED_TEMPLATE_EMPHASIS_COLORS,
  ADVANCED_TEMPLATE_TIMING,
  LC_TEMPLATE_TIMING,
  LEGACY_IMP_ANIMS,
  LEGACY_TEMPLATE_TIMING,
  LEGACY_WBW_CLASSES,
  fitLcMotionScheduleToCaption,
  getLcMotionSchedule,
  ORIGINAL_TEMPLATE_BLOCK_TYPES,
  RECREATED_ADVANCED_TEMPLATE_IDS,
  getAdvancedPlaybackElapsedMs,
  getOriginalTemplateBlockType,
  isKeyframeAdvancedTemplateId,
  KEYFRAME_TEMPLATE_FONTS,
  normalizeTemplatePhaseIndex,
  seekKeyframeTemplateAnimations,
} from './templateMotionConfig';
import {
  extractAdvancedTemplateBlockMarkup,
  extractAdvancedTemplateCardMarkup,
} from './advancedTemplateSourceUtils';
import originalTemplateHtml from '../../assets/lekha-captions-T11-T35.html?raw';
import {
  APPLIED_TEMPLATE_HOST_OVERRIDES,
  OriginalAdvancedTemplateStyles,
} from './videoPlayerTemplateStyles';
import sidebarLegacyTemplateHtml from '../../assets/lekha-captions-20-templates.html?raw';
import sidebarLcTemplateHtml2 from '../../assets/lekha-captions-lc-2.html?raw';
import sidebarLcTemplateHtml3 from '../../assets/lekha-captions-lc-3.html?raw';
import sidebarLcTemplateHtml4 from '../../assets/lekha-captions-lc-4.html?raw';
import sidebarLcTemplateHtml5 from '../../assets/lekha-captions-lc-5.html?raw';
import {
  isSourceBasicTemplateId,
  sanitizeAppliedTemplateMarkup,
  extractAppliedTemplateDiv,
  _astEscape,
  _astCleanClass,
  _astMappedClass,
  escapeRegExp,
  updateAppliedBasicTemplateWordState,
  _buildAppliedBasicTemplateInlineUncached,
  countAppliedBasicTemplatePhasesFromMarkup,
  findAppliedBasicTemplateMarkup as findAppliedBasicTemplateMarkupFromHtml,
  APPLIED_BASIC_TEMPLATE_HOST_OVERRIDES,
  getAppliedBasicCurrentWordIndex,
} from './basicTemplateInline.js';


import {
  captionHasCreativelyPositionedWords,
  computeEffectCSS,
  computeWordEffectCSS,
  wordHasCreativePosition,
  wireSourceTemplateWordEditing,
} from './videoPlayerWordEditing.js';
import {
  isAdvancedTemplateId,
  splitCaptionForTemplate,
  splitTemplateLines,
  resolveTemplatePreviewLines,
  shouldCompactTemplateLine,
  usesComplexTemplateScript,
  splitBattleCryIndexedLines,
  splitCompactIndexedLines,
  normalizeImpWordIndices,
  normalizeTemplateWord,
  getTargetPhraseImpWordIndices,
  resolveImpWordIndicesForWords,
  extractHtmlStyle,
  RECREATED_ADVANCED_WBW_PHASES,
  getRecreatedAdvancedWbwImpClass,
  shouldRecreateAdvancedWbwPhase,
  shouldSuppressStyledSemanticEmphasis,
} from './templateTextRules.js';

export {
  isAdvancedTemplateId,
  splitCaptionForTemplate,
  splitTemplateLines,
  resolveTemplatePreviewLines,
  shouldCompactTemplateLine,
  usesComplexTemplateScript,
  splitBattleCryIndexedLines,
  splitCompactIndexedLines,
  normalizeImpWordIndices,
  normalizeTemplateWord,
  getTargetPhraseImpWordIndices,
  resolveImpWordIndicesForWords,
  extractHtmlStyle,
  RECREATED_ADVANCED_WBW_PHASES,
  getRecreatedAdvancedWbwImpClass,
  shouldRecreateAdvancedWbwPhase,
  shouldSuppressStyledSemanticEmphasis,
};


export const ADVANCED_TEMPLATE_VARIANTS = {
  t01: 'wbw-rise', t02: 'plain-s', t03: 'wbw-rise', t04: 'plain-s', t05: 'wbw-rise',
  t06: 'wbw-rise', t07: 'wbw-rise', t08: 'wbw-rise', t09: 'wbw-rise', t10: 'wbw-rise',
  t11: 'wbw-slide', t12: 'plain-s', t13: 'wbw-rise', t14: 'wbw-slide', t15: 'plain-s',
  t16: 'wbw-rise', t17: 'wbw-slide', t18: 'wbw-rise', t19: 'wbw-rise', t20: 'plain-s',
  t21: 'wbw-rise', t22: 'wbw-rise', t23: 'wbw-rise', t24: 'wbw-rise', t25: 'wbw-slide',
  t26: 'wbw-rise', t27: 'plain-s', t28: 'wbw-rise', t29: 'wbw-rise', t30: 'wbw-slide',
  t31: 'wbw-rise', t32: 'plain-s', t33: 'wbw-rise', t34: 'wbw-rise', t35: 'wbw-rise',
  t36: 'plain-s', t37: 'wbw-rise', t38: 'wbw-slide', t39: 'wbw-rise', t40: 'plain-s',
  t41: 'wbw-rise', t42: 'wbw-slide', t43: 'wbw-rise', t44: 'wbw-rise', t45: 'wbw-rise',
  t46: 'wbw-rise', t47: 'wbw-rise', t48: 'wbw-rise', t49: 'wbw-rise', t50: 'wbw-rise',
  t51: 'wbw-rise', t52: 'wbw-rise',
};
export const TEMPLATE_CANVAS_FONT_SCALE = 0.88;
export const SIDEBAR_TEMPLATE_APPLIED_WIDTH_CAP = 320;

// Left-gallery templates size their words in their own CSS (LC uses cqw, a
// share of the box width), so the Font Size slider scales the whole template
// visually: transform scale(font_size / the size it was applied at), around
// its centre. CSS zoom was not used: it resolves cqw differently per browser.
// Styles saved before template_font_size existed keep scale 1. The export
// page runtime (render_template_page_runtime.mjs) applies the same formula.
export function getSidebarTemplateZoom(style) {
  const designed = Number(style?.template_font_size);
  const chosen = Number(style?.font_size);
  if (!(designed > 0) || !(chosen > 0)) return 1;
  return Math.min(2.5, Math.max(0.5, chosen / designed));
}
export const sidebarLcTemplateHtml = [
  sidebarLcTemplateHtml2,
  sidebarLcTemplateHtml3,
  sidebarLcTemplateHtml4,
  sidebarLcTemplateHtml5,
].join('\n');
export const LC_TEMPLATE_FONT_IMPORT = "@import url('https://fonts.googleapis.com/css2?family=Archivo:ital,wght@0,500;0,600;0,700;0,800;0,900;1,600&family=Fraunces:ital,opsz,wght@1,9..144,500;1,9..144,700&family=Great+Vibes&display=swap');";


export function isRecreatedAdvancedTemplateId(templateId) {
  return RECREATED_ADVANCED_TEMPLATE_IDS.includes(String(templateId || '').trim());
}

export function hasSidebarTemplateStyle(captionStyle) {
  return !!captionStyle?.template_20_id || String(captionStyle?.template_id || '').startsWith('sidebar-')
}

export function getTemplateWrapperClassName(templateId) {
  if (!isAdvancedTemplateId(templateId)) return 'cap-text';
  return templateId;
}

export function getTemplateContainerStateClass() {
  return '';
}

export function getTemplateVariantClassName(templateId) {
  return ADVANCED_TEMPLATE_VARIANTS[templateId] || 'wbw-rise';
}

export function getBasicTemplateWordClassName(templateId, isPast, isCurrent, isEmphasis) {
  return [
    'word',
    'active',
    isPast ? 'done' : '',
    isCurrent ? 'current' : '',
    isEmphasis ? 'imp' : '',
  ].filter(Boolean).join(' ');
}

export function scaleTemplateFontSize(fontSize) {
  return Math.max(12, Math.round((fontSize || 18) * TEMPLATE_CANVAS_FONT_SCALE));
}


export function splitWordsIntoIndexedLines(words = [], maxLines = 2) {
  if (!words.length) return [];
  const lineCount = Math.max(1, Math.min(maxLines, words.length));
  const lines = Array.from({ length: lineCount }, () => []);
  words.forEach((word, wordIndex) => {
    lines[Math.min(lineCount - 1, Math.floor((wordIndex * lineCount) / words.length))].push({ word, wordIndex });
  });
  return lines.filter(line => line.length);
}


export function getSidebarTemplateLineCount(style = {}, wordCount = 0) {
  const templateClass = String(style.template_class || style.template_20_id || '').toLowerCase();
  const layout = style.template_layout || '';
  if (wordCount <= 3) return 1;
  if (layout === 'stack') return 3;
  if (layout === 'plain') return Math.min(2, wordCount);
  if (/^(a[145]|b[145]|c[1345]|d[12345]|t0[135789]|t1[1345]|v)/.test(templateClass)) return 3;
  return 2;
}

export function getSidebarTemplateMotion(style = {}) {
  const templateClass = String(style.template_class || style.template_20_id || '').toLowerCase();
  const templateEffect = String(style.template_effect || '').toLowerCase();
  const motionKey = `${templateEffect} ${templateClass}`;
  if (/flip|a1|t01|t11|v3/.test(motionKey)) return 'flip';
  if (/slide|slider|a2|t03|t09|v4/.test(motionKey)) return 'slide';
  if (/roll|a5|t14/.test(motionKey)) return 'roll';
  if (/diag|d/.test(motionKey)) return 'diag';
  if (/wipe|stencil/.test(motionKey)) return 'wipe';
  if (/plain/.test(style.template_layout || '')) return 'fade';
  return 'rise';
}

export function renderTextWithHero(text, className = '') {
  const { hero, full } = splitCaptionForTemplate(text);
  if (!full) return null;
  const words = full.split(/\s+/).filter(Boolean);
  const heroIndex = className && hero ? words.findIndex((word) => word === hero) : -1;
  return (
    <>
      {words.map((word, index) => (
        <React.Fragment key={`${word}-${index}`}>
          {index > 0 && ' '}
          <span
            className={index === heroIndex ? className : 'plain-word'}
            data-w={index}
            data-imp={index === heroIndex ? 'true' : undefined}
            data-imp-cls={index === heroIndex ? className : undefined}
          >
            {word}
          </span>
        </React.Fragment>
      ))}
    </>
  );
}

export function renderStillFramesText(text) {
  return <span className="still-frames-line">{renderTextWithHero(text, 'imp-rose still-frames-highlight')}</span>;
}

export function renderWbwText(text, variant = 'wbw-rise', impClass = 'imp-bold', active = true, options = {}) {
  const { hero, full } = splitCaptionForTemplate(text);
  if (!full) return null;
  const tokens = full.split(/\s+/).filter(Boolean).map(word => ({ word }));
  const heroIndex = Math.max(0, tokens.findIndex((token) => token.word === hero));
  const resolvedImpWordIndices = options.impWordIndices?.length
    ? resolveImpWordIndicesForWords(tokens, -1, options.impWordIndices)
    : resolveImpWordIndicesForWords(tokens);
  const emphasisIndices = new Set(
    resolvedImpWordIndices.length ? resolvedImpWordIndices : [heroIndex],
  );
  const lineMotion = String(options.motion || '');
  const lineClassName = String(options.lineClassName || '');
  const indexedLines = options.compactLines
    ? splitCompactIndexedLines(tokens, options.lineTexts)
    : [];

  if (indexedLines.length > 1) {
    return (
      <span
        className={`${variant} lekha-template-fit lekha-template-preview-lines${lineClassName ? ` ${lineClassName}` : ''}`}
        data-type={variant}
        data-line-motion={lineMotion || undefined}
      >
        {indexedLines.map((line, lineIndex) => (
          <span key={`compact-line-${lineIndex}`} className="lekha-template-preview-line">
            {line.map((token, localIndex) => (
              <React.Fragment key={`${token.word}-${token.wordIndex}`}>
                {localIndex > 0 && ' '}
                <span
                  className={`w${emphasisIndices.has(token.wordIndex) ? ` ${impClass}` : ''}${active ? ' in' : ''}`}
                  data-i={token.wordIndex}
                  data-line-motion={lineMotion || undefined}
                  data-imp={emphasisIndices.has(token.wordIndex) ? 'true' : undefined}
                  data-imp-cls={emphasisIndices.has(token.wordIndex) ? impClass : undefined}
                  style={{ '--wbw-delay': `${token.wordIndex * 65}ms` }}
                >
                  {token.word}
                </span>
              </React.Fragment>
            ))}
          </span>
        ))}
      </span>
    );
  }

  return (
    <span
      className={`${variant} lekha-template-fit${lineClassName ? ` ${lineClassName}` : ''}`}
      data-type={variant}
      data-line-motion={lineMotion || undefined}
    >
      {tokens.map((token, index) => (
        <React.Fragment key={`${token.word}-${index}`}>
          {index > 0 && ' '}
          <span
            className={`w${emphasisIndices.has(index) ? ` ${impClass}` : ''}${active ? ' in' : ''}`}
            data-i={index}
            data-line-motion={lineMotion || undefined}
            data-imp={emphasisIndices.has(index) ? 'true' : undefined}
            data-imp-cls={emphasisIndices.has(index) ? impClass : undefined}
            style={{ '--wbw-delay': `${index * 65}ms` }}
          >
            {token.word}
          </span>
        </React.Fragment>
      ))}
    </span>
  );
}

// Fallback (no DOMParser) markup for the keyframe-driven T41–T52 phases. It
// mirrors the authored source structure: one word line inside the phase block,
// plus the chat thread wrapper and typing dots for T44.
export function renderKeyframeTemplateLine(templateId, blockIndex, blockType, text, impWordIndices = []) {
  const containerClass = blockType === 'styled' ? 'wbw-seq' : blockType;
  // Words stay without the legacy `.in` class: keyframes, not WBW frames, reveal them.
  const line = renderWbwText(text, `${containerClass} ${templateId}-line`, `imp-${templateId}`, false, { impWordIndices });
  if (templateId !== 't44') return line;
  return (
    <span className={`t44-thread ${blockIndex % 2 ? 't44-me' : 't44-them'}`}>
      <span className="t44-typing" aria-hidden="true">
        <span className="t44-dot" />
        <span className="t44-dot" />
        <span className="t44-dot" />
      </span>
      {line}
    </span>
  );
}

export function renderKaraokeText(text) {
  const { full } = splitCaptionForTemplate(text);
  if (!full) return null;
  const words = full.split(/\s+/).filter(Boolean);
  const perWordDuration = Math.round(
    ADVANCED_TEMPLATE_TIMING.holdMs / (words.length + 0.5),
  );

  return (
    <span className="kf-line lekha-template-fit">
      {words.map((word, index) => (
        <React.Fragment key={`${word}-${index}`}>
          {index > 0 && ' '}
          <span className="kf-word" style={{ '--kf-delay': `${index * perWordDuration}ms`, '--kf-duration': `${perWordDuration}ms` }}>
            <span className="kf-base">{word}</span>
            <span className="kf-fill">{word}</span>
          </span>
        </React.Fragment>
      ))}
    </span>
  );
}

// One fixed highlight color per advanced template, matching that template's
// own theme (its dominant imp-* class color). This pins a single consistent
// emphasis color per template instead of a per-caption rotating palette.
export function resolveAdvancedTemplateEmphasisColor(templateId, emphasisColor = '', blockIndex = -1) {
  const normalizedId = String(templateId || '').trim();
  if (normalizedId === 't23' && Number(blockIndex) === 3) {
    return '#ffffff';
  }
  return emphasisColor || ADVANCED_TEMPLATE_EMPHASIS_COLORS[normalizedId] || '';
}



export function findAppliedSidebarTemplateMarkup(captionStyle = {}) {
  const className = String(captionStyle?.template_class || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (!className) return '';
  const source = captionStyle?.template_source === 'lekha-lc'
    ? sidebarLcTemplateHtml
    : sidebarLegacyTemplateHtml;
  const cardClassToken = 'card';
  // Match the SPECIFIC template's card (class="card a1"), not just the first card.
  const scopedMatch = source.match(new RegExp(`class="[^"]*\\b${escapeRegExp(cardClassToken)}\\b[^"]*\\b${escapeRegExp(className)}\\b[^"]*"`, 'i'));
  const scoped = scopedMatch ? scopedMatch.index : -1;
  // No first-card fallback: silently rendering a DIFFERENT template on a lookup
  // miss (renamed/removed class) is worse than degrading to the plain styled
  // caption path, and it masks the actual failure.
  if (scoped < 0) return '';
  return extractAppliedTemplateDiv(source, scoped);
}

export function findAppliedBasicTemplateMarkup(captionStyle = {}) {
  return findAppliedBasicTemplateMarkupFromHtml(originalTemplateHtml, captionStyle);
}

export function resolveAppliedBasicTemplateMarkup(captionStyle = {}) {
  const templateId = String(captionStyle?.template_id || '').trim();
  const rawMarkup = String(captionStyle?.template_markup || '').trim();
  if (!isSourceBasicTemplateId(templateId)) return rawMarkup;

  const markupMatchesTemplate = rawMarkup
    && /\bbtcard\b/.test(rawMarkup)
    && new RegExp(`\\b${escapeRegExp(templateId)}\\b`).test(rawMarkup);

  return markupMatchesTemplate
    ? rawMarkup
    : (findAppliedBasicTemplateMarkup({ template_id: templateId }) || rawMarkup);
}

// ── In-page applied-template rendering (Phase 1) ─────────────────────────────
// Render the FULL template design (creative text placement + per-word animation
// classes) IN-PAGE — the same look the gallery preview card shows — by injecting
// the caption's words into the template's own markup and styling it with the
// template's own CSS. We do this in-page (not in an <iframe>) so ExportPanel can
// still read per-word DOM boxes for the burned-in animation export.
//
// The word→slot injection mirrors buildAppliedSidebarTemplateScript (the disabled
// iframe engine): every slot type the templates use is filled —
//   • word-by-word lines (.wbw-line .wbw-word / .wbw .w)
//   • sticky-wave lines (.sw-line .sw-w)
//   • positioned rows (.pos* .pr .sw, distributed across rows)
//   • plain lines (.plain-s)
// while preserving the template's creative per-word classes (accents like
// ns2-rose, hero rows, motion flavor) via _astMappedClass.
export const _astImpClassPattern = /\b(?:imp-[\w-]+|ns[23]-[\w-]+)\b/g;
export const _astImpClassTestPattern = /\b(?:imp-[\w-]+|ns[23]-[\w-]+)\b/;

export function _astResolveTargetImpIndex(sourceImpIndex = -1, sourceCount = 0, targetCount = 0, requestedIndex = -1) {
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
}

export function _astReplaceWBW(container, words, settled, impWordIndex = -1, impWordIndices = []) {
  if (!container || !words.length) return;
  const isNewWbw = container.classList.contains('wbw-line');
  const selector = isNewWbw ? '.wbw-word' : '.w';
  const fallback = isNewWbw ? 'wbw-word normal' : 'w';
  const visCls = settled ? (isNewWbw ? ' visible' : ' in') : '';
  const sourceClasses = Array.from(container.querySelectorAll(selector))
    .map((w) => _astCleanClass(w.className, fallback));
  const sourceLcAnims = Array.from(container.querySelectorAll(selector))
    .map((w) => w.getAttribute('data-lc-anim') || '');
  const sourceLcDurations = Array.from(container.querySelectorAll(selector))
    .map((w) => w.getAttribute('data-lc-duration') || '');
  const sourceLcEases = Array.from(container.querySelectorAll(selector))
    .map((w) => w.getAttribute('data-lc-ease') || '');
  const sourceLcDelays = Array.from(container.querySelectorAll(selector))
    .map((w) => w.getAttribute('data-lc-delay') || '');
  const sourceImpIndex = sourceClasses.findIndex((className) => _astImpClassTestPattern.test(className));
  const sourceImpClass = sourceImpIndex >= 0
    ? sourceClasses[sourceImpIndex].match(_astImpClassTestPattern)?.[0] || ''
    : '';
  const fallbackImpIndex = _astResolveTargetImpIndex(sourceImpIndex, sourceClasses.length, words.length, impWordIndex);
  const targetImpIndices = new Set(resolveImpWordIndicesForWords(words, fallbackImpIndex, impWordIndices));
  container.innerHTML = words
    .map((w, i) => {
      const mapped = _astMappedClass(sourceClasses, i, words.length, fallback)
        .replace(_astImpClassPattern, '')
        .replace(/\s+/g, ' ')
        .trim();
      const isEmphasis = targetImpIndices.has(i);
      const impClass = isEmphasis && sourceImpClass ? ` ${sourceImpClass}` : '';
      const emphasisClass = isEmphasis ? ' is-emphasis' : '';
      const lcAnim = _astMappedClass(sourceLcAnims, i, words.length, '');
      const lcDuration = _astMappedClass(sourceLcDurations, i, words.length, '');
      const lcEase = _astMappedClass(sourceLcEases, i, words.length, '');
      const lcDelay = _astMappedClass(sourceLcDelays, i, words.length, '');
      return `<span class="${mapped || fallback}${impClass}${emphasisClass}${visCls}" data-w="${i}"${lcAnim ? ` data-lc-anim="${_astEscape(lcAnim)}"` : ''}${lcDuration ? ` data-lc-duration="${_astEscape(lcDuration)}"` : ''}${lcEase ? ` data-lc-ease="${_astEscape(lcEase)}"` : ''}${lcDelay ? ` data-lc-delay="${_astEscape(lcDelay)}"` : ''}>${_astEscape(w)}</span>`;
    })
    .join(' ');
}

export function _astReplaceSticky(container, words, settled, impWordIndex, impWordIndices = []) {
  const stickies = Array.from(container.querySelectorAll('.sw-w'));
  if (!stickies.length || !words.length) return;
  const sourceClasses = stickies.map((w) => _astCleanClass(w.className, 'sw-w'));
  const sourceLcAnims = stickies.map((w) => w.getAttribute('data-lc-anim') || '');
  const sourceLcDurations = stickies.map((w) => w.getAttribute('data-lc-duration') || '');
  const sourceLcEases = stickies.map((w) => w.getAttribute('data-lc-ease') || '');
  const sourceLcDelays = stickies.map((w) => w.getAttribute('data-lc-delay') || '');
  const sourceImpIndex = sourceClasses.findIndex((className) => _astImpClassTestPattern.test(className));
  const fallbackImpIndex = _astResolveTargetImpIndex(sourceImpIndex, sourceClasses.length, words.length, impWordIndex);
  const targetImpIndices = new Set(resolveImpWordIndicesForWords(words, fallbackImpIndex, impWordIndices));
  const vis = settled ? ' in' : '';
  container.innerHTML = words
    .map((w, i) => {
      const lcAnim = _astMappedClass(sourceLcAnims, i, words.length, '');
      const lcDuration = _astMappedClass(sourceLcDurations, i, words.length, '');
      const lcEase = _astMappedClass(sourceLcEases, i, words.length, '');
      const lcDelay = _astMappedClass(sourceLcDelays, i, words.length, '');
      return `<span class="${_astMappedClass(sourceClasses, i, words.length, 'sw-w')}${targetImpIndices.has(i) ? ' is-emphasis' : ''}${vis}" data-w="${i}"${lcAnim ? ` data-lc-anim="${_astEscape(lcAnim)}"` : ''}${lcDuration ? ` data-lc-duration="${_astEscape(lcDuration)}"` : ''}${lcEase ? ` data-lc-ease="${_astEscape(lcEase)}"` : ''}${lcDelay ? ` data-lc-delay="${_astEscape(lcDelay)}"` : ''} style="${settled ? 'opacity:1' : ''}">${_astEscape(w)}</span>`;
    })
    .join(' ');
}

export function _astReplaceLcCpt(container, words, impWordIndex, impWordIndices = []) {
  const sourceSpans = Array.from(container.querySelectorAll('.w'));
  if (!sourceSpans.length || !words.length) return;
  const rows = Array.from(new Set(sourceSpans.map((span) => span.parentElement).filter(Boolean)));
  const sourceByRow = rows.map((row) => Array.from(row.querySelectorAll(':scope > .w')));
  const targetImpIndices = new Set(resolveImpWordIndicesForWords(words, impWordIndex, impWordIndices));
  const totalSourceSlots = sourceByRow.reduce((sum, rowSpans) => sum + rowSpans.length, 0);
  let wordCursor = 0;

  sourceByRow.forEach((rowSpans, rowIndex) => {
    const row = rows[rowIndex];
    const remainingRows = sourceByRow.length - rowIndex - 1;
    const proportional = Math.round((rowSpans.length / Math.max(1, totalSourceSlots)) * words.length);
    const rowWordCount = rowIndex === sourceByRow.length - 1
      ? words.length - wordCursor
      : Math.max(1, Math.min(words.length - wordCursor - remainingRows, proportional));
    const rowWords = words.slice(wordCursor, wordCursor + rowWordCount);
    const sourceClasses = rowSpans.map((span) => _astCleanClass(span.className, 'w'));
    const sourceLcAnims = rowSpans.map((span) => span.getAttribute('data-lc-anim') || '');
    const sourceLcDurations = rowSpans.map((span) => span.getAttribute('data-lc-duration') || '');
    const sourceLcEases = rowSpans.map((span) => span.getAttribute('data-lc-ease') || '');
    const sourceLcDelays = rowSpans.map((span) => span.getAttribute('data-lc-delay') || '');
    const sourceStyles = rowSpans.map((span) => String(span.getAttribute('style') || '').replace(/\banimation\s*:[^;]+;?/gi, '').trim());
    const sourceVisible = rowSpans.map((span) => span.classList.contains('on') && !span.getAttribute('data-lc-anim'));
    const sourceRowHasUnderline = rowSpans.some((span) => (
      span.matches('.ul, .ns3hero, .imp-underline')
    ));
    const createdRowSpans = [];
    row.textContent = '';
    rowWords.forEach((word, localIndex) => {
      if (localIndex > 0) row.appendChild(container.ownerDocument.createTextNode(' '));
      const wordIndex = wordCursor + localIndex;
      const span = container.ownerDocument.createElement('span');
      const className = _astMappedClass(sourceClasses, localIndex, rowWords.length, 'w')
        .replace(/\bis-emphasis\b/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      const lcAnim = _astMappedClass(sourceLcAnims, localIndex, rowWords.length, '');
      const lcDuration = _astMappedClass(sourceLcDurations, localIndex, rowWords.length, '');
      const lcEase = _astMappedClass(sourceLcEases, localIndex, rowWords.length, '');
      const lcDelay = _astMappedClass(sourceLcDelays, localIndex, rowWords.length, '');
      const sourceStyle = _astMappedClass(sourceStyles, localIndex, rowWords.length, '');
      const isVisibleStatic = _astMappedClass(sourceVisible, localIndex, rowWords.length, false);
      span.className = `${className || 'w'}${targetImpIndices.has(wordIndex) ? ' is-emphasis' : ''}${isVisibleStatic ? ' on' : ''}`;
      if (lcAnim) span.setAttribute('data-lc-anim', lcAnim);
      if (lcDuration) span.setAttribute('data-lc-duration', lcDuration);
      if (lcEase) span.setAttribute('data-lc-ease', lcEase);
      if (lcDelay) span.setAttribute('data-lc-delay', lcDelay);
      if (sourceStyle) span.setAttribute('style', sourceStyle);
      span.setAttribute('data-w', String(wordIndex));
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
}

export function _astReplacePositioned(block, words, impWordIndex, impWordIndices = [], forceContiguous = false) {
  const spans = Array.from(block.querySelectorAll('.sw'));
  if (!spans.length || !words.length) return;
  const rows = Array.from(new Set(spans.map((span) => span.parentElement).filter(Boolean)));
  const sourceByRow = rows.map((row) => Array.from(row.querySelectorAll(':scope > .sw')));
  const targetImpIndices = new Set(resolveImpWordIndicesForWords(words, impWordIndex, impWordIndices));
  if (forceContiguous && sourceByRow.length > 1) {
    const flatClasses = spans.map((span) => _astCleanClass(span.className, 'sw'));
    const flatAnims = spans.map((span) => span.getAttribute('data-anim') || 'rise');
    const flatLcAnims = spans.map((span) => span.getAttribute('data-lc-anim') || '');
    const flatLcDurations = spans.map((span) => span.getAttribute('data-lc-duration') || '');
    const flatLcEases = spans.map((span) => span.getAttribute('data-lc-ease') || '');
    const flatLcDelays = spans.map((span) => span.getAttribute('data-lc-delay') || '');
    const heroRowIndex = rows.findIndex((row) => /\b(hero|l3|bold|impact)\b/.test(row.className || ''));
    const targetRow = rows[heroRowIndex >= 0 ? heroRowIndex : rows.length - 1];
    rows.forEach((row) => { row.textContent = ''; });
    targetRow.style.paddingLeft = '0';
    targetRow.style.textAlign = 'center';
    words.forEach((word, wordIndex) => {
      if (wordIndex > 0) targetRow.appendChild(block.ownerDocument.createTextNode(' '));
      const span = block.ownerDocument.createElement('span');
      span.className = `${_astMappedClass(flatClasses, wordIndex, words.length, 'sw')}${targetImpIndices.has(wordIndex) ? ' is-emphasis' : ''}`;
      span.setAttribute('data-anim', _astMappedClass(flatAnims, wordIndex, words.length, 'rise'));
      const lcAnim = _astMappedClass(flatLcAnims, wordIndex, words.length, '');
      const lcDuration = _astMappedClass(flatLcDurations, wordIndex, words.length, '');
      const lcEase = _astMappedClass(flatLcEases, wordIndex, words.length, '');
      const lcDelay = _astMappedClass(flatLcDelays, wordIndex, words.length, '');
      if (lcAnim) span.setAttribute('data-lc-anim', lcAnim);
      if (lcDuration) span.setAttribute('data-lc-duration', lcDuration);
      if (lcEase) span.setAttribute('data-lc-ease', lcEase);
      if (lcDelay) span.setAttribute('data-lc-delay', lcDelay);
      span.setAttribute('data-w', String(wordIndex));
      span.textContent = word;
      targetRow.appendChild(span);
    });
    return;
  }
  const totalSourceSlots = sourceByRow.reduce((sum, rowSpans) => sum + rowSpans.length, 0);
  let wordCursor = 0;

  sourceByRow.forEach((rowSpans, rowIndex) => {
    const row = rows[rowIndex];
    const remainingRows = sourceByRow.length - rowIndex - 1;
    const proportional = Math.round((rowSpans.length / Math.max(1, totalSourceSlots)) * words.length);
    const rowWordCount = rowIndex === sourceByRow.length - 1
      ? words.length - wordCursor
      : Math.max(1, Math.min(words.length - wordCursor - remainingRows, proportional));
    const rowWords = words.slice(wordCursor, wordCursor + rowWordCount);
    const sourceClasses = rowSpans.map((span) => _astCleanClass(span.className, 'sw'));
    const sourceAnims = rowSpans.map((span) => span.getAttribute('data-anim') || 'rise');
    const sourceLcAnims = rowSpans.map((span) => span.getAttribute('data-lc-anim') || '');
    const sourceLcDurations = rowSpans.map((span) => span.getAttribute('data-lc-duration') || '');
    const sourceLcEases = rowSpans.map((span) => span.getAttribute('data-lc-ease') || '');
    const sourceLcDelays = rowSpans.map((span) => span.getAttribute('data-lc-delay') || '');
    row.textContent = '';
    rowWords.forEach((word, localIndex) => {
      if (localIndex > 0) row.appendChild(block.ownerDocument.createTextNode(' '));
      const span = block.ownerDocument.createElement('span');
      const wordIndex = wordCursor + localIndex;
      span.className = `${_astMappedClass(sourceClasses, localIndex, rowWords.length, 'sw')}${targetImpIndices.has(wordIndex) ? ' is-emphasis' : ''}`;
      span.setAttribute('data-anim', _astMappedClass(sourceAnims, localIndex, rowWords.length, 'rise'));
      const lcAnim = _astMappedClass(sourceLcAnims, localIndex, rowWords.length, '');
      const lcDuration = _astMappedClass(sourceLcDurations, localIndex, rowWords.length, '');
      const lcEase = _astMappedClass(sourceLcEases, localIndex, rowWords.length, '');
      const lcDelay = _astMappedClass(sourceLcDelays, localIndex, rowWords.length, '');
      if (lcAnim) span.setAttribute('data-lc-anim', lcAnim);
      if (lcDuration) span.setAttribute('data-lc-duration', lcDuration);
      if (lcEase) span.setAttribute('data-lc-ease', lcEase);
      if (lcDelay) span.setAttribute('data-lc-delay', lcDelay);
      span.setAttribute('data-w', String(wordIndex));
      span.textContent = word;
      row.appendChild(span);
    });
    wordCursor += rowWordCount;
  });
}

export function _astReplacePlain(block, words, captionText, impWordIndex, impWordIndices = []) {
  const plain = Array.from(block.querySelectorAll('.plain-s'))
    .find((el) => !el.classList.contains('wbw') && !el.classList.contains('wbw-line'));
  if (!plain || !words.length) return;
  plain.textContent = '';
  const targetImpIndices = new Set(resolveImpWordIndicesForWords(words, impWordIndex, impWordIndices));
  words.forEach((word, index) => {
    if (index > 0) plain.appendChild(block.ownerDocument.createTextNode(' '));
    const span = block.ownerDocument.createElement('span');
    span.className = targetImpIndices.has(index) ? 'is-emphasis' : 'plain-word';
    span.setAttribute('data-w', String(index));
    span.textContent = word;
    plain.appendChild(span);
  });
}

export function _astFillBlock(block, words, captionText, settled, impWordIndex, impWordIndices = [], forceContiguousPositioned = false) {
  block.querySelectorAll('.wbw, .wbw-line').forEach((c) => _astReplaceWBW(c, words, settled, impWordIndex, impWordIndices));
  block.querySelectorAll('.sw-line').forEach((c) => _astReplaceSticky(c, words, settled, impWordIndex, impWordIndices));
  block.querySelectorAll('.cpt, .nline').forEach((c) => _astReplaceLcCpt(c, words, impWordIndex, impWordIndices));
  _astReplacePositioned(block, words, impWordIndex, impWordIndices, forceContiguousPositioned);
  _astReplacePlain(block, words, captionText, impWordIndex, impWordIndices);
}

// Build the in-page HTML for one active phase of the applied template, with the
// caption's words injected. `activePhase` selects which .sblock to show (templates
// are multi-phase showcases; for an applied caption we show one phase at a time,
// cycling on the caption's own clock). `settled` reveals all words immediately
// (paused/editor look); when false the words start hidden so the entrance
// animation can play them in.
export const _appliedInlineCache = new Map();
export const _appliedMarkupSignatureCache = new Map();
export function getAppliedTemplateMarkupSignature(markup = '') {
  const source = String(markup || '');
  if (_appliedMarkupSignatureCache.has(source)) return _appliedMarkupSignatureCache.get(source);
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const signature = `${source.length}:${(hash >>> 0).toString(36)}`;
  if (_appliedMarkupSignatureCache.size > 100) _appliedMarkupSignatureCache.clear();
  _appliedMarkupSignatureCache.set(source, signature);
  return signature;
}

export function buildAppliedSidebarTemplateInline(captionText, captionStyle, { activePhase = 0, settled = true, impWordIndex = -1, impWordIndices = [] } = {}) {
  // Memoize the (expensive) markup lookup + DOMParser + word-injection on a key of the
  // inputs that actually change the output. renderAppliedSidebarTemplateCaption runs
  // on every VideoPlayer render (frequent — currentTime ticks, etc.); re-parsing the
  // markup each time would peg the CPU and freeze the renderer. Compute everything
  // (incl. the asset scan in findAppliedSidebarTemplateMarkup) ONLY on cache miss.
  const rawMarkup = captionStyle?.template_markup || findAppliedSidebarTemplateMarkup(captionStyle);
  const normalizedImpWordIndices = resolveImpWordIndicesForWords(String(captionText || '').trim().split(/\s+/).filter(Boolean), impWordIndex, impWordIndices);
  const cacheKey = `${captionStyle?.template_id || ''}|${captionStyle?.template_20_id || ''}|${captionStyle?.template_source || ''}|${captionStyle?.template_class || ''}|${captionStyle?.template_effect || ''}|${getAppliedTemplateMarkupSignature(rawMarkup)}|${activePhase}|${settled ? 1 : 0}|${JSON.stringify(normalizedImpWordIndices)}|${captionText || ''}`;
  if (_appliedInlineCache.has(cacheKey)) return _appliedInlineCache.get(cacheKey);
  const isLc = captionStyle?.template_source === 'lekha-lc';
  const forceContiguousPositioned = false;
  const result = _buildAppliedSidebarTemplateInlineUncached(rawMarkup, isLc, captionText, activePhase, settled, impWordIndex, normalizedImpWordIndices, forceContiguousPositioned);
  if (_appliedInlineCache.size > 400) _appliedInlineCache.clear();
  _appliedInlineCache.set(cacheKey, result);
  return result;
}

export function _buildAppliedSidebarTemplateInlineUncached(rawMarkup, isNew, captionText, activePhase, settled, impWordIndex, impWordIndices = [], forceContiguousPositioned = false) {
  const markup = sanitizeAppliedTemplateMarkup(rawMarkup, isNew);
  if (!markup || typeof DOMParser === 'undefined') return null;
  const words = String(captionText || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return null;

  let doc;
  try {
    doc = new DOMParser().parseFromString(markup, 'text/html');
  } catch {
    return null;
  }
  const card = doc.querySelector('.lk-card, .card');
  if (!card) return null;

  // Drop the gallery chrome (id/name/badges/dots) — only the stage renders.
  card.querySelectorAll('.lk-card-top, .card-top, .lk-dots, .dots, .lk-cid, .lk-cnm, .lk-badge, .cid, .cnm, .bg')
    .forEach((el) => el.remove());

  const blocks = Array.from(card.querySelectorAll('.sblock, .sb'));
  if (!blocks.length) return null;
  const phase = ((activePhase % blocks.length) + blocks.length) % blocks.length;
  blocks.forEach((b, i) => {
    _astFillBlock(b, words, captionText, settled, impWordIndex, impWordIndices, forceContiguousPositioned);
    b.classList.toggle('active', i === phase);
    b.style.visibility = i === phase ? 'visible' : 'hidden';
    b.style.opacity = i === phase ? '1' : '0';
    b.style.position = i === phase ? 'relative' : 'absolute';
  });

  return card.outerHTML;
}

// How many animated phases a template has (so the caption can cycle through them
// on its own clock the way the preview card does). Memoized per template — called
// on every render, and the asset scan/regex is not free.
export const _appliedPhaseCache = new Map();
export function countAppliedTemplatePhases(captionStyle = {}) {
  const rawMarkup = captionStyle?.template_markup || findAppliedSidebarTemplateMarkup(captionStyle);
  const key = `${captionStyle?.template_id || ''}|${captionStyle?.template_20_id || ''}|${captionStyle?.template_source || ''}|${captionStyle?.template_class || ''}|${captionStyle?.template_effect || ''}|${getAppliedTemplateMarkupSignature(rawMarkup)}`;
  if (_appliedPhaseCache.has(key)) return _appliedPhaseCache.get(key);
  const markup = sanitizeAppliedTemplateMarkup(rawMarkup, false);
  const matches = markup ? markup.match(/class="[^"]*\b(sblock|sb)\b/g) : null;
  const count = Math.max(1, matches ? matches.length : 1);
  if (_appliedPhaseCache.size > 200) _appliedPhaseCache.clear();
  _appliedPhaseCache.set(key, count);
  return count;
}

export function buildAppliedBasicTemplateInline(captionText, captionStyle, { activePhase = 0, currentIndex = 0, impWordIndex = -1, impWordIndices = [] } = {}) {
  const templateId = String(captionStyle?.template_id || '').trim();
  const rawMarkup = resolveAppliedBasicTemplateMarkup(captionStyle);
  const normalizedImpWordIndices = normalizeImpWordIndices(impWordIndex, impWordIndices);
  const cacheKey = `basic|${templateId}|${getAppliedTemplateMarkupSignature(rawMarkup)}|${activePhase}|${JSON.stringify(normalizedImpWordIndices)}|${captionText || ''}`;
  if (_appliedInlineCache.has(cacheKey)) return _appliedInlineCache.get(cacheKey);
  const result = _buildAppliedBasicTemplateInlineUncached(rawMarkup, templateId, captionText, activePhase, currentIndex, impWordIndex, normalizedImpWordIndices);
  if (_appliedInlineCache.size > 400) _appliedInlineCache.clear();
  _appliedInlineCache.set(cacheKey, result);
  return result;
}

export function countAppliedBasicTemplatePhases(captionStyle = {}) {
  const rawMarkup = resolveAppliedBasicTemplateMarkup(captionStyle);
  const key = `basic-phase|${captionStyle?.template_id || ''}|${getAppliedTemplateMarkupSignature(rawMarkup)}`;
  if (_appliedPhaseCache.has(key)) return _appliedPhaseCache.get(key);
  const count = countAppliedBasicTemplatePhasesFromMarkup(rawMarkup);
  if (_appliedPhaseCache.size > 200) _appliedPhaseCache.clear();
  _appliedPhaseCache.set(key, count);
  return count;
}

// The left sidebar templates' own CSS (extracted from the HTML assets), minus the
// document-level resets (html/body/*/.grid) that would corrupt the host app.
// Injected globally once; the template classes (.card/.sw/.wbw-word/.pos*/…)
// don't appear anywhere else in-page (the gallery renders them inside iframes),
// so this is effectively scoped in practice. Host-sizing overrides below undo the
// fixed card/stage box so the design renders as a transparent caption overlay.
export const _appliedTemplateCssCache = new Map();
export function findCssRuleClose(css = '', openIndex = -1) {
  if (openIndex < 0) return -1;
  let depth = 0;
  for (let index = openIndex; index < css.length; index += 1) {
    const char = css[index];
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

export function scopeAppliedLcSelectorList(selectorList = '') {
  return String(selectorList || '')
    .split(',')
    .map((selector) => selector.trim())
    .filter(Boolean)
    .filter((selector) => !/^(?:html|body|:root|\.grid|\.lk-grid)$/i.test(selector))
    .map((selector) => (
      selector.startsWith('.lekha-applied-template-host')
        ? selector
        : `.lekha-applied-template-host ${selector}`
    ))
    .join(', ');
}

export function scopeAppliedLcTemplateCss(css = '') {
  const source = String(css || '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/@import[^;]+;/gi, '');
  let index = 0;
  let output = '';

  while (index < source.length) {
    const openIndex = source.indexOf('{', index);
    if (openIndex < 0) break;

    const prelude = source.slice(index, openIndex).trim();
    const closeIndex = findCssRuleClose(source, openIndex);
    if (closeIndex < 0) break;

    const body = source.slice(openIndex + 1, closeIndex);
    const lowerPrelude = prelude.toLowerCase();

    if (lowerPrelude.startsWith('@keyframes') || lowerPrelude.startsWith('@-webkit-keyframes')) {
      output += `${prelude}{${body}}\n`;
    } else if (
      lowerPrelude.startsWith('@media')
      || lowerPrelude.startsWith('@supports')
      || lowerPrelude.startsWith('@container')
    ) {
      const nested = scopeAppliedLcTemplateCss(body);
      if (nested.trim()) output += `${prelude}{${nested}}\n`;
    } else if (!prelude.startsWith('@')) {
      const scopedSelectors = scopeAppliedLcSelectorList(prelude);
      if (scopedSelectors) output += `${scopedSelectors}{${body}}\n`;
    }

    index = closeIndex + 1;
  }

  return output;
}

export const getAppliedLcAnimationName = (name = '') => `lekhaLc-${String(name).trim().replace(/[^a-zA-Z0-9_-]/g, '')}`;

export function namespaceAppliedLcKeyframes(css = '') {
  return String(css).replace(
    /@(keyframes|-webkit-keyframes)\s+([a-zA-Z_][\w-]*)/g,
    (_, rule, name) => `@${rule} ${getAppliedLcAnimationName(name)}`,
  );
}

export function extractAppliedTemplateCss(source = 'lekha-20') {
  if (_appliedTemplateCssCache.has(source)) return _appliedTemplateCssCache.get(source);
  const raw = source === 'lekha-lc'
    ? extractHtmlStyle(sidebarLcTemplateHtml)
    : extractHtmlStyle(sidebarLegacyTemplateHtml);
  const stripped = source === 'lekha-lc'
    ? raw
    : raw.replace(
      /(^|\})\s*(?:html|body|\*|:root|\.lk-grid|\.grid)\b[^{}]*\{[^}]*\}/gi,
      '$1',
    );
  const scoped = source === 'lekha-lc'
    ? scopeAppliedLcTemplateCss(namespaceAppliedLcKeyframes(stripped))
    : stripped;
  _appliedTemplateCssCache.set(source, scoped);
  return scoped;
}


export function AppliedSidebarTemplateStyles({ source = 'lekha-20' }) {
  const css = React.useMemo(() => `${source === 'lekha-lc' ? `${LC_TEMPLATE_FONT_IMPORT}\n` : ''}${extractAppliedTemplateCss(source)}\n${APPLIED_TEMPLATE_HOST_OVERRIDES}`, [source]);
  return <style>{css}</style>;
}

export const APPLIED_BASIC_TEMPLATE_PREVIEW_ONLY_OVERRIDES = `
  .lekha-applied-basic-template-host [data-source-word-index] {
    display: inline-block !important;
    position: relative !important;
    overflow: visible !important;
    vertical-align: baseline !important;
  }
  .lekha-applied-basic-template-host [data-source-word-styled="true"] {
    transform: none !important;
    opacity: 1 !important;
    animation: none !important;
    transition: none !important;
    clip-path: none !important;
  }
  .lekha-applied-basic-template-host [data-source-word-visual="true"] {
    display: inline-block !important;
    position: absolute !important;
    left: 0 !important;
    top: 0 !important;
    z-index: 6 !important;
    transform-origin: center center !important;
    vertical-align: baseline !important;
    white-space: nowrap !important;
    pointer-events: none !important;
  }
  .lekha-applied-basic-template-host [data-source-word-spacer="true"] {
    display: inline-block !important;
    visibility: hidden !important;
    white-space: inherit !important;
    pointer-events: none !important;
  }
  .lekha-applied-basic-template-host [data-source-word-gradient="true"] [data-source-word-visual="true"],
  .lekha-applied-basic-template-host [data-source-word-gradient="true"] [data-source-word-visual="true"] * {
    background: var(--source-word-text-gradient) !important;
    background-image: var(--source-word-text-gradient) !important;
    background-size: 100% 100% !important;
    background-repeat: no-repeat !important;
    background-position: center !important;
    -webkit-background-clip: text !important;
    background-clip: text !important;
    -webkit-text-fill-color: transparent !important;
    color: transparent !important;
  }
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
  .lekha-applied-basic-template-host.t-104 .t-104 .word.current,
  .lekha-applied-basic-template-host.t-104 .t-104 .word.imp.current {
    color: var(--template-primary, #fff) !important;
    -webkit-text-fill-color: var(--template-primary, #fff) !important;
    -webkit-text-stroke: 2px var(--template-secondary, #B28DFF) !important;
    text-shadow: 0 0 6px var(--template-secondary, #2563EB),
      0 0 12px var(--template-secondary, #2563EB) !important;
    filter: drop-shadow(1px 1px 2px rgba(0, 0, 0, .75))
      drop-shadow(0 0 8px var(--template-secondary, #2563EB)) !important;
  }
  .lekha-applied-basic-template-host.t-109 .t-109 .word.current,
  .lekha-applied-basic-template-host.t-109 .t-109 .word.imp.current {
    text-shadow: 3px 3px 0 var(--template-secondary, #FF4500) !important;
    filter: none !important;
  }
  .lekha-applied-basic-template-host.t-109 .t-109 .word.current {
    color: var(--template-primary, #fff) !important;
    -webkit-text-fill-color: var(--template-primary, #fff) !important;
  }
  .lekha-applied-basic-template-host.t-109 .t-109 .word.imp.current {
    color: var(--template-primary, #fff) !important;
    -webkit-text-fill-color: var(--template-primary, #fff) !important;
  }
`;

export function AppliedBasicTemplateStyles() {
  return <style>{`${APPLIED_BASIC_TEMPLATE_HOST_OVERRIDES}\n${APPLIED_BASIC_TEMPLATE_PREVIEW_ONLY_OVERRIDES}`}</style>;
}

export function AppliedBasicTemplateMarkup({
  caption,
  captionId,
  templateId,
  selectedPhase,
  text,
  html,
  currentIndex,
  wordCount,
  currentTime = 0,
  isPlaying = false,
  videoRef,
  hostStyle,
  renderScale = 1,
  onSourceWordClick,
  onSourceWordPointerDown,
  isSelected = false,
}) {
  const hostRef = useRef(null);
  const lastCurrentIndexRef = useRef(-1);
  const hasTextGradient = Boolean(hostStyle?.['--template-text-gradient'] && hostStyle['--template-text-gradient'] !== 'none');
  const hasHighlightGradient = Boolean(hostStyle?.['--template-highlight-gradient'] && hostStyle['--template-highlight-gradient'] !== 'none');
  const wordStylesSignature = JSON.stringify(caption?.wordStyles || {});
  const hasCptWords = captionHasCreativelyPositionedWords(caption);

  const applyCurrentIndex = useCallback((nextIndex) => {
    const normalizedIndex = Math.max(0, Math.min(Math.max(1, wordCount) - 1, Number(nextIndex) || 0));
    if (lastCurrentIndexRef.current === normalizedIndex) return;
    lastCurrentIndexRef.current = normalizedIndex;
    updateAppliedBasicTemplateWordState(hostRef.current, normalizedIndex, wordCount, templateId);
  }, [templateId, wordCount]);

  useEffect(() => {
    lastCurrentIndexRef.current = -1;
    applyCurrentIndex(currentIndex);
  }, [applyCurrentIndex, currentIndex, html]);

  useEffect(() => {
    if (hasCptWords) {
      applyCurrentIndex(currentIndex);
      return undefined;
    }
    if (!isPlaying) {
      applyCurrentIndex(getAppliedBasicCurrentWordIndex(caption, currentTime, wordCount));
      return undefined;
    }

    let rafId = 0;
    const tick = () => {
      const playbackTime = Number(videoRef?.current?.currentTime);
      const effectiveTime = Number.isFinite(playbackTime) ? playbackTime : currentTime;
      applyCurrentIndex(getAppliedBasicCurrentWordIndex(caption, effectiveTime, wordCount));
      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [applyCurrentIndex, caption, currentIndex, currentTime, hasCptWords, isPlaying, videoRef, wordCount]);

  useLayoutEffect(() => {
    const cleanup = wireSourceTemplateWordEditing(hostRef.current, {
      caption,
      renderScale,
      emphasisColor: hostStyle?.['--template-highlight'],
      onSourceWordClick,
      onSourceWordPointerDown,
      currentTime,
      isPlaying,
      templateBlockType: 'wbw-rise',
      templateSource: 'lekha-basic',
    });
    applyCurrentIndex(currentIndex);
    return cleanup;
  }, [applyCurrentIndex, caption, currentIndex, currentTime, hostStyle, html, isPlaying, onSourceWordClick, onSourceWordPointerDown, renderScale, wordStylesSignature]);

  return (
    <>
      <AppliedBasicTemplateStyles />
      <span
        ref={hostRef}
        key={`applied-basic-tpl-${captionId || 'active'}-${templateId || 'tpl'}-${selectedPhase}-${text}`}
        className={[
          'lekha-applied-basic-template-host',
          'lekha-basic-template-fit',
          'lekha-basic-template-enter-once',
          templateId || '',
          hasTextGradient ? 'has-text-gradient' : '',
          hasHighlightGradient ? 'has-highlight-gradient' : '',
        ].filter(Boolean).join(' ')}
        data-applied-template-id={templateId || ''}
        data-applied-template-source="lekha-basic"
        data-export-measure="basic-template"
        data-export-caption-id={captionId || ''}
        data-basic-current-index={currentIndex}
        data-basic-word-count={wordCount}
        data-basic-playing={isPlaying ? 'true' : 'false'}
        data-applied-template-selected={isSelected ? 'true' : 'false'}
        style={hostStyle}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </>
  );
}

export const APPLIED_WBW_CLASSES = [
  ...LEGACY_WBW_CLASSES,
  'wbw-rise', 'wbw-slide', 'wbw-seq', 'wbw-seq-flip', 'wbw-seq-fade',
];

export const APPLIED_LEGACY_TEMPLATE_TIMING = LEGACY_TEMPLATE_TIMING;
export const APPLIED_IMP_ANIMS = LEGACY_IMP_ANIMS;

export function AppliedSidebarTemplateSourceRenderer({
  html,
  caption,
  captionId,
  captionText,
  effectiveStyle,
  resolvedFont,
  fontSize,
  currentTime = 0,
  isPlaying = false,
  videoRef,
  startTime = 0,
  endTime = 0,
  phaseOffset = 0,
  emphasisColor = '',
  renderScale = 1,
  onSourceWordClick,
  onSourceWordPointerDown,
  isSelected = false,
}) {
  const hostRef = useRef(null);
  const runnerRef = useRef(null);
  const playbackControlRef = useRef({ currentTime, isPlaying });
  const playStateRef = useRef({ currentTime, isPlaying, startTime, endTime });
  playStateRef.current = { currentTime, isPlaying, startTime, endTime };
  const configuredAccent = String(
    emphasisColor
      || effectiveStyle?.highlight_color
      || effectiveStyle?.emphasis_color
      || effectiveStyle?.secondary_color
      || '',
  ).trim();
  const textColor = String(effectiveStyle?.text_color || '#FFFFFF').trim();
  const emphasisAccent = configuredAccent && configuredAccent.toLowerCase() !== textColor.toLowerCase()
    ? configuredAccent
    : '#DDAA03';
  const wordStylesSignature = JSON.stringify(caption?.wordStyles || {});

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const timers = new Set();
    const rafs = new Set();
    const setTimer = (fn, delay) => {
      const id = window.setTimeout(() => {
        timers.delete(id);
        fn();
      }, delay);
      timers.add(id);
      return id;
    };
    const raf = (fn) => {
      const id = window.requestAnimationFrame(() => {
        rafs.delete(id);
        fn();
      });
      rafs.add(id);
      return id;
    };

    const isLcTemplateSet = effectiveStyle?.template_source === 'lekha-lc';
    const sourceTiming = isLcTemplateSet
      ? {
          // LC nodes use their authored source schedule; these values only
          // feed the non-word legacy paths.
          wordStaggerMs: LC_TEMPLATE_TIMING.staggerMs,
          wordDurationMs: LC_TEMPLATE_TIMING.bodyDurationMs,
          positionedWordStaggerMs: LC_TEMPLATE_TIMING.staggerMs,
          positionedWordDurationMs: LC_TEMPLATE_TIMING.bodyDurationMs,
          holdMs: LC_TEMPLATE_TIMING.holdMs,
          exitMs: LC_TEMPLATE_TIMING.exitMs,
          gapMs: LC_TEMPLATE_TIMING.gapMs,
        }
      : APPLIED_LEGACY_TEMPLATE_TIMING;
    const WBW_DELAY = sourceTiming.wordStaggerMs;
    const WBW_DUR = sourceTiming.wordDurationMs;
    const POS_STAGGER = sourceTiming.positionedWordStaggerMs;
    const POS_DUR = sourceTiming.positionedWordDurationMs;
    const ease = 'cubic-bezier(0.22,1,0.36,1)';

    const wbwSelector = APPLIED_WBW_CLASSES.map((c) => `.${c} .w, .${c} .wbw-word`).concat('.w[data-lc-anim]').join(',');
    const getLcAnimation = (word, fallbackDuration = WBW_DUR) => {
      const anim = String(word?.dataset?.lcAnim || '').trim();
      if (!isLcTemplateSet || !anim) return null;
      return {
        anim,
        duration: fallbackDuration,
        ease: word.dataset.lcEase || 'cubic-bezier(.22,.68,.26,1)',
        delay: null,
      };
    };

    const wbwInitWord = (word) => {
      const parent = word.parentElement;
      word.style.transition = 'none';
      word.style.animation = 'none';
      word.style.clipPath = '';
      word.style.transformOrigin = '';
      word.style.filter = '';
      if (getLcAnimation(word)) {
        word.style.transform = 'none';
        word.style.opacity = '0';
        return;
      }
      if (!parent) {
        word.style.transform = 'translateY(22px)';
        word.style.opacity = '0';
        return;
      }
      if (parent.classList.contains('wrise') || parent.classList.contains('wbw-rise') || parent.classList.contains('wbw-seq') || parent.classList.contains('wbw-seq-fade')) { word.style.transform = 'translateY(22px)'; word.style.opacity = '0'; }
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
      else { word.style.transform = 'translateY(22px)'; word.style.opacity = '0'; }
    };

    const wbwAnimWord = (word, delay) => {
      const parent = word.parentElement;
      const lcAnimation = getLcAnimation(word, WBW_DUR);
      const playbackDelay = lcAnimation && lcAnimation.delay !== null ? lcAnimation.delay : delay;
      setTimer(() => {
        if (lcAnimation) {
          word.style.transition = 'none';
          word.style.transform = 'none';
          word.style.clipPath = '';
          word.style.opacity = '';
          word.style.animation = `${lcAnimation.anim} ${lcAnimation.duration}ms ${lcAnimation.ease} 0ms forwards`;
          word.classList.add('in', 'visible');
          word.dataset.appliedVisible = 'true';
          return;
        }
        let transition = `transform ${WBW_DUR}ms ${ease}, opacity ${WBW_DUR - 40}ms ease`;
        if (parent?.classList.contains('wwipe') || parent?.classList.contains('wwipeup') || parent?.classList.contains('wstencil')) {
          transition = `clip-path ${WBW_DUR}ms ${ease}`;
        }
        word.style.animation = 'none';
        word.style.transition = transition;
        word.style.transform = 'none';
        word.style.opacity = '1';
        word.style.clipPath = 'inset(0 0 0 0)';
        word.classList.add('in', 'visible');
        word.dataset.appliedVisible = 'true';
      }, playbackDelay);
    };

    const wbwAnimImp = (word, index, delay) => {
      let impType = null;
      Object.entries(APPLIED_IMP_ANIMS).some(([className, anim]) => {
        if (word.classList.contains(className)) {
          impType = anim;
          return true;
        }
        return false;
      });
      if (!impType) return false;
      const d = delay;
      const dur = WBW_DUR + 160;
      word.style.transition = 'none';
      // Kill any CSS keyframe animation on the imp/ns class so the JS-driven
      // reveal (inline opacity/transform/clip) is authoritative during playback.
      // Without this, the class's CSS animation overrides the inline opacity:1
      // and the emphasized word stays invisible mid-play — a "void" in the line
      // that only appears once paused (pause already clears animation in settle).
      word.style.animation = 'none';
      const revealClip = (clipStart, clipEnd) => {
        word.style.clipPath = clipStart;
        word.style.opacity = '1';
        word.style.transform = 'none';
        void word.offsetHeight;
        setTimer(() => {
          word.style.transition = `clip-path ${dur}ms ${ease}`;
          word.style.clipPath = clipEnd;
          word.classList.add('in', 'visible');
        }, d);
      };
      if (impType === 'wipe') revealClip('inset(0 100% 0 0)', 'inset(0 0 0 0)');
      else if (impType === 'wipe-up') revealClip('inset(100% 0 0 0)', 'inset(0 0 0 0)');
      else if (impType === 'diagonal-wipe') revealClip('polygon(0 0,0 0,0 100%,0 100%)', 'polygon(0 0,100% 0,100% 100%,0 100%)');
      else if (impType === 'stencil') revealClip('inset(0 50% 0 50%)', 'inset(0 0 0 0)');
      else {
        if (impType === 'skew-snap') { word.style.transform = 'skewX(-18deg) translateX(-12px)'; word.style.opacity = '0'; }
        else if (impType === 'roll') { word.style.transformOrigin = 'center bottom'; word.style.transform = 'rotateX(-90deg)'; word.style.opacity = '0'; }
        else if (impType === 'drop') { word.style.transform = 'translateY(-30px)'; word.style.opacity = '0'; }
        else if (impType === 'pop') { word.style.transform = 'scale(0.82)'; word.style.opacity = '0'; }
        else if (impType === 'lift') { word.style.transform = 'translateY(-20px)'; word.style.opacity = '0'; }
        else if (impType === 'drift') { word.style.transform = 'translateX(-12px) translateY(8px)'; word.style.opacity = '0'; }
        else if (impType === 'stamp') { word.style.transform = 'scale(1.3)'; word.style.opacity = '0'; }
        else if (impType === 'typewrite' || impType === 'flicker') { word.style.transform = 'none'; word.style.opacity = '0'; }
        void word.offsetHeight;
        setTimer(() => {
          if (impType === 'stamp') {
            word.style.transition = 'none';
            word.style.opacity = '1';
            word.style.transform = 'scale(1.3)';
            setTimer(() => {
              word.style.transition = `transform 180ms ${ease}`;
              word.style.transform = 'scale(1)';
              word.classList.add('in', 'visible');
            }, 60);
          } else if (impType === 'typewrite' || impType === 'flicker') {
            word.style.transition = `opacity ${impType === 'flicker' ? 40 : WBW_DUR}ms ease`;
            word.style.opacity = '1';
            word.classList.add('in', 'visible');
            setTimer(() => word.classList.add('fx'), impType === 'flicker' ? 50 : WBW_DUR + 50);
          } else {
            const target = impType === 'skew-snap'
              ? 'skewX(0) translateX(0)'
              : impType === 'roll'
                ? 'rotateX(0)'
                : impType === 'pop'
                  ? 'scale(1)'
                  : impType === 'drift'
                    ? 'translateX(0) translateY(0)'
                    : 'translateY(0)';
            const transformDuration = impType === 'drift' ? dur + 30 : dur;
            const opacityDuration = impType === 'roll' ? dur - 80 : dur - 60;
            word.style.transition = `transform ${transformDuration}ms ${ease}, opacity ${opacityDuration}ms ease`;
            word.style.transform = target;
            word.style.opacity = '1';
            word.classList.add('in', 'visible');
          }
          word.dataset.appliedVisible = 'true';
        }, d);
      }
      return true;
    };

    const animateWBW = (block) => {
      const words = Array.from(block.querySelectorAll(wbwSelector));
      if (!words.length) return;
      words.forEach((word) => wbwInitWord(word));
      void block.offsetHeight;
      words.forEach((word, index) => {
        const isImp = wbwAnimImp(word, index, index * WBW_DELAY);
        if (!isImp) wbwAnimWord(word, index * WBW_DELAY);
      });
    };

    const resetWBW = (block) => {
      block.querySelectorAll(wbwSelector).forEach((word) => {
        word.classList.remove('in', 'visible', 'fx');
        word.dataset.appliedVisible = 'false';
        wbwInitWord(word);
      });
    };

    const posInitWord = (word) => {
      if (getLcAnimation(word, POS_DUR)) {
        word.style.transition = 'none';
        word.style.animation = 'none';
        word.style.transform = 'none';
        word.style.transformOrigin = '';
        word.style.clipPath = '';
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
        case 'stencil': word.style.clipPath = 'inset(0 50% 0 50%)'; word.style.opacity = '1'; word.style.transform = 'none'; break;
        case 'diagonal-wipe': word.style.clipPath = 'polygon(0 0,0 0,0 100%,0 100%)'; word.style.opacity = '1'; word.style.transform = 'none'; break;
        case 'roll': word.style.transform = 'translateY(12px) rotate(-6deg)'; word.style.opacity = '0'; word.style.transformOrigin = 'left bottom'; break;
        case 'skew-snap': word.style.transform = 'skewX(-18deg) translateX(-10px)'; word.style.opacity = '0'; break;
        case 'expand': word.style.transform = 'scaleX(0.1)'; word.style.transformOrigin = 'center'; word.style.opacity = '0'; break;
        case 'diagonal': word.style.transform = 'translate(-12px,12px)'; word.style.opacity = '0'; break;
        default: word.style.transform = 'translateY(20px)'; word.style.opacity = '0'; break;
      }
    };

    const posAnimWord = (word, delay) => {
      const lcAnimation = getLcAnimation(word, POS_DUR);
      const playbackDelay = lcAnimation && lcAnimation.delay !== null ? lcAnimation.delay : delay;
      setTimer(() => {
        if (lcAnimation) {
          word.style.transition = 'none';
          word.style.transform = 'none';
          word.style.clipPath = '';
          word.style.opacity = '';
          word.style.animation = `${lcAnimation.anim} ${lcAnimation.duration}ms ${lcAnimation.ease} 0ms forwards`;
          word.classList.add('in', 'visible');
          word.dataset.appliedVisible = 'true';
          return;
        }
        const anim = word.dataset.anim || 'rise';
        let transition = `transform ${POS_DUR}ms ${ease}, opacity ${POS_DUR - 40}ms ease`;
        if (anim === 'wipe' || anim === 'wipe-up' || anim === 'stencil') {
          transition = `clip-path ${POS_DUR}ms ${ease}`;
        } else if (anim === 'diagonal-wipe') {
          transition = `clip-path ${POS_DUR}ms ${ease}`;
        } else if (anim === 'slide-slow') {
          transition = 'transform 750ms cubic-bezier(0.16,1,0.3,1), opacity 550ms ease';
        }
        word.style.transition = transition;
        word.style.transform = 'none';
        word.style.opacity = '1';
        word.style.clipPath = anim === 'diagonal-wipe'
          ? 'polygon(0 0,100% 0,100% 100%,0 100%)'
          : 'inset(0 0 0 0)';
        word.classList.add('in', 'visible');
        word.dataset.appliedVisible = 'true';
      }, playbackDelay);
    };

    const animatePosWords = (block) => {
      const words = Array.from(block.querySelectorAll('.sw, .sw-w'));
      if (!words.length) return;
      words.forEach((word) => posInitWord(word));
      void block.offsetHeight;
      words.forEach((word, index) => posAnimWord(word, index * POS_STAGGER));
    };

    const resetPosWords = (block) => {
      block.querySelectorAll('.sw, .sw-w').forEach((word) => {
        word.classList.remove('in', 'visible');
        word.dataset.appliedVisible = 'false';
        posInitWord(word);
      });
    };

    // 'plain' blocks are a single .plain-s line of text nodes with the highlighted
    // word wrapped in a bare <span class="is-emphasis"> (no .w/.sw class), so the
    // word-by-word and positioned engines never touch them and the highlight sat
    // static — "not moving" relative to the gallery preview. Animate just the
    // emphasis span (the context text nodes can't be animated individually).
    const plainImpInit = (word) => {
      word.style.transition = 'none';
      word.style.animation = 'none';
      word.style.transformOrigin = 'center bottom';
      word.style.display = 'inline-block';
      word.style.transform = 'translateY(18px)';
      word.style.opacity = '0';
    };

    const animatePlain = (block) => {
      const plainWraps = Array.from(block.querySelectorAll('.plainwrap'));
      if (isLcTemplateSet && plainWraps.length) {
        plainWraps.forEach((element) => {
          element.style.transition = 'none';
          element.style.animation = 'none';
          element.style.opacity = '0';
          void element.offsetHeight;
          element.style.animation = 'fade 240ms ease 0ms forwards';
          element.dataset.appliedVisible = 'true';
        });
        return;
      }
      const imps = Array.from(block.querySelectorAll('.plain-s .is-emphasis'));
      if (!imps.length) return;
      imps.forEach(plainImpInit);
      void block.offsetHeight;
      imps.forEach((word, index) => {
        setTimer(() => {
          word.style.transition = `transform ${WBW_DUR + 120}ms ${ease}, opacity ${WBW_DUR}ms ease`;
          word.style.transform = 'none';
          word.style.opacity = '1';
          word.classList.add('in', 'visible');
          word.dataset.appliedVisible = 'true';
        }, 140 + index * WBW_DELAY);
      });
    };

    const resetPlain = (block) => {
      block.querySelectorAll('.plainwrap, [data-lc-block-anim]').forEach((element) => {
        element.style.transition = 'none';
        element.style.animation = 'none';
        element.style.opacity = '0';
        element.dataset.appliedVisible = 'false';
      });
      block.querySelectorAll('.plain-s .is-emphasis').forEach((word) => {
        word.classList.remove('in', 'visible');
        word.dataset.appliedVisible = 'false';
        plainImpInit(word);
      });
    };

    // Pause/seek must always land the highlight visible (it was reset hidden above)
    // so the paused frame matches export — never leave a void.
    const settlePlainWord = (word) => {
      word.style.animation = 'none';
      word.style.transition = 'none';
      word.style.transform = 'none';
      word.style.opacity = '1';
      word.style.display = 'inline-block';
      word.classList.add('in', 'visible');
      word.dataset.appliedVisible = 'true';
    };

    const settlePlainWrap = (element) => {
      element.style.transition = 'none';
      element.style.animation = 'none';
      element.style.opacity = '1';
      element.dataset.appliedVisible = 'true';
    };

    // The accent colour should land on the word the template renders BOLD (the
    // larger / heavier "hero" word), not on an independently-guessed semantic
    // word — otherwise the highlight colours the wrong/unimportant word. Detect
    // the bold tier by computed size (then weight) and paint only those words;
    // if there is no distinct bold tier, leave the build-time semantic emphasis
    // untouched (so plain/uniform lines fall back to the important-word guess,
    // and lines with neither simply get no colour).
    const clearHeroEmphasis = (block) => {
      block.querySelectorAll('[data-hero-emphasis="true"]').forEach((el) => {
        if (el.closest?.('[data-source-word-gradient="true"]')) return;
        el.style.color = '';
        el.style.webkitTextFillColor = '';
        delete el.dataset.heroEmphasis;
      });
    };

    const recolorEmphasisToHero = (block) => {
      const emphasisByLine = new Map();
      block.querySelectorAll('.is-emphasis').forEach((word) => {
        const line = word.parentElement || block;
        const lineWords = emphasisByLine.get(line) || [];
        lineWords.push(word);
        emphasisByLine.set(line, lineWords);
      });
      let hasPairedEmphasis = false;
      emphasisByLine.forEach((lineWords) => {
        if (lineWords.length < 2) return;
        hasPairedEmphasis = true;
        const hasUnderline = lineWords.some((word) => {
          const styles = window.getComputedStyle(word);
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
      // Preserve semantic phrases instead of collapsing them onto one authored
      // hero atom. Every word in the phrase keeps the same accent and treatment.
      if (hasPairedEmphasis) return true;

      const atoms = Array.from(block.querySelectorAll('.w, .wbw-word, .sw, .sw-w')).filter((el) => (
        !el.closest?.('[data-source-word-gradient="true"]')
      ));
      if (atoms.length < 2) return false;
      const measure = atoms.map((el) => {
        const cs = window.getComputedStyle(el);
        return { el, fs: parseFloat(cs.fontSize) || 0, fw: parseInt(cs.fontWeight, 10) || 400 };
      });
      const sizes = measure.map((m) => m.fs).filter((v) => v > 0);
      if (sizes.length < 2) return false;
      const maxFs = Math.max(...sizes);
      const minFs = Math.min(...sizes);
      let heroEls = [];
      if (maxFs >= minFs * 1.18) {
        // A distinct larger size tier = the hero row / bold word(s).
        heroEls = measure.filter((m) => m.fs >= maxFs - 0.5).map((m) => m.el);
      } else {
        // Uniform size: fall back to a clear font-weight tier (bold vs regular).
        const weights = measure.map((m) => m.fw);
        const maxFw = Math.max(...weights);
        const minFw = Math.min(...weights);
        if (maxFw >= 700 && maxFw - minFw >= 200) {
          heroEls = measure.filter((m) => m.fw >= maxFw - 50).map((m) => m.el);
        }
      }
      // No bold tier, or everything is "hero" — keep the semantic emphasis as-is.
      if (!heroEls.length || heroEls.length === atoms.length) return false;
      // Drop the build-time semantic colour, then paint the bold word(s).
      atoms.forEach((el) => {
        if (el.classList.contains('is-emphasis')) {
          el.classList.remove('is-emphasis');
          el.style.color = '';
          el.style.webkitTextFillColor = '';
        }
      });
      heroEls.forEach((el) => {
        el.style.color = emphasisAccent;
        el.style.webkitTextFillColor = emphasisAccent;
        el.dataset.heroEmphasis = 'true';
      });
      return true;
    };

    const getBlockType = (block) => {
      if (block.querySelector(wbwSelector)) return 'wbw';
      if (block.querySelector('.sw, .sw-w')) return 'pos';
      return 'plain';
    };

    const resetBlock = (block) => {
      block.classList.remove('active');
      block.style.transition = 'none';
      block.style.opacity = '0';
      block.style.visibility = 'hidden';
      block.style.position = 'absolute';
      block.style.pointerEvents = 'none';
      resetWBW(block);
      resetPosWords(block);
      resetPlain(block);
      clearHeroEmphasis(block);
    };

    const enterBlock = (block) => {
      const type = getBlockType(block);
      resetBlock(block);
      void block.offsetHeight;
      block.style.visibility = 'visible';
      block.style.position = 'relative';
      block.style.transition = 'none';
      block.style.opacity = '1';
      block.style.pointerEvents = 'auto';
      block.classList.add('active');
      // LC templates are driven by the deterministic frame renderer below.
      // Do not also schedule their old timer-based reveal path: two independent
      // clocks were racing to reset/settle individual words during playback.
      if (isLcTemplateSet) return;
      if (type === 'wbw') {
        raf(() => raf(() => animateWBW(block)));
      } else if (type === 'pos') {
        raf(() => raf(() => animatePosWords(block)));
      } else {
        raf(() => raf(() => animatePlain(block)));
      }
      raf(() => raf(() => recolorEmphasisToHero(block)));
    };

    const blocks = Array.from(host.querySelectorAll('.sb, .sblock'));
    if (!blocks.length) return undefined;

    const selectedPhaseIndex = ((Number(phaseOffset) % blocks.length) + blocks.length) % blocks.length;
    const selectedBlock = blocks[selectedPhaseIndex];

    const settleWBWWord = (word) => {
      word.style.animation = 'none';
      word.style.transition = 'none';
      word.style.opacity = '1';
      word.style.clipPath = 'inset(0 0 0 0)';
      word.style.transform = 'none';
      word.classList.add('in', 'visible');
      if (/\b(imp-|ns[23]-)/.test(word.className)) {
        word.classList.add('anim', 'fx');
      }
      word.dataset.appliedVisible = 'true';
    };

    const settlePosWord = (word) => {
      const anim = word.dataset.anim || 'rise';
      word.style.animation = 'none';
      word.style.transition = 'none';
      word.style.opacity = '1';
      word.style.clipPath = anim === 'diagonal-wipe'
        ? 'polygon(0 0,100% 0,100% 100%,0 100%)'
        : 'inset(0 0 0 0)';
      word.style.transform = 'none';
      word.classList.add('in', 'visible');
      word.dataset.appliedVisible = 'true';
    };

    const clearScheduledWork = () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      rafs.forEach((frame) => window.cancelAnimationFrame(frame));
      timers.clear();
      rafs.clear();
    };

    const preparePhase = () => {
      blocks.forEach((block, index) => {
        resetBlock(block);
        block.dataset.appliedActivePhase = index === selectedPhaseIndex ? 'true' : 'false';
      });
    };

    const settleBlock = (block) => {
      if (!block) return;
      block.style.visibility = 'visible';
      block.style.position = 'relative';
      block.style.pointerEvents = 'auto';
      block.style.transition = 'none';
      block.style.opacity = '1';
      block.classList.add('active');
      block.querySelectorAll(wbwSelector).forEach(settleWBWWord);
      block.querySelectorAll('.sw, .sw-w').forEach(settlePosWord);
      block.querySelectorAll('.plainwrap, [data-lc-block-anim]').forEach(settlePlainWrap);
      block.querySelectorAll('.plain-s .is-emphasis').forEach(settlePlainWord);
      recolorEmphasisToHero(block);
    };

    // ── LC motion: video-clock driven CSS animations ─────────────────────────
    // Sample every authored LC animation directly from the video clock. Each
    // CSS animation stays paused and its delay is shifted by caption time, so
    // no timer, Animation object lookup, or pause repaint decides visibility.
    let lcFrameId = null;
    let lcTimelineEntries = [];
    let lcTimelineInitialized = false;

    const lcMotionNodes = (block) => Array.from(block?.querySelectorAll(
      '.w[data-lc-anim], .sw[data-lc-anim], .sw-w[data-lc-anim]',
    ) || []);

    const stopLcClock = () => {
      if (lcFrameId !== null) {
        window.cancelAnimationFrame(lcFrameId);
        lcFrameId = null;
      }
    };

    const seekLcTimeline = (elapsedMs = 0) => {
      const elapsed = Math.max(0, Number(elapsedMs) || 0);
      lcTimelineEntries.forEach(({ element, delayMs }) => {
        element.style.animationDelay = `${delayMs - elapsed}ms`;
      });
      host.dataset.lcTimelineMs = String(Math.round(elapsed));
    };

    const syncLcTimeline = () => {
      const videoTime = Number(videoRef?.current?.currentTime);
      const current = Number.isFinite(videoTime)
        ? videoTime
        : Number(playStateRef.current.currentTime || 0);
      const start = Number(playStateRef.current.startTime || 0);
      seekLcTimeline((current - start) * 1000);
    };

    const initializeLcTimeline = () => {
      if (!selectedBlock) return;
      stopLcClock();
      clearScheduledWork();
      // LC has its own phase setup. Do not pass these captions through the
      // legacy reset/enter engine: that engine mutates word classes and inline
      // visibility for timer-driven templates.
      blocks.forEach((block, index) => {
        const active = index === selectedPhaseIndex;
        block.classList.toggle('active', active);
        block.style.transition = 'none';
        block.style.visibility = active ? 'visible' : 'hidden';
        block.style.position = active ? 'relative' : 'absolute';
        block.style.opacity = active ? '1' : '0';
        block.style.pointerEvents = active ? 'auto' : 'none';
        block.dataset.appliedActivePhase = active ? 'true' : 'false';
      });
      const motionNodes = lcMotionNodes(selectedBlock);
      const motionNodeSet = new Set(motionNodes);
      const authoredSchedule = getLcMotionSchedule(motionNodes.map((word) => ({
        animation: word.dataset.lcAnim,
        duration: word.dataset.lcDuration,
        delay: word.dataset.lcDelay,
        ease: word.dataset.lcEase,
      })));
      const captionDurationMs = Math.max(
        1,
        (Number(playStateRef.current.endTime || 0) - Number(playStateRef.current.startTime || 0)) * 1000,
      );
      const schedule = fitLcMotionScheduleToCaption(authoredSchedule, captionDurationMs);
      host.dataset.lcAuthoredEndMs = String(Math.round(authoredSchedule.endMs));
      host.dataset.lcFittedEndMs = String(Math.round(schedule.endMs));
      host.dataset.lcTimelineScale = String(schedule.scale);

      lcTimelineEntries = [];
      motionNodes.forEach((word, index) => {
        const entry = schedule.entries[index];
        if (!entry?.animation) return;
        word.style.transition = 'none';
        word.style.opacity = '';
        word.style.transform = '';
        word.style.clipPath = '';
        word.style.animationName = getAppliedLcAnimationName(entry.animation);
        word.style.animationDuration = `${entry.durationMs}ms`;
        word.style.animationTimingFunction = entry.ease;
        word.style.animationDelay = `${entry.delayMs}ms`;
        word.style.animationIterationCount = '1';
        word.style.animationDirection = 'normal';
        word.style.animationFillMode = 'both';
        word.style.animationPlayState = 'paused';
        word.classList.remove('in', 'visible');
        word.dataset.lcMotion = 'true';
        word.dataset.appliedVisible = 'true';
        lcTimelineEntries.push({ element: word, delayMs: entry.delayMs });
      });

      // Every LC word without authored motion is a static supporting word. It
      // remains fully visible for the whole caption, independent of source
      // preview classes that may have been left behind by a previous phase.
      selectedBlock.querySelectorAll('.w, .sw, .sw-w').forEach((word) => {
        if (motionNodeSet.has(word)) return;
        word.style.animation = 'none';
        word.style.transition = 'none';
        word.style.opacity = '1';
        word.style.transform = 'none';
        word.style.clipPath = 'inset(0 0 0 0)';
        word.classList.add('in', 'visible');
        word.dataset.appliedVisible = 'true';
      });

      selectedBlock.querySelectorAll('.plainwrap').forEach((element) => {
        const entry = fitLcMotionScheduleToCaption(getLcMotionSchedule([{
          animation: 'fade',
          duration: LC_TEMPLATE_TIMING.plainFadeDurationMs,
          delay: 0,
          ease: 'ease',
        }]), captionDurationMs).entries[0];
        element.style.transition = 'none';
        element.style.opacity = '';
        element.style.animation = `${getAppliedLcAnimationName('fade')} ${entry.durationMs}ms ease 0ms both paused`;
        element.dataset.appliedVisible = 'true';
        lcTimelineEntries.push({ element, delayMs: 0 });
      });

      // Whole-line 'block' scenes (LC4/LC5): the wrap carries one authored
      // animation while its words are statically visible.
      selectedBlock.querySelectorAll('[data-lc-block-anim]').forEach((element) => {
        const wrapSchedule = getLcMotionSchedule([{
          animation: element.dataset.lcBlockAnim,
          duration: element.dataset.lcBlockDuration,
          delay: element.dataset.lcBlockDelay,
          ease: element.dataset.lcBlockEase,
        }]);
        const entry = fitLcMotionScheduleToCaption(wrapSchedule, captionDurationMs).entries[0];
        const wrapDuration = entry?.durationMs || LC_TEMPLATE_TIMING.heroDurationMs;
        element.style.transition = 'none';
        element.style.opacity = '';
        element.style.animation = `${getAppliedLcAnimationName(entry?.animation || 'rise')} ${wrapDuration}ms ${entry?.ease || 'cubic-bezier(.22,.68,.26,1)'} ${entry?.delayMs || 0}ms both paused`;
        element.dataset.appliedVisible = 'true';
        lcTimelineEntries.push({ element, delayMs: entry?.delayMs || 0 });
      });

      recolorEmphasisToHero(selectedBlock);
      lcTimelineInitialized = true;
      syncLcTimeline();
    };

    const startLcTimeline = () => {
      if (!lcTimelineInitialized) initializeLcTimeline();
      stopLcClock();
      syncLcTimeline();
      const tick = () => {
        syncLcTimeline();
        if (playStateRef.current.isPlaying) lcFrameId = window.requestAnimationFrame(tick);
      };
      if (playStateRef.current.isPlaying) lcFrameId = window.requestAnimationFrame(tick);
    };

    const play = () => {
      if (isLcTemplateSet) {
        startLcTimeline();
        return;
      }
      clearScheduledWork();
      host.dataset.appliedTemplatePaused = 'false';
      host.dataset.appliedAnimationRun = String(Number(host.dataset.appliedAnimationRun || 0) + 1);
      preparePhase();
      enterBlock(selectedBlock);
    };

    const pause = () => {
      if (isLcTemplateSet) {
        stopLcClock();
        if (!lcTimelineInitialized) initializeLcTimeline();
        syncLcTimeline();
        return;
      }
      clearScheduledWork();
      host.dataset.appliedTemplatePaused = 'true';
      preparePhase();
      settleBlock(selectedBlock);
    };

    runnerRef.current = { play, pause };
    if (playStateRef.current.isPlaying) {
      play();
    } else if (isLcTemplateSet) {
      pause();
    } else {
      pause();
    }

    return () => {
      clearScheduledWork();
      stopLcClock();
      runnerRef.current = null;
    };
  }, [html, captionId, captionText, effectiveStyle?.template_20_id, effectiveStyle?.template_source, phaseOffset, startTime, endTime]);

  useEffect(() => {
    const runner = runnerRef.current;
    if (!runner) return;
    const previous = playbackControlRef.current;
    const timeDelta = Math.abs(Number(currentTime || 0) - Number(previous.currentTime || 0));
    const seeked = previous.isPlaying && isPlaying && timeDelta > 0.75;
    if (!isPlaying) {
      runner.pause();
      playbackControlRef.current = { currentTime, isPlaying };
      return;
    }
    if (!previous.isPlaying || seeked) runner.play();
    playbackControlRef.current = { currentTime, isPlaying };
  }, [currentTime, isPlaying, startTime, endTime]);

  useLayoutEffect(() => {
    applySourceTemplateScriptFont(hostRef.current, captionText);
    const cleanup = wireSourceTemplateWordEditing(hostRef.current, {
      caption,
      renderScale,
      emphasisColor: emphasisAccent,
      onSourceWordClick,
      onSourceWordPointerDown,
      currentTime,
      isPlaying,
      templateSource: effectiveStyle?.template_source,
    });
    if (!playStateRef.current.isPlaying) runnerRef.current?.pause?.();
    return cleanup;
  }, [caption, captionText, currentTime, emphasisAccent, effectiveStyle?.template_source, html, isPlaying, onSourceWordClick, onSourceWordPointerDown, phaseOffset, renderScale, wordStylesSignature]);

  return (
    <span
      ref={hostRef}
      key={`applied-sidebar-source-${captionId || 'active'}-${effectiveStyle?.template_20_id || 'tpl'}-${captionText}`}
      className={[
        'lekha-applied-template-host',
        effectiveStyle?.template_color_customized ? 'is-color-customized' : '',
        effectiveStyle?.text_gradient ? 'has-text-gradient' : '',
        effectiveStyle?.highlight_gradient ? 'has-highlight-gradient' : '',
      ].filter(Boolean).join(' ')}
      data-applied-template-id={effectiveStyle?.template_20_id || ''}
      data-applied-template-source={effectiveStyle?.template_source || 'lekha-20'}
      data-applied-template-complex-script={usesComplexTemplateScript(captionText) ? 'true' : 'false'}
      data-applied-template-renderer="source-html"
      data-applied-template-animated="true"
      data-export-measure="sidebar-template"
      data-export-caption-id={captionId || ''}
      data-emotional-mode={effectiveStyle?.emotional_mode || ''}
      data-template-phase-index={phaseOffset}
      data-applied-template-paused={isPlaying ? 'false' : 'true'}
      data-applied-template-selected={isSelected ? 'true' : 'false'}
      style={{
        '--sidebar-source-color': effectiveStyle?.text_color || '#FFFFFF',
        '--sidebar-source-accent': effectiveStyle?.secondary_color || '#DDAA03',
        '--sidebar-emphasis-accent': emphasisAccent,
        '--sidebar-template-highlight': emphasisAccent,
        '--sidebar-source-line-height': effectiveStyle?.line_spacing || 1.25,
        '--sidebar-source-font': resolvedFont,
        '--template-primary': effectiveStyle?.text_color || '#FFFFFF',
        '--template-secondary': effectiveStyle?.secondary_color || '#DDAA03',
        '--template-highlight': emphasisAccent,
        '--template-text-gradient': effectiveStyle?.text_gradient || 'none',
        '--template-highlight-gradient': effectiveStyle?.highlight_gradient || 'none',
        '--template-karaoke-1': effectiveStyle?.karaoke_color_1 || effectiveStyle?.highlight_color || effectiveStyle?.emphasis_color || effectiveStyle?.secondary_color || '#DDAA03',
        '--template-karaoke-2': effectiveStyle?.karaoke_color_2 || '#22D3EE',
        '--template-karaoke-3': effectiveStyle?.karaoke_color_3 || '#FB923C',
        '--applied-template-width': `${Math.round(SIDEBAR_TEMPLATE_APPLIED_WIDTH_CAP * renderScale)}px`,
        color: effectiveStyle?.text_color || '#FFFFFF',
        fontFamily: resolvedFont,
        fontSize: `${fontSize}px`,
        fontWeight: effectiveStyle?.font_weight || '300',
        fontStyle: effectiveStyle?.font_style || 'normal',
        textTransform: effectiveStyle?.text_case && effectiveStyle.text_case !== 'none' ? effectiveStyle.text_case : undefined,
        lineHeight: effectiveStyle?.line_spacing || 1.25,
        opacity: effectiveStyle?.text_opacity ?? 1,
        textAlign: 'center',
        ...(getSidebarTemplateZoom(effectiveStyle) !== 1
          ? { transform: `scale(${getSidebarTemplateZoom(effectiveStyle)})`, transformOrigin: 'center center' }
          : {}),
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}


export const _advancedSourceMarkupCache = new Map();

export function getAppliedAdvancedCardMarkup(templateId, templateMarkup = '') {
  const suppliedMarkup = String(templateMarkup || '');
  if (suppliedMarkup.includes(`id="card-${templateId}"`) || suppliedMarkup.includes(`id='card-${templateId}'`)) {
    return suppliedMarkup;
  }
  return extractAdvancedTemplateCardMarkup(originalTemplateHtml, templateId);
}

export function getAppliedAdvancedTemplateImpClass(templateId, blockIndex = 0, templateMarkup = '') {
  const normalizedBlockIndex = normalizeTemplatePhaseIndex(templateId, blockIndex);
  const cardMarkup = getAppliedAdvancedCardMarkup(templateId, templateMarkup);
  const sourceBlock = sanitizeAppliedTemplateMarkup(
    extractAdvancedTemplateBlockMarkup(cardMarkup, templateId, normalizedBlockIndex),
    true,
  );
  return String(sourceBlock || '').match(_astImpClassTestPattern)?.[0] || '';
}

export function cleanAppliedAdvancedSourceElement(element) {
  if (!element) return;
  element.querySelectorAll('script, style, iframe, object, embed, link, meta, base, form, input, button, textarea, select')
    .forEach((node) => node.remove());
  const nodes = [element, ...element.querySelectorAll('*')];
  nodes.forEach((node) => {
    Array.from(node.attributes || []).forEach((attribute) => {
      const attrName = String(attribute.name || '');
      const attrValue = String(attribute.value || '').trim().toLowerCase();
      if (
        /^bis_/i.test(attrName)
        || /^__processed_/i.test(attrName)
        || /^on/i.test(attrName)
        || ((attrName === 'href' || attrName === 'src' || attrName === 'xlink:href')
          && (attrValue.startsWith('javascript:') || attrValue.startsWith('data:text/html')))
      ) {
        node.removeAttribute(attribute.name);
      }
    });
    node.className = String(node.className || '')
      .split(/\s+/)
      .filter((className) => className && !['active', 'visible', 'anim', 'on', 'in', 'fx'].includes(className))
      .join(' ');
    if (node.style) {
      Array.from(node.style).forEach((property) => {
        const value = node.style.getPropertyValue(property).toLowerCase();
        if (value.includes('url(') || value.includes('expression(') || value.includes('javascript:')) {
          node.style.removeProperty(property);
        }
      });
      [
        'animation', 'clip-path', 'filter', 'opacity', 'transform', 'transform-origin',
        'transition', 'visibility', 'z-index',
      ].forEach((property) => node.style.removeProperty(property));
    }
  });
}

export function replaceAppliedAdvancedWbw(container, words, impWordIndex = -1, emphasisColor = '', impWordIndices = []) {
  if (!container || !words.length) return;
  const doc = container.ownerDocument;
  const sourceWords = Array.from(container.querySelectorAll('.w'));
  const sourceClasses = sourceWords.map((word) => _astCleanClass(word.className, 'w'));
  const sourceImpIndex = sourceWords.findIndex((word) => (
    word.dataset.imp === 'true' || _astImpClassTestPattern.test(word.className)
  ));
  const sourceImpClass = sourceImpIndex >= 0
    ? sourceWords[sourceImpIndex].dataset.impCls
      || sourceClasses[sourceImpIndex].match(_astImpClassTestPattern)?.[0]
      || ''
    : '';
  const targetImpIndices = new Set(resolveImpWordIndicesForWords(words, impWordIndex, impWordIndices));

  container.textContent = '';
  container.dataset.text = words.join(' ');
  container.classList.remove('lekha-template-preview-lines');

  const createWordSpan = (word, index, isLastInLine) => {
    const span = doc.createElement('span');
    const mappedClass = _astMappedClass(sourceClasses, index, words.length, 'w')
      .replace(_astImpClassPattern, '')
      .replace(/\s+/g, ' ')
      .trim();
    const isImp = targetImpIndices.has(index);
    span.className = `${mappedClass || 'w'}${isImp && sourceImpClass ? ` ${sourceImpClass}` : ''}${isImp ? ' is-emphasis' : ''}`;
    span.dataset.i = String(index);
    if (isImp) {
      span.dataset.imp = 'true';
      span.dataset.impCls = sourceImpClass;
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
}

export function replaceAppliedAdvancedKaraoke(container, words) {
  if (!container || !words.length) return;
  container.textContent = '';
  words.forEach((word, index) => {
    if (index > 0) container.appendChild(container.ownerDocument.createTextNode(' '));
    const wrapper = container.ownerDocument.createElement('span');
    wrapper.className = 'kf-word';
    const base = container.ownerDocument.createElement('span');
    base.className = 'kf-base';
    base.textContent = word;
    const fill = container.ownerDocument.createElement('span');
    fill.className = 'kf-fill';
    fill.textContent = word;
    wrapper.append(base, fill);
    container.appendChild(wrapper);
  });
}


export function rebuildAppliedAdvancedWbwRiseBlock(block, words, impWordIndex = -1, emphasisColor = '', templateId = '', blockIndex = 0, impWordIndices = []) {
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
    span.className = `w${isImp ? ` ${impClass} is-emphasis` : ''}`;
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
}

export function collectAppliedAdvancedTextNodes(root) {
  const textNodes = [];
  const isHiddenTextNode = (node) => {
    let element = node?.parentElement;
    while (element && element !== root.parentElement) {
      const style = String(element.getAttribute?.('style') || '').toLowerCase();
      if (
        element.hidden
        || element.getAttribute?.('aria-hidden') === 'true'
        || /display\s*:\s*none/.test(style)
        || /visibility\s*:\s*hidden/.test(style)
        || /font-size\s*:\s*0(?:\.0+)?(?:px|rem|em|%)?(?:\s*(?:;|$))/.test(style)
        || /line-height\s*:\s*0(?:\.0+)?(?:px|rem|em|%)?(?:\s*(?:;|$))/.test(style)
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
        if (/[\p{L}\p{N}]/u.test(child.nodeValue || '') && !isHiddenTextNode(child)) textNodes.push(child);
        else if (String(child.nodeValue || '').trim()) child.nodeValue = '';
        return;
      }
      if (child.nodeType === 1) visit(child);
    });
  };
  visit(root);
  return textNodes;
}

export function assignAppliedAdvancedWordsToSlots(words, slotCount) {
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
}

export function findAppliedAdvancedStyledImpSlotIndex(slots, block) {
  if (!Array.isArray(slots) || !slots.length || !block) return -1;
  return slots.findIndex((slot) => {
    let element = slot?.parentElement;
    while (element && element !== block) {
      if (_astImpClassTestPattern.test(String(element.className || ''))) return true;
      element = element.parentElement;
    }
    return false;
  });
}

export function ensureAppliedAdvancedStyledImpSlotHasWord(assigned, impSlotIndex) {
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
}

export function getAppliedAdvancedSourceImpClass(block) {
  const className = Array.from(block.querySelectorAll('*'))
    .map((element) => element.className || '')
    .find((value) => _astImpClassTestPattern.test(String(value)));
  return String(className || '').match(_astImpClassTestPattern)?.[0] || 'imp-gold';
}

export function findAppliedAdvancedSlotImpWrapper(slot, block) {
  let element = slot?.parentElement;
  while (element && element !== block) {
    if (_astImpClassTestPattern.test(String(element.className || ''))) return element;
    element = element.parentElement;
  }
  return null;
}

export function replaceAppliedAdvancedTextSlot(slot, assignedWords, impWordIndex, impClass, emphasisColor, block, impWordIndices = []) {
  const doc = slot.ownerDocument;
  const source = String(slot.nodeValue || '');
  const leading = /^\s/.test(source) ? ' ' : '';
  const trailing = /\s$/.test(source) ? ' ' : '';
  const targetImpIndices = new Set(normalizeImpWordIndices(impWordIndex, impWordIndices));
  const replacementTarget = targetImpIndices.size > 0
    ? findAppliedAdvancedSlotImpWrapper(slot, block)
    : null;
  const fragment = doc.createDocumentFragment();

  if (leading) fragment.appendChild(doc.createTextNode(leading));
  assignedWords.forEach(({ word, wordIndex }, localIndex) => {
    if (localIndex > 0) fragment.appendChild(doc.createTextNode(' '));
    if (targetImpIndices.has(wordIndex)) {
      const span = doc.createElement('span');
      span.className = `${impClass} is-emphasis`;
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
}

export function replaceAppliedAdvancedStyledText(block, words, captionText, impWordIndex = -1, emphasisColor = '', impWordIndices = []) {
  const slots = collectAppliedAdvancedTextNodes(block);
  if (!slots.length) {
    block.textContent = captionText;
    return;
  }

  const targetSlotCount = Math.max(1, Math.min(words.length, slots.length));
  const targetSlots = slots.slice(0, targetSlotCount);
  const assigned = assignAppliedAdvancedWordsToSlots(words, targetSlots.length);
  const sourceImpSlotIndex = findAppliedAdvancedStyledImpSlotIndex(targetSlots, block);
  ensureAppliedAdvancedStyledImpSlotHasWord(assigned, sourceImpSlotIndex);
  const impClass = getAppliedAdvancedSourceImpClass(block);
  const resolvedImpWordIndices = resolveImpWordIndicesForWords(words, impWordIndex, impWordIndices);
  targetSlots.forEach((slot, slotIndex) => {
    if (assigned[slotIndex].length) {
      replaceAppliedAdvancedTextSlot(slot, assigned[slotIndex], -1, impClass, emphasisColor, block, resolvedImpWordIndices);
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
}


export function normalizeAppliedAdvancedStyledBlock(block, templateId, blockIndex, captionText = '', previewLineTexts = []) {
  const rebuildSplitText = (container, lines, impClass = '') => {
    if (!container || !Array.isArray(lines) || !lines.length) return;
    const doc = container.ownerDocument;
    container.textContent = '';
    container.appendChild(doc.createTextNode(lines[0] || ''));
    if (lines[1]) {
      container.appendChild(doc.createElement('br'));
      if (impClass) {
        const span = doc.createElement('span');
        span.className = `${impClass} is-emphasis`;
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
      rebuildSplitText(line, splitTemplateLines(captionText, 2), getAppliedAdvancedSourceImpClass(block));
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
      const doc = splitTitle.ownerDocument;
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
      const doc = line.ownerDocument;
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
}

export function buildAppliedAdvancedTemplateInline(
  templateId,
  captionText,
  blockIndex = 0,
  templateMarkup = '',
  impWordIndex = -1,
  emphasisColor = '',
  previewLineTexts = [],
  impWordIndices = [],
) {
  if (isRecreatedAdvancedTemplateId(templateId)) return '';

  const normalizedBlockIndex = normalizeTemplatePhaseIndex(templateId, blockIndex);
  const resolvedEmphasisColor = resolveAdvancedTemplateEmphasisColor(templateId, emphasisColor, normalizedBlockIndex);
  const cardMarkup = getAppliedAdvancedCardMarkup(templateId, templateMarkup);
  const cacheKey = [
    templateId,
    normalizedBlockIndex,
    impWordIndex,
    JSON.stringify(normalizeImpWordIndices(impWordIndex, impWordIndices)),
    resolvedEmphasisColor,
    getAppliedTemplateMarkupSignature(cardMarkup),
    captionText,
    JSON.stringify(Array.isArray(previewLineTexts) ? previewLineTexts : []),
  ].join('|');
  if (_advancedSourceMarkupCache.has(cacheKey)) return _advancedSourceMarkupCache.get(cacheKey);
  if (!cardMarkup || typeof DOMParser === 'undefined') return '';

  const sourceBlock = extractAdvancedTemplateBlockMarkup(cardMarkup, templateId, normalizedBlockIndex);
  if (!sourceBlock) return '';

  let doc;
  try {
    doc = new DOMParser().parseFromString(sourceBlock, 'text/html');
  } catch {
    return '';
  }
  const block = doc.querySelector('.sblock');
  const words = String(captionText || '').trim().split(/\s+/).filter(Boolean);
  if (!block || !words.length) return '';

  cleanAppliedAdvancedSourceElement(block);
  const blockType = getOriginalTemplateBlockType(templateId, normalizedBlockIndex) || block.dataset.type || 'styled';
  block.classList.add(
    `${templateId}-b${normalizedBlockIndex}`,
    `${templateId}-block`,
    'active',
    'lekha-applied-advanced-template',
    'lekha-advanced-source-block',
  );
  block.dataset.templateBlockIndex = String(normalizedBlockIndex);
  block.dataset.templateBlockType = blockType;
  block.style.opacity = '1';
  block.style.visibility = 'visible';
  rebuildAppliedAdvancedWbwRiseBlock(
    block,
    words,
    impWordIndex,
    resolvedEmphasisColor,
    templateId,
    normalizedBlockIndex,
    impWordIndices,
  );

  const wbwContainers = Array.from(block.querySelectorAll(
    '.wbw-rise, .wbw-slide, .wbw-seq, .wbw-seq-fade, .wbw-seq-flip',
  ));
  if (wbwContainers.length) {
    wbwContainers.forEach((container) => replaceAppliedAdvancedWbw(container, words, impWordIndex, resolvedEmphasisColor, impWordIndices));
  } else {
    const karaokeContainers = Array.from(block.querySelectorAll('.kf-line'));
    if (karaokeContainers.length) {
      karaokeContainers.forEach((container) => replaceAppliedAdvancedKaraoke(container, words));
    } else {
      const suppressSemanticEmphasis = shouldSuppressStyledSemanticEmphasis(templateId, blockType, block);
      replaceAppliedAdvancedStyledText(
        block,
        words,
        captionText,
        suppressSemanticEmphasis ? -1 : impWordIndex,
        suppressSemanticEmphasis ? '' : resolvedEmphasisColor,
        suppressSemanticEmphasis ? [] : impWordIndices,
      );
    }
  }

  normalizeAppliedAdvancedStyledBlock(
    block,
    templateId,
    normalizedBlockIndex,
    captionText,
    previewLineTexts,
  );

  const result = block.outerHTML;
  if (_advancedSourceMarkupCache.size > 500) _advancedSourceMarkupCache.clear();
  _advancedSourceMarkupCache.set(cacheKey, result);
  return result;
}

export function renderOriginalTemplateCaption(templateId, text, active = true, blockIndex = 0, previewLineTexts = [], impWordIndex = -1, impWordIndices = []) {
  const { hero, full } = splitCaptionForTemplate(text);
  const blockTypes = ORIGINAL_TEMPLATE_BLOCK_TYPES[templateId] || ['styled'];
  const normalizedBlockIndex = normalizeTemplatePhaseIndex(templateId, blockIndex);
  const blockType = blockTypes[normalizedBlockIndex];
  const activeClass = active ? ' active' : '';
  const lines2 = splitTemplateLines(full, 2);
  const resolvedPreviewLines = resolveTemplatePreviewLines(full, previewLineTexts, 2);
  const upperFull = full.toUpperCase();
  const emphasisIndices = resolveImpWordIndicesForWords(full.split(/\s+/).filter(Boolean), impWordIndex, impWordIndices);

  const wrap = (blockClass, children, extraStyle = {}) => (
    <>
      <OriginalAdvancedTemplateStyles />
      <span className={`lekha-original-template ${templateId}-stage`}>
        <span
          id={`${templateId}-b${normalizedBlockIndex}`}
          className={`sblock ${templateId}-block ${blockClass}${activeClass} lekha-applied-advanced-template`}
          data-template-block-index={normalizedBlockIndex}
          data-template-block-type={blockType}
          style={{
            opacity: 1,
            transition: active ? 'opacity 280ms ease' : 'none',
            ...extraStyle,
          }}
        >
          {children}
        </span>
      </span>
    </>
  );

  switch (templateId) {
    case 't11': {
      if (normalizedBlockIndex === 1) {
        return wrap('t11-b1', (
          <span className="blur-txt lekha-template-fit">
            {renderTextWithHero(full, 'imp-italic')}
          </span>
        ));
      }
      if (normalizedBlockIndex === 2) return wrap('t11-b2', renderWbwText(full, 'wbw-rise', 'imp-gold', active));
      if (normalizedBlockIndex === 3) return wrap('t11-b3', renderWbwText(full, 'wbw-rise', 'imp-gold', active));
      return wrap('t11-b0', renderWbwText(full, 'wbw-seq-fade', 'imp-gold', active));
    }
    case 't12':
      if (normalizedBlockIndex === 1) return wrap('t12-b1', <span className="rise-unit lekha-template-fit">{renderTextWithHero(full, 'imp-purple')}</span>);
      if (normalizedBlockIndex === 2) return wrap('t12-b2', renderWbwText(full, 'wbw-rise', 'imp-italic', active, { impWordIndices: emphasisIndices }));
      if (normalizedBlockIndex === 3) return wrap('t12-b3', renderWbwText(full, 'wbw-slide', 'imp-rose', active, { impWordIndices: emphasisIndices }));
      return wrap('t12-b0', renderWbwText(full, 'wbw-seq-fade', 'imp-purple', active, { impWordIndices: emphasisIndices }));
    case 't13':
      if (normalizedBlockIndex === 1) return wrap('t13-b1', renderWbwText(full, 'wbw-slide', 'imp-bold', active));
      if (normalizedBlockIndex === 2) return wrap('t13-b2', renderWbwText(full, 'wbw-rise', 'imp-bold', active));
      if (normalizedBlockIndex === 3) return wrap('t13-b3', renderWbwText(full, 'wbw-seq-fade', 'imp-bold', active));
      return wrap('t13-b0', renderWbwText(full, 'wbw-rise', 'imp-bold', active));
    case 't14':
      if (normalizedBlockIndex === 1) return wrap('t14-b1', <span className="drop-txt lekha-template-fit">{renderTextWithHero(full, 'imp-gold')}</span>);
      if (normalizedBlockIndex === 2) return wrap('t14-b2', <span className="lekha-template-fit">{full}</span>);
      if (normalizedBlockIndex === 3) return wrap('t14-b3', renderWbwText(full, 'wbw-rise', 'imp-weight', active));
      return wrap('t14-b0', (
        <span style={{ perspective: '600px' }} className="lekha-template-fit">
          {lines2.map((line, index) => (
            <span key={line} className="flip-line" style={{ animationDelay: `${index * 0.1}s` }}>
              {index === lines2.length - 1 ? renderTextWithHero(line, 'w imp-underline in') : line}
            </span>
          ))}
        </span>
      ));
    case 't15':
      if (normalizedBlockIndex === 1) return wrap('t15-b1', <span className="pop-txt lekha-template-fit">{upperFull}</span>);
      if (normalizedBlockIndex === 2) return wrap('t15-b2', renderWbwText(full, 'wbw-rise', 'imp-bold', active));
      if (normalizedBlockIndex === 3) return wrap('t15-b3', renderWbwText(full, 'wbw-seq-fade', 'imp-rose', active));
      return wrap('t15-b0', (
        <span className="shake-in lekha-template-fit">
          {lines2[0]}{lines2[1] && <><br />{renderTextWithHero(lines2[1], 'imp-rose')}</>}
        </span>
      ));
    case 't16':
      if (normalizedBlockIndex === 1) return wrap('t16-b1', renderWbwText(full, 'wbw-rise', 'imp-bold', active, { motion: 't16-neon', lineClassName: 't16-neon-words' }));
      if (normalizedBlockIndex === 2) return wrap('t16-b2', renderWbwText(full, 'wbw-rise', 'imp-bold', active, { motion: 't16-diagonal', lineClassName: 't16-diagonal-words' }));
      if (normalizedBlockIndex === 3) return wrap('t16-b3', renderWbwText(full, 'wbw-slide', 'imp-bold', active, { motion: 't16-impact', lineClassName: 't16-impact-words' }));
      return wrap('t16-b0', renderWbwText(full, 'wbw-rise', 'imp-bold', active, { motion: 't16-stack', lineClassName: 't16-stack-words' }));
    case 't17':
      if (normalizedBlockIndex === 1) return wrap('t17-b1', renderWbwText(full, 'wbw-rise', 'imp-rose', active));
      if (normalizedBlockIndex === 2) return wrap('t17-b2', renderWbwText(full, 'wbw-slide', 'imp-rose', active));
      if (normalizedBlockIndex === 3) return wrap('t17-b3', renderWbwText(full, 'wbw-rise', 'imp-rose', active));
      return wrap('t17-b0', renderWbwText(full, 'wbw-seq-fade', 'imp-rose', active));
    case 't18':
      if (normalizedBlockIndex === 1) return wrap('t18-b1', <span className="reveal-txt lekha-template-fit">{renderTextWithHero(full, 'imp-purple')}</span>);
      if (normalizedBlockIndex === 2) return wrap('t18-b2', renderWbwText(full, 'wbw-rise', 'imp-purple', active));
      if (normalizedBlockIndex === 3) return wrap('t18-b3', renderWbwText(full, 'wbw-rise', 'imp-purple', active));
      return wrap('t18-b0', (
        <span className="split-title lekha-template-fit">
          <span className="split-top">{resolvedPreviewLines[0] || full}</span>
          <span className="split-bot">
            {resolvedPreviewLines[1] ? renderTextWithHero(resolvedPreviewLines[1], 'imp-purple') : ''}
          </span>
        </span>
      ));
    case 't19':
      if (normalizedBlockIndex === 1) return wrap('t19-b1', <span className="rise-unit lekha-template-fit">{renderTextWithHero(upperFull, 'imp-rose')}</span>);
      if (normalizedBlockIndex === 2) return wrap('t19-b2', renderWbwText(full, 'wbw-rise', 'imp-bold', active));
      if (normalizedBlockIndex === 3) return wrap('t19-b3', renderWbwText(full, 'wbw-seq-fade', 'imp-rose', active));
      return wrap('t19-b0', <span className="slash-wrap lekha-template-fit">{upperFull}</span>);
    case 't20':
      if (normalizedBlockIndex === 1) return wrap('t20-b1', <span className="impact-txt lekha-template-fit">{renderTextWithHero(full, 'imp-green')}</span>);
      if (normalizedBlockIndex === 2) return wrap('t20-b2', renderWbwText(full, 'wbw-rise', 'imp-bold', active));
      if (normalizedBlockIndex === 3) return wrap('t20-b3', renderWbwText(full, 'wbw-seq-fade', 'imp-green', active));
      return wrap('t20-b0', <span className="impact-slide lekha-template-fit">{upperFull}</span>);
    case 't21':
      if (normalizedBlockIndex === 1) return wrap('t21-b1', renderWbwText(full, 'wbw-seq-fade', 'imp-space', active));
      if (normalizedBlockIndex === 2) return wrap('t21-b2', renderWbwText(full, 'wbw-rise', 'imp-italic', active));
      if (normalizedBlockIndex === 3) return wrap('t21-b3', renderWbwText(full, 'wbw-slide', 'imp-weight', active));
      return wrap('t21-b0', renderWbwText(full, 'editorial-line wbw-rise', '', active));
    case 't22':
      if (normalizedBlockIndex === 1) return wrap('t22-b1', <span className="wave-txt lekha-template-fit">{renderTextWithHero(full, 'imp-gold')}</span>);
      if (normalizedBlockIndex === 2) return wrap('t22-b2', renderWbwText(full, 'wbw-rise', 'imp-italic', active));
      if (normalizedBlockIndex === 3) return wrap('t22-b3', renderWbwText(full, 'wbw-seq-fade', 'imp-gold', active));
      return wrap('t22-b0', renderKaraokeText(full));
    case 't23':
      if (normalizedBlockIndex === 1) return wrap('t23-b1', <span className="lekha-template-fit">{full}</span>);
      if (normalizedBlockIndex === 2) return wrap('t23-b2', <span className="lekha-template-fit">{full}</span>);
      if (normalizedBlockIndex === 3) return wrap('t23-b3', <span className="punch-txt lekha-template-fit">{renderTextWithHero(full, 'imp-bold')}</span>);
      return wrap('t23-b0', <span className="setup-txt lekha-template-fit">{full}</span>);
    case 't24':
      if (normalizedBlockIndex === 1) return wrap('t24-b1', renderWbwText(full, 'wbw-rise', 'imp-orange', active, { motion: 't24-drift', lineClassName: 't24-drift-line' }));
      if (normalizedBlockIndex === 2) return wrap('t24-b2', renderWbwText(full, 'wbw-slide', 'imp-orange', active, { motion: 't24-slide', lineClassName: 't24-slide-line' }));
      if (normalizedBlockIndex === 3) return wrap('t24-b3', renderWbwText(full, 'wbw-rise', 'imp-purple', active, { motion: 't24-stamp', lineClassName: 't24-stamp-line' }));
      if (normalizedBlockIndex === 4) return wrap('t24-b4', renderWbwText(full, 'wbw-rise', 'imp-orange', active, { motion: 't24-inner', lineClassName: 't24-inner-line' }));
      return wrap('t24-b0', (
        renderWbwText(full, 'wbw-rise', 'imp-orange', active, { motion: 't24-wipe', lineClassName: 't24-wipe-line' })
      ));
    case 't25':
      if (normalizedBlockIndex === 1) return wrap('t25-b1', <span className="soft-rise lekha-template-fit">{renderTextWithHero(full, 'imp-italic')}</span>);
      if (normalizedBlockIndex === 2) return wrap('t25-b2', renderWbwText(full, 'wbw-rise', 'imp-rose', active));
      if (normalizedBlockIndex === 3) return wrap('t25-b3', renderWbwText(full, 'wbw-slide', 'imp-italic', active));
      return wrap('t25-b0', (
        <span className="hand-txt lekha-template-fit">
          {lines2[0]}{lines2[1] && <><br />{renderTextWithHero(lines2[1], 'imp-rose')}</>}
        </span>
      ));
    case 't26':
      if (normalizedBlockIndex === 1) return wrap('t26-b1', renderWbwText(upperFull, 'wbw-slide', 'imp-rose', active, { motion: 't26-snap', lineClassName: 't26-snap-line' }));
      if (normalizedBlockIndex === 2) return wrap('t26-b2', renderWbwText(full, 'wbw-rise', 'imp-bold', active, { motion: 't26-kick', lineClassName: 't26-kick-line' }));
      if (normalizedBlockIndex === 3) return wrap('t26-b3', renderWbwText(full, 'wbw-seq-fade', 'imp-rose', active, { motion: 't26-tag', lineClassName: 't26-tag-line' }));
      return wrap('t26-b0', renderWbwText(upperFull, 'wbw-rise', 'imp-rose', active, { motion: 't26-shutter', lineClassName: 't26-shutter-line' }));
    case 't27':
      if (normalizedBlockIndex === 1) return wrap('t27-b1', <span className="lekha-template-fit" style={{ fontFamily: "'Exo 2', sans-serif", fontWeight: 700, color: 'rgba(0,229,255,0.8)' }}>{full}</span>);
      if (normalizedBlockIndex === 2) return wrap('t27-b2', <span className="lekha-template-fit">{renderTextWithHero(full, 'imp-bold')}</span>);
      if (normalizedBlockIndex === 3) return wrap('t27-b3', renderWbwText(full, 'wbw-rise', 'imp-cyan', active, { impWordIndices: emphasisIndices }));
      return wrap('t27-b0', <span className="center-expand-txt lekha-template-fit">{upperFull}</span>);
    case 't28':
      if (normalizedBlockIndex === 1) return wrap('t28-b1', <span className="slow-fade lekha-template-fit">{renderTextWithHero(full, 'imp-gold')}</span>);
      if (normalizedBlockIndex === 2) return wrap('t28-b2', renderWbwText(full, 'wbw-rise', 'imp-gold', active));
      if (normalizedBlockIndex === 3) return wrap('t28-b3', renderWbwText(full, 'wbw-seq-fade', 'imp-gold', active));
      return wrap('t28-b0', (
        <span className="grain-txt lekha-template-fit">
          {lines2[0]}{lines2[1] && <><br />{renderTextWithHero(lines2[1], 'imp-gold')}</>}
        </span>
      ));
    case 't29':
      if (normalizedBlockIndex === 1) return wrap('t29-b1', renderWbwText(full, 'wbw-rise', 'imp-rose', active, { motion: 't29-recoil', lineClassName: 't29-recoil-line' }));
      if (normalizedBlockIndex === 2) return wrap('t29-b2', renderWbwText(full, 'wbw-slide', 'imp-rose', active, { motion: 't29-charge', lineClassName: 't29-charge-line' }));
      if (normalizedBlockIndex === 3) return wrap('t29-b3', renderWbwText(full, 'wbw-seq-fade', 'imp-rose', active, { motion: 't29-clamp', lineClassName: 't29-clamp-line' }));
      return wrap('t29-b0', renderWbwText(full, 'wbw-rise', 'imp-rose', active, { motion: 't29-shutter', lineClassName: 't29-shutter-line' }));
    case 't30':
      if (normalizedBlockIndex > 0) return wrap(`t30-b${normalizedBlockIndex}`, <span className="lekha-template-fit">{normalizedBlockIndex === 3 ? renderTextWithHero(full, 'imp-italic') : full}</span>);
      return wrap('t30-b0', (
        <span className="breathe-txt lekha-template-fit">
          {lines2[0]}{lines2[1] && <><br /><span className="imp-italic">{lines2[1]}</span></>}
        </span>
      ));
    case 't31':
      if (normalizedBlockIndex === 1) return wrap('t31-b1', renderWbwText(full, 'wbw-seq-fade', 'imp-gold', active));
      if (normalizedBlockIndex === 2) return wrap('t31-b2', renderWbwText(full, 'wbw-rise', 'imp-gold', active));
      if (normalizedBlockIndex === 3) return wrap('t31-b3', renderWbwText(full, 'wbw-rise', 'imp-gold', active));
      if (normalizedBlockIndex === 4) return wrap('t31-b4', <span style={{ perspective: '500px' }} className="lekha-template-fit"><span className="flip-line" style={{ fontFamily: "'Playfair Display', serif" }}>{renderTextWithHero(full, 'imp-gold')}</span></span>);
      return wrap('t31-b0', renderWbwText(full, 'wbw-seq-fade', 'imp-gold', active));
    case 't32':
      if (normalizedBlockIndex === 1) return wrap('t32-b1', <span style={{ perspective: '500px' }} className="lekha-template-fit"><span className="flip-line" style={{ fontFamily: "'Bodoni Moda', serif", fontStyle: 'italic' }}>{renderTextWithHero(full, 'imp-italic')}</span></span>);
      if (normalizedBlockIndex === 2) return wrap('t32-b2', <span className="lekha-template-fit">{full}</span>);
      if (normalizedBlockIndex === 3) return wrap('t32-b3', renderWbwText(full, 'wbw-rise', 'imp-purple', active));
      if (normalizedBlockIndex === 4) return wrap('t32-b4', renderWbwText(full, 'wbw-seq-fade', 'imp-purple', active));
      return wrap('t32-b0', (
        <span style={{ fontStyle: 'italic' }} className="lekha-template-fit">
          {lines2.map((line, index) => (
            <span key={`${line}-${index}`} className="ink-line">
              {index === lines2.length - 1 ? renderTextWithHero(line, 'imp-purple') : line}
            </span>
          ))}
        </span>
      ));
    case 't33':
      if (normalizedBlockIndex === 1) return wrap('t33-b1', renderWbwText(full, 'wbw-seq-fade', 'imp-cyan', active, { compactLines: true, lineTexts: previewLineTexts, impWordIndices: emphasisIndices }));
      if (normalizedBlockIndex === 2) return wrap('t33-b2', renderKaraokeText(full));
      if (normalizedBlockIndex === 3) return wrap('t33-b3', renderWbwText(full, 'wbw-rise', 'imp-bold', active, { compactLines: true, lineTexts: previewLineTexts, impWordIndices: emphasisIndices }));
      if (normalizedBlockIndex === 4) return wrap('t33-b4', (
        <span style={{ perspective: '500px' }} className="lekha-template-fit">
          <span className="flip-line" style={{ fontFamily: "'Noto Sans', sans-serif" }}>
            {renderTextWithHero(full, 'imp-cyan')}
          </span>
        </span>
      ));
      return wrap('t33-b0', (
        <span className="doc-line lekha-template-fit">
          {resolvedPreviewLines.map((line, index) => (
            <span className="lekha-template-preview-line" key={`${line}-${index}`}>
              {line.includes(hero) ? renderTextWithHero(line, 'imp-cyan') : line}
            </span>
          ))}
        </span>
      ));
    case 't34':
      if (normalizedBlockIndex === 1) return wrap('t34-b1', <span className="pow-txt lekha-template-fit">{renderTextWithHero(full, 'imp-cyan')}</span>);
      if (normalizedBlockIndex === 2) return wrap('t34-b2', renderWbwText(full, 'wbw-rise', 'imp-bold', active, { impWordIndices: emphasisIndices }));
      if (normalizedBlockIndex === 3) return wrap('t34-b3', renderWbwText(full, 'wbw-slide', 'imp-cyan', active, { impWordIndices: emphasisIndices }));
      return wrap('t34-b0', renderWbwText(full, 'wbw-seq-fade', 'imp-bold', active, { impWordIndices: emphasisIndices }));
    case 't35':
      if (normalizedBlockIndex > 0) return wrap(`t35-b${normalizedBlockIndex}`, <span className="lekha-template-fit">{normalizedBlockIndex === 3 ? renderTextWithHero(full, 'imp-italic') : full}</span>);
      return wrap('t35-b0', <span className="secret-txt lekha-template-fit">{renderTextWithHero(full, 'imp-italic')}</span>);
    case 't36':
      return wrap(`t36-b${normalizedBlockIndex}`, renderKaraokeText(full));
    case 't37':
      if (normalizedBlockIndex === 1) return wrap('t37-b1', renderWbwText(full, 'wbw-rise', 'imp-green', active));
      if (normalizedBlockIndex === 2) return wrap('t37-b2', <span className="neon-expand lekha-template-fit">{upperFull}</span>);
      if (normalizedBlockIndex === 3) return wrap('t37-b3', renderWbwText(full, 'wbw-seq', 'imp-green', active));
      return wrap('t37-b0', <span className="neon-pulse lekha-template-fit">{upperFull}</span>);
    case 't38':
      if (normalizedBlockIndex === 1) return wrap('t38-b1', renderWbwText(full, 'wbw-slide', 'imp-italic', active));
      if (normalizedBlockIndex === 2) return wrap('t38-b2', renderWbwText(full, 'wbw-rise', 'imp-gold', active));
      if (normalizedBlockIndex === 3) return wrap('t38-b3', renderWbwText(full, 'wbw-seq-fade', 'imp-italic', active));
      return wrap('t38-b0', (
        <span className="lekha-template-fit lekha-template-preview-lines">
          {resolvedPreviewLines.map((line, index) => (
            <React.Fragment key={`${line}-${index}`}>
              {index > 0 && <br />}
              {line}
            </React.Fragment>
          ))}
        </span>
      ));
    case 't39':
      return wrap(`t39-b${normalizedBlockIndex}`, renderWbwText(full, 'wbw-seq-fade', normalizedBlockIndex % 2 ? 'imp-rose' : 'imp-gold', active, {
        impWordIndices: emphasisIndices,
        motion: 't39-evidence',
      }));
    case 't40':
      if (normalizedBlockIndex === 2) return wrap('t40-b2', <span className="lekha-template-fit">{renderStillFramesText(full)}</span>);
      return wrap(`t40-b${normalizedBlockIndex}`, <span className="lekha-template-fit">{renderStillFramesText(full)}</span>);
    case 't41':
    case 't42':
    case 't43':
    case 't44':
    case 't45':
    case 't46':
    case 't47':
    case 't48':
    case 't49':
    case 't50':
    case 't51':
    case 't52':
      return wrap(`${templateId}-b${normalizedBlockIndex}`, renderKeyframeTemplateLine(templateId, normalizedBlockIndex, blockType, full, emphasisIndices));
    default:
      return null;
  }
}

export function clampTemplateProgress(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

export function advancedEaseOut(progress) {
  const normalized = clampTemplateProgress(progress);
  return 1 - Math.pow(1 - normalized, 3);
}

export function getAdvancedRenderedBlockType(block, templateId, blockIndex) {
  if (!block) return getOriginalTemplateBlockType(templateId, blockIndex);
  const explicitType = block.dataset.templateBlockType || block.dataset.type;
  if (explicitType) return explicitType;
  const wordLine = block.querySelector?.('.wbw-seq-fade, .wbw-seq-flip, .wbw-seq, .wbw-slide, .wbw-rise');
  if (wordLine?.classList?.contains('wbw-seq-fade')) return 'wbw-seq-fade';
  if (wordLine?.classList?.contains('wbw-seq-flip')) return 'wbw-seq-flip';
  if (wordLine?.classList?.contains('wbw-seq')) return 'wbw-seq';
  if (wordLine?.classList?.contains('wbw-slide')) return 'wbw-slide';
  if (wordLine?.classList?.contains('wbw-rise')) return 'wbw-rise';
  return getOriginalTemplateBlockType(templateId, blockIndex);
}

export function syncAdvancedTemplateBlockFrame(block, {
  templateId,
  blockIndex,
  text,
  currentTime,
  startTime,
  endTime,
  isPlaying,
} = {}) {
  if (!block) return;
  const blockType = getAdvancedRenderedBlockType(block, templateId, blockIndex);
  const wordCount = Math.max(
    1,
    String(text || '').trim().split(/\s+/).filter(Boolean).length,
  );
  const captionDurationMs = Math.max(0, (Number(endTime || 0) - Number(startTime || 0)) * 1000);
  const elapsedMs = Math.max(0, (Number(currentTime || 0) - Number(startTime || 0)) * 1000);
  const playbackElapsedMs = getAdvancedPlaybackElapsedMs(blockType, wordCount, captionDurationMs, elapsedMs);

  block.dataset.templatePaused = isPlaying ? 'false' : 'true';
  if (isKeyframeAdvancedTemplateId(templateId)) {
    // Keyframe templates resolve to their settled frame whenever paused.
    seekKeyframeTemplateAnimations(block, { elapsedMs, captionDurationMs, settled: !isPlaying });
    return;
  }
  if (String(blockType).startsWith('wbw-')) {
    applyAdvancedWbwFrame(block, blockType, playbackElapsedMs, false);
  } else if (blockType === 'karaoke') {
    applyAdvancedKaraokeFrame(block, playbackElapsedMs, false);
  } else if (blockType === 'styled') {
    syncAdvancedCssAnimations(block, playbackElapsedMs, false);
  }
}

export function applyAdvancedWbwFrame(block, blockType, elapsedMs, settled) {
  const sequential = ['wbw-seq', 'wbw-seq-fade', 'wbw-seq-flip'].includes(blockType);
  const words = Array.from(block.querySelectorAll('.w'));
  const setImportant = (element, property, value) => {
    element?.style?.setProperty?.(property, value, 'important');
  };

  words.forEach((word, fallbackIndex) => {
    const index = Number.isFinite(Number(word.dataset.i)) ? Number(word.dataset.i) : fallbackIndex;
    const isImp = word.dataset.imp === 'true';
    const impClass = word.dataset.impCls || '';
    const wordBlockType = word.dataset.lineMotion || blockType;
    const isEvidenceEmphasis = wordBlockType === 't39-evidence' && isImp;
    const lineDelayMs = Number(word.dataset.lineDelay || 0);
    const battleMotion = word.dataset.battleMotion || '';
    const battleIndex = Number.isFinite(Number(word.dataset.battleIndex))
      ? Number(word.dataset.battleIndex)
      : index;
    const delay = sequential
      ? index * ADVANCED_TEMPLATE_TIMING.sequentialStaggerMs
      : battleMotion
        ? (battleIndex * 58) + lineDelayMs + (isImp ? 24 : 0)
        : (index * ADVANCED_TEMPLATE_TIMING.wordStaggerMs)
        + (isImp ? ADVANCED_TEMPLATE_TIMING.emphasisDelayMs : 0)
        + lineDelayMs;
    const duration = isEvidenceEmphasis
      ? 360
      : sequential
      ? ADVANCED_TEMPLATE_TIMING.sequentialDurationMs
      : battleMotion
        ? (isImp ? 380 : 320)
        : isImp
        ? ADVANCED_TEMPLATE_TIMING.emphasisDurationMs
        : ADVANCED_TEMPLATE_TIMING.wordDurationMs;
    const progress = settled ? 1 : clampTemplateProgress((elapsedMs - delay) / duration);
    const eased = advancedEaseOut(progress);

    word.style.animation = 'none';
    word.style.transition = 'none';
    word.style.opacity = String(progress);
    word.style.clipPath = '';
    word.style.transformOrigin = '';
    word.style.filter = '';
    word.style.textShadow = '';

    if (battleMotion === 'sweep-left') {
      word.style.transform = `translateX(${-34 * (1 - eased)}px)`;
    } else if (battleMotion === 'lift-up') {
      word.style.transform = `translateY(${28 * (1 - eased)}px)`;
    } else if (isEvidenceEmphasis) {
      word.style.transform = `translateY(${18 * (1 - eased)}px) scale(${0.72 + (0.28 * eased)}) rotate(${-2 * (1 - eased)}deg)`;
      word.style.textShadow = `0 0 ${4 + (10 * eased)}px currentColor`;
    } else if (sequential) {
      if (blockType === 'wbw-seq-fade') {
        word.style.transform = 'none';
      } else if (blockType === 'wbw-seq-flip') {
        word.style.transform = `perspective(320px) rotateX(${-90 * (1 - eased)}deg)`;
        word.style.transformOrigin = 'center bottom';
      } else {
        word.style.transform = `scale(${0.82 + (0.18 * eased)})`;
      }
    } else if (wordBlockType === 't16-stack') {
      word.style.transform = `translateY(${24 * (1 - eased)}px) scale(${0.92 + (0.08 * eased)})`;
      word.style.filter = `blur(${4 * (1 - eased)}px)`;
    } else if (wordBlockType === 't16-neon') {
      word.style.transform = `scale(${0.86 + (0.14 * eased)})`;
      word.style.filter = `brightness(${0.75 + (0.25 * eased)})`;
      word.style.textShadow = `0 0 ${4 + (12 * eased)}px rgba(0,229,255,${0.25 + (0.35 * eased)})`;
    } else if (wordBlockType === 't16-diagonal') {
      word.style.transform = `translate(${28 * (1 - eased)}px, ${-20 * (1 - eased)}px) rotate(${-4 * (1 - eased)}deg)`;
    } else if (wordBlockType === 't16-impact') {
      word.style.transform = `translateX(${-36 * (1 - eased)}px) scale(${1 + (0.1 * (1 - eased))})`;
    } else if (wordBlockType === 't24-wipe') {
      word.style.opacity = '1';
      word.style.transform = `translateY(${10 * (1 - eased)}px)`;
      word.style.clipPath = `inset(${(1 - eased) * 100}% 0 0 0)`;
    } else if (wordBlockType === 't24-drift') {
      word.style.transform = `translate(${6 * (1 - eased)}px, ${10 * (1 - eased)}px) rotate(${1 * (1 - eased)}deg)`;
      word.style.filter = `blur(${2 * (1 - eased)}px)`;
    } else if (wordBlockType === 't24-slide') {
      word.style.transform = `translateX(${-14 * (1 - eased)}px)`;
    } else if (wordBlockType === 't24-stamp') {
      word.style.transform = `scale(${1.08 - (0.08 * eased)})`;
      word.style.textShadow = `0 0 ${7 * eased}px rgba(249,115,22,${0.2 + (0.18 * eased)})`;
    } else if (wordBlockType === 't24-inner') {
      word.style.transform = `translateY(${8 * (1 - eased)}px) scale(${0.94 + (0.06 * eased)})`;
      word.style.filter = `blur(${2 * (1 - eased)}px)`;
    } else if (wordBlockType === 't26-shutter') {
      word.style.opacity = progress > 0.08 ? '1' : '0';
      word.style.transform = `translateY(${18 * (1 - eased)}px) skewX(${-8 * (1 - eased)}deg)`;
      word.style.clipPath = `inset(0 0 ${(1 - eased) * 100}% 0)`;
    } else if (wordBlockType === 't26-snap') {
      word.style.transform = `translateX(${-32 * (1 - eased)}px) rotate(${-3 * (1 - eased)}deg)`;
    } else if (wordBlockType === 't26-kick') {
      word.style.transform = `translate(${18 * (1 - eased)}px, ${-16 * (1 - eased)}px) scale(${1 + (0.08 * (1 - eased))})`;
    } else if (wordBlockType === 't26-tag') {
      word.style.transform = `scale(${0.82 + (0.18 * eased)})`;
      word.style.filter = `contrast(${0.75 + (0.25 * eased)})`;
    } else if (wordBlockType === 't29-shutter') {
      word.style.opacity = progress > 0.12 ? '1' : '0';
      word.style.transform = `scaleX(${0.72 + (0.28 * eased)}) translateY(${14 * (1 - eased)}px)`;
      word.style.clipPath = `inset(0 ${(1 - eased) * 48}% 0 ${(1 - eased) * 48}%)`;
    } else if (wordBlockType === 't29-recoil') {
      word.style.transform = `translateY(${-22 * (1 - eased)}px) scale(${1.14 - (0.14 * eased)})`;
    } else if (wordBlockType === 't29-charge') {
      word.style.transform = `translate(${36 * (1 - eased)}px, ${-10 * (1 - eased)}px) skewX(${-10 * (1 - eased)}deg)`;
    } else if (wordBlockType === 't29-clamp') {
      word.style.transform = `scaleY(${0.72 + (0.28 * eased)})`;
      word.style.clipPath = `inset(${(1 - eased) * 42}% 0 ${(1 - eased) * 42}% 0)`;
    } else if (isImp) {
      const entrance = ADVANCED_IMP_ENTRANCES[impClass] || 'opposite';
      const effect = entrance === 'opposite'
        ? (wordBlockType === 'wbw-rise' ? 'opposite-slide' : 'opposite-rise')
        : entrance;
      if (effect === 'wipe') {
        word.style.opacity = '1';
        word.style.transform = 'none';
        word.style.clipPath = `inset(0 ${(1 - eased) * 100}% 0 0)`;
      } else if (effect === 'wipe-up') {
        word.style.opacity = '1';
        word.style.transform = 'none';
        word.style.clipPath = impClass === 'imp-underline'
          ? 'inset(0 0 0 0)'
          : `inset(${(1 - eased) * 100}% 0 0 0)`;
      } else if (effect === 'roll') {
        word.style.transform = `rotateX(${-90 * (1 - eased)}deg)`;
        word.style.transformOrigin = 'center bottom';
      } else if (effect === 'opposite-slide') {
        word.style.transform = `translateX(${-28 * (1 - eased)}px)`;
      } else {
        word.style.transform = `translateY(${28 * (1 - eased)}px)`;
      }
    } else if (wordBlockType === 'wbw-slide') {
      word.style.transform = `translateX(${-16 * (1 - eased)}px)`;
    } else {
      word.style.transform = `translateY(${20 * (1 - eased)}px)`;
    }

    word.classList.toggle('in', progress > 0);
    word.classList.toggle('fx', progress >= 1 && impClass === 'imp-flicker');
    [
      'animation',
      'transition',
      'opacity',
      'transform',
      'transform-origin',
      'filter',
      'clip-path',
      'text-shadow',
    ].forEach((property) => {
      const value = word.style.getPropertyValue(property);
      if (value) setImportant(word, property, value);
    });
    setImportant(word, 'animation', word.style.animation || 'none');
    setImportant(word, 'transition', word.style.transition || 'none');
    setImportant(word, 'transform', word.style.transform || 'none');
    setImportant(word, 'opacity', word.style.opacity || '1');
  });
}

export function applyAdvancedKaraokeFrame(block, elapsedMs, settled) {
  const words = Array.from(block.querySelectorAll('.kf-word'));
  const perWord = ADVANCED_TEMPLATE_TIMING.holdMs / Math.max(1, words.length + 0.5);

  words.forEach((word, index) => {
    const fill = word.querySelector('.kf-fill');
    if (!fill) return;
    const progress = settled
      ? 1
      : clampTemplateProgress((elapsedMs - (index * perWord)) / perWord);
    fill.style.animation = 'none';
    fill.style.transition = 'none';
    fill.style.clipPath = `inset(0 ${(1 - progress) * 100}% 0 0)`;
  });
}

export function syncAdvancedCssAnimations(block, elapsedMs, settled) {
  const targetTime = settled ? ADVANCED_TEMPLATE_TIMING.styledDurationMs : Math.max(0, elapsedMs);
  const setImportant = (element, property, value) => {
    element?.style?.setProperty?.(property, value, 'important');
  };
  const styledDuration = block.classList.contains('t25-b0')
    ? 700
    : block.classList.contains('t25-b1')
      ? 500
      : ADVANCED_TEMPLATE_TIMING.styledDurationMs;
  const progress = clampTemplateProgress(targetTime / Math.max(1, styledDuration));
  const eased = advancedEaseOut(progress);

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

  block.getAnimations({ subtree: true }).forEach((animation) => {
    try {
      const timing = animation.effect?.getComputedTiming?.() || {};
      const duration = Number(timing.duration || 0);
      const iterations = Number(timing.iterations || 1);
      const finiteIterations = Number.isFinite(iterations);
      const computedEndTime = Number(timing.endTime);
      const activeDuration = Number.isFinite(computedEndTime)
        ? computedEndTime
        : duration * (finiteIterations ? iterations : 1);
      const animationTime = settled
        ? activeDuration
        : finiteIterations
          ? Math.min(targetTime, activeDuration)
          : duration > 0
            ? targetTime % duration
            : targetTime;
      animation.pause();
      animation.currentTime = Math.max(0, animationTime);
    } catch {
      // Browser-managed pseudo-element animations are not always seekable.
    }
  });
}

// Some source-markup templates hardcode a decorative font-family on specific
// sub-elements (t11-t40's raw HTML asset for the whole template; LC's
// `.lc-card .script`/`.serif` accent classes for just one word/line) that
// wins over any font resolved onto an ancestor, because a descendant's own
// CSS declaration always beats inheritance regardless of ancestor !important.
// All of those declared fonts are Latin-only, so non-Latin captions (the
// primary use case of this app) silently rendered in a font with no matching
// glyphs there, with no visible error. Walk every element in the given root
// and swap each one's *own* resolved font individually.
export function applySourceTemplateScriptFont(root, text) {
  if (!root || !text) return;
  const nodes = [root, ...root.querySelectorAll('*')];
  nodes.forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    let baseFamily = node.dataset.scriptFontBase;
    if (!baseFamily) {
      baseFamily = window.getComputedStyle(node).fontFamily.split(',')[0].replace(/["']/g, '').trim();
      node.dataset.scriptFontBase = baseFamily;
    }
    const resolved = resolveScriptFont(baseFamily, text);
    if (resolved && resolved !== baseFamily) {
      if (node.dataset.scriptFontOverride !== resolved) {
        node.style.setProperty('font-family', `'${resolved}', sans-serif`, 'important');
        node.dataset.scriptFontOverride = resolved;
        loadGoogleFont(resolved).catch(() => {});
      }
    } else if (node.dataset.scriptFontOverride) {
      node.style.removeProperty('font-family');
      delete node.dataset.scriptFontOverride;
    }
  });
}

export function AppliedAdvancedTemplateCaption({
  caption,
  captionId = '',
  templateId,
  text,
  blockIndex = 0,
  templateMarkup = '',
  impWordIndex = -1,
  impWordIndices = [],
  emphasisColor = '',
  previewLineTexts = [],
  textColor = '#ffffff',
  textGradient = '',
  accentColor = '',
  highlightGradient = '',
  karaokeColor1 = '',
  karaokeColor2 = '',
  karaokeColor3 = '',
  backgroundColor = 'transparent',
  colorsCustomized = false,
  currentTime = 0,
  isPlaying = false,
  startTime = 0,
  endTime = 0,
  renderScale = 1,
  keyframeFontPx = 0,
  onSourceWordClick,
  onSourceWordPointerDown,
  isSelected = false,
}) {
  const hostRef = useRef(null);
  const runnerRef = useRef(null);
  const isKeyframeTemplate = isKeyframeAdvancedTemplateId(templateId);
  const playbackControlRef = useRef({ currentTime, isPlaying });
  const playStateRef = useRef({ currentTime, isPlaying, startTime, endTime });
  playStateRef.current = { currentTime, isPlaying, startTime, endTime };
  const resolvedEmphasisColor = resolveAdvancedTemplateEmphasisColor(templateId, emphasisColor, blockIndex);
  const wordStylesSignature = JSON.stringify(caption?.wordStyles || {});
  const sourceMarkup = buildAppliedAdvancedTemplateInline(
    templateId,
    text,
    blockIndex,
    templateMarkup,
    impWordIndex,
    resolvedEmphasisColor,
    previewLineTexts,
    impWordIndices,
  );

  useEffect(() => {
    const host = hostRef.current;
    const block = host?.querySelector('.lekha-applied-advanced-template');
    if (!block) return undefined;

    let rafId = null;
    let startedAt = 0;
      const blockType = getAdvancedRenderedBlockType(block, templateId, blockIndex);
    block.classList.add('active');
    block.style.opacity = '1';
    block.style.visibility = 'visible';

    const getPlaybackOffsetMs = () => Math.max(
      0,
      (Number(playStateRef.current.currentTime || 0) - Number(startTime || 0)) * 1000,
    );

    const syncToElapsed = (elapsedMs, { playing = false, freeze = false } = {}) => {
      const settled = !playing && !freeze;
      const wordCount = Math.max(
        1,
        String(text || '').trim().split(/\s+/).filter(Boolean).length,
      );
      const captionDurationMs = Math.max(0, (Number(endTime || 0) - Number(startTime || 0)) * 1000);
      const playbackElapsedMs = settled
        ? elapsedMs
        : getAdvancedPlaybackElapsedMs(blockType, wordCount, captionDurationMs, elapsedMs);
      block.dataset.templatePaused = !playing ? 'true' : 'false';

      if (isKeyframeAdvancedTemplateId(templateId)) {
        // Authored CSS keyframes are paused and seeked; a paused caption
        // (including a mid-entrance pause) always shows the settled frame.
        seekKeyframeTemplateAnimations(block, { elapsedMs, captionDurationMs, settled: !playing });
        return;
      }

      if (String(blockType).startsWith('wbw-')) {
        applyAdvancedWbwFrame(block, blockType, playbackElapsedMs, settled);
      } else if (blockType === 'karaoke') {
        applyAdvancedKaraokeFrame(block, playbackElapsedMs, settled);
      } else if (blockType === 'styled') {
        syncAdvancedCssAnimations(block, playbackElapsedMs, settled);
      }
    };

    const stop = () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
    };

    const tick = () => {
      if (!playStateRef.current.isPlaying) {
        stop();
        return;
      }
      syncToElapsed(Math.max(0, window.performance.now() - startedAt), { playing: true });
      rafId = window.requestAnimationFrame(tick);
    };

    const play = () => {
      stop();
      const resumeElapsedMs = getPlaybackOffsetMs();
      startedAt = window.performance.now() - resumeElapsedMs;
      block.dataset.templateAnimationRun = String(Number(block.dataset.templateAnimationRun || 0) + 1);
      syncToElapsed(resumeElapsedMs, { playing: true });
      rafId = window.requestAnimationFrame(tick);
    };

    const pause = () => {
      stop();
      syncToElapsed(getPlaybackOffsetMs(), { playing: false, freeze: true });
    };

    const syncCurrent = () => {
      syncToElapsed(getPlaybackOffsetMs(), {
        playing: playStateRef.current.isPlaying,
        freeze: !playStateRef.current.isPlaying,
      });
    };

    const initialFrame = window.requestAnimationFrame(() => {
      if (playStateRef.current.isPlaying) play();
      else pause();
    });

    runnerRef.current = { play, pause, syncCurrent };
    return () => {
      window.cancelAnimationFrame(initialFrame);
      stop();
      runnerRef.current = null;
    };
  }, [templateId, text, blockIndex, startTime, endTime]);

  useEffect(() => {
    const runner = runnerRef.current;
    if (!runner) return;
    const previous = playbackControlRef.current;
    const timeDelta = Math.abs(Number(currentTime || 0) - Number(previous.currentTime || 0));
    const seeked = previous.isPlaying && isPlaying && timeDelta > 0.75;
    if (!isPlaying) runner.pause();
    else if (!previous.isPlaying || seeked) runner.play();
    playbackControlRef.current = { currentTime, isPlaying };
  }, [currentTime, isPlaying, startTime, endTime]);

  useEffect(() => {
    (KEYFRAME_TEMPLATE_FONTS[templateId] || []).forEach(([family, weights]) => {
      loadGoogleFont(family, weights).catch(() => {});
    });
  }, [templateId]);

  useLayoutEffect(() => {
    applySourceTemplateScriptFont(hostRef.current?.querySelector('.lekha-original-template'), text);
    const cleanup = wireSourceTemplateWordEditing(hostRef.current, {
      caption,
      renderScale,
      emphasisColor: resolvedEmphasisColor,
      onSourceWordClick,
      onSourceWordPointerDown,
      currentTime,
      isPlaying,
      templateBlockType: getOriginalTemplateBlockType(templateId, blockIndex),
      templateSource: 'lekha-advanced',
    });
    syncAdvancedTemplateBlockFrame(hostRef.current?.querySelector('.lekha-applied-advanced-template'), {
      templateId,
      blockIndex,
      text,
      currentTime,
      startTime,
      endTime,
      isPlaying,
    });
    runnerRef.current?.syncCurrent?.();
    return cleanup;
  }, [blockIndex, caption, currentTime, endTime, isPlaying, onSourceWordClick, onSourceWordPointerDown, renderScale, resolvedEmphasisColor, sourceMarkup, startTime, templateId, text, wordStylesSignature]);

  return (
    <span
      ref={hostRef}
      className={[
        'lekha-advanced-template-runtime',
        `template-runtime-${templateId}`,
        colorsCustomized ? 'is-color-customized' : '',
        textGradient ? 'has-text-gradient' : '',
        highlightGradient ? 'has-highlight-gradient' : '',
      ].filter(Boolean).join(' ')}
      data-advanced-template-id={templateId}
      data-template-phase-index={normalizeTemplatePhaseIndex(templateId, blockIndex)}
      data-template-renderer={sourceMarkup ? 'source' : 'fallback'}
      data-applied-template-selected={isSelected ? 'true' : 'false'}
      data-export-caption-id={captionId || ''}
      style={{
        display: 'contents',
        '--template-primary': textColor || '#ffffff',
        '--template-text-gradient': textGradient || 'none',
        '--template-secondary': accentColor || '#d4af37',
        '--template-highlight': accentColor || '#d4af37',
        '--template-highlight-gradient': highlightGradient || 'none',
        '--template-karaoke-1': karaokeColor1 || accentColor || '#DDAA03',
        '--template-karaoke-2': karaokeColor2 || '#22D3EE',
        '--template-karaoke-3': karaokeColor3 || '#FB923C',
        '--template-bg': backgroundColor || 'transparent',
        ...(isKeyframeTemplate && keyframeFontPx > 0
          ? { '--lekha-keyframe-font-px': `${keyframeFontPx}px` }
          : {}),
      }}
    >
      {sourceMarkup ? (
        <>
          <OriginalAdvancedTemplateStyles />
          <span
            className={`lekha-original-template ${templateId}-stage`}
            data-export-measure="advanced-template"
            data-export-caption-id={captionId || ''}
          >
            <span dangerouslySetInnerHTML={{ __html: sourceMarkup }} />
          </span>
        </>
      ) : (
        <>
          <OriginalAdvancedTemplateStyles />
          <span
            className={`lekha-original-template ${templateId}-stage`}
            data-export-measure="advanced-template"
            data-export-caption-id={captionId || ''}
          >
            {renderOriginalTemplateCaption(templateId, text, true, blockIndex, previewLineTexts, impWordIndex, impWordIndices)}
          </span>
        </>
      )}
    </span>
  );
}

export const MemoizedVideo = React.memo(function MemoizedVideo({
  videoRef,
  videoUrl,
  onTimeUpdate,
  onLoadedMetadata,
  onMediaError,
  setIsPlaying,
}) {
  return (
    <video
      ref={videoRef}
      src={videoUrl}
      data-lekha-player="true"
      className="w-full h-full object-contain"
      playsInline
      preload="auto"
      disablePictureInPicture
      controlsList="nodownload nofullscreen noremoteplayback nopip"
      onContextMenu={(e) => e.preventDefault()}
      onTimeUpdate={onTimeUpdate}
      onLoadedMetadata={onLoadedMetadata}
      onError={onMediaError}
      onEnded={() => setIsPlaying(false)}
      onPlay={() => setIsPlaying(true)}
      onPause={(event) => {
        if (event.currentTarget?.error) return;
        setIsPlaying(false);
      }}
    />
  );
}, (prev, next) => {
  // Only re-render when the video source changes — nothing else should touch the DOM
  return prev.videoUrl === next.videoUrl;
});

// Stateless player styling helpers.
export const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const getAnimationStyle = (animationType, speed = 1) => {
  // [keyframe-name, duration-ms, timing, fill]
  const defs = {
    // General
    'rise':        ['rise',        400,  'ease-out',              'both'],
    'pan':         ['pan',         500,  'ease-in-out',           'both'],
    'fade':        ['fade',        500,  'ease-in',               'both'],
    'pop':         ['pop',         300,  'ease-out',              'both'],
    'wipe':        ['wipe',        400,  'ease-out',              'both'],
    'blur':        ['blur',        500,  'ease-in-out',           'both'],
    'succession':  ['succession',  400,  'ease-out',              'both'],
    'breathe':     ['breathe',    1500,  'ease-in-out',           'infinite'],
    'baseline':    ['baseline',    400,  'ease-out',              'both'],
    'drift':       ['drift',       600,  'ease-in-out',           'both'],
    'tectonic':    ['tectonic',    500,  'ease-out',              'both'],
    'tumble':      ['tumble',      600,  'ease-in-out',           'both'],
    // Advanced – Basic
    'zoom_in':     ['zoom_in',     400,  'ease-out',              'both'],
    'zoom_out':    ['zoom_out',    400,  'ease-out',              'both'],
    'fade_in':     ['fade_in',     400,  'ease-out',              'both'],
    'slide_up':    ['slide_up',    400,  'ease-out',              'both'],
    'slide_down':  ['slide_down',  400,  'ease-out',              'both'],
    'slide_left':  ['slide_left',  400,  'ease-out',              'both'],
    'slide_right': ['slide_right', 400,  'ease-out',              'both'],
    'fadeInUp':    ['fadeInUp',    500,  'ease-out',              'both'],
    'fadeInDown':  ['fadeInDown',  500,  'ease-out',              'both'],
    'slideInRight':['slideInRight',500,  'ease-out',              'both'],
    'flipInX':     ['flipInX',     600,  'ease-out',              'both'],
    'flipInY':     ['flipInY',     600,  'ease-out',              'both'],
    'blurIn':      ['blurIn',      500,  'ease-out',              'both'],
    'zoomInFade':  ['zoomInFade',  500,  'ease-out',              'both'],
    'bounceInUp':  ['bounceInUp',  600,  'ease-out',              'both'],
    'skewLeft':    ['skewLeft',    400,  'ease-out',              'both'],
    // Advanced – Kinetic
    'missile':     ['missile',     500,  'cubic-bezier(0.22,1,0.36,1)', 'both'],
    'shockwave':   ['shockwave',   500,  'ease-out',              'both'],
    'typewriter':  ['typewriter',  600,  'steps(20,end)',          'both'],
    'slamDown':    ['slamDown',    500,  'cubic-bezier(0.22,1,0.36,1)', 'both'],
    'fireCharge':  ['fireCharge',  500,  'ease-out',              'both'],
    'stampede':    ['stampede',    500,  'cubic-bezier(0.22,1,0.36,1)', 'both'],
    'recoil':      ['recoil',      400,  'ease-out',              'both'],
    // Advanced – Cinematic
    'irisOpen':    ['irisOpen',    600,  'ease-out',              'both'],
    'parallaxRise':['parallaxRise',700,  'ease-out',              'both'],
    'goldenRatio': ['goldenRatio', 600,  'ease-out',              'both'],
    'curtainSplit':['curtainSplit',500,  'ease-out',              'both'],
    'prestige':    ['prestige',   1000,  'ease-out',              'both'],
    'fadeThroughBlack':['fadeThroughBlack',800,'ease-in-out',     'both'],
    'depthPull':   ['depthPull',   600,  'ease-out',              'both'],
    'slowBurn':    ['slowBurn',   1500,  'ease-in',               'both'],
    'diagonalWipe':['diagonalWipe',500,  'ease-out',              'both'],
    // Advanced – Playful
    'confettiPop': ['confettiPop', 500,  'ease-out',              'both'],
    'stickerSlap': ['stickerSlap', 400,  'cubic-bezier(0.34,1.56,0.64,1)', 'both'],
    'wobbleEntry': ['wobbleEntry', 600,  'ease-out',              'both'],
    'balloonFloat':['balloonFloat',600,  'ease-out',              'both'],
    'colorSplash': ['colorSplash', 500,  'ease-out',              'both'],
  };
  const def = defs[animationType];
  if (!def) return 'none';
  const [name, ms, timing, fill] = def;
  const s = Math.max(0.1, speed || 1);
  const duration = fill === 'infinite' ? `${ms}ms` : `${Math.round(ms / s)}ms`;
  return `${name} ${duration} ${timing} ${fill}`;
};

export const getTextElementDisplayMetrics = (style = {}) => ({
  backgroundPadding: Math.max(1, Math.round(((style.padding ?? 6) || 6) * 0.58)),
  backgroundWidthMultiplier: Math.max(0.94, style.backgroundHMultiplier || 1.05),
  textPadY: Math.max(1, Math.round(((style.padding ?? 6) || 6) * 0.55)),
  textPadX: 6,
});

export const getTextElementEffectCSS = (style = {}) => {
  const effectStyles = computeEffectCSS(style);
  return {
    textShadow: effectStyles.textShadow || (style.hasShadow && !style.textGradient ? `${style.shadowOffsetX || 0}px ${style.shadowOffsetY || 2}px ${style.shadowBlur || 4}px ${style.shadowColor || 'rgba(0,0,0,0.8)'}` : undefined),
    WebkitTextStroke: effectStyles.WebkitTextStroke || (style.hasStroke === true && !style.textGradient ? `${style.strokeWidth || 0.5}px ${style.strokeColor || '#000000'}` : '0px transparent'),
  };
};

export const getWordAnimationStyle = (animationType, speed = 1) => {
  const safeSpeed = Math.max(0.25, Number(speed) || 1);
  const duration = (seconds) => `${+(seconds / safeSpeed).toFixed(2)}s`;
  const animations = {
    'rise': `word-rise ${duration(0.4)} ease-out both`,
    'pan': `word-pan ${duration(0.5)} ease-in-out both`,
    'fade': `fade ${duration(0.5)} ease-in both`,
    'pop': `word-pop ${duration(0.3)} ease-out both`,
    'wipe': `wipe ${duration(0.4)} ease-out both`,
    'blur': `blur ${duration(0.5)} ease-in-out both`,
    'succession': `word-succession ${duration(0.4)} ease-out both`,
    'breathe': `word-breathe ${duration(1.5)} ease-in-out infinite`,
    'baseline': `word-baseline ${duration(0.4)} ease-out both`,
    'drift': `word-drift ${duration(0.6)} ease-in-out both`,
    'tectonic': `word-tectonic ${duration(0.5)} ease-out both`,
    'tumble': `word-tumble ${duration(0.6)} ease-in-out both`
  };
  return animations[animationType] || 'none';
};

export const getCptWordMotionStyle = (caption, wordStyle = {}) => {
  if (!captionHasCreativelyPositionedWords(caption) || !wordHasCreativePosition(wordStyle)) return null

  // CPT words need a stable base so their manually authored placement is not
  // disturbed by template motion. A motion chosen in the floating word editor
  // is intentional, though, and must be allowed to animate on its inner visual
  // span instead of being overwritten by this CPT safeguard.
  const hasSelectedWordAnimation = Boolean(
    wordStyle?.animation && wordStyle.animation !== 'none',
  )
  if (hasSelectedWordAnimation) return null

  return {
    animation: 'none',
    animationDelay: '0s',
    animationPlayState: 'paused',
    transition: 'none',
    transform: 'none',
    clipPath: 'none',
    filter: 'none',
  }
}

export const renderWordTextContent = (word, wordStyle = {}, fallbackColor = 'inherit') => {
  const decoration = wordStyle.textDecoration || 'none';
  const textGradient = typeof wordStyle.textGradient === 'string' ? wordStyle.textGradient.trim() : '';
  const hasGradient = Boolean(textGradient);
  const showUnderline = decoration === 'underline';
  const showLineThrough = decoration === 'line-through';
  const shouldWrapWord = Boolean(wordStyle.boxWidth);

  return (
    <span
      style={{
        position: 'relative',
        display: shouldWrapWord ? 'block' : 'inline-block',
        width: shouldWrapWord ? '100%' : undefined,
        maxWidth: '100%',
        whiteSpace: 'inherit',
        overflowWrap: 'inherit',
        wordBreak: 'inherit',
        transformOrigin: 'center center',
        ...(showLineThrough ? { textDecoration: 'line-through' } : { textDecoration: 'none' }),
        ...computeWordEffectCSS(wordStyle),
        ...(hasGradient ? {
          background: textGradient,
          backgroundImage: textGradient,
          backgroundSize: '100% 100%',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          color: 'transparent',
        } : {
          color: wordStyle.color || fallbackColor,
        }),
      }}
    >
      {word}
      {showUnderline && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: '0.06em',
            height: '0.08em',
            borderRadius: 999,
            background: hasGradient ? textGradient : (wordStyle.color || fallbackColor || 'currentColor'),
          }}
        />
      )}
    </span>
  );
};

export const renderAnimatedDetachedWordContent = (
  word,
  wordStyle = {},
  fallbackColor = 'inherit',
  animation = 'none',
  extraClassName = '',
) => {
  const animationStyle = typeof animation === 'string'
    ? { animation }
    : (animation || { animation: 'none' });
  const shouldWrapWord = Boolean(wordStyle.boxWidth);
  const wrapStyle = {
    whiteSpace: shouldWrapWord ? 'normal' : 'nowrap',
    overflowWrap: shouldWrapWord ? 'anywhere' : 'normal',
    wordBreak: shouldWrapWord ? 'break-all' : 'normal',
    textAlign: 'center',
  };

  return (
    <span
      className={extraClassName}
      style={{
        position: 'relative',
        display: 'inline-block',
        width: shouldWrapWord ? '100%' : 'auto',
        maxWidth: shouldWrapWord ? '100%' : 'none',
        ...wrapStyle,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          transformOrigin: 'center center',
          display: 'inline-block',
          width: shouldWrapWord ? '100%' : 'auto',
          maxWidth: shouldWrapWord ? '100%' : 'none',
          ...animationStyle,
          pointerEvents: 'none',
          ...wrapStyle,
        }}
      >
        {renderWordTextContent(word, wordStyle, fallbackColor)}
      </span>
      <span
        aria-hidden="true"
        style={{
          visibility: 'hidden',
          display: 'inline-block',
          width: shouldWrapWord ? '100%' : 'auto',
          ...wrapStyle,
        }}
      >
        {word}
      </span>
    </span>
  );
};
