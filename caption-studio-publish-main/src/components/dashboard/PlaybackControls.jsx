import React from 'react'
import { Pause, Play, Volume2, VolumeX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { formatTime } from './videoPlayerTemplateRendering.jsx'

// Play/pause, mute/volume and elapsed time under the preview.
export default function PlaybackControls({
  isPlaying,
  onTogglePlay,
  isMuted,
  volume,
  onToggleMute,
  onVolumeChange,
  currentTime,
  duration,
}) {
  const muted = isMuted || volume === 0
  return (
    <div className="mt-3 space-y-3 px-2">
      <div className="mx-auto lekha-glass-chip rounded-full px-2.5 py-1.5 flex w-fit items-center gap-2.5">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onTogglePlay}
            className="h-7 w-7 rounded-full hover:bg-white/10 text-white"
            data-video-control="true"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="w-4 h-4" aria-hidden="true" /> : <Play className="w-4 h-4 ml-0.5" aria-hidden="true" />}
          </Button>

          <div className="flex items-center gap-2 group">
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleMute}
              className="h-7 w-7 text-gray-400 hover:text-white hover:bg-white/10"
              aria-label={muted ? 'Unmute' : 'Mute'}
            >
              {muted ? <VolumeX className="w-4 h-4" aria-hidden="true" /> : <Volume2 className="w-4 h-4" aria-hidden="true" />}
            </Button>
            <div className="w-0 overflow-hidden group-hover:w-24 group-focus-within:w-24 pl-2 transition-all duration-300 ease-in-out">
              <Slider
                value={[isMuted ? 0 : volume]}
                max={1}
                step={0.05}
                aria-label="Volume"
                onValueChange={([val]) => onVolumeChange(val)}
                className="w-20 cursor-pointer py-4"
              />
            </div>
          </div>
        </div>

        <span className="text-xs text-white font-mono tabular-nums">
          {formatTime(currentTime)}
        </span>
        <span className="text-[10px] text-slate-600 font-mono" aria-hidden="true">/</span>
        <span className="text-[10px] text-slate-500 font-mono tabular-nums">
          {formatTime(duration || 0)}
        </span>
      </div>
    </div>
  )
}
