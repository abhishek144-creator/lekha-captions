import { useCallback, useEffect, useRef, useState } from 'react'
import { useCloudProjects } from '@/hooks/useCloudProjects'
import { getEffectiveAuthToken } from '@/lib/devAuth'
import { apiRequest } from '@/lib/apiClient'
import { resolveApiResourceUrl } from '@/components/dashboard/exportPipelineUtils'
import { draftAutosaveSignature } from '@/lib/draftAutosave'
import { restoreEditorDocument } from '@/lib/editorDocument'
import { readLocalDraft, removeLocalDraft, writeLocalDraft } from '@/lib/localDraftStorage'

const NOTICE_DISMISS_MS = 5000
const CLOUD_AUTOSAVE_DELAY_MS = 2500
// Each cloud save is a database write against a fixed daily quota. Save the
// latest document at most once per interval; the browser copy keeps every
// change in between.
export const CLOUD_AUTOSAVE_MIN_INTERVAL_MS = 10000
const LOCAL_AUTOSAVE_DELAY_MS = 500

const LOCAL_SAVE_MESSAGES = {
  'too-large': 'This draft is too large for browser recovery. Download it now and confirm cloud save before closing the tab.',
  failed: 'Browser recovery storage is full or unavailable. Download this draft and confirm cloud save before closing the tab.',
  unreadable: 'Browser recovery storage is unavailable. Save to your account or download the draft before closing.',
}

