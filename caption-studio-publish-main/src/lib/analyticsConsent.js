// Google Analytics (Firebase Analytics) sets cookies, so it starts only after the
// visitor accepts. The choice lives in this browser; essential storage (sign-in,
// drafts) and first-party telemetry do not depend on it.
const CONSENT_STORAGE_KEY = 'lekha.analytics-consent.v1'
export const ANALYTICS_CONSENT_EVENT = 'lekha:analytics-consent'

// 'granted', 'denied', or '' when the visitor has not chosen yet.
export function getAnalyticsConsent() {
  try {
    const value = window.localStorage.getItem(CONSENT_STORAGE_KEY)
    return value === 'granted' || value === 'denied' ? value : ''
  } catch {
    return ''
  }
}

export function setAnalyticsConsent(value) {
  const choice = value === 'granted' || value === 'denied' ? value : ''
  try {
    if (choice) window.localStorage.setItem(CONSENT_STORAGE_KEY, choice)
    else window.localStorage.removeItem(CONSENT_STORAGE_KEY)
  } catch {
    // Storage blocked: the choice still applies to this page view.
  }
  if (choice === 'denied') clearAnalyticsCookies()
  window.dispatchEvent(new CustomEvent(ANALYTICS_CONSENT_EVENT, { detail: choice }))
}

// Removes cookies Google Analytics set before the visitor rejected it.
function clearAnalyticsCookies() {
  const host = window.location.hostname
  const domains = ['', host, `.${host}`, `.${host.split('.').slice(-2).join('.')}`]
  for (const cookie of document.cookie.split(';')) {
    const name = cookie.split('=')[0].trim()
    if (!name.startsWith('_ga')) continue
    for (const domain of domains) {
      document.cookie = `${name}=; Max-Age=0; path=/${domain ? `; domain=${domain}` : ''}`
    }
  }
}

// Reopens the banner so the visitor can change an earlier choice.
export function reopenAnalyticsConsent() {
  setAnalyticsConsent('')
}

export function onAnalyticsConsentChange(listener) {
  const handle = (event) => listener(event.detail || '')
  window.addEventListener(ANALYTICS_CONSENT_EVENT, handle)
  return () => window.removeEventListener(ANALYTICS_CONSENT_EVENT, handle)
}
