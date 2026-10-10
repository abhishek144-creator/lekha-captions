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
  const checkInline = async () => {
    const bounds = await page.evaluate(() => [0, 1, 2].map((index) => {
      const node = document.querySelector(`[data-word-key="geometry-${index}"]`)
      const box = node.getBoundingClientRect()
      const range = document.createRange()
      range.selectNodeContents(node.querySelector('[data-word-drag-visual]'))
      const visual = range.getBoundingClientRect()
      return { left: visual.left, right: visual.right, top: visual.top, bottom: visual.bottom, boxWidth: box.width, visualWidth: visual.width }
    }))
    assert.ok(bounds[1].boxWidth >= bounds[1].visualWidth - 1, `enlarged word exceeds its click/selection box: ${JSON.stringify(bounds)}`)
    for (let index = 1; index < bounds.length; index += 1) {
      const before = bounds[index - 1]
      const after = bounds[index]
      assert.ok(after.left >= before.right - 1 || after.top >= before.bottom - 1, `adjacent words overlap: ${JSON.stringify(bounds)}`)
    }
  }
  for (const button of ['enlarge', 'emphasis']) {
    await page.click(`#${button}`)
    await checkInline()
  }
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
  console.log('Word editing geometry passed on desktop and phone viewport: enlarged/emphasised spacing and detached text centring, click and selection stability.')
} finally {
  await browser?.close()
  await server.close()
}
