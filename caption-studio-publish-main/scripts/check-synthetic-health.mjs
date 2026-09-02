#!/usr/bin/env node
// Synthetic health monitor for the Lekha Captions API.
//
// Intended to run on a schedule (cron, uptime runner, CI) against a deployed
// environment. Exits 0 when every probe passes and 1 on the first hard failure,
// so an external monitor can alert on the exit code alone.
//
//   node scripts/check-synthetic-health.mjs --base=https://api.example.com
//   node scripts/check-synthetic-health.mjs --base=https://api.example.com --expected-release=<release>
//
// Env:
//   SYNTHETIC_BASE_URL        base URL (alternative to --base)
//   SYNTHETIC_ADMIN_TOKEN     optional admin token; unlocks SLO/queue detail
//   SYNTHETIC_TIMEOUT_MS      per-request timeout      (default 10000)
//   SYNTHETIC_MAX_LATENCY_MS  latency budget per probe (default 3000)
//   SYNTHETIC_EXPECTED_RELEASE exact APP_RELEASE expected from the deployment
//   SYNTHETIC_DNS_HOSTS       comma-separated public hostnames checked through
//                             Google and Cloudflare validating resolvers

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
const expectedRelease = (args.get('expected-release') || process.env.SYNTHETIC_EXPECTED_RELEASE || '').trim()
const configuredDnsHosts = String(args.get('dns-hosts') || process.env.SYNTHETIC_DNS_HOSTS || '').trim()

function isPublicHostname(hostname) {
  return hostname
    && hostname !== 'localhost'
    && hostname !== '127.0.0.1'
    && hostname !== '::1'
    && !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)
}

const baseHostname = new URL(baseUrl).hostname
const dnsHosts = (configuredDnsHosts
  ? configuredDnsHosts.split(',')
  : isPublicHostname(baseHostname) ? [baseHostname] : [])
  .map((host) => host.trim().toLowerCase())
  .filter(Boolean)
  .filter((host, index, all) => all.indexOf(host) === index)

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

const dnsResolvers = [
  {
    name: 'google',
    url: (host) => `https://dns.google/resolve?name=${encodeURIComponent(host)}&type=A`,
    headers: {},
  },
  {
    name: 'cloudflare',
    url: (host) => `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=A`,
    headers: { accept: 'application/dns-json' },
  },
]

async function probeDns(host, resolver) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const startedAt = Date.now()
  try {
    const response = await fetch(resolver.url(host), {
      headers: { connection: 'close', ...resolver.headers },
      signal: controller.signal,
    })
    const body = await response.json().catch(() => null)
    const answers = Array.isArray(body?.Answer) ? body.Answer : []
    const hasAddressChain = answers.some((answer) => answer?.type === 1 || answer?.type === 5)
    return {
      ok: response.ok && body?.Status === 0 && hasAddressChain,
      status: response.status,
      latencyMs: Date.now() - startedAt,
      body,
      url: resolver.url(host),
      error: body?.Status === 2
        ? `validating resolver returned SERVFAIL${body?.Comment ? `: ${JSON.stringify(body.Comment)}` : ''}`
        : body?.Status !== 0
          ? `DNS response status ${body?.Status ?? 'missing'}`
          : !hasAddressChain
            ? 'DNS response has no A or CNAME answer'
            : '',
    }
  } catch (error) {
    return {
      ok: false,
      status: 0,
      latencyMs: Date.now() - startedAt,
      body: null,
      url: resolver.url(host),
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

// DNS/DNSSEC is checked before HTTP. A healthy origin is irrelevant when a
// validating resolver cannot reach it, which is exactly the failure mode this
// monitor is intended to catch.
for (const host of dnsHosts) {
  const dnsResults = await Promise.all(dnsResolvers.map((resolver) => probeDns(host, resolver)))
  dnsResults.forEach((result, index) => {
    const resolver = dnsResolvers[index]
    record(`dns ${resolver.name.padEnd(10)} ${host}`, result)
  })
}

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
  !body || typeof body.version !== 'string' || !body.version
    ? 'response missing version string'
    : expectedRelease && body.release !== expectedRelease
      ? `deployment release mismatch (expected ${expectedRelease}, received ${body.release || 'none'})`
      : ''
))

// 4. Customer-facing service controls — exercises a non-health API route and
// catches a deployment that is reachable but cannot serve the app's status
// banner contract.
record('service   /api/service-status', await probe('/api/service-status'), (body) => (
  body?.success === true && body?.controls && typeof body.controls === 'object'
    ? ''
    : 'response missing success:true or service controls'
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
