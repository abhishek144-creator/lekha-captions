import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import fs from 'node:fs/promises'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import puppeteer from 'puppeteer'
import planCatalog from '../shared/planCatalog.json' with { type: 'json' }

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
const downloadRoot = resolve('test-artifacts/editor-downloads')
await fs.mkdir(downloadRoot, { recursive: true })
const downloadPath = await fs.mkdtemp(resolve(downloadRoot, 'run-'))
const downloadSession = await browser.target().createCDPSession()
await downloadSession.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath, eventsEnabled: true })
await page.setViewport({ width: 1440, height: 1100 })
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
// Every editor control needs an accessible name for screen-reader users.
const axeSource = await fs.readFile(resolve('node_modules/axe-core/axe.min.js'), 'utf8')
const CONTROL_NAME_RULES = ['button-name', 'aria-input-field-name', 'aria-toggle-field-name', 'aria-command-name', 'input-button-name', 'label', 'link-name', 'select-name']
async function unnamedControls() {
  await page.evaluate(axeSource)
  return page.evaluate(async (rules) => {
    const result = await window.axe.run(document, { runOnly: { type: 'rule', values: rules } })
    return result.violations.map((violation) => ({ rule: violation.id, nodes: violation.nodes.map((node) => `${node.target.join(' ')} ${node.html.slice(0, 160)}`).slice(0, 8) }))
  }, CONTROL_NAME_RULES)
}
let savedDraft = null
let accountRecovery = false
let recoveryMediaDuration = 0
let restoredMediaRequests = 0
let holdRecoveryMedia = false
let pendingRecoveryMedia = null
let expiredAccountMedia = false
let conflict = true
let saveRequests = 0
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
const translationRequests = []
const emotionRequests = []
let emotionMode = 'ok'
let recoveringUpload = false
const uploadRanges = []
const chunkBytes = 8 * 1024 * 1024
const caption = { id: 'a', text: 'hello bright world', start_time: 0, end_time: 3, words: [{ word: 'hello', start: 0, end: 1 }, { word: 'bright', start: 1, end: 2 }, { word: 'world', start: 2, end: 3 }], wordStyles: {} }
const draft = { ownerUid: 'editor-test-a', projectId: 'test-project', fileId: '123e4567-e89b-12d3-a456-426614174000', videoUrl: '', duration: 4, originalFileName: 'fixture.mp4', captions: [caption], captionTracks: [{ id: 'source', label: 'Original', captions: [caption] }, { id: 'hi', label: 'Hindi', captions: [{ ...caption, text: 'नमस्ते दुनिया', words: [] }] }], activeCaptionTrackId: 'source', captionStyle: { font_family: 'Inter', font_size: 17, position_y: 70, text_color: '#ffffff', has_background: true }, settings: {} }
await page.setRequestInterception(true)
page.on('request', async (request) => {
  const url = new URL(request.url())
  if (url.hostname === 'media.example.invalid' && url.pathname === '/exports/test-output.mp4') {
    assert.equal(request.headers()['origin'], undefined, 'browser download navigation needs no CORS Origin')
    assert.equal(request.headers()['referer'], undefined, 'signed download navigation must not disclose the editor URL')
    assert.equal(request.headers()['authorization'], undefined, 'signed media must not send Firebase credentials to R2')
    assert.equal(request.headers()['x-firebase-appcheck'], undefined, 'signed media must not forward App Check headers to R2')
    assert.equal(request.headers()['x-request-id'], undefined, 'signed media must avoid custom-header CORS preflights')
    assert.equal(request.isNavigationRequest(), true, 'MP4 downloads must use browser navigation, not fetch and Blob')
    downloads += 1
    return request.respond({ status: 200, headers: { 'Content-Disposition': 'attachment; filename="fixture_captioned.mp4"' }, contentType: 'video/mp4', body: Buffer.from('local-test-download') })
  }
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
    const orderBody = JSON.parse(request.postData())
    orderRequests.push({ body: orderBody, authorization: request.headers().authorization })
    const currency = orderBody.currency || 'INR'
    const catalogAmount = planCatalog[orderBody.plan_id]?.[currency === 'USD' ? 'usd_cents' : 'inr_paise']
    payload = { success: true, key_id: 'rzp_test_local_fixture', order: { id: 'order_local_fixture', amount: invalidOrder ? -1 : catalogAmount, currency } }
  } else if (url.pathname === '/api/verify-payment') {
    verificationRequests.push({ body: JSON.parse(request.postData()), authorization: request.headers().authorization })
    payload = { success: true, credits_added: 180 }
  } else if (url.pathname === '/api/editor-preferences/load') payload.preferences = { revision: 0, brand_kits: [], glossary_terms: [] }
  else if (url.pathname === '/api/editor-preferences/save') payload.preferences = { revision: 1, brand_kits: [], glossary_terms: [] }
  else if (url.pathname === '/api/draft/load') payload = accountRecovery
    ? { revision: 1, project_id: 'test-project', draft: { ...draft, videoUrl: '', duration: recoveryMediaDuration, projectId: 'test-project', captions: [{ ...draft.captions[0], text: 'cloud recovery caption' }], captionTracks: [] } }
    : { revision: 17, project_id: 'other-project', draft: null }
  else if (url.pathname === '/api/projects/list') payload.projects = []
  else if (url.pathname === '/api/workspaces') payload.workspaces = []
  else if (url.pathname === '/api/projects/save' || url.pathname === '/api/draft/save') {
    saveRequests += 1
    const saveBody = JSON.parse(request.postData())
    if (saveRequests === 1) assert.equal(saveBody.expected_revision, 0, 'a different project must not inherit another project revision')
    savedDraft = saveBody.draft
    payload = conflict ? { detail: 'A newer project revision was saved on another tab or device.' } : { success: true, draft: savedDraft, revision: 1, project_id: 'test-project' }
    status = conflict ? 409 : 200
  } else if (url.pathname === '/api/media/upload-url') {
    if (accountRecovery) {
      const mediaRequest = JSON.parse(request.postData())
      assert.equal(mediaRequest.file_id, draft.fileId)
      assert.equal(mediaRequest.id_token, 'local-test-token')
      restoredMediaRequests += 1
      if (holdRecoveryMedia) { pendingRecoveryMedia = request; return }
      if (expiredAccountMedia) { status = 404; payload = { detail: 'Source expired' } }
      else payload = { success: true, raw_url: '/launch-video.mp4' }
    } else { status = 404; payload = { detail: 'Source expired' } }
  }
  else if (url.pathname === '/api/export') { exports += 1; exportPayload = JSON.parse(request.postData()); payload = { success: true, export_job_id: 'job-1', status: 'queued' } }
  else if (url.pathname === '/api/export-status/job-1') payload = { status: 'completed', progress: 100 }
  else if (url.pathname === '/api/export-result/job-1') payload = { success: true, video_url: '/api/media/export/redirect-must-not-be-followed.mp4?token=local-media-signature', download_url: 'https://media.example.invalid/exports/test-output.mp4?signature=local-test-signature' }
  else if (url.pathname === '/api/fonts') payload = { fonts: [] }
  else if (url.pathname === '/api/translate') {
    const submitted = JSON.parse(request.postData())
    translationRequests.push(submitted)
    payload = { success: true, captions: submitted.captions.map((item) => ({ id: item.id, text: `translated ${item.id}` })) }
  }
  else if (url.pathname === '/api/caption-emotions') {
    const submitted = JSON.parse(request.postData())
    emotionRequests.push(submitted)
    if (emotionMode === 'fail') {
      status = 502
      payload = { detail: 'Smart layout analysis failed. Please retry.' }
    } else {
      payload = {
        success: true,
        cached: false,
        lines: submitted.lines.map((line) => (line.id === 'mood-2'
          ? { id: line.id, type: 'punchline', emotion: 'surprise', intensity: 0.95, keywords: [1] }
          : { id: line.id, type: 'narration', emotion: 'neutral', intensity: 0.2, keywords: [] })),
      }
    }
  }
  else if (url.pathname.includes('analytics')) payload = { success: true }
  else { status = 404; payload = { detail: `Unexpected local test API: ${url.pathname}` } }
  return request.respond({ status, contentType: 'application/json', body: JSON.stringify(payload) })
})
const textClick = async (text) => {
  await page.waitForFunction((label) => [...document.querySelectorAll('button,summary')].some((el) => el.textContent.trim() === label), {}, text)
  await page.evaluate((label) => [...document.querySelectorAll('button,summary')].find((el) => el.textContent.trim() === label).click(), text)
}
async function openSeededDraft(value) {
  // Seed after the previous document has flushed its draft on navigation.
  // Writing into the old page lets its pagehide save replace the new fixture.
  const seed = await page.evaluateOnNewDocument((nextDraft) => {
    localStorage.clear()
    localStorage.setItem('captionEditorState', JSON.stringify(nextDraft))
  }, value)
  try {
    await page.goto('http://127.0.0.1:4187/e2e/fixtures/editor.html?restoreSession=1')
  } finally {
    await page.removeScriptToEvaluateOnNewDocument(seed.identifier)
  }
  await page.waitForFunction((ids) => {
    const captions = JSON.parse(localStorage.getItem('captionEditorState') || '{}').captions || []
    return JSON.stringify(captions.map((item) => item.id)) === JSON.stringify(ids)
  }, {}, value.captions.map((item) => item.id))
}
try {
  await page.goto('http://127.0.0.1:4187/e2e/fixtures/editor.html')
  await page.evaluate((value) => localStorage.setItem('captionEditorState', JSON.stringify(value)), draft)
  await page.reload()
  await page.waitForFunction(() => document.body.textContent.includes('Continue saved draft'))
  assert.equal(saveRequests, 0, 'normal reload must preserve the draft without writing it')
  assert.equal(await page.evaluate(() => document.body.textContent.includes('Download draft backup')), true)
  await textClick('Continue saved draft')
  await page.waitForSelector('[data-caption-editor="true"]')
  await page.waitForSelector('input[aria-label="Relink source video"]')
  await new Promise((resolve) => setTimeout(resolve, 3000))
  assert.equal(saveRequests, 0, 'restoring a project must not save an unchanged revision')
  assert.deepEqual(await unnamedControls(), [], 'every editor control must have an accessible name')
  assert.equal(await page.evaluate(() => document.body.textContent.includes('A newer version of this project was saved')), false)
  conflict = false
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
  const autosaveResponse = page.waitForResponse((response) => response.url().endsWith('/api/draft/save') && response.status() === 200)
  await textClick('Add')
  await autosaveResponse
  assert.ok(saveRequests > 0, 'an actual caption edit must still autosave')
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
  const conflictResponse = page.waitForResponse((response) => response.url().endsWith('/api/draft/save') && response.status() === 409)
  await textClick('Save')
  await conflictResponse
  // The notice lasts five seconds; the stale-save protection outlives it.
  await page.waitForFunction(() => document.body.textContent.includes('A newer version of this project was saved'))
  const savesAfterConflict = saveRequests
  await textClick('Add')
  await new Promise((resolve) => setTimeout(resolve, 3500))
  assert.equal(saveRequests, savesAfterConflict, 'autosave must pause after a revision conflict instead of retrying a stale revision')
  assert.equal(await page.evaluate(() => document.body.textContent.includes('A newer version of this project was saved')), true, 'the conflict notice must remain visible before five seconds')
  await page.click('[aria-label="Close save conflict notification"]')
  await page.waitForFunction(() => !document.body.textContent.includes('A newer version of this project was saved'), { timeout: 3000 })
  await textClick('Add')
  await new Promise((resolve) => setTimeout(resolve, 3000))
  assert.equal(saveRequests, savesAfterConflict, 'dismissing the notice must not resume stale autosaves')
  assert.ok(JSON.parse(await page.evaluate(() => localStorage.getItem('captionEditorState'))).captions.length > draft.captions.length, 'edits after notice dismissal must stay in browser recovery')
  const repeatConflictResponse = page.waitForResponse((response) => response.url().endsWith('/api/draft/save') && response.status() === 409)
  await textClick('Save')
  await repeatConflictResponse
  await page.waitForFunction(() => document.body.textContent.includes('A newer version of this project was saved'))
  await page.waitForFunction(() => !document.body.textContent.includes('A newer version of this project was saved'), { timeout: 6000 })
  await page.goto('http://127.0.0.1:4187/e2e/fixtures/editor.html?restoreSession=1')
  await page.waitForSelector('.lekha-video-frame')
  const savesBeforeOpening = saveRequests
  await new Promise((resolve) => setTimeout(resolve, 3000))
  assert.equal(saveRequests, savesBeforeOpening, 'reopening a project must not submit a conflicting save')
  assert.equal(await page.evaluate(() => document.body.textContent.includes('A newer version of this project was saved')), false)
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('captionEditorState')).captionTracks[0].captions[0].text), 'hello corrected world')
  await page.evaluate(() => window.setTestEntitlement({ credits_remaining: 10, subscription_tier: 'pro', subscription_expiry: '2000-01-01' }))
  await textClick('Export')
  await page.waitForFunction(() => document.body.textContent.includes('Plan expired — renew to use video export'))
  await page.waitForFunction(() => document.body.textContent.includes('Plan expired — renew to render'))
  assert.deepEqual(await unnamedControls(), [], 'every export dialog control must have an accessible name')
  assert.equal(exports, 0, 'unused credits must not enable rendering after paid-plan expiry')
  await textClick('Close')
  await page.waitForFunction(() => !document.querySelector('[role=dialog]'))
  await page.evaluate(() => window.setTestEntitlement({ credits_remaining: 10, subscription_tier: 'pro', subscription_expiry: '2099-01-01' }))
  await textClick('Export')
  await page.waitForFunction(() => document.body.textContent.includes('Export your video'))
  assert.equal(exports, 0, 'opening export after recovery cannot submit another render')
  assert.equal(exportPayload, null)
  await textClick('Close')
  await page.waitForFunction(() => !document.querySelector('[role=dialog]'))
  // A stored accepted job must reconnect even when its source has expired.
  await page.evaluate((fileId) => localStorage.setItem(`lekha.activeExport.editor-test-a.${fileId}`, JSON.stringify({ jobId: 'job-1', fileId, originalFileName: 'fixture.mp4', quality: '720p', createdAt: Date.now() })), draft.fileId)
  await textClick('Export')
  assert.equal(await page.evaluate((fileId) => JSON.parse(localStorage.getItem(`lekha.activeExport.editor-test-a.${fileId}`)).completed === true, draft.fileId), false, 'opening Export cannot mark an active job completed')
  await textClick('Resume')
  await page.waitForFunction(() => document.body.textContent.includes('Download started'))
  assert.equal(exports, 0, 'resume must not submit or charge another render')
  await page.waitForFunction(() => document.body.textContent.includes('Download again'))
  assert.equal(await page.evaluate((fileId) => JSON.parse(localStorage.getItem(`lekha.activeExport.editor-test-a.${fileId}`)).completed, draft.fileId), true, 'a completed job retains a download recovery receipt')
  const downloadDeadline = Date.now() + 10000
  while (true) {
    try {
      assert.equal(await fs.readFile(resolve(downloadPath, 'fixture_captioned.mp4'), 'utf8'), 'local-test-download')
      break
    } catch (error) {
      if (Date.now() >= downloadDeadline) throw error
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }
  assert.equal(downloads, 1, 'resume hands the existing signed output to the browser download manager')
  await textClick('Close')
  await page.waitForFunction(() => !document.querySelector('[role=dialog]'))
  conflict = false
  await textClick('Text')
  await textClick('Add a text box')
  await page.waitForSelector('[data-text-element-layer="true"]')
  // Styling-panel edits apply to the selected text box, not the captions.
  const storedEditor = () => page.evaluate(() => JSON.parse(localStorage.getItem('captionEditorState')))
  const captionYBefore = (await storedEditor()).captionStyle.position_y
  await page.click('[role="slider"][aria-label="Vertical position"]')
  await page.keyboard.press('Home')
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('captionEditorState')).captions.some((item) => item.isTextElement && item.customStyle?.top === 5))
  assert.equal((await storedEditor()).captionStyle.position_y, captionYBefore, 'moving a selected text box must not move the captions')
  await page.mouse.move(10, 10)
  assert.equal(await page.$eval('[data-text-element-close="true"]', (button) => getComputedStyle(button).opacity), '1', 'a new text box needs a visible close button without hover')
  // Enter whole-box editing without selecting a word in the separate inspector.
  await page.$eval('[data-text-element-layer="true"]', (element) => element.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })))
  await page.waitForSelector('[data-text-element-layer="true"] [contenteditable="true"]')
  await page.click('[aria-label="Remove text box"]')
  await page.waitForFunction(() => !document.querySelector('[data-text-element-layer="true"]'))
  await page.waitForFunction(() => !JSON.parse(localStorage.getItem('captionEditorState')).captions.some((item) => item.isTextElement))
  await page.click('button[title="Undo"]')
  await page.waitForSelector('[data-text-element-layer="true"]')
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('captionEditorState')).captions.some((item) => item.isTextElement))
  // A new text box spans the block under the playhead (the caption shown, or
  // 3 s) and never the rest of the video, and text typed into it is kept when
  // playback starts while the box is still being edited (it used to be lost:
  // the edit only saved on blur, and the box left the screen).
  {
    const stored = JSON.parse(await page.evaluate(() => localStorage.getItem('captionEditorState')))
    const box = stored.captions.find((item) => item.isTextElement)
    const videoDuration = await page.evaluate(() => document.querySelector('.lekha-video-frame video')?.duration || 0)
    const block = stored.captions.find((item) => !item.isTextElement && box.start_time >= item.start_time && box.start_time < item.end_time)
    if (block) assert.ok(Math.abs(box.end_time - block.end_time) < 0.05, `a new text box should end with the caption under the playhead (${box.end_time} vs ${block.end_time})`)
    else assert.ok(box.end_time - box.start_time <= 3.05, `a new text box away from captions lasts about 3 s (${box.start_time}-${box.end_time})`)
    if (videoDuration > 0) assert.ok(box.end_time <= videoDuration + 0.05, `a new text box never runs past the video (${box.end_time} vs ${videoDuration})`)
    await page.$eval('[data-text-element-layer="true"]', (element) => element.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })))
    await page.waitForSelector('[data-text-element-layer="true"] [contenteditable="true"]')
    await page.$eval('[data-text-element-layer="true"] [contenteditable="true"]', (editable) => {
      editable.focus()
      document.execCommand('selectAll', false)
      document.execCommand('insertText', false, 'Journey headline')
    })
    // Press play without moving focus out of the box (a focus-keeping control or Space).
    await page.evaluate(() => [...document.querySelectorAll('button')].find((button) => /^play$/i.test(button.getAttribute('aria-label') || '') && button.offsetParent)?.click())
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('captionEditorState')).captions.some((item) => item.isTextElement && item.text === 'Journey headline'), { timeout: 8000 })
    await page.evaluate(() => [...document.querySelectorAll('button')].find((button) => /^pause$/i.test(button.getAttribute('aria-label') || '') && button.offsetParent)?.click())
  }
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

  // A new browser with no local draft must recover the account copy and obtain
  // fresh media without persisting a bearer URL or creating another render.
  // Match the fixture's stored duration to the actual source; a legitimate
  // metadata correction is an edit, not an unwanted recovery write.
  await page.goto('http://127.0.0.1:4187/launch-video.mp4')
  await page.waitForFunction(() => Number.isFinite(document.querySelector('video')?.duration))
  recoveryMediaDuration = await page.$eval('video', video => video.duration)
  accountRecovery = true
  const savesBeforeCloudRecovery = saveRequests
  await page.evaluate(() => localStorage.clear())
  await page.goto('http://127.0.0.1:4187/e2e/fixtures/editor.html')
  await textClick('Continue account draft')
  await page.waitForFunction(() => document.body.textContent.includes('cloud recovery caption'))
  await page.waitForFunction(() => document.querySelector('video')?.getAttribute('src')?.endsWith('/launch-video.mp4'))
  assert.equal(restoredMediaRequests, 1, 'account recovery refreshes the source URL through authenticated ownership checks')
  await new Promise(resolve => setTimeout(resolve, 3000))
  assert.equal(saveRequests, savesBeforeCloudRecovery, 'reading the account draft must not write a new revision')

  // With a browser copy present, only that copy (and its backup download) is
  // offered: no account-draft switch, and nothing overwrites either cloud revision.
  const browserOnlyDraft = { ...draft, duration: recoveryMediaDuration,
    captions: [{ ...caption, text: 'browser-only layout', wordStyles: { 'a-1': { fontSize: 28, x: 12 } } }] }
  const recoverySeed = await page.evaluateOnNewDocument((value) => {
    localStorage.clear()
    localStorage.setItem('captionEditorState', JSON.stringify(value))
  }, browserOnlyDraft)
  try {
    await page.goto('http://127.0.0.1:4187/e2e/fixtures/editor.html')
  } finally {
    await page.removeScriptToEvaluateOnNewDocument(recoverySeed.identifier)
  }
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent.trim() === 'Continue saved draft'))
  assert.equal(await page.evaluate(() => [...document.querySelectorAll('button')].some(button => /account draft/i.test(button.textContent))), false, 'no account-draft option beside a browser draft')
  await new Promise(resolve => setTimeout(resolve, 3000))
  assert.equal(saveRequests, savesBeforeCloudRecovery, 'account recovery must not overwrite either cloud revision')

  expiredAccountMedia = true
  await page.evaluate(() => localStorage.clear())
  await page.goto('http://127.0.0.1:4187/e2e/fixtures/editor.html')
  await textClick('Continue account draft')
  await page.waitForFunction(() => document.body.textContent.includes('cloud recovery caption') && document.body.textContent.includes('Source video unavailable'))
  assert.ok(await page.$('input[aria-label="Relink source video"]'), 'expired media retains captions and the relink flow')
  await page.click('[aria-label="Close source video notification"]')
  assert.equal(await page.evaluate(() => document.body.textContent.includes('Source video unavailable')), false, 'the source warning can be closed')
  assert.equal(await page.evaluate(() => document.body.textContent.includes('cloud recovery caption')), true, 'closing the warning keeps captions editable')
  const exportsBeforeMissingSource = exports
  await textClick('Export')
  await page.waitForSelector('[role="dialog"]')
  await page.waitForFunction(() => [...document.querySelectorAll('[role="dialog"] button')].some(button => button.textContent.includes('720p HD')))
  await page.evaluate(() => [...document.querySelectorAll('[role="dialog"] button')].find(button => button.textContent.includes('720p HD')).click())
  assert.equal(exports, exportsBeforeMissingSource, 'closing a warning must not permit exporting unavailable source media')
  await page.waitForFunction(() => document.body.textContent.includes('Relink the source video before rendering'))
  await page.click('[aria-label="Dismiss notification"]')
  await textClick('Close')
  await page.waitForFunction(() => !document.querySelector('[role=dialog]'))
  expiredAccountMedia = false

  holdRecoveryMedia = true
  await page.evaluate(() => localStorage.clear())
  await page.goto('http://127.0.0.1:4187/e2e/fixtures/editor.html')
  await textClick('Continue account draft')
  const recoveryDeadline = Date.now() + 5000
  while (!pendingRecoveryMedia && Date.now() < recoveryDeadline) await new Promise(resolve => setTimeout(resolve, 20))
  assert.ok(pendingRecoveryMedia, 'source refresh is held before its response')
  await page.evaluate(() => window.switchTestAccount('editor-test-b'))
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('captionEditorState') || '{}').ownerUid === 'editor-test-b')
  const recoveredMediaResponse = page.waitForResponse(response => response.url().endsWith('/api/media/upload-url') && response.status() === 200)
  await pendingRecoveryMedia.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, raw_url: '/launch-video.mp4' }) })
  await (await recoveredMediaResponse).json()
  await new Promise(resolve => setTimeout(resolve, 100))
  assert.equal(await page.evaluate(() => document.body.textContent.includes('cloud recovery caption')), false, 'a late media refresh cannot restore the previous account’s project')
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('captionEditorState') || '{}').captions?.length || 0), 0)
  holdRecoveryMedia = false
  accountRecovery = false

  // The editor must allow the same 1,000-line boundary as translation/export
  // and account saves, while still refusing an oversized request locally.
  const translationDraft = (count) => ({ ...draft, projectId: 'translation-boundary', videoUrl: '/launch-video.mp4', captionTracks: [], captions: Array.from({ length: count }, (_, index) => ({ id: `line-${index}`, text: `source ${index}`, start_time: index, end_time: index + 1, words: [], wordStyles: {} })) })
  await page.evaluate((value) => { localStorage.clear(); localStorage.setItem('captionEditorState', JSON.stringify(value)) }, translationDraft(1000))
  await page.goto('http://127.0.0.1:4187/e2e/fixtures/editor.html?restoreSession=1')
  await page.waitForSelector('#caption-translate-target', { timeout: 30000 })
  await page.select('#caption-translate-target', 'spanish')
  await textClick('Translate')
  await page.waitForFunction(() => {
    const value = JSON.parse(localStorage.getItem('captionEditorState') || '{}')
    return value.activeCaptionTrackId !== 'source' && value.captions?.[999]?.text === 'translated line-999'
  }, { timeout: 30000 })
  assert.equal(translationRequests.length, 1)
  assert.equal(translationRequests[0].captions.length, 1000)
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('captionEditorState')).captionTracks.find((track) => track.id === 'source').captions[999].text), 'source 999', 'translation preserves all original lines')
  await page.evaluate((value) => { localStorage.clear(); localStorage.setItem('captionEditorState', JSON.stringify(value)) }, translationDraft(1001))
  await page.goto('http://127.0.0.1:4187/e2e/fixtures/editor.html?restoreSession=1')
  await page.waitForSelector('#caption-translate-target', { timeout: 30000 })
  await page.select('#caption-translate-target', 'spanish')
  await textClick('Translate')
  await page.waitForFunction(() => document.body.textContent.includes('Translation supports up to 1000 captions'))
  assert.equal(translationRequests.length, 1, '1,001 captions are refused before calling the provider')

  // Default typography follows the active written language; an explicit font
  // choice survives switching tracks and reload. Translating to the original
  // language switches back to it without a provider call.
  const fontCaption = (text) => [{ id: 'font-line', text, start_time: 0, end_time: 3, words: [], wordStyles: {} }]
  await openSeededDraft({
    ...draft, projectId: 'language-font-defaults', videoUrl: '/launch-video.mp4',
    captions: fontCaption('Hello world'), activeCaptionTrackId: 'english',
    captionTracks: [
      { id: 'source', language: 'Hindi', label: 'Original Hindi', captions: fontCaption('नमस्ते दुनिया') },
      { id: 'english', language: 'English', label: 'English', captions: fontCaption('Hello world') },
    ],
    captionStyle: { ...draft.captionStyle, font_family: 'Inter', font_source: 'language-default' },
  })
  assert.equal(await page.$('#caption-language-track'), null, 'the Language track switcher is removed from the Captions tab')
  await page.waitForSelector('[aria-label="Font family: Inter"]')
  const requestsBeforeReturn = translationRequests.length
  await page.select('#caption-translate-target', 'hindi')
  await textClick('Translate')
  await page.waitForSelector('[aria-label="Font family: Noto Sans Devanagari"]')
  await page.screenshot({ path: resolve(downloadPath, 'default-fonts-hindi.png') })
  assert.equal(translationRequests.length, requestsBeforeReturn, 'returning to the original language makes no provider call')
  await page.click('[aria-label="Font family: Noto Sans Devanagari"]')
  await page.waitForSelector('input[placeholder="Search fonts..."]')
  await page.type('input[placeholder="Search fonts..."]', 'Mukta')
  await page.waitForFunction(() => [...document.querySelectorAll('span')].some(el => el.textContent === 'Mukta'))
  await page.evaluate(() => [...document.querySelectorAll('span')].find(el => el.textContent === 'Mukta').click())
  await page.waitForSelector('[aria-label="Font family: Mukta"]')
  await page.waitForFunction(() => {
    const saved = JSON.parse(localStorage.getItem('captionEditorState'))
    return saved.activeCaptionTrackId === 'source' && saved.captionStyle.font_family === 'Mukta' && saved.captionStyle.font_source === 'custom'
  })
  await page.reload()
  await page.waitForSelector('[aria-label="Font family: Mukta"]')

  // Auto layout reads the script with AI once, applies what it read, keeps the
  // reading on the captions (no second call), and falls back to rules on failure.
  const moodDraft = (projectId) => ({
    ...draft,
    projectId,
    videoUrl: '/launch-video.mp4',
    captionTracks: [],
    captions: [
      { id: 'mood-1', text: 'so today we are talking about work', start_time: 0, end_time: 3, words: [], wordStyles: {} },
      { id: 'mood-2', text: 'nobody believed us', start_time: 12, end_time: 14, words: [], wordStyles: {} },
      { id: 'mood-3', text: 'and that is how it went', start_time: 24, end_time: 27, words: [], wordStyles: {} },
    ],
  })
  const storedMood = () => page.evaluate(() => JSON.parse(localStorage.getItem('captionEditorState')).captions.filter((item) => item.id?.startsWith?.('mood-')))
  await openSeededDraft(moodDraft('mood-ai'))
  await textClick('Auto layout')
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('captionEditorState')).captions.some((item) => item.id === 'mood-2' && item.layoutSource === 'auto' && item.aiEmotion), { timeout: 15000 })
  assert.equal(emotionRequests.length, 1, 'one AI call for the whole script')
  assert.deepEqual(emotionRequests[0].lines.map((line) => line.id), ['mood-1', 'mood-2', 'mood-3'])
  {
    const mood = await storedMood()
    const punchline = mood.find((item) => item.id === 'mood-2')
    assert.equal(punchline.layoutMode, 'cpt', 'the line the AI read as the punchline becomes the CPT')
    assert.equal(punchline.layoutInsight?.source, 'ai')
    assert.ok(punchline.wordStyles?.['mood-2-1']?.isEmphasis, "the AI's keyword is the hero word")
    assert.equal(mood.find((item) => item.id === 'mood-1').layoutMode, 'sentence', 'low-key narration stays a plain sentence')
  }
  await page.waitForFunction(() => /Read 3 lines with AI/.test(document.body.textContent))
  await textClick('Auto layout')
  await page.waitForFunction(() => /Auto layout:/.test(document.body.textContent))
  await new Promise((resolve) => setTimeout(resolve, 600))
  assert.equal(emotionRequests.length, 1, 'lines already read are not sent again')

  emotionMode = 'fail'
  await openSeededDraft(moodDraft('mood-rules'))
  await textClick('Auto layout')
  await page.waitForFunction(() => /AI reading unavailable, used timing and volume/.test(document.body.textContent), { timeout: 15000 })
  await page.waitForFunction(() => {
    const mood = JSON.parse(localStorage.getItem('captionEditorState')).captions.filter((item) => item.id?.startsWith?.('mood-'))
    return mood.length === 3 && mood.every((item) => item.layoutSource === 'auto' && !item.aiEmotion && item.layoutInsight?.source === 'rules')
  }, { timeout: 10000 }).catch(async () => {
    throw new Error(`without AI the rules still lay out every caption: ${JSON.stringify((await storedMood()).map((item) => [item.id, item.layoutSource, !!item.aiEmotion, item.layoutInsight]))}`)
  })
  emotionMode = 'ok'

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
  const expectedAmount = planCatalog.starter_yearly[order.body.currency === 'USD' ? 'usd_cents' : 'inr_paise']
  assert.equal(await page.evaluate(() => window.checkoutOptions.amount), expectedAmount)
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
  console.log('Local editor journey passed: caption correction, account-only source recovery without a save, expired-source relink, delayed-response account isolation, keyboard search, portrait preview, revision conflict, text-box removal/undo, reload, named controls, upload resume, 1000-line translation/1001-line refusal and checkout.')
} catch (error) {
  console.error('Editor test diagnostics:', errors, await page.evaluate(() => document.body.innerText.slice(0, 3500)))
  throw error
} finally {
  await browser.close()
  await server.close()
}
