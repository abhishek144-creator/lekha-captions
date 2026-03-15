const fs = require('fs');
const path = require('path');

const jsxPath = path.join(__dirname, 'src/components/dashboard/TemplatesTab.jsx');
let jsx = fs.readFileSync(jsxPath, 'utf8');

// 1. Add missing Lucide icons (RotateCcw, SlidersHorizontal, Type)
if (!jsx.includes('RotateCcw')) {
  jsx = jsx.replace('import { Sparkles, Check, X } from \'lucide-react\';', 'import { Sparkles, Check, X, RotateCcw, SlidersHorizontal, Type, DropdownMenu } from \'lucide-react\';');
}

// 2. Add the Customization Panel Component
const panelCode = `
const CustomColorPicker = ({ label, value, onChange, onReset, defaultColor }) => (
  <div className="flex items-center justify-between mb-3">
    <span className="text-xs text-gray-400">{label}</span>
    <div className="flex items-center gap-2">
      <div className="flex items-center bg-[#1F2022] rounded-lg p-1 pr-3 border border-white/5">
        <div className="relative w-6 h-6 rounded overflow-hidden mr-2 border border-white/10">
          <input
            type="color"
            value={value || defaultColor || '#FFFFFF'}
            onChange={(e) => onChange(e.target.value)}
            className="absolute -top-2 -left-2 w-10 h-10 cursor-pointer"
          />
        </div>
        <span className="text-xs text-gray-300 font-mono">{(value || defaultColor || '#FFFFFF').toUpperCase()}</span>
      </div>
      <button 
        onClick={onReset}
        className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#1F2022] border border-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
        title="Reset to default"
      >
        <RotateCcw className="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
);

const TemplateCustomizationPanel = ({ style, defaultTemplateStyle, onUpdate }) => {
  return (
    <div className="mt-3 px-4 py-3 bg-[#111111] rounded-lg border border-white/5">
      <div className="mb-4">
        <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Colors</h4>
        <CustomColorPicker 
          label="Primary" 
          value={style.text_color} 
          defaultColor={defaultTemplateStyle.text_color || '#FFFFFF'}
          onChange={(val) => onUpdate({ text_color: val })}
          onReset={() => onUpdate({ text_color: defaultTemplateStyle.text_color || '#FFFFFF' })}
        />
        <CustomColorPicker 
          label="Secondary" 
          value={style.secondary_color} 
          defaultColor={defaultTemplateStyle.secondary_color || '#000000'}
          onChange={(val) => onUpdate({ secondary_color: val })}
          onReset={() => onUpdate({ secondary_color: defaultTemplateStyle.secondary_color || '#000000' })}
        />
        <CustomColorPicker 
          label="Background" 
          value={style.background_color} 
          defaultColor={defaultTemplateStyle.background_color || '#000000'}
          onChange={(val) => onUpdate({ background_color: val })}
          onReset={() => onUpdate({ background_color: defaultTemplateStyle.background_color || '#000000' })}
        />
      </div>

      <div className="mb-2">
        <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Emphasis</h4>
        <CustomColorPicker 
          label="Highlight Color" 
          value={style.highlight_color} 
          defaultColor={defaultTemplateStyle.highlight_color || '#FFE600'}
          onChange={(val) => onUpdate({ highlight_color: val })}
          onReset={() => onUpdate({ highlight_color: defaultTemplateStyle.highlight_color || '#FFE600' })}
        />
      </div>
      
      {/* Box Size Sliders (Optional/Future for some templates) */}
      <div className="mt-4 pt-3 border-t border-white/5 hidden">
         <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Box Size</h4>
         {/* Implement sliders for padding_x and padding_y if needed */}
      </div>
    </div>
  );
};
`;

if (!jsx.includes('TemplateCustomizationPanel')) {
  // Insert before 'export default function TemplatesTab'
  jsx = jsx.replace('export default function TemplatesTab', panelCode + '\nexport default function TemplatesTab');
}

// 3. Inject the CSS Variables into the Preview Container
// Find the preview render block:
// className={template.id} -> className={template.id} style={{ '--template-primary': currentStyle.text_color, ... }}

// We need to inject the CSS variables onto the preview container so the live preview uses the user's tweaked colors.
const styleInjectionCode = `style={{
                  backgroundColor: template.bg,
                  padding: '10px 16px',
                  display: 'flex',
                  justifyContent: 'center',
                  minHeight: '44px',
                  alignItems: 'center',
                  '--template-primary': currentStyle?.text_color || template.style?.text_color || '#fff',
                  '--template-secondary': currentStyle?.secondary_color || template.style?.secondary_color || '#000',
                  '--template-bg': currentStyle?.background_color || template.style?.background_color || 'transparent',
                  '--template-highlight': currentStyle?.highlight_color || template.style?.highlight_color || '#FFE600'
                }}`;

jsx = jsx.replace(/style=\{\{\s*backgroundColor:\s*template\.bg,\s*padding:\s*'10px 16px',\s*display:\s*'flex',\s*justifyContent:\s*'center',\s*minHeight:\s*'44px',\s*alignItems:\s*'center',\s*\}\}/g, styleInjectionCode);

// 4. Render the Customization Panel inside the active template card
const renderPanelCode = `
              {/* ── INFO ROW ── */}
              <div className="px-3 py-2 flex items-center justify-between">
                <div>
                  <h3 className="text-sm text-white font-medium flex items-center gap-1.5">
                    {template.name}
                    {isActive && <Check className="w-3.5 h-3.5 text-purple-400" />}
                  </h3>
                  <p className="text-[10px] text-gray-500">{template.desc}</p>
                </div>
                {!isActive && (
                  <button
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 border border-purple-500/30 flex items-center gap-1 transition-colors"
                    onClick={(e) => { e.stopPropagation(); onApplyTemplate(template.style); }}
                  >
                    <Sparkles className="w-3 h-3" />
                    Apply
                  </button>
                )}
              </div>
              
              {/* ── CUSTOMIZATION PANEL (ACTIVE ONLY) ── */}
              {isActive && (
                <div onClick={(e) => e.stopPropagation()} className="px-2 pb-2">
                  <TemplateCustomizationPanel 
                    style={currentStyle} 
                    defaultTemplateStyle={template.style}
                    onUpdate={(newStyleProps) => {
                      onApplyTemplate({ ...currentStyle, ...newStyleProps });
                    }} 
                  />
                </div>
              )}
`;

jsx = jsx.replace(/{\/\*\s*── INFO ROW ──\s*\*\/}[\s\S]*?<\/div>\s*<\/motion\.div>/g, renderPanelCode + '\n            </motion.div>');

fs.writeFileSync(jsxPath, jsx, 'utf8');
console.log('TemplatesTab updated successfully.');
