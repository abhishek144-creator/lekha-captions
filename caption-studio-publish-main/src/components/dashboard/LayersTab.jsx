import React from 'react';
import { Captions, Eye, Layers, Plus, Type, X } from 'lucide-react';

const BRAND_KIT_STORAGE_KEY = 'captionStudio.brandKits.v1';
const BRAND_KIT_STYLE_FIELDS = [
  'font_family',
  'font_size',
  'font_weight',
  'font_style',
  'line_spacing',
  'word_spacing',
  'letter_spacing',
  'text_align',
  'text_case',
  'text_color',
  'text_gradient',
  'text_opacity',
  'highlight_color',
  'highlight_gradient',
  'secondary_color',
  'has_background',
  'background_color',
  'background_opacity',
  'background_padding',
  'background_h_multiplier',
  'has_stroke',
  'stroke_width',
  'stroke_color',
  'has_shadow',
  'shadow_color',
  'shadow_blur',
  'shadow_offset_x',
  'shadow_offset_y',
  'position_x',
  'position_y',
];

function readBrandKits() {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(BRAND_KIT_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((kit) => kit?.id && kit?.style) : [];
  } catch {
    return [];
  }
}

function extractBrandKitStyle(style = {}) {
  return BRAND_KIT_STYLE_FIELDS.reduce((kitStyle, field) => {
    if (style[field] !== undefined) kitStyle[field] = style[field];
    return kitStyle;
  }, {});
}

export default function LayersTab({
  captions = [],
  selectedCaptionId,
  setSelectedCaptionId,
  onSeek,
  captionStyle,
  setCaptionStyle,
  addToHistory,
}) {
  const captionLayers = captions.filter((caption) => !caption.isTextElement);
  const textLayers = captions.filter((caption) => caption.isTextElement);
  const layers = [...textLayers, ...captionLayers].sort((a, b) => (a.start_time || 0) - (b.start_time || 0));
  const [brandKits, setBrandKits] = React.useState(() => readBrandKits());

  React.useEffect(() => {
    try {
      window.localStorage.setItem(BRAND_KIT_STORAGE_KEY, JSON.stringify(brandKits));
    } catch {
      // Brand kits are a convenience preset; editing should continue if storage is unavailable.
    }
  }, [brandKits]);

  const formatTime = (seconds = 0) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getCurrentValue = (key, fallback) => captionStyle?.[key] ?? fallback;

  const saveBrandKit = () => {
    if (!captionStyle) return;
    const nextIndex = brandKits.length + 1;
    const nextKit = {
      id: `brand-kit-${Date.now()}`,
      name: `Brand Kit ${nextIndex}`,
      style: extractBrandKitStyle(captionStyle),
    };
    setBrandKits((current) => [nextKit, ...current].slice(0, 8));
  };

  const applyBrandKit = (kit) => {
    if (!kit?.style || !setCaptionStyle) return;
    addToHistory?.();
    setCaptionStyle((current) => ({
      ...current,
      ...kit.style,
      template_color_customized: Boolean(current?.template_id || kit.style.template_color_customized),
    }));
  };

  const deleteBrandKit = (kitId) => {
    setBrandKits((current) => current.filter((kit) => kit.id !== kitId));
  };

  return (
    <div className="h-full flex flex-col text-white">
      <div className="mb-4">
        <p className="text-[10px] uppercase tracking-[0.32em] text-slate-400">Layers</p>
        <h2 className="text-lg font-semibold mt-1">Scene Stack</h2>
        <p className="text-xs text-slate-500 mt-1">
          Select captions and text elements without leaving the editor flow.
        </p>
      </div>

      <div className="mb-4 rounded-lg border border-white/10 bg-white/[0.035] p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-slate-400">Brand Kits</p>
            <p className="mt-1 truncate text-[10px] text-slate-500">
              {getCurrentValue('font_family', 'Inter')} - {getCurrentValue('position_y', 75)}%
            </p>
          </div>
          <button
            type="button"
            onClick={saveBrandKit}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.05] px-2.5 text-[10px] font-semibold text-slate-200 transition-colors hover:bg-white/[0.09]"
          >
            <Plus className="h-3.5 w-3.5" />
            Save
          </button>
        </div>
        {brandKits.length > 0 && (
          <div className="space-y-2">
            {brandKits.map((kit) => (
              <div key={kit.id} className="flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-2 py-2">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="h-4 w-4 shrink-0 rounded-full border border-white/20" style={{ backgroundColor: kit.style?.text_color || '#ffffff' }} />
                  <span className="truncate text-[11px] font-semibold text-white">{kit.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => applyBrandKit(kit)}
                  className="rounded-md border border-white/10 px-2 py-1 text-[10px] font-semibold text-slate-300 transition-colors hover:bg-white/[0.08] hover:text-white"
                >
                  Apply
                </button>
                <button
                  type="button"
                  onClick={() => deleteBrandKit(kit.id)}
                  aria-label={`Delete ${kit.name}`}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-white/10 text-slate-500 transition-colors hover:bg-white/[0.08] hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <Captions className="w-4 h-4 text-sky-300 mb-2" />
          <p className="text-xl font-semibold">{captionLayers.length}</p>
          <p className="text-[10px] uppercase tracking-widest text-slate-500">Captions</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <Type className="w-4 h-4 text-amber-300 mb-2" />
          <p className="text-xl font-semibold">{textLayers.length}</p>
          <p className="text-[10px] uppercase tracking-widest text-slate-500">Text</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-2">
        {layers.length === 0 ? (
          <div className="h-full min-h-[260px] rounded-2xl border border-dashed border-white/10 bg-white/[0.02] flex flex-col items-center justify-center text-center p-6">
            <Layers className="w-8 h-8 text-slate-600 mb-3" />
            <p className="text-sm font-medium text-slate-300">No layers yet</p>
            <p className="text-xs text-slate-500 mt-1">Upload a video or add text to build the stack.</p>
          </div>
        ) : (
          layers.map((layer, index) => {
            const isSelected = selectedCaptionId === layer.id;
            const Icon = layer.isTextElement ? Type : Captions;
            return (
              <button
                key={layer.id}
                onClick={() => {
                  setSelectedCaptionId(layer.id);
                  if (onSeek) onSeek(layer.start_time || 0);
                }}
                className={`w-full text-left rounded-2xl border p-3 transition-all ${
                  isSelected
                    ? 'border-sky-300/50 bg-sky-300/10 shadow-[0_0_24px_rgba(125,211,252,0.08)]'
                    : 'border-white/10 bg-[#111]/70 hover:border-white/20 hover:bg-white/[0.05]'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 rounded-xl p-2 ${layer.isTextElement ? 'bg-amber-300/10 text-amber-200' : 'bg-sky-300/10 text-sky-200'}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                        {layer.isTextElement ? 'Text' : `Caption ${index + 1}`}
                      </p>
                      <span className="text-[10px] font-mono text-slate-500">
                        {formatTime(layer.start_time)} - {formatTime(layer.end_time)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-medium text-white line-clamp-2">
                      {layer.text || 'Untitled layer'}
                    </p>
                  </div>
                  <Eye className={`w-4 h-4 mt-1 ${isSelected ? 'text-sky-200' : 'text-slate-600'}`} />
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
