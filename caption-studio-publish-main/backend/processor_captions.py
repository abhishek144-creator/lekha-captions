"""Caption text clean-up and word grouping after transcription.

Mixed into processor.VideoProcessor; methods use its instance state.
"""

import re
import json
import math
import unicodedata
from pathlib import Path

_RULES = json.loads((Path(__file__).resolve().parent.parent / 'shared' / 'captionLanguageRules.json').read_text(encoding='utf-8'))


def _token(text):
    return ''.join(c for c in unicodedata.normalize('NFKC', text).casefold()
                   if unicodedata.category(c)[0] in 'LMN')


_BIND_RIGHT = set((_RULES['bindRight'] + ' ' + _RULES['clauseStarters']).casefold().split())
_BIND_LEFT = set(_RULES['bindLeft'].casefold().split())
_CLAUSE_START = set(_RULES['clauseStarters'].casefold().split())
# Grouping-only cues (not emphasis evidence, so not in the shared rules): a
# short phrase reads best when it breaks before a coordinating word and never
# strands a subject pronoun at its end.
_SOFT_CLAUSE_START = set('and or but so that which who where when if while how what why then और या पर तो कि जो जब अगर फिर'.split())
_SUBJECT_PRONOUNS = set('i we they he she मैं हम'.split())


def _valid_words(words):
    parsed = []
    for word in words:
        item = dict(word) if isinstance(word, dict) else {key: getattr(word, key, None) for key in ('word', 'start', 'end')}
        try:
            start, end = float(item['start']), float(item['end'])
        except (ValueError, TypeError, KeyError):
            continue
        text = str(item.get('word') or '').strip()
        if text and math.isfinite(start) and math.isfinite(end) and 0 <= start < end:
            if not _token(text) and all(c in '.,!?;:।॥۔؟。！？،…' for c in text) and parsed:
                parsed[-1] = {**parsed[-1], 'word': parsed[-1]['word'] + text}
                continue
            parsed.append({**item, 'word': text, 'start': start, 'end': end})
    return parsed

# Sentence-ending marks across the scripts we transcribe: Latin, Devanagari
# and other Indic danda, Arabic/Urdu, and CJK full-width forms.
SENTENCE_END_MARKS = ".!?।॥۔؟。！？"

# Auto ("Dynamic") phrase limits. Short-form captions read best as a few
# words at a time; the 2026-10-26 clause grouper allowed 14 words / 84
# characters, which put paragraphs on screen.
AUTO_MAX_WORDS = 5
AUTO_MAX_CHARS = 32
AUTO_TARGET_CHARS = 24
AUTO_MAX_SECONDS = 3.2
AUTO_PAUSE_SECONDS = 0.3


