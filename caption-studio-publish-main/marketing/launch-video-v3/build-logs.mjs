// Collects each take's cursor log, frame count and recording viewport into takes/logs.js for the composer.
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
const out = {}
for (const f of readdirSync('takes').filter((n) => n.endsWith('.json'))) {
  const name = f.slice(0, -5)
  const j = JSON.parse(readFileSync(`takes/${f}`, 'utf8'))
  const frames30 = existsSync(`takes/${name}`) ? readdirSync(`takes/${name}`).filter((n) => n.endsWith('.jpg')).length : 0
  // takes recorded before the viewport was logged were all 1600x900 @2
  out[name] = { log: j.log, frames30, view: j.view || { width: 1600, height: 900, scale: 2 } }
}
writeFileSync('takes/logs.js', `window.TAKE_LOGS = ${JSON.stringify(out)}\n`)
console.log(Object.entries(out).map(([k, v]) => `${k}:${v.frames30}`).join(' '))
