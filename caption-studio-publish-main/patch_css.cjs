const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, 'src/styles/captionTemplates.css');
let css = fs.readFileSync(cssPath, 'utf8');
let lines = css.split('\n');

// Find section start line by looking for the section number+name in comments
function findSectionStart(keyword) {
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(keyword)) return i;
    }
    return -1;
}

// Find next section start after a given line
function findNextSection(afterLine) {
    for (let i = afterLine + 1; i < lines.length; i++) {
        if (lines[i].match(/\/\* [═─]/) && i > afterLine + 2) return i;
    }
    return lines.length;
}

// Replace a section between its header comment and the next section
function replaceSection(keyword, newLines) {
    const start = findSectionStart(keyword);
    if (start === -1) { console.log('NOT FOUND:', keyword); return false; }
    const end = findNextSection(start);
    const newArr = newLines.split('\n').map(l => l + '\r');
    lines.splice(start, end - start, ...newArr);
    console.log(`  Replaced lines ${start}-${end} (${end - start} lines -> ${newArr.length} lines)`);
    return true;
}

// ── FIX: Gradient Box ──
console.log('Gradient Box:', replaceSection('13. Gradient Box',
    `/* ══════════════════════════════════════════
   13. Gradient Box  (id: 119)
   · Box on CURRENT word only · Imp: yellow box when current, yellow TEXT after
══════════════════════════════════════════ */
.t-119 .cap-text{font-family:Inter,sans-serif;font-weight:800;font-size:24px}
.t-119 .word{color:rgba(255,255,255,.35) !important;margin:2px 6px;padding:1px 4px;border-radius:3px}
.t-119 .word.active{color:#fff !important}
.t-119 .word.current{color:#fff !important;background:linear-gradient(90deg,#0088FF,#00FFCC) !important;padding:1px 4px;border-radius:3px}
.t-119 .word.imp.current{color:#1a1a1a !important;background:rgba(255,230,0,.92) !important;padding:1px 4px;border-radius:3px;-webkit-text-fill-color:#1a1a1a !important}
.t-119 .word.imp.active{color:#FFE600 !important;background:transparent !important;-webkit-text-fill-color:#FFE600 !important}
`));

// ── FIX: Red Tape ──
console.log('Red Tape:', replaceSection('22. Red Tape',
    `/* ══════════════════════════════════════════
   22. Red Tape  (id: 111)
   · Red box on CURRENT word only · Imp: orange box when current, yellow TEXT after
══════════════════════════════════════════ */
.t-111 .cap-text{font-family:Inter,sans-serif;font-weight:900;font-size:22px}
.t-111 .word{color:rgba(255,255,255,.4) !important;padding:1px 4px;margin:2px 4px}
.t-111 .word.active{color:#fff !important}
.t-111 .word.current{color:#fff !important;background:#E60000 !important;box-shadow:3px 3px 0 #000;padding:1px 4px}
.t-111 .word.imp.current{color:#fff !important;background:#ff6600 !important;box-shadow:3px 3px 0 #000;padding:1px 4px}
.t-111 .word.imp.active{color:#FFE600 !important;background:transparent !important;box-shadow:none}
`));

