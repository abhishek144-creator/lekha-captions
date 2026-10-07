// Classifies export rejections that are plan limits rather than failures, so
// the customer sees what to do instead of "Export failed, contact support".

export function getPlanLimitDetail(errorOrDetail) {
  return typeof errorOrDetail === 'string'
    ? errorOrDetail
    : String(errorOrDetail?.data?.detail || errorOrDetail?.message || '')
}

// 'expired' | 'upgrade' (no credits) | 'daily-limit' | null
export function getPlanLimitErrorKind(errorOrDetail) {
  const detail = getPlanLimitDetail(errorOrDetail)
  if (detail.includes('PLAN_EXPIRED')) return 'expired'
  if (detail.includes('UPGRADE_REQUIRED')) return 'upgrade'
  // The plan's rolling 24-hour export quota (backend _evaluate_export_policy).
  if (/^Limit reached:/i.test(detail.trim())) return 'daily-limit'
  return null
}

// "Limit reached: You can only export 3 videos per 24 hours." -> the sentence
// after the prefix, for use in a customer-facing notice.
export function getDailyLimitMessage(errorOrDetail) {
  return getPlanLimitDetail(errorOrDetail).replace(/^\s*Limit reached:\s*/i, '').trim()
}
