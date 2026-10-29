import { describe, expect, it } from 'vitest'
import {
  applyCaptionLayout,
  attachCaptionEmotions,
  autoLayoutCaptions,
  buildCptComposition,
  captionsNeedingEmotion,
  captionTextKey,
  getCaptionLayoutMode,
  getCaptionLayoutMotion,
  planCaptionLayouts,
  setCaptionLayout,
} from '../captionLayoutDirector'
import { buildEmotionalCaptionPlan, getTemplatePhaseTypes, selectSemanticEmphasis } from '../emotionalTemplateUtils'

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
    expect(byId.c.motion).toBe('word')
    plans.forEach((plan) => expect(['none', 'line', 'word']).toContain(plan.motion))
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
    expect(next.layoutMotion).toBe('line')
    expect(next.revealMode).toBeUndefined()
  })

  it('word-by-word builds the caption as spoken, for sentence and keywords, and Still removes it', () => {
    const base = caption('a', 'this changed everything', 0, 2)
    const words = applyCaptionLayout(base, { mode: 'sentence', motion: 'word' })
    expect(words.revealMode).toBe('word')
    expect(words.animation).toBe('none')
    expect(getCaptionLayoutMotion(words)).toBe('word')
    const keywordWords = applyCaptionLayout(words, { mode: 'keywords', motion: 'word', plan: { keywordIndices: [2] } })
    expect(keywordWords.revealMode).toBe('word')
    expect(keywordWords.wordStyles['a-2'].isEmphasis).toBe(true)
    const still = applyCaptionLayout(keywordWords, { mode: 'keywords', motion: 'none', plan: { keywordIndices: [2] } })
    expect(still.revealMode).toBeUndefined()
    expect(getCaptionLayoutMotion(still)).toBe('none')
    // A CPT reveals as spoken by itself; it needs no caption-level reveal flag.
    const cpt = applyCaptionLayout(words, { mode: 'cpt', motion: 'none', plan: { heroIndex: 1 }, frame, measure })
    expect(cpt.revealMode).toBeUndefined()
    expect(getCaptionLayoutMotion(cpt)).toBe('word')
  })

  it('reads older boolean motion as line motion', () => {
    expect(getCaptionLayoutMotion({ layoutMode: 'sentence', layoutMotion: true })).toBe('line')
    expect(getCaptionLayoutMotion({ layoutMode: 'keywords', layoutMotion: false })).toBe('none')
    expect(getCaptionLayoutMotion({ text: 'x', revealMode: 'word' })).toBe('word')
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
    // Word by word on a template is its own word-by-word phase, not a caption flag.
    const wordByWord = applyCaptionLayout(templated, { mode: 'sentence', motion: 'word', plan: { captionIndex: 2 } })
    expect(wordByWord.emotional_mode).toBe('normal')
    expect(wordByWord.template_phase_index).toBe(1)
    expect(wordByWord.revealMode).toBeUndefined()
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

describe('AI emotion pass', () => {
  const read = (captions, readings) => attachCaptionEmotions(captions, readings)

  it('lets meaning override volume: loud narration stays plain, a quiet punchline becomes the CPT', () => {
    const captions = read(story(), [
      { id: 'a', type: 'hook', emotion: 'excitement', intensity: 0.6, keywords: [5] },
      { id: 'b', type: 'narration', emotion: 'neutral', intensity: 0.2, keywords: [] },
      { id: 'c', type: 'narration', emotion: 'neutral', intensity: 0.15, keywords: [2] },
      { id: 'd', type: 'narration', emotion: 'calm', intensity: 0.2, keywords: [] },
      { id: 'e', type: 'punchline', emotion: 'surprise', intensity: 0.95, keywords: [0] },
      { id: 'f', type: 'narration', emotion: 'neutral', intensity: 0.2, keywords: [] },
    ])
    // Caption c is the loudest line (the rules alone made it the CPT).
    const plans = planCaptionLayouts(captions, { waveformData: quietWithPeak(12, 14.5), duration: 60 })
    const byId = Object.fromEntries(plans.map((plan) => [plan.captionId, plan]))
    expect(byId.c.mode).toBe('sentence')
    expect(byId.e.mode).toBe('cpt')
    expect(byId.e.heroIndex).toBe(0)
    expect(byId.e.insight).toEqual({ type: 'punchline', emotion: 'surprise', source: 'ai' })
    expect(byId.d.insight.source).toBe('ai')
  })

  it('uses the AI keywords and the emotion for the entrance', () => {
    const [line] = read([caption('k', 'this changed everything for our small team', 0, 3)], [
      { id: 'k', type: 'emotional_peak', emotion: 'sadness', intensity: 0.7, keywords: [2, 6] },
    ])
    const [plan] = planCaptionLayouts([line], { duration: 3 })
    expect(plan.keywordIndices).toEqual([2, 6])
    expect(plan.animation).toBe('fade')
  })

  it('ignores a reading once the caption text changes, and only sends lines without a current reading', () => {
    const captions = read([caption('a', 'first line here', 0, 2), caption('b', 'second line here', 2, 4)], [
      { id: 'a', type: 'hook', emotion: 'joy', intensity: 0.9, keywords: [0] },
      { id: 'b', type: 'narration', emotion: 'neutral', intensity: 0.2, keywords: [] },
    ])
    expect(captions[0].aiEmotion.textKey).toBe(captionTextKey('first line here'))
    expect(captionsNeedingEmotion(captions)).toEqual([])
    const edited = [{ ...captions[0], text: 'first line changed' }, captions[1]]
    expect(captionsNeedingEmotion(edited)).toEqual([{ id: 'a', text: 'first line changed' }])
    const [plan] = planCaptionLayouts([edited[0]], { duration: 2 })
    expect(plan.insight.source).toBe('rules')
  })

  it('highlights a keyword\'s whole unit: an amount with its unit, a spoken amount, a name', () => {
    const planFor = (text, keywords) => {
      const [line] = read([caption('u', text, 0, 3)], [{ id: 'u', type: 'statistic', emotion: 'surprise', intensity: 0.8, keywords }])
      return planCaptionLayouts([line], { duration: 3 })[0].keywordIndices
    }
    expect(planFor('I spent 10 lakh rupees', [2])).toEqual([2, 3, 4])
    expect(planFor('मैंने दस लाख रुपये लगा दिए', [2])).toEqual([1, 2, 3])
    expect(planFor('yesterday Elon Musk called me', [2])).toEqual([1, 2])
    // The first keyword's unit always survives; a second one only within 3 words.
    expect(planFor('Elon Musk paid 10 lakh rupees', [0, 4])).toEqual([0, 1])
    expect(planFor('yesterday I met Ravi', [3])).toEqual([3])
  })

  it('a strong emotion picks a fitting entrance', () => {
    const entrance = (emotion) => {
      const [line] = read([caption('m', 'they lied to every customer', 0, 3)], [{ id: 'm', type: 'emotional_peak', emotion, intensity: 0.8, keywords: [1] }])
      return planCaptionLayouts([line], { duration: 3 })[0].animation
    }
    expect(entrance('anger')).toBe('pop')
    expect(entrance('fear')).toBe('fade')
    expect(entrance('serious')).toBe('rise')
  })

  it('drops keyword indexes outside the line', () => {
    const [stored] = read([caption('a', 'two words', 0, 2)], [{ id: 'a', type: 'hook', emotion: 'joy', intensity: 0.8, keywords: [1, 7] }])
    const [plan] = planCaptionLayouts([stored], { duration: 2 })
    expect(plan.keywordIndices).toEqual([1])
  })

  it('does not attach an in-flight reading to text edited before the response arrives', () => {
    const original = [caption('a', 'first line here', 0, 2), caption('b', 'second line here', 2, 4)]
    const pending = captionsNeedingEmotion(original)
    const edited = [{ ...original[0], text: 'new words with a new meaning' }, original[1]]
    const result = attachCaptionEmotions(edited, [
      { id: 'a', type: 'hook', emotion: 'joy', intensity: 0.9, keywords: [0] },
      { id: 'b', type: 'narration', emotion: 'neutral', intensity: 0.2, keywords: [] },
    ], pending)
    expect(result[0]).toBe(edited[0])
    expect(result[0].aiEmotion).toBeUndefined()
    expect(result[1].aiEmotion.textKey).toBe(captionTextKey(original[1].text))
  })
})

// The template brief's rules (docs/caption-template-design-brief.md, section 7).
describe('emotionally intelligent rules', () => {
  const plan = (captions, extra = {}) => planCaptionLayouts(captions, { duration: 60, ...extra })
  const wordsOf = (text) => text.split(' ')

  it('highlights the word that carries the sentence, not a position word', () => {
    const text = 'मेरे पीछे जो आप शिप देख.'
    const [first] = plan([caption('a', text, 0, 3)])
    expect(first.keywordIndices.map((index) => wordsOf(text)[index])).toEqual(['शिप'])
  })

  it('puts the emphasis on the first content word after a contrast word', () => {
    const text = 'it looks easy but it takes years'
    const [, line] = plan([caption('h', 'hello everyone', 0, 1), caption('a', text, 2, 5)])
    expect(wordsOf(text)[line.heroIndex]).toBe('takes')
  })

  it('keeps a number with its unit', () => {
    const [, line] = plan([caption('h', 'hello everyone', 0, 1), caption('a', 'we raised 10 lakh rupees', 2, 5)])
    // The whole amount (2026-10-28): "lakh" is itself an amount, so its currency joins.
    expect(line.keywordIndices).toEqual([2, 3, 4])
  })

  it('keeps a question quiet and gives its answer the emphasis', () => {
    const script = (question) => [
      caption('h', 'let me tell you something', 0, 2),
      caption('q', question, 10, 12),
      caption('a', 'one simple habit', 12.5, 14.5),
      caption('z', 'that is all for today', 30, 32),
    ]
    const asked = Object.fromEntries(plan(script('what changed everything?')).map((item) => [item.captionId, item]))
    const told = Object.fromEntries(plan(script('this changed everything')).map((item) => [item.captionId, item]))
    expect(asked.q.mode).not.toBe('cpt')
    expect(asked.q.insight.type).toBe('question')
    expect(asked.a.intensity).toBeGreaterThan(told.a.intensity)
  })

  it('ends a call to action calm, with the action word highlighted', () => {
    const captions = [
      caption('h', 'here is the trick', 0, 2),
      caption('m', 'it works every single time for me', 3, 6),
      caption('c', 'so follow for more tips', 7, 9),
    ]
    const cta = plan(captions).find((item) => item.captionId === 'c')
    expect(cta.mode).toBe('keywords')
    expect(cta.motion).toBe('none')
    expect(wordsOf('so follow for more tips')[cta.keywordIndices[0]]).toBe('follow')
  })

  it('does not highlight the same word in two captions in a row', () => {
    const [first, second] = plan([caption('a', 'discipline beats talent', 0, 2), caption('b', 'discipline builds habits slowly', 2.5, 5)])
    // No word in the first line has semantic evidence: no hero is invented
    // (the old fallback promoted ranked[0] and highlighted it in a CPT).
    expect(first.heroIndex).toBe(-1)
    expect(first.keywordIndices).toEqual([])
    expect(wordsOf('discipline builds habits slowly')[second.heroIndex]).not.toBe('discipline')
  })

  it('never builds a long or fast caption word by word', () => {
    const long = caption('l', 'this is a very long explanation that keeps going on and on for a while', 0, 3)
    const [only] = plan([long], { waveformData: Array.from({ length: 600 }, () => 0.9) })
    expect(only.motion).not.toBe('word')
    expect(only.mode).not.toBe('cpt')
  })

  it('reads LC scenes as styled, plain or animated template looks', () => {
    const scene = (inner) => `<div class="sb" data-si="0"><div class="cap"><div class="scene">${inner}</div></div></div>`
    const markup = [
      scene('<div class="cpt pyramid"><div class="ln"><span class="w">BIG</span></div></div>'),
      scene('<div class="nline plainwrap"><span class="w on">still</span></div>'),
      scene('<div class="nline"><span class="w" data-lc-anim="rise">moving</span></div>'),
      scene('<div class="cpt st-flow st-al-l"><div class="ln"><span class="w" data-lc-anim="stFade">flows</span></div></div>'),
    ].join('')
    expect(getTemplatePhaseTypes(markup)).toEqual(['styled', 'plain', 'normal', 'normal'])
    const templated = caption('t', 'one two three four', 0, 3, { template_markup: markup, template_20_id: 'T999' })
    const cpt = applyCaptionLayout(templated, { mode: 'cpt', motion: 'word', plan: { heroIndex: 2, captionIndex: 1 } })
    expect(cpt.template_phase_index).toBe(0)
    expect(cpt.imp_word_indices).toEqual([2])
  })
})

// 2026-10-27 caption-intelligence rebuild: hook priority, emotion as a ranking
// signal only, restrained highlights and user looks across templates.
describe('hook and CPT visibility', () => {
  const scene = (inner) => `<div class="sb" data-si="0"><div class="cap"><div class="scene">${inner}</div></div></div>`
  const markup = [
    scene('<div class="nline plainwrap"><span class="w on">still</span></div>'),
    scene('<div class="cpt pyramid"><div class="ln"><span class="w">BIG</span></div></div>'),
    scene('<div class="nline"><span class="w" data-lc-anim="rise">moving</span></div>'),
  ].join('')
  const templated = (captions, id = 'T1') => captions.map((item) => ({ ...item, template_markup: markup, template_20_id: id }))
  const shortScript = () => [
    caption('a', 'आज की कहानी', 0, 1.4),
    caption('b', 'शिप देख रहे हो', 1.5, 2.6),
    caption('c', 'वो शिप नहीं है', 2.8, 3.9),
    caption('d', 'बल्कि एक क्लब हाउस है।', 4.1, 5.6),
    caption('e', 'we raised 10 lakh rupees', 6, 7.5),
    caption('f', 'in just 30 days!', 7.6, 9),
  ]

  it('opens a templated video with the hook CPT even without a keyword or loudness', () => {
    const quietOpening = Array.from({ length: 90 }, (_, i) => (i < 14 ? 0.05 : 0.9))
    const [hook] = planCaptionLayouts(templated(shortScript()), { waveformData: quietOpening, duration: 9 })
    expect(hook.mode).toBe('cpt')
    const { captions } = autoLayoutCaptions(templated(shortScript()), { waveformData: quietOpening, duration: 9, frame, measure })
    expect(captions[0].template_phase_index).toBe(1)
    // Nothing earned emphasis in this line, so the styled phase highlights nothing.
    expect(captions[0].imp_word_indices).toEqual([])
  })

  it('does not let an AI emotion label remove the hook CPT', () => {
    const read = attachCaptionEmotions(templated(shortScript()), shortScript().map((line) => ({
      id: line.id, type: 'narration', emotion: 'neutral', intensity: 0.05, keywords: [],
    })))
    const [hook] = planCaptionLayouts(read, { duration: 9 })
    expect(hook.mode).toBe('cpt')
  })

  it('makes a question opening the hook, and leaves filler openings quiet', () => {
    const [question] = planCaptionLayouts(templated([caption('q', 'want to know the secret?', 0, 1.6), caption('z', 'here it is', 2, 3)]), { duration: 3 })
    expect(question.mode).toBe('cpt')
    const [filler] = planCaptionLayouts(templated([caption('f', 'so okay', 0, 1.2), caption('z', 'here it is', 2, 3)]), { duration: 3 })
    expect(filler.mode).not.toBe('cpt')
  })

  it('gives roughly one hero line in three, never two within three captions', () => {
    const captions = templated(shortScript())
    const loud = Array.from({ length: 90 }, () => 0.9)
    const plans = planCaptionLayouts(captions, { waveformData: loud, duration: 9 })
    const cptIndexes = plans.filter((plan) => plan.mode === 'cpt').map((plan) => plan.captionIndex)
    expect(cptIndexes.length).toBeGreaterThanOrEqual(2)
    expect(cptIndexes.length).toBeLessThanOrEqual(Math.round(captions.length / 3))
    cptIndexes.slice(1).forEach((index, i) => expect(index - cptIndexes[i]).toBeGreaterThanOrEqual(3))
  })

  it('needs a hero word for a plain (template-free) CPT', () => {
    const [plain] = planCaptionLayouts([caption('a', 'मेरे पीछे जो आप', 0, 1.4), caption('b', 'here it is', 2, 3)], { duration: 3 })
    expect(plain.mode).not.toBe('cpt')
  })

  it('plans identically for identical input', () => {
    const once = planCaptionLayouts(templated(shortScript()), { duration: 9 })
    const twice = planCaptionLayouts(templated(shortScript()), { duration: 9 })
    expect(twice).toEqual(once)
  })

  it('keeps a look the user chose when another template is applied', () => {
    const [chosen] = setCaptionLayout(templated(shortScript()), 'c', { mode: 'cpt', motion: 'word' }, { duration: 9, frame, measure })
      .filter((item) => item.id === 'c')
    expect(chosen.layoutSource).toBe('user')
    expect(chosen.template_phase_index).toBe(1)
    // Template B puts its styled phase last; the user's CPT follows it there.
    const otherMarkup = [
      scene('<div class="nline plainwrap"><span class="w on">still</span></div>'),
      scene('<div class="nline"><span class="w" data-lc-anim="rise">moving</span></div>'),
      scene('<div class="cpt pyramid"><div class="ln"><span class="w">BIG</span></div></div>'),
    ].join('')
    const switched = { ...chosen, template_markup: otherMarkup, template_20_id: 'T2', template_phase_index: 0 }
    const { captions } = autoLayoutCaptions([switched], { duration: 9, frame, measure })
    expect(captions[0].layoutSource).toBe('user')
    expect(captions[0].template_phase_index).toBe(2)
    expect(captions[0].imp_word_indices).toEqual(chosen.imp_word_indices)
  })
})

describe('negation keeps its meaning', () => {
  const pick = (text, language) => {
    const words = text.split(' ')
    const { impWordIndices } = selectSemanticEmphasis(words, language)
    return impWordIndices.map((index) => words[index])
  }

  it('emphasises NOT rather than the negated word', () => {
    expect(pick('This is not what I expected')).toEqual(['not'])
    expect(pick('We did not win the match')).toEqual(['not'])
    expect(pick('मैं बाज़ार में नहीं जाऊंगा।', 'hindi')).toEqual(['नहीं'])
  })

  it('leaves a sentence-level interjection and unnegated meaning alone', () => {
    expect(pick('No, we launched it today')).toEqual(['launched'])
    expect(pick('we raised 10 lakh rupees')).toEqual(['10'])
  })

  it('highlights nothing when no word carries the line', () => {
    expect(pick('so that is it for now')).toEqual([])
  })
})
