import React from 'react'
import { Slider } from '@/components/ui/slider'

// Timeline scrubber over the preview. Dragging only moves the thumb; the
// video seeks once on release (seeking during drag shows black frames).
export default function PreviewScrubber({ value, duration, onScrub, onCommit }) {
  return (
    <div
      className="absolute left-1/2 bottom-3 z-40 w-[82%] max-w-[248px] -translate-x-1/2"
      data-video-control
    >
      <Slider
        value={[value]}
        max={duration || 100}
        step={0.1}
        aria-label="Seek video"
        onValueChange={([val]) => onScrub(val)}
        onValueCommit={([val]) => onCommit(val)}
        className="cursor-pointer"
        trackClassName="h-[4px] bg-white/24"
        rangeClassName="h-[4px] bg-white"
        thumbClassName="h-3 w-3 border border-white bg-[#050505] shadow-[0_0_0_1.5px_#ffffff,0_0_0_3px_rgba(5,5,5,0.82),0_5px_12px_rgba(0,0,0,0.24)]"
      />
    </div>
  )
}
