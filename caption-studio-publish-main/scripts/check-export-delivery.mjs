import assert from 'node:assert/strict'
import { boundedExportRequest, EXPORT_MONITOR_WINDOW_MS, monitorExportStatus, startExportDownload } from '../src/components/dashboard/exportDelivery.js'

let elapsed = 0
const states = []
await monitorExportStatus({
  now: () => elapsed,
  sleep: async () => { elapsed += 6 * 60 * 1000 },
  request: async () => ({ status: elapsed >= 12 * 60 * 1000 ? 'completed' : 'processing' }),
  onStatus: payload => states.push(payload.status),
})
assert.deepEqual(states, ['processing', 'processing', 'completed'])
assert.ok(elapsed > 10 * 60 * 1000, 'a valid job can outlive the old ten-minute UI limit')
assert.ok(EXPORT_MONITOR_WINDOW_MS >= 60 * 60 * 1000)

elapsed = 0
await assert.rejects(monitorExportStatus({
  now: () => elapsed, timeoutMs: 1000,
  sleep: async ms => { elapsed += ms },
  request: async () => ({ status: 'processing' }),
}), error => error.exportStatus === 'monitoring_paused' && !error.message.includes('retry'))
await assert.rejects(monitorExportStatus({
  sleep: async () => {}, request: async () => ({ status: 'failed', error: 'Worker failed' }),
}), error => error.exportStatus === 'failed')
await assert.rejects(monitorExportStatus({
  sleep: async () => {}, request: async () => ({ status: 'cancelled' }),
}), error => error.name === 'AbortError' && error.exportStatus === 'cancelled')

let transportSignal
await assert.rejects(boundedExportRequest(signal => {
  transportSignal = signal
  return new Promise(() => {}) // a stalled transport ignoring abort
}, { timeoutMs: 20 }), error => error.name === 'ExportRequestTimeout')
assert.equal(transportSignal.aborted, true)
const cancelled = new AbortController()
cancelled.abort()
let sent = false
await assert.rejects(boundedExportRequest(async () => { sent = true }, { signal: cancelled.signal }), { name: 'AbortError' })
assert.equal(sent, false)

let clicks = 0
let removed = false
const link = { click: () => clicks++, remove: () => { removed = true } }
const doc = { baseURI: 'https://app.example/Dashboard', createElement: () => link, body: { appendChild: () => {} } }
startExportDownload('https://media.example/exports/private.mp4?signature=private', 'my_clip_captioned.mp4', { document: doc })
assert.equal(clicks, 1)
assert.equal(link.href, 'https://media.example/exports/private.mp4?signature=private')
assert.equal(link.download, 'my_clip_captioned.mp4')
assert.equal(link.referrerPolicy, 'no-referrer')
assert.ok(removed)
assert.throws(() => startExportDownload('javascript:alert(1)', 'clip.mp4', { document: doc }), /Invalid/)
console.log('Export delivery passed: long render, background deadline, hung transport, cancellation and direct browser download.')
