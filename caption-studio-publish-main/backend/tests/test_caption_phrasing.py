import json
import random
import unittest
from types import SimpleNamespace

from backend.caption_phrase_ai import read_phrase_plan
from backend.processor_captions import CaptionTextMixin


def timed(text, step=0.32, start=0):
    return [dict(word=w, start=round(start+i*step, 3), end=round(start+(i+1)*step-0.02, 3))
            for i, w in enumerate(text.split())]


def boundaries(captions):
    """Word pairs that a caption break separates."""
    return {(a['words'][-1]['word'], b['words'][0]['word']) for a, b in zip(captions, captions[1:])}


class FakeChat:
    def __init__(self, replies):
        self.replies = list(replies)
        self.calls = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        reply = self.replies.pop(0)
        if isinstance(reply, Exception):
            raise reply
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps(reply)))])


def fake_client(*replies):
    chat = FakeChat(replies)
    client = SimpleNamespace(chat=SimpleNamespace(completions=chat))
    client.with_options = lambda **_: client
    return client, chat


class PhraseUnitTests(unittest.TestCase):
    def setUp(self):
        self.processor = CaptionTextMixin()

    def group(self, words, plan=None):
        return self.processor._post_process_captions(self.processor._group_words_by_speech_pace(words, phrase_plan=plan))

    def test_units_of_meaning_are_never_split(self):
        # The owner's report (2026-10-28): words spoken together were broken
        # apart. Each pair must share a caption at slow, normal and fast pace.
        cases = {
            'I spent 10 lakh rupees on my first startup and lost everything in six months.':
                [('10', 'lakh'), ('lakh', 'rupees'), ('first', 'startup')],
            'Yesterday Elon Musk said something crazy about the future of social media.':
                [('Elon', 'Musk'), ('social', 'media.')],
            "Don't give up on your dreams because the hardest part is getting started.":
                [("Don't", 'give'), ('give', 'up'), ('hardest', 'part')],
            'He said if things are not failing you are not innovating enough.':
                [('you', 'are'), ('not', 'failing'), ('He', 'said')],
            'मैंने अपनी पहली कंपनी में दस लाख रुपये लगा दिए और सब कुछ खो दिया।':
                [('दस', 'लाख'), ('लाख', 'रुपये'), ('लगा', 'दिए'), ('सब', 'कुछ'), ('खो', 'दिया।')],
            'आप ये गलती कभी मत करना क्योंकि इससे आपका पूरा बिज़नेस बर्बाद हो सकता है।':
                [('मत', 'करना'), ('पूरा', 'बिज़नेस'), ('हो', 'सकता')],
        }
        for text, pairs in cases.items():
            for step in (0.18, 0.32, 0.55):
                with self.subTest(text=text, step=step):
                    captions = self.group(timed(text, step=step))
                    self.assertEqual(' '.join(c['text'] for c in captions), text)
                    split = boundaries(captions) & set(pairs)
                    self.assertFalse(split, [c['text'] for c in captions])

    def test_a_micro_pause_inside_a_unit_does_not_split_it(self):
        # A 0.3 s breath before the noun of "the hardest part".
        words = timed('because the hardest', step=0.3) + timed('part is getting started.', start=1.2)
        self.assertNotIn(('hardest', 'part'), boundaries(self.group(words)))

    def test_phrases_never_end_on_a_conjunction_or_relative_word(self):
        captions = self.group(timed('and it is something that we do every day here and we love it.', step=0.25))
        for caption in captions[:-1]:
            self.assertNotIn(caption['text'].split()[-1], {'and', 'that', 'the', 'because'}, [c['text'] for c in captions])

    def test_random_timings_keep_every_word_within_limits(self):
        text = ('So today I want to talk about how we work and it is something that we do every day here. '
                'मेरे पीछे जो आप शिप देख रहे हो वो शिप नहीं है बल्कि एक क्लब हाउस है।')
        for seed in range(25):
            rnd = random.Random(seed)
            words, cursor = [], 0.0
            for word in text.split():
                length = rnd.uniform(0.08, 0.6)
                words.append(dict(word=word, start=round(cursor, 3), end=round(cursor + length, 3)))
                cursor += length + rnd.choice([0.01, 0.05, 0.2, 0.35, 0.7])
            with self.subTest(seed=seed):
                captions = self.group(words)
                self.assertEqual([w for c in captions for w in c['words']], words)
                self.assertTrue(all(len(c['words']) <= 5 for c in captions), [c['text'] for c in captions])
                self.assertTrue(all(c['end_time'] <= n['start_time'] for c, n in zip(captions, captions[1:])))


