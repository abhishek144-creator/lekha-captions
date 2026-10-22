import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import puppeteer from 'puppeteer'

// Real Dashboard with the editor-journey auth/API doubles. Drags template
// words into a CPT while paused at 0:00 (words still mid-entrance), re-drags a
// moved word, and checks each lands exactly where it was shown during the drag
// and that the rest of the caption settles to the layout the export renders.
// Also covers the selected moved word's resize handles and Move button.
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

async function openEditor() {
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
  return { page, errors, wordBox }
}

const centerOf = (page, selector) => page.evaluate((sel) => {
  const node = document.querySelector(sel)
  if (!node) return null
  const box = node.getBoundingClientRect()
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
}, selector)

// `precise` holds Alt, which turns smart-guide snapping off, for checks that
// need the exact pointer offset.
async function dragBy(page, from, dx, dy, measure, { precise = false } = {}) {
  await page.mouse.move(from.x, from.y)
  if (precise) await page.keyboard.down('Alt')
  await page.mouse.down()
  // Leave a one-line caption within the first steps, as a real drag does.
  for (let step = 1; step <= 12; step += 1) await page.mouse.move(from.x + (dx * step) / 12, from.y + (dy * step) / 12)
  const during = measure ? await measure() : null
  await page.mouse.up()
  if (precise) await page.keyboard.up('Alt')
  await sleep(700)
  return { during, after: measure ? await measure() : null }
}

async function checkTemplate(kind) {
  const { page, errors, wordBox } = await openEditor()
  // The template library is lazy-loaded; keep the panel tab selected until a
  // cold dev server has compiled it.
  const cardSelector = `[data-template-card-id][data-template-kind="${kind}"]`
  for (let attempt = 0; attempt < 12 && !(await page.$(cardSelector)); attempt += 1) {
    await page.evaluate(() => [...document.querySelectorAll('button')].filter((button) => button.textContent.trim() === 'Templates').pop()?.click())
    await sleep(5000)
  }
  await page.waitForSelector(cardSelector, { timeout: 30000 })
  const templateId = await page.evaluate((templateKind) => {
    const card = document.querySelector(`[data-template-card-id][data-template-kind="${templateKind}"]`)
    card.click()
    return card.getAttribute('data-template-card-id')
  }, kind)
  await page.waitForFunction((id) => JSON.parse(localStorage.getItem('captionEditorState') || '{}').captionStyle?.template_id === id, { timeout: 15000 }, templateId)
  await page.evaluate(() => { document.querySelector('.lekha-video-frame video').currentTime = 0 })
  await sleep(1200)

  // The last move re-drags an already moved word: a mid-drag restyle used to
  // reset its live offset, so it froze until release and then jumped.
  for (const [wordIndex, dx, dy] of [[1, 0, -160], [2, 90, -90], [1, 60, 30]]) {
    const key = `a-${wordIndex}`
    const start = await wordBox(key)
    assert.ok(start, `${templateId}: ${key} must render on the canvas`)
    const { during, after } = await dragBy(page, start, dx, dy, () => wordBox(key))
    assert.ok(Math.hypot(during.x - start.x, during.y - start.y) > 40, `${templateId}: dragging ${key} must move it while dragging (${JSON.stringify({ dx, dy, start, during, after })})`)
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

async function checkSelectedWordTools() {
  const { page, errors, wordBox } = await openEditor()
  await sleep(1000)
  const start = await wordBox('a-1')
  await dragBy(page, start, 0, -150)
  const moved = await wordBox('a-1')
  await page.mouse.click(moved.x, moved.y)
  await page.waitForSelector('[data-selected-word-box="true"]', { timeout: 10000 })
  const wordStyle = async () => JSON.parse(await page.evaluate(() => localStorage.getItem('captionEditorState'))).captions[0].wordStyles['a-1'] || {}
  const text = '[data-selected-word-box="true"] [data-selected-word-text="true"]'

  // A short word's corner dot must scale the font, not stretch its box.
  const corner = await centerOf(page, '[data-selected-word-box="true"] [data-resize-axis="corner"][data-resize-side="right"][data-resize-vertical-side="bottom"]')
  await dragBy(page, corner, 30, 30)
  const resized = await wordStyle()
  assert.ok(resized.fontSize > 24 && !resized.boxWidth, `corner handle must scale the word (fontSize ${resized.fontSize}, boxWidth ${resized.boxWidth})`)
  const afterResize = await centerOf(page, text)
  assert.ok(Math.abs(afterResize.x - moved.x) < 2 && Math.abs(afterResize.y - moved.y) < 2, 'corner resize must keep the word centred')

  const side = await centerOf(page, '[data-selected-word-box="true"] [data-resize-axis="horizontal"][data-resize-side="right"]')
  await dragBy(page, side, 30, 0)
  assert.ok((await wordStyle()).boxWidth > 0, 'side handle must widen the word box')

  // The Move button started the drag without a pointer id and threw.
  const before = await centerOf(page, text)
  const move = await centerOf(page, '[title="Move word"]')
  const { during, after } = await dragBy(page, move, -50, 40, () => centerOf(page, text), { precise: true })
  assert.ok(Math.abs(after.x - (before.x - 50)) < 2 && Math.abs(after.y - (before.y + 40)) < 2, `Move button must move the word (before ${before.x},${before.y} after ${after.x},${after.y})`)
  assert.ok(Math.abs(after.x - during.x) < 1.5 && Math.abs(after.y - during.y) < 1.5, 'Move button drop must stay where shown')
  // Escape closes the floating word editor (the first-run tip, a dismissable
  // layer, may take the first press).
  for (let press = 0; press < 2 && await page.$('[data-word-popup-panel="true"]'); press += 1) {
    await page.keyboard.press('Escape')
    await sleep(300)
  }
  assert.equal(await page.$('[data-word-popup-panel="true"]'), null, 'Escape must close the floating word editor')
  assert.deepEqual(errors, [], 'selected-word tools: no page errors')
  await page.close()
}

try {
  const checked = []
  await checkSelectedWordTools()
  checked.push('selected-word tools')
  for (const kind of ['basic', 'advanced']) checked.push(await checkTemplate(kind))
  console.log(`CPT word drop checks passed (${checked.join(', ')}).`)
} finally {
  await browser.close()
  await server.close()
}
