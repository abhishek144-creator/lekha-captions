import { apiRequest } from '@/lib/apiClient'
import { getClientContext, trackAnalytics } from '@/lib/analytics'

const RETRY_DELAYS_MS = [1500, 4000, 8000, 12000]
const RETRYABLE_STATUSES = new Set([0, 408, 425, 499, 500, 502, 503, 504])
const activeProcesses = new Map()

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
  if (error?.name === 'AbortError') return false
  if (RETRYABLE_STATUSES.has(Number(error?.status || 0))) return true
  return Number(error?.status || 0) === 409
    && String(error?.data?.detail || error?.message || '').includes('PROCESS_IN_PROGRESS')
}

// Production acknowledges durable jobs with 202. Poll the same operation;
// an uncertain provider outcome is terminal and is never automatically replayed.
export async function processVideoWithRecovery(payload, {
  dedupeKey = 'process-video',
  retryDelaysMs = RETRY_DELAYS_MS,
  pollDelayMs = 3000,
} = {}) {
  const processReference = createProcessReference()
  activeProcesses.set(dedupeKey, processReference)
  const assertActive = () => {
    if (activeProcesses.get(dedupeKey) !== processReference) {
      const error = new Error('Transcription request replaced')
      error.name = 'AbortError'
      throw error
    }
  }
  let lastError = null

  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
    try {
      assertActive()
      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': processReference,
        },
        body: JSON.stringify({ ...payload, idempotency_key: processReference }),
        dedupeKey,
        cancelPrevious: true,
      }
      let data = await apiRequest('/api/process', options)
      const deadline = Date.now() + 40 * 60 * 1000
      while (data?.pending) {
        assertActive()
        if (Date.now() >= deadline) throw Object.assign(new Error('Transcription is still pending. Contact support with the job reference.'), { status: 409 })
        await sleep(pollDelayMs)
        assertActive()
        data = await apiRequest('/api/process', options)
      }
      assertActive()
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
