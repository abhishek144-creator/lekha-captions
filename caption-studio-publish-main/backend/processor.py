# subprocess, shutil and requests are patched through this module by tests.
import os
import asyncio
import subprocess
import tempfile
import requests
import json
import shutil
from openai import OpenAI
from sarvamai import SarvamAI
try:
    from .media_commands import run_media_command
    from .provider_health import transcription_provider_health
except ImportError:
    from media_commands import run_media_command
    from provider_health import transcription_provider_health
try:
    from .processor_fonts import FontAssetsMixin
    from .processor_media import MediaProbeMixin
    from .processor_captions import CaptionTextMixin
    from .processor_ass import AssSubtitleMixin
    from .processor_templates import TemplateOverlayMixin
    from .processor_encoding import _disable_nvenc, _video_encoder_args
    from .processor_fonts import GOOGLE_FONTS_MAP, INDIC_FONTS, SCRIPT_FONTS_MAP, SCRIPT_RANGES, BOLD_VARIANTS  # noqa: F401 (compatibility re-export)
except ImportError:  # Direct execution from backend/ remains supported.
    from processor_fonts import FontAssetsMixin
    from processor_media import MediaProbeMixin
    from processor_captions import CaptionTextMixin
    from processor_ass import AssSubtitleMixin
    from processor_templates import TemplateOverlayMixin
    from processor_encoding import _disable_nvenc, _video_encoder_args
    from processor_fonts import GOOGLE_FONTS_MAP, INDIC_FONTS, SCRIPT_FONTS_MAP, SCRIPT_RANGES, BOLD_VARIANTS  # noqa: F401 (compatibility re-export)

TRANSCRIPTION_PROVIDER_TIMEOUT_SECONDS = max(
    15,
    min(int(os.environ.get("TRANSCRIPTION_PROVIDER_TIMEOUT_SECONDS", "180")), 600),
)
AUDIO_EXTRACTION_TIMEOUT_SECONDS = max(
    15,
    min(int(os.environ.get("AUDIO_EXTRACTION_TIMEOUT_SECONDS", "120")), 300),
)


def _extract_sarvam_words(response):
    """Normalize current and legacy Sarvam timestamp response shapes."""
    if response is None:
        return []

    if hasattr(response, "model_dump"):
        response_data = response.model_dump()
    elif hasattr(response, "dict"):
        response_data = response.dict()
    elif isinstance(response, dict):
        response_data = response
    else:
        response_data = {}

    timestamps = getattr(response, "timestamps", None) or response_data.get("timestamps")
    if hasattr(timestamps, "model_dump"):
        timestamps_data = timestamps.model_dump()
    elif hasattr(timestamps, "dict"):
        timestamps_data = timestamps.dict()
    elif isinstance(timestamps, dict):
        timestamps_data = timestamps
    else:
        timestamps_data = {}

    timestamp_words = list(
        getattr(timestamps, "words", None)
        or timestamps_data.get("words")
        or []
    )
    starts = list(
        getattr(timestamps, "start_time_seconds", None)
        or timestamps_data.get("start_time_seconds")
        or []
    )
    ends = list(
        getattr(timestamps, "end_time_seconds", None)
        or timestamps_data.get("end_time_seconds")
        or []
    )
    if timestamp_words and len(timestamp_words) == len(starts) == len(ends):
        return [
            {"word": str(word), "start": float(start), "end": float(end)}
            for word, start, end in zip(timestamp_words, starts, ends)
            if str(word).strip() and float(end) >= float(start)
        ]

    # Retain compatibility with older SDK payloads that exposed a word list.
    legacy_words = (
        list(getattr(response, "words", None) or [])
        or list(response_data.get("words") or [])
    )
    normalized = []
    for item in legacy_words:
        if isinstance(item, dict):
            word = item.get("word") or item.get("text") or ""
            start = item.get("start", item.get("start_time", 0))
            end = item.get("end", item.get("end_time", 0))
        else:
            word = getattr(item, "word", None) or getattr(item, "text", "")
            start = getattr(item, "start", None)
            if start is None:
                start = getattr(item, "start_time", 0)
            end = getattr(item, "end", None)
            if end is None:
                end = getattr(item, "end_time", 0)
        if str(word).strip() and float(end or 0) >= float(start or 0):
            normalized.append({
                "word": str(word),
                "start": float(start or 0),
                "end": float(end or 0),
            })
    return normalized


