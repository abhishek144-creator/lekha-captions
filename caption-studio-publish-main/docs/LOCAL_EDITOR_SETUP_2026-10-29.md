# Consolidated local editor — 29 October 2026

Localhost was serving shared checkout `80f0dcc9`, while the recent editor work was merged into `d1aebf31`. Its ignored local OpenAI key also returned HTTP 401. The failed requests opened the process-local provider circuit. Production model access remained healthy.

The managed `local-editor-recovery` checkout starts from `d1aebf31` and carries the local alternate-download changes. Newer source-expiry handling, toast recovery action, text-box block duration, CPT entrance work, draft recovery behavior and current test contracts are retained. The original checkouts were preserved.

The two local provider credentials were replaced with the existing working service credentials in ignored environment files. Their values are never committed. The consolidated checkout's `MEDIA_SCRATCH_DIR` points at the original app directory, preserving existing uploads and exports. Background maintenance is disabled locally. No provider protection or production configuration was changed.

Run `npm run dev` from this checkout. Both servers identify the checkout's Git release, and startup rejects a backend with a different release or a frontend whose release differs. A local-only shortcut is available at the original repository's `.readiness/Start-Current-Lekha.bat`. The editor remains at `http://localhost:3000/Dashboard`; frontend and proxied backend both report `d1aebf31e080`.

Checks: 308 frontend tests; 33 affected backend tests and 60 subtests; Chrome stalled-download recovery; typecheck and targeted lint. Generated speech passed the local automatic-detection/transcription pipeline using Whisper, and a separate synthetic Sarvam call returned text and timestamps. A fake-server startup check rejects a mismatched backend and accepts a matching frontend/backend pair. The owner's exact video remains available for Retry captions, but it was not retranscribed automatically: automatic approval review requires explicit permission for sending that audio to OpenAI/Sarvam. The pending user approval and a real-video acceptance must not be described as completed.

The full editor browser journey completed its alternate-download assertions, then failed a later text-box vertical-position assertion (`top === 5`). That broader journey is not claimed as passing for this consolidated candidate; the focused Chrome stalled-transfer regression passed independently.


## Approved original-video check

The owner explicitly approved testing the existing 11-second upload with OpenAI and Sarvam. The repaired local automatic-language pipeline succeeded: Hindi, Sarvam transcription, 8 captions and 30 words. Every word has a finite, positive timing interval. Timings include both Whisper-aligned words and Sarvam phrase estimates, so this does not establish perfect phonetic alignment. The result is private and available in the normal local content/settings cache for Auto, clean captions and main-voice focus. No existing browser or cloud project was overwritten.


## 3 November publication recheck

The full editor journey now passes on the consolidated current-main candidate. Download and conflict notifications had been covering the slider during the old local failure; the browser check closes them through their normal controls before pointer input. The original `top === 5` and caption-position isolation assertions are retained. The earlier failure above remains a dated record, not the current result. This recheck used isolated fixtures and made no new provider transcription request.
