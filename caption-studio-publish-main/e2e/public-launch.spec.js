import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.route(/https:\/\/(?:[^/]+\.)?(?:google\.com|gstatic\.com|firebaseapp\.com|googleapis\.com|googletagmanager\.com)\//, route => route.abort())
  await page.route(/\/api\/analytics\//, route => route.abort())
})

const publicRoutes = [
  ['home', '/', /Lekha Captions/i],
  ['faq', '/Faq', /frequently asked|questions/i],
  ['support', '/HelpAndSupport', /help|support/i],
  ['terms', '/TermsAndConditions', /terms/i],
  ['privacy', '/PrivacyPolicy', /privacy/i],
  ['refunds', '/RefundPolicy', /refund/i],
  ['acceptable use', '/AcceptableUsePolicy', /acceptable use/i],
  ['known limitations', '/KnownLimitations', /known limitations/i],
  ['changelog', '/Changelog', /release notes|what changed/i],
  ['status', '/status', /live service checks/i],
  ['login', '/Login', /sign up with google|log in/i],
]

for (const [name, path, visibleCopy] of publicRoutes) {
  test(`${name} renders without serious accessibility or overflow failures`, async ({ page }) => {
    const pageErrors = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    // Public rendering and accessibility must not depend on Google/Firebase
    // attestation or identity endpoints being reachable from the CI runner.
    await page.route(
      /https:\/\/(?:[^/]+\.)?(?:google\.com|gstatic\.com|firebaseapp\.com|googleapis\.com|securetoken\.googleapis\.com)\//,
      (route) => route.abort(),
    )
    // Status presentation is tested with deterministic health responses; no
    // browser matrix should poll or wake production services.
    await page.route('**/api/health', route => route.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: { success: true, ready: true } }))
    await page.route('**/api/health/readiness', route => route.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: { success: true, ready: true } }))
    await page.route('**/api/service-status', route => route.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: { success: true, controls: {} } }))

    // Analytics, media previews, and font requests can keep WebKit's network
    // busy after the page is already interactive. Assert the rendered UI
    // instead of treating a quiet network as the readiness signal.
    const response = await page.goto(path, { waitUntil: 'domcontentloaded' })
    expect(response?.status()).toBe(200)
    await expect(page.locator('body')).toContainText(visibleCopy)
    await expect(page.locator('main')).toBeVisible()

    const overflow = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }))
    expect(overflow.content).toBeLessThanOrEqual(overflow.viewport + 2)

    const accessibility = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    const blockingViolations = accessibility.violations
      .filter((violation) => violation.impact === 'critical' || violation.impact === 'serious')
      .flatMap((violation) => violation.nodes.map((node) => (
        `${violation.id}: ${node.target.join(' ')} — ${node.any[0]?.message || node.failureSummary}`
      )))
    expect(blockingViolations).toEqual([])
    expect(pageErrors).toEqual([])
  })
}

test('public aliases retain query and hash and expose one canonical URL', async ({ page }) => {
  await page.goto('/Faq/?from=review#templates', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/faq\?from=review#templates$/)
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://lekhacaptions.com/faq')
  await expect(page.locator('main')).toBeVisible()
})

test('status distinguishes service readiness from a blocked check', async ({ page }) => {
  await page.route('**/api/health', route => route.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: { success: true, ready: true } }))
  await page.route('**/api/health/readiness', route => route.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: { success: true, ready: false } }))
  await page.route('**/api/service-status', route => route.fulfill({ headers: { 'access-control-allow-origin': '*' }, status: 403, json: { detail: 'Check access refused' } }))
  await page.goto('/status', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-service-check="API availability"]')).toContainText('Operational')
  await expect(page.locator('[data-service-check="Processing readiness"]')).toContainText('Limited availability')
  await expect(page.locator('[data-service-check="Customer service controls"]')).toContainText('Could not verify')
  await expect(page.locator('[data-service-check="Customer service controls"]')).toContainText('HTTP 403')
})

test('production build exposes its release identity', async ({ page }) => {
  await page.goto('/')
  const release = await page.locator('meta[name="lekha-release"]').getAttribute('content')
  expect(release).toMatch(/^[a-f0-9]{40}$/i)
})


test('public support content remains available while authentication is unavailable', async ({ page }) => {
  const attestationRequests = []
  page.on('request', (request) => {
    if (/\/recaptcha\//.test(request.url())) attestationRequests.push(request.url())
  })
  await page.route(/https:\/\/(?:[^/]+\.)?(?:firebaseapp\.com|identitytoolkit\.googleapis\.com|securetoken\.googleapis\.com)\//, () => {})
  await page.goto('/Changelog', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('body')).toContainText(/release notes|what changed/i)
  await expect(page.locator('main')).toBeVisible()
  expect(attestationRequests).toEqual([])
})

for (const storage of ['localStorage', 'sessionStorage', 'quota']) {
  test(`homepage remains usable with ${storage} unavailable`, async ({ page }) => {
    await page.addInitScript((kind) => {
      if (kind === 'quota') {
        Storage.prototype.setItem = () => { throw new DOMException('Storage quota reached', 'QuotaExceededError') }
      } else {
        Object.defineProperty(window, kind, { get() { throw new DOMException('Storage blocked', 'SecurityError') } })
      }
    }, storage)
    await page.route(/https:\/\/(?:[^/]+\.)?(?:google\.com|gstatic\.com|firebaseapp\.com|googleapis\.com)\//, route => route.abort())
    await page.route(/\/api\/analytics\//, route => route.abort())
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('main')).toBeVisible()
    await expect(page.getByText('Something went wrong in the application.')).toHaveCount(0)
    await page.getByRole('button', { name: 'Switch to light mode' }).first().click()
    await expect(page.locator('.landing-page')).toHaveAttribute('data-theme', 'light')
  })
}
