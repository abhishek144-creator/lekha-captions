import { trackAnalytics, getClientContext } from "@/lib/analytics"

function safeObserve(type, handler) {
  if (typeof PerformanceObserver === "undefined") return
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) handler(entry)
    })
    observer.observe({ type, buffered: true })
  } catch {
    // Browser may not support this entry type.
  }
}

export function initWebVitalsTracking() {
  safeObserve("largest-contentful-paint", (entry) => {
    trackAnalytics("perf.lcp", getClientContext({ value: Math.round(entry.startTime) }))
  })
  safeObserve("layout-shift", (entry) => {
    if (entry.hadRecentInput) return
    trackAnalytics("perf.cls", getClientContext({ value: Number(entry.value || 0) }))
  })
  safeObserve("event", (entry) => {
    // Approximation for INP trend from event timing.
    if (!entry.duration) return
    trackAnalytics("perf.inp_candidate", getClientContext({ value: Math.round(entry.duration) }))
  })
}
