import { apiRequest } from '@/lib/apiClient'
import { getClientContext, trackAnalytics } from '@/lib/analytics'

const DEFAULT_RETRY_DELAYS_MS = [1500, 4000, 8000]
const RETRYABLE_UPLOAD_STATUSES = new Set([0, 408, 425, 499, 500, 502, 503, 504])

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function createUploadReference() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `upload-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function fileSizeBucket(size) {
  const megabytes = Math.max(0, Number(size || 0)) / (1024 * 1024)
  if (megabytes < 10) return '<10MB'
  if (megabytes < 50) return '10-50MB'
  if (megabytes < 150) return '50-150MB'
  if (megabytes < 300) return '150-300MB'
  return '300MB+'
}

function waitForConnection(maxWaitMs = 15000) {
  if (typeof window === 'undefined' || typeof navigator === 'undefined' || navigator.onLine !== false) {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    let timeoutId = null
    const finish = () => {
      window.removeEventListener('online', finish)
      if (timeoutId) window.clearTimeout(timeoutId)
      resolve()
    }
    window.addEventListener('online', finish, { once: true })
    timeoutId = window.setTimeout(finish, maxWaitMs)
  })
}

export function isRetryableUploadError(error) {
  return RETRYABLE_UPLOAD_STATUSES.has(Number(error?.status || 0))
}

export async function uploadFileWithRecovery(file, {
  authorization = '',
  dedupeKey = 'upload-video',
  retryDelaysMs = DEFAULT_RETRY_DELAYS_MS,
  onRetry = null,
} = {}) {
  const uploadReference = createUploadReference()
  const startedAt = Date.now()
  let lastError = null

  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
    await waitForConnection()
    const formData = new FormData()
    formData.append('file', file)
    const attemptStartedAt = Date.now()

    try {
      const data = await apiRequest('/api/upload', {
        method: 'POST',
        headers: {
          ...(authorization ? { Authorization: `Bearer ${authorization}` } : {}),
          'Idempotency-Key': uploadReference,
        },
        body: formData,
        dedupeKey,
        cancelPrevious: true,
      })
      if (!data?.success) throw new Error(data?.error || 'Upload failed')

      trackAnalytics('funnel.upload.transport_success', getClientContext({
        stage: 'upload',
        attempt: attempt + 1,
        elapsedMs: Date.now() - startedAt,
        fileSizeBucket: fileSizeBucket(file?.size),
        uploadReference,
      }))
      return data
    } catch (error) {
      lastError = error
      const retryable = isRetryableUploadError(error)
      trackAnalytics('funnel.upload.transport_failed', getClientContext({
        stage: 'upload',
        attempt: attempt + 1,
        attemptElapsedMs: Date.now() - attemptStartedAt,
        status: Number(error?.status || 0),
        requestReference: error?.requestId || '',
        uploadReference,
        retryable,
        fileSizeBucket: fileSizeBucket(file?.size),
      }))

      if (!retryable || attempt >= retryDelaysMs.length) throw error
      onRetry?.({ attempt: attempt + 1, nextAttempt: attempt + 2, error })
      await sleep(retryDelaysMs[attempt])
    }
  }

  throw lastError || new Error('Upload failed')
}

export const uploadRecoveryPolicy = Object.freeze({
  retryDelaysMs: [...DEFAULT_RETRY_DELAYS_MS],
  retryableStatuses: [...RETRYABLE_UPLOAD_STATUSES],
})
