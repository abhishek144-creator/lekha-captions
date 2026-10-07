// Opens the real Lekha editor (local dev server, ?devseed=1) with the landing-page clip and
// English captions swapped into the dev seed *in this browser session only* (no source edits).
import puppeteer from 'puppeteer'

export const BASE = 'http://localhost:3000'
// The editor is recorded exactly as the user sees it: a 1360 px wide screen with Chrome at 75 % zoom
// (measured from their screenshots: panels and export sheet are 0.75x their CSS size). That is a CSS
// viewport of 1813x1020 (16:9, fills the film frame) at device scale 1.5 = 2x their screen pixels,
// so captures are 2720x1530. The four lang-* takes keep their original 1600x900 @2x recording
// (the language cards crop the preview out of those).
export const VIEW = { width: 1813, height: 1020, scale: 1.5 }
export const LANG_VIEW = { width: 1600, height: 900, scale: 2 }

export const CAPTION_SETS = {}
const CAPTIONS = [
  ['this place taught me one thing', 0.0, 2.2],
  ['humility is a strategy, not weakness.', 2.3, 5.0],
  ['slow mornings build loud lives.', 5.1, 7.6],
  ['say it once. let them read it.', 7.7, 11.0],
]

CAPTION_SETS.en = CAPTIONS
CAPTION_SETS.es = [
  ['este lugar me enseñó una cosa', 0.0, 2.2],
  ['la humildad es una estrategia, no debilidad.', 2.3, 5.0],
  ['mañanas lentas, vidas que se escuchan.', 5.1, 7.6],
  ['dilo una vez. que lo lean.', 7.7, 11.0],
]
CAPTION_SETS.hi = [
  ['इस जगह ने मुझे एक बात सिखाई', 0.0, 2.2],
  ['विनम्रता एक रणनीति है, कमज़ोरी नहीं।', 2.3, 5.0],
  ['धीमी सुबहें बड़ी ज़िंदगी बनाती हैं।', 5.1, 7.6],
  ['एक बार कहो, उन्हें पढ़ने दो।', 7.7, 11.0],
]
CAPTION_SETS.ar = [
  ['علّمني هذا المكان شيئًا واحدًا', 0.0, 2.2],
  ['التواضع استراتيجية، وليس ضعفًا.', 2.3, 5.0],
  ['الصباحات الهادئة تصنع حياة صاخبة.', 5.1, 7.6],
  ['قلها مرة، ودعهم يقرؤونها.', 7.7, 11.0],
]

function seedSource(captions = CAPTIONS) {
  const caps = captions.map(([text, s, e], i) => {
    const words = text.split(' ')
    const step = (e - s) / words.length
    const ws = words.map((w, j) => `{ word: ${JSON.stringify(w)}, text: ${JSON.stringify(w)}, start: ${(s + j * step).toFixed(2)}, end: ${(s + (j + 1) * step).toFixed(2)} }`)
    return `{ id: 'seed-en-${i}', text: ${JSON.stringify(text)}, start_time: ${s}, end_time: ${e}, position_x: 50, position_y: null, wordStyles: {}, words: [${ws.join(', ')}] }`
  })
  return `setCaptions([${caps.join(',\n')}]);`
}

const LAUNCH_ARGS = ['--autoplay-policy=no-user-gesture-required', '--force-color-profile=srgb', '--hide-scrollbars']

// A plain page (e.g. export-mock.html) with the same viewport, clock patch and browser flags as the editor.
export async function openPage(url, { width = VIEW.width, height = VIEW.height, scale = VIEW.scale, headless = true } = {}) {
  const browser = await puppeteer.launch({ headless, args: LAUNCH_ARGS })
  const page = await browser.newPage()
  await page.setViewport({ width, height, deviceScaleFactor: scale })
  await page.evaluateOnNewDocument(TIME_PATCH)
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 120000 })
  await page.evaluate(() => document.fonts.ready)
  return { browser, page }
}

// stage: 'upload' → the session starts on the real empty editor ("Start Creating Captions") and the
// upload flow is STAGED in this browser only: the dev-seed session may open the real upload modal and
// pick a file, and "Generate Captions" shows the real generating screen without any upload or
// transcription request; window.__finishUpload() then loads the sample video + captions. No login,
// no source edits — only the code served to this recording browser is rewritten (as for the seed).
const STAGE = 'new URLSearchParams(window.location.search).has("stageupload")'
function stageDashboard(body) {
  const guard = 'if (!new URLSearchParams(window.location.search).has("devseed")) return;'
  const g = body.indexOf(guard)
  const end = body.slice(g).search(/setIsLoaded\(true\);\s*\}, \[\]\);/)
  if (g < 0 || end < 0) { console.warn('stage: seed effect not found'); return body }
  const e = g + end
  const close = body.slice(e).match(/setIsLoaded\(true\);\s*\}, \[\]\);/)[0]
  body = body.slice(0, g) + guard + '\nconst __seedRun = () => {' + body.slice(g + guard.length, e)
    + `setIsLoaded(true);\n};\nif (${STAGE}) { window.__seedNow = __seedRun; setIsLoaded(true); return; }\n__seedRun();\n}, []);`
    + body.slice(e + close.length)
  body = body.replace('const handleUploadModalOpen = () => {\n\t\tif (!currentUser) {', `const handleUploadModalOpen = () => {\n\t\tif (!currentUser && !(${STAGE})) {`)
  body = body.replace('const handleUpload = async (file, uploadSettings) => {', `const handleUpload = async (file, uploadSettings) => {
		if (${STAGE}) {
			setWordPopup(null); setIsUploadModalOpen(false); setOriginalFileName(file?.name || "video");
			setGenerationStartedAt(Date.now()); setIsGenerating(true);
			window.__finishUpload = () => { window.__seedNow && window.__seedNow(); setIsGenerating(false); };
			return;
		}`)
  return body
}

