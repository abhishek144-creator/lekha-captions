#!/usr/bin/env node
import assert from 'node:assert/strict'
import http from 'node:http'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// Exercise the deployed verifier itself without production credentials or work.
const sha = 'a'.repeat(40)
const identity = { schema_version: 1, release: sha, release_version: 'git-aaaaaaaaaaaa',
  built_at: '2026-10-08T00:00:00Z', environment: 'production' }
let scenario = {}
const server = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://fixture.invalid')
  response.setHeader('Content-Type', 'application/json')
  if (url.pathname === '/api/health/readiness') {
    response.end(JSON.stringify({ ready: scenario.ready !== false }))
  } else if (url.pathname.endsWith('/api/version')) {
    const worker = url.pathname.startsWith('/worker/')
    response.end(JSON.stringify({ ...identity, component: worker ? 'worker' : 'api',
      ...(worker ? scenario.worker : scenario.api) }))
  } else if (url.pathname.endsWith('/release.json')) {
    const marketing = url.pathname.startsWith('/marketing/')
    response.end(JSON.stringify({ ...identity, component: marketing ? 'marketing' : 'editor',
      ...(marketing ? scenario.marketing : scenario.editor) }))
  } else {
    response.setHeader('Content-Type', 'text/html')
    response.end(`<html><head><meta name="lekha-release" content="${scenario.htmlSha || sha}"></head><body>Fixture</body></html>`)
  }
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const origin = `http://127.0.0.1:${server.address().port}`
const verifier = fileURLToPath(new URL('./check-deployed-release.mjs', import.meta.url))
async function run(fixture) {
  scenario = fixture
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [verifier, `--expected=${sha}`, `--api=${origin}`,
      `--frontend=${origin}`, `--marketing=${fixture.separate ? origin + '/marketing' : origin}`],
    { env: { ...process.env, DEPLOY_VERIFY_ENVIRONMENT: 'production',
      DEPLOY_VERIFY_WORKER_URLS: fixture.noWorkers ? '' : origin + '/worker',
      DEPLOY_VERIFY_TIMEOUT_MS: '5000' }, windowsHide: true })
    let output = ''
    child.stdout.on('data', (data) => { output += data })
    child.stderr.on('data', (data) => { output += data })
    child.on('error', reject)
    child.on('close', (code) => resolve({ code, output }))
  })
}
const cases = [
  ['unified homepage/editor', {}, null],
  ['separate marketing deployment', { separate: true }, null],
  ['separate marketing wrong identity', { separate: true, marketing: { component: 'editor' } }, 'marketing component identity mismatch'],
  ['worker network missing', { noWorkers: true }, 'Worker verification requires'],
  ['worker SHA mismatch', { worker: { release: 'b'.repeat(40) } }, 'worker-1 release SHA mismatch'],
  ['build timestamp mismatch', { editor: { built_at: '2026-10-08T01:00:00Z' } }, 'editor build timestamp mismatch'],
  ['version mismatch', { editor: { release_version: 'old-release' } }, 'editor release version mismatch'],
  ['schema mismatch', { worker: { schema_version: 2 } }, 'worker-1 metadata schema missing or unsupported'],
  ['environment mismatch', { worker: { environment: 'staging' } }, 'worker-1 release environment mismatch'],
  ['API not ready', { ready: false }, 'backend readiness does not report ready:true'],
  ['HTML SHA mismatch', { htmlSha: 'b'.repeat(40) }, 'frontend release mismatch'],
]
try {
  for (const [name, fixture, error] of cases) {
    const result = await run(fixture)
    assert.equal(result.code, error ? 1 : 0, `${name}: ${result.output}`)
    assert.ok(result.output.includes(error || `Deployed release verified: ${sha}`), `${name}: ${result.output}`)
  }
  console.log(`Deployed verifier contracts passed: ${cases.length} positive/negative scenarios.`)
} finally {
  await new Promise((resolve) => server.close(resolve))
}
