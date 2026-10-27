// Smart guides for creatively placed (CPT) words, in viewport pixels.
//
// Words are measured by their visible letters (measureWordInkBox), so stacked
// words can sit as tight as the user wants. While dragging:
// - edges, centres and text baselines snap to other words' and to the frame's
//   centre lines and title-safe margins (alignment guides);
// - the gap to a neighbouring word snaps to touching, or to a gap already used
//   between other words in the layout (equal-spacing markers on both pairs);
// - a snap holds until the pointer moves clearly past it (release threshold),
//   so a word does not flicker between two nearby targets.
// Nothing blocks placement: words may be placed closer or overlap on purpose.
// An overlap is reported with the smallest move that clears it, which the
// caller offers as a suggestion (Shift on release accepts it). Holding Alt
// disables snapping (handled by the caller).

const ALIGN_THRESHOLD = 6
const SPACING_THRESHOLD = 4
// A snapped word stays snapped until it is this many times the threshold away.
const RELEASE_FACTOR = 1.75
const GUIDE_TOLERANCE = 0.75
// Title-safe margin, as a share of the frame on each side.
export const SAFE_MARGIN = 0.06
// Boxes that only touch, or overlap by less than this, do not overlap.
const OVERLAP_TOLERANCE = 1

// DOMRect keeps width/height as prototype getters, so `{ ...rect }` loses them.
// Always rebuild plain boxes from the four edges. A measured text baseline
// travels with the box.
const toBox = (rect) => {
  const left = Number(rect.left)
  const top = Number(rect.top)
  const right = Number(rect.right ?? left + Number(rect.width))
  const bottom = Number(rect.bottom ?? top + Number(rect.height))
  const box = { left, top, right, bottom, width: right - left, height: bottom - top }
  if (rect.baseline != null && Number.isFinite(Number(rect.baseline))) box.baseline = Number(rect.baseline)
  return box
}
const shiftBox = (box, dx, dy) => toBox({
  left: box.left + dx,
  top: box.top + dy,
  right: box.right + dx,
  bottom: box.bottom + dy,
  ...(box.baseline != null ? { baseline: box.baseline + dy } : {}),
})
const isFiniteBox = (box) => [box.left, box.top, box.right, box.bottom].every(Number.isFinite) && box.width > 0 && box.height > 0

const xAnchors = (box) => ({ left: box.left, center: (box.left + box.right) / 2, right: box.right })
const yAnchors = (box) => ({
  top: box.top,
  middle: (box.top + box.bottom) / 2,
  bottom: box.bottom,
  ...(box.baseline != null ? { baseline: box.baseline } : {}),
})

// Two boxes share a row (side by side) / column (stacked) when they overlap on
// the other axis.
const sharesRow = (a, b) => Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0
const sharesColumn = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0
const overlapsBox = (a, b) => (
  Math.min(a.right, b.right) - Math.max(a.left, b.left) > OVERLAP_TOLERANCE
  && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > OVERLAP_TOLERANCE
)

// A candidate snap puts one anchor of the dragged box at `coord`.
const distanceOf = (candidate, anchors) => candidate.coord - anchors[candidate.anchor]

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
 * The smallest move of `box` that leaves it overlapping none of `others`
 * (touching is fine), staying inside `frame` when given. Null when it does
 * not overlap, or when no single-direction move clears it.
 * @returns {{ deltaX: number, deltaY: number, rect: object } | null}
 */
export function resolveOverlapSuggestion(box, others = [], frame = null) {
  const placed = toBox(box)
  const boxes = others.map(toBox).filter(isFiniteBox)
  if (!boxes.some((other) => overlapsBox(placed, other))) return null
  const moves = []
  boxes.forEach((other) => {
    moves.push({ deltaX: other.right - placed.left, deltaY: 0 })
    moves.push({ deltaX: other.left - placed.right, deltaY: 0 })
    moves.push({ deltaX: 0, deltaY: other.bottom - placed.top })
    moves.push({ deltaX: 0, deltaY: other.top - placed.bottom })
  })
  const inside = (rect) => !frame
    || (rect.left >= frame.left && rect.right <= frame.right && rect.top >= frame.top && rect.bottom <= frame.bottom)
  const clear = moves
    .map((move) => ({ ...move, rect: shiftBox(placed, move.deltaX, move.deltaY) }))
    .filter((move) => inside(move.rect) && !boxes.some((other) => overlapsBox(move.rect, other)))
    .sort((a, b) => (Math.abs(a.deltaX) + Math.abs(a.deltaY)) - (Math.abs(b.deltaX) + Math.abs(b.deltaY)))
  return clear[0] || null
}

