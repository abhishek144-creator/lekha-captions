import { describe, expect, it } from 'vitest'
import {
  applyCaptionLayout,
  autoLayoutCaptions,
  buildCptComposition,
  getCaptionLayoutMode,
  planCaptionLayouts,
  setCaptionLayout,
} from '../captionLayoutDirector'
import { buildEmotionalCaptionPlan } from '../emotionalTemplateUtils'

const measure = (text, size) => String(text).length * size * 0.5
const frame = { width: 360, height: 640 }
const caption = (id, text, start, end, extra = {}) => ({ id, text, start_time: start, end_time: end, words: [], wordStyles: {}, ...extra })

// 60 s video, waveform at 10 samples per second: quiet narration with one loud peak.
const quietWithPeak = (peakFrom, peakTo) => Array.from({ length: 600 }, (_, i) => (i >= peakFrom * 10 && i < peakTo * 10 ? 0.95 : 0.2))

const story = () => [
  caption('a', 'so today I want to talk about how we work', 0, 4),
  caption('b', 'and it is something that we do every day here', 5, 9),
  caption('c', 'we grew 300% in one year!', 12, 14.5),
  caption('d', 'which honestly felt pretty normal to all of us', 16, 20),
  caption('e', 'nobody expected it at all', 22, 24),
  caption('f', 'and that is the whole story of the team', 26, 30),
]

describe('planCaptionLayouts', () => {
  it('makes the loud, short, emphatic line a CPT and keeps calm narration plain', () => {
    const plans = planCaptionLayouts(story(), { waveformData: quietWithPeak(12, 14.5), duration: 60 })
    const byId = Object.fromEntries(plans.map((plan) => [plan.captionId, plan]))
    expect(byId.c.mode).toBe('cpt')
    expect(byId.c.motion).toBe(true)
    // The number is the strongest word of the peak line.
    expect(byId.c.heroIndex).toBe(2)
    expect(byId.d.mode).not.toBe('cpt')
    expect(plans.filter((plan) => plan.mode === 'cpt').length).toBeLessThanOrEqual(Math.round(60 / 10))
  })

  it('never puts two CPTs back to back or within 8 seconds', () => {
    const captions = [
      caption('a', 'big news today!', 0, 1.6),
      caption('b', 'we won 100 awards!', 2, 3.6),
      caption('c', 'incredible result!', 4, 5.6),
    ]
    const loud = Array.from({ length: 600 }, () => 0.9)
    const plans = planCaptionLayouts(captions, { waveformData: loud, duration: 60 })
    const cpts = plans.filter((plan) => plan.mode === 'cpt')
    expect(cpts.length).toBe(1)
  })

  it('picks content words, not stop words, as keywords', () => {
    const [plan] = planCaptionLayouts([caption('a', 'मेरे पीछे जो आप शिप देख रहे हो', 0, 3)], { duration: 3 })
    const words = 'मेरे पीछे जो आप शिप देख रहे हो'.split(' ')
    plan.keywordIndices.forEach((index) => {
      expect(['मेरे', 'जो', 'आप', 'हो']).not.toContain(words[index])
    })
  })

  it('keeps a caption the user styled by hand', () => {
    const captions = story()
    captions[2] = { ...captions[2], wordStyles: { 'c-0': { abs_x_pct: 40, abs_y_pct: 30 } } }
    const plans = planCaptionLayouts(captions, { waveformData: quietWithPeak(12, 14.5), duration: 60 })
    const plan = plans.find((item) => item.captionId === 'c')
    expect(plan.locked).toBe(true)
    expect(plan.mode).toBe('cpt')
    const { captions: next, counts } = autoLayoutCaptions(captions, { waveformData: quietWithPeak(12, 14.5), duration: 60, frame, measure })
    expect(next[2]).toBe(captions[2])
    expect(counts.kept).toBe(1)
  })
})

describe('buildCptComposition', () => {
  it('puts the hero alone and larger, keeps rows apart and inside the safe area', () => {
    const words = ['we', 'grew', '300%', 'in', 'one', 'year!']
    const placed = buildCptComposition({ words, heroIndex: 2, baseFontSize: 18, frame, anchor: { x: 50, y: 80 }, measure })
    const hero = placed.find((item) => item.isHero)
    expect(hero.index).toBe(2)
    expect(placed.filter((item) => item.yPct === hero.yPct)).toHaveLength(1)
    placed.filter((item) => !item.isHero).forEach((item) => expect(hero.paintedSize).toBeGreaterThan(item.paintedSize))
    placed.forEach((item) => {
      expect(item.yPct).toBeGreaterThan(10)
      expect(item.yPct).toBeLessThan(90)
    })
    // Reading order: words before the hero sit above it, words after sit below.
    placed.filter((item) => item.index < 2).forEach((item) => expect(item.yPct).toBeLessThan(hero.yPct))
    placed.filter((item) => item.index > 2).forEach((item) => expect(item.yPct).toBeGreaterThan(hero.yPct))
    // Words on one row do not overlap.
    const rows = new Map()
    placed.forEach((item) => rows.set(item.yPct, [...(rows.get(item.yPct) || []), item]))
    rows.forEach((row) => {
      row.sort((a, b) => a.xPct - b.xPct)
      for (let i = 1; i < row.length; i += 1) {
        const previousRight = row[i - 1].xPct / 100 * 360 + measure(words[row[i - 1].index], row[i - 1].paintedSize) / 2
        const left = row[i].xPct / 100 * 360 - measure(words[row[i].index], row[i].paintedSize) / 2
        expect(left).toBeGreaterThanOrEqual(previousRight - 0.01)
      }
    })
  })
})

