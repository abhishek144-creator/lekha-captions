import { resolveScriptFont } from '@/components/dashboard/fontUtils'
import { buildEmotionalCaptionPlan, EMOTIONAL_TEMPLATE_TIMING } from '@/components/dashboard/emotionalTemplateUtils'
import { defaultCaptionStyle } from '@/lib/editorDocument'
import { DEFAULT_CAPTION_POSITION_Y } from './captionDefaults.js'

// Properties templates fully control. They are cleared before a template is
// applied so Template B never inherits background, color, font, spacing, phase
// or animation from Template A. Non-template properties (effects, position_x)
// are preserved.
export const TEMPLATE_OWNED_RESET = {
  template_id: '',
  template_20_id: '',
  template_source: '',
  template_class: '',
  template_name: '',
  template_layout: '',
  template_effect: '',
  template_markup: '',
  template_color_customized: false,
  template_phase_override: undefined,
  // Both galleries set these (the left set extracts letter/line spacing from
  // its authored CSS; the advanced pack sets line/word spacing and a default
  // phase index), so they are template-owned and must reset too — otherwise
  // Template B inherits Template A's spacing or phase selection.
  template_phase_index: 0,
  letter_spacing: 0,
  line_spacing: defaultCaptionStyle.line_spacing,
  word_spacing: defaultCaptionStyle.word_spacing,
  font_family: 'Inter',
  font_size: 17,
  font_weight: '800',
  font_style: 'normal',
  text_color: '#ffffff',
  text_gradient: '',
  text_opacity: 1,
  text_case: 'none',
  secondary_color: '',
  highlight_color: '',
  highlight_gradient: '',
  emphasis_color: '',
  karaoke_color_1: '',
  karaoke_color_2: '',
  karaoke_color_3: '',
  has_background: true,
  background_color: '#000000',
  background_opacity: 0.7,
  background_padding: 6,
  has_stroke: false,
  stroke_color: '#000000',
  stroke_width: 1,
  has_shadow: true,
  shadow_color: '#000000',
  shadow_blur: 4,
  shadow_offset_x: 0,
  shadow_offset_y: 2,
  show_inactive: undefined,
  display_mode: 'sentence',
  position_y: DEFAULT_CAPTION_POSITION_Y,
}

// Per-word fields that describe a dragged/resized layout or a previous
// template's motion. Authored templates own entrance motion, so a leftover
// per-word animation would force every template through the same effect.
const DETACHED_WORD_LAYOUT_KEYS = [
  'x', 'y', 'x_pct', 'y_pct', 'abs_x_pct', 'abs_y_pct',
  'boxWidth', 'textScaleX', 'rotation', 'frozenFontSize',
  'animation', 'animationSpeed',
]

export const stripDetachedWordLayout = (wordStyles = {}) => Object.fromEntries(
  Object.entries(wordStyles).map(([styleKey, styleValue]) => {
    const nextStyle = { ...(styleValue || {}) }
    DETACHED_WORD_LAYOUT_KEYS.forEach((key) => { delete nextStyle[key] })
    return [styleKey, nextStyle]
  }),
)

export const getTemplateSelectionIdentity = (style = {}) => [
  String(style?.template_source || ''),
  String(style?.template_20_id || ''),
  String(style?.template_id || ''),
].join('::')

// Caption fields a template writes; removed when the template is cleared.
const CAPTION_TEMPLATE_FIELDS = [
  'applied_template_style', 'template_id', 'template_20_id', 'template_source',
  'template_class', 'template_name', 'template_layout', 'template_effect',
  'template_markup', 'emotional_mode', 'template_phase_index', 'template_phase_override',
  'imp_word_index', 'imp_word_indices', 'emphasis_color', 'audio_emotion_metrics',
]

// Indic-script safety net: a template's Latin display font (Bodoni, Bebas Neue,
// Oxanium, …) has no Devanagari glyphs, so on Hindi/Marathi captions it
// silently falls back to a default face and the template looks like it "didn't
// apply". Do NOT decide this from the dominant script of all captions joined:
// a Latin-dominant project can still contain Hindi lines. Remap as soon as ANY
// non-text caption needs a script-appropriate face; resolveScriptFont is a
// no-op on captions that don't need swapping. VideoPlayer still resolves
// genuinely mixed projects line by line at render time.
export const resolveTemplateFontForCaptions = (fontFamily, captions) => {
  if (!fontFamily) return fontFamily
  for (const caption of captions) {
    if (!caption || caption.isTextElement) continue
    const mapped = resolveScriptFont(fontFamily, String(caption.text || ''))
    if (mapped && mapped !== fontFamily) return mapped
  }
  return fontFamily
}

