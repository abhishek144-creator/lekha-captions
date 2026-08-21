import fs from "fs"
import path from "path"
import { execFileSync } from "child_process"

const root = process.cwd()
const checks = []

function pass(name) {
  checks.push({ name, ok: true })
}

function fail(name, detail) {
  checks.push({ name, ok: false, detail })
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8")
}

function assertIncludes(name, text, needle) {
  if (text.includes(needle)) pass(name)
  else fail(name, `Missing: ${needle}`)
}

function assertExcludes(name, text, needle) {
  if (!text.includes(needle)) pass(name)
  else fail(name, `Unexpected: ${needle}`)
}

function assertFile(name, relativePath) {
  if (fs.existsSync(path.join(root, relativePath))) pass(name)
  else fail(name, `Missing file: ${relativePath}`)
}

const packageJson = JSON.parse(readText("package.json"))
const scripts = packageJson.scripts || {}

if (scripts["ci:frontend"]?.includes("lint") && scripts["ci:frontend"]?.includes("typecheck") && scripts["ci:frontend"]?.includes("build:guarded")) {
  pass("frontend CI script covers lint, typecheck, and guarded build")
} else {
  fail("frontend CI script covers lint, typecheck, and guarded build", "ci:frontend must include lint, typecheck, and build:guarded")
}

if (scripts["test:template-parity"]) pass("template parity script is registered")
else fail("template parity script is registered", "Missing package script: test:template-parity")

if (scripts["test:template-visual"]) pass("template visual audit script is registered")
else fail("template visual audit script is registered", "Missing package script: test:template-visual")

if (scripts["test:template-export"]) pass("template export audit script is registered")
else fail("template export audit script is registered", "Missing package script: test:template-export")

if (scripts["test:template-export:all-left"]) pass("all left-template export audit script is registered")
else fail("all left-template export audit script is registered", "Missing package script: test:template-export:all-left")

if (scripts["test:template-export:all-right-phases"]) pass("all right advanced phase export audit script is registered")
else fail("all right advanced phase export audit script is registered", "Missing package script: test:template-export:all-right-phases")

if (scripts["test:template-export:all-basic"]) pass("all right basic export audit script is registered")
else fail("all right basic export audit script is registered", "Missing package script: test:template-export:all-basic")

if (scripts["test:template-export:all-basic-scaled"]) pass("scaled right basic export audit script is registered")
else fail("scaled right basic export audit script is registered", "Missing package script: test:template-export:all-basic-scaled")

if (scripts["test:template-export:all"]?.includes("test:template-export:all-left")
  && scripts["test:template-export:all"]?.includes("test:template-export:all-right-phases")
  && scripts["test:template-export:all"]?.includes("test:template-export:all-basic")
  && scripts["test:template-export:all"]?.includes("test:template-export:all-basic-scaled")) {
  pass("all template export audit script covers every template family")
} else {
  fail("all template export audit script covers every template family", "test:template-export:all must include left, right advanced phases, right basic, and scaled basic scopes")
}

if (scripts["test:templates:all"]?.includes("test:template-parity")
  && scripts["test:templates:all"]?.includes("test:template-visual")
  && scripts["test:templates:all"]?.includes("test:template-export:all")) {
  pass("all template parity script covers motion, visual, and export parity")
} else {
  fail("all template parity script covers motion, visual, and export parity", "test:templates:all must include motion, visual, and all export audits")
}

if (scripts["release:check"]) pass("release readiness script is registered")
else fail("release readiness script is registered", "Missing package script: release:check")

assertFile("typecheck config exists", "tsconfig.typecheck.json")
assertFile("template parity checker exists", "scripts/check-template-motion-parity.mjs")
assertFile("template visual audit exists", "scripts/check-template-visual-parity.mjs")
assertFile("template export audit exists", "scripts/check-template-export-parity.mjs")
assertFile("performance budget checker exists", "scripts/check-performance-budget.mjs")
assertFile("shared billing catalog exists", "shared/planCatalog.json")
assertFile("web app manifest exists", "public/manifest.json")
assertFile("Open Graph preview image exists", "public/landing/template-showcase-1.jpg")

