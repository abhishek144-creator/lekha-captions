import { describe, expect, it } from 'vitest'
import { getCaptionWordRevealTimes, getRevealedWordAnimation } from '../cptMotion'

describe('getRevealedWordAnimation', () => {
  it('holds a CPT word entrance until the word is revealed', () => {
    expect(getRevealedWordAnimation('word-rise 0.4s ease-out both', true)).toBe('none')
  })

  it('starts the entrance once the word is revealed', () => {
    expect(getRevealedWordAnimation('word-rise 0.4s ease-out both', false)).toBe('word-rise 0.4s ease-out both')
  })

  it('stays still without a chosen entrance', () => {
    expect(getRevealedWordAnimation('', false)).toBe('none')
    expect(getRevealedWordAnimation(undefined, false)).toBe('none')
  })

  it('reveals timed words at their spoken start (export seeks entrances from these)', () => {
    const caption = {
      start_time: 4.5,
      end_time: 5.5,
      words: [{ start: 4.5, end: 4.75 }, { start: 4.75, end: 5 }, { start: 5, end: 5.25 }, { start: 5.25, end: 5.5 }],
    }
    expect(getCaptionWordRevealTimes(caption, 4)).toEqual([4.5, 4.75, 5, 5.25])
  })

  it('gives a CPT word a readable beat after fast speech and keeps the last word on screen', () => {
    // "शिप देख रहे हो" spoken in under half a second, the last word at the caption's end
    const words = [
      { word: 'शिप', start: 3.6, end: 3.7 }, { word: 'देख', start: 3.72, end: 3.8 },
      { word: 'रहे', start: 3.82, end: 3.9 }, { word: 'हो', start: 4.38, end: 4.4 },
    ]
    const caption = { start_time: 3.6, end_time: 4.4, words, wordStyles: { 0: { abs_x_pct: 20, abs_y_pct: 25 } } }
    const times = getCaptionWordRevealTimes(caption, 4)
    times.slice(1).forEach((time, index) => expect(time - times[index]).toBeGreaterThan(0.15))
    times.forEach((time, index) => expect(time).toBeGreaterThanOrEqual(Math.min(words[index].start, 4.4 - 0.16) - 1e-9))
    expect(times[3]).toBeLessThanOrEqual(4.4 - 0.16 + 1e-9)
  })

  it('reads export word_styles the same way and leaves words already a beat apart alone', () => {
    const words = [{ word: 'one', start: 1, end: 1.4 }, { word: 'two', start: 1.5, end: 1.9 }, { word: 'three', start: 2, end: 2.4 }]
    const caption = { start_time: 1, end_time: 3, words, word_styles: { 2: { x: 30, y: -40 } } }
    expect(getCaptionWordRevealTimes(caption, 3)).toEqual([1, 1.5, 2])
  })
})

