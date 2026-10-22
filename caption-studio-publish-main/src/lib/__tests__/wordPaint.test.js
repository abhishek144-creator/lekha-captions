import { describe, expect, it } from 'vitest'
import { getWordBackgroundFill, getWordPaintStyle } from '../wordPaint'

describe('word paint', () => {
  it('paints a solid background box', () => {
    expect(getWordPaintStyle({ backgroundColor: '#000000', backgroundOpacity: 0.65 })).toEqual({ backgroundColor: 'rgba(0, 0, 0, 0.65)', backgroundImage: 'none' })
  })

  it('prefers a highlight gradient over a solid background', () => {
    expect(getWordBackgroundFill({ backgroundColor: '#000000', highlightGradient: 'linear-gradient(red, blue)' })).toBe('linear-gradient(red, blue)')
  })

  it('clips a text gradient to the text', () => {
    const style = getWordPaintStyle({ textGradient: 'linear-gradient(to right, #facc15, #ef4444)' })
    expect(style.backgroundClip).toBe('text')
    expect(style.WebkitTextFillColor).toBe('transparent')
  })

  it('keeps both a text gradient and a background as separate layers', () => {
    const style = getWordPaintStyle({ textGradient: 'linear-gradient(red, blue)', backgroundColor: '#000000', backgroundOpacity: 0.5 })
    expect(style.backgroundImage).toBe('linear-gradient(red, blue), linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5))')
    expect(style.backgroundClip).toBe('text, padding-box')
  })

  it('never emits invalid colours for bad stored values', () => {
    expect(getWordPaintStyle({ backgroundColor: 'oops' })).toEqual({ backgroundColor: 'rgba(0, 0, 0, 0.6)', backgroundImage: 'none' })
  })
})
