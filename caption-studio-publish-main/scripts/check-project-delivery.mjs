import assert from 'node:assert/strict'
import { deliveryGeometry, videoFrameStyle, bilingualLayers, bilingualSubtitles } from '../src/components/dashboard/projectDelivery.js'
import { reconcileCaptionText } from '../src/components/dashboard/captionEditingUtils.js'
import { buildVtt } from '../src/components/dashboard/exportPipelineUtils.js'

for (const aspect of ['9:16', '1:1', '16:9']) {
  for (const fit of ['cover', 'contain']) {
    const style = JSON.parse(JSON.stringify({ export_aspect_ratio: aspect, frame_fit: fit, frame_x: 0, frame_y: 100 }))
    assert.equal(deliveryGeometry(style).aspect, aspect)
    assert.deepEqual(videoFrameStyle(style), { objectFit: fit, objectPosition: '0% 100%' })
  }
}
assert.equal(deliveryGeometry({ frame_x: Infinity }).x, 50)
const source = [{ id: 'a', text: 'hello world', start_time: 0, end_time: 2, words: [{ word: 'hello', start: 0, end: 1 }, { word: 'world', start: 1, end: 2 }] }]
const tracks = [{ id: 'source', captions: source }, { id: 'hi', captions: [{ id: 'a', text: 'नमस्ते दुनिया', start_time: 0, end_time: 2 }] }]
const original = structuredClone(tracks)
const layers = bilingualLayers(tracks, 'source', { bilingual_track_id: 'hi', bilingual_position_y: 88 })
assert.equal(layers[0].customStyle.top, 88)
assert.deepEqual(layers[0].words, [])
assert.equal(layers[0].isTextElement, true)
assert.equal(bilingualLayers(tracks, 'hi', { bilingual_track_id: 'hi' }).length, 0)
const split = [{ ...source[0], text: 'hello', end_time: 1 }, { ...source[0], id: 'b', text: 'world', start_time: 1 }]
const subtitles = bilingualSubtitles(split, layers)
assert.deepEqual(subtitles.map((cue) => cue.text), ['hello\nनमस्ते दुनिया', 'world\nनमस्ते दुनिया'])
assert.equal(subtitles[0].end_time, subtitles[1].start_time)
assert.deepEqual(tracks, original, 'delivery must never mutate either editable track')
assert.match(buildVtt(subtitles), /नमस्ते दुनिया/)
assert.match(buildVtt([{ ...source[0], text: '<i>literal</i> & text\n\nnext' }]), /&lt;i&gt;literal&lt;\/i&gt; &amp; text\nnext/)
const changed = reconcileCaptionText(source[0], 'hello new world')
assert.equal(reconcileCaptionText(changed, 'Hello new world').word_alignment_status, 'needs_review', 'a second edit must not turn unmeasured words into measured alignment')
console.log('Project delivery geometry, bilingual segmentation, VTT and alignment tests passed.')
