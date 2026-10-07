// One-off: map dropdowns / gallery / popup tabs, and measure screencast fps.
import { openEditor, seek } from './editor-session.mjs'

const { browser, page } = await openEditor()
const shot = async (name) => { await new Promise((r) => setTimeout(r, 600)); await page.screenshot({ path: `shots/${name}.png` }) }
const list = async (minX = 0, maxX = 9999) => page.evaluate((a, b) => [...document.querySelectorAll('button, [role=option], [role=menuitem], li')].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.top < innerHeight && r.top > 0 && r.left >= a && r.left <= b }).map((el) => { const r = el.getBoundingClientRect(); return `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)} | ${(el.innerText || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').slice(0, 40)}` }).join('\n'), minX, maxX)

// screencast fps probe
const cdp = await page.createCDPSession()
let n = 0
cdp.on('Page.screencastFrame', async (f) => { n++; await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }) })
await page.evaluate(() => { const v = document.querySelector('video'); v.muted = true; v.loop = true; v.play() })
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: 3200, maxHeight: 1800, everyNthFrame: 1 })
await new Promise((r) => setTimeout(r, 4000))
await cdp.send('Page.stopScreencast')
console.log('screencast fps ~', (n / 4).toFixed(1))
await page.evaluate(() => document.querySelector('video').pause())
await seek(page, 3.2)

// font family dropdown
await page.mouse.click(1305 + 133, 243 + 18)
await shot('y-fontdrop')
console.log('--- font dropdown\n' + await list(1200))
await page.keyboard.press('Escape')

// floating editor sub-tabs
const word = await page.evaluate(() => { const el = [...document.querySelectorAll('span, div')].find((n) => n.children.length === 0 && /^strategy,?$/.test(n.textContent.trim()) && n.getBoundingClientRect().left > 600); const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2] })
await page.mouse.click(word[0], word[1])
await new Promise((r) => setTimeout(r, 500))
await page.mouse.click(1060 + 50, 175 + 20) // popup Style
await shot('y-pop-style')
console.log('--- popup style\n' + await list(940, 1260))
await page.mouse.click(1160 + 50, 175 + 20) // popup Animate
await shot('y-pop-animate')
console.log('--- popup animate\n' + await list(940, 1260))
await page.keyboard.press('Escape')

// left gallery: list cards + scroll container
await page.mouse.click(18 + 18, 480 + 18)
await new Promise((r) => setTimeout(r, 800))
const cards = await page.evaluate(() => [...document.querySelectorAll('*')].filter((n) => /^LC T\d+$/.test(n.textContent.trim()) && n.children.length === 0).slice(0, 12).map((n) => { const r = n.getBoundingClientRect(); return `${n.textContent.trim()} @ ${Math.round(r.left)},${Math.round(r.top)}` }))
console.log('--- gallery labels\n' + cards.join('\n'))
const sections = await page.evaluate(() => [...document.querySelectorAll('*')].filter((n) => n.children.length === 0 && /TEMPLATES|STYLE \d|LC /.test(n.textContent) && n.getBoundingClientRect().left < 380).slice(0, 20).map((n) => n.textContent.trim()))
console.log('sections', sections.join(' | '))

// timeline expand
await page.mouse.click(384 + 446, 826 + 19)
await shot('y-timeline')
await browser.close()
