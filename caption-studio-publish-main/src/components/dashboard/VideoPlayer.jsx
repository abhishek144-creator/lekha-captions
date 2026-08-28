import React, { useRef, useEffect, useLayoutEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Play, Pause, Volume2, VolumeX, X, Maximize2, Minimize2, ZoomIn, ZoomOut, RotateCcw, Grid2X2, Move, RotateCw, Trash2 } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { resolveScriptFont, loadGoogleFont } from './fontUtils';
import { buildEmotionalCaptionPlan } from './emotionalTemplateUtils';
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
  normalizeTemplatePhaseIndex,
} from './templateMotionConfig';
import {
  extractAdvancedTemplateBlockMarkup,
  extractAdvancedTemplateCardMarkup,
} from './advancedTemplateSourceUtils';
import '../../styles/captionTemplates.css';
import '../../styles/captionTemplatesAdvanced.css';
import '../../styles/advancedTemplateLibrary.css';
import originalTemplateHtml from '../../assets/lekha-captions-T11-T35.html?raw';
// Static <style> emitters + host override CSS, split out of this file.
import {
  APPLIED_TEMPLATE_HOST_OVERRIDES,
  OriginalAdvancedTemplateStyles,
  SidebarSourceTemplateStyles,
} from './videoPlayerTemplateStyles';
import sidebarLegacyTemplateHtml from '../../assets/lekha-captions-20-templates.html?raw';
import sidebarLcTemplateHtml2 from '../../assets/lekha-captions-lc-2.html?raw';
import sidebarLcTemplateHtml3 from '../../assets/lekha-captions-lc-3.html?raw';
import sidebarLcTemplateHtml4 from '../../assets/lekha-captions-lc-4.html?raw';
import sidebarLcTemplateHtml5 from '../../assets/lekha-captions-lc-5.html?raw';
// Shared Basic-template builder — the SAME module the burned-video export uses
// (scripts/render_template_overlay.mjs), so the preview and the exported video
// stay byte-for-byte in sync. Do not re-implement these here.
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
  APPLIED_BASIC_TEMPLATE_FONT_SCALE,
  normalizeAppliedBasicTemplateFontSize,
  getAppliedBasicCurrentWordIndex,
} from './basicTemplateInline.js';
import { resolveCptWordSnap } from './cptSmartGuides.js';
import {
  advanceCaptionWordRevealIndex,
  getCaptionWordRevealIndex,
  getCaptionWordRevealTimes,
} from './cptMotion.js';

const ADVANCED_TEMPLATE_VARIANTS = {
  t01: 'wbw-rise', t02: 'plain-s', t03: 'wbw-rise', t04: 'plain-s', t05: 'wbw-rise',
  t06: 'wbw-rise', t07: 'wbw-rise', t08: 'wbw-rise', t09: 'wbw-rise', t10: 'wbw-rise',
  t11: 'wbw-slide', t12: 'plain-s', t13: 'wbw-rise', t14: 'wbw-slide', t15: 'plain-s',
  t16: 'wbw-rise', t17: 'wbw-slide', t18: 'wbw-rise', t19: 'wbw-rise', t20: 'plain-s',
  t21: 'wbw-rise', t22: 'wbw-rise', t23: 'wbw-rise', t24: 'wbw-rise', t25: 'wbw-slide',
  t26: 'wbw-rise', t27: 'plain-s', t28: 'wbw-rise', t29: 'wbw-rise', t30: 'wbw-slide',
  t31: 'wbw-rise', t32: 'plain-s', t33: 'wbw-rise', t34: 'wbw-rise', t35: 'wbw-rise',
  t36: 'plain-s', t37: 'wbw-rise', t38: 'wbw-slide', t39: 'wbw-rise', t40: 'plain-s',
};
const TEMPLATE_CANVAS_FONT_SCALE = 0.88;
const SIDEBAR_TEMPLATE_APPLIED_WIDTH_CAP = 320;
const sidebarLcTemplateHtml = [
  sidebarLcTemplateHtml2,
  sidebarLcTemplateHtml3,
  sidebarLcTemplateHtml4,
  sidebarLcTemplateHtml5,
].join('\n');
const LC_TEMPLATE_FONT_IMPORT = "@import url('https://fonts.googleapis.com/css2?family=Archivo:ital,wght@0,500;0,600;0,700;0,800;0,900;1,600&family=Fraunces:ital,opsz,wght@1,9..144,500;1,9..144,700&family=Great+Vibes&display=swap');";

function isAdvancedTemplateId(templateId) {
  return /^t\d{2}$/.test(String(templateId || ''));
}

function isRecreatedAdvancedTemplateId(templateId) {
  return RECREATED_ADVANCED_TEMPLATE_IDS.includes(String(templateId || '').trim());
}

function getCaptionTemplateId(caption, fallbackStyle = {}) {
  return String(
    caption?.template_id
    || caption?.applied_template_style?.template_id
    || fallbackStyle?.template_id
    || ''
  ).trim();
}

function wordHasCreativePosition(wordStyle = {}) {
  return (
    Math.abs(Number(wordStyle.abs_x_pct) || 0) > 0.01
    || Math.abs(Number(wordStyle.abs_y_pct) || 0) > 0.01
    || Math.abs(Number(wordStyle.x_pct) || 0) > 0.01
    || Math.abs(Number(wordStyle.y_pct) || 0) > 0.01
    || Math.abs(Number(wordStyle.x) || 0) > 0.01
    || Math.abs(Number(wordStyle.y) || 0) > 0.01
  )
}

function captionHasCreativelyPositionedWords(caption) {
  return Object.values(caption?.wordStyles || {}).some(wordHasCreativePosition)
}

function getCaptionRevealWordIndex(caption, currentTime, wordCount, templateId = '') {
  const safeWordCount = Math.max(1, Number(wordCount) || 1)
  if (captionHasCreativelyPositionedWords(caption)) {
    return getCaptionWordRevealIndex(caption, currentTime, safeWordCount)
  }
  if (isSourceBasicTemplateId(templateId)) {
    return getAppliedBasicCurrentWordIndex(caption, currentTime, safeWordCount)
  }

  const timedWords = Array.isArray(caption?.words)
    ? caption.words.filter((word) => String(word?.word || word?.text || '').trim())
    : []
  if (timedWords.length) {
    let activeIndex = 0
    for (let index = 0; index < timedWords.length; index += 1) {
      const start = Number(
        timedWords[index]?.start
        ?? timedWords[index]?.start_time
        ?? caption?.start_time
        ?? caption?.start
        ?? 0
      )
      if (Number(currentTime || 0) >= start) activeIndex = index
      else break
    }
    return Math.max(0, Math.min(safeWordCount - 1, activeIndex))
  }

  const start = Number(caption?.start_time ?? caption?.start ?? 0)
  const end = Number(caption?.end_time ?? caption?.end ?? start)
  const duration = Math.max(end - start, 0.01)
  const elapsed = Math.min(Math.max(Number(currentTime || 0) - start, 0), duration)
  return Math.max(
    0,
    Math.min(safeWordCount - 1, Math.floor((elapsed / duration) * safeWordCount)),
  )
}

function hasSidebarTemplateStyle(captionStyle) {
  return !!captionStyle?.template_20_id || String(captionStyle?.template_id || '').startsWith('sidebar-')
}

function getTemplateWrapperClassName(templateId) {
  if (!isAdvancedTemplateId(templateId)) return 'cap-text';
  return templateId;
}

function getTemplateContainerStateClass() {
  return '';
}

function getTemplateVariantClassName(templateId) {
  return ADVANCED_TEMPLATE_VARIANTS[templateId] || 'wbw-rise';
}

function getBasicTemplateWordClassName(templateId, isPast, isCurrent, isEmphasis) {
  return [
    'word',
    'active',
    isPast ? 'done' : '',
    isCurrent ? 'current' : '',
    isEmphasis ? 'imp' : '',
  ].filter(Boolean).join(' ');
}

function scaleTemplateFontSize(fontSize) {
  return Math.max(12, Math.round((fontSize || 18) * TEMPLATE_CANVAS_FONT_SCALE));
}

function splitCaptionForTemplate(text = '') {
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return { top: '', hero: '', bottom: '', full: '' };
  if (words.length === 1) {
    return { top: '', hero: words[0], bottom: '', full: words[0] };
  }
  const heroIndex = Math.min(1, words.length - 1);
  return {
    top: words.slice(0, heroIndex).join(' '),
    hero: words[heroIndex] || words[0],
    bottom: words.slice(heroIndex + 1).join(' '),
    full: words.join(' '),
  };
}

function splitTemplateLines(text = '', maxLines = 2) {
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [''];
  const lineCount = Math.max(1, Math.min(maxLines, words.length));
  const lines = Array.from({ length: lineCount }, () => []);
  words.forEach((word, index) => {
    lines[Math.min(lineCount - 1, Math.floor((index * lineCount) / words.length))].push(word);
  });
  return lines.map(line => line.join(' ')).filter(Boolean);
}

function resolveTemplatePreviewLines(text = '', preferredLines = [], maxLines = 2) {
  const normalizedPreferred = Array.isArray(preferredLines)
    ? preferredLines.map((line) => String(line || '').replace(/\s+/g, ' ').trim()).filter(Boolean)
    : [];
  if (normalizedPreferred.length > 0) {
    const requestedWords = normalizedPreferred.flatMap((line) => line.split(/\s+/).filter(Boolean));
    const actualWords = String(text).trim().split(/\s+/).filter(Boolean);
    const sameWords = requestedWords.length === actualWords.length
      && requestedWords.every((word, index) => word === actualWords[index]);
    if (sameWords) return normalizedPreferred;
  }
  return splitTemplateLines(text, maxLines);
}

function shouldCompactTemplateLine(text = '') {
  const value = String(text || '').trim();
  if (!value) return false;
  return value.length > 22
    || usesComplexTemplateScript(value);
}

function usesComplexTemplateScript(text = '') {
  return /[\p{Script=Arabic}\p{Script=Bengali}\p{Script=Devanagari}\p{Script=Gujarati}\p{Script=Gurmukhi}\p{Script=Han}\p{Script=Hiragana}\p{Script=Kannada}\p{Script=Katakana}\p{Script=Malayalam}\p{Script=Oriya}\p{Script=Tamil}\p{Script=Telugu}\p{Script=Thai}]/u.test(String(text || ''));
}

function splitWordsIntoIndexedLines(words = [], maxLines = 2) {
  if (!words.length) return [];
  const lineCount = Math.max(1, Math.min(maxLines, words.length));
  const lines = Array.from({ length: lineCount }, () => []);
  words.forEach((word, wordIndex) => {
    lines[Math.min(lineCount - 1, Math.floor((wordIndex * lineCount) / words.length))].push({ word, wordIndex });
  });
  return lines.filter(line => line.length);
}

function splitBattleCryIndexedLines(tokens = []) {
  if (!tokens.length) return [];
  if (tokens.length <= 3) return [tokens.map((token, wordIndex) => ({ ...token, wordIndex }))];
  const firstLineCount = Math.max(
    2,
    Math.min(tokens.length - 1, Math.ceil(tokens.length * 0.66)),
  );
  return [
    tokens.slice(0, firstLineCount).map((token, wordIndex) => ({ ...token, wordIndex })),
    tokens.slice(firstLineCount).map((token, localIndex) => ({
      ...token,
      wordIndex: firstLineCount + localIndex,
    })),
  ].filter(line => line.length);
}

function splitCompactIndexedLines(tokens = [], preferredLines = []) {
  const normalizedPreferred = Array.isArray(preferredLines)
    ? preferredLines.map((line) => String(line || '').replace(/\s+/g, ' ').trim()).filter(Boolean)
    : [];
  if (normalizedPreferred.length > 1) {
    const preferredWords = normalizedPreferred.flatMap((line) => line.split(/\s+/).filter(Boolean));
    const tokenWords = tokens.map((token) => token.word);
    const sameWords = preferredWords.length === tokenWords.length
      && preferredWords.every((word, index) => word === tokenWords[index]);
    if (sameWords) {
      let cursor = 0;
      return normalizedPreferred.map((lineText) => {
        const count = lineText.split(/\s+/).filter(Boolean).length;
        const line = tokens.slice(cursor, cursor + count).map((token, localIndex) => ({
          ...token,
          wordIndex: cursor + localIndex,
        }));
        cursor += count;
        return line;
      }).filter((line) => line.length);
    }
  }

  return splitBattleCryIndexedLines(tokens);
}

function normalizeImpWordIndices(impWordIndex = -1, impWordIndices = []) {
  const values = Array.isArray(impWordIndices) ? impWordIndices : [];
  const normalized = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value >= 0);
  const single = Number(impWordIndex);
  if (Number.isFinite(single) && single >= 0) normalized.push(single);
  return [...new Set(normalized.map((value) => Math.trunc(value)))];
}

function normalizeTemplateWord(word = '') {
  return String(word || '')
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/^[^\p{L}\p{M}\p{N}]+|[^\p{L}\p{M}\p{N}]+$/gu, '');
}

function getTargetPhraseImpWordIndices(wordsOrTokens = []) {
  const normalizedWords = wordsOrTokens.map((item) => normalizeTemplateWord(item?.word ?? item));
  for (let index = 0; index < normalizedWords.length - 1; index += 1) {
    if (normalizedWords[index] === '\u0926\u0938' && normalizedWords[index + 1] === '\u0932\u0915') {
      return [index, index + 1];
    }
  }
  return [];
}

function resolveImpWordIndicesForWords(wordsOrTokens = [], impWordIndex = -1, impWordIndices = []) {
  const phraseIndices = getTargetPhraseImpWordIndices(wordsOrTokens);
  if (phraseIndices.length) return phraseIndices;
  return normalizeImpWordIndices(impWordIndex, impWordIndices);
}

function getSidebarTemplateLineCount(style = {}, wordCount = 0) {
  const templateClass = String(style.template_class || style.template_20_id || '').toLowerCase();
  const layout = style.template_layout || '';
  if (wordCount <= 3) return 1;
  if (layout === 'stack') return 3;
  if (layout === 'plain') return Math.min(2, wordCount);
  if (/^(a[145]|b[145]|c[1345]|d[12345]|t0[135789]|t1[1345]|v)/.test(templateClass)) return 3;
  return 2;
}

