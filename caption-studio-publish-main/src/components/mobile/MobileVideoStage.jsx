import React, { useEffect, useRef, useState } from 'react'
import { Play, Pause } from 'lucide-react'
import MobileCaptionOverlay from './MobileCaptionOverlay'

const formatTime = (seconds) => {
  const s = Math.max(0, Math.floor(seconds || 0))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// Video preview + live caption overlay + touch scrubber.
// stageRef is exposed so the export flow can measure the rendered video area
// and word bounding boxes (same DOM-capture strategy as the desktop export).
export default function MobileVideoStage({
  videoUrl,
  captions,
  captionStyle,
  currentTime,
  setCurrentTime,
  isPlaying,
  setIsPlaying,
  duration,
  setDuration,
  stageRef,
}) {
  const videoRef = useRef(null)
  const rafRef = useRef(0)
  const [isScrubbing, setIsScrubbing] = useState(false)

  const activeCaption = captions.find(c =>
    !c.isTextElement
    && c.text
    && currentTime >= (c.start_time ?? 0)
    && currentTime <= (c.end_time ?? 0)
  )

  // Smooth word-highlight updates while playing
  useEffect(() => {
    if (!isPlaying) return undefined
    const tick = () => {
      const video = videoRef.current
      if (video) setCurrentTime(video.currentTime)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [isPlaying, setCurrentTime])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (isPlaying) video.play().catch(() => setIsPlaying(false))
    else video.pause()
  }, [isPlaying, setIsPlaying, videoUrl])

  const handleSeek = (time) => {
    const video = videoRef.current
    if (video) video.currentTime = time
    setCurrentTime(time)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative mx-auto flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden">
        <div
          ref={stageRef}
          className="relative h-full max-h-full overflow-hidden rounded-2xl bg-black"
          style={{ aspectRatio: '9 / 16', maxWidth: '100%' }}
        >
          <video
            ref={videoRef}
            src={videoUrl}
            playsInline
            preload="metadata"
            className="h-full w-full object-contain"
            onClick={() => setIsPlaying(prev => !prev)}
            onLoadedMetadata={(e) => setDuration(e.target.duration || 0)}
            onTimeUpdate={(e) => { if (!isPlaying) setCurrentTime(e.target.currentTime) }}
            onEnded={() => setIsPlaying(false)}
          />
          <MobileCaptionOverlay
            caption={activeCaption}
            captionStyle={captionStyle}
            currentTime={currentTime}
          />
          {!isPlaying && (
            <button
              type="button"
              onClick={() => setIsPlaying(true)}
              className="absolute inset-0 z-30 flex items-center justify-center"
              aria-label="Play video"
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-black/55 backdrop-blur">
                <Play className="ml-1 h-7 w-7 text-white" fill="currentColor" />
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Transport controls */}
      <div className="mt-2 flex shrink-0 items-center gap-3 px-1">
        <button
          type="button"
          onClick={() => setIsPlaying(prev => !prev)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white active:bg-white/20"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause className="h-5 w-5" fill="currentColor" /> : <Play className="ml-0.5 h-5 w-5" fill="currentColor" />}
        </button>
        <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-gray-400">{formatTime(currentTime)}</span>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.01}
          value={Math.min(currentTime, duration || 0)}
          onPointerDown={() => { setIsScrubbing(true); setIsPlaying(false) }}
          onPointerUp={() => setIsScrubbing(false)}
          onChange={(e) => handleSeek(parseFloat(e.target.value))}
          className="h-11 min-w-0 flex-1 accent-[#F5A623]"
          style={{ touchAction: 'none' }}
          aria-label="Seek"
        />
        <span className="w-10 shrink-0 text-[11px] tabular-nums text-gray-400">{formatTime(duration)}</span>
      </div>
      {isScrubbing && activeCaption && (
        <p className="truncate px-2 text-center text-[11px] text-gray-500">{activeCaption.text}</p>
      )}
    </div>
  )
}
