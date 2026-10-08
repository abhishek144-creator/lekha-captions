"""Video encoder selection: NVENC when available, libx264 otherwise."""

import os

try:
    from .media_commands import run_media_command
except ImportError:  # Direct execution from backend/ remains supported.
    from media_commands import run_media_command


# --- Video encoder selection -------------------------------------------------
# Burning captions is CPU-bound on libx264, which is what caps concurrent
# exports on a shared host. When the machine has an NVIDIA card with an NVENC
# block we hand the encode to the GPU instead and keep libx264 as the fallback.
# EXPORT_VIDEO_ENCODER pins the choice: "auto" (default) | "cpu" | "nvenc".
_NVENC_PROBE_CACHE = None


def _disable_nvenc(reason):
    """Stop offering NVENC for the rest of this process."""
    global _NVENC_PROBE_CACHE
    if _NVENC_PROBE_CACHE is not False:
        print(f"[Encoder] Disabling NVENC for this process: {reason}")
    _NVENC_PROBE_CACHE = False


def _nvenc_supported():
    """True only when ffmpeg lists h264_nvenc AND a real encode actually runs."""
    global _NVENC_PROBE_CACHE
    if _NVENC_PROBE_CACHE is not None:
        return _NVENC_PROBE_CACHE
    _NVENC_PROBE_CACHE = False
    try:
        encoders = run_media_command(
            ["ffmpeg", "-hide_banner", "-encoders"],
            capture_output=True, text=True, timeout=20,
        )
        if encoders.returncode != 0 or "h264_nvenc" not in (encoders.stdout or ""):
            print("[Encoder] NVENC not built into ffmpeg — using libx264.")
            return False
        # Listing the encoder is not proof it works: a missing driver, or a card
        # with no NVENC block at all (e.g. GT 710), only fails at encode time.
        smoke = run_media_command(
            ["ffmpeg", "-hide_banner", "-y", "-f", "lavfi",
             "-i", "color=c=black:s=256x256:d=0.1",
             "-c:v", "h264_nvenc", "-f", "null", "-"],
            capture_output=True, text=True, timeout=60,
        )
        _NVENC_PROBE_CACHE = smoke.returncode == 0
        if not _NVENC_PROBE_CACHE:
            print("[Encoder] NVENC present but unusable on this host — using libx264.")
    except Exception as e:
        print(f"[Encoder] NVENC probe failed ({e}) — using libx264.")
        _NVENC_PROBE_CACHE = False
    if _NVENC_PROBE_CACHE:
        print("[Encoder] NVENC available — GPU encoding enabled.")
    return _NVENC_PROBE_CACHE


def _video_encoder_args(crf, force_cpu=False):
    """FFmpeg video-codec args for the active encoder.

    libx264 rate-controls with -crf. NVENC has no CRF, so the same number is
    mapped onto its constant-quality control (-cq with VBR), which is the
    nearest equivalent and keeps quality comparable across both paths.
    """
    mode = (os.environ.get("EXPORT_VIDEO_ENCODER", "auto") or "auto").strip().lower()
    use_gpu = (not force_cpu) and (
        mode == "nvenc" or (mode == "auto" and _nvenc_supported())
    )
    if use_gpu:
        return ["-c:v", "h264_nvenc", "-preset", "p4", "-rc", "vbr",
                "-cq", str(crf), "-b:v", "0"]
    # Constant-quality x264 presets trade compression time for output size, not
    # visual quality. `veryfast` materially reduces customer wait time on the
    # CPU-only GCE workers while keeping the existing CRF quality targets.
    cpu_preset = (os.environ.get("EXPORT_CPU_PRESET", "veryfast") or "veryfast").strip().lower()
    allowed_cpu_presets = {
        "ultrafast", "superfast", "veryfast", "faster", "fast", "medium",
    }
    if cpu_preset not in allowed_cpu_presets:
        print(f"[Encoder] Invalid EXPORT_CPU_PRESET={cpu_preset!r}; using veryfast.")
        cpu_preset = "veryfast"
    return ["-c:v", "libx264", "-preset", cpu_preset, "-crf", str(crf)]
