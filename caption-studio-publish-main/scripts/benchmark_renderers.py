#!/usr/bin/env python3
"""Run a controlled, matched ASS-versus-DOM export benchmark.

This is intentionally an operator-run benchmark rather than a unit test. It
uses the production VideoProcessor paths, generates one deterministic source
clip, and writes a JSON artifact suitable for comparing releases or workers.
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os
import platform
import shutil
import subprocess
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.processor import VideoProcessor  # noqa: E402
from backend.rendering.renderer_benchmark import (  # noqa: E402
    RENDERERS,
    build_caption_fixture,
    build_renderer_style,
    compare_summaries,
    summarize_runs,
)


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Benchmark production ASS and DOM export paths with matched media.",
    )
    parser.add_argument("--duration", type=float, default=6.0, help="Source duration in seconds (default: 6).")
    parser.add_argument("--repeats", type=int, default=3, help="Measured runs per renderer (default: 3).")
    parser.add_argument("--warmups", type=int, default=1, help="Unmeasured warmups per renderer (default: 1).")
    parser.add_argument("--quality", choices=("720p", "1080p", "4k"), default="720p")
    parser.add_argument("--fps", type=int, choices=(24, 30, 60), default=30)
    parser.add_argument(
        "--max-dom-to-ass-ratio",
        type=float,
        default=None,
        help="Fail when the measured median DOM/ASS ratio exceeds this value.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=ROOT / "build" / "benchmarks" / "renderer-benchmark.json",
        help="JSON result path.",
    )
    parser.add_argument("--keep-outputs", action="store_true", help="Keep rendered MP4 files beside the JSON result.")
    return parser


def _validate_args(args: argparse.Namespace) -> None:
    if args.duration < 1.5 or args.duration > 120:
        raise ValueError("--duration must be between 1.5 and 120 seconds")
    if args.repeats < 1 or args.repeats > 20:
        raise ValueError("--repeats must be between 1 and 20")
    if args.warmups < 0 or args.warmups > 5:
        raise ValueError("--warmups must be between 0 and 5")
    if args.max_dom_to_ass_ratio is not None and args.max_dom_to_ass_ratio <= 0:
        raise ValueError("--max-dom-to-ass-ratio must be positive")


def _require_tools() -> None:
    missing = [tool for tool in ("ffmpeg", "ffprobe", "node") if not shutil.which(tool)]
    if missing:
        raise RuntimeError(f"missing required executable(s): {', '.join(missing)}")


def _run_checked(command: list[str]) -> subprocess.CompletedProcess:
    result = subprocess.run(command, capture_output=True, text=True, cwd=ROOT, timeout=180)
    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "command failed")[-1200:]
        raise RuntimeError(detail)
    return result


def _create_source(path: Path, duration: float, fps: int) -> None:
    _run_checked([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-f", "lavfi", "-i", f"testsrc2=size=720x1280:rate={fps}:duration={duration}",
        "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
        str(path),
    ])


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _git_revision() -> str:
    try:
        return subprocess.run(
            ["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True,
            text=True, timeout=10, check=True,
        ).stdout.strip()
    except (OSError, subprocess.SubprocessError):
        return "unknown"


async def _render_once(
    processor: VideoProcessor,
    source: Path,
    output: Path,
    captions: list[dict],
    style: dict,
    renderer: str,
    phase: str,
    iteration: int,
) -> dict:
    started = time.perf_counter()
    try:
        result = await processor.burn_only(
            str(source), str(output), captions, style, word_layouts=None,
        )
        elapsed = time.perf_counter() - started
        success = bool(result.get("success")) and output.is_file() and output.stat().st_size > 0
        return {
            "renderer": renderer,
            "phase": phase,
            "iteration": iteration,
            "success": success,
            "elapsed_seconds": round(elapsed, 4),
            "output_bytes": output.stat().st_size if output.is_file() else 0,
            "error": None if success else str(result.get("error") or "empty output"),
        }
    except Exception as exc:  # The JSON artifact must retain failed attempts.
        return {
            "renderer": renderer,
            "phase": phase,
            "iteration": iteration,
            "success": False,
            "elapsed_seconds": round(time.perf_counter() - started, 4),
            "output_bytes": output.stat().st_size if output.is_file() else 0,
            "error": f"{type(exc).__name__}: {exc}",
        }


async def _run_benchmark(args: argparse.Namespace, work_dir: Path) -> dict:
    source = work_dir / "matched-source.mp4"
    _create_source(source, args.duration, args.fps)
    captions = build_caption_fixture(args.duration)
    styles = {
        renderer: build_renderer_style(renderer, args.quality, args.fps)
        for renderer in RENDERERS
    }
    processor = VideoProcessor(str(ROOT / "backend" / "flat_fonts"))
    actual_routes = {
        renderer: "dom" if processor._should_use_dom_template_renderer(style, captions) else "ass"
        for renderer, style in styles.items()
    }
    if actual_routes != {"ass": "ass", "dom": "dom"}:
        raise RuntimeError(f"renderer fixture no longer selects the expected paths: {actual_routes}")

    all_runs: list[dict] = []
    for phase, count in (("warmup", args.warmups), ("measured", args.repeats)):
        for iteration in range(1, count + 1):
            # Reverse every second round to reduce order/thermal bias while
            # remaining deterministic and easy to reproduce.
            order = RENDERERS if iteration % 2 else tuple(reversed(RENDERERS))
            for renderer in order:
                output = work_dir / f"{phase}-{iteration}-{renderer}.mp4"
                print(f"[{phase}] {renderer} run {iteration}/{count}", flush=True)
                run = await _render_once(
                    processor, source, output, captions, styles[renderer],
                    renderer, phase, iteration,
                )
                all_runs.append(run)
                print(
                    f"  success={run['success']} elapsed={run['elapsed_seconds']:.4f}s "
                    f"bytes={run['output_bytes']}",
                    flush=True,
                )

    measured = [run for run in all_runs if run["phase"] == "measured"]
    summaries = {
        renderer: summarize_runs(
            [run for run in measured if run["renderer"] == renderer],
            args.duration,
        )
        for renderer in RENDERERS
    }
    return {
        "schema_version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "git_revision": _git_revision(),
        "environment": {
            "platform": platform.platform(),
            "python": platform.python_version(),
            "node": _run_checked(["node", "--version"]).stdout.strip(),
            "ffmpeg": _run_checked(["ffmpeg", "-version"]).stdout.splitlines()[0],
            "video_encoder": os.environ.get("EXPORT_VIDEO_ENCODER", "auto"),
            "cpu_preset": os.environ.get("EXPORT_CPU_PRESET", "veryfast"),
        },
        "fixture": {
            "source_sha256": _sha256(source),
            "duration_seconds": args.duration,
            "source_dimensions": "720x1280",
            "quality": args.quality,
            "fps": args.fps,
            "caption_count": len(captions),
            "captions": captions,
        },
        "configuration": {
            "warmups_per_renderer": args.warmups,
            "measured_runs_per_renderer": args.repeats,
            "renderer_routes": actual_routes,
            "max_dom_to_ass_ratio": args.max_dom_to_ass_ratio,
        },
        "runs": all_runs,
        "summaries": summaries,
        "comparison": compare_summaries(summaries),
    }


def main() -> int:
    args = _parser().parse_args()
    try:
        _validate_args(args)
        _require_tools()
        output = args.output.resolve()
        output.parent.mkdir(parents=True, exist_ok=True)
        scratch_root = ROOT / ".render_tmp"
        scratch_root.mkdir(parents=True, exist_ok=True)
        # tempfile.TemporaryDirectory applies a private ACL on Windows that can
        # prevent FFmpeg/Chromium child processes from entering the directory.
        # A normal inherited directory stays accessible to the complete render
        # toolchain and is still removed in the finally block.
        work_dir = scratch_root / f"renderer-benchmark-{uuid.uuid4().hex}"
        work_dir.mkdir()
        try:
            result = asyncio.run(_run_benchmark(args, work_dir))
            if args.keep_outputs:
                output_dir = output.parent / f"{output.stem}-outputs"
                output_dir.mkdir(parents=True, exist_ok=True)
                for rendered in work_dir.glob("*.mp4"):
                    shutil.copy2(rendered, output_dir / rendered.name)
                result["output_directory"] = str(output_dir)
        finally:
            shutil.rmtree(work_dir, ignore_errors=True)
        output.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    except (OSError, RuntimeError, ValueError) as exc:
        print(f"Renderer benchmark failed: {exc}", file=sys.stderr)
        return 2

    print(json.dumps({
        "output": str(output),
        "summaries": result["summaries"],
        "comparison": result["comparison"],
    }, indent=2))
    if any(summary["failed"] for summary in result["summaries"].values()):
        return 1
    ratio = result["comparison"]["dom_to_ass_median_ratio"]
    if args.max_dom_to_ass_ratio is not None and (
        ratio is None or ratio > args.max_dom_to_ass_ratio
    ):
        print(
            f"DOM/ASS median ratio {ratio!r} exceeds {args.max_dom_to_ass_ratio}",
            file=sys.stderr,
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
