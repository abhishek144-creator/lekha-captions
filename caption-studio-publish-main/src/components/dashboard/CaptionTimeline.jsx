import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

// RESTORED COMPACT DIMENSIONS
const TEXT_ROW_HEIGHT = 28;      // Increased from 22 for better visibility
const TEXT_ROWS = 6;             // Keeps your 6 text layers
const SPEECH_HEIGHT = 38;
const WAVEFORM_HEIGHT = 86;
const TOTAL_CONTENT_HEIGHT = (TEXT_ROWS * TEXT_ROW_HEIGHT) + SPEECH_HEIGHT + WAVEFORM_HEIGHT + 16;
const VISIBLE_HEIGHT = 135;
const HEADER_HEIGHT = 24;
const TEXT_TRACK_TOP = HEADER_HEIGHT + 12;
const SPEECH_TRACK_TOP = TEXT_TRACK_TOP + (TEXT_ROWS * TEXT_ROW_HEIGHT) + 20;
const AUDIO_TRACK_TOP = SPEECH_TRACK_TOP + SPEECH_HEIGHT + 18;
const TIMELINE_CANVAS_HEIGHT = AUDIO_TRACK_TOP + WAVEFORM_HEIGHT + 8;
const TRACK_LEFT = 48;
const TRACK_RIGHT = 4;

