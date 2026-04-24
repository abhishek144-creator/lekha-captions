import { apiRequest } from "@/lib/apiClient"
import { featureFlags } from "@/lib/featureFlags"

export async function trackAnalytics(event, payload = {}) {
  if (!featureFlags.analyticsDepth) return
  try {
    await apiRequest("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, payload }),
    })
  } catch {
    // Non-blocking telemetry path by design.
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
    saveData: !!conn.saveData,
    ...extra,
  }
}
