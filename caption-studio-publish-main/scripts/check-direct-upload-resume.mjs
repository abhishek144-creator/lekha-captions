import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import vm from 'node:vm'

const source = (await fs.readFile(new URL('../src/lib/resilientUpload.js', import.meta.url), 'utf8'))
  .replace(/^import .+ from .+$/gm, '')
  .replace(/^export /gm, '')

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

console.log('Direct upload resume and large-file proxy prohibition passed.')
