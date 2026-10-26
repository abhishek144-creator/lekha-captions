import React, { useRef, useState } from 'react'

// Snap points (timeline heights, px) the divider pulls toward while dragging.
const SNAP_BALANCED = 148
const SNAP_MAX_TIMELINE = 300
const SNAP_THRESHOLD = 20
const MAX_TIMELINE_HEIGHT = 400

// Premiere-style divider between the preview and the expanded timeline.
// Dragging up grows the timeline; double-click collapses it.
export default function TimelineResizeHandle({ timelineHeight, setTimelineHeight, minHeight, onCollapse }) {
  const [isSnapping, setIsSnapping] = useState(false)
  const dragRef = useRef(null)

  const handleMouseDown = (event) => {
    event.preventDefault()
    dragRef.current = { startY: event.clientY, startHeight: timelineHeight }
    const snaps = [minHeight, SNAP_BALANCED, SNAP_MAX_TIMELINE]
    const onMove = (moveEvent) => {
      if (!dragRef.current) return
      const delta = dragRef.current.startY - moveEvent.clientY
      let height = Math.max(minHeight, Math.min(MAX_TIMELINE_HEIGHT, dragRef.current.startHeight + delta))
      const snap = snaps.find((point) => Math.abs(height - point) <= SNAP_THRESHOLD)
      if (snap !== undefined) height = snap
      setIsSnapping(snap !== undefined)
      setTimelineHeight(height)
    }
    const onUp = () => {
      dragRef.current = null
      setIsSnapping(false)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  return (
    <div
      data-editor-panel="true"
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize timeline. Double-click to collapse."
      className="absolute left-0 right-0 z-[80] hidden h-1.5 cursor-ns-resize items-center justify-center group lg:flex"
      style={{ bottom: `${timelineHeight + 28}px` }}
      onMouseDown={handleMouseDown}
      onDoubleClick={onCollapse}
    >
      <div className={`w-full h-px transition-colors ${isSnapping ? 'bg-yellow-400/60' : 'bg-white/5 group-hover:bg-white/15'}`} />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className={`w-8 h-1 rounded-full transition-colors ${isSnapping ? 'bg-yellow-400/80' : 'bg-white/10 group-hover:bg-white/25'}`} />
      </div>
    </div>
  )
}
