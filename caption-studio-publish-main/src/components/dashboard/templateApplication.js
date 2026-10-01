import { resolveScriptFont } from './fontUtils'
import { buildEmotionalCaptionPlan, EMOTIONAL_TEMPLATE_TIMING } from './emotionalTemplateUtils'

// Properties that templates fully control. They are cleared before applying so
// Template B never inherits background, color, font, spacing, phase, or
// animation from Template A. Non-template properties (effects, position_x) are
// preserved.
export function templateOwnedReset(defaultCaptionStyle) {
  return {
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
    // Both galleries set these (the left set extracts letter/line spacing
    // from its authored CSS; the advanced pack sets line/word spacing and a
    // default phase index), so they are template-owned and must reset too —
    // otherwise Template B inherits Template A's spacing or phase selection.
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
    position_y: 75,
  }
}

export const stripDetachedWordLayout = (wordStyles = {}) => Object.fromEntries(
  Object.entries(wordStyles).map(([styleKey, styleValue]) => {
    const nextStyle = { ...(styleValue || {}) }
    delete nextStyle.x
    delete nextStyle.y
    delete nextStyle.x_pct
    delete nextStyle.y_pct
    delete nextStyle.abs_x_pct
    delete nextStyle.abs_y_pct
    delete nextStyle.boxWidth
    delete nextStyle.textScaleX
    delete nextStyle.rotation
    delete nextStyle.frozenFontSize
    // Authored templates own entrance motion. Keeping a previous per-word
    // animation here forces multiple templates through the same generic effect.
    delete nextStyle.animation
    delete nextStyle.animationSpeed
    return [styleKey, nextStyle]
  }),
)

export const getTemplateSelectionIdentity = (style = {}) => [
  String(style?.template_source || ''),
  String(style?.template_20_id || ''),
  String(style?.template_id || ''),
].join('::')

// Favorites and "Recent" use the same kind keys per gallery.
export function templateRecentKind(templateSnapshot = {}) {
  const sidebarId = templateSnapshot.template_20_id || ''
  const inspectorId = templateSnapshot.template_id || ''
  const kind = sidebarId
    ? 'sidebar-template'
    : (/^t\d{2}$/.test(inspectorId) ? 'advanced-template' : 'basic-template')
  return { kind, id: sidebarId || inspectorId }
}

/**
 * Apply a template (or clear it, when templateStyle has no template id) to the
 * project's style and captions. Pure: the caller loads fonts, records history
 * and analytics.
 */
export function applyTemplateToProject({
  captionStyle,
  captions,
  templateStyle,
  defaultCaptionStyle,
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
  const merged = {
    ...captionStyle,
    ...templateOwnedReset(defaultCaptionStyle),
    ...templateStyleForSnapshot,
    template_snapshot: templateSnapshot,
    template_applied_at: templateSnapshot ? now : null,
  }
  // Indic-script safety net: a template's Latin display font (Bodoni, Bebas Neue,
  // Oxanium, …) has no Devanagari glyphs, so on Hindi/Marathi captions it silently
  // falls back to a default face and the template looks like it "didn't apply".
  // Swap in a Devanagari font of matching character so the template visibly lands.
  //
  // IMPORTANT: do NOT decide this from the *dominant* script of all captions joined.
  // A project can be Latin-dominant overall (English hooks, numbers, @handles, 8+
  // mixed elements) yet still contain Hindi caption lines. Aggregate detection then
  // returns 'latin', the Latin template font is kept, and every Hindi line renders in
  // a glyphless fallback = "template not applied / plain white". Instead remap as soon
  // as ANY non-text caption needs a different (script-appropriate) face. resolveScriptFont
  // is a no-op on captions that don't need swapping, so the first one that DOES need it
  // (e.g. the Hindi line) wins. Render-time per-caption resolution in VideoPlayer still
  // handles genuinely mixed projects line-by-line; this just makes the stored font (and
  // the font we eagerly load) correct for the script actually present.
  if (merged.font_family) {
    let mappedFont = merged.font_family
    for (const c of captions) {
      if (!c || c.isTextElement) continue
      const m = resolveScriptFont(merged.font_family, String(c.text || ''))
      if (m && m !== merged.font_family) { mappedFont = m; break }
    }
    if (mappedFont !== merged.font_family) merged.font_family = mappedFont
    if (templateSnapshot) templateSnapshot.font_family = merged.font_family
  }
  const emotionalPlan = templateSnapshot
    ? buildEmotionalCaptionPlan(captions, waveformData, duration, templateSnapshot.template_markup)
    : []
  const emotionalByCaptionId = new Map(emotionalPlan.map((entry) => [entry.captionId, entry]))
  const nextCaptions = captions.map(cap => {
    if (!cap || cap.isTextElement) return cap
    if (!templateSnapshot) {
      const {
        applied_template_style: _appliedTemplateStyle,
        template_id: _captionTemplateId,
        template_20_id: _captionTemplate20Id,
        template_source: _captionTemplateSource,
        template_class: _captionTemplateClass,
        template_name: _captionTemplateName,
        template_layout: _captionTemplateLayout,
        template_effect: _captionTemplateEffect,
        template_markup: _captionTemplateMarkup,
        emotional_mode: _emotionalMode,
        template_phase_index: _templatePhaseIndex,
        template_phase_override: _templatePhaseOverride,
        imp_word_index: _impWordIndex,
        imp_word_indices: _impWordIndices,
        emphasis_color: _emphasisColor,
        audio_emotion_metrics: _audioEmotionMetrics,
        ...rest
      } = cap
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
      // A genuinely new template starts from its authored word layout.
      // Clear every prior per-word override so detached coordinates, source
      // offsets, resized boxes, and frozen template typography cannot leak
      // from the previously selected template.
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
  return { merged, nextCaptions, templateSnapshot }
}
