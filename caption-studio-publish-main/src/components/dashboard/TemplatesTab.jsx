import React from 'react';
import { Sparkles, Check, X, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { motion } from 'framer-motion';
import '../../styles/captionTemplates.css';

/*
  Each template corresponds to a CSS class in captionTemplates.css.
  The live preview renders actual CSS class-based word states so the
  user sees the exact visual effect before applying.
*/
const templates = [
  {
    id: 't-115', name: 'Green Neon Pulse',
    desc: 'White text with pulsing green active glow',
    bg: '#111',
    style: { template_id: 't-115', font_family: 'Noto Sans', font_size: 28, font_weight: '900', font_style: 'italic', position_y: 75, text_color: '#FFFFFF', secondary_color: '#39FF14' }
  },
  {
    id: 't-109', name: '3D Shadow',
    desc: 'White text with bold orange 3D shadow on active',
    bg: '#1a1a1a',
    style: { template_id: 't-109', font_family: 'Noto Sans', font_size: 26, font_weight: '900', position_y: 75, secondary_color: '#E01A1A' }
  },
  {
    id: 't-26', name: 'Bold Stroke',
    desc: 'Light bg, black bold text with pink 3D shadow',
    bg: '#e8e8e8',
    style: { template_id: 't-26', font_family: 'Bangers', font_size: 28, font_weight: '900', text_case: 'uppercase', position_y: 75, secondary_color: '#ff2058', background_color: '#e8e8e8' }
  },
  {
    id: 't-102', name: 'Clarity',
    desc: 'Clean light bg, dark readable text',
    bg: '#FFFFFF',
    style: { template_id: 't-102', font_family: 'Noto Sans', font_size: 22, font_weight: '800', position_y: 75, secondary_color: '#1F2022', background_color: '#FFFFFF' }
  },
  {
    id: 't-36', name: 'Color Flash',
    desc: 'Invisible until spoken — active word flashes in colour',
    bg: '#111',
    style: { template_id: 't-36', font_family: 'Noto Sans', font_size: 26, font_weight: '900', position_y: 75, secondary_color: '#00ffb3' }
  },
  {
    id: 't-105', name: 'Daze',
    desc: 'White stroked, yellow glow on speak',
    bg: '#111',
    style: { template_id: 't-105', font_family: 'Noto Sans', font_size: 24, font_weight: '800', position_y: 75 }
  },
  {
    id: 't-9', name: 'Fire Words',
    desc: 'Words ignite in fire orange glow',
    bg: '#1a0500',
    style: { template_id: 't-9', font_family: 'Noto Sans', font_size: 26, font_weight: '900', text_case: 'uppercase', position_y: 75 }
  },
  {
    id: 't-124', name: 'Ghost Echo',
    desc: 'Fade in with ghost echo shadow trail',
    bg: '#111',
    style: { template_id: 't-124', font_family: 'Inter', font_size: 26, font_weight: '900', position_y: 75 }
  },
  {
    id: 't-16', name: 'Ghost Focus',
    desc: 'Blurred inactive words, sharp spotlight on spoken',
    bg: '#111',
    style: { template_id: 't-16', font_family: 'Playfair Display', font_size: 24, font_weight: '700', font_style: 'italic', position_y: 75 }
  },
  {
    id: 't-110', name: 'Glow Dot',
    desc: 'Glowing dot under active word',
    bg: '#111',
    style: { template_id: 't-110', font_family: 'Noto Sans', font_size: 24, font_weight: '800', position_y: 75, secondary_color: '#0066FF' }
  },
  {
    id: 't-119', name: 'Gradient Box',
    desc: 'Active word gets blue-cyan gradient box',
    bg: '#111',
    style: { template_id: 't-119', font_family: 'Inter', font_size: 24, font_weight: '800', position_y: 75 }
  },
  {
    id: 't-12', name: 'Horror',
    desc: 'Typewriter font, blood-red glow',
    bg: '#000',
    style: { template_id: 't-12', font_family: 'Special Elite', font_size: 22, position_y: 75 }
  },
  {
    id: 't-106', name: 'Iman',
    desc: 'Words hidden until spoken — clean instant reveal',
    bg: '#111',
    style: { template_id: 't-106', font_family: 'Noto Sans', font_size: 24, font_weight: '800', position_y: 75 }
  },
  {
    id: 't-52', name: 'Light Streak',
    desc: 'Words rise into view as spoken',
    bg: '#111',
    style: { template_id: 't-52', font_family: 'Inter', font_size: 26, font_weight: '900', position_y: 75 }
  },
  {
    id: 't-103', name: 'Nightfall',
    desc: 'Muted words on dark bg, spotlight on speak',
    bg: '#1e1e1e',
    style: { template_id: 't-103', font_family: 'Noto Sans', font_size: 22, font_weight: '800', position_y: 75 }
  },
  {
    id: 't-112', name: 'Pink Gradient',
    desc: 'Hot pink-to-coral gradient text reveal',
    bg: '#111',
    style: { template_id: 't-112', font_family: 'Noto Sans', font_size: 25, font_weight: '900', position_y: 75 }
  },
  {
    id: 't-104', name: 'Pulse',
    desc: 'White text with purple stroke glow',
    bg: '#111',
    style: { template_id: 't-104', font_family: 'Noto Sans', font_size: 26, font_weight: '900', position_y: 75 }
  },
  {
    id: 't-111', name: 'Red Tape',
    desc: 'Bold red box snaps onto each spoken word',
    bg: '#111',
    style: { template_id: 't-111', font_family: 'Inter', font_size: 22, font_weight: '900', position_y: 75, secondary_color: '#E60000' }
  },
  {
    id: 't-T5', name: 'Sentence Box',
    desc: 'Deep yellow pad box for all words',
    bg: '#111',
    style: { template_id: 't-T5', font_family: 'Montserrat', font_size: 24, font_weight: '800', font_style: 'italic', background_color: '#ECF00F', text_color: '#333333', position_y: 75 }
  },
  {
    id: 't-95', name: 'Speed Lines',
    desc: 'Skewed font with blue speed streaks',
    bg: '#111',
    style: { template_id: 't-95', font_family: 'Montserrat', font_size: 30, position_y: 75 }
  },
  {
    id: 't-T1', name: 'Stack & Flow',
    desc: 'Italic serif, words stack then flow in',
    bg: '#0d1b2a',
    style: { template_id: 't-T1', font_family: 'Noto Sans', font_size: 30, font_style: 'italic', position_y: 75 }
  },
  {
    id: 't-T4', name: 'Study With Me',
    desc: 'Soft pink italic serif on dark bg',
    bg: '#1a0e14',
    style: { template_id: 't-T4', font_family: 'Playfair Display', font_size: 24, font_style: 'italic', position_y: 75 }
  },
  {
    id: 't-56', name: 'Underline',
    desc: 'Active word gets a blue bottom border',
    bg: '#111',
    style: { template_id: 't-56', font_family: 'Inter', font_size: 26, font_weight: '900', position_y: 75, secondary_color: '#0066FF' }
  },
  {
    id: 't-T3', name: 'Underline Fade',
    desc: 'Words fade in, key words get green underline',
    bg: '#0a0a0a',
    style: { template_id: 't-T3', font_family: 'Montserrat', font_size: 22, font_weight: '400', position_y: 75 }
  },
  {
    id: 't-57', name: 'VHS Glitch',
    desc: 'Flicker-on reveal with chromatic aberration',
    bg: '#111',
    style: { template_id: 't-57', font_family: 'Inter', font_size: 26, font_weight: '900', position_y: 75 }
  },
  {
    id: 't-37', name: 'Wipe Mask',
    desc: 'Pink uppercase text wipes in from left',
    bg: '#111',
    style: { template_id: 't-37', font_family: 'Inter', font_size: 26, font_weight: '900', text_case: 'uppercase', position_y: 75 }
  }
];

// Live preview words — shows done, active, done+imp states
// word 1 "This" = done (already spoken), word 2 "IS" = done+imp (important spoken), word 3 "great" = active (current), word 4 "now" = upcoming
const PREVIEW_WORDS = [
  { text: 'This', classes: 'word active' },
  { text: 'IS', classes: 'word active imp' },
  { text: 'great', classes: 'word current' },
  { text: 'now', classes: 'word' },
];



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
      className={`relative inline-flex h-4 w-7 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${checked ? 'bg-purple-500' : 'bg-gray-700'}`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-3' : 'translate-x-0'}`}
      />
    </button>
  </div>
);

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

const TEMPLATE_FEATURES = { "t-115": ["primary", "secondary", "highlight"], "t-109": ["primary", "secondary", "highlight"], "t-26": ["primary", "secondary", "bg", "highlight"], "t-102": ["primary", "bg", "highlight"], "t-36": ["primary", "secondary", "highlight"], "t-105": ["primary", "highlight"], "t-9": ["highlight"], "t-124": ["primary", "highlight"], "t-16": ["primary", "highlight"], "t-110": ["primary", "secondary", "highlight"], "t-119": ["primary", "bg", "highlight"], "t-12": ["primary", "secondary", "highlight"], "t-106": ["primary", "highlight"], "t-52": ["primary", "highlight"], "t-103": ["primary", "bg", "highlight"], "t-112": ["highlight"], "t-104": ["primary", "secondary", "highlight"], "t-111": ["primary", "secondary", "highlight"], "t-T5": ["primary", "bg"], "t-95": ["secondary", "highlight"], "t-T1": ["primary", "highlight"], "t-T4": ["primary", "highlight"], "t-56": ["primary", "secondary", "highlight"], "t-T3": ["primary", "highlight"], "t-57": ["primary", "highlight"], "t-37": ["primary", "highlight"] };

const TemplateCustomizationPanel = ({ style, defaultTemplateStyle, onUpdate }) => {
  const currentFeatures = TEMPLATE_FEATURES[style?.template_id] || ['primary', 'secondary', 'bg', 'highlight'];

  return (
    <div className="mt-3 px-4 py-3 bg-[#111111] rounded-lg border border-white/5">
      <div className="mb-4">
        <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Colors</h4>
        {currentFeatures.includes('primary') && (
          <CustomColorPicker
            label="Primary"
            value={style.text_color}
            defaultColor={defaultTemplateStyle?.text_color || '#FFFFFF'}
            onChange={(val) => onUpdate({ text_color: val })}
            onReset={() => onUpdate({ text_color: defaultTemplateStyle?.text_color || '#FFFFFF' })}
          />
        )}
        {currentFeatures.includes('secondary') && (
          <CustomColorPicker
            label="Secondary"
            value={style.secondary_color}
            defaultColor={defaultTemplateStyle?.secondary_color || '#000000'}
            onChange={(val) => onUpdate({ secondary_color: val })}
            onReset={() => onUpdate({ secondary_color: defaultTemplateStyle?.secondary_color || '#000000' })}
          />
        )}
        {currentFeatures.includes('bg') && (
          <CustomColorPicker
            label="Background"
            value={style.background_color}
            defaultColor={defaultTemplateStyle?.background_color || '#000000'}
            onChange={(val) => onUpdate({ background_color: val })}
            onReset={() => onUpdate({ background_color: defaultTemplateStyle?.background_color || '#000000' })}
          />
        )}
      </div>

      {currentFeatures.includes('highlight') && (
        <div className="mb-2">
          <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3 hidden">Emphasis</h4>
          <CustomColorPicker
            label="Highlight Color"
            value={style.highlight_color}
            defaultColor={defaultTemplateStyle?.highlight_color || '#FFE600'}
            onChange={(val) => onUpdate({ highlight_color: val })}
            onReset={() => onUpdate({ highlight_color: defaultTemplateStyle?.highlight_color || '#FFE600' })}
          />
        </div>
      )}


      <div className="mb-2 mt-4 pt-4 border-t border-white/5">
        <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Animation & Display</h4>

        <CustomToggle
          label="Word by Word Delivery"
          description={style.show_inactive === false ? "Words appear one by one as spoken" : "Complete sentence is visible on screen"}
          checked={style.show_inactive === false}
          onChange={(val) => onUpdate({ show_inactive: !val })}
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

export default function TemplatesTab({ currentStyle, onApplyTemplate }) {
  if (!onApplyTemplate) return null;

  const handleClearTemplate = () => {
    // Full reset to original default state — clears all template AND custom overrides
    onApplyTemplate({
      template_id: '',
      font_family: 'Inter',
      font_size: 18,
      font_weight: '500',
      font_style: 'normal',
      line_spacing: 1.4,
      word_spacing: 1,
      is_bold: false,
      is_caps: false,
      text_case: 'none',
      text_align: 'center',
      text_color: '#ffffff',
      text_gradient: '',
      text_opacity: 1,
      highlight_color: '',
      highlight_gradient: '',
      secondary_color: '',
      has_background: true,
      background_color: '#000000',
      background_opacity: 0.7,
      background_padding: 6,
      background_h_multiplier: 0.99,
      has_stroke: false,
      has_shadow: false,
      has_animation: false,
      position: 'bottom',
      position_y: 75,
      show_inactive: undefined,
      scale: 1,
    });
  };

  return (
    <div className="h-full overflow-y-auto pr-1 custom-scrollbar">
      <div className="mb-3">
        <h2 className="text-base font-semibold text-white mb-0.5">Caption Templates</h2>
        <p className="text-[11px] text-gray-500">26 templates — yellow = important word</p>
      </div>

      {/* ── NONE / REMOVE OPTION ── always visible at top */}
      <motion.div
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        onClick={handleClearTemplate}
        className={`mb-3 rounded-xl border cursor-pointer transition-all overflow-hidden ${!currentStyle?.template_id
          ? 'border-[#F5A623] bg-[#F5A623]/10 shadow-[0_0_10px_rgba(74,222,128,0.12)]'
          : 'border-white/10 bg-white/[0.03] hover:border-white/20'
          }`}
      >
        <div className="px-4 py-3 flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${!currentStyle?.template_id ? 'bg-[#F5A623]/20' : 'bg-white/5'}`}>
            <X className={`w-4 h-4 ${!currentStyle?.template_id ? 'text-[#F5A623]' : 'text-gray-500'}`} />
          </div>
          <div>
            <p className={`text-sm font-medium ${!currentStyle?.template_id ? 'text-[#F5A623]' : 'text-gray-300'}`}>
              None (Default)
              {!currentStyle?.template_id && <Check className="inline w-3.5 h-3.5 ml-1.5 text-[#F5A623]" />}
            </p>
            <p className="text-[10px] text-gray-500">Remove template, use custom style</p>
          </div>
        </div>
      </motion.div>

      {/* ── TEMPLATE CARDS ── */}
      <div className="space-y-2.5">
        {templates.map((template) => {
          const isActive = currentStyle?.template_id === template.id;

          return (
            <motion.div
              key={template.id}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className={`rounded-xl border cursor-pointer transition-all overflow-hidden ${isActive
                ? 'border-purple-500 bg-purple-600/10 shadow-[0_0_12px_rgba(168,85,247,0.15)]'
                : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                }`}
              onClick={() => onApplyTemplate(template.style)}
            >
              {/* ── LIVE CSS PREVIEW ── actual template classes applied */}
              <div
                style={{
                  backgroundColor: template.bg,
                  padding: '10px 16px',
                  display: 'flex',
                  justifyContent: 'center',
                  minHeight: '44px',
                  alignItems: 'center',
                  '--template-primary': isActive ? (currentStyle?.text_color || template.style?.text_color || '#fff') : (template.style?.text_color || '#fff'),
                  '--template-secondary': isActive ? (currentStyle?.secondary_color || template.style?.secondary_color || '#000') : (template.style?.secondary_color || '#000'),
                  '--template-bg': isActive ? (currentStyle?.background_color || template.style?.background_color || 'transparent') : (template.style?.background_color || 'transparent'),
                  '--template-highlight': isActive ? (currentStyle?.highlight_color || template.style?.highlight_color || '#FFE600') : (template.style?.highlight_color || '#FFE600')
                }}
                className={template.id}
              >
                <span className="cap-text" style={{ display: 'inline-flex', gap: '2px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  {PREVIEW_WORDS.map((w, i) => (
                    <span key={i} className={w.classes}>{w.text}</span>
                  ))}
                </span>
              </div>


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
                  </button>
                )}
              </div>

              {/* ── CUSTOMIZATION PANEL (ACTIVE ONLY) ── */}
              {
                isActive && (
                  <div onClick={(e) => e.stopPropagation()} className="px-2 pb-2">
                    <TemplateCustomizationPanel
                      style={currentStyle}
                      defaultTemplateStyle={template.style}
                      onUpdate={(newStyleProps) => {
                        onApplyTemplate({ ...currentStyle, ...newStyleProps });
                      }}
                    />
                  </div>
                )
              }

            </motion.div>
          );
        })}
      </div>
    </div >
  );
}