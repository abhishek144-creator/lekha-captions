import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import vm from 'node:vm'

// Execute the actual recovery functions with only the network and analytics
// dependencies replaced. No browser, provider calls, or real retry delays.
async function loadRecovery(file, exportedName, request) {
  const source = (await fs.readFile(new URL(file, import.meta.url), 'utf8'))
    .replace(/^import .+ from .+$/gm, '')
    .replace(/^export /gm, '')
  const context = vm.createContext({
    apiRequest: request,
    getClientContext: (value) => value,
    trackAnalytics: () => {},
    setTimeout,
    FormData,
    crypto: globalThis.crypto,
  })
  return vm.runInContext(`${source}\n${exportedName}`, context)
}

const file = new File(['video'], 'test.mp4', { type: 'video/mp4' })
let pendingCalls = 0
const pendingRecovery = await loadRecovery('../src/lib/resilientProcess.js', 'processVideoWithRecovery', async () => {
  pendingCalls += 1
  return pendingCalls === 1 ? { success: true, pending: true, job_id: 'durable-job' } : { success: true, captions: [{ text: 'recovered' }] }
})
assert.equal((await pendingRecovery({ file_id: 'fixture' }, { pollDelayMs: 0 })).captions[0].text, 'recovered')
assert.equal(pendingCalls, 2, 'durable 202 responses must be polled before returning captions')
const cases = [
  ['upload', '../src/lib/resilientUpload.js', 'uploadFileWithRecovery', file],
  ['process', '../src/lib/resilientProcess.js', 'processVideoWithRecovery', { file_id: 'test-file' }],
]

for (const [label, modulePath, exportName, input] of cases) {
  for (const error of [new DOMException('Cancelled', 'AbortError'), { status: 401 }, { status: 422 }]) {
    let calls = 0
    const recover = await loadRecovery(modulePath, exportName, async () => {
      calls += 1
      throw error
    })
    await assert.rejects(recover(input, { retryDelaysMs: [0, 0] }), (actual) => actual === error)
    assert.equal(calls, 1, `${label}: cancellation/auth/validation errors must not restart work`)
  }

  const attempts = []
  const expected = { success: true, captions: [{ text: 'hello' }] }
  const recover = await loadRecovery(modulePath, exportName, async (_url, options) => {
    attempts.push(options)
    if (attempts.length === 1) throw { status: 503 }
    return expected
  })
  assert.equal(await recover(input, { retryDelaysMs: [0] }), expected)
  assert.equal(attempts.length, 2)
  assert.ok(attempts[0].headers['Idempotency-Key'])
  assert.equal(attempts[0].headers['Idempotency-Key'], attempts[1].headers['Idempotency-Key'])
  if (label === 'process') {
    assert.equal(JSON.parse(attempts[1].body).idempotency_key, attempts[0].headers['Idempotency-Key'])
  }
}

// The dev proxy fallback has a separate catch: an abort there must also escape
// as cancellation instead of being turned into an API-unavailable error.
const apiSource = (await fs.readFile(new URL('../src/lib/apiClient.js', import.meta.url), 'utf8'))
  .replace(/^import .+ from .+$/gm, '')
  .replace(/^export /gm, '')
  .replaceAll('import.meta.env', 'testEnv')
const aborted = new DOMException('Cancelled fallback', 'AbortError')
let fetchCalls = 0
const apiContext = vm.createContext({
  testEnv: { DEV: true, VITE_LOCAL_API_RETRY_MS: '0' },
  window: { location: { origin: 'http://localhost:3000' } },
  auth: null,
  getFirebaseAppCheckToken: async () => '',
  shouldDispatchAuthLogout: () => false,
  Headers, URL, AbortController, setTimeout,
  fetch: async () => {
    fetchCalls += 1
    if (fetchCalls === 1) return new Response(JSON.stringify({ detail: 'proxy ECONNREFUSED' }), { status: 502 })
    throw aborted
  },
})
const apiFetch = vm.runInContext(`${apiSource}\napiFetch`, apiContext)
await assert.rejects(apiFetch('/api/process'), (error) => error === aborted)
assert.equal(fetchCalls, 2)

console.log('Recovery behavior passed: cancellation, terminal errors, transient retry, stable receipts, and proxy aborts.')


const readableContext = vm.createContext({})
const readableSource = apiSource.slice(apiSource.indexOf('function toReadableErrorMessage'), apiSource.indexOf('function createRequestReference'))
const formatError = vm.runInContext(`${readableSource}\nbuildApiErrorMessage`, readableContext)
assert.equal(formatError({ error: { code: 'INTERNAL_ERROR', message: 'Please retry.', request_id: 'r1' } }, 500), 'Please retry.')
