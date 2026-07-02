// Shared, framework-free builder for the right-side "Basic" templates
// (Iman, Light Streak, Green Neon Pulse, 3D Shadow, Pulse, Horror, …).
//
// IMPORTANT: This is the SINGLE source of truth for how an applied Basic
// template turns a caption + the template's `.btcard` source markup into the
// in-page DOM. It is consumed by BOTH:
//   • the live canvas preview  (VideoPlayer.jsx)
//   • the burned-video export  (scripts/render_template_overlay.mjs, which
//     injects this file into a Puppeteer page so the exported frames render
//     through the exact same DOM/CSS as the preview)
//
// Keeping one implementation is what guarantees "export matches preview". Do
// not fork this logic back into VideoPlayer — import from here instead.
//
// All functions are pure string/DOM transforms (DOMParser is available both in
// the browser and in the export page), so this module has no React/Node deps.

export const SOURCE_BASIC_TEMPLATE_IDS = [
  't-106', 't-52', 't-T4', 't-WS1', 't-115',
  't-104', 't-109', 't-95', 't-102', 't-T5',
  't-T6', 't-103', 't-QW1', 't-36', 't-105',
  't-124', 't-110', 't-56', 't-119', 't-12',
];

export const APPLIED_BASIC_TEMPLATE_FONT_SCALE = 0.76;

export function isSourceBasicTemplateId(templateId) {
  return SOURCE_BASIC_TEMPLATE_IDS.includes(String(templateId || ''));
}

export function sanitizeTemplateInlineStyle(styleValue = '') {
  const allowedDeclarations = String(styleValue)
    .split(';')
    .map((declaration) => declaration.trim())
    .filter(Boolean)
    .filter((declaration) => {
      const separator = declaration.indexOf(':');
      if (separator < 0) return false;
      const property = declaration.slice(0, separator).trim().toLowerCase();
      const rawValue = declaration.slice(separator + 1);
      const value = rawValue.trim();
      if (property === 'animation-delay') {
        return /^-?\d*\.?\d+(m?s)$/i.test(value);
      }
      if (/^--template-(?:primary|secondary|highlight|bg)$/.test(property)) {
        return /^(?:#[0-9a-f]{3,8}|transparent|rgba?\([\d\s,%.]+\))$/i.test(value);
      }
      if (property === 'font-weight') {
        return /^(?:[1-9]00|normal|bold|lighter|bolder)$/i.test(value);
      }
      if (property === 'font-style') {
        return /^(?:normal|italic|oblique)$/i.test(value);
      }
      return false;
    });
  return allowedDeclarations.length ? ` style="${allowedDeclarations.join(';')}"` : '';
}

export function isHiddenTemplateSlotStyle(styleValue = '') {
  const declarations = new Map(
    String(styleValue)
      .split(';')
      .map((declaration) => declaration.trim())
      .filter(Boolean)
      .map((declaration) => {
        const separator = declaration.indexOf(':');
        if (separator < 0) return ['', ''];
        return [
          declaration.slice(0, separator).trim().toLowerCase(),
          declaration.slice(separator + 1).trim().toLowerCase(),
        ];
      })
      .filter(([property]) => property),
  );

  return declarations.get('font-size') === '0'
    && declarations.get('line-height') === '0'
    && declarations.get('opacity') === '0'
    && declarations.get('position') === 'absolute';
}

export function sanitizeAppliedTemplateMarkup(markup = '', preserveInlineStyles = false) {
  return String(markup)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<(?:iframe|object|embed|link|meta|base|form|input|button|textarea|select)\b[\s\S]*?<\/(?:iframe|object|embed|link|meta|base|form|input|button|textarea|select)>/gi, '')
    .replace(/<(?:iframe|object|embed|link|meta|base|form|input|button|textarea|select)\b[^>]*\/?>/gi, '')
    .replace(/\s+bis_skin_checked="[^"]*"/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s+(?:href|src|xlink:href)\s*=\s*(["'])\s*(?:javascript:|data:text\/html)[\s\S]*?\1/gi, '')
    .replace(/\sstyle="([^"]*)"/gi, (_, styleValue) => {
      const hiddenSlotAttr = isHiddenTemplateSlotStyle(styleValue) ? ' data-basic-hidden-slot="true"' : '';
      return preserveInlineStyles
        ? `${hiddenSlotAttr}${sanitizeTemplateInlineStyle(styleValue)}`
        : hiddenSlotAttr;
    })
    .replace(/\sstyle='([^']*)'/gi, (_, styleValue) => {
      const hiddenSlotAttr = isHiddenTemplateSlotStyle(styleValue) ? ' data-basic-hidden-slot="true"' : '';
      return preserveInlineStyles
        ? `${hiddenSlotAttr}${sanitizeTemplateInlineStyle(styleValue)}`
        : hiddenSlotAttr;
    })
    .replace(/\sclass="([^"]*)"/gi, (_, classValue) => {
      const cleanedClassValue = String(classValue)
        .split(/\s+/)
        .filter((className) => className && !['active', 'visible', 'anim', 'on', 'in'].includes(className))
        .join(' ');
      return cleanedClassValue ? ` class="${cleanedClassValue}"` : '';
    })
    .replace(/\s+data-ti="[^"]*"/gi, '')
    .replace(/\s+data-si="[^"]*"/gi, '');
}

