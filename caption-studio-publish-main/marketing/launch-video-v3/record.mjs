// Records "takes" of the live editor: the page runs at 1/6.5 speed (video, CSS animations, JS clock —
// in every frame, including the sandboxed template-card iframes) while screenshots at the page's device
// scale are taken as fast as possible, so the take plays back at real speed.
//   editor takes: 1813x1020 CSS @1.5 = 2720x1530 (the user's 1360 px screen at 75 % Chrome zoom, 2x pixels)
//   lang-* takes: 1600x900 @2 = 3200x1800 (unchanged; the language cards crop the preview out of them)
//   node record.mjs <take> [<take> ...]      -> takes/<take>.mp4 + takes/<take>.json (cursor log)
// Cursor isn't rendered by headless Chrome, so every move/click is logged and drawn in the composer.
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { CAPTION_SETS, LANG_VIEW, VIEW, openEditor, openPage, seek, setRate } from './editor-session.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const TAKES = path.join(here, 'takes')
mkdirSync(TAKES, { recursive: true })
const RATE = 1 / 6.5
let cur = 1 // current page speed; sleeps below are in film time
const sleep = (ms) => new Promise((r) => setTimeout(r, ms / cur))
const LOGO = readFileSync(path.join(here, '..', 'brand', 'svg', 'lekha-wordmark-dark.svg'), 'utf8')

async function injectLogo(page) {
  await page.evaluate((svg) => {
    const label = [...document.querySelectorAll('header *, body *')].find((n) => n.children.length === 0 && n.textContent.trim() === 'Captions' && n.getBoundingClientRect().top < 60)
    const target = label ? label.parentElement.parentElement : null
    if (!target) return false
    target.innerHTML = `<img src="data:image/svg+xml;utf8,${encodeURIComponent(svg)}" style="height:30px;display:block">`
    return true
  }, LOGO)
}

class Take {
  constructor(page, name) {
    this.page = page; this.name = name; this.frames = []; this.log = []
    this.view = page.viewport()
    this.mouse = [this.view.width / 2, this.view.height / 2]
  }
  filmNow() { return (Date.now() / 1000 - this.t0) * RATE }
  async start() {
    this.dir = path.join(TAKES, this.name)
    rmSync(this.dir, { recursive: true, force: true })
    mkdirSync(this.dir, { recursive: true })
    this.ctl = await this.page.createCDPSession()
    await setRate(this.page, this.ctl, RATE)
    cur = RATE
    this.cap = await this.page.createCDPSession()
    const clip = { x: 0, y: 0, width: this.view.width, height: this.view.height, scale: this.view.deviceScaleFactor }
    this.t0 = Date.now() / 1000
    this.running = true
    this.loop = (async () => {
      while (this.running) {
        const t = this.filmNow()
        const { data } = await this.cap.send('Page.captureScreenshot', { format: 'jpeg', quality: 88, optimizeForSpeed: true, clip })
        writeFileSync(path.join(this.dir, `f${String(this.frames.length).padStart(5, '0')}.jpg`), Buffer.from(data, 'base64'))
        this.frames.push(t)
      }
    })()
    this.mark('cursor', ...this.mouse, 0)
  }
  mark(kind, x, y, visible = 1) { this.log.push({ t: +this.filmNow().toFixed(3), kind, x: Math.round(x), y: Math.round(y), visible }) }
  note(name, data) { this.log.push({ t: +this.filmNow().toFixed(3), kind: 'note', name, ...(data ? { data } : {}) }) }
  async show() { this.mark('cursor', ...this.mouse, 1) }
  async hide() { this.mark('cursor', ...this.mouse, 0) }
  async move(x, y, ms = 700) {
    const [x0, y0] = this.mouse
    const steps = Math.max(2, Math.round(ms / 33))
    for (let i = 1; i <= steps; i++) {
      const k = i / steps, e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2
      const px = x0 + (x - x0) * e, py = y0 + (y - y0) * e
      await this.page.mouse.move(px, py)
      this.mark('cursor', px, py)
      await sleep(ms / steps)
    }
    this.mouse = [x, y]
  }
  async click(x, y, ms = 650) {
    await this.move(x, y, ms)
    await sleep(90)
    this.mark('click', x, y)
    await this.page.mouse.click(x, y)
  }
  async drag(x0, y0, x1, y1, ms = 1100) {
    await this.move(x0, y0, 600)
    await this.page.mouse.down()
    this.mark('down', x0, y0)
    await this.move(x1, y1, ms)
    await this.page.mouse.up()
    this.mark('up', x1, y1)
  }
  async stop() {
    await sleep(100)
    this.running = false
    await this.loop
    await setRate(this.page, this.ctl, 1)
    cur = 1
    const ts = this.frames
    const list = ts.map((t, i) => `file 'f${String(i).padStart(5, '0')}.jpg'\nduration ${(i < ts.length - 1 ? ts[i + 1] - t : 1 / 30).toFixed(4)}`).join('\n')
    writeFileSync(path.join(this.dir, 'list.txt'), list + `\nfile 'f${String(ts.length - 1).padStart(5, '0')}.jpg'\n`)
    const out = path.join(TAKES, `${this.name}.mp4`)
    const r = spawnSync('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(this.dir, 'list.txt'),
      '-vf', 'fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-crf', '15', '-preset', 'medium', '-pix_fmt', 'yuv420p', out], { stdio: 'inherit' })
    if (r.status !== 0) throw new Error('ffmpeg failed for ' + this.name)
    const log = this.log.map((e) => ({ ...e, t: +(e.t - ts[0]).toFixed(3) })).filter((e) => e.t >= 0)
    const dur = ts[ts.length - 1] - ts[0]
    const view = { width: this.view.width, height: this.view.height, scale: this.view.deviceScaleFactor }
    writeFileSync(path.join(TAKES, `${this.name}.json`), JSON.stringify({ duration: +dur.toFixed(3), frames: ts.length, fps: +(ts.length / dur).toFixed(1), view, log }))
    rmSync(this.dir, { recursive: true, force: true })
    const notes = log.filter((e) => e.kind === 'note').map((e) => `${e.name}@${e.t}`).join(' ')
    console.log(`${this.name}: ${ts.length} captures over ${dur.toFixed(1)}s film (${(ts.length / dur).toFixed(1)} fps) ${notes}`)
  }
}

