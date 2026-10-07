// One-off: detach a word by dragging it out of the line, then resize + colour it in the floating editor
import { openEditor } from './editor-session.mjs'
const { browser, page } = await openEditor({ scale: 1 })
const W = (ms) => new Promise((r) => setTimeout(r, ms))
await page.evaluate(async () => { const v = document.querySelector('video'); v.muted = true; v.currentTime = 3.2; await new Promise((r) => v.addEventListener('seeked', r, { once: true })); v.dispatchEvent(new Event('timeupdate')) })
await W(600)
const word = () => page.evaluate(() => { const v = document.querySelector('video').getBoundingClientRect(); const el = [...document.querySelectorAll('span, div')].find((n) => n.children.length === 0 && /^strategy,?$/.test(n.textContent.trim()) && n.getBoundingClientRect().left > v.left && n.getBoundingClientRect().right < v.right); if (!el) return null; const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2] })
const w = await word(); console.log('word', w)
await page.mouse.move(w[0], w[1]); await page.mouse.down()
for (let i = 1; i <= 20; i++) { await page.mouse.move(w[0] + 2 * i, w[1] - 6 * i); await W(25) }
await page.mouse.up(); await W(800)
await page.screenshot({ path: 'shots/wd-1-dragged.png' })
const w2 = await word(); console.log('word after drag', w2, 'popup?', await page.evaluate(() => !!document.querySelector('[data-word-popup-panel]')))
if (!(await page.evaluate(() => !!document.querySelector('[data-word-popup-panel]')))) { await page.mouse.click(w2[0], w2[1]); await W(900) }
console.log('popup', await page.evaluate(() => { const p = document.querySelector('[data-word-popup-panel]'); if (!p) return null; const r = p.getBoundingClientRect(); return [r.left, r.top, r.width, r.height] }))
const s = await page.evaluate(() => { const el = document.querySelector('[data-word-popup-panel] [role=slider]'); const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2] })
await page.mouse.move(s[0], s[1]); await page.mouse.down()
for (let i = 1; i <= 15; i++) { await page.mouse.move(s[0] + 5 * i, s[1]); await W(25) }
await page.mouse.up(); await W(600)
await page.screenshot({ path: 'shots/wd-2-sized.png' })
await browser.close()
