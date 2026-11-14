import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fixture = vi.hoisted(() => ({ auth: { currentUser: null }, appCheck: vi.fn() }))
vi.mock('@/lib/firebaseLoader', () => ({ loadFirebase: async () => ({ auth: fixture.auth, getFirebaseAppCheckToken: fixture.appCheck }) }))
vi.mock('@/lib/googleAds', () => ({ trackAdsConversion: vi.fn() }))
import { apiRequest } from '../apiClient'

const token = (uid) => `header.${btoa(JSON.stringify({ sub: uid }))}.signature`
const options = () => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id_token: token('alice'), draft: 'private fixture' }) })

describe('API authentication session boundaries', () => {
  beforeEach(() => {
    fixture.auth.currentUser = { uid: 'alice', getIdToken: vi.fn().mockResolvedValue(token('alice')) }
    fixture.appCheck.mockResolvedValue('test-app-check')
  })
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

  it.each([200, 401])('rejects a late HTTP %s after switching accounts without refreshing B or logging it out', async (status) => {
    let release
    const fetch = vi.fn(() => new Promise(resolve => { release = resolve }))
    vi.stubGlobal('fetch', fetch)
    const logout = vi.fn()
    window.addEventListener('auth:logout', logout)
    try {
      const pending = apiRequest('/api/draft/save', options())
      await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce())
      const bob = { uid: 'bob', getIdToken: vi.fn() }
      fixture.auth.currentUser = bob
      release(new Response(JSON.stringify({ detail: 'Invalid authentication token' }), { status }))
      await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
      expect(bob.getIdToken).not.toHaveBeenCalled()
      expect(fetch).toHaveBeenCalledOnce()
      expect(logout).not.toHaveBeenCalled()
    } finally { window.removeEventListener('auth:logout', logout) }
  })

  it('still refreshes expired authentication for the same account', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockResolvedValueOnce(new Response('{"success":true}', { status: 200 }))
    vi.stubGlobal('fetch', fetch)
    expect(await apiRequest('/api/draft/save', options())).toEqual({ success: true })
    expect(fixture.auth.currentUser.getIdToken).toHaveBeenCalledWith(true)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(JSON.parse(fetch.mock.calls[1][1].body).id_token).toBe(token('alice'))
  })

  it('rejects an old account token before sending under a new active account', async () => {
    fixture.auth.currentUser = { uid: 'bob', getIdToken: vi.fn() }
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    await expect(apiRequest('/api/draft/save', options())).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('does not replay private data when the account changes during token refresh', async () => {
    let release
    fixture.auth.currentUser.getIdToken.mockImplementation(() => new Promise(resolve => { release = resolve }))
    const fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 401 }))
    vi.stubGlobal('fetch', fetch)
    const pending = apiRequest('/api/draft/save', options())
    await vi.waitFor(() => expect(release).toBeTypeOf('function'))
    fixture.auth.currentUser = { uid: 'bob', getIdToken: vi.fn() }
    release(token('alice'))
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetch).toHaveBeenCalledOnce()
  })
})
