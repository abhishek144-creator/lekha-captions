import { execFileSync } from 'node:child_process'

export function releaseIdentityErrors(metadata, component, environment = 'production') {
  const errors = []
  if (metadata?.schema_version !== 1) errors.push('metadata schema missing or unsupported')
  if (metadata?.component !== component) errors.push('component identity mismatch')
  if (typeof metadata?.release_version !== 'string' || !/^[A-Za-z0-9._-]{1,100}$/.test(metadata.release_version)) errors.push('release version missing or invalid')
  if (metadata?.environment !== environment) errors.push('release environment mismatch')
  return errors
}

export function releaseMetadata(env = process.env, component = 'editor', production = false) {
  let sha = String(env.APP_RELEASE || env.VITE_APP_RELEASE || env.COMMIT_REF || env.RAILWAY_GIT_COMMIT_SHA || '').trim()
  if (env.APP_RELEASE && env.VITE_APP_RELEASE && env.APP_RELEASE !== env.VITE_APP_RELEASE) {
    throw new Error('APP_RELEASE and VITE_APP_RELEASE disagree')
  }
  if (!sha) {
    try { sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() } catch { sha = '' }
  }
  if (production && !/^[a-f0-9]{40}$/i.test(sha)) throw new Error('Release metadata requires a full Git SHA')
  let builtAt = env.APP_BUILD_TIME || ''
  if (!builtAt && sha) {
    try { builtAt = execFileSync('git', ['show', '-s', '--format=%cI', sha], { encoding: 'utf8' }).trim() } catch { builtAt = '' }
  }
  const version = String(env.RELEASE_VERSION || sha.slice(0, 12) || 'development')
  if (!/^[A-Za-z0-9._-]{1,100}$/.test(version)) throw new Error('Invalid release version')
  if (builtAt && !Number.isFinite(Date.parse(builtAt))) throw new Error('Invalid APP_BUILD_TIME')
  return { schema_version: 1, component, release: sha, release_version: version,
    built_at: builtAt || null, environment: env.RELEASE_ENVIRONMENT || (production ? 'production' : 'development') }
}
