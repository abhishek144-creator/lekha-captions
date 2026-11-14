import { useState } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const requests = []
let holdSave = null
const heldLoads = new Map()
vi.mock('@/lib/apiClient', () => ({
  apiRequest: vi.fn(async (path, options = {}) => {
    const body = options.body ? JSON.parse(options.body) : null
    requests.push({ path, body })
    if (path === '/api/draft/save' && holdSave) await holdSave
    if (path === '/api/draft/load' && heldLoads.has(body?.project_id)) return heldLoads.get(body.project_id)
    if (path === '/api/draft/load') return { revision: 4, project_id: 'older-project', draft: { projectId: 'older-project' } }
    if (path === '/api/projects/list') return { projects: [] }
    if (path === '/api/workspaces') return { workspaces: [] }
    if (path === '/api/draft/save') return { success: true, revision: 1, project_id: body.project_id, draft: body.draft }
    throw new Error(`unexpected ${path}`)
  }),
}))

const { useCloudProjects } = await import('../useCloudProjects')

const user = { uid: 'alice', getIdToken: async () => 'token' }
const getAuthToken = async () => 'token'
const onMessage = () => {}

const useProjects = ({ currentUser = user } = {}) => {
  const [projectId, setProjectId] = useState(null)
  return { projectId, setProjectId, ...useCloudProjects({ currentUser, getAuthToken, projectId, setProjectId, onMessage }) }
}

describe('useCloudProjects', () => {
  beforeEach(() => { requests.length = 0; holdSave = null; heldLoads.clear() })
  it('gives a draft without a project its own new project instead of a shared one', async () => {
    const { result } = renderHook(useProjects)
    await waitFor(() => expect(result.current.cloudReady).toBe(true))
    await act(async () => { await result.current.saveCloudDraft({ captions: [], fileId: 'f1' }) })
    const save = requests.find((request) => request.path === '/api/draft/save')
    expect(save.body.project_id).toMatch(/^local_\d+$/)
    expect(save.body.draft.projectId).toBe(save.body.project_id)
    // A new project starts at revision 0, never the latest project's revision.
    expect(save.body.expected_revision).toBe(0)
    expect(result.current.projectId).toBe(save.body.project_id)
  })

  it('keeps the new project when an older project save finishes after Upload New', async () => {
    const { result } = renderHook(useProjects)
    await waitFor(() => expect(result.current.cloudReady).toBe(true))
    act(() => result.current.setProjectId('local_previous'))
    let releaseSave
    holdSave = new Promise((resolve) => { releaseSave = resolve })
    let pending
    act(() => { pending = result.current.saveCloudDraft({ projectId: 'local_previous', captions: [], fileId: 'old' }) })
    await waitFor(() => expect(requests.some((request) => request.body?.project_id === 'local_previous')).toBe(true))

    // Upload New commits the replacement project while the save is in flight.
    act(() => result.current.setProjectId('local_replacement'))
    holdSave = null
    await act(async () => {
      releaseSave()
      await pending
    })

    expect(result.current.projectId).toBe('local_replacement')
  })

  it('rejects a selected project that finishes after A -> B -> A', async () => {
    let release
    heldLoads.set('private-project', new Promise(resolve => { release = resolve }))
    const { result, rerender } = renderHook(useProjects, { initialProps: { currentUser: user } })
    await waitFor(() => expect(result.current.cloudReady).toBe(true))
    let pending
    act(() => { pending = result.current.selectCloudProject('private-project') })
    await waitFor(() => expect(requests.some(request => request.body?.project_id === 'private-project')).toBe(true))
    rerender({ currentUser: { ...user, uid: 'bob' } })
    rerender({ currentUser: user })
    await waitFor(() => expect(result.current.cloudReady).toBe(true))
    await act(async () => {
      release({ revision: 19, draft: { projectId: 'private-project', captions: [{ text: 'stale private content' }] } })
      await pending
    })
    expect(result.current.projectId).not.toBe('private-project')
    expect(JSON.stringify(result.current.cloudDraft)).not.toContain('stale private content')
  })

  it('keeps the latest selection when responses arrive in reverse order', async () => {
    let releaseFirst, releaseSecond
    heldLoads.set('first', new Promise(resolve => { releaseFirst = resolve }))
    heldLoads.set('second', new Promise(resolve => { releaseSecond = resolve }))
    const { result } = renderHook(useProjects)
    await waitFor(() => expect(result.current.cloudReady).toBe(true))
    let first, second
    act(() => { first = result.current.selectCloudProject('first'); second = result.current.selectCloudProject('second') })
    await act(async () => { releaseSecond({ revision: 2, draft: { projectId: 'second' } }); await second })
    await act(async () => { releaseFirst({ revision: 1, draft: { projectId: 'first' } }); await first })
    expect(result.current.projectId).toBe('second')
    expect(result.current.cloudDraft.projectId).toBe('second')
  })
})
