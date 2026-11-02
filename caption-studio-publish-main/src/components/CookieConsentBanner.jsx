import { useEffect, useState } from 'react'
import { getAdsConsent, setAdsConsent } from '@/lib/googleAds'
import { Link } from 'react-router-dom'
import { getAnalyticsConsent, onAnalyticsConsentChange, setAnalyticsConsent } from '@/lib/analyticsConsent'

// Asks once before Google Analytics may set cookies. Reject and Accept carry equal weight.
export default function CookieConsentBanner() {
  const [choice, setChoice] = useState(() => getAnalyticsConsent())

  useEffect(() => onAnalyticsConsentChange(setChoice), [])

  if (choice && getAdsConsent()) return null

  return (
    // A labelled region, not a dialog: the page stays usable while it shows.
    <section
      aria-live="polite"
      aria-labelledby="cookie-consent-title"
      className="fixed inset-x-4 bottom-4 z-[1000] mx-auto max-w-md rounded-2xl border border-white/10 bg-[#161616]/95 p-5 text-white shadow-2xl backdrop-blur sm:left-6 sm:right-auto sm:mx-0"
    >
      <h2 id="cookie-consent-title" className="text-sm font-semibold">Optional measurement cookies</h2>
      <p className="mt-2 text-sm leading-relaxed text-gray-300">
        With your permission, Google Analytics measures site use and Google Ads measures sign-ups and purchases from ads. These optional cookies stay off until you accept. We do not enable personalized advertising.
        {' '}<Link to="/PrivacyPolicy" className="text-[#F5A623] underline underline-offset-2">Privacy Policy</Link>
      </p>
      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={() => { setAdsConsent('denied'); setAnalyticsConsent('denied') }}
          className="flex-1 rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
        >
          Reject
        </button>
        <button
          type="button"
          onClick={() => { setAdsConsent('granted'); setAnalyticsConsent('granted') }}
          className="flex-1 rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
        >
          Accept
        </button>
      </div>
    </section>
  )
}
