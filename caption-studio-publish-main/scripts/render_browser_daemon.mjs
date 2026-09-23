import fs from 'fs/promises'
import puppeteer from 'puppeteer'
import { browserEndpointFile, browserLaunchOptions } from './render_browser_runtime.mjs'

const endpointFile = browserEndpointFile()
let browser
let stopping = false

async function stop() {
  if (stopping) return
  stopping = true
  try {
    await fs.unlink(endpointFile)
  } catch {}
  try {
    await browser?.close()
  } catch {}
  process.exit(0)
}

process.on('SIGINT', stop)
process.on('SIGTERM', stop)

try {
  browser = await puppeteer.launch(browserLaunchOptions())
  browser.on('disconnected', () => {
    if (!stopping) process.exit(1)
  })
  const temporaryFile = `${endpointFile}.${process.pid}.tmp`
  await fs.writeFile(temporaryFile, JSON.stringify({
    pid: process.pid,
    wsEndpoint: browser.wsEndpoint(),
  }), { mode: 0o600 })
  await fs.rename(temporaryFile, endpointFile)
  process.stdout.write('Warm render browser ready\n')
} catch (error) {
  console.error('Warm render browser failed:', error?.message || error)
  process.exit(1)
}
