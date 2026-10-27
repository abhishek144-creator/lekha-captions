import { captionTextKey } from '../../lib/captionTextKey.js'
import languageRules from '../../../shared/captionLanguageRules.json' with { type: 'json' }
export const EMOTIONAL_TEMPLATE_TIMING = Object.freeze({
  holdMs: 3000,
  exitMs: 420,
  gapMs: 50,
  wordStaggerMs: 280,
  positionedWordStaggerMs: 240,
  heroDurationMs: 540,
  supportDurationMs: 380,
});

export const EMPHASIS_STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'being', 'but', 'by',
  'do', 'does', 'for', 'from', 'had', 'has', 'have', 'he', 'her', 'here',
  'him', 'his', 'how', 'i', 'if', 'in', 'is', 'it', 'its', 'me', 'my',
  'of', 'on', 'or', 'our', 'she', 'so', 'than', 'that', 'the',
  'their', 'them', 'then', 'there', 'these', 'they', 'this', 'to', 'too',
  'up', 'us', 'was', 'we', 'were', 'what', 'when', 'where', 'which', 'who',
  'why', 'will', 'with', 'you', 'your',
  // Negations (no, not, नहीं, ना, मत) are deliberately absent: they are scored
  // by NEGATIONS in selectSemanticEmphasis, because they carry the meaning.
  'am', 'just', 'really', 'very', 'also', 'about', 'into', 'over', 'some', 'any',
  'all', 'can', 'could', 'would', 'should', 'get', 'got', 'go', 'going', 'gonna',
  'wanna', 'its', "it's", "i'm", "that's", "you're", "we're", "they're", "there's",
  'okay', 'ok', 'yeah', 'um', 'uh', 'like', 'now', 'only', 'even', 'still', 'again',
  'और', 'या', 'पर', 'पे', 'से', 'को', 'का', 'की', 'के', 'में', 'तक', 'तो',
  'ही', 'भी', 'ने', 'लिए', 'कि', 'जो', 'वो', 'यह', 'ये', 'वह', 'वे', 'मैं',
  'हम', 'आप', 'तुम', 'मुझे', 'मेरे', 'मेरा', 'मेरी', 'हमारा', 'हमारी', 'आपका', 'आपकी', 'आपको',
  'उनका', 'उनकी', 'उनको', 'इस', 'उस', 'इन', 'उन', 'है', 'हैं', 'था', 'थे', 'थी',
  'हो', 'होगा', 'होगी', 'होंगे', 'रहा', 'रही', 'रहे', 'कर', 'करके', 'किया', 'करना',
  'बस', 'अब', 'तब', 'यहाँ', 'वहाँ', 'कहाँ', 'क्यों', 'कैसे', 'क्या', 'आज',
  'कल',
  // Positions, quantities and helper verbs: they frame a sentence, they don't
  // carry it ("मेरे पीछे जो आप शिप देख" highlights शिप, not पीछे).
  'पीछे', 'आगे', 'ऊपर', 'नीचे', 'अंदर', 'बाहर', 'साथ', 'बाद', 'पहले', 'फिर', 'सब',
  'कुछ', 'एक', 'वाला', 'वाली', 'वाले', 'गया', 'गई', 'गए', 'दिया', 'लिया', 'करते',
  'करती', 'होता', 'होती', 'होते', 'सकते', 'सकता', 'सकती', 'चाहिए', 'जब', 'अगर',
  'जैसे', 'ऐसे', 'वैसे', 'इसे', 'उसे', 'इसका', 'उसका', 'इसकी', 'उसकी', 'अपना', 'अपनी',
  'अपने', 'यहां', 'वहां', 'रहें', 'हुआ', 'हुई', 'हुए', 'यार', 'मतलब', 'अच्छा', 'हाँ', 'हां',
]);

