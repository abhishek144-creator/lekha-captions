// Rasterises the outlined SVGs to PNG at useful sizes.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'
const here = path.dirname(fileURLToPath(import.meta.url))
const jobs = [
  ['lekha-wordmark-light.svg', 'lekha-wordmark-light-2400.png', 2400],
  ['lekha-wordmark-dark.svg', 'lekha-wordmark-dark-2400.png', 2400],
  ['lekha-wordmark-mono.svg', 'lekha-wordmark-mono-2400.png', 2400],
  ['lekha-icon.svg', 'lekha-icon-1024.png', 1024],
  ['lekha-icon.svg', 'lekha-icon-512.png', 512],
  ['lekha-icon.svg', 'lekha-icon-192.png', 192],
  ['lekha-icon.svg', 'favicon-32.png', 32],
]
const browser = await puppeteer.launch({ headless: true })
const page = await browser.newPage()
for (const [src, out, width] of jobs) {
  const svg = readFileSync(path.join(here, 'svg', src), 'utf8')
  const [, , vw, vh] = svg.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number)
  const height = Math.round((width * vh) / vw)
  await page.setViewport({ width, height })
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${width}px;height:${height}px}</style>${svg}`)
  await page.screenshot({ path: path.join(here, 'png', out), omitBackground: true })
}
await browser.close()
console.log('png exports done')
