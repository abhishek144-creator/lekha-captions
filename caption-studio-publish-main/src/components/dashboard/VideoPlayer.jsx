import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, X } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import WordClickPopup from './WordClickPopup';
import '../../styles/captionTemplates.css';

// --- Effect CSS helper ---
function _hexRgba(hex, a) {
  try {
    const h = hex.replace('#', '')
    const r = parseInt(h.slice(0, 2), 16)
    const g = parseInt(h.slice(2, 4), 16)
    const b = parseInt(h.slice(4, 6), 16)
    return `rgba(${r},${g},${b},${a})`
  } catch { return hex }
}

function computeEffectCSS(cs) {
  const type = cs?.effect_type || 'none'
  if (type === 'none') return {}
  const color = cs?.effect_color || '#000000'
  const blur   = ((cs?.effect_blur   ?? 50) / 100) * 24  // 0-24px
  const offset = ((cs?.effect_offset ?? 50) / 100) * 16  // 0-16px
  const dir    = cs?.effect_direction ?? -45
  const transp = cs?.effect_transparency ?? 40
  const thick  = cs?.effect_thickness ?? 50
  const alpha  = (100 - transp) / 100
  const rad = (dir * Math.PI) / 180
  const ox = +(Math.cos(rad) * offset).toFixed(1)
  const oy = +(Math.sin(rad) * offset).toFixed(1)
  const rc = (a = alpha) => _hexRgba(color, a)
  switch (type) {
    case 'shadow':
      return { textShadow: `${ox}px ${oy}px ${blur}px ${rc()}` }
    case 'lift':
      return { textShadow: `0px ${(offset * 0.4).toFixed(1)}px ${(blur * 0.5).toFixed(1)}px ${rc()}, 0px ${offset}px ${blur}px ${rc(alpha * 0.4)}` }
    case 'hollow':
      return { WebkitTextStroke: `${(thick / 40).toFixed(1)}px ${color}`, color: 'transparent', WebkitTextFillColor: 'transparent' }
    case 'splice':
      return { textShadow: `${ox}px ${oy}px 0px ${rc()}` }
    case 'outline':
      return { WebkitTextStroke: `${(thick / 40).toFixed(1)}px ${color}` }
    case 'echo':
      return { textShadow: `${ox}px ${oy}px 0px ${rc()}, ${ox * 2}px ${oy * 2}px 0px ${rc(alpha * 0.55)}, ${ox * 3}px ${oy * 3}px 0px ${rc(alpha * 0.25)}` }
    case 'neon': {
      const nc = cs?.effect_color || cs?.text_color || '#39ff14'
      return { textShadow: `0 0 ${(blur * 0.5).toFixed(1)}px ${nc}, 0 0 ${blur}px ${nc}, 0 0 ${(blur * 2).toFixed(1)}px ${nc}` }
    }
    default: return {}
  }
}


// Memoized video element — prevents React from touching the <video> DOM node during
// parent re-renders. Without this, re-renders from scrubbing/state changes cause the
// browser to re-composite the video layer, which can show a black frame on some systems.
const MemoizedVideo = React.memo(function MemoizedVideo({ videoRef, videoUrl, onTimeUpdate, onLoadedMetadata, setIsPlaying, setSelectedCaptionId }) {
  return (
    <video
      ref={videoRef}
      src={videoUrl}
      className="w-full h-full object-contain"
      playsInline
      preload="auto"
      disablePictureInPicture
      controlsList="nodownload nofullscreen noremoteplayback nopip"
      onContextMenu={(e) => e.preventDefault()}
      onTimeUpdate={onTimeUpdate}
      onLoadedMetadata={onLoadedMetadata}
      onEnded={() => setIsPlaying(false)}
      onPlay={() => setIsPlaying(true)}
      onPause={() => setIsPlaying(false)}
      onClick={() => { if (setSelectedCaptionId) setSelectedCaptionId(null); }}
    />
  );
}, (prev, next) => {
  // Only re-render when the video source changes — nothing else should touch the DOM
  return prev.videoUrl === next.videoUrl;
});

