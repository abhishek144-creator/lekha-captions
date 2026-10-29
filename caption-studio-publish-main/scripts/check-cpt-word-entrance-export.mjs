import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'
import { browserLaunchOptions } from './render_browser_runtime.mjs'
import { getCaptionWordRevealTimes } from '../src/components/dashboard/cptMotion.js'

// A CPT (absolutely placed words) whose words were given an entrance in the
// floating word editor. As on the canvas, each word must stay hidden until its
// reveal, then play its entrance from that moment (not from the caption start,
// when it would be over before the word appears), and settle exactly at its
// CPT point. Renders real overlay frames and measures each word's pixels.
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rendererPath = path.join(projectRoot, 'scripts', 'render_template_overlay.mjs')
const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'lekha-cpt-entrance-'))

const width = 360
const height = 640
const words = ['ONE', 'TWO', 'THREE']
const rows = [20, 50, 80]
const caption = {
  id: 'cpt', text: words.join(' '), start_time: 0, end_time: 3, is_text_element: false,
  words: words.map((word, index) => ({ word, start: index, end: index + 1 })),
  word_styles: Object.fromEntries(words.map((_, index) => [`cpt-${index}`, {
    abs_x_pct: 50, abs_y_pct: rows[index], fontSize: 40, animation: 'fade', animationSpeed: 1,
  }])),
}
const payload = (outputDir) => ({
  video_width: width,
  video_height: height,
  duration: 3,
  output_dir: outputDir,
  style: {
    font_family: 'Inter', font_size: 30, font_weight: '800', position_x: 50, position_y: 50,
    text_color: '#ffffff', has_background: false, has_shadow: false, show_inactive: true, fps: 24,
    preview_width: width, preview_height: height,
  },
  captions: [caption],
})

// Bright, nearly opaque pixels per word band, plus that band's ink centre.
const measureBands = async (page, framePath) => {
  const src = `data:image/png;base64,${(await readFile(framePath)).toString('base64')}`
  return page.evaluate(async (dataUrl, bandCentres) => {
    const image = new Image()
    image.src = dataUrl
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d', { willReadFrequently: true })
    context.drawImage(image, 0, 0)
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
    return bandCentres.map((centrePct) => {
      const top = Math.round(((centrePct - 12) / 100) * canvas.height)
      const bottom = Math.round(((centrePct + 12) / 100) * canvas.height)
      let count = 0
      let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity
      for (let y = top; y < bottom; y += 1) {
        for (let x = 0; x < canvas.width; x += 1) {
          const i = (y * canvas.width + x) * 4
          if (data[i + 3] > 200 && data[i] > 220 && data[i + 1] > 220 && data[i + 2] > 220) {
            count += 1
            minX = Math.min(minX, x); maxX = Math.max(maxX, x)
            minY = Math.min(minY, y); maxY = Math.max(maxY, y)
          }
        }
      }
      return { count, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 }
    })
  }, src, rows)
}

const browser = await puppeteer.launch(browserLaunchOptions({ width, height }))
try {
  const page = await browser.newPage()
  const outputDir = path.join(tempRoot, 'frames')
  const payloadPath = path.join(tempRoot, 'payload.json')
  await writeFile(payloadPath, JSON.stringify(payload(outputDir)), 'utf8')
  execFileSync(process.execPath, [rendererPath, payloadPath], { cwd: projectRoot, env: process.env, stdio: 'pipe' })
  const segments = JSON.parse(await readFile(path.join(outputDir, 'segments.json'), 'utf8'))
  const frameFiles = (await readFile(path.join(outputDir, 'frames.txt'), 'utf8'))
    .split(/\r?\n/)
    .map((line) => line.match(/^file '(.+)'$/)?.[1])
    .filter(Boolean)
  // ffmpeg concat list: one frame per segment, then the last frame repeated.
  assert.ok(frameFiles.length >= segments.length, 'one listed frame per segment')

  const samples = []
  for (let index = 0; index < segments.length; index += 1) {
    const framePath = path.isAbsolute(frameFiles[index]) ? frameFiles[index] : path.join(outputDir, frameFiles[index])
    samples.push({ start: segments[index].start, bands: await measureBands(page, framePath) })
  }
  const final = samples.filter((sample) => sample.start < 3).at(-1).bands
  const revealTimes = getCaptionWordRevealTimes(caption, words.length)
  words.forEach((word, index) => {
    const full = final[index].count
    assert.ok(full > 150, `${word} is fully painted at the end of the caption (${full})`)
    // Settles on its CPT point: the individual translate property still centres it.
    assert.ok(Math.abs(final[index].cx - width / 2) <= 3, `${word} ends centred at x 50% (${final[index].cx})`)
    assert.ok(Math.abs(final[index].cy - (rows[index] / 100) * height) <= 6, `${word} ends at y ${rows[index]}% (${final[index].cy})`)
    const reveal = revealTimes[index]
    const before = samples.filter((sample) => sample.start < reveal - 0.01)
    before.forEach((sample) => assert.equal(sample.bands[index].count, 0, `${word} is hidden before its reveal (t=${sample.start})`))
    // During its own 0.5 s fade the word is partly transparent at least once:
    // the entrance starts at the reveal, not at the caption start.
    const entrance = samples.filter((sample) => sample.start >= reveal - 0.01 && sample.start < reveal + 0.45)
    assert.ok(entrance.length >= 3, `${word}: frames sampled through its entrance (${entrance.length})`)
    assert.ok(
      entrance.some((sample) => sample.bands[index].count < full * 0.8),
      `${word} fades in from its reveal at ${reveal}s (${JSON.stringify(entrance.map((sample) => [sample.start.toFixed(2), sample.bands[index].count]))}, full ${full})`,
    )
  })
  console.log(`CPT word entrance export checks passed (${samples.length} frames).`)
} finally {
  await browser.close()
  await rm(tempRoot, { recursive: true, force: true })
}
