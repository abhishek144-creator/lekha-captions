"""AI language routes: caption translation, spoken-language detection and
caption emotion analysis (for the smart layout director).

Callers use it as a module (`language_api.NAME`), so a test patches one
place and every caller sees it.
"""

import hashlib
import os
from collections import OrderedDict
from pydantic import BaseModel, Field

import json

from fastapi import APIRouter, HTTPException, Request, Response

try:
    from . import settings
    from . import app_state
    from . import firebase_admin_setup
    from . import observability
    from . import request_security
    from . import entitlements
    from . import operator_controls
    from . import media_commands
    from . import media_records
    from . import api_models
    from . import request_guards
except ImportError:  # Direct execution from backend/ remains supported.
    import settings
    import app_state
    import firebase_admin_setup
    import observability
    import request_security
    import entitlements
    import operator_controls
    import media_commands
    import media_records
    import api_models
    import request_guards


router = APIRouter()

@router.post("/api/translate")
def translate_captions(req: api_models.TranslateRequest, request: Request, response: Response):
    decoded_token = firebase_admin_setup.verify_token(req.id_token)
    if not decoded_token:
        raise HTTPException(status_code=401, detail="Authentication required")
    uid = (decoded_token.get("uid") or "").strip() or "unknown-user"
    request_security._assert_tenant_access(uid, decoded_token, req.org_id)
    client_ip = request_guards._client_rate_key(request)
    allowed, retry_after, remaining = request_guards._check_rate(
        app_state._translate_rate, f"network:{client_ip}", settings.TRANSLATE_SHARED_NETWORK_RATE_LIMIT
    )
    request_guards._apply_rate_headers(response, settings.TRANSLATE_SHARED_NETWORK_RATE_LIMIT, remaining, retry_after)
    if not allowed:
        raise HTTPException(status_code=429, detail="Too many translation requests. Please wait before trying again.")
    user_allowed, user_retry_after, user_remaining = request_guards._check_rate(
        app_state._translate_rate, f"user:{uid}", settings.TRANSLATE_USER_RATE_LIMIT
    )
    request_guards._apply_rate_headers(response, settings.TRANSLATE_USER_RATE_LIMIT, user_remaining, user_retry_after)
    if not user_allowed:
        raise HTTPException(status_code=429, detail="Too many translation requests. Please wait before trying again.")
    for caption in req.captions:
        if len(caption) > 100:
            raise HTTPException(status_code=400, detail="Caption object is too complex")
        text_value = caption.get("text", "")
        if not isinstance(text_value, str) or len(text_value) > 2_000:
            raise HTTPException(status_code=400, detail="Caption text is invalid")
    if operator_controls._is_content_safety_blocked(req.target_language, " ".join((c.get("text") or "") for c in req.captions[:30])):
        observability._track_event("translate_rejected_content_safety")
        raise HTTPException(status_code=422, detail="Request blocked by content safety policy.")
    breaker = app_state._provider_breakers["openai_translate"]
    if not breaker.allow():
        observability._track_event("translate_circuit_open")
        raise HTTPException(status_code=503, detail="Translation service is temporarily unavailable. Please retry shortly.")

    entitlements._reserve_ai_quota(decoded_token.get("uid", ""), "translate")

    try:
        from openai import OpenAI
        client = OpenAI(
            api_key=os.environ.get("OPENAI_API_KEY"),
        )

        texts = [cap.get("text", "") for cap in req.captions]
        translated_lines = _translate_in_batches(client, texts, req.target_language, settings.TRANSLATION_MODEL)

        if translated_lines is None:
            raise RuntimeError("Translation provider returned an incomplete caption set")

        result_captions = []
        for i, cap in enumerate(req.captions):
            new_cap = dict(cap)
            if i < len(translated_lines):
                new_cap["text"] = translated_lines[i]
            result_captions.append(new_cap)
        breaker.on_success()
        observability._track_event("translate_success", {"target_language": req.target_language, "count": len(req.captions)})
        return {"success": True, "captions": result_captions}
    except Exception as e:
        breaker.on_failure()
        observability._track_event("translate_failed", {"target_language": req.target_language, "error": str(e)})
        observability._json_log("error", "translation_provider_failed", uid=decoded_token.get("uid", ""), error=str(e))
        entitlements._release_ai_quota(decoded_token.get("uid", ""), "translate")
        raise HTTPException(status_code=502, detail="Translation service failed. Please retry.") from e


