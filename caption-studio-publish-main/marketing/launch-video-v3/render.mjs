// Renders a composer page frame-by-frame and encodes with FFmpeg.
//   node render.mjs                          -> out/lekha-launch-v3-silent.mp4 (launch-v3.html)
//   node render.mjs --film v4                -> out/lekha-launch-v4-silent.mp4 (launch-v4.html)
//   node render.mjs [--film v4] --stills 2,5 -> out/stills/[v4-]t-2.png …
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import puppeteer from 'puppeteer'

const here = path.dirname(fileURLToPath(import.meta.url))
const out = path.join(here, 'out')
mkdirSync(out, { recursive: true })

const FPS = 30
const args = process.argv.slice(2)
const stillsArg = args.includes('--stills') ? args[args.indexOf('--stills') + 1] : null
const FILM = args.includes('--film') ? args[args.indexOf('--film') + 1] : 'v3'

const browser = await puppeteer.launch({ headless: true, args: ['--force-color-profile=srgb', '--hide-scrollbars'] })
const page = await browser.newPage()
await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 })
await page.goto(pathToFileURL(path.join(here, `launch-${FILM}.html`)).href, { waitUntil: 'networkidle0' })
await page.evaluate(() => window.ready)
const DURATION = await page.evaluate(() => window.FILM.DURATION)
console.log('duration', DURATION)

if (stillsArg) {
  mkdirSync(path.join(out, 'stills'), { recursive: true })
  for (const t of stillsArg.split(',').map(Number)) {
    await page.evaluate(async (x) => { await window.renderAt(x) }, t)
    await page.screenshot({ path: path.join(out, 'stills', `${FILM === 'v3' ? '' : FILM + '-'}t-${t}.png`) })
  }
  await browser.close()
  process.exit(0)
}

const target = path.join(out, `lekha-launch-${FILM}-silent.mp4`)
const ff = spawn('ffmpeg', [
  '-y', '-v', 'error',
  '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p',
  '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
  '-movflags', '+faststart', target,
], { stdio: ['pipe', 'inherit', 'inherit'] })

const total = Math.round(FPS * DURATION)
const started = Date.now()
for (let f = 0; f < total; f++) {
  await page.evaluate(async (x) => { await window.renderAt(x) }, f / FPS)
  const buf = await page.screenshot({ type: 'png' })
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r))
  if (f % 60 === 0) process.stdout.write(`frame ${f}/${total}  ${((Date.now() - started) / 1000).toFixed(0)}s\n`)
}
ff.stdin.end()
await new Promise((r, j) => ff.on('close', (c) => (c === 0 ? r() : j(new Error(`ffmpeg exit ${c}`)))))
await browser.close()
console.log(`done → ${target}`)
