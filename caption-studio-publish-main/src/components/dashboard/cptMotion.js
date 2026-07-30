export function getCaptionWordStartTime(caption = {}, wordIndex = 0, wordCount = 1) {
  const timedWords = Array.isArray(caption.words)
    ? caption.words.filter((word) => String(word?.word || word?.text || '').trim())
    : [];
  const timedStart = Number(
    timedWords[wordIndex]?.start
    ?? timedWords[wordIndex]?.start_time,
  );
  if (Number.isFinite(timedStart)) return timedStart;

  const start = Number(caption.start_time ?? caption.start ?? 0);
  const end = Number(caption.end_time ?? caption.end ?? start);
  const count = Math.max(1, Number(wordCount) || 1);
  return start + ((Math.max(0, end - start) * wordIndex) / count);
}
