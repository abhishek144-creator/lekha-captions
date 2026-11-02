import { beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => {
  vi.resetModules()
  localStorage.clear()
  document.head.innerHTML = ''
  window.dataLayer = []
})

describe('Google Ads acquisition measurement', () => {
  it('loads nothing and reports nothing without advertising consent', async () => {
    const ads = await import('../googleAds')
    ads.initializeGoogleAds()
    expect(document.querySelector('script')).toBeNull()
    expect(ads.trackAdsConversion('signup', { transaction_id: 'new-account' })).toBe(false)
    expect(window.dataLayer).toHaveLength(0)
  })

  it('uses the actual purchase value and prevents repeated payment reporting', async () => {
    const ads = await import('../googleAds')
    ads.setAdsConsent('granted')
    const receipt = { transaction_id: 'payment-123', value: 299, currency: 'INR' }
    expect(ads.trackAdsConversion('purchase', receipt)).toBe(true)
    expect(ads.trackAdsConversion('purchase', receipt)).toBe(false)
    expect(Array.from(window.dataLayer.at(-1))).toEqual(['event', 'conversion', {
      send_to: 'AW-18501179190/-qZvCMv4y7AdELauhvZE', ...receipt,
    }])
  })

  it('rejects incomplete purchase data and stops reporting after withdrawal', async () => {
    const ads = await import('../googleAds')
    ads.setAdsConsent('granted')
    expect(ads.trackAdsConversion('purchase', { transaction_id: 'missing-amount' })).toBe(false)
    ads.setAdsConsent('denied')
    expect(ads.trackAdsConversion('signup', { transaction_id: 'new-account' })).toBe(false)
  })
})
