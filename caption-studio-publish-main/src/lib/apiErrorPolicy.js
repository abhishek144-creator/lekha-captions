const NON_AUTH_ERROR_MARKERS = /PLAN_EXPIRED|UPGRADE_REQUIRED|INSUFFICIENT_CREDITS|QUOTA_EXCEEDED/

export function shouldDispatchAuthLogout(status, data = null) {
  if (Number(status) !== 401) return false
  const detail = String(data?.detail || data?.error || data?.message || '')
  return !NON_AUTH_ERROR_MARKERS.test(detail)
}
