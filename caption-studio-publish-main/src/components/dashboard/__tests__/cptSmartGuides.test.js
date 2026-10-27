import { describe, expect, it } from 'vitest'
import { SAFE_MARGIN, resolveCptWordSnap, resolveOverlapSuggestion } from '../cptSmartGuides'

const rect = (left, top, width, height, baseline) => ({
  left, top, right: left + width, bottom: top + height, ...(baseline != null ? { baseline } : {}),
})
const frame = rect(0, 0, 360, 640)

describe('CPT word snapping', () => {
  it('snaps an edge to the title-safe margin and draws a safe guide', () => {
    const safeLeft = 360 * SAFE_MARGIN
    const result = resolveCptWordSnap({ draggedRect: rect(40, 300, 60, 20), frameRect: frame, deltaX: safeLeft - 40 + 3 })
    expect(result.rect.left).toBeCloseTo(safeLeft)
    expect(result.guides.some((guide) => guide.type === 'vertical' && guide.kind === 'safe')).toBe(true)
  })

  it('aligns text baselines of words with different heights', () => {
    // A tall word and a short word: tops and bottoms differ, baselines can match.
    const sibling = rect(200, 100, 80, 40, 128)
    const dragged = rect(20, 150, 40, 20, 165)
    const result = resolveCptWordSnap({ draggedRect: dragged, siblingRects: [sibling], deltaY: 128 - 165 + 2 })
    expect(result.rect.baseline).toBeCloseTo(128)
    expect(result.guides.some((guide) => guide.type === 'horizontal' && guide.kind === 'baseline')).toBe(true)
  })

  it('holds a snap until the pointer is clearly past it, then releases', () => {
    const sibling = rect(200, 100, 60, 20)
    const dragged = rect(20, 200, 60, 20)
    const first = resolveCptWordSnap({ draggedRect: dragged, siblingRects: [sibling], deltaX: 178 })
    expect(first.rect.left).toBe(200)
    // 8 px away: outside the 6 px snap zone, inside the release zone.
    const held = resolveCptWordSnap({ draggedRect: dragged, siblingRects: [sibling], deltaX: 188, previous: first.snap })
    expect(held.rect.left).toBe(200)
    const fresh = resolveCptWordSnap({ draggedRect: dragged, siblingRects: [sibling], deltaX: 188 })
    expect(fresh.rect.left).toBe(208)
    // 14 px away: released, the word follows the pointer.
    const released = resolveCptWordSnap({ draggedRect: dragged, siblingRects: [sibling], deltaX: 194, previous: held.snap })
    expect(released.rect.left).toBe(214)
  })

  it('allows overlap but reports it with the smallest clearing move', () => {
    const sibling = rect(100, 100, 80, 30)
    const result = resolveCptWordSnap({ draggedRect: rect(0, 300, 50, 30), siblingRects: [sibling], deltaX: 160, deltaY: -185 })
    // Free placement: the word stays where it was dropped.
    expect(result.rect.left).toBe(160)
    expect(result.overlaps).toBe(1)
    expect(result.guides.some((guide) => guide.type === 'overlap')).toBe(true)
    // Moving down 15 px beats moving right 20 px.
    expect(result.suggestion.rect.top).toBe(130)
    expect(result.suggestion.deltaX - result.deltaX).toBe(0)
    expect(result.suggestion.deltaY - result.deltaY).toBe(15)
  })

  it('treats touching words as not overlapping', () => {
    expect(resolveOverlapSuggestion(rect(180, 100, 40, 30), [rect(100, 100, 80, 30)])).toBeNull()
  })

  it('keeps the suggestion inside the frame', () => {
    // Word at the frame's left edge overlapping a sibling: moving left would leave the frame.
    // A word wide enough that moving left, up or down is not the cheapest
    // in-frame move; left would leave the frame entirely.
    const suggestion = resolveOverlapSuggestion(rect(0, 0, 40, 100), [rect(20, 0, 30, 100)], frame)
    expect(suggestion.rect.left).toBeGreaterThanOrEqual(0)
    expect(suggestion.rect.top).toBeGreaterThanOrEqual(0)
    expect(suggestion.rect.left).toBe(50)
  })

  it('clears overlaps with words of different widths across multiple rows', () => {
    const rows = [rect(100, 100, 120, 30), rect(100, 135, 40, 30), rect(150, 135, 90, 30)]
    const suggestion = resolveOverlapSuggestion(rect(120, 120, 50, 30), rows, frame)
    const clears = rows.every((row) => !(Math.min(row.right, suggestion.rect.right) - Math.max(row.left, suggestion.rect.left) > 1
      && Math.min(row.bottom, suggestion.rect.bottom) - Math.max(row.top, suggestion.rect.top) > 1))
    expect(clears).toBe(true)
  })

  it('scales: the same relative layout snaps the same way at another canvas size', () => {
    const at = (scale) => resolveCptWordSnap({
      draggedRect: rect(20 * scale, 200 * scale, 60 * scale, 20 * scale),
      siblingRects: [rect(200 * scale, 100 * scale, 60 * scale, 20 * scale)],
      frameRect: rect(0, 0, 360 * scale, 640 * scale),
      deltaX: 178 * scale,
    })
    expect(at(1).rect.left).toBe(200)
    expect(at(2).rect.left).toBe(400)
  })
})
