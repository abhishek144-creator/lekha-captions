import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import puppeteer from 'puppeteer'

// Exercise the renderer's real font-settling block against a delayed font.
// The negative control proves that waiting on the empty document is too early.
const renderer = await fs.readFile(new URL('./render_template_overlay.mjs', import.meta.url), 'utf8')
const start = renderer.indexOf('            window.__renderPayload(currentPayload, currentTime);')
const end = renderer.indexOf('            if (window.__activateTemplateAnimations)', start)
assert.ok(start >= 0 && end > start, 'renderer font-settling block not found')
const fixedRender = renderer.slice(start, end)
const font = await fs.readFile(new URL('../fonts/Inter.ttf', import.meta.url))
const ciBypass = process.env.CI === 'true' && process.env.PUPPETEER_CI_NO_SANDBOX === '1'
const browser = await puppeteer.launch({
  headless: true,
  args: ciBypass ? ['--no-sandbox', '--disable-setuid-sandbox'] : [],
})

try {
  for (const fixed of [false, true]) {
    const page = await browser.newPage()
    await page.setRequestInterception(true)
    page.on('request', async (request) => {
      if (request.url() === 'https://font.test/inter.ttf') {
        await new Promise((resolve) => setTimeout(resolve, 200))
        await request.respond({ status: 200, contentType: 'font/ttf', headers: { 'Access-Control-Allow-Origin': '*' }, body: font })
      } else {
        await request.continue()
      }
    })
    await page.setContent(`<style>
      @font-face { font-family: AuditFont; src: url(https://font.test/inter.ttf); font-display: swap; }
      body { margin: 0; }
      #overlay-root { width: 360px; }
      span { display: inline-block; font: 48px AuditFont, monospace; }
    </style><div id="overlay-root"></div>`)
    const result = await page.evaluate(async ({ code }) => {
      await document.fonts.ready
      const initiallyReady = document.fonts.status === 'loaded'
      let renders = 0
      window.__renderPayload = () => {
        renders += 1
        const root = document.getElementById('overlay-root')
        root.innerHTML = '<span>WWiiiiiii</span>'
        const word = root.firstElementChild
        const box = word.getBoundingClientRect()
        word.style.translate = `${288 - box.left - box.width / 2}px 0`
      }
      await new Function('currentPayload', 'currentTime', `return (async () => { ${code} })()` )({}, 0)
      await document.fonts.ready
      const box = document.querySelector('span').getBoundingClientRect()
      return { initiallyReady, renders, center: box.left + box.width / 2 }
    }, { code: fixed ? fixedRender : 'window.__renderPayload(currentPayload, currentTime);' })
    assert.equal(result.initiallyReady, true)
    if (fixed) {
      assert.equal(result.renders, 2, 'newly loaded fonts must rebuild measured placement')
      assert.ok(Math.abs(result.center - 288) < 1, `settled word moved to ${result.center}`)
    } else {
      assert.ok(Math.abs(result.center - 288) > 1, 'negative control did not reproduce font-swap drift')
    }
    await page.close()
  }
  console.log('Export font readiness passed, including delayed-font negative control.')
} finally {
  await browser.close()
}
