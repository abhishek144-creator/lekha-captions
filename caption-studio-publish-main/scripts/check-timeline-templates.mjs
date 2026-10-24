import { resolve } from 'node:path'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import puppeteer from 'puppeteer'

// Real Dashboard with the editor-journey auth/API doubles. Checks timeline
// block moves and trims (word timings follow, undo restores), and that applying
// a template is undoable, redoable and survives a reload.

const server = await createServer({
  configFile: false, envDir: false, logLevel: 'error', plugins: [react()],
  resolve: { alias: [
    { find: '@/lib/AuthContext', replacement: resolve('e2e/fixtures/editorAuth.jsx') },
    { find: '@/context/AuthContext', replacement: resolve('e2e/fixtures/editorAuth.jsx') },
    { find: '@/lib/firebase', replacement: resolve('e2e/fixtures/editorFirebase.js') },
    { find: '@', replacement: resolve('src') },
  ] },
  define: { 'import.meta.env.VITE_API_BASE_URL': '""', 'import.meta.env.VITE_LOCAL_API_RETRY_MS': '"0"' },
  server: { host: '127.0.0.1', port: 4194, strictPort: true },
})
await server.listen()
const browser = await puppeteer.launch({ headless: true, args: process.env.CI ? ['--no-sandbox'] : [] })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const caption = { id: 'a', text: 'hello bright big world', start_time: 0, end_time: 4, wordStyles: {}, words: [{ word: 'hello', start: 0, end: 1 }, { word: 'bright', start: 1, end: 2 }, { word: 'big', start: 2, end: 3 }, { word: 'world', start: 3, end: 4 }] }
const mkDraft = (aspect) => ({ ownerUid: 'editor-test-a', projectId: 'probe', fileId: '123e4567-e89b-12d3-a456-426614174000', videoUrl: '/launch-video.mp4', duration: 10, originalFileName: 'f.mp4', captions: [caption], captionTracks: [], activeCaptionTrackId: 'source', settings: aspect ? { aspectRatio: aspect, aspect_ratio: aspect } : {}, captionStyle: { font_family: 'Inter', font_size: 24, position_y: 70, text_color: '#ffffff', has_background: false, ...(aspect ? { aspect_ratio: aspect } : {}) } })

async function open(width, height, aspect, styleOverrides = {}) {
  // A fresh context per page: no saved project leaks between checks.
  const context = await (browser.createBrowserContext?.() ?? browser.createIncognitoBrowserContext())
  const page = await context.newPage()
  const closePage = page.close.bind(page)
  page.close = async () => { await closePage(); await context.close() }
  await page.setViewport({ width, height })
  page.errors = []
  page.exportPayloads = []
  page.on('pageerror', (e) => page.errors.push(e.message))
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
    else if (url.pathname === '/api/export') { page.exportPayloads.push(JSON.parse(request.postData())); return request.respond({ status: 503, contentType: 'application/json', body: JSON.stringify({ detail: 'probe: not rendering' }) }) }
    return request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) })
  })
  await page.goto('http://127.0.0.1:4194/e2e/fixtures/editor.html')
  await page.evaluate((v) => localStorage.setItem('captionEditorState', JSON.stringify(v)), { ...mkDraft(aspect), captionStyle: { ...mkDraft(aspect).captionStyle, ...styleOverrides } })
  await page.goto('http://127.0.0.1:4194/e2e/fixtures/editor.html?restoreSession=1')
  await page.waitForSelector('.lekha-video-frame [data-word-key="a-1"]', { timeout: 30000 })
  await sleep(1500)
  return page
}


