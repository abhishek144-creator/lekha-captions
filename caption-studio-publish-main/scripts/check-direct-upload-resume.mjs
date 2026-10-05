import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import vm from 'node:vm'

const source = (await fs.readFile(new URL('../src/lib/resilientUpload.js', import.meta.url), 'utf8'))
  .replace(/^import .+ from .+$/gm, '')
  .replace(/^export /gm, '')
  .replaceAll('import.meta.env.DEV', 'true')

const chunkBytes = 8 * 1024 * 1024
const file = new File([new Uint8Array(chunkBytes * 2)], 'sample.mp4', { type: 'video/mp4' })
let firstChunkFailed = false
const ranges = []
const progress = []
const apiPaths = []

class FakeRequest {
  upload = {}
  headers = {}
  status = 0

  open(method, url) {
    this.url = url
    assert.equal(method, 'PUT')
    assert.equal(url, 'https://storage.test/session')
  }

  setRequestHeader(name, value) {
    this.headers[name] = value
  }

  getResponseHeader(name) {
    return name === 'Range' ? this.range : null
  }

  send() {
    const range = this.headers['Content-Range']
    ranges.push(range)
    if (!firstChunkFailed) {
      firstChunkFailed = true
      this.status = 0
      this.onerror()
    } else if (range === `bytes */${file.size}`) {
      this.status = 308
      this.range = `bytes=0-${chunkBytes - 1}`
      this.onload()
    } else {
      this.status = 200
      this.upload.onprogress?.({ lengthComputable: true, loaded: chunkBytes })
      this.onload()
    }
  }
}

const context = vm.createContext({
  XMLHttpRequest: FakeRequest,
  apiRequest: async (path) => {
    apiPaths.push(path)
    if (path === '/api/uploads/init') return {
      success: true, direct_upload_available: true,
      upload_url: 'https://storage.test/session', file_id: 'fixture',
    }
    if (path === '/api/uploads/complete') return { success: true, file_id: 'fixture' }
    throw new Error(`Unexpected API proxy request: ${path}`)
  },
  getClientContext: (value) => value,
  trackAnalytics: () => {},
  crypto: globalThis.crypto,
  navigator: { onLine: true },
  setTimeout,
  Math: { ...Math, random: () => 0, round: Math.round, max: Math.max, min: Math.min, floor: Math.floor },
})

const upload = vm.runInContext(`${source}\nuploadFileWithRecovery`, context)
assert.equal(vm.runInContext('MAX_VIDEO_UPLOAD_BYTES', context), 524288000)
const result = await upload(file, { retryDelaysMs: [0], onProgress: (value) => progress.push(value) })
assert.equal(result.success, true)
assert.deepEqual(apiPaths, ['/api/uploads/init', '/api/uploads/complete'])
assert.deepEqual(ranges, [
  `bytes 0-${chunkBytes - 1}/${file.size}`,
  `bytes */${file.size}`,
  `bytes ${chunkBytes}-${file.size - 1}/${file.size}`,
])
assert.equal(progress.at(-1).uploadedBytes, file.size)
assert.equal(typeof progress.at(-1).bytesPerSecond, 'number')
assert.ok(Object.hasOwn(progress.at(-1), 'remainingSeconds'))

// A page reload keeps only a non-secret file fingerprint. Re-selecting the
// exact same file asks the authenticated API for the stored resumable session.
const stored = new Map()
stored.set('lekha.pendingDirectUpload.v1', JSON.stringify({
  file_id: 'resume-fixture',
  fingerprint: {
    filename: file.name,
    content_type: file.type,
    size_bytes: file.size,
    last_modified: file.lastModified,
  },
}))
const localStorage = {
  getItem: (key) => stored.get(key) || null,
  setItem: (key, value) => stored.set(key, value),
  removeItem: (key) => stored.delete(key),
}
const reloadRanges = []
class ReloadRequest extends FakeRequest {
  send() {
    const range = this.headers['Content-Range']
    reloadRanges.push(range)
    if (range === `bytes */${file.size}`) {
      this.status = 308
      this.range = `bytes=0-${chunkBytes - 1}`
    } else {
      this.status = 200
    }
    this.onload()
  }
}
const reloadPaths = []
const resumedUpload = vm.runInContext(`${source}\nuploadFileWithRecovery`, vm.createContext({
  XMLHttpRequest: ReloadRequest,
  localStorage,
  apiRequest: async (path) => {
    reloadPaths.push(path)
    if (path === '/api/uploads/resume') return {
      success: true, direct_upload_available: true, resumed: true,
      upload_url: 'https://storage.test/session', file_id: 'resume-fixture',
    }
    if (path === '/api/uploads/complete') return { success: true, file_id: 'resume-fixture' }
    throw new Error(`Unexpected API proxy request: ${path}`)
  },
  getClientContext: (value) => value,
  trackAnalytics: () => {},
  crypto: globalThis.crypto,
  navigator: { onLine: true },
  setTimeout,
  Math,
}))
assert.equal((await resumedUpload(file, { retryDelaysMs: [] })).success, true)
assert.deepEqual(reloadPaths, ['/api/uploads/resume', '/api/uploads/complete'])
assert.deepEqual(reloadRanges, [
  `bytes */${file.size}`,
  `bytes ${chunkBytes}-${file.size - 1}/${file.size}`,
])
assert.equal(stored.has('lekha.pendingDirectUpload.v1'), false)

