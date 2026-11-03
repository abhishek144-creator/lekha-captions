import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Keep both identity-provider and API traffic inside this test process.
vi.mock('@/lib/firebaseLoader', () => ({
  loadFirebase: vi.fn(async () => ({ getFirebaseAppCheckToken: async () => null })),
}))

const signupDestination = 'AW-18501179190/uV8PCM74y7AdELauhvZE'
const conversionEvents = () => window.dataLayer
  .map(entry => Array.from(entry))
  .filter(entry => entry[0] === 'event' && entry[1] === 'conversion')

beforeEach(() => {
  vi.resetModules()
  localStorage.clear()
  document.head.innerHTML = ''
  window.dataLayer = []
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => vi.unstubAllGlobals())

function respondWith(data, status = 200) {
  fetch.mockResolvedValueOnce(new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json' },
  }))
}

async function setup(consent = 'granted') {
  const ads = await import('../googleAds')
  if (consent) ads.setAdsConsent(consent)
  const { apiRequest } = await import('../apiClient')
  return { ads, bootstrap: () => apiRequest('/api/account-bootstrap', { method: 'POST' }) }
}

describe('Signup conversion through account-bootstrap API responses', () => {
  it('queues the correct signup label once for a confirmed new account', async () => {
    const { bootstrap } = await setup()
    respondWith({ success: true, account_created: true, user: { uid: 'test-new-user' } })
    await bootstrap()
    expect(conversionEvents()).toEqual([['event', 'conversion', { send_to: signupDestination }]])
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('does not turn an existing-account login into a new signup', async () => {
    const { bootstrap } = await setup()
    respondWith({ success: true, account_created: false, user: { uid: 'test-existing-user' } })
    await bootstrap()
    expect(conversionEvents()).toEqual([])
  })

  it('deduplicates concurrent new-account responses and a later login', async () => {
    const { bootstrap } = await setup()
    for (const created of [true, true, false]) {
      respondWith({ success: true, account_created: created, user: { uid: 'test-new-user' } })
    }
    await Promise.all([bootstrap(), bootstrap()])
    await bootstrap()
    expect(conversionEvents()).toHaveLength(1)
  })

  it('retains duplicate protection after the tracking module restarts', async () => {
    let client = await setup()
    respondWith({ account_created: true, user: { uid: 'test-new-user' } })
    await client.bootstrap()
    vi.resetModules()
    window.dataLayer = []
    client = await setup()
    respondWith({ account_created: true, user: { uid: 'test-new-user' } })
    await client.bootstrap()
    expect(conversionEvents()).toEqual([])
  })

  it.each([null, 'denied'])('sends no signup event with consent %s', async consent => {
    const { bootstrap } = await setup(consent)
    respondWith({ account_created: true, user: { uid: 'test-new-user' } })
    await bootstrap()
    expect(conversionEvents()).toEqual([])
    expect(document.querySelector('script')).toBeNull()
    expect(localStorage.getItem('lekha.ads.sent.signup.test-new-user')).toBeNull()
  })

  it('does not report a signup after consent is withdrawn', async () => {
    const { ads, bootstrap } = await setup()
    ads.setAdsConsent('denied')
    respondWith({ account_created: true, user: { uid: 'test-new-user' } })
    await bootstrap()
    expect(conversionEvents()).toEqual([])
  })

  it.each([
    { user: { uid: 'test-user' } },
    { account_created: 'true', user: { uid: 'test-user' } },
    { account_created: true, user: {} },
  ])('requires an explicit creation flag and a user identifier: %j', async response => {
    const { bootstrap } = await setup()
    respondWith(response)
    await bootstrap()
    expect(conversionEvents()).toEqual([])
  })
})
