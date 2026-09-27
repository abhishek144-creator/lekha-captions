const captionText = (caption) => String(caption?.text || '').trim()

const parseHexColor = (value) => {
  const hex = String(value || '').trim().replace(/^#/, '')
  if (!/^[0-9a-f]{6}$/i.test(hex)) return null
  return [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255)
}

const relativeLuminance = (rgb) => {
  if (!rgb) return null
  const linear = rgb.map((channel) => (
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  ))
  return (0.2126 * linear[0]) + (0.7152 * linear[1]) + (0.0722 * linear[2])
}

export function captionContrastRatio(textColor, backgroundColor) {
  const text = relativeLuminance(parseHexColor(textColor))
  const background = relativeLuminance(parseHexColor(backgroundColor))
  if (text === null || background === null) return null
  return (Math.max(text, background) + 0.05) / (Math.min(text, background) + 0.05)
}

export function analyzeCaptionQuality(captions = [], captionStyle = {}) {
  const timed = (Array.isArray(captions) ? captions : [])
    .filter((caption) => caption && !caption.isTextElement && captionText(caption))
    .map((caption, index) => ({ caption, index }))
    .sort((left, right) => (
      (Number(left.caption.start_time) || 0) - (Number(right.caption.start_time) || 0)
      || left.index - right.index
    ))

  const counts = { uncertain: 0, timing: 0, reading: 0, safeArea: 0, contrast: 0 }
  const details = []

  timed.forEach(({ caption }, index) => {
    const text = captionText(caption)
    const start = Number(caption.start_time) || 0
    const end = Number(caption.end_time) || start
    const seconds = end - start

    if (caption.word_alignment_status === 'needs_review'
        || /\?{2,}|\b(?:TODO|FIXME|PLACEHOLDER)\b|(\b[\p{L}\p{N}'’-]+\b)(?:\s+\1){2,}/iu.test(text)) {
      counts.uncertain += 1
    }

    if (seconds > 0 && text.length / seconds > 22) counts.reading += 1

    if (index > 0) {
      const previous = timed[index - 1].caption
      const previousEnd = Number(previous.end_time) || 0
      const gap = start - previousEnd
      if (gap > 1.5 || gap < -0.12) counts.timing += 1
    }

    const x = Number(caption.position_x ?? captionStyle.position_x)
    const y = Number(caption.position_y ?? captionStyle.position_y)
    if ((Number.isFinite(x) && (x < 7 || x > 93)) || (Number.isFinite(y) && (y < 8 || y > 92))) {
      counts.safeArea += 1
    }
  })

  const hasProtectiveEffect = Boolean(captionStyle.has_stroke || captionStyle.has_shadow)
  if (timed.length) {
    if (captionStyle.has_background) {
      const contrast = captionContrastRatio(captionStyle.text_color || '#ffffff', captionStyle.background_color || '#000000')
      const backgroundOpacity = Number(captionStyle.background_opacity ?? 1)
      if ((contrast !== null && contrast < 4.5) || (backgroundOpacity < 0.65 && !hasProtectiveEffect)) {
        counts.contrast = timed.length
      }
    } else if (!hasProtectiveEffect) {
      // A video frame changes continuously, so unprotected text cannot make a
      // dependable contrast promise even when its chosen color is bright.
      counts.contrast = timed.length
    }
  }

  if (counts.uncertain) details.push({
    key: 'uncertain',
    title: 'Possible transcript artifacts',
    detail: `${counts.uncertain} caption check${counts.uncertain === 1 ? '' : 's'} need attention because text alignment changed or transcript artifacts were detected.`,
  })
  if (counts.timing) details.push({
    key: 'timing',
    title: 'Check caption gaps and overlaps',
    detail: `${counts.timing} transition${counts.timing === 1 ? '' : 's'} have a long gap or overlapping timings.`,
  })
  if (counts.reading) details.push({
    key: 'reading',
    title: 'Dense reading speed',
    detail: `${counts.reading} caption${counts.reading === 1 ? '' : 's'} contain more than about 22 characters per second. Review these against the video.`,
  })
  if (counts.safeArea) details.push({
    key: 'safe-area',
    title: 'Check the platform safe area',
    detail: `${counts.safeArea} caption${counts.safeArea === 1 ? '' : 's'} use a position close to the edge of the output frame.`,
  })
  if (counts.contrast) details.push({
    key: 'contrast',
    title: 'Improve caption contrast',
    detail: captionStyle.has_background
      ? 'The selected text and background colors are below the recommended 4.5:1 contrast ratio, or the background is too transparent without a protective outline.'
      : 'Captions have no background, outline, or shadow. Add one so changing video frames cannot make the text unreadable.',
  })

  return { captionCount: timed.length, counts, details }
}
