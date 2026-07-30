#!/usr/bin/env node
// Synthetic health monitor for the Lekha Captions API.
//
// Intended to run on a schedule (cron, uptime runner, CI) against a deployed
// environment. Exits 0 when every probe passes and 1 on the first hard failure,
// so an external monitor can alert on the exit code alone.
//
//   node scripts/check-synthetic-health.mjs --base=https://api.example.com
//
// Env:
//   SYNTHETIC_BASE_URL        base URL (alternative to --base)
//   SYNTHETIC_ADMIN_TOKEN     optional admin token; unlocks SLO/queue detail
//   SYNTHETIC_TIMEOUT_MS      per-request timeout      (default 10000)
//   SYNTHETIC_MAX_LATENCY_MS  latency budget per probe (default 3000)

const args = new Map(
  process.argv.slice(2)
    .filter((a) => a.startsWith('--'))
    .map((a) => {
      const [k, ...rest] = a.replace(/^--/, '').split('=')
      return [k, rest.join('=') || 'true']
    }),
)

const baseUrl = (args.get('base') || process.env.SYNTHETIC_BASE_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '')
const adminToken = (process.env.SYNTHETIC_ADMIN_TOKEN || '').trim()
const timeoutMs = Number(process.env.SYNTHETIC_TIMEOUT_MS || 10000)
const maxLatencyMs = Number(process.env.SYNTHETIC_MAX_LATENCY_MS || 3000)

async function probe(path, { expectStatus = 200, headers = {} } = {}) {
  const url = `${baseUrl}${path}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const startedAt = Date.now()
  try {
    // connection: close keeps undici from parking a keep-alive socket. A pooled
    // socket outliving the checks keeps the event loop busy, which on Windows
    // turns a forced exit into a libuv assertion crash instead of a clean code.
    const res = await fetch(url, {
      headers: { connection: 'close', ...headers },
      signal: controller.signal,
    })
    const latencyMs = Date.now() - startedAt
    let body = null
    try {
      body = await res.json()
    } catch {
      body = null
    }
    return { ok: res.status === expectStatus, status: res.status, latencyMs, body, url }
  } catch (error) {
    return {
      ok: false,
      status: 0,
      latencyMs: Date.now() - startedAt,
      body: null,
      url,
      error: error.name === 'AbortError' ? `timed out after ${timeoutMs}ms` : error.message,
    }
  } finally {
    clearTimeout(timer)
  }
}

const failures = []
const results = []

function record(name, result, extraCheck) {
  let detail = result.error || ''
  let ok = result.ok
  if (ok && typeof extraCheck === 'function') {
    const problem = extraCheck(result.body)
    if (problem) {
      ok = false
      detail = problem
    }
  }
  if (ok && result.latencyMs > maxLatencyMs) {
    ok = false
    detail = `latency ${result.latencyMs}ms exceeds budget ${maxLatencyMs}ms`
  }
  results.push({ name, ok, status: result.status, latencyMs: result.latencyMs, detail })
  if (!ok) failures.push(`${name}: ${detail || `unexpected status ${result.status}`}`)
}

const authHeaders = adminToken ? { authorization: `Bearer ${adminToken}` } : {}

// 1. Liveness — the process is up and serving.
record('liveness  /api/health', await probe('/api/health'), (body) => (
  body && body.success === true ? '' : 'response missing success:true'
))

// 2. Readiness — release gate + runtime dependencies. Returns 503 when not ready.
const readiness = await probe('/api/health/readiness', { headers: authHeaders })
record('readiness /api/health/readiness', readiness, (body) => (
  body && body.ready === true ? '' : 'service reports ready:false (503 = dependency or release gate failing)'
))

// 3. Version contract — catches a bad deploy serving an unexpected API version.
record('version   /api/version', await probe('/api/version'), (body) => (
  body && typeof body.version === 'string' && body.version ? '' : 'response missing version string'
))

const width = Math.max(...results.map((r) => r.name.length))
console.log(`Synthetic health: ${baseUrl}\n`)
for (const r of results) {
  const mark = r.ok ? 'PASS' : 'FAIL'
  const line = `  [${mark}] ${r.name.padEnd(width)}  ${String(r.status).padStart(3)}  ${String(r.latencyMs).padStart(5)}ms`
  console.log(r.detail ? `${line}  — ${r.detail}` : line)
}

// Admin token unlocks the operational detail the public probe deliberately hides.
if (adminToken && readiness.body && readiness.body.queue) {
  const q = readiness.body.queue
  console.log(`\n  queue: durable=${q.durable_enabled} connected=${q.connected} name=${q.queue_name}`)
  if (q.durable_enabled && !q.connected) {
    failures.push('queue: durable queue enabled but not connected — exports will run inline')
  }
}

// Set exitCode rather than calling process.exit(): a forced exit can race with
// still-closing sockets and abort the process with a platform error code, which
// an uptime runner would report as a crash rather than a clean failed check.
if (failures.length) {
  console.error(`\nSynthetic health FAILED (${failures.length}):`)
  for (const f of failures) console.error(`  - ${f}`)
  process.exitCode = 1
} else {
  console.log('\nAll synthetic probes passed.')
  process.exitCode = 0
}
