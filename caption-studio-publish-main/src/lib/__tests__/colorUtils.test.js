import { describe, expect, it } from 'vitest'
import { cssColorToHex, hexToRgba, normalizeHexColor } from '../colorUtils'

describe('colorUtils', () => {
  it('normalizes hex input', () => {
    expect(normalizeHexColor('#ABC')).toBe('#aabbcc')
    expect(normalizeHexColor('22C55E')).toBe('#22c55e')
    expect(normalizeHexColor(' #ef4444 ')).toBe('#ef4444')
    expect(normalizeHexColor('#12')).toBe('')
    expect(normalizeHexColor('red')).toBe('')
    expect(normalizeHexColor(undefined)).toBe('')
  })

  it('reads computed browser colours', () => {
    expect(cssColorToHex('rgb(239, 68, 68)')).toBe('#ef4444')
    expect(cssColorToHex('rgba(34, 197, 94, 0.5)')).toBe('#22c55e')
    expect(cssColorToHex('rgb(255 255 255 / 100%)')).toBe('#ffffff')
    expect(cssColorToHex('rgba(0, 0, 0, 0)')).toBe('')
    expect(cssColorToHex('transparent')).toBe('')
  })

  it('builds rgba without producing invalid CSS', () => {
    expect(hexToRgba('#000000', 0.65)).toBe('rgba(0, 0, 0, 0.65)')
    expect(hexToRgba('#fff', 0.5)).toBe('rgba(255, 255, 255, 0.5)')
    expect(hexToRgba('not-a-colour', 0.6)).toBe('rgba(0, 0, 0, 0.6)')
    expect(hexToRgba('#ef4444', 7)).toBe('rgba(239, 68, 68, 1)')
  })
})
