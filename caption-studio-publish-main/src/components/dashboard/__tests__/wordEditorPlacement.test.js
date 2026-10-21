import { describe, expect, it } from 'vitest'
import { computeFloatingWordEditorRect } from '../wordEditorPlacement'

const rect = (left, top, right, bottom) => ({ left, top, right, bottom })
const overlaps = (a, b) => a.left < b.right && a.left + a.width > b.left && a.top < b.bottom && a.top + a.maxHeight > b.top

describe('computeFloatingWordEditorRect', () => {
  it('sits beside a narrow 9:16 frame without touching it', () => {
    const frame = rect(488, 76, 952, 900)
    const placed = computeFloatingWordEditorRect({ frame, viewport: { width: 1440, height: 900 } })
    expect(placed.overlapsFrame).toBe(false)
    expect(overlaps(placed, frame)).toBe(false)
    expect(placed.left + placed.width).toBeLessThanOrEqual(1440)
  })

  it('keeps clear of the preview tool rail beside the frame', () => {
    const frame = rect(488, 76, 952, 900)
    const rail = rect(345, 300, 390, 580)
    const placed = computeFloatingWordEditorRect({ frame, obstacles: [rail], viewport: { width: 1440, height: 900 } })
    expect(placed.left).toBeGreaterThanOrEqual(952)
  })

  it('goes below a wide frame when neither side has room', () => {
    const frame = rect(0, 40, 1024, 616)
    const placed = computeFloatingWordEditorRect({ frame, viewport: { width: 1024, height: 900 } })
    expect(placed.overlapsFrame).toBe(false)
    expect(placed.top).toBeGreaterThanOrEqual(616)
    expect(placed.top + placed.maxHeight).toBeLessThanOrEqual(900)
  })

  it('reports when the frame fills the screen so the caller can dock instead', () => {
    const frame = rect(0, 0, 375, 812)
    const placed = computeFloatingWordEditorRect({ frame, viewport: { width: 375, height: 812 } })
    expect(placed.overlapsFrame).toBe(true)
  })
})
