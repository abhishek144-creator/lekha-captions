import { statSync } from 'node:fs'
import { expect, test } from '@playwright/test'


const authStorage = process.env.PLAYWRIGHT_AUTH_STORAGE || ''
const mediaFixture = process.env.PLAYWRIGHT_LARGE_UPLOAD_MEDIA || ''
const enabled = process.env.PLAYWRIGHT_LARGE_UPLOAD_JOURNEY === '1'
const interruptPercent = Math.min(
  90,
  Math.max(10, Number(process.env.PLAYWRIGHT_LARGE_UPLOAD_INTERRUPT_PERCENT || 10)),
)
const MIB = 1024 * 1024


test.describe('real near-500 MiB browser upload recovery', () => {
  test.use({ storageState: authStorage || { cookies: [], origins: [] } })
  test.skip(!enabled, 'Set PLAYWRIGHT_LARGE_UPLOAD_JOURNEY=1 only against isolated staging.')
  test.skip(!authStorage, 'Set PLAYWRIGHT_AUTH_STORAGE to an authenticated staging account.')
  test.skip(!mediaFixture, 'Set PLAYWRIGHT_LARGE_UPLOAD_MEDIA to a valid 480-500 MiB video.')

  test('page refresh resumes the same storage upload and completes', async ({ page }) => {
    test.setTimeout(30 * 60 * 1000)
    const fixtureBytes = statSync(mediaFixture).size
    expect(fixtureBytes).toBeGreaterThanOrEqual(480 * MIB)
    expect(fixtureBytes).toBeLessThanOrEqual(500 * MIB)

    await page.goto('/Dashboard?entry=editor', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: /Upload Video/i }).click()
    await page.locator('input[type="file"]').setInputFiles(mediaFixture)
    await expect(page.getByRole('heading', { name: 'Caption Settings' })).toBeVisible()
    await page.getByRole('button', { name: /Generate Captions/i }).click()
    const progress = page.getByRole('progressbar', { name: 'Video upload progress' })
    await expect(progress).toBeVisible({ timeout: 30_000 })
    await expect.poll(
      async () => Number(await progress.getAttribute('value') || 0) / fixtureBytes * 100,
      { timeout: 15 * 60 * 1000, intervals: [1000] },
    ).toBeGreaterThanOrEqual(interruptPercent)

    // Reload aborts the browser request while preserving the upload receipt in
    // localStorage. Reselecting the same file must use the authoritative GCS
    // offset through /resume rather than create a duplicate upload.
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: /Upload Video/i }).click()
    await page.locator('input[type="file"]').setInputFiles(mediaFixture)
    await expect(page.getByRole('heading', { name: 'Caption Settings' })).toBeVisible()
    const resumeResponsePromise = page.waitForResponse((response) => (
      response.request().method() === 'POST'
      && response.url().includes('/api/uploads/resume')
    ))
    await page.getByRole('button', { name: /Generate Captions/i }).click()
    const resumeResponse = await resumeResponsePromise
    expect(resumeResponse.ok()).toBeTruthy()
    const resumePayload = await resumeResponse.json()
    expect(resumePayload.resumed).toBe(true)
    expect(resumePayload.file_id).toBeTruthy()

    await expect(page.locator('[data-caption-editor="true"]')).toBeVisible({
      timeout: 20 * 60 * 1000,
    })
  })
})
