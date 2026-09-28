const LEGACY_DRAFT_KEY = 'captionEditorState'
const USER_DRAFT_PREFIX = 'lekha.captionDraft.'
const PENDING_DIRECT_UPLOAD_KEY = 'lekha.pendingDirectUpload.v1'

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
