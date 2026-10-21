export const statusProbes = [
  { name: 'API availability', path: '/api/health', ready: body => body?.success === true },
  { name: 'Processing readiness', path: '/api/health/readiness', ready: body => body?.ready === true },
  { name: 'Customer service controls', path: '/api/service-status', ready: body => body?.success === true && !Object.entries(body.controls || {}).some(([key, value]) => (key === 'maintenance_mode' || key.startsWith('pause_')) && value === true) },
]

export async function checkServiceStatus(probe, { base, signal, timeoutMs = 15000 } = {}) {
  const started = performance.now()
  const controller = new AbortController()
  const cancel = () => controller.abort()
  signal?.addEventListener('abort', cancel, { once: true })
  if (signal?.aborted) cancel()
  const timeout = setTimeout(cancel, timeoutMs)
  const result = (state, detail) => ({ name: probe.name, state, detail, latencyMs: Math.round(performance.now() - started) })
  try {
    const response = await fetch(`${base}${probe.path}`, { cache: 'no-store', signal: controller.signal, headers: { accept: 'application/json' } })
    if (!response.ok) return result(response.status >= 500 ? 'degraded' : 'unverified', `Health check returned HTTP ${response.status}.`)
    const body = await response.json().catch(() => null)
    if (!body || typeof body.success !== 'boolean'
      || (body.success && probe.path.endsWith('/readiness') && typeof body.ready !== 'boolean')
      || (body.success && probe.path.endsWith('/service-status') && (!body.controls || typeof body.controls !== 'object' || Array.isArray(body.controls)))) {
      return result('unverified', 'Health check returned an unexpected response.')
    }
    return probe.ready(body) ? result('operational', 'Service check passed.') : result('degraded', 'Service reports limited availability.')
  } catch {
    // Browser/network/CORS failures do not prove the remote service is down.
    return result('unverified', controller.signal.aborted ? 'Check timed out or was cancelled.' : 'This browser could not verify the service.')
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', cancel)
  }
}