class PhrasePlanTests(unittest.TestCase):
    def setUp(self):
        self.processor = CaptionTextMixin()

    def group(self, words, plan=None):
        return [c['text'] for c in self.processor._post_process_captions(
            self.processor._group_words_by_speech_pace(words, phrase_plan=plan))]

    def test_ai_reading_moves_breaks_where_the_rules_are_neutral(self):
        words = timed('my morning routine changed my whole life completely', step=0.3)
        client, chat = fake_client({'ends': [2, 6, 7], 'solo': []})
        plan = read_phrase_plan(client, words, 'en')
        self.assertEqual(plan['breaks'], {2, 6})
        self.assertEqual(self.group(words, plan)[0], 'my morning routine')
        self.assertIn('0:my 1:morning', chat.calls[0]['messages'][1]['content'])

    def test_solo_word_lands_alone_and_limits_still_hold(self):
        words = timed('and then the result was zero', step=0.3)
        client, _ = fake_client({'ends': [4, 5], 'solo': [5]})
        captions = self.group(words, read_phrase_plan(client, words, 'en'))
        self.assertEqual(captions[-1], 'zero')
        long_words = timed('one two three four five six seven eight nine', step=0.2)
        client, _ = fake_client({'ends': [8], 'solo': []})
        captions = self.group(long_words, read_phrase_plan(client, long_words, 'en'))
        self.assertTrue(all(len(c.split()) <= 5 for c in captions), captions)

    def test_unusable_readings_fall_back_to_rules(self):
        words = timed('This works. It really works. We tested it. Then we shipped it.', step=0.3)
        rules = self.group(words)
        drifted = {'ends': [2, 5, 8, 12], 'solo': []}  # every index one word late
        for reply in ({'ends': 'all'}, {'ends': [1.5]}, {}, drifted, RuntimeError('timeout')):
            with self.subTest(reply=reply):
                client, _ = fake_client(reply)
                plan = read_phrase_plan(client, words, 'en')
                self.assertIsNone(plan)
                self.assertEqual(self.group(words, plan), rules)

    def test_a_reading_of_other_words_is_ignored(self):
        words = timed('we ship today and celebrate', step=0.3)
        client, _ = fake_client({'ends': [0, 4], 'solo': [0]})
        plan = read_phrase_plan(client, words, 'en')
        self.assertEqual(self.group(words[:4], plan), self.group(words[:4]))

    def test_long_transcripts_are_read_in_batches(self):
        words = timed(' '.join(['word'] * 450), step=0.2)
        client, chat = fake_client({'ends': list(range(3, 400, 4)), 'solo': []},
                                   {'ends': list(range(403, 450, 4)) + [449], 'solo': []})
        plan = read_phrase_plan(client, words, 'en')
        self.assertEqual(len(chat.calls), 2)
        self.assertIn(399, plan['breaks'] | {399})
        self.assertNotIn(399, plan['covered'])

    def test_disabled_or_missing_client_makes_no_call(self):
        from backend import settings
        words = timed('we ship today', step=0.3)
        self.assertIsNone(self.processor._read_phrase_plan(words, 'en'))
        client, chat = fake_client({'ends': [2], 'solo': []})
        self.processor.client = client
        original = settings.CAPTION_PHRASE_AI_ENABLED
        try:
            settings.CAPTION_PHRASE_AI_ENABLED = False
            self.assertIsNone(self.processor._read_phrase_plan(words, 'en'))
            self.assertEqual(chat.calls, [])
            settings.CAPTION_PHRASE_AI_ENABLED = True
            self.assertIsNotNone(self.processor._read_phrase_plan(words, 'en'))
        finally:
            settings.CAPTION_PHRASE_AI_ENABLED = original


if __name__ == '__main__':
    unittest.main()
