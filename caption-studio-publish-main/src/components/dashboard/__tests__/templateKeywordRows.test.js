import { describe, expect, it } from 'vitest'
import {
  planTemplateRowWords,
  splitTemplateKeywordClasses,
  stripTemplateKeywordColor,
  templateBlockHasAuthoredKeyword,
} from '../templateTextRules.js'
import { _astFillBlock } from '../videoPlayerTemplateRendering.jsx'

const block = (html) => {
  const element = document.createElement('div')
  element.className = 'sb'
  element.innerHTML = html
  return element
}

describe('template keyword rows', () => {
  it('splits keyword classes from slot classes', () => {
    expect(splitTemplateKeywordClasses('w hero is-emphasis on')).toEqual({ base: 'w on', keyword: 'hero' })
    expect(splitTemplateKeywordClasses('w ns3box')).toEqual({ base: 'w', keyword: 'ns3box' })
  })

  it('drops the per-scene keyword colour but keeps other inline style', () => {
    expect(stripTemplateKeywordColor('color:#ff0;letter-spacing:.1em')).toBe('letter-spacing:.1em')
  })

  it('puts the important word in the keyword row between two body rows', () => {
    // anchor: "protect your / MORNINGS. / win them first."
    expect(planTemplateRowWords([2, 1, 3], 6, [3], 1)).toEqual([[0, 1, 2], [3], [4, 5]])
  })

  it('ends the sentence in a bottom keyword row only when that stays short', () => {
    expect(planTemplateRowWords([3, 1], 5, [3], 1)).toEqual([[0, 1, 2], [3, 4]])
    // Keyword near the start would make most of the line big: keep proportions.
    expect(planTemplateRowWords([3, 1], 8, [1], 1)).toEqual([[0, 1, 2, 3, 4, 5], [6, 7]])
  })

  it('keeps reading order in a drop row: the keyword and the words after it', () => {
    expect(planTemplateRowWords([5, 1], 6, [3], 1)).toEqual([[0, 1, 2], [3, 4, 5]])
  })

  it('falls back to proportional rows without a keyword', () => {
    expect(planTemplateRowWords([2, 2], 4, [], 1)).toEqual([[0, 1], [2, 3]])
  })
})

describe('template phases without an authored keyword', () => {
  it('knows which phases were designed with a keyword', () => {
    expect(templateBlockHasAuthoredKeyword(block('<div class="nline"><span class="w hero is-emphasis">x</span></div>'))).toBe(true)
    expect(templateBlockHasAuthoredKeyword(block('<div class="nline plainwrap"><span class="w on">x</span></div>'))).toBe(false)
  })

  it('shows no guessed highlight on a plain phase but keeps a chosen one', () => {
    const plain = () => block('<div class="nline plainwrap"><span class="w on">a</span> <span class="w on">b</span></div>')
    const words = ['nobody', 'feels', 'ready']
    const guessed = plain()
    _astFillBlock(guessed, words, words.join(' '), true, -1, [1])
    expect(guessed.querySelectorAll('.is-emphasis')).toHaveLength(0)
    const chosen = plain()
    _astFillBlock(chosen, words, words.join(' '), true, -1, [1], false, true)
    expect(chosen.querySelector('.is-emphasis')?.textContent).toBe('feels')
  })

  it('moves the authored keyword style onto the important word', () => {
    const scene = block('<div class="nline"><span class="w on">you</span> <span class="w hero is-emphasis on" style="color:#f0f">build</span> <span class="w on">the</span> <span class="w on">plane</span></div>')
    const words = ['systems', 'keep', 'working', 'when', 'you', 'cannot']
    _astFillBlock(scene, words, words.join(' '), true, -1, [2])
    const highlighted = Array.from(scene.querySelectorAll('.is-emphasis')).map((word) => word.textContent)
    expect(highlighted).toEqual(['working'])
    expect(scene.querySelectorAll('.hero')).toHaveLength(1)
    expect(scene.querySelector('.hero').textContent).toBe('working')
    expect(scene.innerHTML).not.toContain('#f0f')
  })
})
