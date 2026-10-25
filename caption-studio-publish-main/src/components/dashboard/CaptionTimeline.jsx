import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Magnet, Maximize2, Pause, Play, Scissors, Trash2, ZoomIn, ZoomOut } from 'lucide-react'
import {
  invalidateWordTimingOutsideCaption,
  shiftCaptionTiming,
  splitCaptionAtBoundary,
} from './captionEditingUtils'
import { createLiveScrubber } from './liveScrub'
import DismissibleNotice from './DismissibleNotice'

// Timeline editor: a real time scale (pixels per second) that scrolls
// natively, a ruler with round ticks, a draggable playhead, text-box lanes,
// the caption track and the audio waveform. Clips move and trim with snapping
// (playhead, clip edges, start/end; Alt turns it off); every gesture is one
// undo step. Captions never overlap each other; text boxes are free.

const RULER_HEIGHT = 24
const LANE_HEIGHT = 26
const CAPTION_HEIGHT = 34
const AUDIO_HEIGHT = 44
const TRACK_GAP = 6
const LABEL_WIDTH = 64
const PAD_X = 12
const MIN_CLIP_SECONDS = 0.1
const SNAP_PX = 8
const DRAG_START_PX = 3
const MAX_PPS = 400
const DEFAULT_VISIBLE_SECONDS = 5
const TICK_STEPS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300]

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

const formatClock = (seconds = 0, tenths = false) => {
  const safe = Math.max(0, Number(seconds) || 0)
  const mins = Math.floor(safe / 60)
  const secs = safe - mins * 60
  return tenths
    ? `${mins}:${secs.toFixed(1).padStart(4, '0')}`
    : `${mins}:${String(Math.floor(secs)).padStart(2, '0')}`
}

// Word timing as it was when the drag began, so a trim recomputes from it
// rather than from a frame that already discarded it.
const withOriginalWordTiming = (caption, original) => (
  original && original.id === caption.id
    ? { ...caption, words: original.words, word_alignment_status: original.word_alignment_status, word_alignment_note: original.word_alignment_note }
    : caption
)

// Text boxes stack into lanes so overlapping boxes never hide each other.
function assignTextLanes(textElements) {
  const laneEnds = []
  const laneOf = new Map()
  ;[...textElements]
    .sort((a, b) => (a.start_time || 0) - (b.start_time || 0))
    .forEach((element) => {
      const start = Number(element.start_time) || 0
      let lane = laneEnds.findIndex((end) => end <= start + 0.001)
      if (lane < 0) {
        lane = laneEnds.length
        laneEnds.push(0)
      }
      laneEnds[lane] = Number(element.end_time) || start
      laneOf.set(element.id, lane)
    })
  return { laneOf, laneCount: Math.max(1, laneEnds.length) }
}

// Character position between the words at `time`, for splitting a caption.
function splitCursorAt(caption, time) {
  const text = String(caption?.text || '')
  const tokens = [...text.matchAll(/\S+/g)].map((match) => ({ start: match.index, end: match.index + match[0].length }))
  if (tokens.length < 2) return -1
  const start = Number(caption.start_time) || 0
  const end = Math.max(start + 0.01, Number(caption.end_time) || start)
  const words = Array.isArray(caption.words) && caption.words.length === tokens.length ? caption.words : null
  let firstCount
  if (words && words.every((word) => Number.isFinite(Number(word?.start)) && Number.isFinite(Number(word?.end)))) {
    firstCount = words.filter((word) => (Number(word.start) + Number(word.end)) / 2 < time).length
  } else {
    const share = (time - start) / (end - start)
    const total = tokens.reduce((sum, token) => sum + (token.end - token.start), 0)
    let seen = 0
    firstCount = tokens.findIndex((token) => {
      seen += token.end - token.start
      return seen / total > share
    })
    if (firstCount < 0) firstCount = tokens.length
  }
  firstCount = clamp(firstCount, 1, tokens.length - 1)
  return tokens[firstCount - 1].end
}

