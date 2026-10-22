import assert from 'node:assert/strict'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import puppeteer from 'puppeteer'

// Exercise real painted bounds and hit-testing, rather than declared CSS.
// This fixture uses no account, provider requests or production writes.
const server = await createServer({
  configFile: false, envDir: false, plugins: [react()],
  resolve: { alias: { '@': resolve('src') } },
  server: { host: '127.0.0.1', port: 4189, strictPort: true },
})
await server.listen()
let browser
try {
  browser = await puppeteer.launch({ headless: true, args: process.env.CI ? ['--no-sandbox'] : [] })
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.setRequestInterception(true)
  page.on('request', (request) => new URL(request.url()).hostname === '127.0.0.1' ? request.continue() : request.abort())
  for (const viewport of [{ width: 1440, height: 1100 }, { width: 390, height: 844, isMobile: true, hasTouch: true }]) {
  await page.setViewport(viewport)
  await page.goto('http://127.0.0.1:4189/e2e/fixtures/wordGeometry.html')
  const words = '[data-word-key="geometry-1"]'
  await page.waitForSelector(words)
  // Owner's design: enlarging or emphasising a word never moves the others.
  // Each word keeps a slot at the caption's base size; the larger word is
  // painted centred on its slot (and may overlap), still clickable and fully
  // outlined when selected.
  const slots = () => page.evaluate(() => [0, 1, 2].map((index) => {
    const node = document.querySelector(`[data-word-key="geometry-${index}"]`)
    const box = node.getBoundingClientRect()
    const range = document.createRange()
    range.selectNodeContents(node.querySelector('[data-word-drag-visual]'))
    const paint = range.getBoundingClientRect()
    return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, paintLeft: paint.left, paintRight: paint.right, paintTop: paint.top, paintBottom: paint.bottom }
  }))
  const checkInline = async (baselineButton, button) => {
    await page.click(`#${baselineButton}`)
    const before = await slots()
    await page.click(`#${button}`)
    const after = await slots()
    for (const index of [0, 2]) {
      for (const edge of ['left', 'right', 'top', 'bottom']) {
        assert.ok(Math.abs(after[index][edge] - before[index][edge]) < 1, `${button}: word ${index} moved (${edge}): ${JSON.stringify({ before, after })}`)
      }
    }
    const word = after[1]
    assert.ok(word.paintRight - word.paintLeft > (word.right - word.left) * 1.3, `${button}: word is not painted larger than its slot: ${JSON.stringify(word)}`)
    const slotCentre = (word.left + word.right) / 2
    assert.ok(Math.abs((word.paintLeft + word.paintRight) / 2 - slotCentre) < 1.5, `${button}: painted word is not centred on its slot: ${JSON.stringify(word)}`)
    // The part painted beyond the slot still selects the word, and the ring
    // outlines the whole painted word.
    await page.mouse.click(word.paintRight - 2, (word.paintTop + word.paintBottom) / 2)
    const ring = await page.waitForFunction(() => {
      const visual = document.querySelector('[data-word-key="geometry-1"] [data-word-drag-visual]')
      const node = [...(visual?.children || [])].find((child) => child.style.border)
      return node && node.getBoundingClientRect().toJSON()
    }, { timeout: 3000 }).then((handle) => handle.jsonValue())
    assert.ok(ring.left <= word.paintLeft + 1 && ring.right >= word.paintRight - 1, `${button}: selection ring does not cover the painted word: ${JSON.stringify({ ring, word })}`)
    await page.click('#unselect')
  }
  await checkInline('restyle', 'enlarge')
  await checkInline('reset', 'emphasis')
  await page.click('#detach')
  const bounds = () => page.$eval(words, (node) => {
    const range = document.createRange()
    const text = [...node.querySelectorAll('span')].find((el) => el.childNodes.length === 1 && el.firstChild.nodeType === Node.TEXT_NODE && getComputedStyle(el).visibility !== 'hidden')
    range.selectNodeContents(text)
    const box = node.getBoundingClientRect()
    const paint = range.getBoundingClientRect()
    return { x: paint.x, y: paint.y, width: paint.width, height: paint.height, centerX: box.x + box.width / 2, centerY: box.y + box.height / 2 }
  })
  const before = await bounds()
  assert.ok(Math.abs(before.x + before.width / 2 - before.centerX) < 1, 'detached text must stay centred in its hit target')
  await page.mouse.click(before.x + before.width / 2, before.y + before.height / 2)
  await page.waitForSelector('[data-selected-word-box="true"]')
  const selected = await bounds()
  assert.ok(Math.abs(selected.x - before.x) < 1 && Math.abs(selected.y - before.y) < 1, `selecting a detached word moved its text: ${JSON.stringify({ before, selected })}`)
  await page.click('#unselect')
  const after = await bounds()
  assert.ok(Math.abs(after.x - before.x) < 1 && Math.abs(after.y - before.y) < 1, 'unselecting moved detached text')
  }
  assert.deepEqual(errors, [])
  console.log('Word editing geometry passed on desktop and phone viewport: enlarged/emphasised words leave neighbours in place and stay centred, clickable and outlined; detached text centring, click and selection stability.')
} finally {
  await browser?.close()
  await server.close()
}
