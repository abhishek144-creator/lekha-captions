import { hexToRgba } from './colorUtils.js'

// How a word's text gradient, background colour and highlight gradient combine.
// Mirrored by `wordPaintDeclarations` in scripts/render_template_page_runtime.mjs
// so the exported video paints words exactly like the editor.

// The box behind a word: highlight gradient wins over a solid background.
export function getWordBackgroundFill(wordStyle = {}) {
  const highlight = String(wordStyle.highlightGradient || '').trim()
  if (highlight) return highlight
  if (wordStyle.backgroundColor) return hexToRgba(wordStyle.backgroundColor, wordStyle.backgroundOpacity ?? 0.6)
  return ''
}

// A text gradient is painted with background-clip: text. A background on the
// same element would be clipped to the text too (or reset the clip), so both
// are stacked as layers with their own clip: gradient -> text, fill -> box.
// Longhands only: React re-applies just the changed style keys, so a
// `background` shorthand next to (or swapped for) longhands across renders
// resets the clip/fill and paints the wrong box.
export function getWordPaintStyle(wordStyle = {}) {
  const textGradient = String(wordStyle.textGradient || '').trim()
  const fill = getWordBackgroundFill(wordStyle)
  if (!textGradient) {
    if (!fill) return {}
    return /gradient\(/i.test(fill)
      ? { backgroundColor: 'transparent', backgroundImage: fill }
      : { backgroundColor: fill, backgroundImage: 'none' }
  }
  const fillLayer = fill && (/gradient\(/i.test(fill) ? fill : `linear-gradient(${fill}, ${fill})`)
  const clip = fillLayer ? 'text, padding-box' : 'text'
  return {
    backgroundColor: 'transparent',
    backgroundImage: fillLayer ? `${textGradient}, ${fillLayer}` : textGradient,
    backgroundSize: '100% 100%',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center',
    WebkitBackgroundClip: clip,
    backgroundClip: clip,
    WebkitTextFillColor: 'transparent',
    color: 'transparent',
  }
}
