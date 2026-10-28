const NON_AUTH_ERROR_MARKERS = /PLAN_EXPIRED|UPGRADE_REQUIRED|INSUFFICIENT_CREDITS|QUOTA_EXCEEDED|media token/i

export function shouldDispatchAuthLogout(status, data = null) {
  if (Number(status) !== 401) return false
  const detail = String(data?.detail || data?.error || data?.message || '')
  return !NON_AUTH_ERROR_MARKERS.test(detail)
}

// The server deleted the uploaded video on its retention schedule: rendering
// or transcribing again needs the original file relinked.
export function isSourceExpiredError(error) {
  return Number(error?.status) === 410 || /SOURCE_EXPIRED/.test(String(error?.message || ''))
}
