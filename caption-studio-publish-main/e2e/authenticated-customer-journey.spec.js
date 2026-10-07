import { expect, test } from '@playwright/test'

const authStorage = process.env.PLAYWRIGHT_AUTH_STORAGE || ''
const mediaFixture = process.env.PLAYWRIGHT_AUTH_MEDIA || ''
const paymentJourneyEnabled = process.env.PLAYWRIGHT_PAYMENT_JOURNEY === '1'

test.describe('authenticated customer journey', () => {
  test.use({ storageState: authStorage || { cookies: [], origins: [] } })
  test.skip(!authStorage, 'Set PLAYWRIGHT_AUTH_STORAGE to a Firebase-authenticated Playwright storage state.')

  test('customer can download a complete portable account export', async ({ page }) => {
    await page.goto('/UserAccount', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Manage Account')).toBeVisible()
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: /Download My Data/i }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/^lekha-account-export-\d{4}-\d{2}-\d{2}\.json$/)
  })

  test('upload, caption correction, shortcut, and subtitle download work', async ({ page }) => {
    test.skip(!mediaFixture, 'Set PLAYWRIGHT_AUTH_MEDIA to a small unique MP4/MOV/WebM fixture.')
    await page.goto('/Dashboard?entry=editor', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: /Upload Video/i }).click()
    await page.locator('input[type="file"]').setInputFiles(mediaFixture)
    await expect(page.getByRole('heading', { name: 'Caption Settings' })).toBeVisible()
    await page.getByRole('button', { name: /Generate Captions/i }).click()
    await expect(page.locator('[data-caption-editor="true"]')).toBeVisible({ timeout: 180_000 })

    await page.locator('[data-caption-card]').first().click()
    await page.getByTitle('Edit caption').first().click()
    const firstCaption = page.locator('textarea[data-caption-id]').first()
    await firstCaption.fill('Authenticated journey correction')
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+K' : 'Control+K')
    await expect(page.getByPlaceholder('Search transcript...')).toBeFocused()
    await page.getByRole('button', { name: /^Save$/i }).click()
    await expect(page.getByText(/Saved|cloud/i)).toBeVisible({ timeout: 30_000 })

    await page.getByRole('button', { name: /^Export$/i }).click()
    await expect(page.getByRole('heading', { name: 'Export your video' })).toBeVisible()
    const subtitleDownloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: /WebVTT subtitles/i }).click()
    const subtitleDownload = await subtitleDownloadPromise
    expect(subtitleDownload.suggestedFilename()).toMatch(/\.vtt$/)
    await page.keyboard.press('Escape')

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('button', { name: /Upload Video/i })).toBeVisible({ timeout: 30_000 })
    await page.getByRole('button', { name: 'Continue saved draft', exact: true }).click()
    await expect(page.locator('[data-caption-editor="true"]')).toBeVisible()
    await expect(page.getByText('Authenticated journey correction', { exact: true })).toBeVisible()
  })

  test('test-mode checkout creates an authenticated order without charging', async ({ page }) => {
    test.skip(!paymentJourneyEnabled, 'Set PLAYWRIGHT_PAYMENT_JOURNEY=1 only against Razorpay test-mode staging.')
    // Inspect the server-authoritative key before it ever reaches checkout.
    // Also block capture/verification: this test only exercises order creation.
    await page.route('**/api/verify-payment', (route) => route.abort())
    await page.route('**/api/create-order', async (route) => {
      const response = await route.fetch({ postData: { ...route.request().postDataJSON(), require_test_mode: true } })
      if (!response.ok()) { await route.fulfill({ response }); throw new Error('Payment test preflight refused this environment') }
      const payload = await response.json()
      if (!String(payload.key_id || '').startsWith('rzp_test_')) {
        await route.abort()
        throw new Error('Payment journey refused non-test Razorpay credentials')
      }
      await route.fulfill({ response, json: payload })
    })
    await page.addInitScript(() => {
      window.__lekhaCheckoutOptions = null
      window.Razorpay = class RazorpayStub {
        constructor(options) {
          if (!String(options.key || '').startsWith('rzp_test_')) throw new Error('Live checkout refused')
          window.__lekhaCheckoutOptions = options
        }
        on() {}
        open() { window.__lekhaCheckoutOpened = true }
      }
    })
    await page.goto('/UserAccount', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: /Upgrade Plan/i }).first().click()
    await expect(page.getByRole('heading', { name: /Choose Your Plan/i })).toBeVisible()
    await page.getByRole('button', { name: /Get Starter/i }).click()
    await expect.poll(() => page.evaluate(() => Boolean(window.__lekhaCheckoutOpened))).toBe(true)
    const options = await page.evaluate(() => window.__lekhaCheckoutOptions)
    expect(options.order_id).toBeTruthy()
    expect(options.key).toBeTruthy()
    expect(options.amount).toBeGreaterThan(0)
  })
})
