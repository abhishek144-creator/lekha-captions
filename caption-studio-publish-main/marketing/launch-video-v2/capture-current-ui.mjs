// Captures the CURRENT editor for the v2d/v2e/v2f films (dev seed, sample clip; nothing is uploaded or saved):
// a 1360 px screen with Chrome at 75 % is a 1813×881 CSS viewport — captured at device scale 2 for the camera's
// close-ups. Films draw these at 0.75 (editor px = CSS px × 0.75).
//   assets/ui/editor.png        the dashboard, template gallery open, Undo enabled (after the gradient pick)
//   assets/ui/editor-undone.png the same after Undo with a template on top (Undo + Redo both enabled)
//   assets/ui/panel-font.png / panel-style.png / panel-grad.png   the floating word panel as it opens, on Style,
//                               and with the warm gradient tile picked
//   assets/ui/geometry.json     every box the films point at (CSS px)
// Needs the dev server on :3000 (npm run dev:frontend).
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { openEditor, seek } from '../launch-video-v3/editor-session.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const out = path.join(here, 'assets', 'ui')
mkdirSync(out, { recursive: true })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const G = {}

const { browser, page } = await openEditor({ width: 1813, height: 881, scale: 2 })
await wait(2500)
const box = (fn, ...a) => page.evaluate(fn, ...a)
const clickText = (text) => box((t) => {
  const el = [...document.querySelectorAll('button')].find((b) => b.offsetParent && b.innerText.trim() === t)
  if (el) el.click()
  return !!el
}, text)

// cookie banner (reject) and the quick guide
await clickText('Reject')
await wait(300)
await box(() => {
  const card = [...document.querySelectorAll('*')].find((el) => el.childElementCount && /QUICK GUIDE/i.test(el.innerText || '') && el.getBoundingClientRect().width < 450)
  const x = card && [...card.querySelectorAll('button')].find((b) => b.innerText.trim() === '')
  if (x) x.click()
})
await wait(300)
// template gallery
await page.mouse.click(36, 487)
await wait(3000)

const rect = (sel) => box((s) => { const el = document.querySelector(s); if (!el) return null; const b = el.getBoundingClientRect(); return [b.x, b.y, b.width, b.height] }, sel)
G.video = await rect('video')
G.buttons = await box(() => Object.fromEntries([...document.querySelectorAll('button')].filter((b) => b.offsetParent && b.getBoundingClientRect().y < 60)
  .map((b) => { const r = b.getBoundingClientRect(); return [(b.innerText || b.getAttribute('aria-label') || b.title || '').trim(), [r.x, r.y, r.width, r.height]] })))
G.cards = await box(() => [...document.querySelectorAll('[class*="card"], div')].filter((d) => {
  const r = d.getBoundingClientRect()
  return d.offsetParent && r.x > 80 && r.x < 95 && r.width > 250 && r.width < 290 && r.height > 150 && r.height < 400
}).slice(0, 2).map((d) => { const r = d.getBoundingClientRect(); return [r.x, r.y, r.width, r.height] }))
G.noneChip = await box(() => {
  const b = [...document.querySelectorAll('button, span, div')].find((el) => el.offsetParent && el.innerText && el.innerText.trim() === 'None' && el.getBoundingClientRect().x > 200)
  if (!b) return null
  const r = (b.closest('button') || b).getBoundingClientRect()
  return [r.x, r.y, r.width, r.height]
})
G.timeline = await box(() => {
  const el = [...document.querySelectorAll('div, button')].filter((d) => d.offsetParent && /TIMELINE/.test(d.innerText || '') && d.getBoundingClientRect().width > 900 && d.getBoundingClientRect().height < 60)
  const r = el[el.length - 1]?.getBoundingClientRect()
  return r ? [r.x, r.y, r.width, r.height] : null
})

