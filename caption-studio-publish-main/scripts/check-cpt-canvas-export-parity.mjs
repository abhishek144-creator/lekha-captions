import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import puppeteer from 'puppeteer'
import { browserLaunchOptions } from './render_browser_runtime.mjs'

// Compare the real editor's painted word boxes with the actual server overlay,
// at different canvas and encoded frame sizes. No account or provider calls.
const run = promisify(execFile)
const root = resolve('test-artifacts/cpt-canvas-export')
await mkdir(root, { recursive: true })
const font = (await readFile(resolve('fonts/NotoSansDevanagari.ttf'))).toString('base64')
const fontCss = `@font-face{font-family:'Noto Sans Devanagari';font-style:normal;font-weight:100 900;src:url(data:font/ttf;base64,${font})}`
const fontBundle = resolve(root, 'fonts.css')
await writeFile(fontBundle, fontCss)
await writeFile(`${fontBundle}.json`, JSON.stringify({ families: ['Noto Sans Devanagari'], sha256: createHash('sha256').update(fontCss).digest('hex') }))
const server = await createServer({
  configFile: false, envDir: false, logLevel: 'error', plugins: [react()],
  resolve: { alias: { '@': resolve('src') } },
  server: { host: '127.0.0.1', port: 4193, strictPort: true },
})
await server.listen()
const browser = await puppeteer.launch(browserLaunchOptions())
try {
  const page = await browser.newPage()
  await page.setRequestInterception(true)
  page.on('request', (request) => new URL(request.url()).hostname === '127.0.0.1' ? request.continue() : request.abort())
  const fixture = {
    caption: { id: 'cpt', text: 'मेरे पीछे जो आप शिप देख', start_time: 0, end_time: 1, template_phase_index: 0,
      imp_word_index: 4, imp_word_indices: [4], wordStyles: {
        'cpt-0': { fontSize: 42, x: -40, y: -80, x_pct: -40 / 360 * 100, y_pct: -80 / 640 * 100 },
        'cpt-1': { fontSize: 12 },
      }, words: [] },
    style: { font_family: 'Noto Sans Devanagari', font_size: 17, font_weight: '800', position_y: 60,
      text_color: '#ffffff', secondary_color: '#00dca0', line_spacing: 1.25, word_spacing: 1, has_background: false },
  }
  for (const height of [768, 1100]) {
    await page.setViewport({ width: 1360, height })
    await page.goto('http://127.0.0.1:4193/e2e/fixtures/wordGeometry.html')
    await page.evaluate((value) => localStorage.setItem('cptParityFixture', JSON.stringify(value)), fixture)
    await page.goto('http://127.0.0.1:4193/e2e/fixtures/cptExportParity.html')
    await page.addStyleTag({ content: fontCss })
    await page.evaluate(() => document.fonts.load('800 42px "Noto Sans Devanagari"', 'मेरे'))
    await page.waitForSelector('[data-template-card-id="T213"]')
    await page.click('[data-template-card-id="T213"]')
    await page.waitForSelector('[data-source-word-index]')
    await page.waitForFunction(() => document.querySelector('.lekha-video-frame [data-word-key="cpt-0"] [data-source-word-visual]'))
    const expected = await page.evaluate(() => {
      const frame = document.querySelector('.lekha-video-frame').getBoundingClientRect()
      return [...document.querySelectorAll('.lekha-video-frame [data-source-word-index]')].filter((node) => node.closest('.sb.active')).map((node) => {
        const visual = node.querySelector('[data-source-word-visual]') || node
        const rect = visual.getBoundingClientRect()
        const css = getComputedStyle(visual)
        return { wordIndex: Number(node.dataset.sourceWordIndex), text: visual.textContent.trim(),
          cx: (rect.left + rect.width / 2 - frame.left) / frame.width,
          cy: (rect.top + rect.height / 2 - frame.top) / frame.height,
          fs: parseFloat(css.fontSize) / frame.width, color: css.webkitTextFillColor || css.color }
      })
    })
    assert.equal(expected.length, 6, 'all Hindi words must be measured on the canvas')
    const state = JSON.parse(await page.$eval('#fixture-state', (node) => node.textContent))
    await page.screenshot({ path: resolve(root, `canvas-${height}.png`) })
    for (const width of [360, 720]) {
      const output = resolve(root, `${height}-${width}`)
      const payloadPath = `${output}.json`
      const caption = state.captions[0]
      await writeFile(payloadPath, JSON.stringify({ video_width: width, video_height: width * 16 / 9,
        duration: 1, output_dir: output, style: { ...state.style, fps: 24 }, captions: [{ ...caption,
          word_styles: caption.wordStyles, imp_word_chosen: true, emphasis_color: state.style.highlight_color }] }))
      await run(process.execPath, ['scripts/render_template_overlay.mjs', payloadPath], {
        env: { ...process.env, TEMPLATE_OVERLAY_GEOMETRY_AUDIT: '1', RENDER_FONT_BUNDLE_PATH: fontBundle,
          RENDER_FONT_BUNDLE_REQUIRED: '1', PREFER_PACKAGED_RENDER_FONTS: '1' }, maxBuffer: 8 * 1024 * 1024,
      })
      const audit = JSON.parse(await readFile(resolve(output, 'template-completeness-audit.json'), 'utf8'))
      const actual = audit.at(-1)?.captions?.[0]?.wordGeometry || audit.at(-1)?.wordGeometry
      assert.ok(actual?.length, `export has no word geometry: ${JSON.stringify(audit).slice(0, 300)}`)
      for (const word of expected) {
        const exported = actual.find((entry) => entry.wordIndex === word.wordIndex)
        assert.ok(exported, `missing exported word ${word.text}`)
        assert.equal(exported.text, word.text, 'the exact canvas text must export')
        for (const prop of ['cx', 'cy', 'fs']) assert.ok(Math.abs(exported[prop] - word[prop]) < 0.006,
          `${height}/${width} ${word.text} ${prop}: canvas=${word[prop]} export=${exported[prop]}`)
        assert.equal(exported.color, word.color, `${word.text}: colour must match`)
      }
    }
  }
  // Moving only the first word must never select the all-absolute renderer:
  // an incorrectly escaped whitespace regex treated a Hindi sentence as one
  // word, dropping every remaining word from mixed CPT compositions.
  for (const complete of [false, true]) {
    const output = resolve(root, complete ? 'absolute' : 'mixed-absolute')
    const words = fixture.caption.text.split(/\s+/)
    const wordStyles = Object.fromEntries(words.flatMap((_, index) => complete || index === 0
      ? [[`cpt-${index}`, { abs_x_pct: 25 + index * 10, abs_y_pct: 25 + index * 8 }]] : []))
    const payloadPath = `${output}.json`
    await writeFile(payloadPath, JSON.stringify({ video_width: 360, video_height: 640, duration: 1,
      output_dir: output, style: { ...fixture.style, fps: 24 }, captions: [{ ...fixture.caption, word_styles: wordStyles }] }))
    await run(process.execPath, ['scripts/render_template_overlay.mjs', payloadPath], {
      env: { ...process.env, TEMPLATE_OVERLAY_GEOMETRY_AUDIT: '1', RENDER_FONT_BUNDLE_PATH: fontBundle,
        RENDER_FONT_BUNDLE_REQUIRED: '1', PREFER_PACKAGED_RENDER_FONTS: '1' }, maxBuffer: 8 * 1024 * 1024,
    })
    const audit = JSON.parse(await readFile(resolve(output, 'template-completeness-audit.json'), 'utf8')).at(-1)
    assert.equal(audit.wordGeometry.length, words.length, `${complete ? 'full' : 'mixed'} absolute CPT must keep all words`)
    assert.deepEqual(audit.wordGeometry.map((word) => word.text), words)
    const first = audit.wordGeometry[0]
    assert.ok(Math.abs(first.cx - 0.25) < 0.006 && Math.abs(first.cy - 0.25) < 0.006, 'absolute drop point must survive export')
  }
  console.log('CPT canvas/export parity passed (Hindi, resized and dragged words, two canvas sizes, 360p/720p overlays).')
} finally {
  await browser.close()
  await server.close()
}
