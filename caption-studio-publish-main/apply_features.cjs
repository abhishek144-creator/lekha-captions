const fs = require('fs');
const path = require('path');

// --- 1. Fix PREVIEW_WORDS in TemplatesTab.jsx ---
const tabPath = path.join(__dirname, 'src/components/dashboard/TemplatesTab.jsx');
let tabJsx = fs.readFileSync(tabPath, 'utf8');

const newPreviewWords = `const PREVIEW_WORDS = [
  { text: 'This', classes: 'word active' },
  { text: 'IS', classes: 'word active imp' },
  { text: 'great', classes: 'word current' },
  { text: 'now', classes: 'word' },
];`;
tabJsx = tabJsx.replace(/const PREVIEW_WORDS = \[\s*\{ text: 'This', classes: 'word active' \},\s*\{ text: 'IS', classes: 'word active imp' \},\s*\{ text: 'great', classes: 'word' \},\s*\];/g, newPreviewWords);

// --- 2. Add features arrays to templates in TemplatesTab.jsx based on what they actually use ---
const templateFeaturesMap = {
    't-109': ['primary', 'secondary', 'highlight'], // 3D shadow needs secondary
    't-26': ['primary', 'secondary', 'highlight'], // Stroke pop needs secondary
    't-102': ['primary', 'bg', 'highlight'], // Pill bg needs bg
    't-36': ['primary', 'secondary', 'highlight'], // Color flash green needs secondary
    't-105': ['primary', 'highlight'], // Daze
    't-9': ['highlight'], // Fire Words (mostly hardcoded)
    't-124': ['primary', 'highlight'], // Ghost Echo
    't-16': ['primary', 'highlight'], // Ghost Focus
    't-110': ['primary', 'secondary', 'highlight'], // Glow Dot needs secondary
    't-119': ['primary', 'bg', 'highlight'], // Gradient Box needs bg (or secondary)
    't-12': ['primary', 'secondary', 'highlight'], // Horror needs secondary for glow
    't-106': ['primary', 'highlight'], // Iman
    't-52': ['primary', 'highlight'], // Light Streak
    't-103': ['primary', 'bg', 'highlight'], // Nightfall needs bg
    't-112': ['highlight'], // Pink Gradient (hardcoded gradient)
    't-104': ['primary', 'secondary', 'highlight'], // Pulse needs secondary
    't-111': ['primary', 'secondary', 'highlight'], // Block Stamp needs secondary for red box
    't-T5': ['primary', 'bg', 'highlight'], // Sentence Box needs bg
    't-95': ['secondary', 'highlight'], // Speed Lines
    't-T1': ['primary', 'highlight'], // Stack & Flow
    't-T4': ['primary', 'highlight'], // Study With Me
    't-56': ['primary', 'secondary', 'highlight'], // Underline needs secondary
    't-T3': ['primary', 'highlight'], // Underline Fade
    't-37': ['primary', 'highlight'], // Wipe Mask
};

// We will inject a mapping lookup in the Customization panel instead of editing the massive array
const injectedMapStr = `const TEMPLATE_FEATURES = ${JSON.stringify(templateFeaturesMap)};`;

