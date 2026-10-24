import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import puppeteer from 'puppeteer'

// Studio caption set (lekha-captions-lc-studio.html), end to end:
// applies each template in the real editor, checks every scene on the canvas
// once its words have entered (all words shown, accent keyword, no forced
// 900 weight, inside the frame), captures the real /api/export request, renders
// it with the export renderer, and compares word positions and sizes with the
// canvas. Hindi captions run through the complex-script rules on a subset.
// STUDIO_SET=picks checks the Picks set (lekha-captions-lc-picks.html, left
// gallery) the same way. STUDIO_TEMPLATE_FILTER=T230 narrows the run;
// STUDIO_SKIP_EXPORT=1 skips renders.
const execFileAsync = promisify(execFile)
const root = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const sleep = (ms) => new Promise((done) => setTimeout(done, ms))
// STUDIO_SET=lc5 checks the LC 5 set (left gallery); STUDIO_HINDI_ALL=1 runs
// every template of the set in Hindi too.
const SET = ['picks', 'lc5'].includes(process.env.STUDIO_SET) ? process.env.STUDIO_SET : 'studio'
const studioAsset = await fs.readFile(path.join(root, 'src', 'assets', SET === 'lc5' ? 'lekha-captions-lc-5.html' : `lekha-captions-lc-${SET}.html`), 'utf8')
const ALL_IDS = [...studioAsset.matchAll(/^T\('(T\d+)'/gm)].map((match) => match[1])
const filter = String(process.env.STUDIO_TEMPLATE_FILTER || '').split(',').map((id) => id.trim().toUpperCase()).filter(Boolean)
const IDS = filter.length ? ALL_IDS.filter((id) => filter.includes(id)) : ALL_IDS
// Templates whose design uses capitals, small caps or tracking: Hindi must drop them.
const HINDI_IDS = process.env.STUDIO_HINDI_ALL === '1'
  ? IDS
  : ({ picks: ['T242', 'T243', 'T252', 'T255', 'T260', 'T272', 'T273', 'T275'], lc5: ['T212', 'T219'], studio: ['T230', 'T234', 'T236', 'T240'] }[SET]).filter((id) => IDS.includes(id))
const SKIP_EXPORT = process.env.STUDIO_SKIP_EXPORT === '1'

const LINES = {
  en: [
    'Most advice online is noise not wisdom',
    'The useful kind is usually boring to hear',
    'Do the obvious thing longer than anyone else',
    'That is the whole secret really',
    'Consistency beats intensity every time',
  ],
  hi: [
    'ऑनलाइन ज़्यादातर सलाह शोर है ज्ञान नहीं',
    'काम की सलाह अक्सर सुनने में उबाऊ होती है',
    'जो ज़ाहिर है वही ज़्यादा देर तक करो',
    'बस यही है पूरा राज़',
    'निरंतरता हर बार तीव्रता को हराती है',
  ],
}
const CAPTION_SECONDS = 2

const mkDraft = (lang) => ({
  ownerUid: 'editor-test-a', projectId: `studio-${lang}`, fileId: '123e4567-e89b-12d3-a456-426614174000',
  videoUrl: '/launch-video.mp4', duration: 10, originalFileName: 'fixture.mp4',
  captions: LINES[lang].map((text, index) => {
    const words = text.split(/\s+/)
    const start = index * CAPTION_SECONDS
    const step = (CAPTION_SECONDS * 0.8) / words.length
    return {
      id: `c${index}`, text, start_time: start, end_time: start + CAPTION_SECONDS, wordStyles: {},
      words: words.map((word, wordIndex) => ({ word, start: start + wordIndex * step, end: start + (wordIndex + 1) * step })),
    }
  }),
  captionTracks: [], activeCaptionTrackId: 'source', settings: {},
  captionStyle: { font_family: 'Inter', font_size: 24, position_y: 70, text_color: '#ffffff', has_background: false },
})

const server = await createServer({
  configFile: false, envDir: false, logLevel: 'error',
  plugins: [react()],
  resolve: { alias: [
    { find: '@/lib/AuthContext', replacement: path.resolve(root, 'e2e/fixtures/editorAuth.jsx') },
    { find: '@/context/AuthContext', replacement: path.resolve(root, 'e2e/fixtures/editorAuth.jsx') },
    { find: '@/lib/firebase', replacement: path.resolve(root, 'e2e/fixtures/editorFirebase.js') },
    { find: '@', replacement: path.resolve(root, 'src') },
  ] },
  root,
  define: { 'import.meta.env.VITE_API_BASE_URL': '""', 'import.meta.env.VITE_LOCAL_API_RETRY_MS': '"0"' },
  server: { host: '127.0.0.1', port: 4196, strictPort: true },
})
await server.listen()
const browser = await puppeteer.launch({ headless: true, args: process.env.CI ? ['--no-sandbox'] : [] })
const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'studio-templates-'))
const failures = []
const check = (ok, message) => { if (!ok) failures.push(message) }

