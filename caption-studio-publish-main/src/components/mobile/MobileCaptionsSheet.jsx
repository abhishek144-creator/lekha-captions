import React from 'react'
import { Play } from 'lucide-react'
import MobileBottomSheet from './MobileBottomSheet'

const formatTime = (seconds) => {
  const s = Math.max(0, seconds || 0)
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

// Transcript editor: tap the play chip to seek, edit text inline.
// Text edits go through onUpdateCaptionText which records history upstream.
export default function MobileCaptionsSheet({
  open,
  onClose,
  captions,
  currentTime,
  onSeek,
  onUpdateCaptionText,
}) {
  const spokenCaptions = captions.filter(c => !c.isTextElement)

  return (
    <MobileBottomSheet open={open} onClose={onClose} title={`Captions (${spokenCaptions.length})`} height="65dvh">
      {spokenCaptions.length === 0 && (
        <p className="py-8 text-center text-sm text-gray-500">No captions yet — upload a video first.</p>
      )}
      <div className="space-y-2">
        {spokenCaptions.map((caption) => {
          const isActive = currentTime >= (caption.start_time ?? 0) && currentTime <= (caption.end_time ?? 0)
          return (
            <div
              key={caption.id}
              className={`rounded-2xl border p-3 transition-colors ${isActive ? 'border-[#F5A623]/60 bg-[#F5A623]/[0.06]' : 'border-white/10 bg-white/[0.02]'}`}
            >
              <div className="mb-1.5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onSeek(caption.start_time ?? 0)}
                  className="flex h-8 items-center gap-1.5 rounded-full bg-white/10 px-3 text-[11px] font-semibold tabular-nums text-gray-200 active:bg-white/20"
                >
                  <Play className="h-3 w-3" fill="currentColor" />
                  {formatTime(caption.start_time)} – {formatTime(caption.end_time)}
                </button>
              </div>
              <textarea
                defaultValue={caption.text}
                rows={2}
                onBlur={(e) => {
                  const next = e.target.value.trim()
                  if (next && next !== caption.text) onUpdateCaptionText(caption.id, next)
                }}
                className="w-full resize-none rounded-xl border border-transparent bg-transparent p-1 text-[15px] leading-snug text-white outline-none focus:border-white/20 focus:bg-black/30"
              />
            </div>
          )
        })}
      </div>
    </MobileBottomSheet>
  )
}
