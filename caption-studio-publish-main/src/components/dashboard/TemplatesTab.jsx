import React, { useState, useEffect, useRef } from 'react';
import { Check, X, RotateCcw } from 'lucide-react';
import '../../styles/captionTemplates.css';

/*
  Each template corresponds to a CSS class in captionTemplates.css.
  The live preview renders actual CSS class-based word states so the
  user sees the exact visual effect before applying.
*/
const templates = [
  {
    id: 't-115', name: 'Green Neon Pulse', mood: 'Energy', dot: '#39FF14',
    bg: '#111',
    style: { template_id: 't-115', font_family: 'Noto Sans', font_size: 28, font_weight: '900', font_style: 'italic', position_y: 75, text_color: '#FFFFFF', secondary_color: '#39FF14', has_shadow: true, shadow_color: '#39FF14', shadow_blur: 10, shadow_offset_x: 0, shadow_offset_y: 0 }
  },
  {
    id: 't-109', name: '3D Shadow', mood: 'Bold', dot: '#E01A1A',
    bg: '#1a1a1a',
    style: { template_id: 't-109', font_family: 'Noto Sans', font_size: 26, font_weight: '900', position_y: 75, text_color: '#FFFFFF', secondary_color: '#E01A1A', has_shadow: true, shadow_color: '#E01A1A', shadow_offset_x: 3, shadow_offset_y: 3, shadow_blur: 0 }
  },
  {
    id: 't-26', name: 'Bold Stroke', mood: 'Pop', dot: '#ff2058',
    bg: '#e8e8e8',
    style: { template_id: 't-26', font_family: 'Bangers', font_size: 28, font_weight: '900', text_case: 'uppercase', position_y: 75, text_color: '#000000', secondary_color: '#ff2058', has_background: true, background_color: '#e8e8e8', background_opacity: 1.0, has_stroke: true, stroke_color: '#000000', stroke_width: 1 }
  },
  {
    id: 't-102', name: 'Clarity', mood: 'Clean', dot: '#555555',
    bg: '#FFFFFF',
    style: { template_id: 't-102', font_family: 'Noto Sans', font_size: 22, font_weight: '800', position_y: 75, text_color: '#1F2022', secondary_color: '#1F2022', has_background: true, background_color: '#FFFFFF', background_opacity: 1.0, background_padding: 10 }
  },
  {
    id: 't-36', name: 'Color Flash', mood: 'Flash', dot: '#00ffb3',
    bg: '#111',
    style: { template_id: 't-36', font_family: 'Noto Sans', font_size: 26, font_weight: '900', position_y: 75, text_color: '#FFFFFF', secondary_color: '#00ffb3' }
  },
  {
    id: 't-105', name: 'Daze', mood: 'Glow', dot: '#FFE600',
    bg: '#111',
    style: { template_id: 't-105', font_family: 'Noto Sans', font_size: 24, font_weight: '800', position_y: 75, text_color: '#FFFFFF', secondary_color: '#FFE600', has_stroke: true, stroke_color: '#000000', stroke_width: 1, has_shadow: true, shadow_color: '#000000', shadow_blur: 2, shadow_offset_x: 2, shadow_offset_y: 2 }
  },
  {
    id: 't-9', name: 'Fire Words', mood: 'Drama', dot: '#ff4500',
    bg: '#1a0500',
    style: { template_id: 't-9', font_family: 'Noto Sans', font_size: 26, font_weight: '900', text_case: 'uppercase', position_y: 75, text_color: '#ff8c00', secondary_color: '#ff8c00', has_shadow: true, shadow_color: '#ff4500', shadow_blur: 10, shadow_offset_x: 0, shadow_offset_y: 0 }
  },
  {
    id: 't-124', name: 'Ghost Echo', mood: 'Haunted', dot: '#aaaaaa',
    bg: '#111',
    style: { template_id: 't-124', font_family: 'Inter', font_size: 26, font_weight: '900', position_y: 75, text_color: '#FFFFFF', has_shadow: true, shadow_color: '#ffffff', shadow_offset_x: 4, shadow_offset_y: 4, shadow_blur: 0 }
  },
  {
    id: 't-16', name: 'Ghost Focus', mood: 'Cinema', dot: '#dddddd',
    bg: '#111',
    style: { template_id: 't-16', font_family: 'Playfair Display', font_size: 24, font_weight: '700', font_style: 'italic', position_y: 75, text_color: '#FFFFFF' }
  },
  {
    id: 't-110', name: 'Glow Dot', mood: 'Minimal', dot: '#0066FF',
    bg: '#111',
    style: { template_id: 't-110', font_family: 'Noto Sans', font_size: 24, font_weight: '800', position_y: 75, text_color: '#FFFFFF', secondary_color: '#0066FF' }
  },
  {
    id: 't-119', name: 'Gradient Box', mood: 'Sleek', dot: '#00FFCC',
    bg: '#111',
    style: { template_id: 't-119', font_family: 'Inter', font_size: 24, font_weight: '800', position_y: 75, text_color: '#FFFFFF', secondary_color: '#00FFCC' }
  },
  {
    id: 't-12', name: 'Horror', mood: 'Dark', dot: '#cc0000',
    bg: '#000',
    style: { template_id: 't-12', font_family: 'Special Elite', font_size: 22, position_y: 75, text_color: '#cc0000', secondary_color: '#cc0000', has_shadow: true, shadow_color: '#cc0000', shadow_blur: 10, shadow_offset_x: 0, shadow_offset_y: 0 }
  },
  {
    id: 't-106', name: 'Iman', mood: 'Clean', dot: '#eeeeee',
    bg: '#111',
    style: { template_id: 't-106', font_family: 'Noto Sans', font_size: 24, font_weight: '800', position_y: 75, text_color: '#FFFFFF', has_shadow: true, shadow_color: '#000000', shadow_blur: 3, shadow_offset_x: 1, shadow_offset_y: 2 }
  },
  {
    id: 't-52', name: 'Light Streak', mood: 'Rise', dot: '#cccccc',
    bg: '#111',
    style: { template_id: 't-52', font_family: 'Inter', font_size: 26, font_weight: '900', position_y: 75, text_color: '#FFFFFF' }
  },
  {
    id: 't-103', name: 'Nightfall', mood: 'Moody', dot: '#888888',
    bg: '#1e1e1e',
    style: { template_id: 't-103', font_family: 'Noto Sans', font_size: 22, font_weight: '800', position_y: 75, text_color: '#FFFFFF', has_background: true, background_color: '#1e1e1e', background_opacity: 0.85, background_padding: 10 }
  },
  {
    id: 't-112', name: 'Pink Gradient', mood: 'Vibe', dot: '#FF007F',
    bg: '#111',
    style: { template_id: 't-112', font_family: 'Noto Sans', font_size: 25, font_weight: '900', position_y: 75, text_color: '#FF007F', secondary_color: '#FF8E53' }
  },
  {
    id: 't-104', name: 'Pulse', mood: 'Rhythm', dot: '#B28DFF',
    bg: '#111',
    style: { template_id: 't-104', font_family: 'Noto Sans', font_size: 26, font_weight: '900', position_y: 75, text_color: '#FFFFFF', secondary_color: '#B28DFF', has_stroke: true, stroke_color: '#B28DFF', stroke_width: 2 }
  },
  {
    id: 't-111', name: 'Red Tape', mood: 'Alert', dot: '#E60000',
    bg: '#111',
    style: { template_id: 't-111', font_family: 'Inter', font_size: 22, font_weight: '900', position_y: 75, text_color: '#FFFFFF', secondary_color: '#E60000' }
  },
  {
    id: 't-T5', name: 'Sentence Box', mood: 'Punchy', dot: '#ECF00F',
    bg: '#111',
    style: { template_id: 't-T5', font_family: 'Montserrat', font_size: 24, font_weight: '800', font_style: 'italic', has_background: true, background_color: '#ECF00F', background_opacity: 1.0, background_padding: 10, text_color: '#333333', position_y: 75 }
  },
  {
    id: 't-95', name: 'Speed Lines', mood: 'Speed', dot: '#0055FF',
    bg: '#111',
    style: { template_id: 't-95', font_family: 'Montserrat', font_size: 30, position_y: 75, text_color: '#FFFFFF', secondary_color: '#0055FF' }
  },
  {
    id: 't-T1', name: 'Stack & Flow', mood: 'Poetic', dot: '#6bb5ff',
    bg: '#0d1b2a',
    style: { template_id: 't-T1', font_family: 'Noto Sans', font_size: 30, font_style: 'italic', position_y: 75, text_color: '#FFFFFF' }
  },
  {
    id: 't-T4', name: 'Study With Me', mood: 'Soft', dot: '#f9a8d4',
    bg: '#1a0e14',
    style: { template_id: 't-T4', font_family: 'Playfair Display', font_size: 24, font_style: 'italic', position_y: 75, text_color: '#f9a8d4' }
  },
  {
    id: 't-56', name: 'Underline', mood: 'Cool', dot: '#0066FF',
    bg: '#111',
    style: { template_id: 't-56', font_family: 'Inter', font_size: 26, font_weight: '900', position_y: 75, text_color: '#FFFFFF', secondary_color: '#0066FF' }
  },
  {
    id: 't-T3', name: 'Underline Fade', mood: 'Subtle', dot: '#4ade80',
    bg: '#0a0a0a',
    style: { template_id: 't-T3', font_family: 'Montserrat', font_size: 22, font_weight: '400', position_y: 75, text_color: '#FFFFFF' }
  },
  {
    id: 't-57', name: 'VHS Glitch', mood: 'Retro', dot: '#00ffff',
    bg: '#111',
    style: { template_id: 't-57', font_family: 'Inter', font_size: 26, font_weight: '900', position_y: 75, text_color: '#FFFFFF', has_shadow: true, shadow_color: '#00ffff', shadow_offset_x: 2, shadow_offset_y: 0, shadow_blur: 0 }
  },
  {
    id: 't-37', name: 'Wipe Mask', mood: 'Bold', dot: '#FF007F',
    bg: '#111',
    style: { template_id: 't-37', font_family: 'Inter', font_size: 26, font_weight: '900', text_case: 'uppercase', position_y: 75, text_color: '#FF007F', secondary_color: '#FF2BD6' }
  }
];

