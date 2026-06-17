function escapeRegExp(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function extractCompleteTemplateDiv(markup = '', startIndex = 0) {
  const source = String(markup || '');
  const tagPattern = /<\/?div\b[^>]*>/gi;
  tagPattern.lastIndex = Math.max(0, Number(startIndex) || 0);
  let depth = 0;
  let match;

  while ((match = tagPattern.exec(source))) {
    depth += match[0].startsWith('</') ? -1 : 1;
    if (depth === 0) return source.slice(startIndex, tagPattern.lastIndex);
  }

  return '';
}

function findDivById(markup = '', id = '') {
  const source = String(markup || '');
  const escapedId = escapeRegExp(id);
  const idMatch = new RegExp(`\\bid=(["'])${escapedId}\\1`, 'i').exec(source);
  if (!idMatch) return '';
  const startIndex = source.lastIndexOf('<div', idMatch.index);
  if (startIndex < 0) return '';
  return extractCompleteTemplateDiv(source, startIndex);
}

export function extractAdvancedTemplateCardMarkup(sourceHtml = '', templateId = '') {
  if (!templateId) return '';
  return findDivById(sourceHtml, `card-${templateId}`);
}

export function extractAdvancedTemplateBlockMarkup(markup = '', templateId = '', phaseIndex = 0) {
  if (!templateId) return '';
  return findDivById(markup, `${templateId}-b${Math.max(0, Number(phaseIndex) || 0)}`);
}

export function buildAdvancedTemplateBlockMarkupMap(sourceHtml = '', blockTypes = {}) {
  return Object.fromEntries(
    Object.entries(blockTypes).map(([templateId, phases]) => {
      const cardMarkup = extractAdvancedTemplateCardMarkup(sourceHtml, templateId);
      return [
        templateId,
        phases.map((_, phaseIndex) => (
          extractAdvancedTemplateBlockMarkup(cardMarkup || sourceHtml, templateId, phaseIndex)
        )),
      ];
    }),
  );
}
