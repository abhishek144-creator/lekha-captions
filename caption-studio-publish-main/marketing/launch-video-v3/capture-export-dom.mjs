// Captures the real (guest) export sheet from the live editor (recording viewport) as reference for export-mock.html:
// mock/app.css (all compiled same-origin CSS), mock/sheet.html (outerHTML), mock/meta.json, shots/real-export.png
import { writeFileSync } from 'node:fs'
import { openEditor, seek } from './editor-session.mjs'
const { browser, page } = await openEditor({ scale: 1 })
await seek(page, 2.6)
const btn = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim().toUpperCase() === 'EXPORT'); const r = b.getBoundingClientRect(); return [r.left, r.top, r.width, r.height] })
await page.mouse.click(btn[0] + btn[2] / 2, btn[1] + btn[3] / 2)
await page.waitForSelector('[role=dialog]')
await new Promise((r) => setTimeout(r, 1500))
await page.screenshot({ path: 'shots/real-export.png' })
const data = await page.evaluate(() => {
  const css = []
  const links = []
  for (const s of document.styleSheets) {
    try { css.push([...s.cssRules].map((r) => r.cssText).join('\n')) } catch { links.push(s.href) }
  }
  const dlg = document.querySelector('[role=dialog]')
  const overlay = dlg.previousElementSibling
  const fonts = [...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.family} ${f.weight} ${f.style}`)
  const r = dlg.getBoundingClientRect()
  return {
    css: css.join('\n'), links,
    htmlClass: document.documentElement.className, bodyClass: document.body.className,
    bodyFont: getComputedStyle(document.body).fontFamily, sheetFont: getComputedStyle(dlg).fontFamily,
    overlayHTML: overlay ? overlay.outerHTML : '', sheetHTML: dlg.outerHTML,
    sheetRect: [r.left, r.top, r.width, r.height], scrollH: dlg.scrollHeight, fonts,
    headLinks: [...document.querySelectorAll('link[rel=stylesheet], link[rel=preconnect]')].map((l) => l.outerHTML),
  }
})
const CSS_HEADER = `/* Snapshot of the Lekha editor's compiled stylesheet, captured by capture-export-dom.mjs so export-mock.html
   uses the app's own Tailwind classes. @import rules removed (fonts are linked from the mock page). */\n`
writeFileSync('mock/app.css', CSS_HEADER + data.css.split('\n').filter((l) => !l.trimStart().startsWith('@import')).join('\n'))
writeFileSync('mock/sheet.html', data.overlayHTML + '\n' + data.sheetHTML)
delete data.css; delete data.sheetHTML; delete data.overlayHTML
data.exportBtn = btn
writeFileSync('mock/meta.json', JSON.stringify(data, null, 1))
console.log(JSON.stringify(data, null, 1).slice(0, 3000))
await browser.close()
