import { afterEach, expect, it, vi } from 'vitest'
import { autoLoadFontForText } from '../fontUtils.jsx'

afterEach(() => vi.restoreAllMocks())

it('retains a native-script default when the font network is unavailable', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(document.head, 'appendChild').mockImplementation((link) => {
    queueMicrotask(() => link.onerror(new Event('error')))
    return link
  })
  const result = await autoLoadFontForText('नमस्ते दुनिया', 'Hindi')
  expect(result).toMatchObject({ fontFamily: 'Noto Sans Devanagari', fontWeight: '700', script: 'devanagari' })
  expect(result.error).toContain('Failed to load font')
  expect(document.head.appendChild).toHaveBeenCalledTimes(1)
})
