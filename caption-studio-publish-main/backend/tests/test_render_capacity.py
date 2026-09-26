from backend.rendering.capacity import (
    FAST_EXPORT_QUEUE_NAME,
    HEAVY_EXPORT_QUEUE_NAME,
    NORMAL_EXPORT_QUEUE_NAME,
    estimate_render_capacity,
    estimate_render_work_seconds,
    render_class,
)


def test_render_class_distinguishes_template_work():
    assert render_class({"style": {}, "captions": []}) == "ass"
    assert render_class({"style": {"template_id": "t01"}}) == "dom"
    assert render_class({"captions": [{"applied_template_style": {"id": "t01"}}]}) == "dom"


def test_estimate_is_bounded_and_scales_with_render_shape(monkeypatch):
    monkeypatch.delenv("EXPORT_ASS_WORK_RATIO", raising=False)
    monkeypatch.delenv("EXPORT_DOM_WORK_RATIO", raising=False)
    plain = estimate_render_work_seconds(60, {"quality": "720p", "fps": 30})
    rich = estimate_render_work_seconds(60, {
        "quality": "1080p", "fps": 60, "style": {"template_id": "t01"},
    })
    assert plain == 70
    assert rich > plain
    assert estimate_render_work_seconds(float("nan"), {}) >= 15
    assert estimate_render_work_seconds(99999, {"style": {"template_id": "t01"}}) == 3600


def test_capacity_routes_fast_normal_and_heavy_work(monkeypatch):
    monkeypatch.delenv("GPU_RENDER_ENABLED", raising=False)
    assert estimate_render_capacity(30, {"quality": "720p", "fps": 30})["queue_name"] == FAST_EXPORT_QUEUE_NAME
    assert estimate_render_capacity(180, {"quality": "720p", "fps": 30})["queue_name"] == NORMAL_EXPORT_QUEUE_NAME
    heavy = estimate_render_capacity(180, {
        "quality": "1080p", "fps": 60, "style": {"template_id": "t01"},
    })
    assert heavy["render_class"] == "heavy"
    assert heavy["queue_name"] == HEAVY_EXPORT_QUEUE_NAME
    assert heavy["render_work_units"] >= 7
