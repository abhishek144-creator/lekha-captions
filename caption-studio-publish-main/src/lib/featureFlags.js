const env = import.meta.env || {}

function boolEnv(name, fallback = false) {
  const value = env[name]
  if (value === undefined || value === null || value === "") return fallback
  return String(value).toLowerCase() === "true" || String(value) === "1"
}

export const featureFlags = {
  canaryExportFlow: boolEnv("VITE_FF_CANARY_EXPORT_FLOW", false),
  analyticsDepth: boolEnv("VITE_FF_ANALYTICS_DEPTH", true),
  highDemandBanner: boolEnv("VITE_FF_HIGH_DEMAND_BANNER", true),
}

export function isFeatureEnabled(flagName) {
  return Boolean(featureFlags[flagName])
}
