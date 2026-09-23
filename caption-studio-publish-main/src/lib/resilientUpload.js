import { apiRequest } from '@/lib/apiClient'
import { getClientContext, trackAnalytics } from '@/lib/analytics'

const DEFAULT_RETRY_DELAYS_MS = [1500, 4000, 8000]
const RETRYABLE_UPLOAD_STATUSES = new Set([0, 408, 425, 499, 500, 502, 503, 504])
const RESUMABLE_CHUNK_BYTES = 8 * 1024 * 1024
export const MAX_VIDEO_UPLOAD_BYTES = 500 * 1024 * 1024
const DIRECT_REQUIRED_BYTES = 8 * 1024 * 1024

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
  if (error?.name === 'AbortError') return false
  return RETRYABLE_UPLOAD_STATUSES.has(Number(error?.status || 0))
}

function acknowledgedOffset(request) {
  const range = request.getResponseHeader('Range')
  const match = /^bytes=0-(\d+)$/i.exec(range || '')
  return match ? Number(match[1]) + 1 : 0
}

function putResumableChunk(uploadUrl, blob, start, total, contentType, onProgress) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('PUT', uploadUrl)
    request.setRequestHeader('Content-Type', contentType || 'application/octet-stream')
    request.setRequestHeader('Content-Range', `bytes ${start}-${start + blob.size - 1}/${total}`)
    request.onload = () => {
      if ([200, 201, 308].includes(request.status)) resolve({
        status: request.status,
        offset: request.status === 308 ? acknowledgedOffset(request) : total,
      })
      else reject(Object.assign(new Error('Direct upload chunk failed'), { status: request.status }))
    }
    request.onerror = () => reject(Object.assign(new Error('Direct upload connection failed'), { status: 0 }))
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.min(total, start + event.loaded))
    }
    request.send(blob)
  })
}

function queryResumableOffset(uploadUrl, total) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('PUT', uploadUrl)
    request.setRequestHeader('Content-Range', `bytes */${total}`)
    request.onload = () => {
      if ([200, 201, 308].includes(request.status)) {
        resolve(request.status === 308 ? acknowledgedOffset(request) : total)
      } else {
        reject(Object.assign(new Error('Could not check upload progress'), { status: request.status }))
      }
    }
    request.onerror = () => reject(Object.assign(new Error('Upload connection unavailable'), { status: 0 }))
    request.send()
  })
}

async function cancelDirectUpload(initialized, authorization) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timeout = controller ? setTimeout(() => controller.abort(), 5000) : null
  try {
    await fetch(initialized.upload_url, {
      method: 'DELETE',
      ...(controller ? { signal: controller.signal } : {}),
    })
  } catch {
    // The API marks the intent cancelled even if storage deletion is unavailable.
  } finally {
    if (timeout) clearTimeout(timeout)
  }
  try {
    await apiRequest('/api/uploads/cancel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authorization ? { Authorization: `Bearer ${authorization}` } : {}),
      },
      body: JSON.stringify({ file_id: initialized.file_id }),
    })
  } catch {
    // The server-side lease expires; keep the original upload error visible.
  }
}

async function uploadDirectToStorage(file, authorization, retryDelaysMs, onProgress, onRetry) {
  if (typeof XMLHttpRequest === 'undefined') return null
  const initialized = await apiRequest('/api/uploads/init', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authorization ? { Authorization: `Bearer ${authorization}` } : {}),
    },
    body: JSON.stringify({
      filename: file.name,
      content_type: file.type || 'application/octet-stream',
      size_bytes: file.size,
    }),
    dedupeKey: 'direct-upload-init',
  })
  if (!initialized?.direct_upload_available || !initialized?.upload_url) return null
  let offset = 0
  let retries = 0
  try {
    while (offset < file.size) {
      const end = Math.min(file.size, offset + RESUMABLE_CHUNK_BYTES)
      try {
        const previousOffset = offset
        const result = await putResumableChunk(
          initialized.upload_url, file.slice(offset, end), offset, file.size,
          file.type, onProgress,
        )
        offset = result.offset
        if (offset <= previousOffset) throw Object.assign(new Error('Storage did not acknowledge upload progress'), { status: 503 })
        onProgress?.(offset)
        retries = 0
      } catch (error) {
        if (!(isRetryableUploadError(error) || Number(error?.status) === 429)
            || retries >= retryDelaysMs.length) throw error
        onRetry?.({ attempt: retries + 1, nextAttempt: retries + 2, error })
        await waitForConnection()
        await sleep(retryDelaysMs[retries] + Math.floor(Math.random() * 300))
        retries += 1
        while (true) {
          try {
            offset = await queryResumableOffset(initialized.upload_url, file.size)
            break
          } catch (queryError) {
            if (!isRetryableUploadError(queryError) || retries >= retryDelaysMs.length) throw queryError
            await waitForConnection()
            await sleep(retryDelaysMs[retries] + Math.floor(Math.random() * 300))
            retries += 1
          }
        }
        onProgress?.(offset)
      }
    }
  } catch (error) {
    await cancelDirectUpload(initialized, authorization)
    throw error
  }
  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
    try {
      return await apiRequest('/api/uploads/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authorization ? { Authorization: `Bearer ${authorization}` } : {}),
        },
        body: JSON.stringify({ file_id: initialized.file_id }),
        dedupeKey: 'direct-upload-complete',
      })
    } catch (error) {
      if (!(isRetryableUploadError(error) || Number(error?.status) === 409)
          || attempt >= retryDelaysMs.length) throw error
      await sleep(retryDelaysMs[attempt])
    }
  }
}

export async function uploadFileWithRecovery(file, {
  authorization = '',
  dedupeKey = 'upload-video',
  retryDelaysMs = DEFAULT_RETRY_DELAYS_MS,
  onRetry = null,
  onProgress = null,
} = {}) {
  if (!file?.size || file.size > MAX_VIDEO_UPLOAD_BYTES) {
    throw Object.assign(new Error('Video must be at most 500 MiB'), { status: 413 })
  }
  const uploadReference = createUploadReference()
  const startedAt = Date.now()
  let lastError = null
  const reportProgress = (uploadedBytes) => onProgress?.({
    uploadedBytes,
    totalBytes: file.size,
    percent: Math.round(uploadedBytes * 100 / file.size),
  })

  try {
    const directResult = await uploadDirectToStorage(file, authorization, retryDelaysMs, reportProgress, onRetry)
    if (directResult?.success) {
      trackAnalytics('funnel.upload.transport_success', getClientContext({
        stage: 'direct-storage-upload',
        attempt: 1,
        elapsedMs: Date.now() - startedAt,
        fileSizeBucket: fileSizeBucket(file?.size),
        uploadReference,
      }))
      return directResult
    }
  } catch (error) {
    lastError = error
    if (file.size > DIRECT_REQUIRED_BYTES || !isRetryableUploadError(error)) throw error
    trackAnalytics('funnel.upload.direct_fallback', getClientContext({
      stage: 'direct-storage-upload',
      status: Number(error?.status || 0),
      uploadReference,
    }))
  }

  if (file.size > DIRECT_REQUIRED_BYTES) {
    throw lastError || new Error('Direct storage upload is unavailable. Please retry shortly.')
  }

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
