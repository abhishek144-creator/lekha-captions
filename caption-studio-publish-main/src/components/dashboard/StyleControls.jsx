import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FixedSizeList as List } from 'react-window';
import { detectScript, scriptFontMap, loadGoogleFont } from './fontUtils';
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Plus,
  RotateCcw,
  Search,
  Check,
  ChevronDown,
  Sparkles
} from 'lucide-react';

const FontRow = React.memo(({ data, index, style }) => {
  const font = data.items[index];
  const isSelected = font ? data.selectedValue === font.value : false;

  React.useEffect(() => {
    // Only load standard weight for dropdown previews to save bandwidth
    if (font?.value && font.value !== '___CUSTOM___' && !font.isHeader) {
      loadGoogleFont(font.value, [400]).catch(() => { });
    }
  }, [font?.value, font?.isHeader]);

  if (!font) return null;

  if (font.isHeader) {
    return (
      <div style={style} className="flex items-end pb-2 px-3 bg-black/20 pt-4 pointer-events-none">
        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{font.label}</span>
      </div>
    );
  }

  return (
    <div
      style={style}
      className={`flex items-center px-3 cursor-pointer transition-colors hover:bg-white/10 ${isSelected ? 'bg-white/10 text-white font-medium' : 'text-white'}`}
      onClick={(e) => {
        // Stop popover from instantly closing if it misfires
        e.stopPropagation();
        data.onSelect(font.value);
      }}
    >
      <span style={{ fontFamily: font.value, fontSize: '15px' }} className="truncate flex-1">
        {font.label}
      </span>
      {isSelected && <Check className="ml-1 h-4 w-4 shrink-0 text-white" />}
    </div>
  );
});
FontRow.displayName = 'FontRow';

const scriptLabels = {
  devanagari: 'Hindi / Marathi',
  tamil: 'Tamil',
  telugu: 'Telugu',
  bengali: 'Bengali',
  gujarati: 'Gujarati',
  kannada: 'Kannada',
  malayalam: 'Malayalam',
  punjabi: 'Punjabi',
  odia: 'Odia',
  arabic: 'Arabic / Urdu',
  chinese: 'Chinese',
  japanese: 'Japanese',
  korean: 'Korean',
  thai: 'Thai',
  latin: 'English / Latin',
};

const presetColors = [
  '#E91E63', '#ffffff', '#fef08a', '#22c55e',
  '#3b82f6', '#F5A623', '#ec4899', '#ff6b35',
  '#fb923c'
];

const presetGradients = [
  { name: 'Fire', value: 'linear-gradient(to right, #facc15, #ef4444)' },
  { name: 'Electric', value: 'linear-gradient(to right, #F5A623, #3b82f6)' },
  { name: 'Ocean', value: 'linear-gradient(to right, #06b6d4, #2563eb)' },
  { name: 'Magic', value: 'linear-gradient(to right, #ec4899, #F5A623)' },
  { name: 'Nature', value: 'linear-gradient(to right, #4ade80, #0d9488)' },
  { name: 'Sunset', value: 'linear-gradient(to right, #fb923c, #db2777)' },
  { name: 'Night', value: 'linear-gradient(to right, #60a5fa, #4f46e5)' },
];

