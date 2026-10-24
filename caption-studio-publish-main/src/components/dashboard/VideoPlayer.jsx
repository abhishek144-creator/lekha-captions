import TextElementLayer from './TextElementLayer'
import { useCanvasTextEditing } from './useCanvasTextEditing'
import { useCanvasTransforms } from './useCanvasTransforms'
import { useWordGestures } from './useWordGestures'
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Play, X, Move, RotateCw, RotateCcw } from 'lucide-react';
import { clearPopupWordStyle } from '@/lib/wordStyleEdits';
import CanvasToolRail from './CanvasToolRail';
import SelectedWordOutline from './SelectedWordOutline';
import PlaybackControls from './PlaybackControls';
import PreviewScrubber from './PreviewScrubber';

import { createLiveScrubber } from './liveScrub';
import { DESKTOP_EDITOR_QUERY, useMediaQuery } from '@/hooks/useMediaQuery';
import VideoPlayerKeyframes from './VideoPlayerKeyframes';
import { resolveScriptFont, loadGoogleFont } from './fontUtils';
import { buildEmotionalCaptionPlan } from './emotionalTemplateUtils';
import { getWordBackgroundFill, getWordPaintStyle } from '@/lib/wordPaint';
import { DEFAULT_CAPTION_POSITION_Y } from '../../lib/captionDefaults.js';
import {
  ADVANCED_TEMPLATE_EMPHASIS_COLORS,
  getOriginalTemplateBlockType,
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
  splitCaptionWordTokens,
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
  AppliedAdvancedTemplateCaption,
  MemoizedVideo,
  getAnimationStyle,
  getWordAnimationStyle,
  getCptWordMotionStyle,
  renderWordTextContent,
  renderAnimatedDetachedWordContent,
} from './videoPlayerTemplateRendering.jsx';


// Phones and tablets lay the preview frame out at the export template
// renderer's CSS reference size (render_template_overlay.mjs sizes captions
// as if the preview were 360px wide) and scale the whole frame to fit, so
// every caption renderer - plain, basic, advanced and LC - keeps its export
// proportions on any screen.
// Emphasis makes a word at least bold but never lighter than the caption:
// an Extra Bold caption keeps its emphasised word Extra Bold, as the export does.
const emphasisFontWeight = (weight) => Math.max(700, Number(weight) || 0);

