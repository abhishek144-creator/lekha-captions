// userData reaches the UI through two paths with DIFFERENT date shapes:
//   • /api/account-bootstrap (AuthContext.syncUserRecord) — JSON, so dates are
//     ISO strings or epoch numbers.
//   • Firestore getDoc().data() (AuthContext.refreshUserData, called right
//     after every successful export) — timestamp fields come back as Firestore
//     Timestamp objects, and `new Date(Timestamp)` is Invalid Date.
// Every consumer of subscription_expiry / billing_cycle_end must parse through
// this helper so a paid user is never treated as expired because of the shape.
export function toDateSafe(value) {
  if (value === null || value === undefined || value === '') return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }
  if (typeof value?.toDate === 'function') {
    try {
      return toDateSafe(value.toDate())
    } catch {
      return null
    }
  }
  if (typeof value === 'object' && Number.isFinite(Number(value.seconds))) {
    return new Date(Number(value.seconds) * 1000)
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    // Epoch seconds (Firestore/Unix) vs milliseconds (JS).
    return new Date(value < 1e12 ? value * 1000 : value)
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

// True only when the expiry is parseable AND in the past. Unparseable values
// fail open — the backend remains the real enforcement gate, and locking a
// paying user out over a data-shape quirk is the worse failure.
export function isSubscriptionExpired(expiryValue) {
  const expiry = toDateSafe(expiryValue)
  return !!expiry && expiry.getTime() <= Date.now()
}