const languageAliases = {
  english: 'en', hindi: 'hi', hinglish: 'hi', tamil: 'ta', telugu: 'te', bengali: 'bn',
  marathi: 'mr', gujarati: 'gu', kannada: 'kn', malayalam: 'ml', punjabi: 'pa', urdu: 'ur',
  french: 'fr', spanish: 'es', german: 'de', portuguese: 'pt', arabic: 'ar', russian: 'ru',
}
const inferredScriptLanguage = text => {
  /** @type {[RegExp, string][]} */
  const scripts = [[/\p{Script=Devanagari}/u, 'hi'], [/\p{Script=Tamil}/u, 'ta'], [/\p{Script=Telugu}/u, 'te'], [/\p{Script=Bengali}/u, 'bn'], [/\p{Script=Gujarati}/u, 'gu'], [/\p{Script=Kannada}/u, 'kn'], [/\p{Script=Malayalam}/u, 'ml'], [/\p{Script=Gurmukhi}/u, 'pa'], [/\p{Script=Arabic}/u, 'ur'], [/\p{Script=Cyrillic}/u, 'ru']]
  for (const [pattern, language] of scripts) {
    if (pattern.test(text)) return language
  }
  return 'en'
}
export function getEmphasisStopWords(text = '', language = '') {
  const code = String(language).toLowerCase().split(/[-_]/)[0]
  const key = languageAliases[code] || code || inferredScriptLanguage(text)
  const selected = languageRules.functionWords[key] || languageRules.functionWords[inferredScriptLanguage(text)]
  // Keep the original English/Hindi discourse exclusions only in those
  // languages. Unioning every language made English "die" a German article.
  const words = new Set(selected.toLowerCase().split(/\s+/))
  if (key === 'en' || key === 'hi') EMPHASIS_STOP_WORDS.forEach(word => words.add(word))
  return words
}

export function normalizeEmphasisWord(word = '') {
  return String(word)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/^[^\p{L}\p{M}\p{N}]+|[^\p{L}\p{M}\p{N}]+$/gu, '');
}

export function countLettersAndNumbers(word = '') {
  return Array.from(word.matchAll(/[\p{L}\p{M}\p{N}]/gu)).length;
}

const semanticActions = new Set(languageRules.contentActions.split(/\s+/))
const emotionalWords = new Set(languageRules.emotionalWords.split(/\s+/))
const nounLeads = new Set(languageRules.nounLeads.split(/\s+/))
const nounTails = new Set(languageRules.nounTails.split(/\s+/))
const actionLeads = new Set(languageRules.actionLeads.split(/\s+/))
const actionTails = new Set(languageRules.actionTails.split(/\s+/))
const isActionWord = word => semanticActions.has(word) || (/^[a-z]+$/u.test(word || '') && ['s', 'ed', 'ing'].some(suffix => word.endsWith(suffix) && semanticActions.has(word.slice(0, -suffix.length))))
const clauseStarters = new Set(languageRules.clauseStarters.split(/\s+/))
// Words that reverse a sentence. Emphasising the word they negate alone
// ("I did not WIN") says the opposite of what was spoken, so a negated
// candidate hands its emphasis to the negation ("I did NOT win").
const NEGATIONS = new Set([
  'not', 'never', 'no', "don't", "doesn't", "didn't", "can't", 'cannot', "won't", "isn't", "aren't", "wasn't",
  "weren't", "shouldn't", "wouldn't", "couldn't", 'nothing', 'nobody', 'nahi', 'nahin',
  'नहीं', 'ना', 'मत', 'कभी', 'नही', 'இல்லை', 'లేదు', 'కాదు', 'না', 'নয়', 'نہیں', 'nunca', 'jamais', 'nicht', 'nie', 'não',
])
const NEGATION_SCOPE = 3
// A negation followed by punctuation is an interjection ("No, it worked").
const negates = (words, index) => index < words.length - 1 && !/[,;:.!?।]$/u.test(String(words[index]).trim())