// This represents the supported maximum without allocating a 500 MiB test
// buffer. It verifies the same resumable request sequence a browser uses for
// the complete limit, including recovery after an interrupted first chunk.
const maxAllowedFile = {
  name: 'max-allowed.mp4',
  type: 'video/mp4',
  size: 500 * 1024 * 1024,
  slice(start, end) {
    return { size: end - start }
  },
}
let firstLargeChunkFailed = false
const largeRanges = []
const largeProgress = []
const largeApiPaths = []

class LargeFileRequest {
  upload = {}
  headers = {}
  status = 0

  open(method, url) {
    this.url = url
    assert.equal(method, 'PUT')
    assert.equal(url, 'https://storage.test/session')
  }

  setRequestHeader(name, value) {
    this.headers[name] = value
  }

  getResponseHeader(name) {
    return name === 'Range' ? this.range : null
  }

  send() {
    const range = this.headers['Content-Range']
    largeRanges.push(range)
    if (!firstLargeChunkFailed) {
      firstLargeChunkFailed = true
      this.status = 0
      this.onerror()
      return
    }
    if (range === `bytes */${maxAllowedFile.size}`) {
      this.status = 308
      this.range = `bytes=0-${chunkBytes * 2 - 1}`
      this.onload()
      return
    }
    const match = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(range)
    assert.ok(match, `Expected a resumable data range, got ${range}`)
    const start = Number(match[1])
    const end = Number(match[2])
    assert.equal(Number(match[3]), maxAllowedFile.size)
    assert.equal(end - start + 1, Math.min(chunkBytes, maxAllowedFile.size - start))
    this.status = end + 1 === maxAllowedFile.size ? 200 : 308
    this.range = `bytes=0-${end}`
    this.upload.onprogress?.({ lengthComputable: true, loaded: end - start + 1 })
    this.onload()
  }
}

const maxResult = await vm.runInContext(`${source}\nuploadFileWithRecovery`, vm.createContext({
  XMLHttpRequest: LargeFileRequest,
  apiRequest: async (path) => {
    largeApiPaths.push(path)
    if (path === '/api/uploads/init') return {
      success: true, direct_upload_available: true,
      upload_url: 'https://storage.test/session', file_id: 'max-fixture',
    }
    if (path === '/api/uploads/complete') return { success: true, file_id: 'max-fixture' }
    throw new Error(`Unexpected API proxy request: ${path}`)
  },
  getClientContext: (value) => value,
  trackAnalytics: () => {},
  crypto: globalThis.crypto,
  navigator: { onLine: true },
  setTimeout,
  Math: { ...Math, random: () => 0, round: Math.round, max: Math.max, min: Math.min, floor: Math.floor },
}))(maxAllowedFile, { retryDelaysMs: [0], onProgress: (value) => largeProgress.push(value) })

assert.equal(maxResult.success, true)
assert.deepEqual(largeApiPaths, ['/api/uploads/init', '/api/uploads/complete'])
assert.deepEqual(largeRanges.slice(0, 3), [
  `bytes 0-${chunkBytes - 1}/${maxAllowedFile.size}`,
  `bytes */${maxAllowedFile.size}`,
  `bytes ${chunkBytes * 2}-${chunkBytes * 3 - 1}/${maxAllowedFile.size}`,
])
assert.equal(largeRanges.at(-1), `bytes ${maxAllowedFile.size - chunkBytes / 2}-${maxAllowedFile.size - 1}/${maxAllowedFile.size}`)
assert.equal(largeProgress.at(-1).uploadedBytes, maxAllowedFile.size)
assert.equal(typeof largeProgress.at(-1).bytesPerSecond, 'number')
assert.ok(Object.hasOwn(largeProgress.at(-1), 'remainingSeconds'))

let revokedSession = false
const cancelledPaths = []
class FailedRequest extends FakeRequest {
  send() {
    this.status = 403
    this.onload()
  }
}
const cancelledUpload = vm.runInContext(`${source}\nuploadFileWithRecovery`, vm.createContext({
  XMLHttpRequest: FailedRequest,
  apiRequest: async (path) => {
    cancelledPaths.push(path)
    if (path === '/api/uploads/init') return {
      success: true, direct_upload_available: true,
      upload_url: 'https://storage.test/session', file_id: 'fixture',
    }
    if (path === '/api/uploads/cancel') return { success: true }
    throw new Error(`Unexpected API request: ${path}`)
  },
  fetch: async (_url, options) => {
    revokedSession = options.method === 'DELETE'
    return { status: 499 }
  },
  AbortController,
  setTimeout,
  clearTimeout,
  navigator: { onLine: true },
  getClientContext: (value) => value,
  trackAnalytics: () => {},
  crypto: globalThis.crypto,
  Math,
}))
await assert.rejects(cancelledUpload(file, { retryDelaysMs: [] }), /Direct upload chunk failed/)
assert.equal(revokedSession, true)
assert.deepEqual(cancelledPaths, ['/api/uploads/init', '/api/uploads/cancel'])

