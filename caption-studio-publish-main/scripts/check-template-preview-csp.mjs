import http from 'node:http'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import puppeteer from 'puppeteer'

// Real template-card preview documents (collected from the editor with the
// editor-journey doubles), served under the exact production CSP from
// vite.config.js, must run with zero CSP violations, while an unhashed script
// and one carrying the old fixed nonce must be blocked. check-release-readiness
// only compares hashes; this proves the browser computes the same ones.
const csp = readFileSync('vite.config.js', 'utf8').match(/const productionCsp = "([^"]+)"/)[1]
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const vite = await createServer({
  configFile: false, envDir: false, logLevel: 'error', plugins: [react()],
  resolve: { alias: [
    { find: '@/lib/AuthContext', replacement: resolve('e2e/fixtures/editorAuth.jsx') },
    { find: '@/context/AuthContext', replacement: resolve('e2e/fixtures/editorAuth.jsx') },
    { find: '@/lib/firebase', replacement: resolve('e2e/fixtures/editorFirebase.js') },
    { find: '@', replacement: resolve('src') },
  ] },
  define: { 'import.meta.env.VITE_API_BASE_URL': '""', 'import.meta.env.VITE_LOCAL_API_RETRY_MS': '"0"' },
  server: { host: '127.0.0.1', port: 4195, strictPort: true },
})
await vite.listen()
const browser = await puppeteer.launch({ headless: true })

async function collectPreviewDocs() {
  const page = await browser.newPage()
  await page.setViewport({ width: 1600, height: 1000 })
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
  const caption = { id: 'a', text: 'hello bright big world', start_time: 0, end_time: 4, wordStyles: {}, words: [{ word: 'hello', start: 0, end: 1 }, { word: 'bright', start: 1, end: 2 }, { word: 'big', start: 2, end: 3 }, { word: 'world', start: 3, end: 4 }] }
  const draft = { ownerUid: 'editor-test-a', projectId: 'probe', fileId: '123e4567-e89b-12d3-a456-426614174000', videoUrl: '/launch-video.mp4', duration: 10, originalFileName: 'f.mp4', captions: [caption], captionTracks: [], activeCaptionTrackId: 'source', settings: {}, captionStyle: { font_family: 'Inter', font_size: 24, position_y: 70, text_color: '#ffffff', has_background: false } }
  await page.goto('http://127.0.0.1:4195/e2e/fixtures/editor.html')
  await page.evaluate((v) => localStorage.setItem('captionEditorState', JSON.stringify(v)), draft)
  await page.goto('http://127.0.0.1:4195/e2e/fixtures/editor.html?restoreSession=1')
  await page.waitForSelector('.lekha-video-frame [data-word-key="a-1"]', { timeout: 30000 })
  const docs = new Map()
  const kindOf = (doc) => doc.includes('lekha-sidebar-template-preview-progress') ? 'sidebar'
    : doc.includes('"impEntrances"') ? 'advanced'
      : doc.includes('"fixedLineCycleMs"') ? 'basic' : 'other'
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await page.evaluate(() => [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === 'Templates').forEach((b) => b.click()))
    await sleep(2500)
    // Scroll every scrollable panel so lazily mounted cards render.
    await page.evaluate(() => document.querySelectorAll('*').forEach((el) => { if (el.scrollHeight > el.clientHeight + 40) el.scrollTop += 600 }))
    await sleep(1500)
    for (const doc of await page.evaluate(() => [...document.querySelectorAll('iframe')].map((f) => f.getAttribute('srcdoc') || '').filter(Boolean))) {
      const kind = kindOf(doc)
      if (!docs.has(kind)) docs.set(kind, doc)
    }
    if (['sidebar', 'advanced', 'basic'].every((k) => docs.has(k))) break
  }
  await page.close()
  return docs
}

const docs = await collectPreviewDocs()
console.log('collected preview kinds:', [...docs.keys()].join(', '))
for (const doc of docs.values()) {
  if (/nonce=/.test(doc)) throw new Error('a preview document still carries a nonce')
}
const frames = [
  ...[...docs].map(([kind, srcdoc]) => ({ kind, srcdoc })),
  { kind: 'control-unhashed', srcdoc: '<p id="c">x</p><script>document.getElementById("c").textContent = "ran"</script>' },
  { kind: 'control-old-nonce', srcdoc: '<p id="c">x</p><script nonce="lekha-template-preview-v1">document.getElementById("c").textContent = "ran"</script>' },
]

const harnessJs = `
const frames = ${JSON.stringify(frames)};
window.__frames = frames.map(({ kind, srcdoc }) => {
  const iframe = document.createElement('iframe');
  iframe.width = 400; iframe.height = 300;
  iframe.srcdoc = srcdoc;
  document.body.appendChild(iframe);
  return { kind, iframe };
});`
const server = http.createServer((req, res) => {
  if (req.url === '/harness.js') { res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' }); return res.end(harnessJs) }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': csp })
  res.end('<!doctype html><html><body><script src="/harness.js"></script></body></html>')
}).listen(4196, '127.0.0.1')

const page = await browser.newPage()
const violations = []
page.on('console', (message) => { if (/Content Security Policy/i.test(message.text())) violations.push(message.text().slice(0, 160)) })
await page.goto('http://127.0.0.1:4196/')
await sleep(1500)
const first = await page.evaluate(() => window.__frames.map(({ kind, iframe }) => ({ kind, html: iframe.contentDocument.body.innerHTML })))
await sleep(5000)
const results = await page.evaluate((before) => window.__frames.map(({ kind, iframe }, index) => {
  const doc = iframe.contentDocument
  return {
    kind,
    lcHelper: typeof iframe.contentWindow.getLcMotionSchedule === 'function',
    scriptReady: doc.documentElement.classList.contains('template-preview-script-ready'),
    domChanged: doc.body.innerHTML !== before[index].html,
    control: doc.getElementById('c')?.textContent || null,
  }
}), first)
console.table(results)
console.log('CSP violations:', violations.length)
violations.forEach((v) => console.log('  ', v))

const byKind = Object.fromEntries(results.map((r) => [r.kind, r]))
const failures = []
for (const kind of ['sidebar', 'advanced', 'basic']) {
  if (!byKind[kind]) failures.push(`no ${kind} preview collected`)
  else if (!byKind[kind].domChanged) failures.push(`${kind} sequencer did not run`)
}
if (byKind.sidebar && !byKind.sidebar.lcHelper) failures.push('LC schedule helper did not run in the sidebar frame')
if (byKind['control-unhashed'].control !== 'x') failures.push('unhashed control script ran')
if (byKind['control-old-nonce'].control !== 'x') failures.push('old-nonce control script ran')
if (violations.length !== 2) failures.push(`expected exactly the 2 control violations, saw ${violations.length}`)
await browser.close(); server.close(); await vite.close()
if (failures.length) { console.log('FAILED:', failures.join('; ')); process.exit(1) }
console.log('Preview CSP check passed: all real preview scripts run under the production CSP; unhashed and old-nonce scripts are blocked.')
