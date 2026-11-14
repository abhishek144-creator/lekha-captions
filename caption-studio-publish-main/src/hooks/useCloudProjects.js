import { useCallback, useEffect, useRef, useState } from 'react'

import { apiRequest } from '@/lib/apiClient'
import { compactDraftForStorage } from '@/lib/editorDocument'
import { createLocalProjectId } from '@/lib/projectId'


export function useCloudProjects({ currentUser, getAuthToken, projectId, setProjectId, onMessage }) {
  const revisionRef = useRef(0)
  const revisionProjectRef = useRef('')
  const sessionRef = useRef({ uid: currentUser?.uid })
  if (sessionRef.current.uid !== currentUser?.uid) sessionRef.current = { uid: currentUser?.uid }
  const selectionRef = useRef(0)
  const saveChainRef = useRef(Promise.resolve())
  // A draft saved before it has a project ID gets one here. Without it the
  // server stored every such save under one shared "current" project, so a
  // later session's first save collided with it (409) and stopped autosave.
  const assignedProjectIdRef = useRef('')
  const [cloudDraft, setCloudDraft] = useState(null)
  const [cloudProjects, setCloudProjects] = useState([])
  const [cloudReady, setCloudReady] = useState(false)
  const [workspaces, setWorkspaces] = useState([])
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('')

  useEffect(() => {
    let disposed = false
    const session = sessionRef.current
    setCloudReady(false)
    setCloudDraft(null)
    setCloudProjects([])
    setWorkspaces([])
    setActiveWorkspaceId('')
    revisionRef.current = 0
    revisionProjectRef.current = ''
    assignedProjectIdRef.current = ''
    if (currentUser) {
      getAuthToken(currentUser).then(async (idToken) => {
        if (disposed || sessionRef.current !== session) return null
        const [draftData, projectData, workspaceData] = await Promise.all([
          apiRequest('/api/draft/load', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id_token: idToken }),
          }),
          apiRequest('/api/projects/list', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id_token: idToken }),
          }),
          apiRequest('/api/workspaces', {
            headers: { Authorization: `Bearer ${idToken}` },
          }),
        ])
        return { draftData, projects: projectData.projects || [], workspaces: workspaceData.workspaces || [] }
      }).then((result) => {
        if (!result || disposed || sessionRef.current !== session) return
        const { draftData, projects, workspaces: availableWorkspaces } = result
        revisionRef.current = draftData.revision
        revisionProjectRef.current = draftData.project_id || draftData.draft?.projectId || ''
        setCloudDraft(draftData.draft)
        setCloudProjects(projects)
        setWorkspaces(availableWorkspaces)
        setCloudReady(true)
      }).catch(() => {
        if (!disposed && sessionRef.current === session) onMessage('Cloud projects are unavailable. Local edits are still kept in this browser.')
      })
    }
    return () => { disposed = true }
  }, [currentUser, getAuthToken, onMessage])

  const saveCloudDraft = useCallback((draft) => {
    const session = sessionRef.current
    const save = async () => {
      if (!cloudReady || !currentUser || sessionRef.current !== session || session.uid !== currentUser.uid) throw new Error('Cloud saving is unavailable. Your browser copy is still available.')
      const idToken = await getAuthToken(currentUser)
      if (sessionRef.current !== session) throw new DOMException('Account changed; save cancelled.', 'AbortError')
      if (!draft.projectId && !projectId && !assignedProjectIdRef.current) {
        assignedProjectIdRef.current = createLocalProjectId()
      }
      const targetProjectId = draft.projectId || projectId || assignedProjectIdRef.current
      const storedDraft = compactDraftForStorage({ ...draft, projectId: targetProjectId })
      // A newly created project must not inherit the latest project's revision.
      const expectedRevision = targetProjectId === revisionProjectRef.current ? revisionRef.current : 0
      const data = activeWorkspaceId
        ? await apiRequest(`/api/workspaces/${activeWorkspaceId}/projects`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
            body: JSON.stringify({
              project_id: targetProjectId, draft: storedDraft, expected_revision: expectedRevision,
            }),
          })
        : await apiRequest('/api/draft/save', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id_token: idToken,
              project_id: targetProjectId,
              draft: storedDraft,
              expected_revision: expectedRevision,
            }),
          })
      if (sessionRef.current !== session) return data
      assignedProjectIdRef.current = ''
      const savedProjectId = data.project_id || data.draft?.projectId || targetProjectId
      revisionRef.current = data.revision
      revisionProjectRef.current = savedProjectId
      setCloudDraft(data.draft)
      // Upload New (or opening another project) may have moved the editor on
      // while this save was in flight. Adopting the saved ID then would point
      // the next autosave, with the new video, at this older project.
      setProjectId((current) => (!current || current === targetProjectId ? savedProjectId : current))
      setCloudProjects((projects) => {
        const next = {
          project_id: data.project_id || data.draft?.projectId,
          name: data.draft?.projectName || data.draft?.originalFileName || 'Untitled project',
          revision: data.revision,
          saved_at: data.saved_at,
          file_id: data.draft?.fileId || '',
        }
        return [next, ...projects.filter((item) => item.project_id !== next.project_id)]
      })
      return data
    }
    const pending = saveChainRef.current.catch(() => {}).then(save)
    saveChainRef.current = pending
    return pending
  }, [activeWorkspaceId, cloudReady, currentUser, getAuthToken, projectId, setProjectId])

  const selectCloudProject = useCallback(async (nextProjectId) => {
    if (!currentUser || !nextProjectId) return
    const session = sessionRef.current
    const selection = ++selectionRef.current
    try {
      const idToken = await getAuthToken(currentUser)
      if (sessionRef.current !== session) return
      const data = activeWorkspaceId
        ? await apiRequest(`/api/workspaces/${activeWorkspaceId}/projects/${encodeURIComponent(nextProjectId)}`, {
            headers: { Authorization: `Bearer ${idToken}` },
          })
        : await apiRequest('/api/draft/load', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_token: idToken, project_id: nextProjectId }),
          })
      if (sessionRef.current !== session || selection !== selectionRef.current) return
      revisionRef.current = data.revision
      revisionProjectRef.current = nextProjectId
      setCloudDraft(data.raw_url ? { ...data.draft, _workspaceRawUrl: data.raw_url } : data.draft)
      setProjectId(nextProjectId)
      onMessage('Project ready to restore')
    } catch (error) {
      if (sessionRef.current !== session || selection !== selectionRef.current) return
      onMessage(error.message || 'Project could not be loaded')
    }
  }, [activeWorkspaceId, currentUser, getAuthToken, onMessage, setProjectId])

  const deleteCloudProject = useCallback(async (targetProjectId) => {
    if (!currentUser || !targetProjectId) return false
    const session = sessionRef.current
    try {
      const idToken = await getAuthToken(currentUser)
      if (sessionRef.current !== session) return false
      if (activeWorkspaceId) {
        await apiRequest(`/api/workspaces/${activeWorkspaceId}/projects/${encodeURIComponent(targetProjectId)}`, {
          method: 'DELETE', headers: { Authorization: `Bearer ${idToken}` },
        })
      } else {
        await apiRequest('/api/projects/delete', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_token: idToken, project_id: targetProjectId }),
        })
      }
      if (sessionRef.current !== session) return false
      const remaining = cloudProjects.filter((item) => item.project_id !== targetProjectId)
      setCloudProjects(remaining)
      revisionRef.current = 0
      revisionProjectRef.current = ''
      if (remaining.length > 0) {
        await selectCloudProject(remaining[0].project_id)
      } else {
        setCloudDraft(null)
        setProjectId(null)
      }
      if (sessionRef.current !== session) return false
      onMessage('Project deleted')
      return true
    } catch (error) {
      if (sessionRef.current !== session) return false
      onMessage(error.message || 'Project could not be deleted')
      return false
    }
  }, [activeWorkspaceId, cloudProjects, currentUser, getAuthToken, onMessage, selectCloudProject, setProjectId])

  const switchProjectScope = useCallback(async (workspaceId = '') => {
    if (!currentUser) return
    const session = { uid: currentUser.uid }
    sessionRef.current = session
    ++selectionRef.current
    try {
      const idToken = await getAuthToken(currentUser)
      if (sessionRef.current !== session) return
      setCloudReady(false)
      setActiveWorkspaceId(workspaceId)
      let projects = []
      let draftData = { revision: 0, draft: null }
      if (workspaceId) {
        const list = await apiRequest(`/api/workspaces/${workspaceId}/projects`, {
          headers: { Authorization: `Bearer ${idToken}` },
        })
        projects = list.projects || []
        if (sessionRef.current !== session) return
        if (projects[0]) {
          draftData = await apiRequest(`/api/workspaces/${workspaceId}/projects/${encodeURIComponent(projects[0].project_id)}`, {
            headers: { Authorization: `Bearer ${idToken}` },
          })
        }
      } else {
        const [draft, list] = await Promise.all([
          apiRequest('/api/draft/load', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id_token: idToken }),
          }),
          apiRequest('/api/projects/list', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id_token: idToken }),
          }),
        ])
        draftData = draft
        projects = list.projects || []
      }
      if (sessionRef.current !== session) return
      assignedProjectIdRef.current = ''
      revisionRef.current = draftData.revision || 0
      revisionProjectRef.current = draftData.project_id || draftData.draft?.projectId || ''
      setCloudDraft(draftData.raw_url ? { ...draftData.draft, _workspaceRawUrl: draftData.raw_url } : draftData.draft)
      setCloudProjects(projects)
      setProjectId(draftData.project_id || draftData.draft?.projectId || null)
      setCloudReady(true)
      onMessage(workspaceId ? 'Workspace projects loaded' : 'Personal projects loaded')
    } catch (error) {
      if (sessionRef.current !== session) return
      setCloudReady(true)
      onMessage(error.message || 'Project workspace could not be loaded')
    }
  }, [currentUser, getAuthToken, onMessage, setProjectId])

  const renameCloudProject = useCallback(async (targetProjectId, name) => {
    if (!currentUser || !targetProjectId || !name?.trim()) return false
    const session = sessionRef.current
    try {
      const idToken = await getAuthToken(currentUser)
      if (sessionRef.current !== session) return false
      const data = activeWorkspaceId
        ? await apiRequest(`/api/workspaces/${activeWorkspaceId}/projects`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
            body: JSON.stringify({
              project_id: targetProjectId,
              expected_revision: revisionRef.current,
              draft: { ...cloudDraft, projectName: name.trim() },
            }),
          })
        : await apiRequest('/api/projects/rename', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_token: idToken, project_id: targetProjectId, name: name.trim() }),
          })
      if (sessionRef.current !== session) return false
      revisionRef.current = data.revision
      revisionProjectRef.current = data.project_id || data.draft?.projectId || targetProjectId
      setCloudDraft(data.draft)
      setCloudProjects((projects) => projects.map((item) => (
        item.project_id === targetProjectId ? { ...item, name: data.draft.projectName, revision: data.revision, saved_at: data.saved_at } : item
      )))
      onMessage('Project renamed')
      return true
    } catch (error) {
      if (sessionRef.current !== session) return false
      onMessage(error.message || 'Project could not be renamed')
      return false
    }
  }, [activeWorkspaceId, cloudDraft, currentUser, getAuthToken, onMessage])

  const duplicateCloudProject = useCallback(async (targetProjectId, name = '') => {
    if (!currentUser || !targetProjectId) return false
    const session = sessionRef.current
    try {
      const idToken = await getAuthToken(currentUser)
      if (sessionRef.current !== session) return false
      let data
      if (activeWorkspaceId) {
        const duplicateId = `project-${crypto.randomUUID()}`
        data = await apiRequest(`/api/workspaces/${activeWorkspaceId}/projects`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({
            project_id: duplicateId,
            expected_revision: 0,
            draft: {
              ...cloudDraft,
              projectId: duplicateId,
              projectName: name.trim() || `${cloudDraft?.projectName || 'Untitled project'} copy`,
            },
          }),
        })
      } else {
        data = await apiRequest('/api/projects/duplicate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_token: idToken, project_id: targetProjectId, name: name.trim() }),
        })
      }
      if (sessionRef.current !== session) return false
      revisionRef.current = data.revision
      revisionProjectRef.current = data.project_id || data.draft?.projectId || targetProjectId
      setCloudDraft(data.draft)
      setProjectId(data.project_id)
      setCloudProjects((projects) => [{
        project_id: data.project_id,
        name: data.draft.projectName,
        revision: data.revision,
        saved_at: data.saved_at,
        file_id: data.draft.fileId || '',
      }, ...projects])
      onMessage('Project duplicated')
      return true
    } catch (error) {
      if (sessionRef.current !== session) return false
      onMessage(error.message || 'Project could not be duplicated')
      return false
    }
  }, [activeWorkspaceId, cloudDraft, currentUser, getAuthToken, onMessage, setProjectId])

  return {
    cloudDraft, cloudProjects, cloudReady, saveCloudDraft, selectCloudProject,
    deleteCloudProject, renameCloudProject, duplicateCloudProject,
    workspaces, activeWorkspaceId, switchProjectScope,
  }
}
