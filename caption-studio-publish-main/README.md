# Lekha Captions

Lekha Captions is a video-captioning application with a React/Vite editor, a
FastAPI media-processing API, an RQ export worker, and a separate Next.js
marketing site.

## Repository layout

- `src/` — authenticated editor and account UI
- `backend/` — API, transcription, payments, storage, and export worker
- `landing-next/` — public marketing and legal site
- `scripts/` — release checks, template parity, local startup, and smoke tests
- `docs/` — operations, incident response, compliance, and API contracts

## Local development

Requirements: Node.js 20.19+, Python 3.11+, FFmpeg, and the environment values
described in `.env.example`.

```bash
npm ci
python -m pip install --require-hashes -r backend/requirements.lock
npm run dev
```

The full development command starts the frontend at `http://localhost:3000` and
the API at `http://127.0.0.1:8000`. On Windows, `start_app.bat` is also available.
Use `npm run dev:frontend` only when the backend is already running.

The marketing site is independent:

```bash
cd landing-next
npm ci
npm run dev
```

## Release checks

Run these from the application directory:

```bash
npm run test:templates:all
npm run release:check
$env:APP_ENV='test'; python -m unittest backend.tests.test_api_contracts backend.tests.test_smoke_flow backend.tests.test_audio_less_fallback backend.tests.test_preview_export_parity
python -m pip_audit -r backend/requirements.lock
cd landing-next
npm ci
npm run build
npm audit --audit-level=high
```

`release:check` runs the static release contracts, XSS sanitizer tests, lint,
type checking, a production build, and frontend performance budgets. Production
frontend builds require `VITE_API_BASE_URL`; set `VITE_ALLOW_SAME_ORIGIN_API=1`
only when the deployment really reverse-proxies `/api` to the backend.

## Production deployment contract

- Use the `Dockerfile` image for both the API and worker so Python, Node,
  Puppeteer, fonts, and FFmpeg match.
- Run the API plus at least one export worker as specified by `Procfile`.
- Set `APP_ENV=production`, exact `ALLOWED_ORIGINS`, Firebase Admin and browser
  configuration, Firebase App Check, Redis, media URL signing, AI provider keys,
  Razorpay secrets, public Razorpay key, release identifier, and monitored alert
  destinations from `.env.example`.
- Keep `PUPPETEER_DISABLE_SANDBOX=0` in production.
- Probe `/api/health/readiness`; readiness requires Firestore, storage, Redis,
  scratch capacity, and a healthy export worker.
- Source uploads and completed exports belong in Firebase Storage. Local
  `uploads/`, `exports/`, and `cache/` directories are disposable scratch space.
- Deploy `landing-next/` separately with `NEXT_PUBLIC_APP_URL` and
  `NEXT_PUBLIC_SUPPORT_EMAIL`.

## Staging sign-off

After deploying the API and worker, run a real short media flow with a short-lived
Firebase staging-user token:

```bash
python scripts/staging_smoke.py --base-url https://staging-api.example.com --id-token <token> --app-check-token <token> --video <short-spoken-video.mp4>
```

Then complete a Razorpay test-mode checkout and signed-webhook/reconciliation
check. Record links to the staging run, payment verification, readiness output,
rollback test, and restore drill in the release record. Do not claim launch
readiness without this external evidence.

Run `npm run launch:check` only from the exact commit intended for release. It
fails when the worktree is dirty, any code/build/security/template gate fails,
the compliance checklist has pending items, or the drill log lacks required
staging, payment, queue recovery, load, and restore evidence.

Operational references:

- `docs/WORLD_CLASS_OPERATIONS.md`
- `docs/INCIDENT_RESPONSE.md`
- `docs/COMPLIANCE_CHECKLIST.md`
- `docs/DRILL_LOG.md`
- `docs/API_VERSIONING.md`
