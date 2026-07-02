export const EMOTIONAL_TEMPLATE_TIMING = Object.freeze({
  holdMs: 3000,
  exitMs: 420,
  gapMs: 50,
  wordStaggerMs: 280,
  positionedWordStaggerMs: 240,
  heroDurationMs: 540,
  supportDurationMs: 380,
});

const EMPHASIS_STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'being', 'but', 'by',
  'do', 'does', 'for', 'from', 'had', 'has', 'have', 'he', 'her', 'here',
  'him', 'his', 'how', 'i', 'if', 'in', 'is', 'it', 'its', 'me', 'my',
  'no', 'not', 'of', 'on', 'or', 'our', 'she', 'so', 'than', 'that', 'the',
  'their', 'them', 'then', 'there', 'these', 'they', 'this', 'to', 'too',
  'up', 'us', 'was', 'we', 'were', 'what', 'when', 'where', 'which', 'who',
  'why', 'will', 'with', 'you', 'your',
  'और', 'या', 'पर', 'पे', 'से', 'को', 'का', 'की', 'के', 'में', 'तक', 'तो',
  'ही', 'भी', 'ने', 'लिए', 'कि', 'जो', 'वो', 'यह', 'ये', 'वह', 'वे', 'मैं',
  'हम', 'आप', 'तुम', 'मुझे', 'मेरे', 'मेरा', 'मेरी', 'हमारा', 'हमारी', 'आपका', 'आपकी', 'आपको',
  'उनका', 'उनकी', 'उनको', 'इस', 'उस', 'इन', 'उन', 'है', 'हैं', 'था', 'थे', 'थी',
  'हो', 'होगा', 'होगी', 'होंगे', 'रहा', 'रही', 'रहे', 'कर', 'करके', 'किया', 'करना', 'नहीं',
  'ना', 'मत', 'बस', 'अब', 'तब', 'यहाँ', 'वहाँ', 'कहाँ', 'क्यों', 'कैसे', 'क्या', 'आज',
  'कल',
]);

function normalizeEmphasisWord(word = '') {
  return String(word)
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/^[^\p{L}\p{M}\p{N}]+|[^\p{L}\p{M}\p{N}]+$/gu, '');
}

function countLettersAndNumbers(word = '') {
  return Array.from(word.matchAll(/[\p{L}\p{M}\p{N}]/gu)).length;
}

function selectSemanticEmphasis(words = [], audioImpWordIndex = -1) {
  let best = null;
  let fallback = null;
  words.forEach((rawWord, index) => {
    const word = normalizeEmphasisWord(rawWord);
    if (!word) return;

    const length = countLettersAndNumbers(word);
    const isNumber = /^\p{N}+(?:[.,]\p{N}+)*$/u.test(word);
    if (
      !fallback
      || length > fallback.length
      || (index === audioImpWordIndex && fallback.index !== audioImpWordIndex)
    ) {
      fallback = { index, word, length };
    }
    if (EMPHASIS_STOP_WORDS.has(word)) return;
    if (!isNumber && length < 3) return;

    let score = Math.min(4.5, length * 0.72);
    if (isNumber) score += 2.2;
    if (index === audioImpWordIndex) score += 0.55;
    if (index > 0 && index < words.length - 1) score += 0.2;

    if (!best || score > best.score) best = { index, score, word };
  });

  // Emphasis color is intentionally left empty: each template supplies its own
  // single theme color (via its imp-* class / sidebar accent, pinned in
  // resolveAdvancedTemplateEmphasisColor). This keeps one consistent highlight
  // color per template instead of a per-word rotating palette.
  if (!best || best.score < 2.35) {
    if (!fallback) return { impWordIndex: -1, emphasisColor: '' };
    return {
      impWordIndex: fallback.index,
      emphasisColor: '',
    };
  }
  return {
    impWordIndex: best.index,
    emphasisColor: '',
  };
}

function quantile(values, amount) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.min(sorted.length - 1, Math.round((sorted.length - 1) * amount)));
  return sorted[index];
}

function getCaptionSamples(caption, waveformData, duration) {
  if (!Array.isArray(waveformData) || !waveformData.length || !duration) return [];
  const start = Math.max(0, Number(caption?.start_time || 0));
  const end = Math.max(start, Number(caption?.end_time || start));
  const from = Math.max(0, Math.floor((start / duration) * waveformData.length));
  const to = Math.max(from + 1, Math.ceil((end / duration) * waveformData.length));
  return waveformData
    .slice(from, Math.min(waveformData.length, to))
    .map(Number)
    .filter(Number.isFinite)
    .map(Math.abs);
}

