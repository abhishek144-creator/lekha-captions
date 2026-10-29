"""Phrase-aware grouping for Auto ("Dynamic") captions.

Every gap between two words gets a glue score. It is positive where a caption
should not split: an article and its noun, a name, a number and its unit, a
Hindi verb and its auxiliary. It is negative where a new phrase naturally
starts: punctuation, a clause word, a real pause, or a break an AI reading of
the script suggests. A dynamic program then picks the cheapest set of caption
breaks for each sentence, so one short caption never forces an awkward split
later on. The provider's word clock is never changed.
"""

import json
import math
import unicodedata
from pathlib import Path

_RULES = json.loads((Path(__file__).resolve().parent.parent / 'shared' / 'captionLanguageRules.json').read_text(encoding='utf-8'))
_PHRASING = _RULES['phrasing']


def _words(text):
    return set(str(text).casefold().split())


def token(text):
    return ''.join(c for c in unicodedata.normalize('NFKC', str(text)).casefold()
                   if unicodedata.category(c)[0] in 'LMN')


SENTENCE_END_MARKS = ".!?।॥۔؟。！？"
PHRASE_END_MARKS = (',', ';', ':', '،', '；', '—', '–', '…', '...')

AUTO_MAX_WORDS = 5
AUTO_MAX_CHARS = 32
AUTO_TARGET_CHARS = 24
AUTO_MAX_SECONDS = 3.2
# A silence this long always ends a caption; shorter pauses only argue for it.
AUTO_HARD_PAUSE_SECONDS = 0.6
# Every break costs a little, so a phrase only splits where something argues
# for it (punctuation, a clause, a pause) or a limit forces it.
BREAK_COST = 3.0

BIND_RIGHT = _words(_RULES['bindRight'] + ' ' + _RULES['clauseStarters'])
BIND_LEFT = _words(_RULES['bindLeft'])
CLAUSE_START = _words(_RULES['clauseStarters'])
# A short phrase reads best when it breaks before a coordinating word and
# never strands a subject pronoun at its end.
SOFT_CLAUSE_START = _words('and or but so that which who where when if while how what why then और या पर तो कि जो जब अगर फिर')
SUBJECT_PRONOUNS = _words('i we they he she मैं हम')
# Any pronoun directly before an auxiliary is its subject ("you are", "it was").
PRONOUNS = _words('i you we they he she it this that there')
AUXILIARIES = _words('is am are was were be been have has had do does did can could will would should must may might shall')
FUNCTION_WORDS = set().union(*(_words(words) for words in _RULES['functionWords'].values()))
INTENSIFIERS = _words(_PHRASING['intensifiers'])
VERB_PARTICLES = _words(_PHRASING['verbParticles'])
DETERMINERS = _words(_PHRASING['determiners'])
# Adjacent word pairs inside a fixed expression ("सब कुछ", "at least").
FIXED_PAIRS = {
    (left, right)
    for expression in _PHRASING['fixedExpressions'].casefold().split('|')
    for left, right in zip(expression.split(), expression.split()[1:])
}
INFINITIVE_HEADS = _words(_PHRASING['infinitiveHeads'])
OF_HEADS = _words(_PHRASING['ofHeads'])
INDIC_VERB_TAILS = _words(_PHRASING['indicVerbTails'])
UNIT_WORDS = _words(_PHRASING['unitWords'])
NUMBER_WORDS = _words(_PHRASING['numberWords'])
CURRENCY_LEADS = _words(_PHRASING['currencyLeads'])
ADJECTIVES = _words(_PHRASING['adjectives'])
CONTRACTION_ENDS = ("n't", "n’t", "'m", "’m", "'re", "’re", "'ve", "’ve", "'ll", "’ll", "'d", "’d")
ADJECTIVE_SUFFIXES = ('ful', 'ous', 'ive', 'able', 'ible', 'less', 'est')


def _bare(text):
    return str(text).rstrip('"”’»)]')


def ends_sentence(word):
    return _bare(word['word']).endswith(tuple(SENTENCE_END_MARKS))


def _is_number(text, normalized):
    return any(c.isdigit() for c in str(text)) or normalized in NUMBER_WORDS


def _capitalized(text):
    first = str(text).lstrip('"“‘\'(')[:1]
    return first.isascii() and first.isupper()


