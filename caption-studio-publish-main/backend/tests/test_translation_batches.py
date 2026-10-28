import os
import sys
import unittest
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import main  # noqa: F401  (loads settings the same way the app does)
import language_api


class TranslationBatchTests(unittest.TestCase):
    def test_long_transcripts_are_translated_in_order_across_batches(self):
        calls = []

        def fake(client, texts, target, model, strict=False):
            calls.append((len(texts), strict))
            return [f"T:{t}" for t in texts]

        texts = [f"line {i}" for i in range(320)]
        with patch.object(language_api, "_translate_lines", side_effect=fake):
            out = language_api._translate_in_batches(None, texts, "Hindi", "m", batch_size=150)
        self.assertEqual(out, [f"T:{t}" for t in texts])
        self.assertEqual(calls, [(150, False), (150, False), (20, False)])

    def test_a_miscounted_batch_gets_one_strict_retry(self):
        replies = iter([None, ["a", "b"], ["c"]])
        with patch.object(language_api, "_translate_lines", side_effect=lambda *a, **k: next(replies)):
            out = language_api._translate_in_batches(None, ["1", "2", "3"], "Hindi", "m", batch_size=2)
        self.assertEqual(out, ["a", "b", "c"])

    def test_gives_up_when_the_retry_also_fails(self):
        with patch.object(language_api, "_translate_lines", return_value=None):
            self.assertIsNone(language_api._translate_in_batches(None, ["1"], "Hindi", "m"))

    def test_mixed_language_targets_ask_for_native_script_with_english_words(self):
        seen = []

        class Completions:
            def create(self, **kwargs):
                seen.append(kwargs["messages"][0]["content"])
                return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content='{"lines": ["x"]}'))])

        client = SimpleNamespace(chat=SimpleNamespace(completions=Completions()))
        for target, base in (("tanglish", "Tamil"), ("Hinglish", "Hindi"), ("manglish", "Malayalam")):
            self.assertEqual(language_api._translate_lines(client, ["hi"], target, "m"), ["x"])
            self.assertIn(f"{base} words in {base} script", seen[-1])
            self.assertIn("English (Latin) letters", seen[-1])
        language_api._translate_lines(client, ["hi"], "tamil", "m")
        self.assertIn("to tamil.", seen[-1])

    def test_requests_up_to_the_export_caption_limit_are_accepted(self):
        from api_models import TranslateRequest
        captions = [{"id": str(i), "text": "x"} for i in range(1000)]
        self.assertEqual(len(TranslateRequest(captions=captions, target_language="Hindi").captions), 1000)


if __name__ == "__main__":
    unittest.main()
