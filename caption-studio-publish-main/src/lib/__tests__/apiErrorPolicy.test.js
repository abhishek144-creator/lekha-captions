import { describe, expect, it } from 'vitest'
import { isSourceExpiredError, shouldDispatchAuthLogout } from '@/lib/apiErrorPolicy'

describe('isSourceExpiredError', () => {
  it('recognises the server refusing an expired source', () => {
    expect(isSourceExpiredError({ status: 410, message: 'gone' })).toBe(true)
    expect(isSourceExpiredError({ status: 0, message: 'SOURCE_EXPIRED: The source video has expired.' })).toBe(true)
  })

  it('leaves other failures to the normal export error path', () => {
    expect(isSourceExpiredError({ status: 404, message: 'Video not found' })).toBe(false)
    expect(isSourceExpiredError(null)).toBe(false)
  })
})

describe('shouldDispatchAuthLogout', () => {
  it('only signs out on a real authentication failure', () => {
    expect(shouldDispatchAuthLogout(401, { detail: 'Token expired' })).toBe(true)
    expect(shouldDispatchAuthLogout(401, { detail: 'PLAN_EXPIRED: renew' })).toBe(false)
    expect(shouldDispatchAuthLogout(410, { detail: 'SOURCE_EXPIRED' })).toBe(false)
  })
})
