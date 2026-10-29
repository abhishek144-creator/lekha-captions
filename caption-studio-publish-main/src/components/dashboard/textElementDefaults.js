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

// "Add a heading / subheading / body text": lettering on the video with a soft
// shadow, no box behind it (the black 60% box is still the colour the
// Background switch brings back).
export function buildPresetTextElement(type, { startTime, endTime }) {
  const text = type === 'heading' ? 'Heading' : type === 'subheading' ? 'Subheading' : 'Body text'
  return {
    id: `text-${Date.now()}-${Math.random()}`,
    text,
    start_time: startTime,
    end_time: endTime,
    type,
    isTextElement: true,
    customStyle: {
      top: 50,
      left: 50,
      width: type === 'heading' ? 220 : type === 'subheading' ? 180 : 160,
      height: type === 'heading' ? 60 : type === 'subheading' ? 48 : 40,
      fontSize: type === 'heading' ? 28 : type === 'subheading' ? 20 : 15,
      backgroundColor: '#000000',
      backgroundOpacity: 0.6,
      color: '#ffffff',
      borderRadius: 0,
      padding: 5,
      textAlign: 'center',
      fontFamily: 'Inter',
      fontWeight: type === 'heading' ? '700' : '500',
      fontStyle: 'normal',
      hasBackground: false,
      hasShadow: true,
      shadowColor: 'rgba(0,0,0,0.8)',
      shadowBlur: 4,
      shadowOffsetX: 0,
      shadowOffsetY: 2,
      zIndex: 50,
    },
  }
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