export default function VideoPlayer({
  videoUrl,
  currentTime,
  setCurrentTime,
  seekSignal,
  isPlaying,
  setIsPlaying,
  captions,
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
  onVideoLoaded
}) {
  const videoRef = useRef(null);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragStartPos, setDragStartPos] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');

  // Custom Element State
  const [draggedElementId, setDraggedElementId] = useState(null);
  const [resizedElementId, setResizedElementId] = useState(null);
  const [elementDragStart, setElementDragStart] = useState({ x: 0, y: 0, initialTop: 0, initialLeft: 0 });
  const [elementResizeStart, setElementResizeStart] = useState({ x: 0, initialWidth: 0, initialFontSize: 0 });

  // const [wordPopup, setWordPopup] = useState(null); // Lifted to Dashboard
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);
  const [resizeStartFontSize, setResizeStartFontSize] = useState(18);
  const [captionWidth, setCaptionWidth] = useState(300);

  // Word dragging state (for both captions and text elements)
  const [draggingWord, setDraggingWord] = useState(null); // { captionId, wordIndex, startX, startY, initialX, initialY, isElement }

  const captionRef = useRef(null);
  const videoContainerRef = useRef(null);
  const currentDragCoordinates = useRef(null);
  const lastDragDropTime = useRef(0);
  const inputRef = useRef(null);
  // Blocks handleTimeUpdate from propagating to Dashboard while user is dragging
  const isScrubbingRef = useRef(false);

  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.play();
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying]);

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
      setDuration(videoRef.current.duration);
      if (onVideoLoadedRef.current) {
        onVideoLoadedRef.current(videoRef.current);
      }
    }
  }, [setDuration]);

  const handleSeek = (value) => {
    if (videoRef.current) {
      // Handle both array (from Slider) and scalar (from buttons) values
      const targetTime = Array.isArray(value) ? value[0] : value;
      videoRef.current.currentTime = targetTime;
      setCurrentTime(targetTime);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getActiveCaptions = () => {
    if (!captions || captions.length === 0) return [];
    return captions.filter(cap =>
      cap &&
      !cap.isTextElement &&
      typeof cap.start_time === 'number' &&
      typeof cap.end_time === 'number' &&
      currentTime >= cap.start_time &&
      currentTime <= cap.end_time
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
      currentTime <= cap.end_time
    );
  };

  const getAnimationStyle = (animationType) => {
    const animations = {
      'rise': 'rise 0.4s ease-out',
      'pan': 'pan 0.5s ease-in-out',
      'fade': 'fade 0.5s ease-in',
      'pop': 'pop 0.3s ease-out',
      'wipe': 'wipe 0.4s ease-out',
      'blur': 'blur 0.5s ease-in-out',
      'succession': 'succession 0.4s ease-out',
      'breathe': 'breathe 1.5s ease-in-out infinite',
      'baseline': 'baseline 0.4s ease-out',
      'drift': 'drift 0.6s ease-in-out',
      'tectonic': 'tectonic 0.5s ease-out',
      'tumble': 'tumble 0.6s ease-in-out'
    };
    return animations[animationType] || 'none';
  };

  const activeCaptions = getActiveCaptions();
  const activeTextElements = getActiveTextElements();

  // Helper for single caption logic (for double click edit which we might need to scope to a specific one)
  // We'll use selectedCaptionId if active, or just the first active one
  const primaryCaption = selectedCaptionId
    ? activeCaptions.find(c => c.id === selectedCaptionId) || activeCaptions[0]
    : activeCaptions[0];

  // Build word groups based on wordsPerLine mode and per-word timestamps
  const buildWordGroups = (caption) => {
    const words = (caption.text || '').split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) return [];

    const mode = captionStyle?.wordsPerLine || 'dynamic';
    const captionDuration = caption.end_time - caption.start_time;

    // --- Fixed modes ---
    let chunkSize = null;
    if (mode === '1-2') chunkSize = 2;
    else if (mode === '2-3') chunkSize = 3;
    else if (mode === '3-5') chunkSize = 5;

    if (chunkSize !== null) {
      const groups = [];
      for (let i = 0; i < words.length; i += chunkSize) {
        groups.push({ start: i, end: Math.min(i + chunkSize - 1, words.length - 1) });
      }
      return groups;
    }

    // --- Dynamic mode: use per-word timestamps if available ---
    const hasWordTimestamps = caption.words && caption.words.length > 0;

    if (hasWordTimestamps) {
      // Group by natural speech pauses / density using millisecond timestamps
      const groups = [];
      let groupStart = 0;

      while (groupStart < words.length) {
        const remaining = words.length - groupStart;
        // Get timing info for words in this potential group
        const getWordDuration = (idx) => {
          const w = caption.words[idx];
          if (!w || typeof w.end !== 'number' || typeof w.start !== 'number') return 0.3;
          const dur = w.end - w.start;
          return isFinite(dur) && dur > 0 ? dur : 0.3;
        };
        const getGapAfter = (idx) => {
          const w = caption.words[idx];
          const next = caption.words[idx + 1];
          if (!w || !next) return 0;
          return next.start - w.end;
        };

        // Determine how many words to include in this group
        let groupSize = 1;
        const wps = words.length / captionDuration; // words per second for whole caption

        if (remaining === 1) {
          groupSize = 1;
        } else if (wps >= 4) {
          // Fast speech: group 3–5 words, but break on natural pauses
          let maxGroup = remaining <= 5 ? remaining : 3;
          groupSize = 1;
          for (let k = 1; k < maxGroup; k++) {
            const gap = getGapAfter(groupStart + k - 1);
            if (gap > 0.15) break; // pause detected – stop grouping
            groupSize = k + 1;
          }
        } else if (wps >= 2.5) {
          // Normal speech: 2–3 words, break on pause
          let maxGroup = Math.min(3, remaining);
          groupSize = 1;
          for (let k = 1; k < maxGroup; k++) {
            const gap = getGapAfter(groupStart + k - 1);
            if (gap > 0.2) break;
            groupSize = k + 1;
          }
        } else {
          // Slow / emphatic speech: 1 word at a time
          groupSize = 1;
        }

        groups.push({ start: groupStart, end: groupStart + groupSize - 1 });
        groupStart += groupSize;
      }
      return groups;
    }

    // --- Dynamic fallback (no word timestamps): speech-speed heuristic ---
    const wps = words.length / captionDuration;
    let wordsToShow = 1;
    if (wps >= 4.5) {
      wordsToShow = words.length <= 5 ? words.length : 3;
    } else if (wps >= 2.5) {
      wordsToShow = 2;
    } else {
      wordsToShow = 1;
    }

    const groups = [];
    for (let i = 0; i < words.length; i += wordsToShow) {
      groups.push({ start: i, end: Math.min(i + wordsToShow - 1, words.length - 1) });
    }
    return groups;
  };

  // Get highlighted word range for current time
  const getHighlightedWordRange = (caption) => {
    if (!caption) return { start: 0, end: 0 };
    const words = (caption.text || '').split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) return { start: 0, end: 0 };

    const captionDuration = caption.end_time - caption.start_time;
    const timeInCaption = Math.max(0, currentTime - caption.start_time);
    const hasWordTimestamps = caption.words && caption.words.length > 0;

    if (hasWordTimestamps) {
      let activeIdx = 0;
      for (let i = 0; i < caption.words.length; i++) {
        if (currentTime >= caption.words[i].start) {
          activeIdx = i;
        } else {
          break;
        }
      }

      return { start: activeIdx, end: activeIdx };
    }

    // Fallback: time-based group detection
    const groups = buildWordGroups(caption);
    if (groups.length === 0) return { start: 0, end: 0 };
    const groupDuration = captionDuration / groups.length;
    const currentGroup = Math.min(Math.floor(timeInCaption / groupDuration), groups.length - 1);
    return groups[currentGroup];
  };

  const getHighlightedWordIndex = (caption) => {
    return getHighlightedWordRange(caption).start;
  };

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

    const newText = e.currentTarget.textContent;
    setEditText(newText);

    // Restore cursor position after state update
    requestAnimationFrame(() => {
      if (inputRef.current) {
        const newRange = document.createRange();
        const newSelection = window.getSelection();

        let charCount = 0;
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
  const handleWordStyleChange = (key, value, skipHistory = false) => {
    if (!wordPopup || !setCaptions) return;

    const updater = skipHistory && setCaptionsRaw ? setCaptionsRaw : setCaptions;

    // Handle Text Element WORD Style Update (per-word styling)
    if (wordPopup.type === 'element') {
      updater(prev => prev.map(c => {
        if (c.id !== wordPopup.elementId) return c;

        const wordStyles = c.wordStyles || {};
        const styleKey = `${c.id}-${wordPopup.wordIndex}`;
        const currentWordStyle = wordStyles[styleKey] || {};

        return {
          ...c,
          wordStyles: {
            ...wordStyles,
            [styleKey]: { ...currentWordStyle, [key]: value }
          }
        };
      }));
      return;
    }

    // Handle Individual Word Style Update for regular captions
    const { caption, wordIndex } = wordPopup;
    if (!caption) return;

    updater(prev => prev.map(c => {
      if (c.id !== caption.id) return c;

      const wordStyles = c.wordStyles || {};
      const styleKey = `${c.id}-${wordIndex}`;
      const currentWordStyle = wordStyles[styleKey] || {};

      return {
        ...c,
        wordStyles: {
          ...wordStyles,
          [styleKey]: { ...currentWordStyle, [key]: value }
        }
      };
    }));
  };

  const getPositionStyle = () => {
    const posY = captionStyle?.position_y || 75; // Default lowered for captions
    const posX = captionStyle?.position_x || 50;

    // Always center transform to prevent visual jumping when changing anchor
    // The anchor setting will strictly affect text growth direction via StyleControls
    return {
      top: `${posY}%`,
      left: `${posX}%`,
      transform: 'translate(-50%, -50%)'
    };
  };

  const handleMouseDown = (e) => {
    if (!setCaptionStyle || e.target.classList.contains('resize-handle')) return;
    // Don't trigger caption drag if we are dragging a word
    if (draggingWord) return;

    e.preventDefault();
    e.stopPropagation();
    if (addToHistory) addToHistory();
    setIsDragging(true);
    setDragStartY(e.clientY);
    setDragStartPos(captionStyle?.position_y || 50);
  };

  const handleTextElementMouseDown = (e, elementId, currentStyle) => {
    if (!setCaptions || e.target.classList.contains('text-resize-handle')) return;
    e.preventDefault();
    e.stopPropagation();
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
    if (addToHistory) addToHistory();
    setResizedElementId(elementId);
    setElementResizeStart({
      x: e.clientX,
      initialWidth: currentStyle.width || 300,
      initialFontSize: currentStyle.fontSize || 18
    });
  };

  // ✅ ZERO-LATENCY NATIVE DRAG HANDLER
  // We use direct DOM manipulation for smooth 60fps tracking, bypassing React's render cycle.
  // State is only updated on mouseUp.
  const handleWordMouseDown = (e, caption, wordIndex, isElement = false) => {
    if (!setCaptions) return;
    e.preventDefault();
    e.stopPropagation();
    if (addToHistory) addToHistory();

    const customStyle = caption?.wordStyles?.[`${caption?.id}-${wordIndex}`] || {};
    
    // Use the element that received the event directly
    const targetElement = e.currentTarget;
    if (!targetElement) return;

    // Immediately create the dragging state
    const dragState = {
      captionId: caption.id,
      wordIndex,
      startX: e.clientX,
      startY: e.clientY,
      initialX: customStyle.x || 0,
      initialY: customStyle.y || 0,
      isElement,
      targetElement
    };
    
    setDraggingWord(dragState);
    currentDragCoordinates.current = { x: dragState.initialX, y: dragState.initialY };
    let hasMoved = false;

    const videoContainer = videoRef.current?.parentElement;
    const containerWidth = videoContainer?.offsetWidth || 1;
    const containerHeight = videoContainer?.offsetHeight || 1;

    const handleNativeMouseMove = (moveEvent) => {
      moveEvent.preventDefault();
      const deltaX = moveEvent.clientX - dragState.startX;
      const deltaY = moveEvent.clientY - dragState.startY;
      
      const newX = dragState.initialX + deltaX;
      const newY = dragState.initialY + deltaY;
      
      if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
        hasMoved = true;
      }
      
      currentDragCoordinates.current = { x: newX, y: newY };
      
      // Directly manipulate the DOM for zero-latency dragging
      targetElement.style.setProperty('transform', `translate(${newX}px, ${newY}px)`, 'important');
    };

    const handleNativeMouseUp = () => {
      document.removeEventListener('mousemove', handleNativeMouseMove);
      document.removeEventListener('mouseup', handleNativeMouseUp);
      
      // Now perform the final React state update to save the new coordinates
      if (hasMoved) {
        const finalCoords = currentDragCoordinates.current;
        if (finalCoords) {
          const parentFontSize = isElement
            ? (caption.customStyle?.fontSize || 18)
            : (captionStyle?.font_size || 18);
            
          const captionUpdater = setCaptionsRaw || setCaptions;
          captionUpdater(prev => prev.map(c => {
            if (c.id !== dragState.captionId) return c;
            const wordStyles = c.wordStyles || {};
            const styleKey = `${c.id}-${dragState.wordIndex}`;
            const currentWordStyle = wordStyles[styleKey] || {};
            
            return {
              ...c,
              wordStyles: {
                ...wordStyles,
                [styleKey]: {
                  ...currentWordStyle,
                  x: finalCoords.x,
                  y: finalCoords.y,
                  x_pct: (finalCoords.x / containerWidth) * 100,
                  y_pct: (finalCoords.y / containerHeight) * 100,
                  frozenFontSize: currentWordStyle.frozenFontSize || parentFontSize
                }
              }
            };
          }));
        }
        
        lastDragDropTime.current = Date.now();
      }
      
      setDraggingWord(null);
      currentDragCoordinates.current = null;
    };

    document.addEventListener('mousemove', handleNativeMouseMove);
    document.addEventListener('mouseup', handleNativeMouseUp);
  };

  const handleResizeMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (addToHistory) addToHistory();
    setIsResizing(true);
    setResizeStartX(e.clientX);
    setResizeStartWidth(captionWidth);
    setResizeStartFontSize(captionStyle?.font_size || 18);
  };

  // Global Mouse Move / Up for all dragging operations
  useEffect(() => {
    if ((!isDragging && !draggedElementId && !resizedElementId) || (!setCaptionStyle && !setCaptions)) return;

    const handleMouseMove = (e) => {
      // 1. Handle Caption Vertical Drag
      if (isDragging) {
        const videoContainer = captionRef.current?.parentElement;
        if (!videoContainer) return;

        const containerHeight = videoContainer.offsetHeight;
        const deltaY = e.clientY - dragStartY;
        const deltaPercent = (deltaY / containerHeight) * 100;

        let newPos = dragStartPos + deltaPercent;
        newPos = Math.max(5, Math.min(95, newPos));

        const styleUpdater = setCaptionStyleRaw || setCaptionStyle;
        styleUpdater(prev => ({ ...prev, position_y: Math.round(newPos) }));
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
        let newWidth = elementResizeStart.initialWidth + deltaX;
        newWidth = Math.max(150, Math.min(600, newWidth));

        const widthRatio = newWidth / elementResizeStart.initialWidth;
        let newFontSize = Math.round(elementResizeStart.initialFontSize * widthRatio);
        newFontSize = Math.max(12, Math.min(60, newFontSize));

        const captionUpdater = setCaptionsRaw || setCaptions;
        captionUpdater(prev => prev.map(c => {
          if (c.id !== resizedElementId) return c;
          return {
            ...c,
            customStyle: {
              ...c.customStyle,
              width: newWidth,
              fontSize: newFontSize
            }
          };
        }));
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setDraggedElementId(null);
      setResizedElementId(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStartY, dragStartPos, setCaptionStyle, setCaptions, draggedElementId, resizedElementId, elementDragStart, elementResizeStart]);

  useEffect(() => {
    if (!isResizing || !setCaptionStyle) return;

    const handleMouseMove = (e) => {
      const deltaX = e.clientX - resizeStartX;
      let newWidth = resizeStartWidth + deltaX;
      newWidth = Math.max(150, Math.min(600, newWidth));

      // Calculate proportional font size change
      const widthRatio = newWidth / resizeStartWidth;
      let newFontSize = Math.round(resizeStartFontSize * widthRatio);
      newFontSize = Math.max(12, Math.min(60, newFontSize));

      setCaptionWidth(newWidth);
      const styleUpdater = setCaptionStyleRaw || setCaptionStyle;
      styleUpdater(prev => ({ ...prev, font_size: newFontSize }));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, resizeStartX, resizeStartWidth, resizeStartFontSize, setCaptionStyle]);

  return (
    <div className="flex flex-col h-full">
      {/* Video container with 9:16 aspect ratio for mobile preview */}
      <div className="relative flex-1 bg-zinc-950 rounded-xl overflow-hidden flex items-center justify-center min-h-0">
        <div ref={videoContainerRef} className="relative w-full h-full max-h-full aspect-[9/16] bg-black shadow-2xl" onClick={(e) => {
          if (e.target === e.currentTarget && setSelectedCaptionId) setSelectedCaptionId(null);
        }}>
          {videoUrl ? (
            <MemoizedVideo
              videoRef={videoRef}
              videoUrl={videoUrl}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              setIsPlaying={setIsPlaying}
              setSelectedCaptionId={setSelectedCaptionId}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-zinc-900/50">
              <p className="text-gray-500 text-sm text-center px-4">
                Upload a video to get started
              </p>
            </div>
          )}



          {/* Caption overlays */}
          {activeCaptions.map((caption) => {
            const isEditingThis = isEditing === caption.id;
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
                className={`absolute px-3 flex justify-center ${setCaptionStyle && !isEditingThis ? 'cursor-move' : ''}`}
                style={{
                  ...getPositionStyle(),
                  // If it's a text element, maybe offset it slightly or allow it to be distinct?
                  // For now, they share the same position setting which allows dragging ONE changes ALL.
                  // This is "MVP" behavior.
                  zIndex: caption.isTextElement ? 20 : 10
                }}
                onMouseDown={setCaptionStyle && !isEditingThis ? handleMouseDown : undefined}
                onDoubleClick={(e) => handleCaptionDoubleClick(e, caption)}
              >
                <div
                  className={`rounded-lg border-2 border-solid ${selectedCaptionId === caption.id ? 'border-white/40' : 'border-transparent'} relative ${isDragging ? 'cursor-grabbing' : isEditingThis ? 'cursor-text' : setCaptionStyle ? 'cursor-grab' : ''} group ${captionStyle?.template_id || ''}`}
                  style={{
                    backgroundColor: 'transparent',
                    padding: '0px',
                    textAlign: captionStyle?.text_align || 'center',
                    width: 'fit-content',
                    maxWidth: '90vw',
                    position: 'relative',
                    display: 'inline-block',
                    '--template-primary': captionStyle?.text_color || '#ffffff',
                    '--template-secondary': captionStyle?.secondary_color || '#000000',
                    '--template-bg': captionStyle?.background_color || 'transparent',
                    '--template-highlight': captionStyle?.highlight_color || '#FFE600',
                  }}
                >
                  {/* Background layer with H multiplier support */}
                  {captionStyle?.has_background && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: -1,
                        backgroundColor: `rgba(${parseInt((captionStyle?.background_color || '#000000').slice(1, 3), 16)}, ${parseInt((captionStyle?.background_color || '#000000').slice(3, 5), 16)}, ${parseInt((captionStyle?.background_color || '#000000').slice(5, 7), 16)}, ${captionStyle?.background_opacity || 0.7})`,
                        borderRadius: '6px',
                        width: `${100 * (captionStyle?.background_h_multiplier || 1.1)}%`,
                        paddingTop: `${captionStyle?.background_padding || 6}px`,
                        paddingBottom: `${captionStyle?.background_padding || 6}px`,
                        paddingLeft: '8px',
                        paddingRight: '8px',
                        minHeight: '100%'
                      }}
                    />
                  )}

                  {/* Resize handles for regular captions */}
                  {setCaptionStyle && !isEditingThis && (
                    <>
                      <div
                        className="resize-handle absolute top-0 left-0 right-0 h-4 cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity"
                        onMouseDown={handleResizeMouseDown}
                        style={{ background: 'linear-gradient(to bottom, rgba(168, 85, 247, 0.4), transparent)' }}
                      />
                      <div
                        className="resize-handle absolute left-0 top-0 bottom-0 w-4 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity"
                        onMouseDown={handleResizeMouseDown}
                        style={{ background: 'linear-gradient(to right, rgba(168, 85, 247, 0.4), transparent)' }}
                      />
                      <div
                        className="resize-handle absolute right-0 top-0 bottom-0 w-4 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity"
                        onMouseDown={handleResizeMouseDown}
                        style={{ background: 'linear-gradient(to left, rgba(168, 85, 247, 0.4), transparent)' }}
                      />
                      <div
                        className="resize-handle absolute bottom-0 right-0 w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onMouseDown={handleResizeMouseDown}
                        style={{
                          borderRight: '3px solid rgba(168, 85, 247, 0.7)',
                          borderBottom: '3px solid rgba(168, 85, 247, 0.7)',
                          cursor: 'nwse-resize'
                        }}
                      />
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
                        fontSize: `${captionStyle?.font_size || 18}px`,
                        lineHeight: captionStyle?.line_spacing || 1.4,
                        fontWeight: captionStyle?.font_weight || 'normal',
                        fontStyle: captionStyle?.font_style || 'normal',
                        textAlign: captionStyle?.text_align || 'center',
                        letterSpacing: `${captionStyle?.letter_spacing || 0}px`,
                        wordSpacing: `${captionStyle?.word_spacing || 1}px`,
                        textDecoration: captionStyle?.text_decoration || 'none',
                        opacity: captionStyle?.text_opacity || 1,
                        transform: `scale(${captionStyle?.scale || 1})`,
                        padding: `${captionStyle?.background_padding || 6}px 8px`,
                        whiteSpace: 'nowrap',
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
                        textTransform: captionStyle?.text_case === 'uppercase' ? 'uppercase' : captionStyle?.text_case === 'lowercase' ? 'lowercase' : captionStyle?.text_case === 'capitalize' ? 'capitalize' : 'none',
                        width: '100%',
                        minWidth: '200px',
                        minHeight: '60px'
                      }}
                    >
                      {editText}
                    </div>
                  ) : captionStyle?.template_id ? (
                    // Template rendering: simple word spans with CSS class states for template effects
                    <span
                      className={`cap-text${caption.animation && caption.animation !== 'none' ? ` animate-${caption.animation}` : ''}`}
                      style={{
                        fontFamily: captionStyle?.font_family || 'Inter',
                        fontSize: `${captionStyle?.font_size || 18}px`,
                        fontWeight: captionStyle?.font_weight || 'normal',
                        fontStyle: captionStyle?.font_style || 'normal',
                        textAlign: captionStyle?.text_align || 'center',
                        display: 'block',
                        letterSpacing: `${captionStyle?.letter_spacing || 0}px`,
                        textTransform: captionStyle?.text_case === 'uppercase' ? 'uppercase' : captionStyle?.text_case === 'lowercase' ? 'lowercase' : captionStyle?.text_case === 'capitalize' ? 'capitalize' : 'none',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {(() => {
                        const words = (caption?.text || '').split(/\s+/).filter(Boolean);
                        const highlightRange = getHighlightedWordRange(caption);
                        const currentIdx = highlightRange.start;
                        return words.map((wordText, i) => {
                          const isPast = i < currentIdx;
                          const isCurrent = i === currentIdx;
                          // Word by Word: hide future words when toggle is ON (show_inactive === false)
                          if (captionStyle?.show_inactive === false && !isPast && !isCurrent) return null;
                          let cls = 'word';
                          if (isCurrent) cls += ' active current';
                          else if (isPast) cls += ' done';
                          return <span key={i} className={cls}>{wordText}{' '}</span>;
                        });
                      })()}
                    </span>
                  ) : (
                    // Custom rendering: complex word-level inline styles with backgrounds and offsets
                    <span
                      className={caption.animation ? `animate-${caption.animation}` : ''}
                      style={{
                        fontFamily: captionStyle?.font_family || 'Inter',
                        fontSize: `${captionStyle?.font_size || 18}px`,
                        lineHeight: `${(captionStyle?.font_size || 18) * (captionStyle?.line_spacing || 1.4)}px`,
                        fontWeight: captionStyle?.font_weight || 'normal',
                        fontStyle: captionStyle?.font_style || 'normal',
                        textAlign: captionStyle?.text_align || 'center',
                        display: 'block',
                        letterSpacing: `${captionStyle?.letter_spacing || 0}px`,
                        wordSpacing: `${captionStyle?.word_spacing || 1}px`,
                        textDecoration: captionStyle?.text_decoration || 'none',
                        opacity: captionStyle?.text_opacity || 1,
                        transform: `scale(${captionStyle?.scale || 1})`,

                        animation: caption.animation && caption.animation !== 'none' ? getAnimationStyle(caption.animation) : 'none',
                        color: captionStyle?.text_color || '#ffffff',
                        textTransform: captionStyle?.text_case === 'uppercase' ? 'uppercase' : captionStyle?.text_case === 'lowercase' ? 'lowercase' : captionStyle?.text_case === 'capitalize' ? 'capitalize' : 'none',
                        padding: `${captionStyle?.background_padding || 6}px 8px`,
                        position: 'relative',
                        zIndex: 10,
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {(() => {
                        let wordCounter = 0;
                        return (caption?.text || '').split(/(\s+|\n)/).map((part, i) => {
                          if (part === '\n') return <br key={i} />;
                          if (part.match(/^\s+$/)) return <span key={i}>{part}</span>;

                          const wordIndex = wordCounter++;
                          const highlightRange = getHighlightedWordRange(caption);
                          const isHighlighted = wordIndex >= highlightRange.start && wordIndex <= highlightRange.end;
                          const customStyle = caption?.wordStyles?.[`${caption?.id}-${wordIndex}`] || {};
                          const isWordClicked = wordPopup?.wordIndex === wordIndex && wordPopup?.caption?.id === caption?.id;

                          // Extract transform from customStyle - this goes on PARENT wrapper
                          const { x = 0, y = 0, animation, isEmphasis, ...restStyle } = customStyle;
                          const globalLineHeight = (captionStyle?.font_size || 18) * (captionStyle?.line_spacing || 1.4);

                          // Per-font vertical offset correction.
                          // Different fonts have different internal ascender/descender metrics.
                          // Positive = shift text DOWN (font sits high), Negative = shift UP (font sits low).
                          const FONT_VERTICAL_OFFSET_MAP = {
                            'Noto Sans': -0.06,
                            'Noto Sans Devanagari': 0.04,
                            'Mukta': -0.02,
                            'Hind': -0.03,
                            'Poppins': -0.04,
                            'Montserrat': -0.04,
                            'Inter': -0.03,
                            'Roboto': -0.03,
                          };
                          const currentFont = captionStyle?.font_family || 'Inter';
                          const fontVerticalOffset = FONT_VERTICAL_OFFSET_MAP[currentFont] ?? -0.03;
                          const fontVerticalOffsetPx = fontVerticalOffset * (captionStyle?.font_size || 18);

                          return (
                            <span
                              key={i}
                              data-word-key={`${caption?.id}-${wordIndex}`}
                              style={{
                                display: 'inline-block',
                                position: 'relative',
                                transform: `translate(${x}px, ${y}px)`,
                                transition: draggingWord ? 'none' : 'transform 0.1s ease',
                                verticalAlign: 'top',
                                cursor: 'move',
                                height: `${globalLineHeight}px`,
                              }}
                              onMouseDown={(e) => handleWordMouseDown(e, caption, wordIndex)}
                              onClick={(e) => {
                                // Only suppress click if we literally just dropped a drag (<150ms ago)
                                if (Date.now() - lastDragDropTime.current < 150) return;
                                
                                if (setWordPopup) {
                                  e.stopPropagation();
                                  setWordPopup({
                                    word: part,
                                    position: { x: e.clientX, y: e.clientY },
                                    caption: caption,
                                    wordIndex
                                  });
                                }
                              }}
                            >
                              {/* Spacer: reserves original space in sentence flow */}
                              <span
                                style={{
                                  visibility: 'hidden',
                                  fontFamily: captionStyle?.font_family || 'Inter',
                                  fontSize: `${captionStyle?.font_size || 18}px`,
                                  lineHeight: `${globalLineHeight}px`,
                                  fontWeight: captionStyle?.is_bold ? 'bold' : 'normal',
                                  letterSpacing: `${captionStyle?.letter_spacing || 0}px`,
                                  textTransform: captionStyle?.text_case === 'uppercase' ? 'uppercase' : captionStyle?.text_case === 'lowercase' ? 'lowercase' : captionStyle?.text_case === 'capitalize' ? 'capitalize' : 'none',
                                  whiteSpace: 'pre',
                                }}
                              >
                                {part}
                              </span>

                              {/* Absolute Content Wrapper - Centers text + background */}
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
                                  // Font-specific vertical offset to keep text centered in the background pill
                                  marginTop: `${fontVerticalOffsetPx}px`,
                                }}
                              >
                                {/* UNIFIED GROUP: Background wraps text, both move with parent transform */}
                                <span
                                  className={animation ? `animate-${animation}` : ''}
                                  style={{
                                    pointerEvents: 'auto',
                                    position: 'relative',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    animation: animation && animation !== 'none' ? getAnimationStyle(animation) : 'none',
                                  }}
                                >
                                  {/* BACKGROUND LAYER - Fixed padding, independent of text size */}
                                  <span
                                    style={{
                                      position: 'absolute',
                                      top: -1,
                                      left: -1,
                                      right: -1,
                                      bottom: -1,
                                      zIndex: -1,
                                      borderRadius: (isHighlighted && !isWordClicked) || isWordClicked ? '4px' : '0',
                                      // Background Priority: Local Highlight Gradient -> Local BG Color -> Global Highlight (if highlighted)
                                      ...(restStyle.highlightGradient ? {
                                        backgroundImage: restStyle.highlightGradient
                                      } : restStyle.backgroundColor ? {
                                        backgroundColor: `rgba(${parseInt(restStyle.backgroundColor.slice(1, 3), 16)}, ${parseInt(restStyle.backgroundColor.slice(3, 5), 16)}, ${parseInt(restStyle.backgroundColor.slice(5, 7), 16)}, ${restStyle.backgroundOpacity ?? 1})`
                                      } : (isHighlighted && !isWordClicked && (captionStyle?.highlight_color || captionStyle?.highlight_gradient)) ? {
                                        backgroundImage: captionStyle.highlight_gradient || undefined,
                                        backgroundColor: captionStyle.highlight_gradient ? undefined : captionStyle.highlight_color
                                      } : {}),
                                      border: isWordClicked ? '1px solid #F5A623' : 'none',
                                    }}
                                  />

                                  {/* TEXT LAYER */}
                                  <span
                                    style={{
                                      whiteSpace: 'pre',
                                      fontFamily: restStyle.fontFamily || captionStyle?.font_family || 'Inter',
                                      fontWeight: isEmphasis ? 'bold' : (restStyle.fontWeight || (captionStyle?.is_bold ? 'bold' : 'normal')),
                                      fontStyle: restStyle.fontStyle || 'normal',
                                      fontSize: isEmphasis
                                        ? `${Math.round((restStyle.fontSize || captionStyle?.font_size || 18) * 1.25)}px`
                                        : (restStyle.fontSize ? `${restStyle.fontSize}px` : undefined),
                                      transform: isEmphasis ? 'scaleY(1.08)' : undefined,
                                      lineHeight: `${globalLineHeight}px`,
                                      textAlign: restStyle.textAlign || undefined,
                                      textDecoration: restStyle.textDecoration || captionStyle?.text_decoration || 'none',
                                      textTransform: restStyle.textTransform || (captionStyle?.text_case === 'uppercase' ? 'uppercase' : captionStyle?.text_case === 'lowercase' ? 'lowercase' : captionStyle?.text_case === 'capitalize' ? 'capitalize' : 'none'),
                                      padding: restStyle.backgroundPadding !== undefined
                                        ? `${restStyle.backgroundPadding / 12}em ${Math.round(restStyle.backgroundPadding * 1.5) / 12}em`
                                        : ((isHighlighted && !isWordClicked) ? '0.05em 0.1em' : (isWordClicked ? '0.05em 0.1em' : '0.05em 0')),

                                      // Text Color Priority: Emphasis -> Local Text Gradient -> Local Color -> Global Text Gradient -> Global Color
                                      ...(isEmphasis && !restStyle.color ? {
                                        color: '#F5A623',
                                        textShadow: '0 0 12px rgba(245,166,35,0.7), 0 0 4px rgba(245,166,35,0.5)',
                                      } : restStyle.textGradient ? {
                                        backgroundImage: restStyle.textGradient,
                                        WebkitBackgroundClip: 'text',
                                        backgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent',
                                        color: 'transparent'
                                      } : restStyle.color ? {
                                        color: restStyle.color
                                      } : captionStyle?.text_gradient ? {
                                        backgroundImage: captionStyle.text_gradient,
                                        WebkitBackgroundClip: 'text',
                                        backgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent',
                                        color: 'transparent'
                                      } : {
                                        color: captionStyle?.text_color || '#ffffff'
                                      }),

                                      // Stroke/Shadow — effect_type overrides has_shadow/has_stroke; disable if text gradient active
                                      ...(() => {
                                        const efx = computeEffectCSS(captionStyle)
                                        const hasGrad = captionStyle?.text_gradient || restStyle.textGradient
                                        return {
                                          textShadow: restStyle.textShadow || efx.textShadow || (captionStyle?.has_shadow && !hasGrad ? `${captionStyle?.shadow_offset_x || 0}px ${captionStyle?.shadow_offset_y || 2}px ${captionStyle?.shadow_blur || 4}px ${captionStyle?.shadow_color || 'rgba(0,0,0,0.8)'}` : undefined),
                                          WebkitTextStroke: restStyle.WebkitTextStroke || efx.WebkitTextStroke || (captionStyle?.has_stroke === true && !hasGrad ? `${captionStyle?.stroke_width || 0.5}px ${captionStyle?.stroke_color || '#000000'}` : '0px transparent'),
                                          ...(efx.color === 'transparent' && !restStyle.color && !hasGrad ? { color: 'transparent', WebkitTextFillColor: 'transparent' } : {}),
                                        }
                                      })(),
                                    }}
                                  >
                                    {part}
                                  </span>
                                </span>
                              </span>
                            </span>
                          );
                        });
                      })()}
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Text Elements (render above captions) */}
          {activeTextElements.map((element) => {
            const style = element.customStyle || {};
            const isEditingThis = isEditing === element.id;
            const isSelected = selectedCaptionId === element.id;

            const handleDeleteElement = (e) => {
              e.stopPropagation();
              e.preventDefault();
              if (setCaptions) {
                setCaptions(prev => prev.filter(c => c.id !== element.id));
              }
            };

            return (
              <div
                key={element.id}
                className={`absolute ${isSelected ? 'ring-2 ring-[#F5A623]' : ''} ${draggedElementId === element.id ? 'cursor-grabbing' : 'cursor-grab'} group`}
                style={{
                  top: `${style.top || 50}%`,
                  left: `${style.left || 50}%`,
                  transform: 'translate(-50%, -50%)',
                  width: `${style.width || 300}px`,
                  backgroundColor: (style.hasBackground !== false) ? (style.backgroundColor ? `rgba(${parseInt(style.backgroundColor.slice(1, 3), 16)}, ${parseInt(style.backgroundColor.slice(3, 5), 16)}, ${parseInt(style.backgroundColor.slice(5, 7), 16)}, ${style.backgroundOpacity || 0.6})` : `rgba(0, 0, 0, ${style.backgroundOpacity ?? 0.7})`) : 'transparent',
                  borderRadius: `${style.borderRadius || 8}px`,
                  padding: `${style.padding || 8}px`,
                  zIndex: style.zIndex || 50
                }}
                onMouseDown={(e) => {
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
                {/* Delete button - always visible on hover */}
                {!isEditingThis && (
                  <button
                    className="absolute -top-2.5 -right-2.5 w-6 h-6 bg-zinc-900 border border-white/20 hover:border-red-500/50 hover:bg-red-500/10 rounded-full opacity-0 group-hover:opacity-100 transition-all z-50 flex items-center justify-center shadow-xl text-gray-400 hover:text-red-500"
                    onClick={handleDeleteElement}
                    title="Delete text element"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Resize handles - show for all active text elements */}
                {!isEditingThis && (
                  <>
                    <div
                      className="text-resize-handle absolute -right-1 -bottom-1 w-6 h-6 bg-[#F5A623] rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-nwse-resize flex items-center justify-center shadow-lg"
                      onMouseDown={(e) => handleTextElementResizeDown(e, element.id, style)}
                    >
                      <div className="w-3 h-3 border-r-2 border-b-2 border-white"></div>
                    </div>
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
                    className="bg-transparent border-none outline-none"
                    style={{
                      fontFamily: style.fontFamily || 'Inter',
                      fontSize: `${style.fontSize || 18}px`,
                      color: style.color || '#ffffff',
                      textAlign: style.textAlign || 'center',
                      fontWeight: style.fontWeight || 'normal',
                      fontStyle: style.fontStyle || 'normal',
                      textDecoration: style.textDecoration || 'none',
                      textTransform: style.textTransform || 'none',
                      letterSpacing: style.letterSpacing ? `${style.letterSpacing}px` : undefined,
                      lineHeight: 1.4,
                      minHeight: '40px'
                    }}
                  >
                    {editText}
                  </div>
                ) : (
                  <div
                    className={element.animation ? `animate-${element.animation}` : ''}
                    style={{
                      fontFamily: style.fontFamily || 'Inter',
                      fontSize: `${style.fontSize || 18}px`,
                      textAlign: style.textAlign || 'center',
                      textTransform: style.textTransform || 'none',
                      letterSpacing: style.letterSpacing ? `${style.letterSpacing}px` : undefined,
                      lineHeight: 1.4,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      animation: element.animation && element.animation !== 'none' ? getAnimationStyle(element.animation) : 'none'
                    }}
                  >
                    {/* Render words individually with per-word styling */}
                    {(element.text || '').split(/(\s+|\n)/).map((part, i) => {
                      if (part === '\n') return <br key={i} />;
                      if (part.match(/^\s+$/)) return <span key={i}>{part}</span>;

                      const words = (element.text || '').split(/\s+/);
                      const wordIndex = words.indexOf(part);
                      const wordStyle = element.wordStyles?.[`${element.id}-${wordIndex}`] || {};
                      const isWordClicked = wordPopup?.type === 'element' && wordPopup?.elementId === element.id && wordPopup?.wordIndex === wordIndex;
                      // Extract transform to parent - ensures text + background move together
                      const { x = 0, y = 0, animation, ...restWordStyle } = wordStyle;

                      return (
                        <span
                          key={i}
                          data-word-key={`${element.id}-${wordIndex}`}
                          style={{
                            display: 'inline-block',
                            position: 'relative',
                            transform: `translate(${x}px, ${y}px)`,
                            transition: draggingWord ? 'none' : 'transform 0.1s ease',
                            cursor: 'move',
                            height: `${(style.fontSize || 18) * 1.4}px`,
                            verticalAlign: 'top',
                          }}
                          onMouseDown={(e) => handleWordMouseDown(e, element, wordIndex, true)}
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
                              fontSize: `${style.fontSize || 18}px`,
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
                                animation: animation && animation !== 'none' ? getAnimationStyle(animation) : 'none',
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
                                    : (isWordClicked ? 'rgba(168, 85, 247, 0.3)' : undefined),
                                  border: isWordClicked ? '1px solid rgba(168, 85, 247, 0.5)' : '1px solid transparent',
                                }}
                              />

                              {/* TEXT LAYER */}
                              <span
                                style={{
                                  fontFamily: restWordStyle.fontFamily || style.fontFamily || 'Inter',
                                  fontSize: restWordStyle.fontSize ? `${restWordStyle.fontSize}px` : `${style.fontSize || 18}px`,
                                  fontWeight: restWordStyle.fontWeight || style.fontWeight || 'normal',
                                  fontStyle: restWordStyle.fontStyle || style.fontStyle || 'normal',
                                  textDecoration: restWordStyle.textDecoration || style.textDecoration || 'none',
                                  textTransform: restWordStyle.textTransform || style.textTransform || 'none',
                                  color: restWordStyle.color || style.color || '#ffffff',
                                  padding: restWordStyle.backgroundPadding ? `${restWordStyle.backgroundPadding}px` : (isWordClicked ? '2px 4px' : undefined),
                                  whiteSpace: 'pre',
                                  ...(restWordStyle.textGradient ? {
                                    backgroundImage: restWordStyle.textGradient,
                                    WebkitBackgroundClip: 'text',
                                    backgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                  } : {}),
                                  ...(style.hasStroke ? { WebkitTextStroke: `${style.strokeWidth || 1}px ${style.strokeColor || '#000000'}` } : {}),
                                  ...(style.hasShadow ? { textShadow: `${style.shadowOffsetX || 0}px ${style.shadowOffsetY || 2}px ${style.shadowBlur || 4}px ${style.shadowColor || 'rgba(0,0,0,0.8)'}` } : {}),
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
              </div>
            );
          })}

          {/* Word Click Popup */}
          {wordPopup && (
            <WordClickPopup
              word={wordPopup.word}
              position={wordPopup.position}
              onEdit={() => {
                setWordPopup(null);
                if (wordPopup.type === 'element') {
                  const element = captions.find(c => c.id === wordPopup.elementId);
                  if (element) handleCaptionDoubleClick(new Event('dblclick'), element);
                } else {
                  handleCaptionDoubleClick(new Event('dblclick'), wordPopup.caption);
                }
              }}
              onClose={() => setWordPopup(null)}
              onResetPosition={() => {
                if (addToHistory) addToHistory();
                handleWordStyleChange('x', 0);
                handleWordStyleChange('y', 0);
              }}
              currentStyle={(() => {
                if (wordPopup.type === 'element') {
                  const element = captions.find(c => c.id === wordPopup.elementId);
                  return element?.wordStyles?.[`${wordPopup.elementId}-${wordPopup.wordIndex}`] || {};
                }
                const freshCaption = captions.find(c => c.id === wordPopup.caption?.id);
                return freshCaption?.wordStyles?.[`${wordPopup.caption?.id}-${wordPopup.wordIndex}`] || {};
              })()}
              onStyleChange={handleWordStyleChange}
              onHistoryRecord={addToHistory}
              videoContainerRef={videoContainerRef}
              isElementWord={wordPopup.type === 'element'}
            />
          )}

        </div>
      </div>

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
      `}</style>

      {/* Video controls */}
      <div className="mt-4 space-y-3 px-2">
        {/* Progress bar — uses localScrubTime during drag so Dashboard state
            is NOT updated on every tick (avoids heavy re-renders & double-seek).
            Only commits the final time to Dashboard on release (onValueCommit). */}
        <Slider
          value={[localScrubTime ?? currentTime]}
          max={duration || 100}
          step={0.1}
          onValueChange={([val]) => {
            isScrubbingRef.current = true;
            setLocalScrubTime(val);
            // Do NOT seek video here — any seek during drag causes black frame until decode completes.
            // Video stays on current frame; only seeks to final position on mouse release below.
          }}
          onValueCommit={([val]) => {
            isScrubbingRef.current = false;
            setLocalScrubTime(null);
            if (videoRef.current) videoRef.current.currentTime = val;
            setCurrentTime(val);
          }}
          className="cursor-pointer"
        />

        {/* Control buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsPlaying(!isPlaying)}
              className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </Button>

            <div className="flex items-center gap-2 group">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMuted(!isMuted)}
                className="h-8 w-8 text-gray-400 hover:text-white"
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

          <span className="text-sm text-gray-400 font-mono">
            {formatTime(currentTime)} / {formatTime(duration || 0)}
          </span>
        </div>
      </div>
    </div>
  );
}