const play = (page, from) => page.evaluate(async (t) => {
  const v = document.querySelector('video'); v.muted = true; v.loop = true
  if (t != null) { await new Promise((res) => { v.addEventListener('seeked', res, { once: true }); v.currentTime = t }) }
  await v.play()
  v.playbackRate = window.__rate || 1
}, from)
const pause = (page) => page.evaluate(() => document.querySelector('video').pause())
// centre of a word in the preview caption
const wordAt = (page, re) => page.evaluate((src) => {
  const rx = new RegExp(src)
  const v = document.querySelector('video').getBoundingClientRect()
  const el = [...document.querySelectorAll('span, div')].find((n) => n.children.length === 0 && rx.test(n.textContent.trim()) && n.getBoundingClientRect().left > v.left && n.getBoundingClientRect().right < v.right)
  if (!el) return null
  const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]
}, re.source)
// centre of a button inside the floating word editor, by its text (or by background colour)
const popupButton = (page, { text, bg }) => page.evaluate((t, c) => {
  const el = [...document.querySelectorAll('[data-word-popup-panel] button')].find((b) => b.getBoundingClientRect().width > 0
    && (t ? b.innerText.trim().toLowerCase() === t.toLowerCase() : getComputedStyle(b).backgroundColor.replace(/\s/g, '') === c))
  if (!el) return null
  const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]
}, text || null, bg || null)
const leafRect = (page, text, maxLeft = 1e9) => page.evaluate((t, mx) => {
  const el = [...document.querySelectorAll('*')].find((n) => n.children.length === 0 && n.textContent.trim() === t && n.getBoundingClientRect().left < mx && n.getBoundingClientRect().width > 0)
  if (!el) return null
  const r = el.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]
}, text, maxLeft)

/* ---------------- takes (coordinates are CSS px of the recording viewport) ---------------- */
// same template (T167, 2nd card in the left gallery) recorded on the preview in another language (1600x900 layout)
async function langTake(page, tk) {
  await page.mouse.click(36, 498)
  await sleep(1200)
  await page.mouse.wheel({ deltaY: 332 })
  await sleep(500)
  await page.mouse.click(150, 400)
  await sleep(600)
  await play(page, 2.25)
  await tk.start()
  await sleep(3600)
  await tk.stop()
}

