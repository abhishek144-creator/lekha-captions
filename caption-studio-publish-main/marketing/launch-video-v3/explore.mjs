// One-off: open the editor, screenshot it, and list the clickable UI so capture steps can target it.
import { mkdirSync } from 'node:fs'
import { openEditor, seek } from './editor-session.mjs'

mkdirSync('shots', { recursive: true })
const { browser, page } = await openEditor()
await seek(page, 3.2)
await page.screenshot({ path: 'shots/explore-0.png' })
const ui = await page.evaluate(() => {
  const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.top < innerHeight && r.left < innerWidth }
  return [...document.querySelectorAll('button, [role=tab], [role=button]')].filter(vis).map((el) => {
    const r = el.getBoundingClientRect()
    return `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)} | ${(el.innerText || el.getAttribute('aria-label') || el.title || '').replace(/\s+/g, ' ').slice(0, 50)}`
  })
})
console.log(ui.join('\n'))
await browser.close()
