import pytest

from backend.rendering.renderer_benchmark import (
    build_caption_fixture,
    build_renderer_style,
    compare_summaries,
    percentile,
    summarize_runs,
)


def test_fixture_is_shared_and_covers_requested_duration():
    captions = build_caption_fixture(6)

    assert captions[0]["start_time"] == 0
    assert captions[-1]["end_time"] == 6
    assert all(caption["words"] for caption in captions)


def test_styles_select_only_the_requested_renderer_feature():
    ass = build_renderer_style("ass", "720p", 30)
    dom = build_renderer_style("dom", "720p", 30)

    assert "box_width" not in ass
    assert dom["box_width"] == 515
    assert ass["quality"] == dom["quality"] == "720p"
    assert ass["fps"] == dom["fps"] == 30
    with pytest.raises(ValueError):
        build_renderer_style("unknown", "720p", 30)


def test_percentile_and_summary_include_failures_without_skewing_latency():
    assert percentile([1, 2, 3], 50) == 2
    summary = summarize_runs([
        {"success": True, "elapsed_seconds": 2, "output_bytes": 100},
        {"success": True, "elapsed_seconds": 4, "output_bytes": 300},
        {"success": False, "elapsed_seconds": 99, "output_bytes": 0},
    ], 2)

    assert summary["attempts"] == 3
    assert summary["successful"] == 2
    assert summary["success_rate"] == pytest.approx(2 / 3, rel=1e-3)
    assert summary["median_seconds"] == 3
    assert summary["median_realtime_factor"] == 1.5
    assert summary["median_output_bytes"] == 200


def test_comparison_reports_dom_to_ass_ratio():
    comparison = compare_summaries({
        "ass": {"median_seconds": 2},
        "dom": {"median_seconds": 5},
    })

    assert comparison["dom_to_ass_median_ratio"] == 2.5
    assert compare_summaries({})["dom_to_ass_median_ratio"] is None