class DetectLanguageRequest(BaseModel):
    file_id: str = Field(min_length=36, max_length=36)
    id_token: str = Field(default="", max_length=8_192)
    org_id: str = Field(default="", max_length=128)


@router.post("/api/detect-language")
def detect_language(req: DetectLanguageRequest, request: Request, response: Response):
    # Auth — same dev-mode bypass as /api/export
    decoded_token = request_security._authenticate_media_request(req.id_token, req.org_id)
    uid = (decoded_token.get("uid") or "").strip() or "unknown-user"
    client_ip = request_guards._client_rate_key(request)
    allowed, retry_after, remaining = request_guards._check_rate(
        app_state._detect_language_rate,
        f"network:{client_ip}",
        settings.DETECT_LANGUAGE_SHARED_NETWORK_RATE_LIMIT,
    )
    request_guards._apply_rate_headers(response, settings.DETECT_LANGUAGE_SHARED_NETWORK_RATE_LIMIT, remaining, retry_after)
    if not allowed:
        raise HTTPException(status_code=429, detail="Too many language detection requests. Please wait before trying again.")
    user_allowed, user_retry_after, user_remaining = request_guards._check_rate(
        app_state._detect_language_rate, f"user:{uid}", settings.DETECT_LANGUAGE_USER_RATE_LIMIT
    )
    request_guards._apply_rate_headers(response, settings.DETECT_LANGUAGE_USER_RATE_LIMIT, user_remaining, user_retry_after)
    if not user_allowed:
        raise HTTPException(status_code=429, detail="Too many language detection requests. Please wait before trying again.")
    if not media_records._validate_file_id(req.file_id):
        raise HTTPException(status_code=400, detail="Invalid file_id")
    media_records._assert_upload_owner(req.file_id, uid)
    input_path = media_records._safe_find_upload(req.file_id)
    if not input_path:
        observability._track_event("detect_language_failed_not_found")
        raise HTTPException(status_code=404, detail="File not found")
    media_records._ensure_upload_clean(req.file_id, uid, input_path)
    breaker = app_state._provider_breakers["openai_detect_language"]
    if not breaker.allow():
        observability._track_event("detect_language_circuit_open")
        raise HTTPException(status_code=503, detail="Language detection is temporarily unavailable. Please retry shortly.")
    entitlements._reserve_ai_quota(uid, "detect_language")
    temp_path = ""
    try:
        import tempfile
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as _tf:
            temp_path = _tf.name
        extract_result = media_commands.run_media_command([
            "ffmpeg", "-i", input_path, "-t", "30",
            "-vn", "-acodec", "mp3", "-y", temp_path
        ], capture_output=True)
        if extract_result.returncode != 0 or not os.path.isfile(temp_path) or os.path.getsize(temp_path) <= 0:
            raise RuntimeError("Audio extraction failed")
        from openai import OpenAI
        client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
        with open(temp_path, "rb") as af:
            result = client.audio.transcriptions.create(
                model="whisper-1", file=af, response_format="verbose_json"
            )
        detected = getattr(result, 'language', 'english')
        if os.path.exists(temp_path):
            os.remove(temp_path)
        breaker.on_success()
        observability._track_event("detect_language_success", {"language": detected})
        return {"success": True, "language": detected}
    except Exception as e:
        breaker.on_failure()
        observability._track_event("detect_language_failed", {"error": str(e)})
        observability._json_log("error", "language_detection_provider_failed", uid=uid, error=str(e))
        entitlements._release_ai_quota(uid, "detect_language")
        raise HTTPException(status_code=502, detail="Language detection failed. Please retry.") from e
    finally:
        try:
            if temp_path and os.path.exists(temp_path):
                os.remove(temp_path)
        except Exception:
            pass


# Captions per translation request. Long arrays are where the model most often
# returns the wrong line count; batches keep each request short and a retry
# cheap. The total text sent (and so the cost) is the same.
TRANSLATION_BATCH_SIZE = 150


def _translate_in_batches(client, texts, target_language, model, batch_size=TRANSLATION_BATCH_SIZE):
    """Translate all lines in order, one strict retry per batch; None on failure."""
    translated = []
    for start in range(0, len(texts), batch_size):
        batch = texts[start:start + batch_size]
        lines = _translate_lines(client, batch, target_language, model)
        if lines is None:
            observability._json_log("warning", "translation_line_count_mismatch", expected=len(batch), batch_start=start)
            lines = _translate_lines(client, batch, target_language, model, strict=True)
        if lines is None:
            return None
        translated.extend(lines)
    return translated


