import fs from 'node:fs/promises'

const outputPath = new URL('../dist/runtime-config.js', import.meta.url)
const config = {
  // Firebase Hosting rewrites /api requests to the regional Cloud Run service.
  apiBaseUrl: '',
  sentryDsn: String(process.env.SENTRY_DSN || '').trim(),
}

await fs.writeFile(
  outputPath,
  `window.__LEKHA_RUNTIME_CONFIG__ = Object.freeze(${JSON.stringify(config)})\n`,
  'utf8',
)