describe('applyCaptionLayout', () => {
  it('writes a CPT the editor and export already render, and Sentence clears it but keeps colours', () => {
    const base = caption('c', 'we grew 300% in one year!', 12, 14.5, { wordStyles: { 'c-1': { color: '#ff0000' } } })
    const cpt = applyCaptionLayout(base, { mode: 'cpt', motion: true, plan: { heroIndex: 2, keywordIndices: [2] }, captionStyle: { font_size: 18, position_y: 80 }, frame, measure })
    expect(getCaptionLayoutMode(cpt)).toBe('cpt')
    expect(cpt.layoutSource).toBe('auto')
    const hero = cpt.wordStyles['c-2']
    expect(hero.isEmphasis).toBe(true)
    expect(hero.animation).toBe('pop')
    expect(typeof hero.abs_x_pct).toBe('number')
    expect(hero.cptCanvasXPercent).toBe(hero.abs_x_pct)
    expect(hero.frozenFontSize).toBe(18)
    expect(cpt.wordStyles['c-1'].color).toBe('#ff0000')
    expect(cpt.wordStyles['c-1'].animation).toBe('rise')

    const sentence = applyCaptionLayout(cpt, { mode: 'sentence', motion: false, source: 'user' })
    expect(getCaptionLayoutMode(sentence)).toBe('sentence')
    expect(sentence.animation).toBe('none')
    expect(sentence.wordStyles['c-1']).toEqual({ color: '#ff0000' })
    expect(sentence.wordStyles['c-2']).toBeUndefined()
  })

  it('keywords with motion emphasise the keyword and animate the caption', () => {
    const next = applyCaptionLayout(caption('a', 'this changed everything', 0, 2), { mode: 'keywords', motion: true, plan: { keywordIndices: [2], animation: 'rise' } })
    expect(next.wordStyles['a-2'].isEmphasis).toBe(true)
    expect(next.animation).toBe('rise')
    expect(next.layoutMotion).toBe(true)
  })

  it('maps looks onto a template caption\'s own phases and keywords', () => {
    const markup = '<div class="sblock plain-s">a</div><div class="sblock wbw">b</div><div class="sblock sw">c</div>'
    const templated = caption('t', 'one two three four', 0, 3, { template_markup: markup, template_phase_index: 0 })
    const cpt = applyCaptionLayout(templated, { mode: 'cpt', motion: true, plan: { heroIndex: 1, keywordIndices: [1], captionIndex: 0 } })
    expect(cpt.template_phase_index).toBe(2)
    expect(cpt.emotional_mode).toBe('styled')
    expect(cpt.imp_word_indices).toEqual([1])
    const plain = applyCaptionLayout(templated, { mode: 'sentence', motion: false, plan: { captionIndex: 1 } })
    expect(plain.template_phase_index).toBe(0)
    expect(plain.imp_word_indices).toEqual([])
    const animatedKeywords = applyCaptionLayout(templated, { mode: 'keywords', motion: true, plan: { keywordIndices: [3], captionIndex: 0 } })
    expect(animatedKeywords.emotional_mode).toBe('normal')
    expect(animatedKeywords.imp_word_indices).toEqual([3])

    // The live template plan keeps the chosen keywords instead of its audio guess.
    const [entry] = buildEmotionalCaptionPlan([animatedKeywords], [], 3, markup)
    expect(entry.impWordIndices).toEqual([3])
    expect(entry.mode).toBe('normal')
  })

  it('records a per-caption choice as the user\'s', () => {
    const captions = story()
    const next = setCaptionLayout(captions, 'a', { mode: 'keywords', motion: false }, { duration: 60, frame, measure })
    expect(next[0].layoutSource).toBe('user')
    expect(getCaptionLayoutMode(next[0])).toBe('keywords')
    expect(next.slice(1)).toEqual(captions.slice(1))
    next.slice(1).forEach((item, index) => expect(item).toBe(captions[index + 1]))
  })
})
