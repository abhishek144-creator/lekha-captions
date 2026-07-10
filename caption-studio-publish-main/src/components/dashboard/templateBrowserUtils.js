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

const TEMPLATE_FAVORITES_CHANGED_EVENT = 'lekha-template-favorites-changed';

export function useTemplateFavorites() {
  const [favoriteKeys, setFavoriteKeys] = useState(() => readTemplateFavoriteKeys());

  // Several galleries mount this hook at once. Each instance must re-read on
  // any change, or a toggle in one gallery is invisible to the others — and a
  // later write from a stale instance silently wipes it.
  useEffect(() => {
    const sync = () => setFavoriteKeys(readTemplateFavoriteKeys());
    window.addEventListener(TEMPLATE_FAVORITES_CHANGED_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(TEMPLATE_FAVORITES_CHANGED_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const favoriteKeySet = useMemo(() => new Set(favoriteKeys), [favoriteKeys]);
  const isFavorite = useCallback(
    (kind, id) => favoriteKeySet.has(getTemplateFavoriteKey(kind, id)),
    [favoriteKeySet],
  );
  const toggleFavorite = useCallback((kind, id) => {
    const key = getTemplateFavoriteKey(kind, id);
    // Read fresh from storage instead of this instance's state so concurrent
    // gallery instances never clobber each other's toggles.
    const current = readTemplateFavoriteKeys();
    const next = current.includes(key)
      ? current.filter((item) => item !== key)
      : [...current, key];
    writeTemplateFavoriteKeys(next);
    window.dispatchEvent(new CustomEvent(TEMPLATE_FAVORITES_CHANGED_EVENT));
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
