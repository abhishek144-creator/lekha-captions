const visibleTokens = (text) => {
  const source = String(text || '')
  const compactScript = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]/u.test(source)
  if (compactScript && typeof Intl?.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'word' })
    return [...segmenter.segment(source)]
      .filter((segment) => segment.isWordLike)
      .map((segment) => ({
        value: segment.segment,
        start: segment.index,
        end: segment.index + segment.segment.length,
      }))
  }
  const tokens = []
  const matcher = /\S+/gu
  let match = matcher.exec(source)
  while (match) {
    tokens.push({ value: match[0], start: match.index, end: match.index + match[0].length })
    match = matcher.exec(source)
  }
  return tokens
}

const normalizedToken = (value) => String(value || '').normalize('NFKC').toLocaleLowerCase()

const lcsMatches = (previous, next) => {
  const rows = Array.from({ length: previous.length + 1 }, () => Array(next.length + 1).fill(0))
  for (let left = previous.length - 1; left >= 0; left -= 1) {
    for (let right = next.length - 1; right >= 0; right -= 1) {
      rows[left][right] = normalizedToken(previous[left].value) === normalizedToken(next[right].value)
        ? rows[left + 1][right + 1] + 1
        : Math.max(rows[left + 1][right], rows[left][right + 1])
    }
  }

  const matches = []
  let left = 0
  let right = 0
  while (left < previous.length && right < next.length) {
    if (normalizedToken(previous[left].value) === normalizedToken(next[right].value)) {
      matches.push([left, right])
      left += 1
      right += 1
    } else if (rows[left + 1][right] >= rows[left][right + 1]) {
      left += 1
    } else {
      right += 1
    }
  }
  return matches
}

const remapIndexedStyles = (styles, captionId, oldToNew) => {
  const remapped = {}
  Object.entries(styles || {}).forEach(([key, value]) => {
    if (!key.startsWith(`${captionId}-`)) return
    const oldIndex = Number(key.slice(String(captionId).length + 1))
    const newIndex = oldToNew.get(oldIndex)
    if (Number.isInteger(newIndex)) remapped[`${captionId}-${newIndex}`] = value
  })
  return remapped
}

const remapEmphasis = (caption, oldToNew) => {
  const previous = Array.isArray(caption.imp_word_indices)
    ? caption.imp_word_indices.map(Number)
    : []
  const single = Number(caption.imp_word_index)
  if (Number.isInteger(single) && single >= 0 && !previous.includes(single)) previous.push(single)
  const next = previous
    .map((index) => oldToNew.get(index))
    .filter((index) => Number.isInteger(index))
  return { imp_word_index: next[0] ?? -1, imp_word_indices: next }
}

export function reconcileCaptionText(caption, nextText) {
  const text = String(nextText ?? '')
  const previousTokens = visibleTokens(caption?.text)
  const nextTokens = visibleTokens(text)
  const matches = lcsMatches(previousTokens, nextTokens)
  const oldToNew = new Map(matches)
  const previousWords = Array.isArray(caption?.words) ? caption.words : []
  const hasUsableWordAlignment = previousWords.length === previousTokens.length && previousWords.length > 0

  const words = hasUsableWordAlignment
    ? nextTokens.map((token, newIndex) => {
        const match = matches.find(([, candidate]) => candidate === newIndex)
        if (!match) return { word: token.value, alignment_status: 'unaligned' }
        const previousWord = previousWords[match[0]] || {}
        return { ...previousWord, word: token.value }
      })
    : []
  const needsReview = hasUsableWordAlignment
    ? matches.length !== previousTokens.length || matches.length !== nextTokens.length
    : nextTokens.length > 0

  return {
    ...caption,
    text,
    words,
    wordStyles: remapIndexedStyles(caption?.wordStyles, caption?.id, oldToNew),
    ...remapEmphasis(caption || {}, oldToNew),
    word_alignment_status: needsReview ? 'needs_review' : 'aligned',
    ...(needsReview
      ? { word_alignment_note: 'Caption text changed. Review words without measured timing before export.' }
      : { word_alignment_note: '' }),
  }
}

