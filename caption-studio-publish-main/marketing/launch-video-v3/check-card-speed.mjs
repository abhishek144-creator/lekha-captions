// Check that template-card previews play at real speed in a recording: measures the card's line changes
// in real seconds at page rate 1 and at the recording rate (node check-card-speed.mjs 1 && node check-card-speed.mjs 0.153846).
// Card sequencer: HOLD 2200 + EXIT 560 + GAP 120 ms per line ⇒ ~2.9 s per line at real speed,
// so at rate 1/6.5 a correct recording shows ~18.7 s (real) between line changes.
import { openEditor, seek, setRate } from './editor-session.mjs'
const rate = Number(process.argv[2] || 1)
const { browser, page } = await openEditor({ scale: 1 })
console.log('puppeteer frame.client?', typeof page.mainFrame().client)
await seek(page, 2.3)
const cdp = await page.createCDPSession()
await setRate(page, cdp, rate)
await page.mouse.click(36, 558) // Templates gallery (iframes mount after the rate is set)
const t0 = Date.now()
let last = null
const changes = []
let animProbe = null
while (Date.now() - t0 < (rate === 1 ? 12000 : 45000)) {
  const f = page.frames().find((x) => x.url() === 'about:srcdoc')
  if (f) {
    const sig = await f.evaluate(() => {
      const a = document.querySelector('.active')
      return a ? [...a.parentElement.children].indexOf(a) + ':' + a.textContent.trim().slice(0, 24) : null
    }).catch(() => null)
    if (sig !== last) { changes.push([((Date.now() - t0) / 1000).toFixed(2), sig]); last = sig }
    if (!animProbe) {
      animProbe = await f.evaluate(async () => {
        const an = document.getAnimations()
        if (!an.length) return null
        const a = an[0], c0 = a.currentTime, r0 = Date.now()
        await new Promise((r) => setTimeout(r, 1)) // patched timeout; just yield
        const busy = r0 + 1000; while (Date.now() < busy) { /* spin on patched clock */ }
        return { n: an.length, c0, c1: a.currentTime }
      }).catch(() => null)
    }
  }
  await new Promise((r) => setTimeout(r, 100))
}
console.log('rate', rate, 'line changes (real s):', JSON.stringify(changes))
const ts = changes.filter((c) => c[1]).map((c) => +c[0])
const gaps = ts.slice(1).map((t, i) => (t - ts[i]).toFixed(2))
console.log('gaps real s', gaps.join(' '), '→ film s', gaps.map((g) => (g * rate).toFixed(2)).join(' '))
console.log('css anim probe', JSON.stringify(animProbe))
await browser.close()
