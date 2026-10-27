import fs from "fs"
import path from "path"
import { spawnSync } from "child_process"
import { createRequire } from "module"

// Gives Sentry this build's source maps so production errors show real files and
// lines. Vite writes hidden maps only when SENTRY_SOURCEMAP_AUTH_TOKEN is set
// (vite.config.js); they are uploaded, then always removed so the site never
// publishes its source. The token needs the project:releases scope. A dedicated
// name, because the owner's machine has a read-only SENTRY_AUTH_TOKEN.
const assetsDir = path.resolve(process.cwd(), "dist", "assets")
const authToken = String(process.env.SENTRY_SOURCEMAP_AUTH_TOKEN || "").trim()
const org = process.env.SENTRY_ORG || "lekha-captions"
// Not SENTRY_PROJECT: on the owner's machine that names the backend project.
const project = process.env.SENTRY_WEB_PROJECT || "lekha-captions-web"

function mapFiles() {
  return fs.readdirSync(assetsDir).filter(name => name.endsWith(".map"))
}

function sentryCli(args) {
  const { SentryCli } = createRequire(import.meta.url)("@sentry/cli")
  const result = spawnSync(SentryCli.getPath(), args, {
    stdio: "inherit",
    env: { ...process.env, SENTRY_AUTH_TOKEN: authToken },
  })
  return result.status === 0
}

if (!fs.existsSync(assetsDir)) {
  console.error("Sentry source maps: dist/assets not found. Run the build first.")
  process.exit(1)
}

try {
  const maps = mapFiles()
  if (!authToken) {
    console.log("Sentry source maps: SENTRY_SOURCEMAP_AUTH_TOKEN is not set; skipping upload.")
  } else if (!maps.length) {
    console.warn("Sentry source maps: the build wrote no .map files; nothing to upload.")
  } else {
    const uploaded = sentryCli(["sourcemaps", "inject", assetsDir])
      && sentryCli(["sourcemaps", "upload", "--org", org, "--project", project, assetsDir])
    if (uploaded) console.log(`Sentry source maps: uploaded ${maps.length} maps to ${org}/${project}.`)
    else console.warn("Sentry source maps: upload FAILED. Errors from this release will show minified stack traces.")
  }
} finally {
  for (const name of mapFiles()) fs.rmSync(path.join(assetsDir, name))
}
