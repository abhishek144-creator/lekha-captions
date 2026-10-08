import fs from "fs"
import path from "path"

// Routes are split out of backend/main.py into backend/*_api.py modules (plus
// billing.py), and its helpers into the host-pattern modules listed below.
// Those modules reach shared helpers as `host.<name>`, runtime state as
// `app_state.<name>` and configuration as `settings.<NAME>`, and register on
// `router`; all are normalised back so contract strings match either home.
const HOST_HELPER_MODULES = new Set([
  "api_models.py",
  "billing.py",
  "entitlements.py",
  "export_jobs.py",
  "maintenance_jobs.py",
  "media_records.py",
  "observability.py",
  "operator_controls.py",
  "request_guards.py",
  "request_security.py",
  "upload_dispatch.py",
])

export function readBackendApiSource(root) {
  const backendDir = path.join(root, "backend")
  const modules = fs.readdirSync(backendDir)
    .filter((name) => name.endsWith("_api.py") || HOST_HELPER_MODULES.has(name))
    .sort()
  // Configuration and runtime state first, as they were at the top of main.py.
  return ["main.py", "settings.py", "app_state.py", ...modules]
    .map((name) => fs.readFileSync(path.join(backendDir, name), "utf8"))
    .join("\n")
    .replace(/\bhost\./g, "")
    .replace(/\bsettings\.(?=_?[A-Z])/g, "")
    .replace(/\bapp_state\./g, "")
    .replace(/@router\./g, "@app.")
}
