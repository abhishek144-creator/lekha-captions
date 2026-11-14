import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import GeneratingCaptionsScreen from '../GeneratingCaptionsScreen'
import { extractWaveformData } from '../audioUtils'

describe('upload feedback and waveform recovery', () => {
  // The bar's real progress; the shown value glides toward it.
  const target = () => screen.getByRole('progressbar').getAttribute('data-target-percent')
  const shown = () => Number(screen.getByRole('progressbar').getAttribute('aria-valuenow'))

  it('keeps caption processing behind the upload and continues progress afterwards', () => {
    const { rerender } = render(<GeneratingCaptionsScreen elapsedSeconds={100} uploadPercent={50} />)
    expect(target()).toBe('20')
    expect(screen.getByText('Step 1 of 5')).toBeTruthy()
    rerender(<GeneratingCaptionsScreen elapsedSeconds={0} uploadPercent={null} />)
    expect(target()).toBe('40')
    expect(screen.getByText('Step 2 of 5')).toBeTruthy()
    rerender(<GeneratingCaptionsScreen elapsedSeconds={300} uploadPercent={null} />)
    expect(Number(target())).toBeLessThan(100)
  })

  it('glides the shown progress up to the real value without jumping or going back', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
    try {
      const { rerender, unmount } = render(<GeneratingCaptionsScreen elapsedSeconds={0} uploadPercent={100} />)
      expect(shown()).toBe(0)
      const seen = [shown()]
      for (let frame = 0; frame < 300; frame += 1) {
        act(() => vi.advanceTimersToNextFrame())
        seen.push(shown())
      }
      expect(shown()).toBe(40)
      expect(new Set(seen).size).toBeGreaterThan(10)
      expect(seen.every((value, index) => index === 0 || (value >= seen[index - 1] && value - seen[index - 1] <= 2))).toBe(true)
      rerender(<GeneratingCaptionsScreen elapsedSeconds={0} uploadPercent={50} />)
      act(() => vi.advanceTimersToNextFrame())
      expect(shown()).toBe(40)
      unmount()
    } finally { vi.useRealTimers() }
  })

  it('skips a large local file without reading or decoding it', async () => {
    const file = new Blob(['fixture'])
    Object.defineProperty(file, 'size', { value: 201 * 1024 * 1024 })
    file.arrayBuffer = vi.fn()
    expect(await extractWaveformData(file)).toBeNull()
    expect(file.arrayBuffer).not.toHaveBeenCalled()
  })

  it('closes the audio context after a failed decode', async () => {
    const close = vi.fn().mockResolvedValue(undefined)
    const decodeAudioData = vi.fn().mockRejectedValue(new Error('unreadable media'))
    const oldContext = window.AudioContext
    window.AudioContext = vi.fn(function () { this.close = close; this.decodeAudioData = decodeAudioData })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const file = new Blob(['fixture'])
      file.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(8))
      expect(await extractWaveformData(file)).toBeNull()
      expect(close).toHaveBeenCalledTimes(1)
    } finally {
      window.AudioContext = oldContext
    }
  })
})
