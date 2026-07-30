import { useEffect, useMemo, useState } from 'react';
import { Sparkles, Check, X, RotateCcw, Search, Star } from 'lucide-react';
import { motion } from 'framer-motion';
import '../../styles/captionTemplates.css';
import originalTemplateHtml from '../../assets/lekha-captions-T11-T35.html?raw';
import { findAppliedBasicTemplateMarkup } from './basicTemplateInline.js';
import { getBasicTemplateStyle, marksTemplateColorCustomized } from './basicTemplateCatalog.js';
import {
  isExportableTemplateCandidate,
  templateMatchesQuery,
  useTemplateFavorites,
} from './templateBrowserUtils.js';

/*
  Each template corresponds to a CSS class in captionTemplates.css.
  The live preview renders actual CSS class-based word states so the
  user sees the exact visual effect before applying.
*/
const BASIC_TEMPLATE_MARKUP = {
  't-106': findAppliedBasicTemplateMarkup(originalTemplateHtml, { template_id: 't-106' }),
  't-52': findAppliedBasicTemplateMarkup(originalTemplateHtml, { template_id: 't-52' }),
  't-T4': findAppliedBasicTemplateMarkup(originalTemplateHtml, { template_id: 't-T4' }),
  't-WS1': findAppliedBasicTemplateMarkup(originalTemplateHtml, { template_id: 't-WS1' }),
};

const withBasicTemplateMarkup = (style) => ({
  ...style,
  template_markup: BASIC_TEMPLATE_MARKUP[style.template_id] || style.template_markup || '',
});

const IMAN_BASIC_FONT_STYLE = { font_family: 'Noto Sans', font_size: 24 };
const GLOW_DOT_FONT_STYLE = { font_family: 'Noto Sans', font_size: 22 };

const applyImanFontAfterIman = (templateList) => {
  let hasPassedIman = false;
  return templateList.map((template) => {
    if (hasPassedIman) {
      return {
        ...template,
        style: {
          ...template.style,
          ...IMAN_BASIC_FONT_STYLE,
          ...(template.id === 't-110' ? GLOW_DOT_FONT_STYLE : {}),
        },
      };
    }
    if (template.id === 't-106') hasPassedIman = true;
    return template;
  });
};

