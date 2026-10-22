// Smart guides for creatively placed (CPT) words, in viewport pixels.
//
// Words are measured by their visible letters (measureWordInkBox), so stacked
// words can sit as tight as the user wants. While dragging:
// - edges and centres snap to other words' edges/centres and to the frame's
//   centre lines (alignment guides);
// - the gap to a neighbouring word snaps to touching, or to a gap already used
//   between other words in the layout (equal-spacing markers on both pairs).
// Nothing blocks placement: words may be placed closer or overlap on purpose.
// Holding Alt disables snapping (handled by the caller).

const ALIGN_THRESHOLD = 6
const SPACING_THRESHOLD = 4
const GUIDE_TOLERANCE = 0.75

// DOMRect keeps width/height as prototype getters, so `{ ...rect }` loses them.
// Always rebuild plain boxes from the four edges.
const toBox = (rect) => {
  const left = Number(rect.left)
  const top = Number(rect.top)
  const right = Number(rect.right ?? left + Number(rect.width))
  const bottom = Number(rect.bottom ?? top + Number(rect.height))
  return { left, top, right, bottom, width: right - left, height: bottom - top }
}
const shiftBox = (box, dx, dy) => toBox({ left: box.left + dx, top: box.top + dy, right: box.right + dx, bottom: box.bottom + dy })
const isFiniteBox = (box) => [box.left, box.top, box.right, box.bottom].every(Number.isFinite) && box.width > 0 && box.height > 0

const xAnchors = (box) => ({ left: box.left, center: (box.left + box.right) / 2, right: box.right })
const yAnchors = (box) => ({ top: box.top, middle: (box.top + box.bottom) / 2, bottom: box.bottom })

// Two boxes share a row (side by side) / column (stacked) when they overlap on
// the other axis.
const sharesRow = (a, b) => Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0
const sharesColumn = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0

const closer = (current, candidate, threshold) => {
  if (!Number.isFinite(candidate.distance) || Math.abs(candidate.distance) > threshold) return current
  if (!current || Math.abs(candidate.distance) < Math.abs(current.distance) - 0.01) return candidate
  // On a tie, alignment beats spacing (it is the stronger visual relation).
  if (Math.abs(Math.abs(candidate.distance) - Math.abs(current.distance)) <= 0.01
    && candidate.mode === 'alignment' && current.mode !== 'alignment') return candidate
  return current
}

// Gaps already used between other words: the spacing a new word can match.
const existingGaps = (boxes) => {
  const horizontal = []
  const vertical = []
  boxes.forEach((a, i) => boxes.forEach((b, j) => {
    if (i === j) return
    if (sharesRow(a, b) && b.left >= a.right) horizontal.push({ gap: b.left - a.right, from: a, to: b })
    if (sharesColumn(a, b) && b.top >= a.bottom) vertical.push({ gap: b.top - a.bottom, from: a, to: b })
  }))
  // Keep only each word's nearest neighbour, so a far word does not invent gaps.
  const nearest = (pairs) => pairs.filter((pair) => !pairs.some((other) => other.from === pair.from && other.gap < pair.gap))
  return { horizontal: nearest(horizontal), vertical: nearest(vertical) }
}

/**
 * Resolve where a dragged word snaps.
 * @param {{ draggedRect: object, siblingRects?: object[], frameRect?: object|null,
 *   deltaX?: number, deltaY?: number, alignThreshold?: number, spacingThreshold?: number }} input
 *   Rects may be DOMRects or plain {left, top, right, bottom} objects in viewport px.
 * @returns {{ deltaX: number, deltaY: number, rect: object, guides: object[] }}
 *   guides: { type: 'vertical', kind, x, y1, y2 } | { type: 'horizontal', kind, y, x1, x2 }
 *   | { type: 'spacing-horizontal', x1, x2, y } | { type: 'spacing-vertical', x, y1, y2 }
 */
