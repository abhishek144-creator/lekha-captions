# Real near-500 MiB browser recovery acceptance

The resumable upload contract test covers the exact 500 MiB byte sequence in
CI. The Playwright journey in `e2e/large-upload-recovery.spec.js` is the separate
real-browser, real-network acceptance gate.

Run it only against isolated staging with a disposable authenticated account
and a valid video between 480 and 500 MiB. It starts the upload in the browser,
refreshes after the configured percentage, reselects the same file, verifies
that `/api/uploads/resume` returns the existing session, and waits for the
caption editor to open after completion.

```powershell
$env:PLAYWRIGHT_BASE_URL = "https://staging.example.com"
$env:PLAYWRIGHT_AUTH_STORAGE = "C:\secure\staging-auth.json"
$env:PLAYWRIGHT_LARGE_UPLOAD_MEDIA = "D:\fixtures\valid-490mib.mp4"
$env:PLAYWRIGHT_LARGE_UPLOAD_JOURNEY = "1"
$env:PLAYWRIGHT_LARGE_UPLOAD_INTERRUPT_PERCENT = "50"
npm run test:browser:large-upload
```

Repeat with interruption percentages 10, 50, and 90. Save Playwright output,
the release SHA, browser version, fixture SHA-256, network profile, upload ID,
and storage cleanup evidence. Do not run against production or a billable user
account. The test is skipped unless explicitly enabled, so its presence is not
evidence that the external acceptance run passed.
