# Caption phrasing and keyword units — 2026-10-28

The owner reported that words the speaker says together were split into separate captions. They asked for professional caption timing, with keywords highlighted when a template is applied and emotion taken into account. These changes are local on `claude/phrase-timing-20261028` and are not committed, pushed or deployed.

## Root cause
The Auto grouper (`processor_captions.py`, restored on 2026-10-27) built each caption greedily, one at a time:
- It cut at every 0.3 s pause unless the two words were on a short join list (articles, prepositions and Hindi postpositions).
- Everything else could be cut: names ("Elon / Musk"), amounts ("10 / लाख"), adjective + noun ("the hardest / part"), phrasal verbs ("give / up"), Hindi compound verbs ("लगा / दिए"), fixed expressions ("सब / कुछ") and pronoun + verb ("failing you / are").
- A greedy choice could also leave an awkward remainder for the next caption.

On a real cached Hindi transcript, the old grouper produced `शिप नहीं है क्लब / हाउस है …` and `आपको मिलेंगे सिर्फ 10 / लाख में फ्लैट`.

## What changed
- **`backend/caption_phrasing.py` (new)**:
  - Every gap between two words gets a glue score. Reasons to keep words together, strongest first: a word that binds to the next, a postposition or auxiliary, a Hindi compound-verb tail, a contraction, an intensifier, a number and its unit or currency, a capitalised name, a fixed expression, a phrasal-verb particle, an infinitive head (`want to`), an adjective before a noun, a pronoun before an auxiliary, a Hindi possessive or determiner. The strongest one counts.
  - Reasons to break add up: punctuation, a clause word, a coordinating word, the length of the pause, and the AI reading below.
  - A dynamic program picks the cheapest set of breaks for each sentence, using the same limits as before: at most 5 words, 32 characters and 3.2 s, with phrase size following speech pace. A 0.6 s silence or a sentence end always breaks. Every break costs a little, so a phrase splits only for a reason.
  - The word clock is never changed.
- **`backend/caption_phrase_ai.py` (new)**:
  - One `gpt-4o-mini` call per Auto transcription. It reads the indexed words and returns where each phrase ends, plus the rare "solo" words (punchline, reveal) that land hardest alone.
  - The result is only evidence for the grouper; limits and strong grammar still decide.
  - The answer is rejected when its indexes have drifted: it must hit at least 70% of sentence ends, no more than 15% of its breaks may follow a binding word, and at most 20% of phrases may be longer than 7 words.
  - The rules decide alone when the call fails, times out (20 s) or the answer is rejected.
  - Cost: about $0.001 for a 3-minute transcript. `CAPTION_PHRASE_AI_ENABLED=0` turns it off; `CAPTION_PHRASE_MODEL` sets the model.
- **`processor.py`**: the call is made only for Auto (word-count presets are unchanged). The result reports `phrasing_source` (`ai` or `rules`).
- **`media_records.py`**: process cache key `v7` → `v8`, so a new transcription uses the new phrasing.
- **`shared/captionLanguageRules.json`**: a new `phrasing` lexicon shared by the backend grouper and the editor.
- **`captionLayoutDirector.js`** (keyword highlight on templates):
  - A keyword grows to its whole unit, at most 3 words: `10 lakh rupees`, `दस लाख रुपये`, `Elon Musk`. This applies to AI keywords and to the rules' keywords.
  - A second keyword is added only while the total stays within 3 words.
  - Entrances for strong emotions: anger pops, fear fades, serious rises.

## Before / after (rules only)
| Speech | Before | After |
|---|---|---|
| Real Hindi cache | `मेरे पीछे / जो आप शिप / देख रहे हो वो / शिप नहीं है क्लब / हाउस है और यहां पे / आपको मिलेंगे सिर्फ 10 / लाख में फ्लैट / …` | `मेरे पीछे जो आप / शिप देख रहे हो / वो शिप नहीं है / क्लब हाउस है / और यहां पे / आपको मिलेंगे सिर्फ / 10 लाख में फ्लैट / और वो भी ऑल इंक्लूसिव।` |
| English | `I spent 10 / lakh rupees / on my first startup and / …` | `I spent 10 lakh rupees / on my first startup / and lost everything / in six months.` |
| English | `because the hardest / part is getting started.` | `because the hardest part / is getting started.` |
| English | `He said if things / are not failing you / are not innovating enough.` | `He said / if things are not failing / you are not innovating enough.` |
| Hindi | `मैंने अपनी पहली / कंपनी में दस लाख रुपये / …` | `मैंने अपनी पहली कंपनी में / दस लाख रुपये / लगा दिए / और सब कुछ खो दिया।` |

## Tests (actual results)
- Backend `pytest backend/tests`: 615 passed, 143 subtests.
- New file `test_caption_phrasing.py`:
  - Units are never split, at three paces, in English and Hindi.
  - A micro-pause inside a unit does not split it.
  - No phrase ends on a conjunction.
  - Under 25 random timings, every word is kept, phrases stay within limits and captions never overlap.
  - AI reading: breaks are applied, solo beats land alone, limits still hold, and unusable or drifted answers fall back to the rules.
  - A reading of other words is ignored, long transcripts are read in batches, and the switch turns the call off.
- Frontend `vitest run`: 293 passed. New: keyword units (amount, spoken amount, name, budget) and emotion entrances. One existing expectation changed on purpose: `we raised 10 lakh rupees` now highlights all three words.
- `npm run lint` and `npm run typecheck` are clean.

## Not verified / limits
- **AI reading not tested on the real model**: the local OpenAI key in `.env.local` is revoked (401). The fallback was exercised on that 401: captions came from the rules, with no error. The prompt's quality on real speech needs one check with the production key.
- **Existing projects**: they are not re-grouped. A new transcription (cache `v8`) gets the new phrasing.
- **Rule limits**:
  - Adjective + noun and compound nouns are recognised from a word list and suffixes, not real part-of-speech tagging; the AI reading covers what the list misses.
  - A verb such as "do" sits on the auxiliary list, so "that we / do every day here" can still happen at the 5-word limit.
- **No browser check**: the grouping runs at transcription time, and the preview cannot exercise it without a paid transcription.

## Verification update — 2026-10-29

- The production transcription service's configured OpenAI credential accepted two short synthetic English and Hindi phrase plans. Both kept the checked units together and preserved the original word timestamps. This is a small smoke test, not a broad quality evaluation.
- The full backend suite passed (615 tests and 143 subtests); the frontend unit suite passed (293 tests).
- Existing projects still need an explicit, non-destructive re-grouping feature. This release does not automatically rewrite edited projects.
- A real cached transcript was not sent for an AI test: automatic approval review rejected that external-data action. Real-provider quality on that recording remains unverified.
