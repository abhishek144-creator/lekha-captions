import { execFileSync } from 'node:child_process'

let status = ''
try {
  status = execFileSync(
    'git',
    ['status', '--porcelain=v1', '--untracked-files=all'],
    { cwd: process.cwd(), encoding: 'utf8' },
  ).trim()
} catch (error) {
  console.error(`Unable to inspect the release worktree: ${error.message}`)
  process.exit(1)
}

if (status) {
  const rows = status.split(/\r?\n/)
  console.error(`Release worktree is not clean (${rows.length} changed path(s)).`)
  for (const row of rows.slice(0, 30)) console.error(`  ${row}`)
  if (rows.length > 30) console.error(`  ...and ${rows.length - 30} more`)
  console.error('Commit the exact reviewed release candidate before launch sign-off.')
  process.exit(1)
}

console.log('Release worktree is clean.')
