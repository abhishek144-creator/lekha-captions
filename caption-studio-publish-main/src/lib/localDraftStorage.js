// Same-account browser copies of the editor draft. Reads are owner-checked so
// one account can never restore another account's work on a shared browser.
const LEGACY_DRAFT_KEY = 'captionEditorState'
const USER_DRAFT_PREFIX = 'lekha.captionDraft.'
const PENDING_DIRECT_UPLOAD_KEY = 'lekha.pendingDirectUpload.v1'

// Browsers cap localStorage at about 5 MB per origin.
export const MAX_LOCAL_DRAFT_CHARS = 5 * 1024 * 1024

export const localDraftKey = (uid, projectId = 'latest') => (
  `${USER_DRAFT_PREFIX}${String(uid || 'signed-out')}.${String(projectId || 'latest')}`
)

const defaultStorage = () => (typeof window === 'undefined' ? null : window.localStorage)

export function readLocalDraft(uid, storage = defaultStorage()) {
  if (!uid || !storage) return null
  const candidates = [
    storage.getItem(localDraftKey(uid)),
    storage.getItem(LEGACY_DRAFT_KEY),
  ]
  for (const serialized of candidates) {
    if (!serialized) continue
    try {
      const parsed = JSON.parse(serialized)
      if (parsed?.ownerUid === uid && (parsed.fileId || parsed.videoUrl || parsed.captions?.length)) return parsed
    } catch (error) {
      console.warn('Ignoring an unreadable local caption draft:', error)
    }
  }
  return null
}

// Returns 'saved', 'signed-out' or 'too-large'. Storage errors (quota,
// disabled storage) are thrown so callers can tell the customer.
export function writeLocalDraft(uid, draft, storage = defaultStorage()) {
  if (!uid) return 'signed-out'
  const serialized = JSON.stringify({ ...draft, ownerUid: uid })
  if (serialized.length >= MAX_LOCAL_DRAFT_CHARS) return 'too-large'
  storage.setItem(localDraftKey(uid), serialized)
  if (draft.projectId) storage.setItem(localDraftKey(uid, draft.projectId), serialized)
  // Retain one legacy copy during migration; reads remain owner-checked.
  storage.setItem(LEGACY_DRAFT_KEY, serialized)
  return 'saved'
}

// Removes the latest and per-project copies of one draft (not every project).
export function removeLocalDraft(uid, projectId, storage = defaultStorage()) {
  if (!uid || !storage) return
  storage.removeItem(localDraftKey(uid))
  if (projectId) storage.removeItem(localDraftKey(uid, projectId))
  const legacy = storage.getItem(LEGACY_DRAFT_KEY)
  if (!legacy) return
  try {
    if (JSON.parse(legacy)?.ownerUid === uid) storage.removeItem(LEGACY_DRAFT_KEY)
  } catch {
    storage.removeItem(LEGACY_DRAFT_KEY)
  }
}

export function downloadDraft(draft) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'lekha-caption-draft.json'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function clearUserLocalDrafts(uid) {
  if (typeof window === 'undefined' || !window.localStorage) return

  // A pending receipt includes the selected filename and must never carry over
  // to the next user on a shared browser session.
  window.localStorage.removeItem(PENDING_DIRECT_UPLOAD_KEY)

  const normalizedUid = String(uid || '').trim()
  if (normalizedUid) {
    const prefix = `${USER_DRAFT_PREFIX}${normalizedUid}.`
    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index)
      if (key?.startsWith(prefix)) window.localStorage.removeItem(key)
    }
  }

  const legacyDraft = window.localStorage.getItem(LEGACY_DRAFT_KEY)
  if (!legacyDraft) return
  try {
    const ownerUid = String(JSON.parse(legacyDraft)?.ownerUid || '').trim()
    if (!normalizedUid || !ownerUid || ownerUid === normalizedUid) {
      window.localStorage.removeItem(LEGACY_DRAFT_KEY)
    }
  } catch {
    // Corrupt recovery data has no safe ownership signal and should not survive
    // a privacy-sensitive logout or account-deletion flow.
    window.localStorage.removeItem(LEGACY_DRAFT_KEY)
  }
}