export function extractAppliedTemplateDiv(markup = '', startIndex = 0) {
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

export function escapeRegExp(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Locate a Basic template's authored `.btcard` source markup inside the
// lekha-captions-T11-T35 asset. The asset HTML is passed in so this stays pure
// (the preview supplies the bundled `?raw` import; the export reads the file).
export function findAppliedBasicTemplateMarkup(originalTemplateHtml = '', captionStyle = {}) {
  const templateId = String(captionStyle?.template_id || '').trim();
  if (!isSourceBasicTemplateId(templateId)) return '';

  const tokenPattern = new RegExp(`class="[^"]*\\b${escapeRegExp(templateId)}\\b`, 'i');
  const tokenMatch = tokenPattern.exec(originalTemplateHtml);
  if (!tokenMatch) return '';

  const beforeTemplateToken = originalTemplateHtml.slice(0, tokenMatch.index);
  const cardPattern = /<div\b[^>]*class="([^"]*)"/gi;
  let start = -1;
  let cardMatch;
  while ((cardMatch = cardPattern.exec(beforeTemplateToken))) {
    const classes = String(cardMatch[1] || '').split(/\s+/);
    if (classes.includes('btcard')) {
      start = cardMatch.index;
    }
  }
  if (start < 0) return '';
  return extractAppliedTemplateDiv(originalTemplateHtml, start);
}

