// Live scrubbing for preview seek bars.
//
// Assigning video.currentTime on every slider tick queues overlapping seeks,
// and the element can show black while they pile up (the original reason the
// editor only sought on release). Here at most one seek is in flight: new
// positions replace the pending one and are applied when the current seek
// fires `seeked`, so the frame follows the finger without stacking seeks.
export function createLiveScrubber(getVideo) {
  let pendingTime = null
  let attachedVideo = null

  const flush = () => {
    const video = getVideo()
    if (!video || pendingTime === null || video.seeking) return
    const nextTime = pendingTime
    pendingTime = null
    if (Math.abs(video.currentTime - nextTime) < 0.01) return
    video.currentTime = nextTime
  }

  const attach = () => {
    const video = getVideo()
    if (!video || attachedVideo === video) return
    attachedVideo?.removeEventListener('seeked', flush)
    video.addEventListener('seeked', flush)
    attachedVideo = video
  }

  return {
    scrubTo(time) {
      attach()
      pendingTime = Math.max(0, Number(time) || 0)
      flush()
    },
    end() {
      attachedVideo?.removeEventListener('seeked', flush)
      attachedVideo = null
      pendingTime = null
    },
  }
}
