#!/usr/bin/env node
import { execFileSync } from 'node:child_process'

const args = new Map(
  process.argv.slice(2)
    .filter((arg) => arg.startsWith('--'))
    .map((arg) => {
      const [key, ...value] = arg.replace(/^--/, '').split('=')
      return [key, value.join('=')]
    }),
)

const apiOrigin = String(args.get('api') || process.env.DEPLOY_VERIFY_API_URL || 'https://api.lekhacaptions.com').replace(/\/+$/, '')
const frontendOrigin = String(args.get('frontend') || process.env.DEPLOY_VERIFY_FRONTEND_URL || 'https://app.lekhacaptions.com').replace(/\/+$/, '')
const timeoutMs = Number(process.env.DEPLOY_VERIFY_TIMEOUT_MS || 15_000)

function currentCommit() {
  return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
}

async function get(url, responseType = 'json') {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { redirect: 'follow', signal: controller.signal })
    if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`)
    if (responseType === 'text') {
      return { body: await response.text(), finalUrl: response.url }
    }
    return response.json()
  } finally {
    clearTimeout(timer)
  }
}

const expected = String(args.get('expected') || process.env.DEPLOY_VERIFY_EXPECTED_RELEASE || currentCommit()).trim()
if (!/^[a-f0-9]{40}$/i.test(expected)) {
  throw new Error(`Expected release must be a full 40-character Git SHA; received ${expected || 'empty'}`)
}

const [version, readiness, frontendResponse, editorResponse] = await Promise.all([
  get(`${apiOrigin}/api/version`),
  get(`${apiOrigin}/api/health/readiness`),
  get(`${frontendOrigin}/`, 'text'),
  get(`${frontendOrigin}/Dashboard?entry=editor`, 'text'),
])

const frontendHtml = frontendResponse.body
const frontendRelease = frontendHtml.match(/<meta\s+name=["']lekha-release["']\s+content=["']([^"']+)["']/i)?.[1]
  || frontendHtml.match(/<meta\s+content=["']([^"']+)["']\s+name=["']lekha-release["']/i)?.[1]
  || ''
const backendRelease = String(version?.release || '')

const failures = []
if (readiness?.ready !== true) failures.push('backend readiness does not report ready:true')
if (new URL(frontendResponse.finalUrl).origin !== frontendOrigin) {
  failures.push(`frontend origin redirected to ${new URL(frontendResponse.finalUrl).origin}`)
}
if (new URL(editorResponse.finalUrl).origin !== frontendOrigin) {
  failures.push(`editor route redirected to ${new URL(editorResponse.finalUrl).origin}`)
}
if (backendRelease !== expected) failures.push(`backend release mismatch: expected ${expected}, received ${backendRelease || 'missing'}`)
if (frontendRelease !== expected) failures.push(`frontend release mismatch: expected ${expected}, received ${frontendRelease || 'missing'}`)

if (failures.length) {
  console.error('Deployed release verification FAILED:')
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exitCode = 1
} else {
  console.log(`Deployed release verified: ${expected}`)
  console.log(`  frontend: ${frontendOrigin}`)
  console.log(`  api:      ${apiOrigin}`)
}
