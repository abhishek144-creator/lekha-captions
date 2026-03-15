const fs = require('fs');
const path = require('path');

// 1. Update TemplateCustomizationPanel in TemplatesTab.jsx to include Toggles
const tabPath = path.join(__dirname, 'src/components/dashboard/TemplatesTab.jsx');
let tabJsx = fs.readFileSync(tabPath, 'utf8');

// Ensure Toggle is a known lucide-react icon OR we just use a generic Switch if we don't have a UI component.
// We'll build a custom Toggle Switch using simple Tailwind
const toggleComponentCode = `
const CustomToggle = ({ label, checked, onChange, description }) => (
  <div className="flex items-center justify-between mb-3 group">
    <div>
      <span className="text-xs text-gray-300 font-medium">{label}</span>
      {description && <p className="text-[9px] text-gray-500 mt-0.5">{description}</p>}
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={\`relative inline-flex h-4 w-7 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none \${checked ? 'bg-purple-500' : 'bg-gray-700'}\`}
    >
      <span
        aria-hidden="true"
        className={\`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out \${checked ? 'translate-x-3' : 'translate-x-0'}\`}
      />
    </button>
  </div>
);
`;

if (!tabJsx.includes('CustomToggle')) {
    tabJsx = tabJsx.replace('const CustomColorPicker =', toggleComponentCode + '\nconst CustomColorPicker =');
}

// Add the toggles below Emphasis in TemplateCustomizationPanel
const togglesBlock = `
      <div className="mb-2 mt-4 pt-4 border-t border-white/5">
        <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Animation & Display</h4>
        
        {/* Word by word toggle. Maps to style.animation = 'word-by-word' rather than full sentence fade */}
        <CustomToggle
          label="Word by Word Animation"
          description="Words pop in one by one"
          checked={style.display_mode === 'word_by_word' || style.animation !== 'none'}
          onChange={(val) => onUpdate({ 
            display_mode: val ? 'word_by_word' : 'sentence',
            animation: val ? 'pop' : 'none'
          })}
        />

        {/* Show inactive words prior to being spoken */}
        <CustomToggle
          label="Show Inactive Words"
          description="Display upcoming words dimly"
          checked={style.show_inactive !== false}
          onChange={(val) => onUpdate({ show_inactive: val })}
        />
      </div>`;

if (!tabJsx.includes('Animation & Display')) {
    tabJsx = tabJsx.replace(
        /\{\/\* Box Size Sliders \(Optional\/Future for some templates\) \*\/\}/,
        togglesBlock + '\n\n      {/* Box Size Sliders (Optional/Future for some templates) */}'
    );
}

// Ensure Clarity (t-102) and Glow Dot (t-110) use Secondary color instead of just Primary
// We previously mapped t-102 to 'primary', 'bg', 'highlight'. The user wants 'Secondary' (for inactive words).
tabJsx = tabJsx.replace(
    '"t-102":["primary","bg","highlight"]',
    '"t-102":["primary","secondary","bg","highlight"]'
);
tabJsx = tabJsx.replace(
    `{ id: 't-102', name: 'Clarity',
    desc: 'Clean light bg, dark readable text',
    bg: '#E8E8E8',
    style: { template_id: 't-102', font_family: 'Noto Sans', font_size: 22, font_weight: '800', position_y: 75 }
  }`,
    `{ id: 't-102', name: 'Clarity',
    desc: 'Clean light bg, dark readable text',
    bg: '#E8E8E8',
    style: { template_id: 't-102', font_family: 'Noto Sans', font_size: 22, font_weight: '800', position_y: 75, secondary_color: '#1F2022' }
  }`
);

// Glow Dot (t-110) default glow color to Blue
tabJsx = tabJsx.replace(
    `{ id: 't-110', name: 'Glow Dot',
    desc: 'Glowing green dot under active word',
    bg: '#111',
    style: { template_id: 't-110', font_family: 'Noto Sans', font_size: 24, font_weight: '800', position_y: 75 }
  }`,
    `{ id: 't-110', name: 'Glow Dot',
    desc: 'Glowing blue dot under active word',
    bg: '#111',
    style: { template_id: 't-110', font_family: 'Noto Sans', font_size: 24, font_weight: '800', position_y: 75, secondary_color: '#0055FF' }
  }`
);

fs.writeFileSync(tabPath, tabJsx, 'utf8');

// 2. Update VideoPlayer to respect 'show_inactive'
const videoPath = path.join(__dirname, 'src/components/dashboard/VideoPlayer.jsx');
let videoJsx = fs.readFileSync(videoPath, 'utf8');

// The active vs inactive logic in VideoPlayer is around line 1500
// let wordClass = 'word'; ... if (!isPast) wordClass = 'word';
// If style.show_inactive === false, we need to hide the inactive words completely!
// We can add inline style opacity: 0 or display: none if show_inactive is false AND isPast is false (and not current).

const opacityInjection = `style={{
                              padding: \`0 \${captionStyle?.word_spacing || 2}px\`,
                              display: 'inline-block',
                              opacity: (captionStyle?.show_inactive === false && wordClass === 'word') ? 0 : '',
                            }}`;

videoJsx = videoJsx.replace(
    /<span\s*key=\{wIdx\}\s*className=\{wIdx === currentWordIndex \? \`\$\{wordClass\} current\` : wordClass\}\s*style=\{\{\s*padding: \`0 \$\{\w+\?.word_spacing \|\| 2\}px\`,\s*display: 'inline-block'\s*\}\}\s*>/g,
    `<span
                            key={wIdx}
                            className={wIdx === currentWordIndex ? \`\${wordClass} current\` : wordClass}
                            style={{
                              padding: \`0 \${captionStyle?.word_spacing || 2}px\`,
                              display: 'inline-block',
                              opacity: (captionStyle?.show_inactive === false && wordClass === 'word' && wIdx !== currentWordIndex) ? 0 : 1,
                            }}
                          >`
);

fs.writeFileSync(videoPath, videoJsx, 'utf8');

// 3. Update captionTemplates.css to apply text_color and secondary_color accurately
const cssPath = path.join(__dirname, 'src/styles/captionTemplates.css');
let css = fs.readFileSync(cssPath, 'utf8');

// Clarity (t-102) user wants secondary_color for inactive words (#888) and primary for active (#000)
css = css.replace(/.t-102 .word \{\n  color: #888 !important\n\}/g, '.t-102 .word {\n  color: var(--template-secondary, #888) !important\n}');
css = css.replace(/.t-102 .word.active \{\n  color: #000 !important\n\}/g, '.t-102 .word.active {\n  color: var(--template-primary, #000) !important\n}');
// Glow Dot (t-110)
// The glow dot color was changed to --template-secondary in previous step, so default is now set in TemplatesTab

fs.writeFileSync(cssPath, css, 'utf8');

console.log('Toggles and CSS values updated successfully.');
