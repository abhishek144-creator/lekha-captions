const frontendSentryDsn = String(
  globalThis.__LEKHA_RUNTIME_CONFIG__?.sentryDsn || import.meta.env.VITE_SENTRY_DSN || '',
).trim()
const sentrySdkUrl = 'https://browser.sentry-cdn.com/10.74.0/bundle.min.js'
const sentrySdkIntegrity = 'sha384-ekhFYbUiD5vrs1pT5Kty50wAgPsq9eoEDo+hUVl7VahsXkikMcPAq0W0HCoTjGTY'

let sentryClientPromise = null
let sentryInitialized = false

function reportFirstParty(error, componentStack, reference) {
  const apiBase = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
  const payload = JSON.stringify({
    event: 'frontend.exception',
    payload: {
      name: String(error?.name || 'Error').slice(0, 80),
      message: String(error?.message || 'Frontend exception').slice(0, 500),
      componentStack: String(componentStack || '').slice(0, 2000),
      crashReference: String(reference || '').slice(0, 128),
      release: String(import.meta.env.VITE_APP_RELEASE || '').slice(0, 40),
      path: String(globalThis.location?.pathname || '').slice(0, 300),
    },
  })
  fetch(`${apiBase}/api/analytics/track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
    keepalive: true,
  }).catch(() => {})
}

function initializeSentryClient() {
  const Sentry = window.Sentry
  if (!Sentry?.init || !Sentry?.captureException) return null
  if (!sentryInitialized) {
    Sentry.init({
      dsn: frontendSentryDsn,
      environment: import.meta.env.MODE,
      release: String(import.meta.env.VITE_APP_RELEASE || '').trim() || undefined,
      sendDefaultPii: false,
      tracesSampleRate: 0,
    })
    sentryInitialized = true
  }
  return Sentry
}

function loadSentryClient() {
  if (!frontendSentryDsn) return Promise.resolve(null)
  if (!sentryClientPromise) {
    sentryClientPromise = new Promise((resolve) => {
      const readyClient = initializeSentryClient()
      if (readyClient) {
        resolve(readyClient)
        return
      }
      const script = document.createElement('script')
      script.src = sentrySdkUrl
      script.integrity = sentrySdkIntegrity
      script.crossOrigin = 'anonymous'
      script.async = true
      script.addEventListener('load', () => resolve(initializeSentryClient()), { once: true })
      script.addEventListener('error', () => {
        console.warn('Frontend error monitoring could not start.')
        resolve(null)
      }, { once: true })
      document.head.appendChild(script)
    })
  }
  return sentryClientPromise
}

export function initializeFrontendMonitoring() {
  void loadSentryClient()
}

export function captureFrontendException(error, { componentStack = '', reference = '' } = {}) {
  reportFirstParty(error, componentStack, reference)
  void loadSentryClient().then((Sentry) => {
    Sentry?.captureException(error, {
      tags: { crash_reference: reference },
      extra: { componentStack, crashReference: reference },
    })
  })
}