// ── FIX: 8 templates with fully transparent inactive (one-by-one reveal) ──
const fixes = [
    ['5. Color Flash', `.t-36 .cap-text{font-family:'Noto Sans',sans-serif;font-weight:900;font-size:26px}
.t-36 .word{color:rgba(255,255,255,0) !important;text-shadow:none !important;filter:none}
.t-36 .word.active{color:#fff !important;filter:none}
.t-36 .word.current{color:#00ffb3 !important;filter:drop-shadow(2px 2px 0 rgba(0,0,0,.9))}
.t-36 .word.imp.active{color:#FFE600 !important}`],

    ['9. Ghost Echo', `.t-124 .cap-text{font-family:Inter,sans-serif;font-weight:900;font-size:26px}
.t-124 .word{color:rgba(255,255,255,0) !important;text-shadow:none !important}
.t-124 .word.active{color:#fff !important;text-shadow:none !important}
.t-124 .word.current{color:#fff !important;animation:echoIn .22s ease-out both;text-shadow:4px 4px 0 rgba(255,255,255,.32),8px 8px 0 rgba(255,255,255,.14) !important}
.t-124 .word.imp.active{color:#FFE600 !important}
.t-124 .word.imp.current{text-shadow:4px 4px 0 rgba(255,210,0,.28) !important}`],

    ['17. Iman', `.t-106 .cap-text{font-family:'Noto Sans',sans-serif;font-weight:800;font-size:24px}
.t-106 .word{color:transparent !important}
.t-106 .word.active{color:#fff !important;filter:drop-shadow(1px 2px 3px rgba(0,0,0,.8))}
.t-106 .word.imp.active{color:#FFE600 !important;filter:drop-shadow(1px 2px 3px rgba(0,0,0,.8))}`],

    ['18. Light Streak', `.t-52 .cap-text{font-family:Inter,sans-serif;font-weight:900;font-size:26px}
.t-52 .word{color:rgba(255,255,255,0) !important}
.t-52 .word.active{color:#fff !important}
.t-52 .word.current{animation:riseIn .25s ease-out both}
.t-52 .word.imp.active{color:#FFE600 !important}
.t-52 .word.imp.current{animation:riseIn .25s ease-out both}`],

    ['21. Pulse', `.t-104 .cap-text{font-family:'Noto Sans',sans-serif;font-weight:900;font-size:26px}
.t-104 .word{color:rgba(255,255,255,0) !important;-webkit-text-stroke:2px rgba(178,141,255,.4) !important;paint-order:stroke fill;filter:drop-shadow(2px 2px 2px rgba(0,0,0,.9))}
.t-104 .word.active{color:#fff !important;-webkit-text-stroke:2px #B28DFF !important}
.t-104 .word.current{filter:drop-shadow(2px 2px 2px rgba(0,0,0,.9)) drop-shadow(0 0 6px rgba(178,141,255,.85))}
.t-104 .word.imp.active{color:#FFE600 !important;-webkit-text-stroke:2px #B28DFF !important}`],

    ['6. Daze', `.t-105 .cap-text{font-family:'Noto Sans',sans-serif;font-weight:800;font-size:24px}
.t-105 .word{color:rgba(255,255,255,0) !important;-webkit-text-stroke:1px #000 !important;paint-order:stroke fill;filter:drop-shadow(2px 2px 2px rgba(0,0,0,.8))}
.t-105 .word.active{color:#fff !important;-webkit-text-stroke:1px #000 !important;paint-order:stroke fill;filter:drop-shadow(2px 2px 2px rgba(0,0,0,.8))}
.t-105 .word.current{color:#FFE600 !important}
.t-105 .word.imp.current{color:#FFE600 !important}`],

    ['32. Wipe Mask', `.t-37 .cap-text{font-family:Inter,sans-serif;font-weight:900;font-size:26px;text-transform:uppercase}
.t-37 .word{color:rgba(255,255,255,0) !important}
.t-37 .word.active{color:#fff !important;filter:none}
.t-37 .word.current{color:#FF2BD6 !important;filter:drop-shadow(2px 2px 0 rgba(0,0,0,.9));animation:wipeIn .2s linear both}
.t-37 .word.imp.active{color:#FFE600 !important}`],

    ['30. Underline Fade', `.t-T3 .bg{background:#0a0a0a}
.t-T3 .cap-text{font-family:'Montserrat',sans-serif;font-weight:400;font-size:22px;line-height:1.8}
.t-T3 .word{color:rgba(255,255,255,0) !important}
.t-T3 .word.active{color:#fff !important;animation:fadeUp .4s ease-out both}
.t-T3 .word.imp.active{color:#fff !important;border-bottom:2.5px solid #cdff00;padding-bottom:2px}`],
];

for (const [keyword, rules] of fixes) {
    const name = keyword.split('. ')[1];
    const header = `/* ══════════════════════════════════════════\n   ${keyword}\n══════════════════════════════════════════ */`;
    console.log(name + ':', replaceSection(keyword, header + '\n' + rules + '\n'));
}

css = lines.join('\n');
fs.writeFileSync(cssPath, css, 'utf8');
console.log('All done!');