/**
 * Resolve where a dragged word snaps.
 * @param {{ draggedRect: object, siblingRects?: object[], frameRect?: object|null,
 *   deltaX?: number, deltaY?: number, alignThreshold?: number, spacingThreshold?: number,
 *   previous?: { x?: object|null, y?: object|null }|null }} input
 *   Rects may be DOMRects or plain {left, top, right, bottom[, baseline]} objects in
 *   viewport px. `previous` is the `snap` of the last call in the same drag.
 * @returns {{ deltaX: number, deltaY: number, rect: object, guides: object[],
 *   snap: { x: object|null, y: object|null }, overlaps: number, suggestion: object|null }}
 *   guides: { type: 'vertical', kind, x, y1, y2 } | { type: 'horizontal', kind, y, x1, x2 }
 *   | { type: 'spacing-horizontal', x1, x2, y } | { type: 'spacing-vertical', x, y1, y2 }
 *   | { type: 'overlap' | 'suggestion', left, top, right, bottom }
 */
export function resolveCptWordSnap({
  draggedRect,
  siblingRects = [],
  frameRect = null,
  deltaX = 0,
  deltaY = 0,
  alignThreshold = ALIGN_THRESHOLD,
  spacingThreshold = SPACING_THRESHOLD,
  previous = null,
}) {
  const dragged = toBox(draggedRect)
  const siblings = siblingRects.map(toBox).filter(isFiniteBox)
  const frame = frameRect ? toBox(frameRect) : null
  const hasFrame = Boolean(frame && isFiniteBox(frame))
  if (!isFiniteBox(dragged)) {
    return { deltaX, deltaY, rect: shiftBox(dragged, deltaX, deltaY), guides: [], snap: { x: null, y: null }, overlaps: 0, suggestion: null }
  }

  const raw = shiftBox(dragged, deltaX, deltaY)
  const rawX = xAnchors(raw)
  const rawY = yAnchors(raw)
  let bestX = null
  let bestY = null
  const offerX = (candidate, threshold) => {
    bestX = closer(bestX, { ...candidate, distance: distanceOf(candidate, rawX) }, threshold)
  }
  const offerY = (candidate, threshold) => {
    if (!(candidate.anchor in rawY)) return
    bestY = closer(bestY, { ...candidate, distance: distanceOf(candidate, rawY) }, threshold)
  }

  // Alignment: like-to-like edges, centres and baselines.
  siblings.forEach((target) => {
    const tx = xAnchors(target)
    const ty = yAnchors(target)
    Object.keys(rawX).forEach((kind) => offerX({ mode: 'alignment', kind, anchor: kind, coord: tx[kind] }, alignThreshold))
    Object.keys(ty).forEach((kind) => offerY({ mode: 'alignment', kind, anchor: kind, coord: ty[kind] }, alignThreshold))
  })
  if (hasFrame) {
    // The frame's centre lines and its title-safe margins.
    const safeX = frame.width * SAFE_MARGIN
    const safeY = frame.height * SAFE_MARGIN
    offerX({ mode: 'alignment', kind: 'center', anchor: 'center', coord: xAnchors(frame).center, frameLine: true }, alignThreshold)
    offerY({ mode: 'alignment', kind: 'middle', anchor: 'middle', coord: yAnchors(frame).middle, frameLine: true }, alignThreshold)
    offerX({ mode: 'alignment', kind: 'safe', anchor: 'left', coord: frame.left + safeX, frameLine: true }, alignThreshold)
    offerX({ mode: 'alignment', kind: 'safe', anchor: 'right', coord: frame.right - safeX, frameLine: true }, alignThreshold)
    offerY({ mode: 'alignment', kind: 'safe', anchor: 'top', coord: frame.top + safeY, frameLine: true }, alignThreshold)
    offerY({ mode: 'alignment', kind: 'safe', anchor: 'bottom', coord: frame.bottom - safeY, frameLine: true }, alignThreshold)
  }

  // Spacing: touch a neighbour, or match a gap already used in the layout.
  const gaps = existingGaps(siblings)
  const gapValues = (pairs) => [0, ...pairs.map((pair) => pair.gap)]
  siblings.forEach((target) => {
    if (sharesRow(raw, target)) {
      gapValues(gaps.horizontal).forEach((gap) => {
        offerX({ mode: 'spacing', axis: 'x', gap, target, side: 'after', anchor: 'left', coord: target.right + gap }, spacingThreshold)
        offerX({ mode: 'spacing', axis: 'x', gap, target, side: 'before', anchor: 'right', coord: target.left - gap }, spacingThreshold)
      })
    }
    if (sharesColumn(raw, target)) {
      gapValues(gaps.vertical).forEach((gap) => {
        offerY({ mode: 'spacing', axis: 'y', gap, target, side: 'below', anchor: 'top', coord: target.bottom + gap }, spacingThreshold)
        offerY({ mode: 'spacing', axis: 'y', gap, target, side: 'above', anchor: 'bottom', coord: target.top - gap }, spacingThreshold)
      })
    }
  })

  // Hysteresis: the previous snap holds until the pointer leaves its wider
  // release zone, so nearby targets cannot steal it on every pixel.
  const hold = (best, prior, anchors) => {
    if (!prior || !(prior.anchor in anchors)) return best
    const distance = distanceOf(prior, anchors)
    const threshold = prior.mode === 'spacing' ? spacingThreshold : alignThreshold
    if (Math.abs(distance) > threshold * RELEASE_FACTOR) return best
    return { ...prior, distance }
  }
  bestX = hold(bestX, previous?.x, rawX)
  bestY = hold(bestY, previous?.y, rawY)

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
          if (kind in ty && Math.abs(py[kind] - ty[kind]) <= GUIDE_TOLERANCE) {
            pushGuide({ type: 'horizontal', kind, y: ty[kind], x1: Math.min(placed.left, target.left), x2: Math.max(placed.right, target.right) })
          }
        })
      }
    })
    if (hasFrame && bestX?.mode === 'alignment' && bestX.frameLine && Math.abs(px[bestX.anchor] - bestX.coord) <= GUIDE_TOLERANCE) {
      pushGuide({ type: 'vertical', kind: bestX.kind, x: bestX.coord, y1: frame.top, y2: frame.bottom })
    }
    if (hasFrame && bestY?.mode === 'alignment' && bestY.frameLine && Math.abs(py[bestY.anchor] - bestY.coord) <= GUIDE_TOLERANCE) {
      pushGuide({ type: 'horizontal', kind: bestY.kind, y: bestY.coord, x1: frame.left, x2: frame.right })
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

  // Overlap is allowed; it is shown, with the smallest move that clears it.
  const overlapping = siblings.filter((target) => overlapsBox(placed, target))
  const suggestion = overlapping.length ? resolveOverlapSuggestion(placed, siblings, hasFrame ? frame : null) : null
  overlapping.forEach((target) => guides.push({ type: 'overlap', left: target.left, top: target.top, right: target.right, bottom: target.bottom }))
  if (suggestion) {
    const { left, top, right, bottom } = suggestion.rect
    guides.push({ type: 'suggestion', left, top, right, bottom })
  }

  const keep = (best) => (best
    ? { mode: best.mode, kind: best.kind, anchor: best.anchor, coord: best.coord, frameLine: best.frameLine, axis: best.axis, gap: best.gap, target: best.target, side: best.side }
    : null)
  return {
    deltaX: resolvedDeltaX,
    deltaY: resolvedDeltaY,
    rect: placed,
    guides,
    snap: { x: keep(bestX), y: keep(bestY) },
    overlaps: overlapping.length,
    suggestion: suggestion && { deltaX: resolvedDeltaX + suggestion.deltaX, deltaY: resolvedDeltaY + suggestion.deltaY, rect: suggestion.rect },
  }
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
  return toBox({ left: textRect.left, right: textRect.right, top, bottom, baseline })
}
