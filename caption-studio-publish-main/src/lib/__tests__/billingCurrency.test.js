import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  currencyForCountry,
  detectBillingCurrency,
  detectVisitorBillingCurrency,
  followVisitorBillingCurrency,
  formatBillingPrice,
  getPreferredBillingCurrency,
  onBillingCurrencySaved,
  resetVisitorBillingCurrencyForTests,
  saveBillingCurrency,
} from '../../../shared/billingCurrency'
import visitorCountry from '../../../netlify/edge-functions/visitor-country'

beforeEach(() => {
  window.localStorage.clear()
  resetVisitorBillingCurrencyForTests()
})

const geoResponse = (body, contentType = 'application/json; charset=utf-8') => ({
  ok: true,
  headers: { get: () => contentType },
  json: async () => body,
})
afterEach(() => vi.restoreAllMocks())

describe('billing currency', () => {
  it.each(['Asia/Calcutta', 'Asia/Kolkata'])('offers INR for %s', zone => {
    expect(detectBillingCurrency(zone)).toBe('INR')
  })
  it.each(['America/New_York', 'Europe/London', 'Asia/Dhaka', undefined])('defaults to USD for %s', zone => {
    expect(detectBillingCurrency(zone)).toBe('USD')
  })
  it('preserves an explicit selection', () => {
    saveBillingCurrency('USD')
    expect(getPreferredBillingCurrency()).toBe('USD')
    saveBillingCurrency('INR')
    expect(getPreferredBillingCurrency()).toBe('INR')
  })
  it('tells listeners about a saved selection until they unsubscribe', () => {
    const listener = vi.fn()
    const unsubscribe = onBillingCurrencySaved(listener)
    saveBillingCurrency('INR')
    saveBillingCurrency('EUR')
    unsubscribe()
    saveBillingCurrency('USD')
    expect(listener.mock.calls).toEqual([['INR']])
  })
  it('ignores unsupported currencies', () => {
    saveBillingCurrency('USD')
    saveBillingCurrency('EUR')
    expect(getPreferredBillingCurrency()).toBe('USD')
  })
  it('defaults globally when region detection fails', () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => { throw new Error('Unavailable') })
    expect(getPreferredBillingCurrency()).toBe('USD')
  })
  it('formats configured cents and paise without an exchange-rate guess', () => {
    expect(formatBillingPrice(399, 'USD')).toBe('$3.99')
    expect(formatBillingPrice(3999, 'USD')).toBe('$39.99')
    expect(formatBillingPrice(29900, 'INR')).toBe('₹299')
  })
})
describe('visitor country currency', () => {
  it.each([['IN', 'INR'], ['in', 'INR'], ['US', 'USD'], ['GB', 'USD'], ['AE', 'USD'], ['', null], ['XX1', null], [undefined, null]])('maps %s to %s', (country, currency) => {
    expect(currencyForCountry(country)).toBe(currency)
  })
  it('uses the IP country even when the device timezone is India', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(geoResponse({ country: 'US' }))
    expect(await detectVisitorBillingCurrency()).toBe('USD')
    expect(fetch).toHaveBeenCalledWith('/__geo', expect.objectContaining({ cache: 'no-store' }))
  })
  it('asks the edge function once per page', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(geoResponse({ country: 'IN' }))
    expect(await detectVisitorBillingCurrency()).toBe('INR')
    expect(await detectVisitorBillingCurrency()).toBe('INR')
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  it('returns null when the endpoint serves the SPA shell instead of JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(geoResponse('<html>', 'text/html'))
    expect(await detectVisitorBillingCurrency()).toBeNull()
  })
  it('returns null when the request fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
    expect(await detectVisitorBillingCurrency()).toBeNull()
  })
  it('applies the detected currency when the visitor has not chosen one', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(geoResponse({ country: 'DE' }))
    const onCurrency = vi.fn()
    followVisitorBillingCurrency(onCurrency)
    await vi.waitFor(() => expect(onCurrency).toHaveBeenCalledWith('USD'))
  })
  it('never overrides a currency the visitor picked', async () => {
    saveBillingCurrency('INR')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(geoResponse({ country: 'US' }))
    const onCurrency = vi.fn()
    followVisitorBillingCurrency(onCurrency)
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(fetch).not.toHaveBeenCalled()
    expect(onCurrency).not.toHaveBeenCalled()
  })
  it('ignores a result that arrives after unmount', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(geoResponse({ country: 'US' }))
    const onCurrency = vi.fn()
    const stop = followVisitorBillingCurrency(onCurrency)
    stop()
    await detectVisitorBillingCurrency()
    expect(onCurrency).not.toHaveBeenCalled()
  })
})

describe('visitor-country edge function', () => {
  it('returns only the country code, uncached', async () => {
    const response = visitorCountry(new Request('https://lekhacaptions.com/__geo'), { geo: { country: { code: 'us', name: 'United States' }, city: 'Austin' } })
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(await response.json()).toEqual({ country: 'US' })
  })
  it('returns an empty country when Netlify has no geo data', async () => {
    const response = visitorCountry(new Request('https://lekhacaptions.com/__geo'), {})
    expect(await response.json()).toEqual({ country: '' })
  })
})
