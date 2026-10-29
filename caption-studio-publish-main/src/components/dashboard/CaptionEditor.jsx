import { memo, useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import DismissibleNotice from './DismissibleNotice';
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
  MoreHorizontal,
  Languages,
  Loader2,
  ChevronDown,
  Sparkles,
  AudioLines
} from 'lucide-react';
import {
  attachCaptionEmotions,
  autoLayoutCaptions,
  captionsNeedingEmotion,
  getCaptionLayoutMode,
  getCaptionLayoutMotion,
  setCaptionLayout,
} from './captionLayoutDirector';
import { motion, AnimatePresence } from 'framer-motion';
import {
  placeDuplicateCaption,
  reconcileCaptionText,
  shiftCaptionTiming,
  splitCaptionAtBoundary,
} from './captionEditingUtils';
import { getCaptionLanguageLabel, globalLanguages, southAsianLanguages } from '@/lib/captionLanguages';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";



function CaptionEditor({
  captions,
  duration = 0,
  setCaptions,
  selectedCaptionId,
  setSelectedCaptionId,
  onSeek,
  onPlayCaption,
  onOpenWordPopup,
  wordPopup,
  user,
  onTranslate,
  isTranslating = false,
  captionStyle,
  waveformData,
  onAnalyzeCaptionEmotions,
}) {
  const [showAutoTip, setShowAutoTip] = useState(false);
  const [query, setQuery] = useState('');
  const [editingCaptionId, setEditingCaptionId] = useState(null);
  const captionListRef = useRef(null);

  // Bring the selected caption's row into view when it is off-screen (e.g.
  // selected on the video, or via the mobile "Edit text" tool).
  // The panel can mount hidden while its lazy chunk settles, so wait until the
  // list has a real height before deciding whether the row is visible.
  useEffect(() => {
    const list = captionListRef.current;
    if (!list || !selectedCaptionId) return undefined;
    const reveal = () => {
      if (!list.clientHeight) return false;
      const card = [...list.querySelectorAll('[data-caption-card]')]
        .find((node) => node.getAttribute('data-caption-card') === String(selectedCaptionId));
      if (!card) return true;
      const top = card.offsetTop;
      const bottom = top + card.offsetHeight;
      if (top < list.scrollTop || bottom > list.scrollTop + list.clientHeight) {
        list.scrollTo({ top: Math.max(0, top - 8), behavior: 'smooth' });
      }
      return true;
    };
    if (reveal() || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => {
      if (reveal()) observer.disconnect();
    });
    observer.observe(list);
    return () => observer.disconnect();
  }, [selectedCaptionId]);
  const [showReplace, setShowReplace] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [soundCue, setSoundCue] = useState('[music]');
  const [captionEditMessage, setCaptionEditMessage] = useState('');
  const [translateTarget, setTranslateTarget] = useState('');
  const searchInputRef = useRef(null);

  useEffect(() => {
    if (!user?.email) return;
    if (window.matchMedia('(max-width: 767px)').matches) return;
    const key = `pro_tip_shown_${user.email}`;
    let alreadyShown = true
    try { alreadyShown = !!localStorage.getItem(key); localStorage.setItem(key, 'true') } catch { /* Optional tip must not block correction when storage is disabled. */ }
    if (!alreadyShown) {
      setShowAutoTip(true);
      const timer = setTimeout(() => setShowAutoTip(false), 8000);
      return () => clearTimeout(timer);
    }
  }, [user?.email]);

  useEffect(() => {
    const focusTranscriptSearch = (event) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k') return;
      event.preventDefault();
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    };
    window.addEventListener('keydown', focusTranscriptSearch);
    return () => window.removeEventListener('keydown', focusTranscriptSearch);
  }, []);

  const nudgeCaption = (caption, delta) => {
    setCaptions((previous) => previous.map((item) => (
      item.id !== caption.id ? item : shiftCaptionTiming(item, delta)
    )))
  }

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
            // A function replacer inserts the text literally ("$&" and "$1"
            // are not treated as replacement patterns).
            String(caption.text || '').replace(new RegExp(escaped, 'gi'), () => replaceText),
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
    const captionEnd = Number(caption.end_time) || 0
    const nextStart = captions
      .filter(c => c && !c.isTextElement && c.id !== caption.id && Number(c.start_time) >= captionEnd - 0.001)
      .reduce((earliest, c) => Math.min(earliest, Number(c.start_time)), Infinity)
    const { original, copy: clone } = placeDuplicateCaption(caption, newId, nextStart)
    setCaptions(prev => {
      const index = prev.findIndex(c => c.id === caption.id);
      if (index === -1) return [...prev, clone];
      const next = [...prev];
      next.splice(index, 1, original, clone);
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
    // New captions follow the last one and never run past the end of the
    // video (they would never be shown or exported); one that does not fit
    // its full 2 s is shortened to the time that is left.
    const videoEnd = Number(duration) > 0 ? Number(duration) : Infinity;
    const newCaptions = [];
    let previousEnd = lastCaption ? (Number(lastCaption.end_time) || 0) : null;
    for (let index = 0; index < safeCount; index += 1) {
      const start_time = previousEnd === null ? 0 : previousEnd + 0.5;
      const end_time = Math.min(start_time + 2, videoEnd);
      if (end_time - start_time < 0.3) break;
      newCaptions.push({
        id: `${Date.now()}-${index}`,
        text: `Fresh caption card ${timelineCaptions.length + index + 1} uses six clear words.`,
        start_time,
        end_time,
      });
      previousEnd = end_time;
    }
    if (newCaptions.length === 0) {
      setCaptionEditMessage('There is no room after the last caption. Shorten or move a caption first.');
      return;
    }
    setCaptionEditMessage(newCaptions.length < safeCount ? `Added ${newCaptions.length} of ${safeCount}: the rest would run past the end of the video.` : '');
    setCaptions([...(captions || []), ...newCaptions]);
    setSelectedCaptionId(newCaptions[newCaptions.length - 1].id);
  };

  // Smart layout director: the frame shape decides how a CPT composition fits.
  const directorOptions = () => {
    const frame = typeof document !== 'undefined' ? document.querySelector('.lekha-video-frame')?.getBoundingClientRect() : null;
    const height = frame?.width ? (360 * frame.height) / frame.width : 640;
    return { waveformData, duration, captionStyle: captionStyle || {}, frame: { width: 360, height } };
  };

  // Auto layout reads the script with AI first (only lines with no current
  // reading are sent; readings are kept on the captions), then lays out.
  // Without AI (signed out, offline, quota) it uses timing and volume rules.
  const latestCaptionsRef = useRef(captions);
  latestCaptionsRef.current = captions;
  const [isAutoLayoutRunning, setIsAutoLayoutRunning] = useState(false);
  const runAutoLayout = async () => {
    if (isAutoLayoutRunning) return;
    setIsAutoLayoutRunning(true);
    let readings = null;
    let aiFailed = false;
    const pending = captionsNeedingEmotion(captions || []);
    if (onAnalyzeCaptionEmotions && pending.length) {
      setCaptionEditMessage('Reading the script…');
      try {
        const data = await onAnalyzeCaptionEmotions(pending);
        if (data?.success && Array.isArray(data.lines)) readings = data.lines;
        else if (data) aiFailed = true;
      } catch {
        aiFailed = true;
      }
    }
    // Apply to the latest captions: edits made while the script was being read are kept.
    const base = latestCaptionsRef.current || [];
    const source = readings ? attachCaptionEmotions(base, readings, pending) : base;
    const { captions: next, counts } = autoLayoutCaptions(source, directorOptions());
    setCaptions(next);
    const parts = [
      counts.cpt && `${counts.cpt} CPT`,
      counts.keywords && `${counts.keywords} with keywords`,
      counts.sentence && `${counts.sentence} sentences`,
    ].filter(Boolean);
    const motion = [counts.line && `${counts.line} animated in`, counts.word && `${counts.word} word by word`].filter(Boolean);
    const how = counts.ai ? ` Read ${counts.ai} line${counts.ai === 1 ? '' : 's'} with AI.` : aiFailed ? ' AI reading unavailable, used timing and volume.' : '';
    setCaptionEditMessage(`Auto layout: ${parts.join(', ') || 'no changes'}${motion.length ? ` (${motion.join(', ')})` : ''}${counts.kept ? `. Kept ${counts.kept} you styled.` : '.'}${how} Undo to revert.`);
    setIsAutoLayoutRunning(false);
  };

  const chooseCaptionLayout = (caption, look) => {
    setCaptions(setCaptionLayout(captions || [], caption.id, look, directorOptions()));
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    return `${mins}:${secs.padStart(4, '0')}`;
  };



  const filteredCaptions = captions
    ?.filter(cap => cap && cap.id && !cap.isTextElement)
    ?.filter(cap => !query.trim() || (cap.text || '').toLowerCase().includes(query.toLowerCase()));
  const transcriptCount = captions?.filter(cap => cap && !cap.isTextElement).length || 0;

  return (
    <div data-caption-editor="true" className="h-full flex flex-col relative z-10">
      <span className="pointer-events-none absolute left-2 top-2 z-0 h-[18px] w-[18px] border-l border-t border-white/15" />
      <span className="pointer-events-none absolute left-2 bottom-2 z-0 h-[18px] w-[18px] border-l border-b border-white/15" />
      <div className="relative z-10 flex items-center justify-between mb-5 pl-3">
        <div>
          <p className="lekha-micro-label text-white">Captions</p>
          <p className="text-[10px] text-slate-500 mt-1">{transcriptCount} transcript items</p>
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

      {onTranslate && transcriptCount > 0 && (
        <div
          className="relative z-10 mb-3 flex h-8 items-center gap-1.5"
          title="Translates from your original captions. To return to them, translate to the original language."
        >
          <label htmlFor="caption-translate-target" className="sr-only">Translate captions to</label>
          <div className="relative min-w-0 flex-1">
            <Languages className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <select
              id="caption-translate-target"
              value={translateTarget}
              onChange={(event) => setTranslateTarget(event.target.value)}
              disabled={isTranslating}
              aria-describedby="caption-translate-hint"
              className={`h-8 w-full min-w-0 appearance-none rounded-lg border border-white/10 bg-black/35 pl-8 pr-7 text-xs outline-none transition-colors hover:border-white/20 focus:border-sky-300/40 disabled:opacity-50 ${translateTarget ? 'text-white' : 'text-slate-500'}`}
            >
              <option value="">Translate to…</option>
              <optgroup label="South Asian languages">
                {southAsianLanguages.map((language) => <option key={language.value} value={language.value}>{language.label}</option>)}
              </optgroup>
              <optgroup label="Global languages">
                {globalLanguages.map((language) => <option key={language.value} value={language.value}>{language.label}</option>)}
              </optgroup>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" aria-hidden="true" />
          </div>
          <button
            type="button"
            onClick={() => onTranslate(translateTarget, getCaptionLanguageLabel(translateTarget))}
            disabled={!translateTarget || isTranslating}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-white px-3 text-[11px] font-semibold text-black transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:bg-white/[0.06] disabled:text-slate-500"
          >
            {isTranslating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isTranslating ? 'Translating…' : 'Translate'}
          </button>
          <span id="caption-translate-hint" className="sr-only">Translates from your original captions. To return to them, translate to the original language.</span>
        </div>
      )}

      <div className="relative z-10 mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
        <input
          ref={searchInputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search transcript"
          placeholder="Search transcript..."
          className="w-full h-9 rounded-xl border border-white/10 bg-black/35 pl-9 pr-12 text-xs text-white placeholder:text-slate-600 outline-none focus:border-sky-300/40"
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 hidden [@media(pointer:fine)]:inline rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[9px] font-mono text-slate-500">
          Ctrl K
        </span>
      </div>
      {captionEditMessage && <DismissibleNotice key={captionEditMessage} closeLabel="Close caption editing notification" onDismiss={() => setCaptionEditMessage('')} className="relative z-10 -mt-2 mb-3 text-[11px] text-amber-200">{captionEditMessage}</DismissibleNotice>}
      <div className="relative z-10 mb-4">
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={() => setShowReplace((value) => !value)} className="text-[11px] font-semibold text-sky-200 hover:text-white">
            {showReplace ? 'Close find and replace' : 'Find and replace'}
          </button>
          {transcriptCount > 0 && (
            <button
              type="button"
              onClick={runAutoLayout}
              disabled={isAutoLayoutRunning}
              aria-busy={isAutoLayoutRunning}
              title="Read the script and suggest a look for each caption: sentence, keywords or CPT, with or without motion. Captions you styled are kept."
              className="inline-flex items-center gap-1 rounded-md border border-[#F5A623]/40 bg-[#F5A623]/[0.06] px-2 py-1 text-[11px] font-semibold text-[#F5A623] hover:bg-[#F5A623]/15 disabled:cursor-wait disabled:opacity-70"
            >
              {isAutoLayoutRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Auto layout
            </button>
          )}
        </div>
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
      <div ref={captionListRef} className="relative z-10 flex-1 overflow-y-auto pr-1.5 pb-7 custom-scrollbar">
        <AnimatePresence>
          {filteredCaptions?.map((caption, index) => (
            <motion.div
              key={caption.id}
              data-caption-card={caption.id}
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
                      {caption.layoutSource && (
                        <span
                          data-caption-layout-badge={getCaptionLayoutMode(caption)}
                          data-caption-layout-motion={getCaptionLayoutMotion(caption)}
                          data-caption-layout-insight={caption.layoutInsight?.source || undefined}
                          title={`${caption.layoutSource === 'auto' ? 'Suggested by Auto layout' : 'Set by you'}${({ line: ', animates in', word: ', word by word' })[getCaptionLayoutMotion(caption)] || ''}${caption.layoutSource === 'auto' && caption.layoutInsight?.type ? ` · ${caption.layoutInsight.source === 'ai' ? 'AI read' : 'Read as'}: ${String(caption.layoutInsight.type).replace(/_/g, ' ')}${caption.layoutInsight.emotion ? `, ${caption.layoutInsight.emotion}` : ''}` : ''}`}
                          className="inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap rounded border border-[#F5A623]/25 bg-[#F5A623]/[0.06] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#F5A623]/90"
                        >
                          {({ sentence: 'Text', keywords: 'Key', cpt: 'CPT' })[getCaptionLayoutMode(caption)]}
                          {getCaptionLayoutMode(caption) !== 'cpt' && getCaptionLayoutMotion(caption) === 'line' && <Sparkles className="h-2.5 w-2.5" aria-label="animates in" />}
                          {getCaptionLayoutMode(caption) !== 'cpt' && getCaptionLayoutMotion(caption) === 'word' && <AudioLines className="h-2.5 w-2.5" aria-label="word by word" />}
                        </span>
                      )}
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <TooltipProvider>
                          <Tooltip
                            open={index === 0 && showAutoTip ? true : undefined}
                            // The pinned tip must close on Escape; otherwise it
                            // swallows Escape everywhere while it is shown.
                            onOpenChange={index === 0 && showAutoTip ? (open) => { if (!open) setShowAutoTip(false); } : undefined}
                            delayDuration={300}
                          >
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
                                      aria-label="Dismiss tip"
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
                          aria-label="Caption text"
                          dir="auto"
                          onKeyDown={(event) => {
                            if (event.altKey && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
                              event.preventDefault()
                              nudgeCaption(caption, event.key === 'ArrowLeft' ? -0.1 : 0.1)
                            }
                          }}
                        />

                        <div className="flex flex-wrap items-center gap-2">
                          <button type="button" onClick={() => onPlayCaption?.(caption)} className="rounded border border-white/20 px-2 py-1 text-xs">Play phrase</button>
                          <button type="button" onClick={() => nudgeCaption(caption, -0.1)} className="rounded border border-white/20 px-2 py-1 text-xs" title="Alt + Left in caption text">Earlier 0.1s</button>
                          <button type="button" onClick={() => nudgeCaption(caption, 0.1)} className="rounded border border-white/20 px-2 py-1 text-xs" title="Alt + Right in caption text">Later 0.1s</button>
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

                        {Array.isArray(caption.words) && caption.words.some((word) => Number.isFinite(word.start) && Number.isFinite(word.end)) && <div className="flex flex-wrap gap-1" aria-label="Hear measured words">
                          {caption.words.map((word, index) => Number.isFinite(word.start) && Number.isFinite(word.end) && <button type="button" key={index} onClick={() => onPlayCaption?.({ start_time: word.start, end_time: word.end })} className="rounded border border-sky-300/20 px-2 py-1 text-xs text-sky-200" aria-label={`Hear ${word.word || word.text}`}>Hear {word.word || word.text}</button>)}
                        </div>}
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
                            aria-label="Delete caption"
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
                        {selectedCaptionId === caption.id && (() => {
                          const layoutMode = getCaptionLayoutMode(caption);
                          const layoutMotion = getCaptionLayoutMotion(caption);
                          return (
                            <div className="mt-3 flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                              <div role="group" aria-label="Caption look" className="inline-flex rounded-md border border-white/10 bg-black/30 p-0.5">
                                {[['sentence', 'Sentence'], ['keywords', 'Keywords'], ['cpt', 'CPT']].map(([mode, label]) => (
                                  <button
                                    key={mode}
                                    type="button"
                                    aria-pressed={layoutMode === mode}
                                    onClick={() => chooseCaptionLayout(caption, { mode, motion: mode === 'cpt' || layoutMode === 'cpt' ? (mode === 'cpt' ? 'word' : 'none') : layoutMotion })}
                                    className={`rounded px-2 py-1 text-[10px] font-semibold transition-colors ${layoutMode === mode ? 'bg-white text-black' : 'text-slate-400 hover:text-white'}`}
                                  >
                                    {label}
                                  </button>
                                ))}
                              </div>
                              {/* Motion: still, the whole caption animates in, or it builds word by word as spoken. */}
                              <div
                                role="group"
                                aria-label="Caption motion"
                                title={layoutMode === 'cpt' ? 'CPT words always appear as they are spoken' : undefined}
                                className={`inline-flex rounded-md border border-white/10 bg-black/30 p-0.5 ${layoutMode === 'cpt' ? 'opacity-50' : ''}`}
                              >
                                {[['none', 'Still', 'No motion'], ['line', 'Line', 'The whole caption animates in'], ['word', 'Words', 'Builds word by word as spoken']].map(([motion, label, hint]) => (
                                  <button
                                    key={motion}
                                    type="button"
                                    aria-pressed={layoutMotion === motion}
                                    disabled={layoutMode === 'cpt'}
                                    title={hint}
                                    onClick={() => chooseCaptionLayout(caption, { mode: layoutMode, motion })}
                                    className={`rounded px-2 py-1 text-[10px] font-semibold transition-colors disabled:cursor-not-allowed ${layoutMotion === motion ? 'bg-[#F5A623] text-black' : 'text-slate-400 hover:text-white'}`}
                                  >
                                    {label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
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

// Memoized: the dashboard re-renders on every playback tick; this panel only
// needs to when its own props change.
export default memo(CaptionEditor);
