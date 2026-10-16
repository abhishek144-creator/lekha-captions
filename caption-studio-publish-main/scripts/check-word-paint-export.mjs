import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'
import { browserLaunchOptions } from './render_browser_runtime.mjs'

// The export must paint per-word colours like the editor (src/lib/wordPaint.js):
// a text gradient and a word background on the same word are both visible, and
// a highlight gradient paints the box. Renders real overlay frames and counts
// pixels, so a declaration the browser drops is caught.
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rendererPath = path.join(projectRoot, 'scripts', 'render_template_overlay.mjs')
const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'lekha-word-paint-'))

const words = ['PAINT', 'CHECK', 'WORD']
const caseStyles = {
  'gradient-and-background': {
    textGradient: 'linear-gradient(to right, #ff0000, #0000ff)',
    backgroundColor: '#00ff00',
    backgroundOpacity: 1,
  },
  'highlight-gradient': {
    highlightGradient: 'linear-gradient(to right, #00ff00, #00ff00)',
  },
}

const payloadFor = (id, wordStyle, outputDir) => ({
  video_width: 360,
  video_height: 640,
  duration: 1,
  output_dir: outputDir,
  style: {
    font_family: 'Inter', font_size: 40, font_weight: '800', position_x: 50, position_y: 60,
    text_color: '#ffffff', has_background: false, show_inactive: true, fps: 4,
    preview_width: 360, preview_height: 640,
  },
  captions: [{
    id, text: words.join(' '), start_time: 0, end_time: 1, is_text_element: false,
    words: words.map((word, index) => ({ word, start: index / 3, end: (index + 1) / 3 })),
    word_styles: { [`${id}-1`]: wordStyle },
  }],
})

const countColours = async (page, framePath) => {
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
    const counts = { green: 0, red: 0, blue: 0, white: 0 }
    for (let i = 0; i < data.length; i += 4) {
      const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]]
      if (a < 200) continue
      if (g > 200 && r < 80 && b < 80) counts.green += 1
      else if (r > 170 && g < 80 && b < 120) counts.red += 1
      else if (b > 170 && r < 120 && g < 80) counts.blue += 1
      else if (r > 220 && g > 220 && b > 220) counts.white += 1
    }
    return counts
  }, src)
}

const browser = await puppeteer.launch(browserLaunchOptions({ width: 360, height: 640 }))
try {
  const page = await browser.newPage()
  const results = {}
  for (const [id, wordStyle] of Object.entries(caseStyles)) {
    const outputDir = path.join(tempRoot, id)
    const payloadPath = path.join(tempRoot, `${id}.json`)
    await writeFile(payloadPath, JSON.stringify(payloadFor(id, wordStyle, outputDir)), 'utf8')
    execFileSync(process.execPath, [rendererPath, payloadPath], { cwd: projectRoot, env: process.env, stdio: 'pipe' })
    const frames = (await readdir(outputDir)).filter((name) => /^frame-\d+\.png$/i.test(name))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    assert.ok(frames.length, `${id}: renderer produced no frames`)
    results[id] = await countColours(page, path.join(outputDir, frames[frames.length - 1]))
  }
  const both = results['gradient-and-background']
  assert.ok(both.green > 300, `a word background must survive a text gradient on the same word (${JSON.stringify(both)})`)
  assert.ok(both.red > 30 && both.blue > 30, `the text gradient must still paint the word (${JSON.stringify(both)})`)
  assert.ok(both.white > 100, `untouched words keep the caption colour (${JSON.stringify(both)})`)
  const highlight = results['highlight-gradient']
  assert.ok(highlight.green > 300, `a highlight gradient must paint the word box (${JSON.stringify(highlight)})`)
  console.log(`Word paint export checks passed (${JSON.stringify(results)}).`)
} finally {
  await browser.close()
  await rm(tempRoot, { recursive: true, force: true })
}
