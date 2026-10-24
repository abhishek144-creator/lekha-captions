// Builds src/assets/lekha-captions-lc-studio.html from the Studio caption set.
// studio-set.json is the template data of the owner's design file
// (06_Lekha_Studio_Caption_Set.html). Edit the data or this generator, then run
//   node scripts/studio-templates/generate.cjs
// The asset is generated: do not edit it by hand.
const fs = require('fs')
const path = require('path')

// Templates the owner removed (2026-10-23): Read-along, Tracking, Block Reveal.
// Their data stays in studio-set.json, and every template keeps its original
// number (T226 + its position in the file).
const REMOVED_TEMPLATES = new Set(['read', 'track', 'block'])
const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'studio-set.json'), 'utf8'))
  .map((tpl, position) => ({ ...tpl, num: 226 + position }))
  .filter((tpl) => !REMOVED_TEMPLATES.has(tpl.id))
const out = process.argv[2] || path.join(__dirname, '..', '..', 'src', 'assets', 'lekha-captions-lc-studio.html')

const MOTION = {
  fade: ['stFade', 400, 'ease-out'],
  cut: ['stCut', 120, 'linear'],
  blur: ['stBlur', 750, 'ease-out'],
  lit: ['stLit', 250, 'ease-out'],
  rise: ['stRise', 850, 'cubic-bezier(.16,1,.3,1)'],
  track: ['stTrack', 950, 'cubic-bezier(.16,1,.3,1)'],
  block: ['stBlock', 600, 'linear'],
  slide: ['stSlide', 450, 'cubic-bezier(.2,.8,.2,1)'],
  wipe: ['stWipe', 420, 'linear'],
  panel: ['stPanel', 500, 'cubic-bezier(.16,1,.3,1)'],
  rule: ['stRule', 800, 'cubic-bezier(.16,1,.3,1)'],
  weight: ['stWeight', 400, 'ease-out'],
  scale: ['stScale', 400, 'cubic-bezier(.2,.8,.2,1)'],
  lineup: ['stLineup', 700, 'cubic-bezier(.16,1,.3,1)'],
  drift: ['stDrift', 700, 'cubic-bezier(.16,1,.3,1)'],
}
const KEY_MOTION = {
  frame: ['stFrameKey', 650, 'cubic-bezier(.2,.8,.2,1)'],
  sheen: ['stSheenKey', 1500, 'ease-in-out'],
}
// The keyword takes the template's accent; these two keep a plain keyword and
// put their colour elsewhere (the hairline rule / the underline).
const ACCENT_OVERRIDE = { read: '#ffffff', hair: '#ffffff' }

const q = (value) => `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`

function plan(text) {
  const words = text.split(/\s+/).filter(Boolean).map((raw) => ({ text: raw.replace(/^\*/, ''), imp: raw.startsWith('*') }))
  let k = words.findIndex((w) => w.imp)
  if (k < 0) k = Math.floor(words.length / 2)
  return {
    lead: words.slice(0, k).map((w) => w.text).join(' '),
    key: words[k].text,
    tail: words.slice(k + 1).map((w) => w.text).join(' '),
  }
}

function sceneCall(tpl, spec, text) {
  const p = plan(text)
  const align = { left: 'st-al-l', center: 'st-al-c', right: 'st-al-r' }[spec.align] || 'st-al-c'
  const wordOnly = tpl.motion === 'lit' || tpl.motion === 'weight'
  let unit = wordOnly ? 'word' : (spec.unit || 'word')
  if (unit === 'char') unit = 'word'
  const [anim, dur, ease] = MOTION[tpl.motion]
  const [keyAnim, keyDur, keyEase] = KEY_MOTION[tpl.kfx] || [anim, dur, ease]
  const unitOpt = unit === 'word' ? '' : `,unit:${q(unit)}`
  const body = (cls, value) => `L(${q(cls)},${q(value)},${q(anim)},{dur:${dur},ease:${q(ease)}${unitOpt}})`
  const hero = (cls) => `L(${q(cls)},${q(p.key)},${q(keyAnim)},{hero:1,dur:${keyDur},ease:${q(keyEase)}${unitOpt}})`
  if (spec.comp === 'split') {
    const rows = [p.lead && body('sts', p.lead), hero('stk'), p.tail && body('sts', p.tail)].filter(Boolean)
    return `C(${q(`st-split ${align}`)},${rows.join(',')})`
  }
  const variant = { display: ' st-disp', quote: ' st-quote', label: ' st-label' }[spec.comp] || ''
  const cls = spec.comp === 'display' ? 'std' : spec.comp === 'quote' ? 'stq' : 'stb'
  const segs = [p.lead && body(cls, p.lead), hero(cls), p.tail && body(cls, p.tail)].filter(Boolean)
  return `C(${q(`st-flow${variant} ${align}`)},${segs.join(',')})`
}

