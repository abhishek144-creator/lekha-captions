import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

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
  ['login', '/Login', /sign up with google|log in/i],
]

for (const [name, path, visibleCopy] of publicRoutes) {
  test(`${name} renders without serious accessibility or overflow failures`, async ({ page }) => {
    const pageErrors = []
    page.on('pageerror', (error) => pageErrors.push(error.message))

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

test('production build exposes its release identity', async ({ page }) => {
  await page.goto('/')
  const release = await page.locator('meta[name="lekha-release"]').getAttribute('content')
  expect(release).toMatch(/^[a-f0-9]{40}$/i)
})
