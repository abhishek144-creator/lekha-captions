import fs from "fs"
import path from "path"

const distDir = path.resolve(process.cwd(), "dist")
const assetsDir = path.join(distDir, "assets")

function finiteBudget(value, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const maxJsKb = finiteBudget(process.env.PERF_BUDGET_MAX_JS_KB, 1400)
const maxCssKb = finiteBudget(process.env.PERF_BUDGET_MAX_CSS_KB, 180)
const maxTotalKb = finiteBudget(process.env.PERF_BUDGET_MAX_TOTAL_KB, maxJsKb + maxCssKb)

function bytesToKb(n) {
  return Math.round((n / 1024) * 10) / 10
}

if (!fs.existsSync(assetsDir)) {
  console.error("Performance budget check failed: dist/assets not found. Run build first.")
  process.exit(1)
}

let jsBytes = 0
let cssBytes = 0
let totalBytes = 0

for (const name of fs.readdirSync(assetsDir)) {
  const full = path.join(assetsDir, name)
  if (!fs.statSync(full).isFile()) continue
  const size = fs.statSync(full).size
  totalBytes += size
  if (name.endsWith(".js")) jsBytes += size
  if (name.endsWith(".css")) cssBytes += size
}

const jsKb = bytesToKb(jsBytes)
const cssKb = bytesToKb(cssBytes)
const totalKb = bytesToKb(totalBytes)

const failures = []
if (jsKb > maxJsKb) failures.push(`JS budget exceeded: ${jsKb}KB > ${maxJsKb}KB`)
if (cssKb > maxCssKb) failures.push(`CSS budget exceeded: ${cssKb}KB > ${maxCssKb}KB`)
if (totalKb > maxTotalKb) failures.push(`Total asset budget exceeded: ${totalKb}KB > ${maxTotalKb}KB`)

console.log(`Performance budgets: JS ${jsKb}KB/${maxJsKb}KB, CSS ${cssKb}KB/${maxCssKb}KB, TOTAL ${totalKb}KB/${maxTotalKb}KB`)

if (failures.length) {
  console.error(failures.join("\n"))
  process.exit(1)
}
