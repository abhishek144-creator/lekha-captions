// Film-time list of on-screen clicks, cuts and accents for the soundtrack.
//   node events.mjs            -> out/events.json     (launch-v3, segments.js)
//   node events.mjs --film v4  -> out/events-v4.json  (launch-v4, segments-v4.js; adds intro, headline and lift times)
//   node events.mjs --film v5  -> out/events-v5.json  (launch-v5, segments-v5.js; adds subtitle words, wipes, cold open + rewind)
//   node events.mjs --film v6  -> out/events-v6.json  (launch-v6, segments-v6.js; adds transcript-card words, key words and flights)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import vm from 'node:vm'
const film = process.argv.includes('--film') ? process.argv[process.argv.indexOf('--film') + 1] : 'v3'
const ctx = { window: {} }
vm.createContext(ctx)
vm.runInContext(readFileSync('takes/logs.js', 'utf8'), ctx)
vm.runInContext(readFileSync(film === 'v3' ? 'segments.js' : `segments-${film}.js`, 'utf8'), ctx)
const { SEGMENTS, LANG_SEG, END_AT, DURATION, INTRO, CUES, REWIND, COLD } = ctx.window.FILM
const clicks = [], cuts = [], headlines = [], lifts = []
for (const s of SEGMENTS) {
  cuts.push(+s.start.toFixed(3))
  if (s.headline) headlines.push(+(s.start + s.headline.t0).toFixed(3))
  for (const l of s.lifts || []) lifts.push(+(s.start + l.t0).toFixed(3))
  const pieces = s.pieces || [[s.from, s.len]]
  let acc = 0
  for (const [pf, pd] of pieces) {
    if (acc > 0) cuts.push(+(s.start + acc).toFixed(3))
    for (const e of ctx.window.TAKE_LOGS[s.take].log) {
      if ((e.kind === 'click' || e.kind === 'down') && e.t >= pf && e.t < pf + pd) clicks.push(+(s.start + acc + e.t - pf).toFixed(3))
    }
    acc += pd
  }
}
mkdirSync('out', { recursive: true })
const out = film === 'v3' ? 'out/events.json' : `out/events-${film}.json`
const cardsV6 = SEGMENTS[0].card ? {
  cards: SEGMENTS.map((s) => ({ start: +s.card.start.toFixed(3), words: s.card.times.map((x) => +(s.card.start + x).toFixed(3)),
    key: +(s.card.start + s.card.times[s.card.lines.join(' ').split(' ').indexOf(s.card.key)]).toFixed(3), fly: +s.start.toFixed(3), end: +(s.start + s.len).toFixed(3) })),
  fly: ctx.window.FILM.FLY,
} : {}
const extra = CUES ? {
  cues: CUES.map((c) => ({ t0: +c.t0.toFixed(3), t1: +c.t1.toFixed(3), words: c.times.map((x) => +x.toFixed(3)) })),
  wipes: SEGMENTS.filter((s, i) => i > 0 && s.wipe !== false).map((s) => +s.start.toFixed(3)),
  settle: COLD.settle, rewind: { start: REWIND.start, len: REWIND.len },
} : {}
writeFileSync(out, JSON.stringify({ clicks, cuts, headlines, lifts, intro: INTRO || null, ...extra, ...cardsV6, lang: LANG_SEG.start, end: END_AT, duration: DURATION }, null, 1))
console.log(out, 'clicks', clicks.length, 'cuts', cuts.length, 'lang', LANG_SEG.start.toFixed(2), 'end', END_AT.toFixed(2), 'dur', DURATION.toFixed(2))
