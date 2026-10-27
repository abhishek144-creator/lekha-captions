import { afterEach, describe, expect, it, vi } from 'vitest'
import { getAnalyticsConsent, onAnalyticsConsentChange, reopenAnalyticsConsent, setAnalyticsConsent } from '@/lib/analyticsConsent'

describe('analytics consent', () => {
  afterEach(() => {
    window.localStorage.clear()
    document.cookie.split(';').forEach((cookie) => {
      document.cookie = `${cookie.split('=')[0].trim()}=; Max-Age=0; path=/`
    })
  })

  it('has no choice until the visitor picks one', () => {
    expect(getAnalyticsConsent()).toBe('')
  })

  it('remembers acceptance and tells listeners', () => {
    const listener = vi.fn()
    const stop = onAnalyticsConsentChange(listener)
    setAnalyticsConsent('granted')
    stop()
    expect(getAnalyticsConsent()).toBe('granted')
    expect(listener).toHaveBeenCalledWith('granted')
  })

  it('rejection removes Google Analytics cookies but keeps others', () => {
    document.cookie = '_ga=GA1.1.123; path=/'
    document.cookie = '_ga_ABC=GS1.1.456; path=/'
    document.cookie = 'keep=1; path=/'
    setAnalyticsConsent('denied')
    expect(getAnalyticsConsent()).toBe('denied')
    expect(document.cookie).not.toContain('_ga')
    expect(document.cookie).toContain('keep=1')
  })

  it('cookie settings clears the choice so the banner asks again', () => {
    setAnalyticsConsent('denied')
    reopenAnalyticsConsent()
    expect(getAnalyticsConsent()).toBe('')
  })

  it('ignores unknown values', () => {
    setAnalyticsConsent('maybe')
    expect(getAnalyticsConsent()).toBe('')
  })
})
