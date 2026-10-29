"""Caption text clean-up and word grouping after transcription.

Mixed into processor.VideoProcessor; methods use its instance state.
"""

import re
import json
import math
import unicodedata
from pathlib import Path

try:
    from . import settings
    from .caption_phrasing import segment_auto
    from .caption_phrase_ai import read_phrase_plan
except ImportError:  # Direct execution from backend/ remains supported.
    import settings
    from caption_phrasing import segment_auto
    from caption_phrase_ai import read_phrase_plan

_RULES = json.loads((Path(__file__).resolve().parent.parent / 'shared' / 'captionLanguageRules.json').read_text(encoding='utf-8'))


def _token(text):
    return ''.join(c for c in unicodedata.normalize('NFKC', text).casefold()
                   if unicodedata.category(c)[0] in 'LMN')


_BIND_RIGHT = set((_RULES['bindRight'] + ' ' + _RULES['clauseStarters']).casefold().split())
_BIND_LEFT = set(_RULES['bindLeft'].casefold().split())
_CLAUSE_START = set(_RULES['clauseStarters'].casefold().split())


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

# Auto ("Dynamic") phrases hold at most five words (caption_phrasing.py); the
# 2026-10-26 clause grouper allowed 14 words / 84 characters, which put
# paragraphs on screen.
AUTO_MAX_WORDS = 5


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
            'tanglish': english_hesitations | {'அம்'},
            'tenglish': english_hesitations | {'ఉమ్', 'ఉహ్'},
            'kanglish': english_hesitations,
            'manglish': english_hesitations,
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

    def _read_phrase_plan(self, words, language=''):
        """AI reading of meaning-unit breaks for Auto grouping, or None.

        Costs one small chat call (caption_phrase_ai.py); off when
        CAPTION_PHRASE_AI_ENABLED is 0 or no OpenAI client is configured.
        """
        if not settings.CAPTION_PHRASE_AI_ENABLED or not getattr(self, 'client', None):
            return None
        return read_phrase_plan(self.client, _valid_words(words), language, settings.CAPTION_PHRASE_MODEL)

    def _group_words_by_speech_pace(self, words, min_words=0, max_words=0, phrase_plan=None):
        """Choose phrase boundaries without changing the provider's word clock.

        Auto keeps short, pace-sized phrases (at most five words, fewer for
        slow speech) and picks every sentence's breaks together, so no unit
        of meaning is split (caption_phrasing.py). phrase_plan, an AI reading
        of the same words, only adds evidence. Explicit word-count presets
        remain limits. No timing is extended to fill a pause or meet a
        reading-speed target.
        """
        parsed = _valid_words(words)
        if not parsed:
            return []
        fixed = max_words > 0
        if fixed:
            spans = self._fixed_count_spans(parsed, min_words, max_words)
        else:
            if phrase_plan and phrase_plan.get('words') != [w['word'] for w in parsed]:
                phrase_plan = None
            spans = segment_auto(parsed, phrase_plan)
        groups = []
        for first, last in spans:
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
        return groups

    def _fixed_count_spans(self, parsed, min_words, max_words):
        """Phrases for an explicit word-count preset: (first, last) indexes."""
        def ends_sentence(word):
            return word['word'].rstrip('"”’»)]').endswith(tuple(SENTENCE_END_MARKS))

        def binds(left_word, right_word):
            return _token(left_word['word']) in _BIND_RIGHT or _token(right_word['word']) in _BIND_LEFT

        def is_break(index):
            # A sentence end or a real pause after parsed[index].
            if index + 1 >= len(parsed) or ends_sentence(parsed[index]):
                return True
            return parsed[index+1]['start'] - parsed[index]['end'] >= 0.6

        spans = []
        first = 0
        while first < len(parsed):
            # Never look beyond a real sentence end or a substantial pause.
            candidates = []
            for last in range(first, min(len(parsed), first + max_words)):
                current = parsed[last]
                count = last - first + 1
                chars = sum(len(w['word']) for w in parsed[first:last+1]) + count - 1
                following = parsed[last+1] if last+1 < len(parsed) else None
                gap = following['start'] - current['end'] if following else 0
                hard_end = is_break(last)
                right = _token(following['word']) if following else ''
                score = 0.0
                if hard_end:
                    score += 12
                if current['word'].endswith((',', ';', ':', '،', '；')):
                    score += 5
                if right in _CLAUSE_START and count >= 3:
                    score += 9
                score += min(3, max(0, gap) * 6)
                if following and binds(current, following):
                    score -= 12
                score -= abs(chars - 42) / 14
                if count < 3:
                    score -= 4
                score += count * 2
                if count < min_words and not hard_end:
                    score -= 20
                candidates.append((score, last))
                if hard_end:
                    break
            # Earlier on equal scores; this choice is deterministic.
            _, last = max(candidates, key=lambda pair: pair[0])
            spans.append((first, last))
            first = last + 1
        return spans

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
