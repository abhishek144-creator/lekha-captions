import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Split,
  Trash2,
  Plus,
  GripVertical,
  Edit3,
  Info,
  Search,
  X,
  Copy,
  MoreHorizontal
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CaptionQualityPanel from './CaptionQualityPanel';
import {
  duplicateCaptionWithTiming,
  reconcileCaptionText,
  splitCaptionAtBoundary,
} from './captionEditingUtils';
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
  onPlayCaption,
  onOpenWordPopup,
  wordPopup,
  user,
  captionTracks = [],
  activeCaptionTrackId,
  onSelectTrack,
  onTranslateTrack,
  captionStyle,
}) {
  const [showAutoTip, setShowAutoTip] = useState(false);
  const [query, setQuery] = useState('');
  const [editingCaptionId, setEditingCaptionId] = useState(null);
  const [showReplace, setShowReplace] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [showBilingualPreview, setShowBilingualPreview] = useState(false);
  const [showAddLanguage, setShowAddLanguage] = useState(false);
  const [newLanguage, setNewLanguage] = useState('');
  const [isAddingLanguage, setIsAddingLanguage] = useState(false);
  const [languageError, setLanguageError] = useState('');
  const [soundCue, setSoundCue] = useState('[music]');
  const [captionEditMessage, setCaptionEditMessage] = useState('');

  const otherTrack = captionTracks.find((track) => track.id !== activeCaptionTrackId);

  useEffect(() => {
    if (!user?.email) return;
    if (window.matchMedia('(max-width: 767px)').matches) return;
    const key = `pro_tip_shown_${user.email}`;
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, 'true');
      setShowAutoTip(true);
      const timer = setTimeout(() => setShowAutoTip(false), 8000);
      return () => clearTimeout(timer);
    }
  }, [user?.email]);

  const updateCaption = (id, updates) => {
    // coalesce: per-keystroke text edits collapse into one undo snapshot per
    // typing burst instead of flooding the 50-entry history cap.
    setCaptions(prev => prev.map(c => {
      if (c.id !== id) return c
      if (Object.prototype.hasOwnProperty.call(updates, 'text') && updates.text !== c.text) {
        return { ...reconcileCaptionText(c, updates.text), ...updates }
      }
      return { ...c, ...updates }
    }), { coalesce: true });
  };

  const replaceAll = () => {
    const search = findText.trim();
    if (!search) return;
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    setCaptions(captions.map((caption) => (
      caption.isTextElement || !new RegExp(escaped, 'i').test(caption.text || '')
        ? caption
        : reconcileCaptionText(
            caption,
            String(caption.text || '').replace(new RegExp(escaped, 'gi'), replaceText),
          )
    )));
  };

  const addCaptionAnnotation = (caption, label) => {
    const text = String(caption.text || '').trim();
    if (!text || text.toLowerCase().startsWith(label.toLowerCase())) return;
    updateCaption(caption.id, { text: `${label} ${text}` });
  };

  const deleteCaption = (id) => {
    setCaptions(prev => prev.filter(c => c.id !== id));
    setSelectedCaptionId(null);
    setEditingCaptionId(null);
  };

  const duplicateCaption = (caption) => {
    if (!caption) return;
    const newId = `${Date.now()}-duplicate`;
    const clone = duplicateCaptionWithTiming(caption, newId)
    setCaptions(prev => {
      const index = prev.findIndex(c => c.id === caption.id);
      if (index === -1) return [...prev, clone];
      const next = [...prev];
      next.splice(index + 1, 0, clone);
      return next;
    });
    setSelectedCaptionId(clone.id);
  };

  const splitCaption = (id) => {
    const caption = captions.find(c => c.id === id);
    if (!caption || !caption.text) return;

    const text = caption.text || '';
    if (!text.trim()) return;

    // Split at cursor position
    const textArea = document.querySelector(`textarea[data-caption-id="${id}"]`);
    const position = textArea ? textArea.selectionStart : Math.floor(text.length / 2);

    const newId = `${Date.now()}-split`;
    const splitResult = splitCaptionAtBoundary(caption, position, newId)
    if (!splitResult.captions) {
      setCaptionEditMessage(splitResult.error || 'Caption could not be split at that position.')
      return
    }
    setCaptionEditMessage('')
    const newCaptions = captions.flatMap(c => {
      if (c.id === id) {
        return splitResult.captions
      }
      return c;
    });

    setCaptions(newCaptions);
  };

  const addCaptions = (count = 1) => {
    const safeCount = Math.max(1, Number(count) || 1);
    const timelineCaptions = (captions || []).filter(cap => cap && !cap.isTextElement);
    const lastCaption = timelineCaptions.length > 0 ? timelineCaptions[timelineCaptions.length - 1] : null;
    const newCaptions = Array.from({ length: safeCount }, (_, index) => {
      const baseStart = lastCaption ? (lastCaption.end_time || 0) + 0.5 : 0;
      const start_time = baseStart + (index * 2.5);
      return {
        id: `${Date.now()}-${index}`,
        text: `Fresh caption card ${timelineCaptions.length + index + 1} uses six clear words.`,
        start_time,
        end_time: start_time + 2
      };
    });

    setCaptions([...(captions || []), ...newCaptions]);
    setSelectedCaptionId(newCaptions[newCaptions.length - 1].id);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    return `${mins}:${secs.padStart(4, '0')}`;
  };



  const filteredCaptions = captions
    ?.filter(cap => cap && cap.id && !cap.isTextElement)
    ?.filter(cap => !query.trim() || (cap.text || '').toLowerCase().includes(query.toLowerCase()));

  return (
    <div data-caption-editor="true" className="h-full flex flex-col relative z-10">
      <span className="pointer-events-none absolute left-2 top-2 z-0 h-[18px] w-[18px] border-l border-t border-white/15" />
      <span className="pointer-events-none absolute left-2 bottom-2 z-0 h-[18px] w-[18px] border-l border-b border-white/15" />
      <div className="relative z-10 flex items-center justify-between mb-5 pl-3">
        <div>
          <p className="lekha-micro-label text-white">Captions</p>
          <p className="text-[10px] text-slate-500 mt-1">{captions?.filter(cap => cap && !cap.isTextElement).length || 0} transcript items</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            onClick={() => addCaptions(1)}
            size="sm"
            variant="outline"
            className="border border-white/15 text-white bg-white/[0.03] hover:bg-white/10 h-7 px-2.5 rounded-md"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add
          </Button>
          <Button
            onClick={() => addCaptions(5)}
            size="sm"
            variant="outline"
            className="border border-white/15 text-white bg-white/[0.03] hover:bg-white/10 h-7 px-2.5 rounded-md"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add 5
          </Button>
        </div>
      </div>

      {captionTracks.length > 1 && (
        <div className="relative z-10 mb-4 rounded-xl border border-white/10 bg-black/25 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="caption-language-track" className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Language track</label>
            <select
              id="caption-language-track"
              value={activeCaptionTrackId || 'source'}
              onChange={(event) => onSelectTrack?.(event.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#111] px-2 py-1.5 text-xs text-white"
            >
              {captionTracks.map((track) => <option key={track.id} value={track.id}>{track.label || track.language || track.id}</option>)}
            </select>
            {otherTrack && (
              <button
                type="button"
                aria-pressed={showBilingualPreview}
                onClick={() => setShowBilingualPreview((value) => !value)}
                className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold ${showBilingualPreview ? 'border-sky-300/50 bg-sky-300/10 text-sky-100' : 'border-white/10 text-slate-400 hover:text-white'}`}
              >
                {showBilingualPreview ? 'Hide comparison' : 'Compare languages'}
              </button>
            )}
          </div>
          {showBilingualPreview && otherTrack && (
            <p className="mt-2 text-[10px] leading-4 text-slate-400">The editor shows the selected language above and the matching {otherTrack.label || otherTrack.language} line below. Video preview and export use the selected track.</p>
          )}
        </div>
      )}
      {captionTracks.length > 0 && onTranslateTrack && (
        <div className="relative z-10 mb-4">
          <button type="button" onClick={() => { setShowAddLanguage((value) => !value); setLanguageError(''); }} className="text-[11px] font-semibold text-sky-200 hover:text-white">
            {showAddLanguage ? 'Cancel new language' : 'Add a language track'}
          </button>
          {showAddLanguage && (
            <form
              className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-xl border border-white/10 bg-black/25 p-3"
              onSubmit={async (event) => {
                event.preventDefault();
                setIsAddingLanguage(true);
                setLanguageError('');
                try {
                  await onTranslateTrack(newLanguage);
                  setNewLanguage('');
                  setShowAddLanguage(false);
                } catch (error) {
                  setLanguageError(error?.message || 'Translation failed. Please try again.');
                } finally {
                  setIsAddingLanguage(false);
                }
              }}
            >
              <input aria-label="New language" value={newLanguage} onChange={(event) => setNewLanguage(event.target.value)} placeholder="Language, such as Spanish" maxLength={50} className="min-w-0 rounded-lg border border-white/10 bg-black/40 px-2.5 py-2 text-xs text-white placeholder:text-slate-500" />
              <button type="submit" disabled={!newLanguage.trim() || isAddingLanguage} className="rounded-lg bg-sky-200 px-3 py-2 text-xs font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">
                {isAddingLanguage ? 'Translating…' : 'Create track'}
              </button>
              <p className="col-span-2 text-[10px] leading-4 text-slate-500">A new editable track is translated from the original track. The original and any other languages stay in this project.</p>
              {languageError && <p role="alert" className="col-span-2 text-[10px] leading-4 text-rose-300">{languageError}</p>}
            </form>
          )}
        </div>
      )}

      <details className="relative z-10 mb-4 rounded-xl border border-white/10 bg-black/20 p-3">
        <summary className="cursor-pointer list-none text-xs font-semibold text-slate-200">Caption quality review</summary>
        <div className="mt-3"><CaptionQualityPanel captions={captions} captionStyle={captionStyle} compact /></div>
      </details>

      <div className="relative z-10 mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search transcript..."
          className="w-full h-9 rounded-xl border border-white/10 bg-black/35 pl-9 pr-12 text-xs text-white placeholder:text-slate-600 outline-none focus:border-sky-300/40"
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[9px] font-mono text-slate-500">
          Ctrl K
        </span>
      </div>
      {captionEditMessage && <p role="status" className="relative z-10 -mt-2 mb-3 text-[11px] text-amber-200">{captionEditMessage}</p>}
      <div className="relative z-10 mb-4">
        <button type="button" onClick={() => setShowReplace((value) => !value)} className="text-[11px] font-semibold text-sky-200 hover:text-white">
          {showReplace ? 'Close find and replace' : 'Find and replace'}
        </button>
        {showReplace && (
          <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-black/25 p-3">
            <input aria-label="Find text" value={findText} onChange={(event) => setFindText(event.target.value)} placeholder="Find" className="min-w-0 rounded-lg border border-white/10 bg-black/40 px-2.5 py-2 text-xs text-white placeholder:text-slate-500" />
            <input aria-label="Replace with" value={replaceText} onChange={(event) => setReplaceText(event.target.value)} placeholder="Replace with" className="min-w-0 rounded-lg border border-white/10 bg-black/40 px-2.5 py-2 text-xs text-white placeholder:text-slate-500" />
            <button type="button" onClick={replaceAll} disabled={!findText.trim()} className="col-span-2 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">Replace all in this language</button>
            <p className="col-span-2 text-[10px] text-slate-500">Replacement clears word-level timings and styling on changed captions so they cannot drift onto the wrong words.</p>
          </div>
        )}
      </div>

      {/* Caption list */}
      <div className="relative z-10 flex-1 overflow-y-auto pr-1.5 pb-7 custom-scrollbar">
        <AnimatePresence>
          {filteredCaptions?.map((caption, index) => (
            <motion.div
              key={caption.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className={`group mb-2.5 rounded-sm border transition-all cursor-pointer overflow-hidden ${selectedCaptionId === caption.id
                ? 'bg-white/[0.045] border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]'
                : 'border-transparent border-b-white/[0.075] hover:bg-white/[0.025]'
                }`}
              onClick={() => {
                setSelectedCaptionId(caption.id);
                onSeek(caption.start_time);
              }}
            >
              <div className="min-h-[92px] py-5 px-2.5">
                <div className="flex items-start gap-3.5">
                  <span className={`w-8 shrink-0 font-serif italic text-[28px] leading-none ${selectedCaptionId === caption.id ? 'text-sky-100' : 'text-slate-700'}`}>
                    {String(index + 1).padStart(2, '0')}
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2.5 min-w-0">
                      <span className="shrink-0 whitespace-nowrap text-[9px] font-mono text-slate-500 tracking-[0.08em]">
                        {formatTime(caption.start_time || 0)} - {formatTime(caption.end_time || 0)}
                      </span>
                      <span className="shrink-0 whitespace-nowrap text-[9px] font-mono text-sky-200/80 bg-white/[0.04] border border-white/10 px-1.5 py-0.5 rounded">
                        {Math.max(0.1, ((caption.end_time || 0) - (caption.start_time || 0))).toFixed(1)}s
                      </span>
                      <span className="text-xs text-gray-500 flex items-center gap-1">
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

                    {selectedCaptionId === caption.id && editingCaptionId === caption.id ? (
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
                          className="bg-black/50 border-white/10 text-white text-sm resize-none mb-3 rounded-xl"
                          rows={3}
                          onClick={(e) => e.stopPropagation()}
                          placeholder="Enter caption text... (Press Enter for new line)"
                          data-caption-id={caption.id}
                        />

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => addCaptionAnnotation(caption, 'Speaker 1:')}
                            className="rounded-md border border-white/10 px-2.5 py-1.5 text-[10px] font-semibold text-slate-300 hover:border-white/25 hover:text-white"
                            title="Add an editable speaker label to this caption"
                          >
                            Add speaker label
                          </button>
                          <select value={soundCue} onChange={(event) => setSoundCue(event.target.value)} aria-label="Sound cue" className="rounded-md border border-white/10 bg-[#111] px-2 py-1.5 text-[10px] text-slate-300">
                            {['[music]', '[laughter]', '[applause]', '[sigh]', '[inaudible]'].map((cue) => <option key={cue}>{cue}</option>)}
                          </select>
                          <button
                            type="button"
                            onClick={() => addCaptionAnnotation(caption, soundCue)}
                            className="rounded-md border border-white/10 px-2.5 py-1.5 text-[10px] font-semibold text-slate-300 hover:border-white/25 hover:text-white"
                            title="Add an important non-speech sound cue"
                          >
                            Add sound cue
                          </button>
                        </div>
                        <p className="-mt-1 text-[10px] leading-4 text-slate-500">Labels are editable text. Existing words keep measured timing; the new label is marked for timing review.</p>

                        {showBilingualPreview && otherTrack && (
                          <div className="rounded-lg border border-sky-300/15 bg-sky-300/[0.04] p-2.5">
                            <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-sky-200/70">{otherTrack.label || otherTrack.language}</p>
                            <p className="text-xs leading-5 text-sky-50/85">{otherTrack.captions?.find((item) => item.id === caption.id)?.text || 'No matching caption in this track.'}</p>
                          </div>
                        )}

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
                              setEditingCaptionId(null);
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
                              setEditingCaptionId(null);
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
                      <>
                        <p className="text-white text-[15px] font-semibold leading-snug line-clamp-3">{caption.text || ''}</p>
                        {selectedCaptionId === caption.id && (
                          <div className="mt-3 flex items-center gap-3 text-slate-500">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                duplicateCaption(caption);
                              }}
                              className="rounded-md p-1 hover:bg-white/5 hover:text-slate-200"
                              title="Duplicate caption"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteCaption(caption.id);
                              }}
                              className="rounded-md p-1 hover:bg-white/5 hover:text-red-300"
                              title="Delete caption"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCaptionId(caption.id);
                                if (onPlayCaption) {
                                  onPlayCaption(caption);
                                } else {
                                  onSeek(caption.start_time || 0);
                                }
                                setEditingCaptionId(caption.id);
                              }}
                              className="rounded-md p-1 hover:bg-white/5 hover:text-slate-200"
                              title="Edit caption"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                        {showBilingualPreview && otherTrack && (
                          <div className="mt-2 rounded-lg border border-sky-300/15 bg-sky-300/[0.04] px-3 py-2">
                            <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-sky-200/70">{otherTrack.label || otherTrack.language}</p>
                            <p className="text-xs leading-5 text-sky-50/85">{otherTrack.captions?.find((item) => item.id === caption.id)?.text || 'No matching caption in this track.'}</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <GripVertical className="w-4 h-4 text-gray-700 mt-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab" />
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
