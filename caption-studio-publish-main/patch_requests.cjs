const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, 'src/styles/captionTemplates.css');
let css = fs.readFileSync(cssPath, 'utf8');

// 1. Inactive/Prior words to #1F2022
// Templates with light backgrounds or where user explicitly might want dark prior words:
// We'll update the default `.word` class color to #1f2022 in templates where it makes sense (mostly the clean/light templates)

// Clarity (t-102) - already has fallback var(--template-secondary, #888), let's change to #1F2022
css = css.replace(/var\(--template-secondary, #888\)/g, 'var(--template-secondary, #1F2022)');

// Sentence Box (t-T5)
css = css.replace(/\.t-T5 \.word \{\n  color: #111 !important;/g, '.t-T5 .word {\n  color: #1F2022 !important;');

// 2. Bold Stroke (t-26)
// Make it look "good" -> impactful, maybe Montserrat or Poppins, with a better default stroke.
css = css.replace(/font-family: 'Bangers', cursive;/g, "font-family: 'Montserrat', sans-serif;\n  font-weight: 900;\n  text-transform: uppercase;");
css = css.replace(/\.t-26 \.word \{\n  color: rgba\(0, 0, 0, \.25\) !important\n\}/g, ".t-26 .word {\n  color: var(--template-secondary, #1F2022) !important;\n  opacity: 0.6;\n}");
css = css.replace(/\.t-26 \.word\.active \{\n  color: #000 !important;\n  -webkit-text-stroke: 1px #000 !important;\n  text-shadow: 3px 3px 0 rgba\(255, 32, 88, \.4\) !important\n\}/g, ".t-26 .word.active {\n  color: var(--template-primary, #FFFFFF) !important;\n  -webkit-text-stroke: 2px #000 !important;\n  text-shadow: 4px 4px 0 var(--template-highlight, #FF2058) !important;\n  opacity: 1;\n}");
// Remove conflicting .current since active covers it, or update it
// actually, let's just make it look clean:
css = css.replace(/\.t-26 \.word\.imp\.active \{\n  color: #ff2058 !important;\n  -webkit-text-stroke: 1px #000 !important;\n  text-shadow: 3px 3px 0 #000 !important\n\}/g, ".t-26 .word.imp.active {\n  color: var(--template-highlight, #FFE600) !important;\n  -webkit-text-stroke: 2px #000 !important;\n  text-shadow: 4px 4px 0 #000 !important;\n  opacity: 1;\n}");


// 3. Sentence Box (t-T5) Background
// The pill uses `var(--template-bg, #FFE600)` and page bg uses `#FFE600` via JS template injection
css = css.replace(/var\(--template-bg, #FFE600\)/g, 'var(--template-bg, #ECF00F)');

fs.writeFileSync(cssPath, css, 'utf8');


// Also update TemplatesTab.jsx defaults for these templates
const tabPath = path.join(__dirname, 'src/components/dashboard/TemplatesTab.jsx');
let tabJsx = fs.readFileSync(tabPath, 'utf8');

// Bold Stroke defaults
tabJsx = tabJsx.replace(
    `{ id: 't-26', name: 'Bold Stroke',
    desc: 'Bangers font, heavy offset shadow',
    bg: '#e8e8e8',
    style: { template_id: 't-26', font_family: 'Bangers', font_size: 28, letter_spacing: 1.5, position_y: 75 }
  }`,
    `{ id: 't-26', name: 'Bold Stroke',
    desc: 'Bold Montserrat, heavy offset shadow',
    bg: '#e8e8e8',
    style: { template_id: 't-26', font_family: 'Montserrat', font_size: 26, font_weight: '900', text_case: 'uppercase', text_color: '#FFFFFF', secondary_color: '#1F2022', background_color: '#e8e8e8', highlight_color: '#FF2058', position_y: 75 }
  }`
);

// Sentence Box defaults
tabJsx = tabJsx.replace(
    `{ id: 't-T5', name: 'Sentence Box',
    desc: 'Yellow italic pill box for all words',
    bg: '#FFE600',
    style: { template_id: 't-T5', font_family: 'Montserrat', font_size: 22, font_weight: '800', font_style: 'italic', position_y: 75 }
  }`,
    `{ id: 't-T5', name: 'Sentence Box',
    desc: 'Yellow italic pill box for all words',
    bg: '#ECF00F',
    style: { template_id: 't-T5', font_family: 'Montserrat', font_size: 22, font_weight: '800', font_style: 'italic', background_color: '#ECF00F', position_y: 75 }
  }`
);

fs.writeFileSync(tabPath, tabJsx, 'utf8');

console.log('Done patching CSS and defaults!');