const templates = applyImanFontAfterIman([
  {
    id: 't-115', name: 'Neon',
    desc: 'White text with pulsing green active glow',
    bg: '#111',
    style: getBasicTemplateStyle('t-115')
  },
  {
    id: 't-26', name: 'Impact',
    desc: 'Light bg, black bold text with pink 3D shadow',
    bg: '#e8e8e8',
    style: getBasicTemplateStyle('t-26')
  },
  {
    id: 't-102', name: 'Studio',
    desc: 'Clean light bg, dark readable text',
    bg: '#FFFFFF',
    style: getBasicTemplateStyle('t-102')
  },
  {
    id: 't-105', name: 'Gold',
    desc: 'White stroked, yellow glow on speak',
    bg: '#111',
    style: getBasicTemplateStyle('t-105')
  },
  {
    id: 't-9', name: 'Ember',
    desc: 'Words ignite in fire orange glow',
    bg: '#1a0500',
    style: getBasicTemplateStyle('t-9')
  },
  {
    id: 't-16', name: 'Soft',
    desc: 'Blurred inactive words, sharp spotlight on spoken',
    bg: '#111',
    style: getBasicTemplateStyle('t-16')
  },
  {
    id: 't-110', name: 'Orbit',
    desc: 'Glowing dot under active word',
    bg: '#111',
    style: getBasicTemplateStyle('t-110')
  },
  {
    id: 't-119', name: 'Marker',
    desc: 'Active word gets blue-cyan gradient box',
    bg: '#111',
    style: getBasicTemplateStyle('t-119')
  },
  {
    id: 't-106', name: 'Reveal',
    desc: 'Words hidden until spoken — clean instant reveal',
    bg: '#111',
    style: withBasicTemplateMarkup({ ...getBasicTemplateStyle('t-106'), template_source: 'lekha-basic', template_class: 'btcard t-106', template_name: 'Reveal', template_layout: 'word-sequence', show_inactive: true, has_background: false, has_stroke: false })
  },
  {
    id: 't-52', name: 'Streak',
    desc: 'Words rise into view as spoken',
    bg: '#111',
    style: withBasicTemplateMarkup({ ...getBasicTemplateStyle('t-52'), template_source: 'lekha-basic', template_class: 'btcard t-52', template_name: 'Streak', template_layout: 'word-sequence', show_inactive: true, has_background: false, has_shadow: false, has_stroke: false })
  },
  {
    id: 't-112', name: 'Rose',
    desc: 'Hot pink-to-coral gradient text reveal',
    bg: '#111',
    style: getBasicTemplateStyle('t-112')
  },
  {
    id: 't-111', name: 'Crimson',
    desc: 'Bold red box snaps onto each spoken word',
    bg: '#111',
    style: getBasicTemplateStyle('t-111')
  },
  {
    id: 't-T5', name: 'Caption Bar',
    desc: 'Deep yellow pad box for all words',
    bg: '#111',
    style: getBasicTemplateStyle('t-T5')
  },
  {
    id: 't-T1', name: 'Cascade',
    desc: 'Italic serif, words stack then flow in',
    bg: '#0d1b2a',
    style: getBasicTemplateStyle('t-T1')
  },
  {
    id: 't-T4', name: 'Script',
    desc: 'White italic serif with Motion Slide on line two',
    bg: '#1a0e14',
    style: withBasicTemplateMarkup({ ...getBasicTemplateStyle('t-T4'), template_source: 'lekha-basic', template_class: 'btcard t-T4', template_name: 'Script', template_layout: 'word-sequence', show_inactive: true, has_background: false, has_shadow: false, has_stroke: false })
  },
  {
    id: 't-WS1', name: 'Slide',
    desc: 'Words slide in together with a slight stagger',
    bg: '#0d1117',
    style: withBasicTemplateMarkup({ ...getBasicTemplateStyle('t-WS1'), template_source: 'lekha-basic', template_class: 'btcard t-WS1', template_name: 'Slide', template_layout: 'word-sequence', show_inactive: true, has_background: false, has_shadow: false, has_stroke: false })
  },
  {
    id: 't-56', name: 'Underline',
    desc: 'Active word gets a blue bottom border',
    bg: '#111',
    style: getBasicTemplateStyle('t-56')
  },
  {
    id: 't-T3', name: 'Quiet',
    desc: 'Words fade in, key words get green underline',
    bg: '#0a0a0a',
    style: getBasicTemplateStyle('t-T3')
  },
  {
    id: 't-57', name: 'Retro',
    desc: 'Flicker-on reveal with chromatic aberration',
    bg: '#111',
    style: getBasicTemplateStyle('t-57')
  },
  {
    id: 't-37', name: 'Wipe',
    desc: 'Pink uppercase text wipes in from left',
    bg: '#111',
    style: getBasicTemplateStyle('t-37')
  }
]);

// Live preview words — shows done, active, done+imp states
// word 1 "This" = done (already spoken), word 2 "IS" = done+imp (important spoken), word 3 "great" = active (current), word 4 "now" = upcoming
const PREVIEW_WORDS = [
  { text: 'This', important: false },
  { text: 'IS', important: true },
  { text: 'great', important: false },
  { text: 'now', important: false },
];

