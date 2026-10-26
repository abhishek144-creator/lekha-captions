import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import puppeteer from 'puppeteer'

// Real Dashboard and upload window with isolated auth and API doubles: the
// upload starts on file pick, the storage link is never downloaded for
// playback, refusals stop before any bytes move, and an abandoned upload is
// deleted. No credentials, provider requests, charges or production writes.
const port = 4188
const origin = `http://127.0.0.1:${port}`
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
  server: { host: '127.0.0.1', port, strictPort: true },
})
await server.listen()
const browser = await puppeteer.launch({ headless: true, args: process.env.CI ? ['--no-sandbox'] : [] })
const workDir = await mkdtemp(join(tmpdir(), 'lekha-upload-journey-'))
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 1100 })
const errors = []
page.on('pageerror', (error) => errors.push(error.message))

let fileId = '123e4567-e89b-12d3-a456-426614174111'
let calls = []
let refuseInit = false
let holdProcessing = false
let failProcessing = false
let pendingProcess = null
const savedProjects = new Map()
const caption = { text: 'hello bright world', start_time: 0, end_time: 1, words: [{ word: 'hello', start: 0, end: 0.3 }, { word: 'bright', start: 0.3, end: 0.6 }, { word: 'world', start: 0.6, end: 1 }] }

await page.setRequestInterception(true)
page.on('request', async (request) => {
  const url = new URL(request.url())
  if (url.hostname !== '127.0.0.1' && !['data:', 'blob:'].includes(url.protocol)) return request.abort()
  const body = request.postData()
  calls.push({ method: request.method(), path: url.pathname, body: body && body.startsWith('{') ? JSON.parse(body) : null })
  if (url.pathname === '/test-storage-session') return request.respond({ status: 200, contentType: 'application/json', body: '{}' })
  if (!url.pathname.startsWith('/api/')) return request.continue()
  let payload = { success: true }
  let status = 200
  if (url.pathname === '/api/uploads/init') {
    if (refuseInit) { status = 403; payload = { detail: 'Your plan allows videos up to 120s. This video is 170s long.' } }
    else payload = { success: true, direct_upload_available: true, file_id: fileId, upload_url: `${origin}/test-storage-session`, expires_at: 'later' }
  } else if (url.pathname === '/api/uploads/complete') payload = { success: true, file_id: fileId, upload_state: 'pending_scan', raw_url: `/api/media/upload/${fileId}?token=t` }
  else if (url.pathname === '/api/uploads/discard') payload = { success: true, file_id: fileId }
  else if (url.pathname === '/api/process') {
    if (holdProcessing) { pendingProcess = request; return }
    if (failProcessing) { status = 422; payload = { detail: 'Fixture transcription refused' } }
    else payload = { success: true, captions: [caption], detected_language: 'english' }
  }
  else if (url.pathname === '/api/editor-preferences/load') payload.preferences = { revision: 0, brand_kits: [], glossary_terms: [] }
  else if (url.pathname === '/api/editor-preferences/save') payload.preferences = { revision: 1, brand_kits: [], glossary_terms: [] }
  else if (url.pathname === '/api/draft/load') payload = { revision: 0, draft: null }
  else if (url.pathname === '/api/draft/save' || url.pathname === '/api/projects/save') {
    const submitted = JSON.parse(body)
    const projectId = submitted.project_id || 'current'
    savedProjects.set(projectId, submitted.draft)
    payload = { success: true, revision: 1, project_id: projectId, draft: submitted.draft }
  }
  else if (url.pathname === '/api/projects/list') payload.projects = []
  else if (url.pathname === '/api/workspaces') payload.workspaces = []
  else if (url.pathname === '/api/fonts') payload = { fonts: [] }
  else if (url.pathname.includes('analytics')) payload = { success: true }
  else { status = 404; payload = { detail: `Unexpected local test API: ${url.pathname}` } }
  return request.respond({ status, contentType: 'application/json', body: JSON.stringify(payload) })
})

const called = (path) => calls.filter((call) => call.path === path)
const textClick = async (text) => {
  await page.waitForFunction((label) => [...document.querySelectorAll('button')].some((el) => el.textContent.trim() === label), {}, text)
  await page.evaluate((label) => [...document.querySelectorAll('button')].find((el) => el.textContent.trim() === label).click(), text)
}
const openUploadWindow = async () => {
  await page.goto(`${origin}/e2e/fixtures/editor.html`)
  await page.evaluate(() => localStorage.clear())
  await page.goto(`${origin}/e2e/fixtures/editor.html`)
  await textClick('Upload Video')
  await page.waitForSelector('[role=dialog] input[type=file]')
}
const pickFile = async (path) => {
  const input = await page.$('[role=dialog] input[type=file]')
  await input.uploadFile(path)
}