function analyzeCaptionAudio(caption, waveformData, duration, globalStats) {
  const samples = getCaptionSamples(caption, waveformData, duration);
  if (!samples.length) {
    return { rms: 0, peak: 0, silenceRatio: 1, rising: false, impWordIndex: 0, hasAudio: false };
  }

  const rms = Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
  const peak = Math.max(...samples);
  const silenceRatio = samples.filter((value) => value <= globalStats.noiseFloor).length / samples.length;
  const midpoint = Math.max(1, Math.floor(samples.length / 2));
  const firstHalf = samples.slice(0, midpoint);
  const secondHalf = samples.slice(midpoint);
  const average = (values) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
  const rising = secondHalf.length > 0 && average(secondHalf) > average(firstHalf) * 1.18;

  const words = String(caption?.text || '').trim().split(/\s+/).filter(Boolean);
  let impWordIndex = 0;
  let impPeak = -1;
  words.forEach((_, wordIndex) => {
    const from = Math.floor((wordIndex / words.length) * samples.length);
    const to = Math.max(from + 1, Math.ceil(((wordIndex + 1) / words.length) * samples.length));
    const wordPeak = Math.max(...samples.slice(from, to));
    if (wordPeak > impPeak) {
      impPeak = wordPeak;
      impWordIndex = wordIndex;
    }
  });

  return { rms, peak, silenceRatio, rising, impWordIndex, hasAudio: true };
}

function extractCompleteDiv(markup, startIndex) {
  const tagPattern = /<\/?div\b[^>]*>/gi;
  tagPattern.lastIndex = startIndex;
  let depth = 0;
  let match;
  while ((match = tagPattern.exec(markup))) {
    depth += match[0].startsWith('</') ? -1 : 1;
    if (depth === 0) return markup.slice(startIndex, tagPattern.lastIndex);
  }
  return '';
}

export function getTemplatePhaseTypes(markup = '') {
  const source = String(markup || '');
  const phases = [];
  const blockPattern = /<div class="[^"]*\b(?:sb|sblock|bt-cap-block)\b[^"]*"/gi;
  let match;
  while ((match = blockPattern.exec(source))) {
    const block = extractCompleteDiv(source, match.index);
    if (!block) break;
    const type = /\bplain-s\b/i.test(block)
      ? 'plain'
      : /\bwbw(?:-line)?\b/i.test(block)
        ? 'normal'
        : /\b(?:sw|sw-w|pos\d+)\b/i.test(block)
          ? 'styled'
          : 'normal';
    phases.push(type);
    blockPattern.lastIndex = match.index + block.length;
  }
  return phases.length ? phases : ['styled'];
}

export function buildEmotionalCaptionPlan(captions = [], waveformData = [], duration = 0, templateMarkup = '') {
  const speechCaptions = captions.filter((caption) => caption && !caption.isTextElement);
  const waveform = Array.isArray(waveformData)
    ? waveformData.map(Number).filter(Number.isFinite).map(Math.abs)
    : [];
  const globalStats = {
    noiseFloor: Math.max(0.015, quantile(waveform, 0.2) * 1.15),
    lowRms: Math.max(0.035, quantile(waveform, 0.45)),
    highRms: Math.max(0.08, quantile(waveform, 0.72)),
    highPeak: Math.max(0.45, quantile(waveform, 0.92)),
  };
  const phaseTypes = getTemplatePhaseTypes(templateMarkup);
  return speechCaptions.map((caption, captionIndex) => {
    const audio = analyzeCaptionAudio(caption, waveform, duration, globalStats);
    let mode;
    if (captionIndex === 0) {
      mode = 'styled';
    } else if (!audio.hasAudio) {
      mode = ['normal', 'plain', 'styled'][(captionIndex - 1) % 3];
    } else if (
      (audio.peak >= globalStats.highPeak && audio.rms >= globalStats.lowRms * 1.05)
      || audio.rms >= globalStats.highRms
      || (audio.rising && audio.rms >= globalStats.lowRms)
    ) {
      mode = 'styled';
    } else if (audio.silenceRatio > 0.4 || audio.rms < globalStats.lowRms) {
      mode = 'plain';
    } else {
      mode = 'normal';
    }

    // The template preview is an authored sentence sequence. Preserve that exact
    // sequence across real captions; audio intelligence enriches emphasis/mode
    // metadata but must never collapse multiple captions onto the first phase.
    const phaseIndex = captionIndex % phaseTypes.length;
    const words = String(caption?.text || '').trim().split(/\s+/).filter(Boolean);
    const emphasis = selectSemanticEmphasis(words, audio.impWordIndex);

    return {
      captionId: caption.id,
      mode,
      phaseIndex,
      impWordIndex: emphasis.impWordIndex,
      emphasisColor: emphasis.emphasisColor,
      audio: {
        rms: audio.rms,
        peak: audio.peak,
        silenceRatio: audio.silenceRatio,
        rising: audio.rising,
      },
    };
  });
}
