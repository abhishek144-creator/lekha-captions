import { describe, expect, it } from 'vitest'
import { reconcileCaptionText, shiftCaptionTiming, splitCaptionAtBoundary } from '../captionEditingUtils'
import { splitCaptionWordTokens } from '../videoPlayerWordEditing'
import { applyCanvasTextEdit } from '../useCanvasTextEditing'

const words = (text, start, end) => text.split(' ').map((word, index, all) => ({
  word,
  start: start + (index * (end - start)) / all.length,
  end: start + ((index + 1) * (end - start)) / all.length,
}))

const caption = {
  id: '1700000000000-0',
  text: 'hello bright world',
  start_time: 1,
  end_time: 4,
  words: words('hello bright world', 1, 4),
  wordStyles: { '1700000000000-0-2': { color: '#ff0000' } },
}

describe('shiftCaptionTiming', () => {
  it('moves measured words with the caption instead of erasing them', () => {
    const later = shiftCaptionTiming(caption, 0.1)
    expect(later.start_time).toBeCloseTo(1.1)
    expect(later.end_time).toBeCloseTo(4.1)
    expect(later.words).toHaveLength(3)
    expect(later.words[0].start).toBeCloseTo(1.1)
    expect(later.words[2].end).toBeCloseTo(4.1)
    expect(later.word_alignment_status).toBeUndefined()
  })

  it('never moves a caption before 0 s', () => {
    const early = shiftCaptionTiming({ ...caption, start_time: 0.05, end_time: 1, words: words('a b', 0.05, 1) }, -0.1)
    expect(early.start_time).toBe(0)
    expect(early.words[0].start).toBeCloseTo(0)
  })
})

describe('word style indexes', () => {
  it('splitCaptionWordTokens indexes words like the editor and export (any whitespace)', () => {
    expect(splitCaptionWordTokens('one  two\nthree four').map((token) => token.word)).toEqual(['one', 'two', 'three', 'four'])
    expect(splitCaptionWordTokens('one  two\nthree four').map((token) => token.lineBreakAfter)).toEqual([false, true, false, false])
    expect(splitCaptionWordTokens(undefined)).toEqual([])
  })

  it('keeps word styles on whitespace words when CJK timing uses finer segments', () => {
    // '你好世界' is one rendered word but two timing segments. Removing a
    // segment must not drop the style of the next rendered word.
    const cjk = { id: 'c', text: '你好世界 再见', start_time: 0, end_time: 2, words: [], wordStyles: { 'c-1': { color: '#f00' } } }
    const edited = reconcileCaptionText(cjk, '你好 再见')
    expect(edited.wordStyles).toEqual({ 'c-1': { color: '#f00' } })
  })

  it('a canvas text edit keeps timings and styles on their words', () => {
    const edited = applyCanvasTextEdit(caption, 'oh hello bright world')
    expect(edited.words.map((word) => word.word)).toEqual(['oh', 'hello', 'bright', 'world'])
    expect(edited.words[1].start).toBeCloseTo(1)
    expect(edited.wordStyles).toEqual({ '1700000000000-0-3': { color: '#ff0000' } })
    expect(edited.word_alignment_status).toBe('needs_review')
  })

  it('a canvas edit of a text element moves its styles but adds no word timing', () => {
    const element = { id: 'text-1', isTextElement: true, text: 'big sale', wordStyles: { 'text-1-1': { color: '#0f0' } } }
    const edited = applyCanvasTextEdit(element, 'huge big sale')
    expect(edited.wordStyles).toEqual({ 'text-1-2': { color: '#0f0' } })
    expect(edited.word_alignment_status).toBeUndefined()
  })

  it('splitting keeps styles on the same whitespace words', () => {
    const result = splitCaptionAtBoundary(caption, 'hello bright'.length, 'new')
    expect(result.captions[0].wordStyles).toEqual({})
    expect(result.captions[1].wordStyles).toEqual({ 'new-0': { color: '#ff0000' } })
  })
})