export function resolveCptWordSnap({
  draggedRect,
  siblingRects = [],
  frameRect = null,
  deltaX = 0,
  deltaY = 0,
  alignThreshold = ALIGN_THRESHOLD,
  spacingThreshold = SPACING_THRESHOLD,
}) {
  const dragged = toBox(draggedRect)
  const siblings = siblingRects.map(toBox).filter(isFiniteBox)
  const frame = frameRect ? toBox(frameRect) : null
  const hasFrame = Boolean(frame && isFiniteBox(frame))
  if (!isFiniteBox(dragged)) return { deltaX, deltaY, rect: shiftBox(dragged, deltaX, deltaY), guides: [] }

  const raw = shiftBox(dragged, deltaX, deltaY)
  const rawX = xAnchors(raw)
  const rawY = yAnchors(raw)
  let bestX = null
  let bestY = null

  // Alignment: like-to-like edges and centres, plus a centre to the frame's centre lines.
  siblings.forEach((target) => {
    const tx = xAnchors(target)
    const ty = yAnchors(target)
    Object.keys(rawX).forEach((kind) => {
      bestX = closer(bestX, { mode: 'alignment', kind, distance: tx[kind] - rawX[kind] }, alignThreshold)
    })
    Object.keys(rawY).forEach((kind) => {
      bestY = closer(bestY, { mode: 'alignment', kind, distance: ty[kind] - rawY[kind] }, alignThreshold)
    })
  })
  if (hasFrame) {
    bestX = closer(bestX, { mode: 'alignment', kind: 'center', distance: xAnchors(frame).center - rawX.center }, alignThreshold)
    bestY = closer(bestY, { mode: 'alignment', kind: 'middle', distance: yAnchors(frame).middle - rawY.middle }, alignThreshold)
  }

  // Spacing: touch a neighbour, or match a gap already used in the layout.
  const gaps = existingGaps(siblings)
  const gapValues = (pairs) => [0, ...pairs.map((pair) => pair.gap)]
  siblings.forEach((target) => {
    if (sharesRow(raw, target)) {
      gapValues(gaps.horizontal).forEach((gap) => {
        bestX = closer(bestX, { mode: 'spacing', axis: 'x', gap, target, side: 'after', distance: target.right + gap - raw.left }, spacingThreshold)
        bestX = closer(bestX, { mode: 'spacing', axis: 'x', gap, target, side: 'before', distance: target.left - gap - raw.right }, spacingThreshold)
      })
    }
    if (sharesColumn(raw, target)) {
      gapValues(gaps.vertical).forEach((gap) => {
        bestY = closer(bestY, { mode: 'spacing', axis: 'y', gap, target, side: 'below', distance: target.bottom + gap - raw.top }, spacingThreshold)
        bestY = closer(bestY, { mode: 'spacing', axis: 'y', gap, target, side: 'above', distance: target.top - gap - raw.bottom }, spacingThreshold)
      })
    }
  })

  const resolvedDeltaX = deltaX + (bestX?.distance || 0)
  const resolvedDeltaY = deltaY + (bestY?.distance || 0)
  const placed = shiftBox(dragged, resolvedDeltaX, resolvedDeltaY)
  const guides = []

  // Draw every alignment that holds at the final position (like design tools),
  // so a guide never points at a position the word did not take.
  const px = xAnchors(placed)
  const py = yAnchors(placed)
  const seen = new Set()
  const pushGuide = (guide) => {
    const key = `${guide.type}:${Math.round((guide.x ?? guide.y) * 4)}`
    if (seen.has(key)) {
      const existing = guides.find((item) => `${item.type}:${Math.round((item.x ?? item.y) * 4)}` === key)
      if (guide.type === 'vertical') { existing.y1 = Math.min(existing.y1, guide.y1); existing.y2 = Math.max(existing.y2, guide.y2) }
      else { existing.x1 = Math.min(existing.x1, guide.x1); existing.x2 = Math.max(existing.x2, guide.x2) }
      return
    }
    seen.add(key)
    guides.push(guide)
  }
  if (bestX?.mode === 'alignment' || bestY?.mode === 'alignment') {
    siblings.forEach((target) => {
      const tx = xAnchors(target)
      const ty = yAnchors(target)
      if (bestX?.mode === 'alignment') {
        Object.keys(px).forEach((kind) => {
          if (Math.abs(px[kind] - tx[kind]) <= GUIDE_TOLERANCE) {
            pushGuide({ type: 'vertical', kind, x: tx[kind], y1: Math.min(placed.top, target.top), y2: Math.max(placed.bottom, target.bottom) })
          }
        })
      }
      if (bestY?.mode === 'alignment') {
        Object.keys(py).forEach((kind) => {
          if (Math.abs(py[kind] - ty[kind]) <= GUIDE_TOLERANCE) {
            pushGuide({ type: 'horizontal', kind, y: ty[kind], x1: Math.min(placed.left, target.left), x2: Math.max(placed.right, target.right) })
          }
        })
      }
    })
    if (hasFrame && bestX?.mode === 'alignment' && Math.abs(px.center - xAnchors(frame).center) <= GUIDE_TOLERANCE) {
      pushGuide({ type: 'vertical', kind: 'center', x: xAnchors(frame).center, y1: frame.top, y2: frame.bottom })
    }
    if (hasFrame && bestY?.mode === 'alignment' && Math.abs(py.middle - yAnchors(frame).middle) <= GUIDE_TOLERANCE) {
      pushGuide({ type: 'horizontal', kind: 'middle', y: yAnchors(frame).middle, x1: frame.left, x2: frame.right })
    }
  }

  const horizontalMarker = (a, b) => ({
    type: 'spacing-horizontal',
    x1: a.right,
    x2: b.left,
    y: (Math.max(a.top, b.top) + Math.min(a.bottom, b.bottom)) / 2,
  })
  const verticalMarker = (a, b) => ({
    type: 'spacing-vertical',
    x: (Math.max(a.left, b.left) + Math.min(a.right, b.right)) / 2,
    y1: a.bottom,
    y2: b.top,
  })
  if (bestX?.mode === 'spacing') {
    const [a, b] = bestX.side === 'after' ? [bestX.target, placed] : [placed, bestX.target]
    guides.push(horizontalMarker(a, b))
    gaps.horizontal
      .filter((pair) => bestX.gap > 0 && Math.abs(pair.gap - bestX.gap) <= 0.5)
      .forEach((pair) => guides.push(horizontalMarker(pair.from, pair.to)))
  }
  if (bestY?.mode === 'spacing') {
    const [a, b] = bestY.side === 'below' ? [bestY.target, placed] : [placed, bestY.target]
    guides.push(verticalMarker(a, b))
    gaps.vertical
      .filter((pair) => bestY.gap > 0 && Math.abs(pair.gap - bestY.gap) <= 0.5)
      .forEach((pair) => guides.push(verticalMarker(pair.from, pair.to)))
  }

  return { deltaX: resolvedDeltaX, deltaY: resolvedDeltaY, rect: placed, guides }
}