async function openEditor(lang) {
  // A fresh context per page: no saved project leaks between runs.
  const context = await (browser.createBrowserContext?.() ?? browser.createIncognitoBrowserContext())
  const page = await context.newPage()
  const closePage = page.close.bind(page)
  page.close = async () => { await closePage(); await context.close() }
  await page.setViewport({ width: 1440, height: 1000 })
  page.errors = []
  page.exportPayloads = []
  page.on('pageerror', (error) => page.errors.push(error.message))
  await page.setRequestInterception(true)
  page.on('request', (request) => {
    const url = new URL(request.url())
    const external = url.hostname !== '127.0.0.1' && !['data:', 'blob:'].includes(url.protocol)
    // Google Fonts may load (the templates need their faces); nothing else leaves.
    if (external && !['fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname)) return request.abort()
    if (external || !url.pathname.startsWith('/api/')) return request.continue()
    let payload = { success: true }
    if (url.pathname === '/api/editor-preferences/load') payload.preferences = { revision: 0, brand_kits: [], glossary_terms: [] }
    else if (url.pathname === '/api/draft/load') payload = { revision: 0, project_id: null, draft: null }
    else if (url.pathname === '/api/projects/list') payload.projects = []
    else if (url.pathname === '/api/workspaces') payload.workspaces = []
    else if (url.pathname === '/api/fonts') payload = { fonts: [] }
    else if (url.pathname === '/api/export') {
      page.exportPayloads.push(JSON.parse(request.postData()))
      return request.respond({ status: 503, contentType: 'application/json', body: JSON.stringify({ detail: 'probe: not rendering' }) })
    }
    return request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) })
  })
  await page.goto('http://127.0.0.1:4196/e2e/fixtures/editor.html')
  await page.evaluate((value) => localStorage.setItem('captionEditorState', JSON.stringify(value)), mkDraft(lang))
  await page.goto('http://127.0.0.1:4196/e2e/fixtures/editor.html?restoreSession=1')
  await page.waitForSelector('.lekha-video-frame [data-word-key="c0-0"]', { timeout: 60000 })
  await page.waitForFunction(() => (document.querySelector('.lekha-video-frame video')?.duration || 0) > 9, { timeout: 30000 }).catch(() => {})
  return page
}

async function applyTemplate(page, id) {
  const card = `[data-template-card-id="${id}"]`
  // The Studio set lives in the Styling panel's Templates tab (right side);
  // the Picks are in the left gallery.
  for (let attempt = 0; attempt < 12 && !(await page.$(card)); attempt += 1) {
    await page.evaluate((onRight) => [...document.querySelectorAll('button')]
      .filter((button) => button.textContent.trim().toLowerCase() === 'templates'
        && (button.getBoundingClientRect().left > window.innerWidth / 2) === onRight)
      .forEach((button) => button.click()), SET === 'studio')
    await sleep(2500)
  }
  await page.waitForSelector(card, { timeout: 30000 })
  await page.evaluate((selector) => document.querySelector(selector).click(), card)
  await page.waitForFunction((templateId) => JSON.parse(localStorage.getItem('captionEditorState') || '{}').captionStyle?.template_20_id === templateId, { timeout: 15000 }, id)
  await page.evaluate(() => document.fonts.ready)
  await sleep(800)
}