export async function openEditor({ width = VIEW.width, height = VIEW.height, scale = VIEW.scale, headless = true, captions = CAPTIONS, stage = null } = {}) {
  const browser = await puppeteer.launch({ headless, args: LAUNCH_ARGS })
  const page = await browser.newPage()
  await page.setViewport({ width, height, deviceScaleFactor: scale })
  await page.evaluateOnNewDocument(TIME_PATCH)
  // a signed-in user with no video sees an empty top-bar right side; hide the guest "Signup" button
  if (stage) await page.evaluateOnNewDocument(() => {
    const hide = () => document.querySelectorAll('header button').forEach((b) => { if (b.innerText.trim() === 'Signup') b.style.visibility = 'hidden' })
    new MutationObserver(hide).observe(document, { subtree: true, childList: true })
  })
  await page.setRequestInterception(true)
  page.on('request', async (req) => {
    const url = req.url()
    if (stage && url.includes('/src/components/dashboard/UploadModal.jsx')) {
      const body = (await (await fetch(url)).text()).replaceAll('if (!ensureAuthenticated()) return;', `if (!(${STAGE}) && !ensureAuthenticated()) return;`)
      return req.respond({ status: 200, contentType: 'application/javascript', body })
    }
    if (!url.includes('/src/pages/Dashboard.jsx')) return req.continue()
    const res = await fetch(url)
    let body = await res.text()
    const a = body.indexOf('setCaptions([', body.indexOf("'seed-hindi-0'") - 400)
    const b = body.indexOf('setIsLoaded(true)', a)
    if (a > 0 && b > a) {
      const end = body.lastIndexOf(']);', b) + 3
      body = body.slice(0, a) + seedSource(captions) + body.slice(end)
      body = body.replace('setDuration(12)', 'setDuration(11.06)')
    } else {
      console.warn('seed block not found; using original captions')
    }
    if (stage) body = stageDashboard(body)
    req.respond({ status: 200, contentType: 'application/javascript', body })
  })
  await page.goto(`${BASE}/Dashboard?devseed=1${stage ? '&stageupload=1' : ''}`, { waitUntil: 'networkidle0', timeout: 120000 })
  if (stage) { await page.evaluate(() => document.fonts.ready); return { browser, page } }
  await page.waitForSelector('video', { timeout: 60000 })
  await page.evaluate(() => document.fonts.ready)
  return { browser, page }
}

// Page-side clock that can run slower than real time, so 2x screenshots (≈12 fps) can be
// taken of a page running at 1/3 speed and then played back at full speed.
// Scales timers, rAF timestamps, performance.now and Date.now; CSS animations are slowed
// separately through the CDP Animation domain, and the <video> through playbackRate.
function TIME_PATCH() {
  const pn = performance.now.bind(performance)
  const dateBase = Date.now() - pn()
  let rate = 1, r0 = pn(), v0 = r0
  const virt = () => v0 + (pn() - r0) * rate
  performance.now = virt
  Date.now = () => Math.round(dateBase + virt())
  const raf = window.requestAnimationFrame.bind(window)
  window.requestAnimationFrame = (cb) => raf(() => cb(virt()))
  const st = window.setTimeout.bind(window), si = window.setInterval.bind(window)
  window.setTimeout = (fn, ms = 0, ...a) => st(fn, (Number(ms) || 0) / rate, ...a)
  window.setInterval = (fn, ms = 0, ...a) => si(fn, (Number(ms) || 0) / rate, ...a)
  window.__setRate = (r) => { v0 = virt(); r0 = pn(); rate = r }
}

// The rate has to reach every frame: the left-gallery cards are sandboxed srcdoc iframes with
// their own setTimeout sequencer, so slowing only the top window left them at full speed
// (≈6.5× too fast in the film). Frames created later start at the current rate through a
// preload script, and the CDP animation rate is applied per frame session.
let rateScript = null
export async function setRate(page, cdp, r) {
  await cdp.send('Animation.enable')
  await cdp.send('Animation.setPlaybackRate', { playbackRate: r })
  if (rateScript) await page.removeScriptToEvaluateOnNewDocument(rateScript).catch(() => {})
  rateScript = r === 1 ? null : (await page.evaluateOnNewDocument((x) => { window.__setRate && window.__setRate(x); window.__rate = x }, r)).identifier
  for (const f of page.frames()) {
    await f.evaluate((x) => {
      if (window.__setRate) window.__setRate(x)
      window.__rate = x
      document.querySelectorAll('video').forEach((v) => { v.playbackRate = x })
    }, r).catch(() => {})
    const session = f.client
    if (session && session !== cdp && f !== page.mainFrame()) {
      await session.send('Animation.enable').catch(() => {})
      await session.send('Animation.setPlaybackRate', { playbackRate: r }).catch(() => {})
    }
  }
}

// Seek the editor video and let React's timeupdate handler run.
export async function seek(page, t) {
  await page.evaluate(async (time) => {
    const v = document.querySelector('video')
    v.pause()
    await new Promise((res) => { v.addEventListener('seeked', res, { once: true }); v.currentTime = time })
    v.dispatchEvent(new Event('timeupdate'))
  }, t)
  await new Promise((r) => setTimeout(r, 250))
}