const PREVIEW_WORDS = ['और', 'ये', 'लोकेशन', 'है']

/* ─── Animated Template Card ─────────────────────────────────── */
function TemplateCard({ template, isActive, onApply, currentStyle, onUpdate }) {
  const [curIdx, setCurIdx] = useState(0)
  const timerRef = useRef(null)

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCurIdx(i => (i + 1) % PREVIEW_WORDS.length)
    }, 700)
    return () => clearInterval(timerRef.current)
  }, [])

  const primaryColor = isActive ? (currentStyle?.text_color || template.style?.text_color || '#fff') : (template.style?.text_color || '#fff')
  const secondaryColor = isActive ? (currentStyle?.secondary_color || template.style?.secondary_color || '#000') : (template.style?.secondary_color || '#000')
  const bgColor = isActive ? (currentStyle?.background_color || template.style?.background_color || 'transparent') : (template.style?.background_color || 'transparent')
  const hlColor = isActive ? (currentStyle?.highlight_color || template.style?.highlight_color || '#FFE600') : (template.style?.highlight_color || '#FFE600')

  return (
    <div
      className={`rounded-xl border cursor-pointer transition-all overflow-hidden ${
        isActive
          ? 'border-amber-500/50 bg-amber-500/5 shadow-[0_0_12px_rgba(245,166,35,0.12)]'
          : 'border-white/10 bg-white/[0.02] hover:border-white/20'
      }`}
      onClick={() => onApply(template.style)}
    >
      {/* ── Animated CSS Preview ── */}
      <div
        style={{
          backgroundColor: template.bg,
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'center',
          minHeight: '52px',
          alignItems: 'center',
          '--template-primary': primaryColor,
          '--template-secondary': secondaryColor,
          '--template-bg': bgColor,
          '--template-highlight': hlColor,
        }}
        className={template.id}
      >
        <span className="cap-text" style={{ display: 'inline-flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {PREVIEW_WORDS.map((word, i) => {
            let cls = 'word'
            if (i < curIdx) cls = 'word active'
            else if (i === curIdx) cls = 'word current'
            return <span key={i} className={cls}>{word}</span>
          })}
        </span>
      </div>

      {/* ── Info Row ── */}
      <div className="px-3 py-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: template.dot, boxShadow: `0 0 4px ${template.dot}88` }}
          />
          <div className="min-w-0">
            <span className="text-sm text-white font-medium truncate block leading-tight">
              {template.name}
              {isActive && <Check className="inline w-3.5 h-3.5 ml-1 text-amber-400" />}
            </span>
            <span className="text-[10px] text-gray-500">{template.mood}</span>
          </div>
        </div>
        {!isActive ? (
          <button
            className="flex-shrink-0 text-[11px] px-3 py-1 rounded-md bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 hover:border-white/20 transition-all"
            onClick={e => { e.stopPropagation(); onApply(template.style) }}
          >
            Apply
          </button>
        ) : (
          <span className="flex-shrink-0 text-[11px] px-3 py-1 rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/30 font-medium">
            Active
          </span>
        )}
      </div>

      {/* ── Customization Panel (active only) ── */}
      {isActive && (
        <div onClick={e => e.stopPropagation()} className="px-2 pb-2">
          <TemplateCustomizationPanel
            style={currentStyle}
            defaultTemplateStyle={template.style}
            onUpdate={onUpdate}
          />
        </div>
      )}
    </div>
  )
}



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

