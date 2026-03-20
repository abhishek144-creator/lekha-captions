import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Split,
  Trash2,
  Plus,
  Clock,
  GripVertical,
  Edit3,
  Info,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";



export default function CaptionEditor({
  captions,
  setCaptions,
  selectedCaptionId,
  setSelectedCaptionId,
  onSeek,
  onOpenWordPopup,
  wordPopup,
  user
}) {
  const selectedCaption = captions?.find(c => c.id === selectedCaptionId);
  const [showAutoTip, setShowAutoTip] = useState(false);

  useEffect(() => {
    if (!user?.email) return;
    const key = `pro_tip_shown_${user.email}`;
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, 'true');
      setShowAutoTip(true);
      const timer = setTimeout(() => setShowAutoTip(false), 8000);
      return () => clearTimeout(timer);
    }
  }, [user?.email]);

  const updateCaption = (id, updates) => {
    setCaptions(prev => prev.map(c =>
      c.id === id ? { ...c, ...updates } : c
    ));
  };

  const deleteCaption = (id) => {
    setCaptions(prev => prev.filter(c => c.id !== id));
    setSelectedCaptionId(null);
  };

  const splitCaption = (id, cursorPosition) => {
    const caption = captions.find(c => c.id === id);
    if (!caption || !caption.text) return;

    const text = caption.text || '';
    if (!text.trim()) return;

    // Split at cursor position
    const textArea = document.querySelector(`textarea[data-caption-id="${id}"]`);
    const position = textArea ? textArea.selectionStart : Math.floor(text.length / 2);

    const firstHalf = text.substring(0, position).trim();
    const secondHalf = text.substring(position).trim();

    if (!firstHalf || !secondHalf) return;

    const midTime = ((caption.start_time || 0) + (caption.end_time || 0)) / 2;

    const newCaptions = captions.flatMap(c => {
      if (c.id === id) {
        return [
          { ...c, text: firstHalf, end_time: midTime },
          {
            id: `${Date.now()}-split`,
            text: secondHalf,
            start_time: midTime,
            end_time: c.end_time
          }
        ];
      }
      return c;
    });

    setCaptions(newCaptions);
  };

  const addCaption = () => {
    const lastCaption = captions && captions.length > 0 ? captions[captions.length - 1] : null;
    const newStart = lastCaption ? (lastCaption.end_time || 0) + 0.5 : 0;

    const newCaption = {
      id: `${Date.now()}`,
      text: 'New caption',
      start_time: newStart,
      end_time: newStart + 2
    };

    setCaptions([...(captions || []), newCaption]);
    setSelectedCaptionId(newCaption.id);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    return `${mins}:${secs.padStart(4, '0')}`;
  };



  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-white">Captions</h2>
        <div className="flex items-center gap-1.5">
          <Button
            onClick={addCaption}
            size="sm"
            className="bg-white hover:bg-gray-100 text-black h-8 px-2.5"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add
          </Button>
        </div>
      </div>

      {/* Caption list */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
        <AnimatePresence>
          {captions?.filter(cap => cap && cap.id && !cap.isTextElement).map((caption, index) => (
            <motion.div
              key={caption.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className={`group rounded-xl border transition-all cursor-pointer overflow-hidden ${selectedCaptionId === caption.id
                ? 'bg-[#0F0F12] border-[#F5A623]/30 shadow-2xl shadow-[#F5A623]/30'
                : 'bg-white/[0.02] border-white/5 hover:border-white/10 hover:bg-white/[0.04]'
                }`}
              onClick={() => {
                setSelectedCaptionId(caption.id);
                onSeek(caption.start_time);
              }}
            >
              <div className="p-3">
                <div className="flex items-start gap-2">
                  <GripVertical className="w-4 h-4 text-gray-600 mt-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-mono text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">
                        #{index + 1}
                      </span>
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(caption.start_time || 0)} - {formatTime(caption.end_time || 0)}
                        <TooltipProvider>
                          <Tooltip open={index === 0 && showAutoTip ? true : undefined} delayDuration={300}>
                            <TooltipTrigger asChild>
                              <div className="ml-1 inline-flex items-center">
                                <Info className={`w-3 h-3 cursor-help ${index === 0 && showAutoTip ? 'text-blue-400' : 'text-gray-500 hover:text-white'}`} />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent
                              side="top"
                              sideOffset={5}
                              className={index === 0 && showAutoTip
                                ? "bg-zinc-950 border border-blue-500/30 p-0 shadow-2xl z-[9999] rounded-lg"
                                : "bg-zinc-900 text-white border-white/10 z-[9999]"
                              }
                            >
                              {index === 0 && showAutoTip ? (
                                <div className="w-64 p-3 relative">
                                  <div className="flex justify-between items-start gap-2 mb-1">
                                    <span className="font-semibold text-sm text-blue-200">Pro Tip</span>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setShowAutoTip(false); }}
                                      className="text-gray-400 hover:text-white p-0.5 rounded-full hover:bg-white/10"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                  <p className="text-sm leading-snug text-gray-200">
                                    Click on any <span className="text-white font-medium">single word</span> in the video preview to drag & edit its style independently.
                                  </p>
                                </div>
                              ) : (
                                <p>Click on any single word to drag & edit its style</p>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </span>
                    </div>

                    {selectedCaptionId === caption.id ? (
                      <div className="space-y-3">
                        {wordPopup && wordPopup.caption && wordPopup.caption.id === caption.id && (
                          <div className="flex items-center gap-2 mb-2 p-2 rounded bg-[#F5A623]/30 border border-[#F5A623]/30">
                            <span className="text-xs text-[#F5A623]">selected word - </span>
                            <span className="text-xs font-semibold text-white bg-[#F5A623]/30 px-1.5 py-0.5 rounded border border-[#F5A623]/30 truncate max-w-[150px]">
                              {wordPopup.word}
                            </span>
                          </div>
                        )}
                        <Textarea
                          value={caption.text || ''}
                          onChange={(e) => updateCaption(caption.id, { text: e.target.value })}
                          className="bg-black/50 border-white/10 text-white text-sm resize-none mb-3"
                          rows={3}
                          onClick={(e) => e.stopPropagation()}
                          placeholder="Enter caption text... (Press Enter for new line)"
                          data-caption-id={caption.id}
                        />

                        {/* Interactive Word Selection List */}
                        <div className="mb-3">
                          <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 block font-medium">Select word to style</label>
                          <div className="flex flex-wrap gap-1.5">
                            {(caption.text || '').split(/\s+/).filter(w => w.trim()).map((word, wordIdx) => {
                              const isSelected = wordPopup && wordPopup.caption && wordPopup.caption.id === caption.id && wordPopup.wordIndex === wordIdx;
                              return (
                                <button
                                  key={wordIdx}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // Open popup/select word (using center screen position as fallback)
                                    onOpenWordPopup(
                                      caption,
                                      wordIdx,
                                      { x: window.innerWidth / 2 - 160, y: window.innerHeight / 2 - 200 },
                                      word
                                    );
                                  }}
                                  className={`px-2 py-1 text-xs rounded-md border transition-all ${isSelected
                                    ? 'bg-[#F5A623] border-[#F5A623] text-white shadow-sm ring-1 ring-[#F5A623]/30 font-medium'
                                    : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20'
                                    }`}
                                >
                                  {word}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 pt-1 border-t border-white/5 mt-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              splitCaption(caption.id);
                            }}
                            className="text-gray-400 hover:text-white text-xs h-7"
                          >
                            <Split className="w-3 h-3 mr-1" />
                            Split
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              // Open floating popup for the first word of the caption
                              const firstWord = (caption.text || '').split(/\s+/)[0];
                              onOpenWordPopup(
                                caption,
                                0,
                                { x: window.innerWidth / 2 - 160, y: window.innerHeight / 2 - 200 }, // Center-ish
                                firstWord
                              );
                            }}
                            className="text-gray-400 hover:text-gray-300 text-xs h-7"
                          >
                            <Edit3 className="w-3 h-3 mr-1" />
                            Edit Words
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteCaption(caption.id);
                            }}
                            className="text-red-400 hover:text-red-300 text-xs h-7"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>


                      </div>
                    ) : (
                      <p className="text-white text-sm truncate">{caption.text || ''}</p>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {(!captions || captions.length === 0) && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
              <Plus className="w-5 h-5 text-gray-500" />
            </div>
            <p className="text-gray-500 text-sm">No captions yet</p>
            <p className="text-gray-600 text-xs mt-1">Generate or add captions manually</p>
          </div>
        )}
      </div>
    </div>
  );
}