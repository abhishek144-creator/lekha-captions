// A stored semantic reading belongs only to the exact text it describes.
export function captionTextKey(text) {
  let hash = 0x811c9dc5
  for (const char of String(text ?? '').trim()) {
    hash ^= char.codePointAt(0)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16)
}
