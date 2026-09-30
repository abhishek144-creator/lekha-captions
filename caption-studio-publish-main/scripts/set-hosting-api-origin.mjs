// Point the Firebase Hosting Content-Security-Policy at the API the frontend
// was built for. Run after `npm run build`, before `firebase deploy`, in the
// build workspace only (the committed firebase.json keeps the default origin).
//
// Why: Cloud Run can't map a custom domain in asia-south1, so the API is served
// from its *.run.app URL. The CSP's connect-src only allows the default API
// origin, which would make the browser block every API call.
//
// Usage: node scripts/set-hosting-api-origin.mjs <api base url> [firebase.json]
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'

const DEFAULT_API_ORIGIN = 'https://api.lekhacaptions.com'

export function apiOriginFrom(value) {
  let url
  try {
    url = new URL(String(value || '').trim())
  } catch {
    throw new Error(`API base URL is not a valid URL: ${JSON.stringify(value)}`)
  }
  if (url.protocol !== 'https:') throw new Error('API base URL must use https')
  if (!url.hostname.includes('.') || /[*\s;'"]/.test(url.host)) {
    throw new Error(`API base URL has an unusable host: ${url.host}`)
  }
  return url.origin
}

export function withApiOrigin(firebaseConfig, apiOrigin) {
  let replaced = 0
  const headers = firebaseConfig?.hosting?.headers || []
  for (const rule of headers) {
    for (const header of rule.headers || []) {
      if (header.key !== 'Content-Security-Policy') continue
      const directives = header.value.split(';').map((part) => part.trim())
      header.value = directives.map((directive) => {
        if (!directive.startsWith('connect-src ')) return directive
        const sources = directive.split(/\s+/).slice(1).filter((source) => source !== DEFAULT_API_ORIGIN)
        replaced += 1
        return ['connect-src', ...new Set([...sources, apiOrigin])].join(' ')
      }).join('; ')
    }
  }
  if (!replaced) throw new Error('firebase.json has no Content-Security-Policy connect-src to update')
  return firebaseConfig
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [apiBaseUrl, configPath = 'firebase.json'] = process.argv.slice(2)
  const apiOrigin = apiOriginFrom(apiBaseUrl)
  const config = withApiOrigin(JSON.parse(fs.readFileSync(configPath, 'utf8')), apiOrigin)
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`)
  console.log(`Hosting CSP connect-src now allows ${apiOrigin}`)
}
