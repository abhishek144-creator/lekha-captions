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

const viteConfig = readText("vite.config.js")
assertIncludes("Vite dev server auto-starts local backend", viteConfig, "lekha-backend-autostart")
assertIncludes("Vite dev server monitors backend version endpoint", viteConfig, "/api/version")

const apiClient = readText("src/lib/apiClient.js")
assertIncludes("API client normalizes backend-unavailable failures", apiClient, "Backend API is not reachable")
assertIncludes("API client retries local API startup failures", apiClient, "LOCAL_API_RETRY_MS")
assertIncludes("API client falls back directly to local backend", apiClient, "VITE_DIRECT_BACKEND_URL")
assertIncludes("API client local direct backend default is port 8000", apiClient, "http://127.0.0.1:8000")

const featureFlags = readText("src/lib/featureFlags.js")
assertIncludes("local dev auth bypass defaults on only in Vite dev", featureFlags, "Boolean(env.DEV)")

const devAuth = readText("src/lib/devAuth.js")
assertIncludes("local dev auth helper supplies mock token", devAuth, "LOCAL_DEV_BYPASS_TOKEN")
assertIncludes("local dev auth helper respects feature flag", devAuth, "featureFlags.localDevAuthBypass")

const backendMainForAuth = readText("backend/main.py")
assertIncludes("backend accepts explicit local dev auth token outside production", backendMainForAuth, "LOCAL_DEV_AUTH_BYPASS_ENABLED")

const devFull = readText("scripts/dev-full.mjs")
assertIncludes("full dev script verifies frontend API proxy", devFull, "Frontend API proxy")

const startApp = readText("scripts/start_app.ps1")
assertIncludes("Windows starter verifies frontend API proxy", startApp, "$FrontendUrl/api/version")

const workflow = readText(".github/workflows/quality-gates.yml")
assertIncludes("GitHub Actions runs in app workspace", workflow, "working-directory: caption-studio-publish-main")
assertIncludes("GitHub Actions runs every template parity audit", workflow, "npm run test:templates:all")
assertIncludes("GitHub Actions runs release readiness", workflow, "npm run release:check")

const backendMain = readText("backend/main.py")
assertIncludes("production rejects DEBUG_MODE", backendMain, "DEBUG_MODE must not be enabled in production")
assertIncludes("production requires explicit CORS origins", backendMain, "ALLOWED_ORIGINS must be set in production")
assertIncludes("production rejects wildcard CORS", backendMain, "Wildcard CORS origins are not allowed in production")
assertIncludes("production requires Redis or explicit in-memory escape hatch", backendMain, "Redis is required in production")
assertIncludes("production requires media signing secret", backendMain, "MEDIA_URL_SIGNING_SECRET must be set in production")
assertIncludes("export daily limit defaults to disabled", backendMain, 'DISABLE_EXPORT_DAILY_LIMIT = os.environ.get(')
assertIncludes("export daily limit disabled default literal is present", backendMain, '"1",\n) == "1"')
assertIncludes("export failure rate limit defaults to disabled", backendMain, 'DISABLE_EXPORT_FAILURE_RATE_LIMIT = os.environ.get("DISABLE_EXPORT_FAILURE_RATE_LIMIT", "1") == "1"')
assertIncludes("exports use signed media URLs", backendMain, "def _signed_export_url")
assertIncludes("uploads use signed media URLs", backendMain, "def _signed_upload_url")

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
