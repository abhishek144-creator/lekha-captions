export const ADS_ID = 'AW-18501179190'
const LABELS = { purchase: '-qZvCMv4y7AdELauhvZE', signup: 'uV8PCM74y7AdELauhvZE' }
const KEY = 'lekha.ads-consent.v1'
const sent = new Set()
let allowed = false
let initialized = false

export function getAdsConsent() {
  try { return window.localStorage.getItem(KEY) || '' } catch { return '' }
}

function command() {
  const target = /** @type {Window & {dataLayer?: unknown[]}} */ (window)
  target.dataLayer = target.dataLayer || []
  target.dataLayer.push(arguments)
}

export function setAdsConsent(choice) {
  allowed = choice === 'granted'
  try { window.localStorage.setItem(KEY, allowed ? 'granted' : 'denied') } catch { /* Optional storage. */ }
  if (allowed) initializeGoogleAds()
  if (!allowed) {
    for (const part of document.cookie.split(';')) {
      const name = part.split('=')[0].trim()
      if (!name.startsWith('_gcl')) continue
      for (const domain of ['', window.location.hostname, '.lekhacaptions.com']) {
        document.cookie = `${name}=; Max-Age=0; path=/${domain ? `; domain=${domain}` : ''}`
      }
    }
  }
  if (initialized) command('consent', 'update', {
    ad_storage: allowed ? 'granted' : 'denied',
    ad_user_data: allowed ? 'granted' : 'denied',
    ad_personalization: 'denied',
  })
}

export function initializeGoogleAds() {
  allowed = getAdsConsent() === 'granted'
  if (!allowed || initialized) return
  initialized = true
  command('consent', 'default', { ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'denied' })
  command('js', new Date())
  command('config', ADS_ID, { allow_ad_personalization_signals: false })
  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${ADS_ID}`
  document.head.appendChild(script)
}

export function trackAdsConversion(kind, receipt = {}) {
  if (!allowed || getAdsConsent() !== 'granted' || !LABELS[kind]) return false
  const id = String(receipt.transaction_id || '')
  if (!id) return false
  if (kind === 'purchase' && (!(Number(receipt.value) > 0) || !/^(INR|USD)$/.test(receipt.currency || ''))) return false
  const key = `lekha.ads.sent.${kind}.${id}`
  try { if (window.localStorage.getItem(key)) return false } catch { /* In-memory protection remains. */ }
  if (sent.has(key)) return false
  initializeGoogleAds()
  command('event', 'conversion', {
    send_to: `${ADS_ID}/${LABELS[kind]}`,
    ...(kind === 'purchase' ? { value: Number(receipt.value), currency: receipt.currency, transaction_id: id } : {}),
  })
  sent.add(key)
  try { window.localStorage.setItem(key, '1') } catch { /* Optional storage. */ }
  return true
}

if (typeof window !== 'undefined') {
  window.addEventListener('lekha:analytics-consent', event => {
    if (/** @type {CustomEvent} */ (event).detail !== 'granted') setAdsConsent('denied')
  })
}