export function _astEscape(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

export function _astCleanClass(value, fallback) {
  const cleaned = String(value || '')
    .split(/\s+/)
    .filter((c) => c && !['active', 'visible', 'anim', 'on', 'in'].includes(c))
    .join(' ');
  return cleaned || fallback;
}

export function _astMappedClass(sourceClasses, index, total, fallback) {
  if (!sourceClasses.length) return fallback;
  if (total <= 1) return sourceClasses[0] || fallback;
  const si = Math.min(
    sourceClasses.length - 1,
    Math.round((index * (sourceClasses.length - 1)) / Math.max(1, total - 1)),
  );
  return sourceClasses[si] || fallback;
}

export function _astSplitForSlots(words, slotCount) {
  if (!words.length || !slotCount) return [];
  const slots = Array.from({ length: slotCount }, () => []);
  words.forEach((w, i) => {
    slots[Math.min(slotCount - 1, Math.floor((i * slotCount) / words.length))].push(w);
  });
  return slots.map((s) => s.join(' '));
}

export function _astSplitWordRecordsForSlots(words, slotCount) {
  if (!words.length || !slotCount) return [];
  const slots = Array.from({ length: slotCount }, () => []);
  words.forEach((word, index) => {
    slots[Math.min(slotCount - 1, Math.floor((index * slotCount) / words.length))].push({ word, index });
  });
  return slots;
}

export const BASIC_TEMPLATES_WITH_VISIBLE_INACTIVE_WORDS = new Set(['t-102', 't-103']);
export const BASIC_TEMPLATES_WITH_SEQUENTIAL_REVEAL = new Set([]);

export function shouldRevealWholeBasicTemplate(templateId = '') {
  const id = String(templateId || '').trim();
  return !BASIC_TEMPLATES_WITH_VISIBLE_INACTIVE_WORDS.has(id)
    && !BASIC_TEMPLATES_WITH_SEQUENTIAL_REVEAL.has(id);
}

export function parseBasicCaptionLines(captionText = '') {
  const lines = String(captionText || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim().split(/\s+/).filter(Boolean));
  const nonEmptyLines = lines.filter((line) => line.length);
  const sourceLines = nonEmptyLines.length ? nonEmptyLines : [String(captionText || '').trim().split(/\s+/).filter(Boolean)];
  let wordIndex = 0;
  const lineGroups = sourceLines
    .map((line) => line.map((word) => ({ word, index: wordIndex++ })))
    .filter((line) => line.length);
  return {
    lines: lineGroups,
    words: lineGroups.flat().map((record) => record.word),
  };
}

export function getAppliedBasicCurrentWordIndex(caption = {}, time = 0, wordCount = 1) {
  const safeWordCount = Math.max(1, Number(wordCount) || 1);
  const timedWords = Array.isArray(caption?.words)
    ? caption.words.filter((word) => String(word?.word || '').trim())
    : [];

  if (timedWords.length) {
    let activeIndex = 0;
    const cappedCount = Math.min(safeWordCount, timedWords.length);
    for (let index = 0; index < cappedCount; index += 1) {
      const word = timedWords[index] || {};
      const start = Number(word.start ?? caption.start_time ?? caption.start ?? 0);
      const nextStart = Number(timedWords[index + 1]?.start);
      const end = Number(word.end);
      const effectiveEnd = Number.isFinite(nextStart)
        ? nextStart
        : Number.isFinite(end)
          ? end
          : Number(caption.end_time ?? caption.end ?? start);
      if (time >= start && (index === cappedCount - 1 || time < effectiveEnd)) {
        return index;
      }
      if (time >= start) activeIndex = index;
      else break;
    }
    return Math.max(0, Math.min(safeWordCount - 1, activeIndex));
  }

  const captionStart = Number(caption.start_time ?? caption.start ?? 0);
  const captionEnd = Number(caption.end_time ?? caption.end ?? captionStart);
  const duration = Math.max(captionEnd - captionStart, 0.01);
  const elapsed = Math.min(Math.max(Number(time || 0) - captionStart, 0), duration);
  return safeWordCount > 1
    ? Math.max(0, Math.min(safeWordCount - 1, Math.floor((elapsed / duration) * safeWordCount)))
    : 0;
}

export function _basicWordStateClass(baseClass, index, currentIndex, isEmphasis = false, revealWholeBlock = false) {
  const cleaned = String(baseClass || 'word')
    .split(/\s+/)
    .filter((className) => className && !['active', 'current', 'done', 'is-active', 'imp'].includes(className))
    .join(' ') || 'word';
  return [
    cleaned,
    revealWholeBlock || index <= currentIndex ? 'active' : '',
    !revealWholeBlock && index < currentIndex ? 'done' : '',
    index === currentIndex ? 'current' : '',
  ].filter(Boolean).join(' ');
}

export function updateAppliedBasicTemplateWordState(host, currentIndex = 0, wordCount = 1, templateId = '') {
  if (!host) return;
  const revealWholeBlock = shouldRevealWholeBasicTemplate(templateId);
  const safeWordCount = Math.max(1, Number(wordCount) || 1);
  const safeCurrentIndex = Math.max(0, Number(currentIndex) || 0);

  host.querySelectorAll('.word, .sw-w').forEach((word) => {
    word.classList.remove('current', 'imp');
  });

  const activeBlock = host.querySelector('.bt-cap-block.is-active') || host;
  const visibleWords = Array.from(activeBlock.querySelectorAll('.word[data-w], .sw-w[data-w]'));
  const mappedCurrentIndex = Math.min(safeWordCount - 1, safeCurrentIndex);

  visibleWords.forEach((word) => {
    const wordIndex = Number(word.getAttribute('data-w')) || 0;
    word.classList.remove('current', 'is-active');
    if (revealWholeBlock) {
      word.classList.add('active');
      word.classList.remove('done');
    } else {
      word.classList.remove('active', 'done');
      if (wordIndex <= mappedCurrentIndex) {
        word.classList.add('active');
      }
      if (wordIndex < mappedCurrentIndex) {
        word.classList.add('done');
      }
    }
    if (wordIndex === mappedCurrentIndex) {
      word.classList.add('current');
    }
  });
}

function _basicTemplateWordDelay(templateId = '', phaseIndex = 0, lineIndex = phaseIndex, localIndex = 0) {
  const safeLocalIndex = Math.max(0, Number(localIndex) || 0);
  if (String(templateId || '') !== 't-T4') {
    return {
      basicWordDelayMs: safeLocalIndex * 65,
      wordSlideDelayMs: 90 + (safeLocalIndex * 55),
    };
  }

  const motionLine = Number.isFinite(Number(lineIndex)) ? Number(lineIndex) : Number(phaseIndex) || 0;
  return {
    basicWordDelayMs: motionLine === 0 ? 20 + (safeLocalIndex * 90) : safeLocalIndex * 65,
    wordSlideDelayMs: motionLine === 2 ? 70 + (safeLocalIndex * 75) : 90 + (safeLocalIndex * 55),
  };
}

export function _basicReplaceCapText(container, words, currentIndex, impWordIndex = -1, revealWholeBlock = true, lineGroups = [], templateId = '', phaseIndex = 0) {
  if (!container || !words.length) return;
  const sourceClasses = Array.from(container.querySelectorAll('.word'))
    .map((word) => _astCleanClass(word.className, 'word'));
  const hasManualLines = lineGroups.length > 1;
  container.classList.toggle('has-manual-lines', hasManualLines);
  const renderWord = ({ word, index, localIndex = index, lineIndex = phaseIndex }) => {
    const { basicWordDelayMs, wordSlideDelayMs } = _basicTemplateWordDelay(templateId, phaseIndex, lineIndex, localIndex);
    return `<span class="${_basicWordStateClass(_astMappedClass(sourceClasses, index, words.length, 'word'), index, currentIndex, index === impWordIndex, revealWholeBlock)}" data-w="${index}" style="--basic-word-index:${index};--basic-word-delay:${basicWordDelayMs}ms;--ws-delay:${wordSlideDelayMs}ms">${_astEscape(word)}</span>`;
  };
  container.innerHTML = hasManualLines
    ? lineGroups.map((line, lineIndex) => `<span class="basic-manual-line basic-manual-line-${lineIndex}" data-basic-line="${lineIndex}">${line.map((record, localIndex) => renderWord({ ...record, localIndex, lineIndex })).join(' ')}</span>`).join('')
    : words.map((word, index) => renderWord({ word, index, localIndex: index, lineIndex: phaseIndex })).join(' ');
}

export function _basicReplaceStickyLine(container, words, currentIndex, impWordIndex = -1, revealWholeBlock = true) {
  if (!container || !words.length) return;
  const sourceClasses = Array.from(container.querySelectorAll('.sw-w'))
    .map((word) => _astCleanClass(word.className, 'sw-w'));
  container.innerHTML = words.map((word, index) => (
    `<span class="${_basicWordStateClass(_astMappedClass(sourceClasses, index, words.length, 'sw-w'), index, currentIndex, index === impWordIndex, revealWholeBlock)}" data-w="${index}" style="--basic-word-index:${index};--basic-word-delay:${index * 80}ms">${_astEscape(word)}</span>`
  )).join(' ');
}

export function _basicReplaceLayoutSlots(block, words, currentIndex, impWordIndex = -1, revealWholeBlock = true) {
  const slots = Array.from(block.querySelectorAll('.cpt-wrap .word[data-wi]'));
  if (!slots.length || !words.length) return false;
  const visibleSlots = slots.filter((slot) => slot.getAttribute('data-basic-hidden-slot') !== 'true');
  const targetSlots = visibleSlots.length ? visibleSlots : slots;
  const wordSlots = _astSplitWordRecordsForSlots(words, targetSlots.length);

  slots.forEach((slot) => {
    if (slot.getAttribute('data-basic-hidden-slot') !== 'true') return;
    slot.textContent = '';
    slot.className = _basicWordStateClass(slot.className, Number.POSITIVE_INFINITY, -1, false);
  });

  targetSlots.forEach((slot, index) => {
    const slotWords = wordSlots[index] || [];
    const sourceClass = _astCleanClass(slot.className, 'word');
    const replacement = slotWords.map(({ word, index: wordIndex }) => (
      `<span class="${_basicWordStateClass(sourceClass, wordIndex, currentIndex, wordIndex === impWordIndex, revealWholeBlock)}" data-w="${wordIndex}" style="--basic-word-index:${wordIndex};--basic-word-delay:${wordIndex * 65}ms;--ws-delay:${90 + (wordIndex * 55)}ms">${_astEscape(word)}</span>`
    )).join(' ');
    slot.outerHTML = replacement;
  });
  return true;
}

// Inject the caption's words into one phase of the template's `.btcard` markup.
// Mirrors the preview: build with currentIndex=0/impWordIndex=-1, then the
// per-frame current word is applied separately via
// updateAppliedBasicTemplateWordState (so the same markup can be reused across
// playhead positions without rebuilding).
export function _buildAppliedBasicTemplateInlineUncached(rawMarkup, templateId, captionText, activePhase, currentIndex, impWordIndex) {
  const markup = sanitizeAppliedTemplateMarkup(rawMarkup, true);
  if (!markup || typeof DOMParser === 'undefined') return null;
  const parsedCaption = parseBasicCaptionLines(captionText);
  const words = parsedCaption.words;
  if (!words.length) return null;

  let doc;
  try {
    doc = new DOMParser().parseFromString(markup, 'text/html');
  } catch {
    return null;
  }

  const card = doc.querySelector('.btcard');
  if (!card) return null;
  card.querySelectorAll('.btcard-info, .bt-prog-dots').forEach((el) => el.remove());

  const blocks = Array.from(card.querySelectorAll('.bt-cap-block'));
  if (!blocks.length) return null;
  const phase = ((activePhase % blocks.length) + blocks.length) % blocks.length;
  const revealWholeBlock = shouldRevealWholeBasicTemplate(templateId);

  blocks.forEach((block, index) => {
    block.querySelectorAll('.word, .sw-w').forEach((word) => {
      word.classList.remove('imp');
    });
    const isActive = index === phase;
    block.classList.add(`basic-phase-${index}`);
    block.classList.toggle('active', isActive);
    block.classList.toggle('is-active', isActive);
    block.setAttribute('data-basic-phase', String(index));
    block.style.display = isActive ? 'flex' : 'none';
    if (!isActive) return;

    const slotLayoutHandled = _basicReplaceLayoutSlots(block, words, currentIndex, impWordIndex, revealWholeBlock);
    block.querySelectorAll('.sw-line').forEach((line) => _basicReplaceStickyLine(line, words, currentIndex, impWordIndex, revealWholeBlock));
    if (!slotLayoutHandled) {
      block.querySelectorAll('.cap-text').forEach((line) => _basicReplaceCapText(line, words, currentIndex, impWordIndex, revealWholeBlock, parsedCaption.lines, templateId, index));
    }

    // The authored per-template motion/effects are written as
    // `.t-XXX .lekha-basic-template-animated .word(.active|.current)` and the
    // boxed look as `.t-XXX .lekha-basic-template-fit` — both expect the anchor
    // class to sit BETWEEN the template wrapper (.t-XXX) and the words.
    block.querySelectorAll('.cap-text, .cpt-wrap, .sw-line').forEach((line) => {
      line.classList.add('lekha-basic-template-animated', 'lekha-basic-template-fit');
    });

    if (templateId === 't-T4') {
      block.querySelectorAll('.t-T4').forEach((wrapper) => {
        wrapper.classList.add(`study-line-${index}`);
        if (index === 1) wrapper.classList.add('study-word-slide-preview');
      });
    }

    if (templateId === 't-WS1') {
      block.classList.add(`ws-line-${index}`);
    }
    block.querySelectorAll('.t-WS1').forEach((wrapper) => {
      wrapper.classList.remove('ws-done');
      wrapper.classList.add('ws-enter', `ws-line-${index}`);
    });
  });

  return card.outerHTML;
}

// Public builder used by both preview and export.
export function buildAppliedBasicTemplateInlineFromMarkup(rawMarkup, templateId, captionText, { activePhase = 0 } = {}) {
  return _buildAppliedBasicTemplateInlineUncached(rawMarkup, templateId, captionText, activePhase, 0, -1);
}

export function countAppliedBasicTemplatePhasesFromMarkup(rawMarkup = '') {
  return Math.max(
    1,
    (sanitizeAppliedTemplateMarkup(rawMarkup).match(/class="[^"]*\bbt-cap-block\b/g) || []).length || 1,
  );
}

