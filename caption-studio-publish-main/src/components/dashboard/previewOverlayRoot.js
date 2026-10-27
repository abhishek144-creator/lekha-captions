// Word boxes and guides sit in the preview column's stacking context, between
// the floating word editor (z 60) and the timeline (z 70), so an open timeline
// paints over them like it paints over the editor. Portalling them to <body>
// at a huge z-index drew them on top of the timeline.
export const PREVIEW_GUIDES_Z_INDEX = 64
export const PREVIEW_WORD_BOX_Z_INDEX = 65

export function getPreviewOverlayRoot() {
  if (typeof document === 'undefined') return null
  return document.querySelector('[data-preview-overlay-root="true"]') || document.body
}
