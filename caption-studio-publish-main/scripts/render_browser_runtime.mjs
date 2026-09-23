import fs from 'fs/promises'
import { existsSync } from 'fs'
import os from 'os'
import path from 'path'

export function findChromeExecutable() {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter(Boolean)
  return candidates.find((candidate) => existsSync(candidate))
}

export function browserLaunchOptions(viewport) {
  const runtimeEnv = String(process.env.APP_ENV || process.env.ENV || '').toLowerCase()
  const disableSandbox = process.env.PUPPETEER_DISABLE_SANDBOX === '1'
  const containerSandboxBypass = process.env.PUPPETEER_CONTAINER_NO_SANDBOX === '1'
  const ciSandboxBypass = process.env.CI === 'true'
    && process.env.PUPPETEER_CI_NO_SANDBOX === '1'
  if (disableSandbox && runtimeEnv === 'production') {
    throw new Error('PUPPETEER_DISABLE_SANDBOX is forbidden in production')
  }
  const args = ['--disable-gpu', '--disable-dev-shm-usage']
  if (disableSandbox || containerSandboxBypass || ciSandboxBypass) {
    args.push('--no-sandbox', '--disable-setuid-sandbox')
  }
  return {
    headless: true,
    executablePath: findChromeExecutable(),
    args,
    ...(viewport ? { defaultViewport: viewport } : {}),
  }
}

export function browserEndpointFile() {
  return process.env.RENDER_BROWSER_ENDPOINT_FILE
    || path.join(os.tmpdir(), 'lekha-render-browser.json')
}

export async function connectWarmBrowser(puppeteer) {
  if (process.env.RENDER_BROWSER_REUSE !== '1') return null
  try {
    const endpoint = JSON.parse(await fs.readFile(browserEndpointFile(), 'utf8'))
    const address = new URL(endpoint.wsEndpoint)
    if (address.protocol !== 'ws:' || !['127.0.0.1', 'localhost'].includes(address.hostname)) {
      return null
    }
    return await puppeteer.connect({ browserWSEndpoint: endpoint.wsEndpoint, timeout: 1500 })
  } catch (error) {
    if (process.env.RENDER_BROWSER_REQUIRE_WARM === '1') {
      throw new Error('Required warm render browser is unavailable', { cause: error })
    }
    // A missing or crashed warm browser must not block rendering.
    return null
  }
}
