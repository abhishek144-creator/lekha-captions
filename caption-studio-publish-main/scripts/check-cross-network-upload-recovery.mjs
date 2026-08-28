import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const apiClient = fs.readFileSync(path.join(root, 'src/lib/apiClient.js'), 'utf8')
const dashboard = fs.readFileSync(path.join(root, 'src/pages/Dashboard.jsx'), 'utf8')
const uploadModal = fs.readFileSync(path.join(root, 'src/components/dashboard/UploadModal.jsx'), 'utf8')
const resilientUpload = fs.readFileSync(path.join(root, 'src/lib/resilientUpload.js'), 'utf8')
const analytics = fs.readFileSync(path.join(root, 'src/lib/analytics.js'), 'utf8')
const backend = fs.readFileSync(path.join(root, 'backend/main.py'), 'utf8')
const railway = fs.readFileSync(path.join(root, 'railway.toml'), 'utf8')

const assertions = [
  {
    ok: /function isAppCheckRejection\([\s\S]*app security verification/s.test(apiClient),
    message: 'API client must recognize backend App Check rejections.',
  },
  {
    ok: /getFirebaseAppCheckToken\(true\)[\s\S]*headers\.set\("X-Firebase-AppCheck", refreshedAppCheckToken\)[\s\S]*continue/s.test(apiClient),
    message: 'API client must refresh App Check and retry the rejected request once.',
  },
  {
    ok: /setVideoUrl\(acceptedPlayableVideoUrl\);\s*setFileId\(uploadData\.file_id\);\s*setOriginalFileName\(selectedFileName\);/s.test(dashboard),
    message: 'Dashboard must commit an accepted upload before transcription begins.',
  },
  {
    ok: /uploadWasAccepted[\s\S]*setVideoUrl\(uploadWasAccepted \? acceptedPlayableVideoUrl : ''\)[\s\S]*Transcription failed — video kept in editor/s.test(dashboard),
    message: 'A transcription failure must preserve the uploaded video and open the editor.',
  },
  {
    ok: /DEFAULT_RETRY_DELAYS_MS\s*=\s*\[1500, 4000, 8000\][\s\S]*waitForConnection[\s\S]*isRetryableUploadError[\s\S]*await sleep\(retryDelaysMs\[attempt\]\)/s.test(resilientUpload),
    message: 'Interrupted and temporarily offline uploads must retry automatically with bounded backoff.',
  },
  {
    ok: /uploadFileWithRecovery\(file[\s\S]*dedupeKey: 'upload-video'/s.test(dashboard)
      && /uploadFileWithRecovery\(selectedFile[\s\S]*dedupeKey: 'detect-upload'/s.test(uploadModal),
    message: 'Both Generate and Detect Language uploads must share the resilient transport.',
  },
  {
    ok: /'Idempotency-Key': uploadReference/.test(resilientUpload),
    message: 'Every retry series must carry one stable upload reference for production tracing.',
  },
  {
    ok: /if too_large:[\s\S]*Count only fully received uploads[\s\S]*_check_rate\([\s\S]*_upload_rate,[\s\S]*f"network:\{client_ip\}"/s.test(backend),
    message: 'Interrupted request bodies must not consume the backend upload rate limit.',
  },
  {
    ok: /UPLOAD_USER_RATE_LIMIT\s*=\s*10[\s\S]*UPLOAD_SHARED_NETWORK_RATE_LIMIT\s*=\s*200/s.test(backend)
      && /PROCESS_USER_RATE_LIMIT\s*=\s*20[\s\S]*PROCESS_SHARED_NETWORK_RATE_LIMIT\s*=\s*300/s.test(backend),
    message: 'Per-user limits must be separate from carrier-grade/shared-network safeguards.',
  },
  {
    ok: /SIGNUP_SHARED_NETWORK_RATE_LIMIT\s*=\s*100/.test(backend)
      && /"credits_remaining": FREE_PLAN_CREDITS[\s\S]*"subscription_tier": "free"/s.test(backend)
      && /FREE_PLAN_CREDITS\s*=\s*int\(FREE_PLAN\.get\("credits", 0\) or 0\)/.test(backend),
    message: 'Shared networks must not block normal sign-up, and new users must receive the free plan.',
  },
  {
    ok: /upload_client_disconnected[\s\S]*bytes_received[\s\S]*request_id/s.test(backend)
      && /_cleanup_incomplete_upload/s.test(backend),
    message: 'Interrupted uploads must be stage-traced and partial files must be cleaned up.',
  },
  {
    ok: /request\.state\.request_id\s*=\s*rid/.test(backend)
      && /state_rid\s*=\s*str\(getattr\(request\.state, "request_id"/s.test(backend),
    message: 'Middleware and endpoint logs must share one request reference.',
  },
  {
    ok: /PENDING_ANALYTICS_KEY[\s\S]*MAX_PENDING_ANALYTICS_EVENTS[\s\S]*flushPendingAnalytics/s.test(analytics)
      && /funnel\.upload\.transport_failed[\s\S]*requestReference[\s\S]*uploadReference/s.test(resilientUpload),
    message: 'Client-side failures must be queued and correlated after the connection recovers.',
  },
  {
    ok: /RAILWAY_REPLICA_REGION[\s\S]*replica_region=RAILWAY_REPLICA_REGION/s.test(backend)
      && /healthcheckPath\s*=\s*"\/api\/health\/readiness"/.test(railway),
    message: 'Production logs must identify the serving region and deployments must pass readiness before promotion.',
  },
]

const failures = assertions.filter(({ ok }) => !ok)
if (failures.length) {
  for (const failure of failures) console.error(`FAIL: ${failure.message}`)
  process.exit(1)
}

console.log('Cross-network upload recovery contract passed.')
