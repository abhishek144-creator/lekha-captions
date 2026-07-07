import { useCallback, useEffect, useMemo, useState } from 'react';

const TEMPLATE_FAVORITES_STORAGE_KEY = 'captionStudio.templateFavorites.v1';

export function getTemplateFavoriteKey(kind = 'template', id = '') {
  return `${kind}:${String(id || '').trim()}`;
}

function readTemplateFavoriteKeys() {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(TEMPLATE_FAVORITES_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : [];
  } catch {
    return [];
  }
}

function writeTemplateFavoriteKeys(keys = []) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    TEMPLATE_FAVORITES_STORAGE_KEY,
    JSON.stringify([...new Set(keys.filter(Boolean).map(String))]),
  );
}

export function useTemplateFavorites() {
  const [favoriteKeys, setFavoriteKeys] = useState(() => readTemplateFavoriteKeys());

  useEffect(() => {
    writeTemplateFavoriteKeys(favoriteKeys);
  }, [favoriteKeys]);

  const favoriteKeySet = useMemo(() => new Set(favoriteKeys), [favoriteKeys]);
  const isFavorite = useCallback(
    (kind, id) => favoriteKeySet.has(getTemplateFavoriteKey(kind, id)),
    [favoriteKeySet],
  );
  const toggleFavorite = useCallback((kind, id) => {
    const key = getTemplateFavoriteKey(kind, id);
    setFavoriteKeys((current) => (
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key]
    ));
  }, []);

  return { favoriteKeys, isFavorite, toggleFavorite };
}

export function normalizeTemplateSearch(value = '') {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function templateMatchesQuery(template = {}, query = '', extraFields = []) {
  const normalizedQuery = normalizeTemplateSearch(query);
  if (!normalizedQuery) return true;
  const fields = [
    template.id,
    template.code,
    template.name,
    template.displayName,
    template.desc,
    template.description,
    template.mood,
    template.formula,
    template.stageLabel,
    template.template_layout,
    template.template_effect,
    ...extraFields,
  ];
  return normalizeTemplateSearch(fields.filter(Boolean).join(' ')).includes(normalizedQuery);
}

export function isExportableTemplateCandidate(template = {}) {
  const searchableText = normalizeTemplateSearch([
    template.id,
    template.code,
    template.name,
    template.displayName,
    template.desc,
    template.description,
    template.mood,
    template.formula,
    template.stageLabel,
    template.cardClass,
    template.template_source,
    template.template_effect,
  ].filter(Boolean).join(' '));
  return !/\b(gsap|lab|static text|static-only|preview only|preview-only)\b/.test(searchableText);
}
