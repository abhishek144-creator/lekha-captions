import { describe, expect, it } from 'vitest'
import {
  MAX_LOCAL_DRAFT_CHARS,
  localDraftKey,
  readLocalDraft,
  removeLocalDraft,
  writeLocalDraft,
} from '../localDraftStorage'

const memoryStorage = () => {
  const items = new Map()
  return {
    getItem: (key) => (items.has(key) ? items.get(key) : null),
    setItem: (key, value) => { items.set(key, String(value)) },
    removeItem: (key) => { items.delete(key) },
    keys: () => [...items.keys()],
    get length() { return items.size },
    key: (index) => [...items.keys()][index] ?? null,
  }
}

const draft = { fileId: 'file-1', projectId: 'project-1', captions: [{ id: '1', text: 'hello' }] }

describe('local draft storage', () => {
  it('writes the latest, per-project and legacy copies tagged with the owner', () => {
    const storage = memoryStorage()
    expect(writeLocalDraft('alice', draft, storage)).toBe('saved')
    expect(storage.keys().sort()).toEqual([
      'captionEditorState',
      localDraftKey('alice'),
      localDraftKey('alice', 'project-1'),
    ].sort())
    expect(readLocalDraft('alice', storage)).toMatchObject({ ...draft, ownerUid: 'alice' })
  })

  it('never returns another account\'s draft', () => {
    const storage = memoryStorage()
    writeLocalDraft('alice', draft, storage)
    expect(readLocalDraft('bob', storage)).toBeNull()
  })

  it('ignores empty and unreadable copies', () => {
    const storage = memoryStorage()
    storage.setItem(localDraftKey('alice'), '{not json')
    storage.setItem('captionEditorState', JSON.stringify({ ownerUid: 'alice', captions: [] }))
    expect(readLocalDraft('alice', storage)).toBeNull()
  })

  it('refuses drafts larger than browser storage allows', () => {
    const storage = memoryStorage()
    const huge = { ...draft, captions: [{ id: '1', text: 'x'.repeat(MAX_LOCAL_DRAFT_CHARS) }] }
    expect(writeLocalDraft('alice', huge, storage)).toBe('too-large')
    expect(storage.keys()).toEqual([])
  })

  it('does not save for a signed-out editor', () => {
    const storage = memoryStorage()
    expect(writeLocalDraft('', draft, storage)).toBe('signed-out')
    expect(storage.keys()).toEqual([])
  })

  it('surfaces storage failures to the caller', () => {
    const storage = { ...memoryStorage(), setItem: () => { throw new Error('QuotaExceededError') } }
    expect(() => writeLocalDraft('alice', draft, storage)).toThrow('QuotaExceededError')
  })

  it('removes only the owner\'s copies', () => {
    const storage = memoryStorage()
    writeLocalDraft('alice', draft, storage)
    writeLocalDraft('bob', { ...draft, projectId: 'bob-project' }, storage)
    removeLocalDraft('alice', 'project-1', storage)
    expect(readLocalDraft('alice', storage)).toBeNull()
    // The shared legacy key belongs to bob (last writer) and must survive.
    expect(readLocalDraft('bob', storage)).toMatchObject({ projectId: 'bob-project' })
  })

  it('drops older projects\' copies so they cannot fill browser storage', () => {
    const storage = memoryStorage()
    writeLocalDraft('alice', { ...draft, projectId: 'old-project' }, storage)
    writeLocalDraft('bob', { ...draft, projectId: 'bob-project' }, storage)
    writeLocalDraft('alice', draft, storage)
    expect(storage.keys().sort()).toEqual([
      'captionEditorState',
      localDraftKey('alice'),
      localDraftKey('alice', 'project-1'),
      localDraftKey('bob'),
      localDraftKey('bob', 'bob-project'),
    ].sort())
  })
})
