import assert from 'node:assert/strict'
import {
  buildPlainText,
  buildSrt,
  buildTextElementExportStyle,
  formatSrtTimestamp,
  getCaptionedVideoFilename,
  hasExportableVideoContent,
  resolveApiResourceUrl,
  shouldAttachApiAuth,
} from '../src/components/dashboard/exportPipelineUtils.js'

const mixedCaptions = [
  { id: 'late', text: '  Later  ', start_time: 2, end_time: 1 },
  { id: 'layer', text: 'Overlay', start_time: 0, end_time: 4, isTextElement: true },
  { id: 'blank', text: '   ', start_time: 0, end_time: 1 },
  { id: 'early', text: 'First', start_time: 0.25, end_time: 1.5 },
]

assert.equal(formatSrtTimestamp(59.9996), '00:01:00,000')
assert.equal(formatSrtTimestamp(-5), '00:00:00,000')
assert.equal(buildPlainText(mixedCaptions), 'First\nLater')
assert.match(buildSrt(mixedCaptions), /^1\n00:00:00,250 --> 00:00:01,500\nFirst/m)
assert.match(buildSrt(mixedCaptions), /2\n00:00:02,000 --> 00:00:02,001\nLater/)
assert.equal(hasExportableVideoContent([{ text: '   ' }, null]), false)
assert.equal(hasExportableVideoContent(null), false)
assert.equal(buildSrt(null), '')
assert.equal(hasExportableVideoContent([{ text: 'Title', isTextElement: true }]), true)
assert.equal(resolveApiResourceUrl('/api/media/upload/1?token=abc', 'https://api.example'), 'https://api.example/api/media/upload/1?token=abc')
assert.equal(resolveApiResourceUrl('/api/media/export/1', 'https://api.example/'), 'https://api.example/api/media/export/1')
assert.equal(resolveApiResourceUrl('/api/media/upload/1', ''), '/api/media/upload/1')
assert.equal(resolveApiResourceUrl('https://storage.example/export.mp4', 'https://api.example'), 'https://storage.example/export.mp4')
assert.equal(resolveApiResourceUrl('/landing/demo.mp4', 'https://api.example'), '/landing/demo.mp4')
assert.equal(shouldAttachApiAuth('/api/export-file/1', 'https://app.example'), true)
assert.equal(shouldAttachApiAuth('https://app.example/api/export-file/1', 'https://app.example'), true)
assert.equal(shouldAttachApiAuth('https://storage.example/api/export-file/1', 'https://app.example'), false)
assert.equal(getCaptionedVideoFilename('C:\\fakepath\\my:clip.mov'), 'my_clip_captioned.mp4')
assert.equal(getCaptionedVideoFilename('.mp4'), 'export_captioned.mp4')

const textElementStyle = buildTextElementExportStyle({
  left: 12,
  top: 34,
  width: 240,
  rotation: 18,
  textOpacity: 0,
  textGradient: 'linear-gradient(to right, #fff, #000)',
  wordSpacing: 0,
  backgroundHMultiplier: 0.8,
  padding: 0,
  effect_type: 'neon',
  effect_blur: 0,
  effect_color: '#00ff00',
})
assert.equal(textElementStyle.position_x, 12)
assert.equal(textElementStyle.position_y, 34)
assert.equal(textElementStyle.width, 240)
assert.equal(textElementStyle.rotation, 18)
assert.equal(textElementStyle.text_opacity, 0)
assert.equal(textElementStyle.word_spacing, 0)
assert.equal(textElementStyle.background_h_multiplier, 0.8)
assert.equal(textElementStyle.background_padding, 0)
assert.equal(textElementStyle.effect_type, 'neon')
assert.equal(textElementStyle.effect_blur, 0)
assert.equal(textElementStyle.effect_color, '#00ff00')

console.log('Export pipeline utility checks passed')
