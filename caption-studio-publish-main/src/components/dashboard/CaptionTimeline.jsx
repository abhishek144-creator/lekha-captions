import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

// RESTORED COMPACT DIMENSIONS
const TEXT_ROW_HEIGHT = 28;      // Increased from 22 for better visibility
const TEXT_ROWS = 6;             // Keeps your 6 text layers
const SPEECH_HEIGHT = 38;
const WAVEFORM_HEIGHT = 48;
const TOTAL_CONTENT_HEIGHT = (TEXT_ROWS * TEXT_ROW_HEIGHT) + SPEECH_HEIGHT + WAVEFORM_HEIGHT + 16;
const VISIBLE_HEIGHT = 135;

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

  const textElements = captions?.filter(c => c && c.isTextElement) || [];
  const regularCaptions = captions?.filter(c => c && !c.isTextElement) || [];

  // Assign text elements to rows (row 5 = bottom closest to speech, row 0 = top)
  const getTextElementRow = (index) => TEXT_ROWS - 1 - (index % TEXT_ROWS);

  // Auto-scroll vertically to show text box + speech + waveform rows on mount
  useEffect(() => {
    if (scrollContainerRef.current) {
      setTimeout(() => {
        if (scrollContainerRef.current) {
          // Scroll to show 1 text row above speech+waveform, not absolute bottom
          const totalH = scrollContainerRef.current.scrollHeight;
          const visibleH = scrollContainerRef.current.clientHeight;
          // Leave 1 text row (TEXT_ROW_HEIGHT) visible above speech/audio
          const targetScroll = Math.max(0, totalH - visibleH - TEXT_ROW_HEIGHT);
          scrollContainerRef.current.scrollTop = targetScroll;
        }
      }, 100);
    }
  }, []);

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
    const SNAP_THRESHOLD = 0.25; // Threshold for "sticky" feel
    const WAVEFORM_SNAP_THRESHOLD = 0.15; // Tighter snap for audio peaks
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

  // Function to find collisions and get boundary for speech captions only
  const getCollisionBounds = (element, allElements, type) => {
    if (element.isTextElement) {
      return { minStart: 0, maxEnd: duration };
    }

    const sameTrackElements = allElements.filter(el =>
      el.id !== element.id && !el.isTextElement
    );

    let minStart = 0;
    let maxEnd = duration;

    sameTrackElements.forEach(other => {
      if (type === 'move' || type === 'resize-left') {
        if (other.end_time <= element.start_time) {
          minStart = Math.max(minStart, other.end_time);
        }
      }
      if (type === 'move' || type === 'resize-right') {
        if (other.start_time >= element.end_time) {
          maxEnd = Math.min(maxEnd, other.start_time);
        }
      }
    });

    return { minStart, maxEnd };
  };

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

    const innerRect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - innerRect.left;
    const clampedX = Math.max(0, Math.min(clickX, innerRect.width));
    const percentage = clampedX / innerRect.width;
    const newTime = percentage * duration;

    setLocalScrubTime(newTime);
    // Do NOT seek videoElement here — seeking on every mousedown/mousemove causes black frames.
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
    }

    const innerRect = e.currentTarget.getBoundingClientRect();
    const moveX = e.clientX - innerRect.left;
    const clampedX = Math.max(0, Math.min(moveX, innerRect.width));
    const percentage = clampedX / innerRect.width;
    const newTime = percentage * duration;

    setLocalScrubTime(newTime);
    // Do NOT seek videoElement here — same reason as mousedown above.
  };

  useEffect(() => {
    const handleMouseUpGlobal = () => {
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

    window.addEventListener('mouseup', handleMouseUpGlobal);
    return () => window.removeEventListener('mouseup', handleMouseUpGlobal);
  }, [onSeek, setIsPlaying]);

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

    const handleMouseMove = (e) => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (!timelineRef.current) return;

        const rect = timelineRef.current.getBoundingClientRect();
        const deltaX = e.clientX - dragStartX;
        const deltaTime = (deltaX / rect.width) * duration;

        rawSet(prev => prev.map(cap => {
          if (cap.id !== draggingElement.id) return cap;

          const bounds = getCollisionBounds(cap, prev, dragType);
          const capDuration = cap.end_time - cap.start_time;

          if (dragType === 'move') {
            let rawStart = dragStartTime + deltaTime;

            // Apply Snapping
            const { time: snappedStart, snapped, snapType } = getSnapTime(rawStart, cap.id, prev);
            let newStart = snapped ? snappedStart : rawStart;

            if (snapped) setSnappedTime({ time: newStart, type: snapType });
            else setSnappedTime(null);

            newStart = Math.max(bounds.minStart, newStart);
            newStart = Math.min(bounds.maxEnd - capDuration, newStart);
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

            newStart = Math.max(bounds.minStart, newStart);
            newStart = Math.max(0, Math.min(cap.end_time - 0.1, newStart));
            return { ...cap, start_time: newStart };
          } else if (dragType === 'resize-right') {
            let rawEnd = dragStartTime + deltaTime;

            // Apply Snapping
            const { time: snappedEnd, snapped, snapType } = getSnapTime(rawEnd, cap.id, prev);
            let newEnd = snapped ? snappedEnd : rawEnd;

            if (snapped) setSnappedTime({ time: newEnd, type: snapType });
            else setSnappedTime(null);

            newEnd = Math.min(bounds.maxEnd, newEnd);
            newEnd = Math.max(cap.start_time + 0.1, Math.min(duration, newEnd));
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

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
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

  // Handle mouse wheel scroll
  const handleWheel = (e) => {
    e.preventDefault();
    const maxScroll = Math.max(0, TOTAL_CONTENT_HEIGHT - VISIBLE_HEIGHT);
    setScrollPos(prev => Math.max(0, Math.min(maxScroll, prev + e.deltaY * 0.5)));
  };

  const maxScroll = Math.max(1, TOTAL_CONTENT_HEIGHT - VISIBLE_HEIGHT);

  return (
    <div className="flex flex-col shrink-0 border-t border-white/10 pt-2">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-medium text-gray-400">Timeline</h3>
          <span className="text-[10px] text-gray-500 hidden sm:inline">{captions?.length || 0} elements</span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onSeek(0)}
            className="h-6 w-6 text-gray-400 hover:text-white border border-white/10"
            title="Reset Playhead"
          >
            <RotateCcw className="w-3 h-3" />
          </Button>
          <div className="flex items-center gap-1.5 w-24 md:w-32">
            <ZoomOut className="w-3 h-3 text-gray-500" />
            <Slider
              value={[zoom]}
              min={1}
              max={10}
              step={0.1}
              onValueChange={([val]) => setZoom(val)}
              className="flex-1 cursor-ew-resize"
            />
            <ZoomIn className="w-3 h-3 text-gray-500" />
          </div>
        </div>
      </div>

      <div className="flex gap-2" style={{ height: `${timelineHeight - 40}px` }}>
        {/* Scrollable timeline container */}
        <div
          className="flex-1 overflow-hidden bg-[#161616] rounded-lg border border-white/5"
        >
          <div
            ref={scrollContainerRef}
            className="overflow-auto h-full pb-2 custom-scrollbar"
          >
            {/* Zoomed Inner Container */}
            <div
              ref={timelineRef}
              className="relative cursor-pointer"
              style={{
                width: `${zoom * 100}%`,
                minWidth: '100%',
                height: `${TOTAL_CONTENT_HEIGHT}px`,
                transform: `translateX(-${panOffset}px)`
              }}
              onMouseDown={handleContainerMouseDown}
              onMouseMove={handleContainerMouseMove}
            >
              {/* Time markers background */}
              <div className="absolute inset-0 pointer-events-none z-0">
                {Array.from({ length: Math.ceil(5 * zoom) }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 w-px bg-white/5"
                    style={{ left: `${(i / Math.ceil(5 * zoom)) * 100}%` }}
                  />
                ))}
              </div>

              {/* Playhead */}
              <motion.div
                className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-50 pointer-events-none"
                style={{ left: `${getPositionPercentage(displayTime)}%` }}
              >
                <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-red-500 rounded-full shadow-md border border-white/20" />
              </motion.div>

              {/* Snap Indicator Line - Green for waveform, Yellow for other */}
              {snappedTime !== null && (
                <div
                  className={`absolute top-0 bottom-0 w-px z-50 pointer-events-none ${snappedTime.type === 'waveform'
                    ? 'bg-violet-400 shadow-[0_0_12px_rgba(167,139,250,0.9)]'
                    : 'bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.8)]'
                    }`}
                  style={{ left: `${getPositionPercentage(typeof snappedTime === 'object' ? snappedTime.time : snappedTime)}%` }}
                />
              )}

              {/* Text Tracks (6 rows at top) */}
              <div
                className="absolute left-0 right-0"
                style={{ top: 0, height: `${TEXT_ROWS * TEXT_ROW_HEIGHT}px` }}
              >
                {/* Row backgrounds */}
                {Array.from({ length: TEXT_ROWS }).map((_, rowIndex) => (
                  <div
                    key={`row-${rowIndex}`}
                    className="absolute left-0 right-0 border-b border-blue-500/10"
                    style={{
                      top: `${rowIndex * TEXT_ROW_HEIGHT}px`,
                      height: `${TEXT_ROW_HEIGHT}px`,
                      backgroundColor: rowIndex % 2 === 0 ? 'rgba(59, 130, 246, 0.02)' : 'transparent'
                    }}
                  >
                    {rowIndex === 0 && (
                      <div className="absolute left-1 top-0.5 text-[8px] text-blue-400/50 uppercase tracking-wider font-medium pointer-events-none">
                        Text
                      </div>
                    )}
                  </div>
                ))}

                {/* Text elements */}
                {textElements.map((caption, idx) => {
                  const rowIndex = getTextElementRow(idx);
                  const left = getPositionPercentage(caption.start_time || 0);
                  const width = getPositionPercentage((caption.end_time || 0) - (caption.start_time || 0));
                  const isSelected = selectedCaptionId === caption.id;
                  const topPos = rowIndex * TEXT_ROW_HEIGHT + 3;

                  return (
                    <motion.div
                      key={caption.id}
                      data-caption-block="true"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={`absolute rounded transition-all border group cursor-move ${isSelected
                        ? 'bg-blue-500/50 border-blue-400 z-20'
                        : 'bg-blue-500/30 border-blue-500/40 hover:bg-blue-500/40 z-10'
                        }`}
                      style={{
                        left: `${left}%`,
                        width: `${Math.max(width, 2)}%`,
                        top: `${topPos}px`,
                        height: `${TEXT_ROW_HEIGHT - 6}px`
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectCaption(caption.id);
                      }}
                      onMouseDown={(e) => {
                        if (setCaptions) {
                          e.stopPropagation();
                          e.preventDefault();
                          handleElementDragStart(e, caption, 'move');
                        }
                      }}
                    >
                      {setCaptions && (
                        <>
                          <div
                            className="absolute left-0 top-0 bottom-0 w-2 bg-blue-400 opacity-0 group-hover:opacity-100 cursor-ew-resize z-30 rounded-l"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              handleElementDragStart(e, caption, 'resize-left');
                            }}
                          />
                          <div
                            className="absolute right-0 top-0 bottom-0 w-2 bg-blue-400 opacity-0 group-hover:opacity-100 cursor-ew-resize z-30 rounded-r"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              handleElementDragStart(e, caption, 'resize-right');
                            }}
                          />
                          {/* Delete button */}
                          <button
                            className="absolute -top-2 -right-2 w-5 h-5 bg-zinc-900 border border-white/20 hover:border-red-500/50 hover:bg-red-500/10 rounded-full opacity-0 group-hover:opacity-100 z-40 flex items-center justify-center transition-all shadow-lg text-gray-400 hover:text-red-500"
                            onClick={(e) => handleDeleteTextElement(e, caption.id)}
                            title="Delete"
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                            </svg>
                          </button>
                        </>
                      )}
                      <div className="px-1.5 truncate text-[10px] text-blue-100 pointer-events-none flex items-center h-full font-medium">
                        {caption.text}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Divider line between text and speech */}
              <div
                className="absolute left-0 right-0 h-px bg-white/10"
                style={{ top: `${TEXT_ROWS * TEXT_ROW_HEIGHT}px` }}
              />

              {/* Speech Track */}
              <div
                className="absolute left-0 right-0"
                style={{ top: `${TEXT_ROWS * TEXT_ROW_HEIGHT}px`, height: `${SPEECH_HEIGHT + 8}px` }}
              >
                {/* Row label */}
                <div className="absolute left-1 top-0.5 text-[8px] text-white/20 uppercase tracking-wider font-medium pointer-events-none z-10">
                  Speech
                </div>

                {/* Background */}
                <div className="absolute inset-0 bg-white/[0.03]" />

                {/* Speech captions */}
                <div className="absolute left-0 right-0" style={{ top: '12px', bottom: '4px' }}>
                  {regularCaptions.map((caption) => {
                    const left = getPositionPercentage(caption.start_time || 0);
                    const width = getPositionPercentage((caption.end_time || 0) - (caption.start_time || 0));
                    const isSelected = selectedCaptionId === caption.id;
                    const isActive = currentTime >= (caption.start_time || 0) && currentTime <= (caption.end_time || 0);

                    return (
                      <motion.div
                        key={caption.id}
                        data-caption-block="true"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={`absolute rounded-md transition-all border group cursor-move ${isSelected
                          ? 'bg-white/20 border-white/50 z-20'
                          : isActive
                            ? 'bg-white/15 border-white/30 z-10'
                            : 'bg-white/10 border-white/20 hover:bg-white/15 hover:border-white/30 z-10'
                          }`}
                        style={{
                          left: `${left}%`,
                          width: `${Math.max(width, 1)}%`,
                          top: '0',
                          height: `${SPEECH_HEIGHT - 4}px`,
                          ...(isSelected ? { borderWidth: '1.5px' } : {})
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectCaption(caption.id);
                        }}
                        onMouseDown={(e) => {
                          if (setCaptions) {
                            e.stopPropagation();
                            e.preventDefault();
                            handleElementDragStart(e, caption, 'move');
                          }
                        }}
                      >
                        {setCaptions && (
                          <>
                            <div
                              className="absolute left-0 top-0 bottom-0 w-2 bg-white/60 opacity-0 group-hover:opacity-100 cursor-ew-resize z-30 rounded-l"
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                handleElementDragStart(e, caption, 'resize-left');
                              }}
                            />
                            <div
                              className="absolute right-0 top-0 bottom-0 w-2 bg-white/60 opacity-0 group-hover:opacity-100 cursor-ew-resize z-30 rounded-r"
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                handleElementDragStart(e, caption, 'resize-right');
                              }}
                            />
                          </>
                        )}
                        <div className={`px-2 truncate text-[10px] pointer-events-none flex items-center h-full ${isSelected ? 'text-white font-semibold' : 'text-white/80'}`}>
                          {(caption.text || '').slice(0, 60)}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* Audio Waveform Track */}
              <div
                className="absolute left-0 right-0"
                style={{ top: `${TEXT_ROWS * TEXT_ROW_HEIGHT + SPEECH_HEIGHT + 8}px`, height: `${WAVEFORM_HEIGHT}px` }}
              >
                {/* Subtle top separator */}
                <div className="absolute top-0 left-0 right-0 h-px bg-white/8" />

                {/* Row label */}
                <div className="absolute left-1 top-0.5 text-[8px] text-white/25 uppercase tracking-wider font-medium pointer-events-none z-10">
                  Audio
                </div>

                {/* Waveform Visualization — professional white-bar style */}
                <div className="absolute left-0 right-0 top-2.5 bottom-0.5 overflow-hidden">
                  {waveformData && waveformData.length > 0 ? (
                    <svg
                      width="100%"
                      height="100%"
                      viewBox={`0 0 ${waveformData.length * 2} 100`}
                      preserveAspectRatio="none"
                    >
                      {waveformData.map((amplitude, i) => {
                        // Sharpen spikes: mild power curve to keep quiet parts visible
                        const amp = Math.pow(Math.max(0, amplitude), 1.6)
                        const barHeight = Math.max(2, amp * 94)
                        const y = 50 - barHeight / 2
                        // Taller bars are more opaque — quiet zones fade into background
                        const opacity = 0.2 + amp * 0.8
                        return (
                          <rect
                            key={i}
                            x={i * 2}
                            y={y}
                            width={1.1}
                            height={barHeight}
                            fill="white"
                            fillOpacity={opacity}
                            rx={0.55}
                          />
                        )
                      })}
                    </svg>
                  ) : (
                    /* Placeholder: subtle white bars when no audio loaded */
                    <svg
                      width="100%"
                      height="100%"
                      viewBox="0 0 400 100"
                      preserveAspectRatio="none"
                    >
                      {Array.from({ length: 200 }).map((_, i) => {
                        // Natural-looking pseudo-random waveform shape
                        const t = i / 200
                        const wave = Math.sin(t * Math.PI * 8) * Math.sin(t * Math.PI * 2.3)
                        const barHeight = Math.max(2, Math.abs(wave) * 70 + 3)
                        const y = 50 - barHeight / 2
                        const opacity = 0.08 + Math.abs(wave) * 0.15
                        return (
                          <rect
                            key={i}
                            x={i * 2}
                            y={y}
                            width={1.1}
                            height={barHeight}
                            fill="white"
                            fillOpacity={opacity}
                            rx={0.55}
                          />
                        )
                      })}
                    </svg>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
}