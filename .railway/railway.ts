// Railway project for Lekha Captions: scale-to-zero API and workers, media in
// Cloudflare R2, auth and data in Firebase. See
// caption-studio-publish-main/docs/RAILWAY_DEPLOYMENT.md before planning/applying.
//
//   railway config plan     # read-only preview
//   railway config apply    # creates/changes resources (billable): owner only
//
// Secrets are never written here. Each `ctx.shared.X` points at a shared
// variable the owner creates in the Railway environment first.
import { defineRailway, github, group, project, redis, service } from "railway/iac"

const REPO = "abhishek144-creator/lekha-captions"
const APP_DIR = "caption-studio-publish-main"
// Closest Railway region to Indian users.
const REGION = "asia-southeast1-eqsg3a"
const GIB = 1024 * 1024 * 1024

const RENDER_WORKER = "lekha-render"
const TRANSCRIPTION_WORKER = "lekha-transcription"
const WORKER_PORT = "8080"

// Secrets and per-owner settings, created as shared variables in Railway.
const SHARED = [
  "ALLOWED_ORIGINS",
  "ADMIN_EMAILS",
  "SECURITY_CONTACT_EMAIL",
  "PRIVACY_CONTACT_EMAIL",
  "FIREBASE_SERVICE_ACCOUNT_JSON",
  "OPENAI_API_KEY",
  "SARVAM_API_KEY",
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "RAZORPAY_WEBHOOK_SECRET",
  "PAYMENT_RECONCILE_SECRET",
  "MEDIA_URL_SIGNING_SECRET",
  "WORKER_WAKE_SECRET",
  "MEDIA_S3_ENDPOINT",
  "MEDIA_S3_BUCKET",
  "MEDIA_S3_ACCESS_KEY_ID",
  "MEDIA_S3_SECRET_ACCESS_KEY",
  "SENTRY_DSN",
]

const wakeUrl = (worker: string) =>
  `http://\${{${worker}.RAILWAY_PRIVATE_DOMAIN}}:${WORKER_PORT}/wake`

export default defineRailway((ctx) => {
  const source = github(REPO, { branch: "main", rootDirectory: APP_DIR })
  const dockerfile = { builder: "DOCKERFILE" as const, dockerfilePath: "Dockerfile" }
  const replicas = { [REGION]: 1 }
  const limits = (cpu: number, memoryGiB: number) => ({
    containers: { cpu, memoryBytes: memoryGiB * GIB },
  })

  const cache = redis("redis", { region: REGION })

  const backendEnv = {
    ...Object.fromEntries(SHARED.map((name) => [name, ctx.shared[name]])),
    APP_ENV: "production",
    RELEASE_ENVIRONMENT: ctx.environment === "production" ? "production" : "staging",
    ENABLE_DURABLE_QUEUE: "1",
    FIREBASE_APP_CHECK_ENFORCED: "1",
    REDIS_URL: cache.env.REDIS_URL,
    MEDIA_S3_REGION: "auto",
    MEDIA_S3_ADDRESSING_STYLE: "path",
    CLAMAV_SCAN_CMD: "clamscan --stdout --database=/opt/clamav-db",
    // clamscan loads ~110 MB of signatures per scan (about 20-40s, ~1 GB RAM).
    CLAMAV_SCAN_TIMEOUT_SECONDS: "120",
    // Queues wake their worker over the private network; idle workers sleep.
    WORKER_LAUNCH_JOBS: JSON.stringify({
      caption_export_fast: RENDER_WORKER,
      caption_export_jobs: RENDER_WORKER,
      caption_export_heavy: RENDER_WORKER,
      caption_transcription_jobs: TRANSCRIPTION_WORKER,
      caption_media_scan_jobs: TRANSCRIPTION_WORKER,
    }),
    WORKER_WAKE_URLS: JSON.stringify({
      [RENDER_WORKER]: wakeUrl(RENDER_WORKER),
      [TRANSCRIPTION_WORKER]: wakeUrl(TRANSCRIPTION_WORKER),
    }),
    WORKER_LAUNCH_MAX_PARALLEL: "1",
    AI_SYSTEM_DAILY_LIMIT: "500",
  }

  const api = service("lekha-api", {
    source,
    build: dockerfile,
    healthcheck: "/api/health/readiness",
    healthcheckTimeout: 120,
    replicas,
    deploy: {
      startCommand:
        "sh -c 'exec python3 -m uvicorn backend.main:app --host :: --port ${PORT:-8000} " +
        "--workers ${WEB_CONCURRENCY:-1} --limit-concurrency ${UVICORN_LIMIT_CONCURRENCY:-64} " +
        "--timeout-keep-alive ${UVICORN_KEEP_ALIVE_SECONDS:-10}'",
      sleepApplication: true,
      restartPolicyType: "ON_FAILURE",
      restartPolicyMaxRetries: 3,
      // Room for an inline clamscan next to the API process.
      limitOverride: limits(1, 2),
    },
    env: {
      ...backendEnv,
      LEKHA_SERVICE_TARGET: "api",
      // Periodic work runs in lekha-cron so an idle API can sleep.
      RUN_API_BACKGROUND_TASKS: "0",
      WEB_CONCURRENCY: "1",
    },
  })

  const transcription = service(TRANSCRIPTION_WORKER, {
    source,
    build: dockerfile,
    healthcheck: "/health",
    healthcheckTimeout: 120,
    replicas,
    deploy: {
      startCommand: "python3 -m backend.worker",
      sleepApplication: true,
      restartPolicyType: "ON_FAILURE",
      restartPolicyMaxRetries: 3,
      limitOverride: limits(2, 2),
    },
    env: {
      ...backendEnv,
      LEKHA_SERVICE_TARGET: "transcription",
      WORKER_LAUNCH_JOB_NAME: TRANSCRIPTION_WORKER,
      PORT: WORKER_PORT,
    },
  })

  const render = service(RENDER_WORKER, {
    source,
    build: dockerfile,
    healthcheck: "/health",
    healthcheckTimeout: 180,
    replicas,
    deploy: {
      startCommand: "sh -c 'node scripts/render_browser_daemon.mjs & exec python3 -m backend.worker'",
      sleepApplication: true,
      restartPolicyType: "ON_FAILURE",
      restartPolicyMaxRetries: 3,
      // Chromium + FFmpeg were OOM-killed under 3 GiB in staging (2026-08-04).
      limitOverride: limits(2, 4),
    },
    env: {
      ...backendEnv,
      LEKHA_SERVICE_TARGET: "render",
      WORKER_LAUNCH_JOB_NAME: RENDER_WORKER,
      PORT: WORKER_PORT,
      MAX_CONCURRENT_RENDERS: "1",
    },
  })

  const cron = service("lekha-cron", {
    source,
    build: dockerfile,
    replicas,
    deploy: {
      startCommand: "python3 -m backend.railway_cron",
      // Dispatch recovery, worker re-wake, R2 cleanup, payment reconciliation.
      cronSchedule: "*/15 * * * *",
      restartPolicyType: "NEVER",
      limitOverride: limits(1, 1),
    },
    env: {
      ...backendEnv,
      LEKHA_SERVICE_TARGET: "api",
      RUN_API_BACKGROUND_TASKS: "0",
    },
  })

  return project("lekha-captions", {
    resources: [group("Lekha", [api, transcription, render, cron, cache])],
  })
})
