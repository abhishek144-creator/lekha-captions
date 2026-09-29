import fs from "fs"
import path from "path"

// Routes are split out of backend/main.py into backend/*_api.py modules (plus
// billing.py). Those modules reach shared helpers as `host.<name>` and register
// on `router`; both are normalised back so contract strings match either home.
export function readBackendApiSource(root) {
  const backendDir = path.join(root, "backend")
  const modules = fs.readdirSync(backendDir)
    .filter((name) => name.endsWith("_api.py") || name === "billing.py")
    .sort()
  return ["main.py", ...modules]
    .map((name) => fs.readFileSync(path.join(backendDir, name), "utf8"))
    .join("\n")
    .replace(/\bhost\./g, "")
    .replace(/@router\./g, "@app.")
}