// Keeps the editor draft safe: a same-account browser copy on every change,
// debounced cloud autosave, recovery after a reload, and conflict handling
// when another tab or device saved a newer revision.
//
// `doc` comes from useEditorDocument. `onEditorReset` clears editor UI that
// the page owns (selection, playback, undo history, open modals) whenever the
// document is emptied for a new session or account.
export function useDraftPersistence({
  currentUser,
  isLoadingAuth,
  restoreRequested,
  doc,
  isLoaded,
  setIsLoaded,
  setSourceUnavailable,
  onEditorReset,
  // True while a new upload is transcribed: the document is between projects
  // (new video, captions not yet generated), so nothing is written until the
  // captions arrive.
  pauseAutosave = false,
}) {
  const [cloudSaveMessage, setCloudSaveMessage] = useState('')
  const [cloudSaveConflict, setCloudSaveConflict] = useState(false)
  const [showCloudSaveConflictNotice, setShowCloudSaveConflictNotice] = useState(false)
  const [localRecoveryDraft, setLocalRecoveryDraft] = useState(null)
  const cloudAutosaveRef = useRef(null)
  const lastCloudSaveAtRef = useRef(0)
  const [cloudSaveRetry, setCloudSaveRetry] = useState(0)
  const recoveryInitializedRef = useRef(false)
  const loadedAccountRef = useRef(null)
  const onEditorResetRef = useRef(onEditorReset)
  useEffect(() => { onEditorResetRef.current = onEditorReset })

  const { cloudReady, cloudDraft, saveCloudDraft } = useCloudProjects({
    currentUser,
    getAuthToken: getEffectiveAuthToken,
    projectId: doc.projectId,
    setProjectId: doc.setProjectId,
    onMessage: setCloudSaveMessage,
  })

  // A 409 means another tab or device saved a newer revision. Every later save
  // from this tab would be rejected too. Keep saving paused independently of
  // the five-second notice so dismissing it cannot overwrite newer work.
  const notifyCloudSaveError = useCallback((error) => {
    if (error?.status === 409) {
      setCloudSaveMessage('')
      setCloudSaveConflict(true)
      setShowCloudSaveConflictNotice(true)
      return
    }
    setCloudSaveMessage(error?.message || 'Cloud save failed. Your browser copy is still available.')
  }, [])

  useEffect(() => {
    if (!cloudSaveMessage) return undefined
    const timer = window.setTimeout(() => setCloudSaveMessage(''), NOTICE_DISMISS_MS)
    return () => window.clearTimeout(timer)
  }, [cloudSaveMessage])

  useEffect(() => {
    if (!showCloudSaveConflictNotice) return undefined
    const timer = window.setTimeout(() => setShowCloudSaveConflictNotice(false), NOTICE_DISMISS_MS)
    return () => window.clearTimeout(timer)
  }, [showCloudSaveConflictNotice])

  // Clearing the conflict (new upload, account change) also hides its notice.
  useEffect(() => {
    if (!cloudSaveConflict) setShowCloudSaveConflictNotice(false)
  }, [cloudSaveConflict])

  const { fileId, snapshotEditorState } = doc
  useEffect(() => {
    if (!isLoaded || !fileId || !cloudReady || cloudSaveConflict || pauseAutosave) return
    const draft = snapshotEditorState()
    const signature = draftAutosaveSignature(draft)
    const context = `${currentUser?.uid || ''}:${fileId}`
    if (cloudAutosaveRef.current?.context === context && cloudAutosaveRef.current.signature === signature) return
    const sinceLastSave = Date.now() - lastCloudSaveAtRef.current
    const delay = Math.max(CLOUD_AUTOSAVE_DELAY_MS, CLOUD_AUTOSAVE_MIN_INTERVAL_MS - sinceLastSave)
    const timer = setTimeout(() => {
      lastCloudSaveAtRef.current = Date.now()
      saveCloudDraft(draft).then(() => {
        cloudAutosaveRef.current = { context, signature }
      }).catch((error) => {
        // The server throttles bursts of saves: try again quietly.
        if (error?.status === 429) {
          window.setTimeout(() => setCloudSaveRetry((count) => count + 1), CLOUD_AUTOSAVE_MIN_INTERVAL_MS)
          return
        }
        notifyCloudSaveError(error)
      })
    }, delay)
    return () => clearTimeout(timer)
  }, [isLoaded, fileId, cloudReady, cloudSaveConflict, pauseAutosave, currentUser?.uid, snapshotEditorState, saveCloudDraft, notifyCloudSaveError, cloudSaveRetry])

  const { applyDocument, resetDocument, resetPointRef } = doc
  const applyLocalDraft = useCallback((parsed) => {
    if (!parsed || parsed.ownerUid !== currentUser?.uid) return false
    const restored = restoreEditorDocument(parsed)
    applyDocument(restored)
    setSourceUnavailable(!restored.videoUrl)
    resetPointRef.current = JSON.parse(JSON.stringify(restored))
    // Restoring is a read: only subsequent content edits should write a revision.
    cloudAutosaveRef.current = {
      context: `${currentUser.uid}:${parsed.fileId}`,
      signature: draftAutosaveSignature(restored),
    }
    setLocalRecoveryDraft(null)
    return true
  }, [applyDocument, currentUser?.uid, resetPointRef, setSourceUnavailable])

  const discardLocalDraft = useCallback(() => {
    if (!currentUser?.uid || !localRecoveryDraft) return
    removeLocalDraft(currentUser.uid, localRecoveryDraft.projectId)
    setLocalRecoveryDraft(null)
  }, [currentUser?.uid, localRecoveryDraft])

  const continueAccountDraft = useCallback(async () => {
    const uid = currentUser?.uid
    if (!uid || !cloudDraft) return false
    const draft = { ...cloudDraft, ownerUid: uid }
    // Account storage intentionally strips bearer URLs. Obtain a fresh,
    // owner-authorized source URL rather than requiring another upload.
    let rawUrl = draft._workspaceRawUrl || ''
    if (!rawUrl && draft.fileId) {
      try {
        const idToken = await getEffectiveAuthToken(currentUser)
        const media = await apiRequest('/api/media/upload-url', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file_id: draft.fileId, id_token: idToken }),
        })
        if (media.success) rawUrl = media.raw_url
      } catch {
        // Missing/expired media still restores editable captions and relink UI.
      }
    }
    if (loadedAccountRef.current !== uid) return false
    draft.videoUrl = resolveApiResourceUrl(rawUrl, import.meta.env.VITE_API_BASE_URL) || ''
    return applyLocalDraft(draft)
  }, [applyLocalDraft, cloudDraft, currentUser])

  // A new account never inherits the previous account's editor or draft.
  useEffect(() => {
    if (isLoadingAuth) return
    const uid = currentUser?.uid || ''
    if (loadedAccountRef.current === uid) return
    loadedAccountRef.current = uid
    // DEV-ONLY: the ?devseed session has no account; don't wipe it on auth load.
    if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('devseed')) return
    recoveryInitializedRef.current = false
    setIsLoaded(false)
    setLocalRecoveryDraft(null)
    setCloudSaveConflict(false)
    resetDocument()
    setSourceUnavailable(false)
    cloudAutosaveRef.current = null
    onEditorResetRef.current?.()
  }, [currentUser?.uid, isLoadingAuth, resetDocument, setIsLoaded, setSourceUnavailable])

  // Keep a same-account recovery copy until the customer explicitly continues
  // or discards it. Normal dashboard entry must never erase unsynced work.
  useEffect(() => {
    if (isLoadingAuth || recoveryInitializedRef.current) return
    recoveryInitializedRef.current = true
    const params = new URLSearchParams(window.location.search)
    // DEV-ONLY: let the ?devseed effect own the session; don't wipe it here.
    if (import.meta.env.DEV && params.has('devseed')) {
      setIsLoaded(true)
      return
    }
    const isNavigationRestore = restoreRequested || params.get('restoreSession') === '1'
    const isEditorEntry = params.get('entry') === 'editor'
    const shouldStartClean = Boolean(params.get('action') || params.get('session_reset') || isEditorEntry)
    let savedDraft = null
    try { savedDraft = readLocalDraft(currentUser?.uid) }
    catch { setCloudSaveMessage(LOCAL_SAVE_MESSAGES.unreadable) }

    if (savedDraft && isNavigationRestore && !shouldStartClean && applyLocalDraft(savedDraft)) {
      setIsLoaded(true)
      return
    }
    if (savedDraft) setLocalRecoveryDraft(savedDraft)
    resetDocument()
    onEditorResetRef.current?.()

    // Clean up URL parameters if they exist
    if (shouldStartClean) {
      window.history.replaceState({}, '', window.location.pathname)
    }
    setIsLoaded(true)
  }, [applyLocalDraft, currentUser?.uid, isLoadingAuth, resetDocument, restoreRequested, setIsLoaded])

  const {
    videoUrl, audioAnalysis, captions, captionTracks, activeCaptionTrackId, captionStyle,
    projectId, settings, duration, originalFileName,
  } = doc
  // Auto-save a browser copy whenever the document changes (debounced). Paused
  // while a recovery copy is waiting so it is never overwritten unseen.
  useEffect(() => {
    if (!isLoaded || localRecoveryDraft || pauseAutosave) return
    const timeoutId = setTimeout(() => {
      try {
        // Modal states are intentionally not saved so they don't reopen on reload.
        const result = writeLocalDraft(currentUser?.uid, {
          videoUrl, audioAnalysis, captions, captionTracks, activeCaptionTrackId, captionStyle,
          projectId, settings, duration, fileId, originalFileName,
          savedAt: Date.now(),
        })
        if (result === 'too-large') setCloudSaveMessage(LOCAL_SAVE_MESSAGES['too-large'])
      } catch (error) {
        console.warn('Failed to save state:', error)
        setCloudSaveMessage(LOCAL_SAVE_MESSAGES.failed)
      }
    }, LOCAL_AUTOSAVE_DELAY_MS)
    return () => clearTimeout(timeoutId)
  }, [videoUrl, audioAnalysis, captions, captionTracks, activeCaptionTrackId, captionStyle, projectId, settings, duration, fileId, originalFileName, currentUser?.uid, isLoaded, localRecoveryDraft, pauseAutosave])

  // Explicit Save: browser copy first, then the account. Throws nothing; a
  // failure is reported through the notices. Returns true when both saved.
  const saveNow = useCallback(async () => {
    try {
      const draft = snapshotEditorState()
      writeLocalDraft(currentUser?.uid, draft)
      await saveCloudDraft(draft)
      return true
    } catch (error) {
      console.error('Save failed:', error)
      notifyCloudSaveError(error)
      return false
    }
  }, [currentUser?.uid, notifyCloudSaveError, saveCloudDraft, snapshotEditorState])

  return {
    cloudReady,
    cloudDraft,
    cloudSaveMessage,
    setCloudSaveMessage,
    cloudSaveConflict,
    setCloudSaveConflict,
    showCloudSaveConflictNotice,
    localRecoveryDraft,
    applyLocalDraft,
    continueAccountDraft,
    discardLocalDraft,
    saveNow,
  }
}
