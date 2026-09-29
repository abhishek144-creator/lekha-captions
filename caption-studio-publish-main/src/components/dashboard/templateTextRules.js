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

export function splitCaptionForTemplate(text = '') {
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
    .filter((value) => Number.isFinite(value) && value >= 0);
  const single = Number(impWordIndex);
  if (Number.isFinite(single) && single >= 0) normalized.push(single);
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
  const phraseIndices = getTargetPhraseImpWordIndices(wordsOrTokens);
  if (phraseIndices.length) return phraseIndices;
  return normalizeImpWordIndices(impWordIndex, impWordIndices);
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
