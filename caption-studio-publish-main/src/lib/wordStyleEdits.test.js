import { describe, expect, it } from 'vitest'
import { setWordBackground, toggleWordBackground, wordHasBackground } from './wordStyleEdits'
import { getWordBackgroundFill } from './wordPaint'

describe('word background toggle', () => {
  it('turns a translucent black box on for a word without one', () => {
    const next = toggleWordBackground({ color: '#ffcc00' })
    expect(next).toMatchObject({ color: '#ffcc00', backgroundColor: '#000000', backgroundOpacity: 0.65 })
    expect(wordHasBackground(next)).toBe(true)
    expect(getWordBackgroundFill(next)).toBe('rgba(0, 0, 0, 0.65)')
  })

  it('turns a colour or highlight-gradient box off', () => {
    expect(wordHasBackground(toggleWordBackground({ backgroundColor: '#ff0000', backgroundOpacity: 0.4 }))).toBe(false)
    const cleared = toggleWordBackground({ highlightGradient: 'linear-gradient(90deg, #f00, #00f)' })
    expect(cleared.highlightGradient).toBe('')
    expect(getWordBackgroundFill(cleared)).toBe('')
  })

  it('keeps the word\'s other styles', () => {
    expect(setWordBackground({ animation: 'pop', abs_x_pct: 40 }, false)).toMatchObject({ animation: 'pop', abs_x_pct: 40 })
  })
})