const unavailable = vm.runInContext(`${source}\nuploadFileWithRecovery`, vm.createContext({
  XMLHttpRequest: FakeRequest,
  apiRequest: async () => ({ success: false, direct_upload_available: false }),
  getClientContext: (value) => value,
  trackAnalytics: () => {},
  crypto: globalThis.crypto,
  Math,
}))
await assert.rejects(unavailable(file, { retryDelaysMs: [] }), /Direct storage upload is unavailable/)
await assert.rejects(
  upload({ name: 'oversize.mp4', size: 500 * 1024 * 1024 + 1 }),
  /500 MiB/,
)

// S3-compatible storage (Cloudflare R2): parts go to presigned URLs, a failed
// part is retried, and a resumed upload skips parts storage already holds.
const multipartFile = {
  name: 'r2.mp4',
  type: 'video/mp4',
  size: chunkBytes * 2 + 1024,
  lastModified: 1,
  slice(start, end) {
    return { size: end - start, start }
  },
}
function multipartContext(sentParts, apiCalls, { failFirstPut = false, completedParts = [] } = {}) {
  let failed = !failFirstPut
  class PartRequest {
    upload = {}
    status = 0
    open(method, url) {
      assert.equal(method, 'PUT')
      this.url = url
    }
    setRequestHeader() {
      throw new Error('Presigned part PUTs must not add headers the signature does not cover')
    }
    send(blob) {
      if (!failed) {
        failed = true
        this.onerror()
        return
      }
      const number = Number(new URL(this.url).searchParams.get('partNumber'))
      assert.equal(blob.start, (number - 1) * chunkBytes)
      sentParts.push(number)
      this.status = 200
      this.upload.onprogress?.({ lengthComputable: true, loaded: blob.size })
      this.onload()
    }
  }
  const session = {
    success: true, direct_upload_available: true, file_id: 'r2-fixture',
    upload_protocol: 's3_multipart', part_size: chunkBytes, part_count: 3,
  }
  return vm.createContext({
    XMLHttpRequest: PartRequest,
    localStorage: completedParts.length ? {
      getItem: () => JSON.stringify({
        file_id: 'r2-fixture',
        fingerprint: {
          filename: multipartFile.name, content_type: multipartFile.type,
          size_bytes: multipartFile.size, last_modified: multipartFile.lastModified,
        },
      }),
      setItem: () => {},
      removeItem: () => {},
    } : undefined,
    apiRequest: async (path, options) => {
      apiCalls.push(path)
      if (path === '/api/uploads/init') return session
      if (path === '/api/uploads/resume') return { ...session, resumed: true, completed_parts: completedParts }
      if (path === '/api/uploads/parts') {
        const numbers = JSON.parse(options.body).part_numbers
        return { success: true, parts: numbers.map((n) => ({ part_number: n, url: `https://r2.test/obj?partNumber=${n}` })) }
      }
      if (path === '/api/uploads/complete') return { success: true, file_id: 'r2-fixture' }
      throw new Error(`Unexpected API request: ${path}`)
    },
    getClientContext: (value) => value,
    trackAnalytics: () => {},
    crypto: globalThis.crypto,
    navigator: { onLine: true },
    setTimeout,
    URL,
    Math: { ...Math, random: () => 0, round: Math.round, max: Math.max, min: Math.min, floor: Math.floor, ceil: Math.ceil },
  })
}

const freshParts = []
const freshCalls = []
const freshProgress = []
const freshResult = await vm.runInContext(`${source}\nuploadFileWithRecovery`,
  multipartContext(freshParts, freshCalls, { failFirstPut: true }))(
  multipartFile, { retryDelaysMs: [0], onProgress: (value) => freshProgress.push(value) },
)
assert.equal(freshResult.success, true)
assert.deepEqual([...freshParts].sort(), [1, 2, 3])
assert.deepEqual(freshCalls, ['/api/uploads/init', '/api/uploads/parts', '/api/uploads/complete'])
assert.equal(freshProgress.at(-1).uploadedBytes, multipartFile.size)

const resumedParts = []
const resumedCalls = []
const resumedResult = await vm.runInContext(`${source}\nuploadFileWithRecovery`,
  multipartContext(resumedParts, resumedCalls, { completedParts: [1, 3] }))(multipartFile, { retryDelaysMs: [] })
assert.equal(resumedResult.success, true)
assert.deepEqual(resumedParts, [2])
assert.deepEqual(resumedCalls, ['/api/uploads/resume', '/api/uploads/parts', '/api/uploads/complete'])

console.log('Direct upload resume and large-file proxy prohibition passed.')