// Computes the editor state after applying (or clearing) a template. Pure
// apart from the applied-at timestamp; side effects (font loading, analytics,
// recents) stay with the caller.
export function buildTemplateApplication({
  templateStyle,
  captionStyle,
  captions,
  waveformData,
  duration,
  now = Date.now(),
}) {
  const {
    template_snapshot: _previousTemplateSnapshot,
    template_applied_at: _previousTemplateAppliedAt,
    ...templateStyleForSnapshot
  } = templateStyle || {}
  const hasTemplateSelection = !!(
    templateStyleForSnapshot?.template_id
    || templateStyleForSnapshot?.template_20_id
  )
  const isNewTemplateSelection = hasTemplateSelection && (
    getTemplateSelectionIdentity(templateStyleForSnapshot)
    !== getTemplateSelectionIdentity(captionStyle)
  )
  const templateSnapshot = hasTemplateSelection
    ? JSON.parse(JSON.stringify({
      ...templateStyleForSnapshot,
      emotional_intelligence: true,
      emotional_timing: EMOTIONAL_TEMPLATE_TIMING,
    }))
    : null
  const style = {
    ...captionStyle,
    ...TEMPLATE_OWNED_RESET,
    ...templateStyleForSnapshot,
    template_snapshot: templateSnapshot,
    template_applied_at: templateSnapshot ? now : null,
  }
  const scriptFont = resolveTemplateFontForCaptions(style.font_family, captions)
  if (scriptFont !== style.font_family) style.font_family = scriptFont
  if (templateSnapshot && style.font_family) templateSnapshot.font_family = style.font_family

  const emotionalPlan = templateSnapshot
    ? buildEmotionalCaptionPlan(captions, waveformData, duration, templateSnapshot.template_markup)
    : []
  const emotionalByCaptionId = new Map(emotionalPlan.map((entry) => [entry.captionId, entry]))

  const nextCaptions = captions.map((cap) => {
    if (!cap || cap.isTextElement) return cap
    if (!templateSnapshot) {
      const rest = { ...cap }
      CAPTION_TEMPLATE_FIELDS.forEach((key) => { delete rest[key] })
      return {
        ...rest,
        wordStyles: stripDetachedWordLayout(rest.wordStyles || {}),
      }
    }
    const emotional = emotionalByCaptionId.get(cap.id)
    const requestedPhaseOffset = Number(templateSnapshot.template_phase_override)
    const templatePhaseIndex = templateSnapshot.template_id === 't17'
      ? 1
      : Number.isFinite(requestedPhaseOffset)
        ? requestedPhaseOffset + (emotional?.phaseIndex ?? 0)
        : emotional?.phaseIndex ?? 0
    const templateEmphasisColor = templateSnapshot.highlight_color
      || templateSnapshot.emphasis_color
      || templateSnapshot.secondary_color
      || emotional?.emphasisColor
      || ''
    return {
      ...cap,
      // A genuinely new template starts from its authored word layout. Clear
      // every prior per-word override so detached coordinates, source offsets,
      // resized boxes and frozen template typography cannot leak from the
      // previously selected template.
      wordStyles: isNewTemplateSelection ? {} : stripDetachedWordLayout(cap.wordStyles || {}),
      animation: 'none',
      animationSpeed: 1,
      template_id: templateSnapshot.template_id || '',
      template_20_id: templateSnapshot.template_20_id || '',
      template_source: templateSnapshot.template_source || '',
      template_class: templateSnapshot.template_class || '',
      template_name: templateSnapshot.template_name || '',
      template_layout: templateSnapshot.template_layout || '',
      template_effect: templateSnapshot.template_effect || '',
      template_markup: templateSnapshot.template_markup || '',
      applied_template_style: templateSnapshot,
      emotional_mode: emotional?.mode || 'normal',
      template_phase_index: templatePhaseIndex,
      imp_word_index: emotional?.impWordIndex ?? -1,
      imp_word_indices: emotional?.impWordIndices || [],
      emphasis_color: templateEmphasisColor,
      audio_emotion_metrics: emotional?.audio || null,
    }
  })

  return { style, captions: nextCaptions, templateSnapshot }
}

// Kinds mirror the favorite keys each gallery uses, so "Recent" and favorites
// always refer to the same card.
export const getTemplateRecentEntry = (templateSnapshot) => {
  const sidebarId = templateSnapshot?.template_20_id || ''
  const inspectorId = templateSnapshot?.template_id || ''
  const kind = sidebarId
    ? 'sidebar-template'
    : (/^t\d{2}$/.test(inspectorId) ? 'advanced-template' : 'basic-template')
  return { kind, id: sidebarId || inspectorId }
}