const viteConfig = readText("vite.config.js")
assertIncludes("Vite dev server auto-starts local backend", viteConfig, "lekha-backend-autostart")
assertIncludes("Vite dev server monitors backend version endpoint", viteConfig, "/api/version")
assertIncludes("production frontend requires Firebase App Check", viteConfig, "VITE_FIREBASE_APP_CHECK_SITE_KEY")

const apiClient = readText("src/lib/apiClient.js")
assertIncludes("API client normalizes backend-unavailable failures", apiClient, "Backend API is not reachable")
assertIncludes("production API failures use a customer-safe message", apiClient, "Service is temporarily unavailable")
assertIncludes("API client retries local API startup failures", apiClient, "LOCAL_API_RETRY_MS")
assertIncludes("API client falls back directly to local backend", apiClient, "VITE_DIRECT_BACKEND_URL")
assertIncludes("API client local direct backend default is port 8000", apiClient, "http://127.0.0.1:8000")
assertIncludes("API client applies the production API base to every API route", apiClient, "resolveApiUrl")
assertIncludes("API client reads the production API origin", apiClient, "VITE_API_BASE_URL")
assertIncludes("API client creates durable request references", apiClient, "createRequestReference")
assertIncludes("API client sends request references", apiClient, 'requestHeaders.set("X-Request-Id", requestId)')
assertIncludes("API errors expose request references", apiClient, "this.requestId = requestId")
assertIncludes("customer error messages include references", apiClient, "Reference: ${error.requestId}")
assertIncludes("API client sends Firebase App Check tokens", apiClient, 'requestHeaders.set("X-Firebase-AppCheck", appCheckToken)')

const firebaseClient = readText("src/lib/firebase.js")
assertIncludes("Firebase client initializes App Check", firebaseClient, "initializeAppCheck")
assertIncludes("Firebase client uses reCAPTCHA Enterprise", firebaseClient, "ReCaptchaEnterpriseProvider")

const pageConfig = readText("src/pages.config.js")
assertIncludes("known limitations page is routed", pageConfig, '"KnownLimitations": KnownLimitations')
assertIncludes("changelog page is routed", pageConfig, '"Changelog": Changelog')
assertFile("known limitations page exists", "src/pages/KnownLimitations.jsx")
assertFile("changelog page exists", "src/pages/Changelog.jsx")
assertFile("support ticket workflow exists", "docs/SUPPORT_TICKET_WORKFLOW.md")

const featureFlags = readText("src/lib/featureFlags.js")
assertIncludes("local dev auth bypass remains disabled", featureFlags, "localDevAuthBypass: false")

const devAuth = readText("src/lib/devAuth.js")
assertIncludes("auth helper obtains a refreshable signed-in token", devAuth, "currentUser?.getIdToken?.()")
assertIncludes("auth helper does not fall back to a development token", devAuth, "Never fall back")

const backendMainForAuth = readText("backend/main.py")
assertIncludes("backend accepts explicit local dev auth token outside production", backendMainForAuth, "LOCAL_DEV_AUTH_BYPASS_ENABLED")

const devFull = readText("scripts/dev-full.mjs")
assertIncludes("full dev script verifies frontend API proxy", devFull, "Frontend API proxy")

const startApp = readText("scripts/start_app.ps1")
assertIncludes("Windows starter verifies frontend API proxy", startApp, "$FrontendUrl/api/version")

const workflow = readText("../.github/workflows/quality-gates.yml")
assertIncludes("GitHub Actions runs in app workspace", workflow, "working-directory: caption-studio-publish-main")
assertIncludes("GitHub Actions runs template motion parity", workflow, "npm run test:template-parity")
assertIncludes("GitHub Actions runs template visual parity", workflow, "npm run test:template-visual")
assertIncludes("GitHub Actions shards left export parity", workflow, "test:template-export:all-left")
assertIncludes("GitHub Actions shards right phase export parity", workflow, "test:template-export:all-right-phases")
assertIncludes("GitHub Actions shards basic export parity", workflow, "test:template-export:all-basic")
assertIncludes("GitHub Actions shards scaled export parity", workflow, "test:template-export:all-basic-scaled")
assertIncludes("GitHub Actions runs release readiness", workflow, "npm run release:check")
assertIncludes("GitHub Actions builds the marketing site", workflow, "working-directory: caption-studio-publish-main/landing-next")

