import { apiRequest } from '@/lib/apiClient'
import { getClientContext, trackAnalytics } from '@/lib/analytics'

const DEFAULT_RETRY_DELAYS_MS = [1500, 4000, 8000]
const RETRYABLE_UPLOAD_STATUSES = new Set([0, 408, 425, 499, 500, 502, 503, 504])
const RESUMABLE_CHUNK_BYTES = 8 * 1024 * 1024
export const MAX_VIDEO_UPLOAD_BYTES = 500 * 1024 * 1024
const DIRECT_UPLOAD_RECEIPT_KEY = 'lekha.pendingDirectUpload.v1'

const proxyFallbackAllowed = () => {
  const hostname = String(globalThis.location?.hostname || '').toLowerCase()
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
}

const fileFingerprint = (file) => ({
  filename: String(file?.name || ''),
  content_type: String(file?.type || 'application/octet-stream'),
  size_bytes: Number(file?.size || 0),
  last_modified: Math.max(0, Number(file?.lastModified || 0)),
})

const readUploadReceipt = (file) => {
  if (typeof localStorage === 'undefined') return null
  try {
    const receipt = JSON.parse(localStorage.getItem(DIRECT_UPLOAD_RECEIPT_KEY) || 'null')
    if (!receipt?.file_id || !receipt?.fingerprint) return null
    const fingerprint = fileFingerprint(file)
    return JSON.stringify(receipt.fingerprint) === JSON.stringify(fingerprint) ? receipt : null
  } catch {
    return null
  }
}

const saveUploadReceipt = (file, initialized) => {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(DIRECT_UPLOAD_RECEIPT_KEY, JSON.stringify({
    file_id: initialized.file_id,
    fingerprint: fileFingerprint(file),
    expires_at: initialized.expires_at || '',
  }))
}

const clearUploadReceipt = (fileId = '') => {
  if (typeof localStorage === 'undefined') return
  if (fileId) {
    try {
      const receipt = JSON.parse(localStorage.getItem(DIRECT_UPLOAD_RECEIPT_KEY) || 'null')
      if (receipt?.file_id !== fileId) return
    } catch {
      // An unreadable receipt is safe to remove.
    }
  }
  localStorage.removeItem(DIRECT_UPLOAD_RECEIPT_KEY)
}

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
  const headers = {
    'Content-Type': 'application/json',
    ...(authorization ? { Authorization: `Bearer ${authorization}` } : {}),
  }
  const fingerprint = fileFingerprint(file)
  const receipt = readUploadReceipt(file)
  let initialized = null
  if (receipt) {
    try {
      initialized = await apiRequest('/api/uploads/resume', {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...fingerprint, file_id: receipt.file_id }),
        dedupeKey: 'direct-upload-resume',
      })
    } catch (error) {
      if (![404, 409].includes(Number(error?.status))) throw error
      clearUploadReceipt(receipt.file_id)
    }
  }
  if (!initialized) initialized = await apiRequest('/api/uploads/init', {
    method: 'POST',
    headers,
    body: JSON.stringify(fingerprint),
    dedupeKey: 'direct-upload-init',
  })
  if (!initialized?.direct_upload_available || !initialized?.upload_url) return null
  saveUploadReceipt(file, initialized)
  let offset = 0
  let retries = 0
  try {
    if (initialized.resumed) offset = await queryResumableOffset(initialized.upload_url, file.size)
    onProgress?.(offset)
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
    if (!(isRetryableUploadError(error) || Number(error?.status) === 429)) {
      await cancelDirectUpload(initialized, authorization)
      clearUploadReceipt(initialized.file_id)
    }
    throw error
  }
  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
    try {
      const result = await apiRequest('/api/uploads/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authorization ? { Authorization: `Bearer ${authorization}` } : {}),
        },
        body: JSON.stringify({ file_id: initialized.file_id }),
        dedupeKey: 'direct-upload-complete',
      })
      clearUploadReceipt(initialized.file_id)
      return result
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
  let previousProgressBytes = null
  let previousProgressAt = startedAt
  let smoothedBytesPerSecond = 0
  const reportProgress = (uploadedBytes) => {
    const now = Date.now()
    const safeUploadedBytes = Math.max(0, Math.min(file.size, Number(uploadedBytes) || 0))
    if (previousProgressBytes === null) {
      // A resumed upload begins at the authoritative storage offset. Do not
      // count bytes sent before this browser session when estimating speed.
      previousProgressBytes = safeUploadedBytes
      previousProgressAt = now
    } else {
      const elapsedMs = now - previousProgressAt
      const byteDelta = Math.max(0, safeUploadedBytes - previousProgressBytes)
      if (elapsedMs >= 250 && byteDelta > 0) {
        const currentRate = byteDelta * 1000 / elapsedMs
        smoothedBytesPerSecond = smoothedBytesPerSecond > 0
          ? smoothedBytesPerSecond * 0.7 + currentRate * 0.3
          : currentRate
        previousProgressBytes = safeUploadedBytes
        previousProgressAt = now
      }
    }
    const remainingBytes = Math.max(0, file.size - safeUploadedBytes)
    onProgress?.({
      uploadedBytes: safeUploadedBytes,
      totalBytes: file.size,
      percent: Math.round(safeUploadedBytes * 100 / file.size),
      bytesPerSecond: Math.round(smoothedBytesPerSecond),
      remainingSeconds: smoothedBytesPerSecond > 0
        ? Math.ceil(remainingBytes / smoothedBytesPerSecond)
        : null,
    })
  }

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
    if (!proxyFallbackAllowed() || !isRetryableUploadError(error)) throw error
    trackAnalytics('funnel.upload.direct_fallback', getClientContext({
      stage: 'direct-storage-upload',
      status: Number(error?.status || 0),
      uploadReference,
    }))
  }

  if (!proxyFallbackAllowed()) {
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
