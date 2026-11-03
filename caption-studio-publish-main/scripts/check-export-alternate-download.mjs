import assert from 'node:assert/strict'
import http from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import puppeteer from 'puppeteer'

// Local synthetic bytes only: reproduce Chrome receiving some bytes and then
// waiting indefinitely, while a second route serves the same finished export.
const bytes = Buffer.alloc(256 * 1024, 43)
const moduleSource = await fs.readFile('src/components/dashboard/exportDelivery.js', 'utf8')
let stalledRequests = 0
let alternateRequests = 0
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost')
  if (url.pathname === '/exportDelivery.js') {
    res.writeHead(200, { 'Content-Type': 'text/javascript' }).end(moduleSource)
  } else if (url.pathname === '/direct') {
    stalledRequests++
    res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': bytes.length,
      'Content-Disposition': 'attachment; filename="clip.mp4"' })
    res.write(bytes.subarray(0, 4096)) // Deliberately never finish this response.
  } else if (url.pathname === '/api/media/export/clip.mp4' && url.searchParams.get('delivery') === 'alternate') {
    assert.equal(url.searchParams.get('token'), 'local-fixture')
    alternateRequests++
    res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': bytes.length,
      'Content-Disposition': 'attachment; filename="clip.mp4"' }).end(bytes)
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html' }).end(`<button id="direct">Direct</button><button id="alternate">Alternate</button>
      <script type="module">
      import { startExportDownload, alternateExportDownloadUrl } from '/exportDelivery.js'
      document.querySelector('#direct').onclick = () => startExportDownload('/direct', 'clip.mp4')
      document.querySelector('#alternate').onclick = () => startExportDownload(alternateExportDownloadUrl('/api/media/export/clip.mp4?token=local-fixture', document.baseURI), 'clip.mp4')
      window.ready = true
      </script>`)
  }
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
let browser
try {
  const folder = path.resolve('test-artifacts/alternate-download')
  await fs.mkdir(folder, { recursive: true })
  const downloadPath = await fs.mkdtemp(path.join(folder, 'run-'))
  browser = await puppeteer.launch({ headless: true, args: process.env.CI ? ['--no-sandbox'] : [] })
  const cdp = await browser.target().createCDPSession()
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allowAndName', downloadPath, eventsEnabled: true })
  const progress = new Map()
  const beginnings = []
  cdp.on('Browser.downloadWillBegin', event => beginnings.push(event))
  cdp.on('Browser.downloadProgress', event => progress.set(event.guid, event))
  const page = await browser.newPage()
  await page.goto(`http://127.0.0.1:${server.address().port}`)
  await page.waitForFunction(() => window.ready)
  async function waitFor(predicate) {
    const end = Date.now() + 15000
    while (!predicate()) {
      assert.ok(Date.now() < end, 'Chrome download event timed out')
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }
  await page.click('#direct')
  await waitFor(() => beginnings.length === 1 && progress.get(beginnings[0].guid)?.receivedBytes > 0)
  assert.equal(progress.get(beginnings[0].guid).state, 'inProgress')
  await page.click('#alternate')
  await waitFor(() => beginnings.length === 2 && progress.get(beginnings[1].guid)?.state === 'completed')
  assert.deepEqual(await fs.readFile(path.join(downloadPath, beginnings[1].guid)), bytes)
  assert.equal(stalledRequests, 1)
  assert.equal(alternateRequests, 1)
  await cdp.send('Browser.cancelDownload', { guid: beginnings[0].guid })
  console.log('Chrome download recovery passed: stalled partial direct transfer, alternate completes with identical bytes and no render request.')
} finally {
  await browser?.close()
  server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
}
