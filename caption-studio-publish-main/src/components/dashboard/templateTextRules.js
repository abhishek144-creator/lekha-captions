// Caption text and emphasis rules shared by the editor preview
// (videoPlayerTemplateRendering.jsx) and the export renderer
// (scripts/render_template_overlay.mjs), so the two can't drift apart.
//
// Keep this file import-free: the export renderer loads it into the headless
// page as a classic <script> (it strips the `export` keywords), exactly like
// basicTemplateInline.js.

export function isAdvancedTemplateId(templateId) {
  return /^t\d{2}$/.test(String(templateId || ''));
}

export function splitCaptionForTemplate(text = '', requestedIndex = -1) {
  const words = String(text).trim().split(/\s+/).filter(Boolean)
  const full = words.join(' ')
  const index = Number(requestedIndex)
  if (!Number.isInteger(index) || index < 0 || index >= words.length) {
    return { top: full, hero: '', bottom: '', full }
  }
  return { top: words.slice(0, index).join(' '), hero: words[index], bottom: words.slice(index+1).join(' '), full }
}

export function splitTemplateLines(text = '', maxLines = 2) {
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [''];
  const lineCount = Math.max(1, Math.min(maxLines, words.length));
  const lines = Array.from({ length: lineCount }, () => []);
  words.forEach((word, index) => {
    lines[Math.min(lineCount - 1, Math.floor((index * lineCount) / words.length))].push(word);
  });
  return lines.map(line => line.join(' ')).filter(Boolean);
}

export function resolveTemplatePreviewLines(text = '', preferredLines = [], maxLines = 2) {
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

export function shouldCompactTemplateLine(text = '') {
  const value = String(text || '').trim();
  if (!value) return false;
  return value.length > 22
    || usesComplexTemplateScript(value);
}

export function usesComplexTemplateScript(text = '') {
  return /[\p{Script=Arabic}\p{Script=Bengali}\p{Script=Devanagari}\p{Script=Gujarati}\p{Script=Gurmukhi}\p{Script=Han}\p{Script=Hiragana}\p{Script=Kannada}\p{Script=Katakana}\p{Script=Malayalam}\p{Script=Oriya}\p{Script=Tamil}\p{Script=Telugu}\p{Script=Thai}]/u.test(String(text || ''));
}

export function splitBattleCryIndexedLines(tokens = []) {
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

export function splitCompactIndexedLines(tokens = [], preferredLines = []) {
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

export function normalizeImpWordIndices(impWordIndex = -1, impWordIndices = []) {
  const values = Array.isArray(impWordIndices) ? impWordIndices : [];
  const normalized = values
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value >= 0);
  const single = Number(impWordIndex);
  if (Number.isInteger(single) && single >= 0) normalized.push(single);
  return [...new Set(normalized.map((value) => Math.trunc(value)))];
}

export function normalizeTemplateWord(word = '') {
  return String(word || '')
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/^[^\p{L}\p{M}\p{N}]+|[^\p{L}\p{M}\p{N}]+$/gu, '');
}

export function getTargetPhraseImpWordIndices(wordsOrTokens = []) {
  const normalizedWords = wordsOrTokens.map((item) => normalizeTemplateWord(item?.word ?? item));
  for (let index = 0; index < normalizedWords.length - 1; index += 1) {
    if (normalizedWords[index] === '\u0926\u0938' && normalizedWords[index + 1] === '\u0932\u0915') {
      return [index, index + 1];
    }
  }
  return [];
}

export function resolveImpWordIndicesForWords(wordsOrTokens = [], impWordIndex = -1, impWordIndices = []) {
  return normalizeImpWordIndices(impWordIndex, impWordIndices)
    .filter(index => Number.isInteger(index) && index < wordsOrTokens.length)
}

// Rebuilt title/line layouts must retain global word identity rather than
// promoting the entire last row to a keyword. Also used by the export page.
export function appendSemanticTemplateWords(container, text, offset = 0, indices = [], impClass = '') {
  const chosen = new Set(indices)
  const words = String(text || '').trim().split(/\s+/).filter(Boolean)
  words.forEach((word, index) => {
    if (index) container.appendChild(container.ownerDocument.createTextNode(' '))
    const span = container.ownerDocument.createElement('span')
    span.dataset.w = String(offset + index)
    span.textContent = word
    if (chosen.has(offset + index) && impClass) {
      span.className = `${impClass} is-emphasis`
      span.dataset.imp = 'true'
      span.dataset.impCls = impClass
    }
    container.appendChild(span)
  })
  return offset + words.length
}

// Classes a template puts on its authored keyword. They describe the highlight,
// not the word slot, so the fill code moves them onto the caption's important
// words instead of leaving them on whichever word lands in that slot.
export const TEMPLATE_KEYWORD_CLASS_NAMES = ['hero', 'ul', 'ns3hero', 'ns3box', 'ns3mark', 'ns3bracket', 'ns3dot'];

const TEMPLATE_AUTHORED_KEYWORD_SELECTOR = [
  '.is-emphasis',
  ...TEMPLATE_KEYWORD_CLASS_NAMES.map((name) => `.${name}`),
  '[class*="imp-"]',
  '[class*="ns2-"]',
  '[class*="ns3-"]',
].join(', ');

// A phase whose authored design has no keyword (a plain or word-by-word
// sentence) must not show a guessed highlight.
export function templateBlockHasAuthoredKeyword(block) {
  return Boolean(block?.querySelector?.(TEMPLATE_AUTHORED_KEYWORD_SELECTOR));
}

export function splitTemplateKeywordClasses(className = '') {
  const base = [];
  const keyword = [];
  String(className || '').split(/\s+/).filter(Boolean).forEach((name) => {
    if (name === 'is-emphasis') return;
    (TEMPLATE_KEYWORD_CLASS_NAMES.includes(name) ? keyword : base).push(name);
  });
  return { base: base.join(' '), keyword: keyword.join(' ') };
}

// Authored keyword spans carry a per-scene inline colour. Every highlighted
// word takes the one accent the user picked instead.
export function stripTemplateKeywordColor(style = '') {
  return String(style || '')
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part && !/^(?:color|-webkit-text-fill-color)\s*:/i.test(part))
    .join(';');
}

