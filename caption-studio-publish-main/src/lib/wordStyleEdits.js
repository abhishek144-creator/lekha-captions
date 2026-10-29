// Per-word style edits from the floating word popup. A popup targets either a
// caption word or a text-element word; both store styles on the owning item's
// `wordStyles`, keyed by `${ownerId}-${wordIndex}`.
import { withAnimationChoice } from './animationSpeed.js'

export const wordPopupTargetId = (popup) => (
  popup?.type === 'element' ? popup.elementId : popup?.caption?.id
)

export const wordPopupStyleKey = (popup) => `${wordPopupTargetId(popup)}-${popup?.wordIndex}`

// Applies one popup control change to a word's existing style.
/** @type {(existingStyle: Record<string, any>, key: string, value: any) => Record<string, any>} */
export const applyWordStyleChange = (existingStyle = {}, key, value) => {
  // A newly chosen entrance starts at 2x unless the word already has a speed.
  const updatedStyle = key === 'animation'
    ? withAnimationChoice(existingStyle, value)
    : { ...existingStyle, [key]: value }
  if (key === 'textGradient') {
    updatedStyle.textGradient = typeof value === 'string' ? value.trim() : ''
  }
  // Slider size changes should grow the word normally, not keep a narrow
  // side-resize box.
  if (key === 'fontSize') {
    delete updatedStyle.frozenFontSize
    delete updatedStyle.boxWidth
    delete updatedStyle.textScaleX
  }
  if (key === 'x') delete updatedStyle.x_pct
  if (key === 'y') delete updatedStyle.y_pct
  return updatedStyle
}

export const resetWordFontSize = (style = {}) => {
  const { fontSize: _fontSize, frozenFontSize: _frozenFontSize, ...rest } = style
  return rest
}

// Returns captions with `update(existingStyle)` applied to the popup's word.
export const updatePopupWordStyle = (captions, popup, update) => {
  const targetId = wordPopupTargetId(popup)
  const styleKey = wordPopupStyleKey(popup)
  return captions.map((caption) => {
    if (caption.id !== targetId) return caption
    const wordStyles = caption.wordStyles || {}
    return {
      ...caption,
      wordStyles: {
        ...wordStyles,
        [styleKey]: update(wordStyles[styleKey] || {}),
      },
    }
  })
}

// The popup's reset: removes every edit on the word (position, size, colour,
// gradient, emphasis, animation) so it renders exactly as its caption style
// or template draws it. The key is deleted rather than set to zeros: a stored
// abs 0,0 reads as "dragged to the top-left corner" in export.
export const clearPopupWordStyle = (captions, popup) => {
  const targetId = wordPopupTargetId(popup)
  const styleKey = wordPopupStyleKey(popup)
  return captions.map((caption) => {
    if (caption.id !== targetId || !caption.wordStyles?.[styleKey]) return caption
    const { [styleKey]: _removed, ...wordStyles } = caption.wordStyles
    return { ...caption, wordStyles }
  })
}

export const getPopupWordStyle = (captions, popup) => {
  const owner = captions.find((caption) => caption.id === wordPopupTargetId(popup))
  return owner?.wordStyles?.[wordPopupStyleKey(popup)] || {}
}

// The live word text (the popup's copy can be stale after an edit).
export const getPopupWordText = (captions, popup) => {
  const owner = captions.find((caption) => caption.id === wordPopupTargetId(popup))
  return String(owner?.text || '').split(/\s+/).filter(Boolean)[popup?.wordIndex] || popup?.word
}

// Background on/off for one word: the popup's Background switch and the
// selected word's toolbar button. On gives a translucent black box; off also
// clears a highlight gradient, which paints the same box.
export const DEFAULT_WORD_BACKGROUND = { backgroundColor: '#000000', backgroundOpacity: 0.65 }

export const wordHasBackground = (style = {}) => Boolean(style.backgroundColor || style.highlightGradient)

/** @type {(style: Record<string, any>, enabled: boolean) => Record<string, any>} */
export const setWordBackground = (style = {}, enabled) => (enabled
  ? { ...style, ...DEFAULT_WORD_BACKGROUND }
  : { ...style, backgroundColor: '', highlightGradient: '', backgroundOpacity: 0 })

export const toggleWordBackground = (style = {}) => setWordBackground(style, !wordHasBackground(style))