const TAKE_SCRIPTS = {
  'lang-en': langTake, 'lang-es': langTake, 'lang-hi': langTake, 'lang-ar': langTake,
  // v4 · 01 Upload (staged, see editor-session.mjs): empty editor → Upload Video → pick the clip →
  // Generate Captions → the real generating screen → editor with plain captions playing
  async upload(page, tk) {
    const btn = (re) => page.evaluate((src) => { const rx = new RegExp(src, 'i'); const b = [...document.querySelectorAll('button')].find((x) => rx.test(x.innerText.trim()) && x.getBoundingClientRect().width > 0); if (!b) return null; const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2] }, re.source)
    tk.mouse = [1180, 760]
    await tk.start(); await tk.show()
    await sleep(1500)                                   // headline plays over this
    tk.note('upload')
    const u = await btn(/^Upload Video$/)
    await tk.click(u[0], u[1], 900)
    await sleep(800)
    const dz = await page.evaluate(() => { const r = document.querySelector('[role=dialog] input[type=file]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2 - 20] })
    await tk.move(dz[0], dz[1], 700)
    await sleep(90)
    tk.note('pick')
    tk.mark('click', dz[0], dz[1])
    const [chooser] = await Promise.all([page.waitForFileChooser(), page.mouse.click(dz[0], dz[1])])
    await chooser.accept([path.join(here, 'mock', 'upload', 'morning-walk.mov')])
    await sleep(900)
    const g = await btn(/Generate Captions/)
    tk.note('generate')
    await tk.click(g[0], g[1], 800)
    await sleep(3700)                                   // "Crafting your captions": step 1 completes at 3 s
    tk.note('ready')
    await page.evaluate(() => window.__finishUpload())
    await page.waitForSelector('video', { timeout: 60000 })
    await injectLogo(page)
    await play(page, 0)
    await tk.move(1500, 700, 900)
    await sleep(3800)                                   // plain captions playing
    await tk.stop()
  },
  // v4 · 02 Style: font size, then position (no font-family change)
  async style(page, tk) {
    await play(page, 2.3)
    await tk.start(); await tk.show()
    await sleep(1400)
    tk.note('size')
    await tk.drag(1551, 329, 1645, 329, 1300)           // font size 17 → ~35 px
    await sleep(700)
    tk.note('posY')
    await tk.drag(1721, 708, 1662, 708, 1100)           // position Y 75 → ~55 %
    await sleep(1800)
    await tk.stop()
  },
  // v4 · 03 One word: click it, make it bigger, colour it orange (no emphasis box, no animation)
  async floating(page, tk) {
    await play(page, 2.3); await sleep(900); await pause(page)   // playhead on line 02
    const w = await wordAt(page, /^strategy,?$/)
    if (!w) throw new Error('word not found')
    await tk.start(); await tk.show()
    await sleep(1400)
    tk.note('word')
    await tk.click(w[0], w[1], 900)                     // open the floating editor on one word
    await sleep(900)
    const s = await page.evaluate(() => { const el = document.querySelector('[data-word-popup-panel] [role=slider]'); const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2] })
    tk.note('size')
    await tk.drag(s[0], s[1], s[0] + 70, s[1], 1000)    // word size up
    await sleep(600)
    let p = await popupButton(page, { text: 'Style' }); await tk.click(p[0], p[1], 600)
    await sleep(500)
    tk.note('colour')
    p = await popupButton(page, { bg: 'rgb(245,166,35)' }); await tk.click(p[0], p[1], 600)   // orange
    await sleep(1000)
    tk.note('close')
    await page.keyboard.press('Escape')
    await tk.move(1500, 760, 800)
    await play(page, 2.3)                               // the line plays with the edited word
    await sleep(2600)
    await tk.stop()
  },
  // v5 · One word: drag it out of the line to its own spot FIRST, then open the floating editor on it,
  // size it up and colour it orange (the popup opens beside the preview, never over it)
  async 'floating-v5'(page, tk) {
    await play(page, 2.3); await sleep(900); await pause(page)   // playhead on line 02
    const w = await wordAt(page, /^strategy,?$/)
    if (!w) throw new Error('word not found')
    // the moved word: its painted layer is offset from its hit box (app issue, see README), so click
    // inside the overlap of the two — on the word as drawn, where the click also lands
    const moved = () => page.evaluate(() => {
      const host = document.querySelector('[data-word-key][style*="position: absolute"]')
      if (!host) return null
      const paint = [...host.querySelectorAll('span')].find((n) => getComputedStyle(n).position === 'absolute') || host
      const h = host.getBoundingClientRect(), q = paint.getBoundingClientRect()
      const x0 = Math.max(h.left, q.left), x1 = Math.min(h.right, q.right), y0 = Math.max(h.top, q.top), y1 = Math.min(h.bottom, q.bottom)
      return x1 > x0 && y1 > y0 ? [(x0 + x1) / 2, (y0 + y1) / 2] : [h.left + h.width / 2, h.top + h.height / 2]
    })
    await tk.start(); await tk.show()
    await sleep(1000)
    tk.note('drag')
    await tk.drag(w[0], w[1], w[0] + 12, w[1] - 112, 1200)   // pull the word up out of the line
    await sleep(700)
    const m = await moved()
    if (!m) throw new Error('dragged word not found')
    tk.note('word')
    await tk.click(m[0], m[1], 700)                      // open the floating editor on the moved word
    await sleep(900)
    const pr = await page.evaluate(() => { const p = document.querySelector('[data-word-popup-panel]'); if (!p) return null; const r = p.getBoundingClientRect(); return [r.left, r.top, r.width, r.height] })
    const vr = await page.evaluate(() => { const r = document.querySelector('video').getBoundingClientRect(); return [r.left, r.top, r.width, r.height] })
    if (!pr || pr[0] < vr[0] + vr[2]) throw new Error('popup missing or over the preview ' + JSON.stringify({ pr, vr }))
    tk.note('popup', { popup: pr.map(Math.round), video: vr.map(Math.round) })
    const s = await page.evaluate(() => { const el = document.querySelector('[data-word-popup-panel] [role=slider]'); const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2] })
    tk.note('size')
    await tk.drag(s[0], s[1], s[0] + 82, s[1], 1000)     // word size up
    await sleep(600)
    let p = await popupButton(page, { text: 'Style' }); await tk.click(p[0], p[1], 600)
    await sleep(500)
    tk.note('colour')
    p = await popupButton(page, { bg: 'rgb(245,166,35)' })
    if (!p) throw new Error('orange swatch not found')
    await tk.click(p[0], p[1], 600)                      // orange
    await sleep(1000)
    tk.note('close')
    const x = await page.evaluate(() => {
      const p = document.querySelector('[data-word-popup-panel]').getBoundingClientRect()
      const b = [...document.querySelectorAll('[data-word-popup-panel] button')].filter((n) => { const r = n.getBoundingClientRect(); return r.width > 0 && r.top < p.top + 60 && !n.innerText.trim() })
        .sort((a, c) => c.getBoundingClientRect().right - a.getBoundingClientRect().right)[0]
      const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]
    })
    await tk.click(x[0], x[1], 700)                      // close the floating editor
    await sleep(300)
    await tk.move(1500, 760, 700)
    await play(page, 2.3)                                // the line plays with the moved, bigger, orange word
    await sleep(3000)
    await tk.stop()
  },
  // v4 · 04 + 05 Templates: two cards at real speed, then one click on T167 timed just before a line
  // starts, so the template animates in on its own (no seek, no jump)
  async templates(page, tk) {
    await play(page, 0.2)
    await tk.start(); await tk.show()
    await sleep(1400)
    tk.note('open')
    await tk.click(36, 558, 900)                        // left Templates gallery
    await sleep(500)
    const l1 = await leafRect(page, 'LC T166', 400), l2 = await leafRect(page, 'LC T167', 400)
    if (!l1 || !l2) throw new Error('cards not found')
    const card = (l) => page.evaluate((y) => {
      // the card button that contains the label at height y
      const el = [...document.querySelectorAll('button, [role=button], div')].filter((n) => { const r = n.getBoundingClientRect(); return r.left < 120 && r.right < 400 && r.width > 240 && r.top < y && r.bottom > y && r.height > 280 && r.height < 380 })
        .sort((a, b) => a.getBoundingClientRect().height - b.getBoundingClientRect().height)[0]
      if (!el) return null; const r = el.getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map((n) => Math.round(n))
    }, l[1] + 4)
    const r1 = await card(l1), r2 = await card(l2)
    const vr = await page.evaluate(() => { const r = document.querySelector('video').getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map((n) => Math.round(n)) })
    tk.note('rects', { card1: r1, card2: r2, video: vr })
    const c1 = [222, l1[1] - 160], c2 = [222, l2[1] - 160]
    tk.note('card1')
    await tk.move(c1[0] + 70, c1[1] + 40, 800)
    await sleep(2000)
    tk.note('card2')
    await tk.move(c2[0] + 40, c2[1] + 20, 800)
    await sleep(1600)
    // wait until the playhead is ~0.45 s before the next caption line, then click
    const STARTS = [0, 2.3, 5.1, 7.7, 11.06]
    for (let i = 0; i < 400; i++) {
      const vt = await page.evaluate(() => document.querySelector('video').currentTime)
      if (STARTS.some((s) => s - vt > 0.38 && s - vt < 0.52)) break
      await sleep(30)
    }
    tk.note('apply')
    await tk.click(c2[0], c2[1], 150)                   // one click: apply LC T167
    await sleep(5600)                                   // the next lines animate in with the template
    await tk.stop()
  },
  // background for export-mock.html: the real editor playing, no cursor (the mock take draws it)
  async 'export-bg'(page, tk) {
    await play(page, 2.3)
    await tk.start()
    await sleep(10500)
    await tk.stop()
  },
}

