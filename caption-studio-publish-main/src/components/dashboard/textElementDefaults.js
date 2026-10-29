// Timing and look of the text boxes added from the Text tab.

export const NEW_TEXT_ELEMENT_FALLBACK_SECONDS = 3

// A new text box spans the block under the playhead: the caption being shown,
// or a short default when no caption is on screen. It never runs past the
// video (it used to stretch to the end of the video, over every later caption).
export function getNewTextElementTiming({ captions = [], currentTime = 0, duration = 0 } = {}) {
  const videoEnd = Number(duration) > 0 ? Number(duration) : Infinity
  const time = Math.max(0, Number(currentTime) || 0)
  const block = captions.find((caption) => (
    caption
    && !caption.isTextElement
    && time >= Number(caption.start_time)
    && time < Number(caption.end_time)
  ))
  const preferredStart = block ? Number(block.start_time) : time
  const startTime = Math.max(0, Math.min(preferredStart, videoEnd - 0.5))
  const preferredEnd = block ? Number(block.end_time) : startTime + NEW_TEXT_ELEMENT_FALLBACK_SECONDS
  const endTime = Math.min(preferredEnd, videoEnd)
  return { startTime, endTime: Math.max(startTime + 0.1, endTime) }
}

// A font combination is lettering on the video, with no box behind it.
export function buildFontComboTextElement(preset, { startTime, endTime }) {
  return {
    id: `text-${Date.now()}-${Math.random()}`,
    text: preset.text,
    start_time: startTime,
    end_time: endTime,
    type: 'combo',
    isTextElement: true,
    customStyle: {
      top: 50,
      left: 50,
      width: 180,
      height: 48,
      fontSize: preset.fontSize,
      backgroundColor: preset.backgroundColor || '#000000',
      backgroundOpacity: preset.backgroundOpacity || 0.6,
      color: preset.color,
      borderRadius: 12,
      padding: 8,
      textAlign: 'center',
      fontFamily: preset.fontFamily,
      fontWeight: preset.fontWeight || '500',
      fontStyle: preset.fontStyle || 'normal',
      textTransform: preset.textTransform || 'none',
      hasBackground: false,
      zIndex: 50,
    },
  }
}