const ctrl = async (page, key) => { await page.keyboard.down('Control'); await page.keyboard.press(key); await page.keyboard.up('Control'); await sleep(700) }
const state = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('captionEditorState')))
let failures = 0
const report = (name, ok, detail) => { if (!ok) failures += 1; console.log(`${ok ? 'OK  ' : 'FAIL'} ${name} ${detail || ''}`) }
const drag = async (page, from, dx, dy = 0) => { await page.mouse.move(from.x, from.y); await page.mouse.down(); for (let i = 1; i <= 10; i += 1) await page.mouse.move(from.x + dx * i / 10, from.y + dy * i / 10); await sleep(100); await page.mouse.up(); await sleep(800) }
try {
  const page = await open(1440, 900, null)
  // The timeline scales to the video duration; wait for the media to load.
  await page.waitForFunction(() => (document.querySelector('.lekha-video-frame video')?.duration || 0) > 10, { timeout: 20000 }).catch(() => {})
  // expand the timeline
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /timeline/i.test(b.textContent) && b.textContent.length < 60)?.click()); await sleep(1200)
  const block = await page.evaluate(() => { const n = document.querySelector('[data-caption-block="true"]'); if (!n) return null; const b = n.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, l: b.left, r: b.right, w: b.width } })
  report('timeline shows the caption block', !!block, JSON.stringify(block))
  if (block) {
    const s0 = (await state(page)).captions[0]
    await drag(page, block, 60)
    const s1 = (await state(page)).captions[0]
    report('dragging a timeline block moves the caption in time', s1.start_time > s0.start_time + 0.1 && Math.abs((s1.end_time - s1.start_time) - (s0.end_time - s0.start_time)) < 0.01, `${s0.start_time}-${s0.end_time} -> ${s1.start_time}-${s1.end_time}`)
    report('moving keeps word timings inside the caption', (s1.words || []).every((w) => w.start >= s1.start_time - 0.01 && w.end <= s1.end_time + 0.01), JSON.stringify((s1.words || []).map((w) => [w.start, w.end])))
    await ctrl(page, 'z')
    const s2 = (await state(page)).captions[0]
    report('undo reverts the timeline move', Math.abs(s2.start_time - s0.start_time) < 0.01, `${s2.start_time}`)
    const right = await page.evaluate(() => { const n = document.querySelector('[data-caption-block="true"]'); const h = n.querySelector('.cursor-ew-resize:last-of-type') || [...n.querySelectorAll('.cursor-ew-resize')].pop(); const b = h.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 } })
    await drag(page, right, -40)
    const s3 = (await state(page)).captions[0]
    report('trimming the end handle shortens the caption', s3.end_time < s0.end_time - 0.1 && Math.abs(s3.start_time - s0.start_time) < 0.01, `${s0.start_time}-${s0.end_time} -> ${s3.start_time}-${s3.end_time}`)
    await ctrl(page, 'z')
    report('undo reverts the trim', Math.abs((await state(page)).captions[0].end_time - s0.end_time) < 0.01, `${(await state(page)).captions[0].end_time}`)

    // Split at the playhead (ruler click puts it inside the first caption).
    const countBefore = (await state(page)).captions.filter((c) => !c.isTextElement).length
    const rulerPoint = await page.evaluate((midTime) => {
      const content = document.querySelector('[data-caption-block="true"]').parentElement
      const rect = content.getBoundingClientRect()
      const duration = document.querySelector('.lekha-video-frame video').duration
      return { x: rect.left + 12 + midTime * ((rect.width - 24) / duration), y: rect.top + 8 }
    }, (s0.start_time + s0.end_time) / 2)
    await page.mouse.click(rulerPoint.x, rulerPoint.y); await sleep(500)
    await page.click('[aria-label="Split at playhead"]'); await sleep(700)
    const afterSplit = (await state(page)).captions.filter((c) => !c.isTextElement)
    report('split at playhead makes two captions', afterSplit.length === countBefore + 1 && afterSplit[0].end_time < s0.end_time - 0.1 && Math.abs(afterSplit[1].end_time - s0.end_time) < 0.01, `${countBefore} -> ${afterSplit.length}: ${afterSplit.slice(0, 2).map((c) => `${c.start_time.toFixed(2)}-${c.end_time.toFixed(2)} "${c.text}"`).join(' | ')}`)
    await ctrl(page, 'z')
    report('undo reverts the split', (await state(page)).captions.filter((c) => !c.isTextElement).length === countBefore, '')

    // Keyboard: select the first clip, nudge it, then delete it (each undoable).
    await page.click('[data-caption-block="true"]'); await sleep(400)
    await page.keyboard.press('ArrowRight'); await sleep(1500)
    const nudged = (await state(page)).captions.filter((c) => !c.isTextElement)[0]
    report('arrow key nudges the selected clip', Math.abs(nudged.start_time - (s0.start_time + 0.1)) < 0.02, `${s0.start_time} -> ${nudged.start_time}`)
    await page.keyboard.press('Delete'); await sleep(600)
    report('Delete removes the selected clip', (await state(page)).captions.filter((c) => !c.isTextElement).length === countBefore - 1, '')
    await ctrl(page, 'z')
    report('undo restores the deleted clip', (await state(page)).captions.filter((c) => !c.isTextElement).length === countBefore, '')
    // Undo the nudge too, so the later steps start from the original caption.
    await ctrl(page, 'z'); await sleep(800)
    report('undo reverts the nudge', Math.abs((await state(page)).captions.filter((c) => !c.isTextElement)[0].start_time - s0.start_time) < 0.01, '')
  }
  // template apply + undo + reload persistence
  for (let attempt = 0; attempt < 10 && !(await page.$('[data-template-card-id][data-template-kind="basic"]')); attempt += 1) {
    await page.evaluate(() => [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === 'Templates').pop()?.click())
    await sleep(4000)
  }
  const tplId = await page.evaluate(() => { const c = document.querySelector('[data-template-card-id][data-template-kind="basic"]'); c.click(); return c.getAttribute('data-template-card-id') })
  await sleep(1500)
  report('applying a template updates the caption style', (await state(page)).captionStyle.template_id === tplId, (await state(page)).captionStyle.template_id)
  await page.mouse.click(470, 700); await sleep(200)
  await ctrl(page, 'z')
  report('undo removes the applied template', !(await state(page)).captionStyle.template_id, String((await state(page)).captionStyle.template_id))
  await ctrl(page, 'y')
  report('redo re-applies the template', (await state(page)).captionStyle.template_id === tplId, String((await state(page)).captionStyle.template_id))
  await sleep(800)
  await page.goto('http://127.0.0.1:4194/e2e/fixtures/editor.html?restoreSession=1')
  await page.waitForSelector('.lekha-video-frame [data-word-key]', { timeout: 30000 }); await sleep(1200)
  report('template survives a reload', (await state(page)).captionStyle.template_id === tplId && !!(await page.$(`.lekha-video-frame .${tplId}, .lekha-video-frame [class*="${tplId}"]`)), String((await state(page)).captionStyle.template_id))
  // A native paused seek must update LC motion even if React's currentTime
  // value has not changed. Reproduce that ordering without a timeupdate event.
  for (let attempt = 0; attempt < 12 && !(await page.$('[data-template-card-id="T263"]')); attempt += 1) {
    await page.evaluate(() => [...document.querySelectorAll('button')]
      .filter((button) => button.textContent.trim() === 'Templates' && button.getBoundingClientRect().left < window.innerWidth / 2)
      .forEach((button) => button.click()))
    await sleep(500)
  }
  await page.click('[data-template-card-id="T263"]')
  await page.waitForSelector('.lekha-applied-template-host[data-lc-timeline-ms]')
  await page.evaluate(() => {
    const video = document.querySelector('.lekha-video-frame video')
    video.pause()
    video.currentTime = 0
    video.dispatchEvent(new Event('timeupdate', { bubbles: true }))
  })
  await page.waitForFunction(() => document.querySelector('.lekha-applied-template-host')?.dataset.lcTimelineMs === '0')
  await page.evaluate(() => {
    const video = document.querySelector('.lekha-video-frame video')
    Object.defineProperty(video, 'currentTime', { configurable: true, get: () => 3.88 })
    video.dispatchEvent(new Event('seeked'))
  })
  const nativeSeekSynced = await page.waitForFunction(() => document.querySelector('.lekha-applied-template-host')?.dataset.lcTimelineMs === '3880', { timeout: 3000 }).then(() => true, () => false)
  report('paused native seek resynchronizes the LC animation clock without a React time update', nativeSeekSynced)
  await page.evaluate(() => { delete document.querySelector('.lekha-video-frame video').currentTime })
  console.log('errors', JSON.stringify(page.errors)); if (page.errors.length) failures += 1
  await page.close()
  if (failures) throw new Error(`${failures} check(s) failed`)
  console.log('Timeline/template checks passed.')
} finally { await browser.close(); await server.close() }
