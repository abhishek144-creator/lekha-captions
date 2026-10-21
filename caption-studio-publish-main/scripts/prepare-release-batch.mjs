import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { releaseIdentityErrors, releaseMetadata } from './release-metadata.mjs'

// One immutable batch identity is shared by the frontend and every image.
// Artifact creation times remain in provider logs; built_at names this batch.
export function createReleaseBatch(release, builtAt = new Date().toISOString()) {
  const metadata = releaseMetadata({
    APP_RELEASE: release,
    APP_BUILD_TIME: builtAt,
    RELEASE_VERSION: `git-${release.slice(0, 12)}`,
    RELEASE_ENVIRONMENT: 'production',
  }, 'editor', true)
  if (!/^\d{4}-\d{2}-\d{2}T.*(?:Z|\+00:00)$/.test(builtAt)) throw new Error('Batch time must be UTC')
  const errors = releaseIdentityErrors(metadata, 'editor')
  if (errors.length) throw new Error(errors.join(', '))
  return {
    schema_version: 1,
    release: metadata.release,
    release_version: metadata.release_version,
    built_at: metadata.built_at,
    environment: metadata.environment,
    env: {
      APP_RELEASE: metadata.release,
      VITE_APP_RELEASE: metadata.release,
      RELEASE_VERSION: metadata.release_version,
      APP_BUILD_TIME: metadata.built_at,
      RELEASE_ENVIRONMENT: metadata.environment,
      CLAMAV_SIGNATURES_REFRESH: metadata.built_at.slice(0, 10),
    },
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
    const status = execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], { cwd: root, encoding: 'utf8' })
    if (status.trim()) throw new Error('Commit and review the complete candidate before preparing its release batch')
    const release = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
    const batch = createReleaseBatch(release)
    const output = process.argv.find((arg) => arg.startsWith('--output='))?.slice('--output='.length)
    if (!output) throw new Error('Supply --output=<new local JSON file>; reuse that file for every artifact')
    const target = resolve(output)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, `${JSON.stringify(batch, null, 2)}\n`, { flag: 'wx' })
    console.log(`Prepared release ${release}: ${target}`)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
