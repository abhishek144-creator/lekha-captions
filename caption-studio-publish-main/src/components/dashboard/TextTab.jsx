import React from 'react';
import { Type } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { loadGoogleFont } from './fontUtils';
import { DEFAULT_CAPTION_POSITION_Y } from '../../lib/captionDefaults.js';
import { buildFontComboTextElement, buildPresetTextElement, getNewTextElementTiming } from './textElementDefaults.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const buildCaptionMatchedTextElement = ({ captions, currentTime, captionStyle, duration }) => {
  const seedText = 'Add a short headline';
  const fontSize = clamp(Number(captionStyle?.font_size) || 18, 20, 24);
  const longestLineLength = seedText.length;
  const estimatedWidth = clamp(
    Math.round((longestLineLength * fontSize * 0.58) + 44),
    220,
    320,
  );

  const { startTime, endTime } = getNewTextElementTiming({ captions, currentTime, duration });

  return {
    id: `text-${Date.now()}-${Math.random()}`,
    text: seedText,
    start_time: startTime,
    end_time: endTime,
    type: 'textbox',
    isTextElement: true,
    customStyle: {
      top: clamp((captionStyle?.position_y ?? DEFAULT_CAPTION_POSITION_Y) - 16, 12, 82),
      left: captionStyle?.position_x ?? 50,
      width: estimatedWidth,
      fontSize,
      backgroundColor: captionStyle?.background_color || '#000000',
      backgroundOpacity: captionStyle?.background_opacity ?? 0.7,
      color: captionStyle?.text_color || '#ffffff',
      borderRadius: 6,
      padding: captionStyle?.background_padding ?? 6,
      textAlign: captionStyle?.text_align || 'center',
      fontFamily: captionStyle?.font_family || 'Inter',
      fontWeight: captionStyle?.font_weight || '800',
      fontStyle: captionStyle?.font_style || 'normal',
      textDecoration: captionStyle?.text_decoration || 'none',
      textTransform: captionStyle?.text_case && captionStyle.text_case !== 'none' ? captionStyle.text_case : 'none',
      letterSpacing: captionStyle?.letter_spacing ?? 0,
      lineSpacing: captionStyle?.line_spacing ?? 1.4,
      wordSpacing: captionStyle?.word_spacing ?? 0,
      textOpacity: captionStyle?.text_opacity ?? 1,
      textGradient: captionStyle?.text_gradient || '',
      highlightColor: captionStyle?.highlight_color || '',
      highlightGradient: captionStyle?.highlight_gradient || '',
      hasBackground: false,
      backgroundHMultiplier: captionStyle?.background_h_multiplier ?? 1.05,
      hasShadow: captionStyle?.has_shadow !== false,
      shadowColor: captionStyle?.shadow_color || 'rgba(0,0,0,0.8)',
      shadowBlur: captionStyle?.shadow_blur ?? 4,
      shadowOffsetX: captionStyle?.shadow_offset_x ?? 0,
      shadowOffsetY: captionStyle?.shadow_offset_y ?? 2,
      hasStroke: captionStyle?.has_stroke === true,
      strokeWidth: captionStyle?.stroke_width ?? 0.5,
      strokeColor: captionStyle?.stroke_color || '#000000',
      scale: captionStyle?.scale ?? 1,
      effect_type: captionStyle?.effect_type || 'none',
      effect_color: captionStyle?.effect_color || '#000000',
      effect_blur: captionStyle?.effect_blur ?? 50,
      effect_offset: captionStyle?.effect_offset ?? 50,
      effect_direction: captionStyle?.effect_direction ?? -45,
      effect_transparency: captionStyle?.effect_transparency ?? 40,
      effect_thickness: captionStyle?.effect_thickness ?? 50,
      minWidth: 220,
      zIndex: 50,
    }
  };
};

// Preset text styles shown in the Text tab.
const fontCombos = [
  { text: 'Thank you!', fontFamily: 'Pacifico', fontSize: 28, color: '#4A90E2', fontStyle: 'italic' },
  { text: 'Coffee Break', fontFamily: 'Satisfy', fontSize: 24, color: '#4CAF50' },
  { text: 'FIRE\naway', fontFamily: 'Bebas Neue', fontSize: 32, color: '#FF5722', fontWeight: 'bold' },
  { text: 'GOLDEN\nHOUR', fontFamily: 'Playfair Display', fontSize: 28, color: '#FFD700', textTransform: 'uppercase' },
  { text: 'love you', fontFamily: 'Dancing Script', fontSize: 26, color: '#E91E63', fontStyle: 'italic' },
  { text: 'HAPPY\nBIRTHDAY', fontFamily: 'Bebas Neue', fontSize: 30, color: '#FFFFFF', fontWeight: 'bold', textTransform: 'uppercase' },
  { text: 'LIKE &\nSUBSCRIBE', fontFamily: 'Anton', fontSize: 24, color: '#FFC107', textTransform: 'uppercase' },
  { text: 'THANK\nYOU', fontFamily: 'Bebas Neue', fontSize: 32, color: '#F44336', fontWeight: 'bold', textTransform: 'uppercase' },
  { text: 'Merry\nChristmas', fontFamily: 'Satisfy', fontSize: 26, color: '#4CAF50', fontStyle: 'italic' },
  { text: 'GLOW', fontFamily: 'Bebas Neue', fontSize: 36, color: '#E91E63', fontWeight: 'bold', textTransform: 'uppercase' },
  { text: 'Thank you!', fontFamily: 'Pacifico', fontSize: 28, color: '#FF6B6B', fontStyle: 'italic' },
  { text: 'engaged!', fontFamily: 'Dancing Script', fontSize: 24, color: '#FFFFFF', fontStyle: 'italic' },
];

