import assert from 'node:assert/strict'
import { releaseMetadata, releaseIdentityErrors } from './release-metadata.mjs'

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
console.log('Release metadata: 10 assertions passed')
