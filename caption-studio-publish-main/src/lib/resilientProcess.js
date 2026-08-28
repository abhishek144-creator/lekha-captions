import { apiRequest } from '@/lib/apiClient'
import { getClientContext, trackAnalytics } from '@/lib/analytics'

const RETRY_DELAYS_MS = [1500, 4000, 8000, 12000]
const RETRYABLE_STATUSES = new Set([0, 408, 425, 499, 500, 502, 503, 504])

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function createProcessReference() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `process-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function isRetryableProcessError(error) {
  if (RETRYABLE_STATUSES.has(Number(error?.status || 0))) return true
  return Number(error?.status || 0) === 409
    && String(error?.data?.detail || error?.message || '').includes('PROCESS_IN_PROGRESS')
}

// The backend stores a receipt for this key. If the browser loses a response,
// every retry either reconnects to the running transcription or replays the
// completed captions; it never starts a second provider call.
export async function processVideoWithRecovery(payload, {
  dedupeKey = 'process-video',
  retryDelaysMs = RETRY_DELAYS_MS,
} = {}) {
  const processReference = createProcessReference()
  let lastError = null

  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
    try {
      const data = await apiRequest('/api/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': processReference,
        },
        body: JSON.stringify({ ...payload, idempotency_key: processReference }),
        dedupeKey,
        cancelPrevious: true,
      })
      trackAnalytics('funnel.process.transport_success', getClientContext({
        stage: 'process',
        attempt: attempt + 1,
        processReference,
        idempotentReplay: Boolean(data?.idempotent_replay),
      }))
      return data
    } catch (error) {
      lastError = error
      const retryable = isRetryableProcessError(error)
      trackAnalytics('funnel.process.transport_failed', getClientContext({
        stage: 'process',
        attempt: attempt + 1,
        status: Number(error?.status || 0),
        retryable,
        processReference,
      }))
      if (!retryable || attempt >= retryDelaysMs.length) throw error
      await sleep(retryDelaysMs[attempt])
    }
  }

  throw lastError || new Error('Transcription failed')
}

export const processRecoveryPolicy = Object.freeze({
  retryDelaysMs: [...RETRY_DELAYS_MS],
  retryableStatuses: [...RETRYABLE_STATUSES],
})
