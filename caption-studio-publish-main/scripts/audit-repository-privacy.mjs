#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const gitRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  cwd: root,
  encoding: 'utf8',
}).trim()
const decisionPath = path.join(root, 'docs', 'REPOSITORY_PRIVACY_DECISION.json')
const allowedEmailDomains = new Set([
  'example.com',
  'example.invalid',
  'lekhacaptions.com',
  'users.noreply.github.com',
])

const secretPatterns = [
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
  ['aws-access-key', /AKIA[0-9A-Z]{16}/g],
  ['github-token', /gh[opusr]_[A-Za-z0-9_]{30,}/g],
  ['slack-token', /xox[baprs]-[A-Za-z0-9-]{20,}/g],
  ['razorpay-live-key', /rzp_live_[A-Za-z0-9]{8,}/g],
  ['openai-style-key', /sk-[A-Za-z0-9_-]{32,}/g],
]
const emailPattern = /[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})/gi

function git(args, maxBuffer = 64 * 1024 * 1024) {
  return execFileSync('git', args, {
    cwd: gitRoot,
    encoding: 'utf8',
    maxBuffer,
    stdio: ['ignore', 'pipe', 'ignore'],
  })
}

function fingerprint(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 12)
}

function inspectText(text, location, revision, findings) {
  for (const match of text.matchAll(emailPattern)) {
    const domain = String(match[1] || '').toLowerCase()
    if (!allowedEmailDomains.has(domain)) {
      findings.push({ category: 'personal-email', location, revision, fingerprint: fingerprint(match[0].toLowerCase()) })
    }
  }
  for (const [category, pattern] of secretPatterns) {
    pattern.lastIndex = 0
    for (const match of text.matchAll(pattern)) {
      findings.push({ category, location, revision, fingerprint: fingerprint(match[0]) })
    }
  }
}

function scanMatches(revision, expression, findings) {
  let output = ''
  try {
    output = git(['grep', '-I', '-n', '-E', expression, revision, '--', '.'])
  } catch (error) {
    // git grep exits 1 when no line matches. Preserve stdout in case a platform
    // returns it with the non-zero status, but do not print potentially private
    // source lines.
    output = String(error.stdout || '')
  }
  for (const line of output.split(/\r?\n/).filter(Boolean)) {
    const match = line.match(/^[0-9a-f]+:(.*?):\d+:(.*)$/i)
    if (!match) continue
    const [, location, text] = match
    inspectText(text, location, revision, findings)
  }
}

function scanRevision(revision, findings) {
  scanMatches(revision, '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}', findings)
  scanMatches(
    revision,
    '-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|AKIA[0-9A-Z]{16}|gh[opusr]_[A-Za-z0-9_]{30,}|xox[baprs]-[A-Za-z0-9-]{20,}|rzp_live_[A-Za-z0-9]{8,}|sk-[A-Za-z0-9_-]{32,}',
    findings,
  )
}

const revisions = git(['rev-list', '--all']).trim().split(/\r?\n/).filter(Boolean)
const findings = []

for (const revision of revisions) scanRevision(revision, findings)

const worktreeFiles = git(['ls-files', '--cached', '--others', '--exclude-standard', '-z'])
  .split('\0')
  .filter(Boolean)
for (const name of worktreeFiles) {
  if (/^(?:node_modules|dist|coverage|test-results|playwright-report)\//.test(name)) continue
  const absolutePath = path.join(gitRoot, name)
  let text = ''
  try {
    const bytes = fs.readFileSync(absolutePath)
    if (bytes.includes(0)) continue
    text = bytes.toString('utf8')
  } catch {
    continue
  }
  inspectText(text, name, 'WORKTREE', findings)
}

const authorRows = git(['log', '--all', '--format=%H%x09%ae']).split(/\r?\n/).filter(Boolean)
for (const row of authorRows) {
  const [revision, email = ''] = row.split('\t')
  const match = email.match(/@(.+)$/)
  const domain = String(match?.[1] || '').toLowerCase()
  if (domain && !allowedEmailDomains.has(domain)) {
    findings.push({
      category: 'author-email-metadata',
      location: 'commit metadata',
      revision,
      fingerprint: fingerprint(email.toLowerCase()),
    })
  }
}

const unique = new Map()
for (const finding of findings) {
  const key = `${finding.category}\0${finding.location}\0${finding.revision}\0${finding.fingerprint}`
  unique.set(key, finding)
}
const allFindings = [...unique.values()]
const currentFindings = allFindings.filter((finding) => finding.revision === 'WORKTREE')
const historicalFindings = allFindings.filter((finding) => finding.revision !== 'WORKTREE')

let decision = {}
try {
  decision = JSON.parse(fs.readFileSync(decisionPath, 'utf8'))
} catch (error) {
  console.error(`Repository privacy audit failed: decision file is missing or invalid (${error.message})`)
  process.exit(1)
}

const byCategory = new Map()
for (const finding of allFindings) {
  if (!byCategory.has(finding.category)) {
    byCategory.set(finding.category, { occurrences: 0, fingerprints: new Set(), locations: new Set(), revisions: new Set() })
  }
  const summary = byCategory.get(finding.category)
  summary.occurrences += 1
  summary.fingerprints.add(finding.fingerprint)
  summary.locations.add(finding.location)
  summary.revisions.add(finding.revision)
}

console.log(`Repository privacy audit: ${revisions.length} revision(s) inspected.`)
console.log(`  current findings: ${currentFindings.length}`)
console.log(`  historical findings: ${historicalFindings.length}`)
for (const [category, summary] of [...byCategory.entries()].sort()) {
  console.log(
    `  ${category}: ${summary.occurrences} occurrence(s), ${summary.fingerprints.size} fingerprint(s), `
      + `${summary.locations.size} location(s), ${summary.revisions.size} revision(s)`,
  )
  if (category === 'personal-email') {
    for (const location of [...summary.locations].sort()) console.log(`    - ${location}`)
  }
}

if (currentFindings.some((finding) => finding.category !== 'author-email-metadata')) {
  console.error('Repository privacy audit failed: the current tree contains a privacy or secret finding.')
  process.exit(1)
}

if (decision.decision_status !== 'approved') {
  console.error('Repository privacy audit failed: repository visibility/history decision is still pending.')
  process.exit(1)
}
if (!['private', 'public_rewritten'].includes(decision.approved_visibility)) {
  console.error('Repository privacy audit failed: approved visibility must be private or public_rewritten.')
  process.exit(1)
}
if (decision.approved_visibility === 'public_rewritten' && historicalFindings.length) {
  console.error('Repository privacy audit failed: public history still contains privacy findings.')
  process.exit(1)
}

console.log(`Repository privacy audit passed for approved visibility: ${decision.approved_visibility}.`)