try {
  // A short, genuinely playable clip so the browser can read its length and play it.
  await page.goto(`${origin}/e2e/fixtures/editor.html`)
  const clip = await page.evaluate(async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 64; canvas.height = 112
    const context = canvas.getContext('2d')
    const recorder = new MediaRecorder(canvas.captureStream(10), { mimeType: 'video/webm' })
    const chunks = []
    recorder.ondataavailable = (event) => chunks.push(event.data)
    let frame = 0
    const timer = setInterval(() => { context.fillStyle = frame++ % 2 ? '#c23660' : '#2f6fc4'; context.fillRect(0, 0, 64, 112) }, 100)
    recorder.start()
    await new Promise((done) => setTimeout(done, 1200))
    recorder.stop()
    await new Promise((done) => { recorder.onstop = done })
    clearInterval(timer)
    const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer())
    let binary = ''
    bytes.forEach((value) => { binary += String.fromCharCode(value) })
    return btoa(binary)
  })
  const clipPath = join(workDir, 'fixture.webm')
  await writeFile(clipPath, Buffer.from(clip, 'base64'))

  // 1. The upload starts on file pick and finishes before Generate is pressed.
  await openUploadWindow()
  calls = []
  await pickFile(clipPath)
  await page.waitForFunction(() => document.body.textContent.includes('Generate Captions'))
  for (let wait = 0; wait < 100 && !called('/api/uploads/complete').length; wait += 1) await new Promise((done) => setTimeout(done, 100))
  assert.equal(called('/api/uploads/complete').length, 1, 'the upload finishes while settings are chosen')
  const declared = called('/api/uploads/init')[0].body.duration_seconds
  assert.ok(declared > 0 && declared < 5, `the browser declares the clip length to the server (got ${declared})`)
  assert.ok(called('/test-storage-session').some((call) => call.method === 'PUT'), 'bytes go straight to storage')
  assert.equal(called('/api/process').length, 0, 'nothing is transcribed before Generate')
  assert.equal(await page.$eval('[aria-label="Speech focus"]', select => select.value), 'main')

  await textClick('Generate Captions')
  await page.waitForFunction((text) => document.body.textContent.includes(text), { timeout: 60000 }, caption.text)
  assert.equal(called('/api/uploads/init').length, 1, 'Generate reuses the upload instead of starting another')
  assert.equal(called('/api/process')[0].body.language, 'auto')
  assert.equal(called('/api/process')[0].body.speech_focus, 'main')
  await page.waitForSelector('video', { timeout: 60000 })
  await page.waitForFunction(() => document.querySelector('video')?.readyState >= 1, { timeout: 30000 })
  assert.match(await page.$eval('video', (video) => video.currentSrc || video.src), /^blob:/, 'the editor plays the file from the device')
  assert.equal(calls.filter((call) => call.path.startsWith('/api/media/upload/')).length, 0, 'playback never downloads the storage copy')
  assert.equal(called('/api/uploads/discard').length, 0, 'a used upload is never discarded')
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('captionEditorState') || '{}').videoUrl || ''), `/api/media/upload/${fileId}?token=t`, 'saved drafts keep the storage link, not the device-only link')

  // A replacement must not attach its media to the previous account project
  // while the provider is still processing. Wait beyond the autosave debounce.
  for (let wait = 0; wait < 100 && !savedProjects.size; wait += 1) await new Promise((done) => setTimeout(done, 100))
  assert.equal(savedProjects.size, 1, 'the original project has an account copy')
  const [previousId, previousDraft] = [...savedProjects][0]
  const previousJson = JSON.stringify(previousDraft)
  fileId = '123e4567-e89b-12d3-a456-426614174222'
  holdProcessing = true
  await textClick('Upload New')
  await page.waitForSelector('[role=dialog] input[type=file]')
  await pickFile(clipPath)
  await page.waitForFunction(() => document.body.textContent.includes('Generate Captions'))
  await page.select('[aria-label="Speech focus"]', 'all')
  calls = []
  await textClick('Generate Captions')
  for (let wait = 0; wait < 100 && !pendingProcess; wait += 1) await new Promise((done) => setTimeout(done, 100))
  assert.ok(pendingProcess, 'replacement transcription is held open')
  assert.equal(called('/api/process')[0].body.speech_focus, 'all', 'all-voices choice reaches the transcription job')
  await new Promise((done) => setTimeout(done, 3500))
  assert.equal(JSON.stringify(savedProjects.get(previousId)), previousJson, 'pending replacement preserves the previous cloud project')
  assert.equal(called('/api/draft/save').filter((call) => call.body.project_id === previousId).length, 0, 'no replacement request writes under the old project ID')
  holdProcessing = false
  await pendingProcess.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, captions: [caption], detected_language: 'english' }) })
  pendingProcess = null
  for (let wait = 0; wait < 200 && savedProjects.size < 2; wait += 1) await new Promise((done) => setTimeout(done, 100))
  assert.equal(savedProjects.size, 2, 'replacement saves as a separate account project')
  assert.equal(JSON.stringify(savedProjects.get(previousId)), previousJson)
  assert.equal([...savedProjects.values()].find((draft) => draft.fileId === fileId)?.captions.length, 1)

  const completedProjects = [...savedProjects].map(([id, draft]) => [id, JSON.stringify(draft)])
  const completedMedia = fileId
  // Refusing a replacement before acceptance leaves the open project intact.
  await textClick('Upload New')
  await page.waitForSelector('[role=dialog] input[type=file]')
  calls = []
  refuseInit = true
  await pickFile(clipPath)
  await page.waitForFunction(() => document.body.textContent.includes('Your plan allows videos up to 120s'))
  assert.equal(called('/test-storage-session').length, 0, 'no bytes move after a plan refusal')
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('captionEditorState')).fileId), completedMedia)
  await page.keyboard.press('Escape')
  refuseInit = false

  // A provider failure after acceptance keeps a separate, retryable project;
  // neither of the completed cloud projects may acquire the failed media.
  fileId = '123e4567-e89b-12d3-a456-426614174333'
  failProcessing = true
  await textClick('Upload New')
  await page.waitForSelector('[role=dialog] input[type=file]')
  await pickFile(clipPath)
  await page.waitForFunction(() => document.body.textContent.includes('Generate Captions'))
  const failedGenerateAt = Date.now()
  await textClick('Generate Captions')
  await page.waitForFunction(() => document.body.textContent.includes('Fixture transcription refused'), { timeout: 60000 })
  await page.waitForFunction(() => !document.querySelector('[data-target-percent]'), { timeout: 15000 })
  const failedScreenMs = Date.now() - failedGenerateAt
  assert.ok(failedScreenMs < 6000, `a failed transcription closes the generating screen at once (took ${failedScreenMs} ms)`)
  for (let wait = 0; wait < 200 && ![...savedProjects.values()].some((draft) => draft.fileId === fileId); wait += 1) await new Promise((done) => setTimeout(done, 100))
  for (const [id, json] of completedProjects) assert.equal(JSON.stringify(savedProjects.get(id)), json, 'failed/refused replacement preserves each completed account project')
  const failedDraft = [...savedProjects.values()].find((draft) => draft.fileId === fileId)
  assert.ok(failedDraft, 'accepted video remains saved for transcription retry')
  assert.deepEqual(failedDraft.captions, [], 'failed replacement never inherits the preceding captions')
  failProcessing = false

  // Closing the window before Generate deletes the finished upload.
  await openUploadWindow()
  calls = []
  await pickFile(clipPath)
  for (let wait = 0; wait < 100 && !called('/api/uploads/complete').length; wait += 1) await new Promise((done) => setTimeout(done, 100))
  await page.keyboard.press('Escape')
  for (let wait = 0; wait < 50 && !called('/api/uploads/discard').length; wait += 1) await new Promise((done) => setTimeout(done, 100))
  assert.deepEqual(called('/api/uploads/discard').map((call) => call.body.file_id), [fileId], 'an abandoned upload is deleted')
  assert.equal(called('/api/process').length, 0)

  // A plan refusal stops before any bytes move and explains why.
  await openUploadWindow()
  calls = []
  refuseInit = true
  await pickFile(clipPath)
  await page.waitForFunction(() => document.body.textContent.includes('Your plan allows videos up to 120s'))
  assert.equal(called('/test-storage-session').length, 0, 'no bytes are uploaded after a refusal')
  assert.equal(called('/api/uploads/complete').length, 0)
  refuseInit = false

  assert.deepEqual(errors, [])
  console.log('Local upload journey passed: upload reuse, device playback, delayed/failed/refused replacements preserve cloud projects, abandoned-upload deletion and early plan refusal.')
} catch (error) {
  console.error('Upload journey diagnostics:', errors, calls.map((call) => `${call.method} ${call.path}`).slice(-30), await page.evaluate(() => document.body.innerText.slice(0, 2500)))
  throw error
} finally {
  await browser.close()
  await server.close()
  await rm(workDir, { recursive: true, force: true })
}
