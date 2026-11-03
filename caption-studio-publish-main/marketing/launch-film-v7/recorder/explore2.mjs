// Second pass: clear the first-visit overlays, open the timeline, open a caption line for editing,
// open the left Templates gallery. Screenshots + geometry for scripting the takes.
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { clearOverlays, openEditor, seek } from './session.mjs'

const out = path.resolve('explore')
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const { browser, page } = await openEditor()
await clearOverlays(page)
await seek(page, 3.2)
const btn = (re) => page.evaluate((src) => {
  const rx = new RegExp(src, 'i')
  const b = [...document.querySelectorAll('button')].find((x) => rx.test((x.innerText || x.getAttribute('aria-label') || '').trim()) && x.getBoundingClientRect().width > 0)
  if (!b) return null; const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]
}, re.source)

const t = await btn(/TIMELINE/)
await page.mouse.click(t[0], t[1]); await wait(1200)
await page.screenshot({ path: path.join(out, 'timeline.png') })
const chips = await page.evaluate(() => [...document.querySelectorAll('body *')].filter((n) => n.children.length === 0 && /^(humility|strategy,|weakness\.)$/.test(n.textContent.trim()) && n.getBoundingClientRect().top > 700)
  .map((n) => { const r = n.getBoundingClientRect(); return [n.textContent.trim(), Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] }))

const line = await page.evaluate(() => {
  const el = [...document.querySelectorAll('body *')].find((n) => n.children.length === 0 && /^humility is a strategy,/.test(n.textContent.trim()) && n.getBoundingClientRect().left < 420)
  const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]
})
await page.mouse.click(line[0], line[1]); await wait(900)
await page.screenshot({ path: path.join(out, 'line-open.png') })
const edit = await page.evaluate(() => [...document.querySelectorAll('textarea, input, [contenteditable=true]')].filter((n) => n.getBoundingClientRect().width > 0)
  .map((n) => { const r = n.getBoundingClientRect(); return { tag: n.tagName, v: (n.value || n.textContent || '').slice(0, 60), r: [r.left, r.top, r.width, r.height].map(Math.round) } }))
await page.keyboard.press('Escape'); await wait(400)

const g = await btn(/^Templates$/)
await page.mouse.click(g[0], g[1]); await wait(2500)
await page.screenshot({ path: path.join(out, 'gallery.png') })
const cards = await page.evaluate(() => [...document.querySelectorAll('body *')].filter((n) => n.children.length === 0 && /^(LC )?T\d{3}/.test(n.textContent.trim()) && n.getBoundingClientRect().width > 0)
  .slice(0, 12).map((n) => { const r = n.getBoundingClientRect(); return [n.textContent.trim().slice(0, 30), Math.round(r.left), Math.round(r.top)] }))
writeFileSync(path.join(out, 'map2.json'), JSON.stringify({ chips, line, edit, cards }, null, 1))
console.log(JSON.stringify({ chips, line, edit, cards }))
await browser.close()
