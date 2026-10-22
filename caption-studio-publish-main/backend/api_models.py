"""Pydantic request models for the core API routes.

Callers use it as a module (`api_models.NAME`), so a test patches one
place and every caller sees it.
"""

import math
import re
from pydantic import BaseModel, Field, model_validator
from typing import Any, Dict, List, Optional


try:
    from . import settings
    from . import export_jobs
except ImportError:  # Direct execution from backend/ remains supported.
    import settings
    import export_jobs


class CaptionItem(BaseModel):
    model_config = {"populate_by_name": True}

    id: Any
    text: str = Field(max_length=2_000)
    start_time: float
    end_time: float
    animation: str = Field(default="none", max_length=50)
    animation_speed: float = Field(default=1, ge=0.1, le=4)
    # "word": this caption builds up word by word as spoken (DOM renderer).
    reveal_mode: str = Field(default="", max_length=20)
    is_text_element: bool = False
    custom_style: Optional[Dict[str, Any]] = Field(default=None, max_length=200)
    template_id: str = Field(default="", max_length=100)
    template_20_id: str = Field(default="", max_length=100)
    template_source: str = Field(default="", max_length=100)
    template_class: str = Field(default="", max_length=200)
    template_name: str = Field(default="", max_length=200)
    template_layout: str = Field(default="", max_length=100)
    template_effect: str = Field(default="", max_length=100)
    template_markup: str = Field(default="", max_length=100_000)
    applied_template_style: Optional[Dict[str, Any]] = Field(default=None, max_length=200)
    word_styles: Dict[str, Any] = Field(default_factory=dict, max_length=2_000)
    words: List[Any] = Field(default_factory=list, max_length=2_000)
    template_index: Optional[int] = Field(default=None, alias="__templateIndex")
    template_phase_index: Optional[int] = None
    imp_word_index: int = -1
    imp_word_indices: List[Any] = Field(default_factory=list, max_length=100)
    emphasis_color: str = Field(default="", max_length=50)
    emotional_mode: str = Field(default="", max_length=50)
    audio_emotion_metrics: Optional[Dict[str, Any]] = Field(default=None, max_length=100)
    # Legacy clients may still send preview measurements. They are accepted for
    # a rolling upgrade, then stripped before hashing, queueing, and rendering.
    preview_template_line_texts: List[str] = Field(default_factory=list, max_length=50)
    preview_template_font_px: float = Field(default=0, ge=0, le=1_000)
    preview_template_box_width_px: float = Field(default=0, ge=0, le=10_000)
    preview_template_box_height_px: float = Field(default=0, ge=0, le=10_000)

    @model_validator(mode="after")
    def validate_renderable_caption(self):
        if not self.text.strip():
            raise ValueError("Caption text must not be empty")
        if not math.isfinite(self.start_time) or not math.isfinite(self.end_time):
            raise ValueError("Caption timestamps must be finite")
        if self.start_time < 0:
            raise ValueError("Caption start_time must be non-negative")
        if self.end_time <= self.start_time:
            raise ValueError("Caption end_time must be greater than start_time")
        if self.template_markup and re.search(
            r"<(?:script|iframe|object|embed|img|svg|link|meta|base|form|input|button|video|audio|source)\b|"
            r"\bon[a-z0-9_-]+\s*=|\b(?:src|href|srcdoc)\s*=|(?:url\s*\(|@import)",
            self.template_markup,
            flags=re.IGNORECASE,
        ):
            raise ValueError("Template markup contains unsafe elements or attributes")
        return self


class ExportRequest(BaseModel):
    file_id: str = Field(min_length=36, max_length=36)
    captions: List[CaptionItem] = Field(min_length=1, max_length=1000)
    style: Dict[str, Any] = Field(default_factory=dict, max_length=250)
    # Backward-compatible input only. Browser-measured layout is intentionally
    # ignored; the worker derives layout from normalized editor state.
    word_layouts: Dict[str, Any] = Field(default_factory=dict, max_length=5_000)
    waveform_data: List[float] = Field(default_factory=list, max_length=50_000)
    duration: float = Field(default=0, ge=0, le=4 * 60 * 60)
    id_token: str = Field(default="", max_length=8_192)
    idempotency_key: str = Field(default="", max_length=200)
    quality: str = Field(default="1080p", pattern=r"^(4k|1080p|720p)$")
    fps: int = Field(default=30, ge=24, le=60)
    export_aspect_ratio: str = Field(default="", pattern=r"^(|9:16|1:1|16:9)$")
    org_id: str = Field(default="", max_length=128)

    def validated_style(self) -> Dict[str, Any]:
        """Return a copy of style with all numeric fields clamped to safe ranges."""
        s = export_jobs._strip_client_render_hints(self.style)
        _num_clamps = {
            'frame_x':                 (0,   100),
            'frame_y':                 (0,   100),
            'font_size':               (8,   200),
            'position_x':              (0,   100),
            'position_y':              (0,   100),
            'background_padding':      (0,   100),
            'background_h_multiplier': (0.5, 3.0),
            'shadow_blur':             (0,   50),
            'shadow_offset_x':         (-50, 50),
            'shadow_offset_y':         (-50, 50),
            'letter_spacing':          (-10, 20),
            'word_spacing':            (0,   20),
            'line_spacing':            (0.5, 4.0),
            'text_opacity':            (0,   1),
            'scale':                   (0.1, 5.0),
            'box_width':               (0,   2_000),
            'stroke_width':            (0,   20),
            'line_height':             (0.5, 4.0),
            'outline_width':           (0,   20),
        }
        for field, (lo, hi) in _num_clamps.items():
            if field in s:
                try:
                    s[field] = max(lo, min(hi, float(s[field])))
                except (TypeError, ValueError):
                    del s[field]
        if s.get('frame_fit') not in ('cover', 'contain', None):
            s.pop('frame_fit', None)
        if s.get('quality') not in ('4k', '1080p', '720p', None):
            s.pop('quality', None)
        if s.get('export_aspect_ratio') not in ('9:16', '1:1', '16:9', '', None):
            s.pop('export_aspect_ratio', None)
        return s


