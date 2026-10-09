import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import GeneratingCaptionsScreen from '../GeneratingCaptionsScreen'
import { extractWaveformData } from '../audioUtils'

describe('upload feedback and waveform recovery', () => {
  it('keeps caption processing behind the upload and continues progress afterwards', () => {
    const { rerender } = render(<GeneratingCaptionsScreen elapsedSeconds={100} uploadPercent={50} />)
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('20')
    expect(screen.getByText('Step 1 of 5')).toBeTruthy()
    rerender(<GeneratingCaptionsScreen elapsedSeconds={0} uploadPercent={null} />)
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('40')
    expect(screen.getByText('Step 2 of 5')).toBeTruthy()
    rerender(<GeneratingCaptionsScreen elapsedSeconds={300} uploadPercent={null} />)
    expect(Number(screen.getByRole('progressbar').getAttribute('aria-valuenow'))).toBeLessThan(100)
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
