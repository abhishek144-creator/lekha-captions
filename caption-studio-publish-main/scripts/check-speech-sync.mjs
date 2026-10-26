import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import puppeteer from 'puppeteer'

// Real source audio, real editor/playback/persistence, provider/API doubles.
// The pulses supply an exact timing oracle; this is not an ASR accuracy test.
const artifacts = resolve('test-artifacts/speech-sync')
await mkdir(artifacts, { recursive: true })
const media = resolve(artifacts, 'source.mp4')
execFileSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'color=c=0x162536:s=180x320:r=24:d=6',
  '-f', 'lavfi', '-i', String.raw`aevalsrc=if(between(t\,1\,2)+between(t\,4\,5)\,0.3*sin(2*PI*440*t)\,0):s=16000:d=6`,
  '-c:v', 'libx264', '-c:a', 'aac', '-shortest', media], { stdio: 'pipe' })
const python = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3')
const analysis = JSON.parse(execFileSync(python, ['-c',
  'import json,sys; from backend.audio_analysis import analyze_media; print(json.dumps(analyze_media(sys.argv[1],6)))', media], { encoding: 'utf8' }))
const fileId = '123e4567-e89b-12d3-a456-426614174818'
const captions = [
  { id: 'speech-a', text: 'Hello satellite.', start_time: 1, end_time: 2, words: [{ word: 'Hello', start: 1, end: 1.35 }, { word: 'satellite.', start: 1.4, end: 2 }], wordStyles: { 'speech-a-1': { color: '#22ff66' } } },
  { id: 'speech-b', text: 'Launch today.', start_time: 4, end_time: 5, words: [{ word: 'Launch', start: 4, end: 4.4 }, { word: 'today.', start: 4.5, end: 5 }], wordStyles: {} },
]
const draft = { ownerUid: 'editor-test-a', projectId: 'speech-sync', fileId, videoUrl: '/test-artifacts/speech-sync/source.mp4', duration: 6, originalFileName: 'source.mp4', captions, captionTracks: [], activeCaptionTrackId: 'source', settings: {}, captionStyle: { font_family: 'Inter', font_size: 24, position_y: 75, text_color: '#ffffff', has_background: false }, audioAnalysis: { ...analysis, fileId } }
const server = await createServer({
  configFile: false, envDir: false, logLevel: 'error', plugins: [react()],
  resolve: { alias: [
    { find: '@/lib/AuthContext', replacement: resolve('e2e/fixtures/editorAuth.jsx') },
    { find: '@/context/AuthContext', replacement: resolve('e2e/fixtures/editorAuth.jsx') },
    { find: '@/lib/firebase', replacement: resolve('e2e/fixtures/editorFirebase.js') },
    { find: '@', replacement: resolve('src') },
  ] },
  define: { 'import.meta.env.VITE_API_BASE_URL': '""', 'import.meta.env.VITE_LOCAL_API_RETRY_MS': '"0"' },
  server: { host: '127.0.0.1', port: 4198, strictPort: true },
})
await server.listen()
const browser = await puppeteer.launch({ headless: true, args: process.env.CI ? ['--no-sandbox'] : [] })
const page = await browser.newPage()
const errors = []
let analysisCalls = 0
let exportPayload
page.on('pageerror', error => errors.push(error.message))
await page.setViewport({ width: 1440, height: 1000 })
await page.setRequestInterception(true)
page.on('request', request => {
  const url = new URL(request.url())
  if (url.hostname !== '127.0.0.1' && !['data:', 'blob:'].includes(url.protocol)) return request.abort()
  if (!url.pathname.startsWith('/api/')) return request.continue()
  let payload = { success: true }
  if (url.pathname === '/api/editor-preferences/load') payload.preferences = { revision: 0, brand_kits: [], glossary_terms: [] }
  if (url.pathname === '/api/draft/load') payload = { revision: 0, draft: null }
  if (url.pathname === '/api/projects/list') payload.projects = []
  if (url.pathname === '/api/workspaces') payload.workspaces = []
  if (url.pathname === '/api/fonts') payload.fonts = []
  if (url.pathname === '/api/audio-analysis') { analysisCalls += 1; payload.audio_analysis = analysis }
  if (url.pathname === '/api/export') { exportPayload = JSON.parse(request.postData()); return request.respond({ status: 503, contentType: 'application/json', body: JSON.stringify({ detail: 'Fixture stops before paid render' }) }) }
  return request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) })
})
const origin = 'http://127.0.0.1:4198/e2e/fixtures/editor.html'
const clickText = async text => page.evaluate(label => [...document.querySelectorAll('button')].find(button => button.textContent.trim() === label)?.click(), text)
const seek = async time => {
  await page.$eval('video[data-lekha-player]', (video, next) => { video.currentTime = next }, time)
  await page.waitForFunction(next => Math.abs(document.querySelector('video[data-lekha-player]').currentTime - next) < 0.02, {}, time)
}
try {
  await page.goto(origin)
  await page.goto('about:blank') // let the preceding page finish its unload save
  await page.goto(origin)
  await page.evaluate(value => localStorage.setItem('captionEditorState', JSON.stringify(value)), draft)
  await page.goto(`${origin}?restoreSession=1`)
  await page.waitForFunction(() => document.querySelector('video[data-lekha-player]')?.readyState >= 2)
  if (await page.$('button[title="Expand timeline"]')) await page.click('button[title="Expand timeline"]')
  await page.waitForSelector('[data-audio-waveform="true"]', { visible: true })
  assert.equal(analysisCalls, 0, 'saved source waveform must not be regenerated on restore')
  const rectCount = await page.$$eval('[data-audio-waveform] rect', bars => bars.length)
  assert.ok(rectCount >= 100, 'actual source envelope is visible in the audio lane')
  await seek(1.6)
  await page.waitForSelector('[data-caption-id="speech-a"]')
  assert.equal(await page.$('[data-caption-id="speech-b"]'), null)
  await seek(3)
  await page.waitForFunction(() => !document.querySelector('[data-caption-layer="true"]'))
  await seek(4.6)
  await page.waitForSelector('[data-caption-id="speech-b"]')

  // At 2x, all editor surfaces must follow media seconds rather than a timer.
  await seek(0.5)
  await page.$eval('video[data-lekha-player]', async video => { video.playbackRate = 2; await video.play() })
  await page.waitForFunction(() => {
    const video = document.querySelector('video[data-lekha-player]')
    return video.currentTime > 1.2 && !!document.querySelector('[data-caption-id="speech-a"]')
  })
  await page.waitForFunction(() => document.querySelector('video[data-lekha-player]').currentTime > 2.3 && !document.querySelector('[data-caption-layer="true"]'))
  await page.$eval('video[data-lekha-player]', video => video.pause())
  await seek(1.6)
  await page.screenshot({ path: resolve(artifacts, 'waveform-preview.png') })

  await page.waitForFunction(() => JSON.parse(localStorage.getItem('captionEditorState') || '{}').audioAnalysis?.samples?.length > 0)
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('captionEditorState')))
  assert.deepEqual(saved.audioAnalysis.samples, analysis.samples)
  assert.deepEqual(saved.captions.map(caption => caption.words), captions.map(caption => caption.words))
  assert.deepEqual(saved.captions[0].wordStyles, captions[0].wordStyles)
  await page.reload()
  await page.waitForFunction(() => document.querySelector('video[data-lekha-player]') || document.body.textContent.includes('Continue Saved Draft'))
  await clickText('Continue Saved Draft')
  await page.waitForFunction(() => document.querySelector('video[data-lekha-player]')?.readyState >= 2)
  if (await page.$('button[title="Expand timeline"]')) await page.click('button[title="Expand timeline"]')
  await page.waitForSelector('[data-audio-waveform="true"]', { visible: true })
  assert.equal(analysisCalls, 0)
  await seek(4.6)
  await page.waitForSelector('[data-caption-id="speech-b"]')

  await clickText('Export')
  await page.waitForFunction(() => [...document.querySelectorAll('[role="dialog"] button')].some(button => button.textContent.includes('720p HD')))
  await page.evaluate(() => [...document.querySelectorAll('[role="dialog"] button')].find(button => button.textContent.includes('720p HD')).click())
  for (let count = 0; count < 50 && !exportPayload; count += 1) await new Promise(done => setTimeout(done, 100))
  assert.ok(exportPayload)
  assert.deepEqual(exportPayload.captions.map(caption => [caption.start_time, caption.end_time, caption.words]), captions.map(caption => [caption.start_time, caption.end_time, caption.words]))
  assert.deepEqual(exportPayload.waveform_data, analysis.samples)
  assert.deepEqual(errors, [])
  await writeFile(resolve(artifacts, 'receipt.json'), JSON.stringify({ waveformBars: rectCount, exactAudioReference: analysis.reference, reload: true, nativeSeek: true, speed2x: true, silence: true, exportPayload: true }, null, 2))
  console.log('Speech synchronization browser checks passed: actual audio waveform, native seek, silence, 2x playback, reload, word overrides and export timestamps.')
} catch (error) {
  await page.screenshot({ path: resolve(artifacts, 'failure.png') })
  console.error(errors, await page.evaluate(() => document.body.innerText.slice(-2200)))
  throw error
} finally {
  await browser.close()
  await server.close()
}
