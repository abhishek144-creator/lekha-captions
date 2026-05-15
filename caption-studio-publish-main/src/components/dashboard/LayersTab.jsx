import React from 'react';
import { Captions, Eye, Layers, Type } from 'lucide-react';

export default function LayersTab({
  captions = [],
  selectedCaptionId,
  setSelectedCaptionId,
  onSeek,
}) {
  const captionLayers = captions.filter((caption) => !caption.isTextElement);
  const textLayers = captions.filter((caption) => caption.isTextElement);
  const layers = [...textLayers, ...captionLayers].sort((a, b) => (a.start_time || 0) - (b.start_time || 0));

  const formatTime = (seconds = 0) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
