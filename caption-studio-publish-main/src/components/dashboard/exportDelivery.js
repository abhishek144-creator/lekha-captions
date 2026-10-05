// Monitoring deadlines never invalidate a durable server job.
export const EXPORT_MONITOR_WINDOW_MS = 60 * 60 * 1000

export function monitoringPausedError() {
  const error = new Error('Your export is still being tracked on the server. Resume it here to check progress and download.')
  error.exportStatus = 'monitoring_paused'
  return error
}

export async function boundedExportRequest(operation, { signal, timeoutMs = 15000 } = {}) {
  const controller = new AbortController()
  let timer
  let abort
  const deadline = new Promise((_resolve, reject) => {
    abort = () => {
      controller.abort()
      reject(new DOMException('Export cancelled', 'AbortError'))
    }
    if (signal?.aborted) {
      abort()
      return
    }
    signal?.addEventListener('abort', abort, { once: true })
    timer = setTimeout(() => {
      const error = new Error('Export status connection timed out')
      error.name = 'ExportRequestTimeout'
      reject(error)
      controller.abort()
    }, timeoutMs)
  })
  try {
    // Race bounds even a transport that fails to respect AbortSignal.
    return await Promise.race([deadline, Promise.resolve().then(() => {
      if (controller.signal.aborted) throw new DOMException('Export cancelled', 'AbortError')
      return operation(controller.signal)
    })])
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
}

export async function monitorExportStatus({ request, onStatus, onReconnect, sleep, signal,
  timeoutMs = EXPORT_MONITOR_WINDOW_MS, now = Date.now, pollDelay = () => 1500 }) {
  const startedAt = now()
  let consecutiveNotFound = 0
  while (now() - startedAt < timeoutMs) {
    if (signal?.aborted) throw new DOMException('Export cancelled', 'AbortError')
    let payload
    try {
      payload = await boundedExportRequest(request, {
        signal, timeoutMs: Math.min(15000, Math.max(1, timeoutMs - (now() - startedAt))),
      })
      consecutiveNotFound = 0
    } catch (error) {
      if (signal?.aborted) throw new DOMException('Export cancelled', 'AbortError')
      if (error?.status === 404 && ++consecutiveNotFound >= 4) {
        const missing = new Error('Export job was not found on the server. Please start the export again.')
        missing.exportStatus = 'failed'
        throw missing
      }
      onReconnect?.()
      await sleep(1500, signal)
      continue
    }
    onStatus?.(payload)
    const status = String(payload?.status || '').toLowerCase()
    if (status === 'completed') return
    if (status === 'failed') {
      const error = new Error(payload?.error || 'Export failed')
      error.exportStatus = 'failed'
      throw error
    }
    if (status === 'cancelled') {
      const error = new DOMException('Export cancelled', 'AbortError')
      error.exportStatus = 'cancelled'
      throw error
    }
    await sleep(pollDelay(status, now() - startedAt), signal)
  }
  throw monitoringPausedError()
}

export function startExportDownload(url, filename, { document: doc = document, signal } = {}) {
  if (signal?.aborted) throw new DOMException('Export cancelled', 'AbortError')
  const parsed = new URL(url, doc.baseURI)
  if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('Invalid export download URL')
  const link = doc.createElement('a')
  link.href = parsed.href
  link.download = filename
  link.rel = 'noreferrer'
  link.referrerPolicy = 'no-referrer'
  doc.body.appendChild(link)
  try { link.click() } finally { link.remove() }
}
