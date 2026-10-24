import { describe, expect, it } from 'vitest'
import { defaultCaptionStyle } from '../editorDocument'
import {
  TEMPLATE_OWNED_RESET,
  buildTemplateApplication,
  getTemplateRecentEntry,
  stripDetachedWordLayout,
} from '../templateApplication'

const englishCaptions = [
  { id: 'c1', text: 'hello world', start_time: 0, end_time: 1, wordStyles: { 'c1-0': { color: 'red', x: 10, abs_x_pct: 40, animation: 'pop' } } },
  { id: 'el', text: 'Title', isTextElement: true, wordStyles: {} },
]

const apply = (templateStyle, captionStyle = defaultCaptionStyle, captions = englishCaptions) => (
  buildTemplateApplication({ templateStyle, captionStyle, captions, waveformData: null, duration: 4, now: 1000 })
)

describe('left-gallery template font size', () => {
  it('starts at scale 1 whatever size the template declares, then follows the slider', async () => {
    const { getSidebarTemplateZoom } = await import('../../components/dashboard/videoPlayerTemplateRendering.jsx')
    // "Messy" declares no font size of its own; a template that does declares 22.
    for (const declared of [undefined, 22]) {
      const lc = { template_id: 'sidebar-T166', template_20_id: 'T166', template_source: 'lekha-lc', template_font_size: 22, ...(declared ? { font_size: declared } : {}) }
      const { style, templateSnapshot } = apply(lc)
      expect(style.template_font_size).toBe(style.font_size)
      expect(templateSnapshot.template_font_size).toBe(style.font_size)
      expect(getSidebarTemplateZoom(style)).toBe(1)
      expect(getSidebarTemplateZoom({ ...style, font_size: style.font_size * 1.5 })).toBeCloseTo(1.5)
    }
  })

  it('leaves styles saved before the slider worked, and other templates, unscaled', async () => {
    const { getSidebarTemplateZoom } = await import('../../components/dashboard/videoPlayerTemplateRendering.jsx')
    expect(getSidebarTemplateZoom({ font_size: 30 })).toBe(1)
    expect(apply({ template_id: 't12', template_source: 'lekha-advanced' }).style.template_font_size).toBeUndefined()
    expect(getSidebarTemplateZoom({ template_font_size: 20, font_size: 200 })).toBe(2.5)
  })
})

