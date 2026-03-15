const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/components/dashboard/VideoPlayer.jsx');
let lines = fs.readFileSync(filePath, 'utf8').split('\n');

// Fix 1: Insert auto-imp detection after "let wordCounter = 0;" (around line 1021)
let wLine = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('let wordCounter = 0;')) { wLine = i; break; }
}
console.log('wordCounter at line:', wLine + 1);

if (wLine >= 0) {
    const autoImpCode = [
        '',
        '                         // AUTO-DETECT IMPORTANT WORDS (when template active)',
        '                         // ALL-CAPS words get yellow; fallback = longest word (>=1 per line)',
        '                         const autoImpIndices = new Set();',
        '                         if (captionStyle?.template_id) {',
        '                           const rawWords = (caption?.text || \'\').split(/\\s+/).filter(w => w.length > 0);',
        "                           rawWords.forEach((w, i) => { if (w.length > 1 && w === w.toUpperCase() && /[A-Z]/.test(w)) autoImpIndices.add(i); });",
        '                           if (autoImpIndices.size === 0 && rawWords.length > 0) {',
        '                             let maxLen = 0, maxIdx = 0;',
        '                             rawWords.forEach((w, i) => { if (w.length > maxLen) { maxLen = w.length; maxIdx = i; } });',
        '                             autoImpIndices.add(maxIdx);',
        '                           }',
        '                         }',
    ];
    lines.splice(wLine + 1, 0, ...autoImpCode);
    console.log('Fix 1 applied');
}

// Fix 2: Update isImpWord line
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("const isImpWord = !!customStyle.isEmphasis;")) {
        lines[i] = lines[i].replace(
            "const isImpWord = !!customStyle.isEmphasis;",
            "const isImpWord = !!customStyle.isEmphasis || (hasTemplate && autoImpIndices.has(wordIndex));"
        );
        console.log('Fix 2 applied at line:', i + 1);
        break;
    }
}

// Fix 3: Change className - done words stay 'active'
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("className={hasTemplate ?") && lines[i].includes("' active'") && lines[i].includes("' done'")) {
        const old3 = "word${isActiveWord ? ' active' : ''}${isDoneWord ? ' done' : ''}${isImpWord ? ' imp' : ''}";
        const new3 = "word${(isActiveWord || isDoneWord) ? ' active' : ''}${isImpWord ? ' imp' : ''}";
        lines[i] = lines[i].replace(old3, new3);
        console.log('Fix 3 applied at line:', i + 1);
        break;
    }
}

fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log('All patches applied!');