class CaptionTextMixin:
    def _restore_transcript_punctuation(self, words, transcript):
        # Whisper's word array can omit punctuation present in transcript.text.
        # Borrow only punctuation, only when every token agrees; never align a
        # paraphrase to somebody else's word clock.
        if not isinstance(transcript, str):
            return words
        tokens = transcript.split()
        if len(tokens) != len(words) or any(_token(t) != _token(w['word']) for t, w in zip(tokens, words)):
            return words
        return [{**w, 'word': t} for t, w in zip(tokens, words)]

    def _clean_transcript_words(self, words, mode='clean', language='english'):
        """Remove only unambiguous hesitations and overlapping ASR duplicates.

        Repeated speech ("very very", "हाँ हाँ") and meaningful discourse words
        stay. A duplicate is an ASR artifact only when its time overlaps the
        same token. Retained tokens keep their original clock and metadata.
        """
        parsed = _valid_words(words)
        if mode == 'verbatim':
            return parsed
        # "um" is a Portuguese article/German preposition; "er" is a German
        # pronoun. Never run an English hesitation list over every language.
        language = str(language or '').lower().split('-')[0]
        english_hesitations = {'um', 'uh', 'erm', 'uhm'}
        hesitations = {
            'english': english_hesitations, 'en': english_hesitations,
            'hindi': {'उम्म', 'उह'}, 'hi': {'उम्म', 'उह'},
            'tamil': {'அம்'}, 'ta': {'அம்'},
            'telugu': {'ఉమ్', 'ఉహ్'}, 'te': {'ఉమ్', 'ఉహ్'},
            'hinglish': english_hesitations | {'उम्म', 'उह'},
        }.get(language, set())
        cleaned = []
        for index, word in enumerate(parsed):
            token = _token(word['word'])
            previous_text = parsed[index-1]['word'] if index else ''
            next_text = parsed[index+1]['word'] if index+1 < len(parsed) else ''
            mentioned_as_word = _token(previous_text) in {'word', 'named', 'called', 'शब्द', 'नाम', 'పేరు'}
            quoted = word['word'].startswith(('"', "'", '“', '‘', '«'))
            english_name = language in {'english', 'en'} and (
                (index > 0 and word['word'][:1].isupper() and not previous_text.endswith(tuple(SENTENCE_END_MARKS)))
                or (next_text[:1].isupper() and _token(next_text) not in _RULES['functionWords']['en'].lower().split()))
            if token in hesitations and not (word.get('named_entity') or mentioned_as_word or quoted or english_name):
                continue
            if cleaned and token == _token(cleaned[-1]['word']):
                previous = cleaned[-1]
                overlap = min(previous['end'], word['end']) - max(previous['start'], word['start'])
                if (word.get('speaker_id') == previous.get('speaker_id')
                        and overlap > 0.5 * min(previous['end'] - previous['start'], word['end'] - word['start'])):
                    continue
            cleaned.append(word)
        return cleaned

    def _group_words_by_speech_pace(self, words, min_words=0, max_words=0):
        """Choose phrase boundaries without changing the provider's word clock.

        Explicit word-count presets remain limits. Auto keeps the short,
        pace-sized phrases the editor used before 2026-10-26 (at most five
        words, a break at every 0.3 s pause, fewer words for slow speech) and
        chooses each cut with punctuation and grammatical joins. No timing is
        extended to fill a pause or meet a reading-speed target.
        """
        parsed = _valid_words(words)
        if not parsed:
            return []
        fixed = max_words > 0
        limit = max_words if fixed else AUTO_MAX_WORDS

        def ends_sentence(word):
            return word['word'].rstrip('"”’»)]').endswith(tuple(SENTENCE_END_MARKS))

        def binds(left_word, right_word):
            return _token(left_word['word']) in _BIND_RIGHT or _token(right_word['word']) in _BIND_LEFT

        def is_break(index):
            # A sentence end or a real pause after parsed[index]. In Auto a
            # 0.3 s pause breaks unless the two words are grammatically joined.
            if index + 1 >= len(parsed) or ends_sentence(parsed[index]):
                return True
            gap = parsed[index+1]['start'] - parsed[index]['end']
            if fixed:
                return gap >= 0.6
            return gap >= 0.6 or (gap >= AUTO_PAUSE_SECONDS and not binds(parsed[index], parsed[index+1]))

        groups = []
        first = 0
        while first < len(parsed):
            # Local pace sets the phrase size: slow speech gets punchy 1-2
            # word captions, fast speech up to the five-word limit.
            window = parsed[first:first + 6]
            pace = len(window) / max(0.3, window[-1]['end'] - window[0]['start'])
            target = 2 if pace < 2 else 3 if pace <= 4 else 4
            # Never look beyond a real sentence end or a substantial pause.
            candidates = []
            for last in range(first, min(len(parsed), first + limit)):
                current = parsed[last]
                count = last - first + 1
                seconds = current['end'] - parsed[first]['start']
                chars = sum(len(w['word']) for w in parsed[first:last+1]) + count - 1
                if not fixed and last > first and (seconds > AUTO_MAX_SECONDS or chars > AUTO_MAX_CHARS):
                    break
                following = parsed[last+1] if last+1 < len(parsed) else None
                gap = following['start'] - current['end'] if following else 0
                hard_end = is_break(last)
                right = _token(following['word']) if following else ''
                score = 0.0
                if hard_end:
                    score += 12
                if current['word'].endswith((',', ';', ':', '،', '；')):
                    score += 5
                if right in _CLAUSE_START and count >= (3 if fixed else 2):
                    score += 9
                score += min(3, max(0, gap) * 6)
                if following and binds(current, following):
                    score -= 12
                if fixed:
                    score -= abs(chars - 42) / 14
                    if count < 3:
                        score -= 4
                else:
                    left = _token(current['word'])
                    if right in _SOFT_CLAUSE_START and left not in _SOFT_CLAUSE_START:
                        score += 6
                    if following and (left in _SUBJECT_PRONOUNS or left in _SOFT_CLAUSE_START or left in _CLAUSE_START):
                        score -= 8
                    # Short over long: one word under the pace target costs
                    # more than one over, and a lone word left before the
                    # next break would flash on screen by itself.
                    score -= (target - count) * 2.5 if count < target else (count - target) * 2
                    score -= max(0, chars - AUTO_TARGET_CHARS) * 0.4
                    if count < 2 and not hard_end:
                        score -= 3
                    # Under 0.35 s it would flash, and the tiny-caption merge
                    # afterwards would then build an over-long phrase.
                    if seconds < 0.35 and not hard_end:
                        score -= 8
                    if not hard_end:
                        next_break = last + 1
                        while not is_break(next_break):
                            next_break += 1
                        if next_break == last + 1 and count >= 2:
                            score -= 6
                if fixed:
                    score += count * 2
                    if count < min_words and not hard_end:
                        score -= 20
                candidates.append((score, last))
                if hard_end:
                    break
            if not candidates:
                candidates = [(0, first)]
            # Earlier on equal scores; this choice is deterministic.
            _, last = max(candidates, key=lambda pair: pair[0])
            group = parsed[first:last+1]
            groups.append({
                'id': len(groups), 'text': ' '.join(w['word'] for w in group),
                'start_time': group[0]['start'], 'end_time': group[-1]['end'],
                'intentional_single_word': len(group) == 1,
                # Read (and removed) by _post_process_captions: a tiny-caption
                # merge may not grow an Auto phrase past its limit.
                'phrase_word_limit': 0 if fixed else AUTO_MAX_WORDS,
                'word_alignment_status': 'estimated' if any(w.get('timing_source') == 'sarvam_phrase_estimate' for w in group) else 'aligned',
                'words': group,
            })
            first = last + 1
        return groups

    def _normalize_caption_text(self, text):
        t = " ".join((text or "").strip().split())
        if not t:
            return t
        # Keep only punctuation that was transcribed: a caption is often part of
        # a sentence, so adding a full stop put one mid-sentence ("welcome to.").
        return re.sub(r"\s+([,.!?;:।॥])", r"\1", t)

    def _post_process_captions(self, captions):
        if not captions:
            return []

        normalized = []
        for cap in captions:
            c = dict(cap)
            c["text"] = self._normalize_caption_text(c.get("text", ""))
            c["start_time"] = float(c.get("start_time", 0) or 0)
            c["end_time"] = float(c.get("end_time", 0) or 0)
            if c["end_time"] <= c["start_time"]:
                c["end_time"] = c["start_time"] + 0.35
            normalized.append(c)

        merged = []
        i = 0
        while i < len(normalized):
            cur = normalized[i]
            cur_dur = cur["end_time"] - cur["start_time"]
            word_count = len((cur.get("text") or "").split())
            tiny = not cur.get("intentional_single_word") and (cur_dur < 0.35 and word_count <= 2)
            limit = cur.get("phrase_word_limit") or 0
            if (tiny and i + 1 < len(normalized)
                    and (not limit or word_count + len((normalized[i+1].get("text") or "").split()) <= limit)
                    and normalized[i+1]['start_time'] - cur['end_time'] < 0.3
                    and not cur['text'].endswith(tuple(SENTENCE_END_MARKS))):
                nxt = dict(normalized[i + 1])
                nxt["text"] = self._normalize_caption_text(f"{cur.get('text', '')} {nxt.get('text', '')}")
                nxt["start_time"] = min(cur["start_time"], nxt.get("start_time", cur["start_time"]))
                words = list(cur.get("words") or []) + list(nxt.get("words") or [])
                if words:
                    nxt["words"] = sorted(words, key=lambda item: float(item.get("start", 0) or 0))
                merged.append(nxt)
                i += 2
                continue
            merged.append(cur)
            i += 1

        # A tiny final caption has no next caption to join, so it would flash
        # on screen alone ("होगी।" for 0.24 s); join it to the one before.
        if len(merged) > 1:
            last = merged[-1]
            last_dur = last["end_time"] - last["start_time"]
            last_limit = last.get("phrase_word_limit") or 0
            if (not last.get("intentional_single_word") and last_dur < 0.35
                    and len((last.get("text") or "").split()) <= 2
                    and (not last_limit or len((last.get("text") or "").split())
                         + len((merged[-2].get("text") or "").split()) <= last_limit)
                    and last["start_time"] - merged[-2]["end_time"] < 0.3
                    and not merged[-2]["text"].endswith(tuple(SENTENCE_END_MARKS))):
                prev = dict(merged[-2])
                prev["text"] = self._normalize_caption_text(f"{prev.get('text', '')} {last.get('text', '')}")
                prev["end_time"] = max(prev["end_time"], last["end_time"])
                prev["words"] = list(prev.get("words") or []) + list(last.get("words") or [])
                merged[-2:] = [prev]

        # Reading-speed pressure must never invent a longer audio interval.
        for idx, cap in enumerate(merged):
            if idx < len(merged) - 1:
                cap['end_time'] = min(cap['end_time'], merged[idx+1]['start_time'])
            cap['id'] = idx
            cap.pop('phrase_word_limit', None)
        return merged
