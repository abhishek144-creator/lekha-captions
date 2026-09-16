const frontendSentryDsn = String(import.meta.env.VITE_SENTRY_DSN || '').trim()
const sentrySdkUrl = 'https://browser.sentry-cdn.com/10.74.0/bundle.min.js'
const sentrySdkIntegrity = 'sha384-ekhFYbUiD5vrs1pT5Kty50wAgPsq9eoEDo+hUVl7VahsXkikMcPAq0W0HCoTjGTY'

let sentryClientPromise = null
let sentryInitialized = false

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
  void loadSentryClient().then((Sentry) => {
    Sentry?.captureException(error, {
      tags: { crash_reference: reference },
      extra: { componentStack, crashReference: reference },
    })
  })
}
