// Durable jobs keep running on the server. Only their browser status requests
// pause while the page is hidden, and account/document cancellation still wins.
export function waitForVisiblePage(signal, doc = globalThis.document) {
  if (signal?.aborted) return Promise.reject(new DOMException('Monitoring cancelled', 'AbortError'))
  if (!doc || doc.visibilityState !== 'hidden') return Promise.resolve()
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      doc.removeEventListener('visibilitychange', visible)
      signal?.removeEventListener('abort', abort)
    }
    const visible = () => {
      if (doc.visibilityState === 'hidden') return
      cleanup()
      resolve()
    }
    const abort = () => {
      cleanup()
      reject(new DOMException('Monitoring cancelled', 'AbortError'))
    }
    doc.addEventListener('visibilitychange', visible)
    signal?.addEventListener('abort', abort, { once: true })
    // Re-check after subscription so a visibility/abort transition cannot leave
    // a waiter behind between the initial check and listener registration.
    if (signal?.aborted) abort()
    else visible()
  })
}
