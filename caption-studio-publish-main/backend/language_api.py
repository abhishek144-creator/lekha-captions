"""AI language routes: caption translation and spoken-language detection.

Handlers resolve shared helpers through ``host`` (the main module) at call time,
so there is one copy of each helper and test patches on ``main`` keep applying.
"""

from types import ModuleType, SimpleNamespace

from fastapi import FastAPI, UploadFile, File, HTTPException, Response
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Request
from fastapi import APIRouter


def create_language_router(host: ModuleType) -> SimpleNamespace:
    router = APIRouter()

    @router.post("/api/translate")
    def translate_captions(req: host.TranslateRequest, request: Request, response: Response):
        decoded_token = host.verify_token(req.id_token)
        if not decoded_token:
            raise HTTPException(status_code=401, detail="Authentication required")
        uid = (decoded_token.get("uid") or "").strip() or "unknown-user"
        host._assert_tenant_access(uid, decoded_token, req.org_id)
        client_ip = host._client_rate_key(request)
        allowed, retry_after, remaining = host._check_rate(
            host._translate_rate, f"network:{client_ip}", host.TRANSLATE_SHARED_NETWORK_RATE_LIMIT
        )
        host._apply_rate_headers(response, host.TRANSLATE_SHARED_NETWORK_RATE_LIMIT, remaining, retry_after)
        if not allowed:
            raise HTTPException(status_code=429, detail="Too many translation requests. Please wait before trying again.")
        user_allowed, user_retry_after, user_remaining = host._check_rate(
            host._translate_rate, f"user:{uid}", host.TRANSLATE_USER_RATE_LIMIT
        )
        host._apply_rate_headers(response, host.TRANSLATE_USER_RATE_LIMIT, user_remaining, user_retry_after)
        if not user_allowed:
            raise HTTPException(status_code=429, detail="Too many translation requests. Please wait before trying again.")
        for caption in req.captions:
            if len(caption) > 100:
                raise HTTPException(status_code=400, detail="Caption object is too complex")
            text_value = caption.get("text", "")
            if not isinstance(text_value, str) or len(text_value) > 2_000:
                raise HTTPException(status_code=400, detail="Caption text is invalid")
        if host._is_content_safety_blocked(req.target_language, " ".join((c.get("text") or "") for c in req.captions[:30])):
            host._track_event("translate_rejected_content_safety")
            raise HTTPException(status_code=422, detail="Request blocked by content safety policy.")
        breaker = host._provider_breakers["openai_translate"]
        if not breaker.allow():
            host._track_event("translate_circuit_open")
            raise HTTPException(status_code=503, detail="Translation service is temporarily unavailable. Please retry shortly.")

        host._reserve_ai_quota(decoded_token.get("uid", ""), "translate")

        try:
            from openai import OpenAI
            client = OpenAI(
                api_key=host.os.environ.get("OPENAI_API_KEY"),
            )

            texts = [cap.get("text", "") for cap in req.captions]
            numbered_text = "\n".join(f"{i+1}. {t}" for i, t in enumerate(texts))

            # Note: use a distinct local name — `response` is the FastAPI Response
            # param (already used above for rate-limit headers); don't shadow it.
            completion = client.chat.completions.create(
                model=host.TRANSLATION_MODEL,
                messages=[
                    {"role": "system", "content": f"You are a professional translator. Translate the following numbered caption lines to {req.target_language}. Keep the numbering. Only return the translated lines, nothing else. Preserve the exact number of lines."},
                    {"role": "user", "content": numbered_text}
                ],
                temperature=0.3,
            )

            import re
            translated_text = completion.choices[0].message.content.strip()
            translated_lines = []
            for line in translated_text.split("\n"):
                line = line.strip()
                if not line:
                    continue
                cleaned = re.sub(r'^\d+[\.\)]\s*', '', line)
                translated_lines.append(cleaned)

            if len(translated_lines) != len(texts):
                print(f"Translation line count mismatch: expected {len(texts)}, got {len(translated_lines)}. Retrying...")
                retry_response = client.chat.completions.create(
                    model=host.TRANSLATION_MODEL,
                    messages=[
                        {"role": "system", "content": f"Translate exactly {len(texts)} numbered caption lines to {req.target_language}. Output exactly {len(texts)} numbered lines. No extra text."},
                        {"role": "user", "content": numbered_text}
                    ],
                    temperature=0.1,
                )
                retry_text = retry_response.choices[0].message.content.strip()
                translated_lines = []
                for line in retry_text.split("\n"):
                    line = line.strip()
                    if not line:
                        continue
                    cleaned = re.sub(r'^\d+[\.\)]\s*', '', line)
                    translated_lines.append(cleaned)

            if len(translated_lines) != len(texts):
                raise RuntimeError("Translation provider returned an incomplete caption set")

            result_captions = []
            for i, cap in enumerate(req.captions):
                new_cap = dict(cap)
                if i < len(translated_lines):
                    new_cap["text"] = translated_lines[i]
                result_captions.append(new_cap)
            breaker.on_success()
            host._track_event("translate_success", {"target_language": req.target_language, "count": len(req.captions)})
            return {"success": True, "captions": result_captions}
        except Exception as e:
            breaker.on_failure()
            host._track_event("translate_failed", {"target_language": req.target_language, "error": str(e)})
            host._json_log("error", "translation_provider_failed", uid=decoded_token.get("uid", ""), error=str(e))
            host._release_ai_quota(decoded_token.get("uid", ""), "translate")
            raise HTTPException(status_code=502, detail="Translation service failed. Please retry.") from e


    class DetectLanguageRequest(host.BaseModel):
        file_id: str = host.Field(min_length=36, max_length=36)
        id_token: str = host.Field(default="", max_length=8_192)
        org_id: str = host.Field(default="", max_length=128)


    @router.post("/api/detect-language")
    def detect_language(req: DetectLanguageRequest, request: Request, response: Response):
        # Auth — same dev-mode bypass as /api/export
        decoded_token = host._authenticate_media_request(req.id_token, req.org_id)
        uid = (decoded_token.get("uid") or "").strip() or "unknown-user"
        client_ip = host._client_rate_key(request)
        allowed, retry_after, remaining = host._check_rate(
            host._detect_language_rate,
            f"network:{client_ip}",
            host.DETECT_LANGUAGE_SHARED_NETWORK_RATE_LIMIT,
        )
        host._apply_rate_headers(response, host.DETECT_LANGUAGE_SHARED_NETWORK_RATE_LIMIT, remaining, retry_after)
        if not allowed:
            raise HTTPException(status_code=429, detail="Too many language detection requests. Please wait before trying again.")
        user_allowed, user_retry_after, user_remaining = host._check_rate(
            host._detect_language_rate, f"user:{uid}", host.DETECT_LANGUAGE_USER_RATE_LIMIT
        )
        host._apply_rate_headers(response, host.DETECT_LANGUAGE_USER_RATE_LIMIT, user_remaining, user_retry_after)
        if not user_allowed:
            raise HTTPException(status_code=429, detail="Too many language detection requests. Please wait before trying again.")
        if not host._validate_file_id(req.file_id):
            raise HTTPException(status_code=400, detail="Invalid file_id")
        host._assert_upload_owner(req.file_id, uid)
        input_path = host._safe_find_upload(req.file_id)
        if not input_path:
            host._track_event("detect_language_failed_not_found")
            raise HTTPException(status_code=404, detail="File not found")
        host._ensure_upload_clean(req.file_id, uid, input_path)
        breaker = host._provider_breakers["openai_detect_language"]
        if not breaker.allow():
            host._track_event("detect_language_circuit_open")
            raise HTTPException(status_code=503, detail="Language detection is temporarily unavailable. Please retry shortly.")
        host._reserve_ai_quota(uid, "detect_language")
        temp_path = ""
        try:
            import tempfile
            with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as _tf:
                temp_path = _tf.name
            extract_result = host.run_media_command([
                "ffmpeg", "-i", input_path, "-t", "30",
                "-vn", "-acodec", "mp3", "-y", temp_path
            ], capture_output=True)
            if extract_result.returncode != 0 or not host.os.path.isfile(temp_path) or host.os.path.getsize(temp_path) <= 0:
                raise RuntimeError("Audio extraction failed")
            from openai import OpenAI
            client = OpenAI(api_key=host.os.environ.get("OPENAI_API_KEY"))
            with open(temp_path, "rb") as af:
                result = client.audio.transcriptions.create(
                    model="whisper-1", file=af, response_format="verbose_json"
                )
            detected = getattr(result, 'language', 'english')
            if host.os.path.exists(temp_path):
                host.os.remove(temp_path)
            breaker.on_success()
            host._track_event("detect_language_success", {"language": detected})
            return {"success": True, "language": detected}
        except Exception as e:
            breaker.on_failure()
            host._track_event("detect_language_failed", {"error": str(e)})
            host._json_log("error", "language_detection_provider_failed", uid=uid, error=str(e))
            host._release_ai_quota(uid, "detect_language")
            raise HTTPException(status_code=502, detail="Language detection failed. Please retry.") from e
        finally:
            try:
                if temp_path and host.os.path.exists(temp_path):
                    host.os.remove(temp_path)
            except Exception:
                pass


    return SimpleNamespace(
        router=router,
        translate_captions=translate_captions,
        DetectLanguageRequest=DetectLanguageRequest,
        detect_language=detect_language,
    )
