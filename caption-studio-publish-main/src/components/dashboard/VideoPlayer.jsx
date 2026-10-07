import React, { useRef, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Play, Pause, Volume2, VolumeX, X, Maximize2, Minimize2, ZoomIn, ZoomOut, RotateCcw, Grid2X2, Move, RotateCw, Trash2 } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { resolveScriptFont, loadGoogleFont } from './fontUtils';
import { buildEmotionalCaptionPlan } from './emotionalTemplateUtils';
import {
  ADVANCED_TEMPLATE_EMPHASIS_COLORS,
  getOriginalTemplateBlockType,
  normalizeTemplatePhaseIndex,
} from './templateMotionConfig';


import '../../styles/captionTemplates.css';
import '../../styles/captionTemplatesAdvanced.css';
import '../../styles/advancedTemplateLibrary.css';
// Static <style> emitters + host override CSS, split out of this file.
import {
  OriginalAdvancedTemplateStyles,
  SidebarSourceTemplateStyles,
} from './videoPlayerTemplateStyles';
// Shared Basic-template builder — the SAME module the burned-video export uses
// (scripts/render_template_overlay.mjs), so the preview and the exported video
// stay byte-for-byte in sync. Do not re-implement these here.
import {
  isSourceBasicTemplateId,
  APPLIED_BASIC_TEMPLATE_FONT_SCALE,
  normalizeAppliedBasicTemplateFontSize,
} from './basicTemplateInline.js';
import { resolveCptWordSnap } from './cptSmartGuides.js';
import {
  advanceCaptionWordRevealIndex,
  getCaptionWordRevealIndex,
  getCaptionWordRevealTimes,
} from './cptMotion.js';
import {
  captionHasCreativelyPositionedWords,
  computeEffectCSS,
  computeWordEffectCSS,
  getCaptionRevealWordIndex,
  getCaptionTemplateId,
} from './videoPlayerWordEditing.js';
import {
  isAdvancedTemplateId,
  isRecreatedAdvancedTemplateId,
  hasSidebarTemplateStyle,
  getTemplateWrapperClassName,
  getTemplateContainerStateClass,
  getTemplateVariantClassName,
  getBasicTemplateWordClassName,
  scaleTemplateFontSize,
  splitWordsIntoIndexedLines,
  resolveImpWordIndicesForWords,
  getSidebarTemplateLineCount,
  getSidebarTemplateMotion,
  resolveAdvancedTemplateEmphasisColor,
  getAppliedTemplateMarkupSignature,
  buildAppliedSidebarTemplateInline,
  countAppliedTemplatePhases,
  buildAppliedBasicTemplateInline,
  countAppliedBasicTemplatePhases,
  AppliedSidebarTemplateStyles,
  AppliedBasicTemplateMarkup,
  AppliedSidebarTemplateSourceRenderer,
  getAppliedAdvancedTemplateImpClass,
  AppliedAdvancedTemplateCaption,
  MemoizedVideo,
  formatTime,
  getAnimationStyle,
  getTextElementDisplayMetrics,
  getTextElementEffectCSS,
  getWordAnimationStyle,
  getCptWordMotionStyle,
  renderWordTextContent,
  renderAnimatedDetachedWordContent,
} from './videoPlayerTemplateRendering.jsx';


