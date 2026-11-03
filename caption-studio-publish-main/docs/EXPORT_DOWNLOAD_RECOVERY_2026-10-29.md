# Local export download recovery — 29 October 2026

The owner's Chrome screenshot showed an export receiving 0.2 of 2.3 MB with an hour remaining. A separate bounded storage download completed a retained 2.3 MB export in 2.14 seconds. That does not identify Chrome's exact failure or prove it was the same object.

Completed exports now offer **Try alternate download** in the Export panel. The action refreshes the existing authorized job result and streams the same immutable R2 object through the signed media route, rather than sending Chrome directly to storage. It creates no render or credit debit. The user should cancel the original stalled transfer to avoid duplicate downloads. The app does not claim to detect completion of browser-managed downloads.

The alternate route checks the existing signed media token, filename and account-deletion guard, uses only the token owner's object key, streams 64 KiB chunks, closes the storage body, preserves attachment headers and forwards a single byte range for resuming. Storage errors are sanitized. Direct storage delivery remains the usual route; alternate delivery is explicit. Local filesystem delivery continues through FileResponse. No production deployment or cloud configuration change was made.

Verification:
- A headless Chrome regression deliberately receives a partial direct attachment that never finishes. The alternate attachment completes with identical bytes and no render request (`npm run test:download-recovery`).
- 123 affected backend tests and 23 subtests pass, including full transfer, partial resume, authorization, malformed ranges and storage failure handling.
- Targeted lint and type checks pass. The local editor journey also exercises the alternate button and verifies the downloaded bytes without an additional export submission. Its optimizer cache is isolated from the running dev server.
- The local app is on localhost:3000 with the alternate route loaded. This is local recovery verification, not acceptance of the owner's exact Chrome/network connection in production.