class VideoProcessor(FontAssetsMixin, MediaProbeMixin, CaptionTextMixin, AssSubtitleMixin, TemplateOverlayMixin):
    def __init__(self, fonts_dir):
        self.fonts_dir = os.path.abspath(fonts_dir)
        self.backend_dir = os.path.dirname(os.path.abspath(__file__))
        self.project_root = os.path.dirname(self.backend_dir)
        self.template_overlay_script = os.path.join(self.project_root, "scripts", "render_template_overlay.mjs")
        os.makedirs(self.fonts_dir, exist_ok=True)
        self._packaged_font_matches = {}
        self._variable_font_instances = {}
        self.client = None # Lazy init
        self._source_basic_template_ids = self._load_source_basic_template_ids()
        self._ensure_fallback_font()


    async def generate_captions_only(self, input_p, target_language="English", min_words=0, max_words=0):
        print(f"Processing: {input_p} -> Target: {target_language}, Words: {min_words}-{max_words}")
        try:
            # Try to initialize client if not ready
            if not self.client:
                try:
                    self.client = OpenAI(timeout=TRANSCRIPTION_PROVIDER_TIMEOUT_SECONDS, max_retries=0)
                except Exception as e:
                    print(f"[Warning] OpenAI Init Warning: {e}. Transcription requests will fail unless an explicit test mock is enabled.")
            
            # Clean up logic & variable initialization
            words = []
            api_error_msg = None
            detected_language = (target_language or "unknown").lower()
            language_confidence = 0.6
            audio_p = None
            transcription_source = ""

            try:
                with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as _tf:
                    audio_p = _tf.name
                run_media_command(["ffmpeg", "-y", "-i", input_p, "-vn", "-ar", "16000", "-ac", "1", audio_p],
                               check=True, capture_output=True, timeout=AUDIO_EXTRACTION_TIMEOUT_SECONDS)
            except Exception as ffmpeg_e:
                print(f"[Warning] FFmpeg audio extraction failed (might have no audio): {ffmpeg_e}")
                api_error_msg = f"Audio extraction failed: {ffmpeg_e}"

            sarvam_langs = {
                'hindi': 'hi-IN', 'bengali': 'bn-IN', 'kannada': 'kn-IN',
                'malayalam': 'ml-IN', 'marathi': 'mr-IN', 'odia': 'od-IN',
                'punjabi': 'pa-IN', 'tamil': 'ta-IN', 'telugu': 'te-IN',
                'gujarati': 'gu-IN', 'assamese': 'as-IN'
            }

            # Whisper ISO 639-1 language codes for non-Indian languages
            whisper_lang_codes = {
                'english': 'en', 'english_us': 'en', 'english_uk': 'en',
                'english_australia': 'en', 'english_new_zealand': 'en',
                'english_india': 'en',
                'arabic': 'ar', 'bulgarian': 'bg', 'burmese': 'my',
                'catalan': 'ca', 'chinese_simplified': 'zh',
                'chinese_traditional': 'zh', 'chinese_cantonese': 'zh',
                'czech': 'cs', 'danish': 'da', 'danish_denmark': 'da',
                'dutch': 'nl', 'dutch_belgium': 'nl', 'dzongkha': 'dz',
                'estonian': 'et', 'finnish': 'fi', 'french': 'fr',
                'french_canada': 'fr', 'german': 'de',
                'german_switzerland': 'de', 'greek': 'el',
                'hebrew': 'he', 'hungarian': 'hu',
                'indonesian': 'id', 'italian': 'it',
                'japanese': 'ja', 'korean': 'ko',
                'korean_south_korea': 'ko', 'latvian': 'lv',
                'lithuanian': 'lt', 'malay': 'ms',
                'mandarin': 'zh', 'norwegian': 'no',
                'persian': 'fa', 'polish': 'pl',
                'portuguese': 'pt', 'romanian': 'ro',
                'russian': 'ru', 'spanish': 'es',
                'swahili': 'sw', 'swedish': 'sv',
                'thai': 'th', 'tibetan': 'bo',
                'turkish': 'tr', 'ukrainian': 'uk',
                'vietnamese': 'vi',
                # --- Africa ---
                'yoruba': 'yo', 'hausa': 'ha', 'igbo': 'ig',
                'amharic': 'am', 'afrikaans': 'af', 'zulu': 'zu',
                'xhosa': 'xh', 'tigrinya': 'ti', 'somali': 'so',
                'kinyarwanda': 'rw', 'shona': 'sn',
                # --- Southeast Asia ---
                'tagalog': 'tl', 'javanese': 'jw', 'cebuano': 'ceb',
                'khmer': 'km', 'lao': 'lo', 'sundanese': 'su',
                # --- Central Asia & Caucasus ---
                'uzbek': 'uz', 'kazakh': 'kk', 'azerbaijani': 'az',
                'georgian': 'ka', 'armenian': 'hy', 'mongolian': 'mn',
                'kyrgyz': 'ky', 'tajik': 'tg',
                # --- Middle East ---
                'kurdish': 'ku', 'pashto': 'ps',
                # --- Europe Regional ---
                'serbian': 'sr', 'croatian': 'hr', 'bosnian': 'bs',
                'slovak': 'sk', 'slovenian': 'sl', 'albanian': 'sq',
                'macedonian': 'mk', 'belarusian': 'be', 'welsh': 'cy',
                'irish': 'ga', 'basque': 'eu', 'galician': 'gl',
                'maltese': 'mt', 'icelandic': 'is',
            }

            is_indian_lang = target_language.lower() in sarvam_langs
            sarvam_api_key = os.environ.get("SARVAM_API_KEY")
            active_provider = ""

            try:
                if api_error_msg is not None:
                    raise Exception(api_error_msg)
                if is_indian_lang and sarvam_api_key:
                    active_provider = "sarvam"
                    if not transcription_provider_health.allow_request("sarvam"):
                        raise RuntimeError("Sarvam circuit is open")
                    # Assuming 'file_name' and 'logger' are available or can be mocked for this context
                    # For this specific change, we'll just add the print statements.
                    # If `logger` or `file_name` are not defined, this will cause an error.
                    # As per instructions, only add the print statement.
                    print("-" * 50)
                    print(f"[Transcribe] Using Sarvam API (saaras:v3) for {target_language} speech...")
                    print("-" * 50)
                    sarvam_client = SarvamAI(
                        api_subscription_key=sarvam_api_key,
                        timeout=TRANSCRIPTION_PROVIDER_TIMEOUT_SECONDS,
                    )
                    lang_code = sarvam_langs[target_language.lower()]
                    
                    with open(audio_p, "rb") as f:
                        response = sarvam_client.speech_to_text.transcribe(
                            file=f,
                            model="saaras:v3",
                            mode="transcribe",
                            language_code=lang_code,
                            request_options={"max_retries": 0, "additional_body_parameters": {"with_timestamps": True}}
                        )
                    print(f"Sarvam API Transcription Success. Output type: {type(response)}")
                    
                    try:
                        words = _extract_sarvam_words(response)
                        print(f"[Sarvam] Parsed {len(words)} words from response")
                        if words:
                            transcription_provider_health.record_success("sarvam")
                            detected_language = target_language.lower()
                            language_confidence = 0.85
                            transcription_source = "sarvam"
                        else:
                            transcription_provider_health.record_failure("sarvam")
                            api_error_msg = "Sarvam returned no timestamped words"
                    except Exception as parse_e:
                        print(f"Failed to parse Sarvam response: {parse_e}")
                        transcription_provider_health.record_failure("sarvam")
                        words = []
                        api_error_msg = "Sarvam response could not be parsed"
                else:
                    active_provider = "openai"
                    if not transcription_provider_health.allow_request("openai"):
                        raise RuntimeError("OpenAI circuit is open")
                    if not self.client:
                        raise Exception("No OpenAI Client")
                    whisper_lang = whisper_lang_codes.get(target_language.lower())
                    whisper_kwargs = {
                        "model": "whisper-1",
                        "response_format": "verbose_json",
                        "timestamp_granularities": ["word"],
                    }
                    if whisper_lang:
                        whisper_kwargs["language"] = whisper_lang
                    with open(audio_p, "rb") as f:
                        transcript = self.client.audio.transcriptions.create(
                            file=f,
                            timeout=TRANSCRIPTION_PROVIDER_TIMEOUT_SECONDS,
                            **whisper_kwargs
                        )
                        detected_language = (getattr(transcript, "language", "") or detected_language).lower()
                        language_confidence = 0.92 if not whisper_lang else 0.75
                        raw_words = getattr(transcript, 'words', []) or []
                        # Normalize: handle both attribute-style objects and dicts
                        for w in raw_words:
                            if isinstance(w, dict):
                                words.append({
                                    "word": w.get('word', ''),
                                    "start": float(w.get('start') or 0),
                                    "end": float(w.get('end') or 0),
                                })
                            else:
                                words.append({
                                    "word": getattr(w, 'word', ''),
                                    "start": float(getattr(w, 'start', 0) or 0),
                                    "end": float(getattr(w, 'end', 0) or 0),
                                })
                    if words:
                        transcription_provider_health.record_success("openai")
                        transcription_source = "whisper"
                    else:
                        transcription_provider_health.record_failure("openai")
                        api_error_msg = "OpenAI returned no timestamped words"
            except Exception as api_error:
                api_error_msg = str(api_error)
                if active_provider:
                    transcription_provider_health.record_failure(active_provider)
                print(f"[Warning] Transcription provider error: {api_error}")

            failover_enabled = os.environ.get("TRANSCRIPTION_PROVIDER_FAILOVER", "1").strip().lower() in {
                "1", "true", "yes", "on"
            }
            sarvam_failed = bool(is_indian_lang and sarvam_api_key and api_error_msg)
            audio_ready = bool(audio_p and os.path.exists(audio_p) and os.path.getsize(audio_p) > 0)
            openai_available = transcription_provider_health.allow_request("openai")
            if not words and self.client and audio_ready and openai_available and (api_error_msg is None or (sarvam_failed and failover_enabled)):
                try:
                    if sarvam_failed:
                        print("[Transcribe] Sarvam failed; using configured OpenAI failover.")
                    with open(audio_p, "rb") as f:
                        transcript = self.client.audio.transcriptions.create(
                            model="whisper-1",
                            file=f,
                            response_format="verbose_json",
                            timestamp_granularities=["word"],
                            timeout=TRANSCRIPTION_PROVIDER_TIMEOUT_SECONDS,
                        )
                    detected_language = (getattr(transcript, "language", "") or detected_language).lower()
                    language_confidence = max(language_confidence, 0.55)
                    for w in (getattr(transcript, "words", []) or []):
                        if isinstance(w, dict):
                            words.append({
                                "word": w.get('word', ''),
                                "start": float(w.get('start') or 0),
                                "end": float(w.get('end') or 0),
                            })
                        else:
                            words.append({
                                "word": getattr(w, 'word', ''),
                                "start": float(getattr(w, 'start', 0) or 0),
                                "end": float(getattr(w, 'end', 0) or 0),
                            })
                    if words:
                        transcription_provider_health.record_success("openai")
                        api_error_msg = None
                        transcription_source = "whisper_failover" if sarvam_failed else "whisper"
                    else:
                        transcription_provider_health.record_failure("openai")
                        api_error_msg = "OpenAI returned no timestamped words"
                except Exception as fallback_error:
                    transcription_provider_health.record_failure("openai")
                    api_error_msg = str(fallback_error)

            # Clean up temp file (file is now closed)
            try:
                if audio_p and os.path.exists(audio_p):
                    os.remove(audio_p)
            except Exception:
                pass

            # Synthetic captions are useful for visual tests, but must never be
            # presented as real transcription unless the caller explicitly opts in.
            if api_error_msg is not None:
                mock_enabled = os.environ.get("ALLOW_MOCK_TRANSCRIPTION", "0").strip().lower() in {
                    "1", "true", "yes", "on"
                }
                if not mock_enabled:
                    return {
                        "success": False,
                        "error": "Transcription service failed. Please retry.",
                        "error_code": "TRANSCRIPTION_PROVIDER_FAILED",
                    }

                # Get video duration for full-video mock captions
                try:
                    dur_result = run_media_command(
                        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
                         "-of", "default=nw=1:nk=1", input_p],
                        capture_output=True, text=True
                    )
                    video_duration = float(dur_result.stdout.strip())
                except Exception:
                    video_duration = 16.8  # fallback

                # Generate phrase-sized mock data spanning the entire video.
                mock_sentences = [
                    ["This", "caption", "tests", "template", "motion."],
                    ["Preview", "timing", "must", "match", "export."],
                    ["Every", "card", "keeps", "its", "layout."],
                    ["Left", "templates", "apply", "without", "drifting."],
                    ["Main", "captions", "stay", "inside", "frame."],
                    ["Animated", "words", "enter", "with", "rhythm."],
                    ["Highlight", "colors", "remain", "perfectly", "aligned."],
                    ["Export", "renders", "the", "same", "result."],
                    ["Phrase", "groups", "feel", "easy", "reading."],
                    ["Timeline", "cards", "show", "clear", "sentences."],
                    ["Template", "spacing", "works", "with", "phrases."],
                    ["Browser", "preview", "matches", "caption", "layer."],
                    ["Each", "sentence", "uses", "enough", "words."],
                    ["No", "caption", "falls", "outside", "video."],
                    ["Motion", "effects", "restart", "on", "selection."],
                    ["Styled", "text", "keeps", "source", "classes."],
                    ["Phrase", "timing", "covers", "the", "clip."],
                    ["Export", "frames", "preserve", "template", "behavior."],
                    ["Caption", "cards", "now", "reach", "twenty."],
                    ["Final", "checks", "confirm", "matching", "templates."],
                ]

                all_words = []
                usable_duration = max(2.0, video_duration - 0.4)
                slot_duration = usable_duration / len(mock_sentences)
                for sentence_idx, sentence in enumerate(mock_sentences):
                    slot_start = 0.2 + sentence_idx * slot_duration
                    slot_end = min(video_duration - 0.05, slot_start + slot_duration * 0.9)
                    word_gap = min(0.04, slot_duration * 0.04)
                    word_dur = max(
                        0.045,
                        (slot_end - slot_start - (word_gap * (len(sentence) - 1))) / max(1, len(sentence))
                    )
                    cursor = slot_start
                    for word in sentence:
                        end = min(slot_end, cursor + word_dur)
                        all_words.append({"word": word, "start": round(cursor, 3), "end": round(end, 3)})
                        cursor = end + word_gap

                grouped = self._group_words_by_speech_pace(all_words, min_words=min_words, max_words=max_words)
                grouped = self._post_process_captions(grouped)
                return {
                    "success": True,
                    "captions": grouped,
                    "detected_language": detected_language,
                    "language_confidence": 0.35,
                    "transcription_source": "mock_fallback",
                }

            grouped_captions = self._group_words_by_speech_pace(words, min_words=min_words, max_words=max_words)
            grouped_captions = self._post_process_captions(grouped_captions)
            if not grouped_captions:
                return {
                    "success": False,
                    "error": "No speech with usable word timestamps was detected.",
                    "error_code": "NO_SPEECH_DETECTED",
                }
            return {
                "success": True,
                "captions": grouped_captions,
                "detected_language": detected_language,
                "language_confidence": round(max(0.0, min(1.0, language_confidence)), 2),
                "transcription_source": transcription_source or (
                    "sarvam" if is_indian_lang and sarvam_api_key else "whisper"
                ),
            }

        except Exception as e:
            import traceback
            traceback.print_exc()
            print(f"Error: {e}")
            return {"success": False, "error": "Caption generation failed"}

    async def burn_only(self, input_p, output_p, captions, style, word_layouts=None):
        # Customer style payloads can contain text; keep them out of logs.
        print(f"DEBUG: Found {len(captions)} captions, and {len(word_layouts) if word_layouts else 0} word layouts")
        try:
            font_key = style.get('font_family', 'Inter')
            font_info = self._ensure_font(font_key)

            video_w, video_h = self._get_video_dimensions(input_p)
            print(f"Original Video dimensions: {video_w}x{video_h}")
            
            export_aspect_ratio = self._get_export_aspect_ratio(style)
            crop_filter = ""
            if export_aspect_ratio:
                crop_filter, video_w, video_h = self._build_aspect_crop_filter(video_w, video_h, export_aspect_ratio, style)
                if crop_filter:
                    print(f"[Reframe] Export aspect {export_aspect_ratio}: {crop_filter} -> {video_w}x{video_h}")
            elif video_w > video_h:
                crop_filter, video_w, video_h = self._build_aspect_crop_filter(video_w, video_h, "9:16")
                if crop_filter:
                    crop_filter = f"{crop_filter},"
                    print(f"[Reframe] Auto-reframing horizontal video to vertical: {video_w}x{video_h}")

            # Templates are rendered with the same browser DOM/CSS pipeline as the app preview.
            if self._should_use_dom_template_renderer(style, captions):
                return self._render_dom_template_overlay(
                    input_p=input_p,
                    output_p=output_p,
                    captions=captions,
                    style=style,
                    video_w=video_w,
                    video_h=video_h,
                    crop_filter=crop_filter.rstrip(','),
                )

            ass_path = self._create_styled_ass(captions, style, font_info, video_w, video_h, word_layouts)

            # FFmpeg on Windows: 1) drive letters break filter parsing, 2) backslashes are escape chars
            # Solution: relative paths + forward slashes for everything
            try:
                ass_rel = os.path.relpath(ass_path).replace('\\', '/')
                fonts_rel = os.path.relpath(self.fonts_dir).replace('\\', '/')
            except ValueError:
                ass_rel = ass_path.replace('\\', '/')
                fonts_rel = self.fonts_dir.replace('\\', '/')

            # Forward slashes for input/output too
            input_fwd = input_p.replace('\\', '/')
            output_fwd = output_p.replace('\\', '/')

            # Quality settings — always scale by width (scale=W:-2 keeps aspect, ensures even height)
            # After the crop step, horizontal videos are already converted to vertical (9:16),
            # so scaling by width works uniformly for all orientations.
            quality = style.get('quality', '1080p')
            fps = self._get_export_fps(style)
            scale_filter, crf, audio_bitrate = self._get_quality_settings(quality, export_aspect_ratio)

            # Filter chain: crop → ass → scale
            # ass must come before scale so ASS PlayRes coords match the pre-scale frame dimensions.
            ass_filter = f"ass={ass_rel}:fontsdir={fonts_rel}"
            vf_parts = [p for p in [crop_filter.rstrip(','), ass_filter, scale_filter] if p]
            vf_filter = ",".join(vf_parts)
            print(f"[FFmpeg] Quality: {quality}, CRF: {crf}")
            print(f"[FFmpeg] -vf filter: {vf_filter}")
            print(f"[FFmpeg] Input: {input_fwd}")
            print(f"[FFmpeg] Output: {output_fwd}")

            def _build_burn_cmd(force_cpu=False):
                return [
                    "ffmpeg", "-y", "-i", input_fwd,
                    "-vf", vf_filter,
                    "-map", "0:v:0", "-map", "0:a?",
                    *_video_encoder_args(crf, force_cpu),
                    "-r", str(fps),
                    "-c:a", "aac", "-b:a", audio_bitrate,
                    "-shortest",
                    output_fwd
                ]

            cmd = _build_burn_cmd()

            runtime_env = (os.environ.get("APP_ENV") or os.environ.get("ENV") or "").lower()
            if runtime_env in {"development", "dev", "local"} and os.environ.get("DEBUG_EXPORT_ARTIFACTS", "0") == "1":
                debug_ass_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "last_export_debug.ass")
                try:
                    shutil.copy2(ass_path, debug_ass_path)
                    print(f"[Debug] ASS artifact saved to: {debug_ass_path}")
                except Exception as _de:
                    print(f"[Debug] Could not save debug ASS: {_de}")

            print(f"[FFmpeg] Running command: {' '.join(cmd)}")
            result = await asyncio.get_running_loop().run_in_executor(
                None, lambda: run_media_command(cmd, capture_output=True, text=True)
            )

            # Always log FFmpeg stderr (even on success — libass warnings appear here)
            if result.stderr:
                print(f"[FFmpeg] stderr (last 1000 chars): {result.stderr[-1000:]}")

            # A GPU encode can fail for reasons the probe cannot see (session
            # limits, driver resets). Never fail an export for that — retry once
            # on libx264 and stop using NVENC for the rest of this process.
            if result.returncode != 0 and "h264_nvenc" in cmd:
                _disable_nvenc("encode failed at runtime")
                cpu_cmd = _build_burn_cmd(force_cpu=True)
                print("[FFmpeg] NVENC encode failed — retrying on CPU (libx264).")
                result = await asyncio.get_running_loop().run_in_executor(
                    None, lambda: run_media_command(cpu_cmd, capture_output=True, text=True)
                )
                if result.stderr:
                    print(f"[FFmpeg] CPU retry stderr (last 1000 chars): {result.stderr[-1000:]}")

            local_output = output_fwd.replace('/', os.sep)
            if result.returncode != 0:
                if os.path.exists(local_output):
                    os.remove(local_output)
                return {"success": False, "error": "Video render failed"}

            if not os.path.isfile(local_output) or os.path.getsize(local_output) <= 0:
                print(f"[FFmpeg] Output file is missing or empty at {output_fwd}")
                if os.path.exists(local_output):
                    os.remove(local_output)
                return {"success": False, "error": "Video render produced no output"}

            probe = await asyncio.get_running_loop().run_in_executor(
                None,
                lambda: run_media_command(
                    [
                        "ffprobe", "-v", "error", "-select_streams", "v:0",
                        "-show_entries", "stream=codec_type:format=duration",
                        "-of", "json", local_output,
                    ],
                    capture_output=True,
                    text=True,
                    timeout=20,
                ),
            )
            try:
                probe_data = json.loads(probe.stdout or "{}") if probe.returncode == 0 else {}
                duration = float((probe_data.get("format") or {}).get("duration") or 0)
                has_video = any(
                    stream.get("codec_type") == "video"
                    for stream in (probe_data.get("streams") or [])
                )
            except (TypeError, ValueError, json.JSONDecodeError):
                duration = 0
                has_video = False
            if probe.returncode != 0 or not has_video or duration <= 0:
                print(f"[FFmpeg] Output validation failed: {probe.stderr[-500:] if probe.stderr else 'invalid media'}")
                os.remove(local_output)
                return {"success": False, "error": "Rendered video failed validation"}

            out_size = os.path.getsize(local_output)
            print(f"[FFmpeg] Validated output file size: {out_size} bytes")
            return {"success": True}

        except Exception as e:
            import traceback
            traceback.print_exc()
            print(f"Video render failed: {e}")
            return {"success": False, "error": "Video render failed"}
        finally:
            if 'ass_path' in locals() and os.path.exists(ass_path):
                try:
                    os.remove(ass_path)
                except OSError:
                    pass


