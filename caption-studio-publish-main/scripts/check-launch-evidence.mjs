import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const checklist = fs.readFileSync(path.join(root, 'docs', 'COMPLIANCE_CHECKLIST.md'), 'utf8')
const drillLog = fs.readFileSync(path.join(root, 'docs', 'DRILL_LOG.md'), 'utf8')

const pendingChecklist = checklist
  .split(/\r?\n/)
  .filter((line) => /^- \[ \] /.test(line))
  .map((line) => line.replace(/^- \[ \] /, '').trim())

const evidenceRows = drillLog
  .split(/\r?\n/)
  .filter((line) => line.startsWith('|'))
  .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()))
  .filter((cells) => {
    const first = cells[0] || ''
    return cells.length >= 6
      && !/^date \(utc\)$/i.test(first)
      && !/^[-: ]+$/.test(first)
      && !/no completed drills/i.test(first)
  })

const requiredEvidence = [
  ['queue/worker recovery', /queue|worker/i],
  ['payment webhook/reconciliation', /payment|webhook|reconcil/i],
  ['backup restore', /backup|restore/i],
  ['load smoke', /load/i],
  ['authenticated staging media flow', /staging|upload.*process.*export/i],
]

const missingEvidence = requiredEvidence
  .filter(([, pattern]) => !evidenceRows.some((cells) => pattern.test(cells.join(' '))))
  .map(([label]) => label)

for (const cells of evidenceRows) {
  const [date, drillType, scenario, result, evidenceLink, owner] = cells
  if (!date || !drillType || !scenario || !/^pass$/i.test(result) || !evidenceLink || !owner) {
    console.error(`Invalid drill evidence row: ${cells.join(' | ')}`)
    process.exit(1)
  }
}

if (pendingChecklist.length || missingEvidence.length) {
  if (pendingChecklist.length) {
    console.error('Pending compliance sign-off:')
    for (const item of pendingChecklist) console.error(`  - ${item}`)
  }
  if (missingEvidence.length) {
    console.error('Missing launch evidence:')
    for (const item of missingEvidence) console.error(`  - ${item}`)
  }
  process.exit(1)
}

console.log(`Launch evidence passed with ${evidenceRows.length} recorded drill(s).`)
