const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, 'src/styles/captionTemplates.css');
let css = fs.readFileSync(cssPath, 'utf8');

// We will inject a root definition and then replace hardcoded colors with var() in the CSS.
// To avoid breaking the complex designs, let's just globally replace the primary hardcoded colors 
// that we know map to these roles, while keeping their !important tags.

// Highlight Color is overwhelmingly #FFE600
css = css.replace(/#FFE600/gi, 'var(--template-highlight, #FFE600)');

// For specific templates, it's safer to just let the backend handle the rendering logic, 
// and for the FRONTEND preview, we can apply inline styles to the preview container.
// Wait, if we just want the preview to work, injecting CSS variables into the base CSS is best.

// Let's add the variables to the top of the file:
const rootVars = `
:root {
  --template-primary: #ffffff;
  --template-secondary: #000000;
  --template-highlight: #FFE600;
  --template-bg: transparent;
}
`;

if (!css.includes('--template-highlight')) {
    css = rootVars + css;
}

// Let's replace the most common colors to make them customizable in the preview
// White (#fff, #ffffff) -> var(--template-primary, #fff)
// Black (#000, #000000) -> var(--template-secondary, #000)

// Instead of a blind global replace which might break things like rgba(255,255,255), 
// let's do targeted replacements for the most common ones.
css = css.replace(/color:\s*#fff\s*!important/gi, 'color: var(--template-primary, #fff) !important');
css = css.replace(/color:\s*#ffffff\s*!important/gi, 'color: var(--template-primary, #ffffff) !important');

// Write back
fs.writeFileSync(cssPath, css, 'utf8');
console.log('CSS Variables injected successfully.');
