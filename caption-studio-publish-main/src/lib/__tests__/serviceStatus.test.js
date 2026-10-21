import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkServiceStatus, statusProbes } from '../serviceStatus'

afterEach(() => vi.unstubAllGlobals())
const response = (body, status = 200) => ({ ok: status === 200, status, json: async () => body })
const check = (index = 0) => checkServiceStatus(statusProbes[index], { base: 'https://api.example.invalid' })

describe('public service checks', () => {
  it('keeps API availability healthy when only processing is unready', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response({ success: true })).mockResolvedValueOnce(response({ success: true, ready: false })))
    expect((await check()).state).toBe('operational')
    expect((await check(1)).state).toBe('degraded')
  })
  it.each([401, 403, 429])('reports HTTP %s as unverified, not a proven outage', async status => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({}, status)))
    expect(await check()).toMatchObject({ state: 'unverified', detail: `Health check returned HTTP ${status}.` })
  })
  it('reports a server failure without hiding the HTTP status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({}, 503)))
    expect(await check()).toMatchObject({ state: 'degraded', detail: 'Health check returned HTTP 503.' })
  })
  it('does not claim downtime from a browser/network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    expect((await check()).state).toBe('unverified')
  })
  it.each([{}, { success: true }])('rejects incomplete readiness response %j', async body => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(body)))
    expect((await check(1)).state).toBe('unverified')
  })
  it('requires actual service controls before reporting them operational', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ success: true })))
    expect((await check(2)).state).toBe('unverified')
  })
  it('reports a paused operation as limited availability', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ success: true, controls: { pause_exports: true } })))
    expect((await check(2)).state).toBe('degraded')
  })
})