def _translate_lines(client, texts, target_language, model, strict=False):
    """Translate caption lines as a JSON array, one output per input.

    JSON keeps multi-line and empty captions intact; the old numbered-text
    format split them apart, miscounted, and paid for a retry. Returns None
    when the model does not return exactly one string per input line.
    """
    instruction = (
        f"Translate each caption in the JSON array \"lines\" to {target_language}. "
        'Reply with JSON {"lines": [...]} containing exactly one translated string per input, '
        "in the same order. Keep empty strings empty and keep line breaks inside a caption."
    )
    if strict:
        instruction += f" The array must have exactly {len(texts)} items."
    completion = client.chat.completions.create(
        model=model,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": instruction},
            {"role": "user", "content": json.dumps({"lines": texts}, ensure_ascii=False)},
        ],
        temperature=0.1 if strict else 0.3,
    )
    try:
        lines = json.loads(completion.choices[0].message.content or "{}").get("lines")
    except (ValueError, AttributeError):
        return None
    if not isinstance(lines, list) or len(lines) != len(texts) or not all(isinstance(line, str) for line in lines):
        return None
    return [line.strip() for line in lines]


# ---------------------------------------------------------------------------
# Caption emotion analysis for the smart layout director
# (src/components/dashboard/captionLayoutDirector.js). One short call per
# video; the editor falls back to its rules when this is unavailable.
# ---------------------------------------------------------------------------

CAPTION_LINE_TYPES = (
    "hook", "punchline", "emotional_peak", "statistic", "question", "call_to_action", "narration",
)
CAPTION_EMOTIONS = (
    "joy", "excitement", "surprise", "anger", "fear", "sadness", "calm", "tender", "serious", "neutral",
)
# Lines per provider call; a 3-minute video is normally a single call.
CAPTION_EMOTION_BATCH_SIZE = 120
CAPTION_EMOTION_CACHE_LIMIT = 500
# Identical transcripts are answered without a provider call (per process).
_caption_emotion_cache: "OrderedDict[str, list]" = OrderedDict()


@router.post("/api/caption-emotions")
def caption_emotions(req: api_models.CaptionEmotionRequest, request: Request, response: Response):
    decoded_token = request_security._authenticate_media_request(req.id_token, req.org_id)
    uid = (decoded_token.get("uid") or "").strip() or "unknown-user"
    client_ip = request_guards._client_rate_key(request)
    allowed, retry_after, remaining = request_guards._check_rate(
        app_state._caption_emotion_rate, f"network:{client_ip}", settings.CAPTION_EMOTION_SHARED_NETWORK_RATE_LIMIT
    )
    request_guards._apply_rate_headers(response, settings.CAPTION_EMOTION_SHARED_NETWORK_RATE_LIMIT, remaining, retry_after)
    if not allowed:
        raise HTTPException(status_code=429, detail="Too many layout requests. Please wait before trying again.")
    user_allowed, user_retry_after, user_remaining = request_guards._check_rate(
        app_state._caption_emotion_rate, f"user:{uid}", settings.CAPTION_EMOTION_USER_RATE_LIMIT
    )
    request_guards._apply_rate_headers(response, settings.CAPTION_EMOTION_USER_RATE_LIMIT, user_remaining, user_retry_after)
    if not user_allowed:
        raise HTTPException(status_code=429, detail="Too many layout requests. Please wait before trying again.")

    texts = [line.text.strip() for line in req.lines]
    ids = [line.id for line in req.lines]
    model = settings.CAPTION_EMOTION_MODEL
    cache_key = hashlib.sha256(json.dumps(["semantic-v2", model, texts], ensure_ascii=False).encode("utf-8")).hexdigest()
    cached = _caption_emotion_cache.get(cache_key)
    if cached is not None:
        _caption_emotion_cache.move_to_end(cache_key)
        observability._track_event("caption_emotion_cache_hit", {"count": len(texts)})
        return {"success": True, "cached": True, "lines": _with_ids(ids, cached)}

    if operator_controls._is_content_safety_blocked("", " ".join(texts[:30])):
        observability._track_event("caption_emotion_rejected_content_safety")
        raise HTTPException(status_code=422, detail="Request blocked by content safety policy.")
    breaker = app_state._provider_breakers["openai_caption_emotion"]
    if not breaker.allow():
        observability._track_event("caption_emotion_circuit_open")
        raise HTTPException(status_code=503, detail="Smart layout is temporarily unavailable. Please retry shortly.")

    entitlements._reserve_ai_quota(uid, "caption_emotion")
    try:
        from openai import OpenAI
        client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
        results = []
        for start in range(0, len(texts), CAPTION_EMOTION_BATCH_SIZE):
            batch = texts[start:start + CAPTION_EMOTION_BATCH_SIZE]
            lines = _classify_caption_lines(client, batch, model)
            if lines is None:
                observability._json_log("warning", "caption_emotion_line_count_mismatch", expected=len(batch), batch_start=start)
                lines = _classify_caption_lines(client, batch, model, strict=True)
            if lines is None:
                raise RuntimeError("Caption emotion provider returned an incomplete line set")
            results.extend(lines)
        breaker.on_success()
        _caption_emotion_cache[cache_key] = results
        while len(_caption_emotion_cache) > CAPTION_EMOTION_CACHE_LIMIT:
            _caption_emotion_cache.popitem(last=False)
        observability._track_event("caption_emotion_success", {"count": len(texts)})
        return {"success": True, "cached": False, "lines": _with_ids(ids, results)}
    except Exception as e:
        breaker.on_failure()
        observability._track_event("caption_emotion_failed", {"error": str(e)})
        observability._json_log("error", "caption_emotion_provider_failed", uid=uid, error=str(e))
        entitlements._release_ai_quota(uid, "caption_emotion")
        raise HTTPException(status_code=502, detail="Smart layout analysis failed. Please retry.") from e


