import unittest

from backend.processor_captions import CaptionTextMixin


def timed(text, step=0.32, start=0):
    return [dict(word=w, start=start+i*step, end=start+(i+1)*step-0.02)
            for i, w in enumerate(text.split())]


class SpeechPipelineTests(unittest.TestCase):
    def setUp(self):
        self.processor = CaptionTextMixin()

    def group(self, words):
        return self.processor._post_process_captions(self.processor._group_words_by_speech_pace(words))

    def test_natural_clause_instead_of_fixed_word_cuts(self):
        words = timed('I want to go to the market because I need some fresh vegetables.')
        captions = self.group(words)
        self.assertEqual([c['text'] for c in captions],
                         ['I want to go to the market', 'because I need some fresh vegetables.'])
        self.assertEqual([w for c in captions for w in c['words']], words)

    def test_silence_is_not_filled_by_previous_caption(self):
        words = timed('Wait here.') + timed('Now continue.', start=5)
        captions = self.group(words)
        self.assertLessEqual(captions[0]['end_time'], words[1]['end'] + 0.12)
        self.assertEqual(captions[1]['start_time'], 5)

    def test_cleaning_preserves_retained_timestamps_and_meaning(self):
        words = timed('Um I do not like that very very much uh today.')
        cleaned = self.processor._clean_transcript_words(words, 'clean')
        self.assertEqual([w['word'] for w in cleaned], 'I do not like that very very much today.'.split())
        self.assertEqual(cleaned, [w for w in words if w['word'] not in {'Um', 'uh'}])
        self.assertEqual(self.processor._clean_transcript_words(words, 'verbatim'), words)

    def test_only_overlapping_recognizer_duplicates_are_removed(self):
        words = timed('yes yes')
        words.append(dict(words[-1]))
        self.assertEqual(self.processor._clean_transcript_words(words, 'clean'), words[:2])

    def test_language_specific_cleanup_preserves_real_words_and_source_punctuation(self):
        for text in ['Um Kulthum performed today.', 'My cat Um arrived.', 'The word "um" is a hesitation.']:
            words = timed(text)
            self.assertEqual(self.processor._clean_transcript_words(words, 'clean', 'english'), words)
        tamil = timed('அம் நான் இன்று வீட்டில் இல்லை ஆம்')
        self.assertEqual(self.processor._clean_transcript_words(tamil, 'clean', 'tamil'), tamil[1:])
        words = timed('er kommt um fünf Uhr')
        self.assertEqual(self.processor._clean_transcript_words(words, 'clean', 'german'), words)
        words = timed('um dia feliz')
        self.assertEqual(self.processor._clean_transcript_words(words, 'clean', 'portuguese'), words)
        hindi = timed('उम्म मैं नहीं जाऊंगा।')
        self.assertEqual(self.processor._clean_transcript_words(hindi, 'clean', 'hindi'), hindi[1:])
        words = timed('Wait here Now continue')
        restored = self.processor._restore_transcript_punctuation(words, 'Wait here. Now continue!')
        self.assertEqual([w['word'] for w in restored], ['Wait', 'here.', 'Now', 'continue!'])
        self.assertEqual([(w['start'], w['end']) for w in restored], [(w['start'], w['end']) for w in words])
        self.assertEqual(self.processor._restore_transcript_punctuation(words, 'I invented new text'), words)

    def test_indic_particles_negations_and_names_survive(self):
        for text in ['मैं बाज़ार में नहीं जाऊंगा।', 'நான் இன்று வீட்டில் இல்லை.',
                     'నేను ఈ రోజు ఇంట్లో లేను.', 'हाँ राम जी आए थे।']:
            with self.subTest(text=text):
                words = timed(text)
                self.assertEqual(self.processor._clean_transcript_words(words, 'clean'), words)
                captions = self.group(words)
                self.assertEqual(' '.join(c['text'] for c in captions), text)

    def test_fast_long_speech_preserves_every_word_without_overlaps(self):
        words = timed(' '.join(['We build useful tools because people need reliable captions.'] * 25), step=0.12)
        captions = self.group(words)
        self.assertEqual([w for c in captions for w in c['words']], words)
        self.assertTrue(all(c['end_time'] <= n['start_time'] for c, n in zip(captions, captions[1:])))
        self.assertTrue(all(c['end_time'] - c['start_time'] < 6.5 for c in captions))

    def test_invalid_numeric_timestamps_do_not_poison_the_timeline(self):
        words = timed('valid speech.') + [dict(word='bad', start=float('nan'), end=100)]
        self.assertEqual(' '.join(c['text'] for c in self.group(words)), 'valid speech.')
