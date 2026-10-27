import { useState } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const requests = []
let holdSave = null
vi.mock('@/lib/apiClient', () => ({
  apiRequest: vi.fn(async (path, options = {}) => {
    const body = options.body ? JSON.parse(options.body) : null
    requests.push({ path, body })
    if (path === '/api/draft/save' && holdSave) await holdSave
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

const useProjects = () => {
  const [projectId, setProjectId] = useState(null)
  return { projectId, setProjectId, ...useCloudProjects({ currentUser: user, getAuthToken, projectId, setProjectId, onMessage }) }
}

describe('useCloudProjects', () => {
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
})