const PHASED_PREVIEW_WORDS = [
  ['This', 'IS', 'great', 'now'],
  ['and', 'it', 'feels', 'right'],
  ['every', 'single', 'time', 'yeah'],
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

const TEMPLATE_FEATURES = { "t-115": ["primary", "secondary", "highlight"], "t-109": ["primary", "secondary", "highlight"], "t-26": ["primary", "secondary", "bg", "highlight"], "t-102": ["primary", "bg", "highlight"], "t-36": ["primary", "secondary", "highlight"], "t-105": ["primary", "highlight"], "t-9": ["highlight"], "t-16": ["primary", "highlight"], "t-110": ["primary", "secondary", "highlight"], "t-119": ["primary", "bg", "highlight"], "t-12": ["primary", "secondary", "highlight"], "t-106": ["primary", "highlight"], "t-52": ["primary", "highlight"], "t-103": ["primary", "bg", "highlight"], "t-112": ["highlight"], "t-104": ["primary", "secondary", "highlight"], "t-111": ["primary", "secondary", "highlight"], "t-T5": ["primary", "bg"], "t-95": ["secondary", "highlight"], "t-T1": ["primary", "highlight"], "t-T4": ["primary", "highlight"], "t-WS1": ["primary", "highlight"], "t-56": ["primary", "secondary", "highlight"], "t-T3": ["primary", "highlight"], "t-57": ["primary", "highlight"], "t-37": ["primary", "highlight"] };

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
            defaultColor={defaultTemplateStyle?.highlight_color || '#DDAA03'}
            onChange={(val) => onUpdate({ highlight_color: val })}
            onReset={() => onUpdate({ highlight_color: defaultTemplateStyle?.highlight_color || '#DDAA03' })}
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
  const [previewIndex, setPreviewIndex] = useState(0);
  const [basicPreviewPhase, setBasicPreviewPhase] = useState(0);
  const [templateSearchQuery, setTemplateSearchQuery] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const { isFavorite, toggleFavorite } = useTemplateFavorites();

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setPreviewIndex((current) => (current + 1) % PREVIEW_WORDS.length);
      setBasicPreviewPhase((current) => (current + 1) % PHASED_PREVIEW_WORDS.length);
    }, 700);

    return () => window.clearInterval(intervalId);
  }, []);

  const visibleTemplates = useMemo(
    () => templates.filter((template) => (
      isExportableTemplateCandidate(template)
      && templateMatchesQuery(template, templateSearchQuery)
      && (!favoritesOnly || isFavorite('basic-template', template.id))
    )),
    [templateSearchQuery, favoritesOnly, isFavorite],
  );

  if (!onApplyTemplate) return null;

  const getPreviewWordClass = (word, index) => {
    if (index < previewIndex) {
      return `word active${word.important ? ' imp' : ''}`;
    }
    if (index === previewIndex) {
      return `word current${word.important ? ' imp' : ''}`;
    }
    return `word${word.important ? ' imp' : ''}`;
  };

  const renderTemplatePreviewWords = (template) => {
    const isIman = template.id === 't-106';
    const isLightStreak = template.id === 't-52';
    const isStudyWithMe = template.id === 't-T4';
    const isWordSlide = template.id === 't-WS1';
    if (isIman || isLightStreak || isStudyWithMe || isWordSlide) {
      const phase = basicPreviewPhase % PHASED_PREVIEW_WORDS.length;
      const words = PHASED_PREVIEW_WORDS[phase];

      return (
        <span
          key={`${template.id}-phase-${phase}`}
          className="cap-text"
          style={{ display: 'inline-flex', gap: '5px', flexWrap: 'wrap', justifyContent: 'center' }}
        >
          {words.map((word, index) => {
            const slideStyle = {
              ...((isWordSlide || (isStudyWithMe && phase === 1))
                ? { '--ws-delay': `${90 + (index * 55)}ms` }
                : {}),
              ...(isLightStreak && phase > 0
                ? {
                    animation: `${phase === 1 ? 'basicWordSlideFromLeft' : 'basicWordSlideFromRight'} 0.42s cubic-bezier(0.22,1,0.36,1) both`,
                    animationDelay: `${index * 65}ms`,
                  }
                : {}),
              ...(isIman && phase === 0
                ? {
                    animation: 'basicWordRiseIn 0.28s cubic-bezier(0.34,1.2,0.64,1) both',
                    animationDelay: `${index * 65}ms`,
                  }
                : {}),
              ...(isIman && phase === 2
                ? {
                    animation: 'basicWordSlideFromRight 0.42s cubic-bezier(0.22,1,0.36,1) both',
                    animationDelay: `${index * 65}ms`,
                  }
                : {}),
            };
            return (
              <span
                key={`${template.id}-${phase}-${word}-${index}`}
                className="word active"
                style={slideStyle}
              >
                {word}
              </span>
            );
          })}
        </span>
      );
    }

    return (
      <span className="cap-text" style={{ display: 'inline-flex', gap: '2px', flexWrap: 'wrap', justifyContent: 'center' }}>
        {PREVIEW_WORDS.map((w, i) => (
          <span key={`${template.id}-${previewIndex}-${i}`} className={getPreviewWordClass(w, i)}>{w.text}</span>
        ))}
      </span>
    );
  };

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
        <p className="text-[11px] text-gray-500">{visibleTemplates.length}/{templates.length} templates - yellow = important word</p>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
          <input
            value={templateSearchQuery}
            onChange={(event) => setTemplateSearchQuery(event.target.value)}
            placeholder="Search templates"
            className="h-9 w-full rounded-lg border border-white/10 bg-white/[0.04] pl-8 pr-3 text-xs text-white outline-none transition-colors placeholder:text-gray-600 focus:border-purple-400/50"
          />
        </label>
        <button
          type="button"
          aria-pressed={favoritesOnly}
          title="Show favorites"
          onClick={() => setFavoritesOnly((current) => !current)}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors ${
            favoritesOnly
              ? 'border-yellow-400/40 bg-yellow-400/15 text-yellow-300'
              : 'border-white/10 bg-white/[0.04] text-gray-400 hover:text-white'
          }`}
        >
          <Star className="h-3.5 w-3.5" fill={favoritesOnly ? 'currentColor' : 'none'} />
        </button>
      </div>

      {/* ── NONE / REMOVE OPTION ── always visible at top */}
      <motion.div
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        onClick={handleClearTemplate}
        className={`mb-3 rounded-xl border cursor-pointer transition-all overflow-hidden ${!currentStyle?.template_id
          ? 'border-white/30 bg-white/5 shadow-[0_0_10px_rgba(255,255,255,0.05)]'
          : 'border-white/10 bg-white/[0.03] hover:border-white/20'
          }`}
      >
        <div className="px-4 py-3 flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${!currentStyle?.template_id ? 'bg-white/10' : 'bg-white/5'}`}>
            <X className={`w-4 h-4 ${!currentStyle?.template_id ? 'text-white' : 'text-gray-500'}`} />
          </div>
          <div>
            <p className={`text-sm font-medium ${!currentStyle?.template_id ? 'text-white' : 'text-gray-300'}`}>
              None (Default)
              {!currentStyle?.template_id && <Check className="inline w-3.5 h-3.5 ml-1.5 text-white" />}
            </p>
            <p className="text-[10px] text-gray-500">Remove template, use custom style</p>
          </div>
        </div>
      </motion.div>

      {/* ── TEMPLATE CARDS ── */}
      <div className="space-y-2.5">
        {visibleTemplates.map((template) => {
          const isActive = currentStyle?.template_id === template.id;
          const templateIsFavorite = isFavorite('basic-template', template.id);

          return (
            <motion.div
              key={template.id}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className={`relative rounded-xl border cursor-pointer transition-all overflow-hidden ${isActive
                ? 'border-purple-500 bg-purple-600/10 shadow-[0_0_12px_rgba(168,85,247,0.15)]'
                : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                }`}
              onClick={() => onApplyTemplate(template.style)}
            >
              <button
                type="button"
                title={templateIsFavorite ? 'Remove from favorites' : 'Add to favorites'}
                aria-label={templateIsFavorite ? 'Remove from favorites' : 'Add to favorites'}
                onClick={(event) => {
                  event.stopPropagation();
                  toggleFavorite('basic-template', template.id);
                }}
                className={`absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full border transition-colors ${
                  templateIsFavorite
                    ? 'border-yellow-400/40 bg-yellow-400/20 text-yellow-300'
                    : 'border-white/10 bg-black/30 text-white/50 hover:text-white'
                }`}
              >
                <Star className="h-3.5 w-3.5" fill={templateIsFavorite ? 'currentColor' : 'none'} />
              </button>
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
                  '--template-highlight': isActive ? (currentStyle?.highlight_color || template.style?.highlight_color || '#DDAA03') : (template.style?.highlight_color || '#DDAA03'),
                  ...(template.id === 't-52' && basicPreviewPhase % PHASED_PREVIEW_WORDS.length === 0
                    ? { animation: 'basicWordRiseFromBottom 0.38s cubic-bezier(0.34,1.2,0.64,1) both' }
                    : {}),
                  ...(template.id === 't-T4' && basicPreviewPhase % PHASED_PREVIEW_WORDS.length === 0
                    ? { animation: 'basicWordSlideFromLeft 0.42s cubic-bezier(0.22,1,0.36,1) both' }
                    : {}),
                  ...(template.id === 't-T4' && basicPreviewPhase % PHASED_PREVIEW_WORDS.length === 2
                    ? { animation: 'wordRiseInFromBottom 0.38s cubic-bezier(0.34,1.2,0.64,1) both' }
                    : {}),
                }}
                className={`${template.id}${template.id === 't-WS1' ? ` ws-enter ws-line-${basicPreviewPhase % PHASED_PREVIEW_WORDS.length}` : ''}${template.id === 't-T4' ? ` study-line-${basicPreviewPhase % PHASED_PREVIEW_WORDS.length}${basicPreviewPhase === 1 ? ' study-word-slide-preview' : ''}` : ''}`}
              >
                {renderTemplatePreviewWords(template)}
              </div>

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
              {isActive && (
                <div onClick={(e) => e.stopPropagation()} className="px-2 pb-2">
                  <TemplateCustomizationPanel
                    style={currentStyle}
                    defaultTemplateStyle={template.style}
                    onUpdate={(newStyleProps) => {
                      onApplyTemplate({
                        ...currentStyle,
                        ...newStyleProps,
                        ...(marksTemplateColorCustomized(newStyleProps) ? { template_color_customized: true } : {}),
                      });
                    }}
                  />
                </div>
              )}
            </motion.div>
          );
        })}
        {!visibleTemplates.length && (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-6 text-center text-xs text-gray-500">
            No matching templates.
          </div>
        )}
      </div>
    </div >
  );
}
