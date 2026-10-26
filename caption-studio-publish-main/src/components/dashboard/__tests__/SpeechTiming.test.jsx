import { describe, expect, it, vi } from 'vitest'
import { extractWaveformData } from '../audioUtils'
import { buildEmotionalCaptionPlan, getEmphasisStopWords } from '../emotionalTemplateUtils'
import { restoreEditorDocument } from '@/lib/editorDocument'
import { getCaptionWordRevealTimes, advanceCaptionWordRevealIndex } from '../cptMotion'
import { invalidateWordTimingOutsideCaption } from '../captionEditingUtils'
import { _astResolveTargetImpIndex, rebuildAppliedAdvancedWbwRiseBlock, normalizeAppliedAdvancedStyledBlock, renderTextWithHero } from '../videoPlayerTemplateRendering'
import { render, cleanup } from '@testing-library/react'
import { splitCaptionForTemplate, resolveImpWordIndicesForWords } from '../templateTextRules'
import { planCaptionLayouts } from '../captionLayoutDirector'

describe('speech timeline regressions', () => {
  it('does not promote long unsupported words through the Auto Layout path', () => {
    const caption = { id: 'quiet', text: 'decorative unrelated syllables', start_time: 0, end_time: 2 }
    expect(planCaptionLayouts([caption], { duration: 2, waveformData: [1, 1, 1] })[0].keywordIndices).toEqual([])
  })
  it('does not treat words from unrelated languages as grammatical helpers', () => {
    expect(getEmphasisStopWords('we die', 'english').has('die')).toBe(false)
    expect(getEmphasisStopWords('die Menschen', 'german').has('die')).toBe(true)
    expect(getEmphasisStopWords('ஒரு செயற்கைக்கோள்', 'tamil').has('ஒரு')).toBe(true)
  })
  it('does not manufacture fixed-position template highlights', () => {
    expect(_astResolveTargetImpIndex(1, 4, 8, -1)).toBe(-1)
    expect(splitCaptionForTemplate('and this is the')).toEqual({ top: 'and this is the', full: 'and this is the', hero: '', bottom: '' })
    expect(resolveImpWordIndicesForWords(['one', 'two'], -1, [9, 0.5])).toEqual([])
    const block = document.createElement('div')
    rebuildAppliedAdvancedWbwRiseBlock(block, ['and', 'the', 'is'], -1, '', 't01', 0)
    expect(block.querySelector('.is-emphasis')).toBeNull()
  })

  it('keeps repeated-word identity and never highlights a whole title row', () => {
    const { container } = render(renderTextWithHero('go go go', 'imp-gold', [2]))
    expect(container.querySelectorAll('[data-imp="true"]')).toHaveLength(1)
    expect(container.querySelector('[data-imp="true"]').dataset.w).toBe('2')
    cleanup()
    const block = document.createElement('div')
    block.innerHTML = '<span class="split-title"></span>'
    normalizeAppliedAdvancedStyledBlock(block, 't18', 0, 'go go go go', [], [3])
    expect(block.querySelectorAll('[data-imp="true"]')).toHaveLength(1)
    expect(block.querySelector('[data-imp="true"]').dataset.w).toBe('3')
    normalizeAppliedAdvancedStyledBlock(block, 't18', 0, 'and this is the', [], [])
    expect(block.querySelector('[data-imp="true"]')).toBeNull()
  })

  it('keeps fast measured word boundaries and catches up immediately after seek', () => {
    const caption = { start_time: 0, end_time: 1, words: [{ word: 'fast', start: 0.1, end: 0.12 }, { word: 'speech', start: 0.125, end: 0.2 }] }
    expect(getCaptionWordRevealTimes(caption, 2)).toEqual([0.1, 0.125])
    expect(advanceCaptionWordRevealIndex(0, 8, true)).toBe(8)
    const trimmed = invalidateWordTimingOutsideCaption({ ...caption, start_time: 0.11, end_time: 0.18 })
    expect(trimmed.words).toEqual(caption.words)
    expect(getCaptionWordRevealTimes(trimmed, 2)).toEqual([0.11, 0.125])
  })

  it('reads a nested media source and all channels, including short audio', async () => {
    const fetchMock = vi.spyOn(window, 'fetch').mockResolvedValue({ ok: true, headers: new Headers(), arrayBuffer: async () => new ArrayBuffer(16) })
    const close = vi.fn().mockResolvedValue()
    const old = window.AudioContext
    window.AudioContext = vi.fn(function () {
      this.close = close
      this.decodeAudioData = async () => ({ numberOfChannels: 2, length: 2, getChannelData: channel => new Float32Array(channel ? [1, 0.5] : [0, 0]) })
    })
    try {
      const video = document.createElement('video')
      const source = document.createElement('source')
      source.src = 'https://example.com/clip.mp4'
      video.append(source)
      const waveform = await extractWaveformData(video, 400)
      expect(fetchMock).toHaveBeenCalledWith('https://example.com/clip.mp4')
      expect(waveform.length).toBeGreaterThan(0)
      expect(waveform.every(Number.isFinite)).toBe(true)
      expect(Math.max(...waveform)).toBe(1)
      expect(close).toHaveBeenCalledOnce()
    } finally {
      window.AudioContext = old
      fetchMock.mockRestore()
    }
  })

  it('restores the source-bound waveform with the project', () => {
    const audioAnalysis = { fileId: 'source-1', duration: 5, samples: [0, 0.5, 1, 0] }
    expect(restoreEditorDocument({ fileId: 'source-1', audioAnalysis }).audioAnalysis).toEqual(audioAnalysis)
    expect(restoreEditorDocument({ fileId: 'another-file', audioAnalysis }).audioAnalysis).toBeNull()
  })

  it.each(['and the is to', 'मैं और आप हैं', 'நான் இது ஒரு', 'నేను ఇది ఒక'])('does not invent emphasis for helper-only text: %s', text => {
    const [plan] = buildEmotionalCaptionPlan([{ id: 'c', text, start_time: 0, end_time: 2 }])
    expect(plan.impWordIndices).toEqual([])
  })

  it.each([
    ['the beautiful satellite launched', 2],
    ['discipline builds habits slowly', 2],
    ['यह रॉकेट 2026 में लॉन्च होगा।', 2],
    ['ஒரு புதிய செயற்கைக்கோள்', 2],
    ['ఒక కొత్త ఉపగ్రహం', 2],
  ])('uses facts and noun-phrase context in the actual language: %s', (text, expected) => {
    const caption = { id: 'c', text, start_time: 0, end_time: 2 }
    expect(buildEmotionalCaptionPlan([caption])[0].impWordIndices).toEqual([expected])
  })

  it('keeps manual selection and identical sentence decisions independent of caption position', () => {
    const caption = { id: 'c', text: 'The satellite launched today.', start_time: 0, end_time: 2 }
    const plan = buildEmotionalCaptionPlan([caption])[0]
    const repeat = buildEmotionalCaptionPlan([{ ...caption, id: 'before' }, caption])[1]
    expect(plan.impWordIndices).toEqual(repeat.impWordIndices)
    expect(plan.impWordIndices).not.toContain(0)
    expect(buildEmotionalCaptionPlan([{ ...caption, layoutSource: 'user', imp_word_indices: [0] }])[0].impWordIndices).toEqual([0])
  })

  it('respects a current semantic decision to highlight nothing and discards stale readings', () => {
    const caption = { id: 'c', text: 'Rescue the satellite!', start_time: 0, end_time: 2, aiEmotion: { textKey: 'stale', keywords: [1] } }
    expect(buildEmotionalCaptionPlan([caption])[0].impWordIndices).not.toContain(1)
  })
})
