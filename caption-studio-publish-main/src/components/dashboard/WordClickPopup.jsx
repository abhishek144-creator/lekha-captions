import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Edit3,
  X,
  Type,
  Palette,
  Plus,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Sparkles,
  Move,
  RotateCcw
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from '@/components/ui/switch';
import { motion, useDragControls } from 'framer-motion';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FixedSizeList as List } from 'react-window';
import { loadGoogleFont, detectScript, scriptFontMap } from './fontUtils';
import { Check, Search, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';

const FontRow = React.memo(({ data, index, style }) => {
  const font = data.items[index];
  const isSelected = font ? data.selectedValue === font.value : false;

  React.useEffect(() => {
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
      className={`flex items-center px-3 cursor-pointer transition-colors hover:bg-white/10 hover:text-white ${isSelected ? 'bg-purple-500/20 text-purple-400 font-medium' : 'text-white'}`}
      onClick={(e) => {
        e.stopPropagation();
        data.onSelect(font.value);
      }}
    >
      <span style={{ fontFamily: font.value, fontSize: '15px' }} className="truncate flex-1">
        {font.label}
      </span>
      {isSelected && <Check className="ml-1 h-4 w-4 shrink-0 text-purple-400" />}
    </div>
  );
});
FontRow.displayName = 'FontRow';


const fonts = [
  { value: 'Inter', label: 'Inter' },
  { value: 'Montserrat', label: 'Montserrat' },
  { value: 'Poppins', label: 'Poppins' },
  { value: 'Roboto', label: 'Roboto' },
  { value: 'Open Sans', label: 'Open Sans' },
  { value: 'Lato', label: 'Lato' },
  { value: 'Oswald', label: 'Oswald' },
  { value: 'Bebas Neue', label: 'Bebas Neue' },
  { value: 'Playfair Display', label: 'Playfair' },
];

const presetColors = [
  '#ffffff', '#000000', '#facc15', '#ef4444',
  '#3b82f6', '#a855f7', '#ec4899', '#22c55e'
];

const presetGradients = [
  'linear-gradient(to right, #facc15, #ef4444)', // Yellow-Red (Fire)
  'linear-gradient(to right, #a855f7, #3b82f6)', // Purple-Blue (Electric)
  'linear-gradient(to right, #06b6d4, #2563eb)', // Cyan-DeepBlue (Ocean)
  'linear-gradient(to right, #ec4899, #8b5cf6)', // Pink-Purple (Magic)
  'linear-gradient(to right, #4ade80, #0d9488)', // Green-Teal (Nature)
  'linear-gradient(to right, #fb923c, #db2777)', // Orange-Pink (Sunset)
  'linear-gradient(to right, #60a5fa, #4f46e5)', // Blue-Indigo (Night)
];

const wordAnimations = [
  { value: 'none', label: 'None' },
  { value: 'rise', label: 'Rise' },
  { value: 'pan', label: 'Pan' },
  { value: 'fade', label: 'Fade' },
  { value: 'pop', label: 'Pop' },
  { value: 'wipe', label: 'Wipe' },
  { value: 'blur', label: 'Blur' },
  { value: 'succession', label: 'Succession' },
  { value: 'breathe', label: 'Breathe' },
  { value: 'baseline', label: 'Baseline' },
  { value: 'drift', label: 'Drift' },
  { value: 'tectonic', label: 'Tectonic' },
  { value: 'tumble', label: 'Tumble' }
];

export default function WordClickPopup({ word, position, onEdit, onClose, onResetPosition, currentStyle, onStyleChange, onHistoryRecord, videoContainerRef, isElementWord }) {
  const dragControls = useDragControls();

  // Local state for active tab - Font first as requested
  const [activeTab, setActiveTab] = useState('font');
  const [showTextGradient, setShowTextGradient] = useState(false);
  const [showHighlightGradient, setShowHighlightGradient] = useState(false);
  const [customColor1, setCustomColor1] = useState('#f8fafc'); // light
  const [customColor2, setCustomColor2] = useState('#334155'); // dark
  const createGradient = (c1, c2) => `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`;

  const [customFontInput, setCustomFontInput] = useState('');
  const [googleFontsList, setGoogleFontsList] = useState([])
  const [effectsOpen, setEffectsOpen] = useState(false)

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

  if (!position) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-transparent"
        onClick={(e) => {
          onClose();
        }}
      />

      {/* Popup Panel - Anchored to right of video preview, vertically centered */}
      <motion.div
        drag
        dragListener={false}
        dragControls={dragControls}
        dragMomentum={false}
        className="fixed z-50 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden w-80"
        style={{
          position: 'fixed',
          top: '120px',
          // Adjusted to 360px to clear the right sidebar and sit beside the canvas
          right: '360px',
          maxHeight: 'calc(100vh - 200px)',
          backgroundColor: 'rgba(24, 24, 27, 0.95)',
          backdropFilter: 'blur(12px)',
        }}
      >
        {/* Header with Drag Handle */}
        <div
          className="flex items-center justify-between p-3 border-b border-white/5 bg-white/5 cursor-move"
          onPointerDown={(e) => dragControls.start(e)}
        >
          <div className="flex items-center gap-2 max-w-[240px]">
            <Move className="w-4 h-4 text-gray-500 shrink-0" />
            <div className="flex flex-col overflow-hidden">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider leading-none">Editing:</span>
              <span className="text-xs font-bold text-white truncate leading-tight">{word}</span>
            </div>
          </div>
          <div className="flex gap-2">
            {((currentStyle.x !== undefined && currentStyle.x !== 0) || (currentStyle.y !== undefined && currentStyle.y !== 0)) && onResetPosition && (
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onResetPosition) onResetPosition();
                }}
                className="h-6 w-6 text-yellow-500 hover:text-yellow-400 hover:bg-yellow-500/10"
                title="Reset Position"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-6 w-6 text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Tabs - Reordered: Font, Style, FX */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">

          <TabsList className="w-full grid grid-cols-3 rounded-none bg-transparent border-b border-white/5 p-0 h-10">
            <TabsTrigger
              value="font"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-purple-500 data-[state=active]:bg-transparent data-[state=active]:text-white text-gray-500 h-10 text-xs"
            >
              <Type className="w-3.5 h-3.5 mr-1.5" />
              Font
            </TabsTrigger>
            <TabsTrigger
              value="style"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-purple-500 data-[state=active]:bg-transparent data-[state=active]:text-white text-gray-500 h-10 text-xs"
            >
              <Palette className="w-3.5 h-3.5 mr-1.5" />
              Style
            </TabsTrigger>
            <TabsTrigger
              value="fx"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-purple-500 data-[state=active]:bg-transparent data-[state=active]:text-white text-gray-500 h-10 text-xs"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              Animate
            </TabsTrigger>
          </TabsList>

          <div
            className="p-4 max-h-[calc(100vh-320px)] overflow-y-auto custom-scrollbar bg-zinc-950/95"
            onPointerDown={(e) => e.stopPropagation()}
          >

            {/* Font Tab (Now First) */}
            <TabsContent value="font" className="space-y-4 mt-0">
              {/* Font Family */}
              <div className="z-50 relative">
                <label className="text-xs text-gray-500 mb-2 block uppercase tracking-wider">Font Family</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between h-8 bg-zinc-900 border-white/10 text-white text-xs hover:bg-zinc-800 hover:text-white">
                      <span className="truncate" style={{ fontFamily: currentStyle.fontFamily || 'Inter' }}>
                        {currentStyle.fontFamily || 'Inter'}
                      </span>
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[260px] p-0 bg-zinc-900 border-white/10" align="start">
                    <div className="p-2 border-b border-white/10 sticky top-0 bg-zinc-900 z-10 flex gap-2">
                      <div className="relative flex-1 text-white">
                        <Search className="absolute left-2 top-2 h-4 w-4 text-gray-500" />
                        <Input
                          placeholder="Search 1000+ fonts..."
                          className="pl-8 h-8 bg-black/50 border-white/10 text-xs"
                          value={customFontInput}
                          onChange={(e) => setCustomFontInput(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="h-[360px] w-full bg-zinc-900/50">
                      {(() => {
                        const search = customFontInput.toLowerCase();
                        const detectedScript = detectScript(word || 'a');
                        const options = scriptFontMap[detectedScript] || scriptFontMap.latin;
                        const availableFonts = options.map(f => ({ value: f.name, label: f.name }));

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

                        let filtered = sourceList.filter(f => f?.value?.toLowerCase().includes(search));

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
                            width={260}
                            itemData={{
                              items: filtered,
                              selectedValue: currentStyle.fontFamily || 'Inter',
                              onSelect: async (val) => {
                                try {
                                  await loadGoogleFont(val, [300, 400, 500, 600, 700, 800]);
                                  onStyleChange('fontFamily', val);
                                } catch (error) {
                                  console.warn('Font load error:', error);
                                }
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
                <div className="flex justify-between mb-1">
                  <label className="text-xs text-gray-500 uppercase tracking-wider">Size</label>
                  <span className="text-xs text-white">{currentStyle.fontSize || 18}px</span>
                </div>
                <Slider
                  value={[currentStyle.fontSize || 18]}
                  onValueChange={([val]) => onStyleChange('fontSize', val)}
                  onPointerDown={() => onHistoryRecord && onHistoryRecord()}
                  min={12}
                  max={60}
                  step={1}
                  className="cursor-pointer"
                />
              </div>

              {/* Emphasis */}
              <div>
                <label className="text-xs text-amber-500 mb-2 block uppercase tracking-wider font-semibold">Emphasis</label>
                <button
                  className="flex items-center justify-center font-bold px-2 border transition-none"
                  style={{
                    height: '24px',
                    fontSize: '10px',
                    borderRadius: '6px',
                    backgroundColor: currentStyle.isEmphasis ? (currentStyle.color || '#ffffff') : 'transparent',
                    color: currentStyle.isEmphasis ? '#000000' : (currentStyle.color || '#ffffff'),
                    borderColor: currentStyle.isEmphasis ? (currentStyle.color || '#ffffff') : '#ffffff33'
                  }}
                  onClick={() => onStyleChange('isEmphasis', !currentStyle.isEmphasis)}
                >
                  <Sparkles style={{ width: '12px', height: '12px', marginRight: '6px' }} />
                  {currentStyle.isEmphasis ? 'EMPHASIZED' : 'EMPHASIZE'}
                </button>
              </div>

              {/* Formatting */}
              <div>
                <label className="text-xs text-gray-500 mb-2 block uppercase tracking-wider">Formatting</label>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className={`h-8 w-8 p-0 ${currentStyle.fontWeight === 'bold' ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                    onClick={() => onStyleChange('fontWeight', currentStyle.fontWeight === 'bold' ? 'normal' : 'bold')}
                  >
                    <Bold className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className={`h-8 w-8 p-0 ${currentStyle.fontStyle === 'italic' ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                    onClick={() => onStyleChange('fontStyle', currentStyle.fontStyle === 'italic' ? 'normal' : 'italic')}
                  >
                    <Italic className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className={`h-8 w-8 p-0 ${currentStyle.textDecoration === 'underline' ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                    onClick={() => onStyleChange('textDecoration', currentStyle.textDecoration === 'underline' ? 'none' : 'underline')}
                  >
                    <Underline className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className={`h-8 w-8 p-0 ${currentStyle.textDecoration === 'line-through' ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                    onClick={() => onStyleChange('textDecoration', currentStyle.textDecoration === 'line-through' ? 'none' : 'line-through')}
                  >
                    <Strikethrough className="w-4 h-4" />
                  </Button>
                </div>

                {/* Text Transform */}
                <div className="mt-3">
                  <label className="text-xs text-gray-500 mb-2 block uppercase tracking-wider">Casing</label>
                  <div className="flex bg-white/5 rounded-md p-0.5">
                    {['none', 'uppercase', 'lowercase', 'capitalize'].map((casing) => (
                      <button
                        key={casing}
                        onClick={() => onStyleChange('textTransform', casing)}
                        className={`flex-1 py-1 text-[10px] rounded transition-all ${(currentStyle.textTransform === casing || (!currentStyle.textTransform && casing === 'none'))
                          ? 'bg-purple-600 text-white'
                          : 'text-gray-400 hover:text-white'
                          }`}
                      >
                        {casing === 'none' ? 'Aa' : casing === 'uppercase' ? 'AA' : casing === 'lowercase' ? 'aa' : 'A'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Position Controls */}
                <div className="mt-3 pt-3 border-t border-white/5">
                  <label className="text-xs text-gray-500 mb-2 block uppercase tracking-wider">Position</label>

                  {/* Position X - Real-time binding */}
                  <div className="mb-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-gray-400">Position X</span>
                      <input
                        type="number"
                        value={Math.round(currentStyle.x || 0)}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          onStyleChange('x', val);
                        }}
                        className="w-16 px-1.5 py-0.5 text-[10px] text-white bg-zinc-800 border border-white/10 rounded text-right"
                      />
                    </div>
                    <Slider
                      value={[currentStyle.x || 0]}
                      onValueChange={([val]) => onStyleChange('x', Math.round(val), true)}
                      onPointerDown={() => onHistoryRecord && onHistoryRecord()}
                      min={-300}
                      max={300}
                      step={1}
                      className="cursor-pointer"
                    />
                  </div>

                  {/* Position Y - Real-time binding */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-gray-400">Position Y</span>
                      <input
                        type="number"
                        value={Math.round(currentStyle.y || 0)}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          onStyleChange('y', val);
                        }}
                        className="w-16 px-1.5 py-0.5 text-[10px] text-white bg-zinc-800 border border-white/10 rounded text-right"
                      />
                    </div>
                    <Slider
                      value={[currentStyle.y || 0]}
                      onValueChange={([val]) => onStyleChange('y', Math.round(val), true)}
                      onPointerDown={() => onHistoryRecord && onHistoryRecord()}
                      min={-300}
                      max={300}
                      step={1}
                      className="cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Style Tab (Now Second) */}
            <TabsContent value="style" className="space-y-4 mt-0">
              <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded text-[10px] text-blue-200/80 mb-2">
                Styles here apply to this specific word.
              </div>
              {/* Color */}
              <div>
                <label className="text-xs text-gray-500 mb-2 block uppercase tracking-wider">Color</label>
                <div className="grid grid-cols-8 gap-1 mb-2">
                  {presetColors.map(color => (
                    <button
                      key={color}
                      onClick={() => {
                        onStyleChange('color', color);
                        onStyleChange('textGradient', '');
                      }}
                      className={`h-6 rounded border transition-all ${(currentStyle.color === color && !currentStyle.textGradient)
                        ? 'border-white scale-110'
                        : 'border-white/10 hover:border-white/30'
                        }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <div className="text-xs text-gray-400">Custom:</div>
                  <input
                    type="color"
                    value={currentStyle.color || '#ffffff'}
                    onChange={(e) => {
                      onStyleChange('color', e.target.value);
                      onStyleChange('textGradient', '');
                    }}
                    className="w-8 h-8 rounded bg-white/5 border border-white/10 cursor-pointer"
                  />
                </div>
              </div>

              {/* Text Gradient Toggle */}
              <button
                onClick={() => setShowTextGradient(!showTextGradient)}
                className="flex items-center justify-between w-full mt-3 text-xs text-gray-400 hover:text-gray-300"
              >
                <span>Text Gradient</span>
                <span>{showTextGradient ? '−' : '+'}</span>
              </button>

              {showTextGradient && (
                <div className="mb-3 mt-2">
                  <div className="grid grid-cols-4 gap-1.5 mb-2">
                    <button
                      onClick={() => onStyleChange('textGradient', '')}
                      className={`h-8 rounded-md border-2 flex items-center justify-center ${!currentStyle.textGradient ? 'border-white' : 'border-white/10'
                        } bg-zinc-800`}
                    >
                      <span className="text-[9px] text-gray-500">None</span>
                    </button>
                    {presetGradients.map(gradient => (
                      <button
                        key={gradient}
                        onClick={() => onStyleChange('textGradient', gradient)}
                        className={`h-8 rounded-md border-2 transition-all ${currentStyle.textGradient === gradient
                          ? 'border-white scale-105'
                          : 'border-white/10 hover:border-white/30'
                          }`}
                        style={{ background: gradient }}
                      />
                    ))}
                  </div>

                  {/* Custom Gradient Picker */}
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/5">
                    <Plus className="w-4 h-4 text-gray-500" />
                    <input
                      type="color"
                      value={customColor1}
                      onChange={(e) => {
                        setCustomColor1(e.target.value);
                        onStyleChange('textGradient', createGradient(e.target.value, customColor2));
                      }}
                      className="w-8 h-8 rounded cursor-pointer bg-transparent"
                    />
                    <input
                      type="color"
                      value={customColor2}
                      onChange={(e) => {
                        setCustomColor2(e.target.value);
                        onStyleChange('textGradient', createGradient(customColor1, e.target.value));
                      }}
                      className="w-8 h-8 rounded cursor-pointer bg-transparent"
                    />
                    <span className="text-xs text-gray-500">Custom</span>
                  </div>
                </div>
              )}

              {/* Background for Word - Auto-detects state */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-gray-500 uppercase tracking-wider">Background</label>
                  <Switch
                    checked={!!currentStyle.backgroundColor || !!currentStyle.highlightGradient}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        onStyleChange('backgroundColor', '#000000');
                        onStyleChange('backgroundOpacity', 0.65);
                      } else {
                        onStyleChange('backgroundColor', '');
                        onStyleChange('highlightGradient', '');
                        onStyleChange('backgroundOpacity', 0);
                      }
                    }}
                  />
                </div>
                {!!currentStyle.backgroundColor && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-gray-400">Color:</div>
                      <input
                        type="color"
                        value={currentStyle.backgroundColor}
                        onChange={(e) => onStyleChange('backgroundColor', e.target.value)}
                        className="w-8 h-8 rounded bg-white/5 border border-white/10 cursor-pointer"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-[10px] text-gray-400">Opacity</span>
                        <span className="text-[10px] text-gray-400">{Math.round((currentStyle.backgroundOpacity ?? 0.65) * 100)}%</span>
                      </div>
                      <Slider
                        value={[(currentStyle.backgroundOpacity ?? 0.65) * 100]}
                        onValueChange={([val]) => onStyleChange('backgroundOpacity', val / 100, true)}
                        onPointerDown={() => onHistoryRecord && onHistoryRecord()}
                        min={0}
                        max={100}
                        step={5}
                        className="cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-[10px] text-gray-400">Padding</span>
                        <span className="text-[10px] text-gray-400">{currentStyle.backgroundPadding || 2}px</span>
                      </div>
                      <Slider
                        value={[currentStyle.backgroundPadding || 2]}
                        onValueChange={([val]) => {
                          if (onHistoryRecord) onHistoryRecord();
                          onStyleChange('backgroundPadding', val, false);
                        }}
                        min={2}
                        max={12}
                        step={1}
                        className="cursor-pointer"
                      />
                    </div>
                  </div>
                )}

                {/* Highlight Gradient Toggle (Inside Background Section) */}
                <button
                  onClick={() => setShowHighlightGradient(!showHighlightGradient)}
                  className="flex items-center justify-between w-full mt-3 text-xs text-gray-400 hover:text-gray-300"
                >
                  <span>Highlight Gradient</span>
                  <span>{showHighlightGradient ? '−' : '+'}</span>
                </button>

                {showHighlightGradient && (
                  <div className="mb-3 mt-2">
                    <div className="grid grid-cols-4 gap-1.5 mb-2">
                      <button
                        onClick={() => onStyleChange('highlightGradient', '')}
                        className={`h-8 rounded-md border-2 flex items-center justify-center ${!currentStyle.highlightGradient ? 'border-white' : 'border-white/10'
                          } bg-zinc-800`}
                      >
                        <span className="text-[9px] text-gray-500">None</span>
                      </button>
                      {presetGradients.map(gradient => (
                        <button
                          key={gradient}
                          onClick={() => onStyleChange('highlightGradient', gradient)}
                          className={`h-8 rounded-md border-2 transition-all ${currentStyle.highlightGradient === gradient
                            ? 'border-white scale-105'
                            : 'border-white/10 hover:border-white/30'
                            }`}
                          style={{ background: gradient }}
                        />
                      ))}
                    </div>

                    {/* Custom Highlight Gradient Picker */}
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/5">
                      <Plus className="w-4 h-4 text-gray-500" />
                      <input
                        type="color"
                        value={customColor1}
                        onChange={(e) => {
                          setCustomColor1(e.target.value);
                          onStyleChange('highlightGradient', createGradient(e.target.value, customColor2));
                        }}
                        className="w-8 h-8 rounded cursor-pointer bg-transparent"
                      />
                      <input
                        type="color"
                        value={customColor2}
                        onChange={(e) => {
                          setCustomColor2(e.target.value);
                          onStyleChange('highlightGradient', createGradient(customColor1, e.target.value));
                        }}
                        className="w-8 h-8 rounded cursor-pointer bg-transparent"
                      />
                      <span className="text-xs text-gray-500">Custom</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Effects Section — collapsible */}
              <div className="mt-4 pt-4 border-t border-white/5">
                <button
                  onClick={() => setEffectsOpen(v => !v)}
                  className="w-full flex items-center justify-between text-xs text-gray-400 uppercase tracking-wider mb-1 group"
                >
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-[#F5A623]" />
                    Effects
                    {(currentStyle.effectType || 'none') !== 'none' && (
                      <span className="normal-case text-[9px] bg-[#F5A623]/15 text-[#F5A623] px-1.5 py-0.5 rounded-full font-medium capitalize">
                        {currentStyle.effectType}
                      </span>
                    )}
                  </span>
                  <span className={`w-4 h-4 rounded border border-white/20 flex items-center justify-center text-gray-500 text-[10px] group-hover:border-[#F5A623]/40 group-hover:text-[#F5A623] transition-colors ${effectsOpen ? 'bg-[#F5A623]/10 border-[#F5A623]/30 text-[#F5A623]' : ''}`}>
                    {effectsOpen ? '−' : '+'}
                  </span>
                </button>

                {effectsOpen && (
                  <>
                    <div className="grid grid-cols-4 gap-1.5 mb-2 mt-2">
                      {[
                        { id: 'none', label: 'None' },
                        { id: 'shadow', label: 'Shadow' },
                        { id: 'lift', label: 'Lift' },
                        { id: 'hollow', label: 'Hollow' },
                        { id: 'splice', label: 'Splice' },
                        { id: 'outline', label: 'Outline' },
                        { id: 'echo', label: 'Echo' },
                        { id: 'neon', label: 'Neon' }
                      ].map(effect => (
                        <button
                          key={effect.id}
                          onClick={() => {
                            onStyleChange('effectType', effect.id)
                            if (effect.id !== 'none') {
                              if (effect.id === 'neon') {
                                if (currentStyle.effectBlur === undefined) onStyleChange('effectBlur', 8)
                                if (currentStyle.effectIntensity === undefined) onStyleChange('effectIntensity', 5)
                                if (currentStyle.effectColor === undefined) onStyleChange('effectColor', currentStyle.color || '#ffffff')
                              } else {
                                if (currentStyle.effectBlur === undefined) onStyleChange('effectBlur', 50)
                                if (currentStyle.effectIntensity === undefined) onStyleChange('effectIntensity', 50)
                                if (currentStyle.effectColor === undefined) onStyleChange('effectColor', '#000000')
                              }
                              if (currentStyle.effectOffset === undefined) onStyleChange('effectOffset', 50)
                              if (currentStyle.effectDirection === undefined) onStyleChange('effectDirection', -45)
                              if (currentStyle.effectTransparency === undefined) onStyleChange('effectTransparency', 40)
                              if (currentStyle.effectThickness === undefined) onStyleChange('effectThickness', 50)
                            }
                          }}
                          className={`p-1.5 rounded border text-[10px] text-center transition-colors ${(currentStyle.effectType || 'none') === effect.id
                            ? 'bg-[#F5A623]/15 border-[#F5A623]/60 text-white font-medium'
                            : 'bg-zinc-800/50 border-white/10 text-gray-400 hover:bg-zinc-800 hover:border-white/20'
                          }`}
                        >
                          {effect.label}
                        </button>
                      ))}
                    </div>

                    {/* Effect Specific Sliders */}
                    {(currentStyle.effectType || 'none') !== 'none' && (
                      <div className="space-y-3 p-2 rounded-lg bg-black/20 border border-white/5">
                        {['hollow', 'splice', 'outline'].includes(currentStyle.effectType) && (
                          <div>
                            <div className="flex justify-between mb-1"><span className="text-[10px] text-gray-400">Thickness</span><span className="text-[10px] text-gray-500">{currentStyle.effectThickness ?? 50}</span></div>
                            <Slider value={[currentStyle.effectThickness ?? 50]} onValueChange={([val]) => onStyleChange('effectThickness', val)} max={100} step={1} />
                          </div>
                        )}
                        {['shadow', 'splice', 'echo', 'lift'].includes(currentStyle.effectType) && (
                          <>
                            <div>
                              <div className="flex justify-between mb-1"><span className="text-[10px] text-gray-400">Offset</span><span className="text-[10px] text-gray-500">{currentStyle.effectOffset ?? 50}</span></div>
                              <Slider value={[currentStyle.effectOffset ?? 50]} onValueChange={([val]) => onStyleChange('effectOffset', val)} max={100} step={1} />
                            </div>
                            <div>
                              <div className="flex justify-between mb-1"><span className="text-[10px] text-gray-400">Direction</span><span className="text-[10px] text-gray-500">{currentStyle.effectDirection ?? -45}°</span></div>
                              <Slider value={[currentStyle.effectDirection ?? -45]} onValueChange={([val]) => onStyleChange('effectDirection', val)} min={-180} max={180} step={1} />
                            </div>
                          </>
                        )}
                        {['shadow', 'neon', 'lift'].includes(currentStyle.effectType) && (
                          <div>
                            <div className="flex justify-between mb-1"><span className="text-[10px] text-gray-400">Blur</span><span className="text-[10px] text-gray-500">{currentStyle.effectBlur ?? 50}</span></div>
                            <Slider value={[currentStyle.effectBlur ?? 50]} onValueChange={([val]) => onStyleChange('effectBlur', val)} max={100} step={1} />
                          </div>
                        )}
                        {['shadow', 'echo'].includes(currentStyle.effectType) && (
                          <div>
                            <div className="flex justify-between mb-1"><span className="text-[10px] text-gray-400">Transparency</span><span className="text-[10px] text-gray-500">{currentStyle.effectTransparency ?? 40}</span></div>
                            <Slider value={[currentStyle.effectTransparency ?? 40]} onValueChange={([val]) => onStyleChange('effectTransparency', val)} max={100} step={1} />
                          </div>
                        )}
                        {['neon'].includes(currentStyle.effectType) && (
                          <div>
                            <div className="flex justify-between mb-1"><span className="text-[10px] text-gray-400">Intensity</span><span className="text-[10px] text-gray-500">{currentStyle.effectIntensity ?? 50}</span></div>
                            <Slider value={[currentStyle.effectIntensity ?? 50]} onValueChange={([val]) => onStyleChange('effectIntensity', val)} max={100} step={1} />
                          </div>
                        )}
                        {!['lift'].includes(currentStyle.effectType) && (
                          <div>
                            <span className="text-[10px] text-gray-400 mb-1 block">Color</span>
                            <input type="color" value={currentStyle.effectColor || '#000000'} onChange={(e) => onStyleChange('effectColor', e.target.value)} className="w-8 h-6 rounded border border-white/10" />
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>



              {/* Actions */}
              <div className="pt-4">
                <Button
                  onClick={onEdit}
                  className="w-full bg-white/10 hover:bg-white/20 text-white"
                  size="sm"
                >
                  <Edit3 className="w-3 h-3 mr-2" />
                  Edit Text Content
                </Button>
              </div>
            </TabsContent>

            {/* FX Tab */}
            <TabsContent value="fx" className="space-y-4 mt-0">
              {/* Animation */}
              <div>
                <label className="text-xs text-gray-500 mb-2 block uppercase tracking-wider">Animation</label>
                <div className="grid grid-cols-3 gap-2">
                  {wordAnimations.map((anim) => (
                    <button
                      key={anim.value}
                      onClick={() => onStyleChange('animation', anim.value)}
                      className={`px-2 py-1.5 rounded text-xs capitalize transition-all border ${(currentStyle.animation === anim.value || (!currentStyle.animation && anim.value === 'none'))
                        ? 'bg-purple-600 border-purple-500 text-white shadow-sm'
                        : 'bg-zinc-900 border-white/10 text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                      {anim.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Speed Slider — only shown when an animation is active */}
              {currentStyle.animation && currentStyle.animation !== 'none' && (
                <div className="pt-2 border-t border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-gray-500 uppercase tracking-wider">Speed</label>
                    <span className="text-xs text-purple-300 font-semibold">
                      {(currentStyle.animationSpeed || 1).toFixed(2)}x
                    </span>
                  </div>
                  <Slider
                    value={[currentStyle.animationSpeed || 1]}
                    onValueChange={([val]) => onStyleChange('animationSpeed', val)}
                    min={0.25}
                    max={3}
                    step={0.25}
                    className="cursor-pointer"
                  />
                  <div className="flex justify-between mt-1">
                    <span className="text-[10px] text-gray-600">0.25x Slow</span>
                    <span className="text-[10px] text-gray-600">3x Fast</span>
                  </div>
                </div>
              )}

              {/* Note about limitations */}
              <div className="p-2 bg-yellow-500/10 border border-yellow-500/20 rounded text-[10px] text-yellow-200/80 space-y-1">
                <p>Some styles might overlap with global caption styles.</p>
                <p className="opacity-80">These animations apply to this specific word only.</p>
              </div>
            </TabsContent>
          </div>
        </Tabs >
      </motion.div >
    </>
  );
}