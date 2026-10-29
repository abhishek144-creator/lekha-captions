import { describe, expect, it } from 'vitest'
import {
  buildFontComboTextElement,
  buildPresetTextElement,
  getNewTextElementTiming,
  NEW_TEXT_ELEMENT_FALLBACK_SECONDS,
} from '../textElementDefaults'
import { buildTextElementExportStyle } from '../exportPipelineUtils'

const captions = [
  { id: 'a', text: 'मेरे पीछे', start_time: 2.8, end_time: 3.5 },
  { id: 'b', text: 'शिप नहीं है क्लब', start_time: 4.5, end_time: 5.5 },
  { id: 't', text: 'Old box', start_time: 0, end_time: 11, isTextElement: true },
]

describe('getNewTextElementTiming', () => {
  it('spans the caption under the playhead, not the rest of the video', () => {
    expect(getNewTextElementTiming({ captions, currentTime: 5, duration: 11 })).toEqual({ startTime: 4.5, endTime: 5.5 })
  })

  it('ignores text boxes when finding the block', () => {
    expect(getNewTextElementTiming({ captions, currentTime: 3, duration: 11 })).toEqual({ startTime: 2.8, endTime: 3.5 })
  })

  it('lasts a short default between captions', () => {
    const { startTime, endTime } = getNewTextElementTiming({ captions, currentTime: 0.5, duration: 11 })
    expect(startTime).toBe(0.5)
    expect(endTime).toBeCloseTo(0.5 + NEW_TEXT_ELEMENT_FALLBACK_SECONDS)
  })

  it('never runs past the video', () => {
    expect(getNewTextElementTiming({ captions: [], currentTime: 10, duration: 11 })).toEqual({ startTime: 10, endTime: 11 })
    expect(getNewTextElementTiming({ captions: [], currentTime: 11, duration: 11 })).toEqual({ startTime: 10.5, endTime: 11 })
  })

  it('uses the default when the video length is unknown', () => {
    expect(getNewTextElementTiming({ captions: [], currentTime: 1, duration: 0 })).toEqual({ startTime: 1, endTime: 4 })
  })
})

describe('buildFontComboTextElement', () => {
  it('adds the lettering with no background box', () => {
    const element = buildFontComboTextElement(
      { text: 'GLOW', fontFamily: 'Bebas Neue', fontSize: 36, color: '#E91E63', fontWeight: 'bold' },
      { startTime: 4.5, endTime: 5.5 },
    )
    expect(element).toMatchObject({ text: 'GLOW', type: 'combo', isTextElement: true, start_time: 4.5, end_time: 5.5 })
    expect(element.customStyle.hasBackground).toBe(false)
    expect(element.customStyle).toMatchObject({ fontFamily: 'Bebas Neue', fontSize: 36, color: '#E91E63', fontWeight: 'bold' })
    // The export reads the same flag, so the video has no box either.
    expect(buildTextElementExportStyle(element.customStyle).has_background).toBe(false)
  })
})

describe('buildPresetTextElement', () => {
  it.each([
    ['heading', 'Heading', 28],
    ['subheading', 'Subheading', 20],
    ['body', 'Body text', 15],
  ])('adds a %s with no background box, readable by its shadow', (type, text, fontSize) => {
    const element = buildPresetTextElement(type, { startTime: 2.8, endTime: 3.5 })
    expect(element).toMatchObject({ text, type, isTextElement: true, start_time: 2.8, end_time: 3.5 })
    expect(element.customStyle).toMatchObject({ fontSize, hasBackground: false, hasShadow: true })
    const exported = buildTextElementExportStyle(element.customStyle)
    expect(exported.has_background).toBe(false)
    expect(exported.has_shadow).toBe(true)
  })
})
