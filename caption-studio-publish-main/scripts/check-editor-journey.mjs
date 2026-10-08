import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import puppeteer from 'puppeteer'

// Real Dashboard, hooks, preview and export UI with isolated auth and API
// doubles. No credentials, provider requests, charges or production writes.
const server = await createServer({
  configFile: false, envDir: false,
  plugins: [react()],
  resolve: { alias: [
    { find: '@/lib/AuthContext', replacement: resolve('e2e/fixtures/editorAuth.jsx') },
    { find: '@/context/AuthContext', replacement: resolve('e2e/fixtures/editorAuth.jsx') },
    { find: '@/lib/firebase', replacement: resolve('e2e/fixtures/editorFirebase.js') },
    { find: '@', replacement: resolve('src') },
  ] },
  define: { 'import.meta.env.VITE_API_BASE_URL': '""', 'import.meta.env.VITE_LOCAL_API_RETRY_MS': '"0"' },
  server: { host: '127.0.0.1', port: 4187, strictPort: true },
})
await server.listen()
const browser = await puppeteer.launch({ headless: true, args: process.env.CI ? ['--no-sandbox'] : [] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 1100 })
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
let savedDraft = null
let conflict = false
let exports = 0
let exportPayload = null
let downloads = 0
let orderRequests = []
let verificationRequests = []
let invalidOrder = false
let uploadInitializations = 0
let uploadResumes = 0
let uploadOffset = 0
let interruptedChunk = false
let recoveringUpload = false
const uploadRanges = []
const chunkBytes = 8 * 1024 * 1024
const caption = { id: 'a', text: 'hello bright world', start_time: 0, end_time: 3, words: [{ word: 'hello', start: 0, end: 1 }, { word: 'bright', start: 1, end: 2 }, { word: 'world', start: 2, end: 3 }], wordStyles: {} }
const draft = { ownerUid: 'editor-test-a', projectId: 'test-project', fileId: '123e4567-e89b-12d3-a456-426614174000', videoUrl: '', duration: 4, originalFileName: 'fixture.mp4', captions: [caption], captionTracks: [{ id: 'source', label: 'Original', captions: [caption] }, { id: 'hi', label: 'Hindi', captions: [{ ...caption, text: 'नमस्ते दुनिया', words: [] }] }], activeCaptionTrackId: 'source', captionStyle: { font_family: 'Inter', font_size: 17, position_y: 70, text_color: '#ffffff', has_background: true }, settings: {} }
await page.setRequestInterception(true)
page.on('request', async (request) => {
  const url = new URL(request.url())
  if (url.hostname !== '127.0.0.1' && !['data:', 'blob:'].includes(url.protocol)) return request.abort()
  if (url.pathname === '/test-storage-session') {
    const range = request.headers()['content-range']
    uploadRanges.push(range)
    if (range.startsWith('bytes */')) return request.respond({ status: 308, headers: { Range: `bytes=0-${uploadOffset - 1}` } })
    if (uploadOffset === chunkBytes && !recoveringUpload) {
      interruptedChunk = true
      return request.abort('internetdisconnected')
    }
    uploadOffset = Number(/-(\d+)\//.exec(range)[1]) + 1
    return request.respond({ status: uploadOffset === chunkBytes * 2 ? 200 : 308, headers: { Range: `bytes=0-${uploadOffset - 1}` } })
  }
  if (!url.pathname.startsWith('/api/')) return request.continue()
  let payload = { success: true }
  let status = 200
  if (url.pathname.startsWith('/api/uploads/')) {
    assert.equal(request.headers().authorization, 'Bearer local-test-token')
    if (url.pathname.endsWith('/init')) uploadInitializations += 1
    if (url.pathname.endsWith('/resume')) uploadResumes += 1
    payload = { success: true, file_id: draft.fileId, direct_upload_available: true,
      upload_url: 'http://127.0.0.1:4187/test-storage-session', resumed: url.pathname.endsWith('/resume') }
  } else if (url.pathname === '/api/create-order') {
    orderRequests.push({ body: JSON.parse(request.postData()), authorization: request.headers().authorization })
    payload = { success: true, key_id: 'rzp_test_local_fixture', order: { id: 'order_local_fixture', amount: invalidOrder ? -1 : 299000, currency: 'INR' } }
  } else if (url.pathname === '/api/verify-payment') {
    verificationRequests.push({ body: JSON.parse(request.postData()), authorization: request.headers().authorization })
    payload = { success: true, credits_added: 180 }
  } else if (url.pathname === '/api/editor-preferences/load') payload.preferences = { revision: 0, brand_kits: [], glossary_terms: [] }
  else if (url.pathname === '/api/editor-preferences/save') payload.preferences = { revision: 1, brand_kits: [], glossary_terms: [] }
  else if (url.pathname === '/api/draft/load') payload = { revision: 0, draft: null }
  else if (url.pathname === '/api/projects/list') payload.projects = []
  else if (url.pathname === '/api/workspaces') payload.workspaces = []
  else if (url.pathname === '/api/projects/save' || url.pathname === '/api/draft/save') {
    savedDraft = JSON.parse(request.postData()).draft
    payload = conflict ? { detail: 'A newer project revision was saved on another tab or device.' } : { success: true, draft: savedDraft, revision: 1, project_id: 'test-project' }
    status = conflict ? 409 : 200
  } else if (url.pathname === '/api/media/upload-url') { status = 404; payload = { detail: 'Source expired' } }
  else if (url.pathname === '/api/export') { exports += 1; exportPayload = JSON.parse(request.postData()); payload = { success: true, export_job_id: 'job-1', status: 'queued' } }
  else if (url.pathname === '/api/export-status/job-1') payload = { status: 'completed', progress: 100 }
  else if (url.pathname === '/api/export-result/job-1') payload = { success: true, video_url: '/api/test-download' }
  else if (url.pathname === '/api/test-download') { downloads += 1; return request.respond({ status: 200, contentType: 'video/mp4', body: Buffer.from('local-test-download') }) }
  else if (url.pathname === '/api/fonts') payload = { fonts: [] }
  else if (url.pathname.includes('analytics')) payload = { success: true }
  else { status = 404; payload = { detail: `Unexpected local test API: ${url.pathname}` } }
  return request.respond({ status, contentType: 'application/json', body: JSON.stringify(payload) })
})
const textClick = async (text) => {
  await page.waitForFunction((label) => [...document.querySelectorAll('button,summary')].some((el) => el.textContent.trim() === label), {}, text)
  await page.evaluate((label) => [...document.querySelectorAll('button,summary')].find((el) => el.textContent.trim() === label).click(), text)
}
try {
  await page.goto('http://127.0.0.1:4187/e2e/fixtures/editor.html')
  await page.evaluate((value) => localStorage.setItem('captionEditorState', JSON.stringify(value)), draft)
  await page.goto('http://127.0.0.1:4187/e2e/fixtures/editor.html?restoreSession=1')
  await page.waitForSelector('[data-caption-editor="true"]')
  await page.waitForSelector('input[aria-label="Relink source video"]')
  await page.keyboard.down('Control'); await page.keyboard.press('k'); await page.keyboard.up('Control')
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Search transcript')
  // VideoPlayer is a lazy chunk; on a cold CI dev server it mounts after the caption editor.
  await page.waitForSelector('.lekha-video-frame', { timeout: 60000 })
  const frame = await page.$eval('.lekha-video-frame', (el) => ({ width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height }))
  assert.ok(frame.width > 100 && frame.height > frame.width, JSON.stringify(frame))
  await page.setViewport({ width: 390, height: 844 })
  const mobileFrame = await page.$eval('.lekha-video-frame', (el) => ({
    left: el.getBoundingClientRect().left,
    right: el.getBoundingClientRect().right,
    width: el.getBoundingClientRect().width,
    height: el.getBoundingClientRect().height,
  }))
  assert.ok(mobileFrame.width > 100 && mobileFrame.left >= -1 && mobileFrame.right <= 391, JSON.stringify(mobileFrame))
  assert.ok(mobileFrame.height > mobileFrame.width, JSON.stringify(mobileFrame))
  await page.setViewport({ width: 1440, height: 1100 })
  // Correct a caption through React before checking persistence.
  await page.click('[data-caption-card]')
  await page.click('[title="Edit caption"]')
  await page.waitForSelector('textarea[data-caption-id]')
  await page.focus('textarea[data-caption-id]')
  await page.keyboard.down('Control'); await page.keyboard.press('a'); await page.keyboard.up('Control')
  await page.keyboard.type('hello corrected world')
  await textClick('Save')
  await page.waitForFunction(() => document.body.textContent.includes('Saved'))
  assert.equal(savedDraft.captions[0].text, 'hello corrected world')
  assert.equal(savedDraft.captions[0].start_time, 0)
  assert.equal(savedDraft.captions[0].end_time, 3)
  conflict = true
  await textClick('Save')
  await page.waitForFunction(() => document.body.textContent.includes('newer project revision'))
  await page.goto('http://127.0.0.1:4187/e2e/fixtures/editor.html?restoreSession=1')
  await page.waitForSelector('.lekha-video-frame')
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('captionEditorState')).captionTracks[0].captions[0].text), 'hello corrected world')
  await textClick('Export')
  await page.waitForFunction(() => document.body.textContent.includes('Export your video'))
  assert.equal(exports, 0, 'opening export after recovery cannot submit another render')
  assert.equal(exportPayload, null)
  await textClick('Close')
  await page.waitForFunction(() => !document.querySelector('[role=dialog]'))
  // A stored accepted job must reconnect even when its source has expired.
  await page.evaluate((fileId) => localStorage.setItem(`lekha.activeExport.editor-test-a.${fileId}`, JSON.stringify({ jobId: 'job-1', fileId, originalFileName: 'fixture.mp4', quality: '720p', createdAt: Date.now() })), draft.fileId)
  await textClick('Export')
  await textClick('Resume')
  await page.waitForFunction(() => document.body.textContent.includes('Export complete'))
  assert.equal(downloads, 1, 'resume must fetch the full existing output')
  assert.equal(exports, 0, 'resume must not submit or charge another render')
  await textClick('Close')
  await page.waitForFunction(() => !document.querySelector('[role=dialog]'))
  await page.evaluate(() => window.switchTestAccount('editor-test-b'))
  await page.waitForFunction(() => !document.querySelector('[data-caption-editor="true"]'))
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('captionEditorState') || '{}').ownerUid === 'editor-test-b' && JSON.parse(localStorage.getItem('captionEditorState')).captions?.length > 0), false, 'account changes cannot acquire another account’s draft')
  // Real browser File/XHR/localStorage; only the storage service is doubled.
  const startUpload = async () => page.evaluate(async () => {
    const { uploadFileWithRecovery } = await import('/src/lib/resilientUpload.js')
    const file = new File([new Uint8Array(16 * 1024 * 1024)], 'recovery.mp4', { type: 'video/mp4', lastModified: 1000 })
    try {
      window.uploadResult = await uploadFileWithRecovery(file, { authorization: 'local-test-token', retryDelaysMs: [] })
    } catch { window.uploadInterrupted = true }
  })
  await startUpload()
  assert.ok(interruptedChunk)
  assert.equal(uploadOffset, chunkBytes)
  assert.ok(await page.evaluate(() => localStorage.getItem('lekha.pendingDirectUpload.v1')))
  await page.reload()
  recoveringUpload = true
  await startUpload()
  assert.equal(uploadInitializations, 1, 'reload must not initialize another upload')
  assert.equal(uploadResumes, 1)
  assert.ok(uploadRanges.includes(`bytes */${chunkBytes * 2}`))
  assert.equal(uploadRanges.at(-1), `bytes ${chunkBytes}-${chunkBytes * 2 - 1}/${chunkBytes * 2}`)
  assert.equal(await page.evaluate(() => window.uploadResult.file_id), draft.fileId)
  assert.equal(await page.evaluate(() => localStorage.getItem('lekha.pendingDirectUpload.v1')), null)

  // Real pricing UI with a Razorpay double; external requests remain blocked.
  await page.evaluateOnNewDocument(() => {
    window.checkoutOptions = null
    window.checkoutOpens = 0
    window.Razorpay = class {
      constructor(options) {
        if (!options.key.startsWith('rzp_test_')) throw new Error('Live checkout refused')
        window.checkoutOptions = options
      }
      on() {}
      open() { window.checkoutOpens += 1 }
    }
  })
  await page.goto('http://127.0.0.1:4187/e2e/fixtures/editor.html?testView=payment')
  await textClick('Get Starter')
  await page.waitForFunction(() => window.checkoutOpens === 1)
  const order = orderRequests.at(-1)
  assert.equal(order.authorization, 'Bearer local-test-token')
  assert.equal(order.body.plan_id, 'starter_yearly')
  assert.ok(order.body.idempotency_key)
  assert.equal(await page.evaluate(() => window.checkoutOptions.amount), 299000)
  await page.evaluate(() => window.checkoutOptions.modal.ondismiss())
  assert.equal(verificationRequests.length, 0, 'dismissal must not grant credits')
  await textClick('Open test checkout')
  await textClick('Get Starter')
  await page.waitForFunction(() => window.checkoutOpens === 2)
  await page.evaluate(() => window.checkoutOptions.handler({ razorpay_order_id: 'order_local_fixture', razorpay_payment_id: 'pay_local_fixture', razorpay_signature: 'fixture-signature' }))
  assert.equal(verificationRequests.length, 1)
  assert.equal(verificationRequests[0].authorization, 'Bearer local-test-token')
  assert.equal(verificationRequests[0].body.idempotency_key, orderRequests.at(-1).body.idempotency_key)
  assert.equal(verificationRequests[0].body.plan_id, 'starter_yearly')
  invalidOrder = true
  await textClick('Open test checkout')
  await textClick('Get Starter')
  await page.waitForFunction(() => document.body.textContent.includes('invalid amount or currency'))
  assert.equal(await page.evaluate(() => window.checkoutOpens), 2, 'invalid orders cannot open checkout')
  assert.deepEqual(errors, [])
  console.log('Local editor journey passed: correction, save/reload, export recovery, account isolation, interrupted upload resume and mocked checkout (dismissal, verification, invalid order).')
} catch (error) {
  console.error('Editor test diagnostics:', errors, await page.evaluate(() => document.body.innerText.slice(0, 3500)))
  throw error
} finally {
  await browser.close()
  await server.close()
}
