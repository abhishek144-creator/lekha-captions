import { apiRequest } from "@/lib/apiClient"
import { featureFlags } from "@/lib/featureFlags"

const PENDING_ANALYTICS_KEY = "lekha.pendingAnalytics.v1"
const MAX_PENDING_ANALYTICS_EVENTS = 25
let flushPromise = null

function readPendingAnalytics() {
  if (typeof localStorage === "undefined") return []
  try {
    const parsed = JSON.parse(localStorage.getItem(PENDING_ANALYTICS_KEY) || "[]")
    return Array.isArray(parsed) ? parsed.slice(-MAX_PENDING_ANALYTICS_EVENTS) : []
  } catch {
    return []
  }
}

function writePendingAnalytics(events) {
  if (typeof localStorage === "undefined") return
  try {
    localStorage.setItem(PENDING_ANALYTICS_KEY, JSON.stringify(events.slice(-MAX_PENDING_ANALYTICS_EVENTS)))
  } catch {
    // Storage may be unavailable in private browsing; telemetry stays optional.
  }
}

async function sendAnalyticsEvent(item) {
  await apiRequest("/api/analytics/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(item),
  })
}

async function flushPendingAnalytics() {
  if (flushPromise) return flushPromise
  flushPromise = (async () => {
    const pending = readPendingAnalytics()
    if (!pending.length) return
    const unsent = []
    for (let index = 0; index < pending.length; index += 1) {
      try {
        await sendAnalyticsEvent(pending[index])
      } catch {
        unsent.push(...pending.slice(index))
        break
      }
    }
    writePendingAnalytics(unsent)
  })().finally(() => {
    flushPromise = null
  })
  return flushPromise
}

export async function trackAnalytics(event, payload = {}) {
  if (!featureFlags.analyticsDepth) return
  const item = { event, payload, queuedAt: new Date().toISOString() }
  try {
    await flushPendingAnalytics()
    await sendAnalyticsEvent(item)
  } catch {
    writePendingAnalytics([...readPendingAnalytics(), item])
  }
}

export function getClientContext(extra = {}) {
  const nav = typeof navigator !== "undefined" ? navigator : {}
  const lang = nav.language || ""
  const device = /mobile/i.test(nav.userAgent || "") ? "mobile" : "desktop"
  const conn = nav.connection || {}
  return {
    device,
    language: lang,
    network: conn.effectiveType || "unknown",
    online: nav.onLine !== false,
    downlinkMbps: Number.isFinite(Number(conn.downlink)) ? Number(conn.downlink) : null,
    rttMs: Number.isFinite(Number(conn.rtt)) ? Number(conn.rtt) : null,
    saveData: !!conn.saveData,
    ...extra,
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    flushPendingAnalytics().catch(() => {})
  })
}
