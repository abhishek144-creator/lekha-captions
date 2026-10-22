import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'
import { browserLaunchOptions } from './render_browser_runtime.mjs'

// A caption whose look is "word by word" (reveal_mode: 'word', set by the
// layout director or Motion: Words) must build up as spoken in the export,
// while the rest of the video keeps showing whole sentences. Renders real
// overlay frames and counts painted text pixels over time.
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rendererPath = path.join(projectRoot, 'scripts', 'render_template_overlay.mjs')
const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'lekha-word-reveal-'))

const words = ['FIRST', 'SECOND', 'THIRD']
const fps = 4
const payloadFor = (id, revealMode, outputDir) => ({
  video_width: 360,
  video_height: 640,
  duration: 3,
  output_dir: outputDir,
  style: {
    font_family: 'Inter', font_size: 30, font_weight: '800', position_x: 50, position_y: 50,
    text_color: '#ffffff', has_background: false, has_shadow: false, show_inactive: true, fps,
    preview_width: 360, preview_height: 640,
  },
  captions: [{
    id, text: words.join(' '), start_time: 0, end_time: 3, is_text_element: false, reveal_mode: revealMode,
    // A word style keeps this on the DOM overlay path, as the backend routes it.
    words: words.map((word, index) => ({ word, start: index, end: index + 1 })),
    word_styles: { [`${id}-0`]: { color: '#ffffff' } },
  }],
})

const whitePixels = async (page, framePath) => {
  const src = `data:image/png;base64,${(await readFile(framePath)).toString('base64')}`
  return page.evaluate(async (dataUrl) => {
    const image = new Image()
    image.src = dataUrl
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d', { willReadFrequently: true })
    context.drawImage(image, 0, 0)
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data
    let count = 0
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 200 && data[i] > 220 && data[i + 1] > 220 && data[i + 2] > 220) count += 1
    }
    return count
  }, src)
}

const browser = await puppeteer.launch(browserLaunchOptions({ width: 360, height: 640 }))
try {
  const page = await browser.newPage()
  const results = {}
  for (const [id, revealMode] of [['whole', ''], ['reveal', 'word']]) {
    const outputDir = path.join(tempRoot, id)
    const payloadPath = path.join(tempRoot, `${id}.json`)
    await writeFile(payloadPath, JSON.stringify(payloadFor(id, revealMode, outputDir)), 'utf8')
    execFileSync(process.execPath, [rendererPath, payloadPath], { cwd: projectRoot, env: process.env, stdio: 'pipe' })
    const frames = (await readdir(outputDir)).filter((name) => /^frame-\d+\.png$/i.test(name))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    // One frame per segment between word boundaries: the first covers 0-1 s
    // (only FIRST spoken), the last 2-3 s (all three).
    assert.ok(frames.length >= 3, `${id}: renderer produced ${frames.length} frames`)
    results[id] = {
      early: await whitePixels(page, path.join(outputDir, frames[0])),
      late: await whitePixels(page, path.join(outputDir, frames[frames.length - 1])),
    }
  }
  const { whole, reveal } = results
  assert.ok(whole.early > 300 && Math.abs(whole.early - whole.late) <= whole.late * 0.1,
    `a normal caption shows the whole sentence from the start (${JSON.stringify(whole)})`)
  assert.ok(reveal.early > 50 && reveal.early < reveal.late * 0.6,
    `a word-by-word caption shows only the spoken words early on (${JSON.stringify(reveal)})`)
  assert.ok(Math.abs(reveal.late - whole.late) <= whole.late * 0.1,
    `a word-by-word caption ends with the whole sentence (${JSON.stringify(results)})`)
  console.log(`Word reveal export checks passed (${JSON.stringify(results)}).`)
} finally {
  await browser.close()
  await rm(tempRoot, { recursive: true, force: true })
}
