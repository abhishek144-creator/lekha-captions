import { resolve } from 'node:path'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import puppeteer from 'puppeteer'

// Real Dashboard with the editor-journey auth/API doubles. Checks that the word
// editor never covers the video preview (desktop docks it in the inspector
// column, tablet/phone in the dock sheet, fullscreen floats it beside the
// frame), and that its Style-tab colour controls recolour the right word, are
// undoable, persist, and paint backgrounds/gradients like the export.

const server = await createServer({
  configFile: false, envDir: false, logLevel: 'error', plugins: [react()],
  resolve: { alias: [
    { find: '@/lib/AuthContext', replacement: resolve('e2e/fixtures/editorAuth.jsx') },
    { find: '@/context/AuthContext', replacement: resolve('e2e/fixtures/editorAuth.jsx') },
    { find: '@/lib/firebase', replacement: resolve('e2e/fixtures/editorFirebase.js') },
    { find: '@', replacement: resolve('src') },
  ] },
  define: { 'import.meta.env.VITE_API_BASE_URL': '""', 'import.meta.env.VITE_LOCAL_API_RETRY_MS': '"0"' },
  server: { host: '127.0.0.1', port: 4192, strictPort: true },
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
    return request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) })
  })
  await page.goto('http://127.0.0.1:4192/e2e/fixtures/editor.html')
  await page.evaluate((v) => localStorage.setItem('captionEditorState', JSON.stringify(v)), { ...mkDraft(aspect), captionStyle: { ...mkDraft(aspect).captionStyle, ...styleOverrides } })
  await page.goto('http://127.0.0.1:4192/e2e/fixtures/editor.html?restoreSession=1')
  await page.waitForSelector('.lekha-video-frame [data-word-key="a-1"]', { timeout: 30000 })
  await sleep(1500)
  return page
}
const rectOf = (page, sel) => page.evaluate((s) => { const n = document.querySelector(s); if (!n) return null; const b = n.getBoundingClientRect(); return { l: Math.round(b.left), t: Math.round(b.top), r: Math.round(b.right), b: Math.round(b.bottom) } }, sel)
const overlap = (a, b) => a && b ? Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t)) : 0
async function openPopup(page, wordIndex = 1) {
  const w = await page.evaluate((i) => { const n = document.querySelector(`.lekha-video-frame [data-word-key="a-${i}"]`); const b = n.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 } }, wordIndex)
  await page.mouse.click(w.x, w.y)
  await page.waitForSelector('[data-word-popup-panel="true"]', { timeout: 8000 }).catch(() => {})
  await sleep(500)
}

