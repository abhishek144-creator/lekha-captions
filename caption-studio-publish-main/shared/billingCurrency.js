const STORAGE_KEY = 'lekha.billingCurrency'
const SUPPORTED_CURRENCIES = ['USD', 'INR']

export function detectBillingCurrency(timeZone) {
  return ['Asia/Calcutta', 'Asia/Kolkata'].includes(timeZone) ? 'INR' : 'USD'
}

export function getPreferredBillingCurrency() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (SUPPORTED_CURRENCIES.includes(saved)) return saved
  } catch {
    // Currency selection still works when browser storage is unavailable.
  }
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
