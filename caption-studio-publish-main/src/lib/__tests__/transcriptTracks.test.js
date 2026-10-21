import { describe, expect, it } from 'vitest'
import {
  applyTranslation,
  buildCaptionTracks,
  captionsFromTranscript,
  mergeCaptionPairs,
  parseWordsPerLine,
  upsertTranslationTrack,
} from '../transcriptTracks'

describe('parseWordsPerLine', () => {
  it('reads ranges, single counts and the dynamic default', () => {
    expect(parseWordsPerLine('1-2')).toEqual({ minWords: 1, maxWords: 2 })
    expect(parseWordsPerLine('3')).toEqual({ minWords: 3, maxWords: 3 })
    expect(parseWordsPerLine('dynamic')).toEqual({ minWords: 5, maxWords: 6 })
    expect(parseWordsPerLine(undefined)).toEqual({ minWords: 5, maxWords: 6 })
    expect(parseWordsPerLine('abc')).toEqual({ minWords: 5, maxWords: 6 })
  })
})

describe('captionsFromTranscript', () => {
  it('creates space-free ids and safe timing defaults', () => {
    const captions = captionsFromTranscript([{ text: 'hi', start_time: 1, end_time: 2, words: [{ word: 'hi' }] }, {}], 42)
    expect(captions.map((caption) => caption.id)).toEqual(['42-0', '42-1'])
    expect(captions[1]).toEqual({ text: '', start_time: 0, end_time: 3, id: '42-1', words: [] })
    expect(captions.every((caption) => !/\s/.test(caption.id))).toBe(true)
  })
})

describe('mergeCaptionPairs', () => {
  it('joins consecutive captions onto two lines and keeps a trailing single', () => {
    const merged = mergeCaptionPairs([
      { id: 'a', text: 'one', start_time: 0, end_time: 1, words: [{ word: 'one' }] },
      { id: 'b', text: 'two', start_time: 1, end_time: 2, words: [{ word: 'two' }] },
      { id: 'c', text: 'three', start_time: 2, end_time: 3, words: [] },
    ], 'p')
    expect(merged).toEqual([
      { id: 'p-0', text: 'one\ntwo', start_time: 0, end_time: 2, words: [{ word: 'one' }, { word: 'two' }] },
      { id: 'p-1', text: 'three', start_time: 2, end_time: 3, words: [] },
    ])
  })
})

describe('caption tracks', () => {
  const source = [{ id: '1', text: 'hello', words: [{ word: 'hello' }], wordStyles: { '1-0': { color: 'red' } } }]

  it('keeps the original transcript as the only track without a translation', () => {
    const state = buildCaptionTracks({ sourceCaptions: source, sourceLanguage: 'English' })
    expect(state.activeTrackId).toBe('source')
    expect(state.tracks).toEqual([{ id: 'source', language: 'English', label: 'Original · English', captions: source }])
  })

  it('adds the translation as a separate active track', () => {
    const translated = applyTranslation(source, [{ id: '1', text: 'नमस्ते' }])
    const state = buildCaptionTracks({ sourceCaptions: source, sourceLanguage: 'English', translatedCaptions: translated, targetLanguage: 'Hindi' })
    expect(state.tracks.map((track) => track.id)).toEqual(['source', 'translation-hindi'])
    expect(state.activeTrackId).toBe('translation-hindi')
    expect(state.captions[0].text).toBe('नमस्ते')
    // Source-language word timings cannot be aligned with translated words.
    expect(state.captions[0].words).toEqual([])
    expect(state.captions[0].wordStyles).toEqual({})
    expect(source[0].text).toBe('hello')
  })

  it('keeps the original text for lines the translation omitted', () => {
    expect(applyTranslation(source, [])[0].text).toBe('hello')
  })
})

describe('upsertTranslationTrack', () => {
  const source = { id: 'source', language: 'English', label: 'Original · English', captions: [] }
  const sourceCaptions = [
    { id: '1-0', text: 'hello', start_time: 0, end_time: 1, words: [{ word: 'hello' }], wordStyles: { 0: { color: 'red' } } },
    { id: 'text-1', text: 'Subscribe', isTextElement: true, start_time: 0, end_time: 5 },
  ]

  it('adds an active translated track and leaves text overlays untouched', () => {
    const result = upsertTranslationTrack([source], {
      sourceCaptions,
      translatedItems: [{ id: '1-0', text: 'नमस्ते' }],
      targetLanguage: 'hindi',
      label: 'Hindi',
    })
    expect(result.activeTrackId).toBe('translation-hindi')
    expect(result.tracks.map((track) => track.id)).toEqual(['source', 'translation-hindi'])
    expect(result.tracks[1].label).toBe('Hindi · translated')
    expect(result.captions[0]).toMatchObject({ id: '1-0', text: 'नमस्ते', words: [], wordStyles: {} })
    expect(result.captions[1]).toBe(sourceCaptions[1])
  })

  it('replaces an existing track for the same language instead of duplicating it', () => {
    const first = upsertTranslationTrack([source], {
      sourceCaptions, translatedItems: [{ id: '1-0', text: 'hola' }], targetLanguage: 'spanish',
    })
    const second = upsertTranslationTrack(first.tracks, {
      sourceCaptions, translatedItems: [{ id: '1-0', text: 'buenas' }], targetLanguage: 'spanish',
    })
    expect(second.tracks).toHaveLength(2)
    expect(second.captions[0].text).toBe('buenas')
  })
})
