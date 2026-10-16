import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import puppeteer from 'puppeteer'

// Real Dashboard with the editor-journey auth/API doubles. Drags template
// words into a CPT while paused at 0:00 (words still mid-entrance) and checks
// that each word lands exactly where it was shown during the drag, and that
// the rest of the caption settles to the resting layout the export renders.
const server = await createServer({
  configFile: false, envDir: false, logLevel: 'error',
  plugins: [react()],
  resolve: { alias: [
    { find: '@/lib/AuthContext', replacement: resolve('e2e/fixtures/editorAuth.jsx') },
    { find: '@/context/AuthContext', replacement: resolve('e2e/fixtures/editorAuth.jsx') },
    { find: '@/lib/firebase', replacement: resolve('e2e/fixtures/editorFirebase.js') },
    { find: '@', replacement: resolve('src') },
  ] },
  define: { 'import.meta.env.VITE_API_BASE_URL': '""', 'import.meta.env.VITE_LOCAL_API_RETRY_MS': '"0"' },
  server: { host: '127.0.0.1', port: 4189, strictPort: true },
})
await server.listen()
const browser = await puppeteer.launch({ headless: true, args: process.env.CI ? ['--no-sandbox'] : [] })
const sleep = (ms) => new Promise((done) => setTimeout(done, ms))
const caption = {
  id: 'a', text: 'hello bright big world', start_time: 0, end_time: 4, wordStyles: {},
  words: [{ word: 'hello', start: 0, end: 1 }, { word: 'bright', start: 1, end: 2 }, { word: 'big', start: 2, end: 3 }, { word: 'world', start: 3, end: 4 }],
}
const draft = {
  ownerUid: 'editor-test-a', projectId: 'cpt-drop', fileId: '123e4567-e89b-12d3-a456-426614174000',
  videoUrl: '/launch-video.mp4', duration: 10, originalFileName: 'fixture.mp4',
  captions: [caption], captionTracks: [], activeCaptionTrackId: 'source', settings: {},
  captionStyle: { font_family: 'Inter', font_size: 24, position_y: 70, text_color: '#ffffff', has_background: false },
}

async function checkTemplate(kind) {
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 1000 })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.setRequestInterception(true)
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.hostname !== '127.0.0.1' && !['data:', 'blob:'].includes(url.protocol)) return request.abort()
    if (!url.pathname.startsWith('/api/')) return request.continue()
    let payload = { success: true }
    if (url.pathname === '/api/editor-preferences/load') payload.preferences = { revision: 0, brand_kits: [], glossary_terms: [] }
    else if (url.pathname === '/api/draft/load') payload = { revision: 0, project_id: null, draft: null }
    else if (url.pathname === '/api/projects/list') payload.projects = []
    else if (url.pathname === '/api/workspaces') payload.workspaces = []
    else if (url.pathname === '/api/fonts') payload = { fonts: [] }
    return request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) })
  })
  const wordBox = (key) => page.evaluate((wordKey) => {
    const node = document.querySelector(`.lekha-video-frame [data-word-key="${wordKey}"]`)
    if (!node) return null
    const visual = node.querySelector('[data-word-drag-visual="true"],[data-source-word-visual="true"]') || node
    const box = visual.getBoundingClientRect()
    return { x: box.left + box.width / 2, y: box.top + box.height / 2, h: box.height }
  }, key)

  await page.goto('http://127.0.0.1:4189/e2e/fixtures/editor.html')
  await page.evaluate((value) => localStorage.setItem('captionEditorState', JSON.stringify(value)), draft)
  await page.goto('http://127.0.0.1:4189/e2e/fixtures/editor.html?restoreSession=1')
  await page.waitForSelector('.lekha-video-frame [data-word-key="a-1"]', { timeout: 30000 })
  await page.evaluate(() => [...document.querySelectorAll('button')].filter((button) => button.textContent.trim() === 'Templates').pop()?.click())
  await page.waitForSelector(`[data-template-card-id][data-template-kind="${kind}"]`, { timeout: 30000 })
  const templateId = await page.evaluate((templateKind) => {
    const card = document.querySelector(`[data-template-card-id][data-template-kind="${templateKind}"]`)
    card.click()
    return card.getAttribute('data-template-card-id')
  }, kind)
  await page.waitForFunction((id) => JSON.parse(localStorage.getItem('captionEditorState') || '{}').captionStyle?.template_id === id, { timeout: 15000 }, templateId)
  await page.evaluate(() => { document.querySelector('.lekha-video-frame video').currentTime = 0 })
  await sleep(1200)

  for (const [wordIndex, dx, dy] of [[1, 0, -160], [2, 90, -90]]) {
    const key = `a-${wordIndex}`
    const start = await wordBox(key)
    assert.ok(start, `${templateId}: ${key} must render on the canvas`)
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    // Leave the one-line caption within the first steps, as a real drag does.
    for (let step = 1; step <= 12; step += 1) await page.mouse.move(start.x + (dx * step) / 12, start.y + (dy * step) / 12)
    const during = await wordBox(key)
    await page.mouse.up()
    await sleep(700)
    const after = await wordBox(key)
    assert.ok(Math.abs(during.y - start.y) > 40, `${templateId}: dragging ${key} must move it (drag did not start)`)
    assert.ok(
      Math.abs(after.x - during.x) <= 1.5 && Math.abs(after.y - during.y) <= 1.5,
      `${templateId}: ${key} must stay where it was dropped (during ${during.x},${during.y} after ${after.x},${after.y})`,
    )
  }
  // Untouched words of the CPT show their resting frame, matching export.
  const restingHeights = await page.evaluate(() => [0, 3].map((index) => document.querySelector(`.lekha-video-frame [data-word-key="a-${index}"]`)?.dataset.cptSettled))
  assert.deepEqual(restingHeights, ['true', 'true'], `${templateId}: the rest of a paused CPT caption must be settled`)
  assert.equal(await page.evaluate(() => document.querySelector('[data-cpt-drag-caption]')), null, `${templateId}: the drag marker must be cleared`)
  assert.deepEqual(errors, [], `${templateId}: no page errors`)
  await page.close()
  return templateId
}

try {
  const checked = []
  for (const kind of ['basic', 'advanced']) checked.push(await checkTemplate(kind))
  console.log(`CPT word drop checks passed (${checked.join(', ')}).`)
} finally {
  await browser.close()
  await server.close()
}
