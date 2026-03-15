const fs = require('fs');
const path = require('path');

// 1. TemplatesTab.jsx
const tabPath = path.join(__dirname, 'src/components/dashboard/TemplatesTab.jsx');
let tabJsx = fs.readFileSync(tabPath, 'utf8');

// Fix the live preview style injection
const oldStyles = `'--template-primary': currentStyle?.text_color || template.style?.text_color || '#fff',
                  '--template-secondary': currentStyle?.secondary_color || template.style?.secondary_color || '#000',
                  '--template-bg': currentStyle?.background_color || template.style?.background_color || 'transparent',
                  '--template-highlight': currentStyle?.highlight_color || template.style?.highlight_color || '#FFE600'`;

const newStyles = `'--template-primary': isActive ? (currentStyle?.text_color || template.style?.text_color || '#fff') : (template.style?.text_color || '#fff'),
                  '--template-secondary': isActive ? (currentStyle?.secondary_color || template.style?.secondary_color || '#000') : (template.style?.secondary_color || '#000'),
                  '--template-bg': isActive ? (currentStyle?.background_color || template.style?.background_color || 'transparent') : (template.style?.background_color || 'transparent'),
                  '--template-highlight': isActive ? (currentStyle?.highlight_color || template.style?.highlight_color || '#FFE600') : (template.style?.highlight_color || '#FFE600')`;

tabJsx = tabJsx.replace(oldStyles, newStyles);

// Fix UI Toggle (Consolidate to a single Word By Word Delivery toggle)
const oldTogglesBlock = `{/* Word by word toggle. Maps to style.animation = 'word-by-word' rather than full sentence fade */}
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
        />`;

const newTogglesBlock = `<CustomToggle
          label="Word by Word Delivery"
          description={style.show_inactive === false ? "Words appear one by one as spoken" : "Complete sentence is visible on screen"}
          checked={style.show_inactive === false}
          onChange={(val) => onUpdate({ show_inactive: !val })}
        />`;

tabJsx = tabJsx.replace(oldTogglesBlock, newTogglesBlock);

// Overwrite Clarity template default bg in the map
tabJsx = tabJsx.replace(
    `{ id: 't-102', name: 'Clarity',
    desc: 'Clean light bg, dark readable text',
    bg: '#E8E8E8',
    style: { template_id: 't-102', font_family: 'Noto Sans', font_size: 22, font_weight: '800', position_y: 75, secondary_color: '#1F2022' }
  }`,
    `{ id: 't-102', name: 'Clarity',
    desc: 'Clean light bg, dark readable text',
    bg: '#FFFFFF',
    style: { template_id: 't-102', font_family: 'Noto Sans', font_size: 22, font_weight: '800', position_y: 75, secondary_color: '#1F2022', background_color: '#FFFFFF' }
  }`
);

fs.writeFileSync(tabPath, tabJsx, 'utf8');

// 2. captionTemplates.css
const cssPath = path.join(__dirname, 'src/styles/captionTemplates.css');
let css = fs.readFileSync(cssPath, 'utf8');

css = css.replace(/background: var\(--template-bg, #E8E8E8\);/g, 'background: var(--template-bg, #FFFFFF);');

fs.writeFileSync(cssPath, css, 'utf8');

// 3. VideoPlayer.jsx
// Ensure 'show_inactive' accurately hides inactive words without using 'display_mode' which was causing bugs earlier
const videoPath = path.join(__dirname, 'src/components/dashboard/VideoPlayer.jsx');
let videoJsx = fs.readFileSync(videoPath, 'utf8');

videoJsx = videoJsx.replace(
    `display: (captionStyle?.display_mode === 'word_by_word' && !isActiveWord) ? 'none' : 'inline-block',
                                  opacity: (captionStyle?.show_inactive === false && hasTemplate && !isActiveWord && !isDoneWord) ? 0 : 1,`,
    `display: 'inline-block',
                                  opacity: (captionStyle?.show_inactive === false && hasTemplate && !isActiveWord && !isDoneWord) ? 0 : 1,`
);

fs.writeFileSync(videoPath, videoJsx, 'utf8');

console.log('UI updates applied.');
