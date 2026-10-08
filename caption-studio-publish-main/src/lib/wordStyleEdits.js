// Per-word style edits from the floating word popup. A popup targets either a
// caption word or a text-element word; both store styles on the owning item's
// `wordStyles`, keyed by `${ownerId}-${wordIndex}`.

export const wordPopupTargetId = (popup) => (
  popup?.type === 'element' ? popup.elementId : popup?.caption?.id
)

export const wordPopupStyleKey = (popup) => `${wordPopupTargetId(popup)}-${popup?.wordIndex}`

// Applies one popup control change to a word's existing style.
export const applyWordStyleChange = (existingStyle = {}, key, value) => {
  const updatedStyle = { ...existingStyle, [key]: value }
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

// Delete the position keys instead of writing zeros: a stored abs 0,0 reads as
// "dragged to the top-left corner" in export.
export const resetWordPosition = (style = {}) => {
  const {
    x: _x, y: _y, x_pct: _xPct, y_pct: _yPct,
    abs_x_pct: _absX, abs_y_pct: _absY,
    ...rest
  } = style
  return rest
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

export const getPopupWordStyle = (captions, popup) => {
  const owner = captions.find((caption) => caption.id === wordPopupTargetId(popup))
  return owner?.wordStyles?.[wordPopupStyleKey(popup)] || {}
}

// The live word text (the popup's copy can be stale after an edit).
export const getPopupWordText = (captions, popup) => {
  const owner = captions.find((caption) => caption.id === wordPopupTargetId(popup))
  return String(owner?.text || '').split(/\s+/).filter(Boolean)[popup?.wordIndex] || popup?.word
}
