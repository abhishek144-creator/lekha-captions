"""Caption text clean-up and word grouping after transcription.

Mixed into processor.VideoProcessor; methods use its instance state.
"""

import re

# Sentence-ending marks across the scripts we transcribe: Latin, Devanagari
# and other Indic danda, Arabic/Urdu, and CJK full-width forms.
SENTENCE_END_MARKS = ".!?।॥۔؟。！？"


class CaptionTextMixin:
    def _group_words_by_speech_pace(self, words, min_words=0, max_words=0):
        """
        Dynamic word-level grouping based on local speech rate.
        - Slow speech (WPS < 2): 1 word per caption (punchy)
        - Normal speech (WPS 2-4): 1-3 words per caption
        - Fast speech (WPS > 4): 3-5 words grouped as phrase
        Uses exact Whisper timestamps for millisecond accuracy.
        """
        if not words:
            return []

        # --- Step 1: Normalize word data ---
        parsed = []
        for w in words:
            text = (w.get('word', '') if isinstance(w, dict) else getattr(w, 'word', '')).strip()
            start = float(w.get('start', 0) if isinstance(w, dict) else getattr(w, 'start', 0))
            end = float(w.get('end', 0) if isinstance(w, dict) else getattr(w, 'end', 0))
            if text and end > start:
                parsed.append({"word": text, "start": start, "end": end})

        if not parsed:
            return []

        # --- Step 2: Calculate local speech rate for each word ---
        def _local_wps(idx, window=3):
            """Words-per-second in a local window around idx."""
            lo = max(0, idx - window)
            hi = min(len(parsed) - 1, idx + window)
            span = parsed[hi]['end'] - parsed[lo]['start']
            count = hi - lo + 1
            if span <= 0:
                return 3.0  # default normal
            return count / span

        # --- Step 3: Group words dynamically ---
        captions = []
        current_group = []
        caption_id = 0
        SILENCE_GAP = 0.3       # seconds of silence → force break
        PUNCTUATION = set(SENTENCE_END_MARKS)  # sentence-ending punctuation → force break

        for i, word in enumerate(parsed):
            current_group.append(word)
            word_count = len(current_group)

            # Determine if we should break after this word
            should_break = False

            # Rule 0: Last word → always break
            if i == len(parsed) - 1:
                should_break = True
            else:
                next_word = parsed[i + 1]
                gap = next_word['start'] - word['end']
                group_dur = word['end'] - current_group[0]['start']
                local_rate = _local_wps(i)

                # Rule 1: Silence gap → always break
                if gap >= SILENCE_GAP:
                    should_break = True

                # Rule 2: Punctuation at end of word → break
                elif word['word'][-1] in PUNCTUATION:
                    should_break = True

                # Rule 3: Hard cap at max_words (default 5)
                elif word_count >= (max_words if max_words > 0 else 5):
                    should_break = True

                # Rule 4: Speech-rate-based dynamic sizing
                elif local_rate < 2.0:
                    # SLOW speech - use min_words (punchy/dramatic)
                    lo = min_words if min_words > 0 else 1
                    if word_count >= lo:
                        should_break = True

                elif local_rate <= 4.0:
                    # NORMAL speech - use max_words as target
                    hi = max_words if max_words > 0 else 3
                    if word_count >= hi:
                        should_break = True
                    elif word_count >= (min_words if min_words > 0 else 2) and gap > 0.15:
                        should_break = True
                    elif word_count >= (min_words if min_words > 0 else 2) and group_dur > 0.8:
                        should_break = True

                else:
                    # FAST speech (> 4 WPS) - allow up to max_words as a phrase
                    hi = max_words if max_words > 0 else 5
                    lo = min_words if min_words > 0 else 3
                    if word_count >= hi and gap > 0.1:
                        should_break = True
                    elif word_count >= lo and gap > 0.2:
                        should_break = True

            # --- Emit caption group ---
            if should_break and current_group:
                text = " ".join(item['word'] for item in current_group)
                intentional_single_word = len(current_group) == 1 and _local_wps(i) < 2.0
                captions.append({
                    "id": caption_id,
                    "text": text,
                    "start_time": current_group[0]['start'],
                    "end_time": current_group[-1]['end'],
                    "intentional_single_word": intentional_single_word,
                    "words": [
                        {"word": item['word'], "start": item['start'], "end": item['end']}
                        for item in current_group
                    ]
                })
                caption_id += 1
                current_group = []

        # Close gaps: extend each caption's end_time to the next caption's start_time
        for i in range(len(captions) - 1):
            captions[i]['end_time'] = captions[i + 1]['start_time']

        print(f"[Captions] Generated {len(captions)} captions (min_words={min_words}, max_words={max_words})")
        return captions

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
            if tiny and i + 1 < len(normalized):
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

        # Reading speed guard: avoid extremely dense captions.
        for idx, cap in enumerate(merged):
            dur = max(0.2, cap["end_time"] - cap["start_time"])
            cps = len(cap.get("text", "")) / dur
            if cps > 24:
                cap["end_time"] = cap["start_time"] + (len(cap.get("text", "")) / 22.0)
            if idx < len(merged) - 1:
                next_start = merged[idx + 1]["start_time"]
                cap["end_time"] = min(cap["end_time"], next_start)
            cap["id"] = idx

        return merged
