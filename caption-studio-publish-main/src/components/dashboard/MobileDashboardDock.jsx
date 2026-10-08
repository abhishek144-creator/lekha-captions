import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Clock3, Maximize2, Pause, PencilLine, Play, SlidersHorizontal, Sparkles } from 'lucide-react'
import { motion, useDragControls } from 'framer-motion'
import { Slider } from '@/components/ui/slider'

const formatClock = (seconds) => {
  const safe = Math.max(0, Number(seconds) || 0)
  const mins = Math.floor(safe / 60)
  const secs = Math.floor(safe % 60)
  return `${mins}:${String(secs).padStart(2, '0')}`
}

// Centers a child inside a horizontal scroller without scrolling any
// vertical ancestor (scrollIntoView would also move the page).
const centerInScroller = (scroller, node) => {
  if (!scroller || !node) return
  const left = node.offsetLeft - (scroller.clientWidth - node.offsetWidth) / 2
  scroller.scrollTo({ left: Math.max(0, left), behavior: 'smooth' })
}

// Phone/tablet editor chrome below the preview, modelled on Canva's mobile
// editor: the canvas is the hero, a slide-up sheet holds the active tool, and
// the bottom toolbar is contextual — global tools by default, caption tools
// while a caption is selected. A transport bar and a caption strip that
// follows playback sit under the preview.
export default function MobileDashboardDock({
  activeTab,
  tabs,
  setActiveTab,
  isSheetOpen,
  setIsSheetOpen,
  renderEditorPanel,
  renderStylePanel,
  renderTimelinePanel,
  captions,
  currentTime,
  duration,
  isPlaying,
  setIsPlaying,
  onSeek,
  selectedCaptionId,
  onSelectCaption,
  onToggleFullscreen,
}) {
  const [scrubTime, setScrubTime] = useState(null)
  const sheetDragControls = useDragControls()
  const stripRef = useRef(null)
  const chipRefs = useRef({})

  const lines = (captions || []).filter((caption) => caption && !caption.isTextElement)
  const activeLine = lines.find((caption) => (
    currentTime >= Number(caption.start_time || 0) && currentTime < Number(caption.end_time || 0)
  ))
  const activeLineId = activeLine?.id || null
  const displayTime = scrubTime ?? currentTime
  const selectedItem = (captions || []).find((caption) => caption?.id === selectedCaptionId) || null
  // Style is global for caption lines but per-element for text elements.
  const contextTools = selectedItem ? [
    { id: 'captions', label: 'Edit text', icon: PencilLine },
    { id: 'animate', label: 'Animate', icon: Sparkles },
    { id: 'timeline', label: 'Timing', icon: Clock3 },
    { id: 'style', label: selectedItem.isTextElement ? 'Style' : 'Style all', icon: SlidersHorizontal },
  ] : null
  const toolbarTools = contextTools || tabs
  const activeToolLabel = toolbarTools.find((tab) => tab.id === activeTab)?.label
    || tabs.find((tab) => tab.id === activeTab)?.label
    || 'Edit'

  useEffect(() => {
    if (isSheetOpen) return
    const focusId = activeLineId || selectedCaptionId
    if (focusId) centerInScroller(stripRef.current, chipRefs.current[focusId])
  }, [activeLineId, selectedCaptionId, isSheetOpen])

  const clearSelection = () => {
    onSelectCaption(null)
    setIsSheetOpen(false)
  }

  const openTool = (id) => {
    if (isSheetOpen && activeTab === id) {
      setIsSheetOpen(false)
      return
    }
    setActiveTab(id)
    setIsSheetOpen(true)
  }

  const renderSheetBody = () => {
    if (activeTab === 'style') return renderStylePanel()
    if (activeTab === 'timeline') {
      return (
        <div className="h-full overflow-hidden rounded-[18px]">
          {renderTimelinePanel({ inDock: true })}
        </div>
      )
    }
    return (
      <div className="h-full rounded-[18px] lekha-panel lekha-panel-corners p-3 overflow-hidden">
        {renderEditorPanel()}
      </div>
    )
  }

  return (
    <div data-mobile-dock="true" className="lg:hidden shrink-0 flex flex-col bg-[#050505]">
      {/* Transport */}
      <div className="flex items-center gap-2.5 px-3 pt-1 pb-2">
        <button
          type="button"
          onClick={() => setIsPlaying(!isPlaying)}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          className="flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-full bg-white text-black active:scale-95 transition-transform"
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
        </button>
        <span className="w-9 shrink-0 text-right font-mono text-[11px] tabular-nums text-white">
          {formatClock(displayTime)}
        </span>
        <Slider
          value={[Math.min(displayTime, duration || 0)]}
          max={duration || 0}
          step={0.01}
          disabled={!duration}
          aria-label="Seek"
          onValueChange={([value]) => setScrubTime(value)}
          onValueCommit={([value]) => {
            onSeek(value)
            setScrubTime(null)
          }}
          className="flex-1 py-3"
          trackClassName="h-1 bg-white/15"
          rangeClassName="h-1 bg-[#F5A623]"
          thumbClassName="h-5 w-5"
        />
        <span className="w-9 shrink-0 font-mono text-[11px] tabular-nums text-slate-500">
          {formatClock(duration)}
        </span>
        <button
          type="button"
          onClick={onToggleFullscreen}
          aria-label="Full screen preview"
          className="flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-full border border-white/10 text-slate-300 active:bg-white/10"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>

      {/* Caption strip: hidden while a tool sheet needs the room */}
      {!isSheetOpen && lines.length > 0 && (
        <div
          ref={stripRef}
          className="flex gap-2 overflow-x-auto px-3 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {lines.map((caption) => {
            const isActive = caption.id === activeLineId
            const isSelected = caption.id === selectedCaptionId
            return (
              <button
                key={caption.id}
                ref={(node) => { chipRefs.current[caption.id] = node }}
                type="button"
                onClick={() => {
                  onSeek(Number(caption.start_time || 0))
                  onSelectCaption(caption.id)
                }}
                className={`max-w-[11rem] shrink-0 touch-manipulation truncate rounded-xl border px-3 py-2.5 text-left text-[13px] leading-tight transition-colors ${
                  isActive
                    ? 'border-[#F5A623]/60 bg-[#F5A623]/12 text-white'
                    : isSelected
                      ? 'border-white/30 bg-white/[0.06] text-white'
                      : 'border-white/10 bg-white/[0.03] text-slate-400'
                }`}
              >
                {caption.text || '…'}
              </button>
            )
          })}
        </div>
      )}

      {/* Tool sheet */}
      {isSheetOpen && (
        <motion.section
          aria-label={`${activeToolLabel} tools`}
          initial={{ y: 48, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 420, damping: 36 }}
          drag="y"
          dragListener={false}
          dragControls={sheetDragControls}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.7 }}
          dragSnapToOrigin
          onDragEnd={(_, info) => {
            if (info.offset.y > 70 || info.velocity.y > 500) setIsSheetOpen(false)
          }}
          className="relative rounded-t-[22px] border-t border-white/10 bg-[#0a0a0a] shadow-[0_-18px_40px_-28px_rgba(0,0,0,0.95)]"
        >
          {/* Grab handle + header: drag down to close, like a native sheet. */}
          <div
            onPointerDown={(event) => sheetDragControls.start(event)}
            className="touch-none select-none"
          >
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-white/20" aria-hidden="true" />
            <div className="flex items-center justify-between px-4 pt-1.5 pb-1.5">
              <span className="text-[13px] font-bold text-white">{activeToolLabel}</span>
              <button
                type="button"
                onClick={() => setIsSheetOpen(false)}
                aria-label="Close panel"
                className="flex h-10 w-10 touch-manipulation items-center justify-center rounded-full bg-white/[0.06] text-slate-200 active:bg-white/15"
              >
                <ChevronDown className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="lekha-mobile-sheet h-[44dvh] min-h-[230px] max-h-[460px] overflow-hidden px-2 pb-2">
            {renderSheetBody()}
          </div>
        </motion.section>
      )}

      {/* Toolbar: caption tools while a caption is selected, else global */}
      <nav
        aria-label={contextTools ? 'Selected caption tools' : 'Editor tools'}
        className="grid border-t border-white/10 bg-[#080808] pb-[env(safe-area-inset-bottom)]"
        style={{ gridTemplateColumns: `repeat(${toolbarTools.length + (contextTools ? 1 : 0)}, minmax(0, 1fr))` }}
      >
        {contextTools && (
          <button
            type="button"
            onClick={clearSelection}
            aria-label="Deselect caption"
            className="flex min-w-0 touch-manipulation flex-col items-center gap-1 border-r border-white/10 pt-2.5 pb-2 text-[#F5A623]"
          >
            <span className="flex h-7 w-9 items-center justify-center rounded-full bg-[#F5A623]/15">
              <Check className="h-[18px] w-[18px]" />
            </span>
            <span className="w-full truncate text-center text-[10px] font-semibold leading-none tracking-tight">Done</span>
          </button>
        )}
        {toolbarTools.map((tab) => {
          const Icon = tab.icon
          const active = isSheetOpen && activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => openTool(tab.id)}
              aria-pressed={active}
              className={`flex min-w-0 touch-manipulation flex-col items-center gap-1 pt-2.5 pb-2 transition-colors ${
                active ? 'text-white' : 'text-slate-500 active:text-white'
              }`}
            >
              <span className={`flex h-7 w-9 items-center justify-center rounded-full transition-colors ${active ? 'bg-white text-black' : ''}`}>
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <span className="w-full truncate text-center text-[10px] font-semibold leading-none tracking-tight">{tab.label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
