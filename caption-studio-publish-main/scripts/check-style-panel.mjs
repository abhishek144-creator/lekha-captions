import { resolve } from 'node:path'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import puppeteer from 'puppeteer'

// Real Dashboard with the editor-journey auth/API doubles. Checks the Styling
// panel's caption colour, picker drags, keyboard slider edits and their undo
// steps, word-vs-caption colour precedence, and that the export request carries
// the same caption and word colours (including recreated advanced templates).

const server = await createServer({
  configFile: false, envDir: false, logLevel: 'error', plugins: [react()],
  resolve: { alias: [
    { find: '@/lib/AuthContext', replacement: resolve('e2e/fixtures/editorAuth.jsx') },
    { find: '@/context/AuthContext', replacement: resolve('e2e/fixtures/editorAuth.jsx') },
    { find: '@/lib/firebase', replacement: resolve('e2e/fixtures/editorFirebase.js') },
    { find: '@', replacement: resolve('src') },
  ] },
  define: { 'import.meta.env.VITE_API_BASE_URL': '""', 'import.meta.env.VITE_LOCAL_API_RETRY_MS': '"0"' },
  server: { host: '127.0.0.1', port: 4193, strictPort: true },
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
  await page.goto('http://127.0.0.1:4193/e2e/fixtures/editor.html')
  await page.evaluate((v) => localStorage.setItem('captionEditorState', JSON.stringify(v)), { ...mkDraft(aspect), captionStyle: { ...mkDraft(aspect).captionStyle, ...styleOverrides } })
  await page.goto('http://127.0.0.1:4193/e2e/fixtures/editor.html?restoreSession=1')
  await page.waitForSelector('.lekha-video-frame [data-word-key="a-1"]', { timeout: 30000 })
  await sleep(1500)
  return page
}

const ctrl = async (page, key) => { await page.keyboard.down('Control'); await page.keyboard.press(key); await page.keyboard.up('Control'); await sleep(600) }
const state = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('captionEditorState')))
const wordColors = (page) => page.evaluate(() => [0, 1, 2, 3].map((i) => { const n = document.querySelector(`.lekha-video-frame [data-word-key="a-${i}"]`); const v = n?.querySelector('[data-word-drag-visual="true"],[data-source-word-visual="true"]') || n; return v ? getComputedStyle(v).color : null }))
const fontPx = (page) => page.evaluate(() => { const n = document.querySelector('.lekha-video-frame [data-word-key="a-0"]'); const v = n?.querySelector('[data-word-drag-visual="true"],[data-source-word-visual="true"]') || n; return parseFloat(getComputedStyle(v).fontSize) })
let failures = 0
const report = (name, ok, detail) => { if (!ok) failures += 1; console.log(`${ok ? 'OK  ' : 'FAIL'} ${name} ${detail || ''}`) }
const focusSlider = (page, label) => page.evaluate((l) => { const root = document.querySelector(`[aria-label="${l}"]`); const thumb = root?.matches('[role="slider"]') ? root : root?.querySelector('[role="slider"]'); thumb?.focus(); return !!thumb && document.activeElement === thumb }, label)
const clickWord = async (page, i) => { const b = await page.evaluate((k) => { const n = document.querySelector(`.lekha-video-frame [data-word-key="a-${k}"]`).getBoundingClientRect(); return { x: n.left + n.width / 2, y: n.top + n.height / 2 } }, i); await page.mouse.click(b.x, b.y); await sleep(600) }
const exportNow = async (page) => {
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /^export$/i.test(b.textContent.trim()))?.click())
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => b.textContent.includes('720p HD')), { timeout: 15000 })
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('720p HD')).click())
  await page.waitForFunction(() => true, { timeout: 100 })
  for (let i = 0; i < 40 && !page.exportPayloads.length; i += 1) await sleep(250)
  return page.exportPayloads.at(-1)
}
try {
  const page = await open(1440, 900, null, { text_color: '#ffffff' })
  // Sidebar caption colour swatch (inside the collapsed "Solid" section)
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /^Solid[+−]$/.test(b.textContent.replace(/\s+/g, '')))?.click()); await sleep(400)
  const before = await wordColors(page)
  const swatch = await page.evaluate(() => { const n = [...document.querySelectorAll('[aria-label^="Text color #"]')].find((b) => !/#fff(fff)?$/i.test(b.getAttribute('aria-label'))); return n?.getAttribute('aria-label') })
  await page.evaluate((l) => document.querySelector(`[aria-label="${l}"]`).click(), swatch); await sleep(700)
  const after = await wordColors(page)
  report('sidebar caption colour recolours every word', after.every((c, i) => c !== before[i]), `${swatch}: ${JSON.stringify(after)}`)
  await page.mouse.click(470, 700); await sleep(200)
  await ctrl(page, 'z')
  report('undo reverts the sidebar colour', JSON.stringify(await wordColors(page)) === JSON.stringify(before), JSON.stringify(await wordColors(page)))
  // Native picker drag: many input events, one undo step
  const startColor = (await state(page)).captionStyle.text_color
  await page.evaluate(() => { const input = document.querySelector('[aria-label="Custom text color"]'); const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; ['#110000', '#220000', '#330000', '#440000', '#550000', '#660000', '#770000', '#880000'].forEach((v) => { setter.call(input, v); input.dispatchEvent(new Event('input', { bubbles: true })) }) })
  await sleep(700)
  report('picker drag recolours the caption', (await state(page)).captionStyle.text_color === '#880000', (await state(page)).captionStyle.text_color)
  await ctrl(page, 'z')
  report('one undo reverts a whole picker drag', (await state(page)).captionStyle.text_color === startColor, `${(await state(page)).captionStyle.text_color} expected ${startColor}`)
  // Font size slider via keyboard
  const size0 = (await state(page)).captionStyle.font_size
  const px0 = await fontPx(page)
  report('font size slider takes keyboard focus', await focusSlider(page, 'Font size'))
  for (let i = 0; i < 4; i += 1) { await page.keyboard.press('ArrowRight'); await sleep(60) }
  await sleep(700)
  report('keyboard font size change applies', (await state(page)).captionStyle.font_size === size0 + 4 && (await fontPx(page)) > px0, `${size0} -> ${(await state(page)).captionStyle.font_size}, ${px0}px -> ${await fontPx(page)}px`)
  await page.mouse.click(470, 700); await sleep(200)
  await ctrl(page, 'z')
  report('one undo reverts a keyboard font size burst', (await state(page)).captionStyle.font_size === size0, `${(await state(page)).captionStyle.font_size}`)
  // Vertical position slider via keyboard
  const y0 = (await state(page)).captionStyle.position_y
  await focusSlider(page, 'Vertical position')
  for (let i = 0; i < 3; i += 1) { await page.keyboard.press('ArrowLeft'); await sleep(60) }
  await sleep(700)
  report('keyboard position change applies', (await state(page)).captionStyle.position_y === y0 - 3, `${y0} -> ${(await state(page)).captionStyle.position_y}`)
  await page.mouse.click(470, 700); await sleep(200)
  await ctrl(page, 'z')
  report('undo reverts the keyboard position change', (await state(page)).captionStyle.position_y === y0, `${(await state(page)).captionStyle.position_y}`)
  // Word colour beats caption colour; caption colour still reaches the others
  await clickWord(page, 1)
  const styleTab = await page.evaluate(() => { const n = [...document.querySelectorAll('[data-word-popup-panel="true"] [role="tab"]')].find((x) => /style/i.test(x.textContent)); const b = n.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 } })
  await page.mouse.click(styleTab.x, styleTab.y); await sleep(300)
  await page.evaluate(() => document.querySelector('[aria-label="Word color #ef4444"]').click()); await sleep(500)
  await page.keyboard.press('Escape'); await sleep(400)
  const captionSwatch = swatch.replace('Text color ', '').toLowerCase()
  await page.evaluate((l) => document.querySelector(`[aria-label="${l}"]`).click(), swatch); await sleep(700)
  const mixed = await wordColors(page)
  report('word colour overrides the caption colour; other words follow it', /239, 68, 68/.test(mixed[1]) && /233, 30, 99/.test(mixed[0]), JSON.stringify(mixed))
  // Export payload carries the same colours
  const payload = await exportNow(page)
  const capPayload = payload?.captions?.[0]
  report('export sends the caption colour', String(payload?.style?.text_color).toLowerCase() === captionSwatch, payload?.style?.text_color)
  report('export sends the word colour', capPayload?.word_styles?.['a-1']?.color === '#ef4444', JSON.stringify(capPayload?.word_styles))
  console.log('errors', JSON.stringify(page.errors)); if (page.errors.length) failures += 1
  await page.close()

  // A recreated advanced template keeps user word colours in export
  const tpl = await open(1440, 900, null)
  for (let attempt = 0; attempt < 10 && !(await tpl.$('[data-template-card-id="t21"]')); attempt += 1) {
    await tpl.evaluate(() => [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === 'Templates').pop()?.click())
    await sleep(4000)
  }
  await tpl.evaluate(() => document.querySelector('[data-template-card-id="t21"]').click()); await sleep(2500)
  await tpl.evaluate(() => [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === 'Style').pop()?.click()); await sleep(800)
  const key = await tpl.evaluate(() => [...document.querySelectorAll('.lekha-video-frame [data-word-key]')].map((n) => n.getAttribute('data-word-key'))[0])
  const b = await tpl.evaluate((k) => { const n = document.querySelector(`.lekha-video-frame [data-word-key="${k}"]`).getBoundingClientRect(); return { x: n.left + n.width / 2, y: n.top + n.height / 2 } }, key)
  await tpl.mouse.click(b.x, b.y); await sleep(700)
  const tab = await tpl.evaluate(() => { const n = [...document.querySelectorAll('[data-word-popup-panel="true"] [role="tab"]')].find((x) => /style/i.test(x.textContent)); const r = n.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })
  await tpl.mouse.click(tab.x, tab.y); await sleep(300)
  await tpl.evaluate(() => document.querySelector('[aria-label="Word color #3b82f6"]').click()); await sleep(800)
  const tplPayload = await exportNow(tpl)
  const ws = tplPayload?.captions?.[0]?.word_styles || {}
  report(`recreated template ${tplPayload?.captions?.[0]?.template_id || '?'} exports the user word colour`, Object.values(ws).some((v) => v?.color === '#3b82f6'), JSON.stringify(ws))
  console.log('errors', JSON.stringify(tpl.errors)); if (tpl.errors.length) failures += 1
  await tpl.close()
  if (failures) throw new Error(`${failures} check(s) failed`)
  console.log('Styling panel checks passed.')
} finally { await browser.close(); await server.close() }
