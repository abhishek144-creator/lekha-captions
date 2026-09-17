import { useCallback, useEffect, useRef, useState } from 'react'

import { apiRequest } from '@/lib/apiClient'


export function useCloudProjects({ currentUser, getAuthToken, projectId, setProjectId, onMessage }) {
  const revisionRef = useRef(0)
  const saveChainRef = useRef(Promise.resolve())
  const [cloudDraft, setCloudDraft] = useState(null)
  const [cloudProjects, setCloudProjects] = useState([])
  const [cloudReady, setCloudReady] = useState(false)

  useEffect(() => {
    let disposed = false
    setCloudReady(false)
    setCloudDraft(null)
    revisionRef.current = 0
    if (currentUser) {
      getAuthToken(currentUser).then(async (idToken) => {
        const [draftData, projectData] = await Promise.all([
          apiRequest('/api/draft/load', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id_token: idToken }),
          }),
          apiRequest('/api/projects/list', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id_token: idToken }),
          }),
        ])
        return { draftData, projects: projectData.projects || [] }
      }).then(({ draftData, projects }) => {
        if (disposed) return
        revisionRef.current = draftData.revision
        setCloudDraft(draftData.draft)
        setCloudProjects(projects)
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
      const data = await apiRequest('/api/draft/save', {
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
  }, [cloudReady, currentUser, getAuthToken, onMessage, projectId, setProjectId])

  const selectCloudProject = useCallback(async (nextProjectId) => {
    if (!currentUser || !nextProjectId) return
    try {
      const idToken = await getAuthToken(currentUser)
      const data = await apiRequest('/api/draft/load', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token: idToken, project_id: nextProjectId }),
      })
      revisionRef.current = data.revision
      setCloudDraft(data.draft)
      setProjectId(nextProjectId)
      onMessage('Project ready to restore')
    } catch (error) {
      onMessage(error.message || 'Project could not be loaded')
    }
  }, [currentUser, getAuthToken, onMessage, setProjectId])

  const deleteCloudProject = useCallback(async (targetProjectId) => {
    if (!currentUser || !targetProjectId) return false
    try {
      const idToken = await getAuthToken(currentUser)
      await apiRequest('/api/projects/delete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token: idToken, project_id: targetProjectId }),
      })
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
  }, [cloudProjects, currentUser, getAuthToken, onMessage, selectCloudProject, setProjectId])

  return { cloudDraft, cloudProjects, cloudReady, saveCloudDraft, selectCloudProject, deleteCloudProject }
}
