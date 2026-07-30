import fs from "fs"
import path from "path"
import { gzipSync } from "zlib"

const distDir = path.resolve(process.cwd(), "dist")
const assetsDir = path.join(distDir, "assets")
const htmlPath = path.join(distDir, "index.html")

function finiteBudget(value, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const maxJsKb = finiteBudget(process.env.PERF_BUDGET_MAX_JS_KB, 1400)
const maxCssKb = finiteBudget(process.env.PERF_BUDGET_MAX_CSS_KB, 220)
const maxTotalKb = finiteBudget(process.env.PERF_BUDGET_MAX_TOTAL_KB, maxJsKb + maxCssKb)
const maxJsGzipKb = finiteBudget(process.env.PERF_BUDGET_MAX_JS_GZIP_KB, 350)
const maxCssGzipKb = finiteBudget(process.env.PERF_BUDGET_MAX_CSS_GZIP_KB, 40)
const maxTotalGzipKb = finiteBudget(
  process.env.PERF_BUDGET_MAX_TOTAL_GZIP_KB,
  maxJsGzipKb + maxCssGzipKb,
)

function bytesToKb(n) {
  return Math.round((n / 1024) * 10) / 10
}

if (!fs.existsSync(assetsDir) || !fs.existsSync(htmlPath)) {
  console.error("Performance budget check failed: dist output not found. Run build first.")
  process.exit(1)
}

const html = fs.readFileSync(htmlPath, "utf8")
const assetRefs = new Set()
const assetPattern = /(?:src|href)="(\/assets\/[^"]+)"/g

for (const match of html.matchAll(assetPattern)) {
  assetRefs.add(match[1].replace(/^\//, ""))
}

let jsBytes = 0
let cssBytes = 0
let totalBytes = 0
let jsGzipBytes = 0
let cssGzipBytes = 0
let totalGzipBytes = 0

for (const assetRef of assetRefs) {
  const full = path.join(distDir, assetRef)
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) continue
  const size = fs.statSync(full).size
  const gzipSize = gzipSync(fs.readFileSync(full)).length
  totalBytes += size
  totalGzipBytes += gzipSize
  if (assetRef.endsWith(".js")) {
    jsBytes += size
    jsGzipBytes += gzipSize
  }
  if (assetRef.endsWith(".css")) {
    cssBytes += size
    cssGzipBytes += gzipSize
  }
}

const jsKb = bytesToKb(jsBytes)
const cssKb = bytesToKb(cssBytes)
const totalKb = bytesToKb(totalBytes)
const jsGzipKb = bytesToKb(jsGzipBytes)
const cssGzipKb = bytesToKb(cssGzipBytes)
const totalGzipKb = bytesToKb(totalGzipBytes)

const failures = []
if (jsKb > maxJsKb) failures.push(`JS budget exceeded: ${jsKb}KB > ${maxJsKb}KB`)
if (cssKb > maxCssKb) failures.push(`CSS budget exceeded: ${cssKb}KB > ${maxCssKb}KB`)
if (totalKb > maxTotalKb) failures.push(`Total asset budget exceeded: ${totalKb}KB > ${maxTotalKb}KB`)
if (jsGzipKb > maxJsGzipKb) failures.push(`JS gzip budget exceeded: ${jsGzipKb}KB > ${maxJsGzipKb}KB`)
if (cssGzipKb > maxCssGzipKb) failures.push(`CSS gzip budget exceeded: ${cssGzipKb}KB > ${maxCssGzipKb}KB`)
if (totalGzipKb > maxTotalGzipKb) {
  failures.push(`Total gzip budget exceeded: ${totalGzipKb}KB > ${maxTotalGzipKb}KB`)
}

console.log(
  `Performance budgets: raw JS ${jsKb}KB/${maxJsKb}KB, CSS ${cssKb}KB/${maxCssKb}KB, total ${totalKb}KB/${maxTotalKb}KB; ` +
  `gzip JS ${jsGzipKb}KB/${maxJsGzipKb}KB, CSS ${cssGzipKb}KB/${maxCssGzipKb}KB, total ${totalGzipKb}KB/${maxTotalGzipKb}KB`,
)

if (failures.length) {
  console.error(failures.join("\n"))
  process.exit(1)
}
