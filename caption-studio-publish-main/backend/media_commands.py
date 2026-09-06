"""Bound execution of trusted argument arrays against untrusted local media."""
import os
import subprocess

PROBE_TIMEOUT_SECONDS = 30
RENDER_TIMEOUT_SECONDS = 15 * 60


def run_media_command(args, **kwargs):
    if not isinstance(args, (list, tuple)) or kwargs.get("shell"):
        raise ValueError("Media commands require an argument array without a shell")
    command = list(args)
    executable = os.path.basename(str(command[0])).lower().removesuffix(".exe")
    if executable not in {"ffmpeg", "ffprobe"}:
        raise ValueError("Only ffmpeg and ffprobe are supported")
    # Apply to EVERY input, including overlay/concat inputs. No network, crypto,
    # data or nested URL protocols are needed by the local rendering pipeline.
    if executable == "ffmpeg":
        bounded = [command[0], "-nostdin"]
        for item in command[1:]:
            if item == "-i":
                bounded.extend(["-protocol_whitelist", "file,pipe"])
            bounded.append(item)
        command = bounded
    else:
        command[1:1] = ["-protocol_whitelist", "file,pipe"]
    maximum = PROBE_TIMEOUT_SECONDS if executable == "ffprobe" else RENDER_TIMEOUT_SECONDS
    requested = kwargs.pop("timeout", maximum)
    kwargs["timeout"] = min(float(requested or maximum), maximum)
    # subprocess.run kills and waits for the ffmpeg/ffprobe process on timeout.
    return subprocess.run(command, **kwargs)
