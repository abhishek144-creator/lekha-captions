import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from '../AuthContext'

const firebase = vi.hoisted(() => ({
  auth: { currentUser: null },
  getRedirectResult: null,
  onAuthStateChanged: null,
  signInAnonymously: null,
  signOut: null,
}))
const { loadFirebase } = vi.hoisted(() => ({ loadFirebase: vi.fn() }))
vi.mock('../../lib/firebaseLoader', () => ({ loadFirebase }))
vi.mock('../../lib/apiClient', () => ({ apiRequest: vi.fn() }))
vi.mock('@/components/ui/use-toast', () => ({ toast: vi.fn() }))

function Probe() {
  const { isLoadingAuth, logout } = useAuth()
  return <button type="button" onClick={logout}>{isLoadingAuth ? 'loading' : 'ready'}</button>
}

let idleCallback
beforeEach(() => {
  idleCallback = null
  firebase.getRedirectResult = vi.fn(async () => null)
  firebase.onAuthStateChanged = vi.fn((_auth, onChange) => {
    onChange(null)
    return vi.fn()
  })
  firebase.signInAnonymously = vi.fn()
  firebase.signOut = vi.fn(async () => {})
  loadFirebase.mockReset()
  loadFirebase.mockResolvedValue(firebase)
  window.requestIdleCallback = vi.fn((callback) => {
    idleCallback = callback
    return 7
  })
  window.cancelIdleCallback = vi.fn()
})
afterEach(() => {
  cleanup()
  delete window.requestIdleCallback
  delete window.cancelIdleCallback
  window.history.pushState({}, '', '/')
})

describe('Firebase loading', () => {
  it('loads Firebase at once on app routes such as login', async () => {
    window.history.pushState({}, '', '/login')
    render(<AuthProvider><Probe /></AuthProvider>)
    expect(loadFirebase).toHaveBeenCalledTimes(1)
    expect(window.requestIdleCallback).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.getByRole('button').textContent).toBe('ready'))
    expect(firebase.onAuthStateChanged).toHaveBeenCalledWith(firebase.auth, expect.any(Function))
  })

  it('waits for an idle browser on marketing pages', async () => {
    window.history.pushState({}, '', '/')
    render(<AuthProvider><Probe /></AuthProvider>)
    expect(loadFirebase).not.toHaveBeenCalled()
    expect(screen.getByRole('button').textContent).toBe('loading')
    await act(async () => idleCallback())
    expect(loadFirebase).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.getByRole('button').textContent).toBe('ready'))
  })

  it('cancels a pending idle load and unsubscribes on unmount', async () => {
    window.history.pushState({}, '', '/faq')
    const { unmount } = render(<AuthProvider><Probe /></AuthProvider>)
    unmount()
    expect(window.cancelIdleCallback).toHaveBeenCalledWith(7)
    expect(loadFirebase).not.toHaveBeenCalled()
  })

  it('reports a failed Firebase load instead of loading forever', async () => {
    window.history.pushState({}, '', '/Dashboard')
    loadFirebase.mockRejectedValueOnce(new Error('chunk failed'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<AuthProvider><Probe /></AuthProvider>)
    await waitFor(() => expect(screen.getByRole('button').textContent).toBe('ready'))
  })

  it('signs out through the loaded module', async () => {
    window.history.pushState({}, '', '/login')
    render(<AuthProvider><Probe /></AuthProvider>)
    await waitFor(() => expect(screen.getByRole('button').textContent).toBe('ready'))
    await act(async () => fireEvent.click(screen.getByRole('button')))
    expect(firebase.signOut).toHaveBeenCalledWith(firebase.auth)
  })
})
