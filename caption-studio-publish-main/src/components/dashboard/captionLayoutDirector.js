// Smart layout director (rules only, no AI): suggests a look for each caption
// from its timing, pauses, loudness and wording, and applies it.
//
// Looks: a layout (sentence | keywords | cpt) plus motion, which is one of
// 'none' (still), 'line' (the whole caption animates in) or 'word' (the
// sentence builds up word by word as it is spoken). That gives seven looks:
// sentence still / line / word, keywords still / line / word, and CPT
// (creatively placed words, always revealed as spoken).
//
// Plain captions get word styles (emphasis, CPT positions), a caption
// animation (line) or a per-caption word reveal (revealMode 'word'). Template
// captions pick the template's own authored phase of the matching type (plain /
// normal word-by-word / styled layout) and its keyword indices, so every
// existing template follows the same decision.
//
// A caption the user set (layoutSource 'user'), or hand-styled without the
// director, is never changed by Auto layout.

import {
  EMPHASIS_STOP_WORDS,
  countLettersAndNumbers,
  getTemplatePhaseTypes,
  normalizeEmphasisWord,
  quantile,
} from './emotionalTemplateUtils.js'
import { splitCaptionWordTokens, wordHasCreativePosition } from './videoPlayerWordEditing.js'

export const CAPTION_LAYOUT_MODES = ['sentence', 'keywords', 'cpt']

const CPT_MIN_SECONDS = 1.2
const CPT_MIN_WORDS = 2
const CPT_MAX_WORDS = 6
const CPT_MAX_CHARS = 34
const CPT_SPACING_SECONDS = 8
const KEYWORD_MIN_SCORE = 2
const REFERENCE_WIDTH = 360

// Word-style keys that place or emphasise a word. Cleared whenever a layout is applied.
const LAYOUT_KEYS = ['x', 'y', 'x_pct', 'y_pct', 'abs_x_pct', 'abs_y_pct', 'cptCanvasXPercent', 'cptCanvasYPercent', 'frozenFontSize', 'isEmphasis']

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const median = (values) => quantile(values.filter(Number.isFinite), 0.5)
const average = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0)

function templateMarkupOf(caption) {
  return String(caption?.template_markup || caption?.applied_template_style?.template_markup || '')
}

// Timings per text token: measured word timings when they line up with the
// text, otherwise the caption's span shared by character count.
function wordTimings(caption, tokens) {
  const start = Number(caption?.start_time) || 0
  const end = Math.max(start, Number(caption?.end_time) || start)
  const timed = Array.isArray(caption?.words)
    ? caption.words.filter((word) => Number.isFinite(Number(word?.start)) && Number.isFinite(Number(word?.end)))
    : []
  if (timed.length === tokens.length && tokens.length) {
    return timed.map((word) => ({ start: Number(word.start), end: Math.max(Number(word.start), Number(word.end)) }))
  }
  const weights = tokens.map((token) => Math.max(1, countLettersAndNumbers(token.word)))
  const total = weights.reduce((sum, weight) => sum + weight, 0) || 1
  let cursor = start
  return weights.map((weight) => {
    const span = ((end - start) * weight) / total
    const timing = { start: cursor, end: cursor + span }
    cursor += span
    return timing
  })
}

function levelBetween(waveform, duration, from, to) {
  if (!waveform.length || !(duration > 0) || !(to > from)) return null
  const first = clamp(Math.floor((from / duration) * waveform.length), 0, waveform.length - 1)
  const last = clamp(Math.ceil((to / duration) * waveform.length), first + 1, waveform.length)
  return average(waveform.slice(first, last))
}

