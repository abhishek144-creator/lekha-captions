import { DEFAULT_CAPTION_POSITION_Y } from './captionDefaults.js'

// The editor "document": everything a saved draft restores. Pure helpers so
// restore, reset and refresh all normalize a draft the same way.

export const defaultCaptionStyle = {
  font_family: 'Inter',
  font_size: 17,
  font_weight: '800',
  font_style: 'normal',
  line_spacing: 1.4,
  word_spacing: 1,
  is_bold: false,
  is_caps: false,
  text_case: 'none',
  text_align: 'center',
  text_color: '#ffffff',
  text_gradient: '',
  text_opacity: 1,
  highlight_color: '',
  highlight_gradient: '',
  has_background: false,
  background_opacity: 0.7,
  background_padding: 6,
  background_h_multiplier: 1.05,
  background_color: '#000000',
  has_stroke: false,
  has_shadow: true,
  has_animation: false,
  position: 'bottom',
  position_y: DEFAULT_CAPTION_POSITION_Y,
  max_lines: 2,
  max_chars: 30,
  auto_rotation: false,
  scale: 1
}

export const defaultEditorSettings = () => ({ language: 'english', style: 'viral_hook' })

// Template sources that still ship in the bundle. Restored sessions can carry
// styles from removed sets (e.g. 'lekha-49'): the markup lookup then falls back
// to the FIRST card of another asset and silently renders the wrong template.
export const LIVE_TEMPLATE_SOURCES = new Set(['', 'lekha-20', 'lekha-lc', 'lekha-basic', 'lekha-advanced'])

const REMOVED_TEMPLATE_FIELDS = [
  'template_id', 'template_20_id', 'template_source', 'template_class',
  'template_name', 'template_layout', 'template_effect', 'template_markup',
  'template_snapshot', 'template_applied_at', 'template_phase_index', 'template_phase_override',
]

export const stripRemovedTemplateSource = (style) => {
  if (!style || typeof style !== 'object') return style
  const sourceIsLive = LIVE_TEMPLATE_SOURCES.has(String(style.template_source || ''))
  const snapshotIsLive = !style.template_snapshot
    || LIVE_TEMPLATE_SOURCES.has(String(style.template_snapshot.template_source || ''))
  if (sourceIsLive && snapshotIsLive) return style
  const next = { ...style }
  REMOVED_TEMPLATE_FIELDS.forEach((key) => { delete next[key] })
  return next
}

export const sanitizeRestoredCaption = (caption) => {
  if (!caption || typeof caption !== 'object' || caption.isTextElement) return caption
  const appliedSource = String(caption.applied_template_style?.template_source ?? caption.template_source ?? '')
  if (LIVE_TEMPLATE_SOURCES.has(appliedSource) && LIVE_TEMPLATE_SOURCES.has(String(caption.template_source || ''))) {
    return caption
  }
  const next = { ...caption }
  REMOVED_TEMPLATE_FIELDS.forEach((key) => { delete next[key] })
  delete next.applied_template_style
  return next
}

export const getLanguageDisplayName = (value) => {
  const language = String(value || '').trim()
  if (!language) return 'Original'
  const languageCode = language.toLowerCase().split(/[-_]/)[0]
  if (/^[a-z]{2,3}$/.test(languageCode) && typeof Intl.DisplayNames === 'function') {
    try {
      return new Intl.DisplayNames(['en'], { type: 'language' }).of(languageCode) || language
    } catch {
      // Keep the provider label if the browser does not recognize its code.
    }
  }
  return language.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase())
}

export const getLanguageIdentity = (value) => {
  const languageBase = String(value || '').trim().toLowerCase().split(/[-_]/)[0]
  return getLanguageDisplayName(languageBase).trim().toLocaleLowerCase('en')
}

export const normalizeRestoredCaptionTrackState = (tracks, captions, activeTrackId, language = 'Original') => {
  const safeCaptions = Array.isArray(captions) ? captions.map(sanitizeRestoredCaption) : []
  const seenIds = new Set()
  const restored = []
  if (Array.isArray(tracks)) {
    tracks.forEach((track) => {
      const id = typeof track?.id === 'string' ? track.id.trim() : ''
      if (!id || !Array.isArray(track.captions) || seenIds.has(id)) return
      seenIds.add(id)
      restored.push({
        ...track,
        id,
        captions: track.captions.map(sanitizeRestoredCaption),
      })
    })
  }
  if (!restored.length && safeCaptions.length) {
    const trackLanguage = String(language || 'Original')
    restored.push({
      id: 'source',
      language: trackLanguage,
      label: `Original · ${trackLanguage}`,
      captions: safeCaptions,
    })
  }
  const selectedTrack = restored.find((track) => track.id === activeTrackId) || restored[0] || null
  return {
    tracks: restored,
    activeTrackId: selectedTrack?.id || 'source',
    captions: selectedTrack?.captions || safeCaptions,
  }
}

export const normalizeCaptionStyle = (style = {}) => {
  const merged = { ...defaultCaptionStyle, ...stripRemovedTemplateSource(style) }
  if (!merged.template_id && Number(merged.font_size) <= 18 && String(merged.font_weight || '500') === '500') {
    merged.font_size = defaultCaptionStyle.font_size
    merged.font_weight = defaultCaptionStyle.font_weight
    merged.has_shadow = true
  }
  return merged
}

const clone = (value) => JSON.parse(JSON.stringify(value))

// An empty editor: what New Project, account changes and a clean entry show.
export const emptyEditorDocument = () => ({
  videoUrl: '',
  captions: [],
  captionTracks: [],
  activeCaptionTrackId: 'source',
  captionStyle: defaultCaptionStyle,
  duration: 0,
  fileId: null,
  originalFileName: '',
  projectId: null,
  settings: defaultEditorSettings(),
})

// Normalizes a saved draft (browser, account or reset point) into a complete,
// deep-copied editor document. Removed template sets and duplicate or invalid
// language tracks are dropped so the restored editor renders what was saved.
export const restoreEditorDocument = (draft = {}) => {
  const restoredCaptions = (draft.captions || []).map(sanitizeRestoredCaption)
  const trackState = normalizeRestoredCaptionTrackState(
    draft.captionTracks,
    restoredCaptions,
    draft.activeCaptionTrackId,
    draft.settings?.language || 'Original',
  )
  return {
    videoUrl: draft.videoUrl || '',
    captions: clone(trackState.captions),
    captionTracks: clone(trackState.tracks),
    activeCaptionTrackId: trackState.activeTrackId,
    captionStyle: clone(normalizeCaptionStyle(draft.captionStyle || defaultCaptionStyle)),
    duration: draft.duration || 0,
    fileId: draft.fileId || null,
    originalFileName: draft.originalFileName || '',
    projectId: draft.projectId || null,
    settings: clone(draft.settings || defaultEditorSettings()),
  }
}