export default function VideoPlayer({
  videoUrl,
  currentTime,
  setCurrentTime,
  seekSignal,
  isPlaying,
  setIsPlaying,
  captions,
  waveformData,
  captionStyle,
  duration,
  setDuration,
  setCaptionStyle,
  setCaptionStyleRaw,
  setCaptions,
  setCaptionsRaw,
  addToHistory,
  selectedCaptionId,
  setSelectedCaptionId,
  wordPopup,
  setWordPopup,
  onVideoLoaded,
  onVideoError,
  isVideoFullscreen,
  setIsVideoFullscreen
}) {
  const videoRef = useRef(null);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragStartPos, setDragStartPos] = useState(0);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartXPos, setDragStartXPos] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');

  // Custom Element State
  const [draggedElementId, setDraggedElementId] = useState(null);
  const [resizedElementId, setResizedElementId] = useState(null);
  const [elementDragStart, setElementDragStart] = useState({ x: 0, y: 0, initialTop: 0, initialLeft: 0 });
  const [elementResizeStart, setElementResizeStart] = useState({ x: 0, y: 0, initialWidth: 0, initialFontSize: 0, minWidth: 150, direction: 'right' });

  const [isResizing, setIsResizing] = useState(false);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartY, setResizeStartY] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);
  const [resizeStartFontSize, setResizeStartFontSize] = useState(18);
  const [resizeDirection, setResizeDirection] = useState('right');
  const emotionalCaptionPlan = React.useMemo(() => {
    const markup = captionStyle?.template_markup || captionStyle?.template_snapshot?.template_markup || '';
    return new Map(
      buildEmotionalCaptionPlan(captions, waveformData, duration, markup)
        .map((entry) => [entry.captionId, entry]),
    );
  }, [captions, waveformData, duration, captionStyle?.template_markup, captionStyle?.template_snapshot?.template_markup]);
  // Word dragging state (for both captions and text elements)
  const [draggingWord, setDraggingWord] = useState(null); // { captionId, wordIndex, startX, startY, initialX, initialY, isElement }
  const [resizingWord, setResizingWord] = useState(null);

  const captionRef = useRef(null);
  const videoContainerRef = useRef(null);
  const currentDragCoordinates = useRef(null);
  const lastDragDropTime = useRef(0);
  const wordResizeActiveRef = useRef(false);
  const inputRef = useRef(null);
  // Blocks handleTimeUpdate from propagating to Dashboard while user is dragging
  const isScrubbingRef = useRef(false);

  // ── Alignment snap guides ───────────────────────────────────────────────
  // { hLines: [pct], vLines: [pct] } — percent values to draw guide lines
  const [snapGuides, setSnapGuides] = useState({ hLines: [], vLines: [] });
  const [cptWordGuides, setCptWordGuides] = useState([]);
  const selectionHandleClass = 'absolute z-50 h-3 w-3 rounded-full border border-[#b76cff] bg-white shadow-[0_0_0_1px_rgba(255,255,255,0.7)]';

  // ── Canvas zoom (Ctrl+Scroll) ───────────────────────────────────────────
  const [canvasScale, setCanvasScale] = useState(1);
  const [activeCanvasTool, setActiveCanvasTool] = useState(null);
  const [showCornerGuides, setShowCornerGuides] = useState(true);
  const [showLayoutGuides, setShowLayoutGuides] = useState(false);
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const [isCanvasPanning, setIsCanvasPanning] = useState(false);
  const canvasPanStartRef = useRef({ x: 0, y: 0, originX: 0, originY: 0 });
  const fitCanvasSizeRef = useRef({ width: 0, height: 0 });
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  const clearActiveSelection = useCallback(() => {
    if (setSelectedCaptionId) setSelectedCaptionId(null);
    if (setWordPopup) setWordPopup(null);
  }, [setSelectedCaptionId, setWordPopup]);

  const getWordRenderOffset = useCallback((wordStyle = {}) => {
    const width = canvasSize.width || videoContainerRef.current?.offsetWidth || 0;
    const height = canvasSize.height || videoContainerRef.current?.offsetHeight || 0;
    const baselineWidth = fitCanvasSizeRef.current.width || width;
    const baselineHeight = fitCanvasSizeRef.current.height || height;

    const offsetX = typeof wordStyle.x_pct === 'number' && width
      ? (wordStyle.x_pct / 100) * width
      : (typeof wordStyle.x === 'number' && baselineWidth && width)
        ? (wordStyle.x * width) / baselineWidth
      : (wordStyle.x || 0);

    const offsetY = typeof wordStyle.y_pct === 'number' && height
      ? (wordStyle.y_pct / 100) * height
      : (typeof wordStyle.y === 'number' && baselineHeight && height)
        ? (wordStyle.y * height) / baselineHeight
      : (wordStyle.y || 0);

    return {
      x: offsetX,
      y: offsetY,
      isPositioned: Math.abs(offsetX) > 0.01 || Math.abs(offsetY) > 0.01,
    };
  }, [canvasSize.height, canvasSize.width]);

  const isWordDetached = useCallback((wordStyle = {}) => (
    typeof wordStyle.abs_x_pct === 'number'
    && typeof wordStyle.abs_y_pct === 'number'
    && (Math.abs(wordStyle.abs_x_pct) > 0.01 || Math.abs(wordStyle.abs_y_pct) > 0.01)
  ), []);

  React.useLayoutEffect(() => {
    const syncFitCanvasSize = () => {
      const el = videoContainerRef.current;
      if (!el) return;
      const nextSize = {
        width: el.offsetWidth || 0,
        height: el.offsetHeight || 0,
      };
      if (!nextSize.width || !nextSize.height) return;

      setCanvasSize(prev => (
        prev.width === nextSize.width && prev.height === nextSize.height
          ? prev
          : nextSize
      ));

      if (!isVideoFullscreen) {
        fitCanvasSizeRef.current = nextSize;
      }
    };

    syncFitCanvasSize();
    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(syncFitCanvasSize)
      : null;
    if (observer && videoContainerRef.current) {
      observer.observe(videoContainerRef.current);
    }
    window.addEventListener('resize', syncFitCanvasSize);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', syncFitCanvasSize);
    };
  }, [isVideoFullscreen, videoUrl]);

  const getPreviewRenderScale = useCallback(() => {
    if (!isVideoFullscreen) return 1;
    const currentWidth = canvasSize.width || videoContainerRef.current?.offsetWidth || 0;
    const baselineWidth = fitCanvasSizeRef.current.width || currentWidth;
    if (!currentWidth || !baselineWidth) return 1;
    return currentWidth / baselineWidth;
  }, [canvasSize.width, isVideoFullscreen]);

  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        const playResult = videoRef.current.play();
        if (playResult?.catch) playResult.catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying]);

  const toggleVideoFullscreen = useCallback(() => {
    if (!setIsVideoFullscreen) return;
    setIsVideoFullscreen(v => !v);
  }, [setIsVideoFullscreen]);

  // ── F / Shift+F → toggle fullscreen ────────────────────────────────────
  useEffect(() => {
    if (!toggleVideoFullscreen) return;
    const onKey = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (document.activeElement?.isContentEditable)) return;
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleVideoFullscreen();
        return;
      }
      if (e.key === 'Escape' && isVideoFullscreen && setIsVideoFullscreen) {
        e.preventDefault();
        setIsVideoFullscreen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isVideoFullscreen, setIsVideoFullscreen, toggleVideoFullscreen]);

  // ── Ctrl+Scroll → zoom canvas ───────────────────────────────────────────
  useEffect(() => {
    const el = videoContainerRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setCanvasScale(prev => {
        const delta = e.deltaY > 0 ? -0.05 : 0.05;
        return Math.min(2, Math.max(0.5, +(prev + delta).toFixed(2)));
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    if (!isCanvasPanning) return;

    const handleMouseMove = (e) => {
      const { x, y, originX, originY } = canvasPanStartRef.current;
      setCanvasOffset({
        x: originX + (e.clientX - x),
        y: originY + (e.clientY - y),
      });
    };

    const handleMouseUp = () => {
      setIsCanvasPanning(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isCanvasPanning]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
      videoRef.current.muted = isMuted;
    }
  }, [volume, isMuted]);

  // Local scrub time: used during Slider drag so we don't call setCurrentTime(Dashboard)
  // on every tick (which triggers heavy re-renders). Only committed on release.
  const [localScrubTime, setLocalScrubTime] = useState(null);

  // Handle external seek signals (from CaptionEditor clicking a caption, etc.)
  // seekSignal is set by Dashboard.handleSeek → ensures video element moves too
  useEffect(() => {
    if (videoRef.current && seekSignal !== null && seekSignal !== undefined) {
      videoRef.current.currentTime = seekSignal;
    }
  }, [seekSignal]);

  // Listen for 'ready' message from template iframes and reply with the initial sync state
  useEffect(() => {
    const handleIframeReady = (event) => {
      if (event.data?.type === 'ready') {
        const videoContainer = videoContainerRef.current || videoRef.current?.parentElement;
        if (!videoContainer) return;
        const iframes = videoContainer.querySelectorAll('iframe');
        iframes.forEach((iframe) => {
          if (iframe.contentWindow === event.source) {
            const activeCaption = getActiveCaptions().find(c => !c.isTextElement);
            iframe.contentWindow.postMessage({
              type: 'sync',
              currentTime,
              isPlaying,
              startTime: activeCaption ? activeCaption.start_time : currentTime,
              endTime: activeCaption ? activeCaption.end_time : currentTime,
              captionText: activeCaption ? (activeCaption.text || '') : ''
            }, '*');
          }
        });
      }
    };
    window.addEventListener('message', handleIframeReady);
    return () => {
      window.removeEventListener('message', handleIframeReady);
    };
  }, [currentTime, isPlaying, captions]);

  // ── rAF loop: send 60fps sync to template iframes while playing ─────────
  // When paused, React state changes still fire the static effect above.
  // When playing we need sub-4fps resolution for word-by-word animations,
  // so we bypass React state and read videoRef.current.currentTime directly.
  const iframeSyncRafRef = useRef(null);
  const captionsRef = useRef(captions);
  captionsRef.current = captions;
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const [cptRevealIndexes, setCptRevealIndexes] = useState({});
  const cptRevealRafRef = useRef(null);
  const cptRevealTimeRef = useRef(Number(currentTime) || 0);

  // CPT authoring is a fully visible editing state. Once playback starts, use
  // the video clock to advance cumulative visibility by at most one word per
  // painted frame, without running any entrance animation.
  useEffect(() => {
    if (!isPlaying) {
      if (cptRevealRafRef.current) {
        cancelAnimationFrame(cptRevealRafRef.current);
        cptRevealRafRef.current = null;
      }
      cptRevealTimeRef.current = Number(currentTime) || 0;
      setCptRevealIndexes({});
      return undefined;
    }

    const tickCptReveal = () => {
      const playbackTime = Number(videoRef.current?.currentTime);
      const effectiveTime = Number.isFinite(playbackTime)
        ? playbackTime
        : (Number(currentTime) || 0);
      const movedBackward = effectiveTime + 0.02 < cptRevealTimeRef.current;
      cptRevealTimeRef.current = effectiveTime;

      setCptRevealIndexes((previousIndexes) => {
        let changed = false;
        const nextIndexes = {};

        (captionsRef.current || []).forEach((caption) => {
          if (!caption || caption.isTextElement || !captionHasCreativelyPositionedWords(caption)) return;
          const wordCount = Math.max(
            1,
            String(caption.text || '').trim().split(/\s+/).filter(Boolean).length,
          );
          const targetIndex = getCaptionWordRevealIndex(caption, effectiveTime, wordCount);
          const previousIndex = previousIndexes[caption.id];
          const nextIndex = movedBackward
            ? targetIndex
            : advanceCaptionWordRevealIndex(previousIndex, targetIndex);
          nextIndexes[caption.id] = nextIndex;
          if (nextIndex !== previousIndex) changed = true;
        });

        if (Object.keys(previousIndexes).length !== Object.keys(nextIndexes).length) changed = true;
        return changed ? nextIndexes : previousIndexes;
      });

      cptRevealRafRef.current = requestAnimationFrame(tickCptReveal);
    };

    cptRevealRafRef.current = requestAnimationFrame(tickCptReveal);
    return () => {
      if (cptRevealRafRef.current) {
        cancelAnimationFrame(cptRevealRafRef.current);
        cptRevealRafRef.current = null;
      }
    };
  }, [currentTime, isPlaying]);

  useEffect(() => {
    function buildSyncMsg(t) {
      const caps = captionsRef.current || [];
      const activeCaption = caps.find(
        c => c && !c.isTextElement &&
          typeof c.start_time === 'number' &&
          typeof c.end_time === 'number' &&
          t >= c.start_time && t < c.end_time
      );
      return {
        type: 'sync',
        currentTime: t,
        isPlaying: isPlayingRef.current,
        startTime: activeCaption ? activeCaption.start_time : t,
        endTime: activeCaption ? activeCaption.end_time : t,
        captionText: activeCaption ? (activeCaption.text || '') : '',
      };
    }

    function tick() {
      if (!isPlayingRef.current) {
        iframeSyncRafRef.current = null;
        return;
      }
      const videoEl = videoRef.current;
      const videoContainer = videoContainerRef.current || videoEl?.parentElement;
      if (videoEl && videoContainer) {
        const t = videoEl.currentTime;
        const iframes = videoContainer.querySelectorAll('iframe');
        if (iframes.length > 0) {
          const msg = buildSyncMsg(t);
          iframes.forEach(iframe => iframe.contentWindow?.postMessage(msg, '*'));
        }
      }
      iframeSyncRafRef.current = requestAnimationFrame(tick);
    }

    if (isPlaying) {
      // cancel any existing loop then start fresh
      if (iframeSyncRafRef.current) cancelAnimationFrame(iframeSyncRafRef.current);
      iframeSyncRafRef.current = requestAnimationFrame(tick);
    } else {
      if (iframeSyncRafRef.current) {
        cancelAnimationFrame(iframeSyncRafRef.current);
        iframeSyncRafRef.current = null;
      }
    }

    return () => {
      if (iframeSyncRafRef.current) {
        cancelAnimationFrame(iframeSyncRafRef.current);
        iframeSyncRafRef.current = null;
      }
    };
  }, [isPlaying]);

  // When paused, send sync updates to template iframes if time, play state, or captions change.
  // This ensures the template updates its visual state immediately during seeking or edits.
  useEffect(() => {
    if (!isPlaying) {
      const videoEl = videoRef.current;
      const videoContainer = videoContainerRef.current || videoEl?.parentElement;
      if (videoContainer) {
        const iframes = videoContainer.querySelectorAll('iframe');
        if (iframes.length > 0) {
          const caps = captions || [];
          const activeCaption = caps.find(
            c => c && !c.isTextElement &&
              typeof c.start_time === 'number' &&
              typeof c.end_time === 'number' &&
              currentTime >= c.start_time && currentTime < c.end_time
          );
          const msg = {
            type: 'sync',
            currentTime,
            isPlaying: false,
            startTime: activeCaption ? activeCaption.start_time : currentTime,
            endTime: activeCaption ? activeCaption.end_time : currentTime,
            captionText: activeCaption ? (activeCaption.text || '') : '',
          };
          iframes.forEach(iframe => iframe.contentWindow?.postMessage(msg, '*'));
        }
      }
    }
  }, [currentTime, isPlaying, captions]);

  // Load the font that is ACTUALLY rendered. The caption font is resolved
  // per-caption at render time via resolveScriptFont(font, caption.text) — so a
  // template's Latin family becomes a Devanagari face on Hindi text. handleApplyTemplate
  // only loads the aggregate-resolved family, which can differ from a given caption's
  // resolved family (mixed-script projects) or fail silently. When the rendered face
  // was never loaded the browser swaps in a fallback and the template looks "not
  // applied / plain" even though the panel shows the right font. Loading exactly what
  // we render — base family plus every per-caption resolved family — closes that gap.
  useEffect(() => {
    const baseFamily = captionStyle?.font_family;
    const families = new Set(baseFamily ? [baseFamily] : []);
    (captions || []).forEach((cap) => {
      if (cap && !cap.isTextElement) {
        const captionFamily = captionStyle?.font_family || cap?.applied_template_style?.font_family;
        if (captionFamily) {
          families.add(captionFamily);
          families.add(resolveScriptFont(captionFamily, cap.text));
        }
      }
    });
    families.forEach((family) => {
      if (family) loadGoogleFont(family, [300, 400, 500, 600, 700, 800, 900]).catch(() => {});
    });
  }, [captionStyle?.font_family, captionStyle?.template_20_id, captions]);


  // Stable refs for callbacks passed to MemoizedVideo — these MUST not change reference
  // between renders, otherwise React.memo comparison would need to track them.
  const onVideoLoadedRef = useRef(onVideoLoaded);
  onVideoLoadedRef.current = onVideoLoaded;

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current && !isScrubbingRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  }, [setCurrentTime]);

  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      if (Number.isFinite(videoRef.current.duration)) setDuration(videoRef.current.duration);
      if (onVideoLoadedRef.current) {
        onVideoLoadedRef.current(videoRef.current);
      }
    }
  }, [setDuration]);

  const handleVideoSurfaceToggle = useCallback(() => {
    if (!videoRef.current) return;

    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, [setIsPlaying]);

  const handleVideoSurfaceClick = useCallback((e) => {
    if (draggingWord || Date.now() - lastDragDropTime.current < 250) {
      return;
    }

    const target = e.target;
    if (!(target instanceof Element)) return;

    if (target.closest('button, input, textarea, select, [role="button"], [contenteditable="true"], [data-word-key], .resize-handle, .text-resize-handle, [data-video-control]')) {
      return;
    }

    clearActiveSelection();
    handleVideoSurfaceToggle();
  }, [clearActiveSelection, draggingWord, handleVideoSurfaceToggle]);

  const handleCanvasToolClick = useCallback((tool, e) => {
    e.stopPropagation();

    if (tool === 'zoom-in') {
      setCanvasScale(prev => Math.min(2, +(prev + 0.1).toFixed(2)));
      setActiveCanvasTool(null);
      return;
    }

    if (tool === 'zoom-out') {
      setCanvasScale(prev => Math.max(0.5, +(prev - 0.1).toFixed(2)));
      setActiveCanvasTool(null);
      return;
    }

    if (tool === 'reset') {
      setCanvasScale(1);
      setCanvasOffset({ x: 0, y: 0 });
      setShowCornerGuides(true);
      setShowLayoutGuides(false);
      setActiveCanvasTool(null);
      return;
    }

    if (tool === 'guides') {
      const nextVisible = !(showCornerGuides || showLayoutGuides);
      setShowCornerGuides(nextVisible);
      setShowLayoutGuides(nextVisible);
      setActiveCanvasTool(nextVisible ? 'guides' : null);
      return;
    }

    setActiveCanvasTool(tool);
  }, [showCornerGuides, showLayoutGuides]);

  const handleCanvasMouseDown = useCallback((e) => {
    if (activeCanvasTool !== 'move') return;
    if (e.button !== 0) return;
    if (e.target.closest('button, input, textarea, select, [role="button"]')) return;

    e.preventDefault();
    e.stopPropagation();
    canvasPanStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      originX: canvasOffset.x,
      originY: canvasOffset.y,
    };
    setIsCanvasPanning(true);
  }, [activeCanvasTool, canvasOffset.x, canvasOffset.y]);



  const getActiveCaptions = () => {
    if (!captions || captions.length === 0) return [];
    return captions.filter(cap =>
      cap &&
      !cap.isTextElement &&
      typeof cap.start_time === 'number' &&
      typeof cap.end_time === 'number' &&
      currentTime >= cap.start_time &&
      currentTime < cap.end_time
    );
  };

  const getActiveTextElements = () => {
    if (!captions || captions.length === 0) return [];
    return captions.filter(cap =>
      cap &&
      cap.isTextElement &&
      typeof cap.start_time === 'number' &&
      typeof cap.end_time === 'number' &&
      currentTime >= cap.start_time &&
      currentTime < cap.end_time
    );
  };



  const previewRenderScale = getPreviewRenderScale();
  const displayBackgroundPadding = Math.max(1, Math.round((captionStyle?.background_padding || 6) * 0.58));
  const displayBackgroundWidthMultiplier = Math.max(0.94, captionStyle?.background_h_multiplier || 1);
  const displayCaptionPadY = Math.max(1, Math.round((captionStyle?.background_padding || 6) * 0.55));
  const displayCaptionPadX = 6;





  // Word-level animations — keyframes include translate(-50%,-50%) centering so they
  // don't override the inner span's centering transform.








  const openSourceTemplateWordPopup = useCallback(({ event, node, caption, wordIndex, word }) => {
    if (!caption || !node || !setWordPopup) return;
    if (setSelectedCaptionId) setSelectedCaptionId(caption.id);
    setWordPopup({
      word,
      position: { x: event.clientX, y: event.clientY },
      caption,
      wordIndex,
    });
  }, [setSelectedCaptionId, setWordPopup]);

  const handleCaptionWordPointerIntent = (
    event,
    caption,
    wordIndex,
    word,
    { isDetached = false, dragSource = 'direct' } = {},
  ) => {
    if (!caption || !event.currentTarget) return;
    event.preventDefault();
    event.stopPropagation();

    const target = event.currentTarget;
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    let dragStarted = false;

    // Keep a detached word's pointer stream attached to the same word even
    // though its selected editor is rendered in a portal above the canvas.
    // Without capture, a later click can be swallowed by the portal/canvas and
    // the word editor never reopens after a drag.
    target.setPointerCapture?.(pointerId);

    const cleanup = () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
      document.removeEventListener('pointercancel', handlePointerCancel);
      if (target.hasPointerCapture?.(pointerId)) {
        target.releasePointerCapture?.(pointerId);
      }
    };

    const handlePointerMove = (moveEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      const moved = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY);
      if (moved <= 6) return;

      dragStarted = true;
      cleanup();
      handleWordMouseDown({
        preventDefault: () => moveEvent.preventDefault(),
        stopPropagation: () => moveEvent.stopPropagation(),
        clientX: startX,
        clientY: startY,
        pointerId,
        currentTarget: target,
      }, caption, wordIndex, false, isDetached, dragSource);
    };

    const handlePointerUp = (upEvent) => {
      if (upEvent.pointerId !== pointerId) return;
      cleanup();
      if (dragStarted || !setWordPopup) return;

      upEvent.preventDefault();
      upEvent.stopPropagation();
      const liveCaption = captions?.find(item => item.id === caption.id) || caption;
      if (setSelectedCaptionId) setSelectedCaptionId(liveCaption.id);
      setWordPopup({
        word,
        position: { x: upEvent.clientX, y: upEvent.clientY },
        caption: liveCaption,
        wordIndex,
      });
    };

    const handlePointerCancel = (cancelEvent) => {
      if (cancelEvent.pointerId !== pointerId) return;
      cleanup();
    };

    document.addEventListener('pointermove', handlePointerMove, { passive: false });
    document.addEventListener('pointerup', handlePointerUp);
    document.addEventListener('pointercancel', handlePointerCancel);
  };

  const startSourceTemplateWordDrag = useCallback(({
    event,
    node,
    caption,
    wordIndex,
    startClientX,
    startClientY,
  }) => {
    if (setSelectedCaptionId) setSelectedCaptionId(caption.id);
    handleWordMouseDown({
      preventDefault: () => event.preventDefault(),
      stopPropagation: () => event.stopPropagation(),
      clientX: startClientX ?? event.clientX,
      clientY: startClientY ?? event.clientY,
      pointerId: event.pointerId,
      currentTarget: node,
    }, caption, wordIndex, false, false, 'source-template');
  }, [captionStyle, setCaptions, setCaptionsRaw, setSelectedCaptionId]);

  const activeCaptions = getActiveCaptions();
  const activeTextElements = getActiveTextElements();

  const captionHasDetachedWords = (caption) => (
    Object.values(caption.wordStyles || {}).some(isWordDetached)
  );

  const isCaptionWordEditingActive = (caption) => (
    (draggingWord && draggingWord.captionId === caption.id)
    || (wordPopup?.caption?.id === caption.id)
  );

  const isCaptionCptAdjustmentActive = (caption) => (
    (draggingWord && draggingWord.captionId === caption.id)
    || (resizingWord && resizingWord.captionId === caption.id)
    || (wordPopup?.caption?.id === caption.id)
  );

  // Word-by-word reveal is an explicit display-mode choice (StyleControls sets
  // show_inactive=false for it) — never a side effect of dragging a word.
  // Deriving it from captionHasDetachedWords() meant one drag silently switched
  // the whole caption to word-by-word, so the dragged word vanished until its
  // spoken moment and could no longer be clicked to reopen the word editor.
  const shouldRevealSequentially = (caption) => (
    !isCaptionWordEditingActive(caption)
    && isPlaying
    && captionStyle?.show_inactive === false
  );

  // A displaced word authors a CPT. Editing stays fully visible; playback and
  // export build the sentence cumulatively, one word at a time, with no motion.
  const captionHasCptWords = captionHasCreativelyPositionedWords;

  const isCptWordPending = (caption, wordIndex, currentIdx) => (
    isPlaying
    && !shouldRevealSequentially(caption)
    && !isCaptionCptAdjustmentActive(caption)
    && captionHasCptWords(caption)
    && wordIndex > currentIdx
  );
  const getCaptionCurrentWordIndex = (caption, wordCount) => {
    const activeTemplateId = caption?.template_id || caption?.applied_template_style?.template_id || captionStyle?.template_id;
    if (
      isPlaying
      && captionHasCptWords(caption)
      && Object.prototype.hasOwnProperty.call(cptRevealIndexes, caption.id)
    ) {
      return Math.max(0, Math.min(Math.max(1, wordCount) - 1, cptRevealIndexes[caption.id]));
    }
    return getCaptionRevealWordIndex(caption, currentTime, wordCount, activeTemplateId);
  };

  const getCaptionCptRenderTime = (caption) => {
    if (
      !isPlaying
      || !captionHasCptWords(caption)
      || !Object.prototype.hasOwnProperty.call(cptRevealIndexes, caption.id)
    ) {
      return currentTime;
    }
    const wordCount = Math.max(
      1,
      String(caption.text || '').trim().split(/\s+/).filter(Boolean).length,
    );
    const revealTimes = getCaptionWordRevealTimes(caption, wordCount);
    const revealIndex = Math.max(0, Math.min(wordCount - 1, cptRevealIndexes[caption.id]));
    return (revealTimes[revealIndex] ?? currentTime) + 0.00001;
  };

  const renderEditableAdvancedTemplateCaption = (caption, blockIndex = 0) => {
    const words = caption.text.split(' ').filter(Boolean);
    const wordCount = words.length;
    const currentIdx = getCaptionCurrentWordIndex(caption, wordCount);
    const templateId = getCaptionTemplateId(caption, captionStyle);
    const normalizedBlockIndex = normalizeTemplatePhaseIndex(templateId, blockIndex);
    const blockType = getOriginalTemplateBlockType(templateId, normalizedBlockIndex);
    const blockClass = `${templateId}-b${normalizedBlockIndex}`;
    const isWbwBlock = blockType.startsWith('wbw-');
    const variantClass = isWbwBlock ? blockType : '';
    const templateMarkup = caption?.applied_template_style?.template_markup
      || caption?.template_markup
      || captionStyle?.template_markup
      || '';
    const templateImpClass = getAppliedAdvancedTemplateImpClass(templateId, normalizedBlockIndex, templateMarkup);
    const templateImpWordIndex = Number(emotionalCaptionPlan.get(caption?.id)?.impWordIndex ?? caption?.imp_word_index ?? -1);
    const templateImpWordIndices = resolveImpWordIndicesForWords(
      words,
      templateImpWordIndex,
      emotionalCaptionPlan.get(caption?.id)?.impWordIndices || caption?.imp_word_indices || [],
    );
    const isT17LetterSnapBlock = templateId === 't17' && normalizedBlockIndex === 1;
    const templateFitClassName = isT17LetterSnapBlock
      ? 'snap-txt'
      : isWbwBlock
        ? `${variantClass} lekha-template-fit`
        : 'lekha-template-fit';
    const templateFitStyle = isT17LetterSnapBlock ? {
      opacity: 1,
      filter: 'none',
      transform: 'none',
      letterSpacing: '0.04em',
      display: 'inline-block',
      color: '#ff3d71',
      WebkitTextFillColor: '#ff3d71',
      textShadow: '0 1px 8px rgba(0,0,0,0.82), 0 0 2px rgba(0,0,0,0.92), 0 0 16px rgba(255,61,113,0.22)',
      animation: 'none',
      transition: 'none',
    } : undefined;

    const renderEditableTemplateWord = (word, wordIndex, localIndex, localLength, options = {}) => {
      if (shouldRevealSequentially(caption) && wordIndex > currentIdx) return null;

      const styleKey = `${caption.id}-${wordIndex}`;
      const ws = caption.wordStyles?.[styleKey] || {};
      const detached = isWordDetached(ws);
      const isSelected = wordPopup?.caption?.id === caption.id && wordPopup?.wordIndex === wordIndex;
      const wordAnimation = ws.animation && ws.animation !== 'none'
        ? getWordAnimationStyle(ws.animation, ws.animationSpeed || 1)
        : 'none';
      const cptMotionStyle = getCptWordMotionStyle(
        caption,
        ws,
        wordIndex,
        wordCount,
        currentIdx,
        { templateBlockType: blockType },
      );
      const resolvedWordMotionStyle = cptMotionStyle || { animation: wordAnimation };
      const wordUsesWbwClass = options.forceWbwClass ?? isWbwBlock;
      const isTemplateEmphasis = templateImpWordIndices.includes(wordIndex) && !!templateImpClass;
      const emphasisClassName = isTemplateEmphasis
        ? templateImpClass
        : ws.isEmphasis
          ? 'imp-bold'
          : '';
      const wordClassName = [
        wordUsesWbwClass ? 'w in' : 'template-editable-word',
        options.extraClassName || '',
        emphasisClassName,
        isTemplateEmphasis ? 'is-emphasis' : '',
        isSelected ? 'ring-2 ring-[#F5A623] rounded-sm' : '',
      ].filter(Boolean).join(' ');

      return (
        <React.Fragment key={`${styleKey}-editable`}>
          {localIndex > 0 && ' '}
          <span
            data-i={wordUsesWbwClass ? wordIndex : undefined}
            data-imp={isTemplateEmphasis ? 'true' : undefined}
            data-imp-cls={isTemplateEmphasis ? templateImpClass : undefined}
            data-word-key={detached ? undefined : styleKey}
            data-template-block-class={blockClass}
            data-template-block-type={blockType}
            data-template-word-class={wordClassName}
            className={wordClassName}
            style={{
              display: 'inline-block',
              opacity: isCptWordPending(caption, wordIndex, currentIdx) ? 0 : undefined,
              visibility: detached ? 'hidden' : 'visible',
              cursor: detached
                ? 'default'
                : (draggingWord?.captionId === caption.id && draggingWord?.wordIndex === wordIndex ? 'grabbing' : 'grab'),
              animation: 'none',
            }}
            onPointerDown={detached ? undefined : (e) => handleCaptionWordPointerIntent(
              e,
              caption,
              wordIndex,
              word,
              { dragSource: 'template' },
            )}
            onClick={(e) => {
              if (detached || Date.now() - lastDragDropTime.current < 150) return;
              if (setWordPopup) {
                e.stopPropagation();
                setWordPopup({
                  word,
                  position: { x: e.clientX, y: e.clientY },
                  caption,
                  wordIndex,
                });
              }
            }}
          >
            <span
              data-word-drag-visual="true"
              style={{
                display: 'inline-block',
                transformOrigin: 'center center',
                ...resolvedWordMotionStyle,
              }}
            >
              {renderWordTextContent(word, ws, 'inherit')}
            </span>
            {localIndex < localLength - 1 ? '\u00A0' : ''}
          </span>
        </React.Fragment>
      );
    };

    const renderEditableLineWords = (line, options = {}) => (
      line.map(({ word, wordIndex }, localIndex) => (
        renderEditableTemplateWord(word, wordIndex, localIndex, line.length, options)
      ))
    );

    const renderEditableTemplateBody = () => {
      if (templateId === 't18' && normalizedBlockIndex === 0) {
        const lines = splitWordsIntoIndexedLines(words, 2);
        const topLine = lines[0] || [];
        const bottomLine = lines[1] || [];
        return (
          <span className="split-title lekha-template-fit">
            <span className="split-top">
              {renderEditableLineWords(topLine)}
            </span>
            <span className="split-bot">
              {bottomLine.length ? (
                <span className="imp-purple is-emphasis" data-imp="true" data-imp-cls="imp-purple">
                  {renderEditableLineWords(bottomLine)}
                </span>
              ) : null}
            </span>
          </span>
        );
      }

      const wordNodes = words.map((word, wordIndex) => (
        renderEditableTemplateWord(word, wordIndex, wordIndex, words.length)
      ));

      if (isT17LetterSnapBlock) {
        return (
          <span className="letter-snap-blk lekha-template-fit">
            <span className={templateFitClassName} style={templateFitStyle}>
              {wordNodes}
            </span>
          </span>
        );
      }

      return (
        <span className={templateFitClassName} style={templateFitStyle}>
          {wordNodes}
        </span>
      );
    };

    return (
      <span className={`lekha-original-template ${templateId}-stage`}>
        <span
          className={`sblock ${templateId}-block ${blockClass} active lekha-applied-advanced-template`}
          data-template-block-index={normalizedBlockIndex}
          data-template-block-type={blockType}
          style={{ opacity: 1, transition: 'opacity 280ms ease' }}
        >
          {renderEditableTemplateBody()}
        </span>
      </span>
    );
  };

  const renderAppliedSidebarTemplateCaption = (caption, templateCaptionIndex = 0) => {
    const text = String(caption?.text || '').trim()
    if (!text) return null

    const appliedStyle = caption?.applied_template_style || {}
    const globalHasSidebarTemplate = hasSidebarTemplateStyle(captionStyle)
    const styleBase = globalHasSidebarTemplate
      ? { ...appliedStyle, ...captionStyle }
      : { ...captionStyle, ...appliedStyle }
    const templateValue = (key, fallback = '') => (
      globalHasSidebarTemplate
        ? (styleBase?.[key] ?? fallback)
        : (caption?.[key] ?? styleBase?.[key] ?? fallback)
    )
    const templateSourceValue = templateValue('template_source', 'lekha-20')
    const effectiveStyle = {
      ...styleBase,
      template_id: templateValue('template_id'),
      template_20_id: templateValue('template_20_id'),
      template_source: templateSourceValue,
      template_class: templateValue('template_class'),
      template_name: templateValue('template_name'),
      template_layout: templateValue('template_layout'),
      template_effect: templateValue('template_effect'),
      emotional_mode: caption?.emotional_mode || emotionalCaptionPlan.get(caption?.id)?.mode || 'normal',
      font_family: styleBase.font_family || 'Raleway',
      font_size: styleBase.font_size || 22,
      font_weight: styleBase.font_weight || '300',
      font_style: styleBase.font_style || 'normal',
      text_color: styleBase.text_color || '#FFFFFF',
      text_opacity: templateSourceValue === 'lekha-lc' ? 1 : (styleBase.text_opacity ?? 1),
      text_case: styleBase.text_case || 'none',
      line_spacing: styleBase.line_spacing || 1.25,
      secondary_color: styleBase.secondary_color || '#DDAA03',
    }
    const resolvedFont = resolveScriptFont(effectiveStyle?.font_family, text) || effectiveStyle?.font_family || 'Raleway'
    const fontSize = (effectiveStyle?.font_size || 22) * previewRenderScale
    const emotional = emotionalCaptionPlan.get(caption?.id)
    const phaseCount = countAppliedTemplatePhases(effectiveStyle)
    // Caption order remains the default. The moved Basic cards can also set a
    // scene-dot offset, persisted on each caption when the template is applied.
    const storedPhaseIndex = Number(caption?.template_phase_index)
    const selectedPhase = (Number.isFinite(storedPhaseIndex)
      ? Math.max(0, storedPhaseIndex)
      : Math.max(0, templateCaptionIndex)) % phaseCount
    const impWordIndex = Number(emotional?.impWordIndex ?? caption?.imp_word_index ?? -1)
    const impWordIndices = emotional?.impWordIndices || caption?.imp_word_indices || []
    const emphasisColor = emotional?.emphasisColor || caption?.emphasis_color || ''
    const templateHtml = buildAppliedSidebarTemplateInline(
      text,
      effectiveStyle,
      { activePhase: selectedPhase, settled: false, impWordIndex, impWordIndices },
    )

    if (templateHtml) {
      return (
        <>
          <AppliedSidebarTemplateStyles source={effectiveStyle?.template_source || 'lekha-20'} />
          <AppliedSidebarTemplateSourceRenderer
            html={templateHtml}
            caption={caption}
            captionId={caption?.id}
            captionText={text}
            effectiveStyle={effectiveStyle}
            resolvedFont={resolvedFont}
            fontSize={fontSize}
            currentTime={getCaptionCptRenderTime(caption)}
            isPlaying={isPlaying}
            videoRef={videoRef}
            startTime={caption?.start_time || 0}
            endTime={caption?.end_time || caption?.start_time || 0}
            phaseOffset={selectedPhase}
            emphasisColor={emphasisColor}
            renderScale={previewRenderScale}
            onSourceWordClick={openSourceTemplateWordPopup}
            onSourceWordPointerDown={startSourceTemplateWordDrag}
            isSelected={selectedCaptionId === caption?.id}
          />
        </>
      )
    }

    const words = text.split(/\s+/).filter(Boolean)
    const currentIdx = getCaptionCurrentWordIndex(caption, words.length)
    const lineCount = getSidebarTemplateLineCount(effectiveStyle, words.length)
    const lines = splitWordsIntoIndexedLines(words, lineCount)
    const motion = getSidebarTemplateMotion(effectiveStyle)
    const motionClass = `w${motion}`
    const accentColor = effectiveStyle?.secondary_color || '#DDAA03'
    const primaryColor = effectiveStyle?.text_color || '#FFFFFF'
    const templateClass = effectiveStyle?.template_class || effectiveStyle?.template_20_id || ''

    return (
      <>
        <SidebarSourceTemplateStyles />
        <span
          key={`applied-sidebar-tpl-${caption?.id || 'active'}-${effectiveStyle?.template_20_id || 'tpl'}-${text}`}
          className={[
            'lekha-applied-template-host',
            'lekha-sidebar-source-template',
            'lekha-sidebar-applied-react',
            templateClass,
            effectiveStyle?.text_gradient ? 'has-text-gradient' : '',
            effectiveStyle?.highlight_gradient ? 'has-highlight-gradient' : '',
          ].filter(Boolean).join(' ')}
          data-applied-template-id={effectiveStyle?.template_20_id || ''}
          data-applied-template-source={effectiveStyle?.template_source || 'lekha-20'}
          data-applied-template-layout={effectiveStyle?.template_layout || 'word-by-word'}
          data-applied-template-motion={motion}
          data-export-measure="sidebar-template"
          data-export-caption-id={caption?.id || ''}
          style={{
            '--sidebar-source-color': effectiveStyle?.text_color || '#FFFFFF',
            '--sidebar-source-accent': accentColor,
            '--sidebar-source-line-height': effectiveStyle?.line_spacing || 1.25,
            '--template-text-gradient': effectiveStyle?.text_gradient || 'none',
            '--template-highlight-gradient': effectiveStyle?.highlight_gradient || 'none',
            color: primaryColor,
            fontFamily: resolvedFont,
            fontSize: `${fontSize}px`,
            fontWeight: effectiveStyle?.font_weight || '300',
            fontStyle: effectiveStyle?.font_style || 'normal',
            textTransform: effectiveStyle?.text_case && effectiveStyle.text_case !== 'none' ? effectiveStyle.text_case : undefined,
            lineHeight: effectiveStyle?.line_spacing || 1.25,
            opacity: effectiveStyle?.text_opacity ?? 1,
            textAlign: 'center',
          }}
        >
          <span className="stage">
            <span className="sb active">
              <span className={`wbw-line ${motionClass}`} data-template-effect={effectiveStyle?.template_effect || ''}>
                {lines.map((line, lineIndex) => (
                  <span className="lekha-sidebar-source-line" key={`${caption?.id || 'caption'}-line-${lineIndex}`}>
                    {line.map(({ word, wordIndex }, localIndex) => {
                      if (shouldRevealSequentially(caption) && wordIndex > currentIdx) return null
                      const styleKey = `${caption.id}-${wordIndex}`
                      const ws = caption.wordStyles?.[styleKey] || {}
                      const isCurrent = wordIndex === currentIdx
                      const isPast = wordIndex < currentIdx
                      return (
                        <React.Fragment key={styleKey}>
                          {localIndex > 0 && ' '}
                          <span
                            className={[
                              'wbw-word',
                              isCurrent ? 'is-current' : '',
                              ws.isEmphasis ? 'is-emphasis' : '',
                            ].filter(Boolean).join(' ')}
                            data-word-key={styleKey}
                            data-sidebar-word-state={isCurrent ? 'current' : isPast ? 'past' : 'future'}
                            style={{
                              '--sidebar-source-word-delay': `${Math.min(wordIndex, 8) * 70}ms`,
                              opacity: isCptWordPending(caption, wordIndex, currentIdx) ? 0 : 1,
                              animation: 'none',
                              color: ws.color || (isCurrent ? accentColor : primaryColor),
                              fontFamily: ws.fontFamily || 'inherit',
                              fontWeight: ws.fontWeight || (isCurrent ? effectiveStyle?.font_weight || '700' : 'inherit'),
                              fontStyle: ws.fontStyle || 'inherit',
                              textDecoration: ws.textDecoration || 'inherit',
                              textTransform: ws.textTransform || undefined,
                              textShadow: isCurrent
                                ? `0 0 16px ${accentColor}55`
                                : undefined,
                              ...computeWordEffectCSS(ws),
                            }}
                          >
                            {renderWordTextContent(word, ws, 'inherit')}
                          </span>
                        </React.Fragment>
                      )
                    })}
                  </span>
                ))}
              </span>
            </span>
          </span>
        </span>
      </>
    )
  }

  const renderAppliedBasicTemplateCaption = (caption, templateCaptionIndex = 0) => {
    const text = String(caption?.text || '').trim();
    if (!text) return null;

    const appliedStyle = caption?.applied_template_style || {};
    const templateId = caption?.template_id || appliedStyle?.template_id || captionStyle?.template_id || '';
    const globalStyleMatchesTemplate = captionStyle?.template_id === templateId;
    const effectiveStyle = {
      ...appliedStyle,
      ...(globalStyleMatchesTemplate ? captionStyle : {}),
      template_id: templateId,
      template_source: caption?.template_source || (globalStyleMatchesTemplate ? captionStyle?.template_source : '') || appliedStyle?.template_source || 'lekha-basic',
      template_class: caption?.template_class || (globalStyleMatchesTemplate ? captionStyle?.template_class : '') || appliedStyle?.template_class || '',
      template_name: caption?.template_name || (globalStyleMatchesTemplate ? captionStyle?.template_name : '') || appliedStyle?.template_name || '',
      template_layout: caption?.template_layout || (globalStyleMatchesTemplate ? captionStyle?.template_layout : '') || appliedStyle?.template_layout || '',
      template_effect: caption?.template_effect || (globalStyleMatchesTemplate ? captionStyle?.template_effect : '') || appliedStyle?.template_effect || '',
      template_markup: caption?.template_markup || (globalStyleMatchesTemplate ? captionStyle?.template_markup : '') || appliedStyle?.template_markup || '',
    };
    const words = text.split(/\s+/).filter(Boolean);
    const currentIdx = getCaptionCurrentWordIndex(caption, words.length);
    const phaseCount = countAppliedBasicTemplatePhases(effectiveStyle);
    // Caption order is the authored Basic-template phase source, matching the
    // right-panel preview dots. Ignore stale saved phase=0 values from older
    // applies so Iman -> Horror do not collapse onto the first block.
    const selectedPhase = Math.max(0, templateCaptionIndex) % phaseCount;
    const emotional = emotionalCaptionPlan.get(caption?.id);
    const impWordIndex = Number(emotional?.impWordIndex ?? caption?.imp_word_index ?? -1);
    const impWordIndices = emotional?.impWordIndices || caption?.imp_word_indices || [];
    const templateHtml = buildAppliedBasicTemplateInline(text, effectiveStyle, {
      activePhase: selectedPhase,
      currentIndex: 0,
      impWordIndex,
      impWordIndices,
    });

    if (!templateHtml) return null;

    const resolvedFont = resolveScriptFont(effectiveStyle?.font_family, text) || effectiveStyle?.font_family || 'Inter';
    const normalizedTemplateFontSize = normalizeAppliedBasicTemplateFontSize(
      effectiveStyle?.template_id,
      effectiveStyle?.font_size || 22,
    ) || 22;
    const fontSize = scaleTemplateFontSize(normalizedTemplateFontSize)
      * APPLIED_BASIC_TEMPLATE_FONT_SCALE
      * previewRenderScale;
    const basicTemplateRenderKey = [
      caption?.id || 'caption',
      effectiveStyle?.template_id || 'basic-template',
      selectedPhase,
      getAppliedTemplateMarkupSignature(templateHtml),
      text,
    ].join('|');

    return (
      <AppliedBasicTemplateMarkup
        key={basicTemplateRenderKey}
        caption={caption}
        captionId={caption?.id}
        templateId={effectiveStyle?.template_id || ''}
        selectedPhase={selectedPhase}
        text={text}
        html={templateHtml}
        currentIndex={currentIdx}
        wordCount={words.length}
        currentTime={getCaptionCptRenderTime(caption)}
        isPlaying={isPlaying}
        videoRef={videoRef}
        hostStyle={{
            '--template-primary': effectiveStyle?.text_color || '#ffffff',
            '--template-text-gradient': effectiveStyle?.text_gradient || 'none',
            '--template-secondary': effectiveStyle?.secondary_color || '#000000',
            '--template-bg': effectiveStyle?.background_color || 'transparent',
            '--template-highlight': effectiveStyle?.highlight_color || effectiveStyle?.emphasis_color || effectiveStyle?.secondary_color || ADVANCED_TEMPLATE_EMPHASIS_COLORS[effectiveStyle?.template_id] || '#DDAA03',
            '--template-highlight-gradient': effectiveStyle?.highlight_gradient || 'none',
            '--template-karaoke-1': effectiveStyle?.karaoke_color_1 || effectiveStyle?.highlight_color || effectiveStyle?.emphasis_color || effectiveStyle?.secondary_color || '#DDAA03',
            '--template-karaoke-2': effectiveStyle?.karaoke_color_2 || '#22D3EE',
            '--template-karaoke-3': effectiveStyle?.karaoke_color_3 || '#FB923C',
            '--applied-basic-scale': previewRenderScale,
            '--applied-basic-width': `${Math.max(1, Math.round(320 * previewRenderScale))}px`,
            color: effectiveStyle?.text_color || '#ffffff',
            fontFamily: resolvedFont,
            fontSize: `${fontSize}px`,
            fontWeight: effectiveStyle?.font_weight || '800',
            fontStyle: effectiveStyle?.font_style || 'normal',
            lineHeight: effectiveStyle?.line_spacing || 1.25,
            textTransform: effectiveStyle?.text_case && effectiveStyle.text_case !== 'none' ? effectiveStyle.text_case : undefined,
        }}
        renderScale={previewRenderScale}
        onSourceWordClick={openSourceTemplateWordPopup}
        onSourceWordPointerDown={startSourceTemplateWordDrag}
        isSelected={selectedCaptionId === caption?.id}
      />
    );
  };

  const detachedCaptionWordOverlays = activeCaptions.flatMap((caption) => {
    if (isRecreatedAdvancedTemplateId(getCaptionTemplateId(caption, captionStyle))) return [];
    const words = caption.text.split(' ');
    const wordCount = words.length;
    const currentIdx = getCaptionCurrentWordIndex(caption, wordCount);

    return words.map((word, wordIndex) => {
      if (shouldRevealSequentially(caption) && wordIndex > currentIdx) return null;

      const styleKey = `${caption.id}-${wordIndex}`;
      const ws = caption.wordStyles?.[styleKey] || {};
      if (!isWordDetached(ws)) return null;

      const isSelected = wordPopup?.caption?.id === caption.id && wordPopup?.wordIndex === wordIndex;
      if (isSelected) return null;

      const rawWordFontSize = ws.fontSize || ws.frozenFontSize || (captionStyle?.font_size || 18);
      const wordFontSize = rawWordFontSize * previewRenderScale;
      const emphasisAccent = captionStyle?.secondary_color || '#DDAA03';
      const wordAnimation = ws.animation && ws.animation !== 'none'
        ? getWordAnimationStyle(ws.animation, ws.animationSpeed || 1)
        : 'none';
      const { x: renderOffsetX, y: renderOffsetY } = getWordRenderOffset(ws);
      const emphasisStyle = ws.isEmphasis ? {
        fontWeight: 'bold',
        color: ws.color || emphasisAccent,
        fontSize: `${Math.round(wordFontSize * 1.2)}px`,
        textShadow: `0 0 18px ${emphasisAccent}99, 0 0 6px ${emphasisAccent}66`,
      } : {};
      const templateBlockClass = ws.templateBlockClass || '';
      const templateBlockType = ws.templateBlockType || '';
      const templateWordClass = ws.templateWordClass || '';
      const cptMotionStyle = getCptWordMotionStyle(
        caption,
        ws,
        wordIndex,
        wordCount,
        currentIdx,
        { templateBlockType },
      );
      const resolvedWordMotionStyle = cptMotionStyle || { animation: wordAnimation };
      const wordWrapStyle = ws.boxWidth ? {
        width: '100%',
        maxWidth: '100%',
        whiteSpace: 'normal',
        overflowWrap: 'anywhere',
        wordBreak: 'break-all',
        textAlign: 'center',
      } : {};
      const detachedWordContent = (
        <span style={{ display: ws.boxWidth ? 'block' : 'inline-block', ...wordWrapStyle, ...emphasisStyle }}>
          {renderAnimatedDetachedWordContent(
            word,
            ws,
            'inherit',
            resolvedWordMotionStyle,
            templateWordClass,
          )}
        </span>
      );

      return (
        <span
          key={`detached-${styleKey}`}
          data-word-key={styleKey}
          className={[
            captionStyle?.template_id ? `lekha-original-template ${captionStyle.template_id}-stage` : '',
            isSelected ? 'ring-2 ring-[#F5A623] rounded-sm' : '',
          ].filter(Boolean).join(' ')}
          style={{
            position: 'absolute',
            opacity: isCptWordPending(caption, wordIndex, currentIdx) ? 0 : 1,
            left: `${ws.abs_x_pct}%`,
            top: `${ws.abs_y_pct}%`,
            transform: `translate(-50%, -50%) translate(${renderOffsetX}px, ${renderOffsetY}px)${ws.rotation ? ` rotate(${ws.rotation}deg)` : ''}`,
            transformOrigin: 'center center',
            zIndex: 35,
            cursor: draggingWord?.captionId === caption.id && draggingWord?.wordIndex === wordIndex ? 'grabbing' : 'default',
            whiteSpace: ws.boxWidth ? 'normal' : 'nowrap',
            overflowWrap: ws.boxWidth ? 'anywhere' : 'normal',
            wordBreak: ws.boxWidth ? 'break-all' : 'normal',
            fontFamily: ws.fontFamily || captionStyle?.font_family || 'Inter',
            fontSize: `${wordFontSize}px`,
            fontWeight: ws.fontWeight || captionStyle?.font_weight || 'inherit',
            fontStyle: ws.fontStyle || captionStyle?.font_style || 'inherit',
            textDecoration: 'none',
            textTransform: ws.textTransform || undefined,
            ...(ws.boxWidth ? {
              width: `${ws.boxWidth * previewRenderScale}px`,
              textAlign: 'center',
            } : {}),
            ...(ws.backgroundColor || ws.highlightGradient ? {
              background: ws.highlightGradient || `rgba(${parseInt(ws.backgroundColor.slice(1,3),16)}, ${parseInt(ws.backgroundColor.slice(3,5),16)}, ${parseInt(ws.backgroundColor.slice(5,7),16)}, ${ws.backgroundOpacity ?? 0.6})`,
              borderRadius: '3px',
              padding: `${(ws.backgroundPadding || 2) * previewRenderScale}px ${4 * previewRenderScale}px`,
            } : {}),
            ...emphasisStyle,
          }}
          onPointerDown={(e) => handleCaptionWordPointerIntent(
            e,
            caption,
            wordIndex,
            word,
            { isDetached: true },
          )}
          onClick={(e) => {
            if (Date.now() - lastDragDropTime.current < 150) return;
            if (setWordPopup) {
              e.stopPropagation();
              setWordPopup({
                word,
                position: { x: e.clientX, y: e.clientY },
                caption,
                wordIndex,
              });
            }
          }}
        >
          {captionStyle?.template_id ? (
            <span
              className={`sblock ${captionStyle.template_id}-block ${templateBlockClass} active lekha-applied-advanced-template`}
              data-template-block-type={templateBlockType}
              style={{ opacity: 1, ...(ws.boxWidth ? { display: 'block', ...wordWrapStyle } : {}) }}
            >
              {detachedWordContent}
            </span>
          ) : detachedWordContent}
        </span>
      );
    }).filter(Boolean);
  });

  const selectedDetachedWord = (() => {
    if (!wordPopup?.caption || wordPopup?.type === 'element') return null;
    const liveCaption = captions?.find(c => c.id === wordPopup.caption.id) || activeCaptions.find(c => c.id === wordPopup.caption.id);
    if (!liveCaption) return null;

    const styleKey = `${liveCaption.id}-${wordPopup.wordIndex}`;
    const ws = liveCaption.wordStyles?.[styleKey] || {};
    if (!isWordDetached(ws)) return null;

    const words = (liveCaption.text || '').split(' ');
    const renderOffset = getWordRenderOffset(ws);
    return {
      caption: liveCaption,
      wordIndex: wordPopup.wordIndex,
      word: words[wordPopup.wordIndex] || wordPopup.word,
      fontSize: ws.fontSize || ws.frozenFontSize || (captionStyle?.font_size || 18),
      boxWidth: ws.boxWidth || null,
      textScaleX: ws.textScaleX || 1,
      x: ws.abs_x_pct,
      y: ws.abs_y_pct,
      renderOffset,
      rotation: ws.rotation || 0,
      wordStyle: ws,
    };
  })();

  const handleDetachedWordResizeStart = (e) => {
    if (!selectedDetachedWord || !setCaptions) return;
    e.preventDefault();
    e.stopPropagation();
    if (wordResizeActiveRef.current) return;

    const handle = e.currentTarget;
    const resizeAxis = handle.dataset.resizeAxis || 'corner';
    const selectionBox = handle.closest('[data-selected-word-box="true"]');
    const textNode = selectionBox?.querySelector('[data-selected-word-text="true"]');
    if (!selectionBox || !textNode) return;

    wordResizeActiveRef.current = true;
    if (addToHistory) addToHistory();

    const captionId = selectedDetachedWord.caption.id;
    const wordIndex = selectedDetachedWord.wordIndex;
    const startX = e.clientX;
    const startY = e.clientY;
    const startRect = selectionBox.getBoundingClientRect();
    const startTextRect = textNode.getBoundingClientRect();
    const videoRect = videoContainerRef.current?.getBoundingClientRect();
    const viewportScale = selectedDetachedWordViewport?.scale || 1;
    const renderScale = Math.max(previewRenderScale * viewportScale, 0.001);
    const initialFontSize = selectedDetachedWord.fontSize;
    const minTextboxWidth = 24;
    const initialBoxWidth = Math.max(minTextboxWidth, selectedDetachedWord.boxWidth || (startRect.width / renderScale) || Math.ceil(startTextRect.width / renderScale) || 80);
    const startCenterClientX = startRect.left + startRect.width / 2;
    const startCenterClientY = startRect.top + startRect.height / 2;
    const isLeftHandle = handle.dataset.resizeSide === 'left';
    const isTopHandle = handle.dataset.resizeSide === 'top';

    setResizingWord({
      captionId,
      wordIndex,
      startX,
      startY,
      initialFontSize,
      axis: resizeAxis,
    });
    document.body.style.cursor = resizeAxis === 'horizontal' ? 'ew-resize' : 'nwse-resize';
    document.body.style.userSelect = 'none';

    const writeWordStyle = (producer) => {
      const captionUpdater = setCaptionsRaw || setCaptions;
      captionUpdater(prev => prev.map(c => {
        if (c.id !== captionId) return c;
        const wordStyles = c.wordStyles || {};
        const styleKey = `${c.id}-${wordIndex}`;
        const currentWordStyle = wordStyles[styleKey] || {};
        return {
          ...c,
          wordStyles: {
            ...wordStyles,
            [styleKey]: producer(currentWordStyle),
          },
        };
      }));
    };

    const handleResizeMove = (moveEvent) => {
      moveEvent.preventDefault();
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      if (resizeAxis === 'horizontal') {
        const signedDeltaX = isLeftHandle ? -deltaX : deltaX;
        const nextBoxWidth = Math.max(minTextboxWidth, Math.min(520, Math.round(initialBoxWidth + signedDeltaX / renderScale)));
        const widthDeltaPx = (nextBoxWidth - initialBoxWidth) * renderScale;
        const nextCenterClientX = startCenterClientX + (isLeftHandle ? -widthDeltaPx / 2 : widthDeltaPx / 2);
        const nextAbsXPct = videoRect?.width
          ? Math.max(0, Math.min(100, ((nextCenterClientX - videoRect.left) / videoRect.width) * 100))
          : selectedDetachedWord.x;
        const nextAbsYPct = videoRect?.height
          ? Math.max(0, Math.min(100, ((startCenterClientY - videoRect.top) / videoRect.height) * 100))
          : selectedDetachedWord.y;
        selectionBox.style.width = `${nextBoxWidth * renderScale}px`;
        selectionBox.style.left = `${nextCenterClientX}px`;
        textNode.style.width = '100%';
        textNode.style.transform = '';
        selectionBox.style.overflow = 'visible';
        selectionBox.style.textAlign = 'center';
        selectionBox.style.whiteSpace = 'normal';
        selectionBox.style.overflowWrap = 'anywhere';
        selectionBox.style.wordBreak = 'break-all';

        writeWordStyle((currentWordStyle) => ({
          ...currentWordStyle,
          boxWidth: nextBoxWidth,
          textScaleX: 1,
          abs_x_pct: nextAbsXPct,
          abs_y_pct: nextAbsYPct,
        }));
        return;
      }

      const signedDeltaX = isLeftHandle ? -deltaX : deltaX;
      const signedDeltaY = isTopHandle ? -deltaY : deltaY;
      const dominantDelta = Math.abs(signedDeltaX) >= Math.abs(signedDeltaY) ? signedDeltaX : signedDeltaY;
      const startMeasure = Math.max(startTextRect.width, startTextRect.height, 1);
      const scale = Math.max(0.35, Math.min(5, (startMeasure + dominantDelta) / startMeasure));
      const nextFontSize = Math.max(8, Math.min(140, Math.round(initialFontSize * scale)));

      selectionBox.style.fontSize = `${nextFontSize * renderScale}px`;
      selectionBox.style.width = 'max-content';
      textNode.style.width = 'auto';
      textNode.style.transform = '';
      selectionBox.style.whiteSpace = 'nowrap';
      selectionBox.style.overflowWrap = 'normal';
      selectionBox.style.wordBreak = 'normal';

      writeWordStyle((currentWordStyle) => {
        const nextWordStyle = {
          ...currentWordStyle,
          fontSize: nextFontSize,
          frozenFontSize: nextFontSize,
        };
        delete nextWordStyle.boxWidth;
        delete nextWordStyle.textScaleX;
        return nextWordStyle;
      });
    };

    const handleResizeEnd = () => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      wordResizeActiveRef.current = false;
      setResizingWord(null);
    };

    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  };

  const handleDetachedWordRotateStart = (e) => {
    if (!selectedDetachedWord || !setCaptions) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    if (addToHistory) addToHistory();

    const captionId = selectedDetachedWord.caption.id;
    const wordIndex = selectedDetachedWord.wordIndex;
    const box = e.currentTarget.closest('[data-selected-word-box="true"]');
    const rect = box?.getBoundingClientRect();
    if (!rect) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const initialRotation = selectedDetachedWord.rotation || 0;

    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
    box.style.transformOrigin = 'center center';

    const handleRotateMove = (moveEvent) => {
      moveEvent.preventDefault();
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      const nextRotation = Math.round(initialRotation + ((deltaX + deltaY) * 0.55));
      box.style.transform = `translate(-50%, -50%) rotate(${nextRotation}deg)`;
      box.style.transformOrigin = 'center center';

      setCaptions(prev => prev.map(c => {
        if (c.id !== captionId) return c;
        const wordStyles = c.wordStyles || {};
        const styleKey = `${c.id}-${wordIndex}`;
        const currentWordStyle = wordStyles[styleKey] || {};

        return {
          ...c,
          wordStyles: {
            ...wordStyles,
            [styleKey]: {
              ...currentWordStyle,
              rotation: nextRotation,
            }
          }
        };
      }));
    };

    const handleRotateEnd = () => {
      document.removeEventListener('mousemove', handleRotateMove);
      document.removeEventListener('mouseup', handleRotateEnd);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleRotateMove);
    document.addEventListener('mouseup', handleRotateEnd);
  };

  const handleSelectedDetachedWordDelete = useCallback(() => {
    if (!selectedDetachedWord || !setCaptions) return;
    if (addToHistory) addToHistory();

    const captionUpdater = setCaptionsRaw || setCaptions;
    captionUpdater(prev => prev.map(c => {
      if (c.id !== selectedDetachedWord.caption.id) return c;
      const wordStyles = c.wordStyles || {};
      const styleKey = `${c.id}-${selectedDetachedWord.wordIndex}`;
      const currentWordStyle = wordStyles[styleKey] || {};
      const nextWordStyle = { ...currentWordStyle };

      delete nextWordStyle.abs_x_pct;
      delete nextWordStyle.abs_y_pct;
      delete nextWordStyle.x;
      delete nextWordStyle.y;
      delete nextWordStyle.x_pct;
      delete nextWordStyle.y_pct;
      delete nextWordStyle.boxWidth;
      delete nextWordStyle.textScaleX;
      delete nextWordStyle.rotation;
      delete nextWordStyle.isLocked;

      return {
        ...c,
        wordStyles: {
          ...wordStyles,
          [styleKey]: nextWordStyle
        }
      };
    }));
  }, [addToHistory, selectedDetachedWord, setCaptions, setCaptionsRaw]);

  const handleCaptionDoubleClick = (e, caption) => {
    if (!setCaptions || !caption) return;
    e.stopPropagation();
    setIsEditing(caption.id);
    setEditText(caption.text || '');
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        // Place cursor at the end instead of selecting all
        const range = document.createRange();
        range.selectNodeContents(inputRef.current);
        range.collapse(false);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }, 0);
  };

  const handleEditComplete = (captionId) => {
    if (setCaptions && captionId) {
      setCaptions(prev => prev.map(cap =>
        cap.id === captionId ? { ...cap, text: editText } : cap
      ));
    }
    setIsEditing(false);
    setEditText('');
  };

  const handleEditKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsEditing(false);
      setEditText('');
    }
    // Allow all keys including backspace, Enter, etc.
  };

  const handleEditInput = (e) => {
    // Save cursor position before updating state
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(e.currentTarget);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    const caretOffset = preCaretRange.toString().length;

    const newText = (e.currentTarget.innerText || e.currentTarget.textContent || '').replace(/\u00a0/g, ' ');
    setEditText(newText);

    // Restore cursor position after state update
    requestAnimationFrame(() => {
      if (inputRef.current) {
        const newRange = document.createRange();
        const newSelection = window.getSelection();

        let node = inputRef.current.firstChild;

        if (node && node.nodeType === Node.TEXT_NODE) {
          const offset = Math.min(caretOffset, node.textContent.length);
          newRange.setStart(node, offset);
          newRange.setEnd(node, offset);
          newSelection.removeAllRanges();
          newSelection.addRange(newRange);
        }
      }
    });
  };

  // Handle individual word OR element word style updates
  const getPositionStyle = () => {
    const posY = captionStyle?.position_y ?? 75;
    const posX = captionStyle?.position_x ?? 50;
    const align = captionStyle?.text_align || 'center';

    // Anchor point shifts based on text alignment:
    // left   → left edge of caption at posX
    // center → center of caption at posX (default)
    // right  → right edge of caption at posX
    const transformX = align === 'left' ? '0%' : align === 'right' ? '-100%' : '-50%';
    return {
      top: `${posY}%`,
      left: `${posX}%`,
      transform: `translate(${transformX}, -50%)`
    };
  };

  const handleMouseDown = (e) => {
    if (!setCaptionStyle || e.target.classList.contains('resize-handle')) return;
    // Don't trigger caption drag if we are dragging a word
    if (draggingWord) return;

    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    if (addToHistory) addToHistory();
    setIsDragging(true);
    setDragStartY(e.clientY);
    setDragStartPos(captionStyle?.position_y !== undefined ? captionStyle.position_y : 50);
    setDragStartX(e.clientX);
    setDragStartXPos(captionStyle?.position_x !== undefined ? captionStyle.position_x : 50);
  };

  const handleTextElementMouseDown = (e, elementId, currentStyle) => {
    const isMoveBtn = e.target.closest('.text-element-move-btn');
    if (
      !setCaptions
      || (!isMoveBtn && (
        e.target.classList.contains('text-resize-handle')
        || e.target.closest('button')
        || e.target.closest('[data-word-key]')
        || e.target.closest('[contenteditable="true"]')
      ))
    ) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    if (addToHistory) addToHistory();
    setDraggedElementId(elementId);
    setElementDragStart({
      x: e.clientX,
      y: e.clientY,
      initialTop: currentStyle.top || 50,
      initialLeft: currentStyle.left || 50
    });
  };

  const handleTextElementResizeDown = (e, elementId, currentStyle) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    if (addToHistory) addToHistory();
    setResizedElementId(elementId);
    const measuredWidth = currentStyle.width || 300;
    setElementResizeStart({
      x: e.clientX,
      y: e.clientY,
      initialWidth: measuredWidth,
      initialFontSize: currentStyle.fontSize || 18,
      minWidth: currentStyle.minWidth || 40,
      direction: e.currentTarget?.dataset?.resizeEdge || 'right',
    });
  };

  const handleTextElementRotateStart = (e, elementId, currentStyle) => {
    if (!setCaptions) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    if (addToHistory) addToHistory();

    const elementBox = e.currentTarget.closest('[data-text-element-layer="true"]');
    const rect = elementBox?.getBoundingClientRect();
    if (!rect) return;

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
    const initialRotation = currentStyle.rotation || 0;

    const handleRotateMove = (moveEvent) => {
      moveEvent.preventDefault();
      const currentAngle = Math.atan2(moveEvent.clientY - centerY, moveEvent.clientX - centerX);
      const angleDiff = currentAngle - startAngle;
      let nextRotation = Math.round(initialRotation + (angleDiff * 180 / Math.PI));

      if (moveEvent.shiftKey) {
        nextRotation = Math.round(nextRotation / 15) * 15;
      }

      setCaptions(prev => prev.map(c => {
        if (c.id !== elementId) return c;
        return {
          ...c,
          customStyle: {
            ...c.customStyle,
            rotation: nextRotation
          }
        };
      }));
    };

    const handleRotateEnd = () => {
      document.removeEventListener('mousemove', handleRotateMove);
      document.removeEventListener('mouseup', handleRotateEnd);
      document.removeEventListener('pointermove', handleRotateMove);
      document.removeEventListener('pointerup', handleRotateEnd);
    };

    document.addEventListener('mousemove', handleRotateMove);
    document.addEventListener('mouseup', handleRotateEnd);
    document.addEventListener('pointermove', handleRotateMove, { passive: false });
    document.addEventListener('pointerup', handleRotateEnd);
  };

  // ✅ ZERO-LATENCY NATIVE DRAG HANDLER
  // We use direct DOM manipulation for smooth 60fps tracking, bypassing React's render cycle.
  // State is only updated on mouseUp.
  function handleWordMouseDown(e, caption, wordIndex, isElement = false, isDetached = false, dragSource = 'direct') {
    if (!setCaptions) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);

    // A word drag enters editing mode. Stop playback so the canvas stays stable
    // while the word is positioned and the committed CPT can be inspected.
    const editingRoot = videoContainerRef.current;
    if (editingRoot) {
      const captionWordPrefix = `${caption.id}-`;
      editingRoot.querySelectorAll('[data-word-key]').forEach((node) => {
        if (!String(node.getAttribute('data-word-key') || '').startsWith(captionWordPrefix)) return;
        node.style.setProperty('opacity', '1', 'important');
      });
    }
    if (isPlayingRef.current) {
      videoRef.current?.pause();
      setIsPlaying(false);
    }

    const customStyle = caption?.wordStyles?.[`${caption?.id}-${wordIndex}`] || {};
    const renderedOffset = getWordRenderOffset(customStyle);

    // Use the element that received the event directly
    const targetElement = e.currentTarget;
    if (!targetElement) return;
    const sourceTemplateVisualElement = dragSource === 'source-template'
      ? targetElement.querySelector('[data-source-word-visual="true"], .kf-base, .kf-fill')
      : null;
    const dragPreviewElement = isDetached
      ? targetElement
      : targetElement.querySelector('[data-word-drag-visual="true"]') || targetElement;
    const dragMovementElement = dragSource === 'source-template'
      ? targetElement
      : dragPreviewElement;
    const dragMeasurementElement = sourceTemplateVisualElement || dragPreviewElement;
    const isFixedWordEditorDrag = dragMovementElement.matches?.('[data-selected-word-box="true"]') === true;
    const initialInlineTranslate = dragMovementElement.style.getPropertyValue('translate');
    const initialInlineTranslatePriority = dragMovementElement.style.getPropertyPriority('translate');
    const restoreInlineTranslate = () => {
      if (initialInlineTranslate) {
        dragMovementElement.style.setProperty(
          'translate',
          initialInlineTranslate,
          initialInlineTranslatePriority
        );
      } else {
        dragMovementElement.style.removeProperty('translate');
      }
    };

    if (
      dragSource !== 'source-template'
      && captionStyle?.template_id
      && !isElement
      && !isDetached
    ) {
      const computedStyle = window.getComputedStyle(dragMeasurementElement);
      const styleKey = `${caption.id}-${wordIndex}`;
      const captionUpdater = setCaptionsRaw || setCaptions;
      captionUpdater(prev => prev.map(c => {
        if (c.id !== caption.id) return c;
        const wordStyles = c.wordStyles || {};
        const currentWordStyle = wordStyles[styleKey] || {};
        return {
          ...c,
          wordStyles: {
            ...wordStyles,
            [styleKey]: {
              ...currentWordStyle,
              fontFamily: currentWordStyle.fontFamily || computedStyle.fontFamily,
              fontWeight: currentWordStyle.fontWeight || computedStyle.fontWeight,
              fontStyle: currentWordStyle.fontStyle || computedStyle.fontStyle,
              textTransform: currentWordStyle.textTransform || computedStyle.textTransform,
              color: currentWordStyle.color || computedStyle.color,
              templateBlockClass: targetElement.dataset.templateBlockClass || currentWordStyle.templateBlockClass,
              templateBlockType: targetElement.dataset.templateBlockType || currentWordStyle.templateBlockType,
              templateWordClass: targetElement.dataset.templateWordClass || currentWordStyle.templateWordClass,
            }
          }
        };
      }));
    }

    // Immediately create the dragging state
    const dragState = {
      captionId: caption.id,
      wordIndex,
      startX: e.clientX,
      startY: e.clientY,
      initialX: renderedOffset.x || 0,
      initialY: renderedOffset.y || 0,
      isElement,
      isDetached,
      dragSource,
      targetElement
    };

    setDraggingWord(dragState);
    currentDragCoordinates.current = { x: dragState.initialX, y: dragState.initialY };
    let hasMoved = false;
    let hasRecordedHistory = false;

    const videoContainer = videoContainerRef.current || videoRef.current?.parentElement;
    const containerWidth = videoContainer?.offsetWidth || canvasSize.width || 1;
    const containerHeight = videoContainer?.offsetHeight || canvasSize.height || 1;
    const baselineWidth = fitCanvasSizeRef.current.width || containerWidth;
    const baselineHeight = fitCanvasSizeRef.current.height || containerHeight;
    const containerRectAtStart = videoContainer?.getBoundingClientRect();
    const viewportScaleX = containerRectAtStart?.width
      ? containerRectAtStart.width / containerWidth
      : 1;
    const viewportScaleY = containerRectAtStart?.height
      ? containerRectAtStart.height / containerHeight
      : viewportScaleX;
    const wordRectAtStart = dragMeasurementElement.getBoundingClientRect();
    const startCenterXPct = containerRectAtStart?.width
      ? ((wordRectAtStart.left + wordRectAtStart.width / 2 - containerRectAtStart.left) / containerRectAtStart.width) * 100
      : 50;
    const startCenterYPct = containerRectAtStart?.height
      ? ((wordRectAtStart.top + wordRectAtStart.height / 2 - containerRectAtStart.top) / containerRectAtStart.height) * 100
      : 50;
    const snapTargetsX = [6, 50, 94];
    const snapTargetsY = [6, 50, 94];
    const getWordSnap = (value, targets, axisSize) => {
      const snapThresholdPct = (5 / Math.max(axisSize, 1)) * 100;
      const match = targets.find(target => Math.abs(value - target) <= snapThresholdPct);
      return typeof match === 'number' ? match : null;
    };
    const getLocalCptGuides = (deltaX, deltaY) => {
      if (!videoContainer || !containerRectAtStart || dragState.isElement) {
        return { deltaX, deltaY, guides: [] };
      }

      const styleKey = `${caption.id}-${wordIndex}`;
      const siblingRects = Array.from(videoContainer.querySelectorAll('[data-word-key]'))
        .filter(node => {
          if (!(node instanceof Element)) return false;
          if (node === targetElement || node === dragPreviewElement) return false;
          const key = node.getAttribute('data-word-key') || '';
          if (key === styleKey || !key.startsWith(`${caption.id}-`)) return false;
          const nodeStyle = window.getComputedStyle(node);
          if (nodeStyle.visibility === 'hidden' || nodeStyle.display === 'none' || nodeStyle.opacity === '0') return false;
          const visualNode = node.querySelector(
            '[data-source-word-visual="true"], [data-word-drag-visual="true"], .kf-base, .kf-fill'
          ) || node;
          const rect = visualNode.getBoundingClientRect();
          return rect.width > 2 && rect.height > 2;
        })
        .map(node => {
          const visualNode = node.querySelector(
            '[data-source-word-visual="true"], [data-word-drag-visual="true"], .kf-base, .kf-fill'
          ) || node;
          return visualNode.getBoundingClientRect();
        });
      const resolved = resolveCptWordSnap({
        draggedRect: wordRectAtStart,
        siblingRects,
        deltaX,
        deltaY,
        alignThreshold: 5,
        magneticThreshold: 10,
        minGap: Math.max(4, Math.min(9, wordRectAtStart.height * 0.18)),
      });
      const guides = resolved.guides.map((guide) => {
        if (guide.type === 'vertical') {
          return {
            ...guide,
            x: (guide.x - containerRectAtStart.left) / viewportScaleX,
            y1: Math.max(0, (guide.y1 - containerRectAtStart.top) / viewportScaleY),
            y2: Math.min(containerHeight, (guide.y2 - containerRectAtStart.top) / viewportScaleY),
          };
        }
        if (guide.type === 'horizontal' || guide.type === 'spacing-horizontal') {
          return {
            ...guide,
            y: (guide.y - containerRectAtStart.top) / viewportScaleY,
            x1: Math.max(0, (guide.x1 - containerRectAtStart.left) / viewportScaleX),
            x2: Math.min(containerWidth, (guide.x2 - containerRectAtStart.left) / viewportScaleX),
          };
        }
        return {
          ...guide,
          x: (guide.x - containerRectAtStart.left) / viewportScaleX,
          y1: Math.max(0, (guide.y1 - containerRectAtStart.top) / viewportScaleY),
          y2: Math.min(containerHeight, (guide.y2 - containerRectAtStart.top) / viewportScaleY),
        };
      });

      return { deltaX: resolved.deltaX, deltaY: resolved.deltaY, guides };
    };

    const handleNativeMouseMove = (moveEvent) => {
      moveEvent.preventDefault();
      const deltaX = moveEvent.clientX - dragState.startX;
      const deltaY = moveEvent.clientY - dragState.startY;

      if (!hasMoved && Math.abs(deltaX) <= 3 && Math.abs(deltaY) <= 3) {
        return;
      }

      if (!hasMoved) {
        hasMoved = true;
        if (!hasRecordedHistory && addToHistory) {
          addToHistory();
          hasRecordedHistory = true;
        }
      }

      // A word must end exactly where the pointer releases it. The former
      // magnetic/collision snap adjusted the saved delta by a few pixels and
      // could move neighbouring sentence words visually as well. Keep guides
      // for caption tools, but word drags have no implicit correction.
      const adjustedClientDeltaX = deltaX;
      const adjustedClientDeltaY = deltaY;
      const adjustedDeltaX = adjustedClientDeltaX / (isFixedWordEditorDrag ? 1 : viewportScaleX);
      const adjustedDeltaY = adjustedClientDeltaY / (isFixedWordEditorDrag ? 1 : viewportScaleY);
      const newX = dragState.initialX + adjustedDeltaX;
      const newY = dragState.initialY + adjustedDeltaY;

      currentDragCoordinates.current = {
        x: newX,
        y: newY,
        deltaX: adjustedDeltaX,
        deltaY: adjustedDeltaY,
        clientDeltaX: adjustedClientDeltaX,
        clientDeltaY: adjustedClientDeltaY,
      };
      setSnapGuides({ hLines: [], vLines: [] });
      setCptWordGuides([]);

      // Directly manipulate the DOM for zero-latency dragging
      if (dragState.dragSource === 'source-template') {
        // Source-template visuals already contain their saved x/y translation.
        // Move the stable outer anchor by only this gesture's delta so an
        // existing offset is never applied twice during a second drag.
        dragMovementElement.style.setProperty(
          'translate',
          `${adjustedDeltaX}px ${adjustedDeltaY}px`,
          'important'
        );
      } else if (dragState.isElement) {
        dragPreviewElement.style.setProperty(
          'transform',
          `translate(${newX}px, ${newY}px)`,
          'important'
        );
      } else {
        // The word may come from an inline template, an absolutely centered
        // caption, or the fixed selected-word portal. CSS `translate` composes
        // with all of those authored transforms without replacing their anchor.
        dragMovementElement.style.setProperty(
          'translate',
          `${adjustedDeltaX}px ${adjustedDeltaY}px`,
          'important'
        );
      }
    };

    const handleNativeMouseUp = (upEvent) => {
      document.removeEventListener('mousemove', handleNativeMouseMove);
      document.removeEventListener('mouseup', handleNativeMouseUp);
      document.removeEventListener('pointermove', handleNativeMouseMove);
      document.removeEventListener('pointerup', handleNativeMouseUp);
      document.removeEventListener('pointercancel', handleNativeMouseUp);

      // Now perform the final React state update to save the new coordinates
      if (hasMoved) {
        const previousCoords = currentDragCoordinates.current;
        const releaseClientDeltaX = Number.isFinite(upEvent?.clientX)
          ? upEvent.clientX - dragState.startX
          : (Number(previousCoords?.clientDeltaX) || 0);
        const releaseClientDeltaY = Number.isFinite(upEvent?.clientY)
          ? upEvent.clientY - dragState.startY
          : (Number(previousCoords?.clientDeltaY) || 0);
        // Commit the actual release point. A pointer-up can arrive a few
        // pixels beyond the browser's last pointer-move, which previously made
        // the word jump slightly after it was dropped.
        const finalCoords = {
          x: dragState.initialX + releaseClientDeltaX / (isFixedWordEditorDrag ? 1 : viewportScaleX),
          y: dragState.initialY + releaseClientDeltaY / (isFixedWordEditorDrag ? 1 : viewportScaleY),
          deltaX: releaseClientDeltaX / (isFixedWordEditorDrag ? 1 : viewportScaleX),
          deltaY: releaseClientDeltaY / (isFixedWordEditorDrag ? 1 : viewportScaleY),
          clientDeltaX: releaseClientDeltaX,
          clientDeltaY: releaseClientDeltaY,
        };
        if (finalCoords) {
          const parentFontSize = isElement
            ? (caption.customStyle?.fontSize || 18)
            : (captionStyle?.font_size || 18);

          const containerRect = videoContainer?.getBoundingClientRect();
          // Derive the committed position from the same start rectangle and
          // snapped delta used by the live preview. Reading the mutated DOM here
          // is unreliable for template words whose animation/transform can
          // change between pointermove and pointerup.
          const finalDeltaX = Number(finalCoords.clientDeltaX) || 0;
          const finalDeltaY = Number(finalCoords.clientDeltaY) || 0;
          const absXPct = containerRect?.width
            ? ((wordRectAtStart.left + wordRectAtStart.width / 2 + finalDeltaX - containerRect.left) / containerRect.width) * 100
            : undefined;
          const absYPct = containerRect?.height
            ? ((wordRectAtStart.top + wordRectAtStart.height / 2 + finalDeltaY - containerRect.top) / containerRect.height) * 100
            : undefined;
          const detachedPositionDeltaPct = (
            typeof absXPct === 'number'
            && typeof absYPct === 'number'
          )
            ? Math.max(
                Math.abs(absXPct - startCenterXPct),
                Math.abs(absYPct - startCenterYPct)
              )
            : 0;
          const shouldDetachWord = (
            dragState.dragSource !== 'source-template'
            && !dragState.isElement
            && detachedPositionDeltaPct > 0.75
          );

          const captionUpdater = setCaptionsRaw || setCaptions;
          captionUpdater(prev => prev.map(c => {
            if (c.id !== dragState.captionId) return c;
            const wordStyles = c.wordStyles || {};
            const styleKey = `${c.id}-${dragState.wordIndex}`;
            const currentWordStyle = wordStyles[styleKey] || {};
            const nextWordStyle = dragState.dragSource === 'source-template'
              ? {
                  ...currentWordStyle,
                  x: (finalCoords.x / containerWidth) * baselineWidth,
                  y: (finalCoords.y / containerHeight) * baselineHeight,
                  x_pct: (finalCoords.x / containerWidth) * 100,
                  y_pct: (finalCoords.y / containerHeight) * 100,
                  frozenFontSize: currentWordStyle.frozenFontSize || parentFontSize
                }
              : dragState.isElement
              ? {
                  ...currentWordStyle,
                  x: (finalCoords.x / containerWidth) * baselineWidth,
                  y: (finalCoords.y / containerHeight) * baselineHeight,
                  x_pct: (finalCoords.x / containerWidth) * 100,
                  y_pct: (finalCoords.y / containerHeight) * 100,
                  frozenFontSize: currentWordStyle.frozenFontSize || parentFontSize
                }
              : shouldDetachWord ? {
                  ...currentWordStyle,
                  x: 0,
                  y: 0,
                  x_pct: 0,
                  y_pct: 0,
                  abs_x_pct: typeof absXPct === 'number' ? absXPct : currentWordStyle.abs_x_pct,
                  abs_y_pct: typeof absYPct === 'number' ? absYPct : currentWordStyle.abs_y_pct,
                  frozenFontSize: currentWordStyle.frozenFontSize || parentFontSize
                } : {
                  ...currentWordStyle,
                  x: 0,
                  y: 0,
                  x_pct: 0,
                  y_pct: 0,
                  frozenFontSize: currentWordStyle.frozenFontSize || parentFontSize
                };
            if (
              !dragState.isElement
              && typeof absXPct === 'number'
              && typeof absYPct === 'number'
            ) {
              // Keep a canvas-space drop point even for source-template words,
              // which continue to use x/y offsets in the preview. ExportPanel
              // converts this snapshot to video space so the burned result is
              // WYSIWYG even when the source template reflows or scales.
              nextWordStyle.cptCanvasXPercent = absXPct;
              nextWordStyle.cptCanvasYPercent = absYPct;
            }
            if (!dragState.isElement && !shouldDetachWord) {
              delete nextWordStyle.abs_x_pct;
              delete nextWordStyle.abs_y_pct;
            }

            return {
              ...c,
              wordStyles: {
                ...wordStyles,
                [styleKey]: nextWordStyle
              }
            };
          }));

          requestAnimationFrame(() => {
            if (dragState.dragSource === 'source-template') {
              restoreInlineTranslate();
            } else if (dragState.isElement) {
              dragPreviewElement.style.setProperty(
                'transform',
                `translate(${finalCoords.x}px, ${finalCoords.y}px)`
              );
            } else {
              restoreInlineTranslate();
            }
          });
        }

        lastDragDropTime.current = Date.now();
      }

      setDraggingWord(null);
      currentDragCoordinates.current = null;
      setSnapGuides({ hLines: [], vLines: [] });
      setCptWordGuides([]);
    };

    document.addEventListener('mousemove', handleNativeMouseMove);
    document.addEventListener('mouseup', handleNativeMouseUp);
    document.addEventListener('pointermove', handleNativeMouseMove, { passive: false });
    document.addEventListener('pointerup', handleNativeMouseUp);
    document.addEventListener('pointercancel', handleNativeMouseUp);
  }

  const handleResizeMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    if (addToHistory) addToHistory();
    const measuredWidth = captionStyle?.boxWidth || 300;
    setIsResizing(true);
    setResizeStartX(e.clientX);
    setResizeStartY(e.clientY);
    setResizeStartWidth(measuredWidth);
    setResizeStartFontSize(captionStyle?.font_size || 18);
    setResizeDirection(e.currentTarget?.dataset?.resizeEdge || 'right');
  };

  // Global Mouse Move / Up for all dragging operations
  useEffect(() => {
    if ((!isDragging && !draggedElementId && !resizedElementId) || (!setCaptionStyle && !setCaptions)) return;

    const SNAP_THRESHOLD_PCT = 2.5; // % within which to snap
    const getSnapGuides = (axis, value, excludeId) => {
      // Static snap targets
      const targets = axis === 'y'
        ? [5, 50, 75, 95]
        : [5, 50, 95];
      // Add other elements
      if (captions) {
        captions.forEach(c => {
          if (c.isTextElement && c.id !== excludeId && c.customStyle) {
            if (axis === 'x' && c.customStyle.left != null) targets.push(c.customStyle.left);
            if (axis === 'y' && c.customStyle.top != null) targets.push(c.customStyle.top);
          }
        });
      }
      for (const t of targets) {
        if (Math.abs(value - t) <= SNAP_THRESHOLD_PCT) {
          return { snapped: true, value: t };
        }
      }
      return { snapped: false, value };
    };

    const handleMouseMove = (e) => {
      // 1. Handle Caption Full Drag (X and Y)
      if (isDragging) {
        const videoContainer = captionRef.current?.parentElement;
        if (!videoContainer) return;

        const containerHeight = videoContainer.offsetHeight;
        const containerWidth = videoContainer.offsetWidth;

        const deltaY = e.clientY - dragStartY;
        const deltaPercentY = (deltaY / containerHeight) * 100;
        let newPosY = dragStartPos + deltaPercentY;
        newPosY = Math.max(5, Math.min(95, newPosY));

        const deltaX = e.clientX - dragStartX;
        const deltaPercentX = (deltaX / containerWidth) * 100;
        let newPosX = dragStartXPos + deltaPercentX;
        newPosX = Math.max(5, Math.min(95, newPosX));

        // Snap check for Y and X axis
        const ySnap = getSnapGuides('y', newPosY, null);
        const xSnap = getSnapGuides('x', newPosX, null);

        let hLines = [];
        let vLines = [];

        if (ySnap.snapped) {
          newPosY = ySnap.value;
          hLines.push(newPosY);
        }
        if (xSnap.snapped) {
          newPosX = xSnap.value;
          vLines.push(newPosX);
        }

        setSnapGuides({ hLines, vLines });

        const styleUpdater = setCaptionStyleRaw || setCaptionStyle;
        styleUpdater(prev => ({ 
          ...prev, 
          position_y: Math.round(newPosY),
          position_x: Math.round(newPosX)
        }));
      }

      // 3. Handle Text Element Drag
      if (draggedElementId && setCaptions) {
        const videoContainer = videoRef.current?.parentElement;
        if (!videoContainer) return;

        const containerWidth = videoContainer.offsetWidth;
        const containerHeight = videoContainer.offsetHeight;
        const deltaX = e.clientX - elementDragStart.x;
        const deltaY = e.clientY - elementDragStart.y;
        const deltaPercentX = (deltaX / containerWidth) * 100;
        const deltaPercentY = (deltaY / containerHeight) * 100;

        let newLeft = elementDragStart.initialLeft + deltaPercentX;
        let newTop = elementDragStart.initialTop + deltaPercentY;
        newLeft = Math.max(5, Math.min(95, newLeft));
        newTop = Math.max(5, Math.min(95, newTop));

        // Snap checks for X and Y
        const xSnap = getSnapGuides('x', newLeft, draggedElementId);
        const ySnap = getSnapGuides('y', newTop, draggedElementId);
        if (xSnap.snapped) newLeft = xSnap.value;
        if (ySnap.snapped) newTop = ySnap.value;
        setSnapGuides({
          hLines: ySnap.snapped ? [newTop] : [],
          vLines: xSnap.snapped ? [newLeft] : []
        });

        const captionUpdater = setCaptionsRaw || setCaptions;
        captionUpdater(prev => prev.map(c => {
          if (c.id !== draggedElementId) return c;
          return {
            ...c,
            customStyle: {
              ...c.customStyle,
              left: newLeft,
              top: newTop
            }
          };
        }));
      }

      // 4. Handle Text Element Resize
      if (resizedElementId && setCaptions) {
        const deltaX = e.clientX - elementResizeStart.x;
        const deltaY = e.clientY - elementResizeStart.y;
        const resizeDelta = (() => {
          switch (elementResizeStart.direction) {
            case 'left':
              return -deltaX;
            case 'top':
              return -deltaY;
            case 'bottom':
              return deltaY;
            case 'top-left':
              return Math.abs(deltaX) >= Math.abs(deltaY) ? -deltaX : -deltaY;
            case 'top-right':
              return Math.abs(deltaX) >= Math.abs(deltaY) ? deltaX : -deltaY;
            case 'bottom-left':
              return Math.abs(deltaX) >= Math.abs(deltaY) ? -deltaX : deltaY;
            case 'bottom-right':
            case 'corner':
              return Math.abs(deltaX) >= Math.abs(deltaY) ? deltaX : deltaY;
            case 'right':
            default:
              return deltaX;
          }
        })();

        const isHorizontalFrameResize = ['left', 'right'].includes(elementResizeStart.direction);
        const minFrameWidth = isHorizontalFrameResize ? 28 : Math.min(elementResizeStart.minWidth || 150, 80);
        const unscaledDelta = resizeDelta / Math.max(previewRenderScale, 0.001);
        let newWidth = elementResizeStart.initialWidth + (isHorizontalFrameResize ? unscaledDelta * 2 : unscaledDelta);
        newWidth = Math.max(minFrameWidth, Math.min(600, newWidth));

        const widthRatio = newWidth / Math.max(elementResizeStart.initialWidth, 1);
        let newFontSize = elementResizeStart.initialFontSize * widthRatio;
        newFontSize = Math.max(12, Math.min(60, newFontSize));

        const captionUpdater = setCaptionsRaw || setCaptions;
        captionUpdater(prev => prev.map(c => {
          if (c.id !== resizedElementId) return c;
          return {
            ...c,
            customStyle: {
              ...c.customStyle,
              width: newWidth,
              ...(isHorizontalFrameResize ? {} : { fontSize: newFontSize })
            }
          };
        }));
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setDraggedElementId(null);
      setResizedElementId(null);
      setSnapGuides({ hLines: [], vLines: [] }); // clear guides
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('pointermove', handleMouseMove, { passive: false });
    document.addEventListener('pointerup', handleMouseUp);
    document.addEventListener('pointercancel', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('pointermove', handleMouseMove);
      document.removeEventListener('pointerup', handleMouseUp);
      document.removeEventListener('pointercancel', handleMouseUp);
    };
  }, [isDragging, dragStartY, dragStartPos, setCaptionStyle, setCaptions, draggedElementId, resizedElementId, elementDragStart, elementResizeStart, previewRenderScale]);

  useEffect(() => {
    if (!isResizing || !setCaptionStyle) return;

    const handleMouseMove = (e) => {
      const deltaX = e.clientX - resizeStartX;
      const deltaY = e.clientY - resizeStartY;
      const resizeDelta = (() => {
        switch (resizeDirection) {
          case 'left':
            return -deltaX;
          case 'top':
            return -deltaY;
          case 'bottom':
            return deltaY;
          case 'top-left':
            return Math.abs(deltaX) >= Math.abs(deltaY) ? -deltaX : -deltaY;
          case 'top-right':
            return Math.abs(deltaX) >= Math.abs(deltaY) ? deltaX : -deltaY;
          case 'bottom-left':
            return Math.abs(deltaX) >= Math.abs(deltaY) ? -deltaX : deltaY;
          case 'bottom-right':
          case 'corner':
            return Math.abs(deltaX) >= Math.abs(deltaY) ? deltaX : deltaY;
          case 'right':
          default:
            return deltaX;
        }
      })();

      const isHorizontalFrameResize = ['left', 'right'].includes(resizeDirection);
      const minFrameWidth = isHorizontalFrameResize ? 180 : 80;
      const unscaledDelta = resizeDelta / Math.max(previewRenderScale, 0.001);
      let newWidth = resizeStartWidth + (isHorizontalFrameResize ? unscaledDelta * 2 : unscaledDelta);
      newWidth = Math.max(minFrameWidth, Math.min(600, newWidth));

      // Calculate proportional font size change
      const safeStartWidth = Math.max(resizeStartWidth, 1);
      const widthRatio = newWidth / safeStartWidth;
      let newFontSize = resizeStartFontSize * widthRatio;
      newFontSize = Math.max(12, Math.min(60, newFontSize));

      const styleUpdater = setCaptionStyleRaw || setCaptionStyle;
      styleUpdater(prev => ({
        ...prev,
        boxWidth: newWidth,
        ...(isHorizontalFrameResize ? {} : { font_size: newFontSize })
      }));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('pointermove', handleMouseMove, { passive: false });
    document.addEventListener('pointerup', handleMouseUp);
    document.addEventListener('pointercancel', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('pointermove', handleMouseMove);
      document.removeEventListener('pointerup', handleMouseUp);
      document.removeEventListener('pointercancel', handleMouseUp);
    };
  }, [isResizing, resizeDirection, resizeStartFontSize, resizeStartWidth, resizeStartX, resizeStartY, setCaptionStyle, previewRenderScale]);

  const selectedDetachedWordViewport = (() => {
    if (!selectedDetachedWord || typeof window === 'undefined') return null;
    const videoFrame = videoContainerRef.current;
    const rect = videoFrame?.getBoundingClientRect();
    if (!rect) return null;
    const scaleX = rect.width && videoFrame.offsetWidth ? rect.width / videoFrame.offsetWidth : 1;
    const scaleY = rect.height && videoFrame.offsetHeight ? rect.height / videoFrame.offsetHeight : scaleX;

    return {
      x: rect.left + (rect.width * (selectedDetachedWord.x ?? 50)) / 100 + ((selectedDetachedWord.renderOffset?.x || 0) * scaleX),
      y: rect.top + (rect.height * (selectedDetachedWord.y ?? 50)) / 100 + ((selectedDetachedWord.renderOffset?.y || 0) * scaleY),
      scale: scaleX,
      scaleY,
    };
  })();

  const selectedDetachedWordEditor = selectedDetachedWord && selectedDetachedWordViewport && typeof document !== 'undefined'
    ? (() => {
      const isAdjustingSelectedWord = Boolean(
        resizingWord
        || (
          draggingWord
          && draggingWord.captionId === selectedDetachedWord.caption.id
          && draggingWord.wordIndex === selectedDetachedWord.wordIndex
        )
      );
      const isDraggingSelectedWord = Boolean(
        draggingWord
        && draggingWord.captionId === selectedDetachedWord.caption.id
        && draggingWord.wordIndex === selectedDetachedWord.wordIndex
      );
      const selectedWordStyle = selectedDetachedWord.wordStyle || {};
      const selectedWordBoxWidth = selectedDetachedWord.boxWidth || null;
      const selectedWordFontSize = selectedDetachedWord.fontSize * previewRenderScale * selectedDetachedWordViewport.scale;
      const selectedEmphasisAccent = captionStyle?.secondary_color || '#DDAA03';
      const cptGuideFrameRect = videoContainerRef.current?.getBoundingClientRect();
      const selectedCenterXPct = cptGuideFrameRect?.width
        ? Math.max(0, Math.min(100, ((selectedDetachedWordViewport.x - cptGuideFrameRect.left) / cptGuideFrameRect.width) * 100))
        : 50;
      const selectedCenterYPct = cptGuideFrameRect?.height
        ? Math.max(0, Math.min(100, ((selectedDetachedWordViewport.y - cptGuideFrameRect.top) / cptGuideFrameRect.height) * 100))
        : 50;
      const shouldShowCptGuides = Boolean(cptGuideFrameRect && (isAdjustingSelectedWord || showLayoutGuides || activeCanvasTool === 'guides'));
      const shouldShowSelectedCrosshair = !(isDraggingSelectedWord || resizingWord);
      const selectedCaptionWordCount = String(selectedDetachedWord.caption.text || '')
        .split(/\s+/)
        .filter(Boolean)
        .length;
      const selectedCaptionCurrentIndex = getCaptionCurrentWordIndex(
        selectedDetachedWord.caption,
        selectedCaptionWordCount,
      );
      const selectedWordIsPending = isCptWordPending(
        selectedDetachedWord.caption,
        selectedDetachedWord.wordIndex,
        selectedCaptionCurrentIndex,
      );
      const selectedEmphasisStyle = selectedWordStyle.isEmphasis ? {
        fontWeight: 'bold',
        color: selectedWordStyle.color || selectedEmphasisAccent,
        fontSize: `${Math.round(selectedWordFontSize * 1.2)}px`,
        textShadow: `0 0 18px ${selectedEmphasisAccent}99, 0 0 6px ${selectedEmphasisAccent}66`,
      } : {};
      const selectedWordAnimation = selectedWordStyle.animation && selectedWordStyle.animation !== 'none'
        ? getAnimationStyle(selectedWordStyle.animation, selectedWordStyle.animationSpeed || 1)
        : 'none';

      return createPortal(
      <>
      {shouldShowCptGuides && createPortal(
        <div
          data-cpt-text-guides="true"
          className="pointer-events-none fixed"
          style={{
            left: `${cptGuideFrameRect.left}px`,
            top: `${cptGuideFrameRect.top}px`,
            width: `${cptGuideFrameRect.width}px`,
            height: `${cptGuideFrameRect.height}px`,
            zIndex: 100004,
          }}
        >
          <div className="absolute inset-[6%] rounded-sm border border-[#dce85f]/45" />
          <div className="absolute top-0 bottom-0 w-px bg-[#dce85f]/55" style={{ left: '50%' }} />
          <div className="absolute left-0 right-0 h-px bg-[#dce85f]/35" style={{ top: '50%' }} />
          <div className="absolute top-0 bottom-0 border-l border-dashed border-white/45" style={{ left: '6%' }} />
          <div className="absolute top-0 bottom-0 border-l border-dashed border-white/45" style={{ left: '94%' }} />
          {shouldShowSelectedCrosshair && (
            <>
              <div className="absolute w-20 -translate-x-1/2 border-t border-dashed border-[#ff2f9f] shadow-[0_0_6px_rgba(255,47,159,0.45)]" style={{ left: `${selectedCenterXPct}%`, top: `${selectedCenterYPct}%` }} />
              <div className="absolute h-20 -translate-y-1/2 border-l border-dashed border-[#ff2f9f] shadow-[0_0_6px_rgba(255,47,159,0.45)]" style={{ left: `${selectedCenterXPct}%`, top: `${selectedCenterYPct}%` }} />
            </>
          )}
        </div>,
        document.body
      )}
      <span
        data-selected-word-box="true"
        data-word-key={`${selectedDetachedWord.caption.id}-${selectedDetachedWord.wordIndex}`}
        className="group fixed rounded-[1px] border border-[#9f83ff] bg-transparent px-[2px] shadow-[0_0_0_1px_rgba(255,255,255,0.16)]"
        style={{
          left: `${selectedDetachedWordViewport.x}px`,
          top: `${selectedDetachedWordViewport.y}px`,
          zIndex: 100005,
          transform: `translate(-50%, -50%)${selectedDetachedWord.rotation ? ` rotate(${selectedDetachedWord.rotation}deg)` : ''}`,
          transformOrigin: 'center center',
          fontFamily: selectedWordStyle.fontFamily || captionStyle?.font_family || 'Inter',
          fontSize: `${selectedWordFontSize}px`,
          fontWeight: selectedWordStyle.fontWeight || captionStyle?.font_weight || 'inherit',
          fontStyle: selectedWordStyle.fontStyle || captionStyle?.font_style || 'inherit',
          textDecoration: 'none',
          textTransform: selectedWordStyle.textTransform || undefined,
          lineHeight: 1.1,
          color: selectedWordStyle.color || captionStyle?.text_color || '#ffffff',
          whiteSpace: selectedWordBoxWidth ? 'normal' : 'nowrap',
          overflowWrap: selectedWordBoxWidth ? 'anywhere' : 'normal',
          wordBreak: selectedWordBoxWidth ? 'break-all' : 'normal',
          overflow: 'visible',
          textAlign: 'center',
          display: 'block',
          boxSizing: 'border-box',
          width: selectedWordBoxWidth
            ? `${selectedWordBoxWidth * previewRenderScale * selectedDetachedWordViewport.scale}px`
            : 'auto',
          ...(!selectedWordIsPending && (selectedWordStyle.backgroundColor || selectedWordStyle.highlightGradient) ? {
            background: selectedWordStyle.highlightGradient || `rgba(${parseInt(selectedWordStyle.backgroundColor.slice(1,3),16)}, ${parseInt(selectedWordStyle.backgroundColor.slice(3,5),16)}, ${parseInt(selectedWordStyle.backgroundColor.slice(5,7),16)}, ${selectedWordStyle.backgroundOpacity ?? 0.6})`,
            borderRadius: '3px',
            padding: `${(selectedWordStyle.backgroundPadding || 2) * previewRenderScale * selectedDetachedWordViewport.scale}px ${4 * previewRenderScale * selectedDetachedWordViewport.scale}px`,
          } : {}),
          ...selectedEmphasisStyle,
          cursor: resizingWord ? 'nwse-resize' : (isDraggingSelectedWord ? 'grabbing' : 'default'),
          userSelect: 'none',
          pointerEvents: 'auto',
        }}
        onPointerDown={(e) => {
          if (e.target.closest('.word-resize-handle')) return;
          handleCaptionWordPointerIntent(
            e,
            selectedDetachedWord.caption,
            selectedDetachedWord.wordIndex,
            selectedDetachedWord.word,
            { isDetached: true },
          );
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        data-video-control
      >
        <button
          type="button"
          className="absolute -right-4 -top-4 z-[96] flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-[#141418] text-white/80 shadow-[0_8px_20px_-12px_rgba(0,0,0,0.95)] transition-colors hover:border-red-400/60 hover:bg-red-500/12 hover:text-red-300"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleSelectedDetachedWordDelete();
          }}
          title="Delete word"
          data-video-control
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.9} />
        </button>
        <span
          data-selected-word-text="true"
          style={{
            display: 'inline-block',
            width: selectedWordBoxWidth ? '100%' : 'auto',
            minWidth: 0,
            whiteSpace: selectedWordBoxWidth ? 'normal' : 'nowrap',
            overflowWrap: selectedWordBoxWidth ? 'anywhere' : 'normal',
            wordBreak: selectedWordBoxWidth ? 'break-all' : 'normal',
            textAlign: 'center',
            opacity: selectedWordIsPending ? 0 : 1,
            animation: selectedWordAnimation,
            transformOrigin: 'center center',
          }}
        >
          {renderWordTextContent(selectedDetachedWord.word, selectedWordStyle, captionStyle?.text_color || '#ffffff')}
        </span>
        {[
          { classes: '-top-4 -left-4 cursor-nwse-resize', axis: 'corner', sideX: 'left', sideY: 'top' },
          { classes: '-top-4 -right-4 cursor-nesw-resize', axis: 'corner', sideX: 'right', sideY: 'top' },
          { classes: '-bottom-4 -left-4 cursor-nesw-resize', axis: 'corner', sideX: 'left', sideY: 'bottom' },
          { classes: '-bottom-4 -right-4 cursor-nwse-resize', axis: 'corner', sideX: 'right', sideY: 'bottom' },
          { classes: 'top-1/2 -left-4 -translate-y-1/2 cursor-ew-resize', axis: 'horizontal', sideX: 'left' },
          { classes: 'top-1/2 -right-4 -translate-y-1/2 cursor-ew-resize', axis: 'horizontal', sideX: 'right' },
        ].map((handle) => (
          <span
            key={handle.classes}
            onPointerDown={handleDetachedWordResizeStart}
            onDragStart={(e) => e.preventDefault()}
            className={`word-resize-handle absolute z-[95] flex h-8 w-8 items-center justify-center rounded-full bg-transparent ${handle.classes}`}
            title="Resize word"
            data-resize-axis={handle.axis}
            data-resize-side={handle.sideX}
            data-resize-vertical-side={handle.sideY}
            data-video-control
          >
            <span className="block h-2 w-2 rounded-full border border-[#a78bfa] bg-white shadow-[0_2px_6px_rgba(0,0,0,0.18)]" />
          </span>
        ))}
        {!isAdjustingSelectedWord && (
          <span
            className="absolute left-1/2 top-full z-[95] mt-[14px] flex -translate-x-1/2 items-center gap-2"
            data-selected-word-actions="true"
          >
            <span
              className="flex h-6 w-6 items-center justify-center rounded-full border border-[#d8d2e8] bg-white text-[#4f4f5a] shadow-[0_2px_5px_rgba(15,15,20,0.16)] transition-transform hover:scale-105"
              style={{ cursor: 'grab' }}
              onPointerDown={handleDetachedWordRotateStart}
              title="Rotate word"
              data-video-control
            >
              <RotateCw className="h-3 w-3" strokeWidth={1.9} />
            </span>
            <span
              className="flex h-6 w-6 items-center justify-center rounded-full border border-[#d8d2e8] bg-white text-[#4f4f5a] shadow-[0_2px_5px_rgba(15,15,20,0.16)] transition-transform hover:scale-105"
              style={{ cursor: 'move' }}
              onPointerDown={(e) => {
                const selectionBox = e.currentTarget.closest('[data-selected-word-box="true"]');
                if (!selectionBox) return;
                handleWordMouseDown({
                  preventDefault: () => e.preventDefault(),
                  stopPropagation: () => e.stopPropagation(),
                  clientX: e.clientX,
                  clientY: e.clientY,
                  currentTarget: selectionBox,
                }, selectedDetachedWord.caption, selectedDetachedWord.wordIndex, false, true, 'action-move');
              }}
              title="Move word"
              data-video-control
            >
              <Move className="h-3 w-3" strokeWidth={1.9} />
            </span>
          </span>
        )}
      </span>,
      </>,
      document.body
    );
    })()
    : null;

  const handleCanvasWordClickCapture = (event) => {
    if (!setWordPopup || Date.now() - lastDragDropTime.current < 200) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('.word-resize-handle, [data-selected-word-actions="true"], button, input, textarea, select')) return;

    const wordNode = target.closest('[data-word-key]');
    const wordKey = wordNode?.getAttribute('data-word-key') || '';
    if (!wordNode || !wordKey || !videoContainerRef.current?.contains(wordNode)) return;

    const liveTarget = [...(captions || [])]
      .filter(item => item?.id && wordKey.startsWith(`${item.id}-`))
      .sort((a, b) => String(b.id).length - String(a.id).length)[0];
    if (!liveTarget) return;

    const wordIndex = Number(wordKey.slice(String(liveTarget.id).length + 1));
    if (!Number.isInteger(wordIndex) || wordIndex < 0) return;

    const word = String(liveTarget.text || '').split(/\s+/).filter(Boolean)[wordIndex];
    if (!word) return;

    // Own all word clicks at the canvas boundary. Some applied templates
    // rebuild their internal DOM after a style edit, which can discard a
    // word-level listener; the stable canvas listener remains available.
    event.preventDefault();
    event.stopPropagation();
    if (setSelectedCaptionId) setSelectedCaptionId(liveTarget.id);
    setWordPopup(liveTarget.isTextElement
      ? {
          type: 'element',
          elementId: liveTarget.id,
          wordIndex,
          word,
          position: { x: event.clientX, y: event.clientY },
        }
      : {
          caption: liveTarget,
          wordIndex,
          word,
          position: { x: event.clientX, y: event.clientY },
        });
  };

  return (
    <>
    <OriginalAdvancedTemplateStyles />
    <SidebarSourceTemplateStyles />
    {/* <AppliedSidebarTemplateStyles /> — disabled: injecting both full template
        stylesheets globally caused a style-recalc freeze. Re-enable only with
        scoped/iframe-isolated CSS. */}
    <div className={`flex flex-col h-full ${isVideoFullscreen ? 'bg-black px-2 py-2' : ''}`}>
      {/* Video container with 9:16 aspect ratio for mobile preview */}
      <div className={`relative flex-1 rounded-xl overflow-visible flex items-center justify-center min-h-0 ${isVideoFullscreen ? 'pt-0 pb-2' : 'pt-4 pb-3'}`}>
        {/* Floating canvas tool rail beside the preview */}
        {setIsVideoFullscreen && (
          <div className={`absolute top-1/2 -translate-y-1/2 z-50 rounded-xl border border-white/10 bg-[#0d0d0d]/90 p-1.5 shadow-[0_18px_42px_-24px_rgba(0,0,0,0.9)] backdrop-blur-md ${isVideoFullscreen ? 'left-[24%]' : 'left-2 sm:left-4'}`}>
            {[
              { icon: ZoomIn, title: 'Zoom in', key: 'zoom-in', active: false },
              { icon: ZoomOut, title: 'Zoom out', key: 'zoom-out', active: false },
              { icon: Grid2X2, title: 'Guides', key: 'guides', active: showCornerGuides || showLayoutGuides },
              { icon: RotateCcw, title: 'Reset view', key: 'reset', active: false },
            ].map((tool) => {
              const Icon = tool.icon;
              return (
                <button
                  key={tool.title}
                  type="button"
                  className={`mb-1 flex h-7 w-7 items-center justify-center rounded-lg transition-colors last:mb-0 ${
                    tool.active ? 'bg-white text-black' : 'text-slate-500 hover:bg-white/5 hover:text-white'
                  }`}
                  title={tool.title}
                  onClick={(e) => handleCanvasToolClick(tool.key, e)}
                >
                  <Icon className="h-3.5 w-3.5" />
                </button>
              );
            })}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleVideoFullscreen();
              }}
              className="mt-1 flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-white/5 hover:text-white"
              title={`${isVideoFullscreen ? 'Collapse' : 'Expand'} (F)`}
            >
              {isVideoFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        )}
        {/* Zoom level badge — only visible when zoomed */}
        {canvasScale !== 1 && (
          <div className="absolute top-2 left-2 z-50 px-1.5 py-0.5 rounded bg-black/60 text-white/70 text-[10px] tabular-nums backdrop-blur-sm">
            {Math.round(canvasScale * 100)}%
          </div>
        )}
        <div
          className={`relative inline-flex max-w-full overflow-visible ${isVideoFullscreen ? 'scale-[1.02]' : ''}`}
          style={{ transition: 'transform 0.1s ease' }}
          onClick={(e) => {
            const target = e.target;
            if (!(target instanceof Element)) return;
            if (target.closest('[data-caption-layer], [data-text-element-layer], [data-word-key], .resize-handle, .text-resize-handle, [data-video-control], button, input, textarea, select, [role="button"], [contenteditable="true"]')) {
              return;
            }
            clearActiveSelection();
          }}
          >
          {showCornerGuides && (
            <div className="pointer-events-none absolute -inset-[14px] z-[65]">
              <span className="absolute left-0 top-0 h-[18px] w-[18px] border-l border-t border-white/75" />
              <span className="absolute right-0 top-0 h-[18px] w-[18px] border-r border-t border-white/75" />
              <span className="absolute left-0 bottom-0 h-[18px] w-[18px] border-b border-l border-white/75" />
              <span className="absolute right-0 bottom-0 h-[18px] w-[18px] border-b border-r border-white/75" />
            </div>
          )}
        <div
          ref={videoContainerRef}
          className={`lekha-video-frame relative aspect-[9/16] touch-none select-none bg-black shadow-[0_35px_120px_rgba(0,0,0,0.72)] ${isVideoFullscreen ? 'h-auto max-h-[calc(100dvh-92px)]' : 'h-full max-h-[calc(100dvh-360px)] md:max-h-[calc(100dvh-296px)]'}`}
            style={{
              transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${canvasScale})`,
              transformOrigin: 'center center',
              transition: isCanvasPanning ? 'none' : 'transform 0.1s ease',
              cursor: activeCanvasTool === 'move' ? (isCanvasPanning ? 'grabbing' : 'grab') : 'default',
            }}
            onPointerDown={handleCanvasMouseDown}
            onClickCapture={handleCanvasWordClickCapture}
            onClick={handleVideoSurfaceClick}
          >
          {showLayoutGuides && (
            <div className="pointer-events-none absolute inset-0 z-[80]">
              {[33.333, 66.666].map((pct) => (
                <div key={`layout-v-${pct}`} className="absolute top-0 bottom-0 w-px bg-white/14" style={{ left: `${pct}%` }} />
              ))}
              {[33.333, 66.666].map((pct) => (
                <div key={`layout-h-${pct}`} className="absolute left-0 right-0 h-px bg-white/14" style={{ top: `${pct}%` }} />
              ))}
            </div>
          )}
          {/* CPT snap guide lines */}
          {snapGuides.hLines.map((pct, i) => (
            <div
              key={`hg-${i}`}
              data-cpt-snap-guide="horizontal"
              className="pointer-events-none absolute left-0 right-0 z-[999] border-t border-dashed border-[#ff2f9f]"
              style={{
                top: `${pct}%`,
                boxShadow: '0 0 6px rgba(255,47,159,0.5)',
              }}
            />
          ))}
          {snapGuides.vLines.map((pct, i) => (
            <div
              key={`vg-${i}`}
              data-cpt-snap-guide="vertical"
              className="pointer-events-none absolute top-0 bottom-0 z-[999] border-l border-dashed border-[#ff2f9f]"
              style={{
                left: `${pct}%`,
                boxShadow: '0 0 6px rgba(255,47,159,0.5)',
              }}
            />
          ))}
          {cptWordGuides.length > 0 && (
            <div className="pointer-events-none absolute inset-0 z-[1000]" data-cpt-word-guides="true">
              {cptWordGuides.map((guide, i) => {
                if (guide.type === 'vertical') {
                  const y1 = Math.max(0, Math.min(guide.y1, guide.y2));
                  const height = Math.max(8, Math.abs(guide.y2 - guide.y1));
                  return (
                    <div
                      key={`cpt-word-v-${i}`}
                      className="absolute border-l border-dashed border-[#66f2ff] shadow-[0_0_8px_rgba(102,242,255,0.65)]"
                      style={{
                        left: `${guide.x}px`,
                        top: `${y1}px`,
                        height: `${height}px`,
                      }}
                    />
                  );
                }

                if (guide.type === 'horizontal') {
                  const x1 = Math.max(0, Math.min(guide.x1, guide.x2));
                  const width = Math.max(8, Math.abs(guide.x2 - guide.x1));
                  return (
                    <div
                      key={`cpt-word-h-${i}`}
                      className="absolute border-t border-dashed border-[#66f2ff] shadow-[0_0_8px_rgba(102,242,255,0.65)]"
                      style={{
                        left: `${x1}px`,
                        top: `${guide.y}px`,
                        width: `${width}px`,
                      }}
                    />
                  );
                }

                if (guide.type === 'spacing-vertical') {
                  const y1 = Math.max(0, Math.min(guide.y1, guide.y2));
                  const height = Math.max(6, Math.abs(guide.y2 - guide.y1));
                  return (
                    <div
                      key={`cpt-word-spacing-${i}`}
                      className="absolute"
                      style={{
                        left: `${guide.x}px`,
                        top: `${y1}px`,
                        height: `${height}px`,
                      }}
                    >
                      <span className="absolute left-[-4px] top-0 h-px w-2 bg-[#f8e36a]" />
                      <span className="absolute left-[-4px] bottom-0 h-px w-2 bg-[#f8e36a]" />
                      <span className="absolute left-0 top-0 h-full border-l border-dashed border-[#f8e36a] shadow-[0_0_7px_rgba(248,227,106,0.55)]" />
                    </div>
                  );
                }

                if (guide.type === 'spacing-horizontal') {
                  const x1 = Math.max(0, Math.min(guide.x1, guide.x2));
                  const width = Math.max(6, Math.abs(guide.x2 - guide.x1));
                  return (
                    <div
                      key={`cpt-word-spacing-x-${i}`}
                      className="absolute"
                      style={{
                        left: `${x1}px`,
                        top: `${guide.y}px`,
                        width: `${width}px`,
                      }}
                    >
                      <span className="absolute left-0 top-[-4px] h-2 w-px bg-[#f8e36a]" />
                      <span className="absolute right-0 top-[-4px] h-2 w-px bg-[#f8e36a]" />
                      <span className="absolute left-0 top-0 w-full border-t border-dashed border-[#f8e36a] shadow-[0_0_7px_rgba(248,227,106,0.55)]" />
                    </div>
                  );
                }

                return null;
              })}
            </div>
          )}
          {videoUrl ? (
            <>
              <MemoizedVideo
                videoRef={videoRef}
                videoUrl={videoUrl}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onMediaError={onVideoError}
                setIsPlaying={setIsPlaying}
              />
              <div className="absolute top-3 left-3 z-40 flex items-center gap-2">
                <span className="rounded bg-black/75 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-white">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-white mr-1" /> Rec
                </span>
              </div>
              <div className="absolute top-3 right-3 z-40 rounded bg-black/75 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-white">
                9:16 - 24FPS
              </div>
              {!isPlaying && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsPlaying(true);
                  }}
                  className="absolute left-1/2 top-1/2 z-40 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/24 bg-transparent text-white shadow-[0_10px_24px_rgba(0,0,0,0.22)] transition-transform hover:scale-[1.02]"
                  title="Play"
                >
                  <Play className="ml-0.5 h-5 w-5" />
                </button>
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-zinc-900/50">
              <p className="text-gray-500 text-sm text-center px-4">
                {captions.length ? 'Relink source video to preview' : 'Upload a video to get started'}
              </p>
            </div>
          )}



          {/* Caption overlays */}
          {activeCaptions.map((caption) => {
            const isEditingThis = isEditing === caption.id;
            const hasDetachedWords = captionHasDetachedWords(caption);
            const hasGlobalSidebarTemplate = hasSidebarTemplateStyle(captionStyle);
            const isSidebarTemplate = hasGlobalSidebarTemplate
              || hasSidebarTemplateStyle(caption?.applied_template_style)
              || !!caption?.template_20_id;
            const activeCaptionTemplateId = caption?.template_id || caption?.applied_template_style?.template_id || captionStyle?.template_id;
            const isBasicSourceTemplate = isSourceBasicTemplateId(activeCaptionTemplateId);
            const hasAppliedBasicSourceMarkup = isBasicSourceTemplate;
            const shouldWrapCaption = !isSidebarTemplate && (!activeCaptionTemplateId || isBasicSourceTemplate);
            const autoWrapMaxWidth = Math.max(
              220,
              Math.min(360, (canvasSize.width || videoContainerRef.current?.offsetWidth || 240) * 0.94)
            );
            const templateCaptionIndex = Math.max(
              0,
              captions.filter(c => c && !c.isTextElement).findIndex(c => c.id === caption.id),
            );
            const storedTemplatePhaseIndex = Number(caption?.template_phase_index);
            const advancedTemplatePhaseIndex = Number.isFinite(storedTemplatePhaseIndex)
              ? storedTemplatePhaseIndex
              : templateCaptionIndex;
            const basicTemplateWords = String(caption?.text || '').trim().split(/\s+/).filter(Boolean);
            const basicTemplateCurrentIdx = basicTemplateWords.length
              ? getCaptionCurrentWordIndex(caption, basicTemplateWords.length)
              : 0;
            const effectiveTemplateStyle = {
              ...(caption?.applied_template_style || {}),
              ...(captionStyle || {}),
            };
            const sourceTemplateAccentColor = isAdvancedTemplateId(activeCaptionTemplateId)
              ? resolveAdvancedTemplateEmphasisColor(activeCaptionTemplateId, '')
              : '';
            const configuredTemplateAccentColor = effectiveTemplateStyle?.highlight_color
              || effectiveTemplateStyle?.emphasis_color
              || effectiveTemplateStyle?.secondary_color
              || '';
            const configuredTemplateAccentDiffers = configuredTemplateAccentColor
              && sourceTemplateAccentColor
              && configuredTemplateAccentColor.toLowerCase?.() !== sourceTemplateAccentColor.toLowerCase?.();
            const templateColorsCustomized = Boolean(
              effectiveTemplateStyle?.template_color_customized
                || caption?.template_color_customized
                || configuredTemplateAccentDiffers,
            );
            const templateAccentColor = templateColorsCustomized
              ? (configuredTemplateAccentColor || sourceTemplateAccentColor || '#d4af37')
              : (sourceTemplateAccentColor || configuredTemplateAccentColor || '#d4af37');
            const templateTextColor = activeCaptionTemplateId === 't36'
              ? '#ffffff'
              : (effectiveTemplateStyle?.text_color || '#ffffff');
            const canvasTemplateEmphasisColor = activeCaptionTemplateId === 't35'
              ? ''
              : (templateColorsCustomized
                ? templateAccentColor
                : (sourceTemplateAccentColor || emotionalCaptionPlan.get(caption?.id)?.emphasisColor || caption?.emphasis_color || templateAccentColor || ''));
            const handleDeleteCaptionLine = (e) => {
              e.stopPropagation();
              e.preventDefault();
              if (!setCaptions) return;
              if (addToHistory) addToHistory();
              const captionUpdater = setCaptionsRaw || setCaptions;
              captionUpdater(prev => prev.filter(c => c.id !== caption.id));
              if (setSelectedCaptionId && selectedCaptionId === caption.id) {
                setSelectedCaptionId(null);
              }
            };
            const appliedBasicTemplateNode = hasAppliedBasicSourceMarkup
              ? renderAppliedBasicTemplateCaption(caption, templateCaptionIndex)
              : null;
            // Text elements are positioned higher or custom, but for now we'll use same style
            // We should probably allow separate positioning for text elements in future, but keeping simple for now
            // or we use captionStyle but offset it if it's a text element? 
            // The current request implies basic overlap support. 
            // We use the same getPositionStyle() which uses global captionStyle. This is a limitation.
            // Ideally text elements should have their own position in their data.
            // Since we don't have per-caption position yet, they will stack.
            // Let's at least render them so they are visible.

            return (
              <div
                key={caption.id}
                ref={captionRef}
                dir="auto"
                data-caption-layer="true"
                data-caption-id={caption.id}
                className={isSidebarTemplate
                  ? `absolute flex justify-center ${setCaptionStyle && !isEditingThis && !hasDetachedWords ? 'cursor-move' : ''}`
                  : `absolute px-3 flex justify-center ${setCaptionStyle && !isEditingThis && !hasDetachedWords ? 'cursor-move' : ''}`}
                style={isSidebarTemplate ? {
                  top: `${captionStyle?.position_y ?? 75}%`,
                  left: '50%',
                  width: '100%',
                  transform: 'translate(-50%, -50%)',
                  zIndex: caption.isTextElement ? 20 : 10,
                  pointerEvents: setCaptionStyle ? 'auto' : 'none',
                  overflow: 'visible',
                } : {
                  ...getPositionStyle(),
                  // If it's a text element, maybe offset it slightly or allow it to be distinct?
                  // For now, they share the same position setting which allows dragging ONE changes ALL.
                  // This is "MVP" behavior.
                  zIndex: caption.isTextElement ? 20 : 10,
                  pointerEvents: setCaptionStyle ? 'auto' : 'none',
                  overflow: 'visible',
                }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  if (setSelectedCaptionId) setSelectedCaptionId(caption.id);
                  if (setCaptionStyle && !isEditingThis && !hasDetachedWords) {
                    handleMouseDown(e);
                  }
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (setSelectedCaptionId) setSelectedCaptionId(caption.id);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  handleCaptionDoubleClick(e, caption);
                }}
              >
                <div
                  className={`border border-solid ${!isSidebarTemplate && selectedCaptionId === caption.id && !hasDetachedWords ? 'border-[#b76cff]' : !isSidebarTemplate ? 'border-transparent hover:border-[#b76cff]' : 'border-transparent'} relative ${isSidebarTemplate ? (isEditingThis ? 'cursor-text' : 'cursor-pointer') : isDragging ? 'cursor-grabbing' : isEditingThis ? 'cursor-text' : setCaptionStyle && !hasDetachedWords ? 'cursor-grab' : ''} ${!hasDetachedWords ? 'group' : ''} ${activeCaptionTemplateId || ''} ${getTemplateContainerStateClass(activeCaptionTemplateId)}`}
                  style={{
                    backgroundColor: 'transparent',
                    padding: '0px',
                    textAlign: captionStyle?.text_align || 'center',
                    width: isSidebarTemplate 
                      ? 'fit-content'
                      : captionStyle?.boxWidth 
                        ? `${captionStyle.boxWidth * previewRenderScale}px` 
                        : (shouldWrapCaption ? `${autoWrapMaxWidth}px` : 'fit-content'),
                    maxWidth: isSidebarTemplate
                      ? '94%'
                      : captionStyle?.boxWidth 
                        ? undefined 
                        : (shouldWrapCaption ? `${autoWrapMaxWidth}px` : '90vw'),
                    position: 'relative',
                    display: isSidebarTemplate ? 'inline-flex' : 'inline-block',
                    justifyContent: isSidebarTemplate ? 'center' : undefined,
                    overflow: 'visible',
                    // Template captions keep pointer events so the caption box is
                    // selectable / hoverable / double-click editable like a normal
                    // caption. Words inside are display-only spans, so this does not
                    // interfere with the template's time-based animations.
                    pointerEvents: 'auto',
                    '--template-primary': captionStyle?.text_color || '#ffffff',
                    '--template-secondary': captionStyle?.secondary_color || '#000000',
                    '--template-bg': captionStyle?.background_color || 'transparent',
                    '--template-highlight': captionStyle?.highlight_color || captionStyle?.emphasis_color || captionStyle?.secondary_color || ADVANCED_TEMPLATE_EMPHASIS_COLORS[captionStyle?.template_id] || '#DDAA03',
                    '--template-karaoke-1': captionStyle?.karaoke_color_1 || captionStyle?.highlight_color || captionStyle?.emphasis_color || captionStyle?.secondary_color || '#DDAA03',
                    '--template-karaoke-2': captionStyle?.karaoke_color_2 || '#22D3EE',
                    '--template-karaoke-3': captionStyle?.karaoke_color_3 || '#FB923C',
                  }}
                >
                  {/* Background layer — padding expands equally above and below the text */}
                  {captionStyle?.has_background && !hasDetachedWords && !isBasicSourceTemplate && (
                    <div
                      style={{
                        position: 'absolute',
                        top: `-${displayBackgroundPadding}px`,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: -1,
                        backgroundColor: `rgba(${parseInt((captionStyle?.background_color || '#000000').slice(1, 3), 16)}, ${parseInt((captionStyle?.background_color || '#000000').slice(3, 5), 16)}, ${parseInt((captionStyle?.background_color || '#000000').slice(5, 7), 16)}, ${captionStyle?.background_opacity ?? 0.7})`,
                        borderRadius: '6px',
                        width: `${100 * displayBackgroundWidthMultiplier}%`,
                        height: `calc(100% + ${2 * displayBackgroundPadding}px)`,
                      }}
                    />
                  )}

                  {/* Delete button for the selected/hovered main caption line */}
                  {setCaptions && !isEditingThis && !hasDetachedWords && (
                    <button
                      type="button"
                      className={`absolute -top-2.5 -right-2.5 w-6 h-6 bg-zinc-900 border border-white/20 hover:border-red-500/50 hover:bg-red-500/10 rounded-full transition-all z-50 flex items-center justify-center shadow-xl text-gray-400 hover:text-red-500 ${selectedCaptionId === caption.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                      }}
                      onClick={handleDeleteCaptionLine}
                      title="Delete caption line"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Resize handles — shown for regular and templated captions alike */}
                  {setCaptionStyle && !isEditingThis && !hasDetachedWords && !isSidebarTemplate && (
                    <>
                      {[
                        ['top-left', 'left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize'],
                        ['top', 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize'],
                        ['top-right', 'right-0 top-0 -translate-y-1/2 translate-x-1/2 cursor-nesw-resize'],
                        ['left', 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize'],
                        ['right', 'right-0 top-1/2 -translate-y-1/2 translate-x-1/2 cursor-ew-resize'],
                        ['bottom-left', 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize'],
                        ['bottom', 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 cursor-ns-resize'],
                        ['bottom-right', 'bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize'],
                      ].map(([edge, positionClass]) => (
                        <div
                          key={edge}
                          className={`resize-handle ${selectionHandleClass} ${positionClass} transition-opacity ${selectedCaptionId === caption.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                          data-resize-edge={edge}
                          onPointerDown={handleResizeMouseDown}
                          style={{ touchAction: 'none' }}
                        />
                      ))}
                    </>
                  )}

                  {isEditingThis ? (
                    <div
                      ref={inputRef}
                      contentEditable
                      suppressContentEditableWarning
                      onInput={handleEditInput}
                      onBlur={() => handleEditComplete(caption.id)}
                      onKeyDown={handleEditKeyDown}
                      className="bg-transparent border-none outline-none text-center relative z-10"
                      style={{
                        fontFamily: captionStyle?.font_family || 'Inter',
                        fontSize: `${(captionStyle?.font_size || 18) * previewRenderScale}px`,
                        lineHeight: captionStyle?.line_spacing || 1.4,
                        fontWeight: captionStyle?.font_weight || 'normal',
                        fontStyle: captionStyle?.font_style || 'normal',
                        textAlign: captionStyle?.text_align || 'center',
                        letterSpacing: captionStyle?.letter_spacing ? `${captionStyle.letter_spacing * previewRenderScale}px` : '0px',
                        wordSpacing: `${(captionStyle?.word_spacing ?? 0) * previewRenderScale}px`,
                        textDecoration: captionStyle?.text_decoration || 'none',
                        opacity: captionStyle?.text_opacity ?? 1,
                        transform: `scale(${captionStyle?.scale || 1})`,
                        padding: hasDetachedWords ? '0px' : `${displayCaptionPadY}px ${displayCaptionPadX}px`,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'normal',
                        ...(captionStyle?.text_gradient ? {
                          backgroundImage: captionStyle.text_gradient,
                          WebkitBackgroundClip: 'text',
                          backgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          color: 'transparent',
                          display: 'block', // Editor needs block to have size
                        } : {
                          color: captionStyle?.text_color || '#ffffff'
                        }),
                        textTransform: captionStyle?.text_case && captionStyle.text_case !== 'none' ? captionStyle.text_case : undefined,
                        width: '100%',
                        minWidth: shouldWrapCaption ? '0px' : '200px',
                        minHeight: '60px'
                      }}
                    >
                      {editText}
                    </div>
                  ) : isSidebarTemplate ? (
                    renderAppliedSidebarTemplateCaption(caption, templateCaptionIndex)
                  ) : appliedBasicTemplateNode ? (
                    appliedBasicTemplateNode
                  ) : activeCaptionTemplateId ? (
                    // Template rendering: simple word spans with CSS class states for template effects
                    <span
                      key={`${caption.id}-${activeCaptionTemplateId || 'template'}-${isBasicSourceTemplate ? basicTemplateCurrentIdx : 'static'}`}
                      className={`${getTemplateWrapperClassName(activeCaptionTemplateId)}${isBasicSourceTemplate ? ' lekha-basic-template-fit lekha-basic-template-animated' : ''}`}
                      data-basic-current-index={isBasicSourceTemplate ? basicTemplateCurrentIdx : undefined}
                      style={{
                        fontFamily: captionStyle?.font_family || 'Inter',
                        fontSize: isAdvancedTemplateId(activeCaptionTemplateId)
                          ? undefined
                          : `${scaleTemplateFontSize(captionStyle?.font_size) * previewRenderScale}px`,
                        fontWeight: captionStyle?.font_weight || 'normal',
                        fontStyle: captionStyle?.font_style || 'normal',
                        textAlign: captionStyle?.text_align || 'center',
                        display: isBasicSourceTemplate ? 'inline-block' : 'block',
                        lineHeight: isAdvancedTemplateId(activeCaptionTemplateId)
                          ? undefined
                          : `${scaleTemplateFontSize(captionStyle?.font_size) * previewRenderScale * (captionStyle?.line_spacing || 1.4)}px`,
                        letterSpacing: isAdvancedTemplateId(activeCaptionTemplateId)
                          ? undefined
                          : (captionStyle?.letter_spacing ? `${captionStyle.letter_spacing * previewRenderScale}px` : '0px'),
                        wordSpacing: isAdvancedTemplateId(activeCaptionTemplateId)
                          ? undefined
                          : `${(captionStyle?.word_spacing ?? 0) * previewRenderScale}px`,
                        textTransform: captionStyle?.text_case && captionStyle.text_case !== 'none' ? captionStyle.text_case : undefined,
                        maxWidth: '100%',
                        whiteSpace: caption.text?.includes('\n') ? 'pre-wrap' : ((shouldWrapCaption || captionStyle?.boxWidth) ? 'normal' : 'nowrap'),
                        overflowWrap: shouldWrapCaption ? 'anywhere' : 'normal',
                        wordBreak: 'normal',
                        // A detached word keeps an invisible spacer in this
                        // line. Preserve the line padding too, otherwise the
                        // remaining words jump when one word is moved.
                        padding: undefined,
                        // Template markup/classes own motion. A generic caption
                        // animation here masks the differences between templates.
                        animation: 'none',
                        '--basic-current-index': basicTemplateCurrentIdx,
                        '--basic-word-count': Math.max(1, basicTemplateWords.length),
                      }}
                    >
                      {(() => {
                        if (isAdvancedTemplateId(activeCaptionTemplateId)) {
                          // Keep the authored source renderer mounted during
                          // word dragging/styling. Replacing it with a generic
                          // editable renderer reflowed every sibling word and
                          // changed the caption box mid-gesture.
                          return (
                            <AppliedAdvancedTemplateCaption
                              key={`${caption.id}-${activeCaptionTemplateId}-${advancedTemplatePhaseIndex}-${caption.text}`}
                              caption={caption}
                              captionId={caption.id}
                              templateId={activeCaptionTemplateId}
                              text={caption.text}
                              blockIndex={advancedTemplatePhaseIndex}
                              templateMarkup={
                                caption?.applied_template_style?.template_markup
                                || caption?.template_markup
                                || captionStyle?.template_markup
                                || ''
                              }
                              impWordIndex={Number(emotionalCaptionPlan.get(caption?.id)?.impWordIndex ?? caption?.imp_word_index ?? -1)}
                              impWordIndices={emotionalCaptionPlan.get(caption?.id)?.impWordIndices || caption?.imp_word_indices || []}
                              emphasisColor={canvasTemplateEmphasisColor}
                              previewLineTexts={caption?.preview_template_line_texts || []}
                              textColor={templateTextColor}
                              textGradient={effectiveTemplateStyle?.text_gradient || ''}
                              accentColor={templateAccentColor}
                              highlightGradient={effectiveTemplateStyle?.highlight_gradient || ''}
                              karaokeColor1={effectiveTemplateStyle?.karaoke_color_1 || templateAccentColor || '#DDAA03'}
                              karaokeColor2={effectiveTemplateStyle?.karaoke_color_2 || '#22D3EE'}
                              karaokeColor3={effectiveTemplateStyle?.karaoke_color_3 || '#FB923C'}
                              backgroundColor={effectiveTemplateStyle?.background_color || 'transparent'}
                              colorsCustomized={templateColorsCustomized}
                              currentTime={getCaptionCptRenderTime(caption)}
                              isPlaying={isPlaying}
                              startTime={caption.start_time || caption.start || 0}
                              endTime={caption.end_time || caption.end || caption.start_time || 0}
                              renderScale={previewRenderScale}
                              onSourceWordClick={openSourceTemplateWordPopup}
                              onSourceWordPointerDown={startSourceTemplateWordDrag}
                              isSelected={selectedCaptionId === caption.id}
                            />
                          );
                        }

                        const words = isBasicSourceTemplate
                          ? basicTemplateWords
                          : caption.text.split(' ');
                        const wordCount = words.length;
                        const isAdvancedTemplate = isAdvancedTemplateId(activeCaptionTemplateId);
                        // Compute which word index is currently being spoken
                        const currentIdx = isBasicSourceTemplate
                          ? basicTemplateCurrentIdx
                          : getCaptionCurrentWordIndex(caption, wordCount);

                        if (activeCaptionTemplateId === 't-QW1') {
                          return (
                            <span className="sblock t-QW1">
                              <span className="sw-line v32-sw">
                                {words.map((word, wordIndex) => {
                                  const wordStyle = caption.wordStyles?.[`${caption.id}-${wordIndex}`] || {};
                                  const isSelected = wordPopup?.caption?.id === caption.id
                                    && wordPopup?.wordIndex === wordIndex;
                                  const wordAnimation = wordStyle.animation && wordStyle.animation !== 'none'
                                    ? getWordAnimationStyle(wordStyle.animation, wordStyle.animationSpeed || 1)
                                    : 'none';
                                  const cptMotionStyle = getCptWordMotionStyle(
                                    caption,
                                    wordStyle,
                                    wordIndex,
                                    wordCount,
                                    currentIdx,
                                    { templateBlockType: 'wbw-rise' },
                                  );
                                  const resolvedWordMotionStyle = cptMotionStyle || { animation: wordAnimation };
                                  return (
                                    <span
                                      key={`${wordIndex}-${basicTemplateCurrentIdx}`}
                                      data-word-key={`${caption.id}-${wordIndex}`}
                                      className={[
                                        'sw-w',
                                        wordIndex < basicTemplateCurrentIdx ? 'done active' : '',
                                        wordIndex === basicTemplateCurrentIdx ? 'current active' : '',
                                        isSelected ? 'ring-2 ring-[#F5A623] rounded-sm' : '',
                                      ].filter(Boolean).join(' ')}
                                      style={{
                                        '--basic-word-index': wordIndex,
                                        '--basic-word-delay': `${Math.min(wordIndex, 10) * 80}ms`,
                                        opacity: isCptWordPending(caption, wordIndex, currentIdx) ? 0 : undefined,
                                        cursor: 'pointer',
                                        animation: cptMotionStyle ? 'none' : undefined,
                                        transition: cptMotionStyle ? 'none' : undefined,
                                      }}
                                      onClick={(e) => {
                                        if (setWordPopup) {
                                          e.stopPropagation();
                                          setWordPopup({
                                            word,
                                            position: { x: e.clientX, y: e.clientY },
                                            caption,
                                            wordIndex,
                                          });
                                        }
                                      }}
                                    >
                                      <span
                                        data-word-drag-visual="true"
                                        style={{
                                          display: 'inline-block',
                                          transformOrigin: 'center center',
                                          ...resolvedWordMotionStyle,
                                        }}
                                      >
                                        {renderWordTextContent(word, wordStyle, 'inherit')}
                                      </span>
                                    </span>
                                  );
                                })}
                              </span>
                            </span>
                          );
                        }

                        const renderedWords = words.map((word, wordIndex, arr) => {
                          const isPast    = wordIndex < currentIdx;
                          const isCurrent = wordIndex === currentIdx;

                          const wordStyle = caption.wordStyles?.[`${caption.id}-${wordIndex}`] || {};
                          let cls = isSourceBasicTemplateId(activeCaptionTemplateId)
                            ? getBasicTemplateWordClassName(activeCaptionTemplateId, isPast, isCurrent, wordStyle?.isEmphasis)
                            : 'word';
                          if (!isSourceBasicTemplateId(activeCaptionTemplateId)) {
                            if (isCurrent) cls += ' current active';
                            else if (isPast) cls += ' active done';
                            if (wordStyle?.isEmphasis) cls += ' imp';
                          }
                          if (isAdvancedTemplate) {
                            const shouldShowAdvancedWord = captionStyle?.show_inactive !== false || !isPlaying || isPast || isCurrent;
                            cls = ['w', shouldShowAdvancedWord ? 'in' : '', wordStyle?.isEmphasis ? 'imp-bold' : '']
                              .filter(Boolean)
                              .join(' ');
                          }
                          const detached = isWordDetached(wordStyle);

                          // Word-by-word delivery mode: accumulate — show words 0..currentIdx
                          if (shouldRevealSequentially(caption) && wordIndex > currentIdx) {
                            return null;
                          }

                          const isSelected = wordPopup?.caption?.id === caption.id
                            && wordPopup?.wordIndex === wordIndex;
                          const wordAnimation = wordStyle.animation && wordStyle.animation !== 'none'
                            ? getWordAnimationStyle(wordStyle.animation, wordStyle.animationSpeed || 1)
                            : 'none';
                          const cptMotionStyle = getCptWordMotionStyle(
                            caption,
                            wordStyle,
                            wordIndex,
                            wordCount,
                            currentIdx,
                            {
                              templateBlockType: getOriginalTemplateBlockType(
                                activeCaptionTemplateId,
                                Number(caption?.template_phase_index ?? 0),
                              ),
                              templateSource: caption?.template_source || captionStyle?.template_source,
                            },
                          );
                          const resolvedWordMotionStyle = cptMotionStyle || { animation: wordAnimation };

                          return (
                            <span
                              key={`${wordIndex}-${isBasicSourceTemplate ? basicTemplateCurrentIdx : 'static'}`}
                              data-word-key={detached ? undefined : `${caption.id}-${wordIndex}`}
                              className={cls + (isSelected ? ' ring-2 ring-[#F5A623] rounded-sm' : '')}
                              style={{
                                cursor: detached
                                  ? 'default'
                                  : (draggingWord?.captionId === caption.id && draggingWord?.wordIndex === wordIndex ? 'grabbing' : 'pointer'),
                                display: 'inline-block',
                                opacity: isCptWordPending(caption, wordIndex, currentIdx) ? 0 : undefined,
                                marginRight: wordIndex < words.length - 1 ? `${(captionStyle?.word_spacing ?? 1) * 2}px` : '0',
                                maxWidth: '100%',
                                whiteSpace: String(word || '').includes('\n') ? 'pre-wrap' : (shouldWrapCaption ? 'normal' : 'nowrap'),
                                overflowWrap: shouldWrapCaption ? 'anywhere' : 'normal',
                                visibility: detached ? 'hidden' : 'visible',
                                '--basic-word-index': wordIndex,
                                '--basic-word-delay': `${Math.min(wordIndex, 10) * 65}ms`,
                                animation: cptMotionStyle ? 'none' : undefined,
                                transition: cptMotionStyle ? 'none' : undefined,
                              }}
                              onClick={(e) => {
                                if (detached) return;
                                if (setWordPopup) {
                                  e.stopPropagation();
                                  setWordPopup({
                                    word,
                                    position: { x: e.clientX, y: e.clientY },
                                    caption,
                                    wordIndex,
                                  });
                                }
                              }}
                            >
                              <span
                                data-word-drag-visual="true"
                                style={{
                                  display: 'inline-block',
                                  transformOrigin: 'center center',
                                  ...resolvedWordMotionStyle,
                                }}
                              >
                                {renderWordTextContent(word, wordStyle, 'inherit')}
                              </span>
                              {wordIndex < arr.length - 1 ? ' ' : ''}
                            </span>
                          );
                        });

                        return isAdvancedTemplate ? (
                          <span className={getTemplateVariantClassName(activeCaptionTemplateId)}>
                            {renderedWords}
                          </span>
                        ) : renderedWords;
                      })()}
                    </span>
                  ) : (
                    // Custom rendering: complex word-level inline styles with backgrounds and offsets
                    <span
                      className={`cap-text${caption.animation ? ` animate-${caption.animation}` : ''}`}
                      style={{
                        fontFamily: captionStyle?.font_family || 'Inter',
                        fontSize: `${(captionStyle?.font_size || 18) * previewRenderScale}px`,
                        lineHeight: `${(captionStyle?.font_size || 18) * previewRenderScale * (captionStyle?.line_spacing || 1.4)}px`,
                        fontWeight: captionStyle?.font_weight || 'normal',
                        fontStyle: captionStyle?.font_style || 'normal',
                        textAlign: captionStyle?.text_align || 'center',
                        display: 'block',
                        letterSpacing: captionStyle?.letter_spacing ? `${captionStyle.letter_spacing * previewRenderScale}px` : '0px',
                        wordSpacing: `${(captionStyle?.word_spacing ?? 0) * previewRenderScale}px`,
                        textDecoration: captionStyle?.text_decoration || 'none',
                        opacity: captionStyle?.text_opacity ?? 1,
                        transform: `scale(${captionStyle?.scale || 1})`,

                        animation: captionHasCptWords(caption)
                          ? 'none'
                          : (caption.animation && caption.animation !== 'none' ? getAnimationStyle(caption.animation, caption.animationSpeed) : 'none'),
                        color: captionStyle?.text_color || '#ffffff',
                        textTransform: captionStyle?.text_case && captionStyle.text_case !== 'none' ? captionStyle.text_case : undefined,
                        // Keep the sentence's original layout after a word is
                        // detached; its own overlay is positioned separately.
                        padding: `${displayCaptionPadY}px ${displayCaptionPadX}px`,
                        position: 'relative',
                        zIndex: 10,
                        whiteSpace: caption.text?.includes('\n') ? 'pre-wrap' : ((shouldWrapCaption || captionStyle?.boxWidth) ? 'normal' : 'nowrap'),
                        wordBreak: 'normal',
                        // Add shadow/stroke if configured
                        ...(() => {
                          const efx = computeEffectCSS(captionStyle);
                          return {
                            // `??` not `||` — zero offsets/blur are how glow and offset-only
                            // shadow templates (t-9, t-12, t-57, t-109, t-124) are authored.
                            textShadow: efx.textShadow || (captionStyle?.has_shadow && !captionStyle?.text_gradient ? `${captionStyle?.shadow_offset_x ?? 0}px ${captionStyle?.shadow_offset_y ?? 2}px ${captionStyle?.shadow_blur ?? 4}px ${captionStyle?.shadow_color || 'rgba(0,0,0,0.8)'}` : undefined),
                            WebkitTextStroke: efx.WebkitTextStroke || (captionStyle?.has_stroke === true && !captionStyle?.text_gradient ? `${captionStyle?.stroke_width || 0.5}px ${captionStyle?.stroke_color || '#000000'}` : '0px transparent'),
                          };
                        })(),
                        // Add background or highlight if configured
                        ...(!isSidebarTemplate ? (
                          captionStyle?.highlight_gradient ? {
                            backgroundImage: captionStyle.highlight_gradient
                          } : captionStyle?.highlight_color ? {
                            backgroundColor: captionStyle.highlight_color
                          } : {}
                        ) : {}),
                        // Global text gradient
                        ...(captionStyle?.text_gradient ? {
                          backgroundImage: captionStyle.text_gradient,
                          WebkitBackgroundClip: 'text',
                          backgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          color: 'transparent'
                        } : {})
                      }}
                    >
                      {(() => {
                        const sidebarTemplateActive = hasSidebarTemplateStyle(captionStyle);
                        const sidebarWords = caption.text.split(' ');
                        const sidebarCurrentIdx = getCaptionCurrentWordIndex(caption, sidebarWords.length);
                        const sidebarAccent = captionStyle?.secondary_color || '#DDAA03';

                        return sidebarWords.map((word, wordIndex, arr) => {
                        // Word-by-word mode: compute current word index from timing
                        if (shouldRevealSequentially(caption)) {
                          const currentIdx = getCaptionCurrentWordIndex(caption, arr.length)
                          // Accumulate: show words 0..currentIdx (sentence builds word by word)
                          if (wordIndex > currentIdx) return null
                        }
                        const styleKey = `${caption.id}-${wordIndex}`;
                        const ws = caption.wordStyles?.[styleKey] || {};
                        const isSelected = wordPopup?.caption?.id === caption.id && wordPopup?.wordIndex === wordIndex;
                        const baseFontSize = (captionStyle?.font_size || 18) * previewRenderScale;
                        const rawWordFontSize = ws.fontSize || ws.frozenFontSize || (captionStyle?.font_size || 18);
                        const wordFontSize = rawWordFontSize * previewRenderScale;
                        const { x: renderOffsetX, y: renderOffsetY, isPositioned } = getWordRenderOffset(ws);
                        const detached = isWordDetached(ws);
                        const layoutFontSize = baseFontSize;
                        const isPastSidebarWord = sidebarTemplateActive && wordIndex < sidebarCurrentIdx;
                        const isCurrentSidebarWord = sidebarTemplateActive && wordIndex === sidebarCurrentIdx;
                        if (detached) {
                          return (
                            <span
                              key={wordIndex}
                              aria-hidden="true"
                              style={{
                                display: 'inline-block',
                                position: 'relative',
                                fontSize: `${layoutFontSize}px`,
                                lineHeight: 'inherit',
                                verticalAlign: 'baseline',
                                marginRight: wordIndex < arr.length - 1 ? `${Math.round(layoutFontSize * 0.18 + (captionStyle?.word_spacing ?? 1) * 2)}px` : '0',
                              }}
                            >
                              <span
                                style={{
                                  position: 'absolute',
                                  top: '50%',
                                  left: '50%',
                                  transform: 'translate(-50%, -50%)',
                                  opacity: 0,
                                  pointerEvents: 'none',
                                  whiteSpace: String(word || '').includes('\n') ? 'pre-wrap' : 'nowrap',
                                  fontSize: `${wordFontSize}px`,
                                }}
                              >
                                {word}
                              </span>
                              <span style={{ visibility: 'hidden', fontSize: `${layoutFontSize}px`, whiteSpace: 'pre' }}>
                                {word}
                              </span>
                            </span>
                          );
                        }
                        // Keep line layout stable at the base caption size.
                        // Visual word styling happens in the absolutely-positioned inner span.

                        // Emphasis: bold + 1.2x scale + configured accent color + subtle glow
                        const emphasisAccent = captionStyle?.secondary_color || '#DDAA03';
                        const emphasisStyle = ws.isEmphasis ? {
                          fontWeight: 'bold',
                          color: ws.color || emphasisAccent,
                          fontSize: `${Math.round(wordFontSize * 1.2)}px`,
                          textShadow: `0 0 18px ${emphasisAccent}99, 0 0 6px ${emphasisAccent}66`,
                        } : {};
                        const sidebarWordStyle = sidebarTemplateActive ? {
                          color: ws.color || (isCurrentSidebarWord ? sidebarAccent : (captionStyle?.text_color || '#ffffff')),
                          opacity: isCurrentSidebarWord ? 1 : (isPastSidebarWord ? 0.96 : 0.46),
                          textShadow: isCurrentSidebarWord ? `0 0 18px ${sidebarAccent}33` : undefined,
                        } : {};
                        const cptMotionStyle = getCptWordMotionStyle(
                          caption,
                          ws,
                          wordIndex,
                          arr.length,
                          sidebarCurrentIdx,
                          {
                            templateSource: captionStyle?.template_source,
                          },
                        );
                        const resolvedWordMotionStyle = cptMotionStyle || {
                              animation: ws.animation && ws.animation !== 'none'
                                ? getWordAnimationStyle(ws.animation)
                                : 'none',
                            };


                        const wordNode = (
                          <span
                            key={wordIndex}
                            data-word-key={`${caption.id}-${wordIndex}`}
                            style={{
                              display: 'inline-block',
                              position: 'relative',
                              fontSize: `${layoutFontSize}px`,
                              lineHeight: 'inherit',
                              verticalAlign: 'baseline',
                              marginRight: wordIndex < arr.length - 1 ? `${Math.round(layoutFontSize * 0.18 + (captionStyle?.word_spacing ?? 1) * 2)}px` : '0',
                              opacity: isCptWordPending(caption, wordIndex, sidebarCurrentIdx) ? 0 : undefined,
                              animation: cptMotionStyle ? 'none' : undefined,
                              transition: cptMotionStyle ? 'none' : undefined,
                              transform: !detached && isPositioned
                                ? `translate(${renderOffsetX}px, ${renderOffsetY}px)`
                                : 'none',
                              zIndex: !detached && isPositioned ? 20 : 'auto',
                              cursor: detached
                                ? 'default'
                                : (draggingWord?.captionId === caption.id && draggingWord?.wordIndex === wordIndex ? 'grabbing' : 'default'),
                            }}
                            onPointerDown={detached ? undefined : (e) => handleCaptionWordPointerIntent(
                              e,
                              caption,
                              wordIndex,
                              word,
                            )}
                            onClick={(e) => {
                              if (Date.now() - lastDragDropTime.current < 150) return;
                              if (setWordPopup) {
                                e.stopPropagation();
                                setWordPopup({
                                  word: word,
                                  position: { x: e.clientX, y: e.clientY },
                                  caption: caption,
                                  wordIndex: wordIndex
                                });
                              }
                            }}
                          >
                            {/* Fixed-size selection ring — sized by spacer, never by fontSize */}
                            {isSelected && (
                              <span style={{
                                position: 'absolute',
                                inset: '-2px',
                                border: '2px solid #F5A623',
                                borderRadius: '3px',
                                pointerEvents: 'none',
                                zIndex: 30,
                              }} />
                            )}
                            {/* Inner span: all visual styles. Absolute so it never affects layout flow */}
                            <span
                              data-word-drag-visual="true"
                              style={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                transform: isCurrentSidebarWord ? 'translate(-50%, -50%) scale(1.03)' : 'translate(-50%, -50%)',
                                whiteSpace: String(word || '').includes('\n') ? 'pre-wrap' : 'nowrap',
                                fontFamily: ws.fontFamily || 'inherit',
                                fontSize: `${wordFontSize}px`,
                                fontWeight: ws.fontWeight || (isCurrentSidebarWord ? (captionStyle?.font_weight || '700') : 'inherit'),
                                fontStyle: ws.fontStyle || 'inherit',
                                textDecoration: ws.textDecoration || 'inherit',
                                textTransform: ws.textTransform || undefined,
                                color: ws.color || sidebarWordStyle.color || 'inherit',
                                ...(sidebarTemplateActive ? sidebarWordStyle : {}),
                                ...(ws.backgroundColor ? {
                                  backgroundColor: `rgba(${parseInt(ws.backgroundColor.slice(1,3),16)}, ${parseInt(ws.backgroundColor.slice(3,5),16)}, ${parseInt(ws.backgroundColor.slice(5,7),16)}, ${ws.backgroundOpacity ?? 0.6})`,
                                  borderRadius: '3px',
                                  padding: `${(ws.backgroundPadding || 2) * previewRenderScale}px ${4 * previewRenderScale}px`,
                                } : {}),
                                ...computeWordEffectCSS(ws),
                                ...emphasisStyle,
                                ...(ws.textGradient ? {
                                  background: ws.textGradient,
                                  backgroundImage: ws.textGradient,
                                  backgroundSize: '100% 100%',
                                  backgroundRepeat: 'no-repeat',
                                  backgroundPosition: 'center',
                                  WebkitBackgroundClip: 'text',
                                  backgroundClip: 'text',
                                  WebkitTextFillColor: 'transparent',
                                  color: 'transparent',
                                } : {}),
                                ...resolvedWordMotionStyle,
                              }}
                            >
                              {word}
                            </span>
                            {/* Invisible spacer — holds layout width at layoutFontSize (baseFontSize for dragged words) */}
                            <span style={{ visibility: 'hidden', fontSize: `${layoutFontSize}px`, whiteSpace: 'pre' }}>
                              {word}
                            </span>
                          </span>
                        );

                        return wordNode;
                      });
                      })()}
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {detachedCaptionWordOverlays}

          {/* Text Elements (render above captions) */}
          {activeTextElements.map((element) => {
            const style = element.customStyle || {};
            const isEditingThis = isEditing === element.id;
            const textElementMetrics = getTextElementDisplayMetrics(style);
            const textElementEffects = getTextElementEffectCSS(style);

            const handleDeleteElement = (e) => {
              e.stopPropagation()
              e.preventDefault()
              if (!setCaptions || element.readOnly) return
              setCaptions(prev => prev.filter(c => c.id !== element.id))
              if (selectedCaptionId === element.id) setSelectedCaptionId?.(null)
              if (wordPopup?.elementId === element.id) setWordPopup?.(null)
              if (isEditingThis) {
                setIsEditing(false)
                setEditText('')
              }
            }

            return (
              <div
                key={element.id}
                dir="auto"
                inert={element.readOnly ? "" : undefined}
                data-text-element-layer="true"
                className={`absolute group ${draggedElementId === element.id ? 'cursor-grabbing' : 'cursor-grab'}`}
                style={{
                  top: `${style.top || 50}%`,
                  left: `${style.left || 50}%`,
                  transform: `translate(-50%, -50%)${style.rotation ? ` rotate(${style.rotation}deg)` : ''}`,
                  transformOrigin: 'center center',
                  width: `${(style.width || 300) * previewRenderScale}px`,
                  zIndex: style.zIndex || 50
                }}
                onPointerDown={(e) => {
                  if (!isEditingThis) {
                    // Set this text element as selected
                    if (setSelectedCaptionId) setSelectedCaptionId(element.id);
                    handleTextElementMouseDown(e, element.id, style);
                  }
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (setSelectedCaptionId) setSelectedCaptionId(element.id);
                }}
                onDoubleClick={(e) => handleCaptionDoubleClick(e, element)}
              >
                <div
                  className={`border border-solid ${selectedCaptionId === element.id ? 'border-[#b76cff]' : 'border-transparent hover:border-[#b76cff]'} relative ${draggedElementId === element.id ? 'cursor-grabbing' : isEditingThis ? 'cursor-text' : 'cursor-grab'}`}
                  style={{
                    width: '100%',
                    backgroundColor: 'transparent',
                    padding: '0px',
                    textAlign: style.textAlign || 'center',
                    maxWidth: '90vw',
                    position: 'relative',
                    display: 'inline-block',
                  }}
                >
                  {style.hasBackground !== false && element.type !== 'textbox' && (
                    <div
                      style={{
                        position: 'absolute',
                        top: `-${textElementMetrics.backgroundPadding}px`,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: -1,
                        backgroundColor: style.backgroundColor
                          ? `rgba(${parseInt(style.backgroundColor.slice(1, 3), 16)}, ${parseInt(style.backgroundColor.slice(3, 5), 16)}, ${parseInt(style.backgroundColor.slice(5, 7), 16)}, ${style.backgroundOpacity ?? 0.7})`
                          : `rgba(0, 0, 0, ${style.backgroundOpacity ?? 0.7})`,
                        borderRadius: `${style.borderRadius || 6}px`,
                        width: `${100 * textElementMetrics.backgroundWidthMultiplier}%`,
                        height: `calc(100% + ${2 * textElementMetrics.backgroundPadding}px)`,
                      }}
                    />
                  )}

                {/* Keep removal available without hover, including while editing. */}
                {setCaptions && !element.readOnly && (
                  <button
                    type="button"
                    className="absolute -top-9 -right-3 z-[60] flex h-7 w-7 cursor-pointer touch-manipulation items-center justify-center rounded-full border border-white/30 bg-zinc-900 text-white shadow-xl transition-colors hover:border-red-400 hover:bg-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    data-text-element-close="true"
                    aria-label="Remove text box"
                    onPointerDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                    }}
                    onDoubleClick={(e) => e.stopPropagation()}
                    onClick={handleDeleteElement}
                    title="Remove text box"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Resize handles - show for all active text elements */}
                {!isEditingThis && (
                  <>
                    {[
                      ['top-left', 'left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize w-3 h-3 rounded-full'],
                      ['top-right', 'right-0 top-0 -translate-y-1/2 translate-x-1/2 cursor-nesw-resize w-3 h-3 rounded-full'],
                      ['bottom-left', 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize w-3 h-3 rounded-full'],
                      ['bottom-right', 'bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize w-3 h-3 rounded-full'],
                      ['left', 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize w-2 h-4.5 rounded-full'],
                      ['right', 'right-0 top-1/2 -translate-y-1/2 translate-x-1/2 cursor-ew-resize w-2 h-4.5 rounded-full'],
                    ].map(([edge, positionAndShapeClass]) => (
                      <div
                        key={edge}
                        className={`text-resize-handle absolute z-50 border border-[#b76cff] bg-white shadow-[0_0_0_1px_rgba(255,255,255,0.7)] ${positionAndShapeClass} transition-opacity ${selectedCaptionId === element.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                        data-resize-edge={edge}
                        onPointerDown={(e) => handleTextElementResizeDown(e, element.id, style)}
                        style={{ touchAction: 'none' }}
                      />
                    ))}
                  </>
                )}

                {isEditingThis ? (
                  <div
                    ref={inputRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={handleEditInput}
                    onBlur={() => handleEditComplete(element.id)}
                    onKeyDown={handleEditKeyDown}
                    className="bg-transparent border-none outline-none text-center relative z-10"
                    style={{
                      fontFamily: style.fontFamily || 'Inter',
                      fontSize: `${(style.fontSize || 18) * previewRenderScale}px`,
                      textAlign: style.textAlign || 'center',
                      fontWeight: style.fontWeight || '800',
                      fontStyle: style.fontStyle || 'normal',
                      textDecoration: style.textDecoration || 'none',
                      textTransform: style.textTransform || 'none',
                      letterSpacing: style.letterSpacing ? `${style.letterSpacing * previewRenderScale}px` : '0px',
                      wordSpacing: `${(style.wordSpacing ?? 0) * previewRenderScale}px`,
                      lineHeight: style.lineSpacing || 1.4,
                      opacity: style.textOpacity ?? 1,
                      transform: `scale(${style.scale || 1})`,
                      padding: `${textElementMetrics.textPadY}px ${textElementMetrics.textPadX}px`,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'normal',
                      overflowWrap: 'anywhere',
                      minHeight: '40px',
                      ...textElementEffects,
                      ...(style.textGradient ? {
                        backgroundImage: style.textGradient,
                        WebkitBackgroundClip: 'text',
                        backgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        color: 'transparent',
                        display: 'block',
                      } : {
                        color: style.color || '#ffffff',
                      }),
                    }}
                  >
                    {editText}
                  </div>
                ) : (
                  <div
                    className={element.animation ? `animate-${element.animation}` : ''}
                    style={{
                      fontFamily: style.fontFamily || 'Inter',
                      fontSize: `${(style.fontSize || 18) * previewRenderScale}px`,
                      textAlign: style.textAlign || 'center',
                      textTransform: style.textTransform || 'none',
                      fontWeight: style.fontWeight || '800',
                      fontStyle: style.fontStyle || 'normal',
                      letterSpacing: style.letterSpacing ? `${style.letterSpacing * previewRenderScale}px` : '0px',
                      wordSpacing: `${(style.wordSpacing ?? 0) * previewRenderScale}px`,
                      lineHeight: style.lineSpacing || 1.4,
                      textDecoration: style.textDecoration || 'none',
                      opacity: style.textOpacity ?? 1,
                      transform: `scale(${style.scale || 1})`,
                      padding: `${textElementMetrics.textPadY}px ${textElementMetrics.textPadX}px`,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'normal',
                      overflowWrap: 'anywhere',
                      animation: element.animation && element.animation !== 'none' ? getAnimationStyle(element.animation, element.animationSpeed) : 'none',
                      ...textElementEffects,
                      ...(style.textGradient ? {
                        backgroundImage: style.textGradient,
                        WebkitBackgroundClip: 'text',
                        backgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        color: 'transparent',
                      } : {
                        color: style.color || '#ffffff',
                      }),
                    }}
                  >
                    {/* Render words individually with per-word styling */}
                    {Number(style.width || 0) < 80 ? (element.text || '') : (element.text || '').split(/(\s+|\n)/).map((part, i) => {
                      if (part === '\n') return <br key={i} />;
                      if (part.match(/^\s+$/)) return <span key={i}>{part}</span>;

                      const words = (element.text || '').split(/\s+/);
                      const wordIndex = words.indexOf(part);
                      const wordStyle = element.wordStyles?.[`${element.id}-${wordIndex}`] || {};
                      const isWordClicked = wordPopup?.type === 'element' && wordPopup?.elementId === element.id && wordPopup?.wordIndex === wordIndex;
                      // Extract transform to parent - ensures text + background move together
                      const { animation, ...restWordStyle } = wordStyle;
                      const { x: renderOffsetX, y: renderOffsetY } = getWordRenderOffset(wordStyle);

                      return (
                        <span
                          key={i}
                          data-word-key={`${element.id}-${wordIndex}`}
                          style={{
                            display: 'inline-block',
                            position: 'relative',
                            transform: `translate(${renderOffsetX}px, ${renderOffsetY}px)`,
                            transition: draggingWord ? 'none' : 'transform 0.1s ease',
                            cursor: draggingWord?.captionId === element.id && draggingWord?.wordIndex === wordIndex ? 'grabbing' : 'default',
                            height: `${(style.fontSize || 18) * 1.4}px`,
                            verticalAlign: 'top',
                          }}
                          onPointerDown={(e) => handleWordMouseDown(e, element, wordIndex, true)}
                          onClick={(e) => {
                            if (Date.now() - lastDragDropTime.current < 150) return;
                            if (setWordPopup) {
                              e.stopPropagation();
                              setWordPopup({
                                type: 'element',
                                word: part,
                                elementId: element.id,
                                position: { x: e.clientX, y: e.clientY },
                                caption: null,
                                wordIndex
                              });
                            }
                          }}
                        >
                          {/* Spacer: reserves original space based on element's base font */}
                          <span
                            style={{
                              visibility: 'hidden',
                              fontFamily: style.fontFamily || 'Inter',
                              fontSize: `${(style.fontSize || 18) * previewRenderScale}px`,
                              fontWeight: style.fontWeight || 'normal',
                              whiteSpace: 'pre',
                            }}
                          >
                            {part}
                          </span>

                          {/* Absolute container centers text + background group */}
                          <span
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              height: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              pointerEvents: 'none',
                            }}
                          >
                            {/* UNIFIED GROUP: Background wraps text - both move with parent transform */}
                            <span
                              className={animation ? `animate-${animation}` : ''}
                              style={{
                                pointerEvents: 'auto',
                                position: 'relative',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                animation: animation && animation !== 'none' ? getAnimationStyle(animation, wordStyle.animationSpeed) : 'none',
                              }}
                            >
                              {/* BACKGROUND LAYER - Fixed padding, independent of text size */}
                              <span
                                style={{
                                  position: 'absolute',
                                  top: -2,
                                  left: -4,
                                  right: -4,
                                  bottom: -2,
                                  zIndex: -1,
                                  borderRadius: restWordStyle.backgroundColor || isWordClicked ? '4px' : undefined,
                                  backgroundColor: restWordStyle.backgroundColor
                                    ? `rgba(${parseInt(restWordStyle.backgroundColor.slice(1, 3), 16)}, ${parseInt(restWordStyle.backgroundColor.slice(3, 5), 16)}, ${parseInt(restWordStyle.backgroundColor.slice(5, 7), 16)}, ${restWordStyle.backgroundOpacity ?? 0.6})`
                                    : (isWordClicked ? 'rgba(245, 166, 35, 0.24)' : undefined),
                                  border: isWordClicked ? '1px solid rgba(245, 166, 35, 0.9)' : '1px solid transparent',
                                }}
                              />

                              {/* TEXT LAYER */}
                              <span
                                style={{
                                  fontFamily: restWordStyle.fontFamily || style.fontFamily || 'Inter',
                                  fontSize: restWordStyle.fontSize ? `${restWordStyle.fontSize * previewRenderScale}px` : `${(style.fontSize || 18) * previewRenderScale}px`,
                                  fontWeight: restWordStyle.fontWeight || style.fontWeight || 'normal',
                                  fontStyle: restWordStyle.fontStyle || style.fontStyle || 'normal',
                                  textDecoration: restWordStyle.textDecoration || style.textDecoration || 'none',
                                  textTransform: restWordStyle.textTransform || style.textTransform || 'none',
                                  color: restWordStyle.color || style.color || '#ffffff',
                                  padding: restWordStyle.backgroundPadding ? `${restWordStyle.backgroundPadding}px` : (isWordClicked ? '2px 4px' : undefined),
                                  whiteSpace: 'pre',
                                  ...(style.hasStroke ? { WebkitTextStroke: `${style.strokeWidth || 1}px ${style.strokeColor || '#000000'}` } : {}),
                                  ...(style.hasShadow ? { textShadow: `${style.shadowOffsetX || 0}px ${style.shadowOffsetY || 2}px ${style.shadowBlur || 4}px ${style.shadowColor || 'rgba(0,0,0,0.8)'}` } : {}),
                                  ...(restWordStyle.textGradient ? {
                                    background: restWordStyle.textGradient,
                                    backgroundImage: restWordStyle.textGradient,
                                    backgroundSize: '100% 100%',
                                    backgroundRepeat: 'no-repeat',
                                    backgroundPosition: 'center',
                                    WebkitBackgroundClip: 'text',
                                    backgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    color: 'transparent',
                                  } : {}),
                                }}
                              >
                                {part}
                              </span>
                            </span>
                          </span>
                        </span>
                      );
                    })}
                  </div>
                )}
              {/* Action buttons below the bounding box */}
              {selectedCaptionId === element.id && !isEditingThis && (
                <div
                  className="absolute left-1/2 top-full z-50 mt-3.5 flex -translate-x-1/2 items-center gap-2"
                  style={{ pointerEvents: 'auto' }}
                  data-video-control
                >
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-full border border-[#d8d2e8] bg-white text-[#4f4f5a] shadow-[0_2px_5px_rgba(15,15,20,0.16)] transition-transform hover:scale-105"
                    style={{ cursor: 'grab' }}
                    onPointerDown={(e) => handleTextElementRotateStart(e, element.id, style)}
                    title="Rotate text"
                    data-video-control
                  >
                    <RotateCw className="h-3.5 w-3.5 text-[#4f4f5a]" strokeWidth={2} />
                  </span>
                  <span
                    className="text-element-move-btn flex h-6 w-6 items-center justify-center rounded-full border border-[#d8d2e8] bg-white text-[#4f4f5a] shadow-[0_2px_5px_rgba(15,15,20,0.16)] transition-transform hover:scale-105"
                    style={{ cursor: 'move' }}
                    onPointerDown={(e) => {
                      handleTextElementMouseDown(e, element.id, style);
                    }}
                    title="Move text"
                    data-video-control
                  >
                    <Move className="h-3.5 w-3.5 text-[#4f4f5a]" strokeWidth={2} />
                  </span>
                </div>
              )}
              </div>
              </div>
            );
          })}

          <div
            className="absolute left-1/2 bottom-3 z-40 w-[82%] max-w-[248px] -translate-x-1/2"
            data-video-control
          >
            <Slider
              value={[localScrubTime ?? currentTime]}
              max={duration || 100}
              step={0.1}
              onValueChange={([val]) => {
                isScrubbingRef.current = true;
                setLocalScrubTime(val);
              }}
              onValueCommit={([val]) => {
                isScrubbingRef.current = false;
                setLocalScrubTime(null);
                if (videoRef.current) videoRef.current.currentTime = val;
                setCurrentTime(val);
              }}
              className="cursor-pointer"
              trackClassName="h-[4px] bg-white/24"
              rangeClassName="h-[4px] bg-white"
              thumbClassName="h-3 w-3 border border-white bg-[#050505] shadow-[0_0_0_1.5px_#ffffff,0_0_0_3px_rgba(5,5,5,0.82),0_5px_12px_rgba(0,0,0,0.24)]"
            />
          </div>

          {/* Word Click Popup — REMOVED FROM HERE, rendered outside overflow-hidden below */}

          </div>
        </div>
      </div>

      <div className={`${isVideoFullscreen ? 'mt-3' : 'mt-3'} space-y-3 px-2`}>
        <div className="mx-auto lekha-glass-chip rounded-full px-2.5 py-1.5 flex w-fit items-center gap-2.5">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleVideoSurfaceToggle}
              className="h-7 w-7 rounded-full hover:bg-white/10 text-white"
              data-video-control="true"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </Button>

            <div className="flex items-center gap-2 group">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMuted(!isMuted)}
                className="h-7 w-7 text-gray-400 hover:text-white hover:bg-white/10"
              >
                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </Button>
              <div className="w-0 overflow-hidden group-hover:w-24 pl-2 transition-all duration-300 ease-in-out">
                <Slider
                  value={[isMuted ? 0 : volume]}
                  max={1}
                  step={0.05}
                  onValueChange={([val]) => {
                    setVolume(val);
                    if (val > 0) setIsMuted(false);
                  }}
                  className="w-20 cursor-pointer py-4"
                />
              </div>
            </div>
          </div>

          <span className="text-xs text-white font-mono tabular-nums">
            {formatTime(currentTime)}
          </span>
          <span className="text-[10px] text-slate-600 font-mono">/</span>
          <span className="text-[10px] text-slate-500 font-mono tabular-nums">
            {formatTime(duration || 0)}
          </span>
        </div>
      </div>

      {/* Word Click Popup — moved to Dashboard.jsx root level */}

      {/* Animation keyframes */}
      <style>{`
        @keyframes rise {
          0% { transform: translateY(20px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes pan {
          0% { transform: translateX(-30px); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }
        @keyframes fade {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes pop {
          0% { transform: scale(0.5); opacity: 0; }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes wipe {
          0% { clip-path: inset(0 100% 0 0); }
          100% { clip-path: inset(0 0 0 0); }
        }
        @keyframes blur {
          0% { filter: blur(10px); opacity: 0; }
          100% { filter: blur(0); opacity: 1; }
        }
        @keyframes succession {
          0% { transform: translateY(-10px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes breathe {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.9; }
        }
        @keyframes baseline {
          0% { transform: translateY(5px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes drift {
          0% { transform: translate(-10px, -10px); opacity: 0; }
          100% { transform: translate(0, 0); opacity: 1; }
        }
        @keyframes tectonic {
          0% { transform: translateX(-20px) rotate(-5deg); opacity: 0; }
          100% { transform: translateX(0) rotate(0); opacity: 1; }
        }
        @keyframes tumble {
          0% { transform: rotate(-180deg) scale(0.5); opacity: 0; }
          100% { transform: rotate(0) scale(1); opacity: 1; }
        }
        /* Word-level keyframes — include translate(-50%,-50%) in every step
           to preserve the inner span's centering transform */
        @keyframes word-rise {
          0% { transform: translate(-50%, calc(-50% + 20px)); opacity: 0; }
          100% { transform: translate(-50%, -50%); opacity: 1; }
        }
        @keyframes word-pan {
          0% { transform: translate(calc(-50% - 30px), -50%); opacity: 0; }
          100% { transform: translate(-50%, -50%); opacity: 1; }
        }
        @keyframes word-pop {
          0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
          50% { transform: translate(-50%, -50%) scale(1.1); }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
        @keyframes word-succession {
          0% { transform: translate(-50%, calc(-50% - 10px)); opacity: 0; }
          100% { transform: translate(-50%, -50%); opacity: 1; }
        }
        @keyframes word-breathe {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          50% { transform: translate(-50%, -50%) scale(1.05); opacity: 0.9; }
        }
        @keyframes word-baseline {
          0% { transform: translate(-50%, calc(-50% + 5px)); opacity: 0; }
          100% { transform: translate(-50%, -50%); opacity: 1; }
        }
        @keyframes word-drift {
          0% { transform: translate(calc(-50% - 10px), calc(-50% - 10px)); opacity: 0; }
          100% { transform: translate(-50%, -50%); opacity: 1; }
        }
        @keyframes word-tectonic {
          0% { transform: translate(calc(-50% - 20px), -50%) rotate(-5deg); opacity: 0; }
          100% { transform: translate(-50%, -50%) rotate(0); opacity: 1; }
        }
        @keyframes word-tumble {
          0% { transform: translate(-50%, -50%) rotate(-180deg) scale(0.5); opacity: 0; }
          100% { transform: translate(-50%, -50%) rotate(0) scale(1); opacity: 1; }
        }
        @keyframes source-word-rise {
          0% { transform: translateY(20px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes source-word-pan {
          0% { transform: translateX(-30px); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }
        @keyframes source-word-fade {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes source-word-pop {
          0% { transform: scale(0.5); opacity: 0; }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes source-word-wipe {
          0% { clip-path: inset(0 100% 0 0); }
          100% { clip-path: inset(0 0 0 0); }
        }
        @keyframes source-word-blur {
          0% { filter: blur(10px); opacity: 0; }
          100% { filter: blur(0); opacity: 1; }
        }
        @keyframes source-word-succession {
          0% { transform: translateY(-10px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes source-word-breathe {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.9; }
        }
        @keyframes source-word-baseline {
          0% { transform: translateY(5px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes source-word-drift {
          0% { transform: translate(-10px, -10px); opacity: 0; }
          100% { transform: translate(0, 0); opacity: 1; }
        }
        @keyframes source-word-tectonic {
          0% { transform: translateX(-20px) rotate(-5deg); opacity: 0; }
          100% { transform: translateX(0) rotate(0); opacity: 1; }
        }
        @keyframes source-word-tumble {
          0% { transform: rotate(-180deg) scale(0.5); opacity: 0; }
          100% { transform: rotate(0) scale(1); opacity: 1; }
        }
        /* ── Advanced – Basic ── */
        @keyframes zoom_in {
          0% { transform: scale(0.65); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes zoom_out {
          0% { transform: scale(1.35); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes fade_in {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes slide_up {
          0% { transform: translateY(34px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes slide_down {
          0% { transform: translateY(-34px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes slide_left {
          0% { transform: translateX(44px); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }
        @keyframes slide_right {
          0% { transform: translateX(-44px); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }
        @keyframes fadeInUp {
          0% { transform: translateY(22px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes fadeInDown {
          0% { transform: translateY(-22px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes slideInRight {
          0% { transform: translateX(40px); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }
        @keyframes flipInX {
          0% { transform: perspective(500px) rotateX(-90deg); opacity: 0; }
          100% { transform: perspective(500px) rotateX(0); opacity: 1; }
        }
        @keyframes flipInY {
          0% { transform: perspective(500px) rotateY(-90deg); opacity: 0; }
          100% { transform: perspective(500px) rotateY(0); opacity: 1; }
        }
        @keyframes blurIn {
          0% { filter: blur(14px); opacity: 0; }
          100% { filter: blur(0); opacity: 1; }
        }
        @keyframes zoomInFade {
          0% { transform: scale(0.65); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes bounceInUp {
          0%   { transform: translateY(32px); opacity: 0; }
          60%  { transform: translateY(-8px); opacity: 1; }
          80%  { transform: translateY(4px); }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes skewLeft {
          0% { transform: translateX(-30px) skewX(20deg); opacity: 0; }
          100% { transform: translateX(0) skewX(0deg); opacity: 1; }
        }
        /* ── Advanced – Kinetic ── */
        @keyframes missile {
          0%   { transform: translateX(-60px) scaleX(0.6); opacity: 0; }
          65%  { transform: translateX(6px) scaleX(1.04); opacity: 1; }
          100% { transform: translateX(0) scaleX(1); opacity: 1; }
        }
        @keyframes shockwave {
          0%   { transform: scale(1.6); opacity: 0; filter: blur(6px); }
          55%  { transform: scale(0.94); opacity: 1; filter: blur(0); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes typewriter {
          0%   { clip-path: inset(0 100% 0 0); }
          100% { clip-path: inset(0 0% 0 0); }
        }
        @keyframes slamDown {
          0%   { transform: translateY(-55px) scaleY(1.2); opacity: 0; }
          65%  { transform: translateY(6px) scaleY(0.94); opacity: 1; }
          100% { transform: translateY(0) scaleY(1); opacity: 1; }
        }
        @keyframes fireCharge {
          0%   { transform: translateY(18px) scaleX(0.8); opacity: 0; filter: blur(5px); }
          70%  { transform: translateY(-4px) scaleX(1.02); opacity: 1; filter: blur(0); }
          100% { transform: translateY(0) scaleX(1); opacity: 1; }
        }
        @keyframes stampede {
          0%   { transform: translateX(-55px) scaleX(1.1); opacity: 0; }
          70%  { transform: translateX(5px) scaleX(0.98); opacity: 1; }
          100% { transform: translateX(0) scaleX(1); opacity: 1; }
        }
        @keyframes recoil {
          0%   { transform: translateX(0); opacity: 1; }
          20%  { transform: translateX(-10px); }
          60%  { transform: translateX(4px); }
          100% { transform: translateX(0); opacity: 1; }
        }
        /* ── Advanced – Cinematic ── */
        @keyframes irisOpen {
          0%   { clip-path: circle(0% at 50% 50%); opacity: 0.4; }
          100% { clip-path: circle(150% at 50% 50%); opacity: 1; }
        }
        @keyframes parallaxRise {
          0%   { transform: translateY(14px) scale(0.97); opacity: 0; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes goldenRatio {
          0%   { transform: scaleX(0.618) translateX(-20px); opacity: 0; }
          100% { transform: scaleX(1) translateX(0); opacity: 1; }
        }
        @keyframes curtainSplit {
          0%   { clip-path: inset(0 50% 0 50%); opacity: 0.5; }
          100% { clip-path: inset(0 0% 0 0%); opacity: 1; }
        }
        @keyframes prestige {
          0%   { transform: scale(1.1); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes fadeThroughBlack {
          0%   { opacity: 1; }
          35%  { opacity: 0; }
          65%  { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes depthPull {
          0%   { transform: scale(0.35); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes slowBurn {
          0%   { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes diagonalWipe {
          0%   { clip-path: inset(0 100% 100% 0); }
          100% { clip-path: inset(0 0% 0% 0); }
        }
        /* ── Advanced – Playful ── */
        @keyframes confettiPop {
          0%   { transform: scale(0.3) rotate(-12deg); opacity: 0; }
          55%  { transform: scale(1.15) rotate(3deg); opacity: 1; }
          75%  { transform: scale(0.95) rotate(-1deg); }
          100% { transform: scale(1) rotate(0); opacity: 1; }
        }
        @keyframes stickerSlap {
          0%   { transform: scale(1.45) rotate(-6deg); opacity: 0; }
          45%  { transform: scale(0.94) rotate(1deg); opacity: 1; }
          75%  { transform: scale(1.02) rotate(0); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes wobbleEntry {
          0%   { transform: translateX(-22px) rotate(-4deg); opacity: 0; }
          35%  { transform: translateX(9px) rotate(2deg); opacity: 1; }
          65%  { transform: translateX(-4px) rotate(-1deg); }
          100% { transform: translateX(0) rotate(0); opacity: 1; }
        }
        @keyframes balloonFloat {
          0%   { transform: translateY(22px) scale(0.8); opacity: 0; }
          65%  { transform: translateY(-6px) scale(1.03); opacity: 1; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes colorSplash {
          0%   { transform: scale(0.85); opacity: 0; filter: saturate(3) brightness(1.6); }
          50%  { transform: scale(1.06); opacity: 1; filter: saturate(2) brightness(1.3); }
          100% { transform: scale(1); opacity: 1; filter: saturate(1) brightness(1); }
        }
      `}</style>

    </div>
    {selectedDetachedWordEditor}
    </>
  );
}
