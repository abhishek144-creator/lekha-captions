/**
 * Post-build prerender script.
 * Starts `vite preview`, visits each public route with headless Chrome,
 * captures the fully-rendered HTML, and writes it to dist/.
 *
 * Usage: node scripts/prerender.mjs  (called automatically by `npm run build`)
 */

import puppeteer from 'puppeteer-core'
import { spawn } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DIST = join(ROOT, 'dist')

// Routes to pre-render (public only — no dashboard/auth routes)
const ROUTES = ['/', '/Faq', '/Help', '/Terms']

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PREVIEW_PORT = 4173

// ── helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

function startPreview() {
  return new Promise((resolve, reject) => {
    const proc = spawn('npx', ['vite', 'preview', '--port', String(PREVIEW_PORT)], {
      cwd: ROOT,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let ready = false
    const onData = chunk => {
      const text = chunk.toString()
      if (!ready && text.includes(String(PREVIEW_PORT))) {
        ready = true
        resolve(proc)
      }
    }

    proc.stdout.on('data', onData)
    proc.stderr.on('data', onData)
    proc.on('error', reject)

    // Fallback: give the server 4 s to start even if we miss the log line
    setTimeout(() => {
      if (!ready) {
        ready = true
        resolve(proc)
      }
    }, 4000)
  })
}

function routeToOutputPath(route) {
  // '/'      -> dist/index.html
  // '/Faq'   -> dist/Faq/index.html
  if (route === '/') return join(DIST, 'index.html')
  const dir = join(DIST, ...route.replace(/^\//, '').split('/'))
  mkdirSync(dir, { recursive: true })
  return join(dir, 'index.html')
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n▶ Starting vite preview…')
  const server = await startPreview()
  await sleep(1500) // extra grace period

  console.log('▶ Launching Chrome…')
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  try {
    for (const route of ROUTES) {
      const url = `http://localhost:${PREVIEW_PORT}${route}`
      console.log(`  Pre-rendering ${url}`)

      const page = await browser.newPage()

      // Suppress console noise from the page
      page.on('console', () => {})
      page.on('pageerror', () => {})

      await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 })

      // Wait for Framer Motion animations to settle
      await sleep(2000)

      const html = await page.content()
      const outputPath = routeToOutputPath(route)
      writeFileSync(outputPath, html, 'utf8')
      console.log(`  ✓ Saved → ${outputPath.replace(ROOT, '.')}`)

      await page.close()
    }
  } finally {
    await browser.close()
    server.kill()
  }

  console.log('▶ Pre-rendering complete.\n')
}

main().catch(err => {
  console.error('Pre-render failed:', err.message)
  process.exit(1)
})