// the word panel on "strategy,"
await seek(page, 3.2)
const word = await box(() => {
  const el = [...document.querySelectorAll('span')].find((s) => s.offsetParent && s.innerText.trim() === 'strategy,' && s.getBoundingClientRect().x > 700)
  const b = el.getBoundingClientRect()
  return [b.x + b.width / 2, b.y + b.height / 2]
})
await page.mouse.click(word[0], word[1])
await wait(1200)
const panelBox = () => box(() => {
  const label = [...document.querySelectorAll('*')].find((el) => el.childElementCount === 0 && /^editing:?$/i.test((el.textContent || '').trim()) && el.offsetParent)
  let el = label
  while (el && !(el.getBoundingClientRect().width > 250 && el.getBoundingClientRect().height > 350)) el = el.parentElement
  const r = el.getBoundingClientRect()
  return [r.x, r.y, r.width, r.height]
})
const shotPanel = async (name) => {
  const p = await panelBox()
  await page.screenshot({ path: path.join(out, name), clip: { x: p[0], y: p[1], width: p[2], height: p[3] } })
  return p
}
G.panelFont = await shotPanel('panel-font.png')
G.styleTab = await box(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.offsetParent && x.innerText.trim() === 'Style' && x.getBoundingClientRect().x > 1100)
  const r = b.getBoundingClientRect()
  return [r.x, r.y, r.width, r.height]
})
await page.mouse.click(G.styleTab[0] + G.styleTab[2] / 2, G.styleTab[1] + G.styleTab[3] / 2)
await wait(800)
G.panelStyle = await shotPanel('panel-style.png')
// the gradient tiles (buttons painted with a linear-gradient); the warm one runs yellow → orange → red
G.gradients = await box((pb) => [...document.querySelectorAll('button, div')].filter((b) => {
  const r = b.getBoundingClientRect()
  return b.offsetParent && r.x >= pb[0] && r.x < pb[0] + pb[2] && r.width > 30 && r.width < 120 && r.height < 60 && /linear-gradient/.test(getComputedStyle(b).backgroundImage)
}).map((b) => { const r = b.getBoundingClientRect(); return { bg: getComputedStyle(b).backgroundImage.slice(0, 90), box: [r.x, r.y, r.width, r.height] } }), G.panelStyle)
const warm = G.gradients.find((g) => /248, 197, 20|f8c514/i.test(g.bg)) || G.gradients[0]
G.warm = warm.box
await page.mouse.click(warm.box[0] + warm.box[2] / 2, warm.box[1] + warm.box[3] / 2)
await wait(800)
G.panelGrad = await shotPanel('panel-grad.png')
// the green tile (green → teal), picked in the merged film (v2d)
const green = G.gradients.find((g) => /74, 222, 128/.test(g.bg))
G.green = green.box
await page.mouse.click(green.box[0] + green.box[2] / 2, green.box[1] + green.box[3] / 2)
await wait(800)
G.panelGradGreen = await shotPanel('panel-grad-green.png')

// close the panel and deselect, then the clean dashboard (Undo is enabled by the gradient pick)
await page.keyboard.press('Escape')
await wait(300)
await box(() => {
  const x = [...document.querySelectorAll('button')].find((b) => b.offsetParent && /close/i.test(b.getAttribute('aria-label') || '') && b.getBoundingClientRect().x > 1100)
  if (x) x.click()
})
await page.mouse.click(600, 300)
await wait(800)
await page.screenshot({ path: path.join(out, 'editor.png') })
// a template on top, then Undo: Undo stays enabled and Redo turns on
await page.mouse.click(G.cards[0][0] + 130, G.cards[0][1] + 120)
await wait(1500)
await page.mouse.click(G.buttons.Undo[0] + 16, G.buttons.Undo[1] + 16)
await wait(1000)
await page.screenshot({ path: path.join(out, 'editor-undone.png') })
writeFileSync(path.join(out, 'geometry.json'), JSON.stringify(G, null, 1))
console.log(JSON.stringify(G, null, 1))
await browser.close()