export const APPLIED_BASIC_TEMPLATE_HOST_OVERRIDES = `
  .lekha-applied-basic-template-host {
    display: inline-block;
    width: min(100%, var(--applied-basic-width, calc(320px * var(--applied-basic-scale, 1))));
    max-width: 100%;
    vertical-align: top;
  }
  .lekha-applied-basic-template-host .btcard,
  .lekha-applied-basic-template-host .btcard-preview,
  .lekha-applied-basic-template-host .bt-cap-stack {
    width: 100% !important;
    min-width: 0 !important;
    height: auto !important;
    min-height: 0 !important;
    background: transparent !important;
    border: 0 !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: visible !important;
  }
  .lekha-applied-basic-template-host .btcard {
    display: block !important;
    cursor: inherit !important;
    transform: none !important;
  }
  .lekha-applied-basic-template-host .btcard-preview,
  .lekha-applied-basic-template-host .bt-cap-block {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
  }
  .lekha-applied-basic-template-host .bt-cap-block:not(.is-active) {
    display: none !important;
  }
  .lekha-applied-basic-template-host .btcard-info,
  .lekha-applied-basic-template-host .bt-prog-dots {
    display: none !important;
  }
  .lekha-applied-basic-template-host .cap-text,
  .lekha-applied-basic-template-host .sw-line {
    max-width: 100% !important;
    word-break: normal !important;
    font-family: inherit !important;
    font-size: inherit !important;
    font-weight: inherit !important;
    font-style: inherit !important;
    line-height: inherit !important;
  }
  .lekha-applied-basic-template-host .cap-text {
    display: inline-flex !important;
    flex-direction: row !important;
    flex-wrap: nowrap !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 0.34em !important;
    white-space: nowrap !important;
    overflow-wrap: normal !important;
  }
  .lekha-applied-basic-template-host .cap-text.has-manual-lines {
    flex-direction: column !important;
    align-items: center !important;
    gap: 0.18em !important;
    white-space: normal !important;
  }
  .lekha-applied-basic-template-host .basic-manual-line {
    display: inline-flex !important;
    flex-direction: row !important;
    align-items: center !important;
    justify-content: center !important;
    gap: inherit !important;
    white-space: nowrap !important;
  }
  .lekha-applied-basic-template-host .t-T6 .cap-text,
  .lekha-applied-basic-template-host .t-109 .cap-text,
  .lekha-applied-basic-template-host .t-110 .cap-text,
  .lekha-applied-basic-template-host .t-119 .cap-text {
    gap: 0.26em !important;
  }
  .lekha-applied-basic-template-host .t-T6 .cap-text {
    gap: 0.18em !important;
  }
  .lekha-applied-basic-template-host.t-T5 .t-T5 .cap-text {
    display: block !important;
    width: fit-content !important;
    max-width: min(100%, 18em) !important;
    white-space: normal !important;
    overflow-wrap: anywhere !important;
    background: var(--template-bg, #DDAA03) !important;
    border-radius: calc(10px * var(--applied-basic-scale, 1)) !important;
    padding: calc(8px * var(--applied-basic-scale, 1)) calc(12px * var(--applied-basic-scale, 1)) !important;
    line-height: 1.5 !important;
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
  }
  .lekha-applied-basic-template-host.t-T5 .t-T5 .word {
    display: inline !important;
    white-space: normal !important;
  }
  .lekha-applied-basic-template-host.t-T6 .t-T6 {
    display: inline-block !important;
    width: fit-content !important;
    max-width: 100% !important;
    min-width: 0 !important;
    height: auto !important;
    background: var(--template-bg, #f97316) !important;
    border-radius: 5px !important;
    padding: calc(3px * var(--applied-basic-scale, 1)) calc(5px * var(--applied-basic-scale, 1)) !important;
    box-shadow: 0 calc(5px * var(--applied-basic-scale, 1)) calc(14px * var(--applied-basic-scale, 1)) rgba(249, 115, 22, .28) !important;
  }
  .lekha-applied-basic-template-host.t-T6 .t-T6 .lekha-basic-template-fit {
    width: auto !important;
    max-width: 100% !important;
    background: transparent !important;
    border-radius: 0 !important;
    padding: 0 !important;
    box-shadow: none !important;
  }
  .lekha-applied-basic-template-host.t-T6 .t-T6 .word {
    margin: 0 !important;
  }
  .lekha-applied-basic-template-host.lekha-basic-template-enter-once.t-T6 .lekha-basic-template-animated .word.active {
    animation: basicWordRiseIn 0.28s cubic-bezier(0.34, 1.2, 0.64, 1) both !important;
    animation-delay: var(--basic-word-delay, 0ms) !important;
  }
  @keyframes basicWordSlideFromLeft {
    from {
      opacity: 0;
      transform: translateX(-38px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
  @keyframes wordSlideIn {
    0% {
      opacity: 0;
      transform: translateX(22px);
    }
    65% {
      opacity: 1;
      transform: translateX(-3px);
    }
    100% {
      opacity: 1;
      transform: translateX(0);
    }
  }
  @keyframes wordRiseInFromBottom {
    0% {
      opacity: 0;
      transform: translateY(24px);
    }
    65% {
      opacity: 1;
      transform: translateY(-2px);
    }
    100% {
      opacity: 1;
      transform: translateY(0);
    }
  }
  @keyframes basicLightStreakRise {
    from {
      opacity: 0;
      transform: translateY(44px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  @keyframes basicLightStreakSlideLeft {
    from {
      opacity: 0;
      transform: translateX(-38px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
  @keyframes basicLightStreakSlideRight {
    from {
      opacity: 0;
      transform: translateX(38px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
  .lekha-applied-basic-template-host.lekha-basic-template-enter-once.t-52 .t-52 {
    will-change: transform, opacity;
  }
  .lekha-applied-basic-template-host.lekha-basic-template-enter-once.t-52 .bt-cap-block.basic-phase-0 .t-52 {
    animation: basicLightStreakRise 0.7s cubic-bezier(0.22, 1, 0.36, 1) both !important;
  }
  .lekha-applied-basic-template-host.lekha-basic-template-enter-once.t-52 .bt-cap-block.basic-phase-1 .t-52 .word.active,
  .lekha-applied-basic-template-host.lekha-basic-template-enter-once.t-52 .bt-cap-block.basic-phase-1 .t-52 .word.current {
    animation: basicLightStreakSlideLeft 0.42s cubic-bezier(0.22, 1, 0.36, 1) both !important;
    animation-delay: var(--basic-word-delay, 0ms) !important;
  }
  .lekha-applied-basic-template-host.lekha-basic-template-enter-once.t-52 .bt-cap-block.basic-phase-2 .t-52 .word.active,
  .lekha-applied-basic-template-host.lekha-basic-template-enter-once.t-52 .bt-cap-block.basic-phase-2 .t-52 .word.current {
    animation: basicLightStreakSlideRight 0.42s cubic-bezier(0.22, 1, 0.36, 1) both !important;
    animation-delay: var(--basic-word-delay, 0ms) !important;
  }
  .lekha-applied-basic-template-host.lekha-basic-template-enter-once.t-T4 .t-T4,
  .lekha-applied-basic-template-host.lekha-basic-template-enter-once.t-T4 .lekha-basic-template-animated,
  .lekha-applied-basic-template-host.lekha-basic-template-enter-once.t-T4 .basic-manual-line {
    animation: none !important;
    transform: none !important;
    opacity: 1 !important;
  }
  .lekha-applied-basic-template-host.lekha-basic-template-enter-once.t-T4 .word {
    color: #ffffff !important;
    opacity: 1 !important;
    display: inline-block !important;
    will-change: transform, opacity;
  }
  .lekha-applied-basic-template-host.lekha-basic-template-enter-once.t-T4 .word {
    animation: none !important;
    transform: none !important;
  }
  .lekha-applied-basic-template-host.lekha-basic-template-enter-once.t-T4 .t-T4.study-line-0 {
    animation: basicWordSlideFromLeft 0.42s cubic-bezier(0.22, 1, 0.36, 1) both !important;
    animation-delay: 0ms !important;
  }
  .lekha-applied-basic-template-host.lekha-basic-template-enter-once.t-T4 .t-T4.study-line-2 {
    animation: wordRiseInFromBottom 0.38s cubic-bezier(0.34, 1.2, 0.64, 1) both !important;
    animation-delay: 0ms !important;
  }
  .lekha-applied-basic-template-host.lekha-basic-template-enter-once.t-T4 .bt-cap-block.basic-phase-0 .lekha-basic-template-animated,
  .lekha-applied-basic-template-host.lekha-basic-template-enter-once.t-T4 .lekha-basic-template-animated.has-manual-lines .basic-manual-line-0 {
    animation: none !important;
    transform: none !important;
  }
  .lekha-applied-basic-template-host.lekha-basic-template-enter-once.t-T4 .bt-cap-block.basic-phase-1 .lekha-basic-template-animated .word,
  .lekha-applied-basic-template-host.lekha-basic-template-enter-once.t-T4 .lekha-basic-template-animated.has-manual-lines .basic-manual-line-1 .word {
    animation: wordSlideIn 0.32s cubic-bezier(0.34, 1.4, 0.64, 1) both !important;
    animation-delay: var(--ws-delay, var(--basic-word-delay, 0ms)) !important;
  }
  .lekha-applied-basic-template-host.lekha-basic-template-enter-once.t-T4 .bt-cap-block.basic-phase-2 .lekha-basic-template-animated,
  .lekha-applied-basic-template-host.lekha-basic-template-enter-once.t-T4 .lekha-basic-template-animated.has-manual-lines .basic-manual-line-2 {
    animation: none !important;
    transform: none !important;
  }
  .lekha-applied-basic-template-host .sw-line {
    white-space: normal !important;
    overflow-wrap: anywhere !important;
  }
  .lekha-applied-basic-template-host .word,
  .lekha-applied-basic-template-host .sw-w {
    display: inline-block !important;
    max-width: 100%;
    white-space: inherit;
    overflow-wrap: inherit;
    vertical-align: baseline;
  }
  .lekha-applied-basic-template-host .word:not(:last-child),
  .lekha-applied-basic-template-host .sw-w:not(:last-child) {
    margin-inline-end: 0.1em;
  }
  .lekha-applied-basic-template-host [data-basic-hidden-slot="true"] {
    display: none !important;
  }
  .lekha-applied-basic-template-host .cpt-wrap {
    display: flex !important;
    width: min(100%, 300px) !important;
    flex-direction: column !important;
    justify-content: center !important;
    gap: 3px !important;
    padding: 4px 12px !important;
    text-align: left !important;
  }
  .lekha-applied-basic-template-host .cpt-wrap-right {
    text-align: right !important;
  }
  .lekha-applied-basic-template-host .cpt-row-sm {
    font-size: 1em !important;
    line-height: 1.05 !important;
  }
  .lekha-applied-basic-template-host .cpt-row-lg {
    font-size: 1.18em !important;
    line-height: 0.95 !important;
    font-weight: 900 !important;
  }
  .lekha-applied-basic-template-host .cpt-row-lg-center {
    text-align: center !important;
  }
`;

// Expose the builder to a classic (non-module) script context — the export
// renderer injects this file's source into a Puppeteer page and calls these
// from its per-frame render loop. Harmless in Node (no window) and the browser.
if (typeof window !== 'undefined') {
  window.__basicTpl = {
    isSourceBasicTemplateId,
    buildAppliedBasicTemplateInlineFromMarkup,
    countAppliedBasicTemplatePhasesFromMarkup,
    updateAppliedBasicTemplateWordState,
    getAppliedBasicCurrentWordIndex,
    parseBasicCaptionLines,
    BASIC_TEMPLATES_WITH_VISIBLE_INACTIVE_WORDS,
    BASIC_TEMPLATES_WITH_SEQUENTIAL_REVEAL,
  };
}