// Canvas state of caption `index` just before it ends (every word has entered).
async function canvasScene(page, index) {
  await page.evaluate((time) => {
    const video = document.querySelector('.lekha-video-frame video')
    video.pause()
    video.currentTime = time
  }, (index + 1) * CAPTION_SECONDS - 0.12)
  await page.waitForFunction((captionId) => document.querySelector(`.lekha-applied-template-host[data-export-caption-id="${captionId}"]`), { timeout: 5000 }, `c${index}`).catch(() => {})
  await sleep(900)
  return page.evaluate(({ captionId, setClass }) => {
    const host = document.querySelector(`.lekha-applied-template-host[data-export-caption-id="${captionId}"]`)
    const frame = document.querySelector('.lekha-video-frame video')?.getBoundingClientRect()
    const card = host?.querySelector('.lc-card')
    const block = host?.querySelector('.sb.active') || host?.querySelector('.sb')
    if (!host || !frame || !block) return null
    const visible = (node) => {
      for (let current = node; current && current !== host; current = current.parentElement) {
        const cs = getComputedStyle(current)
        if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.98) return false
      }
      return true
    }
    // The canvas nests a visual span carrying the same index; keep the outer one.
    const words = [...block.querySelectorAll('[data-w]')].filter((word) => !word.parentElement?.closest('[data-w]')).map((word) => {
      const rect = word.getBoundingClientRect()
      const cs = getComputedStyle(word)
      // The word span also holds a hidden copy that reserves its slot.
      const raw = word.textContent.trim()
      const half = raw.slice(0, raw.length / 2)
      return {
        text: raw.length % 2 === 0 && half + half === raw ? half : raw,
        wordIndex: Number(word.dataset.w),
        visible: visible(word),
        cx: (rect.left + rect.width / 2 - frame.left) / frame.width,
        cy: (rect.top + rect.height / 2 - frame.top) / frame.height,
        left: (rect.left - frame.left) / frame.width,
        right: (rect.right - frame.left) / frame.width,
        fs: Number.parseFloat(cs.fontSize) / frame.height,
        color: cs.webkitTextFillColor || cs.color,
        weight: cs.fontWeight,
        family: cs.fontFamily,
        emphasis: word.classList.contains('is-emphasis'),
        tracking: cs.letterSpacing,
        transform: cs.textTransform,
      }
    })
    return {
      time: document.querySelector('.lekha-video-frame video').currentTime,
      studio: Boolean(card?.classList.contains(setClass)),
      // The layout director (or the user) decides per caption whether a word
      // is highlighted; otherwise scenes written without a keyword show none.
      authoredKeyword: (() => {
        const state = JSON.parse(localStorage.getItem('captionEditorState') || '{}')
        const caption = (state.captions || []).find((item) => item?.id === captionId)
        if (caption?.layoutSource) return (caption.imp_word_indices || []).length > 0
        const markup = state.captionStyle?.template_markup || ''
        const source = new DOMParser().parseFromString(markup, 'text/html').querySelector(`.sb[data-si="${block.dataset.si}"]`)
        return Boolean(source?.querySelector('.hero, .ns3hero, .ns3box, .ns3mark, .ns3bracket, .ns3dot'))
      })(),
      scene: Number(block.dataset.si ?? -1),
      words,
      accent: getComputedStyle(host).getPropertyValue('--template-highlight').trim(),
    }
  }, { captionId: `c${index}`, setClass: `lc-${SET}` })
}

async function exportPayload(page) {
  await page.evaluate(() => [...document.querySelectorAll('button')].find((button) => /^export$/i.test(button.textContent.trim()))?.click())
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some((button) => button.textContent.includes('720p HD')), { timeout: 20000 })
  await page.evaluate(() => [...document.querySelectorAll('button')].find((button) => button.textContent.includes('720p HD')).click())
  for (let attempt = 0; attempt < 60 && !page.exportPayloads.length; attempt += 1) await sleep(250)
  return page.exportPayloads.at(-1)
}

async function renderExport(id, lang, request) {
  const outputDir = path.join(workDir, `${id}-${lang}`)
  await fs.mkdir(outputDir, { recursive: true })
  const payloadPath = path.join(outputDir, 'payload.json')
  await fs.writeFile(payloadPath, JSON.stringify({
    captions: request.captions,
    style: request.style,
    video_width: 360,
    video_height: 640,
    duration: 10,
    output_dir: outputDir,
  }))
  await execFileAsync(process.execPath, [path.join(root, 'scripts', 'render_template_overlay.mjs'), payloadPath], {
    cwd: root,
    env: { ...process.env, TEMPLATE_OVERLAY_GEOMETRY_AUDIT: '1' },
    timeout: 600_000,
    maxBuffer: 1024 * 1024 * 16,
  })
  return JSON.parse(await fs.readFile(path.join(outputDir, 'template-completeness-audit.json'), 'utf8'))
}

