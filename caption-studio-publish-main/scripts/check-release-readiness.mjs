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

if (scripts["release:check"]) pass("release readiness script is registered")
else fail("release readiness script is registered", "Missing package script: release:check")

assertFile("typecheck config exists", "tsconfig.typecheck.json")
assertFile("template parity checker exists", "scripts/check-template-motion-parity.mjs")
assertFile("performance budget checker exists", "scripts/check-performance-budget.mjs")

const workflow = readText(".github/workflows/quality-gates.yml")
assertIncludes("GitHub Actions runs in app workspace", workflow, "working-directory: caption-studio-publish-main")
assertIncludes("GitHub Actions runs template parity", workflow, "npm run test:template-parity")
assertIncludes("GitHub Actions runs release readiness", workflow, "npm run release:check")

const backendMain = readText("backend/main.py")
assertIncludes("production rejects DEBUG_MODE", backendMain, "DEBUG_MODE must not be enabled in production")
assertIncludes("production requires explicit CORS origins", backendMain, "ALLOWED_ORIGINS must be set in production")
assertIncludes("production rejects wildcard CORS", backendMain, "Wildcard CORS origins are not allowed in production")
assertIncludes("production requires Redis or explicit in-memory escape hatch", backendMain, "Redis is required in production")
assertIncludes("production requires media signing secret", backendMain, "MEDIA_URL_SIGNING_SECRET must be set in production")
assertIncludes("export daily limit defaults to enabled", backendMain, 'DISABLE_EXPORT_DAILY_LIMIT = os.environ.get("DISABLE_EXPORT_DAILY_LIMIT", "0") == "1"')
assertIncludes("export failure rate limit defaults to enabled", backendMain, 'DISABLE_EXPORT_FAILURE_RATE_LIMIT = os.environ.get("DISABLE_EXPORT_FAILURE_RATE_LIMIT", "0") == "1"')
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