assertFile("clean release-tree guard exists", "scripts/check-clean-release-tree.mjs")
assertFile("launch evidence guard exists", "scripts/check-launch-evidence.mjs")
if (scripts["launch:check"]?.includes("release:tree") && scripts["launch:check"]?.includes("launch:evidence")) {
  pass("launch check enforces clean source and external evidence")
} else {
  fail("launch check enforces clean source and external evidence", "launch:check must run release:tree and launch:evidence")
}

const backendMain = readText("backend/main.py")
assertIncludes("production rejects DEBUG_MODE", backendMain, "DEBUG_MODE must not be enabled in production")
assertIncludes("production requires explicit CORS origins", backendMain, "ALLOWED_ORIGINS must be set in production")
assertIncludes("production rejects wildcard CORS", backendMain, "Wildcard CORS origins are not allowed in production")
assertIncludes("production requires Redis", backendMain, "Redis is required in production")
assertIncludes("production forbids in-memory state", backendMain, "ALLOW_INMEMORY_STATE is forbidden in production")
assertIncludes("production forbids unscanned uploads", backendMain, "ALLOW_UNSCANNED_UPLOADS is forbidden in production")
assertIncludes("production requires durable export queue", backendMain, "ENABLE_DURABLE_QUEUE must be 1 in production")
assertIncludes("backend enforces Firebase App Check", backendMain, "firebase_app_check.verify_token(token)")
assertIncludes("backend CORS allows Firebase App Check", backendMain, '"X-Firebase-AppCheck"')
assertIncludes("admin can dispatch controlled alert tests", backendMain, '"/api/admin/test-alerts"')
assertIncludes("production requires media signing secret", backendMain, "MEDIA_URL_SIGNING_SECRET must be set in production")
assertIncludes("production requires durable source storage", backendMain, "Durable media storage is unavailable")
assertIncludes("backend loads the shared billing catalog", backendMain, 'shared", "planCatalog.json')
assertIncludes("transcription acquires a per-user in-flight lock", backendMain, "_acquire_process_slot(uid, process_request_id)")
assertIncludes("transcription always releases its in-flight lock", backendMain, "_release_process_slot(uid, process_request_id)")

const storageHelpers = readText("backend/firebase_admin_setup.py")
assertIncludes("exports upload to durable storage", storageHelpers, "blob.upload_from_filename(local_path, content_type=content_type)")
assertIncludes("workers can materialize shared source uploads", storageHelpers, "[Storage] Source download failed")

const pricingModal = readText("src/components/dashboard/PricingModal.jsx")
const pricingLanding = readText("src/components/landing/PricingSection.jsx")
const userAccount = readText("src/pages/UserAccount.jsx")
const uploadModal = readText("src/components/dashboard/UploadModal.jsx")
assertIncludes("dashboard pricing loads the shared billing catalog", pricingModal, "planCatalog.json")
assertIncludes("landing pricing loads the shared billing catalog", pricingLanding, "planCatalog.json")
assertIncludes("account plan limits load the shared billing catalog", userAccount, "planCatalog.json")
assertIncludes("account page exposes permanent account deletion", userAccount, "api/account-delete")
assertIncludes("upload picker validates selected video files", uploadModal, "validateVideoFile(file)")
assertExcludes("dashboard pricing does not advertise unfinished API access", pricingModal.toLowerCase(), "api access")
assertExcludes("landing pricing does not advertise unfinished API access", pricingLanding.toLowerCase(), "api access")
assertExcludes("landing pricing does not advertise unfinished team seats", pricingLanding.toLowerCase(), "team seats")
assertIncludes("readiness checks export workers", backendMain, '"export_worker"')
assertIncludes("tests do not automatically load developer secrets", backendMain, "_bootstrap_is_test")
assertIncludes("export daily limit is configurable", backendMain, 'DISABLE_EXPORT_DAILY_LIMIT = os.environ.get(')
assertIncludes(
  "export daily limit is enforced by default in every environment",
  backendMain.replace(/\r\n/g, "\n"),
  '    "DISABLE_EXPORT_DAILY_LIMIT",\n    "0",\n) == "1"',
)
assertIncludes(
  "production refuses to boot with daily export limits disabled",
  backendMain,
  "if _IS_PRODUCTION and DISABLE_EXPORT_DAILY_LIMIT:",
)
assertIncludes(
  "frontend export-limit bypass requires an explicit local opt-in",
  readText("src/components/dashboard/ExportPanel.jsx"),
  "import.meta.env.VITE_DISABLE_EXPORT_LIMITS === '1'",
)
assertIncludes("export failure rate limit is enforced", backendMain, "recent_failures = _get_recent_export_failures(uid)")
assertExcludes("export failure rate limit has no escape hatch", backendMain, "DISABLE_EXPORT_FAILURE_RATE_LIMIT")
assertIncludes("exports use signed media URLs", backendMain, "def _signed_export_url")
assertIncludes("uploads use signed media URLs", backendMain, "def _signed_upload_url")