const TEMPLATE_FEATURES = { "t-115": ["primary", "secondary", "highlight"], "t-109": ["primary", "secondary", "highlight"], "t-26": ["primary", "secondary", "bg", "highlight"], "t-102": ["primary", "bg", "highlight"], "t-36": ["primary", "secondary", "highlight"], "t-105": ["primary", "highlight"], "t-9": ["highlight"], "t-124": ["primary", "highlight"], "t-16": ["primary", "highlight"], "t-110": ["primary", "secondary", "highlight"], "t-119": ["primary", "bg", "highlight"], "t-12": ["primary", "secondary", "highlight"], "t-106": ["primary", "highlight"], "t-52": ["primary", "highlight"], "t-103": ["primary", "bg", "highlight"], "t-112": ["highlight"], "t-104": ["primary", "secondary", "highlight"], "t-111": ["primary", "secondary", "highlight"], "t-T5": ["primary", "bg"], "t-95": ["secondary", "highlight"], "t-T1": ["primary", "highlight"], "t-T4": ["primary", "highlight"], "t-56": ["primary", "secondary", "highlight"], "t-T3": ["primary", "highlight"], "t-57": ["primary", "highlight"], "t-37": ["primary", "secondary", "highlight"] };

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
      <div
        onClick={handleClearTemplate}
        className={`mb-3 rounded-xl border cursor-pointer transition-all overflow-hidden ${!currentStyle?.template_id
          ? 'border-white/30 bg-white/5'
          : 'border-white/10 bg-white/[0.03] hover:border-white/20'
          }`}
      >
        <div className="px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-gray-500 flex-shrink-0" />
            <div>
              <p className={`text-sm font-medium ${!currentStyle?.template_id ? 'text-white' : 'text-gray-300'}`}>
                None (Default)
                {!currentStyle?.template_id && <Check className="inline w-3.5 h-3.5 ml-1.5 text-white" />}
              </p>
              <p className="text-[10px] text-gray-500">Custom style</p>
            </div>
          </div>
          {currentStyle?.template_id && (
            <button className="flex-shrink-0 text-[11px] px-3 py-1 rounded-md bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 transition-all">
              Reset
            </button>
          )}
        </div>
      </div>

      {/* ── TEMPLATE CARDS ── */}
      <div className="space-y-2.5">
        {templates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            isActive={currentStyle?.template_id === template.id}
            onApply={onApplyTemplate}
            currentStyle={currentStyle}
            onUpdate={(newStyleProps) => onApplyTemplate({ ...currentStyle, ...newStyleProps })}
          />
        ))}
      </div>
    </div >
  );
}