// Stress per word: wording (content word, number, !/?), elongation, pauses
// around it and loudness relative to the rest of the caption.
function scoreWords(tokens, timings, waveform, duration) {
  const perChar = timings.map((timing, index) => (timing.end - timing.start) / Math.max(1, countLettersAndNumbers(tokens[index].word)))
  const typicalPerChar = median(perChar)
  const levels = timings.map((timing) => levelBetween(waveform, duration, timing.start, timing.end))
  const typicalLevel = average(levels.filter((level) => level != null))
  return tokens.map((token, index) => {
    const word = normalizeEmphasisWord(token.word)
    if (!word) return { index, word: token.word, score: -9 }
    const isNumber = /\p{N}/u.test(word)
    let score = EMPHASIS_STOP_WORDS.has(word) ? -2.5 : Math.min(3, countLettersAndNumbers(word) * 0.5)
    if (isNumber) score += 2.2
    if (/[!?]$/.test(token.word)) score += 0.6
    if (typicalPerChar > 0) score += clamp((perChar[index] / typicalPerChar - 1) * 1.2, -0.6, 1.2)
    if (index > 0 && timings[index].start - timings[index - 1].end >= 0.18) score += 0.6
    if (index < tokens.length - 1 && timings[index + 1].start - timings[index].end >= 0.25) score += 0.3
    if (levels[index] != null && typicalLevel > 0) score += clamp((levels[index] / typicalLevel - 1) * 2, -0.8, 1.5)
    return { index, word: token.word, score }
  })
}

// The look a caption currently shows, when it was never set by the director.
export function getCaptionLayoutMode(caption) {
  if (CAPTION_LAYOUT_MODES.includes(caption?.layoutMode)) return caption.layoutMode
  const styles = Object.values(caption?.wordStyles || {})
  if (styles.some(wordHasCreativePosition)) return 'cpt'
  if (styles.some((style) => style?.isEmphasis) || (caption?.imp_word_indices || []).length) return 'keywords'
  return 'sentence'
}

export const CAPTION_LAYOUT_MOTIONS = ['none', 'line', 'word']

// Older looks stored motion as a boolean (true = the caption animates in).
export function normalizeLayoutMotion(motion) {
  if (CAPTION_LAYOUT_MOTIONS.includes(motion)) return motion
  return motion === true ? 'line' : 'none'
}

export function getCaptionLayoutMotion(caption) {
  if (getCaptionLayoutMode(caption) === 'cpt') return 'word'
  if (caption?.layoutMotion !== undefined) return normalizeLayoutMotion(caption.layoutMotion)
  if (caption?.revealMode === 'word') return 'word'
  return caption?.animation && caption.animation !== 'none' ? 'line' : 'none'
}

// Hand-made work the director must not overwrite on Auto layout.
function isLockedForAuto(caption) {
  if (caption?.layoutSource === 'user') return true
  if (caption?.layoutSource === 'auto') return false
  const styles = Object.values(caption?.wordStyles || {})
  return styles.some((style) => wordHasCreativePosition(style) || style?.isEmphasis)
}

/**
 * Suggest a look for every speech caption.
 * @returns {Array<{ captionId, captionIndex, mode, motion, animation, keywordIndices, heroIndex, intensity, locked }>}
 */
