import assert from 'node:assert/strict'
import { shouldDispatchAuthLogout } from '../src/lib/apiErrorPolicy.js'

assert.equal(shouldDispatchAuthLogout(401, { detail: 'Invalid authentication token' }), true)
assert.equal(shouldDispatchAuthLogout(403, { detail: 'UPGRADE_REQUIRED: no credits' }), false)
assert.equal(shouldDispatchAuthLogout(403, { detail: 'Forbidden' }), false)
assert.equal(shouldDispatchAuthLogout(401, { detail: 'PLAN_EXPIRED: renew subscription' }), false)
assert.equal(shouldDispatchAuthLogout(429, { detail: 'QUOTA_EXCEEDED' }), false)

console.log('API error policy checks passed')
