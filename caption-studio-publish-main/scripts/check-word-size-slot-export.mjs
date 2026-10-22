import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'
import { browserLaunchOptions } from './render_browser_runtime.mjs'

// Enlarging or emphasising one word must not move its neighbours in the
// export, matching the editor preview: the word keeps a slot at the caption's
// base size and is painted centred on it. Renders real overlay frames and
// compares where the neighbour (white) and edited (red) pixels land with and
// without the size change.
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rendererPath = path.join(projectRoot, 'scripts', 'render_template_overlay.mjs')
const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'lekha-word-slot-'))

const words = ['LEFTWORD', 'MID', 'RIGHTWORD']
const caseStyles = {
  base: { color: '#ff0000' },
  enlarged: { color: '#ff0000', fontSize: 44 },
  emphasis: { color: '#ff0000', isEmphasis: true, fontSize: 30 },
}

const payloadFor = (id, wordStyle, outputDir) => ({
  video_width: 360,
  video_height: 640,
  duration: 1,
  output_dir: outputDir,
  style: {
    font_family: 'Inter', font_size: 20, font_weight: '800', position_x: 50, position_y: 50,
    text_color: '#ffffff', has_background: false, has_shadow: false, show_inactive: true, fps: 4,
    preview_width: 360, preview_height: 640,
  },
  captions: [{
    id, text: words.join(' '), start_time: 0, end_time: 1, is_text_element: false,
    words: words.map((word, index) => ({ word, start: index / 3, end: (index + 1) / 3 })),
    word_styles: { [`${id}-1`]: wordStyle },
  }],
})

const extents = async (page, framePath) => {
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
    const box = () => ({ left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity, count: 0 })
    const white = box()
    const red = box()
    for (let i = 0; i < data.length; i += 4) {
      const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]]
      if (a < 200) continue
      const target = r > 220 && g > 220 && b > 220 ? white : (r > 200 && g < 60 && b < 60 ? red : null)
      if (!target) continue
      const x = (i / 4) % canvas.width
      const y = Math.floor(i / 4 / canvas.width)
      target.left = Math.min(target.left, x)
      target.right = Math.max(target.right, x)
      target.top = Math.min(target.top, y)
      target.bottom = Math.max(target.bottom, y)
      target.count += 1
    }
    return { white, red }
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
    results[id] = await extents(page, path.join(outputDir, frames[frames.length - 1]))
  }
  const base = results.base
  assert.ok(base.white.count > 200 && base.red.count > 50, `base render paints both colours (${JSON.stringify(base)})`)
  const centre = (box) => (box.left + box.right) / 2
  for (const id of ['enlarged', 'emphasis']) {
    const edited = results[id]
    // Outer edges of the neighbours (LEFTWORD's left, RIGHTWORD's right) and the
    // line's vertical band stay put; 1px for anti-aliasing.
    for (const edge of ['left', 'right', 'top', 'bottom']) {
      assert.ok(Math.abs(edited.white[edge] - base.white[edge]) <= 1,
        `${id}: neighbour words moved (${edge} ${base.white[edge]} -> ${edited.white[edge]})`)
    }
    assert.ok(edited.red.right - edited.red.left > (base.red.right - base.red.left) * 1.3,
      `${id}: the edited word is painted larger (${JSON.stringify(base.red)} -> ${JSON.stringify(edited.red)})`)
    assert.ok(Math.abs(centre(edited.red) - centre(base.red)) <= 2,
      `${id}: the larger word is centred on its original slot (${centre(base.red)} -> ${centre(edited.red)})`)
  }
  console.log(`Word size slot export checks passed (${JSON.stringify(Object.fromEntries(Object.entries(results).map(([id, r]) => [id, { white: [r.white.left, r.white.right], red: [r.red.left, r.red.right] }])))}).`)
} finally {
  await browser.close()
  await rm(tempRoot, { recursive: true, force: true })
}
