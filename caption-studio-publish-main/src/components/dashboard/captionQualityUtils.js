const captionText = (caption) => String(caption?.text || '').trim()

export function analyzeCaptionQuality(captions = [], captionStyle = {}) {
  const timed = (Array.isArray(captions) ? captions : [])
    .filter((caption) => caption && !caption.isTextElement && captionText(caption))
    .map((caption, index) => ({ caption, index }))
    .sort((left, right) => (
      (Number(left.caption.start_time) || 0) - (Number(right.caption.start_time) || 0)
      || left.index - right.index
    ))

  const counts = { uncertain: 0, timing: 0, reading: 0, safeArea: 0 }
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

  return { captionCount: timed.length, counts, details }
}
