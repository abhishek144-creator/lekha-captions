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

/**
 * Build the canonical word reveal schedule shared by preview and export.
 * Every boundary is strictly ordered and, whenever the caption has enough
 * duration, separated by more than one 24fps frame so adjacent words cannot
 * land in the same rendered frame. CPT captions additionally get a readable
 * beat per word (see below). Serialized into the export renderer with
 * toString(), so it stays self-contained apart from getCaptionWordStartTime.
 */
export function getCaptionWordRevealTimes(caption = {}, wordCount = 1, minSeparation = 0.05) {
  const count = Math.max(1, Number(wordCount) || 1);
  const captionStart = Number(caption.start_time ?? caption.start ?? 0);
  const captionEnd = Math.max(
    captionStart,
    Number(caption.end_time ?? caption.end ?? captionStart),
  );
  const duration = Math.max(0, captionEnd - captionStart);
  const endEpsilon = Math.min(0.001, duration / Math.max(100, count * 10));
  const latestReveal = Math.max(captionStart, captionEnd - endEpsilon);
  const rawTimes = Array.from({ length: count }, (_, index) => {
    const value = getCaptionWordStartTime(caption, index, count);
    return Math.max(captionStart, Math.min(latestReveal, Number(value) || captionStart));
  });

  // A CPT (placed words, `wordStyles` in the editor / `word_styles` in export)
  // builds one word after another, each with a readable beat. Fast speech put
  // a short caption's words within a frame or two of each other, so they
  // seemed to land at once, and a last word spoken at the caption's very end
  // got a single-frame reveal that export never rendered. Each word still
  // follows its spoken start, never earlier unless the caption is too short
  // for every beat; the last one lands with a tail left to read it.
  const placedStyles = Object.values(caption.wordStyles || caption.word_styles || {});
  const isPlacedCaption = placedStyles.some((style) => (
    ['abs_x_pct', 'abs_y_pct', 'x_pct', 'y_pct', 'x', 'y']
      .some((key) => Math.abs(Number(style?.[key]) || 0) > 0.01)
  ));
  if (isPlacedCaption && count > 1 && duration > 0) {
    const tail = Math.min(0.25, duration * 0.2);
    const lastReveal = Math.max(captionStart, captionEnd - tail);
    const beat = Math.min(0.3, (lastReveal - captionStart) / (count - 1));
    const times = [];
    rawTimes.forEach((raw, index) => {
      times.push(index === 0 ? Math.min(raw, lastReveal) : Math.max(raw, times[index - 1] + beat));
    });
    for (let index = count - 1; index >= 0; index -= 1) {
      const limit = index === count - 1 ? lastReveal : times[index + 1] - beat;
      times[index] = Math.max(captionStart, Math.min(times[index], limit));
    }
    return times;
  }

  // Valid measured/provider timings are the media clock, including fast words
  // closer than one output frame. Do not move them to manufacture animation
  // beats. Repair/spacing below is only for missing or malformed alignment.
  const timed = Array.isArray(caption.words) ? caption.words : []
  if (timed.length === count && timed.every((word, index) => (
    Number.isFinite(word?.start) && Number.isFinite(word?.end)
    && word.start >= 0 && word.end > word.start
    && (index === 0 || word.start >= timed[index - 1].end)
  ))) return timed.map(word => Math.max(captionStart, word.start))

  if (count === 1 || duration <= 0) return [rawTimes[0] ?? captionStart];

  const availableDuration = Math.max(0, latestReveal - captionStart);
  const frameSafeSeparation = (1 / 24) + 0.001;
  const requestedSeparation = Math.max(
    frameSafeSeparation,
    Number(minSeparation) || 0.05,
  );
  const separation = Math.max(
    0,
    Math.min(requestedSeparation, availableDuration / (count - 1)),
  );

  // A zero-duration caption cannot provide separate visible beats. Keep a
  // deterministic fallback rather than returning duplicate/non-monotonic data.
  if (separation < 0.0001) {
    const step = duration / count;
    return Array.from({ length: count }, (_, index) => captionStart + (step * index));
  }

  // Clamp every transcription time into a slot that reserves room for all
  // remaining words. This also moves an implausibly late first timestamp back
  // instead of squeezing the final words into a single video frame.
  const revealTimes = [];
  const firstLatest = latestReveal - ((count - 1) * separation);
  revealTimes.push(Math.max(captionStart, Math.min(firstLatest, rawTimes[0] ?? captionStart)));
  for (let index = 1; index < count; index += 1) {
    const earliest = revealTimes[index - 1] + separation;
    const latest = latestReveal - ((count - 1 - index) * separation);
    revealTimes.push(Math.max(earliest, Math.min(latest, rawTimes[index])));
  }
  return revealTimes;
}

export function getCaptionWordRevealIndex(caption = {}, currentTime = 0, wordCount = 1) {
  const revealTimes = getCaptionWordRevealTimes(caption, wordCount);
  const time = Number(currentTime) || 0;
  let activeIndex = 0;
  for (let index = 0; index < revealTimes.length; index += 1) {
    if (time >= revealTimes[index]) activeIndex = index;
    else break;
  }
  return Math.max(0, Math.min(revealTimes.length - 1, activeIndex));
}

/**
 * Advance a playing preview by at most one word per painted frame. Browser
 * media `timeupdate` events can jump hundreds of milliseconds; applying the
 * raw target index would make several words appear in the same paint.
 */
export function advanceCaptionWordRevealIndex(previousIndex, targetIndex, followMediaClock = false) {
  const target = Math.max(0, Math.floor(Number(targetIndex) || 0));
  if (followMediaClock) return target
  if (!Number.isFinite(Number(previousIndex))) return 0;
  const previous = Math.max(0, Math.floor(Number(previousIndex) || 0));
  if (target <= previous) return target;
  return Math.min(target, previous + 1);
}

/**
 * The entrance a CPT word was given in the floating word editor plays when the
 * word is revealed, not when its caption mounts. A word still waiting for its
 * reveal carries no animation, so the animation starts fresh at the reveal and
 * runs once. Started at mount, it ran while the word was hidden and the word
 * then appeared with its entrance already over (or half over).
 */
export function getRevealedWordAnimation(animation, isPending) {
  return !isPending && animation ? animation : 'none'
}
