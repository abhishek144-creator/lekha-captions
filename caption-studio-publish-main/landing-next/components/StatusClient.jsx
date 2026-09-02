'use client'

import { useCallback, useEffect, useState } from 'react'

const apiBase = 'https://api.lekhacaptions.com'
const probes = [
  { name: 'API availability', path: '/api/health', validate: (body) => body?.success === true },
  { name: 'Processing readiness', path: '/api/health/readiness', validate: (body) => body?.ready === true },
  { name: 'Customer service controls', path: '/api/service-status', validate: (body) => body?.success === true },
]

async function runProbe(probe) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  const startedAt = performance.now()
  try {
    const response = await fetch(`${apiBase}${probe.path}`, {
      cache: 'no-store',
      headers: { accept: 'application/json' },
      signal: controller.signal,
    })
    const body = await response.json().catch(() => null)
    return {
      name: probe.name,
      ok: response.ok && probe.validate(body),
      latencyMs: Math.round(performance.now() - startedAt),
    }
  } catch {
    return { name: probe.name, ok: false, latencyMs: Math.round(performance.now() - startedAt) }
  } finally {
    clearTimeout(timeout)
  }
}

export function StatusClient() {
  const [results, setResults] = useState([])
  const [checking, setChecking] = useState(true)
  const [checkedAt, setCheckedAt] = useState(null)

  const refresh = useCallback(async () => {
    setChecking(true)
    const nextResults = await Promise.all(probes.map(runProbe))
    setResults(nextResults)
    setCheckedAt(new Date())
    setChecking(false)
  }, [])

  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, 60000)
    return () => clearInterval(timer)
  }, [refresh])

  const healthy = results.length === probes.length && results.every((result) => result.ok)
  const summary = checking && results.length === 0
    ? 'Checking production services…'
    : healthy
      ? 'All monitored systems are operational.'
      : 'One or more monitored systems are degraded.'

  return (
    <section className="status-panel" aria-live="polite" aria-busy={checking}>
      <div className={`status-summary ${healthy ? 'status-ok' : checking ? 'status-checking' : 'status-degraded'}`}>
        <span className="status-dot" aria-hidden="true" />
        <div>
          <h2>{summary}</h2>
          <p>
            {checkedAt
              ? `Last checked ${checkedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Refreshes every minute.`
              : 'Running independent browser checks against the production API.'}
          </p>
        </div>
      </div>
      <div className="status-services">
        {probes.map((probe) => {
          const result = results.find((item) => item.name === probe.name)
          return (
            <div className="status-service" key={probe.name}>
              <div>
                <h3>{probe.name}</h3>
                <p>{result ? `${result.latencyMs} ms response` : 'Waiting for result'}</p>
              </div>
              <span className={result?.ok ? 'status-badge status-badge-ok' : 'status-badge'}>
                {result ? (result.ok ? 'Operational' : 'Degraded') : 'Checking'}
              </span>
            </div>
          )
        })}
      </div>
      <button className="button button-outline status-refresh" type="button" onClick={refresh} disabled={checking}>
        {checking ? 'Checking…' : 'Check again'}
      </button>
      <p className="status-note">This page is hosted separately from the API, so it remains available during an API interruption.</p>
    </section>
  )
}
