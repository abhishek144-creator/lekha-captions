// Tells the pricing UI which country the visitor is browsing from, using
// Netlify's IP geolocation. Only the two-letter country code is returned;
// nothing is stored. The client falls back to the device timezone when this
// endpoint is unavailable (local dev, preview hosts).
export default function visitorCountry(_request, context) {
  const code = String(context?.geo?.country?.code || '').toUpperCase()
  const country = /^[A-Z]{2}$/.test(code) ? code : ''
  return new Response(JSON.stringify({ country }), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'private, no-store',
    },
  })
}

export const config = { path: '/__geo' }
