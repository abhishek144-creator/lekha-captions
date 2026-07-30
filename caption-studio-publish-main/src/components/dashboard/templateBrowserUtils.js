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
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(
      TEMPLATE_FAVORITES_STORAGE_KEY,
      JSON.stringify([...new Set(keys.filter(Boolean).map(String))]),
    );
    return true;
  } catch {
    return false;
  }
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
    if (writeTemplateFavoriteKeys(next)) {
      window.dispatchEvent(new CustomEvent(TEMPLATE_FAVORITES_CHANGED_EVENT));
    } else {
      // Storage can be unavailable in private/locked-down browsers. Keep this
      // gallery usable for the session instead of crashing on a favorite click.
      setFavoriteKeys(next);
    }
  }, []);

  return { favoriteKeys, isFavorite, toggleFavorite };
}

// ── Recently used templates ────────────────────────────────────────────────
// Same storage/event discipline as favorites: every gallery instance re-reads
// on change, and writes always start from fresh storage so concurrent mounts
// never clobber each other. Keys reuse getTemplateFavoriteKey so a recent
// entry and a favorite entry for the same card always agree.
const TEMPLATE_RECENTS_STORAGE_KEY = 'captionStudio.templateRecents.v1';
const TEMPLATE_RECENTS_CHANGED_EVENT = 'lekha-template-recents-changed';
const TEMPLATE_RECENTS_LIMIT = 12;

function readRecentTemplateKeys() {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(TEMPLATE_RECENTS_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : [];
  } catch {
    return [];
  }
}

export function recordRecentTemplate(kind, id) {
  if (typeof window === 'undefined' || !id) return;
  const key = getTemplateFavoriteKey(kind, id);
  const next = [key, ...readRecentTemplateKeys().filter((item) => item !== key)]
    .slice(0, TEMPLATE_RECENTS_LIMIT);
  try {
    window.localStorage.setItem(TEMPLATE_RECENTS_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(TEMPLATE_RECENTS_CHANGED_EVENT));
  } catch {
    // Storage unavailable (private mode) — recents are a convenience, skip.
  }
}

export function useRecentTemplates() {
  const [recentKeys, setRecentKeys] = useState(() => readRecentTemplateKeys());

  useEffect(() => {
    const sync = () => setRecentKeys(readRecentTemplateKeys());
    window.addEventListener(TEMPLATE_RECENTS_CHANGED_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(TEMPLATE_RECENTS_CHANGED_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const recentKeySet = useMemo(() => new Set(recentKeys), [recentKeys]);
  const isRecent = useCallback(
    (kind, id) => recentKeySet.has(getTemplateFavoriteKey(kind, id)),
    [recentKeySet],
  );

  return { recentKeys, isRecent };
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