function splitIndicesOverRows(indices = [], rowSlots = []) {
  const total = rowSlots.reduce((sum, slots) => sum + Math.max(0, Number(slots) || 0), 0);
  let cursor = 0;
  return rowSlots.map((slots, rowIndex) => {
    const remaining = indices.length - cursor;
    const remainingRows = rowSlots.length - rowIndex - 1;
    const proportional = Math.round((Math.max(0, Number(slots) || 0) / Math.max(1, total)) * indices.length);
    const count = rowIndex === rowSlots.length - 1
      ? remaining
      : Math.max(0, Math.min(remaining, Math.max(1, Math.min(remaining - remainingRows, proportional))));
    const rowIndices = indices.slice(cursor, cursor + count);
    cursor += count;
    return rowIndices;
  });
}

// Splits a caption's word indices over a template's authored rows.
// rowSlots: authored word count per row; keywordRow: the row the template built
// for its keyword (-1 if none). When the important words fit, the keyword row
// gets them, so the template's big / accent row carries the word that matters;
// otherwise rows share the words in proportion to their authored slots. Words
// always stay in reading order (the export's completeness check requires it).
export function planTemplateRowWords(rowSlots = [], wordCount = 0, impIndices = [], keywordRow = -1) {
  const allIndices = Array.from({ length: Math.max(0, wordCount) }, (_, index) => index);
  const proportional = () => splitIndicesOverRows(allIndices, rowSlots);
  const rowCount = rowSlots.length;
  const important = [...new Set(impIndices.map(Number))]
    .filter((index) => Number.isInteger(index) && index >= 0 && index < wordCount)
    .sort((a, b) => a - b);
  if (rowCount < 2 || keywordRow < 0 || keywordRow >= rowCount || !important.length) return proportional();

  const rowsBefore = keywordRow;
  const rowsAfter = rowCount - 1 - keywordRow;
  let start = important[0];
  let end = important[important.length - 1] - start > 2 ? start : important[important.length - 1];
  if (rowsBefore === 0) start = 0;
  if (rowsAfter === 0) end = wordCount - 1;
  const keywordSpan = end - start + 1;
  if (
    start < rowsBefore
    || wordCount - 1 - end < rowsAfter
    || keywordSpan > Math.max(3, Math.ceil(wordCount / 2))
  ) {
    return proportional();
  }
  const beforeRows = splitIndicesOverRows(allIndices.slice(0, start), rowSlots.slice(0, keywordRow));
  const afterRows = splitIndicesOverRows(allIndices.slice(end + 1), rowSlots.slice(keywordRow + 1));
  return [...beforeRows, allIndices.slice(start, end + 1), ...afterRows];
}

export function extractHtmlStyle(markup = '') {
  return Array.from(
    String(markup).matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi),
    (match) => match[1],
  ).join('\n');
}

export const RECREATED_ADVANCED_WBW_PHASES = {
  t11: { 2: 'imp-gold' },
  t18: { 2: 'imp-purple' },
  t24: { 2: 'imp-orange' },
  t31: { 2: 'imp-gold' },
};

export function getRecreatedAdvancedWbwImpClass(templateId, blockIndex) {
  return RECREATED_ADVANCED_WBW_PHASES[String(templateId || '')]?.[Number(blockIndex)] || '';
}

export function shouldRecreateAdvancedWbwPhase(templateId, blockIndex) {
  return Boolean(getRecreatedAdvancedWbwImpClass(templateId, blockIndex));
}

export function shouldSuppressStyledSemanticEmphasis(templateId, blockType, block) {
  return templateId === 't17' && !!block?.querySelector?.('.snap-txt');
}
