import assert from 'node:assert/strict'
import {
  duplicateCaptionWithTiming,
  invalidateWordTimingOutsideCaption,
  reconcileCaptionText,
  splitCaptionAtBoundary,
} from '../src/components/dashboard/captionEditingUtils.js'

const source = {
  id: 'caption-1',
  text: 'hello bright world',
  start_time: 1,
  end_time: 4,
  words: [
    { word: 'hello', start: 1, end: 2 },
    { word: 'bright', start: 2, end: 3 },
    { word: 'world', start: 3, end: 4 },
  ],
  wordStyles: {
    'caption-1-0': { color: 'red' },
    'caption-1-2': { color: 'blue' },
  },
  imp_word_indices: [2],
}

const inserted = reconcileCaptionText(source, 'hello very bright world')
assert.equal(inserted.words.length, 4)
assert.deepEqual(inserted.words.map((word) => [word.word, word.start, word.end]), [
  ['hello', 1, 2],
  ['very', undefined, undefined],
  ['bright', 2, 3],
  ['world', 3, 4],
])
assert.deepEqual(inserted.wordStyles['caption-1-3'], { color: 'blue' })
assert.equal(inserted.imp_word_index, 3)
assert.equal(inserted.word_alignment_status, 'needs_review')

const rejectedSplit = splitCaptionAtBoundary(source, 2, 'caption-2')
assert.match(rejectedSplit.error, /between words/i)

const split = splitCaptionAtBoundary(source, source.text.indexOf('bright'), 'caption-2').captions
assert.deepEqual(split.map((caption) => caption.text), ['hello', 'bright world'])
assert.deepEqual(split[0].words.map((word) => word.word), ['hello'])
assert.deepEqual(split[1].words.map((word) => word.word), ['bright', 'world'])
assert.deepEqual(split[1].wordStyles['caption-2-1'], { color: 'blue' })
assert.ok(split.every((caption) => caption.words.every((word) => word.start >= caption.start_time && word.end <= caption.end_time)))

const duplicate = duplicateCaptionWithTiming(source, 'caption-copy')
assert.equal(duplicate.words[0].start, duplicate.start_time)
assert.ok(duplicate.wordStyles['caption-copy-2'])

const resized = invalidateWordTimingOutsideCaption({ ...source, start_time: 1.5 })
assert.deepEqual(resized.words, [])
assert.equal(resized.word_alignment_status, 'needs_review')

const indic = reconcileCaptionText({
  ...source,
  text: 'नमस्ते दुनिया',
  words: [{ word: 'नमस्ते', start: 1, end: 2 }, { word: 'दुनिया', start: 2, end: 4 }],
  wordStyles: {},
}, 'नमस्ते सुंदर दुनिया')
assert.deepEqual(indic.words.map((word) => word.word), ['नमस्ते', 'सुंदर', 'दुनिया'])
assert.equal(indic.words[2].start, 2)

const compactText = '你好世界'
const compactSplitPosition = [...new Intl.Segmenter('zh', { granularity: 'word' }).segment(compactText)]
  .filter((segment) => segment.isWordLike)[0].segment.length
const compactSplit = splitCaptionAtBoundary({
  id: 'compact-1',
  text: compactText,
  start_time: 0,
  end_time: 2,
  words: [],
  wordStyles: {},
}, compactSplitPosition, 'compact-2')
assert.equal(compactSplit.captions.length, 2, 'non-space-delimited scripts must split at word boundaries')
assert.equal(compactSplit.captions.map((caption) => caption.text).join(''), compactText)

console.log('Caption editing invariants passed.')