def _with_ids(ids, results):
    return [{"id": line_id, **result} for line_id, result in zip(ids, results)]


def _clean_caption_emotion(raw, text):
    """Keep only known labels and valid word indexes; never trust provider shape."""
    raw = raw if isinstance(raw, dict) else {}
    word_count = len(text.split())
    line_type = raw.get("type") if raw.get("type") in CAPTION_LINE_TYPES else "narration"
    emotion = raw.get("emotion") if raw.get("emotion") in CAPTION_EMOTIONS else "neutral"
    try:
        intensity = float(raw.get("intensity"))
    except (TypeError, ValueError):
        intensity = 0.5
    intensity = min(1.0, max(0.0, intensity)) if intensity == intensity else 0.5
    keywords = []
    raw_keywords = raw.get("keywords")
    for value in raw_keywords if isinstance(raw_keywords, list) else []:
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not 0 <= value < word_count or int(value) != value:
            continue
        index = int(value)
        if 0 <= index < word_count and index not in keywords:
            keywords.append(index)
        if len(keywords) == 2:
            break
    return {"type": line_type, "emotion": emotion, "intensity": round(intensity, 3), "keywords": keywords}


def _classify_caption_lines(client, texts, model, strict=False):
    """Classify caption lines as JSON, one object per input; None on a miscount."""
    instruction = (
        "You help a caption editor decide how to style each line of a short video's transcript "
        "(any language, often Hindi or English). For every string in the JSON array \"lines\" return an object: "
        f"\"type\" (one of {', '.join(CAPTION_LINE_TYPES)}), "
        f"\"emotion\" (one of {', '.join(CAPTION_EMOTIONS)}), "
        "\"intensity\" (0 to 1: how strongly this line should stand out visually; most narration is below 0.4, "
        "the opening hook and the punchline are usually the strongest), and "
        "\"keywords\" (0-based indexes, counting words split on spaces, of at most 2 words in that line that carry "
        "its meaning or emotion; choose key nouns, entities, main actions, numbers or significant facts. Use an empty list when no word earns emphasis. Never choose by position or length. Avoid articles, auxiliaries, conjunctions and grammatical particles in the actual language). Judge each line in the context of the whole script. "
        'Reply with JSON {"lines": [...]} with exactly one object per input line, in the same order.'
    )
    if strict:
        instruction += f" The array must have exactly {len(texts)} items."
    completion = client.chat.completions.create(
        model=model,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": instruction},
            {"role": "user", "content": json.dumps({"lines": texts}, ensure_ascii=False)},
        ],
        temperature=0,
        max_tokens=min(8_000, 80 + 45 * len(texts)),
    )
    try:
        lines = json.loads(completion.choices[0].message.content or "{}").get("lines")
    except (ValueError, AttributeError):
        return None
    if not isinstance(lines, list) or len(lines) != len(texts):
        return None
    return [_clean_caption_emotion(raw, text) for raw, text in zip(lines, texts)]
