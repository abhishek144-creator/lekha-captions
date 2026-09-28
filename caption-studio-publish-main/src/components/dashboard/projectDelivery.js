const bounded = (value, fallback, min = 0, max = 100) => {
  const number = Number(value ?? fallback)
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback
}

export function deliveryGeometry(style = {}) {
  return {
    aspect: ['9:16', '1:1', '16:9'].includes(style.export_aspect_ratio) ? style.export_aspect_ratio : '9:16',
    fit: style.frame_fit === 'contain' ? 'contain' : 'cover',
    x: bounded(style.frame_x, 50),
    y: bounded(style.frame_y, 50),
    safeX: bounded(style.safe_area_x, 8, 0, 30),
    safeY: bounded(style.safe_area_y, 10, 0, 30),
  }
}

export function videoFrameStyle(style = {}) {
  const frame = deliveryGeometry(style)
  return { objectFit: frame.fit, objectPosition: `${frame.x}% ${frame.y}%` }
}

// Secondary tracks use segment timing. Translation must never borrow source
// word alignment. This same derived layer is consumed by preview and renderer.
export function bilingualLayers(tracks, activeId, style = {}) {
  const track = tracks.find((item) => item.id === style.bilingual_track_id && item.id !== activeId)
  if (!track) return []
  return (track.captions || []).filter((caption) => !caption.isTextElement && caption.text?.trim()).map((caption) => ({
    id: `bilingual-${track.id}-${caption.id}`,
    text: caption.text,
    start_time: caption.start_time,
    end_time: caption.end_time,
    isTextElement: true,
    readOnly: true,
    words: [],
    animation: 'none',
    customStyle: {
      fontFamily: style.bilingual_font_family || 'Inter',
      fontSize: bounded(style.bilingual_font_size, 17, 8, 60),
      fontWeight: '600', color: style.bilingual_color || '#ffffff',
      top: bounded(style.bilingual_position_y, 88, 5, 95), left: 50,
      width: 300, textAlign: 'center', hasBackground: true,
      backgroundColor: '#000000', backgroundOpacity: 0.85, padding: 6,
    },
  }))
}

export function bilingualSubtitles(primary, secondary) {
  if (!secondary.length) return primary
  const speech = primary.filter((caption) => !caption.isTextElement)
  const all = [...speech, ...secondary]
  const boundaries = [...new Set(all.flatMap((caption) => [Number(caption.start_time), Number(caption.end_time)]))]
    .filter(Number.isFinite).sort((a, b) => a - b)
  return boundaries.slice(0, -1).flatMap((start, index) => {
    const end = boundaries[index + 1]
    const text = all.filter((caption) => caption.start_time < end && caption.end_time > start)
      .map((caption) => caption.text.trim()).join('\n')
    return text ? [{ id: `bilingual-cue-${index}`, text, start_time: start, end_time: end }] : []
  })
}