export default function CaptionTimeline({
  captions,
  duration,
  currentTime,
  selectedCaptionId,
  onSelectCaption,
  onSeek,
  setCaptions,
  setCaptionsRaw,
  addToHistory = () => { },
  waveformData = null,
  videoElement = null,
  isPlaying = false,
  setIsPlaying = (_) => { },
  timelineHeight = 200,
  collapsed = false,
  onToggleCollapsed = () => {},
}) {
  // Extract peak times from waveform for magnetic snapping
  const getWaveformPeaks = React.useCallback(() => {
    if (!waveformData || waveformData.length === 0 || !duration) return [];

    const peaks = [];
    const threshold = 0.4; // Minimum amplitude to consider a peak
    const minDistance = 5; // Minimum samples between peaks

    for (let i = 1; i < waveformData.length - 1; i++) {
      const prev = waveformData[i - 1];
      const curr = waveformData[i];
      const next = waveformData[i + 1];

      // Local maximum above threshold
      if (curr > prev && curr > next && curr > threshold) {
        // Check minimum distance from last peak
        if (peaks.length === 0 || i - peaks[peaks.length - 1].index >= minDistance) {
          const time = (i / waveformData.length) * duration;
          peaks.push({ index: i, time, amplitude: curr });
        }
      }
    }

    return peaks;
  }, [waveformData, duration]);

  const waveformPeaks = React.useMemo(() => getWaveformPeaks(), [getWaveformPeaks]);
  const [zoom, setZoom] = useState(3);
  const [scrollPos, setScrollPos] = useState(0);
  const timelineRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const scrubBoundsRef = useRef(null);
  const scrubRafRef = useRef(null);
  const pendingScrubClientXRef = useRef(null);

  // Custom High-Performance Timeline Scrubbing state
  const isScrubbingRef = useRef(false);
  const wasPlayingRef = useRef(false);
  const [localScrubTime, setLocalScrubTime] = useState(null);

  // Conditionally render the red playhead using either local Scrub or global Time
  const displayTime = localScrubTime !== null ? localScrubTime : currentTime;

  // Auto-pan offset (CSS transform based, does NOT touch scrollLeft/scrollbar)
  const [panOffset, setPanOffset] = useState(0);
  const prevTimeRef = useRef(0);

  const [draggingElement, setDraggingElement] = useState(null);
  const [dragType, setDragType] = useState(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartTime, setDragStartTime] = useState(0);
  const [snappedTime, setSnappedTime] = useState(null); // Visual feedback for snap

  const getPositionPercentage = (time) => {
    if (!duration || duration === 0) return 0;
    return (time / duration) * 100;
  };

  const formatTime = (seconds = 0) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const textElements = captions?.filter(c => c && c.isTextElement) || [];
  const regularCaptions = captions?.filter(c => c && !c.isTextElement) || [];

  // Assign text elements to rows (row 5 = bottom closest to speech, row 0 = top)
  const getTextElementRow = (index) => TEXT_ROWS - 1 - (index % TEXT_ROWS);

  // Auto-scroll vertically so the timeline reopens with speech visible and only
  // the lower half of the waveform showing by default.
  useEffect(() => {
    if (collapsed || !scrollContainerRef.current) return undefined;

    const timer = setTimeout(() => {
      if (!scrollContainerRef.current) return;

      const totalH = scrollContainerRef.current.scrollHeight;
      const visibleH = scrollContainerRef.current.clientHeight;
      const speechFirstTarget = Math.max(0, (AUDIO_TRACK_TOP + (WAVEFORM_HEIGHT * 0.52)) - visibleH);
      const maxScroll = Math.max(0, totalH - visibleH);
      const targetScroll = Math.min(maxScroll, speechFirstTarget);

      scrollContainerRef.current.scrollTop = targetScroll;
    }, 80);

    return () => clearTimeout(timer);
  }, [collapsed]);

  // Auto-pan timeline content to keep playhead visible (uses CSS transform, NOT scrollLeft)
  useEffect(() => {
    if (!scrollContainerRef.current || !timelineRef.current || !duration) return;

    const containerWidth = scrollContainerRef.current.offsetWidth;
    const timelineWidth = timelineRef.current.scrollWidth;
    const playheadX = (displayTime / duration) * timelineWidth;
    const userScroll = scrollContainerRef.current.scrollLeft;

    // Detect video loop (jumped from near end to start)
    const isLooping = prevTimeRef.current > duration - 1 && displayTime < 0.5;
    prevTimeRef.current = displayTime;

    if (isLooping) {
      setPanOffset(0);
      return;
    }

    // Calculate where the playhead is relative to the visible window (considering both scroll and pan)
    const visibleLeft = userScroll + panOffset;
    const visibleRight = visibleLeft + containerWidth;
    const relativeX = playheadX - visibleLeft;

    // If playhead is past 85% of visible area, pan forward
    if (relativeX > containerWidth * 0.85) {
      setPanOffset(playheadX - userScroll - containerWidth * 0.15);
    }
    // If playhead is before 15% of visible area, pan backward
    else if (relativeX < containerWidth * 0.15 && panOffset > 0) {
      setPanOffset(Math.max(0, playheadX - userScroll - containerWidth * 0.85));
    }
  }, [displayTime, duration]);

  // Global Magnetic Snapping Logic - Now includes waveform peaks!
  const getSnapTime = (targetTime, excludeElementId, allElements) => {
    const SNAP_THRESHOLD = 0.1; // Keep dragging smooth while bounds prevent overlap
    const WAVEFORM_SNAP_THRESHOLD = 0.05; // Lighter waveform magnetism
    let closestSnap = targetTime;
    let minDiff = SNAP_THRESHOLD;
    let snapped = false;
    let snapType = null;

    // Collect all snap points:
    // 1. Timeline Start (0) and End (duration)
    // 2. Other Element Boundaries
    const snapPoints = [
      { time: 0, type: 'boundary' },
      ...(duration && duration > 0 && isFinite(duration) ? [{ time: duration, type: 'boundary' }] : [])
    ];

    allElements.forEach(el => {
      if (el.id === excludeElementId) return;
      snapPoints.push({ time: el.start_time, type: 'element' });
      snapPoints.push({ time: el.end_time, type: 'element' });
    });

    // 3. Add waveform peaks as high-priority snap points
    waveformPeaks.forEach(peak => {
      snapPoints.push({ time: peak.time, type: 'waveform', amplitude: peak.amplitude });
    });

    // Find closest point - prioritize waveform peaks
    snapPoints.forEach(point => {
      const threshold = point.type === 'waveform' ? WAVEFORM_SNAP_THRESHOLD : SNAP_THRESHOLD;
      const diff = Math.abs(point.time - targetTime);

      // Waveform peaks get priority if within their threshold
      if (diff < threshold) {
        if (point.type === 'waveform' && diff < WAVEFORM_SNAP_THRESHOLD) {
          // Waveform peak takes priority
          if (!snapped || snapType !== 'waveform' || diff < minDiff) {
            minDiff = diff;
            closestSnap = point.time;
            snapped = true;
            snapType = 'waveform';
          }
        } else if (diff < minDiff && snapType !== 'waveform') {
          minDiff = diff;
          closestSnap = point.time;
          snapped = true;
          snapType = point.type;
        }
      }
    });

    return { time: closestSnap, snapped, snapType };
  };

  const getSpeechNeighbors = (element, allElements) => (
    allElements
      .filter(el => el.id !== element.id && !el.isTextElement)
      .sort((a, b) => a.start_time - b.start_time)
  );

  const getMoveBounds = (element, allElements, proposedStart) => {
    if (element.isTextElement) {
      return { minStart: 0, maxStart: Math.max(0, duration - (element.end_time - element.start_time)) };
    }

    const durationOfElement = element.end_time - element.start_time;
    const neighbors = getSpeechNeighbors(element, allElements);

    let previous = null;
    let next = null;

    for (const other of neighbors) {
      if (other.start_time <= proposedStart) previous = other;
      if (other.start_time > proposedStart) {
        next = other;
        break;
      }
    }

    const minStart = previous ? previous.end_time : 0;
    const maxStart = next ? next.start_time - durationOfElement : duration - durationOfElement;
    return { minStart, maxStart };
  };

  const getResizeBounds = (element, allElements, type) => {
    if (element.isTextElement) {
      return { minStart: 0, maxEnd: duration };
    }

    const neighbors = getSpeechNeighbors(element, allElements);
    const previous = [...neighbors].reverse().find(other => other.end_time <= element.start_time) || null;
    const next = neighbors.find(other => other.start_time >= element.end_time) || null;

    if (type === 'resize-left') {
      return { minStart: previous ? previous.end_time : 0 };
    }

    if (type === 'resize-right') {
      return { maxEnd: next ? next.start_time : duration };
    }

    return { minStart: 0, maxEnd: duration };
  };

  const updateScrubFromClientX = React.useCallback((clientX) => {
    const bounds = scrubBoundsRef.current || timelineRef.current?.getBoundingClientRect();
    if (!bounds || !duration) return;

    const x = clientX - bounds.left;
    const clampedX = Math.max(0, Math.min(x, bounds.width));
    const percentage = clampedX / Math.max(1, bounds.width);
    setLocalScrubTime(percentage * duration);
  }, [duration]);

  const handleContainerMouseDown = (e) => {
    if (draggingElement) return;
    if (e.target !== e.currentTarget && e.target.closest('[data-caption-block]')) return;

    isScrubbingRef.current = true;
    if (isPlaying) {
      wasPlayingRef.current = true;
      setIsPlaying(false);
    } else {
      wasPlayingRef.current = false;
    }

    scrubBoundsRef.current = e.currentTarget.getBoundingClientRect();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    updateScrubFromClientX(e.clientX);
    // Do NOT seek videoElement here - seeking on every mousedown/mousemove causes black frames.
    // Video seeks once on mouseup via onSeek below.
  };

  const handleContainerMouseMove = (e) => {
    if (draggingElement || e.buttons !== 1) return;
    if (e.target !== e.currentTarget && e.target.closest('[data-caption-block]')) return;

    if (!isScrubbingRef.current) {
      isScrubbingRef.current = true;
      if (isPlaying) {
        wasPlayingRef.current = true;
        setIsPlaying(false);
      } else {
        wasPlayingRef.current = false;
      }
      scrubBoundsRef.current = e.currentTarget.getBoundingClientRect();
    }

    updateScrubFromClientX(e.clientX);
    // Do NOT seek videoElement here - same reason as mousedown above.
  };

  useEffect(() => {
    const handleMouseMoveGlobal = (e) => {
      if (!isScrubbingRef.current) return;
      pendingScrubClientXRef.current = e.clientX;
      if (scrubRafRef.current) return;
      scrubRafRef.current = requestAnimationFrame(() => {
        scrubRafRef.current = null;
        if (pendingScrubClientXRef.current !== null) {
          updateScrubFromClientX(pendingScrubClientXRef.current);
        }
      });
    };

    const handleMouseUpGlobal = () => {
      if (scrubRafRef.current) {
        cancelAnimationFrame(scrubRafRef.current);
        scrubRafRef.current = null;
      }
      pendingScrubClientXRef.current = null;
      scrubBoundsRef.current = null;
      if (isScrubbingRef.current) {
        isScrubbingRef.current = false;

        setLocalScrubTime(prevScrubTime => {
          if (prevScrubTime !== null) {
            onSeek(prevScrubTime); // Commits the final time to application state
          }
          return null;
        });

        if (wasPlayingRef.current) {
          setIsPlaying(true);
        }
      }
    };

    window.addEventListener('mousemove', handleMouseMoveGlobal);
    window.addEventListener('mouseup', handleMouseUpGlobal);
    window.addEventListener('pointermove', handleMouseMoveGlobal, { passive: false });
    window.addEventListener('pointerup', handleMouseUpGlobal);
    window.addEventListener('pointercancel', handleMouseUpGlobal);
    return () => {
      window.removeEventListener('mousemove', handleMouseMoveGlobal);
      window.removeEventListener('mouseup', handleMouseUpGlobal);
      window.removeEventListener('pointermove', handleMouseMoveGlobal);
      window.removeEventListener('pointerup', handleMouseUpGlobal);
      window.removeEventListener('pointercancel', handleMouseUpGlobal);
      if (scrubRafRef.current) {
        cancelAnimationFrame(scrubRafRef.current);
        scrubRafRef.current = null;
      }
    };
  }, [onSeek, setIsPlaying, updateScrubFromClientX]);

  const handleElementDragStart = (e, element, type) => {
    e.stopPropagation();
    e.preventDefault();
    addToHistory(); // Snapshot pre-drag state for undo
    setDraggingElement(element);
    setDragType(type);
    setDragStartX(e.clientX);
    setDragStartTime(type === 'resize-right' ? element.end_time : element.start_time);
  };

  useEffect(() => {
    if (!draggingElement) return;
    // Use setCaptionsRaw (bypasses history) for continuous drag updates
    // History was already pushed in handleElementDragStart
    const rawSet = setCaptionsRaw || setCaptions;
    if (!rawSet) return;

    let rafId = null;
    document.body.style.userSelect = 'none';

    const handleMouseMove = (e) => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (!timelineRef.current) return;

        const rect = timelineRef.current.getBoundingClientRect();
        const deltaX = e.clientX - dragStartX;
        const deltaTime = (deltaX / rect.width) * duration;

        rawSet(prev => prev.map(cap => {
          if (cap.id !== draggingElement.id) return cap;

          const capDuration = cap.end_time - cap.start_time;

          if (dragType === 'move') {
            let rawStart = dragStartTime + deltaTime;

            // Apply Snapping
            const { time: snappedStart, snapped, snapType } = getSnapTime(rawStart, cap.id, prev);
            let newStart = snapped ? snappedStart : rawStart;

            if (snapped) setSnappedTime({ time: newStart, type: snapType });
            else setSnappedTime(null);

            const bounds = getMoveBounds(cap, prev, newStart);
            newStart = Math.max(bounds.minStart, newStart);
            newStart = Math.min(bounds.maxStart, newStart);
            newStart = Math.max(0, Math.min(duration - capDuration, newStart));

            if (!cap.isTextElement) {
              return {
                ...cap,
                start_time: newStart,
                end_time: newStart + capDuration,
                _needsReorder: true
              };
            }

            return {
              ...cap,
              start_time: newStart,
              end_time: newStart + capDuration
            };
          } else if (dragType === 'resize-left') {
            let rawStart = dragStartTime + deltaTime;

            // Apply Snapping
            const { time: snappedStart, snapped, snapType } = getSnapTime(rawStart, cap.id, prev);
            let newStart = snapped ? snappedStart : rawStart;

            if (snapped) setSnappedTime({ time: newStart, type: snapType });
            else setSnappedTime(null);

            const bounds = getResizeBounds(cap, prev, 'resize-left');
            newStart = Math.max(bounds.minStart, newStart);
            newStart = Math.max(0, Math.min(cap.end_time - 0.02, newStart));
            return { ...cap, start_time: newStart };
          } else if (dragType === 'resize-right') {
            let rawEnd = dragStartTime + deltaTime;

            // Apply Snapping
            const { time: snappedEnd, snapped, snapType } = getSnapTime(rawEnd, cap.id, prev);
            let newEnd = snapped ? snappedEnd : rawEnd;

            if (snapped) setSnappedTime({ time: newEnd, type: snapType });
            else setSnappedTime(null);

            const bounds = getResizeBounds(cap, prev, 'resize-right');
            newEnd = Math.min(bounds.maxEnd, newEnd);
            newEnd = Math.max(cap.start_time + 0.02, Math.min(duration, newEnd));
            return { ...cap, end_time: newEnd };
          }

          return cap;
        }));
      });
    };

    const handleMouseUp = () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (draggingElement && !draggingElement.isTextElement) {
        rawSet(prev => {
          const textEls = prev.filter(c => c.isTextElement);
          const speechEls = prev.filter(c => !c.isTextElement)
            .map(c => ({ ...c, _needsReorder: undefined }))
            .sort((a, b) => a.start_time - b.start_time);
          return [...textEls, ...speechEls];
        });
      }
      setDraggingElement(null);
      setDragType(null);
      setSnappedTime(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('pointermove', handleMouseMove, { passive: false });
    document.addEventListener('pointerup', handleMouseUp);
    document.addEventListener('pointercancel', handleMouseUp);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('pointermove', handleMouseMove);
      document.removeEventListener('pointerup', handleMouseUp);
      document.removeEventListener('pointercancel', handleMouseUp);
    };
  }, [draggingElement, dragType, dragStartX, dragStartTime, duration, setCaptionsRaw, setCaptions]);

  // Delete text element handler
  const handleDeleteTextElement = (e, captionId) => {
    e.stopPropagation();
    if (setCaptions) {
      addToHistory(); // Snapshot pre-delete state for undo
      setCaptions(prev => prev.filter(c => c.id !== captionId));
    }
  };

  const waveformBars = React.useMemo(() => {
    const source = waveformData && waveformData.length > 0
      ? waveformData
      : Array.from({ length: 320 }).map((_, i) => Math.abs(Math.sin(i * 0.37) * Math.cos(i * 0.11)));

    const targetCount = 420;
    let sampled;

    if (source.length <= targetCount) {
      sampled = source;
    } else {
      const blockSize = source.length / targetCount;
      sampled = Array.from({ length: targetCount }, (_, idx) => {
        const start = Math.floor(idx * blockSize);
        const end = Math.min(source.length, Math.floor((idx + 1) * blockSize));
        let peak = 0;
        for (let i = start; i < end; i += 1) {
          peak = Math.max(peak, Math.abs(source[i] || 0));
        }
        return peak;
      });
    }

    const maxPeak = sampled.reduce((max, value) => Math.max(max, Math.abs(value || 0)), 0.001);

    return sampled.map((value, index) => {
      const normalized = Math.min(1, Math.abs(value || 0) / maxPeak);
      const previous = sampled[Math.max(0, index - 1)] || 0;
      const next = sampled[Math.min(sampled.length - 1, index + 1)] || 0;
      const smoothed = ((Math.abs(previous) + Math.abs(value || 0) + Math.abs(next)) / 3) / maxPeak;
      return Math.max(0.18, Math.min(1, (normalized * 0.55) + (smoothed * 0.45)));
    });
  }, [waveformData]);

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onToggleCollapsed}
        className="w-full h-[38px] rounded-[18px] border border-white/10 bg-[#0d0d0d]/95 px-4 flex items-center justify-center gap-4 text-[9px] uppercase tracking-[0.22em] text-slate-500 shadow-[0_10px_28px_-20px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.04)] hover:border-white/15 hover:bg-[#111] transition-colors"
        title="Expand timeline"
      >
        <span>48 kHz - Stereo</span>
        <span className="h-3 w-px bg-white/10" />
        <span className="inline-flex items-center self-center text-slate-300 text-xs leading-none">^</span>
        <span className="font-bold text-white">Timeline</span>
        <span className="h-3 w-px bg-white/10" />
        <span>{captions?.length || 0} Elements</span>
      </button>
    );
  }

  return (
    <div className="flex h-full shrink-0 overflow-hidden rounded-[18px] border border-white/10 bg-[#0d0d0d]/95 shadow-[0_12px_32px_-24px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="w-12 shrink-0 border-r border-white/10 flex flex-col items-center justify-center gap-2 bg-black/10">
        <button
          type="button"
          onClick={() => setIsPlaying(!isPlaying)}
          className="h-9 w-9 rounded-full bg-white text-black flex items-center justify-center hover:bg-slate-200 transition-colors"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
        </button>
        <button onClick={() => onSeek(Math.max(0, currentTime - 5))} className="rounded-md border border-white/10 px-2 py-1 text-[9px] text-slate-500 hover:text-white">-5s</button>
        <button onClick={() => onSeek(Math.min(duration || currentTime, currentTime + 5))} className="rounded-md border border-white/10 px-2 py-1 text-[9px] text-slate-500 hover:text-white">+5s</button>
      </div>

      <div className="min-w-0 flex h-full flex-1 flex-col px-3 py-2">
        <button
          type="button"
          className="flex h-5 w-full items-center justify-between gap-3 text-left"
          onClick={onToggleCollapsed}
          title="Collapse timeline"
        >
          <span className="flex items-center gap-2">
            <span className="hidden text-[8px] font-medium uppercase tracking-[0.14em] text-slate-500 sm:inline">48 kHz - Stereo</span>
            <span className="hidden h-3 w-px bg-white/10 sm:block" />
            <span className="inline-flex items-center self-center text-slate-400 text-xs leading-none">v</span>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white">Timeline</span>
            <span className="text-[9px] text-slate-600">{regularCaptions.length} elements</span>
          </span>
          <div className="flex min-w-0 items-center gap-3 text-[9px] text-slate-500">
            <span className="font-mono text-sky-100">{formatTime(displayTime)} / {formatTime(duration || 0)}</span>
            <button type="button" onClick={(e) => { e.stopPropagation(); setZoom(3); }} className="rounded-md p-1 hover:bg-white/5 hover:text-white" title="Reset zoom">
              <RotateCcw className="h-3 w-3" />
            </button>
            <button type="button" onClick={(e) => { e.stopPropagation(); setZoom(z => Math.max(1, z - 0.5)); }} className="rounded-md p-1 hover:bg-white/5 hover:text-white" title="Zoom out">
              <ZoomOut className="h-3 w-3" />
            </button>
            <div className="h-1 w-16 rounded-full bg-white/5">
              <div className="h-full rounded-full bg-white/15" style={{ width: `${Math.min(100, Math.max(12, (zoom / 6) * 100))}%` }} />
            </div>
            <button type="button" onClick={(e) => { e.stopPropagation(); setZoom(z => Math.min(6, z + 0.5)); }} className="rounded-md p-1 hover:bg-white/5 hover:text-white" title="Zoom in">
              <ZoomIn className="h-3 w-3" />
            </button>
          </div>
        </button>

        <div
          ref={scrollContainerRef}
          className="relative mt-2 min-h-0 flex-1 overflow-y-auto overflow-x-auto rounded-xl border border-white/5 bg-[#121212] custom-scrollbar"
        >
          <div
            ref={timelineRef}
            className="relative min-w-full touch-none select-none cursor-pointer"
            style={{
              width: `${zoom * 100}%`,
              height: `${TIMELINE_CANVAS_HEIGHT}px`,
              transform: `translateX(-${panOffset}px)`
            }}
            onPointerDown={handleContainerMouseDown}
            onPointerMove={handleContainerMouseMove}
          >
            <div className="absolute left-0 right-0 top-0 h-7 border-b border-white/5 bg-black/20" />
            <div className="absolute top-1 flex justify-between px-1 text-[8px] font-mono text-slate-600" style={{ left: `${TRACK_LEFT}px`, right: `${TRACK_RIGHT}px` }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <span key={i}>{formatTime((duration || 0) * (i / 7))}</span>
              ))}
            </div>

            <div className="absolute left-2 top-[10px] z-10 w-[38px] text-[7px] font-semibold uppercase tracking-[0.16em] text-slate-500">Text</div>
            <div className="absolute left-2 z-10 w-[38px] text-[7px] font-semibold uppercase tracking-[0.16em] text-slate-500" style={{ top: `${SPEECH_TRACK_TOP + 2}px` }}>Speech</div>
            <div className="absolute left-2 z-10 w-[38px] text-[7px] font-semibold uppercase tracking-[0.16em] text-slate-500" style={{ top: `${AUDIO_TRACK_TOP + 2}px` }}>Audio</div>
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={`time-grid-${i}`}
                className="absolute top-7 bottom-0 w-px bg-white/[0.05]"
                style={{
                  left: `calc(${TRACK_LEFT}px + ((100% - ${TRACK_LEFT + TRACK_RIGHT}px) * ${i / 7}))`
                }}
              />
            ))}

            <div
              className="absolute border-y border-white/[0.05] bg-white/[0.01]"
              style={{ left: `${TRACK_LEFT}px`, right: `${TRACK_RIGHT}px`, top: `${SPEECH_TRACK_TOP}px`, height: `${SPEECH_HEIGHT}px` }}
            />
            <div
              className="absolute border-y border-white/[0.05] bg-white/[0.01]"
              style={{ left: `${TRACK_LEFT}px`, right: `${TRACK_RIGHT}px`, top: `${AUDIO_TRACK_TOP}px`, height: `${WAVEFORM_HEIGHT}px` }}
            />

            {Array.from({ length: TEXT_ROWS }).map((_, rowIndex) => (
              <div
                key={`visible-row-${rowIndex}`}
                className="absolute border-b border-white/[0.04]"
                style={{
                  left: `${TRACK_LEFT}px`,
                  right: `${TRACK_RIGHT}px`,
                  top: `${TEXT_TRACK_TOP + (rowIndex * TEXT_ROW_HEIGHT)}px`,
                  height: `${TEXT_ROW_HEIGHT}px`,
                  background: rowIndex % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent'
                }}
              />
            ))}

            {textElements.map((caption, idx) => {
              const rowIndex = getTextElementRow(idx);
              const left = getPositionPercentage(caption.start_time || 0);
              const width = getPositionPercentage((caption.end_time || 0) - (caption.start_time || 0));
              const isSelected = selectedCaptionId === caption.id;
              return (
                <motion.div
                  key={caption.id}
                  data-caption-block="true"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`absolute rounded-[5px] border px-2 text-[9px] font-semibold transition-colors ${
                    isSelected
                      ? 'border-sky-300/50 bg-sky-400/20 text-white'
                      : 'border-white/10 bg-white/[0.08] text-slate-200 hover:bg-white/[0.12]'
                  }`}
                  style={{
                    top: `${TEXT_TRACK_TOP + (rowIndex * TEXT_ROW_HEIGHT) + 4}px`,
                    left: `${left}%`,
                    width: `${Math.max(width, 8)}%`,
                    height: `${TEXT_ROW_HEIGHT - 8}px`
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectCaption(caption.id);
                    onSeek(caption.start_time || 0);
                  }}
                >
                  <div className="truncate leading-[18px]">{(caption.text || '').slice(0, 38)}</div>
                </motion.div>
              );
            })}

            <div className="absolute h-7" style={{ left: `${TRACK_LEFT}px`, right: `${TRACK_RIGHT}px`, top: `${SPEECH_TRACK_TOP}px` }}>
              {regularCaptions.map((caption, index) => {
                const isSelected = selectedCaptionId === caption.id;
                const isActive = currentTime >= (caption.start_time || 0) && currentTime <= (caption.end_time || 0);
                const isDraggingThis = draggingElement?.id === caption.id;
                const left = getPositionPercentage(caption.start_time || 0);
                const width = getPositionPercentage((caption.end_time || 0) - (caption.start_time || 0));
                return (
                  <button
                    key={caption.id}
                    data-caption-block="true"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectCaption(caption.id);
                      onSeek(caption.start_time || 0);
                    }}
                    onPointerDown={(e) => {
                      if (setCaptions) {
                        e.stopPropagation();
                        handleElementDragStart(e, caption, 'move');
                      }
                    }}
                    className={`absolute top-0 h-7 truncate rounded-[4px] border px-2 text-left text-[9px] font-semibold transition-colors cursor-grab active:cursor-grabbing ${
                      isSelected || isActive
                        ? 'border-[#6b7280] bg-[#333844] text-white'
                        : 'border-[#4a4d59] bg-[#2a2d35] text-[#c7ccd7] hover:bg-[#313540] hover:text-[#f1f4fa]'
                    }`}
                    style={{
                      left: `${left}%`,
                      width: `${Math.max(width, 2)}%`,
                      zIndex: isDraggingThis ? 80 : (isSelected ? 24 : 12),
                      boxShadow: isDraggingThis ? '0 10px 24px rgba(0,0,0,0.35)' : 'none'
                    }}
                  >
                    <span
                      className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize rounded-l-[4px] bg-white/0 hover:bg-white/10"
                      onPointerDown={(e) => {
                        if (setCaptions) {
                          e.stopPropagation();
                          handleElementDragStart(e, caption, 'resize-left');
                        }
                      }}
                    />
                    <span
                      className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize rounded-r-[4px] bg-white/0 hover:bg-white/10"
                      onPointerDown={(e) => {
                        if (setCaptions) {
                          e.stopPropagation();
                          handleElementDragStart(e, caption, 'resize-right');
                        }
                      }}
                    />
                    <span className="block truncate px-1">
                      {String(index + 1).padStart(2, '0')} {(caption.text || '').slice(0, 38)}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="absolute border-t border-white/5" style={{ left: `${TRACK_LEFT}px`, right: `${TRACK_RIGHT}px`, top: `${AUDIO_TRACK_TOP + 2}px`, height: `${WAVEFORM_HEIGHT}px` }}>
              {waveformBars.map((amplitude, i) => {
                const pct = i / Math.max(1, waveformBars.length - 1);
                const barTime = pct * (duration || 0);
                const h = Math.max(20, Math.min(WAVEFORM_HEIGHT - 6, Math.pow(Math.max(0.08, amplitude), 0.92) * (WAVEFORM_HEIGHT - 6)));
                return (
                  <span
                    key={i}
                    className="absolute rounded-full"
                    style={{
                      width: '2px',
                      height: `${h}px`,
                      left: `calc(${(i / waveformBars.length) * 100}% - 1px)`,
                      top: `calc(50% - ${h / 2}px)`,
                      backgroundColor: '#ffffff',
                      boxShadow: 'none',
                      opacity: 0.15 + amplitude * 0.83
                    }}
                  />
                );
              })}
            </div>

            <motion.div
              className="absolute top-0 bottom-0 w-px bg-white z-50 pointer-events-none"
              style={{ left: `${getPositionPercentage(displayTime)}%` }}
            >
              <div className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-white" />
            </motion.div>
          </div>
        </div>

      </div>
    </div>
  );
}
