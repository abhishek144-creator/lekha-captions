import { useCallback, useEffect, useRef, useState } from 'react'

import { apiRequest } from '@/lib/apiClient'


export function useCloudProjects({ currentUser, getAuthToken, projectId, setProjectId, onMessage }) {
  const revisionRef = useRef(0)
  const saveChainRef = useRef(Promise.resolve())
  const [cloudDraft, setCloudDraft] = useState(null)
  const [cloudProjects, setCloudProjects] = useState([])
  const [cloudReady, setCloudReady] = useState(false)
  const [workspaces, setWorkspaces] = useState([])
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('')

  useEffect(() => {
    let disposed = false
    setCloudReady(false)
    setCloudDraft(null)
    revisionRef.current = 0
    if (currentUser) {
      getAuthToken(currentUser).then(async (idToken) => {
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
      }).then(({ draftData, projects, workspaces: availableWorkspaces }) => {
        if (disposed) return
        revisionRef.current = draftData.revision
        setCloudDraft(draftData.draft)
        setCloudProjects(projects)
        setWorkspaces(availableWorkspaces)
        setCloudReady(true)
      }).catch(() => {
        if (!disposed) onMessage('Cloud projects are unavailable. Local edits are still kept in this browser.')
      })
    }
    return () => { disposed = true }
  }, [currentUser, getAuthToken, onMessage])

  const saveCloudDraft = useCallback((draft) => {
    const save = async () => {
      if (!cloudReady || !currentUser) throw new Error('Cloud saving is unavailable. Your browser copy is still available.')
      const idToken = await getAuthToken(currentUser)
      const data = activeWorkspaceId
        ? await apiRequest(`/api/workspaces/${activeWorkspaceId}/projects`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
            body: JSON.stringify({
              project_id: draft.projectId || projectId || '', draft, expected_revision: revisionRef.current,
            }),
          })
        : await apiRequest('/api/draft/save', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id_token: idToken,
              project_id: draft.projectId || projectId || '',
              draft,
              expected_revision: revisionRef.current,
            }),
          })
      revisionRef.current = data.revision
      setCloudDraft(data.draft)
      setProjectId(data.project_id || data.draft?.projectId || projectId)
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
      onMessage('Saved to your account')
      return data
    }
    const pending = saveChainRef.current.catch(() => {}).then(save)
    saveChainRef.current = pending
    return pending
  }, [activeWorkspaceId, cloudReady, currentUser, getAuthToken, onMessage, projectId, setProjectId])

  const selectCloudProject = useCallback(async (nextProjectId) => {
    if (!currentUser || !nextProjectId) return
    try {
      const idToken = await getAuthToken(currentUser)
      const data = activeWorkspaceId
        ? await apiRequest(`/api/workspaces/${activeWorkspaceId}/projects/${encodeURIComponent(nextProjectId)}`, {
            headers: { Authorization: `Bearer ${idToken}` },
          })
        : await apiRequest('/api/draft/load', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_token: idToken, project_id: nextProjectId }),
          })
      revisionRef.current = data.revision
      setCloudDraft(data.raw_url ? { ...data.draft, _workspaceRawUrl: data.raw_url } : data.draft)
      setProjectId(nextProjectId)
      onMessage('Project ready to restore')
    } catch (error) {
      onMessage(error.message || 'Project could not be loaded')
    }
  }, [activeWorkspaceId, currentUser, getAuthToken, onMessage, setProjectId])

  const deleteCloudProject = useCallback(async (targetProjectId) => {
    if (!currentUser || !targetProjectId) return false
    try {
      const idToken = await getAuthToken(currentUser)
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
      const remaining = cloudProjects.filter((item) => item.project_id !== targetProjectId)
      setCloudProjects(remaining)
      revisionRef.current = 0
      if (remaining.length > 0) {
        await selectCloudProject(remaining[0].project_id)
      } else {
        setCloudDraft(null)
        setProjectId(null)
      }
      onMessage('Project deleted')
      return true
    } catch (error) {
      onMessage(error.message || 'Project could not be deleted')
      return false
    }
  }, [activeWorkspaceId, cloudProjects, currentUser, getAuthToken, onMessage, selectCloudProject, setProjectId])

  const switchProjectScope = useCallback(async (workspaceId = '') => {
    if (!currentUser) return
    try {
      const idToken = await getAuthToken(currentUser)
      setCloudReady(false)
      setActiveWorkspaceId(workspaceId)
      let projects = []
      let draftData = { revision: 0, draft: null }
      if (workspaceId) {
        const list = await apiRequest(`/api/workspaces/${workspaceId}/projects`, {
          headers: { Authorization: `Bearer ${idToken}` },
        })
        projects = list.projects || []
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
      revisionRef.current = draftData.revision || 0
      setCloudDraft(draftData.raw_url ? { ...draftData.draft, _workspaceRawUrl: draftData.raw_url } : draftData.draft)
      setCloudProjects(projects)
      setProjectId(draftData.project_id || draftData.draft?.projectId || null)
      setCloudReady(true)
      onMessage(workspaceId ? 'Workspace projects loaded' : 'Personal projects loaded')
    } catch (error) {
      setCloudReady(true)
      onMessage(error.message || 'Project workspace could not be loaded')
    }
  }, [currentUser, getAuthToken, onMessage, setProjectId])

  const renameCloudProject = useCallback(async (targetProjectId, name) => {
    if (!currentUser || !targetProjectId || !name?.trim()) return false
    try {
      const idToken = await getAuthToken(currentUser)
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
      revisionRef.current = data.revision
      setCloudDraft(data.draft)
      setCloudProjects((projects) => projects.map((item) => (
        item.project_id === targetProjectId ? { ...item, name: data.draft.projectName, revision: data.revision, saved_at: data.saved_at } : item
      )))
      onMessage('Project renamed')
      return true
    } catch (error) {
      onMessage(error.message || 'Project could not be renamed')
      return false
    }
  }, [activeWorkspaceId, cloudDraft, currentUser, getAuthToken, onMessage])

  const duplicateCloudProject = useCallback(async (targetProjectId, name = '') => {
    if (!currentUser || !targetProjectId) return false
    try {
      const idToken = await getAuthToken(currentUser)
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
      revisionRef.current = data.revision
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
