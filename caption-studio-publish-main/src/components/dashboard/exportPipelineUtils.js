function toFiniteSeconds(value, fallback = 0) {
  const seconds = Number(value)
  return Number.isFinite(seconds) ? Math.max(0, seconds) : fallback
}

function getCaptionText(caption) {
  return typeof caption?.text === 'string' ? caption.text : ''
}

export function getTimedSpeechCaptions(captions = []) {
  return (Array.isArray(captions) ? captions : [])
    .map((caption, sourceIndex) => ({ caption, sourceIndex }))
    .filter(({ caption }) => (
      caption
      && !caption.isTextElement
      && getCaptionText(caption).trim().length > 0
    ))
    .sort((left, right) => {
      const leftStart = toFiniteSeconds(left.caption.start_time)
      const rightStart = toFiniteSeconds(right.caption.start_time)
      return leftStart - rightStart || left.sourceIndex - right.sourceIndex
    })
    .map(({ caption }) => caption)
}

export function hasExportableVideoContent(captions = []) {
  return (Array.isArray(captions) ? captions : [])
    .some((caption) => getCaptionText(caption).trim().length > 0)
}

export function formatSrtTimestamp(value) {
  const totalMilliseconds = Math.round(toFiniteSeconds(value) * 1000)
  const hours = Math.floor(totalMilliseconds / 3600000)
  const minutes = Math.floor((totalMilliseconds % 3600000) / 60000)
  const seconds = Math.floor((totalMilliseconds % 60000) / 1000)
  const milliseconds = totalMilliseconds % 1000
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`
}

export function buildSrt(captions = []) {
  return getTimedSpeechCaptions(captions)
    .map((caption, index) => {
      const start = toFiniteSeconds(caption.start_time)
      const requestedEnd = toFiniteSeconds(caption.end_time, start)
      const end = Math.max(start + 0.001, requestedEnd)
      return `${index + 1}\n${formatSrtTimestamp(start)} --> ${formatSrtTimestamp(end)}\n${getCaptionText(caption).trim()}\n`
    })
    .join('\n')
}

export function buildPlainText(captions = []) {
  return getTimedSpeechCaptions(captions)
    .map((caption) => getCaptionText(caption).trim())
    .join('\n')
}

export function resolveApiResourceUrl(resourceUrl, apiBaseUrl = '') {
  const rawUrl = String(resourceUrl || '').trim()
  if (!rawUrl) return ''

  // Absolute storage/provider URLs are already fully qualified and must not be
  // rewritten through the application API origin.
  if (/^https?:\/\//i.test(rawUrl)) return rawUrl

  const normalizedBase = String(apiBaseUrl || '').trim().replace(/\/+$/, '')
  if (!normalizedBase || !rawUrl.startsWith('/api/')) return rawUrl

  return `${normalizedBase}${rawUrl}`
}

export function shouldAttachApiAuth(downloadUrl, currentOrigin = '') {
  if (!downloadUrl) return false
  try {
    const fallbackOrigin = currentOrigin || 'http://localhost'
    const resolved = new URL(String(downloadUrl), fallbackOrigin)
    return resolved.origin === fallbackOrigin && resolved.pathname.startsWith('/api')
  } catch {
    return false
  }
}

export function getCaptionedVideoFilename(originalFileName) {
  const leafName = String(originalFileName || '')
    .split(/[\\/]/)
    .pop()
    ?.replace(/\.[^/.]+$/, '')
    .trim()
  const safeBaseName = (leafName || 'export')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/[. ]+$/g, '')
    || 'export'
  return `${safeBaseName}_captioned.mp4`
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null)
}

export function buildTextElementExportStyle(customStyle = {}, position = {}) {
  const effectValue = (camelKey, snakeKey, fallback) => firstDefined(
    customStyle[camelKey],
    customStyle[snakeKey],
    fallback,
  )

  return {
    position_x: position.x ?? customStyle.left ?? 50,
    position_y: position.y ?? customStyle.top ?? 50,
    width: customStyle.width ?? 300,
    height: customStyle.height ?? 0,
    rotation: customStyle.rotation ?? 0,
    scale: customStyle.scale ?? 1,
    z_index: customStyle.zIndex ?? 50,
    border_radius: customStyle.borderRadius ?? 6,
    font_family: customStyle.fontFamily || 'Inter',
    font_size: customStyle.fontSize ?? 18,
    font_weight: customStyle.fontWeight || '500',
    font_style: customStyle.fontStyle || 'normal',
    text_decoration: customStyle.textDecoration || 'none',
    text_color: customStyle.color || '#ffffff',
    text_opacity: customStyle.textOpacity ?? 1,
    text_gradient: customStyle.textGradient || '',
    highlight_color: customStyle.highlightColor || '',
    highlight_gradient: customStyle.highlightGradient || '',
    text_align: customStyle.textAlign || 'center',
    text_transform: customStyle.textTransform || 'none',
    letter_spacing: customStyle.letterSpacing ?? 0,
    line_spacing: customStyle.lineSpacing ?? 1.4,
    word_spacing: customStyle.wordSpacing ?? 0,
    has_background: customStyle.hasBackground !== false,
    background_color: customStyle.backgroundColor || '#000000',
    background_opacity: customStyle.backgroundOpacity ?? 0.6,
    background_h_multiplier: customStyle.backgroundHMultiplier ?? 1.05,
    background_padding: customStyle.padding ?? 8,
    padding: customStyle.padding ?? 8,
    has_stroke: customStyle.hasStroke === true,
    stroke_width: customStyle.strokeWidth ?? 1,
    stroke_color: customStyle.strokeColor || '#000000',
    has_shadow: customStyle.hasShadow === true,
    shadow_color: customStyle.shadowColor || '#000000',
    shadow_blur: customStyle.shadowBlur ?? 4,
    shadow_offset_x: customStyle.shadowOffsetX ?? 0,
    shadow_offset_y: customStyle.shadowOffsetY ?? 2,
    effect_type: effectValue('effectType', 'effect_type', 'none'),
    effect_offset: effectValue('effectOffset', 'effect_offset', 50),
    effect_direction: effectValue('effectDirection', 'effect_direction', -45),
    effect_blur: effectValue('effectBlur', 'effect_blur', 50),
    effect_transparency: effectValue('effectTransparency', 'effect_transparency', 40),
    effect_thickness: effectValue('effectThickness', 'effect_thickness', 50),
    effect_intensity: effectValue('effectIntensity', 'effect_intensity', 50),
    effect_color: effectValue('effectColor', 'effect_color', '#000000'),
  }
}
