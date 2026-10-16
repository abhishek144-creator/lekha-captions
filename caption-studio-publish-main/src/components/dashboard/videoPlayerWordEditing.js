import {
  getAppliedBasicCurrentWordIndex,
  isSourceBasicTemplateId,
} from './basicTemplateInline.js';
import { getCaptionWordRevealIndex } from './cptMotion.js';

export function getCaptionTemplateId(caption, fallbackStyle = {}) {
  return String(
    caption?.template_id
    || caption?.applied_template_style?.template_id
    || fallbackStyle?.template_id
    || ''
  ).trim();
}
export function wordHasCreativePosition(wordStyle = {}) {
  return (
    Math.abs(Number(wordStyle.abs_x_pct) || 0) > 0.01
    || Math.abs(Number(wordStyle.abs_y_pct) || 0) > 0.01
    || Math.abs(Number(wordStyle.x_pct) || 0) > 0.01
    || Math.abs(Number(wordStyle.y_pct) || 0) > 0.01
    || Math.abs(Number(wordStyle.x) || 0) > 0.01
    || Math.abs(Number(wordStyle.y) || 0) > 0.01
  )
}

export function captionHasCreativelyPositionedWords(caption) {
  return Object.values(caption?.wordStyles || {}).some(wordHasCreativePosition)
}

export function getCaptionRevealWordIndex(caption, currentTime, wordCount, templateId = '') {
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

export function computeEffectCSS(cs) {
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
export function computeWordEffectCSS(ws) {
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

// The resting frame of a CPT word: the same motion reset the export renderer
// applies to every word of a CPT caption (render_template_page_runtime.mjs).
const CPT_SETTLED_STYLE = [
  ['animation', 'none'],
  ['animation-delay', '0s'],
  ['animation-play-state', 'paused'],
  ['transition', 'none'],
  ['transform', 'none'],
  ['clip-path', 'none'],
  ['-webkit-clip-path', 'none'],
  ['filter', 'none'],
];

// While paused, a CPT caption (or one whose word is being dragged) shows every
// word at rest, exactly as it exports. Measuring a word mid-entrance made the
// drop land off the pointer and aligned guides to positions that never ship.
export function settleSourceTemplateWord(node) {
  if (!node) return;
  [node, ...node.querySelectorAll(SOURCE_TEMPLATE_VISUAL_SELECTOR)].forEach((target) => {
    CPT_SETTLED_STYLE.forEach(([property, value]) => setSourceTemplateStyle(target, property, value));
  });
  setSourceTemplateStyle(node, 'opacity', '1');
  node.dataset.cptSettled = 'true';
}

function unsettleSourceTemplateWord(node) {
  if (node?.dataset.cptSettled !== 'true') return;
  [node, ...node.querySelectorAll(SOURCE_TEMPLATE_VISUAL_SELECTOR)].forEach((target) => {
    CPT_SETTLED_STYLE.forEach(([property]) => target.style.removeProperty(property));
  });
  node.style.removeProperty('opacity');
  delete node.dataset.cptSettled;
}

// A word drag marks the canvas with the caption it is editing, so a re-render
// during the gesture keeps that caption at rest instead of restarting motion.
export function isCaptionCptDragActive(host, caption) {
  const dragCaptionId = host?.closest?.('[data-cpt-drag-caption]')?.dataset.cptDragCaption;
  return Boolean(caption && dragCaptionId === String(caption.id));
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

export function wireSourceTemplateWordEditing(
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
    const settleCaption = !isPlaying && (
      captionHasCreativelyPositionedWords(caption) || isCaptionCptDragActive(host, caption)
    );
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
      unsettleSourceTemplateWord(node);
      prepareSourceTemplateWordNode(node);
      const wordStyle = caption.wordStyles?.[styleKey] || {};
      applySourceTemplateWordStyle(
        node,
        wordStyle,
        renderScale,
        emphasisColor,
        hasCptWords,
      );
      // A word animation picked in the floating word editor keeps previewing.
      if (settleCaption && !(wordStyle.animation && wordStyle.animation !== 'none')) {
        settleSourceTemplateWord(node);
      }
      if (hasCptWords && isPlaying && index > currentIdx) {
        node.style.setProperty('opacity', '0', 'important');
      } else if (hasCptWords) {
        node.style.setProperty('opacity', '1', 'important');
      } else if (settleCaption) {
        node.style.setProperty('opacity', '1', 'important');
      } else {
        node.style.removeProperty('opacity');
      }
    });
  };

  decorate();
  const frame = window.requestAnimationFrame(decorate);

  // The pointer usually leaves a one-line caption within the first few pixels
  // of a drag, so the gesture is followed on the document, not only the host.
  const stopDocumentTracking = () => {
    document.removeEventListener('pointermove', handlePointerMove, true);
    document.removeEventListener('pointerup', handleDocumentPointerEnd, true);
    document.removeEventListener('pointercancel', handleDocumentPointerEnd, true);
  };

  const handleDocumentPointerEnd = (event) => {
    stopDocumentTracking();
    // Releases over the caption are handled (as a click) by the host listener.
    if (!host.contains(event.target)) pointerDownInfo = null;
  };

  const handlePointerDown = (event) => {
    const wordNode = findSourceTemplateWordNode(event, host);
    if (!wordNode) return;
    pointerDownInfo = {
      node: wordNode,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      dragStarted: false,
    };
    event.stopPropagation();
    stopDocumentTracking();
    document.addEventListener('pointermove', handlePointerMove, true);
    document.addEventListener('pointerup', handleDocumentPointerEnd, true);
    document.addEventListener('pointercancel', handleDocumentPointerEnd, true);
  };

  const handlePointerMove = (event) => {
    if (!pointerDownInfo || pointerDownInfo.dragStarted) return;
    if (pointerDownInfo.pointerId != null && event.pointerId != null && event.pointerId !== pointerDownInfo.pointerId) return;
    const moved = Math.hypot(
      (event.clientX || 0) - pointerDownInfo.x,
      (event.clientY || 0) - pointerDownInfo.y,
    );
    if (moved <= 6) return;

    const wordNode = pointerDownInfo.node;
    const wordIndex = Number(wordNode?.dataset.sourceWordIndex);
    if (!wordNode || !Number.isFinite(wordIndex)) return;

    pointerDownInfo.dragStarted = true;
    stopDocumentTracking();
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
  host.addEventListener('pointerup', handlePointerUp, true);
  host.addEventListener('click', handleClick, true);
  return () => {
    window.cancelAnimationFrame(frame);
    stopDocumentTracking();
    host.removeEventListener('pointerdown', handlePointerDown, true);
    host.removeEventListener('pointerup', handlePointerUp, true);
    host.removeEventListener('click', handleClick, true);
  };
}
