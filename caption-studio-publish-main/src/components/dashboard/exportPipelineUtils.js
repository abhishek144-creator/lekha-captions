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