export function duplicateCaptionWithTiming(caption, newId, gapSeconds = 0.1) {
  const start = Number(caption?.start_time) || 0
  const end = Math.max(start + 0.1, Number(caption?.end_time) || start + 0.1)
  const newStart = end + gapSeconds
  const delta = newStart - start
  const oldToNew = new Map(visibleTokens(caption?.text).map((_, index) => [index, index]))
  const wordStyles = remapIndexedStyles(caption?.wordStyles, caption?.id, oldToNew)
  const renamedStyles = Object.fromEntries(Object.entries(wordStyles).map(([key, value]) => (
    [`${newId}-${key.slice(String(caption.id).length + 1)}`, value]
  )))
  return {
    ...caption,
    id: newId,
    start_time: newStart,
    end_time: newStart + (end - start),
    words: Array.isArray(caption?.words)
      ? caption.words.map((word) => ({
          ...word,
          ...(Number.isFinite(Number(word?.start)) ? { start: Number(word.start) + delta } : {}),
          ...(Number.isFinite(Number(word?.end)) ? { end: Number(word.end) + delta } : {}),
        }))
      : [],
    wordStyles: renamedStyles,
  }
}

export function splitCaptionAtBoundary(caption, cursorPosition, newId) {
  const text = String(caption?.text || '')
  const tokens = visibleTokens(text)
  const cursor = Math.max(0, Math.min(text.length, Number(cursorPosition) || 0))
  const insideToken = tokens.some((token) => cursor > token.start && cursor < token.end)
  if (insideToken) return { error: 'Place the cursor between words before splitting.' }

  const firstCount = tokens.filter((token) => token.end <= cursor).length
  if (firstCount <= 0 || firstCount >= tokens.length) {
    return { error: 'A split needs words on both sides of the cursor.' }
  }

  const firstText = text.slice(0, cursor).trim()
  const secondText = text.slice(cursor).trim()
  const words = Array.isArray(caption?.words) && caption.words.length === tokens.length ? caption.words : []
  const firstWords = words.slice(0, firstCount)
  const secondWords = words.slice(firstCount)
  const firstEnd = Number(firstWords[firstWords.length - 1]?.end)
  const secondStart = Number(secondWords[0]?.start)
  const captionStart = Number(caption?.start_time) || 0
  const captionEnd = Math.max(captionStart + 0.02, Number(caption?.end_time) || captionStart + 0.02)
  const measuredBoundaryIsSafe = Number.isFinite(firstEnd)
    && Number.isFinite(secondStart)
    && firstEnd <= secondStart
    && firstEnd >= captionStart
    && secondStart <= captionEnd
  const boundary = measuredBoundaryIsSafe
    ? (firstEnd + secondStart) / 2
    : (captionStart + captionEnd) / 2

  const firstOldToNew = new Map(Array.from({ length: firstCount }, (_, index) => [index, index]))
  const secondOldToNew = new Map(Array.from({ length: tokens.length - firstCount }, (_, index) => [index + firstCount, index]))
  const firstEmphasis = remapEmphasis(caption, firstOldToNew)
  const secondEmphasis = remapEmphasis(caption, secondOldToNew)
  const firstStyles = remapIndexedStyles(caption?.wordStyles, caption?.id, firstOldToNew)
  const secondStyles = Object.fromEntries(
    Object.entries(remapIndexedStyles(caption?.wordStyles, caption?.id, secondOldToNew))
      .map(([key, value]) => [`${newId}-${key.slice(String(caption.id).length + 1)}`, value]),
  )
  const timingStatus = words.length && measuredBoundaryIsSafe ? 'aligned' : 'needs_review'

  return {
    captions: [
      {
        ...caption,
        text: firstText,
        end_time: boundary,
        words: timingStatus === 'aligned' ? firstWords : [],
        wordStyles: firstStyles,
        ...firstEmphasis,
        word_alignment_status: timingStatus,
        word_alignment_note: timingStatus === 'aligned' ? '' : 'Split timing needs review.',
      },
      {
        ...caption,
        id: newId,
        text: secondText,
        start_time: boundary,
        words: timingStatus === 'aligned' ? secondWords : [],
        wordStyles: secondStyles,
        ...secondEmphasis,
        word_alignment_status: timingStatus,
        word_alignment_note: timingStatus === 'aligned' ? '' : 'Split timing needs review.',
      },
    ],
  }
}

export function invalidateWordTimingOutsideCaption(caption) {
  if (caption?.isTextElement || !Array.isArray(caption?.words) || !caption.words.length) return caption
  const start = Number(caption.start_time) || 0
  const end = Number(caption.end_time) || start
  const fits = caption.words.every((word) => {
    const wordStart = Number(word?.start)
    const wordEnd = Number(word?.end)
    return Number.isFinite(wordStart) && Number.isFinite(wordEnd)
      && wordStart >= start - 0.001 && wordEnd <= end + 0.001 && wordEnd >= wordStart
  })
  if (fits) return caption
  return {
    ...caption,
    words: [],
    word_alignment_status: 'needs_review',
    word_alignment_note: 'Caption timing changed. Word timing was invalidated instead of inventing new measurements.',
  }
}
