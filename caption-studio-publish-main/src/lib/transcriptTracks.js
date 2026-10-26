// Turns a transcription response into editor caption tracks.

// "1-2" -> 1..2 words per caption; "3" -> exactly 3; "dynamic" (or unset) ->
// natural audio/phrase boundaries, without a fixed word count.
export const parseWordsPerLine = (wordsPerLine) => {
  let minWords = 0
  let maxWords = 0
  if (wordsPerLine && wordsPerLine !== 'dynamic') {
    const rangeParts = String(wordsPerLine).split('-').map(Number)
    if (rangeParts.length === 2) {
      minWords = rangeParts[0]
      maxWords = rangeParts[1]
    } else if (rangeParts.length === 1 && !Number.isNaN(rangeParts[0]) && rangeParts[0] > 0) {
      minWords = rangeParts[0]
      maxWords = rangeParts[0]
    }
  }
  return { minWords, maxWords }
}

// Caption IDs are `${timestamp}-${index}` with no spaces: they prefix word
// layout keys, and a space breaks every word-layout lookup.
export const captionsFromTranscript = (transcriptCaptions = [], now = Date.now()) => (
  transcriptCaptions.map((caption, index) => ({
    ...caption,
    text: caption?.text || '',
    start_time: caption?.start_time || 0,
    end_time: caption?.end_time || 3,
    id: `${now}-${index}`,
    words: caption?.words || [],
  }))
)

// "Double line" style: merge consecutive pairs. Both language tracks use the
// same IDs so the editor can compare and switch tracks reliably.
export const mergeCaptionPairs = (items, idPrefix, reference = items) => {
  const merged = []
  for (let index = 0; index < items.length; index += 1) {
    const current = reference[index]
    const next = reference[index + 1]
    const joinsPhrase = next && items[index + 1]
      && next.start_time - current.end_time >= -0.001
      && next.start_time - current.end_time < 0.3
      && next.end_time - current.start_time <= 6
      && !/[.!?।॥۔؟。！？]["”’»)]*$/u.test(current.text.trim())
      && current.text.length + next.text.length <= 84
    if (joinsPhrase) {
      merged.push({
        ...items[index],
        text: `${items[index].text}\n${items[index + 1].text}`,
        start_time: items[index].start_time,
        end_time: items[index + 1].end_time,
        id: `${idPrefix}-${merged.length}`,
        words: [...(items[index].words || []), ...(items[index + 1].words || [])],
      })
      index += 1
    } else {
      merged.push({ ...items[index], id: `${idPrefix}-${merged.length}` })
    }
  }
  return merged
}

// Translated text lives in its own track so another language never destroys
// the original transcript or its timing. The translation becomes active.
export const buildCaptionTracks = ({ sourceCaptions, sourceLanguage, translatedCaptions, targetLanguage }) => {
  const tracks = [{
    id: 'source',
    language: sourceLanguage,
    label: `Original · ${sourceLanguage}`,
    captions: sourceCaptions,
  }]
  if (!translatedCaptions) {
    return { tracks, activeTrackId: 'source', captions: sourceCaptions }
  }
  const translatedTrackId = translationTrackId(targetLanguage)
  tracks.push({
    id: translatedTrackId,
    language: targetLanguage,
    label: `${targetLanguage} · translated`,
    captions: translatedCaptions,
  })
  return { tracks, activeTrackId: translatedTrackId, captions: translatedCaptions }
}

// Word timestamps belong to the source language and cannot be aligned with
// translated words, so translated captions drop them.
export const applyTranslation = (sourceCaptions, translatedItems = [], targetLanguage = '') => {
  const translatedText = new Map()
  translatedItems.forEach((item) => { if (item.id) translatedText.set(item.id, item.text) })
  return sourceCaptions.map((caption) => ({
    ...caption,
    text: translatedText.get(caption.id) || caption.text,
    ...(targetLanguage ? { language: targetLanguage } : {}),
    words: [],
    wordStyles: {},
  }))
}

export const translationTrackId = (targetLanguage) => `translation-${String(targetLanguage).toLowerCase()}`

// Adds (or refreshes) a translated track made from the editor's Translate
// control. Free-text overlays are not transcript lines, so they stay as-is.
export const upsertTranslationTrack = (tracks, { sourceCaptions, translatedItems, targetLanguage, label }) => {
  const transcriptCaptions = sourceCaptions.filter((caption) => !caption.isTextElement)
  const translated = applyTranslation(transcriptCaptions, translatedItems, targetLanguage)
  const translatedById = new Map(translated.map((caption) => [caption.id, caption]))
  const captions = sourceCaptions.map((caption) => translatedById.get(caption.id) || caption)
  const id = translationTrackId(targetLanguage)
  const track = {
    id,
    language: targetLanguage,
    label: `${label || targetLanguage} · translated`,
    captions,
  }
  const exists = tracks.some((item) => item.id === id)
  return {
    tracks: exists ? tracks.map((item) => (item.id === id ? track : item)) : [...tracks, track],
    activeTrackId: id,
    captions,
  }
}
