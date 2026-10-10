const STORAGE_KEY = 'lekha.billingCurrency'
const SUPPORTED_CURRENCIES = ['USD', 'INR']
// Netlify edge function (netlify/edge-functions/visitor-country.js).
const VISITOR_COUNTRY_ENDPOINT = '/__geo'
const VISITOR_COUNTRY_TIMEOUT_MS = 2500

let visitorCurrencyRequest = null

export function detectBillingCurrency(timeZone) {
  return ['Asia/Calcutta', 'Asia/Kolkata'].includes(timeZone) ? 'INR' : 'USD'
}

export function currencyForCountry(country) {
  const code = String(country || '').toUpperCase()
  if (!/^[A-Z]{2}$/.test(code)) return null
  return code === 'IN' ? 'INR' : 'USD'
}

function getSavedBillingCurrency() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (SUPPORTED_CURRENCIES.includes(saved)) return saved
  } catch {
    // Currency selection still works when browser storage is unavailable.
  }
  return null
}

// Resolves to 'INR' / 'USD' from the visitor's IP country, or null when the
// country is unknown (local dev, endpoint down, timeout). One request per page.
export function detectVisitorBillingCurrency() {
  if (!visitorCurrencyRequest) {
    visitorCurrencyRequest = (async () => {
      if (typeof fetch !== 'function') return null
      const controller = typeof AbortController === 'function' ? new AbortController() : null
      const timer = controller ? setTimeout(() => controller.abort(), VISITOR_COUNTRY_TIMEOUT_MS) : null
      try {
        const response = await fetch(VISITOR_COUNTRY_ENDPOINT, {
          cache: 'no-store',
          credentials: 'omit',
          signal: controller?.signal,
        })
        if (!response.ok || !(response.headers.get('content-type') || '').includes('application/json')) return null
        const body = await response.json()
        return currencyForCountry(body?.country)
      } catch {
        return null
      } finally {
        if (timer) clearTimeout(timer)
      }
    })()
  }
  return visitorCurrencyRequest
}

export function resetVisitorBillingCurrencyForTests() {
  visitorCurrencyRequest = null
}

// Switches the displayed currency to the visitor's country unless they picked
// one themselves. Returns a cleanup function for useEffect.
export function followVisitorBillingCurrency(onCurrency) {
  if (getSavedBillingCurrency()) return () => {}
  let active = true
  detectVisitorBillingCurrency().then(currency => {
    if (active && currency && !getSavedBillingCurrency()) onCurrency(currency)
  })
  return () => { active = false }
}

export function getPreferredBillingCurrency() {
  const saved = getSavedBillingCurrency()
  if (saved) return saved
  try {
    return detectBillingCurrency(Intl.DateTimeFormat().resolvedOptions().timeZone)
  } catch {
    return 'USD'
  }
}

export function saveBillingCurrency(currency) {
  if (!SUPPORTED_CURRENCIES.includes(currency)) return
  try {
    window.localStorage.setItem(STORAGE_KEY, currency)
  } catch {
    // The selected currency remains active for this page.
  }
}

export function formatBillingPrice(minor, currency) {
  return currency === 'USD' ? `$${(minor / 100).toFixed(2)}` : `₹${Math.round(minor / 100)}`
}
