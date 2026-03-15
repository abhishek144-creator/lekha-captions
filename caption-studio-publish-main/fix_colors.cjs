const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, 'src/styles/captionTemplates.css');
let css = fs.readFileSync(cssPath, 'utf8');

// 1. Fix t-109 color
css = css.replace(/\.t-109 \.word \{\s*color: #bbb !important;\s*text-shadow: none !important\s*\}/,
    `.t-109 .word {
  color: #1F2022 !important;
  text-shadow: none !important
}`);

// 2. Fix t-T5 background color
css = css.replace(/\.t-T5 \.cap-text \{[\s\S]*?text-align: center\s*\}/,
    `.t-T5 .cap-text {
  font-family: 'Montserrat', sans-serif;
  font-weight: 800;
  font-style: italic;
  font-size: 22px;
  display: inline-block;
  width: auto;
  max-width: 90%;
  background: var(--template-bg, #ECF00F);
  color: #111;
  border-radius: 10px;
  padding: 8px 12px;
  line-height: 1.5;
  text-align: center
}`);

// 3. Fix t-T5 inactive word color
css = css.replace(/\.t-T5 \.word \{\s*color: #111 !important;\s*background: transparent !important;\s*padding: 0 1px;\s*transition: none\s*\}/,
    `.t-T5 .word {
  color: #1F2022 !important;
  background: transparent !important;
  padding: 0 1px;
  transition: none
}`);

fs.writeFileSync(cssPath, css, 'utf8');
console.log('Fixed CSS files successfully using robust regex replace.');