export default function StyleControls({ captionStyle, setCaptionStyle, setCaptionStyleRaw, addToHistory, selectedCaption, captions, setCaptions }) {
  // Detect script from captions and get appropriate fonts
  const [detectedScript, setDetectedScript] = React.useState('latin');
  const [availableFonts, setAvailableFonts] = React.useState(
    (scriptFontMap.latin).map(f => ({ value: f.name, label: f.name }))
  );

  const [customFontInput, setCustomFontInput] = useState('');

  const [googleFontsList, setGoogleFontsList] = useState([]);

  React.useEffect(() => {
    // Pre-fetch complete Google Fonts list for suggestions
    const fetchFullGoogleFonts = async () => {
      try {
        const res = await fetch('/api/fonts');
        const data = await res.json();
        if (data.fonts && data.fonts.length > 0) {
          setGoogleFontsList(data.fonts.map(f => ({ value: f.family, label: f.family })));
        }
      } catch (e) {
        console.warn('Failed to fetch full google fonts list', e);
      }
    };
    fetchFullGoogleFonts();
  }, []);

  React.useEffect(() => {
    if (captions && captions.length > 0) {
      const sampleText = captions.filter(c => !c.isTextElement).map(c => c.text).join(' ');
      if (sampleText.trim()) {
        const script = detectScript(sampleText);
        const prevScript = detectedScript;
        setDetectedScript(script);

        const scriptFonts = scriptFontMap[script] || scriptFontMap.latin;
        const fontList = scriptFonts.map(f => ({ value: f.name, label: f.name }));
        setAvailableFonts(fontList);

        if (script !== prevScript && script !== 'latin') {
          const firstFont = scriptFonts[0];
          if (firstFont) {
            loadGoogleFont(firstFont.name, firstFont.weights).catch(() => { });
          }
        }
      }
    }
  }, [captions]);
  // Check if we have a text element selected
  const selectedTextElement = selectedCaption?.isTextElement ? captions?.find(c => c.id === selectedCaption.id) : null;
  const [customTextColor1, setCustomTextColor1] = useState('#667eea');
  const [customTextColor2, setCustomTextColor2] = useState('#764ba2');
  const [customHighlightColor1, setCustomHighlightColor1] = useState('#f093fb');
  const [customHighlightColor2, setCustomHighlightColor2] = useState('#f5576c');
  const [textColorHex, setTextColorHex] = useState('#ffffff');
  const [highlightColorHex, setHighlightColorHex] = useState('#facc15');
  const [showTextGradient, setShowTextGradient] = useState(false);
  const [showHighlightGradient, setShowHighlightGradient] = useState(false);
  const [showTextSolid, setShowTextSolid] = useState(false);
  const [showHighlightSolid, setShowHighlightSolid] = useState(false);
  const [fontPopoverOpen, setFontPopoverOpen] = useState(false)
  const [effectsOpen, setEffectsOpen] = useState(false)

  const updateStyle = (key, value, skipHistory = false) => {
    // If a text element is selected, update its customStyle instead of global captionStyle
    if (selectedTextElement && setCaptions) {
      setCaptions(prev => prev.map(cap => {
        if (cap.id === selectedTextElement.id) {
          const customStyle = cap.customStyle || {};
          // Map captionStyle keys to customStyle keys
          const keyMap = {
            'font_family': 'fontFamily',
            'font_size': 'fontSize',
            'font_weight': 'fontWeight',
            'font_style': 'fontStyle',
            'text_color': 'color',
            'text_align': 'textAlign',
            'text_case': 'textTransform',
            'text_decoration': 'textDecoration',
            'has_background': 'hasBackground',
            'background_opacity': 'backgroundOpacity',
            'letter_spacing': 'letterSpacing',
            'line_spacing': 'lineSpacing',
            'text_anchor': 'textAnchor',
            'has_stroke': 'hasStroke',
            'stroke_width': 'strokeWidth',
            'stroke_color': 'strokeColor',
            'has_shadow': 'hasShadow',
            'shadow_color': 'shadowColor',
            'shadow_blur': 'shadowBlur',
            'shadow_offset_x': 'shadowOffsetX',
            'shadow_offset_y': 'shadowOffsetY',
            'background_color': 'backgroundColor',
            'background_padding': 'padding',
            'background_h_multiplier': 'backgroundHMultiplier',
            'left': 'left',
            'top': 'top',
            'text_gradient': 'textGradient',
            'highlight_color': 'highlightColor',
            'highlight_gradient': 'highlightGradient',
            'is_bold': 'isBold',
            'animation': 'animation',
          };
          const mappedKey = keyMap[key] || key;

          // Special handling for text_case
          let mappedValue = value;
          if (key === 'text_case') {
            mappedValue = value === 'uppercase' ? 'uppercase' : value === 'lowercase' ? 'lowercase' : value === 'capitalize' ? 'capitalize' : 'none';
          }

          // When font size changes, keep displaced words at same visual position by scaling offsets
          let updatedWordStyles = cap.wordStyles;
          if (key === 'font_size' && cap.wordStyles) {
            const oldFontSize = customStyle.fontSize || 18;
            const newFontSize = value;
            if (oldFontSize && newFontSize && oldFontSize !== newFontSize) {
              const ratio = newFontSize / oldFontSize;
              updatedWordStyles = {};
              Object.keys(cap.wordStyles).forEach(wKey => {
                const ws = cap.wordStyles[wKey];
                if ((ws.x !== undefined && ws.x !== 0) || (ws.y !== undefined && ws.y !== 0)) {
                  updatedWordStyles[wKey] = { ...ws, x: (ws.x || 0) * ratio, y: (ws.y || 0) * ratio };
                } else {
                  updatedWordStyles[wKey] = ws;
                }
              });
            }
          }

          return {
            ...cap,
            customStyle: { ...customStyle, [mappedKey]: mappedValue },
            wordStyles: updatedWordStyles
          };
        }
        return cap;
      }));
      return;
    }

    // Default: update global captionStyle (main captions)
    if (!captionStyle) return;

    // When font size changes for main captions, scale displaced word offsets proportionally
    if (key === 'font_size' && captions && setCaptions) {
      const oldFontSize = captionStyle.font_size || 18;
      const newFontSize = value;
      if (oldFontSize && newFontSize && oldFontSize !== newFontSize) {
        const ratio = newFontSize / oldFontSize;
        const captionUpdater = (typeof setCaptions === 'function') ? setCaptions : null;
        if (captionUpdater) {
          captionUpdater(prev => prev.map(c => {
            if (c.isTextElement || !c.wordStyles) return c;
            const scaledWordStyles = {};
            Object.keys(c.wordStyles).forEach(wKey => {
              const ws = c.wordStyles[wKey];
              if ((ws.x !== undefined && ws.x !== 0) || (ws.y !== undefined && ws.y !== 0)) {
                scaledWordStyles[wKey] = { ...ws, x: (ws.x || 0) * ratio, y: (ws.y || 0) * ratio };
              } else {
                scaledWordStyles[wKey] = ws;
              }
            });
            return { ...c, wordStyles: scaledWordStyles };
          }));
        }
      }
    }
    if (skipHistory && setCaptionStyleRaw) {
      setCaptionStyleRaw(prev => ({ ...prev, [key]: value }));
    } else if (setCaptionStyle) {
      setCaptionStyle(prev => ({ ...prev, [key]: value }));
    }
  };

  const createGradient = (color1, color2) => {
    return `linear-gradient(135deg, ${color1} 0%, ${color2} 100%)`;
  };

  const applyCustomTextGradient = (color1, color2) => {
    const gradient = createGradient(color1, color2);
    updateStyle('text_gradient', gradient);
    updateStyle('text_color', '#ffffff');
  };

  const applyCustomHighlightGradient = (color1, color2) => {
    const gradient = createGradient(color1, color2);
    updateStyle('highlight_gradient', gradient);
    updateStyle('highlight_color', '');
  };

  if (!captionStyle) return null;

  // Normalize font weight to numeric string
  const normalizeFontWeight = (weight) => {
    if (!weight) return '500';
    const w = String(weight);
    if (w === 'normal') return '400';
    if (w === 'bold') return '700';
    return w;
  };

  // Get current values - use text element's customStyle if selected, otherwise use global captionStyle
  const getCurrentValue = (key, defaultValue) => {
    if (selectedTextElement) {
      const keyMap = {
        'font_family': 'fontFamily',
        'font_size': 'fontSize',
        'font_weight': 'fontWeight',
        'font_style': 'fontStyle',
        'text_color': 'color',
        'text_align': 'textAlign',
        'text_case': 'textTransform',
        'letter_spacing': 'letterSpacing',
        'line_spacing': 'lineSpacing',
        'text_anchor': 'textAnchor',
        'has_stroke': 'hasStroke',
        'stroke_width': 'strokeWidth',
        'stroke_color': 'strokeColor',
        'has_shadow': 'hasShadow',
        'shadow_color': 'shadowColor',
        'shadow_blur': 'shadowBlur',
        'shadow_offset_x': 'shadowOffsetX',
        'shadow_offset_y': 'shadowOffsetY',
        'background_opacity': 'backgroundOpacity',
        'background_color': 'backgroundColor',
        'background_padding': 'padding',
        'background_h_multiplier': 'backgroundHMultiplier',
      };
      const mappedKey = keyMap[key] || key;
      const value = selectedTextElement.customStyle?.[mappedKey];

      if (key === 'font_weight') {
        return normalizeFontWeight(value || defaultValue);
      }

      return value ?? defaultValue;
    }
    return captionStyle[key] ?? defaultValue;
  };

  return (
    <div className="h-full overflow-y-auto pr-2 custom-scrollbar">
      <h2 className="text-lg font-semibold text-white mb-6">
        {selectedTextElement ? 'Text Element Styling' : 'Styling'}
      </h2>

      {selectedTextElement && (
        <div className="mb-4 p-3 rounded-lg bg-white/5 border border-white/10">
          <p className="text-xs text-gray-400 mb-1">Editing Text Element</p>
          <p className="text-sm text-white font-medium line-clamp-1">"{selectedTextElement.text}"</p>
        </div>
      )}

      <div className="space-y-6">

        {/* ── 1. POSITION ──────────────────────────── */}
        <div className="space-y-4">
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">TYPOGRAPHY</h3>

          {/* Font Family */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm text-gray-400">Font Family</Label>
              <span className="text-[10px] text-white bg-white/10 px-2 py-0.5 rounded">
                {scriptLabels[detectedScript] || detectedScript}
              </span>
            </div>
            <Popover open={fontPopoverOpen} onOpenChange={setFontPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between bg-zinc-900 border-white/10 text-white font-normal hover:bg-white/5 hover:text-white active:bg-white/10 transition-all h-10 px-3"
                  style={{ fontFamily: getCurrentValue('font_family', 'Inter') }}
                >
                  <span className="truncate flex-1 text-left text-[15px]">
                    {getCurrentValue('font_family', 'Inter')}
                  </span>
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50 text-gray-400" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[320px] p-0 bg-zinc-900 border-white/10 shadow-2xl rounded-xl overflow-hidden" align="start">
                <div className="flex items-center border-b border-white/10 px-3 py-2 bg-black/20">
                  <Search className="mr-2 h-4 w-4 shrink-0 opacity-50 text-gray-400" />
                  <Input
                    placeholder="Search fonts..."
                    className="flex h-9 w-full rounded-md bg-transparent text-sm outline-none placeholder:text-gray-500 text-white border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 px-0"
                    value={customFontInput}
                    onChange={(e) => setCustomFontInput(e.target.value)}
                  />
                </div>

                <div className="h-[360px] w-full bg-zinc-900/50">
                  {(() => {
                    const search = customFontInput.toLowerCase();
                    const allFonts = [...availableFonts];
                    const existingNames = new Set(allFonts.map(f => f?.value));

                    if (googleFontsList.length > 0) {
                      googleFontsList.forEach(f => {
                        if (!existingNames.has(f?.value)) {
                          allFonts.push(f);
                          existingNames.add(f?.value);
                        }
                      });
                    }
                    const sourceList = allFonts;

                    // Filter logic: match search.
                    let filtered = sourceList.filter(f => f?.value?.toLowerCase().includes(search));

                    // Sorting logic: Default -> Native Script -> All Others
                    // We execute this to prioritize all pre-loaded native language / highly readable text at the top
                    const defaultNames = availableFonts.map(f => f?.value);
                    const defaults = defaultNames.map(name => filtered.find(f => f?.value === name)).filter(Boolean);
                    const others = filtered.filter(f => !defaultNames.includes(f?.value));

                    filtered = [];
                    if (defaults.length > 0) {
                      filtered.push({ isHeader: true, label: "Default Fonts", value: "___header_default___" });
                      filtered.push(...defaults);
                    }
                    if (others.length > 0) {
                      filtered.push({ isHeader: true, label: "Google Fonts", value: "___header_google___" });
                      filtered.push(...others);
                    }

                    if (filtered.length === 0) {
                      return <div className="p-8 text-center text-sm text-gray-500 flex flex-col items-center justify-center h-full">
                        <Search className="w-8 h-8 text-gray-600 mb-2" />
                        No fonts found matching "{customFontInput}"
                      </div>;
                    }

                    return (
                      <List
                        height={360}
                        itemCount={filtered.length}
                        itemSize={44}
                        width={320}
                        itemData={{
                          items: filtered,
                          selectedValue: getCurrentValue('font_family', 'Inter'),
                          onSelect: (fontName) => {
                            setFontPopoverOpen(false);
                            updateStyle('font_family', fontName);
                            loadGoogleFont(fontName, [300, 400, 500, 600, 700, 800]).catch(() => {});
                          }
                        }}
                      >
                        {FontRow}
                      </List>
                    );
                  })()}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Font Size */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm text-gray-400">Font Size</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">{getCurrentValue('font_size', 18)}px</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => updateStyle('font_size', 18)}
                  className="h-5 w-5 text-gray-500 hover:text-white"
                >
                  <RotateCcw className="w-3 h-3" />
                </Button>
              </div>
            </div>
            <Slider
              value={[getCurrentValue('font_size', 18)]}
              onValueChange={([value]) => updateStyle('font_size', value, true)}
              onPointerDown={() => addToHistory && addToHistory()}
              min={12}
              max={60}
              step={1}
              className="cursor-pointer"
            />
          </div>

          {/* Line Spacing */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm text-gray-400">Line Spacing</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">{getCurrentValue('line_spacing', 1.4)}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => updateStyle('line_spacing', 1.4)}
                  className="h-5 w-5 text-gray-500 hover:text-white"
                >
                  <RotateCcw className="w-3 h-3" />
                </Button>
              </div>
            </div>
            <Slider
              value={[getCurrentValue('line_spacing', 1.4)]}
              onValueChange={([value]) => updateStyle('line_spacing', value, true)}
              onPointerDown={() => addToHistory && addToHistory()}
              min={1.0}
              max={2.5}
              step={0.1}
              className="cursor-pointer"
            />
          </div>

          {/* Font Style Selector */}
          <div>
            <Label className="text-sm text-gray-400 mb-2 block">Font Style</Label>
            <Select
              value={`${normalizeFontWeight(getCurrentValue('font_weight', '500'))}-${getCurrentValue('font_style', 'normal')}`}
              onValueChange={(value) => {
                const [weight, style] = value.split('-');
                updateStyle('font_weight', weight);
                updateStyle('font_style', style);
                if (!selectedTextElement) updateStyle('is_bold', parseInt(weight) >= 700);
              }}
            >
              <SelectTrigger className="bg-zinc-900 border-white/10 text-white">
                <SelectValue placeholder="Select style" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-white/10 max-h-80">
                <SelectItem value="300-normal" className="text-white hover:bg-white/10" style={{ fontWeight: '300' }}>Light</SelectItem>
                <SelectItem value="400-normal" className="text-white hover:bg-white/10" style={{ fontWeight: '400' }}>Regular</SelectItem>
                <SelectItem value="500-normal" className="text-white hover:bg-white/10" style={{ fontWeight: '500' }}>Medium</SelectItem>
                <SelectItem value="600-normal" className="text-white hover:bg-white/10" style={{ fontWeight: '600' }}>Semi Bold</SelectItem>
                <SelectItem value="700-normal" className="text-white hover:bg-white/10" style={{ fontWeight: '700' }}>Bold</SelectItem>
                <SelectItem value="800-normal" className="text-white hover:bg-white/10" style={{ fontWeight: '800' }}>Extra Bold</SelectItem>
                <SelectItem value="400-italic" className="text-white hover:bg-white/10" style={{ fontWeight: '400', fontStyle: 'italic' }}>Regular Italic</SelectItem>
                <SelectItem value="700-italic" className="text-white hover:bg-white/10" style={{ fontWeight: '700', fontStyle: 'italic' }}>Bold Italic</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Letter Spacing */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm text-gray-400">Letter Spacing</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">{getCurrentValue('letter_spacing', 0)}px</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => updateStyle('letter_spacing', 0)}
                  className="h-5 w-5 text-gray-500 hover:text-white"
                >
                  <RotateCcw className="w-3 h-3" />
                </Button>
              </div>
            </div>
            <Slider
              value={[getCurrentValue('letter_spacing', 0)]}
              onValueChange={([value]) => updateStyle('letter_spacing', value, true)}
              onPointerDown={() => addToHistory && addToHistory()}
              min={-5}
              max={10}
              step={0.5}
              className="cursor-pointer"
            />
          </div>

          {/* Word Spacing - hide for text elements */}
          {!selectedTextElement && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm text-gray-400">Word Spacing</Label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{captionStyle.word_spacing || 1}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => updateStyle('word_spacing', 1)}
                    className="h-5 w-5 text-gray-500 hover:text-white"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              <Slider
                value={[captionStyle.word_spacing || 1]}
                onValueChange={([value]) => updateStyle('word_spacing', value, true)}
                onPointerDown={() => addToHistory && addToHistory()}
                min={0}
                max={10}
                step={1}
                className="cursor-pointer"
              />
            </div>
          )}
        </div>

        {/* ── 2. POSITION ────────────────────────────── */}
        <div className="space-y-4 pt-4 border-t border-white/5">
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">POSITION</h3>

          {/* Position Y */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm text-gray-400">Position Y</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">{selectedTextElement ? Math.round(selectedTextElement.customStyle?.top || 50) : (captionStyle.position_y || 75)}%</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => updateStyle(selectedTextElement ? 'top' : 'position_y', selectedTextElement ? 50 : 75)}
                  className="h-5 w-5 text-gray-500 hover:text-white"
                >
                  <RotateCcw className="w-3 h-3" />
                </Button>
              </div>
            </div>
            <Slider
              value={[selectedTextElement ? (selectedTextElement.customStyle?.top || 50) : (captionStyle.position_y || 75)]}
              onValueChange={([value]) => updateStyle(selectedTextElement ? 'top' : 'position_y', value, true)}
              onPointerDown={() => addToHistory && addToHistory()}
              min={5}
              max={95}
              step={1}
              className="cursor-pointer"
            />
          </div>

          {/* Position X */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm text-gray-400">Position X</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">{selectedTextElement ? Math.round(selectedTextElement.customStyle?.left || 50) : (captionStyle.position_x || 50)}%</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => updateStyle(selectedTextElement ? 'left' : 'position_x', 50)}
                  className="h-5 w-5 text-gray-500 hover:text-white"
                >
                  <RotateCcw className="w-3 h-3" />
                </Button>
              </div>
            </div>
            <Slider
              value={[selectedTextElement ? (selectedTextElement.customStyle?.left || 50) : (captionStyle.position_x || 50)]}
              onValueChange={([value]) => updateStyle(selectedTextElement ? 'left' : 'position_x', value, true)}
              onPointerDown={() => addToHistory && addToHistory()}
              min={0}
              max={100}
              step={1}
              className="cursor-pointer"
            />
          </div>

          {/* Text Alignment */}
          <div>
            <Label className="text-sm text-gray-400 mb-2 block">Text Alignment</Label>
            <div className="bg-zinc-900 border border-white/5 rounded-lg p-1 flex gap-1">
              <button
                onClick={() => { updateStyle('text_align', 'left'); if (!selectedTextElement) updateStyle('position_x', 10); }}
                className={`flex-1 flex items-center justify-center py-1.5 rounded-md transition-all ${getCurrentValue('text_align', 'center') === 'left'
                  ? "bg-white text-black shadow-sm"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
              >
                <AlignLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => { updateStyle('text_align', 'center'); if (!selectedTextElement) updateStyle('position_x', 50); }}
                className={`flex-1 flex items-center justify-center py-1.5 rounded-md transition-all ${getCurrentValue('text_align', 'center') === 'center'
                  ? "bg-white text-black shadow-sm"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
              >
                <AlignCenter className="w-4 h-4" />
              </button>
              <button
                onClick={() => { updateStyle('text_align', 'right'); if (!selectedTextElement) updateStyle('position_x', 90); }}
                className={`flex-1 flex items-center justify-center py-1.5 rounded-md transition-all ${getCurrentValue('text_align', 'center') === 'right'
                  ? "bg-white text-black shadow-sm"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
              >
                <AlignRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Case */}
          <div>
            <Label className="text-sm text-gray-400 mb-2 block">Case</Label>
            <div className="bg-zinc-900 border border-white/5 rounded-lg p-1 flex gap-1">
              <button
                onClick={() => {
                  updateStyle('text_case', 'lowercase');
                  if (!selectedTextElement) updateStyle('is_caps', false);
                }}
                className={`flex-1 flex items-center justify-center py-1.5 rounded-md text-xs font-medium transition-all ${getCurrentValue('text_case', 'none') === 'lowercase'
                  ? "bg-white text-black shadow-sm"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
              >
                aa
              </button>
              <button
                onClick={() => {
                  updateStyle('text_case', 'capitalize');
                  if (!selectedTextElement) updateStyle('is_caps', false);
                }}
                className={`flex-1 flex items-center justify-center py-1.5 rounded-md text-xs font-medium transition-all ${getCurrentValue('text_case', 'none') === 'capitalize'
                  ? "bg-white text-black shadow-sm"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
              >
                Aa
              </button>
              <button
                onClick={() => {
                  updateStyle('text_case', 'uppercase');
                  if (!selectedTextElement) updateStyle('is_caps', true);
                }}
                className={`flex-1 flex items-center justify-center py-1.5 rounded-md text-xs font-medium transition-all ${(getCurrentValue('text_case', 'none') === 'uppercase' || (!selectedTextElement && captionStyle.is_caps))
                  ? "bg-white text-black shadow-sm"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
              >
                AA
              </button>
            </div>
          </div>
        </div>

        {/* ── 3. COLORS ─────────────────────────────── */}
        <div className="space-y-4 pt-4 border-t border-white/5">
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">COLORS</h3>

          {/* Text Color */}
          <div>
            <Label className="text-sm text-gray-400 mb-2 block">Text Color</Label>

            {/* Solid Toggle */}
            <button
              onClick={() => setShowTextSolid(!showTextSolid)}
              className="flex items-center justify-between w-full text-xs text-gray-400 hover:text-gray-300"
            >
              <span>Solid</span>
              <span className="text-lg font-bold leading-none">{showTextSolid ? '−' : '+'}</span>
            </button>

            {/* Color Grid - 7 in first row, 2 in second */}
            {showTextSolid && (
              <div className="mb-3 mt-2">
                <div className="grid grid-cols-7 gap-1.5 mb-1.5">
                  <button
                    onClick={() => {
                      updateStyle('text_color', '#ffffff');
                      updateStyle('text_gradient', '');
                    }}
                    className={`h-8 rounded-md border-2 flex items-center justify-center ${captionStyle.text_color === '#ffffff' && !captionStyle.text_gradient
                      ? 'border-white'
                      : 'border-white/10'
                      } bg-zinc-800`}
                  >
                    <span className="text-[9px] text-gray-500">None</span>
                  </button>
                  {presetColors.slice(0, 6).map(color => (
                    <button
                      key={color}
                      onClick={() => {
                        updateStyle('text_color', color);
                        updateStyle('text_gradient', '');
                      }}
                      className={`h-8 rounded-md border-2 transition-all ${captionStyle.text_color === color && !captionStyle.text_gradient
                        ? 'border-white scale-105'
                        : 'border-white/10 hover:border-white/30'
                        }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {presetColors.slice(6, 9).map(color => (
                    <button
                      key={color}
                      onClick={() => {
                        updateStyle('text_color', color);
                        updateStyle('text_gradient', '');
                      }}
                      className={`h-8 rounded-md border-2 transition-all ${captionStyle.text_color === color && !captionStyle.text_gradient
                        ? 'border-white scale-105'
                        : 'border-white/10 hover:border-white/30'
                        }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <div></div>
                </div>
              </div>
            )}

            {/* Color Picker */}
            <div className="flex items-center gap-2 p-2 mt-3 rounded-lg bg-white/[0.02] border border-white/5">
              <input
                type="color"
                value={captionStyle.text_color || '#ffffff'}
                onChange={(e) => {
                  updateStyle('text_color', e.target.value);
                  updateStyle('text_gradient', '');
                }}
                className="w-8 h-8 rounded cursor-pointer bg-transparent"
              />
              <span className="text-xs text-gray-400">Color Picker</span>
            </div>

            {/* Gradient Toggle */}
            <button
              onClick={() => setShowTextGradient(!showTextGradient)}
              className="flex items-center justify-between w-full mt-3 text-xs text-gray-400 hover:text-gray-300"
            >
              <span>Gradient</span>
              <span className="text-lg font-bold leading-none">{showTextGradient ? '−' : '+'}</span>
            </button>

            {showTextGradient && (
              <>
                <div className="mb-3 mt-2">
                  <div className="grid grid-cols-4 gap-1.5 mb-1.5">
                    <button
                      onClick={() => {
                        updateStyle('text_gradient', '');
                        updateStyle('text_color', '#ffffff');
                      }}
                      className={`h-8 rounded-md border-2 flex items-center justify-center ${!captionStyle.text_gradient
                        ? 'border-white'
                        : 'border-white/10'
                        } bg-zinc-800`}
                    >
                      <span className="text-[9px] text-gray-500">None</span>
                    </button>
                    {presetGradients.slice(0, 3).map(gradient => (
                      <button
                        key={gradient.value}
                        onClick={() => {
                          updateStyle('text_gradient', gradient.value);
                          updateStyle('text_color', '#ffffff');
                        }}
                        className={`h-8 rounded-md border-2 transition-all ${captionStyle.text_gradient === gradient.value
                          ? 'border-white scale-105'
                          : 'border-white/10 hover:border-white/30'
                          }`}
                        style={{ background: gradient.value }}
                      />
                    ))}
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {presetGradients.slice(3, 6).map(gradient => (
                      <button
                        key={gradient.value}
                        onClick={() => {
                          updateStyle('text_gradient', gradient.value);
                          updateStyle('text_color', '#ffffff');
                        }}
                        className={`h-8 rounded-md border-2 transition-all ${captionStyle.text_gradient === gradient.value
                          ? 'border-white scale-105'
                          : 'border-white/10 hover:border-white/30'
                          }`}
                        style={{ background: gradient.value }}
                      />
                    ))}
                  </div>
                </div>

                {/* Custom Gradient Picker */}
                <div className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/5">
                  <Plus className="w-5 h-5 text-gray-300" />
                  <input
                    type="color"
                    value={customTextColor1}
                    onChange={(e) => {
                      setCustomTextColor1(e.target.value);
                      applyCustomTextGradient(e.target.value, customTextColor2);
                    }}
                    className="w-8 h-8 rounded cursor-pointer bg-transparent"
                  />
                  <input
                    type="color"
                    value={customTextColor2}
                    onChange={(e) => {
                      setCustomTextColor2(e.target.value);
                      applyCustomTextGradient(customTextColor1, e.target.value);
                    }}
                    className="w-8 h-8 rounded cursor-pointer bg-transparent"
                  />
                  <span className="text-xs text-gray-500">Custom</span>
                </div>
              </>
            )}
          </div>

          {/* Highlight Word */}
          <div>
            <Label className="text-sm text-gray-400 mb-2 block">Highlight Word</Label>

            {/* Solid Toggle */}
            <button
              onClick={() => setShowHighlightSolid(!showHighlightSolid)}
              className="flex items-center justify-between w-full text-xs text-gray-400 hover:text-gray-300"
            >
              <span>Solid</span>
              <span className="text-lg font-bold leading-none">{showHighlightSolid ? '−' : '+'}</span>
            </button>

            {/* Color Grid - 7 in first row, 2 in second */}
            {showHighlightSolid && (
              <div className="mb-3 mt-2">
                <div className="grid grid-cols-7 gap-1.5 mb-1.5">
                  <button
                    onClick={() => {
                      updateStyle('highlight_color', '');
                      updateStyle('highlight_gradient', '');
                    }}
                    className={`h-8 rounded-md border-2 flex items-center justify-center ${!captionStyle.highlight_color && !captionStyle.highlight_gradient
                      ? 'border-white'
                      : 'border-white/10'
                      } bg-zinc-800`}
                  >
                    <span className="text-[9px] text-gray-500">None</span>
                  </button>
                  {['#fef08a', '#22c55e', '#3b82f6', '#F5A623', '#ec4899', '#ff6b35'].map(color => (
                    <button
                      key={color}
                      onClick={() => {
                        updateStyle('highlight_color', color);
                        updateStyle('highlight_gradient', '');
                      }}
                      className={`h-8 rounded-md border-2 transition-all ${captionStyle.highlight_color === color && !captionStyle.highlight_gradient
                        ? 'border-white scale-105'
                        : 'border-white/10 hover:border-white/30'
                        }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {['#fb923c', '#E91E63'].map(color => (
                    <button
                      key={color}
                      onClick={() => {
                        updateStyle('highlight_color', color);
                        updateStyle('highlight_gradient', '');
                      }}
                      className={`h-8 rounded-md border-2 transition-all ${captionStyle.highlight_color === color && !captionStyle.highlight_gradient
                        ? 'border-white scale-105'
                        : 'border-white/10 hover:border-white/30'
                        }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <div></div>
                </div>
              </div>
            )}

            {/* Color Picker */}
            <div className="flex items-center gap-2 p-2 mt-3 rounded-lg bg-white/[0.02] border border-white/5">
              <input
                type="color"
                value={captionStyle.highlight_color || '#facc15'}
                onChange={(e) => {
                  updateStyle('highlight_color', e.target.value);
                  updateStyle('highlight_gradient', '');
                }}
                className="w-8 h-8 rounded cursor-pointer bg-transparent"
              />
              <span className="text-xs text-gray-400">Color Picker</span>
            </div>

            {/* Gradient Toggle */}
            <button
              onClick={() => setShowHighlightGradient(!showHighlightGradient)}
              className="flex items-center justify-between w-full mt-3 text-xs text-gray-400 hover:text-gray-300"
            >
              <span>Gradient</span>
              <span className="text-lg font-bold leading-none">{showHighlightGradient ? '−' : '+'}</span>
            </button>

            {showHighlightGradient && (
              <>
                <div className="mb-3 mt-2">
                  <div className="grid grid-cols-4 gap-1.5 mb-1.5">
                    <button
                      onClick={() => {
                        updateStyle('highlight_gradient', '');
                        updateStyle('highlight_color', '');
                      }}
                      className={`h-8 rounded-md border-2 flex items-center justify-center ${!captionStyle.highlight_gradient
                        ? 'border-white'
                        : 'border-white/10'
                        } bg-zinc-800`}
                    >
                      <span className="text-[9px] text-gray-500">None</span>
                    </button>
                    {presetGradients.slice(0, 3).map(gradient => (
                      <button
                        key={gradient.value}
                        onClick={() => {
                          updateStyle('highlight_gradient', gradient.value);
                          updateStyle('highlight_color', '');
                        }}
                        className={`h-8 rounded-md border-2 transition-all ${captionStyle.highlight_gradient === gradient.value
                          ? 'border-white scale-105'
                          : 'border-white/10 hover:border-white/30'
                          }`}
                        style={{ background: gradient.value }}
                      />
                    ))}
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {presetGradients.slice(3, 6).map(gradient => (
                      <button
                        key={gradient.value}
                        onClick={() => {
                          updateStyle('highlight_gradient', gradient.value);
                          updateStyle('highlight_color', '');
                        }}
                        className={`h-8 rounded-md border-2 transition-all ${captionStyle.highlight_gradient === gradient.value
                          ? 'border-white scale-105'
                          : 'border-white/10 hover:border-white/30'
                          }`}
                        style={{ background: gradient.value }}
                      />
                    ))}
                  </div>
                </div>

                {/* Custom Gradient Picker */}
                <div className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/5">
                  <Plus className="w-5 h-5 text-gray-300" />
                  <input
                    type="color"
                    value={customHighlightColor1}
                    onChange={(e) => {
                      setCustomHighlightColor1(e.target.value);
                      applyCustomHighlightGradient(e.target.value, customHighlightColor2);
                    }}
                    className="w-8 h-8 rounded cursor-pointer bg-transparent"
                  />
                  <input
                    type="color"
                    value={customHighlightColor2}
                    onChange={(e) => {
                      setCustomHighlightColor2(e.target.value);
                      applyCustomHighlightGradient(customHighlightColor1, e.target.value);
                    }}
                    className="w-8 h-8 rounded cursor-pointer bg-transparent"
                  />
                  <span className="text-xs text-gray-500">Custom</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── 4. BACKGROUND ─────────────────────────── */}
        <div className="space-y-4 pt-4 border-t border-white/5">
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">BACKGROUND</h3>

          {/* Background Toggle */}
          <div className="flex items-center justify-between">
            <Label className="text-sm text-gray-400">Background</Label>
            <Switch
              checked={selectedTextElement ? (selectedTextElement.customStyle?.hasBackground !== false) : !!captionStyle.has_background}
              onCheckedChange={(checked) => updateStyle('has_background', checked)}
            />
          </div>

          {(selectedTextElement ? (selectedTextElement.customStyle?.hasBackground !== false) : !!captionStyle.has_background) && (
            <>
              <div>
                <Label className="text-sm text-gray-400 mb-2 block">Background Color</Label>
                <input
                  type="color"
                  value={selectedTextElement ? (selectedTextElement.customStyle?.backgroundColor || '#000000') : (captionStyle.background_color || '#000000')}
                  onChange={(e) => {
                    if (selectedTextElement && setCaptions) {
                      setCaptions(prev => prev.map(cap => cap.id === selectedTextElement.id ? { ...cap, customStyle: { ...cap.customStyle, backgroundColor: e.target.value } } : cap));
                    } else {
                      updateStyle('background_color', e.target.value);
                    }
                  }}
                  className="w-10 h-10 rounded cursor-pointer border-0 outline-none"
                  style={{ borderWidth: '0' }}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm text-gray-400">Background Opacity</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{Math.round((getCurrentValue('background_opacity', 0.7)) * 100)}%</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => updateStyle('background_opacity', 0.7)}
                      className="h-5 w-5 text-gray-500 hover:text-white"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                <Slider
                  value={[(getCurrentValue('background_opacity', 0.7)) * 100]}
                  onValueChange={([value]) => updateStyle('background_opacity', value / 100, true)}
                  onPointerDown={() => addToHistory && addToHistory()}
                  min={0}
                  max={100}
                  step={5}
                  className="cursor-pointer"
                />
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm text-gray-400">Background Thickness (V)</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">{selectedTextElement ? (selectedTextElement.customStyle?.padding ?? 8) : (captionStyle.background_padding ?? 3)}px</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (selectedTextElement && setCaptions) {
                            setCaptions(prev => prev.map(cap => cap.id === selectedTextElement.id ? { ...cap, customStyle: { ...cap.customStyle, padding: 8 } } : cap));
                          } else {
                            updateStyle('background_padding', 3);
                          }
                        }}
                        className="h-5 w-5 text-gray-500 hover:text-white"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  <Slider
                    value={[selectedTextElement ? (selectedTextElement.customStyle?.padding ?? 8) : (captionStyle.background_padding ?? 3)]}
                    onValueChange={([value]) => {
                      if (selectedTextElement && setCaptions) {
                        setCaptions(prev => prev.map(cap => cap.id === selectedTextElement.id ? { ...cap, customStyle: { ...cap.customStyle, padding: value } } : cap));
                      } else {
                        updateStyle('background_padding', value, true);
                      }
                    }}
                    onPointerDown={() => addToHistory && addToHistory()}
                    min={2}
                    max={40}
                    step={1}
                    className="cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm text-gray-400">Background Thickness (H)</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">{((getCurrentValue('background_h_multiplier', 0.99) - 1) * 100).toFixed(2)}px</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => updateStyle('background_h_multiplier', 0.99)}
                        className="h-5 w-5 text-gray-500 hover:text-white"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  <Slider
                    value={[Math.round(getCurrentValue('background_h_multiplier', 0.99) * 100)]}
                    onValueChange={([value]) => updateStyle('background_h_multiplier', value / 100, true)}
                    onPointerDown={() => addToHistory && addToHistory()}
                    min={50}
                    max={300}
                    step={1}
                    className="cursor-pointer"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── 5. EFFECTS ────────────────────────────── */}
        <div className="space-y-4 pt-4 border-t border-white/5">
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">EFFECTS</h3>

          {/* Effects Section — collapsible */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <button
              onClick={() => setEffectsOpen(v => !v)}
              className="w-full flex items-center justify-between text-sm font-semibold text-white mb-1 group"
            >
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-white" />
                Effects
                {getCurrentValue('effect_type', 'none') !== 'none' && (
                  <span className="text-[10px] bg-white/10 text-white px-1.5 py-0.5 rounded-full font-medium capitalize">
                    {getCurrentValue('effect_type')}
                  </span>
                )}
              </span>
              <span className={`w-5 h-5 rounded border border-white/20 flex items-center justify-center text-gray-400 group-hover:border-white/50 group-hover:text-white transition-colors ${effectsOpen ? 'bg-white/10 border-white/30 text-white' : ''}`}>
                {effectsOpen ? '−' : '+'}
              </span>
            </button>

            {effectsOpen && (
              <div className="mt-3">
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {[
                    { id: 'none', label: 'None' },
                    { id: 'shadow', label: 'Shadow' },
                    { id: 'lift', label: 'Lift' },
                    { id: 'hollow', label: 'Hollow' },
                    { id: 'splice', label: 'Splice' },
                    { id: 'outline', label: 'Outline' },
                    { id: 'echo', label: 'Echo' },
                    { id: 'neon', label: 'Neon' }
                  ].map(effect => {
                    const isSelected = getCurrentValue('effect_type', 'none') === effect.id
                    return (
                      <button
                        key={effect.id}
                        onClick={() => {
                          updateStyle('effect_type', effect.id)
                          if (effect.id !== 'none') {
                            if (effect.id === 'neon') {
                              if (getCurrentValue('effect_blur') === undefined) updateStyle('effect_blur', 8)
                              if (getCurrentValue('effect_intensity') === undefined) updateStyle('effect_intensity', 5)
                              if (getCurrentValue('effect_color') === undefined) updateStyle('effect_color', getCurrentValue('text_color', '#ffffff'))
                            } else {
                              if (getCurrentValue('effect_blur') === undefined) updateStyle('effect_blur', 50)
                              if (getCurrentValue('effect_intensity') === undefined) updateStyle('effect_intensity', 50)
                              if (getCurrentValue('effect_color') === undefined) updateStyle('effect_color', '#000000')
                            }
                            if (getCurrentValue('effect_offset') === undefined) updateStyle('effect_offset', 50)
                            if (getCurrentValue('effect_direction') === undefined) updateStyle('effect_direction', -45)
                            if (getCurrentValue('effect_transparency') === undefined) updateStyle('effect_transparency', 40)
                            if (getCurrentValue('effect_thickness') === undefined) updateStyle('effect_thickness', 50)
                          }
                        }}
                        className={`p-2 rounded-lg border text-xs text-center transition-all duration-200 ${isSelected
                          ? 'bg-white/10 border-white/40 text-white font-medium'
                          : 'bg-zinc-800/50 border-white/5 text-gray-400 hover:bg-zinc-800 hover:border-white/20'
                        }`}
                      >
                        {effect.label}
                      </button>
                    )
                  })}
                </div>

                {/* Effect Specific Sliders */}
                {getCurrentValue('effect_type', 'none') !== 'none' && (
                  <div className="space-y-4 p-3 rounded-xl bg-black/20 border border-white/5">
                    {['hollow', 'splice', 'outline'].includes(getCurrentValue('effect_type')) && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label className="text-xs text-gray-400">Thickness</Label>
                          <span className="text-xs text-gray-500">{getCurrentValue('effect_thickness', 50)}</span>
                        </div>
                        <Slider value={[getCurrentValue('effect_thickness', 50)]} onValueChange={([val]) => updateStyle('effect_thickness', val, true)} onPointerDown={() => addToHistory && addToHistory()} max={100} step={1} className="cursor-pointer" />
                      </div>
                    )}
                    {['shadow', 'splice', 'echo', 'lift'].includes(getCurrentValue('effect_type')) && (
                      <>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <Label className="text-xs text-gray-400">Offset</Label>
                            <span className="text-xs text-gray-500">{getCurrentValue('effect_offset', 50)}</span>
                          </div>
                          <Slider value={[getCurrentValue('effect_offset', 50)]} onValueChange={([val]) => updateStyle('effect_offset', val, true)} onPointerDown={() => addToHistory && addToHistory()} max={100} step={1} className="cursor-pointer" />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <Label className="text-xs text-gray-400">Direction</Label>
                            <span className="text-xs text-gray-500">{getCurrentValue('effect_direction', -45)}°</span>
                          </div>
                          <Slider value={[getCurrentValue('effect_direction', -45)]} onValueChange={([val]) => updateStyle('effect_direction', val, true)} onPointerDown={() => addToHistory && addToHistory()} min={-180} max={180} step={1} className="cursor-pointer" />
                        </div>
                      </>
                    )}
                    {['shadow', 'neon', 'lift'].includes(getCurrentValue('effect_type')) && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label className="text-xs text-gray-400">Blur</Label>
                          <span className="text-xs text-gray-500">{getCurrentValue('effect_blur', 50)}</span>
                        </div>
                        <Slider value={[getCurrentValue('effect_blur', 50)]} onValueChange={([val]) => updateStyle('effect_blur', val, true)} onPointerDown={() => addToHistory && addToHistory()} max={100} step={1} className="cursor-pointer" />
                      </div>
                    )}
                    {['shadow', 'echo'].includes(getCurrentValue('effect_type')) && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label className="text-xs text-gray-400">Transparency</Label>
                          <span className="text-xs text-gray-500">{getCurrentValue('effect_transparency', 40)}</span>
                        </div>
                        <Slider value={[getCurrentValue('effect_transparency', 40)]} onValueChange={([val]) => updateStyle('effect_transparency', val, true)} onPointerDown={() => addToHistory && addToHistory()} max={100} step={1} className="cursor-pointer" />
                      </div>
                    )}
                    {['neon'].includes(getCurrentValue('effect_type')) && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label className="text-xs text-gray-400">Intensity</Label>
                          <span className="text-xs text-gray-500">{getCurrentValue('effect_intensity', 50)}</span>
                        </div>
                        <Slider value={[getCurrentValue('effect_intensity', 50)]} onValueChange={([val]) => updateStyle('effect_intensity', val, true)} onPointerDown={() => addToHistory && addToHistory()} max={100} step={1} className="cursor-pointer" />
                      </div>
                    )}
                    {!['lift'].includes(getCurrentValue('effect_type')) && (
                      <div>
                        <Label className="text-xs text-gray-400 mb-2 block">Color</Label>
                        <input type="color" value={getCurrentValue('effect_color', '#000000')} onChange={(e) => updateStyle('effect_color', e.target.value)} className="w-10 h-8 rounded cursor-pointer border border-white/10 bg-transparent" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
        </div>
        </div>

        {/* ── 6. CAPTION SETTINGS ─────────────────── */}
        {!selectedTextElement && (
        <div className="space-y-4 pt-4 border-t border-white/5">
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">CAPTION SETTINGS</h3>

          {/* Display Mode */}
          <div>
            <Label className="text-sm text-gray-400 mb-2 block">Display Mode</Label>
            <Select
              value={captionStyle.display_mode || 'sentence'}
              onValueChange={(value) => {
                updateStyle('display_mode', value)
                // map to show_inactive: sentence → true, word_by_word → false
                updateStyle('show_inactive', value === 'sentence')
              }}
            >
              <SelectTrigger className="bg-zinc-900 border-white/10 text-white h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-white/10">
                <SelectItem value="sentence" className="text-white hover:bg-white/10 focus:bg-white/10 focus:text-white">Sentence</SelectItem>
                <SelectItem value="word_by_word" className="text-white hover:bg-white/10 focus:bg-white/10 focus:text-white">Word by Word</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        )}

      </div>
    </div>
  );
}