describe('buildTemplateApplication', () => {
  it('does not let template B inherit template A\'s owned properties', () => {
    const templateA = { template_id: 't12', template_source: 'lekha-advanced', background_color: '#ff00ff', letter_spacing: 3, font_family: 'Bebas Neue' }
    const afterA = apply(templateA).style
    const templateB = { template_id: 't13', template_source: 'lekha-advanced', text_color: '#00ff00' }
    const afterB = apply(templateB, afterA).style
    expect(afterB.background_color).toBe(TEMPLATE_OWNED_RESET.background_color)
    expect(afterB.letter_spacing).toBe(0)
    expect(afterB.font_family).toBe('Inter')
    expect(afterB.text_color).toBe('#00ff00')
    expect(afterB.template_id).toBe('t13')
  })

  it('keeps properties templates do not own', () => {
    const style = apply({ template_id: 't12' }, { ...defaultCaptionStyle, position_x: 30, max_lines: 3 }).style
    expect(style.position_x).toBe(30)
    expect(style.max_lines).toBe(3)
  })

  it('stamps a snapshot so the template survives later style edits', () => {
    const { style, templateSnapshot, captions } = apply({ template_id: 't12', template_name: 'Punchline Pop' })
    expect(style.template_applied_at).toBe(1000)
    expect(templateSnapshot).toMatchObject({ template_id: 't12', emotional_intelligence: true })
    expect(captions[0].applied_template_style).toBe(templateSnapshot)
  })

  it('starts a newly selected template from its authored word layout', () => {
    const { captions } = apply({ template_id: 't12' })
    expect(captions[0].wordStyles).toEqual({})
    expect(captions[0].template_id).toBe('t12')
  })

  it('re-applying the same template keeps word colours but drops dragged layout and motion', () => {
    const current = { ...defaultCaptionStyle, template_id: 't12', template_source: '' }
    const { captions } = apply({ template_id: 't12' }, current)
    expect(captions[0].wordStyles['c1-0']).toEqual({ color: 'red' })
  })

  it('never restyles text elements', () => {
    const { captions } = apply({ template_id: 't12' })
    expect(captions[1]).toBe(englishCaptions[1])
  })

  it('clearing the template removes every caption template field', () => {
    const templated = apply({ template_id: 't12' }).captions
    const { captions, templateSnapshot, style } = apply({}, { ...defaultCaptionStyle, template_id: 't12' }, templated)
    expect(templateSnapshot).toBeNull()
    expect(style.template_applied_at).toBeNull()
    for (const key of ['template_id', 'applied_template_style', 'emphasis_color', 'imp_word_indices', 'template_phase_index']) {
      expect(captions[0]).not.toHaveProperty(key)
    }
  })

  it('clearing the template also removes word colour, size and effect edits', () => {
    const templated = apply({ template_id: 't12' }).captions.map((cap) => (cap.isTextElement ? cap : {
      ...cap,
      wordStyles: { 'c1-0': { color: 'red', fontSize: 41, textGradient: 'linear-gradient(red, blue)', x: 8, y: -341 } },
    }))
    const { captions } = apply({}, { ...defaultCaptionStyle, template_id: 't12' }, templated)
    expect(captions[0].wordStyles).toEqual({})
    expect(captions[1]).toBe(templated[1])
  })

  it('pressing None without a template keeps word edits (drops only dragged layout and motion)', () => {
    const { captions } = apply({}, { ...defaultCaptionStyle, template_id: '', template_20_id: '' })
    expect(captions[0].wordStyles['c1-0']).toEqual({ color: 'red' })
  })

  it('pins the Horror/Tension template to its second phase', () => {
    expect(apply({ template_id: 't17' }).captions[0].template_phase_index).toBe(1)
  })

  it('swaps a Latin display font for a Devanagari face when any caption is Hindi', () => {
    const mixed = [
      { id: 'en', text: 'Follow for more', start_time: 0, end_time: 1 },
      { id: 'hi', text: 'ये आपको पढ़ना है', start_time: 1, end_time: 2 },
    ]
    const { style, templateSnapshot } = apply({ template_id: 't12', font_family: 'Bebas Neue' }, defaultCaptionStyle, mixed)
    expect(style.font_family).not.toBe('Bebas Neue')
    expect(templateSnapshot.font_family).toBe(style.font_family)
  })

  it('keeps the template font on Latin-only captions', () => {
    expect(apply({ template_id: 't12', font_family: 'Bebas Neue' }).style.font_family).toBe('Bebas Neue')
  })
})

describe('stripDetachedWordLayout', () => {
  it('removes position, resize, rotation and motion but keeps colours', () => {
    expect(stripDetachedWordLayout({
      'c1-0': { color: 'red', x: 1, y: 2, x_pct: 3, y_pct: 4, abs_x_pct: 5, abs_y_pct: 6, boxWidth: 7, textScaleX: 1.2, rotation: 9, frozenFontSize: 30, animation: 'pop', animationSpeed: 2 },
    })).toEqual({ 'c1-0': { color: 'red' } })
  })
})

describe('getTemplateRecentEntry', () => {
  it('matches the favourite keys each gallery uses', () => {
    expect(getTemplateRecentEntry({ template_20_id: 'T167' })).toEqual({ kind: 'sidebar-template', id: 'T167' })
    expect(getTemplateRecentEntry({ template_id: 't12' })).toEqual({ kind: 'advanced-template', id: 't12' })
    expect(getTemplateRecentEntry({ template_id: 't-106' })).toEqual({ kind: 'basic-template', id: 't-106' })
  })
})