// A conservative local reading when no stored semantic analysis exists.
// Length alone cannot earn emphasis. Numbers, names, main actions, emotional
// terms and noun-phrase relations provide positive evidence in the sentence.
export function selectSemanticEmphasis(words = [], language = '') {
  const stopWords = getEmphasisStopWords(words.join(' '), language)
  const normalized = words.map(normalizeEmphasisWord)
  const negationAt = normalized.map((word, index) => NEGATIONS.has(word) && negates(words, index))
  const candidates = normalized.map((word, index) => {
    if (!word || stopWords.has(word)) return { index, score: -1 }
    // A sentence-level negation is positive evidence on its own.
    if (negationAt[index]) return { index, score: 3 }
    if (NEGATIONS.has(word)) return { index, score: -1 }
    let score = 0
    if (/\p{N}/u.test(word)) score += 5
    if (isActionWord(word)) score += 3.5
    if (emotionalWords.has(word)) score += 3.5
    if (index > 0 && /^\p{Lu}\p{Ll}/u.test(words[index])) score += 3.5
    // Last content token of a noun phrase, rather than its determiner or
    // leading adjective. Indic postpositions bind to the preceding noun.
    if (nounTails.has(normalized[index + 1])) score += 3.2
    if (isActionWord(normalized[index + 1])) score += 4
    // A direct object supplies what the action changes ("builds habits").
    // This is a grammatical signal, not a rule to alternate highlighted words.
    if (isActionWord(normalized[index - 1])) score += 4.2
    if (actionLeads.has(normalized[index - 1]) || actionTails.has(normalized[index + 1])) score += 3.2
    const lead = normalized.slice(Math.max(0, index - 3), index).some(token => nounLeads.has(token))
    if (lead && (!normalized[index + 1] || stopWords.has(normalized[index + 1]) || isActionWord(normalized[index + 1]))) score += 3
    if (index > 0 && clauseStarters.has(normalized[index - 1])) score += 2.5
    if (/[!！]$/.test(words[index])) score += 1
    return { index, score }
  }).filter(item => item.score >= 2.5).sort((a, b) => b.score - a.score || (normalized[a.index] < normalized[b.index] ? -1 : normalized[a.index] > normalized[b.index] ? 1 : 0) || a.index - b.index)
  let chosen = candidates[0]?.index ?? -1
  // The negation keeps the contrast when the chosen word is inside its scope.
  for (let lead = chosen - 1; chosen >= 0 && lead >= Math.max(0, chosen - NEGATION_SCOPE); lead -= 1) {
    if (negationAt[lead]) { chosen = lead; break }
  }
  return { impWordIndex: chosen, impWordIndices: chosen < 0 ? [] : [chosen], emphasisColor: '' }
}

export function quantile(values, amount) {
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
    // LC scenes (left gallery, Studio set): a CPT composition or a display
    // headline is the styled layout; a sentence, including a merged one that
    // flows as a single line, is plain when still and normal when animated.
    const isLcScene = /class="scene"/i.test(block);
    const isMergedSentence = /class="cpt (?:st-flow|splice|serifbreak|baseline|weld)\b/i.test(block)
      && !/\bst-disp\b/i.test(block);
    const type = isLcScene
      ? (/class="cpt\b/i.test(block) && !isMergedSentence
        ? 'styled'
        : (/\bplainwrap\b/i.test(block) || !/data-lc-(?:block-)?anim=/i.test(block) ? 'plain' : 'normal'))
      : /\bplain-s\b/i.test(block)
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
    // A look chosen by the layout director or the user (captionLayoutDirector.js)
    // fixes this caption's mode and keywords; the audio guess must not replace it.
    const manual = Object.entries(caption.wordStyles || {}).filter(([, style]) => style?.isEmphasis).map(([key]) => Number(key.slice(String(caption.id).length + 1)))
    if (caption?.layoutSource === 'auto' || caption?.layoutSource === 'user' || manual.length || caption.imp_word_indices?.length || Number(caption.imp_word_index) >= 0) {
      const chosen = [...new Set([...(caption.imp_word_indices || []), ...(Number(caption.imp_word_index) >= 0 ? [caption.imp_word_index] : []), ...manual])].map(Number).filter(index => Number.isInteger(index) && index >= 0 && index < words.length);
      return {
        captionId: caption.id,
        mode: caption.emotional_mode || mode,
        phaseIndex,
        impWordIndex: chosen[0] ?? -1,
        impWordIndices: chosen,
        emphasisChosen: true,
        emphasisColor: '',
        audio: { rms: audio.rms, peak: audio.peak, silenceRatio: audio.silenceRatio, rising: audio.rising },
      };
    }
    const ai = caption.aiEmotion?.textKey === captionTextKey(caption.text) ? caption.aiEmotion : null
    const stopWords = getEmphasisStopWords(caption.text, caption.language)
    const aiIndices = (Array.isArray(ai?.keywords) ? ai.keywords : []).filter(index => Number.isInteger(index) && index >= 0 && index < words.length && !stopWords.has(normalizeEmphasisWord(words[index]))).slice(0, 2)
    const emphasis = ai
      ? { impWordIndex: aiIndices[0] ?? -1, impWordIndices: aiIndices, emphasisColor: '' }
      : selectSemanticEmphasis(words, caption.language);

    return {
      captionId: caption.id,
      mode,
      phaseIndex,
      impWordIndex: emphasis.impWordIndex,
      impWordIndices: emphasis.impWordIndices || (
        Number.isFinite(Number(emphasis.impWordIndex)) && Number(emphasis.impWordIndex) >= 0
          ? [Number(emphasis.impWordIndex)]
          : []
      ),
      emphasisChosen: false,
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
