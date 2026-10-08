import fs from "fs"
import path from "path"

// Source contracts cover composition, settings and every registered service.
// Context access and router declarations are normalized to their API spelling.
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
  return ["main.py", "application.py", "runtime_settings.py", "application_dependencies.py", "environment.py", "application_lifecycle.py", "worker_tasks.py", ...modules]
    .map((name) => fs.readFileSync(path.join(backendDir, name), "utf8"))
    .join("\n")
    .replace(/\b(host|context)\./g, "")
    .replace(/@router\./g, "@app.")
}
