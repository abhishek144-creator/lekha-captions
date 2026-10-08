import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { detectBillingCurrency, formatBillingPrice, getPreferredBillingCurrency, saveBillingCurrency } from '../../../shared/billingCurrency'

beforeEach(() => window.localStorage.clear())
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
