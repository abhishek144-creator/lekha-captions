import { useCallback, useEffect, useRef, useState } from 'react'
import { apiRequest } from '@/lib/apiClient'
import { getEffectiveAuthToken } from '@/lib/devAuth'

const EMPTY_PREFERENCES = { brandKits: [], glossaryTerms: [] }

const storageKey = (uid) => `lekha.editorPreferences.${String(uid || 'signed-out')}.v1`

function readLocalPreferences(uid) {
  if (typeof window === 'undefined') return EMPTY_PREFERENCES
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey(uid)) || '{}')
    let brandKits = Array.isArray(parsed.brandKits) ? parsed.brandKits.slice(0, 8) : []
    if (!brandKits.length && uid) {
      const legacy = JSON.parse(window.localStorage.getItem('captionStudio.brandKits.v1') || '[]')
      brandKits = Array.isArray(legacy) ? legacy.slice(0, 8) : []
    }
    return {
      brandKits,
      glossaryTerms: Array.isArray(parsed.glossaryTerms) ? parsed.glossaryTerms.slice(0, 100) : [],
    }
  } catch {
    return EMPTY_PREFERENCES
  }
}

function writeLocalPreferences(uid, preferences) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey(uid), JSON.stringify(preferences))
  } catch {
    // The cloud copy remains authoritative when browser storage is unavailable.
  }
}

export function useEditorPreferences(currentUser) {
  const [brandKits, setBrandKitsState] = useState([])
  const [glossaryTerms, setGlossaryTermsState] = useState([])
  const [syncStatus, setSyncStatus] = useState('loading')
  const preferencesRef = useRef(EMPTY_PREFERENCES)
  const userRef = useRef(currentUser)
  const loadGenerationRef = useRef(0)
  const saveQueueRef = useRef(Promise.resolve())
  const dirtyFieldsRef = useRef(new Set())
  const saveGenerationRef = useRef(0)

  useEffect(() => {
    userRef.current = currentUser
  }, [currentUser])

  const applyPreferences = useCallback((preferences, uid) => {
    const next = {
      brandKits: Array.isArray(preferences?.brandKits) ? preferences.brandKits.slice(0, 8) : [],
      glossaryTerms: Array.isArray(preferences?.glossaryTerms) ? preferences.glossaryTerms.slice(0, 100) : [],
    }
    preferencesRef.current = next
    setBrandKitsState(next.brandKits)
    setGlossaryTermsState(next.glossaryTerms)
    writeLocalPreferences(uid, next)
    return next
  }, [])

  const persistField = useCallback(async (field, value) => {
    const user = userRef.current
    const uid = user?.uid
    const next = { ...preferencesRef.current, [field]: value }
    dirtyFieldsRef.current.add(field)
    applyPreferences(next, uid)
    if (!user) {
      setSyncStatus('local')
      return
    }
    setSyncStatus('saving')
    const generation = ++saveGenerationRef.current
    saveQueueRef.current = saveQueueRef.current.catch(() => {}).then(async () => {
      try {
        const idToken = await getEffectiveAuthToken(user)
        await apiRequest('/api/editor-preferences/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id_token: idToken,
            ...(field === 'brandKits' ? { brand_kits: value } : { glossary_terms: value }),
          }),
        })
        if (generation === saveGenerationRef.current) setSyncStatus('synced')
      } catch (error) {
        console.warn('Editor preferences remain saved in this browser:', error)
        if (generation === saveGenerationRef.current) setSyncStatus('local')
      }
    })
    return saveQueueRef.current
  }, [applyPreferences])

  const setBrandKits = useCallback((valueOrUpdater) => {
    const current = preferencesRef.current.brandKits
    const next = typeof valueOrUpdater === 'function' ? valueOrUpdater(current) : valueOrUpdater
    return persistField('brandKits', Array.isArray(next) ? next.slice(0, 8) : [])
  }, [persistField])

  const setGlossaryTerms = useCallback((valueOrUpdater) => {
    const current = preferencesRef.current.glossaryTerms
    const next = typeof valueOrUpdater === 'function' ? valueOrUpdater(current) : valueOrUpdater
    return persistField('glossaryTerms', Array.isArray(next) ? next.slice(0, 100) : [])
  }, [persistField])

  useEffect(() => {
    const generation = ++loadGenerationRef.current
    saveGenerationRef.current += 1
    dirtyFieldsRef.current = new Set()
    const uid = currentUser?.uid
    const local = applyPreferences(readLocalPreferences(uid), uid)
    if (!currentUser) {
      setSyncStatus('local')
      return undefined
    }

    setSyncStatus('loading')
    Promise.resolve().then(async () => {
      const idToken = await getEffectiveAuthToken(currentUser)
      const result = await apiRequest('/api/editor-preferences/load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token: idToken }),
      })
      if (generation !== loadGenerationRef.current) return
      const remote = result.preferences || {}
      if (remote.exists) {
        const current = preferencesRef.current
        applyPreferences({
          brandKits: dirtyFieldsRef.current.has('brandKits') ? current.brandKits : remote.brand_kits,
          glossaryTerms: dirtyFieldsRef.current.has('glossaryTerms') ? current.glossaryTerms : remote.glossary_terms,
        }, uid)
      } else if (local.brandKits.length || local.glossaryTerms.length) {
        await apiRequest('/api/editor-preferences/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id_token: idToken,
            brand_kits: local.brandKits,
            glossary_terms: local.glossaryTerms,
          }),
        })
      }
      if (generation === loadGenerationRef.current) setSyncStatus('synced')
    }).catch((error) => {
      if (generation !== loadGenerationRef.current) return
      console.warn('Using browser editor preferences until cloud sync recovers:', error)
      setSyncStatus('local')
    })

    return () => {
      if (generation === loadGenerationRef.current) loadGenerationRef.current += 1
    }
  }, [applyPreferences, currentUser])

  return { brandKits, setBrandKits, glossaryTerms, setGlossaryTerms, syncStatus }
}