export default function TextTab({ captions, setCaptions, currentTime, setSelectedCaptionId, captionStyle, duration = 0 }) {
  // The combo presets use display fonts that nothing else loads — without this
  // the preview grid AND the inserted text element render in a fallback font.
  React.useEffect(() => {
    const families = [...new Set(fontCombos.map((combo) => combo.fontFamily))];
    families.forEach((family) => loadGoogleFont(family, [400, 700]).catch(() => {}));
  }, []);

  const addTextElement = (type) => {
    // Check limit
    const activeTextCount = captions.filter(c => c.isTextElement).length;
    if (activeTextCount >= 6) {
      toast({
        variant: 'destructive',
        title: 'Text limit reached',
        description: 'You can only add up to 6 text boxes.',
      });
      return;
    }

    if (type === 'textbox') {
      const newCaption = buildCaptionMatchedTextElement({
        captions,
        currentTime,
        captionStyle,
        duration,
      });

      setCaptions([...captions, newCaption]);
      if (setSelectedCaptionId) setSelectedCaptionId(newCaption.id);
      return;
    }

    const newCaption = buildPresetTextElement(type, getNewTextElementTiming({ captions, currentTime, duration }));

    setCaptions([...captions, newCaption]);
    if (setSelectedCaptionId) setSelectedCaptionId(newCaption.id);
  };

  const addFontCombo = (preset) => {
    // Check limit
    const activeTextCount = captions.filter(c => c.isTextElement).length;
    if (activeTextCount >= 6) {
      toast({
        variant: 'destructive',
        title: 'Text limit reached',
        description: 'You can only add up to 6 text boxes.',
      });
      return;
    }

    const newCaption = buildFontComboTextElement(preset, getNewTextElementTiming({ captions, currentTime, duration }));

    setCaptions([...captions, newCaption]);
    if (setSelectedCaptionId) setSelectedCaptionId(newCaption.id);
  };


  return (
    <div className="h-full flex flex-col space-y-3 overflow-y-auto pr-2 custom-scrollbar">
      <button
        onClick={() => addTextElement('textbox')}
        className="w-full py-3 px-4 rounded-[4px] bg-white hover:bg-gray-100 text-black font-medium flex items-center justify-center gap-2 transition-all"
      >
        <Type className="w-5 h-5" />
        Add a text box
      </button>

      <button
        onClick={() => addTextElement('heading')}
        className="w-full py-3 px-4 rounded-lg bg-zinc-800/80 hover:bg-zinc-700/80 border border-white/5 text-white font-medium text-left transition-all"
      >
        Add a heading
      </button>

      <button
        onClick={() => addTextElement('subheading')}
        className="w-full py-3 px-4 rounded-lg bg-zinc-800/80 hover:bg-zinc-700/80 border border-white/5 text-white font-medium text-left transition-all"
      >
        Add a subheading
      </button>

      <button
        onClick={() => addTextElement('body')}
        className="w-full py-3 px-4 rounded-lg bg-zinc-800/80 hover:bg-zinc-700/80 border border-white/5 text-gray-300 text-sm text-left transition-all"
      >
        Add a little bit of body text
      </button>

      {/* Font Combinations */}
      <div className="pt-4 border-t border-white/10">
        <h3 className="text-sm font-medium text-gray-400 mb-3">Font combinations</h3>
        <div className="grid grid-cols-2 gap-2">
          {fontCombos.map((combo, idx) => (
            <button
              key={idx}
              onClick={() => addFontCombo(combo)}
              className="h-24 rounded-lg bg-zinc-800/80 hover:bg-zinc-700/80 border border-white/10 transition-all flex items-center justify-center p-3 overflow-hidden"
            >
              <span
                style={{
                  fontFamily: combo.fontFamily,
                  fontSize: `${combo.fontSize * 0.4}px`,
                  color: combo.color,
                  fontWeight: combo.fontWeight || 'normal',
                  fontStyle: combo.fontStyle || 'normal',
                  textTransform: combo.textTransform || 'none',
                  textAlign: 'center',
                  whiteSpace: 'pre-line',
                  lineHeight: 1.2
                }}
              >
                {combo.text}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