const homePage = readText("src/pages/Home.jsx")
const homeV2Page = readText("src/pages/HomeV2.jsx")
const dashboardPage = readText("src/pages/Dashboard.jsx")
const toastComponent = readText("src/components/ui/toast.jsx")
const sitemap = readText("public/sitemap.xml")
const vercelConfig = readText("vercel.json")
const htmlDocument = readText("index.html")
assertIncludes("home links to the support route", homePage, "createPageUrl('HelpAndSupport')")
assertIncludes("home links to the terms route", homePage, "createPageUrl('TermsAndConditions')")
assertIncludes("primary landing page visibly identifies the beta", homePage, "beta={true}")
assertIncludes("alternate landing page visibly identifies the beta", homeV2Page, "beta={true}")
assertIncludes("editor beta marker renders outside desktop-only navigation", dashboardPage, "renders at every breakpoint")
assertIncludes("export failure tells the customer no credit was charged", readText("src/components/dashboard/ExportPanel.jsx"), "No credit was charged")
assertIncludes("multiline failure details preserve line breaks", toastComponent, "whitespace-pre-line")
assertIncludes("long job references wrap on narrow screens", toastComponent, "break-words")
assertIncludes("sitemap contains the support route", sitemap, "/HelpAndSupport</loc>")
assertIncludes("sitemap contains the terms route", sitemap, "/TermsAndConditions</loc>")
assertIncludes("sitemap contains the privacy route", sitemap, "/PrivacyPolicy</loc>")
assertIncludes("sitemap contains the refund policy route", sitemap, "/RefundPolicy</loc>")
assertIncludes("sitemap contains the acceptable use route", sitemap, "/AcceptableUsePolicy</loc>")
assertIncludes("sitemap contains the known limitations route", sitemap, "/KnownLimitations</loc>")
assertIncludes("sitemap contains the changelog route", sitemap, "/Changelog</loc>")

// Razorpay requires a reachable refund/cancellation policy, and the checkout
// surface must link the policies a buyer is agreeing to.
const pagesConfig = readText("src/pages.config.js")
const refundPolicy = readText("src/pages/RefundPolicy.jsx")
const acceptableUse = readText("src/pages/AcceptableUsePolicy.jsx")
const terms = readText("src/pages/TermsAndConditions.jsx")
const privacyPolicy = readText("src/pages/PrivacyPolicy.jsx")
const footer = readText("src/components/landing/Footer.jsx")
assertIncludes("refund policy route is registered", pagesConfig, '"RefundPolicy": RefundPolicy')
assertIncludes("acceptable use route is registered", pagesConfig, '"AcceptableUsePolicy": AcceptableUsePolicy')
assertIncludes("footer links the refund policy", footer, "createPageUrl('RefundPolicy')")
assertIncludes("footer links the acceptable use policy", footer, "createPageUrl('AcceptableUsePolicy')")
assertIncludes("checkout links the refund policy", pricingModal, 'href="/RefundPolicy"')
assertIncludes("refund policy states the credit expiry rule", refundPolicy, "expire at the end of your plan period")
assertIncludes("refund policy states plans do not auto-renew", refundPolicy, "do not auto-renew")
assertIncludes("acceptable use policy has an abuse reporting path", acceptableUse, "ABUSE REPORT")
assertIncludes("terms cover plans and credits", terms, "Plans, Pricing and Credits")
assertIncludes("terms cover suspension", terms, "Suspension and Termination")
assertIncludes("terms disclaim guaranteed availability", terms, "Service Availability")
assertExcludes(
  "terms name a real governing jurisdiction",
  terms,
  "REPLACE_WITH_JURISDICTION",
)
assertIncludes("privacy policy states the AI training position", privacyPolicy, "does not use your videos")

