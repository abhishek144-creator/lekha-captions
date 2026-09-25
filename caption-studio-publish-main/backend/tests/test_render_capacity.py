from backend.render_capacity import estimate_render_capacity


def test_short_720p_export_uses_fast_queue():
    capacity = estimate_render_capacity({"quality": "720p", "fps": 30, "captions": []}, 10)
    assert capacity["render_class"] == "fast"
    assert capacity["render_work_units"] == 1


def test_template_4k_export_uses_heavy_queue():
    capacity = estimate_render_capacity({
        "quality": "4k",
        "fps": 60,
        "style": {"template_id": "sidebar-template"},
        "captions": [],
    }, 60)
    assert capacity["render_class"] == "heavy"
    assert capacity["render_work_units"] == 48
