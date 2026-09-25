import fs from 'fs/promises'
import http from 'http'
import path from 'path'
import { fileURLToPath } from 'url'
import puppeteer from 'puppeteer'

const endpointPath = process.argv[2]
if (!endpointPath) throw new Error('Missing browser endpoint path')

const browserArgs = ['--disable-gpu', '--disable-dev-shm-usage']
if (process.env.PUPPETEER_CONTAINER_NO_SANDBOX === '1') {
  browserArgs.push('--no-sandbox', '--disable-setuid-sandbox')
}

const browser = await puppeteer.launch({
  headless: true,
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  args: browserArgs,
})

const fontsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'fonts')
const fontServer = http.createServer(async (request, response) => {
  try {
    const requested = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).replace(/^\/+/, '')
    const candidate = path.resolve(fontsRoot, requested)
    if (!candidate.startsWith(`${fontsRoot}${path.sep}`)) {
      response.writeHead(403).end()
      return
    }
    const contents = await fs.readFile(candidate)
    response.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=86400, immutable',
      'Content-Type': candidate.endsWith('.css') ? 'text/css; charset=utf-8' : 'font/ttf',
    })
    response.end(contents)
  } catch {
    response.writeHead(404).end()
  }
})
await new Promise((resolve) => fontServer.listen(0, '127.0.0.1', resolve))
const fontAddress = fontServer.address()
const fontBaseUrl = `http://127.0.0.1:${fontAddress.port}`

await fs.mkdir(path.dirname(endpointPath), { recursive: true })
const temporaryPath = `${endpointPath}.${process.pid}.tmp`
await fs.writeFile(temporaryPath, JSON.stringify({
  browserWSEndpoint: browser.wsEndpoint(),
  fontBaseUrl,
  pid: process.pid,
  startedAt: new Date().toISOString(),
}), 'utf8')
await fs.rename(temporaryPath, endpointPath)

let closing = false
async function shutdown() {
  if (closing) return
  closing = true
  await fs.rm(endpointPath, { force: true }).catch(() => {})
  await new Promise((resolve) => fontServer.close(resolve))
  await browser.close().catch(() => {})
}

process.on('SIGINT', () => { shutdown().finally(() => process.exit(0)) })
process.on('SIGTERM', () => { shutdown().finally(() => process.exit(0)) })
browser.on('disconnected', () => {
  if (!closing) shutdown().finally(() => process.exit(1))
})

await new Promise(() => {})
