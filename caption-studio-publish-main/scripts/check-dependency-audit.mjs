// Dependency audit gate.
//
// `npm audit --audit-level=high` is all-or-nothing: one unfixable advisory that
// does not apply to this app red-lines the whole release gate, and the only way
// to get green is to stop looking. That pressure is how a real advisory gets
// waved through later. So instead: every high/critical advisory must either be
// fixed, or be listed below with a reason and a review date. Anything else fails.
//
// Rules for adding an exception:
//   - It must not be reachable in this app. Say why, concretely.
//   - Prefer upgrading. An exception is for "no patched version we can run".
//   - Set reviewBy. When it passes, the gate fails until someone looks again.
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const repoRoot = path.resolve(import.meta.dirname, '..')

const EXCEPTIONS = []

const WORKSPACES = [
  { dir: '.', label: 'app' },
  { dir: 'landing-next', label: 'landing-next' },
]

const BLOCKING = new Set(['high', 'critical'])

function auditWorkspace(dir) {
  const cwd = path.join(repoRoot, dir)
  let raw
  try {
    // npm audit exits non-zero when it finds anything; that is expected here.
    // Fully literal command, no interpolation, so the shell has nothing to
    // inject into. (execFileSync with an argv array needs shell:true to reach
    // npm.cmd on Windows, and that combination trips DEP0190; Node 24 refuses
    // to spawn .cmd without a shell at all.)
    raw = execSync('npm audit --json', {
      cwd,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  } catch (error) {
    raw = error.stdout
    if (!raw) throw new Error(`npm audit produced no output in ${dir}: ${error.message}`)
  }
  const report = JSON.parse(raw)
  if (report.error) throw new Error(`npm audit failed in ${dir}: ${report.error.summary || 'unknown'}`)

  const found = []
  for (const [pkg, entry] of Object.entries(report.vulnerabilities || {})) {
    if (!BLOCKING.has(entry.severity)) continue
    for (const via of entry.via || []) {
      // String entries are transitive pointers to another package's advisory;
      // the advisory itself is always reported as an object on its own package.
      if (typeof via !== 'object' || !via.url) continue
      found.push({
        id: via.url.split('/').pop(),
        package: pkg,
        severity: entry.severity,
        title: via.title || '',
      })
    }
  }
  return found
}

const today = new Date().toISOString().slice(0, 10)
const failures = []
const usedExceptions = new Set()

for (const { dir, label } of WORKSPACES) {
  if (!existsSync(path.join(repoRoot, dir, 'package.json'))) continue
  for (const advisory of auditWorkspace(dir)) {
    const exception = EXCEPTIONS.find(
      (e) => e.id === advisory.id && e.package === advisory.package && e.workspace === dir,
    )
    if (!exception) {
      failures.push(
        `${label}: unreviewed ${advisory.severity} advisory ${advisory.id} in ` +
          `${advisory.package} — ${advisory.title}\n` +
          '    Fix it, or add a documented exception in scripts/check-dependency-audit.mjs.',
      )
      continue
    }
    usedExceptions.add(`${dir}:${advisory.id}:${advisory.package}`)
    if (exception.reviewBy < today) {
      failures.push(
        `${label}: exception for ${advisory.id} in ${advisory.package} expired on ` +
          `${exception.reviewBy}. Re-check whether a patched version is now reachable.`,
      )
    } else {
      console.log(`ACCEPTED ${label}: ${advisory.id} (${advisory.package}) — review by ${exception.reviewBy}`)
    }
  }
}

// A stale exception is a lie about the dependency tree; drop it once it is moot.
for (const exception of EXCEPTIONS) {
  const key = `${exception.workspace}:${exception.id}:${exception.package}`
  if (!usedExceptions.has(key)) {
    failures.push(
      `stale exception: ${exception.id} (${exception.package}, workspace "${exception.workspace}") ` +
        'no longer matches any advisory. Remove it from scripts/check-dependency-audit.mjs.',
    )
  }
}

if (failures.length) {
  console.error('\nDependency audit gate FAILED:')
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exit(1)
}

console.log(`Dependency audit gate passed: ${usedExceptions.size} documented exception(s), no unreviewed high/critical advisories.`)