function getSidebarTemplateMotion(style = {}) {
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

function renderTextWithHero(text, className = '') {
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

function renderStillFramesText(text) {
  return <span className="still-frames-line">{renderTextWithHero(text, 'imp-rose still-frames-highlight')}</span>;
}

function renderWbwText(text, variant = 'wbw-rise', impClass = 'imp-bold', active = true, options = {}) {
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

function renderKaraokeText(text) {
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
function resolveAdvancedTemplateEmphasisColor(templateId, emphasisColor = '', blockIndex = -1) {
  const normalizedId = String(templateId || '').trim();
  if (normalizedId === 't23' && Number(blockIndex) === 3) {
    return '#ffffff';
  }
  return emphasisColor || ADVANCED_TEMPLATE_EMPHASIS_COLORS[normalizedId] || '';
}


function extractHtmlStyle(markup = '') {
  return Array.from(
    String(markup).matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi),
    (match) => match[1],
  ).join('\n');
}

function findAppliedSidebarTemplateMarkup(captionStyle = {}) {
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

function findAppliedBasicTemplateMarkup(captionStyle = {}) {
  return findAppliedBasicTemplateMarkupFromHtml(originalTemplateHtml, captionStyle);
}

function resolveAppliedBasicTemplateMarkup(captionStyle = {}) {
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
const _astImpClassPattern = /\b(?:imp-[\w-]+|ns[23]-[\w-]+)\b/g;
const _astImpClassTestPattern = /\b(?:imp-[\w-]+|ns[23]-[\w-]+)\b/;

function _astResolveTargetImpIndex(sourceImpIndex = -1, sourceCount = 0, targetCount = 0, requestedIndex = -1) {
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

function _astReplaceWBW(container, words, settled, impWordIndex = -1, impWordIndices = []) {
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

function _astReplaceSticky(container, words, settled, impWordIndex, impWordIndices = []) {
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

function _astReplaceLcCpt(container, words, impWordIndex, impWordIndices = []) {
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

function _astReplacePositioned(block, words, impWordIndex, impWordIndices = [], forceContiguous = false) {
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

function _astReplacePlain(block, words, captionText, impWordIndex, impWordIndices = []) {
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

function _astFillBlock(block, words, captionText, settled, impWordIndex, impWordIndices = [], forceContiguousPositioned = false) {
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
const _appliedInlineCache = new Map();
const _appliedMarkupSignatureCache = new Map();
function getAppliedTemplateMarkupSignature(markup = '') {
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

function buildAppliedSidebarTemplateInline(captionText, captionStyle, { activePhase = 0, settled = true, impWordIndex = -1, impWordIndices = [] } = {}) {
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

function _buildAppliedSidebarTemplateInlineUncached(rawMarkup, isNew, captionText, activePhase, settled, impWordIndex, impWordIndices = [], forceContiguousPositioned = false) {
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
const _appliedPhaseCache = new Map();
function countAppliedTemplatePhases(captionStyle = {}) {
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

function buildAppliedBasicTemplateInline(captionText, captionStyle, { activePhase = 0, currentIndex = 0, impWordIndex = -1, impWordIndices = [] } = {}) {
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

function countAppliedBasicTemplatePhases(captionStyle = {}) {
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
const _appliedTemplateCssCache = new Map();
function findCssRuleClose(css = '', openIndex = -1) {
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

function scopeAppliedLcSelectorList(selectorList = '') {
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

function scopeAppliedLcTemplateCss(css = '') {
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

const getAppliedLcAnimationName = (name = '') => `lekhaLc-${String(name).trim().replace(/[^a-zA-Z0-9_-]/g, '')}`;

function namespaceAppliedLcKeyframes(css = '') {
  return String(css).replace(
    /@(keyframes|-webkit-keyframes)\s+([a-zA-Z_][\w-]*)/g,
    (_, rule, name) => `@${rule} ${getAppliedLcAnimationName(name)}`,
  );
}

function extractAppliedTemplateCss(source = 'lekha-20') {
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


function AppliedSidebarTemplateStyles({ source = 'lekha-20' }) {
  const css = React.useMemo(() => `${source === 'lekha-lc' ? `${LC_TEMPLATE_FONT_IMPORT}\n` : ''}${extractAppliedTemplateCss(source)}\n${APPLIED_TEMPLATE_HOST_OVERRIDES}`, [source]);
  return <style>{css}</style>;
}

const APPLIED_BASIC_TEMPLATE_PREVIEW_ONLY_OVERRIDES = `
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

function AppliedBasicTemplateStyles() {
  return <style>{`${APPLIED_BASIC_TEMPLATE_HOST_OVERRIDES}\n${APPLIED_BASIC_TEMPLATE_PREVIEW_ONLY_OVERRIDES}`}</style>;
}

function AppliedBasicTemplateMarkup({
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

const APPLIED_WBW_CLASSES = [
  ...LEGACY_WBW_CLASSES,
  'wbw-rise', 'wbw-slide', 'wbw-seq', 'wbw-seq-flip', 'wbw-seq-fade',
];

const APPLIED_LEGACY_TEMPLATE_TIMING = LEGACY_TEMPLATE_TIMING;
const APPLIED_IMP_ANIMS = LEGACY_IMP_ANIMS;

function AppliedSidebarTemplateSourceRenderer({
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
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}


const _advancedSourceMarkupCache = new Map();

function getAppliedAdvancedCardMarkup(templateId, templateMarkup = '') {
  const suppliedMarkup = String(templateMarkup || '');
  if (suppliedMarkup.includes(`id="card-${templateId}"`) || suppliedMarkup.includes(`id='card-${templateId}'`)) {
    return suppliedMarkup;
  }
  return extractAdvancedTemplateCardMarkup(originalTemplateHtml, templateId);
}

function getAppliedAdvancedTemplateImpClass(templateId, blockIndex = 0, templateMarkup = '') {
  const normalizedBlockIndex = normalizeTemplatePhaseIndex(templateId, blockIndex);
  const cardMarkup = getAppliedAdvancedCardMarkup(templateId, templateMarkup);
  const sourceBlock = sanitizeAppliedTemplateMarkup(
    extractAdvancedTemplateBlockMarkup(cardMarkup, templateId, normalizedBlockIndex),
    true,
  );
  return String(sourceBlock || '').match(_astImpClassTestPattern)?.[0] || '';
}

function cleanAppliedAdvancedSourceElement(element) {
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

function replaceAppliedAdvancedWbw(container, words, impWordIndex = -1, emphasisColor = '', impWordIndices = []) {
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

function replaceAppliedAdvancedKaraoke(container, words) {
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

const RECREATED_ADVANCED_WBW_PHASES = {
  t11: { 2: 'imp-gold' },
  t18: { 2: 'imp-purple' },
  t24: { 2: 'imp-orange' },
  t31: { 2: 'imp-gold' },
};

function getRecreatedAdvancedWbwImpClass(templateId, blockIndex) {
  return RECREATED_ADVANCED_WBW_PHASES[String(templateId || '')]?.[Number(blockIndex)] || '';
}

function shouldRecreateAdvancedWbwPhase(templateId, blockIndex) {
  return Boolean(getRecreatedAdvancedWbwImpClass(templateId, blockIndex));
}

function rebuildAppliedAdvancedWbwRiseBlock(block, words, impWordIndex = -1, emphasisColor = '', templateId = '', blockIndex = 0, impWordIndices = []) {
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

function collectAppliedAdvancedTextNodes(root) {
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

function assignAppliedAdvancedWordsToSlots(words, slotCount) {
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

function findAppliedAdvancedStyledImpSlotIndex(slots, block) {
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

function ensureAppliedAdvancedStyledImpSlotHasWord(assigned, impSlotIndex) {
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

function getAppliedAdvancedSourceImpClass(block) {
  const className = Array.from(block.querySelectorAll('*'))
    .map((element) => element.className || '')
    .find((value) => _astImpClassTestPattern.test(String(value)));
  return String(className || '').match(_astImpClassTestPattern)?.[0] || 'imp-gold';
}

function findAppliedAdvancedSlotImpWrapper(slot, block) {
  let element = slot?.parentElement;
  while (element && element !== block) {
    if (_astImpClassTestPattern.test(String(element.className || ''))) return element;
    element = element.parentElement;
  }
  return null;
}

function replaceAppliedAdvancedTextSlot(slot, assignedWords, impWordIndex, impClass, emphasisColor, block, impWordIndices = []) {
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

function replaceAppliedAdvancedStyledText(block, words, captionText, impWordIndex = -1, emphasisColor = '', impWordIndices = []) {
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

function shouldSuppressStyledSemanticEmphasis(templateId, blockType, block) {
  return templateId === 't17' && !!block?.querySelector?.('.snap-txt');
}

function normalizeAppliedAdvancedStyledBlock(block, templateId, blockIndex, captionText = '', previewLineTexts = []) {
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

function buildAppliedAdvancedTemplateInline(
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

function renderOriginalTemplateCaption(templateId, text, active = true, blockIndex = 0, previewLineTexts = [], impWordIndex = -1, impWordIndices = []) {
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
    default:
      return null;
  }
}

function clampTemplateProgress(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function advancedEaseOut(progress) {
  const normalized = clampTemplateProgress(progress);
  return 1 - Math.pow(1 - normalized, 3);
}

function getAdvancedRenderedBlockType(block, templateId, blockIndex) {
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

function syncAdvancedTemplateBlockFrame(block, {
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
  if (String(blockType).startsWith('wbw-')) {
    applyAdvancedWbwFrame(block, blockType, playbackElapsedMs, false);
  } else if (blockType === 'karaoke') {
    applyAdvancedKaraokeFrame(block, playbackElapsedMs, false);
  } else if (blockType === 'styled') {
    syncAdvancedCssAnimations(block, playbackElapsedMs, false);
  }
}

function applyAdvancedWbwFrame(block, blockType, elapsedMs, settled) {
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

function applyAdvancedKaraokeFrame(block, elapsedMs, settled) {
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

function syncAdvancedCssAnimations(block, elapsedMs, settled) {
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
function applySourceTemplateScriptFont(root, text) {
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

function AppliedAdvancedTemplateCaption({
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
  onSourceWordClick,
  onSourceWordPointerDown,
  isSelected = false,
}) {
  const hostRef = useRef(null);
  const runnerRef = useRef(null);
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

// --- Effect CSS helper ---
function _hexRgba(hex, a) {
  try {
    const h = hex.replace('#', '')
    const r = parseInt(h.slice(0, 2), 16)
    const g = parseInt(h.slice(2, 4), 16)
    const b = parseInt(h.slice(4, 6), 16)
    return `rgba(${r},${g},${b},${a})`
  } catch { return hex }
}

function computeEffectCSS(cs) {
  const type = cs?.effect_type || 'none'
  if (type === 'none') return {}
  const color = cs?.effect_color || '#000000'
  const blur   = ((cs?.effect_blur   ?? 50) / 100) * 24  // 0-24px
  const offset = ((cs?.effect_offset ?? 50) / 100) * 16  // 0-16px
  const dir    = cs?.effect_direction ?? -45
  const transp = cs?.effect_transparency ?? 40
  const thick  = cs?.effect_thickness ?? 50
  const alpha  = (100 - transp) / 100
  const rad = (dir * Math.PI) / 180
  const ox = +(Math.cos(rad) * offset).toFixed(1)
  const oy = +(Math.sin(rad) * offset).toFixed(1)
  const rc = (a = alpha) => _hexRgba(color, a)
  switch (type) {
    case 'shadow':
      return { textShadow: `${ox}px ${oy}px ${blur}px ${rc()}` }
    case 'lift':
      return { textShadow: `0px ${(offset * 0.4).toFixed(1)}px ${(blur * 0.5).toFixed(1)}px ${rc()}, 0px ${offset}px ${blur}px ${rc(alpha * 0.4)}` }
    case 'hollow':
      return { WebkitTextStroke: `${(thick / 40).toFixed(1)}px ${color}`, color: 'transparent', WebkitTextFillColor: 'transparent' }
    case 'splice':
      return { textShadow: `${ox}px ${oy}px 0px ${rc()}` }
    case 'outline':
      return { WebkitTextStroke: `${(thick / 40).toFixed(1)}px ${color}` }
    case 'echo':
      return { textShadow: `${ox}px ${oy}px 0px ${rc()}, ${ox * 2}px ${oy * 2}px 0px ${rc(alpha * 0.55)}, ${ox * 3}px ${oy * 3}px 0px ${rc(alpha * 0.25)}` }
    case 'neon': {
      const nc = cs?.effect_color || cs?.text_color || '#39ff14'
      return { textShadow: `0 0 ${(blur * 0.5).toFixed(1)}px ${nc}, 0 0 ${blur}px ${nc}, 0 0 ${(blur * 2).toFixed(1)}px ${nc}` }
    }
    default: return {}
  }
}

// Per-word effect CSS (uses ws keys, not cs keys)
function computeWordEffectCSS(ws) {
  const type = ws?.effectType || 'none';
  if (type === 'none') return {};
  const color = ws?.effectColor || '#000000';
  const blur = ((ws?.effectBlur ?? 50) / 100) * 24;
  const offset = ((ws?.effectOffset ?? 50) / 100) * 16;
  const dir = ws?.effectDirection ?? -45;
  const transp = ws?.effectTransparency ?? 40;
  const thick = ws?.effectThickness ?? 50;
  const alpha = (100 - transp) / 100;
  const rad = (dir * Math.PI) / 180;
  const ox = +(Math.cos(rad) * offset).toFixed(1);
  const oy = +(Math.sin(rad) * offset).toFixed(1);
  const rc = (a = alpha) => _hexRgba(color, a);
  switch (type) {
    case 'shadow': return { textShadow: `${ox}px ${oy}px ${blur}px ${rc()}` };
    case 'lift': return { textShadow: `0px ${(offset*0.4).toFixed(1)}px ${(blur*0.5).toFixed(1)}px ${rc()}, 0px ${offset}px ${blur}px ${rc(alpha*0.4)}` };
    case 'hollow': return { WebkitTextStroke: `${(thick/40).toFixed(1)}px ${color}`, color: 'transparent', WebkitTextFillColor: 'transparent' };
    case 'splice': return { textShadow: `${ox}px ${oy}px 0px ${rc()}` };
    case 'outline': return { WebkitTextStroke: `${(thick/40).toFixed(1)}px ${color}` };
    case 'echo': return { textShadow: `${ox}px ${oy}px 0px ${rc()}, ${ox*2}px ${oy*2}px 0px ${rc(alpha*0.55)}, ${ox*3}px ${oy*3}px 0px ${rc(alpha*0.25)}` };
    case 'neon': return { textShadow: `0 0 ${(blur*0.5).toFixed(1)}px ${color}, 0 0 ${blur}px ${color}, 0 0 ${(blur*2).toFixed(1)}px ${color}` };
    default: return {};
  }
}
// Memoized video element — prevents React from touching the <video> DOM node during
// parent re-renders. Without this, re-renders from scrubbing/state changes cause the
// browser to re-composite the video layer, which can show a black frame on some systems.
const SOURCE_TEMPLATE_WORD_SELECTOR = [
  '.word',
  '.w',
  '.wbw-word',
  '.sw',
  '.sw-w',
  '.kf-word',
  '.plain-word',
  '.is-emphasis',
  '[data-word-key]',
  '[data-w]',
  '[data-i]',
].join(', ');
const SOURCE_TEMPLATE_VISUAL_SELECTOR = '[data-source-word-visual="true"], .kf-base, .kf-fill';
const SOURCE_TEMPLATE_SPACER_SELECTOR = '[data-source-word-spacer="true"]';
const SOURCE_TEMPLATE_MANAGED_STYLE_PROPS = [
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'text-decoration',
  'text-decoration-color',
  'text-decoration-thickness',
  'text-underline-offset',
  'text-transform',
  'background',
  'background-color',
  'background-image',
  'background-size',
  'background-repeat',
  'background-position',
  'border-radius',
  'padding',
  'animation',
  'animation-delay',
  'animation-play-state',
  'transition',
  'filter',
  'clip-path',
  '-webkit-clip-path',
  'text-shadow',
  '-webkit-text-stroke',
  '-webkit-background-clip',
  'background-clip',
  '-webkit-text-fill-color',
  'color',
  'display',
  'position',
  'left',
  'top',
  'z-index',
  'overflow',
  'translate',
  'scale',
  'transform',
  'transform-origin',
  'vertical-align',
  'white-space',
  'box-decoration-break',
  '-webkit-box-decoration-break',
  '--source-word-text-gradient',
];
const SOURCE_TEMPLATE_EFFECT_PROP_NAMES = {
  textShadow: 'text-shadow',
  WebkitTextStroke: '-webkit-text-stroke',
  color: 'color',
  WebkitTextFillColor: '-webkit-text-fill-color',
};

function getEditableSourceTemplateWords(host) {
  if (!host) return [];
  const blocks = Array.from(host.querySelectorAll('.sb, .sblock, .lekha-applied-advanced-template'));
  const scopes = blocks.length ? blocks : [host];
  const seenNodes = new Set();
  const editableWords = [];
  scopes.forEach((scope) => {
    Array.from(scope.querySelectorAll(SOURCE_TEMPLATE_WORD_SELECTOR)).forEach((node) => {
      if (seenNodes.has(node)) return;
      if (node.closest?.(SOURCE_TEMPLATE_SPACER_SELECTOR)) return;
      const parentEditable = node.parentElement?.closest?.(SOURCE_TEMPLATE_WORD_SELECTOR);
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
    .sort((a, b) => a.index - b.index);
}

function getSourceWordText(caption, wordIndex, node) {
  const words = String(caption?.text || '').trim().split(/\s+/).filter(Boolean);
  return words[wordIndex] || String(node?.textContent || '').trim();
}

function wrapSourceTemplatePlainTextNodes(root, startIndex = 0) {
  if (!root) return startIndex;
  let cursor = startIndex;
  Array.from(root.childNodes || []).forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      const raw = child.nodeValue || '';
      if (!raw.trim()) return;
      const pieces = raw.split(/(\s+)/);
      const fragment = child.ownerDocument.createDocumentFragment();
      pieces.forEach((piece) => {
        if (!piece) return;
        if (/^\s+$/.test(piece)) {
          fragment.appendChild(child.ownerDocument.createTextNode(piece));
          return;
        }
        const span = child.ownerDocument.createElement('span');
        span.className = 'plain-word';
        span.setAttribute('data-w', String(cursor));
        span.textContent = piece;
        fragment.appendChild(span);
        cursor += 1;
      });
      child.parentNode?.replaceChild(fragment, child);
      return;
    }

    if (child.nodeType !== Node.ELEMENT_NODE) return;
    if (child.matches?.(SOURCE_TEMPLATE_VISUAL_SELECTOR)) return;
    if (child.matches?.(SOURCE_TEMPLATE_SPACER_SELECTOR)) return;
    const explicitIndex = Number(child.dataset?.sourceWordIndex ?? child.dataset?.w ?? child.dataset?.i);
    if (Number.isFinite(explicitIndex) && explicitIndex >= 0) {
      cursor = Math.max(cursor, explicitIndex + 1);
      return;
    }
    cursor = wrapSourceTemplatePlainTextNodes(child, cursor);
  });
  return cursor;
}

function rgbaFromHex(hex = '#000000', alpha = 0.6) {
  const normalized = String(hex || '#000000').replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return hex;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getSourceWordAnimationStyle(animationType, speed = 1) {
  const safeSpeed = Math.max(0.25, Number(speed) || 1);
  const duration = (seconds) => `${+(seconds / safeSpeed).toFixed(2)}s`;
  const animations = {
    rise: `source-word-rise ${duration(0.4)} ease-out both`,
    pan: `source-word-pan ${duration(0.5)} ease-in-out both`,
    fade: `source-word-fade ${duration(0.5)} ease-in both`,
    pop: `source-word-pop ${duration(0.3)} ease-out both`,
    wipe: `source-word-wipe ${duration(0.4)} ease-out both`,
    blur: `source-word-blur ${duration(0.5)} ease-in-out both`,
    succession: `source-word-succession ${duration(0.4)} ease-out both`,
    breathe: `source-word-breathe ${duration(1.5)} ease-in-out infinite`,
    baseline: `source-word-baseline ${duration(0.4)} ease-out both`,
    drift: `source-word-drift ${duration(0.6)} ease-in-out both`,
    tectonic: `source-word-tectonic ${duration(0.5)} ease-out both`,
    tumble: `source-word-tumble ${duration(0.6)} ease-in-out both`,
  };
  return animations[animationType] || 'none';
}

function getSourceTemplateEventElement(event) {
  const target = event?.target;
  if (!target) return null;
  if (target.nodeType === Node.ELEMENT_NODE) return target;
  return target.parentElement || null;
}

function findSourceTemplateWordNode(event, host) {
  const element = getSourceTemplateEventElement(event);
  const wordNode = element?.closest?.('[data-source-word-index]');
  if (!wordNode || !host?.contains?.(wordNode)) return null;
  return wordNode;
}

function getSourceTemplateVisualTargets(node) {
  if (!node) return [];
  const existingTargets = Array.from(node.querySelectorAll(SOURCE_TEMPLATE_VISUAL_SELECTOR));
  if (existingTargets.length) return existingTargets;

  const spacer = document.createElement('span');
  spacer.dataset.sourceWordSpacer = 'true';
  spacer.setAttribute('aria-hidden', 'true');
  spacer.style.visibility = 'hidden';
  spacer.style.display = 'inline-block';
  spacer.style.pointerEvents = 'none';
  spacer.style.whiteSpace = 'inherit';
  spacer.style.lineHeight = 'inherit';
  spacer.style.font = 'inherit';
  spacer.style.animation = 'none';
  spacer.style.transform = 'none';
  spacer.style.userSelect = 'none';
  Array.from(node.childNodes).forEach((child) => {
    spacer.appendChild(child.cloneNode(true));
  });

  const visual = document.createElement('span');
  visual.dataset.sourceWordVisual = 'true';
  visual.style.display = 'inline-block';
  visual.style.whiteSpace = 'nowrap';
  visual.style.transformOrigin = 'center center';
  visual.style.pointerEvents = 'none';
  while (node.firstChild) {
    visual.appendChild(node.firstChild);
  }
  node.appendChild(visual);
  node.appendChild(spacer);
  return [visual];
}

function prepareSourceTemplateWordNode(node) {
  if (!node) return [];
  const visualTargets = getSourceTemplateVisualTargets(node);
  setSourceTemplateStyle(node, 'display', 'inline-block');
  setSourceTemplateStyle(node, 'position', 'relative');
  setSourceTemplateStyle(node, 'overflow', 'visible');
  setSourceTemplateStyle(node, 'vertical-align', 'baseline');
  setSourceTemplateStyle(node, 'line-height', 'inherit');
  visualTargets.forEach((target) => {
    const isManagedVisual = target.dataset?.sourceWordVisual === 'true';
    // Karaoke pairs keep their authored stacking: .kf-fill paints absolutely on
    // top of .kf-base inside the relative .kf-word wrapper. Forcing them into
    // inline flow (position: relative) rendered every karaoke word TWICE, side
    // by side, on the canvas (t22/t33/t36 phases).
    const isKaraokeFill = target.classList?.contains('kf-fill');
    const isKaraokeBase = target.classList?.contains('kf-base');
    setSourceTemplateStyle(target, 'display', (isKaraokeFill || isKaraokeBase) ? 'block' : 'inline-block');
    setSourceTemplateStyle(target, 'position', (isManagedVisual || isKaraokeFill) ? 'absolute' : 'relative');
    setSourceTemplateStyle(target, 'z-index', '6');
    setSourceTemplateStyle(target, 'overflow', 'visible');
    setSourceTemplateStyle(target, 'vertical-align', 'baseline');
    setSourceTemplateStyle(target, 'transform-origin', 'center center');
    // The visible child carries per-word translate/scale styles. It must remain
    // hit-testable after moving away from the original inline word box.
    setSourceTemplateStyle(target, 'pointer-events', 'auto');
    setSourceTemplateStyle(target, 'line-height', 'inherit');
    if (isManagedVisual || isKaraokeFill) {
      setSourceTemplateStyle(target, 'left', '0');
      setSourceTemplateStyle(target, 'top', '0');
      // Reset any stale transform, but WITHOUT !important — a per-word entrance
      // animation (source-word-rise/pop/...) sets `transform` via keyframes, and
      // an !important inline transform would win over the animation per the CSS
      // cascade, silently killing every transform-based word animation. The
      // positional x/y offset uses the separate `translate` property, so it still
      // composes on top of the animation.
      target.style.setProperty('transform', 'none');
      setSourceTemplateStyle(target, 'white-space', 'nowrap');
    }
  });
  return visualTargets;
}

function setSourceTemplateStyle(node, property, value, priority = 'important') {
  if (!node || value === undefined || value === null || value === '') return;
  node.style.setProperty(property, String(value), priority);
}

function stabilizeSourceTemplateWordAnchor(node) {
  if (!node) return;
  setSourceTemplateStyle(node, 'transform', 'none');
  setSourceTemplateStyle(node, 'opacity', '1');
  setSourceTemplateStyle(node, 'animation', 'none');
  setSourceTemplateStyle(node, 'transition', 'none');
  setSourceTemplateStyle(node, 'clip-path', 'none');
}

function getSourceTemplateTextPaintTargets(target) {
  if (!target) return [];
  return [
    target,
    ...Array.from(target.querySelectorAll('*')).filter((node) => (
      !node.matches?.(SOURCE_TEMPLATE_SPACER_SELECTOR)
      && !node.closest?.(SOURCE_TEMPLATE_SPACER_SELECTOR)
    )),
  ];
}

function applySourceTemplateTextGradient(target, gradient) {
  getSourceTemplateTextPaintTargets(target).forEach((paintTarget) => {
    setSourceTemplateStyle(paintTarget, 'background-color', 'transparent');
    setSourceTemplateStyle(paintTarget, 'background', gradient);
    setSourceTemplateStyle(paintTarget, 'background-image', gradient);
    setSourceTemplateStyle(paintTarget, 'background-size', '100% 100%');
    setSourceTemplateStyle(paintTarget, 'background-repeat', 'no-repeat');
    setSourceTemplateStyle(paintTarget, 'background-position', 'center');
    setSourceTemplateStyle(paintTarget, '-webkit-background-clip', 'text');
    setSourceTemplateStyle(paintTarget, 'background-clip', 'text');
    setSourceTemplateStyle(paintTarget, '-webkit-text-fill-color', 'transparent');
    setSourceTemplateStyle(paintTarget, 'color', 'transparent');
  });
}

function clearSourceTemplateTextGradient(target) {
  getSourceTemplateTextPaintTargets(target).forEach((paintTarget) => {
    [
      'background',
      'background-color',
      'background-image',
      'background-size',
      'background-repeat',
      'background-position',
      '-webkit-background-clip',
      'background-clip',
      '-webkit-text-fill-color',
      'color',
    ].forEach((property) => paintTarget.style.removeProperty(property));
  });
}

function unlockSourceTemplateOverflowPath(node) {
  let current = node;
  while (current && current !== document.body) {
    current.style?.setProperty?.('overflow', 'visible', 'important');
    current.style?.setProperty?.('overflow-x', 'visible', 'important');
    current.style?.setProperty?.('overflow-y', 'visible', 'important');
    current.style?.setProperty?.('clip-path', 'none', 'important');
    current.style?.setProperty?.('-webkit-clip-path', 'none', 'important');
    current.style?.setProperty?.('mask-image', 'none', 'important');
    current.style?.setProperty?.('-webkit-mask-image', 'none', 'important');
    current.style?.setProperty?.('contain', 'none', 'important');
    if (current.matches?.('[data-caption-layer="true"]')) break;
    current = current.parentElement;
  }
}

function isTransparentCssColor(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized || normalized === 'transparent') return true;
  return /^rgba?\([^)]*,\s*0(?:\.0+)?\s*\)$/.test(normalized);
}

function getSourceTemplateReadableTextColor(node, fallback = '#ffffff') {
  if (!node || typeof window === 'undefined') return fallback;
  const candidates = [];
  let current = node;
  while (current && candidates.length < 8) {
    const styles = window.getComputedStyle(current);
    candidates.push(styles.getPropertyValue('-webkit-text-fill-color'));
    candidates.push(styles.color);
    current = current.parentElement;
  }
  return candidates.find((color) => !isTransparentCssColor(color)) || fallback;
}

function applySourceTemplateWordStyle(
  node,
  wordStyle = {},
  renderScale = 1,
  emphasisColor = '',
  isCptCaption = false,
) {
  if (!node) return;
  const visualTargets = prepareSourceTemplateWordNode(node);
  const hasStyle = wordStyle && Object.keys(wordStyle).length > 0;
  const hasSelectedWordAnimation = Boolean(
    wordStyle?.animation && wordStyle.animation !== 'none',
  );
  const shouldFreezeCptMotion = (
    isCptCaption
    && wordHasCreativePosition(wordStyle)
    && !hasSelectedWordAnimation
  );
  if (!hasStyle && node.dataset.sourceWordStyled !== 'true') {
    delete node.dataset.sourceWordStyled;
    delete node.dataset.sourceWordPositioned;
    delete node.dataset.sourceWordGradient;
    node.style.removeProperty('--source-word-text-gradient');
    return;
  }

  const clearTargets = [node, ...visualTargets];

  // Per-word entrance animations are one-shot. Re-applying the same `animation`
  // value on an unrelated restyle (e.g. picking a gradient or color) would
  // restart it, replaying the fly-in so the word visibly "bounces" back to its
  // start. Only touch `animation` when the requested value actually changed
  // since the last apply for this word.
  const animValue = (!shouldFreezeCptMotion && hasSelectedWordAnimation)
    ? getSourceWordAnimationStyle(wordStyle.animation, wordStyle.animationSpeed || 1)
    : '';
  const animationStillApplied = Boolean(
    animValue
    && visualTargets.some(target => target.style.animation === animValue),
  );
  const animChanged = (
    animValue !== (node.dataset.sourceWordAnim || '')
    || (Boolean(animValue) && !animationStillApplied)
  );

  if (node.dataset.sourceWordStyled === 'true') {
    clearTargets.forEach((target) => {
      SOURCE_TEMPLATE_MANAGED_STYLE_PROPS.forEach((property) => {
        if (property === 'animation' && !animChanged) return;
        target.style.removeProperty(property);
      });
      clearSourceTemplateTextGradient(target);
    });
    prepareSourceTemplateWordNode(node);
  }

  if (!hasStyle) {
    delete node.dataset.sourceWordStyled;
    delete node.dataset.sourceWordGradient;
    delete node.dataset.sourceWordAnim;
    node.style.removeProperty('--source-word-text-gradient');
    prepareSourceTemplateWordNode(node);
    return;
  }

  const inheritedTextColor = getSourceTemplateReadableTextColor(node);
  const decorationColor = !isTransparentCssColor(wordStyle.color) ? wordStyle.color : inheritedTextColor;
  const resolvedEmphasisColor = String(emphasisColor || '#DDAA03').trim() || '#DDAA03';
  node.dataset.sourceWordStyled = 'true';
  node.dataset.sourceWordAnim = animValue;
  stabilizeSourceTemplateWordAnchor(node);
  const textGradient = typeof wordStyle.textGradient === 'string' ? wordStyle.textGradient.trim() : '';
  if (textGradient) {
    node.dataset.sourceWordGradient = 'true';
    setSourceTemplateStyle(node, '--source-word-text-gradient', textGradient);
  } else {
    delete node.dataset.sourceWordGradient;
    node.style.removeProperty('--source-word-text-gradient');
  }
  node.style.pointerEvents = 'auto';
  unlockSourceTemplateOverflowPath(node);
  const offsetX = Number(wordStyle.x || 0) * renderScale;
  const offsetY = Number(wordStyle.y || 0) * renderScale;
  visualTargets.forEach((target) => {
    if (Math.abs(offsetX) > 0.01 || Math.abs(offsetY) > 0.01) {
      setSourceTemplateStyle(target, 'translate', `${offsetX}px ${offsetY}px`);
    }
    if (wordStyle.fontFamily) setSourceTemplateStyle(target, 'font-family', wordStyle.fontFamily);
    if (wordStyle.fontSize) setSourceTemplateStyle(target, 'font-size', `${wordStyle.fontSize * renderScale}px`);
    if (wordStyle.fontWeight) setSourceTemplateStyle(target, 'font-weight', wordStyle.fontWeight);
    if (wordStyle.fontStyle) setSourceTemplateStyle(target, 'font-style', wordStyle.fontStyle);
    if (wordStyle.textDecoration) {
      setSourceTemplateStyle(target, 'text-decoration', wordStyle.textDecoration);
      if (wordStyle.textDecoration !== 'none') {
        setSourceTemplateStyle(target, 'text-decoration-color', decorationColor);
        setSourceTemplateStyle(target, 'text-decoration-thickness', '0.08em');
        setSourceTemplateStyle(target, 'text-underline-offset', '0.12em');
      }
    }
    if (wordStyle.textTransform) setSourceTemplateStyle(target, 'text-transform', wordStyle.textTransform);

    if (wordStyle.isEmphasis) {
      if (!wordStyle.fontWeight) setSourceTemplateStyle(target, 'font-weight', '700');
      if (!wordStyle.fontSize) setSourceTemplateStyle(target, 'scale', '1.12');
      if (!wordStyle.color && !textGradient) {
        setSourceTemplateStyle(target, 'color', resolvedEmphasisColor);
        setSourceTemplateStyle(target, '-webkit-text-fill-color', resolvedEmphasisColor);
      }
      setSourceTemplateStyle(
        target,
        'text-shadow',
        `0 0 18px ${resolvedEmphasisColor}99, 0 0 6px ${resolvedEmphasisColor}66`,
      );
    }

    if (wordStyle.color && !textGradient) {
      setSourceTemplateStyle(target, 'color', wordStyle.color);
      setSourceTemplateStyle(target, '-webkit-text-fill-color', wordStyle.color);
    }

    if (wordStyle.backgroundColor || wordStyle.highlightGradient) {
      setSourceTemplateStyle(
        target,
        'background',
        wordStyle.highlightGradient || rgbaFromHex(wordStyle.backgroundColor, wordStyle.backgroundOpacity ?? 0.6)
      );
      setSourceTemplateStyle(target, 'border-radius', '4px');
      setSourceTemplateStyle(target, 'padding', `${(wordStyle.backgroundPadding || 2) * renderScale}px ${4 * renderScale}px`);
      setSourceTemplateStyle(target, 'box-decoration-break', 'clone');
      setSourceTemplateStyle(target, '-webkit-box-decoration-break', 'clone');
    }

    if (textGradient) {
      applySourceTemplateTextGradient(target, textGradient);
    } else if (wordStyle.color) {
      setSourceTemplateStyle(target, 'color', wordStyle.color);
      setSourceTemplateStyle(target, '-webkit-text-fill-color', wordStyle.color);
    }

    if (shouldFreezeCptMotion) {
      // A displaced-word caption appears directly in its final canvas state.
      // Positioning must not introduce a second entrance animation unless the
      // user explicitly chose one in the floating word editor.
      setSourceTemplateStyle(target, 'animation', 'none');
      setSourceTemplateStyle(target, 'animation-delay', '0s');
      setSourceTemplateStyle(target, 'animation-play-state', 'paused');
      setSourceTemplateStyle(target, 'transition', 'none');
      setSourceTemplateStyle(target, 'transform', 'none');
      setSourceTemplateStyle(target, 'clip-path', 'none');
      setSourceTemplateStyle(target, '-webkit-clip-path', 'none');
      setSourceTemplateStyle(target, 'filter', 'none');
      delete target.dataset.cptWordMotion;
    } else if (animChanged && animValue) {
      setSourceTemplateStyle(target, 'animation', animValue);
    }

    Object.entries(computeWordEffectCSS(wordStyle)).forEach(([key, value]) => {
      setSourceTemplateStyle(target, SOURCE_TEMPLATE_EFFECT_PROP_NAMES[key] || key, value);
    });

    if (textGradient) {
      applySourceTemplateTextGradient(target, textGradient);
    }
  });
}

function wireSourceTemplateWordEditing(
  host,
  {
    caption,
    renderScale = 1,
    emphasisColor = '',
    onSourceWordClick,
    onSourceWordPointerDown,
    currentTime = 0,
    isPlaying = false,
  } = {},
) {
  if (!host || !caption) return undefined;
  let pointerDownInfo = null;
  const decorate = () => {
    host.style.setProperty('pointer-events', 'auto', 'important');
    host.querySelectorAll('.sb, .sblock, .lekha-applied-advanced-template').forEach((block) => {
      block.style.setProperty('pointer-events', 'auto', 'important');
      wrapSourceTemplatePlainTextNodes(block);
    });
    getEditableSourceTemplateWords(host).forEach(({ node, index }) => {
      const styleKey = `${caption.id}-${index}`;
      const hasCptWords = captionHasCreativelyPositionedWords(caption);
      const wordCount = Math.max(
        1,
        String(caption.text || '').trim().split(/\s+/).filter(Boolean).length,
      );
      const currentIdx = getCaptionRevealWordIndex(
        caption,
        currentTime,
        wordCount,
        getCaptionTemplateId(caption),
      );
      node.dataset.wordKey = styleKey;
      node.dataset.sourceWordIndex = String(index);
      node.style.setProperty('pointer-events', 'auto', 'important');
      node.style.cursor = 'pointer';
      prepareSourceTemplateWordNode(node);
      applySourceTemplateWordStyle(
        node,
        caption.wordStyles?.[styleKey] || {},
        renderScale,
        emphasisColor,
        hasCptWords,
      );
      if (hasCptWords && isPlaying && index > currentIdx) {
        node.style.setProperty('opacity', '0', 'important');
      } else if (hasCptWords) {
        node.style.setProperty('opacity', '1', 'important');
      } else {
        node.style.removeProperty('opacity');
      }
    });
  };

  decorate();
  const frame = window.requestAnimationFrame(decorate);

  const handlePointerDown = (event) => {
    const wordNode = findSourceTemplateWordNode(event, host);
    if (!wordNode) return;
    pointerDownInfo = {
      node: wordNode,
      x: event.clientX,
      y: event.clientY,
      dragStarted: false,
    };
    event.stopPropagation();
  };

  const handlePointerMove = (event) => {
    if (!pointerDownInfo || pointerDownInfo.dragStarted) return;
    const moved = Math.hypot(
      (event.clientX || 0) - pointerDownInfo.x,
      (event.clientY || 0) - pointerDownInfo.y,
    );
    if (moved <= 6) return;

    const wordNode = pointerDownInfo.node;
    const wordIndex = Number(wordNode?.dataset.sourceWordIndex);
    if (!wordNode || !Number.isFinite(wordIndex)) return;

    pointerDownInfo.dragStarted = true;
    event.preventDefault();
    event.stopPropagation();
    onSourceWordPointerDown?.({
      event,
      node: wordNode,
      caption,
      wordIndex,
      word: getSourceWordText(caption, wordIndex, wordNode),
      startClientX: pointerDownInfo.x,
      startClientY: pointerDownInfo.y,
    });
  };

  const handlePointerUp = (event) => {
    const wordNode = findSourceTemplateWordNode(event, host);
    if (!wordNode) return;
    const wordIndex = Number(wordNode.dataset.sourceWordIndex);
    if (!Number.isFinite(wordIndex)) return;
    const dragStarted = pointerDownInfo?.dragStarted === true;
    const moved = pointerDownInfo
      ? Math.hypot((event.clientX || 0) - pointerDownInfo.x, (event.clientY || 0) - pointerDownInfo.y)
      : 0;
    pointerDownInfo = null;
    if (dragStarted || moved > 6) return;
    event.preventDefault();
    event.stopPropagation();
    onSourceWordClick?.({
      event,
      node: wordNode,
      caption,
      wordIndex,
      word: getSourceWordText(caption, wordIndex, wordNode),
    });
  };

  const handleClick = (event) => {
    const wordNode = findSourceTemplateWordNode(event, host);
    if (!wordNode) return;
    event.preventDefault();
    event.stopPropagation();
  };

  host.addEventListener('pointerdown', handlePointerDown, true);
  host.addEventListener('pointermove', handlePointerMove, true);
  host.addEventListener('pointerup', handlePointerUp, true);
  host.addEventListener('click', handleClick, true);
  return () => {
    window.cancelAnimationFrame(frame);
    host.removeEventListener('pointerdown', handlePointerDown, true);
    host.removeEventListener('pointermove', handlePointerMove, true);
    host.removeEventListener('pointerup', handlePointerUp, true);
    host.removeEventListener('click', handleClick, true);
  };
}

const MemoizedVideo = React.memo(function MemoizedVideo({
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

export default function VideoPlayer({
  videoUrl,
  currentTime,
  setCurrentTime,
  seekSignal,
  isPlaying,
  setIsPlaying,
  captions,
  waveformData,
  captionStyle,
  duration,
  setDuration,
  setCaptionStyle,
  setCaptionStyleRaw,
  setCaptions,
  setCaptionsRaw,
  addToHistory,
  selectedCaptionId,
  setSelectedCaptionId,
  wordPopup,
  setWordPopup,
  onVideoLoaded,
  onVideoError,
  isVideoFullscreen,
  setIsVideoFullscreen
}) {
  const videoRef = useRef(null);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragStartPos, setDragStartPos] = useState(0);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartXPos, setDragStartXPos] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');

  // Custom Element State
  const [draggedElementId, setDraggedElementId] = useState(null);
  const [resizedElementId, setResizedElementId] = useState(null);
  const [elementDragStart, setElementDragStart] = useState({ x: 0, y: 0, initialTop: 0, initialLeft: 0 });
  const [elementResizeStart, setElementResizeStart] = useState({ x: 0, y: 0, initialWidth: 0, initialFontSize: 0, minWidth: 150, direction: 'right' });

  const [isResizing, setIsResizing] = useState(false);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartY, setResizeStartY] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);
  const [resizeStartFontSize, setResizeStartFontSize] = useState(18);
  const [resizeDirection, setResizeDirection] = useState('right');
  const emotionalCaptionPlan = React.useMemo(() => {
    const markup = captionStyle?.template_markup || captionStyle?.template_snapshot?.template_markup || '';
    return new Map(
      buildEmotionalCaptionPlan(captions, waveformData, duration, markup)
        .map((entry) => [entry.captionId, entry]),
    );
  }, [captions, waveformData, duration, captionStyle?.template_markup, captionStyle?.template_snapshot?.template_markup]);
  // Word dragging state (for both captions and text elements)
  const [draggingWord, setDraggingWord] = useState(null); // { captionId, wordIndex, startX, startY, initialX, initialY, isElement }
  const [resizingWord, setResizingWord] = useState(null);

  const captionRef = useRef(null);
  const videoContainerRef = useRef(null);
  const currentDragCoordinates = useRef(null);
  const lastDragDropTime = useRef(0);
  const wordResizeActiveRef = useRef(false);
  const inputRef = useRef(null);
  // Blocks handleTimeUpdate from propagating to Dashboard while user is dragging
  const isScrubbingRef = useRef(false);

  // ── Alignment snap guides ───────────────────────────────────────────────
  // { hLines: [pct], vLines: [pct] } — percent values to draw guide lines
  const [snapGuides, setSnapGuides] = useState({ hLines: [], vLines: [] });
  const [cptWordGuides, setCptWordGuides] = useState([]);
  const selectionHandleClass = 'absolute z-50 h-3 w-3 rounded-full border border-[#b76cff] bg-white shadow-[0_0_0_1px_rgba(255,255,255,0.7)]';

  // ── Canvas zoom (Ctrl+Scroll) ───────────────────────────────────────────
  const [canvasScale, setCanvasScale] = useState(1);
  const [activeCanvasTool, setActiveCanvasTool] = useState(null);
  const [showCornerGuides, setShowCornerGuides] = useState(true);
  const [showLayoutGuides, setShowLayoutGuides] = useState(false);
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const [isCanvasPanning, setIsCanvasPanning] = useState(false);
  const canvasPanStartRef = useRef({ x: 0, y: 0, originX: 0, originY: 0 });
  const fitCanvasSizeRef = useRef({ width: 0, height: 0 });
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  const clearActiveSelection = useCallback(() => {
    if (setSelectedCaptionId) setSelectedCaptionId(null);
    if (setWordPopup) setWordPopup(null);
  }, [setSelectedCaptionId, setWordPopup]);

  const getWordRenderOffset = useCallback((wordStyle = {}) => {
    const width = canvasSize.width || videoContainerRef.current?.offsetWidth || 0;
    const height = canvasSize.height || videoContainerRef.current?.offsetHeight || 0;
    const baselineWidth = fitCanvasSizeRef.current.width || width;
    const baselineHeight = fitCanvasSizeRef.current.height || height;

    const offsetX = typeof wordStyle.x_pct === 'number' && width
      ? (wordStyle.x_pct / 100) * width
      : (typeof wordStyle.x === 'number' && baselineWidth && width)
        ? (wordStyle.x * width) / baselineWidth
      : (wordStyle.x || 0);

    const offsetY = typeof wordStyle.y_pct === 'number' && height
      ? (wordStyle.y_pct / 100) * height
      : (typeof wordStyle.y === 'number' && baselineHeight && height)
        ? (wordStyle.y * height) / baselineHeight
      : (wordStyle.y || 0);

    return {
      x: offsetX,
      y: offsetY,
      isPositioned: Math.abs(offsetX) > 0.01 || Math.abs(offsetY) > 0.01,
    };
  }, [canvasSize.height, canvasSize.width]);

  const isWordDetached = useCallback((wordStyle = {}) => (
    typeof wordStyle.abs_x_pct === 'number'
    && typeof wordStyle.abs_y_pct === 'number'
    && (Math.abs(wordStyle.abs_x_pct) > 0.01 || Math.abs(wordStyle.abs_y_pct) > 0.01)
  ), []);

  React.useLayoutEffect(() => {
    const syncFitCanvasSize = () => {
      const el = videoContainerRef.current;
      if (!el) return;
      const nextSize = {
        width: el.offsetWidth || 0,
        height: el.offsetHeight || 0,
      };
      if (!nextSize.width || !nextSize.height) return;

      setCanvasSize(prev => (
        prev.width === nextSize.width && prev.height === nextSize.height
          ? prev
          : nextSize
      ));

      if (!isVideoFullscreen) {
        fitCanvasSizeRef.current = nextSize;
      }
    };

    syncFitCanvasSize();
    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(syncFitCanvasSize)
      : null;
    if (observer && videoContainerRef.current) {
      observer.observe(videoContainerRef.current);
    }
    window.addEventListener('resize', syncFitCanvasSize);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', syncFitCanvasSize);
    };
  }, [isVideoFullscreen, videoUrl]);

  const getPreviewRenderScale = useCallback(() => {
    if (!isVideoFullscreen) return 1;
    const currentWidth = canvasSize.width || videoContainerRef.current?.offsetWidth || 0;
    const baselineWidth = fitCanvasSizeRef.current.width || currentWidth;
    if (!currentWidth || !baselineWidth) return 1;
    return currentWidth / baselineWidth;
  }, [canvasSize.width, isVideoFullscreen]);

  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        const playResult = videoRef.current.play();
        if (playResult?.catch) playResult.catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying]);

  const toggleVideoFullscreen = useCallback(() => {
    if (!setIsVideoFullscreen) return;
    setIsVideoFullscreen(v => !v);
  }, [setIsVideoFullscreen]);

  // ── F / Shift+F → toggle fullscreen ────────────────────────────────────
  useEffect(() => {
    if (!toggleVideoFullscreen) return;
    const onKey = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (document.activeElement?.isContentEditable)) return;
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleVideoFullscreen();
        return;
      }
      if (e.key === 'Escape' && isVideoFullscreen && setIsVideoFullscreen) {
        e.preventDefault();
        setIsVideoFullscreen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isVideoFullscreen, setIsVideoFullscreen, toggleVideoFullscreen]);

  // ── Ctrl+Scroll → zoom canvas ───────────────────────────────────────────
  useEffect(() => {
    const el = videoContainerRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setCanvasScale(prev => {
        const delta = e.deltaY > 0 ? -0.05 : 0.05;
        return Math.min(2, Math.max(0.5, +(prev + delta).toFixed(2)));
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    if (!isCanvasPanning) return;

    const handleMouseMove = (e) => {
      const { x, y, originX, originY } = canvasPanStartRef.current;
      setCanvasOffset({
        x: originX + (e.clientX - x),
        y: originY + (e.clientY - y),
      });
    };

    const handleMouseUp = () => {
      setIsCanvasPanning(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isCanvasPanning]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
      videoRef.current.muted = isMuted;
    }
  }, [volume, isMuted]);

  // Local scrub time: used during Slider drag so we don't call setCurrentTime(Dashboard)
  // on every tick (which triggers heavy re-renders). Only committed on release.
  const [localScrubTime, setLocalScrubTime] = useState(null);

  // Handle external seek signals (from CaptionEditor clicking a caption, etc.)
  // seekSignal is set by Dashboard.handleSeek → ensures video element moves too
  useEffect(() => {
    if (videoRef.current && seekSignal !== null && seekSignal !== undefined) {
      videoRef.current.currentTime = seekSignal;
    }
  }, [seekSignal]);

  // Listen for 'ready' message from template iframes and reply with the initial sync state
  useEffect(() => {
    const handleIframeReady = (event) => {
      if (event.data?.type === 'ready') {
        const videoContainer = videoContainerRef.current || videoRef.current?.parentElement;
        if (!videoContainer) return;
        const iframes = videoContainer.querySelectorAll('iframe');
        iframes.forEach((iframe) => {
          if (iframe.contentWindow === event.source) {
            const activeCaption = getActiveCaptions().find(c => !c.isTextElement);
            iframe.contentWindow.postMessage({
              type: 'sync',
              currentTime,
              isPlaying,
              startTime: activeCaption ? activeCaption.start_time : currentTime,
              endTime: activeCaption ? activeCaption.end_time : currentTime,
              captionText: activeCaption ? (activeCaption.text || '') : ''
            }, '*');
          }
        });
      }
    };
    window.addEventListener('message', handleIframeReady);
    return () => {
      window.removeEventListener('message', handleIframeReady);
    };
  }, [currentTime, isPlaying, captions]);

  // ── rAF loop: send 60fps sync to template iframes while playing ─────────
  // When paused, React state changes still fire the static effect above.
  // When playing we need sub-4fps resolution for word-by-word animations,
  // so we bypass React state and read videoRef.current.currentTime directly.
  const iframeSyncRafRef = useRef(null);
  const captionsRef = useRef(captions);
  captionsRef.current = captions;
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const [cptRevealIndexes, setCptRevealIndexes] = useState({});
  const cptRevealRafRef = useRef(null);
  const cptRevealTimeRef = useRef(Number(currentTime) || 0);

  // CPT authoring is a fully visible editing state. Once playback starts, use
  // the video clock to advance cumulative visibility by at most one word per
  // painted frame, without running any entrance animation.
  useEffect(() => {
    if (!isPlaying) {
      if (cptRevealRafRef.current) {
        cancelAnimationFrame(cptRevealRafRef.current);
        cptRevealRafRef.current = null;
      }
      cptRevealTimeRef.current = Number(currentTime) || 0;
      setCptRevealIndexes({});
      return undefined;
    }

    const tickCptReveal = () => {
      const playbackTime = Number(videoRef.current?.currentTime);
      const effectiveTime = Number.isFinite(playbackTime)
        ? playbackTime
        : (Number(currentTime) || 0);
      const movedBackward = effectiveTime + 0.02 < cptRevealTimeRef.current;
      cptRevealTimeRef.current = effectiveTime;

      setCptRevealIndexes((previousIndexes) => {
        let changed = false;
        const nextIndexes = {};

        (captionsRef.current || []).forEach((caption) => {
          if (!caption || caption.isTextElement || !captionHasCreativelyPositionedWords(caption)) return;
          const wordCount = Math.max(
            1,
            String(caption.text || '').trim().split(/\s+/).filter(Boolean).length,
          );
          const targetIndex = getCaptionWordRevealIndex(caption, effectiveTime, wordCount);
          const previousIndex = previousIndexes[caption.id];
          const nextIndex = movedBackward
            ? targetIndex
            : advanceCaptionWordRevealIndex(previousIndex, targetIndex);
          nextIndexes[caption.id] = nextIndex;
          if (nextIndex !== previousIndex) changed = true;
        });

        if (Object.keys(previousIndexes).length !== Object.keys(nextIndexes).length) changed = true;
        return changed ? nextIndexes : previousIndexes;
      });

      cptRevealRafRef.current = requestAnimationFrame(tickCptReveal);
    };

    cptRevealRafRef.current = requestAnimationFrame(tickCptReveal);
    return () => {
      if (cptRevealRafRef.current) {
        cancelAnimationFrame(cptRevealRafRef.current);
        cptRevealRafRef.current = null;
      }
    };
  }, [currentTime, isPlaying]);

  useEffect(() => {
    function buildSyncMsg(t) {
      const caps = captionsRef.current || [];
      const activeCaption = caps.find(
        c => c && !c.isTextElement &&
          typeof c.start_time === 'number' &&
          typeof c.end_time === 'number' &&
          t >= c.start_time && t < c.end_time
      );
      return {
        type: 'sync',
        currentTime: t,
        isPlaying: isPlayingRef.current,
        startTime: activeCaption ? activeCaption.start_time : t,
        endTime: activeCaption ? activeCaption.end_time : t,
        captionText: activeCaption ? (activeCaption.text || '') : '',
      };
    }

    function tick() {
      if (!isPlayingRef.current) {
        iframeSyncRafRef.current = null;
        return;
      }
      const videoEl = videoRef.current;
      const videoContainer = videoContainerRef.current || videoEl?.parentElement;
      if (videoEl && videoContainer) {
        const t = videoEl.currentTime;
        const iframes = videoContainer.querySelectorAll('iframe');
        if (iframes.length > 0) {
          const msg = buildSyncMsg(t);
          iframes.forEach(iframe => iframe.contentWindow?.postMessage(msg, '*'));
        }
      }
      iframeSyncRafRef.current = requestAnimationFrame(tick);
    }

    if (isPlaying) {
      // cancel any existing loop then start fresh
      if (iframeSyncRafRef.current) cancelAnimationFrame(iframeSyncRafRef.current);
      iframeSyncRafRef.current = requestAnimationFrame(tick);
    } else {
      if (iframeSyncRafRef.current) {
        cancelAnimationFrame(iframeSyncRafRef.current);
        iframeSyncRafRef.current = null;
      }
    }

    return () => {
      if (iframeSyncRafRef.current) {
        cancelAnimationFrame(iframeSyncRafRef.current);
        iframeSyncRafRef.current = null;
      }
    };
  }, [isPlaying]);

  // When paused, send sync updates to template iframes if time, play state, or captions change.
  // This ensures the template updates its visual state immediately during seeking or edits.
  useEffect(() => {
    if (!isPlaying) {
      const videoEl = videoRef.current;
      const videoContainer = videoContainerRef.current || videoEl?.parentElement;
      if (videoContainer) {
        const iframes = videoContainer.querySelectorAll('iframe');
        if (iframes.length > 0) {
          const caps = captions || [];
          const activeCaption = caps.find(
            c => c && !c.isTextElement &&
              typeof c.start_time === 'number' &&
              typeof c.end_time === 'number' &&
              currentTime >= c.start_time && currentTime < c.end_time
          );
          const msg = {
            type: 'sync',
            currentTime,
            isPlaying: false,
            startTime: activeCaption ? activeCaption.start_time : currentTime,
            endTime: activeCaption ? activeCaption.end_time : currentTime,
            captionText: activeCaption ? (activeCaption.text || '') : '',
          };
          iframes.forEach(iframe => iframe.contentWindow?.postMessage(msg, '*'));
        }
      }
    }
  }, [currentTime, isPlaying, captions]);

  // Load the font that is ACTUALLY rendered. The caption font is resolved
  // per-caption at render time via resolveScriptFont(font, caption.text) — so a
  // template's Latin family becomes a Devanagari face on Hindi text. handleApplyTemplate
  // only loads the aggregate-resolved family, which can differ from a given caption's
  // resolved family (mixed-script projects) or fail silently. When the rendered face
  // was never loaded the browser swaps in a fallback and the template looks "not
  // applied / plain" even though the panel shows the right font. Loading exactly what
  // we render — base family plus every per-caption resolved family — closes that gap.
  useEffect(() => {
    const baseFamily = captionStyle?.font_family;
    const families = new Set(baseFamily ? [baseFamily] : []);
    (captions || []).forEach((cap) => {
      if (cap && !cap.isTextElement) {
        const captionFamily = captionStyle?.font_family || cap?.applied_template_style?.font_family;
        if (captionFamily) {
          families.add(captionFamily);
          families.add(resolveScriptFont(captionFamily, cap.text));
        }
      }
    });
    families.forEach((family) => {
      if (family) loadGoogleFont(family, [300, 400, 500, 600, 700, 800, 900]).catch(() => {});
    });
  }, [captionStyle?.font_family, captionStyle?.template_20_id, captions]);


  // Stable refs for callbacks passed to MemoizedVideo — these MUST not change reference
  // between renders, otherwise React.memo comparison would need to track them.
  const onVideoLoadedRef = useRef(onVideoLoaded);
  onVideoLoadedRef.current = onVideoLoaded;

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current && !isScrubbingRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  }, [setCurrentTime]);

  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      if (onVideoLoadedRef.current) {
        onVideoLoadedRef.current(videoRef.current);
      }
    }
  }, [setDuration]);

  const handleVideoSurfaceToggle = useCallback(() => {
    if (!videoRef.current) return;

    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, [setIsPlaying]);

  const handleVideoSurfaceClick = useCallback((e) => {
    if (draggingWord || Date.now() - lastDragDropTime.current < 250) {
      return;
    }

    const target = e.target;
    if (!(target instanceof Element)) return;

    if (target.closest('button, input, textarea, select, [role="button"], [contenteditable="true"], [data-word-key], .resize-handle, .text-resize-handle, [data-video-control]')) {
      return;
    }

    clearActiveSelection();
    handleVideoSurfaceToggle();
  }, [clearActiveSelection, draggingWord, handleVideoSurfaceToggle]);

  const handleCanvasToolClick = useCallback((tool, e) => {
    e.stopPropagation();

    if (tool === 'zoom-in') {
      setCanvasScale(prev => Math.min(2, +(prev + 0.1).toFixed(2)));
      setActiveCanvasTool(null);
      return;
    }

    if (tool === 'zoom-out') {
      setCanvasScale(prev => Math.max(0.5, +(prev - 0.1).toFixed(2)));
      setActiveCanvasTool(null);
      return;
    }

    if (tool === 'reset') {
      setCanvasScale(1);
      setCanvasOffset({ x: 0, y: 0 });
      setShowCornerGuides(true);
      setShowLayoutGuides(false);
      setActiveCanvasTool(null);
      return;
    }

    if (tool === 'guides') {
      const nextVisible = !(showCornerGuides || showLayoutGuides);
      setShowCornerGuides(nextVisible);
      setShowLayoutGuides(nextVisible);
      setActiveCanvasTool(nextVisible ? 'guides' : null);
      return;
    }

    setActiveCanvasTool(tool);
  }, [showCornerGuides, showLayoutGuides]);

  const handleCanvasMouseDown = useCallback((e) => {
    if (activeCanvasTool !== 'move') return;
    if (e.button !== 0) return;
    if (e.target.closest('button, input, textarea, select, [role="button"]')) return;

    e.preventDefault();
    e.stopPropagation();
    canvasPanStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      originX: canvasOffset.x,
      originY: canvasOffset.y,
    };
    setIsCanvasPanning(true);
  }, [activeCanvasTool, canvasOffset.x, canvasOffset.y]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getActiveCaptions = () => {
    if (!captions || captions.length === 0) return [];
    return captions.filter(cap =>
      cap &&
      !cap.isTextElement &&
      typeof cap.start_time === 'number' &&
      typeof cap.end_time === 'number' &&
      currentTime >= cap.start_time &&
      currentTime < cap.end_time
    );
  };

  const getActiveTextElements = () => {
    if (!captions || captions.length === 0) return [];
    return captions.filter(cap =>
      cap &&
      cap.isTextElement &&
      typeof cap.start_time === 'number' &&
      typeof cap.end_time === 'number' &&
      currentTime >= cap.start_time &&
      currentTime < cap.end_time
    );
  };

  const getAnimationStyle = (animationType, speed = 1) => {
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

  const previewRenderScale = getPreviewRenderScale();
  const displayBackgroundPadding = Math.max(1, Math.round((captionStyle?.background_padding || 6) * 0.58));
  const displayBackgroundWidthMultiplier = Math.max(0.94, captionStyle?.background_h_multiplier || 1);
  const displayCaptionPadY = Math.max(1, Math.round((captionStyle?.background_padding || 6) * 0.55));
  const displayCaptionPadX = 6;

  const getTextElementDisplayMetrics = (style = {}) => ({
    backgroundPadding: Math.max(1, Math.round(((style.padding ?? 6) || 6) * 0.58)),
    backgroundWidthMultiplier: Math.max(0.94, style.backgroundHMultiplier || 1.05),
    textPadY: Math.max(1, Math.round(((style.padding ?? 6) || 6) * 0.55)),
    textPadX: 6,
  });

  const getTextElementEffectCSS = (style = {}) => {
    const effectStyles = computeEffectCSS(style);
    return {
      textShadow: effectStyles.textShadow || (style.hasShadow && !style.textGradient ? `${style.shadowOffsetX || 0}px ${style.shadowOffsetY || 2}px ${style.shadowBlur || 4}px ${style.shadowColor || 'rgba(0,0,0,0.8)'}` : undefined),
      WebkitTextStroke: effectStyles.WebkitTextStroke || (style.hasStroke === true && !style.textGradient ? `${style.strokeWidth || 0.5}px ${style.strokeColor || '#000000'}` : '0px transparent'),
    };
  };

  // Word-level animations — keyframes include translate(-50%,-50%) centering so they
  // don't override the inner span's centering transform.
  const getWordAnimationStyle = (animationType, speed = 1) => {
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

  const getCptWordMotionStyle = (caption, wordStyle = {}) => {
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

  const renderWordTextContent = (word, wordStyle = {}, fallbackColor = 'inherit') => {
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

  const renderAnimatedDetachedWordContent = (
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

  const openSourceTemplateWordPopup = useCallback(({ event, node, caption, wordIndex, word }) => {
    if (!caption || !node || !setWordPopup) return;
    if (setSelectedCaptionId) setSelectedCaptionId(caption.id);
    setWordPopup({
      word,
      position: { x: event.clientX, y: event.clientY },
      caption,
      wordIndex,
    });
  }, [setSelectedCaptionId, setWordPopup]);

  const handleCaptionWordPointerIntent = (
    event,
    caption,
    wordIndex,
    word,
    { isDetached = false, dragSource = 'direct' } = {},
  ) => {
    if (!caption || !event.currentTarget) return;
    event.preventDefault();
    event.stopPropagation();

    const target = event.currentTarget;
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    let dragStarted = false;

    // Keep a detached word's pointer stream attached to the same word even
    // though its selected editor is rendered in a portal above the canvas.
    // Without capture, a later click can be swallowed by the portal/canvas and
    // the word editor never reopens after a drag.
    target.setPointerCapture?.(pointerId);

    const cleanup = () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
      document.removeEventListener('pointercancel', handlePointerCancel);
      if (target.hasPointerCapture?.(pointerId)) {
        target.releasePointerCapture?.(pointerId);
      }
    };

    const handlePointerMove = (moveEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      const moved = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY);
      if (moved <= 6) return;

      dragStarted = true;
      cleanup();
      handleWordMouseDown({
        preventDefault: () => moveEvent.preventDefault(),
        stopPropagation: () => moveEvent.stopPropagation(),
        clientX: startX,
        clientY: startY,
        pointerId,
        currentTarget: target,
      }, caption, wordIndex, false, isDetached, dragSource);
    };

    const handlePointerUp = (upEvent) => {
      if (upEvent.pointerId !== pointerId) return;
      cleanup();
      if (dragStarted || !setWordPopup) return;

      upEvent.preventDefault();
      upEvent.stopPropagation();
      const liveCaption = captions?.find(item => item.id === caption.id) || caption;
      if (setSelectedCaptionId) setSelectedCaptionId(liveCaption.id);
      setWordPopup({
        word,
        position: { x: upEvent.clientX, y: upEvent.clientY },
        caption: liveCaption,
        wordIndex,
      });
    };

    const handlePointerCancel = (cancelEvent) => {
      if (cancelEvent.pointerId !== pointerId) return;
      cleanup();
    };

    document.addEventListener('pointermove', handlePointerMove, { passive: false });
    document.addEventListener('pointerup', handlePointerUp);
    document.addEventListener('pointercancel', handlePointerCancel);
  };

  const startSourceTemplateWordDrag = useCallback(({
    event,
    node,
    caption,
    wordIndex,
    startClientX,
    startClientY,
  }) => {
    if (setSelectedCaptionId) setSelectedCaptionId(caption.id);
    handleWordMouseDown({
      preventDefault: () => event.preventDefault(),
      stopPropagation: () => event.stopPropagation(),
      clientX: startClientX ?? event.clientX,
      clientY: startClientY ?? event.clientY,
      pointerId: event.pointerId,
      currentTarget: node,
    }, caption, wordIndex, false, false, 'source-template');
  }, [captionStyle, setCaptions, setCaptionsRaw, setSelectedCaptionId]);

  const activeCaptions = getActiveCaptions();
  const activeTextElements = getActiveTextElements();

  const captionHasDetachedWords = (caption) => (
    Object.values(caption.wordStyles || {}).some(isWordDetached)
  );

  const isCaptionWordEditingActive = (caption) => (
    (draggingWord && draggingWord.captionId === caption.id)
    || (wordPopup?.caption?.id === caption.id)
  );

  const isCaptionCptAdjustmentActive = (caption) => (
    (draggingWord && draggingWord.captionId === caption.id)
    || (resizingWord && resizingWord.captionId === caption.id)
    || (wordPopup?.caption?.id === caption.id)
  );

  // Word-by-word reveal is an explicit display-mode choice (StyleControls sets
  // show_inactive=false for it) — never a side effect of dragging a word.
  // Deriving it from captionHasDetachedWords() meant one drag silently switched
  // the whole caption to word-by-word, so the dragged word vanished until its
  // spoken moment and could no longer be clicked to reopen the word editor.
  const shouldRevealSequentially = (caption) => (
    !isCaptionWordEditingActive(caption)
    && isPlaying
    && captionStyle?.show_inactive === false
  );

  // A displaced word authors a CPT. Editing stays fully visible; playback and
  // export build the sentence cumulatively, one word at a time, with no motion.
  const captionHasCptWords = captionHasCreativelyPositionedWords;

  const isCptWordPending = (caption, wordIndex, currentIdx) => (
    isPlaying
    && !shouldRevealSequentially(caption)
    && !isCaptionCptAdjustmentActive(caption)
    && captionHasCptWords(caption)
    && wordIndex > currentIdx
  );
  const getCaptionCurrentWordIndex = (caption, wordCount) => {
    const activeTemplateId = caption?.template_id || caption?.applied_template_style?.template_id || captionStyle?.template_id;
    if (
      isPlaying
      && captionHasCptWords(caption)
      && Object.prototype.hasOwnProperty.call(cptRevealIndexes, caption.id)
    ) {
      return Math.max(0, Math.min(Math.max(1, wordCount) - 1, cptRevealIndexes[caption.id]));
    }
    return getCaptionRevealWordIndex(caption, currentTime, wordCount, activeTemplateId);
  };

  const getCaptionCptRenderTime = (caption) => {
    if (
      !isPlaying
      || !captionHasCptWords(caption)
      || !Object.prototype.hasOwnProperty.call(cptRevealIndexes, caption.id)
    ) {
      return currentTime;
    }
    const wordCount = Math.max(
      1,
      String(caption.text || '').trim().split(/\s+/).filter(Boolean).length,
    );
    const revealTimes = getCaptionWordRevealTimes(caption, wordCount);
    const revealIndex = Math.max(0, Math.min(wordCount - 1, cptRevealIndexes[caption.id]));
    return (revealTimes[revealIndex] ?? currentTime) + 0.00001;
  };

  const renderEditableAdvancedTemplateCaption = (caption, blockIndex = 0) => {
    const words = caption.text.split(' ').filter(Boolean);
    const wordCount = words.length;
    const currentIdx = getCaptionCurrentWordIndex(caption, wordCount);
    const templateId = getCaptionTemplateId(caption, captionStyle);
    const normalizedBlockIndex = normalizeTemplatePhaseIndex(templateId, blockIndex);
    const blockType = getOriginalTemplateBlockType(templateId, normalizedBlockIndex);
    const blockClass = `${templateId}-b${normalizedBlockIndex}`;
    const isWbwBlock = blockType.startsWith('wbw-');
    const variantClass = isWbwBlock ? blockType : '';
    const templateMarkup = caption?.applied_template_style?.template_markup
      || caption?.template_markup
      || captionStyle?.template_markup
      || '';
    const templateImpClass = getAppliedAdvancedTemplateImpClass(templateId, normalizedBlockIndex, templateMarkup);
    const templateImpWordIndex = Number(emotionalCaptionPlan.get(caption?.id)?.impWordIndex ?? caption?.imp_word_index ?? -1);
    const templateImpWordIndices = resolveImpWordIndicesForWords(
      words,
      templateImpWordIndex,
      emotionalCaptionPlan.get(caption?.id)?.impWordIndices || caption?.imp_word_indices || [],
    );
    const isT17LetterSnapBlock = templateId === 't17' && normalizedBlockIndex === 1;
    const templateFitClassName = isT17LetterSnapBlock
      ? 'snap-txt'
      : isWbwBlock
        ? `${variantClass} lekha-template-fit`
        : 'lekha-template-fit';
    const templateFitStyle = isT17LetterSnapBlock ? {
      opacity: 1,
      filter: 'none',
      transform: 'none',
      letterSpacing: '0.04em',
      display: 'inline-block',
      color: '#ff3d71',
      WebkitTextFillColor: '#ff3d71',
      textShadow: '0 1px 8px rgba(0,0,0,0.82), 0 0 2px rgba(0,0,0,0.92), 0 0 16px rgba(255,61,113,0.22)',
      animation: 'none',
      transition: 'none',
    } : undefined;

    const renderEditableTemplateWord = (word, wordIndex, localIndex, localLength, options = {}) => {
      if (shouldRevealSequentially(caption) && wordIndex > currentIdx) return null;

      const styleKey = `${caption.id}-${wordIndex}`;
      const ws = caption.wordStyles?.[styleKey] || {};
      const detached = isWordDetached(ws);
      const isSelected = wordPopup?.caption?.id === caption.id && wordPopup?.wordIndex === wordIndex;
      const wordAnimation = ws.animation && ws.animation !== 'none'
        ? getWordAnimationStyle(ws.animation, ws.animationSpeed || 1)
        : 'none';
      const cptMotionStyle = getCptWordMotionStyle(
        caption,
        ws,
        wordIndex,
        wordCount,
        currentIdx,
        { templateBlockType: blockType },
      );
      const resolvedWordMotionStyle = cptMotionStyle || { animation: wordAnimation };
      const wordUsesWbwClass = options.forceWbwClass ?? isWbwBlock;
      const isTemplateEmphasis = templateImpWordIndices.includes(wordIndex) && !!templateImpClass;
      const emphasisClassName = isTemplateEmphasis
        ? templateImpClass
        : ws.isEmphasis
          ? 'imp-bold'
          : '';
      const wordClassName = [
        wordUsesWbwClass ? 'w in' : 'template-editable-word',
        options.extraClassName || '',
        emphasisClassName,
        isTemplateEmphasis ? 'is-emphasis' : '',
        isSelected ? 'ring-2 ring-[#F5A623] rounded-sm' : '',
      ].filter(Boolean).join(' ');

      return (
        <React.Fragment key={`${styleKey}-editable`}>
          {localIndex > 0 && ' '}
          <span
            data-i={wordUsesWbwClass ? wordIndex : undefined}
            data-imp={isTemplateEmphasis ? 'true' : undefined}
            data-imp-cls={isTemplateEmphasis ? templateImpClass : undefined}
            data-word-key={detached ? undefined : styleKey}
            data-template-block-class={blockClass}
            data-template-block-type={blockType}
            data-template-word-class={wordClassName}
            className={wordClassName}
            style={{
              display: 'inline-block',
              opacity: isCptWordPending(caption, wordIndex, currentIdx) ? 0 : undefined,
              visibility: detached ? 'hidden' : 'visible',
              cursor: detached
                ? 'default'
                : (draggingWord?.captionId === caption.id && draggingWord?.wordIndex === wordIndex ? 'grabbing' : 'grab'),
              animation: 'none',
            }}
            onPointerDown={detached ? undefined : (e) => handleCaptionWordPointerIntent(
              e,
              caption,
              wordIndex,
              word,
              { dragSource: 'template' },
            )}
            onClick={(e) => {
              if (detached || Date.now() - lastDragDropTime.current < 150) return;
              if (setWordPopup) {
                e.stopPropagation();
                setWordPopup({
                  word,
                  position: { x: e.clientX, y: e.clientY },
                  caption,
                  wordIndex,
                });
              }
            }}
          >
            <span
              data-word-drag-visual="true"
              style={{
                display: 'inline-block',
                transformOrigin: 'center center',
                ...resolvedWordMotionStyle,
              }}
            >
              {renderWordTextContent(word, ws, 'inherit')}
            </span>
            {localIndex < localLength - 1 ? '\u00A0' : ''}
          </span>
        </React.Fragment>
      );
    };

    const renderEditableLineWords = (line, options = {}) => (
      line.map(({ word, wordIndex }, localIndex) => (
        renderEditableTemplateWord(word, wordIndex, localIndex, line.length, options)
      ))
    );

    const renderEditableTemplateBody = () => {
      if (templateId === 't18' && normalizedBlockIndex === 0) {
        const lines = splitWordsIntoIndexedLines(words, 2);
        const topLine = lines[0] || [];
        const bottomLine = lines[1] || [];
        return (
          <span className="split-title lekha-template-fit">
            <span className="split-top">
              {renderEditableLineWords(topLine)}
            </span>
            <span className="split-bot">
              {bottomLine.length ? (
                <span className="imp-purple is-emphasis" data-imp="true" data-imp-cls="imp-purple">
                  {renderEditableLineWords(bottomLine)}
                </span>
              ) : null}
            </span>
          </span>
        );
      }

      const wordNodes = words.map((word, wordIndex) => (
        renderEditableTemplateWord(word, wordIndex, wordIndex, words.length)
      ));

      if (isT17LetterSnapBlock) {
        return (
          <span className="letter-snap-blk lekha-template-fit">
            <span className={templateFitClassName} style={templateFitStyle}>
              {wordNodes}
            </span>
          </span>
        );
      }

      return (
        <span className={templateFitClassName} style={templateFitStyle}>
          {wordNodes}
        </span>
      );
    };

    return (
      <span className={`lekha-original-template ${templateId}-stage`}>
        <span
          className={`sblock ${templateId}-block ${blockClass} active lekha-applied-advanced-template`}
          data-template-block-index={normalizedBlockIndex}
          data-template-block-type={blockType}
          style={{ opacity: 1, transition: 'opacity 280ms ease' }}
        >
          {renderEditableTemplateBody()}
        </span>
      </span>
    );
  };

  const renderAppliedSidebarTemplateCaption = (caption, templateCaptionIndex = 0) => {
    const text = String(caption?.text || '').trim()
    if (!text) return null

    const appliedStyle = caption?.applied_template_style || {}
    const globalHasSidebarTemplate = hasSidebarTemplateStyle(captionStyle)
    const styleBase = globalHasSidebarTemplate
      ? { ...appliedStyle, ...captionStyle }
      : { ...captionStyle, ...appliedStyle }
    const templateValue = (key, fallback = '') => (
      globalHasSidebarTemplate
        ? (styleBase?.[key] ?? fallback)
        : (caption?.[key] ?? styleBase?.[key] ?? fallback)
    )
    const templateSourceValue = templateValue('template_source', 'lekha-20')
    const effectiveStyle = {
      ...styleBase,
      template_id: templateValue('template_id'),
      template_20_id: templateValue('template_20_id'),
      template_source: templateSourceValue,
      template_class: templateValue('template_class'),
      template_name: templateValue('template_name'),
      template_layout: templateValue('template_layout'),
      template_effect: templateValue('template_effect'),
      emotional_mode: caption?.emotional_mode || emotionalCaptionPlan.get(caption?.id)?.mode || 'normal',
      font_family: styleBase.font_family || 'Raleway',
      font_size: styleBase.font_size || 22,
      font_weight: styleBase.font_weight || '300',
      font_style: styleBase.font_style || 'normal',
      text_color: styleBase.text_color || '#FFFFFF',
      text_opacity: templateSourceValue === 'lekha-lc' ? 1 : (styleBase.text_opacity ?? 1),
      text_case: styleBase.text_case || 'none',
      line_spacing: styleBase.line_spacing || 1.25,
      secondary_color: styleBase.secondary_color || '#DDAA03',
    }
    const resolvedFont = resolveScriptFont(effectiveStyle?.font_family, text) || effectiveStyle?.font_family || 'Raleway'
    const fontSize = (effectiveStyle?.font_size || 22) * previewRenderScale
    const emotional = emotionalCaptionPlan.get(caption?.id)
    const phaseCount = countAppliedTemplatePhases(effectiveStyle)
    // Caption order remains the default. The moved Basic cards can also set a
    // scene-dot offset, persisted on each caption when the template is applied.
    const storedPhaseIndex = Number(caption?.template_phase_index)
    const selectedPhase = (Number.isFinite(storedPhaseIndex)
      ? Math.max(0, storedPhaseIndex)
      : Math.max(0, templateCaptionIndex)) % phaseCount
    const impWordIndex = Number(emotional?.impWordIndex ?? caption?.imp_word_index ?? -1)
    const impWordIndices = emotional?.impWordIndices || caption?.imp_word_indices || []
    const emphasisColor = emotional?.emphasisColor || caption?.emphasis_color || ''
    const templateHtml = buildAppliedSidebarTemplateInline(
      text,
      effectiveStyle,
      { activePhase: selectedPhase, settled: false, impWordIndex, impWordIndices },
    )

    if (templateHtml) {
      return (
        <>
          <AppliedSidebarTemplateStyles source={effectiveStyle?.template_source || 'lekha-20'} />
          <AppliedSidebarTemplateSourceRenderer
            html={templateHtml}
            caption={caption}
            captionId={caption?.id}
            captionText={text}
            effectiveStyle={effectiveStyle}
            resolvedFont={resolvedFont}
            fontSize={fontSize}
            currentTime={getCaptionCptRenderTime(caption)}
            isPlaying={isPlaying}
            videoRef={videoRef}
            startTime={caption?.start_time || 0}
            endTime={caption?.end_time || caption?.start_time || 0}
            phaseOffset={selectedPhase}
            emphasisColor={emphasisColor}
            renderScale={previewRenderScale}
            onSourceWordClick={openSourceTemplateWordPopup}
            onSourceWordPointerDown={startSourceTemplateWordDrag}
            isSelected={selectedCaptionId === caption?.id}
          />
        </>
      )
    }

    const words = text.split(/\s+/).filter(Boolean)
    const currentIdx = getCaptionCurrentWordIndex(caption, words.length)
    const lineCount = getSidebarTemplateLineCount(effectiveStyle, words.length)
    const lines = splitWordsIntoIndexedLines(words, lineCount)
    const motion = getSidebarTemplateMotion(effectiveStyle)
    const motionClass = `w${motion}`
    const accentColor = effectiveStyle?.secondary_color || '#DDAA03'
    const primaryColor = effectiveStyle?.text_color || '#FFFFFF'
    const templateClass = effectiveStyle?.template_class || effectiveStyle?.template_20_id || ''

    return (
      <>
        <SidebarSourceTemplateStyles />
        <span
          key={`applied-sidebar-tpl-${caption?.id || 'active'}-${effectiveStyle?.template_20_id || 'tpl'}-${text}`}
          className={[
            'lekha-applied-template-host',
            'lekha-sidebar-source-template',
            'lekha-sidebar-applied-react',
            templateClass,
            effectiveStyle?.text_gradient ? 'has-text-gradient' : '',
            effectiveStyle?.highlight_gradient ? 'has-highlight-gradient' : '',
          ].filter(Boolean).join(' ')}
          data-applied-template-id={effectiveStyle?.template_20_id || ''}
          data-applied-template-source={effectiveStyle?.template_source || 'lekha-20'}
          data-applied-template-layout={effectiveStyle?.template_layout || 'word-by-word'}
          data-applied-template-motion={motion}
          data-export-measure="sidebar-template"
          data-export-caption-id={caption?.id || ''}
          style={{
            '--sidebar-source-color': effectiveStyle?.text_color || '#FFFFFF',
            '--sidebar-source-accent': accentColor,
            '--sidebar-source-line-height': effectiveStyle?.line_spacing || 1.25,
            '--template-text-gradient': effectiveStyle?.text_gradient || 'none',
            '--template-highlight-gradient': effectiveStyle?.highlight_gradient || 'none',
            color: primaryColor,
            fontFamily: resolvedFont,
            fontSize: `${fontSize}px`,
            fontWeight: effectiveStyle?.font_weight || '300',
            fontStyle: effectiveStyle?.font_style || 'normal',
            textTransform: effectiveStyle?.text_case && effectiveStyle.text_case !== 'none' ? effectiveStyle.text_case : undefined,
            lineHeight: effectiveStyle?.line_spacing || 1.25,
            opacity: effectiveStyle?.text_opacity ?? 1,
            textAlign: 'center',
          }}
        >
          <span className="stage">
            <span className="sb active">
              <span className={`wbw-line ${motionClass}`} data-template-effect={effectiveStyle?.template_effect || ''}>
                {lines.map((line, lineIndex) => (
                  <span className="lekha-sidebar-source-line" key={`${caption?.id || 'caption'}-line-${lineIndex}`}>
                    {line.map(({ word, wordIndex }, localIndex) => {
                      if (shouldRevealSequentially(caption) && wordIndex > currentIdx) return null
                      const styleKey = `${caption.id}-${wordIndex}`
                      const ws = caption.wordStyles?.[styleKey] || {}
                      const isCurrent = wordIndex === currentIdx
                      const isPast = wordIndex < currentIdx
                      return (
                        <React.Fragment key={styleKey}>
                          {localIndex > 0 && ' '}
                          <span
                            className={[
                              'wbw-word',
                              isCurrent ? 'is-current' : '',
                              ws.isEmphasis ? 'is-emphasis' : '',
                            ].filter(Boolean).join(' ')}
                            data-word-key={styleKey}
                            data-sidebar-word-state={isCurrent ? 'current' : isPast ? 'past' : 'future'}
                            style={{
                              '--sidebar-source-word-delay': `${Math.min(wordIndex, 8) * 70}ms`,
                              opacity: isCptWordPending(caption, wordIndex, currentIdx) ? 0 : 1,
                              animation: 'none',
                              color: ws.color || (isCurrent ? accentColor : primaryColor),
                              fontFamily: ws.fontFamily || 'inherit',
                              fontWeight: ws.fontWeight || (isCurrent ? effectiveStyle?.font_weight || '700' : 'inherit'),
                              fontStyle: ws.fontStyle || 'inherit',
                              textDecoration: ws.textDecoration || 'inherit',
                              textTransform: ws.textTransform || undefined,
                              textShadow: isCurrent
                                ? `0 0 16px ${accentColor}55`
                                : undefined,
                              ...computeWordEffectCSS(ws),
                            }}
                          >
                            {renderWordTextContent(word, ws, 'inherit')}
                          </span>
                        </React.Fragment>
                      )
                    })}
                  </span>
                ))}
              </span>
            </span>
          </span>
        </span>
      </>
    )
  }

  const renderAppliedBasicTemplateCaption = (caption, templateCaptionIndex = 0) => {
    const text = String(caption?.text || '').trim();
    if (!text) return null;

    const appliedStyle = caption?.applied_template_style || {};
    const templateId = caption?.template_id || appliedStyle?.template_id || captionStyle?.template_id || '';
    const globalStyleMatchesTemplate = captionStyle?.template_id === templateId;
    const effectiveStyle = {
      ...appliedStyle,
      ...(globalStyleMatchesTemplate ? captionStyle : {}),
      template_id: templateId,
      template_source: caption?.template_source || (globalStyleMatchesTemplate ? captionStyle?.template_source : '') || appliedStyle?.template_source || 'lekha-basic',
      template_class: caption?.template_class || (globalStyleMatchesTemplate ? captionStyle?.template_class : '') || appliedStyle?.template_class || '',
      template_name: caption?.template_name || (globalStyleMatchesTemplate ? captionStyle?.template_name : '') || appliedStyle?.template_name || '',
      template_layout: caption?.template_layout || (globalStyleMatchesTemplate ? captionStyle?.template_layout : '') || appliedStyle?.template_layout || '',
      template_effect: caption?.template_effect || (globalStyleMatchesTemplate ? captionStyle?.template_effect : '') || appliedStyle?.template_effect || '',
      template_markup: caption?.template_markup || (globalStyleMatchesTemplate ? captionStyle?.template_markup : '') || appliedStyle?.template_markup || '',
    };
    const words = text.split(/\s+/).filter(Boolean);
    const currentIdx = getCaptionCurrentWordIndex(caption, words.length);
    const phaseCount = countAppliedBasicTemplatePhases(effectiveStyle);
    // Caption order is the authored Basic-template phase source, matching the
    // right-panel preview dots. Ignore stale saved phase=0 values from older
    // applies so Iman -> Horror do not collapse onto the first block.
    const selectedPhase = Math.max(0, templateCaptionIndex) % phaseCount;
    const emotional = emotionalCaptionPlan.get(caption?.id);
    const impWordIndex = Number(emotional?.impWordIndex ?? caption?.imp_word_index ?? -1);
    const impWordIndices = emotional?.impWordIndices || caption?.imp_word_indices || [];
    const templateHtml = buildAppliedBasicTemplateInline(text, effectiveStyle, {
      activePhase: selectedPhase,
      currentIndex: 0,
      impWordIndex,
      impWordIndices,
    });

    if (!templateHtml) return null;

    const resolvedFont = resolveScriptFont(effectiveStyle?.font_family, text) || effectiveStyle?.font_family || 'Inter';
    const normalizedTemplateFontSize = normalizeAppliedBasicTemplateFontSize(
      effectiveStyle?.template_id,
      effectiveStyle?.font_size || 22,
    ) || 22;
    const fontSize = scaleTemplateFontSize(normalizedTemplateFontSize)
      * APPLIED_BASIC_TEMPLATE_FONT_SCALE
      * previewRenderScale;
    const basicTemplateRenderKey = [
      caption?.id || 'caption',
      effectiveStyle?.template_id || 'basic-template',
      selectedPhase,
      getAppliedTemplateMarkupSignature(templateHtml),
      text,
    ].join('|');

    return (
      <AppliedBasicTemplateMarkup
        key={basicTemplateRenderKey}
        caption={caption}
        captionId={caption?.id}
        templateId={effectiveStyle?.template_id || ''}
        selectedPhase={selectedPhase}
        text={text}
        html={templateHtml}
        currentIndex={currentIdx}
        wordCount={words.length}
        currentTime={getCaptionCptRenderTime(caption)}
        isPlaying={isPlaying}
        videoRef={videoRef}
        hostStyle={{
            '--template-primary': effectiveStyle?.text_color || '#ffffff',
            '--template-text-gradient': effectiveStyle?.text_gradient || 'none',
            '--template-secondary': effectiveStyle?.secondary_color || '#000000',
            '--template-bg': effectiveStyle?.background_color || 'transparent',
            '--template-highlight': effectiveStyle?.highlight_color || effectiveStyle?.emphasis_color || effectiveStyle?.secondary_color || ADVANCED_TEMPLATE_EMPHASIS_COLORS[effectiveStyle?.template_id] || '#DDAA03',
            '--template-highlight-gradient': effectiveStyle?.highlight_gradient || 'none',
            '--template-karaoke-1': effectiveStyle?.karaoke_color_1 || effectiveStyle?.highlight_color || effectiveStyle?.emphasis_color || effectiveStyle?.secondary_color || '#DDAA03',
            '--template-karaoke-2': effectiveStyle?.karaoke_color_2 || '#22D3EE',
            '--template-karaoke-3': effectiveStyle?.karaoke_color_3 || '#FB923C',
            '--applied-basic-scale': previewRenderScale,
            '--applied-basic-width': `${Math.max(1, Math.round(320 * previewRenderScale))}px`,
            color: effectiveStyle?.text_color || '#ffffff',
            fontFamily: resolvedFont,
            fontSize: `${fontSize}px`,
            fontWeight: effectiveStyle?.font_weight || '800',
            fontStyle: effectiveStyle?.font_style || 'normal',
            lineHeight: effectiveStyle?.line_spacing || 1.25,
            textTransform: effectiveStyle?.text_case && effectiveStyle.text_case !== 'none' ? effectiveStyle.text_case : undefined,
        }}
        renderScale={previewRenderScale}
        onSourceWordClick={openSourceTemplateWordPopup}
        onSourceWordPointerDown={startSourceTemplateWordDrag}
        isSelected={selectedCaptionId === caption?.id}
      />
    );
  };

  const detachedCaptionWordOverlays = activeCaptions.flatMap((caption) => {
    if (isRecreatedAdvancedTemplateId(getCaptionTemplateId(caption, captionStyle))) return [];
    const words = caption.text.split(' ');
    const wordCount = words.length;
    const currentIdx = getCaptionCurrentWordIndex(caption, wordCount);

    return words.map((word, wordIndex) => {
      if (shouldRevealSequentially(caption) && wordIndex > currentIdx) return null;

      const styleKey = `${caption.id}-${wordIndex}`;
      const ws = caption.wordStyles?.[styleKey] || {};
      if (!isWordDetached(ws)) return null;

      const isSelected = wordPopup?.caption?.id === caption.id && wordPopup?.wordIndex === wordIndex;
      if (isSelected) return null;

      const rawWordFontSize = ws.fontSize || ws.frozenFontSize || (captionStyle?.font_size || 18);
      const wordFontSize = rawWordFontSize * previewRenderScale;
      const emphasisAccent = captionStyle?.secondary_color || '#DDAA03';
      const wordAnimation = ws.animation && ws.animation !== 'none'
        ? getWordAnimationStyle(ws.animation, ws.animationSpeed || 1)
        : 'none';
      const { x: renderOffsetX, y: renderOffsetY } = getWordRenderOffset(ws);
      const emphasisStyle = ws.isEmphasis ? {
        fontWeight: 'bold',
        color: ws.color || emphasisAccent,
        fontSize: `${Math.round(wordFontSize * 1.2)}px`,
        textShadow: `0 0 18px ${emphasisAccent}99, 0 0 6px ${emphasisAccent}66`,
      } : {};
      const templateBlockClass = ws.templateBlockClass || '';
      const templateBlockType = ws.templateBlockType || '';
      const templateWordClass = ws.templateWordClass || '';
      const cptMotionStyle = getCptWordMotionStyle(
        caption,
        ws,
        wordIndex,
        wordCount,
        currentIdx,
        { templateBlockType },
      );
      const resolvedWordMotionStyle = cptMotionStyle || { animation: wordAnimation };
      const wordWrapStyle = ws.boxWidth ? {
        width: '100%',
        maxWidth: '100%',
        whiteSpace: 'normal',
        overflowWrap: 'anywhere',
        wordBreak: 'break-all',
        textAlign: 'center',
      } : {};
      const detachedWordContent = (
        <span style={{ display: ws.boxWidth ? 'block' : 'inline-block', ...wordWrapStyle, ...emphasisStyle }}>
          {renderAnimatedDetachedWordContent(
            word,
            ws,
            'inherit',
            resolvedWordMotionStyle,
            templateWordClass,
          )}
        </span>
      );

      return (
        <span
          key={`detached-${styleKey}`}
          data-word-key={styleKey}
          className={[
            captionStyle?.template_id ? `lekha-original-template ${captionStyle.template_id}-stage` : '',
            isSelected ? 'ring-2 ring-[#F5A623] rounded-sm' : '',
          ].filter(Boolean).join(' ')}
          style={{
            position: 'absolute',
            opacity: isCptWordPending(caption, wordIndex, currentIdx) ? 0 : 1,
            left: `${ws.abs_x_pct}%`,
            top: `${ws.abs_y_pct}%`,
            transform: `translate(-50%, -50%) translate(${renderOffsetX}px, ${renderOffsetY}px)${ws.rotation ? ` rotate(${ws.rotation}deg)` : ''}`,
            transformOrigin: 'center center',
            zIndex: 35,
            cursor: draggingWord?.captionId === caption.id && draggingWord?.wordIndex === wordIndex ? 'grabbing' : 'default',
            whiteSpace: ws.boxWidth ? 'normal' : 'nowrap',
            overflowWrap: ws.boxWidth ? 'anywhere' : 'normal',
            wordBreak: ws.boxWidth ? 'break-all' : 'normal',
            fontFamily: ws.fontFamily || captionStyle?.font_family || 'Inter',
            fontSize: `${wordFontSize}px`,
            fontWeight: ws.fontWeight || captionStyle?.font_weight || 'inherit',
            fontStyle: ws.fontStyle || captionStyle?.font_style || 'inherit',
            textDecoration: 'none',
            textTransform: ws.textTransform || undefined,
            ...(ws.boxWidth ? {
              width: `${ws.boxWidth * previewRenderScale}px`,
              textAlign: 'center',
            } : {}),
            ...(ws.backgroundColor || ws.highlightGradient ? {
              background: ws.highlightGradient || `rgba(${parseInt(ws.backgroundColor.slice(1,3),16)}, ${parseInt(ws.backgroundColor.slice(3,5),16)}, ${parseInt(ws.backgroundColor.slice(5,7),16)}, ${ws.backgroundOpacity ?? 0.6})`,
              borderRadius: '3px',
              padding: `${(ws.backgroundPadding || 2) * previewRenderScale}px ${4 * previewRenderScale}px`,
            } : {}),
            ...emphasisStyle,
          }}
          onPointerDown={(e) => handleCaptionWordPointerIntent(
            e,
            caption,
            wordIndex,
            word,
            { isDetached: true },
          )}
          onClick={(e) => {
            if (Date.now() - lastDragDropTime.current < 150) return;
            if (setWordPopup) {
              e.stopPropagation();
              setWordPopup({
                word,
                position: { x: e.clientX, y: e.clientY },
                caption,
                wordIndex,
              });
            }
          }}
        >
          {captionStyle?.template_id ? (
            <span
              className={`sblock ${captionStyle.template_id}-block ${templateBlockClass} active lekha-applied-advanced-template`}
              data-template-block-type={templateBlockType}
              style={{ opacity: 1, ...(ws.boxWidth ? { display: 'block', ...wordWrapStyle } : {}) }}
            >
              {detachedWordContent}
            </span>
          ) : detachedWordContent}
        </span>
      );
    }).filter(Boolean);
  });

  const selectedDetachedWord = (() => {
    if (!wordPopup?.caption || wordPopup?.type === 'element') return null;
    const liveCaption = captions?.find(c => c.id === wordPopup.caption.id) || activeCaptions.find(c => c.id === wordPopup.caption.id);
    if (!liveCaption) return null;

    const styleKey = `${liveCaption.id}-${wordPopup.wordIndex}`;
    const ws = liveCaption.wordStyles?.[styleKey] || {};
    if (!isWordDetached(ws)) return null;

    const words = (liveCaption.text || '').split(' ');
    const renderOffset = getWordRenderOffset(ws);
    return {
      caption: liveCaption,
      wordIndex: wordPopup.wordIndex,
      word: words[wordPopup.wordIndex] || wordPopup.word,
      fontSize: ws.fontSize || ws.frozenFontSize || (captionStyle?.font_size || 18),
      boxWidth: ws.boxWidth || null,
      textScaleX: ws.textScaleX || 1,
      x: ws.abs_x_pct,
      y: ws.abs_y_pct,
      renderOffset,
      rotation: ws.rotation || 0,
      wordStyle: ws,
    };
  })();

  const handleDetachedWordResizeStart = (e) => {
    if (!selectedDetachedWord || !setCaptions) return;
    e.preventDefault();
    e.stopPropagation();
    if (wordResizeActiveRef.current) return;

    const handle = e.currentTarget;
    const resizeAxis = handle.dataset.resizeAxis || 'corner';
    const selectionBox = handle.closest('[data-selected-word-box="true"]');
    const textNode = selectionBox?.querySelector('[data-selected-word-text="true"]');
    if (!selectionBox || !textNode) return;

    wordResizeActiveRef.current = true;
    if (addToHistory) addToHistory();

    const captionId = selectedDetachedWord.caption.id;
    const wordIndex = selectedDetachedWord.wordIndex;
    const startX = e.clientX;
    const startY = e.clientY;
    const startRect = selectionBox.getBoundingClientRect();
    const startTextRect = textNode.getBoundingClientRect();
    const videoRect = videoContainerRef.current?.getBoundingClientRect();
    const viewportScale = selectedDetachedWordViewport?.scale || 1;
    const renderScale = Math.max(previewRenderScale * viewportScale, 0.001);
    const initialFontSize = selectedDetachedWord.fontSize;
    const minTextboxWidth = 24;
    const initialBoxWidth = Math.max(minTextboxWidth, selectedDetachedWord.boxWidth || (startRect.width / renderScale) || Math.ceil(startTextRect.width / renderScale) || 80);
    const startCenterClientX = startRect.left + startRect.width / 2;
    const startCenterClientY = startRect.top + startRect.height / 2;
    const isLeftHandle = handle.dataset.resizeSide === 'left';
    const isTopHandle = handle.dataset.resizeSide === 'top';

    setResizingWord({
      captionId,
      wordIndex,
      startX,
      startY,
      initialFontSize,
      axis: resizeAxis,
    });
    document.body.style.cursor = resizeAxis === 'horizontal' ? 'ew-resize' : 'nwse-resize';
    document.body.style.userSelect = 'none';

    const writeWordStyle = (producer) => {
      const captionUpdater = setCaptionsRaw || setCaptions;
      captionUpdater(prev => prev.map(c => {
        if (c.id !== captionId) return c;
        const wordStyles = c.wordStyles || {};
        const styleKey = `${c.id}-${wordIndex}`;
        const currentWordStyle = wordStyles[styleKey] || {};
        return {
          ...c,
          wordStyles: {
            ...wordStyles,
            [styleKey]: producer(currentWordStyle),
          },
        };
      }));
    };

    const handleResizeMove = (moveEvent) => {
      moveEvent.preventDefault();
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      if (resizeAxis === 'horizontal') {
        const signedDeltaX = isLeftHandle ? -deltaX : deltaX;
        const nextBoxWidth = Math.max(minTextboxWidth, Math.min(520, Math.round(initialBoxWidth + signedDeltaX / renderScale)));
        const widthDeltaPx = (nextBoxWidth - initialBoxWidth) * renderScale;
        const nextCenterClientX = startCenterClientX + (isLeftHandle ? -widthDeltaPx / 2 : widthDeltaPx / 2);
        const nextAbsXPct = videoRect?.width
          ? Math.max(0, Math.min(100, ((nextCenterClientX - videoRect.left) / videoRect.width) * 100))
          : selectedDetachedWord.x;
        const nextAbsYPct = videoRect?.height
          ? Math.max(0, Math.min(100, ((startCenterClientY - videoRect.top) / videoRect.height) * 100))
          : selectedDetachedWord.y;
        selectionBox.style.width = `${nextBoxWidth * renderScale}px`;
        selectionBox.style.left = `${nextCenterClientX}px`;
        textNode.style.width = '100%';
        textNode.style.transform = '';
        selectionBox.style.overflow = 'visible';
        selectionBox.style.textAlign = 'center';
        selectionBox.style.whiteSpace = 'normal';
        selectionBox.style.overflowWrap = 'anywhere';
        selectionBox.style.wordBreak = 'break-all';

        writeWordStyle((currentWordStyle) => ({
          ...currentWordStyle,
          boxWidth: nextBoxWidth,
          textScaleX: 1,
          abs_x_pct: nextAbsXPct,
          abs_y_pct: nextAbsYPct,
        }));
        return;
      }

      const signedDeltaX = isLeftHandle ? -deltaX : deltaX;
      const signedDeltaY = isTopHandle ? -deltaY : deltaY;
      const dominantDelta = Math.abs(signedDeltaX) >= Math.abs(signedDeltaY) ? signedDeltaX : signedDeltaY;
      const startMeasure = Math.max(startTextRect.width, startTextRect.height, 1);
      const scale = Math.max(0.35, Math.min(5, (startMeasure + dominantDelta) / startMeasure));
      const nextFontSize = Math.max(8, Math.min(140, Math.round(initialFontSize * scale)));

      selectionBox.style.fontSize = `${nextFontSize * renderScale}px`;
      selectionBox.style.width = 'max-content';
      textNode.style.width = 'auto';
      textNode.style.transform = '';
      selectionBox.style.whiteSpace = 'nowrap';
      selectionBox.style.overflowWrap = 'normal';
      selectionBox.style.wordBreak = 'normal';

      writeWordStyle((currentWordStyle) => {
        const nextWordStyle = {
          ...currentWordStyle,
          fontSize: nextFontSize,
          frozenFontSize: nextFontSize,
        };
        delete nextWordStyle.boxWidth;
        delete nextWordStyle.textScaleX;
        return nextWordStyle;
      });
    };

    const handleResizeEnd = () => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      wordResizeActiveRef.current = false;
      setResizingWord(null);
    };

    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  };

  const handleDetachedWordRotateStart = (e) => {
    if (!selectedDetachedWord || !setCaptions) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    if (addToHistory) addToHistory();

    const captionId = selectedDetachedWord.caption.id;
    const wordIndex = selectedDetachedWord.wordIndex;
    const box = e.currentTarget.closest('[data-selected-word-box="true"]');
    const rect = box?.getBoundingClientRect();
    if (!rect) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const initialRotation = selectedDetachedWord.rotation || 0;

    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
    box.style.transformOrigin = 'center center';

    const handleRotateMove = (moveEvent) => {
      moveEvent.preventDefault();
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      const nextRotation = Math.round(initialRotation + ((deltaX + deltaY) * 0.55));
      box.style.transform = `translate(-50%, -50%) rotate(${nextRotation}deg)`;
      box.style.transformOrigin = 'center center';

      setCaptions(prev => prev.map(c => {
        if (c.id !== captionId) return c;
        const wordStyles = c.wordStyles || {};
        const styleKey = `${c.id}-${wordIndex}`;
        const currentWordStyle = wordStyles[styleKey] || {};

        return {
          ...c,
          wordStyles: {
            ...wordStyles,
            [styleKey]: {
              ...currentWordStyle,
              rotation: nextRotation,
            }
          }
        };
      }));
    };

    const handleRotateEnd = () => {
      document.removeEventListener('mousemove', handleRotateMove);
      document.removeEventListener('mouseup', handleRotateEnd);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleRotateMove);
    document.addEventListener('mouseup', handleRotateEnd);
  };

  const handleSelectedDetachedWordDelete = useCallback(() => {
    if (!selectedDetachedWord || !setCaptions) return;
    if (addToHistory) addToHistory();

    const captionUpdater = setCaptionsRaw || setCaptions;
    captionUpdater(prev => prev.map(c => {
      if (c.id !== selectedDetachedWord.caption.id) return c;
      const wordStyles = c.wordStyles || {};
      const styleKey = `${c.id}-${selectedDetachedWord.wordIndex}`;
      const currentWordStyle = wordStyles[styleKey] || {};
      const nextWordStyle = { ...currentWordStyle };

      delete nextWordStyle.abs_x_pct;
      delete nextWordStyle.abs_y_pct;
      delete nextWordStyle.x;
      delete nextWordStyle.y;
      delete nextWordStyle.x_pct;
      delete nextWordStyle.y_pct;
      delete nextWordStyle.boxWidth;
      delete nextWordStyle.textScaleX;
      delete nextWordStyle.rotation;
      delete nextWordStyle.isLocked;

      return {
        ...c,
        wordStyles: {
          ...wordStyles,
          [styleKey]: nextWordStyle
        }
      };
    }));
  }, [addToHistory, selectedDetachedWord, setCaptions, setCaptionsRaw]);

  const handleCaptionDoubleClick = (e, caption) => {
    if (!setCaptions || !caption) return;
    e.stopPropagation();
    setIsEditing(caption.id);
    setEditText(caption.text || '');
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        // Place cursor at the end instead of selecting all
        const range = document.createRange();
        range.selectNodeContents(inputRef.current);
        range.collapse(false);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }, 0);
  };

  const handleEditComplete = (captionId) => {
    if (setCaptions && captionId) {
      setCaptions(prev => prev.map(cap =>
        cap.id === captionId ? { ...cap, text: editText } : cap
      ));
    }
    setIsEditing(false);
    setEditText('');
  };

  const handleEditKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsEditing(false);
      setEditText('');
    }
    // Allow all keys including backspace, Enter, etc.
  };

  const handleEditInput = (e) => {
    // Save cursor position before updating state
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(e.currentTarget);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    const caretOffset = preCaretRange.toString().length;

    const newText = (e.currentTarget.innerText || e.currentTarget.textContent || '').replace(/\u00a0/g, ' ');
    setEditText(newText);

    // Restore cursor position after state update
    requestAnimationFrame(() => {
      if (inputRef.current) {
        const newRange = document.createRange();
        const newSelection = window.getSelection();

        let node = inputRef.current.firstChild;

        if (node && node.nodeType === Node.TEXT_NODE) {
          const offset = Math.min(caretOffset, node.textContent.length);
          newRange.setStart(node, offset);
          newRange.setEnd(node, offset);
          newSelection.removeAllRanges();
          newSelection.addRange(newRange);
        }
      }
    });
  };

  // Handle individual word OR element word style updates
  const getPositionStyle = () => {
    const posY = captionStyle?.position_y ?? 75;
    const posX = captionStyle?.position_x ?? 50;
    const align = captionStyle?.text_align || 'center';

    // Anchor point shifts based on text alignment:
    // left   → left edge of caption at posX
    // center → center of caption at posX (default)
    // right  → right edge of caption at posX
    const transformX = align === 'left' ? '0%' : align === 'right' ? '-100%' : '-50%';
    return {
      top: `${posY}%`,
      left: `${posX}%`,
      transform: `translate(${transformX}, -50%)`
    };
  };

  const handleMouseDown = (e) => {
    if (!setCaptionStyle || e.target.classList.contains('resize-handle')) return;
    // Don't trigger caption drag if we are dragging a word
    if (draggingWord) return;

    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    if (addToHistory) addToHistory();
    setIsDragging(true);
    setDragStartY(e.clientY);
    setDragStartPos(captionStyle?.position_y !== undefined ? captionStyle.position_y : 50);
    setDragStartX(e.clientX);
    setDragStartXPos(captionStyle?.position_x !== undefined ? captionStyle.position_x : 50);
  };

  const handleTextElementMouseDown = (e, elementId, currentStyle) => {
    const isMoveBtn = e.target.closest('.text-element-move-btn');
    if (
      !setCaptions
      || (!isMoveBtn && (
        e.target.classList.contains('text-resize-handle')
        || e.target.closest('button')
        || e.target.closest('[data-word-key]')
        || e.target.closest('[contenteditable="true"]')
      ))
    ) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    if (addToHistory) addToHistory();
    setDraggedElementId(elementId);
    setElementDragStart({
      x: e.clientX,
      y: e.clientY,
      initialTop: currentStyle.top || 50,
      initialLeft: currentStyle.left || 50
    });
  };

  const handleTextElementResizeDown = (e, elementId, currentStyle) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    if (addToHistory) addToHistory();
    setResizedElementId(elementId);
    const measuredWidth = currentStyle.width || 300;
    setElementResizeStart({
      x: e.clientX,
      y: e.clientY,
      initialWidth: measuredWidth,
      initialFontSize: currentStyle.fontSize || 18,
      minWidth: currentStyle.minWidth || 40,
      direction: e.currentTarget?.dataset?.resizeEdge || 'right',
    });
  };

  const handleTextElementRotateStart = (e, elementId, currentStyle) => {
    if (!setCaptions) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    if (addToHistory) addToHistory();

    const elementBox = e.currentTarget.closest('[data-text-element-layer="true"]');
    const rect = elementBox?.getBoundingClientRect();
    if (!rect) return;

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
    const initialRotation = currentStyle.rotation || 0;

    const handleRotateMove = (moveEvent) => {
      moveEvent.preventDefault();
      const currentAngle = Math.atan2(moveEvent.clientY - centerY, moveEvent.clientX - centerX);
      const angleDiff = currentAngle - startAngle;
      let nextRotation = Math.round(initialRotation + (angleDiff * 180 / Math.PI));
      
      if (moveEvent.shiftKey) {
        nextRotation = Math.round(nextRotation / 15) * 15;
      }

      setCaptions(prev => prev.map(c => {
        if (c.id !== elementId) return c;
        return {
          ...c,
          customStyle: {
            ...c.customStyle,
            rotation: nextRotation
          }
        };
      }));
    };

    const handleRotateEnd = () => {
      document.removeEventListener('mousemove', handleRotateMove);
      document.removeEventListener('mouseup', handleRotateEnd);
      document.removeEventListener('pointermove', handleRotateMove);
      document.removeEventListener('pointerup', handleRotateEnd);
    };

    document.addEventListener('mousemove', handleRotateMove);
    document.addEventListener('mouseup', handleRotateEnd);
    document.addEventListener('pointermove', handleRotateMove, { passive: false });
    document.addEventListener('pointerup', handleRotateEnd);
  };

  // ✅ ZERO-LATENCY NATIVE DRAG HANDLER
  // We use direct DOM manipulation for smooth 60fps tracking, bypassing React's render cycle.
  // State is only updated on mouseUp.
  function handleWordMouseDown(e, caption, wordIndex, isElement = false, isDetached = false, dragSource = 'direct') {
    if (!setCaptions) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);

    // A word drag enters editing mode. Stop playback so the canvas stays stable
    // while the word is positioned and the committed CPT can be inspected.
    const editingRoot = videoContainerRef.current;
    if (editingRoot) {
      const captionWordPrefix = `${caption.id}-`;
      editingRoot.querySelectorAll('[data-word-key]').forEach((node) => {
        if (!String(node.getAttribute('data-word-key') || '').startsWith(captionWordPrefix)) return;
        node.style.setProperty('opacity', '1', 'important');
      });
    }
    if (isPlayingRef.current) {
      videoRef.current?.pause();
      setIsPlaying(false);
    }

    const customStyle = caption?.wordStyles?.[`${caption?.id}-${wordIndex}`] || {};
    const renderedOffset = getWordRenderOffset(customStyle);
    
    // Use the element that received the event directly
    const targetElement = e.currentTarget;
    if (!targetElement) return;
    const sourceTemplateVisualElement = dragSource === 'source-template'
      ? targetElement.querySelector('[data-source-word-visual="true"], .kf-base, .kf-fill')
      : null;
    const dragPreviewElement = isDetached
      ? targetElement
      : targetElement.querySelector('[data-word-drag-visual="true"]') || targetElement;
    const dragMovementElement = dragSource === 'source-template'
      ? targetElement
      : dragPreviewElement;
    const dragMeasurementElement = sourceTemplateVisualElement || dragPreviewElement;
    const isFixedWordEditorDrag = dragMovementElement.matches?.('[data-selected-word-box="true"]') === true;
    const initialInlineTranslate = dragMovementElement.style.getPropertyValue('translate');
    const initialInlineTranslatePriority = dragMovementElement.style.getPropertyPriority('translate');
    const restoreInlineTranslate = () => {
      if (initialInlineTranslate) {
        dragMovementElement.style.setProperty(
          'translate',
          initialInlineTranslate,
          initialInlineTranslatePriority
        );
      } else {
        dragMovementElement.style.removeProperty('translate');
      }
    };

    if (
      dragSource !== 'source-template'
      && captionStyle?.template_id
      && !isElement
      && !isDetached
    ) {
      const computedStyle = window.getComputedStyle(dragMeasurementElement);
      const styleKey = `${caption.id}-${wordIndex}`;
      const captionUpdater = setCaptionsRaw || setCaptions;
      captionUpdater(prev => prev.map(c => {
        if (c.id !== caption.id) return c;
        const wordStyles = c.wordStyles || {};
        const currentWordStyle = wordStyles[styleKey] || {};
        return {
          ...c,
          wordStyles: {
            ...wordStyles,
            [styleKey]: {
              ...currentWordStyle,
              fontFamily: currentWordStyle.fontFamily || computedStyle.fontFamily,
              fontWeight: currentWordStyle.fontWeight || computedStyle.fontWeight,
              fontStyle: currentWordStyle.fontStyle || computedStyle.fontStyle,
              textTransform: currentWordStyle.textTransform || computedStyle.textTransform,
              color: currentWordStyle.color || computedStyle.color,
              templateBlockClass: targetElement.dataset.templateBlockClass || currentWordStyle.templateBlockClass,
              templateBlockType: targetElement.dataset.templateBlockType || currentWordStyle.templateBlockType,
              templateWordClass: targetElement.dataset.templateWordClass || currentWordStyle.templateWordClass,
            }
          }
        };
      }));
    }

    // Immediately create the dragging state
    const dragState = {
      captionId: caption.id,
      wordIndex,
      startX: e.clientX,
      startY: e.clientY,
      initialX: renderedOffset.x || 0,
      initialY: renderedOffset.y || 0,
      isElement,
      isDetached,
      dragSource,
      targetElement
    };
    
    setDraggingWord(dragState);
    currentDragCoordinates.current = { x: dragState.initialX, y: dragState.initialY };
    let hasMoved = false;
    let hasRecordedHistory = false;

    const videoContainer = videoContainerRef.current || videoRef.current?.parentElement;
    const containerWidth = videoContainer?.offsetWidth || canvasSize.width || 1;
    const containerHeight = videoContainer?.offsetHeight || canvasSize.height || 1;
    const baselineWidth = fitCanvasSizeRef.current.width || containerWidth;
    const baselineHeight = fitCanvasSizeRef.current.height || containerHeight;
    const containerRectAtStart = videoContainer?.getBoundingClientRect();
    const viewportScaleX = containerRectAtStart?.width
      ? containerRectAtStart.width / containerWidth
      : 1;
    const viewportScaleY = containerRectAtStart?.height
      ? containerRectAtStart.height / containerHeight
      : viewportScaleX;
    const wordRectAtStart = dragMeasurementElement.getBoundingClientRect();
    const startCenterXPct = containerRectAtStart?.width
      ? ((wordRectAtStart.left + wordRectAtStart.width / 2 - containerRectAtStart.left) / containerRectAtStart.width) * 100
      : 50;
    const startCenterYPct = containerRectAtStart?.height
      ? ((wordRectAtStart.top + wordRectAtStart.height / 2 - containerRectAtStart.top) / containerRectAtStart.height) * 100
      : 50;
    const snapTargetsX = [6, 50, 94];
    const snapTargetsY = [6, 50, 94];
    const getWordSnap = (value, targets, axisSize) => {
      const snapThresholdPct = (5 / Math.max(axisSize, 1)) * 100;
      const match = targets.find(target => Math.abs(value - target) <= snapThresholdPct);
      return typeof match === 'number' ? match : null;
    };
    const getLocalCptGuides = (deltaX, deltaY) => {
      if (!videoContainer || !containerRectAtStart || dragState.isElement) {
        return { deltaX, deltaY, guides: [] };
      }

      const styleKey = `${caption.id}-${wordIndex}`;
      const siblingRects = Array.from(videoContainer.querySelectorAll('[data-word-key]'))
        .filter(node => {
          if (!(node instanceof Element)) return false;
          if (node === targetElement || node === dragPreviewElement) return false;
          const key = node.getAttribute('data-word-key') || '';
          if (key === styleKey || !key.startsWith(`${caption.id}-`)) return false;
          const nodeStyle = window.getComputedStyle(node);
          if (nodeStyle.visibility === 'hidden' || nodeStyle.display === 'none' || nodeStyle.opacity === '0') return false;
          const visualNode = node.querySelector(
            '[data-source-word-visual="true"], [data-word-drag-visual="true"], .kf-base, .kf-fill'
          ) || node;
          const rect = visualNode.getBoundingClientRect();
          return rect.width > 2 && rect.height > 2;
        })
        .map(node => {
          const visualNode = node.querySelector(
            '[data-source-word-visual="true"], [data-word-drag-visual="true"], .kf-base, .kf-fill'
          ) || node;
          return visualNode.getBoundingClientRect();
        });
      const resolved = resolveCptWordSnap({
        draggedRect: wordRectAtStart,
        siblingRects,
        deltaX,
        deltaY,
        alignThreshold: 5,
        magneticThreshold: 10,
        minGap: Math.max(4, Math.min(9, wordRectAtStart.height * 0.18)),
      });
      const guides = resolved.guides.map((guide) => {
        if (guide.type === 'vertical') {
          return {
            ...guide,
            x: (guide.x - containerRectAtStart.left) / viewportScaleX,
            y1: Math.max(0, (guide.y1 - containerRectAtStart.top) / viewportScaleY),
            y2: Math.min(containerHeight, (guide.y2 - containerRectAtStart.top) / viewportScaleY),
          };
        }
        if (guide.type === 'horizontal' || guide.type === 'spacing-horizontal') {
          return {
            ...guide,
            y: (guide.y - containerRectAtStart.top) / viewportScaleY,
            x1: Math.max(0, (guide.x1 - containerRectAtStart.left) / viewportScaleX),
            x2: Math.min(containerWidth, (guide.x2 - containerRectAtStart.left) / viewportScaleX),
          };
        }
        return {
          ...guide,
          x: (guide.x - containerRectAtStart.left) / viewportScaleX,
          y1: Math.max(0, (guide.y1 - containerRectAtStart.top) / viewportScaleY),
          y2: Math.min(containerHeight, (guide.y2 - containerRectAtStart.top) / viewportScaleY),
        };
      });

      return { deltaX: resolved.deltaX, deltaY: resolved.deltaY, guides };
    };

    const handleNativeMouseMove = (moveEvent) => {
      moveEvent.preventDefault();
      const deltaX = moveEvent.clientX - dragState.startX;
      const deltaY = moveEvent.clientY - dragState.startY;

      if (!hasMoved && Math.abs(deltaX) <= 3 && Math.abs(deltaY) <= 3) {
        return;
      }

      if (!hasMoved) {
        hasMoved = true;
        if (!hasRecordedHistory && addToHistory) {
          addToHistory();
          hasRecordedHistory = true;
        }
      }

      // A word must end exactly where the pointer releases it. The former
      // magnetic/collision snap adjusted the saved delta by a few pixels and
      // could move neighbouring sentence words visually as well. Keep guides
      // for caption tools, but word drags have no implicit correction.
      const adjustedClientDeltaX = deltaX;
      const adjustedClientDeltaY = deltaY;
      const adjustedDeltaX = adjustedClientDeltaX / (isFixedWordEditorDrag ? 1 : viewportScaleX);
      const adjustedDeltaY = adjustedClientDeltaY / (isFixedWordEditorDrag ? 1 : viewportScaleY);
      const newX = dragState.initialX + adjustedDeltaX;
      const newY = dragState.initialY + adjustedDeltaY;
      
      currentDragCoordinates.current = {
        x: newX,
        y: newY,
        deltaX: adjustedDeltaX,
        deltaY: adjustedDeltaY,
        clientDeltaX: adjustedClientDeltaX,
        clientDeltaY: adjustedClientDeltaY,
      };
      setSnapGuides({ hLines: [], vLines: [] });
      setCptWordGuides([]);
      
      // Directly manipulate the DOM for zero-latency dragging
      if (dragState.dragSource === 'source-template') {
        // Source-template visuals already contain their saved x/y translation.
        // Move the stable outer anchor by only this gesture's delta so an
        // existing offset is never applied twice during a second drag.
        dragMovementElement.style.setProperty(
          'translate',
          `${adjustedDeltaX}px ${adjustedDeltaY}px`,
          'important'
        );
      } else if (dragState.isElement) {
        dragPreviewElement.style.setProperty(
          'transform',
          `translate(${newX}px, ${newY}px)`,
          'important'
        );
      } else {
        // The word may come from an inline template, an absolutely centered
        // caption, or the fixed selected-word portal. CSS `translate` composes
        // with all of those authored transforms without replacing their anchor.
        dragMovementElement.style.setProperty(
          'translate',
          `${adjustedDeltaX}px ${adjustedDeltaY}px`,
          'important'
        );
      }
    };

    const handleNativeMouseUp = (upEvent) => {
      document.removeEventListener('mousemove', handleNativeMouseMove);
      document.removeEventListener('mouseup', handleNativeMouseUp);
      document.removeEventListener('pointermove', handleNativeMouseMove);
      document.removeEventListener('pointerup', handleNativeMouseUp);
      document.removeEventListener('pointercancel', handleNativeMouseUp);
      
      // Now perform the final React state update to save the new coordinates
      if (hasMoved) {
        const previousCoords = currentDragCoordinates.current;
        const releaseClientDeltaX = Number.isFinite(upEvent?.clientX)
          ? upEvent.clientX - dragState.startX
          : (Number(previousCoords?.clientDeltaX) || 0);
        const releaseClientDeltaY = Number.isFinite(upEvent?.clientY)
          ? upEvent.clientY - dragState.startY
          : (Number(previousCoords?.clientDeltaY) || 0);
        // Commit the actual release point. A pointer-up can arrive a few
        // pixels beyond the browser's last pointer-move, which previously made
        // the word jump slightly after it was dropped.
        const finalCoords = {
          x: dragState.initialX + releaseClientDeltaX / (isFixedWordEditorDrag ? 1 : viewportScaleX),
          y: dragState.initialY + releaseClientDeltaY / (isFixedWordEditorDrag ? 1 : viewportScaleY),
          deltaX: releaseClientDeltaX / (isFixedWordEditorDrag ? 1 : viewportScaleX),
          deltaY: releaseClientDeltaY / (isFixedWordEditorDrag ? 1 : viewportScaleY),
          clientDeltaX: releaseClientDeltaX,
          clientDeltaY: releaseClientDeltaY,
        };
        if (finalCoords) {
          const parentFontSize = isElement
            ? (caption.customStyle?.fontSize || 18)
            : (captionStyle?.font_size || 18);

          const containerRect = videoContainer?.getBoundingClientRect();
          // Derive the committed position from the same start rectangle and
          // snapped delta used by the live preview. Reading the mutated DOM here
          // is unreliable for template words whose animation/transform can
          // change between pointermove and pointerup.
          const finalDeltaX = Number(finalCoords.clientDeltaX) || 0;
          const finalDeltaY = Number(finalCoords.clientDeltaY) || 0;
          const absXPct = containerRect?.width
            ? ((wordRectAtStart.left + wordRectAtStart.width / 2 + finalDeltaX - containerRect.left) / containerRect.width) * 100
            : undefined;
          const absYPct = containerRect?.height
            ? ((wordRectAtStart.top + wordRectAtStart.height / 2 + finalDeltaY - containerRect.top) / containerRect.height) * 100
            : undefined;
          const detachedPositionDeltaPct = (
            typeof absXPct === 'number'
            && typeof absYPct === 'number'
          )
            ? Math.max(
                Math.abs(absXPct - startCenterXPct),
                Math.abs(absYPct - startCenterYPct)
              )
            : 0;
          const shouldDetachWord = (
            dragState.dragSource !== 'source-template'
            && !dragState.isElement
            && detachedPositionDeltaPct > 0.75
          );
            
          const captionUpdater = setCaptionsRaw || setCaptions;
          captionUpdater(prev => prev.map(c => {
            if (c.id !== dragState.captionId) return c;
            const wordStyles = c.wordStyles || {};
            const styleKey = `${c.id}-${dragState.wordIndex}`;
            const currentWordStyle = wordStyles[styleKey] || {};
            const nextWordStyle = dragState.dragSource === 'source-template'
              ? {
                  ...currentWordStyle,
                  x: (finalCoords.x / containerWidth) * baselineWidth,
                  y: (finalCoords.y / containerHeight) * baselineHeight,
                  x_pct: (finalCoords.x / containerWidth) * 100,
                  y_pct: (finalCoords.y / containerHeight) * 100,
                  frozenFontSize: currentWordStyle.frozenFontSize || parentFontSize
                }
              : dragState.isElement
              ? {
                  ...currentWordStyle,
                  x: (finalCoords.x / containerWidth) * baselineWidth,
                  y: (finalCoords.y / containerHeight) * baselineHeight,
                  x_pct: (finalCoords.x / containerWidth) * 100,
                  y_pct: (finalCoords.y / containerHeight) * 100,
                  frozenFontSize: currentWordStyle.frozenFontSize || parentFontSize
                }
              : shouldDetachWord ? {
                  ...currentWordStyle,
                  x: 0,
                  y: 0,
                  x_pct: 0,
                  y_pct: 0,
                  abs_x_pct: typeof absXPct === 'number' ? absXPct : currentWordStyle.abs_x_pct,
                  abs_y_pct: typeof absYPct === 'number' ? absYPct : currentWordStyle.abs_y_pct,
                  frozenFontSize: currentWordStyle.frozenFontSize || parentFontSize
                } : {
                  ...currentWordStyle,
                  x: 0,
                  y: 0,
                  x_pct: 0,
                  y_pct: 0,
                  frozenFontSize: currentWordStyle.frozenFontSize || parentFontSize
                };
            if (
              !dragState.isElement
              && typeof absXPct === 'number'
              && typeof absYPct === 'number'
            ) {
              // Keep a canvas-space drop point even for source-template words,
              // which continue to use x/y offsets in the preview. ExportPanel
              // converts this snapshot to video space so the burned result is
              // WYSIWYG even when the source template reflows or scales.
              nextWordStyle.cptCanvasXPercent = absXPct;
              nextWordStyle.cptCanvasYPercent = absYPct;
            }
            if (!dragState.isElement && !shouldDetachWord) {
              delete nextWordStyle.abs_x_pct;
              delete nextWordStyle.abs_y_pct;
            }
            
            return {
              ...c,
              wordStyles: {
                ...wordStyles,
                [styleKey]: nextWordStyle
              }
            };
          }));

          requestAnimationFrame(() => {
            if (dragState.dragSource === 'source-template') {
              restoreInlineTranslate();
            } else if (dragState.isElement) {
              dragPreviewElement.style.setProperty(
                'transform',
                `translate(${finalCoords.x}px, ${finalCoords.y}px)`
              );
            } else {
              restoreInlineTranslate();
            }
          });
        }
        
        lastDragDropTime.current = Date.now();
      }
      
      setDraggingWord(null);
      currentDragCoordinates.current = null;
      setSnapGuides({ hLines: [], vLines: [] });
      setCptWordGuides([]);
    };

    document.addEventListener('mousemove', handleNativeMouseMove);
    document.addEventListener('mouseup', handleNativeMouseUp);
    document.addEventListener('pointermove', handleNativeMouseMove, { passive: false });
    document.addEventListener('pointerup', handleNativeMouseUp);
    document.addEventListener('pointercancel', handleNativeMouseUp);
  }

  const handleResizeMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    if (addToHistory) addToHistory();
    const measuredWidth = captionStyle?.boxWidth || 300;
    setIsResizing(true);
    setResizeStartX(e.clientX);
    setResizeStartY(e.clientY);
    setResizeStartWidth(measuredWidth);
    setResizeStartFontSize(captionStyle?.font_size || 18);
    setResizeDirection(e.currentTarget?.dataset?.resizeEdge || 'right');
  };

  // Global Mouse Move / Up for all dragging operations
  useEffect(() => {
    if ((!isDragging && !draggedElementId && !resizedElementId) || (!setCaptionStyle && !setCaptions)) return;

    const SNAP_THRESHOLD_PCT = 2.5; // % within which to snap
    const getSnapGuides = (axis, value, excludeId) => {
      // Static snap targets
      const targets = axis === 'y'
        ? [5, 50, 75, 95]
        : [5, 50, 95];
      // Add other elements
      if (captions) {
        captions.forEach(c => {
          if (c.isTextElement && c.id !== excludeId && c.customStyle) {
            if (axis === 'x' && c.customStyle.left != null) targets.push(c.customStyle.left);
            if (axis === 'y' && c.customStyle.top != null) targets.push(c.customStyle.top);
          }
        });
      }
      for (const t of targets) {
        if (Math.abs(value - t) <= SNAP_THRESHOLD_PCT) {
          return { snapped: true, value: t };
        }
      }
      return { snapped: false, value };
    };

    const handleMouseMove = (e) => {
      // 1. Handle Caption Full Drag (X and Y)
      if (isDragging) {
        const videoContainer = captionRef.current?.parentElement;
        if (!videoContainer) return;

        const containerHeight = videoContainer.offsetHeight;
        const containerWidth = videoContainer.offsetWidth;
        
        const deltaY = e.clientY - dragStartY;
        const deltaPercentY = (deltaY / containerHeight) * 100;
        let newPosY = dragStartPos + deltaPercentY;
        newPosY = Math.max(5, Math.min(95, newPosY));

        const deltaX = e.clientX - dragStartX;
        const deltaPercentX = (deltaX / containerWidth) * 100;
        let newPosX = dragStartXPos + deltaPercentX;
        newPosX = Math.max(5, Math.min(95, newPosX));

        // Snap check for Y and X axis
        const ySnap = getSnapGuides('y', newPosY, null);
        const xSnap = getSnapGuides('x', newPosX, null);
        
        let hLines = [];
        let vLines = [];
        
        if (ySnap.snapped) {
          newPosY = ySnap.value;
          hLines.push(newPosY);
        }
        if (xSnap.snapped) {
          newPosX = xSnap.value;
          vLines.push(newPosX);
        }
        
        setSnapGuides({ hLines, vLines });

        const styleUpdater = setCaptionStyleRaw || setCaptionStyle;
        styleUpdater(prev => ({ 
          ...prev, 
          position_y: Math.round(newPosY),
          position_x: Math.round(newPosX)
        }));
      }

      // 3. Handle Text Element Drag
      if (draggedElementId && setCaptions) {
        const videoContainer = videoRef.current?.parentElement;
        if (!videoContainer) return;

        const containerWidth = videoContainer.offsetWidth;
        const containerHeight = videoContainer.offsetHeight;
        const deltaX = e.clientX - elementDragStart.x;
        const deltaY = e.clientY - elementDragStart.y;
        const deltaPercentX = (deltaX / containerWidth) * 100;
        const deltaPercentY = (deltaY / containerHeight) * 100;

        let newLeft = elementDragStart.initialLeft + deltaPercentX;
        let newTop = elementDragStart.initialTop + deltaPercentY;
        newLeft = Math.max(5, Math.min(95, newLeft));
        newTop = Math.max(5, Math.min(95, newTop));

        // Snap checks for X and Y
        const xSnap = getSnapGuides('x', newLeft, draggedElementId);
        const ySnap = getSnapGuides('y', newTop, draggedElementId);
        if (xSnap.snapped) newLeft = xSnap.value;
        if (ySnap.snapped) newTop = ySnap.value;
        setSnapGuides({
          hLines: ySnap.snapped ? [newTop] : [],
          vLines: xSnap.snapped ? [newLeft] : []
        });

        const captionUpdater = setCaptionsRaw || setCaptions;
        captionUpdater(prev => prev.map(c => {
          if (c.id !== draggedElementId) return c;
          return {
            ...c,
            customStyle: {
              ...c.customStyle,
              left: newLeft,
              top: newTop
            }
          };
        }));
      }

      // 4. Handle Text Element Resize
      if (resizedElementId && setCaptions) {
        const deltaX = e.clientX - elementResizeStart.x;
        const deltaY = e.clientY - elementResizeStart.y;
        const resizeDelta = (() => {
          switch (elementResizeStart.direction) {
            case 'left':
              return -deltaX;
            case 'top':
              return -deltaY;
            case 'bottom':
              return deltaY;
            case 'top-left':
              return Math.abs(deltaX) >= Math.abs(deltaY) ? -deltaX : -deltaY;
            case 'top-right':
              return Math.abs(deltaX) >= Math.abs(deltaY) ? deltaX : -deltaY;
            case 'bottom-left':
              return Math.abs(deltaX) >= Math.abs(deltaY) ? -deltaX : deltaY;
            case 'bottom-right':
            case 'corner':
              return Math.abs(deltaX) >= Math.abs(deltaY) ? deltaX : deltaY;
            case 'right':
            default:
              return deltaX;
          }
        })();

        const isHorizontalFrameResize = ['left', 'right'].includes(elementResizeStart.direction);
        const minFrameWidth = isHorizontalFrameResize ? 28 : Math.min(elementResizeStart.minWidth || 150, 80);
        const unscaledDelta = resizeDelta / Math.max(previewRenderScale, 0.001);
        let newWidth = elementResizeStart.initialWidth + (isHorizontalFrameResize ? unscaledDelta * 2 : unscaledDelta);
        newWidth = Math.max(minFrameWidth, Math.min(600, newWidth));

        const widthRatio = newWidth / Math.max(elementResizeStart.initialWidth, 1);
        let newFontSize = elementResizeStart.initialFontSize * widthRatio;
        newFontSize = Math.max(12, Math.min(60, newFontSize));

        const captionUpdater = setCaptionsRaw || setCaptions;
        captionUpdater(prev => prev.map(c => {
          if (c.id !== resizedElementId) return c;
          return {
            ...c,
            customStyle: {
              ...c.customStyle,
              width: newWidth,
              ...(isHorizontalFrameResize ? {} : { fontSize: newFontSize })
            }
          };
        }));
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setDraggedElementId(null);
      setResizedElementId(null);
      setSnapGuides({ hLines: [], vLines: [] }); // clear guides
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('pointermove', handleMouseMove, { passive: false });
    document.addEventListener('pointerup', handleMouseUp);
    document.addEventListener('pointercancel', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('pointermove', handleMouseMove);
      document.removeEventListener('pointerup', handleMouseUp);
      document.removeEventListener('pointercancel', handleMouseUp);
    };
  }, [isDragging, dragStartY, dragStartPos, setCaptionStyle, setCaptions, draggedElementId, resizedElementId, elementDragStart, elementResizeStart, previewRenderScale]);

  useEffect(() => {
    if (!isResizing || !setCaptionStyle) return;

    const handleMouseMove = (e) => {
      const deltaX = e.clientX - resizeStartX;
      const deltaY = e.clientY - resizeStartY;
      const resizeDelta = (() => {
        switch (resizeDirection) {
          case 'left':
            return -deltaX;
          case 'top':
            return -deltaY;
          case 'bottom':
            return deltaY;
          case 'top-left':
            return Math.abs(deltaX) >= Math.abs(deltaY) ? -deltaX : -deltaY;
          case 'top-right':
            return Math.abs(deltaX) >= Math.abs(deltaY) ? deltaX : -deltaY;
          case 'bottom-left':
            return Math.abs(deltaX) >= Math.abs(deltaY) ? -deltaX : deltaY;
          case 'bottom-right':
          case 'corner':
            return Math.abs(deltaX) >= Math.abs(deltaY) ? deltaX : deltaY;
          case 'right':
          default:
            return deltaX;
        }
      })();

      const isHorizontalFrameResize = ['left', 'right'].includes(resizeDirection);
      const minFrameWidth = isHorizontalFrameResize ? 180 : 80;
      const unscaledDelta = resizeDelta / Math.max(previewRenderScale, 0.001);
      let newWidth = resizeStartWidth + (isHorizontalFrameResize ? unscaledDelta * 2 : unscaledDelta);
      newWidth = Math.max(minFrameWidth, Math.min(600, newWidth));

      // Calculate proportional font size change
      const safeStartWidth = Math.max(resizeStartWidth, 1);
      const widthRatio = newWidth / safeStartWidth;
      let newFontSize = resizeStartFontSize * widthRatio;
      newFontSize = Math.max(12, Math.min(60, newFontSize));

      const styleUpdater = setCaptionStyleRaw || setCaptionStyle;
      styleUpdater(prev => ({
        ...prev,
        boxWidth: newWidth,
        ...(isHorizontalFrameResize ? {} : { font_size: newFontSize })
      }));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('pointermove', handleMouseMove, { passive: false });
    document.addEventListener('pointerup', handleMouseUp);
    document.addEventListener('pointercancel', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('pointermove', handleMouseMove);
      document.removeEventListener('pointerup', handleMouseUp);
      document.removeEventListener('pointercancel', handleMouseUp);
    };
  }, [isResizing, resizeDirection, resizeStartFontSize, resizeStartWidth, resizeStartX, resizeStartY, setCaptionStyle, previewRenderScale]);

  const selectedDetachedWordViewport = (() => {
    if (!selectedDetachedWord || typeof window === 'undefined') return null;
    const videoFrame = videoContainerRef.current;
    const rect = videoFrame?.getBoundingClientRect();
    if (!rect) return null;
    const scaleX = rect.width && videoFrame.offsetWidth ? rect.width / videoFrame.offsetWidth : 1;
    const scaleY = rect.height && videoFrame.offsetHeight ? rect.height / videoFrame.offsetHeight : scaleX;

    return {
      x: rect.left + (rect.width * (selectedDetachedWord.x ?? 50)) / 100 + ((selectedDetachedWord.renderOffset?.x || 0) * scaleX),
      y: rect.top + (rect.height * (selectedDetachedWord.y ?? 50)) / 100 + ((selectedDetachedWord.renderOffset?.y || 0) * scaleY),
      scale: scaleX,
      scaleY,
    };
  })();

  const selectedDetachedWordEditor = selectedDetachedWord && selectedDetachedWordViewport && typeof document !== 'undefined'
    ? (() => {
      const isAdjustingSelectedWord = Boolean(
        resizingWord
        || (
          draggingWord
          && draggingWord.captionId === selectedDetachedWord.caption.id
          && draggingWord.wordIndex === selectedDetachedWord.wordIndex
        )
      );
      const isDraggingSelectedWord = Boolean(
        draggingWord
        && draggingWord.captionId === selectedDetachedWord.caption.id
        && draggingWord.wordIndex === selectedDetachedWord.wordIndex
      );
      const selectedWordStyle = selectedDetachedWord.wordStyle || {};
      const selectedWordBoxWidth = selectedDetachedWord.boxWidth || null;
      const selectedWordFontSize = selectedDetachedWord.fontSize * previewRenderScale * selectedDetachedWordViewport.scale;
      const selectedEmphasisAccent = captionStyle?.secondary_color || '#DDAA03';
      const cptGuideFrameRect = videoContainerRef.current?.getBoundingClientRect();
      const selectedCenterXPct = cptGuideFrameRect?.width
        ? Math.max(0, Math.min(100, ((selectedDetachedWordViewport.x - cptGuideFrameRect.left) / cptGuideFrameRect.width) * 100))
        : 50;
      const selectedCenterYPct = cptGuideFrameRect?.height
        ? Math.max(0, Math.min(100, ((selectedDetachedWordViewport.y - cptGuideFrameRect.top) / cptGuideFrameRect.height) * 100))
        : 50;
      const shouldShowCptGuides = Boolean(cptGuideFrameRect && (isAdjustingSelectedWord || showLayoutGuides || activeCanvasTool === 'guides'));
      const shouldShowSelectedCrosshair = !(isDraggingSelectedWord || resizingWord);
      const selectedCaptionWordCount = String(selectedDetachedWord.caption.text || '')
        .split(/\s+/)
        .filter(Boolean)
        .length;
      const selectedCaptionCurrentIndex = getCaptionCurrentWordIndex(
        selectedDetachedWord.caption,
        selectedCaptionWordCount,
      );
      const selectedWordIsPending = isCptWordPending(
        selectedDetachedWord.caption,
        selectedDetachedWord.wordIndex,
        selectedCaptionCurrentIndex,
      );
      const selectedEmphasisStyle = selectedWordStyle.isEmphasis ? {
        fontWeight: 'bold',
        color: selectedWordStyle.color || selectedEmphasisAccent,
        fontSize: `${Math.round(selectedWordFontSize * 1.2)}px`,
        textShadow: `0 0 18px ${selectedEmphasisAccent}99, 0 0 6px ${selectedEmphasisAccent}66`,
      } : {};
      const selectedWordAnimation = selectedWordStyle.animation && selectedWordStyle.animation !== 'none'
        ? getAnimationStyle(selectedWordStyle.animation, selectedWordStyle.animationSpeed || 1)
        : 'none';

      return createPortal(
      <>
      {shouldShowCptGuides && createPortal(
        <div
          data-cpt-text-guides="true"
          className="pointer-events-none fixed"
          style={{
            left: `${cptGuideFrameRect.left}px`,
            top: `${cptGuideFrameRect.top}px`,
            width: `${cptGuideFrameRect.width}px`,
            height: `${cptGuideFrameRect.height}px`,
            zIndex: 100004,
          }}
        >
          <div className="absolute inset-[6%] rounded-sm border border-[#dce85f]/45" />
          <div className="absolute top-0 bottom-0 w-px bg-[#dce85f]/55" style={{ left: '50%' }} />
          <div className="absolute left-0 right-0 h-px bg-[#dce85f]/35" style={{ top: '50%' }} />
          <div className="absolute top-0 bottom-0 border-l border-dashed border-white/45" style={{ left: '6%' }} />
          <div className="absolute top-0 bottom-0 border-l border-dashed border-white/45" style={{ left: '94%' }} />
          {shouldShowSelectedCrosshair && (
            <>
              <div className="absolute w-20 -translate-x-1/2 border-t border-dashed border-[#ff2f9f] shadow-[0_0_6px_rgba(255,47,159,0.45)]" style={{ left: `${selectedCenterXPct}%`, top: `${selectedCenterYPct}%` }} />
              <div className="absolute h-20 -translate-y-1/2 border-l border-dashed border-[#ff2f9f] shadow-[0_0_6px_rgba(255,47,159,0.45)]" style={{ left: `${selectedCenterXPct}%`, top: `${selectedCenterYPct}%` }} />
            </>
          )}
        </div>,
        document.body
      )}
      <span
        data-selected-word-box="true"
        data-word-key={`${selectedDetachedWord.caption.id}-${selectedDetachedWord.wordIndex}`}
        className="group fixed rounded-[1px] border border-[#9f83ff] bg-transparent px-[2px] shadow-[0_0_0_1px_rgba(255,255,255,0.16)]"
        style={{
          left: `${selectedDetachedWordViewport.x}px`,
          top: `${selectedDetachedWordViewport.y}px`,
          zIndex: 100005,
          transform: `translate(-50%, -50%)${selectedDetachedWord.rotation ? ` rotate(${selectedDetachedWord.rotation}deg)` : ''}`,
          transformOrigin: 'center center',
          fontFamily: selectedWordStyle.fontFamily || captionStyle?.font_family || 'Inter',
          fontSize: `${selectedWordFontSize}px`,
          fontWeight: selectedWordStyle.fontWeight || captionStyle?.font_weight || 'inherit',
          fontStyle: selectedWordStyle.fontStyle || captionStyle?.font_style || 'inherit',
          textDecoration: 'none',
          textTransform: selectedWordStyle.textTransform || undefined,
          lineHeight: 1.1,
          color: selectedWordStyle.color || captionStyle?.text_color || '#ffffff',
          whiteSpace: selectedWordBoxWidth ? 'normal' : 'nowrap',
          overflowWrap: selectedWordBoxWidth ? 'anywhere' : 'normal',
          wordBreak: selectedWordBoxWidth ? 'break-all' : 'normal',
          overflow: 'visible',
          textAlign: 'center',
          display: 'block',
          boxSizing: 'border-box',
          width: selectedWordBoxWidth
            ? `${selectedWordBoxWidth * previewRenderScale * selectedDetachedWordViewport.scale}px`
            : 'auto',
          ...(!selectedWordIsPending && (selectedWordStyle.backgroundColor || selectedWordStyle.highlightGradient) ? {
            background: selectedWordStyle.highlightGradient || `rgba(${parseInt(selectedWordStyle.backgroundColor.slice(1,3),16)}, ${parseInt(selectedWordStyle.backgroundColor.slice(3,5),16)}, ${parseInt(selectedWordStyle.backgroundColor.slice(5,7),16)}, ${selectedWordStyle.backgroundOpacity ?? 0.6})`,
            borderRadius: '3px',
            padding: `${(selectedWordStyle.backgroundPadding || 2) * previewRenderScale * selectedDetachedWordViewport.scale}px ${4 * previewRenderScale * selectedDetachedWordViewport.scale}px`,
          } : {}),
          ...selectedEmphasisStyle,
          cursor: resizingWord ? 'nwse-resize' : (isDraggingSelectedWord ? 'grabbing' : 'default'),
          userSelect: 'none',
          pointerEvents: 'auto',
        }}
        onPointerDown={(e) => {
          if (e.target.closest('.word-resize-handle')) return;
          handleCaptionWordPointerIntent(
            e,
            selectedDetachedWord.caption,
            selectedDetachedWord.wordIndex,
            selectedDetachedWord.word,
            { isDetached: true },
          );
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        data-video-control
      >
        <button
          type="button"
          className="absolute -right-4 -top-4 z-[96] flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-[#141418] text-white/80 shadow-[0_8px_20px_-12px_rgba(0,0,0,0.95)] transition-colors hover:border-red-400/60 hover:bg-red-500/12 hover:text-red-300"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleSelectedDetachedWordDelete();
          }}
          title="Delete word"
          data-video-control
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.9} />
        </button>
        <span
          data-selected-word-text="true"
          style={{
            display: 'inline-block',
            width: selectedWordBoxWidth ? '100%' : 'auto',
            minWidth: 0,
            whiteSpace: selectedWordBoxWidth ? 'normal' : 'nowrap',
            overflowWrap: selectedWordBoxWidth ? 'anywhere' : 'normal',
            wordBreak: selectedWordBoxWidth ? 'break-all' : 'normal',
            textAlign: 'center',
            opacity: selectedWordIsPending ? 0 : 1,
            animation: selectedWordAnimation,
            transformOrigin: 'center center',
          }}
        >
          {renderWordTextContent(selectedDetachedWord.word, selectedWordStyle, captionStyle?.text_color || '#ffffff')}
        </span>
        {[
          { classes: '-top-4 -left-4 cursor-nwse-resize', axis: 'corner', sideX: 'left', sideY: 'top' },
          { classes: '-top-4 -right-4 cursor-nesw-resize', axis: 'corner', sideX: 'right', sideY: 'top' },
          { classes: '-bottom-4 -left-4 cursor-nesw-resize', axis: 'corner', sideX: 'left', sideY: 'bottom' },
          { classes: '-bottom-4 -right-4 cursor-nwse-resize', axis: 'corner', sideX: 'right', sideY: 'bottom' },
          { classes: 'top-1/2 -left-4 -translate-y-1/2 cursor-ew-resize', axis: 'horizontal', sideX: 'left' },
          { classes: 'top-1/2 -right-4 -translate-y-1/2 cursor-ew-resize', axis: 'horizontal', sideX: 'right' },
        ].map((handle) => (
          <span
            key={handle.classes}
            onPointerDown={handleDetachedWordResizeStart}
            onDragStart={(e) => e.preventDefault()}
            className={`word-resize-handle absolute z-[95] flex h-8 w-8 items-center justify-center rounded-full bg-transparent ${handle.classes}`}
            title="Resize word"
            data-resize-axis={handle.axis}
            data-resize-side={handle.sideX}
            data-resize-vertical-side={handle.sideY}
            data-video-control
          >
            <span className="block h-2 w-2 rounded-full border border-[#a78bfa] bg-white shadow-[0_2px_6px_rgba(0,0,0,0.18)]" />
          </span>
        ))}
        {!isAdjustingSelectedWord && (
          <span
            className="absolute left-1/2 top-full z-[95] mt-[14px] flex -translate-x-1/2 items-center gap-2"
            data-selected-word-actions="true"
          >
            <span
              className="flex h-6 w-6 items-center justify-center rounded-full border border-[#d8d2e8] bg-white text-[#4f4f5a] shadow-[0_2px_5px_rgba(15,15,20,0.16)] transition-transform hover:scale-105"
              style={{ cursor: 'grab' }}
              onPointerDown={handleDetachedWordRotateStart}
              title="Rotate word"
              data-video-control
            >
              <RotateCw className="h-3 w-3" strokeWidth={1.9} />
            </span>
            <span
              className="flex h-6 w-6 items-center justify-center rounded-full border border-[#d8d2e8] bg-white text-[#4f4f5a] shadow-[0_2px_5px_rgba(15,15,20,0.16)] transition-transform hover:scale-105"
              style={{ cursor: 'move' }}
              onPointerDown={(e) => {
                const selectionBox = e.currentTarget.closest('[data-selected-word-box="true"]');
                if (!selectionBox) return;
                handleWordMouseDown({
                  preventDefault: () => e.preventDefault(),
                  stopPropagation: () => e.stopPropagation(),
                  clientX: e.clientX,
                  clientY: e.clientY,
                  currentTarget: selectionBox,
                }, selectedDetachedWord.caption, selectedDetachedWord.wordIndex, false, true, 'action-move');
              }}
              title="Move word"
              data-video-control
            >
              <Move className="h-3 w-3" strokeWidth={1.9} />
            </span>
          </span>
        )}
      </span>,
      </>,
      document.body
    );
    })()
    : null;

  const handleCanvasWordClickCapture = (event) => {
    if (!setWordPopup || Date.now() - lastDragDropTime.current < 200) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('.word-resize-handle, [data-selected-word-actions="true"], button, input, textarea, select')) return;

    const wordNode = target.closest('[data-word-key]');
    const wordKey = wordNode?.getAttribute('data-word-key') || '';
    if (!wordNode || !wordKey || !videoContainerRef.current?.contains(wordNode)) return;

    const liveTarget = [...(captions || [])]
      .filter(item => item?.id && wordKey.startsWith(`${item.id}-`))
      .sort((a, b) => String(b.id).length - String(a.id).length)[0];
    if (!liveTarget) return;

    const wordIndex = Number(wordKey.slice(String(liveTarget.id).length + 1));
    if (!Number.isInteger(wordIndex) || wordIndex < 0) return;

    const word = String(liveTarget.text || '').split(/\s+/).filter(Boolean)[wordIndex];
    if (!word) return;

    // Own all word clicks at the canvas boundary. Some applied templates
    // rebuild their internal DOM after a style edit, which can discard a
    // word-level listener; the stable canvas listener remains available.
    event.preventDefault();
    event.stopPropagation();
    if (setSelectedCaptionId) setSelectedCaptionId(liveTarget.id);
    setWordPopup(liveTarget.isTextElement
      ? {
          type: 'element',
          elementId: liveTarget.id,
          wordIndex,
          word,
          position: { x: event.clientX, y: event.clientY },
        }
      : {
          caption: liveTarget,
          wordIndex,
          word,
          position: { x: event.clientX, y: event.clientY },
        });
  };

  return (
    <>
    <OriginalAdvancedTemplateStyles />
    <SidebarSourceTemplateStyles />
    {/* <AppliedSidebarTemplateStyles /> — disabled: injecting both full template
        stylesheets globally caused a style-recalc freeze. Re-enable only with
        scoped/iframe-isolated CSS. */}
    <div className={`flex flex-col h-full ${isVideoFullscreen ? 'bg-black px-2 py-2' : ''}`}>
      {/* Video container with 9:16 aspect ratio for mobile preview */}
      <div className={`relative flex-1 rounded-xl overflow-visible flex items-center justify-center min-h-0 ${isVideoFullscreen ? 'pt-0 pb-2' : 'pt-4 pb-3'}`}>
        {/* Floating canvas tool rail beside the preview */}
        {setIsVideoFullscreen && (
          <div className={`absolute top-1/2 -translate-y-1/2 z-50 rounded-xl border border-white/10 bg-[#0d0d0d]/90 p-1.5 shadow-[0_18px_42px_-24px_rgba(0,0,0,0.9)] backdrop-blur-md ${isVideoFullscreen ? 'left-[24%]' : 'left-2 sm:left-4'}`}>
            {[
              { icon: ZoomIn, title: 'Zoom in', key: 'zoom-in', active: false },
              { icon: ZoomOut, title: 'Zoom out', key: 'zoom-out', active: false },
              { icon: Grid2X2, title: 'Guides', key: 'guides', active: showCornerGuides || showLayoutGuides },
              { icon: RotateCcw, title: 'Reset view', key: 'reset', active: false },
            ].map((tool) => {
              const Icon = tool.icon;
              return (
                <button
                  key={tool.title}
                  type="button"
                  className={`mb-1 flex h-7 w-7 items-center justify-center rounded-lg transition-colors last:mb-0 ${
                    tool.active ? 'bg-white text-black' : 'text-slate-500 hover:bg-white/5 hover:text-white'
                  }`}
                  title={tool.title}
                  onClick={(e) => handleCanvasToolClick(tool.key, e)}
                >
                  <Icon className="h-3.5 w-3.5" />
                </button>
              );
            })}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleVideoFullscreen();
              }}
              className="mt-1 flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-white/5 hover:text-white"
              title={`${isVideoFullscreen ? 'Collapse' : 'Expand'} (F)`}
            >
              {isVideoFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        )}
        {/* Zoom level badge — only visible when zoomed */}
        {canvasScale !== 1 && (
          <div className="absolute top-2 left-2 z-50 px-1.5 py-0.5 rounded bg-black/60 text-white/70 text-[10px] tabular-nums backdrop-blur-sm">
            {Math.round(canvasScale * 100)}%
          </div>
        )}
        <div
          className={`relative inline-flex overflow-visible ${isVideoFullscreen ? 'scale-[1.02]' : ''}`}
          style={{ transition: 'transform 0.1s ease' }}
          onClick={(e) => {
            const target = e.target;
            if (!(target instanceof Element)) return;
            if (target.closest('[data-caption-layer], [data-text-element-layer], [data-word-key], .resize-handle, .text-resize-handle, [data-video-control], button, input, textarea, select, [role="button"], [contenteditable="true"]')) {
              return;
            }
            clearActiveSelection();
          }}
          >
          {showCornerGuides && (
            <div className="pointer-events-none absolute -inset-[14px] z-[65]">
              <span className="absolute left-0 top-0 h-[18px] w-[18px] border-l border-t border-white/75" />
              <span className="absolute right-0 top-0 h-[18px] w-[18px] border-r border-t border-white/75" />
              <span className="absolute left-0 bottom-0 h-[18px] w-[18px] border-b border-l border-white/75" />
              <span className="absolute right-0 bottom-0 h-[18px] w-[18px] border-b border-r border-white/75" />
            </div>
          )}
        <div
          ref={videoContainerRef}
          className={`lekha-video-frame relative aspect-[9/16] touch-none select-none bg-black shadow-[0_35px_120px_rgba(0,0,0,0.72)] ${isVideoFullscreen ? 'h-auto max-h-[calc(100dvh-92px)]' : 'h-full max-h-[calc(100dvh-360px)] md:max-h-[calc(100dvh-296px)]'}`}
            style={{
              transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${canvasScale})`,
              transformOrigin: 'center center',
              transition: isCanvasPanning ? 'none' : 'transform 0.1s ease',
              cursor: activeCanvasTool === 'move' ? (isCanvasPanning ? 'grabbing' : 'grab') : 'default',
            }}
            onPointerDown={handleCanvasMouseDown}
            onClickCapture={handleCanvasWordClickCapture}
            onClick={handleVideoSurfaceClick}
          >
          {showLayoutGuides && (
            <div className="pointer-events-none absolute inset-0 z-[80]">
              {[33.333, 66.666].map((pct) => (
                <div key={`layout-v-${pct}`} className="absolute top-0 bottom-0 w-px bg-white/14" style={{ left: `${pct}%` }} />
              ))}
              {[33.333, 66.666].map((pct) => (
                <div key={`layout-h-${pct}`} className="absolute left-0 right-0 h-px bg-white/14" style={{ top: `${pct}%` }} />
              ))}
            </div>
          )}
          {/* CPT snap guide lines */}
          {snapGuides.hLines.map((pct, i) => (
            <div
              key={`hg-${i}`}
              data-cpt-snap-guide="horizontal"
              className="pointer-events-none absolute left-0 right-0 z-[999] border-t border-dashed border-[#ff2f9f]"
              style={{
                top: `${pct}%`,
                boxShadow: '0 0 6px rgba(255,47,159,0.5)',
              }}
            />
          ))}
          {snapGuides.vLines.map((pct, i) => (
            <div
              key={`vg-${i}`}
              data-cpt-snap-guide="vertical"
              className="pointer-events-none absolute top-0 bottom-0 z-[999] border-l border-dashed border-[#ff2f9f]"
              style={{
                left: `${pct}%`,
                boxShadow: '0 0 6px rgba(255,47,159,0.5)',
              }}
            />
          ))}
          {cptWordGuides.length > 0 && (
            <div className="pointer-events-none absolute inset-0 z-[1000]" data-cpt-word-guides="true">
              {cptWordGuides.map((guide, i) => {
                if (guide.type === 'vertical') {
                  const y1 = Math.max(0, Math.min(guide.y1, guide.y2));
                  const height = Math.max(8, Math.abs(guide.y2 - guide.y1));
                  return (
                    <div
                      key={`cpt-word-v-${i}`}
                      className="absolute border-l border-dashed border-[#66f2ff] shadow-[0_0_8px_rgba(102,242,255,0.65)]"
                      style={{
                        left: `${guide.x}px`,
                        top: `${y1}px`,
                        height: `${height}px`,
                      }}
                    />
                  );
                }

                if (guide.type === 'horizontal') {
                  const x1 = Math.max(0, Math.min(guide.x1, guide.x2));
                  const width = Math.max(8, Math.abs(guide.x2 - guide.x1));
                  return (
                    <div
                      key={`cpt-word-h-${i}`}
                      className="absolute border-t border-dashed border-[#66f2ff] shadow-[0_0_8px_rgba(102,242,255,0.65)]"
                      style={{
                        left: `${x1}px`,
                        top: `${guide.y}px`,
                        width: `${width}px`,
                      }}
                    />
                  );
                }

                if (guide.type === 'spacing-vertical') {
                  const y1 = Math.max(0, Math.min(guide.y1, guide.y2));
                  const height = Math.max(6, Math.abs(guide.y2 - guide.y1));
                  return (
                    <div
                      key={`cpt-word-spacing-${i}`}
                      className="absolute"
                      style={{
                        left: `${guide.x}px`,
                        top: `${y1}px`,
                        height: `${height}px`,
                      }}
                    >
                      <span className="absolute left-[-4px] top-0 h-px w-2 bg-[#f8e36a]" />
                      <span className="absolute left-[-4px] bottom-0 h-px w-2 bg-[#f8e36a]" />
                      <span className="absolute left-0 top-0 h-full border-l border-dashed border-[#f8e36a] shadow-[0_0_7px_rgba(248,227,106,0.55)]" />
                    </div>
                  );
                }

                if (guide.type === 'spacing-horizontal') {
                  const x1 = Math.max(0, Math.min(guide.x1, guide.x2));
                  const width = Math.max(6, Math.abs(guide.x2 - guide.x1));
                  return (
                    <div
                      key={`cpt-word-spacing-x-${i}`}
                      className="absolute"
                      style={{
                        left: `${x1}px`,
                        top: `${guide.y}px`,
                        width: `${width}px`,
                      }}
                    >
                      <span className="absolute left-0 top-[-4px] h-2 w-px bg-[#f8e36a]" />
                      <span className="absolute right-0 top-[-4px] h-2 w-px bg-[#f8e36a]" />
                      <span className="absolute left-0 top-0 w-full border-t border-dashed border-[#f8e36a] shadow-[0_0_7px_rgba(248,227,106,0.55)]" />
                    </div>
                  );
                }

                return null;
              })}
            </div>
          )}
          {videoUrl ? (
            <>
              <MemoizedVideo
                videoRef={videoRef}
                videoUrl={videoUrl}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onMediaError={onVideoError}
                setIsPlaying={setIsPlaying}
              />
              <div className="absolute top-3 left-3 z-40 flex items-center gap-2">
                <span className="rounded bg-black/75 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-white">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-white mr-1" /> Rec
                </span>
              </div>
              <div className="absolute top-3 right-3 z-40 rounded bg-black/75 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-white">
                9:16 - 24FPS
              </div>
              {!isPlaying && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsPlaying(true);
                  }}
                  className="absolute left-1/2 top-1/2 z-40 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/24 bg-transparent text-white shadow-[0_10px_24px_rgba(0,0,0,0.22)] transition-transform hover:scale-[1.02]"
                  title="Play"
                >
                  <Play className="ml-0.5 h-5 w-5" />
                </button>
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-zinc-900/50">
              <p className="text-gray-500 text-sm text-center px-4">
                Upload a video to get started
              </p>
            </div>
          )}



          {/* Caption overlays */}
          {activeCaptions.map((caption) => {
            const isEditingThis = isEditing === caption.id;
            const hasDetachedWords = captionHasDetachedWords(caption);
            const hasGlobalSidebarTemplate = hasSidebarTemplateStyle(captionStyle);
            const isSidebarTemplate = hasGlobalSidebarTemplate
              || hasSidebarTemplateStyle(caption?.applied_template_style)
              || !!caption?.template_20_id;
            const activeCaptionTemplateId = caption?.template_id || caption?.applied_template_style?.template_id || captionStyle?.template_id;
            const isBasicSourceTemplate = isSourceBasicTemplateId(activeCaptionTemplateId);
            const hasAppliedBasicSourceMarkup = isBasicSourceTemplate;
            const shouldWrapCaption = !isSidebarTemplate && (!activeCaptionTemplateId || isBasicSourceTemplate);
            const autoWrapMaxWidth = Math.max(
              220,
              Math.min(360, (canvasSize.width || videoContainerRef.current?.offsetWidth || 240) * 0.94)
            );
            const templateCaptionIndex = Math.max(
              0,
              captions.filter(c => c && !c.isTextElement).findIndex(c => c.id === caption.id),
            );
            const storedTemplatePhaseIndex = Number(caption?.template_phase_index);
            const advancedTemplatePhaseIndex = Number.isFinite(storedTemplatePhaseIndex)
              ? storedTemplatePhaseIndex
              : templateCaptionIndex;
            const basicTemplateWords = String(caption?.text || '').trim().split(/\s+/).filter(Boolean);
            const basicTemplateCurrentIdx = basicTemplateWords.length
              ? getCaptionCurrentWordIndex(caption, basicTemplateWords.length)
              : 0;
            const effectiveTemplateStyle = {
              ...(caption?.applied_template_style || {}),
              ...(captionStyle || {}),
            };
            const sourceTemplateAccentColor = isAdvancedTemplateId(activeCaptionTemplateId)
              ? resolveAdvancedTemplateEmphasisColor(activeCaptionTemplateId, '')
              : '';
            const configuredTemplateAccentColor = effectiveTemplateStyle?.highlight_color
              || effectiveTemplateStyle?.emphasis_color
              || effectiveTemplateStyle?.secondary_color
              || '';
            const configuredTemplateAccentDiffers = configuredTemplateAccentColor
              && sourceTemplateAccentColor
              && configuredTemplateAccentColor.toLowerCase?.() !== sourceTemplateAccentColor.toLowerCase?.();
            const templateColorsCustomized = Boolean(
              effectiveTemplateStyle?.template_color_customized
                || caption?.template_color_customized
                || configuredTemplateAccentDiffers,
            );
            const templateAccentColor = templateColorsCustomized
              ? (configuredTemplateAccentColor || sourceTemplateAccentColor || '#d4af37')
              : (sourceTemplateAccentColor || configuredTemplateAccentColor || '#d4af37');
            const templateTextColor = activeCaptionTemplateId === 't36'
              ? '#ffffff'
              : (effectiveTemplateStyle?.text_color || '#ffffff');
            const canvasTemplateEmphasisColor = activeCaptionTemplateId === 't35'
              ? ''
              : (templateColorsCustomized
                ? templateAccentColor
                : (sourceTemplateAccentColor || emotionalCaptionPlan.get(caption?.id)?.emphasisColor || caption?.emphasis_color || templateAccentColor || ''));
            const handleDeleteCaptionLine = (e) => {
              e.stopPropagation();
              e.preventDefault();
              if (!setCaptions) return;
              if (addToHistory) addToHistory();
              const captionUpdater = setCaptionsRaw || setCaptions;
              captionUpdater(prev => prev.filter(c => c.id !== caption.id));
              if (setSelectedCaptionId && selectedCaptionId === caption.id) {
                setSelectedCaptionId(null);
              }
            };
            const appliedBasicTemplateNode = hasAppliedBasicSourceMarkup
              ? renderAppliedBasicTemplateCaption(caption, templateCaptionIndex)
              : null;
            // Text elements are positioned higher or custom, but for now we'll use same style
            // We should probably allow separate positioning for text elements in future, but keeping simple for now
            // or we use captionStyle but offset it if it's a text element? 
            // The current request implies basic overlap support. 
            // We use the same getPositionStyle() which uses global captionStyle. This is a limitation.
            // Ideally text elements should have their own position in their data.
            // Since we don't have per-caption position yet, they will stack.
            // Let's at least render them so they are visible.

            return (
              <div
                key={caption.id}
                ref={captionRef}
                data-caption-layer="true"
                data-caption-id={caption.id}
                className={isSidebarTemplate
                  ? `absolute flex justify-center ${setCaptionStyle && !isEditingThis && !hasDetachedWords ? 'cursor-move' : ''}`
                  : `absolute px-3 flex justify-center ${setCaptionStyle && !isEditingThis && !hasDetachedWords ? 'cursor-move' : ''}`}
                style={isSidebarTemplate ? {
                  top: `${captionStyle?.position_y ?? 75}%`,
                  left: '50%',
                  width: '100%',
                  transform: 'translate(-50%, -50%)',
                  zIndex: caption.isTextElement ? 20 : 10,
                  pointerEvents: setCaptionStyle ? 'auto' : 'none',
                  overflow: 'visible',
                } : {
                  ...getPositionStyle(),
                  // If it's a text element, maybe offset it slightly or allow it to be distinct?
                  // For now, they share the same position setting which allows dragging ONE changes ALL.
                  // This is "MVP" behavior.
                  zIndex: caption.isTextElement ? 20 : 10,
                  pointerEvents: setCaptionStyle ? 'auto' : 'none',
                  overflow: 'visible',
                }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  if (setSelectedCaptionId) setSelectedCaptionId(caption.id);
                  if (setCaptionStyle && !isEditingThis && !hasDetachedWords) {
                    handleMouseDown(e);
                  }
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (setSelectedCaptionId) setSelectedCaptionId(caption.id);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  handleCaptionDoubleClick(e, caption);
                }}
              >
                <div
                  className={`border border-solid ${!isSidebarTemplate && selectedCaptionId === caption.id && !hasDetachedWords ? 'border-[#b76cff]' : !isSidebarTemplate ? 'border-transparent hover:border-[#b76cff]' : 'border-transparent'} relative ${isSidebarTemplate ? (isEditingThis ? 'cursor-text' : 'cursor-pointer') : isDragging ? 'cursor-grabbing' : isEditingThis ? 'cursor-text' : setCaptionStyle && !hasDetachedWords ? 'cursor-grab' : ''} ${!hasDetachedWords ? 'group' : ''} ${activeCaptionTemplateId || ''} ${getTemplateContainerStateClass(activeCaptionTemplateId)}`}
                  style={{
                    backgroundColor: 'transparent',
                    padding: '0px',
                    textAlign: captionStyle?.text_align || 'center',
                    width: isSidebarTemplate 
                      ? 'fit-content'
                      : captionStyle?.boxWidth 
                        ? `${captionStyle.boxWidth * previewRenderScale}px` 
                        : (shouldWrapCaption ? `${autoWrapMaxWidth}px` : 'fit-content'),
                    maxWidth: isSidebarTemplate
                      ? '94%'
                      : captionStyle?.boxWidth 
                        ? undefined 
                        : (shouldWrapCaption ? `${autoWrapMaxWidth}px` : '90vw'),
                    position: 'relative',
                    display: isSidebarTemplate ? 'inline-flex' : 'inline-block',
                    justifyContent: isSidebarTemplate ? 'center' : undefined,
                    overflow: 'visible',
                    // Template captions keep pointer events so the caption box is
                    // selectable / hoverable / double-click editable like a normal
                    // caption. Words inside are display-only spans, so this does not
                    // interfere with the template's time-based animations.
                    pointerEvents: 'auto',
                    '--template-primary': captionStyle?.text_color || '#ffffff',
                    '--template-secondary': captionStyle?.secondary_color || '#000000',
                    '--template-bg': captionStyle?.background_color || 'transparent',
                    '--template-highlight': captionStyle?.highlight_color || captionStyle?.emphasis_color || captionStyle?.secondary_color || ADVANCED_TEMPLATE_EMPHASIS_COLORS[captionStyle?.template_id] || '#DDAA03',
                    '--template-karaoke-1': captionStyle?.karaoke_color_1 || captionStyle?.highlight_color || captionStyle?.emphasis_color || captionStyle?.secondary_color || '#DDAA03',
                    '--template-karaoke-2': captionStyle?.karaoke_color_2 || '#22D3EE',
                    '--template-karaoke-3': captionStyle?.karaoke_color_3 || '#FB923C',
                  }}
                >
                  {/* Background layer — padding expands equally above and below the text */}
                  {captionStyle?.has_background && !hasDetachedWords && !isBasicSourceTemplate && (
                    <div
                      style={{
                        position: 'absolute',
                        top: `-${displayBackgroundPadding}px`,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: -1,
                        backgroundColor: `rgba(${parseInt((captionStyle?.background_color || '#000000').slice(1, 3), 16)}, ${parseInt((captionStyle?.background_color || '#000000').slice(3, 5), 16)}, ${parseInt((captionStyle?.background_color || '#000000').slice(5, 7), 16)}, ${captionStyle?.background_opacity ?? 0.7})`,
                        borderRadius: '6px',
                        width: `${100 * displayBackgroundWidthMultiplier}%`,
                        height: `calc(100% + ${2 * displayBackgroundPadding}px)`,
                      }}
                    />
                  )}

                  {/* Delete button for the selected/hovered main caption line */}
                  {setCaptions && !isEditingThis && !hasDetachedWords && (
                    <button
                      type="button"
                      className={`absolute -top-2.5 -right-2.5 w-6 h-6 bg-zinc-900 border border-white/20 hover:border-red-500/50 hover:bg-red-500/10 rounded-full transition-all z-50 flex items-center justify-center shadow-xl text-gray-400 hover:text-red-500 ${selectedCaptionId === caption.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                      }}
                      onClick={handleDeleteCaptionLine}
                      title="Delete caption line"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Resize handles — shown for regular and templated captions alike */}
                  {setCaptionStyle && !isEditingThis && !hasDetachedWords && !isSidebarTemplate && (
                    <>
                      {[
                        ['top-left', 'left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize'],
                        ['top', 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize'],
                        ['top-right', 'right-0 top-0 -translate-y-1/2 translate-x-1/2 cursor-nesw-resize'],
                        ['left', 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize'],
                        ['right', 'right-0 top-1/2 -translate-y-1/2 translate-x-1/2 cursor-ew-resize'],
                        ['bottom-left', 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize'],
                        ['bottom', 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 cursor-ns-resize'],
                        ['bottom-right', 'bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize'],
                      ].map(([edge, positionClass]) => (
                        <div
                          key={edge}
                          className={`resize-handle ${selectionHandleClass} ${positionClass} transition-opacity ${selectedCaptionId === caption.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                          data-resize-edge={edge}
                          onPointerDown={handleResizeMouseDown}
                          style={{ touchAction: 'none' }}
                        />
                      ))}
                    </>
                  )}

                  {isEditingThis ? (
                    <div
                      ref={inputRef}
                      contentEditable
                      suppressContentEditableWarning
                      onInput={handleEditInput}
                      onBlur={() => handleEditComplete(caption.id)}
                      onKeyDown={handleEditKeyDown}
                      className="bg-transparent border-none outline-none text-center relative z-10"
                      style={{
                        fontFamily: captionStyle?.font_family || 'Inter',
                        fontSize: `${(captionStyle?.font_size || 18) * previewRenderScale}px`,
                        lineHeight: captionStyle?.line_spacing || 1.4,
                        fontWeight: captionStyle?.font_weight || 'normal',
                        fontStyle: captionStyle?.font_style || 'normal',
                        textAlign: captionStyle?.text_align || 'center',
                        letterSpacing: captionStyle?.letter_spacing ? `${captionStyle.letter_spacing * previewRenderScale}px` : '0px',
                        wordSpacing: `${(captionStyle?.word_spacing ?? 0) * previewRenderScale}px`,
                        textDecoration: captionStyle?.text_decoration || 'none',
                        opacity: captionStyle?.text_opacity ?? 1,
                        transform: `scale(${captionStyle?.scale || 1})`,
                        padding: hasDetachedWords ? '0px' : `${displayCaptionPadY}px ${displayCaptionPadX}px`,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'normal',
                        ...(captionStyle?.text_gradient ? {
                          backgroundImage: captionStyle.text_gradient,
                          WebkitBackgroundClip: 'text',
                          backgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          color: 'transparent',
                          display: 'block', // Editor needs block to have size
                        } : {
                          color: captionStyle?.text_color || '#ffffff'
                        }),
                        textTransform: captionStyle?.text_case && captionStyle.text_case !== 'none' ? captionStyle.text_case : undefined,
                        width: '100%',
                        minWidth: shouldWrapCaption ? '0px' : '200px',
                        minHeight: '60px'
                      }}
                    >
                      {editText}
                    </div>
                  ) : isSidebarTemplate ? (
                    renderAppliedSidebarTemplateCaption(caption, templateCaptionIndex)
                  ) : appliedBasicTemplateNode ? (
                    appliedBasicTemplateNode
                  ) : activeCaptionTemplateId ? (
                    // Template rendering: simple word spans with CSS class states for template effects
                    <span
                      key={`${caption.id}-${activeCaptionTemplateId || 'template'}-${isBasicSourceTemplate ? basicTemplateCurrentIdx : 'static'}`}
                      className={`${getTemplateWrapperClassName(activeCaptionTemplateId)}${isBasicSourceTemplate ? ' lekha-basic-template-fit lekha-basic-template-animated' : ''}`}
                      data-basic-current-index={isBasicSourceTemplate ? basicTemplateCurrentIdx : undefined}
                      style={{
                        fontFamily: captionStyle?.font_family || 'Inter',
                        fontSize: isAdvancedTemplateId(activeCaptionTemplateId)
                          ? undefined
                          : `${scaleTemplateFontSize(captionStyle?.font_size) * previewRenderScale}px`,
                        fontWeight: captionStyle?.font_weight || 'normal',
                        fontStyle: captionStyle?.font_style || 'normal',
                        textAlign: captionStyle?.text_align || 'center',
                        display: isBasicSourceTemplate ? 'inline-block' : 'block',
                        lineHeight: isAdvancedTemplateId(activeCaptionTemplateId)
                          ? undefined
                          : `${scaleTemplateFontSize(captionStyle?.font_size) * previewRenderScale * (captionStyle?.line_spacing || 1.4)}px`,
                        letterSpacing: isAdvancedTemplateId(activeCaptionTemplateId)
                          ? undefined
                          : (captionStyle?.letter_spacing ? `${captionStyle.letter_spacing * previewRenderScale}px` : '0px'),
                        wordSpacing: isAdvancedTemplateId(activeCaptionTemplateId)
                          ? undefined
                          : `${(captionStyle?.word_spacing ?? 0) * previewRenderScale}px`,
                        textTransform: captionStyle?.text_case && captionStyle.text_case !== 'none' ? captionStyle.text_case : undefined,
                        maxWidth: '100%',
                        whiteSpace: caption.text?.includes('\n') ? 'pre-wrap' : ((shouldWrapCaption || captionStyle?.boxWidth) ? 'normal' : 'nowrap'),
                        overflowWrap: shouldWrapCaption ? 'anywhere' : 'normal',
                        wordBreak: 'normal',
                        // A detached word keeps an invisible spacer in this
                        // line. Preserve the line padding too, otherwise the
                        // remaining words jump when one word is moved.
                        padding: undefined,
                        // Template markup/classes own motion. A generic caption
                        // animation here masks the differences between templates.
                        animation: 'none',
                        '--basic-current-index': basicTemplateCurrentIdx,
                        '--basic-word-count': Math.max(1, basicTemplateWords.length),
                      }}
                    >
                      {(() => {
                        if (isAdvancedTemplateId(activeCaptionTemplateId)) {
                          // Keep the authored source renderer mounted during
                          // word dragging/styling. Replacing it with a generic
                          // editable renderer reflowed every sibling word and
                          // changed the caption box mid-gesture.
                          return (
                            <AppliedAdvancedTemplateCaption
                              key={`${caption.id}-${activeCaptionTemplateId}-${advancedTemplatePhaseIndex}-${caption.text}`}
                              caption={caption}
                              captionId={caption.id}
                              templateId={activeCaptionTemplateId}
                              text={caption.text}
                              blockIndex={advancedTemplatePhaseIndex}
                              templateMarkup={
                                caption?.applied_template_style?.template_markup
                                || caption?.template_markup
                                || captionStyle?.template_markup
                                || ''
                              }
                              impWordIndex={Number(emotionalCaptionPlan.get(caption?.id)?.impWordIndex ?? caption?.imp_word_index ?? -1)}
                              impWordIndices={emotionalCaptionPlan.get(caption?.id)?.impWordIndices || caption?.imp_word_indices || []}
                              emphasisColor={canvasTemplateEmphasisColor}
                              previewLineTexts={caption?.preview_template_line_texts || []}
                              textColor={templateTextColor}
                              textGradient={effectiveTemplateStyle?.text_gradient || ''}
                              accentColor={templateAccentColor}
                              highlightGradient={effectiveTemplateStyle?.highlight_gradient || ''}
                              karaokeColor1={effectiveTemplateStyle?.karaoke_color_1 || templateAccentColor || '#DDAA03'}
                              karaokeColor2={effectiveTemplateStyle?.karaoke_color_2 || '#22D3EE'}
                              karaokeColor3={effectiveTemplateStyle?.karaoke_color_3 || '#FB923C'}
                              backgroundColor={effectiveTemplateStyle?.background_color || 'transparent'}
                              colorsCustomized={templateColorsCustomized}
                              currentTime={getCaptionCptRenderTime(caption)}
                              isPlaying={isPlaying}
                              startTime={caption.start_time || caption.start || 0}
                              endTime={caption.end_time || caption.end || caption.start_time || 0}
                              renderScale={previewRenderScale}
                              onSourceWordClick={openSourceTemplateWordPopup}
                              onSourceWordPointerDown={startSourceTemplateWordDrag}
                              isSelected={selectedCaptionId === caption.id}
                            />
                          );
                        }

                        const words = isBasicSourceTemplate
                          ? basicTemplateWords
                          : caption.text.split(' ');
                        const wordCount = words.length;
                        const isAdvancedTemplate = isAdvancedTemplateId(activeCaptionTemplateId);
                        // Compute which word index is currently being spoken
                        const currentIdx = isBasicSourceTemplate
                          ? basicTemplateCurrentIdx
                          : getCaptionCurrentWordIndex(caption, wordCount);

                        if (activeCaptionTemplateId === 't-QW1') {
                          return (
                            <span className="sblock t-QW1">
                              <span className="sw-line v32-sw">
                                {words.map((word, wordIndex) => {
                                  const wordStyle = caption.wordStyles?.[`${caption.id}-${wordIndex}`] || {};
                                  const isSelected = wordPopup?.caption?.id === caption.id
                                    && wordPopup?.wordIndex === wordIndex;
                                  const wordAnimation = wordStyle.animation && wordStyle.animation !== 'none'
                                    ? getWordAnimationStyle(wordStyle.animation, wordStyle.animationSpeed || 1)
                                    : 'none';
                                  const cptMotionStyle = getCptWordMotionStyle(
                                    caption,
                                    wordStyle,
                                    wordIndex,
                                    wordCount,
                                    currentIdx,
                                    { templateBlockType: 'wbw-rise' },
                                  );
                                  const resolvedWordMotionStyle = cptMotionStyle || { animation: wordAnimation };
                                  return (
                                    <span
                                      key={`${wordIndex}-${basicTemplateCurrentIdx}`}
                                      data-word-key={`${caption.id}-${wordIndex}`}
                                      className={[
                                        'sw-w',
                                        wordIndex < basicTemplateCurrentIdx ? 'done active' : '',
                                        wordIndex === basicTemplateCurrentIdx ? 'current active' : '',
                                        isSelected ? 'ring-2 ring-[#F5A623] rounded-sm' : '',
                                      ].filter(Boolean).join(' ')}
                                      style={{
                                        '--basic-word-index': wordIndex,
                                        '--basic-word-delay': `${Math.min(wordIndex, 10) * 80}ms`,
                                        opacity: isCptWordPending(caption, wordIndex, currentIdx) ? 0 : undefined,
                                        cursor: 'pointer',
                                        animation: cptMotionStyle ? 'none' : undefined,
                                        transition: cptMotionStyle ? 'none' : undefined,
                                      }}
                                      onClick={(e) => {
                                        if (setWordPopup) {
                                          e.stopPropagation();
                                          setWordPopup({
                                            word,
                                            position: { x: e.clientX, y: e.clientY },
                                            caption,
                                            wordIndex,
                                          });
                                        }
                                      }}
                                    >
                                      <span
                                        data-word-drag-visual="true"
                                        style={{
                                          display: 'inline-block',
                                          transformOrigin: 'center center',
                                          ...resolvedWordMotionStyle,
                                        }}
                                      >
                                        {renderWordTextContent(word, wordStyle, 'inherit')}
                                      </span>
                                    </span>
                                  );
                                })}
                              </span>
                            </span>
                          );
                        }

                        const renderedWords = words.map((word, wordIndex, arr) => {
                          const isPast    = wordIndex < currentIdx;
                          const isCurrent = wordIndex === currentIdx;

                          const wordStyle = caption.wordStyles?.[`${caption.id}-${wordIndex}`] || {};
                          let cls = isSourceBasicTemplateId(activeCaptionTemplateId)
                            ? getBasicTemplateWordClassName(activeCaptionTemplateId, isPast, isCurrent, wordStyle?.isEmphasis)
                            : 'word';
                          if (!isSourceBasicTemplateId(activeCaptionTemplateId)) {
                            if (isCurrent) cls += ' current active';
                            else if (isPast) cls += ' active done';
                            if (wordStyle?.isEmphasis) cls += ' imp';
                          }
                          if (isAdvancedTemplate) {
                            const shouldShowAdvancedWord = captionStyle?.show_inactive !== false || !isPlaying || isPast || isCurrent;
                            cls = ['w', shouldShowAdvancedWord ? 'in' : '', wordStyle?.isEmphasis ? 'imp-bold' : '']
                              .filter(Boolean)
                              .join(' ');
                          }
                          const detached = isWordDetached(wordStyle);

                          // Word-by-word delivery mode: accumulate — show words 0..currentIdx
                          if (shouldRevealSequentially(caption) && wordIndex > currentIdx) {
                            return null;
                          }

                          const isSelected = wordPopup?.caption?.id === caption.id
                            && wordPopup?.wordIndex === wordIndex;
                          const wordAnimation = wordStyle.animation && wordStyle.animation !== 'none'
                            ? getWordAnimationStyle(wordStyle.animation, wordStyle.animationSpeed || 1)
                            : 'none';
                          const cptMotionStyle = getCptWordMotionStyle(
                            caption,
                            wordStyle,
                            wordIndex,
                            wordCount,
                            currentIdx,
                            {
                              templateBlockType: getOriginalTemplateBlockType(
                                activeCaptionTemplateId,
                                Number(caption?.template_phase_index ?? 0),
                              ),
                              templateSource: caption?.template_source || captionStyle?.template_source,
                            },
                          );
                          const resolvedWordMotionStyle = cptMotionStyle || { animation: wordAnimation };

                          return (
                            <span
                              key={`${wordIndex}-${isBasicSourceTemplate ? basicTemplateCurrentIdx : 'static'}`}
                              data-word-key={detached ? undefined : `${caption.id}-${wordIndex}`}
                              className={cls + (isSelected ? ' ring-2 ring-[#F5A623] rounded-sm' : '')}
                              style={{
                                cursor: detached
                                  ? 'default'
                                  : (draggingWord?.captionId === caption.id && draggingWord?.wordIndex === wordIndex ? 'grabbing' : 'pointer'),
                                display: 'inline-block',
                                opacity: isCptWordPending(caption, wordIndex, currentIdx) ? 0 : undefined,
                                marginRight: wordIndex < words.length - 1 ? `${(captionStyle?.word_spacing ?? 1) * 2}px` : '0',
                                maxWidth: '100%',
                                whiteSpace: String(word || '').includes('\n') ? 'pre-wrap' : (shouldWrapCaption ? 'normal' : 'nowrap'),
                                overflowWrap: shouldWrapCaption ? 'anywhere' : 'normal',
                                visibility: detached ? 'hidden' : 'visible',
                                '--basic-word-index': wordIndex,
                                '--basic-word-delay': `${Math.min(wordIndex, 10) * 65}ms`,
                                animation: cptMotionStyle ? 'none' : undefined,
                                transition: cptMotionStyle ? 'none' : undefined,
                              }}
                              onClick={(e) => {
                                if (detached) return;
                                if (setWordPopup) {
                                  e.stopPropagation();
                                  setWordPopup({
                                    word,
                                    position: { x: e.clientX, y: e.clientY },
                                    caption,
                                    wordIndex,
                                  });
                                }
                              }}
                            >
                              <span
                                data-word-drag-visual="true"
                                style={{
                                  display: 'inline-block',
                                  transformOrigin: 'center center',
                                  ...resolvedWordMotionStyle,
                                }}
                              >
                                {renderWordTextContent(word, wordStyle, 'inherit')}
                              </span>
                              {wordIndex < arr.length - 1 ? ' ' : ''}
                            </span>
                          );
                        });

                        return isAdvancedTemplate ? (
                          <span className={getTemplateVariantClassName(activeCaptionTemplateId)}>
                            {renderedWords}
                          </span>
                        ) : renderedWords;
                      })()}
                    </span>
                  ) : (
                    // Custom rendering: complex word-level inline styles with backgrounds and offsets
                    <span
                      className={`cap-text${caption.animation ? ` animate-${caption.animation}` : ''}`}
                      style={{
                        fontFamily: captionStyle?.font_family || 'Inter',
                        fontSize: `${(captionStyle?.font_size || 18) * previewRenderScale}px`,
                        lineHeight: `${(captionStyle?.font_size || 18) * previewRenderScale * (captionStyle?.line_spacing || 1.4)}px`,
                        fontWeight: captionStyle?.font_weight || 'normal',
                        fontStyle: captionStyle?.font_style || 'normal',
                        textAlign: captionStyle?.text_align || 'center',
                        display: 'block',
                        letterSpacing: captionStyle?.letter_spacing ? `${captionStyle.letter_spacing * previewRenderScale}px` : '0px',
                        wordSpacing: `${(captionStyle?.word_spacing ?? 0) * previewRenderScale}px`,
                        textDecoration: captionStyle?.text_decoration || 'none',
                        opacity: captionStyle?.text_opacity ?? 1,
                        transform: `scale(${captionStyle?.scale || 1})`,

                        animation: captionHasCptWords(caption)
                          ? 'none'
                          : (caption.animation && caption.animation !== 'none' ? getAnimationStyle(caption.animation, caption.animationSpeed) : 'none'),
                        color: captionStyle?.text_color || '#ffffff',
                        textTransform: captionStyle?.text_case && captionStyle.text_case !== 'none' ? captionStyle.text_case : undefined,
                        // Keep the sentence's original layout after a word is
                        // detached; its own overlay is positioned separately.
                        padding: `${displayCaptionPadY}px ${displayCaptionPadX}px`,
                        position: 'relative',
                        zIndex: 10,
                        whiteSpace: caption.text?.includes('\n') ? 'pre-wrap' : ((shouldWrapCaption || captionStyle?.boxWidth) ? 'normal' : 'nowrap'),
                        wordBreak: 'normal',
                        // Add shadow/stroke if configured
                        ...(() => {
                          const efx = computeEffectCSS(captionStyle);
                          return {
                            // `??` not `||` — zero offsets/blur are how glow and offset-only
                            // shadow templates (t-9, t-12, t-57, t-109, t-124) are authored.
                            textShadow: efx.textShadow || (captionStyle?.has_shadow && !captionStyle?.text_gradient ? `${captionStyle?.shadow_offset_x ?? 0}px ${captionStyle?.shadow_offset_y ?? 2}px ${captionStyle?.shadow_blur ?? 4}px ${captionStyle?.shadow_color || 'rgba(0,0,0,0.8)'}` : undefined),
                            WebkitTextStroke: efx.WebkitTextStroke || (captionStyle?.has_stroke === true && !captionStyle?.text_gradient ? `${captionStyle?.stroke_width || 0.5}px ${captionStyle?.stroke_color || '#000000'}` : '0px transparent'),
                          };
                        })(),
                        // Add background or highlight if configured
                        ...(!isSidebarTemplate ? (
                          captionStyle?.highlight_gradient ? {
                            backgroundImage: captionStyle.highlight_gradient
                          } : captionStyle?.highlight_color ? {
                            backgroundColor: captionStyle.highlight_color
                          } : {}
                        ) : {}),
                        // Global text gradient
                        ...(captionStyle?.text_gradient ? {
                          backgroundImage: captionStyle.text_gradient,
                          WebkitBackgroundClip: 'text',
                          backgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          color: 'transparent'
                        } : {})
                      }}
                    >
                      {(() => {
                        const sidebarTemplateActive = hasSidebarTemplateStyle(captionStyle);
                        const sidebarWords = caption.text.split(' ');
                        const sidebarCurrentIdx = getCaptionCurrentWordIndex(caption, sidebarWords.length);
                        const sidebarAccent = captionStyle?.secondary_color || '#DDAA03';

                        return sidebarWords.map((word, wordIndex, arr) => {
                        // Word-by-word mode: compute current word index from timing
                        if (shouldRevealSequentially(caption)) {
                          const currentIdx = getCaptionCurrentWordIndex(caption, arr.length)
                          // Accumulate: show words 0..currentIdx (sentence builds word by word)
                          if (wordIndex > currentIdx) return null
                        }
                        const styleKey = `${caption.id}-${wordIndex}`;
                        const ws = caption.wordStyles?.[styleKey] || {};
                        const isSelected = wordPopup?.caption?.id === caption.id && wordPopup?.wordIndex === wordIndex;
                        const baseFontSize = (captionStyle?.font_size || 18) * previewRenderScale;
                        const rawWordFontSize = ws.fontSize || ws.frozenFontSize || (captionStyle?.font_size || 18);
                        const wordFontSize = rawWordFontSize * previewRenderScale;
                        const { x: renderOffsetX, y: renderOffsetY, isPositioned } = getWordRenderOffset(ws);
                        const detached = isWordDetached(ws);
                        const layoutFontSize = baseFontSize;
                        const isPastSidebarWord = sidebarTemplateActive && wordIndex < sidebarCurrentIdx;
                        const isCurrentSidebarWord = sidebarTemplateActive && wordIndex === sidebarCurrentIdx;
                        if (detached) {
                          return (
                            <span
                              key={wordIndex}
                              aria-hidden="true"
                              style={{
                                display: 'inline-block',
                                position: 'relative',
                                fontSize: `${layoutFontSize}px`,
                                lineHeight: 'inherit',
                                verticalAlign: 'baseline',
                                marginRight: wordIndex < arr.length - 1 ? `${Math.round(layoutFontSize * 0.18 + (captionStyle?.word_spacing ?? 1) * 2)}px` : '0',
                              }}
                            >
                              <span
                                style={{
                                  position: 'absolute',
                                  top: '50%',
                                  left: '50%',
                                  transform: 'translate(-50%, -50%)',
                                  opacity: 0,
                                  pointerEvents: 'none',
                                  whiteSpace: String(word || '').includes('\n') ? 'pre-wrap' : 'nowrap',
                                  fontSize: `${wordFontSize}px`,
                                }}
                              >
                                {word}
                              </span>
                              <span style={{ visibility: 'hidden', fontSize: `${layoutFontSize}px`, whiteSpace: 'pre' }}>
                                {word}
                              </span>
                            </span>
                          );
                        }
                        // Keep line layout stable at the base caption size.
                        // Visual word styling happens in the absolutely-positioned inner span.

                        // Emphasis: bold + 1.2x scale + configured accent color + subtle glow
                        const emphasisAccent = captionStyle?.secondary_color || '#DDAA03';
                        const emphasisStyle = ws.isEmphasis ? {
                          fontWeight: 'bold',
                          color: ws.color || emphasisAccent,
                          fontSize: `${Math.round(wordFontSize * 1.2)}px`,
                          textShadow: `0 0 18px ${emphasisAccent}99, 0 0 6px ${emphasisAccent}66`,
                        } : {};
                        const sidebarWordStyle = sidebarTemplateActive ? {
                          color: ws.color || (isCurrentSidebarWord ? sidebarAccent : (captionStyle?.text_color || '#ffffff')),
                          opacity: isCurrentSidebarWord ? 1 : (isPastSidebarWord ? 0.96 : 0.46),
                          textShadow: isCurrentSidebarWord ? `0 0 18px ${sidebarAccent}33` : undefined,
                        } : {};
                        const cptMotionStyle = getCptWordMotionStyle(
                          caption,
                          ws,
                          wordIndex,
                          arr.length,
                          sidebarCurrentIdx,
                          {
                            templateSource: captionStyle?.template_source,
                          },
                        );
                        const resolvedWordMotionStyle = cptMotionStyle || {
                              animation: ws.animation && ws.animation !== 'none'
                                ? getWordAnimationStyle(ws.animation)
                                : 'none',
                            };


                        const wordNode = (
                          <span
                            key={wordIndex}
                            data-word-key={`${caption.id}-${wordIndex}`}
                            style={{
                              display: 'inline-block',
                              position: 'relative',
                              fontSize: `${layoutFontSize}px`,
                              lineHeight: 'inherit',
                              verticalAlign: 'baseline',
                              marginRight: wordIndex < arr.length - 1 ? `${Math.round(layoutFontSize * 0.18 + (captionStyle?.word_spacing ?? 1) * 2)}px` : '0',
                              opacity: isCptWordPending(caption, wordIndex, sidebarCurrentIdx) ? 0 : undefined,
                              animation: cptMotionStyle ? 'none' : undefined,
                              transition: cptMotionStyle ? 'none' : undefined,
                              transform: !detached && isPositioned
                                ? `translate(${renderOffsetX}px, ${renderOffsetY}px)`
                                : 'none',
                              zIndex: !detached && isPositioned ? 20 : 'auto',
                              cursor: detached
                                ? 'default'
                                : (draggingWord?.captionId === caption.id && draggingWord?.wordIndex === wordIndex ? 'grabbing' : 'default'),
                            }}
                            onPointerDown={detached ? undefined : (e) => handleCaptionWordPointerIntent(
                              e,
                              caption,
                              wordIndex,
                              word,
                            )}
                            onClick={(e) => {
                              if (Date.now() - lastDragDropTime.current < 150) return;
                              if (setWordPopup) {
                                e.stopPropagation();
                                setWordPopup({
                                  word: word,
                                  position: { x: e.clientX, y: e.clientY },
                                  caption: caption,
                                  wordIndex: wordIndex
                                });
                              }
                            }}
                          >
                            {/* Fixed-size selection ring — sized by spacer, never by fontSize */}
                            {isSelected && (
                              <span style={{
                                position: 'absolute',
                                inset: '-2px',
                                border: '2px solid #F5A623',
                                borderRadius: '3px',
                                pointerEvents: 'none',
                                zIndex: 30,
                              }} />
                            )}
                            {/* Inner span: all visual styles. Absolute so it never affects layout flow */}
                            <span
                              data-word-drag-visual="true"
                              style={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                transform: isCurrentSidebarWord ? 'translate(-50%, -50%) scale(1.03)' : 'translate(-50%, -50%)',
                                whiteSpace: String(word || '').includes('\n') ? 'pre-wrap' : 'nowrap',
                                fontFamily: ws.fontFamily || 'inherit',
                                fontSize: `${wordFontSize}px`,
                                fontWeight: ws.fontWeight || (isCurrentSidebarWord ? (captionStyle?.font_weight || '700') : 'inherit'),
                                fontStyle: ws.fontStyle || 'inherit',
                                textDecoration: ws.textDecoration || 'inherit',
                                textTransform: ws.textTransform || undefined,
                                color: ws.color || sidebarWordStyle.color || 'inherit',
                                ...(sidebarTemplateActive ? sidebarWordStyle : {}),
                                ...(ws.backgroundColor ? {
                                  backgroundColor: `rgba(${parseInt(ws.backgroundColor.slice(1,3),16)}, ${parseInt(ws.backgroundColor.slice(3,5),16)}, ${parseInt(ws.backgroundColor.slice(5,7),16)}, ${ws.backgroundOpacity ?? 0.6})`,
                                  borderRadius: '3px',
                                  padding: `${(ws.backgroundPadding || 2) * previewRenderScale}px ${4 * previewRenderScale}px`,
                                } : {}),
                                ...computeWordEffectCSS(ws),
                                ...emphasisStyle,
                                ...(ws.textGradient ? {
                                  background: ws.textGradient,
                                  backgroundImage: ws.textGradient,
                                  backgroundSize: '100% 100%',
                                  backgroundRepeat: 'no-repeat',
                                  backgroundPosition: 'center',
                                  WebkitBackgroundClip: 'text',
                                  backgroundClip: 'text',
                                  WebkitTextFillColor: 'transparent',
                                  color: 'transparent',
                                } : {}),
                                ...resolvedWordMotionStyle,
                              }}
                            >
                              {word}
                            </span>
                            {/* Invisible spacer — holds layout width at layoutFontSize (baseFontSize for dragged words) */}
                            <span style={{ visibility: 'hidden', fontSize: `${layoutFontSize}px`, whiteSpace: 'pre' }}>
                              {word}
                            </span>
                          </span>
                        );

                        return wordNode;
                      });
                      })()}
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {detachedCaptionWordOverlays}

          {/* Text Elements (render above captions) */}
          {activeTextElements.map((element) => {
            const style = element.customStyle || {};
            const isEditingThis = isEditing === element.id;
            const textElementMetrics = getTextElementDisplayMetrics(style);
            const textElementEffects = getTextElementEffectCSS(style);

            const handleDeleteElement = (e) => {
              e.stopPropagation();
              e.preventDefault();
              if (setCaptions) {
                setCaptions(prev => prev.filter(c => c.id !== element.id));
              }
            };

            return (
              <div
                key={element.id}
                data-text-element-layer="true"
                className={`absolute group ${draggedElementId === element.id ? 'cursor-grabbing' : 'cursor-grab'}`}
                style={{
                  top: `${style.top || 50}%`,
                  left: `${style.left || 50}%`,
                  transform: `translate(-50%, -50%)${style.rotation ? ` rotate(${style.rotation}deg)` : ''}`,
                  transformOrigin: 'center center',
                  width: `${(style.width || 300) * previewRenderScale}px`,
                  zIndex: style.zIndex || 50
                }}
                onPointerDown={(e) => {
                  if (!isEditingThis) {
                    // Set this text element as selected
                    if (setSelectedCaptionId) setSelectedCaptionId(element.id);
                    handleTextElementMouseDown(e, element.id, style);
                  }
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (setSelectedCaptionId) setSelectedCaptionId(element.id);
                }}
                onDoubleClick={(e) => handleCaptionDoubleClick(e, element)}
              >
                <div
                  className={`border border-solid ${selectedCaptionId === element.id ? 'border-[#b76cff]' : 'border-transparent hover:border-[#b76cff]'} relative ${draggedElementId === element.id ? 'cursor-grabbing' : isEditingThis ? 'cursor-text' : 'cursor-grab'}`}
                  style={{
                    width: '100%',
                    backgroundColor: 'transparent',
                    padding: '0px',
                    textAlign: style.textAlign || 'center',
                    maxWidth: '90vw',
                    position: 'relative',
                    display: 'inline-block',
                  }}
                >
                  {style.hasBackground !== false && element.type !== 'textbox' && (
                    <div
                      style={{
                        position: 'absolute',
                        top: `-${textElementMetrics.backgroundPadding}px`,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: -1,
                        backgroundColor: style.backgroundColor
                          ? `rgba(${parseInt(style.backgroundColor.slice(1, 3), 16)}, ${parseInt(style.backgroundColor.slice(3, 5), 16)}, ${parseInt(style.backgroundColor.slice(5, 7), 16)}, ${style.backgroundOpacity ?? 0.7})`
                          : `rgba(0, 0, 0, ${style.backgroundOpacity ?? 0.7})`,
                        borderRadius: `${style.borderRadius || 6}px`,
                        width: `${100 * textElementMetrics.backgroundWidthMultiplier}%`,
                        height: `calc(100% + ${2 * textElementMetrics.backgroundPadding}px)`,
                      }}
                    />
                  )}

                {/* Delete button - always visible on hover */}
                {!isEditingThis && (
                  <button
                    className="absolute -top-2.5 -right-2.5 w-6 h-6 bg-zinc-900 border border-white/20 hover:border-red-500/50 hover:bg-red-500/10 rounded-full opacity-0 group-hover:opacity-100 transition-all z-50 flex items-center justify-center shadow-xl text-gray-400 hover:text-red-500"
                    onClick={handleDeleteElement}
                    title="Delete text element"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Resize handles - show for all active text elements */}
                {!isEditingThis && (
                  <>
                    {[
                      ['top-left', 'left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize w-3 h-3 rounded-full'],
                      ['top-right', 'right-0 top-0 -translate-y-1/2 translate-x-1/2 cursor-nesw-resize w-3 h-3 rounded-full'],
                      ['bottom-left', 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize w-3 h-3 rounded-full'],
                      ['bottom-right', 'bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize w-3 h-3 rounded-full'],
                      ['left', 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize w-2 h-4.5 rounded-full'],
                      ['right', 'right-0 top-1/2 -translate-y-1/2 translate-x-1/2 cursor-ew-resize w-2 h-4.5 rounded-full'],
                    ].map(([edge, positionAndShapeClass]) => (
                      <div
                        key={edge}
                        className={`text-resize-handle absolute z-50 border border-[#b76cff] bg-white shadow-[0_0_0_1px_rgba(255,255,255,0.7)] ${positionAndShapeClass} transition-opacity ${selectedCaptionId === element.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                        data-resize-edge={edge}
                        onPointerDown={(e) => handleTextElementResizeDown(e, element.id, style)}
                        style={{ touchAction: 'none' }}
                      />
                    ))}
                  </>
                )}

                {isEditingThis ? (
                  <div
                    ref={inputRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={handleEditInput}
                    onBlur={() => handleEditComplete(element.id)}
                    onKeyDown={handleEditKeyDown}
                    className="bg-transparent border-none outline-none text-center relative z-10"
                    style={{
                      fontFamily: style.fontFamily || 'Inter',
                      fontSize: `${(style.fontSize || 18) * previewRenderScale}px`,
                      textAlign: style.textAlign || 'center',
                      fontWeight: style.fontWeight || '800',
                      fontStyle: style.fontStyle || 'normal',
                      textDecoration: style.textDecoration || 'none',
                      textTransform: style.textTransform || 'none',
                      letterSpacing: style.letterSpacing ? `${style.letterSpacing * previewRenderScale}px` : '0px',
                      wordSpacing: `${(style.wordSpacing ?? 0) * previewRenderScale}px`,
                      lineHeight: style.lineSpacing || 1.4,
                      opacity: style.textOpacity ?? 1,
                      transform: `scale(${style.scale || 1})`,
                      padding: `${textElementMetrics.textPadY}px ${textElementMetrics.textPadX}px`,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                      minHeight: '40px',
                      ...textElementEffects,
                      ...(style.textGradient ? {
                        backgroundImage: style.textGradient,
                        WebkitBackgroundClip: 'text',
                        backgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        color: 'transparent',
                        display: 'block',
                      } : {
                        color: style.color || '#ffffff',
                      }),
                    }}
                  >
                    {editText}
                  </div>
                ) : (
                  <div
                    className={element.animation ? `animate-${element.animation}` : ''}
                    style={{
                      fontFamily: style.fontFamily || 'Inter',
                      fontSize: `${(style.fontSize || 18) * previewRenderScale}px`,
                      textAlign: style.textAlign || 'center',
                      textTransform: style.textTransform || 'none',
                      fontWeight: style.fontWeight || '800',
                      fontStyle: style.fontStyle || 'normal',
                      letterSpacing: style.letterSpacing ? `${style.letterSpacing * previewRenderScale}px` : '0px',
                      wordSpacing: `${(style.wordSpacing ?? 0) * previewRenderScale}px`,
                      lineHeight: style.lineSpacing || 1.4,
                      textDecoration: style.textDecoration || 'none',
                      opacity: style.textOpacity ?? 1,
                      transform: `scale(${style.scale || 1})`,
                      padding: `${textElementMetrics.textPadY}px ${textElementMetrics.textPadX}px`,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                      animation: element.animation && element.animation !== 'none' ? getAnimationStyle(element.animation, element.animationSpeed) : 'none',
                      ...textElementEffects,
                      ...(style.textGradient ? {
                        backgroundImage: style.textGradient,
                        WebkitBackgroundClip: 'text',
                        backgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        color: 'transparent',
                      } : {
                        color: style.color || '#ffffff',
                      }),
                    }}
                  >
                    {/* Render words individually with per-word styling */}
                    {Number(style.width || 0) < 80 ? (element.text || '') : (element.text || '').split(/(\s+|\n)/).map((part, i) => {
                      if (part === '\n') return <br key={i} />;
                      if (part.match(/^\s+$/)) return <span key={i}>{part}</span>;

                      const words = (element.text || '').split(/\s+/);
                      const wordIndex = words.indexOf(part);
                      const wordStyle = element.wordStyles?.[`${element.id}-${wordIndex}`] || {};
                      const isWordClicked = wordPopup?.type === 'element' && wordPopup?.elementId === element.id && wordPopup?.wordIndex === wordIndex;
                      // Extract transform to parent - ensures text + background move together
                      const { animation, ...restWordStyle } = wordStyle;
                      const { x: renderOffsetX, y: renderOffsetY } = getWordRenderOffset(wordStyle);

                      return (
                        <span
                          key={i}
                          data-word-key={`${element.id}-${wordIndex}`}
                          style={{
                            display: 'inline-block',
                            position: 'relative',
                            transform: `translate(${renderOffsetX}px, ${renderOffsetY}px)`,
                            transition: draggingWord ? 'none' : 'transform 0.1s ease',
                            cursor: draggingWord?.captionId === element.id && draggingWord?.wordIndex === wordIndex ? 'grabbing' : 'default',
                            height: `${(style.fontSize || 18) * 1.4}px`,
                            verticalAlign: 'top',
                          }}
                          onPointerDown={(e) => handleWordMouseDown(e, element, wordIndex, true)}
                          onClick={(e) => {
                            if (Date.now() - lastDragDropTime.current < 150) return;
                            if (setWordPopup) {
                              e.stopPropagation();
                              setWordPopup({
                                type: 'element',
                                word: part,
                                elementId: element.id,
                                position: { x: e.clientX, y: e.clientY },
                                caption: null,
                                wordIndex
                              });
                            }
                          }}
                        >
                          {/* Spacer: reserves original space based on element's base font */}
                          <span
                            style={{
                              visibility: 'hidden',
                              fontFamily: style.fontFamily || 'Inter',
                              fontSize: `${(style.fontSize || 18) * previewRenderScale}px`,
                              fontWeight: style.fontWeight || 'normal',
                              whiteSpace: 'pre',
                            }}
                          >
                            {part}
                          </span>

                          {/* Absolute container centers text + background group */}
                          <span
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              height: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              pointerEvents: 'none',
                            }}
                          >
                            {/* UNIFIED GROUP: Background wraps text - both move with parent transform */}
                            <span
                              className={animation ? `animate-${animation}` : ''}
                              style={{
                                pointerEvents: 'auto',
                                position: 'relative',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                animation: animation && animation !== 'none' ? getAnimationStyle(animation, wordStyle.animationSpeed) : 'none',
                              }}
                            >
                              {/* BACKGROUND LAYER - Fixed padding, independent of text size */}
                              <span
                                style={{
                                  position: 'absolute',
                                  top: -2,
                                  left: -4,
                                  right: -4,
                                  bottom: -2,
                                  zIndex: -1,
                                  borderRadius: restWordStyle.backgroundColor || isWordClicked ? '4px' : undefined,
                                  backgroundColor: restWordStyle.backgroundColor
                                    ? `rgba(${parseInt(restWordStyle.backgroundColor.slice(1, 3), 16)}, ${parseInt(restWordStyle.backgroundColor.slice(3, 5), 16)}, ${parseInt(restWordStyle.backgroundColor.slice(5, 7), 16)}, ${restWordStyle.backgroundOpacity ?? 0.6})`
                                    : (isWordClicked ? 'rgba(245, 166, 35, 0.24)' : undefined),
                                  border: isWordClicked ? '1px solid rgba(245, 166, 35, 0.9)' : '1px solid transparent',
                                }}
                              />

                              {/* TEXT LAYER */}
                              <span
                                style={{
                                  fontFamily: restWordStyle.fontFamily || style.fontFamily || 'Inter',
                                  fontSize: restWordStyle.fontSize ? `${restWordStyle.fontSize * previewRenderScale}px` : `${(style.fontSize || 18) * previewRenderScale}px`,
                                  fontWeight: restWordStyle.fontWeight || style.fontWeight || 'normal',
                                  fontStyle: restWordStyle.fontStyle || style.fontStyle || 'normal',
                                  textDecoration: restWordStyle.textDecoration || style.textDecoration || 'none',
                                  textTransform: restWordStyle.textTransform || style.textTransform || 'none',
                                  color: restWordStyle.color || style.color || '#ffffff',
                                  padding: restWordStyle.backgroundPadding ? `${restWordStyle.backgroundPadding}px` : (isWordClicked ? '2px 4px' : undefined),
                                  whiteSpace: 'pre',
                                  ...(style.hasStroke ? { WebkitTextStroke: `${style.strokeWidth || 1}px ${style.strokeColor || '#000000'}` } : {}),
                                  ...(style.hasShadow ? { textShadow: `${style.shadowOffsetX || 0}px ${style.shadowOffsetY || 2}px ${style.shadowBlur || 4}px ${style.shadowColor || 'rgba(0,0,0,0.8)'}` } : {}),
                                  ...(restWordStyle.textGradient ? {
                                    background: restWordStyle.textGradient,
                                    backgroundImage: restWordStyle.textGradient,
                                    backgroundSize: '100% 100%',
                                    backgroundRepeat: 'no-repeat',
                                    backgroundPosition: 'center',
                                    WebkitBackgroundClip: 'text',
                                    backgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    color: 'transparent',
                                  } : {}),
                                }}
                              >
                                {part}
                              </span>
                            </span>
                          </span>
                        </span>
                      );
                    })}
                  </div>
                )}
              {/* Action buttons below the bounding box */}
              {selectedCaptionId === element.id && !isEditingThis && (
                <div
                  className="absolute left-1/2 top-full z-50 mt-3.5 flex -translate-x-1/2 items-center gap-2"
                  style={{ pointerEvents: 'auto' }}
                  data-video-control
                >
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-full border border-[#d8d2e8] bg-white text-[#4f4f5a] shadow-[0_2px_5px_rgba(15,15,20,0.16)] transition-transform hover:scale-105"
                    style={{ cursor: 'grab' }}
                    onPointerDown={(e) => handleTextElementRotateStart(e, element.id, style)}
                    title="Rotate text"
                    data-video-control
                  >
                    <RotateCw className="h-3.5 w-3.5 text-[#4f4f5a]" strokeWidth={2} />
                  </span>
                  <span
                    className="text-element-move-btn flex h-6 w-6 items-center justify-center rounded-full border border-[#d8d2e8] bg-white text-[#4f4f5a] shadow-[0_2px_5px_rgba(15,15,20,0.16)] transition-transform hover:scale-105"
                    style={{ cursor: 'move' }}
                    onPointerDown={(e) => {
                      handleTextElementMouseDown(e, element.id, style);
                    }}
                    title="Move text"
                    data-video-control
                  >
                    <Move className="h-3.5 w-3.5 text-[#4f4f5a]" strokeWidth={2} />
                  </span>
                </div>
              )}
              </div>
              </div>
            );
          })}

          <div
            className="absolute left-1/2 bottom-3 z-40 w-[82%] max-w-[248px] -translate-x-1/2"
            data-video-control
          >
            <Slider
              value={[localScrubTime ?? currentTime]}
              max={duration || 100}
              step={0.1}
              onValueChange={([val]) => {
                isScrubbingRef.current = true;
                setLocalScrubTime(val);
              }}
              onValueCommit={([val]) => {
                isScrubbingRef.current = false;
                setLocalScrubTime(null);
                if (videoRef.current) videoRef.current.currentTime = val;
                setCurrentTime(val);
              }}
              className="cursor-pointer"
              trackClassName="h-[4px] bg-white/24"
              rangeClassName="h-[4px] bg-white"
              thumbClassName="h-3 w-3 border border-white bg-[#050505] shadow-[0_0_0_1.5px_#ffffff,0_0_0_3px_rgba(5,5,5,0.82),0_5px_12px_rgba(0,0,0,0.24)]"
            />
          </div>

          {/* Word Click Popup — REMOVED FROM HERE, rendered outside overflow-hidden below */}

          </div>
        </div>
      </div>

      <div className={`${isVideoFullscreen ? 'mt-3' : 'mt-3'} space-y-3 px-2`}>
        <div className="mx-auto lekha-glass-chip rounded-full px-2.5 py-1.5 flex w-fit items-center gap-2.5">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleVideoSurfaceToggle}
              className="h-7 w-7 rounded-full hover:bg-white/10 text-white"
              data-video-control="true"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </Button>

            <div className="flex items-center gap-2 group">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMuted(!isMuted)}
                className="h-7 w-7 text-gray-400 hover:text-white hover:bg-white/10"
              >
                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </Button>
              <div className="w-0 overflow-hidden group-hover:w-24 pl-2 transition-all duration-300 ease-in-out">
                <Slider
                  value={[isMuted ? 0 : volume]}
                  max={1}
                  step={0.05}
                  onValueChange={([val]) => {
                    setVolume(val);
                    if (val > 0) setIsMuted(false);
                  }}
                  className="w-20 cursor-pointer py-4"
                />
              </div>
            </div>
          </div>

          <span className="text-xs text-white font-mono tabular-nums">
            {formatTime(currentTime)}
          </span>
          <span className="text-[10px] text-slate-600 font-mono">/</span>
          <span className="text-[10px] text-slate-500 font-mono tabular-nums">
            {formatTime(duration || 0)}
          </span>
        </div>
      </div>

      {/* Word Click Popup — moved to Dashboard.jsx root level */}

      {/* Animation keyframes */}
      <style>{`
        @keyframes rise {
          0% { transform: translateY(20px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes pan {
          0% { transform: translateX(-30px); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }
        @keyframes fade {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes pop {
          0% { transform: scale(0.5); opacity: 0; }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes wipe {
          0% { clip-path: inset(0 100% 0 0); }
          100% { clip-path: inset(0 0 0 0); }
        }
        @keyframes blur {
          0% { filter: blur(10px); opacity: 0; }
          100% { filter: blur(0); opacity: 1; }
        }
        @keyframes succession {
          0% { transform: translateY(-10px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes breathe {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.9; }
        }
        @keyframes baseline {
          0% { transform: translateY(5px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes drift {
          0% { transform: translate(-10px, -10px); opacity: 0; }
          100% { transform: translate(0, 0); opacity: 1; }
        }
        @keyframes tectonic {
          0% { transform: translateX(-20px) rotate(-5deg); opacity: 0; }
          100% { transform: translateX(0) rotate(0); opacity: 1; }
        }
        @keyframes tumble {
          0% { transform: rotate(-180deg) scale(0.5); opacity: 0; }
          100% { transform: rotate(0) scale(1); opacity: 1; }
        }
        /* Word-level keyframes — include translate(-50%,-50%) in every step
           to preserve the inner span's centering transform */
        @keyframes word-rise {
          0% { transform: translate(-50%, calc(-50% + 20px)); opacity: 0; }
          100% { transform: translate(-50%, -50%); opacity: 1; }
        }
        @keyframes word-pan {
          0% { transform: translate(calc(-50% - 30px), -50%); opacity: 0; }
          100% { transform: translate(-50%, -50%); opacity: 1; }
        }
        @keyframes word-pop {
          0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
          50% { transform: translate(-50%, -50%) scale(1.1); }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
        @keyframes word-succession {
          0% { transform: translate(-50%, calc(-50% - 10px)); opacity: 0; }
          100% { transform: translate(-50%, -50%); opacity: 1; }
        }
        @keyframes word-breathe {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          50% { transform: translate(-50%, -50%) scale(1.05); opacity: 0.9; }
        }
        @keyframes word-baseline {
          0% { transform: translate(-50%, calc(-50% + 5px)); opacity: 0; }
          100% { transform: translate(-50%, -50%); opacity: 1; }
        }
        @keyframes word-drift {
          0% { transform: translate(calc(-50% - 10px), calc(-50% - 10px)); opacity: 0; }
          100% { transform: translate(-50%, -50%); opacity: 1; }
        }
        @keyframes word-tectonic {
          0% { transform: translate(calc(-50% - 20px), -50%) rotate(-5deg); opacity: 0; }
          100% { transform: translate(-50%, -50%) rotate(0); opacity: 1; }
        }
        @keyframes word-tumble {
          0% { transform: translate(-50%, -50%) rotate(-180deg) scale(0.5); opacity: 0; }
          100% { transform: translate(-50%, -50%) rotate(0) scale(1); opacity: 1; }
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
        /* ── Advanced – Basic ── */
        @keyframes zoom_in {
          0% { transform: scale(0.65); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes zoom_out {
          0% { transform: scale(1.35); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes fade_in {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes slide_up {
          0% { transform: translateY(34px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes slide_down {
          0% { transform: translateY(-34px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes slide_left {
          0% { transform: translateX(44px); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }
        @keyframes slide_right {
          0% { transform: translateX(-44px); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }
        @keyframes fadeInUp {
          0% { transform: translateY(22px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes fadeInDown {
          0% { transform: translateY(-22px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes slideInRight {
          0% { transform: translateX(40px); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }
        @keyframes flipInX {
          0% { transform: perspective(500px) rotateX(-90deg); opacity: 0; }
          100% { transform: perspective(500px) rotateX(0); opacity: 1; }
        }
        @keyframes flipInY {
          0% { transform: perspective(500px) rotateY(-90deg); opacity: 0; }
          100% { transform: perspective(500px) rotateY(0); opacity: 1; }
        }
        @keyframes blurIn {
          0% { filter: blur(14px); opacity: 0; }
          100% { filter: blur(0); opacity: 1; }
        }
        @keyframes zoomInFade {
          0% { transform: scale(0.65); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes bounceInUp {
          0%   { transform: translateY(32px); opacity: 0; }
          60%  { transform: translateY(-8px); opacity: 1; }
          80%  { transform: translateY(4px); }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes skewLeft {
          0% { transform: translateX(-30px) skewX(20deg); opacity: 0; }
          100% { transform: translateX(0) skewX(0deg); opacity: 1; }
        }
        /* ── Advanced – Kinetic ── */
        @keyframes missile {
          0%   { transform: translateX(-60px) scaleX(0.6); opacity: 0; }
          65%  { transform: translateX(6px) scaleX(1.04); opacity: 1; }
          100% { transform: translateX(0) scaleX(1); opacity: 1; }
        }
        @keyframes shockwave {
          0%   { transform: scale(1.6); opacity: 0; filter: blur(6px); }
          55%  { transform: scale(0.94); opacity: 1; filter: blur(0); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes typewriter {
          0%   { clip-path: inset(0 100% 0 0); }
          100% { clip-path: inset(0 0% 0 0); }
        }
        @keyframes slamDown {
          0%   { transform: translateY(-55px) scaleY(1.2); opacity: 0; }
          65%  { transform: translateY(6px) scaleY(0.94); opacity: 1; }
          100% { transform: translateY(0) scaleY(1); opacity: 1; }
        }
        @keyframes fireCharge {
          0%   { transform: translateY(18px) scaleX(0.8); opacity: 0; filter: blur(5px); }
          70%  { transform: translateY(-4px) scaleX(1.02); opacity: 1; filter: blur(0); }
          100% { transform: translateY(0) scaleX(1); opacity: 1; }
        }
        @keyframes stampede {
          0%   { transform: translateX(-55px) scaleX(1.1); opacity: 0; }
          70%  { transform: translateX(5px) scaleX(0.98); opacity: 1; }
          100% { transform: translateX(0) scaleX(1); opacity: 1; }
        }
        @keyframes recoil {
          0%   { transform: translateX(0); opacity: 1; }
          20%  { transform: translateX(-10px); }
          60%  { transform: translateX(4px); }
          100% { transform: translateX(0); opacity: 1; }
        }
        /* ── Advanced – Cinematic ── */
        @keyframes irisOpen {
          0%   { clip-path: circle(0% at 50% 50%); opacity: 0.4; }
          100% { clip-path: circle(150% at 50% 50%); opacity: 1; }
        }
        @keyframes parallaxRise {
          0%   { transform: translateY(14px) scale(0.97); opacity: 0; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes goldenRatio {
          0%   { transform: scaleX(0.618) translateX(-20px); opacity: 0; }
          100% { transform: scaleX(1) translateX(0); opacity: 1; }
        }
        @keyframes curtainSplit {
          0%   { clip-path: inset(0 50% 0 50%); opacity: 0.5; }
          100% { clip-path: inset(0 0% 0 0%); opacity: 1; }
        }
        @keyframes prestige {
          0%   { transform: scale(1.1); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes fadeThroughBlack {
          0%   { opacity: 1; }
          35%  { opacity: 0; }
          65%  { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes depthPull {
          0%   { transform: scale(0.35); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes slowBurn {
          0%   { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes diagonalWipe {
          0%   { clip-path: inset(0 100% 100% 0); }
          100% { clip-path: inset(0 0% 0% 0); }
        }
        /* ── Advanced – Playful ── */
        @keyframes confettiPop {
          0%   { transform: scale(0.3) rotate(-12deg); opacity: 0; }
          55%  { transform: scale(1.15) rotate(3deg); opacity: 1; }
          75%  { transform: scale(0.95) rotate(-1deg); }
          100% { transform: scale(1) rotate(0); opacity: 1; }
        }
        @keyframes stickerSlap {
          0%   { transform: scale(1.45) rotate(-6deg); opacity: 0; }
          45%  { transform: scale(0.94) rotate(1deg); opacity: 1; }
          75%  { transform: scale(1.02) rotate(0); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes wobbleEntry {
          0%   { transform: translateX(-22px) rotate(-4deg); opacity: 0; }
          35%  { transform: translateX(9px) rotate(2deg); opacity: 1; }
          65%  { transform: translateX(-4px) rotate(-1deg); }
          100% { transform: translateX(0) rotate(0); opacity: 1; }
        }
        @keyframes balloonFloat {
          0%   { transform: translateY(22px) scale(0.8); opacity: 0; }
          65%  { transform: translateY(-6px) scale(1.03); opacity: 1; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes colorSplash {
          0%   { transform: scale(0.85); opacity: 0; filter: saturate(3) brightness(1.6); }
          50%  { transform: scale(1.06); opacity: 1; filter: saturate(2) brightness(1.3); }
          100% { transform: scale(1); opacity: 1; filter: saturate(1) brightness(1); }
        }
      `}</style>

    </div>
    {selectedDetachedWordEditor}
    </>
  );
}