if (!tabJsx.includes('TEMPLATE_FEATURES')) {
    tabJsx = tabJsx.replace('const TemplateCustomizationPanel = ({ style, defaultTemplateStyle, onUpdate }) => {', injectedMapStr + '\n\nconst TemplateCustomizationPanel = ({ style, defaultTemplateStyle, onUpdate }) => {');

    // Modify TemplateCustomizationPanel to only show relevant pickers
    tabJsx = tabJsx.replace(
        '<CustomColorPicker \n          label="Primary"',
        `{(TEMPLATE_FEATURES[style?.template_id] || ['primary', 'secondary', 'bg', 'highlight']).includes('primary') && <CustomColorPicker 
          label="Primary"`
    );
    tabJsx = tabJsx.replace(
        `onReset={() => onUpdate({ text_color: defaultTemplateStyle.text_color || '#FFFFFF' })}
        />`,
        `onReset={() => onUpdate({ text_color: defaultTemplateStyle.text_color || '#FFFFFF' })}
        />}`
    );

    tabJsx = tabJsx.replace(
        '<CustomColorPicker \n          label="Secondary"',
        `{(TEMPLATE_FEATURES[style?.template_id] || ['primary', 'secondary', 'bg', 'highlight']).includes('secondary') && <CustomColorPicker 
          label="Secondary"`
    );
    tabJsx = tabJsx.replace(
        `onReset={() => onUpdate({ secondary_color: defaultTemplateStyle.secondary_color || '#000000' })}
        />`,
        `onReset={() => onUpdate({ secondary_color: defaultTemplateStyle.secondary_color || '#000000' })}
        />}`
    );

    tabJsx = tabJsx.replace(
        '<CustomColorPicker \n          label="Background"',
        `{(TEMPLATE_FEATURES[style?.template_id] || ['primary', 'secondary', 'bg', 'highlight']).includes('bg') && <CustomColorPicker 
          label="Background"`
    );
    tabJsx = tabJsx.replace(
        `onReset={() => onUpdate({ background_color: defaultTemplateStyle.background_color || '#000000' })}
        />`,
        `onReset={() => onUpdate({ background_color: defaultTemplateStyle.background_color || '#000000' })}
        />}`
    );

    tabJsx = tabJsx.replace(
        '<CustomColorPicker \n          label="Highlight Color"',
        `{(TEMPLATE_FEATURES[style?.template_id] || ['primary', 'secondary', 'bg', 'highlight']).includes('highlight') && <CustomColorPicker 
          label="Highlight Color"`
    );
    tabJsx = tabJsx.replace(
        `onReset={() => onUpdate({ highlight_color: defaultTemplateStyle.highlight_color || '#FFE600' })}
        />`,
        `onReset={() => onUpdate({ highlight_color: defaultTemplateStyle.highlight_color || '#FFE600' })}
        />}`
    );
}

fs.writeFileSync(tabPath, tabJsx, 'utf8');

// --- 3. Update captionTemplates.css to actually USE --template-secondary and --template-bg for these templates ---
const cssPath = path.join(__dirname, 'src/styles/captionTemplates.css');
let css = fs.readFileSync(cssPath, 'utf8');

// Glow Dot (t-110)
css = css.replace(/background: #00FFAA;/g, 'background: var(--template-secondary, #00FFAA);');
css = css.replace(/box-shadow: 0 0 8px #00FFAA/g, 'box-shadow: 0 0 8px var(--template-secondary, #00FFAA)');

// Pulse (t-104)
css = css.replace(/-webkit-text-stroke: 2px #B28DFF !important/g, '-webkit-text-stroke: 2px var(--template-secondary, #B28DFF) !important');
css = css.replace(/drop-shadow\(0 0 6px rgba\([^)]+\)\)/g, 'drop-shadow(0 0 6px var(--template-secondary, #B28DFF))');

// Block Stamp (t-111, was Red tape)
css = css.replace(/background: #E60000 !important;/g, 'background: var(--template-secondary, #E60000) !important;');

// 3D Shadow (t-109)
css = css.replace(/text-shadow: 3px 3px 0 rgba\(255, 69, 0, \.4\) !important/g, 'text-shadow: 3px 3px 0 var(--template-secondary, rgba(255, 69, 0, .4)) !important');
css = css.replace(/text-shadow: 3px 3px 0 #FF4500 !important/g, 'text-shadow: 3px 3px 0 var(--template-secondary, #FF4500) !important');

// Underline (t-56)
css = css.replace(/border-bottom: 3px solid #00ffb3/g, 'border-bottom: 3px solid var(--template-secondary, #00ffb3)');

// Color Flash (t-36)
css = css.replace(/color: #00ffb3 !important;/g, 'color: var(--template-secondary, #00ffb3) !important;');

// Horror (t-12)
css = css.replace(/text-shadow: 0 0 18px #c00 !important/g, 'text-shadow: 0 0 18px var(--template-secondary, #c00) !important');

// Speed Lines (t-95)
css = css.replace(/text-shadow: -3px 0 #0055FF, -7px 0 #00AAFF !important/g, 'text-shadow: -3px 0 var(--template-secondary, #0055FF), -7px 0 var(--template-secondary, #00AAFF) !important');

// Nightfall (t-103)
css = css.replace(/background: rgba\(30, 30, 30, \.85\);/g, 'background: var(--template-bg, rgba(30, 30, 30, .85));');

// Clarity (t-102)
css = css.replace(/background: #E8E8E8;/g, 'background: var(--template-bg, #E8E8E8);');

// Sentence Box (t-T5)
css = css.replace(/background: var\(--template-highlight, #FFE600\);/g, 'background: var(--template-bg, #FFE600);');

fs.writeFileSync(cssPath, css, 'utf8');
console.log('Features mapping script complete.');