const COMPACT_PREVIEW_REFERENCE_WIDTH = 360;
const COMPACT_PREVIEW_REFERENCE_HEIGHT = 640;

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
  const emotionalCaptionPlan = React.useMemo(() => {
    const markup = captionStyle?.template_markup || captionStyle?.template_snapshot?.template_markup || '';
    return new Map(
      buildEmotionalCaptionPlan(captions, waveformData, duration, markup)
        .map((entry) => [entry.captionId, entry]),
    );
  }, [captions, waveformData, duration, captionStyle?.template_markup, captionStyle?.template_snapshot?.template_markup]);
  const [draggingWord, setDraggingWord] = useState(null)
  const [resizingWord, setResizingWord] = useState(null)

  const captionRef = useRef(null);
  const videoContainerRef = useRef(null);
  const currentDragCoordinates = useRef(null);
  const lastDragDropTime = useRef(0);
  const wordResizeActiveRef = useRef(false);
  const inputRef = useRef(null);
  // Saves an open canvas text edit; set once the editing hook exists (below).
  const commitOpenEditRef = useRef(null);
  // Scrubber drags seek live (one seek in flight at a time) so the frame and
  // captions follow the thumb; playback pauses during the drag.
  const liveScrubRef = useRef(null);
  if (!liveScrubRef.current) {
    liveScrubRef.current = createLiveScrubber(() => videoRef.current);
  }
  const resumeAfterScrubRef = useRef(false);

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
  const isCompactPreview = !useMediaQuery(DESKTOP_EDITOR_QUERY);

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

  const frameStageRef = useRef(null);
  const [compactFitScale, setCompactFitScale] = useState(0);
  React.useLayoutEffect(() => {
    if (!isCompactPreview || isVideoFullscreen) {
      setCompactFitScale(0);
      return undefined;
    }
    const stage = frameStageRef.current;
    if (!stage) return undefined;
    const syncFit = () => {
      const styles = window.getComputedStyle(stage);
      const width = stage.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight) - 8;
      const height = stage.clientHeight - parseFloat(styles.paddingTop) - parseFloat(styles.paddingBottom);
      if (width <= 0 || height <= 0) return;
      const next = Math.min(width / COMPACT_PREVIEW_REFERENCE_WIDTH, height / COMPACT_PREVIEW_REFERENCE_HEIGHT);
      setCompactFitScale(prev => (Math.abs(prev - next) < 0.001 ? prev : next));
    };
    syncFit();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(syncFit) : null;
    observer?.observe(stage);
    return () => observer?.disconnect();
  }, [isCompactPreview, isVideoFullscreen, videoUrl]);
  const compactFit = isCompactPreview && !isVideoFullscreen && compactFitScale > 0 ? compactFitScale : 0;

  // Caption lengths are CSS px on the export renderers' 360px-wide reference
  // frame (render_template_overlay.mjs exportCssScale, ass_style.py
  // scale_factor). Scaling them by the canvas width keeps every line, word
  // size and gap in the export's proportions at any canvas size; a fixed 1
  // let desktop lines drift whenever the canvas was not exactly 360px wide.
  // Phones lay the frame out at 360px and scale it whole, so they get 1.
  const getPreviewRenderScale = useCallback(() => {
    const currentWidth = canvasSize.width || videoContainerRef.current?.offsetWidth || 0;
    if (!currentWidth) return 1;
    return currentWidth / COMPACT_PREVIEW_REFERENCE_WIDTH;
  }, [canvasSize.width]);

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
  // Each signal is a new { time } object, so repeating the same seek still runs.
  useEffect(() => {
    if (!videoRef.current || seekSignal === null || seekSignal === undefined) return;
    const time = Number(typeof seekSignal === 'object' ? seekSignal.time : seekSignal);
    if (Number.isFinite(time)) videoRef.current.currentTime = time;
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
            const activeCaption = (captions || []).find(c => (
              c && !c.isTextElement
              && typeof c.start_time === 'number' && typeof c.end_time === 'number'
              && currentTime >= c.start_time && currentTime < c.end_time
            ));
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
    if (videoRef.current) {
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
    // Save an open text edit before playback can move its box off screen
    // (also when the source is unavailable and nothing will play).
    if (!videoRef.current || videoRef.current.paused) commitOpenEditRef.current?.();
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

  // A text box being edited stays on screen even outside its time: removing a
  // focused editable never fires blur, so the typed text was silently lost.
  const getActiveTextElements = (editingId = null) => {
    if (!captions || captions.length === 0) return [];
    return captions.filter(cap =>
      cap &&
      cap.isTextElement &&
      (cap.id === editingId || (
        typeof cap.start_time === 'number' &&
        typeof cap.end_time === 'number' &&
        currentTime >= cap.start_time &&
        currentTime < cap.end_time
      ))
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
    // Through a ref: the gesture handler is created later in this render and
    // a captured copy went stale (old canvas size, old selected word).
    handleWordMouseDownRef.current?.({
      preventDefault: () => event.preventDefault(),
      stopPropagation: () => event.stopPropagation(),
      clientX: startClientX ?? event.clientX,
      clientY: startClientY ?? event.clientY,
      pointerId: event.pointerId,
      currentTarget: node,
    }, caption, wordIndex, false, false, 'source-template');
  }, [setSelectedCaptionId]);

  const activeCaptions = getActiveCaptions();


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
  // Word by word: the whole video (Display Mode) or one caption (its look,
  // revealMode 'word' from the layout director or the caption's Motion choice).
  const shouldRevealSequentially = (caption) => (
    !isCaptionWordEditingActive(caption)
    && isPlaying
    && (captionStyle?.show_inactive === false || caption?.revealMode === 'word')
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
      { activePhase: selectedPhase, settled: false, impWordIndex, impWordIndices, emphasisChosen: !!emotional?.emphasisChosen },
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
    const words = splitCaptionWordTokens(caption.text).map((token) => token.word);
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
        fontWeight: emphasisFontWeight(ws.fontWeight || captionStyle?.font_weight),
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
            ...(getWordBackgroundFill(ws) ? {
              background: getWordBackgroundFill(ws),
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

    const words = splitCaptionWordTokens(liveCaption.text).map((token) => token.word);
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

  // A selected word that is still inside its caption/template (template words
  // move as offsets and never detach) is framed by SelectedWordOutline.
  const selectedInlineWordKey = !selectedDetachedWord && wordPopup?.caption && wordPopup?.type !== 'element'
    ? `${wordPopup.caption.id}-${wordPopup.wordIndex}`
    : '';
  const selectedInlineCaption = selectedInlineWordKey
    ? captions?.find(c => c.id === wordPopup.caption.id) || null
    : null;
  const writeSelectedInlineWordStyle = (producer) => {
    if (!selectedInlineCaption) return;
    const captionUpdater = setCaptionsRaw || setCaptions;
    captionUpdater(prev => prev.map((c) => (c.id !== selectedInlineCaption.id ? c : {
      ...c,
      wordStyles: {
        ...(c.wordStyles || {}),
        [selectedInlineWordKey]: producer(c.wordStyles?.[selectedInlineWordKey] || {}),
      },
    })));
  };
  const resetSelectedInlineWord = () => {
    if (!wordPopup) return;
    if (addToHistory) addToHistory();
    (setCaptionsRaw || setCaptions)(prev => clearPopupWordStyle(prev, wordPopup));
  };

  // Handle individual word OR element word style updates
  const { isEditing, setIsEditing, editInitialText, setEditText, handleCaptionDoubleClick, handleEditComplete, handleEditKeyDown, handleEditInput } = useCanvasTextEditing({
    setCaptions,
    inputRef,
  })

  // Starting playback saves an open text edit (caption or text box). The edit
  // otherwise only saved on blur, which a play button that keeps focus, the
  // Space shortcut or the box leaving its time never fired.
  commitOpenEditRef.current = () => {
    if (isEditing) handleEditComplete(isEditing)
  }
  useEffect(() => {
    if (isPlaying && isEditing) commitOpenEditRef.current()
  }, [isPlaying, isEditing])

  const getPositionStyle = () => {
    const posY = captionStyle?.position_y ?? DEFAULT_CAPTION_POSITION_Y;
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

  const handleWordMouseDownRef = useRef(null);
  const { handleWordMouseDown, handleDetachedWordResizeStart, handleDetachedWordRotateStart, handleSelectedDetachedWordDelete } = useWordGestures({
    selectedDetachedWord,
    setDraggingWord,
    setResizingWord,
    setCaptions,
    wordResizeActiveRef,
    addToHistory,
    videoContainerRef,
    getSelectedDetachedWordViewport: () => selectedDetachedWordViewport,
    previewRenderScale,
    setCaptionsRaw,
    isPlayingRef,
    videoRef,
    setIsPlaying,
    getWordRenderOffset,
    captionStyle,
    currentDragCoordinates,
    canvasSize,
    fitCanvasSizeRef,
    setSnapGuides,
    setCptWordGuides,
    lastDragDropTime,
  })
  handleWordMouseDownRef.current = handleWordMouseDown;

  const { isDragging, draggedElementId, resizedElementId, isResizing, handleMouseDown, handleResizeMouseDown, handleTextElementMouseDown, handleTextElementResizeDown, handleTextElementRotateStart } = useCanvasTransforms({
    setCaptionStyle,
    draggingWord,
    addToHistory,
    captionStyle,
    setCaptions,
    captions,
    captionRef,
    setSnapGuides,
    setCaptionStyleRaw,
    videoRef,
    videoContainerRef,
    setCaptionsRaw,
    previewRenderScale,
  })

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
        fontWeight: emphasisFontWeight(selectedWordStyle.fontWeight || captionStyle?.font_weight),
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
          ...(!selectedWordIsPending && getWordBackgroundFill(selectedWordStyle) ? {
            background: getWordBackgroundFill(selectedWordStyle),
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
        {/* On a short word the hit areas overlap. Corner (font size) handles sit
            above the side (box width) handles so their visible dots resize the
            word instead of stretching its box. */}
        {[
          { classes: '-top-3 -left-3 z-[96] h-6 w-6 cursor-nwse-resize', axis: 'corner', sideX: 'left', sideY: 'top' },
          { classes: '-top-3 -right-3 z-[96] h-6 w-6 cursor-nesw-resize', axis: 'corner', sideX: 'right', sideY: 'top' },
          { classes: '-bottom-3 -left-3 z-[96] h-6 w-6 cursor-nesw-resize', axis: 'corner', sideX: 'left', sideY: 'bottom' },
          { classes: '-bottom-3 -right-3 z-[96] h-6 w-6 cursor-nwse-resize', axis: 'corner', sideX: 'right', sideY: 'bottom' },
          { classes: 'top-1/2 -left-3 z-[95] h-4 w-6 -translate-y-1/2 cursor-ew-resize', axis: 'horizontal', sideX: 'left' },
          { classes: 'top-1/2 -right-3 z-[95] h-4 w-6 -translate-y-1/2 cursor-ew-resize', axis: 'horizontal', sideX: 'right' },
        ].map((handle) => (
          <span
            key={handle.classes}
            onPointerDown={handleDetachedWordResizeStart}
            onDragStart={(e) => e.preventDefault()}
            className={`word-resize-handle absolute flex items-center justify-center rounded-full bg-transparent ${handle.classes}`}
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
                  pointerId: e.pointerId,
                  currentTarget: selectionBox,
                }, selectedDetachedWord.caption, selectedDetachedWord.wordIndex, false, true, 'action-move');
              }}
              title="Move word"
              data-video-control
            >
              <Move className="h-3 w-3" strokeWidth={1.9} />
            </span>
            {/* In the action row: the top-right corner dot would sit on top of it. */}
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded-full border border-[#d8d2e8] bg-white text-[#4f4f5a] shadow-[0_2px_5px_rgba(15,15,20,0.16)] transition-transform hover:scale-105"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSelectedDetachedWordDelete();
              }}
              title="Reset word (position, size, colour and effects)"
              aria-label="Reset word"
              data-video-control
            >
              <RotateCcw className="h-3 w-3" strokeWidth={1.9} />
            </button>
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
      <div ref={frameStageRef} className={`relative flex-1 rounded-xl overflow-visible flex items-center justify-center min-h-0 ${isVideoFullscreen ? 'pt-0 pb-2' : 'pt-3 pb-1 lg:pt-4 lg:pb-3'}`}>
        {/* Floating canvas tool rail beside the preview */}
        {setIsVideoFullscreen && (
          <CanvasToolRail
            isVideoFullscreen={isVideoFullscreen}
            guidesActive={showCornerGuides || showLayoutGuides}
            onToolClick={handleCanvasToolClick}
            onToggleFullscreen={toggleVideoFullscreen}
          />
        )}
        {/* Zoom level badge — only visible when zoomed */}
        {canvasScale !== 1 && (
          <div className="absolute top-2 left-2 z-50 px-1.5 py-0.5 rounded bg-black/60 text-white/70 text-[10px] tabular-nums backdrop-blur-sm">
            {Math.round(canvasScale * 100)}%
          </div>
        )}
        <div
          className={`relative inline-flex max-w-full overflow-visible ${isVideoFullscreen ? 'scale-[1.02]' : 'max-lg:h-full'}`}
          style={{
            transition: 'transform 0.1s ease',
            ...(compactFit ? {
              width: `${COMPACT_PREVIEW_REFERENCE_WIDTH * compactFit}px`,
              height: `${COMPACT_PREVIEW_REFERENCE_HEIGHT * compactFit}px`,
            } : {}),
          }}
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
          className={`lekha-video-frame relative aspect-[9/16] touch-none select-none bg-black shadow-[0_35px_120px_rgba(0,0,0,0.72)] ${isVideoFullscreen ? 'h-auto max-h-[calc(100dvh-92px)]' : 'h-full max-lg:max-h-full lg:max-h-[calc(100dvh-296px)]'}`}
            style={{
              transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${canvasScale * (compactFit || 1)})`,
              transformOrigin: compactFit ? 'top left' : 'center center',
              ...(compactFit ? {
                position: 'absolute',
                top: 0,
                left: 0,
                width: `${COMPACT_PREVIEW_REFERENCE_WIDTH}px`,
                height: `${COMPACT_PREVIEW_REFERENCE_HEIGHT}px`,
                maxHeight: 'none',
              } : {}),
              transition: isCanvasPanning || compactFit ? 'none' : 'transform 0.1s ease',
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
              <div className="absolute top-3 left-3 z-40 hidden lg:flex items-center gap-2">
                <span className="rounded bg-black/75 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-white">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-white mr-1" /> Rec
                </span>
              </div>
              <div className="absolute top-3 right-3 z-40 hidden lg:block rounded bg-black/75 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-white">
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
                  top: `${captionStyle?.position_y ?? DEFAULT_CAPTION_POSITION_Y}%`,
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

                  {/* Delete button for the selected/hovered main caption line. It
                      sits above the box: at the corner the top-right resize
                      handle covered it. Near the top of the frame it goes below
                      the box so the preview cannot clip it. */}
                  {setCaptions && !isEditingThis && !hasDetachedWords && (
                    <button
                      type="button"
                      className={`absolute ${Number(caption?.position_y ?? captionStyle?.position_y ?? DEFAULT_CAPTION_POSITION_Y) < 20 ? 'top-full mt-3' : '-top-10'} -right-3 z-[60] flex h-7 w-7 cursor-pointer touch-manipulation items-center justify-center rounded-full border border-white/30 bg-zinc-900 text-white shadow-xl transition-colors hover:border-red-400 hover:bg-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${selectedCaptionId === caption.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                      }}
                      onClick={handleDeleteCaptionLine}
                      aria-label="Delete caption line"
                      title="Delete caption line"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Keep resize hit areas outside the text. Authored template
                      glyphs can extend past their line box; an edge handle
                      there otherwise intercepts a word drag. */}
                  {setCaptionStyle && !isEditingThis && !hasDetachedWords && !isSidebarTemplate && (
                    <>
                      {[
                        ['top-left', '-left-4 -top-4 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize'],
                        ['top', 'left-1/2 -top-4 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize'],
                        ['top-right', '-right-4 -top-4 -translate-y-1/2 translate-x-1/2 cursor-nesw-resize'],
                        ['left', '-left-4 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize'],
                        ['right', '-right-4 top-1/2 -translate-y-1/2 translate-x-1/2 cursor-ew-resize'],
                        ['bottom-left', '-bottom-4 -left-4 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize'],
                        ['bottom', '-bottom-4 left-1/2 -translate-x-1/2 translate-y-1/2 cursor-ns-resize'],
                        ['bottom-right', '-bottom-4 -right-4 translate-x-1/2 translate-y-1/2 cursor-nwse-resize'],
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
                      {editInitialText}
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
                              keyframeFontPx={scaleTemplateFontSize(captionStyle?.font_size) * previewRenderScale}
                              onSourceWordClick={openSourceTemplateWordPopup}
                              onSourceWordPointerDown={startSourceTemplateWordDrag}
                              isSelected={selectedCaptionId === caption.id}
                            />
                          );
                        }

                        const wordTokens = isBasicSourceTemplate
                          ? basicTemplateWords.map((word) => ({ word, lineBreakAfter: false }))
                          : splitCaptionWordTokens(caption.text);
                        const words = wordTokens.map((token) => token.word);
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

                          const wordSpan = (
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
                              {wordIndex < arr.length - 1 && !wordTokens[wordIndex]?.lineBreakAfter ? ' ' : ''}
                            </span>
                          );
                          return wordTokens[wordIndex]?.lineBreakAfter
                            ? <React.Fragment key={`${wordIndex}-break`}>{wordSpan}<br /></React.Fragment>
                            : wordSpan;
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
                        const sidebarWordTokens = splitCaptionWordTokens(caption.text);
                        const sidebarWords = sidebarWordTokens.map((token) => token.word);
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
                        const isPastSidebarWord = sidebarTemplateActive && wordIndex < sidebarCurrentIdx;
                        const isCurrentSidebarWord = sidebarTemplateActive && wordIndex === sidebarCurrentIdx;
                        // Every word keeps a slot at the caption's base size, so
                        // enlarging or emphasising one word never moves the others:
                        // the bigger text is painted centred on its slot (the owner's
                        // design; the export renderer mirrors it). In-line slots still
                        // follow an explicitly chosen font family/weight/style.
                        const layoutFontSize = baseFontSize
                        const layoutTypography = detached ? {} : {
                          fontFamily: ws.fontFamily || 'inherit',
                          fontWeight: ws.fontWeight || (isCurrentSidebarWord ? (captionStyle?.font_weight || '700') : 'inherit'),
                          fontStyle: ws.fontStyle || 'inherit',
                          textTransform: ws.textTransform || undefined,
                        }
                        const withLineBreak = (node) => (sidebarWordTokens[wordIndex]?.lineBreakAfter
                          ? <React.Fragment key={`${wordIndex}-break`}>{node}<br /></React.Fragment>
                          : node);
                        if (detached) {
                          return withLineBreak(
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
                        // The spacer follows typography; motion stays out of line layout.

                        // Emphasis: bold + 1.2x scale + configured accent color + subtle glow
                        const emphasisAccent = captionStyle?.secondary_color || '#DDAA03';
                        const emphasisStyle = ws.isEmphasis ? {
                          fontWeight: emphasisFontWeight(ws.fontWeight || captionStyle?.font_weight),
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
                              lineHeight: captionStyle?.line_spacing || 1.4,
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
                                ...(getWordBackgroundFill(ws) ? {
                                  borderRadius: '3px',
                                  padding: `${(ws.backgroundPadding || 2) * previewRenderScale}px ${4 * previewRenderScale}px`,
                                } : {}),
                                ...computeWordEffectCSS(ws),
                                ...emphasisStyle,
                                // Background, highlight gradient and text gradient
                                // combine exactly as the export renders them.
                                ...getWordPaintStyle(ws),
                              }}
                            >
                              <span style={{ display: 'inline-block', ...resolvedWordMotionStyle }}>{word}</span>
                              {/* Selection outlines the painted word, which may be larger than its slot. */}
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
                            </span>
                            {/* Invisible spacer: holds the word's slot at the caption's base size */}
                            <span style={{ visibility: 'hidden', fontSize: `${layoutFontSize}px`, whiteSpace: 'pre', ...layoutTypography }}>
                              {word}
                            </span>
                          </span>
                        );

                        return withLineBreak(wordNode);
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

          <TextElementLayer
            activeTextElements={getActiveTextElements(isEditing)}
            isEditing={isEditing}
            setCaptions={setCaptions}
            selectedCaptionId={selectedCaptionId}
            setSelectedCaptionId={setSelectedCaptionId}
            wordPopup={wordPopup}
            setWordPopup={setWordPopup}
            setIsEditing={setIsEditing}
            setEditText={setEditText}
            draggedElementId={draggedElementId}
            previewRenderScale={previewRenderScale}
            handleTextElementMouseDown={handleTextElementMouseDown}
            handleCaptionDoubleClick={handleCaptionDoubleClick}
            handleTextElementResizeDown={handleTextElementResizeDown}
            inputRef={inputRef}
            handleEditInput={handleEditInput}
            handleEditComplete={handleEditComplete}
            handleEditKeyDown={handleEditKeyDown}
            editText={editInitialText}
            getWordRenderOffset={getWordRenderOffset}
            draggingWord={draggingWord}
            handleWordMouseDown={handleWordMouseDown}
            lastDragDropTime={lastDragDropTime}
            handleTextElementRotateStart={handleTextElementRotateStart}
          />          <PreviewScrubber
            value={localScrubTime ?? currentTime}
            duration={duration}
            onScrub={(val) => {
              if (localScrubTime === null) {
                resumeAfterScrubRef.current = isPlaying;
                if (isPlaying) setIsPlaying(false);
              }
              setLocalScrubTime(val);
              liveScrubRef.current.scrubTo(val);
            }}
            onCommit={(val) => {
              liveScrubRef.current.end();
              setLocalScrubTime(null);
              if (videoRef.current) videoRef.current.currentTime = val;
              setCurrentTime(val);
              if (resumeAfterScrubRef.current) setIsPlaying(true);
              resumeAfterScrubRef.current = false;
            }}
          />

          {/* Word Click Popup — REMOVED FROM HERE, rendered outside overflow-hidden below */}

          </div>
        </div>
      </div>

      {/* Phones use the mobile dock's transport bar instead, except in
          fullscreen where the dock is hidden. */}
      <div className={isVideoFullscreen ? '' : 'hidden lg:block'}>
      <PlaybackControls
        isPlaying={isPlaying}
        onTogglePlay={handleVideoSurfaceToggle}
        isMuted={isMuted}
        volume={volume}
        onToggleMute={() => setIsMuted(!isMuted)}
        onVolumeChange={(val) => {
          setVolume(val);
          if (val > 0) setIsMuted(false);
        }}
        currentTime={currentTime}
        duration={duration}
      />
      </div>

      {/* Word Click Popup — moved to Dashboard.jsx root level */}

      <VideoPlayerKeyframes />

    </div>
    {selectedDetachedWordEditor}
    <SelectedWordOutline
      containerRef={videoContainerRef}
      wordKey={selectedInlineWordKey}
      wordStyle={selectedInlineCaption?.wordStyles?.[selectedInlineWordKey] || {}}
      renderScale={previewRenderScale}
      onGestureStart={addToHistory}
      onWordStyleChange={writeSelectedInlineWordStyle}
      onMoveStart={(event, node) => {
        if (!selectedInlineCaption) return;
        startSourceTemplateWordDrag({ event, node, caption: selectedInlineCaption, wordIndex: wordPopup.wordIndex });
      }}
      onReset={resetSelectedInlineWord}
    />
    </>
  );
}
