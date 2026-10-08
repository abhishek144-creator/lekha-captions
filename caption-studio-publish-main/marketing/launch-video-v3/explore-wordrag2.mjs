// One-off: after dragging a word out of the line, find the visible copy, open the floating editor on it, size it up
import { openEditor } from './editor-session.mjs'
const { browser, page } = await openEditor({ scale: 1 })
const W = (ms) => new Promise((r) => setTimeout(r, ms))
await page.evaluate(async () => { const v = document.querySelector('video'); v.muted = true; v.currentTime = 3.2; await new Promise((r) => v.addEventListener('seeked', r, { once: true })); v.dispatchEvent(new Event('timeupdate')) })
await W(600)
const words = () => page.evaluate(() => { const v = document.querySelector('video').getBoundingClientRect(); return [...document.querySelectorAll('span, div')].filter((n) => n.children.length === 0 && /^strategy,?$/.test(n.textContent.trim())).map((el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return { r: [r.left, r.top, r.width, r.height].map(Math.round), vis: cs.visibility, op: cs.opacity, cls: el.className, attrs: [...el.attributes].map(a=>a.name).join(' '), parentCls: el.parentElement.className.slice(0,80) } }) })
console.log('before', JSON.stringify(await words()))
const w = [926, 672]
await page.mouse.move(w[0], w[1]); await page.mouse.down()
for (let i = 1; i <= 20; i++) { await page.mouse.move(w[0] + 2 * i, w[1] - 6 * i); await W(25) }
await page.mouse.up(); await W(800)
console.log('after', JSON.stringify(await words()))
console.log('popup after drag?', await page.evaluate(() => !!document.querySelector('[data-word-popup-panel]')))
await page.mouse.click(w[0] + 40, w[1] - 120); await W(900)
const pr = await page.evaluate(() => { const p = document.querySelector('[data-word-popup-panel]'); if (!p) return null; const r = p.getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map(Math.round) })
console.log('popup', pr)
await page.screenshot({ path: 'shots/wd-2-popup.png' })
if (pr) {
  const s = await page.evaluate(() => { const el = document.querySelector('[data-word-popup-panel] [role=slider]'); const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2] })
  await page.mouse.move(s[0], s[1]); await page.mouse.down()
  for (let i = 1; i <= 15; i++) { await page.mouse.move(s[0] + 5 * i, s[1]); await W(25) }
  await page.mouse.up(); await W(600)
  console.log('sized', JSON.stringify(await words()))
  await page.screenshot({ path: 'shots/wd-3-sized.png' })
}
await browser.close()