export function planCaptionLayouts(captions = [], { waveformData = [], duration = 0 } = {}) {
  const speech = captions.filter((caption) => caption && !caption.isTextElement)
  const waveform = Array.isArray(waveformData) ? waveformData.map(Number).filter(Number.isFinite).map(Math.abs) : []
  const videoDuration = duration > 0 ? duration : Math.max(0, ...speech.map((caption) => Number(caption.end_time) || 0))

  const analyses = speech.map((caption, captionIndex) => {
    const tokens = splitCaptionWordTokens(caption.text)
    const timings = wordTimings(caption, tokens)
    const start = Number(caption.start_time) || 0
    const end = Math.max(start, Number(caption.end_time) || start)
    const words = scoreWords(tokens, timings, waveform, videoDuration)
    const ranked = [...words].filter((word) => word.score > -9).sort((a, b) => b.score - a.score)
    const keywordIndices = []
    if (ranked[0] && ranked[0].score >= KEYWORD_MIN_SCORE) keywordIndices.push(ranked[0].index)
    if (tokens.length >= 7 && ranked[1] && ranked[1].score >= KEYWORD_MIN_SCORE && ranked[1].score >= ranked[0].score * 0.85) {
      keywordIndices.push(ranked[1].index)
    }
    const previous = speech[captionIndex - 1]
    return {
      caption,
      captionIndex,
      start,
      seconds: end - start,
      wordCount: tokens.length,
      chars: tokens.reduce((sum, token) => sum + countLettersAndNumbers(token.word), 0),
      level: levelBetween(waveform, videoDuration, start, end),
      rate: tokens.length / Math.max(0.3, end - start),
      pauseBefore: previous ? start - (Number(previous.end_time) || start) : 0,
      topScore: ranked[0]?.score ?? 0,
      heroIndex: ranked[0]?.index ?? 0,
      keywordIndices: keywordIndices.sort((a, b) => a - b),
      emphatic: /[!?]/.test(caption.text || ''),
      hasNumber: /\p{N}/u.test(caption.text || ''),
    }
  })

  const levels = analyses.map((item) => item.level).filter((level) => level != null)
  const levelMid = median(levels)
  const levelHigh = quantile(levels, 0.85)
  const rateMid = median(analyses.map((item) => item.rate))
  analyses.forEach((item, index) => {
    let intensity = 0
    if (item.level != null && levels.length) intensity += 0.9 * clamp((item.level - levelMid) / Math.max(0.05, levelHigh - levelMid), -1.5, 2)
    if (rateMid > 0) intensity += 0.35 * clamp((item.rate - rateMid) / Math.max(0.5, rateMid * 0.35), -1, 1.5)
    intensity += 0.35 * clamp((item.topScore - 2) / 2, 0, 1.5)
    if (item.emphatic) intensity += 0.5
    if (item.hasNumber) intensity += 0.4
    if (item.pauseBefore >= 0.6) intensity += 0.4
    if (index === 0) intensity += 0.6
    if (index === analyses.length - 1 && analyses.length > 1) intensity += 0.4
    item.intensity = intensity
  })

  const intensities = analyses.map((item) => item.intensity)
  const cptThreshold = quantile(intensities, 0.7)
  const motionThreshold = quantile(intensities, 0.4)
  const keywordThreshold = median(intensities) - 0.1
  const maxCpt = Math.max(1, Math.round(videoDuration / 10))
  const chosenCpt = analyses.filter((item) => isLockedForAuto(item.caption) && getCaptionLayoutMode(item.caption) === 'cpt')
  const cptEligible = (item) => item.seconds >= CPT_MIN_SECONDS
    && item.wordCount >= CPT_MIN_WORDS && item.wordCount <= CPT_MAX_WORDS && item.chars <= CPT_MAX_CHARS

  // CPT: the strongest eligible lines, spaced out and never back to back.
  ;[...analyses]
    .filter((item) => !isLockedForAuto(item.caption) && cptEligible(item))
    .sort((a, b) => b.intensity - a.intensity)
    .forEach((item) => {
      const strongEnough = item.intensity >= cptThreshold || (item.captionIndex === 0 && item.intensity >= median(intensities))
      const spaced = chosenCpt.every((other) => Math.abs(other.captionIndex - item.captionIndex) > 1 && Math.abs(other.start - item.start) >= CPT_SPACING_SECONDS)
      if (strongEnough && spaced && chosenCpt.length < maxCpt) chosenCpt.push(item)
    })
  const cptIds = new Set(chosenCpt.map((item) => item.caption.id))

  return analyses.map((item) => {
    const locked = isLockedForAuto(item.caption)
    let mode
    if (locked) mode = getCaptionLayoutMode(item.caption)
    else if (cptIds.has(item.caption.id)) mode = 'cpt'
    else if (item.wordCount >= 3 && item.keywordIndices.length && (item.intensity >= keywordThreshold || item.topScore >= 3.2)) mode = 'keywords'
    else mode = 'sentence'
    // Motion: calm lines stay still; energetic, wordy lines build word by word
    // as spoken; other moving lines animate in as a whole.
    let motion = 'none'
    if (locked) motion = getCaptionLayoutMotion(item.caption)
    else if (mode === 'cpt') motion = 'word'
    else if (item.intensity >= motionThreshold) {
      motion = item.wordCount >= 4 && item.seconds >= 1.6 && item.rate >= rateMid ? 'word' : 'line'
    }
    // Calm lines fade in, ordinary ones rise, peaks pop.
    const animation = item.intensity >= cptThreshold ? 'pop' : item.intensity >= motionThreshold ? 'rise' : 'fade'
    return {
      captionId: item.caption.id,
      captionIndex: item.captionIndex,
      mode,
      motion,
      animation,
      keywordIndices: item.keywordIndices.length ? item.keywordIndices : [item.heroIndex],
      heroIndex: item.heroIndex,
      intensity: Number(item.intensity.toFixed(3)),
      locked,
    }
  })
}