export default function CaptionTimeline({
  captions,
  duration,
  currentTime,
  selectedCaptionId,
  onSelectCaption,
  onSeek,
  setCaptions,
  setCaptionsRaw,
  addToHistory = () => {},
  waveformData = null,
  isPlaying = false,
  setIsPlaying = () => {},
  collapsed = false,
  onToggleCollapsed,
  getVideoElement,
}) {
  const totalDuration = Number(duration) > 0 && Number.isFinite(Number(duration)) ? Number(duration) : 0
  const viewportRef = useRef(null)
  const contentRef = useRef(null)
  const [viewport, setViewport] = useState({ width: 0, scrollLeft: 0 })
  const [zoomPps, setZoomPps] = useState(null) // null = default view, 'fit' = whole video, number = custom
  const [snapEnabled, setSnapEnabled] = useState(true)
  const [snapGuide, setSnapGuide] = useState(null)
  const [scrubTime, setScrubTime] = useState(null)
  const [dragState, setDragState] = useState(null)
  const [dragPreview, setDragPreview] = useState(null) // the dragged clip's live times
  const [notice, setNotice] = useState('')
  const noticeTimerRef = useRef(0)
  useEffect(() => () => window.clearTimeout(noticeTimerRef.current), [])
  const lastUserScrollAt = useRef(0)
  const programmaticScroll = useRef(false)
  const liveScrubber = useMemo(() => (getVideoElement ? createLiveScrubber(getVideoElement) : null), [getVideoElement])

  const fitPps = totalDuration && viewport.width
    ? Math.max(2, (viewport.width - PAD_X * 2) / totalDuration)
    : 40
  // Default view: about DEFAULT_VISIBLE_SECONDS across the timeline (ruler
  // every 0.5 s), close enough to edit words; shorter videos simply fit.
  const defaultPps = viewport.width ? Math.max(fitPps, (viewport.width - PAD_X * 2) / DEFAULT_VISIBLE_SECONDS) : fitPps
  const pps = clamp(zoomPps === 'fit' ? fitPps : (zoomPps ?? defaultPps), fitPps, Math.max(fitPps, MAX_PPS))
  const contentWidth = Math.max(viewport.width, PAD_X * 2 + totalDuration * pps)
  const xOf = useCallback((time) => PAD_X + time * pps, [pps])
  const displayTime = scrubTime ?? currentTime ?? 0

  const textElements = useMemo(() => (captions || []).filter((item) => item && item.isTextElement), [captions])
  const speechCaptions = useMemo(() => (captions || []).filter((item) => item && !item.isTextElement), [captions])
  const { laneOf, laneCount } = useMemo(() => assignTextLanes(textElements), [textElements])
  const textTop = RULER_HEIGHT + TRACK_GAP
  const captionTop = textTop + laneCount * LANE_HEIGHT + TRACK_GAP
  const audioTop = captionTop + CAPTION_HEIGHT + TRACK_GAP
  const totalHeight = audioTop + AUDIO_HEIGHT + TRACK_GAP

  // Track the viewport size (fit zoom) and scroll position (visible ticks).
  useLayoutEffect(() => {
    const node = viewportRef.current
    if (!node) return undefined
    const measure = () => setViewport({ width: node.clientWidth, scrollLeft: node.scrollLeft })
    measure()
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    observer?.observe(node)
    return () => observer?.disconnect()
  }, [collapsed])

  const handleScroll = () => {
    const node = viewportRef.current
    if (!node) return
    if (!programmaticScroll.current) lastUserScrollAt.current = Date.now()
    programmaticScroll.current = false
    setViewport((prev) => (prev.scrollLeft === node.scrollLeft ? prev : { ...prev, scrollLeft: node.scrollLeft }))
  }

  const scrollToX = (left) => {
    const node = viewportRef.current
    if (!node) return
    programmaticScroll.current = true
    node.scrollLeft = Math.max(0, left)
  }

  // Zoom keeping the time under `anchorClientX` (or the playhead) in place.
  const zoomTo = (nextPps, anchorClientX = null) => {
    const node = viewportRef.current
    if (!node || !totalDuration) return
    const bounded = clamp(nextPps, fitPps, Math.max(fitPps, MAX_PPS))
    const rect = node.getBoundingClientRect()
    const anchorViewportX = anchorClientX === null ? xOf(displayTime) - node.scrollLeft : anchorClientX - rect.left
    const anchorTime = (node.scrollLeft + anchorViewportX - PAD_X) / pps
    setZoomPps(bounded <= fitPps + 0.001 ? 'fit' : bounded)
    requestAnimationFrame(() => scrollToX(PAD_X + anchorTime * bounded - anchorViewportX))
  }

  // Ctrl/Cmd + wheel zooms around the cursor (non-passive to stop page zoom).
  useEffect(() => {
    const node = viewportRef.current
    if (!node) return undefined
    const onWheel = (event) => {
      if (!(event.ctrlKey || event.metaKey)) return
      event.preventDefault()
      zoomTo(pps * (event.deltaY < 0 ? 1.25 : 0.8), event.clientX)
    }
    node.addEventListener('wheel', onWheel, { passive: false })
    return () => node.removeEventListener('wheel', onWheel)
  })

  // Follow the playhead while playing, unless the user just scrolled.
  useEffect(() => {
    if (!isPlaying || scrubTime !== null || dragState || !viewport.width) return
    if (Date.now() - lastUserScrollAt.current < 1500) return
    const x = xOf(displayTime)
    const left = viewport.scrollLeft
    if (x < left + 16 || x > left + viewport.width * 0.9) scrollToX(x - viewport.width * 0.15)
  }, [displayTime, isPlaying, scrubTime, dragState, viewport.width, viewport.scrollLeft, xOf])

  // Ruler ticks: round steps sized to the zoom, only the visible range.
  const ticks = useMemo(() => {
    if (!totalDuration || !viewport.width) return { major: [], minor: [], step: 1 }
    const major = TICK_STEPS.find((step) => step * pps >= 64) || TICK_STEPS[TICK_STEPS.length - 1]
    const minorStep = major / 5 * pps >= 8 ? major / 5 : major / 2
    const from = Math.max(0, (viewport.scrollLeft - PAD_X) / pps - major)
    const to = Math.min(totalDuration, (viewport.scrollLeft + viewport.width) / pps + major)
    const list = (step) => {
      const out = []
      for (let t = Math.floor(from / step) * step; t <= to + 1e-6; t += step) out.push(Number(t.toFixed(3)))
      return out
    }
    return { major: list(major), minor: list(minorStep), step: major }
  }, [pps, totalDuration, viewport.scrollLeft, viewport.width])

  const waveformBars = useMemo(() => {
    const source = Array.isArray(waveformData) && waveformData.length ? waveformData : []
    if (!source.length) return []
    const count = Math.min(source.length, 600)
    const block = source.length / count
    const bars = Array.from({ length: count }, (_, index) => {
      let peak = 0
      for (let i = Math.floor(index * block); i < Math.min(source.length, Math.floor((index + 1) * block)); i += 1) peak = Math.max(peak, Math.abs(Number(source[i]) || 0))
      return peak
    })
    const max = Math.max(0.001, ...bars)
    return bars.map((value) => Math.max(0.06, value / max))
  }, [waveformData])

  // ---------- scrubbing ----------
  const timeFromClientX = (clientX) => {
    const rect = contentRef.current?.getBoundingClientRect()
    if (!rect) return 0
    return clamp((clientX - rect.left - PAD_X) / pps, 0, totalDuration)
  }

  const startScrub = (event) => {
    if (!totalDuration || event.button > 0) return
    event.preventDefault()
    const wasPlaying = isPlaying
    if (wasPlaying) setIsPlaying(false)
    const pointerId = event.pointerId
    const update = (clientX) => {
      const time = timeFromClientX(clientX)
      setScrubTime(time)
      liveScrubber?.scrubTo(time)
      return time
    }
    let last = update(event.clientX)
    const move = (moveEvent) => {
      if (moveEvent.pointerId !== pointerId) return
      last = update(moveEvent.clientX)
    }
    const end = (endEvent) => {
      if (endEvent.pointerId !== pointerId) return
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      liveScrubber?.end()
      // A cancelled pointer is a touch swipe that became a scroll: no seek.
      if (endEvent.type === 'pointercancel') {
        if (getVideoElement?.()) getVideoElement().currentTime = currentTime || 0
      } else {
        onSeek(last)
      }
      setScrubTime(null)
      if (wasPlaying) setIsPlaying(true)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
  }

  // ---------- clip move / trim ----------
  const snapPointsFor = (excludeId) => {
    const points = [0, totalDuration, currentTime || 0]
    ;(captions || []).forEach((item) => {
      if (!item || item.id === excludeId) return
      points.push(Number(item.start_time) || 0, Number(item.end_time) || 0)
    })
    return points
  }

  const speechBounds = (original) => {
    const others = speechCaptions.filter((item) => item.id !== original.id).sort((a, b) => a.start_time - b.start_time)
    const previous = [...others].reverse().find((item) => item.end_time <= original.start_time + 0.001)
    const next = others.find((item) => item.start_time >= original.end_time - 0.001)
    return { minStart: previous ? previous.end_time : 0, maxEnd: next ? next.start_time : totalDuration }
  }

  const startClipGesture = (event, clip, kind) => {
    if (event.button > 0) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.closest('[data-timeline-root]')?.focus({ preventScroll: true })
    const original = clip
    const startX = event.clientX
    const pointerId = event.pointerId
    const rawSet = setCaptionsRaw || setCaptions
    const bounds = original.isTextElement ? { minStart: 0, maxEnd: totalDuration } : speechBounds(original)
    const length = original.end_time - original.start_time
    let moved = false
    // While dragging, only the timeline re-renders (a local preview, at most
    // once per frame); the captions are written once on release. Writing them
    // on every pointer move re-rendered the whole editor and stuttered.
    let latest = null
    let frame = 0
    const flushPreview = () => {
      frame = 0
      if (!latest) return
      setDragPreview(latest.next)
      setSnapGuide(latest.guide)
    }

    const move = (moveEvent) => {
      if (moveEvent.pointerId !== pointerId) return
      const dx = moveEvent.clientX - startX
      if (!moved) {
        if (Math.abs(dx) < DRAG_START_PX || !totalDuration) return
        moved = true
        addToHistory()
        setDragState({ id: original.id, kind })
      }
      const dt = dx / pps
      const threshold = SNAP_PX / pps
      const snapping = snapEnabled && !moveEvent.altKey
      const points = snapping ? snapPointsFor(original.id) : []
      const nearest = (value) => points.reduce((best, point) => (
        Math.abs(point - value) < threshold && (!best || Math.abs(point - value) < Math.abs(best.point - value))
          ? { point, delta: point - value }
          : best
      ), null)

      let next
      let guide = null
      if (kind === 'move') {
        let start = original.start_time + dt
        const atStart = nearest(start)
        const atEnd = nearest(start + length)
        const snap = [atStart, atEnd].filter(Boolean).sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta))[0]
        if (snap) {
          start += snap.delta
          guide = snap.point
        }
        start = clamp(start, bounds.minStart, Math.max(bounds.minStart, bounds.maxEnd - length))
        next = shiftCaptionTiming(original, start - original.start_time)
      } else if (kind === 'trim-start') {
        let start = original.start_time + dt
        const snap = nearest(start)
        if (snap) {
          start = snap.point
          guide = snap.point
        }
        start = clamp(start, bounds.minStart, original.end_time - MIN_CLIP_SECONDS)
        next = invalidateWordTimingOutsideCaption({ ...original, start_time: start })
      } else {
        let end = original.end_time + dt
        const snap = nearest(end)
        if (snap) {
          end = snap.point
          guide = snap.point
        }
        end = clamp(end, original.start_time + MIN_CLIP_SECONDS, bounds.maxEnd)
        next = invalidateWordTimingOutsideCaption({ ...original, end_time: end })
      }
      latest = { next, guide }
      if (!frame) frame = requestAnimationFrame(flushPreview)
    }

    const end = (endEvent) => {
      if (endEvent.pointerId !== pointerId) return
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      if (frame) cancelAnimationFrame(frame)
      setSnapGuide(null)
      setDragState(null)
      setDragPreview(null)
      if (!moved) {
        // A click selects the clip; clicking its body also jumps to its start.
        onSelectCaption?.(original.id)
        if (kind === 'move') onSeek(original.start_time || 0)
        return
      }
      const next = latest?.next
      if (next) {
        rawSet((prev) => {
          const updated = prev.map((item) => (item.id === original.id ? { ...withOriginalWordTiming(item, original), ...next } : item))
          // Captions stay in time order (the editor and export read them in order).
          return original.isTextElement
            ? updated
            : [...updated.filter((item) => item.isTextElement), ...updated.filter((item) => !item.isTextElement).sort((a, b) => a.start_time - b.start_time)]
        })
      }
      onSelectCaption?.(original.id)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
  }

  // ---------- commands ----------
  const flash = (message) => {
    setNotice(message)
    window.clearTimeout(noticeTimerRef.current)
    noticeTimerRef.current = window.setTimeout(() => setNotice(''), 2600)
  }

  const selectedClip = (captions || []).find((item) => item?.id === selectedCaptionId) || null

  const splitAtPlayhead = () => {
    const time = currentTime || 0
    const inside = (item) => item && time > item.start_time + 0.05 && time < item.end_time - 0.05
    const target = inside(selectedClip) ? selectedClip : speechCaptions.find(inside) || textElements.find(inside)
    if (!target) {
      flash('Move the playhead inside a clip to split it.')
      return
    }
    let parts
    if (target.isTextElement) {
      const newId = `text-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const secondStyles = Object.fromEntries(Object.entries(target.wordStyles || {}).map(([key, value]) => [`${newId}${key.slice(String(target.id).length)}`, value]))
      parts = [{ ...target, end_time: time }, { ...target, id: newId, start_time: time, wordStyles: secondStyles }]
    } else {
      const cursor = splitCursorAt(target, time)
      const result = cursor < 0 ? { error: 'A caption needs at least two words to split.' } : splitCaptionAtBoundary(target, cursor, `${Date.now()}-split`)
      if (result.error) {
        flash(result.error)
        return
      }
      parts = result.captions
    }
    setCaptions((captions || []).flatMap((item) => (item.id === target.id ? parts : [item])))
    onSelectCaption?.(parts[1].id)
  }

  const deleteSelected = () => {
    if (!selectedClip) {
      flash('Select a clip to delete it.')
      return
    }
    setCaptions((captions || []).filter((item) => item.id !== selectedClip.id))
    onSelectCaption?.(null)
  }

  const nudgeSelected = (delta) => {
    if (!selectedClip) return
    const bounds = selectedClip.isTextElement ? { minStart: 0, maxEnd: totalDuration } : speechBounds(selectedClip)
    const length = selectedClip.end_time - selectedClip.start_time
    const start = clamp(selectedClip.start_time + delta, bounds.minStart, Math.max(bounds.minStart, bounds.maxEnd - length))
    if (Math.abs(start - selectedClip.start_time) < 0.001) return
    setCaptions((captions || []).map((item) => (item.id === selectedClip.id ? shiftCaptionTiming(item, start - item.start_time) : item)))
  }

  const handleKeyDown = (event) => {
    if (event.target.closest?.('input, textarea, [contenteditable="true"]')) return
    const key = event.key
    if (key === 's' || key === 'S') splitAtPlayhead()
    else if (key === 'Delete' || key === 'Backspace') deleteSelected()
    else if (key === 'ArrowLeft' || key === 'ArrowRight') nudgeSelected((key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? 1 : 0.1))
    else if (key === '+' || key === '=') zoomTo(pps * 1.5)
    else if (key === '-' || key === '_') zoomTo(pps / 1.5)
    else if (key === '0') zoomTo(fitPps)
    else return
    event.preventDefault()
  }

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
    )
  }

  const toolButton = 'inline-flex h-7 min-w-7 items-center justify-center gap-1 rounded-md px-1.5 text-[10px] font-semibold text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-40'
  const handleWidth = 'w-2 [@media(pointer:coarse)]:w-3.5'
  const playheadX = xOf(clamp(displayTime, 0, totalDuration || 0))

  const renderClip = (storedClip, { top, height, label, isText }) => {
    const clip = dragPreview && dragPreview.id === storedClip.id ? dragPreview : storedClip
    const left = xOf(Number(clip.start_time) || 0)
    const width = Math.max(4, (Math.max(0, (Number(clip.end_time) || 0) - (Number(clip.start_time) || 0))) * pps)
    const isSelected = selectedCaptionId === clip.id
    const isActive = !isText && displayTime >= clip.start_time && displayTime < clip.end_time
    const isDragging = dragState?.id === clip.id
    const tone = isText
      ? (isSelected ? 'border-[#c99bff] bg-[#7c3aed]/45 text-white' : 'border-[#9b6cff]/40 bg-[#7c3aed]/20 text-violet-100 hover:bg-[#7c3aed]/30')
      : (isSelected ? 'border-sky-300/70 bg-[#2f3f55] text-white' : isActive ? 'border-[#6b7280] bg-[#333844] text-white' : 'border-[#4a4d59] bg-[#2a2d35] text-[#c7ccd7] hover:bg-[#313540]')
    return (
      <div
        key={clip.id}
        role="button"
        tabIndex={-1}
        aria-label={`${isText ? 'Text box' : 'Caption'} ${formatClock(clip.start_time, true)} to ${formatClock(clip.end_time, true)}: ${clip.text || ''}`}
        aria-pressed={isSelected}
        data-caption-block="true"
        data-clip-id={clip.id}
        data-clip-kind={isText ? 'text' : 'caption'}
        className={`absolute flex touch-none select-none items-center overflow-hidden rounded-[5px] border text-[10px] font-semibold ${tone} ${isDragging ? 'z-30 shadow-[0_8px_20px_rgba(0,0,0,0.45)] cursor-grabbing' : 'z-10 cursor-grab'}`}
        style={{ left, width, top, height }}
        onPointerDown={(event) => startClipGesture(event, clip, 'move')}
      >
        <span
          className={`cursor-ew-resize absolute inset-y-0 left-0 z-10 ${handleWidth} rounded-l-[5px] hover:bg-white/25`}
          onPointerDown={(event) => startClipGesture(event, clip, 'trim-start')}
        />
        <div className="pointer-events-none min-w-0 flex-1 truncate px-2.5" dir="auto">{label}</div>
        <span
          className={`cursor-ew-resize absolute inset-y-0 right-0 z-10 ${handleWidth} rounded-r-[5px] hover:bg-white/25`}
          onPointerDown={(event) => startClipGesture(event, clip, 'trim-end')}
        />
      </div>
    )
  }

  return (
    <div
      data-timeline-root="true"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-[18px] border border-white/10 bg-[#0d0d0d]/95 shadow-[0_12px_32px_-24px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.04)] outline-none focus-visible:border-sky-300/40"
    >
      {/* Toolbar: a click anywhere on the bar (outside its controls) collapses it */}
      <div
        className={`flex h-9 shrink-0 items-center gap-1 border-b border-white/[0.06] px-2 ${onToggleCollapsed ? 'cursor-pointer' : ''}`}
        title={onToggleCollapsed ? 'Collapse timeline' : undefined}
        onClick={(event) => {
          if (!onToggleCollapsed || event.target.closest('button, input, a, [role="slider"]')) return
          onToggleCollapsed()
        }}
      >
        {onToggleCollapsed && (
          <button type="button" onClick={onToggleCollapsed} className={`${toolButton} gap-1.5 pr-2`} title="Collapse timeline">
            <span className="text-xs leading-none text-slate-400">v</span>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white">Timeline</span>
          </button>
        )}
        <button type="button" onClick={() => setIsPlaying(!isPlaying)} className={`${toolButton} bg-white !text-black hover:!bg-slate-200`} aria-label={isPlaying ? 'Pause' : 'Play'} title={isPlaying ? 'Pause' : 'Play'}>
          {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="ml-0.5 h-3.5 w-3.5" />}
        </button>
        <span className="min-w-[78px] px-1 font-mono text-[10px] tabular-nums text-sky-100" aria-live="off">
          {formatClock(displayTime, true)} <span className="text-slate-600">/ {formatClock(totalDuration, true)}</span>
        </span>
        <span className="mx-1 h-4 w-px bg-white/10" />
        <button type="button" onClick={splitAtPlayhead} className={toolButton} title="Split the clip at the playhead (S)" aria-label="Split at playhead">
          <Scissors className="h-3.5 w-3.5" /><span className="hidden sm:inline">Split</span>
        </button>
        <button type="button" onClick={deleteSelected} disabled={!selectedClip} className={toolButton} title="Delete the selected clip (Delete)" aria-label="Delete selected clip">
          <Trash2 className="h-3.5 w-3.5" /><span className="hidden sm:inline">Delete</span>
        </button>
        <button
          type="button"
          onClick={() => setSnapEnabled((value) => !value)}
          aria-pressed={snapEnabled}
          className={`${toolButton} ${snapEnabled ? '!text-[#F5A623]' : ''}`}
          title="Snap to the playhead and clip edges (hold Alt to drag freely)"
          aria-label="Snapping"
        >
          <Magnet className="h-3.5 w-3.5" /><span className="hidden md:inline">Snap</span>
        </button>
        {notice && <DismissibleNotice key={notice} closeLabel="Close timeline notification" onDismiss={() => setNotice('')} contentClassName="min-w-0 truncate" className="ml-1 min-w-0 text-[10px] text-amber-200">{notice}</DismissibleNotice>}
        <div className="ml-auto flex items-center gap-1">
          <span className="hidden text-[9px] text-slate-600 lg:inline">{captions?.length || 0} elements</span>
          <button type="button" onClick={() => zoomTo(pps / 1.5)} className={toolButton} title="Zoom out (-)" aria-label="Zoom out">
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <input
            type="range"
            aria-label="Timeline zoom"
            min={0}
            max={100}
            value={Math.round((Math.log(pps / fitPps) / Math.log(Math.max(1.0001, MAX_PPS / fitPps))) * 100) || 0}
            onChange={(event) => zoomTo(fitPps * Math.pow(Math.max(1.0001, MAX_PPS / fitPps), Number(event.target.value) / 100))}
            className="hidden h-1 w-20 cursor-pointer accent-white sm:block"
          />
          <button type="button" onClick={() => zoomTo(pps * 1.5)} className={toolButton} title="Zoom in (+)" aria-label="Zoom in">
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => zoomTo(fitPps)} className={toolButton} title="Fit the whole video (0)" aria-label="Fit timeline">
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Tracks: labels stay put, the time area scrolls horizontally */}
      <div className="flex min-h-0 flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
        <div className="relative shrink-0 border-r border-white/[0.06] bg-black/20" style={{ width: LABEL_WIDTH, height: totalHeight }}>
          {[['Text', textTop, laneCount * LANE_HEIGHT], ['Captions', captionTop, CAPTION_HEIGHT], ['Audio', audioTop, AUDIO_HEIGHT]].map(([name, top, height]) => (
            <div key={name} className="absolute left-0 right-0 flex items-center px-2 text-[8px] font-semibold uppercase tracking-[0.16em] text-slate-500" style={{ top, height }}>
              {name}
            </div>
          ))}
        </div>

        <div ref={viewportRef} onScroll={handleScroll} className="relative min-w-0 flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar">
          <div
            ref={contentRef}
            className="relative select-none"
            style={{ width: contentWidth, height: totalHeight }}
            onPointerDown={(event) => {
              if (event.target.closest('[data-caption-block]')) return
              startScrub(event)
            }}
          >
            {/* Ruler */}
            <div className="absolute inset-x-0 top-0 cursor-col-resize border-b border-white/[0.06] bg-black/30" style={{ height: RULER_HEIGHT }}>
              {ticks.minor.map((time) => (
                <span key={`m-${time}`} className="absolute bottom-0 h-1.5 w-px bg-white/10" style={{ left: xOf(time) }} />
              ))}
              {ticks.major.map((time) => (
                <span key={`M-${time}`} className="absolute bottom-0 h-3 w-px bg-white/25" style={{ left: xOf(time) }}>
                  <span className="absolute -top-[9px] left-1 whitespace-nowrap font-mono text-[8px] text-slate-500">
                    {formatClock(time, ticks.step < 1)}
                  </span>
                </span>
              ))}
            </div>

            {/* Track backgrounds and second gridlines */}
            {Array.from({ length: laneCount }).map((_, lane) => (
              <div key={`lane-${lane}`} className="absolute inset-x-0 border-b border-white/[0.03]" style={{ top: textTop + lane * LANE_HEIGHT, height: LANE_HEIGHT, background: lane % 2 ? 'transparent' : 'rgba(255,255,255,0.012)' }} />
            ))}
            <div className="absolute inset-x-0 border-y border-white/[0.05] bg-white/[0.015]" style={{ top: captionTop, height: CAPTION_HEIGHT }} />
            <div className="absolute inset-x-0 border-y border-white/[0.05]" style={{ top: audioTop, height: AUDIO_HEIGHT }} />
            {ticks.major.map((time) => (
              <span key={`g-${time}`} className="pointer-events-none absolute w-px bg-white/[0.04]" style={{ left: xOf(time), top: RULER_HEIGHT, height: totalHeight - RULER_HEIGHT }} />
            ))}

            {/* Clips */}
            {textElements.map((clip) => renderClip(clip, {
              top: textTop + (laneOf.get(clip.id) || 0) * LANE_HEIGHT + 3,
              height: LANE_HEIGHT - 6,
              label: clip.text || 'Text',
              isText: true,
            }))}
            {speechCaptions.map((clip, index) => renderClip(clip, {
              top: captionTop + 3,
              height: CAPTION_HEIGHT - 6,
              label: `${String(index + 1).padStart(2, '0')} ${clip.text || ''}`,
              isText: false,
            }))}

            {/* Audio */}
            {waveformBars.length === 0 && (
              <span
                className="pointer-events-none absolute whitespace-nowrap text-[9px] text-slate-600"
                style={{ left: viewport.scrollLeft + PAD_X, top: audioTop + AUDIO_HEIGHT / 2 - 6 }}
              >
                Waveform unavailable for this video
              </span>
            )}
            {waveformBars.length > 0 && totalDuration > 0 && (
              <svg
                className="pointer-events-none absolute"
                style={{ left: PAD_X, top: audioTop + 4, width: totalDuration * pps, height: AUDIO_HEIGHT - 8 }}
                viewBox={`0 0 ${waveformBars.length} 100`}
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                {waveformBars.map((value, index) => (
                  <rect key={index} x={index + 0.15} width={0.7} y={50 - value * 48} height={value * 96} fill="rgba(255,255,255,0.32)" />
                ))}
              </svg>
            )}

            {/* Snap guide */}
            {snapGuide !== null && (
              <span className="pointer-events-none absolute z-40 w-px bg-[#F5A623] shadow-[0_0_6px_rgba(245,166,35,0.8)]" style={{ left: xOf(snapGuide), top: 0, height: totalHeight }} />
            )}

            {/* Playhead: drag its handle (or the ruler / empty track) to scrub */}
            <div className="pointer-events-none absolute top-0 z-50 w-px bg-white" style={{ left: playheadX, height: totalHeight }}>
              <span
                data-timeline-playhead="true"
                className="pointer-events-auto absolute -left-[6px] top-0 h-3.5 w-[13px] cursor-col-resize rounded-b-[4px] rounded-t-[2px] bg-white shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
                onPointerDown={startScrub}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
