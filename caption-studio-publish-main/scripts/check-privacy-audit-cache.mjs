import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

// Compare both complete audit implementations on real Git history: unchanged
// secrets, duplicate blobs, renamed paths, binary files and cleaned HEAD.
const artifacts = path.resolve('test-artifacts')
fs.mkdirSync(artifacts, { recursive: true })
const runRoot = fs.mkdtempSync(path.join(artifacts, 'privacy-regression-'))
const repo = path.join(runRoot, 'repo')
fs.mkdirSync(repo)
const cached = fs.readFileSync('scripts/audit-repository-privacy.mjs', 'utf8')
// Keep the original complete-revision algorithm as the comparison, without
// depending on a historical commit being available in shallow CI checkouts.
const start = cached.indexOf('// The same immutable blob')
const end = cached.indexOf('// Public-exposure readiness')
assert.ok(start >= 0 && end > start, 'privacy cache boundaries are missing')
const originalScanner = String.raw`function scanRevision(revision, findings) {
  scanMatches(revision, '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}', findings)
  scanMatches(revision,
    '-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|AKIA[0-9A-Z]{16}|gh[opusr]_[A-Za-z0-9_]{30,}|xox[baprs]-[A-Za-z0-9-]{20,}|rzp_live_[A-Za-z0-9]{8,}|sk-[A-Za-z0-9_-]{32,}',
    findings)
}

`
const original = cached.slice(0, start) + originalScanner + cached.slice(end)
fs.writeFileSync(path.join(runRoot, 'original.mjs'), original)
fs.writeFileSync(path.join(runRoot, 'cached.mjs'), cached)
const git = (...args) => execFileSync('git', args, { cwd: repo, stdio: ['ignore', 'pipe', 'pipe'] })
const write = (name, contents) => fs.writeFileSync(path.join(repo, name), contents)
const commit = (message) => { git('add', '.'); git('commit', '-m', message) }
git('init', '-q')
git('config', 'user.name', 'Privacy regression fixture')
git('config', 'user.email', 'fixture@example.invalid')
fs.mkdirSync(path.join(repo, 'docs'))
write('docs/REPOSITORY_PRIVACY_DECISION.json', JSON.stringify({ decision_status: 'approved', approved_visibility: 'private' }))
const sensitiveFixture = ['fixture' + '@' + 'private.invalid', 'ghp_' + 'a'.repeat(40), '-----BEGIN ' + 'PRIVATE KEY-----'].join('\n')
write('original.txt', sensitiveFixture)
write('duplicate.txt', sensitiveFixture)
write('binary.bin', Buffer.concat([Buffer.from([0]), Buffer.from(sensitiveFixture)]))
commit('Shared findings and binary fixture')
write('innocent.txt', 'Unrelated edit')
commit('Unchanged sensitive blobs')
git('mv', 'original.txt', 'renamed file.txt')
commit('Rename unchanged content')
write('duplicate.txt', sensitiveFixture + '\nAnother line')
commit('Changed sensitive content')
git('rm', 'renamed file.txt', 'duplicate.txt', 'binary.bin')
commit('Remove findings from current tree')
const audit = (script) => {
  try {
    return { status: 0, output: execFileSync(process.execPath, [path.join(runRoot, script)], { cwd: repo, encoding: 'utf8', timeout: 60_000, stdio: ['ignore', 'pipe', 'pipe'] }) }
  } catch (error) {
    if (error.status !== 1) throw error
    return { status: error.status, output: error.stdout + error.stderr }
  }
}
const baseline = audit('original.mjs')
const optimized = audit('cached.mjs')
assert.deepEqual(optimized, baseline, 'cached audit must retain the original findings, paths, revision counts and decision')
assert.equal(optimized.status, 0)
assert.match(optimized.output, /current findings: 0/)
assert.match(optimized.output, /historical findings: [1-9]/)
write('current.txt', sensitiveFixture)
assert.deepEqual(audit('cached.mjs'), audit('original.mjs'), 'current findings must still block the release')
assert.equal(audit('cached.mjs').status, 1)
fs.unlinkSync(path.join(repo, 'current.txt'))
write('docs/REPOSITORY_PRIVACY_DECISION.json', JSON.stringify({ decision_status: 'approved', approved_visibility: 'public_rewritten' }))
assert.deepEqual(audit('cached.mjs'), audit('original.mjs'), 'public history must still fail with retained findings')
assert.equal(audit('cached.mjs').status, 1)
console.log('Privacy audit cache passed: identical findings for unchanged, duplicate, renamed, changed and binary blobs; current findings and public history still fail closed.')