async function runTemplate(id, lang) {
  const label = `${id} ${lang}`
  const page = await openEditor(lang)
  try {
    await applyTemplate(page, id)
    const scenes = []
    for (let index = 0; index < LINES[lang].length; index += 1) {
      const scene = await canvasScene(page, index)
      check(scene, `${label} caption ${index}: no applied template on the canvas`)
      if (!scene) continue
      scenes.push(scene)
      const expected = LINES[lang][index].split(/\s+/)
      check(SET === 'lc5' || scene.studio, `${label} caption ${index}: card is not a ${SET} card`)
      check(scene.words.map((word) => word.text).join(' ') === expected.join(' '), `${label} caption ${index}: words ${JSON.stringify(scene.words.map((word) => word.text))}`)
      const hidden = scene.words.filter((word) => !word.visible).map((word) => word.text)
      check(!hidden.length, `${label} caption ${index}: words not shown at caption end: ${hidden.join(', ')}`)
      const outside = scene.words.filter((word) => word.left < -0.01 || word.right > 1.01).map((word) => word.text)
      check(!outside.length, `${label} caption ${index}: words outside the frame: ${outside.join(', ')}`)
      const keyword = scene.words.filter((word) => word.emphasis)
      check(keyword.length > 0 || !scene.authoredKeyword, `${label} caption ${index}: no keyword highlighted`)
      check(!keyword.length || scene.authoredKeyword, `${label} caption ${index}: a keyword is highlighted on a plain sentence`)
      // Studio keywords are restrained by design; the Picks are bold by design.
      check(SET !== 'studio' || keyword.every((word) => word.weight !== '900' || id === 'T233'), `${label} caption ${index}: keyword forced to weight 900 (${keyword.map((word) => word.weight)})`)
      // Studio and Picks drop tracking in Hindi by design; LC 5 keeps the owner's spacing.
      if (lang === 'hi' && SET !== 'lc5') {
        const tracked = scene.words.filter((word) => word.tracking !== 'normal' && word.tracking !== '0px')
        check(!tracked.length, `${label} caption ${index}: Hindi words keep tracking ${tracked.map((word) => word.tracking)}`)
      }
    }
    // The caption planner picks each caption's scene; record which ones ran.
    if (process.env.STUDIO_DEBUG_FONTS === '1') scenes.forEach((scene) => console.log('   ', scene.words.map((word) => `${word.text}${word.emphasis ? '*' : ''}=${word.family.split(',')[0]}`).join(' ')))
    console.log(`  ${label}: scenes ${scenes.map((scene) => `${scene.scene}@${scene.time.toFixed(2)}s`).join(',')}`)
    check(!page.errors.length, `${label}: page errors ${JSON.stringify(page.errors)}`)
    if (SKIP_EXPORT) return
    const request = await exportPayload(page)
    check(request?.style?.template_20_id === id, `${label}: export request carries template ${request?.style?.template_20_id}`)
    if (!request) return
    const audits = await renderExport(id, lang, request)
    audits.forEach((audit, index) => {
      check(audit.complete, `${label} export caption ${index}: incomplete ${JSON.stringify(audit.renderedWords)}`)
      const canvas = scenes[index]
      if (!canvas || !Array.isArray(audit.wordGeometry)) return
      if (process.env.STUDIO_DEBUG_GEOMETRY === '1') {
        const row = (word) => `${word.text}${word.emphasis ? '*' : ''}@${word.cx.toFixed(3)},${word.cy.toFixed(3)} fs${word.fs.toFixed(4)}`
        console.log(`    caption ${index} canvas: ${canvas.words.map(row).join(' | ')}`)
        console.log(`    caption ${index} export: ${audit.wordGeometry.map(row).join(' | ')}`)
      }
      audit.wordGeometry.forEach((word) => {
        const match = canvas.words.find((candidate) => candidate.wordIndex === word.wordIndex)
        if (!match) return
        const dx = Math.abs(match.cx - word.cx)
        const dy = Math.abs(match.cy - word.cy)
        const ds = Math.abs(match.fs - word.fs) / Math.max(match.fs, 1e-6)
        check(dx <= 0.03 && dy <= 0.025, `${label} caption ${index} "${word.text}": export moved by ${(dx * 100).toFixed(1)}% x, ${(dy * 100).toFixed(1)}% y`)
        check(ds <= 0.08, `${label} caption ${index} "${word.text}": export size differs ${(ds * 100).toFixed(1)}%`)
      })
    })
  } finally {
    await page.close()
  }
}

try {
  for (const id of IDS) {
    await runTemplate(id, 'en')
    console.log(`${id} en checked`)
  }
  for (const id of HINDI_IDS) {
    await runTemplate(id, 'hi')
    console.log(`${id} hi checked`)
  }
  assert.deepEqual(failures, [], `Studio template failures:\n${failures.join('\n')}`)
  console.log(`${({ picks: 'Picks', lc5: 'LC 5', studio: 'Studio' })[SET]} templates passed: ${IDS.length} templates x 5 scenes in English, ${HINDI_IDS.length} in Hindi${SKIP_EXPORT ? ' (export skipped)' : ', canvas and export match'}.`)
} finally {
  await browser.close()
  await server.close()
  if (!process.env.KEEP_STUDIO_TEMPLATE_OUTPUT) await fs.rm(workDir, { recursive: true, force: true })
  else console.log(`output kept in ${workDir}`)
}
