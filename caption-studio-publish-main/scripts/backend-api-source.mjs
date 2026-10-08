import fs from "fs"
import path from "path"

// Routes are split out of backend/main.py into backend/*_api.py modules (plus
// billing.py), and its helpers into the modules listed below. Code reaches
// helpers as `<module>.<name>` (or `host.<name>` in modules not yet
// converted), runtime state as `app_state.<name>` and configuration as
// `settings.<NAME>`, and registers on `router`; all are normalised back so
// contract strings match either home.
const HELPER_MODULES = new Set([
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

// Backend modules called as `<module>.<name>`; `(?<![\w.])` keeps attribute
// chains such as `report.billing.source` intact.
const MODULE_PREFIX = new RegExp(
  `(?<![\\w.])(?:${[
    ...[...HELPER_MODULES].map((name) => name.replace(/\.py$/, "")),
    "firebase_admin_setup",
    "media_commands",
    "optional_deps",
  ].join("|")})\\.(?=[A-Za-z_])`,
  "g",
)

export function readBackendApiSource(root) {
  const backendDir = path.join(root, "backend")
  const modules = fs.readdirSync(backendDir)
    .filter((name) => name.endsWith("_api.py") || HELPER_MODULES.has(name))
    .sort()
  // Configuration and runtime state first, as they were at the top of main.py.
  return ["main.py", "settings.py", "app_state.py", ...modules]
    .map((name) => fs.readFileSync(path.join(backendDir, name), "utf8"))
    .join("\n")
    .replace(/\bhost\./g, "")
    .replace(MODULE_PREFIX, "")
    .replace(/\bsettings\.(?=_?[A-Z])/g, "")
    .replace(/\bapp_state\./g, "")
    .replace(/@router\./g, "@app.")
}