const templateCalls = data.map((tpl, index) => {
  const id = `T${tpl.num}`
  // Gallery cards play the English script (owner's choice for this set).
  const scenes = tpl.lines.map((spec, lineIndex) => sceneCall(tpl, spec, tpl.en[lineIndex]))
  return `T(${q(id)},${q(tpl.name)},4,[\n  ${scenes.join(',\n  ')}\n])`
})

const firstFamily = (value) => String(value || '').split(',')[0].trim().replace(/^'|'$/g, '')
// Applying a template sets the caption font to its body face; the editor and
// export then resolve it per script (Devanagari-aware) like every LC template.
const bodyFonts = Object.fromEntries(data.map((tpl, index) => [`T${tpl.num}`, firstFamily(tpl.theme.fb)]))
// The card subtitle in the Templates tab: what each template suits.
const notes = Object.fromEntries(data.map((tpl) => [`T${tpl.num}`, tpl.best]))
const accents = Object.fromEntries(data.map((tpl, index) => [`T${tpl.num}`, ACCENT_OVERRIDE[tpl.id] || tpl.theme.c2]))

const scope = (index) => `.lc-card.lc-t${data[index].num}`
const themeCss = data.map((tpl, index) => {
  const t = tpl.theme
  const vars = [
    `--fs:${t.fs}`, `--fb:${t.fb}`, `--wb:${t.wb}`, `--fk:${t.fk}`, `--wk:${t.wk}`,
    t.fq ? `--fq:${t.fq}` : '', t.fl ? `--fl:${t.fl}` : '',
    t.tt ? `--tt:${t.tt}` : '', t.ls ? `--ls:${t.ls}` : '',
    `--c1:${t.c1}`, `--c2:${t.c2}`,
    `--hif:${t.hif}`, `--hik:${t.hik || t.hif}`,
  ].filter(Boolean).join(';')
  return `/* ${String(tpl.num)} ${tpl.name}: ${tpl.motionText}; key word: ${tpl.keyText} */\n${scope(index)} .cpt{${vars}}`
}).join('\n')

// The export font bundler and the export page's font collector read literal
// font-family declarations (they skip var()), so list every family the set
// uses on a selector that never matches anything.
const fontFamilies = [...new Set(data.flatMap((tpl) => {
  const t = tpl.theme
  return [t.fb, t.fk, t.fq, t.fl, t.hif, t.hik].filter(Boolean)
    .flatMap((value) => String(value).split(','))
    .map((value) => value.trim().replace(/^'|'$/g, ''))
    .filter(Boolean)
}))].sort()
const fontManifestCss = fontFamilies.map((family) => `.lc-studio-font-manifest-unused{font-family:'${family}'}`).join('\n')

// Template words take the caption font (!important in the editor host and the
// export shell). A keyword or quote face that differs from the body face is the
// design, so it is kept the same way; Devanagari falls back to --hik.
const faceCss = data.map((tpl, index) => {
  const t = tpl.theme
  const rules = []
  if (tpl.kfx !== 'italic' && firstFamily(t.fk) !== firstFamily(t.fb)) {
    rules.push(`${scope(index)} .sb .w.hero{font-family:${t.fk},${t.hik || t.hif},sans-serif!important}`)
  }
  if (t.fq && firstFamily(t.fq) !== firstFamily(t.fb)) {
    rules.push(`${scope(index)} .sb .w.stq{font-family:${t.fq},${t.hik || t.hif},serif!important}`)
  }
  return rules.join('\n')
}).filter(Boolean).join('\n')

const byKfx = (kfx) => data.map((tpl, index) => (tpl.kfx === kfx ? scope(index) : null)).filter(Boolean)
const byMotion = (motion) => data.map((tpl, index) => (tpl.motion === motion ? scope(index) : null)).filter(Boolean)
// A treatment no remaining template uses gets a selector that matches nothing.
const sel = (scopes, suffix) => (scopes.length ? scopes.map((s) => `${s}${suffix}`).join(',\n') : '.lc-studio-unused')

