// One-off: size up an IN-LINE word (not dragged) and measure the word's layout box vs its painted glyphs
import { openEditor } from './editor-session.mjs'
const { browser, page } = await openEditor({ scale: 1 })
const W = (ms) => new Promise((r) => setTimeout(r, ms))
await page.evaluate(async () => { const v = document.querySelector('video'); v.muted = true; v.currentTime = 3.2; await new Promise((r) => v.addEventListener('seeked', r, { once: true })); v.dispatchEvent(new Event('timeupdate')) })
await W(600)
await page.mouse.click(926, 672); await W(900)
const s = await page.evaluate(() => { const el = document.querySelector('[data-word-popup-panel] [role=slider]'); const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2] })
await page.mouse.move(s[0], s[1]); await page.mouse.down()
for (let i = 1; i <= 15; i++) { await page.mouse.move(s[0] + 5 * i, s[1]); await W(25) }
await page.mouse.up(); await W(600)
const info = await page.evaluate(() => {
  const vis = [...document.querySelectorAll('[data-word-drag-visual]')].filter((n) => /strategy/.test(n.textContent))
  return vis.map((v) => {
    const chain = []
    let n = v
    for (let i = 0; i < 4 && n; i++, n = n.parentElement) {
      const r = n.getBoundingClientRect(), cs = getComputedStyle(n)
      chain.push({ tag: n.tagName, w: Math.round(r.width), h: Math.round(r.height), fs: cs.fontSize, disp: cs.display, transform: cs.transform, scale: cs.scale, style: (n.getAttribute('style') || '').slice(0, 300) })
    }
    const inner = v.querySelector('*') || v
    return { chain, innerHTML: v.innerHTML.slice(0, 400) }
  })
})
console.log(JSON.stringify(info, null, 1))
await page.screenshot({ path: 'shots/inline-size.png', clip: { x: 733, y: 560, width: 407, height: 180 } })
await browser.close()
