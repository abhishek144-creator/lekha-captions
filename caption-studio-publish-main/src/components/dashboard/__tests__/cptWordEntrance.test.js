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
})