// 06 Export: the signed-in panel recreated in export-mock.html over the export-bg recording
async function recordExportMock() {
  const hit = JSON.parse(readFileSync(path.join(TAKES, 'export-bg.json'), 'utf8')).exportButton
  const url = `${pathToFileURL(path.join(here, 'export-mock.html')).href}?hit=${hit.join(',')}`
  const { browser, page } = await openPage(url)
  await page.evaluate(() => window.ready)
  const tk = new Take(page, 'export')
  await tk.start(); await tk.show()
  await page.evaluate(async () => { const v = document.getElementById('bg'); v.currentTime = 0; await v.play(); v.playbackRate = window.__rate })
  await sleep(500)
  tk.note('export')
  await tk.click(hit[0] + hit[2] / 2, hit[1] + hit[3] / 2, 1000)   // top-bar EXPORT
  await sleep(1300)
  const row = await page.evaluate(() => { const r = document.querySelector('[data-quality="1080p"]').getBoundingClientRect(); return [r.left + r.width * 0.42, r.top + r.height / 2] })
  tk.note('quality')
  await tk.move(row[0], row[1], 900)
  await sleep(500)
  await tk.click(row[0], row[1], 150)                 // 1080p Full HD (the row starts the render)
  await page.waitForFunction(() => window.__done === true, { timeout: 120000 })
  tk.note('done')
  await sleep(2600)                                    // hold the ready state (100 %, toast)
  await tk.stop()
  await browser.close()
}

for (const name of process.argv.slice(2)) {
  if (name === 'export') { await recordExportMock(); continue }
  const lang = name.startsWith('lang-') ? name.slice(5) : 'en'
  const view = name.startsWith('lang-') ? LANG_VIEW : VIEW
  const stage = name === 'upload' ? 'upload' : null
  const { browser, page } = await openEditor({ ...view, captions: CAPTION_SETS[lang], stage })
  await injectLogo(page)
  if (!stage) await seek(page, 0)
  const tk = new Take(page, name)
  await TAKE_SCRIPTS[name](page, tk)
  if (name === 'export-bg') {
    // where the EXPORT button sits in this recording, for the mock's click target
    const r = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim().toUpperCase() === 'EXPORT'); const q = b.getBoundingClientRect(); return [q.left, q.top, q.width, q.height].map((n) => +n.toFixed(1)) })
    const f = path.join(TAKES, 'export-bg.json')
    writeFileSync(f, JSON.stringify({ ...JSON.parse(readFileSync(f, 'utf8')), exportButton: r }))
  }
  await browser.close()
}
