// Records the v7 local takes (L1–L3) from the LIVE release running on :3170 (see session.mjs).
// Same method as launch-video-v3/record.mjs: the page runs at 1/6.5 speed in every frame while
// screenshots are taken, so the take plays back at real speed; the cursor is logged, not captured.
// No logo injection and no UI edits: what is recorded is exactly what the release renders.
//   node record.mjs L1 L2 L3   -> takes/<name>.mp4 + takes/<name>.json (cursor log)
import { spawnSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CAPTION_SETS, VIEW, clearOverlays, openEditor, seek, setRate } from './session.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const TAKES = path.join(here, 'takes')
mkdirSync(TAKES, { recursive: true })
const RATE = 1 / 6.5
let cur = 1 // current page speed; sleeps below are in film time
const sleep = (ms) => new Promise((r) => setTimeout(r, ms / cur))

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
/* ---------------- helpers (CSS px of the 1813x1020 recording viewport) ---------------- */
const wait = (ms) => new Promise((r) => setTimeout(r, ms)) // real time, outside a take
const play = (page, from) => page.evaluate(async (t) => {
  const v = document.querySelector('video'); v.muted = true; v.loop = true
  if (t != null) { await new Promise((res) => { v.addEventListener('seeked', res, { once: true }); v.currentTime = t }) }
  await v.play()
  v.playbackRate = window.__rate || 1
}, from)
const pause = (page) => page.evaluate(() => document.querySelector('video').pause())
const centre = (r) => [r[0] + r[2] / 2, r[1] + r[3] / 2]
const must = (r, what) => { if (!r) throw new Error(what + ' not found'); return r }
// a button by visible text / aria-label / title, optionally below a y line
const button = (page, re, minTop = -1) => page.evaluate((src, top) => {
  const rx = new RegExp(src, 'i')
  const b = [...document.querySelectorAll('button')].find((x) => rx.test((x.innerText || x.getAttribute('aria-label') || x.title || '').trim()) && x.getBoundingClientRect().width > 0 && x.getBoundingClientRect().top > top)
  if (!b) return null; const r = b.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]
}, re.source, minTop)
// a word as painted in the preview caption
const previewWord = (page, re) => page.evaluate((src) => {
  const rx = new RegExp(src)
  const v = document.querySelector('video').getBoundingClientRect()
  const el = [...document.querySelectorAll('span, div')].find((n) => n.children.length === 0 && rx.test(n.textContent.trim()) && n.getBoundingClientRect().left > v.left && n.getBoundingClientRect().right < v.right)
  if (!el) return null; const r = el.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]
}, re.source)
// the caption-list line whose text starts with `start`
const listLine = (page, start) => page.evaluate((s) => {
  const el = [...document.querySelectorAll('body *')].find((n) => n.children.length === 0 && n.textContent.trim().startsWith(s) && n.getBoundingClientRect().left < 420 && n.getBoundingClientRect().width > 0)
  if (!el) return null; const r = el.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]
}, start)
// screen box of `word` inside the caption textarea, measured with a mirror div styled like it
const textareaWord = (page, word) => page.evaluate((w) => {
  const ta = document.querySelector('textarea[aria-label="Caption text"]')
  if (!ta) return null
  const i = ta.value.indexOf(w); if (i < 0) return null
  const cs = getComputedStyle(ta), r = ta.getBoundingClientRect()
  const m = document.createElement('div')
  for (const p of ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'paddingTop', 'paddingLeft', 'paddingRight', 'borderTopWidth', 'borderLeftWidth', 'borderTopStyle', 'borderLeftStyle', 'boxSizing']) m.style[p] = cs[p]
  Object.assign(m.style, { position: 'fixed', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', visibility: 'hidden', whiteSpace: 'pre-wrap', overflowWrap: 'break-word' })
  m.textContent = ta.value.slice(0, i)
  const s = document.createElement('span'); s.textContent = w; m.appendChild(s)
  document.body.appendChild(m)
  const q = s.getBoundingClientRect(); m.remove()
  return [q.left, q.top - ta.scrollTop, q.width, q.height]
}, word)
// a larger caption before a take: a real Font Size change through its slider (off camera)
async function setFontSize(page, px) {
  const now = await page.evaluate(() => {
    const sliders = [...document.querySelectorAll('[role=slider]')].filter((s) => s.getBoundingClientRect().left > 1500 && s.getBoundingClientRect().width > 0)
      .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)
    if (!sliders.length) return null
    sliders[0].focus(); return +sliders[0].getAttribute('aria-valuenow')
  })
  if (now == null) throw new Error('font size slider not found')
  for (let v = now; v < px; v++) await page.keyboard.press('ArrowRight')
  await page.evaluate(() => document.activeElement && document.activeElement.blur())
}
// click an empty part of the stage so no caption stays selected (no handles in shot)
const deselect = (page) => page.mouse.click(600, 300)