const modes = (process.env.MODE || 'layout,fullscreen,timeline,color,sync').split(',')
let failures = 0
const recordResult = (ok) => { if (!ok) failures += 1 }
try {
  for (const mode of modes) {
  if (mode === 'layout' || mode === 'fullscreen') {
    const fullscreen = mode === 'fullscreen'
    for (const [w, h] of fullscreen ? [[1024, 768], [1440, 900], [1920, 1080]] : [[320, 640], [375, 812], [768, 1024], [1024, 768], [1280, 800], [1440, 900], [1920, 1080]]) {
      for (const aspect of (process.env.ASPECTS || '9:16').split(',')) {
        const page = await open(w, h, aspect === '9:16' ? null : aspect)
        await openPopup(page)
        if (fullscreen) {
          await page.keyboard.press('Escape')
          await sleep(300)
          await page.evaluate(() => [...document.querySelectorAll('button[aria-label]')].find((b) => /expand preview|full ?screen/i.test(b.getAttribute('aria-label')))?.click())
          await sleep(800)
          await openPopup(page)
        }
        const frame = await rectOf(page, '.lekha-video-frame')
        const panel = await rectOf(page, '[data-word-popup-panel="true"]')
        const word = await rectOf(page, '.lekha-video-frame [data-word-key="a-1"]')
        const inViewport = panel && panel.l >= 0 && panel.t >= 0 && panel.r <= w && panel.b <= h
        const placement = await page.evaluate(() => document.querySelector('[data-word-popup-panel="true"]')?.dataset.placement)
        const wordVisible = word && word.t >= 0 && word.b <= h && word.l >= 0 && word.r <= w
        console.log(`${w}x${h} ${aspect}${fullscreen ? ' FS' : ''} [${placement}] wordVisible=${wordVisible}: frame ${JSON.stringify(frame)} panel ${JSON.stringify(panel)} overlapFrame=${overlap(frame, panel)}px2 overlapWord=${overlap(word, panel)} inViewport=${inViewport}`)
        const ok = overlap(frame, panel) === 0 && inViewport && wordVisible
        recordResult(ok)
        console.log(`${ok ? 'OK  ' : 'FAIL'} layout ${w}x${h}${fullscreen ? ' fullscreen' : ''}`)
        await page.screenshot({ path: `test-artifacts/popup-${w}x${h}-${aspect.replace(':', 'x')}${fullscreen ? '-fs' : ''}.png` })
        await page.close()
      }
    }
  }
  if (mode === 'timeline') {
    const page = await open(1813, 1020, null)
    await openPopup(page)
    const before = await page.$eval('[data-word-popup-panel]', panel => ({ height: parseFloat(panel.style.maxHeight), placement: panel.dataset.placement }))
    await page.click('button[title="Expand timeline"]')
    await page.waitForSelector('[role="separator"][aria-label^="Resize timeline"]')
    const separator = await page.$('[role="separator"][aria-label^="Resize timeline"]')
    const handle = await separator.boundingBox()
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
    await page.mouse.down()
    await page.mouse.move(handle.x + handle.width / 2, handle.y - 160, { steps: 8 })
    await page.mouse.up()
    await sleep(400)
    const result = await page.evaluate(() => {
      const panel = document.querySelector('[data-word-popup-panel]')
      const timeline = document.querySelector('[data-word-editor-floor]')
      const p = panel.getBoundingClientRect()
      const t = timeline.getBoundingClientRect()
      const x = (Math.max(p.left, t.left) + Math.min(p.right, t.right)) / 2
      const y = Math.max(p.top, t.top) + 10
      return {
        height: parseFloat(panel.style.maxHeight), placement: panel.dataset.placement,
        extendsBehindTimeline: p.bottom > t.top + 40,
        timelineOnTop: Boolean(document.elementFromPoint(x, y)?.closest('[data-timeline-root]')),
      }
    })
    const ok = before.placement === 'floating' && result.placement === 'floating'
      && Math.abs(before.height - result.height) < 2 && result.extendsBehindTimeline && result.timelineOnTop
    recordResult(ok)
    console.log(`${ok ? 'OK  ' : 'FAIL'} timeline keeps the full floating editor behind its layer: ${JSON.stringify({ before, result })}`)
    await page.screenshot({ path: 'test-artifacts/popup-expanded-timeline.png' })
    await page.close()
  }
  if (mode === 'color') {
    for (const kind of (process.env.KINDS || 'plain').split(',')) {
      const page = await open(1440, 900, null)
      if (kind !== 'plain') {
        for (let attempt = 0; attempt < 10 && !(await page.$(`[data-template-card-id][data-template-kind="${kind}"]`)); attempt += 1) {
          await page.evaluate(() => [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === 'Templates').pop()?.click())
          await sleep(4000)
        }
        await page.evaluate((k) => document.querySelector(`[data-template-card-id][data-template-kind="${k}"]`).click(), kind)
        await sleep(2000)
        await page.evaluate(() => [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === 'Style').pop()?.click())
        await sleep(800)
      }
      const label = kind
      const report = (name, ok, detail) => { recordResult(ok); console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}: ${name} ${detail || ''}`) }
      const wordColor = () => page.evaluate(() => { const n = document.querySelector('.lekha-video-frame [data-word-key="a-1"]'); const v = n?.querySelector('[data-word-drag-visual="true"],[data-source-word-visual="true"]') || n; const cs = v && getComputedStyle(v); return cs && { color: cs.color, fill: cs.webkitTextFillColor, bgImage: cs.backgroundImage.slice(0, 60), bg: cs.backgroundColor } })
      const siblingColor = () => page.evaluate(() => { const n = document.querySelector('.lekha-video-frame [data-word-key="a-2"]'); const v = n?.querySelector('[data-word-drag-visual="true"],[data-source-word-visual="true"]') || n; return v && getComputedStyle(v).color })
      const ws = () => page.evaluate(() => JSON.parse(localStorage.getItem('captionEditorState')).captions[0].wordStyles?.['a-1'] || {})
      const sib0 = await siblingColor()
      await openPopup(page)
      // open the Style (colour) tab
      await page.evaluate(() => [...document.querySelectorAll('[data-word-popup-panel="true"] [role="tab"]')].find((t) => /style/i.test(t.textContent))?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })))
      const tabBtn = await page.evaluate(() => { const t = [...document.querySelectorAll('[data-word-popup-panel="true"] [role="tab"]')].find((n) => /style/i.test(n.textContent)); const b = t.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 } })
      await page.mouse.click(tabBtn.x, tabBtn.y); await sleep(400)
      const tabOpen = await page.evaluate(() => !!document.querySelector('[aria-label="Word color #ef4444"]'))
      report('Style tab opens colour controls', tabOpen)
      const shown = await page.evaluate(() => document.querySelector('[aria-label="Custom word color"]')?.value)
      report('current colour indicator matches the word', shown === '#ffffff', `picker shows ${shown}`)
      // swatch click with a real pointer
      const sw = await page.evaluate(() => { const b = document.querySelector('[aria-label="Word color #ef4444"]').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 } })
      await page.mouse.click(sw.x, sw.y); await sleep(900)
      const c1 = await wordColor()
      report('swatch recolours the word immediately', /239, 68, 68/.test(c1?.color + c1?.fill), JSON.stringify(c1))
      report('swatch leaves sibling words alone', (await siblingColor()) === sib0, await siblingColor())
      report('swatch saved to word style', (await ws()).color === '#ef4444', JSON.stringify(await ws()))
      // custom picker
      await page.evaluate(() => { const input = document.querySelector('[aria-label="Custom word color"]'); const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(input, '#22c55e'); input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })) })
      await sleep(500)
      const c2 = await wordColor()
      report('custom picker recolours the word', /34, 197, 94/.test(c2?.color + c2?.fill), JSON.stringify(c2))
      // undo
      await page.mouse.click(470, 700); await sleep(200)
      await page.keyboard.down('Control'); await page.keyboard.press('z'); await page.keyboard.up('Control'); await sleep(600)
      report('undo reverts the last colour change', (await ws()).color === '#ef4444', `after undo ${(await ws()).color}`)
      await page.keyboard.down('Control'); await page.keyboard.press('y'); await page.keyboard.up('Control'); await sleep(600)
      report('redo re-applies it', (await ws()).color === '#22c55e', `after redo ${(await ws()).color}`)
      // gradient + background
      await openPopup(page)
      const tab2 = await page.evaluate(() => { const t = [...document.querySelectorAll('[data-word-popup-panel="true"] [role="tab"]')].find((n) => /style/i.test(n.textContent)); const b = t.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 } })
      await page.mouse.click(tab2.x, tab2.y); await sleep(400)
      report('reopened editor shows the word colour', (await page.evaluate(() => document.querySelector('[aria-label="Custom word color"]')?.value)) === '#22c55e', await page.evaluate(() => document.querySelector('[aria-label="Custom word color"]')?.value))
      await page.evaluate(() => document.querySelector('[aria-label="Word gradient 1"]').click()); await sleep(500)
      const g = await wordColor()
      report('gradient applies to the word', /gradient/.test(g?.bgImage), JSON.stringify(g))
      const bgSwitch = await page.evaluate(() => { const sws = [...document.querySelectorAll('[data-word-popup-panel="true"] [role="switch"]')]; const sw = sws[0]; if (!sw) return null; const b = sw.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 } })
      if (bgSwitch) { await page.mouse.click(bgSwitch.x, bgSwitch.y); await sleep(500) }
      // make the background bright green and count its pixels around the word
      await page.evaluate(() => { const input = document.querySelector('[aria-label="Word background color"]'); if (!input) return; const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(input, '#00ff00'); input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })) })
      await sleep(600)
      const pixelCounts = async () => {
        const clip = await page.evaluate(() => { const n = document.querySelector('.lekha-video-frame [data-word-key="a-1"]'); const b = n.getBoundingClientRect(); return { x: b.left - 6, y: b.top - 6, width: b.width + 12, height: b.height + 12 } })
        const png = await page.screenshot({ clip, encoding: 'base64', captureBeyondViewport: false })
        return page.evaluate(async (src) => { const img = new Image(); img.src = 'data:image/png;base64,' + src; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0); const d = ctx.getImageData(0, 0, c.width, c.height).data; let green = 0, warm = 0; for (let i = 0; i < d.length; i += 4) { const r = d[i], g = d[i + 1], b = d[i + 2]; if (g > 130 && r < 90 && b < 90) green++; if (r > 180 && b < 100 && g < 220) warm++ } return { green, warm } }, png)
      }
      const px = await pixelCounts()
      report('word background shows together with a text gradient', px.green > 150 && px.warm > 20, JSON.stringify(px))
      await page.screenshot({ captureBeyondViewport: false, path: `test-artifacts/paint-${kind}.png`, clip: await page.evaluate(() => { const n = document.querySelector('.lekha-video-frame [data-word-key="a-1"]'); const b = n.getBoundingClientRect(); return { x: b.left - 60, y: b.top - 20, width: b.width + 120, height: b.height + 40 } }) })
      await page.evaluate(() => [...document.querySelectorAll('[data-word-popup-panel="true"] button')].find((n) => n.textContent.includes('Highlight Gradient'))?.click())
      await sleep(400)
      await page.evaluate(() => { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; for (const label of ['Highlight gradient start color', 'Highlight gradient end color']) { const el = document.querySelector(`[aria-label="${label}"]`); setter.call(el, '#00ff00'); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })) } })
      await sleep(600)
      const hx = await pixelCounts()
      report('highlight gradient paints the word box', hx.green > 150, JSON.stringify(hx))
      await sleep(900)
      // persistence
      const saved = await ws()
      await page.goto('http://127.0.0.1:4192/e2e/fixtures/editor.html?restoreSession=1')
      await page.waitForSelector('.lekha-video-frame [data-word-key="a-1"]', { timeout: 30000 }); await sleep(1500)
      const reloaded = await ws()
      report('colours persist after reload', reloaded.textGradient === saved.textGradient && reloaded.backgroundColor === saved.backgroundColor, JSON.stringify(reloaded))
      recordResult(page.errors.length === 0)
      console.log('errors', JSON.stringify(page.errors))
      await page.close()
    }
  }
  if (mode === 'sync') {
    const page = await open(1440, 900, null, { text_color: '#facc15', font_size: 30 })
    const report = (name, ok, detail) => { recordResult(ok); console.log(`${ok ? 'OK  ' : 'FAIL'} sync: ${name} ${detail || ''}`) }
    const ws = () => page.evaluate(() => JSON.parse(localStorage.getItem('captionEditorState')).captions[0].wordStyles?.['a-1'] || {})
    const wordColor = () => page.evaluate(() => { const n = document.querySelector('.lekha-video-frame [data-word-key="a-1"]'); const v = n.querySelector('[data-word-drag-visual="true"]') || n; return getComputedStyle(v).color })
    await openPopup(page)
    report('size control shows the caption size', await page.evaluate(() => [...document.querySelectorAll('[data-word-popup-panel="true"] span')].some((n) => n.textContent.trim() === '30px')))
    const styleTab = async () => { const t = await page.evaluate(() => { const n = [...document.querySelectorAll('[data-word-popup-panel="true"] [role="tab"]')].find((x) => /style/i.test(x.textContent)); const b = n.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 } }); await page.mouse.click(t.x, t.y); await sleep(400) }
    await styleTab()
    const picker = () => page.evaluate(() => document.querySelector('[aria-label="Custom word color"]')?.value)
    report('picker shows the inherited caption colour', (await picker()) === '#facc15', await picker())
    // hex input
    const hex = await page.$('[aria-label="Word color hex"]')
    await hex.click(); await hex.type('zz12')
    report('invalid hex is flagged', await page.evaluate(() => document.querySelector('[aria-label="Word color hex"]').getAttribute('aria-invalid') === 'true'))
    await page.keyboard.press('Enter'); await sleep(300)
    report('invalid hex is rejected without changing the word', !(await ws()).color, JSON.stringify(await ws()))
    const hex2 = await page.$('[aria-label="Word color hex"]'); await page.keyboard.press('Tab'); await hex2.click(); await hex2.type('#3B82F6')
    await page.keyboard.press('Enter'); await sleep(900)
    report('hex input recolours the word', (await ws()).color === '#3b82f6' && /59, 130, 246/.test(await wordColor()), `${(await ws()).color} ${await wordColor()}`)
    // reset
    await page.evaluate(() => [...document.querySelectorAll('[data-word-popup-panel="true"] button')].find((b) => b.textContent.trim() === 'Use caption color')?.click()); await sleep(900)
    report('reset returns the word to the caption colour', !(await ws()).color && /250, 204, 21/.test(await wordColor()), `${JSON.stringify(await ws())} ${await wordColor()}`)
    // sidebar caption colour change reflects in the word editor while the word has no own colour
    recordResult(page.errors.length === 0)
    console.log('errors', JSON.stringify(page.errors))
    await page.close()
  }
  }
  if (failures) throw new Error(`${failures} word editor check(s) failed`)
  console.log('Word editor checks passed.')
} finally { await browser.close(); await server.close() }