class BatchExportRequest(BaseModel):
    id_token: str = Field(default="", max_length=8_192)
    idempotency_key: str = Field(min_length=1, max_length=200)
    exports: List[ExportRequest] = Field(min_length=1, max_length=10)


class CreateOrderRequest(BaseModel):
    require_test_mode: bool = False
    plan_id: str = Field(min_length=1, max_length=50)
    id_token: str = Field(min_length=1, max_length=8_192)
    currency: str = Field(default="INR", pattern=r"^(?i:INR|USD)$")
    idempotency_key: str = Field(default="", max_length=200)
    org_id: str = Field(default="", max_length=128)


class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str = Field(min_length=1, max_length=100)
    razorpay_payment_id: str = Field(min_length=1, max_length=100)
    razorpay_signature: str = Field(min_length=1, max_length=256)
    id_token: str = Field(min_length=1, max_length=8_192)
    plan_id: str = Field(default="", max_length=50)
    idempotency_key: str = Field(default="", max_length=200)
    org_id: str = Field(default="", max_length=128)


class ReconcilePaymentsRequest(BaseModel):
    id_token: str = Field(default="", max_length=8_192)
    lookback_hours: int = Field(default=settings.PAYMENT_RECONCILE_LOOKBACK_HOURS, ge=1, le=24 * 90)
    limit: int = Field(default=settings.PAYMENT_RECONCILE_BATCH_SIZE, ge=1, le=1_000)


class AdminRecoveryRequest(BaseModel):
    id_token: str = Field(default="", max_length=8_192)
    limit: int = Field(default=50, ge=1, le=1_000)


class AdminAlertTestRequest(BaseModel):
    id_token: str = Field(default="", max_length=8_192)


class ServiceControlsRequest(BaseModel):
    """Partial update: omitted switches keep their current value."""
    id_token: str = Field(default="", max_length=8_192)
    maintenance_mode: Optional[bool] = None
    pause_signups: Optional[bool] = None
    pause_payments: Optional[bool] = None
    pause_uploads: Optional[bool] = None
    pause_transcription: Optional[bool] = None
    pause_exports: Optional[bool] = None
    max_upload_duration_seconds: Optional[int] = Field(default=None, ge=15, le=settings.GLOBAL_MAX_UPLOAD_DURATION_SECONDS)
    notice: Optional[str] = Field(default=None, max_length=settings.SERVICE_CONTROL_NOTICE_MAX)


class TenantBackfillRequest(BaseModel):
    id_token: str = Field(default="", max_length=8_192)
    limit: int = Field(default=500, ge=1, le=500)
    cursor: str = Field(default="", max_length=1_500)


class SupportRequest(BaseModel):
    account_email: str = Field(min_length=3, max_length=320)
    issue_type: str = Field(min_length=2, max_length=80)
    job_id: str = Field(default="", max_length=128)
    payment_id: str = Field(default="", max_length=128)
    browser_device: str = Field(min_length=2, max_length=300)
    media_details: str = Field(default="", max_length=500)
    description: str = Field(min_length=10, max_length=5_000)


class ProcessRequest(BaseModel):
    file_id: str = Field(min_length=36, max_length=36)
    language: str = Field(default="English", max_length=50)
    min_words: int = Field(default=0, ge=0, le=20)
    max_words: int = Field(default=0, ge=0, le=20)
    id_token: str = Field(default="", max_length=8_192)
    # A stable key lets a browser safely retry after it loses the response while
    # the transcription is still running.  It is intentionally optional for
    # backwards-compatible API clients.
    idempotency_key: str = Field(default="", max_length=200)
    org_id: str = Field(default="", max_length=128)

    @model_validator(mode="after")
    def validate_word_range(self):
        if self.min_words > 0 and self.max_words > 0 and self.min_words > self.max_words:
            raise ValueError("min_words must be less than or equal to max_words")
        return self


class MediaUrlRequest(BaseModel):
    file_id: str = Field(min_length=36, max_length=36)
    id_token: str = Field(default="", max_length=8_192)
    org_id: str = Field(default="", max_length=128)


class TranslateRequest(BaseModel):
    captions: List[Dict[str, Any]] = Field(min_length=1, max_length=1000)
    target_language: str = Field(min_length=2, max_length=50)
    id_token: str = Field(default="", max_length=8_192)
    org_id: str = Field(default="", max_length=128)
