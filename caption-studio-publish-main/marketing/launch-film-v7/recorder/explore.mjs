// Maps the current editor before scripting takes: full screenshot + positions of the controls the
// takes click.   node explore.mjs [out-dir]
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { openEditor, seek } from './session.mjs'

const out = path.resolve(process.argv[2] || 'explore')
mkdirSync(out, { recursive: true })
const { browser, page } = await openEditor()
await seek(page, 3.2)
await new Promise((r) => setTimeout(r, 1200))
await page.screenshot({ path: path.join(out, 'editor.png') })

const map = await page.evaluate(() => {
  const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map(Math.round) }
  const leaves = (re) => [...document.querySelectorAll('body *')].filter((n) => n.children.length === 0 && re.test(n.textContent.trim()) && n.getBoundingClientRect().width > 0)
  return {
    video: box(document.querySelector('video')),
    buttons: [...document.querySelectorAll('button')].filter((b) => b.getBoundingClientRect().width > 0)
      .map((b) => ({ t: (b.innerText || b.getAttribute('aria-label') || b.title || '').trim().slice(0, 40), r: box(b) })),
    strategy: leaves(/^strategy,?$/).map(box),
    textareas: [...document.querySelectorAll('textarea, input[type=text], [contenteditable=true]')].filter((n) => n.getBoundingClientRect().width > 0).map((n) => ({ v: (n.value || n.textContent || '').slice(0, 50), r: box(n) })),
    toasts: leaves(/./).filter((n) => /error|failed|offline|unavailable|sign in/i.test(n.textContent)).map((n) => n.textContent.trim().slice(0, 80)),
  }
})
writeFileSync(path.join(out, 'map.json'), JSON.stringify(map, null, 1))
console.log(JSON.stringify({ video: map.video, strategy: map.strategy, textareas: map.textareas, toasts: map.toasts }))
console.log(map.buttons.map((b) => `${b.t || '?'}@${b.r.join(',')}`).join(' | '))
await browser.close()
