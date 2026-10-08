import { describe, expect, it } from 'vitest'
import { getDailyLimitMessage, getPlanLimitErrorKind } from '../exportPlanLimits'

// Backend detail strings from _evaluate_export_policy and the export routes.
const dailyLimit = 'Limit reached: You can only export 3 videos per 24 hours.'

describe('getPlanLimitErrorKind', () => {
  it('recognises the rolling daily export quota', () => {
    expect(getPlanLimitErrorKind(dailyLimit)).toBe('daily-limit')
    expect(getPlanLimitErrorKind({ status: 429, data: { detail: dailyLimit } })).toBe('daily-limit')
  })

  it('recognises expired plans and exhausted credits', () => {
    expect(getPlanLimitErrorKind({ data: { detail: 'PLAN_EXPIRED: renew subscription' } })).toBe('expired')
    expect(getPlanLimitErrorKind(new Error('UPGRADE_REQUIRED: You have no credits remaining.'))).toBe('upgrade')
  })

  it('leaves real failures and other rate limits as failures', () => {
    expect(getPlanLimitErrorKind({ status: 429, data: { detail: 'Another export is already running for this account. Please wait.' } })).toBeNull()
    expect(getPlanLimitErrorKind({ status: 429, data: { detail: 'Too many failed export attempts. Please retry after a short wait.' } })).toBeNull()
    expect(getPlanLimitErrorKind(new Error('Render worker crashed'))).toBeNull()
  })
})

describe('getDailyLimitMessage', () => {
  it('returns the customer-facing sentence without the prefix', () => {
    expect(getDailyLimitMessage({ data: { detail: dailyLimit } })).toBe('You can only export 3 videos per 24 hours.')
  })
})
