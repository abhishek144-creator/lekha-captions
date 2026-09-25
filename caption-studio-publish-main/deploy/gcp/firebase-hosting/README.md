# Firebase Hosting release

Firebase Hosting serves the Vite editor bundle and rewrites `/api/**` to the
regional `lekha-api` Cloud Run service. The rewrite pins each Hosting release
to the Cloud Run revision that was live at deploy time. Long-running exports
and transcriptions must use the queue and return promptly because Hosting
requests time out after 60 seconds.

## One-time setup

1. Apply the Terraform plan so the default Hosting site, Cloud Run API, Hosting
   API, build IAM, and empty `lekha-frontend-build-config` secret exist.
2. Store a `.env.production` file as the first numeric version of
   `lekha-frontend-build-config`. It must include the public `VITE_FIREBASE_*`
   web-app settings, `VITE_FIREBASE_APP_CHECK_SITE_KEY`,
   `VITE_RAZORPAY_KEY_ID`, and the required legal and support fields documented
   in `.env.example`. Do not include server-side API keys or payment secrets.
3. Set the Hosting site's `.web.app` and `.firebaseapp.com` domains as allowed
   domains on the Firebase App Check web key. Firebase Authentication must also
   allow each domain.

The public Sentry DSN is read from the configured numeric version of
`lekha-frontend-sentry-dsn`. Terraform grants the Cloud Build default service
account access to both build configuration and Sentry secrets. The generated
Vite configuration is written only inside the Cloud Build workspace.

## Release

Apply Cloud Run and worker images built from the same reviewed SHA, then run
this command from the repository root (replace the release values with the
reviewed commit):

```powershell
$release = (git rev-parse HEAD).Trim()
$builtAt = (git show -s --format=%cI $release).Trim()
$version = "gcp-$($release.Substring(0, 12))"
gcloud builds submit --config=deploy/gcp/firebase-hosting/cloudbuild.yaml `
  --substitutions="_APP_RELEASE=$release,_BUILD_TIME=$builtAt,_RELEASE_VERSION=$version" .
```

After deploy, verify `/release.json`, App Check, login, direct resumable upload,
transcription, queued export, and the exported object in Cloud Storage. Use a
staging customer set for the 100-journey capacity run; do not charge production
customers for load-test transactions.
