// Where the floating word editor goes when it cannot dock into the editor
// layout (fullscreen preview): beside the video frame, never over it.

const EDITOR_WIDTH = 300
const MIN_WIDTH = 260
const MIN_HEIGHT = 220
const MARGIN = 12

/**
 * @param {{ frame: {left:number, top:number, right:number, bottom:number} | null,
 *   viewport: {width:number, height:number},
 *   obstacles?: Array<{left:number, top:number, right:number, bottom:number}> }} input
 *   obstacles: other controls beside the frame (the preview tool rail).
 * @returns {{ left:number, top:number, width:number, maxHeight:number, overlapsFrame:boolean }}
 */
export function computeFloatingWordEditorRect({ frame, viewport, obstacles = [] }) {
  const vw = Math.max(0, viewport.width)
  const vh = Math.max(0, viewport.height)
  const fullHeight = Math.max(MIN_HEIGHT, vh - MARGIN * 2)
  if (!frame) {
    return { left: Math.max(MARGIN, vw - EDITOR_WIDTH - MARGIN), top: MARGIN, width: Math.min(EDITOR_WIDTH, vw - MARGIN * 2), maxHeight: fullHeight, overlapsFrame: false }
  }
  const visible = {
    left: Math.max(0, frame.left),
    top: Math.max(0, frame.top),
    right: Math.min(vw, frame.right),
    bottom: Math.min(vh, frame.bottom),
  }
  // A side region runs from the frame to the nearest obstacle beside it.
  const leftLimit = Math.max(0, ...obstacles.filter((rect) => rect.right <= visible.left).map((rect) => rect.right))
  const rightLimit = Math.min(vw, ...obstacles.filter((rect) => rect.left >= visible.right).map((rect) => rect.left))
  const rightSpace = rightLimit - visible.right - MARGIN * 2
  const leftSpace = visible.left - leftLimit - MARGIN * 2
  const belowSpace = vh - visible.bottom - MARGIN * 2
  const aboveSpace = visible.top - MARGIN * 2

  if (rightSpace >= MIN_WIDTH || leftSpace >= MIN_WIDTH) {
    const useRight = rightSpace >= leftSpace
    const width = Math.min(EDITOR_WIDTH, useRight ? rightSpace : leftSpace)
    const left = useRight ? visible.right + MARGIN : visible.left - MARGIN - width
    return { left, top: MARGIN, width, maxHeight: fullHeight, overlapsFrame: false }
  }
  const width = Math.min(EDITOR_WIDTH * 1.4, vw - MARGIN * 2)
  const left = Math.max(MARGIN, (vw - width) / 2)
  if (belowSpace >= MIN_HEIGHT || aboveSpace >= MIN_HEIGHT) {
    const useBelow = belowSpace >= aboveSpace
    return {
      left,
      top: useBelow ? visible.bottom + MARGIN : MARGIN,
      width,
      maxHeight: useBelow ? belowSpace : aboveSpace,
      overlapsFrame: false,
    }
  }
  // No free side is large enough (a phone in fullscreen): a short sheet at the
  // bottom edge, where captions overlap it least. Callers are told.
  const maxHeight = Math.max(MIN_HEIGHT, Math.min(vh * 0.42, 420))
  return { left, top: vh - MARGIN - maxHeight, width, maxHeight, overlapsFrame: true }
}