const css = `
/* ===== Studio caption set (${data.map((tpl) => `T${tpl.num}`).join(' ')}) =====
   Fifteen restrained templates, one signature motion each. Every rule is
   scoped to .lc-studio / .lc-tNNN so the shared LC classes are untouched.
   Motion lives only on word spans (data-lc-anim), so the editor clock and
   the export runtime drive it exactly like the other LC templates. */
.lc-card.lc-studio .cpt{font-size:var(--fs);color:var(--c1);font-family:var(--fb),var(--hif),sans-serif;font-weight:var(--wb);text-transform:var(--tt,none);letter-spacing:var(--ls,0);line-height:1.32;gap:0;text-shadow:0 .05em .28em rgba(0,0,0,.55)}
.lc-card.lc-studio .cpt .ln{line-height:inherit}
.lc-card.lc-studio .cpt.st-flow{display:block;text-wrap:balance}
.lc-card.lc-studio .cpt.st-flow .ln{display:block}
.lc-card.lc-studio .cpt.st-al-l{text-align:left;align-items:flex-start}
.lc-card.lc-studio .cpt.st-al-c{text-align:center;align-items:center}
.lc-card.lc-studio .cpt.st-al-r{text-align:right;align-items:flex-end}
.lc-card.lc-studio .w{white-space:pre-wrap}
.lc-card.lc-studio .w[data-lc-anim]{animation-fill-mode:both!important}
.lc-card.lc-studio .cpt.st-disp .ln{font-size:1.6em;line-height:1.12}
.lc-card.lc-studio .w.stq{font-family:var(--fq,var(--fb)),var(--hik),serif}
.lc-card.lc-studio .cpt.st-split .ln.sts{font-size:.82em;line-height:1.35}
.lc-card.lc-studio .cpt.st-split .ln.stk{font-size:2em;line-height:1.08;margin:.1em 0}
.lc-card.lc-studio .sb .w.hero{font-family:var(--fk),var(--hik),sans-serif;font-weight:var(--wk);filter:none}
.lc-card.lc-studio .cpt.st-quote::before{content:'\\201C';display:block;height:.55em;font:400 3.4em/1 var(--fq,var(--fk)),serif;color:var(--c2);text-shadow:none}
.lc-card.lc-studio .cpt.st-label::before{content:'';display:block;width:2.6em;height:.11em;border-radius:1px;background:var(--c2);margin:0 0 .6em}
.lc-card.lc-studio .cpt.st-label.st-al-c::before{margin-inline:auto}
.lc-card.lc-studio .cpt.st-label.st-al-r::before{margin-left:auto}

${themeCss}

/* Font families used above through variables (read by the export font tools). */
${fontManifestCss}

/* Keyword and quote faces that differ from the body face. */
${faceCss}

/* Broadcast: a broadcast subtitle needs a firmer edge. */
${sel(byMotion('cut'), ' .cpt')}{text-shadow:0 .04em .16em rgba(0,0,0,.85),0 0 .06em rgba(0,0,0,.6)}

/* ===== key-word treatments ===== */
${sel(byKfx('italic'), ' .sb .w.hero')}{font-family:var(--fq),var(--hik),serif!important;font-style:italic;font-size:1.1em}
${sel(byKfx('bold'), ' .sb .w.hero')}{text-decoration:underline;text-decoration-thickness:.07em;text-underline-offset:.2em}
${sel(byKfx('light'), ' .sb .ln.stk .w.hero')}{font-weight:300}
${sel(byKfx('hair'), ' .cpt::after')}{content:'';display:block;height:.3cqw;width:28cqw;margin-top:2.2cqw;background:var(--c2)}
${sel(byKfx('hair'), ' .cpt.st-al-c::after')}{margin-inline:auto}
${sel(byKfx('hair'), ' .cpt.st-al-r::after')}{margin-left:auto}
${sel(byKfx('smallcaps'), ' .sb .w.hero')}{font-variant:small-caps;letter-spacing:.04em}
${sel(byKfx('caps'), ' .sb .w.hero')}{text-transform:uppercase;letter-spacing:.08em;font-size:.9em}
${sel(byKfx('frame'), ' .sb .w.hero')}{margin-inline:.22em;padding:0 .16em;border-radius:.3em;outline:.06em solid currentColor;outline-offset:.04em}

/* ===== motion-specific structure (static; the words carry the motion) ===== */
${sel(byMotion('block'), ' .w')}{background-image:linear-gradient(var(--c2),var(--c2));background-repeat:no-repeat;background-size:0 100%;background-position:100% 0}
${sel(byMotion('panel'), ' .cpt')}{width:fit-content;max-width:100%;padding:.42em .72em;background:rgba(12,14,18,.74);border-left:.9cqw solid var(--c2);text-shadow:none}
${sel(byMotion('panel'), ' .cpt.st-al-l')}{margin-right:auto}
${sel(byMotion('panel'), ' .cpt.st-al-c')}{margin-inline:auto}
${sel(byMotion('panel'), ' .cpt.st-al-r')}{margin-left:auto;border-left:0;border-right:.9cqw solid var(--c2)}
${sel(byMotion('panel'), ' .cpt .ln.stk')}{font-family:var(--fk),var(--hik),sans-serif}
${sel(byMotion('rule'), ' .cpt')}{width:fit-content;max-width:100%;border-left:.35cqw solid var(--c2);padding-left:3.2cqw}
${sel(byMotion('rule'), ' .cpt.st-al-c')}{margin-inline:auto}
${sel(byMotion('rule'), ' .cpt.st-al-r')}{margin-left:auto;border-left:0;padding-left:0;border-right:.35cqw solid var(--c2);padding-right:3.2cqw}

/* Devanagari and other complex scripts: no small caps, capitals or tracking
   (they break conjuncts), and never below the readable size. Editor host,
   and export shell. */
.lekha-applied-template-host[data-applied-template-complex-script='true'] .lc-card.lc-studio .cpt,
.lekha-sidebar-export-template-shell[data-template-complex-script='true'] .lc-card.lc-studio .cpt{font-size:max(var(--fs),5.4cqw)}
.lekha-applied-template-host[data-applied-template-complex-script='true'] .lc-card.lc-studio .w,
.lekha-sidebar-export-template-shell[data-template-complex-script='true'] .lc-card.lc-studio .w{text-transform:none!important;letter-spacing:0!important;font-variant:normal!important}

/* ===== motions (one per template; every keyframe ends fully visible) ===== */
@keyframes stFade{from{opacity:0;transform:translateY(.22em)}to{opacity:1;transform:none}}
@keyframes stCut{from{opacity:0}to{opacity:1}}
@keyframes stBlur{from{opacity:0;filter:blur(.24em)}to{opacity:1;filter:blur(0)}}
@keyframes stLit{from{opacity:.3}to{opacity:1}}
@keyframes stRise{from{opacity:1;transform:translateY(100%);clip-path:inset(-20% -12% 100% -12%)}to{opacity:1;transform:none;clip-path:inset(-20% -12% -20% -12%)}}
@keyframes stTrack{from{opacity:0;letter-spacing:.8em}to{opacity:1}}
@keyframes stBlock{0%{opacity:1;color:transparent;text-shadow:none;background-size:0 100%;background-position:0 0}50%{opacity:1;color:transparent;text-shadow:none;background-size:100% 100%;background-position:0 0}50.1%{opacity:1;background-size:100% 100%;background-position:100% 0}100%{opacity:1;background-size:0 100%;background-position:100% 0}}
@keyframes stSlide{from{opacity:0;transform:translateX(-.5em)}to{opacity:1;transform:none}}
@keyframes stWipe{from{opacity:1;clip-path:inset(-30% 100% -30% 0)}to{opacity:1;clip-path:inset(-30% -8% -30% 0)}}
@keyframes stPanel{from{opacity:0;transform:translateX(-1.4em)}to{opacity:1;transform:none}}
@keyframes stRule{from{opacity:1;transform:translateX(-100%);clip-path:inset(-20% -12% -20% 100%)}to{opacity:1;transform:none;clip-path:inset(-20% -12% -20% -12%)}}
@keyframes stWeight{from{opacity:.55;font-weight:300}to{opacity:1}}
@keyframes stScale{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:none}}
@keyframes stLineup{from{opacity:0;transform:translateY(70%)}to{opacity:1;transform:none}}
@keyframes stDrift{from{opacity:0;transform:translateY(-.3em)}to{opacity:1;transform:none}}
@keyframes stFrameKey{0%{opacity:0;transform:scale(.94);outline-color:transparent}55%{opacity:1;transform:none;outline-color:transparent}100%{opacity:1;transform:none;outline-color:currentColor}}
@keyframes stSheenKey{0%{opacity:0;transform:translateY(-.3em);filter:brightness(1)}40%{opacity:1;transform:none;filter:brightness(1)}70%{opacity:1;filter:brightness(1.75)}100%{opacity:1;transform:none;filter:brightness(1)}}
`.trim()

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Lekha Captions - Studio caption set</title>
<!-- Generated by scripts/studio-templates/generate.cjs - do not edit by hand.
     Template data below uses the LC DSL read by SidebarTemplateGallery20.jsx
     (parseLcTemplateSet). -->
<style>
${css}
</style>
</head>
<body>
<script type="text/plain" id="lekha-lc-studio-templates">
const TPLS=[
${templateCalls.join(',\n')}
];
const STUDIO_ACCENTS=${JSON.stringify(accents)};
const STUDIO_FONTS=${JSON.stringify(bodyFonts)};
const STUDIO_NOTES=${JSON.stringify(notes)};
</script>
</body>
</html>
`
fs.writeFileSync(out, html, 'utf8')
console.log(`wrote ${out}: ${data.length} templates, ${html.length} bytes`)
console.log(JSON.stringify(accents))
