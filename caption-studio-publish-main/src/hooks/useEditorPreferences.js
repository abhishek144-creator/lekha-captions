import { useCallback, useEffect, useRef, useState } from 'react'
import { apiRequest } from '@/lib/apiClient'
import { getEffectiveAuthToken } from '@/lib/devAuth'

const empty = () => ({ brandKits: [], glossaryTerms: [], revision: 0, dirty: false })
const storageKey = (uid) => `lekha.editorPreferences.${String(uid || 'signed-out')}.v1`
function read(uid) {
  try {
    const cached = { ...empty(), ...JSON.parse(localStorage.getItem(storageKey(uid)) || '{}') }
    return { ...cached, brandKits: Array.isArray(cached.brandKits) ? cached.brandKits.slice(0, 8) : [], glossaryTerms: Array.isArray(cached.glossaryTerms) ? cached.glossaryTerms.slice(0, 100) : [] }
  }
  catch { return empty() }
}

export function useEditorPreferences(currentUser) {
  const [preferences, setPreferences] = useState(empty)
  const [syncStatus, setSyncStatus] = useState('loading')
  const [reload, setReload] = useState(0)
  const storageAvailable = useRef(true)
  const state = useRef(empty())
  const user = useRef(currentUser)
  user.current = currentUser
  const generation = useRef(0)
  const ready = useRef(false)
  const chain = useRef(Promise.resolve())

  const apply = useCallback((value, uid) => {
    state.current = value
    setPreferences(value)
    try { localStorage.setItem(storageKey(uid), JSON.stringify(value)); storageAvailable.current = true }
    catch { storageAvailable.current = false; setSyncStatus('storage-full') }
  }, [])

  const save = useCallback(() => {
    const account = user.current
    const epoch = generation.current
    if (!account || !ready.current) return Promise.resolve()
    chain.current = chain.current.catch(() => {}).then(async () => {
      if (epoch !== generation.current || !ready.current || !state.current.dirty) return
      const snapshot = state.current
      setSyncStatus('saving')
      try {
        const idToken = await getEffectiveAuthToken(account)
        if (epoch !== generation.current) return
        const result = await apiRequest('/api/editor-preferences/save', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_token: idToken, expected_revision: snapshot.revision, brand_kits: snapshot.brandKits, glossary_terms: snapshot.glossaryTerms }),
        })
        if (epoch !== generation.current) return
        const stillCurrent = state.current === snapshot
        apply({ ...state.current, revision: result.preferences.revision, dirty: !stillCurrent }, account.uid)
        setSyncStatus(stillCurrent ? 'synced' : 'saving')
        // An edit made while this request was in flight has a newer payload.
        // Queue it after the successful revision update, even if no further UI
        // action occurs to trigger another save.
        if (!stillCurrent) queueMicrotask(() => {
          if (epoch === generation.current && state.current.dirty) void save()
        })
      } catch (error) {
        if (epoch !== generation.current) return
        if (error.status === 409) ready.current = false
        setSyncStatus(error.status === 409 ? 'conflict' : 'local')
      }
    })
    return chain.current
  }, [apply])

  const change = useCallback((field, update) => {
    const value = typeof update === 'function' ? update(state.current[field]) : update
    apply({ ...state.current, [field]: (Array.isArray(value) ? value : []).slice(0, field === 'brandKits' ? 8 : 100), dirty: true }, user.current?.uid)
    if (ready.current) return save()
  }, [apply, save])
  const setBrandKits = useCallback((value) => change('brandKits', value), [change])
  const setGlossaryTerms = useCallback((value) => change('glossaryTerms', value), [change])

  useEffect(() => {
    const epoch = ++generation.current
    const uid = currentUser?.uid
    ready.current = false
    const local = read(uid)
    apply(local, uid)
    if (!currentUser) { setSyncStatus('local'); return undefined }
    setSyncStatus('loading')
    Promise.resolve().then(async () => {
      const idToken = await getEffectiveAuthToken(currentUser)
      const result = await apiRequest('/api/editor-preferences/load', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id_token: idToken }),
      })
      if (epoch !== generation.current) return
      const remote = result.preferences || {}
      const revision = Number(remote.revision || 0)
      if (state.current.dirty && state.current.revision !== revision) {
        setSyncStatus('conflict')
        return
      }
      if (!state.current.dirty) apply({ brandKits: remote.brand_kits || [], glossaryTerms: remote.glossary_terms || [], revision, dirty: false }, uid)
      ready.current = true
      if (state.current.dirty) await save()
      else setSyncStatus('synced')
    }).catch(() => { if (epoch === generation.current) setSyncStatus('local') })
    return () => { generation.current += 1; ready.current = false }
  }, [currentUser, reload, apply, save])

  const reloadCloudPreferences = useCallback(() => {
    if (!window.confirm('Replace browser kits and glossary with the cloud copy? Export your browser kits first if you want to keep them.')) return
    apply(empty(), user.current?.uid)
    setReload((value) => value + 1)
  }, [apply])
  const retryPreferenceSync = useCallback(() => setReload((value) => value + 1), [])
  return { ...preferences, setBrandKits, setGlossaryTerms, syncStatus: !storageAvailable.current && syncStatus !== 'synced' ? 'storage-full' : syncStatus, reloadCloudPreferences, retryPreferenceSync }
}
