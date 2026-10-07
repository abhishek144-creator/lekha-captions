// One-off: visit each editor surface the film needs and screenshot it.
import { openEditor, seek } from './editor-session.mjs'

const { browser, page } = await openEditor()
const shot = async (name) => { await new Promise((r) => setTimeout(r, 700)); await page.screenshot({ path: `shots/${name}.png` }) }
const list = async (sel = 'button') => page.evaluate((s) => [...document.querySelectorAll(s)].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.top < innerHeight && r.left < innerWidth }).map((el) => { const r = el.getBoundingClientRect(); return `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)} | ${(el.innerText || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').slice(0, 40)}` }).join('\n'), sel)

await seek(page, 3.2)
// floating word editor: click a word on the preview
const word = await page.evaluate(() => {
  const el = [...document.querySelectorAll('span, div')].find((n) => n.children.length === 0 && /^strategy,?$/.test(n.textContent.trim()) && n.getBoundingClientRect().left > 600)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return [r.left + r.width / 2, r.top + r.height / 2]
})
console.log('word at', word)
if (word) { await page.mouse.click(word[0], word[1]); await shot('x-floating') ; console.log('--- after word click\n' + await list()) }
await page.keyboard.press('Escape')

await page.mouse.click(1493 + 39, 120 + 13) // ANIMATE tab
await shot('x-animate')
console.log('--- animate tab\n' + await list())

await page.mouse.click(1395 + 43, 120 + 13) // TEMPLATES tab
await shot('x-right-templates')

await page.mouse.click(18 + 18, 480 + 18) // left Templates gallery
await shot('x-left-templates')
console.log('--- left templates\n' + await list())

await page.mouse.click(1305 + 39, 120 + 13) // STYLE tab
await page.evaluate(() => { const p = [...document.querySelectorAll('*')].find((n) => n.scrollHeight > n.clientHeight + 200 && n.getBoundingClientRect().left > 1250); if (p) p.scrollTop = 900 })
await shot('x-style-scrolled')

await page.mouse.click(1464 + 58, 12 + 16) // EXPORT
await shot('x-export')
console.log('--- export\n' + await list())
await browser.close()
