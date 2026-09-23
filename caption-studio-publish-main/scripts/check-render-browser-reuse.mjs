import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import puppeteer from 'puppeteer'
import { connectWarmBrowser } from './render_browser_runtime.mjs'

const execFileAsync = promisify(execFile)

const endpointFile = path.join(os.tmpdir(), `lekha-render-browser-test-${process.pid}.json`)
const environment = {
  ...process.env,
  RENDER_BROWSER_REUSE: '1',
  RENDER_BROWSER_REQUIRE_WARM: '1',
  RENDER_BROWSER_ENDPOINT_FILE: endpointFile,
}
process.env.RENDER_BROWSER_REUSE = '1'
process.env.RENDER_BROWSER_ENDPOINT_FILE = endpointFile
const daemon = spawn(process.execPath, ['scripts/render_browser_daemon.mjs'], {
  cwd: path.resolve(import.meta.dirname, '..'),
  env: environment,
  stdio: ['ignore', 'pipe', 'pipe'],
})
let daemonError = ''
daemon.stderr.on('data', (data) => { daemonError += data.toString() })

try {
  let endpoint
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (daemon.exitCode !== null) throw new Error(`Browser daemon exited: ${daemonError}`)
    try {
      endpoint = JSON.parse(await fs.readFile(endpointFile, 'utf8'))
      break
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }
  assert.ok(endpoint?.wsEndpoint, `Browser daemon did not start: ${daemonError}`)
  const first = await connectWarmBrowser(puppeteer)
  assert.ok(first)
  const firstContext = await first.createBrowserContext()
  await firstContext.setCookie({ name: 'job', value: 'first', domain: 'example.com' })
  assert.equal((await firstContext.cookies()).length, 1)
  await firstContext.close()
  first.disconnect()

  const second = await connectWarmBrowser(puppeteer)
  assert.ok(second)
  const secondContext = await second.createBrowserContext()
  assert.deepEqual(await secondContext.cookies(), [])
  await secondContext.close()
  second.disconnect()
  assert.equal(JSON.parse(await fs.readFile(endpointFile, 'utf8')).pid, endpoint.pid)
  const outputDir = path.join(os.tmpdir(), `lekha-render-reuse-frames-${process.pid}`)
  if (path.dirname(path.resolve(outputDir)) !== path.resolve(os.tmpdir())) {
    throw new Error('Refusing to remove a render test directory outside the temporary directory')
  }
  await fs.mkdir(outputDir, { recursive: true })
  try {
    const payloadPath = path.join(outputDir, 'payload.json')
    await fs.writeFile(payloadPath, JSON.stringify({
      video_width: 360,
      video_height: 640,
      duration: 1,
      output_dir: outputDir,
      style: { font_family: 'Inter', font_size: 36, position_y: 75 },
      captions: [{ id: 'warm-browser-caption', text: 'Warm browser', start_time: 0, end_time: 1 }],
    }))
    await execFileAsync(process.execPath, ['scripts/render_template_overlay.mjs', payloadPath], {
      cwd: path.resolve(import.meta.dirname, '..'),
      env: environment,
      timeout: 60000,
    })
    const frames = (await fs.readdir(outputDir)).filter((name) => /^frame-\d+\.png$/.test(name))
    assert.ok(frames.length, 'Renderer did not produce a frame through the warm browser')
    assert.equal(JSON.parse(await fs.readFile(endpointFile, 'utf8')).pid, endpoint.pid)
  } finally {
    await fs.rm(outputDir, { recursive: true, force: true })
  }
  process.stdout.write('Warm browser reused with isolated render contexts.\n')
} finally {
  daemon.kill()
  await fs.rm(endpointFile, { force: true })
}