function defaultMeasure(text, sizePx, { fontFamily = 'Inter', fontWeight = '700' } = {}) {
  if (typeof document !== 'undefined') {
    const context = document.createElement('canvas').getContext('2d')
    if (context) {
      context.font = `${fontWeight} ${sizePx}px "${fontFamily}"`
      return context.measureText(text).width
    }
  }
  return countLettersAndNumbers(text) * sizePx * 0.55
}

/**
 * Place the words of a CPT: the hero word large on its own row, the others
 * packed in reading order above and below it, centred (or left-aligned) on the
 * caption's position and kept inside the safe area.
 * @returns {Array<{ index, xPct, yPct, paintedSize, isHero }>}
 */
export function buildCptComposition({
  words,
  heroIndex = 0,
  baseFontSize = 18,
  frame = { width: REFERENCE_WIDTH, height: 640 },
  anchor = { x: 50, y: 80 },
  align = 'center',
  measure = defaultMeasure,
  font = {},
}) {
  const width = frame.width
  const height = frame.height
  const supportSize = baseFontSize * 1.1
  const widthAt = (word, size) => (measure(word, 100, font) / 100) * size
  const heroWord = words[heroIndex] ?? ''
  const heroSize = Math.max(supportSize * 1.3, Math.min(baseFontSize * 2.4, (width * 0.84) / Math.max(1, widthAt(heroWord, 1))))
  const maxRowWidth = width * 0.8
  const gap = supportSize * 0.28

  const pack = (indices) => {
    const rows = []
    let row = []
    let rowWidth = 0
    indices.forEach((index) => {
      const wordWidth = widthAt(words[index], supportSize)
      const nextWidth = row.length ? rowWidth + gap + wordWidth : wordWidth
      if (row.length && nextWidth > maxRowWidth) {
        rows.push({ indices: row, width: rowWidth, size: supportSize })
        row = [index]
        rowWidth = wordWidth
      } else {
        row.push(index)
        rowWidth = nextWidth
      }
    })
    if (row.length) rows.push({ indices: row, width: rowWidth, size: supportSize })
    return rows
  }
  const before = words.map((_, index) => index).filter((index) => index < heroIndex)
  const after = words.map((_, index) => index).filter((index) => index > heroIndex)
  const rows = [
    ...pack(before),
    { indices: [heroIndex], width: widthAt(heroWord, heroSize), size: heroSize, hero: true },
    ...pack(after),
  ]
  const rowHeight = (row) => row.size * (row.hero ? 1.02 : 1.12)
  const rowGap = supportSize * 0.08
  const blockHeight = rows.reduce((sum, row) => sum + rowHeight(row), 0) + rowGap * (rows.length - 1)
  const blockWidth = Math.max(...rows.map((row) => row.width))
  const centerX = (clamp(Number(anchor.x) || 50, 10, 90) / 100) * width
  const minTop = height * 0.1
  const maxBottom = height * 0.9
  let top = (clamp(Number(anchor.y) || 80, 0, 100) / 100) * height - blockHeight / 2
  top = clamp(top, minTop, Math.max(minTop, maxBottom - blockHeight))

  const placed = []
  rows.forEach((row) => {
    const h = rowHeight(row)
    let x = align === 'left' ? centerX - blockWidth / 2 : centerX - row.width / 2
    row.indices.forEach((index) => {
      const wordWidth = widthAt(words[index], row.size)
      placed.push({
        index,
        xPct: Number((((x + wordWidth / 2) / width) * 100).toFixed(3)),
        yPct: Number((((top + h / 2) / height) * 100).toFixed(3)),
        paintedSize: Number(row.size.toFixed(2)),
        isHero: Boolean(row.hero),
      })
      x += wordWidth + gap
    })
    top += h + rowGap
  })
  return placed.sort((a, b) => a.index - b.index)
}