let measureContext = null
const canvasContext = () => {
  if (measureContext || typeof document === 'undefined') return measureContext
  measureContext = document.createElement('canvas').getContext('2d')
  return measureContext
}

const isPainted = (style) => (
  (style.backgroundImage && style.backgroundImage !== 'none')
  || (style.backgroundColor && !/rgba\([^)]*,\s*0\)|transparent/.test(style.backgroundColor))
)

/**
 * The box a word visibly occupies, in viewport px: its letters' ink top/bottom
 * (from canvas text metrics) and advance left/right. Words with a background
 * or highlight box use that box. Falls back to the element's rect.
 */
export function measureWordInkBox(element) {
  if (!element?.getBoundingClientRect) return null
  const fallback = toBox(element.getBoundingClientRect())
  if (typeof document === 'undefined' || typeof window === 'undefined') return fallback
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
  let textNode = null
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement
    if (!node.textContent.trim() || !parent) continue
    // Skip layout spacers (aria-hidden / visibility:hidden copies of the word).
    const hiddenCopy = parent.closest('[aria-hidden="true"]')
    if (hiddenCopy && hiddenCopy !== element && element.contains(hiddenCopy)) continue
    if (window.getComputedStyle(parent).visibility === 'hidden') continue
    textNode = node
    break
  }
  if (!textNode) return fallback
  const parent = textNode.parentElement
  for (let node = parent; node && element.contains(node); node = node.parentElement) {
    if (isPainted(window.getComputedStyle(node))) return toBox(node.getBoundingClientRect())
    if (node === element) break
  }
  const range = document.createRange()
  range.selectNodeContents(textNode)
  const textRect = toBox(range.getBoundingClientRect())
  const context = canvasContext()
  if (!context || !isFiniteBox(textRect)) return fallback
  const style = window.getComputedStyle(parent)
  context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
  const transform = style.textTransform
  const text = transform === 'uppercase' ? textNode.textContent.toUpperCase()
    : transform === 'lowercase' ? textNode.textContent.toLowerCase()
      : textNode.textContent
  const metrics = context.measureText(text.trim())
  const fontAscent = metrics.fontBoundingBoxAscent
  const fontDescent = metrics.fontBoundingBoxDescent
  if (!Number.isFinite(fontAscent) || !Number.isFinite(fontDescent) || fontAscent + fontDescent <= 0) return textRect
  // The text range spans the font's ascent+descent; scale for CSS transforms.
  const scale = textRect.height / (fontAscent + fontDescent)
  const baseline = textRect.top + fontAscent * scale
  const top = baseline - metrics.actualBoundingBoxAscent * scale
  const bottom = baseline + metrics.actualBoundingBoxDescent * scale
  if (!(bottom > top)) return textRect
  return toBox({ left: textRect.left, right: textRect.right, top, bottom })
}
