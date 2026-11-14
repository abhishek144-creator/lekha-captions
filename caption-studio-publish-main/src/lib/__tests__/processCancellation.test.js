import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/apiClient', () => ({ apiRequest: vi.fn() }))
vi.mock('@/lib/analytics', () => ({ getClientContext: value => value, trackAnalytics: vi.fn() }))
import { apiRequest } from '../apiClient'
import { processVideoWithRecovery } from '../resilientProcess'

describe('transcription cancellation', () => {
  afterEach(() => { vi.useRealTimers(); vi.resetAllMocks() })
  it.each(['retry', 'pending'])('cancels the %s wait without issuing another provider request', async (mode) => {
    vi.useFakeTimers()
    if (mode === 'retry') apiRequest.mockRejectedValue(Object.assign(new Error('temporary outage'), { status: 503 }))
    else apiRequest.mockResolvedValue({ pending: true })
    const controller = new AbortController()
    const pending = processVideoWithRecovery({ file_id: 'isolated-fixture' }, {
      signal: controller.signal, retryDelaysMs: [10000], pollDelayMs: 10000,
    })
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    await vi.waitFor(() => expect(apiRequest).toHaveBeenCalledOnce())
    controller.abort()
    await rejected
    await vi.advanceTimersByTimeAsync(20000)
    expect(apiRequest).toHaveBeenCalledOnce()
    expect(apiRequest.mock.calls[0][1].signal).toBe(controller.signal)
  })
})