function stripLayout(style = {}) {
  const next = { ...style }
  LAYOUT_KEYS.forEach((key) => { delete next[key] })
  if (next.autoLayout) delete next.fontSize
  if (next.autoAnimation) delete next.animation
  delete next.autoLayout
  delete next.autoAnimation
  return next
}

// The template phase of the wanted type, nearest the caption's place in the
// authored sequence (so templates keep their rhythm where possible).
function pickTemplatePhase(phaseTypes, wantedTypes, captionIndex) {
  const length = phaseTypes.length
  const cyclic = ((captionIndex % length) + length) % length
  for (const wanted of wantedTypes) {
    let best = -1
    phaseTypes.forEach((type, index) => {
      if (type !== wanted) return
      const distance = Math.min(Math.abs(index - cyclic), length - Math.abs(index - cyclic))
      if (best < 0 || distance < Math.min(Math.abs(best - cyclic), length - Math.abs(best - cyclic))) best = index
    })
    if (best >= 0) return { phaseIndex: best, type: wanted }
  }
  return { phaseIndex: cyclic, type: phaseTypes[cyclic] }
}

/**
 * Apply a look to one caption and return the new caption.
 * @param {object} caption
 * @param {{ mode: string, motion: 'none'|'line'|'word'|boolean, plan?: object, source?: 'auto'|'user', captionStyle?: object,
 *   frame?: {width:number, height:number}, align?: string, measure?: Function }} options
 */