// Operator kill switches must stay wired to every expensive entry point.
assertIncludes("service controls are readable without auth", backendMain, '@app.get("/api/service-status")')
assertIncludes("service controls are admin-writable", backendMain, '@app.post("/api/admin/service-controls")')
for (const [label, control] of [
  ["payments", "pause_payments"],
  ["uploads", "pause_uploads"],
  ["transcription", "pause_transcription"],
  ["exports", "pause_exports"],
  ["signups", "pause_signups"],
]) {
  assertIncludes(
    `${label} honour the operator kill switch`,
    backendMain,
    `_assert_service_available("${control}")`,
  )
}
assertIncludes("new account bootstrap is rate limited", backendMain, "_signup_rate")
assertIncludes("Vercel serves the Vite SPA fallback", vercelConfig, '"destination": "/index.html"')
assertIncludes("HTML references the app manifest", htmlDocument, 'href="/manifest.json"')
assertIncludes("HTML references an existing social preview", htmlDocument, "/landing/template-showcase-1.jpg")

// Video export is server-authoritative. The editor may keep DOM markers for
// interaction/debugging, but ExportPanel must never consume them for rendering.
const exportPanelSource = readText("src/components/dashboard/ExportPanel.jsx")
for (const marker of [
  'data-lekha-player="true"',
  'data-caption-layer="true"',
  "data-caption-id",
  "data-word-key",
  "data-export-measure",
  "lekha-applied-basic-template-host",
]) {
  assertExcludes(`export panel does not depend on preview DOM marker ${marker}`, exportPanelSource, marker)
}
assertExcludes("export panel does not submit browser word layouts", exportPanelSource, "word_layouts:")
assertIncludes("backend strips legacy browser render hints", backendMain, "def _strip_client_render_hints")

const renderer = readText("scripts/render_template_overlay.mjs")
assertIncludes("export renderer uses a DOM tag allowlist", renderer, "const allowedTags = new Set")
assertIncludes("export renderer blocks arbitrary network requests", renderer, "setRequestInterception(true)")
assertIncludes("production forbids disabling the browser sandbox", renderer, "PUPPETEER_DISABLE_SANDBOX is forbidden in production")

assertFile("container deployment definition exists", "Dockerfile")
assertFile("web and worker process definition exists", "Procfile")
const procfile = readText("Procfile")
assertIncludes("process definition starts the API", procfile, "uvicorn backend.main:app")
assertIncludes("process definition starts the export worker", procfile, "python -m backend.worker")

try {
  const trackedGenerated = execFileSync(
    "git",
    [
      "ls-files",
      "build.log",
      "backend/cache/last_export_request_debug.json",
      "../.claude/settings.local.json",
    ],
    { cwd: root, encoding: "utf8" },
  ).trim()
  if (trackedGenerated) fail("generated local artifacts are untracked", `Still tracked:\n${trackedGenerated}`)
  else pass("generated local artifacts are untracked")
} catch (error) {
  fail("generated local artifacts are untracked", error.message)
}

const failures = checks.filter((check) => !check.ok)
for (const check of checks) {
  const marker = check.ok ? "PASS" : "FAIL"
  console.log(`${marker} ${check.name}${check.detail ? ` - ${check.detail}` : ""}`)
}

if (failures.length) {
  console.error(`Release readiness failed: ${failures.length} issue(s)`)
  process.exit(1)
}

console.log(`Release readiness passed: ${checks.length} checks`)