def gap_glue(words, index, ai_plan=None):
    """How strongly the gap after words[index] holds a phrase together.

    Positive: splitting here cuts a unit of meaning. Negative: a new phrase
    starts here. The strongest reason to keep words together counts once;
    reasons to break add up.
    """
    left, right = words[index], words[index + 1]
    raw_left, raw_right = left['word'], right['word']
    lower_left = _bare(raw_left).casefold()
    lt, rt = token(raw_left), token(raw_right)
    left_punctuated = lower_left.endswith(PHRASE_END_MARKS) or ends_sentence(left)
    keep = [0.0]
    if not left_punctuated:
        if lt in BIND_RIGHT:
            keep.append(12)
        if lt in DETERMINERS and rt not in FUNCTION_WORDS:
            keep.append(10)
        if (lt, rt) in FIXED_PAIRS:
            keep.append(10)
        if lt in SOFT_CLAUSE_START:
            # A conjunction or relative word opens the next phrase, never ends one.
            keep.append(8)
        if rt in BIND_LEFT:
            keep.append(12)
        if lower_left.endswith(CONTRACTION_ENDS):
            keep.append(10)
        if rt in INDIC_VERB_TAILS:
            keep.append(11)
        if lt in INTENSIFIERS and rt not in FUNCTION_WORDS:
            keep.append(10)
        if (_is_number(raw_left, lt) and (rt in UNIT_WORDS or raw_right.startswith('%') or _is_number(raw_right, rt))) \
                or (lt in CURRENCY_LEADS or raw_left in CURRENCY_LEADS) and _is_number(raw_right, rt):
            keep.append(12)
        sentence_start = index == 0 or ends_sentence(words[index - 1])
        if (_capitalized(raw_left) and _capitalized(raw_right) and not sentence_start
                and lt not in FUNCTION_WORDS and rt not in FUNCTION_WORDS and rt != 'i'):
            keep.append(9)
        if lt and lt == rt:
            keep.append(8)
        if rt in VERB_PARTICLES and lt not in FUNCTION_WORDS:
            keep.append(7)
        if rt == 'to' and lt in INFINITIVE_HEADS:
            keep.append(7)
        if rt == 'of' and lt in OF_HEADS:
            keep.append(7)
        right_is_content = rt not in FUNCTION_WORDS and rt not in CLAUSE_START and rt not in SOFT_CLAUSE_START
        if right_is_content and (lt in ADJECTIVES or (lt.isascii() and len(lt) >= 5 and lt.endswith(ADJECTIVE_SUFFIXES))):
            keep.append(6)
        if lt in SUBJECT_PRONOUNS and rt not in CLAUSE_START and rt not in SOFT_CLAUSE_START:
            keep.append(6)
        if lt in PRONOUNS and rt in AUXILIARIES:
            keep.append(9)
    glue = max(keep)
    if left_punctuated:
        glue -= 7
    if rt in CLAUSE_START:
        glue -= 8
    elif rt in SOFT_CLAUSE_START and lt not in SOFT_CLAUSE_START:
        glue -= 5
    gap = right['start'] - left['end']
    glue -= min(8.0, max(0.0, gap - 0.08) * 18)
    if ai_plan:
        if index in ai_plan['breaks']:
            glue -= 7
        elif index in ai_plan['covered']:
            glue += 6
        # A solo beat needs room on both sides, even after a grammatical join
        # ("the result was / zero").
        if index + 1 in ai_plan['solo'] or index in ai_plan['solo']:
            glue -= 6
    return glue


def _pace_target(words, first):
    # Local pace sets the phrase size: slow speech gets punchy 1-2 word
    # captions, fast speech up to the five-word limit.
    window = words[first:first + 6]
    pace = len(window) / max(0.3, window[-1]['end'] - window[0]['start'])
    return 2 if pace < 2 else 3 if pace <= 4 else 4


def _segment_cost(words, first, last, span_start, span_end, ai_plan):
    count = last - first + 1
    chars = sum(len(w['word']) for w in words[first:last + 1]) + count - 1
    seconds = words[last]['end'] - words[first]['start']
    if count > 1 and (count > AUTO_MAX_WORDS or chars > AUTO_MAX_CHARS or seconds > AUTO_MAX_SECONDS):
        return math.inf
    target = _pace_target(words, first)
    # Short over long: one word under the pace target costs more than one over.
    cost = (target - count) * 2.5 if count < target else (count - target) * 2.0
    cost += max(0, chars - AUTO_TARGET_CHARS) * 0.4
    if count == 1:
        word = words[first]
        alone_before = first == span_start or word['start'] - words[first - 1]['end'] >= 0.3
        alone_after = last == span_end or words[last + 1]['start'] - word['end'] >= 0.3
        if ai_plan and first in ai_plan['solo']:
            # A punchline or reveal the AI reading says hits hardest alone.
            cost -= 6
        elif not (_bare(word['word']).endswith(('!', '?')) or (alone_before and alone_after)):
            # A lone word between other speech would flash on screen by itself.
            cost += 3
    # Under 0.35 s a caption flashes; the tiny-caption merge afterwards would
    # then have to build an over-long phrase.
    if seconds < 0.35 and not (first == span_start and last == span_end):
        cost += 8
    return cost


def _segment_span(words, span_start, span_end, ai_plan):
    glue = [gap_glue(words, index, ai_plan) for index in range(span_start, span_end)]
    size = span_end - span_start + 1
    best = [0.0] + [math.inf] * size
    choice = [0] * (size + 1)
    for end in range(1, size + 1):
        last = span_start + end - 1
        # Breaking after the last word of a span is free: the span ends there.
        break_cost = glue[end - 1] + BREAK_COST if end < size else 0.0
        for begin in range(max(0, end - AUTO_MAX_WORDS), end):
            segment = _segment_cost(words, span_start + begin, last, span_start, span_end, ai_plan)
            total = best[begin] + segment + break_cost
            # Strictly better only: on a tie the longer final phrase wins,
            # so the result is deterministic.
            if total < best[end]:
                best[end], choice[end] = total, begin
    cuts, end = [], size
    while end > 0:
        begin = choice[end]
        cuts.append((span_start + begin, span_start + end - 1))
        end = begin
    return cuts[::-1]


def segment_auto(words, ai_plan=None):
    """(first, last) word indexes of each Auto caption phrase."""
    phrases = []
    span_start = 0
    for index, word in enumerate(words):
        last_word = index + 1 >= len(words)
        if last_word or ends_sentence(word) or words[index + 1]['start'] - word['end'] >= AUTO_HARD_PAUSE_SECONDS:
            phrases.extend(_segment_span(words, span_start, index, ai_plan))
            span_start = index + 1
    return phrases
