import { useState } from 'react'
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useEditorHistory } from '../useEditorHistory'

const useEditor = () => {
  const [captions, setCaptions] = useState([{ id: '1', text: 'first' }])
  const [captionStyle, setCaptionStyle] = useState({ text_color: '#fff' })
  const history = useEditorHistory({ captions, captionStyle, setCaptions, setCaptionStyle })
  return { captions, captionStyle, ...history }
}

const text = (result) => result.current.captions[0].text
const edit = (result, value, options) => act(() => {
  result.current.pushHistory([{ id: '1', text: value }], undefined, options)
})

afterEach(() => vi.useRealTimers())

describe('useEditorHistory', () => {
  it('undoes and redoes caption edits in order', () => {
    const { result } = renderHook(useEditor)
    edit(result, 'second')
    edit(result, 'third')
    expect(result.current.canUndo).toBe(true)

    act(() => result.current.undo())
    expect(text(result)).toBe('second')
    act(() => result.current.undo())
    expect(text(result)).toBe('first')
    expect(result.current.canUndo).toBe(false)

    act(() => result.current.redo())
    act(() => result.current.redo())
    expect(text(result)).toBe('third')
    expect(result.current.canRedo).toBe(false)
  })

  it('a new edit discards the redo branch', () => {
    const { result } = renderHook(useEditor)
    edit(result, 'second')
    act(() => result.current.undo())
    expect(result.current.canRedo).toBe(true)
    edit(result, 'branch')
    expect(result.current.canRedo).toBe(false)
  })

  it('records one undo step per typing burst', () => {
    vi.useFakeTimers()
    const { result } = renderHook(useEditor)
    edit(result, 'f', { coalesce: true })
    edit(result, 'fi', { coalesce: true })
    edit(result, 'fir', { coalesce: true })
    act(() => result.current.undo())
    expect(text(result)).toBe('first')
    expect(result.current.canUndo).toBe(false)
  })

  it('records one undo step per colour-picker drag, separate from typing', () => {
    vi.useFakeTimers()
    const { result } = renderHook(useEditor)
    const color = (value) => act(() => {
      result.current.pushHistory(undefined, { text_color: value }, { coalesce: 'caption-style' })
    })
    edit(result, 'typed', { coalesce: true })
    ;['#111111', '#222222', '#333333'].forEach(color)
    expect(result.current.captionStyle.text_color).toBe('#333333')
    act(() => result.current.undo())
    expect(result.current.captionStyle.text_color).toBe('#fff')
    expect(text(result)).toBe('typed')
    act(() => result.current.undo())
    expect(text(result)).toBe('first')
  })

  it('starts a new undo step for the first change after an undo', () => {
    vi.useFakeTimers()
    const { result } = renderHook(useEditor)
    const color = (value) => act(() => {
      result.current.pushHistory(undefined, { text_color: value }, { coalesce: 'caption-style' })
    })
    color('#111111')
    act(() => result.current.undo())
    color('#222222')
    act(() => result.current.undo())
    expect(result.current.captionStyle.text_color).toBe('#fff')
  })

  it('keeps at most 50 undo steps', () => {
    const { result } = renderHook(useEditor)
    for (let index = 0; index < 60; index += 1) edit(result, `edit ${index}`)
    for (let index = 0; index < 50; index += 1) act(() => result.current.undo())
    expect(result.current.canUndo).toBe(false)
    expect(text(result)).toBe('edit 9')
  })

  it('reset clears undo and redo', () => {
    const { result } = renderHook(useEditor)
    edit(result, 'second')
    act(() => result.current.undo())
    act(() => result.current.resetHistory())
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(false)
  })

  it('reset ends a coalesced style gesture before the next project edit', () => {
    vi.useFakeTimers()
    const { result } = renderHook(useEditor)
    act(() => result.current.pushHistory(undefined, { text_color: '#111111' }, { coalesce: 'caption-style' }))
    act(() => result.current.resetHistory())
    act(() => result.current.pushHistory(undefined, { text_color: '#222222' }, { coalesce: 'caption-style' }))
    act(() => result.current.undo())
    expect(result.current.captionStyle.text_color).toBe('#111111')
  })

  it('undoes with Ctrl+Z but leaves typing fields to the browser', () => {
    const { result } = renderHook(useEditor)
    edit(result, 'second')
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true })) })
    expect(text(result)).toBe('second')
    input.remove()
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true })) })
    expect(text(result)).toBe('first')
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: true })) })
    expect(text(result)).toBe('second')
  })
})

describe('useEditorHistory with templates', () => {
  const markup = '<div class="btcard">'.padEnd(2000, 'x') + '</div>'
  const useTemplatedEditor = () => {
    const [captions, setCaptions] = useState([{ id: '1', text: 'first', template_markup: markup, applied_template_style: { template_markup: markup } }])
    const [captionStyle, setCaptionStyle] = useState({ template_markup: markup, template_snapshot: { template_markup: markup } })
    const history = useEditorHistory({ captions, captionStyle, setCaptions, setCaptionStyle })
    return { captions, captionStyle, ...history }
  }

  it('restores template markup on undo and applies functional updates', () => {
    const { result } = renderHook(useTemplatedEditor)
    act(() => result.current.pushHistory((previous) => previous.map((item) => ({ ...item, text: 'second' }))))
    expect(text(result)).toBe('second')
    act(() => result.current.undo())
    expect(text(result)).toBe('first')
    expect(result.current.captions[0].template_markup).toBe(markup)
    expect(result.current.captions[0].applied_template_style.template_markup).toBe(markup)
    expect(result.current.captions[0].template_markup_shared).toBeUndefined()
  })

  it('keeps the same function identities across renders', () => {
    const { result, rerender } = renderHook(useTemplatedEditor)
    const { pushHistory, undo, redo } = result.current
    act(() => result.current.pushHistory([{ id: '1', text: 'x' }]))
    rerender()
    expect(result.current.pushHistory).toBe(pushHistory)
    expect(result.current.undo).toBe(undo)
    expect(result.current.redo).toBe(redo)
  })

  it('a coalesced edit right after undo is still its own undo step', () => {
    const { result } = renderHook(useEditor)
    edit(result, 'second', { coalesce: true })
    act(() => result.current.undo())
    edit(result, 'again', { coalesce: true })
    act(() => result.current.undo())
    expect(text(result)).toBe('first')
  })
})
