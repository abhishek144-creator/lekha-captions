import assert from 'node:assert/strict'
import { deploymentComponentTargets, releaseMetadata, releaseIdentityErrors } from './release-metadata.mjs'
import { createReleaseBatch } from './prepare-release-batch.mjs'

const env = { APP_RELEASE: 'a'.repeat(40), APP_BUILD_TIME: '2026-09-05T00:00:00Z', RELEASE_VERSION: 'v1.0.0-rc.1', RELEASE_ENVIRONMENT: 'staging' }
const editor = releaseMetadata(env, 'editor', true)
const marketing = releaseMetadata(env, 'marketing', true)
assert.deepEqual({ ...editor, component: 'marketing' }, marketing)
assert.equal(editor.release, env.APP_RELEASE)
assert.throws(() => releaseMetadata({ ...env, VITE_APP_RELEASE: 'b'.repeat(40) }), /disagree/)
assert.throws(() => releaseMetadata({ ...env, APP_RELEASE: 'latest' }, 'editor', true), /Git SHA/)
assert.throws(() => releaseMetadata({ ...env, APP_BUILD_TIME: 'invalid' }), /APP_BUILD_TIME/)
assert.throws(() => releaseMetadata({ ...env, RELEASE_VERSION: '<script>' }), /version/)
assert.deepEqual(releaseIdentityErrors(editor, 'editor', 'staging'), [])
assert.equal(releaseIdentityErrors({}, 'api').length, 4)
assert.ok(releaseIdentityErrors(editor, 'worker', 'staging').includes('component identity mismatch'))
assert.ok(releaseIdentityErrors(editor, 'editor').includes('release environment mismatch'))
assert.equal(releaseMetadata({ ...env, RELEASE_VERSION: undefined }, 'editor', true).release_version, `git-${'a'.repeat(12)}`)
assert.match(releaseMetadata({}, 'editor', false).release_version, /^(development|git-[a-f0-9]{12})$/)
const unified = deploymentComponentTargets('https://lekhacaptions.com', 'https://lekhacaptions.com/', ['http://render.railway.internal:8080', 'http://transcription.railway.internal:8080'])
assert.deepEqual(unified.map(({ component }) => component), ['editor', 'editor', 'worker', 'worker'])
assert.equal(unified[2].pathname, '/api/version')
assert.deepEqual(releaseIdentityErrors(editor, unified[1].component, 'staging'), [])
const separate = deploymentComponentTargets('https://app.example.com', 'https://example.com')
assert.equal(separate[1].component, 'marketing')
assert.ok(releaseIdentityErrors(editor, separate[1].component, 'staging').includes('component identity mismatch'))
assert.equal(deploymentComponentTargets('https://example.com/editor', 'https://example.com/marketing')[1].component, 'marketing')
assert.throws(() => deploymentComponentTargets('not a URL', 'https://example.com'), /Invalid URL/)
console.log('Release metadata: 19 assertions passed')

const batch = createReleaseBatch('b'.repeat(40), '2026-10-21T12:00:00.000Z')
for (const component of ['editor', 'marketing', 'api', 'worker']) {
  const metadata = releaseMetadata(batch.env, component, true)
  assert.equal(metadata.release, batch.release)
  assert.equal(metadata.release_version, batch.release_version)
  assert.equal(metadata.built_at, batch.built_at)
  assert.deepEqual(releaseIdentityErrors(metadata, component), [])
}
assert.equal(batch.env.CLAMAV_SIGNATURES_REFRESH, '2026-10-21')
assert.throws(() => createReleaseBatch('latest'), /Git SHA/)
assert.throws(() => createReleaseBatch('b'.repeat(40), '2026-10-21T12:00:00+05:30'), /UTC/)
console.log('Coordinated release batch identity passed for frontend, API and worker artifacts')
