"""AI reading of where a transcript's caption phrases begin and end.

One short chat call per transcription (Auto grouping only). It marks the last
word of every meaning unit and the few words that land hardest alone. The
result is only a signal for caption_phrasing.segment_auto: the rules and the
phrase limits still decide, and any failure or implausible answer means the
rules decide alone.
"""

import json

try:
    from .caption_phrasing import BIND_RIGHT, ends_sentence, token
except ImportError:
    from caption_phrasing import BIND_RIGHT, ends_sentence, token

# Words per provider call; a 3-minute video is normally one or two calls.
PHRASE_PLAN_BATCH_WORDS = 400
PHRASE_PLAN_TIMEOUT_SECONDS = 20.0

_INSTRUCTION = (
    "You split a speech transcript into caption phrases for short vertical videos, the way a professional "
    "subtitle editor would. Each phrase is 1 to 5 words a viewer reads at a glance and never splits a unit of "
    "meaning: keep together a name, a number with its unit or currency, an adjective with its noun, a verb with "
    "its auxiliary, particle or negation, a preposition or postposition with its noun, and an idiom. Start a new "
    "phrase at punctuation, at a new clause, before a conjunction and at a dramatic beat. Mark as \"solo\" the rare "
    "word (at most one in fifteen) that hits hardest shown alone: a punchline, reveal or emotional peak. "
    "Words are given as index:word, in any language. Reply with JSON "
    "{\"ends\": [index of the last word of every phrase, ascending], \"solo\": [indexes]}."
)


def _clean_indexes(values, low, high):
    if not isinstance(values, list):
        return None
    clean = []
    for value in values:
        if isinstance(value, bool) or not isinstance(value, (int, float)) or int(value) != value:
            return None
        clean.append(int(value))
    return sorted({value for value in clean if low <= value <= high})


def _read_batch(client, words, first, last, language, model):
    listing = ' '.join(f"{index}:{words[index]['word']}" for index in range(first, last + 1))
    completion = client.chat.completions.create(
        model=model,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": _INSTRUCTION},
            {"role": "user", "content": f"language: {language or 'unknown'}\n{listing}"},
        ],
        temperature=0,
        max_tokens=min(4_000, 60 + 6 * (last - first + 1)),
    )
    raw = json.loads(completion.choices[0].message.content or "{}")
    ends = _clean_indexes(raw.get("ends"), first, last)
    solo = _clean_indexes(raw.get("solo") or [], first, last)
    if not ends or solo is None:
        return None
    return ends, solo


def _plausible(words, breaks):
    """Reject an answer whose indexes drifted off the words they describe."""
    sentence_ends = [index for index in range(len(words) - 1) if ends_sentence(words[index])]
    if len(sentence_ends) >= 3 and sum(index in breaks for index in sentence_ends) < 0.7 * len(sentence_ends):
        return False
    if len(breaks) >= 8 and sum(token(words[index]['word']) in BIND_RIGHT for index in breaks) > 0.15 * len(breaks):
        return False
    previous, long_phrases, phrases = -1, 0, 0
    for index in sorted(breaks | {len(words) - 1}):
        phrases += 1
        long_phrases += index - previous > 7
        previous = index
    return long_phrases <= 0.2 * phrases


def read_phrase_plan(client, words, language="", model="gpt-4o-mini"):
    """{'words', 'breaks', 'covered', 'solo'} for segment_auto, or None.

    words are the parsed caption words (dicts with 'word', 'start', 'end');
    breaks are indexes after which a phrase ends; covered are the gaps the
    reading judged (a covered gap that is not a break holds a phrase).
    """
    if client is None or len(words) < 2:
        return None
    try:
        reader = client.with_options(timeout=PHRASE_PLAN_TIMEOUT_SECONDS)
    except Exception:
        reader = client
    breaks, solo, covered = set(), set(), set()
    try:
        for first in range(0, len(words), PHRASE_PLAN_BATCH_WORDS):
            last = min(len(words), first + PHRASE_PLAN_BATCH_WORDS) - 1
            result = _read_batch(reader, words, first, last, language, model)
            if result is None:
                return None
            ends, batch_solo = result
            breaks.update(index for index in ends if index < last)
            solo.update(batch_solo)
            # The gap between two batches was never seen as a whole.
            covered.update(range(first, last))
    except Exception as error:
        # Type and status only: provider messages can echo request details.
        print(f"[Phrase plan] AI reading unavailable, using rules: {type(error).__name__} {getattr(error, 'status_code', '')}".rstrip())
        return None
    if not _plausible(words, breaks):
        print("[Phrase plan] AI reading rejected as implausible, using rules")
        return None
    return {
        'words': [word['word'] for word in words],
        'breaks': breaks,
        'covered': covered,
        'solo': solo,
    }
