// node shot.mjs <page.html> <out.png> <width> <height> [scale]
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import puppeteer from 'puppeteer'
const [file, out, w, h, scale = '1'] = process.argv.slice(2)
const browser = await puppeteer.launch({ headless: true })
const page = await browser.newPage()
await page.setViewport({ width: Number(w), height: Number(h), deviceScaleFactor: Number(scale) })
await page.goto(pathToFileURL(path.resolve(file)).href, { waitUntil: 'networkidle0' })
await page.evaluate(() => document.fonts.ready)
await page.screenshot({ path: out, omitBackground: true })
await browser.close()
