#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const profilePath = path.join(root, 'docs', 'PRODUCTION_OPERATIONS_PROFILE.json')

function fail(message) {
  console.error(`Operational readiness failed: ${message}`)
  process.exit(1)
}

if (!fs.existsSync(profilePath)) fail('production operations profile is missing')

let profile
try {
  profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'))
} catch (error) {
  fail(`operations profile is not valid JSON (${error.message})`)
}

if (profile.approval_status !== 'approved') fail('profile is not approved')

const requiredPositiveNumbers = [
  ['availability objective', profile.objectives?.availability_percent],
  ['RTO', profile.objectives?.rto_minutes],
  ['RPO', profile.objectives?.rpo_minutes],
  ['SEV-1 acknowledgement', profile.objectives?.sev1_acknowledgement_minutes],
  ['support first response', profile.objectives?.support_first_response_business_hours],
  ['API replicas', profile.capacity?.api_replicas],
  ['render workers', profile.capacity?.render_worker_replicas],
  ['concurrent media jobs', profile.capacity?.approved_concurrent_media_jobs],
  ['AI daily ceiling', profile.provider_and_cost_limits?.ai_system_daily_calls],
]

for (const [label, value] of requiredPositiveNumbers) {
  if (!Number.isFinite(value) || value <= 0) fail(`${label} must be a positive number`)
}

const queue = profile.queue_thresholds || {}
if (!(queue.warning_depth < queue.critical_depth)) {
  fail('queue warning depth must be below critical depth')
}
if (!(queue.warning_oldest_job_minutes < queue.critical_oldest_job_minutes)) {
  fail('queue warning age must be below critical age')
}

const budget = profile.provider_and_cost_limits || {}
if (!(budget.budget_warning_percent > 0 && budget.budget_warning_percent < budget.budget_hard_stop_percent)) {
  fail('budget warning must be positive and below the hard stop')
}
if (budget.budget_hard_stop_percent !== 100) fail('budget hard stop must be 100%')

for (const [role, owner] of Object.entries(profile.ownership || {})) {
  if (!String(owner || '').trim()) fail(`ownership role ${role} is blank`)
}

for (const [label, relativePath] of Object.entries(profile.evidence || {})) {
  const evidencePath = path.join(root, relativePath)
  if (!fs.existsSync(evidencePath)) fail(`evidence ${label} is missing: ${relativePath}`)
}

console.log('Operational readiness passed: objectives, thresholds, ownership, budget stop, and evidence are complete.')
