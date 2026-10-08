import { describe, expect, it } from 'vitest'
import {
  applyWordStyleChange,
  getPopupWordStyle,
  getPopupWordText,
  resetWordFontSize,
  resetWordPosition,
  updatePopupWordStyle,
  wordPopupStyleKey,
} from '../wordStyleEdits'

const captions = [
  { id: 'c1', text: 'one two three', wordStyles: { 'c1-1': { color: 'red', fontSize: 30, frozenFontSize: 28 } } },
  { id: 'el', text: 'Big Title', isTextElement: true, wordStyles: {} },
]
const captionPopup = { type: 'caption', caption: captions[0], wordIndex: 1, word: 'two' }
const elementPopup = { type: 'element', elementId: 'el', wordIndex: 1, word: 'Title' }

describe('word popup targeting', () => {
  it('keys caption and text-element words by their owner id', () => {
    expect(wordPopupStyleKey(captionPopup)).toBe('c1-1')
    expect(wordPopupStyleKey(elementPopup)).toBe('el-1')
  })

  it('reads the live word text and style', () => {
    expect(getPopupWordText(captions, captionPopup)).toBe('two')
    expect(getPopupWordStyle(captions, captionPopup)).toEqual(captions[0].wordStyles['c1-1'])
    expect(getPopupWordStyle(captions, elementPopup)).toEqual({})
  })

  it('falls back to the popup copy when the word index no longer exists', () => {
    expect(getPopupWordText(captions, { ...captionPopup, wordIndex: 9, word: 'gone' })).toBe('gone')
  })
})

describe('applyWordStyleChange', () => {
  it('drops resize locks when the size slider changes', () => {
    expect(applyWordStyleChange({ boxWidth: 80, textScaleX: 0.8, frozenFontSize: 20 }, 'fontSize', 24)).toEqual({ fontSize: 24 })
  })

  it('replaces relative coordinates when an absolute position is set', () => {
    expect(applyWordStyleChange({ x_pct: 10, y_pct: 20 }, 'x', 5)).toEqual({ x: 5, y_pct: 20 })
    expect(applyWordStyleChange({ x_pct: 10, y_pct: 20 }, 'y', 6)).toEqual({ x_pct: 10, y: 6 })
  })

  it('trims gradients and clears invalid ones', () => {
    expect(applyWordStyleChange({}, 'textGradient', '  linear-gradient(red, blue) ')).toEqual({ textGradient: 'linear-gradient(red, blue)' })
    expect(applyWordStyleChange({}, 'textGradient', null)).toEqual({ textGradient: '' })
  })
})

describe('updatePopupWordStyle', () => {
  it('changes only the targeted word', () => {
    const next = updatePopupWordStyle(captions, captionPopup, (style) => ({ ...style, color: 'blue' }))
    expect(next[0].wordStyles['c1-1'].color).toBe('blue')
    expect(next[1]).toBe(captions[1])
    expect(captions[0].wordStyles['c1-1'].color).toBe('red')
  })

  it('resets size and position without writing zero coordinates', () => {
    expect(resetWordFontSize({ color: 'red', fontSize: 30, frozenFontSize: 28 })).toEqual({ color: 'red' })
    // A stored abs 0,0 reads as "dragged to the corner" in export.
    expect(resetWordPosition({ color: 'red', x: 1, y: 2, x_pct: 3, y_pct: 4, abs_x_pct: 5, abs_y_pct: 6 })).toEqual({ color: 'red' })
  })
})