export function applyCaptionLayout(caption, {
  mode,
  motion,
  plan = {},
  source = 'auto',
  captionStyle = {},
  frame = { width: REFERENCE_WIDTH, height: 640 },
  align = 'center',
  measure = defaultMeasure,
}) {
  if (!caption || caption.isTextElement || !CAPTION_LAYOUT_MODES.includes(mode)) return caption
  const tokens = splitCaptionWordTokens(caption.text)
  const keywordIndices = (plan.keywordIndices || []).filter((index) => index >= 0 && index < tokens.length)
  const heroIndex = clamp(Number(plan.heroIndex) || 0, 0, Math.max(0, tokens.length - 1))
  const wordStyles = {}
  Object.entries(caption.wordStyles || {}).forEach(([key, style]) => {
    const next = stripLayout(style)
    if (Object.keys(next).length) wordStyles[key] = next
  })
  const keyOf = (index) => `${caption.id}-${index}`
  const motionKind = mode === 'cpt' ? 'word' : normalizeLayoutMotion(motion)
  const next = { ...caption, layoutMode: mode, layoutMotion: motionKind, layoutSource: source }
  // A per-caption word-by-word reveal (sentence/keywords); CPT reveals as spoken anyway.
  if (motionKind === 'word' && mode !== 'cpt') next.revealMode = 'word'
  else delete next.revealMode

  const phaseTypes = templateMarkupOf(caption) ? getTemplatePhaseTypes(templateMarkupOf(caption)) : []
  if (new Set(phaseTypes).size > 1) {
    // Template caption: the template draws the look from its own phase
    // (plain = still, normal = word-by-word animated, styled = its own layout).
    delete next.revealMode
    const wanted = mode === 'cpt'
      ? ['styled', 'normal']
      : motionKind === 'none' ? ['plain', 'normal'] : ['normal', 'styled', 'plain']
    const { phaseIndex, type } = pickTemplatePhase(phaseTypes, wanted, Number(plan.captionIndex) || 0)
    const emphasis = mode === 'sentence' ? [] : (mode === 'cpt' ? [heroIndex] : keywordIndices)
    return {
      ...next,
      wordStyles,
      template_phase_index: phaseIndex,
      emotional_mode: type,
      imp_word_index: emphasis[0] ?? -1,
      imp_word_indices: emphasis,
    }
  }

  next.animation = motionKind === 'line' && mode !== 'cpt' ? (plan.animation || 'rise') : 'none'
  if (mode === 'keywords') {
    keywordIndices.forEach((index) => {
      wordStyles[keyOf(index)] = { ...(wordStyles[keyOf(index)] || {}), isEmphasis: true }
    })
  }
  if (mode === 'cpt' && tokens.length) {
    const baseFontSize = Number(captionStyle.font_size) || 18
    const placed = buildCptComposition({
      words: tokens.map((token) => token.word),
      heroIndex,
      baseFontSize,
      frame,
      anchor: { x: Number(captionStyle.position_x ?? 50), y: Number(captionStyle.position_y ?? 80) },
      align,
      measure,
      font: { fontFamily: captionStyle.font_family || 'Inter', fontWeight: captionStyle.font_weight || '700' },
    })
    placed.forEach(({ index, xPct, yPct, paintedSize, isHero }) => {
      const current = wordStyles[keyOf(index)] || {}
      const hasOwnAnimation = Boolean(current.animation && current.animation !== 'none')
      wordStyles[keyOf(index)] = {
        ...current,
        x: 0,
        y: 0,
        x_pct: 0,
        y_pct: 0,
        abs_x_pct: xPct,
        abs_y_pct: yPct,
        cptCanvasXPercent: xPct,
        cptCanvasYPercent: yPct,
        frozenFontSize: baseFontSize,
        // The hero is emphasised (painted 1.2x), so its stored size is divided back.
        fontSize: Number((isHero ? paintedSize / 1.2 : paintedSize).toFixed(2)),
        ...(isHero ? { isEmphasis: true } : {}),
        // Smart default motion: a strong entrance for the hero, a subtle one for the rest.
        ...(hasOwnAnimation ? {} : { animation: isHero ? 'pop' : 'rise', autoAnimation: true }),
        autoLayout: true,
      }
    })
  }
  return { ...next, wordStyles }
}

/**
 * Auto layout for every caption the user has not set by hand.
 * @returns {{ captions: object[], counts: Record<string, number> }}
 */
export function autoLayoutCaptions(captions = [], { waveformData, duration, captionStyle, frame, measure } = {}) {
  const plans = new Map(planCaptionLayouts(captions, { waveformData, duration }).map((plan) => [plan.captionId, plan]))
  const counts = { sentence: 0, keywords: 0, cpt: 0, line: 0, word: 0, kept: 0 }
  let cptOrder = 0
  const next = captions.map((caption) => {
    const plan = plans.get(caption?.id)
    if (!plan) return caption
    if (plan.locked) {
      counts.kept += 1
      return caption
    }
    counts[plan.mode] += 1
    if (plan.mode !== 'cpt' && plan.motion !== 'none') counts[plan.motion] += 1
    const align = plan.mode === 'cpt' ? (cptOrder++ % 2 ? 'left' : 'center') : 'center'
    return applyCaptionLayout(caption, { mode: plan.mode, motion: plan.motion, plan, source: 'auto', captionStyle, frame, align, measure })
  })
  return { captions: next, counts }
}

/** Apply a look the user picked for one caption (keeps the director's word choice). */
export function setCaptionLayout(captions = [], captionId, { mode, motion }, { waveformData, duration, captionStyle, frame, measure } = {}) {
  const plan = planCaptionLayouts(captions, { waveformData, duration }).find((item) => item.captionId === captionId) || {}
  return captions.map((caption) => (caption?.id === captionId
    ? applyCaptionLayout(caption, { mode, motion, plan, source: 'user', captionStyle, frame, measure })
    : caption))
}
