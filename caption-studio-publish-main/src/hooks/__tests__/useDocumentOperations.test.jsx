import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useDocumentOperations } from '../useDocumentOperations'

const initial = { ownerUid: 'alice', fileId: 'video-a', projectId: 'project-a', text: 'Original' }
const setup = () => renderHook((props) => useDocumentOperations(props, { text: props.text }), { initialProps: initial })

describe('async document boundaries', () => {
  it.each(['bob', ''])('aborts account A results when the owner becomes %s, including A -> B -> A', (ownerUid) => {
    const { result, rerender } = setup()
    const operation = result.current.start('translation')
    rerender({ ...initial, ownerUid })
    expect(operation.signal.aborted).toBe(true)
    rerender(initial)
    expect(() => operation.assertCurrent()).toThrow(/changed/)
  })

  it.each([{ fileId: 'video-b' }, { projectId: 'project-b' }])('rejects an old document response after %o', (change) => {
    const { result, rerender } = setup()
    const operation = result.current.start('translation')
    rerender({ ...initial, ...change })
    expect(operation.isCurrent()).toBe(false)
    expect(operation.signal.aborted).toBe(true)
  })

  it('preserves intervening edits and clears a stale operation without clearing its replacement', () => {
    const { result, rerender } = setup()
    const old = result.current.start('translation', { watchContent: true })
    rerender({ ...initial, text: 'My latest edit' })
    expect(old.isCurrent()).toBe(false)
    expect(old.isActive()).toBe(true)
    const replacement = result.current.start('translation')
    old.finish()
    expect(replacement.isCurrent()).toBe(true)
    replacement.finish()
    expect(replacement.isActive()).toBe(false)
  })

  it('lets an upload assign its own document identity, but cancels it on reset or unmount', () => {
    const { result, rerender, unmount } = setup()
    const upload = result.current.start('upload', { scope: 'account' })
    rerender({ ...initial, fileId: 'new-upload', projectId: 'new-project' })
    expect(upload.isCurrent()).toBe(true)
    act(() => result.current.cancelAll())
    expect(upload.signal.aborted).toBe(true)
    const next = result.current.start('upload', { scope: 'account' })
    unmount()
    expect(next.signal.aborted).toBe(true)
  })
})