/* ---------------- takes ---------------- */
const TAKE_SCRIPTS = {
  // L1 · S4 "Every line sits on the timeline, so a fix takes seconds."
  // Timeline open; line 02 carries a misheard word ("knot"), corrected in the caption list.
  async L1(page, tk) {
    await page.mouse.click(...centre(must(await button(page, /TIMELINE/), 'timeline toggle')))
    await wait(1200)
    await deselect(page)
    await play(page, 2.35); await wait(700); await pause(page)
    tk.mouse = [1180, 640]
    await tk.start(); await tk.show()
    await sleep(900)
    tk.note('line')
    const l = must(await listLine(page, 'humility is a strategy'), 'line 02')
    await tk.click(l[0] + l[2] * 0.6, l[1] + l[3] / 2, 900)        // select line 02
    await sleep(600)
    tk.note('edit')
    await tk.click(...centre(must(await button(page, /^Edit caption$/), 'edit caption')), 600)
    await sleep(700)
    await pause(page)
    const w = must(await textareaWord(page, 'knot'), 'misheard word')
    tk.note('fix')
    await tk.move(...centre(w), 600)
    await sleep(120)
    tk.mark('click', ...centre(w))
    await page.mouse.click(...centre(w), { clickCount: 2 })
    await page.evaluate(() => { const ta = document.querySelector('textarea[aria-label="Caption text"]'); const i = ta.value.indexOf('knot'); ta.setSelectionRange(i, i + 4) })
    await sleep(350)
    for (const ch of 'not') { await page.keyboard.type(ch); await sleep(110) }
    await sleep(500)
    tk.note('play')
    await tk.click(...centre(must(await button(page, /play/, 850), 'timeline play')), 800)
    await play(page, 2.3)
    await sleep(2600)                                               // the corrected line plays
    await tk.stop()
  },
  // L2 · S5 "Lift the one word that matters — and put it anywhere."
  // Drag "strategy," out of the line (guides), open its word panel, size it up, warm gradient.
  async L2(page, tk) {
    await deselect(page)
    await play(page, 2.35); await wait(700); await pause(page)
    const w = must(await previewWord(page, /^strategy,?$/), 'preview word')
    const moved = () => page.evaluate(() => {
      const host = document.querySelector('[data-word-key][style*="position: absolute"]')
      if (!host) return null
      const h = host.getBoundingClientRect(); return [h.left, h.top, h.width, h.height]
    })
    tk.mouse = [1300, 560]
    await tk.start(); await tk.show()
    await sleep(400)
    tk.note('drag')
    const [wx, wy] = centre(w)
    await tk.drag(wx, wy, wx + 8, wy - 150, 1100)
    await sleep(250)
    tk.note('word')
    await tk.click(...centre(must(await moved(), 'dragged word')), 500)
    await sleep(500)
    const panel = await page.evaluate(() => { const p = document.querySelector('[data-word-popup-panel]'); if (!p) return null; const r = p.getBoundingClientRect(); return [r.left, r.top, r.width, r.height] })
    const vid = await page.evaluate(() => { const r = document.querySelector('video').getBoundingClientRect(); return [r.left, r.top, r.width, r.height] })
    if (!panel || panel[0] < vid[0] + vid[2]) throw new Error('word panel missing or over the preview ' + JSON.stringify({ panel, vid }))
    tk.note('panel', { panel: panel.map(Math.round) })
    const s = must(await page.evaluate(() => { const el = document.querySelector('[data-word-popup-panel] [role=slider]'); if (!el) return null; const r = el.getBoundingClientRect(); return [r.left, r.top, r.width, r.height] }), 'word size slider')
    tk.note('size')
    const [sx, sy] = centre(s)
    await tk.drag(sx, sy, sx + 120, sy, 800)
    await sleep(250)
    const st = must(await page.evaluate(() => { const b = [...document.querySelectorAll('[data-word-popup-panel] button')].find((x) => x.innerText.trim() === 'Style'); if (!b) return null; const r = b.getBoundingClientRect(); return [r.left, r.top, r.width, r.height] }), 'Style tab')
    await tk.click(...centre(st), 450)
    await sleep(300)
    const g = must(await page.evaluate(() => {
      const b = document.querySelector('[data-word-popup-panel] button[aria-label="Word gradient 1"]') // yellow → red
      if (!b) return null; b.scrollIntoView({ block: 'nearest' }); const r = b.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]
    }), 'warm gradient tile')
    tk.note('gradient')
    await tk.click(...centre(g), 550)
    await sleep(900)
    await page.keyboard.press('Escape')
    await tk.move(1300, 560, 700)
    await play(page, 2.3)
    await sleep(2600)
    await tk.stop()
  },
  // L3 · S6 "Or choose a complete look in one click — your key words already highlighted."
  // Left Templates gallery: the first card plays in place, one click applies "Doubt" (LC T211).
  async L3(page, tk) {
    await deselect(page)
    await play(page, 7.4) // loops at 11.06 s, so line 02 (2.3 s) arrives ~0.3 s after the cards have played
    tk.mouse = [1180, 640]
    await tk.start(); await tk.show()
    await sleep(900)
    tk.note('open')
    await tk.click(...centre(must(await button(page, /^Templates$/), 'Templates rail')), 800)
    await sleep(500)
    const card = must(await page.evaluate(() => {
      const lab = [...document.querySelectorAll('body *')].find((n) => n.children.length === 0 && n.textContent.trim() === 'LC T211')
      if (!lab) return null; const r = lab.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]
    }), 'LC T211 card')
    tk.note('cards')
    await tk.move(240, card[1] - 200, 800)                         // over the first card while it plays
    await sleep(2000)
    // click ~0.45 s before a caption line starts so the template animates in on its own
    // line 02 ("humility is a strategy, not weakness.") is the one the template is seen on
    const STARTS = [2.3]
    for (let i = 0; i < 400; i++) {
      const vt = await page.evaluate(() => document.querySelector('video').currentTime)
      if (STARTS.some((x) => x - vt > 0.38 && x - vt < 0.52)) break
      await sleep(30)
    }
    tk.note('apply')
    await tk.click(240, card[1] - 170, 200)
    await sleep(500)
    await tk.move(1300, 620, 900)
    await sleep(5600)
    await tk.stop()
  },
}

// L1 needs a misheard word in line 02; L2/L3 use the clean transcript.
const CAPTIONS = {
  L1: CAPTION_SETS.en.map(([t, s, e]) => [t.replace('strategy, not weakness.', 'strategy, knot weakness.'), s, e]),
  L2: CAPTION_SETS.en,
  L3: CAPTION_SETS.en,
}

for (const name of process.argv.slice(2)) {
  if (!TAKE_SCRIPTS[name]) throw new Error('unknown take ' + name)
  const { browser, page } = await openEditor({ ...VIEW, captions: CAPTIONS[name] })
  await clearOverlays(page)
  if (name !== 'L3') await setFontSize(page, 30)
  await seek(page, 0)
  const tk = new Take(page, name)
  await TAKE_SCRIPTS[name](page, tk)
  await browser.close()
}
