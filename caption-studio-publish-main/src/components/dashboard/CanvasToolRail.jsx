import React from 'react'
import { Grid2X2, Maximize2, Minimize2, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react'

// Floating zoom/guides/reset/fullscreen rail beside the preview.
export default function CanvasToolRail({ isVideoFullscreen, guidesActive, onToolClick, onToggleFullscreen }) {
  const tools = [
    { icon: ZoomIn, title: 'Zoom in', key: 'zoom-in', active: false },
    { icon: ZoomOut, title: 'Zoom out', key: 'zoom-out', active: false },
    { icon: Grid2X2, title: 'Guides', key: 'guides', active: guidesActive },
    { icon: RotateCcw, title: 'Reset view', key: 'reset', active: false },
  ]
  const fullscreenLabel = isVideoFullscreen ? 'Collapse preview' : 'Expand preview'
  return (
    <div
      role="toolbar"
      aria-label="Preview tools"
      aria-orientation="vertical"
      className={`absolute top-1/2 -translate-y-1/2 z-50 rounded-xl border border-white/10 bg-[#0d0d0d]/90 p-1.5 shadow-[0_18px_42px_-24px_rgba(0,0,0,0.9)] backdrop-blur-md ${isVideoFullscreen ? 'left-2 lg:left-[24%]' : 'max-lg:hidden left-2 sm:left-4'}`}
    >
      {tools.map(({ icon: Icon, title, key, active }) => (
        <button
          key={key}
          type="button"
          className={`mb-1 flex h-7 w-7 items-center justify-center rounded-lg transition-colors last:mb-0 ${
            active ? 'bg-white text-black' : 'text-slate-500 hover:bg-white/5 hover:text-white'
          }`}
          title={title}
          aria-label={title}
          aria-pressed={key === 'guides' ? active : undefined}
          onClick={(e) => onToolClick(key, e)}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      ))}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onToggleFullscreen()
        }}
        className="mt-1 flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-white/5 hover:text-white"
        title={`${isVideoFullscreen ? 'Collapse' : 'Expand'} (F)`}
        aria-label={fullscreenLabel}
        aria-keyshortcuts="F"
      >
        {isVideoFullscreen ? <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" /> : <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />}
      </button>
    </div>
  )
}
