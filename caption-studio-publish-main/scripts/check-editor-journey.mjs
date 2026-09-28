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
let preferenceRevision = 0
let preferenceRequests = 0
let savedGlossary = []
let releaseFirstPreferenceSave = null
const caption = { id: 'a', text: 'hello bright world', start_time: 0, end_time: 3, words: [{ word: 'hello', start: 0, end: 1 }, { word: 'bright', start: 1, end: 2 }, { word: 'world', start: 2, end: 3 }], wordStyles: {} }
const draft = { ownerUid: 'editor-test-a', projectId: 'test-project', fileId: '123e4567-e89b-12d3-a456-426614174000', videoUrl: '', duration: 4, originalFileName: 'fixture.mp4', captions: [caption], captionTracks: [{ id: 'source', label: 'Original', captions: [caption] }, { id: 'hi', label: 'Hindi', captions: [{ ...caption, text: 'नमस्ते दुनिया', words: [] }] }], activeCaptionTrackId: 'source', captionStyle: { font_family: 'Inter', font_size: 17, position_y: 70, text_color: '#ffffff', has_background: true }, settings: {} }
await page.setRequestInterception(true)
page.on('request', async (request) => {
  const url = new URL(request.url())
  if (url.hostname !== '127.0.0.1' && !['data:', 'blob:'].includes(url.protocol)) return request.abort()
  if (!url.pathname.startsWith('/api/')) return request.continue()
  let payload = { success: true }
  let status = 200
  if (url.pathname === '/api/editor-preferences/load') payload.preferences = { revision: 0, brand_kits: [], glossary_terms: [] }
  else if (url.pathname === '/api/editor-preferences/save') {
    const body = JSON.parse(request.postData())
    if (preferenceRequests++ === 0) await new Promise((resolve) => { releaseFirstPreferenceSave = resolve })
    assert.equal(body.expected_revision, preferenceRevision, 'preference saves must use the latest server revision')
    preferenceRevision += 1
    savedGlossary = body.glossary_terms
    payload.preferences = { revision: preferenceRevision, brand_kits: body.brand_kits, glossary_terms: savedGlossary }
  }
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
  await page.reload()
  await textClick('Continue draft')
  await page.waitForSelector('[data-caption-editor="true"]')
  await page.waitForSelector('input[aria-label="Relink source video"]')
  await textClick('Account glossary')
  await page.type('input[aria-label="Incorrect or source term"]', 'Lekha')
  await page.type('input[aria-label="Preferred glossary term"]', 'लेखा')
  await textClick('Save term')
  for (let attempt = 0; attempt < 40 && !releaseFirstPreferenceSave; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  assert.ok(releaseFirstPreferenceSave, 'first preference save should be in flight')
  await page.type('input[aria-label="Incorrect or source term"]', 'caption')
  await page.type('input[aria-label="Preferred glossary term"]', 'subtitle')
  await textClick('Save term')
  releaseFirstPreferenceSave()
  await page.waitForFunction(() => document.body.textContent.includes('Glossary is synced'))
  assert.equal(preferenceRequests, 2, 'the in-flight edit must trigger a second revisioned save')
  assert.deepEqual(savedGlossary.map((term) => term.source), ['caption', 'Lekha'])
  await page.keyboard.down('Control'); await page.keyboard.press('k'); await page.keyboard.up('Control')
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Search transcript')
  await textClick('Frame, bilingual captions and safe area')
  await textClick('1:1 Square')
  await page.select('select[aria-label="Framing"]', 'contain')
  await page.select('select[aria-label="Bilingual output"]', 'hi')
  await page.waitForFunction(() => document.querySelector('[data-text-element-layer]')?.textContent.includes('नमस्ते'))
  const frame = await page.$eval('.lekha-video-frame', (el) => ({ width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height }))
  assert.ok(frame.width > 100 && Math.abs(frame.width - frame.height) < 2, JSON.stringify(frame))
  await page.setViewport({ width: 390, height: 844 })
  const mobileFrame = await page.$eval('.lekha-video-frame', (el) => ({
    left: el.getBoundingClientRect().left,
    right: el.getBoundingClientRect().right,
    width: el.getBoundingClientRect().width,
    height: el.getBoundingClientRect().height,
  }))
  assert.ok(mobileFrame.width > 100 && mobileFrame.left >= -1 && mobileFrame.right <= 391, JSON.stringify(mobileFrame))
  assert.ok(Math.abs(mobileFrame.width - mobileFrame.height) < 2, JSON.stringify(mobileFrame))
  await page.setViewport({ width: 1440, height: 1100 })
  await textClick('Save')
  await page.waitForFunction(() => document.body.textContent.includes('Saved'))
  assert.equal(savedDraft.captionStyle.frame_fit, 'contain')
  assert.equal(savedDraft.captionStyle.bilingual_track_id, 'hi')
  conflict = true
  await textClick('16:9')
  await textClick('Save')
  await page.waitForFunction(() => document.body.textContent.includes('newer project revision'))
  await page.reload()
  await textClick('Continue draft')
  await page.waitForFunction(() => document.querySelector('.lekha-video-frame')?.style.aspectRatio === '16 / 9')
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('captionEditorState')).captionTracks[0].captions[0].text), caption.text)
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
  assert.deepEqual(errors, [])
  console.log('Local editor journey passed: recovery, keyboard search, geometry, bilingual preview, revision conflict, reload and account isolation.')
} catch (error) {
  console.error('Editor test diagnostics:', errors, await page.evaluate(() => document.body.innerText.slice(0, 3500)))
  throw error
} finally {
  await browser.close()
  await server.close()
}
